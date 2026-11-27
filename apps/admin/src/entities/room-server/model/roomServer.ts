// 방 서버(t-w-server realtime)의 공개 상태 주소 /health 를 읽는 데 쓰는 값.
export const CHANNELS = ['workingroom', 'togetherroom'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { workingroom: '워킹룸', togetherroom: '투게더룸' };

// 운영 realtime(0.13 서버) — API 판 웹 관리자가 /health 로 지금 접속 · 방 안 인원을 읽는 곳.
export const PROD_REALTIME_URL = 'wss://realtime.together-working.com';

/** wss://호스트 → https://호스트/health (방 서버가 CORS 로 열어 둔 상태 주소). */
export function healthUrl(wsUrl: string): string | null {
  const m = /^(wss?):\/\/([A-Za-z0-9.-]+(?::[0-9]{1,5})?)\/*$/.exec(wsUrl.trim());
  if (!m) return null;
  return `${m[1] === 'wss' ? 'https' : 'http'}://${m[2]}/health`;
}

/** /health 의 uptimeS → «켜진 지 2시간 13분». */
export function uptimeLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return '켜진 지 1분 미만';
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `켜진 지 ${d}일 ${h % 24}시간`;
  if (h > 0) return `켜진 지 ${h}시간 ${m % 60}분`;
  return `켜진 지 ${m}분`;
}
