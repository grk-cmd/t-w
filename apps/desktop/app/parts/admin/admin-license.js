/* admin-license.js — 🎟️ 라이선스 키 발급 · 키 목록(검색 · 회수 · 삭제) · 대기 요청(발급 · 거절 · 일괄) · 친구코드로 발급 (관리자)
   원본은 서버다 — admin-api.js(adminApi)가 /v2/admin/licenses · /v2/admin/license-requests 를 부른다. 이 파일은 화면만.
   서버가 하는 일: 키 만들기 · 친구코드 → 사람 찾기 · 받는 사람 우편(«라이선스가 도착했어요») · 검색(q = 키 앞부분 · 메모 · 주인 친구코드) · 쪽 나누기 · «이미 유효한 키가 있나» 판정.
   앱이 하지 않는 것: 키 만들기(_genLicenseKey) · 우편 직접 쓰기 · 목록 통째 받아 거르기 · 대기 요청 실시간 구독(창을 열 때 받고 [새로 고침]).
   ★ 받은 답은 그 차례(gen)일 때만 그린다 — 검색을 바꾸거나 창을 다시 열면 옛 답은 버린다. 실패해도 혼자 다시 보내지 않는다(다시 누를 때만).
   ★ 키를 회수 · 삭제할 때는 읽은 판(version)을 싣는다 — 다른 곳에서 먼저 바꿨으면(409) 덮지 않고 목록을 다시 받아 «받아왔어요».
   ★ 밖에서 부르는 이름은 renderLicenseGenList 하나 — 📄 엑셀 일괄 발급(admin-license-bulk.js)이 발급 뒤 목록을 다시 받을 때 app.js 가 잇는다. 버튼 연결은 만들 때 건다.
   deps: toast · adminApi(admin-api.js) · apiErrors(TwApiErrors.store) · notifyError — 번호 알림(TwErrorCodes.notify)
   검사: checks/sim-admin-license.js
   ⚠️ document · window · confirm · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminLicense — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminLicense(deps){
const toast = deps.toast;
const adminApi = deps.adminApi;
const apiErrors = deps.apiErrors;
const notifyError = deps.notifyError;
const $ = (id) => document.getElementById(id);
const REFETCH_TEXT = '다른 곳에서 바꾼 내용을 받아왔어요';
const SEARCH_WAIT_MS = 300;   // 입력이 멈춘 뒤 서버에 묻는다(글자마다 묻지 않게)
const GRANT_CODE_RE = /^[A-Z0-9]{4}$/;

/* 실패 하나 알리기 — 이 기능 표 · 공통 표는 그대로, 그 밖은 onSite(그 자리 번호 알림). 갈래를 돌려준다 */
function fail(e, onSite){
  const kind = adminApi.failOf(e);
  if(kind === 'notice' || kind === 'common') apiErrors.notify(e, adminApi.ERRORS);
  else if(kind === 'site') onSite();
  return kind;
}
const mkBtn = (text, red) => { const b = document.createElement('button'); b.textContent = text;
  b.style.cssText = 'flex-shrink:0;padding:2px 8px;font-size:10.5px;cursor:pointer;' + (red ? 'color:var(--win-error);' : ''); return b; };

/* ── 발급된 키 목록 — 서버가 검색 · 쪽 나누기 ── */
let listGen = 0;
let listBusy = false;   // 더 보기 중
async function renderLicenseGenList(){
  const listEl = $('licenseGenList');
  if(!listEl) return;
  const g = ++listGen;
  listBusy = false;
  const q = (($('licenseGenSearch') && $('licenseGenSearch').value) || '').trim();
  listEl.textContent = '불러오는 중...';
  let page;
  try{ page = await adminApi.listLicenses({ q }); }
  catch(e){
    if(g !== listGen) return;
    fail(e, () => notifyError('E-ADM-20', e));
    listEl.textContent = '못 불러왔어요';
    const again = mkBtn('다시 시도'); again.style.marginLeft = '6px'; again.onclick = () => { renderLicenseGenList(); };
    listEl.appendChild(again);
    return;
  }
  if(g !== listGen) return;
  drawList(listEl, q, page, g);
}
function drawList(listEl, q, page, g){
  listEl.textContent = '';
  if(!page.items.length){ listEl.textContent = q ? '검색 결과가 없어요' : '아직 발급된 키가 없어요'; return; }
  const head = document.createElement('div'); head.style.cssText = 'font-size:10px;color:var(--ink-soft);margin-bottom:3px;';
  let shown = 0;
  const setHead = (next) => { head.textContent = (page.total !== null ? '총 ' + page.total + '개' : shown + '개' + (next ? ' 넘게' : '')); };
  listEl.appendChild(head);
  const rows = document.createElement('div'); listEl.appendChild(rows);
  const more = mkBtn('더 보기'); more.style.marginTop = '4px';
  const add = (p) => { p.items.forEach((d) => rows.appendChild(licenseRow(d))); shown += p.items.length; setHead(p.next); if(p.next){ more.onclick = () => loadMore(p.next); listEl.appendChild(more); } else if(more.parentNode) more.remove(); };
  async function loadMore(cursor){
    if(listBusy || g !== listGen) return;
    listBusy = true; more.disabled = true;
    let p2;
    try{ p2 = await adminApi.listLicenses({ q, cursor }); }
    catch(e){ if(g === listGen){ fail(e, () => notifyError('E-ADM-20', e)); more.disabled = false; } listBusy = false; return; }
    listBusy = false; more.disabled = false;
    if(g !== listGen) return;
    add(p2);
  }
  add(page);
}
function licenseRow(d){
  const row = document.createElement('div');
  row.style.cssText = 'padding:4px 0;border-bottom:1px solid rgba(201,165,123,.15);display:flex;justify-content:space-between;align-items:center;gap:6px;';
  const left = document.createElement('span'); left.style.cssText = "font-family:'Courier New',monospace;"; left.textContent = d.key;
  const right = document.createElement('span'); right.style.cssText = 'text-align:right;flex-shrink:0;display:flex;align-items:center;gap:6px;';
  const statusTxt = d.status === 'REVOKED' ? '🚫 회수됨' : (d.used ? '✅ 사용됨' : '⬜ 미사용');
  const info = document.createElement('span');
  info.textContent = statusTxt + (d.ownerName ? ' · ' + d.ownerName : '') + (d.note ? ' · ' + d.note : '');
  right.appendChild(info);
  const revoked = d.status === 'REVOKED';
  const btn = mkBtn(revoked ? '삭제' : '회수', true);
  btn.onclick = async () => {
    const ask = revoked ? d.key + ' 키를 목록에서 완전히 삭제할까요? (되돌릴 수 없어요)' : d.key + ' 키를 회수할까요? 이 키를 쓰던 사람은 다음 접속 시 라이선스가 풀려요.';
    if(!confirm(ask)){ window.focus(); return; } window.focus();
    btn.disabled = true; btn.textContent = revoked ? '삭제 중...' : '회수 중...';
    try{
      if(revoked) await adminApi.deleteLicense(d.id, d.version); else await adminApi.revokeLicense(d.id, d.version);
      toast(revoked ? '삭제했어요' : '회수했어요');
      renderLicenseGenList();
    }catch(e){
      const kind = fail(e, () => notifyError('E-ADM-22', e));
      if(kind === 'refetch'){ toast(REFETCH_TEXT); renderLicenseGenList(); return; }
      btn.disabled = false; btn.textContent = revoked ? '삭제' : '회수';
    }
  };
  right.appendChild(btn);
  row.appendChild(left); row.appendChild(right);
  return row;
}

$('lcLicenseGen').onclick = () => {
  const o = $('licenseGenOverlay'); o.classList.add('on'); o.style.display = 'flex';
  window._lxHideWin();   // 일괄 창만 보이던 채로 닫혔어도 발급 창부터 연다
  $('licenseGenResult').style.display = 'none';
  $('licenseGenNote').value = '';
  renderLicenseGenList();
  loadRequests();
};

/* ── 대기 중인 라이선스 요청 — 창을 열 때 받고 [새로 고침] (서버 신호가 없다 · 주기로 받지 않는다) ── */
let reqGen = 0;
let reqBusy = false;     // 승인 · 거절 · 일괄 처리 중 — 한 번에 하나
let reqPending = [];     // 지금 화면에 있는 대기 요청 [{ id, name }] — 일괄 처리가 부른다
async function loadRequests(){
  const listEl = $('licenseReqList'); if(!listEl) return;
  const g = ++reqGen;
  listEl.textContent = '불러오는 중...';
  let page;
  try{ page = await adminApi.pendingRequests(null); }
  catch(e){
    if(g !== reqGen) return;
    fail(e, () => notifyError('E-ADM-23', e));
    reqPending = [];
    const bb = $('licenseBulkBtn'); if(bb) bb.style.display = 'none';
    listEl.textContent = '못 불러왔어요';
    const again = mkBtn('다시 시도'); again.style.marginLeft = '6px'; again.onclick = () => { loadRequests(); };
    listEl.appendChild(again);
    return;
  }
  if(g !== reqGen) return;
  drawRequests(listEl, page);
}
function drawRequests(listEl, page){
  reqPending = page.items.map((r) => ({ id: r.id, name: r.name || '' }));
  const bulkBtn = $('licenseBulkBtn');
  if(bulkBtn) bulkBtn.style.display = reqPending.length >= 2 ? 'inline-block' : 'none';   // 2건 이상일 때만 노출
  if(!page.items.length){ listEl.textContent = '대기 중인 요청이 없어요'; return; }
  listEl.textContent = '';
  page.items.forEach((req) => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:5px 0;border-bottom:1px solid rgba(201,165,123,.15);display:flex;justify-content:space-between;align-items:center;gap:6px;';
    const who = document.createElement('span'); who.textContent = '🙋 '; const b = document.createElement('b'); b.textContent = req.name || '(이름 없음)'; who.appendChild(b);
    const ok = mkBtn('발급'); ok.style.padding = '3px 10px'; ok.style.fontSize = '11px';
    const no = mkBtn('거절', true); no.style.padding = '3px 10px'; no.style.fontSize = '11px';
    ok.onclick = async () => {
      if(reqBusy) return; reqBusy = true; ok.disabled = true; no.disabled = true; ok.textContent = '발급 중...';
      try{ await adminApi.approveRequest(req.id); toast((req.name || '요청') + ' 님에게 발급했어요'); renderLicenseGenList(); loadRequests(); }
      catch(e){ const kind = fail(e, () => notifyError('E-ADM-24', e)); if(kind === 'refetch'){ toast(REFETCH_TEXT); loadRequests(); } else { ok.disabled = false; no.disabled = false; ok.textContent = '발급'; } }
      finally{ reqBusy = false; }
    };
    no.onclick = async () => {
      if(reqBusy) return;
      if(!confirm((req.name || '요청') + ' 님의 요청을 거절할까요? (거절해도 상대는 다시 요청할 수 있어요)')){ window.focus(); return; } window.focus();
      reqBusy = true; ok.disabled = true; no.disabled = true; no.textContent = '거절 중...';
      try{ await adminApi.rejectRequest(req.id); toast((req.name || '요청') + ' 님의 요청을 거절했어요'); loadRequests(); }
      catch(e){ const kind = fail(e, () => notifyError('E-ADM-24', e)); if(kind === 'refetch'){ toast(REFETCH_TEXT); loadRequests(); } else { ok.disabled = false; no.disabled = false; no.textContent = '거절'; } }
      finally{ reqBusy = false; }
    };
    row.appendChild(who); row.appendChild(ok); row.appendChild(no);
    listEl.appendChild(row);
  });
  if(page.next){
    const more = document.createElement('div'); more.style.cssText = 'font-size:10px;color:var(--ink-soft);padding-top:4px;';
    more.textContent = '앞 ' + page.items.length + '건만 보여요 — 처리한 뒤 [새로 고침] 으로 다음 건을 봐요';
    listEl.appendChild(more);
  }
}
{ const rf = $('licenseReqRefresh'); if(rf) rf.addEventListener('click', () => { loadRequests(); }); }
$('licenseGenClose').onclick = () => {
  const o = $('licenseGenOverlay'); o.classList.remove('on'); o.style.display = 'none';
};
/* 🔍 발급된 키 검색 — 입력이 멈추면 서버에 묻는다(받아 둔 목록을 앱이 거르지 않는다) */
{ let t = null;
  const s = $('licenseGenSearch');
  if(s) s.addEventListener('input', () => { if(t) clearTimeout(t); t = setTimeout(() => { t = null; renderLicenseGenList(); }, SEARCH_WAIT_MS); }); }
/* 📦 대기 요청 전체 일괄 발급 — 화면에 있는 요청을 한 번에 승인(서버가 요청마다 따로 처리해 줄마다 결과를 준다) */
{ const bb = $('licenseBulkBtn');
  if(bb) bb.addEventListener('click', async () => {
    if(reqBusy) return;
    const ids = reqPending.map((r) => r.id);
    if(!ids.length) return;
    if(!confirm('대기 중인 요청 ' + ids.length + '건에 전부 키를 발급할까요?')){ window.focus(); return; } window.focus();
    reqBusy = true; bb.disabled = true; bb.textContent = '발급 중...';
    try{
      const res = await adminApi.approveRequests(ids);
      const okN = res.filter((r) => r.ok).length, failN = res.length - okN;
      toast('일괄 발급 완료 — 성공 ' + okN + '건' + (failN ? ', 실패 ' + failN + '건' : ''));
      renderLicenseGenList(); loadRequests();
    }catch(e){ fail(e, () => notifyError('E-ADM-24', e)); }
    finally{ reqBusy = false; bb.disabled = false; bb.textContent = '전체 일괄 발급'; }
  }); }

/* ── 새 키 한 장(메모만) ── */
{ const btn = $('licenseGenBtn');
  let busy = false;
  btn.onclick = async () => {
    if(busy) return;
    const note = $('licenseGenNote').value.trim();
    busy = true; btn.disabled = true; btn.textContent = '발급 중...';
    try{
      const items = await adminApi.issueLicenses([note ? { note } : {}], false);
      const it = items[0];
      if(!it.ok || !it.key){ notifyError('E-ADM-21', Object.assign(new Error(it.code || 'ISSUE_FAILED'), { code: it.code || 'ISSUE_FAILED' })); }
      else{
        $('licenseGenKeyText').textContent = it.key;
        $('licenseGenResult').style.display = 'block';
        renderLicenseGenList();
      }
    }catch(e){ fail(e, () => notifyError('E-ADM-21', e)); }
    finally{ busy = false; btn.disabled = false; btn.textContent = '새 키 발급'; }
  };
}
$('licenseGenCopyBtn').onclick = () => {
  const text = $('licenseGenKeyText').textContent;
  try{ navigator.clipboard.writeText(text); toast('복사됐어요'); }
  catch(e){ toast('복사 실패 — 직접 드래그해서 복사해 주세요'); }
};

/* ★ 친구코드로 라이선스 발급 — 서버가 코드 보유자를 찾아 키를 만들고 그 사람 수령함(보상)으로 보낸다.
   뒷 4자리만 입력하면 MATE- · COZY- 순으로 차례로 묻는다(없는 사람이면 다음 접두어). */
(function bindLicenseGrantByCode(){
  const btn = $('licenseGrantBtn');
  const codeInp = $('licenseGrantCode');
  const msgEl = $('licenseGrantMsg');
  if(!btn || !codeInp) return;
  const showMsg = (text, isErr) => {
    if(!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    msgEl.style.display = text ? 'block' : 'none';
  };
  let busy = false;
  const submit = async () => {
    if(busy) return;
    const code = (codeInp.value || '').trim().toUpperCase();
    if(!code){ showMsg('친구코드를 입력해 주세요', true); return; }
    const candidates = GRANT_CODE_RE.test(code) ? ['MATE-' + code, 'COZY-' + code] : [code];
    busy = true; btn.disabled = true; showMsg('확인 중…', false);
    try{
      let reissue = false;
      for(let i = 0; i < candidates.length; i++){
        let it;
        try{ it = (await adminApi.issueLicenses([{ friendCode: candidates[i] }], reissue))[0]; }
        catch(e){ showMsg('', false); fail(e, () => notifyError('E-ADM-21', e)); return; }
        if(it.ok){
          showMsg('발급 완료 — 해당 유저 수령함(보상)으로 보냈어요', false);
          codeInp.value = '';
          renderLicenseGenList();
          toast('📮 라이선스를 ' + (it.friendCode || candidates[i]) + ' 유저에게 발급했어요');
          return;
        }
        if(it.code === 'USER_NOT_FOUND'){
          if(i < candidates.length - 1) continue;
          showMsg('해당 친구코드를 가진 유저를 찾을 수 없어요', true); return;
        }
        if(it.code === 'LICENSE_ALREADY_HAVE'){
          if(reissue){ showMsg('이미 유효한 라이선스가 있는 계정이에요', true); return; }
          if(!confirm(candidates[i] + ' 유저는 이미 유효한 라이선스가 있어요. 한 장 더 발급할까요?')){ window.focus(); showMsg('이미 유효한 라이선스가 있는 계정이라 발급하지 않았어요', true); return; }
          window.focus();
          reissue = true; i--; continue;   // 같은 코드로 다시(이번에는 한 장 더)
        }
        showMsg('', false); notifyError('E-ADM-21', Object.assign(new Error(it.code || 'ISSUE_FAILED'), { code: it.code || 'ISSUE_FAILED' })); return;
      }
    }finally{ busy = false; btn.disabled = false; }
  };
  btn.addEventListener('click', submit);
  codeInp.addEventListener('keydown', (e) => { if(e.key === 'Enter') submit(); });
})();

return { renderLicenseGenList };   // 📄 엑셀 일괄 발급이 발급 뒤 목록을 다시 받을 때
}

const api = { createAdminLicense };
if(typeof window !== 'undefined') window.TwAdminLicense = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
