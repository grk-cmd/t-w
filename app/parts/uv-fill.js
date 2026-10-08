/* ═══ 🪣 메쉬 채우기 — 클릭한 메쉬의 UV 삼각형만 그림판에 칠한다 ═══════════════════════════════════
   꾸미기 ✎ 그리기의 «채우기». 그림판(512 캔버스) 전체를 칠하면 같은 텍스처를 나눠 쓰는 다른 메쉬와 빈 칸까지
   덮인다(동물 생성기 G 가 얼굴 · 몸을 같이 칠하는 이유). 여기서는 그 메쉬의 UV 삼각형을 그대로 그려서
   **그 메쉬가 쓰는 자리만** 칠한다.
   좌표 규약은 붓과 같다 — 캔버스 좌표 = uv × 크기(app.js _wdPicPaint 의 hit.uv.x*CANVAS_SZ).
   THREE 를 안 본다(geometry 의 attributes · index 만 읽는다) — node 에서 검사한다(sim-uv-fill.js). */
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
  const o = opts || {};
  const tris = uvTriangles(geometry, size);
  if(!tris.length) return 0;
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

const api = { FILL_PAD_PX, uvTriangles, fillMesh };
if(typeof window !== 'undefined') window.UvFill = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
