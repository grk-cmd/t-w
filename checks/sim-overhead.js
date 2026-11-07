/* ═══ 💬 sim-overhead.js — 💬 머리 위 말풍선 · 회사원 모드 라벨 · 🏷️ 머리 위 이름표 · 공지 배너 모듈 구조 (2026-10-14 신설 · 앱 FSD 34번) ═══════════════
   app.js 의 머리 위 말풍선 · 이름표 두 구역 본문 을 parts/room/overhead.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(말풍선 · 이름표 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(NAMEPLATE_BELOW_EXPBAR · beginLabelFrame · labelSize · nameplateHeight · _officeDemojiHtml · _seatLabelName · setSeatMenu · setLabelDrag · bindLabelDrag · applyChipOrientation · chipHorizontal · setChipHorizontal · dismissSeatHeadBubble · ensureSeatLabelsLayer · nameplateEnabled · setNameplateEnabled · projectWorldToScreenPx · removeSeatLabels · setSeatHeadBubble · setSeatNamePlate)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 14줄 그대로(좌석 메뉴는 setSeatMenu 갈고리) · 부르는 곳은 overheadMod.이름 · html(app.js 앞)
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
const VAL_DEPS = ["ANIMAL_RUN_SCALE","_wpTmp3","camera","chatUiMod","renderer","seats","tricksMod"];
const GET_DEPS = ["focusLevelMod","officeMode"];
const SET_DEPS = [];
const EXPORTS = ["NAMEPLATE_BELOW_EXPBAR","beginLabelFrame","labelSize","nameplateHeight","_officeDemojiHtml","_seatLabelName","setSeatMenu","setLabelDrag","bindLabelDrag","dismissSeatHeadBubble","ensureSeatLabelsLayer","nameplateEnabled","setNameplateEnabled","statusBubbleEnabled","setStatusBubbleEnabled","projectWorldToScreenPx","removeSeatLabels","setSeatHeadBubble","setSeatNamePlate"];
const MOVED = ["nameplateEnabled","chipHorizontal","applyChipOrientation","_labelWP","projectWorldToScreenPx","ensureSeatLabelsLayer","ensureSeatNamePlateEl","seatLabelHeadY","LABEL_INV_GAP_PX","NAMEPLATE_BELOW_EXPBAR","setSeatNamePlate","ensureSeatAnnounceEl","_seatShowsAnnounce","updateSeatAnnounceEl","_activeAnnounceText","_announceExpireTimer","_refreshAnnounceState","_hideAllAnnounceEls","_initAnnounceSubscription","BUBBLE_INV_GAP_LABEL_PX","BUBBLE_INV_GAP_FEET_PX","BUBBLE_X_NUDGE_PX","ensureSeatBubbleEl","_officeLabelHtml","OFFICE_DEMOJI_PX","_officeDemojiHtml","_seatLabelName","_bubSnapTransform","setSeatHeadBubble","dismissSeatHeadBubble","removeSeatLabels"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  _chatEsc: (...a)=>_chatEsc(...a),","  _diceSvg: (...a)=>_diceSvg(...a),","  _starPaint: (...a)=>_starPaint(...a),","  _wpTmp3: _wpTmp3,","  camera: camera,","  chatUiMod: chatUiMod,","  focusLevelMod: ()=>focusLevelMod,","  getDisplayName: (...a)=>getDisplayName(...a),","  officeMode: ()=>officeMode,","  renderer: renderer,","  seatScale: (...a)=>seatScale(...a),","  seats: seats,","  tricksMod: tricksMod,"];

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
say('── 4. 💭 머리 위 상태 말풍선 — 설정으로 끄기 · 눌러 지우면 채팅 뒤에도 안 다시 뜸(B-1028-14)');
{
  /* 진짜 createOverhead 를 가짜 DOM 위에서 — 같은 좌석으로 setSeatHeadBubble · dismissSeatHeadBubble 을 차례로 부르고 보이는 글을 본다 */
  const mkE = () => { const e = { style: {}, children: [], _t: '', classList: { s: new Set(), toggle(c, v){ v ? this.s.add(c) : this.s.delete(c); }, add(c){ this.s.add(c); }, contains(c){ return this.s.has(c); } },
    appendChild(c){ this.children.push(c); return c; }, querySelector(){ return this.children[0] || null; }, querySelectorAll: () => [], addEventListener(){},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 }), offsetWidth: 10, offsetHeight: 10 };
    Object.defineProperty(e, 'textContent', { get(){ return e._t; }, set(v){ e._t = v; } }); Object.defineProperty(e, 'innerHTML', { get(){ return e._t; }, set(v){ e._t = v; } }); return e; };
  const V3 = () => ({ x: 0, y: 0, z: 0, set(){ return this; }, copy(){ return this; }, project(){ return this; }, clone(){ return this; } });
  const stage = (src, init) => {
    const store = Object.assign({}, init || {});
    const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    const doc = { body: mkE(), createElement: () => mkE(), getElementById: () => mkE(), querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, documentElement: mkE() };
    const api = new Function('window', 'document', 'localStorage', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'getComputedStyle', 'THREE', 'module', NET_PRE + src + '\nreturn window.TwOverhead;')(
      { devicePixelRatio: 1, addEventListener(){}, getComputedStyle: () => ({}) }, doc, ls, () => 0, () => {}, () => 0, () => ({}), { Vector3: function(){ return V3(); } }, undefined);
    const m = api.createOverhead({ ANIMAL_RUN_SCALE: 1, _chatEsc: (x) => x, _diceSvg: () => '', _starPaint: () => '', getDisplayName: () => '나', seatScale: () => 1, _wpTmp3: V3(), camera: {}, chatUiMod: {},
      renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } }, seats: [], tricksMod: { BONK_BUBBLE_MARK: '[bonk]' }, focusLevelMod: () => ({}), officeMode: () => false });
    return { m, store, api };
  };
  const scenario = (src) => {
    const { m, store } = stage(src);
    const seat = { group: { getWorldPosition(){} }, isMe: false };
    const vis = () => (seat.bubbleEl && seat.bubbleEl.style.display === 'block') ? seat.bubbleEl.children[0]._t : '';
    const r = {};
    m.setSeatHeadBubble(seat, '📱 A', true); r.a0 = vis();
    m.dismissSeatHeadBubble(seat); r.a1 = vis();
    m.setSeatHeadBubble(seat, '안녕', false); r.chat = vis();
    m.setSeatHeadBubble(seat, '📱 A', true); r.back = vis();                       // 채팅이 끝나 같은 상태로
    m.setSeatHeadBubble(seat, '또', false); m.dismissSeatHeadBubble(seat); r.memAfterChatDismiss = seat._statusDismissedFor;   // 채팅 말풍선을 눌러 지움
    m.setSeatHeadBubble(seat, null, true); m.setSeatHeadBubble(seat, '📱 A', true); r.afterOnline = vis();   // 온라인 뒤 같은 앱
    m.setSeatHeadBubble(seat, '📱 B', true); r.other = vis();
    m.setStatusBubbleEnabled(false); r.saved0 = store['tw.statusBubble'];
    return r;
  };
  const R = scenario(MOD);
  chk(R.a0 === '📱 A' && R.a1 === '', '상태 말풍선을 눌러 지우면 사라진다');
  chk(R.chat === '안녕', '  채팅 말풍선은 그대로 뜬다');
  chk(R.back === '', '★ 채팅이 끝나 같은 상태로 돌아와도 다시 안 뜬다(예전엔 채팅이 기억을 지워 다시 떴다)');
  chk(R.memAfterChatDismiss === '📱 A', '  채팅 말풍선을 눌러 지워도 상태 기억은 그대로');
  chk(R.afterOnline === '📱 A' && R.other === '📱 B', '  다른 상태(온라인 · 다른 앱)가 오면 다시 보인다');
  chk(R.saved0 === '0' && stage(MOD, { 'tw.statusBubble': '0' }).m.statusBubbleEnabled() === false && stage(MOD).m.statusBubbleEnabled() === true,
    '  설정 — 끄면 이 PC 에 tw.statusBubble=0 · 다음에 켜도 꺼진 채 · 기본 켜짐');
  const iChat = SRC.indexOf('else if(_chatting){ overheadMod.setSeatHeadBubble(seat, seat.chatBubbleText); }'), iOff = SRC.indexOf('else if(!overheadMod.statusBubbleEnabled()){ overheadMod.setSeatHeadBubble(seat, null); }'),
    iSt = SRC.indexOf('overheadMod.setSeatHeadBubble(seat, _conf ? _conf.label : focusLevelMod._mobileBubbleText(_mobApp), true)');
  chk(iChat > 0 && iOff > iChat && iSt > iOff, '★ 설정에서 끄면 상태 말풍선은 안 뜬다 — app.js 말풍선 갈래(채팅 다음 · 상태 앞)가 정한다(무엇을 보일지는 한 곳)');
  /* 깨 보기 */
  const b1 = MOD.replace('  seat._lastBubbleThink = !!think;   // 지울 때 상태 말풍선이었는지(dismissSeatHeadBubble)\n', '');
  chk(b1 !== MOD && scenario(b1).back !== '', '  깨 보기 — 상태 말풍선인지 안 적으면 지운 기억이 안 걸려 채팅 뒤 다시 떠 빨강');
  const b2 = MOD.replace('if(seat._lastBubbleThink && seat._lastBubble) seat._statusDismissedFor', 'if(seat._lastBubble) seat._statusDismissedFor');
  chk(b2 !== MOD && scenario(b2).memAfterChatDismiss !== '📱 A', '  깨 보기 — 채팅 말풍선을 지울 때도 기억하면 상태 기억이 바뀌어 빨강');
  const b3 = MOD.replace("  if(text !== seat._statusDismissedFor){ seat._statusDismissedFor = undefined; return text; }\n  return null;", "  seat._statusDismissedFor = undefined; return text;");
  chk(b3 !== MOD && scenario(b3).back !== '', '  깨 보기 — 지운 기억을 안 지키면 채팅 뒤 다시 떠 빨강');
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
