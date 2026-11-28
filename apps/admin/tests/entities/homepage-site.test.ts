import { describe, expect, it } from 'vitest';
import {
  checkDownload,
  checkNewsDraft,
  createSiteNews,
  deleteSiteNews,
  emptyNewsDraft,
  getSiteDownload,
  listSiteNews,
  newsToDraft,
  NoSiteApiError,
  putSiteDownload,
  sameNews,
  SITE_BODY_MAX,
  SITE_TITLE_MAX,
  siteDownloadOf,
  siteNewsOf,
  updateSiteNews,
  type SiteDownload,
} from '@/entities/homepage/site';
import { fakeApiOf } from '../shared/fakeApi';

const t = (ko: string, en = '', ja = '') => ({ ko, en, ja });
const item = (o: Record<string, unknown> = {}) => ({
  id: 'n1',
  pinned: false,
  title: t('업데이트', 'Update'),
  body: t('고쳤어요', 'Fixed'),
  publishedAt: '2026-11-20T03:00:00Z',
  version: 3,
  updatedAt: '2026-11-21T03:00:00Z',
  ...o,
});
const saved: SiteDownload = {
  open: false,
  version: null,
  files: { win: null, macArm64: null, macX64: null },
  rev: 7,
};

describe('홈페이지 소식 — 서버 모양 맞추기', () => {
  it('목록: 모양이 틀린 글은 빼고 · 고정 먼저 · 최신 순', () => {
    const list = siteNewsOf([
      item({ id: 'old', publishedAt: '2026-01-01T00:00:00Z' }),
      item({ id: 'pin', pinned: true, publishedAt: '2025-01-01T00:00:00Z' }),
      item({ id: 'new', publishedAt: '2026-06-01T00:00:00Z' }),
      item({ id: '' }),
      item({ id: 'noVer', version: undefined }),
      item({ id: 'badTitle', title: { ko: 1 } }),
    ]);
    expect(list.map((n) => n.id)).toEqual(['pin', 'new', 'old']);
    expect(list[0]?.title).toEqual(t('업데이트', 'Update'));
    expect(siteNewsOf(null)).toEqual([]);
  });

  it('쓰기 칸 확인: 한국어 제목 꼭 · 상한 · 본문만 있는 언어 안 됨 · 앞뒤 빈칸 뗌', () => {
    const d = (o: Partial<ReturnType<typeof emptyNewsDraft>>) => ({ ...emptyNewsDraft(), ...o });
    expect(checkNewsDraft(d({ title: t('  ') })).ok).toBe(false);
    expect(checkNewsDraft(d({ title: t('가'.repeat(SITE_TITLE_MAX + 1)) })).ok).toBe(false);
    expect(checkNewsDraft(d({ title: t('가'.repeat(SITE_TITLE_MAX)) })).ok).toBe(true);
    expect(checkNewsDraft(d({ title: t('가'), body: t('나'.repeat(SITE_BODY_MAX + 1)) })).ok).toBe(false);
    expect(checkNewsDraft(d({ title: t('가'), body: t('', 'only body') })).ok).toBe(false);
    const r = checkNewsDraft(d({ pinned: true, title: t(' 가 ', ' A '), body: t(' 나 \n') }));
    expect(r).toEqual({ ok: true, next: { pinned: true, title: t('가', 'A'), body: t('나') } });
  });

  it('고치기에서 바뀐 게 없으면 같은 글', () => {
    const n = siteNewsOf([item()])[0]!;
    expect(sameNews(newsToDraft(n), newsToDraft(n))).toBe(true);
    expect(sameNews(newsToDraft(n), { ...newsToDraft(n), pinned: true })).toBe(false);
    expect(sameNews(newsToDraft(n), { ...newsToDraft(n), body: t('고쳤어요', 'Fixed', '直した') })).toBe(
      false,
    );
  });
});

describe('홈페이지 내려받기 — 모양 · 저장 확인', () => {
  it('열림 칸 · rev 가 없으면 모름(null)', () => {
    expect(siteDownloadOf({ open: true })).toBeNull();
    expect(siteDownloadOf({ rev: 1 })).toBeNull();
    expect(
      siteDownloadOf({ open: true, version: '0.14.0', rev: 2, files: { win: 'https://x/a.exe' } }),
    ).toEqual({
      open: true,
      version: '0.14.0',
      files: { win: 'https://x/a.exe', macArm64: null, macX64: null },
      rev: 2,
    });
  });

  it('열려면 판이 있어야 · 판은 정식 릴리스 목록 안에서만 · 같은 값은 저장 안 함 · rev 를 실어 보낸다', () => {
    const vs = ['0.14.0', '0.13.1'];
    expect(checkDownload(saved, { open: true, version: null }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: true, version: '0.99.0' }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: false, version: null }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: true, version: '0.14.0' }, vs)).toEqual({
      ok: true,
      next: { open: true, version: '0.14.0', rev: 7 },
    });
    // 목록을 못 받았으면(null) 판 이름은 서버가 다시 확인한다
    expect(checkDownload(saved, { open: true, version: '0.14.0' }, null).ok).toBe(true);
    // 닫기는 판이 없어도 된다
    expect(
      checkDownload({ ...saved, open: true, version: '0.14.0' }, { open: false, version: '0.14.0' }, vs),
    ).toEqual({
      ok: true,
      next: { open: false, version: '0.14.0', rev: 7 },
    });
  });
});

describe('홈페이지 소식 · 내려받기 — 서버 길', () => {
  it('API 가 없는 환경이면 NoSiteApiError', async () => {
    await expect(listSiteNews(null)).rejects.toBeInstanceOf(NoSiteApiError);
    await expect(getSiteDownload(null)).rejects.toBeInstanceOf(NoSiteApiError);
  });

  it('소식 목록 · 쓰기 · 고치기(version 을 실음) · 지우기(query.version)', async () => {
    const { api, calls } = fakeApiOf({
      'GET /v2/admin/site/news': () => ({ items: [item()] }),
      'POST /v2/admin/site/news': () => item({ id: 'n2', version: 1 }),
      'PATCH /v2/admin/site/news/n1': () => item({ version: 4 }),
      'DELETE /v2/admin/site/news/n1': () => undefined,
    });
    const [n1] = await listSiteNews(api);
    const draft = { pinned: false, title: t('새 글'), body: t('') };
    expect((await createSiteNews(api, draft)).id).toBe('n2');
    expect((await updateSiteNews(api, n1!, draft)).version).toBe(4);
    await deleteSiteNews(api, n1!);
    expect(calls.map((c) => [c.method, c.body, c.query])).toEqual([
      ['GET', undefined, undefined],
      ['POST', draft, undefined],
      ['PATCH', { ...draft, version: 3 }, undefined],
      ['DELETE', undefined, { version: 3 }],
    ]);
  });

  it('id 는 주소에 넣을 때 감싼다 · 서버 답 모양이 틀리면 던진다(화면을 믿지 않게)', async () => {
    const { api, calls } = fakeApiOf({
      'PATCH /v2/admin/site/news/a%2Fb': () => ({ nope: true }),
    });
    const from = siteNewsOf([item({ id: 'a/b' })])[0]!;
    await expect(updateSiteNews(api, from, newsToDraft(from))).rejects.toThrow('모양');
    expect(calls[0]?.path).toBe('/v2/admin/site/news/a%2Fb');
  });

  it('내려받기 읽기 · 저장(rev 를 실음) · 답 모양이 틀리면 던진다', async () => {
    const { api, calls } = fakeApiOf({
      'GET /v2/admin/site/download': () => ({ ...saved, updatedAt: '2026-11-21T00:00:00Z' }),
      'PUT /v2/admin/site/download': (c) => ({ ...saved, ...(c.body as object), rev: 8 }),
    });
    expect(await getSiteDownload(api)).toEqual(saved);
    const next = { open: true, version: '0.14.0', rev: 7 };
    expect((await putSiteDownload(api, next)).rev).toBe(8);
    expect(calls[1]?.body).toEqual(next);
    const bad = fakeApiOf({ 'GET /v2/admin/site/download': () => ({ open: 'yes' }) });
    await expect(getSiteDownload(bad.api)).rejects.toThrow('모양');
  });
});
