/* ═══ 🎁 sim-deco-parts-visibility.js — 🎁 꾸미기 파츠 표시 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 꾸미기 파츠 표시 본문 을 parts/character/deco-parts-visibility.js 로 옮겼다(글자 그대로 · 바뀐 줄 2 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 좌석 트리로 숨기기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(applyDecoPartsVisibility · decoPartsVisible · setDecoPartsVisible)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 1줄 그대로 · 부르는 곳은 decoPartsMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · deco-parts-visibility.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["deco-parts-visibility.js","parts/character/deco-parts-visibility.js","app/parts/character/deco-parts-visibility.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — deco-parts-visibility.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = ["premiumMod"];
const SET_DEPS = [];
const EXPORTS = ["applyDecoPartsVisibility","decoPartsVisible","setDecoPartsVisible"];
const MOVED = ["decoPartsVisible","_decoWrapperShow","applyDecoPartsVisibility"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  premiumMod: ()=>premiumMod,"];

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
    src + '\nreturn window.TwDecoPartsVisibility;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createDecoPartsVisibility(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDecoPartsVisibility = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDecoPartsVisibility(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DECO_PARTS_MOD_OFF") && app.includes("const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const decoPartsMod = TwDecoPartsVisibility\\.createDecoPartsVisibility\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const decoPartsMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 decoPartsMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/deco-parts-visibility.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/deco-parts-visibility.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/deco-parts-visibility.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({", "const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDecoPartsVisibility = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const decoPartsMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('decoPartsMod.' + x)); if(n){ ls[i] = ls[i].replace('decoPartsMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createDecoPartsVisibility(deps){', 'function createDecoPartsVisibility(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 좌석 트리 · 카테고리 표로 숨기기 · 책상 위 예외 · 깃발 저장값 */
say('── 4. 동작 — 꾸미기 파츠 숨기기');
{
  function mk(store, cats){
    const premiumMod = { PART_CATS: () => cats, isDeskPartCat: (info) => !!(info && info.bone === 'desk') };
    const ls = { getItem: (k) => (k in store ? store[k] : null) };
    if(typeof MOD === 'string' && MOD){
      const win = {};
      new Function('window', 'module', 'localStorage', MOD)(win, undefined, ls);
      const m = win.TwDecoPartsVisibility.createDecoPartsVisibility({ premiumMod: () => premiumMod });
      return { apply: m.applyDecoPartsVisibility, isOn: () => m.decoPartsVisible(), set: (v) => m.setDecoPartsVisible(v) };
    }
    const a = SRC.indexOf('/* 🎁 꾸미기 파츠 표시'), b = SRC.indexOf('\n}\n', SRC.indexOf('function applyDecoPartsVisibility(seat){')) + 3;
    return new Function('premiumMod', 'localStorage', SRC.slice(a, b) + '\nreturn { apply: applyDecoPartsVisibility, isOn: () => decoPartsVisible, set: (v) => { decoPartsVisible = v; } };')(premiumMod, ls);
  }
  const CATS = [{ cat: 'hat', bone: 'head' }, { cat: 'mug', bone: 'desk' }];
  const seatOf = () => {
    const objs = [{ userData: { __twPartWrap: true, cat: 'hat' }, visible: true }, { userData: { __twPartWrap: true, cat: 'mug' }, visible: true },
      { userData: { __twPartWrap: true, cat: 'zzz' }, visible: true }, { userData: {}, visible: true }, { visible: true }];
    return { objs, group: { traverse: (cb) => objs.forEach(cb) } };
  };
  chk(mk({}, CATS).isOn() === true && mk({ 'tw.decoParts': '0' }, CATS).isOn() === false && mk({ 'tw.decoParts': '1' }, CATS).isOn() === true, '깃발 — 기본 켜짐 · 저장값 0 이면 꺼짐');
  let D = mk({}, CATS), S = seatOf();
  S.objs.forEach(o => { o.visible = false; }); D.apply(S);
  chk(S.objs.slice(0, 3).every(o => o.visible === true) && S.objs[3].visible === false && S.objs[4].visible === false, '켬 — 파츠 wrapper 는 모두 보이게 · wrapper 가 아닌 것은 안 건드린다');
  D.set(false); S = seatOf(); D.apply(S);
  chk(S.objs[0].visible === false && S.objs[1].visible === true && S.objs[2].visible === false && S.objs[3].visible === true, '끔 — 책상 위 카테고리만 남기고 숨긴다 · 표에 없는 카테고리도 숨긴다');
  D = mk({ 'tw.decoParts': '0' }, null); S = seatOf(); D.apply(S);
  chk(S.objs[1].visible === false, '  카테고리 표가 아직 없으면 책상 위도 숨긴다(옮기기 전과 같다)');
  let threw = null;
  try{ D.apply(null); D.apply({}); D.apply({ group: { traverse: () => { throw new Error('x'); } } }); }catch(e){ threw = e; }
  chk(!threw, '빈 좌석 · group 없음 · traverse 가 던져도 조용히 지나간다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
