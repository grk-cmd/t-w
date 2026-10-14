/* ═══ 📦 sim-commission.js — 📦 커미션 zip 풀기 · 암호화 · 💾 저장 책상 · 아이템(savedDesks · savedItems) 모듈 구조 (2026-10-14 신설 · 앱 FSD 45번) ═══════════════
   app.js 의 커미션 · 저장 에셋 구역 본문 을 parts/character/commission.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(커미션 · 저장 에셋 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(MAX_COMMISSION_BYTES · MAX_CUSTOM_ASSETS · MAX_CUSTOM_ITEMS · MAX_GLB_BYTES · decryptCommission · encryptCommission · persistSavedAssets · savedDesks · setSavedDesks · savedItems · setSavedItems · unpackCommissionZip)
     만들 때 deps 함수를 되부르지 않는다 — 만드는 도중엔 app.js 의 commissionMod 가 아직 없어(TDZ) 되부른 함수가 던진다(부팅 저장 아이템 등록이 깨졌던 사고)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 4줄 그대로 · 부르는 곳은 commissionMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · commission.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["commission.js","parts/character/commission.js","app/parts/character/commission.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — commission.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_b64","_deriveKey","_unb64","toast"];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["MAX_COMMISSION_BYTES","MAX_CUSTOM_ASSETS","MAX_CUSTOM_ITEMS","MAX_GLB_BYTES","decryptCommission","encryptCommission","persistSavedAssets","savedDesks","setSavedDesks","savedItems","setSavedItems","unpackCommissionZip"];
const MOVED = ["MAX_COMMISSION_BYTES","COMMISSION_TEX_SIZE","resizeImgBlobTo","unpackCommissionZip","encryptCommission","decryptCommission","SAVED_DESK_KEY","SAVED_ITEM_KEY","MAX_CUSTOM_ASSETS","MAX_CUSTOM_ITEMS","MAX_GLB_BYTES","savedDesks","savedItems","loadSavedAssets","persistSavedAssets"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  _b64: (...a)=>_b64(...a),","  _deriveKey: (...a)=>_deriveKey(...a),","  _unb64: (...a)=>_unb64(...a),","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  build.called = [];
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => { build.called.push(n); return any; }; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwCommission;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createCommission(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  const reentry = build.called.slice();
  t(!err && !reentry.length, '만들 때 deps 함수를 되부르지 않는다(만드는 도중엔 commissionMod 가 아직 없다)' + (reentry.length ? ' — ' + reentry.join(' · ') : ''));
  t(/^\}\);\n(?:\/\*[\s\S]*?\*\/\n)?loadSavedItemsIntoSession\(\);$/m.test(app.slice(app.indexOf('const commissionMod = '))), 'app.js — 저장 아이템 등록(loadSavedItemsIntoSession)은 만드는 줄 바로 뒤에서 부른다');
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCommission = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCommission(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const COMMISSION_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기") && app.includes("const commissionMod = (typeof TwCommission === 'undefined') ? COMMISSION_MOD_OFF : TwCommission.createCommission({"), '모듈이 없으면 빈 껍데기 · 만드는 줄');
  const mk = (app.match(new RegExp('const commissionMod = \\(typeof TwCommission === \'undefined\'\\) \\? COMMISSION_MOD_OFF : TwCommission\\.createCommission\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const commissionMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 commissionMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/commission.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/commission.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 5) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/commission.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const commissionMod = (typeof TwCommission === 'undefined') ? COMMISSION_MOD_OFF : TwCommission.createCommission({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const commissionMod = (typeof TwCommission === 'undefined') ? COMMISSION_MOD_OFF : TwCommission.createCommission({", "const commissionMod = (typeof TwCommission === 'undefined') ? COMMISSION_MOD_OFF : TwCommission.createCommission({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCommission = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const commissionMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('commissionMod.' + x)); if(n){ ls[i] = ls[i].replace('commissionMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 deps 를 되부름', m => m.replace('loadSavedAssets();\n\nreturn {', 'loadSavedAssets();\ntoast("깨 봄");\n\nreturn {'), null, null],
  ['부팅 등록 줄 빠짐', null, a => a.replace('\nloadSavedItemsIntoSession();\n', '\n'), null],
  ['만들 때 던짐', m => m.replace('function createCommission(deps){', 'function createCommission(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
