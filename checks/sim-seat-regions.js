/* ═══ 🖱️ sim-seat-regions.js — main 에 보내는 «우리 UI 자리» 에 다른 좌석도 (status/status-chip.js otherSeatRegions) ═══════════════
   [무엇을 지키나] main 의 «우리 UI 위 클릭인가»(_ptOnOurUI)가 내 좌석 원 · 창 사각형만 알아서, 클릭이 굳은 채 남의 캐릭터 ·
     혼자 모드 추가 좌석을 누르면 «UI 밖» 으로 보고 회복 3단계(click-through-policy skip-offui)를 건너뛰었다.
     렌더러(_pointHitsInteractive)는 좌석 전부를 맞히므로 다른 좌석 자리도 하트비트 regions 에 싣는다.
   ・1절: otherSeatRegions 를 가짜 THREE · 카메라 · DOM 위에서 실제로 돌린다 — 다른 좌석은 몸 크기 사각형 · 내 좌석 · 날아가는 좌석 ·
          숨긴 좌석은 뺌 · 회사원 숨김 / run 화면 아님이면 빈 목록 · 화면 밖으로 걸치면 잘라서 · 화면 밖 · 터진 투영은 뺌 · 상한
   ・2절: main 에 regions 를 보내는 두 길 — 하트비트(app.js)와 클릭받기 전환 이유(desktop-run.js _pushIgnoreWhy) — 를 실제로 돌려
          보낸 payload 에 좌석 사각형이 있는지 · main 의 _ptOnOurUI 가 그 사각형 안 점을 «UI 위» 로 본다(진짜 함수)
   ・3절: 일부러 깨 보기
   [실행] node checks/run.js sim-seat-regions */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const read = (n) => { const f = findUp(n); return f ? fs.readFileSync(f, 'utf8') : ''; };
const MOD = read('status-chip.js'), APP = read('app.js'), MAIN = read('main.js'), DR = read('desktop-run.js');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* 월드 x · y 가 그대로 NDC(÷10) 로 가는 가짜 카메라 — 화면 1000×800, 캔버스가 화면 전체 */
class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  copy(v){ return this.set(v.x, v.y, v.z); }
  project(){ this.x /= 10; this.y /= 10; return this; }
}
class Box3 {
  constructor(){ this.makeEmpty(); }
  makeEmpty(){ this.min = new V3(Infinity, Infinity, Infinity); this.max = new V3(-Infinity, -Infinity, -Infinity); return this; }
  isEmpty(){ return this.max.y < this.min.y; }
}
const W = 1000, H = 800;
function seat(x, y, o){
  const s = Object.assign({ bodyWrap: { visible: true, _h: 1.0, _w: 0.4 } }, o || {});
  s.group = { getWorldPosition: (v) => v.set(x, y, 0) };
  return s;
}
function build(src, env){
  const any = anything();
  const deps = new Proxy({}, { get: (t, k) => k in t ? t[k] : any });
  Object.assign(deps, {
    seats: env.seats, camera: {}, renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }) } },
    _officeHidden: () => !!env.office, _seatHidden: (s) => !!s.hiddenSeat,
    _charProjSane: (x, y, h) => isFinite(x) && isFinite(y) && h < H * 2 && x > -W && x < W * 2 && y > -H && y < H * 2,
    clickPolicy: { charHittable: (f) => !f.officeHidden },
    measureBodyBox: (t, o, box) => { box.min.set(-t._w / 2, 0, 0); box.max.set(t._w / 2, t._h, 0); return box; },
  });
  const body = { classList: { contains: (c) => c === 'runmode' && !env.notRun } };
  const doc = new Proxy({ body }, { get: (t, k) => k in t ? t[k] : any });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'innerWidth', 'innerHeight', 'performance',
    src + '\nreturn window.TwStatusChip;')(win, doc, { getItem: () => null, setItem(){}, removeItem(){} }, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, new Proxy({ Vector3: V3, Box3 }, { get: (o, k) => k in o ? o[k] : any }), () => {}, () => {}, undefined, W, H, { now: () => env.now = (env.now || 0) + 1000 });
  return api.createStatusChip(deps);
}
/* main 의 진짜 _ptOnOurUI — 같은 사각형을 «UI 위» 로 보는지 */
function mainPtOnUI(regions, x, y){
  const i = MAIN.indexOf('function _ptOnOurUI(cx, cy, margin){');
  if(i < 0) throw new Error('main.js 에서 _ptOnOurUI 를 못 찾음');
  let k = MAIN.indexOf('{', i), d = 0; for(; k < MAIN.length; k++){ if(MAIN[k] === '{') d++; else if(MAIN[k] === '}' && --d === 0) break; }
  return new Function('_lastCharBounds', '_lastRegions', MAIN.slice(i, k + 1) + '\nreturn _ptOnOurUI;')(null, regions)(x, y);
}
function judge(src, app){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const me = seat(0, 0, { isMe: true });
    const other = seat(2, -1, { remote: true });          // 화면 (600,440)~(600,400) · 키 1 → 40px · 반폭 0.2 → 8px
    const extra = seat(-3, 0);                             // 혼자 모드 추가 좌석
    const fly = seat(1, 1, { fly: {} }), hid = seat(1, -2, { remote: true, hiddenSeat: true });
    const R = build(src, { seats: [me, other, extra, fly, hid] }).otherSeatRegions();
    t(R.length === 2, '다른 좌석 둘(남 · 추가 좌석)만 — 내 좌석 · 날아가는 · 숨긴 좌석은 뺀다(지금 ' + R.length + ')');
    const g = R[0] || {};
    t(g.x === 592 && g.y === 400 && g.w === 16 && g.h === 40, '★ 몸 크기 사각형 — 발밑(600,440) 위로 키 40px · 폭 16px (' + JSON.stringify(g) + ')');
    t(mainPtOnUI(R, 600, 420) === true && mainPtOnUI(R, 700, 420) === false, '★ main _ptOnOurUI — 남의 캐릭터 위 점은 «UI 위», 옆 빈 곳은 아님');
    t(build(src, { seats: [me, other], office: true }).otherSeatRegions().length === 0, '  회사원 숨김 — 빈 목록');
    t(build(src, { seats: [me, other], notRun: true }).otherSeatRegions().length === 0, '  run 화면이 아님 — 빈 목록');
    const edge = build(src, { seats: [seat(-10, 0)] }).otherSeatRegions()[0] || {};
    t(edge.x === 0 && edge.w === 8, '  화면 왼쪽에 걸친 좌석 — 보이는 부분만(x 0 · 폭 8)');
    t(build(src, { seats: [seat(-30, 0), seat(1e9, 0)] }).otherSeatRegions().length === 0, '  화면 밖 · 터진 투영 — 뺀다');
    const many = []; for(let i = 0; i < 40; i++) many.push(seat(0, 0));
    t(build(src, { seats: many }).otherSeatRegions().length === 24, '  상한 24');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}
/* desktop-run.js 를 실제로 만들고 두 길로 보낸 payload 를 모은다 — 좌석 사각형은 dep otherSeatRegions 가 준다 */
const SEAT_G = { x: 592, y: 400, w: 16, h: 40 };
function sendPaths(dr, app){
  const any = anything();
  const sent = [], L = {};
  const companion = new Proxy({ setCharBounds: (b) => sent.push(b) }, { get: (t, k) => k in t ? t[k] : any });
  const win = new Proxy({ companion, addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); } }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const body = { classList: { contains: (c) => c === 'runmode', add(){}, remove(){}, toggle(){} } };
  const doc = new Proxy({ body, querySelectorAll: () => [], elementFromPoint: () => null }, { get: (t, k) => k in t ? t[k] : any });
  const deps = new Proxy({
    desktopMode: true, seats: [], otherSeatRegions: () => [SEAT_G],
    clickPolicy: new Proxy({ pointerDownStep: () => 'receive' }, { get: (t, k) => k in t ? t[k] : (() => ({})) }),
    _charBoundsLatest: () => ({ x: 10, y: 10, r: 50 }), _twMoveSeenAt: () => 0,
  }, { get: (t, k) => k in t ? t[k] : any });
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'innerWidth', 'innerHeight', 'performance', 'getComputedStyle',
    dr + '\nreturn window.TwDesktopRun;')(win, doc, { getItem: () => null, setItem(){}, removeItem(){} }, any, any, companion, () => 0, () => 0, () => {}, () => {}, (fn) => { fn(); return 0; }, any, win.addEventListener, () => {}, undefined, W, H, { now: () => 0 }, () => ({}));
  api.createDesktopRun(deps);
  const out = {};
  (L.pointerdown || []).forEach(fn => fn({}));            // 클릭받기로 전환 → _pushIgnoreWhy 가 보낸다
  out.why = sent.find(b => b.ignoreWhy) || null;
  /* 하트비트 — app.js 의 setInterval 덩이를 떼어 실제로 한 번 돌린다 */
  const i = app.indexOf('let _twMoveSeenAt = 0;\ntry{\n  setInterval(');
  const END = '  }, 100);\n}catch(_){}';
  const j = app.indexOf(END, i);
  if(i < 0 || j < 0) throw new Error('app.js 에서 하트비트 덩이를 못 찾음');
  let tick = null;
  new Function('window', 'companion', 'setInterval', '_charBoundsLatest', '_charBadWhy', app.slice(i, j + END.length))(win, companion, (fn) => { tick = fn; }, { x: 10, y: 10, r: 50 }, null);
  const n0 = sent.length; if(tick) tick();
  out.beat = sent.length > n0 ? sent[sent.length - 1] : null;
  return out;
}
function judgePaths(dr, app){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const has = (b) => !!(b && Array.isArray(b.regions) && b.regions.some(g => g.x === SEAT_G.x && g.w === SEAT_G.w));
  try{
    const o = sendPaths(dr, app);
    t(has(o.why) && o.why.ignoreWhy === 'pointerdown', '★ 클릭받기 전환 이유(_pushIgnoreWhy)가 보낸 regions 에도 좌석 사각형 — 그 순간 좌석이 빠지면 ⓖ 가 회수한다');
    t(has(o.beat), '★ 하트비트(app.js)가 보낸 regions 에도 좌석 사각형');
    t(o.beat && mainPtOnUI(o.beat.regions, 600, 420) === true, '  main _ptOnOurUI — 보낸 regions 로 남의 캐릭터 위 점은 «UI 위»');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}
say('── 1. 좌석 사각형');
judge(MOD, APP).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. main 에 보내는 두 길');
judgePaths(DR, APP).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['내 좌석도 담음', "if(!s || s.isMe || !s.group || s.fly || _seatHidden(s)) continue;", "if(!s || !s.group || s.fly || _seatHidden(s)) continue;", null],
  ['숨긴 좌석도 담음', "if(!s || s.isMe || !s.group || s.fly || _seatHidden(s)) continue;", "if(!s || s.isMe || !s.group || s.fly) continue;", null],
  ['회사원 숨김을 안 봄', "  if(!clickPolicy.charHittable({ officeHidden: _officeHidden() })) return out;\n  let rect = null;", "  let rect = null;", null],
  ['화면 밖을 안 자름', "const x0 = Math.max(0, cx - half)", "const x0 = (cx - half)", null],
];
for(const [name, a, b] of breaks){
  const m2 = MOD.replace(a, b);
  let rows; try{ rows = judge(m2, APP); }catch(_){ rows = [[false, '던짐']]; }
  chk(m2 !== MOD && rows.some(([ok]) => !ok), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
const drBreaks = [
  ['_uiRegions 가 좌석을 안 합침', "      try{ const sr = otherSeatRegions(); for(let i = 0; i < sr.length; i++) out.push(sr[i]); }catch(_){}\n", ''],
  ['_pushIgnoreWhy 가 좌석 없는 목록을 보냄', 'regions: _uiRegions(), ignoreWhy: why });', 'regions: [], ignoreWhy: why });'],
];
for(const [name, a, b] of drBreaks){
  const d2 = DR.replace(a, b);
  let rows; try{ rows = judgePaths(d2, APP); }catch(_){ rows = [[false, '던짐']]; }
  chk(d2 !== DR && rows.some(([ok]) => !ok), name + (d2 !== DR ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
