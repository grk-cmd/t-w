import { describe, expect, it } from 'vitest';
import {
  checkDownload,
  checkNewsDraft,
  createSiteNews,
  deleteSiteNews,
  emptyNewsDraft,
  getSiteDownload,
  isSiteConflict,
  listSiteNews,
  newsToDraft,
  putSiteDownload,
  sameNews,
  SITE_BODY_MAX,
  SITE_LANGS,
  SITE_TITLE_MAX,
  siteDownloadFromWire,
  siteErrorMessage,
  siteNewsFromWire,
  siteNewsListFromWire,
  updateSiteNews,
  versionChoices,
  type SiteDownload,
} from '@/entities/homepage/site';
import { ApiError, isPortError, NO_API_TEXT, PortError } from '@/shared/api';
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
const NO_FILES = { win: null, macArm64: null, macX64: null };
const saved: SiteDownload = { open: false, version: null, files: NO_FILES, rev: 7 };
const isShape = (e: unknown) => isPortError(e, 'invalid') && e.code === 'RESPONSE_SHAPE';

describe('홈페이지 소식 — 서버 응답을 엄격하게 읽는다', () => {
  it('목록: 고정 먼저 · 최신 순 · 날짜는 ms', () => {
    const list = siteNewsListFromWire({
      items: [
        item({ id: 'old', publishedAt: '2026-01-01T00:00:00Z' }),
        item({ id: 'pin', pinned: true, publishedAt: '2025-01-01T00:00:00Z' }),
        item({ id: 'new', publishedAt: '2026-06-01T00:00:00Z' }),
      ],
    });
    expect(list.map((n) => n.id)).toEqual(['pin', 'new', 'old']);
    expect(list[1]?.publishedAt).toBe(Date.parse('2026-06-01T00:00:00Z'));
    expect(siteNewsListFromWire({ items: [] })).toEqual([]); // 정말 없으면 빈 목록
  });

  it('목록 모양이 틀리면 빈 목록이 아니라 던진다 — «못 불러옴» 이 «없음» 으로 보이지 않게', () => {
    for (const bad of [null, undefined, {}, { items: null }, { items: {} }]) {
      let thrown: unknown;
      try {
        siteNewsListFromWire(bad);
      } catch (e) {
        thrown = e;
      }
      expect(isShape(thrown), JSON.stringify(bad)).toBe(true);
    }
  });

  it('글 하나라도 모양이 틀리면 던진다 — 몰래 빼거나 1970년 · 빈 값으로 채우지 않는다', () => {
    for (const bad of [
      item({ id: 1 }),
      item({ pinned: 'yes' }),
      item({ version: '3' }),
      item({ publishedAt: 'not-a-date' }),
      item({ publishedAt: undefined }),
      item({ title: { ko: '한국어만' } }), // 안 쓴 언어도 '' 로 와야 한다(계약)
      item({ body: null }),
    ])
      expect(() => siteNewsListFromWire({ items: [item(), bad] }), JSON.stringify(bad)).toThrow(PortError);
  });

  it('쓰기 칸 확인: 한국어 제목 꼭 · 언어마다 제목 60 · 본문 400 경계 · 본문만 있는 언어 안 됨 · 앞뒤 빈칸 뗌', () => {
    const d = (o: Partial<ReturnType<typeof emptyNewsDraft>>) => ({ ...emptyNewsDraft(), ...o });
    const full = (n: number) => ({ ko: 'k'.repeat(n), en: 'e'.repeat(n), ja: 'j'.repeat(n) });
    expect(checkNewsDraft(d({ title: t('  ') })).ok).toBe(false);
    expect(checkNewsDraft(d({ title: full(SITE_TITLE_MAX), body: full(SITE_BODY_MAX) })).ok).toBe(true);
    for (const l of SITE_LANGS) {
      const title = { ...full(1), [l]: 'x'.repeat(SITE_TITLE_MAX + 1) };
      expect(checkNewsDraft(d({ title })).ok, `${l} 제목`).toBe(false);
      const body = { ...t(''), [l]: 'x'.repeat(SITE_BODY_MAX + 1) };
      expect(checkNewsDraft(d({ title: full(1), body })).ok, `${l} 본문`).toBe(false);
    }
    expect(checkNewsDraft(d({ title: t('가'), body: t('', 'only body') })).ok).toBe(false);
    expect(checkNewsDraft(d({ pinned: true, title: t(' 가 ', ' A '), body: t(' 나 \n') }))).toEqual({
      ok: true,
      next: { pinned: true, title: t('가', 'A'), body: t('나') },
    });
  });

  it('고치기에서 바뀐 게 없으면 같은 글', () => {
    const n = siteNewsFromWire(item());
    expect(sameNews(newsToDraft(n), newsToDraft(n))).toBe(true);
    expect(sameNews(newsToDraft(n), { ...newsToDraft(n), pinned: true })).toBe(false);
    expect(sameNews(newsToDraft(n), { ...newsToDraft(n), body: t('고쳤어요', 'Fixed', '直した') })).toBe(
      false,
    );
  });
});

describe('홈페이지 내려받기 — 모양 · 저장 확인', () => {
  it('모양이 틀리면 던진다(files 세 칸 · rev · open)', () => {
    expect(
      siteDownloadFromWire({ open: true, version: '0.14.0', rev: 2, files: { ...NO_FILES, win: 'w' } }),
    ).toEqual({
      open: true,
      version: '0.14.0',
      files: { ...NO_FILES, win: 'w' },
      rev: 2,
    });
    for (const bad of [
      { open: true, version: null, files: NO_FILES },
      { open: 'yes', version: null, files: NO_FILES, rev: 1 },
      { open: false, version: null, files: {}, rev: 1 },
      { open: false, version: null, rev: 1 },
      { open: false, version: 14, files: NO_FILES, rev: 1 },
    ])
      expect(() => siteDownloadFromWire(bad), JSON.stringify(bad)).toThrow(PortError);
  });

  it('열려면 판 · 새로 여는 판은 정식 릴리스 목록 안 · 같은 값은 저장 안 함 · rev 를 실음', () => {
    const vs = ['0.14.0', '0.13.1'];
    expect(checkDownload(saved, { open: true, version: null }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: true, version: '0.99.0' }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: false, version: null }, vs).ok).toBe(false);
    expect(checkDownload(saved, { open: true, version: '0.14.0' }, vs)).toEqual({
      ok: true,
      next: { open: true, version: '0.14.0', rev: 7 },
    });
    expect(checkDownload(saved, { open: true, version: '0.14.0' }, null).ok).toBe(true); // 목록을 못 받았으면 서버가 다시 본다
  });

  it('열어 둔 판이 최근 목록 밖으로 밀려나도 닫을 수 있고 · 보기에 그 판이 남는다', () => {
    const old = { ...saved, open: true, version: '0.9.0' };
    const vs = ['0.14.0', '0.13.1', '0.13.0', '0.12.4', '0.12.3'];
    expect(checkDownload(old, { open: false, version: '0.9.0' }, vs)).toEqual({
      ok: true,
      next: { open: false, version: '0.9.0', rev: 7 },
    });
    expect(versionChoices(vs, '0.9.0')).toEqual([...vs, '0.9.0']);
    expect(versionChoices(vs, '0.14.0')).toEqual(vs);
    expect(versionChoices(null, '0.9.0')).toEqual(['0.9.0']);
    expect(versionChoices(null, null)).toEqual([]);
  });
});

describe('홈페이지 소식 · 내려받기 — 서버 길', () => {
  it('API 가 없는 환경이면 «주소 없음» 포트 실패 · 화면 글은 그 까닭', async () => {
    const e = await listSiteNews(null).catch((x: unknown) => x);
    expect(isPortError(e, 'unreachable')).toBe(true);
    expect(siteErrorMessage(e, '실패')).toBe(NO_API_TEXT);
    await expect(getSiteDownload(null)).rejects.toBeInstanceOf(PortError);
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

  it('id 는 주소에 넣을 때 감싼다 · 서버 한 건 답 모양이 틀리면 던진다', async () => {
    const { api, calls } = fakeApiOf({ 'PATCH /v2/admin/site/news/a%2Fb': () => ({ nope: true }) });
    const from = siteNewsFromWire(item({ id: 'a/b' }));
    const e = await updateSiteNews(api, from, newsToDraft(from)).catch((x: unknown) => x);
    expect(isShape(e)).toBe(true);
    expect(calls[0]?.path).toBe('/v2/admin/site/news/a%2Fb');
  });

  it('409 는 conflict 포트 실패로 — 화면이 덮지 않고 다시 받게', async () => {
    const { api } = fakeApiOf({
      'PUT /v2/admin/site/download': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '먼저 고침');
      },
    });
    const e = await putSiteDownload(api, { open: true, version: '0.14.0', rev: 7 }).catch((x: unknown) => x);
    expect(isSiteConflict(e)).toBe(true);
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
    expect(isShape(await getSiteDownload(bad.api).catch((x: unknown) => x))).toBe(true);
  });
});
