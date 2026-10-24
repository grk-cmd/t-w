/* ═══ 🖱️ sim-seat-regions.js — main 에 보내는 «우리 UI 자리» 에 다른 좌석도 (status/status-chip.js otherSeatRegions) ═══════════════
   [무엇을 지키나] main 의 «우리 UI 위 클릭인가»(_ptOnOurUI)가 내 좌석 원 · 창 사각형만 알아서, 클릭이 굳은 채 남의 캐릭터 ·
     혼자 모드 추가 좌석을 누르면 «UI 밖» 으로 보고 회복 3단계(click-through-policy skip-offui)를 건너뛰었다.
     렌더러(_pointHitsInteractive)는 좌석 전부를 맞히므로 다른 좌석 자리도 하트비트 regions 에 싣는다.
   ・1절: otherSeatRegions 를 가짜 THREE · 카메라 · DOM 위에서 실제로 돌린다 — 다른 좌석은 몸 크기 사각형 · 내 좌석 · 날아가는 좌석 ·
          숨긴 좌석은 뺌 · 회사원 숨김 / run 화면 아님이면 빈 목록 · 화면 밖으로 걸치면 잘라서 · 화면 밖 · 터진 투영은 뺌 · 상한
   ・2절: 하트비트(app.js)가 창 사각형 뒤에 이어 보낸다 · main 의 _ptOnOurUI 가 그 사각형 안 점을 «UI 위» 로 본다(진짜 함수)
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
const MOD = read('status-chip.js'), APP = read('app.js'), MAIN = read('main.js');

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
    t(/regions: window\.__uiRegions \? window\.__uiRegions\(\)\.concat\(statusChipMod\.otherSeatRegions\(\)\) : undefined,/.test(app), '하트비트 — 창 사각형 뒤에 좌석 사각형을 이어 보낸다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}
say('── 1 · 2. 좌석 사각형');
judge(MOD, APP).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['내 좌석도 담음', "if(!s || s.isMe || !s.group || s.fly || _seatHidden(s)) continue;", "if(!s || !s.group || s.fly || _seatHidden(s)) continue;", null],
  ['숨긴 좌석도 담음', "if(!s || s.isMe || !s.group || s.fly || _seatHidden(s)) continue;", "if(!s || s.isMe || !s.group || s.fly) continue;", null],
  ['회사원 숨김을 안 봄', "  if(!clickPolicy.charHittable({ officeHidden: _officeHidden() })) return out;\n  let rect = null;", "  let rect = null;", null],
  ['화면 밖을 안 자름', "const x0 = Math.max(0, cx - half)", "const x0 = (cx - half)", null],
  ['하트비트가 안 붙임', null, null, ".concat(statusChipMod.otherSeatRegions())"],
];
for(const [name, a, b, appDrop] of breaks){
  const m2 = a ? MOD.replace(a, b) : MOD, a2 = appDrop ? APP.replace(appDrop, '') : APP;
  const changed = m2 !== MOD || a2 !== APP;
  let rows; try{ rows = judge(m2, a2); }catch(_){ rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
