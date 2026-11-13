/* hit-map.js — 🗺️ 클릭 통과 히트 맵(순수 계산) — 좌석 조각의 경계 구를 화면 사각형(CSS px)으로
   왜: 통과 판정은 커서가 움직일 때마다 모든 좌석의 조각 전부에 광선을 쏜다. three r128 의 Mesh.raycast 는
     «geometry.boundingSphere × matrixWorld» 에 광선이 안 닿으면 그 조각을 바로 버린다. 그 구를 그린 직후에 화면으로
     투영해 두면 «사각형 밖 ⇒ 광선도 못 맞춤» 이 식으로 성립한다 — 사각형 안일 때만 그 조각에 광선을 쏘면 답이 같다.
   ★ 숫자만 받는다(THREE · DOM · 좌석을 모른다). 조각을 고르는 일은 room/seat-hit-targets.js.
   ★ 모르면 «전체»(늘 정밀) — 카메라가 구 안 · 원근이 아닌 투영 · 이상한 값. «모른다» 를 «멀다» 로 바꾸지 않는다.
   ★ main.js 도 나중에 require 한다(click-through-policy.js 와 같은 모양) — 설계 tw-docs design/app/hit-map.md
   검사: checks/sim-hit-map.js */
(function(){
'use strict';

const HIT_MAP_PAD_PX = 8;        // 사각형 여유 — 그리기 사이에 따로 updateMatrixWorld 한 몸 · 창 크기 변화
const HIT_MAP_STALE_MS = 250;    // 이보다 오래된 지도는 안 믿는다(모델 풀기로 장이 멈춤 등) → 전체 광선
const HALF_PI = Math.PI / 2;

const EMPTY = 0, RECT = 1, FULL = 2;

/* 한 축(u = x 또는 y)에서 «u / -z» 의 범위 — 시점 공간 원판(가운데 (u, z) · 반지름 r)을 지나는 광선 방향들.
   돌려주는 값: null(원판 전체가 카메라 뒤) 또는 [lo, hi](끝이 ±Infinity 일 수 있다) */
function ratioRange(u, z, r){
  const d2 = u * u + z * z;
  if(d2 <= r * r) return [-Infinity, Infinity];   // 원판이 카메라를 품음 — 이 축으로는 어디든
  const th = Math.atan2(u, -z), a = Math.asin(r / Math.sqrt(d2));
  const lo = th - a, hi = th + a;
  if(hi <= -HALF_PI || lo >= HALF_PI) return null;   // 앞쪽 반(-90°~90°)과 안 겹침 — 카메라 뒤
  return [lo <= -HALF_PI ? -Infinity : Math.tan(lo), hi >= HALF_PI ? Infinity : Math.tan(hi)];
}

function maxScale3(m){
  const sx = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
  const sy = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
  const sz = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
  return Math.sqrt(Math.max(sx, sy, sz));
}

/* 원근 투영인가 — three PerspectiveCamera(화면 밀기 setViewOffset 포함)의 모양. 아니면 «전체» */
function isPerspective(P){
  return P[1] === 0 && P[3] === 0 && P[4] === 0 && P[7] === 0 && P[11] === -1 && P[12] === 0 && P[13] === 0 && P[15] === 0
    && P[0] > 0 && P[5] > 0;
}

/* 구(월드 cx,cy,cz · 반지름 r) → 화면 사각형. V = camera.matrixWorldInverse.elements · P = projectionMatrix.elements
   vp = 캔버스 사각형 { left, top, width, height }(CSS px — 판정이 ndc 를 만드는 그 사각형). out 에 l t r b 를 쓴다.
   돌려주는 값: EMPTY(카메라 뒤 — 광선이 못 닿음) · RECT · FULL(모름 · 카메라가 구 안) */
function sphereRect(cx, cy, cz, r, V, P, vp, out){
  out.l = -Infinity; out.t = -Infinity; out.r = Infinity; out.b = Infinity;
  if(!(isFinite(cx) && isFinite(cy) && isFinite(cz) && r >= 0 && isFinite(r))) return FULL;
  if(!V || !P || !vp || !(vp.width > 0 && vp.height > 0) || !isPerspective(P)) return FULL;
  const x = V[0] * cx + V[4] * cy + V[8] * cz + V[12];
  const y = V[1] * cx + V[5] * cy + V[9] * cz + V[13];
  const z = V[2] * cx + V[6] * cy + V[10] * cz + V[14];
  const rv = r * maxScale3(V);
  if(!(isFinite(x) && isFinite(y) && isFinite(z) && isFinite(rv))) return FULL;
  if(x * x + y * y + z * z <= rv * rv) return FULL;   // 카메라가 구 안 — 모든 광선이 구에 닿는다
  const rx = ratioRange(x, z, rv), ry = ratioRange(y, z, rv);
  if(!rx || !ry) return EMPTY;
  /* ndc_x = P0·(x/-z) − P8 · ndc_y = P5·(y/-z) − P9 — 둘 다 비율에 대해 늘어나기만 한다 */
  const nx0 = P[0] * rx[0] - P[8], nx1 = P[0] * rx[1] - P[8];
  const ny0 = P[5] * ry[0] - P[9], ny1 = P[5] * ry[1] - P[9];
  out.l = vp.left + (nx0 + 1) / 2 * vp.width;
  out.r = vp.left + (nx1 + 1) / 2 * vp.width;
  out.t = vp.top + (1 - ny1) / 2 * vp.height;
  out.b = vp.top + (1 - ny0) / 2 * vp.height;
  if(isNaN(out.l) || isNaN(out.r) || isNaN(out.t) || isNaN(out.b)){ out.l = -Infinity; out.t = -Infinity; out.r = Infinity; out.b = Infinity; return FULL; }
  return RECT;
}

/* 지도 — 조각마다 { seat, kind('rig' 몸 · 'base' 그 밖), 사각형 } · 좌석마다 몸 / 그 밖 사각형의 합.
   그린 장마다 새로 채운다(무효화 없음). at = 만든 시각(ms) — -Infinity 면 «못 만듦»(늘 낡음) */
function createMap(){
  return { at: -Infinity, why: 'none', vp: null, n: 0, seat: [], kind: [], l: [], t: [], r: [], b: [], seats: [], full: 0 };
}
function reset(map, at, why, vp){
  map.at = at; map.why = why || ''; map.vp = vp || null; map.n = 0; map.full = 0;
  map.seat.length = 0; map.kind.length = 0; map.l.length = 0; map.t.length = 0; map.r.length = 0; map.b.length = 0;
  map.seats.length = 0;
  return map;
}
function unite(map, seat, kind, l, t, r, b){
  const s = map.seats[seat] || (map.seats[seat] = { rig: null, base: null });
  const u = s[kind];
  if(!u){ s[kind] = { l, t, r, b }; return; }
  if(l < u.l) u.l = l; if(t < u.t) u.t = t; if(r > u.r) u.r = r; if(b > u.b) u.b = b;
}
function push(map, seat, kind, rc){
  const i = map.n++;
  map.seat[i] = seat; map.kind[i] = kind; map.l[i] = rc.l; map.t[i] = rc.t; map.r[i] = rc.r; map.b[i] = rc.b;
  unite(map, seat, kind, rc.l, rc.t, rc.r, rc.b);
  return i;
}
const _rc = { l: 0, t: 0, r: 0, b: 0 };
/* 구 하나를 지도에 — 넣었으면 조각 번호, 카메라 뒤라 안 넣었으면 -1 */
function addSphere(map, seat, kind, cx, cy, cz, r, V, P, vp){
  const code = sphereRect(cx, cy, cz, r, V, P, vp, _rc);
  if(code === EMPTY) return -1;
  if(code === FULL) map.full++;
  return push(map, seat, kind, _rc);
}
/* 모르는 조각 — 화면 어디서든 후보(늘 정밀) */
function addFull(map, seat, kind){
  _rc.l = -Infinity; _rc.t = -Infinity; _rc.r = Infinity; _rc.b = Infinity;
  map.full++;
  return push(map, seat, kind, _rc);
}

const inRect = (x, y, l, t, r, b, pad) => x >= l - pad && x <= r + pad && y >= t - pad && y <= b + pad;

/* (x, y) 를 덮는 조각 번호들 — out 배열을 비우고 채워 돌려준다(부를 때마다 새 배열을 안 만든다) */
function candidates(map, x, y, pad, out){
  out = out || [];
  out.length = 0;
  if(!map || !(x === x) || !(y === y)) return out;
  const p = pad >= 0 ? pad : 0;
  for(let i = 0; i < map.n; i++) if(inRect(x, y, map.l[i], map.t[i], map.r[i], map.b[i], p)) out.push(i);
  return out;
}
/* (x, y) 를 덮는 좌석 번호(몸 또는 그 밖 사각형) — 없으면 -1. main 이 «근처» 를 볼 때 쓸 자리 */
function pointIn(map, x, y, pad){
  if(!map || !(x === x) || !(y === y)) return -1;
  const p = pad >= 0 ? pad : 0;
  for(let s = 0; s < map.seats.length; s++){
    const q = map.seats[s];
    if(!q) continue;
    for(const u of [q.rig, q.base]) if(u && inRect(x, y, u.l, u.t, u.r, u.b, p)) return s;
  }
  return -1;
}
/* 믿을 만한가 — 만든 지 HIT_MAP_STALE_MS 안(경계 포함) */
function fresh(map, now){
  if(!map || !isFinite(map.at)) return false;
  const age = now - map.at;
  return age >= 0 && age <= HIT_MAP_STALE_MS;
}
/* 이번 장에 지도를 비울 까닭 — 회사원 모드 숨김(3D 판정 자체가 꺼짐) · 실행 화면 아님(판정이 3D 까지 안 감). 만들 장이면 null */
function skipWhy(s){
  if(s && s.officeHidden) return 'office';
  if(!(s && s.runmode)) return 'notRun';
  return null;
}

const api = {
  HIT_MAP_PAD_PX, HIT_MAP_STALE_MS, EMPTY, RECT, FULL,
  sphereRect, createMap, reset, addSphere, addFull, candidates, pointIn, fresh, skipWhy,
};
if(typeof window !== 'undefined') window.TwHitMap = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
