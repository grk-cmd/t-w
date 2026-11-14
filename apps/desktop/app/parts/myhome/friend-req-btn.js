/* friend-req-btn.js — 🙋 남의 마이홈 이름 옆 [친구 신청] · 신청 사유 창(네이버 이웃 신청처럼) (검사 sim-friend-req-btn.js)
   ・책임: 관람 중인 홈이 친구도 아니고 내가 보낸 요청도 없으면 이름 옆에 [친구 신청]을 보인다 · 누르면 사유(100자) 창 · [신청하기]로 보낸다.
   ・보내기와 앞단 검사(준비 · 나 · 이미 친구 · 정원)는 좌석 친구 신청과 같은 한 벌(seat-friend-req.js sendFriendReq)을 부른다 — 여기서 다시 쓰지 않는다.
   ・받는 deps — sendFriendReq(uid, name, msg) → {ok, reason} · resultView(res, name) → {kind, text}(둘 다 seat-friend-req.js 한 벌) ·
     friendNet()(데이터 provider — isFriendRequestAlive(toId, myId) 로 내가 보낸 요청이 살아 있나 · 좌석 친구 신청과 같은 모양) · friends()(읽는 함수 — 친구 구독이 다시 대입) · getMyUserId · toast.
   ・내놓는 것: refresh(viewUid, name) — 관람 화면을 다시 칠할 때(myhome-visit.js _mhApplyVisitUI) 부른다. viewUid 가 없으면(내 홈 · 미리보기) 숨김.
   ⚠️ 요청이 살아 있는지 묻는 동안 다른 홈으로 넘어가면 결과를 버린다(늦은 답이 다음 화면 단추를 켜지 않게).
   ⚠️ 사유는 textContent 로만 넣는다(받는 쪽도 같다) — 남이 쓴 글이 HTML 로 읽히면 안 된다.
   전역 이름은 TwFriendReqBtn(Tw 접두사 #103). app.js 가 친구 홈 구경보다 먼저 createFriendReqBtn(deps) 로 만든다. */
(function(){

const REASON_MAX = 100;   // 규칙 friendRequests/$toId/$fromId/msg 의 길이와 같다
const BTN_ID = 'mhFriendReqBtn';

/* 사유 다듬기 — 앞뒤 공백 · 줄바꿈 정리 · 길이 */
function cleanReason(s){
  return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim().slice(0, REASON_MAX);
}

function createFriendReqBtn(deps){
const sendFriendReq = deps.sendFriendReq;
const resultView = deps.resultView;   // (res, name) → {kind, text} — 좌석 친구 신청과 같은 한 벌(seat-friend-req.js)
const friendNet = deps.friendNet;   // 읽는 함수 — 데이터 provider, 준비 전이면 없음
const friends = deps.friends;   // 읽는 함수
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;

let _shownFor = null;   // 지금 단추가 가리키는 uid
let _seq = 0;           // 늦게 온 «살아 있나» 답 버리기
let _askedFor = null;   // 마지막으로 서버에 «살아 있나» 를 물은 uid — 같은 관람 화면을 여러 번 칠해도 그 읽기만 다시 안 한다. 숨길 때 비운다
let _name = null;       // 지금 관람 중인 사람 이름 — 같은 uid 라도 칠할 때마다 새로 받는다(처음엔 '친구' 힌트 → 프로필 이름). 누를 때 읽는다
let _dlg = null;        // 열린 사유 창 { uid, ov, onKey } — 다른 사람 · 내 홈으로 넘어가면 닫는다(남은 창이 옛 사람에게 보내지 않게)

/* 사유 창 닫기 — Esc 처리기(document 캡처)도 같이 뗀다 */
function _closeDialog(){
  if(!_dlg) return;
  const d = _dlg; _dlg = null;
  try{ document.removeEventListener('keydown', d.onKey, true); }catch(_){}
  try{ d.ov.remove(); }catch(_){}
}

function _btn(){ return document.getElementById(BTN_ID); }
function _hide(){ const b = _btn(); if(b) b.hidden = true; _shownFor = null; }

async function refresh(viewUid, name){
  if(_dlg && _dlg.uid !== viewUid) _closeDialog();
  _name = name || null;
  const me = getMyUserId();
  /* 내 홈 · 나 · 이미 친구는 서버를 안 읽고 숨긴다 — 같은 uid 를 다시 칠할 때도(그 사이 친구가 됐을 수 있다) */
  if(!viewUid || !me || viewUid === me || (friends() || {})[viewUid]){ ++_seq; _askedFor = null; _hide(); return; }
  if(viewUid === _askedFor) return;
  const seq = ++_seq;
  _hide();
  let alive = true;
  const net = friendNet();
  if(!net) return;
  _askedFor = viewUid;   // 물을 수 있을 때만 적는다 — provider 가 늦게 준비되면 다음 칠하기에서 묻는다
  try{ alive = await net.isFriendRequestAlive(viewUid, me); }catch(_){ alive = true; }
  if(seq !== _seq || alive) return;
  const b = _btn(); if(!b) return;
  b.hidden = false; _shownFor = viewUid;
  b.onclick = () => openDialog(viewUid, _name || '이 사람');
}

function openDialog(uid, name){
  if(_dlg && _dlg.uid === uid) return;
  _closeDialog();
  const ov = document.createElement('div');
  ov.className = 'friend-req-ask-ov app-popup-ov';
  const box = document.createElement('div'); box.className = 'friend-req-ask';
  const head = document.createElement('div'); head.className = 'friend-req-ask-hd'; head.textContent = '🙋 친구 신청';
  const body = document.createElement('div'); body.className = 'friend-req-ask-bd';
  const lead = document.createElement('div'); lead.className = 'friend-req-ask-lead';
  const nm = document.createElement('b'); nm.textContent = name;
  lead.append(nm, document.createTextNode(' 님에게 친구 신청을 보내요. 신청 사유를 적어 주세요(없어도 돼요).'));
  const ta = document.createElement('textarea');
  ta.className = 'friend-req-ask-msg'; ta.maxLength = REASON_MAX; ta.rows = 3; ta.placeholder = '예) 같은 방에서 자주 뵈어서 친구 하고 싶어요';
  const cnt = document.createElement('div'); cnt.className = 'friend-req-ask-cnt'; cnt.textContent = '0 / ' + REASON_MAX;
  ta.oninput = () => { cnt.textContent = ta.value.length + ' / ' + REASON_MAX; };
  body.append(lead, ta, cnt);
  const btns = document.createElement('div'); btns.className = 'friend-req-ask-btns';
  const ok = document.createElement('button'); ok.className = 'lc-btn'; ok.type = 'button'; ok.textContent = '신청하기';
  const no = document.createElement('button'); no.className = 'lc-btn ghost'; no.type = 'button'; no.textContent = '취소';
  btns.append(ok, no);
  box.append(head, body, btns); ov.appendChild(box);
  const host = document.getElementById('myHomeWin') || document.body;
  host.appendChild(ov);
  /* Esc 는 document 캡처로 — 창 안 버블로 받으면 win-stack 의 캡처 Esc 가 먼저 마이홈을 닫는다(그 목록 ESC_YIELD_SEL 에 이 창이 있어 양보한다) */
  const onKey = (e) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } };
  const me = { uid, ov, onKey };
  const close = () => { if(_dlg === me) _closeDialog(); };
  _dlg = me;
  document.addEventListener('keydown', onKey, true);
  no.onclick = close;
  ok.onclick = async () => {
    ok.disabled = true; no.disabled = true;
    let res = null, err = null;
    try{ res = await sendFriendReq(uid, name, cleanReason(ta.value)); }catch(e){ err = e; }
    const v = resultView(res, name);   // fail 이면 문구 대신 E-FR-06
    if(v.kind === 'fail'){ TwErrorCodes.notify('E-FR-06', err || (res && (res.err || res.reason))); ok.disabled = false; no.disabled = false; return; }
    toast(v.text);
    close();
    if(_shownFor === uid) _hide();
  };
  ta.focus();
}

return { refresh, openDialog };
}

const api = { createFriendReqBtn, cleanReason, REASON_MAX };
if(typeof window !== 'undefined') window.TwFriendReqBtn = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
