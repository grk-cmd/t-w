/* ═══ 🎨 sim-wardrobe-panel.js — 🎨 꾸미기 사이드 패널 열고 닫기(bindWardrobe) 모듈 구조 (2026-10-14 신설 · 앱 FSD 48번) ═══════════════
   app.js 의 꾸미기 사이드 패널 구역 본문 을 parts/character/wardrobe-panel.js 로 옮겼다(글자 그대로 · 바뀐 줄 9 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(꾸미기 사이드 패널 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 5줄 그대로 · 부르는 곳은 wdPanelMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · wardrobe-panel.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["wardrobe-panel.js","parts/character/wardrobe-panel.js","app/parts/character/wardrobe-panel.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — wardrobe-panel.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["twNav"];
const GET_DEPS = ["wardrobeMod"];
const SET_DEPS = [];
const EXPORTS = [];
const MOVED = [];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  wardrobeMod: ()=>wardrobeMod,","  twNav: twNav,"];

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
    src + '\nreturn window.TwWardrobePanel;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createWardrobePanel(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwWardrobePanel = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwWardrobePanel(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("WD_PANEL_MOD_OFF") && app.includes("const wdPanelMod = TwWardrobePanel.createWardrobePanel({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const wdPanelMod = TwWardrobePanel\\.createWardrobePanel\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const wdPanelMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 wdPanelMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/wardrobe-panel.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/wardrobe-panel.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 📚 여닫기 · 탭 — 가짜 DOM(버튼 · 창) 위에서 실제로 눌러 본다(#540 P2 — 라이선스 검사는 탭마다 꾸미기 창이 한다) */
function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const mkEl = () => { const cls = new Set(), on = {}; return { cls, on, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    addEventListener: (k, fn) => { (on[k] = on[k] || []).push(fn); }, contains: () => false }; };
  const els = { myWardrobeBtn: mkEl(), wardrobePanel: mkEl(), wardrobeClose: mkEl() };
  const docOn = {}, winOn = {};
  const document = { getElementById: id => els[id] || null, addEventListener: (k, fn) => { (docOn[k] = docOn[k] || []).push(fn); }, querySelectorAll: () => [], querySelector: () => null };
  const log = [];
  let tab = null;
  const wm = { ALBUM_TAB: 'album', selectWdTab: (x, o) => { log.push('tab:' + (x || '-') + (o && o.skipSync ? '+skip' : '')); if(x) tab = x; }, isAlbumTab: () => tab === 'album',
    renderWardrobe: () => log.push('render'), syncWdPreviewOwner: () => {}, refreshWdPreviewChar: () => {}, commitWdDraft: () => log.push('commit'), detachWdGizmo: () => {} };
  const navFns = {};
  const twNav = { NAV: { WARDROBE_ALBUM: 'wardrobeAlbum', PROGRAM_SETTINGS: 'programSettings' }, on: (n, fn) => { navFns[n] = fn; }, go: (n, ...a) => { log.push('nav:' + n); return navFns[n] && navFns[n](...a); } };
  const win = { addEventListener: (k, fn) => { (winOn[k] = winOn[k] || []).push(fn); } };
  let api;
  try{ api = new Function('window', 'document', 'module', src + '\nreturn window.TwWardrobePanel;')(win, document, undefined).createWardrobePanel({ wardrobeMod: () => wm, twNav }); }
  catch(e){ t(false, '가짜 DOM 위에서 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  const on = () => els.wardrobePanel.classList.contains('on');
  els.myWardrobeBtn.on.click[0]({ stopPropagation(){} });
  t(on() && log.join() === 'tab:-,render' && !log.some(x => /^nav:/.test(x)), 'F2(버튼) — 라이선스 없이도 연다 · 탭은 꾸미기 창이 정한다(마지막에 본 탭) · 설정 창으로 보내지 않는다');
  els.myWardrobeBtn.on.click[0]({ stopPropagation(){} });
  t(!on() && log[log.length - 1] === 'commit', '  다시 누르면 닫고 저장');
  t(api && !('toggleAlbum' in api), 'T 단축키 고리가 없다 — 도감은 F2(꾸미기 창)의 «📚 도감» 탭');
  els.myWardrobeBtn.on.click[0]({ stopPropagation(){} });
  docOn.keydown[0]({ key: 'Escape' });
  t(!on(), 'ESC — 닫는다');
  log.length = 0; twNav.go('wardrobeAlbum', { skipSync: true });
  t(on() && log.join() === 'nav:wardrobeAlbum,tab:album+skip,render', '뽑기 창 [도감으로] — 통로(WARDROBE_ALBUM)로 «도감» 탭을 연다 · skipSync 를 도감 탭까지 그대로 넘긴다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 여닫기 · 탭');
behave(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/wardrobe-panel.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const wdPanelMod = TwWardrobePanel.createWardrobePanel({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const wdPanelMod = TwWardrobePanel.createWardrobePanel({", "const wdPanelMod = TwWardrobePanel.createWardrobePanel({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwWardrobePanel = api;', ''), null, null],


  ['만들 때 던짐', m => m.replace('function createWardrobePanel(deps){', 'function createWardrobePanel(deps){ throw new Error("깨 봄");'), null, null],
];
/* 동작을 일부러 깨 본다 — 2-2절이 빨갛게 되어야 한다 */
const behaveBreaks = [
  ['[도감으로] 가 opts 를 버림', m => m.replace('open(wardrobeMod().ALBUM_TAB, opts); });', 'open(wardrobeMod().ALBUM_TAB); });')],
  ['[도감으로] 통로를 안 걺', m => m.replace("twNav.on(twNav.NAV.WARDROBE_ALBUM,", "(()=>0)(twNav.NAV.WARDROBE_ALBUM,")],
  ['다시 연 창이 저장 안 함', m => m.replace("wardrobeMod().commitWdDraft();   // ★", "0;   // ★")],
];
for(const [name, fm] of behaveBreaks){
  const m2 = fm(MOD);
  chk(m2 !== MOD && behave(m2).some(([ok]) => !ok), '동작 깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
