/* ═══ 🧸 sim-desk-items.js — 🧸 책상 위 아이템 등록부 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 책상 위 아이템 등록부 본문 을 parts/character/desk-items.js 로 옮겼다(글자 그대로 · 바뀐 줄 2 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 등록 · 메타 채우기 · 기본값 · 머티리얼 복제 · 합친 목록).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(allDeskItems · deskItemDef · registerCustomItem)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 4줄 그대로 · 부르는 곳은 deskItemsMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · desk-items.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["desk-items.js","parts/character/desk-items.js","app/parts/character/desk-items.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — desk-items.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_applyItemMatTone"];
const VAL_DEPS = ["DESK_ITEMS","commissionMod"];
const GET_DEPS = ["customItems"];
const SET_DEPS = [];
const EXPORTS = ["allDeskItems","deskItemDef","registerCustomItem"];
const MOVED = ["_savedItemMeta","registerCustomItem","allDeskItems","deskItemDef"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  DESK_ITEMS: DESK_ITEMS,","  _applyItemMatTone: (...a)=>_applyItemMatTone(...a),","  commissionMod: commissionMod,","  customItems: ()=>customItems,"];

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
    src + '\nreturn window.TwDeskItems;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createDeskItems(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDeskItems = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDeskItems(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DESK_ITEMS_MOD_OFF") && app.includes("const deskItemsMod = TwDeskItems.createDeskItems({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const deskItemsMod = TwDeskItems\\.createDeskItems\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const deskItemsMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 deskItemsMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/desk-items.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/desk-items.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/desk-items.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const deskItemsMod = TwDeskItems.createDeskItems({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const deskItemsMod = TwDeskItems.createDeskItems({", "const deskItemsMod = TwDeskItems.createDeskItems({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDeskItems = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const deskItemsMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('deskItemsMod.' + x)); if(n){ ls[i] = ls[i].replace('deskItemsMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createDeskItems(deps){', 'function createDeskItems(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 등록부 · 저장 레코드 위에서 등록 · 메타 채우기 · 복제 · 합친 목록(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 아이템 등록 · 목록');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const load = (saved, opt) => {
    const o = opt || {};
    const log = { tone: [] };
    const customItems = {};
    const raw = {
      DESK_ITEMS: [{ id: 'plant' }, { id: 'cup' }, { id: 'books' }],
      commissionMod: { savedItems: () => { if(o.savedThrows) throw new ReferenceError('TDZ'); return saved; } },
      _applyItemMatTone: (m) => log.tone.push(m),
      customItems,
    };
    const THREE_ = { SkeletonUtils: o.skel ? { clone: (t) => { log.skel = true; return t.clone(true); } } : undefined };
    let api;
    if(!PREMOVE){
      const w = {}; new Function('window', 'module', 'THREE', MOD)(w, undefined, THREE_);
      api = w.TwDeskItems.createDeskItems(Object.assign({}, raw, { customItems: () => customItems }));
    } else {
      const a = SRC.indexOf('/* 🩹 [2026-10-02 제보 #11]'), b = SRC.indexOf('/* 커스텀 책상: 기본 책상 메쉬', a);
      const names = Object.keys(raw);
      api = new Function(...names, 'THREE', SRC.slice(a, b) + '\nreturn { registerCustomItem, allDeskItems, deskItemDef };')(...names.map(n => raw[n]), THREE_);
    }
    return { api, log, customItems };
  };
  const mkTpl = () => { const m1 = { n: 1, clone(){ return { n: 'c1' }; } }, m2 = { n: 2, clone(){ return { n: 'c2' }; } }, m3 = { n: 3, clone(){ return { n: 'c3' }; } };
    const meshA = { isMesh: true, material: m1 }, meshB = { isMesh: true, material: [m2, null] }, grp = { isMesh: false, material: m3 };
    return { m1, m2, m3, clone(deep){ const a = Object.assign({}, meshA), b = Object.assign({}, meshB), g = Object.assign({}, grp); return { deep, parts: [a, b, g], traverse(cb){ [a, b, g].forEach(cb); } }; } }; };
  let { api, log, customItems } = load([]);
  const tpl = mkTpl();
  api.registerCustomItem('x', '이름', 'GLB', tpl);
  const d = customItems.x;
  chk(d && d.id === 'x' && d.name === '이름' && d.glb === 'GLB' && d.custom === true && d.icon === '' && d.attachTo === 'desk' && d.autoPlay === false && d.playMode === 'click' && d.defaultSize === 0.8 && d.glow === false && d.licenseOnly === false && Array.isArray(d.animations) && !d.animations.length, '메타 없이 등록 — 기본값(책상 위 · 클릭 재생 · 크기 0.8 · 빛 · 전용 아님)');
  api.registerCustomItem('y', 'n', 'G', tpl, '🌱', ['a'], 'handL', true, 0, 1, 1);
  const e = customItems.y;
  chk(e.attachTo === 'handL' && e.autoPlay === true && e.playMode === 'auto' && e.defaultSize === 0 && e.glow === true && e.licenseOnly === true && e.icon === '🌱' && e.animations[0] === 'a', '  인자로 온 값이 이긴다 — autoPlay 면 재생 모드 auto · 크기 0 도 그대로(0 은 «없음» 이 아님)');
  api.registerCustomItem('z', 'n', 'G', tpl, '', null, null, true, null, null, null, 'idle');
  chk(customItems.z.playMode === 'idle', '  재생 모드를 주면 autoPlay 보다 먼저');
  ({ api, log, customItems } = load([{ id: 'm', attachTo: 'handR', autoPlay: false, defaultSize: 1.5, glow: true, licenseOnly: true, playMode: 'idle', icon: '🍵' }, null]));
  api.registerCustomItem('m', 'n', 'G', tpl, '', []);
  const f = customItems.m;
  chk(f.attachTo === 'handR' && f.defaultSize === 1.5 && f.glow === true && f.licenseOnly === true && f.playMode === 'idle' && f.icon === '🍵', '인자로 안 온 메타는 같은 id 의 저장 레코드에서 채운다(부팅 직후 크기 0.8 고정 회귀 방지)');
  api.registerCustomItem('m', 'n', 'G', tpl, '☕', [], 'desk', null, 2);
  chk(customItems.m.icon === '☕' && customItems.m.attachTo === 'desk' && customItems.m.defaultSize === 2 && customItems.m.playMode === 'idle', '  인자로 온 것은 저장 레코드보다 먼저');
  ({ api, customItems } = load(null, { savedThrows: true }));
  let thr = null; try{ api.registerCustomItem('q', 'n', 'G', tpl); }catch(err){ thr = err; }
  chk(!thr && customItems.q.defaultSize === 0.8, '  저장 목록을 아직 못 읽으면(선언 전 · 배열 아님) 메타 없이 등록');
  ({ api, customItems } = load('not-array'));
  api.registerCustomItem('r', 'n', 'G', tpl); chk(customItems.r.defaultSize === 0.8, '  저장 목록이 배열이 아니어도 메타 없이');

  ({ api, log, customItems } = load([]));
  const t2 = mkTpl(); api.registerCustomItem('b', 'n', 'G', t2);
  const built = customItems.b.build();
  const [A, B, G] = built.parts;
  chk(built.deep === true && A.castShadow === true && B.castShadow === true && G.castShadow === undefined, 'build — 템플릿을 clone(true)로 복제 · 메쉬만 그림자');
  chk(A.material.n === 'c1' && B.material[0].n === 'c2' && B.material[1] === null && G.material.n === 3 && t2.m1.n === 1, '  메쉬마다 머티리얼도 복제(친구 좌석과 색을 같이 안 쓰게) · 배열 · 빈 칸 · 메쉬 아닌 것');
  chk(log.tone.map(m => m && m.n).join() === 'c1,c2,' , '  복제한 머티리얼마다 아이템 톤을 먹인다');
  ({ api, log, customItems } = load([], { skel: true }));
  api.registerCustomItem('s', 'n', 'G', mkTpl()); customItems.s.build();
  chk(log.skel === true, '  SkeletonUtils 가 있으면 그것으로 복제(본 있는 모델)');

  ({ api, customItems } = load([]));
  chk(api.allDeskItems().map(d => d.id).join() === 'plant,cup,books' && api.deskItemDef('cup').id === 'cup' && api.deskItemDef('none') === null, 'allDeskItems — 커스텀이 없으면 기본 셋 · deskItemDef 는 없으면 null');
  api.registerCustomItem('cup', '내 컵', 'G', mkTpl()); api.registerCustomItem('new', 'n', 'G', mkTpl());
  chk(api.allDeskItems().map(d => d.id).join() === 'cup,new,plant,books' && api.deskItemDef('cup').custom === true, '  같은 id 로 등록하면 커스텀이 기본을 바꿔 낀다(커스텀이 앞)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
