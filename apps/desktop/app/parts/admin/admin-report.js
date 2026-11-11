/* admin-report.js — 🚩 신고 목록 (관리자 — 서로 다른 ADMIN_MIN 명 이상에게 신고된 사람 · 그림 내리기 · 문제없음)
   ★ 목록 · 문제없음 · 그림 내리기는 서버 길(support/report-api.js 의 createAdminReportApi — /v1/admin/reports*) 하나로 한다.
     «서로 다른 3명 이상» 거르기 · 이름 · 그림 붙이기 · 그림 칸과 파일 지우기는 서버가 한다. 이 파일은 화면만.
   ★ 팝업 칸(_reportOv · _reportEsc)은 신고 창(report.js)과 함께 쓰는 «한 번에 하나만 열리는 자리»라 그쪽이 가지고, 여기서는 읽는 · 쓰는 함수로만 만진다.
     창 틀 · 닫기 · 신고 종류 · 기준 인원도 report.js 가 내놓은 것을 app.js 가 넘긴다.
   ★ 받은 답은 그 창 · 그 차례(gen)일 때만 그린다 — 닫은 창 · 다시 받은 뒤의 옛 답은 버린다.
   ⚠️ 실패해도 다시 보내지 않는다 — [다시 시도] · 버튼을 관리자가 다시 누를 때만.
   ⚠️ 그림 주소는 서버가 준 것이라도 _awayUrlOk(우리 Storage 주소)일 때만 그리고 [그림 내리기]를 켠다.
   ⚠️ 전역 이름은 TwAdminReport — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-report.js · checks/sim-report-away.js */
(function(){

const IMAGE_CHANGED_TEXT = '그 사이 그림이 바뀌었어요 — 다시 확인해 주세요';
const EMPTY_TEXT = '확인할 신고가 없어요';
const LOAD_FAIL_TEXT = '못 불러왔어요';

/** @param {{ toast: Function, awayUrlOk: (u: any) => boolean, isAdmin: () => boolean, reportClose: Function, reportBox: Function,
 *   kinds: Array<{k: string, short: string}>, adminMin: number, reportOv: Function, setReportOv: Function, reportEsc: Function, setReportEsc: Function,
 *   adminApi: { page: Function, dismiss: Function, takeDown: Function, failOf: Function }, apiErrors: { notify: Function }, notifyError: Function }} deps */
function createAdminReport(deps){
const toast = deps.toast;
const _awayUrlOk = deps.awayUrlOk;
const isAdmin = deps.isAdmin;                    // 읽는 함수 — 관리자 모드(app.js 의 let)
const _reportClose = deps.reportClose;           // report.js — 창 닫기
const _reportBox = deps.reportBox;               // report.js — 창 틀
const REPORT_KINDS = deps.kinds;                 // report.js — 신고 종류
const REPORT_ADMIN_MIN = deps.adminMin;          // report.js — 안내 문구의 기준 인원(서버 기본과 같다)
const _reportOv = deps.reportOv, setReportOv = deps.setReportOv;     // 팝업 칸(report.js 가 가짐)
const _reportEsc = deps.reportEsc, setReportEsc = deps.setReportEsc;
const adminApi = deps.adminApi;                  // 🌐 관리자 신고 목록 길(TwReportApi.createAdminReportApi)
const apiErrors = deps.apiErrors;                // 🧭 공통 code → 할 일 · 번호(TwApiErrors.store)
const notifyError = deps.notifyError;            // 실패 번호 토스트(TwErrorCodes.notify)

/* 실패 하나 알리기 — 공통 code 는 공통 표, 그 밖은 그 자리 번호(site). 갈래를 돌려준다 */
function _fail(e, site){
  const kind = adminApi.failOf(e);
  if(kind === 'common') apiErrors.notify(e);
  else if(kind === 'site') site(e);
  return kind;
}
function _reportReasonText(r){
  const kd = REPORT_KINDS.find(x=>x.k === r.kind);
  const base = kd ? kd.short : '기타';
  return (r.kind === 'etc' && r.note) ? base + ' · ' + r.note : base;
}
const _code4 = (c)=>c ? String(c).slice(-4) : '----';

async function _openReportAdmin(){
  if(!isAdmin()) return;
  _reportClose();
  const { ov, body } = _reportBox('🚩 신고 목록', 460);
  ov.addEventListener('mousedown', e=>{ if(e.target === ov) _reportClose(); });
  setReportEsc(e=>{ if(e.key === 'Escape'){ e.stopPropagation(); _reportClose(); } });
  document.addEventListener('keydown', _reportEsc(), true);
  document.body.appendChild(ov); setReportOv(ov);
  let gen = 0;
  const live = (g)=>_reportOv() === ov && g === gen;

  const mkBtn = (parent, t, red)=>{ const x = document.createElement('button'); x.className = 'lc-btn'; x.type = 'button'; x.textContent = t;
    x.style.cssText = 'width:auto;margin:0;padding:2px 7px;font-size:10.5px;' + (red ? 'color:#B22222;' : ''); parent.appendChild(x); return x; };

  /* 한 줄 — 서버 줄 하나(report-api.js targetOf 모양) */
  function drawRow(list, r){
    const it = document.createElement('div'); it.style.cssText = 'display:flex;gap:8px;align-items:flex-start;padding:6px;border-bottom:1px solid #d4d0c8;';
    const th = document.createElement('div');
    th.style.cssText = 'width:48px;height:48px;flex:none;box-sizing:border-box;border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);'
      + 'background:#fff repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%) 0 0/8px 8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--ink-soft);';
    const hasImg = _awayUrlOk(r.awayImg);
    if(hasImg){ const im = document.createElement('img'); im.src = TwSafeHtml.safeUrl(r.awayImg, 'image'); im.alt = ''; im.style.cssText = 'max-width:100%;max-height:100%;'; th.appendChild(im); }
    else th.textContent = '그림 없음';
    const mid = document.createElement('div'); mid.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';
    const nm = document.createElement('div');
    const nb = document.createElement('b'); nb.textContent = r.name || '(이름 없음)'; nm.appendChild(nb);
    const cd = document.createElement('span'); cd.style.cssText = 'font-family:"Courier New",monospace;font-size:10.5px;margin-left:5px;'; cd.textContent = r.target;
    nm.appendChild(cd); mid.appendChild(nm);
    const cnt = document.createElement('span'); cnt.style.cssText = 'color:#B22222;font-weight:bold;font-size:10.5px;'; cnt.textContent = '🚩 ' + r.count + '명';
    mid.appendChild(cnt);
    r.reporters.forEach(rc=>{
      const ln = document.createElement('div'); ln.style.cssText = 'font-size:10.5px;word-break:break-all;';
      ln.textContent = '· ' + (rc.name || '(이름 없음)') + ' #' + _code4(rc.code) + ' — ' + _reportReasonText(rc);
      mid.appendChild(ln);
    });
    const act = document.createElement('div'); act.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:none;';
    if(hasImg){
      const down = mkBtn(act, '그림 내리기', true);
      down.onclick = async ()=>{
        if(down.disabled) return;
        down.disabled = true;
        const g = gen;
        try{ await adminApi.takeDown(r.target, r.awayImg); }
        catch(e){
          if(!live(g)) return;
          if(_fail(e, (x)=>notifyError('E-ADM-32', x)) === 'imageChanged'){ toast(IMAGE_CHANGED_TEXT); load(); return; }
          down.disabled = false;
          return;
        }
        if(!live(g)) return;
        th.textContent = '그림 없음'; down.remove(); toast('자리비움 그림을 내렸어요');
      };
    }
    const fine = mkBtn(act, '문제없음', false);
    fine.onclick = async ()=>{
      if(fine.disabled) return;
      fine.disabled = true;
      const g = gen;
      try{ await adminApi.dismiss(r.target); }
      catch(e){
        if(!live(g)) return;
        _fail(e, (x)=>notifyError('E-ADM-31', x));
        fine.disabled = false;
        return;
      }
      if(!live(g)) return;
      it.remove(); toast('신고를 비웠어요');
    };
    it.appendChild(th); it.appendChild(mid); it.appendChild(act); list.appendChild(it);
  }

  /* 첫 쪽부터 다시 받기 — 열 때 · [다시 시도] · 그 사이 그림이 바뀌었을 때 */
  async function load(){
    const g = ++gen;
    body.textContent = '불러오는 중…';
    let pg;
    try{ pg = await adminApi.page(null); }
    catch(e){
      if(!live(g)) return;
      _fail(e, (x)=>notifyError('E-ADM-30', x));
      body.textContent = '';
      const msg = document.createElement('div'); msg.style.cssText = 'font-size:10.5px;color:var(--ink-soft);margin-bottom:6px;'; msg.textContent = LOAD_FAIL_TEXT;
      body.appendChild(msg);
      const again = mkBtn(body, '다시 시도', false);
      again.onclick = ()=>{ load(); };
      return;
    }
    if(!live(g)) return;
    body.textContent = '';
    let shown = 0, next = null;
    const head = document.createElement('div'); head.style.cssText = 'font-size:10.5px;color:var(--ink-soft);margin-bottom:6px;';
    const setHead = ()=>{ head.textContent = '서로 다른 ' + REPORT_ADMIN_MIN + '명 이상이 신고한 사람만 보여요 · ' + shown + '명' + (next ? ' 넘게' : ''); };
    body.appendChild(head);
    if(!pg.items.length){
      setHead();
      const empty = document.createElement('div'); empty.style.cssText = 'font-size:10.5px;color:var(--ink-soft);'; empty.textContent = EMPTY_TEXT;
      body.appendChild(empty);
      return;
    }
    const list = document.createElement('div');
    list.style.cssText = 'border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);background:#fff;';
    body.appendChild(list);
    const more = mkBtn(body, '더 보기', false);
    more.style.marginTop = '6px';
    const add = (p)=>{ p.items.forEach(r=>drawRow(list, r)); shown += p.items.length; next = p.next; setHead(); if(!next) more.remove(); };
    more.onclick = async ()=>{
      if(more.disabled || !next) return;
      more.disabled = true;
      let p2;
      try{ p2 = await adminApi.page(next); }
      catch(e){
        if(!live(g)) return;
        _fail(e, (x)=>notifyError('E-ADM-30', x));
        more.disabled = false;
        return;
      }
      if(!live(g)) return;
      more.disabled = false;
      add(p2);
    };
    add(pg);
  }
  await load();
}
(function bindReportAdmin(){
  const b = document.getElementById('lcReportList');
  if(b) b.addEventListener('click', e=>{ e.stopPropagation(); _openReportAdmin(); });
})();

return {};
}

const api = { createAdminReport };
if(typeof window !== 'undefined') window.TwAdminReport = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
