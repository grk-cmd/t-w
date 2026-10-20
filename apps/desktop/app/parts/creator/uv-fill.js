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
/* ── 여백 몫(owner map) — 채운 조각 둘레 실선 막기 ──
   [왜] 조각 삼각형만 딱 맞게 칠하면 경계 바깥 텍셀이 옛 색으로 남는다. 텍스처는 쌍선형 필터와 밉맵(멀리서 볼 때
     2×2 · 4×4 · 8×8 … 를 평균낸 축소판)으로 읽혀서 그 옛 색이 섞여 **조각 둘레에 가는 실선**이 보였다(제보 두 번).
     몇 텍셀만 넓혀서는 밉맵 3단계쯤에서 다시 1텍셀 아래가 된다 — 원본 텍스처들이 조각 사이 여백을 통째로 채워 두는 이유다.
   [방법] 같은 그림판을 쓰는 **모든 조각**(같은 메쉬의 섬들 + 같은 캔버스를 쓰는 다른 메쉬)을 텍셀 중심으로 래스터화하고,
     빈 텍셀은 가장 가까운 조각의 몫으로 정한다(모든 조각에서 동시에 8방향으로 넓히는 BFS — 보로노이와 같다).
     조각을 채우면 그 조각의 텍셀 + 몫 텍셀 전부를 칠한다 → 여백은 이웃 조각과의 가운데 선까지 같은 색이 되고,
     이웃 조각 안쪽은 한 칸도 안 건드린다. 지우기(Shift)도 같은 자리를 투명하게.
   표는 (geometry 묶음 · 크기)마다 한 번만 만들고 기억한다(512² · Int16 = 0.5MB · 최근 몇 개만). geometry 의 UV 는 안 바뀐다. */
let _geoSeq = 0;
const _geoId = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
const gid = (g)=>{ if(!_geoId) return 0; let v = _geoId.get(g); if(!v){ v = ++_geoSeq; _geoId.set(g, v); } return v; };
const LAYOUT_CACHE_MAX = 6;
const _layouts = new Map();
function _raster(tris, size, lab, val){
  let hit = 0;
  for(const t of tris){
    const x0 = t[0], y0 = t[1], x1 = t[2], y1 = t[3], x2 = t[4], y2 = t[5];
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if(!(Math.abs(d) > 1e-9)) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
    for(let y = minY; y <= maxY; y++){
      const py = y + 0.5;
      for(let x = minX; x <= maxX; x++){
        const px = x + 0.5;
        const l1 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
        const l2 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
        if(l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0){ const k = y * size + x; if(!lab[k]){ lab[k] = val; hit++; } }
      }
    }
  }
  return hit;
}
/* 그림판 하나의 조각 배치 — { islands:[{geo, root, tris}], index:Map('gid:root' → 번호), owner:Int16Array(텍셀 → 번호+1, 0 = 주인 없음) }.
   래스터에 한 칸도 안 걸린 조각(넓이 0 · 아주 가는 조각)은 꼭짓점 텍셀에 씨앗을 심는다. 넓이 0 조각은 칠할 수는 없다(islandIndex). */
function canvasLayout(size, geos){
  const list = [];
  (geos || []).forEach(g=>{ if(g && list.indexOf(g) < 0 && _triCount(g)) list.push(g); });
  const key = size + '|' + list.map(gid).join(',');
  if(_layouts.has(key)){ const v = _layouts.get(key); _layouts.delete(key); _layouts.set(key, v); return v; }
  const islands = [], index = new Map();
  list.forEach(g=>{
    const ids = islandIds(g), a = g.attributes.uv, by = new Map();
    for(let t = 0; t < ids.length; t++){
      const i0 = _vIdx(g, t * 3), i1 = _vIdx(g, t * 3 + 1), i2 = _vIdx(g, t * 3 + 2);
      const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
      if(!tri.every(v=>isFinite(v))) continue;
      if(!by.has(ids[t])) by.set(ids[t], []);
      by.get(ids[t]).push(tri);
    }
    by.forEach((tris, root)=>{ index.set(gid(g) + ':' + root, islands.length); islands.push({ geo:g, root, tris }); });
  });
  const n = size * size, owner = new Int16Array(n), q = new Int32Array(n);
  let qt = 0;
  islands.forEach((isl, i)=>{
    let area = 0; isl.tris.forEach(t=>{ area += Math.abs((t[2] - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (t[3] - t[1])) / 2; });
    isl.area = area;
    /* 넓이 0 조각(사람 손 · 몸이 UV 한 점을 읽는다)도 그 점의 주인은 된다 — 칠하지는 않지만, 주인이 없으면 옆 조각을 채울 때
       그 점까지 칠해져 손 · 몸 색이 바뀐다. */
    if(area <= 0.5 || !_raster(isl.tris, size, owner, i + 1)){
      for(const t of isl.tris) for(let v = 0; v < 6; v += 2){
        const x = Math.max(0, Math.min(size - 1, Math.floor(t[v]))), y = Math.max(0, Math.min(size - 1, Math.floor(t[v + 1]))), k = y * size + x;
        if(!owner[k]) owner[k] = i + 1;
      }
    }
  });
  for(let k = 0; k < n; k++) if(owner[k]) q[qt++] = k;
  for(let qh = 0; qh < qt; qh++){
    const k = q[qh], x = k % size, y = (k / size) | 0, L = owner[k];
    for(let dy = -1; dy <= 1; dy++){ const yy = y + dy; if(yy < 0 || yy >= size) continue;
      for(let dx = -1; dx <= 1; dx++){ const xx = x + dx; if((!dx && !dy) || xx < 0 || xx >= size) continue;
        const kk = yy * size + xx; if(owner[kk]) continue; owner[kk] = L; q[qt++] = kk; } }
  }
  const layout = { size, islands, index, owner };
  _layouts.set(key, layout);
  while(_layouts.size > LAYOUT_CACHE_MAX) _layouts.delete(_layouts.keys().next().value);
  return layout;
}
/* 누른 조각의 번호(-1 = 못 찾음 · 넓이 0) */
function islandIndex(layout, geometry, faceIndex, uv){
  const ids = islandIds(geometry); if(!ids) return -1;
  let f = (typeof faceIndex === 'number' && faceIndex >= 0 && faceIndex < ids.length) ? (faceIndex | 0) : -1;
  if(f < 0 && uv) f = triangleAtUv(geometry, uv.x, uv.y);
  if(f < 0) return -1;
  const i = layout.index.get(gid(geometry) + ':' + ids[f]);
  return (i == null || !(layout.islands[i].area > 0.5)) ? -1 : i;
}
function _rgb(c){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/* 주인 표에서 picks(번호 집합)의 텍셀을 지금 색으로(erase 면 투명으로). 바꾼 텍셀 수. */
function paintOwned(ctx, layout, picks, opts){
  const o = opts || {}, rgb = _rgb(o.color), size = layout.size, own = layout.owner, want = new Uint8Array(layout.islands.length + 1);
  picks.forEach(i=>{ if(i >= 0) want[i + 1] = 1; });
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  let c = 0;
  for(let k = 0; k < own.length; k++){
    if(!want[own[k]]) continue;
    const i = k * 4; c++;
    if(o.erase){ d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; }
    else { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
  }
  if(c) ctx.putImageData(img, 0, 0);
  return c;
}
/* 누른 조각 하나(생성기 페인트통) — peers = 같은 그림판에 UV 를 둔 다른 geometry */
function fillIslandOwned(ctx, size, geometry, faceIndex, uv, peers, opts){
  const L = canvasLayout(size, [geometry].concat(peers || []));
  const i = islandIndex(L, geometry, faceIndex, uv);
  return i < 0 ? 0 : paintOwned(ctx, L, [i], opts);
}
/* 메쉬 전체(꾸미기 채우기) — 그 메쉬의 넓이 있는 조각 전부 */
function fillMeshOwned(ctx, size, geometry, peers, opts){
  const L = canvasLayout(size, [geometry].concat(peers || []));
  const picks = []; L.islands.forEach((isl, i)=>{ if(isl.geo === geometry && isl.area > 0.5) picks.push(i); });
  return picks.length ? paintOwned(ctx, L, picks, opts) : 0;
}

const api = { FILL_PAD_PX, LAYOUT_CACHE_MAX, uvTriangles, fillMesh, fillTriangles, islandIds, triangleAtUv, islandTriangles, fillIsland,
              canvasLayout, islandIndex, paintOwned, fillIslandOwned, fillMeshOwned };
if(typeof window !== 'undefined') window.UvFill = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
