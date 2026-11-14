/* ═══ 🔑 sim-license-key.js — 🔑 라이선스 구획 단추 연결 모듈 구조 (2026-10-14 신설 · 앱 FSD 48번 · D8-2 에서 단추 연결만 남김) ═══════════════
   설정 › 라이선스 구획의 단추([확인] · [이 기기에서 해제] · [이 기기 등록] · [다시 시도])를 license-screen.js 동작에 잇는다. 동작 · 번호 판정은 sim-license-screen 이 맡는다.
   여기서는 모듈 모양 · app.js 연결 · 단추가 맞는 동작을 부르는지를 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 4줄 그대로 · 부르는 곳은 licenseKeyMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · license-key.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["license-key.js","parts/account/license-key.js","app/parts/account/license-key.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — license-key.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["licenseScreenMod"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = [];
const MOVED = [];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  licenseScreenMod: licenseScreenMod,"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwLicenseKey;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createLicenseKey(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwLicenseKey = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwLicenseKey(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("LICENSE_KEY_MOD_OFF") && app.includes("const licenseKeyMod = TwLicenseKey.createLicenseKey({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const licenseKeyMod = TwLicenseKey\\.createLicenseKey\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const licenseKeyMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 licenseKeyMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/account/license-key.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/account/license-key.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 단추를 진짜로 눌러 본다 — 가짜 DOM 에 단추 · 입력칸을 두고, 가짜 screen 이 불린 동작을 적는다 */
function press(mod, okOnSubmit){
  const els = {}; const el = (id) => els[id] || (els[id] = { style: {}, value: '', listeners: {}, addEventListener(t, f){ this.listeners[t] = f; }, click(){ return this.onclick && this.onclick(); } });
  const calls = [];
  const screen = { submitKey: async (v) => { calls.push(['submit', v]); return { ok: okOnSubmit }; }, removeThisDevice: () => { calls.push(['removeThis']); }, registerThisDevice: () => { calls.push(['registerThis']); }, open: (o) => { calls.push(['open', o]); } };
  const api = new Function('window', 'document', mod + '\nreturn window.TwLicenseKey;')({}, { getElementById: el });
  api.createLicenseKey({ licenseScreenMod: screen });
  return { els, calls };
}
async function btnRows(mod){
  const a = press(mod, true);
  a.els.licenseKeyInput.value = ' abcd-1234 ';
  await a.els.licenseSubmitBtn.onclick();
  const cleared = a.els.licenseKeyInput.value === '';
  const b = press(mod, false);
  b.els.licenseKeyInput.value = 'WRONG';
  await b.els.licenseSubmitBtn.onclick();
  const kept = b.els.licenseKeyInput.value === 'WRONG';
  const c = press(mod, true);
  c.els.licenseDeactivateBtn.onclick(); c.els.licenseRegisterThisBtn.onclick(); c.els.licenseRetryBtn.onclick();
  const d = press(mod, true);
  d.els.licenseKeyInput.value = 'K';
  d.els.licenseKeyInput.listeners.keydown({ key: 'Enter' }); await Promise.resolve(); await Promise.resolve();
  return [
    [a.calls.length === 1 && a.calls[0][0] === 'submit' && a.calls[0][1] === ' abcd-1234 ', '[확인] → 입력한 글 그대로 screen.submitKey(다듬기 · 대문자 · 빈 칸 판정은 screen 몫)'],
    [cleared && kept, '등록됐을 때만 입력칸을 비운다(실패하면 고쳐 다시 누르게 남김)'],
    [c.calls.map((x) => x[0]).join() === 'removeThis,registerThis,open' && c.calls[2][1] === undefined, '[이 기기에서 해제] · [이 기기 등록] · [다시 시도] → 각각 removeThisDevice · registerThisDevice · open()(다시 시도는 늘 다시 받는다)'],
    [d.calls.length === 1 && d.calls[0][0] === 'submit', '입력칸에서 Enter → [확인] 과 같다'],
  ];
}

(async () => {
const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 단추 연결');
(await btnRows(MOD)).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/account/license-key.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const licenseKeyMod = TwLicenseKey.createLicenseKey({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const licenseKeyMod = TwLicenseKey.createLicenseKey({", "const licenseKeyMod = TwLicenseKey.createLicenseKey({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwLicenseKey = api;', ''), null, null],


  ['해제 단추가 다른 동작을 부름', m => m.replace("licenseScreenMod.removeThisDevice()", "licenseScreenMod.registerThisDevice()"), null, null],
  ['실패해도 입력칸을 비움', m => m.replace("if(r && r.ok) input.value = '';", "input.value = '';"), null, null],
  ['다시 시도가 받기를 건너뛸 수 있게 함', m => m.replace("licenseScreenMod.open()", "licenseScreenMod.open({ ifNeeded: true })"), null, null],
  ['Enter 가 확인을 안 누름', m => m.replace("if(e.key==='Enter') licKeyEl('licenseSubmitBtn').click();", ""), null, null],
  ['만들 때 던짐', m => m.replace('function createLicenseKey(deps){', 'function createLicenseKey(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2).concat(m2 !== MOD ? await btnRows(m2) : []); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
