/* nav.js — 🧭 창 열기 통로: 다른 기능이 «이 창을 열어 줘 · 방에서 나가 줘» 를 부탁하는 한 곳 (검사 sim-nav.js)
   [왜] 일정 알림 · 채팅 · 꾸미기 · 라이선스 요청 · 자리비움 퇴장처럼 아래 기능이 위층 창(⚙️ 프로그램 설정 · 🏠 마이홈)이나
     방 입장 모듈을 직접 부르면, 그 창 모듈도 아래 기능을 쓰므로 서로를 부르는 순환이 된다(checks/sim-dep-cycles.js).
     창 모듈은 자기를 만들 때 여는 함수를 여기에 걸고(on), 부르는 쪽은 이름으로 부탁만 한다(go) — 부르는 쪽은 창 모듈을 모른다.
   ★ 이름은 아래 NAV 에만 둔다(글자로 쓰지 않는다). 이름마다 거는 곳은 정확히 한 곳 — sim-nav.js 가 센다.
   ★ 아직 안 걸린 이름을 부르면 아무 일도 안 한다(undefined) — 예전 부르는 자리들이 «typeof 함수면 부른다» 로 건너뛰던 것과 같다.
   app.js · 쓰는 모듈보다 먼저 싣는 classic script(window.TwNav). app.js 는 `twNav` 로 받아 모듈에 deps 로 넘긴다. */
(function(){

const NAV = Object.freeze({
  PROGRAM_SETTINGS: 'programSettings',              // ⚙️ 프로그램 설정 창 열기 — (탭) · 거는 곳 program-settings.js
  PROGRAM_SETTINGS_CLOSE: 'programSettingsClose',   // ⚙️ 프로그램 설정 창 닫기 · 거는 곳 program-settings.js
  MY_HOME: 'myHome',                                // 🏠 마이홈 창 열기 · 거는 곳 myhome-ui.js
  LEAVE_ROOM: 'leaveRoom',                          // 🚪 방 나가기 — (opts) · 거는 곳 room-entry.js
  ASSET_IMPORT: 'assetImport',                      // ➕ 코드로 추가하기 창 열기 — (kind, cat) · 거는 곳 creator/asset-import.js
  ROOM_LOBBY: 'roomLobby',                          // 🗂️ 방 목록 로비 다시 읽기 — 모달이 열린 채 방을 나와 로비가 다시 보일 때 · 거는 곳 room/room-lobby-ui.js
  WARDROBE_ALBUM: 'wardrobeAlbum',                  // 📚 꾸미기 창을 «도감» 탭으로 열기 — 뽑기 창 [도감으로] · 거는 곳 character/wardrobe-panel.js
});
const _fns = {};
function on(name, fn){ _fns[name] = fn; }
function go(name, ...a){ const fn = _fns[name]; return fn ? fn(...a) : undefined; }

const api = { NAV, on, go };
if(typeof window !== 'undefined') window.TwNav = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
