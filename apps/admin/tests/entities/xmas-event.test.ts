import { describe, expect, it } from 'vitest';
import {
  authorsPageOf,
  bucketOf,
  canReturn,
  clockOf,
  getReportDetail,
  getUserLetters,
  imageUrl,
  LETTER_IDS,
  lettersOf,
  listLetterAuthors,
  listXmasReports,
  NoApiError,
  reportDetailOf,
  reportsOf,
  RETURN_REASONS,
  returnArgs,
} from '@/entities/seasonal/xmas-event';
import type { Api, ApiParams } from '@/shared/api';

const SONG = { id: 'abcdefghijk', title: '캐럴' };
const ID = 'a'.repeat(32);
const BUCKET = 'together-working.firebasestorage.app';

/** 가짜 API — 길마다 정한 답(함수면 params 로 불러서) */
function fakeApi(routes: Record<string, unknown>) {
  const gets: [string, ApiParams | undefined][] = [];
  const api: Api = {
    get: async <T>(path: string, params?: ApiParams) => {
      gets.push([path, params]);
      const r = routes[path];
      return (typeof r === 'function' ? r(params) : r) as T;
    },
    send: async () => {
      throw new Error('send 는 쓰지 않는다');
    },
    upload: async () => {
      throw new Error('upload 는 쓰지 않는다');
    },
  };
  return { api, gets };
}

describe('편지', () => {
  it('서버 letters 맵 → 칸 순서 · 판 · 고친 때 · 곡(틀린 칸 · 판 없는 칸은 뺀다)', () => {
    const box = {
      l3: { text: '셋', version: 2, updatedAt: '2026-12-01T00:00:00Z' },
      l1: { text: '하나', version: 5, updatedAt: '2026-12-02T00:00:00Z', song: SONG },
      l2: { text: '', version: 1 },
      l4: { text: '판 없음' },
      l9: { text: '없는 칸', version: 1 },
    };
    const L = lettersOf('AB12CD', box);
    expect(L.map((l) => l.lid)).toEqual(['l1', 'l3']);
    expect(L[0]).toEqual({
      userCode: 'AB12CD',
      lid: 'l1',
      text: '하나',
      version: 5,
      at: Date.parse('2026-12-02T00:00:00Z'),
      song: SONG,
    });
    expect(lettersOf('X', null)).toEqual([]);
    expect(LETTER_IDS).toEqual(['l1', 'l2', 'l3', 'l4', 'l5']);
  });
  it('반송 인자 — 본 판(version) · 기타는 메모가 있어야 · 다른 사유는 메모를 싣지 않는다', () => {
    const l = { userCode: 'AB12CD', lid: 'l1', version: 3 };
    expect(returnArgs(l, 'etc', '  ')).toBeNull();
    expect(returnArgs(l, 'etc', '  번호  있음 ' + 'x'.repeat(60))?.note?.length).toBe(40);
    expect(returnArgs(l, 'spam', '무시')).toEqual({
      userCode: 'AB12CD',
      lid: 'l1',
      version: 3,
      reason: 'spam',
    });
    expect(Object.keys(RETURN_REASONS)).toEqual(['abuse', 'privacy', 'spam', 'etc']);
  });
  it('반송 마감 — 서버가 준 returnCutoff 전까지(서버 시각으로)', () => {
    const c = clockOf({ now: '2026-12-24T14:58:00Z', returnCutoff: '2026-12-24T14:59:00Z' });
    expect(c && canReturn(c.now, c.returnCutoff)).toBe(true);
    expect(canReturn(Date.parse('2026-12-24T14:59:00Z'), Date.parse('2026-12-24T14:59:00Z'))).toBe(false);
    expect(clockOf({ now: 'x' })).toBeNull();
  });
  it('맡긴 사람 — 키셋 쪽을 next 가 없을 때까지 · 한 사람 편지는 그 사람 경로만', async () => {
    const { api, gets } = fakeApi({
      '/v2/admin/xmas/letter-authors': (p: ApiParams) =>
        p.cursor
          ? { items: [{ userCode: 'B', name: '비', letters: 1, updatedAt: 'x' }], next: null }
          : { items: [{ userCode: 'A', name: '에이', letters: 2 }, { name: '코드 없음' }], next: 'C1' },
      '/v2/admin/xmas/letters/A': {
        letters: { l1: { text: 'x', version: 1, updatedAt: 'x' } },
        returned: {},
      },
    });
    expect((await listLetterAuthors(api)).map((a) => a.userCode)).toEqual(['A', 'B']);
    expect(gets.map((g) => g[1])).toEqual([
      { cursor: undefined, limit: 100 },
      { cursor: 'C1', limit: 100 },
    ]);
    expect((await getUserLetters(api, 'A'))[0]).toMatchObject({ userCode: 'A', lid: 'l1', version: 1 });
    expect(authorsPageOf(null)).toEqual({ items: [], next: null });
  });
  it('API 가 없으면(dev · e2e) NoApiError — 옛 RTDB 로 읽지 않는다', async () => {
    await expect(listLetterAuthors(null)).rejects.toBeInstanceOf(NoApiError);
  });
});

describe('신고', () => {
  it('목록 → 장식 · 받은 편지 줄(서버 순서 그대로) · 모르는 종류는 뺀다', async () => {
    const items = [
      {
        key: 'g-AB12CD-2',
        type: 'received',
        recipientCode: 'AB12CD',
        n: 2,
        count: 3,
        firstAt: 'x',
        lastAt: '2026-12-25T01:00:00Z',
      },
      { key: 'o-3-12', type: 'ornament', tree: 3, slot: 12, count: 1, firstAt: 'x', lastAt: 'x' },
      { key: 'z', type: 'other' },
    ];
    const { api } = fakeApi({ '/v2/admin/xmas/reports': { items } });
    const R = await listXmasReports(api);
    expect(R.map((r) => r.key)).toEqual(['g-AB12CD-2', 'o-3-12']);
    expect(R[0]).toMatchObject({ kind: 'got', got: 'AB12CD', n: 2, count: 3 });
    expect(R[1]).toMatchObject({ kind: 'orn', tree: 3, slot: 12, count: 1 });
    expect(reportsOf(null)).toEqual([]);
  });
  it('장식 상세 — 그림은 Storage 주소(이 버킷 · xmas%2F{32자 id}.png · alt=media) · 건 사람 · 판 · 신고 최근 순', async () => {
    const { api, gets } = fakeApi({
      '/v2/admin/xmas/reports/o-3-12': {
        ornament: {
          tree: 3,
          slot: 12,
          kind: 'img',
          word: '메리',
          imageId: ID,
          version: 4,
          owner: { userCode: 'OWN001', name: '주인' },
        },
        received: null,
        reports: [
          { reporterCode: 'R1', note: '나쁜 그림', at: '2026-12-01T00:00:00Z' },
          { reporterCode: 'R2', note: null, at: '2026-12-02T00:00:00Z' },
        ],
      },
    });
    const d = await getReportDetail(api, 'o-3-12', BUCKET);
    expect(gets[0][0]).toBe('/v2/admin/xmas/reports/o-3-12');
    expect(d.ornament).toEqual({
      kind: 'img',
      word: '메리',
      img: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/xmas%2F${ID}.png?alt=media`,
      version: 4,
      owner: 'OWN001',
    });
    expect(d.by.map((b) => b.who)).toEqual(['R2', 'R1']);
    expect(d.by[1].note).toBe('나쁜 그림');
  });
  it('그림 id 가 32자 hex 가 아니면 주소를 만들지 않는다(남이 올린 값)', () => {
    expect(imageUrl(BUCKET, '../users/x')).toBeNull();
    expect(imageUrl(BUCKET, ID.toUpperCase())).toBeNull();
    expect(imageUrl('a/b', ID)).toBeNull();
    expect(
      reportDetailOf({ ornament: { kind: 'star', version: 1, imageId: ID } }, BUCKET).ornament?.img,
    ).toBeNull();
    expect(bucketOf('together-working')).toBe(BUCKET);
  });
  it('받은 편지 상세 — 쓴 사람 코드 · 대상이 이미 없으면 null(«없음» 과 못 읽음을 가른다)', () => {
    const d = reportDetailOf(
      {
        ornament: null,
        received: {
          recipientCode: 'AB12CD',
          n: 2,
          text: '광고',
          song: SONG,
          sender: { userCode: 'SND001', lid: 'l3' },
        },
        reports: [],
      },
      BUCKET,
    );
    expect(d.received).toEqual({ text: '광고', song: SONG, sender: 'SND001' });
    expect(reportDetailOf({ ornament: null, received: null, reports: [] }, BUCKET)).toEqual({
      ornament: null,
      received: null,
      by: [],
    });
  });
});
