/* admin-report.js — 🚩 신고 목록 (관리자 — 서로 다른 REPORT_ADMIN_MIN 명 이상에게 신고된 사람 · 그림 내리기 · 문제없음)
   app.js «🚩 신고하기» 구역의 관리자 몫을 그대로 옮긴 관리자 모듈이다(앱 FSD 11번 · 관리자 코드 admin 폴더). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다. 바뀐 줄은 6줄 — 팝업 칸(_reportOv · _reportEsc)은 이름() 으로 읽고 대입은
     setReportOv(…) · setReportEsc(…) 로, isAdmin 은 이름() 으로. 팝업 칸은 신고 창(report.js)과 함께 쓰는 자리라 그쪽이 가지고,
     isAdmin 은 app.js 가 다시 대입하는 let 이라 읽는 함수로 받는다. 자리는 파서로 찾았다.
   ★ 창 틀 · 닫기 · 신고 종류 · 기준 인원은 report.js 가 내놓은 것을 app.js 가 넘긴다.
   ★ 밖에서 부르는 이름: rows(검사용 순수 함수 _reportAdminRows). 버튼(#lcReportList)은 만들 때 건다.
   ⚠️ document · window · firebaseAPI 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminReport — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-report.js · checks/sim-report-away.js */
(function(){

function createAdminReport(deps){
const toast = deps.toast;
const _awayUrlOk = deps.awayUrlOk;
const isAdmin = deps.isAdmin;                    // 읽는 함수 — 관리자 모드(app.js 의 let)
const _reportClose = deps.reportClose;           // report.js — 창 닫기
const _reportBox = deps.reportBox;               // report.js — 창 틀
const REPORT_KINDS = deps.kinds;                 // report.js — 신고 종류
const REPORT_ADMIN_MIN = deps.adminMin;          // report.js — 목록에 뜨는 최소 신고자 수
const _reportOv = deps.reportOv, setReportOv = deps.setReportOv;     // 팝업 칸(report.js 가 가짐)
const _reportEsc = deps.reportEsc, setReportEsc = deps.setReportEsc;
/* 관리자 — 서로 다른 REPORT_ADMIN_MIN 명 이상에게 신고된 사람 목록. 순수 함수로 떼어 둔다(검사). */
function _reportAdminRows(all){
  const out = [];
  for(const t of Object.keys(all || {})){
    const recs = Object.values(all[t] || {}).filter(r=>r && typeof r === 'object' && typeof r.kind === 'string');
    if(recs.length >= REPORT_ADMIN_MIN) out.push({ target:t, recs: recs.sort((a,b)=>(b.ts||0)-(a.ts||0)) });
  }
  return out.sort((a,b)=>b.recs.length - a.recs.length);
}
function _reportReasonText(r){
  const kd = REPORT_KINDS.find(x=>x.k === r.kind);
  const base = kd ? kd.short : '기타';
  return (r.kind === 'etc' && r.note) ? base + ' · ' + r.note : base;
}
async function _openReportAdmin(){
  if(typeof isAdmin() === 'undefined' || !isAdmin()) return;
  const api = window.firebaseAPI;
  if(!api || !api.listReports){ if(typeof toast === 'function') toast('아직 준비 중이에요'); return; }
  _reportClose();
  const { ov, body } = _reportBox('🚩 신고 목록', 460);
  body.textContent = '불러오는 중…';
  ov.addEventListener('mousedown', e=>{ if(e.target === ov) _reportClose(); });
  setReportEsc(e=>{ if(e.key === 'Escape'){ e.stopPropagation(); _reportClose(); } });
  document.addEventListener('keydown', _reportEsc(), true);
  document.body.appendChild(ov); setReportOv(ov);
  const res = await api.listReports();
  if(_reportOv() !== ov) return;
  if(!res || !res.ok){ body.textContent = '목록을 읽지 못했어요(관리자 로그인 확인).'; return; }
  const rows = _reportAdminRows(res.reports);
  body.textContent = '';
  const head = document.createElement('div'); head.style.cssText = 'font-size:10.5px;color:var(--ink-soft);margin-bottom:6px;';
  head.textContent = '서로 다른 ' + REPORT_ADMIN_MIN + '명 이상이 신고한 사람만 보여요 · ' + rows.length + '명';
  body.appendChild(head);
  if(!rows.length) return;
  const list = document.createElement('div');
  list.style.cssText = 'border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);background:#fff;';
  body.appendChild(list);
  const briefs = await Promise.all(rows.map(r=>api.getUserBrief ? api.getUserBrief(r.target).catch(()=>({})) : Promise.resolve({})));
  if(_reportOv() !== ov) return;
  rows.forEach((r, i)=>{
    const b = briefs[i] || {};
    const it = document.createElement('div'); it.style.cssText = 'display:flex;gap:8px;align-items:flex-start;padding:6px;border-bottom:1px solid #d4d0c8;';
    const th = document.createElement('div');
    th.style.cssText = 'width:48px;height:48px;flex:none;box-sizing:border-box;border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);'
      + 'background:#fff repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%) 0 0/8px 8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--ink-soft);';
    if(_awayUrlOk(b.awayImg)){ const im = document.createElement('img'); im.src = b.awayImg; im.alt = ''; im.style.cssText = 'max-width:100%;max-height:100%;'; th.appendChild(im); }
    else th.textContent = '그림 없음';
    const mid = document.createElement('div'); mid.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';
    const nm = document.createElement('div');
    const nb = document.createElement('b'); nb.textContent = b.name || '(이름 없음)'; nm.appendChild(nb);
    const cd = document.createElement('span'); cd.style.cssText = 'font-family:"Courier New",monospace;font-size:10.5px;margin-left:5px;'; cd.textContent = b.friendCode || r.target;
    nm.appendChild(cd); mid.appendChild(nm);
    const cnt = document.createElement('span'); cnt.style.cssText = 'color:#B22222;font-weight:bold;font-size:10.5px;'; cnt.textContent = '🚩 ' + r.recs.length + '명';
    mid.appendChild(cnt);
    r.recs.forEach(rc=>{
      const ln = document.createElement('div'); ln.style.cssText = 'font-size:10.5px;word-break:break-all;';
      ln.textContent = '· ' + (rc.nick || '(이름 없음)') + ' #' + (rc.code4 || '----') + ' — ' + _reportReasonText(rc);
      mid.appendChild(ln);
    });
    const act = document.createElement('div'); act.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:none;';
    const mkb = (t, red)=>{ const x = document.createElement('button'); x.className = 'lc-btn'; x.type = 'button'; x.textContent = t;
      x.style.cssText = 'width:auto;margin:0;padding:2px 7px;font-size:10.5px;' + (red ? 'color:#B22222;' : ''); act.appendChild(x); return x; };
    if(_awayUrlOk(b.awayImg)){
      const down = mkb('그림 내리기', true);
      down.onclick = async ()=>{
        down.disabled = true;
        const ok = await api.setAwayImg(r.target, null);
        if(ok && ok.ok){ try{ await api.deleteStorageUrl(b.awayImg); }catch(_){} th.textContent = '그림 없음'; down.remove(); if(typeof toast === 'function') toast('자리비움 그림을 내렸어요'); }
        else { down.disabled = false; if(typeof toast === 'function') toast('내리지 못했어요'); }
      };
    }
    const fine = mkb('문제없음', false);
    fine.onclick = async ()=>{
      fine.disabled = true;
      const ok = await api.clearReports(r.target);
      if(ok && ok.ok){ it.remove(); if(typeof toast === 'function') toast('신고를 비웠어요'); }
      else { fine.disabled = false; if(typeof toast === 'function') toast('비우지 못했어요'); }
    };
    it.appendChild(th); it.appendChild(mid); it.appendChild(act); list.appendChild(it);
  });
}
(function bindReportAdmin(){
  const b = document.getElementById('lcReportList');
  if(b) b.addEventListener('click', e=>{ e.stopPropagation(); _openReportAdmin(); });
})();

return { rows: _reportAdminRows };   // 검사용 — 목록 고르기(순수 함수)
}

const api = { createAdminReport };
if(typeof window !== 'undefined') window.TwAdminReport = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
