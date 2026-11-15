import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { orphanCodes, type RoomIndexEntry } from '../model/room';
import { useRoomPort } from './index';

const ROOM_INDEX_KEY = ['roomIndex'];
const ROOM_CODES_KEY = ['roomCodes'];
const ROOM_PROBES_KEY = ['roomProbes'];
const ROOM_STATS_KEY = ['roomStats'];
const LIVE_ROOMS_KEY = ['liveRooms'];
const SERVER_OFFSET_KEY = ['serverTimeOffset'];

export function useRoomIndex() {
  const port = useRoomPort();
  return useQuery({ queryKey: ROOM_INDEX_KEY, queryFn: () => port.getIndex() });
}

export function useRoomCodes() {
  const port = useRoomPort();
  return useQuery({ queryKey: ROOM_CODES_KEY, queryFn: () => port.getCodes() });
}

export function useLiveRooms() {
  const port = useRoomPort();
  // 방 서버가 아직 이 API 를 모르면(배포 전) 404 — 다시 해 봐도 같다.
  return useQuery({ queryKey: LIVE_ROOMS_KEY, queryFn: () => port.getLive(), retry: false });
}

/** rooms 의 방마다 인원 수 · 고아 방의 마지막 신호. roomIndex 와 방 코드를 받은 뒤에 돈다. */
export function useRoomProbes(
  index: Record<string, RoomIndexEntry> | undefined,
  codes: string[] | undefined,
) {
  const port = useRoomPort();
  const orphans = index && codes ? orphanCodes(index, codes) : [];
  return useQuery({
    queryKey: [...ROOM_PROBES_KEY, codes, orphans],
    queryFn: () => port.probeRooms(codes ?? [], new Set(orphans)),
    enabled: !!index && !!codes,
    // 새로고침 동안 인원 칸이 비지 않게 — 정리 직전에는 cleanGhostRooms 가 다시 살펴본다.
    placeholderData: keepPreviousData,
  });
}

export function useRoomStats() {
  const port = useRoomPort();
  return useQuery({ queryKey: ROOM_STATS_KEY, queryFn: () => port.getStats() });
}

/**
 * 받은 시점의 서버 기준 «지금» — 살았나 죽었나는 **받아 둔 값을 받은 그 시각**으로 판정한다.
 * 화면 시계를 흘려보내면 roomIndex 를 다시 받지 않는 동안(staleTime 무한) 모든 방의 lastSeen 이 낡아
 * 90초 뒤엔 살아 있는 방까지 전부 유령으로 보였다. 시계가 틀린 PC 를 위해 서버 시각 차는 더한다.
 */
export function useSnapshotNow(fetchedAt: number | undefined): number | null {
  const port = useRoomPort();
  const offset = useQuery({ queryKey: SERVER_OFFSET_KEY, queryFn: () => port.serverTimeOffset() });
  return offset.data === undefined || !fetchedAt ? null : fetchedAt + offset.data;
}

export function useRefreshRooms() {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [
      ROOM_INDEX_KEY,
      ROOM_CODES_KEY,
      ROOM_PROBES_KEY,
      ROOM_STATS_KEY,
      SERVER_OFFSET_KEY,
      LIVE_ROOMS_KEY,
    ]) {
      client.invalidateQueries({ queryKey });
    }
  };
}
