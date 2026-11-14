/* 🪣 메쉬 채우기 — 누른 메쉬(또는 UV 섬)의 UV 삼각형만 그림판에 칠한다.
   그림판 전체를 칠하면 같은 텍스처를 나눠 쓰는 다른 메쉬와 빈 칸까지 덮인다 — 그 메쉬가 쓰는 자리만 칠한다.
   좌표 규약은 붓과 같다 — 캔버스 좌표 = uv × 크기. THREE 를 안 본다(geometry 의 attributes · index 만 읽는다).
   생성기 페인트통은 메쉬 하나가 얼굴 · 뒤통수 · 손을 같이 가져서 누른 조각(UV 섬)만 칠한다(fillIsland) · 꾸미기는 메쉬 전체(fillMesh). */

export interface UvAttrLike {
  count: number;
  getX(i: number): number;
  getY(i: number): number;
}
export interface IndexAttrLike {
  count: number;
  getX(i: number): number;
}
/** THREE.BufferGeometry 에서 읽는 몫 */
export interface GeometryLike {
  attributes: { uv?: UvAttrLike };
  index?: IndexAttrLike | null;
}
export interface UvPoint {
  x: number;
  y: number;
}
export interface FillOptions {
  color?: string;
  erase?: boolean;
  pad?: number;
}
/** 캔버스 좌표 삼각형 [x0, y0, x1, y1, x2, y2] */
export type Tri = number[];
/** 칠하기에 쓰는 2D 컨텍스트 몫 */
export interface Ctx2DLike {
  save(): void;
  restore(): void;
  globalCompositeOperation: string;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineJoin: string;
  lineWidth: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray | number[] };
  putImageData(img: unknown, x: number, y: number): void;
}

/* 삼각형 가장자리를 이만큼(픽셀) 넓혀 칠한다 — 정확히 삼각형만 칠하면 텍스처 필터링이 경계 바깥 픽셀을 섞어
   UV 솔기에 가는 실선이 남는다. */
export const FILL_PAD_PX = 1.5;

/** geometry → 캔버스 좌표 삼각형 목록. UV 가 없으면 빈 목록. */
export function uvTriangles(geometry: GeometryLike | null | undefined, size: number): Tri[] {
  const g = geometry, a = g && g.attributes, uv = a && a.uv;
  if (!g || !uv || !uv.count) return [];
  const idx = g.index;
  const n = idx ? idx.count : uv.count;
  const get = (i: number) => (idx ? idx.getX(i) : i);
  const out: Tri[] = [];
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = get(t), i1 = get(t + 1), i2 = get(t + 2);
    const tri = [uv.getX(i0) * size, uv.getY(i0) * size, uv.getX(i1) * size, uv.getY(i1) * size, uv.getX(i2) * size, uv.getY(i2) * size];
    if (tri.every((v) => isFinite(v))) out.push(tri);
  }
  return out;
}

/** ctx 에 geometry 의 UV 자리를 칠한다(erase 면 지운다). 칠한 삼각형 수. */
export function fillMesh(ctx: Ctx2DLike, geometry: GeometryLike, size: number, opts?: FillOptions): number {
  return fillTriangles(ctx, uvTriangles(geometry, size), opts);
}

/** 캔버스 좌표 삼각형 목록을 한 경로로 칠한다(fillMesh · fillIsland 공용). */
export function fillTriangles(ctx: Ctx2DLike, tris: Tri[] | null | undefined, opts?: FillOptions): number {
  const o = opts || {};
  if (!tris || !tris.length) return 0;
  ctx.save();
  ctx.globalCompositeOperation = o.erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = o.color || '#000000';
  ctx.strokeStyle = o.color || '#000000';
  ctx.lineJoin = 'round';
  // 지울 때는 1px 더 넓게 — 칠할 때 반쯤 번진 경계 픽셀이 같은 폭으로는 덜 지워져 테두리가 남는다
  ctx.lineWidth = ((o.pad != null ? o.pad : FILL_PAD_PX) + (o.erase ? 1 : 0)) * 2;
  ctx.beginPath();
  tris.forEach((t) => {
    ctx.moveTo(t[0] as number, t[1] as number);
    ctx.lineTo(t[2] as number, t[3] as number);
    ctx.lineTo(t[4] as number, t[5] as number);
    ctx.closePath();
  });
  ctx.fill();
  if (ctx.lineWidth > 0) ctx.stroke();
  ctx.restore();
  return tris.length;
}

/* ── UV 섬 ──
   섬 = 정점을 나눠 쓰거나 UV 좌표가 같은 정점으로 이어진 삼각형 묶음. Blender 는 날카로운 모서리에서도
   정점을 쪼개서(UV 는 같다) 인덱스만 보면 한 조각이 여러 섬으로 갈린다 — 그래서 UV 좌표가 같으면 잇는다.
   geometry 마다 한 번만 센다(WeakMap). */
const UV_KEY_Q = 1e5; // UV 좌표를 이만큼 곱해 반올림한 값이 같으면 같은 점으로 본다
const islandCache = typeof WeakMap !== 'undefined' ? new WeakMap<GeometryLike, Int32Array>() : null;
function triCount(g: GeometryLike | null | undefined): number {
  const uv = g && g.attributes && g.attributes.uv;
  if (!g || !uv || !uv.count) return 0;
  return Math.floor((g.index ? g.index.count : uv.count) / 3);
}
const vIdx = (g: GeometryLike, i: number) => (g.index ? g.index.getX(i) : i);

/** 삼각형 번호 → 섬 번호. UV 가 없으면 null. */
export function islandIds(geometry: GeometryLike | null | undefined): Int32Array | null {
  const g = geometry, n = triCount(g);
  if (!g || !n) return null;
  const hit = islandCache && islandCache.get(g);
  if (hit) return hit;
  const uv = g.attributes.uv as UvAttrLike, vc = uv.count;
  const par = new Int32Array(vc);
  for (let i = 0; i < vc; i++) par[i] = i;
  const find = (x: number) => {
    while (par[x] !== x) {
      par[x] = par[par[x] as number] as number;
      x = par[x] as number;
    }
    return x;
  };
  const join = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) par[b] = a;
  };
  const seen = new Map<string, number>();
  for (let i = 0; i < vc; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (!isFinite(u) || !isFinite(v)) continue;
    const k = Math.round(u * UV_KEY_Q) + ',' + Math.round(v * UV_KEY_Q);
    const s = seen.get(k);
    if (s !== undefined) join(s, i);
    else seen.set(k, i);
  }
  for (let t = 0; t < n; t++) {
    const a = vIdx(g, t * 3);
    join(a, vIdx(g, t * 3 + 1));
    join(a, vIdx(g, t * 3 + 2));
  }
  const out = new Int32Array(n);
  for (let t = 0; t < n; t++) out[t] = find(vIdx(g, t * 3));
  if (islandCache) islandCache.set(g, out);
  return out;
}

/** UV 점(0~1)을 품은 삼각형 번호 — 광선이 삼각형 번호를 안 줄 때(대칭 되쏘기는 UV 만 돌려준다) 쓴다. 없으면 -1. */
export function triangleAtUv(geometry: GeometryLike | null | undefined, u: number, v: number): number {
  const g = geometry, n = triCount(g);
  if (!g || !n || !isFinite(u) || !isFinite(v)) return -1;
  const uv = g.attributes.uv as UvAttrLike, E = 1e-6;
  for (let t = 0; t < n; t++) {
    const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
    const ax = uv.getX(i0), ay = uv.getY(i0), bx = uv.getX(i1), by = uv.getY(i1), cx = uv.getX(i2), cy = uv.getY(i2);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (!(Math.abs(d) > 1e-12)) continue; // 넓이 0 · 망가진 삼각형
    const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / d;
    const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / d;
    if (l1 >= -E && l2 >= -E && 1 - l1 - l2 >= -E) return t;
  }
  return -1;
}

function pickFace(ids: Int32Array, geometry: GeometryLike, faceIndex: unknown, uv: UvPoint | null | undefined): number {
  let f = typeof faceIndex === 'number' && faceIndex >= 0 && faceIndex < ids.length ? faceIndex | 0 : -1;
  if (f < 0 && uv) f = triangleAtUv(geometry, uv.x, uv.y);
  return f;
}

/** 누른 삼각형(faceIndex — 없으면 uv 로 찾는다)이 든 섬의 캔버스 좌표 삼각형 목록.
    섬 전체 넓이가 0 이면(UV 가 한 점에 접힌 조각 — 칠할 그림이 없다) 빈 목록. */
export function islandTriangles(geometry: GeometryLike, size: number, faceIndex?: number | null, uv?: UvPoint | null): Tri[] {
  const ids = islandIds(geometry);
  if (!ids) return [];
  const f = pickFace(ids, geometry, faceIndex, uv);
  if (f < 0) return [];
  const id = ids[f], g = geometry, a = g.attributes.uv as UvAttrLike, out: Tri[] = [];
  let area = 0;
  for (let t = 0; t < ids.length; t++) {
    if (ids[t] !== id) continue;
    const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
    const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
    if (!tri.every((v) => isFinite(v))) continue;
    area += triArea(tri);
    out.push(tri);
  }
  return area > 0.5 ? out : []; // 반 픽셀도 안 되면 칠할 자리가 없는 조각
}
const triArea = (t: Tri) =>
  Math.abs(((t[2] as number) - (t[0] as number)) * ((t[5] as number) - (t[1] as number)) - ((t[4] as number) - (t[0] as number)) * ((t[3] as number) - (t[1] as number))) / 2;

/** 누른 섬만 칠한다(지운다). 칠한 삼각형 수 — 0 이면 아무것도 안 했다. */
export function fillIsland(ctx: Ctx2DLike, geometry: GeometryLike, size: number, faceIndex?: number | null, uv?: UvPoint | null, opts?: FillOptions): number {
  return fillTriangles(ctx, islandTriangles(geometry, size, faceIndex, uv), opts);
}

/* ── 여백 몫(owner map) — 채운 조각 둘레 실선 막기 ──
   [왜] 조각 삼각형만 딱 맞게 칠하면 경계 바깥 텍셀이 옛 색으로 남아, 쌍선형 필터 · 밉맵이 섞어 조각 둘레에 가는 실선이 보인다.
     몇 텍셀만 넓혀서는 밉맵 몇 단계에서 다시 1텍셀 아래가 된다.
   [방법] 같은 그림판을 쓰는 모든 조각을 텍셀 중심으로 래스터화하고, 빈 텍셀은 가장 가까운 조각의 몫으로 정한다(8방향 BFS).
     조각을 채우면 그 조각의 텍셀 + 몫 텍셀 전부를 칠한다 — 이웃 조각 안쪽은 한 칸도 안 건드린다.
   표는 (geometry 묶음 · 크기)마다 한 번만 만들고 최근 몇 개만 기억한다. */
let geoSeq = 0;
const geoIds = typeof WeakMap !== 'undefined' ? new WeakMap<GeometryLike, number>() : null;
const gid = (g: GeometryLike) => {
  if (!geoIds) return 0;
  let v = geoIds.get(g);
  if (!v) {
    v = ++geoSeq;
    geoIds.set(g, v);
  }
  return v;
};
export const LAYOUT_CACHE_MAX = 6;
const layouts = new Map<string, CanvasLayout>();

export interface LayoutIsland {
  geo: GeometryLike;
  root: number;
  tris: Tri[];
  area?: number;
}
export interface CanvasLayout {
  size: number;
  islands: LayoutIsland[];
  index: Map<string, number>;
  /** 텍셀 → 조각 번호 + 1 (0 = 주인 없음) */
  owner: Int16Array;
}

function raster(tris: Tri[], size: number, lab: Int16Array, val: number): number {
  let hit = 0;
  for (const t of tris) {
    const [x0, y0, x1, y1, x2, y2] = t as [number, number, number, number, number, number];
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (!(Math.abs(d) > 1e-9)) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const l1 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
        const l2 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
        if (l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) {
          const k = y * size + x;
          if (!lab[k]) {
            lab[k] = val;
            hit++;
          }
        }
      }
    }
  }
  return hit;
}

/** 그림판 하나의 조각 배치. 래스터에 한 칸도 안 걸린 조각(넓이 0 · 아주 가는 조각)은 꼭짓점 텍셀에 씨앗을 심는다. */
export function canvasLayout(size: number, geos: (GeometryLike | null | undefined)[] | null | undefined): CanvasLayout {
  const list: GeometryLike[] = [];
  (geos || []).forEach((g) => {
    if (g && list.indexOf(g) < 0 && triCount(g)) list.push(g);
  });
  const key = size + '|' + list.map(gid).join(',');
  const cached = layouts.get(key);
  if (cached) {
    layouts.delete(key);
    layouts.set(key, cached);
    return cached;
  }
  const islands: LayoutIsland[] = [], index = new Map<string, number>();
  list.forEach((g) => {
    const ids = islandIds(g) as Int32Array, a = g.attributes.uv as UvAttrLike, by = new Map<number, Tri[]>();
    for (let t = 0; t < ids.length; t++) {
      const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
      const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
      if (!tri.every((v) => isFinite(v))) continue;
      const id = ids[t] as number;
      let arr = by.get(id);
      if (!arr) by.set(id, (arr = []));
      arr.push(tri);
    }
    by.forEach((tris, root) => {
      index.set(gid(g) + ':' + root, islands.length);
      islands.push({ geo: g, root, tris });
    });
  });
  const n = size * size, owner = new Int16Array(n), q = new Int32Array(n);
  let qt = 0;
  islands.forEach((isl, i) => {
    let area = 0;
    isl.tris.forEach((t) => {
      area += triArea(t);
    });
    isl.area = area;
    // 넓이 0 조각(UV 한 점을 읽는 손 · 몸)도 그 점의 주인은 된다 — 주인이 없으면 옆 조각을 채울 때 그 점까지 칠해진다.
    if (area <= 0.5 || !raster(isl.tris, size, owner, i + 1)) {
      for (const t of isl.tris)
        for (let v = 0; v < 6; v += 2) {
          const x = Math.max(0, Math.min(size - 1, Math.floor(t[v] as number))), y = Math.max(0, Math.min(size - 1, Math.floor(t[v + 1] as number))), k = y * size + x;
          if (!owner[k]) owner[k] = i + 1;
        }
    }
  });
  for (let k = 0; k < n; k++) if (owner[k]) q[qt++] = k;
  for (let qh = 0; qh < qt; qh++) {
    const k = q[qh] as number, x = k % size, y = (k / size) | 0, L = owner[k] as number;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= size) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((!dx && !dy) || xx < 0 || xx >= size) continue;
        const kk = yy * size + xx;
        if (owner[kk]) continue;
        owner[kk] = L;
        q[qt++] = kk;
      }
    }
  }
  const layout: CanvasLayout = { size, islands, index, owner };
  layouts.set(key, layout);
  while (layouts.size > LAYOUT_CACHE_MAX) layouts.delete(layouts.keys().next().value as string);
  return layout;
}

/** 누른 조각의 번호(-1 = 못 찾음 · 넓이 0) */
export function islandIndex(layout: CanvasLayout, geometry: GeometryLike, faceIndex?: number | null, uv?: UvPoint | null): number {
  const ids = islandIds(geometry);
  if (!ids) return -1;
  const f = pickFace(ids, geometry, faceIndex, uv);
  if (f < 0) return -1;
  const i = layout.index.get(gid(geometry) + ':' + ids[f]);
  return i == null || !((layout.islands[i] as LayoutIsland).area! > 0.5) ? -1 : i;
}

function rgb(c: unknown): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  const v = m ? parseInt(m[1] as string, 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** 주인 표에서 picks(번호 집합)의 텍셀을 지금 색으로(erase 면 투명으로). 바꾼 텍셀 수. */
export function paintOwned(ctx: Ctx2DLike, layout: CanvasLayout, picks: number[], opts?: FillOptions): number {
  const o = opts || {}, c3 = rgb(o.color), size = layout.size, own = layout.owner, want = new Uint8Array(layout.islands.length + 1);
  picks.forEach((i) => {
    if (i >= 0) want[i + 1] = 1;
  });
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  let c = 0;
  for (let k = 0; k < own.length; k++) {
    if (!want[own[k] as number]) continue;
    const i = k * 4;
    c++;
    if (o.erase) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    } else {
      d[i] = c3[0];
      d[i + 1] = c3[1];
      d[i + 2] = c3[2];
      d[i + 3] = 255;
    }
  }
  if (c) ctx.putImageData(img, 0, 0);
  return c;
}

/** 누른 조각 하나(생성기 페인트통) — peers = 같은 그림판에 UV 를 둔 다른 geometry */
export function fillIslandOwned(ctx: Ctx2DLike, size: number, geometry: GeometryLike, faceIndex?: number | null, uv?: UvPoint | null, peers?: GeometryLike[] | null, opts?: FillOptions): number {
  const L = canvasLayout(size, [geometry].concat(peers || []));
  const i = islandIndex(L, geometry, faceIndex, uv);
  return i < 0 ? 0 : paintOwned(ctx, L, [i], opts);
}

/** 메쉬 전체(꾸미기 채우기) — 그 메쉬의 넓이 있는 조각 전부 */
export function fillMeshOwned(ctx: Ctx2DLike, size: number, geometry: GeometryLike, peers?: GeometryLike[] | null, opts?: FillOptions): number {
  const L = canvasLayout(size, [geometry].concat(peers || []));
  const picks: number[] = [];
  L.islands.forEach((isl, i) => {
    if (isl.geo === geometry && (isl.area as number) > 0.5) picks.push(i);
  });
  return picks.length ? paintOwned(ctx, L, picks, opts) : 0;
}
