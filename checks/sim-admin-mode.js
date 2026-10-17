/* ═══ 🔐 sim-admin-mode.js — 관리자 모드 진입 모듈 (2026-10-14 신설 · 관리자 코드 admin 폴더 7번) ═══════════════
   app.js 의 관리자 모드(비밀번호 창 · 켜기 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl·⌘+클릭 진입)와 비밀번호 창 버튼 연결을
   parts/admin/admin-mode.js 로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM · 진짜 SHA-256(node webcrypto) 위에서 굴린다.
   ・1절: 만들 때 — 비밀번호 창 버튼 셋 · Ctrl+E · 진입 클릭(캡처) · 내놓는 이름 refreshAdminVisibility · isAdmin 을 안 바꿈
   ・2절: 켜기 — 틀린 비밀번호 · 맞아도 구글 로그인 없으면 안 켬 · 맞고 로그인 있으면 setIsAdmin(true) · body.admin · 버튼 보이기
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
    addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, focus(){} });
  const adminOnly = [mk('a1'), mk('a2')];
  const body = mk('body');
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)), body,
    addEventListener(t, f, cap){ (docOn[t] = docOn[t] || []).push({ f, cap: !!cap }); }, querySelectorAll: (sel) => sel === '.admin-only' ? adminOnly : [] };
  const fb = { authCurrentUid: () => st.uid, authCurrentEmail: () => 'a@b.c', migrateGachaCatalog: async () => ({ moved: [] }) };
  const companion = { setAdminMode: (v) => calls.push('setAdminMode:' + v) };
  const win = { firebaseAPI: fb, companion, refreshWardrobe: () => calls.push('refreshWardrobe') };   // 코드는 window.companion 이 있을 때만 창 쪽에 알린다
  const deps = { toast: (m) => calls.push('toast:' + m), refreshInviteBtn: () => calls.push('refreshInviteBtn'), adminPassHash: HASH,
    isAdmin: () => st.admin, setIsAdmin: (v) => { calls.push('setIsAdmin:' + v); st.admin = v; }, savedParts: () => [] };
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

async function judgeAll(src, app, html, platform){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const st = { admin: false, uid: null, platform };
  let B;
  try{ B = build(src, st); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); return r; }
  const e = B.els;
  t(typeof e.adminPassOk.onclick === 'function' && typeof e.adminPassCancel.onclick === 'function' && (e.adminPassInput._on.keydown || []).length === 1
    && (B.docOn.keydown || []).length === 1 && (B.docOn.click || []).filter(x => x.cap).length === 1, '만들 때 — 비밀번호 창 버튼 셋 · Ctrl+E · 진입 클릭(캡처 단계)');
  t(B.out && Object.keys(B.out).join() === 'refreshAdminVisibility' && !B.calls.some(c => c.startsWith('setIsAdmin')), '내놓는 이름 refreshAdminVisibility 하나 · 만들 때 isAdmin 을 안 바꾼다');
  /* 2. 켜기 */
  e.adminPassInput.value = '틀림'; await e.adminPassOk.onclick();
  t(!st.admin && /틀려요/.test(e.adminPassErr.textContent), '틀린 비밀번호 — 안 켠다');
  e.adminPassInput.value = PW; st.uid = null; await e.adminPassOk.onclick();
  t(!st.admin && /구글 로그인이 필요해요/.test(e.adminPassErr.innerHTML), '맞아도 구글 로그인이 없으면 안 켠다(권한의 근거는 서버 규칙 · 로그인 uid)');
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
  /* 4. app.js 연결 */
  const A = strip(app);
  t(!/function tryEnterAdmin|function _submitAdminPass|function exitAdmin|function refreshAdminVisibility|bindAdminTrigger|function _sha256Hex|'adminPassOk'/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(/^let isAdmin = false;/m.test(app) && /const ADMIN_PASS_HASH = '/.test(app), 'isAdmin 선언 · 비밀번호 해시는 app.js 에(다른 곳도 읽는다)');
  t(!/\bADMIN_MODE_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const mk = (app.match(/const adminMode = TwAdminMode\.createAdminMode\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  t(deps.length === 6 && deps.includes('isAdmin: ()=>isAdmin,') && deps.includes('setIsAdmin: (v)=>{ isAdmin = v; },') && deps.includes('savedParts: ()=>savedParts,')
    && deps.includes('adminPassHash: ADMIN_PASS_HASH,'), 'deps 여섯 — isAdmin 은 읽는 함수 + 쓰는 함수 · savedParts 는 읽는 함수');
  t(/if\(typeof adminMode\.refreshAdminVisibility==='function'\) adminMode\.refreshAdminVisibility\(\);/.test(A) && !/^refreshAdminVisibility\(\);/m.test(A),
    '부팅 때 adminMode.refreshAdminVisibility 로 관리자 전용 UI 를 숨긴다');
  t(/window\.TwAdminMode = api;/.test(src), '전역 이름 TwAdminMode(Tw 접두사)');
  const iK = html.indexOf('<script src="parts/shared/key-input.js"></script>'), iM = html.indexOf('<script src="parts/admin/admin-mode.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iK > 0 && iM > iK && iA > iM, 'html — key-input.js(hotkeyLetter) 뒤 · app.js 앞');
  return r;
}

(async () => {
  const rows = await judgeAll(MOD, SRC, HTML, 'Win32');
  const heads = { 0: '── 1. 만들 때', 2: '── 2. 켜기', 5: '── 3. 끄기 · 진입', 11: '── 4. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  /* Mac 에서는 ⌘+클릭으로 열린다 */
  { const st = { admin: false, uid: 'u1', platform: 'MacIntel' }; const B = build(MOD, st); const c = click(B, 'lcDonateBtn', { metaKey: true });
    chk(c.prevented && B.els.adminPassOverlay.classList.contains('on'), 'Mac — ⌘+클릭(후원 버튼)으로도 연다'); }
  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['로그인 확인 빠짐', { mod: s => s.replace("if(!_myAuthUid()){", "if(false){") }],
    ['켜기 전에 isAdmin 을 붙잡음', { mod: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['Ctrl+E 가 안 끔', { mod: s => s.replace("e.preventDefault(); exitAdmin(); }", "e.preventDefault(); }") }],
    ['Win 키로도 열림', { mod: s => s.replace('if(!(e.ctrlKey || (isMac && e.metaKey))) return;', 'if(!(e.ctrlKey || e.metaKey)) return;') }],
    ['진입 클릭의 원래 동작을 안 막음', { mod: s => s.replace("    e.preventDefault();\n    e.stopPropagation();\n    tryEnterAdmin();", "    tryEnterAdmin();") }],
    ['부팅 숨기기 빠짐', { app: s => s.replace("if(typeof adminMode.refreshAdminVisibility==='function') adminMode.refreshAdminVisibility();", '') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/admin/admin-mode.js"></script>', '').replace('<script src="parts/shared/key-input.js"></script>', '<script src="parts/admin/admin-mode.js"></script>\n<script src="parts/shared/key-input.js"></script>') }],
    ['app.js 에 본문이 남음', { app: s => s + '\nfunction exitAdmin(){}' }],
    ['deps 하나 빠짐', { app: s => s.replace('  setIsAdmin: (v)=>{ isAdmin = v; },\n', '') }],
  ];
  for(const [name, f] of breaks){
    const s2 = f.mod ? f.mod(MOD) : MOD, a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = s2 !== MOD || a2 !== SRC || h2 !== HTML;
    let rows2; try{ rows2 = await judgeAll(s2, a2, h2, 'Win32'); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
