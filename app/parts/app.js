/* ============================================================ SETUP */
const canvas=document.getElementById('scene');
// ★ antialias는 항상 켜둠. 예전엔 초기 로드 시점 localStorage의 도트렌더 값(tw.dotRender)을 보고
//   antialias:!initDot 로 결정했는데, WebGL 컨텍스트 특성상 이건 생성 후엔 못 바꿈. 문제는 개발용 실행과
//   패키징된 exe가 같은 사용자 데이터(localStorage)를 공유해서, 예전에 도트렌더를 켰던 적이 있으면
//   새로 설치한 앱도 "처음 실행"인데 도트렌더가 켜진 걸로 읽혀서 antialias가 꺼진 채로 굳어버리는 버그가 있었음
//   (설정에서 도트렌더를 껐다 켜도 해상도만 높아질 뿐 이미 생성된 렌더러의 antialias는 안 바뀜 — 눈속임이었음).
//   도트 느낌은 실행 중 해상도 축소(DOT_RENDER_SCALE)+텍스처 필터 전환만으로 충분히 나서, antialias는 고정해도 무방.
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,premultipliedAlpha:false,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000, 0);   // 항상 투명 배경으로 클리어 (Electron 투명창 흰 화면 예방)
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,0.1,100);   // 생성기와 동일한 원근 렌즈 (WYSIWYG)

// 생성기 미리보기와 톤 일치 — LIGHT_PRESET(b=0.8, h=0.09, e=0.4) 적용
const _MAIN_LIGHT_COL = new THREE.Color().setHSL(0.09, 0.45, 0.85);
const _MAIN_LIGHT_INT = 1.2 * 0.5;   // b × e (LIGHT_PRESET과 동기화)
scene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
const key=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT);
key.position.set(0,5,0); key.castShadow=true; key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=1; key.shadow.camera.far=30;
key.shadow.camera.left=-22; key.shadow.camera.right=22; key.shadow.camera.top=8; key.shadow.camera.bottom=-8;
key.shadow.bias=-0.0003; key.shadow.normalBias=0.03; scene.add(key);
const fill=new THREE.DirectionalLight(0xbcd0ff,0.12); fill.position.set(-3,2,-1); scene.add(fill);

const M=(c,r=0.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const matSage=M(0x9dba8a,0.8),matSageD=M(0x84a172,0.8),matInk=M(0x4a3f35,0.6),matWhite=M(0xfdfaf2,0.7),
      matWood=M(0xc9a57b,0.85),matWoodD=M(0xb08a5e,0.85),matPot=M(0xd98e73,0.8),matLeaf=M(0x88b06f,0.7),matBlush=M(0xe89b9b,0.6);

const CHAR_Z=-0.47;                 // 캐릭터 기본 앞뒤 위치 (책상과의 간격을 살짝 좁힘)
const FLOOR_DEFAULT='#cdb88f';
const floorMat=M(0xcdb88f,0.95);
// 바닥은 밝은 조명에서 흰색으로 날아가기 쉬워서, 알베도를 낮춰 "고른 색이 그대로 보이게" 함(클리핑 방지)
// (사용자가 바닥색 기능을 제거함 — 함수는 더 이상 사용 안 됨)
// 받침대(바닥)를 콘텐츠 크기에 맞춰 작게 — 네 모서리가 보이도록
function sizeFloorTo(mesh,cx,cz,sx,sz){ if(!mesh)return; const w=Math.max(sx+0.6, 1.0), d=Math.max(sz+0.5,1.5); mesh.scale.set(w,0.125,d); mesh.position.set(cx,0,cz); }
const floorGeo = new THREE.BoxGeometry(1, 1, 1);
floorGeo.translate(0, -0.5, 0); // 윗면 중앙을 피벗으로 설정
// 바닥의 색상(floorMat)을 지우고, 그림자만 남기는 ShadowMaterial을 사용합니다.
const shadowMat = new THREE.ShadowMaterial();
shadowMat.opacity = 0.3; // 여기서 0.3 숫자를 조절해서 그림자 진하기를 바꾸세요.
const floor = new THREE.Mesh(floorGeo, shadowMat);
floor.scale.set(2.4, 0.125, 2.2);
floor.position.set(0, 0, 0.0);
floor.receiveShadow = true;
floor.castShadow = false;
scene.add(floor);

/* ============================================================ DRACO */
const loader=new THREE.GLTFLoader();
try{const draco=new THREE.DRACOLoader();draco.setDecoderPath('vendor/draco/');loader.setDRACOLoader(draco);}catch(e){console.warn('DRACO init',e);}

/* ===== 기본 캐릭터 GLB (임베드) — face/cloth_upper/cloth_lower + 리깅 ===== */
let BASE_SCENE=null, BASE_ANIMS=[];
function b64ToBuf(b64){const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
function loadBaseGLB(){return new Promise(res=>{
  if(!window.BASE_GLB_B64||window.BASE_GLB_B64.indexOf('@@')===0){res(false);return;}
  loader.parse(b64ToBuf(window.BASE_GLB_B64),'',gltf=>{
    BASE_SCENE=gltf.scene; BASE_ANIMS=gltf.animations||[];
    BASE_SCENE.traverse(o=>{if(o.isMesh){o.frustumCulled=false;
      const m=o.material,nm=(m&&m.name||'').toLowerCase();
      // 피부 1번(skin0)은 skin-data.js의 face1.png를 쓰므로 GLB 원본 텍스처로 덮어쓰지 않음
      }});
    measureBaseGeometry();   // 기본 시각 영역 측정 — 커미션 GLB 자동 매칭 기준값
    res(true);
  }, e=>{console.warn('base GLB parse fail',e);res(false);});
});}
/* 스킨드 메시 인스턴스 복제 (각 캐릭터가 독립 스켈레톤+머티리얼) */
function instantiateBase(customScene){
  const src = customScene || BASE_SCENE;
  if(!src||!THREE.SkeletonUtils)return null;
  const root=THREE.SkeletonUtils.clone(src);
  let faceMat=null,upMat=null,loMat=null,faceMesh=null,upMesh=null,loMesh=null;
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;
    const cm=o.material&&o.material.clone?o.material.clone():o.material; o.material=cm;
      const nm=(cm&&cm.name||'').toLowerCase();
      const meshName=(o.name||'').toLowerCase();
      // 텍스처(머티리얼 이름)가 없어도, 메쉬 이름이 'head'면 생성창 스킨 타겟으로 잡습니다.
      if(nm.includes('face') || meshName.includes('head')){faceMat=cm;faceMesh=o;}
    else if(nm.includes('upper')||nm.includes('up_cloth')||nm.includes('up_clothes')){upMat=cm;upMesh=o;}
    else if(nm.includes('lower')||nm.includes('low_cloth')||nm.includes('low_clothes')){loMat=cm;loMesh=o;} }});
  return {root,faceMat,upMat,loMat,faceMesh,upMesh,loMesh};
}
/* 커미션 GLB 파싱 캐시: base64 → THREE.Scene */
const commSceneCache = new Map();
async function getCommissionScene(glbB64){
  if(commSceneCache.has(glbB64)) return commSceneCache.get(glbB64);
  const buf = b64ToBuf(glbB64);
  const scene = await parseGlbBytes(buf);
  commSceneCache.set(glbB64, scene);
  return scene;
}
function mkFaceTex(canvas){const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.encoding=THREE.sRGBEncoding;t.needsUpdate=true;return t;}
function normalizeModel(group,targetH,isComm){
  group.updateMatrixWorld(true);
  
  // 기본 캐릭터용 원본 계산
  const box=new THREE.Box3().setFromObject(group);
  const size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  let s=targetH/(size.y||1);
  let posX = -c.x*s, posY = -box.min.y*s, posZ = -c.z*s;

  // 표준 리그 통합: 커미션도 base와 동일하게 자기 박스 기준(BASE_SCENE 덮어쓰기 제거)
  
  group.scale.setScalar(s);
  group.position.set(posX, posY, posZ);
  return s;
}
/* ============================================================ BUILDERS */
const TORSO_Y=0.46;
function buildDeskPlant(){ const g=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.075,0.13,16),matPot); pot.position.y=0.065; pot.castShadow=true; g.add(pot);
  for(let i=0;i<3;i++){const lf=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,12),matLeaf);
    lf.scale.set(0.7,1.4,0.7); lf.position.set(Math.cos(i/3*6.28)*0.04,0.18,Math.sin(i/3*6.28)*0.04);
    lf.rotation.z=(i-1)*0.3; lf.castShadow=true; g.add(lf);} return g; }
function buildCup(){ const g=new THREE.Group();
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.11,18),matPot); cup.position.y=0.055; cup.castShadow=true; g.add(cup);
  const h=new THREE.Mesh(new THREE.TorusGeometry(0.035,0.013,8,16),matPot); h.position.set(0.07,0.06,0); h.rotation.y=Math.PI/2; g.add(h); return g; }
function buildBooks(){ const g=new THREE.Group(); const cols=[matSage,matBlush,matWoodD];
  for(let i=0;i<3;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.22-i*0.02,0.04,0.16),cols[i%cols.length]);
    b.position.set(0,0.02+i*0.045,0); b.rotation.y=(i-1)*0.12; b.castShadow=true; g.add(b);} return g; }
const DESK_ITEMS=[{id:'plant',name:'화분',build:buildDeskPlant},{id:'cup',name:'머그컵',build:buildCup},{id:'books',name:'책',build:buildBooks}];
function buildDesk(plain){
  const desk=new THREE.Group(); const deskTopY=0.46,deskZ=0.50;
  const topM=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.08,0.6),matWood);
  topM.position.set(0,deskTopY-0.04,deskZ); topM.castShadow=topM.receiveShadow=true; topM.name='deskTop'; desk.add(topM);
  [[-0.72,0.32],[0.72,0.32],[-0.72,0.88],[0.72,0.88]].forEach(([x,z])=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.09,deskTopY-0.04,0.09),matWoodD);
    leg.position.set(x,(deskTopY-0.04)/2,z); leg.castShadow=true; desk.add(leg);});
  if(!plain){ const prop=buildDeskPlant(); prop.position.set(0.5,deskTopY,deskZ-0.06); desk.add(prop); }
  const anchor=new THREE.Group(); anchor.position.set(0,deskTopY,deskZ); anchor.name='deskAnchor'; desk.add(anchor);
  desk.userData.deskAnchor=anchor; return desk;
}
/* 책상 위 소품(아이템) 시스템 — holder = 좌석 또는 생성기 미리보기 */
function applyDeskAdj(p){ const a=p.userData.adj; p.position.set(a.x||0,0,a.z||0); p.rotation.set(0,a.rot||0,0); p.scale.setScalar(a.scale||1); }
function equipDeskItem(holder,def,on){
  if(!holder.deskItems)holder.deskItems={};
  const cur=holder.deskItems[def.id];
  if(cur){ if(cur.parent)cur.parent.remove(cur); holder.deskItems[def.id]=null; if(holder.activeDeskItem===cur)holder.activeDeskItem=null; }
  if(on && holder.deskAnchor){ const obj=def.build(); const pivot=new THREE.Group(); holder.deskAnchor.add(pivot); pivot.add(obj);
    pivot.userData.adj={x:0,z:0,scale:1,rot:0}; holder.deskItems[def.id]=pivot; holder.activeDeskItem=pivot; applyDeskAdj(pivot); }
}
function collectDeskItems(holder){ const d={}; let any=false; allDeskItems().forEach(def=>{ const p=holder.deskItems&&holder.deskItems[def.id]; if(p){d[def.id]={adj:Object.assign({},p.userData.adj)};any=true;} }); return any?d:null; }
function applyDeskItemsTo(holder,data){ if(!data||!holder.deskAnchor)return; Object.keys(data).forEach(id=>{ const def=deskItemDef(id); if(!def)return; const e=data[id]; equipDeskItem(holder,def,true); const p=holder.deskItems[id]; if(p&&e.adj){Object.assign(p.userData.adj,e.adj);applyDeskAdj(p);} }); }
function buildPlaceholder(){
  const root=new THREE.Group();
  const torso=new THREE.Group(); torso.position.y=TORSO_Y; root.add(torso);
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.42,32,32),matSage); body.scale.set(1,1.1,0.9); body.castShadow=true; torso.add(body);
  const head=new THREE.Group(); head.position.set(0,0.62,0); torso.add(head);
  const hm=new THREE.Mesh(new THREE.SphereGeometry(0.4,32,32),matSage); hm.castShadow=true; head.add(hm);
  function eye(x){const g=new THREE.Group();
    const w=new THREE.Mesh(new THREE.SphereGeometry(0.085,16,16),matWhite); w.scale.set(1,1.15,0.6);
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.05,16,16),matInk); p.position.z=0.05; p.scale.set(1,1.1,0.6);
    g.add(w);g.add(p); g.position.set(x,0.05,0.34); return g;}
  const eyeL=eye(-0.15),eyeR=eye(0.15); head.add(eyeL);head.add(eyeR);
  function cheek(x){const c=new THREE.Mesh(new THREE.SphereGeometry(0.055,16,16),matBlush); c.scale.set(1.3,0.8,0.4); c.position.set(x,-0.08,0.33); return c;}
  head.add(cheek(-0.22));head.add(cheek(0.22));
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(0.03,12,12),matInk); mouth.scale.set(1.6,0.7,0.5); mouth.position.set(0,-0.12,0.37); head.add(mouth);
  [[-0.16,-0.4],[0.16,0.4]].forEach(([x,rot])=>{const l=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16),matSageD);
    l.scale.set(0.6,1.3,0.5); l.position.set(x,0.4,0); l.rotation.z=rot; l.castShadow=true; head.add(l);});
  function arm(x){const a=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16),matSage); a.scale.set(0.7,0.7,1.1); a.position.set(x,0.10,0.22); a.castShadow=true; return a;}
  const armL=arm(-0.38),armR=arm(0.38); torso.add(armL);torso.add(armR);
  return {root,torso,head,eyeL,eyeR,armL,armR};
}

/* ============================================================ SEATS */
const seats=[]; let selected=null; const SPACING=1.66;   // 책상 폭(1.7)에 맞춰 딱 붙게
const _shadowTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const grd=g.createRadialGradient(64,64,3,64,64,62); grd.addColorStop(0,'rgba(45,35,25,0.30)'); grd.addColorStop(0.6,'rgba(45,35,25,0.14)'); grd.addColorStop(1,'rgba(45,35,25,0)');
  g.fillStyle=grd; g.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t; })();
function buildContactShadow(){ const m=new THREE.Mesh(new THREE.PlaneGeometry(1.05,0.62), new THREE.MeshBasicMaterial({map:_shadowTex,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(0,0.012,CHAR_Z); m.renderOrder=-1; m.name='contactShadow'; return m; }
function createSeat(){
  const group=new THREE.Group();
  const desk=buildDesk(true); group.add(desk);
  const _dt=desk.getObjectByName('deskTop'); let deskMat=null; if(_dt){ _dt.material=_dt.material.clone(); deskMat=_dt.material; }
  const rig=new THREE.Group(); rig.position.set(0,0,CHAR_Z);
  const bodyWrap=new THREE.Group(); rig.add(bodyWrap); group.add(rig);
  const ph=buildPlaceholder(); bodyWrap.add(ph.root);
  const contactShadow=buildContactShadow(); group.add(contactShadow);
  const seat={
    group,desk,deskMat,deskGltf:null,rig,bodyWrap,placeholder:ph,contactShadow,
    isPlaceholder:true,gltfRoot:null,mixer:null,actions:{},current:null,
    faceMat:null,faceMapOrig:null,blinkTex:null,
    userScale:1,userY:0,userZ:0,userRot:Math.PI,userX:0,
    petStart:-1e9,targetX:0,
    pose:{leanX:0,turnY:0,slumpY:0,breSpd:2,breAmp:0.025,eyeOpen:1,arm:0},
    breathePhase:Math.random()*6.28, swayPhase:Math.random()*6.28, headPhase:Math.random()*6.28,
    smooth:0.0016+Math.random()*0.0012,
    bones:{spine:null,head:null,handL:null,handR:null,legL:null,legR:null}, boneRest:{}, hasRig:false,
    blink:{pulses:[],nextAt:performance.now()+800+Math.random()*2200,singles:2+Math.floor(Math.random()*2),closed:false},
  };
  group.userData.seat=seat;
  seat.deskAnchor=desk.userData.deskAnchor; seat.deskItems={}; seat.activeDeskItem=null;
  seat.headAnchor=new THREE.Group(); seat.bodyAnchor=new THREE.Group();
  bodyWrap.add(seat.headAnchor); bodyWrap.add(seat.bodyAnchor);
  seat.headAnchor.position.set(0,1.08,0); seat.bodyAnchor.position.set(0,0.46,0);
  seat.equipped={hair:null,accessory:null,clothes:null}; seat.equippedId={hair:null,accessory:null,clothes:null};
  scene.add(group); seats.push(seat); layoutSeats(); return seat;
}
function removeSeat(seat){
  const i=seats.indexOf(seat); if(i<0||seats.length<=1) return;
  scene.remove(seat.group); seats.splice(i,1);
  if(selected===seat) selectSeat(seats[Math.max(0,i-1)]);
  layoutSeats(); renderSeatTabs();
}
let sizeFactor=1;
const BASE_PXW=190;          // 월드 1단위당 픽셀(캐릭터 크기 기준)
/* 데스크톱 run 모드에서 사용자가 상태칩을 끌어 옮긴 만큼의 캐릭터 위치 오프셋 (뷰 비율 단위, 0~1 근사) */
let deskPanX=0, deskPanY=0;   // "프로그램 이동"으로 사용자가 옮긴 위치 — 뷰 비율(fraction) 기준, 크기 변경에도 안 틀어짐
let _deskViewH=0, _deskCanvasH=1;   // 이동 중 픽셀↔월드 정확한 변환을 위해 layoutSeats가 매 프레임 갱신
/* 설정 패널의 "캐릭터 크기" 슬라이더 값 — 데스크톱 run 모드 전용 배율 (세션 한정) */
let focusCharScale=1;
let dotRenderEnabled = (localStorage.getItem('tw.dotRender')==='1');   // 기본 꺼짐
const DOT_RENDER_SCALE = 0.55;   // 저해상도(도트) 렌더 배율 — 작을수록 더 거칠고 선명한 도트
function layoutSeats(){
  const n=seats.length;
  seats.forEach((s,i)=>{ s.targetX = -i*SPACING; });        // 0번(메인) 오른쪽 고정, 추가될수록 왼쪽
  const rowCenter = -((n-1)*SPACING)/2;
  
  // 카메라가 바라보는 중심(c.y)을 살짝 낮춰서 바닥이 화면 중앙에 오도록 유도
  const c = new THREE.Vector3(rowCenter, 0.5, 0); 
  const sz = new THREE.Vector3(Math.max(1.2, n * SPACING), 1.4, 0.8);
  
// sizeFloorTo(floor, rowCenter, c.z, sz.x * 0.7, sz.z);     // 0.7은 원래 크기의 70%로 줄인다는 뜻입니다.
  
  // 화면 상하좌우 여백(Padding)을 대폭 늘려서 카메라가 뒤로 물러나게 줌아웃
  const _deskRun = document.body.classList.contains('desktop') && document.body.classList.contains('runmode');
  const contentW = sz.x + 0.6;
  const contentH = Math.max(sz.y, 1.3) + 0.5;

  const PXW=BASE_PXW*sizeFactor;
  let canvasH, canvasW;
  if(_deskRun){
    // 데스크톱 실행: 캔버스를 화면 전체로 → 캐릭터를 흔들거나 화면 어디로 드래그해도 안 잘림 (시메지처럼).
    canvasW = innerWidth;
    canvasH = innerHeight;
    // 설정에서 "저해상도(도트) 렌더"를 켰으면 pixelRatio를 낮춰 도트 느낌 (성능도 가벼워짐)
    const wantPR = dotRenderEnabled ? 1 : Math.min(devicePixelRatio,2);
    if(renderer.getPixelRatio() !== wantPR) renderer.setPixelRatio(wantPR);
    canvas.style.imageRendering = dotRenderEnabled ? 'pixelated' : 'auto';
  } else {
    canvasH=Math.min(Math.round(contentH*PXW), innerHeight-40);
    canvasW=Math.min(Math.round(contentW*PXW), innerWidth-36);
  }
  const aspect=canvasW/canvasH;

  const fov=34*Math.PI/180;
  let dist;
  if(_deskRun){
    // 전체화면 캔버스에서도 캐릭터 크기를 이전(작은 캔버스)과 비슷하게 유지: 캔버스가 커진 배율만큼 카메라를 뒤로.
    const prevCanvasH = Math.min(Math.round(contentH*PXW), innerHeight-40);
    const zoomOut = canvasH / Math.max(1, prevCanvasH);
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=(Math.max(distV,distH)+sz.z*0.45) * zoomOut / Math.max(0.1,focusCharScale);
  } else {
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=Math.max(distV,distH)+sz.z*0.45;
  }
  
  // [수정] 카메라 각도 설정
  const pitch = 0.13; // 상하 각도 (살짝 내려다봄)
  const yaw = 5 * Math.PI / 180; // 좌우 각도 (우측으로 15도)
  
  camera.aspect=aspect;
  camera.position.set(
    c.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    c.y + Math.sin(pitch) * dist,
    c.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  let tx=c.x, ty=c.y, tz=c.z;
  if(_deskRun){
    // 캐릭터를 화면 좌측 하단 근처에 오게(기본 오프셋) + 사용자가 "프로그램 이동"으로 옮긴 만큼(deskPanX/Y, 월드 단위) 추가 이동.
    // deskPanX/Y는 이제 "뷰 비율"이 아니라 "월드 단위 절대값"이라 어떤 캔버스 크기에서도 정확히 마우스와 1:1로 맞음.
    const viewH = 2 * dist * Math.tan(fov/2);
    const viewW = viewH * aspect;
    // deskPanX/Y는 "뷰 비율"(unitless fraction) — 캐릭터 크기(focusCharScale)가 바뀌어도 항상 같은 화면 비율 위치 유지.
    const baseX = viewW * (-0.34 + deskPanX);   // 기본: 좌측 + 사용자 오프셋(비율)
    const baseY = viewH * (0.28 + deskPanY);    // 기본: 하단 + 사용자 오프셋(비율)
    const panX = baseX;
    const panY = baseY;
    const camPanX = panX * Math.cos(yaw);
    tx += camPanX; camera.position.x += camPanX;
    tz -= panX * Math.sin(yaw); camera.position.z -= panX * Math.sin(yaw);
    ty += panY; camera.position.y += panY;
    // 이동 모드에서 픽셀↔월드 정확한 변환을 위해 매 프레임 계산값을 전역에 노출
    _deskViewH = viewH; _deskCanvasH = canvasH;
  }
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
  
  canvas.style.width=canvasW+'px'; canvas.style.height=canvasH+'px';
  if(_deskRun && dotRenderEnabled){
    // 실제 렌더 버퍼 해상도를 낮춰서 확실한 도트감(CSS 표시 크기는 그대로 유지, image-rendering:pixelated로 확대)
    const rw=Math.max(2,Math.round(canvasW*DOT_RENDER_SCALE)), rh=Math.max(2,Math.round(canvasH*DOT_RENDER_SCALE));
    renderer.setSize(rw, rh, false);
    canvas.style.width=canvasW+'px'; canvas.style.height=canvasH+'px';   // setSize(false)가 style도 rw/rh로 바꿔버리니 다시 덮어씀
    applyDotTextureFilter(true);    // 텍스처 보간을 꺼서 확실히 각진 도트로 (뿌옇게 안 보이게)
  } else {
    renderer.setSize(canvasW, canvasH, false);
    if(_deskRun) applyDotTextureFilter(false);
  }
}
/* 도트 렌더 모드일 때 씬의 모든 텍스처를 Nearest 필터로 전환(선명한 도트), 끄면 원래(Linear+mipmap)로 복구.
   매 프레임 호출 안 하고 모드 전환 시 1회만 — _dotFilterState로 중복 적용 방지. */
let _dotFilterState = null;
function applyDotTextureFilter(on){
  if(_dotFilterState === on) return;
  _dotFilterState = on;
  scene.traverse(o=>{
    if(o.isMesh && o.material){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m=>{
        if(!m) return;
        ['map','emissiveMap','normalMap','roughnessMap','metalnessMap'].forEach(key=>{
          const tex = m[key];
          if(tex){
            if(on){
              if(tex.userData._origMinFilter===undefined){ tex.userData._origMinFilter=tex.minFilter; tex.userData._origMagFilter=tex.magFilter; }
              tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
            } else if(tex.userData._origMinFilter!==undefined){
              tex.minFilter = tex.userData._origMinFilter; tex.magFilter = tex.userData._origMagFilter; tex.needsUpdate = true;
            }
          }
        });
      });
    }
  });
}

/* ============================================================ FIT */
function fitModel(seat){
  const m=seat.gltfRoot; if(!m) return;
  m.scale.set(1,1,1); m.position.set(0,0,0); m.rotation.set(0,seat.userRot+RIG_TURN,0);
  const sR=seat.rig.position.clone(),sRr=seat.rig.rotation.clone(),sWp=seat.bodyWrap.position.clone(),sG=seat.group.position.clone();
  seat.rig.position.set(0,0,0);seat.rig.rotation.set(0,0,0);seat.bodyWrap.scale.set(1,1,1);seat.bodyWrap.position.set(0,0,0);seat.group.position.set(0,0,0);
  seat.group.updateWorldMatrix(true,true);
  
  const box=new THREE.Box3().setFromObject(m);   // 표준 리그 통합: base·커미션 동일 경로
  if(!box.isEmpty()){
    const size=new THREE.Vector3(); box.getSize(size);
    const baseScale=size.y>1e-4?1.45/size.y:1; m.scale.setScalar(baseScale);   // 생성기 미리보기와 동일한 정규화 키
    seat.group.updateWorldMatrix(true,true);
    
    // 표준 리그 통합: 모델 자기 박스로 센터링 (BASE_SCENE 보정·진단로그·z-fix 제거)
    const b2=new THREE.Box3().setFromObject(m); const c=new THREE.Vector3(); b2.getCenter(c);
    m.position.x-=c.x;
    m.position.z-=c.z;
    // 바운딩 박스(min.y) 대신, 블렌더에서 설정한 피봇(발바닥) 원점을 그대로 사용합니다.
    m.position.y = 0; 
    
    m.position.x+=(seat.userX||0);
  m.position.z+=(seat.userZ||0);
  // 기존 0.15에서 0.02로 낮춰 바닥에 더 붙입니다. (더 내리려면 숫자를 줄이거나 0으로 만드세요)
  m.position.y+=-0.05; 
}
  seat.rig.position.copy(sR);seat.rig.rotation.copy(sRr);
  seat.bodyWrap.scale.setScalar(seat.userScale);
  seat.bodyWrap.position.copy(sWp);seat.group.position.copy(sG);
  if(seat.contactShadow){ const sc=Math.max(0.5,seat.userScale); seat.contactShadow.scale.setScalar(sc); seat.contactShadow.position.x=(seat.userX||0); seat.contactShadow.position.z=CHAR_Z+(seat.userZ||0); }
}
function fitDesk(seat){
  const d=seat.deskGltf; if(!d) return;
  d.scale.set(1,1,1); d.position.set(0,0,0);
  const sG=seat.group.position.clone(); seat.group.position.set(0,0,0); seat.group.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(d);
  if(!box.isEmpty()){
    const size=new THREE.Vector3(); box.getSize(size);
    const s=size.y>1e-4?0.6/size.y:1; d.scale.set(s,s,s);
    seat.group.updateWorldMatrix(true,true);
    const b2=new THREE.Box3().setFromObject(d); const c=new THREE.Vector3(); b2.getCenter(c);
    d.position.x-=c.x; d.position.z-=c.z; d.position.y-=b2.min.y; d.position.z+=0.45;
  }
  seat.group.position.copy(sG);
}

/* ============================================================ FILE LOADING */
const STATE_KW={idle:['idle','rest','breathe','default'],focus:['focus','type','work','active','study'],
  pet:['pet','happy','pat','love'],sleep:['sleep','sleepy','doze','nap','tired']};
function pickClip(clips,st){const ks=STATE_KW[st]||[st]; for(const c of clips){const n=c.name.toLowerCase(); if(ks.some(k=>n.includes(k)))return c;} return null;}

function setupSeatModel(seat,m,animations,name){
  if(seat.gltfRoot) seat.bodyWrap.remove(seat.gltfRoot);
  seat.placeholder.root.visible=false;
  m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
  const wrap = new THREE.Group(); // 애니메이션 위치 덮어쓰기 방지용 보호 그룹
  wrap.add(m);
  seat.bodyWrap.add(wrap); seat.gltfRoot=wrap; seat.isPlaceholder=false;
  seat.userScale=1; seat.userY=0; seat.userZ=0; seat.userRot=Math.PI; seat.userX=0;   // 자동 중앙정렬 + 바닥맞춤 기본값
  if(selected===seat){ document.getElementById('sScale').value=1; document.getElementById('sY').value=0;
    document.getElementById('sZ').value=0; document.getElementById('sRot').value=Math.PI; }
  fitModel(seat);
  const topY=1.2*seat.userScale; seat.headAnchor.position.set(0,topY*0.82,0); seat.bodyAnchor.position.set(0,topY*0.5,0);
  seat.actions={}; seat.current=null;
  if(animations&&animations.length){
    seat.mixer=new THREE.AnimationMixer(m);
    ['idle','pet','focus','sleep'].forEach(st=>{
      const clip=pickClip(animations,st)||pickClip(animations,'idle')||animations[0];
      if(clip) seat.actions[st]=seat.mixer.clipAction(clip);});
            
          // 💡 [파묻힘 방지] 애니메이션 1프레임을 미리 실행하여 굽힌 다리 높이를 계산에 반영합니다.
          if(seat.actions.idle) {
              seat.actions.idle.play();
              seat.mixer.update(0.1); 
          }
        } else seat.mixer=null;
        
        // 애니메이션이 적용된(무릎을 굽힌) 상태에서 바닥 높이를 다시 완벽하게 맞춥니다.
        fitModel(seat);
  if(!seat.faceMat){ seat.faceMapOrig=null;
    m.traverse(o=>{if(o.isMesh){
      const meshName=(o.name||'').toLowerCase();
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(mt=>{
        if(mt && (mt.name.toLowerCase().includes('face') || meshName.includes('head')) && !seat.faceMat){
          seat.faceMat=mt; seat.faceMapOrig=mt.map||null;
        }
      });
    }}); 
  }
  if(seat.blinkTex&&seat.faceMat) prepBlink(seat);
  // 본 감지 (리깅 기반 절차적 애니메이션 — 클립이 없을 때만 사용)
  seat.bones={spine:null,head:null,handL:null,handR:null,legL:null,legR:null}; seat.boneRest={};
  m.traverse(o=>{ if(o.isBone){ const n=o.name.toLowerCase();
    if(!seat.bones.spine&&(n.includes('spine')||n.includes('chest')||n.includes('torso')))seat.bones.spine=o;
    if(!seat.bones.head&&n.includes('head'))seat.bones.head=o;
    if(n.includes('hand')||n.includes('arm')){const s=boneSide(n);
      if(s==='l'&&!seat.bones.handL)seat.bones.handL=o; if(s==='r'&&!seat.bones.handR)seat.bones.handR=o;}
    if(n.includes('leg')||n.includes('thigh')){const s=boneSide(n);
      if(s==='l'&&!seat.bones.legL)seat.bones.legL=o; if(s==='r'&&!seat.bones.legR)seat.bones.legR=o;} }});
  for(const kk in seat.bones){ if(seat.bones[kk]) seat.boneRest[kk]=seat.bones[kk].quaternion.clone(); }
  seat.hasRig=!!(seat.bones.spine||seat.bones.head||seat.bones.handL||seat.bones.handR);
  seat.equippedPartObjs = seat.equippedPartObjs || {};   // {cat: Object3D} — 부착된 파츠 인스턴스 추적
  let mc=0; m.traverse(o=>{if(o.isMesh)mc++;});
  const cl=(animations||[]).map(a=>a.name).join(', ')||'없음';
  if(mc===0) setInfo(seat,`⚠️ <b>${name}</b> 메시 0개 — Blender에서 메시 선택/압축 해제 확인.`);
  else { const rb=Object.keys(seat.bones).filter(k=>seat.bones[k]).join(', ')||'없음';
    setInfo(seat,`<b>${name}</b> · 메시 ${mc} · 클립: ${cl}<br>Face: ${seat.faceMat?'✓':'없음'} · 눈감음: ${seat.blinkTex?'✓':'없음'}<br>리그 본: ${rb}${seat.mixer?' (클립 우선)':seat.hasRig?' (절차적 자동)':''}`); }
  if(selected===seat) sliders.classList.add('on');
  layoutSeats();   // 캐릭터 로드 후 실제 크기로 영역 재계산(바닥맞춤)
}
function loadCharGLB(buf,name,seat){
  loader.parse(buf,'',gltf=>{ seat.faceMat=null; seat.faceMapOrig=null; setupSeatModel(seat,gltf.scene,gltf.animations,name);
  }, err=>{const msg=(err&&err.message)||String(err); console.error('[GLB]',err);
    setInfo(seat, /fetch/i.test(msg)?'⚠️ "Failed to fetch" — HTML을 내려받아 브라우저에서 직접 열고 다시 시도.':('⚠️ 로드 실패: '+msg));});
}
function loadDeskGLB(buf,name,seat){
  loader.parse(buf,'',gltf=>{
    if(seat.deskGltf) seat.group.remove(seat.deskGltf);
    seat.desk.visible=false;
    const d=gltf.scene; d.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    seat.group.add(d); seat.deskGltf=d; fitDesk(seat);
    setInfo(seat,`책상 <b>${name}</b> 로드됨 ✓`);
  }, err=>{console.error('[Desk GLB]',err); setInfo(seat,'⚠️ 책상 GLB 로드 실패');});
}
function setBlinkTexture(url,name,seat){
  new THREE.TextureLoader().load(url,tex=>{seat.blinkTex=tex; prepBlink(seat);
    setInfo(seat, seat.faceMat?`눈감음 텍스처 적용 ✓`:`눈감음 텍스처 준비됨 (Face 머티리얼 GLB 필요)`);});
}
function prepBlink(seat){ if(!seat.blinkTex) return; const o=seat.faceMapOrig;
  if(o){seat.blinkTex.flipY=o.flipY;seat.blinkTex.wrapS=o.wrapS;seat.blinkTex.wrapT=o.wrapT;seat.blinkTex.encoding=o.encoding;}
  else {seat.blinkTex.flipY=false;seat.blinkTex.encoding=THREE.sRGBEncoding;} seat.blinkTex.needsUpdate=true; }
function resetSeat(seat){
  if(seat.gltfRoot){seat.bodyWrap.remove(seat.gltfRoot);seat.gltfRoot=null;}
  if(seat.deskGltf){seat.group.remove(seat.deskGltf);seat.deskGltf=null;seat.desk.visible=true;}
  seat.isPlaceholder=true;seat.mixer=null;seat.actions={};seat.current=null;seat.faceMat=null;seat.blinkTex=null;
  seat.placeholder.root.visible=true; setInfo(seat,'기본 도형 캐릭터. <b>.glb 드롭</b>으로 교체.');
  seat.headAnchor.position.set(0,1.08,0); seat.bodyAnchor.position.set(0,0.46,0);
  if(selected===seat) sliders.classList.remove('on');
}
async function handleFiles(files,seat){
  for(const f of files){const nm=f.name.toLowerCase();
    if(nm.endsWith('.dcc')){ const buf=await f.arrayBuffer(); const pass=window.prompt('이 캐릭터의 비밀번호를 입력하세요'); if(!pass)continue;
      try{ const dec=await decryptBytes(buf,pass); loadCharGLB(dec,f.name.replace(/\.dcc$/i,'')+'.glb',seat); }catch(e){ toast('비밀번호가 틀렸거나 파일이 손상됐어요'); } }
    else if(nm.endsWith('.glb')){ const buf=await f.arrayBuffer();
      if(nm.includes('desk')||nm.includes('책상')) loadDeskGLB(buf,f.name,seat); else loadCharGLB(buf,f.name,seat); }
    else if(f.type.startsWith('image/')){ const url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f);}); setBlinkTexture(url,f.name,seat); }
  }
}

/* ============================================================ UI */
const dot=document.getElementById('dot'),stateLabel=document.getElementById('stateLabel'),autoTag=document.getElementById('autoTag'),
      btnWrap=document.getElementById('btns'),modelInfo=document.getElementById('modelInfo'),sliders=document.getElementById('sliders'),seatsEl=document.getElementById('seats');
function setInfo(seat,html){ if(selected===seat) modelInfo.innerHTML=html; }
function renderSeatTabs(){
  seatsEl.innerHTML='';
  const emo={focus:'⌨️',idle:'🙂',sleep:'💤',pet:'😊'};
  seats.forEach((s,i)=>{const b=document.createElement('button');b.className='seat'+(s===selected?' sel':'')+(s.remote?' friend':'');
    const nm=s.isMe?'나':(s.friendName||('친구'+i)); const st=s.remote?(' '+(emo[s.remoteState]||'')):'';
    b.textContent=nm+st; b.onclick=()=>selectSeat(s); seatsEl.appendChild(b);});
}
function selectSeat(s){ selected=s; renderSeatTabs();
  modelInfo.innerHTML = s.isPlaceholder?'기본 도형 캐릭터. <b>.glb 드롭</b>으로 교체.':'모델 로드됨';
  sliders.classList.toggle('on', !s.isPlaceholder);
  document.getElementById('sScale').value=s.userScale; document.getElementById('sY').value=s.userY;
  document.getElementById('sZ').value=s.userZ; document.getElementById('sRot').value=s.userRot;
}
let manual=null;
function setManual(s){manual=s;[...btnWrap.children].forEach(b=>b.classList.toggle('active',(s===null&&b.dataset.s==='auto')||b.dataset.s===s));
  autoTag.textContent=s===null?'자동':'수동';autoTag.classList.toggle('manual',s!==null);}
btnWrap.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const s=b.dataset.s;
  if(s==='auto'){setManual(null);activity();}else{setManual(s);if(s==='pet')seats.forEach(triggerPet);}});

document.getElementById('glbInput').addEventListener('change',e=>handleFiles(e.target.files,selected));
document.getElementById('deskInput').addEventListener('change',e=>handleFiles(e.target.files,selected));
document.getElementById('texInput').addEventListener('change',e=>handleFiles(e.target.files,selected));
document.getElementById('resetBtn').addEventListener('click',()=>resetSeat(selected));
document.getElementById('sZoom').addEventListener('input',e=>{sizeFactor=+e.target.value;layoutSeats();});
function saveSeatXf(seat){ if(!seat||!seat.charDef)return;
  seat.charDef.xf={s:seat.userScale,y:seat.userY,z:seat.userZ,rot:seat.userRot,x:seat.userX||0};
  if(seat.slot!=null) slots[seat.slot]=seat.charDef;
  saveSlots(); }
document.getElementById('sScale').addEventListener('input',e=>{selected.userScale=+e.target.value;fitModel(selected);saveSeatXf(selected);layoutSeats();});
document.getElementById('sY').addEventListener('input',e=>{selected.userY=+e.target.value;fitModel(selected);saveSeatXf(selected);layoutSeats();});
document.getElementById('sZ').addEventListener('input',e=>{selected.userZ=+e.target.value;fitModel(selected);saveSeatXf(selected);layoutSeats();});
document.getElementById('sRot').addEventListener('input',e=>{selected.userRot=+e.target.value;fitModel(selected);saveSeatXf(selected);});

/* ============================================================ USER STATUS (활동 상태)
   A안 — 자동감지(focus/idle/sleep/pet)는 그대로 유지하고, 이 상태는 별도 축으로 동작:
   · 🍚 meal / 🎮 gaming: 책상 위에 판넬 표시 (본인 좌석만), 머리 위 이모지(모든 좌석)
   · 😶‍🌫️ away: 자동상태 무시하고 sleep 모션 강제 + 캐릭터 opacity 0.30 (영혼)
   · 🔥 grind: idle 상태일 때만 모션 변형(머리 더 숙임/호흡 빠름/미세 흔들)
   본인 변경은 자기 화면 칩으로, 친구에게는 머리 위 이모지로만 보임.
   Phase 7(Firebase) 단계에서 Presence.update에 userStatus 필드를 함께 송수신할 예정. */
const USER_STATUSES = {
  meal:   {emo:'🍚',   label:'밥 먹는 중', dot:'#e89b7d'},
  away:   {emo:'😶‍🌫️', label:'자리비움',   forceSleep:true, opacity:0.0,  dot:'#9aa0a8'},
  grind:  {emo:'🔥',   label:'빡일중',     idleTweak:true,                 dot:'#e07a55'},
  gaming: {emo:'🎮',   label:'게임 중',    dot:'#8a8ec9'},
};
let userStatus=null;
function setUserStatus(v){
  if(!v || !USER_STATUSES[v]) v=null;
  userStatus=v;
  try{ localStorage.setItem('tw.userStatus', v||''); }catch(e){}
  refreshMyStatusUI();
  if(typeof Presence!=='undefined' && Presence.setUserStatus) Presence.setUserStatus(v);
}
function loadUserStatusFromStorage(){
  try{ const v=localStorage.getItem('tw.userStatus'); if(v && USER_STATUSES[v]) userStatus=v; }catch(e){}
}
function refreshMyStatusUI(){
  const btn=document.getElementById('myStatusChipBtn'); if(!btn)return;
  const dot=document.getElementById('myStatusDot');
  const lbl=document.getElementById('myStatusLabel');
  const c=userStatus?USER_STATUSES[userStatus]:null;
  if(c){
    if(lbl) lbl.textContent = c.emo+' '+c.label;
    if(dot){ dot.style.background = c.dot||'#9dba8a'; dot.style.boxShadow='0 0 0 2px '+hexToRgba(c.dot||'#9dba8a',.18); }
  } else {
    if(lbl) lbl.textContent = '온라인';
    if(dot){ dot.style.background = '#9dba8a'; dot.style.boxShadow='0 0 0 2px rgba(157,186,138,.18)'; }
  }
  document.querySelectorAll('#myStatusMenu .stItem').forEach(b=>{
    b.classList.toggle('active', (b.dataset.st||'')===(userStatus||''));
  });
}
function hexToRgba(hex,a){ const n=hex.replace('#',''); const r=parseInt(n.substr(0,2),16),g=parseInt(n.substr(2,2),16),b=parseInt(n.substr(4,2),16); return `rgba(${r},${g},${b},${a})`; }
/* 칩 위치를 매 프레임 자기 좌석 발 밑(화면 좌표)에 맞춤. 설정 패널이 열려있으면 그 위치도 같이 갱신. */
const _wpTmp=new THREE.Vector3();
const _wpTmp2=new THREE.Vector3();
function updateMyStatusChipPosition(){
  const chip=document.getElementById('myStatusChip'); if(!chip)return;
  const me=seats.find(s=>s.isMe);
  // 런처(메인 화면 가림)·생성기 등에서는 숨김
  const launcherOn=document.getElementById('launcher'); const launcherVisible=launcherOn&&launcherOn.classList.contains('on');
  const creatorOn=document.getElementById('creator'); const creatorVisible=creatorOn&&creatorOn.classList.contains('on');
  if(!me || launcherVisible || creatorVisible){ chip.style.display='none'; return; }
  chip.style.display='flex';
  // ★ 캐릭터 위치를 그대로 투영 → 화면(픽셀) 단위로 오프셋. 원근 드리프트 0.
  //   [이전 방식] 월드 오프셋 (-0.4, y=-0.18) 후 투영 → 캐릭터와 앵커의 월드 위치가 달라서
  //   카메라 pan 시 원근차이로 칩이 캐릭터를 완전히 못 따라가는 드리프트가 발생함.
  //   [현재 방식] 캐릭터 그룹 위치만 투영 → 픽셀 오프셋으로 배치 → 100% 정확 추적.
  me.group.getWorldPosition(_wpTmp);
  _wpTmp.y += 0.5;                        // 캐릭터 몸통 중간 높이 근처 (화면 상 캐릭터 중심 근처)
  _wpTmp.project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  const cx=rect.left+(_wpTmp.x*0.5+0.5)*rect.width;
  const cy=rect.top +(-_wpTmp.y*0.5+0.5)*rect.height;
  // 크기 슬라이더에 맞춰 오프셋도 스케일 (너무 작을 때는 하한 0.7로 잡아서 칩 겹침 방지)
  const s = Math.max(0.7, focusCharScale);
  // deskPanX는 "프로그램 이동"으로 캐릭터를 옮긴 양(비율). 양수일수록 캐릭터가 화면 왼쪽으로 감(app.js 735번 줄 주석 참고).
  // 캐릭터가 왼쪽으로 갈수록 칩을 캐릭터에서 "더" 왼쪽으로 떨어뜨림 (반대 방향/오른쪽 이동시엔 추가 안 함).
  const LEFT_PULL_SENSITIVITY = 110;   // 키우면 왼쪽 갈수록 더 급격하게 벌어짐
  const extraX = Math.max(0, deskPanX) * LEFT_PULL_SENSITIVITY;
  const OX = (80 + extraX) * s;   // 캐릭터 중심 왼쪽으로 픽셀 오프셋 (+왼쪽 이동시 추가분)
  // ★ 세로(포트레이트) 모니터 대응: OY(140px)는 가로형(16:9) 화면 기준으로 튜닝된 고정값이라,
  //   세로로 긴 화면에서 그대로 쓰면 캐릭터 대비 상대적으로 너무 아래로 처져 보임(듀얼모니터로 세로 모니터에
  //   보냈을 때 보고된 문제). 화면비가 16:9보다 좁을수록(세로에 가까울수록) OY를 비례해서 줄여줌.
  const aspectRatio = innerWidth/Math.max(1,innerHeight);
  const vertComp = Math.min(1, aspectRatio/(16/9));   // 16:9 이상(가로로 넓음)이면 1(원래값 그대로), 세로형이면 1보다 작아짐
  const OY = 140 * s * vertComp;  // 캐릭터 중심 아래로 픽셀 오프셋 (책상 다리 아래, 그림자 영역쯤)
  const px0 = cx - OX;
  const py0 = cy + OY;
  // 화면 밖으로 나가지 않게 clamp (칩 폭 대략 190px, 높이 30px로 여유 잡음)
  const px=Math.max(8, Math.min(innerWidth-198, px0));
  const py=Math.max(8, Math.min(innerHeight-38, py0));
  // 캐릭터 위치(투영결과+오프셋)를 따라감 — "프로그램 이동"으로 캐릭터를 옮겨도 정확히 따라옴
  chip.style.left=px+'px';
  chip.style.right='auto';
  chip.style.top = py+'px';
  // 화면 하단(작업표시줄 근처)에 가까우면 상태 메뉴가 아래 대신 위로 열리게
  const menu=document.getElementById('myStatusMenu');
  if(menu){ menu.classList.toggle('flip-up', py > innerHeight - 200); }

  // 설정 패널 — 캐릭터 머리 위 중앙에 오도록, 상태칩과 별개로 "오프셋 없는" 캐릭터 중앙 x 사용
  const panel=document.getElementById('focusSettingsPanel');
  if(panel && panel.classList.contains('on')){
    me.group.getWorldPosition(_wpTmp2); _wpTmp2.y = 1.3; _wpTmp2.project(camera);
    const cx=rect.left+(_wpTmp2.x*0.5+0.5)*rect.width;
    const cy=rect.top +(-_wpTmp2.y*0.5+0.5)*rect.height;
    panel.style.left=cx+'px';
    panel.style.top =cy+'px';
  }
}
/* 칩 이벤트 바인딩 — 클릭하면 상태 메뉴 토글 (드래그 이동 기능은 설정 패널의 "프로그램 이동"으로 이전됨) */
(function bindMyStatusChip(){
  const btn=document.getElementById('myStatusChipBtn'); const menu=document.getElementById('myStatusMenu');
  if(!btn||!menu)return;
  btn.addEventListener('click',e=>{ e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click',e=>{ if(!menu.contains(e.target)&&e.target!==btn) menu.classList.add('hidden'); });
  menu.addEventListener('click',e=>{ const b=e.target.closest('.stItem'); if(!b)return;
    setUserStatus(b.dataset.st||null); menu.classList.add('hidden');
  });
  loadUserStatusFromStorage(); refreshMyStatusUI();

  // 접기/펼치기 (◀ 버튼) — 세션 유지
  const collapseBtn=document.getElementById('myChipCollapseBtn');
  const chip=document.getElementById('myStatusChip');
  if(collapseBtn && chip){
    let collapsed = localStorage.getItem('tw.chipCollapsed')==='1';
    if(collapsed) chip.classList.add('collapsed');
    collapseBtn.onclick=e=>{ e.stopPropagation();
      collapsed=!collapsed;
      chip.classList.toggle('collapsed', collapsed);
      localStorage.setItem('tw.chipCollapsed', collapsed?'1':'0');
      menu.classList.add('hidden');
    };
  }
})();

/* ⚙ 설정 패널 — 포커싱 어플 슬롯 / 캐릭터 크기 / 프로그램 이동 */
let moveMode=false;   // "프로그램 이동" 진행 중 여부 (true면 캐릭터가 마우스를 따라다니다 클릭으로 확정)
let _moveModeJustToggled=false;   // 버튼 클릭 직후 신호 — bindMoveMode가 시작점을 새로 잡게 함
(function bindFocusSettings(){
  const gearBtn=document.getElementById('myFocusGearBtn');
  const panel=document.getElementById('focusSettingsPanel');
  const slotsEl=document.getElementById('fsSlots');
  const sizeSlider=document.getElementById('fsSizeSlider');
  const moveBtn=document.getElementById('fsMoveBtn');
  const moveHint=document.getElementById('fsMoveHint');
  const backBtn=document.getElementById('fsBackBtn');
  if(!gearBtn||!panel) return;

  async function renderSlots(){
    if(!slotsEl) return;
    let apps=[null,null,null,null];
    if(window.companion && companion.getFocusApps){
      try{ apps = await companion.getFocusApps(); }catch(e){}
    }
    slotsEl.innerHTML='';
    const firstEmptyIdx = apps.findIndex(a=>!a);   // 가장 앞의 빈 슬롯 하나만 "+"로 노출
    for(let i=0;i<4;i++){
      const a=apps[i];
      if(!a && i!==firstEmptyIdx) continue;   // 채워진 것들 + 맨 앞의 빈 슬롯 1개만
      const el=document.createElement('div');
      el.className='fs-slot'+(a?' filled':'');
      el.innerHTML = `<span class="fs-num">${i+1}</span>`+
        (a ? `<span class="fs-name">${(a.name||'').replace('.exe','')}</span><span class="fs-x">×</span>`
           : `<span style="font-size:18px;">+</span>`);
      el.title = a ? `등록됨: ${a.name}\n클릭하면 지금 초점 앱으로 교체, ×로 해제` : '클릭해서 지금 쓰던 프로그램을 등록';
      el.onclick = async (ev)=>{
        if(ev.target.classList.contains('fs-x')){
          if(window.companion && companion.clearFocusApp) companion.clearFocusApp(i);
          setTimeout(renderSlots, 50);
          return;
        }
        if(window.companion && companion.registerFocusApp){
          const res = await companion.registerFocusApp(i);
          if(!res || !res.ok){ toast(res&&res.reason==='no-window' ? '먼저 등록할 프로그램을 켜서 사용해 주세요' : '등록 실패'); }
          else{ toast((res.app.name||'앱')+' 등록됨'); }
          renderSlots();
        }
      };
      slotsEl.appendChild(el);
    }
  }

  async function renderMonitors(){
    const labelEl=document.getElementById('fsMonitorLabel');
    const monEl=document.getElementById('fsMonitors');
    if(!monEl || !labelEl) return;
    if(!window.companion || !companion.getDisplays){ labelEl.style.display='none'; monEl.style.display='none'; return; }
    let displays=[];
    try{ displays = await companion.getDisplays(); }catch(e){}
    if(!displays || displays.length<2){
      // 모니터가 1개면 선택할 필요가 없으니 숨김
      labelEl.style.display='none'; monEl.style.display='none';
      return;
    }
    labelEl.style.display='block'; monEl.style.display='flex';
    monEl.innerHTML='';
    displays.forEach(d=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='fs-mon-btn'+(d.isCurrent?' current':'');
      btn.textContent=d.label;
      btn.onclick=async ()=>{
        if(window.companion && companion.moveToDisplay){
          const res=await companion.moveToDisplay(d.id);
          if(res && res.ok){ toast(d.label+'로 이동'); renderMonitors(); }
          else{ toast('이동 실패'); }
        }
      };
      monEl.appendChild(btn);
    });
  }

  gearBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const willOpen = !panel.classList.contains('on');
    panel.classList.toggle('on', willOpen);
    if(willOpen){ renderSlots(); sizeSlider.value = String(focusCharScale); refreshToggleBtns(); renderMonitors(); }
  });
  document.addEventListener('click', e=>{
    if(panel.classList.contains('on') && !panel.contains(e.target) && e.target!==gearBtn){
      panel.classList.remove('on');
    }
  });

  function refreshToggleBtns(){
    const emojiBtn=document.getElementById('fsEmojiToggle');
    if(emojiBtn){ emojiBtn.textContent = emojiReactionsEnabled?'켜짐':'꺼짐'; emojiBtn.classList.toggle('on', emojiReactionsEnabled); }
    const dotBtn=document.getElementById('fsDotToggle');
    if(dotBtn){ dotBtn.textContent = dotRenderEnabled?'켜짐':'꺼짐'; dotBtn.classList.toggle('on', dotRenderEnabled); }
  }
  const emojiBtn=document.getElementById('fsEmojiToggle');
  if(emojiBtn) emojiBtn.onclick=()=>{
    emojiReactionsEnabled=!emojiReactionsEnabled;
    localStorage.setItem('tw.emojiReactions', emojiReactionsEnabled?'1':'0');
    refreshToggleBtns();
  };
  const dotBtn=document.getElementById('fsDotToggle');
  if(dotBtn) dotBtn.onclick=()=>{
    dotRenderEnabled=!dotRenderEnabled;
    localStorage.setItem('tw.dotRender', dotRenderEnabled?'1':'0');
    refreshToggleBtns();
    layoutSeats();   // 렌더 해상도 즉시 반영
  };

  if(backBtn) backBtn.onclick = ()=>{ panel.classList.remove('on'); backToLauncher(); };

  if(sizeSlider) sizeSlider.oninput = ()=>{
    focusCharScale = +sizeSlider.value;
    layoutSeats();
  };

  if(moveBtn) moveBtn.onclick = ()=>{
    moveMode = !moveMode;
    _moveModeJustToggled = true;   // 다음 mousemove에서 시작점을 새로 잡도록 신호
    moveBtn.classList.toggle('active', moveMode);
    moveBtn.textContent = moveMode ? '🖱 클릭해서 위치 확정' : '📍 프로그램 이동';
    if(moveHint) moveHint.style.display = moveMode ? 'block' : 'none';
    if(moveMode){ panel.classList.remove('on'); }   // 이동 중엔 패널 가려서 시야 확보
  };
})();
/* 프로그램 이동 모드 — 마우스를 따라 화면 전체(카메라 pan)가 이동, 클릭하면 확정.
   카메라 각도는 고정한 채 평행이동만 하므로 앵글이 안 흔들리고, 상태칩도 camera 기준 재계산이라 정확히 따라옴.
   deskPanX/Y는 월드 단위 절대 오프셋 — _deskViewH/_deskCanvasH 비율로 픽셀을 정확히 월드로 환산해 1:1 매칭. */
(function bindMoveMode(){
  let startClientX=0, startClientY=0, startPanX=0, startPanY=0;
  let _moveStarted=false;
  window.addEventListener('mousemove', e=>{
    if(!moveMode) return;
    if(!_moveStarted || _moveModeJustToggled){
      _moveStarted=true; _moveModeJustToggled=false;
      startClientX=e.clientX; startClientY=e.clientY; startPanX=deskPanX; startPanY=deskPanY;
      return;
    }
    const dxPix = e.clientX - startClientX, dyPix = e.clientY - startClientY;
    // 픽셀 이동량을 캔버스 크기 대비 "비율"로 변환 — 캐릭터 크기(focusCharScale)가 바뀌어도 위치 비율이 안 틀어짐.
    // run 모드는 canvasW===innerWidth, canvasH===innerHeight. 마우스 오른쪽/아래 → 캐릭터도 화면상 오른쪽/아래로 보이게 부호 반전.
    deskPanX = startPanX - dxPix/Math.max(1, innerWidth);
    deskPanY = startPanY + dyPix/Math.max(1, innerHeight);
    layoutSeats();
    updateMyStatusChipPosition();   // 렌더 루프(frame) 대기 없이 즉시 갱신 — 도트렌더 등으로 프레임이 느려져도 상태칩은 안 밀리게
  });
  window.addEventListener('pointerdown', e=>{
    if(!moveMode) return;
    moveMode=false; _moveStarted=false;
    const moveBtn=document.getElementById('fsMoveBtn'); const moveHint=document.getElementById('fsMoveHint');
    if(moveBtn){ moveBtn.classList.remove('active'); moveBtn.textContent='📍 프로그램 이동'; }
    if(moveHint) moveHint.style.display='none';
    toast('위치가 확정됐어요');
  }, true);   // capture: 클릭통과 로직보다 먼저 잡아서 이동 확정
  // 이동 시작 트리거는 moveBtn 클릭 시점(bindFocusSettings)에서 moveMode=true로 바뀌자마자 다음 mousemove에서 자동 시작됨
})();

/* 🎨 꾸미기 사이드 패널 — 열고 닫기 + 콘텐츠 렌더 */
(function bindWardrobe(){
  const btn=document.getElementById('myWardrobeBtn');
  const panel=document.getElementById('wardrobePanel');
  const closeBtn=document.getElementById('wardrobeClose');
  if(!btn||!panel)return;
  function open(){
    // 프리미엄 게이트 — 라이선스 등록되어 있거나 관리자면 통과
    if(!isPremium && !isAdmin){
      toast('🔒 꾸미기는 라이선스 등록 후 이용할 수 있어요');
      const lo=document.getElementById('licenseOverlay'); if(lo){ refreshLicenseUI(); lo.classList.add('on'); lo.style.display='flex'; }
      return;
    }
    renderWardrobe();
    panel.classList.add('on');
  }
  function close(){ panel.classList.remove('on'); }
  btn.addEventListener('click', e=>{ e.stopPropagation(); if(panel.classList.contains('on'))close(); else open(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && panel.classList.contains('on')) close(); });
  window.openWardrobe = open;
  window.closeWardrobe = close;
  window.refreshWardrobe = ()=>{ if(panel.classList.contains('on')) renderWardrobe(); };
})();

/* 내 캐릭터 좌석 찾기 (isMe) */
function findMySeat(){ return seats.find(s=>s.isMe) || seats.find(s=>!s.remote) || null; }

/* 꾸미기 패널 콘텐츠 렌더링 및 파츠 조절 로직 */
let activeWdAdj = null;
let wdAdjAxis = 'y';

/* 길게 누르기 헬퍼 — pointerdown 즉시 1회 + 300ms 후 60ms 간격 연속 */
function _holdRepeat(btn, action){
  let t=null, iv=null;
  const stop = ()=>{ if(t){clearTimeout(t);t=null;} if(iv){clearInterval(iv);iv=null;} };
  btn.addEventListener('pointerdown', e=>{
    e.preventDefault();
    btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
    action();
    t = setTimeout(()=>{ iv = setInterval(action, 60); }, 300);
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

function createWardrobeAdjPanel(cat, id) {
  const mySeat = findMySeat();
  const def = mySeat.charDef;
  const entry = def.equippedParts[cat];
  const xf = partEntryXf(entry);
  const sync = () => { applyPartXf(mySeat, cat); if(typeof saveSlots==='function') saveSlots(); };

  const panel = document.createElement('div');
  panel.className = 'wd-adj';

  // 1. 크기 조절 — +/- 버튼 (길게 누르기)
  const scaleRow = document.createElement('div');
  scaleRow.className = 'wd-adj-row';
  scaleRow.innerHTML = `<span class="wd-adj-lab">크기</span>
                        <button class="wd-adj-step" data-d="-">−</button>
                        <span class="wd-adj-val">${xf.scale.toFixed(2)}</span>
                        <button class="wd-adj-step" data-d="+">+</button>
                        <button class="wd-adj-reset" title="초기화">↺</button>`;
  const scaleVal = scaleRow.querySelector('.wd-adj-val');
  const SCALE_STEP = 0.01, SCALE_MIN = 0.3, SCALE_MAX = 2.5;
  _holdRepeat(scaleRow.querySelector('[data-d="-"]'), ()=>{
    xf.scale = Math.max(SCALE_MIN, +(xf.scale - SCALE_STEP).toFixed(2));
    scaleVal.textContent = xf.scale.toFixed(2); sync();
  });
  _holdRepeat(scaleRow.querySelector('[data-d="+"]'), ()=>{
    xf.scale = Math.min(SCALE_MAX, +(xf.scale + SCALE_STEP).toFixed(2));
    scaleVal.textContent = xf.scale.toFixed(2); sync();
  });
  scaleRow.querySelector('.wd-adj-reset').onclick = ()=>{
    xf.scale = 1; scaleVal.textContent = '1.00'; sync();
  };
  panel.appendChild(scaleRow);

  // 2. 회전 조절 — +/- 버튼 (길게 누르기) + X/Y/Z 축 선택
  const rotRow = document.createElement('div');
  rotRow.className = 'wd-adj-row';
  const axMap = { 'x': 0, 'y': 1, 'z': 2 };
  rotRow.innerHTML = `<span class="wd-adj-lab">회전</span>
                      <button class="wd-adj-step" data-d="-">−</button>
                      <span class="wd-adj-val">${xf.rot[axMap[wdAdjAxis]].toFixed(2)}</span>
                      <button class="wd-adj-step" data-d="+">+</button>
                      <div class="wd-adj-axis">
                        <button data-ax="x" class="${wdAdjAxis==='x'?'on':''}">X축</button>
                        <button data-ax="y" class="${wdAdjAxis==='y'?'on':''}">Y축</button>
                        <button data-ax="z" class="${wdAdjAxis==='z'?'on':''}">Z축</button>
                      </div>
                      <button class="wd-adj-reset" title="초기화">↺</button>`;
  const rotVal = rotRow.querySelector('.wd-adj-val');
  const rotBtns = rotRow.querySelectorAll('.wd-adj-axis button');
  const ROT_STEP = 0.05, ROT_MIN = -Math.PI, ROT_MAX = Math.PI;
  _holdRepeat(rotRow.querySelector('[data-d="-"]'), ()=>{
    const i = axMap[wdAdjAxis];
    xf.rot[i] = Math.max(ROT_MIN, +(xf.rot[i] - ROT_STEP).toFixed(2));
    rotVal.textContent = xf.rot[i].toFixed(2); sync();
  });
  _holdRepeat(rotRow.querySelector('[data-d="+"]'), ()=>{
    const i = axMap[wdAdjAxis];
    xf.rot[i] = Math.min(ROT_MAX, +(xf.rot[i] + ROT_STEP).toFixed(2));
    rotVal.textContent = xf.rot[i].toFixed(2); sync();
  });
  rotBtns.forEach(b => b.onclick = e => {
    wdAdjAxis = e.target.dataset.ax;
    rotBtns.forEach(btn => btn.classList.remove('on'));
    e.target.classList.add('on');
    rotVal.textContent = xf.rot[axMap[wdAdjAxis]].toFixed(2);
  });
  rotRow.querySelector('.wd-adj-reset').onclick = ()=>{
    const i = axMap[wdAdjAxis];
    xf.rot[i] = 0; rotVal.textContent = '0.00'; sync();
  };
  panel.appendChild(rotRow);

  // 3. 위치 조절 — 6방향 길게 누르기
  const posRow = document.createElement('div');
  posRow.className = 'wd-adj-pos-row';
  posRow.innerHTML = `<span class="wd-adj-lab">위치</span>
                      <div class="wd-adj-pos">
                        <button data-d="x-" title="왼쪽">←</button>
                        <button data-d="y+" title="위">↑</button>
                        <button data-d="x+" title="오른쪽">→</button>
                        <button data-d="z+" title="앞">앞</button>
                        <button data-d="y-" title="아래">↓</button>
                        <button data-d="z-" title="뒤">뒤</button>
                      </div>
                      <button class="wd-adj-reset" title="초기화">↺</button>`;
  const POS_STEP = 0.02;
  posRow.querySelectorAll('.wd-adj-pos button').forEach(b=>{
    _holdRepeat(b, ()=>{
      const d = b.dataset.d;
      if(d==='x-') xf.pos[0] -= POS_STEP; else if(d==='x+') xf.pos[0] += POS_STEP;
      else if(d==='y-') xf.pos[1] -= POS_STEP; else if(d==='y+') xf.pos[1] += POS_STEP;
      else if(d==='z-') xf.pos[2] -= POS_STEP; else if(d==='z+') xf.pos[2] += POS_STEP;
      sync();
    });
  });
  posRow.querySelector('.wd-adj-reset').onclick = ()=>{ xf.pos = [0,0,0]; sync(); };
  panel.appendChild(posRow);

  return panel;
}

function renderWardrobe(){
  const wrap=document.getElementById('wardrobeContent');
  if(!wrap)return;
  const mySeat=findMySeat();
  const def=mySeat&&mySeat.charDef;
  const equipped=(def&&def.equippedParts)||{};
  
  if(savedParts.length===0 && !isAdmin){
    wrap.innerHTML='<div class="wd-empty"><span class="ic">🧺</span>아직 등록된 파츠가 없어요.<br>관리자가 모자·안경·옷·헤어·날개·손 파츠를<br>추가하면 여기에 나타나요.</div>';
    return;
  }
  wrap.innerHTML='';
  PART_CATS.forEach(info=>{
    const list=partsInCat(info.cat);
    if(list.length===0 && !isAdmin) return;
    const sec=document.createElement('div'); sec.className='wd-cat';
    const head=document.createElement('div'); head.className='wd-cat-head';
    head.innerHTML='<h3>'+info.icon+' '+info.label+'</h3>';
    if(isAdmin){
      const add=document.createElement('button'); add.className='wd-add'; add.textContent='+ 등록';
      add.onclick=()=>openPartRegister(info.cat);
      head.appendChild(add);
    }
    sec.appendChild(head);
    const grid=document.createElement('div'); grid.className='wd-grid';
    
    const noneCard=document.createElement('div'); noneCard.className='wd-card none-card'+(!equipped[info.cat]?' on':'');
    noneCard.textContent='안 함';
    noneCard.onclick=()=>{ activeWdAdj=null; toggleEquip(info.cat,null); };
    grid.appendChild(noneCard);
    
    list.forEach(rec=>{
      const isEquipped = partEntryId(equipped[info.cat])===rec.id;
      const card=document.createElement('div'); card.className='wd-card'+(isEquipped?' on':'');
      card.innerHTML='<span>'+(rec.icon||info.icon)+'</span><span class="nm">'+(rec.name||'파츠')+'</span>';
      
      // 좌클릭: 파츠 장착/해제
      card.onclick=()=>toggleEquip(info.cat,rec.id);
      
      // 우클릭: 파츠 조절 패널 열기/닫기
      card.oncontextmenu=e=>{
        e.preventDefault();
        if(!isEquipped) { toast('먼저 파츠를 착용해 주세요'); return; }
        if(activeWdAdj && activeWdAdj.id===rec.id) activeWdAdj = null;
        else activeWdAdj = {cat: info.cat, id: rec.id};
        renderWardrobe();
      };
      
      if(isAdmin){
        const x=document.createElement('div'); x.className='wd-card-x'; x.textContent='×';
        x.onclick=ev=>{ ev.stopPropagation(); activeWdAdj=null; deletePart(rec.id); };
        card.appendChild(x);
      }
      grid.appendChild(card);
      
      // 우클릭한 활성 파츠 바로 아래에 조절 패널 삽입
      if(activeWdAdj && activeWdAdj.id === rec.id) {
        grid.appendChild(createWardrobeAdjPanel(info.cat, rec.id));
      }
    });
    sec.appendChild(grid);
    wrap.appendChild(sec);
  });
}

/* 파츠 착용/해제 — 즉시 def 갱신 + 좌석 반영 + 저장
   ★ def.partXfMemory: 카테고리별로 하나만 남는 equippedParts와 별개로, "파츠 id별 마지막 조정값"을 따로 기억.
   안함으로 껐다가 같은 파츠를 다시 켜도 예전에 맞춰둔 크기/회전/위치가 그대로 돌아오게 하기 위함
   (예전엔 equippedParts[cat]을 통째로 delete해서 xf가 같이 날아갔음). */
async function toggleEquip(cat, id){
  const mySeat=findMySeat();
  if(!mySeat||!mySeat.charDef){ toast('먼저 캐릭터를 만들어 주세요'); return; }
  const def=mySeat.charDef;
  def.equippedParts = def.equippedParts || {};
  def.partXfMemory = def.partXfMemory || {};
  if(!id){
    // 안함으로 변경 — 지우기 전에 지금 조정값을 파츠별 메모리에 저장해둠(재장착시 복원용)
    const prev = def.equippedParts[cat];
    const prevId = partEntryId(prev);
    if(prevId){ def.partXfMemory[cat+':'+prevId] = partEntryXf(prev); }
    delete def.equippedParts[cat];
    unequipPartFromSeat(mySeat, cat);
    applyClothVisibility(mySeat);   // 옷 해제 시 기본 상/하의 메시 다시 보이게 갱신
  } else {
    const rec=savedParts.find(p=>p.id===id&&p.cat===cat);
    if(!rec)return;
    // xf 우선순위: 1) 지금 이 카테고리에 이미 같은 파츠가 장착돼 있으면 그 값 그대로
    //            2) 예전에 이 파츠를 조정해뒀던 기억(partXfMemory)이 있으면 그 값 복원
    //            3) 둘 다 없으면 기본값
    const prev = def.equippedParts[cat];
    const prevId = partEntryId(prev);
    const remembered = def.partXfMemory[cat+':'+id];
    const xf = (prevId===id) ? partEntryXf(prev) : (remembered || defaultPartXf());
    def.equippedParts[cat] = {id, xf};
    await equipPartOnSeat(mySeat, cat, rec);
  }
  // 슬롯 저장 (내 캐릭터가 슬롯에 있으면)
  if(typeof saveSlots==='function') saveSlots();
  renderWardrobe();
}

/* 파츠 삭제 (관리자) — localStorage에서 제거 + 착용 중이면 해제 + 카탈로그에 배포됐던 파츠면 거기서도 제거 */
function deletePart(id){
  const rec=savedParts.find(p=>p.id===id); if(!rec)return;
  savedParts=savedParts.filter(p=>p.id!==id);
  persistSavedParts();
  partSceneCache.delete(id);
  // 모든 좌석에서 이 파츠 착용 해제
  seats.forEach(s=>{ if(s.charDef&&s.charDef.equippedParts){ for(const c in s.charDef.equippedParts){ if(partEntryId(s.charDef.equippedParts[c])===id){ delete s.charDef.equippedParts[c]; unequipPartFromSeat(s,c); } } } applyClothVisibility(s); });
  if(typeof saveSlots==='function') saveSlots();
  // 카탈로그(Firebase)에도 있던 파츠면 거기서도 제거 — 안 그러면 다른 사용자들한텐 계속 남아있음
  if(window.firebaseAPI && window.firebaseAPI.unpublishPart){
    window.firebaseAPI.unpublishPart(id).catch(()=>{});
  }
  renderWardrobe();
}

/* 파츠 등록 모달 (관리자) */
let _partRegCat=null;
function openPartRegister(cat){
  _partRegCat=cat;
  const info=partCatInfo(cat);
  document.getElementById('partRegCatLabel').textContent=info?info.label:'파츠';
  document.getElementById('partRegName').value='';
  document.getElementById('partRegIcon').value='';
  document.getElementById('partRegFile').value='';
  document.getElementById('partRegOverlay').classList.add('on');
}
(function bindPartRegister(){
  const ov=document.getElementById('partRegOverlay'); if(!ov)return;
  document.getElementById('partRegCancel').onclick=()=>ov.classList.remove('on');
  document.getElementById('partRegGo').onclick=async()=>{
    const f=document.getElementById('partRegFile').files[0];
    const info=partCatInfo(_partRegCat);
    const name=(document.getElementById('partRegName').value.trim())||(info?info.label:'파츠');
    const icon=document.getElementById('partRegIcon').value;
    if(!f){toast('GLB 파일을 선택해 주세요');return;}
    if(f.size>MAX_GLB_BYTES){toast('GLB 파일이 1MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
    if(partsInCat(_partRegCat).length>=MAX_PARTS_PER_CAT){toast('이 카테고리는 최대 '+MAX_PARTS_PER_CAT+'개까지예요');return;}
    try{
      const glb=await f.arrayBuffer();
      await parseGlbBytes(glb.slice(0));   // 파싱 검증 (깨진 GLB 거르기)
      const id='p'+Date.now().toString(36);
      const glbB64=_b64(glb);
      const rec={id, cat:_partRegCat, name, icon:icon||'', glb:glbB64};
      savedParts.push(rec); persistSavedParts();
      toast('"'+name+'" 등록 완료');
      ov.classList.remove('on');
      renderWardrobe();
      // 카탈로그(Firebase)에도 배포 — 성공하면 이미 설치한 사용자들에게도 자동으로 뜸.
      // 실패(오프라인 등)해도 이 기기에는 이미 저장돼 있으니 등록 자체는 막지 않고, 별도로 경고만 띄움.
      if(window.firebaseAPI && window.firebaseAPI.publishPart){
        window.firebaseAPI.publishPart(id, {cat:_partRegCat, name, icon:icon||'', glb:glbB64})
          .catch(()=>{ toast('⚠ 온라인 배포 실패 — 이 기기에만 저장됐어요(인터넷 연결 확인)'); });
      } else {
        toast('⚠ 온라인 배포 안 됨 — 이 기기에만 저장됐어요');
      }
    }catch(e){ toast('등록 실패: GLB 파일을 확인해 주세요'); }
  };
})();

/* ----- 시각화 헬퍼: 책상 위 이모지 sprite / 머리 위 텍스트 말풍선 sprite / 영혼 투명도 ----- */
const _emojiTexCache={};
function makeEmojiTexture(em){
  if(_emojiTexCache[em])return _emojiTexCache[em];
  const cv=document.createElement('canvas'); cv.width=cv.height=128;
  const x=cv.getContext('2d');
  x.font='100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.fillText(em, 64, 72);
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.needsUpdate=true;
  _emojiTexCache[em]=t; return t;
}
/* ── 책상 위 이모지 (deskAnchor에 부착, sprite — 항상 카메라 향함) ── */
function ensureSeatDeskEmoji(seat){
  if(seat.deskEmojiSprite) return seat.deskEmojiSprite;
  if(!seat.deskAnchor) return null;
  const mat=new THREE.SpriteMaterial({map:null, transparent:true, depthTest:true, depthWrite:false});
  const sp=new THREE.Sprite(mat); sp.scale.set(0.264,0.264,1); sp.visible=false; sp.renderOrder=850;
  sp.position.set(0, 0.12, 0.02);   // 책상 위 12cm, 카메라 쪽으로 2cm
  seat.deskAnchor.add(sp);
  seat.deskEmojiSprite=sp; return sp;
}
function setSeatDeskEmoji(seat, em){
  if(seat._lastDeskEmo===em) return;
  seat._lastDeskEmo=em;
  const sp=ensureSeatDeskEmoji(seat); if(!sp) return;
  if(!em){ sp.visible=false; return; }
  sp.material.map=makeEmojiTexture(em); sp.material.needsUpdate=true; sp.visible=true;
}

/* ── 머리 위 텍스트 말풍선 (headAnchor에 부착, 머리 움직임 따라감) — Win98 노란 도트 스타일 ── */
const _bubbleTexCache={};
function makeBubbleTexture(text){
  if(_bubbleTexCache[text]) return _bubbleTexCache[text];
  const cv=document.createElement('canvas'); cv.width=380; cv.height=170;
  const x=cv.getContext('2d');
  x.imageSmoothingEnabled=false;
  // 노란 도트 배경 알약 본체(각진 사각형)
  const ox=12, oy=10, w=cv.width-24, h=104;
  x.fillStyle='#FFFFCC';   // 클래식 툴팁 노란색
  x.fillRect(ox,oy,w,h);
  // 도트 패턴 (은은한 점무늬)
  x.fillStyle='rgba(0,0,0,.06)';
  for(let yy=oy+6; yy<oy+h-4; yy+=10){
    for(let xx=ox+6; xx<ox+w-4; xx+=10){ x.fillRect(xx,yy,2,2); }
  }
  x.strokeStyle='#000'; x.lineWidth=3; x.strokeRect(ox,oy,w,h);
  // 꼬리 (아래로 향함, 각진 삼각형)
  const tcx=cv.width/2, ty=oy+h;
  x.fillStyle='#FFFFCC';
  x.beginPath();
  x.moveTo(tcx-14, ty-2); x.lineTo(tcx+14, ty-2); x.lineTo(tcx, ty+26); x.closePath(); x.fill();
  x.beginPath();
  x.moveTo(tcx-14, ty-1); x.lineTo(tcx, ty+26); x.lineTo(tcx+14, ty-1);
  x.strokeStyle='#000'; x.lineWidth=3; x.stroke();
  // 텍스트
  x.fillStyle='#000';
  x.font='bold 52px Tahoma, "MS Sans Serif", sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.fillText(text, cv.width/2, oy+h/2 + 4);
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.needsUpdate=true; t.magFilter=THREE.NearestFilter;
  _bubbleTexCache[text]=t; return t;
}
function ensureSeatHeadBubble(seat){
  if(seat.headBubbleSprite) return seat.headBubbleSprite;
  if(!seat.headAnchor) return null;
  const mat=new THREE.SpriteMaterial({map:null, transparent:true, depthTest:false, depthWrite:false});
  const sp=new THREE.Sprite(mat); sp.visible=false; sp.renderOrder=999;
  // 텍스처 비율 380:170 ≈ 2.235:1 — 화면 잘림 방지를 위해 -20% 줄임
  sp.scale.set(0.992, 0.443, 1);
  sp.position.set(0, 0.60, 0);   // 머리 위 60cm (머리에 더 가깝게 내림)
  seat.headAnchor.add(sp);
  seat.headBubbleSprite=sp; return sp;
}
function setSeatHeadBubble(seat, text){
  // 같은 텍스트가 dismiss된 상태면 다시 안 띄움(사용자가 닫은 걸 존중). 텍스트가 바뀌면(=상태 변경) dismiss 해제하고 새로 표시.
  // ★ 리셋 센티널은 undefined 사용 — null은 "온라인(상태 없음)" 텍스트 값으로 실제 쓰이기 때문에 null을 센티널로 쓰면
  //   상태→온라인 전환 시 "dismissedFor(null) === text(null)"가 참이 되어 잘못 조기 return, 말풍선이 안 사라지는 버그가 있었음.
  if(seat._bubbleDismissedFor !== undefined && seat._bubbleDismissedFor === text){ return; }
  if(seat._lastBubble===text) return;
  seat._lastBubble=text;
  seat._bubbleDismissedFor = undefined;
  const sp=ensureSeatHeadBubble(seat); if(!sp) return;
  if(!text){ sp.visible=false; return; }
  sp.material.map=makeBubbleTexture(text); sp.material.needsUpdate=true; sp.visible=true;
}
/* 말풍선을 클릭 등으로 즉시 숨김 — 같은 상태가 유지되는 동안은 다시 안 뜨고, 상태가 바뀌면(setSeatHeadBubble의 text 변경) 재표시됨 */
function dismissSeatHeadBubble(seat){
  if(!seat.headBubbleSprite || !seat.headBubbleSprite.visible) return;
  seat.headBubbleSprite.visible=false;
  seat._bubbleDismissedFor = seat._lastBubble;
}

/* 캐릭터 opacity (자리비움 영혼 효과) — bodyWrap 하위 모든 mesh의 material에 적용 */
function setSeatOpacity(seat, op){
  if(seat._lastOp===op) return;
  seat._lastOp=op;
  seat.bodyWrap.traverse(o=>{
    if(o.isMesh && o.material){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{
        if(!m) return;
        m.transparent = (op < 0.999);
        m.opacity     = op;
        m.depthWrite  = (op > 0.95);   // 반투명 시 z-fighting 줄이기
        m.needsUpdate = true;
      });
    }
  });
}


const FOCUS_MS=1500,SLEEP_MS=8000,PET_MS=2200;
let lastActivity=performance.now(),windowFocused=!document.hidden,lastZ=0;
function activity(){lastActivity=performance.now();}
window.addEventListener('mousemove',activity);window.addEventListener('keydown',activity);window.addEventListener('wheel',activity);
document.addEventListener('visibilitychange',()=>windowFocused=!document.hidden);
window.addEventListener('blur',()=>windowFocused=false); window.addEventListener('focus',()=>{windowFocused=true;activity();});
function seatState(seat,now){
  if(seat.pinned) return 'shaking';   // 액자 고정: 드래그된 자세(팔 처짐) + 호흡·blink 유지
  // 사용자 인터랙션 — 흔들기/회복(dizzy)이 모든 자동·수동·remote보다 우선
  if(seat.beingShaken) return 'shaking';
  if(seat.dizzyUntil && now < seat.dizzyUntil) return 'dizzy';
  // 자리비움(본인/친구) → 자동·수동과 무관하게 sleep 모션 강제 (영혼 컨셉)
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatus : null);
  if(us==='away') return 'sleep';
  if(seat.remote) return seat.remoteState||'idle';   // 친구 좌석: 공유받은 상태 사용
  if(manual)return manual;
  if(!desktopMode && !windowFocused)return 'sleep';   // 데스크톱 모드에선 다른 프로그램 쓰는 게 정상이라 이 체크 제외(포커싱 게이트가 대신함)
  if(now-seat.petStart<PET_MS)return 'pet';
  // 포커싱 어플 게이트: 데스크톱 모드에서, 등록된 앱이 없거나 등록된 앱을 안 쓰는 중이면
  // (직접 쓰다듬기·흔들기 등은 위에서 이미 처리됐으므로) 자동 idle/focus 판정은 sleep으로 대체.
  if(desktopMode && focusGateSleep) return 'sleep';
  const idle=now-lastActivity;
  if(idle<FOCUS_MS)return 'focus'; if(idle>SLEEP_MS)return 'sleep'; return 'idle'; }
function triggerPet(seat){ const now=performance.now(); seat.petStart=now; if(seat.blink) seat.blink.pulses.push({start:now,dur:240}); }

/* ============================================================ DRAG / PET */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.4);
let drag=null; // {seat, startX/Y, moved, mode:'slot'|'shake', targetType, grabX(slot), grabPlane/grabOffset(shake), lastX/Y/T, velX/Y, dizzy}
function seatFromObject(o){let p=o;while(p){if(p.userData&&p.userData.seat)return p.userData.seat;p=p.parent;}return null;}
function worldX(e){const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);const pt=new THREE.Vector3();ray.ray.intersectPlane(dragPlane,pt);return pt?pt.x:0;}

/* ─── 캐릭터 흔들기 — 시메지 컨셉
   · 캐릭터(rig 안의 mesh) 드래그 → 흔들기, 책상(desk/그림자/슬래브) 드래그 → 슬롯 이동
   · 클릭만 하고 6px 미만이면 → 쓰다듬(pet) 유지 */
const SHAKE_DIZZY_TRIGGER = 60;
// "빠른 흔들기"로 인정하는 최소 속도(px/ms). 이 이상으로 움직여야 dizzy 누적 + blink.
// 느린 좌우 드래그는 이 값보다 느려서 blink/dizzy가 안 생김. 더 둔감하게 하려면 키우세요.
const SHAKE_FAST_SPEED = 1.0;
const _ndV3 = new THREE.Vector3();
/* hit한 객체가 캐릭터 영역(rig 하위)이면 'char', 그 외(책상/그림자/슬래브)면 'desk' */
function classifyHit(seat, obj){
  let p = obj;
  while(p && p !== seat.group){
    if(p === seat.rig) return 'char';
    p = p.parent;
  }
  return 'desk';
}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(seats.map(s=>s.group),true);
  if(!hit.length) return;
  const seat=seatFromObject(hit[0].object); if(!seat) return;
  const targetType = classifyHit(seat, hit[0].object);
  // shake용 평면 — 캐릭터(rig)의 world position 기준 (책상 고정, 캐릭터만 움직임)
  const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
  const rigWP = new THREE.Vector3(); seat.rig.getWorldPosition(rigWP);
  const groupWP = new THREE.Vector3(); seat.group.getWorldPosition(groupWP);
  const grabPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, rigWP);
  const grabPt = new THREE.Vector3(); ray.ray.intersectPlane(grabPlane, grabPt);
  const grabOffset = grabPt.clone().sub(rigWP);
  drag={
    seat, startX:e.clientX, startY:e.clientY, moved:false, mode:null, targetType,
    grabX: worldX(e) - seat.group.position.x,
    grabPlane, grabOffset, groupWP,
    lastX:e.clientX, lastY:e.clientY, lastT:performance.now(),
    velX:0, velY:0, dizzy:0
  };
  selectSeat(seat); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const now=performance.now();
  const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;
  if(!drag.moved){
    if(Math.hypot(dx,dy) > 6){
      drag.moved = true;
      if(drag.seat.pinned) drag.seat.pinned = false;   // 드래그 시작 → 액자 고정 해제
      // 새 규칙: 캐릭터 클릭→흔들기, 책상 클릭→슬롯 이동
      drag.mode = (drag.targetType === 'char') ? 'shake' : 'slot';
      if(drag.mode==='shake'){ drag.seat.beingShaken = true; drag.seat._wasShaken = true; }
    } else return;
  }
  const dt = Math.max(1, now - drag.lastT);
  drag.velX = (e.clientX - drag.lastX) / dt;
  drag.velY = (e.clientY - drag.lastY) / dt;
  drag.lastX = e.clientX; drag.lastY = e.clientY; drag.lastT = now;

  if(drag.mode==='slot'){
    const wx=worldX(e)-drag.grabX; drag.seat.group.position.x=wx;
    const n=seats.length; let idx=Math.round(-wx/SPACING); idx=Math.max(0,Math.min(n-1,idx));
    const cur=seats.indexOf(drag.seat);
    if(idx!==cur){seats.splice(cur,1);seats.splice(idx,0,drag.seat);layoutSeats();renderSeatTabs();}
  } else if(drag.mode==='shake'){
    const r2=canvas.getBoundingClientRect();ndc.x=((e.clientX-r2.left)/r2.width)*2-1;ndc.y=-((e.clientY-r2.top)/r2.height)*2+1;
    ray.setFromCamera(ndc,camera);
    if(ray.ray.intersectPlane(drag.grabPlane, _ndV3)){
      // 마우스 광선이 가리키는 rig의 새 world 좌표 = 교차점 - 잡은 offset
      // rig의 local position = (world target) - (group의 world position)
      drag.seat.rig.position.x = _ndV3.x - drag.grabOffset.x - drag.groupWP.x;
      drag.seat.rig.position.y = _ndV3.y - drag.grabOffset.y - drag.groupWP.y;
      drag.seat.rig.position.z = _ndV3.z - drag.grabOffset.z - drag.groupWP.z;
    }
    const speed = Math.abs(drag.velX) + Math.abs(drag.velY);
    const fast = speed > SHAKE_FAST_SPEED;                  // 지금 "빠르게" 흔드는 중인가
    if(speed > 0.2) drag.lastMoveT = performance.now();     // 움직임 시각 (정신차리기 판정용)
    if(fast)        drag.lastFastT = performance.now();     // 마지막으로 빠르게 흔든 시각 (blink용)
    // dizzy: 빠른 흔들기일 때만 누적, 그 외(느린 드래그/정지)엔 감소 → 천천히 끌어선 안 쌓임
    drag.dizzy = Math.max(0, Math.min(120, drag.dizzy + (fast ? (speed - SHAKE_FAST_SPEED)*4 : 0) - dt*0.06));
    if(drag.dizzy > 30 && Math.random() < 0.08) spawnFloater('💫','#e8b25c', drag.seat);
  }
});
canvas.addEventListener('pointerup',e=>{
  if(!drag)return;
  const seat = drag.seat;
  if(!drag.moved){
    if(!seat.pinned){   // 액자 고정 캐릭터는 pet도 무시
      triggerPet(seat); for(let i=0;i<4;i++) setTimeout(()=>spawnFloater('♥','#e07d8a',seat),i*180);
      dismissSeatHeadBubble(seat);   // 말풍선 떠 있으면 클릭으로 숨김
    }
  } else if(drag.mode==='shake'){
    seat.beingShaken = false;
    // 액자 고정: Space 눌린 채 손 떼면 그 자리에 떠 있는 상태로 고정
    if(drag.pinOnRelease){
      seat.pinned = true;       // seatState가 항상 'idle' 반환 → 호흡·blink만, 상태 변경/pet 무시
      seat._pinPosY = seat.rig.position.y;   // 떨림 방지용 기준 y (선택)
    } else {
      // 정신차리기 도리도리는 멈춘 뒤 300ms부터 시작 — 그 시점 이후에 손을 놓으면
      // "이미 정신차림"으로 보고 dizzy 좌석 모션을 건너뜀.
      const stillMs = drag.lastMoveT ? (performance.now() - drag.lastMoveT) : 0;
      if(drag.dizzy >= SHAKE_DIZZY_TRIGGER && stillMs < 300){
        seat.dizzyUntil = performance.now() + 2500;
        for(let i=0;i<5;i++) setTimeout(()=>spawnFloater('💫','#c9a560',seat),i*220);
      }
    }
  }
  drag=null;
});
/* 안전망 — pointerup 누락 시 stuck 회복 (캡처 해제/포커스 잃음 등) */
function clearDragStuck(){
  if(drag){
    if(drag.seat){ drag.seat.beingShaken=false; }
    drag=null;
  }
  // 혹시 잔존한 beingShaken 보정
  if(typeof seats!=='undefined') seats.forEach(s=>{ if(s.beingShaken) s.beingShaken=false; });
}
canvas.addEventListener('pointercancel', clearDragStuck);
window.addEventListener('blur', clearDragStuck);

/* drag-drop files → selected seat */
const dropOverlay=document.getElementById('dropOverlay');
['dragenter','dragover'].forEach(ev=>window.addEventListener(ev,e=>{e.preventDefault();dropOverlay.classList.add('on');}));
['dragleave','drop'].forEach(ev=>window.addEventListener(ev,e=>{e.preventDefault();if(ev==='drop'||e.relatedTarget===null)dropOverlay.classList.remove('on');}));
window.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)handleFiles(e.dataTransfer.files,selected);});

/* 전역 마우스 NDC — 액자 고정 캐릭터의 머리가 마우스 따라가도록 */
let mouseNdcX = 0, mouseNdcY = 0;
window.addEventListener('mousemove', e=>{
  const r = canvas.getBoundingClientRect();
  mouseNdcX = ((e.clientX-r.left)/r.width)*2-1;
  mouseNdcY = -((e.clientY-r.top)/r.height)*2+1;
});

/* ============================================================ FLOATERS */
const floaters=[];
function spriteChar(ch,color){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  x.font='90px Fredoka, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(ch,64,70);
  return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true}));}
const _floaterWP=new THREE.Vector3();
let emojiReactionsEnabled = (localStorage.getItem('tw.emojiReactions') !== '0');   // 기본 켜짐
function spawnFloater(ch,color,seat){
  if(!emojiReactionsEnabled) return;   // 설정에서 꺼두면 zzz/하트/💫 등 이모지 반응 생성 안 함
  const sp=spriteChar(ch,color);
  // 캐릭터가 드래그로 흔들리는 중일 수 있으므로, group이 아니라 rig(실제 흔들리는 부분)의 월드 좌표를 기준으로.
  let ox=0, oy=1.4, oz=-0.4;
  if(seat && seat.rig){
    seat.rig.getWorldPosition(_floaterWP);
    ox=_floaterWP.x; oy=_floaterWP.y+0.9; oz=_floaterWP.z+0.1;   // 머리 위 정도로 오프셋
  } else if(seat){
    ox=seat.group.position.x;
  }
  sp.position.set(ox+(Math.random()-0.5)*0.3,oy,oz);sp.scale.set(0.3,0.3,0.3);
  sp.userData={life:0,dur:ch==='Z'?2.2:1.6,vx:(Math.random()-0.5)*0.3};scene.add(sp);floaters.push(sp);}

/* ============================================================ WARDROBE PARTS (꾸미기 파츠 부착)
   캐릭터 본(head/spine/handL/handR)에 GLB 파츠를 부착. 동시 1개/카테고리(양손 각각).
   파츠 GLB는 부착 위치에 맞춰 모델링된 전제(코드는 본에 그대로 add). */
async function equipPartOnSeat(seat, cat, rec){
  if(!seat) return;
  seat.equippedPartObjs = seat.equippedPartObjs || {};
  const info = partCatInfo(cat); if(!info) return;
  // 옷 카테고리 충돌 정리: 한벌옷 ↔ 상하의는 공존 불가
  if(rec && info.cloth){
    if(info.cloth==='onepiece'){
      // 한벌옷 착용 → 상의·하의 해제
      _unequipClothCat(seat, 'top'); _unequipClothCat(seat, 'bottom');
    } else {
      // 상의/하의 착용 → 한벌옷 해제
      _unequipClothCat(seat, 'onepiece');
    }
  }
  // 머리 영역 충돌: 모자 ↔ 탈 공존 불가 (안경은 둘 다와 공존 가능)
  if(rec){
    if(cat==='hat')  _unequipClothCat(seat, 'mask');
    if(cat==='mask') _unequipClothCat(seat, 'hat');
  }
  // 기존 같은 카테고리 파츠 제거 (동시 1개)
  unequipPartFromSeat(seat, cat);
  if(!rec){ applyClothVisibility(seat); return; }   // rec 없으면 해제만 + 기본 메시 가시성 갱신
  const bone = seat.bones && seat.bones[info.bone];
  if(!bone){ console.warn('부착할 본 없음:', info.bone); return; }
  try{
    const scene = await getPartScene(rec);
    const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(scene) : scene.clone(true);
    const flat = 1 - LIGHT_PRESET.e;
    obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false;
      const m = o.material&&o.material.clone? o.material.clone() : o.material; o.material=m;
      if(m){ if(m.map) m.emissiveMap=m.map; if(m.emissive) m.emissive.copy(m.color||new THREE.Color(0xffffff)).multiplyScalar(flat); m.needsUpdate=true; }
    }});
    obj.name = '__part_'+cat;
    // 메시 중심을 피봇으로 만들기 위해 wrapper 그룹에 감싸기 (회전·스케일이 중심 기준)
    const bb = new THREE.Box3().setFromObject(obj);
    const center = bb.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const wrapper = new THREE.Group(); wrapper.name='__partWrap_'+cat;
    wrapper.add(obj);
    wrapper.userData.baseCenter = center.clone();   // applyPartXf에서 사용
    wrapper.userData.cat = cat;
    bone.add(wrapper);
    seat.equippedPartObjs[cat] = wrapper;
    applyPartXf(seat, cat);   // 카테고리 기본 오프셋 + 캐릭터별 xf 적용
  }catch(e){ console.warn('파츠 부착 실패', e); }
  applyClothVisibility(seat);   // 옷 착용 상태에 따라 기본 상/하의 메시 숨김 갱신
}
/* 옷 카테고리만 해제 (def는 안 건드림 — 충돌 정리 내부용) */
function _unequipClothCat(seat, cat){
  unequipPartFromSeat(seat, cat);
  if(seat.charDef && seat.charDef.equippedParts) delete seat.charDef.equippedParts[cat];
}
/* 착용된 옷에 따라 기본 상/하의 메시 visible 토글 */
function applyClothVisibility(seat){
  if(!seat) return;
  const eq = (seat.charDef&&seat.charDef.equippedParts)||{};
  const hasTop = !!eq.top, hasBottom = !!eq.bottom, hasOne = !!eq.onepiece;
  // 한벌옷이면 상하의 둘 다 숨김. 아니면 각 부위 옷 있을 때만 그 부위 숨김
  if(seat.upMesh) seat.upMesh.visible = !(hasOne || hasTop);
  if(seat.loMesh) seat.loMesh.visible = !(hasOne || hasBottom);
}
/* wrapper에 카테고리 기본 오프셋 + 캐릭터별 xf 적용 (부착 시·슬라이더 변경 시 호출) */
function applyPartXf(seat, cat){
  const wrapper = seat && seat.equippedPartObjs && seat.equippedPartObjs[cat];
  if(!wrapper || !wrapper.userData || !wrapper.userData.baseCenter) return;
  const entry = seat.charDef && seat.charDef.equippedParts && seat.charDef.equippedParts[cat];
  const xf = partEntryXf(entry);
  const c = wrapper.userData.baseCenter;
  wrapper.position.copy(c);
  // 카테고리 기본 오프셋
  if(cat==='mask'){
    wrapper.position.y += MASK_Y_OFFSET;
    wrapper.position.z += MASK_Z_OFFSET;
  }
  // 캐릭터별 xf
  wrapper.position.x += xf.pos[0];
  wrapper.position.y += xf.pos[1];
  wrapper.position.z += xf.pos[2];
  wrapper.rotation.set(xf.rot[0], xf.rot[1], xf.rot[2]);
  wrapper.scale.setScalar(xf.scale);
}
function unequipPartFromSeat(seat, cat){
  if(!seat || !seat.equippedPartObjs) return;
  const obj = seat.equippedPartObjs[cat];
  if(obj && obj.parent){ obj.parent.remove(obj); }
  delete seat.equippedPartObjs[cat];
}
/* def.equippedParts({cat:{id,xf}})를 좌석에 모두 반영 */
async function applyEquippedPartsToSeat(seat, def){
  if(!seat || !def || !def.equippedParts) return;
  for(const cat in def.equippedParts){
    const id = partEntryId(def.equippedParts[cat]);
    const rec = savedParts.find(p=>p.id===id && p.cat===cat);
    if(rec) await equipPartOnSeat(seat, cat, rec);
  }
  applyClothVisibility(seat);   // 모두 반영 후 가시성 최종 갱신
}

/* ============================================================ DECORATION (꾸미기) */
function dmat(c){return new THREE.MeshStandardMaterial({color:c,roughness:0.7});}
function buildTuft(){const g=new THREE.Group();const c=dmat(0x88b06f);
  [[0,0.42,0,0.12],[-0.1,0.37,0,0.09],[0.1,0.37,0,0.09],[0,0.35,0.08,0.08]].forEach(([x,y,z,r])=>{
    const s=new THREE.Mesh(new THREE.SphereGeometry(r,12,12),c);s.position.set(x,y,z);s.castShadow=true;g.add(s);});return g;}
function buildFlower(){const g=new THREE.Group();const pet=dmat(0xf3c6d6),ctr=dmat(0xf7e08a);
  const f=new THREE.Group();for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12),pet);
    p.scale.set(1,0.5,1);p.position.set(Math.cos(i/5*6.28)*0.08,0,Math.sin(i/5*6.28)*0.08);f.add(p);}
  f.add(new THREE.Mesh(new THREE.SphereGeometry(0.045,12,12),ctr));
  f.position.set(0.2,0.36,0.12);f.rotation.x=-0.5;g.add(f);return g;}
function buildBow(){const g=new THREE.Group();const m=dmat(0xe89b9b);
  const l=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.15,12),m);l.rotation.z=Math.PI/2;l.position.x=-0.08;
  const r=l.clone();r.rotation.z=-Math.PI/2;r.position.x=0.08;
  const k=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,12),m);
  const b=new THREE.Group();b.add(l);b.add(r);b.add(k);b.position.set(0,0.36,0.16);g.add(b);return g;}
function buildHearts(){const g=new THREE.Group();const m=dmat(0xe07d8a),st=dmat(0xd9c7a8);
  [-0.12,0.12].forEach(x=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.16,8),st);
    s.position.set(x,0.45,0);g.add(s);const h=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,12),m);
    h.scale.set(1,1,0.6);h.position.set(x,0.55,0);g.add(h);});return g;}
function buildCollar(){const g=new THREE.Group();const t=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.05,12,28),dmat(0xffffff));
  t.rotation.x=Math.PI/2;t.position.y=0.26;g.add(t);return g;}
function buildScarf(){const g=new THREE.Group();const m=dmat(0xd98e73);
  const t=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.07,12,24),m);t.rotation.x=Math.PI/2;t.position.y=0.24;g.add(t);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.22,0.05),m);tail.position.set(0.16,0.05,0.22);g.add(tail);return g;}

const ITEMS={
  hair:[{id:'tuft',name:'새싹',anchor:'head',build:buildTuft},{id:'flower',name:'꽃',anchor:'head',build:buildFlower}],
  accessory:[{id:'bow',name:'리본',anchor:'head',build:buildBow},{id:'hearts',name:'하트핀',anchor:'head',build:buildHearts}],
  clothes:[{id:'collar',name:'카라',anchor:'body',build:buildCollar},{id:'scarf',name:'목도리',anchor:'body',build:buildScarf}],
};
function equip(seat,cat,def){
  if(seat.equipped[cat]){ const o=seat.equipped[cat]; if(o.parent)o.parent.remove(o); if(decorActiveItem===o)decorActiveItem=null; }
  seat.equipped[cat]=null; seat.equippedId[cat]=null;
  if(def){ const obj=def.build(); const anchor=(def.anchor==='body')?seat.bodyAnchor:seat.headAnchor;
    const pivot=new THREE.Group(); anchor.add(pivot); pivot.add(obj);
    const p0=obj.position.clone(); obj.position.set(0,0,0); pivot.position.copy(p0);
    anchor.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(obj);
    if(!box.isEmpty()){ const cw=box.getCenter(new THREE.Vector3()); const cl=pivot.worldToLocal(cw.clone());
      obj.position.sub(cl); pivot.position.add(cl); }   // 피벗 원점을 아이템 중심에 맞춤 → 회전/크기 모두 아이템 중심 기준
    seat.equipped[cat]=pivot; seat.equippedId[cat]=def.id;
    pivot.userData.base={pos:pivot.position.clone(), scale:1}; pivot.userData.adj={x:0,y:0,z:0,rotX:0,rotY:0,rotZ:0,scale:1};
    decorActiveItem=pivot; if(typeof syncItemAdjUI==='function') syncItemAdjUI();
  } else if(typeof syncItemAdjUI==='function') syncItemAdjUI();
  if(!decorRestoring) saveSeatDecor(seat);
}
function applyItemAdj(obj){ if(!obj||!obj.userData.base)return; const a=obj.userData.adj,b=obj.userData.base;
  obj.position.set(b.pos.x+(a.x||0), b.pos.y+a.y, b.pos.z+a.z); obj.rotation.set(a.rotX||0,a.rotY||0,a.rotZ||0); obj.scale.setScalar(b.scale*a.scale); }
/* === 장식 저장/복원 (빌트인 아이템: id + 조정값) === */
let decorRestoring=false;
function collectDecor(seat){ const d={}; ['hair','accessory','clothes'].forEach(cat=>{
    const id=seat.equippedId[cat], piv=seat.equipped[cat];
    d[cat]=(id&&id!=='custom'&&piv)?{id, adj:Object.assign({},piv.userData.adj)}:null; });
  return d; }
function applyDecorToSeat(seat,decor){ if(!decor)return; decorRestoring=true;
  ['hair','accessory','clothes'].forEach(cat=>{ const e=decor[cat]; if(!e||!e.id)return;
    const def=(ITEMS[cat]||[]).find(x=>x.id===e.id); if(!def)return;
    equip(seat,cat,def); const piv=seat.equipped[cat];
    if(piv&&e.adj){ Object.assign(piv.userData.adj,e.adj); applyItemAdj(piv); } });
  decorRestoring=false; }
function saveSeatDecor(seat){ if(!seat||!seat.charDef||decorRestoring)return;
  seat.charDef.decor=collectDecor(seat); if(seat.slot!=null) slots[seat.slot]=seat.charDef; saveSlots(); }

const decorOverlay=document.getElementById('decorOverlay'), decorItemsEl=document.getElementById('decorItems'),
      decorCatsEl=document.getElementById('decorCats'), decorSeatLabel=document.getElementById('decorSeatLabel'),
      decorUpload=document.getElementById('decorUpload');
let decorSeat=null, decorCat='all', decorUploadCat='hair', decorActiveItem=null;

/* 미리보기 렌더러 (별도 캔버스) */
let pRenderer=null, pScene=null, pCam=null;
function ensurePreview(){
  if(pRenderer) return;
  const pc=document.getElementById('previewCanvas');
  pRenderer=new THREE.WebGLRenderer({canvas:pc,antialias:true,alpha:true});
  pRenderer.setPixelRatio(Math.min(devicePixelRatio,2)); pRenderer.outputEncoding=THREE.sRGBEncoding;
  pRenderer.setSize(222,300,false);
  pScene=new THREE.Scene();
  pScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.9 * _MAIN_LIGHT_INT));
  const k=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT); k.position.set(0,4,0); pScene.add(k);
  const fl=new THREE.DirectionalLight(0xbcd0ff,0.3); fl.position.set(-2,2,-1); pScene.add(fl);
  pCam=new THREE.PerspectiveCamera(34,222/300,0.1,100);
  pCam.position.set(0.25,1.2,4.05); pCam.lookAt(0,0.78,0);
}
function openDecor(seat){ ensurePreview(); decorSeat=seat; selectSeat(seat);
  const d=Math.max(1,seat.userScale||1); pCam.position.set(0.25*d,1.2*d,4.05*d); pCam.lookAt(0,0.78*d,0);
  decorSeatLabel.textContent='좌석 '+(seats.indexOf(seat)+1);
  seat.inPreview=true; pScene.add(seat.group);          // 선택 캐릭터를 미리보기 씬으로 이동
  decorActiveItem=null; document.getElementById('decorGmenu').classList.remove('on');
  decorOverlay.classList.add('on'); renderDecor(); syncItemAdjUI();
}
function closeDecor(){
  document.getElementById('decorGmenu').classList.remove('on');
  if(decorSeat){ scene.add(decorSeat.group); decorSeat.inPreview=false; layoutSeats(); decorSeat=null; }
  decorOverlay.classList.remove('on');
}
function renderDecor(){
  decorItemsEl.innerHTML='';
  const cats=(decorCat==='all')?['hair','accessory','clothes']:[decorCat];
  const label={hair:'헤어',accessory:'악세',clothes:'옷'};
  cats.forEach(cat=>{
    const none=document.createElement('div'); none.className='it'+(decorSeat.equippedId[cat]?'':' equipped');
    none.innerHTML=`<span class="gl">∅</span>${label[cat]} 없음`; none.onclick=()=>{equip(decorSeat,cat,null);renderDecor();}; decorItemsEl.appendChild(none);
    ITEMS[cat].forEach(def=>{ const it=document.createElement('div'); it.className='it'+(decorSeat.equippedId[cat]===def.id?' equipped':'');
      it.innerHTML=`<span class="gl">◍</span>${def.name}`;
      it.onclick=()=>{ if(decorSeat.equippedId[cat]===def.id){ decorActiveItem=decorSeat.equipped[cat]; syncItemAdjUI(); } else { equip(decorSeat,cat,def); } renderDecor(); };
      decorItemsEl.appendChild(it);});
    const up=document.createElement('div'); up.className='it upload'; up.innerHTML=`<span class="gl">＋</span>커스텀`;
    up.onclick=()=>{decorUploadCat=cat;decorUpload.click();}; decorItemsEl.appendChild(up);
  });
}
decorCatsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  decorCat=b.dataset.cat;[...decorCatsEl.children].forEach(x=>x.classList.toggle('active',x===b));renderDecor();});
function closeDecorUI(){ const wasEdit=(appMode==='editdecor'); closeDecor(); if(wasEdit) backToLauncher(); }
document.getElementById('decorClose').addEventListener('click',closeDecorUI);
const aiY=document.getElementById('aiY'),aiRot=document.getElementById('aiRot'),aiScale=document.getElementById('aiScale'),itemAdjEl=document.getElementById('itemAdj'),rotAxesEl=document.getElementById('rotAxes');
let rotAxisSel='y';
function rotKey(){ return 'rot'+rotAxisSel.toUpperCase(); }
function syncItemAdjUI(){ const a=(decorActiveItem&&decorActiveItem.userData.adj)?decorActiveItem.userData.adj:{y:0,scale:1};
  aiY.value=a.y||0; aiScale.value=a.scale||1; aiRot.value=a[rotKey()]||0; itemAdjEl.style.opacity=decorActiveItem?'1':'0.45'; }
function bindAdj(el,key){ el.addEventListener('input',e=>{ if(!decorActiveItem)return; decorActiveItem.userData.adj[key]=+e.target.value; applyItemAdj(decorActiveItem); saveSeatDecor(decorSeat); }); }
bindAdj(aiY,'y'); bindAdj(aiScale,'scale');
aiRot.addEventListener('input',e=>{ if(!decorActiveItem)return; decorActiveItem.userData.adj[rotKey()]=+e.target.value; applyItemAdj(decorActiveItem); saveSeatDecor(decorSeat); });
rotAxesEl.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; rotAxisSel=b.dataset.ax;
  [...rotAxesEl.children].forEach(x=>x.classList.toggle('on',x===b)); aiRot.value=(decorActiveItem?(decorActiveItem.userData.adj[rotKey()]||0):0); });
/* 미리보기에서 휠로 선택 축 회전 */
document.getElementById('previewCanvas').addEventListener('wheel',e=>{ if(!decorActiveItem)return; e.preventDefault();
  const a=decorActiveItem.userData.adj, k=rotKey(); a[k]=Math.max(-3.14,Math.min(3.14,(a[k]||0)+(e.deltaY>0?0.08:-0.08)));
  aiRot.value=a[k]; applyItemAdj(decorActiveItem); saveSeatDecor(decorSeat); },{passive:false});
/* 방향키로 아이템 좌우/앞뒤 이동 */
window.addEventListener('keydown',e=>{
  if(!decorOverlay.classList.contains('on')||!decorActiveItem) return;
  if(document.activeElement&&document.activeElement.tagName==='INPUT') return;
  const step=0.02, a=decorActiveItem.userData.adj; let used=true;
  if(e.key==='ArrowLeft')a.x=(a.x||0)-step; else if(e.key==='ArrowRight')a.x=(a.x||0)+step;
  else if(e.key==='ArrowUp')a.z-=step; else if(e.key==='ArrowDown')a.z+=step; else used=false;
  if(used){ e.preventDefault(); applyItemAdj(decorActiveItem); saveSeatDecor(decorSeat); }
});
decorOverlay.addEventListener('click',e=>{ if(e.target===decorOverlay) closeDecorUI(); });
decorUpload.addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f||!decorSeat){e.target.value='';return;}
  const cat=decorUploadCat, anchorType=(cat==='clothes')?'body':'head';
  const buf=await f.arrayBuffer();
  loader.parse(buf,'',gltf=>{ const o=gltf.scene; o.traverse(n=>{if(n.isMesh)n.castShadow=true;});
    const box=new THREE.Box3().setFromObject(o); const sz=new THREE.Vector3(); box.getSize(sz);
    const s=sz.y>1e-4?0.35/sz.y:1; o.scale.set(s,s,s);
    o.position.set(0, anchorType==='head'?0.42:0.2, 0.1);
    equip(decorSeat,cat,{anchor:anchorType,id:'custom',build:()=>o});
    renderDecor();
  }, err=>console.error('item glb',err));
  e.target.value='';
});

/* 우클릭 → 그 캐릭터 꾸미기 팝업 */
canvas.addEventListener('contextmenu',e=>{ e.preventDefault();
  // 드래그 중 우클릭 → 액자 고정 (pointerup 시점에 실제 고정)
  if(drag && drag.mode==='shake'){ drag.pinOnRelease = true; return; }
  // 평상시 우클릭 → 캐릭터 수정창 직행
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(seats.map(s=>s.group),true);
  if(hit.length){
    const seat=seatFromObject(hit[0].object);
    if(seat && seat.isMe && seat.charDef) openCreator({kind:'seat',seat});
  }
});
/* 꾸미기 팝업 미리보기 우상단 톱니바퀴 → 수정 / 삭제 */
function closeDecorMenu(){document.getElementById('decorGmenu').classList.remove('on');}
document.getElementById('decorGear').onclick=e=>{e.stopPropagation();document.getElementById('decorGmenu').classList.toggle('on');};
document.getElementById('decorGmenu').addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',()=>closeDecorMenu());
document.getElementById('decorEdit').onclick=()=>{const seat=decorSeat;closeDecorMenu();if(!seat)return;
  if(!seat.charDef){toast('생성기로 만든 캐릭터가 아니에요');return;}
  closeDecor();openCreator({kind:'seat',seat});};
document.getElementById('decorDel').onclick=()=>{const seat=decorSeat;closeDecorMenu();if(!seat)return;
  if(seats.length<=1){toast('마지막 캐릭터는 지울 수 없어요');return;}
  closeDecor();removeSeat(seat);};

/* ============================================================ CREATOR + LAUNCHER */
const slots=[null,null,null]; let curSlot=0, editingSlot=-1, pendingSlot=0;
let cTopColor='#9dba8a', cBotColor='#d98e73';
const CANVAS_SZ=512;
const FACE_SYM_SUM=0.36;                 // 얼굴 UV 좌우 대칭축(u0≈0.18) → 미러 u' = 0.36 - u
const SYM_PX=FACE_SYM_SUM*CANVAS_SZ;     // 픽셀 기준 미러 합
function newCanvas(){const c=document.createElement('canvas');c.width=c.height=CANVAS_SZ;return c;}
function snapCanvas(src){const c=newCanvas();c.getContext('2d').drawImage(src,0,0);return c;}
/* 피부색 5종 — skin[0]은 face1.png(기본), 1~4는 skin-data.js의 window.SKIN_PNGS PNG 텍스처. 로드는 loadSkins()에서 */
const SKIN_COLORS=['#FFE0BD','#F1C898','#E0AC69','#C68642','#8D5524'];
const skinCanvases=SKIN_COLORS.map(c=>{const cv=newCanvas();const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,CANVAS_SZ,CANVAS_SZ);return cv;});
function skinCanvasFor(i){return skinCanvases[i]||skinCanvases[0];}
function skinColorFor(i){return SKIN_COLORS[i]||SKIN_COLORS[0];}
/* 베이스 피부 텍스처 위에 그림 레이어를 얹어 한 장으로 합성(지워도 피부는 남음) */
function compositeFace(skinIdx,drawCv){const cv=newCanvas();const x=cv.getContext('2d');x.drawImage(skinCanvasFor(skinIdx),0,0);x.drawImage(drawCv,0,0);return cv;}
function charDef(skin,face,blink,top,bot){return {type:'creator',skin,face,blink,top,bot};}

/* --- base body builder (내장 스탠드인. 실제 제품에선 리깅된 베이스 GLB로 교체) --- */
function buildCreatorBase(fTex,bTex,skinColor,top,bot){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:skinColor,roughness:0.85});
  const topMat=new THREE.MeshStandardMaterial({color:top,roughness:0.85});       // cloth_upper(상의)
  const botMat=new THREE.MeshStandardMaterial({color:bot,roughness:0.85});       // cloth_lower(하의)
  const lower=new THREE.Mesh(new THREE.SphereGeometry(0.4,28,28),botMat); lower.scale.set(1,0.7,0.9); lower.position.y=0.4; lower.castShadow=true; g.add(lower);
  const upper=new THREE.Mesh(new THREE.SphereGeometry(0.44,28,28),topMat); upper.scale.set(1,0.92,0.92); upper.position.y=0.72; upper.castShadow=true; g.add(upper);
  [-0.42,0.42].forEach(x=>{const a=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16),topMat); a.scale.set(0.7,0.7,1.1); a.position.set(x,0.64,0.2); a.castShadow=true; g.add(a);});
  const head=new THREE.Group(); head.position.y=1.18; g.add(head);
  const hm=new THREE.Mesh(new THREE.SphereGeometry(0.42,32,32),skin); hm.castShadow=true; head.add(hm);
  const faceMat=new THREE.MeshStandardMaterial({map:fTex,roughness:0.7,polygonOffset:true,polygonOffsetFactor:-2}); faceMat.name='Face';   // face 텍스처(피부+그림 합성)
  const face=new THREE.Mesh(buildFacePatchGeo(0.421,0.27,22),faceMat); head.add(face);
  return {group:g,faceMat,topMat,botMat,skinMat:skin,face,fT:fTex,bT:bTex};
}
/* 머리 앞면을 감싸는 곡면 패치(데칼). 평면 UV라 그린 캔버스가 얼굴에 그대로 박혀 보임.
   실제 제품: 베이스 GLB의 'face' 머티리얼 map = 합성 캔버스 (별도 패치 불필요) */
function buildFacePatchGeo(R,half,seg){
  const geo=new THREE.PlaneGeometry(half*2,half*2,seg,seg);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);
    const z=Math.sqrt(Math.max(0.0001,R*R-x*x-y*y)); pos.setZ(i,z);}
  pos.needsUpdate=true; geo.computeVertexNormals(); return geo;
}
/* 메쉬 geometry boundingBox만 union해서 그룹의 *진짜 메쉬 영역* 박스 계산 (본 영향 0). 커미션 GLB 정렬용 */
function calcMeshBox(group){
  const box=new THREE.Box3(), tmp=new THREE.Box3();
  group.updateMatrixWorld(true);
  group.traverse(o=>{
    if(o.isMesh && o.geometry){
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if(o.geometry.boundingBox){
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    }
  });
  return box;
}

/* 기본 GLB의 시각 영역 (BASE_SCENE 로드 후 1회 측정) — 커미션 GLB를 *기본과 동일한 위치·키*로 정렬할 때 사용 */
let BASE_MESH_MIN_Y=null, BASE_MESH_HEIGHT=null;
function measureBaseGeometry(){
  const inst = instantiateBase();
  if(!inst || !inst.root) return;
  normalizeModel(inst.root, 1.4);   // defToBase의 일반 경로와 동일한 정규화
  inst.root.updateMatrixWorld(true);
  const box = calcMeshBox(inst.root);
  if(!box.isEmpty()){
    BASE_MESH_MIN_Y = box.min.y;
    BASE_MESH_HEIGHT = box.max.y - box.min.y;
  }
}

function defToBase(def, customScene){
  const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
  const inst=instantiateBase(customScene);
  if(inst){
    setFaceMap(inst.faceMat, fT);
    if(!def.isCommission){
      if(inst.upMat)inst.upMat.color.set(def.top); if(inst.loMat)inst.loMat.color.set(def.bot);
    }
    applyLightPresetToInstance(inst);   // 생성기·메인과 같은 톤(emissive)
    normalizeModel(inst.root, 1.4, def.isCommission);
    const wrap=new THREE.Group(); wrap.add(inst.root);
    return {group:wrap, faceMat:inst.faceMat, upMat:inst.upMat, loMat:inst.loMat, fT, bT};
  }
  // 폴백: 내장 스탠드인
  const b=buildCreatorBase(fT,bT,skinColorFor(def.skin),def.top,def.bot);
  return {group:b.group, faceMat:b.faceMat, fT, bT};
}

/* --- 캐릭터에 직접 페인팅 (3D) + 단계형 + 양파껍질 + 되돌리기 --- */
const faceC=newCanvas(), blinkC=newCanvas();      // 저장 레이어(깨끗한 원본)
const dispC=newCanvas();                          // 모델에 보이는 합성 텍스처(양파껍질 포함)
const dispTex=new THREE.CanvasTexture(dispC); dispTex.flipY=false;dispTex.encoding=THREE.sRGBEncoding;
let crStep=1, creatorMode={kind:'slot',edit:false}, brushColor='#333333', brushSize=11, eraser=false, blinkEdited=false, skinIndex=0;
let currentCreatorDef = null;   // openCreator로 들어온 원본 def — 커미션 여부 판정에 사용
function isCommissionEditing(){ return !!(currentCreatorDef && currentCreatorDef.isCommission); }
let cXform={s:0.7,y:0,z:0,rot:0}, cDeskColor='#c9a36a', cDeskScale=0.7;   // 좌석 변형 · 책상 색 · 커스텀 책상 크기
let faceCamSaved=null;   // 1~3단계(피부/표정/감은눈) 카메라 각도 유지용
let deskCamSaved=null;   // 5~6단계(책상/좌석) 카메라 각도 유지용
let painting=false, lastPX=null, lastPY=null, lastSX=null, lastSY=null, symmetry=false;
const histF=[], histB=[];
const redoF=[], redoB=[];
function isDrawStep(){return crStep===2||crStep===3;}
function activeFace(){return crStep===3?'blink':'face';}
function actC(){return activeFace()==='blink'?blinkC:faceC;}
function curHist(){return activeFace()==='blink'?histB:histF;}
function curRedo(){return activeFace()==='blink'?redoB:redoF;}
function blit(){const x=dispC.getContext('2d');x.clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
  x.drawImage(skinCanvasFor(skinIndex),0,0);          // 베이스 피부(지워지지 않는 원본)
  x.drawImage(crStep===3?blinkC:faceC,0,0);           // 그림 레이어
  dispTex.needsUpdate=true;}
function pushHistory(){const h=curHist();try{h.push(actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ));}catch(e){}if(h.length>30)h.shift();
  curRedo().length=0;   // 새 액션 → redo 스택 폐기 (표준 동작)
}
function undo(){const h=curHist();if(!h.length)return;
  try{const cur=actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ); const rs=curRedo(); rs.push(cur); if(rs.length>30)rs.shift();}catch(e){}
  actC().getContext('2d').putImageData(h.pop(),0,0);blit();}
function redo(){const rs=curRedo();if(!rs.length)return;
  try{const cur=actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ); curHist().push(cur); if(curHist().length>30)curHist().shift();}catch(e){}
  actC().getContext('2d').putImageData(rs.pop(),0,0);blit();}
function _seg(ctx,x0,y0,x1,y1){ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
/* === 3D 메쉬 중앙 기준 x축 대칭 ===
   미러 지점을 메쉬 로컬에서 x반전한 뒤, 그 지점에 두 번째 레이캐스트를 쏘아 '실제 표면'의 UV를 얻음.
   (UV 솔기로 같은 3D점에 UV가 여러 개여도 정확한 표면 UV를 가져옴) */
const _mp=new THREE.Vector3(), _mn=new THREE.Vector3(), _mo=new THREE.Vector3(), _mray=new THREE.Raycaster(), _mdir=new THREE.Vector3();
function mirrorUV(hit){ if(!cBase||!cBase.face||!hit)return null;
  _mp.copy(hit.point); cBase.face.worldToLocal(_mp); _mp.x = 2*(cBase.faceCx||0) - _mp.x; cBase.face.localToWorld(_mp);  // 미러 표면점(월드)
  const n=hit.face&&hit.face.normal;
  if(n){ _mn.set(-n.x,n.y,n.z).transformDirection(cBase.face.matrixWorld).normalize(); }   // 미러된 바깥 법선
  else { _mn.copy(cCam.position).sub(_mp).normalize(); }
  _mo.copy(_mp).addScaledVector(_mn,0.6);                 // 표면 바깥에서
  _mdir.copy(_mn).negate();                               // 표면 쪽으로
  _mray.set(_mo,_mdir);
  const h=_mray.intersectObject(cBase.face,false);
  if(h.length&&h[0].uv) return {x:h[0].uv.x,y:h[0].uv.y};
  return null; }
function strokeSeg(ctx,lx,ly,x,y){ if(lx==null)_seg(ctx,x,y,x+0.01,y+0.01); else _seg(ctx,lx,ly,x,y); }
function paintAt(hit){ const ctx=actC().getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=brushSize;
  ctx.globalCompositeOperation=eraser?'destination-out':'source-over';ctx.strokeStyle=brushColor;
  const cx=hit.uv.x*CANVAS_SZ, cy=hit.uv.y*CANVAS_SZ;
  strokeSeg(ctx,lastPX,lastPY,cx,cy); lastPX=cx; lastPY=cy;
  if(symmetry){ const m=mirrorUV(hit);
    if(m){ const mx=m.x*CANVAS_SZ, my=m.y*CANVAS_SZ; strokeSeg(ctx,lastSX,lastSY,mx,my); lastSX=mx; lastSY=my; }
    else { lastSX=lastSY=null; } }
  ctx.globalCompositeOperation='source-over'; blit(); }
const _pray=new THREE.Raycaster(), _pndc=new THREE.Vector2();
function paintFromEvent(e){ if(!isDrawStep()||!cBase)return;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  _pndc.x=((e.clientX-r.left)/r.width)*2-1; _pndc.y=-((e.clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,cCam);
  const hit=_pray.intersectObject(cBase.face,false);
  if(hit.length&&hit[0].uv){ paintAt(hit[0]); } else { lastPX=lastPY=null; lastSX=lastSY=null; } }
// 우클릭 스포이드: 표정 텍스처 캔버스에서 픽셀 색을 읽어 브러시 색으로 적용
function eyedropFromEvent(e){ if(!isDrawStep()||!cBase)return false;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  _pndc.x=((e.clientX-r.left)/r.width)*2-1; _pndc.y=-((e.clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,cCam);
  const hit=_pray.intersectObject(cBase.face,false);
  if(!hit.length||!hit[0].uv) return false;
  const cx=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(hit[0].uv.x*CANVAS_SZ)));
  const cy=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(hit[0].uv.y*CANVAS_SZ)));
  let d; try{ d=actC().getContext('2d').getImageData(cx,cy,1,1).data; }catch(_){ return false; }
  if(d[3]<8) return false;   // 빈 픽셀은 무시
  const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  brushColor=hex; eraser=false;
  const eb=document.getElementById('eraserBtn'); if(eb)eb.classList.remove('on');
  const bc=document.getElementById('brushCustom'); if(bc)bc.value=hex;
  [...swEl.children].forEach(x=>x.classList.remove('on'));
  return true; }
/* === 이미지 도장 (절충안: 떠 있는 미리보기 → Z 또는 ✓로 확정 박기) =================
   흐름:
   1) 이미지 불러오면 캔버스 위에 떠 있는 오버레이로 표시. 4코너 핸들로 비례 크기, 회전 손잡이로 회전, 본체 드래그로 이동.
   2) Z 또는 ✓ 박기 → 현재 위치/크기/회전 그대로 face에 박힘. 곡면 왜곡은 격자 raycast로 자연스럽게.
   3) ESC 또는 ✕ 취소 → 박지 않고 빠져나옴.
   대칭 ON이면 박을 때 거울 위치에도 동시 박힘.
=========================================================================== */
let stampMode=false, stampImg=null;
let stampDirty=false;   // true면 사용자가 크기/회전을 만진 상태 — 새 이미지 불러와도 이전 변형 유지(b안: 가로·세로 그대로)
// placement: 캔버스(미리보기) 픽셀 좌표 기준. cx,cy = 중심, w/h = 화면상 크기, rot = 라디안
let stampPlace={cx:0,cy:0,w:120,h:120,rot:0,aspect:1};
function stampOverlayEl(){return document.getElementById('stampOverlay');}
function refreshStampOverlay(){
  const ov=stampOverlayEl(); if(!ov||!stampMode||!stampImg){if(ov)ov.style.display='none';return;}
  // 오버레이의 부모는 .decor-left지만 stampPlace.cx/cy는 캔버스 기준 좌표 → 캔버스의 부모 내 오프셋을 더해야 일치
  const cv=document.getElementById('creatorPreview');
  const ox=cv.offsetLeft, oy=cv.offsetTop;
  ov.style.display='block';
  ov.style.left=(ox+stampPlace.cx-stampPlace.w/2)+'px';
  ov.style.top=(oy+stampPlace.cy-stampPlace.h/2)+'px';
  ov.style.width=stampPlace.w+'px';
  ov.style.height=stampPlace.h+'px';
  ov.style.transform=`rotate(${stampPlace.rot}rad)`;
}
function setStampMode(on){
  stampMode=on;
  const sb=document.getElementById('stampBtn'); if(sb)sb.classList.toggle('on',on);
  const sp=document.getElementById('stampPanel'); if(sp)sp.style.display=on?'flex':'none';
  if(on){ eraser=false; const eb=document.getElementById('eraserBtn'); if(eb)eb.classList.remove('on');
    // 이전에 불러둔 이미지가 있으면 버튼 다시 노출 (모드 OFF→ON 복귀 시 이미지 유지)
    if(stampImg){
      const sa=document.getElementById('stampApply'); if(sa)sa.style.display='inline-block';
      const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='inline-block';
    }
  }
  refreshStampOverlay();
  const cv=document.getElementById('creatorPreview'); if(cv)cv.style.cursor=isDrawStep()?'crosshair':'default';
}
/* 도장 상태(이미지·썸네일·위치·핸들 패널) 완전 초기화 — 생성기를 닫을 때만 사용 */
function clearStampState(){
  stampMode=false; stampImg=null; stampDirty=false;
  const th=document.getElementById('stampThumb'); if(th){th.style.display='none';th.src='';}
  const sa=document.getElementById('stampApply'); if(sa)sa.style.display='none';
  const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='none';
  const sb=document.getElementById('stampBtn'); if(sb)sb.classList.remove('on');
  const sp=document.getElementById('stampPanel'); if(sp)sp.style.display='none';
  const ov=document.getElementById('stampOverlay'); if(ov)ov.style.display='none';
}
function loadStampFromFile(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return;
  const r=new FileReader();
  r.onload=ev=>{ const im=new Image(); im.onload=()=>{ stampImg=im;
    const th=document.getElementById('stampThumb'); if(th){ th.src=ev.target.result; th.style.display='inline-block'; }
    document.getElementById('stampOverlayImg').src=ev.target.result;
    document.getElementById('stampApply').style.display='inline-block';
    document.getElementById('stampCancel').style.display='inline-block';
    // 사용자가 이전에 변형(크기/회전)을 만진 상태(stampDirty)면 그대로 유지 → 이미지만 교체. 늘어남 OK(b안).
    if(!stampDirty){
      const cv=document.getElementById('creatorPreview'), r2=cv.getBoundingClientRect();
      stampPlace.aspect = im.naturalWidth/Math.max(1,im.naturalHeight);
      const baseW = Math.min(r2.width, r2.height) * 0.4;
      stampPlace.w = baseW; stampPlace.h = baseW / stampPlace.aspect;
      stampPlace.cx = r2.width/2; stampPlace.cy = r2.height/2; stampPlace.rot=0;
    } else {
      // 새 이미지의 aspect만 갱신 (코너 핸들 Shift 비례 복귀 시 새 이미지의 원본 비율 기준)
      stampPlace.aspect = im.naturalWidth/Math.max(1,im.naturalHeight);
    }
    if(!stampMode) setStampMode(true);
    refreshStampOverlay();
  }; im.src=ev.target.result; };
  r.readAsDataURL(file);
}
/* 도장 변형(크기/회전) 초기화 — 위치(cx,cy)는 그대로, 모양만 디폴트로 */
function resetStampPlacement(){
  if(!stampImg) return;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  stampPlace.aspect = stampImg.naturalWidth/Math.max(1,stampImg.naturalHeight);
  const baseW = Math.min(r.width, r.height) * 0.4;
  stampPlace.w = baseW; stampPlace.h = baseW / stampPlace.aspect;
  stampPlace.rot = 0;
  stampDirty = false;   // 초기화했으니 dirty 해제 → 다음 이미지 로드 시 또 디폴트로
  refreshStampOverlay();
}

/* face 위에 떠 있는 이미지를 격자로 잘라 그려서 곡면 왜곡 표현
   - 미리보기 캔버스(픽셀) 좌표의 사각형 4꼭짓점을 raycast → face UV 4점
   - 격자(N×N)로 세분화하여 작은 quad마다 이미지 일부를 affine 매핑으로 그림
   - face에 안 닿는 격자 점은 폐기 (구멍이 생길 수 있지만 자연스러움) */
function commitStamp(){
  if(!stampImg||!cBase||!cBase.face)return;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  // 도장 오버레이의 4꼭짓점(미리보기 픽셀)
  const cx=stampPlace.cx, cy=stampPlace.cy, w=stampPlace.w, h=stampPlace.h, rot=stampPlace.rot;
  const cs=Math.cos(rot), sn=Math.sin(rot);
  function localToScreen(lx,ly){ // (-0.5..0.5)*w,h → 화면 픽셀
    return {x: cx + lx*cs - ly*sn, y: cy + lx*sn + ly*cs};
  }
  // N×N 격자
  const N=18;
  // 각 격자 점의 face UV(있으면) 계산
  const uvs=[]; // [j*(N+1)+i] = {uv:{x,y}} or null
  for(let j=0;j<=N;j++){
    for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*w, ly=(j/N-0.5)*h;
      const sp=localToScreen(lx,ly);
      // 화면 좌표 → NDC (캔버스 픽셀 크기는 r.width/r.height 사용)
      _pndc.x=(sp.x/r.width)*2-1; _pndc.y=-(sp.y/r.height)*2+1;
      _pray.setFromCamera(_pndc,cCam);
      const hit=_pray.intersectObject(cBase.face,false);
      uvs.push(hit.length&&hit[0].uv ? {x:hit[0].uv.x, y:hit[0].uv.y} : null);
    }
  }
  pushHistory();
  // 가장자리 폐기 셀의 UV를 인접 유효 셀에서 *바깥으로 외삽*해서 채움 — 도장이 얼굴을 더 꽉 채우게
  // 외삽한 UV가 0..1 약간 벗어나는 범위(-0.05..1.05)까지는 클램프해서 살리고, 그 밖은 폐기.
  function extrapolateUVs(arr, N){
    function tryExtra(i,j,uv){ const ex=Math.max(0,Math.min(1,uv.x)), ey=Math.max(0,Math.min(1,uv.y));
      if(uv.x>=-0.05&&uv.x<=1.05&&uv.y>=-0.05&&uv.y<=1.05){ arr[j*(N+1)+i]={x:ex,y:ey}; return true; } return false; }
    // 행별 좌→우 / 우→좌 외삽
    for(let j=0;j<=N;j++){
      let i1=-1,i2=-1;
      for(let i=0;i<=N;i++){ if(arr[j*(N+1)+i]){ if(i1<0)i1=i; else if(i2<0){i2=i;break;} } }
      if(i1>=0&&i2>=0){
        const u1=arr[j*(N+1)+i1], u2=arr[j*(N+1)+i2], dx=(u2.x-u1.x)/(i2-i1), dy=(u2.y-u1.y)/(i2-i1);
        for(let i=i1-1;i>=0;i--){ if(!tryExtra(i,j,{x:u1.x+dx*(i-i1),y:u1.y+dy*(i-i1)})) break; }
      }
      let k1=-1,k2=-1;
      for(let i=N;i>=0;i--){ if(arr[j*(N+1)+i]){ if(k1<0)k1=i; else if(k2<0){k2=i;break;} } }
      if(k1>=0&&k2>=0){
        const u1=arr[j*(N+1)+k1], u2=arr[j*(N+1)+k2], dx=(u1.x-u2.x)/(k1-k2), dy=(u1.y-u2.y)/(k1-k2);
        for(let i=k1+1;i<=N;i++){ if(!tryExtra(i,j,{x:u1.x+dx*(i-k1),y:u1.y+dy*(i-k1)})) break; }
      }
    }
    // 열별 상→하 / 하→상 외삽 (행 외삽 후 남은 코너·전체 결손 행 처리)
    for(let i=0;i<=N;i++){
      let j1=-1,j2=-1;
      for(let j=0;j<=N;j++){ if(arr[j*(N+1)+i]){ if(j1<0)j1=j; else if(j2<0){j2=j;break;} } }
      if(j1>=0&&j2>=0){
        const u1=arr[j1*(N+1)+i], u2=arr[j2*(N+1)+i], dx=(u2.x-u1.x)/(j2-j1), dy=(u2.y-u1.y)/(j2-j1);
        for(let j=j1-1;j>=0;j--){ if(!tryExtra(i,j,{x:u1.x+dx*(j-j1),y:u1.y+dy*(j-j1)})) break; }
      }
      let m1=-1,m2=-1;
      for(let j=N;j>=0;j--){ if(arr[j*(N+1)+i]){ if(m1<0)m1=j; else if(m2<0){m2=j;break;} } }
      if(m1>=0&&m2>=0){
        const u1=arr[m1*(N+1)+i], u2=arr[m2*(N+1)+i], dx=(u1.x-u2.x)/(m1-m2), dy=(u1.y-u2.y)/(m1-m2);
        for(let j=m1+1;j<=N;j++){ if(!tryExtra(i,j,{x:u1.x+dx*(j-m1),y:u1.y+dy*(j-m1)})) break; }
      }
    }
  }
  extrapolateUVs(uvs, N);
  const ctx=actC().getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';   // 부드러운 보간으로 셀 경계 시인성 ↓
  const imgW=stampImg.naturalWidth, imgH=stampImg.naturalHeight;
  // 셀별로 삼각형 2개씩 그려서 매핑. 누락 셀은 폐기. 클립 영역을 셀 중심에서 외측으로 살짝 부풀려 인접 셀과 겹치게 → 흰선 제거.
  function drawTri(s0,s1,s2,d0,d1,d2){
    // d* = 도착 face UV (0..1) → 캔버스 픽셀
    const dx0=d0.x*CANVAS_SZ, dy0=d0.y*CANVAS_SZ;
    const dx1=d1.x*CANVAS_SZ, dy1=d1.y*CANVAS_SZ;
    const dx2=d2.x*CANVAS_SZ, dy2=d2.y*CANVAS_SZ;
    // 삼각형 중심을 기준으로 각 꼭짓점을 0.75px만큼 바깥으로 밀어내 클립 영역을 부풀림(이미지 매핑 변환은 원본 좌표로 유지)
    const ccx=(dx0+dx1+dx2)/3, ccy=(dy0+dy1+dy2)/3;
    function bloat(x,y){ const vx=x-ccx, vy=y-ccy, m=Math.hypot(vx,vy); if(m<1e-3)return [x,y]; const k=(m+0.75)/m; return [ccx+vx*k, ccy+vy*k]; }
    const [bx0,by0]=bloat(dx0,dy0), [bx1,by1]=bloat(dx1,dy1), [bx2,by2]=bloat(dx2,dy2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(bx0,by0); ctx.lineTo(bx1,by1); ctx.lineTo(bx2,by2); ctx.closePath(); ctx.clip();
    // src 삼각형 → dst 삼각형 (원본 꼭짓점 사용, 부풀린 좌표는 클립 영역에만 영향)
    const a=s1.x-s0.x, b=s2.x-s0.x, c=s1.y-s0.y, d=s2.y-s0.y;
    const det=a*d-b*c; if(Math.abs(det)<1e-6){ctx.restore();return;}
    const ia=d/det, ib=-b/det, ic=-c/det, id=a/det;
    const e=dx1-dx0, f=dx2-dx0, g=dy1-dy0, hh=dy2-dy0;
    const m11=e*ia+f*ic, m12=e*ib+f*id, m21=g*ia+hh*ic, m22=g*ib+hh*id;
    const tx=dx0-(m11*s0.x+m12*s0.y), ty=dy0-(m21*s0.x+m22*s0.y);
    ctx.setTransform(m11,m21,m12,m22,tx,ty);
    ctx.drawImage(stampImg,0,0);
    ctx.restore();
  }
  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const a=uvs[j*(N+1)+i], b=uvs[j*(N+1)+(i+1)], c=uvs[(j+1)*(N+1)+i], d=uvs[(j+1)*(N+1)+(i+1)];
      // 셀의 4 src 점(이미지 좌표)
      const su0={x:(i/N)*imgW,    y:(j/N)*imgH};
      const su1={x:((i+1)/N)*imgW,y:(j/N)*imgH};
      const su2={x:(i/N)*imgW,    y:((j+1)/N)*imgH};
      const su3={x:((i+1)/N)*imgW,y:((j+1)/N)*imgH};
      if(a&&b&&c) drawTri(su0,su1,su2,a,b,c);
      if(b&&c&&d) drawTri(su1,su2,su3,b,c,d);
    }
  }
  // 대칭: 미리보기에서 cx를 중심선 기준으로 거울 반사한 위치에 동일 동작
  if(symmetry){
    const savedCx=stampPlace.cx, savedRot=stampPlace.rot;
    stampPlace.cx = r.width - savedCx;
    stampPlace.rot = -savedRot;
    // 거울 도장: 이미지를 좌우 반전한 뒤 같은 방식으로
    const off=document.createElement('canvas'); off.width=imgW; off.height=imgH;
    const octx=off.getContext('2d'); octx.translate(imgW,0); octx.scale(-1,1); octx.drawImage(stampImg,0,0);
    const savedImg=stampImg; stampImg=off;
    // 격자 raycast 다시
    const uvs2=[];
    const cs2=Math.cos(stampPlace.rot), sn2=Math.sin(stampPlace.rot);
    for(let j=0;j<=N;j++){ for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*stampPlace.w, ly=(j/N-0.5)*stampPlace.h;
      const sx=stampPlace.cx+lx*cs2-ly*sn2, sy=stampPlace.cy+lx*sn2+ly*cs2;
      _pndc.x=(sx/r.width)*2-1; _pndc.y=-(sy/r.height)*2+1;
      _pray.setFromCamera(_pndc,cCam);
      const hit=_pray.intersectObject(cBase.face,false);
      uvs2.push(hit.length&&hit[0].uv?{x:hit[0].uv.x,y:hit[0].uv.y}:null);
    }}
    extrapolateUVs(uvs2, N);
    for(let j=0;j<N;j++){ for(let i=0;i<N;i++){
      const a=uvs2[j*(N+1)+i], b=uvs2[j*(N+1)+(i+1)], c=uvs2[(j+1)*(N+1)+i], d=uvs2[(j+1)*(N+1)+(i+1)];
      const su0={x:(i/N)*imgW,y:(j/N)*imgH}, su1={x:((i+1)/N)*imgW,y:(j/N)*imgH};
      const su2={x:(i/N)*imgW,y:((j+1)/N)*imgH}, su3={x:((i+1)/N)*imgW,y:((j+1)/N)*imgH};
      if(a&&b&&c) drawTri(su0,su1,su2,a,b,c);
      if(b&&c&&d) drawTri(su1,su2,su3,b,c,d);
    }}
    stampImg=savedImg; stampPlace.cx=savedCx; stampPlace.rot=savedRot;
  }
  if(crStep===3)blinkEdited=true;
  blit();
  // 모드·이미지·위치 모두 유지 → 같은 이미지로 다른 위치에 연속 찍기 가능. 종료는 ESC/✕/다른 도구 선택/단계 이동으로.
}
function cancelStamp(){ setStampMode(false); }

/* 오버레이 조작: 이미지 본체 드래그=이동, 코너=비례 크기, 회전 손잡이=회전 */
function bindStampOverlay(){
  const ov=document.getElementById('stampOverlay');
  const img=document.getElementById('stampOverlayImg');
  const cv=document.getElementById('creatorPreview');
  let drag=null;   // {type:'move'|'tl'|'tr'|'bl'|'br'|'rot', startX,startY, ...}
  function pos(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  img.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    const p=pos(e); drag={type:'move',sx:p.x,sy:p.y,ox:stampPlace.cx,oy:stampPlace.cy};
    img.setPointerCapture(e.pointerId);
  });
  ['tl','tr','bl','br'].forEach(corner=>{
    const h=ov.querySelector('.stamp-h-'+corner);
    h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
      const p=pos(e);
      // 대각 반대편 코너를 고정점으로 잡음. 회전을 고려해 *로컬* 좌표에서 계산
      // sx = corner의 로컬 x 부호 (-0.5 = 왼쪽 코너, +0.5 = 오른쪽), sy도 같은 식
      const sx=(corner==='tl'||corner==='bl')?-0.5:0.5;
      const sy=(corner==='tl'||corner==='tr')?-0.5:0.5;
      // 화면(부모) 좌표계에서 고정점(대각 반대편 코너)의 위치를 계산
      const cs=Math.cos(stampPlace.rot), sn=Math.sin(stampPlace.rot);
      const fxL=-sx*stampPlace.w, fyL=-sy*stampPlace.h;   // 고정점의 로컬 좌표
      const fixedX=stampPlace.cx + fxL*cs - fyL*sn;
      const fixedY=stampPlace.cy + fxL*sn + fyL*cs;
      drag={type:corner, sx, sy, fixedX, fixedY, oAspect: stampPlace.aspect||(stampPlace.w/Math.max(1,stampPlace.h))};
      h.setPointerCapture(e.pointerId);
    });
  });
  const rh=ov.querySelector('.stamp-h-rot');
  rh.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    const p=pos(e); const ang=Math.atan2(p.y-stampPlace.cy,p.x-stampPlace.cx);
    drag={type:'rot',startAng:ang,oRot:stampPlace.rot};
    rh.setPointerCapture(e.pointerId);
  });
  // 회전 손잡이 옆 ↺: 크기/회전 디폴트로(위치 유지). stampDirty 해제하여 다음 이미지 로드 시에도 디폴트로 들어옴.
  const rs=ov.querySelector('.stamp-h-reset');
  if(rs){ rs.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
    rs.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();resetStampPlacement();}); }
  function onMove(e){ if(!drag)return; const p=pos(e);
    if(drag.type==='move'){
      stampPlace.cx=drag.ox+(p.x-drag.sx); stampPlace.cy=drag.oy+(p.y-drag.sy);
      // Shift = 캔버스 가로 중앙선으로 자동 스냅, y만 따라감
      if(e.shiftKey){ const cv=document.getElementById('creatorPreview'); stampPlace.cx=cv.getBoundingClientRect().width/2; }
    }
    else if(drag.type==='rot'){ const ang=Math.atan2(p.y-stampPlace.cy,p.x-stampPlace.cx);
      let r=drag.oRot+(ang-drag.startAng);
      if(e.shiftKey){ const step=15*Math.PI/180; r=Math.round(r/step)*step; }   // 15도 스냅
      stampPlace.rot=r;
      stampDirty=true;
    }
    else { // 코너 자유변형: 대각 반대편 코너(fixedX/fixedY)를 고정점으로 잡고 마우스 위치가 새 코너
      // 마우스 위치를 *고정점 기준 로컬 좌표*로 변환(회전 역적용)해서 폭/높이 추출
      const cs=Math.cos(-stampPlace.rot), sn=Math.sin(-stampPlace.rot);
      const dx=p.x-drag.fixedX, dy=p.y-drag.fixedY;
      const localX=dx*cs - dy*sn;   // 고정점→마우스 방향의 로컬 x (드래그 코너의 부호와 같은 방향이어야 양수)
      const localY=dx*sn + dy*cs;
      // 드래그 코너의 부호(sx,sy = ±0.5). 반대편 부호로 곱해 폭/높이의 절댓값 추출
      let newW=Math.abs(localX), newH=Math.abs(localY);
      newW=Math.max(20,newW); newH=Math.max(20,newH);
      // Shift: 비례 고정 (큰 변화량 쪽 비율 따라 양 축 같이)
      if(e.shiftKey){
        const ar=drag.oAspect;
        // newW/newH 중 ar에서 더 멀어진 쪽을 우선 — 사용자 의도에 가까움
        if(newW/newH > ar) newH=newW/ar; else newW=newH*ar;
      }
      stampPlace.w=newW; stampPlace.h=newH;
      // 새 중심: 고정점에서 *드래그 코너 방향*으로 (w/2, h/2)만큼 떨어진 곳의 반대 = 고정점에서 중심까지 (sx*w, sy*h) 만큼 (로컬)에 회전 적용
      const cs2=Math.cos(stampPlace.rot), sn2=Math.sin(stampPlace.rot);
      const cxL=drag.sx*newW, cyL=drag.sy*newH;
      stampPlace.cx=drag.fixedX + cxL*cs2 - cyL*sn2;
      stampPlace.cy=drag.fixedY + cxL*sn2 + cyL*cs2;
      stampDirty=true;
    }
    refreshStampOverlay();
  }
  function onUp(){ drag=null; }
  addEventListener('pointermove',onMove);
  addEventListener('pointerup',onUp);
  addEventListener('pointercancel',onUp);
}

function bindPaint(){const cv=document.getElementById('creatorPreview');
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{
    if(!isDrawStep())return;
    // 도장 편집 중에는 캔버스 클릭으로 그리지 않음(오버레이 조작 우선)
    if(stampMode) return;
    // 우클릭(또는 ctrl+클릭): 스포이드. 단발성이므로 painting은 켜지 않음
    if(e.button===2){ if(crStep===3)blinkEdited=true; eyedropFromEvent(e); return; }
    if(e.button!==0)return;
    if(crStep===3)blinkEdited=true;pushHistory();painting=true;lastPX=lastPY=null;lastSX=lastSY=null;paintFromEvent(e);cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove',e=>{
    if(!painting)return;
    const evs=(typeof e.getCoalescedEvents==='function')?e.getCoalescedEvents():null;
    if(evs&&evs.length){ for(const ce of evs) paintFromEvent(ce); }
    else paintFromEvent(e);
  });
  cv.addEventListener('pointerup',()=>{painting=false;lastPX=lastPY=null;lastSX=lastSY=null;});
  cv.addEventListener('wheel',e=>{e.preventDefault();camDist=Math.max(0.4,Math.min(7,camDist*(e.deltaY>0?1.12:0.89)));updateCreatorCam();},{passive:false});
  // 드래그앤드롭: 이미지 파일을 캔버스에 떨어뜨리면 도장으로 불러옴
  cv.addEventListener('dragover',e=>{e.preventDefault();});
  cv.addEventListener('drop',e=>{e.preventDefault(); if(!isDrawStep())return;
    const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadStampFromFile(f);
  });
  bindStampOverlay();
}
addEventListener('keydown',e=>{
  if(!creatorOpen)return;
  // Ctrl+Shift+Z = redo (Ctrl+Z보다 먼저 체크 — shift 조합이 더 구체적)
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();redo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
  // Delete: 표정 그리기 단계에서 전체 지우기 (clearBtn과 동일 동작). input/textarea에 포커스면 무시.
  if(e.key==='Delete' && isDrawStep()){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    pushHistory();
    actC().getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
    blit();
  }
  // C: 지우개 ON/OFF 토글 (포토샵식). modifier가 있으면 무시 (Ctrl+C 복사 등과 충돌 회피)
  if((e.key==='c'||e.key==='C') && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    const eb=document.getElementById('eraserBtn');
    if(eb) eb.click();   // 기존 토글 핸들러 재사용 — eraser 변수와 버튼 클래스가 한 곳에서 관리됨
  }
  // X: 좌우 대칭 ON/OFF 토글
  if((e.key==='x'||e.key==='X') && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    const sb=document.getElementById('symBtn');
    if(sb) sb.click();
  }
  // Z: 도장 모드 ON/OFF 토글 (찍기는 Enter 또는 ✓ 버튼)
  if((e.key==='z'||e.key==='Z') && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    setStampMode(!stampMode);
  }
  // Enter: 도장 편집 중이면 찍기 (✓ 버튼과 동일)
  if(e.key==='Enter' && stampMode && stampImg){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='button')return;   // 버튼 포커스 중엔 무시(스페이스/엔터로 버튼 활성화)
    e.preventDefault();
    commitStamp();
  }
  // ESC: 도장 편집 중이면 취소(박지 않고 빠져나옴)
  if(e.key==='Escape' && stampMode){
    e.preventDefault();
    cancelStamp();
  }
});
const swEl=document.getElementById('brushColors');
['#333333','#ffffff','#e0607a','#5a8fd8','#e0a050'].forEach((c,i)=>{const s=document.createElement('span');
  s.className='sw'+(i===0?' on':'');s.style.background=c;
  s.onclick=()=>{brushColor=c;eraser=false;document.getElementById('eraserBtn').classList.remove('on');[...swEl.children].forEach(x=>x.classList.toggle('on',x===s));};
  swEl.appendChild(s);});
document.getElementById('brushCustom').addEventListener('input',e=>{brushColor=e.target.value;eraser=false;
  document.getElementById('eraserBtn').classList.remove('on');[...swEl.children].forEach(x=>x.classList.remove('on'));});
document.getElementById('brushSize').addEventListener('input',e=>brushSize=+e.target.value);
document.getElementById('eraserBtn').addEventListener('click',e=>{
  if(stampMode) setStampMode(false);   // 지우개와 도장은 동시 사용 X
  eraser=!eraser; e.target.classList.toggle('on',eraser);
});
document.getElementById('symBtn').addEventListener('click',e=>{symmetry=!symmetry;e.target.classList.toggle('on',symmetry);});
document.getElementById('clearBtn').addEventListener('click',()=>{pushHistory();actC().getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);blit();});
/* 도장 모드 + 파일 입력 + 슬라이더 */
document.getElementById('stampBtn').addEventListener('click',()=>setStampMode(!stampMode));
document.getElementById('stampLoad').addEventListener('click',()=>document.getElementById('stampFile').click());
document.getElementById('stampFile').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0]; if(f) loadStampFromFile(f);
  e.target.value='';
});
document.getElementById('stampApply').addEventListener('click',()=>commitStamp());
document.getElementById('stampCancel').addEventListener('click',()=>cancelStamp());
document.getElementById('blinkResetBtn').addEventListener('click',()=>{ if(crStep!==3)return;
  pushHistory();   // 되돌리기 가능하게
  const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); blinkEdited=false; blit(); });
document.getElementById('undoBtn').addEventListener('click',undo);
const ROT_STEP=Math.PI/12;   // 15°
document.getElementById('cpLeft').addEventListener('click',()=>{camYaw-=ROT_STEP;updateCreatorCam();});
document.getElementById('cpRight').addEventListener('click',()=>{camYaw+=ROT_STEP;updateCreatorCam();});
document.getElementById('cpUp').addEventListener('click',()=>{camTarget.y+=0.12;updateCreatorCam();});
document.getElementById('cpDown').addEventListener('click',()=>{camTarget.y-=0.12;updateCreatorCam();});
document.getElementById('cpReset').addEventListener('click',()=>{
  // 현재 단계 그룹의 저장된 카메라를 비우고 그 그룹의 기본 카메라로 되돌림
  if(crStep<=3){          // 표정·감은눈 그룹
    faceCamSaved=null;
    if(cFaceCenter){ camTarget.copy(cFaceCenter); camDist=cFaceDist; camYaw=0; camPitch=0.0; }
  } else if(crStep>=5){   // 책상·좌석 그룹
    deskCamSaved=null;
    frameDeskCam(false);
  } else {                // 4단계(전신 색상) — 단독
    camTarget.copy(cBodyCenter); camDist=cBodyDist; camYaw=0; camPitch=0.04;
  }
  updateCreatorCam();
});
document.getElementById('topColor').addEventListener('input',e=>{cTopColor=e.target.value;if(cBase&&cBase.upMat)cBase.upMat.color.set(cTopColor);updateCreatorLights();});
document.getElementById('botColor').addEventListener('input',e=>{cBotColor=e.target.value;if(cBase&&cBase.loMat)cBase.loMat.color.set(cBotColor);updateCreatorLights();});
const skinRow=document.getElementById('skinRow');
const skinSwatchEls=[];
SKIN_COLORS.forEach((c,i)=>{const s=document.createElement('button');s.className='skin-sw'+(i===0?' on':'');s.style.background=c;
  s.onclick=()=>{skinIndex=i;[...skinRow.children].forEach((x,j)=>x.classList.toggle('on',j===i));blit();};   // 스킨은 face 텍스처 베이스로 합성됨
  skinRow.appendChild(s);skinSwatchEls.push(s);});
/* 스와치 대표색을 캔버스에서 추출 (평평한 피부 영역 샘플) */
function swatchColorFromCanvas(cv){try{const p=cv.getContext('2d').getImageData(Math.floor(CANVAS_SZ*0.8),Math.floor(CANVAS_SZ*0.8),1,1).data;return 'rgb('+p[0]+','+p[1]+','+p[2]+')';}catch(e){return null;}}
function refreshSkinSwatch(i){const col=swatchColorFromCanvas(skinCanvasFor(i));if(col&&skinSwatchEls[i])skinSwatchEls[i].style.background=col;}
/* 내장된 피부 PNG를 skin[0..4]에 로드 (skin-data.js의 window.SKIN_PNGS) */
function loadSkins(){const pngs=window.SKIN_PNGS||{};
  return Promise.all(Object.keys(pngs).map(k=>new Promise(res=>{const idx=+k;const img=new Image();
    img.onload=()=>{try{const cv=newCanvas();cv.getContext('2d').drawImage(img,0,0,CANVAS_SZ,CANVAS_SZ);skinCanvases[idx]=cv;refreshSkinSwatch(idx);
    }catch(e){}res();};
    img.onerror=()=>res(); img.src=pngs[k];})));}
document.getElementById('crNext').addEventListener('click',()=>gotoStep(Math.min(6,crStep+1)));
document.getElementById('crPrev').addEventListener('click',()=>gotoStep(Math.max(1,crStep-1)));
// 상단 3단계 스텝퍼 클릭으로 이동 (캐릭터=1, 책상=5, 좌석=6)
[...document.getElementById('crStages').children].forEach(el=>{ el.addEventListener('click',()=>{
  const stg=+el.dataset.stg; gotoStep(stg===0?Math.min(crStep,4):(stg===1?5:6)); }); });
/* === 책상 세팅(5단계): 책상 색 + 책상 위 아이템(소품) + 위치조작 === */
function swThumb(label,on,icon,onDelete){ const d=document.createElement('div');
  d.style.cssText='width:66px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:relative;';
  const box=document.createElement('div'); box.textContent=icon||'';
  box.style.cssText='width:60px;height:54px;border-radius:12px;border:2px solid '+(on?'#7ba05b':'#0002')+';background:'+(on?'#eef3e6':'#fffc')+';display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 1px 3px #0001;position:relative;';
  if(onDelete){
    const x=document.createElement('div'); x.textContent='×';
    x.style.cssText='position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#d98e73;color:#fff;font-size:13px;line-height:16px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
    x.onclick=e=>{ e.stopPropagation(); onDelete(); };
    box.appendChild(x);
  }
  const cap=document.createElement('span'); cap.textContent=label; cap.style.cssText='font-size:11px;color:#555;text-align:center;line-height:1.1;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  d.appendChild(box); d.appendChild(cap); return d; }
const DESK_ICON={plant:'🪴',cup:'☕',books:'📚'};
function renderCrItems(){
  const dr=document.getElementById('crDeskRow'); dr.innerHTML='';
  // 기본 책상 카드 (활성 책상이 커스텀이 아닐 때 on)
  const defThumb=swThumb('기본 책상', !activeCustomDeskId, '🪑');
  defThumb.onclick=()=>{ if(!activeCustomDeskId)return;
    cDeskTemplate=null; cDeskGlbB64=null; activeCustomDeskId=null;
    if(cDesk){ swapDeskVisual(cDesk,null); applyDeskColorToCustom(cDesk,cDeskColor); }
    renderCrItems();
  };
  dr.appendChild(defThumb);
  // 저장된 책상 카드들
  savedDesks.forEach(rec=>{
    const on=(activeCustomDeskId===rec.id);
    const card=swThumb(rec.name||'책상', on, rec.icon||'🪑', ()=>{
      // X 삭제: localStorage에서 제거 + 현재 활성 책상이면 기본으로 복귀
      savedDesks=savedDesks.filter(d=>d.id!==rec.id); persistSavedAssets();
      if(activeCustomDeskId===rec.id){ cDeskTemplate=null; cDeskGlbB64=null; activeCustomDeskId=null;
        if(cDesk){ swapDeskVisual(cDesk,null); applyDeskColorToCustom(cDesk,cDeskColor); } }
      renderCrItems();
    });
    card.onclick=async()=>{
      if(activeCustomDeskId===rec.id) return;   // 이미 활성
      try{ const sc=await parseGlbBytes(b64ToBuf(rec.glb));
        cDeskTemplate=sc; cDeskGlbB64=rec.glb; cDeskScale=cDeskScale||0.7; activeCustomDeskId=rec.id;
        if(cDesk){ swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor); }
        renderCrItems();
      }catch(e){ toast('책상 적용 실패'); }
    };
    dr.appendChild(card);
  });

  document.getElementById('deskColor').value=cDeskColor;
  const dsc=document.getElementById('deskScale'); if(dsc){ dsc.value=cDeskScale; dsc.parentElement.style.display='flex'; setDeskScale(cDesk,cDeskScale); }
  const row=document.getElementById('crItemRow'); row.innerHTML='';
  DESK_ITEMS.forEach(def=>{ const on=!!(cBase&&cBase.deskItems&&cBase.deskItems[def.id]);
    const it=swThumb(def.name,on,DESK_ICON[def.id]||'▫');
    it.onclick=()=>{ if(!cBase||!cBase.deskAnchor)return; equipDeskItem(cBase,def,!on); renderCrItems(); };
    row.appendChild(it); });
  // 커스텀 아이템: customItems(세션)에 등록된 것 = savedItems와 동일 ID 집합
  Object.values(customItems).forEach(def=>{ const on=!!(cBase&&cBase.deskItems&&cBase.deskItems[def.id]);
    const it=swThumb(def.name, on, def.icon||'📦', ()=>{
      // X 삭제: 세션 + localStorage + 현재 장착돼 있으면 해제
      if(cBase&&cBase.deskItems&&cBase.deskItems[def.id]) equipDeskItem(cBase,def,false);
      delete customItems[def.id];
      savedItems=savedItems.filter(s=>s.id!==def.id); persistSavedAssets();
      renderCrItems();
    });
    it.onclick=()=>{ if(!cBase||!cBase.deskAnchor)return; equipDeskItem(cBase,def,!on); renderCrItems(); };
    row.appendChild(it);
  });
  // 한도 표시: 6개 다 차면 "+ 코드로 추가하기" 비활성화 느낌
  const dac=document.getElementById('deskAddCode'), iac=document.getElementById('itemAddCode');
  if(dac){ const full=savedDesks.length>=MAX_CUSTOM_ASSETS; dac.style.opacity=full?'0.4':'1'; dac.title=full?'최대 '+MAX_CUSTOM_ASSETS+'개. 카드 X로 지운 뒤 추가하세요':''; }
  if(iac){ const full=savedItems.length>=MAX_CUSTOM_ASSETS; iac.style.opacity=full?'0.4':'1'; iac.title=full?'최대 '+MAX_CUSTOM_ASSETS+'개. 카드 X로 지운 뒤 추가하세요':''; }
}
document.getElementById('deskColor').addEventListener('input',e=>{ cDeskColor=e.target.value; if(cDeskMat)cDeskMat.color.set(cDeskColor); applyDeskColorToCustom(cDesk,cDeskColor); });
document.getElementById('deskScale').addEventListener('input',e=>{ cDeskScale=+e.target.value; setDeskScale(cDesk,cDeskScale); });   // 카메라 고정 — 책상 크기 가늠 쉽게
document.querySelectorAll('#crItemPos [data-d]').forEach(b=>b.addEventListener('click',()=>{
  const p=cBase&&cBase.activeDeskItem; if(!p)return; const a=p.userData.adj, s=0.04, d=b.dataset.d;
  if(d==='left')a.x=(a.x||0)-s; else if(d==='right')a.x=(a.x||0)+s; else if(d==='up')a.z=(a.z||0)-s; else if(d==='down')a.z=(a.z||0)+s;
  applyDeskAdj(p); }));
document.getElementById('crItemBigger').onclick=()=>{ const p=cBase&&cBase.activeDeskItem; if(!p)return; p.userData.adj.scale=Math.min(2.5,(p.userData.adj.scale||1)+0.1); applyDeskAdj(p); };
document.getElementById('crItemSmaller').onclick=()=>{ const p=cBase&&cBase.activeDeskItem; if(!p)return; p.userData.adj.scale=Math.max(0.4,(p.userData.adj.scale||1)-0.1); applyDeskAdj(p); };
document.getElementById('crItemRemove').onclick=()=>{ const p=cBase&&cBase.activeDeskItem; if(!p)return; DESK_ITEMS.forEach(def=>{ if(cBase.deskItems[def.id]===p) equipDeskItem(cBase,def,false); }); renderCrItems(); };
document.getElementById('deskAddCode').onclick=()=>openAssetImport('desk');
document.getElementById('itemAddCode').onclick=()=>openAssetImport('item');
/* === 좌석 세팅(6단계): 변형 슬라이더 === */
function bindCrXform(id,key){ document.getElementById(id).addEventListener('input',e=>{ cXform[key]=+e.target.value; applyCreatorXform(); }); }   // 카메라는 고정 — 크기 가늠 쉽게
bindCrXform('crScale','s'); bindCrXform('crZ','z'); bindCrXform('crRot','rot');   // 높이 슬라이더 제거(바닥 파묻힘 방지)
document.querySelectorAll('#seatStage .mini-reset[data-rs]').forEach(btn=>{ btn.addEventListener('click',()=>{
  const k=btn.dataset.rs, dv=(k==='s')?0.7:0; cXform[k]=dv;
  const id=(k==='s')?'crScale':(k==='z'?'crZ':'crRot'); document.getElementById(id).value=dv;
  applyCreatorXform(); }); });
document.getElementById('deskScaleReset').addEventListener('click',()=>{ cDeskScale=0.7; document.getElementById('deskScale').value=0.7; setDeskScale(cDesk,0.7); });
/* === 책상·아이템 코드: 생성(판매자) === */
const assetGenOverlay=document.getElementById('assetGenOverlay');
document.getElementById('lcAssetGen').onclick=()=>{ const o=document.getElementById('assetGenOut'); o.style.display='none'; o.value=''; document.getElementById('assetGenCopy').style.display='none'; assetGenOverlay.classList.add('on'); };
document.getElementById('assetGenCancel').onclick=()=>assetGenOverlay.classList.remove('on');
document.getElementById('assetGenGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  const f=document.getElementById('assetGenFile').files[0], pass=document.getElementById('assetGenPass').value;
  const kind=document.getElementById('assetGenKind').value, name=(document.getElementById('assetGenName').value.trim())||(kind==='desk'?'커스텀 책상':'커스텀 아이템');
  const icon=document.getElementById('assetGenIcon').value;
  if(!f){toast('GLB 파일을 선택해 주세요');return;} if(!pass){toast('비밀번호를 입력해 주세요');return;}
  if(f.size>MAX_GLB_BYTES){toast('GLB 파일이 1MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
  try{ const glb=await f.arrayBuffer(); const code=await encryptAssetCode(wrapAsset(name,icon,glb),pass,kind);
    const o=document.getElementById('assetGenOut'); o.value=code; o.style.display='block'; document.getElementById('assetGenCopy').style.display='block'; toast('코드를 생성했어요');
  }catch(e){ toast('생성 실패: '+(e.message||e)); } };
document.getElementById('assetGenCopy').onclick=()=>{ const o=document.getElementById('assetGenOut'); o.select(); try{document.execCommand('copy');toast('복사했어요');}catch(e){} };

/* === 커미션 캐릭터 코드: 생성(관리자만) === */
const commGenOverlay=document.getElementById('commGenOverlay');
document.getElementById('lcCommissionGen').onclick=()=>{
  const o=document.getElementById('commGenOut'); o.style.display='none'; o.value=''; document.getElementById('commGenCopy').style.display='none';
  document.getElementById('commGenName').value=''; document.getElementById('commGenPass').value='';
  const fi=document.getElementById('commGenFile'); fi.value='';
  commGenOverlay.classList.add('on');
};
document.getElementById('commGenCancel').onclick=()=>commGenOverlay.classList.remove('on');
document.getElementById('commGenGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  const f=document.getElementById('commGenFile').files[0], pass=document.getElementById('commGenPass').value;
  const name=(document.getElementById('commGenName').value.trim())||'커미션 캐릭터';
  if(!f){toast('zip 파일을 선택해 주세요');return;}
  if(!pass){toast('비밀번호를 입력해 주세요');return;}
  if(f.size>MAX_COMMISSION_BYTES){toast('zip 파일이 2MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
  try{
    const unpacked=await unpackCommissionZip(f);
    const payload={
      t:'comm',                          // 페이로드 타입
      name: name,
      glb: _b64(unpacked.glbBuf),        // base64 GLB
      face: unpacked.faceDataUrl,        // 데이터 URL (512 PNG)
      blink: unpacked.blinkDataUrl
    };
    const code=await encryptCommission(payload, pass);
    const o=document.getElementById('commGenOut'); o.value=code; o.style.display='block';
    document.getElementById('commGenCopy').style.display='block';
    toast('커미션 캐릭터 코드를 생성했어요 ('+Math.round(code.length/1024)+' KB)');
  }catch(e){ toast('생성 실패: '+(e.message||e)); }
};
document.getElementById('commGenCopy').onclick=()=>{ const o=document.getElementById('commGenOut'); o.select(); try{document.execCommand('copy');toast('복사했어요');}catch(e){} };

/* === 책상·아이템 코드: 가져오기(생성기 안에서) === */
const assetImpOverlay=document.getElementById('assetImpOverlay');
function openAssetImport(kind){ document.getElementById('assetImpTitle').textContent=(kind==='desk'?'책상':'아이템')+' 코드로 추가하기';
  document.getElementById('assetImpCode').value=''; document.getElementById('assetImpPass').value=''; assetImpOverlay.classList.add('on'); }
document.getElementById('assetImpCancel').onclick=()=>assetImpOverlay.classList.remove('on');
document.getElementById('assetImpGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  const code=document.getElementById('assetImpCode').value, pass=document.getElementById('assetImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  try{ const dec=await decryptAssetCode(code,pass); const u=unwrapAsset(dec.buf);
    if(u.glbBuf.byteLength>MAX_GLB_BYTES){ toast('GLB가 1MB를 넘어요'); return; }
    // 한도 검사: 같은 종류의 저장 배열 길이 확인
    const arr = (dec.kind==='desk') ? savedDesks : savedItems;
    if(arr.length>=MAX_CUSTOM_ASSETS){ toast('최대 '+MAX_CUSTOM_ASSETS+'개까지 추가할 수 있어요. 카드의 X로 지운 뒤 다시 시도해 주세요'); return; }
    const glbB64=_b64(u.glbBuf);
    const scene=await parseGlbBytes(u.glbBuf.slice(0));
    const id='c'+Date.now().toString(36);
    const rec={id, name:u.name, icon:u.icon||'', glb:glbB64};
    arr.push(rec); persistSavedAssets();
    if(dec.kind==='desk'){
      // 즉시 활성 책상으로 swap (사용자 의도 — 방금 추가한 책상은 바로 보이도록)
      cDeskTemplate=scene; cDeskGlbB64=glbB64; cDeskScale=1;
      if(cDesk){cDesk.userData.deskScale=1; swapDeskVisual(cDesk,scene); applyDeskColorToCustom(cDesk,cDeskColor);}
      activeCustomDeskId=id;
      toast('책상을 추가했어요');
    } else {
      registerCustomItem(id,u.name,glbB64,scene,u.icon||'');
      if(cBase&&cBase.deskAnchor) equipDeskItem(cBase,customItems[id],true);
      toast('아이템을 추가했어요');
    }
    renderCrItems(); assetImpOverlay.classList.remove('on');
  }catch(e){ toast('추가 실패: 코드나 비밀번호를 확인해 주세요'); } };
/* 전역 조명 프리셋 (생성기·메인·기타 미리보기 통일). 더 이상 UI 슬라이더 없음 — 코드 한 곳에서 관리 */
const LIGHT_PRESET = {b:1.2, h:0.09, e:0.5};

/* ===== 관리자 모드 =====
   진입: Ctrl 누른 채로 "캐릭터 생성" 버튼을 3초 안에 5번 연타 → 비밀번호 prompt
   비밀번호: SHA-256('tw2026') 해시와 비교 (해시 저장이라 코드 봐도 즉시 들키지 않음)
   세션 단위로만 유지 (브라우저 닫으면 자동 해제). 우상단에 🔧 배지 표시, 클릭하면 종료.
   관리자만 가능: 책상·아이템 코드 등록 (커미션 판매자 작업)
*/
const ADMIN_PASS_HASH = 'e33bd90cf3f9275efe7f408f8a435bbeadc9d22e42601d37b68dfba281661a35';   // SHA-256('tw2026')
let isAdmin = false;

/* ============================================================ 라이선스 (직접 발급) — 프리미엄(꾸미기) 잠금 해제
   관리자가 관리자 모드에서 키를 직접 발급 → 구매자에게 전달(직거래) → 구매자가 앱에 입력하면
   Firebase(licenses/{key})에서 유효성 확인 → 통과 시 로컬(localStorage)에 저장. */
const LICENSE_KEY_STORAGE = 'tw.licenseKey';
let isPremium = false;

function _genLicenseKey(){
  // XXXX-XXXX-XXXX-XXXX 형식, 헷갈리기 쉬운 0/O, 1/I 제외
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

async function verifyLicense(key){
  if(!window.firebaseAPI || !window.firebaseAPI.redeemLicense){
    return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
  }
  return await window.firebaseAPI.redeemLicense(key.trim().toUpperCase());
}

function loadLicenseFromStorage(){
  try{
    const key = localStorage.getItem(LICENSE_KEY_STORAGE);
    if(key){ isPremium = true; return key; }   // 온라인 재검증 전까지는 로컬 저장값 신뢰(오프라인 사용 허용)
  }catch(e){}
  return null;
}
async function activateLicense(key){
  const r = await verifyLicense(key);
  if(r.ok){
    try{ localStorage.setItem(LICENSE_KEY_STORAGE, key.trim().toUpperCase()); }catch(e){}
    isPremium = true;
  }
  return r;
}
function deactivateLicense(){
  try{ localStorage.removeItem(LICENSE_KEY_STORAGE); }catch(e){}
  isPremium = false;
}
// 앱 시작 시: 로컬에 저장된 키가 있으면 일단 프리미엄으로 간주(오프라인에서도 꾸미기 사용 가능하게),
// 동시에 백그라운드로 재검증해서 (관리자가 비활성화한 경우 등) 무효화됐으면 조용히 잠금.
(function initLicense(){
  const key = loadLicenseFromStorage();
  if(key){
    // firebaseAPI가 module script 로드 지연으로 아직 없을 수 있으니 준비될 때까지 기다렸다 재검증
    const doVerify = () => verifyLicense(key).then(r=>{
      if(!r.ok && !r.offline){ isPremium=false; try{localStorage.removeItem(LICENSE_KEY_STORAGE);}catch(e){} }
    });
    if(window.firebaseAPI) doVerify();
    else window.addEventListener('firebase-ready', doVerify, { once:true });
  }
})();
async function _sha256Hex(s){
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function tryEnterAdmin(){
  const overlay=document.getElementById('adminPassOverlay');
  const input=document.getElementById('adminPassInput');
  const err=document.getElementById('adminPassErr');
  if(!overlay) return;
  err.style.display='none'; input.value='';
  overlay.classList.add('on'); overlay.style.display='flex';
  setTimeout(()=>input.focus(), 50);
}
async function _submitAdminPass(){
  const input=document.getElementById('adminPassInput');
  const err=document.getElementById('adminPassErr');
  const overlay=document.getElementById('adminPassOverlay');
  const pass=input.value;
  if(!pass) return;
  try{
    const h = await _sha256Hex(pass);
    if(h === ADMIN_PASS_HASH){
      isAdmin = true;
      document.body.classList.add('admin');
      toast('관리자 모드 ON — Ctrl+E로 종료');
      refreshAdminVisibility();
      overlay.classList.remove('on'); overlay.style.display='none';
    } else {
      err.textContent='비밀번호가 틀려요'; err.style.display='block';
    }
  }catch(_){ err.textContent='비밀번호 확인 중 오류'; err.style.display='block'; }
}
function exitAdmin(){
  isAdmin = false;
  document.body.classList.remove('admin');
  toast('관리자 모드 OFF');
  refreshAdminVisibility();
}
// 관리자 모드 표시는 배지(클릭 버튼) 대신 Ctrl+E 단축키로 종료 — run 모드 클릭통과와 충돌하지 않게.
document.addEventListener('keydown', e=>{
  if(isAdmin && e.ctrlKey && (e.key==='e' || e.key==='E')){ e.preventDefault(); exitAdmin(); }
});
/* 관리자 전용 UI 표시 토글 — DOM에 .admin-only 클래스가 있으면 isAdmin일 때만 보임 */
function refreshAdminVisibility(){
  document.querySelectorAll('.admin-only').forEach(el=>{
    el.style.display = isAdmin ? '' : 'none';
  });
  // 꾸미기 패널이 열려 있으면 등록/삭제 버튼 표시가 바뀌므로 다시 렌더
  if(typeof window.refreshWardrobe==='function') window.refreshWardrobe();
}
/* 진입 트리거: Ctrl + ("캐릭터 생성" 또는 🎨 꾸미기) 버튼 5연타(3초 안에) */
(function bindAdminTrigger(){
  let clicks=[];
  document.addEventListener('click', e=>{
    if(isAdmin) return;
    // 캐릭터 생성 버튼 또는 꾸미기(🎨) 버튼에서 Ctrl 연타 감지
    const target = e.target.closest && (e.target.closest('#lcCreate') || e.target.closest('#myWardrobeBtn'));
    if(!target){ return; }
    console.log('[admin trigger] 버튼 클릭 감지:', target.id, '| ctrlKey:', e.ctrlKey, '| metaKey:', e.metaKey);

    // Ctrl 키(또는 Mac의 Meta 키)를 누른 상태인지 확인
    if(e.ctrlKey || e.metaKey) {
      // 핵심 수정: Ctrl을 누른 상태라면 무조건 기본 동작(생성창/꾸미기 열기)을 차단!
      e.preventDefault(); 
      e.stopPropagation();

      const now = performance.now();
      clicks.push(now);
      clicks = clicks.filter(t => now - t < 3000);
      console.log('[admin trigger] 클릭 카운트:', clicks.length);

      if(clicks.length >= 5){
        clicks = [];
        console.log('[admin trigger] tryEnterAdmin 호출');
        tryEnterAdmin();
      }
    } else {
      clicks = [];
    }
  }, true);   // capture 단계에서 가로채기 — 일반 클릭 핸들러보다 먼저 카운트
})();
/* face material의 map을 갈아끼울 때 emissiveMap도 같이 동기화. 안 그러면 졸기 등 map 교체 시 이전 텍스처가 emissive로 남아 합성됨(blink 흐릿함 원인) */
function setFaceMap(mat, tex){ if(!mat||!tex)return; mat.map=tex; mat.emissiveMap=tex; mat.needsUpdate=true; }
function updateCreatorLights(){ if(!cAmb||!cKey)return;
  const b=LIGHT_PRESET.b, h=LIGHT_PRESET.h, e=LIGHT_PRESET.e;
  cAmb.intensity=0.95*b*e; cKey.intensity=1.0*b*e;            // 밝기(strength) × 노출(조명 페이드)
  const col=new THREE.Color().setHSL(h,0.45,0.85);           // 색상(color)
  cKey.color.copy(col); cAmb.color.copy(col);
  const flat=1-e;                                            // 노출↓ → 텍스처값만(플랫)
  if(cBase){
    if(cBase.faceMat){ if(cBase.faceMat.emissiveMap!==cBase.faceMat.map){cBase.faceMat.emissiveMap=cBase.faceMat.map;cBase.faceMat.needsUpdate=true;} cBase.faceMat.emissive.setScalar(flat); }
    if(cBase.upMat){ if(cBase.upMat.map&&cBase.upMat.emissiveMap!==cBase.upMat.map){cBase.upMat.emissiveMap=cBase.upMat.map;cBase.upMat.needsUpdate=true;} cBase.upMat.emissive.copy(cBase.upMat.color).multiplyScalar(flat); }
    if(cBase.loMat){ if(cBase.loMat.map&&cBase.loMat.emissiveMap!==cBase.loMat.map){cBase.loMat.emissiveMap=cBase.loMat.map;cBase.loMat.needsUpdate=true;} cBase.loMat.emissive.copy(cBase.loMat.color).multiplyScalar(flat); }
  }
}
/* 메인 좌석에 들어오는 캐릭터 머티리얼에도 같은 emissive 보정 적용 — 생성기와 톤 일치 */
function applyLightPresetToInstance(inst){ if(!inst)return;
  const flat=1-LIGHT_PRESET.e;
  if(inst.faceMat){ inst.faceMat.emissiveMap=inst.faceMat.map; inst.faceMat.emissive.setScalar(flat); inst.faceMat.needsUpdate=true; }
  if(inst.upMat){ if(inst.upMat.map&&inst.upMat.emissiveMap!==inst.upMat.map){inst.upMat.emissiveMap=inst.upMat.map;inst.upMat.needsUpdate=true;} inst.upMat.emissive.copy(inst.upMat.color).multiplyScalar(flat); }
  if(inst.loMat){ if(inst.loMat.map&&inst.loMat.emissiveMap!==inst.loMat.map){inst.loMat.emissiveMap=inst.loMat.map;inst.loMat.needsUpdate=true;} inst.loMat.emissive.copy(inst.loMat.color).multiplyScalar(flat); }
}
/* 조명 슬라이더 UI 제거됨 — LIGHT_PRESET 상수로 한 번 적용 */

/* --- 생성기 미리보기 렌더러 --- */
let cRenderer=null,cScene=null,cCam=null,cBase=null,creatorOpen=false,cAmb=null,cKey=null,cDesk=null,cDeskMat=null,cFloor=null;
let camDist=1.5,camYaw=0,camPitch=0.05,orbiting=false,lastMX=0,lastMY=0;
const camTarget=new THREE.Vector3(0,1.2,0);
const cFaceCenter=new THREE.Vector3(0,1.2,0), cBodyCenter=new THREE.Vector3(0,0.85,0);
let cFaceDist=1.15, cBodyDist=3.9;
function updateCreatorCam(){if(!cCam)return;
  cCam.position.set(camTarget.x+camDist*Math.sin(camYaw)*Math.cos(camPitch),
                    camTarget.y+camDist*Math.sin(camPitch),
                    camTarget.z+camDist*Math.cos(camYaw)*Math.cos(camPitch));
  cCam.lookAt(camTarget);
  if(crStep<=3){ faceCamSaved={target:camTarget.clone(),dist:camDist,yaw:camYaw,pitch:camPitch}; }   // 1~3단계 각도 기억
  else if(crStep>=5){ deskCamSaved={target:camTarget.clone(),dist:camDist,yaw:camYaw,pitch:camPitch}; }  // 5~6단계 각도 기억
}
// 미리보기용 static 모델에 HAND_REST 각도를 즉시 적용해주는 헬퍼 함수입니다.
function applyStaticHandRest(root) {
  if(!root) return;
  let handL = null, handR = null;
  
  // 메인 화면과 정확히 똑같은 뼈(왼팔, 오른팔) 딱 2개만 찾아냅니다.
  root.traverse(o => {
    if (o.isBone) {
      const n = o.name.toLowerCase();
      if (n.includes('hand') || n.includes('arm')) {
        const s = boneSide(n);
        if (s === 'l' && !handL) handL = o;
        if (s === 'r' && !handR) handR = o;
      }
    }
  });

  // HAND_REST 값만큼 팔을 들어올립니다.
  const _be = new THREE.Euler(HAND_REST, 0, 0, 'XYZ');
  const _bq = new THREE.Quaternion().setFromEuler(_be);
  if (handL) handL.quaternion.multiply(_bq);
  if (handR) handR.quaternion.multiply(_bq);
}
function ensureCreatorPreview(){
  if(cRenderer)return;
  cRenderer=new THREE.WebGLRenderer({canvas:document.getElementById('creatorPreview'),antialias:true,alpha:true});
  cRenderer.setPixelRatio(Math.min(devicePixelRatio,2));cRenderer.outputEncoding=THREE.sRGBEncoding;cRenderer.toneMapping=THREE.NoToneMapping;cRenderer.setSize(222,300,false);
  cScene=new THREE.Scene();cAmb=new THREE.AmbientLight(0xfff2e0,0.95);cScene.add(cAmb);
  cKey=new THREE.DirectionalLight(0xfff0d8,1.0);cKey.position.set(0,4,0);cScene.add(cKey);
  cCam=new THREE.PerspectiveCamera(34,222/300,0.1,100);
  const inst=instantiateBase();
  if(inst){ setFaceMap(inst.faceMat, dispTex);
    if(inst.upMat)inst.upMat.color.set(cTopColor); if(inst.loMat)inst.loMat.color.set(cBotColor);
    applyStaticHandRest(inst.root); // 생성창 기본 프리뷰에 팔 높이 반영
    normalizeModel(inst.root,1.45); cScene.add(inst.root);
    cBase={group:inst.root,faceMat:inst.faceMat,upMat:inst.upMat,loMat:inst.loMat,face:inst.faceMesh};
    const fg=inst.faceMesh.geometry;
    cBase.facePos=fg.attributes.position.array; cBase.faceUv=fg.attributes.uv?fg.attributes.uv.array:null;
    cBase.faceIdx=fg.index?fg.index.array:null;
    fg.computeBoundingBox(); cBase.faceCx=(fg.boundingBox.min.x+fg.boundingBox.max.x)/2;
    cBase.equipped={hair:null,accessory:null,clothes:null}; cBase.equippedId={hair:null,accessory:null,clothes:null};
    // 미리보기 책상 (앱과 동일 위치 — 소품을 올려놓는 곳)
    cDesk=buildDesk(true); cScene.add(cDesk); cDesk.visible=false;
const cFloorGeo = new THREE.BoxGeometry(1, 1, 1);
    cFloorGeo.translate(0, -0.5, 0); // 윗면 중앙 피벗
    cFloor=new THREE.Mesh(cFloorGeo, M(0xcdb88f,0.95));   // 앱과 동일한 받침대
    cFloor.scale.set(2.4,0.125,2.2); cFloor.position.set(0,0,0.0); cFloor.visible=false; cScene.add(cFloor);
    const dt=cDesk.getObjectByName('deskTop'); if(dt){ dt.material=dt.material.clone(); cDeskMat=dt.material; cDeskMat.color.set(cDeskColor); }
    cBase.deskAnchor=cDesk.userData.deskAnchor; cBase.deskItems={}; cBase.activeDeskItem=null;
    fitCreator('edit');   // 편집 포즈 기준으로 카메라 중심 계산
    const fb=new THREE.Box3().setFromObject(inst.faceMesh), fs=fb.getSize(new THREE.Vector3());
    fb.getCenter(cFaceCenter);
    cFaceCenter.y += 0.12;   // ▲ 한 칸만큼 시선 높임 (얼굴이 화면에 자연스럽게 자리)
    { const fovV=cCam.fov*Math.PI/180, aspect=222/300;
      const dV=(fs.y/2)/Math.tan(fovV/2), dH=(fs.x/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
      cFaceDist=Math.max(dV,dH)*0.63 + fs.z*0.5 + 0.10; }   // 얼굴만 확대 (피부/표정/감은눈 단계, 측정 기반)
    const bb=new THREE.Box3().setFromObject(inst.root), bs=bb.getSize(new THREE.Vector3());
    bb.getCenter(cBodyCenter); cBodyDist=Math.max(bs.x,bs.y)*1.7+0.3;
  } else {
    cBase=buildCreatorBase(dispTex,dispTex,skinColorFor(skinIndex),cTopColor,cBotColor);cScene.add(cBase.group);
    cFaceCenter.set(0,1.32,0);cFaceDist=1.15;cBodyCenter.set(0,0.85,0);cBodyDist=3.9;
  }
  updateCreatorCam();
  updateCreatorLights();   // 미리보기가 열리는 순간 emissive 톤 즉시 반영(1~3단계에서도 적용)
  bindPaint();
}
function creatorLoop(){if(!creatorOpen)return;cRenderer.render(cScene,cCam);requestAnimationFrame(creatorLoop);}
const RIG_TURN=-0.28;   // 앱 좌석이 매 프레임 적용하는 기본 바라보는 각도 (미리보기도 동일하게)
function fitCreator(mode){ if(!cBase||!cBase.group)return; const g=cBase.group;
  // 표준 리그 통합: 커미션 분기 제거 — base와 동일하게 g 자기 박스 기준
  if(mode==='edit'){
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,0,0); g.updateWorldMatrix(true,true);
    let refBox=new THREE.Box3().setFromObject(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    const s=(refSize.y>1e-4?1.5/refSize.y:1); g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=new THREE.Box3().setFromObject(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    g.position.x+=(0-c.x); g.position.y = 0; g.position.z+=(0-c.z);
  } else {
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,RIG_TURN+cXform.rot,0); g.updateWorldMatrix(true,true);
    let refBox=new THREE.Box3().setFromObject(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    const s=(refSize.y>1e-4?1.2/refSize.y:1)*cXform.s; g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=new THREE.Box3().setFromObject(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    g.position.x+=(0-c.x); g.position.y = 0; g.position.z+=(CHAR_Z-c.z)+cXform.z;
  }
}
function applyCreatorXform(){ fitCreator('app'); }   // 캐릭터만 변형 — 카메라는 그대로 두어 책상 크기 고정·회전/시점 유지
function frameDeskCam(keepView){   // 캐릭터+책상 전체가 다 보이도록 거리 자동 조절 (메인 화면과 동일한 스케일 적용)
  if(!cCam) return;
  const box=new THREE.Box3();
  if(cBase&&cBase.group) box.expandByObject(cBase.group);
  if(cDesk&&cDesk.visible) box.expandByObject(cDesk);
  if(!keepView){ camYaw=0; camPitch=0.13; }
  if(box.isEmpty()){ camTarget.set(0,0.6,-0.1); camDist=4.4; updateCreatorCam(); return; }
  
  const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  camTarget.copy(c);
  sizeFloorTo(cFloor, c.x, c.z, sz.x, sz.z);   // 받침대를 캐릭터+책상 크기에 맞춤
  
  const fovV=cCam.fov*Math.PI/180, aspect=222/300;
  
  // 메인 앱의 layoutSeats()와 완전히 동일한 여백(Padding) 계산 적용
  const contentW = sz.x + 0.25;
  const contentH = Math.max(sz.y, 1.3) + 0.18;
  
  const distV=(contentH/2)/Math.tan(fovV/2);
  const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
  
  // 메인 앱과 동일한 거리 계산 공식 적용 (*1.3 가중치 제거)
  camDist=Math.max(distV,distH) + sz.z*0.45;
  
  updateCreatorCam();
}
function gotoStep(n){
  // 커미션 캐릭터는 1~4단계(피부/표정/감은눈/색상) 접근 차단 — 5(책상)·6(좌석)만 허용
  if(isCommissionEditing() && n<5){
    toast('커미션 캐릭터는 수정할 수 없어요.');
    n = 5;
  }
  crStep=n;
  if(n===3 && !blinkEdited){ const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); histB.length=0; redoB.length=0; }  // 아직 감은눈을 안 고쳤으면 최신 표정을 복사해서 시작
  const draw=isDrawStep(), skin=(n===1), color=(n===4), faceView=(n<=3);
  const stage = n<=4?0 : (n===5?1:2);
  showEl('charStage', n<=4); showEl('deskStage', n===5); showEl('seatStage', n===6);
  document.getElementById('skinRow').style.display=skin?'flex':'none';
  document.getElementById('crTools').style.display=draw?'flex':'none';
  document.getElementById('penHint').style.display=draw?'block':'none';
  if(!draw && stampMode) setStampMode(false);   // 표정 단계 벗어나면 도장 모드 해제
  document.getElementById('blinkResetBtn').style.display=(n===3)?'inline-block':'none';
  document.getElementById('crColors').style.display=color?'flex':'none';
  document.getElementById('crHint').textContent =
    n===1?'피부색을 골라주세요':
    n===2?'얼굴을 클릭·드래그해 표정을 그려요 · 휠=확대 · ◀▶=회전':
    n===3?'2단계 표정이 복사됐어요 — 눈을 감은 모양으로 고쳐요':
          '상의·하의 색을 골라주세요 (전체 모습)';
  const sp=document.getElementById('crSteps').children;
  [...sp].forEach((el,i)=>{el.classList.toggle('on',i===n-1);el.classList.toggle('done',i<n-1);
    // 커미션이면 1~4단계 탭을 시각적으로 잠금 (회색·비활성)
    if(isCommissionEditing() && i<4){ el.style.opacity='0.35'; el.style.textDecoration='line-through'; el.title='커미션 캐릭터는 수정할 수 없어요'; }
    else { el.style.opacity=''; el.style.textDecoration=''; el.title=''; }
  });
  const stg=document.getElementById('crStages').children;
  [...stg].forEach((el,i)=>{el.classList.toggle('on',i===stage);el.classList.toggle('done',i<stage);});
  document.getElementById('crPrev').style.display=n>1?'block':'none';
  document.getElementById('crNext').style.display=n<6?'block':'none';
  document.getElementById('crDone').style.display=n===6?'block':'none';
  if(n===5){ renderCrItems(); }
  if(n===6){ document.getElementById('crScale').value=cXform.s;
    document.getElementById('crZ').value=cXform.z; document.getElementById('crRot').value=cXform.rot; }
  const deskView=(n>=5);
  if(cDesk) cDesk.visible=deskView;
 // if(cFloor) cFloor.visible=deskView;
  if(deskView){ fitCreator('app'); }
  else { fitCreator('edit'); }
  if(faceView){ if(faceCamSaved){ camTarget.copy(faceCamSaved.target); camDist=faceCamSaved.dist; camYaw=faceCamSaved.yaw; camPitch=faceCamSaved.pitch; }
                else { camTarget.copy(cFaceCenter); camDist=cFaceDist; camYaw=0; camPitch=0.0; } }   // 1~3단계 사이 각도 유지
  else if(deskView){ if(deskCamSaved){ camTarget.copy(deskCamSaved.target); camDist=deskCamSaved.dist; camYaw=deskCamSaved.yaw; camPitch=deskCamSaved.pitch; }
                     else { frameDeskCam(false); } }                                  // 책상·좌석(5·6) 사이 각도 유지
  else{camTarget.copy(cBodyCenter);camDist=cBodyDist;camYaw=0;camPitch=0.04;}            // 전체 모습(정면)
  updateCreatorCam();
  document.getElementById('creatorPreview').style.cursor=draw?'crosshair':'default';
  blit();}
function openCreator(mode){
  ensureCreatorPreview();
  creatorMode=mode||{kind:'slot',edit:false};
  // ★ 진입 시점에 런처 화면이 보이고 있었는지 기록 — 아래에서 launcher의 'on'을 강제로 뺄 것이므로,
  //   완료/닫기 시 이 값을 보고 되돌려야 함(안 그러면 런처에서 우클릭 수정 후 완료 눌렀을 때 화면이 통째로 사라짐).
  creatorMode.cameFromLauncher = document.getElementById('launcher').classList.contains('on');
  let src=null;
  if(creatorMode.kind==='slot'&&creatorMode.edit) src=slots[creatorMode.slot];
  if(creatorMode.kind==='seat') src=creatorMode.seat.charDef;
  currentCreatorDef = src;   // 커미션 여부 등 판정용 (gotoStep·잠금에서 사용)
  faceC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);blinkC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
  histF.length=0;histB.length=0;redoF.length=0;redoB.length=0;
  if(src){faceC.getContext('2d').drawImage(src.face,0,0);blinkC.getContext('2d').drawImage(src.blink,0,0);cTopColor=src.top;cBotColor=src.bot;skinIndex=src.skin||0;}
  else{cTopColor='#9dba8a';cBotColor='#d98e73';skinIndex=0;}
  blinkEdited=!!src;   // 편집이면 기존 감은눈 유지, 신규면 3단계에서 표정을 복사해 시작
  document.getElementById('topColor').value=cTopColor;document.getElementById('botColor').value=cBotColor;
  [...document.getElementById('skinRow').children].forEach((x,j)=>x.classList.toggle('on',j===skinIndex));
  if(cBase){ if(cBase.upMat)cBase.upMat.color.set(cTopColor); if(cBase.loMat)cBase.loMat.color.set(cBotColor); }
  updateCreatorLights();   // 수정 진입 시에도 emissive 톤 갱신
  cXform = (src&&src.xf) ? {s:src.xf.s,y:0,z:src.xf.z,rot:src.xf.rot} : {s:0.7,y:0,z:0,rot:0};   // 높이는 항상 0(바닥)
  faceCamSaved=null; deskCamSaved=null;
  cDeskColor = (src&&src.deskColor) || '#c9a36a';
  if(cDeskMat) cDeskMat.color.set(cDeskColor);
  customItems={}; cDeskTemplate=null; cDeskGlbB64=null; cDeskScale=(src&&src.deskScale)||0.7;   // 세션 커스텀 에셋 초기화
  activeCustomDeskId=null;
  if(cDesk) setDeskScale(cDesk,cDeskScale);
  if(cBase){ applyCreatorXform(); clearCreatorItems(); if(cDesk)cDesk.userData.deskScale=cDeskScale; swapDeskVisual(cDesk,null);
    (async()=>{
      if(src&&src.deskGlb){ cDeskGlbB64=src.deskGlb; try{ const sc=await parseGlbBytes(b64ToBuf(src.deskGlb)); cDeskTemplate=sc; swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor);
        // 저장된 책상 중 같은 glb를 가진 것이 있으면 활성 ID 잡기
        const m=savedDesks.find(d=>d.glb===src.deskGlb); if(m) activeCustomDeskId=m.id;
      }catch(e){} }
      if(src&&src.customItems){ for(const id in src.customItems){ const c=src.customItems[id]; try{ const sc=await parseGlbBytes(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc,c.icon||'');}catch(e){} } }
      await loadSavedItemsIntoSession();   // localStorage에 저장된 아이템 모두 customItems에 등록
      if(src&&src.deskItems) applyDeskItemsTo(cBase, src.deskItems);
      if(crStep===5) renderCrItems();
    })();
  }
  document.getElementById('creatorOverlay').classList.add('on');document.getElementById('launcher').classList.remove('on');
  creatorOpen=true;
  // 커미션 캐릭터면 책상 세팅(5단계)부터 진입 + cBase의 베이스 GLB를 커미션 GLB로 교체
      if(src && src.isCommission){
        gotoStep(5);
        swapCreatorBaseToCommission(src);
      } else {
        // 💡 기다릴 필요 없이 즉시 뼈대 복구 후 1단계로 진입합니다.
        swapCreatorBaseToDefault(); 
        gotoStep(1);
      }
      requestAnimationFrame(creatorLoop);
      if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
}

/* 생성기의 cBase를 커미션 GLB 인스턴스로 교체 */
async function swapCreatorBaseToCommission(def){
  if(!def || !def.commGlb) return;
  try{
    const scene = await getCommissionScene(def.commGlb);
    const newInst = instantiateBase(scene);
    if(!newInst) return;
    if(cBase && cBase.group && cBase.group.parent){ cBase.group.parent.add(newInst.root); cBase.group.parent.remove(cBase.group); }
    const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
    setFaceMap(newInst.faceMat, fT);
    applyLightPresetToInstance(newInst);
    applyStaticHandRest(newInst.root); // 커미션 모델 불러올 때 팔 높이 반영
    cBase.group = newInst.root; cBase.faceMat = newInst.faceMat; cBase.upMat = newInst.upMat; cBase.loMat = newInst.loMat; cBase.face = newInst.faceMesh; cBase.blinkTex = bT;
    normalizeModel(cBase.group, 1.45, true);
    applyCreatorXform();
  }catch(e){ console.warn('커미션 GLB 적용 실패', e); toast('커미션 캐릭터 모델 로드 실패'); }
}

/* 💡 기본 모델 복구 함수 (비동기 꼬임 방지 + 카메라 타겟 재계산 완벽 복구) */
function swapCreatorBaseToDefault() {
  if(typeof BASE_SCENE === 'undefined' || !BASE_SCENE) return;
  const newInst = instantiateBase(BASE_SCENE);
  if(!newInst) return;
  
  if(cBase && cBase.group && cBase.group.parent){ 
    cBase.group.parent.add(newInst.root); 
    cBase.group.parent.remove(cBase.group); 
  }
  
  setFaceMap(newInst.faceMat, dispTex);
  if(newInst.upMat) newInst.upMat.color.set(cTopColor); 
  if(newInst.loMat) newInst.loMat.color.set(cBotColor);
  applyLightPresetToInstance(newInst);
  
  cBase.group = newInst.root;
  cBase.faceMat = newInst.faceMat;
  cBase.upMat = newInst.upMat;
  cBase.loMat = newInst.loMat;
  cBase.face = newInst.faceMesh;

  // 페인팅 및 대칭 데이터 복구
  const fg = newInst.faceMesh.geometry;
  cBase.facePos = fg.attributes.position.array; 
  cBase.faceUv = fg.attributes.uv ? fg.attributes.uv.array : null;
  cBase.faceIdx = fg.index ? fg.index.array : null;
  fg.computeBoundingBox(); 
  cBase.faceCx = (fg.boundingBox.min.x + fg.boundingBox.max.x) / 2;
  
  applyStaticHandRest(cBase.group); // 기본 모델로 복구할 때 팔 높이 반영
  normalizeModel(cBase.group, 1.45, false);
  
  // 💡 캐릭터를 '편집(Edit)' 정자세로 둔 뒤 카메라 타겟을 다시 정확히 측정합니다!

  // (불필요한 applyCreatorXform 호출은 삭제하여 시점이 틀어지는 현상 방지)
  fitCreator('edit'); 
  const fb=new THREE.Box3().setFromObject(newInst.faceMesh);
  const fs=fb.getSize(new THREE.Vector3());
  fb.getCenter(cFaceCenter);
  cFaceCenter.y += 0.12;   // ▲ 한 칸만큼 시선 높임 (기본과 동일)
  
  const fovV=cCam.fov*Math.PI/180, aspect=222/300;
  const dV=(fs.y/2)/Math.tan(fovV/2), dH=(fs.x/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
  cFaceDist=Math.max(dV,dH)*0.63 + fs.z*0.5 + 0.10;   // 얼굴 확대 (기본과 동일 계수)
  
  const bb=new THREE.Box3().setFromObject(newInst.root);
  const bs=bb.getSize(new THREE.Vector3());
  bb.getCenter(cBodyCenter); cBodyDist=Math.max(bs.x,bs.y)*1.7+0.3;
}

function clearCreatorItems(){ if(!cBase)return; if(cBase.deskItems){ DESK_ITEMS.forEach(def=>{ if(cBase.deskItems[def.id]) equipDeskItem(cBase,def,false); }); } cBase.activeDeskItem=null; }
function closeCreator(){creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');
  clearStampState();   // 도장 이미지·모드 모두 초기화 (다음 생성/수정 진입 시 깨끗한 상태로)
  // ★ kind==='slot'만 체크하면 런처에서 우클릭(kind==='seat')으로 들어왔다가 완료 없이 X로 닫을 때 런처가 안 돌아옴.
  //   openCreator가 진입 시 기록해둔 cameFromLauncher로 판단(afterApp 흐름은 기존대로 제외).
  if(creatorMode.cameFromLauncher && !creatorMode.afterApp){document.getElementById('launcher').classList.add('on');renderLauncher();}
  if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();}
document.getElementById('creatorClose').addEventListener('click',closeCreator);
document.getElementById('crDone').addEventListener('click',()=>{
  const def=charDef(skinIndex,snapCanvas(faceC),snapCanvas(blinkC),cTopColor,cBotColor);
  // 커미션 캐릭터로 진입했다면 GLB·이름·플래그를 새 def에 복사 (안 그러면 기본 GLB로 돌아감)
  if(currentCreatorDef && currentCreatorDef.isCommission){
    def.isCommission = true;
    def.commName = currentCreatorDef.commName || '커미션';
    def.commGlb = currentCreatorDef.commGlb || null;
  }
  def.xf={s:cXform.s,y:cXform.y,z:cXform.z,rot:cXform.rot,x:0};
  def.deskColor=cDeskColor;
  if(cBase){ const di=collectDeskItems(cBase); if(di){ def.deskItems=di;
    const ci={}; Object.keys(di).forEach(id=>{ const c=customItems[id]; if(c)ci[id]={name:c.name,glb:c.glb}; });
    if(Object.keys(ci).length) def.customItems=ci; } }
  if(cDeskGlbB64){ def.deskGlb=cDeskGlbB64; }
  if(cDeskScale!==1) def.deskScale=cDeskScale;
  if(creatorMode.kind==='seat'){
    applyCharToSeat(creatorMode.seat,def);
    if(creatorMode.seat.slot!=null) slots[creatorMode.seat.slot]=def;
    saveSlots();creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');clearStampState();
    // ★ 런처에서 우클릭 → 수정 → 완료로 들어온 경우 런처 화면을 다시 보여줘야 함(openCreator가 진입 시 꺼놨었음).
    //   런처 화면이 아니라 실행(run) 중 우클릭 수정이었다면 이 블록은 건너뛰고, 아래 applyDesktopRunClass()가
    //   runmode/config 바디 클래스를 다시 정확히 계산해서 원래 화면(런처든 실행 화면이든)이 정상적으로 복귀함.
    if(creatorMode.cameFromLauncher){ document.getElementById('launcher').classList.add('on'); renderLauncher(); }
    if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
    toast('수정했어요');return;}
  let target=creatorMode.edit?creatorMode.slot:(slots[curSlot]?slots.findIndex(s=>!s):curSlot);
  if(target<0||target>2){toast('빈 슬롯이 없어요');return;}
  slots[target]=def;curSlot=target;saveSlots();
  if(creatorMode.afterApp){const seat=createSeat();applyCharToSeat(seat,def);seat.slot=target;selectSeat(seat);renderSeatTabs();layoutSeats();
    creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');clearStampState();toast('책상에 추가했어요');}
  else{closeCreator();toast('슬롯에 저장했어요');}});

/* --- 런처 미리보기 렌더러 --- */
let lRenderer=null,lScene=null,lCam=null,lChar=null,lBlinkT=0,lBlinkOn=false,lHolder=null,lDeskMat=null,lScaleHint=1;
const LAUNCHER_CHAR_Y = 0.0;    // 런처 미리보기 전용 캐릭터 Y 오프셋 (피봇 0점 기준에 맞춰 바닥에 붙임)
const PS1_PIXEL_SCALE = 0.55;   // 런처 미리보기 도트 느낌 배율 — 작을수록 더 거친 도트(0.2~0.4 권장)
function ensureLauncherPreview(){
  if(lRenderer)return;
  // PS1/도트 느낌: antialias 끄고, 낮은 내부 해상도로 렌더한 뒤 CSS(image-rendering:pixelated)로 확대.
  lRenderer=new THREE.WebGLRenderer({canvas:document.getElementById('lcPreview'),antialias:false,alpha:true});
  lRenderer.setPixelRatio(1);lRenderer.outputEncoding=THREE.sRGBEncoding;
  document.getElementById('lcPreview').style.imageRendering='pixelated';
  lScene=new THREE.Scene();lScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
  const k=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT);k.position.set(0,4,0);lScene.add(k);
  lCam=new THREE.PerspectiveCamera(32,1,0.1,100);
  const desk=buildDesk(true);lScene.add(desk);
  desk.visible=false;   // 런처 슬롯 미리보기: 책상(+책상 위 아이템) 숨김 — 캐릭터만 둥둥 뜨게. lHolder 로직은 그대로 유지
  const dt=desk.getObjectByName('deskTop'); if(dt){dt.material=dt.material.clone(); lDeskMat=dt.material;}
  lHolder={desk:desk, deskAnchor:desk.userData.deskAnchor, deskItems:{}, deskMat:lDeskMat, activeDeskItem:null};}
function sizeLauncherPreview(){const c=document.getElementById('lcPreview');const w=c.clientWidth||260,h=c.clientHeight||228;
  const d=Math.max(1,lScaleHint||1);
  // 실제 렌더 해상도는 낮게(도트 느낌), CSS 표시 크기는 그대로 유지 → false를 넘겨 canvas.style을 안 건드림.
  const rw=Math.max(2,Math.round(w*PS1_PIXEL_SCALE)), rh=Math.max(2,Math.round(h*PS1_PIXEL_SCALE));
  lRenderer.setSize(rw,rh,false);
  c.style.width=w+'px'; c.style.height=h+'px';
  lCam.aspect=w/h;lCam.updateProjectionMatrix();lCam.position.set(0.20*d,0.85*d,2.0*d);lCam.lookAt(0,0.75*d,-0.25*d);}
function setLauncherChar(def){if(lChar){lScene.remove(lChar.group);lChar=null;}
  if(lHolder){ allDeskItems().forEach(d=>{ if(lHolder.deskItems[d.id]) equipDeskItem(lHolder,d,false); });
    swapDeskVisual(lHolder.desk,null); }
  if(!def)return;
  if(lDeskMat) lDeskMat.color.set(def.deskColor||'#c9a36a');
  if(lHolder) setDeskScale(lHolder.desk, def.deskScale||1);

  const applyBase = (customScene) => {
    const base=defToBase(def, customScene); const g=base.group; const xf=def.xf;
    applyStaticHandRest(g); // 런처 미리보기 캐릭터에 팔 높이 반영
    g.position.set(0,(xf&&xf.y)||0,CHAR_Z+((xf&&xf.z)||0));
    g.scale.setScalar((xf&&xf.s)||1);
    g.rotation.y=RIG_TURN+((xf&&xf.rot)||0);
    g.updateWorldMatrix(true,true);
    // 커미션 모델은 자신의 X값을 무시하고 원본(기본 캐릭터) 기준 중앙 정렬 유지
    if (!(def && def.isCommission)) {
      const bb=new THREE.Box3().setFromObject(g), c=bb.getCenter(new THREE.Vector3()); 
      g.position.x-=c.x; 
    }
    lScene.add(g); lChar=base; lScaleHint=(xf&&xf.s)||1; sizeLauncherPreview();
    (async()=>{
      if(def.customItems){ for(const id in def.customItems){ if(!customItems[id]){ const c=def.customItems[id]; try{ const sc=await parseGlbBytes(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc);}catch(e){} } } }
      if(def.deskGlb&&lHolder){ try{ const sc=await parseGlbBytes(b64ToBuf(def.deskGlb)); lHolder.desk.userData.deskScale=def.deskScale||1; swapDeskVisual(lHolder.desk,sc); if(def.deskColor)applyDeskColorToCustom(lHolder.desk,def.deskColor);}catch(e){} }
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
      lChar.group.position.y=LAUNCHER_CHAR_Y+Math.sin(performance.now()*0.0016)*0.015;}
    lRenderer.render(lScene,lCam);}
  requestAnimationFrame(launcherLoop);}

function renderLauncher(){
  ensureLauncherPreview();
  const def=slots[curSlot];
  document.getElementById('lcCount').textContent='('+(curSlot+1)+'/3)';
  document.getElementById('lcEmpty').style.display=def?'none':'flex';
  document.getElementById('lcGear').style.display=def?'block':'none';
  document.getElementById('lcPreview').style.display=def?'block':'none';
  const full=slots.every(s=>s);
  document.getElementById('lcCreate').disabled=full;document.getElementById('lcLoad').disabled=full;
  sizeLauncherPreview();setLauncherChar(def);closeGearMenu();}

/* --- 런처 컨트롤 --- */
const gearMenu=document.getElementById('lcGearMenu');
function closeGearMenu(){gearMenu.classList.remove('on');}
document.getElementById('lcPrev').onclick=()=>{curSlot=(curSlot+2)%3;renderLauncher();};
document.getElementById('lcNext').onclick=()=>{curSlot=(curSlot+1)%3;renderLauncher();};
const previewWrap=document.querySelector('.lc-preview-wrap');
previewWrap.addEventListener('mouseenter',()=>{if(slots[curSlot])previewWrap.classList.add('show-go');});
previewWrap.addEventListener('mouseleave',()=>previewWrap.classList.remove('show-go'));
document.getElementById('lcPreview').addEventListener('click',()=>{if(slots[curSlot])launchApp({mode:'run'});});
document.getElementById('lcGear').onclick=e=>{e.stopPropagation();gearMenu.classList.toggle('on');};
document.addEventListener('click',()=>closeGearMenu());
gearMenu.addEventListener('click',e=>e.stopPropagation());
document.getElementById('lcEdit').onclick=()=>{closeGearMenu();if(slots[curSlot])openCreator({kind:'slot',edit:true,slot:curSlot});};
document.getElementById('lcDelete').onclick=()=>{closeGearMenu();
  // 삭제 후 뒤 슬롯들을 앞으로 당겨옴(선입선출) — 예: 1번 삭제하면 2번→1번, 3번→2번
  for(let i=curSlot;i<slots.length-1;i++){ slots[i]=slots[i+1]; }
  slots[slots.length-1]=null;
  saveSlots();renderLauncher();toast('삭제했어요');};
/* 종족 선택창: 신규 생성 진입 전에 1단계 추가 (수정·친구추가 흐름은 그대로) */
let rRenderer=null, rScene=null, rCam=null, rChar=null;
function initRacePreview(){
  if(rRenderer) return;
  const cv=document.getElementById('raceHumanCv');
  rRenderer=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true});   // antialias 끔 — 도트 느낌 선명하게
  rRenderer.setPixelRatio(1);
  rRenderer.outputEncoding=THREE.sRGBEncoding;
  cv.style.imageRendering='pixelated';
  rScene=new THREE.Scene();
  rScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
  const k=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT); k.position.set(0,4,0); rScene.add(k);
  rCam=new THREE.PerspectiveCamera(32,1,0.1,100);
  rCam.position.set(0,1.0,2.6); rCam.lookAt(0,0.85,0);
}
const RACE_PIXEL_SCALE = 0.4;   // 유형선택 팝업 미리보기 도트 배율 — 작을수록 더 거친 도트
function renderRacePreview(){
  if(!rRenderer)return;
  const rw=Math.max(2,Math.round(160*RACE_PIXEL_SCALE));
  rRenderer.setSize(rw,rw,false);
  const cv=document.getElementById('raceHumanCv');
  cv.style.width='160px'; cv.style.height='160px';   // CSS 표시 크기는 그대로, 실제 렌더 버퍼만 작게
  rCam.aspect=1; rCam.updateProjectionMatrix();
  if(!rChar && BASE_SCENE){
    const base=instantiateBase();
    if(base){
      applyLightPresetToInstance(base);   // 생성기·메인과 같은 톤
      rChar=base.root;
      normalizeModel(rChar, 1.4);
      rChar.rotation.y=Math.PI;   // 캐릭터 정면이 카메라(+Z) 쪽을 향하도록
      rScene.add(rChar);
    }
  }
  rRenderer.render(rScene,rCam);
}
function openRacePicker(){
  initRacePreview();
  document.getElementById('raceOverlay').classList.add('on');
  if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();   // 창이 런처(작은) 크기인지 강제 재확인
  // GLB 로드가 아직 끝나지 않은 경우를 대비해 다음 프레임에서 한 번 더 시도
  requestAnimationFrame(renderRacePreview);
  if(!BASE_SCENE) setTimeout(renderRacePreview, 200);
}
document.getElementById('raceCancel').onclick=()=>document.getElementById('raceOverlay').classList.remove('on');
document.getElementById('raceHuman').onclick=()=>{
  document.getElementById('raceOverlay').classList.remove('on');
  openCreator({kind:'slot',edit:false});
};

/* === 커미션 캐릭터 코드 입력 (일반 사용자도 가능) === */
const commImpOverlay=document.getElementById('commImpOverlay');
document.getElementById('raceCommCode').onclick=()=>{
  const panel=document.getElementById('raceCommCodePanel');
  const willOpen = panel.style.display==='none';
  panel.style.display = willOpen ? 'block' : 'none';
  if(willOpen){ document.getElementById('commImpCode').value=''; document.getElementById('commImpPass').value=''; }
};
document.getElementById('commImpCancel').onclick=()=>{ document.getElementById('raceCommCodePanel').style.display='none'; };
document.getElementById('commImpGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  const code=document.getElementById('commImpCode').value.trim(), pass=document.getElementById('commImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  // 슬롯 공간 확인 (lcCreate 패턴과 동일)
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  try{
    const payload=await decryptCommission(code, pass);
    if(payload.t!=='comm') throw new Error('형식 오류');
    // 빈 슬롯 찾기
    let idx=slots.findIndex(s=>!s); if(idx<0) idx=0;
    // 텍스처를 캔버스로 변환 (charDef와 호환)
    const faceCv=await dataUrlToCanvas(payload.face, CANVAS_SZ);
    const blinkCv=await dataUrlToCanvas(payload.blink, CANVAS_SZ);
    // def 만들기: 기존 charDef 시그니처 그대로 + 커미션 필드들
    const def = charDef(0, faceCv, blinkCv, '#ffffff', '#ffffff');
    def.isCommission = true;             // 잠금된 캐릭터 표시
    def.commName = payload.name || '커미션';
    def.commGlb = payload.glb;           // base64 GLB (베이스 모델)
    def.xf = {s:0.7,y:0,z:0,rot:0,x:0};
    // 슬롯에 저장 + 영구 저장
    slots[idx]=def;
    saveSlots();
    curSlot=idx;
    renderLauncher();
    toast('"'+def.commName+'" 캐릭터를 등록했어요');
    document.getElementById('raceCommCodePanel').style.display='none';
    document.getElementById('raceOverlay').classList.remove('on');
    // 바로 생성기 진입 — openCreator가 isCommission 보고 5단계(책상)부터 시작
    openCreator({kind:'slot', edit:true, slot:idx});
  }catch(e){ toast('등록 실패: 코드나 비밀번호를 확인해 주세요'); }
};

/* 데이터 URL → CANVAS_SZ×CANVAS_SZ 캔버스 (face/blink 호환) */
function dataUrlToCanvas(dataUrl, sz){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=sz; cv.height=sz;
      cv.getContext('2d').drawImage(im,0,0,sz,sz);
      res(cv);
    };
    im.onerror=()=>rej(new Error('image load'));
    im.src=dataUrl;
  });
}

// 동물 카드는 의도적으로 핸들러 없음(클릭해도 무반응) — 공사중 표시로 충분
document.getElementById('lcCreate').onclick=()=>{
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  openRacePicker();
};
document.getElementById('lcLoad').onclick=()=>{if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}openCodeModal();};

/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
function applyCharToSeat(seat,def){
  seat.charDef=def;
  // 커미션 캐릭터: 커스텀 베이스 GLB로 인스턴스 생성. 캐시 없으면 비동기 파싱 후 재호출
  let customScene = null;
  if(def.commGlb){
    customScene = commSceneCache.get(def.commGlb);
    if(!customScene){
      getCommissionScene(def.commGlb).then(()=>applyCharToSeat(seat,def)).catch(e=>console.warn('comm GLB 파싱 실패', e));
      return;
    }
  }
  const inst=instantiateBase(customScene);
  if(inst){
    const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
    setFaceMap(inst.faceMat, fT);
    // 커미션이 아닐 때만 옷색 적용 (커미션은 텍스처 기반이라 머티리얼 색=흰색 유지)
    if(!def.isCommission){
      if(inst.upMat)inst.upMat.color.set(def.top); if(inst.loMat)inst.loMat.color.set(def.bot);
    }
    applyLightPresetToInstance(inst);   // 생성기와 같은 톤(텍스처 색을 emissive로 평탄화)
    seat.faceMat=inst.faceMat; seat.faceMapOrig=fT; seat.blinkTex=bT;
    seat.upMesh=inst.upMesh||null; seat.loMesh=inst.loMesh||null;   // 옷 교체 시 기본 메시 숨김용
    setupSeatModel(seat, inst.root, BASE_ANIMS, '커스텀 캐릭터');
    
    // [수정] 생성기에서 설정한 캐릭터 크기와 위치 데이터를 메인 화면에 확실하게 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=xf.s; 
      seat.userY=0; 
      seat.userZ=xf.z; 
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
    applyEquippedPartsToSeat(seat, def);   // 저장된 꾸미기 파츠 부착
    
    if(selected===seat){ 
      document.getElementById('sScale').value=seat.userScale; 
      document.getElementById('sY').value=seat.userY;
      document.getElementById('sZ').value=seat.userZ; 
      document.getElementById('sRot').value=seat.userRot; 
    }
  } else {
    // 폴백: 내장 스탠드인 (기본 캐릭터)
    const base=defToBase(def);
    if(seat.gltfRoot)seat.bodyWrap.remove(seat.gltfRoot);
    seat.placeholder.root.visible=false;
    
    seat.bodyWrap.add(base.group);seat.gltfRoot=base.group;
    seat.isPlaceholder=false;seat.mixer=null;seat.hasRig=false;
    seat.faceMat=base.faceMat;seat.faceMapOrig=base.fT;seat.blinkTex=base.bT;
    seat.headAnchor.position.set(0,1.2,0);seat.bodyAnchor.position.set(0,0.7,0);
    
    // [수정] 폴백 캐릭터일 때도 생성기에서 설정한 크기를 똑같이 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=xf.s; 
      seat.userY=0; 
      seat.userZ=xf.z; 
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
  }

  // [수정] 공통 꾸미기 및 책상 크기/색상 적용 파트
  if(def.decor) applyDecorToSeat(seat, def.decor);   
  if(def.deskColor && seat.deskMat) seat.deskMat.color.set(def.deskColor);   
  
  // [수정] 생성기에서 조절한 책상 크기(def.deskScale)를 메인 화면의 책상(seat.desk)에 강제로 반영합니다!
  setDeskScale(seat.desk, def.deskScale||1);                  
  
  (async()=>{  
    if(def.customItems){ for(const id in def.customItems){ if(!customItems[id]){ const c=def.customItems[id]; try{ const sc=await parseGlbBytes(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc);}catch(e){} } } }
    if(def.deskGlb){ try{ const sc=await parseGlbBytes(b64ToBuf(def.deskGlb)); seat.desk.userData.deskScale=def.deskScale||1; swapDeskVisual(seat.desk,sc); if(def.deskColor)applyDeskColorToCustom(seat.desk,def.deskColor);}catch(e){} }
    if(def.deskItems) applyDeskItemsTo(seat, def.deskItems);
  })();
}
let appMode='run';
function showEl(id,on){const el=document.getElementById(id); if(el)el.style.display=on?'':'none';}
function applyAppMode(){
  const run=(appMode==='run');
  showEl('seatEditor', appMode==='editseat');   // 좌석 슬라이더는 좌석 세팅 모드에서만
  showEl('devFiles', false);                    // GLB 교체 등 dev 도구는 고객 화면에서 숨김
  showEl('statePrev', !run);                    // 상태 미리보기는 편집 모드에서만
  showEl('devHint', !run); showEl('runHint', run);
  const t=document.getElementById('appTitle'), s=document.getElementById('appSub');
  if(appMode==='editseat'){ t.textContent='🪑 좌석 세팅'; s.textContent='크기·높이·앞뒤·회전을 맞추세요 · 자동 저장'; }
  else if(appMode==='editdecor'){ t.textContent='🎨 책상 꾸미기'; s.textContent='소품을 달고 위치를 맞추세요 · 자동 저장'; }
  else { t.textContent='🪴 책상 친구들'; s.textContent='짧게 클릭하면 쓰다듬 · 편집은 런처 ⚙'; }
  if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
}
function launchApp(opts){ opts=opts||{};
  const myDef = slots[curSlot] || slots.find(Boolean);
  if(!myDef){toast('먼저 캐릭터를 만들어 주세요');return;}
  [...seats].forEach(s=>scene.remove(s.group));seats.length=0;
  const me=createSeat(); applyCharToSeat(me,myDef); me.slot=curSlot; me.isMe=true;
  selectSeat(me);renderSeatTabs();setManual(null);
  appMode = (opts.mode==='edit') ? (opts.editTarget==='seat'?'editseat':'editdecor') : 'run';
  applyAppMode();
  document.getElementById('launcher').classList.remove('on');
  if(Presence.active()) syncFriendSeats(Presence.friendsObj());   // 초대된 친구 복원
  layoutSeats();
  if(appMode==='editdecor') openDecor(me);
}
function backToLauncher(){
  if(decorOverlay.classList.contains('on')) closeDecor();
  appMode='run';
  document.getElementById('launcher').classList.add('on');
  renderLauncher();
  if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
}
document.getElementById('toLauncher').onclick=backToLauncher;

/* ===================== 친구 초대 · 상태 공유 (Presence) =====================
   provider 인터페이스: join(room, me, onFriends) / update(state) / leave()
   지금은 makeMockProvider(로컬 시뮬레이션). 실서비스에선 makeFirebaseProvider로 교체.   */
const MAX_PEOPLE=4;   // 나 + 친구 최대 3
const Presence=(()=>{
  let provider=null, room=null, friends={}, myDef=null, myName='나', myState='idle', myUserStatus=null, onChange=null;
  function start(roomCode, def, name, changeCb){
    room=roomCode; myDef=def; myName=name||'나'; onChange=changeCb||onChange; friends={};
    // HTML의 모듈 스크립트가 준비한 window.firebaseAPI가 있으면 그걸 쓰고, 없으면(로드 지연·실패 등) 가짜 시연 데이터로 폴백.
    provider = window.firebaseAPI ? makeFirebaseProvider() : makeMockProvider();
    provider.join(room, {def:myDef,name:myName,state:myState,userStatus:myUserStatus}, fr=>{ friends=fr; if(onChange)onChange(friends); });
    return room;
  }
  function setState(s){ if(s===myState)return; myState=s; if(provider&&provider.update)provider.update({state:myState,userStatus:myUserStatus}); }
  function setUserStatus(s){ if(s===myUserStatus)return; myUserStatus=s; if(provider&&provider.update)provider.update({state:myState,userStatus:myUserStatus}); }
  function stop(){ if(provider&&provider.leave)provider.leave(); provider=null; room=null; friends={}; if(onChange)onChange({}); }
  return { start, setState, setUserStatus, stop, active:()=>!!provider, roomCode:()=>room, friendsObj:()=>friends };
})();

/* Firebase Realtime Database 연동 — 실제 함수는 HTML의 <script type="module">이 window.firebaseAPI로 노출.
   Presence가 기대하는 join/update/leave 인터페이스로 감싸기만 함. */
function makeFirebaseProvider(){
  return {
    join(room, me, changeCb){
      window.firebaseAPI.joinRoom(room, me, changeCb);
    },
    update(payload){
      window.firebaseAPI.updateMe(payload);
    },
    leave(){
      window.firebaseAPI.leaveRoom();
    }
  };
}

/* 로컬 시뮬레이션 — Firebase 연결 전, 친구들이 타이핑/졸기 하는 걸 보여줌 */
function makeMockProvider(){
  let timer=null, cb=null, fr={};
  const names=['민지','현우','소라'], skins=[2,3,4,1], tops=['#c98a8a','#8aa0c9','#9ac98a'];
  const pick=()=>{ const r=Math.random(); return r<0.55?'focus':(r<0.8?'idle':'sleep'); };
  const pickUs=()=>{ const r=Math.random(); if(r<0.65) return null;   // 65%는 상태 없음
    const arr=['meal','away','grind','gaming']; return arr[Math.floor(Math.random()*arr.length)]; };
  return {
    join(room, me, changeCb){ cb=changeCb;
      const n=2;   // 시연용 가짜 친구 2명
      for(let i=0;i<n;i++){ fr['mock'+i]={ name:names[i], def:mockFriendDef(me.def, skins[i%skins.length], tops[i%tops.length]), state:pick(), userStatus:pickUs() }; }
      cb(Object.assign({},fr));
      timer=setInterval(()=>{ let ch=false;
        for(const id in fr){
          if(Math.random()<0.45){ fr[id].state=pick(); ch=true; }
          if(Math.random()<0.18){ fr[id].userStatus=pickUs(); ch=true; }   // 친구 활동상태도 가끔 변경
        }
        if(ch)cb(Object.assign({},fr));
      }, 3500);
    },
    update(payload){ /* 로컬 시연: 내 상태는 가짜 친구에게 전달되지 않음 (Firebase 단계에서 push) */ },
    leave(){ if(timer)clearInterval(timer); timer=null; fr={}; }
  };
}
function mockFriendDef(baseDef, skin, top){ baseDef=baseDef||{skin:1,face:null,blink:null,top:'#888',bot:'#666',xf:{}};
  return Object.assign({}, baseDef, { skin, top:top||baseDef.top, deskGlb:null, customItems:null, deskItems:null,
    xf:Object.assign({s:1,y:0,z:0,rot:0}, baseDef.xf||{}, {x:0}) }); }

/* friends 데이터 → 친구 좌석 추가/갱신/제거 */
function syncFriendSeats(friends){
  friends=friends||{};
  const ids=Object.keys(friends).slice(0, MAX_PEOPLE-1);   // 친구는 최대 3
  const have={}; seats.filter(s=>s.remote).forEach(s=>{ have[s.friendId]=s; });
  Object.keys(have).forEach(id=>{ if(!friends[id]){ const s=have[id]; scene.remove(s.group); const ix=seats.indexOf(s); if(ix>=0)seats.splice(ix,1); } });
  ids.forEach(id=>{ let s=have[id];
    if(!s){ s=createSeat(); s.remote=true; s.friendId=id; applyCharToSeat(s, friends[id].def); }
    s.friendName=friends[id].name; s.remoteState=friends[id].state; s.remoteUserStatus=friends[id].userStatus||null; });
  layoutSeats(); if(typeof renderSeatTabs==='function') renderSeatTabs();
}

/* 초대 UI 연결 */
function genRoomCode(){ const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='COZY-'; for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)]; return s; }
function presenceChanged(friends){
  const cnt=Object.keys(friends).length;
  const lbl=document.getElementById('inviteFriendCnt'); if(lbl)lbl.textContent=cnt?('· 친구 '+cnt+'명 접속'):'';
  if(seats.some(s=>s.isMe)) syncFriendSeats(friends);
}
function refreshInviteUI(){ const on=Presence.active();
  document.getElementById('inviteIdle').style.display=on?'none':'';
  document.getElementById('inviteActive').style.display=on?'':'none';
  if(on) document.getElementById('inviteRoomLbl').textContent=Presence.roomCode();
}
const USER_NAME_KEY = 'tw.userName';
function getUserName(){
  try{ return localStorage.getItem(USER_NAME_KEY) || '나'; }catch(e){ return '나'; }
}
function setUserName(name){
  try{ localStorage.setItem(USER_NAME_KEY, name || '나'); }catch(e){}
}
function startRoom(code){ const myDef=slots[curSlot]||slots.find(Boolean);
  if(!myDef){ toast('먼저 내 캐릭터를 만들어 주세요'); return; }
  Presence.start(code, myDef, getUserName(), presenceChanged); refreshInviteUI(); toast('방에 연결됐어요: '+code); }
document.getElementById('lcInvite').onclick=()=>{ refreshInviteUI(); document.getElementById('inviteOverlay').classList.add('on'); };
document.getElementById('inviteClose').onclick=()=>document.getElementById('inviteOverlay').classList.remove('on');

/* --- 사용자 이름 설정 --- */
document.getElementById('lcNameBtn').onclick=()=>{
  const o=document.getElementById('userNameOverlay'); o.classList.add('on'); o.style.display='flex';
  document.getElementById('userNameInput').value = getUserName()==='나' ? '' : getUserName();
};
document.getElementById('userNameCloseBtn').onclick=()=>{
  const o=document.getElementById('userNameOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('userNameSaveBtn').onclick=()=>{
  const v=document.getElementById('userNameInput').value.trim();
  setUserName(v||'나');
  toast('이름이 저장됐어요');
  const o=document.getElementById('userNameOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('userNameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('userNameSaveBtn').click(); });
document.getElementById('inviteCreate').onclick=()=>{ const c=genRoomCode(); document.getElementById('inviteCode').value=c; startRoom(c); };
document.getElementById('inviteJoin').onclick=()=>{ const c=(document.getElementById('inviteCode').value||'').trim().toUpperCase(); if(!c){toast('방 코드를 입력하세요');return;} startRoom(c); };
document.getElementById('inviteLeave').onclick=()=>{ Presence.stop(); refreshInviteUI(); };

/* --- 라이선스 등록 UI --- */
function refreshLicenseUI(){
  const box=document.getElementById('licenseActiveBox');
  const input=document.getElementById('licenseKeyInput');
  const submitBtn=document.getElementById('licenseSubmitBtn');
  const err=document.getElementById('licenseErrorMsg');
  if(err) err.style.display='none';
  if(box) box.style.display = isPremium ? 'block' : 'none';
  if(input) input.style.display = isPremium ? 'none' : 'block';
  if(submitBtn) submitBtn.style.display = isPremium ? 'none' : 'block';
  const lbl=document.getElementById('lcLicenseLbl');
  if(lbl) lbl.textContent = isPremium ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록';
}
/* 런처 타이틀바 — 드래그로 창 이동(위치 기억은 main.js가 처리) + 최소화/최대화/닫기 */
/* 런처 타이틀바 드래그 이동은 CSS -webkit-app-region:drag(네이티브)로 처리 — JS 기반보다 안정적.
   여기서는 X 버튼(앱 종료)만 바인딩. */
(function bindLauncherTitlebar(){
  const closeBtn=document.getElementById('lcCloseBtn');
  if(closeBtn) closeBtn.onclick=e=>{ e.stopPropagation();
    if(window.companion && companion.quitApp) companion.quitApp();
  };
})();

/* 팝업(오버레이)이 뜨면 뒤의 런처 카드를 비활성처럼 톤다운 — MutationObserver로 .on 클래스 변화 감시 */
(function bindLauncherDim(){
  const card = document.querySelector('.lc-card');
  if(!card) return;
  const overlaySelectors = ['#codeOverlay','#exportOverlay','#glbEncOverlay','#glbLoadOverlay',
    '#assetGenOverlay','#assetImpOverlay','#inviteOverlay','#commGenOverlay','#commImpOverlay',
    '#partRegOverlay','#creatorOverlay','#licenseOverlay','#adminPassOverlay','#licenseGenOverlay',
    '#adBannerOverlay','#raceOverlay'];
  function refresh(){
    const anyOpen = overlaySelectors.some(sel=>{ const el=document.querySelector(sel); return el && el.classList.contains('on'); });
    card.classList.toggle('dimmed', anyOpen);
  }
  overlaySelectors.forEach(sel=>{
    const el=document.querySelector(sel); if(!el) return;
    new MutationObserver(refresh).observe(el, { attributes:true, attributeFilter:['class'] });
  });
  refresh();
})();

/* 광고 배너 — localStorage에 저장된 이미지/링크를 런처 하단에 표시. 관리자만 편집 가능. */
const AD_BANNER_KEY = 'tw.adBanner';
function refreshAdBanner(){
  const a=document.getElementById('lcAdBanner'); const img=document.getElementById('lcAdBannerImg');
  if(!a||!img) return;
  try{
    const data = JSON.parse(localStorage.getItem(AD_BANNER_KEY)||'null');
    if(data && data.img){ img.src=data.img; a.href=data.link||'#'; a.style.display='block'; }
    else { a.style.display='none'; }
  }catch(e){ a.style.display='none'; }
}
document.getElementById('lcAdBanner').addEventListener('click', e=>{
  const href=e.currentTarget.getAttribute('href');
  if(!href || href==='#'){ e.preventDefault(); }
  // Electron에서 target=_blank가 새 창을 못 띄울 수 있어 shell.openExternal 대신 그냥 기본 동작에 맡김(브라우저 테스트 호환)
});
document.getElementById('lcAdBannerEdit').onclick=()=>{
  const o=document.getElementById('adBannerOverlay'); o.classList.add('on'); o.style.display='flex';
  try{
    const data = JSON.parse(localStorage.getItem(AD_BANNER_KEY)||'null');
    document.getElementById('adBannerImgInput').value = (data&&data.img)||'';
    document.getElementById('adBannerLinkInput').value = (data&&data.link)||'';
  }catch(e){}
};
document.getElementById('adBannerCloseBtn').onclick=()=>{
  const o=document.getElementById('adBannerOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('adBannerSaveBtn').onclick=()=>{
  const img=document.getElementById('adBannerImgInput').value.trim();
  const link=document.getElementById('adBannerLinkInput').value.trim();
  if(img){ localStorage.setItem(AD_BANNER_KEY, JSON.stringify({img,link})); toast('배너가 저장됐어요'); }
  else { localStorage.removeItem(AD_BANNER_KEY); toast('배너가 숨겨졌어요'); }
  refreshAdBanner();
  const o=document.getElementById('adBannerOverlay'); o.classList.remove('on'); o.style.display='none';
};
refreshAdBanner();

document.getElementById('lcLicenseBtn').onclick=()=>{ refreshLicenseUI();
  const lo=document.getElementById('licenseOverlay'); lo.classList.add('on'); lo.style.display='flex'; };
document.getElementById('licenseCancelBtn').onclick=()=>{
  const lo=document.getElementById('licenseOverlay'); lo.classList.remove('on'); lo.style.display='none'; };
document.getElementById('licenseSubmitBtn').onclick=async ()=>{
  const input=document.getElementById('licenseKeyInput');
  const err=document.getElementById('licenseErrorMsg');
  const btn=document.getElementById('licenseSubmitBtn');
  const key=(input.value||'').trim();
  if(!key){ err.textContent='라이선스 키를 입력해 주세요'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='확인 중...';
  const r=await activateLicense(key);
  btn.disabled=false; btn.textContent='확인';
  if(r.ok){
    toast('🎉 라이선스가 등록됐어요! 꾸미기를 이용할 수 있어요');
    refreshLicenseUI();
    setTimeout(()=>{ const lo=document.getElementById('licenseOverlay'); lo.classList.remove('on'); lo.style.display='none'; }, 900);
  } else {
    err.textContent = r.reason || '등록에 실패했어요'; err.style.display='block';
  }
};
document.getElementById('licenseDeactivateBtn').onclick=()=>{
  deactivateLicense(); refreshLicenseUI(); toast('이 기기에서 라이선스가 해제됐어요');
};
document.getElementById('licenseKeyInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('licenseSubmitBtn').click(); });

/* --- 관리자 비밀번호 모달 바인딩 --- */
document.getElementById('adminPassOk').onclick=_submitAdminPass;
document.getElementById('adminPassCancel').onclick=()=>{
  const o=document.getElementById('adminPassOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('adminPassInput').addEventListener('keydown', e=>{ if(e.key==='Enter') _submitAdminPass(); });

/* --- 라이선스 키 발급 (관리자 전용) --- */
async function renderLicenseGenList(){
  const listEl=document.getElementById('licenseGenList');
  if(!listEl || !window.firebaseAPI) return;
  listEl.textContent='불러오는 중...';
  try{
    const all = await window.firebaseAPI.listLicenses();
    const keys = Object.keys(all);
    if(!keys.length){ listEl.textContent='아직 발급된 키가 없어요'; return; }
    listEl.innerHTML='';
    keys.reverse().forEach(k=>{
      const d=all[k];
      const row=document.createElement('div');
      row.style.cssText='padding:4px 0;border-bottom:1px solid rgba(201,165,123,.15);display:flex;justify-content:space-between;gap:6px;';
      row.innerHTML = `<span style="font-family:'Courier New',monospace;">${k}</span>
        <span style="text-align:right;flex-shrink:0;">${d.redeemedAt?'✅ 사용됨':'⬜ 미사용'} ${d.note?('· '+d.note):''}</span>`;
      listEl.appendChild(row);
    });
  }catch(e){ listEl.textContent='목록을 불러오지 못했어요'; }
}
document.getElementById('lcLicenseGen').onclick=()=>{
  const o=document.getElementById('licenseGenOverlay'); o.classList.add('on'); o.style.display='flex';
  document.getElementById('licenseGenResult').style.display='none';
  document.getElementById('licenseGenNote').value='';
  renderLicenseGenList();
};
document.getElementById('licenseGenClose').onclick=()=>{
  const o=document.getElementById('licenseGenOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('licenseGenBtn').onclick=async ()=>{
  if(!window.firebaseAPI){ toast('네트워크 연결을 확인해 주세요'); return; }
  const note=document.getElementById('licenseGenNote').value.trim();
  const key=_genLicenseKey();
  const btn=document.getElementById('licenseGenBtn');
  btn.disabled=true; btn.textContent='발급 중...';
  try{
    await window.firebaseAPI.createLicense(key, note);
    document.getElementById('licenseGenKeyText').textContent=key;
    document.getElementById('licenseGenResult').style.display='block';
    renderLicenseGenList();
  }catch(e){ toast('발급 실패 — 네트워크를 확인해 주세요'); }
  btn.disabled=false; btn.textContent='새 키 발급';
};
document.getElementById('licenseGenCopyBtn').onclick=()=>{
  const text=document.getElementById('licenseGenKeyText').textContent;
  try{ navigator.clipboard.writeText(text); toast('복사됐어요'); }
  catch(e){ toast('복사 실패 — 직접 드래그해서 복사해 주세요'); }
};

/* --- 책상에서 친구 추가: 저장 캐릭터 선택 or 새로 만들기 --- */
function drawFaceThumb(cv,def){const x=cv.getContext('2d');
  x.fillStyle=skinColorFor(def.skin);x.beginPath();x.arc(40,40,33,0,7);x.fill();
  x.fillStyle=def.bot;x.fillRect(16,70,48,12);x.fillStyle=def.top;x.fillRect(16,64,48,12);
  try{x.drawImage(def.face,9,9,62,62);}catch(e){}}
function openAddFriend(){
  const saved=slots.map((d,i)=>({d,i})).filter(o=>o.d);
  if(!saved.length){openCreator({kind:'slot',edit:false,afterApp:true});return;}
  const grid=document.getElementById('fpGrid');grid.innerHTML='';
  saved.forEach(({d,i})=>{const it=document.createElement('div');it.className='fp-item';
    const cv=document.createElement('canvas');cv.width=cv.height=80;drawFaceThumb(cv,d);it.appendChild(cv);
    const sp=document.createElement('span');sp.textContent='슬롯 '+(i+1);it.appendChild(sp);
    it.onclick=()=>{document.getElementById('friendPicker').classList.remove('on');
      const seat=createSeat();applyCharToSeat(seat,d);seat.slot=i;selectSeat(seat);renderSeatTabs();layoutSeats();toast('책상에 추가했어요');};
    grid.appendChild(it);});
  if(saved.length<3){const nw=document.createElement('div');nw.className='fp-item new';nw.innerHTML='＋<span>새로 만들기</span>';
    nw.onclick=()=>{document.getElementById('friendPicker').classList.remove('on');openCreator({kind:'slot',edit:false,afterApp:true});};
    grid.appendChild(nw);}
  document.getElementById('friendPicker').classList.add('on');}
document.getElementById('fpCancel').onclick=()=>document.getElementById('friendPicker').classList.remove('on');

/* --- 저장/복원 (localStorage). 로컬 실행·Electron에선 동작, 챗 미리보기 샌드박스에선 무시됨 --- */
const LS_KEY='deskFriends.slots.v1';
function slotToObj(d){return d?{skin:d.skin||0,top:d.top,bot:d.bot,xf:d.xf||null,decor:d.decor||null,deskColor:d.deskColor||null,deskItems:d.deskItems||null,deskGlb:d.deskGlb||null,deskScale:d.deskScale||null,customItems:d.customItems||null,isCommission:d.isCommission||false,commName:d.commName||null,commGlb:d.commGlb||null,equippedParts:d.equippedParts||null,face:d.face.toDataURL('image/png'),blink:d.blink.toDataURL('image/png')}:null;}
function saveSlots(){try{localStorage.setItem(LS_KEY,JSON.stringify(slots.map(slotToObj)));}catch(e){}}
async function loadSlots(){let raw;try{raw=localStorage.getItem(LS_KEY);}catch(e){return;}
  if(!raw)return;let arr;try{arr=JSON.parse(raw);}catch(e){return;}
  for(let i=0;i<3;i++){const o=arr[i];if(!o){continue;}
    try{const[f,b]=await Promise.all([loadImg(o.face),loadImg(o.blink)]);
      const fc=newCanvas();fc.getContext('2d').drawImage(f,0,0);const bc=newCanvas();bc.getContext('2d').drawImage(b,0,0);
      {const _d=charDef(o.skin||0,fc,bc,o.top,o.bot);if(o.xf)_d.xf=o.xf;if(o.decor)_d.decor=o.decor;if(o.deskColor)_d.deskColor=o.deskColor;if(o.deskItems)_d.deskItems=o.deskItems;if(o.deskGlb)_d.deskGlb=o.deskGlb;if(o.deskScale)_d.deskScale=o.deskScale;if(o.customItems)_d.customItems=o.customItems;
        if(o.isCommission){_d.isCommission=true;_d.commName=o.commName||'커미션';_d.commGlb=o.commGlb||null;}
        if(o.equippedParts)_d.equippedParts=o.equippedParts;
        slots[i]=_d;}}catch(e){}}}

/* --- 복제 코드 (현재 base64. 다음 단계에서 AES 암호화로 교체) --- */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}

/* ===== 진짜 암호화: AES-256-GCM + PBKDF2(150k) ===== */
function _b64(buf){let s='';const b=new Uint8Array(buf);for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
function _unb64(str){const s=atob(str);const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;}
async function _deriveKey(pass,salt){const enc=new TextEncoder();
  const km=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function encryptCode(def,pass){
  const payload=JSON.stringify({t:'creator',skin:def.skin||0,top:def.top,bot:def.bot,xf:def.xf||null,decor:def.decor||null,deskColor:def.deskColor||null,deskItems:def.deskItems||null,deskGlb:def.deskGlb||null,deskScale:def.deskScale||null,customItems:def.customItems||null,isCommission:def.isCommission||false,commName:def.commName||null,commGlb:def.commGlb||null,face:def.face.toDataURL('image/png'),blink:def.blink.toDataURL('image/png')});
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(payload)));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCC1.'+_b64(blob.buffer);}
async function decryptCode(code,pass){
  if(!/^DCC1\./.test(code)) throw new Error('format');
  const blob=_unb64(code.slice(5).replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await _deriveKey(pass,salt);
  const ptBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  const o=JSON.parse(new TextDecoder().decode(ptBuf)); if(o.t!=='creator')throw new Error('type');
  const[f,b]=await Promise.all([loadImg(o.face),loadImg(o.blink)]);
  const fc=newCanvas();fc.getContext('2d').drawImage(f,0,0);const bc=newCanvas();bc.getContext('2d').drawImage(b,0,0);
  {const _d=charDef(o.skin||0,fc,bc,o.top,o.bot);if(o.xf)_d.xf=o.xf;if(o.decor)_d.decor=o.decor;if(o.deskColor)_d.deskColor=o.deskColor;if(o.deskItems)_d.deskItems=o.deskItems;if(o.deskGlb)_d.deskGlb=o.deskGlb;if(o.deskScale)_d.deskScale=o.deskScale;if(o.customItems)_d.customItems=o.customItems;
    if(o.isCommission){_d.isCommission=true;_d.commName=o.commName||'커미션';_d.commGlb=o.commGlb||null;}
    return _d;}}

/* ===== 풀 GLB 파일 암호화 (.dcc) ===== */
async function encryptBytes(buf,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,buf));
  const out=new Uint8Array(33+ct.length); out.set([0x44,0x43,0x47,0x31,0x00],0); out.set(salt,5); out.set(iv,21); out.set(ct,33);
  return out.buffer;}
async function decryptBytes(buf,pass){
  const b=new Uint8Array(buf);
  if(!(b[0]===0x44&&b[1]===0x43&&b[2]===0x47&&b[3]===0x31)) throw new Error('format');
  const salt=b.slice(5,21), iv=b.slice(21,33), ct=b.slice(33);
  const key=await _deriveKey(pass,salt);
  return crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);}
/* ===== 책상·아이템 GLB 코드 (DCK1) — 캐릭터처럼 복제 코드로 판매/추가 ===== */
async function encryptAssetCode(buf,pass,kind){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,buf));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCK1.'+kind+'.'+_b64(blob.buffer); }
async function decryptAssetCode(code,pass){
  const m=/^DCK1\.(desk|item)\.([\s\S]+)$/.exec((code||'').trim()); if(!m)throw new Error('format');
  const blob=_unb64(m[2].replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await _deriveKey(pass,salt);
  const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  return {kind:m[1], buf}; }
function wrapAsset(name,icon,glbBuf){ const nb=new TextEncoder().encode(JSON.stringify({name,icon:icon||''}));
  const out=new Uint8Array(4+nb.length+glbBuf.byteLength); new DataView(out.buffer).setUint32(0,nb.length);
  out.set(nb,4); out.set(new Uint8Array(glbBuf),4+nb.length); return out.buffer; }
function unwrapAsset(buf){ const dv=new DataView(buf); const len=dv.getUint32(0);
  let meta={name:'커스텀',icon:''};
  try{ meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,len))); }catch(_){}
  const glbBuf=buf.slice(4+len); return {name:meta.name||'커스텀', icon:meta.icon||'', glbBuf}; }
function parseGlbBytes(buf){ return new Promise((res,rej)=>{ try{ loader.parse(buf,'',g=>res(g.scene), e=>rej(e)); }catch(e){rej(e);} }); }

/* ===== 커미션 캐릭터 zip 코드 시스템 =====
   관리자가 zip(character.glb + face.png + blink.png)을 코드로 만들어 고객에게 전달.
   고객이 캐릭터 생성창의 [+ 코드 입력하기]로 받아서 책상 세팅 단계부터 진입.
   - 텍스처는 자동 512×512로 리사이즈
   - 한도 2MB (압축 풀린 zip 내부 합계)
   - 1~4단계 잠금 (피부/표정/감은눈/색상은 완성형이라 수정 불가)
*/
const MAX_COMMISSION_BYTES = 2 * 1024 * 1024;   // 2MB
const COMMISSION_TEX_SIZE = 512;
/* 이미지 Blob → 512×512 캔버스 → PNG 데이터 URL */
function resizeImgBlobTo(dataUrl, sz){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=sz; cv.height=sz;
      const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
      ctx.drawImage(im,0,0,sz,sz);
      res(cv.toDataURL('image/png'));
    };
    im.onerror=()=>rej(new Error('image load failed'));
    im.src=dataUrl;
  });
}
/* zip 파일에서 character.glb / face.png / blink.png 추출. PNG는 512로 리사이즈된 데이터 URL */
async function unpackCommissionZip(file){
  if(typeof JSZip==='undefined') throw new Error('JSZip 라이브러리가 로드되지 않았어요');
  if(file.size > MAX_COMMISSION_BYTES) throw new Error('zip 파일이 2MB를 넘어요');
  const z = await JSZip.loadAsync(file);
  // 파일 찾기 (대소문자 무시, 경로 무시)
  function find(name){
    const lower = name.toLowerCase();
    for(const path in z.files){
      const f=z.files[path]; if(f.dir) continue;
      const base = path.split('/').pop().toLowerCase();
      if(base === lower) return f;
    }
    return null;
  }
  const fGlb=find('character.glb'), fFace=find('face.png'), fBlink=find('blink.png');
  if(!fGlb) throw new Error('character.glb 가 zip에 없어요');
  if(!fFace) throw new Error('face.png 가 zip에 없어요');
  if(!fBlink) throw new Error('blink.png 가 zip에 없어요');
  const [glbBuf, faceBlob, blinkBlob] = await Promise.all([
    fGlb.async('arraybuffer'),
    fFace.async('blob'),
    fBlink.async('blob')
  ]);
  const [faceUrl, blinkUrl] = await Promise.all([
    new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(faceBlob);}),
    new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(blinkBlob);})
  ]);
  // 512로 자동 리사이즈
  const [face512, blink512] = await Promise.all([
    resizeImgBlobTo(faceUrl, COMMISSION_TEX_SIZE),
    resizeImgBlobTo(blinkUrl, COMMISSION_TEX_SIZE)
  ]);
  return { glbBuf, faceDataUrl: face512, blinkDataUrl: blink512 };
}
/* 커미션 페이로드 → 암호화 코드 (DCM1 포맷, 기존 DCC1과 구분) */
async function encryptCommission(payload, pass){
  if(!(window.crypto&&crypto.subtle)) throw new Error('crypto unsupported');
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ptBytes = new TextEncoder().encode(JSON.stringify(payload));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,ptBytes));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCM1.'+_b64(blob.buffer);
}
async function decryptCommission(code, pass){
  if(!/^DCM1\./.test(code)) throw new Error('format');
  const blob=_unb64(code.slice(5).replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await _deriveKey(pass,salt);
  const ptBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  return JSON.parse(new TextDecoder().decode(ptBuf));
}
/* 커스텀 아이템 레지스트리 (생성기 세션) */
let customItems={};
/* 코드로 추가한 책상·아이템 영구 저장 (모든 캐릭터 공통, localStorage). 각 최대 6개 */
const SAVED_DESK_KEY='tw.savedDesks', SAVED_ITEM_KEY='tw.savedItems';
const MAX_CUSTOM_ASSETS=6, MAX_GLB_BYTES=1024*1024;   // 1MB
let savedDesks=[], savedItems=[];   // [{id, name, icon, glb(base64)}]
function loadSavedAssets(){
  try{ savedDesks=JSON.parse(localStorage.getItem(SAVED_DESK_KEY)||'[]'); }catch(_){ savedDesks=[]; }
  try{ savedItems=JSON.parse(localStorage.getItem(SAVED_ITEM_KEY)||'[]'); }catch(_){ savedItems=[]; }
}
function persistSavedAssets(){
  try{ localStorage.setItem(SAVED_DESK_KEY,JSON.stringify(savedDesks)); }catch(_){ toast('저장 공간이 부족해요'); }
  try{ localStorage.setItem(SAVED_ITEM_KEY,JSON.stringify(savedItems)); }catch(_){}
}
loadSavedAssets();

/* ===== 캐릭터 꾸미기 파츠 (프리미엄) =====
   모든 캐릭터 공통으로 등록(관리자), 착용은 캐릭터별(def.equippedParts).
   이번 단계: 단순 부착 파츠(모자/안경/날개/왼손/오른손). 옷·헤어는 다음 단계.
*/
const SAVED_PARTS_KEY='tw.savedParts';
const MAX_PARTS_PER_CAT=12;
/* 카테고리 정의: 부착 본 + 라벨 + 폴백 아이콘 */
const PART_CATS = [
  {cat:'hat',     label:'모자',   bone:'head',  icon:'🎩'},
  {cat:'mask',    label:'탈',     bone:'head',  icon:'🎭'},
  {cat:'glasses', label:'안경',   bone:'head',  icon:'👓'},
  {cat:'top',     label:'상의',   bone:'spine', icon:'👕', cloth:'top'},
  {cat:'bottom',  label:'하의',   bone:'spine', icon:'👖', cloth:'bottom'},
  {cat:'onepiece',label:'한벌옷', bone:'spine', icon:'👗', cloth:'onepiece'},
  {cat:'wing',    label:'날개',   bone:'spine', icon:'🪽'},
  {cat:'handL',   label:'왼손',   bone:'handL', icon:'🤚'},
  {cat:'handR',   label:'오른손', bone:'handR', icon:'✋'},
];
/* 탈 부착 오프셋 — head 본 기준. 값 조정해서 얼굴 위치 맞춤 */
const MASK_Y_OFFSET = -1.95;   // 아래로(음수=내림). 클수록(절댓값) 더 아래
const MASK_Z_OFFSET = -0.3;    // 앞으로(양수=앞면 쪽). 0이면 head 본 중심
function partCatInfo(cat){ return PART_CATS.find(c=>c.cat===cat)||null; }
/* 파츠 엔트리 — 구버전(문자열 id) ↔ 신버전({id, xf}) 호환 헬퍼 */
function defaultPartXf(){ return {scale:1, pos:[0,0,0], rot:[0,0,0]}; }
function partEntryId(e){ return (e && typeof e==='object') ? e.id : e; }
function partEntryXf(e){ return (e && typeof e==='object' && e.xf) ? e.xf : defaultPartXf(); }
let savedParts=[];   // [{id, cat, name, icon, glb(base64)}]
function loadSavedParts(){
  try{ savedParts=JSON.parse(localStorage.getItem(SAVED_PARTS_KEY)||'[]'); }catch(_){ savedParts=[]; }
}
function persistSavedParts(){
  try{ localStorage.setItem(SAVED_PARTS_KEY,JSON.stringify(savedParts)); }catch(_){ toast('저장 공간이 부족해요'); }
}
function partsInCat(cat){ return savedParts.filter(p=>p.cat===cat); }
/* 파츠 GLB 파싱 캐시: id → THREE.Object3D(원본 씬) */
const partSceneCache = new Map();
async function getPartScene(rec){
  if(partSceneCache.has(rec.id)) return partSceneCache.get(rec.id);
  const scene = await parseGlbBytes(b64ToBuf(rec.glb));
  partSceneCache.set(rec.id, scene);
  return scene;
}
loadSavedParts();

/* ── 파츠 카탈로그 실시간 동기화 ──────────────────────────────────────────
   로컬(localStorage)에 저장된 savedParts와 별개로, Firebase catalog/parts를 구독해서
   "관리자가 이 앱을 배포한 뒤에도 새 파츠를 등록하면 이미 설치한 모든 사용자에게 자동으로 반영"되게 함.
   - 카탈로그에 있는 id는 항상 Firebase 최신본으로 덮어씀(관리자가 나중에 이름/아이콘 등을 고쳐도 반영되게)
   - 카탈로그에 없는 로컬 항목(오프라인 캐시, 혹은 예전 방식으로 로컬에만 등록됐던 파츠)은 그대로 유지
   - 구독은 실시간(onValue)이라 앱을 껐다 켤 필요 없이, 켜져 있는 동안에도 자동으로 새 파츠가 뜸 */
function mergeCatalogIntoSavedParts(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>({ id, ...catalogObj[id] }));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const localOnly = savedParts.filter(p=>!catalogIds.has(p.id));
  savedParts = [...catalogList, ...localOnly];
  persistSavedParts();   // 오프라인에서도 마지막으로 받은 카탈로그를 쓸 수 있게 캐시
  if(typeof renderWardrobe==='function') renderWardrobe();
}
function subscribeCatalogParts(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCatalogParts) return;
  window.firebaseAPI.subscribeCatalogParts(mergeCatalogIntoSavedParts);
}
if(window.firebaseAPI) subscribeCatalogParts();
else window.addEventListener('firebase-ready', subscribeCatalogParts, { once:true });
function registerCustomItem(id,name,glbB64,template,icon){ customItems[id]={id,name,glb:glbB64,custom:true,icon:icon||'',
  build:()=>{const c=template.clone(true);c.traverse(n=>{if(n.isMesh)n.castShadow=true;});return c;}}; }
/* 현재 활성 책상의 저장 ID (기본 책상이면 null) — 카드 on 표시용 */
let activeCustomDeskId=null;
/* 저장된 모든 아이템 코드를 customItems에 등록 (생성기 진입 시 호출) */
async function loadSavedItemsIntoSession(){
  for(const rec of savedItems){
    if(customItems[rec.id]) continue;
    try{ const buf=b64ToBuf(rec.glb); const scene=await parseGlbBytes(buf);
      registerCustomItem(rec.id, rec.name, rec.glb, scene, rec.icon||'');
    }catch(_){}
  }
}
function allDeskItems(){ return DESK_ITEMS.concat(Object.values(customItems)); }
function deskItemDef(id){ return allDeskItems().find(d=>d.id===id)||null; }
/* 커스텀 책상: 기본 책상 메쉬를 숨기고 커스텀 GLB로 교체(앵커는 그대로) */
function normalizeDeskObj(obj){ obj.scale.set(1,1,1); obj.position.set(0,0,0); obj.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(obj), sz=box.getSize(new THREE.Vector3());
  obj.scale.setScalar(1.5/Math.max(sz.x,sz.z,0.001)); obj.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(obj); const c=box.getCenter(new THREE.Vector3());
  obj.position.x+=(0-c.x); obj.position.z+=(0.6-c.z); 
  // 피벗은 바닥, 메쉬만 0.15만큼 올리기 (수치 조절 가능)
  obj.position.y+=(0-box.min.y) + 0.15; 
  return obj; }
function swapDeskVisual(deskGroup,template){ if(!deskGroup)return;
  const prev=deskGroup.getObjectByName('customDesk'); if(prev)deskGroup.remove(prev);
  const defaults=deskGroup.children.filter(ch=>ch.name!=='deskAnchor'&&ch.name!=='customDesk');
  if(template){ const obj=template.clone(true); obj.name='customDesk';
    const mats=[]; obj.traverse(n=>{ if(n.isMesh){ n.castShadow=true; if(n.material){ n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone(); (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>mats.push(m)); } } });
    deskGroup.userData.customMats=mats;
    normalizeDeskObj(obj); deskGroup.add(obj); defaults.forEach(m=>m.visible=false);
  } else { deskGroup.userData.customMats=null; defaults.forEach(m=>m.visible=true); } }
function applyDeskColorToCustom(deskGroup,color){ const mats=deskGroup&&deskGroup.userData&&deskGroup.userData.customMats; if(mats)mats.forEach(m=>{ if(m.color)m.color.set(color); }); }
function setDeskScale(deskGroup,scale){ if(deskGroup) deskGroup.scale.setScalar(scale||1); }   // 기본·커스텀 책상 모두 그룹 전체 스케일
let cDeskTemplate=null, cDeskGlbB64=null;   // 생성기 세션의 커스텀 책상
function downloadBlob(buf,filename){const bl=new Blob([buf],{type:'application/octet-stream'});const u=URL.createObjectURL(bl);
  const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function loadEncryptedGlbAsSeat(buf,name){
  if(document.getElementById('launcher').classList.contains('on')){
    [...seats].forEach(s=>scene.remove(s.group));seats.length=0;
    slots.forEach((def,i)=>{if(def){const st=createSeat();applyCharToSeat(st,def);st.slot=i;}});
    document.getElementById('launcher').classList.remove('on');}
  const seat=createSeat(); loadCharGLB(buf,name,seat); selectSeat(seat); renderSeatTabs(); layoutSeats();}

/* --- 불러오기 (코드 + 암호) --- */
function openCodeModal(){document.getElementById('codeText').value='';document.getElementById('codePass').value='';document.getElementById('codeOverlay').classList.add('on');}
document.getElementById('codeCancel').onclick=()=>document.getElementById('codeOverlay').classList.remove('on');
document.getElementById('codeOk').onclick=async()=>{
  const v=document.getElementById('codeText').value.trim();const p=document.getElementById('codePass').value;
  if(!v){toast('코드를 입력해 주세요');return;} if(!p){toast('암호를 입력해 주세요');return;}
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  let def=null;try{def=await decryptCode(v,p);}catch(e){def=null;}
  if(!def){toast('암호가 틀렸거나 코드가 손상됐어요');return;}
  const target=slots[curSlot]?slots.findIndex(s=>!s):curSlot;if(target<0){toast('캐릭터가 모두 찼습니다');return;}
  slots[target]=def;curSlot=target;saveSlots();document.getElementById('codeOverlay').classList.remove('on');renderLauncher();toast('불러왔어요');};

/* --- 내보내기 (암호 정하고 코드 생성) --- */
let exportDef=null;
document.getElementById('lcExport').onclick=()=>{closeGearMenu();exportDef=slots[curSlot];if(!exportDef)return;
  document.getElementById('exportPass').value='';document.getElementById('exportText').value='';document.getElementById('exportOverlay').classList.add('on');};
document.getElementById('exportGen').onclick=async()=>{const p=document.getElementById('exportPass').value;
  if(!p){toast('암호를 정해주세요');return;} if(!exportDef)return;
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  try{const code=await encryptCode(exportDef,p);document.getElementById('exportText').value=code;toast('코드가 생성됐어요');}
  catch(e){toast('암호화 실패');}};
document.getElementById('exportCopy').onclick=async()=>{const v=document.getElementById('exportText').value;if(!v){toast('먼저 코드를 생성하세요');return;}
  try{await navigator.clipboard.writeText(v);toast('복사했어요');}catch(e){document.getElementById('exportText').select();toast('Ctrl+C로 복사해주세요');}};
document.getElementById('exportCancel').onclick=()=>document.getElementById('exportOverlay').classList.remove('on');

/* --- 풀 GLB: 암호화 / 불러오기 --- */
document.getElementById('lcGlbEnc').onclick=()=>{document.getElementById('glbEncFile').value='';document.getElementById('glbEncPass').value='';document.getElementById('glbEncOverlay').classList.add('on');};
document.getElementById('glbEncCancel').onclick=()=>document.getElementById('glbEncOverlay').classList.remove('on');
document.getElementById('glbEncGo').onclick=async()=>{const fi=document.getElementById('glbEncFile').files[0];const p=document.getElementById('glbEncPass').value;
  if(!fi){toast('GLB 파일을 선택하세요');return;} if(!p){toast('비밀번호를 입력하세요');return;}
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  try{const buf=await fi.arrayBuffer();const enc=await encryptBytes(buf,p);downloadBlob(enc,fi.name.replace(/\.glb$/i,'')+'.dcc');
    toast('암호화 파일(.dcc)을 저장했어요');document.getElementById('glbEncOverlay').classList.remove('on');}
  catch(e){toast('암호화 실패');}};
document.getElementById('lcGlbLoad').onclick=()=>{document.getElementById('glbLoadFile').value='';document.getElementById('glbLoadPass').value='';document.getElementById('glbLoadOverlay').classList.add('on');};
document.getElementById('glbLoadCancel').onclick=()=>document.getElementById('glbLoadOverlay').classList.remove('on');
document.getElementById('glbLoadGo').onclick=async()=>{const fi=document.getElementById('glbLoadFile').files[0];const p=document.getElementById('glbLoadPass').value;
  if(!fi){toast('파일을 선택하세요');return;}
  const nm=fi.name.toLowerCase();
  try{const buf=await fi.arrayBuffer();let glbBuf=buf;
    if(nm.endsWith('.dcc')){ if(!p){toast('비밀번호를 입력하세요');return;}
      if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;} glbBuf=await decryptBytes(buf,p); }
    document.getElementById('glbLoadOverlay').classList.remove('on');
    loadEncryptedGlbAsSeat(glbBuf,fi.name.replace(/\.dcc$/i,'')+'.glb');toast('불러왔어요');}
  catch(e){toast('비밀번호가 틀렸거나 파일이 손상됐어요');}};

/* --- toast --- */
let toastT=null;function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),1900);}

/* ============================================================ ANIM */
const STATES={idle:{label:'평소',color:'#9dba8a'},focus:{label:'활동중',color:'#e0a050'},pet:{label:'쓰다듬',color:'#e89b9b'},sleep:{label:'잠듦',color:'#7fa0c4'},shaking:{label:'흔들림',color:'#d98e73'},dizzy:{label:'어지러움',color:'#c9a560'}};
function targetFor(s){switch(s){
  case 'focus':return{leanX:0.08,turnY:0,slumpY:0,breSpd:2.6,breAmp:0.018,eyeOpen:1,arm:1}; // 활동중 숙임도 0.12 -> 0.08로 줄임, 타이핑 사이클 살짝 느리게 (3.2→2.6)
  case 'pet':return{leanX:-0.03,turnY:0,slumpY:-0.03,breSpd:2.6,breAmp:0.025,eyeOpen:0.2,arm:0};
  case 'shaking':return{leanX:0,turnY:0,slumpY:0.02,breSpd:5,breAmp:0.04,eyeOpen:0.5,arm:0};   // 들려서 흔들리는 중 (rotation.z는 frame에서 velocity 기반)
  case 'dizzy':  return{leanX:0.35,turnY:0,slumpY:-0.30,breSpd:1.2,breAmp:0.025,eyeOpen:0.10,arm:0}; // 허리 살짝 세움, 머리는 DIZZY_HEAD_DROOP로 별도 숙임
// breAmp(호흡 진폭)를 0.045에서 0.015로 대폭 줄여서 얌전하게 숨 쉬도록 변경
case 'sleep':return{leanX:0.1,turnY:0.04,slumpY:-0.03,breSpd:0.9,breAmp:0.015,eyeOpen:0,arm:0};  default:return{leanX:0,turnY:0,slumpY:0,breSpd:2,breAmp:0.025,eyeOpen:1,arm:0};}}
const lerp=(a,b,t)=>a+(b-a)*t;
const SPINE_AXIS=1, HEAD_AXIS=1, HAND_AXIS=1;   // 움직임 반대면 부호 뒤집기
// ★ 이 숫자가 0.0이면 팔이 안 올라가요! 0.4 나 -0.4 등으로 바꿔주셔야 적용됩니다.
const HAND_REST   = -1.0;         // 평소 손 기본각(아주 조금 올림). 더 올리려면 0쪽(예 -0.7), 내리려면 −쪽(예 -1.0)
const FOCUS_ARM_LIFT = -0.1;      // ★ 타이핑할 때 책상 위로 팔을 들어 올리는 각도 
                                  // (만약 팔이 척추 쪽으로 더 말려 들어간다면 +0.8 처럼 부호를 반대로 바꿔보세요!)
const HAND_TAP_AMP = 0.18;        // 타이핑(p.arm) 시 손 까딱 폭
const CLICK_TAP_DUR = 260;        // 마우스 클릭 반응 지속시간(ms) — 오른손 까딱 한 번의 길이
const CLICK_TAP_AMP = 0.35;       // 마우스 클릭 반응 오른손 까딱 폭(라디안)
const CLICK_LIFT_AMP = -0.15;     // 마우스 클릭 반응 시 오른손을 살짝 들어올리는 오프셋(책상에 안 박히게). 음수=위로
const LEG_SWING    = 0.06;        // 다리 idle 스윙 폭(라디안). 0이면 정지
const DIZZY_ARM_SPREAD = -0.5;  // 어지러움(엎드림) 때 팔을 양옆으로 벌리는 각도(Z축). 부호로 방향
const DIZZY_ARM_FORWARD = -0.1; // 어지러움 때 팔을 앞으로 뻗어 책상 위에 얹는 각도(X축). 음수=책상 위로 올라옴
const DIZZY_HEAD_DROOP = 0.3;   // 어지러움 때 머리를 앞으로 숙이는 각도(X축). spine leanX와 합산됨
const SHAKE_ARM_DROOP = 0.6;    // 흔들기 중 팔이 축 처져 내려오는 각도(X축)
function boneSide(n){
  if(/(^|[_.\s-])l$|left|handl$|arml$/.test(n))return 'l';     // Hand_L, Hand.L, HandL, ...Left
  if(/(^|[_.\s-])r$|right|handr$|armr$/.test(n))return 'r';     // Hand_R, Hand.R, HandR, ...Right
  return null; }
const _be=new THREE.Euler(), _bq=new THREE.Quaternion();
const _hp=new THREE.Vector3(), _hq=new THREE.Quaternion(), _hpq=new THREE.Quaternion();
function setBone(bone,rest,x,y,z){ if(!bone||!rest)return; _be.set(x,y,z,'XYZ'); _bq.setFromEuler(_be); bone.quaternion.copy(rest).multiply(_bq); }
function animateRig(seat,now,state){
  const b=seat.bones, r=seat.boneRest, p=seat.pose, t=now/1000;
  // dizzy 진입 시 1회: head 본의 현재 월드 높이를 읽어 얼굴이 책상에 닿도록 slumpY 보정값 계산
  // (커미션마다 spine/head 본 위치가 달라 고정 slumpY로는 얼굴 도달 위치가 제각각이라 자동 보정)
  // dizzy(어지러움): 추가 슬럼프로 얼굴이 책상에 더 가까이 박히도록 (측정 불안정으로 자동 보정 폐기, 고정값 사용)
  // 값이 더 음수일수록 더 깊이 박힘. 시각상 부족/과하면 이 상수만 조정.
  const DIZZY_EXTRA_SLUMP = 0;       // dizzy 시 상체 추가 슬럼프. 0이면 자세 그대로(가라앉지 않음). 더 박히려면 -0.1 등
  const _dizzyTarget = (state==='dizzy') ? DIZZY_EXTRA_SLUMP : 0;
  const _focusLock = (state==='focus');   // 빡일 중(집중): spine·head를 둥실거리지 않게 딱 고정
  // 정신차리기: 드래그 중 흔들다 멈춘 뒤 300~1300ms 동안(≈1초) 고개 좌우 흔들흔들 + blink
  const _stillMs = (drag && drag.seat===seat && drag.lastMoveT) ? (now - drag.lastMoveT) : -1;
  const isRecovering = (state==='shaking') && drag && drag.seat===seat
    && drag.dizzy > 30 && _stillMs > 300 && _stillMs < 1300;
  if(b.spine){ const breath = _focusLock ? 0 : Math.sin(seat.breathePhase)*(p.breAmp*1.6);
    setBone(b.spine, r.spine, SPINE_AXIS*(breath + p.leanX*0.8), 0, 0); }
  if(b.head){
    let bob, look, droop, roll;
    if(seat.pinned){
      // 액자 고정: 머리가 마우스 포인터 따라감
      _hp.setFromMatrixPosition(seat.bodyWrap.matrixWorld);
      _hp.project(camera);   // 캐릭터 화면 NDC
      const dx = mouseNdcX - _hp.x, dy = mouseNdcY - _hp.y;
      look  = Math.max(-0.5, Math.min(0.5, dx * 1.0));    // 좌우(yaw)
      droop = Math.max(-0.25, Math.min(0.3, -dy * 0.6));  // 위아래(pitch, HEAD_AXIS와 결합)
      bob = 0; roll = 0;
    } else {
      bob  = (_focusLock||state==='dizzy') ? 0 : Math.sin(t*1.3+seat.headPhase)*0.05;
      look = isRecovering ? Math.sin(t*24)*0.45
           // 어지러움: 서로 다른 속도를 섞어 불규칙하고 무겁게 비틀거리는 좌우 움직임
           : (state==='dizzy') ? Math.sin(t*2.0)*0.3 + Math.sin(t*5.3)*0.1 
           : _focusLock ? 0
           : Math.sin(t*0.3+seat.headPhase)*0.10;
      droop= isRecovering ? 0.40
           // 어지러움: 기본으로 푹 숙인 상태에서, 불규칙하게 고개가 앞으로 더 꺾이는 움직임
           : (state==='dizzy') ? DIZZY_HEAD_DROOP + Math.sin(t*1.7)*0.2 + Math.cos(t*4.1)*0.15 
           : (state==='sleep')?0.35:(state==='focus'?0.12:0);
      // 어지러움: 좌우/상하 움직임과 타이밍이 어긋나는 갸우뚱(Z축)을 추가해 균형을 잃은 느낌 강조
      roll = (state==='dizzy') ? Math.sin(t*2.2)*0.25 : 0;
    }
    setBone(b.head, r.head, HEAD_AXIS*(bob+droop), look, roll);
  }

  
  if(b.head && seat.headAnchor && seat.equipped && (seat.equipped.hair||seat.equipped.accessory)){
    b.head.updateWorldMatrix(true,false); seat.bodyWrap.updateWorldMatrix(true,false);
    _hp.setFromMatrixPosition(b.head.matrixWorld); seat.headAnchor.position.copy(seat.bodyWrap.worldToLocal(_hp));
    _hq.setFromRotationMatrix(b.head.matrixWorld); seat.bodyWrap.getWorldQuaternion(_hpq);
    seat.headAnchor.quaternion.copy(_hpq.invert().multiply(_hq));
  }
  
  const tap=p.arm;

  // 표준 리그 통합: 커미션 자동보정(armRestRot) 제거 — 손은 bind 자세 기준
  const baseArmRot = HAND_REST;
  const armSpread  = (state==='dizzy') ? DIZZY_ARM_SPREAD : 0;    // dizzy: 팔 양옆 펼침(Y축)
  // 팔 X축 추가 회전: dizzy면 책상 위로, shaking이면 축 처짐
  const armForward = (state==='dizzy')   ? DIZZY_ARM_FORWARD
                   : (state==='shaking') ? SHAKE_ARM_DROOP
                   : 0;

  // 빡일중(grind)일 때는 타이핑 속도를 2배(20)로, 평소엔 기본 속도(10)로 설정합니다.
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatus : null);
  const tapSpeed = (us === 'grind') ? 20 : 10;
  
  // ★ 추가: 빡일중일 때는 허리를 숙인 만큼 팔을 위로 더 들어 올립니다.
  const extraLift = (us === 'grind') ? -0.2 : 0; 

  // 손: 평소 기본각 + 타이핑 시 들어 올리는 각도(FOCUS_ARM_LIFT) + 까딱거리는 타이핑 모션을 결합합니다.
  // X축=앞뒤 굽힘, Y축=비틀기(시각 변화 거의 없음), Z축=양옆 벌림 — armSpread는 Z로
  const liftAngle = (FOCUS_ARM_LIFT + extraLift) * tap;
  // 마우스 클릭 반응: 오른손만 짧게 까딱(타이핑 여부와 무관하게 독립적으로 더해짐), 왼손은 그동안 정지, 살짝 들어올려 책상에 안 박히게.
  // seat.clickTapAt(performance.now() 기준시각)으로부터 CLICK_TAP_DUR(ms) 동안 0→1→0 사인 펄스 한 번.
  let clickTapVal = 0;
  const _elapsed = seat.clickTapAt ? (performance.now() - seat.clickTapAt) : Infinity;
  if(_elapsed < CLICK_TAP_DUR){
    clickTapVal = Math.sin((_elapsed/CLICK_TAP_DUR) * Math.PI);   // 0→1→0 부드러운 펄스
  }
  const clicking = clickTapVal > 0.001;
  const leftTapAmp = clicking ? 0 : HAND_TAP_AMP*tap;   // 클릭 반응 중엔 왼손 까딱 정지
  if(b.handL) setBone(b.handL, r.handL, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed))*leftTapAmp,    0,  armSpread);
  if(b.handR) setBone(b.handR, r.handR, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed+1.6))*HAND_TAP_AMP*tap + HAND_AXIS*CLICK_TAP_AMP*clickTapVal + HAND_AXIS*CLICK_LIFT_AMP*clickTapVal, 0, -armSpread);


  // 다리: spine 직속으로 매달려 좌우 교대 미세 스윙(로컬 X)
  const ls = Math.sin(t*1.1 + seat.swayPhase)*LEG_SWING;
  if(b.legL) setBone(b.legL, r.legL,  ls, 0, 0);
  if(b.legR) setBone(b.legR, r.legR, -ls, 0, 0);
}

function scheduleBlinks(bl,now){ if(now<bl.nextAt)return;
  if(bl.singles>0){bl.pulses.push({start:now,dur:170});bl.singles--;bl.nextAt=now+1800+Math.random()*1900;}
  else{bl.pulses.push({start:now,dur:160});bl.pulses.push({start:now+280,dur:160});bl.pulses.push({start:now+560,dur:160});
    bl.singles=2+Math.floor(Math.random()*2);bl.nextAt=now+720+2400+Math.random()*1800;}}
function eyeClose(bl,now){let c=0;for(let i=bl.pulses.length-1;i>=0;i--){const p=bl.pulses[i],e=now-p.start;
  if(e<0)continue;if(e>p.dur){bl.pulses.splice(i,1);continue;}c=Math.max(c,Math.sin(e/p.dur*Math.PI));}return c;}
function setClip(seat,state){ if(!seat.mixer)return; const a=seat.actions[state]||seat.actions.idle; if(!a||a===seat.current)return;
  if(seat.current)seat.current.fadeOut(0.3); a.reset().fadeIn(0.3).play(); seat.current=a;}

let prev=performance.now();
function frame(now){
  const dt=Math.min((now-prev)/1000,0.05);prev=now;
  seats.forEach(seat=>{
    const state=seatState(seat,now);
    if(seat.isMe && Presence.active()) Presence.setState(seat.pinned ? 'idle' : state);   // 액자 고정은 상대에겐 평상시로
    if(seat.remote && seat._lastTab!==seat.remoteState){ seat._lastTab=seat.remoteState; renderSeatTabs(); }  // 탭 상태 이모지 갱신
    const tg=targetFor(state),k=1-Math.pow(seat.smooth,dt);
    /* 활동 상태(userStatus): 본인=userStatus, 친구=remoteUserStatus */
    const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatus : null);
    /* 🔥 빡일중: idle뿐 아니라 focus(타이핑) 상태도 더 격렬하게.
       idle은 spine 숙임 유지 + 호흡 진폭 거의 0 (안 흔들림). focus는 타이핑 빠르게. */
    if(us==='grind'){
      if(state==='idle'){
        tg.slumpY=-0.10; tg.breSpd=2.0; tg.breAmp=0.004; tg.leanX=0.09;
        // tg.arm = 1; 을 지워서 평소(idle)에는 가만히 모니터를 응시하도록 되돌립니다.
      } else if(state==='focus'){
        tg.slumpY=-0.10; tg.breSpd=7.0; 
        tg.leanX=0.25;   // ★ 타이핑(focus)을 할 때 허리(spine)를 앞으로 푹 숙이게 만듭니다. (더 깊이 숙이려면 0.35 등으로 올려보세요!)
      }
    }
    for(const kk in seat.pose) seat.pose[kk]=lerp(seat.pose[kk],tg[kk],k);
    /* slide to slot — group은 슬롯 위치만, rig는 흔들기 중이 아니면 항상 원점으로 복귀 */
    if(seat.inPreview){ seat.group.position.set(0,0,0); seat.rig.position.set(0,0,0); }
    else {
      const kSlide = Math.min(1, dt * 15);   // 슬롯/좌석 복귀 속도. 프레임당 비율(~24%@60fps). 약 0.4초 수렴
      // group.x는 슬롯 이동 중이 아닐 때만 lerp
      if(!(drag&&drag.seat===seat&&drag.moved&&drag.mode==='slot')){
        seat.group.position.x = lerp(seat.group.position.x, seat.targetX, kSlide);
      }
      // rig.x/z는 shake 중이 아니면 항상 정상 위치로 lerp (rig 기본은 x=0, z=CHAR_Z)
      // 정상 상태에선 lerp(현재, 정상, k)가 현재≈정상이라 사실상 비용 없음
      if(!seat.beingShaken && !seat.pinned){
        seat.rig.position.x = lerp(seat.rig.position.x, 0, kSlide);
        seat.rig.position.z = lerp(seat.rig.position.z, CHAR_Z, kSlide);
      }
    }
    /* rig transforms */
    seat.swayPhase+=dt*0.8;
    /* idle 좌우 미세 sway — 빡일중일 땐 진폭을 0.02→0.005로 거의 제거 (집중 자세 고정 느낌) */
    const _swayAmp = (us==='grind') ? 0.005 : 0.02;
    if(state==='shaking' && drag && drag.seat===seat){
      // 흔들기 중: 마우스 가로 속도에 따라 캐릭터를 좌우로 기울임 (±0.55rad 한도)
      const tilt = Math.max(-0.55, Math.min(0.55, -drag.velX * 0.06));
      seat.rig.rotation.z = lerp(seat.rig.rotation.z, tilt, 0.35);
    } else if(state==='idle'){
      seat.rig.rotation.z = Math.sin(seat.swayPhase)*_swayAmp;
    } else {
      seat.rig.rotation.z = lerp(seat.rig.rotation.z, 0, k);
    }
    seat.rig.rotation.y=seat.pose.turnY;   // 기본 -0.28은 모델에 들어가 있음(센터링 정확)
    const lift=(drag&&drag.seat===seat&&drag.moved&&drag.mode==='slot')?0.12:0;
    if(seat.beingShaken){
      /* shake 중 — pointermove가 rig.position을 직접 제어, 덮어쓰지 않음 */
    } else if(seat.pinned){
      /* 액자 고정 — 그 자리 그대로, 위치 lerp 안 함 */
    } else if(now-seat.petStart<PET_MS){const e=now-seat.petStart;seat.rig.position.y=Math.sin(e*0.016)*0.07*Math.exp(-e*0.0026)+lift;}
    else seat.rig.position.y=lerp(seat.rig.position.y,lift,k);
    seat.breathePhase+=dt*seat.pose.breSpd;

const clipped=!seat.isPlaceholder&&seat.mixer;
    const rigged=!seat.isPlaceholder&&!seat.mixer&&seat.hasRig;
    if(clipped){
      seat.rig.rotation.x=lerp(seat.rig.rotation.x,0,k); 
      seat.bodyWrap.scale.set(seat.userScale, seat.userScale, seat.userScale); // [수정] 강제 1,1,1 초기화 방지
      seat.bodyWrap.position.y=0;
      setClip(seat,state); seat.mixer.update(dt);
    } else if(rigged){
      seat.rig.rotation.x=lerp(seat.rig.rotation.x,0,k); 
      seat.bodyWrap.scale.set(seat.userScale, seat.userScale, seat.userScale); // [수정] 강제 1,1,1 초기화 방지
      seat.bodyWrap.position.y=0;
      animateRig(seat,now,state);
    } else {
      seat.rig.rotation.x=seat.pose.leanX;
      const breathe=1+Math.sin(seat.breathePhase)*seat.pose.breAmp;
      // [수정] 기본 숨쉬기 애니메이션에 userScale을 곱해서 크기 유지
      seat.bodyWrap.scale.set(
        (1/Math.sqrt(breathe)) * seat.userScale, 
        breathe * seat.userScale, 
        (1/Math.sqrt(breathe)) * seat.userScale
      );
      // dizzy면 추가 슬럼프(고정값)로 얼굴을 더 내림. 부드럽게 수렴.
      seat._dizzyAdjCur = (seat._dizzyAdjCur==null) ? _dizzyTarget : lerp(seat._dizzyAdjCur, _dizzyTarget, k);
      seat.bodyWrap.position.y=seat.pose.slumpY + seat._dizzyAdjCur;
    }
    /* blink */
    scheduleBlinks(seat.blink,now); const ca=eyeClose(seat.blink,now);
    if(seat.isPlaceholder){
      const ey=Math.max(0.06,seat.pose.eyeOpen*(1-ca*0.95));
      seat.placeholder.eyeL.scale.y=ey; seat.placeholder.eyeR.scale.y=ey;
      if(seat.pose.arm>0.02){seat.placeholder.armL.position.y=0.10+Math.abs(Math.sin(seat.breathePhase*4.5))*0.05*seat.pose.arm;
        seat.placeholder.armR.position.y=0.10+Math.abs(Math.sin(seat.breathePhase*4.5+1.6))*0.05*seat.pose.arm;}
      else{seat.placeholder.armL.position.y=lerp(seat.placeholder.armL.position.y,0.10,k);seat.placeholder.armR.position.y=lerp(seat.placeholder.armR.position.y,0.10,k);}
    } else if(seat.faceMat&&seat.blinkTex){
      // blink는 "지금 빠르게 흔드는 중"일 때만 — lastFastT 기준 (느린 드래그는 lastFastT가 안 찍힘)
      // 정신차리기: 빠르게 흔든 뒤(dizzy>30) 멈춘 지 300~1300ms — 고개 좌우 흔들며 다시 눈 감음
      // ⚠ now는 rAF 타임스탬프, lastFastT/lastMoveT는 performance.now() — 시계 캡처 시점이 달라
      //    합쳐진 pointermove가 rAF 직전에 찍히면 (now - lastFastT)가 잠깐 음수가 됨 → 0으로 클램프
      const _moveAgo = drag && drag.seat===seat && drag.lastMoveT ? Math.max(0, now - drag.lastMoveT) : -1;
      const _fastAgo = drag && drag.seat===seat && drag.lastFastT ? Math.max(0, now - drag.lastFastT) : -1;
      const recentlyFast = _fastAgo >= 0 && _fastAgo < 220;   // 220ms 안에 빠른 흔들기가 있었으면 (반전 구간 흔들림 보정)
      const isRecovering = (state==='shaking') && drag && drag.seat===seat
        && drag.dizzy > 30 && _moveAgo > 300 && _moveAgo < 1300;
      const shakingHard = (state==='shaking') && recentlyFast && drag && drag.seat===seat;
      const wantClosed=(state==='sleep')||(state==='pet')||(state==='dizzy')||shakingHard||isRecovering||(ca>0.5);
      if(wantClosed!==seat.blink.closed){seat.blink.closed=wantClosed;setFaceMap(seat.faceMat, wantClosed?seat.blinkTex:seat.faceMapOrig);}
    }
    if(state==='sleep' && us!=='away' && now-(seat._lastZ||0)>900){seat._lastZ=now;spawnFloater('Z','#9fb4d0',seat);}
    if(state==='dizzy' && now-(seat._lastDizzy||0)>520){seat._lastDizzy=now;spawnFloater('💫','#c9a560',seat);}

    /* 활동 상태 시각화 — 책상 위 이모지(모두), 머리 위 텍스트 말풍선(모두), 영혼 투명도(자리비움) */
    const _conf = us ? USER_STATUSES[us] : null;
    setSeatDeskEmoji(seat,  _conf ? _conf.emo   : null);
    setSeatHeadBubble(seat, _conf ? _conf.label : null);
    setSeatOpacity(seat, (_conf && _conf.opacity!=null) ? _conf.opacity : 1);
  });

  /* selected ring follows selected seat */
// if(selected){selRing.position.x=lerp(selRing.position.x,selected.group.position.x,1-Math.pow(0.001,dt));selRing.visible=true;}
  /* state bar shows selected seat */
  if(selected){const st=seatState(selected,now);const sc=STATES[st]||STATES.idle;dot.style.background=sc.color;stateLabel.textContent=sc.label;}

  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.userData.life+=dt;const p=f.userData.life/f.userData.dur;
    f.position.y+=dt*0.6;f.position.x+=f.userData.vx*dt;f.material.opacity=Math.max(0,1-p);f.scale.setScalar(0.3*(1+p*0.4));
    if(p>=1){scene.remove(f);floaters.splice(i,1);}}

  if(desktopMode){ renderer.clear(); }   // 투명 클리어 강제 — 프레임 사이 흰 잔상 방지
  renderer.render(scene,camera);
  if(decorSeat&&decorSeat.inPreview&&pRenderer) pRenderer.render(pScene,pCam);
  updateMyStatusChipPosition();   // 본인 상태 칩 위치를 자기 좌석 발 밑에 맞춤
  requestAnimationFrame(frame);
}

/* ============================================================ 데스크탑(Electron) 모드 */
const desktopMode = !!window.companion || /[?&]desktop=1/.test(location.search);
/* 포커싱 어플 게이트 — true면 자동 idle/focus 판정을 sleep으로 강제(=잠듦).
   등록된 앱이 하나도 없으면 항상 true, 등록된 앱이 있으면 "그 앱이 지금 활성 상태"일 때만 false. */
let focusGateSleep = true;
function _applyActiveAppState(state){
  if(!state) return;
  focusGateSleep = state.hasAnyRegistered ? !state.isFocusedAppRegistered : true;
}
function applyDesktopRunClass(){ if(!desktopMode) return;
  const launcherOn = document.getElementById('launcher').classList.contains('on');
  const config = launcherOn || creatorOpen;
  const runOverlay = appMode==='run' && !config;
  document.body.classList.toggle('runmode', runOverlay);
  document.body.classList.toggle('config', config);   // 런처/생성기 열림 여부 — CSS에서 #scene 숨김에 사용
  if(typeof floor!=='undefined') floor.visible = !runOverlay;        // 투명 오버레이일 땐 바닥 숨김(데스크톱 비침)
  // 화면 종류에 따라 창 크기가 달라야 함: 생성기는 넓게, 런처는 카드 크기, 실행은 전체화면
  const mode = creatorOpen ? 'creator' : (launcherOn ? 'launcher' : 'run');
  if(window.companion&&companion.setConfigMode) companion.setConfigMode(config, mode);
}
if(desktopMode){
  document.body.classList.add('desktop');
  try{ renderer.setClearColor(0x000000,0); }catch(e){}
  // 시스템 전체 유휴 시간으로 활동 상태 판정 (창에 포커스 없어도 동작) — 현재 미사용(no-op)
  if(window.companion&&companion.onIdle){ companion.onIdle(sec=>{ lastActivity=performance.now()-Math.max(0,sec)*1000; }); }
  // 활성 프로세스 상태 실시간 구독 (500ms 폴링 기반) — 포커싱 어플 게이트 갱신
  if(window.companion&&companion.onActiveAppState){ companion.onActiveAppState(_applyActiveAppState); }
  // ---- 자동 업데이트 상태 알림 ----
  // 다운로드 완료('downloaded')되면 재시작 버튼이 달린 알림을 계속 띄워둠(사용자가 직접 확인하고 눌러야 설치됨).
  // 그 외 상태(checking/available/downloading/none)는 조용히 무시 — 매번 토스트 띄우면 방해될 수 있어서
  // "설치 준비 완료"만 눈에 띄게 알림.
  if(window.companion&&companion.onUpdateStatus){
    companion.onUpdateStatus(({status, version})=>{
      if(status==='downloaded') showUpdateReadyBanner(version);
    });
  }
  function showUpdateReadyBanner(version){
    if(document.getElementById('updateReadyBanner')) return;   // 중복 방지
    const b=document.createElement('div');
    b.id='updateReadyBanner';
    b.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;'
      +'background:var(--win-face, #d4d0c8);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);'
      +'box-shadow:2px 2px 0 rgba(0,0,0,.3);padding:8px 10px;display:flex;align-items:center;gap:8px;'
      +'font-size:12px;color:#222;-webkit-app-region:no-drag;';
    b.innerHTML='<span>🔄 새 버전'+(version?(' v'+version):'')+'이 준비됐어요</span>'
      +'<button id="updateReadyBtn" style="padding:4px 8px;font-weight:bold;cursor:pointer;">지금 재시작</button>'
      +'<button id="updateLaterBtn" style="padding:4px 8px;cursor:pointer;">나중에</button>';
    document.body.appendChild(b);
    document.getElementById('updateReadyBtn').onclick=()=>{ if(window.companion&&companion.installUpdate) companion.installUpdate(); };
    document.getElementById('updateLaterBtn').onclick=()=>{ b.remove(); };
  }
  // 전역 키보드 입력 — 등록된 포커싱 어플을 쓰는 중일 때만 활동시간 갱신 (타이핑 모션 유도)
  if(window.companion&&companion.onGlobalKey){
    companion.onGlobalKey(state=>{ _applyActiveAppState(state); if(!focusGateSleep) activity(); });
  }
  // 전역 마우스 클릭 — 등록된 포커싱 어플을 쓰는 중일 때만 반응 (오른손 까딱)
  if(window.companion&&companion.onGlobalClick){
    companion.onGlobalClick(({x,y,button,...state})=>{
      _applyActiveAppState(state);
      if(!focusGateSleep){
        activity();
        const me=seats.find(s=>s.isMe);
        if(me) me.clickTapAt = performance.now();   // 오른손 까딱 펄스 시작 (animateRig에서 소비)
      }
    });
  }
  // 컨트롤 바: 드래그 이동 + 런처 + 잠깐 숨기기
  const grip=document.querySelector('#deskBar .grip');
  if(grip&&window.companion&&companion.moveWindow){ let dragging=false,px=0,py=0;
    grip.addEventListener('mousedown',e=>{dragging=true;px=e.screenX;py=e.screenY;e.preventDefault();});
    window.addEventListener('mousemove',e=>{ if(!dragging)return; companion.moveWindow(e.screenX-px,e.screenY-py); px=e.screenX;py=e.screenY; });
    window.addEventListener('mouseup',()=>dragging=false);
  }
  const dg=document.getElementById('deskGear'); if(dg) dg.onclick=()=>backToLauncher();
  const dh=document.getElementById('deskHide'); if(dh) dh.onclick=()=>{ const c=document.getElementById('scene'); c.style.visibility=(c.style.visibility==='hidden'?'visible':'hidden'); };

  /* ---- 클릭 통과 (click-through) ----
     run 모드(전체화면 투명 오버레이)일 때, 마우스가 캐릭터나 보이는 UI 위에 있으면 클릭을 받고,
     그 외 빈 공간이면 창을 통과시켜 뒤 창(브라우저 등)을 조작할 수 있게 한다. */
  if(window.companion && companion.setIgnoreMouse){
    const _cvEl = document.getElementById('scene');
    const _ndcHit = new THREE.Vector2();
    let _ignoring = null;   // 현재 무시 상태 (중복 IPC 방지)

    // 지정 화면좌표(clientX/Y)에 클릭 받을 대상이 있는지 판정
    function _pointHitsInteractive(cx, cy){
      // run 모드가 아니면(런처/생성기 등) 창 전체가 UI이므로 항상 클릭 받음
      if(!document.body.classList.contains('runmode')) return true;
      // "프로그램 이동" 중엔 마우스가 어디 있든 클릭을 받아야 위치 확정 클릭이 씹히지 않음
      if(moveMode) return true;
      // 상태칩·꾸미기 버튼 등 화면 위 DOM UI 위인지
      const el = document.elementFromPoint(cx, cy);
      if(el && el.closest &&
         el.closest('#myStatusChip, #wardrobePanel, #deskBar, .toast, #creatorOverlay, #launcher, #focusSettingsPanel, #licenseModalBox, #adminPassOverlay, #licenseGenOverlay, #adBannerOverlay, #raceOverlay, #partRegOverlay, #exportOverlay, #glbEncOverlay, #glbLoadOverlay, #assetGenOverlay, #assetImpOverlay, #inviteOverlay, #commGenOverlay, #userNameOverlay, #updateReadyBanner')){
        return true;
      }
      // 3D 캐릭터 위인지 (raycast)
      if(_cvEl && seats.length){
        const r = _cvEl.getBoundingClientRect();
        if(cx>=r.left && cx<=r.right && cy>=r.top && cy<=r.bottom){
          _ndcHit.x = ((cx - r.left)/r.width)*2 - 1;
          _ndcHit.y = -((cy - r.top)/r.height)*2 + 1;
          ray.setFromCamera(_ndcHit, camera);
          if(ray.intersectObjects(seats.map(s=>s.group), true).length) return true;
        }
      }
      return false;
    }

    function _updateIgnore(cx, cy){
      const interactive = _pointHitsInteractive(cx, cy);
      const shouldIgnore = !interactive;   // 상호작용 대상 없으면 통과(무시)
      if(shouldIgnore !== _ignoring){
        _ignoring = shouldIgnore;
        // 150ms 디바운스: 마우스가 경계를 여러 번 스치듯 지나갈 때 setIgnoreMouseEvents가
        // 짧은 시간에 여러 번 불리는 걸 막음 (Windows에서 이게 흰 화면의 원인일 수 있음)
        clearTimeout(_ignoreDebounce);
        _ignoreDebounce = setTimeout(()=>companion.setIgnoreMouse(shouldIgnore), 150);
      }
    }
    let _ignoreDebounce = null;

    // forward:true 덕분에 무시 중에도 mousemove는 계속 들어옴. 매 프레임 raycast는 부담이라 살짝 throttle.
    let _lastCheck = 0;
    window.addEventListener('mousemove', e=>{
      const now = performance.now();
      if(now - _lastCheck < 40) return;   // ~25Hz
      _lastCheck = now;
      if(drag) return;   // 드래그 중이면 무시 해제 상태 유지 (아래 pointerdown에서 처리)
      _updateIgnore(e.clientX, e.clientY);
    });
    // 드래그 중엔 캐릭터 밖으로 벗어나도 계속 잡아야 하므로, 드래그 동안은 무시 해제 유지
    window.addEventListener('pointerdown', ()=>{ if(_ignoring){ _ignoring=false; requestAnimationFrame(()=>companion.setIgnoreMouse(false)); } });
    // 드래그 끝나면 현재 위치 기준으로 다시 판정
    window.addEventListener('pointerup', e=>{ setTimeout(()=>_updateIgnore(e.clientX, e.clientY), 0); });
  }
}
/* 좌석 배치 후 데스크탑 창 크기를 펫에 맞춤 */
const _layoutSeats=layoutSeats;
layoutSeats=function(){ _layoutSeats();
  if(desktopMode&&window.companion&&companion.resizeWidget){
    const config=document.getElementById('launcher').classList.contains('on')||creatorOpen;
    if(!config){ const c=document.getElementById('scene'); companion.resizeWidget(parseInt(c.style.width)||320, (parseInt(c.style.height)||240)+28); }
  }
  applyDesktopRunClass(); };

/* ============================================================ INIT */
renderSeatTabs(); setManual(null); applyAppMode(); applyDesktopRunClass();
refreshAdminVisibility();   // 관리자 전용 UI는 기본 숨김 (관리자 모드 진입 시 노출)
{ const lbl=document.getElementById('lcLicenseLbl'); if(lbl) lbl.textContent = isPremium ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록'; }
loadBaseGLB().then(ok=>{ if(!ok) console.warn('기본 GLB 로드 실패 — 스탠드인 사용');
  return Promise.all([loadSkins(), loadSlots()]); }).then(()=>{ renderLauncher(); }).catch(()=>renderLauncher());
requestAnimationFrame(frame);
requestAnimationFrame(launcherLoop);
function resize(){ layoutSeats(); if(lRenderer&&document.getElementById('launcher').classList.contains('on')) sizeLauncherPreview(); }
addEventListener('resize',resize); resize();