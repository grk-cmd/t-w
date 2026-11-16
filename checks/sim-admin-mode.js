/* ═══ 🔐 sim-admin-mode.js — 관리자 모드 진입 모듈 (2026-10-14 신설 · 관리자 코드 admin 폴더 7번) ═══════════════
   app.js 의 관리자 모드(비밀번호 창 · 켜기 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl·⌘+클릭 진입)와 비밀번호 창 버튼 연결을
   parts/admin/admin-mode.js 로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM · 진짜 SHA-256(node webcrypto) 위에서 굴린다.
   ・1절: 만들 때 — 비밀번호 창 버튼 셋 · Ctrl+E · 진입 클릭(캡처) · 내놓는 이름 refreshAdminVisibility · isAdmin 을 안 바꿈
   ・2절: 켜기 — 틀린 비밀번호 · 맞아도 구글 로그인 없으면 안 켬 · 맞고 로그인 있어도 서버(/v2/admin/admins/me)가 관리자로 모르면(403) 안 켬 · 서버에 닿지 못해도 안 켬 ·
        확인 중 또 눌러도 한 번 · 다 맞으면 setIsAdmin(true) · body.admin · 버튼 보이기
   ・3절: 끄기 · 진입 — Ctrl+E 는 켜져 있을 때만 끈다 · Ctrl+클릭은 비밀번호 창을 열고 원래 동작을 막는다 · Mac 아닌 곳의 Meta(Win 키)는 무시 · 켜져 있으면 무시
   ・4절: app.js 연결 — 본문이 안 남음 · isAdmin 선언은 app.js · 빈 껍데기 · deps · 부팅 때 adminMode.refreshAdminVisibility · html(key-input.js 뒤 · app.js 앞)
   ・5절: 일부러 깨 보기
   [실행] app.js · desk-companion-prototype.html · admin-mode.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const nodeCrypto = require('crypto');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['admin-mode.js', 'parts/admin/admin-mode.js', 'app/parts/admin/admin-mode.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — admin-mode.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const PW = '시험비번';
const HASH = nodeCrypto.createHash('sha256').update(PW, 'utf8').digest('hex');

function build(src, st){
  const els = {}, docOn = {}, calls = [];
  const mk = (id) => ({ id, style: {}, value: '', textContent: '', innerHTML: '', onclick: null, _on: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, focus(){}, getAttribute(){ return ''; }, remove(){} });
  const adminOnly = [mk('a1'), mk('a2')];
  const body = mk('body');
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)), body, dispatchEvent(e){ (docOn[e.type] || []).forEach(x => x.f(e)); },
    addEventListener(t, f, cap){ (docOn[t] = docOn[t] || []).push({ f, cap: !!cap }); }, querySelectorAll: (sel) => sel === '.admin-only' ? adminOnly : (sel === '[data-admin-win]' ? (st.winIds || []).map(id => document.getElementById(id)) : []) };
  const meCalls = []; st.meCalls = meCalls;
  const fb = { authCurrentUid: () => st.uid, authCurrentEmail: () => 'a@b.c' };
  const companion = { setAdminMode: (v) => calls.push('setAdminMode:' + v) };
  const navFns = {}; st.navFns = navFns; const twNav = { NAV: { ADMIN_EXIT: 'adminExit' }, on: (n, f) => { navFns[n] = f; } };
  const win = { firebaseAPI: fb, companion, refreshWardrobe: () => calls.push('refreshWardrobe') };   // 코드는 window.companion 이 있을 때만 창 쪽에 알린다
  const deps = { twNav, session: () => (st.uid ? { alive: () => true } : null), identity: () => ({ uid: st.uid, email: 'a@b.c' }), toast: (m) => calls.push('toast:' + m), refreshInviteBtn: () => calls.push('refreshInviteBtn'), adminPassHash: HASH,
    isAdmin: () => st.admin, setIsAdmin: (v) => { calls.push('setIsAdmin:' + v); st.admin = v; },
    adminApi: { ERRORS: { MARK: 1 }, me: async () => { meCalls.push(1); if(st.hold) await st.hold; if(st.meErr) throw st.meErr; return { name: '관리자', version: 1 }; } },
    apiErrors: { notify: (e, table) => { calls.push('notify:' + (e && e.code) + ':' + (table && table.MARK)); return { code: e && e.code, action: 'notice' }; } } };
  const api = new Function('window', 'document', 'firebaseAPI', 'companion', 'navigator', 'hotkeyLetter', 'setTimeout', 'crypto', 'TextEncoder', 'module',
    src + '\nreturn window.TwAdminMode;')(win, document, fb, companion, { platform: st.platform || 'Win32' }, (e) => String(e.key || '').toLowerCase(), (f) => f(),
    globalThis.crypto, TextEncoder, undefined);
  const out = api.createAdminMode(deps);
  return { out, calls, docOn, adminOnly, body, els: new Proxy(els, { get: (o, id) => document.getElementById(id) }) };
}
const click = (B, targetId, ev) => {
  let prevented = false, stopped = false;
  const e = Object.assign({ target: { closest: (sel) => sel.split(',').map(x => x.trim()).includes('#' + targetId) ? {} : null },
    preventDefault(){ prevented = true; }, stopPropagation(){ stopped = true; } }, ev);
  (B.docOn.click || []).filter(x => x.cap).forEach(x => x.f(e));
  return { prevented, stopped };
};
const key = (B, ev) => (B.docOn.keydown || []).forEach(x => x.f(Object.assign({ preventDefault(){} }, ev)));

async function judgeAll(src, app, html, platform, repOv){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const st = { admin: false, uid: null, platform };
  st.winIds = [...html.matchAll(/id="(\w+)" data-admin-win/g)].map(m => m[1]);
  let B;
  try{ B = build(src, st); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); return r; }
  const e = B.els;
  t(typeof e.adminPassOk.onclick === 'function' && typeof e.adminPassCancel.onclick === 'function' && (e.adminPassInput._on.keydown || []).length === 1
    && (B.docOn.keydown || []).length === 1 && (B.docOn.click || []).filter(x => x.cap).length === 1, '만들 때 — 비밀번호 창 버튼 셋 · Ctrl+E · 진입 클릭(캡처 단계)');
  t(B.out && Object.keys(B.out).join() === 'refreshAdminVisibility' && typeof st.navFns.adminExit === 'function' && !B.calls.some(c => c.startsWith('setIsAdmin')), '내놓는 이름 refreshAdminVisibility 하나 · 세션 끝 알림(NAV.ADMIN_EXIT)에 끄기를 건다 · 만들 때 isAdmin 을 안 바꾼다');
  /* 2. 켜기 */
  e.adminPassInput.value = '틀림'; await e.adminPassOk.onclick();
  t(!st.admin && /틀려요/.test(e.adminPassErr.textContent), '틀린 비밀번호 — 안 켠다');
  e.adminPassInput.value = PW; st.uid = null; await e.adminPassOk.onclick();
  t(!st.admin && /구글 로그인이 필요해요/.test(e.adminPassErr.innerHTML), '맞아도 구글 로그인이 없으면 안 켠다(권한의 근거는 서버 규칙 · 로그인 uid)');
  st.uid = 'u1'; st.meErr = Object.assign(new Error('d'), { code: 'ACCESS_DENIED', status: 403 }); await e.adminPassOk.onclick();
  t(!st.admin && !B.body.classList.contains('admin') && B.calls.includes('notify:ACCESS_DENIED:1') && /관리자로 등록돼 있지 않아요/.test(e.adminPassErr.textContent) && e.adminPassErr.style.display === 'block',
    '맞고 로그인이 있어도 서버가 관리자로 모르면(403) 안 켠다 — 오류 번호(기능 표) + 창 안 안내');
  st.meErr = Object.assign(new Error('n'), { code: 'NETWORK', kind: 'unavailable' }); await e.adminPassOk.onclick();
  t(!st.admin && /확인하지 못했어요/.test(e.adminPassErr.textContent), '서버에 닿지 못해 확인을 못 했어도 안 켠다(권한을 모르는 채로 켜지 않는다)');
  st.meErr = null; let release; st.hold = new Promise((r) => { release = r; }); const n0 = st.meCalls.length;
  const p1 = e.adminPassOk.onclick(); await new Promise((r) => setTimeout(r, 30)); const p2 = e.adminPassOk.onclick(); await new Promise((r) => setTimeout(r, 30));   // 비밀번호 해시(비동기)를 지나 확인 대기까지 가도록
  release(); await p1; await p2; st.hold = null;
  t(st.meCalls.length === n0 + 1 && st.admin, '확인 중에 또 눌러도 서버 확인은 한 번 — 끝나면 켠다');
  st.admin = false; B.body.classList.remove('admin');
  st.uid = 'u1'; await e.adminPassOk.onclick();
  t(st.admin && B.body.classList.contains('admin') && B.calls.includes('setAdminMode:true') && B.adminOnly.every(x => x.style.display === '')
    && B.calls.includes('refreshInviteBtn') && B.calls.includes('refreshWardrobe'), '맞고 로그인 있으면 켠다 — setIsAdmin(true) · body.admin · 창 쪽 알림 · 관리자 버튼 보이기 · 초대 · 꾸미기 다시');
  /* 3. 끄기 · 진입 */
  const nOff = B.calls.length;
  key(B, { ctrlKey: true, key: 'e' });
  t(!st.admin && B.calls.slice(nOff).includes('setIsAdmin:false') && !B.body.classList.contains('admin') && B.adminOnly.every(x => x.style.display === 'none'),
    'Ctrl+E — 끄고 관리자 버튼을 숨긴다');
  const nKey = B.calls.length; key(B, { ctrlKey: true, key: 'e' });
  t(B.calls.length === nKey, 'Ctrl+E — 꺼져 있으면 아무것도 안 한다');
  const c1 = click(B, 'lcCreate', { ctrlKey: true });
  t(c1.prevented && c1.stopped && e.adminPassOverlay.classList.contains('on'), 'Ctrl+클릭(캐릭터 생성) — 비밀번호 창을 열고 원래 동작은 막는다');
  e.adminPassOverlay.classList.remove('on');
  const c2 = click(B, 'lcCreate', { metaKey: true });
  t(!c2.prevented && !e.adminPassOverlay.classList.contains('on'), 'Mac 이 아니면 Meta(Win 키)+클릭으로는 안 열린다');
  const c3 = click(B, 'lcSomethingElse', { ctrlKey: true });
  t(!c3.prevented, '진입 버튼이 아닌 곳의 Ctrl+클릭은 건드리지 않는다');
  st.admin = true; const c4 = click(B, 'lcCreate', { ctrlKey: true }); st.admin = false;
  t(!c4.prevented, '이미 켜져 있으면 진입 클릭을 가로채지 않는다');
  /* 3-2. 세션 끝 — 관리자 모드를 조용히 끈다 */
  st.admin = true; B.body.classList.add('admin'); e.adminPassOverlay.classList.add('on');
  const nReset = B.calls.length; st.navFns.adminExit();
  t(!st.admin && !B.body.classList.contains('admin') && B.calls.slice(nReset).includes('setIsAdmin:false') && B.calls.slice(nReset).includes('setAdminMode:false')
    && !B.calls.slice(nReset).some(c => c.startsWith('toast:')) && B.adminOnly.every(x => x.style.display === 'none') && !e.adminPassOverlay.classList.contains('on'),
    '세션 끝 — 관리자 모드 끔 · 관리자 버튼 숨김 · 비밀번호 창 닫음 · 토스트 0');
  const nReset2 = B.calls.length; st.navFns.adminExit();
  t(!B.calls.slice(nReset2).some(c => c.startsWith('setIsAdmin')), '세션 끝 — 이미 꺼져 있으면 아무것도 안 바꾼다');
  { let rel; st.hold = new Promise((r) => { rel = r; }); st.uid = 'u1'; const nMe = st.meCalls.length; e.adminPassInput.value = PW;
    const pend = e.adminPassOk.onclick(); await new Promise((r) => setTimeout(r, 30));
    st.navFns.adminExit(); rel(); await pend; st.hold = null;
    t(st.meCalls.length === nMe + 1 && !st.admin && !B.body.classList.contains('admin'), '세션 끝 — 확인 중이던 옛 계정의 답으로 관리자 모드를 켜지 않는다(늦은 답 버림)');
    e.adminPassInput.value = PW; await e.adminPassOk.onclick();
    t(st.admin, '세션 끝 뒤 새 계정의 확인은 다시 된다(확인 중 잠금이 풀렸다)'); st.admin = false; B.body.classList.remove('admin'); }
  /* 창 닫기 — 주인의 닫기를 부른다(DOM 직접 조작 없음). 주인 모듈 대역이 'tw-admin-exit' 를 듣고 자기 방식으로 닫는다 */
  { const own = []; const owner = { dispatchOn: null };
    const el = e.partRegOverlay; el.classList.add('on');             // .on 으로 여는 창
    const el2 = e.announceOverlay; el2.style.display = 'flex';      // 인라인으로 여는 창
    B.docOn['tw-admin-exit'] = [{ f: () => { el.classList.remove('on'); el2.style.display = 'none'; own.push('closed'); } }];
    st.admin = true; const n0 = B.calls.length; st.navFns.adminExit();
    t(own.length === 1 && !el.classList.contains('on') && el2.style.display === 'none', '세션 끝 — 관리자 창을 «주인의 닫기» 로 닫는다(tw-admin-exit)');
    B.docOn['tw-admin-exit'] = [];
    el.classList.add('on'); st.admin = true; st.navFns.adminExit();
    t(el.style.display !== 'none', '  admin-mode 는 창에 인라인 display:none 을 박지 않는다 — .on 으로 여는 창이 닫은 뒤 다시 열린다');
    el.classList.remove('on'); el.classList.add('on');
    t(el.classList.contains('on') && el.style.display !== 'none', '  닫은 뒤 다시 열면(.on) 보인다');
    B.docOn['tw-admin-exit'] = [{ f: () => {} }]; st.admin = true; const nT = B.calls.length;
    key(B, { ctrlKey: true, key: 'e' });
    t(B.docOn['tw-admin-exit'].length === 1 && B.calls.slice(nT).some(c => c.startsWith('toast:관리자 모드 OFF')), 'Ctrl+E — 같은 몸통(알림 + 토스트)'); st.admin = false; }
  /* 신고 목록 창을 연 채 세션이 끝나면 — 주인의 닫기(_reportClose)를 거쳐 capture Esc 리스너 · 창 칸이 남지 않는다 */
  { let REP = null; for(const d of ['parts/admin', 'app/parts/admin', '.']){ try{ REP = fs.readFileSync(d + '/admin-report.js', 'utf8'); break; }catch(_){} }
    if(repOv) REP = repOv(REP);
    if(!REP){ t(false, 'admin-report.js 를 못 찾았다'); }
    else{
      const docL = []; const clicks = {}; let curOv = null, curEsc = null, closes = 0;
      const mkOv = () => ({ _a: {}, style: {}, setAttribute(k, v){ this._a[k] = v; }, addEventListener(){}, remove(){}, appendChild(){}, set textContent(v){}, get textContent(){ return ''; } });
      const doc = { getElementById: (id) => id === 'lcReportList' ? { addEventListener(ty, f){ clicks[ty] = f; } } : { addEventListener(){} }, body: { appendChild(){} }, createElement: () => mkOv(),
        addEventListener(ty, f){ docL.push([ty, f]); }, removeEventListener(ty, f){ const i = docL.findIndex(x => x[0] === ty && x[1] === f); if(i >= 0) docL.splice(i, 1); }, dispatchEvent(e){ docL.filter(x => x[0] === e.type).map(x => x[1]).forEach(f => f(e)); } };
      const api2 = new Function('window', 'document', 'module', 'TwAdminMode', REP + '\nreturn window.TwAdminReport;')({}, doc, undefined, { EXIT_EVENT: 'tw-admin-exit' });
      const reportClose = () => { closes++; if(curEsc){ doc.removeEventListener('keydown', curEsc, true); curEsc = null; } curOv = null; };
      api2.createAdminReport({ toast(){}, awayUrlOk: () => true, isAdmin: () => true, reportClose, reportBox: () => { const ov = mkOv(); return { ov, body: mkOv() }; }, kinds: [], adminMin: 3,
        reportOv: () => curOv, setReportOv: (v) => { curOv = v; }, reportEsc: () => curEsc, setReportEsc: (f) => { curEsc = f; },
        adminApi: { page: async () => ({ items: [], next: null, total: 0 }), dismiss(){}, takeDown(){}, failOf: () => 'site' }, apiErrors: { notify(){} }, notifyError(){} });
      await clicks.click({ stopPropagation(){} }); await new Promise(r => setImmediate(r));
      const hadEsc = docL.some(x => x[0] === 'keydown'), before = closes;
      doc.dispatchEvent({ type: 'tw-admin-exit' });
      t(hadEsc && closes === before + 1 && !docL.some(x => x[0] === 'keydown') && curOv === null, '신고 목록 창을 연 채 세션이 끝나면 _reportClose 를 거쳐 Esc 리스너 · 창 칸이 남지 않는다');
      /* 창을 열 때마다 세션 끝 리스너가 하나씩 쌓이지 않는다 — 열고 닫기를 여러 번 해도 문서에 걸린 것은 많아야 하나, 닫으면 0 */
      const exitN = () => docL.filter(x => x[0] === 'tw-admin-exit').length;
      for(let k = 0; k < 3; k++){ await clicks.click({ stopPropagation(){} }); await new Promise(r => setImmediate(r)); }
      t(exitN() === 1, '★ 신고 목록 창을 세 번 열어도 세션 끝 리스너는 하나(열 때마다 하나씩 쌓이지 않는다) — ' + exitN());
      doc.dispatchEvent({ type: 'tw-admin-exit' });
      t(exitN() === 0, '  세션이 끝나 창을 닫으면 리스너도 풀린다');
      await clicks.click({ stopPropagation(){} }); await new Promise(r => setImmediate(r));
      t(exitN() === 1, '  다시 열면 다시 하나'); } }
  { const dirs = ['parts/admin', 'app/parts/admin', '.']; const src2 = {};
    for(const d of dirs){ let fl = []; try{ fl = fs.readdirSync(d).filter(f => /^admin-[\w-]+\.js$/.test(f)); }catch(_){} fl.forEach(f => { src2[f] = fs.readFileSync(d + '/' + f, 'utf8'); }); }
    const own = { 'admin-launcher.js': ['adBannerOverlay', 'gameCfgOverlay'], 'admin-asset.js': ['assetGenOverlay', 'commGenOverlay', 'glbEncOverlay', 'glbLoadOverlay'], 'admin-category.js': ['categoryManageOverlay'],
      'admin-notice.js': ['announceOverlay', 'updateNoticeAdminOverlay'], 'admin-license.js': ['licenseGenOverlay'], 'admin-license-bulk.js': ['licenseXlsxWin'], 'admin-part-register.js': ['partRegOverlay', 'deskRegOverlay'], 'admin-users.js': ['totalStatsOverlay', 'inviteGrantOverlay'], 'admin-report.js': [] };
    const bad = Object.keys(own).filter(f => !src2[f] || !/addEventListener\(TwAdminMode\.EXIT_EVENT/.test(src2[f]));
    t(!bad.length, '창을 여는 관리자 모듈마다 tw-admin-exit 를 듣고 자기 닫기로 닫는다' + (bad.length ? ' — 빠짐: ' + bad.join(',') : ''));
    t(/_closeList\(\)/.test((src2['admin-report.js'].match(/const onExit[^\n]*/) || [''])[0]) && /function _closeList\(\)\{ _unhookExit\(\); _reportClose\(\); \}/.test(src2['admin-report.js']), '신고 목록 창 — 세션 끝에 _closeList()(리스너 풀기 + _reportClose: Esc 리스너 · 창 칸 정리)로 닫는다(떼어 내지 않는다)');
    const lit = Object.keys(src2).filter(f => /'tw-admin-exit'|"tw-admin-exit"/.test(src2[f].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')));
    t(lit.length === 1 && lit[0] === 'admin-mode.js' && /const EXIT_EVENT = 'tw-admin-exit';/.test(src2['admin-mode.js']), '★ 이벤트 이름 글자는 admin-mode.js 상수 한 곳 — 나머지는 TwAdminMode.EXIT_EVENT' + (lit.length > 1 ? ' — 흩어짐: ' + lit.join(',') : ''));
    t(!/data-admin-win'?\)?[^\n]*remove/.test(src2['admin-mode.js'] || '') && !/\.remove\(\);/.test((src2['admin-mode.js'].match(/function _closeAdminWindows[\s\S]*?\n\}/) || [''])[0]), 'admin-mode 의 창 닫기에 DOM 떼기 · 창 인라인 조작이 없다(비밀번호 창만 자기 것)'); }
  { const dirs = ['parts/admin', 'app/parts/admin', '.']; const used = new Set();
    for(const d of dirs){ let fl = []; try{ fl = fs.readdirSync(d).filter(f => /^admin-[\w-]+\.js$/.test(f)); }catch(_){} fl.forEach(f => { for(const m of fs.readFileSync(d + '/' + f, 'utf8').matchAll(/'(\w+(?:Overlay|Win))'/g)) used.add(m[1]); }); }
    const miss = [...used].filter(id => !st.winIds.includes(id));
    t(used.size >= 10 && !miss.length, '관리자 모듈(parts/admin/*)이 여는 창 id 가 모두 html 에서 data-admin-win 을 가졌다 (' + used.size + '개' + (miss.length ? ' · 빠짐: ' + miss.join(',') : '') + ')'); }
  /* 4. app.js 연결 */
  const A = strip(app);
  t(!/function tryEnterAdmin|function _submitAdminPass|function exitAdmin|function refreshAdminVisibility|bindAdminTrigger|function _sha256Hex|'adminPassOk'/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(/^let isAdmin = false;/m.test(app) && /const ADMIN_PASS_HASH = '/.test(app), 'isAdmin 선언 · 비밀번호 해시는 app.js 에(다른 곳도 읽는다)');
  t(!/\bADMIN_MODE_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const mk = (app.match(/const adminMode = TwAdminMode\.createAdminMode\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  t(deps.length === 10 && deps.includes('session: ()=>appBoot.getSession(),') && deps.includes('identity: ()=>loginFlowMod.identity(),') && deps.includes('adminApi: adminApi,') && deps.includes('twNav: twNav,') && deps.includes('apiErrors: TwApiErrors.store,') && deps.includes('isAdmin: ()=>isAdmin,') && deps.includes('setIsAdmin: (v)=>{ isAdmin = v; },')
    && deps.includes('adminPassHash: ADMIN_PASS_HASH,'), 'deps 열 — twNav · session · identity ·  isAdmin 은 읽는 함수 + 쓰는 함수 · adminApi · apiErrors');
  t(/if\(typeof adminMode\.refreshAdminVisibility==='function'\) adminMode\.refreshAdminVisibility\(\);/.test(A) && !/^refreshAdminVisibility\(\);/m.test(A),
    '부팅 때 adminMode.refreshAdminVisibility 로 관리자 전용 UI 를 숨긴다');
  t(/adminMode: \(code, me, session\)=>\{ session\.onReset\(\(\)=>twNav\.go\(twNav\.NAV\.ADMIN_EXIT\)\); \},/.test(A) && (A.match(/NAV\.ADMIN_EXIT/g) || []).length === 1, '세션 끝에 관리자 모드 끄기 — app-boot 표 adminMode 칸 한 곳(창 열기 통로로 알림)');
  t(/window\.TwAdminMode = api;/.test(src), '전역 이름 TwAdminMode(Tw 접두사)');
  const iK = html.indexOf('<script src="parts/shared/key-input.js"></script>'), iM = html.indexOf('<script src="parts/admin/admin-mode.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iK > 0 && iM > iK && iA > iM, 'html — key-input.js(hotkeyLetter) 뒤 · app.js 앞');
  return r;
}

(async () => {
  const rows = await judgeAll(MOD, SRC, HTML, 'Win32');
  const heads = { 0: '── 1. 만들 때', 2: '── 2. 켜기', 9: '── 3. 끄기 · 진입', 15: '── 3-2. 세션 끝', 19: '── 4. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  /* Mac 에서는 ⌘+클릭으로 열린다 */
  { const st = { admin: false, uid: 'u1', platform: 'MacIntel' }; const B = build(MOD, st); const c = click(B, 'lcDonateBtn', { metaKey: true });
    chk(c.prevented && B.els.adminPassOverlay.classList.contains('on'), 'Mac — ⌘+클릭(후원 버튼)으로도 연다'); }
  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['로그인 확인 빠짐', { mod: s => s.replace("if(!_signedIn()){", "if(false){") }],
    ['서버 확인 빠짐', { mod: s => s.replace("try{ await adminApi.me(); }", "try{}") }],
    ['확인 못 해도 켬', { mod: s => s.replace("        err.style.display='block';\n        return;\n      }\n      finally", "        err.style.display='block';\n      }\n      finally") }],
    ['확인 연타 잠금 없음', { mod: s => s.replace("if(checking) return;", "") }],
    ['기능 표를 안 넘김', { mod: s => s.replace("apiErrors.notify(e, adminApi.ERRORS)", "apiErrors.notify(e)") }],
    ['켜기 전에 isAdmin 을 붙잡음', { mod: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['세션 끝에 안 끔', { mod: s => s.replace('  _adminOff(false);', '  return;') }],
    ['admin-mode 가 창에 인라인 none 을 박음', { mod: s => s.replace("document.dispatchEvent(new Event(EXIT_EVENT));", "document.dispatchEvent(new Event(EXIT_EVENT)); document.querySelectorAll('[data-admin-win]').forEach(w => { w.style.display = 'none'; });") }],
    ['신고 창이 _reportClose 를 안 거침', { rep: s => s.replace('if(_reportOv() === ov) _closeList();', '') }],
    ['신고 창을 닫아도 리스너가 남음', { rep: s => s.replace('function _closeList(){ _unhookExit(); _reportClose(); }', 'function _closeList(){ _reportClose(); }') }],
    ['신고 창을 열 때 옛 리스너를 안 풂', { rep: s => s.replace('  _closeList();\n  const { ov, body }', '  _reportClose();\n  const { ov, body }') }],
    ['창 표식이 빠짐', { html: s => s.replace('id="partRegOverlay" data-admin-win', 'id="partRegOverlay"') }],
    ['관리자 창을 안 닫음', { mod: s => s.replace('  _closeAdminWindows();\n  if(announce)', '  if(announce)') }],
    ['세션 끝 뒤 옛 답이 켬', { mod: s => s.replace('if(g !== gen) return;   // 확인 중에 세션이 끝났다 — 끝난 계정의 답으로', 'if(false) return;   // 확인 중에 세션이 끝났다 — 끝난 계정의 답으로') }],
    ['app-boot 칸 빠짐', { app: s => s.replace('adminMode: (code, me, session)=>{ session.onReset(()=>twNav.go(twNav.NAV.ADMIN_EXIT)); },', '') }],
    ['Ctrl+E 가 안 끔', { mod: s => s.replace("e.preventDefault(); exitAdmin(); }", "e.preventDefault(); }") }],
    ['Win 키로도 열림', { mod: s => s.replace('if(!(e.ctrlKey || (isMac && e.metaKey))) return;', 'if(!(e.ctrlKey || e.metaKey)) return;') }],
    ['진입 클릭의 원래 동작을 안 막음', { mod: s => s.replace("    e.preventDefault();\n    e.stopPropagation();\n    tryEnterAdmin();", "    tryEnterAdmin();") }],
    ['부팅 숨기기 빠짐', { app: s => s.replace("if(typeof adminMode.refreshAdminVisibility==='function') adminMode.refreshAdminVisibility();", '') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/admin/admin-mode.js"></script>', '').replace('<script src="parts/shared/key-input.js"></script>', '<script src="parts/admin/admin-mode.js"></script>\n<script src="parts/shared/key-input.js"></script>') }],
    ['app.js 에 본문이 남음', { app: s => s + '\nfunction exitAdmin(){}' }],
    ['deps 하나 빠짐', { app: s => s.replace('  setIsAdmin: (v)=>{ isAdmin = v; },\n', '') }],
    ['서버 길 deps 빠짐', { app: s => s.replace('  adminApi: adminApi,\n  apiErrors: TwApiErrors.store,\n});\n/* ═══ 💡', '});\n/* ═══ 💡') }],
  ];
  for(const [name, f] of breaks){
    const s2 = f.mod ? f.mod(MOD) : MOD, a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = s2 !== MOD || a2 !== SRC || h2 !== HTML || !!f.rep;
    let rows2; try{ rows2 = await judgeAll(s2, a2, h2, 'Win32', f.rep); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
