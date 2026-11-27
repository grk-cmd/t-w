/* paint-geom.js — ✏️ 그리기 공용 기하: 획 조각 긋기(strokeSeg) · 메쉬 거울 자리의 UV(mirrorUVOn)
   app.js 생성기 그리기 조각에서 공용 부분만 떼어 아래층(shared)에 둔 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄 0).
   ・책임: 캔버스 2D 에 선 한 조각 · 3D 메쉬의 거울 표면점을 되쏘아 UV 찾기 — 생성기 얼굴 칠하기(creator/paint-stroke.js)와
     꾸미기 파츠 그리기(character/part-paint.js)가 같이 쓴다. 한쪽에만 두면 둘이 서로를 부르게 된다(sim-dep-cycles).
   ・받는 deps 0. 내놓는 것: strokeSeg(ctx, lx, ly, x, y) · mirrorUVOn(hit, mesh, cam, cx, castFn, off) — app.js 는 paintGeomMod.이름.
   ⚠️ THREE 는 전역 이름 그대로. 전역 이름은 TwPaintGeom(Tw 접두사 #103). shared — 도메인을 모른다.
   검사: checks/sim-paint-geom.js */
(function(){

function createPaintGeom(deps){
/* 그리기 기하 상수 */
const MIRROR_BACKOFF = 0.6;   // 거울 표면점에서 바깥으로 물러나 되쏘는 거리 기본값(캐릭터 얼굴 크기 기준 — 파츠마다 다르면 off)
const DOT_LEN = 0.01;        // 첫 점(앞 점 없음)을 찍는 짧은 선 길이(px)
function _seg(ctx,x0,y0,x1,y1){ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
/* === 3D 메쉬 중앙 기준 x축 대칭 ===
   미러 지점을 메쉬 로컬에서 x반전한 뒤, 그 지점에 두 번째 레이캐스트를 쏘아 '실제 표면'의 UV를 얻음.
   (UV 솔기로 같은 3D점에 UV가 여러 개여도 정확한 표면 UV를 가져옴) */
const _mp=new THREE.Vector3(), _mn=new THREE.Vector3(), _mo=new THREE.Vector3(), _mray=new THREE.Raycaster(), _mdir=new THREE.Vector3();
/* ★ 얼굴만이 아니라 **아무 메쉬에나** 쓸 수 있게 인자를 받는다 — 꾸미기창의 파츠 그리기(_pic)가
   같은 함수를 쓴다. 여기만 따로 두면 한쪽 대칭만 고쳐지는 날이 온다(이 파일이 반복해서 겪은 실수).
   ⚠️ castFn — 미러 지점을 다시 맞힐 때 쓸 레이캐스트. 리깅 파츠는 기본 레이캐스트가 바인드 포즈를
     맞히기 때문에(스키닝 미계산) 대칭도 같이 빗나간다. 그리기 쪽이 자기 캐스트를 넘겨 준다. */
function mirrorUVOn(hit, mesh, cam, cx, castFn, off){ if(!mesh||!hit)return null;
  _mp.copy(hit.point); mesh.worldToLocal(_mp); _mp.x = 2*(cx||0) - _mp.x; mesh.localToWorld(_mp);  // 미러 표면점(월드)
  const n=hit.face&&hit.face.normal;
  if(n){ _mn.set(-n.x,n.y,n.z).transformDirection(mesh.matrixWorld).normalize(); }   // 미러된 바깥 법선
  else { _mn.copy(cam.position).sub(_mp).normalize(); }
  /* 표면 바깥 어디에서 되쏠 것인가. 기본 0.6 은 얼굴(캐릭터 크기) 기준으로 정해진 값이다.
     ⚠️ 옷처럼 몸통·소매가 겹친 파츠에서는 이만큼 물러나면 **반대편 표면 대신 앞쪽 천**에서
       출발하게 된다. 그래서 부르는 쪽이 파츠 크기에 맞는 값을 넘길 수 있게 열어 뒀다. */
  _mo.copy(_mp).addScaledVector(_mn, (off>0?off:MIRROR_BACKOFF));
  _mdir.copy(_mn).negate();                               // 표면 쪽으로
  _mray.set(_mo,_mdir);
  if(castFn){ const hh=castFn(_mray.ray, mesh); return (hh&&hh.uv)?{x:hh.uv.x,y:hh.uv.y}:null; }
  const h=_mray.intersectObject(mesh,false);
  if(h.length&&h[0].uv) return {x:h[0].uv.x,y:h[0].uv.y};
  return null; }

function strokeSeg(ctx,lx,ly,x,y){ if(lx==null)_seg(ctx,x,y,x+DOT_LEN,y+DOT_LEN); else _seg(ctx,lx,ly,x,y); }

return {
  mirrorUVOn,
  strokeSeg,
};
}

const api = { createPaintGeom };
if(typeof window !== 'undefined') window.TwPaintGeom = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
