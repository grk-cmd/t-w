import { describe, expect, it } from 'vitest';
import serverSrc from '../../../../firebase/functions/xmas.js?raw';
import {
  canReturn,
  getOrnament,
  getReportedLetter,
  getUserLetters,
  gotFromOf,
  LETTER_DEADLINE_MS,
  LETTER_IDS,
  lettersOf,
  listLetterAuthors,
  ornamentOf,
  reportsOf,
  RETURN_CUTOFF_MS,
  RETURN_REASONS,
  returnArgs,
  shortUid,
} from '@/entities/seasonal/xmas-event';
import { fakeDb } from '../shared/fakeDb';

// 서버 모듈(firebase/functions/xmas.js)과 같은 숫자 · 사유 표인지 — 한쪽만 바뀌면 반송이 «사유를 골라 주세요» 로 거절된다.
// 글로 받아 그 자리에서 돌린다(맨 위 require 가 없는 모듈 — firebase-admin 은 index.js 가 넘긴다).
interface XmasServer {
  LETTER_DEADLINE_MS: number;
  RETURN_CUTOFF_MS: number;
  RETURN_REASONS: Record<string, string>;
  lettersOf: (all: unknown) => { from: string; id: string; text: string }[];
  returnBody: (reason: string, note: string) => string;
}
const server = new Function('module', `${serverSrc}\nreturn module.exports;`)({ exports: {} }) as XmasServer;

const U1 = 'authUser00001';
const U2 = 'authUser00002';
const SONG = { id: 'abcdefghijk', title: '캐럴' };

describe('서버와 같은 숫자 · 표', () => {
  it('마감 · 반송 마감 · 사유 표', () => {
    expect(LETTER_DEADLINE_MS).toBe(server.LETTER_DEADLINE_MS);
    expect(RETURN_CUTOFF_MS).toBe(server.RETURN_CUTOFF_MS);
    expect(RETURN_REASONS).toEqual(server.RETURN_REASONS);
  });
  it('편지함 다듬기 — 서버 짝 짓기(lettersOf)가 받는 칸과 같다', () => {
    const box = {
      l1: { text: '하나', ts: 1 },
      l2: { text: '', ts: 2 },
      l9: { text: '없는 칸', ts: 3 },
      l3: { text: '셋', ts: 3, song: SONG },
    };
    const mine = lettersOf(U1, box).map((l) => l.lid);
    const srv = server.lettersOf({ [U1]: box }).map((l) => l.id);
    expect(mine).toEqual(['l1', 'l3']);
    expect(mine).toEqual(srv);
  });
});

describe('편지', () => {
  it('칸 순서 · ts 없는 칸 · 곡 모양', () => {
    const l = lettersOf(U1, {
      l2: { text: 'b', ts: 2 },
      l1: { text: 'a', ts: 1, song: { id: 'bad' } },
      l4: { text: 'x' },
    });
    expect(l.map((x) => x.lid)).toEqual(['l1', 'l2']);
    expect(l[0].song).toBeNull();
    expect(lettersOf(U1, null)).toEqual([]);
    expect(LETTER_IDS).toHaveLength(5);
  });
  it('맡긴 사람은 키 이름만 읽는다 · 한 사람 편지는 그 칸만', async () => {
    const { db } = fakeDb({
      xmasLetters: { [U2]: {}, [U1]: {} },
      [`xmasLetters/${U1}`]: { l1: { text: '안녕', ts: 5, song: SONG } },
    });
    expect(await listLetterAuthors(db)).toEqual([U1, U2]);
    expect(await getUserLetters(db, U1)).toEqual([{ uid: U1, lid: 'l1', text: '안녕', ts: 5, song: SONG }]);
  });
  it('반송 마감 — 서버 시각으로 마감 1분 전까지', () => {
    expect(canReturn(LETTER_DEADLINE_MS - RETURN_CUTOFF_MS - 1)).toBe(true);
    expect(canReturn(LETTER_DEADLINE_MS - RETURN_CUTOFF_MS)).toBe(false);
  });
  it('반송 값 — 본 편지의 ts 를 그대로 · 기타는 메모가 있어야 · 메모는 40자', () => {
    const l = { uid: U1, lid: 'l2', ts: 77 };
    expect(returnArgs(l, 'privacy', '무시됨')).toEqual({ uid: U1, lid: 'l2', ts: 77, reason: 'privacy' });
    expect(returnArgs(l, 'etc', '   ')).toBeNull();
    expect(returnArgs(l, 'etc', ' 전화  번호 '.repeat(10))?.note?.length).toBe(40);
    expect(server.returnBody('etc', '전화 번호')).toContain('기타 — 전화 번호');
  });
});

describe('신고', () => {
  it('장식 · 받은 편지 키를 가르고 신고 많은 순 · 모르는 키는 뺀다', () => {
    const r = reportsOf({
      'o-3-12': { [U1]: { ts: 5, note: '욕' } },
      [`g-${U2}-2`]: { [U1]: { ts: 1 }, [U2]: { ts: 9, note: '광고' } },
      'x-1': { [U1]: { ts: 1 } },
      'o-1-1': {},
    });
    expect(r.map((x) => x.key)).toEqual([`g-${U2}-2`, 'o-3-12']);
    expect(r[0]).toMatchObject({ kind: 'got', got: U2, n: 2 });
    expect(r[0].by.map((b) => b.note)).toEqual(['광고', '']);
    expect(r[1]).toMatchObject({ kind: 'orn', tree: 3, slot: 12 });
  });
  it('받은 편지 신고 — 보낸 사람 칸(xmasGotFrom)으로 쓴 사람 편지를 읽는다', async () => {
    const { db } = fakeDb({
      [`xmasGotFrom/${U2}/2`]: `${U1}/l3`,
      [`xmasLetters/${U1}/l3`]: { text: '나쁜 말', ts: 4 },
    });
    expect(await getReportedLetter(db, U2, 2)).toEqual({
      uid: U1,
      lid: 'l3',
      text: '나쁜 말',
      ts: 4,
      song: null,
    });
    expect(await getReportedLetter(db, U2, 3)).toBeNull();
    expect(gotFromOf('bad')).toBeNull();
    expect(gotFromOf(`${U1}/l9`)).toBeNull();
  });
  it('장식 — 그림은 PNG data URL 만 · 건 사람 · 이미 없으면 null', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const { db } = fakeDb({
      'xmasTrees/3/o/12': { k: 'img', v: 2, w: '메리' },
      'xmasImg/3/12': { v: 2, d: png },
      'xmasOwners/3/12': U1,
    });
    expect(await getOrnament(db, 3, 12)).toEqual({ kind: 'img', word: '메리', img: png, owner: U1 });
    expect(await getOrnament(db, 3, 13)).toBeNull();
    expect(ornamentOf({ k: 'img' }, { d: 'javascript:alert(1)' }, 'x')).toEqual({
      kind: 'img',
      word: '',
      img: null,
      owner: null,
    });
    expect(ornamentOf({ k: 'star' }, { d: png }, U1)?.img).toBeNull();
  });
  it('사람은 uid 앞 8자로', () => {
    expect(shortUid(U1)).toBe('authUser…');
    expect(shortUid('short')).toBe('short');
  });
});
