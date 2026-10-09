import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import {
  CHANNEL_LABEL,
  CHANNELS,
  effectiveLimit,
  healthUrl,
  parseRoomServerConfig,
  ROOM_SERVER_PATH,
  type Channel,
  type RoomServerConfig,
} from '../model/roomServer';

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

/** on — 방 서버 전체(비상 정지 스위치). 앱은 다음 입장부터 따른다. */
export function setRoomServerSwitch(db: Db, value: boolean): Promise<void> {
  return db.commit(
    withAudit(db, { [`${ROOM_SERVER_PATH}/on`]: value }, 'roomServer.switch', 'on', onOff(value)),
  );
}

/**
 * 채널별 방 개수 상한 — 방 서버가 1분마다 읽어 새 방부터 적용한다(열린 방은 그대로).
 * 바뀐 채널만 쓴다. 기록에는 «워킹룸 250 → 400» 처럼(전에 칸이 없었으면 기본값으로 보여 준다).
 */
export function setRoomLimits(
  db: Db,
  cfg: RoomServerConfig | undefined,
  next: Record<Channel, number>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];
  for (const ch of CHANNELS) {
    if (cfg?.limits[ch] === next[ch]) continue;
    updates[`${ROOM_SERVER_PATH}/limits/${ch}`] = next[ch];
    changes.push(`${CHANNEL_LABEL[ch]} ${effectiveLimit(cfg, ch)} → ${next[ch]}`);
  }
  return db.commit(withAudit(db, updates, 'roomServer.limits', 'limits', changes.join(' · ')));
}

export interface ServerHealth {
  rooms: number;
  workingroom: number;
  togetherroom: number;
  conns: number;
  limits: Partial<Record<Channel, number>> | null;
  /** 돌고 있는 코드(`v0.1.0 (8998273)` · `dev (abc1234)`). 옛 방 서버는 칸이 없어 null. */
  version: string | null;
  uptimeS: number | null;
}

/** 방 서버 /health(공개 · 개수뿐) — 서버 하나에 한 번, 누를 때 다시. Firebase 를 읽지 않는다. */
export async function fetchServerHealth(
  wsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ServerHealth> {
  const url = healthUrl(wsUrl);
  if (!url) throw new Error('주소 형식이 틀림');
  const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`응답 ${res.status}`);
  const o = (await res.json()) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const str = (v: unknown) => (typeof v === 'string' && v && v.length <= 80 ? v : null);
  const lim = o.limits && typeof o.limits === 'object' ? (o.limits as Record<string, unknown>) : null;
  return {
    rooms: num(o.rooms),
    workingroom: num(o.workingroom),
    togetherroom: num(o.togetherroom),
    conns: num(o.conns),
    // 옛 방 서버는 limits 칸이 없다 — 그때는 null(화면은 설정값만 보여 준다).
    limits: lim
      ? Object.fromEntries(
          CHANNELS.filter((c) => typeof lim[c] === 'number').map((c) => [c, lim[c] as number]),
        )
      : null,
    version: str(o.version),
    uptimeS: typeof o.uptimeS === 'number' && Number.isFinite(o.uptimeS) ? o.uptimeS : null,
  };
}

export function useServerHealth(wsUrl: string) {
  return useQuery({
    queryKey: ['roomServerHealth', wsUrl],
    queryFn: () => fetchServerHealth(wsUrl),
    retry: false,
    staleTime: 30_000,
  });
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
