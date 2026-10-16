/* myhome-hooks.js — 🪝 마이홈 고리판: 편집 묶음 · 마이홈 창이 거는 «저장 · 배경 · 테마 · BGM» 함수를 다른 파일이 이름으로 부르는 한 곳 (검사 sim-myhome-hooks.js)
   [왜] 페이지 그리기 · 친구 목록 · 스티커 · 친구 홈 구경 · 설정 패널 · 스티커사진 · 바탕화면이 편집 묶음(myhome-edit.js)과
     마이홈 창(myhome-ui.js)이 window 에 거는 이름을 직접 부르면, 편집 묶음 · 창도 그 파일들을 쓰므로 서로를 부르는 순환이 된다
     (checks/sim-dep-cycles.js). 거는 쪽은 자기를 만들 때 함수를 여기에 걸고(on), 부르는 쪽은 이름으로 부른다(call) — 서로의 파일을 모른다.
   ★ 이름은 아래 HOOK 에만 둔다(글자로 쓰지 않는다). 이름마다 거는 곳은 정확히 한 파일 — sim-myhome-hooks.js 가 센다.
   ★ call 은 안 걸린 이름이면 던진다(TypeError) — 예전 window.이름() 과 같다(부르는 자리가 try 로 감싼 그대로). 부팅 때 늘 걸리는 고리라 가드를 두지 않는다.
     창을 열 때만 걸리는 고리(CANCEL_NAME_EDIT)와 바탕화면이 먼저 실리는지 모르는 자리는 has 로 보고 부른다(예전 typeof 가드 자리).
   ★ commitMyHomePage · _bgmDestroy · _mhDsClose · _mhApplyBg · _mhApplyTheme · _mhSyncBgmBounds 는 window 에도 예전처럼 건다 — app.js · 거는 파일 안이 그 이름으로 부른다.
   받는 것 없음(실릴 때 바로 만든다). 내보냄: window.TwMyHomeHooks = { HOOK, on, call, has }.
   app.js · 쓰는 모듈보다 먼저 싣는 classic script. */
(function(){

const HOOK = Object.freeze({
  COMMIT: 'commit',                    // 💾 마이홈 자동 저장 — (silent) · 거는 곳 myhome-edit.js
  APPLY_BG: 'applyBg',                 // 🖼️ 바깥 배경 다시 칠하기 · 거는 곳 myhome-edit.js
  APPLY_THEME: 'applyTheme',           // 🎨 테마 다시 칠하기 · 거는 곳 myhome-edit.js
  BGM_REFRESH: 'bgmRefresh',           // 🎵 BGM 위젯 글 · 버튼 다시 쓰기 · 거는 곳 myhome-edit.js
  BGM_PLAYING: 'bgmPlaying',           // 🎵 마이홈 BGM 이 재생 중인가 · 거는 곳 myhome-edit.js
  BGM_SET_PLAYING: 'bgmSetPlaying',    // 🎵 재생 표시만 맞춘다 — (on) · 거는 곳 myhome-edit.js
  BGM_DESTROY: 'bgmDestroy',           // 🎵 BGM 창 닫기 · 거는 곳 myhome-edit.js
  DS_CLOSE: 'dsClose',                 // 👑 디자인 스튜디오 창 닫기 · 거는 곳 myhome-edit.js
  CANCEL_NAME_EDIT: 'cancelNameEdit',  // 🏷️ 열린 닉네임 입력칸을 취소로 접기 — 입력칸이 열려 있을 때만 걸린다 · 거는 곳 myhome-edit.js
  SYNC_BGM_BOUNDS: 'syncBgmBounds',    // 🎵 BGM 창이 숨을 마이홈 창 사각형 보내기 · 거는 곳 myhome-ui.js
});
const _fns = {};
function on(name, fn){ _fns[name] = fn; }
function call(name, ...a){ return _fns[name](...a); }
function has(name){ return typeof _fns[name] === 'function'; }

const api = { HOOK, on, call, has };
if(typeof window !== 'undefined') window.TwMyHomeHooks = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
