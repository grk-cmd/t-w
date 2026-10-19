/* sim-drag-scroll.js — 🖱 스크롤바를 숨긴 목록을 마우스로 끌어 움직이기(shared/drag-scroll.js) · 📩 우편함 배선
   실행:  node sim-drag-scroll.js   (drag-scroll.js · myhome-ui.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 끌기와 누르기가 섞이면 끌다가 엉뚱한 글이 열리거나(클릭이 새어 나감), 반대로 살짝 떨린 누르기가 안 먹는다.
   ・1절: 끌기 — 문턱(DRAG_PX) 아래는 누르기 그대로 · 넘으면 따라 움직이고 그 뒤 클릭은 막는다 · 다음 누르기는 다시 열린다 · 오른쪽 버튼 · 두 번 걸기
   ・2절: 깨 보기 · 3절: 배선(html 순서 · 우편 · 소식 목록에 건다 · 스크롤바 숨김 css · smoke) */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('drag-scroll.js') || read('shared/drag-scroll.js'), UI = read('myhome-ui.js') || read('myhome/myhome-ui.js'),
  HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !UI || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — drag-scroll.js · myhome-ui.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }

const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwDragScroll; };
function mkEl(){
  const L = {}, cls = new Set();
  const el = { scrollTop: 100, captured: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    addEventListener(t, f, cap){ (L[t] = L[t] || []).push({ f, cap: !!cap }); },
    setPointerCapture(id){ el.captured = id; },
    fire(t, o = {}){ const e = Object.assign({ prevented: 0, stopped: 0, preventDefault(){ e.prevented++; }, stopPropagation(){ e.stopped++; } }, o); (L[t] || []).forEach((h) => h.f(e)); return e; },
    count: (t) => (L[t] || []).length };
  return el;
}

function behave(src){
  const r = []; const t = (ok, m) => r.push([!!ok, m]);
  const D = load(src);
  t(D && typeof D.attachDragScroll === 'function' && D.DRAG_PX === 5, '싣기만 하면 window.TwDragScroll · 문턱 5px');
  let el = mkEl(); D.attachDragScroll(el); D.attachDragScroll(el);
  t(el.count('pointerdown') === 1 && el.count('click') === 1, '같은 요소에 두 번 걸어도 한 번만');
  t((() => { try { D.attachDragScroll(null); return true; } catch (_) { return false; } })(), '  요소가 없으면 조용히 넘어간다(목록 칸이 없는 화면)');
  el.fire('pointerdown', { button: 0, clientY: 200, pointerId: 7 });
  el.fire('pointermove', { clientY: 204 }); el.fire('pointerup', {});
  let c = el.fire('click');
  t(el.scrollTop === 100 && c.stopped === 0 && c.prevented === 0 && !el.captured, '★ 문턱 아래(4px)는 누르기 — 안 움직이고 클릭은 그대로(글 열기)');
  el.fire('pointerdown', { button: 0, clientY: 200, pointerId: 8 });
  el.fire('pointermove', { clientY: 195 });
  t(el.scrollTop === 105 && el.classList.contains('dragging') && el.captured === 8, '★ 문턱을 넘으면(5px) 손을 따라 움직인다 · 끄는 중 표시 · 포인터를 잡는다');
  el.fire('pointermove', { clientY: 140 });
  t(el.scrollTop === 160, '  위로 60px 끌면 목록이 60px 내려간다(손을 따라)');
  el.fire('pointerup', {}); c = el.fire('click');
  t(!el.classList.contains('dragging') && c.stopped === 1 && c.prevented === 1, '★ 끈 뒤 손을 뗄 때 나는 클릭은 막는다(엉뚱한 글이 안 열린다)');
  el.fire('pointerdown', { button: 0, clientY: 50, pointerId: 9 }); el.fire('pointerup', {}); c = el.fire('click');
  t(c.stopped === 0, '  그다음 누르기는 다시 글을 연다');
  el.fire('pointerdown', { button: 0, clientY: 50, pointerId: 12 }); el.fire('pointermove', { clientY: 20 }); el.fire('pointerup', {});
  el.fire('pointerdown', { button: 0, clientY: 50, pointerId: 13 }); el.fire('pointerup', {}); c = el.fire('click');
  t(c.stopped === 0, '★ 목록 밖에서 손을 떼 클릭이 안 난 끌기 뒤에도 다음 누르기는 글을 연다');
  el.scrollTop = 160;
  el.fire('pointerdown', { button: 2, clientY: 50, pointerId: 10 }); el.fire('pointermove', { clientY: 0 });
  t(el.scrollTop === 160, '  오른쪽 버튼은 끌지 않는다');
  el.fire('pointerdown', { button: 0, clientY: 50, pointerId: 11 }); el.fire('pointermove', { clientY: 30 }); el.fire('pointercancel', {});
  el.fire('pointermove', { clientY: 0 });
  t(!el.classList.contains('dragging') && el.scrollTop === 180, '  취소되면 끌기를 끝낸다(뒤 움직임은 안 따라간다)');
  return r;
}

say('── 1. 끌기');
behave(MOD).forEach(([ok, m]) => chk(ok, m));
say('── 2. 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['문턱 없음(누르기도 끌기로)', (s) => s.replace('if(Math.abs(dy) < DRAG_PX) return;', '')],
  ['끈 뒤 클릭을 안 막음', (s) => s.replace('e.preventDefault(); e.stopPropagation();', '')],
  ['누를 때 끌기 표시를 안 지움', (s) => s.replace('    moved = false;\n  });', '  });')],
  ['오른쪽 버튼도 끈다', (s) => s.replace('if(e.button !== 0) return;', '')],
  ['반대 방향으로 움직임', (s) => s.replace('el.scrollTop = start.top - dy;', 'el.scrollTop = start.top + dy;')],
];
for (const [name, f] of breaks) {
  const m2 = f(MOD); const changed = m2 !== MOD;
  let red; try { red = behave(m2).some(([ok]) => !ok); } catch (_) { red = true; }
  chk(changed && red, name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 3. 배선');
const iD = HTML.indexOf('<script src="parts/shared/drag-scroll.js">'), iU = HTML.indexOf('<script src="parts/myhome/myhome-ui.js">');
chk(iD > 0 && iD < iU, 'html — drag-scroll.js 를 myhome-ui.js 보다 먼저');
chk(/\['mhInboxList', 'mhNewsList'\]\.forEach\(id=>TwDragScroll\.attachDragScroll\(document\.getElementById\(id\)\)\);/.test(UI), '★ 우편 · 소식 목록 둘 다에 건다');
chk(/#mhInboxList, #mhNewsList\{scrollbar-width:none;\}/.test(HTML) && /#mhInboxList::-webkit-scrollbar, #mhNewsList::-webkit-scrollbar\{display:none;\}/.test(HTML), '★ 두 목록 모두 스크롤바를 숨긴다(휠은 그대로)');
const sD = SMOKE.indexOf("PRELOAD.push('drag-scroll.js');"), sU = SMOKE.indexOf("PRELOAD.push('myhome-ui.js');");
chk(sD > 0 && sD < sU, 'smoke PRELOAD — drag-scroll.js 를 myhome-ui.js 보다 먼저');
say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 목록은 끌어도 · 눌러도 맞게 움직인다'));
process.exit(fail ? 1 : 0);
