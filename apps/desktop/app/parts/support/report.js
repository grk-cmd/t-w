/* report.js — 🚩 신고하기(좌석 · 책상 · 이름표 우클릭 «🚩 신고하기…» → 사유 → 신고) · 신고 창 공용 도우미
   관리자 신고 목록은 admin/admin-report.js — 이 파일의 도우미(창 틀 · 닫기 · 신고 종류 · 팝업 칸)를 받아 쓴다.
   ★ 신고는 서버 길(report-api.js — POST /v1/reports) 하나로 보낸다. 신고한 사람은 서버가 토큰에서 정하니 내 이름 · 코드를 싣지 않는다.
     성공하면 내 화면에서 그 사람을 숨기고(hidden-seats.js 의 같은 Set) 창을 닫는다. 실패하면 숨기지 않고 [신고] 를 다시 켠다 — 다시 보내지 않는다.
   ★ 팝업 칸(_reportOv · _reportEsc)은 신고 창과 관리자 목록이 함께 쓰는 «한 번에 하나만 열리는 자리»라 이 파일이 가진다.
     관리자 목록은 읽는 함수 · 쓰는 함수(ov · setOv · esc · setEsc)로만 만진다.
   ★ 밖에서 부르는 이름: openDialog(좌석 우클릭 메뉴 — reportMod.openDialog) · 관리자 목록용 close · box · KINDS · ADMIN_MIN · ov · setOv · esc · setEsc.
   ⚠️ document · window 는 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwReport — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-report.js · checks/sim-report-away.js */
(function(){

function createReport(deps){
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
const _seatLabelName = deps.seatLabelName;
const _awayUrlOk = deps.awayUrlOk;             // 자리비움 그림 주소가 우리 Storage 인가
const _reportHiddenSave = deps.reportHiddenSave;
const _reportHiddenUids = deps.reportHiddenUids; // 신고해서 숨긴 사용자 코드(Set — hidden-seats.js 의 같은 객체)
const reportApi = deps.reportApi;               // 🌐 신고 서버 길(TwReportApi — file(대상, 사유, 글) · failOf(오류) → 갈래)
const apiErrors = deps.apiErrors;               // 🧭 공통 code → 할 일 · 번호(TwApiErrors.store — 로그인 풀림 · 점검 · 닿지 못함)
const notifyError = deps.notifyError;           // 실패 번호 토스트(TwErrorCodes.notify)
var REPORT_ADMIN_MIN = 3;
var REPORT_KINDS = [
  { k:'char', label:'캐릭터 신고', sub:'모습 · 꾸미기', short:'캐릭터' },
  { k:'away', label:'자리비움 그림 신고', sub:'', short:'자리비움 그림' },
  { k:'nick', label:'닉네임 신고', sub:'', short:'닉네임' },
  { k:'etc',  label:'기타', sub:'', short:'기타' },
];
var _reportOv = null, _reportEsc = null;
/* 실패 갈래(report-api.js failOf) → 안내 문구. self 는 창을 열 때 이미 막아 조용히 닫기만 · common 은 공통 표 · 그 밖은 E-RPT-01 */
const FAIL_TEXT = {
  noAwayImage: '그 분의 자리비움 그림이 이미 없어요',
  noteRequired: '사유를 적어 주세요',
};
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
  if(!target){ toast('이 분의 정보가 아직 없어요 (버전 업데이트가 필요할 수 있어요)'); return; }
  const me = getMyUserId();
  if(!me || me === target) return;
  _reportClose();
  const name = _seatLabelName(seat) || seat.friendName || '이 분';
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
    if(picked === 'etc' && !txt){ toast('사유를 적어 주세요'); etc.focus(); return; }
    go.disabled = true;
    try{
      await reportApi.file(target, picked, txt);
    }catch(e){
      const kind = reportApi.failOf(e);
      if(kind === 'self'){ _reportClose(); return; }
      go.disabled = false;
      if(Object.prototype.hasOwnProperty.call(FAIL_TEXT, kind)) toast(FAIL_TEXT[kind]);
      else if(kind === 'common') apiErrors.notify(e);
      else notifyError('E-RPT-01', e);
      return;
    }
    _reportHiddenUids.add(target); _reportHiddenSave();
    _reportClose();
    toast('신고했어요 · 내 화면에서 이 분을 숨겼어요');
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
