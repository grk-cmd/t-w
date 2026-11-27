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

/** 고른 방들을 닫는다 — 한 번에 닫을 수 있는 수(`closeMax`)를 넘으면 포트가 막는다. */
export function useCloseSelectedRooms() {
  const port = useRoomPort();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: (codes: string[]) => port.close(codes), onSettled: refresh });
}
