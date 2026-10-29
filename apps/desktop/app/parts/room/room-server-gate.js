/*
 * 방 서버 문지기 — 0.13 에선 «한 길만 돌려주는» 얇은 자리: 늘 Firebase 방.
 * [왜 얇은가] 0.13 서버 GET /v1/config 에는 방 서버 스위치(roomServer · 허용 목록 · 비율 · 서버 표)가 없고, 방 주소록(roomDir)도 없다.
 *   0.13 realtime 서버는 통신 규약 2판(pv 2)만 받는데 옛 방 연결(room-server-net.js)은 1판이라, 고를 길이 지금 Firebase 방 하나다.
 * [걷는 차례] 방 묶음이 방을 realtime 연결 하나(realtime/rt-hub.js) 위 방 포트로 갈아 끼우면, 이 파일과 firebase-init.js 의
 *   resolveRoomServer · roomServerMine · roomServerMineNow · roomServerPossible 을 같이 걷는다. 새 판단을 여기 더하지 않는다.
 * 내놓는 것: createRoomServerGate() → { resolveRoomServer(code, opts) → { via:'firebase', why:'off' } · refreshMine() → null · mine() → null ·
 *   serverUrl() → null · serverPossible() → false } — 옛 판과 같은 이름 · 같은 모양(부르는 쪽은 그대로).
 */
export function createRoomServerGate(){
  return {
    resolveRoomServer: async () => ({ via: 'firebase', why: 'off' }),
    refreshMine: async () => null,
    mine: () => null,
    serverUrl: async () => null,
    serverPossible: () => false,
  };
}
