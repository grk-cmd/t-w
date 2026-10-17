/* ═══ 🖼️ sim-admin-thumbs.js — 🖼️ 관리자 콘솔 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 관리자 콘솔 썸네일 다시 굽기 본문 을 parts/admin/admin-thumbs.js 로 옮겼다(글자 그대로 · 바뀐 줄 2 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 관리자 아님 · 없는 것만 · force · 올리기 · 끝난 뒤 다시 그리기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 8줄 그대로 · 부르는 곳은 adminThumbs.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
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

const CSRC = ["catalog-source.js","parts/character/catalog-source.js","app/parts/character/catalog-source.js"].map(read).find(Boolean);   // 서버 provider — 4절은 진짜 Firebase 판을 가짜 window 위에 만든다
const mkSource = (win) => { new Function('window', 'module', CSRC)(win, undefined); return win.TwCatalogSource.createCatalogSource({}); };
const FN_DEPS = ["toast"];
const VAL_DEPS = ["adminPartReg","catalogSourceMod","partSceneMod","premiumMod","wardrobeMod"];
const GET_DEPS = ["gachaMod","isAdmin"];
const SET_DEPS = [];
const EXPORTS = [];
const MOVED = [];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  adminPartReg: adminPartReg,","  catalogSourceMod: catalogSourceMod,","  gachaMod: ()=>gachaMod,","  isAdmin: ()=>isAdmin,","  partSceneMod: partSceneMod,","  premiumMod: premiumMod,","  toast: (...a)=>toast(...a),","  wardrobeMod: wardrobeMod,"];

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
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/admin/admin-thumbs.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const adminThumbs = TwAdminThumbs.createAdminThumbs({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const adminThumbs = TwAdminThumbs.createAdminThumbs({", "const adminThumbs = TwAdminThumbs.createAdminThumbs({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwAdminThumbs = api;', ''), null, null],


  ['만들 때 던짐', m => m.replace('function createAdminThumbs(deps){', 'function createAdminThumbs(deps){ throw new Error("깨 봄");'), null, null],
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
  const PREMOVE = !!process.env.TW_PREMOVE;
  const load = (admin, parts, failIds) => {
    const log = { published: [], calls: [], toasts: [], baked: [], parts };
    const gen = async (rec) => { log.baked.push(rec.id); if((failIds || []).includes(rec.id)) return null; if(rec.id === 'boom') throw new Error('x'); return 'data:image/png;' + rec.id; };
    const raw = {
      premiumMod: { savedParts: () => log.parts, persistSavedParts: () => log.calls.push('persist') },
      adminPartReg: { buildPartPublishData: (rec, ex) => ({ id: rec.id, gacha: rec.gacha, ...ex }) },
      wardrobeMod: { renderWardrobe: () => log.calls.push('wardrobe') },
      toast: (m) => log.toasts.push(m),
      isAdmin: admin,
      gachaMod: { renderGachaInv: () => log.calls.push('gacha') },
    };
    const win = { firebaseAPI: { publishPart: async (id, d) => { log.published.push([id, d]); } } };
    const cons = { warn: () => {}, log: () => {} };
    if(!PREMOVE){
      new Function('window', 'module', 'console', MOD)(win, undefined, cons);
      win.TwAdminThumbs.createAdminThumbs(Object.assign({}, raw, { isAdmin: () => admin, gachaMod: () => raw.gachaMod, partSceneMod: { generatePartThumbnail: gen }, catalogSourceMod: mkSource(win) }));
    } else {
      const a = SRC.indexOf('// ★ 관리자 콘솔용: 기존에 등록된 파츠'), b = SRC.indexOf('premiumMod.loadSavedParts();', a);
      const names = Object.keys(raw);
      new Function(...names, 'generatePartThumbnail', 'window', 'console', SRC.slice(a, b))(...names.map(n => raw[n]), gen, win, cons);
    }
    log.run = (f) => win.generateAllPartThumbnails(f);
    log.win = win;
    return log;
  };
  const P = () => [{ id: 'a', fromCatalog: true, gacha: true }, { id: 'b', fromCatalog: true, thumbnail: 'old' }, { id: 'c', fromCatalog: true, thumbUrl: 'http://x' }, { id: 'd' }];
  (async () => {
    let L = load(false, P());
    chk(typeof L.win.generateAllPartThumbnails === 'function', 'window.generateAllPartThumbnails 를 건다(F12 콘솔용)');
    await L.run();
    chk(!L.baked.length && !L.published.length && !L.calls.length && !L.toasts.length, '관리자가 아니면 아무것도 안 한다');
    L = load(true, P()); await L.run();
    chk(L.baked.join() === 'a' && L.published.length === 1 && L.published[0][0] === 'a' && L.published[0][1].thumbnail === 'data:image/png;a' && L.published[0][1].gacha === true, '관리자 — 썸네일 · thumbUrl 둘 다 없는 카탈로그 파츠만 굽고 buildPartPublishData 로 올린다(gacha 칸 유지)');
    chk(L.parts[0].thumbnail === 'data:image/png;a' && L.parts[2].thumbUrl === 'http://x', '  구운 것은 rec.thumbnail 에 · 다른 것은 그대로');
    chk(L.calls.join() === 'persist,wardrobe,gacha' && L.toasts.join() === '썸네일 생성 완료: 1개', '  끝나면 저장 · 꾸미기 창 · 보관함 다시 그리기 · «썸네일 생성 완료: N개»');
    L = load(true, P()); await L.run(true);
    chk(L.baked.join() === 'a,b,c' && !('thumbUrl' in L.parts[2]) && L.parts[1].thumbnail === 'data:image/png;b', 'force — 있는 것도 다시 굽고 낡은 thumbUrl 을 지운다(로컬 전용 파츠 d 는 제외)');
    L = load(true, [{ id: 'a', fromCatalog: true }, { id: 'boom', fromCatalog: true }, { id: 'n', fromCatalog: true }], ['n']); await L.run();
    chk(L.published.map(p => p[0]).join() === 'a' && L.toasts.join() === '썸네일 생성 완료: 1개' && L.calls.length === 3, '굽기 실패(null) · 던짐은 건너뛰고 끝까지 간다(성공 수만 알린다)');
    L = load(true, []); await L.run();
    chk(L.toasts.join() === '썸네일 생성 완료: 0개' && L.calls.length === 3, '경계 — 대상 0개여도 다시 그리고 «0개»');
    L = load(true, P()); L.win.firebaseAPI = null; await L.run();
    chk(L.parts[0].thumbnail && !L.published.length, '서버 연결(firebaseAPI)이 없으면 굽기만 하고 올리지 않는다');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
