/* ═══ 💬 sim-overhead.js — 💬 머리 위 말풍선 · 회사원 모드 라벨 · 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너 모듈 구조 (2026-10-14 신설 · 앱 FSD 34번) ═══════════════
   app.js 의 머리 위 말풍선 · 이름표 두 구역 본문 을 parts/room/overhead.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(말풍선 · 이름표 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(NAMEPLATE_BELOW_EXPBAR · beginLabelFrame · labelSize · nameplateHeight · _officeDemojiHtml · _seatLabelName · setSeatMenu · setLabelDrag · bindLabelDrag · applyChipOrientation · chipHorizontal · setChipHorizontal · dismissSeatHeadBubble · ensureSeatLabelsLayer · nameplateEnabled · setNameplateEnabled · projectWorldToScreenPx · removeSeatLabels · setSeatHeadBubble · setSeatNamePlate)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 15줄 그대로(좌석 메뉴는 setSeatMenu 갈고리) · 부르는 곳은 overheadMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · overhead.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["overhead.js","parts/room/overhead.js","app/parts/room/overhead.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — overhead.js'); process.exit(2); }
/* 🛰 네트워크 준비 기다리기(shared/net-ready.js — 모듈이 TwNetReady.whenNetReady 를 부른다) — 가짜 window 위에 진짜 파일을 먼저 싣는다 */
const NET = ["net-ready.js","parts/shared/net-ready.js","app/parts/shared/net-ready.js"].map(read).find(Boolean);
if(!NET){ say('  ? 원본 못 찾음 — net-ready.js'); process.exit(2); }
/* 📐 라벨 잰 값 기억(room/label-measure.js — 만들 때 TwLabelMeasure.createLabelMeasure 를 부른다) — 같은 까닭으로 먼저 싣는다 */
const LMS = ["label-measure.js","parts/room/label-measure.js","app/parts/room/label-measure.js"].map(read).find(Boolean);
if(!LMS){ say('  ? 원본 못 찾음 — label-measure.js'); process.exit(2); }
const NET_PRE = NET + '\n' + LMS + '\nvar TwNetReady = window.TwNetReady, TwLabelMeasure = window.TwLabelMeasure;\n';
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_chatEsc","_diceSvg","_starPaint","getDisplayName","seatScale"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","_wpTmp3","camera","chatUiMod","renderer","rtHub","seats","tricksMod"];
const GET_DEPS = ["focusLevelMod","officeMode"];
const SET_DEPS = [];
const EXPORTS = ["NAMEPLATE_BELOW_EXPBAR","beginLabelFrame","labelSize","nameplateHeight","_officeDemojiHtml","_seatLabelName","setSeatMenu","setLabelDrag","bindLabelDrag","applyChipOrientation","chipHorizontal","setChipHorizontal","dismissSeatHeadBubble","ensureSeatLabelsLayer","nameplateEnabled","setNameplateEnabled","projectWorldToScreenPx","removeSeatLabels","setSeatHeadBubble","setSeatNamePlate"];
const MOVED = ["nameplateEnabled","chipHorizontal","applyChipOrientation","_labelWP","projectWorldToScreenPx","ensureSeatLabelsLayer","ensureSeatNamePlateEl","seatLabelHeadY","LABEL_INV_GAP_PX","NAMEPLATE_BELOW_EXPBAR","setSeatNamePlate","ensureSeatAnnounceEl","_seatShowsAnnounce","updateSeatAnnounceEl","_activeAnnounceText","_announceExpireTimer","_refreshAnnounceState","_hideAllAnnounceEls","_initAnnounceSubscription","BUBBLE_INV_GAP_LABEL_PX","BUBBLE_INV_GAP_FEET_PX","BUBBLE_X_NUDGE_PX","ensureSeatBubbleEl","_officeLabelHtml","OFFICE_DEMOJI_PX","_officeDemojiHtml","_seatLabelName","_bubSnapTransform","setSeatHeadBubble","dismissSeatHeadBubble","removeSeatLabels"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  _chatEsc: (...a)=>_chatEsc(...a),","  _diceSvg: (...a)=>_diceSvg(...a),","  _starPaint: (...a)=>_starPaint(...a),","  _wpTmp3: _wpTmp3,","  camera: camera,","  chatUiMod: chatUiMod,","  focusLevelMod: ()=>focusLevelMod,","  getDisplayName: (...a)=>getDisplayName(...a),","  officeMode: ()=>officeMode,","  renderer: renderer,","  rtHub: TwRtHub,","  seatScale: (...a)=>seatScale(...a),","  seats: seats,","  tricksMod: tricksMod,"];

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
    NET_PRE + src + '\nreturn window.TwOverhead;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createOverhead(deps);
}

/* 📣 확성기 announce 메시지 — 진짜 모듈을 만들어 메시지를 쏴 본다(좌석 라벨 숨김 · 끝나는 때 타이머) */
function announceRun(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  const log = { timers: [], cleared: 0, handler: null };
  const el = { style: { display: 'block' } };
  deps.seats = [{ announceEl: el }];
  deps.rtHub = { store: { onMessage: (t, fn) => { if(t === 'announce') log.handler = fn; } } };
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const st = (fn, ms) => { log.timers.push({ fn, ms }); return log.timers.length; };
  new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src + '\nreturn window.TwOverhead;')(win, any, ls, any, any, any, st, () => 0, () => { log.cleared++; }, () => {}, () => 0, any, () => {}, () => {}, undefined).createOverhead(deps);
  return { log, el, send: (m) => { el.style.display = 'block'; log.handler(m); } };
}
function judgeAnnounce(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let a;
  try{ a = announceRun(src); }catch(e){ return [[false, '확성기 — 만들 때 던짐 ' + String(e.message).slice(0, 60)]]; }
  t(typeof a.log.handler === 'function', '확성기 — announce 메시지를 받도록 건다');
  a.send({ text: '점검', until: Date.now() + 5000 });
  const d1 = a.log.timers.length ? a.log.timers[a.log.timers.length - 1].ms : -1;
  t(a.log.timers.length === 1 && d1 > 3000 && d1 <= 5000 && a.el.style.display === 'block', '확성기 — 서버가 정한 끝나는 때까지 남은 시간(5초 이내)만큼 보이고 그때 숨기려 타이머를 건다');
  a.log.timers[0].fn();
  t(a.el.style.display === 'none', '  타이머가 돌면 숨긴다');
  a.send({ text: '긴 공지', until: Date.now() + 10 * 60000 });
  t(a.log.timers[a.log.timers.length - 1].ms === 60000, '확성기 — 10분 뒤로 와도 60초로 자른다(이 PC 시계가 틀려도 오래 안 보임)');
  const n0 = a.log.timers.length;
  a.send({ text: '지난 공지', until: Date.now() - 1000 });
  t(a.log.timers.length === n0 && a.el.style.display === 'none', '확성기 — 끝나는 때가 이미 지났으면 보이지 않고 타이머도 안 건다');
  const n1 = a.log.timers.length;
  for(const bad of [undefined, null, '9999999999999', NaN]){ a.send({ text: '이상', until: bad }); }
  t(a.log.timers.length === n1 && a.el.style.display === 'none', '확성기 — 숫자가 아닌 until 은 보이지 않는다');
  const c0 = a.log.cleared;
  a.send({ text: null, until: null });
  t(a.el.style.display === 'none' && a.log.cleared > c0, '확성기 — text:null 은 끈다(기다리던 타이머도 거둔다)');
  const n2 = a.log.timers.length;
  a.send({ text: null, until: Date.now() + 5000 });
  t(a.el.style.display === 'none' && a.log.timers.length === n2, '확성기 — until 이 남아 있어도 text 가 없으면 보이지 않는다');
  return r;
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwOverhead = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwOverhead(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("OVERHEAD_MOD_OFF") && app.includes("const overheadMod = TwOverhead.createOverhead({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const overheadMod = TwOverhead\\.createOverhead\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const overheadMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 overheadMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/overhead.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/overhead.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 📣 확성기 announce 메시지');
judgeAnnounce(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/overhead.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const overheadMod = TwOverhead.createOverhead({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwOverhead = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const overheadMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('overheadMod.' + x)); if(n){ ls[i] = ls[i].replace('overheadMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createOverhead(deps){', 'function createOverhead(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
for(const [name, from, to] of [
  ['확성기가 60초로 안 자름', 'Math.min(m.until - Date.now(), ANNOUNCE_MAX_MS)', '(m.until - Date.now())'],
  ['확성기가 지난 공지도 보임', 'if(remain > 0){', 'if(true){'],
  ['확성기가 until 타입을 안 봄', "typeof m.until === 'number'", 'm.until'],
  ['확성기 끄기가 타이머를 안 거둠', 'clearTimeout(_announceExpireTimer);\n  _activeAnnounceText = null;', '_activeAnnounceText = null;'],
  ['확성기 끄기가 안 먹음', 'if(m && m.text && ', 'if(m && '],
]){
  const bad = MOD.replace(from, to);
  let caught; try{ caught = bad !== MOD && judgeAnnounce(bad).some(([ok]) => !ok); }catch(_){ caught = true; }
  chk(caught, name + ' → 빨강');
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
