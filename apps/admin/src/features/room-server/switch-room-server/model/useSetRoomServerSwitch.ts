import { useMutation } from '@tanstack/react-query';
import { setRegisterIndex, setRoomServerSwitch, useRefreshRoomServer } from '@/entities/room-server';
import { useDb } from '@/shared/api';

export function useSetRoomServerSwitch() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: (value: boolean) => setRoomServerSwitch(db, value),
    onSuccess: refresh,
  });
}

export function useSetRegisterIndex() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: (value: boolean) => setRegisterIndex(db, value),
    onSuccess: refresh,
  });
}

/** 장부 등록 스위치 확인 창 글 — 켜고 끌 때 전체 상한을 어떻게 세는지. */
export function registerIndexConfirmText(value: boolean): string {
  return value
    ? '방 서버 장부 등록 켜기 — 방 서버가 자기 방을 roomIndex 에 올려, 전체 방 상한을 Firebase 방 + 방 서버 방 합계로 봐요. 방 서버는 1분 안에 반영.'
    : '방 서버 장부 등록 끄기 — 방 서버 방이 roomIndex 에서 빠져, Firebase 방만 전체 상한과 견주고 방 서버 방은 서버 한 대 상한으로 따로 막아요. 방 서버는 1분 안에 반영.';
}
