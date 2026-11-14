/* ═══ 📢 sim-ad-banner.js — 📢 런처 광고 배너 · ⚙️ 게임 설정(사용자 쪽 모듈 구조 (2026-10-14 신설 · 앱 FSD 43번) ═══════════════
   app.js 의 광고 배너 · 게임 설정 구역 본문 을 parts/launcher/ad-banner.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(광고 배너 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(AD_BANNER_KEY · _gameCfg · slides · refreshAdBanner)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 2줄 그대로 · 부르는 곳은 adBannerMod.이름 · html(app.js 앞)
   ・2-2절: 서버 배너 — 공지 한 판이 바뀔 때 그린다(그림 · 링크 · 숨김) · 같은 배너면 다시 안 그림 · 설정 패널 배너도 같이 · 이 PC 에 사본(localStorage)을 안 남김
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · ad-banner.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["ad-banner.js","parts/launcher/ad-banner.js","app/parts/launcher/ad-banner.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — ad-banner.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["noticeFeed","settingsMod"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["AD_BANNER_KEY","_gameCfg","slides","refreshAdBanner"];
const MOVED = ["AD_BANNER_KEY","_lcAdSlides","_lcAdIdx","_lcAdTimer","refreshAdBanner","_gameCfg","_applyGameCfg"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  noticeFeed: noticeFeed,","  settingsMod: settingsMod,"];

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
    src + '\nreturn window.TwAdBanner;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createAdBanner(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwAdBanner = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwAdBanner(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("AD_BANNER_MOD_OFF") && app.includes("const adBannerMod = TwAdBanner.createAdBanner({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const adBannerMod = TwAdBanner\\.createAdBanner\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const adBannerMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 adBannerMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/launcher/ad-banner.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/ad-banner.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 서버 배너');
function bannerRun(src){
  const els = {};
  const mkEl = () => ({ style: {}, href: '', src: '', addEventListener(){}, getAttribute(){ return null; } });
  const doc = { getElementById: (id) => els[id] || (els[id] = mkEl()) };
  const slides = { v: [] }, subs = [], log = { fs: 0, ls: 0 };
  const noticeFeed = { banner: () => slides.v, onChange: (fn) => { subs.push(fn); return () => {}; } };
  const settingsMod = { refreshFsAdBanner: () => { log.fs++; } };
  const ls = { getItem: () => null, setItem: () => { log.ls++; }, removeItem: () => { log.ls++; } };
  const TwSafeHtml = { safeUrl: (u) => u };
  const TwNetReady = { whenNetReady: () => {} };
  const win = {};
  const api = new Function('window', 'document', 'localStorage', 'TwSafeHtml', 'TwNetReady', 'setInterval', 'clearInterval', 'module', src + '\nreturn window.TwAdBanner;')(win, doc, ls, TwSafeHtml, TwNetReady, () => 1, () => {}, undefined);
  const out = api.createAdBanner({ noticeFeed, settingsMod });
  return { els, slides, subs, log, out };
}
function judgeBanner(mod){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const b = bannerRun(mod);
  t(b.els.lcAdBanner.style.display === 'none', '받기 전에는 배너를 숨긴다');
  b.slides.v = [{ img: 'https://x/a.png', link: 'https://x/l' }];
  b.subs.forEach(f => f());
  t(b.els.lcAdBanner.style.display === 'block' && b.els.lcAdBannerImg.src === 'https://x/a.png' && b.els.lcAdBanner.href === 'https://x/l', '공지 한 판이 바뀌면 배너를 그린다(그림 · 링크)');
  t(b.log.fs === 1, '  설정 패널 배너도 같이 다시 그린다');
  b.subs.forEach(f => f());
  t(b.log.fs === 1, '배너가 그대로면 다시 그리지 않는다(슬라이드 순서를 처음으로 돌리지 않게)');
  b.slides.v = [];
  b.subs.forEach(f => f());
  t(b.els.lcAdBanner.style.display === 'none' && b.log.fs === 2, '서버에서 배너를 내리면 숨긴다');
  t(b.log.ls === 0 && b.out.slides().length === 0, '이 PC 에 사본(localStorage)을 남기지 않는다 · slides() 는 서버가 준 것');
  return r;
}
judgeBanner(MOD).forEach(([ok, msg]) => chk(ok, msg));

say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const cases = [
    ['같은 배너도 다시 그림', MOD.replace("if(key === _shownKey) return;", "")],
    ['받아도 안 그림', MOD.replace("  refreshAdBanner();\n  settingsMod.refreshFsAdBanner();\n});", "  settingsMod.refreshFsAdBanner();\n});")],
    ['이 PC 사본을 남김', MOD.replace("_shownKey = key;", "_shownKey = key; localStorage.setItem(AD_BANNER_KEY, key);")],
    ['설정 패널은 안 그림', MOD.replace("  settingsMod.refreshFsAdBanner();\n});", "});")],
  ];
  for(const [name, m2] of cases){
    let bad; try{ bad = judgeBanner(m2).some(([ok]) => !ok); }catch(_){ bad = true; }
    chk(m2 !== MOD && bad, name + ' → 빨강');
  }
}
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/ad-banner.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const adBannerMod = TwAdBanner.createAdBanner({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const adBannerMod = TwAdBanner.createAdBanner({", "const adBannerMod = TwAdBanner.createAdBanner({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwAdBanner = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const adBannerMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('adBannerMod.' + x)); if(n){ ls[i] = ls[i].replace('adBannerMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createAdBanner(deps){', 'function createAdBanner(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
