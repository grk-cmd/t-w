/* ═══ ✥ sim-move-mode.js — 프로그램 이동 모드 · 캐릭터 화면 좌표(launcher/move-mode.js · app.js 분리 M19) ═══════════════
   ・1절: 이동 모드 — 꺼져 있으면 무시 · 첫 mousemove 는 시작점만 · 이어서 픽셀 ÷ 창 크기 비율로 pan(부호 · 한계) · 배치 · 상태칩 즉시 갱신 · 클릭(capture)으로 확정(저장 · 안내 · 우클릭이면 contextmenu 1회 억제)
   ・2절: _charProjSane — 투영 결과가 쓸 만한가(경계값)
   ・3절: 읽는 · 쓰는 함수(여섯 값)
   ・4절: 연결 — 깃발 읽는 자리 · 쓰는 자리 · deps 모양
   ・5절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('launcher/move-mode.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function mkEl(){ const cl = new Set(); return { style: {}, textContent: '', classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c) } }; }
function build(src, o){
  o = o || {};
  const L = {}, log = [], els = { fsMoveBtn: mkEl(), fsMoveHint: mkEl(), myMoveBtn: mkEl() };
  const pan = { x: 0.1, y: 0.2 };
  const win = { addEventListener: (ev, fn, cap) => { L[ev] = { fn, cap }; } };
  const document = { getElementById: (i) => els[i] || null };
  const deps = { charPlaceMod: { deskPanX: () => pan.x, deskPanY: () => pan.y, setDeskPanX: (v) => { pan.x = v; }, setDeskPanY: (v) => { pan.y = v; } },
    clampDeskPan: (x, y) => ({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }), layoutSeats: () => log.push('layout'), saveCharPos: () => log.push('save'),
    statusChipMod: { updateMyStatusChipPosition: () => log.push('chip') }, toast: (m) => log.push('toast:' + m) };
  new Function('window', 'document', 'innerWidth', 'innerHeight', 'module', src)(win, document, o.w || 1000, o.h || 500, undefined);
  // 모듈은 window.TwMoveMode 를 거는 것이 아니라 new Function 안의 window 에 건다 — 위 win 이 같은 객체
  const mod = win.TwMoveMode.createMoveMode(deps);
  return { mod, L, log, els, pan };
}
const mv = (b, x, y) => b.L.mousemove.fn({ clientX: x, clientY: y });
say('§1 이동 모드');
{
  let b = build(SRC);
  mv(b, 100, 100);
  chk(b.pan.x === 0.1 && b.pan.y === 0.2 && b.log.length === 0, '꺼져 있으면 mousemove 를 무시한다');
  b.mod.setMoveMode(true); b.mod.setMoveModeJustToggled(true);
  mv(b, 100, 100);
  chk(b.pan.x === 0.1 && b.mod._moveModeJustToggled() === false && b.log.length === 0, '첫 mousemove 는 시작점만 잡는다(pan · 배치 안 건드림 · 버튼 직후 깃발을 내림)');
  mv(b, 200, 150);
  chk(Math.abs(b.pan.x - (0.1 - 100 / 1000)) < 1e-12 && Math.abs(b.pan.y - (0.2 + 50 / 500)) < 1e-12, '★ 픽셀 이동량 ÷ 창 크기 — 오른쪽으로 가면 pan.x 는 줄고 아래로 가면 pan.y 는 는다(부호 반전)');
  chk(b.log.join() === 'layout,chip', '움직일 때마다 배치 · 상태칩을 즉시 갱신');
  mv(b, 5000, 100);
  chk(b.pan.x === -1, 'clampDeskPan 한계로 막힌다');
  b.log.length = 0;
  b.L.pointerdown.fn({ button: 0 });
  chk(b.mod.moveMode() === false && b.log.join() === 'save,chip,toast:위치가 확정됐어요', '클릭하면 확정 — 이동 끝 · 위치 저장 · 상태칩 · 안내');
  chk(b.L.pointerdown.cap === true && b.mod._suppressNextContextMenu() === false, 'pointerdown 은 capture 로 건다 · 왼쪽 클릭은 contextmenu 억제 안 함');
  b.els.fsMoveBtn.classList.add('active'); b.els.fsMoveBtn.textContent = 'x'; b.els.fsMoveHint.style.display = 'block'; b.els.myMoveBtn.classList.add('on');
  b.mod.setMoveMode(true); b.L.pointerdown.fn({ button: 2 });
  chk(b.mod._suppressNextContextMenu() === true && !b.els.fsMoveBtn.classList.contains('active') && b.els.fsMoveBtn.textContent === '프로그램 이동' && b.els.fsMoveHint.style.display === 'none' && !b.els.myMoveBtn.classList.contains('on'), '우클릭 확정이면 contextmenu 1회 억제 · 버튼 · 힌트 · 칩 버튼 표시 원복');
  b.log.length = 0; b.L.pointerdown.fn({ button: 0 });
  chk(b.log.length === 0, '이동 중이 아니면 클릭을 무시한다');
  const b2 = build(SRC, { w: 0, h: 0 }); b2.mod.setMoveMode(true); b2.mod.setMoveModeJustToggled(true); mv(b2, 0, 0); mv(b2, 10, 10);
  chk(Number.isFinite(b2.pan.x) && Number.isFinite(b2.pan.y), '창 크기 0 이어도 나누기가 터지지 않는다(최소 1)');
}
say('§2 _charProjSane');
{
  const b = build(SRC, { w: 1000, h: 500 }); const S = b.mod._charProjSane;
  chk(S(500, 250, 100) === true && S(NaN, 0, 0) === false && S(0, Infinity, 0) === false && S(0, 0, NaN) === false, '화면 안 · 숫자가 아니면 거절');
  chk(S(500, 250, 1000) === true && S(500, 250, 1001) === false, '키가 화면 높이의 두 배까지만(경계 1000 / 1001)');
  chk(S(-999, 0, 10) === true && S(-1000, 0, 10) === false && S(1999, 0, 10) === true && S(2000, 0, 10) === false, '가로는 −폭 ~ 2×폭 안(경계)');
  chk(S(0, -499, 10) === true && S(0, -500, 10) === false && S(0, 999, 10) === true && S(0, 1000, 10) === false, '세로는 −높이 ~ 2×높이 안(경계)');
}
say('§3 읽는 · 쓰는 함수');
{
  const b = build(SRC);
  chk(b.mod._charBoundsLatest() === null && b.mod._charBadWhy() === null && b.mod._twMoveSeenAt() === 0 && b.mod.moveMode() === false && b.mod._suppressNextContextMenu() === false && b.mod._moveModeJustToggled() === false, '처음 값');
  b.mod.setCharBoundsLatest({ x: 1 }); b.mod.setCharBadWhy('why'); b.mod.setTwMoveSeenAt(9); b.mod.setSuppressNextContextMenu(true);
  chk(b.mod._charBoundsLatest().x === 1 && b.mod._charBadWhy() === 'why' && b.mod._twMoveSeenAt() === 9 && b.mod._suppressNextContextMenu() === true, '쓰는 함수로 바꾼 값을 읽는 함수가 읽는다');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/move-mode.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — move-mode.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'moveModeMod', 'TwMoveMode', 'createMoveMode');
  const FN = ['layoutSeats', 'toast'];
  const shape = (n, v) => FN.includes(n) ? v === '(...a)=>' + n + '(...a)' : v === n;
  chk(!!pairs && pairs.length === 6 && pairs.every(([n, v]) => shape(n, v)), '★ deps 6개 모양 — 함수 둘은 (...a)=>이름(...a) · 값 넷은 이름 그대로');
  const bad = pairs ? pairs.map(([n, v]) => n === 'toast' ? [n, 'toast'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  mutation test: 함수를 값으로 넘기면 빨강');
  chk(/^const _charProjSane = moveModeMod\._charProjSane;/m.test(code) && !/^let (moveMode|_charBoundsLatest|_charBadWhy|_twMoveSeenAt|_suppressNextContextMenu|_moveModeJustToggled)\b/m.test(code), '옛 이름 const · let 이 app.js 에 안 남음');
  chk(/setMoveMode: \(v\)=>\{ moveModeMod\.setMoveMode\(v\); \}/.test(code) && (code.match(/moveModeMod\.moveMode\(\)/g) || []).length >= 3, '쓰는 자리 · 읽는 자리가 moveModeMod 를 부른다');
}
say('§5 mutation test');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("let nx = startPanX - dxPix/Math.max(1, innerWidth);", "let nx = startPanX + dxPix/Math.max(1, innerWidth);");
  chk(!!m1 && (() => { const b = build(m1); b.mod.setMoveMode(true); b.mod.setMoveModeJustToggled(true); mv(b, 100, 100); mv(b, 200, 150); return Math.abs(b.pan.x - 0.0) > 1e-9; })(), '가로 부호를 바꾸면 빨강');
  const m2 = brk("if(e.button===2) _suppressNextContextMenu = true;", "");
  chk(!!m2 && (() => { const b = build(m2); b.mod.setMoveMode(true); b.L.pointerdown.fn({ button: 2 }); return b.mod._suppressNextContextMenu() === false; })(), '우클릭 확정 뒤 contextmenu 억제를 빼면 빨강');
  const m3 = brk("saveCharPos();", "");
  chk(!!m3 && (() => { const b = build(m3); b.mod.setMoveMode(true); b.L.pointerdown.fn({ button: 0 }); return !b.log.includes('save'); })(), '확정 때 저장을 빼면 빨강');
  const m4 = brk("}, true);   // capture", "});   // capture");
  chk(!!m4 && build(m4).L.pointerdown.cap !== true, 'capture 를 빼면 빨강');
  const m5 = brk("if(h > mh * 2) return false;", "");
  chk(!!m5 && build(m5, { w: 1000, h: 500 }).mod._charProjSane(500, 250, 5000) === true, '키 상한을 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
