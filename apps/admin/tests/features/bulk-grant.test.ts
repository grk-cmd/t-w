// @vitest-environment jsdom
// xlsx 는 브라우저 DOMParser 로 읽는다 — node 에는 없어서 이 파일만 jsdom 에서 돈다.
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  decodeCsv,
  grantRow,
  issuedIndex,
  judge,
  lookupRows,
  mapRows,
  parseCsv,
  readXlsx,
  resultSheet,
  rowNote,
  runBulkGrant,
  wasIssued,
  writeXlsx,
  type PlanRow,
} from '@/features/license/bulk-grant';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const buf = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

const row = (over: Partial<PlanRow>): PlanRow => ({
  line: 2,
  cells: [],
  raw: '',
  memo: '',
  code: '',
  uid: null,
  name: '',
  base: 'key',
  st: 'key',
  ...over,
});

describe('일괄 발급 — 파일 읽기', () => {
  it('csv: 따옴표 · 따옴표 안 쉼표 · 줄바꿈 · "" 이스케이프', () => {
    expect(parseCsv('친구코드,메모\r\nMATE-AB12,"철수, ""VIP"""\n"COZY-CD34","두\n줄"')).toEqual([
      ['친구코드', '메모'],
      ['MATE-AB12', '철수, "VIP"'],
      ['COZY-CD34', '두\n줄'],
    ]);
  });

  it('csv: 쉼표가 없고 탭이 있으면 탭으로 가른다', () => {
    expect(parseCsv('코드\t메모\nAB12\tx')).toEqual([
      ['코드', '메모'],
      ['AB12', 'x'],
    ]);
  });

  it('csv: BOM 은 떼고, UTF-8 이 아니면 EUC-KR 로 읽는다', () => {
    expect(decodeCsv(buf(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])))).toBe('A');
    expect(decodeCsv(buf(new Uint8Array([0xb0, 0xa1, 0x2c, 0x41])))).toBe('가,A');
  });

  it('xlsx: 쓴 파일을 다시 읽으면 같은 글자(숫자처럼 생긴 코드도 글자 그대로)', async () => {
    const grid = [
      ['친구코드', '메모'],
      ['0012', '<특수> & "기호"'],
      ['MATE-AB12', ''],
    ];
    expect(await readXlsx(buf(await writeXlsx(grid, '발급 결과')))).toEqual(grid);
  });

  it('xlsx: 공유 문자열 · 빈 칸 건너뛴 셀 주소 · 숫자 셀 · rels 로 찾은 첫 시트', async () => {
    const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const zip = zipSync({
      'xl/workbook.xml': strToU8(
        `<workbook ${ns} xmlns:r="${rel}"><sheets><sheet name="A" sheetId="1" r:id="rId7"/></sheets></workbook>`,
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Target="worksheets/other.xml"/></Relationships>`,
      ),
      'xl/sharedStrings.xml': strToU8(
        `<sst ${ns}><si><t>친구코드</t></si><si><r><t>AB</t></r><r><t>12</t></r><rPh><t>x</t></rPh></si></sst>`,
      ),
      'xl/worksheets/other.xml': strToU8(
        `<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row>` +
          `<row r="3"><c r="A3" t="s"><v>1</v></c><c r="C3"><v>42</v></c></row></sheetData></worksheet>`,
      ),
    });
    expect(await readXlsx(buf(zip))).toEqual([['친구코드'], [], ['AB12', '', '42']]);
  });

  it('xlsx 가 아니면 사람이 읽는 문구로 실패', async () => {
    await expect(readXlsx(buf(strToU8('not a zip')))).rejects.toThrow(/\.xlsx 로 다시 저장/);
  });
});

describe('일괄 발급 — 행 판정', () => {
  it('제목 줄의 «친구코드» · «메모» 열을 찾고, 빈 줄은 건너뛴다', () => {
    const map = mapRows([
      ['메모', '친구코드'],
      ['철수', 'AB12'],
      ['', ''],
      ['영희', ''],
    ]);
    expect(map.codeCol).toBe(1);
    expect(map.memoCol).toBe(0);
    expect(map.data.map((d) => [d.line, d.code, d.memo])).toEqual([
      [2, 'AB12', '철수'],
      [4, '', '영희'],
    ]);
  });

  it('첫 줄 A칸이 친구코드처럼 생겼으면 제목 줄이 없다고 본다', () => {
    const map = mapRows([['mate-ab12', 'x']]);
    expect(map.header).toBeNull();
    expect(map.data[0]).toMatchObject({ line: 1, code: 'mate-ab12', memo: 'x' });
  });

  it('결과 파일을 다시 올리면 «발급 키» 칸이 찬 행을 표시한다', () => {
    const map = mapRows([
      ['친구코드', '메모', '발급 키'],
      ['AB12', '', 'KEY'],
      ['CD34', '', ''],
    ]);
    expect(map.data.map((d) => d.hasKey)).toEqual([true, false]);
  });

  it('발급 목록 메모에서 이미 받은 친구코드를 찾는다(두 메모 모양 모두)', () => {
    const idx = issuedIndex({
      a: { note: '철수 · 친구코드 MATE-AB12' },
      b: { note: '친구코드 발급: CD34' },
      c: { note: '엑셀 일괄 · 메모' },
    });
    expect(wasIssued(idx, 'MATE-AB12')).toBe(true);
    expect(wasIssued(idx, 'COZY-CD34')).toBe(true);
    expect(wasIssued(idx, 'COZY-AB12')).toBe(false);
    expect(wasIssued(null, 'MATE-AB12')).toBe(false);
  });

  it('같은 코드는 첫 행만 · 전에 발급한 코드는 건너뜀 — 옵션을 끄면 다시 발급', () => {
    const rows = [
      row({ line: 2, base: 'send', code: 'MATE-AB12' }),
      row({ line: 3, base: 'send', code: 'MATE-AB12' }),
      row({ line: 4, base: 'send', code: 'COZY-CD34' }),
      row({ line: 5, base: 'key' }),
    ];
    const idx = issuedIndex({ k: { note: '친구코드 COZY-CD34' } });
    expect(judge(rows, { dupFirst: true, reissue: false }, idx).map((r) => [r.st, r.dupOf])).toEqual([
      ['send', undefined],
      ['dup', 2],
      ['issued', undefined],
      ['key', undefined],
    ]);
    expect(judge(rows, { dupFirst: false, reissue: true }, idx).map((r) => r.st)).toEqual([
      'send',
      'send',
      'send',
      'key',
    ]);
  });

  it('이미 키가 있는 행의 코드도 뒷 행 중복 판정에 센다', () => {
    const rows = [
      row({ line: 2, base: 'haskey', code: 'MATE-AB12' }),
      row({ line: 3, base: 'send', code: 'MATE-AB12' }),
    ];
    expect(judge(rows, { dupFirst: true, reissue: true }, null)[1]).toMatchObject({ st: 'dup', dupOf: 2 });
  });

  it('메모는 단건 발급과 같은 모양 + 파일 메모, 100자에서 자른다', () => {
    expect(rowNote(row({ st: 'send', name: '철수', code: 'MATE-AB12', memo: '이벤트' }))).toBe(
      '철수 · 친구코드 MATE-AB12 · 이벤트',
    );
    expect(rowNote(row({ st: 'key', memo: '' }))).toBe('엑셀 일괄');
    expect(rowNote(row({ st: 'key', memo: 'x'.repeat(200) }))).toHaveLength(100);
  });
});

describe('일괄 발급 — 조회 · 발급', () => {
  const data = (code: string, line = 2, hasKey = false) => ({ line, cells: [code], code, memo: '', hasKey });

  it('조회는 읽기만 — 찾음 · 없음 · 형식 아님 · 빈 칸 · 이미 키 있음', async () => {
    const { db, writes } = fakeDb({
      'friendCodes/COZY-AB12': { userId: 'u1' },
      'users/u1/profile/name': '철수',
    });
    const rows = await lookupRows(db, [
      data('ab12', 2),
      data('MATE-ZZ99', 3),
      data('hello!', 4),
      data('', 5),
      data('AB12', 6, true),
    ]);
    expect(rows.map((r) => [r.base, r.code, r.uid, r.name])).toEqual([
      ['send', 'COZY-AB12', 'u1', '철수'],
      ['nouser', '', null, ''],
      ['badcode', '', null, ''],
      ['key', '', null, ''],
      ['haskey', 'COZY-AB12', 'u1', '철수'],
    ]);
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('조회가 실패하면 «조회 실패» 로 남긴다', async () => {
    const { db } = fakeDb();
    db.get = async () => {
      throw new Error('offline');
    };
    expect((await lookupRows(db, [data('AB12')]))[0].base).toBe('neterr');
  });

  it('보내는 행은 키와 수령함을 한 묶음으로, 빈 코드 행은 키만', async () => {
    const { db, writes } = fakeDb();
    await grantRow(db, row({ st: 'send', uid: 'u1', code: 'MATE-AB12' }), () => 'K1');
    await grantRow(db, row({ st: 'key' }), () => 'K2');
    expect(withoutAudits(writes).map(([op, path]) => [op, path.replace(/\/m[^/]+$/, '/m…')])).toEqual([
      ['commit', 'licenses/K1'],
      ['commit', 'inbox/u1/m…'],
      ['commit', 'licenses/K2'],
    ]);
  });

  it('한 행이 실패해도 나머지는 계속하고, 건너뛸 행은 손대지 않는다', async () => {
    const { db, writes } = fakeDb({}, (p) => p.startsWith('inbox/bad'));
    const keys = ['K1', 'K2', 'K3'];
    const result = await runBulkGrant(
      db,
      [row({ line: 2, st: 'send', uid: 'bad' }), row({ line: 3, st: 'dup' }), row({ line: 4, st: 'key' })],
      undefined,
      () => keys.shift()!,
    );
    expect(result.map((r) => [r.res, r.key])).toEqual([
      ['fail', undefined],
      [undefined, undefined],
      ['okkey', 'K2'],
    ]);
    expect(withoutAudits(writes).map(([, path]) => path)).toEqual(['licenses/K2']);
  });

  it('결과 파일 — 원본 뒤에 발급 키 · 결과 · 사유, 다시 올린 파일은 그 열을 채운다', () => {
    const grid = [
      ['친구코드', '메모'],
      ['AB12', '철수'],
      ['ZZ99', ''],
    ];
    const map = mapRows(grid);
    const rows = [
      row({ line: 2, cells: ['AB12', '철수'], st: 'send', res: 'ok', key: 'K1', name: '철수' }),
      row({ line: 3, cells: ['ZZ99', ''], st: 'nouser' }),
    ];
    const out = resultSheet(rows, map, grid);
    expect(out).toEqual([
      ['친구코드', '메모', '발급 키', '결과', '사유'],
      ['AB12', '철수', 'K1', '수령함 발송', '받는 사람: 철수'],
      ['ZZ99', '', '', '건너뜀', '친구코드를 가진 유저가 없음'],
    ]);
    const again = mapRows(out);
    const rerun = resultSheet(
      [
        row({ line: 2, cells: out[1], st: 'haskey' }),
        row({ line: 3, cells: out[2], st: 'key', res: 'okkey', key: 'K2' }),
      ],
      again,
      out,
    );
    expect(rerun[0]).toHaveLength(5);
    expect(rerun[1]).toEqual(out[1]);
    expect(rerun[2]).toEqual(['ZZ99', '', 'K2', '키만 발급', '']);
  });
});
