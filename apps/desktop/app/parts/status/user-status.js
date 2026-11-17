/* user-status.js — 🫧 활동 상태(밥 · 게임 · 자리비움 · 빡일 · 커스텀)의 저장 · 내 칩 다시 그리기 · 상태 메뉴 · 커스텀 상태 + 좌석 xf 저장(앱 FSD · app.js 분리 M9)
   app.js USER STATUS 구역 · 좌석 xf 저장을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(deps 를 읽는 함수로 받는 줄만 `이름()` 으로 달라지고, 걷지 않으면 TDZ 와 같은 뜻이던 `typeof Presence` 가드 둘은 걷음).
   ・책임: 내 상태 userStatus(저장 tw.userStatus · 불러오기 · 바꾸기 → 칩 · 메뉴 · 방에 알림) · 좌석 + 상태키 → 화면에 쓸 상태 설정 statusConfFor(커스텀 · 오늘 기록 전시) · 커스텀 상태 문구 저장 ·
     내 칩 · 메뉴 다시 그리기(refreshMyStatusUI · refreshCustomStatusMenuItem — 프리미엄 아니면 커스텀 항목 숨김) · saveSeatXf(좌석 크기 · 높이 · 방향을 def.xf 와 슬롯에 저장).
     상태 표(USER_STATUSES · 커스텀 상태 저장값)는 status/user-status-table.js — 이 모듈은 그 표를 읽는다.
   ・받는 deps 6 — 값: accountStoreMod(계정별 로컬 칸 — tw.userStatus · 커스텀 상태) · clampCharY · userStatusTableMod · 함수: findMySeat · 읽는 함수: isPremium · slots(더 아래에서 만들어지거나 다시 대입된다). 다른 도메인(방 알림 · 오늘 기록 전시 · 슬롯 저장 · 색 변환)은
     부르지 않고 attachStatusHooks({ setCustomStatus, setUserStatus, focusShowMine, hexToRgba, saveSlots }) 로 app.js 가 건 알림만 부른다(모듈 순환 막기).
   ・내놓는 것: attachStatusHooks · userStatus()(읽기만 — 바꾸는 곳은 setUserStatus · loadUserStatusFromStorage · resetLocal 셋) · resetLocal · _premiumOn · saveCustomStatusConf · statusConfFor · setUserStatus · loadUserStatusFromStorage · refreshMyStatusUI · refreshCustomStatusMenuItem · saveSeatXf
   ⚠️ _premiumOn 은 isPremium(파일 뒤쪽 let)을 try 로 읽는다 — 초기화 때 불려도 TDZ 로 죽지 않게. 다른 모듈은 deps 로 받는다(window 고리 없음).
   ⚠️ 커스텀 상태 항목은 상태 드롭다운 안의 stItem 이라 textContent 를 통째로 갈아치우면 안 된다(.csEmo · .csLabel 이 따로 있다).
   검사: checks/sim-user-status.js */
(function(){

function createUserStatus(deps){
const accountStoreMod = deps.accountStoreMod;
const clampCharY = deps.clampCharY;
const findMySeat = deps.findMySeat;
const isPremium = deps.isPremium;
const slots = deps.slots;
const userStatusTableMod = deps.userStatusTableMod;
/* 방에 알리기 · 오늘 기록 전시 · 슬롯 저장 · 색 변환은 다른 도메인(room · focus · character · status 칩)이 하는 일이다 — 이 모듈이 그쪽 모듈을 부르면 모듈 순환이 되므로
   app.js 가 attachStatusHooks 로 걸어 둔 알림만 부른다(sim-dep-cycles). 상태를 바꾸는 setUserStatus · loadUserStatusFromStorage · refreshMyStatusUI 를 부르기 전에 한 번. */
let statusHooks = null;
function attachStatusHooks(h){ statusHooks = h; }
function saveSeatXf(seat){ if(!seat||!seat.charDef)return;
  seat.charDef.xf={s:seat.userScale,y:clampCharY(seat.userY),z:0,rot:seat.userRot,x:seat.userX||0};   // 🧍 y=높이 · 🚫 z 폐기
  if(seat.slot!=null) slots()[seat.slot]=seat.charDef;
  statusHooks.saveSlots(); }

/* isPremium은 파일 뒷부분에서 let으로 선언됨 — 초기화 시점(이 위치)에서 참조하면 TDZ ReferenceError가 남.
   typeof 가드도 let TDZ에는 통하지 않으므로 try/catch로 안전하게 읽는 접근자를 씀.
   (라이선스가 확정되면 _refreshPremiumGatedUI가 다시 호출되어 UI가 갱신됨) */
function _premiumOn(){ try{ return !!isPremium(); }catch(_){ return false; } }

/* (구역 떼기 C · w1) 이 자리의 본문도 status/user-status-table.js 로 옮겼다 — 만드는 줄은 첫 자리. */
function saveCustomStatusConf(emo, text){
  userStatusTableMod.setCustomStatusConf({
    emo: (emo || '').slice(0,2),            // 비워두면 이모지 없이 문구만 표시
    text: (text || '').slice(0, userStatusTableMod.CUSTOM_STATUS_MAXLEN),
  });
  try{ accountStoreMod.set(userStatusTableMod.CUSTOM_STATUS_KEY, JSON.stringify(userStatusTableMod.customStatusConf())); }catch(e){}
  // 지금 커스텀 상태를 쓰고 있다면 즉시 반영(말풍선/이모지 갱신) + 친구에게도 전파
  statusHooks.setCustomStatus(userStatusTableMod.customStatusConf());
  refreshCustomStatusMenuItem();
}
/* 좌석 + 상태키 → 실제로 화면에 쓸 상태 설정({emo,label,...}) 해석.
   custom은 본인이면 내 등록값, 친구면 그 친구가 보낸 값(remoteCustomStatus)을 씀.
   문구가 비어 있으면(등록 안 함) null 반환 → 상태 없음(온라인)과 동일하게 처리됨. */
function statusConfFor(seat, us){
  /* 📊 오늘 기록 전시 — **상태가 없을 때만** 내 머리 위에 방에 보낸 값과 같은 것을 띄운다(내 화면 거울).
     상태(커스텀 포함)가 하나라도 있으면 그것이 이긴다 — 남의 화면에서도 같은 순서다(Presence._statusOut). */
  if(!us){
    /* ⚠️ isMe 만 보면 «자리추가»로 주 캐릭터가 바뀐 판에서 내 좌석이 빠진다 — findMySeat 과 같은 기준으로 본다. */
    const _mine = findMySeat();
    if(seat && !seat.remote && (seat.isMe || seat === _mine)){ const f = statusHooks.focusShowMine(); if(f) return Object.assign({}, userStatusTableMod.USER_STATUSES.custom, { emo: f.emo, label: f.text }); }
    return null;
  }
  const base = userStatusTableMod.USER_STATUSES[us];
  if(!base) return null;
  if(us !== 'custom') return base;
  const cs = (seat && seat.remote) ? seat.remoteCustomStatus : userStatusTableMod.customStatusConf();
  if(!cs || !cs.text) return null;
  // 이모지를 비워두면 책상 위 이모지는 안 띄우고 문구만 표시 (emo:'' → setSeatDeskEmoji가 빈 값으로 처리)
  return Object.assign({}, base, { emo: cs.emo || '', label: cs.text });
}
let userStatus=null;
function setUserStatus(v){
  if(!v || !userStatusTableMod.USER_STATUSES[v]) v=null;
  userStatus=v;
  try{ accountStoreMod.set('tw.userStatus', v||''); }catch(e){}
  refreshMyStatusUI();
  statusHooks.setUserStatus(v);
}
function loadUserStatusFromStorage(){
  userStatus=null;   // 확인 전에 자동 자리비움이 바꿨을 수 있다 — 계정 칸 값만 믿는다
  try{ const v=accountStoreMod.get('tw.userStatus'); if(v && userStatusTableMod.USER_STATUSES[v]) userStatus=v; }catch(e){}
}
function refreshMyStatusUI(){
  const btn=document.getElementById('myStatusChipBtn'); if(!btn)return;
  const dot=document.getElementById('myStatusDot');
  // ✨ 커스텀 상태는 등록한 문구/이모지로 해석해야 하므로 statusConfFor를 통해 얻음(내 좌석 기준).
  const c = userStatus ? statusConfFor(null, userStatus) : null;
  if(c){
    // 세로 배열 A안: 라벨 요소는 없앴고 대신 title(툴팁)로 현재 상태 표시. dot 색은 그대로 상태 시각화.
    btn.title = (c.emo ? c.emo+' ' : '') + c.label;
    if(dot){ dot.style.background = TwSafeHtml.cssColor(c.dot||'#9dba8a'); dot.style.boxShadow='0 0 0 2px '+statusHooks.hexToRgba(c.dot||'#9dba8a',.18); }
  } else {
    btn.title = '상태';
    if(dot){ dot.style.background = '#9dba8a'; dot.style.boxShadow='0 0 0 2px rgba(157,186,138,.18)'; }
  }
  /* ⚠️ data-st 가 있는 항목만 본다. ✨ 커스텀 상태 항목은 data-st 가 없어서 ''===''(온라인)로
     읽혀 ● 표식이 두 줄에 붙는다 — 그 항목의 표식은 refreshCustomStatusMenuItem 이 따로 단다. */
  document.querySelectorAll('#myStatusMenu .stItem[data-st]').forEach(b=>{
    b.classList.toggle('active', (b.dataset.st||'')===(userStatus||''));
  });
  refreshCustomStatusMenuItem();
}

/* ✨ 커스텀 상태 항목(프리미엄 전용) 갱신 — 라이선스가 없으면 항목 자체를 숨김.
   등록값·프리미엄 여부·현재 상태가 바뀔 때마다 호출.
   ⚠️ 이 항목은 칩 버튼이 아니라 **상태 드롭다운 안의 stItem** 이다(칩 줄을 줄이려고 옮겼다).
     그래서 textContent 를 통째로 갈아치우면 안 된다 — 안에 이모지(.csEmo)와 글자(.csLabel)가 따로 있다. */
function refreshCustomStatusMenuItem(){
  const btn = document.getElementById('myCustomStatusBtn');
  if(!btn) return;
  if(!_premiumOn()){ btn.style.display = 'none'; return; }   // 라이선스 없으면 아예 안 보임
  btn.style.display = '';
  const emoEl = btn.querySelector('.csEmo'), lblEl = btn.querySelector('.csLabel');
  // 등록된 이모지가 있으면 그걸 띄워서 "지금 뭘로 등록해뒀는지" 바로 보이게
  if(emoEl) emoEl.textContent = userStatusTableMod.customStatusConf().emo || '✨';
  if(lblEl) lblEl.textContent = userStatusTableMod.customStatusConf().text || '커스텀 상태';
  btn.title = userStatusTableMod.customStatusConf().text
    ? `커스텀 상태: ${userStatusTableMod.customStatusConf().text} (클릭해서 수정)`
    : '커스텀 상태 문구 등록';
  btn.classList.toggle('on', userStatus === 'custom');   // 지금 이 상태를 쓰는 중이면 ● 표식
}

return {
  attachStatusHooks,
  userStatus: ()=>userStatus,
  resetLocal: ()=>{ userStatus = null; },   // 세션이 끝날 때 처음 값으로(저장 · 방 알림 없음 — launcher/user-local.js 의 status 조각)
  _premiumOn,
  saveCustomStatusConf,
  statusConfFor,
  setUserStatus,
  loadUserStatusFromStorage,
  refreshMyStatusUI,
  refreshCustomStatusMenuItem,
  saveSeatXf,
};
}

const api = { createUserStatus };
if(typeof window !== 'undefined') window.TwUserStatus = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
