/* glow.js — ✨ 빛나는 스프라이트 · 재질 발광(앱 FSD · app.js 분리 M1)
   app.js SETUP 구역의 «발광» 조각을 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(바뀐 줄 0).
   ・책임: 오브젝트 옆에 반투명 원형 스프라이트를 깔고(addGlowSprite) · 재질 emissive 를 밝히는(applyGlowToMesh) 규칙. 화면 전체 후처리(Bloom)는 쓰지 않는다.
   ・받는 deps: 없음(THREE 는 전역 — app.js 앞에 싣는 classic script).
   ・내놓는 것: getGlowSpriteTexture() · addGlowSprite(obj) · applyGlowToMesh(mesh) · applyGlowEffect(obj) · GLOW_SIZE_MUL · GLOW_COLOR · GLOW_EMISSIVE_BOOST
   ⚠️ 지금 부르는 곳이 없다 — 아이템 발광 호출(equipDeskItem 의 `applyGlowEffect`)은 «발광 없는 게 나음» 요청으로 주석 처리돼 있다. 되살리려면 그 줄만.
   검사: checks/sim-glow.js */
(function(){

function createGlow(deps){
// ★ Bloom 후처리(UnrealBloomPass)는 시도해봤지만 이 앱(바탕화면이 비치는 투명 배경 오버레이)과 근본적으로
//   안 맞아서 제거함 — 화면 전체를 대상으로 하는 후처리라 (1)배경 투명도가 깨져서 까맣게 나오고,
//   (2)발광 설정한 파츠/아이템뿐 아니라 화면에서 밝은 픽셀(얼굴 등)까지 같이 번져버림.
//   대신 발광 대상 오브젝트 옆에 반투명 원형 스프라이트를 하나 더 깔아두는 방식으로 대체 —
//   화면 전체에 영향 없이 그 물체 주변에만 은은한 빛이 도는 것처럼 보임.
let _glowSpriteTex = null;
function getGlowSpriteTexture(){
  if(_glowSpriteTex) return _glowSpriteTex;
  const cv=document.createElement('canvas'); cv.width=cv.height=128;
  const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,0.85)');
  g.addColorStop(0.45,'rgba(255,255,255,0.30)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
  _glowSpriteTex=new THREE.CanvasTexture(cv);
  return _glowSpriteTex;
}
// obj: 발광시킬 오브젝트(파츠/아이템의 최상위 그룹), parent: 스프라이트를 붙일 부모(보통 obj 자신)
// GLOW_SIZE_MUL/GLOW_COLOR: 필요하면 이 두 상수만 조절
const GLOW_SIZE_MUL = 1.4;      // 오브젝트 크기 대비 빛 스프라이트 배율 — 키우면 더 넓게 번짐
const GLOW_COLOR = 0xfff3c4;    // 빛 색상 — 따뜻한 노란빛. 흰빛을 원하면 0xffffff로
function addGlowSprite(obj){
  try{
    obj.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(obj);
    const size=box.getSize(new THREE.Vector3());
    const maxDim=Math.max(size.x,size.y,size.z,0.05);
    const mat=new THREE.SpriteMaterial({ map:getGlowSpriteTexture(), color:GLOW_COLOR, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
    const sp=new THREE.Sprite(mat);
    sp.scale.setScalar(maxDim*GLOW_SIZE_MUL);
    sp.renderOrder=900;
    const center=box.getCenter(new THREE.Vector3());
    obj.worldToLocal(center);
    sp.position.copy(center);
    obj.add(sp);
    return sp;
  }catch(e){ return null; }
}
// ★ "파츠/아이템 자체가 통으로 은은하게 빛났으면 좋겠다"는 요청에 따라, 원형 스프라이트뿐 아니라
//   오브젝트 자신의 재질도 모양 그대로 살짝 밝게(emissive) 만들어서 겹쳐 씀 — 원형 스프라이트는 주변에
//   은은하게 도는 분위기용, emissive는 그 물체 자체의 표면이 실제로 빛나 보이게 하는 용도.
//   GLOW_EMISSIVE_BOOST를 키우면 물체 자체가 더 밝게, 줄이면 더 은은하게.
const GLOW_EMISSIVE_BOOST = 1.5;
function applyGlowToMesh(o){
  if(!o.isMesh || !o.material) return;
  const m=o.material;
  if(!m.emissive || m.emissive.getHex()===0) m.emissive=(m.color||new THREE.Color(0xffffff)).clone();
  if(m.map && !m.emissiveMap) m.emissiveMap=m.map;
  if('emissiveIntensity' in m) m.emissiveIntensity = GLOW_EMISSIVE_BOOST; else m.emissive.multiplyScalar(GLOW_EMISSIVE_BOOST);
  m.needsUpdate=true;
}
// obj 전체(자기 자신 포함)를 순회하며 은은하게 발광시키고, 추가로 원형 빛 스프라이트도 얹음.
function applyGlowEffect(obj){
  obj.traverse(o=>applyGlowToMesh(o));
  return addGlowSprite(obj);
}

return {
  getGlowSpriteTexture,
  addGlowSprite,
  applyGlowToMesh,
  applyGlowEffect,
  GLOW_SIZE_MUL,
  GLOW_COLOR,
  GLOW_EMISSIVE_BOOST,
};
}

const api = { createGlow };
if(typeof window !== 'undefined') window.TwGlow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
