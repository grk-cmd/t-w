/* ═══ 💾 sim-slot-save.js — 💾 슬롯 저장 · 복원(localStorage) 모듈 구조 (2026-10-14 신설 · 앱 FSD 43번) ═══════════════
   app.js 의 슬롯 저장 구역 본문 을 parts/character/slot-save.js 로 옮겼다(글자 그대로 · 바뀐 줄 4 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(슬롯 저장 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(LS_KEY · _relinkSeatsToSlots · loadSlots · saveSlots · slotToObj · 알림 on* · slotsReplaced)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 12줄 그대로 · 부르는 곳은 slotSaveMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · slot-save.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["slot-save.js","parts/character/slot-save.js","app/parts/character/slot-save.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — slot-save.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_isBlankDraw","charDef","loadImg","newCanvas","toast"];
const VAL_DEPS = ["CHAR_SLOT_MAX","_blinkEverDrawn","_faceEverDrawn","seats","slots"];
const GET_DEPS = ["_blankFaceConfirmed"];
const SET_DEPS = ["_blankFaceConfirmed"];
const EXPORTS = ["_relinkSeatsToSlots","applySlotObjs","lastOut","pullForward","onLoaded","onSaved","onSeatRelinked","onSlotsReplaced","saveSlots","slotToObj","slotsReplaced"];
const MOVED = ["_slotImgToDataUrl","slotToObj","_relinkSeatsToSlots","saveSlots","applySlotObjs"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_SLOT_MAX: CHAR_SLOT_MAX,","  _blankFaceConfirmed: ()=>_blankFaceConfirmed,","  _blinkEverDrawn: _blinkEverDrawn,","  _faceEverDrawn: _faceEverDrawn,","  _isBlankDraw: (...a)=>_isBlankDraw(...a),","  charDef: (...a)=>charDef(...a),","  loadImg: (...a)=>loadImg(...a),","  newCanvas: (...a)=>newCanvas(...a),","  seats: seats,","  slots: slots,","  toast: (...a)=>toast(...a),","  setBlankFaceConfirmed: (v)=>{ _blankFaceConfirmed = v; },"];

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
    src + '\nreturn window.TwSlotSave;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createSlotSave(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSlotSave = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSlotSave(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SLOT_SAVE_MOD_OFF") && app.includes("const slotSaveMod = TwSlotSave.createSlotSave({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const slotSaveMod = TwSlotSave\\.createSlotSave\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const slotSaveMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 slotSaveMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/slot-save.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/slot-save.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/slot-save.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const slotSaveMod = TwSlotSave.createSlotSave({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const slotSaveMod = TwSlotSave.createSlotSave({", "const slotSaveMod = TwSlotSave.createSlotSave({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSlotSave = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const slotSaveMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('slotSaveMod.' + x)); if(n){ ls[i] = ls[i].replace('slotSaveMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createSlotSave(deps){', 'function createSlotSave(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 서버에서 받아 앉히기 · 저장 모양 · 빈 그림 방어 · 당기기 ── */
say('── 4. 동작 — 실제로 돌린다');
const vm = require('vm');
function mkWorld(srcMod){
  const w = { slots: [null, null, null, null, null], fe: [false, false, false, false, false], be: [false, false, false, false, false], toasts: [], saved: [], loaded: 0, replaced: 0, confirmed: false, relinked: [], seats: [] };
  const cv = () => { const c = { src: null, blank: true, getContext: () => ({ drawImage(img){ c.src = img.src; c.blank = false; } }), toDataURL: () => c.src || 'data:image/png;base64,BLANK' }; return c; };
  const deps = { CHAR_SLOT_MAX: 5, _blankFaceConfirmed: () => w.confirmed, _blinkEverDrawn: w.be, _faceEverDrawn: w.fe, _isBlankDraw: (c) => !c || c.blank,
    charDef: (skin, f, b, top, bot) => ({ skin, face: f, blink: b, top, bot }), loadImg: async (u) => { if(u === 'data:bad') throw new Error('깨짐'); return { src: u }; }, newCanvas: cv,
    seats: w.seats, slots: w.slots, toast: (m) => w.toasts.push(m), setBlankFaceConfirmed: (v) => { w.confirmed = v; } };
  const ctx = { window: {}, console: { warn(){}, log(){} }, JSON, Object, Array, Promise, Error, Set };
  vm.createContext(ctx); vm.runInContext(srcMod, ctx);
  w.M = ctx.window.TwSlotSave.createSlotSave(deps);
  w.M.onSaved((out, changed) => w.saved.push({ out, changed }));
  w.M.onLoaded(() => { w.loaded++; });
  w.M.onSlotsReplaced(() => { w.replaced++; });
  w.M.onSeatRelinked((o, c) => w.relinked.push([o, c]));
  return w;
}
const FACE = (t) => 'data:image/png;base64,' + t;
const OBJ = (skin, f, b) => ({ skin, top: 1, bot: 2, face: FACE(f), blink: FACE(b) });
async function behave(srcMod){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = mkWorld(srcMod);
  t(JSON.stringify(w.M.lastOut()) === '[null,null,null,null,null]', '처음에는 직전 저장 모양이 비어 있다(이 PC 에서 읽어 오지 않는다)');
  await w.M.applySlotObjs([OBJ(1, 'F0', 'B0'), null, OBJ(3, 'F2', 'B2'), null, null]);
  t(w.slots[0].skin === 1 && w.slots[0].face.src === FACE('F0') && w.slots[1] === null && w.slots[2].skin === 3 && w.loaded === 1, '받아 앉히기 — 칸마다 캐릭터를 만든다(그림은 각각 복원) · 끝나면 onLoaded');
  t(w.fe[0] === true && w.fe[1] === false && w.be[2] === true, '  빈 그림 방어의 기억을 심는다(그림이 있었다)');
  t(w.M.lastOut()[0].skin === 1 && w.M.lastOut()[2].skin === 3 && w.M.lastOut()[1] === null, '  받은 모습이 «직전 저장» — 되받아 저장해도 달라짐이 아니다');
  w.M.saveSlots(); w.M.saveSlots();
  t(w.saved.length === 2 && w.saved[1].changed === false, '저장했는데 내용이 같으면 changed=false(서버에 쓰지 않는다)');
  w.slots[0].top = 9; w.M.saveSlots();
  t(w.saved[2].changed === true && w.saved[2].out[0].top === 9 && w.M.lastOut()[0].top === 9, '  고치면 changed=true · 직전 저장 모양이 새로 바뀐다');
  /* 빈 그림 방어 */
  w.slots[0].face.src = null; w.slots[0].face.blank = true;
  w.M.saveSlots();
  t(w.saved[3].out[0].face === FACE('F0') && w.toasts.some(x => /저장을 막았어요/.test(x)), '실행 중에 얼굴 캔버스가 비면 그 필드만 직전 저장 값으로 되돌리고 알린다(서버에 빈 그림이 굳지 않는다)');
  w.confirmed = true; w.M.saveSlots();
  t(w.saved[4].out[0].face === FACE('BLANK') || w.saved[4].out[0].face === 'data:image/png;base64,BLANK', '  사용자가 «비운 채 저장» 을 확인한 한 번은 통과한다');
  w.M.saveSlots();
  t(w.confirmed === false, '  그 허가는 한 번만 쓰인다(바로 소비)');
  /* 이미지 복원 실패 칸 */
  w = mkWorld(srcMod);
  const brokenObj = { skin: 4, top: 1, bot: 2, face: 'data:bad', blink: FACE('B') };
  await w.M.applySlotObjs([brokenObj, null, null, null, null]);
  t(w.slots[0] && w.slots[0]._imgBroken && w.slots[0]._imgBroken.join() === '얼굴' && w.toasts.some(x => /못 불러온 캐릭터/.test(x)), '그림 복원에 실패한 칸 — 칸은 살리고 _imgBroken 표식 · 알림');
  w.M.saveSlots();
  t(w.saved[0].out[0] === brokenObj, '  그 칸은 저장에서 제외하고 받은 모습을 그대로(같은 객체로) 둔다 — 빈 그림으로 다시 만들어 덮지 않는다');
  /* 일부 칸만 */
  w = mkWorld(srcMod);
  await w.M.applySlotObjs([OBJ(1, 'F0', 'B0'), OBJ(2, 'F1', 'B1'), null, null, null]);
  const keep = w.slots[0];
  await w.M.applySlotObjs([OBJ(7, 'X', 'Y'), OBJ(8, 'F9', 'B9'), OBJ(5, 'F2', 'B2'), null, null], new Set([2]));
  t(w.slots[0] === keep && w.slots[1].skin === 2 && w.slots[2].skin === 5 && w.M.lastOut()[0].skin === 1 && w.M.lastOut()[2].skin === 5, '칸을 골라 앉히면 나머지 칸의 캐릭터 객체는 그대로(좌석이 붙들고 있다) · 직전 저장 모양도 그 칸만');
  await w.M.applySlotObjs([null, null, null, null, null], new Set([1]));
  t(w.slots[1] === null && w.M.lastOut()[1] === null && w.slots[0] === keep, '  빈 칸으로 받으면 그 칸만 비운다');
  /* 당기기 */
  w = mkWorld(srcMod);
  await w.M.applySlotObjs([OBJ(1, 'F0', 'B0'), OBJ(2, 'F1', 'B1'), OBJ(3, 'F2', 'B2'), null, null]);
  w.M.saveSlots();   // 받은 모양을 저장 모양으로 한 번 굳힌다(실제로는 받은 모양이 이미 저장 모양이다)
  w.M.pullForward(0);
  t(w.slots[0].skin === 2 && w.slots[1].skin === 3 && w.slots[2] === null && w.M.lastOut()[0].skin === 2 && w.M.lastOut()[2] === null && w.fe[1] === true && w.fe[2] === false,
      '당기기 — 칸 · 직전 저장 모양 · 그림 기억을 같이 앞으로(뒤 칸은 비운다)');
  w.M.saveSlots();
  t(w.saved[1].changed === false, '  당긴 뒤 저장은 달라짐이 아니다(서버가 같은 규칙으로 당겼다)');
  /* 알림 */
  w.M.slotsReplaced();
  t(w.replaced === 1, 'slotsReplaced — 거는 쪽(캐릭터 탭 다시 그리기)에 알린다');
  return r;
}
(async () => {
  (await behave(MOD)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 일부러 깨 보기 (동작)');
  const bb = [
    ['고른 칸만 앉히기를 뺌', "if(which && !which.has(i)) continue;", ''],
    ['직전 저장 모양을 안 갈아 끼움', "if(_str !== null) _lastOut = out;", ''],
    ['빈 그림 방어를 뺌', "if(p && typeof p[key]==='string'){ o[key]=p[key]; _rescued.push((i+1)+'번 '+what); }", ''],
    ['_imgBroken 제외를 뺌', "if(d && d._imgBroken && prev && prev[i] !== undefined){", "if(false){"],
    ['당길 때 직전 저장 모양을 안 당김', "slots[k]=slots[k+1]; _lastOut[k]=_lastOut[k+1];", "slots[k]=slots[k+1];"],
  ];
  for(const [name, a, b] of bb){
    const m2 = MOD.replace(a, b);
    let rows2 = []; if(m2 !== MOD){ try{ rows2 = await behave(m2); }catch(_){ rows2 = [[false, '던짐']]; } }
    chk(m2 !== MOD && rows2.some(([ok]) => !ok), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
