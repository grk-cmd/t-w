// xlsx 는 «XML 몇 장을 담은 zip» 이라 zip 만 풀면 브라우저 DOMParser 로 첫 시트 글자를 읽을 수 있다(앱과 같은 방식).
// zip 은 fflate — 이 화면에서만 쓰므로 파일을 고를 때 따로 받는다(첫 화면 번들에 안 들어간다).
// 옛 .xls(이진 형식)는 읽지 못한다.

export type Grid = string[][];

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const kids = (el: Document | Element, name: string) => Array.from(el.getElementsByTagNameNS('*', name));

/** 'B12' → 1 (0부터). */
export function columnIndex(ref: string | null): number {
  const m = /^([A-Z]+)/.exec(String(ref ?? '').toUpperCase());
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function columnName(index: number): string {
  let s = '';
  for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// 서식 조각(<r><t>)은 잇고, 후리가나(<rPh>)는 뺀다.
function stringItemText(si: Element): string {
  let out = '';
  for (const ch of Array.from(si.childNodes) as Element[]) {
    if (ch.localName === 't') out += ch.textContent;
    else if (ch.localName === 'r') for (const t of kids(ch, 't')) out += t.textContent;
  }
  return out;
}

/** xlsx → 첫 시트의 2차원 글자 배열. 실패하면 사람이 읽을 문구를 담은 Error. */
export async function readXlsx(buf: ArrayBuffer): Promise<Grid> {
  const { unzipSync, strFromU8 } = await import('fflate');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buf));
  } catch {
    throw new Error('엑셀 파일을 열 수 없어요 — .xlsx 로 다시 저장해 주세요(옛 .xls 는 못 읽어요)');
  }
  const parser = new DOMParser();
  const xml = (path: string) =>
    files[path] ? parser.parseFromString(strFromU8(files[path]), 'application/xml') : null;

  const wb = xml('xl/workbook.xml');
  if (!wb) throw new Error('엑셀 파일이 아니에요 — .xlsx 로 다시 저장해 주세요');
  const sheet = kids(wb, 'sheet')[0];
  if (!sheet) throw new Error('시트가 없어요');

  // 첫 시트의 실제 경로는 r:id → workbook.xml.rels 의 Target. 못 찾으면 관례 경로.
  let path = 'xl/worksheets/sheet1.xml';
  const rid = sheet.getAttributeNS(REL_NS, 'id') || sheet.getAttribute('r:id');
  const rels = xml('xl/_rels/workbook.xml.rels');
  if (rels && rid) {
    const target = kids(rels, 'Relationship')
      .find((r) => r.getAttribute('Id') === rid)
      ?.getAttribute('Target');
    if (target) path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  const sh = xml(path);
  if (!sh) throw new Error('첫 시트를 읽을 수 없어요');
  const ssDoc = xml('xl/sharedStrings.xml');
  const shared = ssDoc ? kids(ssDoc, 'si').map(stringItemText) : [];

  const rows: Grid = [];
  for (const row of kids(sh, 'row')) {
    const rn = parseInt(row.getAttribute('r') ?? '', 10);
    const cells: string[] = [];
    let ci = 0;
    for (const c of kids(row, 'c')) {
      const ix = columnIndex(c.getAttribute('r'));
      if (ix >= 0) ci = ix;
      const type = c.getAttribute('t') || 'n';
      const v = kids(c, 'v')[0];
      let value = '';
      if (type === 's') value = v ? (shared[parseInt(v.textContent ?? '', 10)] ?? '') : '';
      else if (type === 'inlineStr') {
        const is = kids(c, 'is')[0];
        value = is ? stringItemText(is) : '';
      } else value = v?.textContent ?? '';
      cells[ci++] = value;
    }
    rows[rn > 0 ? rn - 1 : rows.length] = Array.from(cells, (x) => x ?? '');
  }
  return Array.from(rows, (r) => r ?? []);
}

/** csv 바이트 → 글자. BOM 이 있으면 UTF-8, 없으면 UTF-8 로 엄격히 읽어 보고 깨지면 EUC-KR(한글 엑셀이 저장한 csv). */
export function decodeCsv(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf)
    return new TextDecoder('utf-8').decode(u8.subarray(3));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(u8);
    } catch {
      return new TextDecoder('utf-8').decode(u8);
    }
  }
}

/** csv 글자 → 2차원 배열(따옴표 · 따옴표 안 줄바꿈 · "" 이스케이프). 첫 줄에 쉼표가 없고 탭이 있으면 탭으로 가른다. */
export function parseCsv(text: string): Grid {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = !firstLine.includes(',') && firstLine.includes('\t') ? '\t' : ',';
  const rows: Grid = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cur += ch;
      else if (text[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && cur === '') quoted = true;
    else if (ch === sep) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export async function readSheetFile(file: File): Promise<Grid> {
  if (/\.xls$/i.test(file.name))
    throw new Error('옛 .xls 는 못 읽어요 — 엑셀에서 .xlsx 로 다시 저장해 주세요');
  const buf = await file.arrayBuffer();
  return /\.csv$/i.test(file.name) ? parseCsv(decodeCsv(buf)) : readXlsx(buf);
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const escapeXml = (v: unknown) =>
  String(v ?? '')
    // eslint-disable-next-line no-control-regex -- XML 1.0 이 받지 않는 제어 문자를 지운다
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 2차원 글자 배열 → xlsx. 모든 칸을 글자(inlineStr)로 — 키 · 코드가 숫자나 날짜로 바뀌지 않게. 첫 줄은 굵게. */
export async function writeXlsx(rows: Grid, sheetName: string): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate');
  const width: number[] = [];
  rows.forEach((r) =>
    r.forEach((v, i) => {
      width[i] = Math.max(width[i] ?? 8, Math.min(48, String(v ?? '').length * 1.6 + 2));
    }),
  );
  const cols = width.length
    ? '<cols>' +
      width
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`)
        .join('') +
      '</cols>'
    : '';
  const body = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">` +
        r
          .map(
            (v, ci) =>
              `<c r="${columnName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ''}>` +
              `<is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`,
          )
          .join('') +
        '</row>',
    )
    .join('');
  const name = escapeXml(sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  const sheetType = 'application/vnd.openxmlformats-officedocument.spreadsheetml';

  return zipSync({
    '[Content_Types].xml': strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${sheetType}.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheetType}.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${sheetType}.styles+xml"/>` +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEAD}<workbook xmlns="${SHEET_NS}" xmlns:r="${OFFICE_REL}">` +
        `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="rId1" Type="${OFFICE_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${OFFICE_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      `${XML_HEAD}<styleSheet xmlns="${SHEET_NS}">` +
        '<fonts count="2"><font><sz val="11"/><name val="Malgun Gothic"/></font><font><b/><sz val="11"/><name val="Malgun Gothic"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `${XML_HEAD}<worksheet xmlns="${SHEET_NS}">${cols}<sheetData>${body}</sheetData></worksheet>`,
    ),
  });
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
