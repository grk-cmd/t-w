/* ═══ 🖥️ sim-device-lost.js — 🖥️ 한 계정 한 기기 모듈 구조 (2026-10-14 신설 · 앱 FSD 46번) ═══════════════
   app.js 의 밀려난 기기 처리 구역 본문 을 parts/account/device-lost.js 로 옮겼다(글자 그대로 · 바뀐 줄 1 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(밀려난 기기 처리 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_onDeviceSessionLost)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 2줄 그대로 · 부르는 곳은 deviceLostMod.이름 · html(app.js 앞)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 끊김 · 단추를 실제로 눌러 본다 — 까닭마다 글(지워짐 · 새 세션) · 방 나가기 · 다시 등록 → 되면 닫기 · 취소 · 실패면 그대로 · mutation test
   ・5절: 배선 — realtime 끊김(까닭) → login-flow → 이 화면 · 단추 = 등록 → realtime · RTDB 기기 세션 없음 · 클릭 통과
   [실행] app.js · desk-companion-prototype.html · device-lost.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["device-lost.js","parts/account/device-lost.js","app/parts/account/device-lost.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — device-lost.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["twNav"];
const GET_DEPS = ["continueHere"];
const SET_DEPS = [];
const EXPORTS = ["_onDeviceSessionLost"];
const MOVED = ["_onDeviceSessionLost","_deviceSessionContinueHere"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  twNav: twNav,","  continueHere: ()=>deviceRegisterMod.ensure().then((r)=>{ if(r !== 'ok') return false; TwRtHub.store.start({ claim: true }); return true; }),   // 등록 → realtime 연결 하나로 다시(login-flow 를 부르지 않는다 — 그쪽이 이 화면을 부른다)"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwDeviceLost;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createDeviceLost(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDeviceLost = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDeviceLost(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DEVICE_LOST_MOD_OFF") && app.includes("const deviceLostMod = TwDeviceLost.createDeviceLost({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const deviceLostMod = TwDeviceLost\\.createDeviceLost\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const deviceLostMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 deviceLostMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/account/device-lost.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/account/device-lost.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/account/device-lost.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const deviceLostMod = TwDeviceLost.createDeviceLost({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const deviceLostMod = TwDeviceLost.createDeviceLost({", "const deviceLostMod = TwDeviceLost.createDeviceLost({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDeviceLost = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const deviceLostMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('deviceLostMod.' + x)); if(n){ ls[i] = ls[i].replace('deviceLostMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createDeviceLost(deps){', 'function createDeviceLost(deps){ throw new Error("mutation");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
(async () => {
say('── 4. 끊김 · «다시 등록 / 여기서 계속» 을 눌러 본다(이 PC 다시 등록 → 같은 연결로 다시)');
const flush = () => new Promise((r) => setTimeout(r, 0));
async function press(src, o){
  o = o || {};
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, style: { display: 'none' }, textContent: '', disabled: false, onclick: null });
  const calls = [];
  const nav = { NAV: { LEAVE_ROOM: 'leave' }, go: (n) => { calls.push('go:' + n); } };
  const win = { companion: {} };
  let answer = o.answer === undefined ? true : o.answer;
  const releases = [];
  const api = new Function('window', 'document', 'module', src + '\nreturn window.TwDeviceLost;')(win, { getElementById: el }, undefined);
  const mod = api.createDeviceLost({ twNav: nav, continueHere: () => { calls.push('register'); if(o.hold) return new Promise((r) => { releases.push(r); }); return Promise.resolve(answer); } });
  el('deviceSessionContinue').onclick && await el('deviceSessionContinue').onclick();   // 끊기기 전에 눌러도 아무 일 없음
  const before = calls.length;
  mod._onDeviceSessionLost(o.kind || 'deviceRemoved');
  if(o.twice) mod._onDeviceSessionLost('sessionLost');
  const shown = { ov: el('deviceSessionOverlay').style.display, lost: win._deviceSessionLost, title: el('deviceSessionTitle').textContent, btn: el('deviceSessionContinue').textContent, note: el('deviceSessionNote').textContent, msg: el('deviceSessionMsg').textContent };
  let busy = null;
  if(o.hold){
    const p1 = el('deviceSessionContinue').onclick(); const p2 = el('deviceSessionContinue').onclick();   // 기다리는 중 또 누름
    await flush(); busy = el('deviceSessionContinue').disabled; releases.forEach((r) => r(true)); await p1; await p2;
  }else{
    await el('deviceSessionContinue').onclick();
  }
  return { calls, before, shown, busy, ov: el('deviceSessionOverlay').style.display, lost: win._deviceSessionLost, disabled: el('deviceSessionContinue').disabled };
}
async function judgePress(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let a, b, c, d, e;
  try{ a = await press(src); b = await press(src, { twice: true }); c = await press(src, { answer: false }); d = await press(src, { kind: 'sessionLost' }); e = await press(src, { hold: true }); }
  catch(x){ t(false, '눌러 보다 던짐 — ' + String(x.message || x).slice(0, 80)); return r; }
  t(a.before === 0, '끊기기 전엔 단추가 아무 일도 안 한다');
  t(a.shown.ov === 'flex' && a.shown.lost === true && a.calls[0] === 'go:leave' && a.shown.title === '다른 PC에서 이 기기를 지웠어요' && a.shown.msg === '다시 등록하면 바로 이어서 쓸 수 있어요.' && a.shown.btn === '이 PC 다시 등록',
    '★ 지워짐(deviceRemoved) — 방 나가기 · 방 입장 막기 표식 · «다른 PC에서 이 기기를 지웠어요» · 한 줄 · [이 PC 다시 등록]');
  t(d.shown.title === '이 PC의 다른 창에서 쓰는 중이에요' && d.shown.msg === '' && d.shown.btn === '여기서 계속 쓰기', '  새 세션(sessionLost) — «이 PC의 다른 창에서 쓰는 중이에요» · [여기서 계속 쓰기]');
  t(![a, d].some((x) => /한 번에 한 기기|한 기기에서만/.test(x.shown.title + x.shown.msg + x.shown.note)), '  «한 기기에서만» 말은 없다(계정마다 PC 는 서버가 정한 상한까지)');
  t(b.calls.filter((x) => x === 'go:leave').length === 1 && b.shown.title === '이 PC의 다른 창에서 쓰는 중이에요', '  두 번 알려도 방 나가기는 한 번 · 글은 마지막 까닭으로');
  t(a.calls.filter((x) => x === 'register').length === 1 && a.ov === 'none' && a.lost === false && !a.disabled, '★ 누르면 다시 등록 한 번 → 되면 화면 닫기 · 표식 풀기(앱을 다시 켜지 않는다)');
  t(c.calls.filter((x) => x === 'register').length === 1 && c.ov === 'flex' && c.lost === true && !c.disabled, '★ 등록을 취소 · 실패하면 화면 그대로 · 다시 누를 수 있다(«여기서 계속» 이 아무 일도 안 하던 것)');
  t(e.busy === true && e.calls.filter((x) => x === 'register').length === 1 && e.ov === 'none', '  등록을 기다리는 동안 단추를 잠그고 또 눌러도 한 번');
  return r;
}
(await judgePress(MOD)).forEach(([ok, msg]) => chk(ok, msg));
const pressBreaks = [
  ['누름이 등록을 안 부름', m => m.replace('  try{ ok = (await continueHere()) === true; }catch(_){ ok = false; }\n', '')],
  ['등록 실패에도 화면을 닫음', m => m.replace('  if(!ok) return;   // 취소 · 실패', '  if(false) return;   // 취소 · 실패')],
  ['기다리는 중 또 누르면 또 등록', m => m.replace('  if(!window._deviceSessionLost || _devLostBusy) return;', '  if(!window._deviceSessionLost) return;')],
  ['끊겨도 방에 남음', m => m.replace("  if(first){ try{ Promise.resolve(twNav.go(twNav.NAV.LEAVE_ROOM)).catch(()=>{}); }catch(_){} }\n", '')],
  ['표식을 안 풂', m => m.replace("  if(ov) ov.style.display = 'none';\n  window._deviceSessionLost = false;", "  if(ov) ov.style.display = 'none';")],
  ['까닭을 안 가름', m => m.replace('  const t = DEVICE_LOST_TEXT[kind] || DEVICE_LOST_TEXT[DEVICE_LOST_KIND.SESSION];', '  const t = DEVICE_LOST_TEXT[DEVICE_LOST_KIND.SESSION];')],
];
for(const [name, fm] of pressBreaks){
  const m2 = fm(MOD);
  let rows2; try{ rows2 = await judgePress(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), 'mutation test — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 5. 배선 — realtime 밀림이 이 화면을 부른다 · 옛 RTDB 기기 세션 없음');
{
  const FI = ['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js'].map(read).find(Boolean) || '';
  const LF = ['login-flow.js', 'parts/account/login-flow.js', 'app/parts/account/login-flow.js'].map(read).find(Boolean) || '';
  chk(!!FI && !/claimDeviceSession|releaseDeviceSession|deviceSessionLost\(\)|users\/\$\{userId\}\/session/.test(strip(FI)), 'firebase-init 에 RTDB 기기 세션(users/{uid}/session) 길이 없다');
  chk(/onSessionLost: \(kind\)=>deviceLostMod\._onDeviceSessionLost\(kind\),/.test(SRC) && /deps\.onSessionLost\(s\);/.test(LF), 'login-flow 가 realtime 끊김(sessionLost · deviceRemoved) 상태에서 까닭을 실어 이 화면을 부른다');
  chk(/continueHere: \(\)=>deviceRegisterMod\.ensure\(\)\.then\(\(r\)=>\{ if\(r !== 'ok'\) return false; TwRtHub\.store\.start\(\{ claim: true \}\); return true; \}\),/.test(SRC), '★ 단추 = 이 PC 등록(상한이 다 찼으면 확인창) → 된 때만 같은 realtime 연결로 다시');
  chk(!/id="deviceSessionNote"/.test(HTML) && !/한 번에 한 기기에서만/.test(HTML) && /id="deviceSessionTitle">다른 PC에서 이 기기를 지웠어요</.test(HTML), 'html — 덧붙이는 안내 줄 없음 · «한 기기에서만» 말 없음 · 제목에 이모지 없음');
  chk(!/deviceSessionLost/.test(SRC), '접속 고정(presence-lock)은 확인의 me 를 바로 앉히고 늦은 값을 다시 쓰지 않아 «밀렸나» 를 따로 보지 않는다');
  chk(/#deviceSessionOverlay/.test(['desktop-run.js', 'parts/launcher/desktop-run.js', 'app/parts/launcher/desktop-run.js'].map(read).find(Boolean) || ''), '화면이 클릭 통과 목록(UI_HIT_SEL)에 있다');
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
