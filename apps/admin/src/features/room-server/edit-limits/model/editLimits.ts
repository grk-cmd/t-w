import { useMutation } from '@tanstack/react-query';
import {
  CHANNEL_LABEL,
  CHANNELS,
  effectiveLimit,
  parseLimitInput,
  ROOM_LIMIT_MAX,
  ROOM_LIMIT_MIN,
  setRoomLimits,
  useRefreshRoomServer,
  type Channel,
  type RoomServerConfig,
} from '@/entities/room-server';
import { useDb } from '@/shared/api';

export type LimitInputs = Record<Channel, string>;

/** 입력 칸 → 저장할 값 · 틀린 이유 · 바뀐 채널이 없으면 «같음». */
export function checkLimits(
  cfg: RoomServerConfig | undefined,
  inputs: LimitInputs,
): { ok: true; next: Record<Channel, number> } | { ok: false; error: string } {
  const next = {} as Record<Channel, number>;
  for (const ch of CHANNELS) {
    const n = parseLimitInput(inputs[ch]);
    if (n === null)
      return {
        ok: false,
        error: `${CHANNEL_LABEL[ch]} — ${ROOM_LIMIT_MIN}~${ROOM_LIMIT_MAX} 사이 정수`,
      };
    next[ch] = n;
  }
  if (CHANNELS.every((ch) => cfg?.limits[ch] === next[ch])) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

/** 확인 창 글 — 모든 채널을 «지금 → 새 값» 으로 보여 준다(칸이 없으면 지금 = 기본값). */
export function limitsConfirmText(cfg: RoomServerConfig | undefined, next: Record<Channel, number>): string {
  const parts = CHANNELS.map((ch) => `${CHANNEL_LABEL[ch]} ${effectiveLimit(cfg, ch)} → ${next[ch]}`);
  return `방 개수 상한을 ${parts.join(' · ')} 으로 바꿀까요? 이미 열린 방은 그대로이고 새 방부터 적용돼요.`;
}

export function useSetRoomLimits() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ cfg, next }: { cfg: RoomServerConfig | undefined; next: Record<Channel, number> }) =>
      setRoomLimits(db, cfg, next),
    onSuccess: refresh,
  });
}
