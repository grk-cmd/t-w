/* ═══ 🪑 sim-seat-layout.js — 🪑 좌석 줄 배치 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 layoutSeats 본문 을 parts/room/seat-layout.js 로 옮겼다(글자 그대로 · 바뀐 줄 5 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 좌석 · 책상 폭으로 자리 · 카메라 값).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(layoutSeatRow)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 16줄 그대로 · 부르는 곳은 seatLayoutMod.이름 · html(app.js 앞)
   ・4절: 동작 — 가짜 좌석 자리(left · right)로 줄 자리 · 카메라 값 · 간격 종류 · 끌기(겉면 재기 자체는 sim-seat-extent.js)
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
const MOD = ["seat-layout.js","parts/room/seat-layout.js","app/parts/room/seat-layout.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-layout.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_rideBottom","clampDeskPan","renderSeatTabs","seatExtent","syncSeatEqualize"];
const VAL_DEPS = ["ZOOM_HALF_CAP","seats"];
const GET_DEPS = ["MULTIPLAYER_SPACING","SPACING","deskPanX","deskPanY","roomSeatMode","seatCameraMod"];
const SET_DEPS = ["deskPanX","deskPanY"];
const EXPORTS = ["layoutSeatRow","seatHalfWidth","slotIndexAt","usesRoomGap"];
const MOVED = ["layoutSeatRow"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING,","  SPACING: ()=>SPACING,","  _rideBottom: (...a)=>_rideBottom(...a),","  clampDeskPan: (...a)=>clampDeskPan(...a),","  deskPanX: ()=>deskPanX,","  deskPanY: ()=>deskPanY,","  renderSeatTabs: (...a)=>renderSeatTabs(...a),","  roomSeatMode: ()=>roomSeatMode,","  seatCameraMod: ()=>seatCameraMod,","  seatExtent: (...a)=>seatExtent(...a),","  ZOOM_HALF_CAP: DESK_HALFWIDTH_CAP_FOR_ZOOM,","  seats: seats,","  syncSeatEqualize: (...a)=>syncSeatEqualize(...a),","  setCachedRowCenter: (v)=>{ _cachedRowCenter = v; },","  setCachedRowSpan: (v)=>{ _cachedRowSpan = v; },","  setDeskPanX: (v)=>{ deskPanX = v; },","  setDeskPanY: (v)=>{ deskPanY = v; },"];

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
/* ── 4. 동작 — 가짜 좌석 자리(left · right — 겉면 재기는 sim-seat-extent.js)로 줄 자리(targetX) · 카메라에 넘기는 줄 가운데 · 폭을 본다 */
say('── 4. 동작 — 좌석 줄 자리 · 간격 · 올라탄 좌석 · 카메라 값');
{
  const CAP = 1.1;
  function runLayout(seats, o){
    const log = [];
    const V = {
      seats, roomSeatMode: o.mode || 'row', deskPanX: o.panX || 0, deskPanY: o.panY || 0, MULTIPLAYER_SPACING: 0.15, SPACING: o.spacing !== undefined ? o.spacing : 0.4,
      _cachedRowCenter: 0, _cachedRowSpan: 1.2, _dc: 0,
      syncSeatEqualize: () => log.push('sync'),
      renderSeatTabs: () => log.push('tabs'),
      clampDeskPan: (x, y) => { log.push('clamp'); return { x: Math.max(-0.2, Math.min(0.2, x)), y: Math.max(-0.1, Math.min(0.1, y)) }; },
      seatExtent: (s) => { V._dc++; return { left: s.L !== undefined ? s.L : s.hw, right: s.R !== undefined ? s.R : s.hw }; },
      _rideBottom: (s) => { let b = s; while(b.ridingOn) b = b.ridingOn; return b; },
      seatCameraMod: { applyCameraAndCanvas: (c, w) => log.push(['cam', +c.toFixed(6), +w.toFixed(6)]) },
    };
    const W = { TwSeatPin: { pinFirst: (ss, mode) => { log.push('pin:' + mode); if(mode !== 'right') return false; const i = ss.findIndex(s => s.isMe); if(i <= 0) return false; const [m] = ss.splice(i, 1); ss.unshift(m); return true; } } };
    const deps = { seats: V.seats, ZOOM_HALF_CAP: CAP };
    for(const k of ['syncSeatEqualize', 'renderSeatTabs', 'clampDeskPan', 'seatExtent', '_rideBottom']) deps[k] = V[k];
    for(const k of ['roomSeatMode', 'deskPanX', 'deskPanY', 'MULTIPLAYER_SPACING', 'SPACING', 'seatCameraMod']) deps[k] = () => V[k];
    deps.setDeskPanX = (v) => { V.deskPanX = v; }; deps.setDeskPanY = (v) => { V.deskPanY = v; };
    deps.setCachedRowCenter = (v) => { V._cachedRowCenter = v; }; deps.setCachedRowSpan = (v) => { V._cachedRowSpan = v; };
    const win = Object.assign({}, W);
    new Function('window', 'module', 'TwSeatPin', o.src || MOD)(win, undefined, W.TwSeatPin);
    const api = win.TwSeatLayout.createSeatLayout(deps);
    api.layoutSeatRow();
    return { api, deskCalls: () => V._dc, log, xs: seats.map(s => +(s.targetX || 0).toFixed(6)), pan: [V.deskPanX, V.deskPanY], cache: [+V._cachedRowCenter.toFixed(6), +V._cachedRowSpan.toFixed(6)] };
  }
  const J = (x) => JSON.stringify(x);
  /* 혼자 — 0번은 맨 오른쪽(0) · 폭은 하한 1.2 */
  let r = runLayout([{ isMe: true, hw: 0.5 }], {});
  chk(J(r.xs) === '[0]' && J(r.log) === J(['sync', 'pin:row', 'clamp', ['cam', 0, 1.2]]) && J(r.cache) === '[0,1.2]', '혼자 — 자리 0 · 폭 하한 1.2 · 순서: 평준화 → 고정 → 오프셋 검사 → 카메라');
  /* 셋 — 이웃 겉면 사이가 SPACING(0.4). 큰 자리(2)도 그대로 — 줌 상한은 카메라에만 */
  r = runLayout([{ isMe: true, hw: 1 }, { hw: 0.5 }, { hw: 2 }], {});
  chk(J(r.xs) === J([0, -1.9, -4.8]), '셋 — 왼쪽으로 «앞 왼쪽 끝 + 간격 + 내 오른쪽 끝» 만큼씩(0 · -1.9 · -4.8 — 큰 자리도 상한 없이)');
  chk(J(r.log[r.log.length - 1]) === J(['cam', -2.4, 6.9]) && J(r.cache) === J([-2.4, 6.9]), '  카메라 — 가운데 -2.4 · 폭 = 양 끝 거리 + 끝 좌석 겉면(줌용 상한 1.1) · 캐시에도 같은 값');
  /* 왼쪽 · 오른쪽이 다른 좌석(치우친 책상) */
  r = runLayout([{ isMe: true, L: 0.5, R: 2 }, { L: 1, R: 0.3 }], { spacing: 0.3 });
  chk(J(r.xs) === J([0, -1.1]), '치우친 자리 — 앞 좌석 왼쪽 끝(0.5) + 간격(0.3) + 내 오른쪽 끝(0.3) = 1.1');
  const sym = MOD.replace('const tx = first ? 0 : prevX - (prevL + spacing + e.right);', 'const tx = first ? 0 : prevX - (Math.max(prevL, e.left) + spacing + Math.max(e.left, e.right));');
  const rs = sym !== MOD ? runLayout([{ isMe: true, L: 0.5, R: 2 }, { L: 1, R: 0.3 }], { spacing: 0.3, src: sym }) : null;
  chk(!!rs && J(rs.xs) !== J([0, -1.1]), '  깨 보기 — 좌우를 같은 폭으로 보면 빨강');
  /* 간격 0 = 겉면이 맞닿는다 */
  r = runLayout([{ isMe: true, hw: 0.85 }, { hw: 0.2 }, { hw: 0.85 }], { spacing: 0 });
  chk(J(r.xs) === J([0, -1.05, -2.1]), '간격 0 — 이웃 겉면이 맞닿는다(0 · -1.05 · -2.1) · 덧댄 여유 없음');
  /* 좌석 간격 막대 범위(app.js) — 0 부터(겉면끼리 맞닿음) · 덧댄 음수 하한 없음 */
  {
    const m = /const GAP_MIN = (-?[\d.]+), GAP_MAX = ([\d.]+), GAP_STEPS = (\d+);/.exec(SRC);
    chk(m && +m[1] === 0 && +m[2] > 0, '좌석 간격 막대 — 최소 0(맞닿음) · 최대 양수' + (m ? ' (' + m[1] + ' ~ ' + m[2] + ')' : ' — 못 찾음'));
  }
  /* 간격 종류 — 친구 좌석이 있으면 방용(설정 막대 · 평준화 가두기가 같은 함수를 부른다 · #749) */
  r = runLayout([{ isMe: true, hw: 1 }, { remote: true, hw: 1 }], {});
  chk(J(r.xs) === J([0, -2.15]) && r.api.usesRoomGap() === true, '친구(remote)가 있으면 MULTIPLAYER_SPACING(0.15) · usesRoomGap 참');
  r = runLayout([{ isMe: true, hw: 1 }, { hw: 1 }], {});
  chk(J(r.xs) === J([0, -2.4]) && r.api.usesRoomGap() === false, '  친구 좌석이 없으면 SPACING(0.4) · usesRoomGap 거짓');
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
  /* 경계 — 자리 0 */
  r = runLayout([{ isMe: true, hw: 0 }, { hw: 0 }], {});
  chk(J(r.xs) === J([0, -0.4]) && J(r.log[r.log.length - 1]) === J(['cam', -0.2, 1.2]), '경계 — 자리 0 이면 간격만큼 · 폭 하한 1.2');
  /* 좌석 반폭(seatHalfWidth) — 평준화 가두기가 받는 값. 더 뻗은 쪽 */
  chk(r.api.seatHalfWidth({ L: 0.5, R: 2 }) === 2 && r.api.seatHalfWidth({ hw: 0.7 }) === 0.7, '좌석 반폭 — 왼쪽 · 오른쪽 중 더 뻗은 쪽(가두기는 좌우 같은 폭)');
  /* 책상 끌기(slotIndexAt) — app.js 처럼 «번호 고르기 → splice → 줄 다시 잡기» 를 x 마다 세 번 돈다.
     (a) 같은 x 에서 다시 불러도 번호가 그대로(떨림 없음) (b) 왼쪽으로 갈수록 번호가 줄지 않음 (c) 끝까지 끌면 맨 끝 · 맨 오른쪽 */
  {
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
    for(const sp of [0, 0.021, 0.3, 1.2]) for(const [hws, at] of cases){
      const o = dragRun(undefined, hws, at, sp);
      if(o.shaky || o.back || o.start !== 0 || o.end !== o.n - 1) bad.push(sp + ' ' + J(hws) + ' ' + J(o));
    }
    chk(!bad.length, '책상 끌기 — 폭이 섞인 줄 · 간격 0 · 0.021 · 0.3 · 1.2: 같은 자리에서 다시 불러도 그대로 · 왼쪽으로 갈수록 뒤 칸 · 오른쪽 끝 0번 · 왼쪽 끝 마지막' + (bad.length ? ' — ' + bad.slice(0, 2).join(' | ') : ''));
    /* 끄는 동안(pointermove 마다)은 자리를 다시 받지 않는다 — 줄 배치가 받은 자리를 다시 쓴다 */
    {
      const ss = [{ isMe: true, hw: 0.85 }, { hw: 0.4 }, { hw: 2 }, { hw: 1.2 }];
      const rr = runLayout(ss, { spacing: 0.3 });
      const before = rr.deskCalls();
      for(let x = 0; x > -8; x -= 0.5) rr.api.slotIndexAt(x, ss[1]);
      chk(rr.deskCalls() === before, '  끄는 동안 자리를 다시 받지 않는다(줄 배치가 받은 자리를 다시 씀)');
      const fresh = { hw: 0.85 }; ss.push(fresh);
      rr.api.slotIndexAt(-1, fresh);
      chk(rr.deskCalls() > before, '  아직 줄 배치에 없던 좌석은 그때 받는다');
    }
    /* 줄 배치는 할 때마다 자리를 새로 받는다 — 책상을 바꾸거나 평준화로 크기가 바뀐 뒤 옛 폭으로 자리를 잡지 않게 */
    const remeasure = (src) => {
      const ss = [{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }];
      const rr = runLayout(ss, { spacing: 0.3, src });
      ss[1].hw = 1.05; rr.api.layoutSeatRow();
      return { xs: ss.map(x => +x.targetX.toFixed(6)), slot: rr.api.slotIndexAt(-4.6, ss[2]) };
    };
    {
      const o = remeasure();
      chk(J(o.xs) === J([0, -2.2, -4.4]) && o.slot === 2, '  자리가 바뀐 뒤 줄 배치는 새 폭으로(0 · -2.2 · -4.4) · 끌기도 새 폭 기준 칸');
      const once = MOD.replace('seats.forEach(s=>{ if(!s.ridingOn) _extMemo.set(s, seatExtent(s)); });', 'seats.forEach(s=>{ if(!s.ridingOn && !_extMemo.has(s)) _extMemo.set(s, seatExtent(s)); });');
      const b = once !== MOD ? remeasure(once) : null;
      chk(!!b && J(b.xs) !== J(o.xs), '  깨 보기 — 한 번 받은 자리를 다시 쓰면(새로 안 받음) 위 판정이 빨강');
    }
    const ride = [{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }];
    ride[2].ridingOn = ride[1];
    const rr = runLayout(ride, {});
    chk(rr.api.slotIndexAt(-100, ride[3]) === 2 && rr.api.slotIndexAt(0.2, ride[3]) === 0, '  올라탄 좌석은 자리가 없어 건너뛴다(왼쪽 끝 = 남은 줄의 마지막)');
    const re = runLayout([{ isMe: true, hw: 0.85 }], {});
    chk(re.api.slotIndexAt(-3, null) === 0 && re.api.slotIndexAt(-3, { hw: 1 }) === 0, '  경계 — 끄는 좌석이 없거나 줄에 없으면 0');
    /* 깨 보기 — 옛 셈 둘: 지금 자리(targetX) 중 가장 가까운 것(폭이 섞이면 떨림) · 끈 거리 ÷ 간격 */
    const nearest = MOD.replace(/function slotIndexAt\(x, dragSeat\)\{[\s\S]*?\n\}\n/, 'function slotIndexAt(x){ let b = 0, bd = Infinity; seats.forEach((s, i)=>{ if(s.ridingOn) return; const d = Math.abs((s.targetX || 0) - x); if(d < bd){ bd = d; b = i; } }); return b; }\n');
    chk(nearest !== MOD && dragRun(nearest, [0.85, 0.4, 2], 1, 0.3).shaky > 0, '  깨 보기 — 지금 자리 중 가장 가까운 것으로 고르면 폭이 섞인 줄에서 떨린다');
    const divide = MOD.replace(/function slotIndexAt\(x, dragSeat\)\{[\s\S]*?\n\}\n/, 'function slotIndexAt(x){ return Math.max(0, Math.min(seats.length - 1, Math.round(-x / Math.max(SPACING(), 1e-6)))); }\n');
    /* 칸 자리에 놓으면 그 칸 — 기본 셋(간격 0.3)의 1번 자리는 -2.0 */
    const atSlot = (src) => { const ss = [{ isMe: true, hw: 0.85 }, { hw: 0.85 }, { hw: 0.85 }]; const q = runLayout(ss, { spacing: 0.3, src }); return [q.api.slotIndexAt(0, ss[2]), q.api.slotIndexAt(-2.0, ss[2]), q.api.slotIndexAt(-4.0, ss[2])]; };
    chk(J(atSlot()) === J([0, 1, 2]), '  칸 자리(0 · -2.0 · -4.0)에 놓으면 그 칸(0 · 1 · 2)');
    chk(divide !== MOD && J(atSlot(divide)) !== J([0, 1, 2]), '  깨 보기 — 끈 거리 ÷ 간격으로 되돌리면 빨강');
  }
  let threw = null; try{ r = runLayout([], {}); }catch(e){ threw = e; }
  chk(!threw && r.log.some(l => l[0] === 'cam'), '경계 — 좌석이 없어도 던지지 않는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
