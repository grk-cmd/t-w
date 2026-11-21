/* ═══ 🖼️ sim-admin-thumbs.js — 🖼️ 관리자 콘솔 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 관리자 콘솔 썸네일 다시 굽기 본문 을 parts/admin/admin-thumbs.js 로 옮겼다(D11-4 — 올리기는 서버 카탈로그 쓰기 catalogAdmin). 4절이 동작을 본다(관리자 아님 · 없는 것만 · force · 서버에 쓰기 · 끝난 뒤 한 번 다시 받기 · 다시 그리기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 7줄 그대로 · 부르는 곳은 adminThumbs.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · admin-thumbs.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["admin-thumbs.js","parts/admin/admin-thumbs.js","app/parts/admin/admin-thumbs.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — admin-thumbs.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const CAA = ["catalog-admin-api.js","parts/admin/catalog-admin-api.js","app/parts/admin/catalog-admin-api.js"].map(read).find(Boolean);   // 서버 쓰기 길 — 올리는 본문 모양은 실제 모듈로 본다
if(!CAA){ say('  ? 원본 못 찾음 — catalog-admin-api.js'); process.exit(2); }
const FN_DEPS = ["toast"];
const VAL_DEPS = ["catalogAdmin","partSceneMod","premiumMod","wardrobeMod"];
const GET_DEPS = ["gachaMod","isAdmin"];
const SET_DEPS = [];
const EXPORTS = [];
const MOVED = [];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  catalogAdmin: catalogAdmin,","  gachaMod: ()=>gachaMod,","  isAdmin: ()=>isAdmin,","  partSceneMod: partSceneMod,","  premiumMod: premiumMod,","  toast: (...a)=>toast(...a),","  wardrobeMod: wardrobeMod,"];

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
    src + '\nreturn window.TwAdminThumbs;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createAdminThumbs(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwAdminThumbs = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwAdminThumbs(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("ADMIN_THUMBS_OFF") && app.includes("const adminThumbs = TwAdminThumbs.createAdminThumbs({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const adminThumbs = TwAdminThumbs\\.createAdminThumbs\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const adminThumbs = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 adminThumbs.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/admin/admin-thumbs.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/admin/admin-thumbs.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/admin/admin-thumbs.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const adminThumbs = TwAdminThumbs.createAdminThumbs({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const adminThumbs = TwAdminThumbs.createAdminThumbs({", "const adminThumbs = TwAdminThumbs.createAdminThumbs({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwAdminThumbs = api;', ''), null, null],


  ['만들 때 던짐', m => m.replace('function createAdminThumbs(deps){', 'function createAdminThumbs(deps){ throw new Error("mutation");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 굽기 · 올리기 위에서 콘솔 다시 굽기(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — generateAllPartThumbnails');
{
  const load = (admin, parts, failIds) => {
    const log = { saved: [], calls: [], toasts: [], baked: [], parts };
    const gen = async (rec) => { log.baked.push(rec.id); if((failIds || []).includes(rec.id)) return null; if(rec.id === 'boom') throw new Error('x'); return 'data:image/png;base64,QUJD'; };
    const raw = {
      premiumMod: { savedParts: () => log.parts },
      wardrobeMod: { renderWardrobe: () => log.calls.push('wardrobe') },
      toast: (m) => log.toasts.push(m),
      isAdmin: admin,
      gachaMod: { renderGachaInv: () => log.calls.push('gacha') },
    };
    const win = {};
    const cons = { warn: () => {}, log: () => {} };
    const caa = (() => { const m = { exports: {} }; new Function('window', 'module', CAA)({}, m); return m.exports; })();
    log.catalogAdmin = { partFieldsOf: caa.partFieldsOf, savePart: async (id, f, opt) => { log.saved.push([id, f, opt]); }, reload: async () => { log.calls.push('reload'); } };
    new Function('window', 'module', 'console', MOD)(win, undefined, cons);
    win.TwAdminThumbs.createAdminThumbs(Object.assign({}, raw, { catalogAdmin: log.catalogAdmin, isAdmin: () => admin, gachaMod: () => raw.gachaMod, partSceneMod: { generatePartThumbnail: gen } }));
    log.run = (f) => win.generateAllPartThumbnails(f);
    log.win = win;
    return log;
  };
  const P = () => [{ id: 'a', fromCatalog: true, gacha: true }, { id: 'b', fromCatalog: true, thumbnail: 'old' }, { id: 'c', fromCatalog: true, thumbUrl: 'http://x' }, { id: 'd' }];
  (async () => {
    let L = load(false, P());
    chk(typeof L.win.generateAllPartThumbnails === 'function', 'window.generateAllPartThumbnails 를 건다(F12 콘솔용)');
    await L.run();
    chk(!L.baked.length && !L.saved.length && !L.calls.length && !L.toasts.length, '관리자가 아니면 아무것도 안 한다');
    L = load(true, P()); await L.run();
    chk(L.baked.join() === 'a' && L.saved.length === 1 && L.saved[0][0] === 'a' && L.saved[0][1].gacha === true && L.saved[0][2].quiet === true && L.saved[0][1].thumbDataUrl === 'data:image/png;base64,QUJD',
      '관리자 — 썸네일 · thumbUrl 둘 다 없는 카탈로그 파츠만 굽고 서버 카탈로그에 쓴다(구운 그림 data:image/png 글 · 나머지 칸은 서버 줄 그대로 — gacha 유지)');
    chk(L.calls.join() === 'reload,wardrobe,gacha' && L.toasts.join() === '썸네일 생성 완료: 1개', '  끝나면 서버 한 벌을 한 번 다시 받고 · 꾸미기 창 · 보관함 다시 그리기 · «썸네일 생성 완료: N개»');
    L = load(true, P()); await L.run(true);
    chk(L.baked.join() === 'a,b,c' && L.saved.length === 3 && L.calls.filter(x => x === 'reload').length === 1, 'force — 있는 것도 다시 굽고 쓴다(로컬 전용 파츠 d 는 제외) · 여럿을 써도 다시 받기는 한 번');
    L = load(true, [{ id: 'a', fromCatalog: true }, { id: 'boom', fromCatalog: true }, { id: 'n', fromCatalog: true }], ['n']); await L.run();
    chk(L.saved.map(p => p[0]).join() === 'a' && L.toasts.join() === '썸네일 생성 완료: 1개' && L.calls.length === 3, '굽기 실패(null) · 던짐은 건너뛰고 끝까지 간다(성공 수만 알린다)');
    L = load(true, []); await L.run();
    chk(L.toasts.join() === '썸네일 생성 완료: 0개' && L.calls.length === 3, '경계 — 대상 0개여도 다시 그리고 «0개»');
    chk(!/firebaseAPI/.test(strip(MOD)), '서버 쓰기는 catalogAdmin 으로만 — firebaseAPI 를 직접 부르지 않는다');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
