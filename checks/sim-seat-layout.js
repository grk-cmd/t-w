/* ═══ 🪑 sim-seat-layout.js — 🪑 좌석 줄 배치 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 layoutSeats 본문 을 parts/room/seat-layout.js 로 옮겼다(글자 그대로 · 바뀐 줄 5 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 좌석 · 책상 폭으로 자리 · 카메라 값).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(layoutSeatRow)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 16줄 그대로 · 부르는 곳은 seatLayoutMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · seat-layout.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const SEATS = ["seats.js","parts/room/seats.js","app/parts/room/seats.js"].map(read).find(Boolean);
const MOD = ["seat-layout.js","parts/room/seat-layout.js","app/parts/room/seat-layout.js"].map(read).find(Boolean);
if(!MOD || !SEATS){ say('  ? 원본 못 찾음 — seat-layout.js · seats.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_rideBottom","clampDeskPan","renderSeatTabs","seatDeskHalfWidth","measureCharBox","syncSeatEqualize"];
const VAL_DEPS = ["seats"];
const GET_DEPS = ["MULTIPLAYER_SPACING","SPACING","deskPanX","deskPanY","roomSeatMode","seatCameraMod"];
const SET_DEPS = ["deskPanX","deskPanY"];
const EXPORTS = ["layoutSeatRow","seatHalfWidth","slotIndexAt"];
const MOVED = ["layoutSeatRow"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING,","  SPACING: ()=>SPACING,","  _rideBottom: (...a)=>_rideBottom(...a),","  clampDeskPan: (...a)=>clampDeskPan(...a),","  deskPanX: ()=>deskPanX,","  deskPanY: ()=>deskPanY,","  renderSeatTabs: (...a)=>renderSeatTabs(...a),","  roomSeatMode: ()=>roomSeatMode,","  seatCameraMod: ()=>seatCameraMod,","  seatDeskHalfWidth: (...a)=>seatDeskHalfWidth(...a),","  measureCharBox: (...a)=>measureCharBox(...a),","  seats: seats,","  syncSeatEqualize: (...a)=>syncSeatEqualize(...a),","  setCachedRowCenter: (v)=>{ _cachedRowCenter = v; },","  setCachedRowSpan: (v)=>{ _cachedRowSpan = v; },","  setDeskPanX: (v)=>{ deskPanX = v; },","  setDeskPanY: (v)=>{ deskPanY = v; },"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwSeatLayout;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createSeatLayout(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSeatLayout = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSeatLayout(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SEAT_LAYOUT_MOD_OFF") && app.includes("const seatLayoutMod = TwSeatLayout.createSeatLayout({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const seatLayoutMod = TwSeatLayout\\.createSeatLayout\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const seatLayoutMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 seatLayoutMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/seat-layout.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/seat-layout.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/seat-layout.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const seatLayoutMod = TwSeatLayout.createSeatLayout({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const seatLayoutMod = TwSeatLayout.createSeatLayout({", "const seatLayoutMod = TwSeatLayout.createSeatLayout({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSeatLayout = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const seatLayoutMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('seatLayoutMod.' + x)); if(n){ ls[i] = ls[i].replace('seatLayoutMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createSeatLayout(deps){', 'function createSeatLayout(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 좌석 · 책상 폭으로 줄 자리(targetX) · 카메라에 넘기는 줄 가운데 · 폭을 본다 */
say('── 4. 동작 — 좌석 줄 자리 · 간격 · 올라탄 좌석 · 카메라 값');
{
  const CAP = 1.1;
  function runLayout(seats, o){
    const log = [];
    const V = {
      seats, roomSeatMode: o.mode || 'row', deskPanX: o.panX || 0, deskPanY: o.panY || 0, MULTIPLAYER_SPACING: 0.15, SPACING: o.spacing !== undefined ? o.spacing : 0.4,
      _cachedRowCenter: 0, _cachedRowSpan: 1.2,
      syncSeatEqualize: () => log.push('sync'),
      renderSeatTabs: () => log.push('tabs'),
      clampDeskPan: (x, y) => { log.push('clamp'); return { x: Math.max(-0.2, Math.min(0.2, x)), y: Math.max(-0.1, Math.min(0.1, y)) }; },
      seatDeskHalfWidth: (s, forZoom) => { V._dc = (V._dc || 0) + 1; return forZoom ? Math.min(s.hw, CAP) : s.hw; },
      rideBenchMod: { _rideBottom: (s) => { let b = s; while(b.ridingOn) b = b.ridingOn; return b; } },
      seatCameraMod: { applyCameraAndCanvas: (c, w) => log.push(['cam', +c.toFixed(6), +w.toFixed(6)]) },
    };
    const W = { TwSeatPin: { pinFirst: (ss, mode) => { log.push('pin:' + mode); if(mode !== 'right') return false; const i = ss.findIndex(s => s.isMe); if(i <= 0) return false; const [m] = ss.splice(i, 1); ss.unshift(m); return true; } } };
    const st = {};
    let modApi = null;
    if(typeof MOD === 'string' && MOD){
      const deps = {};
      deps.seats = V.seats; deps._rideBottom = V.rideBenchMod._rideBottom;
      for(const k of ['syncSeatEqualize', 'renderSeatTabs', 'clampDeskPan', 'seatDeskHalfWidth']) deps[k] = V[k];
      /* 몸 박스 — 좌석의 gltfRoot.bw(몸 반폭)로 만든 가짜. gltfRoot 없는 좌석은 0(지금까지의 판정이 그대로 돈다) */
      /* rig 가 옮겨져(날아가기 · 끌기) 있으면 박스도 그만큼 옮겨지고, 기울어 있으면 그만큼 넓어진다 — 재는 순간의 자세를 읽는다 */
      deps.measureCharBox = (root) => { const rg = root && root.rig, off = rg ? rg.position.x : 0, ex = rg ? Math.abs(rg.rotation.z) : 0;
        return { isEmpty: () => !(root && root.bw > 0), min: { x: off - (root.bw || 0) - ex }, max: { x: off + (root.bw || 0) + ex } }; };
      for(const k of ['roomSeatMode', 'deskPanX', 'deskPanY', 'MULTIPLAYER_SPACING', 'SPACING', 'seatCameraMod']) deps[k] = () => V[k];
      deps.setDeskPanX = (v) => { V.deskPanX = v; }; deps.setDeskPanY = (v) => { V.deskPanY = v; };
      deps.setCachedRowCenter = (v) => { V._cachedRowCenter = v; }; deps.setCachedRowSpan = (v) => { V._cachedRowSpan = v; };
      const win = Object.assign({}, W);
      new Function('window', 'module', 'TwSeatPin', o.src || MOD)(win, undefined, W.TwSeatPin);
      const api = win.TwSeatLayout.createSeatLayout(deps);
      modApi = api;
      api[Object.keys(api).find(k => /^layoutSeat/.test(k))]();
    } else {
      const a = SRC.indexOf('function layoutSeats(){'), b = SRC.indexOf('\n}\n', a) + 3;
      const names = Object.keys(V);
      const f = new Function(...names, 'window', 'TwSeatPin', '__V', SRC.slice(a, b) + '\nlayoutSeats(); __V.deskPanX = deskPanX; __V.deskPanY = deskPanY; __V._cachedRowCenter = _cachedRowCenter; __V._cachedRowSpan = _cachedRowSpan;');
      f(...names.map(n => V[n]), W, W.TwSeatPin, V);
    }
    return { api: modApi, deskCalls: () => V._dc || 0, log, xs: seats.map(s => +(s.targetX || 0).toFixed(6)), pan: [V.deskPanX, V.deskPanY], cache: [+V._cachedRowCenter.toFixed(6), +V._cachedRowSpan.toFixed(6)] };
  }
  const J = (x) => JSON.stringify(x);
  /* 혼자 — 0번은 맨 오른쪽(0) · 폭은 하한 1.2 */
  let r = runLayout([{ isMe: true, hw: 0.5 }], {});
  chk(J(r.xs) === '[0]' && J(r.log) === J(['sync', 'pin:row', 'clamp', ['cam', 0, 1.2]]) && J(r.cache) === '[0,1.2]', '혼자 — 자리 0 · 폭 하한 1.2 · 순서: 평준화 → 고정 → 오프셋 검사 → 카메라');
  /* 셋 — 책상과 책상 사이 여백이 SPACING(0.4)
     ⚠️ 지금 동작 그대로 고정: seats.map(seatDeskHalfWidth) 가 인덱스를 forZoom 으로 넘겨 1번부터는 반폭에 줌 상한(1.1)이 걸린다
        (CONFIRM.md [버그] — 승인 전엔 바꾸지 않는다). 그래서 반폭 2 인 2번 자리는 -4.8 이 아니라 -3.9 */
  r = runLayout([{ isMe: true, hw: 1 }, { hw: 0.5 }, { hw: 2 }], {});
  chk(J(r.xs) === J([0, -1.9, -3.9]), '셋 — 왼쪽으로 «앞 반폭 + 여백 + 내 반폭» 만큼씩(0 · -1.9 · -3.9 — 1번부터 반폭 상한 1.1, 지금 동작)');
  chk(J(r.log[r.log.length - 1]) === J(['cam', -1.95, 6]) && J(r.cache) === J([-1.95, 6]), '  카메라 — 가운데 -1.95 · 폭 = 양 끝 거리 + 끝 책상 반폭(줌용 상한 1.1) · 캐시에도 같은 값');
  /* 친구가 있으면 좁은 간격 */
  r = runLayout([{ isMe: true, hw: 1 }, { remote: true, hw: 1 }], {});
  chk(J(r.xs) === J([0, -2.15]), '친구(remote)가 있으면 MULTIPLAYER_SPACING(0.15)');
  /* 올라탄 좌석은 자리 계산에서 빼고 탑 바닥 자리를 물려받는다 */
  const base = { isMe: true, hw: 1 }, top = { hw: 3 }, c = { hw: 1 };
  top.ridingOn = base;
  r = runLayout([base, top, c], {});
  chk(J(r.xs) === J([0, 0, -2.4]) && J(r.log[r.log.length - 1]) === J(['cam', -1.2, 4.4]), '★ 올라탄 좌석은 자리를 안 차지하고(옆 좌석이 붙는다) 바닥 좌석 자리를 물려받는다 · 카메라 폭에도 안 든다');
  const t2 = { hw: 1, ridingOn: top };
  r = runLayout([base, top, c, t2], {});
  chk(r.xs[3] === 0, '  2층(탑의 탑)도 맨 아래 바닥 자리');
  /* 맨 오른쪽 고정 — 나를 0번으로 옮기면 좌석 탭을 다시 그린다 */
  const me = { isMe: true, hw: 1 }, f1 = { remote: true, hw: 1 };
  const ss = [f1, me];
  r = runLayout(ss, { mode: 'right' });
  chk(ss[0] === me && r.log.includes('tabs') && J(r.xs) === J([0, -2.15]), '맨 오른쪽 고정 — 나를 0번으로 · 좌석 탭 다시 그림');
  r = runLayout([{ isMe: true, hw: 1 }], { mode: 'right' });
  chk(!r.log.includes('tabs'), '  이미 0번이면 탭을 안 그린다');
  /* 이동 오프셋은 매번 안전 범위로 당긴다 */
  r = runLayout([{ isMe: true, hw: 1 }], { panX: 5, panY: -5 });
  chk(J(r.pan) === J([0.2, -0.1]), '이동 오프셋은 clampDeskPan 결과로 다시 쓴다');
  /* 경계 — 책상 폭 0 · 빈 좌석 목록 */
  r = runLayout([{ isMe: true, hw: 0 }, { hw: 0 }], {});
  chk(J(r.xs) === J([0, -0.4]) && J(r.log[r.log.length - 1]) === J(['cam', -0.2, 1.2]), '경계 — 책상 폭 0 이면 여백만큼 · 폭 하한 1.2');
  /* 좌석 간격 최소값(seats.js GAP_MIN)은 음수 — 맨 왼쪽 칸에선 책상끼리 조금 겹치게 붙는다. 앱이 쓰는 값으로 그대로 돌린다 */
  {
    const m = /const GAP_MIN = (-?[\d.]+), GAP_MAX = ([\d.]+), GAP_STEPS = (\d+);/.exec(SEATS);
    const gmin = m ? +m[1] : NaN;
    chk(m && gmin < 0 && gmin > -0.85 && +m[2] > 0, '좌석 간격 최소값 — 음수(겹쳐 붙기)이되 기본 책상 반폭(0.85)보다 덜 겹친다 · 최대는 양수' + (m ? ' (' + m[1] + ' ~ ' + m[2] + ')' : ' — 못 찾음'));
    if(m){
      r = runLayout([{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }], { spacing: gmin });
      const step = 1.7 + gmin;
      chk(J(r.xs) === J([0, -step, -2 * step].map(v => +v.toFixed(6))) && step > 0, '  최소값으로 — 기본 책상 셋이 (1.7 + 최소값)씩 당겨져 붙는다 · 순서는 그대로');
      const body = (bw) => ({ bw });
      r = runLayout([{ isMe: true, hw: 0.85, desk: { userData: { noDesk: true } }, gltfRoot: body(0.25) }, { hw: 0.85, desk: { userData: { noDesk: true } }, gltfRoot: body(0.25) }], { spacing: gmin });
      chk(-r.xs[1] >= 0.5 - 1e-9, '  책상 없는 좌석끼리는 최소값에서도 몸(0.25 + 0.25)이 겹치지 않는다');
    }
  }
  /* 책상 끌기(slotIndexAt) — app.js 처럼 «번호 고르기 → splice → 줄 다시 잡기» 를 x 마다 세 번 돈다.
     (a) 같은 x 에서 다시 불러도 번호가 그대로(떨림 없음) (b) 왼쪽으로 갈수록 번호가 줄지 않음 (c) 끝까지 끌면 맨 끝 · 맨 오른쪽 */
  if(!process.env.TW_PREMOVE){
    const dragRun = (src, hws, dragAt, spacing) => {
      const ss = hws.map((hw, i) => Object.assign({ hw }, i === 0 ? { isMe: true } : {}));
      const drag = ss[dragAt];
      const rr = runLayout(ss, { spacing, src });
      const first = ss.filter(x => !x.ridingOn).reduce((m, x) => Math.min(m, x.targetX), 0);
      let shaky = 0, back = 0, prev = -1, end = -1, start = -1;
      for(let x = 0.5; x >= first - 3; x -= 0.05){
        const got = [];
        for(let t = 0; t < 3; t++){
          const idx = rr.api.slotIndexAt(x, drag), cur = ss.indexOf(drag);
          if(idx !== cur){ ss.splice(cur, 1); ss.splice(idx, 0, drag); rr.api.layoutSeatRow(); }
          got.push(ss.indexOf(drag));
        }
        if(got[1] !== got[2]) shaky++;
        if(got[2] < prev) back++;
        if(start < 0) start = got[2];
        prev = end = got[2];
      }
      return { shaky, back, start, end, n: ss.length };
    };
    const cases = [[[0.85, 0.4, 2], 1], [[0.85, 0.5, 1.2, 0.85], 1], [[0.85, 0.85, 1.5], 1], [[0.85, 0.4, 1.7], 2], [[0.85, 0.85, 0.85], 2]];
    let bad = [];
    for(const sp of [-0.3, 0.021, 0.3, 1.2]) for(const [hws, at] of cases){
      const o = dragRun(undefined, hws, at, sp);
      if(o.shaky || o.back || o.start !== 0 || o.end !== o.n - 1) bad.push(sp + ' ' + J(hws) + ' ' + J(o));
    }
    chk(!bad.length, '책상 끌기 — 폭이 섞인 줄 · 간격 -0.3 · 0.021 · 0.3 · 1.2: 같은 자리에서 다시 불러도 그대로 · 왼쪽으로 갈수록 뒤 칸 · 오른쪽 끝 0번 · 왼쪽 끝 마지막' + (bad.length ? ' — ' + bad.slice(0, 2).join(' | ') : ''));
    /* 끄는 동안(pointermove 마다)은 책상을 다시 재지 않는다 — 줄 배치가 잰 반폭을 다시 쓴다 */
    {
      const ss = [{ isMe: true, hw: 0.85 }, { hw: 0.4 }, { hw: 2 }, { hw: 1.2 }];
      const rr = runLayout(ss, { spacing: 0.3 });
      const before = rr.deskCalls();
      for(let x = 0; x > -8; x -= 0.5) rr.api.slotIndexAt(x, ss[1]);
      chk(rr.deskCalls() === before, '  끄는 동안 책상 폭을 다시 재지 않는다(줄 배치가 잰 반폭을 다시 씀)');
      const fresh = { hw: 0.85 }; ss.push(fresh);
      rr.api.slotIndexAt(-1, fresh);
      chk(rr.deskCalls() > before, '  아직 줄 배치에 없던 좌석은 그때 잰다');
    }
    /* 줄 배치는 할 때마다 반폭을 새로 잰다(기억은 끌기 · 가두기용) — 책상을 바꾸거나 평준화로 크기가 바뀐 뒤 옛 폭으로 자리를 잡지 않게 */
    const remeasure = (src) => {
      const ss = [{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }];
      const rr = runLayout(ss, { spacing: 0.3, src });
      ss[1].hw = 1.05; rr.api.layoutSeatRow();
      const xs = ss.map(x => +x.targetX.toFixed(6));
      return { xs, slot: rr.api.slotIndexAt(-4.6, ss[2]) };
    };
    {
      const o = remeasure();
      chk(J(o.xs) === J([0, -2.2, -4.4]) && o.slot === 2, '  책상 폭이 바뀐 뒤 줄 배치는 새 폭으로(0 · -2.2 · -4.4) · 끌기도 새 폭 기준 칸');
      const once = MOD.replace('_bodyHalfMemo.set(s, body); _halfMemo.set(s, measureRowHalf(s, body));', '_bodyHalfMemo.set(s, body); if(!_halfMemo.has(s)) _halfMemo.set(s, measureRowHalf(s, body));');
      const b = once !== MOD ? remeasure(once) : null;
      chk(!!b && J(b.xs) !== J(o.xs), '  깨 보기 — 한 번 잰 반폭을 다시 쓰면(새로 안 잼) 위 판정이 빨강');
    }
    /* 0번(맨 오른쪽) 좌석은 줌 상한 없이 실제 반폭 · 1번부터 상한 1.1(옛 map 그대로) */
    {
      const ss = [{ isMe: true, hw: 1.5 }, { hw: 1.5 }];
      const rr = runLayout(ss, { spacing: 0.3 });
      chk(J(rr.xs) === J([0, -2.9]), '  0번 큰 책상은 실제 반폭(1.5) · 1번은 상한(1.1) — 1.5 + 0.3 + 1.1');
      const cap0 = MOD.replace('  return v[i ? 1 : 0];', '  return v[1];');
      const rb = cap0 !== MOD ? runLayout([{ isMe: true, hw: 1.5 }, { hw: 1.5 }], { spacing: 0.3, src: cap0 }) : null;
      chk(!!rb && J(rb.xs) !== J([0, -2.9]), '  깨 보기 — 0번에도 상한을 걸면 빨강');
    }
    const ride = [{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }];
    ride[2].ridingOn = ride[1];
    const rr = runLayout(ride, {});
    chk(rr.api.slotIndexAt(-100, ride[3]) === 2 && rr.api.slotIndexAt(0.2, ride[3]) === 0, '  올라탄 좌석은 자리가 없어 건너뛴다(왼쪽 끝 = 남은 줄의 마지막)');
    const re = runLayout([{ isMe: true, hw: 0.85 }], {});
    chk(re.api.slotIndexAt(-3, null) === 0 && re.api.slotIndexAt(-3, { hw: 1 }) === 0, '  경계 — 끄는 좌석이 없거나 줄에 없으면 0');
    /* 깨 보기 — 옛 셈 둘: 지금 자리(targetX) 중 가장 가까운 것(폭이 섞이면 떨림) · 끈 거리 ÷ 간격(음수 간격에서 뒤집힘) */
    const nearest = MOD.replace(/function slotIndexAt\(x, dragSeat\)\{[\s\S]*?\n\}\n/, 'function slotIndexAt(x){ let b = 0, bd = Infinity; seats.forEach((s, i)=>{ if(s.ridingOn) return; const d = Math.abs((s.targetX || 0) - x); if(d < bd){ bd = d; b = i; } }); return b; }\n');
    let caught = nearest !== MOD && dragRun(nearest, [0.85, 0.4, 2], 1, 0.3).shaky > 0;
    chk(caught, '  깨 보기 — 지금 자리 중 가장 가까운 것으로 고르면 폭이 섞인 줄에서 떨린다');
    const divide = MOD.replace(/function slotIndexAt\(x, dragSeat\)\{[\s\S]*?\n\}\n/, 'function slotIndexAt(x){ return Math.max(0, Math.min(seats.length - 1, Math.round(-x / SPACING()))); }\n');
    caught = false;
    if(divide !== MOD){ const o = dragRun(divide, [0.85, 0.85, 0.85], 2, -0.3); caught = o.end !== o.n - 1 || o.back > 0; }
    chk(caught, '  깨 보기 — 끈 거리 ÷ 간격으로 되돌리면 음수 간격에서 빨강');
  }
  /* 🧍 책상이 없거나 작은 좌석 — 몸 반폭 + 여유(0.15)만큼 자리를 잡아 옆 책상과 안 겹친다(건의). 책상 있는 좌석끼리는 그대로 */
  {
    const body = (bw) => ({ bw });
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, { hw: 0.15, gltfRoot: body(0.3) }, { hw: 0.85, gltfRoot: body(0.3) }], {});
    chk(J(r.xs) === J([0, -1.7, -3.4]), '★ 책상 없음(반폭 0.15) — 몸 반폭 0.3 + 여유 0.15 = 0.45 만큼 자리(0 · -1.7 · -3.4 — 예전엔 0 · -1.4 · -2.8 로 옆 책상이 몸 위로)');
    const deskGap = -(r.xs[2] - r.xs[1]) - 0.85 - 0.45;
    chk(Math.abs(deskGap - 0.4) < 1e-9, '  간격 설정(0.4)은 그대로 — 자리 끝끼리 여백');
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, { hw: 0.85, gltfRoot: body(0.3) }], {});
    chk(J(r.xs) === J([0, -2.1]), '  책상 있는 좌석끼리는 지금과 같다(책상이 몸보다 넓다)');
    r = runLayout([{ isMe: true, hw: 0.2, gltfRoot: body(0.6) }], {});
    chk(J(r.log[r.log.length - 1]) === J(['cam', 0, 1.5]), '  카메라 폭에도 몸 자리가 든다(0.75 × 2)');
    r = runLayout([{ isMe: true, hw: 0.85 }, { hw: 0.15, gltfRoot: body(0) }], {});
    chk(J(r.xs) === J([0, -1.4]), '  경계 — 몸을 못 재면(빈 박스) 책상 폭만(예전 그대로)');
    /* 🚀 날아가는 · 끌리는 좌석(B-1104-9) — rig 가 옮겨지고 돌아 있어도 앉은 자세 폭으로 잰다 · 잰 뒤 자세는 그대로 */
    const flying = () => { const rg = { position: { x: 6, y: 2 }, rotation: { z: 2.5 }, n: 0, updateMatrixWorld(){ this.n++; } }; const g = body(0.3); g.rig = rg; return { hw: 0.15, gltfRoot: g, rig: rg }; };
    const fs1 = flying();
    const rest = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, { hw: 0.15, gltfRoot: body(0.3) }], {});
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, fs1], {});
    chk(J(r.xs) === J([0, -1.7]) && J(r.cache) === J(rest.cache) && J(rest.cache) === J([-0.85, 3]), '★ 날아가는 좌석도 앉은 자세 폭(0.45)으로 자리 · 카메라 폭 3 — 앉아 있을 때와 같다(예전엔 몸 폭이 날아간 거리만큼 커져 모두 작아졌다)');
    chk(fs1.rig.position.x === 6 && fs1.rig.rotation.z === 2.5 && fs1.rig.n === 2, '  잰 뒤 날아가는 자세는 그대로 되돌린다(행렬도 다시 맞춤)');
    const noRest = MOD.replace('const b = measureAtRest(s);', 'const b = measureCharBox(s.gltfRoot);');
    const rn = noRest !== MOD ? runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, flying()], { src: noRest }) : null;
    chk(!!rn && J(rn.cache) !== J(rest.cache), '  깨 보기 — 날아가는 자세 그대로 재면 위 판정이 빨강');
    const broken = MOD.replace('function seatRoomHalf(deskHalf, bodyHalf){ return Math.max(deskHalf, bodyHalf > 0 ? bodyHalf + BODY_ROOM : 0); }', 'function seatRoomHalf(deskHalf){ return deskHalf; }');
    const rb = broken !== MOD ? runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, { hw: 0.15, gltfRoot: body(0.3) }], { src: broken }) : null;
    chk(!!rb && J(rb.xs) !== J([0, -1.7]), '  깨 보기 — 몸 폭을 안 보면(책상 폭만) 위 판정이 빨강');
    /* 🚫 «책상 없음»(desk.userData.noDesk) — 잴 책상이 없어 seatDeskHalfWidth 가 기본 폭 0.85 를 내도 몸 자리만 쓴다 */
    const nd = (bw) => ({ hw: 0.85, gltfRoot: body(bw), desk: { userData: { noDesk: true } } });
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, nd(0.25), nd(0.25)], {});
    chk(J(r.xs) === J([0, -1.65, -2.85]), '★ 책상 없음 — 몸 0.25 + 여유 0.15 = 0.4 만큼(0 · -1.65 · -2.85 — 예전엔 기본 책상 폭 0.85 로 0 · -2.1 · -4.2)');
    chk(J(r.cache) === J([-1.425, 4.1]), '  카메라 폭도 몸 자리(0.85 + 2.85 + 0.4)');
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, nd(0)], {});
    chk(J(r.xs) === J([0, -2.1]), '  경계 — 몸을 아직 못 쟀으면 예전처럼 기본 폭(0.85)');
    r = runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, { hw: 0.85, gltfRoot: body(0.25), desk: { userData: {} } }], {});
    chk(J(r.xs) === J([0, -2.1]), '  표시가 없는 좌석(책상 있음)은 그대로');
    const brokenNd = MOD.replace('if(bodyHalf > 0 && s && s.desk && s.desk.userData && s.desk.userData.noDesk) return 0;', '');
    const rnd = brokenNd !== MOD ? runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, nd(0.25), nd(0.25)], { src: brokenNd }) : null;
    chk(!!rnd && J(rnd.xs) !== J([0, -1.65, -2.85]), '  깨 보기 — 책상 없음 표시를 안 보면 위 판정이 빨강');
    /* 좌석 반폭(seatHalfWidth) — 평준화 가두기가 받는 값. 줄 배치와 같은 규칙 · 마지막 배치에서 잰 몸 폭을 다시 쓴다 */
    if(!process.env.TW_PREMOVE){
      const seatsH = [{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, nd(0.25), { hw: 1.4, gltfRoot: body(0.3) }, { hw: 0.15, gltfRoot: body(0.5) }];
      r = runLayout(seatsH, {});
      const hs = seatsH.map(x => +r.api.seatHalfWidth(x).toFixed(6));
      chk(J(hs) === J([0.85, 0.4, 1.4, 0.65]), '좌석 반폭 — 책상 0.85 · 책상 없음 몸 0.25+0.15 · 큰 책상 1.4(줌 상한 안 걺) · 작은 책상 몸 0.5+0.15');
      seatsH[1].gltfRoot.bw = 0.9;
      chk(+r.api.seatHalfWidth(seatsH[1]).toFixed(6) === 0.4, '  마지막 줄 배치에서 잰 몸 폭을 쓴다(가두기마다 다시 재지 않는다)');
      const fresh = nd(0.2);
      chk(+r.api.seatHalfWidth(fresh).toFixed(6) === 0.35, '  아직 줄 배치에 없던 좌석은 지금 잰다');
      const bh = MOD.replace('  return seatRoomHalf(seatDeskHalf(s, false, body), body);', '  return seatDeskHalfWidth(s, false);');
      const rh = bh !== MOD ? runLayout([{ isMe: true, hw: 0.85, gltfRoot: body(0.3) }, nd(0.25)], { src: bh }) : null;
      chk(!!rh && +rh.api.seatHalfWidth(nd(0.25)).toFixed(6) !== 0.4, '  깨 보기 — 책상 폭만 보면(옛 가두기) 위 판정이 빨강');
    }
  }
  let threw = null; try{ r = runLayout([], {}); }catch(e){ threw = e; }
  chk(!threw && J(r.log[r.log.length - 1]) === J(['cam', null, null]) || (!threw && r.log.some(l => l[0] === 'cam')), '경계 — 좌석이 없어도 던지지 않는다(옮기기 전과 같은 값을 카메라에 넘긴다)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
