import type { Lang } from '@/shared/i18n';

/** 설치 파일은 우리 GitHub 릴리스에 올라간 것만 — 서버가 준 주소라도 이 앞머리가 아니면 버린다(누가 서버 값을 바꿔도 남의 파일로 보내지 않게) */
export const RELEASE_DOWNLOAD_PREFIX = 'https://github.com/grk-cmd/t-w/releases/download/';

/** 언어마다 따로 쓴 글 — 빈 글('')은 그 언어로 안 쓴 것 */
export type LangText = Record<Lang, string>;

/** 홈페이지 소식 하나 — 서버 공개 GET /v2/site 의 news[] */
export interface SiteNews {
  id: string;
  pinned: boolean;
  /** ms — 서버는 ISO 문자열로 준다 */
  publishedAt: number;
  title: LangText;
  body: LangText;
}

export interface SiteDownload {
  /** 관리자가 연 때만 true — 닫혀 있으면 단추는 «준비 중» */
  open: boolean;
  /** 내보이는 판(예: 0.14.0) — 닫혀 있으면 null 일 수 있다 */
  version: string | null;
  /** 파일이 없거나 주소가 우리 릴리스가 아니면 null — 그 단추는 안 보인다 */
  files: { win: string | null; macArm64: string | null; macX64: string | null };
}

export interface Site {
  news: SiteNews[];
  download: SiteDownload;
}

const LANG_KEYS = ['ko', 'en', 'ja'] as const satisfies readonly Lang[];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 응답 읽기는 엄격하게 — 약속과 다른 칸이 하나라도 있으면 전체를 모름(null)으로. 틀린 글을 몰래 빼거나 빈 값 · 1970년으로 채우지 않는다
    (못 받음이 «글 없음» · «닫힘» 으로 보이지 않게 — 웹 관리자 쪽 wire 읽기와 같은 계약) */
function langText(v: unknown): LangText | null {
  if (!isRecord(v)) return null;
  const out = { ko: '', en: '', ja: '' };
  for (const k of LANG_KEYS) {
    const s = v[k];
    if (typeof s !== 'string') return null; // 안 쓴 언어도 '' 로 온다(계약)
    out[k] = s.trim();
  }
  return out;
}

function news(v: unknown): SiteNews | null {
  if (!isRecord(v)) return null;
  const { id, pinned, publishedAt } = v;
  const title = langText(v.title);
  const body = langText(v.body);
  const ms = typeof publishedAt === 'string' ? Date.parse(publishedAt) : NaN;
  if (typeof id !== 'string' || !id || typeof pinned !== 'boolean' || !Number.isFinite(ms) || !title || !body)
    return null;
  return { id, pinned, publishedAt: ms, title, body };
}

/** 판 태그 · 파일 이름 두 조각만 — `..` · `%2e` · 역슬래시 · 더 깊은 경로를 끼워 다른 저장소로 비켜 가지 못하게 */
const RELEASE_FILE = /^v\d[0-9A-Za-z.-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:exe|dmg)$/;

/** 파일 칸 — null(그 파일 없음) 또는 우리 릴리스 주소. 그 밖(다른 주소 · 다른 모양)은 약속 위반이라 undefined */
function fileUrl(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'string' || !v.startsWith(RELEASE_DOWNLOAD_PREFIX)) return undefined;
  return RELEASE_FILE.test(v.slice(RELEASE_DOWNLOAD_PREFIX.length)) ? v : undefined;
}

function download(v: unknown): SiteDownload | null {
  if (!isRecord(v) || typeof v.open !== 'boolean' || !isRecord(v.files)) return null;
  if (v.version !== null && (typeof v.version !== 'string' || !v.version)) return null;
  const win = fileUrl(v.files.win);
  const macArm64 = fileUrl(v.files.macArm64);
  const macX64 = fileUrl(v.files.macX64);
  if (win === undefined || macArm64 === undefined || macX64 === undefined) return null;
  return { open: v.open, version: v.version, files: { win, macArm64, macX64 } };
}

/** 서버 data → Site. 어느 칸이든 약속과 다르면 null — 화면은 «불러오지 못했어요»(모르는 채로 단추를 열거나 글을 빼지 않게) */
export function parseSite(raw: unknown): Site | null {
  if (!isRecord(raw) || !Array.isArray(raw.news)) return null;
  const dl = download(raw.download);
  if (!dl) return null;
  const list = raw.news.map(news);
  if (list.some((n) => n === null)) return null;
  return { news: list as SiteNews[], download: dl };
}

/** 한 언어 페이지에 보일 고정 아닌 글 수(📌 고정은 모두) */
export const NEWS_SHOWN = 5;

/** 이 언어 페이지에 보일 소식 — 그 언어 제목이 있는 글만 · 📌 고정 전부 먼저 · 그다음 최신 NEWS_SHOWN 개.
    언어마다 센다 — 한국어로만 쓴 글이 이어져도 다른 언어 페이지의 글이 밀려나지 않게(서버는 넉넉히 준다) */
export function newsFor(list: readonly SiteNews[], lang: Lang): SiteNews[] {
  const mine = list.filter((n) => n.title[lang] !== '');
  const latest = (a: SiteNews, b: SiteNews) => b.publishedAt - a.publishedAt;
  const pinned = mine.filter((n) => n.pinned).sort(latest);
  const rest = mine.filter((n) => !n.pinned).sort(latest);
  return [...pinned, ...rest.slice(0, NEWS_SHOWN)];
}

/** 단추를 보일지 — 열려 있고 파일이 하나라도 있어야 */
export function downloadReady(d: SiteDownload): boolean {
  return d.open && Object.values(d.files).some((u) => u !== null);
}
