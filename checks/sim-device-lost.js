/* ═══ 🖥️ sim-device-lost.js — 🖥️ 한 계정 한 기기 모듈 구조 (2026-10-14 신설 · 앱 FSD 46번) ═══════════════
   app.js 의 밀려난 기기 처리 구역 본문 을 parts/account/device-lost.js 로 옮겼다(글자 그대로 · 바뀐 줄 1 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(밀려난 기기 처리 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_onDeviceSessionLost)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 2줄 그대로 · 부르는 곳은 deviceLostMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 밀림 · «여기서 계속» 을 실제로 눌러 본다 — 다시 켜기를 부르고(끊긴 구독은 다시 켜야 산다) · 못 하면 여기서 다시 claim · presence · 깨 보기
   ・5절: 읽기가 막힌 밀림(onLost(null) — 옛 버전 앱) 은 «옛 버전» 안내 · [다시 시도], 다른 기기 · 인자 없음은 예전 안내 · 깨 보기
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

const FN_DEPS = ["getMyUserId","_acctRelaunchAfterDetach"];
const VAL_DEPS = ["twNav"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["_onDeviceSessionLost"];
const MOVED = ["_onDeviceSessionLost","_deviceSessionContinueHere"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  getMyUserId: (...a)=>getMyUserId(...a),","  twNav: twNav,","  _acctRelaunchAfterDetach: (...a)=>acctStateMod._acctRelaunchAfterDetach(...a),"];

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
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/account/device-lost.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const deviceLostMod = TwDeviceLost.createDeviceLost({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const deviceLostMod = TwDeviceLost.createDeviceLost({", "const deviceLostMod = TwDeviceLost.createDeviceLost({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDeviceLost = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const deviceLostMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('deviceLostMod.' + x)); if(n){ ls[i] = ls[i].replace('deviceLostMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createDeviceLost(deps){', 'function createDeviceLost(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
(async () => {
say('── 4. 밀림 · «여기서 계속» 을 눌러 본다');
/* 이름으로 요소를 찾는 작은 가짜 DOM — 화면 · 버튼 · 부른 차례를 그대로 기록한다 */
async function press(src, relaunch, after, lostArg){
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, style: { display: 'none' }, textContent: id === 'deviceSessionContinue' ? '여기서 계속 쓰기' : '', disabled: false, onclick: null });
  const calls = [];
  const fb = { claimDeviceSession: async (id) => { await null; calls.push('claim:' + id); return true; }, setMyPresenceOnline: (id) => calls.push('presence:' + id) };
  const nav = { NAV: { LEAVE_ROOM: 'leave' }, go: (n) => { calls.push('go:' + n); } };
  const win = { companion: {}, firebaseAPI: fb };
  const doc = { getElementById: el };
  const api = new Function('window', 'document', 'firebaseAPI', 'module', src + '\nreturn window.TwDeviceLost;')(win, doc, fb, undefined);
  const mod = api.createDeviceLost({ getMyUserId: () => 'uA', twNav: nav, _acctRelaunchAfterDetach: (onFallback) => relaunch(onFallback, calls) });
  mod._onDeviceSessionLost(lostArg);
  const lostShown = el('deviceSessionOverlay').style.display;
  const p1 = el('deviceSessionContinue').onclick();
  const p2 = el('deviceSessionContinue').onclick();   // 두 번 눌러도 한 번
  await p1; await p2;
  if(after) after();
  return { calls, lostShown, title: el('deviceSessionTitle').textContent, msg: el('deviceSessionMsg').textContent, ov: el('deviceSessionOverlay').style.display, btn: el('deviceSessionContinue'), lost: win._deviceSessionLost };
}
async function judgePress(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let a, b, c;
  try{
    a = await press(src, (fb, calls) => { calls.push('relaunch'); return true; });
    b = await press(src, (fb) => { fb(); return false; });
    let later = null;
    c = await press(src, (fb, calls) => { calls.push('relaunch'); later = fb; return true; }, () => later && later());
  }catch(e){ t(false, '눌러 보다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  t(a.lostShown === 'flex' && a.calls[0] === 'go:leave', '밀리면 — 방 나가기 · 화면');
  t(a.calls.slice(1).join() === 'presence:uA,claim:uA,relaunch', '★ 계속 쓰기 = presence → 기기 세션 → 다시 켜기 차례(presence 가 ver 없음인 채로 켜면 부팅 구독이 또 막힌다) · 두 번 눌러도 한 번');
  t(a.btn.disabled === true && a.btn.textContent === '다시 시작하는 중…' && a.ov === 'flex', '  다시 켜는 동안 — 버튼 잠금 · «다시 시작하는 중…» · 화면 그대로');
  t(b.calls.includes('claim:uA') && b.calls.includes('presence:uA') && b.ov === 'none' && b.lost === false, '★ 다시 켜기를 못 하는 판 — 재claim · presence 재등록 · 화면 닫기 · 표식 해제(예전과 같다)');
  t(b.btn.disabled === false && b.btn.textContent === '여기서 계속 쓰기', '  그때 버튼 글 · 잠금 되돌림');
  t(c.ov === 'none' && c.lost === false && c.btn.textContent === '여기서 계속 쓰기', '  다시 켜기가 늦게 실패해도(onFallback 나중) 여기서 이어 간다');
  return r;
}
(await judgePress(MOD)).forEach(([ok, msg]) => chk(ok, msg));
const pressBreaks = [
  ['다시 켜기 안 부름(예전처럼 여기서만)', m => m.replace('_acctRelaunchAfterDetach(_continueInPlace);', '_continueInPlace();')],
  ['기기 세션을 presence 보다 먼저', m => { const i = m.indexOf("    if(window.firebaseAPI && firebaseAPI.setMyPresenceOnline) firebaseAPI.setMyPresenceOnline(myId);\n"), j = m.indexOf("    if(window.firebaseAPI && firebaseAPI.claimDeviceSession) await"); if(i < 0 || j < 0) return m; const pl = m.slice(i, m.indexOf('\n', i) + 1), cl = m.slice(j, m.indexOf('\n', j) + 1); return m.replace(pl, '').replace(cl, cl + pl); }],
  ['쓰기를 기다리지 않고 다시 켬', m => m.replace('await firebaseAPI.claimDeviceSession(myId, _onDeviceSessionLost);', 'firebaseAPI.claimDeviceSession(myId, _onDeviceSessionLost);')],
  ['못 하는 판에 이어 가지 않음', m => m.replace('_acctRelaunchAfterDetach(_continueInPlace);', '_acctRelaunchAfterDetach(()=>{});')],
  ['버튼 글 안 되돌림', m => m.replace('b1.textContent = _continueLabel; }', '}')],
  ['두 번 누르면 두 번', m => m.replace('if(_continuing) return;', '')],
];
for(const [name, fm] of pressBreaks){
  const m2 = fm(MOD);
  let rows2; try{ rows2 = await judgePress(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 5. 읽기가 막힌 밀림(옛 버전 앱) — «다른 기기» 와 따로 안내');
/* 읽기 거부는 claimDeviceSession 이 onLost(null) 로 알린다 · 다른 기기에 밀리면 그 기기 값 · room-entry 는 인자 없이 */
async function judgeKind(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let o, d, n;
  try{
    o = await press(src, (fb) => { fb(); return false; }, null, null);
    d = await press(src, (fb) => { fb(); return false; }, null, { id: 'dev-B' });
    n = await press(src, (fb) => { fb(); return false; });
  }catch(e){ t(false, '눌러 보다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  t(o.lostShown === 'flex' && o.title.includes('옛 버전') && o.msg.includes('옛 버전') && o.btn.textContent === '다시 시도', '★ onLost(null) — 옛 버전 안내 · [다시 시도](맥 «다른 PC 에서 접속 중» 반복 막기)');
  t(o.calls.includes('claim:uA') && o.calls.includes('presence:uA'), '  [다시 시도] 도 계속 쓰기와 같은 길(presence · 기기 세션)');
  t(d.title.includes('다른 기기') && d.btn.textContent === '여기서 계속 쓰기' && !d.msg.includes('옛 버전'), '★ 다른 기기 값 — 예전 «다른 기기에서 사용 중» 그대로');
  t(n.title.includes('다른 기기') && n.btn.textContent === '여기서 계속 쓰기', '  인자 없이(room-entry) — 다른 기기 안내');
  return r;
}
(await judgeKind(MOD)).forEach(([ok, msg]) => chk(ok, msg));
const kindBreaks = [
  ['늘 다른 기기 안내', m => m.replace("return v === null ? 'oldApp' : 'device';", "return 'device';")],
  ['늘 옛 버전 안내', m => m.replace("return v === null ? 'oldApp' : 'device';", "return 'oldApp';")],
  ['제목을 안 바꿈', m => m.replace('if(ti) ti.textContent = t.title;', '')],
];
for(const [name, fm] of kindBreaks){
  const m2 = fm(MOD);
  let rows2; try{ rows2 = await judgeKind(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
