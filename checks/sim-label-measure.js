/* sim-label-measure.js — 📐 좌석 라벨이 매 프레임 강제 레이아웃을 내지 않는다
   실행:  node sim-label-measure.js   (label-measure.js · overhead.js · exp-bar.js · net-ready.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 라벨 자리를 적은 바로 뒤에 크기 · 사각형을 읽으면 브라우저가 그 자리에서 배치를 다시 계산한다.
     좌석마다 몇 번씩 · 초당 최대 60번이라 사람이 많은 방에서 버벅임이 된다. 누가 «바로 재기» 를 다시 넣으면 여기서 빨강.
   ・1절: 기억 모듈(label-measure.js) — 캔버스는 프레임에 한 번 · 크기는 열쇠 · 시간 · 숨김 · 0 경계
   ・2절: 실제 overhead.js · exp-bar.js 를 가짜 DOM 에서 돌린다 — «쓰기 뒤 읽기»(강제 레이아웃)를 세고, 남긴 아래변이 화면 사각형과 같은지
   ・3절: 깨 보기 — 옛 «바로 재기» 로 되돌리면 강제 레이아웃 수가 늘어 빨강
   ・4절: 배선 — frame() 이 상한 검사 뒤 맨 앞에서 beginLabelFrame · html · smoke 순서 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const LM = read('label-measure.js') || read('room/label-measure.js'), OV = read('overhead.js') || read('room/overhead.js'),
  EXP = read('exp-bar.js') || read('focus/exp-bar.js'), NET = read('net-ready.js') || read('shared/net-ready.js'),
  APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js') || read('checks/smoke.js');
if (!LM || !OV || !EXP || !NET || !APP || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — label-measure.js · overhead.js · exp-bar.js · net-ready.js · app.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }

const loadLM = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwLabelMeasure; };

say('── 1. 기억 모듈');
{
  const L = loadLM(LM);
  chk(!!L && typeof L.createLabelMeasure === 'function' && L.REFRESH_MS === 500, '싣기만 하면 window.TwLabelMeasure · REFRESH_MS 500');
  let t = 0, reads = 0;
  const M = L.createLabelMeasure({ readCanvasRect: () => { reads++; return { left: reads, top: 0, width: 100, height: 100 }; }, now: () => t });
  const a = M.canvasRect(), b = M.canvasRect();
  chk(reads === 1 && a === b, '★ 한 프레임 안에서는 캔버스 사각형을 한 번만 잰다');
  M.beginFrame();
  chk(M.canvasRect().left === 2 && reads === 2, '  beginFrame 뒤 첫 부름은 새로 잰다');
  let measured = 0;
  const el = (w, h, disp) => ({ style: { display: disp || 'block' }, get offsetWidth(){ measured++; return w; }, get offsetHeight(){ return h; } });
  const e1 = el(80, 18);
  chk(M.size(null, 'k') === null, '  요소가 없으면 null');
  const s1 = M.size(e1, 'k');
  chk(s1 && s1.w === 80 && s1.h === 18 && measured === 1, '처음엔 잰다 — { w, h }');
  t = 100; M.size(e1, 'k'); M.size(e1, 'k');
  chk(measured === 1, '★ 열쇠가 같고 500ms 안이면 다시 안 잰다');
  M.size(e1, 'k2');
  chk(measured === 2, '  열쇠(글 · 클래스)가 바뀌면 잰다');
  t = 100 + 499; M.size(e1, 'k2');
  chk(measured === 2, '  경계: 499ms 는 아직 기억한 값');
  t = 100 + 500; M.size(e1, 'k2');
  chk(measured === 3, '  경계: 500ms 가 지나면 다시 잰다(글자 크기 슬라이더 · 늦은 글꼴)');
  e1.style.display = 'none'; t += 1000;
  const sh = M.size(e1, 'other');
  chk(measured === 3 && sh && sh.h === 18, '★ 숨은 요소는 재지 않고 마지막 값 — 0 을 기억하면 다시 보일 때 튄다');
  const e0 = el(0, 0);
  chk(M.size(e0, 'k') === null && measured === 4, '  0 으로 재지면(부모가 숨음) 기억하지 않는다 — 다음에 다시');
  const e0b = el(0, 0); e0b._lm = { w: 5, h: 6, key: 'old', at: -1e9 };
  chk(M.size(e0b, 'k').h === 6, '  0 이면 마지막 값을 그대로');
}

/* ── 가짜 DOM — 쓰기가 있으면 «더러움», 더러운 상태에서 읽으면 강제 레이아웃 한 번 ── */
function makeEnv(){
  const env = { dirty: false, forced: 0, reads: 0, t: 0, raf: [], ann: null };
  const read = () => { env.reads++; if (env.dirty) { env.forced++; env.dirty = false; } };
  const SIZE = { 'seat-nameplate': [80, 18], 'seat-exp': [76, 10], 'seat-bubble-dom': [100, 30], 'seat-announce': [200, 20], 'bub-txt': [96, 26], marquee: [300, 18] };
  function mkEl(tag){
    const st = {};
    const style = new Proxy(st, { set(o, k, v){ if (o[k] !== v) env.dirty = true; o[k] = v; return true; }, get(o, k){ return k === 'setProperty' ? ((n, v) => { env.dirty = true; o[n] = v; }) : (k in o ? o[k] : ''); } });
    const classes = new Set();
    const e = {
      tagName: tag, children: [], style, _txt: '', listeners: {},
      get className(){ return [...classes].join(' '); },
      set className(v){ classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); env.dirty = true; },
      classList: {
        add: (c) => { if (!classes.has(c)) { classes.add(c); env.dirty = true; } },
        remove: (c) => { if (classes.delete(c)) env.dirty = true; },
        toggle: (c, on) => { const want = on === undefined ? !classes.has(c) : !!on; if (want !== classes.has(c)) { want ? classes.add(c) : classes.delete(c); env.dirty = true; } return want; },
        contains: (c) => classes.has(c),
      },
      get textContent(){ return e._txt; }, set textContent(v){ e._txt = String(v); e.children = []; env.dirty = true; },
      set innerHTML(v){ e._txt = String(v); env.dirty = true; },
      appendChild(c){ e.children.push(c); c.parentNode = e; env.dirty = true; return c; },
      remove(){},
      addEventListener(n, f){ e.listeners[n] = f; },
      querySelector(sel){ const cls = sel.replace(/^\./, ''); const f = (n) => { for (const c of n.children) { if (c.classList.contains(cls)) return c; const r = f(c); if (r) return r; } return null; }; return f(e); },
      querySelectorAll(){ return []; },
      _size(){ for (const c of classes) if (SIZE[c]) return SIZE[c]; return [0, 0]; },
      get offsetWidth(){ read(); return st.display === 'none' ? 0 : e._size()[0]; },
      get offsetHeight(){ read(); return st.display === 'none' ? 0 : e._size()[1]; },
      get scrollWidth(){ read(); return e._size()[0]; },
      get clientWidth(){ read(); return st.display === 'none' ? 0 : e._size()[0]; },
      /* CSS 그대로 — 이름표 · 공지는 .inverted 면 translate(-50%,0) 아니면 (-50%,-100%) · 경험치 바는 (-50%,0) */
      getBoundingClientRect(){
        read();
        if (st.display === 'none') return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        const [w, h] = e._size(); const x = parseFloat(st.left) || 0; let y = parseFloat(st.top) || 0;
        if ((classes.has('seat-nameplate') || classes.has('seat-announce')) && !classes.has('inverted')) y -= h;
        return { left: x - w / 2, right: x + w / 2, top: y, bottom: y + h, width: w, height: h };
      },
    };
    return e;
  }
  const layer = mkEl('div'); layer.id = 'seatLabelsLayer';
  const canvasEl = { getBoundingClientRect(){ read(); return { left: 0, top: 0, width: 1000, height: 800 }; } };
  const doc = {
    readyState: 'complete',
    body: { classList: { contains: () => false } },
    getElementById: (id) => id === 'seatLabelsLayer' ? layer : null,
    createElement: (t) => mkEl(t),
    createTextNode: (s) => ({ _txt: s, children: [], classList: { contains: () => false } }),
  };
  env.doc = doc; env.canvas = canvasEl; env.read = read; env.mkEl = mkEl;
  return env;
}

class V3 {
  constructor(x, y, z){ this.x = x || 0; this.y = y || 0; this.z = z || 0; }
  copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  project(){ this.x = this.x / 10; this.y = this.y / 10; return this; }   // 월드 ±10 → 화면 끝
}

function build(ovSrc, expSrc, lmSrc){
  const env = makeEnv();
  const win = { devicePixelRatio: 1 };
  const fbRef = {}; win.firebaseAPI = fbRef;
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const perf = { now: () => env.t };
  const raf = (f) => { env.raf.push(f); return env.raf.length; };
  const G = ['window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'performance', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'innerHeight', 'innerWidth', 'THREE', 'module'];
  const vals = [win, env.doc, ls, {}, fbRef, perf, raf, () => 0, () => {}, 800, 1000, { Vector3: V3 }, undefined];
  new Function(...G, NET + '\n' + lmSrc + '\nvar TwNetReady = window.TwNetReady, TwLabelMeasure = window.TwLabelMeasure;\n' + ovSrc + '\n' + expSrc)(...vals);
  const wp = new V3();
  const ov = win.TwOverhead.createOverhead({
    ANIMAL_RUN_SCALE: 0.4, _chatEsc: (s) => s, _diceSvg: () => '', _starPaint: () => {}, _wpTmp3: wp,
    camera: {}, chatUiMod: {}, rtHub: { store: { onMessage: (t, fn) => { if(t === 'announce') env.ann = fn; } } }, focusLevelMod: () => ({ lvStarStr: () => '' }), getDisplayName: () => '나',
    officeMode: () => () => false, renderer: { domElement: env.canvas }, seatScale: () => 1, seats: [], tricksMod: { BONK_BUBBLE_MARK: '[bonk]' },
  });
  const exp = win.TwExpBar.createExpBar({ _focusTotalSec: () => 1234, _starPaint: () => {}, lvBarClass: () => 'lv1', lvStarBarClass: () => 'lvs', overheadMod: ov, bindLabelDrag: () => {} });
  return { env, ov, exp };
}

/* 프레임 루프 순서 그대로 — beginLabelFrame → 좌석마다 바 → 이름표(+공지) → 말풍선 */
function runFrames(b, seats, n, invertY){
  const { env, ov, exp } = b;
  const per = [];
  for (let f = 0; f < n; f++) {
    env.t += 16; _tick++;
    const before = env.forced;
    ov.beginLabelFrame();
    seats.forEach((s, i) => {
      exp.updateSeatExpBar(s, 3, 5, null);
      ov.setSeatNamePlate(s, 3, '사람' + i, null);
      ov.setSeatHeadBubble(s, '안녕', false);
    });
    env.dirty = false;   // 그리기 · 다음 프레임 사이에 브라우저가 배치를 끝낸 셈 — 다음 프레임 첫 읽기는 강제가 아니다
    const rafs = env.raf.splice(0); rafs.forEach(fn => fn());
    per.push(env.forced - before);
  }
  return per;
}
/* 좌석은 프레임마다 조금씩 움직인다(자리 미끄러짐 · 끌기 · 카메라) — 제자리면 같은 값 쓰기라 «더러움» 이 안 생겨 옛 길도 0 으로 보인다 */
let _tick = 0;
const mkSeats = (k, y) => Array.from({ length: k }, (_, i) => ({ isMe: i === 0, group: { getWorldPosition: (v) => { v.x = -8 + i * 3 + (_tick % 7) * 0.013; v.y = y; v.z = 0; return v; } } }));

say('── 2. 실제 overhead.js · exp-bar.js — 강제 레이아웃 세기');
const steady = (per) => per.slice(5);
let base = null;
{
  const b = build(OV, EXP, LM);
  base = b;
  chk(typeof b.ov.beginLabelFrame === 'function' && typeof b.ov.labelSize === 'function' && typeof b.ov.nameplateHeight === 'function', 'overhead 가 beginLabelFrame · labelSize · nameplateHeight 를 내놓는다');
  const seats = mkSeats(6, -2);
  const per = runFrames(b, seats, 40);
  const st = steady(per), total = st.reduce((a, c) => a + c, 0);
  chk(total <= 12, '★ 6좌석 · 35프레임에 강제 레이아웃 ' + total + '번(옛 길은 좌석 × 프레임마다 여러 번 · 500ms 마다 다시 재는 몫만 남는다)');
  chk(st.filter(x => x > 0).length <= 6, '  강제 레이아웃이 난 프레임 ' + st.filter(x => x > 0).length + '개 — 대부분의 프레임은 0');
  /* 남긴 아래변이 실제 화면 사각형과 같은가 — 사각형 대신 읽어도 자리가 안 바뀐다 */
  const same = seats.every(s => ['expBarEl', 'namePlateEl'].every(k => { const e = s[k]; const r = e.getBoundingClientRect(); return Math.abs(r.bottom - e._bottom) < 1e-9; }));
  chk(same, '★ 바 · 이름표가 남긴 아래변(_bottom) = 화면 사각형 아래변 — 다시 재지 않아도 같은 자리');
  const gap = seats.every(s => Math.abs(parseFloat(s.namePlateEl.style.top) - (s.expBarEl.getBoundingClientRect().bottom + 4)) < 1e-9 || parseFloat(s.namePlateEl.style.top) > s.expBarEl.getBoundingClientRect().bottom + 4);
  chk(gap, '  이름표는 경험치 바 아래 4px 이상(예전 사각형 판정과 같은 결과)');
  /* 반전(화면 위쪽) — 말풍선이 바 · 이름표 아래로 비킨다 */
  const b2 = build(OV, EXP, LM);
  const top = mkSeats(3, 9.9);
  const per2 = steady(runFrames(b2, top, 30)).reduce((a, c) => a + c, 0);
  chk(per2 <= 6, '★ 반전 배치(말풍선이 라벨 아래로 비키는 길)도 강제 레이아웃 ' + per2 + '번');
  const below = top.every(s => { const bub = parseFloat(s.bubbleEl.style.top); const lb = Math.max(s.namePlateEl.getBoundingClientRect().bottom, s.expBarEl.getBoundingClientRect().bottom); return bub >= lb; });
  chk(below, '  반전 말풍선은 실제 라벨 사각형보다 아래에 있다');
  /* 공지 — 내 좌석에만 · 마퀴 재기는 글이 바뀔 때만 */
  const b3 = build(OV, EXP, LM);
  chk(typeof b3.env.ann === 'function', '  확성기 announce 메시지를 받도록 걸렸다(가짜 realtime)');
  b3.env.ann({ text: '점검 안내', until: Date.now() + 50000 });
  const s3 = mkSeats(2, -2);
  let rafCount = 0; const origPush = b3.env.raf.push.bind(b3.env.raf); b3.env.raf.push = (f) => { rafCount++; return origPush(f); };
  runFrames(b3, s3, 30);
  chk(!!s3[0].announceEl && s3[0].announceEl.style.display === 'block' && !s3[1].announceEl, '  공지 배너는 내 좌석에만 뜬다');
  chk(rafCount === 1, '★ 공지 마퀴 재기는 한 번만(예전엔 매 프레임 requestAnimationFrame) — ' + rafCount + '번');
  b3.env.ann({ text: '두 번째 공지', until: Date.now() + 50000 });
  runFrames(b3, s3, 5);
  chk(rafCount === 2, '  글이 바뀌면 다시 잰다');
}

say('── 3. 깨 보기 — 옛 «바로 재기» 로 되돌리면 빨강');
{
  const count = (ov, ex, lm) => { const b = build(ov, ex, lm); return steady(runFrames(b, mkSeats(6, -2), 40)).reduce((a, c) => a + c, 0); };
  const breaks = [
    ['캔버스 사각형을 매번 잰다', OV.replace('const rect=labelMeasure.canvasRect();', 'const rect=renderer.domElement.getBoundingClientRect();'), EXP, LM],
    ['이름표가 바 사각형을 다시 잰다', OV.replace("if(_mb && _mb.style.display !== 'none' && _mb._bottom != null) _plateTop = Math.max(_plateTop, _mb._bottom + 4);",
      "if(_mb && _mb.style.display !== 'none'){ const _mr = _mb.getBoundingClientRect(); if(_mr.height) _plateTop = Math.max(_plateTop, _mr.bottom + 4); }"), EXP, LM],
    ['바가 이름표 높이를 매번 잰다', OV, EXP.replace('const h = overheadMod.nameplateHeight(seat);', 'const h = seat.namePlateEl.offsetHeight;'), LM],
    ['기억 모듈이 기억을 안 한다', OV, EXP, LM.replace('if(last && last.key === key && t - last.at < REFRESH_MS) return last;', '')],
    ['beginFrame 이 안 비우면 캔버스가 굳는다', OV, EXP, LM.replace('function beginFrame(){ canvasRect = null; }', 'function beginFrame(){}')],
  ];
  for (const [name, o, e, l] of breaks) {
    const changed = o !== OV || e !== EXP || l !== LM;
    let red = false;
    if (name.startsWith('beginFrame')) {
      const L = loadLM(l); let n = 0; const M = L.createLabelMeasure({ readCanvasRect: () => ({ left: ++n }), now: () => 0 });
      M.canvasRect(); M.beginFrame(); red = M.canvasRect().left === 1;
    } else red = count(o, e, l) > 12;
    chk(changed && red, name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
}

say('── 4. 배선');
{
  const fr = APP.slice(APP.indexOf('function frame(now, manual){'));
  const iCap = fr.indexOf('if(_frameCapped(now)){'), iBeg = fr.indexOf('overheadMod.beginLabelFrame();'), iSeats = fr.indexOf('seats.forEach(seat=>{');
  chk(iCap > 0 && iBeg > iCap && iBeg < iSeats, '★ frame() — 상한 검사 뒤 · 좌석 라벨보다 먼저 beginLabelFrame(빠지면 캔버스 사각형이 영영 안 바뀐다)');
  const hL = HTML.indexOf('<script src="parts/room/label-measure.js">'), hO = HTML.indexOf('<script src="parts/room/overhead.js">');
  chk(hL > 0 && hL < hO, 'html — label-measure.js 를 overhead.js 보다 먼저');
  const sL = SMOKE.indexOf("PRELOAD.push('label-measure.js');"), sO = SMOKE.indexOf("PRELOAD.push('overhead.js');");
  chk(sL > 0 && sL < sO, 'smoke PRELOAD — label-measure.js 를 overhead.js 보다 먼저');
}

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 좌석 라벨이 매 프레임 강제 레이아웃을 내지 않는다'));
process.exit(fail ? 1 : 0);
