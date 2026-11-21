// config/chatKeepDays = { default?, togetherroom?, workingroom?, secret?, … } — 서버 대화 보관 일수(방 종류별).
// 함수 chatExpire(functions/chat-expire.js)가 매시간 읽는다. 칸이 없으면 default, default 도 없으면 3일.
// 범위는 규칙 .validate · 함수 KEEP_DAYS_MIN/MAX 와 같다. 종류 이름은 규칙이 영소문자만 보므로 새 방 종류는 아래 목록에 한 줄만 더한다.
export const CHAT_KEEP_PATH = 'config/chatKeepDays';
export const CHAT_KEEP_DEFAULT = 3;
export const CHAT_KEEP_MIN = 1;
export const CHAT_KEEP_MAX = 30;
// 처리방침 5항이 적은 서버 보관 기간 — 이보다 길게 두려면 처리방침을 먼저 고친다.
export const CHAT_KEEP_PRIVACY_DAYS = 3;

export const CHAT_KEEP_KINDS = [
  { kind: 'default', label: '기본(아래 칸이 비면)' },
  { kind: 'togetherroom', label: '투게더룸' },
  { kind: 'workingroom', label: '워킹룸' },
  { kind: 'secret', label: '시크릿룸' },
] as const;
export type ChatKeepKind = (typeof CHAT_KEEP_KINDS)[number]['kind'];
export type ChatKeep = Partial<Record<string, number>>;

const okDays = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= CHAT_KEEP_MIN && v <= CHAT_KEEP_MAX;

/** 서버 값 → 종류별 일수. 범위 밖 · 숫자 아닌 칸은 없는 것으로(함수도 그렇게 본다). */
export function parseChatKeep(v: unknown): ChatKeep {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v).filter(([, d]) => okDays(d)));
}

/** 입력 → 일수. 빈 칸은 null(칸 지움 = 기본값 따름), 잘못된 값은 undefined. */
export function parseKeepInput(input: string): number | null | undefined {
  const t = input.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return okDays(n) ? n : undefined;
}

/** 그 종류에 실제로 적용되는 일수 — 함수 keepPolicy 와 같은 순서(종류 칸 → default → 3). */
export function effectiveKeep(cfg: ChatKeep, kind: ChatKeepKind): number {
  return (kind !== 'default' ? cfg[kind] : undefined) ?? cfg.default ?? CHAT_KEEP_DEFAULT;
}

/** 바뀐 칸만 쓰기 묶음으로 — 값이 null 이면 칸을 지운다. */
export function chatKeepChanges(before: ChatKeep, next: Partial<Record<ChatKeepKind, number | null>>) {
  const updates: Record<string, number | null> = {};
  for (const { kind } of CHAT_KEEP_KINDS) {
    if (!(kind in next)) continue;
    const v = next[kind] ?? null;
    if ((before[kind] ?? null) !== v) updates[`${CHAT_KEEP_PATH}/${kind}`] = v;
  }
  return updates;
}

/** 작업 기록 · 확인 창 글 — «워킹룸 3 → 1일 · 시크릿룸 기본 → 1일». */
export function chatKeepDetail(before: ChatKeep, updates: Record<string, number | null>): string {
  return CHAT_KEEP_KINDS.filter(({ kind }) => `${CHAT_KEEP_PATH}/${kind}` in updates)
    .map(({ kind, label }) => {
      const b = before[kind];
      const a = updates[`${CHAT_KEEP_PATH}/${kind}`];
      return `${label.replace(/\(.*\)/, '')} ${b ?? '기본'} → ${a ?? '기본'}${a ? '일' : ''}`;
    })
    .join(' · ');
}
