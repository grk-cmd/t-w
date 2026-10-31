/* ═══ 🎟️ sim-admin-license.js — 관리자 3번 모듈 셋 (2026-10-14 신설 · 관리자 코드 admin 폴더 3번) ═══════════════
   app.js «🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자)» · «관리자 카테고리 관리» 의 관리자 몫을 parts/admin/ 세 파일로 옮겼다.
     admin-license.js(키 발급 · 목록 · 대기 요청 · 친구코드로 발급) · admin-notice.js(📣 확성기 · 📰 업데이트 공지 편집) · admin-category.js(📁 카테고리)
   동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
   ・1절: 만들 때 — 버튼을 한 번씩 건다 · 돌려주는 이름 · 서버는 안 부른다
   ・2절: 라이선스 — 목록(검색 거르기) · 대기 요청(이름 씻기 · 발급 = approveLicenseRequest(id, 새 키, '요청: 이름')) · 친구코드로 발급(뒷 4자리 → MATE · COZY · createLicense → 수령함 reward)
   ・3절: 공지 — 확성기는 1분(60000) · 빈 글은 안 보냄 · 업데이트 공지는 제목 · 본문 둘 다
   ・4절: 카테고리 — 읽는 함수로 받은 목록(다시 대입된 뒤)을 그린다 · 이미 있는 ID 는 안 만듦 · 덮어쓴 이름만 ↺
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
const M = { lic: part('admin-license.js'), not: part('admin-notice.js'), cat: part('admin-category.js') };
for(const [k, n] of [['lic', 'admin-license.js'], ['not', 'admin-notice.js'], ['cat', 'admin-category.js']])
  if(!M[k]){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

/* ── 가짜 DOM ── */
function makeDom(){
  const els = {};
  const mk = (tag) => {
    const e = { tagName: tag, id: '', style: {}, value: '', checked: false, disabled: false, textContent: '', _html: '', title: '',
      children: [], _on: {}, onclick: null, files: null,
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
      get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = String(v); this.children = []; },
      appendChild(c){ this.children.push(c); return c; },
      addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); },
      focus(){}, click(){ if(this.onclick) return this.onclick(); },
      fire(t, ev){ return Promise.all((this._on[t] || []).map(f => f(ev || {}))); } };
    return e;
  };
  const document = { getElementById: (id) => els[id] || (els[id] = Object.assign(mk('div'), { id })), createElement: mk };
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
    publishAnnounce: rec('publishAnnounce'), clearAnnounce: rec('clearAnnounce'),
    getUpdateNotice: rec('getUpdateNotice', null), publishUpdateNotice: rec('publishUpdateNotice'), clearUpdateNotice: rec('clearUpdateNotice'),
    publishCustomCat: rec('publishCustomCat'), unpublishCustomCat: rec('unpublishCustomCat'),
    publishCatOverride: rec('publishCatOverride'), unpublishCatOverride: rec('unpublishCatOverride'),
  }, fbOver || {});
  const D = makeDom();
  const win = { firebaseAPI: fb, focus(){} };
  const nav = { clipboard: { writeText(){} } };
  const api = new Function('window', 'document', 'firebaseAPI', 'confirm', 'navigator', 'setTimeout', 'module', src + '\nreturn window.' + glob + ';')(
    win, D.document, fb, () => true, nav, (f) => f(), undefined);
  const out = api[create](Object.assign({ toast: (m) => toasts.push(m) }, deps));
  return { win, calls, toasts, out, els: D.els, fb };
}
const LIC_DEPS = { chatEsc: (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'), genLicenseKey: () => 'KEY-NEW', saveFailMsg: () => '실패' };
const flush = () => new Promise(r => setImmediate(r));

async function judgeAll(m, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* ── 1 · 2. 라이선스 ── */
  let L;
  try{ L = build(m.lic, 'TwAdminLicense', 'createAdminLicense', LIC_DEPS); }catch(e){ t(false, '라이선스 모듈을 만들 수 없다 — ' + e.message); }
  if(L){
    const e = L.els;
    t(typeof e.lcLicenseGen.onclick === 'function' && typeof e.licenseGenClose.onclick === 'function' && typeof e.licenseGenBtn.onclick === 'function'
      && typeof e.licenseGenCopyBtn.onclick === 'function' && (e.licenseGenSearch._on.input || []).length === 1 && (e.licenseBulkBtn._on.click || []).length === 1
      && (e.licenseGrantBtn._on.click || []).length === 1 && (e.licenseGrantCode._on.keydown || []).length === 1, '라이선스 — 만들 때 버튼 여덟을 한 번씩 건다');
    t(L.out && Object.keys(L.out).join() === 'renderLicenseGenList' && typeof L.out.renderLicenseGenList === 'function', '라이선스 — 돌려주는 이름은 renderLicenseGenList 하나');
    t(L.calls.length === 0, '라이선스 — 만들 때는 서버를 안 부른다');
    let hid = 0; L.win._lxHideWin = () => hid++;
    await e.lcLicenseGen.onclick(); await flush();
    t(e.licenseGenOverlay.classList.contains('on') && hid === 1 && L.calls.some(c => c[0] === 'listLicenses') && L.calls.some(c => c[0] === 'subscribeLicenseRequests'),
      '발급 창 열기 — 창을 켜고 · 일괄 창을 숨기고 · 목록을 읽고 · 대기 요청을 구독');
    t(e.licenseGenList.children.length === 2, '키 목록 — 두 줄');
    e.licenseGenSearch.value = '콩떡'; await e.licenseGenSearch.fire('input');
    t(e.licenseGenList.children.length === 1, '키 목록 검색 — 메모로 거른다(다시 읽지 않음)');
    L.fb._reqCb({ r1: { status: 'pending', name: '<b>나쁜</b>' }, r2: { status: 'approved', name: 'x' } });
    const row = e.licenseReqList.children[0];
    t(e.licenseReqList.children.length === 1 && /&lt;b&gt;나쁜/.test(row.innerHTML) && !/<b>나쁜/.test(row.innerHTML), '대기 요청 — pending 만 · 요청한 사람 이름은 씻는다');
    await row.children[0].onclick();
    t(L.calls.some(c => c[0] === 'approveLicenseRequest' && c[1] === 'r1' && c[2] === 'KEY-NEW' && c[3] === '요청: <b>나쁜</b>'), '대기 요청 발급 — approveLicenseRequest(id, 새 키, «요청: 이름»)');
    e.licenseGrantCode.value = '4htr';
    await e.licenseGrantBtn.fire('click');
    const looks = L.calls.filter(c => c[0] === 'lookupFriendCode').map(c => c[1]).join();
    const cr = L.calls.find(c => c[0] === 'createLicense'), sent = L.calls.find(c => c[0] === 'sendInboxMessage');
    t(looks === 'MATE-4HTR,COZY-4HTR' && cr && cr[2] === '말랑 · 친구코드 4HTR' && sent && sent[1] === 'u123' && sent[2] === 'reward'
      && L.calls.indexOf(cr) < L.calls.indexOf(sent), '친구코드로 발급 — 뒷 4자리 → MATE · COZY 차례 · 키 만들고 → 수령함(reward)');
  }
  /* ── 1 · 3. 공지 ── */
  let N;
  try{ N = build(m.not, 'TwAdminNotice', 'createAdminNotice', {}); }catch(e){ t(false, '공지 모듈을 만들 수 없다 — ' + e.message); }
  if(N){
    const e = N.els;
    t(['lcAnnounce', 'announceCloseBtn', 'announceSendBtn', 'announceClearBtn', 'lcUpdateNotice', 'updateNoticeAdminCloseBtn', 'updateNoticeSaveBtn', 'updateNoticeClearBtn']
      .every(id => typeof e[id].onclick === 'function') && N.out && !Object.keys(N.out).length && N.calls.length === 0, '공지 — 만들 때 버튼 여덟 · 빈 반환 · 서버 안 부름');
    e.announceInput.value = '   '; await e.announceSendBtn.onclick();
    t(!N.calls.some(c => c[0] === 'publishAnnounce'), '확성기 — 빈 글은 안 보낸다');
    e.announceInput.value = ' 점검 5분 '; await e.announceSendBtn.onclick();
    t(N.calls.some(c => c[0] === 'publishAnnounce' && c[1] === '점검 5분' && c[2] === 60000), '확성기 — 앞뒤 공백 빼고 1분(60000)');
    e.updateNoticeTitle.value = '0.11.5'; e.updateNoticeBody.value = ''; await e.updateNoticeSaveBtn.onclick();
    t(!N.calls.some(c => c[0] === 'publishUpdateNotice'), '업데이트 공지 — 본문이 비면 안 보낸다');
    e.updateNoticeBody.value = '고쳤어요'; await e.updateNoticeSaveBtn.onclick();
    t(N.calls.some(c => c[0] === 'publishUpdateNotice' && c[1] === '0.11.5' && c[2] === '고쳤어요'), '업데이트 공지 — 제목 · 본문');
  }
  /* ── 1 · 4. 카테고리 ── */
  const st = { groups: [{ group: 'head', icon: '🎩', label: '머리' }], cats: [{ cat: 'hat', label: '모자', icon: '🎩', group: 'head', builtin: true }], ov: {} };
  let C;
  try{ C = build(m.cat, 'TwAdminCategory', 'createAdminCategory', { asyncPrompt: async () => null, partGroups: () => st.groups, partCats: () => st.cats, partCatOverrides: () => st.ov }); }
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
    chips()[2].onclick();
    e.cmAddName.value = '모자'; e.cmAddId.value = 'hat'; await e.cmAddGoBtn.onclick();
    t(!C.calls.some(c => c[0] === 'publishCustomCat'), '이미 있는 ID 는 안 만든다');
    e.cmAddId.value = 'scarf'; e.cmAddName.value = '목도리'; e.cmAddBone.value = 'head'; await e.cmAddGoBtn.onclick();
    t(C.calls.some(c => c[0] === 'publishCustomCat' && c[1] === 'scarf' && c[2].group === 'head' && c[2].label === '목도리'), '새 카테고리 — 고른 그룹으로 만든다');
  }
  /* ── 5. app.js 연결 ── */
  const A = strip(app);
  t(!/function renderLicenseGenList|function renderLicenseReqList|function renderCategoryManager|bindLicenseGrantByCode|publishAnnounce\(|publishUpdateNotice\(|publishCustomCat\(/.test(A),
    'app.js 에 옮긴 본문이 남지 않았다');
  t(/function _showUpdateNoticeOnce\(/.test(A) && /licenseReqBtn/.test(A), '사용자 쪽(공지 한 판을 처음 받았을 때 업데이트 공지 팝업 · 라이선스 요청 보내기)은 app.js 에 남았다');
  t(!/\bADMIN_LICENSE_OFF\b/.test(app) && !/\bADMIN_NOTICE_OFF\b/.test(app) && !/\bADMIN_CATEGORY_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const deps = (name) => ((app.match(new RegExp('const ' + name + ' = (?:\\(typeof \\w+ === \'undefined\'\\) \\? \\w+ : )?\\w+\\.create\\w+\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const dl = deps('adminLicense'), dn = deps('adminNotice'), dc = deps('adminCategory');
  t(dl.length === 4 && dn.length === 1 && dc.length === 5, 'deps — 라이선스 넷 · 공지 하나 · 카테고리 다섯');
  t(['partGroups: ()=>PART_GROUPS,', 'partCats: ()=>PART_CATS,', 'partCatOverrides: ()=>partCatOverrides,'].every(l => dc.includes(l)),
    '카테고리 deps — PART_GROUPS(뒤에서 선언) · PART_CATS · partCatOverrides(다시 대입)는 읽는 함수로');
  const h130 = app.indexOf('/* ═══ 🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자) ═══ */'), h131 = app.indexOf('// ===== Phase 3: 관리자 카테고리 관리 =====');
  t(h130 > 0 && app.indexOf('const adminLicense =') > h130 && app.indexOf('const adminNotice =') > h130 && app.indexOf('const adminLicense =') < h131
    && app.indexOf('const adminCategory =') > h131, '만드는 줄은 원래 자리(두 구역 머리 아래)');
  t((A.match(/if\(typeof adminCategory\.renderCategoryManager==='function'\) adminCategory\.renderCategoryManager\(\);/g) || []).length === 2
    && !/typeof renderCategoryManager/.test(A), '🔄 카탈로그 동기화가 adminCategory.renderCategoryManager 로 부른다(둘) — 옛 typeof 는 늘 거짓이 되므로 남기면 안 된다');
  t(/renderLicenseGenList: \(\.\.\.a\)=>adminLicense\.renderLicenseGenList\(\.\.\.a\),/.test(app), '📄 엑셀 일괄 발급이 목록을 다시 그릴 때 adminLicense.renderLicenseGenList');
  t(['TwAdminLicense', 'TwAdminNotice', 'TwAdminCategory'].every((g, i) => new RegExp('window\\.' + g + ' = api;').test([m.lic, m.not, m.cat][i])), '전역 이름 Tw 접두사 셋');
  const iA = html.indexOf('<script src="parts/app.js"></script>');
  t(['admin-license', 'admin-notice', 'admin-category'].every(n => { const i = html.indexOf('<script src="parts/admin/' + n + '.js"></script>'); return i > 0 && i < iA; }),
    'html — 셋 다 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const rows = await judgeAll(M, SRC, HTML);
  const sec = ['── 1 · 2. 라이선스', '── 1 · 3. 공지', '── 1 · 4. 카테고리', '── 5. app.js 연결'];
  let k = 0;
  const cut = [0, rows.findIndex(([, m]) => m.startsWith('공지')), rows.findIndex(([, m]) => m.startsWith('카테고리')), rows.findIndex(([, m]) => m.startsWith('app.js 에 옮긴'))];
  rows.forEach(([ok, msg], i) => { if(cut.includes(i) && i >= 0) say(sec[k++]); chk(ok, msg); });

  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['요청한 사람 이름을 안 씻음', { lic: s => s.replace("${_chatEsc(req.name||'(이름 없음)')}", "${req.name||'(이름 없음)'}") }],
    ['친구코드 후보 차례 바뀜', { lic: s => s.replace("candidates=['MATE-'+code, 'COZY-'+code]", "candidates=['COZY-'+code, 'MATE-'+code]") }],
    ['수령함이 보상 칸이 아님', { lic: s => s.replace("firebaseAPI.sendInboxMessage(uid, 'reward', title, body)", "firebaseAPI.sendInboxMessage(uid, 'notice', title, body)") }],
    ['확성기 시간 바뀜', { not: s => s.replace('publishAnnounce(t, 60000)', 'publishAnnounce(t, 600000)') }],
    ['카테고리 목록을 값으로 붙잡음', { cat: s => s.replace('const PART_CATS = deps.partCats;', 'const PART_CATS = (()=>{ const v = deps.partCats(); return ()=>v; })();') }],
    ['이미 있는 ID 검사 빠짐', { cat: s => s.replace("if(PART_CATS().find(c=>c.cat===catId)){ toast('이미 있는 ID예요 — 다른 ID를 써주세요'); return; }", '') }],
    ['옛 typeof 로 부름', { app: s => s.replace("if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();", "if(typeof renderCategoryManager==='function') renderCategoryManager();") }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-notice.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + '\nfunction renderLicenseReqList(all){}' }],
    ['deps 하나 빠짐', { app: s => s.replace('  partCatOverrides: ()=>partCatOverrides,\n', '') }],
  ];
  for(const [name, f] of breaks){
    const m2 = { lic: f.lic ? f.lic(M.lic) : M.lic, not: f.not ? f.not(M.not) : M.not, cat: f.cat ? f.cat(M.cat) : M.cat };
    const a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = m2.lic !== M.lic || m2.not !== M.not || m2.cat !== M.cat || a2 !== SRC || h2 !== HTML;
    let rows2 = [];
    try{ rows2 = await judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
