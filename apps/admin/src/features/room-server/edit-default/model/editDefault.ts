import { useMutation } from '@tanstack/react-query';
import {
  DEFAULT_PERCENT_MAX,
  DEFAULT_PERCENT_MIN,
  isDefaultPercent,
  setDefaultRouting,
  useRefreshRoomServer,
  type DefaultRouting,
  type RoomServerConfig,
} from '@/entities/room-server';
import { useDb } from '@/shared/api';

/** 드롭다운의 «없음» — default 칸이 없다는 뜻(허용 목록에 없는 사람은 모두 Firebase). */
export const NO_DEFAULT = '';
/** 비율 칸 옆 빠른 버튼 — 10 → 50 → 100 으로 넓혀 간다. */
export const PERCENT_STEPS = [0, 10, 50, 100] as const;

export interface DefaultOption {
  value: string;
  label: string;
}

export interface DefaultInputs {
  server: string;
  percent: string;
}

/** 기본 서버 드롭다운 — «없음» + 등록된 서버. 지금 값이 표에 없으면 그 이름도 남긴다(앱은 Firebase 로 보낸다). */
export function defaultOptions(servers: readonly string[], current: string | null): DefaultOption[] {
  const list = [...servers].sort();
  const out: DefaultOption[] = [{ value: NO_DEFAULT, label: '없음 (모두 Firebase)' }];
  out.push(...list.map((s) => ({ value: s, label: s })));
  if (current && !list.includes(current))
    out.push({ value: current, label: `${current} (표에 없음 — Firebase)` });
  return out;
}

/**
 * 비율 칸 · 숫자 버튼이 잠긴 이유 — 잠기지 않았으면 null.
 * 말없이 회색이면 «눌러도 안 된다» 로만 보여서, 무엇을 먼저 해야 하는지 적는다.
 */
export function percentLockReason(server: string, options: readonly DefaultOption[]): string | null {
  if (server !== NO_DEFAULT) return null;
  if (options.every((o) => o.value === NO_DEFAULT))
    return '등록된 방 서버가 없어요 — 위 «서버 목록» 에서 먼저 추가';
  return '기본 서버를 먼저 고르면 비율을 정할 수 있어요';
}

export const toDefaultInputs = (cfg: RoomServerConfig | undefined): DefaultInputs => ({
  server: cfg?.default ?? NO_DEFAULT,
  percent: String(cfg?.defaultPercent ?? 0),
});

/** 입력 칸 글자 → 비율. 정수 0~100 이 아니면 null. */
export function parsePercentInput(text: string): number | null {
  const t = text.trim();
  if (!/^[0-9]+$/.test(t)) return null;
  const n = Number(t);
  return isDefaultPercent(n) ? n : null;
}

/** 입력 → 저장할 값 · 틀린 이유. 서버가 «없음» 이면 비율은 보지 않고 두 칸을 지운다. */
export function checkDefault(
  cfg: RoomServerConfig | undefined,
  inputs: DefaultInputs,
): { ok: true; next: DefaultRouting } | { ok: false; error: string } {
  let next: DefaultRouting;
  if (inputs.server === NO_DEFAULT) next = { server: null, percent: 0 };
  else {
    const p = parsePercentInput(inputs.percent);
    if (p === null)
      return { ok: false, error: `비율 — ${DEFAULT_PERCENT_MIN}~${DEFAULT_PERCENT_MAX} 사이 정수` };
    next = { server: inputs.server, percent: p };
  }
  const cur = cfg?.default ?? null;
  const same =
    next.server === null ? cur === null : cur === next.server && cfg?.defaultPercent === next.percent;
  if (same) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

const label = (server: string | null, percent: number) => (server ? `${server} ${percent}%` : '없음');

/** 확인 창 글 — «지금 → 새 값» · 스위치가 꺼져 있으면 그 사실도. */
export function defaultConfirmText(cfg: RoomServerConfig | undefined, next: DefaultRouting): string {
  const now = label(cfg?.default ?? null, cfg?.defaultPercent ?? 0);
  const head = `기본 서버 바꾸기 — ${now} → ${label(next.server, next.percent)}.`;
  const body = next.server
    ? ` 허용 목록에 없는 사람 중 약 ${next.percent}% 가 다음에 만드는 방부터 ${next.server} 에 열려요.`
    : ' 허용 목록에 없는 사람은 다음에 만드는 방부터 모두 Firebase 에 열려요.';
  const off = cfg && !cfg.on ? ' (지금 스위치가 꺼져 있어 켜기 전까지는 모두 Firebase)' : '';
  return head + body + off;
}

export function useSetDefaultRouting() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ cfg, next }: { cfg: RoomServerConfig | undefined; next: DefaultRouting }) =>
      setDefaultRouting(db, cfg, next),
    onSuccess: refresh,
  });
}
