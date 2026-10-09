/* ═══ 🪣 메쉬 채우기 — 클릭한 메쉬의 UV 삼각형만 그림판에 칠한다 ═══════════════════════════════════
   꾸미기 ✎ 그리기의 «채우기». 그림판(512 캔버스) 전체를 칠하면 같은 텍스처를 나눠 쓰는 다른 메쉬와 빈 칸까지
   덮인다(동물 생성기 G 가 얼굴 · 몸을 같이 칠하는 이유). 여기서는 그 메쉬의 UV 삼각형을 그대로 그려서
   **그 메쉬가 쓰는 자리만** 칠한다.
   좌표 규약은 붓과 같다 — 캔버스 좌표 = uv × 크기(app.js _wdPicPaint 의 hit.uv.x*CANVAS_SZ).
   THREE 를 안 본다(geometry 의 attributes · index 만 읽는다) — node 에서 검사한다(sim-uv-fill.js).
   생성기(사람 · 동물)의 페인트통은 메쉬 하나가 얼굴 · 뒤통수 · 손을 같이 갖고 있어서 메쉬 전체가 아니라
   **누른 조각(UV 섬)** 만 칠한다 — fillIsland(sim-paint-tools.js). 꾸미기는 파츠 하나가 곧 칠할 자리라 fillMesh 그대로. */
(function(){
'use strict';

/* 삼각형 가장자리를 이만큼(픽셀) 넓혀 칠한다 — 정확히 삼각형만 칠하면 텍스처 필터링이 경계 바깥 픽셀을 섞어
   UV 솔기에 가는 실선이 남는다. */
const FILL_PAD_PX = 1.5;

/* geometry → 캔버스 좌표 삼각형 목록 [[x0,y0,x1,y1,x2,y2], …]. UV 가 없으면 빈 목록. */
function uvTriangles(geometry, size){
  const g = geometry, a = g && g.attributes, uv = a && a.uv;
  if(!uv || !uv.count) return [];
  const idx = g.index;
  const n = idx ? idx.count : uv.count;
  const get = (i)=>idx ? idx.getX(i) : i;
  const out = [];
  for(let t = 0; t + 2 < n; t += 3){
    const i0 = get(t), i1 = get(t + 1), i2 = get(t + 2);
    const tri = [uv.getX(i0) * size, uv.getY(i0) * size, uv.getX(i1) * size, uv.getY(i1) * size, uv.getX(i2) * size, uv.getY(i2) * size];
    if(tri.every(v=>isFinite(v))) out.push(tri);
  }
  return out;
}

/* ctx(2D) 에 geometry 의 UV 자리를 칠한다. erase 면 그 자리를 지운다. 칠한 삼각형 수를 돌려준다. */
function fillMesh(ctx, geometry, size, opts){
  return fillTriangles(ctx, uvTriangles(geometry, size), opts);
}

/* 캔버스 좌표 삼각형 목록을 한 경로로 칠한다(fillMesh · fillIsland 공용). */
function fillTriangles(ctx, tris, opts){
  const o = opts || {};
  if(!tris || !tris.length) return 0;
  ctx.save();
  ctx.globalCompositeOperation = o.erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = o.color || '#000000';
  ctx.strokeStyle = o.color || '#000000';
  ctx.lineJoin = 'round';
  /* 지울 때는 1px 더 넓게 — 칠할 때 경계가 안티앨리어싱으로 반쯤 번진 픽셀이 같은 폭으로는 덜 지워져 테두리가 남는다 */
  ctx.lineWidth = ((o.pad != null ? o.pad : FILL_PAD_PX) + (o.erase ? 1 : 0)) * 2;
  ctx.beginPath();
  tris.forEach(t=>{ ctx.moveTo(t[0], t[1]); ctx.lineTo(t[2], t[3]); ctx.lineTo(t[4], t[5]); ctx.closePath(); });
  ctx.fill();
  if(ctx.lineWidth > 0) ctx.stroke();
  ctx.restore();
  return tris.length;
}

/* ── UV 섬 ──
   섬 = 정점을 나눠 쓰거나 **UV 좌표가 같은 정점**으로 이어진 삼각형 묶음. Blender 는 날카로운 모서리에서도
   정점을 쪼개서(UV 는 같다) 인덱스만 보면 한 조각이 여러 섬으로 갈린다 — 그래서 UV 좌표가 같으면 잇는다.
   다른 섬이 같은 UV 를 겹쳐 쓰는 경우(좌우 손)는 어차피 같은 픽셀이라 한 섬으로 묶여도 결과가 같다.
   geometry 마다 한 번만 센다(WeakMap). 생성기 메쉬는 1천 삼각형 안팎이라 처음 한 번도 1ms 아래다. */
const UV_KEY_Q = 1e5;   // UV 좌표를 이만큼 곱해 반올림한 값이 같으면 같은 점으로 본다
const _islandCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
function _triCount(g){
  const uv = g && g.attributes && g.attributes.uv; if(!uv || !uv.count) return 0;
  return Math.floor((g.index ? g.index.count : uv.count) / 3);
}
function _vIdx(g, i){ return g.index ? g.index.getX(i) : i; }
/* 삼각형 번호 → 섬 번호(Int32Array). UV 가 없으면 null. */
function islandIds(geometry){
  const g = geometry, n = _triCount(g);
  if(!n) return null;
  if(_islandCache && _islandCache.has(g)) return _islandCache.get(g);
  const uv = g.attributes.uv, vc = uv.count;
  const par = new Int32Array(vc); for(let i = 0; i < vc; i++) par[i] = i;
  const find = (x)=>{ while(par[x] !== x){ par[x] = par[par[x]]; x = par[x]; } return x; };
  const join = (a, b)=>{ a = find(a); b = find(b); if(a !== b) par[b] = a; };
  const seen = new Map();
  for(let i = 0; i < vc; i++){
    const u = uv.getX(i), v = uv.getY(i); if(!isFinite(u) || !isFinite(v)) continue;
    const k = Math.round(u * UV_KEY_Q) + ',' + Math.round(v * UV_KEY_Q);
    if(seen.has(k)) join(seen.get(k), i); else seen.set(k, i);
  }
  for(let t = 0; t < n; t++){ const a = _vIdx(g, t * 3); join(a, _vIdx(g, t * 3 + 1)); join(a, _vIdx(g, t * 3 + 2)); }
  const out = new Int32Array(n);
  for(let t = 0; t < n; t++) out[t] = find(_vIdx(g, t * 3));
  if(_islandCache) _islandCache.set(g, out);
  return out;
}
/* UV 점(0~1)을 품은 삼각형 번호 — 광선이 삼각형 번호를 안 줄 때(대칭 되쏘기는 UV 만 돌려준다) 쓴다. 없으면 -1. */
function triangleAtUv(geometry, u, v){
  const g = geometry, n = _triCount(g); if(!n || !isFinite(u) || !isFinite(v)) return -1;
  const uv = g.attributes.uv, E = 1e-6;
  for(let t = 0; t < n; t++){
    const i0 = _vIdx(g, t * 3), i1 = _vIdx(g, t * 3 + 1), i2 = _vIdx(g, t * 3 + 2);
    const ax = uv.getX(i0), ay = uv.getY(i0), bx = uv.getX(i1), by = uv.getY(i1), cx = uv.getX(i2), cy = uv.getY(i2);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if(!(Math.abs(d) > 1e-12)) continue;   // 넓이 0 · 망가진 삼각형
    const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / d;
    const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / d;
    if(l1 >= -E && l2 >= -E && 1 - l1 - l2 >= -E) return t;
  }
  return -1;
}
/* 누른 삼각형(faceIndex — 없으면 uv 로 찾는다)이 든 섬의 캔버스 좌표 삼각형 목록.
   섬 전체 넓이가 0 이면(사람 몸 · 손처럼 UV 가 한 점에 접힌 조각 — 칠할 그림이 없다) 빈 목록. */
function islandTriangles(geometry, size, faceIndex, uv){
  const ids = islandIds(geometry); if(!ids) return [];
  let f = (typeof faceIndex === 'number' && faceIndex >= 0 && faceIndex < ids.length) ? (faceIndex | 0) : -1;
  if(f < 0 && uv) f = triangleAtUv(geometry, uv.x, uv.y);
  if(f < 0) return [];
  const id = ids[f], g = geometry, a = g.attributes.uv, out = [];
  let area = 0;
  for(let t = 0; t < ids.length; t++){
    if(ids[t] !== id) continue;
    const i0 = _vIdx(g, t * 3), i1 = _vIdx(g, t * 3 + 1), i2 = _vIdx(g, t * 3 + 2);
    const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
    if(!tri.every(v=>isFinite(v))) continue;
    area += Math.abs((tri[2] - tri[0]) * (tri[5] - tri[1]) - (tri[4] - tri[0]) * (tri[3] - tri[1])) / 2;
    out.push(tri);
  }
  return area > 0.5 ? out : [];   // 반 픽셀도 안 되면 칠할 자리가 없는 조각
}
/* 누른 섬만 칠한다(지운다). 칠한 삼각형 수를 돌려준다 — 0 이면 아무것도 안 했다. */
function fillIsland(ctx, geometry, size, faceIndex, uv, opts){
  return fillTriangles(ctx, islandTriangles(geometry, size, faceIndex, uv), opts);
}

const api = { FILL_PAD_PX, uvTriangles, fillMesh, fillTriangles, islandIds, triangleAtUv, islandTriangles, fillIsland };
if(typeof window !== 'undefined') window.UvFill = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
