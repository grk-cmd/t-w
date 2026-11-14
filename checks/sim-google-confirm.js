/* ═══ 🔑 sim-google-confirm.js — 구글을 계정에 처음 붙이기 전에 묻는 창(parts/account/google-confirm.js) ═══════════════
   ・1절: maskEmail — 앞 두 글자(짧으면 한 글자)만 · 빈 값 · @ 없음
   ・2절: tokenEmail — ID 토큰 가운데 칸의 email(한글 포함) · 모양이 틀리면 null
   ・3절: ask — 가린 주소 · 친구 코드(넘긴 것 > 이 PC 것 > —) · 세 버튼 · ESC · 기본 포커스 [다른 계정으로 로그인] · 겹쳐 열면 앞의 것은 취소 · 창이 없으면 취소
   ・4절: pickForLink — [다른 구글 고르기]면 구글 창을 다시 연다 · 닫으면 취소 · 창이 실패하면 그 이유
   ・5절: 연결 — html(창 · z 층 · 스크립트 차례) · smoke PRELOAD · app.js 가 만들어 초대 게이트 · 계정에 넘긴다 · 묻는 세 길(로그인 · 구글 가입 · 연결하기 둘)
   ・6절: 일부러 깨 보기
   (로그인 · 가입이 «묻고 · 아니면 묶지 않는» 것은 sim-google-login §3-3 이 돌려 본다)
   [실행] node checks/run.js sim-google-confirm */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD = ['google-confirm.js', 'parts/account/google-confirm.js', 'app/parts/account/google-confirm.js'].map(read).find(Boolean);
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if(!MOD || !SRC || !HTML){ say('  ? 원본 못 찾음 — google-confirm.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD_ACC = ['account.js', 'parts/account/account.js', 'app/parts/account/account.js'].map(read).find(Boolean) || '';
const MOD_LG = ['license-gate.js', 'parts/account/license-gate.js', 'app/parts/account/license-gate.js'].map(read).find(Boolean) || '';

function load(src){
  const m = { exports: {} };
  new Function('window', 'module', 'atob', src)(undefined, m, (s) => Buffer.from(s, 'base64').toString('binary'));
  return m.exports;
}
/* 버튼 · 칸만 있는 작은 가짜 DOM — 창이 무엇을 보이고 무엇을 돌려주는지만 본다 */
function fakeDom(withOverlay){
  const els = {};
  const mk = () => ({ style: { display: 'none' }, textContent: '', onclick: null, focused: 0, focus(){ this.focused++; } });
  if(withOverlay !== false) ['gConfirmOverlay', 'gcTitle', 'gcMail', 'gcLead', 'gcCode', 'gcCard', 'gcWarn', 'gcFresh', 'gcOther', 'gcYes', 'gcClose'].forEach(i => { els[i] = mk(); });
  const keys = [];
  const doc = { getElementById: (i) => els[i] || null,
    addEventListener: (t, f) => { if(t === 'keydown') keys.push(f); },
    removeEventListener: (t, f) => { const k = keys.indexOf(f); if(k >= 0) keys.splice(k, 1); } };
  return { els, doc, keys, press: (key) => keys.slice().forEach(f => f({ key, stopPropagation(){} })) };
}
const tick = () => new Promise(r => setImmediate(r));
/* 끝나지 않는 약속(깨 보기에서 ESC 를 안 들으면 등)은 '시간초과' 로 — 안 그러면 할 일이 없어진 node 가 조용히 0 으로 끝난다 */
const within = (p) => Promise.race([p, new Promise(r => setTimeout(() => r('시간초과'), 300))]);
const jwt = (o) => 'h.' + Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.s';

async function judgeAll(src){
  const r = [];
  const t = (ok, m) => r.push([!!ok, m]);
  let G;
  try{ G = load(src); }catch(e){ t(false, '불러오다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  /* 1 */
  const M = G.maskEmail;
  t(M('minty.draw@gmail.com') === 'mi***@gmail.com' && M('  Ab@x.com ') === 'A***@x.com' && M('a@x.com') === 'a***@x.com', '1 ★ 앞 두 글자만(두 글자 이하면 한 글자) · 도메인은 그대로');
  t(M('') === '' && M(null) === '' && M('noat') === '***' && M('@x.com') === '***', '1   빈 값은 빈 값 · @ 가 없거나 앞이 비면 전부 가림');
  /* 2 */
  const E = G.tokenEmail;
  t(E(jwt({ email: 'me@gmail.com', sub: '1' })) === 'me@gmail.com' && E(jwt({ email: '한글@x.com' })) === '한글@x.com', '2 ★ ID 토큰 가운데 칸의 email(한글도)');
  t(E('') === null && E('a.b.c') === null && E(jwt({ sub: '1' })) === null && E(null) === null, '2   모양이 틀리거나 email 이 없으면 null');
  /* 3 */
  const D = fakeDom();
  globalThis.document = D.doc;
  let pc = 'MATE-JNY9';
  const mod = G.createGoogleConfirm({ friendCode: () => pc, signInWithGoogle: async () => ({ ok: false }) });
  let p = mod.ask('minty.work@gmail.com', 'bind');
  await new Promise(r => setTimeout(r, 5));   // 포커스는 setTimeout 0 뒤에 간다
  const e = D.els;
  t(e.gConfirmOverlay.style.display === 'flex' && e.gcMail.textContent === 'mi***@gmail.com' && e.gcCode.textContent === 'MATE-JNY9', '3 ★ 뜬다 · 주소는 가려서 · 이 PC 친구 코드');
  t(/처음 보는 구글/.test(e.gcTitle.textContent) && /예전에 다른 구글 계정/.test(e.gcWarn.textContent) && /처음 시작하는 거라면 \[이 계정에 연결\]/.test(e.gcFresh.textContent) && e.gcOther.textContent === '다른 계정으로 로그인',
    '3   로그인 문구 — 제목 · 경고(예전 다른 구글) · 처음 시작 한 줄 · [다른 계정으로 로그인]');
  t(e.gcOther.focused === 1 && e.gcYes.focused === 0, '3 ★ 기본 포커스는 [다른 계정으로 로그인]');
  e.gcOther.onclick();
  t(await within(p) === 'other' && e.gConfirmOverlay.style.display === 'none' && D.keys.length === 0, '3 ★ [다른 계정으로 로그인] → other · 창 닫힘 · ESC 듣기 해제');
  p = mod.ask('x@y.z', 'bind'); await tick(); e.gcYes.onclick();
  t(await within(p) === 'yes', '3 ★ [이 계정에 연결] → yes');
  p = mod.ask('x@y.z', 'bind'); await tick(); e.gcClose.onclick();
  t(await within(p) === 'cancel', '3   ✕ → cancel');
  p = mod.ask('x@y.z', 'bind'); await tick(); D.press('Escape');
  t(await within(p) === 'cancel' && D.keys.length === 0, '3   ESC → cancel');
  p = mod.ask('x@y.z', 'signup', 'MATE-NEW1'); await tick();
  t(e.gcCode.textContent === 'MATE-NEW1', '3   넘긴 코드(가입 중 새 아이디)가 이 PC 코드보다 먼저');
  t(e.gcTitle.textContent === '이 구글 계정으로 가입할까요?' && /예전에 다른 구글 계정/.test(e.gcWarn.textContent) && /처음 시작하는 거라면/.test(e.gcFresh.textContent) && e.gcOther.textContent === '다른 계정으로 로그인',
    '3 ★ 구글로 가입 — 제목만 «이 구글 계정으로 가입할까요?» · 나머지는 로그인 문구 그대로(A안)');
  const p2 = mod.ask('x@y.z', 'link'); await tick();
  t(await within(p) === 'cancel', '3   겹쳐 열면 앞의 것은 cancel 로 끝난다');
  t(/연결할까요/.test(e.gcTitle.textContent) && e.gcOther.textContent === '다른 구글 고르기' && e.gcFresh.style.display === 'none', '3   연결 문구 — 제목 · [다른 구글 고르기] · 처음 시작 줄 없음');
  e.gcYes.onclick(); await within(p2);
  pc = null;
  p = mod.ask('', 'bind'); await tick();
  t(e.gcCode.textContent === '—' && e.gcMail.textContent === '(주소 모름)', '3   코드 · 주소가 없으면 — · (주소 모름)');
  e.gcClose.onclick(); await within(p);
  const D0 = fakeDom(false); globalThis.document = D0.doc;
  t(await within(G.createGoogleConfirm({ friendCode: () => null, signInWithGoogle: async () => ({}) }).ask('a@b.c', 'bind')) === 'cancel', '3   창이 없으면 cancel(묶지 않는다)');
  /* 4 */
  globalThis.document = D.doc;
  const runPick = async (results, answers) => {
    let opened = 0;
    const m = G.createGoogleConfirm({ friendCode: () => 'MATE-N2PV', signInWithGoogle: async () => { const g = results[Math.min(opened, results.length - 1)]; opened++; return g; } });
    const pr = m.pickForLink();
    for(const a of answers){ await tick(); if(a === 'yes') e.gcYes.onclick(); else if(a === 'other') e.gcOther.onclick(); else e.gcClose.onclick(); }
    const res = await within(pr);
    return { res: res === '시간초과' ? { ok:false, reason:'시간초과' } : res, opened };
  };
  let x = await runPick([{ ok: true, idToken: jwt({ email: 'mo@x.com' }) }, { ok: true, idToken: 'T2' }], ['other', 'yes']);
  t(x.opened === 2 && x.res.ok && x.res.idToken === 'T2', '4 ★ [다른 구글 고르기] → 구글 창을 한 번 더 · 두 번째 것을 붙인다');
  x = await runPick([{ ok: true, idToken: 'T1' }], ['cancel']);
  t(x.opened === 1 && !x.res.ok && x.res.canceled, '4 ★ 묻는 창을 닫으면 취소(붙이지 않음)');
  x = await runPick([{ ok: false, reason: '구글이 막았어요' }], []);
  t(!x.res.ok && !x.res.canceled && x.res.reason === '구글이 막았어요', '4   구글 창이 실패하면 그 이유');
  x = await runPick([{ ok: false }], []);
  t(!x.res.ok && x.res.canceled, '4   구글 창을 그냥 닫으면 취소');
  /* 5 🔁 구글 바꾸기 — 지금 구글 확인 · 새 구글 고르기 */
  const mkPick = (results) => { let n = 0; return { n: () => n, m: G.createGoogleConfirm({ friendCode: () => 'MATE-N2PV', signInWithGoogle: async () => { const g = results[Math.min(n, results.length - 1)]; n++; return g; } }) }; };
  let P = mkPick([{ ok: true, idToken: jwt({ email: 'Minty@Gmail.com' }) }]);
  let q = await within(P.m.pickCurrent('minty@gmail.com'));
  t(q.ok && q.idToken && P.n() === 1, '5 ★ 지금 구글 확인 — 같은 주소(대소문자 무시)면 통과');
  P = mkPick([{ ok: true, idToken: jwt({ email: 'other@gmail.com' }) }]);
  q = await within(P.m.pickCurrent('minty@gmail.com'));
  t(!q.ok && !q.canceled && q.reason === '지금 연결된 구글(mi***@gmail.com)을 골라 주세요', '5 ★ 다른 구글을 고르면 — 바꾸지 않고 «지금 연결된 구글(가린 주소)을 골라 주세요»');
  P = mkPick([{ ok: false }]); q = await within(P.m.pickCurrent('minty@gmail.com'));
  t(!q.ok && q.canceled, '5   구글 창을 닫으면 취소');
  P = mkPick([{ ok: true, idToken: jwt({ email: 'minty@gmail.com' }) }]);
  q = await within(P.m.pickForChange('minty@gmail.com'));
  t(!q.ok && q.same && /이미 연결된 구글/.test(q.reason) && e.gConfirmOverlay.style.display === 'none', '5   새로 고른 게 지금 구글과 같으면 — 묻지 않고 «이미 연결된 구글 계정이에요»');
  P = mkPick([{ ok: true, idToken: jwt({ email: 'mo1@x.com' }) }, { ok: true, idToken: jwt({ email: 'mo2@x.com' }) }]);
  let pr = P.m.pickForChange('minty@gmail.com');
  await tick();
  t(e.gcTitle.textContent === '구글 계정을 바꿀까요?' && e.gcMail.textContent === 'mo***@x.com' && /지금 구글 mi\*\*\*@gmail\.com 대신/.test(e.gcCard.textContent) && /지금 구글\(mi\*\*\*@gmail\.com\)로는 더 이상/.test(e.gcWarn.textContent) && e.gcYes.textContent === '바꾸기' && e.gcOther.textContent === '다른 구글 고르기' && e.gcFresh.style.display === 'none',
    '5 ★ 묻는 창 — «구글 계정을 바꿀까요?» · 새 주소 · 지금 주소(가림) · [다른 구글 고르기] / [바꾸기]');
  e.gcOther.onclick(); await tick(); e.gcYes.onclick();
  q = await within(pr);
  t(q.ok && q.email === 'mo2@x.com' && P.n() === 2, '5 ★ [다른 구글 고르기] → 창 다시 · 두 번째 구글로 [바꾸기]');
  P = mkPick([{ ok: true, idToken: jwt({ email: 'mo1@x.com' }) }]);
  pr = P.m.pickForChange('minty@gmail.com'); await tick(); e.gcClose.onclick();
  q = await within(pr);
  t(!q.ok && q.canceled, '5   묻는 창을 닫으면 취소(바꾸지 않음)');
  p = mod.ask('x@y.z', 'bind'); await tick();
  t(e.gcYes.textContent === '이 계정에 연결', '5   바꾸기 창 뒤에 로그인 창을 열면 버튼 글은 다시 [이 계정에 연결]');
  e.gcClose.onclick(); await within(p);
  delete globalThis.document;
  return r;
}

let finished = false;
process.on('exit', () => { if(!finished){ console.log('  ✗ 끝까지 못 돌았다'); process.exitCode = 1; } });
(async () => {
  say('── 1~4. 순수 함수 · 묻는 창 · 다른 구글 고르기');
  (await judgeAll(MOD)).forEach(([ok, m]) => chk(ok, m));

  say('── 5. 연결');
  const noCm = (s) => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
  const H = noCm(HTML);
  const ov = H.slice(H.indexOf('<div id="gConfirmOverlay"'), H.indexOf('<div id="charsLinkedOverlay"') > 0 ? H.indexOf('<div id="charsLinkedOverlay"') : undefined);
  chk(['gcTitle', 'gcMail', 'gcLead', 'gcCode', 'gcCard', 'gcWarn', 'gcFresh', 'gcOther', 'gcYes', 'gcClose'].every(i => ov.includes('id="' + i + '"')), 'html — 창 #gConfirmOverlay 와 칸 열');
  try{
    const Z = require('./sim-z-layers.js'), T = Z.parseTable(HTML), m = /z-index:([^;]+);/.exec(ov), v = Z.resolveZ(HTML, m && m[1]);
    chk(v != null && v > T['--z-gate-done'] && v > T['--z-gate-signup'] && v > T['--z-gate-invite'], 'html — 게이트 · 가입 완료보다 위(그 위에서 뜬다)');
  }catch(e){ chk(false, 'z 층 표를 못 읽음 — ' + String(e.message || e).slice(0, 60)); }
  const iG = HTML.indexOf('<script src="parts/account/google-confirm.js">'), iL = HTML.indexOf('<script src="parts/account/license-gate.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iG > 0 && iG < iL && iG < iA, 'html — 초대 게이트 · app.js 보다 먼저 싣는다');
  chk(!SMOKE || /PRELOAD\.push\('google-confirm\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 있다');
  const DR = ['desktop-run.js', 'parts/launcher/desktop-run.js', 'app/parts/launcher/desktop-run.js'].map(read).find(Boolean) || '';
  chk(/const UI_HIT_SEL = '[^']*#gConfirmOverlay[,']/.test(DR), '바탕화면 실행 화면에서 창을 누를 수 있다(클릭 통과 목록 UI_HIT_SEL)');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const A = strip(SRC);
  const iMk = A.indexOf('const googleConfirmMod = TwGoogleConfirm.createGoogleConfirm(');
  chk(iMk > 0 && iMk < A.indexOf('const licenseGateMod = TwLicenseGate.createLicenseGate(') && iMk < A.indexOf('const accountMod = TwAccount.createAccount('), 'app.js — 초대 게이트 · 계정보다 먼저 만든다');
  chk(/const licenseGateMod = TwLicenseGate\.createLicenseGate\(\{\n  googleConfirmMod: googleConfirmMod,/.test(SRC) && /const accountMod = TwAccount\.createAccount\(\{\n  googleConfirmMod: googleConfirmMod,/.test(SRC), 'app.js — 초대 게이트 · 계정에 deps 로 넘긴다');
  chk(/authSignInWithGoogle\(g\.idToken, offer, \(email\)=>googleConfirmMod\.ask\(email, 'bind'\)\)/.test(MOD_ACC) && /r\.declined === 'other'\) return _loginDoGoogle\(\)/.test(MOD_ACC), '★ 로그인(내 정보 · 게이트 H · K) — 묻는 함수를 넘기고 [다른 계정]이면 다시');
  chk(/authSignInWithGoogle\(g\.idToken, p\.uid, \(email\)=>googleConfirmMod\.ask\(email, 'signup', p\.code\)\)/.test(MOD_LG) && /r\.declined === 'other'\) return _signupDoGoogle\(\)/.test(MOD_LG), '★ 구글로 가입 — 새 아이디를 보이고 묻는다');
  const linkSites = (MOD_ACC.match(/googleConfirmMod\.pickForLink\(\)/g) || []).length + (MOD_LG.match(/googleConfirmMod\.pickForLink\(\)/g) || []).length;
  const rawSites = (strip(MOD_ACC).match(/companion\.signInWithGoogle\(\)/g) || []).length + (strip(MOD_LG).match(/companion\.signInWithGoogle\(\)/g) || []).length;
  chk(linkSites === 2, '★ 구글 [연결하기](내 정보) · [구글도 연결하기](가입 완료) 둘 다 묻는 창을 거친다');
  chk(rawSites === 3, '  구글 창을 직접 여는 곳은 로그인 · 가입 · 비밀번호 만들기 재확인 셋뿐(연결하기는 pickForLink 안에서) — 지금 ' + rawSites);

  const ACC = strip(MOD_ACC);
  const fl = (ACC.match(/async function _acctChangeGoogle\([\s\S]*?\n\}/) || [''])[0];
  const iC = fl.indexOf('googleConfirmMod.pickCurrent(from)'), iN = fl.indexOf('googleConfirmMod.pickForChange(from)'), iX = fl.indexOf('firebaseAPI.authChangeGoogle(cur.idToken, nw.idToken)');
  chk(iC > 0 && iC < iN && iN < iX, '★ 🔁 구글 바꾸기 — 지금 구글 확인 → 새 구글 고르기 · 묻기 → 바꾸기 차례(account.js _acctChangeGoogle)');
  chk(/if\(m\.mode !== 'c2'\)\{ sayG\('구글을 바꾸려면 먼저 비밀번호를 만들어 주세요'/.test(ACC), '  비밀번호가 없는 계정(C3)은 [바꾸기]에서 막는다(서버 모듈도 한 번 더 막는다 — sim-google-change)');
  say('── 6. 일부러 깨 보기');
  for(const [name, a, b] of [
    ['주소를 안 가림', "  return local.slice(0, keep) + '***@' + domain;", "  return s;"],
    ['기본 포커스가 [연결]', "setTimeout(()=>{ if(other) other.focus(); }, 0);", "setTimeout(()=>{ if(yes) yes.focus(); }, 0);"],
    ['[다른 계정]이 yes', "if(other) other.onclick = () => finish('other');", "if(other) other.onclick = () => finish('yes');"],
    ['ESC 를 안 들음', "if(e.key === 'Escape'){ e.stopPropagation(); finish('cancel'); }", "if(e.key === 'Nope'){ finish('cancel'); }"],
    ['다른 구글 고르기에서 안 되돌아감', "      if(a === 'cancel') return { ok:false, canceled:true, reason:'' };\n    }", "      return { ok:false, canceled:true, reason:'' };\n    }"],
    ['지금 구글이 아니어도 통과', "    if(!sameEmail(tokenEmail(g.idToken), from)) return", "    if(false) return"],
    ['같은 구글로 바꾸기를 물음', "      if(sameEmail(email, from)) return { ok:false, same:true, reason:'이미 연결된 구글 계정이에요' };\n", ''],
    ['버튼 글이 남음', "      set('gcYes', t.yes || '이 계정에 연결');\n", "      if(t.yes) set('gcYes', t.yes);\n"],
    ['넘긴 코드를 무시', "set('gcCode', code || friendCode() || '—');", "set('gcCode', friendCode() || '—');"],
  ]){
    const m2 = MOD.replace(a, b);
    let rows; try{ rows = await judgeAll(m2); }catch(_){ rows = [[false, '던짐']]; }
    chk(m2 !== MOD && rows.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }

  finished = true;
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
