/* report.js — 🚩 신고하기(좌석 · 책상 · 이름표 우클릭 «🚩 신고하기…» → 사유 → 신고) · 신고 창 공용 도우미
   app.js «🚩 신고하기» 구역의 사용자 몫을 그대로 옮긴 모듈이다(앱 FSD 11번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   관리자 신고 목록은 admin/admin-report.js 로 따로 옮겼다 — 이 파일의 도우미(창 틀 · 닫기 · 신고 종류 · 팝업 칸)를 받아 쓴다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 없다 — var 셋은 이 함수 안 지역 이름이 됐다(밖에서 쓰던 곳은 관리자 목록뿐).
   ★ 팝업 칸(_reportOv · _reportEsc)은 신고 창과 관리자 목록이 함께 쓰는 «한 번에 하나만 열리는 자리»라 이 파일이 가진다.
     관리자 목록은 읽는 함수 · 쓰는 함수(ov · setOv · esc · setEsc)로만 만진다.
   ★ app.js 함수 일곱은 화살표로, MY_FRIEND_CODE_KEY · _reportHiddenUids(앞에서 선언한 const — 같은 Set)는 값으로 받는다.
   ★ 밖에서 부르는 이름: openDialog(좌석 우클릭 메뉴 — reportMod.openDialog) · 관리자 목록용 close · box · KINDS · ADMIN_MIN · ov · setOv · esc · setEsc.
   ⚠️ document · window · localStorage 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwReport — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-report.js · checks/sim-report-away.js */
(function(){

function createReport(deps){
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
const _seatLabelName = deps.seatLabelName;
const _awayUrlOk = deps.awayUrlOk;             // 자리비움 그림 주소가 우리 Storage 인가
const getDisplayName = deps.getDisplayName;
const _reportHiddenSave = deps.reportHiddenSave;
const _reportHiddenUids = deps.reportHiddenUids; // 신고해서 숨긴 uid(Set — app.js 의 같은 객체)
const MY_FRIEND_CODE_KEY = deps.myFriendCodeKey;
var REPORT_ADMIN_MIN = 3;
var REPORT_KINDS = [
  { k:'char', label:'캐릭터 신고', sub:'모습 · 꾸미기', short:'캐릭터' },
  { k:'away', label:'자리비움 그림 신고', sub:'', short:'자리비움 그림' },
  { k:'nick', label:'닉네임 신고', sub:'', short:'닉네임' },
  { k:'etc',  label:'기타', sub:'', short:'기타' },
];
var _reportOv = null, _reportEsc = null;
function _myCode4(){
  try{ return String(localStorage.getItem(MY_FRIEND_CODE_KEY) || '').slice(-4); }catch(_){ return ''; }
}
function _reportClose(){
  if(_reportEsc){ document.removeEventListener('keydown', _reportEsc, true); _reportEsc = null; }
  if(_reportOv){ try{ _reportOv.remove(); }catch(_){} _reportOv = null; }
}
function _reportBox(title, width){
  const ov = document.createElement('div');
  ov.className = 'app-popup-ov';   // ⚠️ 마우스 통과 화이트리스트(UI_HIT_SEL) — 빼지 말 것
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'width:' + width + 'px;max-width:92vw;max-height:86vh;display:flex;flex-direction:column;background:var(--win-face);border:2px solid;'
    + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);'
    + 'box-shadow:4px 4px 0 rgba(0,0,0,.35);font-family:var(--tw-font-legacy);color:var(--ink);';
  const tb = document.createElement('div');
  tb.style.cssText = 'background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;flex:none;';
  tb.textContent = title;
  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 14px 14px;font-size:11px;overflow-y:auto;';
  box.appendChild(tb); box.appendChild(body); ov.appendChild(box);
  return { ov, box, body };
}
function _openReportDialog(seat){
  const target = seat && seat.friendUserId;
  if(!target){ if(typeof toast === 'function') toast('이 분의 정보가 아직 없어요 (버전 업데이트가 필요할 수 있어요)'); return; }
  const me = (typeof getMyUserId === 'function') ? getMyUserId() : null;
  if(!me || me === target) return;
  _reportClose();
  const name = (typeof _seatLabelName === 'function' ? _seatLabelName(seat) : '') || seat.friendName || '이 분';
  const { ov, body } = _reportBox('🚩 신고하기', 300);
  const q = document.createElement('div'); q.style.cssText = 'margin-bottom:8px;';
  const nb = document.createElement('b'); nb.textContent = name; q.appendChild(nb); q.appendChild(document.createTextNode(' 님을 신고할까요?'));
  body.appendChild(q);
  const fs = document.createElement('fieldset'); fs.style.cssText = 'margin:0;padding:6px 10px 8px;border:2px groove var(--win-hi);';
  const lg = document.createElement('legend'); lg.textContent = '사유'; lg.style.cssText = 'font-size:10.5px;padding:0 3px;'; fs.appendChild(lg);
  const hasAway = _awayUrlOk(seat.remoteAwayImg);
  let picked = null;
  const etc = document.createElement('input');
  etc.type = 'text'; etc.maxLength = 40; etc.placeholder = '직접 적기 · 40자'; etc.autocomplete = 'off';
  etc.setAttribute('aria-label', '기타 사유');
  etc.style.cssText = 'display:none;margin:3px 0 0 18px;width:calc(100% - 18px);box-sizing:border-box;font-family:inherit;font-size:11px;padding:2px 5px;background:#fff;'
    + 'border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);';
  const go = document.createElement('button'); go.className = 'lc-btn'; go.type = 'button'; go.textContent = '신고';
  go.style.cssText = 'width:auto;margin:0;padding:4px 16px;font-size:11px;'; go.disabled = true;
  REPORT_KINDS.forEach(kd=>{
    const lb = document.createElement('label');
    const off = (kd.k === 'away' && !hasAway);
    lb.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:' + (off ? 'default' : 'pointer') + ';color:' + (off ? 'var(--win-lo)' : 'var(--ink)') + ';';
    const r = document.createElement('input'); r.type = 'radio'; r.name = 'twReportKind'; r.value = kd.k; r.disabled = off;
    r.addEventListener('change', ()=>{ picked = kd.k; etc.style.display = (kd.k === 'etc') ? '' : 'none'; go.disabled = false; if(kd.k === 'etc') etc.focus(); });
    lb.appendChild(r); lb.appendChild(document.createTextNode(kd.label));
    const subText = off ? '— 등록한 그림 없음' : (kd.sub ? '— ' + kd.sub : '');
    if(subText){ const sp = document.createElement('span'); sp.style.cssText = 'color:var(--win-lo);font-size:10px;'; sp.textContent = subText; lb.appendChild(sp); }
    fs.appendChild(lb);
    if(kd.k === 'etc') fs.appendChild(etc);
  });
  body.appendChild(fs);
  const note = document.createElement('div'); note.style.cssText = 'font-size:10px;color:var(--ink-soft);line-height:1.55;margin-top:8px;';
  note.textContent = '신고하면 내 화면에서 이 분이 숨겨져요. 서로 다른 ' + REPORT_ADMIN_MIN + '명이 신고하면 관리자가 확인해요.';
  body.appendChild(note);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin-top:10px;';
  const no = document.createElement('button'); no.className = 'lc-btn'; no.type = 'button'; no.textContent = '취소';
  no.style.cssText = 'width:auto;margin:0;padding:4px 16px;font-size:11px;';
  row.appendChild(go); row.appendChild(no); body.appendChild(row);
  no.onclick = _reportClose;
  ov.addEventListener('mousedown', e=>{ if(e.target === ov) _reportClose(); });
  go.onclick = async ()=>{
    if(!picked) return;
    const txt = (picked === 'etc') ? etc.value.trim().slice(0, 40) : '';
    if(picked === 'etc' && !txt){ if(typeof toast === 'function') toast('사유를 적어 주세요'); etc.focus(); return; }
    const api = window.firebaseAPI;
    if(!api || !api.reportUser){ if(typeof toast === 'function') toast('아직 준비 중이에요'); return; }
    go.disabled = true;
    const res = await api.reportUser(target, me, { kind:picked, note:txt, nick:(typeof getDisplayName === 'function' ? getDisplayName() : ''), code4:_myCode4() });
    if(res && res.ok){
      _reportHiddenUids.add(target); _reportHiddenSave();
      _reportClose();
      if(typeof toast === 'function') toast('신고했어요 · 내 화면에서 이 분을 숨겼어요');
    }else{
      go.disabled = false;
      if(typeof toast === 'function') toast(res && res.reason === 'auth' ? '로그인한 뒤에 신고할 수 있어요' : '신고하지 못했어요 — 잠시 뒤 다시 해 주세요');
    }
  };
  _reportEsc = e=>{ if(e.key === 'Escape'){ e.stopPropagation(); _reportClose(); } };
  document.addEventListener('keydown', _reportEsc, true);
  document.body.appendChild(ov);
  _reportOv = ov;
}

return {
  openDialog: _openReportDialog,             // 좌석 우클릭 «🚩 신고하기…»
  close: _reportClose, box: _reportBox,      // 관리자 목록이 같은 창 틀 · 닫기를 쓴다
  KINDS: REPORT_KINDS, ADMIN_MIN: REPORT_ADMIN_MIN,
  ov: ()=>_reportOv, setOv: (v)=>{ _reportOv = v; },     // 팝업 칸 — 한 번에 하나만
  esc: ()=>_reportEsc, setEsc: (v)=>{ _reportEsc = v; },
};
}

const api = { createReport };
if(typeof window !== 'undefined') window.TwReport = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
