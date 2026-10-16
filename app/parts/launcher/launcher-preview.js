/* launcher-preview.js — 🖼️ 런처 미리보기 · 슬롯 섬네일
   app.js «🖼️ 런처 미리보기 · 슬롯 섬네일» 구역 본문을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     assetCodeMod · customItems · slotSaveMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 20개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: ensureLauncherPreview · lHolder · lRenderer · launcherLoop · setLauncherChar · sizeLauncherPreview — app.js 는 launcherPrevMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLauncherPreview — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-launcher-preview.js */
(function(){

function createLauncherPreview(deps){
const CHAR_Z = deps.CHAR_Z;
const RIG_TURN = deps.RIG_TURN;
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _KEY_LIGHT_MUL = deps._KEY_LIGHT_MUL;
const _MAIN_LIGHT_COL = deps._MAIN_LIGHT_COL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _mkFrontFill = deps._mkFrontFill;
const _setDeskMatColor = deps._setDeskMatColor;
const allDeskItems = deps.allDeskItems;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const applyEquippedPartsToSeat = deps.applyEquippedPartsToSeat;
const applyStaticHandRest = deps.applyStaticHandRest;
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const b64ToBuf = deps.b64ToBuf;
const buildDesk = deps.buildDesk;
const clampCharY = deps.clampCharY;
const clearHolderDeskItems = deps.clearHolderDeskItems;
const commSceneCache = deps.commSceneCache;
const customItems = deps.customItems;   // 읽는 함수
const defToBase = deps.defToBase;
const equipDeskItem = deps.equipDeskItem;
const extractBonesInto = deps.extractBonesInto;
const getCommissionScene = deps.getCommissionScene;
const registerCustomItem = deps.registerCustomItem;
const scene = deps.scene;
const setDeskPos = deps.setDeskPos;
const setDeskScale = deps.setDeskScale;
const setFaceMap = deps.setFaceMap;
const slotSaveMod = deps.slotSaveMod;   // 읽는 함수
const slots = deps.slots;
const swapDeskVisual = deps.swapDeskVisual;
/* --- 런처 미리보기 렌더러 --- */
let lRenderer=null,lScene=null,lCam=null,lChar=null,lBlinkT=0,lBlinkOn=false,lHolder=null,lDeskMat=null,lScaleHint=1;
let lCharBaseY=0;   // 런처 미리보기 캐릭터의 기준 y — 발바닥이 y=0에 오도록 실측 정렬한 값 (둥둥 애니의 중심)
let lFrameH=1.2, lFrameZ=0;   // 실측 키·z — 카메라가 "프레임에 꽉 차게" 거리를 역산할 때 사용
const LAUNCHER_CHAR_Y = -0.12;    // 런처 미리보기 전용 캐릭터 Y 오프셋 — 음수로 낮추면 캐릭터가 아래로 내려감(예: -0.15)
const PS1_PIXEL_SCALE = 0.55;   // 런처 미리보기 도트 느낌 배율 — 작을수록 더 거친 도트(0.2~0.4 권장)
function ensureLauncherPreview(){
  if(lRenderer)return;
  // PS1/도트 느낌: antialias 끄고, 낮은 내부 해상도로 렌더한 뒤 CSS(image-rendering:pixelated)로 확대.
  lRenderer=new THREE.WebGLRenderer({canvas:document.getElementById('lcPreview'),antialias:false,alpha:true});
  lRenderer.setPixelRatio(1);lRenderer.outputEncoding=THREE.sRGBEncoding;
  document.getElementById('lcPreview').style.imageRendering='pixelated';
  lScene=new THREE.Scene();lScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
  const k=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL);k.position.set(0,4,0);lScene.add(k);
  lScene.add(_mkFrontFill(_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));   // ★ 실행 화면과 같은 정면 필
  lCam=new THREE.PerspectiveCamera(32,1,0.1,100);
  const desk=buildDesk(true);lScene.add(desk);
  desk.visible=false;   // 런처 슬롯 미리보기: 책상(+책상 위 아이템) 숨김 — 캐릭터만 둥둥 뜨게. lHolder 로직은 그대로 유지
  const dt=desk.getObjectByName('deskTop'); if(dt){dt.material=dt.material.clone(); lDeskMat=dt.material;}
  lHolder={desk:desk, deskAnchor:desk.userData.deskAnchor, deskItems:{}, deskMat:lDeskMat, activeDeskItem:null};}
/* 🧍 런처 미리보기 프레이밍용 "몸만" 바운딩박스 — 파츠(__part_/__partWrap_ wrapper와 리깅 스킨드메시)를
   제외하고 캐릭터 몸 메쉬만 union. 파츠 위치가 어긋나도 프레임 크기가 흔들리지 않게 하는 것이 목적. */
function _lcBodyBox(group){
  const box=new THREE.Box3(), tmp=new THREE.Box3();
  group.updateWorldMatrix(true,true);
  group.traverse(o=>{
    if(!o.isMesh) return;
    if(o.userData && o.userData._origBind) return;          // 리깅 파츠 스킨드메시
    let p=o, skip=false;
    while(p && p!==group){
      if((p.userData && p.userData.rigged) || String(p.name||'').startsWith('__part')){ skip=true; break; }
      p=p.parent;
    }
    if(skip) return;
    try{ tmp.setFromObject(o); if(!tmp.isEmpty()) box.union(tmp); }catch(_){}
  });
  // 파츠만 있고 몸을 못 찾은 극단적 경우엔 전체 박스로 폴백(빈 프레임 방지)
  if(box.isEmpty()){ try{ box.setFromObject(group); }catch(_){} }
  return box;
}
/* 🖼️ 크기의 기준은 캔버스 자신이 아니라 감싼 .lc-preview-wrap 이다.
   ⚠️ 캔버스에 px 를 다시 박지 말 것 — 박은 값을 clientWidth 가 다시 돌려줘 크기가 굳는다(잘리거나 한쪽에 쏠린다).
     크기는 CSS(width/height:100%)가 정하고, 내부 렌더 해상도만 setSize(...,false) 로 따로 잡는다(도트 느낌). */
function sizeLauncherPreview(){const c=document.getElementById('lcPreview');
  const wrap=c.parentElement;   // .lc-preview-wrap — 실제 표시 칸. 테두리를 뺀 안쪽 크기를 쓴다.
  const w=(wrap&&wrap.clientWidth)||c.clientWidth||260, h=(wrap&&wrap.clientHeight)||c.clientHeight||228;
  const d=Math.max(1,lScaleHint||1);
  // 실제 렌더 해상도는 낮게(도트 느낌), CSS 표시 크기는 그대로 유지 → false를 넘겨 canvas.style을 안 건드림.
  const rw=Math.max(2,Math.round(w*PS1_PIXEL_SCALE)), rh=Math.max(2,Math.round(h*PS1_PIXEL_SCALE));
  lRenderer.setSize(rw,rh,false);
  /* ★ 100% 로 되돌려 둔다 — 옛 버전이 박아둔 px 나 다른 경로가 남긴 값이 있어도 여기서 풀린다(자가 복구). */
  c.style.width='100%'; c.style.height='100%';
  lCam.aspect=w/h;lCam.updateProjectionMatrix();
  // ★ 캐릭터 실측 키(lFrameH)가 프레임 세로의 86%를 채우도록 카메라 거리를 역산.
  //   발바닥은 y=0에 정렬돼 있으므로(setLauncherChar) 프레임 하단에 7% 여백을 두고 딱 서고,
  //   어떤 크기의 캐릭터든 항상 같은 구도가 됨. d(추정 스케일) 공식은 더 이상 사용하지 않음.
  const H=Math.max(0.2, lFrameH||1.2);
  const CY=H*0.5;                              // 박스 세로 중심
  const FILL=0.86;                             // 프레임에서 캐릭터가 차지하는 비율
  const dist=(H/FILL)/(2*Math.tan(THREE.MathUtils.degToRad(32/2)));
  lCam.position.set(0, CY+0.05*H, lFrameZ+dist);   // 완전 정면
  lCam.lookAt(0.04*H, CY, lFrameZ);}   // 시선을 살짝 오른쪽으로 → 캐릭터가 프레임에서 왼쪽으로 당겨져 보임
/* 🖼️ 슬롯 섬네일 = 런처 미리보기 그대로 — 다 그린 뒤(LC_THUMB_SETTLE_MS) 눈 뜬 순간 · 기준 높이에서 찍어 def.thumb 을 갈아 끼운다
   (같은 모습이면 같은 그림 → «바뀐 게 없으면 저장 안 함»이 걸린다). def.thumb 은 로컬 전용이라 서버 쓰기가 안 는다.
   ★ lRenderer 에는 preserveDrawingBuffer 가 없다 → render 와 같은 틱에서 바로 복사한다(launcherLoop). */
const LC_THUMB_SETTLE_MS = 900, LC_THUMB_MAX = 160;
let _lcThumbJob = null;   // { def, readyAt }
function _lcThumbArm(def){ _lcThumbJob = { def, readyAt: performance.now() + LC_THUMB_SETTLE_MS }; }
function _lcThumbTake(){
  const job = _lcThumbJob; _lcThumbJob = null;
  if(!job || !lChar || !lRenderer || lChar.charDef !== job.def) return;   // 그 사이 다른 슬롯으로 넘어갔다
  if(!Array.isArray(slots) || slots.indexOf(job.def) < 0) return;          // 지워졌거나 갈아 끼워진 def
  const y = lChar.group.position.y;
  try{
    lChar.group.position.y = lCharBaseY;                 // 둥둥을 멈춘 자리
    lRenderer.render(lScene, lCam);
    const src = lRenderer.domElement;
    if(!src.width || !src.height) return;
    const k = Math.min(1, LC_THUMB_MAX / Math.max(src.width, src.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(src.width * k)); cv.height = Math.max(1, Math.round(src.height * k));
    const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0, cv.width, cv.height);
    /* 빈 그림(렌더 전·컨텍스트 유실)으로 멀쩡한 섬네일을 덮지 않는다 */
    const px = cx.getImageData(0, 0, cv.width, cv.height).data; let a = 0;
    for(let i = 3; i < px.length; i += 16) a += px[i];
    if(a < 255 * 20) return;
    const url = cv.toDataURL('image/png');
    if(url && url !== job.def.thumb){ job.def.thumb = url; slotSaveMod().saveSlots(); }
  }catch(e){ try{ console.warn('[런처] 섬네일 찍기 실패', e); }catch(_){} }
  finally{ try{ lChar.group.position.y = y; }catch(_){} }
}
function setLauncherChar(def){_lcThumbJob=null;if(lChar){lScene.remove(lChar.group);lChar=null;}
  if(lHolder){ allDeskItems().forEach(d=>{ if(lHolder.deskItems[d.id]) equipDeskItem(lHolder,d,false); });
    swapDeskVisual(lHolder.desk,null); }
  if(!def)return;
  if(lDeskMat) _setDeskMatColor(lDeskMat, def.deskColor||'#c9a36a');
  if(lHolder){ setDeskScale(lHolder.desk, def.deskScale||1, def.deskLenX||1); setDeskPos(lHolder.desk, def.deskPos); }

  const applyBase = (customScene) => {
    const base=defToBase(def, customScene); const g=base.group; const xf=def.xf;
    applyStaticHandRest(g, !!(def && def.animal)); // 런처 미리보기 캐릭터에 팔 높이 반영(동물은 전용 값)
    g.position.set(0, clampCharY(xf&&xf.y), CHAR_Z);   // 🧍 높이 적용 · 🚫 앞뒤(xf.z) 폐기
    g.scale.setScalar((xf&&xf.s)||1);
    g.rotation.y=RIG_TURN+((xf&&xf.rot)||0);
    g.updateWorldMatrix(true,true);
    // 커미션 모델은 자신의 X값을 무시하고 원본(기본 캐릭터) 기준 중앙 정렬 유지
    if (!(def && def.isCommission)) {
      const bb=new THREE.Box3().setFromObject(g), c=bb.getCenter(new THREE.Vector3()); 
      g.position.x-=c.x; 
    }
    lScene.add(g); lChar=base;
    // ★ 실측 프레이밍 — 발바닥을 y=0 에 두고 키 · z 를 저장(sizeLauncherPreview 가 카메라를 역산).
    //   프레임 높이는 «몸(파츠 제외)» 박스로 잰다 — 파츠까지 넣으면 파츠가 튈 때 캐릭터가 통째로 작아진다.
    {
      g.updateWorldMatrix(true,true);
      const bbM=_lcBodyBox(g);
      lFrameH = Math.max(0.2, bbM.max.y-bbM.min.y);
      lCharBaseY = g.position.y - bbM.min.y;   // 발바닥 = y 0
      g.position.y = lCharBaseY;
      // 좌우도 몸 박스 중심으로 정렬 — 모델마다 x 피봇이 달라서 슬롯 바꾸면 옆으로 밀려 보이는 문제 방지
      g.position.x -= (bbM.min.x + bbM.max.x) / 2;
      lFrameZ = g.position.z;
      lScaleHint = lFrameH/1.2;   // 둥둥 진폭 비례용
    }
    sizeLauncherPreview();
    extractBonesInto(base, base.root);   // 꾸미기 파츠를 붙일 본(부착점) 정보 채워넣기
    base.charDef = def;   // applyPartXf가 파츠별 위치/크기(xf)를 찾을 때 필요
    if(!def.equippedParts) _lcThumbArm(def);   // 🖼️ 파츠가 없으면 지금부터 잰다(있으면 장착이 끝난 뒤)
    if(def.equippedParts){
      // 파츠 GLB 는 Storage 에서 받아오느라 늦다 — 다 붙은 뒤 몸 기준으로 다시 맞춘다.
      (async()=>{
        await applyEquippedPartsToSeat(base, def);
        // 모자 등 파츠가 붙어도 "몸" 기준 프레임은 그대로 — 파츠 위치와 무관하게 크기 고정.
        try{
          base.group.updateWorldMatrix(true,true);
          const bb2=_lcBodyBox(base.group);
          lFrameH = Math.max(0.2, bb2.max.y-bb2.min.y);
          lCharBaseY = base.group.position.y - bb2.min.y;
          base.group.position.y = lCharBaseY;
          base.group.position.x -= (bb2.min.x + bb2.max.x) / 2;   // 몸 기준 좌우 재정렬
          lScaleHint = lFrameH/1.2;
          sizeLauncherPreview();
        }catch(e){}
        if(lChar === base) _lcThumbArm(def);   // 🖼️ 파츠까지 붙은 뒤에 찍는다
      })();
    }
    (async()=>{
      if(def.customItems){ for(const id in def.customItems){ if(!customItems()[id]){ const c=def.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod().parseGlbFull(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc,'',animations);}catch(e){} } } }
      if(def.deskGlb&&lHolder){ try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(def.deskGlb)); lHolder.desk.userData.deskScale=def.deskScale||1; swapDeskVisual(lHolder.desk,sc); setDeskScale(lHolder.desk, def.deskScale||1, def.deskLenX||1); if(def.deskColor)applyDeskColorToCustom(lHolder.desk,def.deskColor);}catch(e){} }
      if(lHolder) clearHolderDeskItems(lHolder);
      if(def.deskItems&&lHolder) applyDeskItemsTo(lHolder,def.deskItems);
    })();
  };

  if(def.commGlb){
    const cached = commSceneCache.get(def.commGlb);
    if(cached) applyBase(cached);
    else getCommissionScene(def.commGlb).then(sc=>applyBase(sc)).catch(e=>applyBase(null));
  } else {
    applyBase(null);
  }
}
function launcherLoop(){
  const vis=document.getElementById('launcher').classList.contains('on');
  if(vis&&lRenderer){
    if(lChar){lBlinkT+=16;
      if(!lBlinkOn&&lBlinkT>2600){lBlinkOn=true;lBlinkT=0;setFaceMap(lChar.faceMat, lChar.bT);}
      else if(lBlinkOn&&lBlinkT>150){lBlinkOn=false;lBlinkT=0;setFaceMap(lChar.faceMat, lChar.fT);}
      // ★ 실측 바운딩박스로 정렬한 기준 y(lCharBaseY) + 스케일 비례 둥둥 —
      //   모든 크기의 캐릭터가 프레임 가운데 같은 자리에 서고, 출렁임도 비례함.
      const dY=Math.max(0.2, lScaleHint||1);
      lChar.group.position.y=lCharBaseY+Math.sin(performance.now()*0.0016)*0.015*dY;}
    lRenderer.render(lScene,lCam);
    if(_lcThumbJob && lChar && !lBlinkOn && performance.now() >= _lcThumbJob.readyAt) _lcThumbTake();}   // 🖼️ 같은 틱에서
  requestAnimationFrame(launcherLoop);}

return {
  ensureLauncherPreview,
  lHolder: ()=>lHolder,   // 읽는 함수
  lRenderer: ()=>lRenderer,   // 읽는 함수
  launcherLoop,
  setLauncherChar,
  sizeLauncherPreview,
};
}

const api = { createLauncherPreview };
if(typeof window !== 'undefined') window.TwLauncherPreview = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
