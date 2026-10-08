import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { parseRoomServerConfig, ROOM_SERVER_PATH, type RoomServerConfig } from '../model/roomServer';

const KEY = ['roomServer'];

// 관리자는 config 를 통째로 읽을 수 있다(규칙) — 노드 하나가 작아서 한 번에.
export async function getRoomServerConfig(db: Db): Promise<RoomServerConfig> {
  return parseRoomServerConfig(await db.get<unknown>(ROOM_SERVER_PATH));
}

export function useRoomServerConfig() {
  const db = useDb();
  return useQuery({ queryKey: KEY, queryFn: () => getRoomServerConfig(db) });
}

export function useRefreshRoomServer() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

const onOff = (v: boolean) => (v ? '켜기' : '끄기');

/** on(전체) · follow(방 따라가기). 앱은 다음 입장부터 따른다. */
export function setRoomServerSwitch(db: Db, key: 'on' | 'follow', value: boolean): Promise<void> {
  return db.commit(
    withAudit(db, { [`${ROOM_SERVER_PATH}/${key}`]: value }, 'roomServer.switch', key, onOff(value)),
  );
}

export function saveServer(db: Db, name: string, url: string, before: string | null): Promise<void> {
  const u = url.trim();
  return db.commit(
    withAudit(
      db,
      { [`${ROOM_SERVER_PATH}/servers/${name}`]: u },
      'roomServer.server',
      name,
      before ? `${before} → ${u}` : u,
    ),
  );
}

export function removeServer(db: Db, name: string): Promise<void> {
  return db.commit(
    withAudit(db, { [`${ROOM_SERVER_PATH}/servers/${name}`]: null }, 'roomServer.serverDelete', name),
  );
}

/** 시범 이용자 — 이 사람이 만드는 방은 server 에 열린다. */
export function setAllow(db: Db, userCode: string, server: string, before: string | null): Promise<void> {
  return db.commit(
    withAudit(
      db,
      { [`${ROOM_SERVER_PATH}/allow/${userCode}`]: server },
      'roomServer.allow',
      userCode,
      before ? `${before} → ${server}` : server,
    ),
  );
}

export function removeAllow(db: Db, userCode: string, before: string): Promise<void> {
  return db.commit(
    withAudit(
      db,
      { [`${ROOM_SERVER_PATH}/allow/${userCode}`]: null },
      'roomServer.allowDelete',
      userCode,
      before,
    ),
  );
}
