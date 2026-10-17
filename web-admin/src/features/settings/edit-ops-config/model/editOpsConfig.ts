import { useMutation } from '@tanstack/react-query';
import {
  API_CORS_MAX,
  API_CORS_ORIGIN_MAX,
  intGroupChanges,
  intGroupDetail,
  isCorsOrigin,
  logLevelChanges,
  logLevelDetail,
  parseIntField,
  saveCorsOrigins,
  saveIntGroup,
  saveLogLevels,
  useRefreshOpsConfig,
  type IntGroup,
  type IntValues,
  type LogLevel,
  type LogLevels,
  type LogTarget,
} from '@/entities/server/ops-config';
import { useDb, type AuditAction } from '@/shared/api';

type Check<T> = { ok: true; next: T } | { ok: false; error: string };

/** 정수 칸 묶음 입력 검사 — 손댄 칸만 본다. 빈 칸 = 지움(서버 기본값). */
export function checkIntGroup(
  group: IntGroup,
  saved: IntValues,
  drafts: Partial<Record<string, string>>,
): Check<Record<string, number | null>> {
  const next: Partial<Record<string, number | null>> = {};
  for (const f of group.fields) {
    const text = drafts[f.key];
    if (text === undefined) continue;
    const v = parseIntField(f, text);
    if (v === undefined)
      return { ok: false, error: `${f.label} — ${f.min}~${f.max} 사이 정수 (빈 칸 = 기본값)` };
    next[f.key] = v;
  }
  const updates = intGroupChanges(group, saved, next);
  if (!Object.keys(updates).length) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next: updates };
}

export function intGroupConfirmText(
  title: string,
  group: IntGroup,
  saved: IntValues,
  updates: Record<string, number | null>,
  apply: string,
): string {
  return `${title} — ${intGroupDetail(group, saved, updates)}\n${apply}.`;
}

/** 로그 수준 입력('' = 기본) 검사. */
export function checkLogLevels(
  saved: LogLevels,
  drafts: Partial<Record<LogTarget, LogLevel | ''>>,
): Check<Record<string, LogLevel | null>> {
  const next: Partial<Record<LogTarget, LogLevel | null>> = {};
  for (const [k, v] of Object.entries(drafts) as [LogTarget, LogLevel | ''][]) next[k] = v || null;
  const updates = logLevelChanges(saved, next);
  if (!Object.keys(updates).length) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next: updates };
}

export const logLevelConfirmText = (saved: LogLevels, updates: Record<string, LogLevel | null>) =>
  `서버 로그 수준 — ${logLevelDetail(saved, updates)}\nAPI 는 20초 안 · 방 서버는 다음 설정 읽기 뒤 줄부터 적용돼요.`;

/** 출처 목록 입력 — 줄 · 쉼표 · 공백으로 나눈다. 끝 / 는 떼고 같은 줄은 하나로. 규칙과 같은 식으로 검사한다. */
export function checkCorsInput(saved: string[], text: string): Check<string[]> {
  const items = text
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const next = [...new Set(items)];
  const bad = next.find((o): boolean => !isCorsOrigin(o));
  if (bad !== undefined)
    return {
      ok: false,
      error: `«${bad.slice(0, 60)}» — https://호스트 (소문자 · 와일드카드 · 포트 · 경로 없이 · ${API_CORS_ORIGIN_MAX}자까지)`,
    };
  if (next.length > API_CORS_MAX)
    return { ok: false, error: `${API_CORS_MAX}개까지 (지금 ${next.length}개)` };
  if (next.length === saved.length && next.every((o, i) => o === saved[i]))
    return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

export const corsConfirmText = (next: string[]) =>
  next.length
    ? `API CORS 허용 출처 ${next.length}개로 바꿔요(관리자 경로만 · 5초 안 적용):\n${next.join('\n')}\n\n⚠️ 지금 쓰는 웹 관리자 주소가 빠지면 API 관리자 화면이 막혀요.`
    : 'API CORS 허용 출처를 비워요 — 서버 env(CORS_ALLOWED_ORIGINS) 목록으로 돌아가요.';

export function useSaveIntGroup(group: IntGroup, action: AuditAction, target: string) {
  const db = useDb();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: ({ before, updates }: { before: IntValues; updates: Record<string, number | null> }) =>
      saveIntGroup(db, group, action, target, before, updates),
    onSuccess: refresh,
  });
}

export function useSaveLogLevels() {
  const db = useDb();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: ({ before, updates }: { before: LogLevels; updates: Record<string, LogLevel | null> }) =>
      saveLogLevels(db, before, updates),
    onSuccess: refresh,
  });
}

export function useSaveCorsOrigins() {
  const db = useDb();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: ({ before, next }: { before: string[]; next: string[] }) => saveCorsOrigins(db, before, next),
    onSuccess: refresh,
  });
}
