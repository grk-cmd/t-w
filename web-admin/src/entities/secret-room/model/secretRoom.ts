// DB 모양은 앱(firebase-init.js issueSecretRoom)과 같아야 한다 — 입장 게이트가 pub 의 owner · exp 를 본다.
export interface SecretRoomPub {
  owner: string;
  name?: string;
  ts: number;
  /** 이용 기간이 끝나는 시각(ms). 없으면 영구. */
  exp?: number;
}

export const SECRET_PREFIX = 'SCRT-';
export const OWNER_NAME_MAX = 20; // 규칙 secretRooms/$code/pub .validate
export const MONTHS_MAX = 120;
/** 이만큼 접속 기록이 없으면 버려진 계정일 수 있다. */
export const STALE_DAYS = 7;

const DAY_MS = 86_400_000;
// 방 코드와 같은 알파벳(헷갈리는 0 · O · 1 · I 제외). 32 는 2^32 를 나누므로 나머지 연산에 치우침이 없다.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomIndex(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function genSecretCode(pick: (n: number) => number = randomIndex): string {
  return SECRET_PREFIX + Array.from({ length: 4 }, () => CODE_CHARS[pick(CODE_CHARS.length)]).join('');
}

/**
 * 개월 더하기 — 30일 곱셈은 달마다 어긋난다. 달을 먼저 올리고 그 달에 없는 날이면 말일로 당긴다(1/31 + 1개월 = 2/28).
 * 끝나는 날은 23:59:59 까지 — 만료일 당일은 쓸 수 있어야 한다. 앱과 같은 계산.
 */
export function addMonths(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  const day = d.getDate();
  d.setDate(1); // 말일에서 setMonth 하면 다음 달로 넘치므로 1일로 내려놓고 올린다
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** YYYY-MM-DD — 후원자에게 불러 줄 값이라 로컬 시간대로(toISOString 은 UTC 라 하루 어긋난다). */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 이용 기간 — 빈칸은 영구(0). 숫자가 아니면 영구로 삼지 않고 막는다(«3개월» 이라고 적었는데 영구로 나가면 안 된다). */
export function parseMonths(input: string): { ok: true; months: number } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: true, months: 0 };
  if (!/^\d{1,3}$/.test(text))
    return { ok: false, error: '이용 기간은 숫자(개월)만 넣어 주세요 — 영구로 발급하려면 비워 두세요' };
  const months = Number(text);
  if (months < 1 || months > MONTHS_MAX)
    return { ok: false, error: `이용 기간은 1~${MONTHS_MAX}개월 사이로 넣어 주세요` };
  return { ok: true, months };
}

/** 원하는 코드 4자리 — 비우면 ''(자동 생성). 관리자가 고른 단어일 수 있어 헷갈리는 글자도 받는다. */
export function parseWantCode(input: string): { ok: true; want: string } | { ok: false; error: string } {
  const want = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (want && want.length !== 4) return { ok: false, error: '원하는 코드는 영문 · 숫자 4자리여야 해요' };
  return { ok: true, want };
}

export const hasConfusingChars = (want: string) => /[0O1I]/.test(want);

/** 유저 코드(u + base36, 13자 이상) — 계정 이전과 같은 판정. */
export const isUserId = (raw: string) => /^u[0-9a-z]{12,}$/.test(raw);

export type ExpiryMode = 'new' | 'extend' | 'perm-to-term';

/**
 * 만료 시각. 같은 사람에게 같은 코드로 다시 발급하면 연장이다 — 남은 기간에 이어붙인다.
 * 기존이 영구인데 개월 수를 넣으면 영구가 풀리고 지금부터 기간제가 된다. 만료됐거나 주인이 다르면 지금부터.
 */
export function planExpiry(
  prev: SecretRoomPub | null,
  uid: string,
  months: number,
  now: number,
): { expMs: number; mode: ExpiryMode } {
  const mine = !!prev?.owner && prev.owner === uid;
  const prevExp = mine && typeof prev.exp === 'number' && prev.exp > 0 ? prev.exp : 0;
  const extend = prevExp > now;
  const expMs = months ? addMonths(extend ? prevExp : now, months) : 0;
  if (extend) return { expMs, mode: 'extend' };
  if (mine && !prevExp && months) return { expMs, mode: 'perm-to-term' };
  return { expMs, mode: 'new' };
}

export function periodText(months: number, expMs: number, mode: ExpiryMode): string {
  const kept =
    mode === 'extend'
      ? ' · 남은 기간에 이어붙임'
      : mode === 'perm-to-term'
        ? ' · 기존 영구 해제 → 기간제'
        : '';
  return expMs ? `${months}개월 · ${formatDay(expMs)} 까지${kept}` : `영구${kept}`;
}

/** 이미 발급된 코드에 다시 발급할 때 무슨 일이 생기는지 — 확인 문구에 쓴다. */
export function overwriteWarning(
  code: string,
  taken: SecretRoomPub,
  uid: string,
  months: number,
  now: number,
): string {
  const oldExp = typeof taken.exp === 'number' && taken.exp > 0 ? taken.exp : 0;
  const current = oldExp
    ? ` (현재 기간 ${formatDay(oldExp)} 까지${now > oldExp ? ', 이미 만료' : ''})`
    : ' (현재 영구)';
  let effect: string;
  if (taken.owner !== uid) effect = '다른 사람에게 덮어씁니다(기존 기간은 사라집니다).';
  else if (oldExp) effect = now > oldExp ? '지금부터 다시 시작합니다.' : '남은 기간에 이어붙입니다.';
  else
    effect = months ? `⚠️ 영구가 풀리고 지금부터 ${months}개월 기간제로 바뀝니다.` : '영구를 그대로 둡니다.';
  return `${code} 는 이미 ${taken.owner} 에게 발급돼 있어요${current}. 그대로 발급하면 ${effect}`;
}

/**
 * 친구코드가 가리키는 계정이 버려졌을 수 있는지. 계정 이전 뒤 friendCodes 는 옛 uid 를 계속 가리켜,
 * 그대로 발급하면 쓰기는 다 성공하는데 후원자에게는 영영 안 간다.
 * 접속이 오래됐거나, 계정에 적힌 친구코드(거울)가 이 코드와 다르면 의심한다. 문제없으면 null.
 */
export function staleReason(
  lastSeen: number | null,
  mirror: string | null | undefined,
  code: string,
  now: number,
): string | null {
  const days = typeof lastSeen === 'number' && lastSeen > 0 ? Math.floor((now - lastSeen) / DAY_MS) : null;
  if (days === null) return '접속 기록이 없어요';
  if (days >= STALE_DAYS) return `${days}일째 접속이 없어요`;
  // undefined = 거울을 읽지 못함 — 그때는 경고하지 않는다.
  if (mirror !== undefined && (mirror ?? '').toUpperCase() !== code)
    return `이 계정에 적힌 친구코드는 ${mirror ?? '(없음)'} 이에요`;
  return null;
}
