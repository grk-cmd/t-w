import { useMutation } from '@tanstack/react-query';
import { useRefreshRooms, useRoomPort } from '@/entities/room';

export function useCloseRoom() {
  const port = useRoomPort();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: (code: string) => port.close([code]), onSettled: refresh });
}

export function useCloseAllRooms() {
  const port = useRoomPort();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: () => port.closeAll(), onSettled: refresh });
}

/** 고른 방들을 한 묶음으로 닫는다 — 하나라도 규칙에 막히면 아무 방도 지워지지 않는다. */
export function useCloseSelectedRooms() {
  const port = useRoomPort();
  const refresh = useRefreshRooms();
  return useMutation({
    mutationFn: async (codes: string[]) => {
      await port.close(codes);
      return codes.length;
    },
    onSettled: refresh,
  });
}
