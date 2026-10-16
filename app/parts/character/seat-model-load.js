/* seat-model-load.js — 📦 좌석 모델 싣기 — GLB 파싱 결과를 좌석에 붙이기 · 애니 클립 고르기 · 깜빡임 텍스처 · 좌석 비우기 · 파일 드롭
   책임: 파싱된 GLB 를 좌석 하나에 붙이고(보호 wrap · 기본 xf · 앵커 · 애니 클립 · 얼굴 머티리얼 · 본 찾기) 비우는 일 — 개발용 파일 드롭(.glb · .dcc · 이미지)도 여기서 고른다.
     크기 · 바닥 맞춤은 fitModel · fitDesk(app.js), 좌석 줄 다시 잡기는 layoutSeats 에 맡긴다.
   받는 deps: loader(GLTFLoader) · fitModel · fitDesk · setInfo · boneSide · layoutSeats · toast(함수) · selected · sliders · assetCodeMod(읽는 함수).
   내보내는 것: setupSeatModel · loadCharGLB · resetSeat · handleFiles · pickClip(상태별 클립 고르기 — 순수) · prepBlink.
   app.js «FILE LOADING» 구역을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 4줄 —
     assetCodeMod · selected · sliders 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: handleFiles · loadCharGLB · pickClip · prepBlink · resetSeat · setupSeatModel — app.js 는 seatModelLoadMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatModelLoad — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-seat-model-load.js */
(function(){

function createSeatModelLoad(deps){
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const boneSide = deps.boneSide;
const fitDesk = deps.fitDesk;
const fitModel = deps.fitModel;
const layoutSeats = deps.layoutSeats;
const loader = deps.loader;
const selected = deps.selected;   // 읽는 함수
const setInfo = deps.setInfo;
const sliders = deps.sliders;   // 읽는 함수
const toast = deps.toast;
/* 📐 좌석에 모델을 붙일 때의 기본값 */
const DEFAULT_ROT = Math.PI;               // 새 모델 기본 회전(정면이 카메라 쪽)
const ANCHOR_TOP_Y = 1.2;                  // 앵커 높이 기준(× userScale)
const HEAD_ANCHOR_K = 0.82, BODY_ANCHOR_K = 0.5;   // 머리 · 몸 앵커 = 기준 × 이 비율
const PLACEHOLDER_HEAD_Y = 1.08, PLACEHOLDER_BODY_Y = 0.46;   // 기본 도형(자리 표시) 앵커 높이
const FIRST_POSE_DT = 0.1;                 // 첫 애니 프레임을 미리 돌릴 시간(초) — 굽힌 다리 높이를 바닥 맞춤에 반영
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
  /* 🎩 파츠 좌표계 기준 노드 — 본과 메쉬가 실제로 들어 있는 노드. gltfRoot는 fitModel이 scale을 얹는
     '보호 wrap'이라 그 둘이 갈린다.
       ・인간·커미션: instantiateBase가 준 root를 그대로 넘겨받아 scale=1 → wrap 로컬 == root 로컬(원본 단위)
       ・동물: buildAnimalBase가 root에 normalizeModel을 이미 걸어놔서(배율 0.1765) 두 좌표계가 다르다
     파츠 GLB 좌표는 리그 원본 단위이므로 계산은 항상 이쪽(root) 기준이어야 한다.
     (미리보기 좌석은 seat.root가 같은 역할 — 두 화면이 같은 좌표계를 보게 하는 게 목적) */
  seat.modelRoot=m;
  seat.userScale=1; seat.userY=0; seat.userZ=0; seat.userRot=DEFAULT_ROT; seat.userX=0;   // 자동 중앙정렬 + 바닥맞춤 기본값
  if(selected()===seat){ document.getElementById('sScale').value=1; document.getElementById('sY').value=0;
    document.getElementById('sZ').value=0; document.getElementById('sRot').value=DEFAULT_ROT; }
  fitModel(seat);
  const topY=ANCHOR_TOP_Y*seat.userScale; seat.headAnchor.position.set(0,topY*HEAD_ANCHOR_K,0); seat.bodyAnchor.position.set(0,topY*BODY_ANCHOR_K,0);
  seat.actions={}; seat.current=null;
  if(animations&&animations.length){
    seat.mixer=new THREE.AnimationMixer(m);
    ['idle','pet','focus','sleep'].forEach(st=>{
      const clip=pickClip(animations,st)||pickClip(animations,'idle')||animations[0];
      if(clip) seat.actions[st]=seat.mixer.clipAction(clip);});
            
          // 💡 [파묻힘 방지] 애니메이션 1프레임을 미리 실행하여 굽힌 다리 높이를 계산에 반영합니다.
          if(seat.actions.idle) {
              seat.actions.idle.play();
              seat.mixer.update(FIRST_POSE_DT); 
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
  seat.bones={spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]}; seat.boneRest={};
  m.traverse(o=>{ if(o.isBone){ const n=o.name.toLowerCase();
    if(!seat.bones.spine&&(n.includes('spine')||n.includes('chest')||n.includes('torso')))seat.bones.spine=o;
    if(!seat.bones.head&&n.includes('head'))seat.bones.head=o;
    if(n.includes('hand')||n.includes('arm')){const s=boneSide(n);
      if(s==='l'&&!seat.bones.handL)seat.bones.handL=o; if(s==='r'&&!seat.bones.handR)seat.bones.handR=o;}
    if(n.includes('leg')||n.includes('thigh')){const s=boneSide(n);
      if(s==='l'&&!seat.bones.legL)seat.bones.legL=o; if(s==='r'&&!seat.bones.legR)seat.bones.legR=o;}
    // 귀 본 — 이름에 ear가 들어간 본을 전부 모음(Blender의 Ear.001/Ear.002 같은 자동 번호도 다 잡힘). 개수 상관없이 다 같이 움직임.
    if(n.includes('ear'))seat.bones.ear.push(o);
    }});
  for(const kk in seat.bones){
    if(kk==='ear'){ seat.boneRest.ear = seat.bones.ear.map(o=>o.quaternion.clone()); }
    else if(seat.bones[kk]) seat.boneRest[kk]=seat.bones[kk].quaternion.clone();
  }
  seat.hasRig=!!(seat.bones.spine||seat.bones.head||seat.bones.handL||seat.bones.handR);
  seat.equippedPartObjs = seat.equippedPartObjs || {};   // {cat: Object3D} — 부착된 파츠 인스턴스 추적
  let mc=0; m.traverse(o=>{if(o.isMesh)mc++;});
  const cl=(animations||[]).map(a=>a.name).join(', ')||'없음';
  if(mc===0) setInfo(seat,`⚠️ <b>${name}</b> 메시 0개 — Blender에서 메시 선택/압축 해제 확인.`);
  else { const rb=Object.keys(seat.bones).filter(k=>seat.bones[k]).join(', ')||'없음';
    setInfo(seat,`<b>${name}</b> · 메시 ${mc} · 클립: ${cl}<br>Face: ${seat.faceMat?'✓':'없음'} · 눈감음: ${seat.blinkTex?'✓':'없음'}<br>리그 본: ${rb}${seat.mixer?' (클립 우선)':seat.hasRig?' (절차적 자동)':''}`); }
  if(selected()===seat) sliders().classList.add('on');
  layoutSeats();   // 캐릭터 로드 후 실제 크기로 영역 재계산(바닥맞춤)
  // ★ 최초 로드 시점엔 책상 모델의 matrixWorld/Box3 실측이 아직 덜 확정돼 좌석이 딱 붙는 경우가 있음.
  //   다음 두 프레임에 걸쳐 한 번 더 재배치해서, 실측이 안정된 뒤의 정확한 간격으로 자동 보정.
  requestAnimationFrame(()=>{ layoutSeats();
    requestAnimationFrame(()=>{ layoutSeats(); }); });
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
  if(seat.gltfRoot){seat.bodyWrap.remove(seat.gltfRoot);seat.gltfRoot=null;seat.modelRoot=null;}
  if(seat.deskGltf){seat.group.remove(seat.deskGltf);seat.deskGltf=null;seat.desk.visible=true;}
  seat.isPlaceholder=true;seat.mixer=null;seat.actions={};seat.current=null;seat.faceMat=null;seat.blinkTex=null;
  seat.placeholder.root.visible=true; setInfo(seat,'기본 도형 캐릭터. <b>.glb 드롭</b>으로 교체.');
  seat.headAnchor.position.set(0,PLACEHOLDER_HEAD_Y,0); seat.bodyAnchor.position.set(0,PLACEHOLDER_BODY_Y,0);
  if(selected()===seat) sliders().classList.remove('on');
}
async function handleFiles(files,seat){
  for(const f of files){const nm=f.name.toLowerCase();
    if(nm.endsWith('.dcc')){ const buf=await f.arrayBuffer(); const pass=window.prompt('이 캐릭터의 비밀번호를 입력하세요'); if(!pass)continue;
      try{ const dec=await assetCodeMod().decryptBytes(buf,pass); loadCharGLB(dec,f.name.replace(/\.dcc$/i,'')+'.glb',seat); }catch(e){ toast('비밀번호가 틀렸거나 파일이 손상됐어요'); } }
    else if(nm.endsWith('.glb')){ const buf=await f.arrayBuffer();
      if(nm.includes('desk')||nm.includes('책상')) loadDeskGLB(buf,f.name,seat); else loadCharGLB(buf,f.name,seat); }
    else if(f.type.startsWith('image/')){ const url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f);}); setBlinkTexture(url,f.name,seat); }
  }
}


return {
  handleFiles,
  loadCharGLB,
  pickClip,
  prepBlink,
  resetSeat,
  setupSeatModel,
};
}

const api = { createSeatModelLoad };
if(typeof window !== 'undefined') window.TwSeatModelLoad = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
