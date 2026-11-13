/* presence-self.js — 👥 내 접속 표시를 realtime 에 알린다 («친구에게 온라인으로 보임 / 오프라인으로 보임»)
   책임: 내가 친구에게 보일지(visible)를 서버에 알린다. 서버는 알린 적 없는 사람을 오프라인으로 본다 — 그래서 연결이 붙을 때마다(처음 · 다시 붙은 뒤)
     지금 값을 다시 알린다(서버의 내 상태는 연결에 묶여 있다). 방 · 방 안 여부는 서버가 알아서 채운다 — 앱은 visible 만 보낸다.
     타이머로 되풀이 보내지 않는다 — 시작할 때 · 값이 바뀔 때 · 연결이 붙을 때뿐.
   내보냄: createPresenceSelf(deps) → {
     start(visible)      계정 확인 뒤 한 번(마이홈 처음 준비 — 고정값을 앉힌 뒤의 처음 값). 두 번 부르면 값만 바꾼다
     setVisible(visible) 사용자가 «온라인 / 오프라인» 을 눌렀을 때. start 전이면 아무 일 없음(계정 확인 전에는 보내지 않는다)
     reset()             계정을 놓을 때(friends-sub stop 과 같은 자리 — onUnload) — 값을 시작 전으로 · 연결 상태 구독을 푼다
   }
   ⚠️ reset 이 없으면 다음 계정의 연결이 붙는 순간 앞 계정의 보이기 값을 보낸다(🔒 오프라인 고정 계정이 온라인으로 보임).
     오프라인으로 바꾸는 신호는 따로 없다 — 연결의 bye · 끊김으로 서버가 맡는다.
   ⚠️ 🔒 고정(오프라인 고정)은 호출하는 쪽(presence-lock.js)이 처음 값에 반영해서 넘긴다 — 여기서는 모른다.
   검사: checks/sim-friends-presence-rt.js(4절) */
(function(){
'use strict';

/** @param {{
 *   rt: {
 *     send: (msg: object) => boolean,
 *     onState: (fn: (s: string) => void) => () => void,
 *     isReady: () => boolean,
 *   },
 *   onUnload: (fn: () => void) => void,
 * }} deps — rt: realtime 연결 하나(TwRtHub.store) · onUnload: 계정을 놓을 때(앱 종료 · 로그아웃 뒤 재시작) 부를 함수를 건다 */
function createPresenceSelf(deps){
  const rt = deps.rt;
  const onUnload = deps.onUnload;
  let _visible = null;   // null = 아직 시작 안 함(계정 확인 전) — 보내지 않는다
  let _off = null;       // 연결 상태 구독 해제

  function _send(){
    if(!rt.isReady()) return;   // start 가 값을 앉힌 뒤에만 불린다(구독도 start 에서 건다)
    rt.send({ t: 'status', visible: _visible });
  }
  function start(visible){
    _visible = visible !== false;
    if(!_off) _off = rt.onState(_send);   // 붙을 때마다 — 끊겼다 붙으면 서버는 내 상태를 잊었다
    _send();
  }
  function setVisible(visible){
    if(_visible === null) return;
    _visible = visible !== false;
    _send();
  }

  function reset(){
    _visible = null;
    const off = _off; _off = null;
    if(off) off();
  }

  onUnload(reset);

  return { start, setVisible, reset };
}

const api = { createPresenceSelf };
if(typeof window !== 'undefined') window.TwPresenceSelf = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
