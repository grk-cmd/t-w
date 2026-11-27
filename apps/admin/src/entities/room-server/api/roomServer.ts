import { useQuery } from '@tanstack/react-query';
import { CHANNELS, healthUrl, type Channel } from '../model/roomServer';

export interface ServerHealth {
  rooms: number;
  workingroom: number;
  togetherroom: number;
  conns: number;
  /** 시크릿룸 수 · 방 안 사람 수 — 채널 상한(limits)에는 안 들어간다. 옛 방 서버는 칸이 없어 null. */
  secret: number | null;
  members: number | null;
  /** 앱을 켜고 붙어 있는 사람 수(presence.online) — 방 밖(마이홈 등)도 센다. 옛 방 서버는 칸이 없어 null. */
  online: number | null;
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
  const optNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === 'string' && v && v.length <= 80 ? v : null);
  const lim = o.limits && typeof o.limits === 'object' ? (o.limits as Record<string, unknown>) : null;
  const presence =
    o.presence && typeof o.presence === 'object' ? (o.presence as Record<string, unknown>) : null;
  return {
    rooms: num(o.rooms),
    workingroom: num(o.workingroom),
    togetherroom: num(o.togetherroom),
    conns: num(o.conns),
    secret: optNum(o.secret),
    members: optNum(o.members),
    online: optNum(presence?.online),
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

/** refetchMs 를 주면 그 간격으로 다시 읽는다(화면이 열려 있는 동안만 · 지금 숫자를 지켜볼 때). */
export function useServerHealth(wsUrl: string, refetchMs?: number) {
  return useQuery({
    queryKey: ['roomServerHealth', wsUrl],
    queryFn: () => fetchServerHealth(wsUrl),
    retry: false,
    staleTime: 30_000,
    ...(refetchMs ? { refetchInterval: refetchMs } : {}),
  });
}
