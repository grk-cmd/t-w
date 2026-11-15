import { useMutation } from '@tanstack/react-query';
import {
  SERVER_LIMIT_CHANNELS,
  SERVER_LIMIT_MAX,
  SERVER_LIMIT_MIN,
  useOpsConfigPort,
  useRefreshOpsConfig,
  type ServerLimits,
} from '@/entities/server/ops-config';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export type ServerLimitInputs = Record<keyof ServerLimits, string>;
type Check<T> = { ok: true; next: T } | { ok: false; error: string };

export const SERVER_LIMIT_LABEL: Record<keyof ServerLimits, string> = {
  workingroom: '워킹룸',
  togetherroom: '투게더룸',
};

/** 입력 → 채널별 상한. 숫자만 · 범위 안 · 지금 값과 달라야 한다. */
export function checkServerLimits(saved: ServerLimits, inputs: ServerLimitInputs): Check<ServerLimits> {
  const next = {} as ServerLimits;
  for (const ch of SERVER_LIMIT_CHANNELS) {
    const text = inputs[ch].trim();
    const n = Number(text);
    if (!/^[0-9]+$/.test(text) || n < SERVER_LIMIT_MIN || n > SERVER_LIMIT_MAX) {
      return {
        ok: false,
        error: `${SERVER_LIMIT_LABEL[ch]} — ${SERVER_LIMIT_MIN}~${SERVER_LIMIT_MAX} 사이 정수`,
      };
    }
    next[ch] = n;
  }
  if (SERVER_LIMIT_CHANNELS.every((ch) => next[ch] === saved[ch]))
    return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

export function serverLimitsConfirmText(saved: ServerLimits, next: ServerLimits): string {
  const changes = SERVER_LIMIT_CHANNELS.filter((ch) => next[ch] !== saved[ch]).map(
    (ch) => `${SERVER_LIMIT_LABEL[ch]} ${saved[ch]} → ${next[ch]}`,
  );
  return `방 서버 한 대의 방 상한 ${changes.join(' · ')} — 이미 열린 방은 그대로이고 새 방부터 적용돼요.`;
}

export function useSaveServerLimits() {
  const { serverLimits } = useOpsConfigPort();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: ({ from, next }: { from: Versioned<ServerLimits>; next: ServerLimits }) =>
      (serverLimits as NonNullable<typeof serverLimits>).save(from, next),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
