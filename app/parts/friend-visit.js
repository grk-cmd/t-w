/* friend-visit.js — 🏠 친구 방에 놀러 가기 (마이홈 친구 목록 «온라인 · PLAY-MFEG» 코드 누르기 · 검사 sim-friend-visit.js)
   ・코드를 누르면 «○○ 님이 있는 룸에 놀러 갈까요?» 창 — 기존 «🙋 방 초대» 창(showRoomInvitePopup)과 같은 틀 · 같은 테마 변수 · lc-btn.
   ・[놀러 가기] = 초대 수락과 같은 길 — 방에 있으면 doLeaveRoom({ wipeChat: true }) 뒤 startRoom(코드). 정원 · 버전 안내는 startRoom 이 한다.
   ・같은 방이면 창 없이 알림만. 창을 띄운 사이 친구가 방을 옮기거나 나갔으면 누를 때 다시 보고 알림만(옛 코드로 가지 않는다).
   ⚠️ 방 코드는 _friendRoomTag 로만 얻는다(시크릿룸은 빈 값 = 누를 칸이 아예 없다) — 판정을 여기에 복사하지 말 것.
   ⚠️ 껍데기는 app-popup-ov + pointer-events:none — 화면 전체를 막지 않는다(초대 창 주석과 같은 근거).
   기본 포커스는 [취소] — Enter 한 번에 방이 바뀌지 않게(디자인 시스템 확인창 규칙). */
(function(){
'use strict';

/* 누를 때 무엇을 할지 — 'none'(코드 없음 = 방을 나갔거나 시크릿룸) · 'same'(이미 같은 방) · 'ask'(묻기) */
function decide(code, myRoom){
  if(!code) return 'none';
  if(myRoom && String(myRoom) === String(code)) return 'same';
  return 'ask';
}

function createFriendVisit(deps){
  const { document, escHtml, toast } = deps;
  let _ov = null;

  function _close(){ if(_ov){ try{ _ov.remove(); }catch(_){} _ov = null; } }

  /* 창이 떠 있는 사이 바뀌었을 수 있으니 누를 때 다시 본다 */
  async function _go(fid, code){
    const f = deps.getFriend(fid);
    const name = (f && f.name) || '친구';
    if(deps.roomTagOf(f) !== code){ toast(name + ' 님이 방을 나갔어요'); return; }
    if(decide(code, deps.myRoom()) === 'same'){ toast('이미 ' + name + ' 님과 같은 방에 있어요'); return; }
    try{ if(deps.inRoom()) await deps.leaveRoom(); }catch(_){}
    deps.startRoom(code);
  }

  function ask(fid){
    const f = deps.getFriend(fid);
    const name = (f && f.name) || '친구';
    const code = deps.roomTagOf(f);
    const my = deps.myRoom();
    const d = decide(code, my);
    if(d === 'none'){ toast(name + ' 님이 방을 나갔어요'); return; }
    if(d === 'same'){ toast('이미 ' + name + ' 님과 같은 방에 있어요'); return; }
    _close();
    const ch = deps.channelName(code);
    const ov = document.createElement('div');
    ov.className = 'app-popup-ov';   // ⚠️ 마우스 통과 화이트리스트(UI_HIT_SEL) 매칭용 — 빼지 말 것
    ov.style.cssText = 'position:fixed;inset:0;z-index:9600;background:none;display:flex;align-items:center;justify-content:center;pointer-events:none;';
    const box = document.createElement('div');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-labelledby', 'fvQ');
    box.style.cssText = 'pointer-events:auto;width:300px;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:var(--tw-font-legacy);';
    box.innerHTML =
      '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;">🏠 놀러 가기</div>' +
      '<div style="padding:16px 14px 6px;color:var(--ink);font-size:12px;line-height:1.6;">' +
        '<b id="fvQ" style="display:block;font-size:14px;line-height:1.45;margin-bottom:6px;">' + escHtml(name) + ' 님이 있는 룸에 놀러 갈까요?</b>' +
        '<span style="display:inline-flex;gap:6px;align-items:center;background:var(--win-face-2);border:1px solid var(--win-lo);padding:2px 8px;">' +
          '<span style="font-family:var(--win-font-num);font-weight:bold;letter-spacing:.5px;">' + escHtml(code) + '</span>' +
          (ch ? '<span style="font-size:10.5px;color:var(--ink-soft);">' + escHtml(ch) + '</span>' : '') +
        '</span>' +
      '</div>' +
      (my ? '<div style="padding:0 14px 4px;color:var(--ink-soft);font-size:11px;line-height:1.5;">지금 있는 방(<b style="font-family:var(--win-font-num);">' + escHtml(my) + '</b>)에서 나가고 이동해요.</div>' : '') +
      '<div style="display:flex;gap:6px;padding:8px 14px 14px;justify-content:flex-end;">' +
        '<button class="lc-btn ghost" data-a="no" style="min-width:70px;">취소</button>' +
        '<button class="lc-btn" data-a="ok" style="min-width:70px;">놀러 가기</button>' +
      '</div>';
    ov.appendChild(box); document.body.appendChild(ov);
    _ov = ov;
    const no = box.querySelector('[data-a="no"]'), ok = box.querySelector('[data-a="ok"]');
    no.onclick = ()=>_close();
    ok.onclick = ()=>{ _close(); _go(fid, code); };
    box.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); _close(); } });
    try{ no.focus(); }catch(_){}
  }

  return { ask, close: _close };
}

const api = { decide, createFriendVisit };
if(typeof window !== 'undefined') window.TwFriendVisit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
