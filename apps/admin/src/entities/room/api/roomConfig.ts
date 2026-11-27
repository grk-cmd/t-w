import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoomPort } from './index';

const ROOM_CONFIG_KEY = ['roomConfig'];
const ROOM_LIMITS_KEY = [...ROOM_CONFIG_KEY, 'limits'];
const ROOM_MAX_PEOPLE_KEY = [...ROOM_CONFIG_KEY, 'maxPeople'];

export function useRoomLimits() {
  const port = useRoomPort();
  return useQuery({ queryKey: ROOM_LIMITS_KEY, queryFn: () => port.getLimits() });
}

export function useRoomMaxPeople() {
  const port = useRoomPort();
  return useQuery({ queryKey: ROOM_MAX_PEOPLE_KEY, queryFn: () => port.getMaxPeople() });
}

export function useRefreshRoomConfig() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ROOM_CONFIG_KEY });
}
