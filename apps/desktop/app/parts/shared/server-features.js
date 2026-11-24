/* server-features.js — 서버가 아직 안 받는 0.14 기능 표(한 곳) · 검사 checks/sim-server-features.js
   [왜] 0.14 판의 몇 기능은 Firebase DB · Functions 에 직접 읽고 쓰게 만들어졌다. 0.13 은 Firebase DB 쓰기를 잠갔으므로
     서버(API)가 그 기능을 받을 때까지 입구(버튼 · 탭 · 입력칸)만 닫아 둔다. 코드는 지우지 않는다 — 서버가 받으면 이 표의 값만 true 로.
   ★ 입구는 `TwServerFeatures.on('이름')` 하나로 묻는다. 표에 없는 이름은 던진다(글자를 잘못 쓰면 조용히 꺼진 채 남지 않게).
   순수 classic script(window.TwServerFeatures) — 쓰는 모듈 · app.js 보다 먼저 싣는다. */
(function(){

/* 이름 → 서버가 받는가. 서버 작업 요청은 GitHub 이슈(«서버 작업 요청: …(0.14.0)»)로 넘긴다. */
const FEATURES = Object.freeze({
  xmas: false,                      // 🎄 크리스마스 — 트리 · 마니또 편지(xmas/*) — 런처 버튼 · 📩 편지 알림
  chatNotice: false,                // 시크릿룸 #공지 탭(chat/chat-notice.js)
  chatFocus: false,                 // 시크릿룸 #집중 탭(chat/chat-focus.js · focus/room-focus-sync.js)
  playlistLike: false,              // 플레이리스트 «노래가 좋아요👍»(status/playlist-like-ui.js)
  googleChange: false,              // 내 정보 › 구글 계정 [바꾸기](account/account.js _acctChangeGoogle)
                                    //   «로그인 · 가입 때 처음 보는 구글 묻기» 는 0.13 로그인 흐름(login-flow.js)으로 합치며 빠졌다 — 서버가 받으면 배선부터 다시(#1101)
  friendReqMsg: false,              // 남의 마이홈 [친구 신청] 사유 칸(myhome/friend-req-btn.js)
  themeCustomSave: false,           // 👑 테마 «내 색» 계정 저장(이 PC 저장은 늘 한다 — shared/theme-ui.js)
});

function on(name){
  if(!Object.prototype.hasOwnProperty.call(FEATURES, name)) throw new Error('[server-features] 모르는 기능 이름 — ' + name);
  return FEATURES[name] === true;
}

/* 서버 길이 아직 없는 기능의 provider 자리 — 어떤 메서드를 불러도 SERVER_PATH_MISSING 으로 거절한다.
   ★ 꺼진 기능의 옛 Firebase 통로(firebaseAPI.xmas 등)를 부르지 않게 한다 — 0.13 firebase-init 에는 그 통로가 없다(audit 검사 8).
     서버 경로가 생기면 이 자리를 그 기능의 …-api.js provider 로 바꾼다. */
const MISSING_CODE = 'SERVER_PATH_MISSING';
function noServer(name){
  on(name);
  return new Proxy({}, { get: (_t, k) => (k === 'then' ? undefined : () => Promise.reject(Object.assign(new Error('[server-features] 서버 경로 없음 — ' + name + '.' + String(k)), { code: MISSING_CODE }))) });
}

const api = Object.freeze({ FEATURES, on, noServer, MISSING_CODE });
if(typeof window !== 'undefined') window.TwServerFeatures = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
