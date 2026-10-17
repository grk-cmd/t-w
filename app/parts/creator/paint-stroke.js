/* paint-stroke.js — 🖌 생성기 얼굴에 칠하기: 화면 점 → 얼굴 UV 를 맞혀 그림 층에 획을 잇는다(대칭 거울 · 페인트통 · 스포이드 포함)
   app.js 생성기 «대칭» ~ 스포이드 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄은 swEl() 읽기 하나 · 옛 이야기형 주석 줄이기).
   ・책임: 맞히기(_paintHitAt — 앞면만 · 옷에 가려지면 없음) · 획 잇기(paintAt — 솔기에서 끊기 · 대칭) · 화면 경로 쪼개기(paintFromEvent) · 페인트통 · 스포이드.
     그림 층(actC) · 되돌리기(pushHistory) · 화면 갱신(blit)은 app.js 것을 받아 부른다. 선 긋기 · 거울 UV 는 shared/paint-geom.js.
   ・받는 deps 11 — 값 CANVAS_SZ · crState(생성기 상태 — cBase · cCam · brushColor · brushSize · eraser · symmetry · 획 기억 lastPX …) ·
     paintGeomMod(strokeSeg · mirrorUVOn) · partPaintMod(리깅 맞히기 _picIntersect · UV 배율) · 함수 6(_crDropEraser · actC · blit · isDrawStep · pushHistory · toast) ·
     읽는 함수 swEl(색 견본 줄 — 뒤에서 선언).
   ・내놓는 것: paintFromEvent · bucketFromEvent · eyedropFromEvent · _paintBreak · _pray · _pndc(도장이 같은 광선을 쓴다) — app.js 는 paintStrokeMod.이름.
   ・입구 전제: 세 입구(paintFromEvent · bucketFromEvent · eyedropFromEvent) 모두 그리기 단계 · 캐릭터(cBase) · 얼굴 메쉬 · 미리보기 캔버스가 없으면 아무것도 안 한다.
   ⚠️ THREE · document 는 전역 이름 그대로. 전역 이름은 TwPaintStroke(Tw 접두사 #103).
   검사: checks/sim-paint-stroke.js */
(function(){

function createPaintStroke(deps){
const CANVAS_SZ = deps.CANVAS_SZ;
const _crDropEraser = deps._crDropEraser;
const actC = deps.actC;
const blit = deps.blit;
const crState = deps.crState;
const isDrawStep = deps.isDrawStep;
const paintGeomMod = deps.paintGeomMod;
const partPaintMod = deps.partPaintMod;
const pushHistory = deps.pushHistory;
const swEl = deps.swEl;   // 읽는 함수
const toast = deps.toast;
function mirrorUV(hit){ if(!crState.cBase||!crState.cBase.face)return null;
  /* 대칭 되쏘기도 지금 자세로 맞힌다 — 얼굴이 리깅이라 기본 캐스트는 바인드 포즈를 맞힌다. */
  return paintGeomMod.mirrorUVOn(hit, crState.cBase.face, crState.cCam, crState.cBase.faceCx||0, (ray, mesh)=>partPaintMod._picIntersect(ray,[mesh])); }
/* 아래쪽(턱 · 목)을 칠할 때 획이 튀지 않게 — 꾸미기 파츠 그리기(_wdPic)와 같은 세 규칙: 앞면만 맞힌다 · 옷(윗옷 · 아래옷 · 한벌옷)이
   얼굴보다 앞에서 맞으면 끊는다 · 3D 이동량에 비해 UV 가 크게 뛰면(솔기) 잇지 않는다. 화면 경로는 몇 px 단위로 쪼개 따로 맞힌다.
   ⚠️ 가려짐 판정에 모자 · 안경 · 탈은 넣지 않는다 — 얼굴 위에 얹는 파츠라 그 아래를 칠하려는 경우가 있다. */
function _paintBreak(){ crState.lastPX=crState.lastPY=null; crState.lastSX=crState.lastSY=null; crState._pLastUV=null; crState._pLastPt=null; crState._pLastSUV=null; }
function _paintHitAt(clientX, clientY){
  const cv=document.getElementById('creatorPreview'); if(!cv || !crState.cBase || !crState.cBase.face) return null;
  const r=cv.getBoundingClientRect();
  _pndc.x=((clientX-r.left)/r.width)*2-1; _pndc.y=-((clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,crState.cCam);
  /* 얼굴 · 옷 모두 리깅이라 지금 자세로 맞힌다(_picIntersect — 앞면만). */
  const hit=partPaintMod._picIntersect(_pray.ray, [crState.cBase.face]);
  if(!hit || !hit.uv) return null;
  hit.distance = _pray.ray.origin.distanceTo(hit.point);
  const occ=[crState.cBase.upMesh, crState.cBase.loMesh, crState.cBase.onepieceMesh];
  /* ⚠️ 같은 장면에 붙어 있는 옷만 본다 — 동물 생성기로 바뀌면 cBase.face 만 동물 것으로 바뀌고 옷 참조는 옛 사람
     인스턴스를 가리킬 수 있다(장면에서 떼어진 메쉬). 그 낡은 위치에 맞으면 엉뚱하게 칠이 막힌다. */
  let _fr=crState.cBase.face; while(_fr.parent) _fr=_fr.parent;
  for(let i=0;i<occ.length;i++){
    const o=occ[i]; if(!o || o === crState.cBase.face) continue;
    let vis=true, q=o, root=o; for(;q;q=q.parent){ if(q.visible===false){ vis=false; break; } root=q; }
    if(!vis || root !== _fr) continue;
    const oh=partPaintMod._picIntersect(_pray.ray, [o]);
    if(oh && oh.point && _pray.ray.origin.distanceTo(oh.point) < hit.distance - 1e-3) return null;   // 옷이 앞에 있다 — 안 보이는 곳이다
  }
  return hit;
}
function paintAt(hit){ const ctx=actC().getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=crState.brushSize;
  ctx.globalCompositeOperation=crState.eraser?'destination-out':'source-over';ctx.strokeStyle=crState.brushColor;
  const cx=hit.uv.x*CANVAS_SZ, cy=hit.uv.y*CANVAS_SZ;
  /* 🧵 솔기 판정(_wdPicPaint 와 같은 식) — 천장 0.25 까지 그대로. */
  const wD=(crState._pLastPt && hit.point) ? crState._pLastPt.distanceTo(hit.point) : 0;
  const allow=Math.min(0.25, wD * partPaintMod._wdPicUvScale(hit.object) * 4 + 0.02);
  if(crState._pLastUV && Math.hypot(hit.uv.x-crState._pLastUV.x, hit.uv.y-crState._pLastUV.y) > allow){ crState.lastPX=crState.lastPY=null; }
  paintGeomMod.strokeSeg(ctx,crState.lastPX,crState.lastPY,cx,cy); crState.lastPX=cx; crState.lastPY=cy;
  crState._pLastUV={x:hit.uv.x, y:hit.uv.y};
  if(hit.point){ if(!crState._pLastPt) crState._pLastPt=new THREE.Vector3(); crState._pLastPt.copy(hit.point); }
  if(crState.symmetry){ const m=mirrorUV(hit);
    if(m){
      const mj=!!(crState._pLastSUV && Math.hypot(m.x-crState._pLastSUV.x, m.y-crState._pLastSUV.y) > allow);
      const mx=m.x*CANVAS_SZ, my=m.y*CANVAS_SZ; paintGeomMod.strokeSeg(ctx,mj?null:crState.lastSX,mj?null:crState.lastSY,mx,my); crState.lastSX=mx; crState.lastSY=my; crState._pLastSUV={x:m.x,y:m.y};
    }
    else { crState.lastSX=crState.lastSY=null; crState._pLastSUV=null; } }
  ctx.globalCompositeOperation='source-over'; blit(); }
/* 🪣 페인트통 — 누른 얼굴 메쉬의 조각(UV 섬)만 지금 색으로 채운다(erase 면 그 조각만 지운다 → 피부가 보인다).
   붓과 같은 광선(_paintHitAt — 앞면만 · 옷에 가려지면 안 칠함)을 쓰고, 그림 층(actC)에만 칠하므로
   저장 · 되돌리기 · 감은눈 복사가 붓 획과 똑같이 다룬다. 대칭이면 거울 자리의 조각도 같은 되돌리기 한 칸에. */
function bucketFromEvent(e, erase){ if(!isDrawStep()||!crState.cBase||!crState.crPaintTool)return false;
  const hit=_paintHitAt(e.clientX, e.clientY);
  if(!hit){ toast('얼굴을 눌러 채워요'); return false; }   // 빈 곳 · 옷에 가려진 곳
  const ctx=actC().getContext('2d'), g=hit.object&&hit.object.geometry;
  const n=crState.crPaintTool.bucket({ ctx, geometry:g, size:CANVAS_SZ, faceIndex:hit.faceIndex, uv:hit.uv, color:crState.brushColor, erase, pushHistory });
  if(!n){ toast('여기는 채울 자리가 없어요 — 얼굴을 눌러 주세요'); return false; }
  if(crState.symmetry){ const m=mirrorUV(hit); if(m) crState.crPaintTool.bucket({ ctx, geometry:g, size:CANVAS_SZ, uv:m, color:crState.brushColor, erase }); }
  if(crState.crStep===3) crState.blinkEdited=true;
  blit();
  return true; }
const _pray=new THREE.Raycaster(), _pndc=new THREE.Vector2();
const CR_PAINT_STEP_PX = 6, CR_PAINT_MAX_STEPS = 8;   // _wdPicStrokeTo 와 같은 값
function paintFromEvent(e){ if(!isDrawStep()||!crState.cBase)return;
  /* 획의 첫 점(pointerdown 이 lastPX 를 비우고 부른다) — 쪼개기 출발점을 새로 잡는다. */
  if(crState.lastPX==null && crState.lastSX==null && !crState._pLastUV) crState._pLastScr=null;
  const sx=crState._pLastScr ? crState._pLastScr.x : null, sy=crState._pLastScr ? crState._pLastScr.y : null;
  if(sx==null){
    const h=_paintHitAt(e.clientX, e.clientY);
    if(h) paintAt(h); else _paintBreak();
  } else {
    const dx=e.clientX-sx, dy=e.clientY-sy;
    const n=Math.min(CR_PAINT_MAX_STEPS, Math.max(1, Math.ceil(Math.hypot(dx,dy)/CR_PAINT_STEP_PX)));
    for(let i=1;i<=n;i++){
      const h=_paintHitAt(sx+dx*i/n, sy+dy*i/n);
      if(h) paintAt(h); else _paintBreak();   // 얼굴 밖·가려진 곳 — 거기서 끊는다
    }
  }
  crState._pLastScr={x:e.clientX, y:e.clientY};
}
// 우클릭 스포이드: 표정 텍스처 캔버스에서 픽셀 색을 읽어 브러시 색으로 적용
function eyedropFromEvent(e){ if(!isDrawStep()||!crState.cBase)return false;
  /* 입구 전제 — 생성기 흐름이 말없이 보장하던 «얼굴 메쉬 · 미리보기 캔버스가 있다» 를 여기서 확인한다(붓 · 페인트통의 _paintHitAt 과 같은 조건). */
  if(!crState.cBase.face || !document.getElementById('creatorPreview')) return false;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  _pndc.x=((e.clientX-r.left)/r.width)*2-1; _pndc.y=-((e.clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,crState.cCam);
  const _eh=partPaintMod._picIntersect(_pray.ray, [crState.cBase.face]);   // 지금 자세로 맞힌다(리깅)
  if(!_eh||!_eh.uv) return false;
  const cx=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(_eh.uv.x*CANVAS_SZ)));
  const cy=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(_eh.uv.y*CANVAS_SZ)));
  let d; try{ d=actC().getContext('2d').getImageData(cx,cy,1,1).data; }catch(_){ return false; }
  if(d[3]<8) return false;   // 빈 픽셀은 무시
  const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  crState.brushColor=hex; _crDropEraser();
  const bc=document.getElementById('brushCustom'); if(bc)bc.value=hex;
  [...swEl().children].forEach(x=>x.classList.remove('on'));
  return true; }

return {
  _paintBreak,
  _pndc,
  _pray,
  bucketFromEvent,
  eyedropFromEvent,
  paintFromEvent,
};
}

const api = { createPaintStroke };
if(typeof window !== 'undefined') window.TwPaintStroke = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
