/* sim-seat-label-drag.js — 🏷️ 이름표 · 경험치 바를 눌러 끌면 책상 끌기와 같은 자리 바꾸기
   실행:  node sim-seat-label-drag.js   (seat-label-drag.js · app.js · overhead.js · exp-bar.js · desktop-run.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 라벨 끌기가 책상 끌기와 **다른 길**로 자리를 바꾸면 맨 오른쪽 고정 · 클릭 통과 유지 · blur 안전망이 따로 놀고,
     누르기만 했는데 쓰다듬기가 나가면 이름표를 누를 때마다 하트가 뜬다.
   ・1절: 판단(seat-label-drag.js) — 왼쪽 버튼만 · 조준 중 · 날기 · 탄 중 · 벤치 · 시작 실패면 이벤트를 안 멈춘다
   ・2절: app.js 시작 함수를 떼어 실제로 돌린다 — 같은 drag 상태 · targetType 'label' · 잡은 자리 · 캔버스가 포인터를 잡는다 · 이미 끄는 중이면 안 함
   ・3절: 배선 — 이름표 · 경험치 바가 같은 갈고리 · 끌면 slot · 누르기만은 쓰다듬지 않음 · css · UI_HIT_SEL · html 순서 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('seat-label-drag.js'), APP_RAW = read('app.js'), OV = read('overhead.js'), EXP = read('exp-bar.js'), RUN = read('desktop-run.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP_RAW || !OV || !EXP || !RUN || !HTML) { say('  ? 원본 못 찾음 — seat-label-drag.js · app.js · overhead.js · exp-bar.js · desktop-run.js · desk-companion-prototype.html'); process.exit(2); }
const APP = _joinRenderer(APP_RAW);

say('── 1. 판단 (seat-label-drag.js)');
const win = {};
new Function('window', 'module', MOD)(win, undefined);
const L = win.TwSeatLabelDrag;
chk(!!L && typeof L.createSeatLabelDrag === 'function' && typeof L.canStartLabelDrag === 'function', '싣기만 하면 window.TwSeatLabelDrag');
const seat = () => ({ group: { position: { x: -1 } } });
chk(L.canStartLabelDrag(seat(), false) === true, '보통 좌석은 끌 수 있다');
chk(L.canStartLabelDrag(null, false) === false && L.canStartLabelDrag({}, false) === false, '  좌석 · group 이 없으면 안 됨');
chk(L.canStartLabelDrag(seat(), true) === false, '★ 조준 중(날리기 · 때리기)은 안 끈다 — 표적 고르기');
chk(['fly', 'ridingOn', 'seatedOn'].every(k => L.canStartLabelDrag(Object.assign(seat(), { [k]: {} }), false) === false), '★ 날아가는 중 · 탄 중 · 벤치에 앉은 중은 안 끈다(group 이 제자리가 아님)');
let begun = [], aim = { fly: false, bonk: false }, beginOk = true;
const D = L.createSeatLabelDrag({ beginDrag: (e, s) => { begun.push(s); return beginOk; }, flyAiming: () => aim.fly, bonkAiming: () => { if (aim.bonk === 'throw') throw new Error('x'); return aim.bonk; } });
const ev = (button) => { const e = { button, prevented: 0, stopped: 0 }; e.preventDefault = () => { e.prevented++; }; e.stopPropagation = () => { e.stopped++; }; return e; };
let e = ev(0), s = seat();
chk(D.onLabelPointerDown(e, s) === true && begun[0] === s && e.prevented === 1 && e.stopped === 1, '★ 왼쪽 버튼 → 끌기 시작 · 글자 선택 막고 이벤트를 멈춘다');
begun = []; e = ev(2);
chk(D.onLabelPointerDown(e, s) === false && begun.length === 0 && e.prevented === 0, '  오른쪽 버튼은 안 건드린다 — 이름표 우클릭 메뉴가 그대로');
aim.fly = true; e = ev(0);
chk(D.onLabelPointerDown(e, s) === false && begun.length === 0 && e.stopped === 0, '  날리기 조준 중이면 시작 안 함');
aim.fly = false; aim.bonk = 'throw'; e = ev(0);
chk(D.onLabelPointerDown(e, s) === true, '  조준 확인이 던져도 안 죽는다(조준 아님으로 친다)');
aim.bonk = false; beginOk = false; e = ev(0);
chk(D.onLabelPointerDown(e, s) === false && e.prevented === 0 && e.stopped === 0, '  시작이 거절되면(이미 끄는 중) 이벤트를 안 멈춘다');

say('── 2. app.js 시작 함수 — 떼어 돌리기');
const fnSrc = (APP_RAW.match(/function _beginLabelSlotDrag\(e, seat\)\{[\s\S]*?\n\}/) || [''])[0];
chk(!!fnSrc, '_beginLabelSlotDrag 가 app.js 에 있다');
if (fnSrc) {
  const st = { drag: null, hot: 0, sel: null, cap: null };
  const run = new Function('st', 'worldX', 'seatPanelMod', 'canvas', '_uiHot', 'performance',
    'let drag = st.drag;\n' + fnSrc + '\nreturn (e, s) => { const r = _beginLabelSlotDrag(e, s); st.drag = drag; return r; };');
  const mk = () => run(st, () => 5, { selectSeat: (x) => { st.sel = x; } }, { setPointerCapture: (id) => { st.cap = id; } }, (ms) => { st.hot = ms; }, { now: () => 100 });
  const sx = { group: { position: { x: -2 } } };
  const r = mk()({ clientX: 30, clientY: 40, pointerId: 7 }, sx);
  const d = st.drag || {};
  chk(r === true && d.seat === sx && d.targetType === 'label' && d.moved === false && d.mode === null, '★ 같은 drag 상태로 시작 — targetType «label» · 아직 안 움직임');
  chk(d.grabX === 7 && d.startX === 30 && d.startY === 40, '  잡은 자리 = 커서 월드 x − 책상 x (책상 끌기와 같은 식)');
  chk(st.cap === 7 && st.sel === sx && st.hot === 3000, '★ 캔버스가 포인터를 잡는다 — 이어지는 이동 · 놓기는 캔버스 끌기가 처리');
  st.cap = null;
  chk(mk()({ clientX: 1, clientY: 1, pointerId: 8 }, sx) === false && st.cap === null, '  이미 끄는 중이면 새로 시작하지 않는다');
}

say('── 3. 배선');
chk(/function bindLabelDrag\(el, seat\)\{\s*el\.addEventListener\('pointerdown', e=>\{ if\(_labelDragFn\) _labelDragFn\(e, seat\); \}\);/.test(OV), 'overhead.js — 리스너는 늘 걸고 누를 때 갈고리를 본다(잇기 전에 만든 라벨도 듣게)');
const np = OV.slice(OV.indexOf('function ensureSeatNamePlateEl'), OV.indexOf('seat.namePlateEl=el; return el;'));
chk(/bindLabelDrag\(el, seat\);/.test(np), '★ 이름표가 건다');
chk(/overheadMod\.bindLabelDrag\(el, seat\);/.test(EXP), '★ 경험치 바도 같은 갈고리로 건다');
chk(/overheadMod\.setLabelDrag\(\(e, seat\)=>seatLabelDragMod\.onLabelPointerDown\(e, seat\)\);/.test(APP_RAW) && /beginDrag: _beginLabelSlotDrag/.test(APP_RAW), 'app.js 가 판단 모듈을 만들어 잇는다');
chk(/drag\.mode = \(drag\.targetType === 'char'\) \? 'shake' : 'slot';/.test(APP), '★ 끌면 책상 끌기(slot) — 자리 계산 · 맨 오른쪽 고정(dragIndex)이 같은 줄');
const up = APP_RAW.slice(APP_RAW.indexOf("canvas.addEventListener('pointerup',e=>{"));   // app.js 본래 글 — 되살린 글엔 꾸미기 창의 pointerup 이 먼저 온다
const iL = up.indexOf("if(drag.targetType==='label'){"), iPet = up.indexOf('triggerPet(seat)');
chk(iL > 0 && iPet > iL && up.indexOf('if(!drag.moved){') < iL, '★ 누르기만 하면 쓰다듬지 않는다(라벨 갈래가 쓰다듬기보다 먼저)');
chk(/\.seat-exp\{[^}]*pointer-events:auto/.test(HTML) && /\.seat-nameplate\{[^}]*pointer-events:auto/.test(HTML), 'css — 이름표 · 경험치 바가 누름을 받는다');
chk(/\.mi-star-stage \.seat-exp\{[^}]*pointer-events:none/.test(HTML), '  내 정보 별 미리보기의 경험치 바는 그대로 안 받는다');
chk(/const UI_HIT_SEL = '[^']*\.seat-exp\b/.test(RUN), '★ UI_HIT_SEL 에 .seat-exp — 실행 화면에서 클릭이 뒤 앱으로 빠지지 않게');
const iM = HTML.indexOf('<script src="parts/room/seat-label-drag.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iM > 0 && iM < iA, 'html — seat-label-drag.js 는 app.js 보다 먼저');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 이름표 · 경험치 바도 책상처럼 끌어 자리를 바꾼다'));
process.exit(fail ? 1 : 0);
