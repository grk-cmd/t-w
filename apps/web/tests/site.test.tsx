import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  NEWS_SHOWN,
  RELEASE_DOWNLOAD_PREFIX,
  SITE_PATH,
  downloadReady,
  fetchSite,
  newsFor,
  parseSite,
  type Site,
  type SiteState,
} from '@/entities/site';
import { DownloadView } from '@/pages/home/ui/DownloadPanel';
import { NewsView } from '@/pages/home/ui/NewsSlot';
import { I18nProvider, messagesFor, type Lang } from '@/shared/i18n';

const WIN = `${RELEASE_DOWNLOAD_PREFIX}v0.14.0/Together-Working-Setup-0.14.0.exe`;
const ARM = `${RELEASE_DOWNLOAD_PREFIX}v0.14.0/Together-Working-0.14.0-arm64.dmg`;
const item = (o: Record<string, unknown> = {}) => ({
  id: 'n1',
  pinned: false,
  publishedAt: '2026-11-20T03:00:00Z',
  title: { ko: '업데이트', en: 'Update', ja: 'アップデート' },
  body: { ko: '고쳤어요', en: 'Fixed', ja: '直しました' },
  ...o,
});
const raw = (o: Record<string, unknown> = {}) => ({
  news: [item()],
  download: { open: false, version: null, files: {} },
  ...o,
});

describe('parseSite — 서버 data 모양 확인', () => {
  it('맞는 모양은 그대로 · 날짜는 ms 로', () => {
    const s = parseSite(raw());
    expect(s?.news).toEqual([{ ...item(), publishedAt: Date.parse('2026-11-20T03:00:00Z') }]);
    expect(s?.download).toEqual({
      open: false,
      version: null,
      files: { win: null, macArm64: null, macX64: null },
    });
  });

  it('다운로드 칸 모양이 틀리면 전체를 모름(null) — 모르는 상태로 단추를 열지 않게', () => {
    expect(parseSite(raw({ download: { open: 'yes' } }))).toBeNull();
    expect(parseSite(raw({ download: undefined }))).toBeNull();
    expect(parseSite({ download: { open: true } })).toBeNull(); // news 가 배열이 아님
    expect(parseSite(null)).toBeNull();
  });

  it('소식은 모양이 틀린 글만 버린다 · 비운 언어는 빈 글 · 앞뒤 빈칸은 뗀다', () => {
    const s = parseSite(
      raw({
        news: [
          item({ id: '' }),
          item({ id: 'n2', publishedAt: 'not-a-date' }),
          item({ id: 'n3', title: { ko: 3 } }),
          item({ id: 'n4', title: { ko: '  한국어만  ' }, body: {} }),
        ],
      }),
    );
    expect(s?.news.map((n) => n.id)).toEqual(['n4']);
    expect(s?.news[0]?.title).toEqual({ ko: '한국어만', en: '', ja: '' });
  });

  it('설치 파일 주소는 우리 GitHub 릴리스만 — 다른 주소 · 다른 저장소 · http 는 버린다', () => {
    const s = parseSite(
      raw({
        download: {
          open: true,
          version: '0.14.0',
          files: {
            win: WIN,
            macArm64: 'https://evil.example/Together.dmg',
            macX64: 'https://github.com/someone/t-w/releases/download/v0.14.0/x.dmg',
          },
        },
      }),
    );
    expect(s?.download.files).toEqual({ win: WIN, macArm64: null, macX64: null });
    expect(
      parseSite(raw({ download: { open: true, files: { win: WIN.replace('https:', 'http:') } } }))?.download
        .files.win,
    ).toBeNull();
  });
});

describe('newsFor · downloadReady', () => {
  const at = (iso: string) => Date.parse(iso);
  const n = (id: string, pinned: boolean, iso: string, ja = 'x') => ({
    id,
    pinned,
    publishedAt: at(iso),
    title: { ko: 'k', en: 'e', ja },
    body: { ko: '', en: '', ja: '' },
  });

  it('고정 먼저 · 그다음 최신 순 · 그 언어 제목이 없는 글은 뺀다', () => {
    const list = [
      n('old', false, '2026-01-01'),
      n('pin', true, '2025-01-01'),
      n('new', false, '2026-06-01'),
      n('noJa', false, '2026-07-01', ''),
    ];
    expect(newsFor(list, 'ko').map((x) => x.id)).toEqual(['pin', 'noJa', 'new', 'old']);
    expect(newsFor(list, 'ja').map((x) => x.id)).toEqual(['pin', 'new', 'old']);
    expect(list.map((x) => x.id)).toEqual(['old', 'pin', 'new', 'noJa']); // 받은 배열은 그대로
  });

  it('📌 고정은 모두 · 고정 아닌 글은 그 언어에서 최신 NEWS_SHOWN 개 — 다른 언어로만 쓴 글이 자리를 먹지 않는다', () => {
    const koOnly = Array.from({ length: 8 }, (_, i) => n(`ko${i}`, false, `2026-10-${10 + i}`, ''));
    const both = Array.from({ length: NEWS_SHOWN + 2 }, (_, i) => n(`b${i}`, false, `2026-09-${10 + i}`));
    const pins = [n('p1', true, '2025-01-01'), n('p2', true, '2025-02-01')];
    const list = [...koOnly, ...both, ...pins];
    const ja = newsFor(list, 'ja').map((x) => x.id);
    expect(ja.slice(0, 2)).toEqual(['p2', 'p1']);
    expect(ja.slice(2)).toEqual(
      both
        .map((x) => x.id)
        .reverse()
        .slice(0, NEWS_SHOWN),
    );
    const ko = newsFor(list, 'ko');
    expect(ko).toHaveLength(2 + NEWS_SHOWN);
    expect(ko.slice(2).every((x) => x.id.startsWith('ko'))).toBe(true);
  });

  it('열려 있고 파일이 하나라도 있어야 단추를 연다', () => {
    const files = { win: null, macArm64: null, macX64: null };
    expect(downloadReady({ open: true, version: '0.14.0', files })).toBe(false);
    expect(downloadReady({ open: false, version: '0.14.0', files: { ...files, win: WIN } })).toBe(false);
    expect(downloadReady({ open: true, version: '0.14.0', files: { ...files, win: WIN } })).toBe(true);
  });
});

describe('fetchSite — 실패와 «없음» 을 가른다', () => {
  const res = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  it('공개 길을 토큰 없이 부른다', async () => {
    const f = vi.fn(async () => res(200, { success: true, data: raw() }));
    const r = await fetchSite(f as unknown as typeof fetch, 'https://api.test');
    expect(r.t).toBe('ok');
    expect(f).toHaveBeenCalledWith(
      `https://api.test${SITE_PATH}`,
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('404(서버에 아직 길이 없음) · 봉투 아님 · 모양 틀림 · 연결 안 됨 · 시간 초과는 모두 실패', async () => {
    const cases: [typeof fetch, string][] = [
      [(async () => res(404, null)) as unknown as typeof fetch, 'HTTP 404'],
      [(async () => res(200, { data: raw() })) as unknown as typeof fetch, '응답 모양이 다름'],
      [
        (async () => res(200, { success: true, data: { news: [] } })) as unknown as typeof fetch,
        '응답 모양이 다름',
      ],
      [(async () => Promise.reject(new TypeError('net'))) as unknown as typeof fetch, '연결 안 됨'],
    ];
    for (const [f, why] of cases)
      expect(await fetchSite(f, 'https://api.test')).toEqual({ t: 'failed', why });
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_r, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('abort'))),
      )) as unknown as typeof fetch;
    expect(await fetchSite(hang, 'https://api.test', 5)).toEqual({ t: 'failed', why: '시간 초과' });
  });
});

describe('소식 창 · 내려받기 — 상태마다 다르게 그린다', () => {
  const site = (o: Partial<Site> = {}): Site => ({ ...parseSite(raw())!, ...o });
  const draw = (
    el: (p: { state: SiteState; retry: () => void }) => React.ReactNode,
    state: SiteState,
    lang: Lang = 'ko',
  ) => renderToString(<I18nProvider lang={lang}>{el({ state, retry: () => {} })}</I18nProvider>);
  const news = (s: SiteState, lang?: Lang) => draw((p) => <NewsView {...p} />, s, lang);
  const dl = (s: SiteState) => draw((p) => <DownloadView {...p} />, s);
  const m = messagesFor('ko');

  it('소식: 받는 중 · 못 받음(다시 시도) · 글 없음 · 글 목록', () => {
    expect(news({ s: 'loading' })).toContain(m.newsLoading);
    const failed = news({ s: 'failed' });
    expect(failed).toContain(m.newsFailed);
    expect(failed).toContain(`>${m.retry}</button>`);
    expect(failed).not.toContain(m.newsEmpty);
    expect(news({ s: 'ready', site: site({ news: [] }) })).toContain(m.newsEmpty);
    const ready = news({ s: 'ready', site: site() });
    expect(ready).toContain('<b>업데이트</b>');
    expect(ready).toContain('고쳤어요');
    expect(ready).not.toContain(m.newsEmpty);
  });

  it('소식: 그 언어 글만 · 그 언어로 안 쓴 글뿐이면 «글 없음»', () => {
    expect(news({ s: 'ready', site: site() }, 'ja')).toContain('<b>アップデート</b>');
    const koOnly = site({ news: [{ ...site().news[0]!, title: { ko: '한국어만', en: '', ja: '' } }] });
    expect(news({ s: 'ready', site: koOnly }, 'en')).toContain(messagesFor('en').newsEmpty);
  });

  it('소식 글은 HTML 로 읽지 않는다', () => {
    const evil = site({
      news: [{ ...site().news[0]!, title: { ko: '<img src=x onerror=alert(1)>', en: '', ja: '' } }],
    });
    const html = news({ s: 'ready', site: evil });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('내려받기: 받는 중 · 못 받음 · 닫힘이면 단추가 눌리지 않고 주소가 없다', () => {
    const opened = site({
      download: { open: true, version: '0.14.0', files: { win: WIN, macArm64: ARM, macX64: null } },
    });
    for (const [s, hint] of [
      [{ s: 'loading' }, m.dlChecking],
      [{ s: 'failed' }, m.dlFailed],
      [{ s: 'ready', site: site() }, m.dlSoon],
      [{ s: 'ready', site: { ...opened, download: { ...opened.download, open: false } } }, m.dlSoon],
    ] as [SiteState, string][]) {
      const html = dl(s);
      expect(html).toContain(hint);
      expect(html).toMatch(/<button[^>]*disabled/);
      expect(html).not.toContain('releases/download/');
    }
  });

  it('내려받기: 열렸으면 있는 파일만 링크 · 판 번호', () => {
    const html = dl({
      s: 'ready',
      site: site({
        download: { open: true, version: '0.14.0', files: { win: WIN, macArm64: ARM, macX64: null } },
      }),
    });
    expect(html).toContain(`href="${WIN}"`);
    expect(html).toContain(`href="${ARM}"`);
    expect(html).toContain(m.dlMacArm);
    expect(html).not.toContain(m.dlMacIntel);
    expect(html).toContain(m.dlVersion('0.14.0'));
    expect(html).not.toContain('disabled');
  });
});
