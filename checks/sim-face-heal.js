/* ═══ 🛡️ sim-face-heal.js — 🛡️ 얼굴 자동 복구 모듈 구조 (2026-10-14 신설 · 앱 FSD 43번) ═══════════════
   app.js 의 얼굴 자동 복구 구역 본문 을 parts/character/face-heal.js 로 옮겼다(글자 그대로 · 바뀐 줄 1 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(얼굴 자동 복구 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(FACE_WATCH_MS · repairBlankFaces)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 18줄 그대로 · 부르는 곳은 faceHealMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 남의 좌석 · 동물 좌석 그림 복구(repairSeatTextures · reportGlReset)를 가짜 캔버스 위에서 실제로 돌린다 —
          남의 빈 얼굴 → 받아 둔 주소로 다시 그림 · 동물 빈 그림 → 기억한 원본으로 · 원본 없음 → 바탕만 · 받기 실패 → 기록 ·
          얼굴을 안 그린 친구(합성본 멀쩡)는 안 건드림 · 피부가 비면 다음 차례 · 내 칸 복구가 피부 PNG 를 기다리는 동안 건너뜀 ·
          받는 사이에 피부가 비면 합성을 다음 차례로 · 허용 안 되는 주소는 안 그림 · 리셋 진단 한 줄 ·
          원래 주소가 실패로 캐시된 PC — 표식 주소로 한 번 더 받아 그림(진짜 img-retry.js) · 깨 보기
   [실행] app.js · desk-companion-prototype.html · face-heal.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["face-heal.js","parts/character/face-heal.js","app/parts/character/face-heal.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — face-heal.js'); process.exit(2); }
const RETRY_SRC = ["img-retry.js","parts/shared/img-retry.js","app/parts/shared/img-retry.js"].map(read).find(Boolean);
if(!RETRY_SRC){ say('  ? 원본 못 찾음 — img-retry.js'); process.exit(2); }
const IMG_RETRY = (() => { const m = { exports: {} }; new Function('window', 'module', RETRY_SRC)(undefined, m); return m.exports; })();
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_isBlankDraw","loadImg","loadSkins","skinCanvasFor","toast","diagNote","loadImgCors"];
const VAL_DEPS = ["CANVAS_SZ","CHAR_SLOT_MAX","LS_KEY","Presence","SKIN_COLORS","_blinkEverDrawn","_faceEverDrawn","seats","skinCanvases","slots"];
const GET_DEPS = ["creatorOpen"];
const SET_DEPS = [];
const EXPORTS = ["FACE_WATCH_MS","repairBlankFaces","repairSeatTextures","reportGlReset"];
const MOVED = ["FACE_WATCH_MS","FACE_TOAST_GAP_MS","_faceRepairBusy","_faceRepairToldAt","_repairSkinCanvases","_redrawInto","_refreshSeatFaceTex","_seatCompositeBlank","repairBlankFaces"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CANVAS_SZ: CANVAS_SZ,","  CHAR_SLOT_MAX: CHAR_SLOT_MAX,","  LS_KEY: LS_KEY,","  Presence: Presence,","  SKIN_COLORS: SKIN_COLORS,","  _blinkEverDrawn: _blinkEverDrawn,","  _faceEverDrawn: _faceEverDrawn,","  _isBlankDraw: (...a)=>_isBlankDraw(...a),","  creatorOpen: ()=>creatorOpen,","  loadImg: (...a)=>loadImg(...a),","  loadSkins: (...a)=>loadSkins(...a),","  seats: seats,","  skinCanvasFor: (...a)=>skinCanvasFor(...a),","  skinCanvases: skinCanvases,","  slots: slots,","  toast: (...a)=>toast(...a),","  diagNote: (...a)=>{ if(window.companion && companion.diagNote) companion.diagNote(...a); },","  loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),"];

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
    src + '\nreturn window.TwFaceHeal;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createFaceHeal(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwFaceHeal = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwFaceHeal(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("FACE_HEAL_MOD_OFF") && app.includes("const faceHealMod = TwFaceHeal.createFaceHeal({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const faceHealMod = TwFaceHeal\\.createFaceHeal\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const faceHealMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 faceHealMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/face-heal.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/face-heal.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/face-heal.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const faceHealMod = TwFaceHeal.createFaceHeal({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const faceHealMod = TwFaceHeal.createFaceHeal({", "const faceHealMod = TwFaceHeal.createFaceHeal({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwFaceHeal = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const faceHealMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('faceHealMod.' + x)); if(n){ ls[i] = ls[i].replace('faceHealMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createFaceHeal(deps){', 'function createFaceHeal(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say('── 4. 남의 좌석 · 동물 좌석 그림 복구 — 실제로 돌린다');
/* 가짜 캔버스 — 칠하면 안 빈 것, 지우면 빈 것. 그린 원본을 기억한다 */
const mkCv = (blank, w, src) => { const c = { blank: !!blank, width: w || 512, height: w || 512, drawn: [], src };
  c.getContext = () => ({ clearRect(){ c.blank = true; }, fillRect(){ c.blank = false; }, set fillStyle(v){ c.fill = v; },
    drawImage(img){ if(img && img.blank) return; c.blank = false; c.drawn.push(img && img.src); } }); return c; };
function seatEnv(src, o){
  const notes = [];
  const skins = o.skins || [mkCv(false)];
  const deps = {
    CANVAS_SZ: 512, CHAR_SLOT_MAX: 3, LS_KEY: 'k', Presence: { active: () => true }, SKIN_COLORS: ['#fff'],
    _blinkEverDrawn: [], _faceEverDrawn: [], _isBlankDraw: (cv) => !cv || !!cv.blank, creatorOpen: () => false,
    loadImg: async (u) => ({ src: u }), loadSkins: o.loadSkins || (async () => {}), seats: o.seats, skinCanvasFor: () => skins[0],
    skinCanvases: skins, slots: [], toast: () => {}, diagNote: (m) => notes.push(m),
    loadImgCors: o.loadImgCors || (async (u) => {
      if(u.startsWith('https://bad.test/')) throw new Error('net');                       // 표식 주소로도 못 받음
      if(u.startsWith('https://stale.test/') && !/twr=1/.test(u)) throw new Error('cors'); // 원래 주소만 실패로 캐시된 PC
      o.got && o.got.push(u); return { src: u }; }),
  };
  const safe = { safeUrl: (u) => (/^https:\/\//.test(String(u)) ? u : '') };
  const api = new Function('window', 'module', 'TwSafeHtml', 'TwImgRetry', 'localStorage', 'performance', src + '\nreturn window.TwFaceHeal;')({}, undefined, safe, IMG_RETRY, { getItem: () => null }, { now: () => 0 });
  return { M: api.createFaceHeal(deps), notes };
}
const tex = (cv, ud) => ({ image: cv, needsUpdate: false, userData: ud || {} });
async function judgeSeats(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    /* 남의 사람 좌석 — 합성 텍스처 · 받은 얼굴 캔버스가 비었다 */
    const d1 = { face: mkCv(true), blink: mkCv(true), faceUrl: 'https://s.test/f.png', blinkUrl: 'https://s.test/b.png' };
    const s1 = { remote: true, charDef: d1, faceMapOrig: tex(mkCv(true)), blinkTex: tex(mkCv(true)) };
    /* 얼굴을 안 그린 친구 — 받은 얼굴은 비었지만 합성본(피부)은 멀쩡 = 리셋 아님 */
    const d2 = { face: mkCv(true), blink: mkCv(true), faceUrl: 'https://s.test/e.png' };
    const s2 = { remote: true, charDef: d2, faceMapOrig: tex(mkCv(false)), blinkTex: tex(mkCv(false)) };
    /* 동물 좌석(남) — 몸 · 귀 텍스처 비었음, 귀는 원본 없음, 감은눈은 받기 실패 */
    const fT = tex(mkCv(true), { twSrc: 'https://s.test/a.png', twFill: '#ffffff' }), bT = tex(mkCv(true), { twSrc: 'https://bad.test/x.png' });
    const eT = tex(mkCv(true), { twSrc: null, twFill: '#ffffff' });
    const s3 = { remote: true, charDef: { animal: true }, faceMapOrig: fT, blinkTex: bT, faceMat: { userData: { animalEars: [{ fT: eT, bT: eT }] } } };
    /* 내 사람 좌석 — 여기서는 안 건드린다(repairBlankFaces 몫) */
    const mine = { remote: false, charDef: {}, faceMapOrig: tex(mkCv(true)), blinkTex: tex(mkCv(true)) };
    const E = seatEnv(src, { seats: [mine, s1, s2, s3] });
    const line = E.M.reportGlReset();
    t(/좌석 4 · 남의 좌석 3 · 빈 얼굴\(남\) 1 · 빈 동물 그림 1 · 빈 피부 0/.test(line) && E.notes[0] === line, '★ 리셋 진단 한 줄 — 좌석 · 남의 좌석 · 빈 얼굴(남) · 빈 동물 그림 · 빈 피부');
    await new Promise(res => setTimeout(res, 0)); await new Promise(res => setTimeout(res, 0));
    t(!d1.face.blank && d1.face.drawn.includes('https://s.test/f.png') && !d1.blink.blank && !s1.faceMapOrig.image.blank && s1.faceMapOrig.needsUpdate && !s1.blinkTex.image.blank,
      '★ 남의 빈 얼굴 · 감은눈 — 받아 둔 주소로 같은 캔버스에 다시 그리고 합성 텍스처를 다시 합성');
    t(d2.face.blank && !d2.face.drawn.length, '  얼굴을 안 그린 친구(합성본 멀쩡) — 안 건드린다');
    t(!fT.image.blank && fT.image.drawn.includes('https://s.test/a.png') && fT.needsUpdate, '★ 동물 빈 그림 — 기억한 원본으로 다시 그림');
    t(!eT.image.blank && !eT.image.drawn.length && !bT.image.blank, '  원본 없음 · 받기 실패 — 처음 바탕색은 칠해 둔다(다시 투명이 아니라 헛돌지 않는다)');
    t(mine.faceMapOrig.image.blank, '  내 사람 좌석은 이 함수가 안 건드린다(저장본으로 고치는 repairBlankFaces 몫)');
    const rep = E.notes.find(m => /빈 좌석 그림을 다시 그림/.test(m)) || '';
    t(/2번\(남 얼굴·감은눈·화면텍스처\)/.test(rep) && /4번\(남·동물 그림·그림✗·바탕만\)/.test(rep), '  고친 결과도 진단 기록에 한 줄(그림✗ = 받기 실패 · 바탕만 = 원본 없음)');
    t(await E.M.repairSeatTextures() === 0, '  다 고친 뒤 다시 돌면 할 일 없음');
    /* 피부가 비었으면 다음 차례 — 합성 재료부터 */
    const d4 = { face: mkCv(true), faceUrl: 'https://s.test/f.png' };
    const s4 = { remote: true, charDef: d4, faceMapOrig: tex(mkCv(true)) };
    const E2 = seatEnv(src, { seats: [s4], skins: [mkCv(true)] });
    t(await E2.M.repairSeatTextures() === 0 && d4.face.blank, '  피부 캔버스가 비면 이번엔 건너뛴다(피부 없는 얼굴이 굳지 않게)');
    /* 4초 점검처럼 기다리지 않고 잇달아 부른다 — 내 칸 복구가 피부를 단색으로 칠하고 PNG 를 기다리는 사이 */
    let doneSkin; const skins3 = [mkCv(true, 512, 'skin-old')];
    const d5 = { face: mkCv(true), faceUrl: 'https://s.test/f.png' };
    const s5 = { remote: true, charDef: d5, faceMapOrig: tex(mkCv(true)) };
    const E3 = seatEnv(src, { seats: [s5], skins: skins3, loadSkins: () => new Promise(res => { doneSkin = () => { skins3[0] = mkCv(false, 512, 'skin-png'); res(); }; }) });
    const pMine = E3.M.repairBlankFaces();
    const r1 = await E3.M.repairSeatTextures();
    t(r1 === 0 && s5.faceMapOrig.image.blank && d5.face.blank && !E3.notes.length, '★ 내 칸 복구가 피부 PNG 를 기다리는 동안 — 남의 좌석은 아예 안 건드린다(받기도 · 합성도 · 단색 피부로 굳지 않게)');
    doneSkin(); await pMine;
    await E3.M.repairSeatTextures();
    t(!s5.faceMapOrig.image.blank && s5.faceMapOrig.image.drawn.includes('skin-png') && !s5.faceMapOrig.image.drawn.includes('skin-old'), '  다음 차례 — 새 피부(PNG) 캔버스로 합성');
    /* 받는 사이에 피부가 빈다 — 돌아와서 합성하지 않고 다음 차례로 미룬다 */
    const skins7 = [mkCv(false, 512, 'skin-a')];
    const d7 = { face: mkCv(true), faceUrl: 'https://s.test/slow.png' };
    const s7 = { remote: true, charDef: d7, faceMapOrig: tex(mkCv(true)) };
    const E5 = seatEnv(src, { seats: [s7], skins: skins7, loadImgCors: async (u) => { skins7[0].blank = true; return { src: u }; } });
    await E5.M.repairSeatTextures();
    t(s7.faceMapOrig.image.blank && !s7.faceMapOrig.needsUpdate && E5.notes.some(m => /합성 다음 차례/.test(m)), '★ 받는 사이에 피부가 비면 — 합성을 미루고 합성본은 투명하게 둔다(다음 차례에 다시 잡힘)');
    /* 허용 안 되는 주소(https 아님) — 그리지 않는다 */
    const d6 = { face: mkCv(true), faceUrl: 'http://evil.test/f.png' };
    const s6 = { remote: true, charDef: d6, faceMapOrig: tex(mkCv(true)) };
    const E4 = seatEnv(src, { seats: [s6] });
    await E4.M.repairSeatTextures();
    t(d6.face.blank && !d6.face.drawn.length && E4.notes.some(m => /재료 없음/.test(m)), '  허용 안 되는 주소는 그리지 않는다(재료 없음 · 피부만 다시 합성)');
    /* 원래 주소의 응답이 실패로 캐시된 PC — 처음 받을 때처럼 표식 주소로 한 번 더(규칙은 img-retry.js) */
    const got = [];
    const d8 = { face: mkCv(true), faceUrl: 'https://stale.test/f.png?alt=media&token=t' };
    const s8 = { remote: true, charDef: d8, faceMapOrig: tex(mkCv(true)) };
    const aT = tex(mkCv(true), { twSrc: 'https://stale.test/a.png', twFill: '#ffffff' });
    const s9 = { remote: true, charDef: { animal: true }, faceMapOrig: aT };
    const E6 = seatEnv(src, { seats: [s8, s9], got });
    await E6.M.repairSeatTextures();
    t(!d8.face.blank && d8.face.drawn.includes('https://stale.test/f.png?alt=media&token=t&twr=1'), '★ 남의 얼굴 — 원래 주소가 막힌 PC 면 표식 주소(&twr=1)로 한 번 더 받아 다시 그림');
    t(!aT.image.blank && aT.image.drawn.includes('https://stale.test/a.png?twr=1') && aT.needsUpdate, '★ 동물 그림 — 같은 규칙으로 표식 주소(?twr=1)에서 다시 그림');
    t(got.length === 2 && got.every(u => /twr=1/.test(u)), '  받은 요청은 표식 주소 두 번뿐(원래 주소는 실패 · 그 뒤로 더 받지 않음)');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}
(async () => {
  (await judgeSeats(MOD)).forEach(([ok, msg]) => chk(ok, msg));
  const sb = [
    ['남의 좌석을 안 봄', "    else if(s.remote && _compBlankOf(s)) out.push({ s, d, animal:false });\n", ''],
    ['동물 귀를 안 봄', "  (ears || []).forEach(e=>{ if(e){ out.push(e.fT, e.bT); } });\n", ''],
    ['원본 없을 때 바탕도 안 칠함', "  x.fillStyle = u.twFill || '#ffffff'; x.fillRect(0,0,cv.width,cv.height);\n", ''],
    ['피부 먼저를 안 지킴', "  if(_blankSkinIdx().size) return 0;   // 피부부터", "  if(false) return 0;   // 피부부터"],
    ['내 칸 복구 중에도 합성', "  if(_faceRepairBusy) return 0;   // 내 칸 복구가", "  if(false) return 0;   // 내 칸 복구가"],
    ['받은 뒤 피부를 다시 안 봄', "        if(_faceRepairBusy || _blankSkinIdx().size){ what.push('합성 다음 차례');", "        if(false){ what.push('합성 다음 차례');"],
    ['남의 주소를 안 거름', "const fu = TwSafeHtml.safeUrl(d.faceUrl,'image'), bu = TwSafeHtml.safeUrl(d.blinkUrl,'image');", "const fu = d.faceUrl, bu = d.blinkUrl;"],
    ['다시 받을 때 표식 주소를 안 씀', "const _loadRemote = (u)=> TwImgRetry.loadWithRetry(loadImgCors, u);", "const _loadRemote = loadImgCors;"],
    ['리셋 진단을 안 남김', "  try{ diagNote(line); }catch(_){}\n  if(blank.length)", "  if(blank.length)"],
  ];
  for(const [name, a, b] of sb){
    const m2 = MOD.replace(a, b);
    const rows2 = m2 !== MOD ? await judgeSeats(m2) : [];
    chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
