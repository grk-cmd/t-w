/* ═══ 🎟️ sim-admin-license.js — 관리자 3번 모듈 셋 (2026-10-14 신설 · 관리자 코드 admin 폴더 3번) ═══════════════
   app.js «🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자)» · «관리자 카테고리 관리» 의 관리자 몫을 parts/admin/ 세 파일로 옮겼다.
     admin-license.js(키 발급 · 목록 · 대기 요청 · 친구코드로 발급) · admin-category.js(📁 카테고리)
     (📣 확성기 · 📰 업데이트 공지 편집 admin-notice.js 는 서버 길로 옮겨 sim-admin-notice.js 가 본다)
   동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
   ・1절: 만들 때 — 버튼을 한 번씩 건다 · 돌려주는 이름 · 서버는 안 부른다
   ・2절: 라이선스(서버 길 · D11-3) — 목록(서버 검색 · 쪽 · 총 수) · 회수 · 삭제(licenseId + version · 409 다시 받기) · 대기 요청(받기 · 발급 · 일괄) · 새 키 · 친구코드로 발급(MATE · COZY 차례 · 이미 있음 → 한 장 더) · 옛 답 버림 · 못 받음 번호
   ・4절: 카테고리 — 읽는 함수로 받은 목록(다시 대입된 뒤)을 그린다 · 이름 바꾸기 · 되돌리기 · 추가 · 삭제는 서버 카탈로그(catalogAdmin) · 덮어쓴 이름만 ↺
   ・5절: app.js 연결 — 본문이 안 남음 · 빈 껍데기 셋 · 원래 자리 · deps · 바깥에서 부르던 곳(adminCategory · adminLicense) · 사용자 쪽 팝업은 app.js 에 · html 순서
   ・6절: 일부러 깨 보기 — 모듈 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · admin-license.js · admin-notice.js · admin-category.js 가 있는 폴더에서
     (러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const part = (n) => [n, 'parts/admin/' + n, 'app/parts/admin/' + n].map(read).find(Boolean);
const M = { lic: part('admin-license.js'), cat: part('admin-category.js') };
for(const [k, n] of [['lic', 'admin-license.js'], ['cat', 'admin-category.js']])
  if(!M[k]){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

/* ── 가짜 DOM ── */
function makeDom(){
  const els = {};
  const mk = (tag) => {
    const e = { tagName: tag, id: '', style: {}, value: '', checked: false, disabled: false, _text: '', _html: '', title: '', parentNode: null,
      get textContent(){ return this._text; }, set textContent(v){ this._text = String(v); this.children = []; }, remove(){ this.parentNode = null; },
      children: [], _on: {}, onclick: null, files: null,
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
      get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = String(v); this.children = []; },
      appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
      addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); },
      focus(){}, click(){ if(this.onclick) return this.onclick(); },
      fire(t, ev){ return Promise.all((this._on[t] || []).map(f => f(ev || {}))); } };
    return e;
  };
  const document = { addEventListener(t, f){ (this._h = this._h || {})[t] = ((this._h[t]) || []).concat(f); }, dispatchEvent(e){ ((this._h || {})[e.type] || []).forEach(f => f(e)); }, getElementById: (id) => els[id] || (els[id] = Object.assign(mk('div'), { id })), createElement: mk };
  /* 아직 안 부른 id 도 꺼내 볼 수 있게 — 처음 읽을 때 만든다(getElementById 와 같은 칸) */
  return { els: new Proxy(els, { get: (o, id) => document.getElementById(id) }), document };
}
/* 모듈 하나를 만든다 — calls 에 서버 호출을 적는다 */
function build(src, glob, create, deps, fbOver){
  const calls = [], toasts = [];
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  const fb = Object.assign({
    listLicenses: rec('listLicenses', { 'AAAA-1': { note: '콩떡 · 친구코드 MATE-9K2M' }, 'BBBB-2': { note: '엑셀', valid: false } }),
    subscribeLicenseRequests: (cb) => { calls.push(['subscribeLicenseRequests']); fb._reqCb = cb; },
    approveLicenseRequest: rec('approveLicenseRequest'), rejectLicenseRequest: rec('rejectLicenseRequest'),
    createLicense: rec('createLicense'), revokeLicense: rec('revokeLicense'), deleteLicense: rec('deleteLicense'),
    lookupFriendCode: rec('lookupFriendCode', (c) => c === 'COZY-4HTR' ? 'u123' : null),
    getUserNameById: rec('getUserNameById', '말랑'), sendInboxMessage: rec('sendInboxMessage', { ok: true }),
  }, fbOver || {});
  const D = makeDom();
  const win = { firebaseAPI: fb, focus(){} };
  const nav = { clipboard: { writeText(){} } };
  const api = new Function('window', 'document', 'firebaseAPI', 'confirm', 'navigator', 'setTimeout', 'module', 'var TwNav = { ADMIN_EXIT_EVENT: "tw-admin-exit" };\n' + src + '\nreturn window.' + glob + ';')(
    win, D.document, fb, () => true, nav, (f) => f(), undefined);
  const out = api[create](Object.assign({ toast: (m) => toasts.push(m) }, deps));
  return { win, calls, toasts, out, els: D.els, fb };
}
const flush = () => new Promise(r => setImmediate(r));
/* 서버 길 가짜 — 부른 것(calls) · 답은 st 가 정한다 */
function mkApi(st){
  const calls = [], shown = [];
  const rec = (n, f) => async (...a) => { calls.push([n, ...a]); return f ? f(...a) : undefined; };
  const item = (id, key, o) => Object.assign({ id, key, status: 'VALID', used: false, note: null, ownerName: null, ownerCode: null, version: 3 }, o || {});
  const api = { calls, shown,
    listLicenses: rec('listLicenses', (o) => { if(st.listHold) return st.listHold.then(() => st.list({ q: 'old' })); return st.list(o); }),
    issueLicenses: rec('issueLicenses', (g, r) => st.issue(g, r)),
    revokeLicense: rec('revokeLicense', () => { if(st.writeErr) throw st.writeErr; }), deleteLicense: rec('deleteLicense', () => { if(st.writeErr) throw st.writeErr; }),
    pendingRequests: rec('pendingRequests', () => st.pending), approveRequest: rec('approveRequest', () => { if(st.writeErr) throw st.writeErr; }),
    rejectRequest: rec('rejectRequest'), approveRequests: rec('approveRequests', (ids) => ids.map(id => ({ id, ok: true, code: null }))),
    failOf: (e) => (e && e.kind) || 'site', ERRORS: { MARK: 1 }, item };
  api.notifyFail = (e, errs, onSite) => { const k = api.failOf(e); if(k === 'notice' || k === 'common') errs.notify(e, api.ERRORS); else if(k === 'site') onSite(); return k; };
  return api;
}
const LIC_DEPS = (api) => ({ adminApi: api, apiErrors: { notify: (e, t) => api.shown.push(['notify', e && e.code, t && t.MARK]) }, notifyError: (c, e) => api.shown.push(['num', c, e && e.code]) });

async function judgeAll(m, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* ── 1 · 2. 라이선스 ── */
  const lst = { list: (o) => ({ items: o && o.q ? [api.item('i1', 'AAAA-1', { note: '콩떡' })] : [api.item('i1', 'AAAA-1', { note: '콩떡', used: true, ownerName: '말랑' }), api.item('i2', 'BBBB-2', { status: 'REVOKED' })], next: null, total: o && o.q ? 1 : 2 }),
    pending: { items: [{ id: 'r1', name: '<b>나쁜</b>', userCode: 'u1' }, { id: 'r2', name: '둘째', userCode: 'u2' }], next: null }, issue: () => [{ friendCode: null, ok: true, code: null, id: 'x', key: 'KEY-NEW' }] };
  const api = mkApi(lst);
  let L;
  try{ L = build(m.lic, 'TwAdminLicense', 'createAdminLicense', LIC_DEPS(api)); }catch(e){ t(false, '라이선스 모듈을 만들 수 없다 — ' + e.message); }
  if(L){
    const e = L.els;
    t(typeof e.lcLicenseGen.onclick === 'function' && typeof e.licenseGenClose.onclick === 'function' && typeof e.licenseGenBtn.onclick === 'function'
      && typeof e.licenseGenCopyBtn.onclick === 'function' && (e.licenseGenSearch._on.input || []).length === 1 && (e.licenseBulkBtn._on.click || []).length === 1
      && (e.licenseReqRefresh._on.click || []).length === 1 && (e.licenseGrantBtn._on.click || []).length === 1 && (e.licenseGrantCode._on.keydown || []).length === 1, '라이선스 — 만들 때 버튼 아홉을 한 번씩 건다');
    t(L.out && Object.keys(L.out).join() === 'renderLicenseGenList' && typeof L.out.renderLicenseGenList === 'function', '라이선스 — 돌려주는 이름은 renderLicenseGenList 하나');
    t(api.calls.length === 0, '라이선스 — 만들 때는 서버를 안 부른다');
    let hid = 0; L.win._lxHideWin = () => hid++;
    await e.lcLicenseGen.onclick(); await flush();
    t(e.licenseGenOverlay.classList.contains('on') && hid === 1 && api.calls.some(c => c[0] === 'listLicenses' && c[1].q === '') && api.calls.some(c => c[0] === 'pendingRequests' && c[1] === null),
      '발급 창 열기 — 창을 켜고 · 일괄 창을 숨기고 · 키 목록 첫 쪽 · 대기 요청을 받는다(구독 없음)');
    const rows = e.licenseGenList.children[1].children;
    t(rows.length === 2 && e.licenseGenList.children[0].textContent === '총 2개', '키 목록 — 서버가 준 두 줄 · 총 수는 서버 값');
    e.licenseGenSearch.value = '콩떡'; await e.licenseGenSearch.fire('input'); await flush();
    t(api.calls.some(c => c[0] === 'listLicenses' && c[1].q === '콩떡') && e.licenseGenList.children[1].children.length === 1, '키 목록 검색 — 서버에 q 로 묻는다(받아 둔 목록을 앱이 거르지 않음)');
    e.licenseGenSearch.value = ''; await e.licenseGenSearch.fire('input'); await flush();
    const rr = e.licenseReqList.children;
    t(rr.length === 2 && rr[0].children[0].children[0].textContent === '<b>나쁜</b>' && !/<b>/.test(rr[0].innerHTML), '대기 요청 — 서버 줄 그대로 · 이름은 글자로만 넣는다(HTML 로 안 읽음)');
    api.shown.length = 0;
    await rr[0].children[1].onclick(); await flush();
    t(api.calls.some(c => c[0] === 'approveRequest' && c[1] === 'r1') && L.toasts.some(x => /발급했어요/.test(x)), '대기 요청 발급 — approveRequest(id) 한 번(키 만들기 · 우편은 서버)');
    await e.licenseBulkBtn.fire('click'); await flush();
    t(api.calls.some(c => c[0] === 'approveRequests' && c[1].join() === 'r1,r2'), '전체 일괄 발급 — 화면의 요청 번호를 한 번에 서버로');
    /* 회수 · 삭제 — 판 */
    await e.lcLicenseGen.onclick(); await flush();
    const first = e.licenseGenList.children[1].children[0];
    await first.children[1].children[1].onclick(); await flush();
    t(api.calls.some(c => c[0] === 'revokeLicense' && c[1] === 'i1' && c[2] === 3), '회수 — licenseId + 읽은 판(version)을 싣는다(키 원문 아님)');
    const second = e.licenseGenList.children[1].children[1];
    await second.children[1].children[1].onclick(); await flush();
    t(api.calls.some(c => c[0] === 'deleteLicense' && c[1] === 'i2' && c[2] === 3), '삭제 — 회수된 키만 · licenseId + version');
    lst.writeErr = Object.assign(new Error('c'), { code: 'CONCURRENT_UPDATE', kind: 'refetch' }); api.shown.length = 0; const nList = api.calls.filter(c => c[0] === 'listLicenses').length; const nT = L.toasts.length;
    await e.licenseGenList.children[1].children[0].children[1].children[1].onclick(); await flush();
    t(api.calls.filter(c => c[0] === 'listLicenses').length === nList + 1 && L.toasts.slice(nT).join() === '다른 곳에서 바꾼 내용을 받아왔어요' && !api.shown.length, '다른 곳에서 먼저 바꿨으면(409) — 덮지 않고 목록을 다시 받아 «받아왔어요»(번호 없음)');
    lst.writeErr = null;
    /* 옛 답 버림 */
    let rel; lst.listHold = new Promise(r => { rel = r; });
    const old = L.out.renderLicenseGenList(); lst.listHold = null;
    await L.out.renderLicenseGenList(); rel(); await old; await flush();
    t(e.licenseGenList.children[1].children.length === 2, '목록을 다시 받는 사이 늦게 온 옛 답은 화면을 덮지 않는다(gen)');
    /* 목록 못 받음 */
    lst.list = () => { throw Object.assign(new Error('x'), { code: 'NETWORK' }); }; api.shown.length = 0;
    await L.out.renderLicenseGenList();
    t(api.shown.some(x => x[0] === 'num' && x[1] === 'E-ADM-20') && /못 불러왔어요/.test(e.licenseGenList.textContent) && e.licenseGenList.children.length === 1, '목록 못 받음 — 오류 번호 + «못 불러왔어요 [다시 시도]»(빈 목록으로 보이지 않는다)');
    /* 새 키 한 장 */
    e.licenseGenNote.value = '메모'; await e.licenseGenBtn.onclick(); await flush();
    t(api.calls.some(c => c[0] === 'issueLicenses' && c[1].length === 1 && c[1][0].note === '메모' && c[2] === false) && e.licenseGenKeyText.textContent === 'KEY-NEW' && e.licenseGenResult.style.display === 'block', '새 키 — 서버가 만든 키를 보여 준다(앱이 만들지 않는다)');
    /* 친구코드로 발급 */
    const seq = [[{ friendCode: 'MATE-4HTR', ok: false, code: 'USER_NOT_FOUND' }], [{ friendCode: 'COZY-4HTR', ok: true, code: null, key: 'K' }]];
    lst.issue = () => seq.shift(); api.calls.length = 0;
    e.licenseGrantCode.value = '4htr';
    await e.licenseGrantBtn.fire('click');
    const ic = api.calls.filter(c => c[0] === 'issueLicenses');
    t(ic.length === 2 && ic[0][1][0].friendCode === 'MATE-4HTR' && ic[1][1][0].friendCode === 'COZY-4HTR' && ic[0][2] === false && /발급 완료/.test(e.licenseGrantMsg.textContent), '친구코드로 발급 — 뒷 4자리 → MATE · COZY 차례로 서버에(없는 사람이면 다음 접두어) · 우편은 서버');
    lst.issue = () => [{ friendCode: 'MATE-9K2M', ok: false, code: 'LICENSE_ALREADY_HAVE' }]; api.calls.length = 0;
    let n = 0; lst.issue = (g, rs) => { n++; return rs ? [{ friendCode: 'MATE-9K2M', ok: true, code: null, key: 'K2' }] : [{ friendCode: 'MATE-9K2M', ok: false, code: 'LICENSE_ALREADY_HAVE' }]; };
    e.licenseGrantCode.value = 'MATE-9K2M'; await e.licenseGrantBtn.fire('click');
    const i2 = api.calls.filter(c => c[0] === 'issueLicenses');
    t(i2.length === 2 && i2[0][2] === false && i2[1][2] === true, '이미 유효한 키가 있으면 확인 뒤 «한 장 더»(reissue) 로 다시 — 서버가 «이미 있음» 을 판정');
    lst.issue = () => [{ friendCode: 'MATE-9K2M', ok: false, code: 'LICENSE_GRANT_DUPLICATE' }]; api.shown.length = 0;
    e.licenseGrantCode.value = 'MATE-9K2M'; await e.licenseGrantBtn.fire('click');
    t(api.shown.some(x => x[0] === 'num' && x[1] === 'E-ADM-21'), '그 밖의 줄 실패 — 오류 번호');
  }
  /* ── 1 · 4. 카테고리 ── */
  const st = { groups: [{ group: 'head', icon: '🎩', label: '머리' }], cats: [{ cat: 'hat', label: '모자', icon: '🎩', group: 'head', builtin: true }], ov: {} };
  let C;
  const cc = []; const ccFail = { on: false };
  const crec = (n) => async (...a) => { cc.push([n, ...a]); if(ccFail.on) throw Object.assign(new Error('x'), { code: 'CATALOG_INVALID_ITEM' }); };
  const catalogAdmin = { createCategory: crec('createCategory'), renameCategory: crec('renameCategory'), resetCategory: crec('resetCategory'), deleteCategory: crec('deleteCategory'),
    reportFail: async (e, site) => { cc.push(['reportFail', site]); return 'notice'; } };
  const answers = [];
  try{ C = build(m.cat, 'TwAdminCategory', 'createAdminCategory', { catalogAdmin, asyncPrompt: async () => answers.shift(), partGroups: () => st.groups, partCats: () => st.cats, partCatOverrides: () => st.ov }); }
  catch(e){ t(false, '카테고리 모듈을 만들 수 없다 — ' + e.message); }
  if(C){
    const e = C.els;
    t(['lcCategoryManage', 'wardrobeCategoryManageBtn', 'cmCloseX', 'cmAddCancelBtn', 'cmAddGoBtn'].every(id => typeof e[id].onclick === 'function')
      && C.out && Object.keys(C.out).join() === 'renderCategoryManager' && C.calls.length === 0, '카테고리 — 만들 때 버튼 다섯 · 돌려주는 이름 renderCategoryManager · 서버 안 부름');
    const chips = () => e.cmGroupList.children[0].children[1].children;
    C.out.renderCategoryManager();
    t(chips().length === 2 && chips()[0].children.length === 1, '카테고리 그리기 — 칩 하나 + 추가 · 덮어쓴 적 없으면 ↺ 없음');
    st.cats = st.cats.concat([{ cat: 'ribbon', label: '리본', icon: '🎀', group: 'head' }]); st.ov = { hat: { label: '모자2' } };
    C.out.renderCategoryManager();
    t(chips().length === 3 && chips()[0].children.length === 2, '다시 대입된 뒤의 목록 · 덮어쓰기를 읽는다(읽는 함수) — 칩 둘 + 추가 · ↺ 생김');
    /* 서버 카탈로그에 쓴다(catalogAdmin) — 기본 카테고리 이름 바꾸기 · 되돌리기 · 운영 카테고리 추가 · 삭제 */
    answers.push('겉옷', ''); await chips()[0].children[0].onclick();
    t(cc.length === 1 && cc[0].join() === 'renameCategory,hat,[object Object]' && JSON.stringify(cc[0][2]) === '{"label":"겉옷","icon":"🎩"}', '★ 기본 카테고리 이름 바꾸기 — 서버에 이름 · 아이콘(비우면 지금 아이콘 그대로)을 쓴다');
    await chips()[0].children[1].onclick();
    t(cc[1].join() === 'resetCategory,hat', '↺ 되돌리기 — 서버 «원래대로»');
    await chips()[1].children[0].onclick();
    t(cc[2].join() === 'deleteCategory,ribbon', '✕ 삭제 — 서버에 지우기(확인창 뒤)');
    cc.length = 0; chips()[2].onclick();
    e.cmAddName.value = '모자'; e.cmAddId.value = 'Bad Id!'; e.cmAddBone.value = 'head'; await e.cmAddGoBtn.onclick();
    t(cc.length === 1 && cc[0][1] === 'badid', '칸 정리 — ID 는 영문 소문자 · 숫자 · _ 로 정리해 보낸다(이미 있는 ID 는 앱이 거르지 않는다 — 서버가 CATALOG_ALREADY_EXISTS 로 거절)');
    cc.length = 0; chips()[2].onclick(); e.cmAddId.value = 'scarf'; e.cmAddName.value = '목도리'; e.cmAddBone.value = 'head'; await e.cmAddGoBtn.onclick();
    t(cc[0][0] === 'createCategory' && cc[0][1] === 'scarf' && cc[0][2].group === 'head' && cc[0][2].label === '목도리' && cc[0][2].bone === 'head', '새 카테고리 — 고른 그룹으로 서버에 만든다');
    ccFail.on = true; cc.length = 0; chips()[2].onclick(); e.cmAddId.value = 'x1'; e.cmAddName.value = 'X'; await e.cmAddGoBtn.onclick();
    t(cc.map(c => c[0]).join() === 'createCategory,reportFail' && cc[1][1] === 'category', '서버가 거절하면 번호로 알린다(조용히 넘기지 않는다)');
    ccFail.on = false;
  }
  /* ── 5. app.js 연결 ── */
  const A = strip(app);
  t(!/function renderLicenseGenList|function renderLicenseReqList|function renderCategoryManager|bindLicenseGrantByCode|publishCustomCat\(|publishCatOverride\(/.test(A),
    'app.js 에 옮긴 본문이 남지 않았다');
  t(/function _showUpdateNoticeOnce\(/.test(A), '사용자 쪽(공지 한 판을 처음 받았을 때 업데이트 공지 팝업)은 app.js 에 남았다');
  t(!/\bADMIN_LICENSE_OFF\b/.test(app) && !/\bADMIN_NOTICE_OFF\b/.test(app) && !/\bADMIN_CATEGORY_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const deps = (name) => ((app.match(new RegExp('const ' + name + ' = (?:\\(typeof \\w+ === \'undefined\'\\) \\? \\w+ : )?\\w+\\.create\\w+\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const dl = deps('adminLicense'), dc = deps('adminCategory');
  t(dl.length === 4 && dl.includes('adminApi: adminApi,') && dl.includes('apiErrors: TwApiErrors.store,') && dc.length === 6, 'deps — 라이선스 넷(toast · adminApi · apiErrors · notifyError) · 카테고리 여섯(서버 쓰기 길 catalogAdmin 포함)');
  t(['partGroups: ()=>PART_GROUPS,', 'partCats: ()=>PART_CATS,', 'partCatOverrides: ()=>partCatOverrides,'].every(l => dc.includes(l)),
    '카테고리 deps — PART_GROUPS(뒤에서 선언) · PART_CATS · partCatOverrides(다시 대입)는 읽는 함수로');
  const h130 = app.indexOf('/* ═══ 🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자) ═══ */'), h131 = app.indexOf('// ===== Phase 3: 관리자 카테고리 관리 =====');
  t(h130 > 0 && app.indexOf('const adminLicense =') > h130 && app.indexOf('const adminLicense =') < h131
    && app.indexOf('const adminCategory =') > h131, '만드는 줄은 원래 자리(두 구역 머리 아래)');
  t((A.match(/if\(typeof adminCategory\.renderCategoryManager==='function'\) adminCategory\.renderCategoryManager\(\);/g) || []).length === 1
    && !/typeof renderCategoryManager/.test(A), '🔄 카탈로그 동기화가 adminCategory.renderCategoryManager 로 부른다(카테고리 한 벌 구독 하나) — 옛 typeof 는 늘 거짓이 되므로 남기면 안 된다');
  t(/renderLicenseGenList: \(\.\.\.a\)=>adminLicense\.renderLicenseGenList\(\.\.\.a\),/.test(app), '📄 엑셀 일괄 발급이 목록을 다시 그릴 때 adminLicense.renderLicenseGenList');
  t(['TwAdminLicense', 'TwAdminCategory'].every((g, i) => new RegExp('window\\.' + g + ' = api;').test([m.lic, m.cat][i])), '전역 이름 Tw 접두사 둘');
  const iA = html.indexOf('<script src="parts/app.js"></script>');
  t(['admin-license', 'admin-category'].every(n => { const i = html.indexOf('<script src="parts/admin/' + n + '.js"></script>'); return i > 0 && i < iA; }),
    'html — 둘 다 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const rows = await judgeAll(M, SRC, HTML);
  const sec = ['── 1 · 2. 라이선스', '── 1 · 4. 카테고리', '── 5. app.js 연결'];
  let k = 0;
  const cut = [0, rows.findIndex(([, m]) => m.startsWith('카테고리')), rows.findIndex(([, m]) => m.startsWith('app.js 에 옮긴'))];
  rows.forEach(([ok, msg], i) => { if(cut.includes(i) && i >= 0) say(sec[k++]); chk(ok, msg); });

  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['요청한 사람 이름을 HTML 로 읽음', { lic: s => s.replace("b.textContent = req.name || '(이름 없음)';", "b.innerHTML = req.name || '(이름 없음)';") }],
    ['친구코드 후보 차례 바뀜', { lic: s => s.replace("['MATE-' + code, 'COZY-' + code]", "['COZY-' + code, 'MATE-' + code]") }],
    ['회수에 판(version)을 안 실음', { lic: s => s.replace('adminApi.revokeLicense(d.id, d.version)', 'adminApi.revokeLicense(d.id, 0)') }],
    ['409 를 덮어쓰기로', { lic: s => s.replace("if(kind === 'refetch'){ toast(REFETCH_TEXT); renderLicenseGenList(); return; }", '') }],
    ['옛 답 버림 빠짐', { lic: s => s.replace('  if(g !== listGen) return;\n  drawList(listEl, q, page, g);', '  drawList(listEl, q, page, g);') }],
    ['검색을 앱이 거름', { lic: s => s.replace('adminApi.listLicenses({ q })', 'adminApi.listLicenses({ q: \'\' })') }],
    ['카테고리 목록을 값으로 붙잡음', { cat: s => s.replace('const PART_CATS = deps.partCats;', 'const PART_CATS = (()=>{ const v = deps.partCats(); return ()=>v; })();') }],
    ['카테고리 서버 쓰기 안 함', { cat: s => s.replace("await catalogAdmin.resetCategory(c.cat);", "await Promise.resolve(c.cat);") }],
    ['카테고리 실패를 삼킴', { cat: s => { const t0 = "await catalogAdmin.reportFail(e, 'category');"; const x = s.lastIndexOf(t0); return s.slice(0, x) + s.slice(x + t0.length); } }],
    ['옛 typeof 로 부름', { app: s => s.replace("if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();", "if(typeof renderCategoryManager==='function') renderCategoryManager();") }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-license.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + '\nfunction renderLicenseReqList(all){}' }],
    ['deps 하나 빠짐', { app: s => s.replace('  partCatOverrides: ()=>partCatOverrides,\n', '') }],
  ];
  for(const [name, f] of breaks){
    const m2 = { lic: f.lic ? f.lic(M.lic) : M.lic, cat: f.cat ? f.cat(M.cat) : M.cat };
    const a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = m2.lic !== M.lic || m2.cat !== M.cat || a2 !== SRC || h2 !== HTML;
    let rows2 = [];
    try{ rows2 = await judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
