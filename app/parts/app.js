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
/* 🧯 메인 캔버스 WebGL 연결 끊김 — 기록하고, 6초 안에 안 돌아오면 화면을 한 번 다시 불러온다(parts/gl-recover.js · 제보 #11).
   three.js 자기 리스너가 먼저 붙어 preventDefault 를 하므로 여기는 기록 · 시간 재기만 한다. */
try{
  if(typeof GlRecover !== 'undefined'){
    GlRecover.createGlRecover({
      log: (m) => { console.warn('[WebGL]', m); try{ if(window.companion && companion.diagNote) companion.diagNote('[WebGL] ' + m); }catch(_){} },
      reload: () => location.reload(),
      setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (id) => clearTimeout(id), now: () => Date.now(),
      store: { get: (k) => sessionStorage.getItem(k), set: (k, v) => sessionStorage.setItem(k, v) },
    }).attach(canvas);
  }
}catch(e){ console.warn('[WebGL] 복구 감시를 못 붙였다', e); }
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,0.1,100);   // 생성기와 동일한 원근 렌즈 (WYSIWYG)

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

// 생성기 미리보기와 톤 일치 — LIGHT_PRESET(b=0.8, h=0.09, e=0.4) 적용
// ★ 조명 색 — 예전 채도 0.45(진한 주황빛)는 빨간 파츠가 주황으로 보일 만큼 색을 왜곡했음(요청사항).
//   따뜻한 톤은 아주 살짝만 남기고(0.06) 거의 백색광으로 바꿔서 선택한 색이 그대로 보이게 함.
//   ⚠️ emissive(플랫 조명) 몫에는 이 색이 안 걸린다 — 조명 색을 진하게 하면 조명 몫과 emissive 몫의
//     색이 갈라져서, 제작 툴의 중립광 렌더와 나란히 놓으면 그 차이가 바로 보인다(0.10 → 0.06).
const _MAIN_LIGHT_COL = new THREE.Color().setHSL(0.09, 0.06, 0.88);
/* 💡 전체 광량. b × e (LIGHT_PRESET 과 동기화 — 저기 숫자를 바꾸면 여기도 같이 바꿀 것).
   ★★ 이 앱의 화면 밝기 예산은 네 항목이고 흰 면(알베도 1.0) 기준으로 이렇게 더해진다:
        앰비언트(0.95 × 이 값)
        + 정수리 키(이 값 × _KEY_LIGHT_MUL)     ← 하늘을 보는 면만
        + 정면 필(이 값 × _FILL_LIGHT_MUL)      ← 카메라를 보는 면만
        + FLAT_EMISSIVE                          ← 모든 면
      어느 면이든 그 면이 받는 합이 1.0 을 넘으면, **알베도 × 합** 이 1.0 을 넘는 지점부터
      전부 255 로 잘린다 — 텍스처의 밝은 쪽 계조가 통째로 사라진다는 뜻이다.
      ★ 넷의 합(정면 기준)은 **TONE_FRONT_TOTAL 이 정한다** — FLAT_EMISSIVE 가 남는 몫을
        받아가므로, 이 값을 만져도 정면 밝기는 안 바뀌고 '어디에 얼마를 주는가'만 바뀐다.
        화면을 더 밝게/어둡게 하려면 여기가 아니라 TONE_FRONT_TOTAL 을 만질 것.
   [지금 값] 앰비언트 0.524 · 키 0.160 · 필 0.160 · FLAT 0.476(계산됨)
        정면(옷 앞면·얼굴·욕조 앞면)  0.524+0.160+0.476 = 1.160 → 255
        윗면(머리띠 위·거품)          0.524+0.160+0.476 = 1.160 → 255 (알베도 0.86 부터 잘림)
        측면(어느 쪽도 안 봄)         0.524      +0.476 = 1.000 → 255 ← 지금은 여기도 안 어둡다
        ⚠️ 측면이 1.0 에 닿았다는 뜻은 **입체감이 방향광 몫에서만 나온다**는 것이다.
           TONE_FRONT_TOTAL 을 여기서 더 올리면 측면부터 잘리기 시작한다(그 표를 볼 것).
   [값 이력] 0.60(1.2×0.5) → 0.66 → 0.576 → 0.444 → **0.552(1.2×0.46)**.
      숫자가 오르내린 것은 방향광 구성이 바뀌었기 때문이고, 실제 화면 밝기는 이제
      TONE_FRONT_TOTAL 이 정한다. 그래서 이 값만 봐서는 밝기를 알 수 없다. */
const _MAIN_LIGHT_INT = 1.2 * 0.46;
/* 💡 정수리 키 조명 배율 — **위를 보는 면**에만 걸린다(거품·머리띠 위·책상 윗면).
   [경위] 예전 값(배율 1.0)에서 위를 보는 흰 면은 0.57+0.60+0.40 = 1.57 이었다 — 알베도 0.64 이상이
     전부 255 로 잘려 거품 텍스처의 음영이 통째로 사라졌다(제보: "거품이 너무 쨍하다").
   [값 이력] 1.0 → 0.55 → 0.12 → 0.48 → **0.29**.
     이 값은 '밝기'가 아니라 **정면 대비 윗면이 얼마나 더 받는가**다. 올리면 위아래 입체감이
     붙지만 흰 윗면이 먼저 잘리고, 내리면 납작해진다. 지금은 정면과 같은 몫을 준다(=윗면도 1.03).
   ⚠️ 바닥 그림자는 쓰지 않는다(확인받음). 그래서 이 값을 낮춰도 잃는 것은 입체감뿐이다. */
const _KEY_LIGHT_MUL = 0.29;
/* 💡 정면 필 조명 배율 — **카메라를 보는 면**에 걸린다. 이번 판의 핵심이다.
   [경위] 기존 필 조명은 (-3,2,-1), 즉 **물체 뒤쪽**에 있었다(카메라는 +z 에서 본다). 그래서
     카메라를 정면으로 보는 면 — 캐릭터 옷 앞면, 욕조 앞면, 얼굴 — 은 직접광을 **하나도**
     못 받고 앰비언트 + emissive 만으로 서 있었다. 반면 하늘을 보는 면(거품·머리띠 위)은 키를
     통째로 받는다. 화면에서 제일 잘 보이는 면이 제일 어두운 배치였던 것이다.
     → "머리띠와 거품은 하얗게 잘 나오는데 옷만 어둡다"가 정확히 이 구도다. 재질 문제가 아니라
       그 옷이 서 있는 면이라서 받을 빛이 없었다.
     → 3ds Max 쪽 렌더는 정면이 가장 밝은 균일한 스튜디오 배치다. 그래서 같은 파츠를 나란히
       놓으면 앞면 밝기부터 갈라져 보인다.
   ★ 위치는 카메라 쪽(0.5, 1.0, 3) — 살짝 위·오른쪽에서 넣어 완전히 납작해지지는 않게 했다.
   ⚠️ 이 값을 올리면 FLAT_EMISSIVE 가 그만큼 줄어든다(TONE_FRONT_TOTAL 이 총합을 고정하므로).
      정면 밝기는 그대로고, 방향광 몫이 커져 측면과의 대비만 세진다. */
const _FILL_LIGHT_MUL = 0.29;
/* 정면 필 조명 하나를 만든다 — 씬마다 같은 배치를 쓰라고 함수로 둔다(생성기·런처·꾸미기·썸네일 전부).
   ⚠️ 씬마다 따로 적어 두면 반드시 한 곳이 빠지고, 그 화면만 톤이 달라진다(예전 파츠 톤이 그랬다). */
function _mkFrontFill(intensity){
  const l = new THREE.DirectionalLight(_MAIN_LIGHT_COL, intensity);
  l.position.set(0.5, 1.0, 3);
  return l;
}
/* 💡 GLB 재질을 이 앱의 '플랫 조명' 규약에 맞게 정규화한다 — 캐릭터·파츠·아이템·책상이 전부 이 함수를 지난다.
   이 앱의 화면 밝기는 사실상 **앰비언트 + emissive** 두 개다(키 조명은 정수리 악센트뿐).
   그래서 그 둘 중 하나를 갉아먹는 재질 설정이 하나만 있어도 그 메쉬만 통째로 어두워진다.
   여기서 눕히는 것은 셋이다.

   (1) metalness — glTF 스펙상 metallicFactor 기본값이 **1.0** 이라, 블렌더에서 재질을 따로
       안 만지고 내보내면 metalness=1(완전 금속)로 들어온다. 금속은 확산광을 반사하지 않는데
       이 앱에는 환경맵(env map)이 아예 없어서, 그 재질은 씬 조명을 **하나도** 못 받는다.
       화면에 남는 것은 emissive 뿐 → 흰 옷이 0.55+0.38(=249)로 서야 하는데 0.38(=175)만 남는다.
       "emissive 를 내린 뒤부터 캐릭터가 어두워졌다"의 정체가 이것이다 — emissive 를 줄인 만큼
       그대로 어두워지는 재질이었던 것(정상 재질이라면 그만큼 조명 몫이 채운다).
   (2) aoMap — 앰비언트 오클루전은 **간접광(=앰비언트)에만** 곱해진다. 이 앱은 보이는 빛의
       거의 전부가 앰비언트라, 블렌더에서 AO 를 구워 넣은 파츠는 그 그림자가 화면 밝기를
       통째로 깎는다. 다른 파츠는 멀쩡한데 **한 파츠만** 회색으로 앉는 대표적인 원인이다.
       (표면에 그림자를 그리고 싶으면 baseColor 텍스처에 그리는 것이 이 앱의 방식이다)
   (3) lightMap — 구워 넣은 조명. 씬 조명과 이중으로 얹히거나 어둡게 덮어쓴다. 같은 이유로 뗀다.

   ⚠️ metalnessMap 이 있으면 metalness 는 손대지 않는다 — 그건 제작자가 칠한 금속이다.
      맨 metalness 만 1 인 것은 '설정 안 함'과 구별할 방법이 없고, 환경맵 없는 이 씬에서
      그대로 두면 무조건 새까맣게 나오므로 눕히는 쪽이 언제나 옳다.
   🩺 눕힐 것이 실제로 있었으면 한 줄 남긴다 — "이 파츠만 어둡다"가 다시 오면 콘솔에서
      어느 필드였는지 바로 보인다. 정상 재질에서는 아무것도 안 찍힌다. */
function _fixGlbMatLighting(m){
  if(!m) return;
  const found = [];
  if(m.isMeshStandardMaterial && !m.metalnessMap && m.metalness > 0.6){
    found.push('metalness ' + m.metalness.toFixed(2) + '→0.1');
    m.metalness = 0.1;
    if(m.roughness < 0.2) m.roughness = 0.6;   // 완전 매끈(0)이면 하이라이트만 튀어서 같이 완화
  }
  if(m.aoMap){ found.push('aoMap 제거(앰비언트를 깎고 있었음)'); m.aoMap = null; }
  if(m.lightMap){ found.push('lightMap 제거'); m.lightMap = null; }
  /* (4) vertexColors — 정점 색은 **확산광에만** 곱해진다. emissive 몫에는 안 곱해지므로,
     이 앱처럼 밝기의 3분의 1이 emissive 인 구조에서는 켜져 있는 것만으로 톤이 어긋난다:
       그 메쉬 = 알베도×정점색×조명 + 알베도×FLAT   ← 앞항만 깎인다
       옆 메쉬 = 알베도×조명        + 알베도×FLAT
     정점색이 0.8 만 돼도 그 메쉬만 조명 몫이 20% 깎여 회색으로 앉는다. 게다가 이 앱은
     옷 색을 코드가 정하는데(upMat.color.set) 그 위에 정점색이 또 곱해지면 고른 색이 안 나온다.
     ⚠️ 되살리려면 이 두 줄만 지우면 된다 — 다만 그러면 그 메쉬만 다시 톤이 어긋난다.
        표면에 음영을 넣고 싶으면 baseColor 텍스처에 그리는 것이 이 앱의 방식이다.
     [경위] 실제로 기본 캐릭터의 `upper` 재질이 이 상태였다(제보 로그에서 확인). */
  if(m.vertexColors){ found.push('vertexColors 끔(확산광만 깎여 톤이 어긋남)'); m.vertexColors = false; }
  if(found.length){
    m.needsUpdate = true;
    try{ console.log('[재질 정규화] ' + (m.name || '(이름 없음)') + ' — ' + found.join(' · ')); }catch(_){}
  }
  /* 🩺 여기서 못 눕히는데도 어두워지는 경로가 하나 남는다. 고치지 않고 알리기만 한다 —
     제작자가 의도했을 수 있고, 지우면 멀쩡한 파츠의 모양이 바뀐다. */
  try{
    if(m.isMeshStandardMaterial && m.metalnessMap && m.metalness > 0.6)
      console.log('[재질 주의] ' + (m.name||'(이름 없음)') + ' — metalnessMap 이 있어 금속도를 안 건드렸습니다. 이 파츠가 어둡게 나오면 제작 툴에서 Metallic 을 0 으로 두고 다시 내보내 주세요');
  }catch(_){}
}
scene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
const key=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL);
key.position.set(0,5,0); key.castShadow=true; key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=1; key.shadow.camera.far=30;
key.shadow.camera.left=-22; key.shadow.camera.right=22; key.shadow.camera.top=8; key.shadow.camera.bottom=-8;
key.shadow.bias=-0.0003; key.shadow.normalBias=0.03; scene.add(key);
const fill=new THREE.DirectionalLight(0xbcd0ff,0.12); fill.position.set(-3,2,-1); scene.add(fill);   // 뒤쪽 냉색 바운스(그대로 유지)
scene.add(_mkFrontFill(_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));   // ★ 정면 필 — 카메라를 보는 면(옷 앞면·얼굴·욕조 앞면)

const M=(c,r=0.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const matSage=M(0x9dba8a,0.8),matSageD=M(0x84a172,0.8),matInk=M(0x4a3f35,0.6),matWhite=M(0xfdfaf2,0.7),
      matWood=M(0xc9a57b,0.85),matWoodD=M(0xb08a5e,0.85),matPot=M(0xd98e73,0.8),matLeaf=M(0x88b06f,0.7),matBlush=M(0xe89b9b,0.6);

const CHAR_Z=-0.47;                 // 캐릭터 기본 앞뒤 위치 (책상과의 간격을 살짝 좁힘)
/* 🧍 캐릭터 높이(y) — 생성기 '좌석 세팅' 의 **앞뒤 슬라이더를 대체한** 값. def.xf.y 로 저장된다.
   [경위] 앞뒤(z)는 사용자가 조정할 이유가 사실상 없었다. CHAR_Z 가 책상과의 간격을 이미 정하고,
     조정값이 붙으면 미리보기·생성기·실행 세 화면이 각자 다른 식으로 그것을 보상해야 해서
     (fitModel 의 userZ, _wdDeskGrp 의 -xf.z, fitCreator 의 CHAR_Z+cXform.z) 어긋남의 온상이었다.
     대신 예전에 "바닥 파묻힘 방지" 를 이유로 아예 없애 두었던 높이 슬라이더를 되살린다 —
     그때 문제였던 '바닥 아래' 는 이제 하한 0 으로 원천 차단한다.
   ★ 0 = 발바닥이 월드 y=0(바닥). 음수는 없다. 상한은 CHAR_Y_MAX.
   ★ 저장된 옛 xf.z 는 읽는 자리마다 0 으로 죽인다(별도 이관 패스 없이 다음 저장 때 0 이 굳는다).
     읽는 자리: applyCharToSeat · fitCreator · 런처 미리보기 · 꾸미기 미리보기 · 프리셋 로드. */
const CHAR_Y_MAX = 0.6;             // 캐릭터 키가 1.45 이므로 약 40% — 이 이상은 '떠 있는' 게 된다
function clampCharY(v){ const n = +v; return (isFinite(n) && n > 0) ? Math.min(n, CHAR_Y_MAX) : 0; }
/* 🐾 실행 화면에서 캐릭터가 책상 앞으로 나와 있는 '기본 거리'. CHAR_Z는 절대값이라, 책상만 40%로
   줄어든 동물은 이 거리가 상대적으로 2.5배가 되어 책상에서 너무 멀리 떨어져 보였다(생성기는 책상이
   100%라 CHAR_Z가 그대로 맞음). 책상과 같은 비율로 줄여서 생성기에서 본 간격이 그대로 재현되게 한다.
   ★ 실행 화면 전용 — fitCreator(생성기)와 런처 미리보기의 CHAR_Z는 손대지 않는다. */
/* 🪑🐾 캐릭터의 앞뒤 자리 — **좌석마다 예외 없이 CHAR_Z 하나다.**

   [경위 — 두 번의 뒤집기]
     ① 예전엔 여기에 동물 배율(0.4)과 평준화 배율(k)을 곱했다. 이유는 "책상이 그 배율로
        줄어 원점 쪽으로 오는데 캐릭터만 −0.47 에 남으면 간격이 어긋난다" 였고, 간격 자체는
        그 말이 맞았다.
     ② 그런데 그 방식은 **좌석마다 서 있는 깊이(z)를 다르게** 만든다. 카메라가 +z 에서
        pitch 0.09(약 5.2°)로 내려다보므로, 바닥(y=0) 위의 같은 점이라도 카메라에서 멀수록
        화면에서는 위로 잡힌다 → **발선이 좌석마다 다른 줄에 그려진다.**
        실측: 사람 z=-0.47 · 동물 z=-0.188 → 차이 0.282 × sin(0.09) ≒ 0.025
        = 캐릭터 키(0.48~0.61)의 4~5%. 제보의 "동물만 조금 높게 떠 보인다"가 정확히 이 값이다.
        발 박스는 사람·동물 둘 다 정확히 y=0 이었다 — **y 문제가 아니라 z 문제였다.**
   ★ 그래서 배율 둘을 **책상 쪽으로 옮겼다**(syncSeatDeskZ). 간격은 그대로 보존되고,
     모든 좌석이 같은 깊이에 서므로 발선이 한 줄로 겹친다.
   ★ 평준화도 같은 병을 앓고 있었다 — k 는 좌석마다 다르므로 사람끼리도 발선이 갈렸다.
     이 변경이 그쪽까지 함께 고친다.

   ⚠️ 여기 하나만 고치면 된다 — 즉시 적용(applyCharToSeat) · 비행(_updateFlyingSeats·endFlight) ·
     프레임 루프의 복귀 lerp 가 전부 이 함수를 부른다.
   ⚠️ 인자 seat 는 이제 안 쓰지만 **남겨 둔다** — 호출부가 다섯 곳이고, 나중에 좌석별로
     달라질 일이 생기면 여기 한 곳만 보면 되게 하기 위해서다.
   ⚠️ 꾸미기 미리보기(refreshWdPreviewChar)는 이 함수를 안 쓰고 CHAR_Z 를 직접 곱하는데,
     그쪽은 캐릭터를 z=0 에 두고 **간격만** 인코딩하는 다른 규약이다. 계산해 보면 이 변경 뒤에도
     두 식이 그대로 일치한다(sim-char-z.js §3 이 그 일치를 지킨다) — 건드리지 말 것. */
function seatCharZ(seat){
  return CHAR_Z;
}
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

/* ===== 🐾 사람 귀 (꾸미기 › 머리 › 귀) — human-ear.js. 귀 GLB 파싱은 animal.js 캐시를 같이 쓴다.
   animal.js 는 이 파일보다 늦게 로드되므로 파서는 부를 때 찾는다. */
/* ⚠️ 모듈이 없어도(로드 실패 · app.js 만 평가하는 검사) 앱은 켜져야 한다 — 그때는 귀만 꺼진다. */
const humanEar = (typeof HumanEar === 'undefined') ? null : HumanEar.createHumanEar({
  THREE,
  parseEar:(key, cb)=>{
    const f = window.parseAnimalEar;
    if(f){ f(key, cb); return; }
    setTimeout(()=>{ const g = window.parseAnimalEar; if(g) g(key, cb); else cb(null); }, 500);
  },
  earTypes:()=>window.ANIMAL_EAR_TYPES || [],
});
/* 귀는 흰색으로 시작한다(색은 그리기로만) — 다른 몸 재질과 같은 플랫 조명(applyLightPresetToInstance). */
function _humanEarMat(){
  const m = new THREE.MeshStandardMaterial({ color:'#ffffff', metalness:0, roughness:0.9, side:THREE.DoubleSide });
  m.emissive.setScalar(FLAT_EMISSIVE);
  return m;
}
/* ⚠️ 바인드 자세일 때(조립 직후 · 애니메이션 전) 불러야 한다 — holder 와 옮길 양을 이때 잰다.
   귀가 없어도 holder 는 만들어 둔다: 나중에 꾸미기에서 귀를 고를 때는 이미 움직이는 좌석이다. */
/* 🖍️ 귀 그림(def.earPicL·R)을 붙은 귀에 입힌다 — 파츠 그림과 같은 배관(applyPartPic · 같은 업로드 캐시) */
function _humanEarPic(wrap, def){
  try{ partPaintMod.applyPartPic(wrap, (def && def['earPic' + wrap.userData.humanEar]) || null); }catch(e){ console.warn('[사람 귀] 그림', e); }
}
/* 귀 까닥임 — 붙어 있는 사람 귀를 좌석의 귀 목록(seat.bones.ear)에 올리고, 떨어진 옛 귀는 걷는다.
   동물 귀와 같은 등록(_registerAnimalEarOn)을 쓴다 — 사람 기본 모델의 ear 본도 웨이트가 없어서
   본만 돌리면 아무것도 안 움직인다(부착물 자체를 돌려야 한다). */
function _syncHumanEarRig(seat){
  if(!seat || !seat.bones || !seat.bones.ear || !seat.modelRoot) return;
  if(!seat.boneRest) seat.boneRest = {};
  if(!seat.boneRest.ear) seat.boneRest.ear = [];
  const live = [];
  try{ seat.modelRoot.traverse(o=>{ if(o.userData && o.userData.humanEar) live.push(o); }); }catch(_){}
  for(let i = seat.bones.ear.length - 1; i >= 0; i--){
    const o = seat.bones.ear[i];
    if(o && o.userData && o.userData.humanEar && live.indexOf(o) < 0){
      seat.bones.ear.splice(i, 1); seat.boneRest.ear.splice(i, 1); seat.earTimers = null;
    }
  }
  live.forEach(w=>_registerAnimalEarOn(seat, w));
}
function _attachHumanEars(root, def){
  if(!humanEar || !root || (def && def.animal)) return;
  try{
    humanEar.ensureHolder(root);
    humanEar.attachFromDef(root, def, { material:_humanEarMat,
      onAttach:(w)=>{
        _humanEarPic(w, def);
        try{ premiumMod.wdEar.onEarAttached(root); }catch(_){}
        /* 귀는 늦게 붙는다 — 이 좌석 머리 위에 이미 누가 타 있으면 그 '머리 꼭대기' 는 귀 없던 값이다 */
        try{ const _s = seats.find(x=>x.modelRoot === root); if(_s){ _syncHumanEarRig(_s); rideBenchMod._remeasureRideHeadTop(_s); } }catch(_){}
      } });
    /* 귀를 뺐거나 파싱 캐시로 바로 붙은 경우 — 콜백만으로는 옛 귀가 목록에 남는다 */
    try{ const _s = seats.find(x=>x.modelRoot === root); if(_s) _syncHumanEarRig(_s); }catch(_){}
  }catch(e){ console.warn('[사람 귀] 붙이기 실패', e); }
}

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
  // 커미션 캐릭터에 미리 씌워진 파츠(안경/모자/탈/한벌옷/날개/손) — 메쉬(또는 재질) 이름으로 자동 인식.
  // 꾸미기에서 같은 카테고리 파츠를 장착하면 이 메쉬가 숨겨지고, 해제하면 다시 보임(applyClothVisibility에서 처리).
  let glassesMesh=null, hatMesh=null, hatMat=null, maskMesh=null, onepieceMesh=null, wingMesh=null, handLMesh=null, handRMesh=null, capeMesh=null;
  /* ★ 조명 평탄화(applyLightPresetToInstance)는 "이름으로 분류된" 파츠뿐 아니라 **모든 메쉬**에
     똑같이 적용해야 함 — 커미션 캐릭터가 위 카테고리에 안 걸리는 이름(몸통/신발/머리카락 등)의 메쉬를
     쓰면 그 부분만 조명 처리를 못 받아 다른 부분과 톤이 달라 보이던 문제의 원인이었음.
     ⚠️ 예전에는 `cm.map` 이 있는 재질만 담았다. 텍스처 없는 메쉬는 emissive 를 0 으로 둔 채
        앰비언트(0.57)만 받는데, 받는 쪽은 0.92 라 화면상 199 대 246(255 기준)이다 —
        같은 흰색을 지정해도 한쪽만 회색으로 읽힌다. 파츠 경로는 원래부터 텍스처 유무를 안 가렸으니,
        "파츠는 쨍한데 캐릭터 옷만 어둡다"가 바로 이 차이였다. 이제 전부 담는다. */
  const litMats=[];
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;
    const cm=o.material&&o.material.clone?o.material.clone():o.material; o.material=cm;
      const nm=(cm&&cm.name||'').toLowerCase();
      const meshName=(o.name||'').toLowerCase();
      if(cm){ litMats.push(cm); _fixGlbMatLighting(cm); }   // 텍스처 유무·이름 분류와 무관하게 전부 조명 평탄화 대상
      // 텍스처(머티리얼 이름)가 없어도, 메쉬 이름이 'head'면 생성창 스킨 타겟으로 잡습니다.
      // ★ 메쉬 이름 분류 — 짧고 흔한 단어(hat, cap, wing, left 등)는 부분 문자열 매칭이면 오탐지가 잘 나서
      //   (예: "landscape"에 "cap"이 있어 하의가 모자로 잘못 분류) 정규식 단어 경계로 잡음.
      //   긴/명확한 단어(glass, dress 등)는 부분 문자열도 안전.
      const has = (str, word)=> new RegExp('(?:^|[^a-z])'+word+'(?:$|[^a-z])','i').test(str);
      const hasBoth = word => has(nm, word) || has(meshName, word);
      if(nm.includes('face') || meshName.includes('head')){faceMat=cm;faceMesh=o;}
    else if(!upMesh && (nm.includes('upper')||nm.includes('up_cloth')||nm.includes('up_clothes'))){upMat=cm;upMesh=o;}
    else if(!loMesh && (nm.includes('lower')||nm.includes('low_cloth')||nm.includes('low_clothes'))){loMat=cm;loMesh=o;}
    else if(!glassesMesh && (nm.includes('glass')||meshName.includes('glass'))){glassesMesh=o;}
    else if(!capeMesh && hasBoth('cape')){capeMesh=o;}   // ★ 첫 매치만 채택 — lower의 재질이 'cape'로 이름 붙은 케이스에서 뒤에 만난 걸로 덮어쓰지 않게(요청사항)
    else if(!hatMesh && (hasBoth('hat')||hasBoth('cap'))){hatMesh=o;hatMat=cm;}
    else if(!maskMesh && hasBoth('mask')){maskMesh=o;}
    else if(!onepieceMesh && (nm.includes('dress')||meshName.includes('dress'))){onepieceMesh=o;}
    else if(!wingMesh && hasBoth('wing')){wingMesh=o;}
    else if(!handLMesh && hasBoth('left')){handLMesh=o;}
    else if(!handRMesh && hasBoth('right')){handRMesh=o;} }});
  return {root,faceMat,upMat,loMat,faceMesh,upMesh,loMesh,glassesMesh,hatMesh,hatMat,maskMesh,onepieceMesh,wingMesh,handLMesh,handRMesh,capeMesh,litMats};
}
/* 커미션 GLB 파싱 캐시: base64 → THREE.Scene */
const commSceneCache = new Map();
async function getCommissionScene(glbB64){
  if(commSceneCache.has(glbB64)) return commSceneCache.get(glbB64);
  const buf = b64ToBuf(glbB64);
  const scene = await assetCodeMod.parseGlbBytes(buf);
  commSceneCache.set(glbB64, scene);
  return scene;
}
function mkFaceTex(canvas){const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.encoding=THREE.sRGBEncoding;t.needsUpdate=true;return t;}
// ★ 커미션(유료 제작) 캐릭터 크기 보정 — 블렌더에서 기본 캐릭터와 비슷한 크기로 맞춰 내보내도
//   실제로는 더 작게 들어오는 경우가 있어서(GLB에 안 보이는 여분 메쉬/본이 섞여 바운딩박스가 커지는 등)
//   경험적으로 보정하는 배율. 1.15 = 15% 키움. 필요하면 이 숫자만 조절.
const COMMISSION_SCALE_CORRECTION = 1;   // ★ 테스트용으로 일시적으로 보정 없음(1)으로 설정 — 원래 값은 1.15, 되돌리려면 이 숫자만 1.15로 바꾸면 됨
function normalizeModel(group,targetH,isComm){
  group.updateMatrixWorld(true);
  
  // 기본 캐릭터용 원본 계산
  const box=new THREE.Box3().setFromObject(group);
  const size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  let s=targetH/(size.y||1);
  if(isComm) s *= COMMISSION_SCALE_CORRECTION;   // 커미션 캐릭터만 추가 보정
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
const DEFAULT_DESK_OVERRIDE_ID='__default_desk__';   // 관리자가 "기본 책상"을 우클릭해서 등록하면 이 예약 ID로 저장됨
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
function applyDeskAdj(p){ const a=p.userData.adj; p.position.set(a.x||0,a.y||0,a.z||0); p.rotation.set(0,a.rot||0,0); p.scale.setScalar(a.scale||1); }
/* 🪑 생성기 아이템마다 «이번 편집에서 처음 나타난 자리» — ⟲ 이동·회전 초기화가 돌아갈 곳(desk-item-origin.js) */
const deskItemOrigin = (typeof DeskItemOrigin === 'undefined') ? null : DeskItemOrigin.createDeskItemOrigin();
function _rememberCrItemOrigin(holder, p){
  if(!deskItemOrigin || !p || typeof cBase==='undefined' || holder!==cBase) return;
  deskItemOrigin.remember(p, p.userData.adj);
}
const activeItemMixers = new Set();   // 매 프레임 업데이트해야 할 아이템 애니메이션 믹서들
// ★ 어플 8: playMode='idle'로 등록된 아이템 pivot들 — 매 프레임 소유 좌석 상태에 따라 재생/정지 전환.
//   ★ 이름이 헷갈리지만 요청 동작은 이거예요:
//     유저가 활동 중(마우스/타이핑) = 캐릭터 seatState()가 'focus' → 아이템 애니메이션 재생.
//     가만히 있음(idle) / 자리비움(sleep) / 어지러움(dizzy) / 기타 → 정지.
//   (관리자 UI에서 부르는 "idle 애니메이션"은 아이템 자체의 대기·존재감 연출 애니메이션이라는 뜻이고,
//    이건 유저가 화면을 볼 만한 시점에만 돌아가면 됨.)
const _idleItemPivots = new Set();

/* ▶ 꾸미기 파츠 애니메이션 ─────────────────────────────────────────────────
   책상 위 아이템의 playMode='idle'과 같은 동작을 파츠에도 제공한다.
   animMode==='active'인 파츠는 아래 Set에 등록되고, updateActivePartPlayback()이 매 프레임
   소유 좌석 상태를 보고 재생/일시정지를 전환한다.
     재생  : seatState==='focus' (마우스·타이핑이 감지되는 활동 중)
     일시정지: 그 외 전부 — 자리비움(sleep) · 어지러움(dizzy) · 가만히 있음(idle) 등
   ★ stop()이 아니라 paused=true를 쓰는 이유: stop은 0프레임으로 되감아 파츠가 툭 튀는데,
     일시정지는 그 자리에 멈춰 있다가 활동을 재개하면 이어서 움직인다. */
const _activePartWraps = new Set();
/* 🎬 파츠 애니메이션 진단을 **화면에도** 띄운다.
   [경위] 진단은 원래 console.log 뿐이었는데, "안 움직인다"를 보고할 때 F12 를 열어 보는 사람이
     없다시피 했다. 그래서 같은 내용을 토스트로도 한 번 낸다 — 원인 셋이 화면에서 전부 똑같이
     '안 움직임'으로 보이는 것이 이 문제의 본질이라, 구분해 주는 것 자체가 답이다.
   ⚠️ 관리자에게만 낸다. 일반 유저는 남의 파츠를 장착할 때마다 이 안내를 받을 이유가 없다.
   ⚠️ 같은 파츠에 대해 한 번만 낸다 — 장착·재조립이 반복될 때마다 뜨면 토스트가 화면을 덮는다. */
/* 🎬 이 클립이 **실제로 움직이는가** — 키프레임 값이 첫 프레임과 전부 같으면 '정지 포즈'다.
   [경위] 클립이 여러 개 든 GLB 에서, 이름은 idle 인데 값이 전부 같은(포즈만 든) 클립이 실제로 있었다.
     그러면 앱은 정상적으로 재생하는데 화면은 안 움직여서, '클립이 0개'인 경우와 구분이 안 된다.
   ⚠️ 첫 프레임과의 차이만 본다 — 아주 느린 클립도 어딘가 한 프레임은 달라지므로 충분하다. */
function _clipHasMotion(clip){
  try{
    if(!clip || !clip.tracks || !clip.tracks.length) return false;
    for(const t of clip.tracks){
      const v = t.values; if(!v || v.length < 2) continue;
      const n = (typeof t.getValueSize === 'function') ? t.getValueSize() : 1;
      if(!n) continue;
      for(let i = n; i < v.length; i++){
        if(Math.abs(v[i] - v[i % n]) > 1e-4) return true;
      }
    }
    return false;
  }catch(_){ return true; }   // 못 판단하면 '움직인다'로 둔다 — 멀쩡한 클립을 건너뛰는 쪽이 더 나쁘다
}
/* 🎬 어떤 클립을 틀지 고른다.
   ★ 우선순위에 '실제로 움직이는가'가 이름보다 앞선다. 이름이 idle 인 정지 포즈를 골라 두면
     그 GLB 는 영영 안 움직이는데, 정작 움직이는 클립이 같은 파일 안에 들어 있다.
   ⚠️ 이름 매칭은 정확히 'idle' 인 것을 먼저 본다. 예전엔 /idle/ 포함으로만 찾아서
     'dou_idle' 같은 이름이 배열에서 앞에 있으면 정작 'idle' 을 제치고 뽑혔다(실제 사례). */
function _pickPartClip(animations){
  if(!animations || !animations.length) return null;
  const exact   = c => /^idle$/i.test(c.name || '');
  const partial = c => /idle/i.test(c.name || '');
  const moving  = animations.filter(_clipHasMotion);
  return moving.find(exact) || moving.find(partial) || moving[0]
      || animations.find(exact) || animations.find(partial) || animations[0];
}
const _partAnimNoticed = new Set();
/* 🔇 토스트 알림은 끈다(요청사항).
   [경위] 관리자 화면에서 파츠를 장착할 때마다 "클립이 0개예요" 같은 안내가 토스트로 떴다.
     진단으로는 유용했지만, 애니메이션이 없는 파츠가 정상인 경우가 훨씬 많아서 실제로는
     장착할 때마다 화면을 덮는 잡음이 됐다.
   ★ console.log 진단은 그대로 남는다 — 호출부에서 이 함수와 짝으로 항상 찍고 있으므로,
     "이 파츠가 왜 안 움직이지"를 볼 때는 개발자 콘솔에서 [파츠 애니] 로 검색하면 된다.
   되살리려면 아래 return 한 줄만 지우면 된다. */
function _partAnimNotice(rec, msg){
  return;
  /* eslint-disable no-unreachable */
  try{
    if(typeof isAdmin === 'undefined' || !isAdmin) return;
    const key = (rec && rec.id) || '';
    if(_partAnimNoticed.has(key)) return;
    _partAnimNoticed.add(key);
    toast('[' + ((rec && rec.name) || '파츠') + '] ' + msg);
  }catch(_){}
}

/* 🐰 파츠 자체 클립에서 '남이 맡은 본' 트랙을 걷어낸다 ────────────────────────
   [증상] 귀 파츠 하나가 까닥임과 별개로 혼자 뒤로 갔다 앞으로 오며 회전한다(rabbit 제보).
   [원인] 그 GLB 는 원본 캐릭터의 아마추어를 통째로 안고 나왔다(spine·head·hand_L/R·leg_L/R·ear_L/R).
     안에 든 클립 넷 중 셋(dou_idle·flower_idle·flowerAction)이 **키가 2개뿐인 정지 포즈**라,
     _pickPartClip 이 '실제로 움직이는' 유일한 클립인 ArmatureAction — 원본 캐릭터의 몸통 동작
     (head 회전 0.23rad + 손 흔들기) — 을 골랐다. 귀 밑동 웨이트가 head 에 39% 걸려 있어서
     그 head 회전이 귀 전체를 앞뒤로 흔들었다. 이름 판정과는 무관한 별개 원인이다.
   [원칙] 리지드 파츠에서 **까닥임이 맡은 귀 본과 그 조상**은 파츠 클립의 소관이 아니다.
     조상(head·spine)이 하는 일은 이미 캐릭터의 진짜 본이 하고 있고(파츠는 거기 매달려 있다),
     귀 본은 까닥임이 쓴다. 클립이 같은 본을 겹쳐 쓰면 파츠가 캐릭터와 따로 논다.
   ★ 나머지 트랙은 그대로 둔다 — 클립을 통째로 끄면 진짜 애니메이션 귀 파츠까지 같이 죽는다.
   ⚠️ GLTFLoader 는 트랙 이름에 노드 이름을 **정제해서** 넣는다('ear.L' → 'earL').
     그래서 원본 이름과 정제 이름을 둘 다 넣고 비교한다. */
function _sanitizeNodeName(s){
  try{ if(THREE.PropertyBinding && THREE.PropertyBinding.sanitizeNodeName)
         return THREE.PropertyBinding.sanitizeNodeName(String(s)); }catch(_){}
  return String(s).replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'');
}
function _stripPartClipOwnedTracks(clip, obj, earObjs){
  if(!clip || !clip.tracks || !earObjs || !earObjs.length) return clip;
  const owned = new Set();
  earObjs.forEach(e=>{
    for(let n=e; n; n=n.parent){
      if(n.name){ owned.add(n.name); owned.add(_sanitizeNodeName(n.name)); }
      if(n===obj) break;
    }
  });
  const keep = clip.tracks.filter(t=>{
    let nm = '';
    try{ nm = (THREE.PropertyBinding.parseTrackName(t.name)||{}).nodeName || ''; }
    catch(_){ nm = String(t.name||'').split('.')[0]; }
    return !owned.has(nm);
  });
  const cut = clip.tracks.length - keep.length;
  if(!cut) return clip;
  const out = clip.clone(); out.tracks = keep; out._twStrippedTracks = cut;
  console.log('[파츠 애니] 클립 "'+clip.name+'" — 까닥임·부착이 맡은 본의 트랙 '+cut+'개 제외'
    + ' (제외 대상: '+Array.from(owned).join(', ')+'). 이 본들은 캐릭터와 귀 까닥임이 담당합니다.');
  return out;
}
function _setupPartIdleAnim(wrapper, obj, idleClip, rec, holder){
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(idleClip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  wrapper.userData.itemMixer = mixer;
  wrapper.userData.idleAction = action;
  if(rec && rec.animMode === 'active'){
    wrapper.userData.animHolder = holder;
    action.play(); action.paused = true;      // 판정은 updateActivePartPlayback이 매 프레임 담당
    _activePartWraps.add(wrapper);
  } else {
    action.play();
    activeItemMixers.add(mixer);              // 기존 동작 — 계속 반복재생
  }
}
function _teardownPartIdleAnim(wrapper){
  if(!wrapper || !wrapper.userData) return;
  if(wrapper.userData.itemMixer) activeItemMixers.delete(wrapper.userData.itemMixer);
  _activePartWraps.delete(wrapper);
}
function updateActivePartPlayback(){
  if(!_activePartWraps.size) return;
  const now = performance.now();
  _activePartWraps.forEach(wrp=>{
    const ud = wrp.userData || {};
    const a = ud.idleAction, m = ud.itemMixer, holder = ud.animHolder;
    if(!a || !m || !holder){ _activePartWraps.delete(wrp); return; }
    // 꾸미기 미리보기 캐릭터는 좌석이 아니라 상태 개념이 없다 — 확인용으로 계속 재생.
    const isPreview = (typeof seats === 'undefined') || !seats.includes(holder);
    const shouldPlay = isPreview || (seatState(holder, now) === 'focus');
    if(shouldPlay){
      if(a.paused) a.paused = false;
      if(!a.isRunning()) a.play();
      activeItemMixers.add(m);
    } else if(!a.paused){
      a.paused = true;                 // 그 자리에 정지 — 되감지 않음
      activeItemMixers.delete(m);
    }
  });
}
function updateIdleItemPlayback(){
  if(!_idleItemPivots.size) return;
  const now = performance.now();
  _idleItemPivots.forEach(pivot=>{
    const a = pivot.userData && pivot.userData.idleAction;
    const m = pivot.userData && pivot.userData.itemMixer;
    const holder = pivot.userData && pivot.userData.holder;
    if(!a || !m || !holder) return;
    const state = seatState(holder, now);
    const shouldPlay = (state === 'focus');
    const isPlaying = a.isRunning();
    if(shouldPlay && !isPlaying){
      a.reset(); a.play();
      activeItemMixers.add(m);
    } else if(!shouldPlay && isPlaying){
      a.stop();
      activeItemMixers.delete(m);
    }
    // 🔥 빡일중(grind) 상태일 땐 이 아이템의 재생 속도를 2배로 (요청사항 — 유저가 몰입 중일 때 아이템도 활발히)
    //   본인 좌석은 userStatus, 친구 좌석은 remoteUserStatus를 참조 (seatState와 동일 규칙)
    if(shouldPlay){
      const us = holder.isMe ? userStatus : (holder.remote ? holder.remoteUserStatus : null);
      a.timeScale = (us === 'grind') ? 2.0 : 1.0;
    }
  });
}
// ★ 좌석의 활성 책상 아이템 중 handTrackers(hand_L/hand_R 마커)가 있는 것들을, 그 좌석 캐릭터의
//   실제 손 본 위치에 맞춰 매 프레임 갱신 — frame() 루프에서 좌석별 포즈 갱신 뒤에 호출됨.
const _handWorldTmp = new THREE.Vector3();
function updateItemHandTrackers(seat){
  if(!seat.deskItems) return;
  for(const id in seat.deskItems){
    const pivot=seat.deskItems[id]; if(!pivot || !pivot.userData.handTrackers) continue;
    const tr=pivot.userData.handTrackers;
    ['L','R'].forEach(side=>{
      const node=tr[side]; const bone=seat.bones && seat.bones['hand'+side];
      if(!node || !bone) return;
      bone.updateWorldMatrix(true,false);   // 이번 프레임 포즈(타이핑 등)가 반영된 최신 위치를 확실히 가져오기 위함
      bone.getWorldPosition(_handWorldTmp);
      if(node.parent) node.parent.worldToLocal(_handWorldTmp);
      node.position.copy(_handWorldTmp);
    });
  }
}
function equipDeskItem(holder,def,on){
  // ★ 라이선스 보유자 전용으로 등록된 아이템은 라이선스(isPremium) 또는 관리자가 아니면 장착 자체를 막음.
  //   ⚠️ 단 **친구 좌석(holder.remote)에는 걸지 않는다.** applyDeskItemsTo가 친구 좌석을 그릴 때도
  //     이 함수를 타는데, 여기서 '보는 사람'의 라이선스를 보면 라이선스 있는 친구가 올려둔 아이템이
  //     라이선스 없는 내 화면에서만 사라진다(applyDeskCatalogRefToSeat와 같은 함정).
  /* ⚠️ def.licenseOnly 만 보면 새는 자리가 있다 — 캐릭터에 딸려온 customItems 는 registerCustomItem 을
     licenseOnly 인자 없이 부르는 세 곳(슬롯 적용·좌석 적용·프리셋)에서 **licenseOnly:false 로 등록**된다.
     카탈로그가 먼저 도착했으면 `if(!customItems[id])` 가드에 걸려 무사하지만, 캐릭터가 먼저 닿으면
     그 세션 내내 전용 아이템이 게이트를 통째로 안 탄다. 원본은 카탈로그 레코드(savedItems)이므로
     그쪽도 함께 본다 — 카탈로그가 늦게 와도 그때부터는 맞는 답이 된다.
     savedItems 는 아래에서 let 으로 선언되므로 typeof 가 아니라 try 로 감싼다(TDZ). */
  let _siCat = null; try{ _siCat = commissionMod.savedItems(); }catch(_){}
  const _siRec = (_siCat && _siCat.find && def && def.id) ? _siCat.find(s=>s.id===def.id) : null;
  const _itemLicenseOnly = !!(def && def.licenseOnly) || !!(_siRec && _siRec.licenseOnly);
  if(on && _itemLicenseOnly && !isPremium && !isAdmin && !(holder && holder.remote)){
    toast('🔒 "'+(def.name||'이 아이템')+'"은(는) 라이선스 보유자만 사용할 수 있어요');
    return;
  }
  if(!holder.deskItems)holder.deskItems={};
  if(!holder._itemAdjMemory)holder._itemAdjMemory={};   // 해제했다가 다시 장착할 때 이전 위치/크기 조정값을 기억해뒀다가 복원하기 위함
  const cur=holder.deskItems[def.id];
  if(cur){
    holder._itemAdjMemory[def.id]=Object.assign({},cur.userData.adj);   // 해제 직전 값을 기억
    if(cur.userData.colors) holder._itemAdjMemory[def.id]._colors = Object.assign({}, cur.userData.colors);   // 런처3-1: 색상도 함께 기억
    if(cur.userData.itemMixer) activeItemMixers.delete(cur.userData.itemMixer);   // 해제 시 믹서 업데이트 목록에서도 제거
    _idleItemPivots.delete(cur);   // 어플 8: 자리비움 재생 대상에서도 제거
    if(cur.parent)cur.parent.remove(cur); holder.deskItems[def.id]=null;
    if(holder.activeDeskItem===cur){
      holder.activeDeskItem=null;
      // 런처4-2: 활성 아이템이 방금 해제됐으니 기즈모도 즉시 숨김
      if(holder===cBase) attachItemGizmoToActive();
    }
  }
  // ★ 아이템의 attachTo가 'handL'/'handR'이고 캐릭터 본이 있으면 책상 앵커 대신 손 본에 부착 —
  //   기존 꾸미기 파츠(handL/handR 카테고리)와 동일한 seat.bones 조회 방식을 그대로 재사용.
  const wantBone = (def.attachTo && def.attachTo!=='desk') ? def.attachTo : null;
  const boneParent = wantBone && holder.bones && holder.bones[wantBone];
  const attachParent = boneParent || holder.deskAnchor;
  if(on && attachParent){ const obj=def.build(); const pivot=new THREE.Group(); attachParent.add(pivot); pivot.add(obj);
    pivot.userData.isDeskItemPivot=true;   // classifyHit에서 "아이템 클릭"으로 구분하는 마커
    // ★ 런처3-1: 아이템 GLB에도 파츠와 동일한 _col 네이밍(_col, _col1, _col2, ...)이 있으면 색상 그룹으로 인식.
    //   해당 메쉬들을 pivot.userData.colorGroups에 담아두고, 나중에 상세조정 UI에서 색을 바꿀 수 있게 함.
    //   저장·복원은 def.itemColors(=holder에 저장, id별) 형태로 하고, 실제 material.color/emissive를 갱신.
    const itemColorGroups = {};
    obj.traverse(o=>{
      if(!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = mats[0];
      const colMatch = (o.name && o.name.match(/_col(\d*)/i)) || (m && m.name && m.name.match(/_col(\d*)/i));
      if(colMatch){
        const key = 'col'+(colMatch[1]||'1');
        if(m && m.color) o.userData.origColor = m.color.getHexString();
        (itemColorGroups[key] = itemColorGroups[key]||[]).push(o);
      }
    });
    if(Object.keys(itemColorGroups).length) pivot.userData.colorGroups = itemColorGroups;
    // ★ 아이템 GLB 안에 이름이 "hand_L"/"handL"/"hand_R"/"handR"인 자식 오브젝트가 있으면, 그 지점만
    //   캐릭터의 실제 손 본 위치를 매 프레임 따라가도록 등록(예: 반죽 양 끝을 손이 잡고 늘이는 연출).
    //   아이템 자체는 책상/부착 위치에 그대로 있고, 이 특정 지점들만 손을 따라감(frame()의 updateItemHandTrackers 참고).
    const handTrackers={};
    obj.traverse(o=>{
      if(/^hand[_-]?l$/i.test(o.name)) handTrackers.L=o;
      else if(/^hand[_-]?r$/i.test(o.name)) handTrackers.R=o;
    });
    if(handTrackers.L || handTrackers.R) pivot.userData.handTrackers = handTrackers;
    // ★ 관리자가 등록 시 "발광 효과"를 켜뒀으면(def.glow) 아이템 옆에 은은한 원형 빛 스프라이트를 추가함.
    // ★ 발광 효과 비활성화(요청사항: 발광 없는 게 나음) — 기존에 glow로 등록된 아이템도 더 이상 빛나지 않음.
    // if(def.glow) pivot.userData.glowSprite = applyGlowEffect(obj);
    // 클립 이름에 "idle"이 포함된 게 있으면 그걸, 없으면 첫 번째 클립을 클릭 시 재생용 idle 애니메이션으로 지정
    if(def.animations && def.animations.length){
      const mixer=new THREE.AnimationMixer(obj);
      const idleClip = def.animations.find(c=>/idle/i.test(c.name)) || def.animations[0];
      pivot.userData.itemMixer=mixer;
      pivot.userData.idleAction=mixer.clipAction(idleClip);
      // ★ 재생 방식: 'click'(기본, 클릭 시 1회), 'auto'(항상 반복재생), 'idle'(유저가 자리 비웠을 때만 반복재생).
      //   하위호환: 예전 아이템에 def.playMode가 없고 def.autoPlay:true면 'auto'로, 아니면 'click'으로 취급.
      const playMode = def.playMode || (def.autoPlay ? 'auto' : 'click');
      pivot.userData.playMode = playMode;
      if(playMode==='auto'){
        // ★ 관리자가 "자동 재생"으로 등록한 아이템 — 클릭 없이 바로, 계속 반복 재생됨(팬 돌아가기, 촛불 흔들리기 등 배경 연출용)
        pivot.userData.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        pivot.userData.idleAction.play();
        activeItemMixers.add(mixer);
      } else if(playMode==='idle'){
        // ★ 자리비움(idle) 감지 시에만 반복재생 — 매 프레임 체크(updateIdleItemPlayback)에서 켜고 끔.
        //   장착 시점엔 유저가 활동 중이라고 보고 정지 상태로 시작.
        pivot.userData.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        // 자동 등록: 매 프레임 체크에서 이 pivot을 볼 수 있게 컬렉션에 등록
        _idleItemPivots.add(pivot);
      } else {
        pivot.userData.idleAction.setLoop(THREE.LoopOnce,1);
        pivot.userData.idleAction.clampWhenFinished=true;
      }
    }
    if(def.custom){
      // 업로드된 커스텀 아이템: 책상처럼(normalizeDeskObj) 원본 GLB의 실제 크기(바운딩박스)를 재서
      //   목표 크기(가로/세로/높이 중 제일 큰 값 기준)에 자동으로 맞춤 — 원본을 얼마나 크게/작게 export했든
      //   항상 일정한 크기로 나옴(고정 배율 방식보다 훨씬 안정적).
      // ITEM_TARGET_SIZE: 관리자가 등록 시 개별 설정 안 했으면 쓰는 기본값(하위호환용). 개별 설정은 def.defaultSize 우선.
      const ITEM_TARGET_SIZE = (def.defaultSize!=null) ? def.defaultSize : 0.8;
      // ★ 본(스켈레톤)이 있는 모델은 바운딩박스가 실제 자세보다 낮게 잡히는 경우가 있어서(THREE.js가 rest pose
      //   기준으로 계산함) 기본 보정값을 둠. 아래 두 숫자만 조절하면 모든 커스텀 아이템의 시작 위치가 한번에 맞춰짐.
      const ITEM_Y_START_OFFSET = 1.1;   // 높이 보정 — 양수=더 위로, 음수=더 아래로 (고정값)
      const ITEM_Z_START_OFFSET = 0;      // 앞뒤 보정 — 양수=더 앞으로(카메라 쪽), 음수=더 뒤로
      obj.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(obj);
      const center=box.getCenter(new THREE.Vector3());
      // ★ 핵심: obj를 피봇 안에서 다시 배치 — 제작자가 원본 GLB에 잡아둔 원점이 어디든 상관없이,
      //   "메쉬 바닥 중앙"이 피봇의 원점(0,0,0)에 오도록 옮김. 이후 +/-(크기)나 회전은 항상 이 바닥중앙 기준으로
      //   자연스럽게 동작함(원래는 원본 원점 기준이라 크기 조절할 때마다 위치가 이상하게 튀었음).
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      obj.position.y -= box.min.y;
      const sz=box.getSize(new THREE.Vector3());
      const maxDim=Math.max(sz.x,sz.y,sz.z,0.001);
      const itemScale = isFinite(maxDim) ? ITEM_TARGET_SIZE/maxDim : 1;
      // 🔎 진단 로그(아이템 크기 컨텍스트 차이) — 문제 원인 파악 후 이 두 줄만 지우면 됨.
      const _parentSc = (holder && holder.desk) ? holder.desk.scale.x : (holder && holder.deskAnchor ? holder.deskAnchor.getWorldScale(new THREE.Vector3()).x : '?');
      console.log('[아이템크기]', def.id, '| holder=', holder===cBase?'생성기':(holder===lHolder?'런처':'실행'), '| desk.scale=', _parentSc, '| maxDim=', maxDim.toFixed(3), '| itemScale=', itemScale.toFixed(3));
      pivot.userData.autoScale = itemScale;   // ★ "지금 이 컨텍스트에서" 계산된 순수 자동 크기값 — 저장/복원 시 사용자 조정 비율을 재적용하기 위해 별도 보관
      pivot.userData.adj={x:0,y:ITEM_Y_START_OFFSET,z:ITEM_Z_START_OFFSET,scale:itemScale,rot:0};
    } else {
      pivot.userData.adj={x:0,z:0,scale:1,rot:0};   // 기본 내장 아이템(화분/머그컵/책)은 이미 정확히 맞춰져 있어서 그대로
    }
    if(holder._itemAdjMemory[def.id]){
      // ★ y도 유지 — 유저가 기즈모로 조절한 아이템 높이가 다음 로드 시에도 반영되도록.
      const mem=Object.assign({}, holder._itemAdjMemory[def.id]);
      // 런처3-1: 색상은 별도로 pivot.userData.colors에 복원 (adj와 분리)
      if(mem._colors){ pivot.userData.colors = Object.assign({}, mem._colors); delete mem._colors; }
      Object.assign(pivot.userData.adj, mem);
    }
    holder.deskItems[def.id]=pivot; holder.activeDeskItem=pivot; applyDeskAdj(pivot);
    _rememberCrItemOrigin(holder, pivot);   // 새로 놓인 아이템의 처음 자리(불러온 저장값은 applyDeskItemsTo 가 다시 적는다)
    if(pivot.userData.colors) _applyItemColor(pivot);
    pivot.userData.holder = holder;   // 어플 8: idle 재생 판정에 필요 — 소유 좌석 상태를 알아야 함
    if(typeof cBase!=='undefined' && holder===cBase) selectDeskItemForAdjust(pivot);   // 생성기 안에서는 방금 장착한 아이템도 선택 표시
  }
}
// 아이템 pivot을 클릭했을 때 idle 애니메이션을 한 번 재생 (끝나면 마지막 프레임에서 정지)
function playItemIdle(pivot){
  const a=pivot && pivot.userData && pivot.userData.idleAction; if(!a) return false;
  a.reset(); a.play();
  activeItemMixers.add(pivot.userData.itemMixer);
  return true;
}
function collectDeskItems(holder){ const d={}; let any=false; allDeskItems().forEach(def=>{ const p=holder.deskItems&&holder.deskItems[def.id]; if(p){ d[def.id]={adj:Object.assign({},p.userData.adj)}; if(p.userData.autoScale!=null) d[def.id].autoScale=p.userData.autoScale;
  // ★ 색상은 비어있어도 항상 저장 — "초기화(원본으로 복원)한 상태"를 명시적으로 기록해서
  //   실행 화면 로드 시 이전에 저장돼 있던 색이 남지 않게 함. 예전엔 빈 객체면 필드가 빠져서 초기화가 안 반영됐음.
  if(p.userData.colorGroups) d[def.id].colors=Object.assign({},p.userData.colors||{});
  any=true;} }); return any?d:null; }
/* ★ 생성기에서 책상 아이템을 켜고 끌 때 "완성 → 저장"을 눌러야만 반영되던 게 혼란을 줬음(꾸미기 파츠는
   토글 즉시 저장되는 것과 비대칭) — 아이템 켜고/끄는 즉시 여기서 바로 def에 반영 + 저장까지 함.
   단, 새 캐릭터(아직 한 번도 저장 안 한)일 땐 cBase.charDef가 없어서 조용히 건너뜀(완성 시 정상 저장됨). */
function autoSaveDeskItemsNow(){
  if(!cBase || !cBase.charDef) return;
  const def = cBase.charDef;
  const di = collectDeskItems(cBase);
  def.deskItems = di;
  if(di){
    const ci={}; Object.keys(di).forEach(id=>{ const c=customItems[id]; const rec=commissionMod.savedItems().find(s=>s.id===id);
      if(c && !(rec&&rec.fromCatalog)) ci[id]={name:c.name,glb:c.glb}; });
    if(Object.keys(ci).length) def.customItems=ci;
  }
  slotSaveMod.saveSlots();
}
function applyDeskItemsTo(holder,data){ if(!data||!holder.deskAnchor)return; Object.keys(data).forEach(id=>{ const def=deskItemDef(id); if(!def)return; const e=data[id]; equipDeskItem(holder,def,true); const p=holder.deskItems[id]; if(p&&e.adj){
    const savedAdj=Object.assign({},e.adj);
    // ★ 예전엔 y를 자동 계산값(ITEM_Y_START_OFFSET)으로 강제 복원해서 저장값을 무시했음 — 유저가 기즈모로
    //   조절할 수 있는 UI가 없다고 가정한 옛 로직. 지금은 기즈모로 자유롭게 y 조작 가능하므로 저장값 그대로 씀.
    //   (y가 저장 안 된 옛 데이터는 그대로 undefined → applyDeskAdj에서 a.y||0으로 처리)
    // ★ 커스텀 아이템(자동 정규화 대상)이고 저장 당시의 autoScale 정보가 있으면 — "그때 화면에서 사용자가
    //   자동 크기 대비 얼마나 키우거나 줄였는지" 비율을 구해서, 지금 이 화면(생성기/런처/실행)에서 방금
    //   새로 계산된 autoScale에 그 비율을 곱해 절대 크기를 다시 환산함. 책상/좌석 스케일이 화면마다 다른
    //   시점에 적용돼도 아이템 크기가 항상 똑같이(ITEM_TARGET_SIZE 기준으로) 재현됨.
    //   (autoScale 정보가 없는 예전 저장 캐릭터는 예전처럼 절대값 그대로 사용 — 기존 모습 그대로 유지)
    if(e.autoScale && p.userData.autoScale){
      const userMul = (e.adj.scale!=null ? e.adj.scale : e.autoScale) / e.autoScale;
      savedAdj.scale = p.userData.autoScale * userMul;
    }
    // 🔎 진단 로그 2 — 최종 복원 단계. e.autoScale(저장된 자동값), e.adj.scale(저장된 최종값),
    //   p.userData.autoScale(지금 막 새로 계산된 값), savedAdj.scale(이번에 실제로 적용될 최종값)을 비교.
    console.log('[아이템크기-복원]', id, '| holder=', holder===cBase?'생성기':(holder===lHolder?'런처':'실행'),
      '| 저장된 autoScale=', e.autoScale, '| 저장된 adj.scale=', e.adj.scale,
      '| 지금 계산된 autoScale=', p.userData.autoScale, '| 최종 적용 scale=', savedAdj.scale,
      '| rot=', savedAdj.rot);   // 🔄 [제보 4] 회전이 저장까지 왔는지 한눈에
    Object.assign(p.userData.adj,savedAdj);applyDeskAdj(p);
    _rememberCrItemOrigin(holder, p);   // 불러온 자리가 이 아이템의 처음 자리
    // ★ 런처3-1: 저장된 아이템 색상(colors) 복원 — 그룹별로 material.color/emissive를 갱신.
    //   저장된 colors에 없는 그룹은 원본색(origColor)으로 강제 복원 — 예전에 저장된 색이 남지 않게.
    if(p.userData.colorGroups){
      p.userData.colors = Object.assign({}, e.colors||{});
      Object.keys(p.userData.colorGroups).forEach(key=>{
        if(p.userData.colors[key]!=null) return;   // 저장된 색은 아래 _applyItemColor가 처리
        // 원본 색으로 복원
        (p.userData.colorGroups[key]||[]).forEach(m=>{
          if(!m.material || !m.userData.origColor) return;
          const hex='#'+m.userData.origColor;
          if(m.material.color) m.material.color.set(hex);
          if(m.material.emissive){
            const flat=(m.material.userData&&m.material.userData.baseFlat!=null)?m.material.userData.baseFlat:0.4;
            m.material.emissive.copy(m.material.color).multiplyScalar(flat);
            m.material.needsUpdate=true;
          }
        });
      });
      _applyItemColor(p);
    }
  } }); }
// 색상 그룹의 실제 material에 저장된 색을 반영 (파츠의 applyColor와 같은 로직)
function _applyItemColor(pivot){
  if(!pivot || !pivot.userData || !pivot.userData.colorGroups || !pivot.userData.colors) return;
  Object.keys(pivot.userData.colors).forEach(key=>{
    const val = pivot.userData.colors[key];
    const meshes = pivot.userData.colorGroups[key] || [];
    meshes.forEach(o=>{
      if(!o.material) return;
      if(o.material.color) o.material.color.set(val);
      if(o.material.emissive){
        // 파츠와 동일: baseFlat(원본 flat 비율) 없이 단순히 색과 같게 두는 것도 어색하지 않으므로 flat=0.4로 임시
        const flat = (o.material.userData && o.material.userData.baseFlat!=null) ? o.material.userData.baseFlat : 0.4;
        o.material.emissive.copy(o.material.color).multiplyScalar(flat);
        o.material.needsUpdate = true;
      }
    });
  });
}
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
const seats=[]; let selected=null;
// ★ 좌석 간 간격 — 책상 폭(1.7)보다 좁게 잡아서 책상끼리 "한뼘 정도"만 떨어지게 함.
//   자리 추가(솔로)/멀티플레이어 친구 좌석 모두 이 값 하나로 공통 적용됨(layoutSeats에서 재사용).
//   더 좁히고 싶으면 값을 줄이고(단, 너무 작으면 책상끼리 겹쳐 보일 수 있음), 넓히고 싶으면 늘리세요.
// ★ 좌석(책상) 간 여백 — 예전엔 고정 상수였는데, 사용자가 설정 패널에서 직접 조절할 수 있게 변경.
//   솔로/멀티 각각 따로 저장되고(모드 전환해도 서로 기억), 최소값(GAP_MIN)은 책상끼리 겹치지 않을
//   정도로 낮게 잡아둬서 아무리 좁혀도 실제로 겹쳐지진 않음.
const GAP_MIN = 0.02, GAP_MAX = 1.2, GAP_STEPS = 15;
const GAP_KEY_SOLO='tw.gapSolo', GAP_KEY_MULTI='tw.gapMulti';
function _loadGap(key, def){ try{ const v=parseFloat(localStorage.getItem(key)); if(!isNaN(v)) return Math.max(GAP_MIN,Math.min(GAP_MAX,v)); }catch(e){} return def; }
let SPACING = _loadGap(GAP_KEY_SOLO, 0.3);
let MULTIPLAYER_SPACING = _loadGap(GAP_KEY_MULTI, 0.45);
function saveGap(){ try{ localStorage.setItem(GAP_KEY_SOLO, String(SPACING)); localStorage.setItem(GAP_KEY_MULTI, String(MULTIPLAYER_SPACING)); }catch(e){} }
function createSeat(){
  const group=new THREE.Group();
  const desk=buildDesk(true); group.add(desk);
  const _dt=desk.getObjectByName('deskTop'); let deskMat=null; if(_dt){ _dt.material=_dt.material.clone(); deskMat=_dt.material; }
  const rig=new THREE.Group(); rig.position.set(0,0,CHAR_Z);
  const bodyWrap=new THREE.Group(); rig.add(bodyWrap); group.add(rig);
  const ph=buildPlaceholder(); bodyWrap.add(ph.root);
  const seat={
    group,desk,deskMat,deskGltf:null,rig,bodyWrap,placeholder:ph,contactShadow:null,
    isPlaceholder:true,gltfRoot:null,mixer:null,actions:{},current:null,
    faceMat:null,faceMapOrig:null,blinkTex:null,
    userScale:1,userY:0,userZ:0,userRot:Math.PI,userX:0,
    petStart:-1e9,targetX:0,
    pose:{leanX:0,turnY:0,slumpY:0,breSpd:2,breAmp:0.025,eyeOpen:1,arm:0},
    breathePhase:Math.random()*6.28, swayPhase:Math.random()*6.28, headPhase:Math.random()*6.28,
    smooth:0.0016+Math.random()*0.0012,
    bones:{spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]}, boneRest:{}, hasRig:false,
    blink:{pulses:[],nextAt:performance.now()+800+Math.random()*2200,singles:2+Math.floor(Math.random()*2),closed:false},
    // 귀 까닥임(랜덤, 가끔) — ear 본이 있는 캐릭터에서만 동작. 상태(idle/focus 등)와 무관하게 독립적으로 작동.
    earNextAt: performance.now()+3000+Math.random()*5000, earFlickStart:null,
    // 머리 위 레벨/이름 이름표 — group에 직접 붙여서(rig 아님) 드래그/흔들기 중에도 책상처럼 제자리에 고정.
    // 머리 위 이름표/말풍선은 DOM 요소로 지연 생성됨(seat.namePlateEl / seat.bubbleEl) — 여기서 미리 선언 불필요.
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
/* ── 캐릭터 위치·크기 영속화 ──
   deskPanX/Y ("프로그램 이동"으로 옮긴 위치), focusCharScale (설정 패널의 캐릭터 크기 슬라이더)를 localStorage에 저장.
   프로그램을 껐다 켜도 마지막으로 맞춰둔 위치/크기가 그대로 복원됨. */
const CHAR_POS_KEY = 'tw.deskPan';        // {x, y}
// ★ 마이홈/친구 시스템용 "영구" 사용자 ID — 방 접속용 memberId(매번 새로 생김)와 다르게, 이 값은
//   한 번 만들어지면 이 기기에서 계속 유지됨. 친구 목록이 이 ID를 기준으로 저장되기 때문에 꼭 필요.
const MY_USER_ID_KEY = 'tw.myUserId';
/* 🎟️ 부팅 시점에 이 기기에 userId가 이미 있었는지 — 초대장 게이트의 신규/기존 판정 기준.
   ★ users/{uid} DB 존재로 판정하면 안 됨: 신규 유저도 첫 실행 때 presence·프로필 등
     초기화 코드가 게이트와 병렬로 users/{uid}를 만들어 버려서, 재시작하면
     "기존 유저"로 오인 → 코드 없이 통과 + 초대권 5장 지급되는 구멍이 생김.
   localStorage는 이 파일 최상단(어떤 쓰기보다 먼저)에서 캡처하므로 레이스가 없음. */
const HAD_USER_ID_AT_BOOT = (()=>{ try{ return !!localStorage.getItem(MY_USER_ID_KEY); }catch(e){ return false; } })();
const MY_FRIEND_CODE_KEY = 'tw.myFriendCode';
/* 🔗 이 기기가 **버린** 친추 코드들 (최신 먼저, 최대 5개).
   [왜 필요한가] 되찾기가 코드 입력을 요구했는데, 정작 코드를 잃는 순간은 자기 치유
   (_healFriendCodeOwner)나 계정 연동이 **자동으로** 갈아끼울 때다. 그 순간 화면에는
   새 코드만 남고 옛 코드는 어디에도 안 적힌다 — 외워두지 않았으면 되찾을 방법이 없었다.
   그런데 갈아끼우는 그 코드에서 **우리는 옛 코드를 손에 쥐고 있었다.** 버리기 전에 적어둔다.
   ⚠️ 로컬 기록이라 이 기기에서 잃은 코드만 안다. 새 PC에서 처음 연동하며 잃은 코드는
     여기 없다 — 그 경우는 여전히 직접 입력해야 한다(서버에 옛 코드 이력을 남기려면
     users 노드 스키마와 규칙을 함께 바꿔야 해서 지금은 안 한다). */
/* ⚠️ 되찾기 UI 가 사라진 뒤로 이 기록을 **읽는 화면은 없다.** 지우지 않고 남겨둔 이유는
   하나뿐이다 — 코드가 바뀌었다는 제보가 오면 F12 콘솔에서 getOldFriendCodes() 로
   "이 기기가 무슨 코드를 언제 버렸는지"를 물어볼 수 있다. 그게 유일한 용도다.
   새 기능을 여기에 얹지 말 것. 코드 유지는 _healFriendCodeOwner 가 책임진다. */
const MY_FRIEND_CODE_PREV_KEY = 'tw.myFriendCodePrev';
/* 🪪 (걷음 · 회원가입 설계 §6-② · CHECKS 개정 56) «이 기기가 버린 내 uid» 목록 `tw.myPrevUserIds` · `_rememberPrevUserId` ·
   `_isMyPrevUserId`. 계정이 없던 시절(한 사람 = 기기마다 다른 uid)의 장치였다 — 그 uid 를 가리키는 친구 코드·친구 요청을
   **조건 없이** 끌어왔다. 이제 로그인은 비밀번호·구글로 확인된 계정이라, 이 기기의 이전 uid 는 **다른 계정**이다
   (한 PC 를 둘이 쓰면 다른 사람). 코드와 요청은 그 코드를 가진 계정에 그대로 둔다.
   ★ 예전 판이 남긴 값은 여기서 한 번 지운다(로그아웃 목록 ACCOUNT_LOCAL_KEYS 에서도 뺐다). */
try{ localStorage.removeItem('tw.myPrevUserIds'); }catch(_){}
function _rememberOldFriendCode(code){
  const c = String(code || '').toUpperCase().trim();
  if(!/^(MATE|COZY)-[A-Z0-9]{4}$/.test(c)) return;
  try{
    let list = JSON.parse(localStorage.getItem(MY_FRIEND_CODE_PREV_KEY) || '[]');
    if(!Array.isArray(list)) list = [];
    // ⚠️ 여기서 '지금 코드인가'를 거르지 않는다. 이 함수는 대개 **교체 직전**에 불려서
    //   그 시점엔 아직 지금 코드이기 때문이다. 거르는 일은 읽는 쪽(getOldFriendCodes)이 한다.
    list = [c].concat(list.filter(x => x !== c)).slice(0, 5);
    localStorage.setItem(MY_FRIEND_CODE_PREV_KEY, JSON.stringify(list));
  }catch(_){}
}
function getOldFriendCodes(){
  let cur = null, list = [];
  try{ cur = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  try{ list = JSON.parse(localStorage.getItem(MY_FRIEND_CODE_PREV_KEY) || '[]'); }catch(_){}
  if(!Array.isArray(list)) list = [];
  return list.filter(c => typeof c === 'string' && c && c !== cur);
}
/* 🪪 [회원가입 설계 §6-① · 개정 8] **읽기만 한다 — 없으면 null.**
   예전엔 «없으면 만든다» 였다. 그래서 처음 쓰는 PC 는 부팅하자마자(마이홈·동기화 타이머가 부르는 순간)
   uid 를 얻었고, 초대 게이트·구글 로그인이 «이 기기엔 아직 아무도 없다» 를 알 길이 없었다(§3).
   이제 uid 는 게이트가 정한다: 새 사람은 `_inventMyUserId`(한 곳) → `_setMyUserId`(한 곳) → 재시작.
   ★ 기존 사용자는 부팅 때부터 키가 있으니 달라지는 것이 없다.
   ★ uid 가 없는 동안 나가는 서버 요청은 firebase-init 의 빈 uid 안전망(`_noUidPath`)이 막는다. */
function getMyUserId(){
  try{ return localStorage.getItem(MY_USER_ID_KEY) || null; }catch(e){ return null; }
}
/* 🪪 uid 를 **만드는** 곳은 여기 하나다(설계 §3 ②). 부르는 곳도 게이트의 «새 사람» 갈래 하나. */
function _inventMyUserId(){
  return 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
}
/* 🪪 uid 를 **기록하는** 새 입구(설계 §6-⑦). 옛 입구 넷(계정 이전·구글 갈아타기·되찾기·연동 화면)은
   그 기계들을 걷어 낼 때 이리로 모이거나 함께 사라진다. 성공하면 true. */
function _setMyUserId(uid){
  if(typeof uid !== 'string' || !/^u[0-9a-z]{8,40}$/i.test(uid)) return false;
  try{ localStorage.setItem(MY_USER_ID_KEY, uid); return localStorage.getItem(MY_USER_ID_KEY) === uid; }catch(e){ return false; }
}
function genFriendCodeCandidate(){
  // ★ 친구코드는 MATE- 접두어 — 방코드(COZY-)와 형식이 같아 유저가 헷갈리던 문제 해결.
  //   (이미 발급된 COZY- 친구코드도 friendCodes 노드에 그대로 있어 조회는 계속 됨 → 하위호환)
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='MATE-'; for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)]; return s;
}
/* 🔗 친추코드 소유권 검증 플래그 — 세션당 1회(읽기 1회)만 확인한다.
   ⚠️ 이 값을 true로 만드는 것은 "확인을 마쳤다"는 뜻이다. 조회 자체가 실패했을 때는
      반드시 false로 되돌려야 한다 — 안 그러면 오프라인 실행 한 번으로 검증이 영구히 건너뛰어진다. */
let _fcOwnerChecked = false;
/* (걷음 · 개정 56) FC_STALE_DAYS — 친추코드 «7일 조용하면 되찾기» 갈래와 함께. 시크릿룸 발급 게이트는 제 상수(SR_STALE_DAYS)를 쓴다. */
// 내 친추코드 확보 — 로컬에 이미 있으면 그대로 쓰고, 없으면 새로 만들어서 Firebase에 등록(충돌 시 재시도).
/* 🪞 [회원가입 설계 §3 ⑥ · 개정 12] 친구 코드 거울 정정 — 계정 거울(users/{uid}/friendCode)이 이 기기 코드와 다르면 **로컬만** 고친다.
   [왜] 코드 = 로그인 아이디다. 코드가 틀리게 보이는 PC 는 로그인 아이디를 틀리게 보여 주는 PC 다.
     개정 27 이후 _healFriendCodeOwner 는 옛 uid 를 가리키는 코드를 그대로 두므로(핑퐁 방지) 그것만으로는 이 표시가 안 고쳐진다.
   ★ friendCodes 에 **쓰지 않는다** — 소유권은 안 건드린다(개정 27 «활동 중인 소유자 것은 빼앗지 않는다» 그대로).
   ★ 거울이 비었거나 못 읽으면 아무것도 안 한다 — 발급은 ensureMyFriendCode 몫.
   ★ 거울 코드가 **지금도 내 것일 때만** 따른다(읽기 한 번) — 거울이 낡아 남의 코드를 가리키면 남의 아이디를 보여 주게 된다.
   ★ 부르는 곳은 ensureMyFriendCode 첫머리 하나(세션당 한 번) — 발급보다 **먼저** 봐야, 로컬 코드가 없는 PC 가
     새 코드를 뽑아 계정의 진짜 코드를 버리는 일이 없다. 돌려주는 것: 'fixed' · 'adopted'(로컬이 비어 있었다) · 그 밖의 사유 문자열. */
let _fcMirrorChecked = false;
async function _friendCodeMirrorFix(){
  const uid = getMyUserId();
  if(!uid) return 'no-uid';
  if(!(window.firebaseAPI && firebaseAPI.getUserFriendCode && firebaseAPI.lookupFriendCode)) return 'no-api';
  let mirror = null;
  try{ mirror = await firebaseAPI.getUserFriendCode(uid); }catch(_){ return 'unread'; }
  if(!mirror) return 'empty';
  let local = null; try{ local = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  if(local === mirror) return 'same';
  let owner;
  try{ owner = await firebaseAPI.lookupFriendCode(mirror); }catch(_){ return 'unread'; }
  if(owner !== uid) return 'not-mine';
  try{ localStorage.setItem(MY_FRIEND_CODE_KEY, mirror); }catch(_){ return 'unsaved'; }
  _fcOwnerChecked = true;   // 방금 확인했다 — 거울 코드의 주인은 나
  console.info('[친추코드] 계정 거울을 따라 이 기기 표시를 고쳤어요:', (local || '(없음)') + ' → ' + mirror);
  return local ? 'fixed' : 'adopted';
}
async function ensureMyFriendCode(){
  if(!_fcMirrorChecked && getMyUserId()){
    _fcMirrorChecked = true;
    try{ await _friendCodeMirrorFix(); }catch(_){}
  }
  let code = localStorage.getItem(MY_FRIEND_CODE_KEY);
  if(code){
    // 🔗 계정 연동 뒤 이 코드가 남의(=버린) uid를 가리키고 있을 수 있다 → 아래에서 정정한다.
    if(!_fcOwnerChecked) await _healFriendCodeOwner(code);
    return localStorage.getItem(MY_FRIEND_CODE_KEY) || code;
  }
  if(!window.firebaseAPI || !firebaseAPI.registerFriendCode) return null;
  const myId = getMyUserId();
  if(!myId) return null;     // 🪪 uid 가 정해지기 전(처음 쓰는 PC · 게이트 앞)에는 코드를 뽑지 않는다
  _fcOwnerChecked = true;   // 지금 새로 발급하므로 소유자는 나 자신 — 검증 불필요
  for(let i=0;i<8;i++){
    const cand = genFriendCodeCandidate();
    try{
      const ok = await firebaseAPI.registerFriendCode(cand, myId);
      if(ok){
        try{ localStorage.setItem(MY_FRIEND_CODE_KEY, cand); }catch(e){}
        // 🔗 계정에도 거울을 남긴다 — 새 PC에서 옛 코드를 알 수 있는 유일한 통로다.
        try{ if(firebaseAPI.setUserFriendCode) await firebaseAPI.setUserFriendCode(myId, cand); }catch(_){}
        return cand;
      }
    }catch(e){}
  }
  return null;
}
/* 🔗 친추코드가 내 uid를 가리키지 않을 때 (읽기 1회, 세션당 1회)
   [개정 56 · 회원가입 설계 §6-③] 되찾기 갈래 둘을 걷었다 — «내가 버린 uid» 면 조건 없이 · «주인이 7일 조용» 이면 가져오던 것.
     둘 다 계정이 없던 시절(한 사람 = 기기마다 uid)의 장치였다. 지금 이 기기 코드의 주인이 내가 아니면 그 주인은
     **다른 계정**이다 — 가져가면 남의 아이디(코드 = 로그인 아이디)와 그 앞으로 온 친구 요청을 빼앗는다.
   남은 것: 내 것이면 끝 · 주인이 없으면(등록이 실패한 채 로컬에만 남은 코드) 선점 · 그 밖은 **그대로 두고 경고만**.
   ★ 로그인해 계정을 바꿀 때 코드는 _applyTransferSnapshot 이 계정 것으로 맞추고(스냅샷 · 거울 · 입력한 코드),
     부팅의 _friendCodeMirrorFix 가 한 번 더 맞춘다. 여기까지 떨어지는 것은 계정 이전 시절의 잔재뿐이다.
   친구 목록은 코드가 아니라 uid로 저장되므로, 코드 표시가 어긋나도 기존 친구관계는 끊기지 않는다. */
async function _healFriendCodeOwner(code){
  if(!(window.firebaseAPI && firebaseAPI.lookupFriendCode && firebaseAPI.registerFriendCode)) return;
  const myId = getMyUserId();
  let owner;
  try{ owner = await firebaseAPI.lookupFriendCode(code); }
  catch(e){ console.warn('[친추코드] 소유자 조회 실패 — 판단 보류', e); return; }   // 플래그 그대로(다음 기회에 재시도)
  _fcOwnerChecked = true;
  if(owner === myId) return;                    // 정상
  if(owner === null){
    // DB에 없는 코드(등록이 실패한 채 로컬에만 남은 경우) — 그대로 내 것으로 선점하면 된다
    try{ if(await firebaseAPI.registerFriendCode(code, myId)) return; }catch(_){}
  }
  /* 🔒 [2026-09-20 결정] **여기서 새 코드를 발급하지 않는다** — 처음 발급된 코드를 유지한다(제보 3-2 · 친구들이 적어 둔
     코드가 매번 죽는 쪽이 훨씬 큰 불편이다). 소유권도 손대지 않는다(개정 56 — 남의 계정 것이다). */
  _rememberOldFriendCode(code);   // 기록만 — F12 getOldFriendCodes() 진단용
  console.warn('[친추코드] ' + code + ' 의 소유자는 ' + owner + ' 이고 내 uid 는 ' + myId + ' — 코드는 그대로 둔다(재발급 안 함)');
}
/* 🔒 친추코드 재발급 금지의 근거를 검사가 잡을 수 있게 이름 붙인 결정. 되살리려면 이 상수만 볼 것이 아니라
   위 갈래 전체를 되살려야 한다 — 이 상수는 문서이지 스위치가 아니다. */
const FC_NEVER_REISSUE = true;
/* 🔗 [제거됨] 예전 친추 코드 되찾기 (reclaimMyFriendCode + 설정 UI)
   코드가 바뀌는 경로 자체를 없앴기 때문에 수동 되찾기가 할 일이 남지 않았다.
     · 로그인    → _applyTransferSnapshot 이 계정의 코드로 맞춘다(스냅샷 · 거울 · 입력한 코드 · 없으면 지우고 첫 발급 — 개정 56)
     · 주인 없음 → 그 자리에서 선점
     (개정 56: «버린 uid» 되찾기 · 7일 되찾기 · 로그인 직후 소유자 강제 정정은 걷었다 — 전부 남의 계정 것을 가져오는 길이다)
   ⚠️ 되살릴 일이 생기면 lastSeen 판정을 반드시 함께 되살릴 것. 그 판정 없이 코드 문자열만으로
     소유권을 넘기면 4자리를 찍어서 남의 코드와 친구 요청을 가져갈 수 있다.
   🔒 [2026-09-20] 그 마지막 경우에도 이제 **자동 재발급을 하지 않는다**(_healFriendCodeOwner 끝 주석).
     사용자가 직접 코드를 바꾸는 UI 는 이미 없고, 자동으로 바뀌는 길도 이것으로 사라졌다 —
     **로컬 코드를 지우는 자리는 로그아웃(ACCOUNT_LOCAL_KEYS)뿐**이다. */
const CHAR_SCALE_KEY = 'tw.focusCharScale';   // ★ 모니터별로 저장: {"<디스플레이id>": 배율, "sig:<가로>x<세로>": 배율, "default": 배율}
let _currentDisplayIdForScale = null;   // companion.getDisplays()로 비동기로 알아낸 뒤 채워짐
/* 🖥️ 해상도 지문 — 디스플레이 id의 대역이다.
   ⚠️ Electron의 display.id 는 재부팅·그래픽 드라이버 갱신·모니터 재연결로 **바뀐다.**
     그래서 id 하나만 열쇠로 쓰면, 저장은 됐는데 다음 부팅에 그 열쇠가 사라져 기본값으로 돌아간다
     ("최소로 줄여놨는데 매번 다시 커진다" 제보가 정확히 이것). 같은 자리에 같은 모니터가 있으면
     해상도는 그대로이므로, id가 어긋났을 때 이 지문으로 한 번 더 찾아본다.
   ★ 해상도가 같은 모니터가 둘이면 지문이 겹치지만, 그건 "다른 모니터의 크기를 물려받는" 정도의
     어긋남이다 — 매번 기본값으로 초기화되는 것보다 낫다. id가 맞으면 언제나 id가 이긴다. */
let _currentDisplaySigForScale = null;
function _scaleSigOf(display){
  const b = display && display.bounds;
  if(!b || !isFinite(b.width) || !isFinite(b.height)) return null;
  return 'sig:' + Math.round(b.width) + 'x' + Math.round(b.height);
}
function _loadCharScaleMap(){
  try{
    const raw = localStorage.getItem(CHAR_SCALE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) return parsed;
  }catch(e){}
  // 예전 버전엔 숫자 하나만 그대로 저장했었음(JSON.parse가 실패하거나 객체가 아니면 이 경로) — "default"로 이전
  try{
    const v = parseFloat(localStorage.getItem(CHAR_SCALE_KEY));
    if(isFinite(v) && v>0) return { default: v };
  }catch(e){}
  return {};
}
let _charScaleMap = _loadCharScaleMap();
function _loadCharPos(){
  try{
    const raw = localStorage.getItem(CHAR_POS_KEY);
    if(raw){ const d=JSON.parse(raw); if(typeof d.x==='number' && typeof d.y==='number') return d; }
  }catch(e){}
  return {x:0, y:0};
}
function _loadCharScale(){
  const ok = v => (typeof v==='number' && isFinite(v) && v>0) ? v : null;
  // id → 해상도 지문 → default. 부팅 직후엔 앞의 둘이 아직 null이라 default가 쓰인다.
  const byId  = (_currentDisplayIdForScale!=null) ? ok(_charScaleMap[String(_currentDisplayIdForScale)]) : null;
  if(byId!=null) return byId;
  const bySig = (_currentDisplaySigForScale!=null) ? ok(_charScaleMap[_currentDisplaySigForScale]) : null;
  if(bySig!=null) return bySig;
  return ok(_charScaleMap.default) != null ? _charScaleMap.default : 1;
}
function saveCharPos(){ try{ localStorage.setItem(CHAR_POS_KEY, JSON.stringify({x:deskPanX,y:deskPanY})); }catch(e){} }
function saveCharScale(){
  // ★ 모니터를 바꿀 때마다 다시 조정해야 하던 문제 — 현재 모니터 id로 따로 저장해서 그 모니터로
  //   돌아오면 그때 맞춰둔 크기가 복원된다.
  /* ★ 세 곳에 같이 쓴다. id 하나만 쓰면 그 id가 바뀌는 순간(재부팅 등) 저장값이 통째로 미아가 된다.
       · <id>   — 이 모니터. 가장 정확하다
       · sig:WxH — id가 어긋났을 때의 대역
       · default — 위 둘이 다 빗나갔을 때. 부팅 직후 id를 알기 전에도 이 값이 먼저 적용된다
     default 는 "마지막으로 맞춰둔 크기"라, 최악의 경우에도 기본값 1이 아니라 그 값으로 떨어진다. */
  const val = focusCharScale;
  if(_currentDisplayIdForScale!=null) _charScaleMap[String(_currentDisplayIdForScale)] = val;
  if(_currentDisplaySigForScale!=null) _charScaleMap[_currentDisplaySigForScale] = val;
  _charScaleMap.default = val;
  try{ localStorage.setItem(CHAR_SCALE_KEY, JSON.stringify(_charScaleMap)); }catch(e){}
}
// 현재 어느 모니터에 떠 있는지 비동기로 확인해서, 그 모니터 전용 저장값이 있으면 focusCharScale에 반영.
// main.js 쪽에서 이미 모니터 이동/복원을 처리하고 나면 호출하면 됨 — 여러 번 호출해도 안전(멱등).
async function refreshCharScaleForCurrentDisplay(){
  if(!window.companion || !companion.getDisplays) return;
  try{
    const displays = await companion.getDisplays();
    const cur = displays.find(d=>d.isCurrent);
    if(!cur) return;
    _currentDisplayIdForScale = cur.id;
    _currentDisplaySigForScale = _scaleSigOf(cur);
    const restored = _loadCharScale();
    /* 지금 값이 어느 열쇠에도 안 적혀 있으면(옛 저장이 id 하나만 갖고 있던 경우) 지금 값으로 채워 둔다.
       이렇게 해야 다음 부팅에 id가 또 바뀌어도 지문·default 로 이어받는다. */
    if(restored !== focusCharScale){
      focusCharScale = restored;
      layoutSeats();   // 즉시 화면에 반영
      // ⚠️ 예전엔 존재하지 않는 'sizeSlider'를 찾고 있었다(HTML에는 fsSizeSlider뿐) — 조용히 아무 일도 안 했다.
      const _slider=document.getElementById('fsSizeSlider'); if(_slider) _slider.value=String(focusCharScale);
      if(typeof renderSizeBar==='function') renderSizeBar();
    }
    saveCharScale();   // 열쇠 세 개(id·지문·default)를 지금 값으로 맞춰 둔다
  }catch(e){}
}
/* 데스크톱 run 모드에서 사용자가 상태칩을 끌어 옮긴 만큼의 캐릭터 위치 오프셋 (뷰 비율 단위, 0~1 근사) */
const _savedPos = _loadCharPos();
let deskPanX=_savedPos.x, deskPanY=_savedPos.y;   // "프로그램 이동"으로 사용자가 옮긴 위치 — 뷰 비율(fraction) 기준, 크기 변경에도 안 틀어짐 (localStorage에서 복원)
// ★ "프로그램 이동" 안전 범위 계산 — 기본 오프셋(-0.34, 0.28) 기준. 멀티모드에서 인원이 늘어날수록
//   책상 줄이 화면에서 차지하는 비중이 커져서, 같은 팬 값이라도 화면 밖으로 밀려나기 쉬워짐.
//   그래서 좌석 수(n)에 비례해서 안전 여백(PAN_MARGIN)을 더 크게(=팬 가능 범위를 더 좁게) 잡음.
//   layoutSeats()에서 매번 재검증하므로, 친구가 들어와서 인원이 늘어나는 순간에도 자동으로 안전 범위 안으로 당겨짐.
/* 🐾 동물 캐릭터일 때 프로그램 이동 범위에 더해주는 여유(뷰 비율).
   아래 clampDeskPan의 -0.34(좌우)/0.28(위아래)는 '인간 크기 기준 여백'이라 40%인 동물에겐 과하다.
   풀어줘야 할 양 = 원래 여백 × (1 − ANIMAL_RUN_SCALE) — 임의 상수가 아니라 여기서 유도한 값이라
   화면 가장자리(천장·작업표시줄)에 딱 맞아떨어진다.
   ★ K는 미세조정용: 1.0=이론값, 키우면 더 나가고 줄이면 덜 나간다. 0이면 인간과 동일. */
/* ── 프로그램 이동 한계 조절값 ────────────────────────────────────────────
   아래 clampDeskPan의 기본식은 위/아래를 같은 상수(0.28)로 함께 움직여서, 한쪽을 맞추면 반대쪽이
   어긋난다. 방향별로 분리해 각각 조절할 수 있게 뺐다. 숫자를 키우면 그 방향으로 '더 멀리' 간다.
   ★ PAN_DOWN_TRIM 은 인간에게도 적용 — 아래로 갈 때 머리까지 가려진 뒤에야 멈추는 문제 보정.
     0이면 예전 그대로, 키울수록 더 일찍(위에서) 멈춘다. */
const PAN_DOWN_TRIM      = 0.05;  // ★ 아래쪽 한계를 위로 당기는 양(인간·동물 공통). 키우면 덜 내려간다.
const PAN_UP_EXTRA       = 0.05;  // ★ 위쪽 한계를 더 올려주는 양(인간·동물 공통). 키우면 더 올라간다.
/* ↑ 두 값은 '실측 여백(_myPanHalfFrac) 위에 얹는 취향 조정'이다.
   예전엔 여백이 고정 상수라 화면·캐릭터 크기가 바뀌면 어긋났고, 그 오차를 이런 값들로 덧대다 보니
   한 해상도에 맞추면 다른 해상도에서 다시 틀어졌다. 지금은 여백이 자동으로 맞으므로
   이 값들은 순수하게 '얼마나 여유를 둘지'만 정한다(비율이라 해상도가 바뀌어도 유지됨). */
const ANIMAL_PAN_UP_K    = 0;      // ★ 동물이 위로 더 갈 수 있는 여유 배수 (0이면 인간과 동일)
                                   //   ★ 여백 실측(_myPanHalfFrac) 도입으로 0으로 정리 — 동물이 작다는 사실이
                                   //     이미 실측 여백에 반영되므로, 여기서 또 넓히면 천장 밖으로 나간다.
const ANIMAL_PAN_DOWN_K  = 0;     // ★ 동물이 아래로 더 갈 수 있는 여유 배수 (기본 0 — 아래는 안 넓힘)
const ANIMAL_PAN_SIDE_K  = 0.0;   // ★ 동물 좌우 여유 배수
const ANIMAL_PAN_EXTRA_K = 1.0;   // (구) 전체 배수 — 위 세 개에 함께 곱해짐
/* ★ ANIMAL_RUN_SCALE은 이 지점보다 아래(740행대)에서 const로 선언된다.
   여기서 top-level로 계산하면 TDZ ReferenceError가 나면서 app.js 전체가 죽는다(실제로 그렇게 터졌음).
   그래서 값을 미리 굳히지 않고, 실행 시점에 계산하는 함수로 둔다. */
function _animalPanExtra(){
  const r = (typeof ANIMAL_RUN_SCALE === 'number') ? ANIMAL_RUN_SCALE : 0.4;
  const k = ANIMAL_PAN_EXTRA_K;
  return { x:  0.34 * (1 - r) * k * ANIMAL_PAN_SIDE_K,
           up: 0.28 * (1 - r) * k * ANIMAL_PAN_UP_K,
           dn: 0.28 * (1 - r) * k * ANIMAL_PAN_DOWN_K };
}
/* 내 캐릭터(+책상)가 화면에서 차지하는 '절반 크기'를 뷰 비율(0~0.5)로 실측한다.
   ★ 이동 한계의 여백은 원래 이 값이어야 한다. 예전엔 0.02 같은 고정 상수라서
     화면 해상도·캐릭터 크기가 바뀌면 실제 절반 크기와 어긋나 화면 밖으로 삐져나갔다
     (한 해상도에 맞춰 상수를 고쳐도 다른 크기에서 다시 틀어지던 원인).
     실측하면 어떤 화면·어떤 크기·인간이든 동물이든 자동으로 맞는다. */
function _myPanHalfFrac(){
  try{
    const me = (typeof seats!=='undefined') && seats.find(s=>s.isMe);
    if(!me || !me.group || !_cvEl) return null;
    const cr = _cvEl.getBoundingClientRect();
    if(!cr.width || !cr.height) return null;
    // ★ Box3.setFromObject는 '숨겨진 메시'도 포함한다(r128). 동물 좌석에는 인간 크기의 숨은
    //   placeholder가 남아 있어서, 그대로 재면 박스가 실제보다 크고 위아래로 비대칭이 된다
    //   (동물만 바닥이 더 가라앉던 원인). 보이는 메시만 골라서 잰다.
    const box = new THREE.Box3(); const _tb = new THREE.Box3();
    me.group.traverse(o=>{
      if(!o.isMesh || o.visible === false) return;
      let p=o, hidden=false;
      while(p && p!==me.group){ if(p.visible===false){ hidden=true; break; } p=p.parent; }
      if(hidden) return;
      try{ _tb.setFromObject(o); if(!_tb.isEmpty()) box.union(_tb); }catch(_){}
    });
    if(box.isEmpty()) return null;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const v=new THREE.Vector3();
    for(let i=0;i<8;i++){
      v.set((i&1)?box.max.x:box.min.x,(i&2)?box.max.y:box.min.y,(i&4)?box.max.z:box.min.z).project(camera);
      const px=(v.x*0.5+0.5)*cr.width, py=(-v.y*0.5+0.5)*cr.height;
      if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
    }
    const hx = ((x1-x0)/2)/cr.width, hy = ((y1-y0)/2)/cr.height;
    if(!isFinite(hx)||!isFinite(hy)||hx<=0||hy<=0||hx>0.5||hy>0.5) return null;
    return { x:hx, y:hy };
  }catch(_){ return null; }
}
function clampDeskPan(px, py){
  const _hf = _myPanHalfFrac();
  // ★ 버그 수정("여럿일 때 바닥 위에서 일찍 막힘"): 실측 여백(_myPanHalfFrac)은 _cvEl 스코프 문제로
  //   항상 null이라 실제로는 늘 이 폴백이 쓰인다. 예전 폴백은 0.02+0.02*(n-1)로 좌석 수에 비례해
  //   커져서, 친구가 들어올수록 이동 여백이 넓어져(=이동 가능 범위가 좁아져) 바닥·천장·옆에서 일찍
  //   막혔다(혼자면 n=1이라 0.02로 정상). 인원수 가산을 제거해 여럿일 때도 혼자와 동일한 여백을 쓴다.
  //   (각 좌석 간격/카메라 줌아웃은 layoutSeats가 이미 처리하므로 여기서 n을 또 반영할 필요가 없다.)
  const PAN_MARGIN_FALLBACK = 0.02;
  const PAN_MARGIN   = _hf ? _hf.x : PAN_MARGIN_FALLBACK;   // 좌우 여백 = 실제 반폭
  const PAN_MARGIN_Y = _hf ? _hf.y : PAN_MARGIN_FALLBACK;   // 위아래 여백 = 실제 반높이
  // ★ 세로 모니터(높이가 폭보다 큰 경우)는 화면에서 위아래로 이동할 수 있는 실제 여유 공간이 훨씬 많은데도
  //   가로 모니터와 똑같은 비율 범위를 쓰고 있어서 위아래 이동이 부자연스럽게 일찍 막히는 문제가 있었음 —
  //   세로 화면일 때는 위아래 범위를 더 넉넉하게 넓힘(가로 이동 범위는 그대로).
  const isPortrait = innerHeight > innerWidth;
  const yExtra = isPortrait ? 0.25 : 0;
  // 🐾 동물은 40% 크기라 화면에서 차지하는 영역이 훨씬 작은데, 아래 -0.34 / 0.28은 인간 크기를 가정한
  //   뷰 비율 상수여서 실제보다 큰 영역으로 계산돼 이동이 일찍 막힌다.
  //   ★ 상수 자체를 줄이면 범위의 위·아래가 함께 이동해서 한쪽이 오히려 좁아진다(실제로 그렇게 실패함).
  //     그래서 세로 모니터용 yExtra와 똑같이 '범위를 양쪽으로 넓히는' 방식을 쓴다 — 부호와 무관하게 확실하고,
  //     이미 검증된 선례라 안전하다. 가로 이동도 같은 이유로 넓힌다.
  let _panEX = 0, _panEUp = 0, _panEDn = 0;
  try{ const _me = seats.find(s=>s.isMe);
       if(_me && _me.charDef && _me.charDef.animal){ const _e=_animalPanExtra(); _panEX=_e.x; _panEUp=_e.up; _panEDn=_e.dn; } }catch(_){}
  //   ★ 실측 결과 nyMax 쪽이 '아래' 방향이었다 — 양쪽을 함께 넓혔더니 아래로만 자유로워져서
  //     작업표시줄 밑으로 빠져나갔다. 그래서 아래(nyMax)는 원래대로 두고 위(nyMin)만 넓힌다.
  const nxMin = -0.5 + PAN_MARGIN - (-0.34) - _panEX;
  const nxMax =  0.5 - PAN_MARGIN - (-0.34) + _panEX;
  const nyMin = -0.5 + PAN_MARGIN_Y - 0.28 - yExtra - _panEUp - PAN_UP_EXTRA;     // 위쪽 한계
  const nyMax =  0.5 - PAN_MARGIN_Y - 0.28 + yExtra + _panEDn - PAN_DOWN_TRIM;    // 아래쪽 한계
  return { x: Math.max(nxMin, Math.min(nxMax, px)), y: Math.max(nyMin, Math.min(nyMax, py)) };
}
let _deskViewH=0, _deskCanvasH=1;   // 이동 중 픽셀↔월드 정확한 변환을 위해 layoutSeats가 매 프레임 갱신
/* 설정 패널의 "캐릭터 크기" 슬라이더 값 — 데스크톱 run 모드 전용 배율 (localStorage에서 복원) */
let focusCharScale=_loadCharScale();
let dotRenderEnabled = (localStorage.getItem('tw.dotRender')==='1');   // 기본 꺼짐
const DOT_RENDER_SCALE = 0.45;   // 저해상도(도트) 렌더 배율 — 작을수록 거친 도트. 0.45=PS1급 도트감. 0.55=은은, 0.35=더 거침.
// ★ 좌석 i의 책상 "반쪽 폭"을 실측(월드 기준, deskScale 등 모든 스케일 반영) — 상대방이 책상 크기를
//   키우거나 줄여도 여기서 정확히 잡아내서, layoutSeats가 항상 일정한 여백을 유지할 수 있게 함.
//   ★ deskAnchor(꾸며놓은 책상 아이템들이 붙는 자리)는 반드시 제외 — 안 그러면 아이템 크기(ITEM_TARGET_SIZE)를
//   키웠을 때 "책상 폭"이 실제보다 훨씬 크게 측정돼서 카메라가 필요 이상으로 멀리 물러나 보이는 문제가 있었음.
const DESK_HALFWIDTH_CAP_FOR_ZOOM = 1.1;   // 카메라 줌 계산에만 적용되는 상한선 — 유난히 큰 책상 하나 때문에
                                            // 전체 화면이 과하게 줌아웃되는 것 방지(좌석 간 여백 자체는 이 상한 영향 안 받음)
function seatDeskHalfWidth(seat, forZoom){
  if(!seat || !seat.desk) return 0.85;   // 책상이 아직 없으면(초기화 중 등) 기본 책상 폭(1.7)의 절반으로 대체
  /* ⚠️ updateMatrixWorld(true) 가 아니라 **updateWorldMatrix(true, true)** 여야 한다.
       앞엣것은 조상(seat.group)의 matrixWorld 를 '캐시된 그대로' 곱해 쓴다. 그런데 fitModel 은
       측정을 위해 group.position 을 0 으로 옮겼다가 값만 되돌리고 matrixWorld 는 그대로 두므로,
       fitModel 직후에는 그 캐시가 **x=0 시절의 행렬**이다. 그 상태로 재면 박스는 원점 근처(±0.85)에
       잡히는데 아래 cx 는 진짜 좌표(예 -3.5)라, reach 가 4.35 로 부풀어 좌석 간격이 통째로 벌어진다.
       (평준화를 켜면 syncSeatEqualize 가 좌석마다 fitModel 을 부르고 그 자리에서 여기로 오므로
        전 좌석이 한꺼번에 이 값을 낸다 — "켜면 간격이 굉장히 넓어졌다가 나중에 원래대로 돌아온다"의
        정체다. 돌아오는 이유는 그 사이 렌더 프레임이 matrixWorld 를 바로잡기 때문이다.)
     ★ 측정 함수는 남이 남긴 상태에 기대지 않는다 — 조상부터 자손까지 여기서 직접 세운다. */
  seat.desk.updateWorldMatrix(true, true);
  const box = new THREE.Box3(); let any=false;
  seat.desk.children.forEach(ch=>{
    if(ch.name==='deskAnchor' || ch.visible===false) return;   // 책상 위 아이템은 폭 계산에서 제외 — 책상 자체만 봄
    const b=new THREE.Box3().setFromObject(ch);
    if(!b.isEmpty()){ box.union(b); any=true; }
  });
  if(!any) return 0.85;
  const size = box.getSize(new THREE.Vector3());
  /* ★ '폭의 절반'이 아니라 '좌석 중심에서 가장 멀리 뻗은 쪽까지'를 쓴다.
     [경위] 책상 위치(deskPos)를 옮길 수 있게 되면서 책상이 좌석 중심에서 좌우로 치우칠 수 있다.
       size.x/2 는 치우쳐도 값이 그대로라(박스가 통째로 옮겨질 뿐) 옆 좌석과 겹쳐도 layoutSeats 가
       모르는 채 지나간다. 중심에서의 거리로 재면 치우친 만큼 간격이 자동으로 벌어진다.
     ★ 안 옮긴 책상(대칭)에서는 두 값이 같다 = 기존 사용자에겐 회귀가 없다. */
  const cx = (seat.group ? seat.group.position.x : 0);
  const reach = Math.max(Math.abs(box.max.x - cx), Math.abs(box.min.x - cx), size.x / 2);
  const half = Math.max(reach, 0.15);   // 너무 작은 값으로 다닥다닥 붙는 것 방지
  return forZoom ? Math.min(half, DESK_HALFWIDTH_CAP_FOR_ZOOM) : half;
}
// 마지막으로 계산된 좌석 배치 결과 캐시 — 좌석 수/책상 크기가 안 바뀌었으면(예: 캐릭터 크기 슬라이더만
//움직일 때) 이 값을 재사용해서 무거운 책상 실측(Box3)을 매번 다시 안 해도 되게 함.
let _cachedRowCenter = 0, _cachedRowSpan = 1.2;
const ANIMAL_RUN_SCALE = 0.4;      // 🐾 동물 실행화면 크기 = 인간의 40%. 캐릭터(fitModel)와 책상(setDeskScale의 animCorr)에 함께 적용됨.
// ★ animal.js도 이 값을 써야 함(정규화 높이) — 예전엔 animal.js가 자체 기본값 0.6을 들고 있어서 값이 두 곳에
//   갈라져 있었음. 여기서 window로 노출해 "한 곳에서만 관리"되게 한다. (app.js가 animal.js보다 먼저 로드됨)
try{ window.ANIMAL_RUN_SCALE = ANIMAL_RUN_SCALE; }catch(_){}
/* ═══ 🪑 좌석 크기 평준화 — 배율(k)을 정하는 곳은 여기 하나다 ═══════════════════
   내 화면에서만 남의 좌석을 내 캐릭터 크기에 맞춘다. 서버에는 아무것도 안 쓴다 —
   `seat.userScale`(저장값)은 절대 건드리지 않고, 읽는 쪽이 seatScale() 을 지나게 한다.
   ⚠️ userScale 자체를 덮어쓰지 말 것. 생성기 UI·saveSeatXf 가 같은 필드를 보고 있어서
     내 화면의 표시 배율이 상대의 저장값으로 흘러 들어가고, applyCharToSeat 가 def 를 다시
     얹는 순간 평준화가 조용히 풀린다.

   ★ 방식은 'C' — **좌석 전체에 배율 하나**를 곱한다(캐릭터 · 책상 · 라벨 높이가 전부 이 k 를 지난다).
     k = 내 캐릭터 크기 ÷ 그 좌석의 캐릭터 크기.
     그래서 캐릭터 크기는 전부 내 크기로 통일되고, 각자가 맞춰둔 **캐릭터↔책상 비율은 그대로** 남는다.
     맞바꾼 것: 캐릭터를 크게·책상을 작게 맞춰둔 사람은 책상이 내 것보다 작아진다.
       "책상 줄까지 맞추기"(B안)로 바꾸고 싶으면 이 함수 하나만 고치면 된다 —
       캐릭터엔 내 userScale, 책상엔 내 deskScale 을 각각 밀어 넣는 형태가 된다.

   ★ 🐾 동물 40%(ANIMAL_RUN_SCALE)는 **여기에 안 들어간다.** 40% 는 fitModel 의 baseScale 과
     setDeskScale 의 animCorr 에 있는 별개의 곱셈이고, 평준화가 갈아끼우는 것은 사람이 정한
     크기(userScale)뿐이다. 그래서 평준화를 켜도 동물은 여전히 사람의 40% 로 남는다. */
let seatEqualizeOn = false;
try{ seatEqualizeOn = (localStorage.getItem('tw.seatEq') === '1'); }catch(_){}   // 기본 끄기(들쑥날쑥한 것도 재미)
let roomSeatMode = window.TwSeatPin ? TwSeatPin.loadMode(localStorage) : 'row';   // 🪑 방에서 내 자리 — 줄 안에 함께 · 맨 오른쪽 고정(seat-pin.js)
/* 🎁 꾸미기 파츠 표시 — [2026-09-17 요청] 끄면 **내 화면에서만**, 나 포함 모든 좌석의 꾸미기 파츠(파츠 보관함의 가챠 파츠)가
   안 보인다. 서버에는 아무것도 안 쓴다(좌석 크기 평준화와 같은 «내 화면 전용» 설정).
   · 대상: 캐릭터에 붙는 파츠 wrapper(`__twPartWrap`) 전부 — 일반·겹치기·다중 인스턴스. **책상 위(bone:'desk') 카테고리는 제외** — 책상 설정의
     책상 아이템은 그대로 둔다(요청 범위).
   · 방법: wrapper.visible 만 내린다. 메시는 안 건드리므로 setSeatOpacity(_prevVisible)와 안 섞이고, 파츠 애니·스티커사진
     키 계산(wrapper 가 남아 있음)도 그대로다. 끄면 파츠가 숨기던 기본 메시(모자→머리카락 등)는 applyClothVisibility 가
     «파츠 없음» 으로 계산해 되돌린다 — 안 그러면 모자만 사라진 대머리가 된다. */
let decoPartsVisible = true;
try{ decoPartsVisible = (localStorage.getItem('tw.decoParts') !== '0'); }catch(_){}   // 기본 켜기
function _decoWrapperShow(cat){
  if(decoPartsVisible) return true;
  const info = premiumMod.PART_CATS() ? premiumMod.PART_CATS().find(c => c.cat === cat) : null;
  return premiumMod.isDeskPartCat(info);   // 책상 위는 항상 보인다
}
function applyDecoPartsVisibility(seat){
  if(!seat || !seat.group) return;
  try{
    seat.group.traverse(o => {
      if(!(o.userData && o.userData.__twPartWrap)) return;
      o.visible = _decoWrapperShow(o.userData.cat);
    });
  }catch(_){}
}
function seatEqK(seat){
  if(!seatEqualizeOn || !seat || seat.isMe) return 1;
  /* ⚠️ 기준은 **내 주 좌석**이다. 자리추가(isExtra) 좌석도 맞추는 대상에 넣는다 —
     남만 맞추고 내 부캐가 들쑥날쑥하면 화면은 여전히 가지런하지 않다.
     원격만 맞추고 싶으면 위 조건에 `|| seat.isExtra` 를 더하면 된다(여기 한 줄). */
  const me = findMySeat();
  if(!me || me === seat) return 1;
  const mine = (isFinite(me.userScale)   && me.userScale   > 0) ? me.userScale   : 1;
  const his  = (isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  const k = mine / his;
  return (isFinite(k) && k > 0) ? k : 1;
}
/* 좌석의 **실효 크기** — 3D·라벨 쪽에서 "좌석 크기"가 필요하면 예외 없이 이걸 부른다.
   ⚠️ 저장·생성기 UI(sScale 입력, saveSeatXf, def 로드)는 반대로 **raw seat.userScale** 을 써야 한다.
     그쪽까지 실효값으로 바꾸면 내 화면의 표시 배율이 저장값이 된다. */
function seatScale(seat){
  const s = (seat && isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  return s * seatEqK(seat);
}
/* 🧍 캐릭터 높이가 **월드에서 실제로 들어 올리는 양**.
   fitModel 이 m.position.y 에 userY × _animPos ÷ raw userScale 을 넣고, 그 위에 bodyWrap.scale(=seatScale)이
   곱해진다 → 월드 값 = userY × _animPos × (seatScale ÷ raw userScale) = userY × _animPos × 평준화 k.
   ★ 필요한 곳은 '월드 y 를 직접 계산해서 좌석을 놓는' 자리다 — 지금은 올라타기(_positionRideSeat) 뿐이다.
     그 함수는 대상 머리 위 좌표를 seat.group.position 에 직접 쓰는데, 모델은 그 group 안에서 이 양만큼
     더 들려 있다. 빼주지 않으면 높이를 올려둔 캐릭터가 그만큼 머리 위에서 떠 보인다.
   🐾 **_animPos 는 fitModel 과 반드시 같아야 한다.** 한쪽만 바꾸면 동물 머리 위에 올라탄 캐릭터가
     그 차이(2.5배)만큼 뜨거나 파고든다. 두 줄은 항상 함께 고칠 것.
   ⚠️ bodyWrap.scale 은 매 프레임 호흡(breathe)으로 흔들리므로 그 값을 읽지 말고 seatScale 을 쓴다. */
function charLiftWorld(seat){
  if(!seat) return 0;
  const raw = (seat.userScale && isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  const animPos = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
  return clampCharY(seat.userY) * animPos * ((seatScale(seat) || 1) / raw);
}
/* 배율이 바뀐 좌석만 다시 적용한다. layoutSeats 앞에서 부르므로 자주 불리지만,
   k 가 그대로면 숫자 비교 몇 번으로 끝난다(fitModel 은 바뀐 좌석에만 돈다). */
let _eqSyncing = false;
function syncSeatEqualize(){
  if(_eqSyncing) return;
  _eqSyncing = true;
  try{
    seats.forEach(seat=>{
      const k = seatEqK(seat);
      if(seat._eqK === k) return;
      seat._eqK = k;
      /* 책상은 setDeskScale 이 userData 의 곱셈들(animCorr · eqK)을 모아서 건다 —
         호출부가 다섯 곳이라 거기에 직접 곱하면 반드시 한 곳이 빠진다(animCorr 이 그래서 여기 있다). */
      if(seat.desk){
        seat.desk.userData.eqK = k;
        /* ⚠️ deskScaleBase 가 없으면 그건 **아직 모르는 값**이지 1 이 아니다.
             createSeat 은 책상을 만들기만 하고 setDeskScale 을 부르지 않으므로, def 가 아직 안
             얹힌 좌석에는 이 값이 없다. 그 상태로 넘기면 setDeskScale 이 1 로 읽어
             deskScale 0.3 인 사람의 책상이 3배가 되고, 바로 아래 layoutSeats 가 그 폭을 실측해
             좌석 간격을 벌린다. 그 뒤 applyCharToSeat 이 def.deskScale 로 다시 걸면 폭이 돌아온다 —
             "켜면 간격이 넓어지고 프로그램을 이동하면 원래대로 복귀"의 정체가 이것이다.
           ★ 없을 때는 **책상을 건드리지 않고 eqK 만 심어둔다.** 다음번 정상 호출이
             그때 아는 값으로 이 배율까지 같이 건다(setDeskScale 이 userData.eqK 를 읽으므로). */
        const _base = seat.desk.userData.deskScaleBase;
        if(_base != null) setDeskScale(seat.desk, _base, seat.desk.userData.deskLenX);
        /* 옮겨둔 책상은 위치 오프셋도 같은 k 를 지난다(setDeskPos 주석 참고).
           안 옮긴 책상은 base 가 0,0,0 이라 곱해도 0 — 기존 사용자에겐 아무 변화가 없다. */
        const _pb = seat.desk.userData.deskPosBase;
        if(_pb) setDeskPos(seat.desk, _pb);
        /* 🐾 앞뒤 보정은 **조건 없이** 다시 건다.
           ⚠️ 바로 위 줄은 deskPosBase 가 있는 좌석에서만 돈다 — 그건 **책상을 옮겨본 적 있는
             사람**뿐이고, 대부분의 유저는 거기 해당하지 않는다. 그런데 보정항 CHAR_Z·(1−a·k) 는
             책상을 옮겼는지와 무관하게 k 가 바뀌면 반드시 달라진다. 위 줄만 믿으면
             "책상을 한 번도 안 옮긴 좌석"은 평준화를 켜도 발선이 계속 갈린다. */
        syncSeatDeskZ(seat.desk);
      }
      if(seat.bodyWrap) fitModel(seat);   // 캐릭터·앵커 높이 재적용
    });
  }catch(_){}
  _eqSyncing = false;
}
// 🐾 동물 전용 팔 기본각 — 동물 GLB의 hand 본 rest 자세가 인간과 달라 인간의 HAND_REST를 그대로 쓰면 팔이 뜬다.
//   ★ 팔 높이 조정은 이 숫자 하나만 바꾸면 됨: 양수 쪽(예 -0.2)으로 갈수록 내려가고, 음수 쪽(예 -0.8)일수록 올라간다.
//   ★ 실행화면(animateRig) · 런처 미리보기(applyStaticHandRest) · 동물 생성기(animal.js applyArmRest)가
//     모두 이 값을 읽는다 — 여기만 고치면 세 곳이 함께 바뀜.
const ANIMAL_HAND_REST = -0.4;
try{ window.ANIMAL_HAND_REST = ANIMAL_HAND_REST; }catch(_){}
/* 🐾 올라타기 오프셋 — 기준점은 대상의 '머리 본'(실측상 머리 꼭대기가 아니라 목 위치, 인간 GLB: spine 기준 y=0.905).
   ★ 앵커는 동물의 '발'이 아니라 '팔'이다.
     예전엔 발 위치를 고정했는데, 동물은 얼굴 크기(animalScl)를 키우면 normalizeModel이 전체 높이를 0.56에
     맞추려고 모델을 통째로 줄여버려서 팔이 같이 내려간다 → 사람 머리에 파묻혔다.
     그래서 반대로 '팔이 오는 높이'를 고정하고 발 위치를 역산한다:
         발 = 머리본 + (대상 머리꼭대기 + RIDE_ARM_SINK) − 팔높이(정규화, 좌석크기 무관)
     팔높이(_rideArmH)는 올라탈 때 1회 실측해 캐싱하므로 얼굴/좌석 크기가 뭐든 팔 높이가 유지된다.
     이 방식이 크기 보정을 수식에 내장하므로 예전 RIDE_ANIMAL_SIZE_K / RIDE_ANIMAL_REF_SCALE는 불필요해져 제거함. */
const RIDE_ARM_SIZE_FOLLOW = 1.0;  // ★ 동물 '좌석 크기'를 얹힘 높이에 얼마나 반영할지(0~1).
                                   //   armH는 '크기 1' 기준으로 정규화된 값이라, 실제 팔의 월드 높이는 armH×좌석크기다.
                                   //   따라서 발 위치를 역산할 때도 armH×좌석크기를 빼야 팔이 머리 꼭대기에 정확히 온다
                                   //   → 기하학적으로 1.0이 정답. (0.7일 땐 크기를 줄인 동물이 살짝 가라앉아 보였음 — 실측 확인)
                                   //   ★ 얼굴 크기(animalScl) 보정은 armH 자체에 이미 들어 있어 이 값과 무관하게 항상 작동한다.
                                   //   0으로 두면 좌석을 줄일수록 파묻히고, 1보다 크면 뜬다. 미세조정 시 이 값만 만지면 됨.
/* ★★ 아래 sink 세 상수(RIDE_ARM_SINK · RIDE_ARM_SINK_ON_ANIMAL · CIRCUS_FOOT_SINK)는 전부
   **대상 크기 1 기준값**이며, 실제 적용 시 `× 대상 userScale` 된다.
   [경위] 예전엔 절대 상수라 좌석 크기를 줄이면 이 값만 상대적으로 커져 위 캐릭터가 떴다
     (실측: hostScale 0.42, 머리 높이 0.2682, sink 0.05 → 떠 보이는 양 0.0635의 대부분이 sink였다).
     _rideHeadTop도 _armW도 월드 실측값이라 크기에 비례하는데 sink만 안 따라간 것이 원인이다.
   ⚠️ 여기 숫자를 만질 때는 항상 '크기 1에서 보이는 모습'으로 판단할 것. 작은 크기에서 맞춘 값을
     여기 박으면 크기 1이 반대로 어긋난다. */
const RIDE_ARM_SINK      = 0.09;   // ★ 팔을 대상 '머리 꼭대기'에 얹는 기준에서의 미세조정(인간 대상, 크기 1 기준).
/* ↑ [재보정 ①] 0.05 → 0.075. 제보: "인간 머리 위 1층에서 동물이 조금 파고든다".
     팔높이(_armW)는 동물 자신의 월드 실측이고 머리꼭대기(_headTopForArm)도 실측이라 둘은 정확한데,
     그 둘을 이어 붙일 때 '팔이 머리 표면에 살짝 눌리는' 양이 부족했다 —
     머리 꼭대기는 박스 최고점(정수리 한 점)이고 팔이 닿는 자리는 그보다 낮은 곡면이라,
     정확히 0으로 맞추면 시각적으로는 이미 묻힌 상태가 된다.
   [재보정 ②] 0.075 → 0.09. 제보: "나쁘진 않은데 아주 조금 더 올라오면 좋겠다".
     ①의 폭(+0.025)이 실제로 옮긴 양은 로그의 hostScale 0.4 기준 +0.010 이었고 그게 '파고듦→괜찮음'을
     만들었다. 그래서 그 절반 정도(+0.015 → 실효 +0.006)만 더 올린다. 머리 높이 0.2944 의 약 2% 다.
   ⚠️ 이 숫자는 **크기 1 기준**이고 적용 시 `× 대상 userScale` 된다. 로그처럼 hostScale=0.4 면
     체감은 2.5분의 1로 줄어든다 — "왜 0.015나 올렸는데 티가 안 나지"의 답이 여기다.
     반대로 크기를 안 줄인 사용자에게는 0.015가 그대로 실효값이라, 한 번에 크게 올리면 그쪽이 뜬다.
   ⚠️ 2층+(묘기)는 CIRCUS_FOOT_SINK 가 따로 담당한다 — 그쪽은 손대지 않았다(제보 대상이 1층이므로). */
/* ★ 대상이 '동물'일 때 쓰는 별도 보정값.
   동물은 몸의 대부분이 머리라, 팔 높이가 전체 높이의 38%(실측 armH 0.2235 / 전체 0.58) 지점이다.
   팔을 대상 머리 꼭대기에 맞추면 나머지 62%가 위로 솟아 떠 보인다.
   인간 대상은 머리가 크고 넓어 그 솟은 부분이 시각적으로 묻히지만, 동물 대상에선 그대로 드러난다.
   → 대상 종류에 따라 값을 나눠 각각 맞춘다. 음수일수록 더 깊이 파묻힌다. */
const RIDE_ARM_SINK_ON_ANIMAL = 0.04;   // (크기 1 기준 — 적용 시 × 대상 userScale)
/* ↑ ★ 1층에서 '동물 머리 위'에 얹힐 때의 높이 보정(음수=더 파묻힘, 양수=더 뜸).
   머리 꼭대기 측정이 measureHeadBoxNoParts(꾸미기 파츠 제외)로 바뀌면서 기준 높이가 낮아졌고,
   예전 값(-0.05)이 그대로면 파묻혀 보인다 — 그만큼 올려서 다시 맞춤. */
/* 🎪 서커스 묘기 — 2층 이상은 '팔을 걸치는' 대신 '발로 딛고 선다'.
   팔 기준(armH)은 동물마다 팔 위치가 달라 계속 어긋났는데, 발 기준은 대상 머리 꼭대기만 쓰므로
   얼굴 크기·좌석 크기·귀 유무와 무관하게 항상 맞는다. 앞뒤(Z)도 대상 머리 박스 중심을 실측해 자동 정렬.
   ★ 1층(인간 위)은 기존 '팔 걸치기' 그대로 — 이 상수들은 2층 이상에만 적용된다. */
const CIRCUS_MIN_DEPTH   = 2;      // 이 층수부터 묘기 자세 (1=인간 위 1층도 포함)
/* ★ 발이 대상 머리에 파묻히는 정도(값 키우면 내려감).
   [재보정 이력] 0.02 → 0.08로 키웠던 이유가 "2층+ 묘기가 떠 보여서"였는데, 그 '뜸'의 진짜 원인은
     measureHeadBoxNoParts가 숨겨진 메쉬까지 재서 _rideHeadTop이 실제보다 0.15~0.18 높게 나온 것이었다.
     측정을 고친 뒤에는 0.08이 그대로 남아 반대로 머리에 파묻힌다 → 원래 값 0.02로 되돌림. */
const CIRCUS_FOOT_SINK   = 0.02;   // (크기 1 기준 — 적용 시 × 대상 userScale)
const CIRCUS_ARM_SPREAD  = 1.15;   // ★ 균형 잡는 팔 벌림(라디안). 0이면 평소 자세.
const CIRCUS_ARM_DROP    = 0.45;   // ★ 벌린 팔을 아래로 내리는 양(라디안). 벌림 폭은 그대로 두고 높이만 조절.
                                   //   키우면 더 내려가고, 0이면 만세에 가까워진다.
const CIRCUS_SWAY_CALM   = 0.035;  // ★ 평소 흔들림 세기(라디안) — 은은하게.
const CIRCUS_SWAY_PANIC  = 0.22;   // ★ 와해 직전 흔들림 세기 — 눈에 띄게.
const CIRCUS_SWAY_SPEED  = 1.6;    // 흔들림 속도
const CIRCUS_PANIC_SLEEPERS = 1;   // ★ 이 인원 이상이 sleep이면 흔들리기 시작 → 와해
const CIRCUS_PANIC_MS    = 40000;  // ★ 흔들리다 무너지기까지 시간(ms). 이 안에 깨어나면 와해되지 않고 유지.
                                   //   10초는 자리를 잠깐 비운 사람이 손쓸 틈도 없이 무너져서 40초로 늘림.
/* 🎪 와해 직전 '부들부들' — 마지막 구간에서는 좌우 휘청임을 접고 제자리 잔떨림으로 바꾼다.
   큰 흔들림이 40초 내내 이어지면 눈이 피로하고, 무너지기 직전이라는 신호도 안 된다(계속 같은 폭이라서).
   TREMOR_AT은 '경과 비율'이라 PANIC_MS를 바꿔도 비례해서 따라온다 — 40초 × 0.75 = 30초부터. */
const CIRCUS_TREMOR_AT        = 0.75;   // 이 비율만큼 경과하면 잔떨림 구간 진입
const CIRCUS_TREMOR_CALMDOWN  = 0.85;   // 그 구간에서 좌우 휘청임을 얼마나 줄일지(1=거의 멈춤)
const CIRCUS_TREMOR_AMP       = 0.014;  // 잔떨림 폭(라디안) — 작게. 크면 떠는 게 아니라 또 흔들리는 것처럼 보인다
const CIRCUS_TREMOR_SPD       = 34;     // 잔떨림 속도. 휘청임(1.6)보다 훨씬 빨라야 '떤다'로 읽힌다
const CIRCUS_DIZZY_MS    = 2500;   // 무너진 뒤 어지러움 지속(기존 dizzy와 동일)
/* ★ 묘기 자세에서 대상과 정면을 어긋나게 하는 각도. 좌석마다 이 범위 안에서 랜덤으로 한 번 정해 고정하고,
   방향(+/-)도 따로 랜덤 — 층끼리 서로 다른 각도로 어긋나 보인다. 올라탈 때마다 다시 뽑는다.
   🚫 [현재 끔] CIRCUS_YAW_RANDOM = false 라 아래 두 값은 쓰이지 않는다 —
      탑 전체가 대상과 같은 방향(정면)을 본다. 랜덤 회전을 되살리려면 그 값만 true 로. */
const CIRCUS_YAW_MIN     = Math.PI/12;   // 15도
const CIRCUS_YAW_MAX     = Math.PI/4;    // 45도
/* 🎪 묘기 자세의 랜덤 Y축 회전을 쓸지 (요청: 끄고 전부 정면).
   ⚠️ 끄면 접지점 보정(CIRCUS_FOOT_CENTER)이 하는 일이 줄어들지만 **없어지지는 않는다.**
      한 다리로 서는 한 딛는 발은 여전히 몸 중심에서 좌우로 반걸음 떨어져 있고, 딛는 발이
      왼쪽이냐 오른쪽이냐(_circusStandLeft)도 여전히 랜덤이다. 회전이 없으니 그 반걸음이
      '랜덤한 방향으로 돌지' 않을 뿐, 좌우로 치우치는 것은 그대로다 — 보정은 켜 두는 게 맞다. */
const CIRCUS_YAW_RANDOM  = false;
/* ★ 앞뒤 미세조정(2층 이상). 양수=앞으로, 음수=뒤로. 0이면 실측 머리 중심 그대로.
   [재보정 이력] 예전 값 0.13은 measureHeadBoxNoParts가 '숨겨진 메쉬'까지 재던 시절에 맞춰진 값이다.
     그때는 박스가 실제보다 크고 중심이 뒤로 치우쳐서 앞으로 당겨줄 필요가 있었다.
     숨은 메쉬를 제외하도록 고친 뒤 headCenterZ가 실제 머리 중심(≈머리 본)으로 정확해졌고,
     0.13이 그대로 남으면 과보정이라 앞으로 튀어나온다 → 0으로 되돌리고 필요하면 여기서 다시 조정.
   ※ 부풀림 양은 좌석 크기에 비례해 달라지므로(월드 공간 측정) 애초에 상수로는 보정할 수 없었다. */
const CIRCUS_FOOT_Z      = 0;
/* 🦶 '발판'으로 볼 층의 두께 — 대상 박스 높이에 대한 비율. 이 층에 걸치는 메쉬만 골라
   앞뒤 중심을 다시 잡는다(_measureHostHeadTop 의 _headTopCenterZ 주석 참고).
   키우면 몸통까지 섞여 예전(몸 전체 중심)에 가까워지고, 줄이면 정수리 끝만 보다가
   메쉬 하나도 안 걸려 폴백될 수 있다. 0.2~0.3 사이가 안전하다. */
const CIRCUS_TOP_SLAB    = 0.25;
/* 🎩 머리 **중앙**에 있는 파츠 위에 얹기 — '중앙'으로 볼 여유(머리 꼭대기 폭에 대한 비율).
   [규칙] 파츠 박스가 머리 꼭대기 중심을 덮고, 그 덮는 여유가 좌우·앞뒤 **양쪽 다** 이 비율 이상일 것.
   [왜 '중심거리'가 아닌가] 중심거리 방식은 파츠가 얼마나 넓은지를 안 본다 — 정수리에 꽂힌 뿔이
     '중앙'으로 통과해 그 끝에 얹힌다. 덮기 방식은 폭이 좁은 파츠가 자동으로 걸러진다.
   [왜 비율인가] 절대값으로 잡으면 캐릭터·좌석 크기마다 판정이 달라진다.
   ★ 이 판정만으로는 부족하다 — 관리자가 파츠에 '얹을 수 있음'(rec.rideTop)을 켠 경우에만 본다.
     납작한지 뾰족한지를 자동으로 가르는 선은 실제로 잘 안 나온다(넓은 접시와 낮고 좁은 파츠가
     같은 높이÷넓이 값을 갖는다). 자동 판정은 파츠가 늘 때마다 예외가 생긴다.
   ⚠️ 0 으로 두면 '중심에 닿기만 하면 통과'가 된다 — 가장자리에 아슬아슬하게 걸친 파츠 위에 선다. */
const RIDE_PART_CENTER_MARGIN = 0.15;
/* 🦶 위 실측값을 쓸지. false 로 두면 예전처럼 몸 전체 박스 중심을 쓴다(되돌리기용 스위치). */
const CIRCUS_FOOT_Z_FROM_TOP = true;
/* 🦶 딛는 발을 대상 머리 한가운데에 맞춘다(요청 사양).
   [문제] 묘기 자세는 한 다리로 선다(_circusStandLeft). 그 다리는 좌석 원점에서 좌우로 반걸음
     떨어져 있는데, 좌석 원점만 머리 중심에 놓고 yaw(CIRCUS_YAW_*)를 랜덤으로 돌리므로
     **실제 접지점이 머리 중심을 반지름 삼아 랜덤한 방향으로 돈다.** 대상이 작을수록 머리라는
     발판 자체가 좁아서, 같은 반걸음이 머리 폭의 큰 비율이 되어 발이 가장자리·허공으로 나간다
     (제보: "좌석 크기가 최소화일수록 2층부터 위치가 애매하다").
   [해법] 딛는 다리의 좌석-로컬 오프셋을 올라탈 때 1회 재서, 최종 회전(yaw + 흔들림)까지
     반영해 그만큼 좌석을 역으로 민다. yaw 는 랜덤 그대로 두고 접지점만 고정된다.
   ⚠️ 반드시 **흔들림(rotateZ)까지 끝난 뒤** 적용해야 한다 — 회전이 더 붙으면 오프셋 방향이 달라진다.
   ⚠️ Y 는 건드리지 않는다. 높이는 CIRCUS_FOOT_SINK 담당이고, 여기서 같이 만지면 두 보정이 섞인다.
   ⚠️ 다리 본은 고관절 위치라 발끝과 X 가 정확히 같지는 않다(다리가 거의 수직이라 근사가 통한다).
     보정이 과하거나 모자라면 이 값을 0~1 사이로 조절할 것 — 0 이면 예전 동작 그대로다. */
const CIRCUS_FOOT_CENTER = 1;
const _rideFootOff = new THREE.Vector3();
const _rideFootTmpV = new THREE.Vector3(), _rideFootGrp = new THREE.Vector3(), _rideFootTmpQ = new THREE.Quaternion();
/* 🦶 딛는 다리가 좌석 원점에서 얼마나 떨어져 있는지 — 좌석 로컬 방향으로 1회 실측.
   매 프레임 재면 안 된다: 든 발 까딱임(CIRCUS_LEG_WAG)과 흔들림 때문에 값이 떨리고,
   그러면 몸이 그 떨림을 상쇄하려고 반대로 떨린다.

   ⚠️ **mountRide 안에서 재면 안 된다.** mountRide 는 '드래그를 놓는 순간' 불리는데 그때
      seat.rig 는 아직 손에 들려 공중에 떠 있다(_measureAnimalArmH 주석의 그 함정과 같은 것).
      다리 본은 rig 안에 있어 들린 위치가 그대로 섞여 들어오고, 그러면 오프셋이 '반걸음'이 아니라
      '드래그한 거리'가 되어 위 캐릭터가 탑 밖으로 날아간다 — 실제로 그렇게 날아갔다.
      그래서 rig 가 좌석 원점에 다시 놓인 뒤(_positionRideSeat 의 `seat.rig.position.set(0,0,0)`)
      첫 묘기 프레임에서 잰다.
   ⚠️ 잰 직후에도 반드시 크기 가드를 통과시킬 것. 어떤 이유로든 값이 튀면 보정이 그대로
      순간이동이 된다 — 못 믿을 값이면 보정을 아예 포기하는 편이 안전하다(예전 동작으로 되돌아갈 뿐). */
const CIRCUS_FOOT_OFF_MAX = 0.3;   // 이보다 크면 측정 실패로 간주하고 보정하지 않는다(월드 단위)
function _measureCircusFootOff(seat, standLeft){
  try{
    const b = seat && seat.bones; if(!b || !seat.group) return null;
    const leg = standLeft ? b.legL : b.legR;
    if(!leg) return null;
    seat.group.updateMatrixWorld(true);   // 이번 프레임에 방금 바꾼 위치·회전을 반영시킨 뒤 읽는다
    leg.getWorldPosition(_rideFootTmpV);
    _rideFootGrp.setFromMatrixPosition(seat.group.matrixWorld);
    _rideFootTmpV.sub(_rideFootGrp);                                        // 월드 오프셋
    seat.group.getWorldQuaternion(_rideFootTmpQ);
    _rideFootTmpV.applyQuaternion(_rideFootTmpQ.invert());                  // → 좌석 로컬 방향
    _rideFootTmpV.y = 0;                                                    // 높이는 sink 담당
    const _d = Math.hypot(_rideFootTmpV.x, _rideFootTmpV.z);
    if(!isFinite(_d) || _d > CIRCUS_FOOT_OFF_MAX){
      console.warn('[묘기] 접지점 오프셋이 비정상(' + _d.toFixed(4) + ') — 보정을 건너뜁니다');
      return null;
    }
    return _rideFootTmpV.clone();
  }catch(_){ return null; }
}
const CIRCUS_LEG_STAND   = 0.05;   // ★ 딛는 다리 각도(거의 곧게)
const CIRCUS_LEG_LIFT    = 0.75;   // ★ 드는 다리 각도(뒤로 들어올림)
const CIRCUS_LEG_WAG     = 0.18;   // ★ 든 발 까딱임 폭
const CIRCUS_LEG_WAG_SPD = 3.2;    // ★ 든 발 까딱임 속도
                                   //   0 = 팔이 머리 꼭대기에 정확히 얹힘 / 음수 = 머리에 더 파묻힘 / 양수 = 더 띄움.
                                   //   목표 높이를 상수로 두지 않고 대상 머리 꼭대기를 실측하므로,
                                   //   대상 크기·동물 크기·얼굴 크기가 뭐든 팔 높이가 자동으로 맞는다.
const RIDE_HEAD_OFFSET_Z = -0.3;   // ★ 1층(인간 머리 위) 앞뒤 보정. 음수=뒤로(머리 안쪽), 양수=앞으로.
const RIDE_HEAD_OFFSET_Z_ON_ANIMAL = -0.07;  // ★ 1층 중 '동물 머리 위'일 때의 앞뒤 보정.
/* ★ 동물 대상 앞뒤 보정 — '박스 깊이에 대한 비율'로 뒤로 민다.
   [경위] _headCenterZ를 그대로 쓰면 안 된다. 그건 머리 중심이 아니라 gltfRoot '몸 전체' 박스의 중심이고,
     동물은 머리 본이 몸 중심 근처라 값이 -0.02 수준밖에 안 나온다(실측). 인간이 정상 동작할 때의
     뒤로 미는 양은 -0.138(= RIDE_HEAD_OFFSET_Z -0.3 × hostScale 0.46)이고, 그때 박스 깊이가 0.406이라
     깊이 대비 0.345다. 동물도 같은 비율을 쓰면 대상 크기·체형과 무관하게 같은 자리에 얹힌다.
   양수를 키우면 뒤로, 줄이면 앞으로. */
const RIDE_Z_DEPTH_K_ON_ANIMAL = 0.345;
/* 🎪 2층 이상(묘기 자세)에서 **동물 대상**의 앞뒤 자리 — 몸 전체 박스 중심에서 **앞으로** 당기는 비율.
   ★ 1층 상수(바로 위 RIDE_Z_DEPTH_K_ON_ANIMAL)를 재사용하지 않는다. 1층은 '팔을 머리에 걸치는'
     자세라 몸이 뒤로 물러나야 하고(빼기), 2층은 '머리 위에 발로 딛는' 자세라 머리 쪽으로 나와야
     한다(더하기) — 부호부터 반대다. 한 상수로 묶으면 한쪽을 맞추는 순간 다른 쪽이 어긋난다.
   ★ 이 경로는 꼭대기 발판 실측(_headTopCenterZ)이 **아무것도 골라내지 못했을 때**만 쓴다.
     통메쉬 하나로 된 모델이 그렇다(그 층에도 그 메쉬뿐이라 결과가 몸 전체 중심과 같아진다).
   ★ 조절점은 이 숫자 하나다 — 뒤에 서면 키우고, 이마·코끝으로 튀어나오면 줄인다.
   [실측] 통메쉬 동물 제보 기준: 몸중심 = 머리본 −0.019 · 박스 깊이 0.389 · 박스 앞면 = 머리본 +0.176.
     0.28 이면 머리본 +0.09 쯤 = 머리본에서 앞면까지의 60% 지점. */
const CIRCUS_Z_DEPTH_K_ON_ANIMAL = 0.28;
                                   //   동물은 머리가 얇고 좌석 크기(userScale)도 달라서 인간용 값을 그대로 쓰면
                                   //   뒤로 밀려 보인다 — 대상 종류별로 분리. 더 앞으로 오게 하려면 0에 가깝게.
                                   //   너무 뒤에 있으면 이 값을 올리고(-0.2, -0.1 …), 이마로 튀어나오면 내린다(-0.35 …).
                                   //   2층 이상(묘기 자세)은 CIRCUS_FOOT_Z가 따로 담당하므로 서로 영향 없음.
const RIDE_HEAD_OFFSET_Y = 0.35;   // 폴백 전용 — 손 본을 못 찾아 팔높이 실측이 실패했을 때만 쓰는 예전 방식 값.
const RIDE_FOLLOW_HEAD_TILT = true;   // true=고개 기울임까지 따라 기울어짐. 어색하면 false(위치만 따라감)
const RIDE_SNAP_DIST = 1.1;        // 이 거리(월드) 안에서 놓으면 흡착
const _rideWP = new THREE.Vector3(), _rideTmp = new THREE.Vector3(), _rideOff = new THREE.Vector3();
const _rideAwayP = new THREE.Vector3(), _rideAwayS = new THREE.Vector3();   // 🫧 대상이 자리비움 그림일 때 그 그림의 월드 위치·크기
const _rideQD = new THREE.Quaternion(), _rideQP = new THREE.Quaternion(), _rideQR = new THREE.Quaternion();
const _rideQC = new THREE.Quaternion(), _rideQY = new THREE.Quaternion();
const _rideAxisY = new THREE.Vector3(0,1,0);
const _rideQSpin = new THREE.Quaternion();   // 🌀 대상의 '제자리 회전 춤'을 위층에 전달할 때 쓰는 임시값
/* 🌀 대상이 제자리 회전 춤(/150 묘기 회전 · 오르골)을 추는 동안 **몸통이 돌아간 각**(rad).
   [왜 따로 꺼내야 하나] 그 춤들은 회전을 `seat.rig.rotation.y` 에 준다. 그런데
     ① rig 회전축은 몸 중심이라 머리 본의 '월드 위치'는 거의 안 움직이고,
     ② 위층 좌석이 쓰는 _rideQD 는 `현재 × rest⁻¹` 를 부모 월드회전으로 감싸 만드는 값이라
        rig 회전이 좌우에서 상쇄돼 **깨끗이 지워진다**.
   그래서 아래 사람이 다섯 바퀴를 도는 동안 머리 위 동물만 제자리에 멈춰 있었다(제보).
   [기준선] rig.rotation.y 는 평소 `pose.turnY` 로만 세팅된다(대부분 0, sleep 만 0.04).
     그 기준선을 빼야 '춤이 돌린 양'만 남는다.
   ★ 춤이 아닐 때(`_danceSpin` 이 꺼짐)는 0 을 돌려주므로 기존 동작과 완전히 같다 — 회귀 없음.
   ★ 위층이 또 위층을 업고 있어도 이중 계산되지 않는다. 위층 자신은 _danceSpin 이 꺼져 있고,
     이미 회전이 반영된 자기 group.rotation.y 를 그 위층이 읽어 가므로 자연히 층을 타고 올라간다. */
function _rideHostSpinY(host){
  if(!host || !host.rig || !host._danceSpin) return 0;
  return host.rig.rotation.y - ((host.pose && host.pose.turnY) || 0);
}
/* 🐾 동물의 '발바닥→팔' 높이를 실측해서 크기 1 기준으로 정규화해 돌려준다.
   올라탈 때 1회만 재고 좌석에 캐싱한다 — 매 프레임 재면 팔 애니메이션 때문에 높이가 떨린다.
   이 값이 있으면 동물 크기가 바뀌어도 '팔이 머리 위에 걸쳐지는' 높이가 자동으로 유지된다.
   ★ 기준점은 반드시 bodyWrap(= rig의 자식)이어야 한다. mountRide는 '드래그를 놓는 순간' 호출되는데,
     그때 캐릭터는 아직 seat.rig가 공중에 들려 있다. 손 본은 rig 안에 있어 그 들린 높이가 포함되는 반면
     seat.group은 rig를 포함하지 않아서, group을 기준으로 재면 '드래그로 올린 높이'가 팔 높이에 섞여
     들어간다(놓는 높이에 따라 값이 매번 달라져 보정이 안 되는 것처럼 보였던 실제 원인 — 진단 로그에서
     같은 모델인데 armH가 0.554 vs 0.803으로 갈린 것이 이것). bodyWrap을 쓰면 rig 오프셋이 양쪽에서
     상쇄되고 원점이 발바닥이라 순수 팔 높이만 남는다. */
function _measureAnimalArmH(animalSeat){
  try{
    const b = animalSeat && animalSeat.bones && (animalSeat.bones.handL || animalSeat.bones.handR);
    const ref = animalSeat && animalSeat.bodyWrap;
    if(!b || !ref) return null;
    animalSeat.group.updateMatrixWorld(true);
    const _hp = new THREE.Vector3(), _gp = new THREE.Vector3();
    b.getWorldPosition(_hp); ref.getWorldPosition(_gp);
    /* 🪑 실측한 팔 높이는 월드값이라 평준화 배율까지 이미 들어가 있다. raw userScale 로 나누면
       그 k 가 armH 안에 남아, 평준화된 좌석 위에 올라탄 동물이 뜨거나 파묻힌다. */
    const s = seatScale(animalSeat) || 1;
    /* 🧍 캐릭터 높이(userY)로 들어 올린 양은 뺀다 — 그건 팔 높이가 아니다.
       [왜] 손 본은 m 안에 있고 m 은 높이만큼 들려 있어서, 안 빼면 armH 에 높이가 섞여 들어간다.
         그러면 (a) 값의 의미가 '팔 높이' 가 아니게 되고 (b) 이 측정은 올라탈 때 1회뿐이라
         올라탄 뒤 높이 슬라이더를 만지면 그만큼 어긋난 채로 굳는다.
       ★ 높이 상쇄는 _positionRideSeat 가 charLiftWorld 로 한 번에 처리한다 — 두 곳에서 빼면 두 배가 된다. */
    const h = ((_hp.y - _gp.y) - charLiftWorld(animalSeat)) / (s || 1);   // 크기 1 기준으로 정규화
    return (isFinite(h) && h > 0) ? h : null;
  }catch(_){ return null; }
}
const RIDE_MAX_STACK = 4;   /* ★ 탑쌓기 최대 층수(맨 아래 대상 제외, 올라탄 동물 기준).
                               방 정원이 5→6명이 됐지만 이 값은 그대로 둔다 — 층수는 인원이 아니라
                               '화면 위로 나가지 않는 높이'가 기준이고, 4층이면 이미 캐릭터 키의
                               5배쯤 된다. 정원에 맞춰 올리고 싶으면 이 값만 5로 바꾸면 된다. */
/* 🐾 mountRide/unmountRide가 호출하는 전역 진입점. 방에 있을 때만 실제 전송한다.
   (예전엔 이 함수가 없어서 typeof 가드에 걸려 조용히 넘어갔고, 그래서 올라타기가 남에게 안 보였다) */
function broadcastRide(){
  try{ if(typeof Presence!=='undefined' && Presence.active() && Presence.broadcastRide) Presence.broadcastRide(); }catch(_){}
}
/* 🐾 올라타기 체인 헬퍼 ─────────────────────────────────────────────
   A가 B 위에, B가 C 위에 탄 상태를 'ridingOn' 연결로 표현한다. 아래 함수들이 그 사슬을 다룬다.
   ★ 순환(A→B→A)은 무한 루프가 되므로 반드시 막아야 하고, 안전을 위해 순회 횟수 상한도 둔다. */
/* 🐾 올라탄 좌석들의 위치를 '체인 순서대로' 갱신한다.
   ★ 반드시 아래층부터 처리해야 한다. seats 배열 순서대로 돌면 위층이 아래층보다 먼저 계산될 수 있고,
     그러면 위층이 한 프레임 전 위치를 보고 따라가면서 탑이 덜덜 떨린다.
     _rideDepth로 정렬해 바닥에 가까운 좌석부터 확정한 뒤 그 위를 올린다.
   ★ 각 층 계산 직후 matrixWorld를 갱신해야 바로 위층이 최신 머리 위치를 읽는다. */
/* 🎪 탑 전체를 무너뜨린다 — sleep 인원이 기준을 넘겨 균형을 잃은 경우.
   ★ unmountRide는 '위층을 아래로 내려앉히는' 동작이라 와해에는 맞지 않는다.
     여기서는 위층부터 순서대로 전원 하차시키고, 받치고 있던 맨 아래(인간 포함)까지 어지러움을 준다. */
function _collapseRideTower(bottomSeat, now){
  try{
    // 이 탑에 속한 좌석 전부 수집(위층 우선)
    const members = seats.filter(x=>x.ridingOn && rideBenchMod._rideIsAbove(x, bottomSeat) && x!==bottomSeat);
    members.sort((a,b)=>rideBenchMod._rideDepth(b)-rideBenchMod._rideDepth(a));   // 높은 층부터
    members.forEach(m=>{
      m.ridingOn = null;                       // unmountRide의 '아래로 내려앉기'를 타지 않게 직접 끊음
      try{ if(m.desk) m.desk.visible = true; }catch(_){}
      try{ m.group.position.y = 0; m.group.position.z = 0;
           m.group.quaternion.identity(); m.group.rotation.set(0,0,0); }catch(_){}
      m._circusOn = false; m._circusPanicAt = 0; m._rideHeadTop = null;
      m.dizzyUntil = now + CIRCUS_DIZZY_MS;    // 각자 자기 자리로 돌아가며 어지러움
      for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f', m), i*300);
    });
    // 받치고 있던 맨 아래(인간일 수도 있음)도 어지러움
    bottomSeat.dizzyUntil = now + CIRCUS_DIZZY_MS;
    bottomSeat._circusPanicAt = 0;
    for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f', bottomSeat), i*300);
    if(members.length) toast('🎪 균형을 잃고 무너졌어요!');
    /* 전원이 자기 자리로 돌아간다 — 이 경로는 unmountRide 를 안 타므로(직접 ridingOn 을 끊는다)
       재배치도 여기서 직접 부른다. 안 부르면 무너진 좌석들이 남의 자리에 겹쳐 선다. */
    if(members.length){ try{ layoutSeats(); }catch(_){} }
  }catch(e){ console.warn('[묘기] 와해 처리 실패', e); }
}
/* 🎪 탑마다 sleep 인원을 세어 흔들림/와해를 판정한다. */
/* ═══════════════════════════ 🪑 플라잉체어 ═══════════════════════════
   💣 를 누르면 캐릭터가 자리에서 튀어나가 화면 가장자리에 튕기다 돌아온다.

   ★ 의자·책상은 자리에 남고 **캐릭터(rig)만** 날아간다.
     seat.group 에는 책상(desk)과 캐릭터(rig)가 함께 들어 있다. group 을 옮기면 책상까지
     따라가고, layoutSeats 가 잡아 둔 자리(targetX)와도 싸우게 된다. 그래서 rig 만 건드린다.
     — 흔들기(beingShaken)가 이미 같은 방식이다.

   ★ 벽 판정은 **화면 좌표(NDC)** 로 한다. 월드 좌표로 경계를 잡으면 카메라 줌이 인원수마다
     달라지므로(applyCameraAndCanvas) 2명일 때와 8명일 때 튕기는 자리가 달라진다.
     매 프레임 캐릭터를 카메라에 투영해서 화면 밖으로 나가려 할 때만 속도를 뒤집는다.

   ★ 아래 경계(yLo)만 시작 위치 기준으로 잡는다. 위·좌·우는 화면 끝이지만 아래로는 책상 줄이
     있어서, 화면 끝까지 내려가면 남의 책상을 뚫고 지나간다.

   ★ 궤적은 **시드 하나로 정해진다.** 지금은 내 화면에서만 도는 로컬 기능이지만, 남에게
     전파할 때 {from,to,seed} 만 실어 보내면 모든 화면이 같은 궤적을 그린다.
     ⚠️ 그래서 이 안에서 Math.random() 을 부르면 안 된다 — 반드시 _flyRng(seed) 를 쓸 것.

   ⚠️ 이름표·경험치 바는 seat.group 기준으로 찍히므로 **책상 자리에 그대로 남는다.**
     흔들기도 같은 동작이라 일부러 맞춰 뒀다. 캐릭터를 따라가게 하려면 setSeatNamePlate 의
     기준을 group → rig 로 바꿔야 하는데, 그건 흔들기·올라타기 표시까지 같이 바뀌는 변경이다. */
const FLY_MS        = 10000;   // 비행 시간(ms)
const FLY_SPEED     = 9.5;     // 기준 속도(월드 단위/초). 좌석 하나가 대략 1.7 단위다
const FLY_SPEED_VAR = 0.2;     // 개체차 ±20% — 시드에서 뽑는다(Math.random 아님)
/* 발사 각도(수평에서 잰 도) — **사선 대역만** 쓴다.
   위쪽 반원 전체에서 뽑으면 90°에 가까운 각이 섞여 "위로 솟았다 그대로 내려오는" 판이 나오고,
   0°에 가까운 각은 옆으로만 미끄러진다. 둘 다 튕기는 맛이 없어서 가운데 대역만 남겼다. */
const FLY_ANG_MIN   = 32;
const FLY_ANG_MAX   = 58;
const FLY_SPIN      = 3.2;     // 회전 속도(라디안/초)
const FLY_EDGE_X    = 0.90;    // 좌우 벽(NDC)
const FLY_EDGE_TOP  = 0.90;    // 위 벽(NDC)
const FLY_DROP      = 0.18;    // 아래 벽 = 시작 지점보다 이만큼만 아래(NDC). 책상 줄을 안 뚫게
const FLY_RETURN_MS = 450;     // 자리로 돌아오는 시간
const FLY_DIZZY_MS  = 2500;    // 착지 후 어지러움 — 흔들기 dizzy 와 같은 값
/* 🎯 남을 날리기 — 해금·연속·쉬는 시간
   ★ 연속 횟수를 세는 것은 **맞는 쪽**이다. 던지는 쪽에서 세면 B·C·D 가 각각 따로 세어
     "방 인원이 A 를 연속 3번" 이라는 규칙 자체가 성립하지 않는다.
   ⚠️ FLY_STREAK_MS('연속'이 무엇으로 끊기는가)는 **아직 확정된 규칙이 아니다.** 지금은
     시간으로만 끊는다. "다른 사람이 맞으면 초기화" 안은 넣지 않았다 — 그러려면 방 전원의
     피격을 각자가 알아야 해서 전파가 한 겹 더 늘어난다. 30초를 써 보고 정할 것. */
const FLY_MIN_LEVEL = 100;     // 💣 해금 레벨 (포커싱 어플로 쌓은 레벨)
const FLY_STREAK    = 3;       // 이만큼 연속으로 맞으면 쉬어간다
const FLY_STREAK_MS = 30000;   // 마지막 피격 후 이 시간이 지나면 연속이 끊긴다
const FLY_COOL_MS   = 60000;   // 쉬는 시간 — 이 동안은 표적이 되지 않는다

/* 시드 난수(mulberry32) — 같은 시드면 언제 어디서 돌려도 같은 수열 */
function _flyRng(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function flySeed(){ return (Math.random() * 0xFFFFFFFF) >>> 0; }

/* ═══ 🙈 워킹룸 캐릭터 숨기기 (2026-09-23 · handoff-2026-09-21-features §5) ═══════════════════
   상대 캐릭터 우클릭 → «🙈 숨기기». **내 화면에서만 · 그 방에 있는 동안만 · 워킹룸(채널 1)에서만.**
   ★ 키 = seat.friendId(방 세션 memberId). 방마다 새로 뽑히는 값이라 사람 단위 영구 기억이 아니다(그건 «차단» — 별개 설계).
   ★ localStorage 에 쓰지 않는다. 방 입장 직전(Presence.start 앞)과 doLeaveRoom 에서 비운다.
   ★ 적용은 프레임 루프가 **매 프레임** 한다(rig.visible · 머리 위 말풍선 · 책상 위 상태 이모지).
     좌석이 재동기화·재접속으로 새로 그려져도 friendId 가 같으면 다음 프레임에 그대로 다시 숨는다.
   ★ 책상·이름표·경험치 바는 남긴다 — 빈 책상이 누구 것인지 보여야 우클릭 «🙉 다시 보이기» 로 풀 수 있다.
   ⚠️ three.js 레이캐스트는 visible=false 를 거르지 않는다 → 좌클릭 잡기 · 💣 조준 · 🪄 때리기 조준 세 곳이
     _hitsSkipHidden 으로 거른다. **우클릭 메뉴는 거르지 않는다**(책상을 눌러 «다시 보이기» 가 떠야 한다).
   ⚠️ 숨긴 캐릭터 위에 올라탄 남의 캐릭터는 그대로 둔다(허공에 떠 보일 수 있음 — 범위 밖). */
/* 본문은 hidden-seats.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const HIDDEN_SEATS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const hiddenSeatsMod = (typeof TwHiddenSeats === 'undefined') ? HIDDEN_SEATS_MOD_OFF : TwHiddenSeats.createHiddenSeats({
  _flyActive: ()=>_flyActive,
  seatFromObject: (...a)=>seatFromObject(...a),
  seats: seats,
});
function _seatHidden(...a){ return hiddenSeatsMod._seatHidden(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
/* 지금 날고 있는 좌석 수. frame() 의 비포커스 프레임 상한(FrameBudget.FPS_UNFOCUSED)을 비행 동안만
   비켜 가는 데 쓴다 — 20fps 로는 빠르게 튕기는 움직임이 뚝뚝 끊겨 보인다.
   ★ seats 를 매 프레임 훑지 않고 세어 두는 이유: 이 값은 상한 검사보다 **먼저** 읽히고,
     그 검사는 rAF 가 올 때마다(초 60회) 돈다. */
let _flyActive = 0;


/* ═══ 🛰 poke 신선도 ═══════════════════════════════════════════════════
   방 노드의 `poke` 는 **한 칸짜리 우편함**이다(rooms/$room/$memberId/poke). 새 알림이 오면
   덮어쓸 뿐, 다 읽었다고 비워지지 않는다. 그래서 마지막에 담긴 값(예: `fly:1234`)이 그 자리에
   계속 남고, 그 값이 다시 배달되기만 하면 **아무도 폭탄을 안 눌렀는데 캐릭터가 날아간다.**
   다시 배달되는 경로가 실제로 여럿이다:
     · `serverTimestamp()` 는 로컬 추정값으로 한 번, 서버 확정값으로 또 한 번 — 한 번의 poke 에
       onValue 가 **두 번** 온다. 두 번째가 늦게 오면 이미 끝난 비행이 다시 시작된다.
     · 재접속하면 리스너가 다시 붙으면서 그 자리의 현재 값이 즉시 한 번 배달된다.
   ★ 그래서 판정을 둘 둔다: **같은 ts 는 한 번만**(중복), **오래된 ts 는 아예 안 본다**(유통기한).
     친구 좌석 쪽은 예전부터 ts 중복 검사가 있었는데 내 좌석 쪽에는 없었다 — 같은 규칙으로 맞춘다.
   ⚠️ 유통기한은 비행 길이(FLY_MS=10초)보다 넉넉해야 한다. 짧게 잡으면 왕복이 느린 회선에서
     진짜 알림이 버려진다. */
/* 본문은 room-sync.js 로 옮겼다(앱 FSD 35번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ROOM_SYNC_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const roomSyncMod = (typeof TwRoomSync === 'undefined') ? ROOM_SYNC_MOD_OFF : TwRoomSync.createRoomSync({
  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,
  ITEM_LICENSE_HOLD: ()=>premiumMod.ITEM_LICENSE_HOLD,
  Presence: ()=>Presence,
  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),
  _chatIsSecretRoom: (...a)=>chatLockMod._chatIsSecretRoom(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
  roomEntryMod: ()=>roomEntryMod,
  savedDesks: ()=>commissionMod.savedDesks(),
  toast: (...a)=>toast(...a),
});
/* 지금 이 좌석을 날릴 수 있는가. 여기서 걸러지는 것이 곧 규칙이다.
   ★ 막는 이유가 전부 "그 좌석의 위치를 이미 다른 코드가 매 프레임 정하고 있다"는 것이다.
     올라타기(_updateRideChains)·벤치·흔들기가 그렇다. 둘이 같이 돌면 캐릭터가 두 좌표
     사이에서 떨린다. */
/* 🗼 allowTower — [2026-09-23 요청 · A안] 룰렛·🎲 로 **나를** 날릴 때는 탑 안에 있어도 된다.
   날리기 **직전에** 탑에서 뺀다(_rideLeaveTower · applyRemoteFly). 탑 계산과 비행이 같이 도는 일은 여전히 없다.
   ★ 💣(남을 겨눔)은 지금처럼 막는다 — 표적 판정(_flyTargetCheck)은 이 인자를 안 넘긴다. */
function canFly(seat, allowTower){
  if(!seat)                                    return {ok:false, why:'좌석이 없어요'};
  if(seat.fly)                                 return {ok:false, why:'이미 날아가는 중이에요'};
  if(seat.isPlaceholder)                       return {ok:false, why:'아직 캐릭터가 없어요'};
  if(seat.inPreview)                           return {ok:false, why:'미리보기 중에는 안 돼요'};
  if(seat.beingShaken || seat.pinned)          return {ok:false, why:'지금은 날릴 수 없어요'};
  if(!allowTower && (seat.ridingOn || seats.some(s=>s.ridingOn===seat)))
                                               return {ok:false, why:'올라타 있는 동안에는 못 날아가요'};
  if(seat.seatedOn || seat._benchOwnerSit)     return {ok:false, why:'벤치에 앉아 있을 땐 못 날아가요'};
  return {ok:true};
}

/* 날리기 시작. seed 를 안 주면 새로 뽑는다(전파할 때는 뽑은 값을 같이 실어 보낼 것).
   quiet=true 면 실패해도 토스트를 안 띄운다 — 남의 화면에서 재생하는 경로에서 쓴다.
   (던진 사람의 화면에도 같은 방송이 돌아오는데, 거기서 "이미 날아가는 중" 토스트가 뜨면 곤란하다) */
function startFlight(seat, seed, quiet){
  const c = canFly(seat);
  if(!c.ok){ if(!quiet) toast(c.why); return false; }
  seed = (seed == null) ? flySeed() : (seed >>> 0);
  const r = _flyRng(seed);
  /* 방향만 무작위이고 **속력은 항상 spd** 다.
     예전엔 전방위에서 각도를 뽑고 위로 뜨는 힘을 따로 더했는데, 아래로 뽑힌 각도에서 두 항이
     서로 상쇄돼 실제 속력이 절반 이하로 떨어졌다 — 어떤 판은 휙 날고 어떤 판은 굼떴다. */
  const side = (r() < 0.5) ? -1 : 1;                                     // 왼쪽/오른쪽
  const deg  = FLY_ANG_MIN + r() * (FLY_ANG_MAX - FLY_ANG_MIN);          // 수평에서 잰 올라가는 각
  const ang  = deg * Math.PI / 180;
  const spd  = FLY_SPEED * (1 - FLY_SPEED_VAR + r() * FLY_SPEED_VAR * 2);
  seat.fly = {
    seed, t0: performance.now(), dur: FLY_MS, phase: 'air',
    x: 0, y: 0,
    vx: side * Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,                     // 대역이 위쪽이라 언제나 양수
    spin: (r() < 0.5 ? -1 : 1) * FLY_SPIN * (0.7 + r() * 0.6),
    yLo: null,                                   // 아래 경계 — 첫 프레임에 시작 위치를 재서 정한다
    probeY: null,                                // 몸통 중심 높이 — 첫 프레임에 실측
    fromX: 0, fromY: 0, backAt: 0
  };
  _flyActive++;
  return true;
}


/* ═══ 💃💥 깜짝쇼 ═══════════════════════════════════════════════════
   **같은 춤 명령을 세 번** 쓰면 명령마다 다른 일이 일어난다:
     · `/80` ×3  — 나는 춤추고 **나머지는 전부 날아간다**(폭발).
     · `/150` ×3 — 아무도 안 날아가고 **회전만 두 배로 빨라진다**(터보). 6초 안에 10바퀴.
   두 가지 쓰는 법을 모두 받는다:
     · 한 줄에 이어쓰기 — `/80/80/80`, `/150/150/150` (한 번 보내면 그 자리에서 걸린다)
     · 따로 보내기 — `/80` · `/80` · `/80` (1분 안에)
   ★ 설계 원칙 넷:
     · **명령으로만 센다.** 춤추기 버튼(startMyDance 를 cmd 없이 부른다)은 세지 않는다.
       예전에는 '춤을 세 번'이라 버튼으로도 터졌는데, 누르려던 게 아닌 사람이 터뜨리게 된다.
     · **같은 명령이어야 한다.** `/80` 다음 `/150` 이 오면 흐름이 끊기고 새 명령부터 다시 센다
       (`_eggCountCmd` 의 필터가 cmd 까지 본다). 종류가 섞이지 않는 것은 여기서 보장된다.
     · **알리지 않는다.** 한 번·두 번째에 아무 표시도 하지 않고, 터져도 대화 기록을 남기지 않는다.
       깜짝쇼라서 예고하면 재미가 없다(일반 폭탄은 기록을 남기지만 이건 일부러 뺀다).
     · **내 화면의 기억일 뿐이다.** 서버에 새 필드를 만들지 않는다 — 폭발은 평소와 똑같은 fly poke 고,
       터보는 평소와 똑같은 `dance:스타일` poke 다. 받는 쪽 코드는 한 줄도 바뀌지 않는다.
       남이 걸어준 춤(poke 수신)도 세지 않는다 — 세면 남이 내 깜짝쇼를 대신 터뜨릴 수 있다.
   ⚠️ 춤 명령에는 5초 쿨다운이 있다 — 따로 세 번이면 최소 10초, 60초 창 안에 넉넉히 들어간다.
     쿨다운을 늘리려면 이 창(EGG_WINDOW_MS)도 같이 볼 것.
     이어쓰기(`/80/80/80`)는 한 번의 전송이라 쿨다운을 한 번만 먹는다 — 그래서 창과 무관하다. */
/* 본문은 tricks.js 로 옮겼다(앱 FSD 25번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const TRICKS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const tricksMod = (typeof TwTricks === 'undefined') ? TRICKS_MOD_OFF : TwTricks.createTricks({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CHAR_Z: CHAR_Z,
  FLOATER_BURST: ()=>floatersMod.FLOATER_BURST,
  FLY_COOL_MS: FLY_COOL_MS,
  FLY_DIZZY_MS: FLY_DIZZY_MS,
  FLY_DROP: FLY_DROP,
  FLY_EDGE_TOP: FLY_EDGE_TOP,
  FLY_EDGE_X: FLY_EDGE_X,
  FLY_MS: FLY_MS,
  FLY_RETURN_MS: FLY_RETURN_MS,
  FLY_STREAK: FLY_STREAK,
  FLY_STREAK_MS: FLY_STREAK_MS,
  Presence: ()=>Presence,
  _bonkSnd: ()=>sfxMod._bonkSnd,
  _flyActive: ()=>_flyActive,
  _hitsSkipHidden: (...a)=>hiddenSeatsMod._hitsSkipHidden(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  _rideIsAbove: (...a)=>rideBenchMod._rideIsAbove(...a),
  _rideLeaveTower: (...a)=>rideBenchMod._rideLeaveTower(...a),
  _seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  _skipHiddenDesk: (...a)=>hiddenSeatsMod._skipHiddenDesk(...a),
  _todayStr: (...a)=>focusTotalMod._todayStr(...a),
  camera: camera,
  canFly: (...a)=>canFly(...a),
  canvas: canvas,
  creatorOpen: ()=>creatorOpen,
  flySeed: (...a)=>flySeed(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  ndc: ()=>ndc,
  officeMode: ()=>officeMode,
  purikuraUi: ()=>purikuraUi,
  ray: ()=>ray,
  seatCharZ: (...a)=>seatCharZ(...a),
  seatFromObject: (...a)=>seatFromObject(...a),
  seatScale: (...a)=>seatScale(...a),
  seats: seats,
  showChatBubble: (...a)=>showChatBubble(...a),
  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),
  startFlight: (...a)=>startFlight(...a),
  toast: (...a)=>toast(...a),
  setFlyActive: (v)=>{ _flyActive = v; },
});

/* ═══════════════════════════ 🪄 때리기(bonk) ═══════════════════════════
   프리미엄 전용. 하루 10회(전체). 납작 → 보잉 → 원래대로 → dizzy.

   ★ 왜 플라잉체어(💣) 바로 아래에 있는가 — 조준 모드·전파·dizzy 후속을 전부 그쪽에서
     베꼈다. 한쪽을 고칠 때 다른 쪽도 같이 보이는 자리에 둔다.
     ⚠️ 이 순서에도 뜻이 있다: setBonkAiming 이 _flyAiming 을, setFlyAiming 이 _bonkAiming 을
       서로 읽는다. 두 블록이 붙어 있으면 그 사이에 아무 코드도 못 들어와서 TDZ 창이 없다.
       한쪽을 파일 다른 데로 옮기지 말 것.

   ★ 스쿼시는 **상태가 아니라 스케일 오버레이 하나**다. seatState 에 'bonk' 를 넣지 않는다 —
     포즈 표·클립 키워드 맵·눈 감기 판정까지 번지고, dizzy 후속도 상태 우선순위와 싸운다.

   🛑 전파는 `fly:` 규약을 **의도적으로 안 따른다.** fly 는 던진 사람도 방송이 돌아올 때까지
     기다려 방 전체가 같은 궤적을 보지만, 때리기는 첫 프레임이 전부라 왕복(수백 ms)을 기다리면
     클릭과 타격이 어긋나 타격감이 죽는다. 그래서 **때린 사람은 즉시 로컬 재생**하고,
     돌아온 방송은 페이로드의 때린사람 id 로 걸러 건너뛴다.
     화면 간 타이밍이 몇백 ms 어긋나지만 시각 효과라 문제 없다 — 즉시성을 택한 대가다. */
/* (앱 FSD 25번) 이 자리의 본문도 tricks.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔊 효과음 공장(_mkSndPool) — 때리기 · 클릭음 · 채팅 · 뽀모도로 알림음 풀 ═══ */
/* 본문은 sfx.js 로 옮겼다(앱 FSD 42번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const SFX_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const sfxMod = (typeof TwSfx === 'undefined') ? SFX_MOD_OFF : TwSfx.createSfx({
  officeMode: ()=>officeMode,
  tricksMod: tricksMod,
});
/* ═══ 🪄 때리기 — 말풍선 · 재생 · 전파 · 조준 모드 ═══ */
/* (앱 FSD 25번) 이 자리의 본문도 tricks.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🗼 올라타기(탑) · 벤치 좌석 자리 잡기 ═══ */
/* 본문은 ride-bench.js 로 옮겼다(앱 FSD 30번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const RIDE_BENCH_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const rideBenchMod = (typeof TwRideBench === 'undefined') ? RIDE_BENCH_MOD_OFF : TwRideBench.createRideBench({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CIRCUS_FOOT_CENTER: CIRCUS_FOOT_CENTER,
  CIRCUS_FOOT_SINK: CIRCUS_FOOT_SINK,
  CIRCUS_FOOT_Z: CIRCUS_FOOT_Z,
  CIRCUS_FOOT_Z_FROM_TOP: CIRCUS_FOOT_Z_FROM_TOP,
  CIRCUS_MIN_DEPTH: CIRCUS_MIN_DEPTH,
  CIRCUS_PANIC_MS: CIRCUS_PANIC_MS,
  CIRCUS_PANIC_SLEEPERS: CIRCUS_PANIC_SLEEPERS,
  CIRCUS_SWAY_CALM: CIRCUS_SWAY_CALM,
  CIRCUS_SWAY_PANIC: CIRCUS_SWAY_PANIC,
  CIRCUS_SWAY_SPEED: CIRCUS_SWAY_SPEED,
  CIRCUS_TOP_SLAB: CIRCUS_TOP_SLAB,
  CIRCUS_TREMOR_AMP: CIRCUS_TREMOR_AMP,
  CIRCUS_TREMOR_AT: CIRCUS_TREMOR_AT,
  CIRCUS_TREMOR_CALMDOWN: CIRCUS_TREMOR_CALMDOWN,
  CIRCUS_TREMOR_SPD: CIRCUS_TREMOR_SPD,
  CIRCUS_YAW_MAX: CIRCUS_YAW_MAX,
  CIRCUS_YAW_MIN: CIRCUS_YAW_MIN,
  CIRCUS_YAW_RANDOM: CIRCUS_YAW_RANDOM,
  CIRCUS_Z_DEPTH_K_ON_ANIMAL: CIRCUS_Z_DEPTH_K_ON_ANIMAL,
  IDESK_ENABLED: ()=>iDeskMod.IDESK_ENABLED,
  INTERACTION_DESKS: ()=>iDeskMod.INTERACTION_DESKS,
  Presence: ()=>Presence,
  RIDE_ARM_SINK: RIDE_ARM_SINK,
  RIDE_ARM_SINK_ON_ANIMAL: RIDE_ARM_SINK_ON_ANIMAL,
  RIDE_ARM_SIZE_FOLLOW: RIDE_ARM_SIZE_FOLLOW,
  RIDE_FOLLOW_HEAD_TILT: RIDE_FOLLOW_HEAD_TILT,
  RIDE_HEAD_OFFSET_Y: RIDE_HEAD_OFFSET_Y,
  RIDE_HEAD_OFFSET_Z: RIDE_HEAD_OFFSET_Z,
  RIDE_HEAD_OFFSET_Z_ON_ANIMAL: RIDE_HEAD_OFFSET_Z_ON_ANIMAL,
  RIDE_MAX_STACK: RIDE_MAX_STACK,
  RIDE_PART_CENTER_MARGIN: RIDE_PART_CENTER_MARGIN,
  RIDE_Z_DEPTH_K_ON_ANIMAL: RIDE_Z_DEPTH_K_ON_ANIMAL,
  _collapseRideTower: (...a)=>_collapseRideTower(...a),
  _deskDefById: (...a)=>iDeskMod._deskDefById(...a),
  _measureAnimalArmH: (...a)=>_measureAnimalArmH(...a),
  _measureCircusFootOff: (...a)=>_measureCircusFootOff(...a),
  _rideAwayP: _rideAwayP,
  _rideAwayS: _rideAwayS,
  _rideAxisY: _rideAxisY,
  _rideFootOff: _rideFootOff,
  _rideHostSpinY: (...a)=>_rideHostSpinY(...a),
  _rideOff: _rideOff,
  _rideQC: _rideQC,
  _rideQD: _rideQD,
  _rideQP: _rideQP,
  _rideQR: _rideQR,
  _rideQSpin: _rideQSpin,
  _rideQY: _rideQY,
  _rideTmp: _rideTmp,
  _rideWP: _rideWP,
  broadcastRide: (...a)=>broadcastRide(...a),
  charLiftWorld: (...a)=>charLiftWorld(...a),
  getActiveInteractionDeskId: (...a)=>iDeskMod.getActiveInteractionDeskId(...a),
  isDeskUnlocked: (...a)=>iDeskMod.isDeskUnlocked(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  matWood: matWood,
  matWoodD: matWoodD,
  measureHeadBoxNoParts: (...a)=>measureHeadBoxNoParts(...a),
  savedParts: ()=>premiumMod.savedParts(),
  seatScale: (...a)=>seatScale(...a),
  seatState: (...a)=>seatState(...a),
  seats: seats,
  setActiveInteractionDeskId: (...a)=>iDeskMod.setActiveInteractionDeskId(...a),
  toast: (...a)=>toast(...a),
});
/* ═══════════════════════════════════════════════════════════════════
   🪑 상호작용 책상 카탈로그 + 레벨 해금 (I키 인벤토리)
   · 번들 내장(GLB + 도트 썸네일 PNG). 코드는 자격을 여는 잠금해제일 뿐 — 서버 비용 0.
   · 해금 조건: 내 레벨 ≥ reqLevel. 관리자는 전부 해금.
   · GLB는 아직 준비 전이므로 glb=null이면 임시 프리미티브 벤치로 대체(검증용).
   ═══════════════════════════════════════════════════════════════════ */
/* 본문은 interaction-desk.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const I_DESK_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const iDeskMod = (typeof TwInteractionDesk === 'undefined') ? I_DESK_MOD_OFF : TwInteractionDesk.createInteractionDesk({
  CIRCUS_ARM_DROP: CIRCUS_ARM_DROP,
  CIRCUS_LEG_LIFT: CIRCUS_LEG_LIFT,
  CIRCUS_LEG_STAND: CIRCUS_LEG_STAND,
  Presence: ()=>Presence,
  RIDE_MAX_STACK: RIDE_MAX_STACK,
  RIDE_SNAP_DIST: RIDE_SNAP_DIST,
  _rideTmp: _rideTmp,
  _rideWP: _rideWP,
  focusLevelMod: ()=>focusLevelMod,
  isAdmin: ()=>isAdmin,
  rideBenchMod: rideBenchMod,
  seats: seats,
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});

/* ═══════════════════════════════════════════════════════════════════
   🪑 멀티좌석 책상(2·3인승 벤치) — 캐릭터를 드래그해 슬롯에 앉힌다.
   올라타기(ride)와 같은 조작·전송 구조를 재사용하되, 대상이 '캐릭터'가 아니라
   '벤치의 좌석 슬롯'이라는 점만 다르다. 소유 개념 없음(레벨 보상자가 벤치를 쓰고,
   상호작용하려는 사람이 자기 캐릭터를 드래그해 얹음).
   ═══════════════════════════════════════════════════════════════════ */
/* (앱 FSD 30번) 이 자리의 본문도 ride-bench.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🪑 좌석 배치(layoutSeats) · 카메라 · 도트 텍스처 필터 ═══ */
function layoutSeats(){
  /* 🪑 좌석 간격·카메라 줌은 바로 아래에서 **책상 폭을 실측**한다. 평준화로 책상이 커지거나
     작아졌다면 그 전에 반영돼 있어야 간격이 한 박자 늦지 않는다. 바뀐 좌석이 없으면 숫자 비교뿐이다. */
  syncSeatEqualize();
  // 🪑 맨 오른쪽 고정이면 방에서 나를 0번(맨 오른쪽)으로 — 다른 사람이 들어온 뒤에도(seat-pin.js)
  if(window.TwSeatPin && TwSeatPin.pinFirst(seats, roomSeatMode)) renderSeatTabs();
  // ★ 인원 수가 바뀔 때마다(친구 참여/퇴장 등) 지금 팬 위치가 여전히 안전 범위인지 재검증 —
  //   안 그러면 팬을 한쪽 구석에 걸어둔 상태에서 인원이 늘어날 때 화면 밖으로 밀려날 수 있음.
  { const _c = clampDeskPan(deskPanX, deskPanY); deskPanX=_c.x; deskPanY=_c.y; }
  const hasRemote = seats.some(s=>s.remote);   // 실제 친구가 있으면(멀티모드) 더 좁은 간격 사용
  const spacing = hasRemote ? MULTIPLAYER_SPACING : SPACING;
  // ★ SPACING/MULTIPLAYER_SPACING의 의미가 "좌석 중심 간 거리"에서 "책상과 책상 사이 여백"으로 바뀜.
  //   각 좌석 책상의 실제 폭(halfWidth)을 실측해서, 상대방 캐릭터/책상 크기가 어떻든 그 사이 여백은
  //   항상 이 값만큼 일정하게 유지됨(전엔 고정 거리라 책상이 크면 옆과 겹치고 작으면 휑하게 떨어졌음).
  /* 🐾 남의 머리에 올라타 있는 좌석은 **자리 계산에서 뺀다.**
     [경위] a·b·c·d 에서 c 가 b 머리 위로 올라가면 `a, c+b, (빈자리), d` 가 되어 c+b 와 d 사이가
       크게 벌어졌다. 게다가 mountRide 가 올라탄 좌석의 책상을 숨기는데(desk.visible=false)
       seatDeskHalfWidth 는 잴 게 하나도 없으면 기본값 0.85 를 돌려주므로, 그 빈자리는 그냥
       비는 게 아니라 **책상 한 개 폭만큼** 확보됐다.
     ★ 올라탄 좌석의 실제 위치는 _positionRideSeat 이 매 프레임 대상 머리 위로 덮어쓰므로
       targetX 를 쓰지 않는다. 탑쌓기 사슬 전체가 대상이고(2층·3층도 ridingOn 이 있다),
       자리를 차지하는 것은 맨 아래 좌석뿐이다.
     ⚠️ seats 배열의 **순서·내용은 건드리지 않는다** — 좌석 탭(renderSeatTabs)과 슬롯 드래그가
       같은 배열의 인덱스를 쓴다. 빼는 것은 자리 계산에서지 배열에서가 아니다.
     ⚠️ 카메라 줌(rowSpan·leftIdx/rightIdx)도 같은 목록을 봐야 한다. 여기만 빼고 저기에 남기면
       화면 폭 계산에 유령 자리가 남아 줌만 이상해진다. */
  const halfWidths = seats.map(seatDeskHalfWidth);
  const _hwOf = new Map(seats.map((s,i)=>[s, halfWidths[i]]));
  const placed = seats.filter(s=>!s.ridingOn);
  placed.forEach((s,i)=>{
    if(i===0){ s.targetX = 0; return; }   // 맨 오른쪽 고정
    const prev = placed[i-1];
    s.targetX = prev.targetX - (_hwOf.get(prev) + spacing + _hwOf.get(s));
  });
  /* 올라탄 좌석에는 자기 탑 바닥의 자리를 그대로 물려준다 — 옛 값이 남으면
     _positionRideSeat 의 UI 앵커(host.targetX 를 읽는다)가 엉뚱한 자리를 가리킨다. */
  seats.forEach(s=>{ if(s.ridingOn){ const b=rideBenchMod._rideBottom(s); s.targetX = (b && b.targetX) || 0; } });
  const xs = placed.map(s=>s.targetX);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const rowCenter = (minX+maxX)/2;
  const leftIdx = xs.indexOf(minX), rightIdx = xs.indexOf(maxX);
  const halfWidthsForZoom = placed.map(s=>seatDeskHalfWidth(s, true));   // 카메라 줌은 상한선 적용된 값 사용(유난히 큰 책상 하나가 전체를 과하게 줌아웃시키지 않게)
  const rowSpan = Math.max(1.2, (maxX-minX) + halfWidthsForZoom[leftIdx] + halfWidthsForZoom[rightIdx]);   // 카메라 줌 계산용 전체 폭(책상 폭까지 포함)
  _cachedRowCenter = rowCenter; _cachedRowSpan = rowSpan;   // 다음번 updateCameraOnly()가 재사용할 수 있게 캐시
  applyCameraAndCanvas(rowCenter, rowSpan);
}
// ★ 캐릭터 크기 슬라이더처럼 "좌석 배치는 그대로고 카메라 거리/줌만 다시 계산하면 되는" 경우 전용 —
//   위 layoutSeats()의 무거운 책상 실측(Box3, updateMatrixWorld)을 건너뛰고, 마지막으로 계산해둔
//   좌석 배치 결과(_cachedRowCenter/_cachedRowSpan)만 재사용해서 카메라만 훨씬 가볍게 갱신함.
//   (슬라이더를 빠르게 움직이면 무거운 계산이 밀려서 버벅이던/깜빡이던 문제 해결)
function updateCameraOnly(){
  applyCameraAndCanvas(_cachedRowCenter, _cachedRowSpan);
}
function applyCameraAndCanvas(rowCenter, rowSpan){
  // 카메라가 바라보는 중심(c.y)을 살짝 낮춰서 바닥이 화면 중앙에 오도록 유도
  const c = new THREE.Vector3(rowCenter, 0.5, 0); 
  const sz = new THREE.Vector3(rowSpan, 1.4, 0.8);
  
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
    /* 🍎🪟 실행 화면은 **화면 전체 크기**의 투명 캔버스다. DPR 2 면 픽셀이 4배 — 안티앨리어싱 · 로그 깊이 버퍼까지 얹혀
       가장 큰 상시 비용이다([Mac 제보 2026-09-23 «굉장히 버벅인다»] · [Windows 제보 «켜 두면 크롬이 버벅인다»]).
       mac · Windows 모두 FrameBudget.RUN_MAX_PR(1.5 = 픽셀 56%)로 누른다. 도트 렌더면 1.
       ⚠️ 캐릭터가 조금 덜 선명해질 수 있다 — 실기기에서 보고 조정. */
    const wantPR = FrameBudget.runPixelRatio(devicePixelRatio, dotRenderEnabled);
    if(renderer.getPixelRatio() !== wantPR) renderer.setPixelRatio(wantPR);
    canvas.style.imageRendering = dotRenderEnabled ? 'pixelated' : 'auto';
  } else {
    canvasH=Math.min(Math.round(contentH*PXW), innerHeight-40);
    canvasW=Math.min(Math.round(contentW*PXW), innerWidth-36);
  }
  const aspect=canvasW/canvasH;

  // 🔭 실행 화면 화각(FOV, 도 단위) — "퍼스(원근감)" 조절 손잡이. ★실행 화면에서만 적용★
  //   숫자를 키우면 광각(원근 강함·깊이감↑), 줄이면 망원(납작). 취향껏 40~70 사이에서 조절.
  //   dist 계산이 이 값을 기준으로 카메라 거리를 자동 보정하므로 캐릭터 화면 크기는 거의 그대로.
  //   런처 슬롯 미리보기는 기존 34도 유지 — 거긴 바꿀 필요가 없어서 실행 화면과 분리함.
  const RUN_FOV_DEG = 50;
  const fovDeg = _deskRun ? RUN_FOV_DEG : 34;
  const fov=fovDeg*Math.PI/180;
  camera.fov = fovDeg;   // 투영 행렬에도 반영 (이름표/클릭 판정이 같은 행렬을 씀)
  // ★ 카메라 줌 배율 — 숫자를 키우면 캐릭터가 화면에 더 크게(카메라가 더 가깝게), 줄이면 더 작게(멀게) 보임.
  //   "지금보다 두 배 크게" 요청으로 2로 설정 — dist(카메라 거리)를 이 값으로 나눠서 가깝게 당겨옴.
  const CAMERA_ZOOM = 2;
  let dist;
  if(_deskRun){
    // 전체화면 캔버스에서도 캐릭터 크기를 이전(작은 캔버스)과 비슷하게 유지: 캔버스가 커진 배율만큼 카메라를 뒤로.
    const prevCanvasH = Math.min(Math.round(contentH*PXW), innerHeight-40);
    const zoomOut = canvasH / Math.max(1, prevCanvasH);
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=(Math.max(distV,distH)+sz.z*0.45) * zoomOut / Math.max(0.1,focusCharScale) / CAMERA_ZOOM;
  } else {
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=(Math.max(distV,distH)+sz.z*0.45) / CAMERA_ZOOM;
  }
  
  // [수정] 카메라 각도 설정
  // 상하 각도 — 실행 화면은 사용자가 조정한 로우앵글(-0.2), 런처 슬롯 미리보기는 기존 각도 유지.
  const pitch = _deskRun ? 0.09 : 0.09;   // 실행 화면: 사용자 확정값
  const yaw = 5 * Math.PI / 180; // 좌우 각도 (우측으로 15도)
  
  camera.aspect=aspect;
  camera.position.set(
    c.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    c.y + Math.sin(pitch) * dist,
    c.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  let tx=c.x, ty=c.y, tz=c.z;
  if(_deskRun){
    const viewH = 2 * dist * Math.tan(fov/2);
    const viewW = viewH * aspect;
    // deskPanX/Y는 "뷰 비율"(unitless fraction) — 캐릭터 크기(focusCharScale)가 바뀌어도 항상 같은 화면 비율 위치 유지.
    const panX = viewW * (-0.34 + deskPanX);   // 기본: 좌측 + 사용자 오프셋(비율)
    const panY = viewH * (0.28 + deskPanY);    // 기본: 하단 + 사용자 오프셋(비율)
    // 🔭 축 분리 배치 — 좌우와 상하를 다른 방식으로 처리.
    //   · 좌우(X): 카메라 이동과 뷰 오프셋을 "섞어서" 원근 강도를 조절.
    //     SIDE_PERSP = 좌우 원근 강도 손잡이 (0.0=어느 위치든 각도 완전 고정, 1.0=위치 따라 최대로 변함).
    //     1.0이 너무 과하다는 피드백 → 0.4로. 취향껏 0.2~0.6 사이에서 조절.
    //   · 상하(Y): 뷰 오프셋(오프센터 투영) — 캐릭터가 화면 위/아래 어디에 있든
    //     상하 앵글(pitch)은 설정한 값 그대로 고정(내려다보이는 왜곡 없음).
    const SIDE_PERSP = 0.4;
    /* 🧱 [제보] 캐릭터를 화면 왼쪽 벽에 바싹 붙이면 각도가 너무 심해져서 책상이 캐릭터를 가린다.
       [원인] panXCam(카메라가 실제로 옮겨가는 양)이 panX에 **비례**해서 끝없이 커졌다.
         멀리 밀수록 옆에서 보게 되고, 옆에서 볼수록 앞의 책상이 몸을 덮는다. 화면 끝일수록
         가장 심해지는데, 하필 거기가 사람들이 캐릭터를 치워두는 자리다.
       [대응] 카메라가 옮겨가는 양에 상한을 둔다. 상한을 넘는 몫은 전부 화면 밀기(오프센터 투영)로
         보낸다 — 그쪽은 각도를 전혀 안 건드리므로 캐릭터는 계속 그 자리로 가되 각도만 안 심해진다.
       ★ 상한값은 '기본 위치(-0.34)에서의 각도'로 잡았다. 즉 **아무리 밀어도 기본 배치보다
         더 비스듬해지지 않는다.** 기본 위치에서의 모습은 예전과 완전히 동일하다 = 회귀 없음.
       ⚠️ SIDE_PERSP 를 만지면 이 상한도 같이 봐야 한다. 둘은 같은 기본 위치(0.34)를 기준으로 짝지어져 있다. */
    const SIDE_PERSP_CAP = viewW * 0.34 * SIDE_PERSP;
    const panXCam = Math.max(-SIDE_PERSP_CAP, Math.min(SIDE_PERSP_CAP, panX * SIDE_PERSP));
    const camPanX = panXCam * Math.cos(yaw);
    tx += camPanX; camera.position.x += camPanX;
    tz -= panXCam * Math.sin(yaw); camera.position.z -= panXCam * Math.sin(yaw);
    // 카메라가 못 간 몫은 전부 화면 밀기로 — (panX - panXCam) 이라 상한에 걸려도 목표 위치는 정확히 맞는다
    const offX =  ((panX - panXCam) / viewW) * canvasW;   // 나머지는 화면만 밀기(각도 불변)
    const offY = -(panY / viewH) * canvasH;
    camera.setViewOffset(canvasW, canvasH, offX, offY, canvasW, canvasH);
    // 이동 모드에서 픽셀↔월드 정확한 변환을 위해 매 프레임 계산값을 전역에 노출
    _deskViewH = viewH; _deskCanvasH = canvasH;
  } else if(camera.view){
    camera.clearViewOffset();   // 실행 화면이 아니면 오프셋 잔존 방지 (미리보기 등)
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
    applyPS1Shader(true);           // 🕹️ PS1 감성 — 색 양자화 + Bayer 디더링 주입
  } else {
    renderer.setSize(canvasW, canvasH, false);
    if(_deskRun){ applyDotTextureFilter(false); applyPS1Shader(false); }
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
            if(!tex.userData) tex.userData={};   // 정상 THREE.Texture는 항상 있지만, 예외적인 텍스처 대비 방어코드(크래시 방지)
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

/* ═══════════════ 🕹️ PS1 감성 — 색 양자화 + Bayer 디더링 (도트 모드 전용) ═══════════════
   후처리(EffectComposer)를 쓰지 않고 각 머티리얼 프래그먼트 셰이더 끝에 색 처리 코드를 주입한다.
   → 투명 배경(알파)을 건드리지 않아 이 앱의 오버레이 구조와 충돌하지 않고, GPU에서 처리돼 가볍다.
   · 양자화: 채널당 5bit(32단계, RGB555) — 실제 PS1 컬러 뎁스.
   · 디더링: 4×4 Bayer 순서형 패턴 — PS1 특유의 격자 디더. gl_FragCoord(화면 픽셀)로 인덱싱.
   도트 모드를 켤 때만 적용하고, 끄면 원본 셰이더로 복구(needsUpdate로 재컴파일). */
const _PS1_LEVELS = 16.0;   // 채널당 색 단계. 16=PS1 디더가 눈에 보이는 균형점. 32=미세(RGB555), 8=강한 포스터화.
// gl_FragColor를 양자화 직전에 Bayer 디더로 흩뿌린 뒤 단계로 스냅.
const _PS1_FRAG_INJECT = [
  '#include <dithering_fragment>',
  '{',
  '  // 4x4 Bayer 임계값 행렬(0~15 정규화). 화면 픽셀 좌표로 인덱싱해 격자 디더.',
  '  float _bayer[16];',
  '  _bayer[0]=0.0;  _bayer[1]=8.0;  _bayer[2]=2.0;  _bayer[3]=10.0;',
  '  _bayer[4]=12.0; _bayer[5]=4.0;  _bayer[6]=14.0; _bayer[7]=6.0;',
  '  _bayer[8]=3.0;  _bayer[9]=11.0; _bayer[10]=1.0; _bayer[11]=9.0;',
  '  _bayer[12]=15.0;_bayer[13]=7.0; _bayer[14]=13.0;_bayer[15]=5.0;',
  '  int _bx = int(mod(gl_FragCoord.x, 4.0));',
  '  int _by = int(mod(gl_FragCoord.y, 4.0));',
  '  int _bi = _by*4 + _bx;',
  '  float _thr = 0.0;',
  '  for(int _bk=0;_bk<16;_bk++){ if(_bk==_bi){ _thr = _bayer[_bk]/16.0; } }',
  '  float _levels = ' + _PS1_LEVELS.toFixed(1) + ';',
  '  // 디더 오프셋(±0.5단계)을 더한 뒤 단계로 스냅 → 경계가 격자 패턴으로 흩어짐.',
  '  vec3 _dithered = gl_FragColor.rgb + vec3((_thr - 0.5) / _levels);',
  '  vec3 _snapped = floor(_dithered * _levels + 0.5) / _levels;',
  '  gl_FragColor.rgb = clamp(_snapped, 0.0, 1.0);',
  '}'
].join('\n');

let _ps1State = null;   // 중복 적용 방지
function applyPS1Shader(on){
  if(_ps1State === on) return;
  _ps1State = on;
  scene.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m=>{
      if(!m) return;
      if(on){
        if(m.userData && m.userData._ps1Hooked) return;   // 이미 주입됨
        if(!m.userData) m.userData = {};
        m.userData._ps1PrevOBC = m.onBeforeCompile;       // 기존 onBeforeCompile 보존(있으면 체인)
        m.onBeforeCompile = (shader, renderer)=>{
          if(typeof m.userData._ps1PrevOBC === 'function'){ try{ m.userData._ps1PrevOBC(shader, renderer); }catch(_){} }
          // dithering_fragment(three 기본 훅) 자리를 우리 코드로 교체 — 최종 색 확정 직후 지점.
          if(shader.fragmentShader.indexOf('#include <dithering_fragment>') >= 0){
            shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', _PS1_FRAG_INJECT);
          } else {
            // 훅이 없으면(일부 머티리얼) 마지막 } 앞에 삽입 — gl_FragColor는 이미 확정돼 있음.
            shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, _PS1_FRAG_INJECT.replace('#include <dithering_fragment>','') + '\n}');
          }
        };
        m.userData._ps1Hooked = true;
        m.needsUpdate = true;   // 셰이더 재컴파일 유도
      } else {
        if(m.userData && m.userData._ps1Hooked){
          m.onBeforeCompile = (typeof m.userData._ps1PrevOBC === 'function') ? m.userData._ps1PrevOBC : function(){};
          m.userData._ps1Hooked = false;
          m.needsUpdate = true;
        }
      }
    });
  });
}

/* ============================================================ FIT */

// ★ 캐릭터 크기 측정 공용 헬퍼 — 리깅(스키닝) 파츠 메쉬 **와 꾸미기 파츠 wrapper 하위**를 제외하고 잼.
//   즉 이 박스는 '맨 몸' 이다. 파츠를 무엇을 달아도 캐릭터 키는 항상 1.45 로 고정된다.
//   Box3.setFromObject는 SkinnedMesh의 "스키닝 전 원시 지오메트리" 박스를 재는데, 리깅 파츠는
//   본이 렌더 시점에 몸 크기로 줄여 입히므로 원시 박스가 실제보다 몇 배씩 클 수 있음(cape 장착 후
//   refH가 1.5→9.1로 폭증해 캐릭터가 극소화되던 버그의 원인). 리깅 파츠는 어차피 몸에 밀착되므로
//   크기 계산에서 빼도 안전.
/* 🎩 '머리가 아니라 머리에 얹힌 것' — 기본 GLB 에 들어 있는 장식 메쉬들.
   [왜 목록이 하나여야 하나] 이 넷은 **가시성과 무관하게** 머리 꼭대기 측정에서 빠져야 한다.
     같은 부위의 꾸미기 파츠를 끼면 applyClothVisibility 가 이 메쉬를 숨기는데(_setVis),
     측정이 '숨은 메쉬 제외' 규칙을 쓰므로 그 순간 머리 꼭대기가 모자 두께만큼 낮아졌다.
     그러면 **파츠를 쓰고 벗을 때마다 위에 얹힌 캐릭터가 오르내린다** — 이게 제보된 증상이다.
     (가챠 파츠 자신은 __partWrap_ 이라 애초에 측정에서 빠지므로 그 높이를 대신 채워주지도 않는다.)
   [왜 '숨은 것만 예외로 포함'이 아니라 '항상 제외'인가]
     ① 포함하는 방향은 숨은 기본 모자가 씌운 파츠보다 높을 때 **아무것도 없는 허공에 얹히는**
        옛 사고를 되살린다. 빼는 방향은 실루엣보다 위로 부풀 수가 없어 구조적으로 안전하다.
     ② '가챠 파츠 위에는 안 얹는다'(measureHeadBoxNoParts 주석)는 규칙이 이미 서 있다.
        기본 모자만 예외로 세는 지금이 오히려 일관성이 없다.
     ③ _headTopAboveBone 이 같은 이유로 이미 같은 목록을 쓰고 있었다(실측: 기본 모자를 포함하면
        인간 base GLB 머리 꼭대기가 3.994 → 4.099 로 부풀었다). 그 목록을 여기로 올려 하나로 합친다.
   ⚠️ 목록을 두 벌로 만들지 말 것 — 한쪽에만 항목을 더하면 두 측정이 그만큼 어긋난다.
   ⚠️ 대가: 기본 모자가 있고 파츠는 안 낀 캐릭터는 탑승 위치가 모자 두께만큼(정규화 후 약 0.04)
      낮아진다. '모자 위'가 아니라 '머리 위'에 앉는다 — 의도한 변경이다.
   ⚠️ 인간·동물 공통 경로다. 한쪽만 고치면 안 된다.
   ⚠️ 측정은 올라탈 때 1회 캐싱이다. 확인할 때는 반드시 **내렸다 다시 올려서** 볼 것. */
const HEAD_DECOR_MESH_KEYS = ['hatMesh','maskMesh','glassesMesh','wingMesh'];
const _EMPTY_MESH_SET = new Set();
function headDecorMeshSet(meshHost){
  if(!meshHost) return _EMPTY_MESH_SET;             // 좌석을 안 준 호출부는 예전 그대로 동작한다
  const s = new Set();
  HEAD_DECOR_MESH_KEYS.forEach(k=>{ if(meshHost[k]) s.add(meshHost[k]); });
  return s.size ? s : _EMPTY_MESH_SET;
}
/* 🎪 올라타기 전용 — 꾸미기 파츠까지 빼고 '맨 머리' 꼭대기를 잰다.
   measureCharBox는 리깅 파츠(귀 등)만 제외해서, 머리 위에 얹는 장식(뿔·모자·안테나 등)을 쓰면
   그 끝이 박스 꼭대기가 되어 올라탄 동물이 공중에 뜬 것처럼 보였다.
   파츠는 '__partWrap_' 이름의 wrapper로 감싸 붙으므로 그 하위를 통째로 건너뛴다. */
/* @param outBoxes 배열을 주면 '통과한 메쉬 하나하나의 박스'를 담아 준다.
   합친 박스만으로는 알 수 없는 것을 재기 위한 것 — 특히 '꼭대기 근처에 있는 메쉬만'을 골라
   앞뒤 중심을 다시 잡는 데 쓴다(_measureHostHeadTop 의 _headTopCenterZ). */
/* @param meshHost 좌석(또는 인스턴스)을 주면 **기본 장식 메쉬**(모자·탈·안경·날개)를
     가시성과 무관하게 측정에서 뺀다. HEAD_DECOR_MESH_KEYS 주석 참고. */
function measureHeadBoxNoParts(root, outBoxes, meshHost){
  const box=new THREE.Box3(); const tmp=new THREE.Box3();
  const decor = headDecorMeshSet(meshHost);
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{
    if(!o.isMesh) return;
    if(decor.has(o)) return;                         // 기본 장식 메쉬 — 보이든 숨었든 항상 제외
    if(o.userData && o.userData._origBind) return;   // 리깅 파츠의 스킨드메시
    let p=o, skip=false;
    while(p && p!==root){
      // ★ 숨겨진 메쉬는 제외 — 이 검사가 없어서 "머리 위에 얹으면 뜨는" 문제가 났다.
      //   옷을 입으면 applyClothVisibility가 기본 몸 메쉬를 숨기고, 자리비움 페이드도 메쉬를 숨기는데,
      //   그 숨은 메쉬가 보이는 실루엣보다 위로 뻗어 있으면 머리 꼭대기가 부풀려져 그만큼 위 캐릭터가 떴다.
      //   (조상이 숨겨져도 자식은 안 보이므로 부모 사슬 전체를 확인한다.)
      if(p.visible === false){ skip=true; break; }
      if(p.userData && p.userData.rigged){ skip=true; break; }                       // 리깅 파츠(귀 등)
      if(typeof p.name==='string' && p.name.indexOf('__partWrap_')===0){ skip=true; break; }   // 꾸미기 파츠
      p=p.parent;
    }
    if(skip || o.visible === false) return;
    try{ tmp.setFromObject(o); if(!tmp.isEmpty()){ box.union(tmp); if(outBoxes) outBoxes.push(tmp.clone()); } }catch(_){}
  });
  return box;
}
function measureCharBox(root){
  const box=new THREE.Box3(); const tmp=new THREE.Box3();
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{
    if(!o.isMesh) return;
    if(o.userData && o.userData._origBind) return;   // 리깅 파츠의 스킨드메시
    let p=o, skip=false;
    while(p && p!==root){
      if(p.userData && p.userData.rigged){ skip=true; break; }                      // 리깅 wrapper 하위 전부 제외
      /* 🎩 꾸미기 파츠 wrapper 하위도 제외 — measureHeadBoxNoParts 와 같은 판정.
         [왜] 이 박스는 캐릭터를 '키 1.45' 로 정규화하는 분모(fitModel 의 baseScale)와
           앞뒤·좌우 센터링 기준(c.x·c.z)을 동시에 정한다. 파츠를 세면 그 분모가
           '몸 + 파츠' 가 되어, 착용한 파츠에 따라 캐릭터 자체가 줄었다 늘었다 한다.
           욕조처럼 발밑으로 내려가는 파츠는 깊이 0.5 만 되어도 1.45/1.95 = 0.74 배로
           캐릭터가 작아졌다 — 좌석 크기(userScale)를 고정해 둬도 그 위에 곱해지므로
           "월드 바닥에서 캐릭터 키가 사람마다 제각각" 의 정체가 이것이다.
         ★ 파츠는 이 root 의 자손이므로 배율·센터링을 그대로 물려받는다. 측정에서만 빠지고
           화면에서는 몸과 같은 비율로 커지므로, 사용자가 맞춰둔 xf 를 다시 조정할 필요가 없다.
         ★ 센터링(c.x·c.z)도 같이 파츠와 무관해진다 — 모자/탈을 달고 뺄 때마다 c.z 가 흔들려
           캐릭터가 앞뒤로 밀리던 문제(fitModel 의 그 ⚠️ 주석)가 함께 사라진다.
         ⚠️ fitCreator 도 이 함수를 쓴다 — 그래서 생성기 미리보기와 실행 화면이 함께 맞는다.
           한쪽만 고치면 두 화면이 파츠 크기만큼 어긋난다. */
      if(typeof p.name==='string' && p.name.indexOf('__partWrap_')===0){ skip=true; break; }
      if(p.userData && p.userData.__twPartWrap){ skip=true; break; }                 // 이름이 바뀌어도 표식으로 잡는다
      p=p.parent;
    }
    if(skip) return;
    try{ tmp.setFromObject(o); if(!tmp.isEmpty()) box.union(tmp); }catch(_){}
  });
  return box;
}
/* 🦶 발밑보다 아래로 내려간 깊이 — 욕조·방석처럼 **발 아래에 두는 파츠** 때문에
     캐릭터마다 바닥선이 제각각이 되는 것을 막는다. 이 값만큼 모델을 들어 올리면
     '가장 아래에 있는 것'이 바닥에 닿는다.

   ★ 모델 원점(피봇)이 발바닥이라는 점이 이 보정의 전부다. 발 아래에 아무것도 없으면 이 값은 0이고
     보정은 통째로 무동작이다 — **기존 캐릭터는 한 픽셀도 안 움직인다.**
     바닥을 min.y 로 다시 잡는 방식이었다면 메쉬 오차가 있는 모든 캐릭터가 같이 들썩였을 것이다.
     (fitModel 이 일부러 min.y 를 안 쓰고 피봇을 쓰는 이유가 그것이다 — 그 결정을 뒤집지 않는다.)
   ★ 파츠 위치를 손으로 맞춰 이미 바닥에 딱 붙여 둔 사람도 깊이가 0이라 그대로다.
     어긋난 만큼만 움직인다.

   ⚠️ 숨은 메쉬를 세면 안 된다 — 옷을 입으면 기본 몸 메쉬가 숨고 자리비움 페이드도 메쉬를 숨긴다.
     그게 발 아래로 뻗어 있으면 보이지도 않는 것 때문에 캐릭터가 떠오른다
     (머리 위 파츠에서 똑같은 사고가 났었다 — measureHeadBoxNoParts 주석 참고).
   ⚠️ 리깅(스키닝) 파츠는 제외한다. Box3 는 스키닝 **전** 원시 박스를 재기 때문에 발 아래로
     몇 배씩 뻗은 값이 나온다(measureCharBox 가 같은 이유로 제외한다).
   ⚠️ 책상 파츠(deskitem)는 seat.deskAnchor 에 붙어 gltfRoot 밖에 있으므로 애초에 안 잡힌다 —
     책상은 바닥에 맞출 대상이 아니므로 그게 맞다. */
const FLOOR_SNAP_MAX = 1.2;      // 저작이 어긋난 파츠 하나 때문에 캐릭터가 하늘로 뜨는 것 방지(캐릭터 키가 1.45)
const FLOOR_SNAP_MIN = 0.005;    // 이보다 얕으면 수치 오차로 보고 안 건드린다
function measureUnderfootDepth(root){
  const tmp = new THREE.Box3();
  let bottom = 0;
  try{
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{
      if(!o.isMesh || o.visible === false) return;
      if(o.userData && o.userData._origBind) return;      // 리깅 파츠의 스킨드메시
      let p=o, skip=false;
      while(p && p!==root){
        if(p.visible === false){ skip=true; break; }       // 조상이 숨겨져도 화면엔 안 보인다
        if(p.userData && p.userData.rigged){ skip=true; break; }
        p=p.parent;
      }
      if(skip) return;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty() && tmp.min.y < bottom) bottom = tmp.min.y; }catch(_){}
    });
  }catch(_){ return 0; }
  const depth = -bottom;
  if(!(depth > FLOOR_SNAP_MIN)) return 0;
  if(depth > FLOOR_SNAP_MAX){
    console.warn('[바닥맞춤] 발밑 깊이가 비정상적으로 큼 — ' + depth.toFixed(2) + ' → ' + FLOOR_SNAP_MAX + ' 로 제한');
    return FLOOR_SNAP_MAX;
  }
  return depth;
}
/* 🦶 피봇 보정 — "피봇이 곧 발바닥"이 아닌 모델을 발바닥 기준으로 되돌린다.
   [왜] fitModel·fitCreator·꾸미기 미리보기는 모두 **모델 원점(피봇)을 발바닥으로 치고**
     거기에 높이(xf.y)를 얹는다. 그런데 사람 GLB 는 피봇이 메쉬 바닥보다 0.048(정규화 로컬)
     아래에 있어서, 그만큼 늘 공중에 떠 있었다.
     [실측] 실행 사람 발 0.0202(wrap 0.42) · 0.0245(wrap 0.51) → 0.0202/0.42 = 0.0481,
            0.0245/0.51 = 0.0480 으로 **같다**. 크기와 무관한 모델 로컬 상수 = 피봇 어긋남.
            동물은 buildAnimalBase 가 절차적으로 만들어 거의 정확히 0 이었다.
   [무엇을 하나] 몸 박스(measureCharBox — 파츠 제외)의 바닥이 원점에 오도록 되돌릴 양을 준다.
     그래서 사람은 0.048×wrap 만큼 내려오고, 동물·커미션은 원래 0 에 가까우면 거의 안 움직인다.
   ⚠️ **네 곳이 짝이다** — fitModel · fitCreator('edit') · fitCreator('app') · refreshWdPreviewChar.
     한 곳만 넣으면 이번에 맞춘 생성기↔실행 높이가 그 양만큼 다시 갈린다.
   ⚠️ 박스는 **그 객체가 y=0 에 있을 때** 잰 것이어야 한다(부모는 항등). 위 네 곳이 그 상태다.
   ⚠️ 발밑 파츠(욕조 등)는 measureUnderfootDepth 가 따로 본다 — 여기서는 몸만 본다.
   ⚠️ 커미션 GLB 는 안 보이는 여분 메쉬로 박스가 엉뚱하게 커지는 사례가 있다(COMMISSION_SCALE_CORRECTION
     주석 참고). 그런 모델을 그대로 따라가면 캐릭터가 통째로 솟으므로, 키 대비 일정 비율을
     넘으면 **보정을 포기하고 예전 동작(0)** 으로 둔다. 조용히 틀리는 것보다 안 고치는 게 낫다. */
const FOOT_FIX_MAX_RATIO = 0.12;   // 몸 높이의 12% — 사람의 실측값 0.048/1.45 ≒ 3.3% 의 세 배 남짓
function charFootFix(box){
  if(!box) return 0;
  if(typeof box.isEmpty === 'function' && box.isEmpty()) return 0;   // ⚠️ `box.isEmpty ||` 로 쓰면 **항상 0** 이 된다(메서드는 늘 truthy)
  const h = box.max.y - box.min.y;
  const d = -box.min.y;
  if(!isFinite(d) || d === 0) return 0;
  if(h > 1e-6 && Math.abs(d) > h * FOOT_FIX_MAX_RATIO){
    console.warn('[발바닥] 피봇과 메쉬 바닥 차이가 너무 큼 — ' + d.toFixed(4)
      + ' (키 ' + h.toFixed(3) + ') → 보정하지 않습니다');
    return 0;
  }
  return d;
}
/* 📐 root 의 월드 박스를 재되, skipSub 가 true 인 가지는 **통째로** 뺀다.
   [왜 필요한가] 바닥 클램프는 "잰 것"과 "움직이는 것"이 같아야 성립한다. 둘이 다르면
     올려도 잰 값이 안 따라와서 **매 프레임 다시 올리는 되먹임**이 된다 — 제보 2-1의 "하늘로 솟음". */
function _boxExcluding(root, skipSub){
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  try{
    root.updateWorldMatrix(true, true);
    const walk = o=>{
      if(o !== root && (o.visible === false || skipSub(o))) return;   // 이 가지는 통째로 건너뛴다
      if(o.isMesh){ try{ tmp.setFromObject(o); if(!tmp.isEmpty()) box.union(tmp); }catch(_){} }
      const ch = o.children || [];
      for(let i=0;i<ch.length;i++) walk(ch[i]);
    };
    walk(root);
  }catch(_){}
  return box;
}
/* 🪑🦶 wrapper 하나를 **월드 바닥(y=0)** 위로 끌어올린다 — 아래로 내려간 만큼만 움직인다.
   [어디서 쓰는가] 두 곳이며, 반드시 같은 식이어야 한다.
     ① applyPartXf — 부착·xf 적용 직후(미리보기·실행 양쪽이 이 경로를 지난다)
     ② syncWdGizmoToXf — 미리보기에서 기즈모를 드래그하는 동안. 여기서 걸어야 저장되는 xf 값이
        화면에 보이는 자리와 같아진다(안 걸면 "아래로 끌어도 안 내려가는데 숫자만 계속 줄어드는"
        상태가 되고, 다음에 열 때 그 숫자가 그대로 되살아난다).
   ★ 기준은 월드 y=0 이다. deskAnchor 기준이 아니다 — 책상 밑에 놓는 파츠(쓰레기통 등)는 앵커보다
     아래에 있는 게 맞고, 바닥보다 아래인 것만 잘못이다.
   ★ 이미 바닥에 맞춰 둔 파츠는 깊이가 0 이라 그대로다 — 어긋난 만큼만 움직인다.
   ⚠️ 월드에서 잰 깊이를 부모 배율로 환산해 로컬 y 에 더한다. deskAnchor 는 책상 그룹의 자식이라
     setDeskScale 배율(보통 0.175)을 물려받는다 — 환산을 빼먹으면 약 5.7배로 들어 올려 날아간다.
   @param hard 상한(FLOOR_SNAP_MAX)을 무시하고 **끝까지** 끌어올린다.
     기즈모 드래그처럼 사람이 직접 끌고 있는 경우에 쓴다 — 상한을 두면 1.2 를 넘게 끌어내린 순간
     클램프가 손을 놓아 바닥을 그대로 뚫고 지나간다(막으려던 바로 그 동작이 된다).
     상한은 '저작이 어긋난 파츠가 스스로 하늘로 뜨는 것' 을 막기 위한 것이므로 자동 경로에만 필요하다.
   @param skipSub 측정에서 뺄 가지를 고르는 함수. **w 를 올려도 같이 안 올라가는 것만** 뺀다
     (_boxExcluding 주석 참고). 안 넘기면 예전처럼 전부 잰다.
   @return 실제로 올린 로컬 y 양(0 이면 무동작) */
function floorClampWrapper(w, tag, hard, skipSub){
  if(!w) return 0;
  try{
    w.updateWorldMatrix(true, true);
    const b = skipSub ? _boxExcluding(w, skipSub) : new THREE.Box3().setFromObject(w);
    if(b.isEmpty()) return 0;
    const d = -b.min.y;                            // 바닥 아래로 내려간 깊이
    if(!(d > FLOOR_SNAP_MIN)) return 0;             // 오차 수준이면 안 건드린다
    if(!hard && d > FLOOR_SNAP_MAX){
      console.warn('[바닥맞춤·책상파츠] ' + (tag||'') + ' 깊이가 비정상 — ' + d.toFixed(2)
        + ' → ' + FLOOR_SNAP_MAX + ' 로 제한');
    }
    const _ws = new THREE.Vector3();
    (w.parent || w).getWorldScale(_ws);
    const k = (isFinite(_ws.y) && Math.abs(_ws.y) > 1e-6) ? _ws.y : 1;
    const dy = (hard ? d : Math.min(d, FLOOR_SNAP_MAX)) / k;
    w.position.y += dy;
    w.updateWorldMatrix(true, true);
    return dy;
  }catch(_){ return 0; }
}
/* 🩺 바닥 맞춤 진단 — 콘솔에서 `floorSnapReport()` 한 줄로 미리보기와 실행 화면을 나란히 본다.
   [왜 필요한가] "파츠가 바닥에 가라앉아 있다"의 원인 후보가 셋이고, 겉보기로는 구분이 안 된다.
     ① 파츠가 측정에서 **제외**되고 있다(숨은 메쉬·리깅 표식) → depth 가 0 으로 나온다
     ② 측정은 맞는데 fitModel 이 **안 불렸다**(붙는 시점이 재계산보다 늦다) → 지금 재보면 0 이 아니다
     ③ 미리보기와 실행이 **다른 값**을 쓴다 → 두 쪽 depth·position 이 다르다
   이 보고서는 셋을 한 번에 가른다. 발밑으로 내려간 메쉬를 전부 나열하고, 제외된 것은 그 이유까지 적는다.
   ⚠️ 진단 전용이다 — 아무것도 고치지 않고 화면도 안 건드린다. */
function _floorSnapProbe(root){
  const out = { depth:null, meshes:[], counted:0, skipped:0 };
  if(!root) return out;
  const tmp = new THREE.Box3();
  try{ root.updateWorldMatrix(true,true); }catch(_){}
  try{
    root.traverse(o=>{
      if(!o.isMesh) return;
      let why = null;
      if(o.visible === false) why = '자기 자신이 숨김';
      else if(o.userData && o.userData._origBind) why = '리깅 파츠의 스킨드메시';
      else {
        let p = o;
        while(p && p !== root){
          if(p.visible === false){ why = '조상이 숨김(' + (p.name||'이름없음') + ')'; break; }
          if(p.userData && p.userData.rigged){ why = '리깅 파츠(' + (p.name||'이름없음') + ')'; break; }
          p = p.parent;
        }
      }
      let minY = null;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()) minY = tmp.min.y; }catch(_){}
      if(why) out.skipped++; else out.counted++;
      // 발밑으로 내려간 것만 보고한다 — 위쪽 메쉬까지 찍으면 목록이 길어져 읽을 수가 없다
      if(minY != null && minY < -0.001){
        let wrap = null;
        for(let q = o; q && q !== root; q = q.parent){
          if(typeof q.name === 'string' && q.name.indexOf('__partWrap_') === 0){ wrap = q.name; break; }
        }
        out.meshes.push({ name:o.name || '(이름없음)', minY:+minY.toFixed(4), wrap:wrap || '(캐릭터 본체)', skip:why });
      }
    });
  }catch(_){}
  try{ out.depth = measureUnderfootDepth(root); }catch(_){}
  return out;
}
function floorSnapReport(){
  const f = v => (v == null ? 'null' : (+v).toFixed(4));
  /* 좌석마다 이름이 다르다 — 실제 좌석은 gltfRoot, 꾸미기 미리보기는 root 다(그 객체 리터럴 참고).
     앞 판(gltfRoot 만 보던 것)은 그래서 둘 다 '모델 없음' 으로 떨어졌다. */
  const modelOf = s => s ? (s.gltfRoot || s.modelRoot || s.root || null) : null;
  /* 파츠 wrapper 를 전부 찾아 **월드 최저점**을 적는다. 바닥은 월드 y=0 이므로 음수면 가라앉은 것이다.
     ★ 핵심은 '어디에 매달렸는가'다 — 모델(gltfRoot) 안이면 바닥 맞춤이 걸리고,
       책상 앵커(deskAnchor) 밑이면 모델 밖이라 애초에 측정 대상이 아니다. */
  function wraps(rootNode, model){
    const out = []; if(!rootNode) return out;
    const tmp = new THREE.Box3();
    try{ rootNode.updateWorldMatrix(true,true); }catch(_){}
    rootNode.traverse(o=>{
      if(typeof o.name !== 'string' || o.name.indexOf('__partWrap_') !== 0) return;
      let minY = null;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()) minY = tmp.min.y; }catch(_){}
      let inModel = false, chain = [];
      for(let q = o.parent; q; q = q.parent){
        chain.push(q.name || (q.type||'?'));
        if(model && q === model) inModel = true;
        if(chain.length >= 6) break;
      }
      out.push({ name:o.name, minY, inModel, rigged:!!(o.userData && o.userData.rigged), chain:chain.join(' < ') });
    });
    return out;
  }
  const rows = [];
  const push = (label, seat, extraRoots)=>{
    const model = modelOf(seat);
    if(!seat){ console.log('[바닥맞춤] ' + label + ' — 좌석 없음'); return; }
    let depth = null;
    try{ if(model) depth = measureUnderfootDepth(model); }catch(_){}
    console.log('[바닥맞춤] ' + label
      + ' | 모델노드=' + (model ? (model.name || model.type || 'Group') : '없음')
      + ' | depth=' + f(depth)
      + (model ? (' | 모델 position y=' + f(model.position.y) + ' z=' + f(model.position.z)
                  + ' scale=' + f(model.scale.x)) : '')
      + ' | userZ=' + f(seat.userZ) + ' userScale=' + f(seat.userScale)
      + ' bodyWrap.scale=' + (seat.bodyWrap ? f(seat.bodyWrap.scale.x) : '없음')
      + ' rig.z=' + (seat.rig ? f(seat.rig.position.z) : '없음'));
    const seen = [];
    [seat.group, model, seat.deskGroup, seat.deskAnchor].concat(extraRoots || []).forEach(r=>{
      if(!r || seen.indexOf(r) >= 0) return; seen.push(r);
      wraps(r, model).forEach(w=>{
        if(rows.indexOf(w.name + label) >= 0) return; rows.push(w.name + label);
        console.log('    ' + (w.minY != null && w.minY < -0.001 ? '⬇ 바닥아래' : '  바닥위 ')
          + ' 월드minY=' + f(w.minY)
          + '  ' + w.name
          + '  [' + (w.inModel ? '모델 안 → 바닥맞춤 대상' : '모델 밖 → 측정에서 빠짐') + ']'
          + (w.rigged ? ' (리깅 표식 있음 → 측정 제외)' : '')
          + '  부모사슬: ' + w.chain);
      });
    });
    return depth;
  };
  let dRun = null, dPrev = null;
  try{ dRun = push('실행화면', findMySeat()); }catch(e){ console.log('[바닥맞춤] 실행화면 조회 실패', e); }
  try{ dPrev = push('꾸미기/보관함 미리보기', wardrobeMod.wdPreviewBase(),
        [wardrobeMod.wdScene()]); }catch(e){ console.log('[바닥맞춤] 미리보기 조회 실패', e); }
  if(dRun != null && dPrev != null && Math.abs(dRun - dPrev) > 1e-4){
    console.warn('[바닥맞춤] ⚠️ 실행 depth=' + f(dRun) + ' 미리보기 depth=' + f(dPrev) + ' — 같은 파츠인데 한쪽만 세고 있습니다');
  }
  return '위 로그를 복사해서 보내주세요';
}
try{ window.floorSnapReport = floorSnapReport; }catch(_){}
function fitModel(seat){
  const m=seat.gltfRoot; if(!m) return;
  m.scale.set(1,1,1); m.position.set(0,0,0); m.rotation.set(0,seat.userRot+RIG_TURN,0);
  const sR=seat.rig.position.clone(),sRr=seat.rig.rotation.clone(),sWp=seat.bodyWrap.position.clone(),sG=seat.group.position.clone();
  seat.rig.position.set(0,0,0);seat.rig.rotation.set(0,0,0);seat.bodyWrap.scale.set(1,1,1);seat.bodyWrap.position.set(0,0,0);seat.group.position.set(0,0,0);
  seat.group.updateWorldMatrix(true,true);
  
  const box=measureCharBox(m);   // 표준 리그 통합: base·커미션 동일 경로 (리깅 파츠 제외 측정)
  if(!box.isEmpty()){
    const size=new THREE.Vector3(); box.getSize(size);
    // ★ 커미션 캐릭터 크기 보정 — 블렌더에서 기본 캐릭터와 비슷하게 맞춰 내보내도 실제 화면에선
    //   작게 나오는 경우가 있어서(GLB 안의 안 보이는 여분 메쉬/본으로 바운딩박스가 커지는 등 원인 추정)
    //   COMMISSION_SCALE_CORRECTION만큼 추가로 키움. 이 함수가 실제 실행 화면 크기를 결정함.
    const commCorr = (seat.charDef && seat.charDef.isCommission) ? COMMISSION_SCALE_CORRECTION : 1;
    // 🐾 동물은 인간의 60% 크기로 (확정 스펙). 실행 화면 크기는 이 함수가 최종 결정하므로 여기서 보정.
    const animCorr = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
    // 🐾 동물은 '측정'이 아니라 '확정값'으로 정규화한다.
    //   buildAnimalBase가 normalizeModel(root, 1.4*ANIMAL_RUN_SCALE)로 몸 높이를 이미 고정해두므로
    //   여기서 다시 잴 필요가 없다. 그런데 실측 로그상 재조립 때마다 이 측정값이 0.56 → 0.6975 → 0.649로
    //   흔들렸고(원인 미상), 1.45/측정값 공식이라 그대로 캐릭터 크기 변동으로 이어졌다
    //   (우클릭 편집을 들어갔다 나올 때마다 크기·위치가 바뀌던 실제 원인).
    //   최초 빌드가 내던 이상적인 값 1.45/1.4 = 1.0357을 항상 재현하도록 상수로 고정한다.
    //   ★ 인간·커미션은 기존 측정 경로 그대로 — 이 분기는 동물만 탄다.
    const ANIM_NORM_H = 1.4 * ANIMAL_RUN_SCALE;   // buildAnimalBase가 맞춰놓는 몸 높이(= 0.56)
    const isAnim = !!(seat.charDef && seat.charDef.animal);
    const baseScale = isAnim
      ? (1.45 / ANIM_NORM_H) * animCorr
      : (size.y>1e-4?1.45/size.y:1)*commCorr*animCorr;
    m.scale.setScalar(baseScale);   // 생성기 미리보기와 동일한 정규화 키
    seat.group.updateWorldMatrix(true,true);
    
    // 표준 리그 통합: 모델 자기 박스로 센터링 (BASE_SCENE 보정·진단로그·z-fix 제거)
    const b2=measureCharBox(m); const c=new THREE.Vector3(); b2.getCenter(c);
    // 🐾 동물은 이 재센터링을 건너뛴다.
    //   buildAnimalBase의 normalizeModel이 귀가 붙기 전에 x/z 중앙정렬을 이미 끝내놓기 때문에
    //   결정적(deterministic)이다. 반면 여기서 쓰는 measureCharBox는 재조립마다 결과가 흔들리는데
    //   (실측: 높이 0.56 → 0.7031 → 0.6524), 중심점 c.z도 같이 흔들려서 우클릭 편집을 들어갔다 나올 때마다
    //   캐릭터가 조금씩 '뒤로' 밀려나던 원인이었다. 크기는 확정값으로 막았지만 위치는 여기에 물려 있었음.
    //   ★ 인간·커미션은 기존 동작 그대로 — 아래 분기는 동물만 탄다.
    if(!isAnim){
      m.position.x-=c.x;
      /* 🪑 앞뒤(z) 재센터링은 하지 않는다 — **미리보기가 정답 기준**이기 때문이다.
         [경위] 꾸미기/보관함 미리보기는 캐릭터를 늘 z=0 에 세우고 책상 쪽을 반대로 밀어 간격을 맞춘다
           (_wdDeskGrp.position.z = -CHAR_Z*anim - xf.z). 즉 미리보기에는 이 재센터링 항이 없다.
           그래서 실행 화면에서만 캐릭터가 c.z x bodyWrap.scale 만큼 더 뒤에 서고, 책상 앵커에 매달린
           "책상 위" 파츠가 그만큼 앞에 있는 것처럼 보였다.
         [실측] userZ 0.27 / userScale 0.63 인 캐릭터에서 m.position.z=0.1714 였고
           그 중 userZ/userScale=0.4286, 나머지 -c.z=-0.2572 -> 월드 환산 -0.162.
           제보된 "실행이 더 앞" 의 양이 정확히 이 값이었다.
         ⚠️ 이 값은 **상수가 아니다.** 그래서 눈으로 맞춘 상수로는 때울 수 없고, 항을 없애는 것이
           파츠와 무관해지는 유일한 방법이다.
         ※ 예전 주석: "measureCharBox 는 리깅 파츠만 빼고 재므로 모자/탈 같은 파츠를 달고 뺄 때마다
           c.z 가 달라진다" — 이제 measureCharBox 가 파츠 wrapper 하위를 통째로 빼므로 c.z 자체는
           파츠와 무관하다. 항을 없앤 결정은 그대로 둔다(미리보기가 정답 기준이라는 이유는 유효하다).
         ★ 동물은 원래부터 이 분기를 건너뛰었다(normalizeModel 이 x/z 중앙정렬을 이미 끝내므로).
           즉 동물은 이 변경 전에도 미리보기와 같은 규약이었고, 이제 인간/커미션이 그쪽에 맞춰진 것이다.
         ⚠️ x 도 같은 어긋남을 갖고 있다(미리보기는 -xf.x 만 보상한다). 다만 제보된 증상이 앞뒤라
           z 만 맞춘다. 좌우가 어긋난다는 제보가 오면 같은 이유로 x 도 빼면 되는데, 그때는 캐릭터가
           좌석 슬롯 안에서 좌우로 움직이므로 layoutSeats 와 같이 봐야 한다.
         ⚠️ 되돌리려면 이 줄을 살리면 된다: m.position.z-=c.z; */
    }
    /* 🦶 피봇 보정 — 예전엔 `m.position.y = 0`(피봇=발바닥 전제)이었다. 사람 GLB 는 그 전제가
       깨져 있어 늘 0.048(로컬)만큼 떠 있었다. charFootFix 의 ⚠️ 넷 중 하나 — 나머지 셋은
       fitCreator('edit') · fitCreator('app') · refreshWdPreviewChar. 함께 고칠 것. */
    m.position.y = charFootFix(b2);
    
    // ★ 이 아래에서 seat.bodyWrap.scale이 userScale로 곱해지는데(코드 더 아래 참고), m은 bodyWrap의
    //   자식이라 m.position도 그때 같이 곱해져 버림 — 그래서 캐릭터 크기(userScale)를 1이 아니게 설정한
    //   경우 "앞뒤/좌우" 이동값이 실제로는 userScale배만큼 더 크게 적용되던 버그였음(생성기 미리보기는
    //   이 곱셈이 없어서 그만큼 어긋나 보임). 미리 userScale로 나눠서 그 곱셈을 상쇄시킴.
    /* ⚠️ 여기는 **raw seat.userScale** 이다. seatScale(실효값)로 바꾸지 말 것.
       bodyWrap.scale 이 userScale×k 이므로, raw 로 나눠야 이동량의 월드 값이 userX×k 가 되어
       **책상과 같은 배율로** 함께 줄고 커진다. 실효값으로 나누면 k 가 상쇄되어 캐릭터만 커지고
       앞뒤 위치는 제자리에 남아, 평준화한 좌석에서 캐릭터가 책상을 파고든다. */
    const _uz=(seat.userScale&&isFinite(seat.userScale)&&seat.userScale>0)?seat.userScale:1;
    // 🐾 동물은 캐릭터도 책상도 40%인데 이동량(userX/userZ)만 절대값이라, 40% 책상 기준으로는 2.5배
    //   크게 움직여서 "생성기에서 맞춘 앞뒤 위치"와 실행 화면이 어긋났다(생성기는 동물·책상 모두 100%).
    //   책상과 같은 비율로 줄여서 생성기에서 본 그대로가 되게 함. 인간은 곱셈이 1이라 무변화.
    const _animPos = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
    m.position.x+=((seat.userX||0)*_animPos)/_uz;
  m.position.z+=((seat.userZ||0)*_animPos)/_uz;   // 🚫 userZ 는 폐기돼 항상 0 — 항만 남겨 둔다(되살릴 때 여기 하나)
  // ★ 미세 보정 — 위 나눗셈 수정 후 책상에 살짝 파고드는 느낌이 있다는 피드백에 따라 살짝 뒤로 밀어줌.
  //   숫자를 더 뒤로 보내려면(desk에서 더 멀어지게) 더 음수로, 덜 보내려면 0에 가깝게 조절.
  // ★ 확인 완료된 값 — 캐릭터/책상 거리 보정. 이 숫자는 실측으로 맞춘 값이라 다른 이유 없이 건드리지 말 것.
  //   ★ 커미션 거리 어긋남 수정: 이 nudge도 m.position이라서 아래 bodyWrap.scale(userScale) 곱셈에 같이
  //     스케일되고 있었음 — 캐릭터 크기(xf.s)가 1이 아니면(커미션은 대개 0.7 등) 실효 nudge가 달라져서
  //     미리보기와 책상-캐릭터 거리가 어긋나던 원인. userScale로 미리 나눠 스케일 불변으로 만듦.
  // ★ 예전엔 -0.25 nudge를 뒤로 밀었는데(카메라 앵글 보정용) 미리보기가 정답 기준으로 확정된
  //   지금은 이게 오히려 실행 화면 캐릭터를 미리보기보다 0.25 뒤로 밀어냄(거리 진단 로그로 확인).
  //   미리보기와 완전히 동일한 좌표계로 두기 위해 nudge를 0으로 무효화.
  const FIT_MODEL_Z_NUDGE = 0;
  m.position.z += FIT_MODEL_Z_NUDGE/_uz;
  // ★ 예전의 y 미세보정(-0.05)은 bodyWrap.scale에 곱해져 미리보기보다 캐릭터가 0.03쯤 가라앉게
  //   만들던 원인([배치진단]으로 확인) — 미리보기가 정답 기준이므로 제거(0).
  m.position.y+=0;
  /* 🧍 캐릭터 높이 — 생성기의 높이 슬라이더(cXform.y → def.xf.y → seat.userY).
     ⚠️ x/z 와 **같은 이유로** _uz 로 미리 나눈다. 아래에서 bodyWrap.scale 이 곱해지므로,
       안 나누면 캐릭터 크기를 1 이 아니게 둔 사람만 높이가 userScale 배로 들려 미리보기와 어긋난다.
       (fitCreator·꾸미기 미리보기는 둘 다 g.position.y 에 절대값을 그대로 넣는다 — 거기에 맞춘다.)
     🐾 **_animPos 를 곱한다.** 예전 주석은 "fitCreator 도 동물에 배율을 안 거니까 여기서도 안 건다"
       였는데, 그게 정확히 제보 2의 원인이었다. 생성기는 동물을 **100% 크기**로 보여주고 실행 화면은
       **40%(ANIMAL_RUN_SCALE)** 로 그린다. 그런데 높이만 두 화면 다 절대값이라, 몸이 2.5배 작은
       실행 화면에서 같은 0.27 이 2.5배 크게 들려 보였다.
       [실측] xf.y=0.27 / xf.s=0.94 인 동물에서 — 생성기 몸높이 1.363 · 들림 0.27 (비율 0.1981),
              실행 몸높이 0.5452 · 들림 0.27 (비율 0.4954). 배율은 정확히 1/0.4 = 2.5 였다.
              _animPos 를 곱하면 실행 들림이 0.108 → 비율 0.1981 로 생성기와 **정확히** 같아진다.
       ⚠️ x/z 는 이미 _animPos 를 곱하고 있었다(바로 위 두 줄). y 만 빠져 있었던 것이다.
       ⚠️ 인간·커미션은 _animPos 가 1 이라 **아무 변화 없다.**
       ⚠️ charLiftWorld 도 **같이** 바꿔야 한다 — 올라타기가 그 값으로 이 들림을 상쇄한다.
         한쪽만 고치면 동물 머리 위에 올라탄 캐릭터가 그 차이만큼 뜬다. */
  m.position.y += clampCharY(seat.userY) * _animPos / _uz;
  /* 🦶 바닥 맞춤 — 발밑에 둔 파츠(욕조·방석 등)가 있으면 그 깊이만큼 들어 올려서
     '가장 아래에 있는 것'이 바닥에 닿게 한다. 발 아래에 아무것도 없으면 0이라 무동작이다.
     ⚠️ 반드시 여기, 크기(scale)와 x/z 가 다 정해진 **뒤**여야 한다. 스케일 전에 재면 깊이가
       정규화 배율만큼 어긋나서 그만큼 바닥을 파고들거나 뜬다. */
  m.position.y += measureUnderfootDepth(m);
}
  seat.rig.position.copy(sR);seat.rig.rotation.copy(sRr);
  /* 🪑 평준화 배율은 여기(몸 스케일) 하나로 들어간다 — headAnchor·bodyAnchor 는 bodyWrap 의
     자식이라 저절로 같이 커진다. ⚠️ 위 _uz 는 raw userScale 그대로여야 한다(그 주석 참고). */
  seat.bodyWrap.scale.setScalar(seatScale(seat));
  seat.bodyWrap.position.copy(sWp);seat.group.position.copy(sG);
  /* ⚠️ 값만 되돌리면 matrixWorld 는 위에서 0 으로 옮겨 잰 그대로 남는다 — 다음 렌더 프레임이
     오기 전까지 이 좌석의 월드 행렬은 **거짓말**이고, 그 사이에 월드 좌표를 재는 코드
     (seatDeskHalfWidth → layoutSeats)가 원점 근처에 있는 것처럼 읽는다.
     fitModel 바로 뒤에 layoutSeats 를 부르는 자리가 여럿이므로(크기 슬라이더·리빌드·평준화)
     여기서 한 번 세워 두고 나간다. 이 함수는 이미 위에서 두 번 부르는 호출이라 비용도 그만큼이다. */
  seat.group.updateWorldMatrix(true,true);
  // ★ 리깅 파츠(귀 등)는 위치를 bindMatrix에 "구워서" 고정하므로, 여기서 모델 스케일(m.scale)이
  //   다시 계산되면 옛 스케일 기준 위치에 남아 머리 위로 붕 뜬다.
  //   fitModel을 부르는 모든 경로(크기 슬라이더·리빌드·파츠 부착 후 재계산 등)에서 반드시 다시 구워야 함.
  //   ※ 화면마다 갱신 경로가 달라서 "내 화면만 어긋나 보이는" 현상의 원인이기도 함.
  refreshRiggedPartsXf(seat);
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
  seat.group.position.copy(sG); seat.group.updateWorldMatrix(true,true);   // ⚠️ fitModel 끝의 그 이유와 같다
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
  /* 🎩 파츠 좌표계 기준 노드 — 본과 메쉬가 실제로 들어 있는 노드. gltfRoot는 fitModel이 scale을 얹는
     '보호 wrap'이라 그 둘이 갈린다.
       ・인간·커미션: instantiateBase가 준 root를 그대로 넘겨받아 scale=1 → wrap 로컬 == root 로컬(원본 단위)
       ・동물: buildAnimalBase가 root에 normalizeModel을 이미 걸어놔서(배율 0.1765) 두 좌표계가 다르다
     파츠 GLB 좌표는 리그 원본 단위이므로 계산은 항상 이쪽(root) 기준이어야 한다.
     (미리보기 좌석은 seat.root가 같은 역할 — 두 화면이 같은 좌표계를 보게 하는 게 목적) */
  seat.modelRoot=m;
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
  if(selected===seat) sliders.classList.add('on');
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
  seat.headAnchor.position.set(0,1.08,0); seat.bodyAnchor.position.set(0,0.46,0);
  if(selected===seat) sliders.classList.remove('on');
}
async function handleFiles(files,seat){
  for(const f of files){const nm=f.name.toLowerCase();
    if(nm.endsWith('.dcc')){ const buf=await f.arrayBuffer(); const pass=window.prompt('이 캐릭터의 비밀번호를 입력하세요'); if(!pass)continue;
      try{ const dec=await assetCodeMod.decryptBytes(buf,pass); loadCharGLB(dec,f.name.replace(/\.dcc$/i,'')+'.glb',seat); }catch(e){ toast('비밀번호가 틀렸거나 파일이 손상됐어요'); } }
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
  seat.charDef.xf={s:seat.userScale,y:clampCharY(seat.userY),z:0,rot:seat.userRot,x:seat.userX||0};   // 🧍 y=높이 · 🚫 z 폐기
  if(seat.slot!=null) slots[seat.slot]=seat.charDef;
  slotSaveMod.saveSlots(); }
document.getElementById('sScale').addEventListener('input',e=>{selected.userScale=+e.target.value;fitModel(selected);saveSeatXf(selected);layoutSeats();});
/* 🧍 높이 — 0 하한·CHAR_Y_MAX 상한. 슬라이더 범위도 여기서 심는다(HTML 의 min 이 음수면 죽은 구간이 된다). */
(function _sYSliderRange(){ const el=document.getElementById('sY'); if(!el) return;
  el.min=0; el.max=CHAR_Y_MAX; el.step=0.01; el.title='캐릭터 높이'; })();
document.getElementById('sY').addEventListener('input',e=>{selected.userY=clampCharY(e.target.value);fitModel(selected);saveSeatXf(selected);layoutSeats();});
/* 🚫 앞뒤(userZ)는 폐기 — 이 슬라이더를 움직여도 0 을 유지한다. 값을 되살리면 생성기·미리보기에는
   대응하는 조정 수단이 없어서 그 화면들과만 어긋난다(그게 폐기한 이유다). HTML 에서 이 슬라이더를
   지우는 편이 낫지만, 남아 있어도 사고가 나지 않게 여기서 막는다. */
document.getElementById('sZ').addEventListener('input',e=>{selected.userZ=0;e.target.value=0;fitModel(selected);saveSeatXf(selected);layoutSeats();});
document.getElementById('sRot').addEventListener('input',e=>{selected.userRot=+e.target.value;fitModel(selected);saveSeatXf(selected);});

/* ============================================================ USER STATUS (활동 상태)
   A안 — 자동감지(focus/idle/sleep/pet)는 그대로 유지하고, 이 상태는 별도 축으로 동작:
   · 🍚 meal / 🎮 gaming: 책상 위에 판넬 표시 (본인 좌석만), 머리 위 이모지(모든 좌석)
   · 🫧 away: 자동상태 무시하고 sleep 모션 강제 + 캐릭터 opacity 0.30 (영혼)
   · 🔥 grind: idle 상태일 때만 모션 변형(머리 더 숙임/호흡 빠름/미세 흔들)
   본인 변경은 자기 화면 칩으로, 친구에게는 머리 위 이모지로만 보임.
   Phase 7(Firebase) 단계에서 Presence.update에 userStatus 필드를 함께 송수신할 예정. */
const USER_STATUSES = {
  meal:   {emo:'🍚',   label:'밥 먹는 중', idleTweak:true, dot:'#e89b7d'},
  away:   {emo:'🫧',   label:'자리비움',   forceSleep:true, opacity:0.0,  dot:'#9aa0a8'},
  grind:  {emo:'🔥',   label:'빡일중',     idleTweak:true,                 dot:'#e07a55'},
  gaming: {emo:'🎮',   label:'게임 중',    dot:'#8a8ec9'},
  // ✨ 커스텀 상태 (프리미엄) — emo/label은 유저가 등록한 값으로 렌더 시점에 덮어씀(statusConfFor 참고).
  //   여기 값은 아직 등록 전이거나 친구의 커스텀 문구를 못 받았을 때의 폴백.
  custom: {emo:'✨',   label:'커스텀 상태', dot:'#c9a36a'},
};

/* isPremium은 파일 뒷부분에서 let으로 선언됨 — 초기화 시점(이 위치)에서 참조하면 TDZ ReferenceError가 남.
   typeof 가드도 let TDZ에는 통하지 않으므로 try/catch로 안전하게 읽는 접근자를 씀.
   (라이선스가 확정되면 _refreshPremiumGatedUI가 다시 호출되어 UI가 갱신됨) */
function _premiumOn(){ try{ return !!isPremium; }catch(_){ return false; } }
try{ window._premiumOn = _premiumOn; }catch(_){}

/* ✨ 커스텀 상태 (프리미엄) — 확성기(📢 말풍선 고정)를 대체.
   유저가 이모지 1개 + 문구(최대 12자)를 등록해두면 상태 메뉴에서 다른 상태처럼 골라 쓸 수 있음.
   저장: localStorage 'tw.customStatus' = {emo, text}. 친구에겐 Presence로 전파(remoteCustomStatus). */
const CUSTOM_STATUS_KEY = 'tw.customStatus';
const CUSTOM_STATUS_MAXLEN = 12;
let customStatusConf = { emo:'', text:'' };
function loadCustomStatusFromStorage(){
  try{
    const raw = localStorage.getItem(CUSTOM_STATUS_KEY);
    if(!raw) return;
    const v = JSON.parse(raw);
    if(v && typeof v === 'object'){
      customStatusConf = {
        emo:  (typeof v.emo === 'string') ? v.emo.slice(0,2) : '',
        text: (typeof v.text === 'string') ? v.text.slice(0, CUSTOM_STATUS_MAXLEN) : '',
      };
    }
  }catch(e){}
}
function saveCustomStatusConf(emo, text){
  customStatusConf = {
    emo: (emo || '').slice(0,2),            // 비워두면 이모지 없이 문구만 표시
    text: (text || '').slice(0, CUSTOM_STATUS_MAXLEN),
  };
  try{ localStorage.setItem(CUSTOM_STATUS_KEY, JSON.stringify(customStatusConf)); }catch(e){}
  // 지금 커스텀 상태를 쓰고 있다면 즉시 반영(말풍선/이모지 갱신) + 친구에게도 전파
  if(typeof Presence!=='undefined' && Presence.setCustomStatus) Presence.setCustomStatus(customStatusConf);
  refreshCustomStatusMenuItem();
}
/* 좌석 + 상태키 → 실제로 화면에 쓸 상태 설정({emo,label,...}) 해석.
   custom은 본인이면 내 등록값, 친구면 그 친구가 보낸 값(remoteCustomStatus)을 씀.
   문구가 비어 있으면(등록 안 함) null 반환 → 상태 없음(온라인)과 동일하게 처리됨. */
function statusConfFor(seat, us){
  /* 📊 오늘 기록 전시 — **상태가 없을 때만** 내 머리 위에 방에 보낸 값과 같은 것을 띄운다(내 화면 거울).
     상태(커스텀 포함)가 하나라도 있으면 그것이 이긴다 — 남의 화면에서도 같은 순서다(Presence._statusOut). */
  if(!us){
    /* ⚠️ isMe 만 보면 «자리추가»로 주 캐릭터가 바뀐 판에서 내 좌석이 빠진다 — findMySeat 과 같은 기준으로 본다. */
    const _mine = findMySeat();
    if(seat && !seat.remote && (seat.isMe || seat === _mine)){ const f = focusShareMod._focusShowMine(); if(f) return Object.assign({}, USER_STATUSES.custom, { emo: f.emo, label: f.text }); }
    return null;
  }
  const base = USER_STATUSES[us];
  if(!base) return null;
  if(us !== 'custom') return base;
  const cs = (seat && seat.remote) ? seat.remoteCustomStatus : customStatusConf;
  if(!cs || !cs.text) return null;
  // 이모지를 비워두면 책상 위 이모지는 안 띄우고 문구만 표시 (emo:'' → setSeatDeskEmoji가 빈 값으로 처리)
  return Object.assign({}, base, { emo: cs.emo || '', label: cs.text });
}
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
  // ✨ 커스텀 상태는 등록한 문구/이모지로 해석해야 하므로 statusConfFor를 통해 얻음(내 좌석 기준).
  const c = userStatus ? statusConfFor(null, userStatus) : null;
  if(c){
    // 세로 배열 A안: 라벨 요소는 없앴고 대신 title(툴팁)로 현재 상태 표시. dot 색은 그대로 상태 시각화.
    btn.title = (c.emo ? c.emo+' ' : '') + c.label;
    if(dot){ dot.style.background = c.dot||'#9dba8a'; dot.style.boxShadow='0 0 0 2px '+statusChipMod.hexToRgba(c.dot||'#9dba8a',.18); }
  } else {
    btn.title = '상태';
    if(dot){ dot.style.background = '#9dba8a'; dot.style.boxShadow='0 0 0 2px rgba(157,186,138,.18)'; }
  }
  /* ⚠️ data-st 가 있는 항목만 본다. ✨ 커스텀 상태 항목은 data-st 가 없어서 ''===''(온라인)로
     읽혀 ● 표식이 두 줄에 붙는다 — 그 항목의 표식은 refreshCustomStatusMenuItem 이 따로 단다. */
  document.querySelectorAll('#myStatusMenu .stItem[data-st]').forEach(b=>{
    b.classList.toggle('active', (b.dataset.st||'')===(userStatus||''));
  });
  refreshCustomStatusMenuItem();
}

/* ✨ 커스텀 상태 항목(프리미엄 전용) 갱신 — 라이선스가 없으면 항목 자체를 숨김.
   등록값·프리미엄 여부·현재 상태가 바뀔 때마다 호출.
   ⚠️ 이 항목은 칩 버튼이 아니라 **상태 드롭다운 안의 stItem** 이다(칩 줄을 줄이려고 옮겼다).
     그래서 textContent 를 통째로 갈아치우면 안 된다 — 안에 이모지(.csEmo)와 글자(.csLabel)가 따로 있다. */
function refreshCustomStatusMenuItem(){
  const btn = document.getElementById('myCustomStatusBtn');
  if(!btn) return;
  if(!_premiumOn()){ btn.style.display = 'none'; return; }   // 라이선스 없으면 아예 안 보임
  btn.style.display = '';
  const emoEl = btn.querySelector('.csEmo'), lblEl = btn.querySelector('.csLabel');
  // 등록된 이모지가 있으면 그걸 띄워서 "지금 뭘로 등록해뒀는지" 바로 보이게
  if(emoEl) emoEl.textContent = customStatusConf.emo || '✨';
  if(lblEl) lblEl.textContent = customStatusConf.text || '커스텀 상태';
  btn.title = customStatusConf.text
    ? `커스텀 상태: ${customStatusConf.text} (클릭해서 수정)`
    : '커스텀 상태 문구 등록';
  btn.classList.toggle('on', userStatus === 'custom');   // 지금 이 상태를 쓰는 중이면 ● 표식
}
/* 상태칩 팝업들은 한 번에 하나만 — 하나를 열 때 나머지는 모두 닫음(겹쳐서 뜨는 문제 방지).
   exceptId에 지금 열려는 팝업 id를 넘기면 그것만 건드리지 않음.
   ★ keep:true 인 것은 **'지나가는 메뉴'가 아니라 창**이다 — 다른 팝업을 연다고 닫히지 않는다.
     정말 전부 닫아야 하는 자리(오피스 모드 숨김)만 force=true 로 부른다. */
const _CHIP_POPUPS = [
  { box:'myStatusMenu',      btn:'myStatusChipBtn' },
  { box:'myChipMore',        btn:'myChipMoreBtn'   },
  { box:'myChatBox',         btn:'myChatBtn'       },
  { box:'myCustomStatusBox', btn:'myCustomStatusBtn' },   // ✨ 커스텀 상태 입력창
  { box:'bellWin',           btn:'myBellBtn'       },     // 🔔 일정 알림 창
  { box:'myDemojiBox',       btn:'myDemojiBtn'     },     // 😊 기본 이모티콘 팔레트
  /* 🎵 플레이리스트 — 음악을 틀어두고 계속 켜 두는 창이다. ▼ 더보기·상태 메뉴 같은
     **드롭메뉴를 열었다고 음악창이 닫히면** 곡을 고를 때마다 다시 열어야 한다(제보). */
  { box:'myPlaylistBox',     btn:'myPlBtn', keep:true },
];
function _closeChipPopups(exceptId, force){
  _CHIP_POPUPS.forEach(p=>{
    if(p.box === exceptId) return;
    if(p.keep && !force) return;         // 창은 다른 팝업을 여는 것만으로는 안 닫는다
    const box = document.getElementById(p.box);
    // 대부분은 .hidden 클래스로 여닫지만 🔔 창은 style.display를 씀 — 둘 다 처리
    if(box){
      box.classList.add('hidden');
      if(p.box === 'bellWin') box.style.display = 'none';
    }
    if(p.btn){ const b = document.getElementById(p.btn); if(b) b.classList.remove('on'); }
  });
  // ✨ 커스텀 상태 버튼의 'on'은 "팝업이 열림"이 아니라 "그 상태를 쓰는 중"을 뜻하므로,
  //   팝업을 닫아도 지금 custom 상태라면 눌린 표시를 유지해야 함.
  const csBtn = document.getElementById('myCustomStatusBtn');
  if(csBtn && typeof userStatus!=='undefined' && userStatus==='custom') csBtn.classList.add('on');
}

/* ═══ 🪟 창 겹침 — 누른 창 맨 앞(bringWinToFront) · ESC 스택(escRegisterWindow) ═══ */
/* 본문은 win-stack.js 로 옮겼다(앱 FSD 42번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const WIN_STACK_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const winStackMod = (typeof TwWinStack === 'undefined') ? WIN_STACK_MOD_OFF : TwWinStack.createWinStack({
});

/* ═══ 📐 상태칩 팝업 · 입력창 자리 계산 · 캐릭터 실측 ═══ */
/* 본문은 status-chip.js 로 옮겼다(앱 FSD 36번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const STATUS_CHIP_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const statusChipMod = (typeof TwStatusChip === 'undefined') ? STATUS_CHIP_MOD_OFF : TwStatusChip.createStatusChip({
  CUSTOM_STATUS_MAXLEN: CUSTOM_STATUS_MAXLEN,
  Presence: ()=>Presence,
  _CHIP_POPUPS: _CHIP_POPUPS,
  _charBadWhy: ()=>_charBadWhy,
  _charBoundsLatest: ()=>_charBoundsLatest,
  _charProjSane: (...a)=>_charProjSane(...a),
  _closeChipPopups: (...a)=>_closeChipPopups(...a),
  _danceCmdCooldownAt: ()=>iDeskMod._danceCmdCooldownAt(),
  _lowestDanceReq: (...a)=>iDeskMod._lowestDanceReq(...a),
  _moveModeJustToggled: ()=>_moveModeJustToggled,
  _officeHidden: ()=>_officeHidden,
  _pickUnlockedDance: (...a)=>iDeskMod._pickUnlockedDance(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  _rollRoulette: (...a)=>rouletteMod._rollRoulette(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  camera: camera,
  chatUiMod: ()=>chatUiMod,
  customStatusConf: ()=>customStatusConf,
  moveMode: ()=>moveMode,
  overheadMod: ()=>overheadMod,
  renderer: renderer,
  rideBenchMod: rideBenchMod,
  saveCustomStatusConf: (...a)=>saveCustomStatusConf(...a),
  seats: seats,
  setUserStatus: (...a)=>setUserStatus(...a),
  startMyDance: (...a)=>iDeskMod.startMyDance(...a),
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatus,
  setCharBadWhy: (v)=>{ _charBadWhy = v; },
  setCharBoundsLatest: (v)=>{ _charBoundsLatest = v; },
  setDanceCmdCooldownAt: (v)=>{ iDeskMod.setDanceCmdCooldownAt(v); },
  setMoveModeJustToggled: (v)=>{ _moveModeJustToggled = v; },
  setMoveMode: (v)=>{ moveMode = v; },
});
/* 저장된 상태 · 커스텀 상태 불러오기 → 칩 첫 그리기 → 이 모니터 캐릭터 크기 복원.
   ⚠️ statusChipMod 를 만든 **뒤**에 부른다 — 모듈 안에서 부르면 refreshMyStatusUI 가 아직 없는 statusChipMod 를 읽어
   던지고(상태를 저장해 둔 사람만), 그 뒤 app.js 가 통째로 멈춘다. 칩 버튼 · 메뉴가 없는 화면은 예전처럼 건너뛴다. */
if(document.getElementById('myStatusChipBtn') && document.getElementById('myStatusMenu')){
  loadCustomStatusFromStorage(); loadUserStatusFromStorage(); refreshMyStatusUI();
  refreshCharScaleForCurrentDisplay();
  refreshCustomStatusMenuItem();
}

/* ═══ 😊 기본 이모티콘 (demoji) 말풍선 — 채팅이 없는 워킹룸용 ═══
   · 라이선스 여부와 무관하게 방에 있는 모두가 사용 가능(텍스트 채팅은 여전히 투게더룸 전용).
   · 전송 형식은 프리미엄 채팅과 동일한 [demoji:id] 마커 하나 — 좌석 말풍선 렌더러가 이미 지원하므로
     수신 측은 구버전 클라이언트도 이미지로 정상 표시됨(전송만 신버전 필요).
   · 팔레트는 첫 클릭 때 DEMOJI_LIST로 지연 생성(DEMOJI_LIST는 아래쪽에서 const 선언되므로 로드 시점엔 TDZ). */
/* 본문은 demoji-palette.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const DEMOJI_PAL_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const demojiPalMod = (typeof TwDemojiPalette === 'undefined') ? DEMOJI_PAL_MOD_OFF : TwDemojiPalette.createDemojiPalette({
  Presence: ()=>Presence,
  _closeChipPopups: (...a)=>_closeChipPopups(...a),
  chatUiMod: ()=>chatUiMod,
  findMySeat: (...a)=>findMySeat(...a),
  showChatBubble: (...a)=>showChatBubble(...a),
  statusChipMod: statusChipMod,
});
/* ═══ 🎵 상태칩 플레이리스트 ═══ */
/* 🎵 플레이리스트(데이터 · 화면 · 프리셋 고르기 · 🐕 재생 감시견 · 재생 제어 · 버튼 연결)는 parts/playlist.js 로 옮겼다(앱 FSD 16번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 만들 때 예전처럼 돈다(🪟 창 위치 초기화 등록 · 저장값 읽기 · 버튼 · ESC · 끌기 연결 · 미니미 · 300ms 폴링 ·
     BGM 신호 구독 · 음량 한 번). 예전엔 «🐕 재생 감시견» 구역 끝에서 돌았지만 그 사이(👤 · 🏅)는 선언뿐이라 순서는 같다.
   부르는 곳은 plMod.이름(전부 이 줄보다 늦게 돈다). 상태는 모듈 안에 있고 밖(계정 이어받기 복원 · 로그아웃 · 📷 재생 재우기 · 화면 배율)은
     상태 묶음 plMod.st 로 읽고 쓴다. 상태칩 팝업 자리(_repositionOpenChipPopups — 이 줄보다 위) · noise.js 가 typeof 를 걸고 부르는
     _plHasSavedPos · _plApplyPos · _plSyncBgmBounds 는 모듈이 window 고리로도 건다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeLoaded · _myHomeData · _myHomeFriends 는 이 줄보다 뒤에 선언되고 다시 대입되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const PLAYLIST_OFF = { st:{ sets:[], cur:0, nowSet:0, sel:-1, now:-1, view:null, nowView:null, bio:'', homePublic:false, private:false, pubSig:null,
  playing:false, lastBoundsKey:'' }, PL_MAX:20, PL_BIO_MAX:140, PL_TITLE_MAX:16, render(){}, save(){}, publish(){}, normalizeSets:()=>[], setIdx:()=>0,
  blankSets:()=>[], pubSigOf:()=>'', mine:()=>[], fillLv(){}, ytVideoId:()=>null, syncBgmBounds(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const plMod = (typeof TwPlaylist === 'undefined') ? PLAYLIST_OFF : TwPlaylist.createPlaylist({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  // 👤 명함 — 레벨 · 🌟 회차 배지
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  myFocusShow: (...a)=>focusLevelMod.myFocusShow(...a),
  starFromRemote: (...a)=>focusLevelMod.starFromRemote(...a),
  lvBadgeClass: (...a)=>lvTierMod.lvBadgeClass(...a),
  lvStarBadgeClass: (...a)=>lvTierMod.lvStarBadgeClass(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  starPaint: (...a)=>lvTierMod._starPaint(...a),
  // 🏠 마이홈
  myHomeLoaded: ()=>mhVisitMod._myHomeLoaded(),
  myHomeData: ()=>mhVisitMod._myHomeData(),
  myHomeFriends: ()=>_myHomeFriends,
  openFriendHomeView: (...a)=>mhVisitMod.openFriendHomeView(...a),
  // 🪟 상태칩 팝업 · 창 겹침 · ESC
  closeChipPopups: (...a)=>_closeChipPopups(...a),
  repositionOpenChipPopups: (...a)=>statusChipMod._repositionOpenChipPopups(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  escEditable: (...a)=>winStackMod._escEditable(...a),
});
/* ═══ 🎵 프리셋 세 벌 ═══ */
/* 🎵 프리셋 세 벌(_plSets · _plCur · _plNowSet …) · 저장 · 서버 사본은 parts/playlist.js 로 옮겼다(앱 FSD 16번) — 연결은 바로 위 «🎵 상태칩 플레이리스트» 머리 아래(plMod). */
/* ═══ 👤 프로필 소개칸 ═══════════════════════════════════════════════════
   목록 주인의 사진·닉네임·레벨 배지와 bio 한마디를 그린다.
   ★ 내 목록과 남의 목록이 같은 자리를 쓰되, 갈리는 것은 **입력칸의 유무** 하나다:
       내 목록  — 흰 칸(눌러서 고침) + [마이홈 공개] 체크박스
       남의 목록 — 테두리 없는 글자(읽기 전용) + 공개면 사진에 🏠
     이 앱에서 흰 바탕이 곧 "내가 쓰는 곳"이라, 별도 안내 문구 없이도 상태가 읽힌다. */

/* ═══ 🏅 레벨 티어 — 경계값이 사는 **유일한 곳** ═══════════════════════════════
   예전엔 같은 삼항 사슬(n<=20?'t1':…)이 세 군데(프로필 목록·친구창 배지·경험치 바)에 각각
   복사돼 있었고, 주석에 "고칠 일이 생기면 둘 다 고칠 것"이라고 적어 두는 것이 방어의 전부였다.
   상한을 130 → 999 로 늘리면서 칸이 t7 에서 t12 로 늘어나므로 그 방식으로는 반드시 어긋난다.
   → 표 하나 + 함수 두 개로 모은다. 색은 CSS 의 「🏅 레벨 티어 토큰」 블록이 유일한 출처이고,
     여기는 '몇 번 칸인가'만 정한다.

   ★ 표식 클래스(lvx·lvglow)를 여기서 **티어와 함께** 붙이는 것이 핵심이다.
     CSS 에 `.t7,.t8,.t9,…` 를 나열하는 자리를 만들면 티어를 늘릴 때마다 빠뜨린다 —
     검사 12·14·15 가 전부 그 나열에서 빠뜨려 생긴 실패다.
       lvx    광택이 흐른다 (t7 이상)
       lvglow 바가 홈 바깥으로 빛을 흘린다 (t8 이상)
       shine  흰 빛줄기가 훑는다 (Lv.81 이상 — 티어가 아니라 레벨 기준. 예전 그대로)
   ★ 상한(FOCUS_LEVEL_CAP_HOURS=999)을 넘는 값은 없지만, 표 마지막 칸을 Infinity 로 열어 둬서
     그런 값이 들어와도 조용히 t12 로 떨어진다(클래스가 아예 안 붙으면 배경이 사라진다). */
/* 본문은 lv-tier.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LV_TIER_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const lvTierMod = (typeof TwLvTier === 'undefined') ? LV_TIER_MOD_OFF : TwLvTier.createLvTier({
});
/* ═══ 🎵 플레이리스트 화면 — 명함 · 목록 · 흐르는 제목 · 미니미 · 파도타기 ═══ */
/* 🎵 플레이리스트 화면은 parts/playlist.js 로 옮겼다(앱 FSD 16번) — 연결은 «🎵 상태칩 플레이리스트» 머리 아래(plMod). 레벨 배지는 plMod.fillLv. */
/* ═══ 🎵 프리셋 고르기 ═══ */
/* 🎵 프리셋 고르기 · 📥 담을 프리셋 고르기는 parts/playlist.js 로 옮겼다(앱 FSD 16번) — 연결은 «🎵 상태칩 플레이리스트» 머리 아래(plMod). */
/* ═══ 🐕 재생 감시견 ═══ */
/* 🐕 재생 감시견 · 재생 제어(곡 열기 · 다음 곡 · 셔플 · 음량) · 내 플레이리스트 버튼 연결(bindMyPlaylist)은 parts/playlist.js 로 옮겼다(앱 FSD 16번)
   — 연결은 «🎵 상태칩 플레이리스트» 머리 아래(plMod). 버튼 연결은 만들 때 돈다. */

/* ═══ 🩺 렌더러 생존 신호 · 캐릭터 화면 좌표 ═══ */
// ── 스마트 감지용 throttle timestamp (companion.setCharBounds 호출 제한) ──
//   초당 60번 IPC보다 100ms 간격이 훨씬 가볍고, 판정 정확도는 그대로 유지됨(사람 마우스 이동 속도 대비 충분).
/* ── 🩺 렌더러 생존 신호 (main.js '클릭 고착 안전장치'가 이걸 본다) ─────────────────
   main은 companion.setCharBounds 가 4초 끊기면 "렌더러가 멈췄다"고 판단해 클릭을 통과로
   **강제 전환**한다(main.js _guardStuckClickCapture).

   [문제] 그 신호를 updateMyStatusChipPosition 안에서 보내고 있었는데, 그 함수는
     ・내 좌석이 아직 없거나(!me — 방 입장/좌석 재구성 순간)
     ・런처/생성기/프로그램 이동 중
   이면 맨 위에서 return 한다. 그래서 **렌더러가 멀쩡히 살아 있는데도** 신호가 끊기고,
   4초 뒤 통과로 전환된다. 커서를 캐릭터에 올려 겨우 되돌려도 또 4초 뒤에 같은 일이 반복된다
   — 제보된 "조금 조작하고 나면 금방 다시 클릭이 뒤로 뚫린다"의 형태가 정확히 이것이다.
   (창은 포커스를 못 얻으므로 focus 이벤트 복구 통로도 안 열린다)

   [대응] 신호를 rAF 루프에서 떼어내 타이머로 옮긴다. 이제 이 신호의 의미는
   "캐릭터가 그려지고 있는가"가 아니라 "렌더러의 이벤트 루프가 살아 있는가"이며,
   그게 원래 안전장치가 알고 싶어 하던 것이다.
   ⚠️ 좌표는 마지막으로 계산된 값을 그대로 재사용한다(펜 근접 판정 정확도는 그대로).
     캐릭터가 없으면 화면 밖 좌표 + 반경 0 으로 보내 근접 판정에는 절대 안 걸리게 한다. */
let _charBoundsLatest = null;
/* 🧭 [2026-09-01] 위 값이 못 믿을 상태일 때의 이유 한 줄 (하트비트에 얹어 main 진단 기록으로 보낸다).
   null 이면 정상. 문자열은 구간이 시작될 때 한 번만 만든다 — 만드는 자리는 updateMyStatusChipPosition. */
let _charBadWhy = null;
/* 투영 결과가 쓸 만한가. run 오버레이는 화면을 통째로 덮으므로, 내 캐릭터가 화면 한 장 밖으로
   나가 있다는 값은 클릭 통과 판정에 쓸 수 없는 값이다(그 자리에 클릭할 방법이 없다).
   ⚠️ 여기서 걸러진 값은 '보류'가 되지 그 자체로 고쳐지지는 않는다. 화면 안이면서 틀린 값은
     이 문지기를 그냥 통과한다 — 문지기는 폭주만 막는다. */
function _charProjSane(x, y, h){
  if(!isFinite(x) || !isFinite(y) || !isFinite(h)) return false;
  const mw = Math.max(1, innerWidth), mh = Math.max(1, innerHeight);
  if(h > mh * 2) return false;                     // 화면 두 장보다 큰 캐릭터는 없다
  return x > -mw && x < mw * 2 && y > -mh && y < mh * 2;
}
/* 🩺 mousemove 도착 시각(벽시계). 아래 하트비트에 실어 main 으로 보낸다.
   [왜 필요한가] main 의 기존 생존 신호(_lastCharBoundsAt)는 **이벤트 루프가 살아 있는가**만 말해준다.
     그런데 실제 사고는 "렌더러는 멀쩡한데 mousemove 만 안 오는" 형태로 난다 —
     Electron 의 forward 전달이 Windows 에서 끊기는 확인된 상류 버그가 있다
     (electron#30808 · #33281). 그러면 마지막 판정값이 그대로 굳는데, 그 값이 하필
     '클릭 받는 중'이면 전체화면 투명 오버레이가 계속 클릭을 가로챈다.
   ⚠️ 아래 _noteChannelAlive() 가 이 값을 갱신한다. 그쪽을 지우면 이 신호도 같이 죽는다. */
let _twMoveSeenAt = 0;
try{
  setInterval(()=>{
    try{
      if(!(window.companion && companion.setCharBounds)) return;
      /* ★ _charBoundsLatest 를 직접 건드리지 않고 매번 새 객체로 보낸다 — 그 값은 다음 주기에도
         재사용되므로 필드를 덧붙이면 안 된다. moveAge 는 "mousemove 가 마지막으로 온 지 몇 ms 됐나",
         한 번도 온 적 없으면 -1(=판단 불가, main 은 이때 아무것도 하지 않는다). */
      const _b = _charBoundsLatest || { x:-99999, y:-99999, r:0 };
      /* 📐 우리 창들의 사각형도 같이 보낸다 — main 의 회수 판정이 캐릭터 하나만 알아서
         대화창 위에서 렌더러와 싸우던 문제(핸드오프5 §1-4). __uiRegions 는 클릭통과 블록이
         정의하는데, 그 블록은 companion 이 없으면 아예 안 돈다 — 그래서 존재 확인이 필요하다. */
      companion.setCharBounds({ x:_b.x, y:_b.y, r:_b.r,
        moveAge: _twMoveSeenAt ? (Date.now() - _twMoveSeenAt) : -1,
        regions: window.__uiRegions ? window.__uiRegions() : undefined,
        /* 🧭 좌표를 못 믿는 구간이면 그 이유를 실어 보낸다 — main 이 구간 시작·끝만 기록한다.
           구버전 main 은 이 필드를 그냥 무시한다(동작 변화 없음). */
        charBad: _charBadWhy || undefined });
    }catch(_){}
  }, 100);
}catch(_){}
/* ═══ 📍 상태칩 자리 · 칩 클릭 · Tab 접기 ═══ */
/* (앱 FSD 36번) 이 자리의 본문도 status-chip.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ ⚙ 설정 패널 — 포커싱 어플 · 화면 표시 · 캐릭터 크기 · 탭 · 광고 배너 ═══ */
/* ⚙ 설정 패널 — 포커싱 어플 슬롯 / 캐릭터 크기 / 프로그램 이동 */
let moveMode=false;   // "프로그램 이동" 진행 중 여부 (true면 캐릭터가 마우스를 따라다니다 클릭으로 확정)
let _suppressNextContextMenu=false;   // 이동 모드를 우클릭으로 확정한 직후, 뒤이어 뜨는 contextmenu 1회를 무시하기 위한 플래그
let _moveModeJustToggled=false;   // 버튼 클릭 직후 신호 — bindMoveMode가 시작점을 새로 잡게 함
/* 본문은 settings-panel.js 로 옮겼다(앱 FSD 27번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const SETTINGS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const settingsMod = (typeof TwSettingsPanel === 'undefined') ? SETTINGS_MOD_OFF : TwSettingsPanel.createSettingsPanel({
  GAP_MAX: GAP_MAX,
  GAP_MIN: GAP_MIN,
  GAP_STEPS: GAP_STEPS,
  MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING,
  Presence: ()=>Presence,
  SPACING: ()=>SPACING,
  _chatEsc: (...a)=>_chatEsc(...a),
  _moveModeJustToggled: ()=>_moveModeJustToggled,
  _updateRoomCountUI: (...a)=>roomEntryMod._updateRoomCountUI(...a),
  allDeskItems: (...a)=>allDeskItems(...a),
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  applyChipOrientation: (...a)=>overheadMod.applyChipOrientation(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  chipHorizontal: ()=>overheadMod.chipHorizontal(),
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  decoPartsVisible: ()=>decoPartsVisible,
  dotRenderEnabled: ()=>dotRenderEnabled,
  drawFaceThumb: (...a)=>addFriendMod.drawFaceThumb(...a),
  emojiReactionsEnabled: ()=>floatersMod.emojiReactionsEnabled(),
  equipDeskItem: (...a)=>equipDeskItem(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  findMySeat: (...a)=>findMySeat(...a),
  focusCharScale: ()=>focusCharScale,
  isPremium: ()=>isPremium,
  layoutSeats: (...a)=>layoutSeats(...a),
  moveMode: ()=>moveMode,
  nameplateEnabled: ()=>overheadMod.nameplateEnabled(),
  plMod: plMod,
  refreshCharScaleForCurrentDisplay: (...a)=>refreshCharScaleForCurrentDisplay(...a),
  refreshInviteUI: (...a)=>roomEntryMod.refreshInviteUI(...a),
  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),
  roomSeatMode: ()=>roomSeatMode,
  saveCharScale: (...a)=>saveCharScale(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  saveGap: (...a)=>saveGap(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  scene: scene,
  seatEqualizeOn: ()=>seatEqualizeOn,
  seats: seats,
  slots: ()=>slots,
  startRoomCountWatch: (...a)=>roomEntryMod.startRoomCountWatch(...a),
  toast: (...a)=>toast(...a),
  updateCameraOnly: (...a)=>updateCameraOnly(...a),
  wardrobeMod: ()=>wardrobeMod,
  setMULTIPLAYER_SPACING: (v)=>{ MULTIPLAYER_SPACING = v; },
  setSPACING: (v)=>{ SPACING = v; },
  setMoveModeJustToggled: (v)=>{ _moveModeJustToggled = v; },
  setChipHorizontal: (v)=>{ overheadMod.setChipHorizontal(v); },
  setCurSlot: (v)=>{ curSlot = v; },
  setDecoPartsVisible: (v)=>{ decoPartsVisible = v; },
  setDotRenderEnabled: (v)=>{ dotRenderEnabled = v; },
  setEmojiReactionsEnabled: (v)=>{ floatersMod.setEmojiReactionsEnabled(v); },
  setFocusCharScale: (v)=>{ focusCharScale = v; },
  setMoveMode: (v)=>{ moveMode = v; },
  setNameplateEnabled: (v)=>{ overheadMod.setNameplateEnabled(v); },
  setRoomSeatMode: (v)=>{ roomSeatMode = v; },
  setSeatEqualizeOn: (v)=>{ seatEqualizeOn = v; },
});

/* ═══ 🕒 포커스 기록 팝업 ═══ */
/* 🕒 포커스 기록 팝업(현재 / 누적 · 오늘 기록 · 미니미 · 타이틀바 끌기 · ⎋ 닫기)은 parts/focus-log.js 로 옮겼다(앱 FSD 13번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(버튼 · ESC 등록 · window._focusLogClamp · 매초 갱신 · 타이틀바 끌기)이
     예전과 같은 때 돈다. 밖에서 부르는 이름은 없다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _focusTotalSec · _focusSessionSec 는 다시 대입되고 이 줄보다 한참 뒤(포커스 시간 누적 구역)에
   선언되는 let 이라 읽는 함수로 넘긴다(값으로 넘기면 TDZ).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FOCUS_LOG_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const focusLog = (typeof TwFocusLog === 'undefined') ? FOCUS_LOG_OFF : TwFocusLog.createFocusLog({
  formatHMS: (...a)=>focusLevelMod.formatHMS(...a),
  rolloverFocusToday: (...a)=>focusTotalMod._rolloverFocusToday(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  focusTotalSec: ()=>_focusTotalSec,
  focusSessionSec: ()=>focusTotalMod._focusSessionSec(),
});
/* ═══ ✥ 프로그램 이동 모드 ═══ */
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
    let nx = startPanX - dxPix/Math.max(1, innerWidth);
    let ny = startPanY + dyPix/Math.max(1, innerHeight);
    const _clamped = clampDeskPan(nx, ny);
    deskPanX = _clamped.x;
    deskPanY = _clamped.y;
    layoutSeats();
    statusChipMod.updateMyStatusChipPosition();   // 렌더 루프(frame) 대기 없이 즉시 갱신 — 도트렌더 등으로 프레임이 느려져도 상태칩은 안 밀리게
  });
  window.addEventListener('pointerdown', e=>{
    if(!moveMode) return;
    moveMode=false; _moveStarted=false;
    const moveBtn=document.getElementById('fsMoveBtn'); const moveHint=document.getElementById('fsMoveHint');
    if(moveBtn){ moveBtn.classList.remove('active'); moveBtn.textContent='프로그램 이동'; }
    if(moveHint) moveHint.style.display='none';
    const myMove=document.getElementById('myMoveBtn'); if(myMove) myMove.classList.remove('on');   // 상태칩의 이동 버튼 시각적 활성 해제
    // 우클릭으로 확정한 경우, 바로 뒤이어 뜨는 contextmenu 이벤트가 캐릭터 우클릭 동작(런처 이동 등)으로
    // 이어지지 않게 한 번 억제 — 안 그러면 확정 클릭이 그 자리의 캐릭터를 우클릭한 걸로도 처리돼버림.
    if(e.button===2) _suppressNextContextMenu = true;
    saveCharPos();   // ★ 껐다 켜도 유지되게 위치 확정 시 저장
    statusChipMod.updateMyStatusChipPosition();   // 상태칩 즉시 재표시
    toast('위치가 확정됐어요');
  }, true);   // capture: 클릭통과 로직보다 먼저 잡아서 이동 확정
  // 이동 시작 트리거는 moveBtn 클릭 시점(bindFocusSettings)에서 moveMode=true로 바뀌자마자 다음 mousemove에서 자동 시작됨
})();

/* ═══ ⌨️ 함수키 단축키(F1 ~ F4) ═══ */
/* 본문은 fn-keys.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FN_KEYS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const fnKeysMod = (typeof TwFnKeys === 'undefined') ? FN_KEYS_MOD_OFF : TwFnKeys.createFnKeys({
  chatUiMod: ()=>chatUiMod,
  gachaMod: ()=>gachaMod,
  iDeskMod: iDeskMod,
  rideBenchMod: rideBenchMod,
});

/* ═══ 🎨 꾸미기 사이드 패널 열고 닫기 ═══ */
/* 본문은 wardrobe-panel.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const WD_PANEL_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const wdPanelMod = (typeof TwWardrobePanel === 'undefined') ? WD_PANEL_MOD_OFF : TwWardrobePanel.createWardrobePanel({
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  progSettingsMod: ()=>progSettingsMod,
  toast: (...a)=>toast(...a),
  wardrobeMod: ()=>wardrobeMod,
});

/* ═══ 👀 꾸미기 미리보기 — 렌더러 · 기즈모 · 창 자리 · 카메라 ═══ */
/* 본문은 wardrobe.js 로 옮겼다(앱 FSD 29번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const WARDROBE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const wardrobeMod = (typeof TwWardrobe === 'undefined') ? WARDROBE_MOD_OFF : TwWardrobe.createWardrobe({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CHAR_Z: CHAR_Z,
  LIGHT_PRESET: ()=>LIGHT_PRESET,
  PART_CATS: ()=>premiumMod.PART_CATS(),
  PART_DEFAULT_OFFSET: ()=>PART_DEFAULT_OFFSET,
  PART_GROUPS: ()=>premiumMod.PART_GROUPS,
  Presence: ()=>Presence,
  WD_DESK_TAB: ()=>premiumMod.WD_DESK_TAB,
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,
  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,
  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,
  _attachHumanEars: (...a)=>_attachHumanEars(...a),
  _disposeWrapperFromSeat: (...a)=>_disposeWrapperFromSeat(...a),
  _hsvToHex: (...a)=>_hsvToHex(...a),
  _invalidatePendingEquip: (...a)=>_invalidatePendingEquip(...a),
  _mkFrontFill: (...a)=>_mkFrontFill(...a),
  _rgbHexToHsv: (...a)=>_rgbHexToHsv(...a),
  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),
  _wdLicenseDesks: (...a)=>premiumMod._wdLicenseDesks(...a),
  addEntryToCat: (...a)=>premiumMod.addEntryToCat(...a),
  addPartEntryInstance: (...a)=>premiumMod.addPartEntryInstance(...a),
  adminPartReg: ()=>adminPartReg,
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  applyHueTint: (...a)=>applyHueTint(...a),
  applyPartXf: (...a)=>applyPartXf(...a),
  bindReorderHandle: (...a)=>bindReorderHandle(...a),
  boneSide: (...a)=>boneSide(...a),
  charFootFix: (...a)=>charFootFix(...a),
  clampCharY: (...a)=>clampCharY(...a),
  defToBase: (...a)=>defToBase(...a),
  defaultPartXf: (...a)=>premiumMod.defaultPartXf(...a),
  entriesForCat: (...a)=>premiumMod.entriesForCat(...a),
  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),
  escHtml: (...a)=>escHtml(...a),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  findMySeat: (...a)=>findMySeat(...a),
  firstEntryForCat: (...a)=>premiumMod.firstEntryForCat(...a),
  fitModel: (...a)=>fitModel(...a),
  floorClampWrapper: (...a)=>floorClampWrapper(...a),
  gachaMod: ()=>gachaMod,
  getCommissionScene: (...a)=>getCommissionScene(...a),
  groupOfCat: (...a)=>premiumMod.groupOfCat(...a),
  isAdmin: ()=>isAdmin,
  isDeskPartCat: (...a)=>premiumMod.isDeskPartCat(...a),
  isHueTintMesh: (...a)=>isHueTintMesh(...a),
  measureCharBox: (...a)=>measureCharBox(...a),
  openAssetImport: (...a)=>openAssetImport(...a),
  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),
  partEntryId: (...a)=>premiumMod.partEntryId(...a),
  partEntryInstanceCount: (...a)=>premiumMod.partEntryInstanceCount(...a),
  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  partPaintMod: ()=>partPaintMod,
  partsInCat: (...a)=>premiumMod.partsInCat(...a),
  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),
  partsInGroup: (...a)=>premiumMod.partsInGroup(...a),
  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  removePartEntryInstance: (...a)=>premiumMod.removePartEntryInstance(...a),
  renderWdDeskSection: (...a)=>premiumMod.renderWdDeskSection(...a),
  reorderSavedPart: (...a)=>premiumMod.reorderSavedPart(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  savedParts: ()=>premiumMod.savedParts(),
  seats: seats,
  setPartEntryInstanceXf: (...a)=>premiumMod.setPartEntryInstanceXf(...a),
  slots: ()=>slots,
  toast: (...a)=>toast(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  wdEar: ()=>premiumMod.wdEar,
});
function buildFreeColorPicker(...a){ return wardrobeMod.buildFreeColorPicker(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
/* ═══ 📝 꾸미기 초안(draft) — 미리보기 캐릭터 · 저장(commitWdDraft) · 색 영역 ═══ */
/* (앱 FSD 29번) 이 자리의 본문도 wardrobe.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ══ 🖍️ 파츠에 직접 그리기 ══════════════════════════════════════════════════
   꾸미기창 안에서만 끝난다 — 별도 창도, 별도 단계도 없다. 미리보기가 그대로 그림판이 된다.

   조작은 **생성기(캐릭터 만들기)와 같다.** 좌드래그 그리기 · 우드래그 회전 · 휠 확대,
   그리고 Ctrl+Z / Ctrl+Shift+Z / Delete / X(대칭) / C(지우개) / 우클릭 스포이드.
   같은 일을 두 화면에서 다르게 외우게 하지 않는 것이 이 화면의 유일한 규칙이다.

   ⚠️ 단축키는 **네 개 다 이미 임자가 있다.** 그래서 window 의 캡처 단계에서 잡고 거기서 멈춘다:
     · Ctrl+Z  — 생성기(창이 같이 떠 있을 수 있다)와 스티커사진 꾸미기가 같은 조합을 쓴다.
                 흘려보내면 양쪽이 함께 되돌아간다(_pkdKey 주석의 그 사고).
     · Delete  — 재생목록 창이 document 캡처에서 먼저 먹고 전파를 끊는다.
     · X · C   — 생성기의 대칭·지우개 토글과 같은 키다.
     window 캡처는 document 캡처보다 먼저다 — 그래서 여기가 가장 이른 자리다.
   ⚠️ 입력칸에 포커스가 있으면 전부 손대지 않는다. 채팅창이 같이 떠 있는 게 이 앱의 기본이라,
     채팅을 치다가 x 를 눌렀는데 대칭이 켜지면 안 된다.
   ⚠️ 저장(업로드)은 '완료' 한 번뿐이다. 획마다 저장하면 equippedParts JSON 이 매번 달라져서
     상대 화면이 파츠를 통째로 재장착한다 — 남의 화면에서 내 파츠가 계속 깜빡인다. */
/* 본문은 part-paint.js 로 옮겼다(앱 FSD 21번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const PART_PAINT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const partPaintMod = (typeof TwPartPaint === 'undefined') ? PART_PAINT_MOD_OFF : TwPartPaint.createPartPaint({
  CANVAS_SZ: ()=>CANVAS_SZ,
  _applyPartMatTone: (...a)=>_applyPartMatTone(...a),
  _loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _roomFaceCacheLoad: (...a)=>roomSyncMod._roomFaceCacheLoad(...a),
  _roomFaceCacheSave: (...a)=>roomSyncMod._roomFaceCacheSave(...a),
  activeWdAdj: ()=>wardrobeMod.activeWdAdj(),
  buildFreeColorPicker: (...a)=>wardrobeMod.buildFreeColorPicker(...a),
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  currentWdTab: ()=>wardrobeMod.currentWdTab(),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  humanEar: humanEar,
  mirrorUVOn: (...a)=>mirrorUVOn(...a),
  newCanvas: (...a)=>newCanvas(...a),
  partEntryId: (...a)=>premiumMod.partEntryId(...a),
  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  refreshWdPreviewColorSection: (...a)=>wardrobeMod.refreshWdPreviewColorSection(...a),
  savedParts: ()=>premiumMod.savedParts(),
  sizeWdPreview: (...a)=>wardrobeMod.sizeWdPreview(...a),
  strokeSeg: (...a)=>strokeSeg(...a),
  toast: (...a)=>toast(...a),
  updateWdCam: (...a)=>wardrobeMod.updateWdCam(...a),
  updateWdGizmoForActivePanel: (...a)=>wardrobeMod.updateWdGizmoForActivePanel(...a),
  wdCam: ()=>wardrobeMod.wdCam(),
  wdEar: ()=>premiumMod.wdEar,
  wdGizmo: ()=>wardrobeMod.wdGizmo(),
  wdPreviewBase: ()=>wardrobeMod.wdPreviewBase(),
});
function _picIntersect(...a){ return partPaintMod._picIntersect(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
function _stampWrapCenter(...a){ return partPaintMod._stampWrapCenter(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
function _stampWrapFill(...a){ return partPaintMod._stampWrapFill(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
// ★ 이제 toggleEquip/상세조정 모두 mySeat이 아니라 draft+미리보기 좌석을 "직접" 건드리는 구조로
//   바뀌어서(요청사항: 저장 버튼 눌러야 실제 캐릭터에 반영), 예전처럼 "실제 캐릭터에 적용 후 미리보기로
//   따로 미러링"하는 절차 자체가 필요 없어짐.
function findMySeat(){ return seats.find(s=>s.isMe) || seats.find(s=>!s.remote) || null; }


/* ============================================================ 🏠 마이홈 (1단계: 친구 탭) */
/* 👥 친구 상한. **다섯 곳이 전부 이 값 하나를 본다** — 추가·수락(둘)·코드추가·우클릭추가 +
   마이홈 친구창 헤더의 (n/상한) 표기. 한 곳만 빠뜨리면 "추가는 되는데 요청 수락은 막힌다" 가 된다.

   [상시 비용 — 실측이 아니라 코드로 확인한 것]
     HTML `subscribeMyFriends` 는 친구 **1명당 onValue 를 4개** 건다
       (`users/{fid}/profile` · `/presence` · `/home/bio` · `/home/avatar`).
     따라서 상시 구독 수 = 친구 수 × 4.
       50명 → 200개  ·  100명 → 400개  ·  300명 → 1200개
     100 은 지금의 2배다. 300(원래 요청값)은 6배라 **방 인원을 늘린 것보다 훨씬 큰 상시 비용**이고,
     같은 이유로 목록 렌더도 6배로 튄다. 그래서 **100 에서 멈춘다.**
   ⚠️ 더 올리려면 구독을 줄이는 쪽을 먼저 볼 것 — bio/avatar 는 목록에 한 줄 띄우자고 상시로
     듣고 있는 값이라, 목록을 열 때만 받아오게 바꾸면 구독이 절반이 된다.
   ⚠️ 이 상한은 **클라이언트 판정**이다. 서버 규칙에는 상한이 없다. */
const FRIEND_MAX = 100;
let _myHomeFriends = {};   // 최근 구독 결과 캐시(렌더용)
let _myFriendRequests = {};   // 👋 나에게 온 친구 요청 { [fromId]: {name, ts} }

/* 👑 디자인 스튜디오 이미지 업로드 — 실제 표시 영역에 맞춘 리사이즈 상한.
   큰 원본을 그대로 올리면 Storage/전송 용량이 폭증하므로 업로드 전에 캔버스로 축소한다.
   · 배경(bg): 마이홈 창 760px − 좌우 여백 26px×2 = 약 708×440px의 가로형 영역.
     고해상도 화면을 고려해 1.5배(1060×660)를 상한으로 둠. 비율은 유지하며 축소만 함.
   · 패널: 프로필 박스·아바타 등 88~160px, 넓어야 약 350px 폭. 1.5배인 525px이면 충분. */
const DS_IMG_MAX_BG_W  = 1060;   // 배경 가로 상한 (708px 표시 영역 × 1.5)
const DS_IMG_MAX_BG_H  = 660;    // 배경 세로 상한 (440px 표시 영역 × 1.5)
const DS_IMG_MAX_PANEL = 525;    // 패널류 긴 변 상한 (350px × 1.5)
const DS_IMG_QUALITY   = 0.82;   // JPEG 품질 — 이 정도면 눈에 띄는 열화 없이 용량이 크게 줄어듦


/* 📅 스케줄러(일정 · D-day 달력) · 🔔 일정 알림 — parts/scheduler.js 로 옮겼다(앱 FSD 1번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(버튼 연결 · 🔔 알림 구독 · 자정 넘김 타이머)이 예전과 같은 때 돈다.
   ⚠️ _mhViewingUserId 는 이 줄보다 뒤(마이홈 방문)에 let 으로 선언된다 — 값이 아니라 읽는 함수로 넘긴다.
   함수 deps 도 화살표로 감싼다(부를 때 찾게). ⚠️ 이름을 Scheduler · scheduler 로 짓지 말 것 — 크로미움(Electron) 내장 전역(작업 예약 API)과
     겹쳐 typeof 가드가 늘 통과하고, 모듈이 안 실렸을 때 내장 생성자에 createScheduler 를 부르다 app.js 가 선다. */
const BELL_SEEN_KEY = 'tw.bellSeenTs';   // 🔔 마지막으로 알림창을 연 시각 — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)도 쓴다
let _schedDdaysVisitUnsub = null;        // 👀 관람 중 친구 D-day 구독 끊기 — openFriendHomeView · closeFriendHomeView
const SCHEDULER_OFF = { renderSchedCalendar(){}, renderDdays(){}, subscribeMonth(){}, setDdays(){}, setDdaysVisit(){},
  refreshBellBadge(){}, renderBellList(){}, isBellOpen:()=>false };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — 부르는 곳마다 null 을 묻지 않게(WD_EAR_OFF 와 같은 방식)
const mhScheduler = (typeof MhScheduler === 'undefined') ? SCHEDULER_OFF : MhScheduler.createScheduler({
  getMyUserId: ()=>getMyUserId(),
  getDisplayName: ()=>getDisplayName(),
  viewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  myHomeFriends: ()=>_myHomeFriends,
  toast: (...a)=>toast(...a),
  uiIconEl: (...a)=>statusChipMod.uiIconEl(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  closeChipPopups: (...a)=>_closeChipPopups(...a),
  positionInputBelowChar: (...a)=>statusChipMod._positionInputBelowChar(...a),
  inboxUnreadCount: ()=>inboxMod.inboxUnreadCount(),
  refreshFriendTabBadge: ()=>inboxMod.refreshFriendTabBadge(),
  bellSeenKey: BELL_SEEN_KEY,
});

/* 🐞 버그 제보 탭(오픈카톡 기본 링크 — bugReport/current · window._bugReportLink)은 parts/bug-board-ui.js 끝으로 옮겼다(앱 FSD 5번).
     게시판 화면과 한 파일이다. 그 파일은 app.js 뒤에 싣지만 firebase-init.js(type="module")보다는 앞이라 구독 시작 때는 같다.
   👥 친구 관리(받은 요청 · 📤 보낸 요청 · 선물함 서브탭) · 👋 새 친구 요청 팝업 · 친구 탭 배지는 parts/friend-manage.js 로 옮겼다
     (앱 FSD 5번 · docs/APP_FSD_MAP.md). ★ 원래 자리인 여기서 만든다(만들 때 바로 도는 일은 없다 — 상태 초기값뿐).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myFriendRequests · _myHomeFriends · myHomeOpen 은 다시 대입되는 let 이라
     읽는 함수로 넘긴다(myHomeOpen 은 이 줄보다 한참 뒤에 선언된다). 부르는 곳은 friendManage.이름.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FRIEND_MANAGE_OFF = { showFriendRequestPopup(){}, reqVisible:()=>false, renderFriendManage(){}, renderFriendRequests(){},
  refreshFriendReqBadge(){}, lookupName:async()=>null, bulkAccept(){}, bulkReject(){}, setTab(){}, tab:()=>'req',
  picked:new Set() };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const friendManage = (typeof TwFriendManage === 'undefined') ? FRIEND_MANAGE_OFF : TwFriendManage.createFriendManage({
  getMyUserId: ()=>getMyUserId(),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  giftStat: (...a)=>inboxMod.giftStat(...a),
  renderGiftBox: (...a)=>inboxMod.renderGiftBox(...a),
  inboxTimeStr: (...a)=>inboxMod.inboxTimeStr(...a),
  myHomeOpen: ()=>myHomeOpen,
  myHomeFriends: ()=>_myHomeFriends,
  myFriendRequests: ()=>_myFriendRequests,
  friendMax: FRIEND_MAX,
});
let _myHomeReady = false;
function _waitForFirebaseAPI(cb, tries){
  tries = tries||0;
  if(window.firebaseAPI && firebaseAPI.subscribeMyFriends){ cb(); return; }
  if(tries>40) return;   // 최대 20초 정도 재시도 후 포기(오프라인 등)
  setTimeout(()=>_waitForFirebaseAPI(cb, tries+1), 500);
}
/* 🔇 소유권이 걸린 쓰기가 거부됐을 때 침묵을 깬다.
   [경위] 규칙을 게시한 뒤 users/{코드} 의 자기 소유 가지는 "주인이 없거나 나일 때"만 쓸 수 있다.
     구글에 묶인 계정인데 이 기기에 로그인 세션이 없으면(혹은 아직 복원 전이면) 그 쓰기가
     permission_denied 로 떨어진다. 거부는 화면에 아무 표시도 안 남긴다 — 유저에게는
     "이름이 안 바뀐다 / 친구가 사라졌다"로만 보인다.
   ⚠️ 막지 않는다. 알려주기만 한다 — 고치는 방법은 재시작 한 번이다(부팅 게이트 K 가 로그인을 받는다 · 개정 16: 설정 › 계정 로그인은 걷었다). */
/* ═══ 🖥️ 한 계정 한 기기 — 밀려난 기기의 처리 [2026-09-17 제보 3 · 시안 확정(왼쪽)] ═══════════════
   firebase-init.js claimDeviceSession 주석이 구조다. 여기는 «밀려난 뒤 이 기기가 하는 일» 뿐이다:
     방에서 나온다(doLeaveRoom) · 방 입장을 막는다(startRoom 첫 줄) · 차단 화면을 띄운다.
   ★ 로그아웃하지 않는다 — 캐릭터·기록·신원 그대로. 로그아웃은 사람이 눌러야 도는 길이다(_loginDoLogout).
   «여기서 계속 쓰기» = 다시 claim → 반대쪽이 이 화면을 본다. «앱 닫기» = quitApp. */
/* 본문은 device-lost.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const DEVICE_LOST_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const deviceLostMod = (typeof TwDeviceLost === 'undefined') ? DEVICE_LOST_MOD_OFF : TwDeviceLost.createDeviceLost({
  getMyUserId: (...a)=>getMyUserId(...a),
  roomEntryMod: ()=>roomEntryMod,
});

/* ═══ 🏠 마이홈 열기(initMyHome) · 소유자 쓰기 거부 안내 ═══ */
/* 본문은 myhome-init.js 로 옮겼다(앱 FSD 44번 남은 몫). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_INIT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhInitMod = (typeof TwMyHomeInit === 'undefined') ? MH_INIT_MOD_OFF : TwMyHomeInit.createMyHomeInit({
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  _inboxBroadcast: ()=>_inboxBroadcast,
  _myFriendRequests: ()=>_myFriendRequests,
  _myHomeFriends: ()=>_myHomeFriends,
  _myHomeReady: ()=>_myHomeReady,
  _myInbox: ()=>_myInbox,
  _myInboxReady: ()=>_myInboxReady,
  _waitForFirebaseAPI: (...a)=>_waitForFirebaseAPI(...a),
  deviceLostMod: deviceLostMod,
  ensureMyFriendCode: (...a)=>ensureMyFriendCode(...a),
  focusLevelMod: ()=>focusLevelMod,
  friendManage: friendManage,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  inboxMod: ()=>inboxMod,
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>myHomeOpen,
  toast: (...a)=>toast(...a),
  setInboxBroadcast: (v)=>{ _inboxBroadcast = v; },
  setMyFriendRequests: (v)=>{ _myFriendRequests = v; },
  setMyHomeFriends: (v)=>{ _myHomeFriends = v; },
  setMyHomeReady: (v)=>{ _myHomeReady = v; },
  setMyInbox: (v)=>{ _myInbox = v; },
  setMyInboxReady: (v)=>{ _myInboxReady = v; },
});
/* ═══ 📩 수령함 상태 · 안 읽은 수 · 친구 탭 배지 ═══ */
let _myInbox = {};              // 📩 개인 수령함(보상 등) { id: {tag, title, body, ts, read} }
/* 수령함이 서버에서 **한 번이라도 도착했는가.** 빈 객체는 '비었다'와 '아직 안 왔다'를 구분하지
   못하므로, 수령함을 근거로 판단하는 곳(_danceUnlockPending 의 구제 분기)은 이 값을 먼저 본다. */
let _myInboxReady = false;
let _inboxBroadcast = {};       // 📢 공용 공지(전체 대상) { id: {tag, title, body, ts} } — 읽음은 로컬
const INBOX_BC_READ_KEY = 'tw.inboxBcRead';   // 공용 공지 읽음 id 집합(로컬)
/* ═══ 🛡️ 공용 HTML 이스케이프(escHtml) ═══ */
/* 🛡️ 공용 HTML 이스케이프 — **다섯 문자 전부**(`& < > " '`)를 막는다.
   [경위] 예전엔 강도가 다른 헬퍼가 셋이었다: `_chatEsc`(다섯 전부) · `_mhEsc`(`&`·`<` 둘뿐) ·
     `_linkifyText` 내부(`'` 만 빠짐). 약한 쪽이 **속성값 안에서** 쓰이면 닉네임에 `"` 를 넣어
     속성을 빠져나와 `on*` 이벤트를 새로 붙일 수 있다 — 친구 목록 `title=` 이 그 구멍이었다.
     그래서 하나로 합쳤다. `_mhEsc` 는 없앴고, `_chatEsc` 는 **이름만** 별칭으로 남긴다
     (채팅 쪽 마커 복원 구조가 그 이름을 쓴다).
   ⚠️ **다섯 문자에서 하나도 빼지 말 것.** 하나만 빠져도 속성 안에서 뚫린다.
     audit 검사 19 가 다섯 개를 세고 있다.
   ⚠️ 이스케이프는 **마크업 문자열을 만들 때만** 쓴다. `el.title = …` · `el.textContent = …`
     처럼 프로퍼티로 넣는 자리에 쓰면 `&quot;` 가 글자로 보인다. 속성은 되도록
     보간을 버리고 `setAttribute`/프로퍼티로 옮기는 쪽이 낫다 — 이스케이프보다 안전하다. */
function escHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

/* ═══ 💬 채팅창 투명도 · 글자 크기 ═══ */
/* 본문은 chat-prefs.js 로 옮겼다(앱 FSD 41번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHAT_PREFS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const chatPrefsMod = (typeof TwChatPrefs === 'undefined') ? CHAT_PREFS_MOD_OFF : TwChatPrefs.createChatPrefs({
  CHAT_SFX_DEFAULT_ID: sfxMod.CHAT_SFX_DEFAULT_ID,
  CHAT_SFX_DEFAULT_ON: sfxMod.CHAT_SFX_DEFAULT_ON,
  CHAT_SFX_GAP_MS: sfxMod.CHAT_SFX_GAP_MS,
  CHAT_SFX_ID_KEY: sfxMod.CHAT_SFX_ID_KEY,
  CHAT_SFX_LIST: sfxMod.CHAT_SFX_LIST,
  CHAT_SFX_ON_KEY: sfxMod.CHAT_SFX_ON_KEY,
  Presence: ()=>Presence,
  _chatEsc: (...a)=>_chatEsc(...a),
  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),
  _chatIsSecretRoom: (...a)=>chatLockMod._chatIsSecretRoom(...a),
  _chatLogCache: ()=>_chatLogCache,
  _chatOffOn: (...a)=>chatLockMod._chatOffOn(...a),
  _chatOffRefreshUI: (...a)=>chatLockMod._chatOffRefreshUI(...a),
  _chatRoomCode: (...a)=>chatLockMod._chatRoomCode(...a),
  _chatSfxPools: sfxMod._chatSfxPools,
  chatUiMod: ()=>chatUiMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  officeMode: ()=>officeMode,
  seats: seats,
  toast: (...a)=>toast(...a),
});

/* ═══ 🔔 채팅 알림음 — 상태 · 저장 · 메뉴 ═══ */
/* (앱 FSD 41번) 이 자리의 본문도 chat-prefs.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🛡️ 리치 텍스트 sanitize · 저장 · 글자 수 ═══ */
/* 본문은 rich-text.js 로 옮겼다(앱 FSD 42번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const RICH_TEXT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const richTextMod = (typeof TwRichText === 'undefined') ? RICH_TEXT_MOD_OFF : TwRichText.createRichText({
  escHtml: (...a)=>escHtml(...a),
});

/* ═══ 👥 마이홈 친구 목록 · Ctrl+F 검색 ═══ */
/* 👥 마이홈 친구 목록(Ctrl+F 검색) · 📩 수령함 · 💝 선물함 그리기 · 수령함 함수(안 읽은 수 · 배지 · 공지 읽음) · 친구 방 표시 둘은
     parts/myhome-inbox.js 로 옮겼다(앱 FSD 15번 · docs/APP_FSD_MAP.md). ★ 원래 자리인 여기서 만든다 — 만들 때 바로 도는 일은 없다(상태 초기값뿐).
   부르는 곳은 inboxMod.이름(전부 이 줄보다 늦게 돈다). 📩 수령함 상태 머리 아래 _myInbox · _myInboxReady · _inboxBroadcast 는 마이홈 열기의
     구독이 다시 대입해서 app.js 에 두고 읽는 함수로 넘긴다(_myHomeFriends 와 같은 방식). INBOX_BC_READ_KEY 는 로그아웃 지움 목록이 같이 써서
     app.js 에 두고 값으로. isAdmin 은 이 줄보다 뒤에 선언되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
/* 🏠 친구 방에 놀러 가기 — 방 코드 누르기 · 묻는 창 · 이동은 friend-visit.js. 여기는 연결만. */
const friendVisit = window.TwFriendVisit ? TwFriendVisit.createFriendVisit({ document, escHtml, toast,
  getFriend: fid => _myHomeFriends[fid], roomTagOf: (...a)=>inboxMod.friendRoomTag(...a),
  myRoom: () => (typeof Presence !== 'undefined' && Presence.roomCode) ? Presence.roomCode() : null,
  inRoom: () => typeof Presence !== 'undefined' && Presence.active(),
  leaveRoom: () => roomEntryMod.doLeaveRoom({ wipeChat: true }), startRoom: c => roomEntryMod.startRoom(c),
  channelName: c => { const ch = Object.keys(roomEntryMod.ROOM_PREFIX).find(k => String(c).indexOf(roomEntryMod.ROOM_PREFIX[k]) === 0); return ch ? roomEntryMod.CHANNEL_NAMES[ch] : ''; } }) : null;
const INBOX_OFF = { renderMyHomeFriendList(){}, friendSearchToggle(){}, setFriendFilter(){}, friendRoomTag:()=>'', friendInRoom:()=>false,
  renderInbox(){}, setInboxFilter(){}, setInboxOpenId(){}, inboxTagLabel:()=>'', inboxTimeStr:()=>'', inboxUnreadCount:()=>0, inboxBcMarkAllRead(){},
  refreshFriendTabBadge(){}, linkifyText:(t)=>escHtml(t), bindExtLinks(){}, renderGiftBox(){}, giftStat(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const inboxMod = (typeof TwMyHomeInbox === 'undefined') ? INBOX_OFF : TwMyHomeInbox.createMyHomeInbox({
  escHtml: (...a)=>escHtml(...a),
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  // 📩 수령함
  myInbox: ()=>_myInbox,
  inboxBroadcast: ()=>_inboxBroadcast,
  INBOX_BC_READ_KEY: INBOX_BC_READ_KEY,
  isAdmin: ()=>isAdmin,
  mhScheduler: mhScheduler,
  // 👥 친구 목록
  myHomeFriends: ()=>_myHomeFriends,
  FRIEND_MAX: FRIEND_MAX,
  friendVisit: friendVisit,
  mhStripHtml: (...a)=>richTextMod._mhStripHtml(...a),
  starFromRemote: (...a)=>focusLevelMod.starFromRemote(...a),
  lvStarBadgeClass: (...a)=>lvTierMod.lvStarBadgeClass(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  lvBadgeClass: (...a)=>lvTierMod.lvBadgeClass(...a),
  openFriendHomeView: (...a)=>mhVisitMod.openFriendHomeView(...a),
  renderMhProfileRail: (...a)=>myHomeUiMod.renderMhProfileRail(...a),
});
/* ═══ 📩 수령함 · 💝 선물함 그리기 ═══ */
/* 📩 수령함 · 💝 선물함 그리기는 parts/myhome-inbox.js 로 옮겼다(앱 FSD 15번) — 연결은 바로 위 «👥 마이홈 친구 목록» 머리 아래(inboxMod). */
/* ═══ 🏠 마이홈 창 버튼 연결(bindMyHomeUI) ═══ */
/* 본문은 myhome-ui.js 로 옮겼다(앱 FSD 22번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MY_HOME_UI_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const myHomeUiMod = (typeof TwMyHomeUi === 'undefined') ? MY_HOME_UI_MOD_OFF : TwMyHomeUi.createMyHomeUi({
  FRIEND_MAX: FRIEND_MAX,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  _mhApplyVisitUI: (...a)=>mhVisitMod._mhApplyVisitUI(...a),
  _mhCloseStickerAnim: (...a)=>mhStLayoutMod._mhCloseStickerAnim(...a),
  _mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  _myFriendRequests: ()=>_myFriendRequests,
  _myHomeFriends: ()=>_myHomeFriends,
  _saveFailMsg: (...a)=>_saveFailMsg(...a),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  closeFriendHomeView: (...a)=>mhVisitMod.closeFriendHomeView(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  friendManage: friendManage,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  inboxMod: inboxMod,
  isAdmin: ()=>isAdmin,
  loadMyHomePage: (...a)=>mhPageMod.loadMyHomePage(...a),
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>myHomeOpen,
  myHomeSticker: ()=>myHomeSticker,
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  renderMyHomeStickers: (...a)=>renderMyHomeStickers(...a),
  toast: (...a)=>toast(...a),
  setMyHomeOpen: (v)=>{ myHomeOpen = v; },
});

/* ============================================================ 🏠 마이홈 (2단계: 프로필/게시글/스티커) */
/* 본문은 myhome-visit.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_VISIT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhVisitMod = (typeof TwMyHomeVisit === 'undefined') ? MH_VISIT_MOD_OFF : TwMyHomeVisit.createMyHomeVisit({
  _myHomeFriends: ()=>_myHomeFriends,
  _schedDdaysVisitUnsub: ()=>_schedDdaysVisitUnsub,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  loadMyHomePage: (...a)=>mhPageMod.loadMyHomePage(...a),
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>myHomeOpen,
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  toast: (...a)=>toast(...a),
  setSchedDdaysVisitUnsub: (v)=>{ _schedDdaysVisitUnsub = v; },
  setMyHomeOpen: (v)=>{ myHomeOpen = v; },
});

/* ═══ 🔬 __mhClickDiag() — "보이는데 안 눌린다"를 한 줄로 가르는 진단 ═══════════
   [왜 필요한가] 마이홈에서 "버튼이 안 눌린다"는 제보가 두 건 왔는데(방명록 등록 · 닉네임 수정),
     둘 다 코드로는 멀쩡하다 — 리스너도 붙어 있고 핸들러도 예외 없이 끝난다
     (sim-mh-name-edit.js 가 그걸 실제로 눌러서 확인한다). 그러면 남는 원인은 **화면 가림**인데,
     그건 레이아웃이 있어야만 보이는 것이라 소스를 아무리 읽어도 안 나온다.
   [무엇을 하나] 각 버튼의 한가운데 좌표에서 elementFromPoint 를 찍어, **거기서 실제로 클릭을
     받는 것이 누구인지** 이름으로 돌려준다. 가린 것이 있으면 그 정체가 그대로 찍힌다.
   [쓰는 법] 마이홈을 연 상태에서 콘솔에 `__mhClickDiag()`.
     · 보임:false            → 가려진 게 아니라 숨겨진 것이다(관람·미리보기 잠금 쪽을 본다)
     · 가려짐:true + 가린것  → 그 요소가 범인이다
     · 전부 정상             → DOM 은 결백하다. 그때는 클릭 통과(_pointHitsInteractive) 쪽을 본다
   ⚠️ 실행 화면은 창이 투명해 콘솔을 열기 어렵다. 런처/생성기에서 마이홈을 열고 보는 것이 쉽다.
   ⚠️ 이건 **진단이지 방어가 아니다.** 원인을 잡고 나면 지워도 되는 블록이다. */
/* 본문은 myhome-diag.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_DIAG_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhDiagMod = (typeof TwMyHomeDiag === 'undefined') ? MH_DIAG_MOD_OFF : TwMyHomeDiag.createMyHomeDiag({
  _mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
});

/* ═══ 🏠 마이홈 페이지 불러오기 · 그리기 ═══ */
/* 본문은 myhome-page.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_PAGE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhPageMod = (typeof TwMyHomePage === 'undefined') ? MH_PAGE_MOD_OFF : TwMyHomePage.createMyHomePage({
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  mhVisitMod: mhVisitMod,
  myHomeUiMod: myHomeUiMod,
  renderMyHomeStickers: (...a)=>renderMyHomeStickers(...a),
  richTextMod: richTextMod,
});
/* ═══ ✏️ 인앱 프롬프트(asyncPrompt) ═══ */
/* 본문은 async-prompt.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ASYNC_PROMPT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const asyncPromptMod = (typeof TwAsyncPrompt === 'undefined') ? ASYNC_PROMPT_MOD_OFF : TwAsyncPrompt.createAsyncPrompt({
});
/* ═══ 🎨 마이홈 스티커 배치 · 그리기(renderMyHomeStickers) · 관리 창 연결 ═══ */
/* 본문은 myhome-sticker-layout.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_ST_LAYOUT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhStLayoutMod = (typeof TwMyHomeStickerLayout === 'undefined') ? MH_ST_LAYOUT_MOD_OFF : TwMyHomeStickerLayout.createMyHomeStickerLayout({
  _mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  _myHomeData: ()=>mhVisitMod._myHomeData(),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  renderMyHomeStickers: (...a)=>renderMyHomeStickers(...a),
});
function renderMyHomeStickers(){
  const zone=document.getElementById('mhStickerZone'); if(!zone) return;
  // 스티커는 '마이홈' 탭에서만 표시 — 친구/스케줄러/버그제보 탭에서는 감춤
  //   (예전엔 친구 탭만 숨겼는데, 스케줄러 탭에도 스티커가 따라오던 문제 수정)
  const activeTab = document.querySelector('#myHomeTabs .mh-tab.on');
  const onHomeTab = activeTab && activeTab.dataset.tab === 'home';
  zone.classList.toggle('hidden', !onHomeTab);
  if(!onHomeTab){ mhStLayoutMod._mhFitWindowSafe(); myHomeSticker.editEnd(); return; }

  const data = mhStLayoutMod._mhStickersData();
  const canEdit = mhStLayoutMod._mhCanEditStickers();
  zone.innerHTML='';
  Object.keys(data).forEach(sid=>{
    const s=data[sid];
    const el=document.createElement('div'); el.className='mh-sticker';
    if(s.img){ const im=document.createElement('img'); im.src=s.img; im.draggable=false; el.appendChild(im); }
    else {
      // ✨ 이모지도 애니메이션을 걸려면 안쪽 요소가 필요하다(바깥 div는 크기·회전이 이미 쓰고 있음).
      const sp=document.createElement('span'); sp.className='st-emoji'; sp.textContent=s.emoji||'⭐';
      el.appendChild(sp); el.classList.add('emoji');
    }
    if(s.anim) el.classList.add('a-'+s.anim);
    if(s.animSpd) el.classList.add('spd-'+s.animSpd);
    el.style.left=(s.x||0)+'px'; el.style.top=(s.y||0)+'px'; el.dataset.sid=sid;
    // 새 스티커는 원본 비율(w/h)을 가짐. 옛 스티커는 w/h가 없으므로 CSS 기본(40×40 정사각) 유지.
    if(s.w && s.h){
      const baseW = Math.min(s.w, mhStLayoutMod.STICKER_BASE * 2.2);   // 화면상 기본 표시 폭(size=1일 때)
      el.style.width  = baseW + 'px';
      el.style.height = Math.round(baseW * (s.h / s.w)) + 'px';
    }
    const alpha = (typeof s.alpha==='number') ? Math.max(0, Math.min(1, s.alpha)) : 1;
    const tf = mhStLayoutMod._mhStickerTransform(s);
    if(tf) el.style.transform = tf;
    if(alpha !== 1) el.style.opacity = String(alpha);

    if(sid === mhStLayoutMod._mhStickerEditSid() && canEdit) el.classList.add('editing');

    if(s.link){
      el.classList.add('linked'); el.title = canEdit ? (s.link + '  (우클릭: 편집)') : s.link;
      el.addEventListener('click', e=>{
        if(e.target.classList.contains('mh-sticker-del')) return;
        if(e.target.classList.contains('mh-sticker-anim')) return;
        if(el.classList.contains('editing')) return;      // 편집 중엔 링크 안 엶
        if(mhPageMod._mhStickerDragDist()>5) return;                  // 방금 드래그했으면 링크 안 엶
        if(window.companion && companion.openBrowser) companion.openBrowser(s.link);
        else window.open(s.link, '_blank');
      });
    } else if(canEdit){
      el.title = '우클릭: 편집';
    }

    // 우클릭 → 편집모드 진입 (본인만)
    el.addEventListener('contextmenu', e=>{
      e.preventDefault(); e.stopPropagation();
      if(!canEdit) return;
      myHomeSticker.editStart(sid);
    });

    if(canEdit){
      // 삭제 버튼 (편집모드에서만 보임)
      const del=document.createElement('div'); del.className='mh-sticker-del'; del.textContent='×';
      del.onclick=e=>{
        e.stopPropagation();
        delete mhVisitMod._myHomeData().stickers[sid];
        myHomeSticker.editEnd();
        renderMyHomeStickers(); commitMyHomePage(true);
      };
      el.appendChild(del);

      // ✨ 움직임 버튼 — 삭제(×) 옆. 더블클릭은 드래그 처리와 겹쳐 안 잡혀서 버튼 방식으로.
      const anim=document.createElement('div'); anim.className='mh-sticker-anim'; anim.textContent='✨';
      anim.title='움직임 고르기';
      anim.onclick=e=>{ e.stopPropagation(); mhStLayoutMod._mhOpenStickerAnim(sid); };
      el.appendChild(anim);

      // 크기 조절 핸들 (편집모드에서만 보임)
      const handle=document.createElement('div'); handle.className='mh-sticker-handle';
      myHomeSticker.bindResize(handle, sid);
      el.appendChild(handle);

      // 회전 핸들 + 각도 라벨 + 회전 초기화 버튼
      const rotLbl=document.createElement('div'); rotLbl.className='mh-sticker-rotlbl';
      rotLbl.textContent = Math.round(s.rot||0) + '°';
      el.appendChild(rotLbl);

      const rot=document.createElement('div'); rot.className='mh-sticker-rot';
      rot.title='드래그해서 회전 (3° 단위)';
      myHomeSticker.bindRotate(rot, sid, rotLbl);
      el.appendChild(rot);


      // 드래그로 이동 (편집모드에서만)
      myHomeSticker.bindDrag(el, sid);
    }
    zone.appendChild(el);
  });
  mhStLayoutMod._mhFitWindowSafe();   // 🎨 런처 마이홈이면 창 밖으로 나간 스티커만큼 창을 넓힌다
}

/* 🎨 스티커 관리 창 · 스티커 편집모드 · 드래그 · 회전 · 크기는 parts/myhome-sticker.js 로 옮겼다(앱 FSD 7번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(#stMgrClose · #stMgrBringAll 버튼 연결)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게) — renderMyHomeStickers 는 아래 마이홈 페이지 편집 묶음(myhome-edit.js)이 감싸 다시 대입하고,
   commitMyHomePage 는 그 묶음이 window 에 거는 이름이다. _myHomeData · _mhViewingUserId · _mhStickerEditSid 는 다시 대입되는 let 이라
   읽는 함수로, _mhStickerEditSid · _mhStickerDragDist 를 바꾸는 것은 쓰는 함수로 넘긴다(둘 다 renderMyHomeStickers 가 읽는다 — _mhStickerEditSid 는 myhome-sticker-layout.js 에, _mhStickerDragDist 는 app.js 에).
   STICKER_* 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로. 부르는 곳은 myHomeSticker.이름(전부 마이홈을 연 뒤에 돈다).
   🔗 마이홈 본문 링크(bindMyHomeExternalLinks)는 스티커 관리 창이 아니라 여기 남겼다(마이홈 페이지 편집 묶음은 아래에서 myhome-edit.js 로 잇는다).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MYHOME_STICKER_OFF = { open(){}, close(){}, render(){}, bringIn(){}, editStart(){}, editEnd(){},
  bindDrag(){}, bindRotate(){}, bindResize(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const myHomeSticker = (typeof TwMyHomeSticker === 'undefined') ? MYHOME_STICKER_OFF : TwMyHomeSticker.createMyHomeSticker({
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  commitMyHomePage: (...a)=>commitMyHomePage(...a),
  renderMyHomeStickers: (...a)=>renderMyHomeStickers(...a),
  mhStickerOutOfView: (...a)=>mhStLayoutMod._mhStickerOutOfView(...a),
  mhClampStickerPos: (...a)=>mhStLayoutMod._mhClampStickerPos(...a),
  mhStickerDispSize: (...a)=>mhStLayoutMod._mhStickerDispSize(...a),
  mhHomeWinSize: (...a)=>mhStLayoutMod._mhHomeWinSize(...a),
  mhStickerTransform: (...a)=>mhStLayoutMod._mhStickerTransform(...a),
  mhOpenStickerAnim: (...a)=>mhStLayoutMod._mhOpenStickerAnim(...a),
  myHomeData: ()=>mhVisitMod._myHomeData(),
  mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  mhStickerEditSid: ()=>mhStLayoutMod._mhStickerEditSid(),
  setMhStickerEditSid: (v)=>{ mhStLayoutMod.setMhStickerEditSid(v); },
  setMhStickerDragDist: (v)=>{ mhPageMod.setMhStickerDragDist(v); },
  stickerMax: mhStLayoutMod.STICKER_MAX,
  stickerBase: mhStLayoutMod.STICKER_BASE,
  stickerRotSnap: mhStLayoutMod.STICKER_ROT_SNAP,
});

/* ═══ 🔗 마이홈 본문 링크 ═══ */
/* 본문은 myhome-links.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MH_LINKS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const mhLinksMod = (typeof TwMyHomeLinks === 'undefined') ? MH_LINKS_MOD_OFF : TwMyHomeLinks.createMyHomeLinks({
});

/* ═══ 🏠 마이홈 페이지 편집 묶음 · 📖 방명록 모듈 연결 ═══ */
/* 🏠 마이홈 페이지 편집 묶음(자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 스티커 끌기 · 닉네임 · 게시글 제목 · 🎵 BGM ·
   바깥 배경 · 테마 · 👑 디자인 스튜디오 · 프리셋 — 옛 bindMyHomePage)은 parts/myhome-edit.js 로 옮겼다(앱 FSD 7-2 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 만들 때 바로 도는 일(버튼 · 입력칸 연결 · window 고리 · companion.onBgmClosed · onBgmMode 구독)이
     예전과 같은 때 돈다. 바깥에서 부르는 이름은 예전처럼 window 에 걸린다(commitMyHomePage · _mhApplyBg · _mhApplyTheme · _bgmDestroy 등).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeData · _mhViewingUserId · _myHomeLoaded · _myHomeUid · _mhStickerDragDist ·
   isPremium · isAdmin 은 다시 대입되는 let 이라 읽는 함수로, _myHomeLoaded · _mhStickerDragDist 를 바꾸는 것은 쓰는 함수로 넘긴다.
   USER_NAME_MAX 는 이 줄보다 뒤에 선언되는 const 라(TDZ) 읽는 함수로. renderMyHomeStickers 는 모듈이 감싸 다시 대입한다 —
   감싸기 전 함수는 getRenderMyHomeStickers 로 주고, 감싼 함수는 setRenderMyHomeStickers 로 받는다.
   myHomeSticker · STICKER_* · DS_IMG_* 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MYHOME_EDIT_OFF = { commit(){}, openColorPopup(){}, beginNameEdit(){}, beginPostTitleEdit(){}, bgmRefresh(){}, bgmDestroy(){},
  applyBg(){}, applyTheme(){}, openDesignStudio(){}, presets(){ return []; }, presetSave(){}, presetApply(){ return false; }, presetRename(){ return false; } };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const myHomeEdit = (typeof TwMyHomeEdit === 'undefined') ? MYHOME_EDIT_OFF : TwMyHomeEdit.createMyHomeEdit({
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  renderMyHomeStickers: (...a)=>renderMyHomeStickers(...a),
  getRenderMyHomeStickers: ()=>renderMyHomeStickers,
  setRenderMyHomeStickers: (f)=>{ renderMyHomeStickers = f; },
  mhSaveRT: (...a)=>richTextMod._mhSaveRT(...a),
  mhUpdateRTCount: (...a)=>richTextMod._mhUpdateRTCount(...a),
  mhClampStickerPos: (...a)=>mhStLayoutMod._mhClampStickerPos(...a),
  mhViewingDisplayName: (...a)=>mhVisitMod._mhViewingDisplayName(...a),
  mhApplyVisitUI: (...a)=>mhVisitMod._mhApplyVisitUI(...a),
  ytVideoId: (...a)=>plMod.ytVideoId(...a),
  applyThemeToChildDoc: (...a)=>themeUiMod.applyThemeToChildDoc(...a),
  commitUserName: (...a)=>progSettingsMod.commitUserName(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getUserName: (...a)=>getUserName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  myHomeData: ()=>mhVisitMod._myHomeData(),
  mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  myHomeLoaded: ()=>mhVisitMod._myHomeLoaded(),
  setMyHomeLoaded: (v)=>{ mhVisitMod.setMyHomeLoaded(v); },
  myHomeUid: ()=>mhVisitMod._myHomeUid(),
  mhStickerDragDist: ()=>mhPageMod._mhStickerDragDist(),
  setMhStickerDragDist: (v)=>{ mhPageMod.setMhStickerDragDist(v); },
  isPremium: ()=>isPremium,
  isAdmin: ()=>isAdmin,
  userNameMax: ()=>progSettingsMod.USER_NAME_MAX,
  myHomeSticker,
  stickerMax: mhStLayoutMod.STICKER_MAX,
  stickerImgMaxW: mhStLayoutMod.STICKER_IMG_MAX_W,
  dsImgMaxBgW: DS_IMG_MAX_BG_W,
  dsImgMaxBgH: DS_IMG_MAX_BG_H,
  dsImgMaxPanel: DS_IMG_MAX_PANEL,
  dsImgQuality: DS_IMG_QUALITY,
});

/* 📖 방명록(새 글 배지 · 독립 팝업 창 — 웹박수 · 폭죽 · 글 목록 · 쓰기)은 parts/guestbook.js 로 옮겼다(앱 FSD 4번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(#mhGuestbookBtn 클릭 연결 · window 고리 등록)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _mhViewingUserId · _myHomeFriends 는 다시 대입되는 let 이라 읽는 함수로 넘긴다.
   부르는 곳은 예전처럼 window 고리(_mhGbStartWatch · _mhGbStopWatch · _mhGbRefreshBadge · _mhReSubscribeGuestbook · _mhGbRefreshWriteUI ·
   openMyGuestbook)를 typeof 로 보고 부른다 — 모듈이 없으면 고리가 없어 조용히 넘어간다.
   💬 showChatBubble(머리 위 말풍선)은 방명록이 아니라 바로 아래에 남겼다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const GUESTBOOK_OFF = { open(){}, startWatch(){}, stopWatch(){}, refreshBadge(){}, markAllRead(){},
  reSubscribe(){}, refreshWriteUI(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const guestbook = (typeof TwGuestbook === 'undefined') ? GUESTBOOK_OFF : TwGuestbook.createGuestbook({
  getMyUserId: ()=>getMyUserId(),
  getDisplayName: ()=>getDisplayName(),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  applyThemeToChildDoc: (...a)=>themeUiMod.applyThemeToChildDoc(...a),
  mhViewingUserId: ()=>mhVisitMod._mhViewingUserId(),
  mhViewingDisplayName: ()=>mhVisitMod._mhViewingDisplayName(),
  myHomeFriends: ()=>_myHomeFriends,
});

/* ═══ 💬 머리 위 채팅 말풍선(showChatBubble) ═══ */
// 💬 채팅 말풍선 표시 시간(ms) — 이 시간 동안은 상태 말풍선 대신 채팅 내용이 보임.
const CHAT_BUBBLE_MS = 5000;
function showChatBubble(seat, text){
  if(!seat || !text) return;
  seat.chatBubbleText = String(text).slice(0,140);
  seat.chatBubbleUntil = performance.now() + CHAT_BUBBLE_MS;
}
/* ═══════════════ 🌊 채팅 「날리기」 — 흐르는 자막 ═══════════════════════════
   체크하고 보낸 줄은 말풍선 대신 화면 상단 40% 를 가로질러 흐른다(니코동식).

   ⚠️ **「플라잉체어」와 다른 기능이다.** 저쪽(seat.fly · applyRemoteFly · flyCool ·
     sim-fly-egg · sim-fly-replay)은 캐릭터를 날리고, 이쪽은 글자를 흘린다. 이름만 겹친다.

   ★ 움직임은 **CSS 애니메이션 하나**뿐이다. rAF 로 옮기지 말 것 — 포커스가 없을 때
     오버레이 FPS 를 낮추는 구조라(sim-unfocused-fps) rAF 이동은 남의 화면에서 끊긴다.
     여기 JS 가 하는 일은 «요소를 만들고 animationend 에 지우는 것» 뿐이다.
   ★ 한 노드 = 마지막 하나. 말풍선과 같은 한계라, 0.5 초 안에 두 번 날리면 앞 줄이 덮인다.
     chatLog 를 타면 해결되지만 그건 비용 때문에 안 가기로 한 길이라, 보내는 쪽에서
     연타를 억제하는 것으로 갈음한다(_chatFlySendGate).                                */
/* 본문은 chat-ui.js 로 옮겼다(앱 FSD 24번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHAT_UI_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const chatUiMod = (typeof TwChatUi === 'undefined') ? CHAT_UI_MOD_OFF : TwChatUi.createChatUi({
  CHAT_WIN_POS_KEY: ()=>CHAT_WIN_POS_KEY,
  Presence: ()=>Presence,
  _chatDelClose: (...a)=>chatPrefsMod._chatDelClose(...a),
  _chatEsc: (...a)=>_chatEsc(...a),
  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),
  _chatLinkify: (...a)=>_chatLinkify(...a),
  _chatLogCache: ()=>_chatLogCache,
  _chatLogUnsub: ()=>_chatLogUnsub,
  _chatOffOn: (...a)=>chatLockMod._chatOffOn(...a),
  _chatOffRefreshUI: (...a)=>chatLockMod._chatOffRefreshUI(...a),
  _chatRoomCode: (...a)=>chatLockMod._chatRoomCode(...a),
  _danceCmdCooldownAt: ()=>iDeskMod._danceCmdCooldownAt(),
  _diceSvg: (...a)=>diceMod._diceSvg(...a),
  _myHomeData: ()=>mhVisitMod._myHomeData(),
  _officeDemojiHtml: (...a)=>overheadMod._officeDemojiHtml(...a),
  _parseDanceCmdChain: (...a)=>iDeskMod._parseDanceCmdChain(...a),
  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),
  _seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escHtml: (...a)=>escHtml(...a),
  findMySeat: (...a)=>findMySeat(...a),
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  isAdmin: ()=>isAdmin,
  isDanceUnlocked: (...a)=>iDeskMod.isDanceUnlocked(...a),
  officeMode: ()=>officeMode,
  seats: seats,
  showChatBubble: (...a)=>showChatBubble(...a),
  startMyDance: (...a)=>iDeskMod.startMyDance(...a),
  toast: (...a)=>toast(...a),
  setChatLogCache: (v)=>{ _chatLogCache = v; },
  setChatLogUnsub: (v)=>{ _chatLogUnsub = v; },
  setDanceCmdCooldownAt: (v)=>{ iDeskMod.setDanceCmdCooldownAt(v); },
});
const DEMOJI_BY_CMD = chatUiMod.DEMOJI_BY_CMD;   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 읽는다(도메인 단계에서 걷는다)
const DEMOJI_BY_ID = chatUiMod.DEMOJI_BY_ID;   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 읽는다(도메인 단계에서 걷는다)
const DEMOJI_DIR = chatUiMod.DEMOJI_DIR;   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 읽는다(도메인 단계에서 걷는다)

/* ═══════════════ 💬 프리미엄 대화창 (1차: 코어) ═══════════════ */
let _chatLogUnsub = null;      // subscribeChatLog 해제 함수
let _chatLogCache = [];        // 화면에 그린 마지막 메시지 목록(기록 저장용)

/* HTML 이스케이프 (메시지 렌더 시 XSS/깨짐 방지) — 지금은 공용 `escHtml` 의 **별칭**이다.
   ⚠️ 여기에 구현을 되돌려 넣지 말 것. 같은 일을 하는 헬퍼가 둘이 되면 한쪽만 약해지는데,
     그게 정확히 이번에 없앤 `_mhEsc` 가 생긴 경위다(escHtml 정의부 주석 참고).
   이름을 남기는 이유: 채팅 쪽 마커 복원 구조와 검사들이 이 이름을 쓴다.
   ⚠️ `const` 가 아니라 **함수 선언**이다. 여기보다 앞줄에서 부르는 자리가 있어서
     호이스팅이 필요하다(const 로 바꾸면 TDZ 로 조용히 죽는다). */
function _chatEsc(str){ return escHtml(str); }
// 링크 감지 → 클릭 시 외부 열기. 이스케이프된 텍스트에서 http(s) URL만 <a>로 변환.
function _chatLinkify(escapedText){
  return escapedText.replace(/(https?:\/\/[^\s<]+)/g, (m)=>{
    const safe = m.replace(/"/g,'&quot;');
    return `<a href="#" data-url="${safe}" class="cm-link">${m}</a>`;
  });
}

const CHAT_WIN_POS_KEY = 'tw_chat_win_pos';

/* ═══ 🔖 "여기까지 읽었습니다" 구분선 (개인 로컬 전용) ═══════════════════════
   방마다 "마지막으로 읽은 메시지 키"를 localStorage에만 저장한다 — 서버에도 안 올라가고
   다른 참가자에게도 안 보이는, 순수 내 화면 표시용.
   · 대화창을 열 때  : 저장된 키를 이번 세션의 구분선 위치로 '고정'한다.
                       → 창을 닫아둔 동안 쌓인 메시지가 구분선 아래로 표시됨.
   · 대화창을 닫을 때: 그 시점의 마지막 메시지를 읽음으로 기록한다.
   메시지 키는 Firebase push key(subscribeChatLog가 m.id로 넘겨줌 — 시간순 정렬 보장).
   구버전 HTML(id 없음) 대비로 ts 폴백을 둔다. */
/* (앱 FSD 24번) 이 자리의 본문도 chat-ui.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🔇 시크릿룸 채팅 잠금 ════════════════════════════════════════════════
   방장이 방 전체의 채팅을 잠근다. 잠겨도 **😊 이모티콘 · 🎲 주사위 · 💣 폭탄 · /80 · /150** 은 된다.
   ─────────────────────────────────────────────────────────────────────────
   ★ 상태는 `rooms/{코드}/_meta/chatOff` **하나**다. 방 전원이 같은 리스너로 받으므로
     "나만 안 막히는" 상태가 구조적으로 안 생긴다. 방장 본인도 똑같이 막힌다(요청).
   ★ 시크릿룸에서만 동작한다 — `_chatIsSecretRoom()` 을 모든 판정의 앞에 둔다.
     그래야 옛 값이 남은 일반 방이 이유 없이 잠기는 일이 없다.
   ⚠️ 입력칸을 잠그지 않는다. 😊 이모티콘이 이 칸에 `/명령어` 를 꽂아 Enter 로 나가는 구조라,
     readonly 로 막으면 허용하기로 한 이모티콘까지 같이 죽는다. 전송하는 자리에서 가른다. */
/* 본문은 chat-lock.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHAT_LOCK_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const chatLockMod = (typeof TwChatLock === 'undefined') ? CHAT_LOCK_MOD_OFF : TwChatLock.createChatLock({
  Presence: ()=>Presence,
  chatPrefsMod: chatPrefsMod,
  chatUiMod: chatUiMod,
  getMyUserId: (...a)=>getMyUserId(...a),
});
/* ═══ 🗑 대화 기록 삭제 (방장) ══════════════════════════════════════════════
   `rooms/{코드}/chatLog` 를 통째로 지운다. 방 전원이 같은 노드를 구독하므로 **모두의 화면이
   같이 빈다** — 따로 알림을 보내지 않는다.
   ─────────────────────────────────────────────────────────────────────────
   ⚠️ 왼쪽 메뉴의 [지우기](_chatClearNow)와 혼동하지 말 것. 그건 내 화면만 접고 되돌릴 수 있다.
     이건 서버에서 지우는 것이고 **되돌릴 수 없다.** 이름·색·확인창이 전부 그 차이를 위해 있다.
   ★ 지운 뒤 안내줄을 남기지 않는다(요청) — 깨끗하게 빈다.
     그래서 `_chatClearedTo`·입장 컷을 건드릴 필요도 없다: 그 둘은 메시지 키보다 뒤만 그리는
     방식이라, 목록이 비면 자연히 아무것도 안 걸리고 새 메시지는 키가 더 커서 그대로 보인다.
   ★ 표시 조건은 '방장 + 채팅창이 열리는 방'이다. 시크릿룸은 항상 투게더룸으로 열리고
     (_enterRoom 의 _isSecret 분기), 채팅창 자체가 채널2에서만 열리므로 `_activeChannel===2`
     한 줄이 곧 "시크릿룸 + 투게더룸"이다. 조건을 늘리지 말 것 — 늘리면 서로 어긋난다. */
/* (앱 FSD 41번) 이 자리의 본문도 chat-prefs.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 💬 채팅 탭(채널) — 투게더룸 · 시크릿룸 대화창 ═══
   규칙(이름 · 상한 · 인원 · 경로)은 chat-tabs.js. 여기는 화면 · 구독 · 전환.
   ★ 내가 있는 탭 = 마지막으로 누른 탭. 창을 닫거나 접어도 유지, 그 탭이 지워지면 #일반.
     방에 들어오면(재부팅 포함) 그 방에서 마지막에 보던 탭 — 방마다 localStorage(CHAT_TAB_LS_PREFIX + 방 코드)에 기억한다(제보:
     재부팅하면 #일반으로 돌아갔다). 방 메타(탭 목록)가 아직 안 왔을 때는 «지워졌다» 로 보지 않고 기다린다.
   ★ 읽음 구분선 · 입장 컷 · [지우기] 는 ChatTabs.markKey(방, 탭) 를 방 코드 자리에 써서 탭마다 따로 간다
     (#일반은 예전 방 코드 그대로라 기존 표식이 그대로 이어진다).
   ⚠️ 방장 제한은 **화면 수준**이다(Firebase 방) — `_meta.host` 는 문자열일 뿐이라 서버가 방장을 검증하지 못한다
     (채팅 켜짐/꺼짐과 같은 수준). 규칙은 탭 개수(≤ 2)와 이름 길이만 막는다. 🛰 서버 방은 방 서버가 방장만 받는다. */
/* (앱 FSD 24번) 이 자리의 본문도 chat-ui.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 📋 대화 드래그 · 복사 ═══
   ★ 형식은 chat-copy.js(원문 기준). 여기는 선택 → 원문 찾기 · 클립보드 · 우클릭 메뉴 · 다시 그리기 보류.
   ★ mac 은 창이 frame:false 라 기본 편집 메뉴가 없어 Cmd+C 가 안 먹을 수 있다 — 키를 직접 받는다(두 OS 같게). */
/* (앱 FSD 24번) 이 자리의 본문도 chat-ui.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══════════════ 😊 커스텀 이모티콘 (2차) ═══════════════ */
/* (앱 FSD 24번) 이 자리의 본문도 chat-ui.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══════════════ 🎲 주사위 ═══════════════ */
/* 본문은 dice-games.js 로 옮겼다(앱 FSD 39번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const DICE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const diceMod = (typeof TwDiceGames === 'undefined') ? DICE_MOD_OFF : TwDiceGames.createDiceGames({
  Presence: ()=>Presence,
  ROULETTE_FLY_DELAY_MS: ()=>rouletteMod.ROULETTE_FLY_DELAY_MS,
  canFly: (...a)=>canFly(...a),
  chatUiMod: chatUiMod,
  findMySeat: (...a)=>findMySeat(...a),
  flySeed: (...a)=>flySeed(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  officeMode: ()=>officeMode,
  showChatBubble: (...a)=>showChatBubble(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});
/* 📷 스티커사진 계층(parts/purikura/purikura-net.js)으로 가는 유일한 입구.
   ★ 왜 한 곳으로 모으나 — 이 계층은 THREE 도 DOM 도 안 보는 «요금을 정하는 층»이라
     app.js 여기저기서 직접 makeSession 을 부르기 시작하면 세션이 여러 개가 되고,
     구독도 정원 읽기도 사람 수만큼 늘어난다. 입구가 하나면 그 일이 구조적으로 안 생긴다.
   ⚠️ firebase-init.js 는 type="module" 이라 이 파일보다 **늦게** 돈다 —
     부팅 직후에는 firebaseAPI.pkGet 이 아직 없을 수 있다. 그래서 «부를 때마다» 확인하고,
     성공한 뒤에만 기억한다(못 만든 것을 기억해 두면 영영 안 붙는다).
   ⚠️ 구버전 HTML 에는 parts/purikura/purikura-net.js 가 없다 — 그때는 null 이고 부르는 쪽이 안내한다. */
let _pkSession = null;
function _purikura(){
  if(_pkSession) return _pkSession;
  if(typeof Purikura === 'undefined' || !Purikura || !Purikura.makeSession) return null;
  if(typeof firebaseAPI === 'undefined' || !firebaseAPI || !firebaseAPI.pkGet) return null;
  /* 콜백은 여기서 한 번만 물린다 — 세션이 하나뿐이므로 구독도 하나뿐이다.
     ⚠️ 창이 닫혀 있는 동안에도 콜백은 살아 있다. 그래서 각 핸들러가 PK.open 을 먼저 본다. */
  try{ _pkSession = Purikura.makeSession(firebaseAPI, {
        onPeers: p => { purikuraUi.onPeers(p); },          // 화면 쪽은 parts/purikura/purikura-ui.js
        onMeta : m => { purikuraUi.onMeta(m); },
        onEvent: (slot, ev) => { purikuraUi.onPeerEvent(slot, ev); },
        onShot : s => { purikuraUi.onShot(s); }
      }); }
  catch(e){ console.warn('[스티커사진] 세션 생성 실패', e); return null; }
  return _pkSession;
}

/* 📷 스티커사진 창(촬영 창 · 로비 · 무대 · 키 · 매 프레임 · 촬영 · 꾸미기) — parts/purikura/purikura-ui.js 로 옮겼다(앱 FSD 3번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(_pkWire: 버튼 · 창 끌기 · ⎋ 사다리 등록)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). officeMode · _plPlaying(playlist.js 상태 — plMod.st.playing) 은 다시 대입되는 let 이고, Presence · SPINE_AXIS · HEAD_AXIS ·
   HAND_REST · SHAKE_ARM_DROOP 은 이 줄보다 뒤에 선언되는 const 라(지금 읽으면 TDZ) 읽는 함수로 넘긴다.
   세션 입구 _purikura() 는 위에 그대로 — 콜백은 purikuraUi.onPeers · onMeta · onPeerEvent · onShot 으로 들어간다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const PURIKURA_UI_OFF = { open(){}, close:()=>false, isOpen:()=>false, phase:()=>null,
  onPeers(){}, onMeta(){}, onPeerEvent(){}, onShot(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const purikuraUi = (typeof TwPurikuraUi === 'undefined') ? PURIKURA_UI_OFF : TwPurikuraUi.createPurikuraUi({
  purikura: ()=>_purikura(),
  toast: (...a)=>toast(...a),
  getMyUserId: ()=>getMyUserId(),
  getDisplayName: ()=>getDisplayName(),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  plRender: (...a)=>plMod.render(...a),
  plPlaying: ()=>plMod.st.playing,
  setPlPlaying: v=>{ plMod.st.playing = v; },
  officeMode: ()=>officeMode,
  presence: ()=>Presence,
  mkFrontFill: (...a)=>_mkFrontFill(...a),
  findMySeat: (...a)=>findMySeat(...a),
  setFaceMap: (...a)=>setFaceMap(...a),
  animateRig: (...a)=>animateRig(...a),
  targetFor: (...a)=>targetFor(...a),
  setBone: (...a)=>setBone(...a),
  hueOBC: (...a)=>_hueOBC(...a),
  trickArmBase: (...a)=>iDeskMod._trickArmBase(...a),
  trickArmSpread: (...a)=>iDeskMod._trickArmSpread(...a),
  trickLegPose: (...a)=>iDeskMod._trickLegPose(...a),
  seats,
  mainLightCol: _MAIN_LIGHT_COL,
  mainLightInt: _MAIN_LIGHT_INT,
  keyLightMul: _KEY_LIGHT_MUL,
  fillLightMul: _FILL_LIGHT_MUL,
  animalHandRest: ANIMAL_HAND_REST,
  spineAxis: ()=>SPINE_AXIS,
  headAxis: ()=>HEAD_AXIS,
  handRest: ()=>HAND_REST,
  shakeArmDroop: ()=>SHAKE_ARM_DROOP,
});

/* ═══ 🎟️ [2026-10-02 요청] 하루 횟수 제한 — 🔫 러시안룰렛(워킹룸·혼자) · 🎲 투게더룸 주사위, **각각 하루 6번** ═══
   ★ 둘은 따로 센다(룰렛 6 + 주사위 6). 날짜는 이 PC 의 자정(로컬 날짜)에 넘어간다.
   ★ 세는 시점은 **실제로 굴릴 때**다 — 회사원 모드·쉬는 시간·3초 연타·canFly 불가로 막힌 누름은 안 깎는다.
   ⚠️ 이 기기 localStorage 에만 센다 — 기기마다 따로이고, 콘솔로 지우면 풀린다(난수 자체가 클라이언트라
     🎲 와 같은 수준 — ROULETTE 주석의 ⚠️ 그대로). 서버로 막아야 하면 규칙·서버 기록이 따로 필요하다.
   ⚠️ 저장이 안 되는 환경이면 **막지 않는다**(못 세는 것을 «다 썼다» 로 읽으면 놀이가 영영 잠긴다). */
/* (앱 FSD 39번) 이 자리의 본문도 dice-games.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔫 러시안룰렛 ═══════════════════════════════════════════════════
   [2026-09-23 · handoff-2026-09-21-features §1] 상태칩 ▼ 메뉴 💃 춤추기 아래 버튼.
   ★ 버튼은 **투게더룸에서는 안 보인다**(2026-09-23 요청 · 💃 와 같은 자리에서 숨긴다) — 거기선 대화창 🎲 가
     같은 일을 한다. 아래 _rollRoulette 자체에는 채널 게이트가 없다(혼자·워킹룸에서 도는 길).
   **누른 사람만** 주사위 둘을 굴리고, 하나라도 1이면 **본인이** 날아간다(11/36).
   ★ 날리기는 `Presence.pokeSelf('fly:'+시드)` 로만 간다 — 내 노드 우편함에 쓰면 나를 포함한 방 전원이
     `applyRemoteFly` 로 같은 시드를 재생한다. `throwFlyAt`(남을 겨눔)은 쓰지 않는다.
     ⚠️ 먼저 내 화면에서 돌리지 않는다 — 방송이 돌아올 때 시작하는 규약(💣 주석)을 그대로 지킨다.
   ★ 레벨 게이트 없음 — 💣(FLY_MIN_LEVEL)는 «남을 고른다», 룰렛은 «내 운에 맡긴다».
   ★ 채널 게이트 없음 — `_rollDice` 의 채널 2 줄은 일부러 안 옮겼다. 워킹룸·혼자·투게더룸 전부.
     · 말풍선은 모든 채널(워킹룸 이모티콘과 같은 `Presence.sendChat` 경로).
     · 대화 기록은 **채널 2 만**(워킹룸에는 채팅이 없다).
     · 혼자(방 없음)면 방송이 없으므로 `applyRemoteFly` 를 직접 부른다(회사원 게이트·횟수 세기 동일).
   🏢 회사원 모드 — 💣·📷 와 같이 **누를 때 토스트**로 막는다(내가 방금 누른 버튼이라 무반응은 고장으로 읽힌다).
     보는 사람 쪽 게이트는 `applyRemoteFly` 가 이미 한다.
   ⚠️ 난수는 클라이언트가 굴린다(🎲 와 같은 수준) — 콘솔로 조작 가능. */
/* 본문은 roulette.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ROULETTE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const rouletteMod = (typeof TwRoulette === 'undefined') ? ROULETTE_MOD_OFF : TwRoulette.createRoulette({
  Presence: ()=>Presence,
  canFly: (...a)=>canFly(...a),
  diceMod: diceMod,
  findMySeat: (...a)=>findMySeat(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  officeMode: ()=>officeMode,
  showChatBubble: (...a)=>showChatBubble(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});

/* ═══ 💬 대화창 배선 — 닫기 · 최소화 · 끌기 · 메뉴 · 버튼 ═══ */
const CHAT_WINDOW_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const chatWindowMod = (typeof TwChatWindow === 'undefined') ? CHAT_WINDOW_OFF : TwChatWindow.createChatWindow({
  // 대화창 코어
  closeChatWindow: (...a)=>chatUiMod.closeChatWindow(...a),
  chatWindowIsOpen: (...a)=>chatUiMod._chatWindowIsOpen(...a),
  chatIsMinimized: (...a)=>chatUiMod._chatIsMinimized(...a),
  setChatMinimized: (...a)=>chatUiMod._setChatMinimized(...a),
  saveChatWinPos: (...a)=>chatUiMod._saveChatWinPos(...a),
  sendChatWindowMsg: (...a)=>chatUiMod._sendChatWindowMsg(...a),
  bindChatCopy: (...a)=>chatUiMod._bindChatCopy(...a),
  bindChatTabs: (...a)=>chatUiMod._bindChatTabs(...a),
  toast: (...a)=>toast(...a),
  // 기록 — 저장 · 지우기 · 되돌리기
  saveChatLog: (...a)=>chatUiMod._saveChatLog(...a),
  chatClearNow: (...a)=>chatUiMod._chatClearNow(...a),
  chatClearUndo: (...a)=>chatUiMod._chatClearUndo(...a),
  // 투명도 · 글자 크기
  clampChatOpacity: (...a)=>chatPrefsMod._clampChatOpacity(...a),
  setChatOpacity: (...a)=>chatPrefsMod._setChatOpacity(...a),
  applyChatOpacity: (...a)=>chatPrefsMod._applyChatOpacity(...a),
  setChatFontSize: (...a)=>chatPrefsMod._setChatFontSize(...a),
  applyChatFontSize: (...a)=>chatPrefsMod._applyChatFontSize(...a),
  // 알림음
  chatSfxOn: (...a)=>chatPrefsMod._chatSfxOn(...a),
  setChatSfxOn: (...a)=>chatPrefsMod._setChatSfxOn(...a),
  setChatSfxId: (...a)=>chatPrefsMod._setChatSfxId(...a),
  chatSfxPreview: (...a)=>chatPrefsMod._chatSfxPreview(...a),
  applyChatSfxUI: (...a)=>chatPrefsMod._applyChatSfxUI(...a),
  chatSfxOfficeLock: (...a)=>chatPrefsMod._chatSfxOfficeLock(...a),
  // 날리기 — 체크 · 크기 · 색(세션 변수는 쓰는 함수로)
  setChatFlyOn: (v)=>{ chatUiMod.setChatFlyOn(v); },
  setChatFlySize: (v)=>{ chatUiMod.setChatFlySize(v); },
  setChatFlyColor: (v)=>{ chatUiMod.setChatFlyColor(v); },
  chatFlyRefreshUI: (...a)=>chatUiMod._chatFlyRefreshUI(...a),
  flySizeOk: (...a)=>chatUiMod._flySizeOk(...a),
  FLY_COLOR_LEVEL: chatUiMod.FLY_COLOR_LEVEL,
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  isAdmin: ()=>isAdmin,
  // 🔇 채팅 잠금 · 🗑 기록 삭제
  chatOffToggleClick: (...a)=>chatPrefsMod._chatOffToggleClick(...a),
  chatDelOpen: (...a)=>chatPrefsMod._chatDelOpen(...a),
  chatDelClose: (...a)=>chatPrefsMod._chatDelClose(...a),
  chatDelRun: (...a)=>chatPrefsMod._chatDelRun(...a),
  // 😊 이모티콘
  toggleEmojiPanel: (...a)=>chatUiMod._toggleEmojiPanel(...a),
  emojiCache: ()=>chatUiMod._emojiCache(),
  EMOJI_SLOTS: chatUiMod.EMOJI_SLOTS,
  onEmojiSlotClick: (...a)=>chatUiMod._onEmojiSlotClick(...a),
  onEmojiFilePicked: (...a)=>chatUiMod._onEmojiFilePicked(...a),
  deleteEmoji: (...a)=>chatUiMod._deleteEmoji(...a),
  // 🎲 주사위
  rollDice: (...a)=>diceMod._rollDice(...a),
  // 💣 플라잉체어 조준
  FLY_MIN_LEVEL: FLY_MIN_LEVEL,
  seats: seats,
  setFlyAiming: (...a)=>tricksMod.setFlyAiming(...a),
  flyAiming: ()=>tricksMod._flyAiming(),
  officeMode: ()=>officeMode,
  // 📷 스티커사진
  purikura: (...a)=>_purikura(...a),
  purikuraUi: purikuraUi,
});

/* ═══ 🎛️ 꾸미기 상세조정 패널 · 색 고르기 ═══ */
/* (앱 FSD 29번) 이 자리의 본문도 wardrobe.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🎨 텍스처 파츠 색조 셰이더 ═══ */
/* 🎨 텍스처 파츠 색조 변경 ─────────────────────────────────────────────────
   _col 메쉬 중 텍스처(map)가 있는 것은 material.color를 갈아끼우면 "텍스처 × 색" 곱셈이 되어
   무늬가 어두워지고 탁해진다. 그래서 텍스처가 있으면 색을 덮어쓰는 대신 셰이더에서 '색조(Hue)만'
   회전시킨다 — 명암·무늬·질감(밝기 V)은 원본 그대로 두고 색상만 바뀐다.
     ・채도(S)는 중립(0)을 가운데 두고 양쪽으로 간다 — 오른쪽은 원본과 고른 값 중 진한 쪽을
       따라가고(흑백 텍스처에도 색이 입혀진다), 왼쪽은 원본 채도를 곱해서 낮춘다(끝 = 회색).
     ・emissiveMap이 map과 같은 텍스처를 쓰므로 emissive 쪽에도 같은 변환을 넣어야 색이 어긋나지 않는다.
   ※ 셰이더 주입이라 렌더 결과는 실제 실행에서 눈으로 확인 필요. */
const _HUE_GLSL = `
vec3 twRgb2Hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 twHsv2Rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 twHueShift(vec3 rgb, float hue, float sat, float val){
  vec3 hsv = twRgb2Hsv(rgb);
  hsv.x = hue;
  /* 채도는 양쪽으로 간다. sat = 0 이 중립(원본 채도 그대로, 예전 동작과 동일).
     ・양수(0~1): max(원본, sat*0.9) — 진한 쪽을 따라간다. 흑백 텍스처에 색을 입히는 길.
     ・음수(-1~0): 원본에 (1+sat) 을 곱해 내린다. sat=-1 이면 채도 0 = 완전 회색.
     ⚠️ 음수 쪽을 max() 로 처리하면 절대 안 내려간다 — 슬라이더를 왼쪽 끝까지 밀어도
        회색이 안 되던 원인이 그것이었다(원본 채도가 늘 이겨서). */
  hsv.y = (sat >= 0.0) ? max(hsv.y, sat * 0.9) : hsv.y * (1.0 + sat);
  hsv.y = clamp(hsv.y, 0.0, 1.0);
  /* 밝기는 '덮어쓰기'가 아니라 '배율'이다 — 픽셀마다 다른 원본 명암(hsv.z)에 곱해야
     무늬와 그림자가 살아 있는 채로 전체가 밝아지거나 어두워진다.
     val=1.0 이 중립(예전 동작과 완전히 동일). */
  hsv.z = clamp(hsv.z * val, 0.0, 1.0);
  return twHsv2Rgb(hsv);
}
`;
function _rgbHexToHsv(hex){
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  // getHSL은 HSL이라 HSV의 S/V로 환산
  const v = hsl.l + hsl.s * Math.min(hsl.l, 1 - hsl.l);
  const s = (v === 0) ? 0 : 2 * (1 - hsl.l / v);
  return { h: hsl.h, s: Math.min(1, Math.max(0, s)), v };
}
/* 이 메쉬를 색조 모드로 쓸 수 있는가 = _col이면서 텍스처가 있는가 */
function isHueTintMesh(mesh){
  return !!(mesh && mesh.material && mesh.material.map);
}
function _ensureHueUniforms(mat){
  if(mat.userData && mat.userData._hueU) return mat.userData._hueU;
  mat.userData = mat.userData || {};
  const u = { uHue:{value:0}, uSat:{value:0}, uVal:{value:1}, uOn:{value:0} };
  mat.userData._hueU = u;
  mat.onBeforeCompile = _hueOBC(u);
  mat.needsUpdate = true;
  return u;
}
/* 🎨 색조 셰이더 주입 함수 — u(유니폼 묶음)를 클로저로 잡는다.
   ★ [2026-10-02 제보 #8] _ensureHueUniforms 에서 떼어 냈다. 스티커사진 무대(_pkCloneChar)가 재질을
     m.clone() 하면 THREE r128 의 Material.copy 는 onBeforeCompile 을 **복사하지 않는다**(userData 는
     JSON 값만 복사). 그래서 사본은 원본 텍스처색으로 그려졌다 — 텍스처 파츠(노비 모자·목도리)만
     염색이 빠지고 단색 파츠는 멀쩡했던 이유다. 사본에 같은 주입을 다시 걸려면 이 함수가 따로 있어야 한다. */
function _hueOBC(u){
  return (shader)=>{
    // ★ 같은 객체 참조를 넘겨야 이후 .value 변경이 렌더에 반영된다.
    shader.uniforms.uHue = u.uHue; shader.uniforms.uSat = u.uSat; shader.uniforms.uVal = u.uVal; shader.uniforms.uOn = u.uOn;
    shader.fragmentShader = 'uniform float uHue;\nuniform float uSat;\nuniform float uVal;\nuniform float uOn;\n'
      + _HUE_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n  if(uOn > 0.5){ diffuseColor.rgb = twHueShift(diffuseColor.rgb, uHue, uSat, uVal); }'
    );
    // emissiveMap도 같은 텍스처라 함께 돌려야 색이 어긋나지 않음
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  if(uOn > 0.5){ totalEmissiveRadiance = twHueShift(totalEmissiveRadiance, uHue, uSat, uVal); }'
    );
  };
}
/* hex=null이면 색조 해제(원본 텍스처 그대로).
   hsvOpt = {h(0~1), s(0~1), v(배율, 1=중립)} 가 있으면 그쪽이 우선이다.
   ⚠️ **없을 때 v 를 hex 에서 뽑아 쓰면 안 된다.** 예전에 저장된 색조 값은 밝기를 무시하던 시절에
      고른 것이라(팔레트에서 고른 색은 대부분 V<1), 지금 와서 hex 의 V 를 배율로 쓰면 이미 저장된
      파츠가 일제히 어두워진다. 그래서 hex 만 있는 옛 데이터는 v=1(중립)로 고정한다. */
function applyHueTint(mesh, hex, hsvOpt){
  if(!mesh || !mesh.material || !mesh.material.map) return false;
  const u = _ensureHueUniforms(mesh.material);
  if(!hex && !hsvOpt){ u.uOn.value = 0; return true; }
  if(hsvOpt){
    u.uHue.value = hsvOpt.h || 0;
    u.uSat.value = (hsvOpt.s == null) ? 0 : hsvOpt.s;
    u.uVal.value = (hsvOpt.v == null) ? 1 : hsvOpt.v;
  }else{
    const hsv = _rgbHexToHsv(hex);
    u.uHue.value = hsv.h; u.uSat.value = hsv.s; u.uVal.value = 1;
  }
  u.uOn.value = 1;
  return true;
}
/* 슬라이더 값 → 스와치·플랫 메쉬용 hex. 저장은 colorHSV 가 진짜 값이고 hex 는 표시용 사본이다. */
function _hsvToHex(h, sv, v){
  const c = new THREE.Color();
  c.setHSL(h, Math.max(0, Math.min(1, sv)), Math.max(0, Math.min(1, 0.5 * (v==null?1:v))));
  return '#' + c.getHexString();
}

/* ═══ 🖍️ 파츠 그림칸(_pic) · UV 구제 · 그림 올리기 ═══ */
/* (앱 FSD 21번) 이 자리의 본문도 part-paint.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🎨 꾸미기 색 줄(buildColorRows) · 탭 상태 ═══ */
/* (앱 FSD 29번) 이 자리의 본문도 wardrobe.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🪑 [2026-09-18] 라이선스 전용 책상을 꾸미기창 «책상» 탭으로 옮긴다 ════════════════════
   [왜 옮기나] 전용 책상은 생성기 5단계에서 미보유자에게도 목록에 계속 보였고, 눌러도 토스트만
     떴다. 쓸 수 없는 카드가 목록을 채우는 군더더기였고, 그 카드가 곧 «고르면 저장값에 굳는»
     입구이기도 했다(제보 2 · pruneUnownedLicenseAssets 주석).
   [무엇을 옮기나] **전용 책상만.** 기본 책상·무료 책상과 색·크기·길이·위치는 5단계에 그대로 둔다.
     꾸미기창은 열 때 통째로 라이선스 게이트라(bindWardrobe 의 open), 무료 책상까지 옮기면
     미보유자가 책상을 아예 못 고르게 된다 — 그건 회귀다.
     ⇒ 이 배치라야 «어차피 라이선스 없으면 못 여는 창» 이 문제가 되지 않는다. 그 안에 전용
       책상밖에 없으므로 미보유자가 잃는 것이 없다(2026-09-18 결정).
   [왜 PART_CATS 에 안 넣나] 같은 그룹의 «책상 위»(deskitem)는 bone:'desk' 표식만으로 파츠 배관을
     그대로 탄다 — 부착 대상이 seat.deskAnchor 로 바뀔 뿐이다. 그런데 책상 **본체**는 붙이는 것이
     아니라 seat.desk 를 통째로 갈아 끼우는 것이고(swapDeskVisual), 크기·길이·색이 딸려 있다.
     PART_CATS 에 가짜 카테고리를 하나 넣으면 파츠 등록 UI·카테고리 상한 계산·catEquippedIds·
     applyClothVisibility 가 전부 그것을 «파츠 카테고리» 로 세게 된다. 그래서 **탭만 가상으로**
     끼우고 내용은 renderWdDeskSection 이 따로 그린다.
   ⚠️ 꾸미기창의 draft(wdDraftDef)는 equippedParts·partXfMemory 만 커밋한다(_commitWdDraftNow).
     책상 필드는 커밋 대상이 아니므로 charDef 에 **바로 쓴다** — 생성기의 autoSaveDeskItemsNow 와
     같은 태도다. 다만 미리보기는 draft 를 보므로 draft 에도 같이 적어 준다. */
/* 본문은 premium-assets.js 로 옮겼다(앱 FSD 37번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const PREMIUM_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const premiumMod = (typeof TwPremiumAssets === 'undefined') ? PREMIUM_MOD_OFF : TwPremiumAssets.createPremiumAssets({
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  DESK_SCALE_DEFAULT: ()=>DESK_SCALE_DEFAULT,
  DESK_SCALE_MAX: ()=>DESK_SCALE_MAX,
  DESK_SCALE_MIN: ()=>DESK_SCALE_MIN,
  Presence: ()=>Presence,
  _humanEarMat: (...a)=>_humanEarMat(...a),
  _humanEarPic: (...a)=>_humanEarPic(...a),
  applyDeskCatalogRefToSeat: (...a)=>applyDeskCatalogRefToSeat(...a),
  applyDeskColorToCustom: (...a)=>applyDeskColorToCustom(...a),
  applyDeskDotThumb: (...a)=>applyDeskDotThumb(...a),
  cBase: ()=>cBase,
  clampDeskScale: (...a)=>clampDeskScale(...a),
  deskItemDef: (...a)=>deskItemDef(...a),
  deskPartAnchorOf: (...a)=>deskPartAnchorOf(...a),
  equipDeskItem: (...a)=>equipDeskItem(...a),
  findMySeat: (...a)=>findMySeat(...a),
  gachaMod: ()=>gachaMod,
  humanEar: humanEar,
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  openAssetImport: (...a)=>openAssetImport(...a),
  partPaintMod: partPaintMod,
  resolveCatalogGlb: (...a)=>resolveCatalogGlb(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  savedDesks: ()=>commissionMod.savedDesks(),
  savedItems: ()=>commissionMod.savedItems(),
  seats: seats,
  setDeskScale: (...a)=>setDeskScale(...a),
  slots: ()=>slots,
  swThumb: (...a)=>swThumb(...a),
  toast: (...a)=>toast(...a),
  wardrobeMod: wardrobeMod,
});
/* ═══ 🎨 꾸미기 창 그리기(renderWardrobe) · 파츠 착용(toggleEquip) ═══ */
/* (앱 FSD 29번) 이 자리의 본문도 wardrobe.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자) ═══ */
/* ═══ 🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자) ═══ */
/* 위 두 구역(🗂️ 파츠 페이로드 · 삭제 · 🛠️ 등록 창)의 본문은 admin/admin-part-register.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에 모은다.
   값 열세 개는 이 줄보다 뒤에 선언되거나 다시 대입되므로 읽는 함수로 넘긴다. 밖에서는 adminPartReg.이름 으로 부른다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_PART_REG_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminPartReg = (typeof TwAdminPartRegister === 'undefined') ? ADMIN_PART_REG_OFF : TwAdminPartRegister.createAdminPartRegister({
  _b64: (...a)=>codeCryptoMod._b64(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  fitModel: (...a)=>fitModel(...a),
  generatePartThumbnail: (...a)=>generatePartThumbnail(...a),
  getPartScene: (...a)=>getPartScene(...a),
  getRecHides: (...a)=>premiumMod.getRecHides(...a),
  parseGlbBytes: (...a)=>assetCodeMod.parseGlbBytes(...a),
  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),
  partCatLimit: (...a)=>premiumMod.partCatLimit(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  partsInCat: (...a)=>premiumMod.partsInCat(...a),
  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),
  persistSavedParts: (...a)=>premiumMod.persistSavedParts(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  renderCrItems: (...a)=>renderCrItems(...a),
  renderWardrobe: (...a)=>wardrobeMod.renderWardrobe(...a),
  resolveCatalogGlb: (...a)=>resolveCatalogGlb(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  syncWdGizmoToXf: (...a)=>wardrobeMod.syncWdGizmoToXf(...a),
  toHidesForSave: (...a)=>premiumMod.toHidesForSave(...a),
  toast: (...a)=>toast(...a),
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  seats,
  MAX_CUSTOM_ASSETS: ()=>commissionMod.MAX_CUSTOM_ASSETS,
  MAX_CUSTOM_ITEMS: ()=>commissionMod.MAX_CUSTOM_ITEMS,
  MAX_GACHA_PARTS_PER_CAT: ()=>premiumMod.MAX_GACHA_PARTS_PER_CAT,
  MAX_GLB_BYTES: ()=>commissionMod.MAX_GLB_BYTES,
  MAX_PARTS_PER_CAT: ()=>premiumMod.MAX_PARTS_PER_CAT,
  PART_CATS: ()=>premiumMod.PART_CATS(),
  gachaMod: ()=>gachaMod,
  partSceneCache: ()=>partSceneCache,
  savedDesks: ()=>commissionMod.savedDesks(),
  savedItems: ()=>commissionMod.savedItems(),
  savedParts: ()=>premiumMod.savedParts(),
  wdGizmo: ()=>wardrobeMod.wdGizmo(),
  wdPreviewBase: ()=>wardrobeMod.wdPreviewBase(),
  setSavedParts: (v)=>{ premiumMod.setSavedParts(v); },
});

/* ═══ 🫧 상태 이모지 그림 · UI 아이콘 · 책상 위 이모지 ═══ */
/* (앱 FSD 36번) 이 자리의 본문도 status-chip.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너 ═══ */
/* 본문은 overhead.js 로 옮겼다(앱 FSD 34번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const OVERHEAD_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const overheadMod = (typeof TwOverhead === 'undefined') ? OVERHEAD_MOD_OFF : TwOverhead.createOverhead({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  _chatEsc: (...a)=>_chatEsc(...a),
  _diceSvg: (...a)=>diceMod._diceSvg(...a),
  _seatCtxMenu: (...a)=>_seatCtxMenu(...a),
  _starPaint: (...a)=>lvTierMod._starPaint(...a),
  _wpTmp3: statusChipMod._wpTmp3,
  camera: camera,
  chatUiMod: chatUiMod,
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  officeMode: ()=>officeMode,
  renderer: renderer,
  seatScale: (...a)=>seatScale(...a),
  seats: seats,
  tricksMod: tricksMod,
});
/* ═══ 💬 머리 위 말풍선 · 회사원 모드 라벨 ═══ */
/* (앱 FSD 34번) 이 자리의 본문도 overhead.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 👻 캐릭터 투명도 · 활동 판정(seatState) · 쓰다듬기 ═══ */
/* 캐릭터 opacity (자리비움 영혼 효과) — bodyWrap 하위 모든 mesh의 material에 적용 */
function setSeatOpacity(seat, op){
  if(seat._lastOp===op) return;
  seat._lastOp=op;
  // 자리비움(op≈0)에선 material.opacity만 낮춰선 완전히 사라지지 않으므로 mesh.visible 자체를 함께 토글한다.
  // ★ 단, applyClothVisibility가 관리하는 mesh.visible(파츠 hides에 의한 숨김)을 덮어쓰지 않도록:
  //   자리비움 진입 시 원래 visible 값을 userData._prevVisible에 기억해두고,
  //   자리비움 해제 시 그 값으로 복원. 정상 상태(op≥0.001)에선 visible을 건드리지 않음.
  const hide = op < 0.001;
  seat.bodyWrap.traverse(o=>{
    if(o.isMesh && o.material){
      if(hide){
        // 자리비움 진입 — 원래 visible 상태 저장 후 숨김
        if(o.userData._prevVisible === undefined) o.userData._prevVisible = o.visible;
        o.visible = false;
      } else if(o.userData._prevVisible !== undefined){
        // 자리비움 해제 — 저장된 원래 visible 복원 (hides로 숨긴 상태였다면 그대로 숨김 유지)
        o.visible = o.userData._prevVisible;
        delete o.userData._prevVisible;
      }
      // 정상 상태에선 mesh.visible 안 건드림 → applyClothVisibility의 세팅 유지
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{
        if(!m) return;
        // ★ 파츠가 블렌더에서 설정해온 원본 투명도(transparent/opacity)를 최초 1회 기억해둔다.
        //   예전엔 여기서 무조건 transparent=false, opacity=1로 덮어써서 반투명 파츠가 실행화면에서만
        //   불투명하게 보였음(꾸미기 미리보기는 이 함수를 안 거쳐서 정상이었던 원인).
        /* ★★ 그 기억은 **불투명할 때만**(op≥0.999) 잰다.
           [증상] 작업하다 어느 순간 머리(얼굴 메시)가 통째로 안 보이고, 앱을 껐다 켜야 돌아온다.
           [원인] 예전엔 "처음 보는 머티리얼이면 무조건" 그 자리의 opacity를 원본으로 적었다.
             자리비움은 opacity 0.0 이므로(STATUS 표의 away), 숨어 있는 동안 그 좌석이 다시 빌드되거나
             파츠가 새로 붙어서 그 머티리얼이 이 함수를 **처음** 통과하면, 이미 0이 된 값을 원본으로
             기억한다. 그때부터 baseOp=0 이라 자리비움이 풀려 op=1 이 와도 0 × 1 = 0 — 영영 안 보인다.
             (자동 자리비움은 20분 무반응이면 스스로 걸린다 → "자리를 비웠다 돌아오니 머리만 없다".)
           [왜 껐다 켜면 돌아오나] 이 기억은 머티리얼 메모리(userData)에만 있고 저장되지 않는다.
             즉 저장 데이터는 멀쩡하다 — 표정 텍스처가 지워진 게 아니다.
           ⚠️ _baseTransparent 를 **반드시 같은 조건에 묶어 둘 것.** 따로 재면 투명도만 돌아오고
             transparent 플래그가 켜진 채 남아 depthWrite/정렬이 어긋난다. */
        /* ⚠️ _opTouched 가 왜 필요한가 — op≥0.999 조건만 걸면 구멍이 그대로 남는다.
             숨은 동안 처음 만난 머티리얼은 여기서 못 재고 아래에서 opacity=0 이 **찍힌다.**
             그 뒤 자리비움이 풀려 op=1 로 이 함수가 다시 오면, 조건이 통과되면서
             **우리가 방금 쓴 0** 을 원본이라고 기억한다 — 고치기 전과 똑같이 굳는다.
             그래서 "이 함수가 한 번이라도 쓴 머티리얼"에는 표식을 남기고, 표식이 있으면
             다시는 재지 않는다. 원본을 잴 수 있는 시점은 **건드리기 전, 불투명할 때** 뿐이다. */
        if(m.userData._baseOpacity === undefined && !m.userData._opTouched && op >= 0.999){
          m.userData._baseOpacity     = (typeof m.opacity==='number') ? m.opacity : 1;
          m.userData._baseTransparent = !!m.transparent;
        }
        m.userData._opTouched = true;   // 아래에서 opacity/transparent 를 쓴다 — 이후 이 값은 원본이 아니다
        // 끝내 못 잰 머티리얼(숨은 동안 처음 붙은 파츠 등)은 1/불투명으로 본다.
        //   블렌더에서 반투명으로 만든 파츠라면 그 반투명이 한 번 무시되지만, 0 으로 굳어
        //   영영 안 보이는 쪽보다 이 방향이 훨씬 안전하다.
        const baseOp = (typeof m.userData._baseOpacity === 'number') ? m.userData._baseOpacity : 1;
        const baseTr = (m.userData._baseTransparent !== undefined) ? !!m.userData._baseTransparent : false;
        const eff    = baseOp * op;              // 자리비움 등 상태 투명도 × 파츠 원본 투명도
        m.transparent = baseTr || (op < 0.999);
        m.opacity     = eff;
        m.depthWrite  = (eff > 0.95);   // 반투명 시 z-fighting 줄이기
        m.needsUpdate = true;
      });
    }
  });
}


const FOCUS_MS=1500,SLEEP_MS=8000,PET_MS=2200;
/* 🖊️ 펜 앱(클립스튜디오·포토샵 등)이 활성일 때만 쓰는 넓은 기록 창.
   그림은 한 획이 몇 초씩 이어져서 그 사이 클릭·키 입력이 하나도 없다. 1.5초 기준으로는
   선 하나 긋는 동안 캐릭터가 idle로 빠지고 기록도 뚝뚝 끊긴다. 펜 앱일 때만 4초로 넓힌다.
   (main.js가 activeAppState.isPenApp으로 알려줌 — 목록은 main.js의 PEN_APPS 한 곳에만 둔다) */
const PEN_FOCUS_MS=4000;
let _penAppFocused=false;
function focusWindowMs(){ return _penAppFocused ? PEN_FOCUS_MS : FOCUS_MS; }
let lastActivity=performance.now(),windowFocused=!document.hidden,lastZ=0;
function activity(){lastActivity=performance.now();}

/* ★ 자동 자리비움 전용 "실제 입력" 타임스탬프.
   lastActivity는 focusGateSleep(등록한 포커싱 어플을 쓰는 중인가)에 걸려서, 포커싱 어플을 아예 등록하지
   않았거나 다른 앱을 쓰는 중이면 갱신되지 않음 — 그건 "타이핑 모션" 판정용이라 그게 맞음.
   하지만 자동 자리비움은 어떤 앱을 쓰든 "사람이 컴퓨터를 만지고 있는가"만 보면 되므로 별도로 기록함. */
let lastAnyInput = performance.now();
function anyInput(){ lastAnyInput = performance.now(); }
window.addEventListener('mousemove',activity);window.addEventListener('keydown',activity);window.addEventListener('wheel',activity);
document.addEventListener('visibilitychange',()=>windowFocused=!document.hidden);
window.addEventListener('blur',()=>windowFocused=false); window.addEventListener('focus',()=>{windowFocused=true;activity();anyInput();});
function seatState(seat,now){
  if(seat.pinned) return 'shaking';   // 액자 고정: 드래그된 자세(팔 처짐) + 호흡·blink 유지
  // 사용자 인터랙션 — 흔들기/회복(dizzy)/쓰다듬기(pet)가 모든 자동·수동·remote보다 우선
  if(seat.beingShaken) return 'shaking';
  if(seat.dizzyUntil && now < seat.dizzyUntil) return 'dizzy';
  if(now-seat.petStart<PET_MS) return 'pet';   // remote(친구) 좌석도 쓰다듬으면 반응 보이게(원래 remote 분기보다 아래에 있어서 무시되던 버그)
  // 💃 춤 — 자리비움/자동 상태보다 우선(단, 흔들기·dizzy·pet보다는 아래). 내 좌석은 danceUntil, 친구 좌석은 remoteState로 전달됨.
  if(seat.danceUntil && now < seat.danceUntil && !seat.remote) return 'dance';
  // 자리비움(본인/친구) → 자동·수동과 무관하게 sleep 모션 강제 (영혼 컨셉)
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatus : null);
  if(us==='away') return 'sleep';
  if(seat.remote) return seat.remoteState||'idle';   // 친구 좌석: 공유받은 상태 사용
  if(manual)return manual;
  if(!desktopMode && !windowFocused)return 'sleep';   // 데스크톱 모드에선 다른 프로그램 쓰는 게 정상이라 이 체크 제외(포커싱 게이트가 대신함)
  // 포커싱 어플 게이트: 데스크톱 모드에서, 등록된 앱이 없거나 등록된 앱을 안 쓰는 중이면
  // (직접 쓰다듬기·흔들기 등은 위에서 이미 처리됐으므로) 자동 idle/focus 판정은 sleep으로 대체.
  if(desktopMode && focusGateSleep) return 'sleep';
  if(seat.isMe && focusLevelMod._mobileOn()) return 'focus';   // 📱 폰에서 그리는 중 — 집중 포즈
  const idle=now-lastActivity;
  if(idle<focusWindowMs())return 'focus'; if(idle>SLEEP_MS)return 'sleep'; return 'idle'; }
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
    if(p.userData && p.userData.isDeskItemPivot) return {type:'item', pivot:p};
    p = p.parent;
  }
  return 'desk';
}
// 우클릭 → 내 캐릭터 수정(생성기 열기). 친구(remote) 좌석은 남의 캐릭터라 수정 못 하게 막음.
/* 🙋 친구가 아닌 상대 우클릭 → 친구 신청.
   [왜 팝업이 아닌가] 확인창을 새로 만들면 `position:fixed` 오버레이가 하나 더 늘고, 그러면
     audit 검사 2(클릭 통과 화이트리스트)·12(베젤 radius)·13(타이틀바 토큰)·15(버블 목록)에
     전부 새 항목이 생긴다. 실행 화면은 **투명 전체화면 오버레이**라 native confirm 다이얼로그도 못 쓴다 —
     (여기서 그 이름을 괄호까지 붙여 적으면 audit 검사 4 가 '포커스 보정 없는 호출'로 잡는다 —
      주석까지 세는 검사라, 관례대로 괄호를 뺀다.)
     렌더러를 블로킹한 채 다이얼로그가 안 보여 "앱이 멈춘 것"으로 보인다(디자인 스튜디오 초기화
     버튼이 2단계 클릭으로 바뀐 것과 같은 이유). 그래서 이 파일이 이미 쓰는 관례인
     **2단계 확인**을 그대로 따른다: 한 번 더 우클릭하면 보낸다.
   ⚠️ 🏢 회사원 모드 차단(`if(officeMode && seat.remote) return;`)보다 **뒤**에 있어야 한다.
     그 모드는 상대 우클릭이 아무 반응도 없어야 하고, 토스트가 뜨면 그 목적이 깨진다.
   ★ 실수로 보내도 되돌릴 것이 없다(상대가 수락하기 전까지는 요청 한 줄뿐)지만, 우클릭은
     마이홈 열기와 같은 동작이라 손이 먼저 가기 쉬워서 한 번은 묻는다. */
let _friendReqArmed = null, _friendReqTimer = null;
const FRIEND_REQ_ARM_MS = 5000;   // 이 시간 안에 한 번 더 우클릭하면 전송
function _friendReqAsk(uid, seat){
  const name = (seat && seat.friendName) || '이 사람';
  if(_friendReqArmed !== uid){
    _friendReqArmed = uid;
    clearTimeout(_friendReqTimer);
    _friendReqTimer = setTimeout(()=>{ _friendReqArmed = null; }, FRIEND_REQ_ARM_MS);
    toast(name + '님은 아직 친구가 아니에요 — 한 번 더 우클릭하면 친구 신청을 보내요');
    return;
  }
  clearTimeout(_friendReqTimer); _friendReqArmed = null;
  _friendReqSend(uid, name);
}
async function _friendReqSend(uid, name){
  /* 앞단 검사는 마이홈의 [친구 추가] 와 **같은 순서·같은 문구**로 맞춘다 — 두 입구가 다른 말을 하면
     같은 상황에서 다른 안내를 받는다(친구 코드로는 막히는데 우클릭으로는 되는 것처럼 보이는 종류). */
  if(!window.firebaseAPI || !firebaseAPI.sendFriendRequest){ toast('아직 준비 중이에요'); return; }
  try{
    if(uid === getMyUserId()){ toast('내 코드는 추가할 수 없어요'); return; }
    if(_myHomeFriends && _myHomeFriends[uid]){ toast('이미 친구예요'); return; }
    if(_myHomeFriends && Object.keys(_myHomeFriends).length >= FRIEND_MAX){ toast('친구는 최대 '+FRIEND_MAX+'명까지만 추가할 수 있어요'); return; }
    // 📤 여기는 좌석에서 상대 이름을 알고 있으므로 이름을 이름표로 넘긴다
    const res = await firebaseAPI.sendFriendRequest(getMyUserId(), uid, getDisplayName(), name, null);
    if(res && res.ok) toast(name + '님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요');
    else if(res && res.reason === 'already') toast('이미 친구예요');
    else if(res && res.reason === 'self') toast('내 코드는 추가할 수 없어요');
    else toast('요청에 실패했어요');
  }catch(e){ toast('요청 중 오류가 발생했어요'); }
}
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(_suppressNextContextMenu){ _suppressNextContextMenu=false; return; }   // 이동 모드를 우클릭으로 막 확정한 경우 — 이어서 캐릭터 우클릭 동작으로 안 이어지게
  if(drag){
    // 드래그(흔들기/이동) 중에 우클릭 = 그 자리에 고정(핀) — 편집창은 안 뜸
    if(drag.mode==='shake'){
      const seat=drag.seat;
      seat.beingShaken=false;
      seat.pinned=true;          // seatState가 항상 'idle' 반환 → 호흡·blink만, 상태 변경/pet 무시
      seat._pinPosY=seat.rig.position.y;   // 떨림 방지용 기준 y
    }
    drag=null;
    return;
  }
  /* 🎯 조준 중 우클릭 = 취소. **메뉴를 열지 않는다** — 취소와 메뉴가 같은 클릭에 겹치면
     "취소했어요" 토스트 뒤로 메뉴가 남는다.
     ⚠️ _flyAiming 쪽 취소는 자기 window 리스너가 이미 하므로 여기서는 열지 않기만 한다(2중 취소 방지). */
  if(tricksMod._bonkAiming()){ tricksMod.setBonkAiming(false); return; }
  if(tricksMod._flyAiming()) return;
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(seats.map(s=>s.group),true);
  if(!hit.length) return;
  const seat=seatFromObject(hit[0].object); if(!seat) return;
  /* 🏢 회사원 모드 — 상대 캐릭터 우클릭으로 마이홈이 열리지 않는다.
     ⚠️ 토스트도 띄우지 않는다. 요청이 "잠겨서 반응이 없도록" 이라, 회사에서 화면에 글자가
        튀어나오면 모드의 목적 자체가 깨진다.
     ★ 내 캐릭터 우클릭(아래 openCreator = 편집창)은 막지 않는다 — 요청 문구가 "상대 캐릭터"다.
        내 편집창까지 막을지는 별도 판단이 필요하다. */
  if(officeMode && seat.remote) return;
  /* 🪄 여기서 메뉴를 띄운다 — 예전에는 이 자리에서 **즉시** 마이홈/편집창이 열렸다.
     ★ 동작 변경이다: 상대 캐릭터도 내 캐릭터도 클릭이 한 번 늘어난다. 릴리스 노트에 적을 것.
     ⚠️ 위의 1~5(preventDefault · _suppressNextContextMenu · drag · 레이캐스트 · 회사원 모드)보다
       **뒤**에 있어야 한다. 메뉴를 앞에 붙이면 드래그 중 고정과 이동 확정이 깨진다. */
  _seatCtxMenu(e, seat);
});

/* 🖱 좌석 우클릭 메뉴 — 책상 프리셋 슬롯의 `cr-preset-ctx` 를 그대로 베낀다.
   ★ 클래스 이름을 새로 짓지 않는다. `cr-preset-ctx` 인 이유가 "다른 팝업의 바깥클릭 닫기에서
     예외 처리하려고" 이고, 새 이름을 쓰면 그 예외 목록에 따로 등록해야 한다(안 하면 다른 팝업
     닫기 로직이 이 메뉴를 즉시 닫아버린다). 식별용으로 `seat-ctx` 만 덧붙인다.
   ⚠️ ESC 는 캡처 단계에서 소비하고 전파를 끊는다 — 안 끊으면 ESC 한 번에 메뉴와 마이홈이 같이 닫힌다. */
function _seatCtxMenu(ev, seat){
  try{ document.querySelectorAll('.seat-ctx, .seat-ctx-backdrop').forEach(n=>n.remove()); }catch(_){}
  /* 🫥 투명 뒷판 — **바깥 클릭으로 닫으려면 이게 있어야 한다.**
     [왜] 아래 `closer`(document mousedown)는 예전부터 있었는데도 안 닫혔다. 실행 화면은 투명
       오버레이라, 커서 아래에 '클릭 받을 것'이 없으면 앱이 마우스를 아예 안 받고 뒤 창으로
       흘려보낸다(_pointHitsInteractive). 그러면 바깥을 눌러도 **이 창에는 이벤트가 오지 않는다** —
       리스너가 멀쩡히 달려 있어도 부를 사람이 없는 상태였다.
     ★ 그래서 메뉴가 열려 있는 동안만 화면 전체를 덮는 투명 판을 깔고, 그 클래스를
       _pointHitsInteractive 목록에 넣는다. 그 순간 화면 어디를 눌러도 앱이 클릭을 받는다.
       OS 메뉴가 열려 있을 때 바깥 첫 클릭이 메뉴만 닫는 것과 같은 동작이다.
     ⚠️ 메뉴와 **수명을 반드시 같이 한다.** 남으면 화면 전체가 클릭을 먹는 유령 판이 된다 —
       그래서 만드는 곳과 지우는 곳을 close() 한 곳으로 모은다. */
  const backdrop = document.createElement('div');
  backdrop.className = 'seat-ctx-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
  const menu = document.createElement('div');
  menu.className = 'cr-preset-ctx seat-ctx';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--win-face);'
    + 'border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    + 'box-shadow:2px 2px 4px rgba(0,0,0,.3);padding:3px 0;font-size:11px;min-width:116px;'
    + 'left:' + ev.clientX + 'px;top:' + ev.clientY + 'px;';
  let closer = null, onEsc = null;
  const close = ()=>{
    menu.remove();
    backdrop.remove();
    if(closer) document.removeEventListener('mousedown', closer, true);
    if(onEsc) document.removeEventListener('keydown', onEsc, true);
  };
  /* 4번째 인자 iconSrc = 라벨 앞 작은 그림. 뿅망치처럼 이모지가 없는 항목용(나머지는 그냥 이모지 글자). */
  const mk = (label, fn, disabled, iconSrc)=>{
    const it = document.createElement('div');
    it.textContent = label;
    if(iconSrc){ const im=document.createElement('img'); im.src=iconSrc;
      im.style.cssText='width:15px;height:15px;vertical-align:-3px;margin-right:4px;'; it.prepend(im); }
    /* 여백은 4px 8px — 가장 긴 줄(`[그림] 때리기 (n/5)`)이 min-width 116px 안에 딱 들어오는 값이다.
       ★ 항목이 white-space:nowrap 이므로 이보다 긴 글자가 와도 잘리지 않는다(메뉴가 늘어난다).
         min-width 는 '이보다 좁아지지 않는다'는 하한일 뿐이다. */
    it.style.cssText = 'padding:4px 8px;cursor:' + (disabled ? 'default' : 'pointer') + ';'
      + 'color:' + (disabled ? 'var(--win-lo-2)' : 'var(--ink)') + ';white-space:nowrap;';
    if(!disabled){
      it.onmouseenter = ()=>it.style.background = 'var(--win-select)';
      it.onmouseleave = ()=>it.style.background = '';
      it.onclick = ()=>{ close(); fn(); };
    } else {
      it.onclick = ()=>{ close(); toast('오늘은 다 썼어요'); };
    }
    menu.appendChild(it);
  };
  /* 구분선 — '내 상태'와 '남에게 하는 것'을 가른다. 뒤따르는 줄이 있을 때만 부를 것
     (때리기는 프리미엄에서만 붙으므로, 조건 없이 넣으면 맨 아래에 선만 남는다). */
  const sep = ()=>{
    const d = document.createElement('div');
    d.style.cssText = 'height:1px;margin:3px 0;background:var(--win-lo-2);';
    menu.appendChild(d);
  };
  if(seat.remote){
    // seat.friendId는 방 세션의 memberId(랜덤). 실제 유저 식별은 friendUserId(userId) 필요.
    const uid = seat.friendUserId || null;
    if(uid && _myHomeFriends[uid]){
      mk('🏠 마이홈 구경', ()=>{ mhVisitMod.openFriendHomeView(uid); });
    } else if(uid){
      mk('👤 친구 신청', ()=>_friendReqAsk(uid, seat));
    } else {
      mk('👤 친구 신청', ()=>toast('이 유저의 정보가 아직 없어요 (버전 업데이트가 필요할 수 있어요)'));
    }
    /* 🙈 숨기기 — 워킹룸에서만. 내 화면 · 이 방에 있는 동안만(_hiddenSeatIds 주석).
       🚩 신고로 숨긴 사람은 채널과 상관없이 «🙉 다시 보이기» 하나로 푼다(신고 기록은 그대로). */
    const _rptHid = !!(seat.friendUserId && hiddenSeatsMod._reportHiddenUids.has(seat.friendUserId));
    if(_rptHid){
      mk('🙉 다시 보이기', ()=>{ hiddenSeatsMod._reportHiddenUids.delete(seat.friendUserId); hiddenSeatsMod._reportHiddenSave(); if(seat.friendId) hiddenSeatsMod._hiddenSeatIds.delete(seat.friendId); });
    }
    else if(window._activeChannel === 1 && seat.friendId){
      const _hid = hiddenSeatsMod._hiddenSeatIds.has(seat.friendId);
      mk(_hid ? '🙉 다시 보이기' : '🙈 숨기기', ()=>{
        if(_hid) hiddenSeatsMod._hiddenSeatIds.delete(seat.friendId); else hiddenSeatsMod._hiddenSeatIds.add(seat.friendId);
      });
    }
  } else {
    // 🎨 편집을 첫 항목에 둔다 — 예전에 우클릭이 곧 편집창이었으므로 손이 가는 거리를 줄인다
    mk('🎨 캐릭터 편집', ()=>openCreator({kind:'seat', seat}));
    /* 🫧 자리비움 토글 — **내 좌석에만** 넣는다(남의 상태를 내가 바꿀 수는 없다).
       ★ 배선은 상태 칩 메뉴와 같은 한 줄이다: setUserStatus 가 localStorage 저장 · 칩 갱신 ·
         Presence 전파(머리 위 이모지 + 영혼 투명도)까지 이미 끌고 간다. 여기서 따로 할 일이 없다.
       ⚠️ 해제는 setUserStatus(null) = '온라인'이다. 자리비움 전에 🍚밥/🎮게임 같은 다른 상태였다면
         그 상태로 돌아가지 않는다 — 상태 칩 메뉴에서 골라도 똑같이 동작하므로 그쪽과 맞춘 것이다.
       ⚠️ 자동 자리비움(20분 무반응)은 그대로 살아 있다. 여기서 풀어도 계속 안 움직이면 다시 걸린다. */
    let _away = false; try{ _away = (userStatus === 'away'); }catch(_){}
    mk(_away ? '🔵 비움 해제' : '🫧 자리비움', ()=>{
      setUserStatus(_away ? null : 'away');
    });
    if(_premiumOn()) sep();   // 아래에 때리기 줄이 붙을 때만 — 안 그러면 선이 맨 아래에 남는다
  }
  /* 🪄 때리기 — 프리미엄이 아니면 **줄을 아예 안 넣는다**(파츠 licenseOnly 가 장착을 막는 방식과 같게).
     ★ 남은 횟수를 여기 적는 것이 한도 있는 기능의 최소 예의다 — 누르기 전에 보여야 한다. */
  if(_premiumOn() && !hiddenSeatsMod._seatHidden(seat)){   // 🙈 숨긴 캐릭터는 때릴 대상이 아니다(안 보이는 것을 때리게 되지 않게)
    const left = tricksMod._bonkLeft();
    mk('때리기 (' + left + '/' + tricksMod.BONK_DAILY_MAX + ')', ()=>tricksMod.bonkSeat(seat), left <= 0, tricksMod.BONK_CURSOR_IMG);
  }
  /* 🚩 신고하기 — 남의 좌석 · 모든 채널. 사유는 창에서 고른다(_openReportDialog). */
  if(seat.remote){ sep(); mk('🚩 신고하기…', ()=>reportMod.openDialog(seat)); }
  document.body.appendChild(backdrop);
  document.body.appendChild(menu);
  /* 뒷판을 누르면 닫는다. 우클릭도 마찬가지 — 메뉴가 떠 있는데 다른 곳을 우클릭했을 때
     아무 반응이 없으면 고장으로 읽힌다. */
  backdrop.addEventListener('mousedown', e=>{ e.preventDefault(); close(); });
  backdrop.addEventListener('contextmenu', e=>{ e.preventDefault(); close(); });
  /* 화면 밖으로 넘치면 안쪽으로 당긴다 — 프리셋 메뉴는 패널 안 버튼에서만 열리지만
     좌석 우클릭은 전체화면 캔버스 어디서나 열린다(오른쪽·아래 끝에서 잘린다). */
  try{
    const b = menu.getBoundingClientRect();
    if(b.right > innerWidth - 4) menu.style.left = Math.max(4, innerWidth - b.width - 4) + 'px';
    if(b.bottom > innerHeight - 4) menu.style.top = Math.max(4, innerHeight - b.height - 4) + 'px';
  }catch(_){}
  closer = e=>{ if(!menu.contains(e.target)) close(); };
  onEsc = e=>{ if(e.key === 'Escape'){ e.stopPropagation(); close(); } };
  // setTimeout(…,0) — 지금 이 이벤트에 바로 닫히지 않게(프리셋 메뉴와 같은 이유)
  setTimeout(()=>document.addEventListener('mousedown', closer, true), 0);
  document.addEventListener('keydown', onEsc, true);
}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  _uiHot(3000);   // 🔥 누르는 동안엔 비포커스 상한을 푼다(반응이 한 박자 늦게 그려지지 않게)
  if(tricksMod._flyAiming()){ tricksMod._flyAimClick(e); return; }   // 🎯 조준 중에는 드래그·쓰다듬 대신 표적 선택
  /* 🪄 때리기 조준도 같은 자리에서 가로챈다 — 여기보다 뒤에 두면 드래그(흔들기)가 먼저 잡고,
     때린 캐릭터가 마우스에 끌려간다. 말풍선 숨김(dismissSeatHeadBubble)도 pointerup 쪽이라 비켜 간다. */
  if(tricksMod._bonkAiming()){ tricksMod._bonkAimClick(e); return; }
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=hiddenSeatsMod._preferVisibleHit(hiddenSeatsMod._skipHiddenDesk(hiddenSeatsMod._hitsSkipHidden(ray.intersectObjects(seats.map(s=>s.group),true))));   // 🙈 숨긴 캐릭터는 잡히지 않는다(흔들기·쓰다듬기) · 보이는 것 먼저(#7)
  if(!hit.length) return;
  const seat=seatFromObject(hit[0].object); if(!seat) return;
  /* 🪑 날아가는 중인 캐릭터는 잡지 않는다 — 잡으면 흔들기(rig 를 직접 제어한다)와 비행이 매
     프레임 같은 좌표를 서로 덮어써서 캐릭터가 떨린다. 책상은 제자리에 있지만 슬롯 이동도
     같이 막는다(자리를 옮기면 돌아올 자리가 바뀐다). */
  if(seat.fly) return;
  const targetType = classifyHit(seat, hit[0].object);
  // shake용 평면 — 캐릭터(rig)의 world position 기준 (책상 고정, 캐릭터만 움직임)
  const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
  const rigWP = new THREE.Vector3(); seat.rig.getWorldPosition(rigWP);
  const grabPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, rigWP);
  const grabPt = new THREE.Vector3(); ray.ray.intersectPlane(grabPlane, grabPt);
  const grabOffset = grabPt.clone().sub(rigWP);
  /* 🐾 타고 있던 동물을 다시 드래그하면 내려옴(스펙) — 단 **내 캐릭터만**.
     남이 내 머리에 얹어둔 동물은 그 사람 것이라 내가 내릴 수 없다(요청 사양).
     내려도 그 사람이 방송하는 상태 때문에 다음 sync에 곧바로 다시 올라와 깜빡이기만 했다. */
  if(seat.ridingOn && !seat.remote) rideBenchMod.unmountRide(seat);
  /* 🩹 [2026-10-02 제보 #7] groupWP 는 **내린 뒤에** 잰다.
     [원인] 예전엔 내리기 전에 쟀다. unmountRide 가 group 을 제자리(머리 위 → 자기 자리)로 되돌리는데
       흔들기 계산(rig = 커서 − grabOffset − groupWP)은 옛 groupWP 를 계속 써서, 그 차이만큼 캐릭터가
       커서에서 옆으로 빠져 따라왔다. 그러면 놓는 자리 판정(findRideTarget)도 엉뚱한 곳을 본다.
     ★ grabPlane·grabOffset 은 내리기 **전** 값을 그대로 쓴다 — 잡은 지점(머리 위 그 자리)과 손잡이 위치가
       유지되어, 내린 캐릭터가 커서 바로 아래로 따라온다. */
  seat.group.updateMatrixWorld(true);
  const groupWP = new THREE.Vector3(); seat.group.getWorldPosition(groupWP);
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
    const n=seats.length; const _spacing = seats.some(s=>s.remote) ? MULTIPLAYER_SPACING : SPACING; let idx=Math.round(-wx/_spacing); idx=Math.max(0,Math.min(n-1,idx));
    if(window.TwSeatPin) idx = TwSeatPin.dragIndex(idx, drag.seat, seats, roomSeatMode);   // 🪑 맨 오른쪽 고정이면 내 자리는 그대로
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
    if(drag.dizzy > 30 && Math.random() < 0.08) floatersMod.spawnFloater('💫','#f5a94f', drag.seat);
  }
});
canvas.addEventListener('pointerup',e=>{
 /* 🚑 [고침] 이 본문 전체를 try/finally 로 감싼다 — **drag=null 이 무슨 일이 있어도 실행되게.**
    [무엇이 문제였나] `drag=null` 이 본문 **맨 끝**에 있는데, 그 앞에서 던질 수 있는 호출이 여럿이다
      (Presence.poke · triggerPet · findBenchSlot · mountBench · 애니메이션 재생).
      특히 `Presence.poke` 는 서버가 끊긴 동안 던진다 — CSP 사고 때가 정확히 그 상태였다.
    [무슨 일이 벌어지나] 한 번 던지면 `drag` 가 영원히 남고, 클릭 통과 판정 루프의
      `if(drag) return;` 이 **모든 mousemove 를 삼킨다.** 그 뒤로는 커서를 캐릭터·상태칩·채팅창
      어디에 올려도 판정이 안 돌아, 앱이 통째로 '유령'이 된다 — 껐다 켜기 전엔 안 돌아온다.
      창이 클릭을 못 받으니 포커스도 못 얻어 blur 안전망(clearDragStuck)까지 같이 막힌다.
    ⚠️ 중간의 조기 return 들도 finally 를 지나므로 그대로 동작한다(이미 drag=null 을 하고 있어 무해). */
 try{
  if(!drag)return;
  const seat = drag.seat;
  if(!drag.moved){
    if(drag.targetType && typeof drag.targetType==='object' && drag.targetType.type==='item'){
      playItemIdle(drag.targetType.pivot);   // 아이템 클릭 — idle 애니메이션 한 번 재생
    } else if(drag.targetType==='desk' && seat.desk && seat.desk.userData.deskIdleAction && seat.desk.userData.deskPlayMode==='click'){
      // 책상 클릭 — 클릭 재생 모드 책상은 여기서 한 번 재생
      const a = seat.desk.userData.deskIdleAction;
      const m = seat.desk.userData.deskMixer;
      a.reset(); a.play(); if(m) activeItemMixers.add(m);
    } else if(!seat.pinned){   // 액자 고정 캐릭터는 pet도 무시
      /* 🖱 클릭음 — **반응이 있는 클릭에만** 난다(액자 고정은 위 조건에서 이미 빠졌다).
         소리만 나고 캐릭터는 가만히 있으면 "눌렸는데 왜 반응이 없지"가 된다.
         ★ 여기는 '끌지 않고 눌렀다 뗀' 자리다(drag.moved 가 false). 흔들거나 옮기는 동안에는
           안 울린다 — 드래그마다 소리가 나면 시끄럽다.
         ★ 막지 않는다(쓰로틀 없음) — 연타하면 연타한 만큼 들리는 것이 요청이다. 풀이 5벌이라
           앞 소리를 끊지 않고 겹친다. */
      if(!window.__noClickSnd) sfxMod._clickSnd.play();   // 📏 A/B 확인용 — 콘솔에서 __noClickSnd=true 로 잠시 끈다
      triggerPet(seat); for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('♥','#f2607d',seat),i*320);
      overheadMod.dismissSeatHeadBubble(seat);   // 말풍선 떠 있으면 클릭으로 숨김
      if(seat.remote && seat.friendId && Presence.active()) Presence.poke(seat.friendId, 'pet');   // 남의 캐릭터 쓰다듬으면 그 사람에게 알림
      /* 💗 [2026-10-08 제보 #12] **내 캐릭터**를 쓰다듬은 것도 방에 알린다 — 예전엔 남의 캐릭터만 알려서
         내가 내 캐릭터(동물 포함)를 눌러도 상대 화면에는 하트가 안 떴다.
         ★ 0.5초 쓰로틀 — 연타하면 쓰기가 그만큼 늘어난다. 로컬 하트는 위에서 매번 그대로 뜬다.
         ★ 자리추가 좌석(isExtra)은 내 화면에만 있는 것이라 알리지 않는다.
         ★ 내 노드로 돌아오는 에코는 수신부(_myPetLocalAt)에서 건너뛴다 — 안 그러면 내 화면 하트가 두 번이다. */
      else if(seat.isMe && !seat.isExtra && Presence.active() && Presence.pokeSelf){
        const _t = performance.now();
        floatersMod.setMyPetLocalAt(_t);
        if(_t - floatersMod._myPetSentAt() >= floatersMod.MY_PET_SEND_GAP_MS){ floatersMod.setMyPetSentAt(_t); Presence.pokeSelf('pet'); }
      }
    }
  } else if(drag.mode==='shake'){
    seat.beingShaken = false;
    // 🪑 벤치 슬롯 근처에서 놓으면 앉기 — 캐릭터 종류(동물/사람) 무관.
    //   이미 앉아 있던 캐릭터를 다시 드래그해서 놓으면, 벤치 밖이면 일어나고 다른 슬롯이면 옮겨 앉음.
    {
      const bs = rideBenchMod.findBenchSlot(seat);
      if(bs){
        if(rideBenchMod.mountBench(seat, bs.host, bs.slot)){
          drag=null; canvas.releasePointerCapture&&canvas.releasePointerCapture(e.pointerId);
          return;
        }
      } else if(seat.seatedOn){
        rideBenchMod.unmountBench(seat);   // 벤치에서 멀리 떨어뜨려 놓음 → 일어남
      }
    }
    // 🐾 동물을 머리 근처에서 놓으면 흡착 — 이후 머리 본을 따라다님
    /* ★ 내 캐릭터만 얹을 수 있다(요청 사양) — seat.remote면 남의 캐릭터다.
       기능 제한이기도 하지만 애초에 동작하지도 않았다: 올라탄 상태는 `_myRidingOn()`으로
       **자기 좌석만** 방송하므로, 남의 동물을 내 화면에서 얹어도 그 사람 화면엔 안 보이고
       다음 sync에서 `_applyRemoteRides`가 want=null로 보고 곧바로 내려버린다(내 화면에서만 깜빡).
       ⚠️ 반대 방향(내 동물을 남의 머리에 얹기)은 그대로 둔다 — 움직이는 건 내 캐릭터이고,
          그건 `_myRidingOn`이 정상적으로 방송하는 기존 기능이다. */
    if(seat.charDef && seat.charDef.animal && !seat.remote){
      const host=iDeskMod.findRideTarget(seat);
      if(host && rideBenchMod.mountRide(seat, host)){
        drag=null; canvas.releasePointerCapture&&canvas.releasePointerCapture(e.pointerId);
        return;
      }
    }else if(seat.remote && seat.charDef && seat.charDef.animal && iDeskMod.findRideTarget(seat)){
      // 왜 안 되는지 알려준다 — 아무 반응 없이 제자리로 돌아가면 버그로 보인다. 연타 시 토스트가 쌓이지 않게 스로틀.
      const _now = performance.now();
      if(!iDeskMod._rideDenyToastAt() || _now - iDeskMod._rideDenyToastAt() > 1500){
        iDeskMod.setRideDenyToastAt(_now);
        toast('🐾 남의 캐릭터는 그 사람만 올릴 수 있어요');
      }
    }
    // 정신차리기 도리도리는 멈춘 뒤 300ms부터 시작 — 그 시점 이후에 손을 놓으면
    // "이미 정신차림"으로 보고 dizzy 좌석 모션을 건너뜀.
    // (참고: "고정"은 이제 드래그 중 우클릭으로 처리됨 — contextmenu 핸들러 참고)
    const stillMs = drag.lastMoveT ? (performance.now() - drag.lastMoveT) : 0;
    if(drag.dizzy >= SHAKE_DIZZY_TRIGGER && stillMs < 300){
      seat.dizzyUntil = performance.now() + 2500;
      for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f',seat),i*300);
      if(seat.remote && seat.friendId && Presence.active()) Presence.poke(seat.friendId, 'dizzy');   // 남의 캐릭터 흔들어 dizzy 만들면 그 사람에게 알림
    }
  }
  drag=null;
 }finally{
  /* ★ 위에서 무엇이 던지든 여기는 반드시 지난다. drag 가 남으면 앱이 유령이 된다(위 주석). */
  drag=null;
 }
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


/* 전역 마우스 NDC — 액자 고정 캐릭터의 머리가 마우스 따라가도록 */
let mouseNdcX = 0, mouseNdcY = 0;
window.addEventListener('mousemove', e=>{
  const r = canvas.getBoundingClientRect();
  mouseNdcX = ((e.clientX-r.left)/r.width)*2-1;
  mouseNdcY = -((e.clientY-r.top)/r.height)*2+1;
});

/* ============================================================ FLOATERS */
/* 본문은 floaters.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FLOATERS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const floatersMod = (typeof TwFloaters === 'undefined') ? FLOATERS_MOD_OFF : TwFloaters.createFloaters({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  focusCharScale: ()=>focusCharScale,
  scene: scene,
});

/* ============================================================ WARDROBE PARTS (꾸미기 파츠 부착)
   캐릭터 본(head/spine/handL/handR)에 GLB 파츠를 부착. 동시 1개/카테고리(양손 각각).
   파츠 GLB는 부착 위치에 맞춰 모델링된 전제(코드는 본에 그대로 add). */
// 루트에서 본(스켈레톤)을 찾아 seat류 객체(.bones)에 채워넣는 공용 헬퍼 — 꾸미기 파츠를 붙일 부착점을 찾는 데 필요함.
// setupSeatModel(런타임 좌석)뿐 아니라 런처/생성기 미리보기처럼 가벼운 컨텍스트에서도 재사용.
function extractBonesInto(target, root){
  target.bones={spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]};
  root.traverse(o=>{ if(o.isBone){ const n=o.name.toLowerCase();
    if(!target.bones.spine&&(n.includes('spine')||n.includes('chest')||n.includes('torso')))target.bones.spine=o;
    if(!target.bones.head&&n.includes('head'))target.bones.head=o;
    if(n.includes('hand')||n.includes('arm')){const s=boneSide(n);
      if(s==='l'&&!target.bones.handL)target.bones.handL=o; if(s==='r'&&!target.bones.handR)target.bones.handR=o;}
    if(n.includes('leg')||n.includes('thigh')){const s=boneSide(n);
      if(s==='l'&&!target.bones.legL)target.bones.legL=o; if(s==='r'&&!target.bones.legR)target.bones.legR=o;}
    if(n.includes('ear'))target.bones.ear.push(o);
  }});
  target.equippedPartObjs = target.equippedPartObjs || {};
}
/* 🐰 귀 파츠에서 '까닥일 대상'을 찾는다 ───────────────────────────────────────
   [증상] 귀 본이 들어 있는 귀 파츠 일부가 까닥이지 않고, 대신 파츠가 통째로 앞뒤로 크게 움직인다.
   [원인 1 — 이름 판정] 예전 판정은 `^ear[_-]?[lr]$` 라서 구분자를 '_'·'-' 만 받았다.
     블렌더의 좌우 대칭 접미사는 **'.L/.R' 이 표준**이라 `ear.L`·`Ear.R` 로 저작된 파츠는
     통째로 안 걸렸다. 안 걸리면 그 파츠는 부착 본(head)만 따라가므로, 화면에서는
     '까닥임 없이 머리 끄덕임을 따라 앞뒤로 움직이는' 것으로 보인다.
   [원인 2 — 같은 이름이 둘] 블렌더에서 오브젝트 이름까지 'ear_L' 이면 GLB 안에 같은 이름의
     **노드(메쉬/빈 오브젝트)와 본**이 같이 들어온다. 노드 쪽이 잡히면 회전 피봇이 파츠 원점이라
     귀가 제자리에서 까닥이는 대신 큰 호를 그리며 앞뒤로 흔들린다 — 제보의 그 증상이다.
   [대책] 구분자를 넓히고, 본이 하나라도 잡히면 **본만** 쓴다. 이미 잡힌 것의 자손도 뺀다
     (부모와 자식을 같이 돌리면 각도가 두 배로 먹는다).
   ⚠️ 'earring'(귀걸이) 처럼 ear 로 시작만 하는 이름은 잡으면 안 된다. 'ear' 뒤에 남는 것이
     좌우 표시와 번호뿐일 때만 참으로 본다. 'DEF-ear.L' 처럼 앞에 접두어가 붙는 리그도 있어서
     구분자로 끝나는 접두어 하나까지는 허용한다('spear' 는 구분자가 없으므로 안 걸린다). */
function _isEarObjName(n){
  return /^(?:[a-z0-9]+[._\- ])?ear(?:[._\- ]?(?:l|r|left|right))?(?:[._\- ]?\d+)*$/i
    .test(String(n||'').trim());
}
function _collectPartEarObjs(obj, cat){
  const hit = [];
  obj.traverse(o=>{ if(_isEarObjName(o.name)) hit.push(o); });
  const bones = hit.filter(o=>o.isBone);
  const pool  = bones.length ? bones : hit;   // 본이 아예 없는 리지드 귀 파츠는 노드라도 쓴다
  const out = pool.filter(o=>{
    for(let p=o.parent; p; p=p.parent) if(pool.indexOf(p)>=0) return false;
    return true;
  });
  /* 🩺 진단 — 이 판정은 실패해도 아무 에러가 안 난다(그냥 안 까닥일 뿐이라 원인을 못 찾는다).
     그래서 잡힌 것과 못 잡은 이유를 반드시 남긴다. */
  try{
    if(out.length){
      console.log('[파츠 귀] '+cat+' — 까닥일 대상 '+out.length+'개: '+out.map(o=>o.name).join(', ')
        + (hit.length !== out.length
            ? ' (같은 이름으로 '+hit.length+'개가 잡혀 '+(bones.length?'본':'최상위')+'만 씀)' : ''));
    }else{
      const all = []; obj.traverse(o=>{ if(o.isBone) all.push(o.name); });
      if(all.length) console.log('[파츠 귀] '+cat+' — 귀로 볼 이름의 본이 없음. 파츠 본: '+all.join(', ')
        + ' → ear_L / ear.R / Ear.L 처럼 지으면 까닥임에 등록됩니다.');
    }
  }catch(_){}
  return out;
}
async function equipPartOnSeat(seat, cat, rec, opts){
  if(!seat) return;
  seat.equippedPartObjs = seat.equippedPartObjs || {};
  // 🔗 stackable 모드: rec.stackable=true인 파츠는 seat.stackedPartObjs[cat][id]에 저장.
  //   기존 파츠(같은 카테고리의 다른 파츠들)를 지우지 않고 함께 유지.
  const stackable = !!(rec && rec.stackable);
  if(stackable){
    seat.stackedPartObjs = seat.stackedPartObjs || {};
    seat.stackedPartObjs[cat] = seat.stackedPartObjs[cat] || {};
  }
  /* ⚠️ 여기가 **조용한 실패 지점**이었다. 카테고리가 PART_CATS 에 없으면 아무 흔적도 없이
     돌아간다 — 화면에는 "파츠를 눌렀는데 아무 일도 안 일어난다"로만 보인다.
     PART_CATS = BUILTIN + customPartCats(Firebase 구독)라, 커스텀 카테고리는 구독이 아직
     안 왔거나 실패하면 여기서 걸린다. 아래 '부착할 자리 없음' 경고와 같은 급의 사건이므로
     같이 남긴다(세션당 카테고리별 1회 — 매 프레임 도배되지 않게). */
  const info = premiumMod.partCatInfo(cat);
  if(!info){
    _equipWarnOnce('cat:'+cat, '[파츠] 카테고리 정보를 못 찾아 장착을 건너뜁니다: '+cat
      + ' — PART_CATS 에 없습니다(커스텀 카테고리 구독 미도착/실패일 수 있음). 파츠 id: '+(rec&&rec.id));
    return;
  }
  // ★ Phase 5: 옷 카테고리 충돌 정리 — 새로 착용할 파츠의 rec.hides와 겹치는 부위를 요구하는 기존 파츠는 해제.
  //   예) 원피스(hides:['top','bottom']) 착용 → 티셔츠(hides:['top'])는 상의 겹침 → 티셔츠 해제.
  //   예) 겉옷(hides:[]) 착용 → 아무것도 안 겹치므로 상의 유지.
  //   ★ getRecHides로 sentinel/Firebase 객체 정규화 (null 반환 시엔 옛 파츠 → 관례 fallback)
  if(rec && info.group==='cloth'){
    const explicit = premiumMod.getRecHides(rec);
    const newHides = (explicit !== null) ? explicit
      : (cat==='onepiece' ? ['top','bottom','onepiece']
        : cat==='cape' ? []
        : [cat]);   // 하위호환
    ['top','bottom','onepiece','cape'].forEach(other=>{
      if(other===cat) return;
      const entry = premiumMod.firstEntryForCat(seat.charDef, other);
      if(!entry) return;
      const otherId = premiumMod.partEntryId(entry);
      const otherRec = premiumMod.savedParts().find(p=>p.id===otherId);
      const otherExplicit = premiumMod.getRecHides(otherRec);
      const otherHides = (otherExplicit !== null) ? otherExplicit
        : (other==='onepiece' ? ['top','bottom','onepiece']
          : other==='cape' ? []
          : [other]);
      // 두 파츠가 hide하는 부위 중 겹치는 게 하나라도 있으면 충돌 → 기존 파츠 해제
      const overlap = newHides.some(h=>otherHides.includes(h));
      if(overlap) _unequipClothCat(seat, other);
    });
  }
  // 기존 같은 카테고리 파츠 제거 — stackable 모드에서는 이 파츠 id만 해제.
  //   non-stackable 모드에서는 기존 non-stackable만 교체하고, stackable 파츠들(공존 중)은 유지.
  if(stackable){
    unequipStackablePart(seat, cat, rec.id);
    // ★ 같은 파츠가 예전에 non-stackable로 붙어 있었으면 함께 제거 —
    //   rec.stackable이 카탈로그 동기화로 뒤바뀌면 두 경로에 동시에 존재하게 되고, 그게 유령의 원인.
    const _prevMain = seat.equippedPartObjs && seat.equippedPartObjs[cat];
    if(_prevMain && _prevMain.userData && _prevMain.userData.partId === rec.id){
      _disposeWrapperFromSeat(seat, _prevMain);
      delete seat.equippedPartObjs[cat];
    }
  } else {
    unequipPartFromSeat(seat, cat, false);   // false = stackable 파츠들 유지
    // ★ 반대 경우 — 같은 파츠가 stackable로 붙어 있었으면 제거
    if(rec && seat.stackedPartObjs && seat.stackedPartObjs[cat] && seat.stackedPartObjs[cat][rec.id]){
      unequipStackablePart(seat, cat, rec.id);
    }
  }
  if(!rec){ applyClothVisibility(seat); return; }   // rec 없으면 해제만 + 기본 메시 가시성 갱신
  const bone = premiumMod.partAttachTarget(seat, info);
  if(!bone){ console.warn('부착할 자리 없음:', info.bone,
    premiumMod.isDeskPartCat(info) ? '(책상 카테고리인데 이 좌석에 deskAnchor 가 없음)' : ''); return; }
  // ★ 이중 장착 레이스 가드 — 캐릭터 로드 시 applyEquippedPartsToSeat가 두 경로(초기 로드 + 카탈로그
  //   구독 재시도)에서 거의 동시에 호출될 수 있음. GLB 파싱이 비동기라 늦게 끝난 쪽이 equippedPartObjs를
  //   덮어쓰고 먼저 끝난 쪽 wrapper는 씬에 유령으로 남는 문제(같은 파츠 두 개 + 해제해도 하나 남음).
  //   시퀀스 토큰으로 "이 카테고리(+stackable이면 id)에 대해 가장 마지막에 시작된 장착"만 부착 완료하게 함.
  seat._equipSeq = seat._equipSeq || {};
  const seqKey = stackable ? (cat + ':' + rec.id) : cat;
  const mySeq = (seat._equipSeq[seqKey] = (seat._equipSeq[seqKey] || 0) + 1);
  try{
    const {scene, animations} = await getPartScene(rec);
    // ★ 파싱 대기 중에 같은 카테고리에 새 장착이 시작됐다면 이건 낡은 호출 — 부착하지 않고 중단.
    if(seat._equipSeq[seqKey] !== mySeq) return;
    const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(scene) : scene.clone(true);
    const colorGroups = {};   // ★ "_col" 뒤에 붙은 번호별로 그룹 — _col/_col1은 "col1", _col2는 "col2" 로 묶여서 각각 독립적으로 색상 변경 가능
    const picMeshes = [];     // 🖍️ "_pic" 메쉬 — 유저가 직접 그리는 면(그림칸은 파츠당 하나, 층은 _picSetup 이 만든다)
    obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false;
      const m = o.material&&o.material.clone? o.material.clone() : o.material; o.material=m;
      if(m){ _applyPartMatTone(m);   // 💡 톤은 한 함수에서만 정한다(썸네일도 같은 함수를 쓴다)
        // ★ 투명 재질(블렌더에서 alpha 낮춰서 내보낸 파츠)은 씬에 추가되는 "순서"에 따라 그려지는 순서가
        //   달라질 수 있는데, 캐릭터 자동 복원(앱 재시작 등) 시에는 다른 요소들보다 먼저/늦게 추가되면서
        //   순서가 꼬여 투명도가 제대로 안 보이는 경우가 있었음(꺼짐→켬으로 다시 추가하면 정상화되던 원인).
        //   투명 메쉬에 renderOrder를 명시적으로 부여해서, 추가되는 시점/순서와 무관하게 항상 일관되게 그려지게 함.
        if(m.transparent){ o.renderOrder = 10; _forceOpaqueAlphaOutput(m); }
      }
      /* 🖍️ "_pic" 표시 = 유저가 직접 그릴 수 있는 면. 인식 규칙은 _col 과 같다.
         ⚠️ _pic 은 **_col 대상에서 뺀다** — 한 메쉬에 둘을 걸면 색(곱셈)이 그림 위에 겹쳐서
           고른 색과 찍히는 색이 어긋난다. 그리는 면은 그림이 색을 정한다. */
      if(partPaintMod.meshIsPic(o)){
        /* 🧭 진짜 UV 가 두 번째 칸에 있는 파츠를 구제한다(위 _picRepairUV 주석 참고).
           조용히 넘어가면 "그렸는데 파츠 전체가 옅게 물든다"로만 보여서 원인을 찾을 수가 없다. */
        if(partPaintMod._picRepairUV(o)) _equipWarnOnce('uv2:'+cat+':'+(rec&&rec.id),
          '[파츠] UV 가 두 번째 칸에 있어 첫 칸으로 옮겼습니다 — cat=' + cat + ' mesh=' + (o.name||'이름없음')
          + ' / 블렌더에서 비어 있는 첫 UV 맵을 지우고 다시 내보내는 것이 정식 수정입니다.');
        picMeshes.push(o);
        return;
      }
      /* 그림칸이 아니어도 같은 저작 실수는 텍스처를 텍셀 하나로 뭉갠다. 여기서는 **고치지 않고**
         알리기만 한다 — 이미 배포된 파츠의 겉모습을 말없이 바꾸지 않기 위해서다. */
      if(m && m.map && partPaintMod.g_uvLooksBroken(o)) _equipWarnOnce('uv2warn:'+cat+':'+(rec&&rec.id),
        '[파츠] 텍스처가 있는데 첫 UV 칸이 비었습니다 — cat=' + cat + ' mesh=' + (o.name||'이름없음')
        + ' / 파츠가 단색으로 보인다면 이게 원인입니다(블렌더 UV 맵 순서).');
      // ★ "_col" 표시는 메쉬(오브젝트) 이름, 머터리얼 이름 둘 중 어디에 붙어있어도 인식 — 메쉬 이름 먼저 확인하고, 없으면 머터리얼 이름도 확인.
      const colMatch = o.name.match(/_col(\d*)/i) || (m && m.name && m.name.match(/_col(\d*)/i));
      if(colMatch){
        const key = 'col'+(colMatch[1]||'1');   // "_col"(번호 없음)은 "_col1"과 같은 그룹으로 취급
        if(m && m.color) o.userData.origColor = m.color.getHexString();
        (colorGroups[key] = colorGroups[key]||[]).push(o);
      }
    }});
    obj.name = '__part_'+cat;
    // ★ 파츠 GLB 안에 이름이 "ear_L"/"earL"/"ear_R"/"earR"인 오브젝트가 있으면, 캐릭터 본연의 귀와
    //   똑같이 기존 "귀 까닥임" 애니메이션 시스템(seat.bones.ear / frame()의 EAR_FLICK 로직)에 등록해서
    //   같이 움직이게 함. 해제 시(unequipPartFromSeat)에는 다시 이 배열에서 빼줘야 함.
    // ★ 파츠 리깅 랜덤 위치 뒤틀림 버그 수정:
    //   비리깅 파츠가 먼저 착용되어 있고, 그 파츠 안에 ear_L/ear_R 같은 이름의 Bone이 있으면,
    //   이후 리깅 파츠 착용 시 line 4812의 charBones traverse가 그 본을 캐릭터 본으로 오인해서 수집 →
    //   리깅 파츠의 SkinnedMesh가 비리깅 파츠의 본에 rebind됨 →
    //   비리깅 파츠 제거 시 리깅 파츠 위치가 뒤틀림.
    //   대책: 이 파츠 안의 모든 Bone에 _partAdopted 플래그를 미리 찍어 후속 charBones 수집에서 확실히 제외.
    //   (기존엔 리깅 파츠가 입양시킨 본만 표시했음)
    obj.traverse(o=>{ if(o.isBone){ o.userData = o.userData||{}; o.userData._partAdopted = true; } });
    /* ★ 여기서 모으는 것은 **이 파츠 자신의** 귀 본이다(캐릭터 본이 아니다).
       ⚠️ 예전에는 standalone(🧷 단독 부착) 파츠를 통째로 건너뛰었는데, 그건 과잉 방어였다.
         🧷 의 약속은 "캐릭터의 같은 이름 본에 **자동 연결**하지 않는다"이고, 그 약속을 지키는 것은
         아래 리깅 판정(standalone → isRigged 강제 false)과 _partAdopted 표식이다.
         파츠 자신의 본을 까닥임 목록에 넣는 것은 캐릭터 본과 아무 상관이 없는데도 같이 막혀 있어서,
         귀 파츠에 🧷 를 켜면(=커미션 캐릭터의 귀에 딸려가지 말라고 켜는 바로 그 경우) 귀가
         영영 안 까닥이는 상태가 됐다. 그래서 standalone 여부와 무관하게 모은다. */
    const partEarObjs = _collectPartEarObjs(obj, cat);
    // ★ seat.boneRest.ear가 아직 없는(캐릭터 로딩 초기 등) 시점에 파츠가 먼저 부착되면 여기서 에러가
    //   나서 이 파츠뿐 아니라 이후 파츠 부착 전체가 조용히 실패하던 심각한 버그가 있었음 — 방어 추가.
    if(!seat.boneRest) seat.boneRest={};
    if(!seat.boneRest.ear) seat.boneRest.ear=[];
    // ※ 실제 ear 등록은 아래 "리깅 판정" 이후에 함 — 리깅(옷) 파츠는 캐릭터 스켈레톤이 움직임을
    //   담당하므로 귀 까닥임 시스템에 등록하면 안 되기 때문(옷 파츠 ≠ 귀 파츠, 기능 분리).
    // ★ 어플 6: 리깅(스키닝) 파츠 감지 — 파츠 GLB가 캐릭터와 같은 본 이름으로 스키닝돼 있으면
    //   (예: 기본 캐릭터 아마추어로 제작한 망토/옷) 리지드 부착 대신 캐릭터의 실제 본에 리바인드해서
    //   캐릭터 애니메이션(타이핑/절차 모션)을 그대로 따라 움직이게 함.
    const charBones = {};   // 캐릭터 본 이름 → Bone (파츠 추가 전에 수집해야 파츠 자신의 본과 안 섞임)
    // ★ 캐릭터 모델 루트는 컨텍스트마다 이름이 다름 — 실행 좌석(gltfRoot), 런처/생성기/꾸미기 미리보기(root),
    //   그 외(bodyWrap/group). 순서대로 찾아서 어느 화면에서든 본 수집이 되게 함(런처 미리보기 리깅 누락 버그 수정).
    const charRoot = seat.gltfRoot || seat.root || seat.bodyWrap || seat.group || null;
    /* 🎩 저작 오프셋 계산 전용 기준 노드 — charRoot와 구분해야 한다.
       ・charRoot : wrapper를 실제로 매다는 부모(리깅 파츠)·본 수집 범위. 실행 좌석에선 fitModel이
                    scale을 얹는 보호 wrap.
       ・modelRoot: 본과 메쉬가 들어 있는 노드. 그 로컬 단위가 파츠 GLB가 저작된 '리그 원본 단위'다.
       인간·커미션은 wrap 안의 root가 scale 1이라 두 노드의 로컬 좌표계가 같아서 결과가 동일하다.
       동물만 다르다 — buildAnimalBase가 root에 normalizeModel(배율 0.1765)을 걸어두기 때문에,
       charRoot로 재면 본 위치가 5.7배 작게 나와 판정과 환산이 통째로 어긋난다. */
    const modelRoot = seat.modelRoot || seat.root || charRoot;
    // ★ 다른 파츠가 입양시킨 본(_partAdopted)은 캐릭터 고유 본이 아니므로 제외 — 안 그러면 나중에 장착한
    //   파츠(예: 동물귀)가 먼저 장착된 옷(cape)의 ear 본에 리바인드돼서 옷의 본을 따라가는 버그가 생김.
    const _collectCharBones = ()=>{
      for(const k in charBones) delete charBones[k];
      if(charRoot) charRoot.traverse(o=>{ if(o.isBone && !(o.userData&&o.userData._partAdopted) && !charBones[o.name]) charBones[o.name]=o; });
    };
    _collectCharBones();
    // ★ 원격 좌석 초기화 레이스 방어 —
    //   상대 화면은 "캐릭터 GLB 로드 → 파츠 장착"이 연달아 일어나서, 스켈레톤이 완성되기 전에
    //   리깅 파츠가 먼저 도착하면 charBones가 비어 리깅 판정이 실패 → 비리깅 경로로 부착돼
    //   좌표 체계가 달라짐(= 상대 화면에서만 귀 파츠가 어긋나는 증상).
    //   캐릭터가 스킨드 메시를 쓰는데(=본이 있어야 정상) 본이 아직 안 보이면 잠시 기다렸다 재수집.
    {
      let _hasSkinnedChar = false;
      if(charRoot) charRoot.traverse(o=>{ if(o.isSkinnedMesh && !String(o.name||'').startsWith('__part')) _hasSkinnedChar = true; });
      let _waited = 0;
      while(_hasSkinnedChar && Object.keys(charBones).length < 2 && _waited < 3000){
        await new Promise(r=>setTimeout(r, 150)); _waited += 150;
        if(seat._equipSeq[seqKey] !== mySeq) return;   // 그 사이 새 장착이 시작됐으면 중단
        _collectCharBones();
      }
    }
    const skinnedMeshes = [];
    obj.traverse(o=>{ if(o.isSkinnedMesh) skinnedMeshes.push(o); });
    // "리깅 파츠" 판정: SkinnedMesh가 있고 조인트의 **과반수 이상**이 캐릭터 본과 이름 일치.
    //  → 실수로 armature와 함께 export된 리지드 파츠(1~2개만 우연히 이름 겹치는 경우)를 리깅으로
    //    오탐지해서 기즈모가 사라지는 버그를 방지(요청사항 B).
    // ★ standalone 파츠는 리깅 판정 강제 false — 파츠 본이 캐릭터 본에 매핑되지 않도록 해서
    //   비리깅 방식(info.bone에 wrapper 단위로 부착)으로 처리됨(버그2). 커미션 캐릭터의 기존 ear 등에
    //   파츠가 딸려가지 않고, 관리자가 지정한 카테고리 본(head 등) 기준으로 자유롭게 위치 조정 가능.
    // ★ 이름이 같아도 리그가 같다는 보장은 없다. 특히 동물 캐릭터는 사람과 rest pose·비율이 전혀 달라서,
    //   'head' 하나가 우연히 일치한 사람용 모자를 리바인드하면 파츠의 boneInverses와 동물 본의 월드 행렬이
    //   맞지 않아 메쉬가 길게 늘어난다(→ 그 늘어난 박스를 실측하는 상태칩까지 위로 날아감).
    //   본이 1~2개뿐인 파츠를 리깅으로 인정하는 완화 규칙은 같은 리그 계열(비동물)에만 적용한다.
    const _rigFamilyMatches = !(seat.charDef && seat.charDef.animal);
    /* 🪑 책상 파츠는 리깅 판정을 아예 안 탄다. 리깅으로 잡히면 캐릭터 스켈레톤에 리바인드되어
       charRoot 에 붙는데, 그러면 '캐릭터를 안 따라온다'는 이 카테고리의 존재 이유가 사라진다.
       (등록창의 🧷 단독 부착을 강제로 켠 것과 같은 상태다) */
    const _deskPart = premiumMod.isDeskPartCat(info);
    const isRigged = !_deskPart && !rec.standalone && skinnedMeshes.length>0 && skinnedMeshes.some(sm=>{
      if(!sm.skeleton) return false;
      const total = sm.skeleton.bones.length;
      const matched = sm.skeleton.bones.filter(b=> !!charBones[b.name]).length;
      if(total===0) return false;
      // ★ 버그 수정(head bone 하나짜리 모자가 머리 아래로 내려가던 문제):
      //   본이 1~2개뿐인 파츠(예: head 하나에만 스키닝한 모자)는 total=1, matched=1인데
      //   아래 max(2, ...) 문턱을 못 넘어 리지드 파츠로 떨어졌다. 리지드 경로는 Box3(바인드포즈 기준)로
      //   중심을 잡아 head 본에 붙이는데, 스킨드 메시의 실제 렌더 위치는 본이 결정하므로 위치가 어긋난다.
      //   "본이 전부 캐릭터와 일치"하면 개수와 무관하게 리깅으로 인정한다 — 단 같은 리그 계열일 때만.
      if(matched === total && _rigFamilyMatches) return true;
      return matched >= Math.max(2, Math.ceil(total/2));
    });
    const adoptedBones = [];   // 캐릭터에 없어서 캐릭터 본 밑으로 입양시킨 파츠 본들(해제 시 제거용)
    // ── 🐰 귀 파츠 기능과 분리 ──
    //   리깅(옷) 파츠: 캐릭터 스켈레톤에 리바인드되므로 캐릭터의 진짜 귀 본이 움직임을 담당한다.
    //     파츠 안의 ear_L/ear_R 본을 귀 까닥임 목록에 넣으면 안 됨(리바인드 후 쓰이지도 않는 본이라
    //     목록만 오염되고, 옷 파츠가 귀 파츠 동작에 얽히게 됨).
    //   비리깅(귀 등 부착형) 파츠: 기존대로 ear_L/ear_R를 귀 애니메이션 시스템에 등록해 같이 까닥임.
    if(isRigged || _deskPart){
      // 리깅 파츠는 캐릭터 본이 움직임을 담당하고, 책상 파츠는 애초에 캐릭터와 무관하다 —
      // 둘 다 귀 까닥임 목록에 넣으면 안 된다(책상 위 물건이 귀처럼 까닥인다).
      partEarObjs.length = 0;
    }else if(partEarObjs.length && seat.bones && seat.bones.ear){
      partEarObjs.forEach(o=>{ seat.bones.ear.push(o); seat.boneRest.ear.push(o.quaternion.clone()); });
      /* 타이머는 개수로만 재생성 여부를 판단한다(animateRig). 귀 2개짜리 파츠를 다른 귀 2개짜리로
         갈아끼우면 개수가 그대로라 옛 타이머가 남고, 새 파츠가 남의 까닥임 도중 자세로 시작한다.
         등록이 바뀌었으면 그냥 새로 만들게 한다(_registerAnimalEarOn 과 같은 처리). */
      seat.earTimers = null;
    }
    // 🩺 리깅 판정 진단 — 본이 들어있는데 리깅으로 인식되지 않으면 이유를 남김(스키닝 누락/이름 불일치 구분용)
    if(!isRigged && !rec.standalone && !_deskPart){
      let _boneCount = 0; obj.traverse(o=>{ if(o.isBone) _boneCount++; });
      if(_boneCount > 0){
        const _detail = skinnedMeshes.map(sm=>{
          const t = sm.skeleton ? sm.skeleton.bones.length : 0;
          const m = sm.skeleton ? sm.skeleton.bones.filter(b=>!!charBones[b.name]).length : 0;
          return sm.name+'('+m+'/'+t+' 일치)';
        }).join(', ');
        console.log('[파츠 리깅] '+cat+' — 본 '+_boneCount+'개가 있지만 리깅 파츠로 인식되지 않음. '
          +'스킨드메시 '+skinnedMeshes.length+'개'+(_detail?(' ['+_detail+']'):'')
          +' / 캐릭터 본 '+Object.keys(charBones).length+'개.'
          +(skinnedMeshes.length===0 ? ' → 메쉬에 아마추어 스키닝(Armature Deform)이 안 걸려 있을 가능성이 큽니다.' : ' → 본 이름이 캐릭터와 달라 과반수 일치에 실패했을 가능성이 큽니다.'));
      }
    }
    if(isRigged){
      const bindCenter = new THREE.Vector3(); let bcCount=0;   // 리그(바인드) 공간에서의 스킨 중심 — xf 피봇용
      skinnedMeshes.forEach(sm=>{
        sm.userData._origBind = sm.bindMatrix.clone();   // ★ xf를 bindMatrix에 굽기 위해 원본 바인드 보존
        if(sm.geometry){
          sm.geometry.computeBoundingBox();
          const c0 = sm.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(sm.userData._origBind);
          bindCenter.add(c0); bcCount++;
        }
        const src = sm.skeleton;
        const mapped = src.bones.map(b=>{
          if(charBones[b.name]) return charBones[b.name];
          // 캐릭터에 없는 본(예: 기본 캐릭터에 없는 ear_L) — 부모 이름이 캐릭터에 있으면 그 밑으로 입양,
          // 그럼 부모 본을 따라 움직임(귀 본은 head 밑으로 들어가 머리를 따라감).
          let host = null, p = b.parent;
          while(p){ if(p.isBone && charBones[p.name]){ host = charBones[p.name]; break; } p = p.parent; }
          (host || charBones['spine'] || Object.values(charBones)[0])?.add(b);
          b.userData._partAdopted = true;   // ★ 다른 파츠의 본 수집에서 제외 표식 — 파츠끼리 본이 섞이는 것 방지
          adoptedBones.push(b);
          return b;
        });
        sm.bind(new THREE.Skeleton(mapped, src.boneInverses.map(m4=>m4.clone())), sm.bindMatrix);
        sm.frustumCulled = false;
      });
      if(bcCount) bindCenter.multiplyScalar(1/bcCount);
      // wrapper에 기록 — applyPartXf가 이 피봇 기준으로 bindMatrix 오프셋을 합성
      // (wrapper.userData는 아래 wrapper 생성 후 세팅되므로 임시 보관)
      obj.userData._rigBindCenter = bindCenter;
      obj.userData._rigSkinnedMeshes = skinnedMeshes;
      console.log('[파츠 리깅] '+cat+' — 스킨드메시 '+skinnedMeshes.length+'개를 캐릭터 본에 리바인드'+(adoptedBones.length?(', 입양 본 '+adoptedBones.map(b=>b.name).join('/')):''));
      // 🩺 리깅으로 붙었는데도 파츠가 뜨는 경우의 원인 확정용 — 아래 함수 주석 참고.
      _diagRiggedPartAlignment(cat, skinnedMeshes, charRoot);
    }
    // 메시 중심을 피봇으로 만들기 위해 wrapper 그룹에 감싸기 (회전·스케일이 중심 기준)
    //  — 리깅 파츠는 본이 위치를 결정하므로 재중심화하지 않고 원본 좌표 그대로 둠
    const bb = new THREE.Box3().setFromObject(obj);
    const center = isRigged ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3());
    if(!isRigged) obj.position.sub(center);
    const wrapper = new THREE.Group(); wrapper.name='__partWrap_'+cat;
    wrapper.add(obj);
    wrapper.userData.baseCenter = center.clone();   // applyPartXf에서 사용
    /* 🎩 저작 오프셋 — "캐릭터에 씌운 채 저작된 파츠"가 머리 위로 공중부양하던 문제(핸드오프 3장 0번)
       보정량. 원점 기준 저작 파츠·리깅 파츠는 null 이라 기존 동작 그대로다.
       판정 근거는 콘솔 [파츠 저작오프셋] 참고. **캐릭터 본에 붙는 파츠 전용**이다.
       🪑 책상 카테고리(bone:'desk')는 제외한다.
       [경위] 이 보정은 부착 대상이 '캐릭터 리그 안의 본'이고 파츠 중심과 본이 같은 리그 단위라는 것을
         전제로 계산한다. 그런데 책상 파츠의 부착 대상은 seat.deskAnchor 로, 책상 그룹 아래에 있어
         월드 배율이 0.175(동물은 ×0.4 로 0.07)다. 그 상태로 아래 폴백 경로를 타면
             want = modelRoot.localToWorld(center); bone.worldToLocal(want);
         에서 deskAnchor 의 작은 배율로 나누느라 want 가 5.7~14배로 튀고, off = center - want 가
         엉뚱하게 커진다. 그 값을 wrapper.position 에서 빼기 때문에 파츠가 책상을 떠나
         캐릭터 얼굴 높이 같은 곳에 나타난다(제보: 보관함에서 위치를 잡아도 꾸미기 미리보기에서 얼굴 가운데).
       ★ 책상 파츠는 애초에 '캐릭터에 씌운 채 저작' 이라는 사고가 성립하지 않는다 —
         평평한 앵커 위에 놓는 것이라 상쇄할 것이 없다. 판정을 시도하지 말고 통째로 건너뛴다.
       ⚠️ 이 수정 전에 책상 파츠 위치를 기즈모로 맞춰뒀다면, 그 xf.pos 는 엉뚱한 보정을 되밀던
         값이라 한 번 다시 잡아줘야 한다(_isLegacyAuthorCompensation 은 본 파츠 기준이라 여기선 안 돈다). */
    wrapper.userData.authorOff = (isRigged || premiumMod.isDeskPartCat(info)) ? null
      : _computePartAuthorOffset(bb, center, bone, modelRoot, cat, charBones);
    // 🐾 동물 머리 파츠 세로 보정 — 사람 리그 기준으로 앉은 파츠를 이 캐릭터의 머리 꼭대기에 맞춘다.
    wrapper.userData.animalHeadDy = _computeAnimalHeadDy(seat, info, cat, bone, modelRoot, isRigged, wrapper.userData.authorOff);
    // 🩺 머리 계열 파츠는 캐릭터별 머리 크기·높이가 제각각이라 여기서 실측을 남긴다.
    if(info.group === 'head') _diagPartHeadSpace(cat, modelRoot, bone, bb, center, seat, isRigged);
    wrapper.userData.cat = cat;
    wrapper.userData.partId = rec.id;   // ★ applyPartXf가 카테고리가 아니라 '이 파츠'의 entry를 되찾기 위한 표식
    wrapper.userData.__twPartWrap = true;   // ★ 유령 청소 대상 표식 — 이름만 보고 지우면 동물 귀 등 다른 부속까지 지울 위험
    wrapper.userData.rigged = isRigged;             // ★ 리깅 파츠 표시 — xf는 bindMatrix로 적용됨
    if(isRigged){
      wrapper.userData.rigBindCenter = obj.userData._rigBindCenter || new THREE.Vector3();
      wrapper.userData.rigSkinnedMeshes = obj.userData._rigSkinnedMeshes || [];
    }
    wrapper.userData.adoptedBones = adoptedBones;   // 해제 시 캐릭터 본에서 다시 떼어내기 위해 기억
    wrapper.userData.colorGroups = colorGroups;   // 색상 변경 대상 그룹 { col1:[mesh,...], col2:[...] }
    wrapper.userData.picMeshes  = picMeshes;      // 🖍️ 그릴 수 있는 면(비어 있으면 연필 버튼이 안 뜬다)
    // 🎨 진단 로그 — "색상/색조 행이 안 보인다"를 자가 진단할 수 있게, 감지된 _col 그룹과 모드를 남긴다.
    //   그룹이 0개면 메쉬·머터리얼 이름에 _col이 없다는 뜻(대소문자 무관, _col2 같은 번호도 가능).
    try{
      const _gk = Object.keys(colorGroups);
      if(!_gk.length){
        const _names = [];
        obj.traverse(o=>{ if(o.isMesh) _names.push(o.name + (o.material&&o.material.name ? ('/'+o.material.name) : '') + (o.material&&o.material.map?' [텍스처]':'')); });
        console.log('[파츠 색상] '+cat+' — _col 그룹 없음. 메쉬/머터리얼 이름:', _names.join(', ') || '(메쉬 없음)');
      } else {
        console.log('[파츠 색상] '+cat+' — 감지된 그룹: ' + _gk.map(k=>{
          const hue = colorGroups[k].some(m=>m.material && m.material.map);
          return k+'('+(hue?'색조·텍스처 있음':'색상·단색')+', 메쉬 '+colorGroups[k].length+'개)';
        }).join(', '));
      }
    }catch(_){}
    wrapper.userData.partEarObjs = partEarObjs;   // 해제 시 seat.bones.ear에서 제거하기 위해 기억
    // ★ 관리자가 등록 시 "발광 효과"를 켜뒀으면(rec.glow) 파츠 옆에 은은한 원형 빛 스프라이트를 추가함.
    // ★ 발광 효과 비활성화(요청사항) — 파츠도 동일하게 발광 적용 안 함.
    // if(rec.glow) wrapper.userData.glowSprite = applyGlowEffect(obj);
    // 클립 이름에 "idle"이 포함된 게 있으면 반복 재생
    //  — 단, 리깅 파츠는 캐릭터 본이 움직임을 담당하므로 파츠 자체 애니메이션은 재생하지 않음(리그 충돌 방지)
    //  ▶ rec.animMode:
    //     ''(기본)   = 장착하자마자 계속 반복재생 (기존 동작 그대로)
    //     'active'   = 마우스·타이핑이 감지될 때(seatState==='focus')만 재생, 자리비움·어지러움 등에선 일시정지.
    //                  책상 위 아이템의 playMode='idle'과 같은 동작이며, updateActivePartPlayback()이 매 프레임 전환한다.
    /* 🎬 [진단] "애니메이션 파츠를 만들었는데 안 움직인다"를 스스로 확인할 수 있게 로그를 남긴다.
       조용히 안 되는 경우가 셋이라 눈으로는 구분이 안 됐다:
         ① GLB 안에 클립이 0개 (블렌더에서 액션을 NLA로 밀거나 Fake User 를 안 걸면 export 에서 빠진다)
         ② 리깅 파츠 — 캐릭터 본이 움직임을 담당하므로 파츠 자체 애니메이션은 **일부러** 안 튼다(리그 충돌 방지)
         ③ 클립 이름에 'idle' 이 없음
       ③ 은 이제 첫 클립으로 넘어가게 고쳤다(아래) — 아이템·책상 GLB 는 원래 그렇게 동작했는데
          파츠만 fallback 이 없어서, 같은 GLB 를 아이템으로 넣으면 움직이고 파츠로 넣으면 안 움직였다. */
    if(!isRigged && animations && animations.length){
      const idleClip = _stripPartClipOwnedTracks(_pickPartClip(animations), obj, partEarObjs);
      if(idleClip && idleClip.tracks && idleClip.tracks.length){
        /* 🎬 고른 클립이 정지 포즈면 화면은 '안 움직임'이 된다 — 클립 0개와 증상이 똑같아서
           반드시 구분해 줘야 한다(안 그러면 블렌더 export 옵션만 계속 뒤지게 된다).
           ⚠️ 위에서 트랙을 걷어내서 안 움직이게 된 경우는 여기 해당 없음 — 그건 의도한 결과라
             바로 앞줄에 이유가 이미 찍혔다. 여기서 또 경고하면 원인을 엉뚱한 데서 찾게 된다. */
        if(!_clipHasMotion(idleClip) && !idleClip._twStrippedTracks){
          console.log('[파츠 애니] '+(rec.name||rec.id)+' — 클립은 있는데 값이 전부 같습니다(정지 포즈).'
            + ' 고른 클립: "' + idleClip.name + '" / 전체: ' + animations.map(c=>c.name).join(', '));
          _partAnimNotice(rec, '⚠️ 클립은 ' + animations.length + '개 있는데 전부 정지 포즈예요 —'
            + ' 블렌더에서 그 액션에 실제 키프레임이 들어갔는지 확인해 주세요');
        }
        if(!/idle/i.test(idleClip.name)){
          console.log('[파츠 애니] '+(rec.name||rec.id)+' — 이름에 "idle"이 든 클립이 없어 첫 클립 "'
            + idleClip.name + '"을 재생합니다. 클립: ' + animations.map(c=>c.name).join(', '));
        }
        _partAnimNotice(rec, '▶ 애니메이션 재생 — 클립 "' + idleClip.name + '"'
          + (rec.animMode==='active' ? ' (활동 중에만)' : ''));
        _setupPartIdleAnim(wrapper, obj, idleClip, rec, seat);
        // 다중 파츠 extras도 각자 독립 믹서를 갖도록 재료를 남겨둠
        wrapper.userData._idleClip = idleClip;
      }
    }else if(!isRigged){
      console.log('[파츠 애니] '+(rec.name||rec.id)+' — GLB 안에 애니메이션 클립이 0개입니다.'
        + ' (블렌더라면 export 옵션의 Animation 체크와, 액션에 Fake User(방패 아이콘) 또는 NLA 스택 등록을 확인)');
      _partAnimNotice(rec, '⚠️ GLB 안에 애니메이션 클립이 0개예요 — 블렌더 export 의 Animation 체크와 액션 Fake User 를 확인해 주세요');
    }else if(animations && animations.length){
      console.log('[파츠 애니] '+(rec.name||rec.id)+' — 리깅(스키닝) 파츠라 파츠 자체 애니메이션은 재생하지 않습니다.'
        + ' 움직임은 캐릭터 본이 담당합니다. 클립: ' + animations.map(c=>c.name).join(', '));
      _partAnimNotice(rec, '⚠️ 리깅 파츠로 잡혀서 자체 애니메이션을 끕니다 — 등록창의 🧷 단독 부착을 켜 보세요');
    }
    // ★ 레이스 가드 2차 체크 — 위 파싱 이후에도 색상/애니메이션 준비 등 처리가 있어서
    //   그 사이 새 장착이 시작됐으면 여기서도 중단 (유령 wrapper 방지).
    if(seat._equipSeq[seqKey] !== mySeq) return;
    if(isRigged){
      // 리깅 파츠는 특정 본이 아니라 캐릭터 모델 루트에 원좌표 그대로 부착 — 실제 위치는 스켈레톤이 결정
      charRoot.add(wrapper);
      // ★ 리깅 파츠의 기즈모/미세조정 지원 —
      //   TransformControls는 attach 대상 오브젝트의 로컬 원점을 기즈모 위치로 사용하는데, 리깅 파츠의
      //   wrapper는 원좌표(0,0,0)에 놓여있고 실제 스킨 메시는 스켈레톤이 어딘가로 옮겨놓은 상태라
      //   기즈모가 mesh와 동떨어진 위치에 붙어 보임. 그래서 부착 후 스킨 메시의 월드 중심을 재보정
      //   해서 wrapper를 그 위치로 옮김 — 그러면 기즈모가 정확히 옷 위에 붙고, 이후 유저의 드래그
      //   오프셋도 그 자리에서부터 계산됨.
      // (스킨드메시의 월드 바운딩박스 = 스켈레톤 자세를 반영한 실제 화면상 크기/위치)
      wrapper.updateMatrixWorld(true);
      const skinBB = new THREE.Box3();
      skinnedMeshes.forEach(sm=>{
        sm.updateMatrixWorld(true);
        const bb=new THREE.Box3().setFromObject(sm);
        if(bb.isEmpty()) return;
        if(skinBB.isEmpty()) skinBB.copy(bb); else skinBB.union(bb);
      });
      if(!skinBB.isEmpty()){
        const worldCenter = skinBB.getCenter(new THREE.Vector3());
        // 부모(charRoot) 로컬 좌표로 환산 — worldToLocal은 파괴적이라 새 벡터로
        const local = worldCenter.clone();
        charRoot.worldToLocal(local);
        wrapper.userData.baseCenter = local;   // applyPartXf가 이 위에 xf를 얹음
      }
    } else {
      bone.add(wrapper);
    }
    // 🔗 stackable: seat.stackedPartObjs[cat][id]에 저장 (같은 카테고리 다른 파츠와 공존).
    //   xf 적용은 applyPartXf가 def.equippedParts를 참조하는데 stackable은 배열이라 별도 처리.
    if(stackable){
      /* ★ 맵을 다시 보장한다 — 도입부에서 만들어도, 바로 아래 unequipStackablePart(같은 id 재장착
         정리)가 "그 카테고리의 마지막 파츠"를 지우면서 맵째 delete 한다. 그 상태로 여기 대입하면
         TypeError → 바깥 try/catch가 삼켜서 "재장착이 조용히 실패"가 된다.
         [증상] 카테고리에 혼자 있는 🔗 파츠(가챠는 전부 이 경우)가 커밋(창 닫기)마다
                붙었다 → 사라졌다를 번갈았다: 홀수 번째 커밋은 붙고 짝수 번째는 이 크래시.
                (sim-gacha-race.js 로 재현·수정 확인) */
      seat.stackedPartObjs = seat.stackedPartObjs || {};
      seat.stackedPartObjs[cat] = seat.stackedPartObjs[cat] || {};
      seat.stackedPartObjs[cat][rec.id] = wrapper;
      // ★ 버그 수정(파츠 위치 초기화): 예전엔 opts.stackableXf가 없으면 무조건 defaultPartXf()(원점)를
      //   적용했다 — 카탈로그 동기화(mergeCatalogIntoSavedParts)처럼 옵션 없이 부르는 호출자가 있으면
      //   유저가 맞춰둔 위치가 리셋됐음(등록 직후 "잠시 뒤" 원위치 증상의 원인).
      //   non-stackable이 applyPartXf로 charDef entry를 읽는 것과 동일하게, entry.xf를 진실의 원천으로 사용.
      let xf = (opts && opts.stackableXf) || null;
      if(!xf){ try{ const e = premiumMod.findEntryById(seat.charDef, cat, rec.id); if(e) xf = premiumMod.partEntryXf(e); }catch(_){} }
      _applyXfToWrapper(wrapper, xf || premiumMod.defaultPartXf(), cat);
    } else {
      seat.equippedPartObjs[cat] = wrapper;
      applyPartXf(seat, cat);   // 카테고리 기본 오프셋 + 캐릭터별 xf 적용 (리깅 파츠는 내부에서 건너뜀)
    }
    // ★ 런처9 — 다중 파츠: rec.multi가 true이고 entry.instances에 추가 인스턴스가 있으면 각각 wrapper를 clone해서 부착
    if(rec.multi === true && !isRigged){
      const def = seat.charDef;
      // ★ 버그 수정: def.equippedParts[cat]을 통째로 집으면 배열/Firebase 숫자키 맵일 때 entry가 아니고,
      //   instances도 숫자키 객체면 Array.isArray가 false라 extraCount가 0이 돼 extra wrapper가
      //   아예 생성되지 않았다(= 개수를 늘려도 기즈모가 붙을 대상이 없음).
      // ★ 반드시 '이 파츠'의 entry여야 한다. 못 찾으면 다른 파츠의 인스턴스 수를 따라가 복제본이 생기므로
      //   폴백(firstEntryForCat)을 쓰지 않고 추가 생성을 포기한다.
      const entry = premiumMod.findEntryById(def, cat, rec.id);
      const insArr = premiumMod.partEntryInstances(entry);   // 정규화 포함, [xf0, xf1, ...]
      const extraCount = Math.max(0, insArr.length - 1);
      // 🔍 진단 — "파츠 하나 꼈는데 여러 개로 보인다"의 원인을 바로 알 수 있게.
      //   entryId가 rec.id와 다르면 엉뚱한 파츠의 인스턴스 수를 따라간 것이고,
      //   같은데 extraCount>0이면 그 파츠에 다중 파츠 인스턴스가 실제로 저장돼 있는 것.
      if(extraCount > 0){
        console.log('[다중 파츠] '+cat+' — rec.id='+rec.id+' / entryId='+premiumMod.partEntryId(entry)
          + ' / 추가 '+extraCount+'개 생성'+(premiumMod.partEntryId(entry)!==rec.id ? '  ⚠️ id 불일치!' : ''));
      }
      if(extraCount > 0){
        wrapper.userData.multiExtras = [];   // 추가 wrapper들만 여기에 (main은 seat.equippedPartObjs[cat])
        for(let i=1; i<=extraCount; i++){
          const extraObj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(scene) : scene.clone(true);
          const extraColorGroups = {};   // 런처9: 각 인스턴스의 _col 그룹은 독립 — 별도 mesh 참조
          extraObj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false;
            const m = o.material&&o.material.clone? o.material.clone() : o.material; o.material=m;
            if(m){ _applyPartMatTone(m);   // 본체 인스턴스와 같은 함수
              if(m.transparent){ o.renderOrder = 10; _forceOpaqueAlphaOutput(m); }
            }
            // 런처9: 원본과 동일한 _col 네이밍 규칙으로 이 인스턴스만의 컬러 그룹 수집
            const colMatch = (o.name && o.name.match(/_col(\d*)/i)) || (m && m.name && m.name.match(/_col(\d*)/i));
            if(colMatch){
              const key = 'col'+(colMatch[1]||'1');
              if(m && m.color) o.userData.origColor = m.color.getHexString();
              (extraColorGroups[key] = extraColorGroups[key]||[]).push(o);
            }
          }});
          extraObj.name = '__part_'+cat+'_i'+i;
          const extraBB = new THREE.Box3().setFromObject(extraObj);
          const extraCenter = extraBB.getCenter(new THREE.Vector3());
          extraObj.position.sub(extraCenter);
          const extraWrap = new THREE.Group(); extraWrap.name='__partWrap_'+cat+'_i'+i;
          extraWrap.add(extraObj);
          extraWrap.userData.baseCenter = extraCenter.clone();
          // 🎩 같은 GLB의 clone이라 extraCenter === center. 메인 wrapper가 계산해둔 상쇄량을 그대로 쓴다
          //    (다시 계산하면 본 자세가 그새 바뀌어 인스턴스끼리 미세하게 어긋날 수 있다).
          extraWrap.userData.authorOff = wrapper.userData.authorOff ? wrapper.userData.authorOff.clone() : null;
          extraWrap.userData.animalHeadDy = wrapper.userData.animalHeadDy || 0;   // 🐾 같은 머리 보정을 인스턴스에도
          extraWrap.userData.cat = cat;
          extraWrap.userData.partId = rec.id;
          extraWrap.userData.__twPartWrap = true;
          extraWrap.userData.instanceIdx = i;
          extraWrap.userData.rigged = false;
          extraWrap.userData.colorGroups = extraColorGroups;   // 색상 팝업이 이 그룹을 대상으로 편집
          // ▶ 원본과 같은 애니메이션을 이 인스턴스에도 (믹서는 인스턴스마다 독립)
          if(wrapper.userData._idleClip){
            _setupPartIdleAnim(extraWrap, extraObj, wrapper.userData._idleClip, rec, seat);
          }
          bone.add(extraWrap);
          wrapper.userData.multiExtras.push(extraWrap);
        }
        // 메인 wrapper에도 인덱스 표식 (클릭으로 활성화 시 사용)
        wrapper.userData.instanceIdx = 0;
        applyPartXf(seat, cat);   // instances 반영해 다시 적용
      }
    }
  }catch(e){ console.warn('파츠 부착 실패', e); }
  _sweepOrphanPartWrappers(seat);   // 🧹 이번 장착으로 밀려난 유령 wrapper가 있으면 여기서 제거
  applyClothVisibility(seat);   // 옷 착용 상태에 따라 기본 상/하의 메시 숨김 갱신
  // ★ 자리비움 등으로 캐릭터가 숨겨져 있을 때 새 파츠가 나타나는 문제 대응 —
  //   _lastOp 초기화해서 다음 프레임에 setSeatOpacity가 새 mesh들에도 visible을 적용하게 함.
  seat._lastOp = null;
  /* 🎩 이 좌석 머리 위에 이미 누가 올라타 있다면, 그 좌석이 캐시한 '머리 꼭대기'는 **이 파츠가
     붙기 전의 값**이다. 여기서 한 번 다시 잰다 — 동물 귀(_registerAnimalEarOn)와 같은 처리다.
     [경위] 파츠 GLB 는 비동기로 붙는데 _measureHostHeadTop 은 mountRide 에서 **1회**만 돈다.
       손으로 얹을 때는 파츠가 이미 붙어 있어서 문제가 없었다. 그런데 런처에서 실행 화면으로
       돌아오면 좌석이 재조립되면서 파츠 로딩과 다시 얹기가 동시에 일어난다. 얹기가 먼저 끝나면
       '파츠 없음(null)' 이 캐시로 굳고, _applyRemoteRides 는 같은 상태면 재실측을 건너뛰므로
       그 세션 내내 파츠 위에 안 얹힌다. [증상] "잘 되다가 런처 갔다 오면 안 먹힌다."
     ⚠️ 매 프레임 재는 방식으로 바꾸지 말 것 — 이름표·말풍선이 이 높이를 보고 자리를 잡는다.
       부착이 끝난 이 지점에서의 1회여야 한다.
     ★ 파츠 종류를 가리지 않고 부른다. 머리 파츠가 아니면 측정값이 그대로일 뿐이고,
       올라탄 좌석이 없으면 _remeasureRideHeadTop 이 즉시 빠져나온다(비용이 없다). */
  try{ rideBenchMod._remeasureRideHeadTop(seat); }catch(_){}
}
/* 옷 카테고리만 해제 (def는 안 건드림 — 충돌 정리 내부용) */
function _unequipClothCat(seat, cat){
  unequipPartFromSeat(seat, cat);
  if(seat.charDef && seat.charDef.equippedParts) delete seat.charDef.equippedParts[cat];
}
/* 착용된 파츠에 따라 캐릭터 원본 메시들의 visible 토글.
   ★ 모든 파츠의 rec.hides 배열을 참조 (getRecHides로 sentinel/Firebase 객체 정규화).
     hides가 명시적이면(빈 배열 포함) 그대로 사용, 옛 파츠(hides 자체 없음)만 관례 기본값 fallback. */
function applyClothVisibility(seat){
  if(!seat) return;
  applyDecoPartsVisibility(seat);   // 🎁 꾸미기 파츠 표시 설정 — 부착·해제·좌석 재조립 뒤 늘 이 함수를 지나므로 여기서 같이 맞춘다
  /* 🎁 꺼짐이면 «파츠 없음» 으로 센다 — 파츠가 숨기던 기본 메시(머리카락·기본 상의)를 되돌리기 위해서다.
     ⚠️ 책상 위 파츠는 hides 를 안 가지므로 여기서 빼도 달라지는 게 없다. */
  const eq = (decoPartsVisible ? (seat.charDef && seat.charDef.equippedParts) : null) || {};
  const hidden = { top:false, bottom:false, onepiece:false, cape:false,
                   glasses:false, hat:false, mask:false, wing:false, handL:false, handR:false };
  // eq에 있는 모든 카테고리의 모든 파츠(stackable 배열 포함) 순회
  for(const cat in eq){
    const entries = premiumMod.entriesForCat(seat.charDef, cat);
    entries.forEach(entry=>{
      const id = premiumMod.partEntryId(entry);
      const rec = premiumMod.savedParts().find(p=>p.id===id);
      if(!rec) return;
      const explicitHides = premiumMod.getRecHides(rec);   // null = 옛 파츠, [] 이상 = 관리자 명시
      let hides;
      if(explicitHides !== null){
        hides = explicitHides;   // 관리자가 명시 → 그대로 (빈 배열이면 아무것도 안 숨김)
      } else {
        // 하위호환: hides 필드가 아예 없는 옛 파츠는 카테고리별 관례 기본값
        if(cat==='onepiece') hides = ['top','bottom','onepiece'];
        else if(cat==='cape') hides = [];   // 망토는 원래 겉옷처럼 덮어씀
        else if(cat in hidden) hides = [cat];   // 기본: 자기 부위만 숨김
        else hides = [];
      }
      hides.forEach(h=>{ if(h in hidden) hidden[h] = true; });
    });
  }
  /* ★ 자리비움 등으로 지금 숨겨져 있는 동안에는 visible 을 **직접 쓰면 안 된다.**
       그 상태에서 setSeatOpacity 는 원래 값을 mesh.userData._prevVisible 에 맡겨 두고
       visible 을 false 로 눌러 둔 것이다. 여기서 visible 을 바꿔 봐야
         ① 다음 프레임에 다시 false 로 덮이고
         ② 깨어날 때는 _prevVisible(=옷을 바꾸기 **전** 값)으로 복원된다.
       그래서 "자리비움 중에 상의를 벗었는데, 돌아오니 기본 상의가 그대로 숨어 있다" 같은
       어긋남이 남는다. 숨은 동안에는 '깨어나면 이래야 한다'를 _prevVisible 쪽에 적는다.
     ⚠️ _prevVisible 이 undefined = 지금 안 숨겨져 있다는 뜻이다(setSeatOpacity 가 복원하면서 지운다).
        그 판정을 여기서 다시 만들지 말 것 — 두 함수가 같은 한 표식을 봐야 갈라지지 않는다. */
  const _setVis = (mesh, v)=>{
    if(!mesh) return;
    if(mesh.userData._prevVisible !== undefined) mesh.userData._prevVisible = v;   // 숨은 중 — 복원값을 갱신
    else mesh.visible = v;
  };
  _setVis(seat.upMesh,       !hidden.top);
  _setVis(seat.loMesh,       !hidden.bottom);
  _setVis(seat.onepieceMesh, !hidden.onepiece);
  _setVis(seat.capeMesh,     !hidden.cape);
  _setVis(seat.glassesMesh,  !hidden.glasses);
  _setVis(seat.hatMesh,      !hidden.hat);
  _setVis(seat.maskMesh,     !hidden.mask);
  _setVis(seat.wingMesh,     !hidden.wing);
  _setVis(seat.handLMesh,    !hidden.handL);
  _setVis(seat.handRMesh,    !hidden.handR);
  /* 🎩 [제보] 모자 쓴 캐릭터 머리에 동물을 얹어 둔 뒤 **모자를 벗으면 동물이 파묻힌다** —
       맨머리로 얹었을 때보다도 더 낮게 들어간다.
     [기전] measureHeadBoxNoParts 는 **숨은 메쉬를 제외한다**(`p.visible === false` → skip).
       모자의 rec.hides 가 머리카락 같은 기본 메쉬를 숨기므로, 모자를 쓴 채 잰 머리 꼭대기는
       실제 실루엣보다 낮다 — **맨머리보다도 낮다.** 그 값이 캐시로 굳은 뒤 모자를 벗으면
       머리카락이 다시 보이는데 아무도 다시 재지 않아, 동물이 그 머리카락 속에 잠긴다.
     [왜 여기인가] 재측정을 부르는 자리가 셋 있었는데(equipPartOnSeat · 귀 부착 · 파츠 메타 지연)
       **전부 «붙는» 쪽이다. 빼는 쪽에는 없었다.**
       그렇다고 unequipPartFromSeat 에 넣으면 안 된다 — 그 함수가 끝난 **뒤에** 이 함수가
       가시성을 되돌리므로, 거기서 재면 여전히 숨은 상태로 재게 된다(고치려는 그 버그 그대로다).
       이 함수의 끝이 곧 «기본 메쉬 가시성이 확정된 순간»이고, 붙이든 빼든 모든 경로가 여기를 지난다.
     ★ 올라탄 좌석이 없으면 _remeasureRideHeadTop 이 riders.length 검사에서 즉시 빠져나온다 —
       미리보기 좌석(wdPreviewBase 등)까지 이 함수를 부르지만 비용이 없다.
     ⚠️ equipPartOnSeat 경로에서는 이 훅과 22243 의 훅이 둘 다 돈다. 그쪽은 **부착이 끝난 뒤**라야
       rideTop 파츠의 꼭대기(_headTopPart)를 제대로 잡으므로 지우면 안 된다. 여기 것은 그보다
       이른 시점이라 파츠 값이 아직 null 일 수 있고, 뒤이어 22243 이 덮는다. 순서가 그렇게 맞다.
     ⚠️ 매 프레임 재는 방식으로 바꾸지 말 것 — 이름표·말풍선이 이 높이를 보고 자리를 잡는다. */
  try{ rideBenchMod._remeasureRideHeadTop(seat); }catch(_){}
}
/* ★ 파츠 카테고리별 "기본 부착 위치" 미세조정 표 — 여기 숫자만 조절하면 해당 카테고리 파츠가
   장착됐을 때 시작 위치가 전부 한 번에 맞춰짐(사용자가 우클릭해서 개별 조정한 값은 이 위에 별도로
   더해지므로 서로 영향 안 줌). x=좌우, y=위아래, z=앞뒤(양수=카메라 쪽/앞, 음수=뒤).
   여기 없는 카테고리는 기본값(0,0,0) — 본(bone) 위치 그대로 붙음. */
const PART_DEFAULT_OFFSET = {
  mask:    {x:0,    y:-1.95, z:-0.3},   // 탈 — 기존 MASK_Y_OFFSET/MASK_Z_OFFSET을 여기로 통합
  hat:     {x:0,    y:0,     z:-0.5},
  glasses: {x:0,    y:-1.95, z:-0.3},
  top:     {x:0,    y:0,     z:0},
  bottom:  {x:0,    y:0,     z:0},
  onepiece:{x:0,    y:0,     z:0},
  wing:    {x:0,    y:0,     z:0},
  handL:   {x:0,    y:0,     z:0},
  handR:   {x:0,    y:0,     z:0},
};
/* 🩺 리깅 파츠 정렬 진단 — "리깅으로 붙었는데도 파츠가 뜬다"의 원인을 숫자로 확정한다.
   (핸드오프 3장 0번이 "리깅으로 붙었는데도 뜬 것이면 다른 원인, 재조사 필요"라고 남겨둔 그 자리)

   리깅 파츠의 최종 위치는 본 '이름'이 아니라 boneInverse가 결정한다:

       최종 = [캐릭터 본의 월드행렬] × [파츠 GLB의 boneInverse] × [파츠 bindMatrix] × 정점
                    ↑ 캐릭터 것        ↑ 파츠 것 — 여기가 어긋나면 그 차이만큼 통째로 밀린다

   equipPartOnSeat은 본만 캐릭터 것으로 갈아끼우고(`mapped`) boneInverses는 파츠 값을 그대로 쓴다.
   그래서 캐릭터 본을 가져다 만들었더라도 export 시 아마추어 위치·스케일이 조금 달랐거나
   (Apply Transform 유무, 아마추어를 원점으로 옮겨 내보내기 등) 역행렬이 달라지고, 파츠는 그만큼 뜬다.
   예: 파츠의 head 본이 바인드 시점에 원점 근처였다면 정확히 '머리 높이'만큼 뜬다.

   이 함수는 아무 것도 바꾸지 않는다. 본별로 아래 둘을 나란히 찍어서 위 가설을 검증만 한다.
     · 파츠 바인드 위치 — inverse(파츠 boneInverse)의 위치 = 저작 시점에 그 본이 있던 자리
     · 캐릭터 바인드 위치 — 캐릭터 자신의 스킨드메시에서 같은 이름 본의 boneInverse로 뽑은 자리
   두 값의 차이(Δ)가 곧 파츠가 밀리는 양이다. Δ≈0 이면 원인은 다른 데 있다.
   (1-5: 판단에 쓰이는 항을 하나도 빠짐없이, 비교 대상과 함께 찍는다) */
function _diagRiggedPartAlignment(cat, skinnedMeshes, charRoot){
  try{
    if(!charRoot || !skinnedMeshes || !skinnedMeshes.length) return;
    // 캐릭터 자신의 boneInverse 수집 (본 이름 → Matrix4). 파츠 메쉬(__part…)는 제외.
    const charInv = {};
    charRoot.traverse(o=>{
      if(!o.isSkinnedMesh || !o.skeleton || String(o.name||'').startsWith('__part')) return;
      const sk = o.skeleton;
      (sk.bones||[]).forEach((b,i)=>{
        if(b && b.name && !charInv[b.name] && sk.boneInverses && sk.boneInverses[i]) charInv[b.name] = sk.boneInverses[i];
      });
    });
    const _pos = m4 => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(m4).invert());
    const rows = [];
    let maxD = 0, maxName = '';
    skinnedMeshes.forEach(sm=>{
      const sk = sm.skeleton; if(!sk) return;
      (sk.bones||[]).forEach((b,i)=>{
        const pInv = sk.boneInverses && sk.boneInverses[i]; if(!b || !pInv) return;
        const cInvM = charInv[b.name];
        const p = _pos(pInv);
        if(!cInvM){ rows.push(b.name+': 파츠 '+p.toArray().map(v=>v.toFixed(2)).join('/')+' (캐릭터 쪽 기준 없음 — 입양 본)'); return; }
        const c = _pos(cInvM);
        const d = p.distanceTo(c);
        if(d > maxD){ maxD = d; maxName = b.name; }
        rows.push(b.name+': 파츠 '+p.toArray().map(v=>v.toFixed(2)).join('/')
          +' vs 캐릭터 '+c.toArray().map(v=>v.toFixed(2)).join('/')+'  Δ'+d.toFixed(3));
      });
    });
    if(!rows.length) return;
    const verdict = (maxD > 0.05)
      ? ('⚠️ boneInverse 불일치 — 최대 Δ'+maxD.toFixed(3)+' ('+maxName+'). 이 값만큼 파츠가 밀립니다. '
         +'파츠를 캐릭터 아마추어 그대로, 아마추어를 옮기지 않은 상태로 다시 export하면 해결됩니다.')
      : '✅ boneInverse는 캐릭터와 일치 — 파츠가 떠 보인다면 원인은 여기가 아닙니다.';
    console.log('[파츠 리깅정렬] '+cat+' — '+verdict+'\n    ' + rows.join('\n    '));
  }catch(e){ console.warn('[파츠 리깅정렬] 진단 실패', e); }
}
/* 🎩 파츠 "저작(모델링) 오프셋" 자동 상쇄 — 핸드오프 3장 0번 "head bone 파츠 공중부양" 수정.

   [증상] 모자·머리장식 중 일부가 캐릭터 머리에서 한참 위(대략 캐릭터 키만큼)에 떠서 붙는다.
   [원인] 비리깅 파츠는 obj.position.sub(center) 와 wrapper.position=baseCenter(+center)가
          서로 상쇄돼 net 0이다. 이 분리는 회전·크기의 피봇을 메쉬 중심에 두려는 목적이지
          위치 보정이 아니다. 결과적으로 파츠는 "자기가 모델링된 좌표 그대로" head 본의 자식이 된다.
          모델러가 원점 근처에서 만들었으면 본 위에 앉지만, 캐릭터에 씌운 상태로(머리 높이 ≈1.4)
          export하면 [본 높이] + [저작 높이]가 겹쳐서 그만큼 위로 뜬다.
          커미션 캐릭터는 본 이름이 표준과 달라 리깅 판정에서 떨어지기 쉬워 특히 잘 나타난다.
   [수정] 파츠가 "캐릭터에 씌운 채 저작된 것"으로 판정되면, 그 저작 좌표를 본 로컬 좌표로 환산해
          차이(authorOff)를 wrapper 위치에서 빼준다. 즉 파츠는 저작 당시 보이던 그 자리에 앉는다.

   ⚠️ 원점 기준으로 저작된 기존 파츠(대다수)는 절대 건드리면 안 된다. 그래서 핸드오프가 적어둔
      "baseCenter를 무조건 0으로"(방안 2)를 쓰지 않고, 아래 3중 판정을 전부 통과할 때만 보정한다.
      애매하면 보정하지 않는다 = 기존 동작 유지.
        1) 캐릭터 본들이 모델 원점에서 충분히 떨어져 있다 — 다 원점 근처면 2·3을 구분할 수 없다
        2) 파츠 중심도 모델 원점에서 충분히 떨어져 있다   — 원점 근처면 원점 기준 저작이 확실
        3) 파츠 중심이 원점보다 '가장 가까운 캐릭터 본'에 뚜렷하게(2배 이상) 가깝다 — 결정적 신호
      '충분히'의 기준은 파츠 자신의 최대 변(maxDim)이라 스케일 불변이다.
      (1-3 대응: 눈으로 맞춘 절대 상수를 새로 만들지 않기 위한 선택. 파츠 크기가 달라도 판정이 안 흔들린다)

   ★ 3)은 처음에 '부착 본(info.bone)'까지의 거리로 쟀는데 그게 틀렸다(1-4: 이름 말고 무엇을 재는지 볼 것).
     판정의 목적은 "이 파츠가 캐릭터에 씌워진 채 저작됐나"이지 "부착 본 바로 옆에 있나"가 아니다.
     후광·귀·날개처럼 부착 본에서 멀찍이 떨어진 자리에 저작된 파츠가 통째로 미발동했다. 실측:
       angelring (본 없는 후광, 중심 y=4.635, maxDim 2.315)
         head까지 2.651 ≥ 임계 2.317 → ❌ 미발동(버그 그대로) / 최근접 ear_L까지 1.225 → ✅ 발동
       kuma (곰 귀, 중심 y=3.849, maxDim 2.789)
         head까지 1.889 vs 임계 1.939 → 여유 2.5%로 아슬아슬 / 최근접 ear_L까지 0.762 → ✅ 여유 있게
     거리는 **가장 가까운 캐릭터 본**으로 재고, 보정량은 그대로 **부착 본 기준**으로 만든다
     (wrapper가 실제로 매달리는 곳이 부착 본이므로).

   ※ 1-2 주의: 여기 쓰는 bb는 equipPartOnSeat가 피봇용으로 만든 것과 '같은' 박스다(visible 검사 없음,
     SkinnedMesh는 바인드 포즈). 보정 후 피봇과 실제 위치가 어긋나지 않으려면 반드시 같은 값이어야 하므로
     의도적으로 공유한다. bb 측정 방식을 고칠 땐 equipPartOnSeat와 여기를 함께 고칠 것.
   ※ 본의 '현재 자세'로 환산한다. 부착 시점 자세가 오프셋에 굳지만, 머리 본은 idle에서 rest에 가깝다. */
/* 캐릭터 본의 '바인드 자세' 역행렬(boneInverse) 모음 — 파츠 저작 오프셋은 반드시 이걸로 계산한다.

   [왜] bone.getWorldPosition() / bone.worldToLocal()은 **지금 자세**를 쓴다. 그런데
        ・꾸미기 미리보기: 애니메이션이 없어 항상 rest 포즈
        ・실행 화면: 숨쉬기·고개짓·타이핑 클립이 돌아 spine/head가 기울어져 있다
        오프셋(≈본에서 머리끝까지, 크기 2 수준)을 기울어진 프레임에서 환산해 굳혀버리면
        기울기만큼 그대로 밀린다. 30°만 기울어도 1.0 가까이 어긋나서 모자가 얼굴 밑으로 내려간다.
        → "미리보기는 정상인데 실행 화면에서만 어긋난다"의 정체.
   [해결] boneInverse는 GLB에 굳어 있는 바인드 자세 값이라 애니메이션과 무관하다.
        모델 좌표의 점에 곱하면 곧바로 그 본의 바인드 로컬 좌표가 된다.
        wrapper는 본의 자식이므로, 바인드 기준으로 앉혀두면 이후 본이 어떻게 움직여도 함께 따라간다.
   ※ 파츠 자신의 스킨드메시는 제외한다 — 그건 캐릭터 리그가 아니라 파츠 리그다. */
function _charBoneBindInverses(modelRoot){
  const out = {};
  if(!modelRoot) return out;
  modelRoot.traverse(o=>{
    if(!o.isSkinnedMesh || !o.skeleton) return;
    if(String(o.name||'').indexOf('__part') === 0) return;
    if(o.userData && o.userData._origBind) return;            // 리깅 파츠의 스킨드메시
    let p = o, isPart = false;
    while(p && p !== modelRoot){
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0){ isPart = true; break; }
      p = p.parent;
    }
    if(isPart) return;
    const sk = o.skeleton;
    (sk.bones || []).forEach((b, i)=>{
      if(!b || !b.name || out[b.name]) return;
      const inv = sk.boneInverses && sk.boneInverses[i];
      if(inv) out[b.name] = inv;
    });
  });
  return out;
}
function _computePartAuthorOffset(bb, center, bone, modelRoot, cat, charBones){
  try{
    if(!bb || bb.isEmpty() || !center || !bone || !modelRoot) return null;
    const size = bb.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if(!(maxDim > 1e-6)) return null;
    modelRoot.updateMatrixWorld(true);
    // 캐릭터 본들을 모델 좌표계로 환산해서 (a) 가장 가까운 본까지의 거리 (b) 본들의 최대 원점거리 를 구한다.
    const _bp = new THREE.Vector3();
    const _binds = _charBoneBindInverses(modelRoot);   // 바인드 자세 — 애니메이션 무관
    const _m4 = new THREE.Matrix4();
    // 본 위치도 바인드 기준으로 잰다. 지금 자세로 재면 실행 화면에서만 판정이 흔들린다.
    const _bonePos = (nm, cb)=>{
      const inv = _binds[nm];
      if(inv) return _bp.setFromMatrixPosition(_m4.copy(inv).invert());
      cb.getWorldPosition(_bp); modelRoot.worldToLocal(_bp); return _bp;   // 스키닝 없는 캐릭터 폴백
    };
    let dNear = Infinity, nearName = '', boneSpread = 0;
    for(const nm in (charBones||{})){
      const cb = charBones[nm]; if(!cb) continue;
      _bonePos(nm, cb);
      const bl = _bp.length(); if(bl > boneSpread) boneSpread = bl;
      const dd = center.distanceTo(_bp);
      if(dd < dNear){ dNear = dd; nearName = nm; }
    }
    if(!isFinite(dNear)) return null;          // 본을 하나도 못 찾음 — 판단 불가라 손대지 않음
    const dOrigin = center.length();           // 파츠 중심 ↔ 모델 원점
    const ok = (boneSpread > maxDim*0.5) && (dOrigin > maxDim*0.5) && (dNear < dOrigin*0.5);
    // 1-5 대응: 판정에 쓰인 항을 전부 남긴다 — 안 고쳐졌을 때 어느 조건에서 떨어졌는지 바로 보이게.
    //   (원점 근처 파츠는 정상 경로라 로그를 남기지 않는다 — 콘솔 소음 방지)
    if(!ok){
      if(dOrigin > maxDim*0.5) console.log('[파츠 저작오프셋] '+cat+' — 보정 안 함(원점 기준 저작으로 판정). '
        +'최근접본 '+(nearName||'?')+'까지 '+dNear.toFixed(3)+' / 원점거리 '+dOrigin.toFixed(3)
        +' (임계 '+(dOrigin*0.5).toFixed(3)+') / 본 퍼짐 '+boneSpread.toFixed(3)+' / 파츠크기 '+maxDim.toFixed(3));
      return null;
    }
    const boneLocal = bone.getWorldPosition(new THREE.Vector3());
    modelRoot.worldToLocal(boneLocal);          // 부착 본이 모델 좌표계 어디에 있는지 (로그용)
    /* 🎯 저작 위치 → 부착 본 로컬. **바인드 자세**로 환산한다(위 _charBoneBindInverses 주석 참고).
       예전엔 modelRoot.localToWorld + bone.worldToLocal, 즉 '지금 자세'를 썼다. 미리보기는 정지라
       맞아떨어졌지만 실행 화면은 숨쉬기·고개짓 클립이 돌아 head/spine이 기울어져 있어서, 그 기울기가
       오프셋에 그대로 굳어 모자가 얼굴 밑으로 내려갔다. boneInverse는 자세와 무관하다. */
    const _bindInv = _binds[bone.name];
    let want;
    if(_bindInv){
      want = center.clone().applyMatrix4(_bindInv);
    }else{
      want = modelRoot.localToWorld(center.clone());   // 스키닝 없는 캐릭터 폴백(기존 경로)
      bone.worldToLocal(want);
    }
    const off = center.clone().sub(want);                 // wrapper 위치에서 빼야 할 양
    if(!isFinite(off.x) || !isFinite(off.y) || !isFinite(off.z)) return null;
    // ★ 1-3 대응 — mask/glasses의 PART_DEFAULT_OFFSET(y:-1.95)처럼 "떠 있는 걸 눈으로 눌러 맞춰둔"
    //   카테고리 상수가 이미 있으면, 여기서 또 상쇄하면 이중 보정이 되어 파츠가 땅으로 꺼진다.
    //   그런 카테고리는 손대지 않고 기존 동작을 그대로 유지한다(모자 y:0 / 날개·손 0 은 해당 없음 → 보정됨).
    const dOff = PART_DEFAULT_OFFSET[cat];
    if(dOff && _isLegacyAuthorCompensation([dOff.x, dOff.y, dOff.z], off)){
      console.log('[파츠 저작오프셋] '+cat+' — PART_DEFAULT_OFFSET('+dOff.x+', '+dOff.y+', '+dOff.z+')이 이미 '
        +'같은 양을 눌러 맞춰둔 카테고리라 보정 생략(이중 보정 방지). 계산된 상쇄량은 '
        +'('+off.x.toFixed(3)+', '+off.y.toFixed(3)+', '+off.z.toFixed(3)+')');
      return null;
    }
    console.log('[파츠 저작오프셋] '+cat+' — 캐릭터에 씌운 채 저작된 파츠로 판정, 상쇄 적용 '
      +'('+off.x.toFixed(3)+', '+off.y.toFixed(3)+', '+off.z.toFixed(3)+') | '
      +'파츠중심 ('+center.x.toFixed(3)+', '+center.y.toFixed(3)+', '+center.z.toFixed(3)+') / '
      +'부착본 '+(bone.name||'?')+' ('+boneLocal.x.toFixed(3)+', '+boneLocal.y.toFixed(3)+', '+boneLocal.z.toFixed(3)+') / '
      +'최근접본 '+(nearName||'?')+'까지 '+dNear.toFixed(3)+' < 원점거리 '+dOrigin.toFixed(3)+'×0.5 '
      +'/ 파츠크기 '+maxDim.toFixed(3));
    return off;
  }catch(e){ console.warn('[파츠 저작오프셋] 계산 실패 — 보정 생략', e); return null; }
}
/* 🩺 머리 계열 파츠 실측 — "동물에 모자를 씌우면 자리가 틀리다"의 원인을 숫자로 확정하기 위한 진단.

   머리 파츠는 부착 본(head) 로컬 좌표에 놓이는데, 그 단위는 **리그 원본 단위**다. 그래서 파츠가
   제자리를 찾으려면 '저작 당시의 캐릭터'와 '지금 입는 캐릭터'가 같은 리그 비율이어야 한다.
   동물은 그 전제가 깨져 있다 — 실측(animal-glb.js, base2.glb):
       head 본 y = 1.469 / 보이는 머리 꼭대기 y = 2.33~3.31(선택한 얼굴에 따라 다름)
       → 머리가 본보다 0.86~1.84 위까지 뻗는다. 사람 리그는 이 여유가 훨씬 작다.
   그래서 사람 기준으로 저작된 모자는 동물의 큰 머리 '안쪽'에 박힌다.

   보정 계수를 눈으로 맞추지 않기 위해(1-3) 두 캐릭터의 실측값을 같은 형식으로 남긴다.
   인간·동물 각각 한 번씩 로그를 받아 두 박스의 비율로 보정을 유도하는 것이 다음 단계다. */
function _measureBodyBoxInLocal(modelRoot, refNode){
  // refNode 로컬 좌표계에서 캐릭터 '본체' 박스 — 꾸미기 파츠·리깅 파츠(동물 귀 포함)·숨은 메쉬 제외.
  // measureHeadBoxNoParts와 같은 제외 규칙이지만, 월드가 아니라 지정한 노드 기준으로 잰다.
  const box = new THREE.Box3(), tmp = new THREE.Box3(), M = new THREE.Matrix4();
  modelRoot.updateWorldMatrix(true, true); refNode.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(refNode.matrixWorld).invert();
  modelRoot.traverse(o=>{
    if(!o.isMesh || !o.geometry) return;
    if(o.userData && o.userData._origBind) return;              // 리깅 파츠의 스킨드메시
    let p = o, skip = false;
    while(p && p !== modelRoot){
      if(p.visible === false){ skip = true; break; }
      if(p.userData && p.userData.rigged){ skip = true; break; }
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0){ skip = true; break; }
      p = p.parent;
    }
    if(skip || o.visible === false) return;
    try{
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(M.copy(inv).multiply(o.matrixWorld));
      if(!tmp.isEmpty()) box.union(tmp);
    }catch(_){}
  });
  return box;
}
function _diagPartHeadSpace(cat, modelRoot, bone, bb, center, seat, isRigged){
  try{
    if(!modelRoot || !bone || !bb || bb.isEmpty()) return;
    const f = v => (v>=0?' ':'') + v.toFixed(3);
    const kind = (seat && seat.charDef && seat.charDef.animal) ? '동물'
               : (seat && seat.charDef && seat.charDef.isCommission) ? '커미션' : '인간';
    const ctx = (seat && seat.modelRoot) ? '실행좌석' : (seat && seat.root) ? '미리보기' : '기타';
    // 부착 본 위치 (리그 원본 단위)
    const bp = bone.getWorldPosition(new THREE.Vector3()); modelRoot.worldToLocal(bp);
    // 캐릭터 본체 박스 (같은 단위) — 머리 꼭대기까지의 여유가 핵심 숫자
    const body = _measureBodyBoxInLocal(modelRoot, modelRoot);
    const size = bb.getSize(new THREE.Vector3());
    const bs = new THREE.Vector3(); modelRoot.getWorldScale(bs);
    let msg = '[파츠 머리공간] ' + cat + ' — ' + kind + '/' + ctx + (isRigged ? '/리깅' : '/비리깅')
      + '\n    부착본 ' + (bone.name||'?') + ' (' + f(bp.x) + ',' + f(bp.y) + ',' + f(bp.z) + ')'
      + '  본 자체 scale (' + f(bone.scale.x) + ',' + f(bone.scale.y) + ',' + f(bone.scale.z) + ')'
      + '\n    파츠 박스 크기 (' + f(size.x) + ',' + f(size.y) + ',' + f(size.z) + ')'
      + '  중심 (' + f(center.x) + ',' + f(center.y) + ',' + f(center.z) + ')';
    if(!body.isEmpty()){
      msg += '\n    캐릭터 본체 y ' + f(body.min.y) + ' ~ ' + f(body.max.y)
        + ' / x ±' + f(Math.max(Math.abs(body.min.x), Math.abs(body.max.x)))
        + '  → 머리 꼭대기가 부착본보다 ' + f(body.max.y - bp.y) + ' 위';
    }
    msg += '\n    정규화 배율 ' + f(bs.x) + ' (이 값이 화면 크기를 결정 — 파츠 좌표는 이 배율 이전 단위)';
    console.log(msg);
  }catch(e){ console.warn('[파츠 머리공간] 진단 실패', e); }
}
/* 🎩 부착본 위로 머리가 얼마나 뻗는지(리그 원본 단위) — 동물 머리 파츠 보정의 유일한 입력값.
   기본 모자·탈·안경 메쉬는 제외한다. 그건 머리가 아니라 '머리에 얹힌 것'이고, 파츠를 끼면
   applyClothVisibility가 어차피 숨기므로 포함하면 측정이 착용 순서에 따라 흔들린다.
   (실측: 인간 base GLB의 기본 모자를 포함하면 머리 꼭대기가 3.994 → 4.099로 부풀려진다)
   ★ 제외 목록은 HEAD_DECOR_MESH_KEYS 하나뿐이다 — 올라타기 측정(measureHeadBoxNoParts)이
     같은 목록을 쓴다. 여기에 항목을 따로 더하지 말 것. */
function _headTopAboveBone(modelRoot, bone, meshHost){
  if(!modelRoot || !bone) return 0;
  const skip = headDecorMeshSet(meshHost);
  modelRoot.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(modelRoot.matrixWorld).invert();
  const bp = bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const tmp = new THREE.Box3(), M = new THREE.Matrix4();
  let top = -Infinity;
  modelRoot.traverse(o=>{
    if(!o.isMesh || !o.geometry || skip.has(o)) return;
    if(o.userData && o.userData._origBind) return;                 // 리깅 파츠의 스킨드메시
    let p = o, drop = false;
    while(p && p !== modelRoot){
      if(p.visible === false){ drop = true; break; }               // 숨은 메쉬(얼굴 변형 미선택 등)
      if(p.userData && p.userData.rigged){ drop = true; break; }    // 동물 귀 등 부착물
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0){ drop = true; break; }
      p = p.parent;
    }
    if(drop || o.visible === false) return;
    try{
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(M.copy(inv).multiply(o.matrixWorld));
      if(!tmp.isEmpty() && tmp.max.y > top) top = tmp.max.y;
    }catch(_){}
  });
  return (top > -Infinity) ? (top - bp.y) : 0;
}
/* 사람(기본 GLB) 기준 머리 여유 — 파츠가 저작된 리그의 값. 1회 측정 후 캐시.
   ★ 상수로 박지 않는다. base GLB를 손보면 이 값도 같이 따라가야 하고, 숫자를 박아두면 조용히 어긋난다.
   ★ 실패했을 땐 캐시하지 않는다 — BASE_SCENE 파싱 전에 한 번 불리면 0이 영구히 굳어 보정이 죽는다. */
let _BASE_HEAD_TOP = null;
function _baseHeadTopAboveBone(){
  if(_BASE_HEAD_TOP != null) return _BASE_HEAD_TOP;
  try{
    const inst = instantiateBase();
    if(!inst || !inst.root) return 0;   // BASE_SCENE 아직 없음 — 캐시하지 않고 다음 기회에 다시 잰다
    let hb = null;
    inst.root.traverse(o=>{ if(!hb && o.isBone && String(o.name||'').toLowerCase().indexOf('head') >= 0) hb = o; });
    if(!hb) return 0;
    const v = _headTopAboveBone(inst.root, hb, inst);
    if(!(v > 0)) return 0;
    _BASE_HEAD_TOP = v;
    console.log('[파츠 머리보정] 사람 기준 머리 여유 ' + v.toFixed(3) + ' (리그 원본 단위 · 기본 모자 제외)');
  }catch(e){ console.warn('[파츠 머리보정] 사람 기준 측정 실패', e); }
  return _BASE_HEAD_TOP || 0;
}
/* 🐾 동물 머리 파츠 세로 보정량 — 파츠는 사람 리그에 씌운 채 저작되는데, 동물 리그는 머리가 더 낮다.

   실측(base-glb.js / animal-glb.js 디코드):
     ・두 리그는 x·z가 완전히 동일하다(ear_L x = 0.787 양쪽 같음) = 같은 아마추어를 세로로만 옮긴 것
     ・head 본:  사람 y 1.987  vs  동물 y 1.469
     ・머리 꼭대기(본 위): 사람 2.007  vs  동물 1.846/1.304/1.411/0.857 (face1~4, 선택한 얼굴마다 다름)
     ⇒ 파츠가 사람 머리 꼭대기 기준으로 앉으므로, 동물에선 그 차이만큼 머리 위로 떠 있다.
       face2/3/4는 몸 높이의 19~36%나 되는 양이라 눈에 그대로 보인다.

   ★ 크기는 건드리지 않는다. 정규화 배율이 사람 0.3528 / 동물 0.1765(비율 0.500)이고,
     동물 머리 폭이 사람보다 조금 넓어서(±1.151 vs ±1.098) 화면상 파츠/머리 비율이 이미 96% 맞는다.
     세로 위치만 틀렸다 — 여기서 스케일까지 손대면 맞는 것을 망친다.

   적용 조건 (하나라도 어긋나면 0 = 기존 동작 그대로)
     1) 동물 캐릭터만. 사람·커미션은 기준 리그 본인이라 손댈 이유가 없다.
     2) 머리 그룹(group==='head')만.
     3) PART_DEFAULT_OFFSET에 y가 이미 박힌 카테고리(탈·안경 y:-1.95)는 제외 — 눈으로 눌러 맞춰둔
        값과 겹쳐 이중 보정이 된다(_computePartAuthorOffset의 같은 판단과 한 쌍).
     4) 비리깅이면 authorOff가 있는 파츠만. authorOff가 null인 파츠는 원점 저작 = 본에 붙는 게 정상이라
        내리면 오히려 머리 밑으로 꺼진다. (리깅 파츠는 boneInverse가 곧 '사람에 씌운 채 저작'이라 항상 적용) */
function _computeAnimalHeadDy(seat, info, cat, bone, modelRoot, isRigged, authorOff){
  try{
    if(!(seat && seat.charDef && seat.charDef.animal)) return 0;
    if(!info || info.group !== 'head') return 0;
    const dOff = PART_DEFAULT_OFFSET[cat];
    if(dOff && Math.abs(dOff.y || 0) > 1e-6) return 0;
    if(!isRigged && !authorOff) return 0;
    const Ha = _headTopAboveBone(modelRoot, bone, seat);
    const Hh = _baseHeadTopAboveBone();
    if(!(Ha > 0) || !(Hh > 0)) return 0;
    const dy = Ha - Hh;
    if(!isFinite(dy) || Math.abs(dy) < 1e-3) return 0;
    console.log('[파츠 머리보정] ' + cat + ' — 동물 머리 여유 ' + Ha.toFixed(3)
      + ' vs 사람 ' + Hh.toFixed(3) + ' → 세로 ' + dy.toFixed(3) + ' 보정'
      + (isRigged ? ' (리깅: bindMatrix에 굽기)' : ' (비리깅)'));
    return dy;
  }catch(e){ console.warn('[파츠 머리보정] 계산 실패', e); return 0; }
}
/* 어떤 위치값(pos)이 "떠 있던 파츠를 반대로 눌러 맞춰둔 보정값"인지 판정.
   ao(이번에 새로 상쇄하는 양)의 정확히 반대 방향으로 ao 크기의 절반 이상 밀려 있으면 그렇게 본다.
   두 곳에서 쓴다 — (a) 유저가 기즈모로 눌러둔 xf.pos, (b) 카테고리 상수 PART_DEFAULT_OFFSET.

   ★ 저장된 xf.pos를 일괄 변환하지 않는다(핸드오프 3장 0번 ⚠️: 유저 데이터 형태가 균일하지 않다).
     적용 시점에만 판단하므로 형태가 제각각이어도 안전하고, 결과가 멱등이다.
       - 눌러둔 유저: 보던 위치 그대로 유지 → 기즈모를 한 번 만지면 깨끗한 값(≈0)으로 자연 이관
       - 안 눌러둔 유저: 그대로 제자리로 내려옴
   ★ 임계 0.5는 "정상적인 미세조정"과 구분하기 위한 값. 저작 오프셋은 보통 캐릭터 키 수준(≈1.4)이라
     그 0.5배(≈0.7)를 반대 방향으로 미는 조정은 손보정 말고는 나오기 어렵다. */
function _isLegacyAuthorCompensation(pos, ao){
  if(!ao || !pos) return false;
  const L2 = ao.lengthSq(); if(!(L2 > 1e-6)) return false;
  const dot = (+pos[0]||0)*ao.x + (+pos[1]||0)*ao.y + (+pos[2]||0)*ao.z;
  return (-dot / L2) >= 0.5;
}
/* wrapper에 카테고리 기본 오프셋 + 캐릭터별 xf 적용 (부착 시·슬라이더 변경 시 호출) */
// wrapper 하나에 xf(위치/회전/스케일/색상)를 적용하는 공통 로직.
//   기존 applyPartXf(카테고리 단위)와 stackable 파츠 개별 wrapper 양쪽에서 재사용.
function _applyXfToWrapper(wrp, xf, cat){
  if(!wrp || !wrp.userData || !wrp.userData.baseCenter) return;
  if(!xf) xf = premiumMod.defaultPartXf();
  // 🐾 동물 머리 보정 — 부착 시 계산해 둔 세로 보정량(_computeAnimalHeadDy). 동물이 아니면 0이라 무영향.
  //    리깅/비리깅 둘 다 같은 값을 쓴다 — 두 리그가 같은 단위(x·z 동일)라서 보정량도 그대로 통한다.
  const _ahdy = (+wrp.userData.animalHeadDy || 0);
  if(wrp.userData.rigged){
    const bc = wrp.userData.rigBindCenter || new THREE.Vector3();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(xf.rot[0], xf.rot[1], xf.rot[2]));
    const M = new THREE.Matrix4().compose(
      new THREE.Vector3(bc.x + xf.pos[0], bc.y + xf.pos[1] + _ahdy, bc.z + xf.pos[2]),
      q,
      new THREE.Vector3(xf.scale, xf.scale, xf.scale)
    ).multiply(new THREE.Matrix4().makeTranslation(-bc.x, -bc.y, -bc.z));
    (wrp.userData.rigSkinnedMeshes||[]).forEach(sm=>{
      if(sm.userData._origBind) sm.bindMatrix.copy(M).multiply(sm.userData._origBind);
    });
    const c = wrp.userData.baseCenter || new THREE.Vector3();
    wrp.position.set(c.x + xf.pos[0], c.y + xf.pos[1] + _ahdy, c.z + xf.pos[2]);   // 기즈모도 같이 따라오게
    wrp.rotation.set(xf.rot[0], xf.rot[1], xf.rot[2]);
    wrp.scale.setScalar(xf.scale);
  } else {
    const c = wrp.userData.baseCenter;
    wrp.position.copy(c);
    // 🎩 저작 오프셋 상쇄 — "캐릭터에 씌운 채 export된 파츠"에만 값이 들어있다(_computePartAuthorOffset).
    //    원점 기준으로 저작된 기존 파츠는 null이라 이 줄이 아무 일도 하지 않는다.
    const ao = wrp.userData.authorOff || null;
    if(ao) wrp.position.sub(ao);
    const dOff = PART_DEFAULT_OFFSET[cat];
    if(dOff){ wrp.position.x += dOff.x; wrp.position.y += dOff.y; wrp.position.z += dOff.z; }
    // 예전에 유저가 "떠 있는 걸 기즈모로 눌러 맞춰둔" xf.pos는 이제 이중 보정이 되므로 되돌린다.
    //   → 그 유저에게는 보이던 위치가 그대로 유지되고, 기즈모를 한 번 만지면 깨끗한 값으로 이관된다.
    /* ⚠️ 판정은 이 wrapper 에 대해 **딱 한 번만** 한다(캐시).
       [경위] 예전엔 apply 가 돌 때마다 지금의 xf.pos 로 다시 판정했다. 그런데 기즈모로 끄는 값이
         바로 그 xf.pos 라, ao 의 반대 방향으로 끌다 보면 드래그 도중에 판정이 false→true 로 뒤집힌다.
         뒤집히는 순간 +ao 가 한꺼번에 더해져 파츠가 저작 오프셋(대개 캐릭터 키 수준)만큼 튀어
         멀리 날아간다 — "기즈모를 움직이다 갑자기 크게 튄다"는 제보가 이것이다.
         동물에서 특히 잘 났다: 리그가 40% 라 같은 마우스 이동이 로컬 좌표로는 2.5배로 들어가
         임계(|ao|의 0.5배)를 훨씬 쉽게 넘는다.
       ★ 부착 시점의 저장값으로 한 번 정하고, 그 뒤에는 기즈모가 값을 새로 쓸 때만 false 로 내린다
         (syncWdGizmoToXf 참고). 그래야 apply↔sync 가 서로 정확한 역함수로 남는다. */
    if(wrp.userData._aoLegacy === undefined)
      wrp.userData._aoLegacy = !!(ao && _isLegacyAuthorCompensation(xf.pos, ao));
    const legacy = wrp.userData._aoLegacy;
    wrp.position.x += xf.pos[0] + (legacy ? ao.x : 0);
    wrp.position.y += xf.pos[1] + (legacy ? ao.y : 0) + _ahdy;
    wrp.position.z += xf.pos[2] + (legacy ? ao.z : 0);
    wrp.rotation.set(xf.rot[0], xf.rot[1], xf.rot[2]);
    wrp.scale.setScalar(xf.scale);
  }
  wrp.updateMatrix(); wrp.updateMatrixWorld(true);
  // 색상 그룹 (인스턴스마다 독립)
  if(xf.color && wrp.userData.colorGroups){
    for(const key in wrp.userData.colorGroups){
      const c = xf.color[key];
      if(c) wrp.userData.colorGroups[key].forEach(m=>{
        if(!m.material) return;
        // 🎨 텍스처가 있는 _col 메쉬는 색을 덮어쓰지 않고 색조(Hue)만 회전 — 무늬·명암 보존
        if(isHueTintMesh(m)){ applyHueTint(m, c, xf.colorHSV && xf.colorHSV[key]); m.material.needsUpdate=true; return; }
        if(m.material.color) m.material.color.set(c);
        if(m.material.emissive){
          const baseFlat = (m.material.userData && m.material.userData.baseFlat!=null) ? m.material.userData.baseFlat : FLAT_EMISSIVE;
          m.material.emissive.set(c).multiplyScalar(baseFlat);
        }
        m.material.needsUpdate=true;
      });
    }
  }
  /* 🖍️ 그림칸 — 저장된 그림(URL)을 이 파츠에 얹는다. 색과 같은 자리에 사는 인스턴스 값이라
     내 파츠든 친구 파츠든 같은 길로 들어온다(equippedParts 가 바뀌면 상대 화면도 재장착된다). */
  if(partPaintMod.wrapperHasPic(wrp)) partPaintMod.applyPartPic(wrp, xf.pic);
}

/* 파츠 wrapper들에 저장된 xf를 반영.
   ★ 예전엔 seat.charDef.equippedParts[cat]을 통째로 entry로 썼는데, 🔗 stackable로 여러 개를 착용하면
     그 값은 배열(또는 Firebase 숫자키 맵)이라 진짜 entry가 아니다. 게다가 stackable 분기는
     multiExtras를 아예 건드리지 않아서 "다중 파츠를 늘려도 추가된 파츠가 움직이지 않는" 원인이 됐다.
     이제 wrapper.userData.partId로 각자의 entry를 정확히 짚고, 두 분기 모두 인스턴스를 extras까지 적용한다. */
function applyPartXf(seat, cat){
  if(!seat || !seat.charDef) return;
  const def = seat.charDef;
  // wrapper 하나 + 그 다중 파츠 extras에 entry의 인스턴스 xf를 순서대로 적용
  const applyEntryTo = (wrp, entry)=>{
    if(!wrp || !wrp.userData || !wrp.userData.baseCenter) return;
    const instances = premiumMod.partEntryInstances(entry);
    _applyXfToWrapper(wrp, instances[0], cat);
    const extras = wrp.userData.multiExtras || [];
    extras.forEach((ex, i)=> _applyXfToWrapper(ex, instances[i+1] || premiumMod.defaultPartXf(), cat));
  };
  const mainWrp = seat.equippedPartObjs && seat.equippedPartObjs[cat];
  if(mainWrp && mainWrp.userData && mainWrp.userData.baseCenter){
    const mainEntry = premiumMod.findEntryById(def, cat, mainWrp.userData.partId) || premiumMod.firstEntryForCat(def, cat);
    if(mainEntry) applyEntryTo(mainWrp, mainEntry);
  }
  // 🔗 stackable 파츠 — id별 entry를 찾아 각각 적용(다중 파츠 extras 포함)
  if(seat.stackedPartObjs && seat.stackedPartObjs[cat]){
    premiumMod.entriesForCat(def, cat).forEach(entry=>{
      const wrp = seat.stackedPartObjs[cat][premiumMod.partEntryId(entry)];
      if(wrp) applyEntryTo(wrp, entry);
    });
  }
  /* 🪑🦶 "책상 위" 파츠의 바닥 맞춤 — 파츠 **자신**을 들어 올린다.
     [왜 따로 있는가] 이 카테고리는 seat.deskAnchor 에 붙어 gltfRoot **밖**이다(일부러 그렇게 만들었다 —
       캐릭터를 안 따라오는 것이 이 카테고리의 존재 이유다). 그래서 캐릭터를 들어 올리는 쪽의
       바닥 맞춤(measureUnderfootDepth → fitModel)은 이 파츠를 애초에 세지 않고, 센다 해도
       캐릭터만 올라가고 파츠는 제자리에 남아 아무것도 해결되지 않는다.
     ⚠️ 미리보기와 실행 **양쪽이 이 함수를 거친다.** 그래서 한 곳만 고쳐도 둘이 같이 맞는다 —
       한쪽에만 넣으면 미리보기와 실행이 그만큼 어긋난다(이 건의 원래 증상이 그것이었다).
     ★ 실제 계산은 floorClampWrapper 하나로 모아 뒀다(그 주석에 기준·환산 이유가 있다).
       기즈모 드래그(syncWdGizmoToXf)도 같은 함수를 쓴다 — 두 곳이 갈라지면 보이는 자리와
       저장되는 값이 어긋난다. */
  try{
    const _info = premiumMod.partCatInfo(cat);
    if(_info && premiumMod.isDeskPartCat(_info)){
      const _lift = w=>{ if(w) floorClampWrapper(w, cat); };
      const _main = seat.equippedPartObjs && seat.equippedPartObjs[cat];
      if(_main){ _lift(_main); (_main.userData.multiExtras || []).forEach(_lift); }
      if(seat.stackedPartObjs && seat.stackedPartObjs[cat]){
        const m = seat.stackedPartObjs[cat];
        Object.keys(m).forEach(id=>{ const w = m[id]; if(w){ _lift(w); (w.userData.multiExtras || []).forEach(_lift); } });
      }
    }
  }catch(_){}
}
// wrapper 하나를 씬에서 정리하는 공통 로직 — 파츠 제거 시 공통 처리.
//   unequipPartFromSeat (단일 파츠 카테고리 초기화)와 unequipStackablePart (특정 id만) 양쪽에서 사용.
/* ★ 진행 중이던 비동기 장착을 무효화한다.
   [증상] 꾸미기 창에서 파츠를 넣었다 바로 빼면, 뺀 파츠가 엉뚱한 위치에 유령으로 남는다.
          (나갔다 다시 들어오면 _purgeSeatParts + 재빌드로 정상 복구)
   [원인] equipPartOnSeat은 GLB 파싱(8216)과 본 대기 루프(8286, 최대 3초) 때문에 비동기다.
          그 사이 해제가 일어나도 wrapper가 아직 없어서 지울 게 없고, _equipSeq도 그대로라
          대기가 끝난 낡은 장착이 검사(8218·8288·8398)를 통과해 그대로 부착돼 버린다.
          동물은 스켈레톤 수집이 늦어 대기 루프가 실제로 돌기 때문에 창이 훨씬 넓다.
   [대응] 해제할 때 그 키의 시퀀스를 올려서, 늦게 도착한 장착이 스스로 중단하게 한다.
          _purgeSeatParts(전 키 +1)와 같은 패턴을 좁은 범위에 적용한 것.
   ※ equipPartOnSeat 내부의 해제 호출(8201·8203)은 mySeq 발급(8214)보다 '먼저' 실행되므로
     여기서 올린 값 위에 새 번호가 얹힌다 — 자기 자신을 무효화하지 않는다. */
function _invalidatePendingEquip(seat, cat, id, includeStackable){
  if(!seat || !seat._equipSeq || !cat) return;
  if(id){ const k=cat+':'+id; seat._equipSeq[k]=(seat._equipSeq[k]||0)+1; return; }
  seat._equipSeq[cat]=(seat._equipSeq[cat]||0)+1;                 // non-stackable 키
  if(includeStackable === false) return;                          // stackable은 유지해야 하는 호출
  const pre = cat + ':';
  for(const k in seat._equipSeq){ if(k.indexOf(pre)===0) seat._equipSeq[k]++; }
}
function _disposeWrapperFromSeat(seat, obj){
  if(!obj) return;
  // 런처9 다중 파츠(같은 파츠 여러 개): 추가 인스턴스 wrapper들도 함께 제거
  if(obj.userData && Array.isArray(obj.userData.multiExtras)){
    obj.userData._multiExtrasWas = obj.userData.multiExtras.slice();   // 믹서 정리용으로 잠시 보관
    obj.userData.multiExtras.forEach(ex=>{ try{ if(ex.parent) ex.parent.remove(ex); }catch(_){} });
    obj.userData.multiExtras = [];
  }
  // 반복재생 중이던 믹서 정리 — 다중 파츠 extras의 믹서도 함께(안 그러면 떼어낸 뒤에도 매 프레임 갱신됨)
  _teardownPartIdleAnim(obj);
  if(obj.userData && Array.isArray(obj.userData._multiExtrasWas)) obj.userData._multiExtrasWas.forEach(_teardownPartIdleAnim);
  // 리깅 파츠 해제: 캐릭터 본에 입양시켰던 파츠 본들을 다시 떼어냄
  if(obj.userData && obj.userData.adoptedBones && obj.userData.adoptedBones.length){
    obj.userData.adoptedBones.forEach(b=>{ try{ if(b.parent) b.parent.remove(b); }catch(_){} });
  }
  // 파츠의 ear_L/ear_R가 캐릭터 귀 애니메이션 시스템에 등록돼 있었으면 제거
  if(obj.userData && obj.userData.partEarObjs && obj.userData.partEarObjs.length && seat.bones && seat.bones.ear){
    obj.userData.partEarObjs.forEach(o=>{
      const idx = seat.bones.ear.indexOf(o);
      if(idx>=0){ seat.bones.ear.splice(idx,1); seat.boneRest.ear.splice(idx,1); seat.earTimers = null; }
    });
  }
  if(obj.parent) obj.parent.remove(obj);
}

/* 🧹 유령 파츠 wrapper 청소 — equippedPartObjs / stackedPartObjs 어디에도 등록돼 있지 않은
   '__partWrap_' 노드를 씬에서 제거한다.
   ★ 같은 파츠가 stackable 경로와 non-stackable 경로로 각각 붙으면(카탈로그 동기화로 rec.stackable이
     바뀌는 순간 등) 레이스 가드의 시퀀스 키가 'cat:id' vs 'cat'으로 갈려 둘 다 통과한다.
     해제는 한쪽 경로만 지우므로 나머지가 공중에 남는다("하나 꼈는데 둘, 빼도 하나 남음").
     원인이 무엇이든 등록부를 진실의 원천으로 삼아 쓸어내면 유령이 남지 않는다. */
function _sweepOrphanPartWrappers(seat){
  if(!seat || !seat.group) return;
  const live = new Set();
  const addLive = w=>{
    if(!w) return;
    live.add(w);
    const ex = w.userData && w.userData.multiExtras;
    if(Array.isArray(ex)) ex.forEach(e=>{ if(e) live.add(e); });
  };
  if(seat.equippedPartObjs) for(const c in seat.equippedPartObjs) addLive(seat.equippedPartObjs[c]);
  if(seat.stackedPartObjs) for(const c in seat.stackedPartObjs){
    const m = seat.stackedPartObjs[c]; if(!m) continue;
    for(const id in m) addLive(m[id]);
  }
  const orphans = [];
  const walk = node=>{
    if(!node) return;
    if(node.userData && node.userData.__twPartWrap){
      // ★ equipPartOnSeat가 만든 wrapper만 대상. 이름(__partWrap_)만으로 판단하면
      //   같은 규칙을 쓰는 다른 부속(동물 귀 등)까지 지워 머리 높이 측정이 어긋날 수 있다.
      if(!live.has(node)) orphans.push(node);
      return;   // 파츠 내부로는 더 들어가지 않음
    }
    const kids = node.children; if(!kids) return;
    for(let i=0;i<kids.length;i++) walk(kids[i]);
  };
  walk(seat.group);
  /* 🪑 '책상 위'(bone:'desk') 파츠는 seat.group 이 아니라 seat.deskAnchor 에 붙는다.
     실행 좌석은 책상이 group 안에 있어서 위 순회에 같이 걸리지만, **생성기 미리보기는 책상(cDesk)이
     cBase.group 밖(cScene 직속)에 있어서 통째로 빠졌다** — 그래서 미리보기에서만 책상 위 파츠가
     유령으로 남았다. group 밖에 있을 때만 따로 훑는다(안에 있으면 중복 순회가 된다). */
  if(seat.deskAnchor){
    let under = false;
    for(let p=seat.deskAnchor; p; p=p.parent){ if(p===seat.group){ under = true; break; } }
    if(!under) walk(seat.deskAnchor);
  }
  if(!orphans.length) return;
  orphans.forEach(w=>{ try{ _disposeWrapperFromSeat(seat, w); }catch(_){} });
  console.log('[파츠 정리] 등록되지 않은 유령 wrapper '+orphans.length+'개 제거: '+orphans.map(o=>o.name).join(', '));
}

function unequipPartFromSeat(seat, cat, includeStackable){
  if(!seat) return;
  if(includeStackable === undefined) includeStackable = true;
  // ★ wrapper가 아직 없어도(로딩 중이어도) 반드시 먼저 무효화 — 이게 유령 파츠의 핵심 방어다.
  _invalidatePendingEquip(seat, cat, null, includeStackable);
  // 기존 단일(non-stackable) 카테고리 파츠 제거
  if(seat.equippedPartObjs && seat.equippedPartObjs[cat]){
    _disposeWrapperFromSeat(seat, seat.equippedPartObjs[cat]);
    delete seat.equippedPartObjs[cat];
  }
  // 🔗 stackable로 붙어있던 파츠들도 정리 (기본 true; non-stackable 파츠 교체 시엔 false로 유지)
  if(includeStackable && seat.stackedPartObjs && seat.stackedPartObjs[cat]){
    for(const id in seat.stackedPartObjs[cat]){
      _disposeWrapperFromSeat(seat, seat.stackedPartObjs[cat][id]);
    }
    delete seat.stackedPartObjs[cat];
  }
  _sweepOrphanPartWrappers(seat);   // 등록되지 않은 채 씬에 남은 wrapper까지 확실히 제거
}

// 🔗 stackable 파츠 중 특정 id만 해제 (같은 카테고리의 다른 파츠들은 유지)
function unequipStackablePart(seat, cat, id){
  if(!seat) return;
  _invalidatePendingEquip(seat, cat, id);   // ★ wrapper가 없어도(로딩 중) 무효화가 먼저다
  if(!seat.stackedPartObjs || !seat.stackedPartObjs[cat]) return;
  const wrapper = seat.stackedPartObjs[cat][id];
  if(!wrapper) return;
  _disposeWrapperFromSeat(seat, wrapper);
  delete seat.stackedPartObjs[cat][id];
  if(Object.keys(seat.stackedPartObjs[cat]).length === 0) delete seat.stackedPartObjs[cat];
  _sweepOrphanPartWrappers(seat);
}

/* def.equippedParts({cat:{id,xf}} 또는 {cat:[{id,xf},...]})를 좌석에 모두 반영 */
/* def(장착 목록)에 더 이상 없는 파츠를 좌석에서 걷어내는 공용 정리.
   ★ 카테고리 단위(equippedPartObjs)만 보면 안 됨:
   · 🔗 stackable 파츠는 stackedPartObjs[cat][id]에 개별 저장 → id 단위로 대조해야 "뺀 파츠"가 지워짐
   · 한 카테고리에 stackable만 남고 일반 파츠를 뺀 경우엔 카테고리는 살아있어서 일반 wrapper가 유령으로 남음
   내 캐릭터(commitWdDraft)와 원격 캐릭터(def 수신) 양쪽에서 같이 씀. */
function pruneSeatPartsAgainstDef(seat, def){
  if(!seat) return;
  const eq = (def && def.equippedParts) || {};
  // 1) 일반 파츠: def의 그 카테고리에 "일반(non-stackable) entry"가 하나도 없으면 wrapper 해제
  if(seat.equippedPartObjs){
    Object.keys(seat.equippedPartObjs).forEach(cat=>{
      const hasNormal = premiumMod.entriesForCat(def, cat).some(e=>{
        const id = premiumMod.partEntryId(e);
        // ★ 버그 수정(착용 파츠 증발): 카탈로그 동기화로 savedParts가 막 교체된 직후나 스키마 차이로
        //   rec 조회가 실패할 수 있는데, 예전엔 그걸 "일반 파츠 없음"으로 취급해 wrapper를 지웠다 —
        //   착용 중이던 모자 등이 사라지던 경로. def에 entry가 "있는" 파츠는 정보를 못 찾았다고
        //   지우면 안 됨(prune의 목적은 def에서 "빠진" 파츠 제거) — 조회 실패 시 보수적으로 유지.
        const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat) || premiumMod.savedParts().find(p=>p.id===id);
        if(!rec) return true;   // 조회 실패 = 장착 유지
        return !rec.stackable;
      });
      // ★ includeStackable=false 필수 — 기본값(true)이면 같은 카테고리에 살아있어야 할
      //   🔗 stackable 파츠까지 함께 지워버림. stackable 정리는 아래 2)가 id 단위로 담당.
      if(!hasNormal) unequipPartFromSeat(seat, cat, false);
    });
  }
  // 2) stackable 파츠: def entry 목록에 없는 id는 개별 해제
  if(seat.stackedPartObjs){
    Object.keys(seat.stackedPartObjs).forEach(cat=>{
      const liveIds = premiumMod.entriesForCat(def, cat).map(premiumMod.partEntryId);
      Object.keys(seat.stackedPartObjs[cat]).forEach(id=>{
        if(!liveIds.includes(id)) unequipStackablePart(seat, cat, id);
      });
    });
  }
}

/* 🔎 파츠 장착 진단 경고 — 같은 원인으로 도배되지 않게 세션당 키별 1회만 남긴다.
   [왜 필요한가] 파츠가 안 붙는 경로 둘(카테고리 정보 없음 · 파츠 정보 조회 실패)이 지금까지
   **아무 흔적도 없이** return 했다. 제보는 "눌렀는데 아무 일도 안 일어난다"로만 들어오고,
   콘솔에도 남는 게 없어서 어느 쪽인지 가릴 수가 없었다. 동작은 바꾸지 않는다 — 이름만 붙인다. */
const _equipWarnSeen = new Set();
function _equipWarnOnce(key, msg){
  if(_equipWarnSeen.has(key)) return;
  _equipWarnSeen.add(key);
  try{ console.warn(msg); }catch(_){}
}

async function applyEquippedPartsToSeat(seat, def){
  /* ⚠️ 예전엔 `if(!seat || !def || !def.equippedParts) return;` 한 줄이었다.
       그러면 **꾸미기 파츠가 하나도 없는 캐릭터**는 아래 두 줄(가시성 최종 갱신 + _lastOp 재무장)을
       통째로 건너뛴다. 그 두 줄은 파츠와 무관한 뒷정리인데 파츠 유무에 얹혀 있었다.
     [무엇이 깨지나] 자리비움(opacity 0)으로 숨어 있는 동안 그 좌석이 다시 빌드되면
       (캐릭터 교체·방 def 갱신 등) 새로 만들어진 메시들은 visible=true 인 채로 들어온다.
       그런데 seat._lastOp 가 여전히 0 이라 다음 프레임의 setSeatOpacity(seat, 0) 은
       맨 첫 줄 `if(seat._lastOp===op) return;` 에서 그대로 나가버린다 —
       즉 새 메시에는 숨김도, _prevVisible 기록도 걸리지 않는다.
       파츠가 있는 캐릭터는 아래 `seat._lastOp = null` 덕에 우연히 구제되고 있었을 뿐이다.
     ★ 파츠 순회만 조건부로 두고, 뒷정리 두 줄은 항상 지나가게 한다. */
  if(!seat) return;
  if(def && def.equippedParts) for(const cat in def.equippedParts){
    // 🔗 stackable 지원: entriesForCat로 배열/단일 모두 순회
    const entries = premiumMod.entriesForCat(def, cat);
    for(const entry of entries){
      const id = premiumMod.partEntryId(entry);
      const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat);
      if(rec) await equipPartOnSeat(seat, cat, rec, { stackableXf: rec.stackable ? premiumMod.partEntryXf(entry) : null });
      /* ⚠️ 조회 실패 = 조용한 누락. def 에는 있는데 화면에는 안 붙고, 흔적도 안 남는다.
         ★ 여기 조회는 **(id, cat) 둘 다 일치**를 요구하는데, pruneSeatPartsAgainstDef 의 같은
           조회는 `|| savedParts.find(p=>p.id===id)` 로 id 만으로도 한 번 더 찾는다(그쪽 주석 참고).
           즉 **두 함수가 같은 파츠를 다르게 판정할 수 있다** — prune 은 "있다"고 보고 유지하는데
           여기서는 "없다"고 보고 안 붙이면, 그 파츠는 def 에 남은 채 영영 화면에 안 나온다.
           그게 지금 제보(적용 안 됨)의 모양과 정확히 같다.
         🔴 폴백을 여기에도 넣는 것이 후보 수정이지만, 실제로 cat 불일치가 나는지 확인되기 전에는
           넣지 않는다. 아래 경고가 한 번이라도 뜨면 그때 넣는다 — 그 판단 근거가 이 줄이다. */
      else _equipWarnOnce('rec:'+cat+':'+id,
        '[파츠] 파츠 정보를 못 찾아 장착을 건너뜁니다 — cat=' + cat + ' id=' + id
        + ' / id 만으로 찾으면: ' + (premiumMod.savedParts().find(p=>p.id===id) ? ('있음(cat=' + premiumMod.savedParts().find(p=>p.id===id).cat + ')') : '없음'));
    }
  }
  applyClothVisibility(seat);   // 모두 반영 후 가시성 최종 갱신
  seat._lastOp = null;
}


/* ============================================================ CREATOR + LAUNCHER */
/* 🧍 캐릭터 저장 슬롯 개수. 3 → 5 (요청).
   ★ 여기 하나만 고치면 되도록 아래 네 곳(loadSlots 순회 · 런처 (n/N) 라벨 · ◀▶ 순환)이
     전부 이 상수를 본다. 숫자를 다시 흩뿌리지 말 것 — 한 곳만 빠뜨리면 "칸은 보이는데
     저장이 안 되는" 종류의 사고가 난다.
   ⚠️ 옛 저장값(3칸)과의 호환: loadSlots 는 `arr[i]` 가 없으면 그 칸을 건너뛰므로 4·5번 칸이
     null 로 남는다(패딩됨). 반대로 5칸으로 저장된 값을 옛 판본이 읽어도 앞 3칸만 읽고 지나간다.
     즉 양방향 모두 안전하다.
   ⚠️ extraSeatSlots(솔로모드 자리추가)는 슬롯 번호 목록이라 자동으로 최대 4석까지 늘어난다.
     layoutSeats 는 인원 수 상한이 없고(방은 이미 10명) 간격·줌을 실측으로 잡으므로 그대로 돈다. */
const CHAR_SLOT_MAX=5;
const slots=new Array(CHAR_SLOT_MAX).fill(null);
/* 🛡️ [얼굴 영구 소실 방어 · 기억] 칸마다 «이 캐릭터는 그림을 가진 적이 있다».
   켜지는 곳은 둘뿐이다 — loadSlots(부팅에 그림이 있었다) · saveSlots(멀쥰한 그림을 저장했다).
   꺼지는 곳은 하나뿐이다 — 생성기에서 사용자가 «비운 채 저장»을 직접 확인했을 때.
   이 값이 true 인 칸에 빈 그림이 저장되려 하면 그건 사용자의 뜻이 아니라 사고다. */
const _faceEverDrawn  = new Array(CHAR_SLOT_MAX).fill(false);
const _blinkEverDrawn = new Array(CHAR_SLOT_MAX).fill(false);
let _blankFaceConfirmed = false;   // 생성기에서 «비운 채 저장»을 확인한 직후, 바로 뒤 saveSlots 1회만 소비
const CUR_SLOT_KEY='tw.curSlot';
function _loadCurSlot(){ try{ const v=parseInt(localStorage.getItem(CUR_SLOT_KEY),10); if(v>=0&&v<CHAR_SLOT_MAX) return v; }catch(e){} return 0; }
function saveCurSlot(){ try{ localStorage.setItem(CUR_SLOT_KEY, String(curSlot)); }catch(e){} }
let curSlot=_loadCurSlot(), editingSlot=-1, pendingSlot=0;
let cTopColor='#9dba8a', cBotColor='#d98e73';
const CANVAS_SZ=512;
const FACE_SYM_SUM=0.36;                 // 얼굴 UV 좌우 대칭축(u0≈0.18) → 미러 u' = 0.36 - u
const SYM_PX=FACE_SYM_SUM*CANVAS_SZ;     // 픽셀 기준 미러 합
function newCanvas(){const c=document.createElement('canvas');c.width=c.height=CANVAS_SZ;return c;}
/* 🛡️ [얼굴 영구 소실 방어 · 판정] 그림 레이어가 **완전히 비었는지** 싸게 본다.
   [경위] 제보 — 아무것도 안 건드렸는데 실행 중에 얼굴이 사라지고, 꺼다 켜도 그대로였다.
     def.face 는 살아 있는 캔버스라 loadSlots 의 _imgBroken 표식이 붙지 않고,
     _slotImgToDataUrl 은 «캔버스냐»만 보지 «비었냐»는 안 봤다. 그래서 런타임에 내용이 날아간
     캔버스가 두 검사를 다 통과해 **빈 PNG 로 굳어 원본을 덮었다.** 그게 영구 소실의 마지막 구멍이다.
   ★ 512² 를 통째로 getImageData 하면 1MB 를 읽는다 — saveSlots 는 슬라이더를 끄는 동안
     계속 불린다. 32² 로 줄여 그린 뒤 알파만 훑는다(1/256 비용).
     축소는 «평균»이라 1px 선 하나도 알파가 0 이 되지 않는다 — 얇은 그림을 비었다고 오판하지 않는다.
   ★ 판정할 수 없으면(캔버스가 아님·오염된 캔버스 등) **false** 를 돌려준다.
     이 함수의 true 에는 저장을 막는 힘이 있으므로, «모르겠으면 비지 않았다» 쪽이 안전하다. */
const _BLANK_PROBE_SZ=32;
let _blankProbeCv=null;
function _isBlankDraw(cv){
  try{
    if(!cv || typeof cv.getContext!=='function' || !cv.width || !cv.height) return false;
    if(!_blankProbeCv){ _blankProbeCv=document.createElement('canvas'); _blankProbeCv.width=_blankProbeCv.height=_BLANK_PROBE_SZ; }
    const x=_blankProbeCv.getContext('2d',{willReadFrequently:true});
    x.clearRect(0,0,_BLANK_PROBE_SZ,_BLANK_PROBE_SZ);
    x.drawImage(cv,0,0,_BLANK_PROBE_SZ,_BLANK_PROBE_SZ);
    const d=x.getImageData(0,0,_BLANK_PROBE_SZ,_BLANK_PROBE_SZ).data;
    for(let i=3;i<d.length;i+=4) if(d[i]!==0) return false;
    return true;
  }catch(_){ return false; }
}
function snapCanvas(src){const c=newCanvas();c.getContext('2d').drawImage(src,0,0);return c;}
/* 피부색 5종 — skin[0]은 face1.png(기본), 1~4는 skin-data.js의 window.SKIN_PNGS PNG 텍스처. 로드는 loadSkins()에서 */
const SKIN_COLORS=['#FFE0BD','#F1C898','#E0AC69','#C68642','#8D5524'];
const skinCanvases=SKIN_COLORS.map(c=>{const cv=newCanvas();const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,CANVAS_SZ,CANVAS_SZ);return cv;});
function skinCanvasFor(i){return skinCanvases[i]||skinCanvases[0];}
function skinColorFor(i){return SKIN_COLORS[i]||SKIN_COLORS[0];}
/* 베이스 피부 텍스처 위에 그림 레이어를 얹어 한 장으로 합성(지워도 피부는 남음) */
/* ⚠️ 아래 okType 가드는 **크래시 방지지 수정이 아니다.** 그림 레이어가 없으면 피부만 칠하고
   넘어가므로 화면에는 "얼굴이 지워지고 피부색만 남은" 상태가 나온다 — 제보로 들어온 그 증상이
   바로 이 줄의 결과다. 그래서 조용히 넘어가지 않고 한 번은 콘솔에 남긴다(같은 세션에서 도배되지
   않게 1회). 진짜 고칠 곳은 여기가 아니라 def.face 가 비는 경로(loadSlots / deserializeDefFromNetwork)다. */
let _faceSkipWarned = false;
function compositeFace(skinIdx,drawCv){const cv=newCanvas();const x=cv.getContext('2d');x.drawImage(skinCanvasFor(skinIdx),0,0);
  const okType = drawCv instanceof HTMLCanvasElement || drawCv instanceof HTMLImageElement;
  if(okType) x.drawImage(drawCv,0,0);   // 문자열(dataURL 복원 실패 등) 등 잘못된 값이면 건너뜀 — 스킨만이라도 정상 표시(크래시 방지)
  else if(!_faceSkipWarned){
    _faceSkipWarned = true;
    console.warn('[얼굴] 그림 레이어가 캔버스/이미지가 아니라 건너뜁니다 — 피부색만 보입니다. 받은 값:',
      Object.prototype.toString.call(drawCv), drawCv);
  }
  return cv;}
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
  // 🐾 동물 캐릭터 — animal.js가 전담 조립(전신 페인트 텍스처·귀 포함). 실패(모듈 미로드 등) 시 인간 폴백.
  if(def && def.animal && typeof window.buildAnimalBase==='function'){
    const ab=window.buildAnimalBase(def);
    if(ab) return ab;
  }
  const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
  const inst=instantiateBase(customScene);
  if(inst){
    setFaceMap(inst.faceMat, fT);
    if(!def.isCommission){
      if(inst.upMat)inst.upMat.color.set(def.top); if(inst.loMat)inst.loMat.color.set(def.bot);
      if(inst.hatMat&&inst.hatMat.color)inst.hatMat.color.set(def.top);   // 🎩 기본 모자는 상의색을 따라감
    }
    applyLightPresetToInstance(inst);   // 생성기·메인과 같은 톤(emissive)
    normalizeModel(inst.root, 1.4, def.isCommission);
    _attachHumanEars(inst.root, def);
    const wrap=new THREE.Group(); wrap.add(inst.root);
    // ★ upMesh/loMesh/glassesMesh 등(꾸미기 파츠 장착 시 베이크된 메쉬를 자동으로 숨기는 데 필요한 참조)이
    //   지금까지 반환값에서 빠져있었음 — 이 함수를 쓰는 쪽(꾸미기 미리보기 등)에서 applyClothVisibility가
    //   아무 메쉬도 못 찾아서 옷이 안 사라지던 근본 원인. inst가 이미 갖고 있는 값을 그대로 같이 반환함.
    return {group:wrap, root:inst.root, faceMat:inst.faceMat, upMat:inst.upMat, loMat:inst.loMat, fT, bT,
      faceMesh:inst.faceMesh, upMesh:inst.upMesh, loMesh:inst.loMesh, glassesMesh:inst.glassesMesh,
      hatMesh:inst.hatMesh, hatMat:inst.hatMat, maskMesh:inst.maskMesh, onepieceMesh:inst.onepieceMesh, wingMesh:inst.wingMesh,
      handLMesh:inst.handLMesh, handRMesh:inst.handRMesh, capeMesh:inst.capeMesh};
  }
  // 폴백: 내장 스탠드인
  const b=buildCreatorBase(fT,bT,skinColorFor(def.skin),def.top,def.bot);
  return {group:b.group, root:b.group, faceMat:b.faceMat, fT, bT};
}

/* --- 캐릭터에 직접 페인팅 (3D) + 단계형 + 양파껍질 + 되돌리기 --- */
const faceC=newCanvas(), blinkC=newCanvas();      // 저장 레이어(깨끗한 원본)
const dispC=newCanvas();                          // 모델에 보이는 합성 텍스처(양파껍질 포함)
const dispTex=new THREE.CanvasTexture(dispC); dispTex.flipY=false;dispTex.encoding=THREE.sRGBEncoding;
let crStep=1, creatorMode={kind:'slot',edit:false}, brushColor='#333333', brushSize=11, eraser=false, blinkEdited=false, skinIndex=0;
let currentCreatorDef = null;   // openCreator로 들어온 원본 def — 커미션 여부 판정에 사용
function isCommissionEditing(){ return !!(currentCreatorDef && currentCreatorDef.isCommission); }
function isAnimalEditing(){ return !!(currentCreatorDef && currentCreatorDef.animal); }
function isDeskSeatOnly(){ return isCommissionEditing() || isAnimalEditing(); }   // 페인트 단계 없이 책상·좌석만 하는 캐릭터
/* 🐾 동물 편집 길잡이(animal-edit-route.js) — 모양은 동물 생성기, 책상·좌석은 여기 5·6단계.
   모듈이 없으면(검사가 app.js 만 평가할 때 등) null — gotoStep · openCreator 가 예전처럼 책상부터 연다. */
const _editRoute = (typeof window!=='undefined' && window.AnimalEditRoute) || null;
/* 사람 생성기를 닫고 지금 편집 중인 동물을 동물 생성기로 연다(같은 슬롯·좌석 — creatorMode 를 animal.js 가 읽는다).
   tab: 동물 생성기에서 처음 보일 탭 — 책상에서 돌아갈 땐 마지막(감은눈), 처음 들어갈 땐 얼굴. */
function reopenAnimalFromCreator(tab){
  const def=currentCreatorDef;
  document.getElementById('creatorOverlay').classList.remove('on'); creatorOpen=false;
  if(typeof window.reopenAnimalCreator==='function'){ window.reopenAnimalCreator(def, {tab}); return true; }
  return false;
}
/* 🪑 책상 크기 슬라이더의 **기본값** — 흩어져 있던 0.175 리터럴의 단 하나의 출처.
   [왜 상수가 필요해졌나] '책상 위' 파츠가 이 슬라이더를 따라 커지고 작아지는 것을 끊으면서
     "무엇을 기준으로 안 따라가는가"를 정해야 했다. 답이 이 값이다 — 슬라이더가 기본값일 때가
     파츠 크기의 기준이고, 거기서 움직인 몫만 syncDeskPartAnchor 가 상쇄한다.
     그래서 이 값이 흔들리면 **파츠 크기의 기준 자체가 흔들린다.** 리터럴로 흩어 두면 안 된다.
   ⚠️ HTML 슬라이더(`#deskScale` 의 `value="0.175"`)와 **같은 값이어야 한다.** 거기는 마크업이라
     이 상수를 못 읽는다 — 바꿀 때 두 곳을 같이 본다(HTML 쪽에도 이 주석을 걸어 뒀다).
   ⚠️ 슬라이더 범위(DESK_SCALE_MIN·MAX)는 clampDeskScale 옆에 따로 있다. 이 값은 그 사이여야 한다. */
const DESK_SCALE_DEFAULT = 0.175;
let cXform={s:0.7,y:0,z:0,rot:0}, cDeskColor='#c9a36a', cDeskScale=DESK_SCALE_DEFAULT, cDeskLenX=1;
/* 🪑 책상 위치 오프셋(생성기 세션). 저장은 def.deskPos — 전부 0 이면 아예 저장하지 않는다
   (기존 캐릭터 데이터에 없던 필드라, 0 을 굳이 적어 넣으면 옛 저장분과 모양이 갈린다). */
let cDeskPos = {x:0, y:0, z:0};   // 좌석 변형 · 책상 색 · 커스텀 책상 크기 · 책상 길이(X)

// ★ 런처3-2: 책상+좌석 세팅 프리셋 (5슬롯, 전 캐릭터 슬롯 공용, localStorage 'tw.deskPresets').
//   저장: 지금 생성기의 책상 관련 상태 + 좌석 xf(크기/앞뒤/회전) 통째로.
//   불러오기: 클릭한 프리셋을 지금 편집 중인 캐릭터에 적용 (책상/좌석 세팅 4·5단계 값 한 번에).
const PRESET_KEY = 'tw.deskPresets';
function loadDeskPresets(){
  try{ const arr = JSON.parse(localStorage.getItem(PRESET_KEY)||'[]');
       return Array.isArray(arr) ? arr.slice(0,5).concat([null,null,null,null,null]).slice(0,5) : [null,null,null,null,null];
  }catch(_){ return [null,null,null,null,null]; }
}
function saveDeskPresets(arr){ try{ localStorage.setItem(PRESET_KEY, JSON.stringify(arr.slice(0,5))); }catch(_){} }
function captureDeskPreset(){
  // 지금 생성기의 실제 상태로부터 프리셋 페이로드 생성
  const p = {
    // 책상
    deskColor: cDeskColor,
    deskScale: cDeskScale,
    deskLenX: cDeskLenX,
    deskPos: {x:cDeskPos.x, y:cDeskPos.y, z:cDeskPos.z},
    deskCatalogId: activeCustomDeskId || null,
    deskGlb: (activeCustomDeskId && cDeskGlbB64) ? cDeskGlbB64 : null,
    deskItems: cBase ? collectDeskItems(cBase) : null,
    // 커스텀 아이템(카탈로그에 없는 로컬 등록분)도 함께 — 다른 슬롯에서 불러올 때 참조가 살아있게
    customItems: (function(){ const ci={}; Object.keys(customItems).forEach(id=>{ const c=customItems[id]; ci[id]={name:c.name, glb:c.glb}; }); return Object.keys(ci).length?ci:null; })(),
    // 좌석 (편집 도중이라 cXform 참조 — 슬라이더/스와치와 동일한 값)
    // 🧍 z(앞뒤) → y(높이). 옛 프리셋의 z 는 로드 쪽에서 무시한다.
    seat: { s:cXform.s, y:clampCharY(cXform.y), rot:cXform.rot },
    ts: Date.now(),
  };
  return p;
}
// ★ 런처3-2 후속: 프리셋 로드 후 미리보기 렌더 갱신 — 책상 크기 변화가 화면에 반영되려면 카메라
//   프레이밍도 재계산해야 함(fit는 캐릭터 기준, frameDeskCam은 책상까지 포함해 카메라 거리 조정).
function _refitPreviewAfterPreset(){
  try{
    fitCreator(crStep<=4 ? 'edit' : 'app');
    if((crStep===5||crStep===6)) frameDeskCam(false);
  }catch(_){}
}
function applyDeskPreset(p){
  if(!p || !cBase){ toast('먼저 캐릭터를 선택해 주세요'); return; }
  // 런처3-2 후속: 프리셋 로드 시 이전 카메라 상태 초기화 — 안 그러면 5·6단계 재진입 시 옛 책상 기준으로
  //   저장된 카메라 위치가 복원돼서 새 책상 크기와 어긋난 프레이밍이 보임(요청사항: 미리보기 크기 안 맞음).
  deskCamSaved = null;
  // 1) 좌석 세팅 적용 (슬라이더 값 + 즉시 반영)
  if(p.seat){
    if(typeof p.seat.s==='number')   { cXform.s   = p.seat.s;   const el=document.getElementById('crScale'); if(el) el.value=p.seat.s; }
    /* 🧍 높이 — #crZ 가 이제 높이 슬라이더다. 옛 프리셋의 p.seat.z(앞뒤)는 폐기된 값이라 읽지 않는다
       (읽으면 앞뒤로 맞춰둔 옛 숫자가 그대로 '높이' 로 해석돼 캐릭터가 공중에 뜬다). */
    if(typeof p.seat.y==='number')   { cXform.y   = clampCharY(p.seat.y); const el=document.getElementById('crZ'); if(el) el.value=cXform.y; }
    if(typeof p.seat.rot==='number') { cXform.rot = p.seat.rot; const el=document.getElementById('crRot');   if(el) el.value=p.seat.rot; }
    applyCreatorXform();
  }
  // 2) 커스텀 아이템 카탈로그(세션) 병합 — 프리셋이 참조하는 로컬 아이템이 있으면 함께 복원
  if(p.customItems) Object.keys(p.customItems).forEach(id=>{
    /* 🪑 [제보 2] 예전엔 licenseOnly:false 를 **명시로 박았다.** 프리셋 payload(captureDeskPreset)는
       {name, glb} 만 담으므로 그 false 가 그대로 남아 equipDeskItem 의 게이트가 통째로 안 걸렸다.
       원본은 카탈로그 레코드(savedItems)다 — 없으면 false 지만, 그때는 아래 정리가 다시 본다. */
    if(!customItems[id]){
      let _si=null; try{ _si=commissionMod.savedItems(); }catch(_){}
      const _rec = (_si && _si.find) ? _si.find(s=>s.id===id) : null;
      customItems[id] = Object.assign({id, cat:'item', deskItem:true, licenseOnly:!!(_rec && _rec.licenseOnly)}, p.customItems[id]);
    }
  });
  // 3) 책상 색/크기/길이 (슬라이더/스와치도 갱신)
  if(typeof p.deskColor==='string'){
    cDeskColor = p.deskColor;
    const el=document.getElementById('deskColor'); if(el){ el.value=cDeskColor; el.dispatchEvent(new Event('input',{bubbles:true})); }
    if(cDeskMat) cDeskMat.color.set(cDeskColor);
    applyDeskColorToCustom(cDesk, cDeskColor);
  }
  if(typeof p.deskScale==='number'){ cDeskScale=clampDeskScale(p.deskScale); const el=document.getElementById('deskScale'); if(el) el.value=cDeskScale; setCreatorDeskScale(cDeskScale); }
  if(typeof p.deskLenX==='number'){  cDeskLenX=p.deskLenX;  const el=document.getElementById('deskLenX');  if(el) el.value=cDeskLenX;  setCreatorDeskScale(cDeskScale); }
  if(p.deskPos && typeof p.deskPos==='object'){ cDeskPos={x:+p.deskPos.x||0, y:+p.deskPos.y||0, z:+p.deskPos.z||0}; setDeskPos(cDesk, cDeskPos); updateDeskPosNum(); }
  // 4) 책상 모델(카탈로그 id or GLB)
  const applyDeskModel = ()=>{
    // 현재 아이템 전부 제거 (프리셋의 아이템으로 교체)
    if(cBase){ allDeskItems().forEach(def=>{ if(cBase.deskItems && cBase.deskItems[def.id]) equipDeskItem(cBase,def,false); }); }
    // 프리셋에 아이템 복원
    if(p.deskItems && cBase) applyDeskItemsTo(cBase, p.deskItems);
    autoSaveDeskItemsNow();
  };
  /* 🪑 [제보 2] 프리셋에 남은 라이선스 전용 책상 — 여기서 막지 않으면 activeCustomDeskId 가 서고,
     crDone 이 그것을 def.deskCatalogId 로 굳힌다(생성기 진입 26733 이 애써 떨어뜨린 것이 되살아난다).
     라이선스가 없으면 아래 else 로 떨어져 기본 책상으로 열린다 — 프리셋 자체는 그대로 남는다. */
  const _presetDeskLocked = (!isPremium && !isAdmin) && premiumMod._licenseLockedDeskId(p.deskCatalogId);
  if(p.deskCatalogId && p.deskGlb && !_presetDeskLocked){
    assetCodeMod.parseGlbBytes(b64ToBuf(p.deskGlb)).then(sc=>{
      cDeskTemplate=sc; cDeskGlbB64=p.deskGlb; activeCustomDeskId=p.deskCatalogId;
      const isDefaultOverride = (p.deskCatalogId === DEFAULT_DESK_OVERRIDE_ID);
      if(cDesk){ swapDeskVisual(cDesk, sc, isDefaultOverride); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
      applyDeskModel();
      _refitPreviewAfterPreset();
    }).catch(()=>{ toast('프리셋의 책상 모델을 불러오지 못했어요'); applyDeskModel(); _refitPreviewAfterPreset(); });
  } else {
    cDeskTemplate=null; cDeskGlbB64=null; activeCustomDeskId=null;
    // ★ 런처3-2 후속(진짜 원인): "기본 책상"으로 저장된 프리셋을 로드할 때 하드코딩 내장 책상을 보여주고
    //   있었는데, 생성기 재진입·실행 화면은 관리자가 등록한 기본 책상 오버라이드(__default_desk__)를 보여줌 —
    //   모델 자체가 달라서(단위 폭 3.0 vs 5.33) 미리보기만 캐릭터/아이템이 커 보이던 원인.
    //   재진입 로직과 동일하게 오버라이드가 있으면 그걸 표시.
    const ov = commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
    if(ov){
      (async ()=>{
        if(!ov.glb && ov.glbUrl){
          try{ await resolveCatalogGlb(ov); }catch(_){}
        }
        try{
          const sc = await assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb));
          if(cDesk){ swapDeskVisual(cDesk, sc, true); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
        }catch(_){
          if(cDesk){ swapDeskVisual(cDesk, null); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
        }
        applyDeskModel();
        _refitPreviewAfterPreset();
      })();
    } else {
      if(cDesk){ swapDeskVisual(cDesk, null); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
      applyDeskModel();
      _refitPreviewAfterPreset();
    }
  }
  renderDeskPresetSlots();   // 저장 시각/썸네일 갱신
  toast('프리셋을 불러왔어요');
}
function renderDeskPresetSlots(){
  const box=document.getElementById('crPresetSlots'); if(!box) return;
  const arr=loadDeskPresets();
  box.innerHTML='';
  for(let i=0;i<5;i++){
    const p=arr[i]||null;
    const btn=document.createElement('button');
    btn.type='button';
    btn.style.cssText='flex:1;padding:8px 6px;font-size:12px;cursor:pointer;'
      + 'background:'+(p?'#fff':'#eee')+';border:1px solid;border-color:#888 #ddd #ddd #888;'
      + 'color:'+(p?'#333':'#888')+';';
    btn.textContent = (i+1) + (p?' ✓':'');
    btn.title = p ? ('클릭 = 불러오기 / 우클릭 = 덮어쓰기·삭제  (저장 시각: '+new Date(p.ts).toLocaleString()+')')
                  : ('빈 슬롯 — 우클릭해서 지금 세팅을 여기 저장');
    btn.onclick = ()=>{
      if(!p) return toast('빈 슬롯이에요 — 우클릭해서 지금 세팅을 저장할 수 있어요');
      applyDeskPreset(p);
    };
    btn.oncontextmenu = ev=>{
      ev.preventDefault();
      const menu=document.createElement('div');
      menu.className='cr-preset-ctx';   // 팝업 outside-close에서 예외 처리하려고
      const rect=btn.getBoundingClientRect();
      menu.style.cssText='position:fixed;z-index:9999;background:var(--win-face);'
        +'border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
        +'box-shadow:2px 2px 4px rgba(0,0,0,.3);padding:4px 0;font-size:11px;min-width:130px;'
        +'left:'+ev.clientX+'px;top:'+ev.clientY+'px;';
      const mk=(label, fn)=>{ const it=document.createElement('div'); it.textContent=label;
        it.style.cssText='padding:5px 10px;cursor:pointer;color:var(--ink);';
        it.onmouseenter=()=>it.style.background='var(--win-select)'; it.onmouseleave=()=>it.style.background='';
        it.onclick=()=>{ fn(); menu.remove(); document.removeEventListener('mousedown', closer, true); };
        menu.appendChild(it); };
      mk(p?'💾 이 슬롯에 덮어쓰기':'💾 지금 세팅을 여기 저장', ()=>{
        if(!cBase){ toast('먼저 캐릭터를 선택해 주세요'); return; }
        const cur=loadDeskPresets(); cur[i]=captureDeskPreset(); saveDeskPresets(cur);
        renderDeskPresetSlots(); toast('프리셋 '+(i+1)+'번에 저장했어요');
      });
      if(p) mk('🗑 이 슬롯 비우기', ()=>{
        const cur=loadDeskPresets(); cur[i]=null; saveDeskPresets(cur);
        renderDeskPresetSlots(); toast('프리셋 '+(i+1)+'번을 비웠어요');
      });
      document.body.appendChild(menu);
      const closer=(e)=>{ if(!menu.contains(e.target)){ menu.remove(); document.removeEventListener('mousedown', closer, true); } };
      setTimeout(()=>document.addEventListener('mousedown', closer, true), 0);
    };
    box.appendChild(btn);
  }
}
// 생성기 진입 시 UI 그림
(function _initDeskPresetBar(){
  function bind(){
    renderDeskPresetSlots();
    const btn=document.getElementById('crPresetBtn'), pop=document.getElementById('crPresetPopup');
    if(!btn || !pop || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const open = pop.style.display !== 'none';
      pop.style.display = open ? 'none' : 'block';
      if(!open) renderDeskPresetSlots();   // 열 때마다 최신 상태로
    });
    document.addEventListener('mousedown', e=>{
      if(pop.style.display==='none') return;
      if(pop.contains(e.target) || e.target===btn) return;
      // 우클릭 메뉴(뜬 상태에서 슬롯 우클릭 → contextmenu에서 열림)는 유지 — 그 안 클릭 시 자동 닫힘 신경 X
      if(e.target.closest && e.target.closest('.cr-preset-ctx')) return;
      pop.style.display='none';
    }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();
// ★ 책상 크기 슬라이더의 실제 min/max — HTML의 #deskScale range와 반드시 같은 값으로 맞춰야 함.
//   슬라이더 범위를 바꾼 적이 있어서, 그 이전 범위 기준으로 저장된 캐릭터의 deskScale이 새 범위를
//   벗어나 있을 수 있음(예: 옛날엔 0.34가 정상 범위였는데 지금은 최대 0.3) — 그대로 슬라이더에 넣으면
//   브라우저가 슬라이더 표시만 최대치로 잘라버려서 슬라이더가 이상하게 고정된 것처럼 보임.
//   그래서 불러올 때마다 이 범위로 확실히 clamp함.
const DESK_SCALE_MIN = 0.05, DESK_SCALE_MAX = 0.3;
function clampDeskScale(v){ return Math.max(DESK_SCALE_MIN, Math.min(DESK_SCALE_MAX, v)); }
let faceCamSaved=null;   // 1~3단계(피부/표정/감은눈) 카메라 각도 유지용
let deskCamSaved=null;   // 5~6단계(책상/좌석) 카메라 각도 유지용
let painting=false, lastPX=null, lastPY=null, lastSX=null, lastSY=null, symmetry=false;
/* 🖌 칠하기 도구(붓 · 페인트통 · 지우개 — paint-tools.js). 아래 도구 줄을 만들 때 채운다. 없으면(모듈 누락) 붓만. */
let crPaintTool=null;
function _crDropEraser(){ if(crPaintTool) crPaintTool.dropEraser(); else eraser=false; }
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
  _mo.copy(_mp).addScaledVector(_mn, (off>0?off:0.6));
  _mdir.copy(_mn).negate();                               // 표면 쪽으로
  _mray.set(_mo,_mdir);
  if(castFn){ const hh=castFn(_mray.ray, mesh); return (hh&&hh.uv)?{x:hh.uv.x,y:hh.uv.y}:null; }
  const h=_mray.intersectObject(mesh,false);
  if(h.length&&h[0].uv) return {x:h[0].uv.x,y:h[0].uv.y};
  return null; }
function mirrorUV(hit){ if(!cBase||!cBase.face)return null;
  /* 🩹 [2026-10-02] 대칭 되쏘기도 지금 자세로 맞힌다 — 얼굴이 리깅이라 기본 캐스트는 바인드 포즈를 맞혔다(_stampFaceHit 주석). */
  return mirrorUVOn(hit, cBase.face, cCam, cBase.faceCx||0, (ray, mesh)=>partPaintMod._picIntersect(ray,[mesh])); }
function strokeSeg(ctx,lx,ly,x,y){ if(lx==null)_seg(ctx,x,y,x+0.01,y+0.01); else _seg(ctx,lx,ly,x,y); }
/* 🩹 [2026-10-02 제보 #12] «캐릭터 생성 때 머리 윗부분은 끝까지 칠해도 되는데, 수염을 그리려고 아래쪽을 칠하면 튀어서 제멋대로 그려진다»
   [원인] 생성기 칠하기는 얼굴 메쉬 **하나만** 맞히고 직전 점과 이번 점을 텍스처 위에서 직선으로 이었다.
     ① 가려짐을 안 봤다 — 턱 밑·목 쪽 얼굴 메쉬는 몸통·옷에 가려 안 보이는데도 광선이 그대로 맞혀서, 화면엔 옷 위를
        칠하는데 안 보이는 목 UV 에 찍혔다.
     ② 솔기를 안 봤다 — 턱 아래 UV 솔기를 건너면 텍스처를 가로지르는 긴 직선이 그어졌다.
     머리 위쪽은 실루엣을 넘으면 그냥 빗나가(miss) 획이 끊기므로 멀쩡했다 — 그래서 «아래쪽만» 이다.
   [대응] 꾸미기 파츠 그리기(_wdPic)가 이미 검증한 세 가지를 그대로 쓴다.
     · 앞면만: 뒷면(dot ≥ 0)에 맞은 것은 버린다(_picIntersect 와 같은 규칙).
     · 가려짐: 옷(윗옷·아래옷·한벌옷)이 얼굴보다 앞에서 맞으면 거기서 획을 끊는다.
     · 솔기: 3D 이동량 대비 UV 가 설명 못 할 만큼 뛰면 잇지 않고 끊는다(_wdPicPaint 의 allow 식 그대로).
     · 빠른 움직임 쪼개기: 화면 경로를 몇 px 단위로 나눠 각 지점을 따로 맞힌다(_wdPicStrokeTo 와 같은 상수).
   ⚠️ 가려짐 판정에 모자·안경·탈은 넣지 않는다 — 얼굴 위에 얹는 파츠라 그 아래를 칠하려는 경우가 있다.
   ⚠️ 스포이드·도장은 손대지 않는다(이번 증상과 무관). */
let _pLastScr = null, _pLastUV = null, _pLastPt = null, _pLastSUV = null;
function _paintBreak(){ lastPX=lastPY=null; lastSX=lastSY=null; _pLastUV=null; _pLastPt=null; _pLastSUV=null; }
function _paintHitAt(clientX, clientY){
  const cv=document.getElementById('creatorPreview'); if(!cv || !cBase || !cBase.face) return null;
  const r=cv.getBoundingClientRect();
  _pndc.x=((clientX-r.left)/r.width)*2-1; _pndc.y=-((clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,cCam);
  /* 🩹 얼굴·옷 모두 리깅이라 지금 자세로 맞힌다(_picIntersect — 앞면만). 기본 캐스트는 바인드 포즈라 아래쪽이 어긋났다. */
  const hit=partPaintMod._picIntersect(_pray.ray, [cBase.face]);
  if(!hit || !hit.uv) return null;
  hit.distance = _pray.ray.origin.distanceTo(hit.point);
  const occ=[cBase.upMesh, cBase.loMesh, cBase.onepieceMesh];
  /* ⚠️ 같은 장면에 붙어 있는 옷만 본다 — 동물 생성기로 바뀌면 cBase.face 만 동물 것으로 바뀌고 옷 참조는 옛 사람
     인스턴스를 가리킬 수 있다(장면에서 떼어진 메쉬). 그 낡은 위치에 맞으면 엉뚱하게 칠이 막힌다. */
  let _fr=cBase.face; while(_fr.parent) _fr=_fr.parent;
  for(let i=0;i<occ.length;i++){
    const o=occ[i]; if(!o || o === cBase.face) continue;
    let vis=true, q=o, root=o; for(;q;q=q.parent){ if(q.visible===false){ vis=false; break; } root=q; }
    if(!vis || root !== _fr) continue;
    const oh=partPaintMod._picIntersect(_pray.ray, [o]);
    if(oh && oh.point && _pray.ray.origin.distanceTo(oh.point) < hit.distance - 1e-3) return null;   // 옷이 앞에 있다 — 안 보이는 곳이다
  }
  return hit;
}
function paintAt(hit){ const ctx=actC().getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=brushSize;
  ctx.globalCompositeOperation=eraser?'destination-out':'source-over';ctx.strokeStyle=brushColor;
  const cx=hit.uv.x*CANVAS_SZ, cy=hit.uv.y*CANVAS_SZ;
  /* 🧵 솔기 판정(_wdPicPaint 와 같은 식) — 천장 0.25 까지 그대로. */
  const wD=(_pLastPt && hit.point) ? _pLastPt.distanceTo(hit.point) : 0;
  const allow=Math.min(0.25, wD * partPaintMod._wdPicUvScale(hit.object) * 4 + 0.02);
  if(_pLastUV && Math.hypot(hit.uv.x-_pLastUV.x, hit.uv.y-_pLastUV.y) > allow){ lastPX=lastPY=null; }
  strokeSeg(ctx,lastPX,lastPY,cx,cy); lastPX=cx; lastPY=cy;
  _pLastUV={x:hit.uv.x, y:hit.uv.y};
  if(hit.point){ if(!_pLastPt) _pLastPt=new THREE.Vector3(); _pLastPt.copy(hit.point); }
  if(symmetry){ const m=mirrorUV(hit);
    if(m){
      const mj=!!(_pLastSUV && Math.hypot(m.x-_pLastSUV.x, m.y-_pLastSUV.y) > allow);
      const mx=m.x*CANVAS_SZ, my=m.y*CANVAS_SZ; strokeSeg(ctx,mj?null:lastSX,mj?null:lastSY,mx,my); lastSX=mx; lastSY=my; _pLastSUV={x:m.x,y:m.y};
    }
    else { lastSX=lastSY=null; _pLastSUV=null; } }
  ctx.globalCompositeOperation='source-over'; blit(); }
/* 🪣 페인트통 — 누른 얼굴 메쉬의 조각(UV 섬)만 지금 색으로 채운다(erase 면 그 조각만 지운다 → 피부가 보인다).
   붓과 같은 광선(_paintHitAt — 앞면만 · 옷에 가려지면 안 칠함)을 쓰고, 그림 층(actC)에만 칠하므로
   저장 · 되돌리기 · 감은눈 복사가 붓 획과 똑같이 다룬다. 대칭이면 거울 자리의 조각도 같은 되돌리기 한 칸에. */
function bucketFromEvent(e, erase){ if(!isDrawStep()||!cBase||!crPaintTool)return false;
  const hit=_paintHitAt(e.clientX, e.clientY);
  if(!hit){ toast('얼굴을 눌러 채워요'); return false; }   // 빈 곳 · 옷에 가려진 곳
  const ctx=actC().getContext('2d'), g=hit.object&&hit.object.geometry;
  const n=crPaintTool.bucket({ ctx, geometry:g, size:CANVAS_SZ, faceIndex:hit.faceIndex, uv:hit.uv, color:brushColor, erase, pushHistory });
  if(!n){ toast('여기는 채울 자리가 없어요 — 얼굴을 눌러 주세요'); return false; }
  if(symmetry){ const m=mirrorUV(hit); if(m) crPaintTool.bucket({ ctx, geometry:g, size:CANVAS_SZ, uv:m, color:brushColor, erase }); }
  if(crStep===3) blinkEdited=true;
  blit();
  return true; }
const _pray=new THREE.Raycaster(), _pndc=new THREE.Vector2();
const CR_PAINT_STEP_PX = 6, CR_PAINT_MAX_STEPS = 8;   // _wdPicStrokeTo 와 같은 값
function paintFromEvent(e){ if(!isDrawStep()||!cBase)return;
  /* 획의 첫 점(pointerdown 이 lastPX 를 비우고 부른다) — 쪼개기 출발점을 새로 잡는다. */
  if(lastPX==null && lastSX==null && !_pLastUV) _pLastScr=null;
  const sx=_pLastScr ? _pLastScr.x : null, sy=_pLastScr ? _pLastScr.y : null;
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
  _pLastScr={x:e.clientX, y:e.clientY};
}
// 우클릭 스포이드: 표정 텍스처 캔버스에서 픽셀 색을 읽어 브러시 색으로 적용
function eyedropFromEvent(e){ if(!isDrawStep()||!cBase)return false;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  _pndc.x=((e.clientX-r.left)/r.width)*2-1; _pndc.y=-((e.clientY-r.top)/r.height)*2+1;
  _pray.setFromCamera(_pndc,cCam);
  const _eh=partPaintMod._picIntersect(_pray.ray, [cBase.face]);   // 🩹 지금 자세로 맞힌다(리깅 · _stampFaceHit 주석)
  if(!_eh||!_eh.uv) return false;
  const cx=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(_eh.uv.x*CANVAS_SZ)));
  const cy=Math.max(0,Math.min(CANVAS_SZ-1,Math.floor(_eh.uv.y*CANVAS_SZ)));
  let d; try{ d=actC().getContext('2d').getImageData(cx,cy,1,1).data; }catch(_){ return false; }
  if(d[3]<8) return false;   // 빈 픽셀은 무시
  const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  brushColor=hex; _crDropEraser();
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
  if(on){ _crDropEraser();
    // 이전에 불러둔 이미지가 있으면 버튼 다시 노출 (모드 OFF→ON 복귀 시 이미지 유지)
    if(stampImg){
      const sa=document.getElementById('stampApply'); if(sa)sa.style.display='inline-block';
      const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='inline-block';
      const sr=document.getElementById('stampReset'); if(sr)sr.style.display='inline-block';
    }
  }
  refreshStampOverlay();
  const cv=document.getElementById('creatorPreview'); if(cv)cv.style.cursor=isDrawStep()?'crosshair':'default';
}
/* 도장 UI 상태만 초기화(패널 닫기 등) — 생성기를 닫을 때 사용.
   ★ 이미지·위치/크기/회전(stampImg/stampPlace/stampDirty)은 일부러 안 지움 — 다음에 새 캐릭터를
   만들거나 다른 캐릭터를 수정할 때도 방금 불러온 도장 이미지와 그 배치를 그대로 기억해뒀다가
   바로 다시 쓸 수 있게 하기 위함(요청사항). 완전히 새로 지우고 싶으면 도장 패널의 "취소" 버튼 사용. */
function clearStampState(){
  stampMode=false;
  const sa=document.getElementById('stampApply'); if(sa)sa.style.display='none';
  const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='none';
  const sr=document.getElementById('stampReset'); if(sr)sr.style.display='none';
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
    { const sr=document.getElementById('stampReset'); if(sr) sr.style.display='inline-block'; }
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
/* 도장 변형 초기화.
   · resetStampPlacement()      — 크기/회전만. 위치(cx,cy)는 유지. 오버레이의 ↺ 손잡이가 쓴다(기존 동작).
   · resetStampPlacement(true)  — 위치까지 화면 중앙으로. 패널의 [↺ 초기화] 버튼이 쓴다.
   [왜 갈랐나] 도장이 미리보기 영역 **밖으로 나가버리면 손잡이도 같이 나간다** — 오버레이의 ↺ 를
     누를 방법이 없어진다(제보). 그래서 항상 제자리에 있는 패널 쪽에 '처음 불러온 상태로' 되돌리는
     버튼을 따로 둔다. 기존 ↺ 의 '위치는 그대로' 성질은 손대지 않는다 — 그건 그대로 쓸모가 있다. */
function resetStampPlacement(alsoPos){
  if(!stampImg) return;
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  stampPlace.aspect = stampImg.naturalWidth/Math.max(1,stampImg.naturalHeight);
  const baseW = Math.min(r.width, r.height) * 0.4;
  stampPlace.w = baseW; stampPlace.h = baseW / stampPlace.aspect;
  stampPlace.rot = 0;
  // ★ 값은 loadStampFromFile 의 첫 배치와 같아야 한다 — "처음 불러온 상태"가 이 버튼의 약속이다.
  if(alsoPos){ stampPlace.cx = r.width/2; stampPlace.cy = r.height/2; }
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
  /* 🩹 [2026-10-02 제보] «도장을 찍을 때 얼굴 하관·턱 부분이 제대로 안 찍힌다»
     [원인] 아래 UV_EDGE_MAX(0.15) 가 **절대값** 이었다. 턱 아래처럼 얼굴이 화면 안쪽으로 휘어 들어가는 곳은 화면에선
       한 칸인데 UV 로는 넓게 펼쳐져서(비스듬히 보는 면), 이음새가 아닌데도 «UV 점프» 로 버려졌다 — 턱선이 비어 찍혔다.
     [대응] ① 이음새 판정을 **3D 거리 대비** 로 바꾼다(_uvFar 주석 · 꾸미기 그리기 _wdPicPaint 와 같은 식).
       ② 격자를 18 → 28 로 촘촘히 — 진짜 이음새에서 버려지는 칸이 작아지고 굽은 면을 더 잘 따라간다(레이 841회, 대칭 시 두 배).
       ③ 앞면에 맞은 것만 쓴다 — 양면 재질이면 턱 밑을 스치는 광선이 안쪽 면(다른 UV)에 맞을 수 있다.
     ⚠️ animal.js aCommitStamp 에 같은 코드가 있다(이 파일 주석의 약속). 동물 생성기도 같은 증상이면 그쪽도 같이 고칠 것. */
  const N=28;
  /* 🩹 [2026-10-02 재제보 — «하관 아래가 아직 덜 찍힌다»(위에서 본 스크린샷: 비스듬하지 않은 아래 띠가 통째로 빔)]
     [진짜 원인] 얼굴 메쉬는 **리깅(SkinnedMesh)** 이다. three r128 기본 레이캐스트는 스키닝을 계산하지 않아
       **바인드 포즈** 의 얼굴을 맞힌다. 화면의 얼굴(지금 자세)과 어긋난 만큼 아래쪽 띠는 광선이 빈 곳을 지나 못 맞혔다.
     [대응] 꾸미기 그리기가 이 문제로 만든 _picIntersect(리깅이면 지금 자세의 정점으로 직접 교차 · 앞면만)를 쓴다.
       리깅이 아니면 평소 레이캐스트 + 앞면 필터라 예전과 같다. */
  function _stampFaceHit(){
    const c=partPaintMod._picIntersect(_pray.ray, [cBase.face]);
    if(!c||!c.uv) return null;
    return {x:c.uv.x, y:c.uv.y, p:c.point.clone()};
  }
  // 각 격자 점의 face UV(있으면) 계산
  const uvs=[]; // [j*(N+1)+i] = {uv:{x,y}} or null
  const _wrapRays=[];   // 빗나간 칸의 광선 — 감아 칠하기용
  for(let j=0;j<=N;j++){
    for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*w, ly=(j/N-0.5)*h;
      const sp=localToScreen(lx,ly);
      // 화면 좌표 → NDC (캔버스 픽셀 크기는 r.width/r.height 사용)
      _pndc.x=(sp.x/r.width)*2-1; _pndc.y=-(sp.y/r.height)*2+1;
      _pray.setFromCamera(_pndc,cCam);
      const _h=_stampFaceHit();
      uvs.push(_h);
      if(!_h) _wrapRays[uvs.length-1]={o:_pray.ray.origin.clone(), d:_pray.ray.direction.clone()};
    }
  }
  // 🩹 #3 감아 칠하기 — 턱 밑처럼 정면에서 못 맞힌 칸을 이웃에서부터 이어 채운다(_stampWrapFill 주석)
  const _wrapCtr=partPaintMod._stampWrapCenter(cBase.face);
  const _wrapN=partPaintMod._stampWrapFill(uvs, N, _wrapRays, [cBase.face], _wrapCtr);
  if(_wrapN) console.log('[도장] 감아 칠한 격자점', _wrapN);
  pushHistory();
  // 가장자리 폐기 셀의 UV를 인접 유효 셀에서 *바깥으로 외삽*해서 채움 — 도장이 얼굴을 더 꽉 채우게
  // 외삽한 UV가 0..1 약간 벗어나는 범위(-0.05..1.05)까지는 클램프해서 살리고, 그 밖은 폐기.
  /* ★ 얼굴에 안 맞은 격자점을 주변 값에서 추정해 채운다(가장자리 톱니 방지).
     [주의] 예전엔 범위(-0.05~1.05) 안이기만 하면 계속 채웠는데, 벗어난 값은 0~1로 잘려서
     여러 칸이 '텍스처 가장자리의 같은 좌표'로 뭉쳤다. 그 칸들이 이미지를 같은 자리에 겹쳐 그리면서
     띠처럼 번지는 자국이 생긴다 — 투명 PNG는 그 부분이 투명이라 안 보였지만,
     배경이 있는 PNG로 찍으면 그대로 드러난다(제보된 증상).
     → 추정은 가장자리 보정용이므로 방향당 EXTRA_MAX칸까지만 하고, 잘려서 값이 안 변하면 즉시 멈춘다. */
  const EXTRA_MAX = 2;   // ★ 한 방향으로 추정해 채울 최대 칸 수
  function extrapolateUVs(arr, N){
    function tryExtra(i,j,uv){
      // 잘라내야 할 만큼 벗어난 값 = 이미 메시 밖 → 뭉개짐의 원인이라 채우지 않는다.
      if(uv.x<0||uv.x>1||uv.y<0||uv.y>1) return false;
      arr[j*(N+1)+i]={x:uv.x,y:uv.y}; return true;
    }
    // 행별 좌→우 / 우→좌 외삽
    for(let j=0;j<=N;j++){
      let i1=-1,i2=-1;
      for(let i=0;i<=N;i++){ if(arr[j*(N+1)+i]){ if(i1<0)i1=i; else if(i2<0){i2=i;break;} } }
      if(i1>=0&&i2>=0){
        const u1=arr[j*(N+1)+i1], u2=arr[j*(N+1)+i2], dx=(u2.x-u1.x)/(i2-i1), dy=(u2.y-u1.y)/(i2-i1);
        for(let i=i1-1;i>=0&&i>i1-1-EXTRA_MAX;i--){ if(!tryExtra(i,j,{x:u1.x+dx*(i-i1),y:u1.y+dy*(i-i1)})) break; }
      }
      let k1=-1,k2=-1;
      for(let i=N;i>=0;i--){ if(arr[j*(N+1)+i]){ if(k1<0)k1=i; else if(k2<0){k2=i;break;} } }
      if(k1>=0&&k2>=0){
        const u1=arr[j*(N+1)+k1], u2=arr[j*(N+1)+k2], dx=(u1.x-u2.x)/(k1-k2), dy=(u1.y-u2.y)/(k1-k2);
        for(let i=k1+1;i<=N&&i<k1+1+EXTRA_MAX;i++){ if(!tryExtra(i,j,{x:u1.x+dx*(i-k1),y:u1.y+dy*(i-k1)})) break; }
      }
    }
    // 열별 상→하 / 하→상 외삽 (행 외삽 후 남은 코너·전체 결손 행 처리)
    for(let i=0;i<=N;i++){
      let j1=-1,j2=-1;
      for(let j=0;j<=N;j++){ if(arr[j*(N+1)+i]){ if(j1<0)j1=j; else if(j2<0){j2=j;break;} } }
      if(j1>=0&&j2>=0){
        const u1=arr[j1*(N+1)+i], u2=arr[j2*(N+1)+i], dx=(u2.x-u1.x)/(j2-j1), dy=(u2.y-u1.y)/(j2-j1);
        for(let j=j1-1;j>=0&&j>j1-1-EXTRA_MAX;j--){ if(!tryExtra(i,j,{x:u1.x+dx*(j-j1),y:u1.y+dy*(j-j1)})) break; }
      }
      let m1=-1,m2=-1;
      for(let j=N;j>=0;j--){ if(arr[j*(N+1)+i]){ if(m1<0)m1=j; else if(m2<0){m2=j;break;} } }
      if(m1>=0&&m2>=0){
        const u1=arr[m1*(N+1)+i], u2=arr[m2*(N+1)+i], dx=(u1.x-u2.x)/(m1-m2), dy=(u1.y-u2.y)/(m1-m2);
        for(let j=m1+1;j<=N&&j<m1+1+EXTRA_MAX;j++){ if(!tryExtra(i,j,{x:u1.x+dx*(j-m1),y:u1.y+dy*(j-m1)})) break; }
      }
    }
  }
  extrapolateUVs(uvs, N);
  /* ★ 얼굴 메시에 안 맞은 격자점은 버려진다(그 칸은 안 찍힘).
     도장이 캐릭터 실루엣 밖으로 나가 있거나, 미리보기가 회전돼 얼굴이 카메라를 안 볼 때 이런 일이 생긴다.
     화면에선 잘 올려둔 것처럼 보이는데 일부만 찍히니, 유저 입장에선 원인을 알 수가 없었다.
     → 놓친 비율을 세어 많으면 안내한다. 콘솔에도 남겨서 제보를 받을 때 판단 근거로 쓴다. */
  {
    let miss=0; for(let k=0;k<uvs.length;k++) if(!uvs[k]) miss++;
    const ratio = miss / Math.max(1, uvs.length);
    if(ratio > 0.02) console.log('[도장] 얼굴 밖 격자점', miss, '/', uvs.length, '(', Math.round(ratio*100), '% )');
    if(ratio >= 0.9){
      toast('도장이 캐릭터 밖에 있어요 — 얼굴 위로 옮겨주세요');
      return;   // 거의 다 놓쳤으면 찍지 않는다(엉뚱한 자국만 남는 걸 방지)
    }
    if(ratio > 0.2) toast('도장 일부가 얼굴을 벗어나 잘렸어요 ('+Math.round((1-ratio)*100)+'%만 찍힘)');
  }
  const dstCtx=actC().getContext('2d');
  /* ★ 도장은 '오프스크린에 먼저 조립한 뒤 한 번에' 합성한다.
     [증상] 투명 PNG로 찍으면 격자 모양으로 진해지고, 불투명 PNG로 찍으면 대각선 빗금이 생겼다.
     [원인] 아래 drawTri가 삼각형을 0.75px씩 부풀려 클립한다(셀 사이 흰 선을 없애려고).
       그래서 인접 삼각형이 약 1.5px 겹치고, 그 띠가 source-over로 두 번 그려진다.
         · 투명 PNG : 알파가 두 번 합성 → 1-(1-a)². 50%가 75%로 진해져 격자 자국이 보인다.
         · 불투명   : 색이 같아 겹침은 안 보이지만, 한 셀의 두 삼각형은 affine 변환이 서로 달라
                     대각선 띠에서 이미지의 다른 부분을 샘플링한다 → 빗금.
       즉 한 원인이 두 증상을 다 만든다.
     [수정] 삼각형을 픽셀 단위로 직접 래스터화한다(아래 drawTri — clip/drawImage 안 씀).
       clip 경계의 안티앨리어싱이 원인이라 합성 모드로는 못 고친다(copy는 이웃 픽셀을 지워
       '밝은' 빗금이 됐다). 다 조립한 뒤 얼굴 캔버스에 source-over로 딱 한 번 얹는다.
     ⚠️ 미러(대칭) 도장도 같은 오프스크린에 그린다. 따로 그리면 원본과 겹치는 부분에서
       똑같이 알파가 두 번 쌓인다. */
  const stampOff=document.createElement('canvas');
  stampOff.width=CANVAS_SZ; stampOff.height=CANVAS_SZ;
  const ctx=stampOff.getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';   // 부드러운 보간으로 셀 경계 시인성 ↓
  const imgW=stampImg.naturalWidth, imgH=stampImg.naturalHeight;
  // 셀별로 삼각형 2개씩 그려서 매핑. 누락 셀은 폐기. 클립 영역을 셀 중심에서 외측으로 살짝 부풀려 인접 셀과 겹치게 → 흰선 제거.
  /* ★ 침범 중첩 방지 — 도장이 얼굴 실루엣 가장자리를 벗어나면, 스치듯 지나가는 레이가 얼굴의
     옆면·이음새(UV 점프) 지점에 맞아 인접 격자점의 UV가 텍스처 반대편으로 크게 벌어질 수 있다.
     그 셀 삼각형을 그대로 그리면 이미지가 텍스처를 가로질러 길게 늘어나 엉뚱한 부위 위에 겹쳐 찍힌다
     (제보 증상: 얼굴 영역을 벗어나면 일부가 침범되듯 중첩으로 찍힘).
     → 정상 셀의 UV 간격(N=18이면 ~0.05 이하)보다 훨씬 큰 점프가 있는 삼각형은 폐기. */
  const UV_EDGE_MAX = 0.15;
  /* 🩹 이음새 판정 — 3D 로 그만큼 떨어진 두 점이라면 UV 가 이 정도 벌어지는 게 자연스러운가?
     · 둘 다 실제로 맞힌 점(p 있음): 허용치 = 3D 거리 × 이 메쉬의 UV 배율 × 3 + 0.03, 천장 0.35.
       비스듬한 턱 밑은 3D 거리도 같이 커서 통과하고, 진짜 이음새(3D 는 붙어 있는데 UV 가 멀다)는 걸린다.
       천장은 «텍스처를 가로지르는 긴 띠» 를 막는 마지막 울타리다.
     · 외삽으로 채운 점(p 없음): 예전 그대로 0.15. */
  const _uvK = partPaintMod._wdPicUvScale(cBase.face);
  function _uvFar(p,q){
    const dx=p.x-q.x, dy=p.y-q.y, uvD=Math.sqrt(dx*dx+dy*dy);
    if(p.p && q.p){ const allow=Math.min(0.35, p.p.distanceTo(q.p)*_uvK*3 + 0.03); return uvD > allow; }
    return uvD > UV_EDGE_MAX;
  }
  /* ★ 삼각형을 픽셀 단위로 직접 래스터화한다 (clip + drawImage 사용 안 함).
     [왜] 캔버스의 clip 경계는 안티앨리어싱된다. 그래서 어떤 합성 모드를 써도 이음매가 남는다.
       · source-over + 부풀리기 → 겹침 띠에서 알파가 두 번 쌓임 → '진한' 빗금 (0.5→0.75)
       · copy + 부풀리기        → 나중 삼각형의 AA 경계가 이웃이 그려둔 픽셀을 지움 → '밝은' 빗금
     둘 다 실패했다(실제로 순서대로 겪었다). 원인이 AA 경계라 합성 모드로는 못 고친다.
     [해결] 목적지 픽셀마다 삼각형 내부인지 판정하고, 무게중심 좌표로 원본 좌표를 보간해
       이중선형 샘플링한 값을 '덮어쓴다'. 겹쳐도 같은 값이라 이음매가 원리적으로 안 생기고
       알파도 원본 그대로다. 경계는 EPS(0.5px)만큼 넓혀 인접 삼각형이 같은 픽셀을 덮게 한다.
     ⚠️ animal.js aCommitStamp에 같은 코드가 있다. 한쪽을 고치면 반드시 다른 쪽도 고칠 것. */
  const _sc=document.createElement('canvas'); _sc.width=imgW; _sc.height=imgH;
  _sc.getContext('2d').drawImage(stampImg,0,0);
  const srcD=_sc.getContext('2d').getImageData(0,0,imgW,imgH).data;
  const dstImg=ctx.createImageData(CANVAS_SZ,CANVAS_SZ), dstD=dstImg.data;
  function sampleSrc(u,v,o){
    let x=Math.min(imgW-1,Math.max(0,u-0.5)), y=Math.min(imgH-1,Math.max(0,v-0.5));
    const x0=Math.floor(x), y0=Math.floor(y);
    const x1=Math.min(imgW-1,x0+1), y1=Math.min(imgH-1,y0+1);
    const fx=x-x0, fy=y-y0;
    for(let k=0;k<4;k++){
      const p00=srcD[(y0*imgW+x0)*4+k], p10=srcD[(y0*imgW+x1)*4+k];
      const p01=srcD[(y1*imgW+x0)*4+k], p11=srcD[(y1*imgW+x1)*4+k];
      dstD[o+k] = (p00*(1-fx)+p10*fx)*(1-fy) + (p01*(1-fx)+p11*fx)*fy;
    }
  }
  function drawTri(s0,s1,s2,d0,d1,d2){
    if(_uvFar(d0,d1)||_uvFar(d1,d2)||_uvFar(d0,d2)) return;   // UV 점프 셀(이음새/옆면 랩) = 안 찍음
    const ax=d0.x*CANVAS_SZ, ay=d0.y*CANVAS_SZ, bx=d1.x*CANVAS_SZ, by=d1.y*CANVAS_SZ;
    const cx2=d2.x*CANVAS_SZ, cy2=d2.y*CANVAS_SZ;
    const area=(bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay);
    if(Math.abs(area)<1e-6) return;
    const inv=1/area, EPS=0.5/Math.max(1e-6,Math.sqrt(Math.abs(area)));
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx2)-1)), x1=Math.min(CANVAS_SZ-1,Math.ceil(Math.max(ax,bx,cx2)+1));
    const y0=Math.max(0,Math.floor(Math.min(ay,by,cy2)-1)), y1=Math.min(CANVAS_SZ-1,Math.ceil(Math.max(ay,by,cy2)+1));
    for(let y=y0;y<=y1;y++){
      const py=y+0.5;
      for(let x=x0;x<=x1;x++){
        const px=x+0.5;
        const w1=((px-ax)*(cy2-ay)-(cx2-ax)*(py-ay))*inv;
        const w2=((bx-ax)*(py-ay)-(px-ax)*(by-ay))*inv;
        const w0=1-w1-w2;
        if(w0<-EPS||w1<-EPS||w2<-EPS) continue;
        sampleSrc(w0*s0.x+w1*s1.x+w2*s2.x, w0*s0.y+w1*s1.y+w2*s2.y, (y*CANVAS_SZ+x)*4);
      }
    }
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
  // ★ 단, 도장이 중앙 부근이면 미러본이 원본과 겹쳐 "반전 이중상"이 되므로 생략 —
  //   감은눈처럼 얼굴 전체를 덮는 이미지를 중앙에 찍는 경우가 여기 해당.
  //   한쪽으로 치우친 도장(볼터치 등)은 기존대로 반대쪽에 짝으로 찍힘.
  if(symmetry && Math.abs(stampPlace.cx - r.width/2) >= stampPlace.w*0.5){
    const savedCx=stampPlace.cx, savedRot=stampPlace.rot;
    stampPlace.cx = r.width - savedCx;
    stampPlace.rot = -savedRot;
    // 거울 도장: 이미지를 좌우 반전한 뒤 같은 방식으로
    const off=document.createElement('canvas'); off.width=imgW; off.height=imgH;
    const octx=off.getContext('2d'); octx.translate(imgW,0); octx.scale(-1,1); octx.drawImage(stampImg,0,0);
    const savedImg=stampImg; stampImg=off;
    // 격자 raycast 다시
    const uvs2=[], _wrapRays2=[];
    const cs2=Math.cos(stampPlace.rot), sn2=Math.sin(stampPlace.rot);
    for(let j=0;j<=N;j++){ for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*stampPlace.w, ly=(j/N-0.5)*stampPlace.h;
      const sx=stampPlace.cx+lx*cs2-ly*sn2, sy=stampPlace.cy+lx*sn2+ly*cs2;
      _pndc.x=(sx/r.width)*2-1; _pndc.y=-(sy/r.height)*2+1;
      _pray.setFromCamera(_pndc,cCam);
      const _h2=_stampFaceHit();
      uvs2.push(_h2);   // 🩹 원본 도장과 같은 판정(앞면 · 3D 위치 포함)
      if(!_h2) _wrapRays2[uvs2.length-1]={o:_pray.ray.origin.clone(), d:_pray.ray.direction.clone()};
    }}
    partPaintMod._stampWrapFill(uvs2, N, _wrapRays2, [cBase.face], _wrapCtr);   // 거울 도장도 같이 감는다
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
  // ★ 조립 끝 — 얼굴 캔버스에 source-over로 딱 한 번 얹는다. 여기서만 알파가 합성되므로
  //   반투명 PNG도 원본 그대로의 농도로 찍힌다.
  ctx.putImageData(dstImg,0,0);        // 래스터 결과 → 오프스크린
  dstCtx.save();
  dstCtx.globalCompositeOperation='source-over';
  dstCtx.imageSmoothingEnabled=true;
  dstCtx.drawImage(stampOff,0,0);      // 얼굴 캔버스에 딱 한 번 합성 (여기서만 알파 합성)
  dstCtx.restore();
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
    // 🖱️ 우클릭: 드래그하면 카메라 회전, 움직임 없이 떼면 기존처럼 스포이드(그리기 단계에서만).
    //   어느 단계에서든 우클릭 드래그로 캐릭터를 돌려볼 수 있음 — 동물 생성기와 통일된 조작.
    if(e.button===2){ _rcOrbit={x:e.clientX,y:e.clientY,moved:false}; cv.setPointerCapture(e.pointerId); return; }
    if(!isDrawStep())return;
    // 도장 편집 중에는 캔버스 클릭으로 그리지 않음(오버레이 조작 우선)
    if(stampMode) return;
    if(e.button!==0)return;
    const act=crPaintTool?crPaintTool.pointerAction(e):'stroke';
    if(act!=='stroke'){ bucketFromEvent(e, act==='fillErase'); return; }   // 🪣 한 번 누르면 끝 — 끌기 획이 아니다
    if(crStep===3)blinkEdited=true;pushHistory();painting=true;_paintBreak();_pLastScr=null;paintFromEvent(e);cv.setPointerCapture(e.pointerId);   // 🩹 #12 — 새 획: 솔기·쪼개기 기억도 비운다
  });
  cv.addEventListener('pointermove',e=>{
    if(_rcOrbit){
      const dx=e.clientX-_rcOrbit.x, dy=e.clientY-_rcOrbit.y;
      if(_rcOrbit.moved || Math.abs(dx)+Math.abs(dy)>4){
        _rcOrbit.moved=true;
        camYaw += wardrobeMod.ORBIT_DRAG_DIR * dx*0.012;   // 오른쪽 드래그 = 앵글도 오른쪽으로 (부호는 ORBIT_DRAG_DIR 한 곳에서 관리 — 꾸미기 미리보기와 동일)
        camPitch = Math.max(-0.6, Math.min(1.0, camPitch + dy*0.008));
        updateCreatorCam();
        _rcOrbit.x=e.clientX; _rcOrbit.y=e.clientY;
      }
      return;
    }
    /* 🖌 커서 = 지금 도구(붓 + · 페인트통 · 지우개). 단계 이동(gotoStep)이 crosshair 로 되돌려도 움직이면 다시 맞는다. */
    if(crPaintTool && isDrawStep() && !stampMode){ const cu=crPaintTool.cursor(); if(cv.style.cursor!==cu) cv.style.cursor=cu; }
    if(!painting)return;
    const evs=(typeof e.getCoalescedEvents==='function')?e.getCoalescedEvents():null;
    /* 🖊️ [Mac 제보 2026-09-23] "표정을 그리면 선이 위아래로 튄다."
       getCoalescedEvents 의 점들은 **마지막 것이 이 이벤트 자신**이어야 한다(규격). 그런데 환경에 따라
       (mac · 확대/축소 · 투명 창) 묶인 점이 다른 좌표계로 오면, 진짜 점과 어긋난 점이 번갈아 찍혀 선이 지그재그로 튄다.
       ★ 마지막 묶인 점이 이 이벤트와 2px 안일 때만 믿는다. 아니면 이 이벤트 하나만 쓴다(조금 덜 매끄럽지만 튀지 않는다). */
    const _cLast = (evs && evs.length) ? evs[evs.length-1] : null;
    const _cOk = !!(_cLast && Math.abs(_cLast.clientX - e.clientX) <= 2 && Math.abs(_cLast.clientY - e.clientY) <= 2);
    if(_cOk){ for(const ce of evs) paintFromEvent(ce); }
    else paintFromEvent(e);
  });
  cv.addEventListener('pointerup',(e)=>{
    if(_rcOrbit){
      const was=_rcOrbit; _rcOrbit=null;
      // 움직이지 않고 뗀 우클릭 = 기존 스포이드 동작 그대로
      if(!was.moved && isDrawStep() && !stampMode){ if(crStep===3)blinkEdited=true; eyedropFromEvent(e); }
      return;
    }
    painting=false;lastPX=lastPY=null;lastSX=lastSY=null;
  });
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
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&hotkeyLetter(e)==='z'){e.preventDefault();redo();return;}
  if((e.ctrlKey||e.metaKey)&&hotkeyLetter(e)==='z'){e.preventDefault();undo();return;}
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
  if(hotkeyLetter(e)==='c' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    if(crPaintTool) crPaintTool.toggleEraser();   // 지우개 ↔ 붓 — eraser 변수와 버튼 표시는 도구 줄(onChange)이 맞춘다
  }
  // B 붓 · G 페인트통 · E 지우개 (paint-tools.js — 한글 상태 맥도 hotkeyLetter 로 같은 키)
  if(crPaintTool && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag!=='input' && tag!=='textarea' && crPaintTool.handleKey(e)) e.preventDefault();
  }
  // X: 좌우 대칭 ON/OFF 토글
  if(hotkeyLetter(e)==='x' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    const sb=document.getElementById('symBtn');
    if(sb) sb.click();
  }
  // L: 원색 보기(조명 끄고 칠한 색 그대로) 켬/끔
  if(hotkeyLetter(e)==='l' && isDrawStep() && crFlatView && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    crFlatView.toggle();
  }
  // Z: 도장 모드 ON/OFF 토글 (찍기는 Enter 또는 ✓ 버튼)
  if(hotkeyLetter(e)==='z' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
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
  s.onclick=()=>{brushColor=c;_crDropEraser();[...swEl.children].forEach(x=>x.classList.toggle('on',x===s));};
  swEl.appendChild(s);});
document.getElementById('brushCustom').addEventListener('input',e=>{brushColor=e.target.value;_crDropEraser();
  [...swEl.children].forEach(x=>x.classList.remove('on'));});
/* 🎨 [2026-10-02 제보] "자유 색으로 칠하다 기본 칩을 눌렀다가, 아까 그 자유 색으로 돌아가려고 칸을 다시
   눌러도 그 색이 안 잡힌다." — <input type="color"> 는 **값이 바뀔 때만** input/change 를 보낸다.
   같은 색 그대로 창을 닫으면 이벤트가 없어서 브러시가 기본 칩 색에 머물렀다.
   ⇒ 칸을 누르는 순간 지금 들어 있는 색(=마지막 자유 색·스포이드 색)을 바로 브러시로 잡는다.
     창은 평소처럼 열리고, 거기서 색을 바꾸면 위 input 이 그대로 이어받는다. */
document.getElementById('brushCustom').addEventListener('click',e=>{brushColor=e.target.value;_crDropEraser();
  [...swEl.children].forEach(x=>x.classList.remove('on'));});
document.getElementById('brushSize').addEventListener('input',e=>brushSize=+e.target.value);
/* 🖌 도구 줄 — 붓 · 페인트통 · 지우개. eraser 변수(paintAt 이 본다)는 여기서만 맞춘다.
   붓이 아닌 도구를 고르면 도장 모드를 닫는다(예전 «지우개와 도장은 동시 사용 X» 와 같은 이유 — 도장 중엔 캔버스 클릭이 안 칠한다). */
if(typeof PaintTools!=='undefined'){
  crPaintTool=PaintTools.createPaintTools({ doc:document, uvFill:UvFill,
    hotkeyLetter:hotkeyLetter,
    onChange:(t)=>{ eraser=(t==='eraser'); if(t!=='brush' && stampMode) setStampMode(false);
      const cv=document.getElementById('creatorPreview'); if(cv && isDrawStep() && !stampMode) cv.style.cursor=crPaintTool.cursor(); } });
  crPaintTool.mount(document.getElementById('crToolSeg'));
}
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
/* ↺ 초기화 — 크기·회전·위치를 처음 불러온 상태로. 도장이 미리보기 밖으로 나가 손잡이를 못 잡게 됐을 때의
   유일한 복구 통로라, 오버레이가 아니라 **항상 제자리에 있는 패널**에 둔다. */
{ const sr=document.getElementById('stampReset');
  if(sr) sr.addEventListener('click', ()=>{ resetStampPlacement(true); }); }
document.getElementById('blinkResetBtn').addEventListener('click',()=>{ if(crStep!==3)return;
  pushHistory();   // 되돌리기 가능하게
  const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); blinkEdited=false; blit(); });
/* 🙂 감은눈 → 표정 (2단계). 위 ⟳ 표정 복사의 **반대 방향**이다.
   ⚠️ 두 버튼은 대칭이 아니다 — 그 차이가 아래 두 줄의 이유다.
     · 감은눈은 표정에서 **파생된다**(gotoStep 의 `n===3 && !blinkEdited` 자동 복사). 그래서
       ⟳ 표정 복사는 "파생 상태로 되돌리기"이고 blinkEdited=false 로 되돌린다.
     · 표정은 원본이다. 여기서 blinkEdited 를 건드리면 3단계에 들어가는 순간 감은눈이 표정으로
       다시 덮여서, 방금 가져온 그림이 사라진다. **손대지 않는다.**
   ⚠️ 감은눈을 한 번도 안 고쳤으면 그 캔버스는 비어 있다(신규 캐릭터는 3단계에 들어가야 채워진다).
     그대로 복사하면 표정이 통째로 지워지므로 막는다. 버튼도 gotoStep 에서 같이 잠근다.
   ★ 확인을 묻지 않는다 — pushHistory 를 먼저 하므로 [↶ 되돌리기]와 Ctrl+Z 로 되돌아온다.
     그게 이 창의 관례고, 팝업을 하나 더 띄우는 것보다 손이 덜 간다. */
document.getElementById('faceCopyBlinkBtn').addEventListener('click',()=>{ if(crStep!==2)return;
  if(!blinkEdited){ toast('아직 감은눈을 그린 적이 없어요 — 3단계에서 먼저 그려주세요'); return; }
  pushHistory();   // 표정은 원본이라 덮어쓰기 전에 반드시 되돌릴 자리를 남긴다
  const fx=faceC.getContext('2d'); fx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); fx.drawImage(blinkC,0,0); blit(); });
document.getElementById('undoBtn').addEventListener('click',undo);
const ROT_STEP=Math.PI/12;   // 15°
// ★ 버튼을 꾹 누르면 연속으로 이동하도록(bindHold, 기존 아이템 위치조작 버튼과 동일한 방식) 변경.
// ◀▶ 버튼·←→ 키도 우클릭 드래그와 같은 부호를 써야 한다 — 안 그러면 같은 창에서 조작끼리 반대로 돈다.
bindHold(document.getElementById('cpLeft'), ()=>{camYaw-=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;updateCreatorCam();});
bindHold(document.getElementById('cpRight'), ()=>{camYaw+=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;updateCreatorCam();});
bindHold(document.getElementById('cpUp'), ()=>{camTarget.y+=0.12;updateCreatorCam();});
bindHold(document.getElementById('cpDown'), ()=>{camTarget.y-=0.12;updateCreatorCam();});
// ★ 키보드 방향키로도 동일하게 조작 — 생성기가 열려있을 때만 동작, 꾹 누르면 버튼처럼 연속 이동.
//   입력창(텍스트 필드 등)에 포커스 중이면 방향키 원래 용도(커서 이동)를 방해하지 않도록 건너뜀.
function bindCamKey(key, fn){
  let iv=null, delayTimer=null;
  const stop=()=>{ if(iv){clearInterval(iv);iv=null;} if(delayTimer){clearTimeout(delayTimer);delayTimer=null;} };
  document.addEventListener('keydown', e=>{
    if(!creatorOpen || e.key!==key) return;
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea') return;
    e.preventDefault();
    if(e.repeat) return;   // OS 자체 반복은 무시 — 버튼과 똑같은 리듬(350ms 뒤 60ms 간격)으로만 반복
    fn();
    delayTimer=setTimeout(()=>{ iv=setInterval(fn,60); },350);
  });
  document.addEventListener('keyup', e=>{ if(e.key===key) stop(); });
}
bindCamKey('ArrowLeft',  ()=>{camYaw-=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;updateCreatorCam();});
bindCamKey('ArrowRight', ()=>{camYaw+=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;updateCreatorCam();});
bindCamKey('ArrowUp',    ()=>{camTarget.y+=0.12;updateCreatorCam();});
bindCamKey('ArrowDown',  ()=>{camTarget.y-=0.12;updateCreatorCam();});
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
document.getElementById('topColor').addEventListener('input',e=>{cTopColor=e.target.value;if(cBase&&cBase.upMat)cBase.upMat.color.set(cTopColor);if(cBase&&cBase.hatMat)cBase.hatMat.color.set(cTopColor);updateCreatorLights();});
document.getElementById('botColor').addEventListener('input',e=>{cBotColor=e.target.value;if(cBase&&cBase.loMat)cBase.loMat.color.set(cBotColor);updateCreatorLights();});
// ★ 런처8: 생성기의 세 컬러픽커에 꾸미기와 동일한 커스텀 팝업을 얹음 — 최근 5색 공유(localStorage 'tw.charColorHistory').
//   네이티브 <input type="color">는 상태 저장 그릇으로만 남기고 클릭 시 우리 팝업을 대신 띄움.
const _crColorSw = [];   // 색 입력칸 ↔ 보이는 스와치 짝 (아래 _syncCrColorSwatches 가 쓴다)
(function bindCreatorCustomColorPickers(){
  // ★ 런처8: 네이티브 <input type="color">를 숨기고, 그 앞에 눈에 보이는 스와치 버튼을 만들어
  //   커스텀 팝업만 뜨게 함. (mousedown/click preventDefault로도 못 막는 환경 대비 — 아예 클릭이
  //   input에 닿지 않게 하는 것이 가장 확실)
  const bind = (id)=>{
    const inp=document.getElementById(id); if(!inp) return;
    if(inp.dataset.customBound) return;   // 이미 붙었다 — 스와치를 두 개 만들지 않는다
    inp.dataset.customBound = '1';
    inp.style.display='none';
    const btn=document.createElement('button'); btn.type='button';
    btn.className='cr-color-sw';
    btn.style.cssText='width:46px;height:26px;border-radius:13px;border:1px solid rgba(0,0,0,.12);'
      +'cursor:pointer;padding:0;vertical-align:middle;';
    btn.style.background = inp.value || '#888888';
    inp.parentNode.insertBefore(btn, inp);
    btn.addEventListener('click', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof window.openCharColorPicker !== 'function') return;
      window.openCharColorPicker(btn, inp.value, (c)=>{
        inp.value = c; btn.style.background = c;
        inp.dispatchEvent(new Event('input', {bubbles:true}));
      });
    });
    /* ⚠️ [제보] "옷 색을 바꾸고 수정하러 들어가면 팔레트만 기본색으로 돌아간다."
       원래 의도는 아래 한 줄이었다 — "외부에서 inp.value 가 갱신되면 스와치도 따라온다".
       그런데 **`inp.value = …` 는 input 이벤트를 발생시키지 않는다.** 프로그램이 값을 넣는 경우
       (생성기 재진입 등)에는 이 줄이 한 번도 안 돌고, 스와치는 bind 시점의 HTML 기본값
       (#9dba8a·#d98e73)에 그대로 멈춰 있다. 진짜 input 요소는 display:none 이라 보이지도 않는다.
       ★ cTopColor·3D 미리보기·저장은 전부 정상이었다 — 어긋난 것은 스와치 «표시»뿐이라
         "미리보기는 맞는데 팔레트만 기본색"이라는 제보 문구가 정확히 그 모양이다.
       ★ 그래서 이벤트에 기대지 않고 **직접 맞추는 창구**(_syncCrColorSwatches)를 둔다.
         change 도 함께 듣는다 — 브라우저 기본 색상 선택기는 input 없이 change 만 주는 경우가 있다. */
    inp.addEventListener('input',  ()=>{ btn.style.background = inp.value; });
    inp.addEventListener('change', ()=>{ btn.style.background = inp.value; });
    _crColorSw.push({ inp, btn });
  };
  bind('topColor');
  bind('botColor');
  bind('deskColor');
})();
/* 색 스와치를 지금 값으로 다시 칠한다. 값을 프로그램이 넣은 뒤에는 반드시 이걸 부른다.
   ★ 요소가 셋뿐이라 비용이 없다 — 잊어버리기 쉬운 자리(단계 이동)에서도 그냥 한 번 더 부른다.
     "부르는 것을 잊어서 또 어긋나는" 쪽이 실제로 일어난 사고라, 싸게 여러 번 부르는 편을 택했다. */
function _syncCrColorSwatches(){
  try{ _crColorSw.forEach(o=>{ if(o.inp && o.btn) o.btn.style.background = o.inp.value; }); }catch(_){}
}
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
  /* ★ 예전엔 실패를 통째로 삼켰다(onerror에서 그냥 resolve). skin-data.js가 로드되지 않았거나 이미지가
       깨져도 아무 표시 없이 넘어가고, 피부는 초기 단색 채움 상태로 남는다 — 화면상 '피부 텍스처가 없는'
       상태가 되는데 원인을 알 방법이 없었다(특정 유저만 겪는 제보를 진단하기 어려웠던 이유).
       실패를 콘솔에 남기고, 전부 실패하면 사용자에게도 알린다. */
  if(!window.SKIN_PNGS || !Object.keys(pngs).length){
    console.warn('[피부] skin-data.js의 SKIN_PNGS를 찾지 못했습니다 — 피부 텍스처 없이 단색으로 표시됩니다. 빌드에 skin-data.js가 포함됐는지 확인하세요.');
    try{ toast('피부 텍스처를 불러오지 못했어요 — 프로그램을 다시 설치해 주세요'); }catch(_){}
    return Promise.resolve();
  }
  let failed=0, total=Object.keys(pngs).length;
  return Promise.all(Object.keys(pngs).map(k=>new Promise(res=>{const idx=+k;const img=new Image();
    img.onload=()=>{try{const cv=newCanvas();cv.getContext('2d').drawImage(img,0,0,CANVAS_SZ,CANVAS_SZ);skinCanvases[idx]=cv;refreshSkinSwatch(idx);
    }catch(e){ failed++; console.warn('[피부] skin['+idx+'] 처리 실패', e); }res();};
    img.onerror=()=>{ failed++; console.warn('[피부] skin['+idx+'] 이미지 로드 실패'); res(); };
    img.src=pngs[k];}))).then(()=>{
      if(failed) console.warn('[피부] '+failed+'/'+total+'개 실패 — 해당 피부는 단색으로 표시됩니다.');
      if(failed >= total){ try{ toast('피부 텍스처를 불러오지 못했어요 — 프로그램을 다시 설치해 주세요'); }catch(_){} }
    });}
document.getElementById('crNext').addEventListener('click',()=>gotoStep(Math.min(6,crStep+1)));
// 🐾 동물이 책상(5)에서 [이전] 을 누르면 gotoStep 이 동물 생성기로 돌려보낸다(1~4는 사람용 단계).
document.getElementById('crPrev').addEventListener('click',()=>gotoStep(Math.max(1,crStep-1)));
// 상단 3단계 스텝퍼 클릭으로 이동 (캐릭터=1, 책상=5, 좌석=6)
/* 1 피부 · 2 표정 · 3 감은눈 · 4 색상 — 눌러서 그 단계로(위 큰 탭과 같은 길). 동물 · 커미션은 gotoStep 이 알아서 돌려보낸다. */
[...document.getElementById('crSteps').children].forEach((el,i)=>{ el.style.cursor='pointer'; el.addEventListener('click',()=>gotoStep(i+1)); });
[...document.getElementById('crStages').children].forEach(el=>{ el.addEventListener('click',()=>{
  const stg=+el.dataset.stg; gotoStep(stg===0?Math.min(crStep,4):(stg===1?5:6)); }); });
/* === 책상 세팅(5단계): 책상 색 + 책상 위 아이템(소품) + 위치조작 === */
/* 🎨 책상 아이템 카드 도트 썸네일 — 꾸미기 파츠와 동일한 렌더러(generatePartThumbnail)를 재사용.
   rec.thumbnail(배포에 포함된 것) 우선, 없으면 GLB에서 지연 생성해 메모리 캐시. 실패 시 이모지 유지. */
function applyDeskDotThumb(rec, it){
  try{
    if(!rec || !it || !it.firstChild) return;
    const c = window._deskThumbCache = window._deskThumbCache || {};
    const put = url=>{ const box=it.firstChild; if(!box||!url) return;
      // 이모지(텍스트 노드)만 제거 — ×삭제·✎수정·☰핸들 등 버튼 엘리먼트는 보존
      Array.from(box.childNodes).forEach(n=>{ if(n.nodeType===3) box.removeChild(n); });
      if(box.querySelector('img.desk-dot-thumb')) return;   // 중복 삽입 방지
      const im=document.createElement('img'); im.className='desk-dot-thumb'; im.src=url; im.draggable=false;
      im.style.cssText='width:52px;height:46px;object-fit:contain;image-rendering:pixelated;pointer-events:none;';
      box.insertBefore(im, box.firstChild||null); };
    const k=rec.id, v=c[k];
    if(typeof v==='string' && v.startsWith('data:')){ put(v); return; }
    if(v==='pending' || v==='fail') return;
    const _t = rec.thumbUrl || rec.thumbnail;
    if(_t){ c[k]=_t; put(_t); return; }
    if((!rec.glb && !rec.glbUrl)){ c[k]='fail'; return; }
    c[k]='pending';
    generatePartThumbnail(rec).then(url=>{ if(url){ c[k]=url; put(url); } else c[k]='fail'; }).catch(()=>{ c[k]='fail'; });
  }catch(_){}
}
function swThumb(label,on,icon,onDelete,active){ const d=document.createElement('div');
  d.style.cssText='width:66px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:relative;';
  const box=document.createElement('div'); box.textContent=icon||'';
  const borderColor = active ? '#e0842a' : (on?'#7ba05b':'#0002');
  const bgColor = active ? '#fbebd9' : (on?'#eef3e6':'#fffc');
  box.style.cssText='width:60px;height:54px;border-radius:12px;border:2px solid '+borderColor+';background:'+bgColor+';display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 1px 3px #0001;position:relative;';
  if(onDelete){
    const x=document.createElement('div'); x.textContent='×';
    x.style.cssText='position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#d98e73;color:#fff;font-size:13px;line-height:16px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
    x.onclick=e=>{ e.stopPropagation(); onDelete(); };
    box.appendChild(x);
  }
  const cap=document.createElement('span'); cap.textContent=label; cap.style.cssText='font-size:11px;color:#555;text-align:center;line-height:1.1;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  d.appendChild(box); d.appendChild(cap); return d; }
const DESK_ICON={plant:'🪴',cup:'☕',books:'📚'};
// ★ 관리자 전용 카드 순서 재배치 — HTML5 draggable 대신 포인터 이벤트로 직접 구현.
//   (Electron 환경에서 네이티브 HTML5 드래그가 안정적으로 안 먹히는 경우가 있어서 더 확실한 방식 사용)
//   handle: 잡는 손잡이(☰) 엘리먼트, cardEl: 카드 전체(투명도 표시용), id: 이 카드의 식별자,
//   onDrop(draggedId, targetId): 다른 카드 위에서 손을 뗐을 때 호출.
function bindReorderHandle(handle, cardEl, id, onDrop){
  handle.style.touchAction='none';   // 터치/트랙패드 제스처가 가로채는 것 방지
  handle.addEventListener('pointerdown', e=>{
    if(e.button!==0) return;   // 좌클릭만
    e.preventDefault(); e.stopPropagation();
    cardEl.style.opacity='.4';
    let lastOver=null;
    const onMove=(ev)=>{
      const el=document.elementFromPoint(ev.clientX, ev.clientY);
      const card=el && el.closest ? el.closest('[data-reorder-id]') : null;
      if(lastOver && lastOver!==card) lastOver.style.outline='';
      if(card && card.dataset.reorderId!==id){ card.style.outline='2px dashed #7ba05b'; lastOver=card; }
      else lastOver=null;
    };
    const cleanup=()=>{
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      cardEl.style.opacity='1';
      if(lastOver) lastOver.style.outline='';
    };
    const onUp=()=>{
      const target = lastOver;
      cleanup();
      if(target) onDrop(id, target.dataset.reorderId);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}
let crItemPage = 0;   // 책상 세팅 - 아이템 목록 현재 페이지(0부터 시작)
function renderCrItems(){
  const dr=document.getElementById('crDeskRow'); dr.innerHTML='';
  // 기본 책상 카드 (활성 책상이 커스텀이 아닐 때 on)
  const defThumb=swThumb('기본 책상', !activeCustomDeskId, '🪑');
  defThumb.onclick=async()=>{
    cDeskTemplate=null; cDeskGlbB64=null; activeCustomDeskId=null;
    if(cDesk){
      const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);   // 관리자가 기본 책상을 교체해뒀으면 그거 표시
      if(ov){
        if(!ov.glb && ov.glbUrl){
          try{ await resolveCatalogGlb(ov); }catch(_){}
        }
        try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb)); swapDeskVisual(cDesk,sc,true); }catch(e){ swapDeskVisual(cDesk,null); }
      }
      else swapDeskVisual(cDesk,null);
      applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale);
    }
    renderCrItems();
  };
  if(isAdmin) defThumb.oncontextmenu=e=>{ e.preventDefault(); adminPartReg.openDeskRegister('desk', DEFAULT_DESK_OVERRIDE_ID); };
  dr.appendChild(defThumb);
  // 저장된 책상 카드들
  /* 🪑 [2026-09-18] 라이선스 전용 책상은 **여기 안 나온다** — 🎨 꾸미기 › 책상 으로 옮겼다
     (WD_DESK_TAB 주석의 «왜 옮기나»). 미보유자에게 쓸 수 없는 카드가 목록을 채우던 군더더기이자,
     «고르면 저장값에 굳는» 입구이기도 했다(제보 2).
     ⚠️ 관리자는 그대로 본다 — 등록·검수(우클릭 → openDeskRegister)와 순서 재배치(☰)가
        이 카드에서만 열린다. 꾸미기창 쪽에는 그 손잡이가 없다.
     ★ 아래 deskLocked 갈래는 **지우지 않는다.** 관리자 화면에 쓰이고, 카탈로그가 늦게 도착해
       licenseOnly 를 아직 모르는 순간의 안전망이기도 하다. 지우면 그 틈으로 다시 골라진다. */
  commissionMod.savedDesks().filter(rec=>rec.id!==DEFAULT_DESK_OVERRIDE_ID && (isAdmin || !rec.licenseOnly)).forEach(rec=>{
    const on=(activeCustomDeskId===rec.id);
    const deleteHandler = (rec.fromCatalog && !isAdmin) ? null : ()=>{
      // X 삭제: localStorage에서 제거 + 현재 활성 책상이면 기본으로 복귀
      // 카탈로그에서 온 것(fromCatalog)이면 관리자 전용 "회수"로 처리 — 모두에게서 배포 취소
      if(rec.fromCatalog){
        if(!confirm('"'+(rec.name||'책상')+'"을(를) 모든 사용자에게서 회수할까요?')){ window.focus(); return; } window.focus();
        if(window.firebaseAPI && window.firebaseAPI.unpublishDesk) window.firebaseAPI.unpublishDesk(rec.id).catch(()=>toast('회수 실패(네트워크 확인)'));
      }
      commissionMod.setSavedDesks(commissionMod.savedDesks().filter(d=>d.id!==rec.id)); commissionMod.persistSavedAssets();
      if(activeCustomDeskId===rec.id){ cDeskTemplate=null; cDeskGlbB64=null; activeCustomDeskId=null;
        if(cDesk){
          const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);   // 관리자가 기본 책상을 교체해뒀으면 그거로 복귀(진짜 원본 아님)
          if(ov){ assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb)).then(sc=>{ swapDeskVisual(cDesk,sc,true); applyDeskColorToCustom(cDesk,cDeskColor); }).catch(()=>{ swapDeskVisual(cDesk,null); applyDeskColorToCustom(cDesk,cDeskColor); }); }
          else { swapDeskVisual(cDesk,null); applyDeskColorToCustom(cDesk,cDeskColor); }
        } }
      renderCrItems();
    };
    const card=swThumb(rec.name||'책상', on, rec.icon||'🪑', deleteHandler);
    card.dataset.reorderId = rec.id;   // bindReorderHandle의 elementFromPoint 탐색용
    /* 🔒 [2026-09-15] 라이선스 전용 책상은 라이선스(isPremium)·관리자가 아니면 **고르지 못한다** —
       아이템 카드(renderCrItems 아래쪽)와 같은 모양·같은 조건. 예전엔 책상만 여기 게이트가 없어서
       골라지긴 하는데 실행 화면에서 기본 책상으로 떨어졌다(applyDeskCatalogRefToSeat 의 게이트는
       '장착 시점에만 막을 것' 이라 적어 두고 정작 장착 자리에 게이트가 없었다). */
    const deskLocked = !!(rec.licenseOnly && !isPremium && !isAdmin);
    if(deskLocked){
      const lock=document.createElement('div'); lock.textContent='🔒'; lock.title='라이선스 보유자 전용';
      lock.style.cssText='position:absolute;bottom:-4px;right:-4px;font-size:13px;filter:drop-shadow(0 1px 1px #fff);z-index:2;';
      card.firstChild.appendChild(lock);
      card.style.opacity='.55';
    }
    if(isAdmin && rec.fromCatalog){
      const edit=document.createElement('div'); edit.textContent='✎';
      edit.style.cssText='position:absolute;top:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#7ba05b;color:#fff;font-size:11px;line-height:18px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
      edit.onclick=e=>{ e.stopPropagation(); adminPartReg.openDeskRegister('desk', rec.id); };
      card.firstChild.appendChild(edit);   // box(첫 자식)에 붙임 — swThumb 구조상 첫 자식이 아이콘 박스
      card.oncontextmenu=e=>{ e.preventDefault(); adminPartReg.openDeskRegister('desk', rec.id); };
      // ☰ 드래그 핸들 — 책상 카드 순서 재배치(전체 사용자에게 동기화됨). 아이템 카드와 동일한 방식.
      const handle=document.createElement('div'); handle.textContent='☰';
      handle.title='드래그해서 순서 바꾸기';
      handle.style.cssText='position:absolute;bottom:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#8a7d6b;color:#fff;font-size:10px;line-height:18px;text-align:center;cursor:grab;box-shadow:0 1px 3px #0003;z-index:2;';
      card.firstChild.appendChild(handle);
      bindReorderHandle(handle, card, rec.id, reorderSavedDesk);
    }
    card.onclick=async()=>{
      if(activeCustomDeskId===rec.id) return;   // 이미 활성
      if(deskLocked){ toast('🔒 "'+(rec.name||'이 책상')+'"은(는) 라이선스 보유자만 사용할 수 있어요'); return; }   // 🔒 위 주석
      // Storage 이관 후속: rec.glb가 없고 glbUrl만 있으면 Storage에서 fetch
      if(!rec.glb && rec.glbUrl){
        try{ await resolveCatalogGlb(rec); }catch(_){}
      }
      if(!rec.glb){ toast('책상 GLB를 불러올 수 없어요 (네트워크 확인)'); return; }
      /* 📦 코드로 넣은 책상만 GLB 가 def 에 실린다(카탈로그 책상은 id 만) — crDone 과 같은 갈래. */
      if(!rec.fromCatalog){
        const _sz = _creatorSizeGrow(d=>{ d.deskGlb = rec.glb; delete d.deskCatalogId; });
        if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
      }
      try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(rec.glb));
        cDeskTemplate=sc; cDeskGlbB64=rec.glb; cDeskScale=clampDeskScale(cDeskScale||DESK_SCALE_DEFAULT); activeCustomDeskId=rec.id;
        if(cDesk){ swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
        renderCrItems();
      }catch(e){ toast('책상 적용 실패'); }
    };
    dr.appendChild(card);
  });

  /* 🪑 [2026-09-18] 전용 책상을 꾸미기창으로 옮겼으니 «어디로 갔는지» 를 여기서 알려 준다.
     안 알려 주면 보유자에게는 «내 책상이 사라졌다» 로 보인다. 관리자 화면에는 카드가 그대로
     남아 있으므로 띄우지 않는다. 전용 책상이 하나도 등록돼 있지 않으면 띄울 이유가 없다. */
  const _licHint = document.getElementById('crDeskLicenseHint');
  if(_licHint){
    const _hasLic = premiumMod._wdLicenseDesks().length;
    _licHint.style.display = (_hasLic && !isAdmin) ? 'flex' : 'none';
  }

  document.getElementById('deskColor').value=cDeskColor;
  _syncCrColorSwatches();   // ★ 위 topColor·botColor 와 같은 이유
  const dsc=document.getElementById('deskScale'); if(dsc){ dsc.value=cDeskScale; dsc.parentElement.style.display='flex'; setCreatorDeskScale(cDeskScale); }
  const row=document.getElementById('crItemRow'); row.innerHTML='';
  // ★ 기본 내장 아이템(화분/머그컵/책)과 커스텀 아이템을 하나의 목록으로 합쳐서 페이지네이션 적용
  //   (요청사항 — 예전엔 기본 아이템은 항상 위에 고정으로 보여서 5개 기준 계산에서 빠져있었음).
  const _builtinIds=new Set(DESK_ITEMS.map(d=>d.id));
  const _allEntries = [
    ...DESK_ITEMS.map(def=>({type:'builtin', def})),
    ...commissionMod.savedItems().filter(rec=>!_builtinIds.has(rec.id)).map(rec=>({type:'custom', rec})),
  ];
  const CR_ITEM_PAGE_SIZE = 5;
  const _totalPages = Math.max(1, Math.ceil(_allEntries.length / CR_ITEM_PAGE_SIZE));
  if(crItemPage >= _totalPages) crItemPage = _totalPages-1;
  if(crItemPage < 0) crItemPage = 0;
  const _pageEntries = _allEntries.slice(crItemPage*CR_ITEM_PAGE_SIZE, crItemPage*CR_ITEM_PAGE_SIZE + CR_ITEM_PAGE_SIZE);

  _pageEntries.forEach(entry=>{
    if(entry.type==='builtin'){
      const def=entry.def;
      const on=!!(cBase&&cBase.deskItems&&cBase.deskItems[def.id]);
      const active = !!(cBase && cBase.activeDeskItem && on && cBase.deskItems[def.id]===cBase.activeDeskItem);
      const eff0=deskItemDef(def.id)||def;   // ★ 관리자가 교체해뒀으면 그 이름으로 표시 (예전엔 기본 이름 고정이던 문제)
      const it=swThumb(eff0.name||def.name,on,DESK_ICON[def.id]||'▫',null,active);
      applyDeskDotThumb(commissionMod.savedItems().find?commissionMod.savedItems().find(r=>r.id===def.id):null, it);   // 교체분 GLB 도트 썸네일
      it.onclick=()=>{ if(!cBase||!cBase.deskAnchor)return; const eff=deskItemDef(def.id)||def; equipDeskItem(cBase,eff,!on); renderCrItems(); autoSaveDeskItemsNow(); };   // eff: 관리자가 교체해뒀으면 그 커스텀 def, 아니면 기본
      if(isAdmin) it.oncontextmenu=e=>{ e.preventDefault(); adminPartReg.openDeskRegister('item', def.id); };   // def.id(plant/cup/books) 그대로 써서 진짜 교체되게
      else it.oncontextmenu=e=>{ e.preventDefault(); if(on && cBase.deskItems[def.id]) selectDeskItemForAdjust(cBase.deskItems[def.id]); };   // 일반모드: 이미 장착돼있으면 우클릭으로 바로 선택
      row.appendChild(it);
      return;
    }
    // 커스텀 아이템
    const rec = entry.rec;
    const def = customItems[rec.id]; if(!def) return;   // 아직 세션에 파싱 안 된(로딩 중) 아이템은 건너뜀
    const on=!!(cBase&&cBase.deskItems&&cBase.deskItems[def.id]);
    const active = !!(cBase && cBase.activeDeskItem && on && cBase.deskItems[def.id]===cBase.activeDeskItem);
    const deleteHandler = (rec && rec.fromCatalog && !isAdmin) ? null : ()=>{
      // X 삭제: 세션 + localStorage + 현재 장착돼 있으면 해제
      // 카탈로그에서 온 것(fromCatalog)이면 관리자 전용 "회수"로 처리 — 모두에게서 배포 취소
      if(rec && rec.fromCatalog){
        if(!confirm('"'+(def.name||'아이템')+'"을(를) 모든 사용자에게서 회수할까요?')){ window.focus(); return; } window.focus();
        if(window.firebaseAPI && window.firebaseAPI.unpublishItem) window.firebaseAPI.unpublishItem(def.id).catch(()=>toast('회수 실패(네트워크 확인)'));
      }
      if(cBase&&cBase.deskItems&&cBase.deskItems[def.id]) equipDeskItem(cBase,def,false);
      delete customItems[def.id];
      commissionMod.setSavedItems(commissionMod.savedItems().filter(s=>s.id!==def.id)); commissionMod.persistSavedAssets();
      renderCrItems();
    };
    const it=swThumb(def.name, on, def.icon||'📦', deleteHandler, active);
    applyDeskDotThumb(rec, it);   // 🎨 GLB 도트 썸네일 (생성 전까진 이모지)
    it.dataset.reorderId = def.id;   // bindReorderHandle의 elementFromPoint 탐색용
    if(def.licenseOnly && !isPremium && !isAdmin){
      const lock=document.createElement('div'); lock.textContent='🔒'; lock.title='라이선스 보유자 전용';
      lock.style.cssText='position:absolute;bottom:-4px;right:-4px;font-size:13px;filter:drop-shadow(0 1px 1px #fff);z-index:2;';
      it.firstChild.appendChild(lock);
      it.style.opacity='.55';
    }
    if(isAdmin && rec && rec.fromCatalog){
      const edit=document.createElement('div'); edit.textContent='✎';
      edit.style.cssText='position:absolute;top:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#7ba05b;color:#fff;font-size:11px;line-height:18px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
      edit.onclick=e=>{ e.stopPropagation(); adminPartReg.openDeskRegister('item', def.id); };
      it.firstChild.appendChild(edit);
      it.oncontextmenu=e=>{ e.preventDefault(); adminPartReg.openDeskRegister('item', def.id); };
      // ☰ 드래그 핸들 — 커스텀 아이템끼리 순서 재배치(전체 사용자에게 동기화됨)
      const handle=document.createElement('div'); handle.textContent='☰';
      handle.title='드래그해서 순서 바꾸기';
      handle.style.cssText='position:absolute;bottom:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#8a7d6b;color:#fff;font-size:10px;line-height:18px;text-align:center;cursor:grab;box-shadow:0 1px 3px #0003;z-index:2;';
      it.firstChild.appendChild(handle);
      bindReorderHandle(handle, it, def.id, reorderSavedItem);
    } else if(!isAdmin){
      it.oncontextmenu=e=>{ e.preventDefault(); if(on && cBase.deskItems[def.id]) selectDeskItemForAdjust(cBase.deskItems[def.id]); };   // 일반모드: 이미 장착돼있으면 우클릭으로 바로 선택
    }
    it.onclick=()=>{ if(!cBase||!cBase.deskAnchor)return;
      /* 📦 켜는 것만 잰다 — 카탈로그 아이템은 GLB 를 def 에 안 싣는다(crDone 과 같은 갈래). */
      if(!on && !(rec && rec.fromCatalog)){
        const _sz = _creatorSizeGrow(d=>{ d.customItems = d.customItems || {}; d.customItems[def.id] = { name: def.name, glb: def.glb }; });
        if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
      }
      equipDeskItem(cBase,def,!on); renderCrItems(); autoSaveDeskItemsNow(); };
    row.appendChild(it);
  });
  // 페이지 버튼 렌더 — 페이지가 2개 이상일 때만 표시
  const pager = document.getElementById('crItemPager');
  if(pager){
    pager.innerHTML='';
    if(_totalPages > 1){
      pager.style.display='flex';
      for(let p=0; p<_totalPages; p++){
        const pbtn=document.createElement('button'); pbtn.className='cr-item-page-btn'+(p===crItemPage?' on':'');
        pbtn.textContent=String(p+1); pbtn.type='button';
        pbtn.onclick=()=>{ crItemPage=p; renderCrItems(); };
        pager.appendChild(pbtn);
      }
    } else {
      pager.style.display='none';
    }
  }
  // 한도 표시: 6개 다 차면 "+ 코드로 추가하기" 비활성화 느낌
  const dac=document.getElementById('deskAddCode'), iac=document.getElementById('itemAddCode');
  if(dac){ const full=commissionMod.savedDesks().length>=commissionMod.MAX_CUSTOM_ASSETS; dac.style.opacity=full?'0.4':'1'; dac.title=full?'최대 '+commissionMod.MAX_CUSTOM_ASSETS+'개. 카드 X로 지운 뒤 추가하세요':''; }
  if(iac){ const full=commissionMod.savedItems().length>=commissionMod.MAX_CUSTOM_ITEMS; iac.style.opacity=full?'0.4':'1'; iac.title=full?'최대 '+commissionMod.MAX_CUSTOM_ITEMS+'개. 카드 X로 지운 뒤 추가하세요':''; }
}
/* 관리자 — 커스텀 아이템끼리 드래그로 진열 순서 변경, 카탈로그(Firebase)에 order 반영해서 전체 사용자 동기화 */
function reorderSavedItem(draggedId, targetId){
  const draggedIdx = commissionMod.savedItems().findIndex(p=>p.id===draggedId);
  const targetIdx = commissionMod.savedItems().findIndex(p=>p.id===targetId);
  if(draggedIdx<0 || targetIdx<0) return;
  const [item] = commissionMod.savedItems().splice(draggedIdx,1);
  commissionMod.savedItems().splice(targetIdx,0,item);
  commissionMod.savedItems().forEach((p,i)=>{ p.order=i; });
  commissionMod.persistSavedAssets();
  renderCrItems();
  // 런처4-2: 활성 아이템이 없으면(사용자가 카드 선택 안 함) 캐릭터 위에 남아있던 기즈모 숨김.
  attachItemGizmoToActive();
  if(window.firebaseAPI && window.firebaseAPI.updateItemsOrder){
    const orderMap={};
    commissionMod.savedItems().forEach((p,i)=>{ if(p.fromCatalog) orderMap[p.id]=i; });
    if(Object.keys(orderMap).length){
      window.firebaseAPI.updateItemsOrder(orderMap).catch(()=>{ toast('⚠ 순서가 온라인에는 반영 안 됐어요(인터넷 연결 확인) — 이 화면에서만 바뀐 상태예요'); });
    }
  }
}
function reorderSavedDesk(draggedId, targetId){
  const draggedIdx = commissionMod.savedDesks().findIndex(p=>p.id===draggedId);
  const targetIdx = commissionMod.savedDesks().findIndex(p=>p.id===targetId);
  if(draggedIdx<0 || targetIdx<0) return;
  const [item] = commissionMod.savedDesks().splice(draggedIdx,1);
  commissionMod.savedDesks().splice(targetIdx,0,item);
  commissionMod.savedDesks().forEach((p,i)=>{ p.order=i; });
  commissionMod.persistSavedAssets();
  renderCrItems();
  if(window.firebaseAPI && window.firebaseAPI.updateDesksOrder){
    const orderMap={};
    commissionMod.savedDesks().forEach((p,i)=>{ if(p.fromCatalog) orderMap[p.id]=i; });
    if(Object.keys(orderMap).length){
      window.firebaseAPI.updateDesksOrder(orderMap).catch(()=>{ toast('⚠ 순서가 온라인에는 반영 안 됐어요(인터넷 연결 확인) — 이 화면에서만 바뀐 상태예요'); });
    }
  }
}
document.getElementById('deskColor').addEventListener('input',e=>{ cDeskColor=e.target.value; _setDeskMatColor(cDeskMat, cDeskColor); applyDeskColorToCustom(cDesk,cDeskColor); });
document.getElementById('deskScale').addEventListener('input',e=>{ cDeskScale=+e.target.value; setCreatorDeskScale(cDeskScale); });   // 카메라 고정 — 책상 크기 가늠 쉽게
// 버튼을 꾹 누르고 있으면 뗄 때까지 계속 반복 실행 (첫 클릭은 즉시, 0.35초 뒤부터 빠르게 반복)
function bindHold(el, fn){
  let iv=null, delayTimer=null;
  const stop=()=>{ if(iv){clearInterval(iv);iv=null;} if(delayTimer){clearTimeout(delayTimer);delayTimer=null;} };
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); fn(); delayTimer=setTimeout(()=>{ iv=setInterval(fn,60); },350); });
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
}
// 일반(비관리자) 모드: 3D 미리보기에서 이미 놓인 아이템을 우클릭하면 그걸 선택 상태로 만들어서
// 껐다 켜지 않고도 바로 위치조작 버튼으로 조정할 수 있게 함. 선택되면 주황색 테두리로 표시.
function selectDeskItemForAdjust(pivot){
  cBase.activeDeskItem = pivot;
  if(creatorOpen) renderCrItems();
  attachItemGizmoToActive();
}
document.getElementById('creatorPreview').addEventListener('contextmenu', e=>{
  console.log('[아이템 우클릭 감지] isAdmin:', isAdmin, '| crStep:', crStep, '| cBase 있음:', !!cBase, '| deskItems:', cBase&&cBase.deskItems);
  if(isAdmin) return;   // 관리자는 카드 우클릭으로 GLB 수정하는 흐름을 쓰므로 여기선 건너뜀
  if(crStep!==5 || !cBase || !cBase.deskItems || !cCam) return;   // 책상 세팅 단계에서만
  const pivots = Object.values(cBase.deskItems).filter(Boolean);
  console.log('[아이템 우클릭] pivots 개수:', pivots.length);
  if(!pivots.length) return;
  e.preventDefault();
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  ndc.x=((e.clientX-r.left)/r.width)*2-1; ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc, cCam);
  const hit = ray.intersectObjects(pivots, true);
  console.log('[아이템 우클릭] 히트 개수:', hit.length);
  if(!hit.length) return;
  let p=hit[0].object; while(p && !p.userData.isDeskItemPivot) p=p.parent;
  if(p) selectDeskItemForAdjust(p);
});
/* ==== 아이템 3D 기즈모 (어플 3) ====
   TransformControls를 생성기 미리보기 씬에 하나만 만들어놓고, 선택된 아이템 pivot에 attach.
   드래그 종료 시 pivot의 실제 position/rotation/scale을 userData.adj에 다시 기록해서
   기존 저장 파이프라인(applyDeskAdj / persistDeskItems)을 그대로 재사용. */
let itemGizmo=null;
let itemGizmoMode='translate';
/* 🔄 [2026-09-15 제보 4] 회전 기즈모 — 미리보기는 되는데 실행 화면에 적용 안 됨.
   [원인] 저장은 `adj.rot` 하나(Y 축)인데 기즈모는 세 고리(X·Y·Z)를 다 보여 줬고, 저장은 `p.rotation.y` 를
     그대로 읽었다. 그래서 두 갈래로 새 나갔다:
       ① X·Z 고리로 돌린 회전 — 미리보기엔 남고 저장엔 자리가 없다(applyDeskAdj 가 (0,rot,0) 으로 복원).
       ② Y 고리로 90° 를 넘게 돌린 회전 — 오일러(XYZ)는 R_y(120°) 를 (180°, 60°, 180°) 로 분해한다.
          `rotation.y` 는 60° 를 돌려주고, 복원은 (0, 60°, 0) 이라 **거울상**으로 돌아온다.
     두 경우 모두 생성기 미리보기(p.rotation 은 그대로)는 맞고, 저장을 거쳐 다시 그리는 실행 화면만 틀린다 —
     제보 그대로다. 분류 문서의 ① 이 맞았다(축이 다른 데 실린다).
   [대응] 데이터 모델(`rot` 하나)에 기즈모를 맞춘다:
     ・회전 모드에서는 Y 고리만 보인다(_applyItemGizmoMode). X·Z 로는 돌릴 수 없으니 ① 이 사라진다.
     ・저장은 `rotation.y` 가 아니라 쿼터니언을 **YXZ 순서**로 다시 풀어 y 를 읽는다(_itemYaw). 순수 Y 회전이면
       각도가 그대로(−180°~180°) 나온다 — ② 가 사라진다. 복원(applyDeskAdj)은 그대로 둔다. */
function _itemYaw(p){
  try{ return new THREE.Euler().setFromQuaternion(p.quaternion, 'YXZ').y; }catch(_){ return p.rotation.y; }
}
function _applyItemGizmoMode(g, mode){
  g.setMode(mode);
  const rot = (mode === 'rotate');
  g.showX = !rot; g.showZ = !rot; g.showY = true;
}
function ensureItemGizmo(){
  if(itemGizmo) return itemGizmo;
  if(!cScene || !cCam || !cRenderer) return null;
  if(typeof THREE.TransformControls !== 'function'){
    console.warn('TransformControls가 로드되지 않았어요 — vendor/three/TransformControls.js 파일이 필요합니다.');
    return null;
  }
  itemGizmo = new THREE.TransformControls(cCam, cRenderer.domElement);
  itemGizmo.setSize(2.1);   // 3배(기본 0.7 → 2.1) — 요청사항: 기즈모가 잘 안 보여서 키움
  itemGizmo.setSpace('local');   // 회전 시 아이템 자신의 축(=책상 좌표계)을 따르게
  /* 🦶 생성기에서도 바닥(월드 y=0) 아래로는 못 내려간다 — 책상과 책상 위 아이템 둘 다.
     [왜 objectChange 인가] dragging-changed(드래그 종료)에서만 걸면, 끄는 동안에는 물체가 바닥을
       뚫고 내려간 채로 보이다가 손을 뗄 때 툭 올라온다. 매 이동마다 걸어야 '바닥에서 걸리는' 느낌이 난다.
     ★ 저장 경로가 이 뒤에 있다(아래 dragging-changed 가 p.position → adj, cDesk.position → cDeskPos).
       여기서 먼저 끌어올려 두면 저장되는 값이 자동으로 클램프된 값이 된다 — 보이는 자리와 저장값이
       갈라지지 않는다(꾸미기 미리보기의 syncWdGizmoToXf 와 같은 이유·같은 순서).
     ★ 이동만이 아니라 회전·크기에도 걸린다 — 돌리거나 키워서 바닥을 뚫는 경우가 있다.
     ⚠️ hard=true — 사람이 끌고 있는 중이므로 상한(FLOOR_SNAP_MAX)을 두면 안 된다(그 주석 참고).
     ⚠️ 캐릭터는 대상이 아니다. 생성기의 캐릭터 높이는 fitCreator 가 피봇(발바닥)으로 고정하고,
       높이 슬라이더도 '바닥 파묻힘 방지' 때문에 이미 없앤 상태다. */
  const _crFloorClamp = ()=>{
    try{
      if(deskPosGizOn && cDesk){
        /* 🔴 [제보 2-1] 측정에서 **파츠 핀을 뺀다.**
           책상 위 파츠는 deskAnchor 밑의 __deskPartAnchor 핀에 붙는데, 그 핀은
           syncDeskPartAnchor 가 책상 오프셋을 **상쇄**하므로 책상을 옮겨도 따라오지 않는다.
           그런데 예전엔 Box3(cDesk) 가 그 핀까지 함께 재고 있었다 →
             ① 파츠가 y<0 에 있으면 깊이 d 가 잡힌다
             ② 클램프가 **책상 전체**를 d 만큼 올린다
             ③ 곧바로 syncDeskPartAnchor 가 상쇄를 갱신해 파츠는 제자리로 되돌아간다
             ④ 다음 objectChange 에서 같은 d 가 또 잡힌다 → **매 프레임 올라간다**
           이것이 "기즈모를 움직이면 책상이 가챠 파츠 위로 솟는다" 의 정체다.
           (실측: deskPos.y 가 0.1399 까지 올라갔는데 Box3(cDesk).min.y 는 계속 0 — 그 0 은
            책상 다리가 아니라 제자리에 남은 파츠의 바닥이었다.)
           ⚠️ 책상 위 **아이템**(화분 등)은 빼지 않는다 — 그건 책상을 따라 움직이므로 함께 재는 게 맞다.
             빼는 기준은 '책상 위에 있는가' 가 아니라 **'책상과 함께 움직이는가'** 다.
           ⚠️ 파츠 자신의 바닥 맞춤은 별개 경로(applyPartXf · syncWdGizmoToXf)가 이미 한다. */
        floorClampWrapper(cDesk, '책상', true, o => o.name === DESK_PART_ANCHOR_NAME);
        /* 📌 드래그 중에는 setDeskPos 를 안 타고 기즈모가 cDesk.position 을 직접 움직인다.
           그래서 '상쇄해야 할 몫'을 여기서 직접 갱신해 준다 — 안 하면 끄는 동안에만 파츠가
           책상을 따라 움직이다가 손을 뗄 때 제자리로 툭 돌아온다.
           (생성기 책상은 animCorr·eqK 가 **둘 다 없어** 배율이 1 이므로 position 이 곧 deskPos 다 —
            dragging-changed 의 cDeskPos = cDesk.position 과 같은 전제다. 즉 여기 저장되는 값은
            항상 '100% 단위 원본'이고, 실행 화면이 그것을 seatDeskPosMul 로 줄여서 쓴다.
            ⚠️ 생성기에 animCorr 을 심으면 이 전제가 깨진다 — 그러면 옮긴 값이 0.4 로 나뉜 채
              저장돼서 다음에 열 때 책상이 2.5배 멀리 간다) */
        cDesk.userData.deskPosBase = { x:cDesk.position.x, y:cDesk.position.y, z:cDesk.position.z };
        syncDeskPartAnchor(cDesk);
        return;
      }
      const p = cBase && cBase.activeDeskItem;
      if(p) floorClampWrapper(p, '책상 위 아이템', true);
    }catch(_){}
  };
  itemGizmo.addEventListener('objectChange', _crFloorClamp);
  // 드래그 중에는 다른 씬 상호작용(우클릭 히트 등)을 잠시 막고, 드래그 끝나면 저장까지 반영.
  itemGizmo.addEventListener('dragging-changed', e=>{
    if(!e.value){   // 드래그 종료
      /* ⚠️ 저장 직전에 한 번 더 — objectChange 는 렌더 프레임과 어긋나서 마지막 몇 픽셀의 이동이
         클램프를 안 거친 채로 남을 수 있다. 이미 맞은 상태면 무동작(멱등)이라 부담이 없다. */
      _crFloorClamp();
      /* 🪑 책상을 잡고 있었으면 아이템이 아니라 cDeskPos 로 되짚는다.
         ⚠️ 아래 아이템 경로보다 **먼저** 보고 빠져나가야 한다 — 안 그러면 activeDeskItem 이
            남아 있던 경우에 책상을 옮긴 값이 엉뚱한 아이템의 adj 로 들어간다. */
      if(deskPosGizOn && cDesk){
        cDeskPos = {x:cDesk.position.x, y:cDesk.position.y, z:cDesk.position.z};
        updateDeskPosNum();
        layoutSeats();   // 좌우로 밀었으면 좌석 간격을 다시 잡는다
        return;
      }
      const p = cBase && cBase.activeDeskItem;
      if(p){
        // pivot의 실제 transform → adj로 되짚기 (기존 코드가 참조하는 유일한 상태)
        p.userData.adj = p.userData.adj || {};
        p.userData.adj.x = p.position.x;
        p.userData.adj.y = p.position.y;   // ★ y도 저장 — 책상 위 잠금 없이 자유롭게 위/아래 이동 가능(요청사항)
        p.userData.adj.z = p.position.z;
        p.userData.adj.rot = _itemYaw(p);   // 🔄 rotation.y 가 아니다 — 위 [2026-09-15 제보 4]
        p.userData.adj.scale = p.scale.x || 1;
        autoSaveDeskItemsNow();
      }
    }
  });
  cScene.add(itemGizmo);
  return itemGizmo;
}
function detachItemGizmo(){
  if(itemGizmo){ try{ itemGizmo.detach(); }catch(_){} }
}
function attachItemGizmoToActive(){
  const p = cBase && cBase.activeDeskItem;
  const g = ensureItemGizmo();
  if(!g) return;
  // 🪑 아이템을 고르면 책상 위치 모드는 자동으로 꺼진다 — 기즈모가 하나뿐이라 둘 다 켜질 수 없다.
  if(p && deskPosGizOn){ deskPosGizOn = false;
    const b=document.getElementById('deskPosGz'); if(b) b.classList.remove('on'); }
  if(p){ g.attach(p); _applyItemGizmoMode(g, itemGizmoMode); g.visible=true; }
  else { g.detach(); g.visible=false; }
  renderItemColorPanel();   // 런처3-1: 활성 아이템 바뀌면 색상 UI도 갱신
}
// ★ 런처3-1: 활성 아이템의 _col 그룹을 상세조정 패널에 색상 스와치로 표시.
//   커스텀 컬러 팝업(openCharColorPicker) 재사용 — 최근 5색도 생성기/꾸미기와 공유.
function renderItemColorPanel(){
  const box=document.getElementById('crItemColors'); if(!box) return;
  const p = cBase && cBase.activeDeskItem;
  const groups = p && p.userData && p.userData.colorGroups;
  if(!p || !groups || !Object.keys(groups).length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='block';
  box.innerHTML = '<div style="margin-bottom:4px;font-weight:bold;color:#555;">아이템 색상</div>';
  p.userData.colors = p.userData.colors || {};
  const keys = Object.keys(groups).sort((a,b)=> (parseInt(a.replace('col',''))||1) - (parseInt(b.replace('col',''))||1));
  keys.forEach((key,idx)=>{
    const meshes = groups[key];
    const orig = (meshes[0].userData && meshes[0].userData.origColor) || 'ffffff';
    const cur = p.userData.colors[key] || ('#'+orig);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:6px;margin:3px 0;';
    row.innerHTML =
      '<span style="min-width:44px;color:#666;">색상'+(keys.length>1?(idx+1):'')+'</span>'
      +'<button type="button" class="cr-item-sw" style="width:34px;height:22px;padding:0;cursor:pointer;'
      +' border:1px solid rgba(0,0,0,.15);background:'+cur+';border-radius:4px;"></button>'
      +'<button type="button" class="cr-item-rst ghost" title="원본 색으로">↺</button>';
    const sw=row.querySelector('.cr-item-sw');
    sw.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(typeof window.openCharColorPicker!=='function') return;
      window.openCharColorPicker(sw, cur, (c)=>{
        p.userData.colors[key] = c;
        sw.style.background = c;
        _applyItemColor(p);
        autoSaveDeskItemsNow();
      });
    });
    row.querySelector('.cr-item-rst').addEventListener('click', ()=>{
      delete p.userData.colors[key];
      // 원본으로 복원 (material.color/emissive)
      meshes.forEach(m=>{
        if(!m.material || !m.userData.origColor) return;
        const hex='#'+m.userData.origColor;
        if(m.material.color) m.material.color.set(hex);
        if(m.material.emissive){
          const flat = (m.material.userData && m.material.userData.baseFlat!=null) ? m.material.userData.baseFlat : 0.4;
          m.material.emissive.copy(m.material.color).multiplyScalar(flat);
          m.material.needsUpdate=true;
        }
      });
      sw.style.background='#'+orig;
      autoSaveDeskItemsNow();
    });
    box.appendChild(row);
  });
}
// 모드 버튼 바인딩
document.querySelectorAll('#crItemPos .cr-gz-mode').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#crItemPos .cr-gz-mode').forEach(b=>b.classList.toggle('on', b===btn));
    itemGizmoMode = btn.dataset.mode;
    if(itemGizmo && cBase && cBase.activeDeskItem) _applyItemGizmoMode(itemGizmo, itemGizmoMode);
  });
});
/* 🦶 크기 ＋/－ 로 키워서 바닥을 뚫는 경우도 막는다 — 기즈모 드래그와 같은 함수를 쓴다.
   ★ 올린 만큼을 adj.y 에 되짚어야 한다. 안 하면 화면만 올라가고 저장값은 옛 y 그대로라,
     다시 열 때 그 값이 되살아나 아이템이 바닥으로 가라앉는다(꾸미기 쪽과 같은 함정). */
function _crClampActiveItemToFloor(){
  const p = cBase && cBase.activeDeskItem; if(!p) return;
  const dy = floorClampWrapper(p, '책상 위 아이템', true);
  if(dy){ p.userData.adj = p.userData.adj || {}; p.userData.adj.y = p.position.y; }
}
// 크기는 기즈모 대신 ＋/－ 버튼(꾹 누르면 연속 조정)
bindHold(document.getElementById('crItemBigger'), ()=>{
  const p=cBase&&cBase.activeDeskItem; if(!p){ toast('먼저 크기를 조정할 아이템을 우클릭해서 선택해 주세요'); return; }
  p.userData.adj.scale=Math.min(2.5,(p.userData.adj.scale||1)+0.05);
  applyDeskAdj(p);
  _crClampActiveItemToFloor();
  autoSaveDeskItemsNow();
});
bindHold(document.getElementById('crItemSmaller'), ()=>{
  const p=cBase&&cBase.activeDeskItem; if(!p){ toast('먼저 크기를 조정할 아이템을 우클릭해서 선택해 주세요'); return; }
  p.userData.adj.scale=Math.max(0.05,(p.userData.adj.scale||1)-0.05);
  applyDeskAdj(p);
  _crClampActiveItemToFloor();
  autoSaveDeskItemsNow();
});
document.getElementById('crItemRemove').onclick=()=>{
  const p=cBase&&cBase.activeDeskItem; if(!p)return;
  // ★ 요청사항: 이 초기화는 크기만 원래대로 되돌림 — 위치/회전(기즈모로 잡아둔 값)은 그대로 유지.
  p.userData.adj.scale = (p.userData.autoScale!=null) ? p.userData.autoScale : 1;
  applyDeskAdj(p);
  autoSaveDeskItemsNow();
  if(itemGizmo) itemGizmo.update?.();
};
// ⟲ 이동·회전만 초기화 — 크기는 유지 (크기 초기화 버튼과 짝을 이룸)
//   0 이 아니라 이번 편집에서 처음 나타난 자리로 — 0 은 커스텀 아이템을 책상 속에 묻는다(desk-item-origin.js)
document.getElementById('crItemXfReset').onclick=()=>{
  const p=cBase&&cBase.activeDeskItem; if(!p){ toast('먼저 초기화할 아이템을 우클릭해서 선택해 주세요'); return; }
  const back = deskItemOrigin ? deskItemOrigin.resetXf(p, p.userData.adj) : false;
  if(!deskItemOrigin){ p.userData.adj.x=0; p.userData.adj.y=0; p.userData.adj.z=0; p.userData.adj.rot=0; }
  applyDeskAdj(p);
  autoSaveDeskItemsNow();
  if(itemGizmo) itemGizmo.update?.();
  toast(back ? '처음 자리로 되돌렸어요' : '위치·회전을 원래대로 되돌렸어요');
};
document.getElementById('deskAddCode').onclick=()=>openAssetImport('desk');
document.getElementById('itemAddCode').onclick=()=>openAssetImport('item');
/* === 좌석 세팅(6단계): 변형 슬라이더 ===
   ⚠️ 이름은 '좌석 세팅' 이지만 여기서 조절하는 것은 **캐릭터 크기 · 캐릭터 높이 · 방향**이다.
      HTML 의 라벨(예전: 좌석 크기 / 좌석 앞뒤)도 캐릭터 크기 / 캐릭터 높이로 고쳐야 한다. */
function bindCrXform(id,key){ document.getElementById(id).addEventListener('input',e=>{
  const v=+e.target.value;
  cXform[key] = (key==='y') ? clampCharY(v) : v;   // 🧍 높이는 0 하한·CHAR_Y_MAX 상한
  applyCreatorXform(); }); }   // 카메라는 고정 — 크기 가늠 쉽게
/* 🧍 '앞뒤' 슬라이더(#crZ)를 '높이' 슬라이더로 전용한다 — 범위를 여기서 심어서 HTML 을 안 고쳐도
   곧바로 올바르게 동작하게 한다(HTML 의 min 이 음수로 남아 있으면 왼쪽 절반이 죽은 구간이 된다).
   ⚠️ 라벨 문구는 여기서 못 바꾼다 — HTML 쪽도 '캐릭터 높이' 로 고칠 것. */
(function _crZSliderBecomesHeight(){
  const el = document.getElementById('crZ'); if(!el) return;
  el.min = 0; el.max = CHAR_Y_MAX; el.step = 0.01; el.value = 0;
  el.title = '캐릭터 높이';
})();
bindCrXform('crScale','s'); bindCrXform('crZ','y'); bindCrXform('crRot','rot');
document.querySelectorAll('#seatStage .mini-reset[data-rs]').forEach(btn=>{ btn.addEventListener('click',()=>{
  /* 🧍 data-rs="z" 는 HTML 그대로 두고 여기서 높이(y)로 읽는다 — 그 슬라이더가 이제 높이다. */
  const raw=btn.dataset.rs, k=(raw==='z'||raw==='y')?'y':raw, dv=(k==='s')?0.7:0; cXform[k]=dv;
  const id=(k==='s')?'crScale':(k==='y'?'crZ':'crRot'); document.getElementById(id).value=dv;
  applyCreatorXform(); }); });
/* 🪑 책상 위치 기즈모 ─────────────────────────────────────────────────
   아이템 기즈모(itemGizmo)를 그대로 빌려 쓴다 — 생성기 씬에 TransformControls 를 둘 만들면
   둘이 동시에 뜨고 드래그가 서로를 가로챈다. 대신 '지금 무엇에 붙어 있는가'를 여기서 관리한다.
   ⚠️ 아이템을 선택하면 그쪽이 기즈모를 가져간다(attachItemGizmoToActive). 그때 이 모드는 꺼진다. */
let deskPosGizOn = false;
function updateDeskPosNum(){
  const el = document.getElementById('deskPosNum'); if(!el) return;
  const z = !cDeskPos.x && !cDeskPos.y && !cDeskPos.z;
  el.textContent = z ? '기본 위치' : ('x ' + cDeskPos.x.toFixed(2) + ' · y ' + cDeskPos.y.toFixed(2) + ' · z ' + cDeskPos.z.toFixed(2));
}
function setDeskPosGizmo(on){
  const btn = document.getElementById('deskPosGz');
  const g = ensureItemGizmo();
  if(on && (!g || !cDesk)){ toast('책상을 아직 불러오는 중이에요'); return; }
  deskPosGizOn = !!on;
  if(btn) btn.classList.toggle('on', deskPosGizOn);
  if(!g) return;
  if(deskPosGizOn){
    // 책상을 잡는 동안에는 아이템 선택을 풀어 둔다 — 안 그러면 어느 쪽이 잡힌 건지 화면으로 알 수 없다.
    if(cBase) cBase.activeDeskItem = null;
    g.attach(cDesk); _applyItemGizmoMode(g, 'translate'); g.visible = true;   // 책상은 이동만 — 세 축 다 보인다
  } else {
    try{ g.detach(); }catch(_){}
    g.visible = false;
  }
}
(function bindDeskPos(){
  const gz = document.getElementById('deskPosGz');
  if(gz) gz.addEventListener('click', ()=>setDeskPosGizmo(!deskPosGizOn));
  const rs = document.getElementById('deskPosReset');
  if(rs) rs.addEventListener('click', ()=>{
    cDeskPos = {x:0, y:0, z:0};
    setDeskPos(cDesk, cDeskPos);
    updateDeskPosNum();
    if(deskPosGizOn && itemGizmo) itemGizmo.attach(cDesk);   // 기즈모 위치도 따라오게
  });
})();
document.getElementById('deskScaleReset').addEventListener('click',()=>{ cDeskScale=DESK_SCALE_DEFAULT; document.getElementById('deskScale').value=DESK_SCALE_DEFAULT; setCreatorDeskScale(DESK_SCALE_DEFAULT); });
// 어플 3-1: 책상 길이 슬라이더
document.getElementById('deskLenX')?.addEventListener('input', e=>{
  cDeskLenX = +e.target.value || 1;
  setCreatorDeskScale(cDeskScale);
  if(cBase && cBase.charDef){ cBase.charDef.deskLenX = cDeskLenX!==1 ? cDeskLenX : null; slotSaveMod.saveSlots(); }
});
document.getElementById('deskLenXReset')?.addEventListener('click', ()=>{
  cDeskLenX=1; const el=document.getElementById('deskLenX'); if(el) el.value=1;
  setCreatorDeskScale(cDeskScale);
  if(cBase && cBase.charDef){ cBase.charDef.deskLenX = null; slotSaveMod.saveSlots(); }
});
/* === 책상·아이템 코드: 생성(판매자) === */
/* 관리자가 쓰는 코드 굽는 창 셋(📦 책상·아이템 코드 · 🎁 커미션 캐릭터 · 🔐 암호화 GLB 불러오기)은 admin/admin-asset.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   셋이 app.js 여기저기 흩어져 있어 이 자리(첫 덩이)에서 한 번 만든다 — 모두 버튼 연결이라 거는 차례와 상관없다. 아래 코드로 추가하기(파일 열기)는 사용자 쪽이라 그대로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_ASSET_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminAsset = (typeof TwAdminAsset === 'undefined') ? ADMIN_ASSET_OFF : TwAdminAsset.createAdminAsset({
  toast: (...a)=>toast(...a),
  encryptAssetCode: (...a)=>assetCodeMod.encryptAssetCode(...a),
  wrapAsset: (...a)=>assetCodeMod.wrapAsset(...a),
  _b64: (...a)=>codeCryptoMod._b64(...a),
  encryptCommission: (...a)=>commissionMod.encryptCommission(...a),
  unpackCommissionZip: (...a)=>commissionMod.unpackCommissionZip(...a),
  encryptBytes: (...a)=>assetCodeMod.encryptBytes(...a),
  decryptBytes: (...a)=>assetCodeMod.decryptBytes(...a),
  downloadBlob: (...a)=>charCodeMod.downloadBlob(...a),
  loadEncryptedGlbAsSeat: (...a)=>charCodeMod.loadEncryptedGlbAsSeat(...a),
  maxGlbBytes: ()=>commissionMod.MAX_GLB_BYTES,
  maxCommissionBytes: ()=>commissionMod.MAX_COMMISSION_BYTES,
});
document.getElementById('assetImpFileBtn').onclick=()=>document.getElementById('assetImpFileInput').click();
document.getElementById('assetImpFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ document.getElementById('assetImpCode').value=String(reader.result||'').trim(); toast('파일을 불러왔어요'); };
  reader.onerror=()=>toast('파일을 읽지 못했어요');
  reader.readAsText(f);
  e.target.value='';
});

/* === 커미션 캐릭터 코드: 생성(관리자만) === */
/* 커미션 캐릭터 코드 만들기 창(관리자)은 admin/admin-asset.js 로 옮겼다 — 만드는 줄은 «책상·아이템 코드: 생성(판매자)» 자리. 아래 코드 입력(파일 열기)은 사용자 쪽이라 그대로. */
document.getElementById('commImpFileBtn').onclick=()=>document.getElementById('commImpFileInput').click();
document.getElementById('commImpFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ document.getElementById('commImpCode').value=String(reader.result||'').trim(); toast('파일을 불러왔어요'); };
  reader.onerror=()=>toast('파일을 읽지 못했어요');
  reader.readAsText(f);
  e.target.value='';
});

/* === 책상·아이템 코드: 가져오기(생성기 안에서) === */
const assetImpOverlay=document.getElementById('assetImpOverlay');
let _assetImpKind='item';   // 코드로 추가하기 창을 어느 버튼(책상/아이템/파츠)으로 열었는지 기억 — 코드 자체의 종류가 아니라 이 값을 기준으로 등록함
let _assetImpCat=null;      // kind==='part'일 때, 어느 카테고리(모자/탈/안경 등)에 등록할지
function openAssetImport(kind, cat){ _assetImpKind=kind; _assetImpCat=cat||null;
  const label = kind==='desk'?'책상' : kind==='part'?((premiumMod.partCatInfo(cat)&&premiumMod.partCatInfo(cat).label)||'파츠') : '아이템';
  document.getElementById('assetImpTitle').textContent=label+' 코드로 추가하기';
  document.getElementById('assetImpCode').value=''; document.getElementById('assetImpPass').value=''; assetImpOverlay.classList.add('on'); }
document.getElementById('assetImpCancel').onclick=()=>assetImpOverlay.classList.remove('on');
document.getElementById('assetImpGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  const code=document.getElementById('assetImpCode').value, pass=document.getElementById('assetImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  try{ const dec=await assetCodeMod.decryptAssetCode(code,pass); const u=assetCodeMod.unwrapAsset(dec.buf);
    if(u.glbBuf.byteLength>commissionMod.MAX_GLB_BYTES){ toast('GLB가 1MB를 넘어요'); return; }
    const kind = _assetImpKind;   // 코드 자체에 담긴 종류가 아니라, 사용자가 어느 버튼(책상/아이템/파츠)으로 열었는지를 기준으로 등록
    // 한도 검사: 같은 종류의 저장 배열 길이 확인
    // ★ 파츠는 꾸미기 통만 센다 — 코드로 받는 커미션 파츠는 언제나 비(非)가챠라, 관리자가 등록해둔
    //   가챠 파츠 때문에 유저의 코드 추가가 막히면 안 된다(등록 쪽과 같은 이유).
    const arr = (kind==='desk') ? commissionMod.savedDesks() : (kind==='part') ? premiumMod.partsInCatFor(_assetImpCat, false) : commissionMod.savedItems();
    const _maxAssets = (kind==='desk') ? commissionMod.MAX_CUSTOM_ASSETS : (kind==='part') ? premiumMod.MAX_PARTS_PER_CAT : commissionMod.MAX_CUSTOM_ITEMS;
    if(arr.length>=_maxAssets){ toast('최대 '+_maxAssets+'개까지 추가할 수 있어요. 카드의 X로 지운 뒤 다시 시도해 주세요'); return; }
    const glbB64=codeCryptoMod._b64(u.glbBuf);
    /* 📦 넣자마자 이 캐릭터에 실리는 것(책상 · 아이템)은 파일 하나로 남은 용량을 넘으면 받지 않는다.
       책상은 지금 책상 자리를 비운 나머지와 견준다(바꿔 끼우는 것이라). 파츠는 def 에 GLB 가 안 실린다. */
    if(creatorOpen && cBase && (kind==='desk' || kind==='item')){
      const _rest = _creatorBuildDef(true);
      if(kind==='desk'){ delete _rest.deskGlb; delete _rest.deskCatalogId; }
      const _add = (kind==='desk' ? DefSize.jsonBytes(glbB64) + 12 : DefSize.jsonBytes({ name: u.name, glb: glbB64 }) + 20);
      const _sz = _defSizeFile(_rest, _add);
      if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
    }
    const {scene, animations}=await assetCodeMod.parseGlbFull(u.glbBuf.slice(0));
    const id='c'+Date.now().toString(36);
    const rec={id, name:u.name, icon:u.icon||'', glb:glbB64};
    if(kind==='desk'){
      commissionMod.savedDesks().push(rec); commissionMod.persistSavedAssets();
      // 즉시 활성 책상으로 swap (사용자 의도 — 방금 추가한 책상은 바로 보이도록)
      // ★ 크기(cDeskScale)는 건드리지 않음 — 이전에 슬라이더로 맞춰둔 값을 그대로 유지(고정값으로 리셋하면 매번 슬라이더가 튀어 보임)
      cDeskTemplate=scene; cDeskGlbB64=glbB64;
      if(cDesk){ swapDeskVisual(cDesk,scene); setCreatorDeskScale(cDeskScale); applyDeskColorToCustom(cDesk,cDeskColor); }
      activeCustomDeskId=id;
      toast('책상을 추가했어요');
      renderCrItems();
    } else if(kind==='part'){
      // ★ 관리자 등록(admin)과 달리 카탈로그(Firebase)에는 절대 안 올림 — 이 기기(로컬)에만 저장됨.
      rec.cat = _assetImpCat; rec.order = premiumMod.partsInCat(_assetImpCat).length;
      premiumMod.savedParts().push(rec); premiumMod.persistSavedParts();
      partSceneCache.delete(id);   // 혹시 모를 캐시 충돌 방지
      toast('파츠를 추가했어요(이 기기에만 저장됨)');
      wardrobeMod.renderWardrobe();
    } else {
      commissionMod.savedItems().push(rec); commissionMod.persistSavedAssets();
      registerCustomItem(id,u.name,glbB64,scene,u.icon||'',animations);
      if(cBase&&cBase.deskAnchor) equipDeskItem(cBase,customItems[id],true);
      toast('아이템을 추가했어요');
      renderCrItems();
    }
    assetImpOverlay.classList.remove('on');
  }catch(e){ toast('추가 실패: 코드나 비밀번호를 확인해 주세요'); } };
/* 전역 조명 프리셋 (생성기·메인·기타 미리보기 통일). 더 이상 UI 슬라이더 없음 — 코드 한 곳에서 관리
   ⚠️ e 를 바꾸면 파일 위쪽 _MAIN_LIGHT_INT(=b×e) 도 같이 바꿀 것. 저기는 이 상수보다 먼저 필요해서
      숫자를 직접 적어 두었다 — 한쪽만 고치면 생성기와 실행 화면의 밝기가 갈라진다. */
const LIGHT_PRESET = {b:1.2, h:0.09, e:0.46};
/* 💡 '플랫 조명' emissive 배율 — 캐릭터·책상·파츠가 전부 이 값을 쓴다.
   ★★ 이 값은 **직접 정하지 않는다.** 조명 예산에서 계산한다 — 아래 TONE_FRONT_TOTAL 참고.
     [왜] 이 값과 조명 상수는 한 예산을 나눠 쓴다. 그런데 둘이 파일의 다른 곳에 손으로 적혀
       있어서, 한쪽만 고칠 때마다 화면이 어긋났다. 실제로 이 문제로 네 판을 돌았다:
         · 앰비언트를 올렸는데 여기를 안 내려서 흰 면이 전부 255 로 잘렸다(음영 소실)
         · 여기를 내렸는데 조명을 안 올려서 캐릭터가 통째로 어두워졌다
       그래서 사람이 정하는 것은 "한 면이 받는 총합"(TONE_FRONT_TOTAL) 하나로 두고,
       이 값은 거기서 남는 몫으로 받는다. 이제 조명을 만져도 톤 총합은 저절로 유지된다.
   ★ 밝게/어둡게 하려면 **TONE_FRONT_TOTAL 하나만** 만지면 된다. 여기를 만질 일은 없다.
   ⚠️ 텍스처가 없는 메쉬도 같은 값을 쓴다(PART_TEX_FLAT 이 이 값을 따라간다).
   ⚠️ baseFlat 이 없을 때만 쓰는 폴백 몇 곳은 아직 (1-LIGHT_PRESET.e) 로 남아 있다.
      빌드 시점에 baseFlat 을 항상 심어 두므로 실제로는 안 탄다. */
/* 🎚️ 화면 톤의 **단 하나의 손잡이**. 카메라를 보는 흰 면(알베도 1.0)이 받는 빛의 총합이다.
   1.0 = 텍스처 값이 화면에 그대로 나온다(제작 툴에서 본 색과 같다).
   [값] 정면·윗면 / 측면 / 잘리기 시작하는 알베도:
        1.22  255 / 255 / 0.82   ← 흰 텍스처가 실루엣만 남기 시작한다
        1.16  255 / 255 / 0.86   ← 지금. 측면이 정확히 1.0 = 측면 음영이 사라진 완전 평면
        1.10  255 / 248 / 0.91   ← "지금도 나쁘지 않은데 한 톤만 더" 제보를 받은 값(측면 0.94)
        1.03  255 / 240 / 0.97   ← "미묘하게 어둡다" 제보를 받은 값
        0.96  250 / 232 / 잘림 없음
        0.85  237 / 218 / 잘림 없음  ← "어두침침하다" 제보를 받은 계열
   [값 이력] … → 1.03 → 1.10 → **1.16**(한 톤 더 밝게 요청).
     ⚠️ 1.16 에서 측면 몫(앰비언트+FLAT)이 정확히 1.0 이 된다 — 여기서 더 올리면 측면도 잘리기
       시작하고, 그때부터는 올려도 '밝아지는' 대신 계조만 사라진다. 위쪽 한 칸(1.22)은 사실상 끝이다.
     ⚠️ 흰 면(거품·흰 옷·머리띠)은 알베도 0.86 부터 잘린다. "거품 계조가 뭉개진다"가 오면
       1.13 으로 반 칸 내릴 것(측면 0.97 · 잘림 0.88) — 조명 상수는 건드리지 말 것.
   ★ 이 표가 이 문제의 결론이다. 밝기 제보가 또 오면 이 숫자 하나만 옮기고 표에 한 줄 남길 것 —
     조명 상수나 emissive 를 따로 만지면 다시 예산이 갈라진다(그 사고로 다섯 판을 돌았다).
   ★ 더 밝게 하고 싶으면 이 숫자만 올린다. 1.2 를 넘기면 흰 파츠가 실루엣만 남기 시작한다.
   ⚠️ 측면(정면도 윗면도 아닌 면)은 방향광을 못 받으므로 이 총합보다 늘 어둡다 —
      그 차이가 곧 입체감이다. 차이를 줄이려면 _KEY_LIGHT_MUL·_FILL_LIGHT_MUL 을 내린다. */
const TONE_FRONT_TOTAL = 1.05;
const FLAT_EMISSIVE = Math.max(0,
  TONE_FRONT_TOTAL - (0.95 * _MAIN_LIGHT_INT) - (_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));
/* 💡 텍스처(map)가 **있는** 파츠 메쉬의 emissive 배율.
   [경위] 파츠는 map 이 있으면 emissiveMap 을 같이 걸고 emissive = color × (1-e) 를 얹는다.
     그 결과가 '텍스처 값 그대로'라 씬 조명을 거의 안 받는 플랫 톤이 되는데, 그 비중(0.5)이
     너무 커서 파츠 텍스처가 전체적으로 밝게 떠 보였다.
   [값 이력] 0.5(원래) → 0.2(너무 회색) → 0.45 → **FLAT_EMISSIVE 를 따라감**.
     0.45 는 '원래 0.5 에서 조금만' 이라는 뜻이었는데, 이제 전역 기준선이 0.38 로 내려갔다.
     여기만 0.45 로 두면 **파츠가 화면에서 제일 하얀 물건이 된다** — 고치려던 것과 정반대다.
     ★ 파츠만 따로 톤을 달리해야 할 일이 생기면 이 줄에 숫자를 직접 넣으면 된다.
   ⚠️ 텍스처가 **없는** 메쉬는 이 값과 무관하다 — 그쪽은 예전 그대로 (1-e) 를 얹는다.
     씬 조명 위에 색의 절반이 더해지는 그 동작이 의도된 것이라고 확인받았다. 통일하지 말 것.
   ⚠️ 예전 톤으로 되돌리려면 FLAT_EMISSIVE 와 이 값을 (1 - LIGHT_PRESET.e) 로 바꾸면 된다.
   ★ 캐릭터·책상 경로는 안 건드렸다. 파츠만 밝다는 제보였고, 셋을 같이 만지면 무엇이 바뀌어
     좋아졌는지 다음에 알 수 없게 된다. */
const PART_TEX_FLAT = FLAT_EMISSIVE;
/* 💡 텍스처가 **없는**(solid) 아이템·책상 메쉬가 받는 flat 몫.
   [경위] 오래 0 이었다 — "solid 에 emissive 를 얹으면 과도하게 밝다"는 확인을 책상 쪽에서 받았기
     때문이다. 그 확인은 예산이 고정되기 전(앰비언트 0.57 + flat 0.54 + 키 1.0 → 윗면 1.57)의 얘기였고,
     TONE_FRONT_TOTAL 로 총합을 1.10 에 묶은 뒤로는 뜻이 달라졌다: 0 이면 solid 아이템만 정면 0.684 ·
     측면 0.524 로 서서, 같은 GLB·같은 색인데 **파츠(1.10)보다 38% 어둡게** 나온다.
   [제보] 같은 슬라임을 파츠로 올린 화면과 아이템으로 올린 화면을 나란히 놓은 스크린샷.
     고른 색 #FB5894 기준 파츠 쪽 (246,169,205) · 아이템 쪽 (191,131,156) — 예산표 그대로다
     (1.10 → (255,164,208), 0.684 → (213,132,168)). "색상 스와치는 예쁜 핑크인데 칙칙하게 나온다"가 이것.
   [값 이력] 0 → **FLAT_EMISSIVE**(파츠와 같은 규칙 · 고른 색이 화면에 그대로 나오는 값).
   ⚠️ 이 값을 0 으로 되돌리면 아이템만 다시 어두워진다. 아이템만 톤을 달리해야 할 일이 생기면
      여기에 숫자를 직접 넣을 것 — _applyItemMatTone 본문에 흩뿌리지 말 것. */
const ITEM_SOLID_FLAT = FLAT_EMISSIVE;
/* 💡 파츠 머티리얼에 '플랫 조명'을 얹는 단 하나의 자리.
   [경위] 같은 식이 장착 경로·다중 파츠 경로·등록 썸네일 세 곳에 흩어져 있었는데, 썸네일만
     이 처리가 통째로 빠져 있었다. 파츠 밝기의 상당 부분이 emissive 에서 나오므로 그게 빠지면
     썸네일만 어둡게 나온다(제보: "카드 슬롯 스냅샷이 너무 어둡다 · 조명이 없는 듯").
   ⚠️ 앞으로 파츠 톤을 바꿀 일이 있으면 여기만 고칠 것. 세 곳에 흩어 두면 또 갈라진다. */
function _applyPartMatTone(m){
  if(!m) return;
  _fixGlbMatLighting(m);   // ★ 조명을 못 받는 재질(metalness=1)이면 emissive 를 아무리 맞춰도 톤이 안 맞는다
  if(m.map) m.emissiveMap = m.map;
  const flat = m.map ? PART_TEX_FLAT : FLAT_EMISSIVE;
  if(m.emissive) m.emissive.copy(m.color || new THREE.Color(0xffffff)).multiplyScalar(flat);
  m.userData = m.userData || {};
  m.userData.baseFlat = flat;   // ★ 나중에 _col 색상 바꿀 때 같은 배율로 다시 계산하기 위해 기억
  m.needsUpdate = true;
}
/* 💡 아이템·책상(가구류) 머티리얼 톤 — 텍스처 있는 메쉬만 flat, solid 메쉬는 emissive 0.
   [경위] 커스텀 아이템(registerCustomItem)만 이 처리가 통째로 없었다. GLB 가 emissive 를
     어떻게 담아 왔든 그대로 화면에 나가서:
     (a) 제작 툴에서 emissive 를 얹어 내보낸 아이템 → 씬 조명 위에 그 emissive 가 통째로
         더해져 1.0 을 넘겨 클램프 — 흰 텍스처가 디테일 없는 순백 실루엣이 된다
         (제보: "욕조 거품이 너무 쨍해서 원래 텍스처 느낌이 없다").
     (b) emissive 없이 내보낸 아이템 → 캐릭터·파츠·책상만 받는 플랫 조명(FLAT_EMISSIVE)을
         못 받아 옆면 기준 0.57 대 0.97 — 같은 흰색인데 아이템만(또는 캐릭터만) 어둡다
         (제보: "캐릭터 옷 화이트와 아이템 화이트가 다르다").
     어느 쪽이든 여기서 emissive 를 **덮어써서** 캐릭터·파츠·책상과 같은 기준으로 맞춘다.
   ★ solid(map 없는) 메쉬도 파츠와 **같은 규칙**으로 flat 을 받는다(ITEM_SOLID_FLAT · 위 상수 참고).
     예전에는 여기만 emissive 0 이었다 — 그래서 같은 GLB·같은 색을 파츠로 올리면 밝고 아이템으로
     올리면 칙칙했다(제보 스크린샷 두 장으로 확정). 두 경로가 같은 예산을 쓰는 것이 맞다.
     ⚠️ 되돌리려면 ITEM_SOLID_FLAT 을 0 으로 — 이 함수 본문을 고치지 말 것.
   ⚠️ 가구류(책상 swapDeskVisual · 아이템 registerCustomItem)의 톤은 앞으로 여기만 고칠 것. */
function _applyItemMatTone(m){
  if(!m) return;
  _fixGlbMatLighting(m);   // ★ 여기가 캐릭터와 갈라져 있던 자리 — 예전엔 텍스처 없는 재질만 눕혔다
  if(m.map){
    if(!m.emissiveMap) m.emissiveMap = m.map;
    if(m.emissive){
      if(m.color) m.emissive.copy(m.color).multiplyScalar(FLAT_EMISSIVE);
      else m.emissive.setScalar(FLAT_EMISSIVE);
    }
    m.userData = m.userData || {}; m.userData.baseFlat = FLAT_EMISSIVE;
  } else {
    /* ★ solid(map 없는) 메쉬 — 파츠와 같은 규칙으로 flat 을 얹는다(ITEM_SOLID_FLAT).
       ⚠️ 여기에 숫자를 적지 말 것. 예전에 0 이 박혀 있어서 아이템만 어두웠다. */
    if(m.emissive){
      if(m.color) m.emissive.copy(m.color).multiplyScalar(ITEM_SOLID_FLAT);
      else m.emissive.setScalar(ITEM_SOLID_FLAT);
    }
    m.userData = m.userData || {}; m.userData.baseFlat = ITEM_SOLID_FLAT;   // _col 색을 바꿀 때 같은 배율로 재계산
  }
  // KHR_materials_emissive_strength 로 1 을 넘겨 들어온 배율도 여기서 눕힌다 —
  // 위에서 emissive 색을 덮어써도 이 배율이 살아 있으면 클램프가 그대로 남는다.
  if('emissiveIntensity' in m) m.emissiveIntensity = 1;
  m.needsUpdate = true;
}

/* 🎨 책상 색을 바꾸는 **단 하나의 자리**.
   [경위] 예전엔 곳곳에서 `deskMat.color.set(색)` 만 했다. 이 코드베이스는 플랫 조명을
     emissive 로 얹는 구조라(_applyPartMatTone·_applyItemMatTone → userData.baseFlat),
     색만 갈면 **예전 색의 발광이 새 색 위에 그대로 더해진다** — 화면이 팔레트보다 밝고
     채도가 씻겨 보인다(제보: "기본·커스텀 책상만 색이 안 맞는다. 책상 위 아이템은 멀쩡").
     아이템이 멀쩡했던 이유는 그쪽 _col 경로가 색을 바꿀 때마다 baseFlat 으로 emissive 를
     다시 계산하고 있어서다. 책상만 그 계산이 빠져 있었다.
   ★ 기본 책상(하드코딩 matWood)은 애초에 emissive 가 0 이라 조명 예산 밖이었다 —
     정면 기준 FLAT_EMISSIVE(≈0.37) 만큼 통째로 어두웠다. 여기를 지나면 파츠·아이템·캐릭터와
     같은 총합(TONE_FRONT_TOTAL)을 받아서 고른 색이 화면에 그대로 나온다.
   ⚠️ 앞으로 책상 색을 바꾸는 코드는 예외 없이 이 함수를 부를 것. 한 곳이라도 color.set 을
     직접 쓰면 그 경로만 다시 어긋난다(그게 이 버그의 정체였다). */
function _setDeskMatColor(m, color){
  if(!m || !m.color) return;
  if(color != null) m.color.set(color);
  m.userData = m.userData || {};
  /* baseFlat 은 GLB 책상이면 _applyItemMatTone 이 이미 심어뒀다. 하드코딩 기본 책상에는
     없으므로 여기서 solid 규칙(ITEM_SOLID_FLAT)으로 처음 심는다 — 숫자를 직접 쓰지 말 것. */
  if(m.userData.baseFlat == null) m.userData.baseFlat = m.map ? FLAT_EMISSIVE : ITEM_SOLID_FLAT;
  if(m.emissive) m.emissive.copy(m.color).multiplyScalar(m.userData.baseFlat);
  if('emissiveIntensity' in m) m.emissiveIntensity = 1;   // GLB 가 1 을 넘겨 왔으면 여기서 눕힌다
  m.needsUpdate = true;
}

/* ===== 관리자 모드 =====
   진입: Ctrl(Mac 은 ⌘) 누른 채로 후원 · 캐릭터 생성 · 꾸미기 · 광고배너 중 하나를 한 번 클릭 → 비밀번호 창(bindAdminTrigger)
   비밀번호: 입력값의 SHA-256 을 ADMIN_PASS_HASH 와 비교한다.
   TODO: 비밀번호 교체. 비밀번호 대신 로그인 계정의 admins 등록 여부로 여는 방식 검토.
   세션 단위로만 유지 (브라우저 닫으면 자동 해제). 우상단에 🔧 배지 표시, 클릭하면 종료.
   관리자만 가능: 책상·아이템 코드 등록 (커미션 판매자 작업)
*/
const ADMIN_PASS_HASH = 'e33bd90cf3f9275efe7f408f8a435bbeadc9d22e42601d37b68dfba281661a35';
let isAdmin = false;

/* ============================================================ 라이선스 (직접 발급) — 프리미엄(꾸미기) 잠금 해제
   관리자가 관리자 모드에서 키를 직접 발급 → 구매자에게 전달(직거래) → 구매자가 앱에 입력하면
   Firebase(licenses/{key})에서 유효성 확인 → 통과 시 로컬(localStorage)에 저장. */
/* ═══════════════════════ 🎟️ 초대장 (앱 접근 제한) ═══════════════════════
   정책:
     · 기존 유저(users/{uid}가 이미 있음) → 무조건 통과 + 초대권 5장 부여(최초 1회, grandfather)
     · 초대 코드로 들어온 신규 유저 → 초대권 0장 → 확산이 1세대에서 멈춤
     · 관리자 → 무제한 발급 + 유저에게 초대권 추가 지급 가능
   ⚠️ 스위치는 원격 설정 flags.inviteGate(remote-config.js · API · 없으면 true). false면 게이트가 아예 안 뜬다.
      부팅 때 한 번 정한다 — initInviteGate 가 첫 답을 잠깐 기다린 뒤 checkInviteGate 를 부른다(못 읽으면 true).
──────────────────────────────────────────────────────────────────── */
let isPremium = false;   // 프리미엄 여부 — 여러 모듈이 읽어 app.js 에 둔다. 바꾸는 곳은 license-gate.js 의 _setPremium 하나
/* 본문은 license-gate.js 로 옮겼다(앱 FSD 31번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LICENSE_GATE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const licenseGateMod = (typeof TwLicenseGate === 'undefined') ? LICENSE_GATE_MOD_OFF : TwLicenseGate.createLicenseGate({
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  FRIEND_CODE_LOGIN_RE: ()=>accountMod.FRIEND_CODE_LOGIN_RE,
  HAD_USER_ID_AT_BOOT: HAD_USER_ID_AT_BOOT,
  LOGIN_EMAIL_KEY: ()=>accountMod.LOGIN_EMAIL_KEY,
  LOGIN_UID_KEY: ()=>accountMod.LOGIN_UID_KEY,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  _applyTransferSnapshot: (...a)=>accountMod._applyTransferSnapshot(...a),
  _inventMyUserId: (...a)=>_inventMyUserId(...a),
  _loginDoFriendCode: (...a)=>accountMod._loginDoFriendCode(...a),
  _loginDoGoogle: (...a)=>accountMod._loginDoGoogle(...a),
  _loginLocalSnapshot: (...a)=>accountMod._loginLocalSnapshot(...a),
  _setMyUserId: (...a)=>_setMyUserId(...a),
  applyDeskCatalogRefToSeat: (...a)=>applyDeskCatalogRefToSeat(...a),
  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),
  awayPicMod: ()=>awayPicMod,
  creatorOpen: ()=>creatorOpen,
  genFriendCodeCandidate: (...a)=>genFriendCodeCandidate(...a),
  getMyLoginEmail: (...a)=>accountMod.getMyLoginEmail(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  myInfoMod: ()=>myInfoMod,
  pruneUnownedLicenseAssets: (...a)=>premiumMod.pruneUnownedLicenseAssets(...a),
  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),
  refreshCustomStatusMenuItem: (...a)=>refreshCustomStatusMenuItem(...a),
  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),
  renderCrItems: (...a)=>renderCrItems(...a),
  restoreLicenseHeldAssets: (...a)=>premiumMod.restoreLicenseHeldAssets(...a),
  seats: seats,
  setUserStatus: (...a)=>setUserStatus(...a),
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatus,
  setIsPremium: (v)=>{ isPremium = v; },
});


/* 📊 전체 통계 · 🎟️ 초대권 지급(관리자) — admin/admin-users.js. 초대장 구역 모듈(license-gate.js) 밖, 여기서 만든다(모듈 연결은 app.js). */
const ADMIN_USERS_OFF = {};   // 모듈이 없으면 빈 껍데기
const adminUsers = (typeof TwAdminUsers === 'undefined') ? ADMIN_USERS_OFF : TwAdminUsers.createAdminUsers({
  toast: (...a)=>toast(...a),
  inviteGrantMax: licenseGateMod.INVITE_GRANT_MAX,
});

/* ═══ 🪑 [2026-09-18 제보 2] 라이선스 없는 기기에 남은 전용 자산을 **접어 둔다** ═══════════
   [증상] 제보자(보유자) 화면에서 친구(미보유)가 가판대 책상을 착용한 것으로 보인다. 친구 화면에는
     안 보이고, 방을 나갔다 들어오거나 런처를 껐다 켜도 유지된다.
   [원인] 게이트가 **그리기만 막고 저장·전파는 안 막는다.**
     · applyDeskCatalogRefToSeat 의 게이트는 `!seat.remote` 라 내 좌석에만 걸린다(그것은 의도이고 옳다 —
       빼면 보유자 친구의 책상이 미보유자 화면에서만 기본 책상으로 보인다. 옛 제보다).
     · 그런데 게이트에 걸린 쪽은 charDef.deskCatalogId 를 **그대로 들고 있고**, 그 값이
       serializeDefForNetwork(Object.assign 통째 복사)를 타고 방으로 나간다. 받는 쪽은 remote 라
       게이트 없이 그린다. 저장값이라 재입장·재시작에도 남는다.
   [왜 지우지 않고 접어 두는가] 라이선스는 키 한 줄이면 다시 켜진다(activateLicense ·
     _applyTransferSnapshot 의 r.license). 지워 버리면 재등록해도 책상이 안 돌아온다 — 그것이
     예전에 「charDef 는 손대지 않는다」로 결정한 이유였다. 그래서 값을 **옮겨 적는다**:
       deskCatalogId → deskLicenseHold · deskItems[id] → deskItemsLicenseHold[id]
       · 좌석은 기본 책상으로 떨어진다(내 화면에서 해제된다)
       · serializeDefForNetwork 가 이 두 필드를 빼므로 **친구 화면에서도 사라진다**
       · 라이선스가 켜지면 restoreLicenseHeldAssets 가 그대로 되돌린다
   ⚠️ **카탈로그가 도착하기 전에는 아무것도 안 한다.** licenseOnly 는 savedDesks/savedItems 의
     레코드에만 있다. 조회 실패를 「전용 아님」으로도 「전용」으로도 단정하지 않는다 —
     pruneUnownedGachaParts 가 savedParts 조회 실패를 다루는 관례와 같다.
   ⚠️ **위조 방어가 아니다.** 라이선스는 localStorage 에 있고 계정에 안 묶인다(_setPremium 위 주석).
     이것은 «남은 저장값 청소» 이고, 서버 규칙으로 막는 일과 섞지 말 것.
   ★ 조용히 돈다 — 토스트가 없다. 못 쓰는 것을 원래대로 되돌리는 일이라 사용자에게 알릴 사건이
     아니라는 결정(2026-09-18). 콘솔에는 남겨서 다음 제보 때 읽을 수 있게 한다.
   ★ 이 둘은 **한 쌍**이다. 접기만 두고 되돌리기를 빠뜨리면 라이선스를 등록해도 책상이 안 돌아온다
     — sim-license-leak.js 가 그 짝을 본다. */
/* (앱 FSD 37번) 이 자리의 본문도 premium-assets.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🔐 라이선스 · 초대 게이트 시작 · 관리자 모드 진입 ═══ */
// 앱 시작 시: 로컬에 저장된 키가 있으면 일단 프리미엄으로 간주(오프라인에서도 꾸미기 사용 가능하게),
// 동시에 백그라운드로 재검증해서 (관리자가 비활성화한 경우 등) 무효화됐으면 조용히 잠금.
(function initLicense(){
  const key = licenseGateMod.loadLicenseFromStorage();
  if(key){
    // firebaseAPI가 module script 로드 지연으로 아직 없을 수 있으니 준비될 때까지 기다렸다 재검증
    const doVerify = () => licenseGateMod.verifyLicense(key).then(r=>{
      if(!r.ok && !r.offline){ try{localStorage.removeItem(licenseGateMod.LICENSE_KEY_STORAGE);}catch(e){} licenseGateMod._setPremium(false); }   // 회수된 키 — 내 책상도 같이 기본으로 돌아간다
    });
    if(window.firebaseAPI) doVerify();
    else window.addEventListener('firebase-ready', doVerify, { once:true });
  }
})();

// 🎟️ 앱 시작 시 초대장 게이트 — firebaseAPI가 준비된 뒤에 확인.
//   원격 설정 inviteGate 가 false면 checkInviteGate가 즉시 통과시키므로 아무 일도 안 일어남.
//   ★ 이 PC 저장값이 있으면 기다리지 않는다 — 저장값으로 바로 판단하고, 새 값은 뒤에서 받아 다음 부팅부터.
//     저장값이 없을 때(처음 켠 PC)만 두 스위치의 첫 답을 최대 3초 기다린다 — 못 받으면 기본값(true · 예전 동작).
const REMOTE_FLAGS_WAIT_MS = 3000;
(function initInviteGate(){
  const run = async ()=>{
    const _s = licenseGateMod._rcStore();
    if(_s && _s.source() === 'default'){ try{ await _s.ready(['inviteGate','existingSignup'], REMOTE_FLAGS_WAIT_MS); }catch(_){} }
    licenseGateMod.checkInviteGate()
      .then(()=>{ licenseGateMod.refreshInviteBtn(); return licenseGateMod._existingSignupCheck(); })   // 🪪 I — 초대 게이트를 지난 뒤 한 번(설계 §3)
      .then(shownI => (shownI ? true : licenseGateMod._needLoginCheck()))                 // 🔐 K — I 가 아니면(이미 묶인 uid) 로그인이 맞는지(§9-11)
      .catch(err=>{ console.warn('[invite] 게이트 확인 실패', err); });
  };
  if(window.firebaseAPI) run();
  else window.addEventListener('firebase-ready', run, { once:true });
})();
/* 🔐 관리자 모드(비밀번호 창 · 켜기 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl·⌘+클릭 진입)는 admin/admin-mode.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   isAdmin 을 바꾸는 곳은 그 모듈 하나다(setIsAdmin). savedParts 는 뒤에서 선언되는 let 이라 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_MODE_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminMode = (typeof TwAdminMode === 'undefined') ? ADMIN_MODE_OFF : TwAdminMode.createAdminMode({
  toast: (...a)=>toast(...a),
  refreshInviteBtn: (...a)=>licenseGateMod.refreshInviteBtn(...a),
  adminPassHash: ADMIN_PASS_HASH,
  isAdmin: ()=>isAdmin,
  setIsAdmin: (v)=>{ isAdmin = v; },
  savedParts: ()=>premiumMod.savedParts(),
});
/* ═══ 💡 얼굴 텍스처 갈아끼우기 · 생성기 조명 ═══ */
/* face material의 map을 갈아끼울 때 emissiveMap도 같이 동기화. 안 그러면 졸기 등 map 교체 시 이전 텍스처가 emissive로 남아 합성됨(blink 흐릿함 원인) */
/* 🐾 동물 귀는 몸과 다른 재질이라 이 한 줄로는 안 바뀐다 — 몸 재질에 달아 둔 등록표
   (animal.js buildAnimalBase 의 mat.userData.animalEars)를 보고 함께 갈아끼운다.
   ★ 여기서 처리하는 이유: 깜빡임 스왑 호출부가 sleep/pet/dizzy·흔들기(31416) · 런처(24909·24910) ·
     복제 무대 복구(16135) 로 흩어져 있다. 호출부마다 귀 코드를 넣으면 언젠가 한 곳이 빠져
     "몸은 눈 감았는데 귀만 뜬" 상태가 된다. 전부 이 함수를 지나가므로 여기 한 곳이면 충분하다.
   ⚠️ 인간 캐릭터도 이 함수를 쓴다 — userData 표식이 없으면 예전과 똑같이 동작한다. */
function setFaceMap(mat, tex){ if(!mat||!tex)return; mat.map=tex; mat.emissiveMap=tex; mat.needsUpdate=true;
  const ud=mat.userData;
  if(ud && ud.animalEars && ud.animalEars.length){
    const closed = (tex === ud.animalBlinkTex);
    for(const e of ud.animalEars){
      const t = closed ? e.bT : e.fT;
      if(e.mat && t && e.mat.map!==t){ e.mat.map=t; e.mat.emissiveMap=t; e.mat.needsUpdate=true; }
    }
  }
}
/* 💡 표정 그리기 «원색 보기» 버튼(미리보기 오른쪽 아래). 모듈이 없어도 생성기는 그대로 돈다. */
const crFlatView = (typeof CreatorFlatView === 'undefined') ? null : CreatorFlatView.createCreatorFlatView({
  btn: document.getElementById('cpFlat'), badge: document.getElementById('cpFlatBadge'),
  onChange: ()=>updateCreatorLights()
});
if(crFlatView) document.getElementById('cpFlat').addEventListener('click', ()=>crFlatView.toggle());
function updateCreatorLights(){ if(!cAmb||!cKey)return;
  const b=LIGHT_PRESET.b, h=LIGHT_PRESET.h, e=LIGHT_PRESET.e;
  cAmb.intensity=0.95*b*e; cKey.intensity=1.0*b*e*_KEY_LIGHT_MUL;   // 밝기(strength) × 노출(조명 페이드) · 키는 정수리 배율까지
  if(cFill) cFill.intensity=1.0*b*e*_FILL_LIGHT_MUL;                // 정면 필 — 실행 화면과 같은 몫
  const col=new THREE.Color().setHSL(h,0.45,0.85);           // 색상(color)
  cKey.color.copy(col); cAmb.color.copy(col); if(cFill) cFill.color.copy(col);
  /* 💡 원색 보기 — 방향광을 끄고 흰빛 앰비언트 + emissive 합을 1 로. 칠한 색이 그대로 보인다(creator-flat-view.js). */
  if(crFlatView && crFlatView.isOn()){
    cAmb.intensity=CreatorFlatView.flatAmbient(FLAT_EMISSIVE); cAmb.color.setRGB(1,1,1);
    cKey.intensity=0; if(cFill) cFill.intensity=0;
  }
  const flat=FLAT_EMISSIVE;                                  // 플랫 조명 배율(전역 손잡이)
  if(cBase){
    if(cBase.faceMat){ if(cBase.faceMat.emissiveMap!==cBase.faceMat.map){cBase.faceMat.emissiveMap=cBase.faceMat.map;cBase.faceMat.needsUpdate=true;} cBase.faceMat.emissive.setScalar(flat); }
    if(cBase.upMat){ if(cBase.upMat.map&&cBase.upMat.emissiveMap!==cBase.upMat.map){cBase.upMat.emissiveMap=cBase.upMat.map;cBase.upMat.needsUpdate=true;} cBase.upMat.emissive.copy(cBase.upMat.color).multiplyScalar(flat); }
    if(cBase.loMat){ if(cBase.loMat.map&&cBase.loMat.emissiveMap!==cBase.loMat.map){cBase.loMat.emissiveMap=cBase.loMat.map;cBase.loMat.needsUpdate=true;} cBase.loMat.emissive.copy(cBase.loMat.color).multiplyScalar(flat); }
    if(cBase.hatMat){ if(cBase.hatMat.map&&cBase.hatMat.emissiveMap!==cBase.hatMat.map){cBase.hatMat.emissiveMap=cBase.hatMat.map;cBase.hatMat.needsUpdate=true;} cBase.hatMat.emissive.copy(cBase.hatMat.color).multiplyScalar(flat); }
  }
}
/* 메인 좌석에 들어오는 캐릭터 머티리얼에도 같은 emissive 보정 적용 — 생성기와 톤 일치 */
function applyLightPresetToInstance(inst){ if(!inst)return;
  const flat=FLAT_EMISSIVE;
  if(inst.faceMat){ inst.faceMat.emissiveMap=inst.faceMat.map; inst.faceMat.emissive.setScalar(flat); inst.faceMat.needsUpdate=true; }
  if(inst.upMat){ if(inst.upMat.map&&inst.upMat.emissiveMap!==inst.upMat.map){inst.upMat.emissiveMap=inst.upMat.map;inst.upMat.needsUpdate=true;} inst.upMat.emissive.copy(inst.upMat.color).multiplyScalar(flat); }
  if(inst.loMat){ if(inst.loMat.map&&inst.loMat.emissiveMap!==inst.loMat.map){inst.loMat.emissiveMap=inst.loMat.map;inst.loMat.needsUpdate=true;} inst.loMat.emissive.copy(inst.loMat.color).multiplyScalar(flat); }
  if(inst.hatMat){ if(inst.hatMat.map&&inst.hatMat.emissiveMap!==inst.hatMat.map){inst.hatMat.emissiveMap=inst.hatMat.map;inst.hatMat.needsUpdate=true;} inst.hatMat.emissive.copy(inst.hatMat.color).multiplyScalar(flat); }
  /* ★ 이름으로 분류 안 되는 나머지 메쉬(커미션 캐릭터의 몸통/신발/머리카락/액세서리 등)도 같은 방식으로 평탄화.
     안 그러면 그 부분만 씬 조명을 그대로 받아서 나머지(위 3개)와 톤이 달라 보인다.

     ★★ 예전에는 여기서 `if(!m.map) return;` 으로 **텍스처 없는 메쉬를 통째로 건너뛰었다.**
        그 메쉬들은 emissive 를 0 으로 둔 채 앰비언트(0.57)만 받는데, emissive 를 받는 메쉬는
        0.57+0.35=0.92 다 — 화면상 199/255 대 246/255 로 **47단계 차이**다. 같은 흰색을 지정해도
        한쪽은 흰색, 한쪽은 회색으로 보인다(제보: "둘 다 같은 하얀색인데 옷 파츠만 회색에 가깝다").
     ★ 파츠 경로(_applyPartMatTone)는 원래부터 텍스처 유무와 무관하게 전부 얹고 있었다.
       그래서 파츠는 쨍하고 캐릭터 쪽만 어두웠던 것 — 두 경로를 같은 규칙으로 맞춘다.
     ⚠️ 텍스처가 없으면 emissiveMap 도 없다. 그건 정상이다 — emissive 색 자체가 곧 평탄한 값이 된다. */
  if(inst.litMats){
    inst.litMats.forEach(m=>{
      if(m===inst.faceMat||m===inst.upMat||m===inst.loMat) return;   // 위에서 이미 처리함(중복 방지)
      if(!m || !m.emissive) return;
      if(m.map && m.emissiveMap!==m.map){ m.emissiveMap=m.map; m.needsUpdate=true; }
      if(m.color) m.emissive.copy(m.color).multiplyScalar(flat);
      else m.emissive.setScalar(flat);
      m.needsUpdate = true;
    });
  }
}
/* 조명 슬라이더 UI 제거됨 — LIGHT_PRESET 상수로 한 번 적용 */

/* ═══ 🧍 생성기 미리보기 — 렌더러 · 카메라 · 열기 · 닫기 · 완료 ═══ */
/* --- 생성기 미리보기 렌더러 --- */
let cRenderer=null,cScene=null,cCam=null,cBase=null,creatorOpen=false,cAmb=null,cKey=null,cFill=null,cDesk=null,cDeskMat=null,cFloor=null;
let camDist=1.5,camYaw=0,camPitch=0.05,orbiting=false,lastMX=0,lastMY=0;
let _rcOrbit=null;   // 우클릭 드래그 회전 상태 — {x,y,moved}. 클릭만이면 스포이드로 폴백
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
function applyStaticHandRest(root, isAnimal, typing) {
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
  // 🐾 동물은 hand 본 rest 자세가 달라 인간 값(-1.0)을 주면 만세 자세가 됨 — 전용 값을 쓴다.
  //   (인자를 안 넘기는 기존 호출부 3곳은 예전과 동일하게 인간 값 · 리프트 없음 — 동작 변화 없음)
  // 🐾 typing=true면 실행 화면의 타이핑 자세(baseArmRot + FOCUS_ARM_LIFT)와 같은 각도로 맞춘다.
  //   책상·좌석 세팅 화면은 '책상 앞에 앉은 모습'을 보는 곳이라 정지 자세보다 작업 자세가 맞다는 판단.
  const _restRot = isAnimal ? ANIMAL_HAND_REST : HAND_REST;
  const _liftRot = typing ? FOCUS_ARM_LIFT : 0;
  const _be = new THREE.Euler(_restRot + _liftRot, 0, 0, 'XYZ');
  const _bq = new THREE.Quaternion().setFromEuler(_be);
  if (handL) handL.quaternion.multiply(_bq);
  if (handR) handR.quaternion.multiply(_bq);
}
function ensureCreatorPreview(){
  if(cRenderer)return;
  cRenderer=new THREE.WebGLRenderer({canvas:document.getElementById('creatorPreview'),antialias:true,alpha:true,preserveDrawingBuffer:true});
  cRenderer.setPixelRatio(Math.min(devicePixelRatio,2));cRenderer.outputEncoding=THREE.sRGBEncoding;cRenderer.toneMapping=THREE.NoToneMapping;cRenderer.setSize(222,300,false);
  cScene=new THREE.Scene();cAmb=new THREE.AmbientLight(0xfdfbf7,0.95);cScene.add(cAmb);   // 색 왜곡 방지 위해 거의 백색광
  cKey=new THREE.DirectionalLight(0xfdfaf5,1.0);cKey.position.set(0,4,0);cScene.add(cKey);
  /* ★ 정면 필 — 실행 화면과 같은 배치. 없으면 생성기에서는 옷 앞면이 앰비언트만 받아
     실행 화면보다 어둡게 보인다(두 화면의 톤이 갈라지는 자리다). 세기는 updateCreatorLights 가 정한다. */
  cFill=new THREE.DirectionalLight(0xfdfaf5,1.0);cFill.position.set(0.5,1.0,3);cScene.add(cFill);
  cCam=new THREE.PerspectiveCamera(34,222/300,0.1,100);
  const inst=instantiateBase();
  if(inst){ setFaceMap(inst.faceMat, dispTex);
    if(inst.upMat)inst.upMat.color.set(cTopColor); if(inst.loMat)inst.loMat.color.set(cBotColor);
    if(inst.hatMat)inst.hatMat.color.set(cTopColor);   // 🎩 기본 모자도 상의색
    applyStaticHandRest(inst.root); // 생성창 기본 프리뷰에 팔 높이 반영
    normalizeModel(inst.root,1.45); cScene.add(inst.root);
    cBase={group:inst.root,faceMat:inst.faceMat,upMat:inst.upMat,loMat:inst.loMat,hatMat:inst.hatMat,face:inst.faceMesh,
      // ★ applyClothVisibility가 파츠 장착 시 기본 메쉬(모자 등)를 숨길 수 있게 좌석과 동일한 참조 세트 유지
      upMesh:inst.upMesh||null,loMesh:inst.loMesh||null,glassesMesh:inst.glassesMesh||null,hatMesh:inst.hatMesh||null,
      maskMesh:inst.maskMesh||null,onepieceMesh:inst.onepieceMesh||null,wingMesh:inst.wingMesh||null,
      handLMesh:inst.handLMesh||null,handRMesh:inst.handRMesh||null,capeMesh:inst.capeMesh||null};
    extractBonesInto(cBase, inst.root);   // 꾸미기 파츠를 붙일 본(부착점) 정보 채워넣기 — 캐릭터 세팅 미리보기에도 파츠가 보이게
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
    const dt=cDesk.getObjectByName('deskTop'); if(dt){ dt.material=dt.material.clone(); cDeskMat=dt.material; _setDeskMatColor(cDeskMat, cDeskColor); }
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
  // ★ 커미션 캐릭터는 COMMISSION_SCALE_CORRECTION만큼 추가 보정(15% 키움 등) — 아래 두 분기 모두 적용.
  const commCorr = isCommissionEditing() ? COMMISSION_SCALE_CORRECTION : 1;
  if(mode==='edit'){
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,0,0); g.updateWorldMatrix(true,true);
    let refBox=measureCharBox(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    const s=(refSize.y>1e-4?1.5/refSize.y:1)*commCorr; g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=measureCharBox(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    /* 🪑 앞뒤(z)는 fitModel 과 **같은 규약**이어야 한다 — 그쪽에서 재센터링(-c.z)을 뺐으므로
       여기서도 뺀다. 한쪽만 두면 생성기에서 맞춘 앞뒤가 실행 화면과 c.z 만큼 어긋난다
       (그 항이 파츠에 따라 변하는 값이라 어긋나는 양도 파츠마다 달라진다).
       ⚠️ 되돌릴 때는 fitModel 의 같은 줄과 **함께** 되돌릴 것. */
    g.position.x+=(0-c.x); g.position.y = charFootFix(b2);   // 🦶 피봇 보정 — fitModel 과 짝(charFootFix 주석)
    // 🦶 바닥 맞춤 — 실행 화면(fitModel)과 **같은 보정**이어야 한다. 한쪽만 넣으면
    //   생성기에서 맞춘 높이와 실행 화면이 발밑 파츠 깊이만큼 어긋난다.
    g.position.y += measureUnderfootDepth(g);
  } else {
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,RIG_TURN+cXform.rot,0); g.updateWorldMatrix(true,true);
    let refBox=measureCharBox(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    // 🐾 동물은 '측정' 대신 확정 공식으로 — 실행 화면(fitModel)과 같은 원리.
    //   buildAnimalBase가 기록해둔 정규화 배율(animNormScale: raw → animNormH)에
    //   목표 높이 비율(1.45 / animNormH)을 곱하면 측정 없이 정확히 1.45×cXform.s 높이가 된다.
    //   측정 경로는 귀 부착 타이밍에 따라 값이 흔들려서 생성기 캐릭터 크기가 들쭉날쭉했고,
    //   책상은 고정이라 "생성기와 실행의 책상 비율이 다르다"로 드러났다.
    //   ★ 기록이 없으면(구버전 경로 등) 기존 측정 방식으로 폴백. 인간·커미션은 그대로 측정 경로.
    const _anS = (isAnimalEditing() && g.userData && g.userData.animNormScale && g.userData.animNormH)
      ? g.userData.animNormScale * (1.45 / g.userData.animNormH) * cXform.s
      : null;
    const s = (_anS != null) ? _anS : (refSize.y>1e-4?1.45/refSize.y:1)*cXform.s*commCorr;
    g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=measureCharBox(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    /* 🪑 앞뒤(z)는 fitModel 과 **같은 규약**이어야 한다 — 그쪽에서 재센터링(-c.z)을 뺐으므로
       여기서도 뺀다. 한쪽만 두면 생성기에서 맞춘 앞뒤가 실행 화면과 c.z 만큼 어긋난다
       (그 항이 파츠에 따라 변하는 값이라 어긋나는 양도 파츠마다 달라진다).
       ⚠️ 되돌릴 때는 fitModel 의 같은 줄과 **함께** 되돌릴 것. */
    g.position.x+=(0-c.x);
    /* 🧍 높이(y) — 앞뒤 슬라이더를 대체한 값. 여기가 세 화면(생성기·꾸미기 미리보기·실행)의 기준이다.
       ⚠️ g.scale 에 안 물린 절대값이다 — fitModel 이 _uz 로 나누는 이유가 이것이다.
       🚫 앞뒤(cXform.z)는 폐기 — CHAR_Z(책상과의 기본 간격)만 남는다. 옛 저장값은 로드 때 0 으로 죽는다. */
    g.position.y = clampCharY(cXform.y) + charFootFix(b2); g.position.z+=CHAR_Z;   // 🦶 피봇 보정 — fitModel 과 짝
    g.position.y += measureUnderfootDepth(g);   // 🦶 바닥 맞춤 — 위 'edit' 분기와 같은 이유
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
  // 1~4단계(피부/표정/감은눈/색상)는 사람용 — 동물은 동물 생성기로, 커미션은 막고 책상(5)에 머문다
  if(_editRoute){
    const r=_editRoute.stepRoute(currentCreatorDef, n);
    if(r.animal && reopenAnimalFromCreator('blink')) return;
    if(r.toast) toast(r.toast);
    n = r.animal ? 5 : r.step;
  } else if(isDeskSeatOnly() && n<5){
    if(isCommissionEditing()) toast('커미션 캐릭터는 수정할 수 없어요.');
    n = 5;
  }
  crStep=n;
  /* 🎨 안전망 — 색 스와치는 «값을 넣은 쪽»이 맞춰 줘야 하는데, 그걸 잊는 사고가 실제로 났다.
     단계 이동은 색 화면이 보이기 직전에 반드시 지나가는 자리라 여기서 한 번 더 맞춘다(요소 셋, 비용 없음). */
  _syncCrColorSwatches();
  if(n===3 && !blinkEdited){ const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); histB.length=0; redoB.length=0; }  // 아직 감은눈을 안 고쳤으면 최신 표정을 복사해서 시작
  const draw=isDrawStep(), skin=(n===1), color=(n===4), faceView=(n<=3);
  if(crFlatView) crFlatView.show(draw);   // 그리기 단계에서만 · 벗어나면 원래 조명으로
  const stage = n<=4?0 : (n===5?1:2);
  showEl('charStage', n<=4); showEl('deskStage', n===5); showEl('seatStage', n===6);
  document.getElementById('skinRow').style.display=skin?'flex':'none';
  document.getElementById('crTools').style.display=draw?'flex':'none';
  document.getElementById('penHint').style.display=draw?'block':'none';
  if(!draw && stampMode) setStampMode(false);   // 표정 단계 벗어나면 도장 모드 해제
  document.getElementById('blinkResetBtn').style.display=(n===3)?'inline-block':'none';
  /* 🙂 [⟳ 감은눈 복사]는 2단계에서만. 감은눈을 한 번도 안 고쳤으면 그 캔버스는 비어 있어
     복사할 것이 없다 — 눌리면 표정이 지워지므로 잠그고, **왜 잠겼는지 툴팁에 적는다**
     (그냥 흐려만 두면 "버튼이 고장났다"가 된다). */
  const _fcb=document.getElementById('faceCopyBlinkBtn');
  if(_fcb){
    _fcb.style.display=(n===2)?'inline-block':'none';
    _fcb.disabled = !blinkEdited;
    _fcb.title = blinkEdited ? '감은눈 그림을 표정으로 가져와요 (되돌리기 가능)'
                             : '아직 감은눈을 그린 적이 없어요 — 3단계에서 먼저 그려주세요';
  }
  document.getElementById('crColors').style.display=color?'flex':'none';
  document.getElementById('crHint').textContent =
    n===1?'피부색을 골라주세요':
    n===2?'얼굴을 클릭·드래그해 표정을 그려요 · 휠=확대 · ◀▶=회전':
    n===3?'2단계 표정이 복사됐어요 — 눈을 감은 모양으로 고쳐요':
          '상의·하의 색을 골라주세요 (전체 모습)';
  const sp=document.getElementById('crSteps').children;
  [...sp].forEach((el,i)=>{el.classList.toggle('on',i===n-1);el.classList.toggle('done',i<n-1);
    // 커미션이면 1~4단계 탭을 시각적으로 잠금 (회색·비활성)
    if(isDeskSeatOnly() && i<4){ el.style.opacity='0.35'; el.style.textDecoration='line-through'; el.title=isAnimalEditing()?'동물 얼굴은 동물 생성기에서 편집':'커미션 캐릭터는 수정할 수 없어요'; }
    else { el.style.opacity=''; el.style.textDecoration=''; el.title=''; }
  });
  const stg=document.getElementById('crStages').children;
  [...stg].forEach((el,i)=>{el.classList.toggle('on',i===stage);el.classList.toggle('done',i<stage);});
  document.getElementById('crPrev').style.display=n>1?'block':'none';
  document.getElementById('crNext').style.display=n<6?'block':'none';
  document.getElementById('crDone').style.display=n===6?'block':'none';
  if(n===5){ renderCrItems(); }
  if(n===6){ document.getElementById('crScale').value=cXform.s;
    document.getElementById('crZ').value=clampCharY(cXform.y); document.getElementById('crRot').value=cXform.rot; }   // 🧍 crZ = 높이 슬라이더
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
  // ★ 꾸미기 창이 켜진 채로 생성기를 열면 같은 종류의 "떠 있는 채 안 닫힘" 문제가 생길 수 있어 미리 닫음(저장하며 — backToLauncher 와 같다).
  const wp=document.getElementById('wardrobePanel');
  if(wp && wp.classList.contains('on') && typeof window.closeWardrobe==='function'){ try{ window.closeWardrobe(); }catch(_){} }
  if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  creatorMode=mode||{kind:'slot',edit:false};
  // ★ 진입 시점에 런처 화면이 보이고 있었는지 기록 — 아래에서 launcher의 'on'을 강제로 뺄 것이므로,
  //   완료/닫기 시 이 값을 보고 되돌려야 함(안 그러면 런처에서 우클릭 수정 후 완료 눌렀을 때 화면이 통째로 사라짐).
  creatorMode.cameFromLauncher = document.getElementById('launcher').classList.contains('on');
  let src=null;
  if(creatorMode.kind==='slot'&&creatorMode.edit) src=slots[creatorMode.slot];
  if(creatorMode.kind==='seat') src=creatorMode.seat.charDef;
  currentCreatorDef = src;   // 커미션 여부 등 판정용 (gotoStep·잠금에서 사용)
  // 🐾 동물 편집은 모양(동물 생성기)부터 — 거기서 [다음 → 책상·좌석] 이 fromAnimal 을 달고 다시 이리로 온다
  if(_editRoute && _editRoute.entryRoute(src, creatorMode)==='animal' && reopenAnimalFromCreator('face')) return;
  faceC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);blinkC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
  histF.length=0;histB.length=0;redoF.length=0;redoB.length=0;
  if(src){faceC.getContext('2d').drawImage(src.face,0,0);blinkC.getContext('2d').drawImage(src.blink,0,0);cTopColor=src.top;cBotColor=src.bot;skinIndex=src.skin||0;}
  else{cTopColor='#9dba8a';cBotColor='#d98e73';skinIndex=0;}
  if(cBase) cBase.charDef = src;   // applyPartXf가 파츠별 위치/크기(xf)를 찾을 때 필요 — 실제 파츠 부착은 베이스 재구성 이후(swapCreatorBaseTo* 다음)에 함
  blinkEdited=!!src;   // 편집이면 기존 감은눈 유지, 신규면 3단계에서 표정을 복사해 시작
  document.getElementById('topColor').value=cTopColor;document.getElementById('botColor').value=cBotColor;
  _syncCrColorSwatches();   // ★ value 대입은 input 이벤트를 안 낸다 — 스와치는 여기서 직접 맞춘다
  [...document.getElementById('skinRow').children].forEach((x,j)=>x.classList.toggle('on',j===skinIndex));
  if(cBase){ if(cBase.upMat)cBase.upMat.color.set(cTopColor); if(cBase.loMat)cBase.loMat.color.set(cBotColor); if(cBase.hatMat)cBase.hatMat.color.set(cTopColor); }
  updateCreatorLights();   // 수정 진입 시에도 emissive 톤 갱신
  /* 🧍 높이는 살리고 앞뒤는 죽인다 — z 는 폐기된 값이라 옛 저장본이 무엇을 갖고 있든 0 으로 읽는다.
     ★ 이 함수 말고도 읽는 자리가 넷 더 있다(applyCharToSeat · 런처 미리보기 · 꾸미기 미리보기 ·
       프리셋 로드). 전부 0 으로 죽여야 "어느 화면에서만 옛 앞뒤가 살아 있는" 상태가 안 생긴다. */
  cXform = (src&&src.xf) ? {s:src.xf.s, y:clampCharY(src.xf.y), z:0, rot:src.xf.rot} : {s:0.7,y:0,z:0,rot:0};
  // ★ 방어: 예전 저장 데이터에 xf.s가 없거나 0이면 cXform.s가 0이 되어 fitCreator에서 캐릭터 크기가
  //   0으로 계산되던 버그(첫 진입 시 캐릭터 축소 원인). 유효한 값(>0)이 아니면 기본 슬라이더 중간값으로.
  if(!(typeof cXform.s==='number' && isFinite(cXform.s) && cXform.s>0)) cXform.s = 0.7;
  cXform.y = clampCharY(cXform.y);   // 🧍 NaN·음수·상한 초과를 한 곳에서 정리
  cXform.z = 0;                      // 🚫 폐기
  if(typeof cXform.rot!=='number' || !isFinite(cXform.rot)) cXform.rot = 0;
  faceCamSaved=null; deskCamSaved=null;
  cDeskColor = (src&&src.deskColor) || '#c9a36a';
  if(cDeskMat) cDeskMat.color.set(cDeskColor);
  customItems={}; cDeskTemplate=null; cDeskGlbB64=null; cDeskScale=clampDeskScale((src&&src.deskScale)||DESK_SCALE_DEFAULT);
  cDeskPos = (src && src.deskPos) ? {x:+src.deskPos.x||0, y:+src.deskPos.y||0, z:+src.deskPos.z||0} : {x:0,y:0,z:0};   // 세션 커스텀 에셋 초기화(기본은 슬라이더 중간값, 범위 벗어난 옛날 값은 clamp)
  cDeskLenX = (src&&src.deskLenX) || 1;
  const lenEl=document.getElementById('deskLenX'); if(lenEl) lenEl.value=cDeskLenX;
  activeCustomDeskId=null;
  if(cDesk){ setCreatorDeskScale(cDeskScale); setDeskPos(cDesk, cDeskPos); updateDeskPosNum(); }
  if(cBase){ applyCreatorXform(); clearCreatorItems(); clearCreatorParts();   /* 🪑 이전 세션의 '책상 위' 파츠까지 걷어낸다(아래 applyEquippedPartsToSeat 가 다시 붙인다) */
    if(cDesk)cDesk.userData.deskScale=cDeskScale; swapDeskVisual(cDesk,null);
    (async()=>{
      if(src&&src.deskCatalogId){
        const m=commissionMod.savedDesks().find(d=>d.id===src.deskCatalogId);
        /* 🔒 [2026-09-15] 라이선스가 빠진 뒤 남은 전용 책상 참조는 생성기에 싣지 않는다 — 실으면 저장 때
           deskCatalogId 가 다시 굳어 실행 화면에서 매번 기본 책상으로 떨어지는 상태가 이어진다. 기본 책상으로 열린다. */
        if(m && m.licenseOnly && !isPremium && !isAdmin){ toast('🔒 "'+(m.name||'이 책상')+'"은(는) 라이선스 보유자만 사용할 수 있어요 — 기본 책상으로 열어요'); }
        else if(m){
          if(!m.glb && m.glbUrl){
            try{ await resolveCatalogGlb(m); }catch(_){}
          }
          try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(m.glb)); cDeskGlbB64=m.glb; cDeskTemplate=sc; activeCustomDeskId=m.id;
            swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor); }catch(e){}
        }
      } else if(src&&src.deskGlb){ cDeskGlbB64=src.deskGlb; try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(src.deskGlb)); cDeskTemplate=sc; swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor);
        const m=commissionMod.savedDesks().find(d=>d.glb===src.deskGlb); if(m) activeCustomDeskId=m.id;
      }catch(e){} } else {
        const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
        if(ov){
          if(!ov.glb && ov.glbUrl){
            try{ await resolveCatalogGlb(ov); }catch(_){}
          }
          try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb)); swapDeskVisual(cDesk,sc,true); applyDeskColorToCustom(cDesk,cDeskColor);
            // ★ 코드베이스의 다른 swapDeskVisual 호출부(8381·8399·8407·9241·13717·13720·13721)는 전부
            //   직후에 setCreatorDeskScale로 크기를 다시 먹인다. 이 '기본 책상 override' 분기만 빠져 있어서
            //   교체 전 스케일 상태에 의존하고 있었다 — 실행 경로(applyDeskCatalogRefToSeat)와 동일하게 맞춤.
            setCreatorDeskScale(cDeskScale);
          }catch(e){ console.warn('[생성기] 기본 책상 GLB 파싱 실패', e); }
        }
      }
      if(src&&src.customItems){ for(const id in src.customItems){ const c=src.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod.parseGlbFull(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc,c.icon||'',animations);}catch(e){} } }
      await loadSavedItemsIntoSession();   // localStorage에 저장된 아이템 모두 customItems에 등록
      if(src&&src.deskItems) applyDeskItemsTo(cBase, src.deskItems);
      if(crStep===5) renderCrItems();
      // 런처4-2: 페이지 전환 시 활성 아이템 없으면 기즈모 숨김 (등록/삭제/재렌더 후 잔상 방지)
      if(crStep===5) attachItemGizmoToActive();
      // ★ 커스텀 책상 GLB가 이 시점에야 로드 완료됨(비동기) — 그 전에 이미 한 번 계산된 카메라 프레이밍은
      //   기본 책상 크기 기준이라, 실제 책상 크기(스케일 값 자체는 정상)와 화면에 보이는 줌이 어긋나 보이던
      //   원인. 로드가 다 끝난 지금 시점에 책상/좌석 화면이면 카메라를 다시 계산해서 맞춤.
      if(crStep===5||crStep===6){ fitCreator('app'); frameDeskCam(false); }   // 아이템도 비동기로 늦게 붙을 수 있어 크기·카메라 둘 다 다시 계산
    })();
  }
  document.getElementById('creatorOverlay').classList.add('on');document.getElementById('launcher').classList.remove('on');
  creatorOpen=true;
  if(crFlatView) crFlatView.set(false);   // 지난번에 켜 둔 원색 보기를 다음 열기로 끌고 오지 않는다
  // 커미션 캐릭터면 책상 세팅(5단계)부터 진입 + cBase의 베이스 GLB를 커미션 GLB로 교체
      if(src && src.animal){
        gotoStep(_editRoute ? _editRoute.deskStep(creatorMode) : 5);   // 🐾 동물 생성기 «좌석 세팅» 으로 왔으면 6
        swapCreatorBaseToAnimal(src).then(()=>{
          if(cBase) fitCreator('app');
          // 진단(임시) — 실행 쪽과 같은 조건(책상 GLB 비동기 로드 완료 후)에서 재야 비교가 성립한다.
          /* 🐾 착용 파츠 부착 — 이 한 줄이 **이 가지에만 빠져 있었다.**
             커미션(아래)·기본(그 아래) 두 가지는 베이스 교체 직후 applyEquippedPartsToSeat 을 부르는데
             동물만 안 불러서, 생성기 미리보기에 동물 몸만 서고 모자·안경·책상 위 파츠가 전부 안 보였다
             (제보: "동물 캐릭터 수정하면 적용한 파츠가 안 나온다"). 실행 화면(applyCharToSeat)과
             꾸미기 미리보기(refreshWdPreviewChar)는 각자 부르고 있어서 생성기에서만 나던 증상이다.
             ★ 순서가 중요하다 — swapCreatorBaseToAnimal 이 extractBonesInto 로 부착점을 다시 뽑은
               **뒤**여야 한다. 그 전에 부르면 옛 인간 본에 붙었다가 베이스와 함께 사라진다.
             ★ 부착이 끝난 뒤 fitCreator 를 한 번 더 — 파츠가 바운딩박스를 늘리므로(커미션 가지와 같은 이유). */
          if(cBase && src.equippedParts){
            applyEquippedPartsToSeat(cBase, src).then(()=>{
              if(cBase) fitCreator(crStep<=4 ? 'edit' : 'app');
            });
          }
        });
      } else if(src && src.isCommission){
        gotoStep(5);
        swapCreatorBaseToCommission(src).then(()=>{
          if(cBase && src.equippedParts){
            applyEquippedPartsToSeat(cBase, src).then(()=>{
              // ★ 파츠가 비동기로 늦게 붙는데, 그 전에 이미 계산돼서 굳어버린 크기(fitCreator)가 그대로
              //   남아있던 문제 — 부착이 끝난 시점에 지금 스텝에 맞는 모드로 다시 계산해서 맞춤.
              if(cBase) fitCreator(crStep<=4 ? 'edit' : 'app');
            });
          }
        });
      } else {
        // 💡 기다릴 필요 없이 즉시 뼈대 복구 후 1단계로 진입합니다.
        swapCreatorBaseToDefault(); 
        if(cBase && src && src.equippedParts){
          applyEquippedPartsToSeat(cBase, src).then(()=>{
            // ★ 파츠가 붙은 뒤 다시 계산 — 파츠(망토·귀 등)가 캐릭터 바운딩박스를 늘려서 refSize.y가
            //   달라짐. 첫 진입 때 파츠가 아직 안 붙은 상태로 계산된 크기가 작게 나오던 원인.
            if(cBase) fitCreator(crStep<=4 ? 'edit' : 'app');
          });
        }
        gotoStep(1);
      }
      requestAnimationFrame(creatorLoop);
      applyDesktopRunClass();
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
    cBase.group = newInst.root; cBase.faceMat = newInst.faceMat; cBase.upMat = newInst.upMat; cBase.loMat = newInst.loMat; cBase.hatMat = newInst.hatMat; cBase.face = newInst.faceMesh; cBase.blinkTex = bT;
    cBase.upMesh=newInst.upMesh||null; cBase.loMesh=newInst.loMesh||null; cBase.glassesMesh=newInst.glassesMesh||null;
    cBase.hatMesh=newInst.hatMesh||null; cBase.maskMesh=newInst.maskMesh||null; cBase.onepieceMesh=newInst.onepieceMesh||null;
    cBase.wingMesh=newInst.wingMesh||null; cBase.handLMesh=newInst.handLMesh||null; cBase.handRMesh=newInst.handRMesh||null; cBase.capeMesh=newInst.capeMesh||null;
    extractBonesInto(cBase, newInst.root);   // 베이스를 통째로 새로 만들었으니 본(부착점) 정보도 다시 추출
    normalizeModel(cBase.group, 1.45, true);
    applyCreatorXform();
  }catch(e){ console.warn('커미션 GLB 적용 실패', e); toast('커미션 캐릭터 모델 로드 실패'); }
}

/* 🐾 동물 캐릭터를 생성기 창(cBase)에 탑재 — 책상·좌석 세팅용. buildAnimalBase(animal.js) 재사용. */
async function swapCreatorBaseToAnimal(def){
  if(typeof window.buildAnimalBase!=='function'){ toast('동물 모듈을 불러오지 못했어요'); return; }
  try{
    const ab=window.buildAnimalBase(def);   // {group, root, faceMat, fT, bT, faceMesh...}
    if(!ab) return;
    if(cBase && cBase.group && cBase.group.parent){ cBase.group.parent.add(ab.root); cBase.group.parent.remove(cBase.group); }
    cBase.group=ab.root; cBase.faceMat=ab.faceMat; cBase.upMat=null; cBase.loMat=null; cBase.hatMat=null;
    cBase.face=ab.faceMesh; cBase.blinkTex=ab.bT;
    cBase.upMesh=null; cBase.loMesh=null; cBase.glassesMesh=null; cBase.hatMesh=null; cBase.maskMesh=null;
    cBase.onepieceMesh=null; cBase.wingMesh=null; cBase.handLMesh=null; cBase.handRMesh=null; cBase.capeMesh=null;
    extractBonesInto(cBase, ab.root);   // 파츠 부착점 본 재추출 (책상 소품엔 불필요하지만 일관성)
    // 🐾 팔 각도 — 이 호출이 빠져 있어서 동물만 바인드 포즈(팔이 완전히 내려간 상태)로 보였다.
    //   책상 앞에 앉은 모습이므로 실행 화면의 타이핑 자세와 같은 각도로 맞춘다(세 번째 인자 true).
    applyStaticHandRest(ab.root, true, true);
    /* ★ 페인팅·대칭 데이터 복구 — swapCreatorBaseToDefault에는 있는데 여기만 빠져 있었다.
       특히 faceCx(얼굴 좌우 중심 x)는 mirrorUV()가 붓 대칭을 반사할 때 쓰는 축이다.
       갱신하지 않으면 동물을 올린 뒤에도 '인간 얼굴의 중심'을 축으로 반사해서
       대칭 붓질이 엉뚱한 위치에 찍힌다. facePos/faceUv/faceIdx도 인간 것을 계속 가리킨다. */
    try{
      const afg = ab.faceMesh && ab.faceMesh.geometry;
      if(afg){
        cBase.facePos = afg.attributes.position ? afg.attributes.position.array : null;
        cBase.faceUv  = afg.attributes.uv ? afg.attributes.uv.array : null;
        cBase.faceIdx = afg.index ? afg.index.array : null;
        afg.computeBoundingBox();
        cBase.faceCx = (afg.boundingBox.min.x + afg.boundingBox.max.x) / 2;
      }
    }catch(e){ console.warn('[동물] 얼굴 기하 캐시 갱신 실패 — 대칭 붓질이 어긋날 수 있음', e); }
    // buildAnimalBase가 이미 60% 정규화 → 생성기에선 원래 크기로 보이도록 되돌림(책상 비율 맞추기 위해 인간과 같은 1.45)
    normalizeModel(cBase.group, 1.45, true);
    applyCreatorXform();
  }catch(e){ console.warn('[동물] 생성기 탑재 실패', e); toast('동물 모델 로드 실패 (콘솔 확인)'); }
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
  if(newInst.hatMat) newInst.hatMat.color.set(cTopColor);   // 🎩 기본 모자도 상의색
  applyLightPresetToInstance(newInst);
  
  cBase.group = newInst.root;
  cBase.faceMat = newInst.faceMat;
  cBase.upMat = newInst.upMat;
  cBase.loMat = newInst.loMat;
  cBase.hatMat = newInst.hatMat;
  cBase.face = newInst.faceMesh;
  // ★ 기본 메쉬 참조도 갱신 — 안 하면 죽은(제거된) 이전 메쉬를 가리켜 모자 숨김 등이 안 먹음
  cBase.upMesh=newInst.upMesh||null; cBase.loMesh=newInst.loMesh||null; cBase.glassesMesh=newInst.glassesMesh||null;
  cBase.hatMesh=newInst.hatMesh||null; cBase.maskMesh=newInst.maskMesh||null; cBase.onepieceMesh=newInst.onepieceMesh||null;
  cBase.wingMesh=newInst.wingMesh||null; cBase.handLMesh=newInst.handLMesh||null; cBase.handRMesh=newInst.handRMesh||null; cBase.capeMesh=newInst.capeMesh||null;
  extractBonesInto(cBase, newInst.root);   // 베이스를 통째로 새로 만들었으니 본(부착점) 정보도 다시 추출 — 안 그러면 예전 파츠가 죽은 본을 가리키게 됨

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

// ★ 이 좌석(생성기 미리보기 cBase든, 실제 실행 중인 seat든 둘 다)에 붙어있는 책상 아이템을 전부 뗌 —
//   새 아이템 목록을 적용하기 전에 반드시 먼저 호출해야 예전 아이템이 안 남음. 예전엔 DESK_ITEMS(기본
//   내장 3개)만 지웠는데, 커스텀 아이템은 안 지워지는 구멍이 있어서 allDeskItems()로 전체를 다루게 함.
function clearHolderDeskItems(holder){
  if(!holder || !holder.deskItems) return;
  allDeskItems().forEach(def=>{ if(holder.deskItems[def.id]) equipDeskItem(holder,def,false); });
  // ★ 슬롯 전환(A 캐릭터 → B 캐릭터 편집) 시 세션 아이템 목록(customItems)이 먼저 초기화되면
  //   A의 커스텀 아이템이 위 목록 순회에서 빠져 3D 오브젝트가 책상에 그대로 남던 버그 —
  //   목록에 없어도 holder에 남은 아이템은 전부 강제로 떼어낸다.
  for(const id in holder.deskItems){
    const p=holder.deskItems[id];
    if(p){ try{ if(p.parent) p.parent.remove(p); }catch(_){} holder.deskItems[id]=null; }
  }
  holder.activeDeskItem=null;
}
function clearCreatorItems(){ clearHolderDeskItems(cBase); if(deskItemOrigin) deskItemOrigin.clear(); }
/* 🪑 생성기 미리보기에 남아 있는 파츠 wrapper 를 전부 걷어낸다 — 창을 열 때마다 한 번.
   [경위] 본에 붙는 파츠는 베이스를 새로 만들 때(swapCreatorBaseTo*) 옛 root 와 함께 사라진다.
     그런데 '책상 위'(bone:'desk') 파츠는 cDesk 의 deskAnchor 에 붙고, 그 책상은
     ensureCreatorPreview 에서 딱 한 번 만들어져 창을 닫아도 살아 있다. cBase 도 속성만 갈아끼우는
     같은 객체여서 등록부(equippedPartObjs·stackedPartObjs)까지 그대로 남는다.
     → 꾸미기에서 뺀 파츠나 직전에 편집한 다른 캐릭터의 파츠가 **미리보기에만** 계속 서 있었다
       (제보: "보관함에서 비활성인데 캐릭터 수정하면 미리보기에 보인다 · 실행 화면은 정상").
     실행 화면은 좌석마다 책상을 새로 만들기 때문에 이 증상이 없다.
   ★ 순서가 중요하다 — 등록부를 **먼저** 비우고 청소를 돌린다. 등록부에 남아 있으면
     _sweepOrphanPartWrappers 가 '살아 있는 파츠'로 보고 그냥 지나친다.
   ⚠️ _equipSeq 는 일부러 안 지운다. 0 으로 되돌리면 아직 파싱 중인 옛 장착이 새 번호와 같아져
     가드를 통과하고, 지운 파츠가 뒤늦게 다시 붙는다. */
function clearCreatorParts(){
  if(!cBase) return;
  cBase.equippedPartObjs = {};
  cBase.stackedPartObjs = {};
  _sweepOrphanPartWrappers(cBase);
}
function closeCreator(){creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');
  if(deskItemOrigin) deskItemOrigin.clear();   // 🪑 처음 자리는 이번 편집에서만
  detachItemGizmo();
  clearStampState();   // 도장 이미지·모드 모두 초기화 (다음 생성/수정 진입 시 깨끗한 상태로)
  // ★ 꾸미기/미리보기 창이 켜진 채로 런처가 다시 보이면 런처를 가리던 문제 방지(방어적으로 항상 닫음)
  const wp=document.getElementById('wardrobePanel'); if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  // ★ kind==='slot'만 체크하면 런처에서 우클릭(kind==='seat')으로 들어왔다가 완료 없이 X로 닫을 때 런처가 안 돌아옴.
  //   openCreator가 진입 시 기록해둔 cameFromLauncher로 판단(afterApp 흐름은 기존대로 제외).
  if(creatorMode.cameFromLauncher && !creatorMode.afterApp){document.getElementById('launcher').classList.add('on');renderLauncher();}
  applyDesktopRunClass();}
document.getElementById('creatorClose').addEventListener('click',closeCreator);
/* 생성기 지금 상태 → def. [완료] 저장과 📦 용량 재기(forSize)가 같은 함수를 탄다 — 따로 두면 재는 것과 저장하는 것이 갈라진다.
   forSize: 그림은 복사하지 않고(재기에선 URL 자리표시로 바뀐다) 섬네일도 안 찍는다(방에 안 나간다). 결과를 저장에 쓰지 말 것. */
function _creatorBuildDef(forSize){
  const def=charDef(skinIndex, forSize ? faceC : snapCanvas(faceC), forSize ? blinkC : snapCanvas(blinkC), cTopColor, cBotColor);
  // ★ 슬롯 미리보기(캐릭터 교체/자리 추가)용 스냅샷 — 지금 생성기 3D 미리보기 화면을 그대로 캡처.
  //   런처 미리보기와 똑같은 실제 렌더 결과라 커미션 캐릭터도 진짜 모습 그대로 나옴(2D 합성 아이콘 아님).
  if(!forSize) try{ if(cRenderer && cScene && cCam){ cRenderer.render(cScene, cCam); def.thumb = cRenderer.domElement.toDataURL('image/png'); } }catch(e){}
  // 커미션 캐릭터로 진입했다면 GLB·이름·플래그를 새 def에 복사 (안 그러면 기본 GLB로 돌아감)
  if(currentCreatorDef && currentCreatorDef.isCommission){
    def.isCommission = true;
    def.commName = currentCreatorDef.commName || '커미션';
    def.commGlb = currentCreatorDef.commGlb || null;
  }
  // ★ 꾸미기 파츠(모자/안경/옷 등)는 생성기가 아니라 실행 화면의 꾸미기 버튼에서 별도로 설정/저장되는데,
  //   여기서 완전히 새 def를 만들면서 이 정보를 옮겨 담는 게 빠져있었음 — 그래서 생성기에서 캐릭터를 수정하고
  //   저장할 때마다 꾸미기 파츠가 전부 꺼진 것처럼(초기화) 보이던 버그의 원인. 원래 캐릭터(currentCreatorDef)에
  //   있던 값을 그대로 이어받음.
  if(currentCreatorDef && currentCreatorDef.equippedParts) def.equippedParts = currentCreatorDef.equippedParts;
  if(currentCreatorDef && currentCreatorDef.partXfMemory) def.partXfMemory = currentCreatorDef.partXfMemory;
  // 👂 사람 귀도 꾸미기에서 정한다 — 같은 이유로 그대로 이어받는다(필드는 slotToObj/loadSlots 와 1:1)
  if(currentCreatorDef && !currentCreatorDef.animal){
    ['earL','earR','earAdj','earPicL','earPicR'].forEach(k=>{ if(currentCreatorDef[k]!=null) def[k]=currentCreatorDef[k]; });
  }
  // 🐾 동물 캐릭터로 진입했다면 동물 확장 필드를 새 def에 그대로 승계 — 이게 빠져 있어서 책상·좌석 세팅 후
  //   [완료]를 누르는 순간 슬롯이 순수 인간 def로 덮어써지고(animal 표식까지 소실), 런처 카드·실행화면 모두
  //   기본 캐릭터로 나오던 버그의 근본 원인. 필드 목록은 slotToObj/loadSlots와 1:1로 맞출 것.
  if(currentCreatorDef && currentCreatorDef.animal){
    def.animal = true;
    ['animalFace','animalScl','animalEarL','animalEarR','animalEarAdj',
     'animalBody','animalEarPaintL','animalEarPaintR','animalEarBlinkL','animalEarBlinkR','animalBlink'].forEach(k=>{
      if(currentCreatorDef[k]!=null) def[k]=currentCreatorDef[k];
    });
    if(!def.thumb && currentCreatorDef.thumb) def.thumb=currentCreatorDef.thumb;   // 캡처 실패 시 동물 창에서 만든 썸네일 유지
  }
  def.xf={s:cXform.s,y:clampCharY(cXform.y),z:0,rot:cXform.rot,x:0};   // 🧍 y=캐릭터 높이 · 🚫 z(앞뒤)는 폐기 — 저장할 때 0 으로 굳는다
  def.deskColor=cDeskColor;
  if(cBase){
    const di=collectDeskItems(cBase); def.deskItems=di;   // ★ di가 null(전부 껐을 때)이어도 반드시 반영 — 안 그러면 껐던 아이템이 예전 저장값 그대로 남아있게 됨
    if(di){
    const ci={}; Object.keys(di).forEach(id=>{ const c=customItems[id]; const rec=commissionMod.savedItems().find(s=>s.id===id);
      // 카탈로그 아이템이면 GLB를 캐릭터에 박아넣지 않음 — 불러올 때 카탈로그 동기화(loadSavedItemsIntoSession)로 자동 채워짐(실시간 교체 반영을 위함)
      if(c && !(rec&&rec.fromCatalog)) ci[id]={name:c.name,glb:c.glb}; });
    if(Object.keys(ci).length) def.customItems=ci; } }
  if(cDeskGlbB64){
    // 카탈로그(관리자 배포) 책상이면 GLB를 통째로 박아넣는 대신 참조 ID만 저장 — 나중에 관리자가 GLB를 교체해도
    // 이 캐릭터를 불러올 때마다 최신 GLB를 다시 찾아오게 됨(applyDeskCatalogRefToSeat). 로컬 전용(코드로 추가) 책상은 예전처럼 그대로 저장.
    const activeRec = activeCustomDeskId ? commissionMod.savedDesks().find(d=>d.id===activeCustomDeskId) : null;
    if(activeRec && activeRec.fromCatalog){ def.deskCatalogId = activeRec.id; }
    else { def.deskGlb=cDeskGlbB64; }
  }
  if(cDeskScale!==1) def.deskScale=cDeskScale;
  // 🪑 전부 0(기본 위치)이면 저장하지 않는다 — 옛 저장분과 모양을 갈라놓지 않기 위해서다.
  if(cDeskPos && (cDeskPos.x || cDeskPos.y || cDeskPos.z)) def.deskPos={x:cDeskPos.x, y:cDeskPos.y, z:cDeskPos.z};
  if(cDeskLenX!==1) def.deskLenX=cDeskLenX; else if(def.deskLenX!=null) delete def.deskLenX;
  return def;
}
/* 📦 생성기에서 디자인을 키우기 전에 — patch(def) 로 바꾼 모습을 지금 모습과 견준다(def-size.js).
   실제로 바꾸지 않고 재기만 하므로, 막혀도 되돌릴 것이 없다. 모듈이 없으면 늘 통과(옛 동작). */
const DEF_SIZE_TOAST_MS = 4000;
function _creatorSizeGrow(patch){
  const base = _creatorBuildDef(true);
  const next = Object.assign({}, base);
  if(base.customItems) next.customItems = Object.assign({}, base.customItems);
  patch(next);
  return DefSize.checkGrowth(roomSyncMod.defWireForSize(base), roomSyncMod.defWireForSize(next), roomSyncMod._defSizeNames(next));
}
/* 파일 하나(base64)를 넣기 전 — clear(def) 로 그 파일이 들어갈 자리를 비운 나머지와 견준다. */
function _defSizeFile(restDef, addBytes){
  return DefSize.checkFile(roomSyncMod.defWireForSize(restDef), addBytes);
}
document.getElementById('crDone').addEventListener('click',()=>{
  /* 🛡️ [얼굴 영구 소실 방어 · 확인] 그림이 있던 캐릭터를 «빈 얼굴»로 저장하려 하면 한 번 묻는다.
     [왜 여기가 필요한가] 아래 saveSlots 의 공백 방어는 «사고»를 막는 장치라, 그것만 두면
       «정말로 다 지우고 새로 시작하려는» 사용자까지 막아 버린다. 뜻이 있는 저장은 여기서 통과시킨다.
     [왜 여기서만 묻는가] 생성기 [완료] 는 사용자가 그림 상태를 눈으로 보고 누르는 유일한 자리다.
       파츠·슬라이더·가챠 정리 등에서 도는 자동 저장에는 물을 사람이 없다 — 거긴 무조건 막는 게 맞다.
     ⚠️ confirm() 뒤 window.focus() 는 Electron 포커스 함정 보정이다(audit 검사 4). 빼지 말 것. */
  if(currentCreatorDef && _isBlankDraw(faceC) && !_isBlankDraw(currentCreatorDef.face)){
    if(!confirm('얼굴 그림이 비어 있어요.\n이대로 저장하면 원래 그림은 되돌릴 수 없어요.\n\n정말 저장할까요?')){ window.focus(); return; }
    window.focus();
    _blankFaceConfirmed = true;   // 바로 아래 saveSlots 1회만 소비한다
  }
  const def=_creatorBuildDef(false);
  /* 📦 마지막 안전망 — 용량을 넘긴 채로 키웠으면 저장하지 않는다(생성기는 열린 채 그대로라 고친 것은 남는다).
     원래 캐릭터보다 커지지 않았으면 통과 — 이미 넘은 옛 캐릭터도 계속 고칠 수 있게. */
  const _sz = DefSize.checkGrowth(currentCreatorDef ? roomSyncMod.defWireForSize(currentCreatorDef) : null, roomSyncMod.defWireForSize(def), roomSyncMod._defSizeNames(def));
  if(!_sz.ok){ _blankFaceConfirmed = false; toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
  if(creatorMode.kind==='seat'){
    applyCharToSeat(creatorMode.seat,def);
    // ★ 실행(run) 좌석은 slot 속성이 없어서 슬롯 저장이 스킵되던 버그 —
    //   화면엔 반영되지만 재시작하면 원복(책상 길이 등). 내 좌석이면 curSlot로 폴백해 반드시 저장.
    const _slotIdx = (creatorMode.seat.slot!=null) ? creatorMode.seat.slot
                   : (creatorMode.seat.isMe ? curSlot : null);
    if(_slotIdx!=null){ slots[_slotIdx]=def; if(creatorMode.seat.slot==null) creatorMode.seat.slot=_slotIdx; }
    slotSaveMod.saveSlots();creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');clearStampState();
    if(creatorMode.seat.isMe && Presence.active()) Presence.updateDef(def);   // 방에 있으면 바뀐 모습을 상대에게도 전송
    // ★ 런처에서 우클릭 → 수정 → 완료로 들어온 경우 런처 화면을 다시 보여줘야 함(openCreator가 진입 시 꺼놨었음).
    //   런처 화면이 아니라 실행(run) 중 우클릭 수정이었다면 이 블록은 건너뛰고, 아래 applyDesktopRunClass()가
    //   runmode/config 바디 클래스를 다시 정확히 계산해서 원래 화면(런처든 실행 화면이든)이 정상적으로 복귀함.
    if(creatorMode.cameFromLauncher){
      document.getElementById('launcher').classList.add('on'); renderLauncher();
      const wp=document.getElementById('wardrobePanel'); if(wp) wp.classList.remove('on');
      const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
    }
    applyDesktopRunClass();
    toast('수정했어요');return;}
  // ★ [＋]로 진입했으면 그때 확정된 칸을 그대로 쓴다. creatorMode.slot이 없을 때만 예전 폴백(추측)을 탄다.
  let target = creatorMode.edit ? creatorMode.slot
             : (creatorMode.slot!=null ? creatorMode.slot
             : (slots[curSlot]?slots.findIndex(s=>!s):curSlot));
  // ⚠️ 상한이 2로 박혀 있어서 5칸 확장 뒤 **4·5번 칸에 만든 캐릭터가 저장되지 않고 사라졌다.**
  if(target<0||target>=CHAR_SLOT_MAX){toast('빈 슬롯이 없어요');return;}
  // ★ 최종 방어 — 신규 생성인데 그 칸에 이미 다른 캐릭터가 있으면 덮어쓰지 않고 중단한다(확인 창 아님).
  if(!creatorMode.edit && slots[target]){
    console.warn('[슬롯] 신규 생성 저장 중단 — 대상 칸에 이미 캐릭터가 있음', {target:target, creatorMode:creatorMode});
    toast('그 칸에 이미 캐릭터가 있어요 — 런처에서 빈 칸을 골라 다시 시도해 주세요'); return;
  }
  /* 🧬 새 캐릭터면 보관함 문턱을 보고 cid 를 준다(켜져 있을 때만 · 수정은 saveSlots 훅이 잡는다). */
  if(!creatorMode.edit && charsMod._charsBoxFull()) return;
  slots[target]=def;
  if(!creatorMode.edit){ try{ charsMod._charsOnNew(target); }catch(_){} }
  curSlot=target;slotSaveMod.saveSlots();saveCurSlot();
  if(creatorMode.afterApp){const seat=createSeat();applyCharToSeat(seat,def);seat.slot=target;selectSeat(seat);renderSeatTabs();layoutSeats();
    creatorOpen=false;document.getElementById('creatorOverlay').classList.remove('on');clearStampState();toast('책상에 추가했어요');}
  else{closeCreator();toast('슬롯에 저장했어요');}});

/* ═══ 🖼️ 런처 미리보기 · 슬롯 섬네일 ═══ */
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
/* 🖼️ [2026-08 수정] 크기의 기준을 **캔버스 자신 → 감싼 .lc-preview-wrap** 으로 바꿨다.
   [제보] "런처 캐릭터가 잘려 나온다" / "런처로 돌아오면 캐릭터가 한쪽에 쏠린다" — 같은 버그의 앞뒤 두 모습.
   [원인] 예전엔 c.clientWidth 를 재서 그 값을 c.style.width 에 px 로 박았다. CSS 의 #lcPreview{width:100%}
     보다 인라인이 이기므로, 한 번 박히는 순간 clientWidth 는 **박아둔 값**을 돌려준다.
     = 자기가 쓴 값을 자기가 다시 읽는 구조라 캔버스 크기가 그 자리에 굳는다.
     창 크기 핸들러(resize)가 이 함수를 다시 불러도 같은 값만 재확인할 뿐 영영 안 풀린다.
     wrap 이 overflow:hidden 이라, 굳은 값이 프레임보다 크면 **잘려 보이고** 작으면 **왼쪽에 쏠려 보인다**.
   [계기] 모니터마다 배율이 다른 환경(주 175% / 앱 100%)에서 페이지 폭이 380→217 로 잡히며
     .lc-card 의 max-width:92vw 가 걸려 카드가 좁아졌다 → 그 좁은 폭이 캔버스에 굳었다.
     배율 쪽은 별개 사안이고, 여기서는 '굳는 성질'만 없앤다 — 창이 좁으면 작게 나올 뿐 잘리진 않는다.
   ⚠️ 캔버스에 px 를 다시 박지 말 것. 크기는 CSS(width/height:100%)가 정하고 여기서는 읽기만 한다.
     내부 렌더 해상도만 setSize(...,false) 로 따로 잡는다(도트 느낌 유지). */
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
/* 🖼️ 슬롯 섬네일 = 런처 미리보기 그대로 (2026-09-23 · 요청 «캐릭터 교체·자리 추가 섬네일을 런처와 같게»)
   [전에는] F1 캐릭터 교체·자리 추가 칸의 그림(def.thumb)은 **생성기에서 저장한 순간** 생성기 카메라로 찍은 것이었다.
     그래서 구도가 런처와 다르고, 그 뒤 꾸미기로 바꾼 파츠·책상은 영영 반영되지 않았다.
   [지금] 런처가 그 캐릭터를 다 그린 뒤(파츠 장착 완료 + 책상·소품이 붙을 시간 LC_THUMB_SETTLE_MS) 그 화면을
     한 장 찍어 def.thumb 을 갈아 끼운다. 눈 뜬 순간 · 둥둥 흔들림을 기준 높이에 멈춘 채로 찍는다 —
     같은 모습이면 같은 그림이 나오게 해서 «바뀐 게 없으면 저장 안 함»이 실제로 걸리게 한다.
   ★ lRenderer 에는 preserveDrawingBuffer 가 없다 → render 와 **같은 틱에서** 바로 복사한다(launcherLoop).
   ★ def.thumb 은 로컬 전용이다(서버용 변환에서 빠진다) — 갈아 끼워도 서버 쓰기가 늘지 않는다.
   ⚠️ 런처에서 한 번도 넘겨 보지 않은 슬롯은 예전 그림이 그대로다(찍을 기회가 없다). */
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
    if(url && url !== job.def.thumb){ job.def.thumb = url; slotSaveMod.saveSlots(); }
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
    // ★ 실측 바운딩박스 기반 프레이밍:
    //   발바닥을 y=0에 정렬하고, 키·z를 저장 → sizeLauncherPreview가 "프레임에 꽉 차는" 카메라를 역산.
    //   ★ 버그 수정(캐릭터 크기 제각각/사람만 작아짐): 예전엔 파츠까지 포함한 전체 박스로 프레이밍했는데,
    //   파츠 하나라도 위치가 몸에서 벗어나면(파츠 xf 이슈 등) 박스가 커져 캐릭터가 통째로 축소됐다.
    //   → 프레임 높이는 "몸(파츠 제외)" 박스로 재서, 파츠 위치와 무관하게 몸이 항상 같은 크기로 보이게 함.
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
      // Storage 이관 후속: getPartScene이 Storage에서 GLB를 fetch하는 데 시간이 걸림 —
      // await 없이 실행하면 초기 렌더 후에나 파츠가 채워져 사용자가 "이관 후 파츠 안 보임"을 겪음.
      (async()=>{
        await applyEquippedPartsToSeat(base, def);
        // 모자 등 파츠가 붙어도 "몸" 기준 프레임은 그대로 — 파츠 위치와 무관하게 크기 고정.
        //   (예전엔 파츠 포함 전체 박스로 재프레이밍해서, 파츠가 튀면 캐릭터가 작아졌음)
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
      if(def.customItems){ for(const id in def.customItems){ if(!customItems[id]){ const c=def.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod.parseGlbFull(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc,'',animations);}catch(e){} } } }
      if(def.deskGlb&&lHolder){ try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(def.deskGlb)); lHolder.desk.userData.deskScale=def.deskScale||1; swapDeskVisual(lHolder.desk,sc); setDeskScale(lHolder.desk, def.deskScale||1, def.deskLenX||1); if(def.deskColor)applyDeskColorToCustom(lHolder.desk,def.deskColor);}catch(e){} }
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

function renderLauncher(){
  ensureLauncherPreview();
  // 🎟️ 런처를 열 때마다 초대장 버튼 상태 갱신 (invite 노드 삭제/지급 등 외부 변화 반영)
  licenseGateMod.refreshInviteBtn();
  const def=slots[curSlot];
  document.getElementById('lcCount').textContent='('+(curSlot+1)+'/'+CHAR_SLOT_MAX+')';
  document.getElementById('lcEmpty').style.display=def?'none':'flex';
  document.getElementById('lcGear').style.display=def?'block':'none';
  document.getElementById('lcPreview').style.display=def?'block':'none';
  /* ★ [개정 16] #lcLoad 는 이제 [내 정보] — 늘 눌려야 한다. «꽉 참» 판정은 보관함의 [코드로 캐릭터 불러오기]로 옮겼다(_miCodeLoad).
     lcCreate는 [공사중]으로 HTML에서 항상 disabled — 여기서 토글하지 않음 */
  sizeLauncherPreview();setLauncherChar(def);closeGearMenu();
  try{ slotSyncMod._slotsRenderBand(); }catch(_){}}   // 🛟 연동 띠(3-7-2 A안)

/* ═══ 🎛️ 런처 컨트롤 — 슬롯 넘기기 · 톱니 메뉴 · 삭제 · 보관함 이동 ═══ */
/* --- 런처 컨트롤 --- */
const gearMenu=document.getElementById('lcGearMenu');
function closeGearMenu(){gearMenu.classList.remove('on'); try{ lcDeleteAskEnd(); }catch(_){}}
/* 🗑️ 캐릭터 삭제 되묻기 — 톱니 메뉴 안에서 [네]/[아니오] 로 한 번 더 묻는다.
   ⚠️ 네이티브 확인 대화상자는 쓰지 않는다. Electron 투명 창에서 렌더러를 블로킹한 채 창이 안 떠
      "앱이 멈춘 것처럼" 보이고, audit 검사 4가 그걸 잡는다(디자인 스튜디오 전체 초기화와 같은 이유).
      ※ 이 주석에 그 함수 이름을 괄호까지 붙여 적으면 검사 4가 주석을 호출로 오인한다 — 일부러 풀어 썼다.
   ★ 메뉴 안의 클릭은 gearMenu 의 stopPropagation 이 문서 클릭-닫힘에서 막아주므로, 묻는 동안
     메뉴가 저절로 닫히지 않는다. 바깥을 누르면 메뉴가 닫히고 closeGearMenu 가 확인도 함께 취소한다.
   ★ 슬롯을 넘기거나(◀▶) 창을 다시 그릴 때도 확인 상태가 남으면 안 된다 — 그 사이 curSlot 이
     바뀌어서 [네]가 엉뚱한 캐릭터를 지운다. renderLauncher 가 아니라 closeGearMenu 에 걸어두고,
     슬롯 이동은 어차피 메뉴가 닫힌 상태에서만 가능하므로 이 한 곳으로 충분하다. */
function lcDeleteAskEnd(){
  const ask=document.getElementById('lcDeleteAsk'); if(ask) ask.style.display='none';
  ['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'].forEach(id=>{ const b=document.getElementById(id); if(b) b.style.display=''; });
}
function lcDeleteAskStart(){
  let ask=document.getElementById('lcDeleteAsk');
  if(!ask){
    ask=document.createElement('div'); ask.id='lcDeleteAsk';
    ask.style.cssText='display:flex;align-items:center;gap:4px;padding:6px 10px;white-space:nowrap;';
    ask.innerHTML='<span id="lcDelAskText" style="font-size:12px;">정말 삭제할까요?</span>';
    const yes=document.createElement('button'); yes.id='lcDelYes'; yes.textContent='네';
    const no =document.createElement('button'); no.id='lcDelNo';  no.textContent='아니오';
    [yes,no].forEach(b=>{ b.style.cssText='padding:2px 8px;border:1px solid var(--win-lo-2);background:var(--win-face);'; });
    yes.onclick=()=>{ lcDeleteAskEnd(); closeGearMenu(); doDeleteCurSlot(); };
    no.onclick =()=>{ lcDeleteAskEnd(); };
    ask.appendChild(yes); ask.appendChild(no);
    gearMenu.appendChild(ask);
  }
  /* 🧬 문구는 스위치(와 채택)에 묶는다 — 휴지통이 없는 동안 «휴지통» 이라고 적으면 되살릴 수 있다고 믿고 영구 삭제한다(설계 개정 5). */
  try{ const t=document.getElementById('lcDelAskText'); if(t) t.textContent=charsMod._charsDeleteWords().ask; }catch(_){}
  ['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'].forEach(id=>{ const b=document.getElementById(id); if(b) b.style.display='none'; });
  ask.style.display='flex';
}
document.getElementById('lcPrev').onclick=()=>{curSlot=(curSlot+CHAR_SLOT_MAX-1)%CHAR_SLOT_MAX;saveCurSlot();renderLauncher();};
document.getElementById('lcNext').onclick=()=>{curSlot=(curSlot+1)%CHAR_SLOT_MAX;saveCurSlot();renderLauncher();};
// ★ 빈 슬롯의 [＋] — "지금 보고 있는 이 칸"을 저장 대상으로 확정해 생성 흐름에 넘긴다.
//   예전엔 저장하는 순간에 curSlot/빈칸찾기로 각 경로가 제각각 추측해서 다른 칸을 덮어쓰는 사고가 났음.
document.getElementById('lcEmpty').onclick=()=>{
  if(slots[curSlot]) return;                       // 캐릭터가 있는 칸이면 [＋]가 아니므로 무시
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  if(charsMod._charsBoxFull()) return;   // 🧬 보관함 20 문턱(켜져 있을 때만)
  racePickerMod.openRacePicker(curSlot);
};
const previewWrap=document.querySelector('.lc-preview-wrap');
previewWrap.addEventListener('mouseenter',()=>{if(slots[curSlot])previewWrap.classList.add('show-go');});
previewWrap.addEventListener('mouseleave',()=>previewWrap.classList.remove('show-go'));
document.getElementById('lcPreview').addEventListener('click',()=>{if(slots[curSlot])launchApp({mode:'run'});});
document.getElementById('lcGear').onclick=e=>{e.stopPropagation();
  try{ const w=charsMod._charsDeleteWords(); const d=document.getElementById('lcDelete'); if(d) d.textContent=w.btn; e.currentTarget.title=w.gear; }catch(_){}
  gearMenu.classList.toggle('on');};
document.addEventListener('click',()=>closeGearMenu());
gearMenu.addEventListener('click',e=>e.stopPropagation());
document.getElementById('lcEdit').onclick=()=>{closeGearMenu();if(slots[curSlot])openCreator({kind:'slot',edit:true,slot:curSlot});};
document.getElementById('lcDelete').onclick=()=>{ lcDeleteAskStart(); };   // 🗑️ 바로 지우지 않고 되묻는다
/* 🧰 [보관함 이동] — 시안 G(개정 48). 되묻지 않는다 · 토스트 «보관함으로 옮겼어요». 지우는 게 아니라 슬롯에서 내려 보관함에 둔다. */
document.getElementById('lcToBox').onclick=()=>{ closeGearMenu(); doMoveCurSlotToBox(); };
/* 실제 삭제 — [네]를 눌렀을 때만 불린다. 내용은 예전 lcDelete.onclick 그대로다. */
function doDeleteCurSlot(){
  if(!slots[curSlot]) return;   // 되묻는 사이 비었으면(다른 경로로 삭제 등) 아무 것도 안 한다
  /* 🧬 켜져 있으면(채택 뒤) 휴지통 이동 — 묘비 + 휴지통 줄 + 책상 표를 아래 당기기와 같이 당긴다. 꺼져 있으면 false · 옛 삭제 그대로. */
  let _toTrash = false; try{ _toTrash = charsMod._charsTrashMove(curSlot); }catch(_){}
  // 삭제 후 뒤 슬롯들을 앞으로 당겨옴(선입선출) — 예: 1번 삭제하면 2번→1번, 3번→2번
  for(let i=curSlot;i<slots.length-1;i++){ slots[i]=slots[i+1]; }
  slots[slots.length-1]=null;
  // ★ "자리 추가"(extraSeatSlots)는 슬롯 '번호'만 저장하는 구조라, 당김과 함께 옮기지 않으면
  //   삭제 후 그 번호가 다른 캐릭터를 가리켜 옆자리 캐릭터가 조용히 바뀐다(기존 버그).
  //   applyExtraSeatForMode의 filter는 '빈 칸이 된 번호'만 걸러낼 뿐 번호 밀림은 못 잡는다.
  if(Array.isArray(settingsMod.extraSeatSlots())){
    settingsMod.setExtraSeatSlots(settingsMod.extraSeatSlots().filter(n=>n!==curSlot).map(n=>n>curSlot?n-1:n));
    settingsMod._saveExtraSeatSlots();
  }
  // ★ 당겨오기 때문에 curSlot이 '빈 칸'이나 엉뚱한 캐릭터를 가리킬 수 있다.
  //   그 상태가 이어지면 이후 저장이 엉뚱한 자리를 고를 수 있으므로 여기서 정리한다.
  if(!slots[curSlot]){ let last=-1; slots.forEach((x,i)=>{ if(x) last=i; }); curSlot = last>=0 ? last : 0; }
  slotSaveMod.saveSlots(); saveCurSlot();
  renderLauncher();toast(_toTrash ? '휴지통으로 옮겼어요' : '삭제했어요');
}
/* 🧰 [보관함 이동] — 슬롯에서 내려 보관함에 둔다(시안 G · 개정 48). 당기기는 doDeleteCurSlot 과 같은 모양이다
   (자리 추가 번호도 같이 당긴다 — 옛 버그 주석 참고). 보관함 쪽 기록은 _charsDeskToBox 가 먼저 끝낸 뒤에만 칸을 당긴다. */
/* 🩹 [2026-10-08 제보 #9] «보관함에 안 들어가고, 연타하면 들어가지만 슬롯에도 남는다».
   [가설] 동시 실행 방지가 없었다 — 연타하면 겹친 호출이 각자 `i = curSlot` 을 잡고 기다린 뒤 그 i 로 칸을 당겼다.
     동물은 추가 그림 6장을 올려서 동기화가 길어 겹칠 틈이 넓다.
   [대응] ① 진행 중이면 다시 안 들어간다 ② 기다린 뒤에는 **번호(i) 대신 그 캐릭터(slotObj)로** 칸을 다시 찾는다
     ③ 실패 이유(why)를 남긴다(_charsMoveFailLog) — 다음 제보 때 moved/nocid/err/save/dirty 를 가를 수 있게. */
let _moveToBoxBusy = false;
async function doMoveCurSlotToBox(){
  if(_moveToBoxBusy){ toast('보관함으로 옮기는 중이에요 — 잠시만요'); return; }
  const i = curSlot;
  const slotObj = slots[i];
  if(!slotObj) return;
  _moveToBoxBusy = true;
  let r = { ok: false, why: 'off' };
  try{
    try{ r = await charsMod._charsDeskToBox(i); }catch(e){ r = { ok: false, why: 'err', err: String(e && e.message || e) }; }
  }finally{ _moveToBoxBusy = false; }
  if(!r.ok){ charsMod._charsMoveFailLog(r, i); toast(charsMod._charsMoveMsg(r)); return; }
  /* 기다리는 사이 칸이 바뀌었을 수 있다(동기화 · 다른 창) — 옮긴 그 캐릭터가 지금 몇 번 칸인지 다시 찾는다. */
  const at = slots.indexOf(slotObj);
  if(at < 0){ renderLauncher(); toast('보관함으로 옮겼어요'); return; }   // 이미 칸에서 빠져 있다 — 당길 것이 없다
  for(let k = at; k < slots.length - 1; k++){ slots[k] = slots[k + 1]; }
  slots[slots.length - 1] = null;
  if(Array.isArray(settingsMod.extraSeatSlots())){
    settingsMod.setExtraSeatSlots(settingsMod.extraSeatSlots().filter(n => n !== at).map(n => n > at ? n - 1 : n));
    settingsMod._saveExtraSeatSlots();
  }
  if(!slots[curSlot]){ let last = -1; slots.forEach((x, k) => { if(x) last = k; }); curSlot = last >= 0 ? last : 0; }
  slotSaveMod.saveSlots(); saveCurSlot();
  renderLauncher(); toast('보관함으로 옮겼어요');
}
/* ═══ 🐾 종족 선택창 ═══ */
/* 본문은 race-picker.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const RACE_PICKER_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const racePickerMod = (typeof TwRacePicker === 'undefined') ? RACE_PICKER_MOD_OFF : TwRacePicker.createRacePicker({
  BASE_SCENE: ()=>BASE_SCENE,
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,
  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,
  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,
  _mkFrontFill: (...a)=>_mkFrontFill(...a),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  applyLightPresetToInstance: (...a)=>applyLightPresetToInstance(...a),
  instantiateBase: (...a)=>instantiateBase(...a),
  normalizeModel: (...a)=>normalizeModel(...a),
  openCreator: (...a)=>openCreator(...a),
});

/* === 커미션 캐릭터 코드 입력 (일반 사용자도 가능) === */
const commImpOverlay=document.getElementById('commImpOverlay');
document.getElementById('raceCommCode').onclick=()=>{
  const panel=document.getElementById('raceCommCodePanel');
  const willOpen = panel.style.display==='none';
  panel.style.display = willOpen ? 'block' : 'none';
  if(willOpen){ document.getElementById('commImpCode').value=''; document.getElementById('commImpPass').value=''; }
};
document.getElementById('commImpCancel').onclick=()=>{ document.getElementById('raceCommCodePanel').style.display='none'; };
/* 🔴 [제보 1] 이 패널은 **빈 슬롯에서만 열린다**(빈 칸 [＋] → 종족 선택 창).
   그런데 예전엔 커미션 코드(DCM1)만 받아서, 여기에 캐릭터 복제 코드(DCC1)를 넣으면
   decryptCommission 이 첫 줄에서 형식 오류를 던지고 catch 가
   "등록 실패: 코드나 비밀번호를 확인해 주세요" 를 띄웠다.
   → 유저 눈에는 "슬롯이 전부 비었을 때만, 같은 파일·같은 암호인데 코드나 암호가 틀렸다고 뜬다"로 보인다.
     (캐릭터가 하나라도 있으면 이 창을 안 거치고 런처 [캐릭터 불러오기]를 쓰게 되니 정상 동작.
      "임시 캐릭터를 만들고 등록한 뒤 지운다"는 우회법이 통했던 이유도 이것이다.)
   이제 코드 머리글자로 갈라서 DCC1 은 복제 코드 등록(importCloneCode)으로 그대로 보낸다.
   ⚠️ 새로 구현하지 말 것 — 등록 로직이 두 벌이 되면 다시 같은 종류의 사고가 난다. */
document.getElementById('commImpGo').onclick=async()=>{
  const code=document.getElementById('commImpCode').value.trim(), pass=document.getElementById('commImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  // 슬롯 공간 확인 (lcCreate 패턴과 동일)
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  const _closeRace=()=>{ document.getElementById('raceCommCodePanel').style.display='none';
                         document.getElementById('raceOverlay').classList.remove('on'); };
  // ① 캐릭터 복제 코드 — [＋]로 확정된 칸(_raceTargetSlot)에 그대로 앉힌다
  if(/^DCC1\./.test(code)){
    if(await charCodeMod.importCloneCode(code, pass, racePickerMod._raceTargetSlot())) _closeRace();
    return;
  }
  // ② 책상·아이템 코드는 생성기 안에서 넣는 것 — 여기서 조용히 실패시키지 말고 어디로 가야 하는지 말한다
  if(/^DCK1\./.test(code)){ toast('책상·아이템 코드예요 — 생성기 안의 [코드로 추가하기]에서 넣어주세요'); return; }
  // ③ 셋 중 어느 것도 아니면 암호 문제가 아니라 코드(파일) 문제다
  if(!/^DCM1\./.test(code)){ toast('코드 형식이 아니에요 — 파일이 잘리지 않았는지 확인해 주세요'); return; }
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  try{
    const payload=await commissionMod.decryptCommission(code, pass);
    if(payload.t!=='comm') throw new Error('형식 오류');
    // 빈 슬롯 찾기
    // ★ 빈 칸이 없으면 예전엔 idx=0으로 떨어져 1번 캐릭터를 말없이 덮어썼다(동물 저장과 같은 유형의 사고).
    //   덮어쓰지 말고 거부한다 — 인간 저장·복제코드 불러오기와 동일한 방식.
    //   ★ [＋]로 칸이 확정돼 들어왔으면 그 칸이 우선 — importCloneCode 와 같은 규약으로 맞춘다.
    let idx = (typeof racePickerMod._raceTargetSlot()==='number' && !slots[racePickerMod._raceTargetSlot()]) ? racePickerMod._raceTargetSlot() : slots.findIndex(s=>!s);
    if(idx<0){ toast('빈 슬롯이 없어요 — 캐릭터를 하나 정리한 뒤 다시 시도해 주세요'); return; }
    // 텍스처를 캔버스로 변환 (charDef와 호환)
    const faceCv=await dataUrlToCanvas(payload.face, CANVAS_SZ);
    const blinkCv=await dataUrlToCanvas(payload.blink, CANVAS_SZ);
    // def 만들기: 기존 charDef 시그니처 그대로 + 커미션 필드들
    const def = charDef(0, faceCv, blinkCv, '#ffffff', '#ffffff');
    def.isCommission = true;             // 잠금된 캐릭터 표시
    def.commName = payload.name || '커미션';
    def.commGlb = payload.glb;           // base64 GLB (베이스 모델)
    def.xf = {s:0.7,y:0,z:0,rot:0,x:0};
    /* 📦 커미션 3D 파일 하나로 디자인 용량을 넘으면 등록하지 않는다(def-size.js). */
    const _rest = Object.assign({}, def); delete _rest.commGlb;
    const _sz = _defSizeFile(_rest, DefSize.jsonBytes(payload.glb) + 12);
    if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
    // 슬롯에 저장 + 영구 저장
    if(charsMod._charsBoxFull()) return;   // 🧬 보관함 20 문턱
    slots[idx]=def;
    try{ charsMod._charsOnNew(idx); }catch(_){}
    slotSaveMod.saveSlots();
    curSlot=idx;
    saveCurSlot();
    renderLauncher();
    toast('"'+def.commName+'" 캐릭터를 등록했어요');
    document.getElementById('raceCommCodePanel').style.display='none';
    document.getElementById('raceOverlay').classList.remove('on');
    // 바로 생성기 진입 — openCreator가 isCommission 보고 5단계(책상)부터 시작
    openCreator({kind:'slot', edit:true, slot:idx});
  }catch(e){
    /* 형식(DCM1)은 위에서 이미 걸렀으므로 여기까지 온 실패는 암호·데이터 문제뿐이다.
       '코드나 비밀번호' 라고 뭉뚱그리면 제보 1과 같은 오진이 또 난다. */
    console.warn('[커미션코드] 등록 실패 — 길이='+code.length+' 머리='+code.slice(0,12), e);
    toast('등록 실패: 비밀번호를 확인해 주세요 (코드 형식은 맞아요)');
  }
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
// ★ [캐릭터 생성]은 빈 슬롯의 [＋]로 일원화됨 — 이 버튼은 [🚧 공사중]으로 비워두고
//   나중에 새 기능을 넣을 자리로 남긴다(HTML에서 disabled 상태라 핸들러 없음).
document.getElementById('lcLoad').onclick=()=>myInfoMod.openMyInfo('box');   // 🪪 [개정 16 · §6-⑭] 옛 [캐릭터 불러오기] → [내 정보]. 코드 불러오기는 보관함 탭 맨 아래로 옮겼다.

/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
// ★ 카메라 앵글·줌이 미리보기와 실행 화면에서 달라서 생기는 시각적 앞뒤 어긋남을 오프셋으로 보정 —
//   미리보기가 정답 기준이라도 이 카메라 차이는 임시 보정 없이 못 맞추므로 필수(수치는 실측 조정값).
//   ★ 요청사항: 커미션 캐릭터는 미리보기 기준으로 xf.z 그대로 사용 (오프셋 적용하니 책상과 더 멀어 보임)
const COMMISSION_Z_OFFSET = 0;   // 커미션 전용 오프셋 — 미리보기가 정답이라 0
// ★ 기본(비커미션) 캐릭터만 따로 미세조정 — 위 공통 보정치로도 기본 캐릭터는 생성기 미리보기와 앞뒤가 살짝
//   안 맞는다는 피드백 반영. 양수면 캐릭터가 더 앞으로(카메라 쪽으로), 음수면 더 뒤로 이동함.
// ★ [배치진단] 결과 실행 캐릭터가 미리보기보다 정확히 이 값만큼 책상 쪽으로 파고들던 원인으로 확인 —
//   FIT_MODEL_Z_NUDGE가 0이 된 지금은 이 보정도 불필요해져서 0으로. (다시 띄우고 싶으면 값 조절)
const DEFAULT_CHAR_Z_EXTRA_OFFSET = 0;
/* full rebuild 전 파츠 전면 정리 —
   ★ 리빌드가 몸(gltfRoot)만 갈아끼우면: headAnchor 등 좌석 영구 노드에 붙은 옛 파츠 wrapper가 살아남고,
     리빌드 "이전"에 시작돼 아직 GLB 로딩 중이던 장착이 뒤늦게 완료되며 새 몸에 낡은 파츠를 붙임 →
     상대 캐릭터에 파츠가 엉뚱한 위치로 이식된 채 안 돌아오는 유령 증상.
   그래서 (1) 기존 wrapper 전부 해제, (2) _equipSeq 전 키 +1로 진행 중이던 낡은 장착을 전부 무효화. */
function _purgeSeatParts(seat){
  try{
    if(seat.stackedPartObjs){
      for(const c in seat.stackedPartObjs){
        Object.keys(seat.stackedPartObjs[c]).forEach(id=>{ try{ unequipStackablePart(seat, c, id); }catch(_){} });
      }
    }
    if(seat.equippedPartObjs){
      Object.keys(seat.equippedPartObjs).forEach(c=>{ try{ unequipPartFromSeat(seat, c, false); }catch(_){} });
    }
  }catch(_){}
  seat.equippedPartObjs = {};
  seat.stackedPartObjs = {};
  if(seat._equipSeq) for(const k in seat._equipSeq) seat._equipSeq[k]++;
}
/* 리깅 파츠의 xf(bindMatrix)를 현재 모델 스케일 기준으로 다시 굽는다.
   캐릭터 크기(userScale)나 fitModel 재계산이 일어난 뒤 호출해야 파츠가 몸을 따라감. */
function refreshRiggedPartsXf(seat){
  if(!seat) return;
  try{
    if(seat.equippedPartObjs){
      Object.keys(seat.equippedPartObjs).forEach(cat=>{
        const w = seat.equippedPartObjs[cat];
        if(w && w.userData && w.userData.rigged) applyPartXf(seat, cat);
      });
    }
    if(seat.stackedPartObjs){
      Object.keys(seat.stackedPartObjs).forEach(cat=>{
        const map = seat.stackedPartObjs[cat] || {};
        const anyRigged = Object.keys(map).some(id=> map[id] && map[id].userData && map[id].userData.rigged);
        if(anyRigged) applyPartXf(seat, cat);   // applyPartXf가 stackable도 id별로 재적용함
      });
    }
  }catch(_){}
}
/* 🐾 동물 GLB 파싱이 늦게 끝나 인간으로 폴백된 좌석을 다시 동물로 재빌드 (animal.js가 호출) */
window.rebuildAnimalSeats=function(){
  try{
    if(typeof seats==='undefined') return;
    seats.forEach(st=>{
      if(st && st.charDef && st.charDef.animal){
        applyCharToSeat(st, st.charDef);
      }
    });
    // ★ 런처 미리보기(setLauncherChar→defToBase)도 같은 이유로 파싱 전엔 인간으로 폴백된 채 남아 있음.
    //   좌석만 고치면 "껐다 켜면 런처 슬롯이 기본 캐릭터"가 그대로임 — 동물 슬롯이면 여기서 다시 그린다.
    try{
      const _lc=document.getElementById('launcher');
      if(_lc && _lc.classList.contains('on') && slots[curSlot] && slots[curSlot].animal) renderLauncher();
    }catch(_){}
    console.log('[동물] 좌석 재빌드 완료');
  }catch(e){ console.warn('[동물] 좌석 재빌드 실패', e); }
};
/* 🐾 안 보이는 placeholder(내장 스탠드인)를 레이캐스트 대상에서 빼거나 되돌린다.
   Three.js r128의 Raycaster는 visible 플래그를 보지 않아서, 숨겨둔 placeholder(몸통 반지름 0.42 · 머리 0.4의
   '인간 크기' 구체)가 계속 클릭 판정에 잡힌다. 인간은 실제 모델과 크기가 비슷해 티가 안 났지만, 40%인 동물은
   자기 몸보다 훨씬 큰 인간 크기 영역이 잡혀서 쓰다듬기/드래그 인식이 어긋났다.
   ★ 안전장치: 원래 raycast 함수를 userData에 보관했다가 그대로 복원한다(인간으로 교체돼도 원상복구).
     mesh를 지우거나 visible을 건드리지 않으므로 렌더·폴백 로직에는 전혀 영향이 없다.
   ★ 적용 조건: 동물이면서 placeholder가 이미 숨겨진(=실제 모델이 올라온) 경우에만 끈다.
     모델 로드 실패로 placeholder가 보이는 상태면 그대로 클릭 가능해야 하므로 건드리지 않는다. */
function _setPlaceholderPickable(seat, on){
  try{
    const root = seat && seat.placeholder && seat.placeholder.root; if(!root) return;
    root.traverse(o=>{
      if(!o.isMesh) return;
      if(on){
        if(o.userData.__origRaycast){ o.raycast = o.userData.__origRaycast; delete o.userData.__origRaycast; }
      }else{
        if(!o.userData.__origRaycast){ o.userData.__origRaycast = o.raycast; o.raycast = function(){}; }
      }
    });
  }catch(_){}
}
/* 🐾 동물 귀 등록 — 동물 GLB의 ear_L/ear_R 본은 스킨 웨이트가 0%라(실측) 본을 돌려도 아무것도 안 움직인다.
   실제 귀는 별도 GLB를 부착한 물체이므로, 인간의 귀 꾸미기 파츠와 똑같이 '부착물 자체'를 seat.bones.ear에
   넣어야 animateRig의 귀 까닥임이 동작한다(app.js의 partEarObjs 처리와 동일한 패턴).
   귀는 비동기로 늦게 붙기 때문에 두 경로로 등록한다: 즉시 스윕(_sweepAnimalEars) + animal.js 콜백(registerAnimalEar). */
function _registerAnimalEarOn(seat, wrap){
  if(!seat || !wrap || !seat.bones) return;
  if(!seat.bones.ear) seat.bones.ear=[];
  if(!seat.boneRest) seat.boneRest={};
  if(!seat.boneRest.ear) seat.boneRest.ear=[];
  if(seat.bones.ear.indexOf(wrap)>=0) return;   // 중복 등록 방지(재빌드·스윕 중복 대비)
  seat.bones.ear.push(wrap);
  seat.boneRest.ear.push(wrap.quaternion.clone());   // ★ head 본에 attach된 '뒤'의 자세가 기준이어야 함
  seat.earTimers=null;   // 개수가 바뀌었으니 타이머 재생성(animateRig가 알아서 다시 만듦)
  /* 🐰 이 좌석 머리 위에 이미 누가 올라타 있다면, 그 좌석이 캐시한 '머리 꼭대기'는 **귀가 없던
     시절의 값**이다. 귀가 방금 붙었으니 여기서 한 번 다시 잰다(_remeasureRideHeadTop 주석 참고).
     ⚠️ 이 함수는 귀 하나마다 불린다(좌·우) — 재측정도 그만큼 돌지만 몇 번뿐이라 부담이 없고,
       한쪽 귀만 붙은 중간 상태에서 잰 값도 다음 귀가 붙을 때 곧바로 덮인다. */
  rideBenchMod._remeasureRideHeadTop(seat);
}
function _sweepAnimalEars(seat, root){
  if(!seat || !root) return;
  try{ root.traverse(o=>{ if(o.userData && o.userData.animalEar) _registerAnimalEarOn(seat, o); }); }catch(_){}
}
window.registerAnimalEar=function(root, wrap){
  try{ const seat = root && root.userData && root.userData.__animalSeat;
       if(seat) _registerAnimalEarOn(seat, wrap); }catch(_){}
};
function applyCharToSeat(seat,def){
  // ★ 라이드 상태 정리 — 이게 없으면 자리 겹침이 난다.
  //   [증상] 동물이 인간 머리 위에 올라탄 상태에서 그 좌석을 인간으로 교체하면, 교체된 캐릭터가
  //          원래 대상과 같은 자리에 겹쳐 보인다.
  //   [원인] 교체는 charDef·모델·책상만 바꾸고 seat.ridingOn을 그대로 둔다. 그러면 매 프레임
  //          _positionRideSeat가 이 좌석을 대상 머리 위로 계속 끌어올려, layoutSeats가 정해준
  //          바닥 자리(targetX)를 덮어써 버린다. (내 위에 누가 타고 있던 경우도 같이 정리해야 한다.)
  //   [대응] unmountRide가 '위에 탄 좌석 재배치 + group.position/회전 원복'을 모두 해주므로 그대로 쓴다.
  try{
    if(seat.ridingOn) rideBenchMod.unmountRide(seat);                 // 내가 남의 머리에 타고 있던 경우
    if(rideBenchMod._rideRiders(seat).length){                        // 내 머리에 누가 타고 있던 경우
      rideBenchMod._rideRiders(seat).slice().forEach(up=>{ try{ rideBenchMod.unmountRide(up); }catch(_){} });
    }
  }catch(_){}
  seat.charDef=def;
  _purgeSeatParts(seat);   // ★ 리빌드 전 옛 파츠·진행 중 장착 정리 (유령 파츠 방지)
  // 🐾 동물이면 책상도 60%. 캐릭터 교체(인간↔동물)에 대비해 항상 명시적으로 갱신한다.
  //   실제 곱셈은 setDeskScale이 하므로 아래 모든 책상 적용 경로(비동기 포함)에 자동 반영됨.
  //   좌석 간격·카메라 줌은 layoutSeats가 책상 폭을 실측(seatDeskHalfWidth)하므로 따로 손댈 필요 없음.
  if(seat.desk) seat.desk.userData.animCorr = def.animal ? ANIMAL_RUN_SCALE : 1;
  /* 🪑 평준화 배율도 같은 자리에서 갱신한다 — def 가 바뀌면 그 좌석의 캐릭터 크기(xf.s)가 바뀌고,
     내 좌석이 바뀐 경우엔 **다른 모든 좌석의** k 까지 달라진다. seat._eqK 를 지워 다음
     syncSeatEqualize(layoutSeats 도입부)가 전 좌석을 다시 계산하게 둔다. */
  if(seat.desk) seat.desk.userData.eqK = seatEqK(seat);
  try{ seats.forEach(s2=>{ s2._eqK = undefined; }); }catch(_){}
  // 🐾 책상과의 기본 거리도 같은 비율로 — 프레임 루프가 lerp로 수렴시키지만, 교체 직후 한 프레임
  //   튀어 보이지 않게 여기서 바로 맞춰둔다(fitModel이 rig.position을 저장·복원하므로 값은 유지됨).
  try{ if(seat.rig) seat.rig.position.z = seatCharZ(seat); }catch(_){}
  /* 🐾 캐릭터가 CHAR_Z 로 고정된 만큼 **책상이 그 몫을 진다** — 바로 위 두 줄에서 방금
     animCorr·eqK 를 갈아끼웠으니 여기서 즉시 반영한다.
     ⚠️ 아래쪽 setDeskPos(def.deskPos) 가 어차피 같은 일을 하지만, 그 줄에 도달하기 전에
       **되돌아 나가는 갈래**가 있다(커미션 GLB 가 캐시에 없으면 파싱을 걸고 return —
       그 사이 한 화면은 옛 z 로 그려진다). 그래서 여기서 한 번 더 맞춘다. */
  try{ if(seat.desk) syncSeatDeskZ(seat.desk); }catch(_){}
  // 커미션 캐릭터: 커스텀 베이스 GLB로 인스턴스 생성. 캐시 없으면 비동기 파싱 후 재호출
  let customScene = null;
  if(def.commGlb){
    customScene = commSceneCache.get(def.commGlb);
    if(!customScene){
      getCommissionScene(def.commGlb).then(()=>applyCharToSeat(seat,def)).catch(e=>console.warn('comm GLB 파싱 실패', e));
      return;
    }
  }
  // 🐾 동물 캐릭터 — 좌석 생성 경로는 defToBase를 타지 않으므로 여기에도 같은 분기가 필요함.
  //   animal.js(buildAnimalBase)가 전신 페인트·귀까지 전담 조립. GLB 파싱 전이면 null을 돌려주므로
  //   그때는 아래 인간 경로로 폴백하고, 파싱 완료 시 animal.js가 rebuildAnimalSeats로 이 함수를
  //   다시 불러 동물로 재빌드함. 반환 형태가 instantiateBase와 같아서 아래 블록을 그대로 재사용.
  let inst=null, animBase=null;
  if(def.animal && typeof window.buildAnimalBase==='function'){
    animBase=window.buildAnimalBase(def);
    if(animBase){ inst=animBase; inst._animal=true; }
  }
  if(!inst) inst=instantiateBase(customScene);
  if(inst){
    /* 🐾 **이 좌석이 실제로 동물로 조립됐는가.** charDef.animal 은 저장값이라
       "동물 캐릭터인데 GLB 파싱 전이라 인간으로 폴백된" 상태와 구별하지 못한다(바로 위 분기).
       올라타기 판정(mountRide)이 이 값을 본다 — 자세한 경위는 그쪽 주석에 있다.
       ⚠️ 조건 밖에 두면 안 된다. 아래 `if(inst._animal)` 안에 넣으면 폴백일 때 값이
         갱신되지 않아 **직전 캐릭터의 판정이 그대로 남는다.** */
    seat._animalBuilt = !!inst._animal;
    // 동물은 animal.js가 만든 텍스처(몸 무늬+표정 / 감은눈)를 그대로 사용 — 인간용 얼굴 합성 경로를 타지 않음
    const fT=inst._animal ? animBase.fT : mkFaceTex(compositeFace(def.skin,def.face));
    const bT=inst._animal ? animBase.bT : mkFaceTex(compositeFace(def.skin,def.blink));
    setFaceMap(inst.faceMat, fT);
    // 커미션이 아닐 때만 옷색 적용 (커미션은 텍스처 기반이라 머티리얼 색=흰색 유지)
    if(!def.isCommission){
      if(inst.upMat)inst.upMat.color.set(def.top); if(inst.loMat)inst.loMat.color.set(def.bot);
      if(inst.hatMat&&inst.hatMat.color)inst.hatMat.color.set(def.top);   // 🎩 기본 모자는 상의색을 따라감
    }
    applyLightPresetToInstance(inst);   // 생성기와 같은 톤(텍스처 색을 emissive로 평탄화)
    seat.faceMat=inst.faceMat; seat.faceMapOrig=fT; seat.blinkTex=bT;
    /* 👁 새 모델은 뜬 눈 텍스처로 시작한다 — 감김 표시도 같이 «뜸» 으로 되돌려 둔다.
       프레임 루프는 표시가 **바뀔 때만** 텍스처를 바꾸므로, 졸던 중(closed=true)에 모델이 바뀌면
       표시는 감김인데 그림은 뜬 눈으로 남는다(제보 #6 — 편집 → 완성 후 조는데 눈 뜸). 다음 프레임이 다시 감긴다. */
    if(seat.blink) seat.blink.closed = false;
    seat.upMesh=inst.upMesh||null; seat.loMesh=inst.loMesh||null;   // 옷 교체 시 기본 메시 숨김용
    seat.glassesMesh=inst.glassesMesh||null;   // 안경 파츠 장착 시 기본(베이크된) 안경 숨김용
    seat.hatMesh=inst.hatMesh||null; seat.hatMat=inst.hatMat||null; seat.maskMesh=inst.maskMesh||null; seat.onepieceMesh=inst.onepieceMesh||null;
    seat.wingMesh=inst.wingMesh||null; seat.handLMesh=inst.handLMesh||null; seat.handRMesh=inst.handRMesh||null; seat.capeMesh=inst.capeMesh||null;
    if(!inst._animal) _attachHumanEars(inst.root, def);   // setupSeatModel 이 애니메이션을 걸기 전(바인드 자세)
    setupSeatModel(seat, inst.root, BASE_ANIMS, '커스텀 캐릭터');
    // 🐾 동물 귀 등록 — setupSeatModel이 seat.bones를 새로 만들기 때문에 반드시 그 '뒤'에 해야 한다.
    //   __animalSeat: 아직 파싱 중인 귀가 나중에 붙을 때 animal.js가 이 좌석을 찾아오기 위한 역참조.
    if(inst._animal){ inst.root.userData.__animalSeat = seat; _sweepAnimalEars(seat, inst.root); }
    else _syncHumanEarRig(seat);   // 🐾 사람 귀 — setupSeatModel 이 seat.bones 를 새로 만든 뒤에 올린다(동물과 같은 이유)
    
    // [수정] 생성기에서 설정한 캐릭터 크기와 위치 데이터를 메인 화면에 확실하게 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=(xf.s!=null && isFinite(xf.s) && xf.s>0) ? xf.s : 1;   // ★ 0.1.0 등 예전 버전 저장 데이터엔 s(크기) 필드가 없을 수 있어서 방어
      /* 🧍 캐릭터 높이 — 생성기 높이 슬라이더 값(xf.y). fitModel 이 _uz 로 나눠 적용한다.
         🚫 앞뒤(xf.z)는 폐기 — 옛 저장본이 무엇을 갖고 있어도 0 으로 읽는다. CHAR_Z(seat.rig.position.z)가
            책상과의 간격을 정하므로 사용자 조정 항은 필요 없다. 다음 저장 때 xf.z 자체가 0 으로 굳는다.
            ⚠️ COMMISSION_Z_OFFSET·DEFAULT_CHAR_Z_EXTRA_OFFSET 은 둘 다 0 이라 함께 사라진다. */
      seat.userY=clampCharY(xf.y);
      seat.userZ=0;
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
    /* ★ 파츠 부착이 끝난 뒤 fitModel을 한 번 더 돌린다.
       ⛔ 폐기된 이유 — 예전 주석: "파츠가 붙으면 바운딩박스 높이가 달라져서 미리보기와 크기가
          어긋나던 원인 → 미리보기와 같은 조건(파츠 포함 박스)으로 재계산." 그 '파츠 포함' 이
          바로 캐릭터가 파츠 크기에 따라 줄어드는 원인이었다(measureCharBox 주석 참고).
          이제 양쪽 다 맨 몸으로 재므로 크기는 이 재호출과 무관하게 항상 같다.
       ★ 그래도 이 재호출은 남긴다 — 발밑 파츠 바닥 맞춤(measureUnderfootDepth)과 리깅 파츠
          bindMatrix 재굽기(refreshRiggedPartsXf)가 파츠가 붙은 뒤에 한 번은 돌아야 한다. */
    //   ★ 레이스 가드: 투게더룸에서 사람이 나가거나 캐릭터가 교체되면 이 비동기 .then이 "낡은 좌석"에
    //     뒤늦게 발사되어 크기가 튀는 문제(원격 캐릭터가 갑자기 커지는 증상)가 있어서, 좌석이 여전히
    //     같은 charDef를 들고 있고 모델도 살아있을 때만 재계산.
    applyEquippedPartsToSeat(seat, def).then(()=>{
      try{
        if(seat && seat.charDef===def && seat.gltfRoot){
          fitModel(seat); layoutSeats();   // fitModel 내부에서 리깅 파츠 xf도 다시 구움
        }
      }catch(_){}
    });
    
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
    seat.modelRoot=base.root;   // 🎩 파츠 좌표계 기준 — base.group은 wrap, 본은 base.root 안에 있다(위 setupSeatModel 주석 참고)
    seat.isPlaceholder=false;seat.mixer=null;seat.hasRig=false;
    seat.faceMat=base.faceMat;seat.faceMapOrig=base.fT;seat.blinkTex=base.bT;
    /* 👁 새 모델은 뜬 눈 텍스처로 시작한다 — 감김 표시도 같이 «뜸» 으로 되돌려 둔다.
       프레임 루프는 표시가 **바뀔 때만** 텍스처를 바꾸므로, 졸던 중(closed=true)에 모델이 바뀌면
       표시는 감김인데 그림은 뜬 눈으로 남는다(제보 #6 — 편집 → 완성 후 조는데 눈 뜸). 다음 프레임이 다시 감긴다. */
    if(seat.blink) seat.blink.closed = false;
    seat.headAnchor.position.set(0,1.2,0);seat.bodyAnchor.position.set(0,0.7,0);
    
    // [수정] 폴백 캐릭터일 때도 생성기에서 설정한 크기를 똑같이 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=(xf.s!=null && isFinite(xf.s) && xf.s>0) ? xf.s : 1;   // ★ 0.1.0 등 예전 버전 저장 데이터엔 s(크기) 필드가 없을 수 있어서 방어
      /* 🧍 캐릭터 높이 — 생성기 높이 슬라이더 값(xf.y). fitModel 이 _uz 로 나눠 적용한다.
         🚫 앞뒤(xf.z)는 폐기 — 옛 저장본이 무엇을 갖고 있어도 0 으로 읽는다. CHAR_Z(seat.rig.position.z)가
            책상과의 간격을 정하므로 사용자 조정 항은 필요 없다. 다음 저장 때 xf.z 자체가 0 으로 굳는다.
            ⚠️ COMMISSION_Z_OFFSET·DEFAULT_CHAR_Z_EXTRA_OFFSET 은 둘 다 0 이라 함께 사라진다. */
      seat.userY=clampCharY(xf.y);
      seat.userZ=0;
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
  }

  // 🐾 진단(임시) — 실행 화면 실측. 비동기(책상 GLB) 적용이 끝난 뒤 재야 정확하다.

  // 🐾 클릭/드래그 히트 영역 — 동물일 때만 숨겨진 placeholder를 레이캐스트에서 제외(인간은 원래대로 복원).
  //   placeholder.root.visible이 확정된 이 시점(모델 조립 이후)에 판정해야 정확하다.
  {
    const _phHidden = !!(seat.placeholder && seat.placeholder.root && seat.placeholder.root.visible === false);
    _setPlaceholderPickable(seat, !(def.animal && _phHidden));
  }

  // [수정] 공통 꾸미기 및 책상 크기/색상 적용 파트
  /* 색을 안 고른 옛 저장도 이 함수를 지나야 한다 — 색은 그대로 두고 조명 예산만 맞춘다. */
  if(seat.deskMat) _setDeskMatColor(seat.deskMat, def.deskColor || null);   
  
  // [수정] 생성기에서 조절한 책상 크기(def.deskScale)를 메인 화면의 책상(seat.desk)에 강제로 반영합니다!
  setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
  setDeskPos(seat.desk, def.deskPos);   // 🪑 책상 위치 오프셋 — 없으면 0,0,0 = 예전과 동일
  
  
  (async()=>{  
    if(def.customItems){ for(const id in def.customItems){ if(!customItems[id]){ const c=def.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod.parseGlbFull(b64ToBuf(c.glb)); registerCustomItem(id,c.name,c.glb,sc,'',animations);}catch(e){} } } }
    if(def.deskCatalogId){ applyDeskCatalogRefToSeat(seat, def); }
    else if(def.deskGlb){ try{ const sc=await assetCodeMod.parseGlbBytes(b64ToBuf(def.deskGlb)); seat.desk.userData.deskScale=def.deskScale||1; swapDeskVisual(seat.desk,sc); setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1); if(def.deskColor)applyDeskColorToCustom(seat.desk,def.deskColor);}catch(e){} }
    else { applyDeskCatalogRefToSeat(seat, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:def.deskScale, deskLenX:def.deskLenX, deskColor:def.deskColor}); }   // 관리자가 기본 책상을 교체해뒀으면 그걸로, 없으면 원래 하드코딩된 기본 책상 그대로
    // ★ 새 아이템 목록을 적용하기 전에 기존에 붙어있던 아이템을 먼저 확실히 뗌 — 이 단계가 없어서
    //   실행 중인 캐릭터를 우클릭으로 수정할 때(특히 아이템을 끄거나 다른 걸로 바꿀 때) 예전 아이템이
    //   계속 남아있던 버그의 원인이었음(생성기 미리보기는 clearCreatorItems가 매번 먼저 비워서 문제 없었음).
    clearHolderDeskItems(seat);
    if(def.deskItems) applyDeskItemsTo(seat, def.deskItems);
  })();
}

/* ===================== 설정 패널 "캐릭터" 탭 — 캐릭터 교체 / 자리 추가(솔로 전용) =====================
   - 캐릭터 교체: 내 좌석(findMySeat)의 모습을 저장된 다른 슬롯으로 즉시 교체. 멀티모드에서도 가능하며
     Presence.updateDef로 상대방에게도 즉시 동기화됨.
   - 자리 추가: 솔로모드 한정, 저장된 슬롯 중 현재 활성 슬롯을 제외한 나머지를 원하는 만큼(최대 전체) 동시에
     로컬 전용 추가 좌석으로 앉힐 수 있음. 각 슬롯을 독립적으로 켜고 끔. 재시작해도 유지되지만, 멀티모드로
     들어가는 순간 전부 자동으로 빠지고 방 나오면 다시 복원됨(실제 친구 좌석과 혼동 방지). */
/* (앱 FSD 27번) 이 자리의 본문도 settings-panel.js 로 옮겼다 — 만드는 줄은 첫 자리. */

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
  else { t.textContent='🪴 책상 친구들'; s.textContent='짧게 클릭하면 쓰다듬 · 편집은 런처 ⚙'; }
  applyDesktopRunClass();
}
function launchApp(opts){ opts=opts||{};
  const myDef = slots[curSlot] || slots.find(Boolean);
  if(!myDef){toast('먼저 캐릭터를 만들어 주세요');return;}
  [...seats].forEach(s=>{scene.remove(s.group);overheadMod.removeSeatLabels(s);});seats.length=0;
  const me=createSeat(); applyCharToSeat(me,myDef); me.slot=curSlot; me.isMe=true;
  selectSeat(me);renderSeatTabs();setManual(null);
  appMode = (opts.mode==='edit') ? 'editseat' : 'run';
  applyAppMode();
  document.getElementById('launcher').classList.remove('on');
  if(Presence.active()){
    roomEntryMod.syncFriendSeats(Presence.friendsObj());   // 초대된 친구 복원
    /* 방에 있는 채로 런처에서 캐릭터를 고쳤거나(⚙ 캐릭터 수정 · 생성기 kind:'slot') 다른 칸을 골라 돌아왔으면
       방에 나간 def 와 지금 def 가 다르다 — 생성기 kind:'slot' 저장은 슬롯에만 쓰고 방으로는 안 보낸다.
       그대로 두면 내 화면만 바뀌고 남의 화면은 옛 모습이다. 캐릭터 교체(switchMainCharacter)와 같은 길로 보낸다.
       슬롯 저장은 새 def 객체를 만들므로 같은 객체면 바뀐 것이 없다 — 런처만 다녀온 왕복은 아무것도 안 보낸다. */
    if(Presence.myDef() !== myDef) Presence.updateDef(myDef);
  }
  else settingsMod.extraSeatSlots().forEach(i=>{ if(i!==curSlot && slots[i]) settingsMod.addExtraSeat(i); });   // 솔로모드 — 저장해둔 자리추가 좌석들 복원(주캐릭터 슬롯과 겹치면 제외 — 자기 복제 방지)
  layoutSeats();
  // 💡 상태칩 Tab 힌트 — run 모드로 들어올 때마다(런처 나갔다 다시 들어와도) 한 번만 안내.
  //    칩이 지금 접혀(숨겨져) 있을 때만 의미 있으므로 그 경우에만 보여줌. Tab을 먼저 눌러 스스로 찾으면
  //    위 keydown 핸들러가 이 타이머를 취소해서 뒤늦게 뜨지 않음.
  if(statusChipMod._tabHintTimer()){ clearTimeout(statusChipMod._tabHintTimer()); statusChipMod.setTabHintTimer(null); }
  if(appMode==='run'){
    statusChipMod.setTabHintTimer(setTimeout(()=>{
      statusChipMod.setTabHintTimer(null);
      const chip=document.getElementById('myStatusChip');
      if(document.body.classList.contains('runmode') && chip && chip.classList.contains('collapsed')) toast('상태칩이 안 보이면 Tab 키를 눌러보세요');
    }, 1200));
  }
}
function backToLauncher(){
  if(statusChipMod._tabHintTimer()){ clearTimeout(statusChipMod._tabHintTimer()); statusChipMod.setTabHintTimer(null); }
  // 🪑 방을 나가면 상호작용 책상 복원 플래그 리셋(다음 입장 때 저장값으로 다시 복원) +
  //   내 좌석에 붙은 벤치 시각물 제거(장착 '저장'은 유지 — 재입장 시 복원됨).
  rideBenchMod._resetIdeskRestore();
  try{ const _me = seats.find(s=>s.isMe);
    if(_me && _me.bench){ seats.filter(o=>o.seatedOn===_me).forEach(o=>{ try{ rideBenchMod.unmountBench(o); }catch(_){} });
      _me.group.remove(_me.bench); _me.bench=null; _me.benchSlots=null; _me.benchDeskId=null; _me.benchOccupants={};
      _me._benchOwnerSit=false; _me._benchSit=false; if(_me.desk) _me.desk.visible=true; }
  }catch(_){}
  appMode='run';
  document.getElementById('launcher').classList.add('on');
  // ★ 꾸미기 창이 켜진 채로 런처에 돌아가면 그대로 떠 있던 채 따라오던 문제 — 런처로 돌아갈 땐 항상 닫음.
  //   (이 상태가 이어져서 이후 관리자 모드에서 꾸미기 아이콘이 안 먹히는 것처럼 보이던 문제도 같이 방지됨)
  //   💾 닫는 것이 곧 저장이라 closeWardrobe 로 닫는다 — 창만 숨기면 꾸민 것이 저장되지 않았다(설정 패널 «런처로» 버튼 길)
  const wp=document.getElementById('wardrobePanel');
  if(wp && wp.classList.contains('on') && typeof window.closeWardrobe==='function'){ try{ window.closeWardrobe(); }catch(_){} }
  if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  // ★ 마이홈도 동일한 이유로 닫음 — 켜진 채로 런처에 오면 그대로 남아 실행 화면 위에 겹쳐 보임.
  //   commitMyHomePage(true)로 저장까지 처리한 뒤 닫기.
  const mhOv=document.getElementById('myHomeOverlay');
  if(mhOv && mhOv.classList.contains('on')){
    try{ if(typeof window.commitMyHomePage==='function') window.commitMyHomePage(true); }catch(_){}
    mhOv.classList.remove('on'); myHomeOpen = false;
    if(typeof _mhGbStopWatch==='function') _mhGbStopWatch();
    if(typeof window._bgmDestroy==='function') window._bgmDestroy();
    else if(window.companion && companion.closeBgm) companion.closeBgm();
    if(typeof window._mhDsClose==='function') window._mhDsClose();
  }
  renderLauncher();
  // 🕒 런처로 돌아오는 시점 = 이번 세션의 포커스 기록을 확정하기 좋은 경계.
  //   여기서만 서버와 맞추므로 쓰기 횟수가 적고(세션당 몇 번), 다른 기기의 기록도 이때 받아온다.
  focusLevelMod.syncFocusTotalToServer('launcher');
  // 👑 달성표도 같은 경계에서 맞춘다 — 다른 기기에서 체크한 오늘 항목이 여기서 따라온다.
  weeklyChal.syncChalToServer('launcher');
  // 🎰 가챠도 같은 경계에서. 셋 다 '다른 기기에서 쌓인 것을 받아오는' 같은 성격이라 한자리에 둔다.
  gachaMod.syncGachaToServer('launcher');
  applyDesktopRunClass();
}
document.getElementById('toLauncher').onclick=backToLauncher;

/* ===================== 친구 초대 · 상태 공유 (Presence) =====================
   provider 인터페이스: join(room, me, onFriends) / update(state) / leave()
   지금은 makeMockProvider(로컬 시뮬레이션). 실서비스에선 makeFirebaseProvider로 교체.   */
/* ★ 한 방 정원(나 포함). 5 → 6 → 8 → 10(2026-10-02 요청).
   ⚠️ 서버 규칙에도 방 인원 제한은 없다(rooms/$room/$memberId 는 형식만 검사).
      정원은 startRoom의 사전 검사 하나로만 지켜지므로, 구버전 클라이언트가 섞이면
      정원을 넘겨 들어올 수 있다. 화면은 넘쳐도 깨지지 않고 좌석만 늘어난다.
   ⚠️ [8 → 10] **옛 판(8)과 섞이면** — 옛 판은 친구를 7명까지만 그리고(9·10번째가 안 보임), 8명 이상인 방에는
      못 들어오며, 늦게 들어온 옛 판은 8번째 자리부터 스스로 나간다. 새 판끼리는 10명이 정상이다.
      ⇒ 배포 뒤 관리자가 방 입장 최소 버전(minVersion.room)을 새 판 번호로 올리면 옛 판은 방 입장 자체가 막혀 섞이지 않는다.
   💰 이 숫자는 곧 비용이다 — 한 멤버가 1바이트를 쓰면 방의 나머지 인원수만큼 내려간다
      (_diffRoomPayload 주석의 실측 ×4.0). 6→8은 꽉 찬 방 기준 다운로드가 약 1.4배다.
      8→10 은 꽉 찬 방 기준 약 1.6배다(인원×(인원−1): 56 → 90). */
/* ★ 정원은 원격 설정 roomMaxPeople(remote-config.js · API · 2~50 · 없으면 10) — 바뀌면 다음 판정부터 바로 따른다.
   firebase-init.js(joinRoom 리스너)의 정원 초과 자기 퇴장도 같은 store 를 읽는다 — 숫자를 두 곳에 적지 않는다. */
function maxPeople(){ const s = licenseGateMod._rcStore(); return s ? s.maxPeople() : 10; }
/* ═══ 🚪 자리비움 자동 퇴장 [건의 2026-09-12] ═════════════════════════════════
   [건의] "투게더룸·워킹룸에 6시간 넘게 자리비움이면 자동으로 방에서 퇴장되는 기능이 없을까요?"

   [시계의 시작점] **자동 자리비움에 들어간 시각**부터 6시간이다(요청). 마지막 입력 시각이 아니다.
     자동 자리비움 자체가 20분 무반응으로 걸리므로 실질적으로 '마지막 입력 + 20분 + 6시간' 이다.
     ⚠️ 손으로 고른 🫧자리비움에는 걸리지 않는다 — 그건 «내가 이 상태를 골랐다»는 뜻이고,
       자동 전환 표식(_autoAwayApplied)이 서지 않으므로 아래 판정에도 안 들어온다.

   [흐름]
     ① 자동 자리비움 진입           → _autoAwayAt 에 시각을 적는다
     ② 6시간에서 1분 남으면 팝업     → «mm분 ss초 후에 자동 퇴장됩니다» + [취소] 하나
     ③ [취소]                      → 창이 닫히고 상태가 **온라인**으로 돌아간다.
                                     버튼을 눌렀다 = 사람이 돌아왔다는 뜻이라서다(요청).
                                     시계도 처음부터 다시 — 또 자리를 비우면 6시간 뒤 다시 뜬다.
     ④ 1분 안에 안 누르면            → **방만** 나간다(앱은 그대로). 같은 창의 문구가
                                     «자리비움이 길어 방에서 나왔어요»로, 버튼이 [확인]으로 바뀐다.
       ★ 새 창을 띄우지 않는 이유 — 자리에 없는 사람의 화면에 창이 둘로 늘어나면, 돌아왔을 때
         무엇을 눌러야 하는지가 흐려진다. 같은 창이 결과를 말하는 편이 읽기 쉽다.

   [예외] **시크릿룸의 방장만** 제외한다. 방장이 빠지면 남은 사람들의 방이 통째로 흔들린다 —
     승계·채팅 잠금(_chatOffOn)·스티커사진 진행이 전부 방장에 매여 있고, 특히 촬영 카운트다운은
     방장이 나가면 영영 안 끝난다(_pk 주석). 그 외에는 채널을 가리지 않는다(워킹룸·투게더룸 동일).

   ⚠️ 팝업에 `app-popup-ov` 클래스가 **반드시** 있어야 한다. 실행 화면은 화면 전체를 덮는 투명
     오버레이라, 이 클래스가 없으면 클릭 판정 화이트리스트(UI_HIT_SEL)에 안 걸려서 [취소] 를
     눌러도 클릭이 뒤 프로그램으로 샌다(_chalPopup 주석과 같은 근거).
   ⚠️ 1분은 **팝업이 뜬 순간부터** 잰다. 자동 자리비움 틱이 5초 간격이라 6시간 경계에 정확히
     맞춰 뜨지 않는데, 남은 시각을 그대로 쓰면 사람마다 «55초 남음»으로 떠서 안내한 1분을
     지키지 못한다. 여기서는 «1분을 준다»가 약속이다.
   ✅ 방 나가기는 doLeaveRoom() 하나로 통일한다 — 정원 초과 자동 퇴장(_onRoomOverCapacity)과
     같은 문이다. 여기서 Presence.stop() 을 직접 부르면 채널 원복·대화창 닫기가 빠진다. */
/* (앱 FSD 35번) 이 자리의 본문도 room-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🛰 방 접속 상태(Presence) ═══ */
const Presence=(()=>{
  let provider=null, room=null, friends={}, myDef=null, myName='나', myState='idle', myUserStatus=null, myLevel=1, onChange=null;
  /* 🛰 내 노드 poke 의 중복·유통기한 판정용. friends 쪽 `_lastPokeTs` 와 같은 역할이다.
     _joinedAt 은 '이 방에 들어온 시각' — 들어오기 전에 찍힌 알림(내가 없던 사이의 마지막 값)을 거른다. */
  let _myPokeSeenTs = 0, _joinedAt = 0;
  let myNoise='';          // 🌙 백색소음 종류('pencil'|'keyboard'|'page' · 없으면 빈 문자열) — parts/noise.js 가 정한다. 구버전은 이 칸을 무시한다
  let myAwayImg='';        // 🫧 자리비움 그림 URL — 방에 실어 보낸다(없으면 빈 문자열 · 구버전은 무시)
  /* 📏 그 그림의 화면 크기(60·80·100) — 받는 쪽이 이 크기로 그린다(구버전은 무시 → 그쪽 고정값).
     ⚠️ 초기값을 AWAY_PIC_SCREEN_PX 로 쓰지 말 것 — 그 var 는 파일 아래쪽이라 이 IIFE 가 도는 순간엔 undefined 이고,
       Firebase 는 undefined 가 든 payload 를 통째로 거절한다(방 입장이 깨진다). 숫자로 둔다(기본 80 과 같은 값). */
  let myAwaySz=80;
  let myFocusShow=null;   // 📊 오늘 기록 전시 {emo,text} — 상태가 없을 때만 custom 칸으로 실어 보낸다(_statusOut)
  let myCustomStatus=null;   // ✨ 커스텀 상태(프리미엄) {emo,text} — userStatus==='custom'일 때 친구에게 보여줄 문구

  // ────────────────────────────────────────────────────────────────────
  // 🌙 자동 자리비움 전환 — 20분간 마우스/키보드 반응이 없으면 userStatus를 'away'로 자동 세팅.
  //   예외: 'meal'(밥먹는중), 'gaming'(게임중)은 유저 의도 존중해서 자동 전환하지 않음.
  //   활동 재개 시(마우스/키보드 사용) 자동 해제. 단, 유저가 수동으로 설정한 자리비움은 유지.
  //   (수동/자동 구분은 _autoAwayApplied 플래그로 판정 — 자동 전환한 것만 자동 해제됨)
  // ────────────────────────────────────────────────────────────────────
  const AUTO_AWAY_MS = 20 * 60 * 1000;   // 20분 무반응 → 자동 자리비움
  // ★ 비대칭 틱 — 진입 판정과 복귀 판정은 요구되는 반응 속도가 다름.
  //   · 평소(IDLE_TICK 60초): 임계값이 20분이라 1분 오차는 무의미. 부하 최소화.
  //   · 자동 자리비움 중(BACK_TICK 5초): 사람이 돌아왔는데 캐릭터가 영혼 상태로 남아있으면 곧바로
  //     어색하므로 촘촘히 감시해서 빨리 복귀시킴.
  const AUTO_AWAY_TICK_IDLE_MS = 60 * 1000;   // 평소 체크 주기
  const AUTO_AWAY_TICK_BACK_MS = 5 * 1000;    // 자동 자리비움 중일 때 복귀 감시 주기
  let _autoAwayApplied = false;      // 지금의 'away'가 자동 전환된 것인지 (수동 설정과 구분)
  let _preAutoAwayStatus = null;     // 자동 전환 직전 상태 — 활동 재개 시 여기로 복원
  /* 🚪 자동 자리비움에 **들어간 시각**. 6시간 자동 퇴장의 기준점이다(_autoExitWarn 주석).
     0 = 자동 자리비움이 아니다. */
  let _autoAwayAt = 0;
  /* 자동 퇴장 뒤 시계를 되감는 통로 — 팝업 쪽(_autoExitDo)이 부른다. 그 자리에서는 이 변수가
     안 보이므로(IIFE 안이다) 여기서 내준다. */
  window._autoAwayResetClock = ()=>{ _autoAwayAt = Date.now(); };
  // 유저가 상태칩으로 직접 상태를 고르면 자동 전환 흔적을 리셋 (내부 setUserStatus에서 호출)
  /* ⚠️ 자동 퇴장 안내창도 함께 거둔다 — 사람이 직접 상태를 골랐다는 것은 자리에 있다는 뜻이라,
     «곧 나갑니다» 를 그대로 세워두면 거짓말이 된다. _autoExitCancel 은 재진입에 안전하다. */
  function _clearAutoAwayMarks(){
    _autoAwayApplied = false; _preAutoAwayStatus = null; _autoAwayAt = 0;
    try{ roomSyncMod._autoExitCancel(); }catch(_){}
  }
  /* 🩹 [2026-10-02 제보 #1] «장시간 자리비움 뒤 마우스를 움직여도 온라인으로 안 돌아온다»
     [원인] 전역 setUserStatus 는 'away' 를 localStorage(tw.userStatus)에 남기지만, «자동으로 들어간
       자리비움» 표식(_autoAwayApplied)은 메모리에만 있었다. 자리비움 중에 앱이 다시 켜지면
       (윈도우 업데이트 재부팅·크래시·자동 시작) 전역 userStatus 만 'away' 로 되살아나고
       여기 myUserStatus 는 null · _autoAwayApplied 는 false 로 시작한다
       ⇒ 복귀 조건(`_autoAwayApplied && myUserStatus==='away'`)이 영영 참이 안 된다.
       덤으로 내 화면은 자리비움인데 친구 화면에는 온라인(null)으로 보였다.
     [대응] ① 자리비움의 종류(auto/manual)와 복원할 직전 상태를 tw.awayKind 에 같이 남긴다.
       ② 이 IIFE 가 만들어질 때 저장된 상태로 myUserStatus 를 맞추고, 자동이었으면 표식을 되살린다.
     ★ 기록이 **없는** 'away' 는 자동으로 본다 — 이 수정 전 판본이 남긴 값이고, 지금 갇혀 있는
       사람을 풀어 주는 쪽이 맞다. 손으로 고른 자리비움은 이 판본부터 'manual' 로 남으므로 유지된다.
     ⚠️ 6시간 자동 퇴장 시계(_autoAwayAt)는 부팅 시각부터 다시 센다 — 꺼져 있던 동안은 방에 없었다. */
  const AWAY_KIND_KEY = 'tw.awayKind';
  function _saveAwayKind(kind, pre){
    try{
      if(kind) localStorage.setItem(AWAY_KIND_KEY, JSON.stringify({ k: kind, pre: pre || null }));
      else localStorage.removeItem(AWAY_KIND_KEY);
    }catch(_){}
  }
  (function _restoreBootStatus(){
    let v = null;
    try{ v = localStorage.getItem('tw.userStatus') || null; }catch(_){}
    if(!v || !USER_STATUSES[v]) return;
    myUserStatus = v;
    if(v !== 'away') return;
    let rec = null;
    try{ rec = JSON.parse(localStorage.getItem(AWAY_KIND_KEY) || 'null'); }catch(_){}
    if(rec && rec.k === 'manual') return;   // 손으로 고른 자리비움 — 그대로 둔다
    _autoAwayApplied = true;
    _preAutoAwayStatus = (rec && rec.pre && USER_STATUSES[rec.pre] && rec.pre !== 'away') ? rec.pre : null;
    _autoAwayAt = Date.now();
  })();
  // 유휴 시간(ms) — OS의 powerMonitor 값이 있으면 그걸 우선 사용(마우스 "이동"까지 포함되어 가장 정확).
  //   IPC가 없거나 실패하면 렌더러가 직접 기록한 lastAnyInput(클릭·키 입력)으로 폴백.
  async function _idleMs(){
    if(window.companion && companion.getIdleSeconds){
      try{
        const sec = await companion.getIdleSeconds();
        if(typeof sec === 'number' && isFinite(sec) && sec >= 0) return sec * 1000;
      }catch(_){}
    }
    return performance.now() - lastAnyInput;
  }
  // 다음 틱을 현재 상태에 맞는 주기로 예약 (자동 자리비움 중이면 촘촘하게)
  let _autoAwayTimer = null;
  function _scheduleAutoAwayTick(){
    const delay = _autoAwayApplied ? AUTO_AWAY_TICK_BACK_MS : AUTO_AWAY_TICK_IDLE_MS;
    clearTimeout(_autoAwayTimer);
    _autoAwayTimer = setTimeout(_autoAwayTick, delay);
  }
  async function _autoAwayTick(){
    try{ await _autoAwayCheck(); }
    catch(err){ console.warn('[autoAway] 체크 실패', err); }
    finally{ _scheduleAutoAwayTick(); }   // 어떤 경우에도 다음 틱은 계속 예약 (루프가 끊기지 않게)
  }
  async function _autoAwayCheck(){
    /* 📱 폰에서 포커싱 어플을 쓰는 중이면 PC 입력이 없어도 자리에 있는 것이다 — 20분 자동 자리비움 · 6시간 퇴장을 건너뛴다.
       0 으로 두면 이미 자동 자리비움이었던 사람은 아래 «활동 재개» 갈래로 복원된다. */
    const idle = focusLevelMod._mobileOn() ? 0 : await _idleMs();
    // 밥먹는중·게임중은 자리를 비운 게 아니라 의도적으로 둔 상태 — 자동 전환하지 않음
    const skipStatus = myUserStatus === 'meal' || myUserStatus === 'gaming';
    // 상태 변경은 전역 setUserStatus로 해야 UI(상태칩)+캐릭터 모션까지 함께 갱신됨.
    //   ★ Presence IIFE 안에도 같은 이름의 내부 setUserStatus가 있어(스코프 가림) 반드시 window.으로 명시.
    //     내부 것을 부르면 Presence 상태만 바뀌고 화면은 그대로인 버그가 남.
    //   ★ 전역 setUserStatus → Presence.setUserStatus → _clearAutoAwayMarks()로 흔적이 지워지므로,
    //     자동 전환/복원 표시는 반드시 호출 "이후"에 세팅해야 함.
    const setStatus = (v)=>{
      try{ window.setUserStatus(v); return true; }
      catch(err){ console.warn('[autoAway] 상태 전환 실패', err); return false; }
    };
    if(idle >= AUTO_AWAY_MS && !skipStatus && myUserStatus !== 'away'){
      const prev = myUserStatus;   // 복원용으로 기억 (null이면 기본 상태였다는 뜻)
      if(setStatus('away')){
        _autoAwayApplied = true;
        _preAutoAwayStatus = prev;
        _autoAwayAt = Date.now();   // 🚪 6시간 자동 퇴장 시계는 여기서 시작한다
        _saveAwayKind('auto', prev);   // 🩹 #1 — 재시작해도 «자동» 이었음을 잊지 않게(위 _restoreBootStatus)
      }
    } else if(idle < AUTO_AWAY_MS && _autoAwayApplied && myUserStatus === 'away'){
      // 활동 재개 → 자동 전환 직전 상태로 복원 (빡일중이었으면 다시 빡일중, 기본이었으면 기본)
      const restore = _preAutoAwayStatus;
      if(setStatus(restore)){
        _autoAwayApplied = false;
        _preAutoAwayStatus = null;
        _autoAwayAt = 0;
        try{ roomSyncMod._autoExitCancel(); }catch(_){}   // 🚪 돌아왔으니 «곧 나갑니다» 안내도 거둔다
      }
    }
    /* 🚪 [건의 2026-09-12] 자리비움이 6시간에 1분 남았으면 안내창을 띄운다.
       ★ 진입/복귀 판정보다 **뒤**에 둔다. 앞에 두면 방금 돌아온 사람에게도 한 번 뜬다.
       ★ 판정만 여기서 하고, 방을 나갈지·시크릿룸 방장인지는 _autoExitWarn 이 정한다 —
         이 함수는 «자리비움이 얼마나 됐나»만 알면 되고, 방 사정은 저쪽이 안다.
       ⚠️ 이 틱은 자동 자리비움 중에 5초 주기다(AUTO_AWAY_TICK_BACK_MS). 1분 경고에 충분하다. */
    if(_autoAwayApplied && _autoAwayAt
       && (Date.now() - _autoAwayAt) >= (roomSyncMod.AUTO_EXIT_AFTER_AWAY_MS - roomSyncMod.AUTO_EXIT_WARN_MS)){
      try{ roomSyncMod._autoExitWarn(); }catch(err){ console.warn('[자동퇴장] 안내 실패', err); }
    }
  }
  _scheduleAutoAwayTick();   // 첫 틱 예약 (이후 틱마다 현재 상태에 맞는 주기로 스스로 재예약)

  /* ★ 방장 승계용 — 내가 프리미엄 방을 만들/이어받을 자격이 있는지(self-report).
     승계는 '채팅 켜짐' 정도의 권한이라 위조 위험이 낮아 클라이언트 보고로 충분(위험도 낮은 선택).
     라이선스(isPremium) 또는 관리자면 true. */
  function _myLicenseFlag(){
    try{ return !!(typeof isPremium!=='undefined' && isPremium) || !!(typeof isAdmin!=='undefined' && isAdmin); }
    catch(_){ return false; }
  }
  /* opts.provider — 방 서버 provider(makeServerProvider). 주면 입장 결과를 기다려 { ok, code, others, meta } 를 돌려준다.
     opts.hooks — Firebase 방이 알릴 곳(room-entry _firebaseRoomHooks) — makeFirebaseProvider 로 넘긴다.
     안 주면 예전 그대로(Firebase · 가짜 방) — 돌려주는 값도 예전처럼 방 코드다. */
  async function start(roomCode, def, name, changeCb, opts){
    if(provider) await stop();   // 이미 연결돼있는데 다시 시작하면(연결끊기 없이 재접속 등) 이전 접속 삭제가 끝난 뒤에 새로 join — 안 그러면 옛 항목이 아직 안 지워진 채로 남아 자기 자신이 중복으로 보일 수 있음
    room=roomCode; myDef=def; myName=name||'나'; myLevel=focusLevelMod.getFocusLevel(); _lvKey=''; onChange=changeCb||onChange; friends={};
    _myPokeSeenTs = 0; _joinedAt = roomSyncMod._srvNow();   // 🛰 새 방 = 새 우편함. 들어오기 전 알림은 안 읽는다
    // ✨ 앱 재시작 후 첫 접속 — localStorage에서 복원된 커스텀 상태 문구를 join 페이로드에 실어보냄
    //   (setCustomStatus를 거치지 않고 바로 join하는 경로라 여기서 한 번 동기화해줘야 친구 화면에 문구가 보임)
    if(typeof customStatusConf!=='undefined' && customStatusConf && customStatusConf.text){
      myCustomStatus = { emo: customStatusConf.emo||'', text: customStatusConf.text };
    }
    // 🏊 얼굴 PNG를 Storage에 올려 URL 준비 — 실패해도 dataURL 병행 전송이라 입장엔 지장 없음
    try{ await roomSyncMod.ensureRoomFaceUrls(myDef); }catch(_){}
    // HTML의 모듈 스크립트가 준비한 window.firebaseAPI가 있으면 그걸 쓰고, 없으면(로드 지연·실패 등) 가짜 시연 데이터로 폴백.
    /* 🧪 [Mac 제보 2026-09-23] "방을 만들면 현우·민지라는 캐릭터가 같이 뜨고 내 캐릭터 얼굴색이 바뀐다."
       [원인] 그 둘은 **시연용 가짜 방(makeMockProvider)** 의 친구다 — 내 캐릭터 def 를 베껴 피부색만 바꾼다.
         방에 들어가는 순간 firebaseAPI(모듈 스크립트)가 아직 준비 전이면 가짜 방으로 떨어졌다. mac 은 모듈 로드가 늦어 자주 걸렸다.
       ★ 준비를 기다린다(최대 NET_READY_WAIT_MS). 그래도 없으면 **들어가지 않고 알린다.** 가짜 방은 개발 표식(tw.mockRoom=1)일 때만. */
    if(!window.firebaseAPI) await roomEntryMod._waitFirebaseApi(roomEntryMod.NET_READY_WAIT_MS);
    if(!window.firebaseAPI && !roomEntryMod._mockRoomAllowed()){
      room = null; provider = null; friends = {}; if(onChange) onChange({});
      try{ toast('서버 연결이 아직 준비되지 않았어요 — 잠시 뒤 다시 들어가 주세요'); }catch(_){}
      console.warn('[방] firebaseAPI 가 준비되지 않아 입장을 멈췄다(가짜 방으로 떨어지지 않음)');
      return;
    }
    const _srv = (opts && opts.provider) || null;   // 🛰 방 서버 provider(_startRoomOnServer) — 없으면 아래 줄 그대로
    if(_srv) provider = _srv;
    else provider = window.firebaseAPI ? roomSyncMod.makeFirebaseProvider(opts && opts.hooks) : roomEntryMod.makeMockProvider();
    try{ myAwayImg = awayPicMod._awayUrlOk(awayPicMod.awayImgUrl()) ? awayPicMod.awayImgUrl() : ''; }catch(_){ myAwayImg = ''; }   // 🫧 입장 때 한 번
    try{ myAwaySz = awayPicMod._awaySzOk(awayPicMod.awayImgSz()) ? awayPicMod.awayImgSz() : awayPicMod.AWAY_PIC_SCREEN_PX(); }catch(_){ myAwaySz = awayPicMod.AWAY_PIC_SCREEN_PX(); }
    try{ myFocusShow = focusShareMod._focusShowConf(); focusShareMod._focusShowMarkSent(myFocusShow); }catch(_){ myFocusShow = null; }   // 📊 입장 때 한 번 — 입장 페이로드에 싣고 5분 시계를 여기서 시작
    try{ myNoise = (window.TW_NOISE && TW_NOISE.kind) ? TW_NOISE.kind() : ''; }catch(_){ myNoise = ''; }   // 🌙 입장 때 한 번
    const _st0 = _statusOut();
    const _joinRes = provider.join(room, {def:myDef,name:myName,awaySz:myAwaySz,state:myState,userStatus:_st0.userStatus,customStatus:_st0.customStatus,level:myLevel, ...focusLevelMod.myStarOut(),mobile:focusLevelMod._mobileRoomLabel(),userId:getMyUserId(), noise:myNoise, lic:_myLicenseFlag(), awayImg:myAwayImg}, fr=>{ friends=fr; if(onChange)onChange(friends); },
      // 다른 사람이 내 캐릭터를 쓰다듬거나 흔들었을 때 — 내 화면의 'me' 좌석에 그 반응을 그대로 재생
      p=>{ const me=seats.find(s=>s.isMe); if(!me||!p) return;
        /* 🛰 같은 알림을 두 번 재생하지 않고, 지나간 알림은 아예 보지 않는다.
           [경위] 여기에는 중복 검사가 없었다(친구 좌석 쪽에는 `_lastPokeTs` 로 있었다).
             poke 자리는 덮어쓰기 전까지 마지막 값을 들고 있으므로, 그 값이 다시 배달되는 순간
             — serverTimestamp 확정 콜백, 재접속 시 리스너 재부착 — **폭탄을 아무도 안 눌렀는데
             캐릭터가 날아간다.** 비행이 10초라 늦게 온 두 번째 배달은 이미 끝난 뒤에 도착한다.
           ⚠️ ts 가 없는 값(옛 클라이언트)은 예전처럼 그냥 재생한다 — 막으면 그쪽과 안 통한다. */
        const _pts = (typeof p.ts === 'number') ? p.ts : 0;
        if(_pts){
          if(_pts <= _myPokeSeenTs) return;                          // 같거나 뒤로 가는 값은 안 본다
          _myPokeSeenTs = _pts;
          if(_joinedAt && _pts < _joinedAt - roomSyncMod.POKE_SKEW_MS) return;   // 내가 들어오기 전에 찍힌 값
          if(!roomSyncMod._pokeFresh(_pts)) return;                              // 유통기한 지난 값
        }
        if(p.type==='pet'){
          // 💗 방금 내가 직접 쓰다듬은 것의 에코면 건너뛴다(이미 로컬에서 하트를 띄웠다 — 제보 #12)
          if(performance.now() - floatersMod._myPetLocalAt() < floatersMod.MY_PET_ECHO_MS) return;
          triggerPet(me); for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('♥','#f2607d',me),i*320);
        }
        else if(p.type==='dizzy'){ me.dizzyUntil=performance.now()+2500; for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f',me),i*300); }
        else if(typeof p.type==='string' && p.type.indexOf('fly:')===0){ tricksMod.applyRemoteFly(me, p.type.slice(4)); }   // 🪑 내가 날아간다 — 연속 횟수도 여기서 센다
        /* 🪄 내가 맞았다. 내가 나를 때린 경우도 이 노드로 돌아오는데, 그건 이미 로컬에서
           재생했으므로 applyRemoteBonk 안에서 걸러진다(때린사람 id 가 내 id). */
        else if(typeof p.type==='string' && p.type.indexOf('bonk:')===0){ tricksMod.applyRemoteBonk(me, p.type); }
        else if(typeof p.type==='string' && p.type.indexOf('dance')===0){   // 💃 방 전원 춤(댄스배틀 포함) — 타고 있으면 유지
          if(!me.ridingOn){
            const style = p.type.split(':')[1] || 'sway';
            const dd = iDeskMod.DANCE_MOVES.find(d=>d.style===style);
            me.danceUntil = performance.now() + ((dd && dd.dur) || 6000);   // 이미 춤추는 중이어도 새 춤으로 교체(배틀) — 레벨 무관 동참
            me.danceStyle = style;
            try{ if(Presence.broadcastRide) Presence.broadcastRide(); }catch(_){}   // 스타일 변경을 즉시 페이로드로
          }
        }
      });
    if(_srv){
      const r = await _joinRes;
      if(!(r && r.ok)){
        if(provider === _srv){ provider = null; room = null; friends = {}; if(onChange) onChange({}); }
        return { ok:false, code:(r && r.code) || 'fail' };
      }
      return r;
    }
    return room;
  }
  // 매 update마다 함께 보내는 공통 페이로드 (✨ customStatus 포함 — 친구 화면에서 커스텀 문구를 보여주기 위함)
  /* 🐾 올라타기·탑쌓기 공유 — '내가 바로 아래 누구 위에 타고 있는가' 하나만 보낸다.
     각자 자기 바로 아래만 전송하면 받는 쪽에서 관계를 이어 붙여 탑 전체가 재구성되므로,
     1층이든 4층이든 데이터 구조가 같다(값 하나). 문자열 하나라 방 사용량 영향도 사실상 없다.
     ★ 값은 '상대 식별자' — 내 좌석이 친구 위에 타면 그 친구의 id, 내 캐릭터 위면 'me'. */
  function _myRidingOn(){
    try{
      const me = seats.find(x=>x.isMe);
      if(!me || !me.ridingOn) return null;
      const h = me.ridingOn;
      if(h.isMe) return 'self';
      // ★ friendId는 '방 세션마다 새로 뽑히는 memberId'라 받는 쪽에서 자기 자신을 알아볼 수가 없다.
      //   (내가 상대 머리에 올라탔다고 보내도, 상대는 그 값이 자기라는 걸 몰라서 곧바로 내려버렸다)
      //   join 페이로드에 함께 싣는 userId는 양쪽이 공유하는 안정적인 값이라 이걸 쓴다.
      return h.friendUserId || null;
    }catch(_){ return null; }
  }
  // 🪑 내가 앉은 벤치 슬롯 — {host:<상대userId 또는 'self'>, slot:n} 또는 null.
  function _mySeatedOn(){
    try{
      const me = seats.find(x=>x.isMe);
      if(!me || !me.seatedOn) return null;
      const h = me.seatedOn;
      const host = h.isMe ? 'self' : (h.friendUserId || null);
      if(host==null) return null;
      return { host, slot: me.seatSlot|0 };
    }catch(_){ return null; }
  }
  // 🪑 내가 벤치를 놨는지 — {seats, deskId} 또는 null. 친구 화면에도 같은 벤치가 생기게 전송.
  function _myBench(){
    try{ const me = seats.find(x=>x.isMe); return (me && me.bench) ? { seats:(me.bench.userData.benchSeatCount||2), deskId:(me.benchDeskId||null) } : null; }catch(_){ return null; }
  }
  // 💃 내가 지금 추는 춤 스타일 — 춤추는 중일 때만 값, 아니면 null(친구 화면이 내 춤 종류를 알게).
  function _myDanceStyle(){
    try{
      const me = seats.find(x=>x.isMe);
      return (me && me.danceUntil && performance.now() < me.danceUntil) ? (me.danceStyle||'sway') : null;
    }catch(_){ return null; }
  }
  /* ⭐ exp = 레벨 안 진행도(0~12칸). 하트비트에도 실리지만 여기에도 넣어야 입장 직후 첫 30초 동안
     상대 화면에 바가 비어 보이지 않는다. 이 push들은 원래 발생하던 것이라 추가 쓰기는 없다. */
  function _myExpCells(){ try{ return expBarMod.myExpCells(); }catch(_){ return null; } }
  /* 🪑 내가 쉬는 중인 시각(ms) — 지나갔으면 null 로 보내서 필드를 비운다.
     ★ 새 쓰기를 거의 만들지 않는다: 값이 바뀌는 순간(연속 기준 도달)에만 broadcastNow 가 한 번
       나가고, 그 뒤로는 원래 나가던 update 에 필드 하나(숫자)가 얹혀 갈 뿐이다. */
  function _myFlyCool(){
    try{ return (typeof tricksMod._myFlyCoolUntil()==='number' && tricksMod._myFlyCoolUntil() > Date.now()) ? tricksMod._myFlyCoolUntil() : null; }
    catch(_){ return null; }
  }
  /* 📊 오늘 기록 전시 — **새 필드를 만들지 않는다.** 상태가 없을 때(myUserStatus null)만 userStatus 'custom' +
     customStatus {🕒, '오늘 H:MM'} 로 싣는다. 받는 쪽은 기존 커스텀 상태 경로 그대로라 구버전도 보인다.
     ★ 상태(밥·자리비움·커스텀 …)가 있으면 그것이 그대로 나간다 = 상태 메시지 우선 · 남의 설정을 덮지 않는다.
     ⚠️ 규칙: customStatus.text ≤ 12 · emo ≤ 4 — «오늘 99:59» 10자 · 🕒 2 로 안에 든다(규칙 변경 없음). */
  function _statusOut(){
    /* 📱 폰 켜짐이면 🕒 오늘 기록보다 «📱 앱» 이 먼저다(사용자가 고른 상태는 그대로 이긴다) — 받는 쪽이 mobile 칸을 띄운다. */
    if(!myUserStatus && focusLevelMod._mobileOn()) return { userStatus:myUserStatus, customStatus:myCustomStatus };
    if(!myUserStatus && myFocusShow) return { userStatus:'custom', customStatus:myFocusShow };
    return { userStatus:myUserStatus, customStatus:myCustomStatus };
  }
  function setAwayImg(url){
    const v = awayPicMod._awayUrlOk(url) ? url : '';
    if(v === myAwayImg) return;
    myAwayImg = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  /* 📏 [2026-10-02] 자리비움 그림 화면 크기 — 규칙 변경 없는 방 payload 한 칸(awayImg 와 같은 방식). */
  function setAwaySz(px){
    const v = awayPicMod._awaySzOk(px) ? px : awayPicMod.AWAY_PIC_SCREEN_PX();
    if(v === myAwaySz) return;
    myAwaySz = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  /* 🌙 백색소음 — 고른 소리 종류 한 칸만 싣는다(상태 focus/idle/sleep 은 이미 흐른다 · 규칙 변경 없음 — awayImg 와 같은 방식).
     ★ 끄면 빈 문자열 — null 로 보내면 칸이 지워져 _diffRoomPayload 기준값과 어긋난다. */
  function setNoise(kind){
    const v = (typeof kind === 'string' && /^(pencil|keyboard|page)$/.test(kind)) ? kind : '';
    if(v === myNoise) return;
    myNoise = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  function setFocusShow(conf){
    const v = (conf && conf.text) ? { emo: conf.emo || '', text: conf.text } : null;
    if(JSON.stringify(v) === JSON.stringify(myFocusShow)) return;
    myFocusShow = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  function _basePayload(){ const _st=_statusOut(); return {state:myState, userStatus:_st.userStatus, customStatus:_st.customStatus, level:myLevel, exp:_myExpCells(), ...focusLevelMod.myStarOut(), awaySz:myAwaySz, lic:_myLicenseFlag(), awayImg:myAwayImg, ridingOn:_myRidingOn(), seatedOn:_mySeatedOn(), bench:_myBench(), mobile:focusLevelMod._mobileRoomLabel(), danceStyle:_myDanceStyle(), tab:chatUiMod._chatTabOut(), flyCool:_myFlyCool(), noise:myNoise}; }
  /* 올라타기/하차 직후 즉시 반영 — 상태 틱을 기다리면 상대 화면에 몇 초 늦게 나타난다. */
  function broadcastRide(){ try{ if(provider && provider.update) provider.update(_basePayload()); }catch(_){} }
  function setState(s){ if(s===myState)return; myState=s; if(provider&&provider.update)provider.update(_basePayload()); }
  function setUserStatus(s){
    if(s===myUserStatus){
      /* 🩹 #1 — 부팅 때 «자동» 으로 되살린 자리비움을 사람이 칩에서 다시 고르면 그때부터 «수동» 이다.
         값이 같아 아래로 안 내려가므로 여기서 따로 바꿔 준다(안 하면 마우스만 움직여도 풀린다). */
      if(s === 'away' && _autoAwayApplied){ _clearAutoAwayMarks(); _saveAwayKind('manual'); }
      return;
    }
    myUserStatus=s; _clearAutoAwayMarks();
    /* 🩹 #1 — 여기는 «사람이 고른» 경로다. 자동 전환은 이 뒤에 'auto' 로 덮어쓴다(_autoAwayCheck). */
    _saveAwayKind(s === 'away' ? 'manual' : null);
    if(provider&&provider.update)provider.update(_basePayload());
  }
  /* 🌟 회차에서는 해금 레벨(n)이 999 에 머문다 — 이번 바퀴 레벨·회차·색도 같이 보고 바뀌었을 때만 보낸다(개정 70).
     ★ 매 프레임 불린다(좌석 루프) — 값 비교만 하고 쓰기는 바뀔 때 한 번. */
  let _lvKey = '';
  function setLevel(n){ const so=focusLevelMod.myStarOut(), k=n+'|'+so.cyc+'|'+so.clv+'|'+so.starC; if(k===_lvKey)return; _lvKey=k; myLevel=n; if(provider&&provider.update)provider.update(_basePayload()); }
  /* 🏷️ 닉네임 변경을 방에 즉시 반영.
     [제보] 마이홈에서 닉네임을 바꿔도 이름표에 바로 안 나온다.
     [원인] myName 은 start() 에서 **한 번만** 잡혔다. 방에 들어간 뒤 이름을 바꾸면 다시 들어가기
       전까지 친구 화면에는 예전 이름이 그대로 남았다(setState·setLevel 은 있는데 이름만 없었다).
     ⚠️ 내 화면의 내 이름표는 매 프레임 getDisplayName() 을 직접 읽으므로 원래 즉시 바뀐다.
       여기서 고치는 것은 '남에게 보이는 내 이름'이다. */
  function setName(n){
    const v = n || '나';
    if(v === myName) return;
    myName = v;
    // ⚠️ _basePayload 에는 name 이 없다(입장 뒤로는 안 바뀌는 값이라 매 틱 실어보내지 않는다).
    //   여기서만 얹어 보낸다 — provider.update 는 델타 병합이라 이 한 항목만 나간다.
    if(provider && provider.update) provider.update(Object.assign(_basePayload(), { name: myName }));
  }
  // ✨ 커스텀 상태 문구 등록/변경 — 지금 custom 상태를 쓰고 있으면 친구 화면도 즉시 갱신됨
  function setCustomStatus(conf){
    myCustomStatus = (conf && conf.text) ? {emo: conf.emo||'', text: conf.text} : null;
    if(provider&&provider.update) provider.update(_basePayload());
  }
  // 내가 남의 캐릭터(friend seat)를 쓰다듬거나 흔들었을 때 그 사람에게 알림
  function poke(targetFriendId, type){ if(provider&&provider.poke) provider.poke(targetFriendId, type); }
  /* 🪄 내 노드에 poke 를 쓴다 — 내가 내 캐릭터에 한 일(자기 때리기)을 방 전체가 보게.
     ★ app.js 는 자기 memberId 를 모른다(방 세션마다 새로 뽑히고 페이로드에도 안 실린다).
       그래서 대상 id 를 받지 않고, 자기 자신을 아는 provider 쪽이 대신 채운다. */
  function pokeSelf(type){ if(provider&&provider.pokeSelf) provider.pokeSelf(type); }
  // 내 캐릭터 정의(크기·꾸미기 파츠 등)가 방에 들어간 뒤에 바뀌었을 때 다시 전송 — 안 그러면 상대는 join 시점 모습 그대로 봄.
  function updateDef(newDef){ myDef=newDef;
    // 🏊 새 캐릭터의 얼굴 URL을 준비한 뒤 전송 — 준비 실패해도 dataURL이 함께 가므로 상대 화면은 항상 정상
    roomSyncMod.ensureRoomFaceUrls(newDef).catch(()=>{}).then(()=>{ if(provider&&provider.update)provider.update(Object.assign(_basePayload(), {def:newDef})); });
  }
  /* 💬 채팅 — 마지막 메시지+타임스탬프만 내 항목에 실어 보냄(대화 기록 저장은 안 함, ts로 "새 메시지" 판별).
     🌊 fly / flyColor — 「날리기」. 체크하고 보낸 줄은 말풍선 대신 화면을 가로질러 흐른다.
       ★ 서버 규칙(firebase-database-rules.json 144)은 `chat.text` 만 검사하고 **다른 자식을 막지 않는다** —
         그래서 이 두 칸은 규칙을 안 고쳐도 통과한다. 고치는 편이 낫긴 하다(README 의 규칙 한 줄 참고).
       ★ fly 가 거짓이면 **칸 자체를 안 싣는다.** 항상 실으면 안 쓰는 사람의 모든 메시지에
         `fly:false` 가 붙어 방 payload 가 그만큼 커진다(얼굴 PNG 를 걷어낸 것과 같은 이유).
       ⚠️ flyColor 는 «보낸 사람이 고른 값»일 뿐 권한이 아니다. Lv.200 판정은 **받는 쪽**에서
         friends[id].level 로 다시 한다 — 여기서만 막으면 값을 조작해 색을 쓸 수 있다. */
  /* 💬 tab — 채팅 탭. #일반이 아니면 `chat` 이 아니라 새 칸 `chatTab` 으로 보낸다.
     ★ 구버전은 chatTab 을 몰라 아예 안 띄운다 — 영화 탭의 말풍선 · 날리기가 #일반 사람 · 구버전에게 새지 않는 이유가 이것이다.
       `chat` 칸으로 보내면 구버전이 탭을 모른 채 방 전원에게 띄운다(sim-chat-tabs ①). */
  function sendChat(text, fly, flyColor, flySize, tab){
    if(!(provider && provider.update)) return;
    const chat = { text:String(text).slice(0,140), ts:Date.now() };
    if(tab && tab !== 'general') chat.tab = String(tab).slice(0,16);
    if(fly){
      chat.fly = true;
      if(flyColor) chat.flyColor = String(flyColor).slice(0,16);
      // 대(l)는 기본값이라 안 싣는다 — 받는 쪽이 «없으면 대» 로 읽는다.
      if(flySize && flySize !== 'l') chat.flySize = String(flySize).slice(0,2);
    }
    if(chat.tab){ provider.update(Object.assign(_basePayload(), { chatTab: chat })); return; }
    provider.update(Object.assign(_basePayload(), { chat }));
  }
  function stop(){
    const p = (provider && provider.leave) ? Promise.resolve(provider.leave()) : Promise.resolve();
    provider=null; room=null; friends={}; if(onChange)onChange({});
    return p;   // 호출부에서 await하면 서버에 삭제가 반영된 뒤에 재접속하도록 할 수 있음
  }
  return { start, setState, setUserStatus, setCustomStatus, setFocusShow, setAwayImg, setAwaySz, setNoise, setLevel, setName, poke, pokeSelf, updateDef, sendChat, stop, broadcastRide,
           /* 🪑 상태 변화를 지금 당장 방에 실어 보낸다(같은 _basePayload). 쉬는 시간처럼
              "다음 상태 틱까지 기다리면 늦는" 값이 생겼을 때 부른다. */
           broadcastNow: broadcastRide,
           active:()=>!!provider, roomCode:()=>room, friendsObj:()=>friends,
           myDef:()=>myDef,   // 방에 마지막으로 보낸(입장 · updateDef) 내 def — launchApp 이 바뀌었는지 본다
           // 🛰 지금 방이 방 서버로 붙어 있으면 그 provider(방장 설정 chatOff 를 서버로 보낼 때) · 아니면 null
           serverProvider:()=>(provider && provider.kind === 'server') ? provider : null };
})();

/* ═══ 📦 방으로 보내는 def — 직렬화 · 얼굴 URL · 델타 전송 · Firebase provider ═══ */
/* (앱 FSD 35번) 이 자리의 본문도 room-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🛰 방 서버 provider (관리자 스위치 · 기본 꺼짐) ═══════════════════════════════
   방 통신을 Firebase 대신 웹소켓 방 서버로. 실제 구현은 parts/room-server-net.js 이고 여기는 화면 쪽 연결만 한다.
   누가 · 어느 서버로 가는지는 parts/room-server-gate.js(원격 설정 roomServer · roomDir). 꺼져 있으면(기본) 전원 Firebase.
   ★ 서버 방에서는 정원 · 같은 계정 중복 · 호스트 승계 · 해산 · 120초 생존 판정을 서버가 한다.
     그래서 firebase-init joinRoom 의 그 판정들(자기 퇴장 · _maybeSucceedHost · 💓 roomAlive 하트비트)은 이 길에서 아예 돌지 않는다.
   ★ 채팅 기록(chatLog) · 스티커사진(_photo) · 친구 목록의 접속 정보는 1단계에서는 Firebase 그대로다. */
/* 본문은 room-entry.js 로 옮겼다(앱 FSD 33번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ROOM_ENTRY_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const roomEntryMod = (typeof TwRoomEntry === 'undefined') ? ROOM_ENTRY_MOD_OFF : TwRoomEntry.createRoomEntry({
  EXP_CELLS: ()=>expBarMod.EXP_CELLS,
  FLOATER_BURST: floatersMod.FLOATER_BURST,
  Presence: Presence,
  _chatNotifyIncoming: (...a)=>chatPrefsMod._chatNotifyIncoming(...a),
  _clearHiddenSeats: (...a)=>hiddenSeatsMod._clearHiddenSeats(...a),
  _onDeviceSessionLost: (...a)=>deviceLostMod._onDeviceSessionLost(...a),
  _pokeFresh: (...a)=>roomSyncMod._pokeFresh(...a),
  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  awayPicMod: ()=>awayPicMod,
  chatUiMod: chatUiMod,
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  deserializeDefFromNetwork: (...a)=>roomSyncMod.deserializeDefFromNetwork(...a),
  fitModel: (...a)=>fitModel(...a),
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  layoutSeats: (...a)=>layoutSeats(...a),
  licenseGateMod: licenseGateMod,
  maxPeople: (...a)=>maxPeople(...a),
  myExpCells: (...a)=>expBarMod.myExpCells(...a),
  officeMode: ()=>officeMode,
  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),
  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),
  renderSeatTabs: (...a)=>renderSeatTabs(...a),
  rideBenchMod: rideBenchMod,
  scene: scene,
  seats: seats,
  serializeDefForNetwork: (...a)=>roomSyncMod.serializeDefForNetwork(...a),
  settingsMod: settingsMod,
  showChatBubble: (...a)=>showChatBubble(...a),
  slots: slots,
  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  triggerPet: (...a)=>triggerPet(...a),
  uiIconEl: (...a)=>statusChipMod.uiIconEl(...a),
  updateMyStatusChipPosition: (...a)=>statusChipMod.updateMyStatusChipPosition(...a),
});
const USER_NAME_KEY = 'tw.userName';

function getUserName(){
  try{ return localStorage.getItem(USER_NAME_KEY) || '나'; }catch(e){ return '나'; }
}

function setUserName(name){
  try{ localStorage.setItem(USER_NAME_KEY, name || '나'); }catch(e){}
}

// 머리 위 이름표 등 "다른 사람에게 보이는" 표시용 — 이름을 저장한 적 없으면 (이름 없음)으로 표시
function getDisplayName(){ const n=getUserName(); return (n==='나' || !n.trim()) ? '(이름 없음)' : n; }

/* ═══ 🏷️ 닉네임 저장 — **모달이 아니라 제자리 편집**이 부르는 한 벌 ══════════
   [경위] 예전엔 #userNameOverlay 모달이 이 일을 했다. 그 모달은 런처 시절 창이라(z-index:80)
     CSS z-index 가 창 층(83~92)보다 아래였는데, #myHomeOverlay 는 _WIN_Z_LAYERS 에 실려
     있어서 마이홈 안을 **누르는 순간** bringWinToFront 가 인라인 z 를 83 이상으로 올린다.
     즉 「수정」을 누르는 그 클릭 자체가 마이홈을 모달 위로 올려, 모달은 열리는데(.on)
     뒤에 깔려 안 보였다 — "눌러도 창이 안 나온다"는 제보가 이것이다.
   [고친 방향] 창을 위로 올리는 대신 **창을 없앴다.** 게시글 제목과 같이 닉네임 자리가
     그대로 입력칸이 된다(_mhBeginNameEdit). 뜨는 것이 없으니 층 싸움도 없다.
   ⚠️ 저장이 건드리는 곳이 다섯이다 — 로컬 저장 · 서버 프로필 · 방의 이름표 · 마이홈 표시 ·
     알림. 편집 진입로가 늘어나도 저장은 **반드시 이 함수 하나만** 부를 것. */
/* 본문은 program-settings.js 로 옮겼다(앱 FSD 40번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const PROG_SETTINGS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const progSettingsMod = (typeof TwProgramSettings === 'undefined') ? PROG_SETTINGS_MOD_OFF : TwProgramSettings.createProgramSettings({
  FIGURE_MODE_KEY: ()=>FIGURE_MODE_KEY,
  OFFICE_MODE_KEY: ()=>OFFICE_MODE_KEY,
  Presence: Presence,
  _applyChatSfxUI: (...a)=>chatPrefsMod._applyChatSfxUI(...a),
  _focusShowPush: (...a)=>focusShareMod._focusShowPush(...a),
  _lsSet: (...a)=>_lsSet(...a),
  chatUiMod: chatUiMod,
  figureMode: ()=>figureMode,
  focusGateSleep: ()=>focusGateSleep,
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getUserName: (...a)=>getUserName(...a),
  isAdmin: ()=>isAdmin,
  officeMode: ()=>officeMode,
  purikuraUi: purikuraUi,
  refreshCharScaleForCurrentDisplay: (...a)=>refreshCharScaleForCurrentDisplay(...a),
  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),
  refreshOfficeChipUI: (...a)=>refreshOfficeChipUI(...a),
  refreshThemeUI: (...a)=>themeUiMod.refreshThemeUI(...a),
  setUserName: (...a)=>setUserName(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  setFigureMode: (v)=>{ figureMode = v; },
  setFocusGateSleep: (v)=>{ focusGateSleep = v; },
  setOfficeMode: (v)=>{ officeMode = v; },
});

/* ═══════════════════ 🔑 구글 로그인 (계정) ═══════════════════
   [무엇을 만든 것인가] "다른 컴퓨터에서 구글로 로그인하면 내 계정 그대로" 한 줄.
     지금까지 그 일은 [계정 이전]→유저 코드 22자리 받아적기→[계정 연동] 세 단계였고,
     비밀번호를 잊으면 복구할 방법이 없었다. 구글 로그인에는 **비밀번호가 아예 없다.**

   [기존 것을 지우지 않은 이유] 계정 이전/연동은 그대로 둔다.
     · 이미 그 방식으로 쓰는 사람이 있고, 구글 계정이 없는 기기의 이사 수단이다.
     · 복원 로직은 아래에서 보듯 **같은 함수**를 쓴다(_applyTransferSnapshot).
       복원 규칙이 두 벌이 되면 한쪽만 고쳐지는 사고가 난다.
     ⚠️ 다만 `users/{uid}/transferHash` 가 지금 **누구나 읽을 수 있다.** 소금도 반복도 없는
       단일 SHA-256 이라 짧은 비밀번호는 그 해시만으로 풀린다. 이건 로그인과 별개로
       규칙을 잠글 때 반드시 함께 손봐야 하는 자리다.

   [무엇이 옮겨오는가 — '전부'의 실제 내용]
     로그인은 localStorage 의 유저 코드를 그 계정 것으로 갈아끼운다. 그 한 번으로
       · 마이홈·친구·인박스·방명록 → users/{uid} 아래라 자동으로 따라옴
       · 집중 누적초(레벨)        → syncFocusTotalToServer 가 max 로 맞춤
       · 플레이리스트·가챠 보유분 → _restoreOwnedDataAfterTransfer 가 서버 사본에서 당겨옴
       · 라이선스·이름·친추코드   → 계정 스냅샷(accountSnap — 개정 55)에서 복원
     ⚠️ **만든 캐릭터는 안 따라온다.** 캐릭터는 로컬 파일이고 복제 코드가 따로 있다.
       로그인했는데 캐릭터가 없다는 제보가 오면 여기다.

   [창은 여기서 열지 않는다] file:// + `frame-src 'none'` 이라 팝업·리다이렉트가 둘 다 막힌다.
     창은 main.js 가 열고(companion.signInWithGoogle), 여기는 ID 토큰만 받아 넘긴다.

   [지금 이것은 자물쇠가 아니다] DB 규칙에 아직 `auth` 조건이 없다(규칙 파일이 이 폴더에 없어
     건드리지 못했다). 규칙에 `root.child('userAuth/'+$uid).val() === auth.uid` 를 넣는 순간부터
     자물쇠가 된다. 그 전까지 "로그인했으니 안전하다"고 말하면 안 된다.
──────────────────────────────────────────────────────────────────── */
/* 본문은 account.js 로 옮겼다(앱 FSD 23번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ACCOUNT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const accountMod = (typeof TwAccount === 'undefined') ? ACCOUNT_MOD_OFF : TwAccount.createAccount({
  BELL_SEEN_KEY: BELL_SEEN_KEY,
  CHAL_KEY: ()=>CHAL_KEY,
  CUR_SLOT_KEY: CUR_SLOT_KEY,
  CUSTOM_STATUS_KEY: CUSTOM_STATUS_KEY,
  EXTRA_SEAT_KEY: settingsMod.EXTRA_SEAT_KEY,
  FOCUS_TODAY_DATE_KEY: ()=>focusTotalMod.FOCUS_TODAY_DATE_KEY,
  FOCUS_TODAY_SEC_KEY: ()=>focusTotalMod.FOCUS_TODAY_SEC_KEY,
  FOCUS_TOTAL_KEY: ()=>focusTotalMod.FOCUS_TOTAL_KEY,
  GACHA_BONUS_KEY: ()=>GACHA_BONUS_KEY,
  GACHA_OWNED_KEY: ()=>GACHA_OWNED_KEY,
  GACHA_TS_KEY: ()=>GACHA_TS_KEY,
  HAD_USER_ID_AT_BOOT: HAD_USER_ID_AT_BOOT,
  INBOX_BC_READ_KEY: INBOX_BC_READ_KEY,
  LICENSE_REQ_ID_KEY: ()=>licReqMod.LICENSE_REQ_ID_KEY,
  LS_KEY: ()=>slotSaveMod.LS_KEY,
  MY_AD_BANNER_KEY: settingsMod.MY_AD_BANNER_KEY,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  MY_FRIEND_CODE_PREV_KEY: MY_FRIEND_CODE_PREV_KEY,
  MY_USER_ID_KEY: MY_USER_ID_KEY,
  USER_NAME_KEY: USER_NAME_KEY,
  _focusTodaySec: ()=>focusTotalMod._focusTodaySec(),
  _focusTotalSec: ()=>_focusTotalSec,
  _rememberOldFriendCode: (...a)=>_rememberOldFriendCode(...a),
  _setMyUserId: (...a)=>_setMyUserId(...a),
  charsMod: ()=>charsMod,
  extraSeatSlots: ()=>settingsMod.extraSeatSlots(),
  focusLevelMod: ()=>focusLevelMod,
  gachaMod: ()=>gachaMod,
  getMyUserId: (...a)=>getMyUserId(...a),
  licenseGateMod: licenseGateMod,
  myInfoMod: ()=>myInfoMod,
  plMod: plMod,
  slotSyncMod: ()=>slotSyncMod,
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  weeklyChal: ()=>weeklyChal,
  setFocusTodaySec: (v)=>{ focusTotalMod.setFocusTodaySec(v); },
  setFocusTotalSec: (v)=>{ _focusTotalSec = v; },
  setExtraSeatSlots: (v)=>{ settingsMod.setExtraSeatSlots(v); },
});
/* ═══ 🧹 [2026-09-16 제보 4] 신원을 놓을 때 이 기기에서 지우는 것 — **한 벌뿐이다** ═══════
   [경위] 로그아웃이 지우던 것은 신원 6개뿐이었다(유저 코드·도장·친추코드·이메일·uid + 마크 정렬).
     **소지품은 전부 남았다.** 같은 노트북에서 A 가 로그아웃하고 B 가 로그인하자
       ① A 의 라이선스 키(tw.licenseKey)가 남아 B 에게 프리미엄 창이 떴고
       ③ A 의 누적 시간이 남아 B 의 스냅샷과 max 로 합쳐져 서버 B 레벨이 1 → 51 로 뛰었고
       ④ A 가 뽑은 가챠가 B 계정 서버로 올라갔고(연동 pull 이 «저쪽이 비면 로컬을 올린다»)
       ② A 의 캐릭터(슬롯)가 B 의 프로필 얼굴로 올라갔다.
     그리고 이번 커밋의 슬롯 동기화가 «로컬이 최신이면 push» 라 슬롯까지 같은 길로 샌다.
   [원칙] **신원을 놓는 순간 이 기기는 빈 기기가 된다.** 계정에 딸린 것은 전부 지우고, 다시
     로그인하면 서버에서 받아온다. 로컬에만 있고 서버에 없는 것은 없어야 한다 — 그래서
     지우기 **전에** 올리고(_acctFlushToServer), 올라갔는지 **확인한 뒤**(_acctPreflight) 지운다.
   [무엇을 남기나] 기기 설정(테마·창 위치·볼륨·반복·폰트·투명도)과 카탈로그(savedParts·savedDesks)
     — 계정이 아니라 **이 컴퓨터**의 것이다. 프리셋 캐릭터 만들기 데이터(tw.deskPresets)도 남긴다.
   ⚠️ 목록을 늘리거나 줄일 때는 «다시 로그인하면 돌아오는가» 를 항목마다 확인할 것.
     돌아오는 길이 없는 항목을 여기 넣으면 로그아웃이 곧 삭제가 된다. 각 줄 오른쪽에 그 길을 적어 둔다.
   ★ 로그아웃(_loginDoLogout)과 연동 해제(acctUnlinkYes)가 **둘 다 이 함수 하나**를 부른다.
     (개정 16: 연동 해제는 걷었다 — 이제 부르는 곳은 로그아웃 하나다. sim-account-switch 1절이 센다.)
     예전에는 «같은 목록» 이라는 주석으로만 묶여 있었고, 그래서 누락이 두 곳에서 똑같이 났다.
   ★ sim-account-switch.js 가 이 목록을 읽어 «로그아웃 뒤 남은 키» 를 잰다. */
/* (앱 FSD 23번) 이 자리의 본문도 account.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🪪 [내 정보] — 런처 화면 전환 (CHECKS 개정 48 · 사용자 결정 · 회원가입 설계 §7 B2 · C4 · D · G) ═══════════════
   런처 [내 정보](#lcLoad)를 누르면 **런처 카드 안의 페이지(#lcMyInfo)가 제목줄 아래를 덮는다** — 따로 창도 겹창도 아니다. ◀ 로 돌아간다.
     · 작은 머리 — 마이홈 프로필 사진(44px) · 닉네임 + 레벨 배지(친구 목록과 같은 _plFillLv) + [수정](commitUserName 하나) · 친구 코드 + [복사].
     · [보관함] — **보관함에 넣은 캐릭터만**(슬롯 표 밖의 산 항목 · 런처 톱니 [보관함 이동]으로 넣은 것). 슬롯 캐릭터는 여기 없다.
         줄마다 섬네일 · «마지막 수정 M/D» · [슬롯에 올리기](_charsBoxToDesk). 개수는 «보관함 (n/20)» — «마리» 라는 말은 쓰지 않는다.
         보관함이 아직 안 열렸으면(스위치 · 첫 채택 전) 한 줄로 알린다. 맨 아래 [코드로 캐릭터 불러오기](#codeOverlay).
     · [계정] — C4 그대로(refreshAccountTab · _acctMethodsRender · 로그아웃 3단계 · _slotsRenderAcctSync).
     · [휴지통] (개정 49 · 시안 E) — 탭 순서 보관함 · 휴지통 · 계정(개정 69 에서 사용자가 다시 정함 · 옛 순서 보관함 · 계정 · 휴지통). 보관함이 열린 PC 에서만 보인다. «휴지통 N» · 붉은 글자.
         줄마다 섬네일 · 이름표 «옮김»(3일) / «연동 교체»(10일) · «M/D 사라져요» · [복원](폭 고정 · 무조건 보관함으로 · 20 이면 붉은 상자).
         보관함 줄 끝의 붉은 아이콘 = [휴지통 이동](그 줄 안에서 되묻기). 어떤 줄을 보일지는 _charsTrashView(순수) 몫.
     · [보관함] 가득 참 (개정 51 · 시안 D2) — 보관함 20 이상이면 노란 경고 · 체크칸 · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에(_charsBoxTrashMany).
   ⚠️ 섬네일·사진 src 는 data:image/ · http(s) 만 받는다 — 속성 보간 없이 DOM 으로만 넣는다(audit 검사 19).
   ⚠️ 이 페이지는 런처의 일부다 — 팝업 목록(OPEN_MODAL_SEL · 바깥 클릭 닫기 등)에 넣지 않는다. */
/* 본문은 my-info.js 로 옮겼다(앱 FSD 17번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const MY_INFO_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const myInfoMod = (typeof TwMyInfo === 'undefined') ? MY_INFO_MOD_OFF : TwMyInfo.createMyInfo({
  CHARS_BOX_MAX: ()=>charsMod.CHARS_BOX_MAX,
  EXP_CELLS: ()=>expBarMod.EXP_CELLS,
  EXP_SEC_PER_CELL: ()=>expBarMod.EXP_SEC_PER_CELL,
  EXP_SEC_PER_LEVEL: ()=>expBarMod.EXP_SEC_PER_LEVEL,
  FOCUS_CYCLE_SEC: ()=>focusTotalMod.FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS: ()=>focusTotalMod.FOCUS_LEVEL_CAP_HOURS,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  MY_USER_ID_KEY: MY_USER_ID_KEY,
  STAR_PALETTE: ()=>focusLevelMod.STAR_PALETTE,
  USER_NAME_MAX: progSettingsMod.USER_NAME_MAX,
  _acctDetached: ()=>accountMod._acctDetached(),
  _charsActive: (...a)=>charsMod._charsActive(...a),
  _charsBoxGet: (...a)=>charsMod._charsBoxGet(...a),
  _charsBoxOnlyCount: (...a)=>charsMod._charsBoxOnlyCount(...a),
  _charsBoxToDesk: (...a)=>charsMod._charsBoxToDesk(...a),
  _charsBoxTrash: (...a)=>charsMod._charsBoxTrash(...a),
  _charsBoxTrashMany: (...a)=>charsMod._charsBoxTrashMany(...a),
  _charsCachedUid: (...a)=>charsMod._charsCachedUid(...a),
  _charsDeleteWords: (...a)=>charsMod._charsDeleteWords(...a),
  _charsDeskGet: (...a)=>charsMod._charsDeskGet(...a),
  _charsIsTomb: (...a)=>charsMod._charsIsTomb(...a),
  _charsMoveMsg: (...a)=>charsMod._charsMoveMsg(...a),
  _charsRestore: (...a)=>charsMod._charsRestore(...a),
  _charsSync: (...a)=>charsMod._charsSync(...a),
  _charsTrashView: (...a)=>charsMod._charsTrashView(...a),
  _focusTotalSec: ()=>_focusTotalSec,
  _licenseSnapForPush: (...a)=>licenseGateMod._licenseSnapForPush(...a),
  _loginDoGoogle: (...a)=>accountMod._loginDoGoogle(...a),
  _loginDoLogout: (...a)=>accountMod._loginDoLogout(...a),
  _myHomeData: ()=>mhVisitMod._myHomeData(),
  _pushLevelIfChanged: (...a)=>focusLevelMod._pushLevelIfChanged(...a),
  _slotsNow: (...a)=>slotSyncMod._slotsNow(...a),
  closeGearMenu: (...a)=>closeGearMenu(...a),
  commitUserName: (...a)=>progSettingsMod.commitUserName(...a),
  curSlot: ()=>curSlot,
  focusCycleOf: (...a)=>focusLevelMod.focusCycleOf(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  getMyLoginEmail: (...a)=>accountMod.getMyLoginEmail(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getStarColor: (...a)=>focusLevelMod.getStarColor(...a),
  getUserName: (...a)=>getUserName(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  myFocusShow: (...a)=>focusLevelMod.myFocusShow(...a),
  openCodeModal: (...a)=>charCodeMod.openCodeModal(...a),
  plMod: plMod,
  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  setStarColor: (...a)=>focusLevelMod.setStarColor(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
});
/* ═══ 🏆 [내 정보] 전체 랭킹 1~100위 (시안 v2 B안 + 후광 ② 확정 · 2026-09-23 · CHECKS 개정 73 · handoff-ranking.md) ═══
   ★ 기준은 누적 집중 시간 하나(회차 포함). 표시 레벨(myFocusShow)·해금 레벨(getFocusLevel)로 매기지 않는다 —
     그렇게 하면 2회차 Lv.5 가 1회차 Lv.900 아래로 간다.
   ★ 동점은 먼저 도달한 사람이 위(ts 오름). 서버는 같은 sec 를 키 순으로 주므로 받은 100줄을 여기서 다시 정렬한다.
     100위 경계의 동점은 서버가 자른 대로다(허용).
   ★ 100위 밖이면 자리를 비운다 — «100위 밖» 같은 글자도 쓰지 않는다(사용자 결정).
   ★ 읽기는 [내 정보]를 열 때 한 번 · 60초 캐시. 실패하면 조용히 비운다. 내 기록은 10분 동기화에 실려 몇 분 늦을 수 있다. */
/* (앱 FSD 17번) 이 자리의 본문도 my-info.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 📤 계정 이전 / 연동 / 연동 해제 — [회원가입 설계 개정 15 · 16] 걷었다 ═══════════════════
   비밀번호 로그인(H · K)이 기기 이동을 대신하고, 로그인 안 한 사람은 I 에서 반드시 가입한다.
   ★ 옛 이전 비밀번호(users/{uid}/transferHash — 공개 읽기 · 소금 없는 SHA-256 · 4자)는 로그인 비밀번호로 옮기지 않는다.
     규칙이 이제 지우기만 받고, 남은 값은 콘솔 일괄 삭제로 정리한다(핸드오프 09-22b).
   ⚠️ 계정 스냅샷은 accountSnap/{uid}(주인만 · CHECKS 개정 55)로 옮겼다 — 옛 users/{uid}/transferData 는 규칙이 «지우기만» 받고
     setAccountSnapshot · fetchAccountSnapshot 이 옮기며 지운다. 로그인 복원(_applyTransferSnapshot)은 그 두 통로로만 받는다.
   ★ _sha256Hex 는 관리자 암호 쪽 한 벌만 남았다(같은 이름이 두 벌이던 것 — 뒤의 것이 이기고 있었다). */

/* (앱 FSD 23번) 이 자리의 본문도 account.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔢 방 개수 · 방 만들기 · 랜덤 참여 · 갈아타기 ═══ */
/* (앱 FSD 33번) 이 자리의 본문도 room-entry.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🚪 방 입장 · 나가기 · 승계 · 해산 · 코드 입력칸 ═══ */
/* (앱 FSD 33번) 이 자리의 본문도 room-entry.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔑 라이선스 등록 UI ═══ */
/* 본문은 license-ui.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LICENSE_UI_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const licenseUiMod = (typeof TwLicenseUi === 'undefined') ? LICENSE_UI_MOD_OFF : TwLicenseUi.createLicenseUi({
  isPremium: ()=>isPremium,
  licReqMod: ()=>licReqMod,
});
/* ═══ 🪟 런처 타이틀바 · 팝업 흐림 ═══ */
/* 본문은 launcher-chrome.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LAUNCHER_CHROME_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const launcherChromeMod = (typeof TwLauncherChrome === 'undefined') ? LAUNCHER_CHROME_MOD_OFF : TwLauncherChrome.createLauncherChrome({
  myInfoMod: myInfoMod,
});

/* ═══ 📢 런처 광고 배너 · ⚙️ 게임 설정 ═══ */
/* 본문은 ad-banner.js 로 옮겼다(앱 FSD 43번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const AD_BANNER_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adBannerMod = (typeof TwAdBanner === 'undefined') ? AD_BANNER_MOD_OFF : TwAdBanner.createAdBanner({
  settingsMod: settingsMod,
});
/* 관리자 쪽(🛑 전체 방 종료 · 🧹 유령 방 청소 · ⚙️ 게임 설정 편집 · 📢 광고 배너 편집)은 admin/admin-launcher.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   isAdmin · _gameCfg 는 다시 대입되는 let 이라 읽는 함수로 넘긴다. 사용자 쪽(배너 그리기 · 구독)은 바로 위 ad-banner.js(앱 FSD 43번).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_LAUNCHER_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminLauncher = (typeof TwAdminLauncher === 'undefined') ? ADMIN_LAUNCHER_OFF : TwAdminLauncher.createAdminLauncher({
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  refreshAdBanner: (...a)=>adBannerMod.refreshAdBanner(...a),
  adBannerKey: adBannerMod.AD_BANNER_KEY,
  isAdmin: ()=>isAdmin,
  gameCfg: ()=>adBannerMod._gameCfg(),
});
/* (앱 FSD 43번) 이 자리의 본문도 ad-banner.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔑 라이선스 키 등록 · 해제 버튼 ═══ */
/* 본문은 license-key.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LICENSE_KEY_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const licenseKeyMod = (typeof TwLicenseKey === 'undefined') ? LICENSE_KEY_MOD_OFF : TwLicenseKey.createLicenseKey({
  licenseGateMod: licenseGateMod,
  progSettingsMod: progSettingsMod,
  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),
  toast: (...a)=>toast(...a),
});

/* ═══ 🪟 팝업 바깥 클릭으로 닫기 ═══ */
/* 본문은 outside-close.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const OUTSIDE_CLOSE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const outsideCloseMod = (typeof TwOutsideClose === 'undefined') ? OUTSIDE_CLOSE_MOD_OFF : TwOutsideClose.createOutsideClose({
});

/* ═══ 📨 라이선스 요청 · 관리자 비밀번호 모달 ═══ */
/* 본문은 license-request.js 로 옮겼다(앱 FSD 43번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const LIC_REQ_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const licReqMod = (typeof TwLicenseRequest === 'undefined') ? LIC_REQ_MOD_OFF : TwLicenseRequest.createLicenseRequest({
  _saveFailMsg: (...a)=>_saveFailMsg(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  licenseGateMod: licenseGateMod,
  progSettingsMod: progSettingsMod,
  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),
  toast: (...a)=>toast(...a),
});

/* ═══ 🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자) ═══ */
/* 관리자 몫(라이선스 키 발급 · 목록 · 요청, 📣 확성기 공지 · 📰 업데이트 공지 편집)은 admin/admin-license.js · admin/admin-notice.js 로 옮겼다.
   사용자 쪽(앱을 켤 때 업데이트 공지 팝업)은 아래에 그대로 둔다. 라이선스 요청 · 발급 버튼(옛 «관리자 카테고리 관리» 뒤쪽)도 같은 모듈이라
   거는 때가 그 구역보다 조금 앞당겨졌다 — 모두 버튼 클릭 handler 라 순서와 상관없다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_LICENSE_OFF = {};   // 모듈이 없으면 빈 껍데기
const adminLicense = (typeof TwAdminLicense === 'undefined') ? ADMIN_LICENSE_OFF : TwAdminLicense.createAdminLicense({
  toast: (...a)=>toast(...a),
  chatEsc: (...a)=>_chatEsc(...a),
  genLicenseKey: (...a)=>licenseGateMod._genLicenseKey(...a),
  saveFailMsg: (...a)=>_saveFailMsg(...a),
});
const ADMIN_NOTICE_OFF = {};
const adminNotice = (typeof TwAdminNotice === 'undefined') ? ADMIN_NOTICE_OFF : TwAdminNotice.createAdminNotice({
  toast: (...a)=>toast(...a),
});


// 유저: 앱 시작 시 공지 확인 → 미표시 조건 아니면 팝업
async function _checkUpdateNoticeOnStartup(){
  if(!(window.firebaseAPI && firebaseAPI.getUpdateNotice)) return;
  try{
    const notice = await firebaseAPI.getUpdateNotice();
    if(!notice || !notice.ts) return;
    // "다시 보지 않기" 체크한 ts와 같으면 스킵
    const dismissedTs = parseInt(localStorage.getItem('tw.updateNoticeDismissedTs')||'0', 10);
    if(dismissedTs === notice.ts) return;
    // 팝업 표시
    const ov=document.getElementById('updateNoticeUserOverlay'); if(!ov) return;
    document.getElementById('updateNoticeViewTitle').textContent = notice.title || '업데이트 안내';
    { const _nb = document.getElementById('updateNoticeViewBody');
      _nb.innerHTML = inboxMod.linkifyText(notice.body || '');   // 본문 속 주소를 클릭 가능하게
      inboxMod.bindExtLinks(_nb); }
    document.getElementById('updateNoticeDontShow').checked = false;
    ov.style.display = 'flex';
    // 닫기 로직
    const close = ()=>{
      const dontShow = document.getElementById('updateNoticeDontShow').checked;
      if(dontShow){
        try{ localStorage.setItem('tw.updateNoticeDismissedTs', String(notice.ts)); }catch(_){}
      }
      ov.style.display = 'none';
    };
    document.getElementById('updateNoticeOkBtn').onclick = close;
    document.getElementById('updateNoticeCloseX').onclick = close;
  }catch(_){}
}
// firebase 준비되면 한 번 실행
if(window.firebaseAPI) _checkUpdateNoticeOnStartup();
else window.addEventListener('firebase-ready', ()=>_checkUpdateNoticeOnStartup(), { once:true });

// ===== Phase 3: 관리자 카테고리 관리 =====
/* 카테고리 관리 본문은 admin/admin-category.js, 뒤쪽의 라이선스 요청 · 발급 버튼 · 친구코드로 발급은 admin/admin-license.js 로 옮겼다.
   PART_GROUPS(뒤에서 선언하는 const) · PART_CATS · partCatOverrides(다시 대입되는 let)는 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_CATEGORY_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminCategory = (typeof TwAdminCategory === 'undefined') ? ADMIN_CATEGORY_OFF : TwAdminCategory.createAdminCategory({
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  partGroups: ()=>premiumMod.PART_GROUPS,
  partCats: ()=>premiumMod.PART_CATS(),
  partCatOverrides: ()=>premiumMod.partCatOverrides(),
});


/* ═══ 📄 [2026-10-02] 엑셀(xlsx·csv)로 라이선스 일괄 발급 — 시안 확정(입구 = 친구코드 발급 아래 · 빈 코드 = 키만 · 전에 발급한 코드 = 건너뜀) ═══ */
/* ═══ 🔒 시크릿룸 발급(관리자) ═══ */
/* 위 두 구역(📄 엑셀 일괄 발급 · 🔒 시크릿룸 발급)의 본문은 admin/admin-license-bulk.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에 모은다.
   만드는 줄을 여기(원래 자리)에 둬서 버튼을 거는 때가 예전과 같다. 밖에서 부르는 이름은 없다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADMIN_LICENSE_BULK_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — FOCUS_LOG_OFF 와 같은 방식
const adminLicenseBulk = (typeof TwAdminLicenseBulk === 'undefined') ? ADMIN_LICENSE_BULK_OFF : TwAdminLicenseBulk.createAdminLicenseBulk({
  escHtml: (...a)=>escHtml(...a),
  toast: (...a)=>toast(...a),
  genLicenseKey: (...a)=>licenseGateMod._genLicenseKey(...a),
  saveFailMsg: (...a)=>_saveFailMsg(...a),
  renderLicenseGenList: (...a)=>adminLicense.renderLicenseGenList(...a),
  downloadBlob: (...a)=>charCodeMod.downloadBlob(...a),
  srFmtDate: (...a)=>roomEntryMod._srFmtDate(...a),
});

/* ═══ 👥 책상에서 친구 추가 ═══ */
/* 본문은 add-friend.js 로 옮겼다(앱 FSD 46번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ADD_FRIEND_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const addFriendMod = (typeof TwAddFriend === 'undefined') ? ADD_FRIEND_MOD_OFF : TwAddFriend.createAddFriend({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  createSeat: (...a)=>createSeat(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  openCreator: (...a)=>openCreator(...a),
  renderSeatTabs: (...a)=>renderSeatTabs(...a),
  selectSeat: (...a)=>selectSeat(...a),
  skinColorFor: (...a)=>skinColorFor(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
});

/* ═══ 💾 슬롯 저장 · 복원(saveSlots · loadSlots) ═══ */
/* 본문은 slot-save.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const SLOT_SAVE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const slotSaveMod = (typeof TwSlotSave === 'undefined') ? SLOT_SAVE_MOD_OFF : TwSlotSave.createSlotSave({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  _blankFaceConfirmed: ()=>_blankFaceConfirmed,
  _blinkEverDrawn: _blinkEverDrawn,
  _faceEverDrawn: _faceEverDrawn,
  _isBlankDraw: (...a)=>_isBlankDraw(...a),
  charDef: (...a)=>charDef(...a),
  charsMod: ()=>charsMod,
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
  premiumMod: premiumMod,
  seats: seats,
  slotSyncMod: ()=>slotSyncMod,
  slots: slots,
  toast: (...a)=>toast(...a),
  wardrobeMod: wardrobeMod,
  setBlankFaceConfirmed: (v)=>{ _blankFaceConfirmed = v; },
});
function saveSlots(...a){ return slotSaveMod.saveSlots(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)

/* ═══ ☁️ 슬롯(캐릭터) 기기 간 동기화 — 2026-09-16 제보 6-b «캐릭터가 집 PC 에 없음» ═══════════
   [무엇이 없었나] 서버 users/{uid} 에는 gacha(보유 파츠)·playlist·profile·home… 만 있고 **슬롯
     노드가 없었다.** 슬롯은 localStorage 에만 살아서, 회사에서 뽑은 파츠는 집에 있어도 그걸로
     만든 캐릭터는 없었다. 고장이 아니라 기능 부재.
   [모양] users/{uid}/slots = { ts, v:1, s:{ "0":json, … } } — 칸마다 JSON 문자열(firebase-init 주석).
     ★ 그림·GLB 는 **한 바이트도 RTDB 에 안 실린다.** 얼굴·감은눈·동물 페인트는 방 입장과 같은
       Storage 파일(roomface_{key}_{hash}.png)의 URL 로, 커미션·커스텀 책상·커스텀 아이템 GLB 는
       slotglb_{key}.glb 의 URL 로 바꿔 실린다. 같은 그림은 같은 파일이라 재업로드가 없고, 방에
       한 번이라도 들어간 캐릭터는 얼굴이 이미 올라가 있어 **추가 업로드 0**.
     ★ thumb(런처 아이콘 3D 스냅샷)은 안 올린다. 받은 기기는 2D 합성 아이콘(makeCharThumbEl 의
       폴백)으로 보이고, 그 기기에서 한 번 저장하면 다시 찍힌다.
   [병합 — 결정됨 · 2026-09-16] 가챠와 같은 자리 나누기.
     · 평소: ts 최신 승 **통째 덮어쓰기**. 슬롯은 순서 있는 편집물이라 칸 단위 max 가 없다.
     · 연동(계정 이전·구글 로그인 — 둘 다 _restoreOwnedDataAfterTransfer 한 통로): 저쪽 계정 것을
       ts 안 보고 pull. 저쪽이 비어 있으면 내 것을 push(로컬에만 캐릭터가 있던 사람의 첫 업로드).
     · (A) 부팅: 서버가 비었고 로컬에 있으면 자동으로 한 번 올린다 — 기존 사용자가 아무것도 안
       해도 집 PC 가 받게. 서버가 비었을 때만이라 계정당 사실상 한 번이다.
   [비용]
     · 읽기: 부팅 1회 + 30분마다 1회, 그것도 **ts 한 값만**(loadSlotsTs). 본문은 ts 가 다를 때만.
     · 쓰기: 저장본이 실제로 바뀐 saveSlots 뒤 3초 묶음 1회(_slotsSchedulePush). 얼굴 업로드는
       내용 해시 캐시(tw.roomFaceUrls)를 지나 바뀐 그림만.
   [_imgBroken] push 는 **메모리 slots 가 아니라 localStorage 원본**을 읽는다. 부팅 때 이미지 복원에
     실패한 칸은 메모리에 빈 캔버스가 있고 saveSlots 도 그 칸을 건너뛰어 원본을 지키는데, 메모리를
     올리면 그 빈 캔버스가 서버에 굳는다(핸드오프 §5 주의). 원본을 읽으면 이 예외가 저절로 지켜진다.
   [시각] 가챠와 같이 서버 시계(_srvNow). **ms ts 에 |0 금지** — 32비트로 잘려 음수가 된다.
   [적용] 서버 것을 받아 적을 때(_slotsAdoptFromServer) 메모리 slots 도 같이 갈아 끼운다.
     localStorage 만 바꾸고 메모리를 두면 다음 saveSlots 가 옛 메모리로 원본을 덮고 그걸 더 새
     ts 로 올려 **다른 기기 편집을 지운다.** 책상 위 좌석은 옛 def 객체를 그대로 붙들고 있으므로
     재실행하면 바뀐다고 안내한다. 생성기가 열려 있으면 이번 판은 건너뛴다(편집 중인 칸을 뺏지 않는다). */
/* 본문은 slot-sync.js 로 옮겼다(앱 FSD 19번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const SLOT_SYNC_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const slotSyncMod = (typeof TwSlotSync === 'undefined') ? SLOT_SYNC_MOD_OFF : TwSlotSync.createSlotSync({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  LS_KEY: slotSaveMod.LS_KEY,
  _blinkEverDrawn: _blinkEverDrawn,
  _faceEverDrawn: _faceEverDrawn,
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _roomFaceCacheLoad: (...a)=>roomSyncMod._roomFaceCacheLoad(...a),
  _roomFaceCacheSave: (...a)=>roomSyncMod._roomFaceCacheSave(...a),
  _srvNow: (...a)=>roomSyncMod._srvNow(...a),
  _storageFaceUrlOne: (...a)=>roomSyncMod._storageFaceUrlOne(...a),
  _warnServerWriteDenied: (...a)=>_warnServerWriteDenied(...a),
  charsMod: ()=>charsMod,
  creatorOpen: ()=>creatorOpen,
  getMyUserId: (...a)=>getMyUserId(...a),
  loadSlots: (...a)=>slotSaveMod.loadSlots(...a),
  renderCharSlots: (...a)=>settingsMod.renderCharSlots(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  slotToObj: (...a)=>slotSaveMod.slotToObj(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
});

/* ═══ ☁️ [2026-09-20 · 3-7-2 시안 확정] 연동 UI — 띠(런처) · 기기 연동 구획(계정 탭) · ④ 충돌 대화상자 ═══
   [자리] A안 띠 = 캐릭터가 줄어든 것을 **보는 그 자리**(그림 위). B안 구획 = 띠를 놓쳐도 나중에 찾아갈 자리.
     둘 다 같은 기록(SLOTS_LOSS_KEY)을 읽는다. 대화상자 = ④ 가 세운 판을 사람이 고르는 자리.
   [기록] 셋 다 로컬 전용·다시 만들 수 있는 값이라 ACCOUNT_LOCAL_KEYS 에 넣었다(로그아웃 = 정리).
     · SLOTS_LOSS_KEY     { kind:'loss', from, to, at, bak } | { kind:'restored', to, at } | + dismissed:true
     · SLOTS_LASTSYNC_KEY { at, ok, why?, localCount, serverCount? }  — serverCount 는 알게 된 값을 이어 쓴다
     · SLOTS_PUSHFAIL_KEY { why, at }  — 올리기 성공에 지운다
   [문구] 시안(캔버스 «3-7-2 시안») 그대로. «되돌릴 수 있는 기한» 줄은 뺐다 — 백업은 연동으로 사라지지 않고
     되돌리기가 곧 맞바꾸기라 기한이 없다(restoreSlotsBackup 주석). */
/* (앱 FSD 19번) 이 자리의 본문도 slot-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══════════ 🧬 캐릭터 단위 병합 — 순수 함수 (회원가입 설계 §2-4 · 2026-09-20 · 아직 아무도 안 부른다) ═══════════
   [무엇인가] users/{uid}/chars/{cid} 한 마리씩의 로컬 사본과 서버 사본을 **합집합**으로 맞춘다. 5칸 통째 교체(3-7)를 대신할 규칙.
     entry = { def, mtime }(산 마리) | { del: mtime }(묘비). 값을 지우는 일은 없다 — 지우면 다른 기기가 «없네» 하고 되살린다.
   [규칙 — 설계 §2-4 표 그대로]
     · 한쪽에만 있음            → 있는 쪽 (묘비도 그대로 건너간다)
     · 둘 다 · mtime 같음       → 할 일 없음
     · 둘 다 · 다름             → mtime 큰 쪽. 진 쪽에 def 가 있으면 trash 에 남긴다(이긴 쪽이 묘비면 'deleted' · 산 마리면 'overwritten')
     · 서버 mtime 이 미래(now + skewTol 밖) → 지금 시각으로 찍어서 **올린다**(33307 의 규칙을 마리 단위로 — 시계 틀어진 기기가 영영 이기지 않게)
   [왜 순수 함수인가] 검사(sim-chars-merge.js)가 스텁 없이 이 본문을 그대로 돌린다. localStorage·firebase 를 만지는 일은 부르는 쪽 몫.
   [돌려주는 것] { merged, push, pull, trash, fixed }
     merged: 맞춘 뒤의 전체(cid → entry) · push: 서버에 써야 할 것 · pull: 로컬에 써야 할 것
     trash: [{ cid, def, mtime, why }] — 진 쪽 산 마리 · fixed: 미래 mtime 을 정정한 cid 목록
   ⚠️ cid 는 불변이고 내용 해시가 아니다(설계 §1-3). 같은 마리인가는 cid 로만 가른다. */
/* 본문은 chars.js 로 옮겼다(앱 FSD 18번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHARS_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const charsMod = (typeof TwChars === 'undefined') ? CHARS_MOD_OFF : TwChars.createChars({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  LS_KEY: slotSaveMod.LS_KEY,
  MY_USER_ID_KEY: MY_USER_ID_KEY,
  SLOTS_SYNC_INTERVAL_MS: slotSyncMod.SLOTS_SYNC_INTERVAL_MS,
  SLOTS_TS_SKEW_TOL_MS: slotSyncMod.SLOTS_TS_SKEW_TOL_MS,
  SLOT_IMG_FIELDS: slotSyncMod.SLOT_IMG_FIELDS,
  SLOT_JSON_MAX: slotSyncMod.SLOT_JSON_MAX,
  _blinkEverDrawn: _blinkEverDrawn,
  _charsLinkedMaybeShow: (...a)=>accountMod._charsLinkedMaybeShow(...a),
  _faceEverDrawn: _faceEverDrawn,
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _relinkSeatsToSlots: (...a)=>slotSaveMod._relinkSeatsToSlots(...a),
  _roomFaceCacheLoad: (...a)=>roomSyncMod._roomFaceCacheLoad(...a),
  _roomFaceCacheSave: (...a)=>roomSyncMod._roomFaceCacheSave(...a),
  _slotFromServerObj: (...a)=>slotSyncMod._slotFromServerObj(...a),
  _slotGlbCacheLoad: (...a)=>slotSyncMod._slotGlbCacheLoad(...a),
  _slotGlbCacheSave: (...a)=>slotSyncMod._slotGlbCacheSave(...a),
  _slotToServerObj: (...a)=>slotSyncMod._slotToServerObj(...a),
  _slotsBackupSave: (...a)=>slotSyncMod._slotsBackupSave(...a),
  _slotsFilledCount: (...a)=>slotSyncMod._slotsFilledCount(...a),
  _slotsNow: (...a)=>slotSyncMod._slotsNow(...a),
  _slotsTs: ()=>slotSyncMod._slotsTs(),
  creatorOpen: ()=>creatorOpen,
  loadSlots: (...a)=>slotSaveMod.loadSlots(...a),
  renderCharSlots: (...a)=>settingsMod.renderCharSlots(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
});

/* ═══════════ 🧬 이관 — slots → chars (회원가입 설계 §5-N-2 · 2026-09-21 · 개정 33 · 아직 아무도 안 부른다) ═══════════
   [무엇인가] 5칸 저장본(서버 slots · slotsPrev · 이 기기 LS_KEY)에 있는 마리들에게 cid 를 붙여 chars 모양으로 옮긴다.
     순수 함수 둘 + 열쇠 하나. localStorage·firebase 를 만지는 일은 부르는 쪽 몫(병합 함수와 같은 규칙).
   [왜 _charIdentityFingerprint 가 아닌가] 그 지문은 **같은 표현**끼리 비교하려고 만든 것이다(친구 좌석 재빌드용).
     이 기기 저장본은 얼굴을 dataURL 로, 서버 저장본은 Storage URL 로 들고 있어서 같은 마리도 지문이 다르다 —
     그대로 쓰면 이관 첫 부팅에 모든 기기가 모든 마리를 «새 마리» 로 올린다(5마리 → 10마리).
     ⇒ 그림은 **내용 해시**로 본다. 로컬은 `_quickHash(dataURL)`, 서버는 URL 이름 속 해시 — 올릴 때
       `_storageFaceUrlOne`·`_storageGlbUrlOne` 이 `종류_해시` 로 이름을 지으므로 같은 그림이면 같은 값이 나온다.
   [열쇠 두 벌 — 같은 마리인가]
     K1 = 정체성: 피부·옷 색·동물 여부·동물 얼굴·커미션 여부 + 그림 여덟 + 커미션 GLB 의 내용 해시.
          치장(파츠·xf·꾸미기)·책상은 안 본다 — 그걸 바꾼 것은 «같은 마리를 고친 것» 이라 같은 cid 에 mtime 으로 이긴다.
     K2 = 그림을 뺀 나머지 전부(키 정렬 JSON). 해시를 URL 에서 못 꺼내는 옛 이름(개정 25 전) 대비 — 그림 말고는 한 글자도
          안 다를 때만 맞는다. K1 이 맞으면 K2 는 안 본다.
     둘 다 안 맞으면 **새 cid** — 잃지 않는 쪽으로 틀린다(최악이 «같은 마리가 둘» 이고, 보관함에서 보인다).
   [짝짓기는 1:1] 한 cid 에 두 칸이 붙지 않는다(같은 캐릭터를 두 칸에 둔 사람). 열쇠가 같은 후보가 여럿이면 같은 칸 번호를 먼저.
   ⚠️ 로컬 def 는 **LS_KEY 원본**(문자열 그림)을 넣을 것. 메모리 `slots` 는 얼굴이 캔버스라 해시가 안 나온다
     (`_slotsPushToServer` 가 메모리를 안 보는 것과 같은 이유 — `_imgBroken` 주석).
   ⚠️ 서버 이관(`_charsFromServerSlots`)은 **서버에서 한 번만** — 두 기기가 동시에 하면 같은 마리가 cid 둘을 받는다.
     부르는 쪽은 `charsMeta` 를 트랜잭션으로 먼저 잡은 기기만 쓰게 할 것(firebase-init 쪽 일 · 아직 없음). */
/* (앱 FSD 18번) 이 자리의 본문도 chars.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══════════ 🧬 이관 조율 — 서버 쓰기 + 미리보기 (설계 §5-N-2 · 2026-09-21 · CHECKS 개정 34) ═══════════
   [무엇인가] 위 순수 함수들을 firebase-init 의 chars 통로(loadCharsRemote · claimCharsMigration · saveCharsEntries ·
     finishCharsMigration)에 잇는 자리. **부팅에서 부르지 않는다.**
   · `_charsServerMigrate` — 서버 slots(+slotsPrev) → chars. 첫 이관은 charsMeta 트랜잭션을 잡은 기기만 한다.
     이관 창 되돌이(옛 클라이언트가 slots 를 바꿈)는 같은 함수가 한다 — 짝짓기가 def 문자열 같음을 먼저 보므로 몇 번 돌아도 같다.
     **CHARS_SYNC_ENABLED 가 꺼져 있으면 아무것도 안 쓴다.** 규칙(chars·trash·charsMeta)이 게시되기 전에 켜면 쓰기가 전부 거부된다.
   · `charsMigrateDryRun` — 콘솔 전용 · **읽기만**. 이 계정의 실제 데이터로 짝짓기·병합을 돌려 보고 표로 찍는다.
     열쇠(K1 = 그림 내용 해시)가 실제 Storage URL 에서 나오는지를 실기기에서 보는 유일한 자리다 — `sim-chars-migrate.js` 는 URL 모양을
     가정했다. «그림 URL 중 해시를 꺼낸 것» 이 전부가 아니면 K2 가 받고 있다는 뜻이다(분실은 아니고 중복 위험).
   · 이 기기 쪽 첫 채택(`_charsLocalAdopt` · 개정 35)은 아래 — 평상시 동기화(칸 고침·이동·삭제 · 주기적 받기)는 **아직 없다**.
   ⚠️ uid 는 `getMyUserId()` 로 얻지 않는다 — 그 함수는 아직 «없으면 만든다»(설계 §6-①). 캐시만 읽는다. */
/* (앱 FSD 18번) 이 자리의 본문도 chars.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* --- 복제 코드 (현재 base64. 다음 단계에서 AES 암호화로 교체) --- */
/* ★ onload 가 떴다고 그림이 있는 것은 아니다 — 잘린 dataURL, 0바이트 PNG 는 브라우저에 따라
   onerror 없이 **naturalWidth 0** 으로 onload 가 뜬다. 그 이미지를 drawImage 하면 아무것도
   안 그려지고, 그 빈 캔버스가 그대로 저장되면 얼굴이 영구히 사라진다(제보: "피부색만 보임").
   그래서 0크기와 빈 src 를 여기서 실패로 만든다 — 호출부가 실패를 실패로 다룰 수 있게. */
function loadImg(src){return new Promise((res,rej)=>{
  if(typeof src!=='string' || !src){ rej(new Error('이미지 원본이 비어 있음')); return; }
  const i=new Image();
  i.onload=()=>{ if(!i.naturalWidth || !i.naturalHeight) rej(new Error('이미지 크기가 0')); else res(i); };
  i.onerror=()=>rej(new Error('이미지 로드 실패'));
  i.src=src;});}

/* ============================================================ 🛡️ 얼굴 자동 복구 (워치독)
   [무엇을 고치나] 제보 — 클립스튜디오로 작업하는 동안, 아무것도 안 건드렸는데 실행 중에
     캐릭터 얼굴만 사라졌다. 몸·옷·책상은 멀쩡했고 동물 캐릭터도 무사했다.
     동물이 무사한 것이 결정적이다 — 동물은 텍스처를 animalBody(문자열)에서 만들고,
     인간은 def.face(살아 있는 캔버스)를 쓴다. **캔버스 백킹스토어가 회수된 그림**과 맞는다.
     JS 는 def.face 에 손댄 적이 없다(대입하는 곳은 친구 전용 네트워크 경로 두 줄뿐이다).
   [saveSlots 의 공백 방어와 무엇이 다른가]
     · saveSlots 쪽은 **저장을 막는다** — 원본이 빈 그림으로 덮이지 않게 한다(영구 소실 차단).
     · 여기는 **화면을 되돌린다** — 비어 버린 캔버스에 localStorage 원본을 다시 그려 넣는다.
     저장이 한 번도 안 도는 동안에는 saveSlots 쪽이 아예 실행되지 않으므로, 화면 복구는
     별도의 주기 점검이어야 한다. 그래서 둘 다 필요하다.
   [무엇을 안 건드리나]
     · 생성기가 열려 있는 동안은 쉰다 — 사용자가 «지우는 중»일 수 있고, 그때 되살리면
       방금 지운 그림이 눈앞에서 부활한다. 그건 복구가 아니라 버그로 보인다.
     · 동물(def.animal)은 건너뛴다 — 텍스처 경로가 통째로 달라(buildAnimalBase) 이 함수의
       재합성 규칙이 맞지 않는다. 애초에 이 사안의 피해자도 아니다.
     · _imgBroken(부팅 실패) 칸도 건너뛴다 — 그쪽은 이미 자기 보호막이 있고, 원본을 못 읽는
       상태라 다시 그려 봐야 같은 실패를 반복한다.
   ★ «원래부터 빈 얼굴»은 _faceEverDrawn 이 false 라 후보에 들지 않는다. 이미 손상된 저장본도
     마찬가지다(부팅에 빈 그림을 읽었으니 false) — 복구가 무한히 헛도는 일이 없다. */
/* 본문은 face-heal.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FACE_HEAL_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const faceHealMod = (typeof TwFaceHeal === 'undefined') ? FACE_HEAL_MOD_OFF : TwFaceHeal.createFaceHeal({
  CANVAS_SZ: CANVAS_SZ,
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  LS_KEY: slotSaveMod.LS_KEY,
  Presence: Presence,
  SKIN_COLORS: SKIN_COLORS,
  _blinkEverDrawn: _blinkEverDrawn,
  _faceEverDrawn: _faceEverDrawn,
  _isBlankDraw: (...a)=>_isBlankDraw(...a),
  creatorOpen: ()=>creatorOpen,
  loadImg: (...a)=>loadImg(...a),
  loadSkins: (...a)=>loadSkins(...a),
  seats: seats,
  skinCanvasFor: (...a)=>skinCanvasFor(...a),
  skinCanvases: skinCanvases,
  slots: slots,
  toast: (...a)=>toast(...a),
});

/* ===== 진짜 암호화: AES-256-GCM + PBKDF2(150k) ===== */
/* 본문은 code-crypto.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CODE_CRYPTO_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const codeCryptoMod = (typeof TwCodeCrypto === 'undefined') ? CODE_CRYPTO_MOD_OFF : TwCodeCrypto.createCodeCrypto({
  charDef: (...a)=>charDef(...a),
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
});

/* ===== 풀 GLB 파일 암호화 (.dcc) ===== */
/* 본문은 asset-code.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ASSET_CODE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const assetCodeMod = (typeof TwAssetCode === 'undefined') ? ASSET_CODE_MOD_OFF : TwAssetCode.createAssetCode({
  codeCryptoMod: codeCryptoMod,
  loader: loader,
});
/* ===== 책상·아이템 GLB 코드 (DCK1) — 캐릭터처럼 복제 코드로 판매/추가 ===== */
/* (앱 FSD 48번) 이 자리의 본문도 asset-code.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ===== 커미션 캐릭터 zip 코드 시스템 =====
   관리자가 zip(character.glb + face.png + blink.png)을 코드로 만들어 고객에게 전달.
   고객이 캐릭터 생성창의 [+ 코드 입력하기]로 받아서 책상 세팅 단계부터 진입.
   - 텍스처는 자동 512×512로 리사이즈
   - 한도 2MB (압축 풀린 zip 내부 합계)
   - 1~4단계 잠금 (피부/표정/감은눈/색상은 완성형이라 수정 불가)
*/
/* 본문은 commission.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const COMMISSION_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const commissionMod = (typeof TwCommission === 'undefined') ? COMMISSION_MOD_OFF : TwCommission.createCommission({
  _b64: (...a)=>codeCryptoMod._b64(...a),
  _deriveKey: (...a)=>codeCryptoMod._deriveKey(...a),
  _unb64: (...a)=>codeCryptoMod._unb64(...a),
  toast: (...a)=>toast(...a),
});
/* ★ 앱을 켜자마자 최대한 일찍 저장된 아이템들의 GLB 파싱을 시작해둠(비동기) — 이게 늦게 끝나면, 그 사이에
     캐릭터가 먼저 실행되면서 아직 customItems에 등록 안 된 아이템은 조용히 빠지는(=책상 위에서 사라지는)
     타이밍 경쟁이 있었음("가끔 아이템이 사라지는" 원인). 최대한 앞당겨서 그 경쟁 창을 최소화함.
   ⚠️ commissionMod 를 만든 **뒤**에 부른다 — 모듈 안에서 부르면 commissionMod 가 아직 없어 던진다. */
loadSavedItemsIntoSession();
/* 커스텀 아이템 레지스트리 (생성기 세션) */
let customItems={};


/* ===== 캐릭터 꾸미기 파츠 (프리미엄) =====
   모든 캐릭터 공통으로 등록(관리자), 착용은 캐릭터별(def.equippedParts).
   이번 단계: 단순 부착 파츠(모자/안경/날개/왼손/오른손). 옷·헤어는 다음 단계.
*/
/* (앱 FSD 37번) 이 자리의 본문도 premium-assets.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🧊 파츠 GLB 파싱 캐시 · 썸네일 ═══ */
/* 파츠 GLB 파싱 캐시: id → THREE.Object3D(원본 씬) */
// ★ 반투명 파츠가 데스크탑 배경 영향받는 문제 해결용 헬퍼.
//   Electron 투명 창은 프레임버퍼 alpha < 1인 픽셀을 데스크탑 배경과 블렌드하기 때문에,
//   블렌더에서 alpha 낮게 export한 재질이 데스크탑 색에 따라 다르게 보이는 문제가 있었음.
//   프래그먼트 셰이더에서 alpha=1을 강제해서 최종 픽셀이 항상 opaque하게 출력되게 함.
//   내부 색상 블렌딩(캐릭터 몸통 위의 반투명 효과)은 유지됨 — 이건 프레임버퍼 alpha와 별개.
function _forceOpaqueAlphaOutput(mat){
  // ⚠️ 이 함수는 이전에 반투명 파츠의 최종 알파를 1.0으로 강제하는 셰이더 훅이었음.
  //   그 방식은 유저가 만든 반투명 파츠(안경 렌즈, 유령 옷 등)의 투명도가 화면에 전혀 반영되지 않는
  //   부작용을 만들었기 때문에 제거. 대신 호출부의 renderOrder=10 지정은 그대로 유지되어 파츠 간
  //   그리기 순서 문제(뒤 요소가 앞 요소에 가려지는 문제)를 대부분 방지함.
  //   호출부 변경 최소화를 위해 함수 자체는 남기되 no-op으로 둠.
}
const partSceneCache = new Map();
async function getPartScene(rec){
  if(partSceneCache.has(rec.id)) return partSceneCache.get(rec.id);
  // 런처9/Storage 이관 후속: rec.glb가 없고 glbUrl만 있으면(로컬 캐시에서 로드된 초기 상태) Storage에서 먼저 받아옴.
  if(!rec.glb && rec.glbUrl){
    try{ await resolveCatalogGlb(rec); }catch(_){}
  }
  if(!rec.glb) throw new Error('파츠 GLB를 찾을 수 없어요: '+rec.id);
  const {scene, animations} = await assetCodeMod.parseGlbFull(b64ToBuf(rec.glb));
  const result = {scene, animations};
  partSceneCache.set(rec.id, result);
  return result;
}
// ★ Phase 4: 파츠 도트 썸네일 자동 생성.
//   등록/편집 시점에 이 함수를 호출해 rec.thumbnail(base64 PNG)을 채움. 꾸미기 창 카드에 표시됨.
//   32×32 정사각형에 정면 각도로 렌더 → CSS로 pixelated 확대 표시.
const THUMB_SIZE = 32;
let _thumbRenderer = null, _thumbScene = null, _thumbCam = null;
function _ensureThumbRig(){
  if(_thumbRenderer) return;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE; canvas.height = THUMB_SIZE;
  _thumbRenderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, preserveDrawingBuffer:true});
  _thumbRenderer.setPixelRatio(1);
  _thumbRenderer.setClearColor(0x000000, 0);   // 투명 배경
  _thumbRenderer.outputEncoding = THREE.sRGBEncoding;
  _thumbScene = new THREE.Scene();
  // 조명은 메인 씬과 동일하게 (톤 통일)
  /* 💡 썸네일 광량 — 씬 조명(_MAIN_LIGHT_INT)에 이 배율을 곱한다.
     ★★ 이 배율은 **직접 정하지 않는다.** TONE_FRONT_TOTAL 과 똑같은 방식으로, "정면 흰 면이 받는
        총합"(THUMB_FRONT_TOTAL)에서 emissive(FLAT_EMISSIVE)를 뺀 나머지를 조명이 채우게 계산한다.
     [경위 — 왜 조용히 어두워졌나] 예전에는 여기에 0.4 라는 손으로 맞춘 숫자가 박혀 있었다.
       그 0.4 는 _MAIN_LIGHT_INT 가 ≈0.84, FLAT_EMISSIVE 가 0.45 였던 시절에 "흰 파츠가 1.49 로
       완전히 날아가는" 것을 막기 위해 고른 값이다(제보: "하얀 파츠는 아예 보이지도 않는다").
       그 뒤 조명 예산이 두 번 바뀌어 _MAIN_LIGHT_INT 가 0.552 로 34% 내려갔는데, 이 0.4 는 예산
       밖에 있어서 같이 따라오지 않았다 ⇒ 썸네일 정면 총합이 **0.709** 로 주저앉았다.
       실행 화면은 1.12 이므로 카드 안에서만 63% 밝기로 보인 것이다(제보: "썸네일이 전체적으로 어둡다").
       ★ 이것이 파일 위쪽 FLAT_EMISSIVE 주석이 경고하는 바로 그 사고다 — "한 예산을 나눠 쓰는 값을
         다른 곳에 손으로 적어두면 한쪽만 고칠 때마다 화면이 어긋난다." 그래서 계산으로 바꿨다.
     [값] 배율 1 일 때 정면 총합 = 1.12 (= 실행 화면과 동일). 배율은 아래 식이 정한다.
        THUMB_FRONT_TOTAL   배율    정면 총합
          1.12(지금)        1.000   1.12   ← 장착 화면과 같은 톤
          1.06              0.912   1.06
          1.02              0.854   1.02
          0.96              0.766   0.96
          (0.709 = 예전 상태 · 너무 어둡다)
     ⚠️ 흰 파츠(알베도 1.0)는 총합 1.0 을 넘으면 잘린다. 실행 화면이 이미 1.12 로 돌고 있어서
        같은 값을 쓰는 것은 "카드와 장착 화면이 같아진다"는 뜻이다 — 썸네일만 특별히 더 어둡게
        둘 이유가 없다. 게다가 키 라이트가 비스듬해서(1,2.5,2) 정면 법선이 받는 몫은 cos≈0.6 이라
        실제 정면은 ≈1.06 에 앉는다(윗면만 1.12 에 근접) — 32px 에서 음영이 남는다.
     ⚠️ "흰 파츠가 다시 뭉개진다" 제보가 오면 THUMB_FRONT_TOTAL 만 1.02 로 내릴 것.
        _MAIN_LIGHT_INT·_KEY_LIGHT_MUL·FLAT_EMISSIVE 는 절대 여기서 만지지 말 것(예산이 갈라진다).
     ⚠️ 썸네일은 **등록 시점에 구워져 캐시**된다 — 이 값을 바꿔도 기존 파츠는 그대로다.
        콘솔에서 generateAllPartThumbnails(true) 로 다시 구워야 반영된다. */
  const THUMB_FRONT_TOTAL = TONE_FRONT_TOTAL;   // 장착 화면과 같은 총합
  const _THUMB_LIGHT_AT_1 = (0.95 * _MAIN_LIGHT_INT) + (_MAIN_LIGHT_INT * _KEY_LIGHT_MUL);
  const THUMB_LIGHT_MUL = Math.max(0, Math.min(1.5,
    (THUMB_FRONT_TOTAL - FLAT_EMISSIVE) / (_THUMB_LIGHT_AT_1 || 1)));
  _thumbScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT * THUMB_LIGHT_MUL));
  const key = new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL * THUMB_LIGHT_MUL);
  /* ★ 정수리 바로 위(0,5,0)에서 비추면 카메라를 보는 면에 빛이 거의 안 닿아 정면이 어둡게 나온다.
     그렇다고 정면으로 세우면(0,0,n) 음영이 통째로 사라져 납작해진다 — 비스듬히 위에서 준다. */
  key.position.set(1, 2.5, 2); _thumbScene.add(key);
  _thumbCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  _thumbCam.position.set(0, 0, 3);
  _thumbCam.lookAt(0, 0, 0);
}
async function generatePartThumbnail(rec){
  try{
    _ensureThumbRig();
    const {scene:template} = await getPartScene(rec);
    // 원본을 건드리지 않도록 clone
    const obj = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils.clone(template) : template.clone(true);
    /* 💡 장착 화면과 **같은 톤**을 먹인다.
       [경위] 파츠 밝기의 상당 부분은 emissive(플랫 조명)에서 나오는데 썸네일만 그 처리가
         빠져 있어서, 같은 파츠인데 카드 안에서만 어둡게 나왔다.
       ⚠️ 머티리얼을 반드시 복제한 뒤 건드릴 것 — 원본은 getPartScene 이 캐싱해 두고 장착 경로가
          다시 쓰는 것이라, 여기서 원본을 물들이면 그 뒤 장착분에 두 번 먹는다. */
    obj.traverse(o=>{
      if(!o.isMesh) return;
      o.frustumCulled = false;
      const m = (o.material && o.material.clone) ? o.material.clone() : o.material;
      o.material = m;
      _applyPartMatTone(m);
    });
    // 바운딩 박스 재서 프레이밍
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.01);
    // 오브젝트를 원점 중앙에 위치시키기
    obj.position.sub(center);
    // 카메라 프레이밍 — 오브젝트가 딱 맞게 들어오도록 스케일 조정
    const half = maxDim * 0.55;   // 여백 10% 정도
    _thumbCam.left = -half; _thumbCam.right = half;
    _thumbCam.top = half; _thumbCam.bottom = -half;
    _thumbCam.updateProjectionMatrix();
    _thumbScene.add(obj);
    _thumbRenderer.render(_thumbScene, _thumbCam);
    const dataUrl = _thumbRenderer.domElement.toDataURL('image/png');
    _thumbScene.remove(obj);
    return dataUrl;
  }catch(e){
    console.warn('썸네일 생성 실패', rec && rec.id, e);
    return null;
  }
}
// ★ 관리자 콘솔용: 기존에 등록된 파츠에 일괄로 썸네일 생성 + Firebase 배포.
//   F12 콘솔에서 `generateAllPartThumbnails()` — 썸네일이 **없는** 것만 생성.
//                `generateAllPartThumbnails(true)` — 이미 있는 것도 **다시 굽는다**.
//   ⚠️ 썸네일은 등록 시점에 구워져 캐시되므로, 톤(THUMB_FRONT_TOTAL)이나 조명 예산을 바꾼 뒤에는
//     force 로 다시 구워야 반영된다. 안 그러면 "코드를 고쳤는데 화면이 그대로"가 된다.
window.generateAllPartThumbnails = async function(force){
  if(!isAdmin){ console.warn('관리자만 실행 가능'); return; }
  const targets = premiumMod.savedParts().filter(p=>p.fromCatalog && (force || (!p.thumbnail && !p.thumbUrl)));
  console.log('썸네일 ' + (force ? '재생성(force)' : '생성') + ' 대상:', targets.length, '개');
  let ok=0, fail=0;
  for(const rec of targets){
    try{
      const thumb = await generatePartThumbnail(rec);
      if(thumb){
        rec.thumbnail = thumb;
        /* ⚠️ 카드가 읽는 순서는 thumbUrl → thumbnail 이다(_gachaThumb · renderWardrobe 둘 다).
           다시 구웠는데 예전 Storage URL 이 남아 있으면 **낡은 이미지가 계속 이긴다** —
           "force 로 돌렸는데 하나도 안 바뀐다"가 된다. 로컬 참조를 지워서 새로 구운 base64 가
           바로 보이게 하고, 서버 쪽 새 URL 은 다음 카탈로그 동기화에서 다시 채워진다. */
        if(force) delete rec.thumbUrl;
        if(window.firebaseAPI && window.firebaseAPI.publishPart){
          /* 🔴 여기도 set() = 노드 전체 교체다 — buildPartPublishData 로만 만든다.
             ⚠️ 예전엔 필드를 손으로 나열했고 **`gacha` 와 `season` 이 빠져 있었다.**
                이 함수를 한 번 돌리면 카탈로그의 가챠 파츠가 전부 `gacha` 를 잃는다 →
                뽑기로만 얻어야 할 파츠가 **꾸미기 창에 그냥 뜬다.** 손으로 나열하는 방식이
                같은 사고를 계속 만든 자리라, 목록을 한 곳으로 모았다. */
          await window.firebaseAPI.publishPart(rec.id, adminPartReg.buildPartPublishData(rec, { thumbnail: thumb }));
        }
        ok++;
        console.log('✓', rec.name, '('+(ok+fail)+'/'+targets.length+')');
      } else { fail++; }
    }catch(e){ fail++; console.warn('실패:', rec.name, e); }
  }
  premiumMod.persistSavedParts();
  wardrobeMod.renderWardrobe();
  gachaMod.renderGachaInv();   // 🎰 보관함이 열려 있으면 카드도 같이 갱신
  console.log('완료: 성공', ok, '/ 실패', fail);
  toast('썸네일 생성 완료: '+ok+'개');
};
premiumMod.loadSavedParts();

/* ═══ 💾 카탈로그 GLB 영구 캐시(IndexedDB) · URL 해결 ═══ */
/* ── 파츠 카탈로그 실시간 동기화 ──────────────────────────────────────────
   로컬(localStorage)에 저장된 savedParts와 별개로, Firebase catalog/parts를 구독해서
   "관리자가 이 앱을 배포한 뒤에도 새 파츠를 등록하면 이미 설치한 모든 사용자에게 자동으로 반영"되게 함.
   - 카탈로그에 있는 id는 항상 Firebase 최신본으로 덮어씀(관리자가 나중에 이름/아이콘 등을 고쳐도 반영되게)
   - 카탈로그에 없는 로컬 항목(오프라인 캐시, 혹은 예전 방식으로 로컬에만 등록됐던 파츠)은 그대로 유지
   - 구독은 실시간(onValue)이라 앱을 껐다 켤 필요 없이, 켜져 있는 동안에도 자동으로 새 파츠가 뜸 */
// ★ Firebase 사용량 절감: 카탈로그 GLB가 이제 Storage에 저장되고 인덱스엔 glbUrl만 있음.
//   앱은 지금 rec.glb(base64)에 의존해 여러 곳에서 쓰고 있어서, 사용 시점에 glbUrl→glb로 해결해서
//   기존 코드 흐름을 그대로 유지. 같은 URL은 세션 메모리 캐시로 두 번 안 받음.
/* 💾 카탈로그 GLB 영구 캐시 (IndexedDB) ────────────────────────────────────
   [무엇을 푸는가] 아래 _glbUrlCache 는 **세션 메모리**라 앱을 껐다 켜면 사라진다. 그래서 실행할
     때마다 카탈로그 GLB 전량을 Storage 에서 다시 받았다(Cloud Storage Class B + APAC 다운로드).
     firebaseAPI.fetchCatalogGlb 주석은 "앱이 로컬에서 캐싱을 담당한다"고 적혀 있었지만
     실제로 그 캐싱을 하는 곳이 없었다 — 이 저장소가 그 자리다.
   ★ 키는 glbUrl 그대로다. Storage 에 새로 올리면 다운로드 URL 의 토큰이 바뀌므로,
     관리자가 파츠를 갱신하면 키가 달라져 자동으로 새로 받는다(수동 무효화가 필요 없다).
   ★ localStorage 가 아니라 IndexedDB 인 이유: base64 GLB 는 개당 수백 KB~1.4MB 라
     localStorage 의 5MB 한도를 몇 개만에 넘긴다.
   ⚠️ 실패는 전부 조용히 넘긴다 — 캐시는 있으면 좋은 것이지 없으면 안 되는 것이 아니다
     (사파리 프라이빗 모드 등에서 IDB 가 막혀도 앱은 그냥 매번 받아 쓰면 된다). */
const _GLB_IDB_NAME = 'tw-glb-cache', _GLB_IDB_STORE = 'glb', _GLB_IDB_TTL = 45 * 86400000;   // 45일
let _glbIdbPromise = null;
function _glbIdb(){
  if(_glbIdbPromise) return _glbIdbPromise;
  _glbIdbPromise = new Promise(res=>{
    try{
      if(!window.indexedDB) return res(null);
      const rq = indexedDB.open(_GLB_IDB_NAME, 1);
      rq.onupgradeneeded = ()=>{ try{ rq.result.createObjectStore(_GLB_IDB_STORE, {keyPath:'url'}); }catch(_){} };
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>res(null);
    }catch(_){ res(null); }
  });
  return _glbIdbPromise;
}
function _glbIdbGet(url){
  return _glbIdb().then(db=>new Promise(res=>{
    if(!db) return res(null);
    try{
      const rq = db.transaction(_GLB_IDB_STORE, 'readonly').objectStore(_GLB_IDB_STORE).get(url);
      rq.onsuccess = ()=>res(rq.result ? rq.result.b64 : null);
      rq.onerror = ()=>res(null);
    }catch(_){ res(null); }
  })).catch(()=>null);
}
function _glbIdbPut(url, b64){
  return _glbIdb().then(db=>{
    if(!db) return;
    try{ db.transaction(_GLB_IDB_STORE, 'readwrite').objectStore(_GLB_IDB_STORE).put({ url, b64, ts: Date.now() }); }catch(_){}
  }).catch(()=>{});
}
/* 오래 안 쓴 항목 정리 — 세션당 1회. 관리자가 파츠를 갱신하면 옛 URL 은 영영 안 쓰이는데
   그대로 두면 디스크만 먹는다. 지워도 필요해지면 다시 받으면 그만이라 안전하다. */
let _glbIdbPruned = false;
function _glbIdbPrune(){
  if(_glbIdbPruned) return; _glbIdbPruned = true;
  _glbIdb().then(db=>{
    if(!db) return;
    try{
      const cutoff = Date.now() - _GLB_IDB_TTL;
      const st = db.transaction(_GLB_IDB_STORE, 'readwrite').objectStore(_GLB_IDB_STORE);
      const rq = st.openCursor();
      rq.onsuccess = ()=>{
        const c = rq.result; if(!c) return;
        if(!c.value || !(c.value.ts > cutoff)){ try{ c.delete(); }catch(_){} }
        c.continue();
      };
    }catch(_){}
  }).catch(()=>{});
}

const _glbUrlCache = new Map();   // url → base64 (세션 메모리 1차 캐시)
async function resolveCatalogGlb(rec){
  if(!rec) return null;
  if(rec.glb) return rec.glb;                          // 구버전(base64 그대로) 호환
  if(!rec.glbUrl) return null;
  if(_glbUrlCache.has(rec.glbUrl)){
    // ★ 캐시에서 가져올 때도 rec.glb를 반드시 채워둠 — 이걸 빠뜨리면 다른 곳에서 rec.glb를 체크하는 코드가 여전히 undefined를 봄
    //   (책상 삭제 후 다른 책상 클릭 시 "GLB를 불러올 수 없어요" 오탐의 원인).
    rec.glb = _glbUrlCache.get(rec.glbUrl);
    return rec.glb;
  }
  // 2차 캐시(IndexedDB) — 앱을 껐다 켜도 남는다. 여기서 맞으면 네트워크로 안 나간다.
  const hit = await _glbIdbGet(rec.glbUrl);
  if(hit){
    _glbUrlCache.set(rec.glbUrl, hit);
    rec.glb = hit;
    return hit;
  }
  if(!(window.firebaseAPI && firebaseAPI.fetchCatalogGlb)) return null;
  try{
    const b64 = await firebaseAPI.fetchCatalogGlb(rec.glbUrl);
    _glbUrlCache.set(rec.glbUrl, b64);
    _glbIdbPut(rec.glbUrl, b64);   // 기다리지 않는다 — 저장 실패해도 이번 실행에는 지장이 없다
    rec.glb = b64;    // 이후 rec.glb 참조 시 재fetch 없음
    return b64;
  }catch(e){ console.warn('카탈로그 GLB 로드 실패', rec.id, e); return null; }
}
// 카탈로그 스냅샷 전체를 병렬로 해결 — 각 rec에 .glb 채워서 반환.
async function resolveCatalogGlbAll(catalogObj){
  _glbIdbPrune();
  const ids = Object.keys(catalogObj||{});
  await Promise.all(ids.map(id=>resolveCatalogGlb(catalogObj[id])));
  return catalogObj;
}

/* ═══ 🧹 관리자 콘솔 도구 — 카탈로그 정리 · 진단 · 유령 방 · 초대권 회수 ═══ */
/* 본문(F12 콘솔 함수 일곱)은 admin/admin-console.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에 모은다. 이름은 예전처럼 window 에 걸린다.
   카탈로그 목록 셋은 다시 대입되는 let 이라 읽는 함수로 넘긴다. */
const ADMIN_CONSOLE_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const adminConsole = (typeof TwAdminConsole === 'undefined') ? ADMIN_CONSOLE_OFF : TwAdminConsole.createAdminConsole({
  savedParts: ()=>premiumMod.savedParts(),
  savedDesks: ()=>commissionMod.savedDesks(),
  savedItems: ()=>commissionMod.savedItems(),
});

/* ═══ 🔄 카탈로그 실시간 동기화 — 아이템 · 책상 · 파츠 · 카테고리 ═══ */
async function mergeCatalogIntoSavedItems(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>({ id, ...catalogObj[id], fromCatalog:true }));
  // ★ order 필드 기준 오름차순 정렬 — 관리자가 드래그로 정한 순서가 모든 사용자에게 그대로 반영됨.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const removedIds = commissionMod.savedItems().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = commissionMod.savedItems().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 아이템을 지금 올려놓은 좌석이 있으면 치움
    seats.forEach(s=>{ removedIds.forEach(id=>{ if(s.deskItems && s.deskItems[id]){ const def=customItems[id]||{id}; equipDeskItem(s,def,false); } }); });
    removedIds.forEach(id=>{ delete customItems[id]; });
  }
  commissionMod.setSavedItems([...catalogList, ...localOnly]);
  commissionMod.persistSavedAssets();
  /* 🩹 #11 — 등록이 끝난 **뒤에** 좌석을 다시 적용한다. 예전엔 await 없이 불러서 바로 아래 재적용이
     옛 정의(크기 0.8)로 아이템을 다시 만들었고, 등록이 끝난 뒤엔 다시 그리는 곳이 없었다. */
  try{ await loadSavedItemsIntoSession(); }catch(_){}   // 세션 customItems에도 최신 상태 반영(새로 추가/수정된 GLB 등록)
  // 캐릭터 로드가 카탈로그 동기화보다 먼저 끝났을 수 있어서(비동기 타이밍), 이미 떠 있는 좌석들의 아이템도 다시 적용
  seats.forEach(s=>{ clearHolderDeskItems(s); if(s.charDef && s.charDef.deskItems) applyDeskItemsTo(s, s.charDef.deskItems); });
  // ★ 생성기 안에서 지금 장착 중인 아이템도 갱신 — 관리자가 생성기를 연 채로 아이템을 수정하면
  //   그 자리에서 바로 반영돼야 함(안 그러면 카드 목록만 갱신되고 실제로 올려둔 아이템은 예전 GLB 그대로 남음).
  //   ★ 위치/크기 조정값은 일부러 보존하지 않음 — 예전엔 보존했더니, 관리자가 자동 크기 계산 로직(ITEM_TARGET_SIZE
  //   등)을 바꿔도 "저장된 옛날 크기값"이 계속 덮어써서 변경사항이 화면에 반영되는 게 안 보이는 버그가 있었음.
  //   동기화 시점엔 항상 방금 계산된 새 값을 그대로 보여줌.
  if(typeof cBase!=='undefined' && cBase && creatorOpen && cBase.deskItems){
    Object.keys(cBase.deskItems).forEach(id=>{
      const p=cBase.deskItems[id]; if(!p) return;
      const def=customItems[id]; if(!def) return;   // 카탈로그(커스텀) 아이템만 대상 — 기본 내장 모양은 고정이라 재적용 불필요
      equipDeskItem(cBase, def, true);
    });
  }
  if(creatorOpen) renderCrItems();
  /* 🪑 [제보 2] 책상 카탈로그와 같은 이유 — licenseOnly 아이템 판정은 이 레코드가 와야 선다. */
  try{ premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 아이템 카탈로그 도착 후 정리 실패', e); }
}
function subscribeCatalogItems(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCatalogItems) return;
  window.firebaseAPI.subscribeCatalogItems(async catalogObj=>{
    await resolveCatalogGlbAll(catalogObj);
    await mergeCatalogIntoSavedItems(catalogObj);
  });
}
if(window.firebaseAPI) subscribeCatalogItems();
else window.addEventListener('firebase-ready', subscribeCatalogItems, { once:true });
function mergeCatalogIntoSavedDesks(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>({ id, ...catalogObj[id], fromCatalog:true }));
  // ★ order 필드 기준 오름차순 정렬 — 관리자가 드래그로 정한 순서가 모든 사용자에게 그대로 반영됨.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const removedIds = commissionMod.savedDesks().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = commissionMod.savedDesks().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 책상을 지금 쓰고 있는 좌석이 있으면 기본 책상으로 되돌림
    seats.forEach(s=>{ if(s.charDef && removedIds.includes(s.charDef.deskCatalogId)){ s.charDef.deskCatalogId=null; s.charDef.deskGlb=null; if(s.desk) swapDeskVisual(s.desk,null); } });
  }
  commissionMod.setSavedDesks([...catalogList, ...localOnly]);
  commissionMod.persistSavedAssets();
  // 지금 이 책상을 쓰고 있는 좌석이 있으면(수정됐을 수 있으니) 즉시 새 GLB로 다시 그림 — "교체하면 실시간 반영" 요구사항
  // 기본 책상(별도 deskCatalogId/deskGlb 없음)을 쓰는 좌석도 __default_desk__ 오버라이드가 있으면/없어졌으면 반영
  seats.forEach(s=>{
    if(s.charDef && s.charDef.deskCatalogId){ applyDeskCatalogRefToSeat(s, s.charDef); }
    else if(s.charDef && !s.charDef.deskGlb){ applyDeskCatalogRefToSeat(s, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:s.charDef.deskScale, deskColor:s.charDef.deskColor}); }
  });
  /* 🪑 [제보 2] 카탈로그가 도착한 지금이 «이 id 가 전용인가» 를 알 수 있는 **첫 순간**이다.
     licenseOnly 는 이 레코드에만 있어서, 부팅 때 캐릭터가 먼저 닿으면 그 전까지는 판정이 안 된다.
     ★ 라이선스가 있거나 카탈로그가 비었으면 pruneUnownedLicenseAssets 가 스스로 물러난다. */
  try{ premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 책상 카탈로그 도착 후 정리 실패', e); }
  // ★ 생성기 안에서 지금 보고 있는 미리보기(cDesk)도 갱신 — 관리자가 생성기를 연 채로 등록/수정하면
  //   그 자리에서 바로 반영돼야 함(안 그러면 renderCrItems로 카드 목록만 갱신되고, 실제 3D 미리보기는 예전 모습 그대로 남음).
  if(typeof cDesk!=='undefined' && cDesk && creatorOpen){
    if(cDeskGlbB64 && activeCustomDeskId){
      const rec=commissionMod.savedDesks().find(d=>d.id===activeCustomDeskId);
      if(rec){ assetCodeMod.parseGlbBytes(b64ToBuf(rec.glb)).then(sc=>{ cDeskTemplate=sc; cDeskGlbB64=rec.glb; swapDeskVisual(cDesk,sc); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }).catch(()=>{}); }
    } else if(!activeCustomDeskId){
      const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
      if(ov){ assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb)).then(sc=>{ swapDeskVisual(cDesk,sc,true); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }).catch(()=>{}); }
      else { swapDeskVisual(cDesk,null); applyDeskColorToCustom(cDesk,cDeskColor); setCreatorDeskScale(cDeskScale); }
    }
  }
  if(creatorOpen) renderCrItems();
}
function subscribeCatalogDesks(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCatalogDesks) return;
  window.firebaseAPI.subscribeCatalogDesks(async catalogObj=>{
    await resolveCatalogGlbAll(catalogObj);
    mergeCatalogIntoSavedDesks(catalogObj);
  });
}
if(window.firebaseAPI) subscribeCatalogDesks();
else window.addEventListener('firebase-ready', subscribeCatalogDesks, { once:true });
// 좌석의 charDef.deskCatalogId를 보고 지금 카탈로그에 있는 최신 GLB로 책상을 그려줌(없으면 기본 책상)
async function applyDeskCatalogRefToSeat(seat, def){
  if(!seat || !seat.desk) return;
  const rec = commissionMod.savedDesks().find(d=>d.id===def.deskCatalogId);
  if(!rec){
    swapDeskVisual(seat.desk,null);
    setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
    return;
  }
  /* 라이선스 게이트 — 라이선스 필수 책상인데 없으면 기본 책상 fallback + 안내
     ★ **내 좌석에만** 건다(!seat.remote). 이 함수는 친구 좌석을 그릴 때도 그대로 도는데,
       예전엔 여기서 '보는 사람'의 isPremium을 봤다 → 라이선스가 있는 친구가 그 책상을 써도
       라이선스 없는 내 화면에서는 기본 책상으로 바뀌어 보였다(제보된 증상).
       게이트의 목적은 '내가 못 쓰게' 하는 것이지 '남이 쓴 걸 못 보게' 하는 게 아니다.
     ⚠️ 같은 함정이 equipDeskItem(책상 위 아이템)에도 있었다 — 거기도 함께 고쳤다.
       새 licenseOnly 자산을 추가할 때는 항상 '장착 시점'에만 막을 것. 그리는 시점에 막으면
       그 순간 화면이 곧 남의 화면이 아니게 된다. */
  if(rec.licenseOnly && !seat.remote && !isPremium && !isAdmin){
    swapDeskVisual(seat.desk,null);
    setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
    if(seat.isMe) toast('🔒 "'+(rec.name||'이 책상')+'"은(는) 라이선스 보유자만 사용할 수 있어요');
    return;
  }
  try{
    seat.desk.userData.__seat = seat;   // 책상 idle 재생 판정에 좌석 상태 필요
    const { scene:sc, animations } = await assetCodeMod.parseGlbFull(b64ToBuf(rec.glb));
    seat.desk.userData.deskScale=def.deskScale||1;
    swapDeskVisual(seat.desk,sc,def.deskCatalogId===DEFAULT_DESK_OVERRIDE_ID, animations, rec.playMode);
    setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
    if(def.deskColor) applyDeskColorToCustom(seat.desk,def.deskColor);
  }catch(e){}
}
function mergeCatalogIntoSavedParts(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>premiumMod._normPartRec({ id, ...catalogObj[id], fromCatalog:true }));   // 🎰 가챠 = stackable(_normPartRec 주석)
  // ★ order 필드 기준 오름차순 정렬 — 관리자가 화면에서 드래그로 정한 순서가 모든 사용자에게 그대로 반영됨.
  //   order가 없는(예전에 등록돼서 순서 개념이 생기기 전인) 항목은 뒤로 밀리게 처리.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  // ★ "카탈로그에서 한 번이라도 온 적 있는데(fromCatalog) 지금은 목록에 없는 것"은 관리자가 삭제한 것 —
  //   이건 로컬에도 남겨두면 안 됨(예전 버그: 전부 "로컬 전용"으로 취급해서 영원히 안 지워졌음).
  //   진짜 로컬 전용(사용자가 직접 올린 것, 카탈로그에 온 적 없음)만 남김.
  const removedIds = premiumMod.savedParts().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = premiumMod.savedParts().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 파츠를 지금 착용 중인 좌석이 있으면 해제
    seats.forEach(s=>{ if(s.charDef&&s.charDef.equippedParts){ for(const c in s.charDef.equippedParts){ if(removedIds.includes(premiumMod.partEntryId(s.charDef.equippedParts[c]))){ delete s.charDef.equippedParts[c]; unequipPartFromSeat(s,c); } } } applyClothVisibility(s); });
  }
  premiumMod.setSavedParts([...catalogList, ...localOnly]);
  premiumMod.persistSavedParts();   // 오프라인에서도 마지막으로 받은 카탈로그를 쓸 수 있게 캐시
  // ★ Storage 이관 후속: 시작 시 파츠 rec.glb가 없어 부착 실패했던 좌석에 다시 시도.
  //   ★ 버그 수정(파츠 위치 초기화 + stackable 미부착):
  //   (1) 예전엔 equippedPartObjs[cat]만 보고 스킵했는데, stackable 파츠는 stackedPartObjs에 살아서
  //       가드를 통과 → 동기화 올 때마다 xf 없이 재장착돼 위치가 원점으로 리셋됐음.
  //   (2) 배열(cat에 stackable 여러 개) entry는 partEntryId(배열)=undefined라 rec를 못 찾아
  //       시작 시 재부착이 아예 안 되던 잠복 버그도 함께 수정 — entry 단위로 순회.
  seats.forEach(s=>{
    if(!s.charDef || !s.charDef.equippedParts) return;
    s.equippedPartObjs = s.equippedPartObjs || {};
    const _pending = [];   // 🦶 이번에 새로 붙은 파츠들 — 다 붙은 뒤 바닥을 다시 맞춘다
    for(const cat in s.charDef.equippedParts){
      premiumMod.entriesForCat(s.charDef, cat).forEach(entry=>{
        const id = premiumMod.partEntryId(entry);
        const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat);
        if(!rec) return;
        const attached = rec.stackable
          ? !!(s.stackedPartObjs && s.stackedPartObjs[cat] && s.stackedPartObjs[cat][id])
          : !!s.equippedPartObjs[cat];
        if(attached) return;
        _pending.push(equipPartOnSeat(s, cat, rec, { stackableXf: rec.stackable ? premiumMod.partEntryXf(entry) : null }));
      });
    }
    applyClothVisibility(s);
    /* 🦶 여기서 붙는 파츠도 바닥 맞춤을 받아야 한다.
       [경위] 이 경로는 **카탈로그(파츠 GLB)가 서버에서 늦게 도착했을 때** 뒤늦게 붙이는 자리다.
         부팅 때 fitModel 은 이미 지나갔고 그때는 욕조가 아직 없었으므로 발밑 깊이가 0 으로 측정됐다.
         그래서 보관함에 있던 발밑 파츠는 붙기는 붙는데 바닥에 파묻힌 채로 남았다
         (다른 이유로 fitModel 이 한 번 더 돌기 전까지 — 크기 슬라이더를 건드리면 그제야 맞았다).
       ★ 아무것도 새로 안 붙었으면 fitModel 을 부르지 않는다 — 이 함수는 카탈로그가 올 때마다
         돌기 때문에, 매번 재계산하면 좌석 전부의 크기·센터링이 이유 없이 다시 굴러간다. */
    if(_pending.length){
      Promise.all(_pending.map(p=>Promise.resolve(p).catch(()=>{}))).then(()=>{
        try{ if(s && s.gltfRoot){ fitModel(s); layoutSeats(); } }catch(_){}
      });
    }
    /* 🎩 [2026-08-29] **카탈로그가 늦게 와도 '위에 얹을 수 있음'이 반영되게 한다.** — 제보 대응

       [무엇이 났나] 파츠 위에 얹는 판정(_partAllowsRideTop)은 `savedParts` 의 `rec.rideTop` 을
         읽는데, 부팅 직후 savedParts 는 localStorage 캐시뿐이고 최신 플래그는 이 함수가
         카탈로그를 받아 통째로 갈아끼울 때 들어온다. 그런데 머리 꼭대기 실측은 mountRide 때
         **1회**뿐이라(_measureHostHeadTop), "좌석 조립 → 파츠 부착 → 동물 마운트"가 카탈로그
         도착보다 먼저 끝나면 `_headTopPart = null` 이 캐시로 굳는다.
         그 뒤 _applyRemoteRides 는 `seat.ridingOn === target` 이면 재실측을 건너뛰므로
         **그 세션 내내 파츠를 무시한 채 얹힌다.** 런처를 갔다 오면 좌석이 재조립되면서
         그때는 카탈로그가 이미 있으니 정상으로 보인다 — 제보 문구 그대로다.

       [왜 위쪽 재부착 루프로는 안 잡히나] 그 루프는 `if(attached) return;` 이라 **이미 붙어 있는
         파츠는 건너뛴다.** 즉 늦게 온 것이 GLB 가 아니라 **메타데이터(rideTop)뿐**인 이 경우에는
         equipPartOnSeat 이 한 번도 안 불리고, 그 안에 있는 재실측 훅도 같이 건너뛰어진다.

       ⇒ 좌석마다 한 번씩 직접 부른다. 아무도 안 타고 있으면 _remeasureRideHeadTop 이 즉시
         빠져나오므로(riders.length 검사) 비용이 없고, 측정에 실패하면 옛 값을 그대로 둔다.
       ⚠️ `_pending` 여부와 무관하게 부른다 — 새로 붙은 파츠 쪽은 equipPartOnSeat 이 이미
         책임지지만, 이 자리가 막으려는 것은 **아무것도 새로 안 붙는 경우**다. */
    try{ rideBenchMod._remeasureRideHeadTop(s); }catch(_){}
  });
  // ★ 런처 슬롯 미리보기도 다시 렌더 — 초기엔 savedParts에 rec.glb가 없어 파츠가 안 보였을 수 있음.
  //   지금 카탈로그가 도착했으므로 (rec.glbUrl로 Storage에서 받아올 수 있음) 미리보기 재빌드.
  const launcher = document.getElementById('launcher');
  if(launcher && launcher.classList.contains('on')){
    renderLauncher();
  }
  // 꾸미기창 미리보기도 열려있으면 재빌드
  const wdPanel = document.getElementById('wdPreviewPanel');
  if(wdPanel && wdPanel.classList.contains('on')){
    wardrobeMod.refreshWdPreviewChar();
  }
  wardrobeMod.renderWardrobe();
  /* 🎰 카탈로그가 도착한 지금이 미보유 가챠 파츠를 회수할 수 있는 **첫 순간**이다.
     [경위] 회수는 동기화가 끝나는 자리에서만 돌았는데, 그 자리는 부팅 4.2초로 고정이고
       savedParts 는 이 함수(구독 콜백 → resolveCatalogGlbAll 왕복)까지 와야 채워진다.
       즉 부팅 회수는 거의 항상 "카탈로그가 없어 물러남"으로 끝났고, 다음 기회는 10분 뒤
       tick 이었다. 그 사이 유저는 보관함에 없는 파츠를 화면에 달고 있게 된다 —
       잠긴 칸에는 onclick 이 없어 손으로 벗을 수도 없다(제보).
     ★ 서버를 아직 못 읽었으면 pruneUnownedGachaParts 가 스스로 물러난다(_gachaSrvSeen). */
  try{ gachaMod.pruneUnownedGachaParts(); }
  catch(e){ console.warn('[가챠] 카탈로그 도착 후 정리 실패', e); }
}
function subscribeCatalogParts(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCatalogParts) return;
  window.firebaseAPI.subscribeCatalogParts(async catalogObj=>{
    await resolveCatalogGlbAll(catalogObj);
    mergeCatalogIntoSavedParts(catalogObj);
    /* 🎰 이관 과도기 — catalog/parts 에 gacha:true 로 남은 옛 항목(_legacyGacha 표식)이 보이면
       관리자 세션이 gachaParts 로 옮긴다. 옮기기 전까지는 구버전 클라이언트가 그 파츠를 계속
       받아서 뽑지 않고 낀다(제보의 그 증상) — 관리자가 새 판본으로 한 번 접속하면 끝난다.
       ⚠️ isAdmin 게이트: 규칙상 누구나 쓸 수는 있지만, 일반 유저 기기가 조용히 카탈로그를
         옮기게 두지 않는다. 멱등이라 관리자 기기가 여럿이어도 안전하다. */
    if(isAdmin && !window.__gachaMigrated && window.firebaseAPI.migrateGachaCatalog
       && Object.keys(catalogObj||{}).some(id=>catalogObj[id] && catalogObj[id]._legacyGacha)){
      window.__gachaMigrated = true;   // 콜백이 연달아 와도 한 번만
      window.firebaseAPI.migrateGachaCatalog()
        .then(r=>{ if(r && r.moved && r.moved.length) toast('🎰 가챠 파츠 '+r.moved.length+'개를 새 카탈로그 경로로 옮겼어요 (구버전 노출 차단)'); })
        .catch(()=>{ window.__gachaMigrated = false; });   // 실패하면 다음 콜백에서 재시도
    }
  });
}
if(window.firebaseAPI) subscribeCatalogParts();
else window.addEventListener('firebase-ready', subscribeCatalogParts, { once:true });
// ★ Phase 3: 커스텀 서브카테고리 구독 — Firebase에서 실시간으로 받아 PART_CATS에 병합.
function subscribeCustomCats(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCustomCats) return;
  window.firebaseAPI.subscribeCustomCats(catObj=>{
    premiumMod.setCustomPartCats(Object.keys(catObj||{}).map(k=>catObj[k]).filter(c=>c && c.cat));
    premiumMod.rebuildPartCats();
    wardrobeMod.renderWardrobe();
    if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();
  });
}
// 기본 카테고리 이름 덮어쓰기 구독 (예: 망토 → 겉옷)
function subscribeCatOverrides(){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeCatOverrides) return;
  window.firebaseAPI.subscribeCatOverrides(obj=>{
    premiumMod.setPartCatOverrides(obj || {});
    premiumMod.rebuildPartCats();
    wardrobeMod.renderWardrobe();
    if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();
  });
}
if(window.firebaseAPI){ subscribeCustomCats(); subscribeCatOverrides(); }
else window.addEventListener('firebase-ready', ()=>{ subscribeCustomCats(); subscribeCatOverrides(); }, { once:true });
/* ═══ 🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기 ═══ */
/* 🩹 [2026-10-02 제보 #11] «부팅 직후 첫 실행에서 가끔 책상 위 오브젝트가 죄그매진다 — 런처 갔다 오면 회복»
   [원인] 캐릭터를 좌석·런처·생성기에 올리는 세 경로가 def.customItems 의 아이템을
     `registerCustomItem(id, name, glb, scene, '', animations)` 로 **크기(defaultSize) 없이** 등록한다 → 0.8 로 고정.
     카탈로그 동기화가 나중에 올바른 값으로 다시 등록해도, 좌석 재적용이 그 등록보다 먼저 돌면 틀린 크기가 남았다.
     부팅 직후엔 디스크·네트워크가 느려 이 순서가 뒤집히기 쉽다 — «가끔, 부팅 직후» 의 정체.
   [대응] ① 인자로 안 온 메타값(크기·부착 위치·재생 모드·빛·라이선스)은 **같은 id 의 카탈로그 레코드(savedItems)**
     에서 채운다. savedItems 는 GLB 를 뺀 채 localStorage 에 남아 있어 부팅 직후에도 메타는 있다.
     ② mergeCatalogIntoSavedItems 가 등록을 **기다린 뒤** 좌석을 다시 적용한다(아래).
   ⚠️ 인자로 온 값이 우선이다 — 기존 호출부(loadSavedItemsIntoSession 등)는 동작이 그대로다. */
function _savedItemMeta(id){
  try{ return Array.isArray(commissionMod.savedItems()) ? (commissionMod.savedItems().find(r=>r && r.id === id) || null) : null; }
  catch(_){ return null; }   // savedItems 선언(let) 전에 불리는 경우
}
function registerCustomItem(id,name,glbB64,template,icon,animations,attachTo,autoPlay,defaultSize,glow,licenseOnly,playMode){
  { const _m = _savedItemMeta(id);
    if(_m){
      if(attachTo == null)    attachTo = _m.attachTo;
      if(autoPlay == null)    autoPlay = _m.autoPlay;
      if(defaultSize == null) defaultSize = _m.defaultSize;
      if(glow == null)        glow = _m.glow;
      if(licenseOnly == null) licenseOnly = _m.licenseOnly;
      if(playMode == null)    playMode = _m.playMode;
      if(!icon && _m.icon)    icon = _m.icon;
    } }
  customItems[id]={id,name,glb:glbB64,custom:true,icon:icon||'',
  attachTo: attachTo||'desk',   // 'desk'(기본, 책상 위) | 'handL' | 'handR' — equipDeskItem에서 부착 위치 결정에 사용
  autoPlay: !!autoPlay,   // true면 클릭 없이 장착되자마자 애니메이션 자동 반복재생 (하위호환용)
  playMode: playMode || (autoPlay ? 'auto' : 'click'),   // 어플 8: 'click' | 'auto' | 'idle'
  defaultSize: (defaultSize!=null) ? defaultSize : 0.8,   // 장착됐을 때 기본 크기 — 관리자가 등록 시 설정(기본 0.8)
  glow: !!glow,   // true면 옆에 은은한 원형 빛 스프라이트 추가
  licenseOnly: !!licenseOnly,   // true면 라이선스 보유자(isPremium)나 관리자만 장착 가능
  animations: animations||[],
  // ★ 본(스켈레톤)이 있는 모델은 일반 clone(true)으로 복제하면 스켈레톤 연결이 깨져서(THREE.js 알려진 문제)
  //   바운딩박스/애니메이션이 잘못 계산됨 — 캐릭터 로드 때처럼 SkeletonUtils.clone()을 써야 정확함.
  build:()=>{const c=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(template):template.clone(true);
    c.traverse(n=>{ if(n.isMesh){ n.castShadow=true;
      // ★ 공유 material 문제 해결: THREE.js clone(true)/SkeletonUtils.clone은 mesh는 복제하지만 material은 참조 공유함 →
      //   같은 template에서 생긴 아이템(내 것, 친구 것)이 material을 공유해 한쪽에서 _col 색상 바꾸면 다른 좌석에도 반영되는 버그.
      //   각 인스턴스가 자기만의 material을 갖도록 여기서 clone.
      if(n.material){
        if(Array.isArray(n.material)){
          n.material = n.material.map(m => (m && m.clone) ? m.clone() : m);
        } else if(n.material.clone){
          n.material = n.material.clone();
        }
      }
      // ★ 텍스처 없는 아이템이 조명/노출/밝기를 안 먹는 것처럼 보이던 문제(요청사항 어플10) —
      //   glTF 스펙상 metallicFactor 기본값이 1.0이라, 재질 설정 없이 내보낸 GLB는 metalness=1(완전 금속)로
      //   로드됨. 금속 재질은 확산광을 반사하지 않아 환경맵 없는 씬에서는 어둡고 조명 반응이 없어 보임.
      //   ★ 이 보정은 이제 _fixGlbMetalness 한 곳에 있고 캐릭터·파츠·책상도 같은 것을 쓴다.
      //     예전엔 여기서만, 그것도 텍스처 없는 재질에만 걸어서 "아이템 화이트와 캐릭터 화이트가 다르다"가 났다.
      if(n.material){
        const mats=Array.isArray(n.material)?n.material:[n.material];
        //   캐릭터·파츠·책상과 같은 톤 기준으로 정규화 — GLB 가 담아 온 emissive 와 금속도를 덮어쓴다.
        mats.forEach(m=>_applyItemMatTone(m));
      }
    }});
    return c;}}; }
/* 현재 활성 책상의 저장 ID (기본 책상이면 null) — 카드 on 표시용 */
let activeCustomDeskId=null;
/* 저장된 모든 아이템 코드를 customItems에 등록 (생성기 진입 시 호출) */
async function loadSavedItemsIntoSession(){
  for(const rec of commissionMod.savedItems()){
    // ★ 이미 등록돼 있어도 건너뛰지 않고 항상 다시 불러옴 — 카탈로그에서 GLB가 교체됐을 때
    //   (관리자가 우클릭 수정 등) customItems가 옛날 것으로 캐시된 채 남아있으면 실시간 반영이 안 됨.
    try{ const buf=b64ToBuf(rec.glb); const {scene,animations}=await assetCodeMod.parseGlbFull(buf);
      registerCustomItem(rec.id, rec.name, rec.glb, scene, rec.icon||'', animations, rec.attachTo, rec.autoPlay, rec.defaultSize, rec.glow, rec.licenseOnly, rec.playMode);
    }catch(_){}
  }
}
function allDeskItems(){
  // customItems를 먼저 배치해서 .find(id)가 커스텀을 먼저 찾게 함 — 관리자가 기본 아이템(plant/cup/books)과
  // 같은 id로 카탈로그에 등록하면(우클릭 수정), 기본 대신 그 커스텀 GLB가 실제로 쓰이게 됨(진짜 "교체").
  const custom=Object.values(customItems);
  const overridden=new Set(custom.map(c=>c.id));
  return custom.concat(DESK_ITEMS.filter(d=>!overridden.has(d.id)));
}
function deskItemDef(id){ return allDeskItems().find(d=>d.id===id)||null; }
/* 커스텀 책상: 기본 책상 메쉬를 숨기고 커스텀 GLB로 교체(앵커는 그대로) */
// ★ 요청에 따라 자동 크기 보정(폭 1.7에 맞춰 리사이징하던 로직)을 완전히 제거함.
//   블렌더에서 내보낸 크기(가로/세로/높이) 그대로 사용 — 앱이 임의로 다시 스케일링하지 않음.
//   전체적인 크기 조절은 오직 "책상 크기" 슬라이더(setDeskScale, deskGroup 전체 스케일)로만 함.
//   여기서는 위치만 보정: 바닥 중앙(X,Z)에 오도록 정렬 + 피벗을 바닥에 맞춤.
function normalizeDeskObj(obj){ obj.scale.set(1,1,1); obj.position.set(0,0,0); obj.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(obj); const c=box.getCenter(new THREE.Vector3());
  obj.position.x+=(0-c.x); obj.position.z+=(0.6-c.z); 
  // 피벗은 바닥, 메쉬만 0.15만큼 올리기 (수치 조절 가능)
  obj.position.y+=(0-box.min.y) + 0.15; 
  return obj; }
// ★ 새 책상 GLB 자동 크기 정규화 — 유저가 Blender에서 어떤 크기로 export하든 이 폭에 맞춰 스케일 조정.
//   기본 책상 오버라이드(__default_desk__)와 대략 동일한 폭이 되게 3.0을 목표로 잡음.
//   유저가 "너무 크다/작다"고 느낄 여지가 있는 값은 관리자가 등록 시 크기 슬라이더로 재조정 가능.
const DESK_TARGET_WIDTH = 3.0;
function autoScaleDeskToTarget(obj){
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.z, 0.001);   // 폭(넓이) 기준 — 책상은 x/z 평면
  if(!isFinite(maxDim) || maxDim <= 0) return 1;
  return DESK_TARGET_WIDTH / maxDim;
}
// ★ 새로 등록하는 책상들에만 적용되는 크기 배율. "기본 책상"으로 등록해둔 오버라이드(__default_desk__)는
//   이미 지금 크기가 딱 맞다고 확인됐으므로 절대 이 배율의 영향을 받지 않음(swapDeskVisual의 isDefaultOverride 인자로 구분).
const DESK_SIZE_OFFSET = 1.3;   // 새로 등록하는 책상들의 크기 배율 — 1보다 크면 더 크게. 필요하면 이 숫자만 조절
function swapDeskVisual(deskGroup,template,isDefaultOverride,animations,playMode){ if(!deskGroup)return;
  const prev=deskGroup.getObjectByName('customDesk'); if(prev)deskGroup.remove(prev);
  // 이전 책상에 애니메이션 mixer가 있었으면 해제
  if(deskGroup.userData.deskMixer){ activeItemMixers.delete(deskGroup.userData.deskMixer); deskGroup.userData.deskMixer=null; }
  if(deskGroup.userData.deskIdlePivot){ _idleItemPivots.delete(deskGroup.userData.deskIdlePivot); deskGroup.userData.deskIdlePivot=null; }
  const defaults=deskGroup.children.filter(ch=>ch.name!=='deskAnchor'&&ch.name!=='customDesk');
  if(template){ const obj=template.clone(true); obj.name='customDesk';
    const mats=[];
    // ★ 책상 material도 캐릭터와 동일한 flat 조명 처리 —
    //   단, 텍스처(map) 있는 mesh에만 emissive 적용. _col처럼 map 없는 solid-color mesh는 emissive 넣으면
    //   씬 조명 + emissive가 합쳐져서 과도하게 밝아 보임(요청사항: _col은 emissive 빼거나 조정).
    obj.traverse(n=>{ if(n.isMesh){ n.castShadow=true; if(n.material){
      n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();
      const mList = Array.isArray(n.material) ? n.material : [n.material];
      // 톤 규칙은 _applyItemMatTone 한 곳에서만 정한다(아이템과 공용) —
      //   텍스처 있는 mesh: emissiveMap + emissive 로 flat 조명(캐릭터와 톤 통일)
      //   solid mesh (_col 포함): emissive 0 — 씬 조명이 자연스럽게 shading함
      mList.forEach(m=>_applyItemMatTone(m));
      if(/_col$/i.test(n.name)){ mList.forEach(m=>mats.push(m)); }
    } } });
    deskGroup.userData.customMats=mats;
    normalizeDeskObj(obj);
    // ★ 옛날엔 새 책상만 autoScaleDeskToTarget + DESK_SIZE_OFFSET(1.3)로 크기를 강제 조정했는데,
    //   기본 책상은 그 로직을 안 타서 "블렌더에서 같은 크기로 만들었는데 새 책상만 크기 다름" 문제 발생.
    //   이제 새 책상도 GLB 원본 크기 그대로 사용 — 기본 책상과 동일 취급.
    //   사용자가 크기 조정 원하면 실행 화면 캐릭터 우클릭 → 책상 크기 슬라이더로 조정 가능.
    deskGroup.add(obj); defaults.forEach(m=>m.visible=false);
    // ★ 책상 GLB에 애니메이션이 있고 playMode가 지정돼 있으면 아이템과 동일한 방식으로 mixer 설정
    if(animations && animations.length && playMode){
      const mixer = new THREE.AnimationMixer(obj);
      const idleClip = animations.find(c=>/idle/i.test(c.name)) || animations[0];
      const action = mixer.clipAction(idleClip);
      deskGroup.userData.deskMixer = mixer;
      deskGroup.userData.deskIdleAction = action;
      deskGroup.userData.deskPlayMode = playMode;
      if(playMode==='auto'){
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        activeItemMixers.add(mixer);
      } else if(playMode==='idle'){
        action.setLoop(THREE.LoopRepeat, Infinity);
        // updateIdleItemPlayback가 pivot.userData.holder를 참조 — 현재 좌석(deskGroup.userData.__seat)을 넘겨줌.
        //   (swapDeskVisual 호출 전에 caller가 __seat을 세팅해야 함)
        const idlePivot = { userData:{ idleAction: action, itemMixer: mixer, holder: deskGroup.userData.__seat } };
        deskGroup.userData.deskIdlePivot = idlePivot;
        _idleItemPivots.add(idlePivot);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
    }
  } else { deskGroup.userData.customMats=null; defaults.forEach(m=>m.visible=true); } }
function applyDeskColorToCustom(deskGroup,color){ const mats=deskGroup&&deskGroup.userData&&deskGroup.userData.customMats;
  // ⚠️ color.set 만 하면 emissive 가 옛 색으로 남아 밝고 뿌옇게 나온다 — _setDeskMatColor 주석 참고.
  if(mats)mats.forEach(m=>_setDeskMatColor(m, color)); }
// ★ 어플 3-1: 책상 길이(X축) 슬라이더 지원 — deskGroup.scale에서 X만 lenX배로 더 늘리거나 줄임.
//   기존 uniform scale은 그대로 유지되므로 기존 저장 데이터/코드 호환.
//   ★ 책상 위 아이템(deskAnchor 자식)은 같이 늘어나면 안 되므로 deskAnchor에 역스케일(1/lenX)을 걸어서
//     책상만 X로 늘어나고 아이템 크기/위치는 그대로 유지되게 함(요청사항).
function setDeskScale(deskGroup,scale,lenX){ if(!deskGroup) return;
  // 🐾 동물 좌석은 책상도 캐릭터와 같은 비율(ANIMAL_RUN_SCALE = 40%)로 축소 —
  //   applyCharToSeat가 seat.desk.userData.animCorr에 심어둠.
  //   ⚠️ 이 주석은 예전에 "60%"라고 적혀 있었다. 코드는 처음부터 ANIMAL_RUN_SCALE(0.4)이었다 —
  //     숫자를 여기 적지 말고 상수를 보라. 그 낡은 숫자 때문에 꾸미기 미리보기의 비율 검토가
  //     한 번 잘못됐다(아래 참고).
  //   곱셈을 여기 한 곳에서 하는 이유: 좌석 책상 적용 경로가 기본 책상·카탈로그 책상·커스텀 GLB로 나뉘고
  //   일부는 비동기라, 호출처마다 붙이면 반드시 빠지는 곳이 생김. 생성기(cDesk)·런처(lHolder.desk)는
  //   animCorr가 없으므로 1 — 즉 생성기는 동물 100%+책상 100%, 실행은 40%+40%로 비율이 일치함.
  //   ★ 예외: 꾸미기/보관함 미리보기(_wdDeskGrp)는 이 함수를 타지 않고, 캐릭터가 40%로 들어오므로
  //     그쪽에서 ANIMAL_RUN_SCALE을 직접 곱한다(refreshWdPreviewChar의 _wdAnim). 규약이 다르다.
  /* ⚠️ scale 을 안 주고 부르는 경우가 있다(평준화 재적용). 그때 (scale||1) 로 읽으면 모르는 값이
       1 로 굳어 책상이 통째로 커진다 — 아래 deskScaleBase 저장까지 같이 1 로 덮여 원본이 영영 사라진다.
       안 주면 **기억해둔 원본**을 쓰고, 그것도 없으면 1(첫 호출이라 달리 알 길이 없다). */
  const _base = (scale != null) ? scale : deskGroup.userData.deskScaleBase;
  const s = (_base||1) * (deskGroup.userData.animCorr || 1) * (deskGroup.userData.eqK || 1);
  const lx = (lenX!=null) ? lenX : (deskGroup.userData.deskLenX || 1);
  deskGroup.scale.set(s*lx, s, s);
  deskGroup.userData.deskLenX = lx;
  /* 🪑 평준화가 켜지고 꺼질 때 def 없이도 다시 걸 수 있게 '원래 크기'를 기억해 둔다
     (syncSeatEqualize 가 이 값으로 재호출한다). 호출부 다섯 곳이 저마다 다른 곳에서 deskScale 을
     꺼내 오기 때문에, 되돌릴 값을 여기 한 곳에 남기는 편이 안전하다.
     ⚠️ scale 을 안 받은 호출(평준화 재적용)에서는 **갱신하지 않는다.** 그때 쓴 값은 원본이 아니라
     여기 기억해둔 값 자신이고, 모르는 상태(undefined)를 1 로 굳히면 되돌릴 원본이 사라진다. */
  if(scale != null) deskGroup.userData.deskScaleBase = (scale||1);
  const anchor = deskGroup.userData.deskAnchor;
  if(anchor){ anchor.scale.set(1/lx, 1, 1); }   // 아이템은 부모의 X 스트레치를 상쇄
  /* 🐾 앞뒤 보정도 여기서 다시 건다 — `animCorr`·`eqK` 가 화면에 반영되는 **유일한 길목**이
     이 함수다(applyCharToSeat 가 userData 에 심어두면 여기서 처음 곱해진다). 캐릭터에서 뺀
     배율의 몫이 곧 책상의 z 이므로, 배율이 바뀌는 순간 z 도 함께 바뀌어야 한다.
     📌 파츠 핀의 상쇄량은 **배율로 나눈 값**이라 크기가 바뀌면 같이 다시 계산해야 한다 —
       syncSeatDeskZ 가 끝에서 syncDeskPartAnchor 를 부르므로 그 줄이 여기에 흡수됐다.
       (예전엔 여기서 syncDeskPartAnchor 를 직접 불렀다. 빠지면 책상 크기 슬라이더를
        만지는 순간 파츠만 어긋난다.) */
  syncSeatDeskZ(deskGroup);
}
// ★ 어플 9 (미리보기가 정답 기준으로 확정된 뒤로) 이 시각 보정은 제거됨 — 미리보기와 실행 화면이
//   동일한 setDeskScale 공식을 쓰게 두는 것이 옳음. 이 상수를 예전엔 1.2로 두어 미리보기 책상을
//   실행보다 20% 크게 그렸는데, 그 결과 "실행 화면이 미리보기보다 작다"는 인식이 생김.
const CREATOR_DESK_VISUAL_OFFSET = 1;
function setCreatorDeskScale(scale){ setDeskScale(cDesk, (scale||1) * CREATOR_DESK_VISUAL_OFFSET, cDeskLenX); }
/* ═══ 📌 책상 위 파츠 앵커 · 책상 위치 · 배율 ═══ */
/* 🪑📌 '책상 위' **파츠**가 붙는 자리 — deskAnchor 안의 작은 자식 하나.
   [무엇을 푸는가] 생성기에서 책상 위치 기즈모로 책상을 옮기면 파츠보관함의 '책상 위' 파츠까지
     따라 움직였다(제보). 파츠의 자리는 보관함 상세조정(xf)에서만 정하고 싶다는 요청이다.
   [어떻게] 파츠를 deskAnchor 대신 이 핀에 붙이고, 핀의 로컬 좌표로 **책상 위치 오프셋만**
     정확히 상쇄한다. 결과적으로 파츠의 월드 자리는 deskPos 와 무관해진다.
   ★ 위치 상쇄만이 아니라 **크기 상쇄도 한다** — 아래 '크기' 절 참고.
   ★ 책상 위 **아이템(소품)** 은 예전 그대로 deskAnchor 에 붙어 책상을 따라간다 — 소품은
     생성기 아이템 기즈모로 책상 기준으로 놓는 물건이라 규약이 다르다.
   ⚠️ deskPos 가 0 이고 책상 크기가 기본값이면 **예전과 완전히 같은 화면**이다. 이미 책상을 옮겨
     두거나 크기를 바꿔 두고 그 위에 파츠를 얹어 둔 사람만 파츠가 옛 자리·옛 크기에 남는다 —
     보관함에서 한 번 다시 잡아야 한다. 이 변경의 유일한 대가다.

   ── 크기 ──────────────────────────────────────────────────────
   [무엇을 푸는가] 생성기에서 책상 크기 슬라이더를 움직이면 '책상 위' 파츠까지 같이 커지고
     작아졌다. 파츠 크기는 보관함 상세조정(xf)에서만 정하고 싶다는 요청이다.
   ⛔ 폐기된 지침 — 예전 주석: "상쇄만 한다 — 크기는 그대로 물려받는다. 그것까지 끊으면 책상 위
     파츠가 책상과 다른 배율로 떠서 완전히 다른 사고가 된다."
     그 경고 자체는 옳다. 다만 그것은 **배율을 통째로 1 로 끊는 경우**의 이야기다 —
     슬라이더 값이 곧 책상 그룹의 배율이라(범위 0.05~0.3, 기본 0.175) 통째로 끊으면 파츠가
     약 5.7 배로 커진다. 그건 이미 겪은 사고다(refreshWdPreviewChar 주석의 "미리보기에서는
     엄청나게 큰데 실제 화면에서는 정상").
   [해법] 통째로가 아니라 **기본값에서 움직인 몫만** 끊는다: ratio = 기본값 / 슬라이더값.
     ・슬라이더가 기본값이면 ratio = 1 → **화면이 한 픽셀도 안 바뀐다**(대부분의 사용자).
     ・책상을 절반으로 줄이면 ratio = 2 → 파츠는 기본 크기를 유지한다.
   ★ animCorr(동물 40%)·eqK(평준화)·lx(책상 길이)는 **그대로 물려받는다.** 그건 사용자가 정한
     '책상 크기'가 아니라 좌석 규약이 거는 배율이다. 여기서 같이 끊으면 동물 좌석에서만
     파츠가 2.5 배로 뜬다 — 그게 위 ⛔ 경고가 말한 '완전히 다른 사고'다.
   ★ 위치도 같은 비율로 함께 산다 — pin.scale 은 자식의 로컬 좌표(파츠 xf)에도 걸리므로,
     책상을 줄여도 파츠가 얹혀 있던 자리에 그대로 머문다. 크기만 지키고 자리는 따라가면
     파츠가 책상 밖으로 밀려나므로 이쪽이 맞다.
   ⚠️ deskScaleBase 는 setDeskScale 이 심는다. 그 경로를 안 타는 화면(꾸미기/보관함 미리보기)은
     자기가 직접 심어 둔다 — 없으면 ratio = 1 이라 조용히 예전 동작으로 떨어진다. */
const DESK_PART_ANCHOR_NAME = '__deskPartAnchor';
/* 🪑 좌석 크기 평준화를 켜면 «책상 위» 파츠가 옆 좌석으로 넘어가지 않게 자기 자리 안으로 민다(seat-slot.js 머리말).
   자리 = 책상이 뻗은 거리(seatDeskHalfWidth) + 좌석 사이 여백(layoutSeats 와 같은 값)의 절반.
   책상 · 파츠 박스를 재야 해서 매 프레임이 아니라 SEAT_SLOT_EVERY_MS 마다 — 평준화를 끄면 다음 차례에 되돌아간다. */
const SEAT_SLOT_EVERY_MS = 500;
const seatSlot = (typeof SeatSlot === 'undefined') ? null : SeatSlot.createSeatSlot({ THREE });
let _seatSlotNext = 0;
function _clampSeatDeskParts(now){
  if(!seatSlot) return;
  const t = (now != null) ? now : performance.now();
  if(t < _seatSlotNext) return;
  _seatSlotNext = t + SEAT_SLOT_EVERY_MS;
  const gap = seats.some(s=>s.remote) ? MULTIPLAYER_SPACING : SPACING;
  seats.forEach(s=>{
    try{
      const pin = s.deskAnchor && s.deskAnchor.getObjectByName && s.deskAnchor.getObjectByName(DESK_PART_ANCHOR_NAME);
      if(!pin) return;
      const parts = pin.children.filter(o=>o.userData && o.userData.__twPartWrap);
      if(!parts.length) return;
      // 올라탄 좌석은 책상이 숨고 자리도 안 차지한다(layoutSeats) — 가두지 않는다
      const on = !!(seatEqualizeOn && !s.ridingOn && s.desk && s.desk.visible !== false);
      const half = on ? seatDeskHalfWidth(s) + gap / 2 : 0;
      seatSlot.clampParts(parts, s.group ? s.group.position.x : 0, half, on);
    }catch(e){ console.warn('[좌석 자리] 파츠 가두기 실패', e); }
  });
}
function syncDeskPartAnchor(deskGroup){
  if(!deskGroup) return;
  const anchor = (deskGroup.userData && deskGroup.userData.deskAnchor)
              || (deskGroup.getObjectByName && deskGroup.getObjectByName('deskAnchor'));
  if(!anchor || !anchor.getObjectByName) return;
  const pin = anchor.getObjectByName(DESK_PART_ANCHOR_NAME);
  if(!pin) return;                       // 아직 파츠가 안 붙었다 — 만들 때 여기로 다시 온다
  /* 📐 크기 상쇄 — 슬라이더가 기본값에서 움직인 몫만 되돌린다(위 '크기' 절).
     ⚠️ 위치 상쇄보다 **먼저** 건다. 아래에는 deskPosBase 가 없을 때의 이른 return 이 있는데,
       크기를 그 뒤에 걸면 '책상을 한 번도 안 옮긴 사람'만 크기 상쇄를 못 받는다. */
  const _sBase = deskGroup.userData && deskGroup.userData.deskScaleBase;
  /* ⚠️ 슬라이더 범위 밖의 값은 **손대지 않는다**(ratio = 1 = 예전 동작).
       호출부 여러 곳이 `def.deskScale||1` 로 폴백하는데, 그 1 은 '기본 크기'가 아니라
       '값을 모른다'는 뜻이다(기본은 DESK_SCALE_DEFAULT = 0.175). 그걸 슬라이더 값으로 믿고
       상쇄하면 파츠가 0.175 배로 쪼그라든다. 범위 안일 때만 = 슬라이더가 실제로 정한 값일 때만 건다. */
  const _ratio = (typeof _sBase === 'number' && isFinite(_sBase)
                  && _sBase >= DESK_SCALE_MIN && _sBase <= DESK_SCALE_MAX)
               ? (DESK_SCALE_DEFAULT / _sBase) : 1;
  pin.scale.set(_ratio, _ratio, _ratio);
  const b = deskGroup.userData && deskGroup.userData.deskPosBase;
  if(!b){ pin.position.set(0,0,0); return; }
  /* 상쇄할 양은 **책상이 실제로 옮겨간 월드 거리**다 = base × (setDeskPos 가 곱한 배율).
     ⚠️ 여기서 `userData.eqK` 를 직접 읽지 말 것 — setDeskPos 가 곱하는 값과 한 글자라도
       갈리면 그 차이만큼 파츠가 책상을 따라 움직인다. animCorr 을 더할 때 실제로 그랬다. */
  const k = seatDeskPosMul(deskGroup);
  /* 부모 사슬의 배율로 나눠야 로컬 이동량이 된다. 사슬은 책상 그룹(s·lx) → 앵커(1/lx) 둘뿐이고
     회전은 없다 — 그래서 성분별 나눗셈으로 정확히 상쇄된다(둘을 곱하면 lx 가 약분돼 s 만 남는다). */
  const sx = (deskGroup.scale.x || 1) * (anchor.scale.x || 1);
  const sy = (deskGroup.scale.y || 1) * (anchor.scale.y || 1);
  const sz = (deskGroup.scale.z || 1) * (anchor.scale.z || 1);
  pin.position.set(-(+b.x||0)*k/(sx||1), -(+b.y||0)*k/(sy||1), -(+b.z||0)*k/(sz||1));
}
/* 파츠를 붙일 핀을 얻는다(없으면 만든다). 좌석·생성기·런처·꾸미기 미리보기가 전부 이 길로 온다 —
   holder 마다 만들어 두지 않고 여기서 지연 생성하는 이유는, 앵커를 만드는 자리가 네 군데라
   하나만 빠뜨려도 그 화면에서만 파츠가 사라지기 때문이다. */
function deskPartAnchorOf(seat){
  const anchor = seat && seat.deskAnchor;
  if(!anchor) return null;
  let pin = anchor.getObjectByName && anchor.getObjectByName(DESK_PART_ANCHOR_NAME);
  if(!pin){
    pin = new THREE.Group();
    pin.name = DESK_PART_ANCHOR_NAME;
    anchor.add(pin);
  }
  syncDeskPartAnchor(anchor.parent);   // 앵커의 부모가 곧 책상 그룹이다
  return pin;
}

/* 🪑 책상 위치 — 좌석 원점(캐릭터 발밑) 기준 오프셋.
   ★ 크기(setDeskScale)와 **따로** 둔다. 스케일은 deskGroup.scale 을 건드리고 여기는 position 만
     건드리므로 서로 안 밟는다. 둘을 한 함수로 합치면 호출처마다 다른 쪽 값을 같이 넘겨야 해서
     반드시 한 군데를 빠뜨린다(deskLenX 가 실제로 그랬다).
   ⚠️ 책상 위 **아이템(소품)** 은 deskAnchor 의 자식이라 **저절로 같이 따라온다.**
     여기서 따로 옮기지 말 것 — 옮기면 두 번 더해진다.
   📌 '책상 위' **파츠**는 반대로 따라오면 안 된다 — 아래 syncDeskPartAnchor 가 상쇄한다. */
function setDeskPos(deskGroup, pos){
  if(!deskGroup) return;
  const p = pos || {};
  /* 🪑 위치 오프셋도 크기와 **같은 배율**을 지나야 한다(seatCharZ 의 그 이유와 같다).
     책상을 옮겨둔 사람만 평준화에서 그 오프셋이 원래 크기로 남아 캐릭터와의 거리가 어긋난다.
     ★ 되돌릴 원본은 여기 기억해 둔다 — setDeskScale 의 deskScaleBase 와 같은 규약이고,
       syncSeatEqualize 가 k 가 바뀔 때 이 값으로 다시 건다.
     ★ 생성기(cDesk)·런처(lHolder.desk)는 animCorr·eqK 가 없어 곱셈이 1 — 예전과 완전히 같다.

     🐾 [제보] **동물 캐릭터를 책상 기즈모로 옮기면 실행 화면에서 더 뒤로 가 있었다.**
       '같은 배율'이 여기서 **eqK 하나뿐**이었던 것이 원인이다. 크기 쪽(setDeskScale)은
       `animCorr × eqK` 둘 다 지나는데 위치만 eqK 만 지났다 → 동물 좌석은 캐릭터 40% ·
       책상 40% 인 세계인데 **옮긴 양만 100% 단위로** 들어가 화면에서 정확히 2.5배가 됐다.
       (실측: deskPos.z = −0.2 → 생성기 간격 0.270 인데 실행은 환산 −0.030 = 책상이 캐릭터 뒤로 넘어감.
        어긋남 = 1.5 × deskPos. **deskPos 가 0 인 좌석에서만 0** 이라 여태 안 보였다.)
     ★ 이 곱셈이 들어오면 실행 간격이 정확히 `animCorr × eqK ×` 생성기 간격이 된다 —
       좌석 전체가 그 배율로 줄어든 세계이므로 이게 맞는 값이다(syncSeatDeskZ 의 유도 참고).
     ⚠️ 배율은 **base 에 굽지 않는다.** deskPosBase 는 언제나 생성기가 정한 100% 단위 원본이고,
       화면 값만 여기서 곱한다. 구우면 열 때마다 0.4 가 누적돼 책상이 캐릭터에 붙는다.
     ⚠️ 이 곱셈은 **네 자리가 한 벌**이다 — 여기 · syncSeatDeskZ · syncDeskPartAnchor(상쇄) ·
       꾸미기 미리보기(_wdDeskGrp 의 deskPos 세 줄). 하나만 고치면 파츠만 어긋난다. */
  const base = { x:+p.x||0, y:+p.y||0, z:+p.z||0 };
  deskGroup.userData.deskPosBase = base;
  const k = seatDeskPosMul(deskGroup);
  deskGroup.position.set(base.x*k, base.y*k, base.z*k);
  /* 🐾 z 만은 여기서 끝나지 않는다 — 캐릭터에서 뺀 배율의 몫이 얹힌다. syncSeatDeskZ 가
     position.z 를 다시 쓰고 파츠 상쇄(syncDeskPartAnchor)까지 이어서 한다. */
  syncSeatDeskZ(deskGroup);
}
/* 🐾🪑 캐릭터에서 뺀 배율(동물 0.4 · 평준화 k)의 **몫을 책상이 대신 진다**.

   [무엇을 푸는가] seatCharZ 주석 참고 — 좌석마다 다른 깊이에 서면 발선이 갈린다.
     그래서 캐릭터는 CHAR_Z 로 고정하고, 그때 잃은 간격을 책상을 옮겨서 되찾는다.

   [공식] 간격은 그대로 두고 기준만 옮긴다.
       옛 간격 = deskZ_old − CHAR_Z·a·k = base.z·a·k − CHAR_Z·a·k
       새 간격 = deskZ_new − CHAR_Z
     둘이 같으려면   deskZ_new = base.z·a·k + CHAR_Z·(1 − a·k)
                                              └─ 보정항 ─┘
     ★ 정리하면 **실행 간격 = a·k × (base.z − CHAR_Z) = a·k × 생성기 간격.** 좌석 전체가 a·k 로
       줄어든 세계이므로 이 형태가 맞다는 것이 눈으로 확인된다(그 검산이 sim-char-z §3 이다).
     🐾 base.z 의 `a` 는 나중에 붙었다 — 예전엔 `base.z·k` 였고, 그래서 책상을 옮겨둔 **동물**
       좌석만 옮긴 양이 2.5배로 들어갔다(setDeskPos 의 제보 주석 참고). deskPos 가 0 이면
       두 식이 같으므로 그때까지 아무에게도 안 보였다.
   ★ **사람 + 평준화 꺼짐(a=1·k=1) 이면 보정항이 정확히 0** — 가장 흔한 경우는 한 픽셀도
     안 움직인다. 이 성질이 이 변경의 안전판이다. 회귀가 나면 동물이거나 평준화가 켜진 좌석뿐이다.
   ★ 생성기(cDesk) · 런처(lHolder.desk) 는 animCorr·eqK 가 아예 없어 보정항이 0 이다 —
     예전과 완전히 같은 화면이다. 그래서 "실행이 생성기 규약으로 합류하는 것"이지
     생성기가 바뀌는 게 아니다.

   ⚠️ **deskPosBase 를 절대 건드리지 않는다.** 보정항은 파생값이고, base 에 더하면 유저가
     옮겨둔 값에 보정이 누적 저장되어 열 때마다 책상이 더 밀린다
     (setDeskScale 의 deskScaleBase 가 같은 이유로 조심스럽게 짜여 있다 — 그 주석 참고).
   ⚠️ base 가 아직 없으면서 보정항도 0 이면 **position.z 를 아예 안 건드린다.**
     기즈모 드래그처럼 setDeskPos 를 안 타고 position 을 직접 쓰는 경로(생성기)를
     0 으로 덮지 않기 위한 것이다. */
function seatDeskZCorr(deskGroup){
  const ud = deskGroup && deskGroup.userData;
  if(!ud) return 0;
  const a = +ud.animCorr, k = +ud.eqK;
  const A = (isFinite(a) && a > 0) ? a : 1;      // 없으면(undefined) 1 — 사람·생성기·런처
  const K = (isFinite(k) && k > 0) ? k : 1;
  return CHAR_Z * (1 - A*K);
}
/* 🐾🪑 **책상 위치 오프셋(deskPos)이 지나는 배율 — 이 앱에서 이 값을 정하는 곳은 여기 하나다.**
   `deskPos` 는 생성기에서 정한 값이고 생성기는 캐릭터 100% · 책상 100% 다. 실행 화면의 좌석은
   그 세계를 `animCorr × eqK` 로 줄인 것이므로, **옮긴 거리도 같은 배율로 줄어야** 생성기에서
   본 자리가 그대로 재현된다. 크기(setDeskScale)가 두 곱셈을 다 지나는 것과 같은 이유다.
   ★ 읽는 자리가 셋이다 — setDeskPos(x·y·z) · syncSeatDeskZ(z) · syncDeskPartAnchor(파츠 상쇄).
     셋이 같은 값을 봐야 하므로 함수로 묶어 둔다. 예전엔 `userData.eqK || 1` 을 세 곳에 각각
     적어 뒀는데, 그래서 `animCorr` 을 더할 때 세 곳을 다 고쳐야 했다(그게 이 제보의 정체다).
   ★ 없으면 1 — 생성기(cDesk)·런처(lHolder.desk)·def 가 아직 안 얹힌 좌석은 예전과 똑같다.
   ⚠️ 꾸미기 미리보기(_wdDeskGrp)는 userData 가 아니라 `_wdAnim` 을 직접 곱한다(그쪽 규약).
     값은 같아야 한다 — 한쪽만 고치면 미리보기와 실행이 갈린다. */
function seatDeskPosMul(deskGroup){
  const ud = deskGroup && deskGroup.userData;
  if(!ud) return 1;
  const a = +ud.animCorr, k = +ud.eqK;
  const A = (isFinite(a) && a > 0) ? a : 1;
  const K = (isFinite(k) && k > 0) ? k : 1;
  return A*K;
}
function syncSeatDeskZ(deskGroup){
  if(!deskGroup) return;
  const b = deskGroup.userData && deskGroup.userData.deskPosBase;
  const corr = seatDeskZCorr(deskGroup);
  if(b || corr !== 0){
    const k = seatDeskPosMul(deskGroup);
    deskGroup.position.z = ((b ? (+b.z||0) : 0) * k) + corr;
  }
  /* 📌 '책상 위' 파츠 — 상쇄량은 **deskPosBase 만** 본다(보정항은 안 본다).
     보정항은 좌석 전체가 함께 뒤로 물러난 양이므로 파츠도 같이 따라가는 게 맞다.
     따라가지 않으면 동물 좌석에서만 파츠가 0.282 앞에 남아 뜬다.
     ⚠️ syncSeatDeskZ 를 부르는 경로(setDeskPos·setDeskScale·syncSeatEqualize·applyCharToSeat)는
       이 한 줄 덕분에 파츠 상쇄를 따로 챙길 필요가 없다. 여기서 빼지 말 것. */
  syncDeskPartAnchor(deskGroup);
}
/* ═══ 📦 복제 코드 불러오기 · 내보내기 · 풀 GLB ═══ */
/* 본문은 char-code.js 로 옮겼다(앱 FSD 38번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHAR_CODE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const charCodeMod = (typeof TwCharCode === 'undefined') ? CHAR_CODE_MOD_OFF : TwCharCode.createCharCode({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  charsMod: charsMod,
  closeGearMenu: (...a)=>closeGearMenu(...a),
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  decryptCode: (...a)=>codeCryptoMod.decryptCode(...a),
  encryptCode: (...a)=>codeCryptoMod.encryptCode(...a),
  focusLevelMod: ()=>focusLevelMod,
  gachaMod: ()=>gachaMod,
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  layoutSeats: (...a)=>layoutSeats(...a),
  loadCharGLB: (...a)=>loadCharGLB(...a),
  overheadMod: overheadMod,
  premiumMod: premiumMod,
  renderLauncher: (...a)=>renderLauncher(...a),
  renderSeatTabs: (...a)=>renderSeatTabs(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  scene: scene,
  seats: seats,
  selectSeat: (...a)=>selectSeat(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
});
let cDeskTemplate=null, cDeskGlbB64=null;   // 생성기 세션의 커스텀 책상


/* ═══ 🍞 토스트(toast) · 저장 실패 문구 ═══ */
/* --- toast --- */
/* 🔐 서버가 거부한 건가, 인터넷이 끊긴 건가 — 관리자 저장 실패 문구를 가른다.
   [왜 필요한가] 관리자 경로(라이선스 발급·파츠 등록·공지)는 이제 규칙에서 `admins/$uid` 를 본다.
     권한이 없으면 Firebase 가 PERMISSION_DENIED 로 거부하는데, 지금 코드는 그것도 전부
     "인터넷 연결을 확인해 주세요"로 안내한다. 그러면 관리자가 연결을 아무리 확인해도 원인을
     못 찾는다 — **로그인이 안 됐거나 명단에 없다**는 것이 진짜 이유다.
   ⚠️ 거부를 조용히 넘기지 말 것. 파츠를 등록하고 "됐겠지" 하고 창을 닫으면 그 손해는 나중에 온다. */
function _saveFailMsg(e, fallback){
  const s = String((e && (e.code || e.message)) || '');
  if(/permission[_-]?denied/i.test(s)){
    return '권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요';
  }
  return fallback || '저장에 실패했어요 — 인터넷 연결을 확인해 주세요';
}
/* 🍞 두 번째 인자(iconSrc)는 **글자 앞에 붙일 작은 그림**이다 — 뿅망치처럼 이모지가 없는 것 때문에 생겼다.
   ⚠️ 본문은 계속 textContent 로 넣는다. 여기엔 남이 친 글(닉네임 등)이 섞여 들어오므로
     innerHTML 로 바꾸면 안 된다. 그림은 별도 <img> 노드로 앞에 끼운다. */
let toastT=null;function toast(msg, iconSrc, ms){const t=document.getElementById('toast');t.textContent=msg;
  if(iconSrc){ const im=document.createElement('img'); im.src=iconSrc;
    im.style.cssText='width:16px;height:16px;vertical-align:-3px;margin-right:5px;'; t.prepend(im); }
  t.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),(typeof ms==='number'&&ms>0)?ms:1900);}

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
// ★ 상체를 덜 숙이게 하는 보정값(라디안). 인간·동물 공통으로 적용된다.
//   양수일수록 덜 숙임(허리를 폄), 0이면 예전 그대로, 음수면 더 숙임.
//   숨쉬기(breath)에는 영향을 주지 않고 기울임(leanX)만 완화하므로 호흡 애니메이션은 그대로 살아있다.
const SPINE_LEAN_RELIEF = 0.03;
// ★ 이 숫자가 0.0이면 팔이 안 올라가요! 0.4 나 -0.4 등으로 바꿔주셔야 적용됩니다.
const HAND_REST   = -1.0;         // 평소 손 기본각(아주 조금 올림). 더 올리려면 0쪽(예 -0.7), 내리려면 −쪽(예 -1.0)
// 🐾 동물 전용 팔 기본각(ANIMAL_HAND_REST)은 파일 앞쪽 '동물 상수 모음'으로 옮겼음 —
//   applyStaticHandRest(런처 미리보기)가 훨씬 위에서 이 값을 쓰기 때문(TDZ 회피).
const FOCUS_ARM_LIFT = -0.1;      // ★ 타이핑할 때 책상 위로 팔을 들어 올리는 각도 
                                  // (만약 팔이 척추 쪽으로 더 말려 들어간다면 +0.8 처럼 부호를 반대로 바꿔보세요!)
const HAND_TAP_AMP = 0.18;        // 타이핑(p.arm) 시 손 까딱 폭
const CLICK_TAP_DUR = 260;        // 마우스 클릭 반응 지속시간(ms) — 오른손 까딱 한 번의 길이
const CLICK_TAP_AMP = 0.35;       // 마우스 클릭 반응 오른손 까딱 폭(라디안)
const CLICK_LIFT_AMP = -0.15;     // 마우스 클릭 반응 시 오른손을 살짝 들어올리는 오프셋(책상에 안 박히게). 음수=위로
const LEG_SWING    = 0.06;        // 다리 idle 스윙 폭(라디안). 0이면 정지
// 귀 까닥임(랜덤, 가끔) — ear 본이 있는 캐릭터에서만 동작. 상태(idle/focus 등)와 무관하게 항상 독립적으로 발동.
const EAR_FLICK_AXIS = 1;         // 움직임 방향이 반대면 -1로 뒤집기
const EAR_FLICK_AMP  = 0.5;       // 까닥임 폭(라디안) — 크게 확 움직이는 느낌
const EAR_FLICK_DUR  = 220;       // 한 번 까닥이는 데 걸리는 시간(ms) — 짧고 빠르게
const EAR_FLICK_GAP_MIN = 4000, EAR_FLICK_GAP_MAX = 11000;   // 다음 까닥임까지 대기시간 범위(ms) — 랜덤, 자주는 안 움직임
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
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatus : null);   // 활동 상태(밥먹는중 등) — head bob과 타이핑 속도 계산 둘 다에서 씀
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
    setBone(b.spine, r.spine, SPINE_AXIS*(breath + p.leanX*0.8 - SPINE_LEAN_RELIEF), 0, 0); }
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
      // 🍚 밥 먹는 중: spine은 건드리지 않고 head 본만 빠르게 위아래로 까딱여서 씹는(먹는) 느낌을 냄.
      //   일반 bob(숨쉬기에 얹히는 잔잔한 흔들림)보다 훨씬 빠르고 뚜렷하게.
      const isMeal = (us==='meal' && state!=='shaking' && state!=='pet');
      bob  = isMeal ? Math.sin(t*9)*0.05
           : (_focusLock||state==='dizzy') ? 0 : Math.sin(t*1.3+seat.headPhase)*0.05;
      look = isRecovering ? Math.sin(t*24)*0.45
           // 어지러움: 서로 다른 속도를 섞어 불규칙하고 무겁게 비틀거리는 좌우 움직임
           : (state==='dizzy') ? Math.sin(t*2.0)*0.3 + Math.sin(t*5.3)*0.1 
           : _focusLock ? 0
           : isMeal ? 0
           : Math.sin(t*0.3+seat.headPhase)*0.10;
      droop= isMeal ? 0.10
           : isRecovering ? 0.40
           // 어지러움: 기본으로 푹 숙인 상태에서, 불규칙하게 고개가 앞으로 더 꺾이는 움직임
           : (state==='dizzy') ? DIZZY_HEAD_DROOP + Math.sin(t*1.7)*0.2 + Math.cos(t*4.1)*0.15 
           : (state==='sleep')?0.35:(state==='focus'?0.12:0);
      // 어지러움: 좌우/상하 움직임과 타이밍이 어긋나는 갸우뚱(Z축)을 추가해 균형을 잃은 느낌 강조
      roll = (!isMeal && state==='dizzy') ? Math.sin(t*2.2)*0.25 : 0;
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
  let baseArmRot = (seat.charDef && seat.charDef.animal) ? ANIMAL_HAND_REST : HAND_REST;   // 🐾 동물만 별도 기본각(인간 값은 그대로) — 묘기 자세에서 아래에 더해지므로 let
  let armSpread  = (state==='dizzy') ? DIZZY_ARM_SPREAD : 0;    // dizzy: 팔 양옆 펼침(Y축) — 묘기 자세에서 아래에 더해지므로 let
  // 팔 X축 추가 회전: dizzy면 책상 위로, shaking이면 축 처짐
  const armForward = (state==='dizzy')   ? DIZZY_ARM_FORWARD
                   : (state==='shaking') ? SHAKE_ARM_DROOP
                   : 0;

  // 빡일중(grind)일 때는 타이핑 속도를 2배(20)로, 평소엔 기본 속도(10)로 설정합니다.
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
  // 🎪 묘기 중이면 균형 잡듯 양팔을 옆으로 쫙 벌린다(_positionRideSeat가 seat._circusOn을 세움).
  if(seat._circusOn){
    armSpread -= CIRCUS_ARM_SPREAD;      // ★ 부호 — 반대로 꺾이면 +로 바꾸면 됨
    baseArmRot += CIRCUS_ARM_DROP;       // 벌린 상태에서 높이만 내림(양수 = 내려감)
  }
  const leftTapAmp = clicking ? 0 : HAND_TAP_AMP*tap;   // 클릭 반응 중엔 왼손 까딱 정지
  if(b.handL) setBone(b.handL, r.handL, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed))*leftTapAmp,    0,  armSpread);
  if(b.handR) setBone(b.handR, r.handR, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed+1.6))*HAND_TAP_AMP*tap + HAND_AXIS*CLICK_TAP_AMP*clickTapVal + HAND_AXIS*CLICK_LIFT_AMP*clickTapVal, 0, -armSpread);


  // 다리: spine 직속으로 매달려 좌우 교대 미세 스윙(로컬 X)
  if(seat._benchSit && !seat.beingShaken && !seat.pinned){
    // 🪑 벤치 앉기 — 허벅지를 앞으로 접어(무릎이 앞으로) 앉은 자세. 좌우로 아주 미세하게만 흔들어 자연스럽게.
    //   ★ 드래그(흔들기)/고정 중에는 앉기 포즈를 풀어 서 있는 다리로 — 들어올릴 때 다리가 접힌 채면 어색함.
    const SIT_THIGH = -1.35;  // 허벅지 굽힘(라디안). 음수=앞으로 접힘. |값| 키우면 더 깊이 앉음
    const wob = Math.sin(t*1.0 + seat.swayPhase)*0.03;   // 살짝살짝
    if(b.legL) setBone(b.legL, r.legL, SIT_THIGH+wob, 0, 0.05);
    if(b.legR) setBone(b.legR, r.legR, SIT_THIGH-wob, 0, -0.05);
  } else if(seat._circusOn){
    // ★ 딛는 발은 '좌석에 한 번 정해 저장'한다. 예전엔 swayPhase로 매번 계산했는데,
    //   그 값이 좌석 재조립 등으로 바뀌면 딛는 발도 같이 바뀌어 왼발↔오른발이 오갔다.
    if(seat._circusStandLeft === undefined) seat._circusStandLeft = (Math.random() < 0.5);
    const standLeft = seat._circusStandLeft;
    // 🎪 든 발 까딱임 — 정의가 빠져 있어 묘기 자세(3층+)에서 매 프레임 ReferenceError로 렉이 났음. 복원.
    const wag = Math.sin(t*CIRCUS_LEG_WAG_SPD + (seat.swayPhase||0)) * CIRCUS_LEG_WAG;
    const stand = CIRCUS_LEG_STAND, lift = CIRCUS_LEG_LIFT + wag;
    if(b.legL) setBone(b.legL, r.legL, standLeft ? stand : lift, 0, 0);
    if(b.legR) setBone(b.legR, r.legR, standLeft ? lift : stand, 0, 0);
  }else{
    const ls = Math.sin(t*1.1 + seat.swayPhase)*LEG_SWING;
    if(b.legL) setBone(b.legL, r.legL,  ls, 0, 0);
    if(b.legR) setBone(b.legR, r.legR, -ls, 0, 0);
  }

  // 💃 춤 — 위에서 설정한 spine/팔/다리를 덮어써서 스타일별 이모트 재생. 절차적이라 전 캐릭터 공통.
  //   스타일 전달: 내 좌석은 danceStyle, 친구 좌석은 remoteDanceStyle(페이로드로 수신).
  if(state==='dance'){
    const dstyle = seat.remote ? (seat.remoteDanceStyle||'sway') : (seat.danceStyle||'sway');
    /* ⏱ 이 춤이 언제 시작됐나 — **친구 화면에서도** 재야 하는 값이다.
       [왜 danceUntil 로 역산하지 않나] 그 값은 내 좌석에만 있다. 친구에게는 상태('dance')와
         스타일만 전달되므로, 남의 화면에서는 남은 시간을 알 방법이 없다. 회전 횟수를 세는 춤은
         시작점이 없으면 남의 화면에서만 바퀴 수가 어긋난다.
       ★ 스타일이 바뀌어도 다시 찍는다(댄스배틀로 춤이 교체되는 경우). */
    if(seat._danceAtStyle !== dstyle || !seat._danceStartAt){
      seat._danceStartAt = performance.now();
      seat._danceAtStyle = dstyle;
    }
    const dt = (performance.now() - seat._danceStartAt) / 1000;   // 이 춤이 시작된 뒤 흐른 초
    if(dstyle==='trick' || dstyle===iDeskMod.TRICK_TURBO_STYLE){
      /* 🤸 묘기 회전 — ①자세 잡기 ②제자리 5회전 ③처음 방향으로 복귀.
         🌀 터보(`/150`×3)면 같은 시간에 10바퀴 — 구간 시간은 그대로, 바퀴 수만 곱한다.
         ★ 회전각을 `t`(전역 시각)가 아니라 **진행률 × 바퀴 수**로 만든다. 그래서 프레임이 끊기거나
           춤을 늦게 본 사람의 화면에서도 정확히 그 바퀴만큼 돌고 원래 방향으로 선다
           (기존 spin 은 t 에 비례해 계속 도는 방식이라 끝나는 방향이 매번 달랐다).
         ★ 한 발 서기 자세는 탑쌓기(서커스)에서 왔지만 **든 발의 축만 다르다** — 탑쌓기는 남의 머리
           위라 뒤로 들고(X축), 이쪽은 정면에서 보이는 자세라 옆으로 뻗는다(Z축, TRICK_LEG_SIDE).
           각도 크기와 딛는 발은 CIRCUS_LEG_* 를 그대로 쓰므로 그쪽을 조정하면 여기도 따라온다. */
      seat._danceSpin = true;                                    // 끝난 뒤 잔여 회전 복원은 기존 경로가 맡는다
      const turns = iDeskMod._trickTurns(dstyle);
      const inE   = iDeskMod._trickEaseIn(dt);                                      // 0→1 자세 잡는 중(앞쪽에 몰아친다)
      const spinP = Math.min(1, Math.max(0, (dt - iDeskMod.TRICK_IN_S) / iDeskMod.TRICK_SPIN_S));  // 0→1 회전 진행률
      const ease  = spinP < 0.5 ? 2*spinP*spinP : 1 - Math.pow(-2*spinP + 2, 2)/2;  // 부드럽게 붙었다 떨어지게
      seat.rig.rotation.y = ease * Math.PI * 2 * turns;          // ★ 정확히 turns 바퀴 — 끝나면 2π 배수라 제자리
      // 회전이 붙을수록 살짝 몸을 세우고 발끝으로 서는 느낌
      const lift = inE * (0.6 + 0.4*Math.sin(Math.min(1, spinP*3)*Math.PI/2));
      if(seat.bodyWrap) seat.bodyWrap.position.y = 0.05 * lift;
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.02, 0, 0);
      if(b.head)  setBone(b.head,  r.head,  -0.08*inE, 0, 0);              // 시선 살짝 위로
      /* 양팔을 **좌우로 곧게** 뻗어 균형 — 위로 들어올리지 않는다.
         ★ 예전에는 X축(앞뒤 굽힘)에 -1.55 를 줘서 팔이 위를 향한 채 길게 뻗었다. 그러면 회전
           들어가기 전에 만세 자세가 한 박자 보여서 "묘기 자세"로 안 읽혔다.
         ★ 벌림 폭은 TRICK_ARM_SPREAD 하나가 정한다(탑쌓기와 분리) — 이쪽은 정면에서 도는
           자세라 같은 폭이면 좁아 보인다.
         ★ 높이는 TRICK_ARM_LIFT 하나로 조정한다 — 올리고 내릴 때 여기 말고 그 상수를 볼 것. */
      const armBase   = iDeskMod._trickArmBase(baseArmRot, seat._circusOn, inE);
      const armSpreadT = iDeskMod._trickArmSpread(inE);                   // 폭은 TRICK_ARM_SPREAD 로 조정한다
      if(b.handR) setBone(b.handR, r.handR, armBase, 0,  armSpreadT);
      if(b.handL) setBone(b.handL, r.handL, armBase, 0, -armSpreadT);
      // 한 발 서기 — 딛는 발은 좌석에 한 번 정해 저장한다(탑쌓기와 같은 규칙: 매번 계산하면 발이 오간다)
      if(seat._trickStandLeft === undefined) seat._trickStandLeft = (Math.random() < 0.5);
      const lp = iDeskMod._trickLegPose(seat._trickStandLeft, inE);       // 든 발은 옆으로(Z), 딛는 발만 X
      if(b.legL) setBone(b.legL, r.legL, lp.legL.x, 0, lp.legL.z);
      if(b.legR) setBone(b.legR, r.legR, lp.legR.x, 0, lp.legR.z);
    } else if(dstyle==='spin'){
      // 🎠 오르골 — 제자리에서 아주 천천히 도는 인형. 발은 거의 중앙에 모으고, 오른팔 만세·왼팔 살짝 벌림.
      seat._danceSpin = true;
      seat.rig.rotation.y = t*1.3 + (seat.swayPhase||0);        // 오르골처럼 느린 회전 (3.0 → 1.3)
      const bob = Math.sin(t*2.4)*0.02;                          // 아주 미세한 상하(오르골 느낌)
      if(seat.bodyWrap) seat.bodyWrap.position.y = Math.abs(bob);
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.03, 0, 0);          // 곧게 선 자세
      if(b.head)  setBone(b.head,  r.head,  0, Math.sin(t*1.3)*0.1, 0);
      const wing = Math.sin(t*2.4)*0.06;
      if(b.handR) setBone(b.handR, r.handR, baseArmRot - 1.9,  0,  0.3 + wing);   // 🙌 오른팔 만세
      if(b.handL) setBone(b.handL, r.handL, baseArmRot - 0.55, 0, -(0.7 + wing)); // 왼팔 살짝만 벌림(덜 내림)
      // 발 거의 중앙으로 모음 — 잔발 없이 가지런히
      if(b.legL) setBone(b.legL, r.legL, 0, 0, -0.015);
      if(b.legR) setBone(b.legR, r.legR, 0, 0,  0.015);
    } else if(dstyle==='tantrum'){
      // 😭 누워서 떼쓰기 — 등을 대고 누워(뒤로 젖힘) 팔다리를 파닥파닥. 아이가 바닥에서 떼쓰는 모션.
      const f = t*11;                                            // 파닥임 속도(빠르게)
      if(seat.bodyWrap) seat.bodyWrap.rotation.x = -1.5;         // 등 대고 누움(≈ -86°)
      seat._danceFlipActive = true;                             // 눕힘 적용 중(복원 로직 참고)
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.05, Math.sin(f*0.5)*0.12, 0);  // 몸통 살짝 뒤척
      if(b.head)  setBone(b.head,  r.head,  0.2, Math.sin(f*0.7)*0.25, 0);              // 머리 도리도리(칭얼)
      // 팔 파닥파닥 — 좌우 엇갈려 위아래로 마구
      if(b.handL) setBone(b.handL, r.handL, baseArmRot + Math.sin(f)*0.7,        0, -0.5 + Math.sin(f)*0.3);
      if(b.handR) setBone(b.handR, r.handR, baseArmRot + Math.sin(f+2.1)*0.7,    0,  0.5 - Math.sin(f+2.1)*0.3);
      // 다리 파닥파닥 — 팔과 엇박으로 버둥거림
      if(b.legL) setBone(b.legL, r.legL, -0.4 + Math.sin(f+1.0)*0.5, 0, -0.1);
      if(b.legR) setBone(b.legR, r.legR, -0.4 + Math.sin(f+3.2)*0.5, 0,  0.1);
    } else {
      // 🐱 happy cat — 팔을 위아래로 빠르게 파닥파닥. 좌우 아주 살짝 몸 흔들.
      const BPS = 2.4;                                   // 파닥임 속도(초당 박자)
      const beat = t*BPS + (seat.swayPhase||0)*0.3;
      const flap = Math.sin(beat*Math.PI*2);             // -1~1 위아래 파닥
      // 팔을 옆으로 어느 정도 벌린 상태(SPREAD)에서, 위아래(X축 baseArmRot)로 파닥파닥.
      const SPREAD = 0.7;                                 // 팔 벌림(고정) — 너무 좁지도 넓지도 않게
      const FLAP_AMP = 0.9;                               // 위아래 파닥 크기(클수록 크게 펄럭)
      if(b.handL) setBone(b.handL, r.handL, baseArmRot - 0.1 + flap*FLAP_AMP, 0, -SPREAD);
      if(b.handR) setBone(b.handR, r.handR, baseArmRot - 0.1 - flap*FLAP_AMP, 0,  SPREAD);  // 반대 위상 = 양팔 엇갈려 파닥(더 밈 같음)
      const sway = Math.sin(beat*Math.PI*0.5);           // 몸 좌우 아주 살짝
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*(Math.sin(seat.breathePhase)*0.02), sway*0.08, sway*0.1);
      const step = sway*0.12;
      if(b.legL) setBone(b.legL, r.legL,  step, 0, 0);
      if(b.legR) setBone(b.legR, r.legR, -step, 0, 0);
      if(b.head) setBone(b.head, r.head, Math.abs(flap)*0.05, sway*0.1, sway*0.08);   // 파닥에 맞춰 고개 까딱
    }
  }
  /* ⏱ 춤이 끝나면 시작 시각을 지운다 — 다음 춤이 처음부터 세도록.
     안 지우면 같은 스타일을 다시 췄을 때 이전 진행률을 이어받아, 자세를 잡기도 전에 회전이
     끝나 있거나 아예 안 도는 것처럼 보인다. */
  if(state!=='dance' && seat._danceStartAt){ seat._danceStartAt = 0; seat._danceAtStyle = null; }
  // 🌀 헤드스핀 잔여 회전 복원 — 춤이 끝나거나 다른 상태로 바뀌면 몸 Y 회전을 부드럽게 0으로.
  if(seat._danceSpin && state!=='dance'){
    let ry = seat.rig.rotation.y % (Math.PI*2);
    if(ry >  Math.PI) ry -= Math.PI*2;
    if(ry < -Math.PI) ry += Math.PI*2;
    ry *= 0.82;
    if(Math.abs(ry) < 0.03){ seat.rig.rotation.y = 0; seat._danceSpin = false; }
    else seat.rig.rotation.y = ry;
  }
  // 🤸 뒤집힌 몸(headspin) 복원 — 이번 프레임에 뒤집기를 적용 안 했으면 bodyWrap X회전을 0으로 수렴.
  //   (animateRig엔 dt가 없어 프레임당 고정 비율 감쇠 사용 — 약 0.75배씩)
  if(seat.bodyWrap && !seat._danceFlipActive && Math.abs(seat.bodyWrap.rotation.x) > 0.001){
    seat.bodyWrap.rotation.x *= 0.75;
    if(Math.abs(seat.bodyWrap.rotation.x) < 0.02) seat.bodyWrap.rotation.x = 0;
  }
  seat._danceFlipActive = false;   // 다음 프레임을 위해 리셋(헤드스핀 중이면 위에서 다시 true)

  // 귀 까닥임 — ear 본이 하나 이상 있을 때만
  // 완전히 무관하게 독립적으로 랜덤 발동. 다른 애니메이션이 건드리는 뼈와 안 겹쳐서 서로 절대 간섭 안 함.
  if(b.ear && b.ear.length){
    // ★ 예전엔 좌석 전체가 타이머 하나(seat.earFlickStart/earNextAt)를 공유해서, 귀 파츠가 여러 개면
    //   전부 똑같은 타이밍에 까닥여서 부자연스러웠음 — 귀 본(bone)마다 독립된 타이머를 갖도록 변경.
    //   배열 크기가 바뀌면(파츠 장착/해제) 새로 초기화하되, 처음부터 서로 다른 랜덤 대기시간을 줘서
    //   시작부터 타이밍이 어긋나게 함.
    if(!seat.earTimers || seat.earTimers.length !== b.ear.length){
      seat.earTimers = b.ear.map(()=>({ flickStart:null, nextAt: now + Math.random()*EAR_FLICK_GAP_MAX }));
    }
    b.ear.forEach((bone,i)=>{
      const timer = seat.earTimers[i];
      if(timer.flickStart==null && now >= timer.nextAt){ timer.flickStart = now; }
      if(timer.flickStart!=null){
        const el = now - timer.flickStart;
        if(el >= EAR_FLICK_DUR){
          // 까닥임 종료 — 다음 까닥임까지 랜덤 대기(이 본만)
          timer.flickStart = null;
          timer.nextAt = now + EAR_FLICK_GAP_MIN + Math.random()*(EAR_FLICK_GAP_MAX-EAR_FLICK_GAP_MIN);
          setBone(bone, r.ear[i], 0, 0, 0);   // 정지 상태로 복귀
        } else {
          const prog = el/EAR_FLICK_DUR;
          const amt = Math.sin(prog*Math.PI) * EAR_FLICK_AMP;   // 0→최대→0, 빠르고 확 움직이는 느낌
          setBone(bone, r.ear[i], EAR_FLICK_AXIS*amt, 0, 0);
        }
      }
    });
  }
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
/* 🔋 절전 — 프레임 상한은 frame-budget.js(FrameBudget)가 정한다. 요약: 최대 60 · 포커스 있어도 손 안 대면 30 ·
   다른 창을 보는 중이면 20. 이 창은 화면 전체를 덮는 투명 WebGL 오버레이라, 많이 그릴수록 크롬 스크롤 · 영상처럼
   GPU 합성을 쓰는 작업과 경합한다(제보: RTX 3060 Ti · 고주사율 모니터에서 크롬이 버벅임).
   캐릭터는 계속 움직여야 하므로 멈추지는 않고 상한만 둔다(dt는 그만큼 커져 속도는 그대로 유지).
   ※ 브라우저 스크롤 '멈춤'(GPU 합성 표면 점유)은 프레임 수와 무관함이 실험으로 확인됨(2026-07-25) —
     그건 오버레이가 표면을 잡는다는 사실 자체가 원인이다. 상한은 '버벅임'(GPU 부하) 쪽을 줄인다.
   ★ frame-budget.js 는 HTML 이 app.js 보다 먼저 싣는다 — 가드 없이 바로 쓴다. */
const _FB = FrameBudget;
const _frameBudget = _FB ? _FB.createFrameBudget({ now: ()=>performance.now() }) : null;
let _appFocused = true;
/* 🔥 상한 임시 해제 — **만지는 동안에는 비포커스여도 60fps(FrameBudget.FPS_ACTIVE)로 돌린다.**
   [제보] "다른 브라우저를 띄워 둔 채 캐릭터를 클릭하면 앱이 무겁고 버벅인다. 앱을 활성화하면 멀쩡하다."
   [원인] 위 상한이 20fps 다. 다른 창을 보고 있으면 프레임 간격이 50ms 라, 그 상태에서 캐릭터를
     누르거나 끌면 반응이 한 박자씩 늦게 그려진다 — 앱이 느려진 것처럼 읽힌다. 절전은 **유휴일 때**
     하자는 장치인데, 만지는 순간까지 절전이 걸려 있던 것이 문제다.
   ★ 이미 같은 예외가 하나 있다(_flyActive) — 20fps 에서 나는 캐릭터가 순간이동하듯 끊겨서 뚫어 둔
     구멍이다. 클릭·드래그도 정확히 같은 이유이므로 그 선례를 그대로 따른다.
   ★ 마지막으로 만진 뒤 UI_HOT_MS 동안만 열어 둔다. 손을 떼면 다시 20fps 로 내려가 절전이 살아난다.
   ⚠️ 켜는 자리는 **판정이 '이 점은 앱 것'이라고 답한 순간**(커서가 캐릭터·UI 위)과 캐릭터를 누른
     순간이다. mousemove 마다 무조건 켜면 화면 아무 데나 스쳐도 상한이 풀려 절전이 사실상 사라진다. */
const UI_HOT_MS = 1500;
let _uiHotUntil = 0;
function _uiHot(ms){ const t = performance.now() + (ms || UI_HOT_MS); if(t > _uiHotUntil) _uiHotUntil = t; }
/* 포커스가 있을 때 30 으로 내려가지 않게 막는 «하는 중» — 춤 · 입력칸 · 꾸미기/생성기.
   DOM 을 보므로 0.5초에 한 번만 다시 잰다(매 프레임 querySelector 를 안 부르게). */
let _fbBusyAt = -1e9, _fbBusy = false;
function _fbIsBusy(now){
  if(now - _fbBusyAt < 500) return _fbBusy;
  _fbBusyAt = now;
  let b = false;
  try{
    if(creatorOpen) b = true;
    else if(seats.some(s=>s._danceStartAt)) b = true;
    else {
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) b = true;
      else if(document.querySelector('#wardrobePanel.on, #wdPreviewPanel.on')) b = true;
    }
  }catch(_){}
  return (_fbBusy = b);
}
/* 지금 상한 fps — 상한 판정을 한 곳에 모은다(검증기도 여기를 본다). 0 = 상한 없음 */
function _frameCap(now){
  if(!_frameBudget) return 0;
  return _FB.pickFps({
    hot: !!_flyActive || (typeof drag !== 'undefined' && !!drag) || now < _uiHotUntil,   // 🪑 비행 · 끄는 중 · 방금 누름
    focused: _appFocused,
    runMode: document.body.classList.contains('runmode'),
    busy: _appFocused && _fbIsBusy(now),
    idleMs: _frameBudget.idleMs(now),
  });
}
/* 이번 프레임을 건너뛸 것인가. 그린다고 답하면 다음 예정 시각이 잡힌다(admit). */
function _frameCapped(now){
  if(!_frameBudget) return false;
  return !_frameBudget.admit(now, _frameCap(now));
}
/* 🩺 화면 멈춤 감시 — 창이 가려지거나 오래 방치되면 브라우저가 requestAnimationFrame 호출을
   아예 멈추는 경우가 있다(클릭하면 다시 움직이던 그 현상). main.js 쪽 절전 해제 스위치로도
   전부 막지 못했다. setTimeout 계열 타이머는 그때도 계속 도니, rAF가 한동안 안 오면
   타이머가 대신 한 프레임을 진행시켜 화면이 멈춘 것처럼 보이지 않게 한다.
   ★ 수동 진행일 땐 새 rAF를 걸지 않는다 — 원래 걸어둔 콜백이 아직 대기 중이라, 그것까지
     쌓이면 나중에 한꺼번에 터진다. 브라우저가 정상으로 돌아오면 그 콜백이 살아나 이어진다. */
let _lastRafAt = 0;
const RAF_STALL_MS = 1000;   // ★ 이 시간 이상 rAF가 안 오면 멈춘 것으로 본다
try{
  setInterval(()=>{
    const t = performance.now();
    if(!_lastRafAt){ _lastRafAt = t; return; }
    if(t - _lastRafAt < RAF_STALL_MS) return;
    try{ frame(t, true); }catch(_){}
  }, 400);
}catch(_){}
try{
  _appFocused = document.hasFocus();
  if(_frameBudget) _frameBudget.noteFocus(_appFocused, performance.now());
  window.addEventListener('focus', ()=>{ _appFocused = true;  if(_frameBudget){ const t = performance.now(); _frameBudget.noteFocus(true, t); _frameBudget.poke(t); } });
  window.addEventListener('blur',  ()=>{ _appFocused = false; if(_frameBudget) _frameBudget.noteFocus(false, performance.now()); });
  /* «손댐» = 내 창에 온 누르기 · 키 · 휠. ⚠️ mousemove 는 세지 않는다 — 클릭 통과 중에도 들어와서
     크롬 위로 커서만 지나가도 30 ↔ 60 이 오르내린다(영상 깜빡임 — _updateIgnore 🚫 주석). */
  if(_frameBudget){
    const _fbPoke = ()=>_frameBudget.poke(performance.now());
    for(const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, _fbPoke, { capture: true, passive: true });
  }
}catch(_){}
/* 🩺 1분마다 진단 한 줄(tw-mouse-diag.log) — 실제로 그린 장 수 · 포커스 비율 · 상한 · 배율 · 캔버스 크기.
   «앱 켜면 다른 프로그램이 버벅인다» 제보 때 로그만 받아서 우리 몫이 얼마인지 본다. 실행 화면에서만 적는다. */
try{
  setInterval(()=>{
    if(!_frameBudget) return;
    const t = performance.now();
    const m = _frameBudget.takeMinute(t);
    if(!document.body.classList.contains('runmode')) return;
    if(!(window.companion && companion.diagNote)) return;
    m.cap = _frameCap(t); m.pr = renderer.getPixelRatio(); m.w = canvas.width; m.h = canvas.height;
    companion.diagNote(_FB.diagLine(m));
  }, 60000);
}catch(_){}
function frame(now, manual){
  if(!manual) _lastRafAt = now;   // 브라우저가 실제로 rAF를 불러준 시각(아래 감시 장치가 씀)
  /* 상한(_frameCapped → FrameBudget) — 최대 60 · 포커스 있어도 손 안 대면 30 · 다른 창을 보는 중이면 20
     ★ 🪑 플라잉체어가 도는 동안은 60 으로 올린다. 20fps 에서는 dt 가 프레임당 0.05초로
       고정돼 빠르게 튕기는 캐릭터가 한 칸씩 순간이동하듯 끊겨 보인다(평소 앉아 있는 모션은
       느려서 20fps 로도 티가 안 났다). 최대 10초짜리 한시적 예외다. */
  if(_frameCapped(now)){
    if(!manual) requestAnimationFrame(frame);
    return;
  }
  const dt=Math.min((now-prev)/1000,0.05);prev=now;
  updateIdleItemPlayback();   // 어플 8: 자리비움 감지로 아이템 재생/정지 자동 전환
  updateActivePartPlayback();   // ▶ 파츠: animMode='active'인 것만 활동 중 재생/일시정지
  if(activeItemMixers.size) activeItemMixers.forEach(m=>m.update(dt));   // 클릭으로 재생 중인 아이템 idle 애니메이션 업데이트
  _clampSeatDeskParts(now);   // 🪑 평준화 중 «책상 위» 파츠를 자기 자리 안으로(띄엄띄엄 — seat-slot.js)
  seats.forEach(seat=>{
    const state=seatState(seat,now);
    if(seat.isMe && Presence.active()){ Presence.setState(seat.pinned ? 'idle' : state); Presence.setLevel(focusLevelMod.getFocusLevel()); }   // 액자 고정은 상대에겐 평상시로
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
    } else if(us==='meal' && state!=='shaking' && state!=='pet'){
      // 🍚 밥 먹는 중: 마우스/타이핑 등 활동 감지와 무관하게(직접 쓰다듬거나 흔드는 중이 아니면 항상)
      //   먹는 모션만 보이게 함(요청사항) — 상체(spine)는 가만히 두고, 머리만 빠르게 까딱이는 건
      //   animateRig()의 head 본 처리에서 별도로 담당(아래 us==='meal' 분기 참고).
      tg.slumpY=-0.05;   // 고개 숙임 정도 — 더 숙이려면 음수로 더 크게(예: -0.08)
      tg.leanX=0;        // ★ 상체(spine)는 움직이지 않게 — 머리만 까딱이길 원하셔서 몸 기울임은 뺌
      tg.breSpd=2.0;
      tg.breAmp=0.004;   // ★ 숨쉬기로 인한 상체 흔들림도 최소화(거의 정지) — grind의 idle과 동일 수준
    }
    for(const kk in seat.pose) seat.pose[kk]=lerp(seat.pose[kk],tg[kk],k);
    /* slide to slot — group은 슬롯 위치만, rig는 흔들기 중이 아니면 항상 원점으로 복귀 */
    if(seat.inPreview){ seat.group.position.set(0,0,0); seat.rig.position.set(0,0,0); }
    else if(seat._benchOwnerSit && seat.bench && seat.benchSlots && seat.benchSlots[0]){
      // 🪑 벤치 주인 owner-sit — 자기 벤치(자기 group의 자식)의 slot_0 로컬 위치로 rig를 보낸다.
      //   group을 옮기면 슬롯도 같이 움직여 순환하므로, group은 원래 자리(targetX) 유지 + rig만 슬롯으로.
      //   ★ 단, 흔들기/고정 중에는 rig 강제를 멈춰서 흔들기가 먹히게 함(놓으면 다시 슬롯으로 수렴).
      const kSlide = Math.min(1, dt * 15);
      seat.group.position.x = lerp(seat.group.position.x, seat.targetX, kSlide);
      if(!seat.beingShaken && !seat.pinned){
        const s0 = seat.benchSlots[0];   // 벤치가 group 원점에 있으므로 s0.position이 곧 group 기준 로컬 오프셋
        const SIT_DROP = 0.28;
        seat.rig.position.x = lerp(seat.rig.position.x, s0.position.x, kSlide);
        seat.rig.position.y = lerp(seat.rig.position.y, s0.position.y - SIT_DROP, kSlide);
        seat.rig.position.z = lerp(seat.rig.position.z, s0.position.z, kSlide);
      }
    }
    else if(seat.seatedOn && !seats.includes(seat.seatedOn)){ rideBenchMod.unmountBench(seat); }   // 🪑 벤치 주인이 방을 나감 → 자동 하차
    else if(seat.seatedOn){ /* 위치는 _updateRideChains의 벤치 처리에서 슬롯 기준으로 배치 */ }
    else if(seat.ridingOn && !seats.includes(seat.ridingOn)){ rideBenchMod.unmountRide(seat); }   // 태운 대상이 방을 나감 → 자동 하차
    /* 🐾 **이미 잘못 얹혀 있는 좌석을 내린다.** mountRide 의 새 검사는 '앞으로 얹히는 것'만 막는다 —
       그 검사가 없던 때 얹혀서 지금 화면에 남아 있는 것(제보 사진)은 스스로 안 내려온다.
       ★ 동물 GLB 가 뒤늦게 파싱되면 rebuildAnimalSeats → applyCharToSeat 가 정리해 주지만,
         파싱이 끝내 실패하면 그 경로가 영영 안 온다. 그 경우를 여기서 받는다.
       ⚠️ _animalBuilt 는 조립 결과라 undefined(모델 없음)일 수 있다 — false 일 때만 내린다.
         mountRide 와 같은 기준이어야 내렸다 얹혔다 하는 깜빡임이 안 생긴다. */
    else if(seat.ridingOn && (!(seat.charDef && seat.charDef.animal) || seat._animalBuilt === false)){
      rideBenchMod.unmountRide(seat);
    }
    else if(seat.ridingOn){ /* 위치는 아래 _updateRideChains에서 체인 순서대로 일괄 처리 */ }
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
        seat.rig.position.z = lerp(seat.rig.position.z, seatCharZ(seat), kSlide);
      }
    }
    /* rig transforms */
    seat.swayPhase+=dt*0.8;
    /* idle 좌우 미세 sway — 빡일중일 땐 진폭을 0.02→0.005로 거의 제거 (집중 자세 고정 느낌) */
    const _swayAmp = (us==='grind' || us==='meal') ? 0.005 : 0.02;
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
      { const _bs=seatScale(seat); seat.bodyWrap.scale.set(_bs,_bs,_bs); }   // [수정] 강제 1,1,1 초기화 방지 (🪑 평준화 배율 포함)
      seat.bodyWrap.position.y=0;
      setClip(seat,state); seat.mixer.update(dt);
    } else if(rigged){
      seat.rig.rotation.x=lerp(seat.rig.rotation.x,0,k); 
      { const _bs=seatScale(seat); seat.bodyWrap.scale.set(_bs,_bs,_bs); }   // [수정] 강제 1,1,1 초기화 방지 (🪑 평준화 배율 포함)
      seat.bodyWrap.position.y=0;
      animateRig(seat,now,state);
    } else {
      seat.rig.rotation.x=seat.pose.leanX;
      const breathe=1+Math.sin(seat.breathePhase)*seat.pose.breAmp;
      // [수정] 기본 숨쉬기 애니메이션에 userScale을 곱해서 크기 유지
      /* ⚠️ 여기는 **매 프레임** bodyWrap.scale 을 다시 쓴다. raw userScale 로 두면 fitModel 이 얹은
         평준화 배율이 다음 프레임에 곧바로 지워진다 — 좌석 크기를 읽는 자리는 예외 없이 seatScale(). */
      const _bs = seatScale(seat);
      seat.bodyWrap.scale.set(
        (1/Math.sqrt(breathe)) * _bs, 
        breathe * _bs, 
        (1/Math.sqrt(breathe)) * _bs
      );
      // dizzy면 추가 슬럼프(고정값)로 얼굴을 더 내림. 부드럽게 수렴.
      // ★ _dizzyTarget은 animateRig() 안에서만 선언된 지역변수라 여기(rig 없는 폴백 캐릭터 분기)에서
      //   그대로 쓰면 ReferenceError. 같은 계산식을 이 분기 안에서 직접 계산해야 함.
      const _dizzyTargetHere = (state==='dizzy') ? 0 : 0;   // DIZZY_EXTRA_SLUMP와 동일(현재 0) — animateRig와 값 일치시킴
      seat._dizzyAdjCur = (seat._dizzyAdjCur==null) ? _dizzyTargetHere : lerp(seat._dizzyAdjCur, _dizzyTargetHere, k);
      seat.bodyWrap.position.y=seat.pose.slumpY + seat._dizzyAdjCur;
    }
    /* 🪄 때리기 스쿼시 — 위 **세 분기(clipped·rigged·폴백)가 각자 써 놓은 scale 에 곱한다.**
       ⚠️ 분기 안이 아니라 분기 밖에서 한 번 부르는 것이 요점이다. 분기마다 복사하면 한 곳을
         빠뜨려 "어떤 캐릭터는 납작해지고 어떤 건 안 되는" 증상이 나고, 증상만 보면 원인을 못 찾는다.
       ⚠️ 여기보다 아래에서 bodyWrap.scale 을 다시 쓰는 코드가 생기면 이 곱셈이 지워진다. */
    tricksMod._bonkFrame(seat, now);
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
    if(state==='sleep' && us!=='away' && us!=='meal' && now-(seat._lastZ||0)>900){seat._lastZ=now;floatersMod.spawnFloater('Z','#7fa8e0',seat);}
    if(state==='dizzy' && now-(seat._lastDizzy||0)>520){seat._lastDizzy=now;floatersMod.spawnFloater('💫','#f5a94f',seat);}

    /* 활동 상태 시각화 — 책상 위 이모지(모두), 머리 위 텍스트 말풍선(모두), 영혼 투명도(자리비움) */
    //   ✨ statusConfFor: 커스텀 상태(프리미엄)는 등록한 이모지/문구로 해석됨 (본인=내 등록값, 친구=전파받은 값).
    /* 📱 머리 위 «📱 앱» — 사용자가 고른 상태가 있으면 그게 먼저 · 없으면 🕒 오늘 기록보다 먼저(보내는 쪽 _statusOut 과 같은 순서). */
    const _mobApp = focusLevelMod._seatMobileApp(seat);
    const _conf = (_mobApp && !us) ? null : statusConfFor(seat, us);
    /* 🙈 숨긴 좌석 — 캐릭터 · 머리 위 말풍선 · 책상 위 상태 이모지. 매 프레임 판정(_hiddenSeatIds 주석). */
    const _hidden = hiddenSeatsMod._seatHidden(seat);
    if(seat.rig && seat.rig.visible === _hidden) seat.rig.visible = !_hidden;
    /* 🫧 자리비움 그림 — 자리비움 · 안 숨김 · 회사원 모드 아님 · 그림이 실제로 올라왔을 때만 캐릭터 자리에 선다.
       그땐 책상 위 🫧 를 안 띄운다(그림이 곧 자리비움 표시). 못 불러오면 예전 모양(🫧) 그대로. */
    const _awayPic = awayPicMod._awayPicFor(seat, us, _hidden);
    awayPicMod._awayImgFrame(seat, _awayPic, now);
    statusChipMod.setSeatDeskEmoji(seat,  (_conf && us!=='grind' && !_hidden && !_awayPic) ? _conf.emo : null);   // 빡일중은 책상에 🔥 안 뜨게(다른 상태는 그대로)
    // 💬 채팅 말풍선 — 보낸 지 CHAT_BUBBLE_MS 안이면 상태 말풍선 대신 채팅 내용을 잠깐 띄움(그 뒤엔 자동으로 상태 말풍선으로 복귀).
    //   (📢 확성기는 제거됨 → 커스텀 상태로 대체. 상태 말풍선이 곧 "지금 뭐 하는지"를 보여줌.)
    setSeatOpacity(seat, (_conf && _conf.opacity!=null) ? _conf.opacity : 1);
    // 머리 위 레벨/이름 이름표 — 나 자신과 친구(멀티모드) 둘 다. 설정에서 끄면 setSeatNamePlate 내부에서 안 보이게 처리.
    // ⭐ 발밑 경험치 바도 같은 자리에서 갱신한다. 이름표를 끄면 바도 같이 숨는다(updateSeatExpBar 내부 처리).
    //    상대 좌석의 진행도(seat.friendExp)는 프리즌스 하트비트로 들어온다. 구버전 상대는 undefined라
    //    null을 넘겨 바를 안 그린다 — 0%로 그리면 "레벨업 직후"로 오해된다.
    /* ⚠️ 순서 주의 — 경험치 바가 **먼저**, 이름표가 나중이다(NAMEPLATE_BELOW_EXPBAR 주석 참고).
       이름표가 바 아래로 비키려면 바의 '이번 프레임' 위치를 알아야 한다. 예전 순서(이름표 → 바)
       그대로 두면 한 프레임 전 값을 보게 되어, 캐릭터가 움직일 때 이름표가 바를 파고든다. */
    /* 🌟 회차면 표시 레벨은 **이번 바퀴** 레벨이고 별이 붙는다. 해금 레벨(getFocusLevel · friendLevel)은 표시에만 안 쓴다 (개정 70). */
    if(seat.remote){
      const st = seat.friendStar || null, lv = st ? st.lv : (seat.friendLevel||1);
      expBarMod.updateSeatExpBar(seat, lv, (seat.friendExp==null ? null : seat.friendExp), st);
      overheadMod.setSeatNamePlate(seat, lv, seat.friendName||'(이름 없음)', st);
    }
    else if(seat.isMe){
      const st = focusLevelMod.myFocusShow(), lv = st ? st.lv : focusLevelMod.getFocusLevel();
      expBarMod.updateSeatExpBar(seat, lv, expBarMod.myExpCells(), st);
      overheadMod.setSeatNamePlate(seat, lv, getDisplayName(), st);
    }
    else if(seat.namePlateEl){ seat.namePlateEl.style.display='none'; if(seat.expBarEl) seat.expBarEl.style.display='none'; }   // 주캐릭터였다가 자리추가로 바뀐 좌석 — 이전 이름표가 남아있지 않게 숨김
    /* 💬 말풍선 — ★ 반드시 이름표·경험치 바 **뒤에** 갱신한다.
       반전 배치(캐릭터가 화면 위)에서는 이름표·바·말풍선이 전부 발밑 한 자리에 쌓이는데,
       비켜주는 쪽은 말풍선 하나다(서로 비키면 매 프레임 서로를 밀어내며 흘러내린다).
       비키려면 위 두 요소의 **이번 프레임 위치**를 알아야 하는데, 예전엔 말풍선이 먼저 돌아서
       한 프레임 전 값을 봤다 — 바가 그 사이에 움직이면 그대로 겹친 채로 남았다.
       ⚠️ 이 세 줄의 순서를 바꾸지 말 것. 순서가 곧 배치 규칙이다.
       (📢 확성기는 제거됨 → 커스텀 상태로 대체. 상태 말풍선이 곧 "지금 뭐 하는지"를 보여줌.) */
    /* 🏢 회사원 모드 — 상태 말풍선은 아예 안 뜬다(요청: 말풍선이 잠긴다).
       채팅만 머리 위 한 줄 라벨로 작게 남는다 — 모양 전환은 setSeatHeadBubble 이 담당한다.
       ⚠️ 이 세 갈래를 호출부에서 정하는 이유: '무엇을 보여줄지'는 여기가, '어떻게 보여줄지'는
          setSeatHeadBubble 이 정한다. 안쪽에서 상태/채팅을 다시 구분하려 들면 판정이 두 곳으로 갈린다. */
    const _chatting = !!(seat.chatBubbleUntil && now < seat.chatBubbleUntil);
    if(_hidden){ overheadMod.setSeatHeadBubble(seat, null); }   // 🙈 캐릭터 없이 말풍선만 뜨지 않게
    else if(officeMode){ overheadMod.setSeatHeadBubble(seat, _chatting ? seat.chatBubbleText : null); }
    else if(_chatting){ overheadMod.setSeatHeadBubble(seat, seat.chatBubbleText); }
    // 💭 상태 갈래만 '생각 말풍선'(동그라미 꼬리). 채팅은 뾰족 꼬리 그대로다.
    else{ overheadMod.setSeatHeadBubble(seat, _conf ? _conf.label : focusLevelMod._mobileBubbleText(_mobApp), true); }
    updateItemHandTrackers(seat);   // 책상 아이템 안의 hand_L/hand_R 지점을 이번 프레임 손 위치로 갱신
  });

  /* selected ring follows selected seat */
// if(selected){selRing.position.x=lerp(selRing.position.x,selected.group.position.x,1-Math.pow(0.001,dt));selRing.visible=true;}
  /* state bar shows selected seat */
  if(selected){const st=seatState(selected,now);const sc=STATES[st]||STATES.idle;dot.style.background=sc.color;stateLabel.textContent=sc.label;}

  for(let i=floatersMod.floaters.length-1;i>=0;i--){const f=floatersMod.floaters[i];f.userData.life+=dt;const p=f.userData.life/f.userData.dur;
    f.position.y+=dt*(f.userData.rise!=null?f.userData.rise:floatersMod.FLOATER_RISE);f.position.x+=f.userData.vx*dt;
    // 생애 60%까진 진하게 유지하다 마지막 40%에서만 빠르게 사라지게 — 오래 반투명 상태로 떠있으면서 탁해 보이는 구간을 최소화
    f.material.opacity=Math.max(0, p<0.6 ? 0.95 : 0.95*(1-(p-0.6)/0.4));
    f.scale.setScalar((f.userData.base!=null?f.userData.base:floatersMod.FLOATER_BASE_SCALE)*(1+p*0.4));
    if(p>=1){scene.remove(f);floatersMod.floaters.splice(i,1);}}

  rideBenchMod._checkCircusBalance(now);   // 🎪 묘기 균형 판정(흔들림 → 와해)
  rideBenchMod._updateRideChains(now);   // 🐾 올라탄(탑쌓기 포함) 좌석 위치를 아래층→위층 순으로 확정
  tricksMod._updateFlyingSeats(now, dt);   // 🪑 플라잉체어 — 날고 있는 캐릭터의 rig 좌표를 마지막에 덮어쓴다
  try{ awayPicMod._awayImgFollow(); }catch(_){}   // 🩹 자리비움 그림이 rig 를 매 프레임 따라간다(비행 버벅임) — _awayImgFollow 주석
  if(desktopMode){ renderer.clear(); }   // 투명 클리어 강제 — 프레임 사이 흰 잔상 방지
  /* 🍎 설정(런처) 화면에서는 #scene 이 display:none 이다(body.desktop.config) — 안 보이는 화면을 그리지 않는다.
     상태 계산은 위에서 그대로 돈다(돌아왔을 때 튀지 않게). 런처는 자기 루프(launcherLoop)가 따로 그린다. */
  if(!(document.body.classList.contains('desktop') && document.body.classList.contains('config'))) renderer.render(scene,camera);
  statusChipMod.updateMyStatusChipPosition();   // 본인 상태 칩 위치를 자기 좌석 발 밑에 맞춤
  if(!manual) requestAnimationFrame(frame);
}

/* ============================================================ 데스크탑(Electron) 모드 */
const desktopMode = !!window.companion || /[?&]desktop=1/.test(location.search);
/* ★ 피규어 모드 — 켜져 있으면 포커싱 어플 등록 여부와 무관하게 항상 깨어있는 겉모습만 유지.
   포커스 시간(레벨) 누적에는 영향 안 줌 — _focusWasActive는 실제 등록된 앱 사용 여부만 그대로 추적. */
/* 💾 설정을 저장하고 **실제로 남았는지 확인한다** — 조용한 실패를 없애기 위한 것이다.

   [왜 필요한가] localStorage 쓰기는 이 파일에서 99곳이고 그중 58곳이 `catch(e){}` 로 비어 있다.
     이 앱은 얼굴 PNG·커미션 GLB 까지 로컬에 넣으므로 저장 공간이 실제로 찬다
     (persistSavedParts·persistSavedDesks 의 '저장 공간이 부족해요' 가 그 신호다).
     꽉 차면 **새 키는 만들어지지 않는데 화면에는 아무 표시도 안 난다** — 그러면
     "설정을 켜도 다시 켜면 꺼져 있다"가 되고, 제보에는 원인이 하나도 안 실린다.
     같은 증상이 일부 사용자에게서만 나는 것도 이 성질과 맞는다(그 기기만 저장이 꽉 찼다).
   ★ 왕복 확인까지 한다 — setItem 이 던지지 않고도 값이 안 남는 환경이 있다.
   ⚠️ 안내는 **세션당 한 번**이다. 토글을 누를 때마다 뜨면 그것대로 못 쓴다.
   ⚠️ 이 헬퍼는 '설정' 같은 작은 값 전용이다. 슬롯·파츠·책상처럼 큰 값은 실패했을 때
     할 일이 다르므로(직전 저장값 보존 등) 각자의 처리를 그대로 둔다. */
let _lsWarned = false;
function _lsSet(key, val){
  const s = String(val);
  try{
    localStorage.setItem(key, s);
    if(localStorage.getItem(key) !== s) throw new Error('값이 남지 않음');
    return true;
  }catch(e){
    console.warn('[저장] ' + key + ' 저장 실패 — 이 설정은 앱을 껐다 켜면 사라집니다', e);
    if(!_lsWarned){
      _lsWarned = true;
      try{ toast('⚠ 설정을 저장하지 못했어요 — 저장 공간이 가득 찼을 수 있어요'); }catch(_){}
    }
    return false;
  }
}

const FIGURE_MODE_KEY = 'tw.figureMode';
let figureMode = (localStorage.getItem(FIGURE_MODE_KEY)==='1');
/* 포커싱 어플 게이트 — true면 자동 idle/focus 판정을 sleep으로 강제(=잠듦).
   등록된 앱이 하나도 없으면 항상 true, 등록된 앱이 있으면 "그 앱이 지금 활성 상태"일 때만 false.
   (피규어 모드면 초기값부터 false로 시작 — 첫 폴링 전까지 잠깐 잠든 것처럼 보이는 지연 방지) */
let focusGateSleep = !figureMode;
/* 🏢 회사원 모드 — 켜면 남의 마이홈이 안 열리고 말풍선이 잠기며, 상태칩 ■ 버튼 우클릭으로
   화면을 즉시 숨길 수 있다. (1-1 우클릭 차단 · 1-2 머리 위 라벨은 이후 단계)
   ⚠️ 선언 자리를 figureMode 옆으로 잡은 이유 — app.js 는 최상위에서 값을 읽는 코드가 많아
     선언 순서(TDZ)가 실제로 앱을 죽인 적이 있다. 이 값을 읽는 최상위 코드는 반드시
     **이 줄 아래**에 있어야 한다(refreshOfficeModeUI 처럼 나중에 불리는 함수 안은 상관없다).
     `node smoke.js` 가 그걸 잡는다. */
const OFFICE_MODE_KEY = 'tw.officeMode';
let officeMode = (localStorage.getItem(OFFICE_MODE_KEY)==='1');
/* ■ 화면 숨김 — **세션 한정이라 저장하지 않는다.**
   숨긴 채로 앱이 꺼졌다 켜지면 아무것도 없는 화면이 뜨는데, 그건 기능이 아니라 고장으로 읽힌다. */
let _officeHidden = false;
/* 숨길 대상을 JS 로 하나씩 지우지 않고 body 클래스 하나로 CSS 에 넘긴다 —
   이 코드베이스에서 "선택자를 하나씩 나열하다 빠뜨림"은 반복된 실패 양상이고
   (audit 검사 12·14·15 가 전부 그래서 생겼다), 새 요소가 생길 때마다 또 빠뜨린다. */
function setOfficeHidden(on){
  _officeHidden = !!on && officeMode;   // 회사원 모드가 꺼져 있으면 숨김 상태 자체가 성립 안 함
  document.body.classList.toggle('office-hidden', _officeHidden);
  const btn=document.getElementById('myStatusChipBtn');
  if(btn){
    /* ⚠️ .on 은 상태 메뉴가 열렸을 때 쓰는 눌린 표시다. 여기서 같이 쓰면 두 상태가 섞여
       메뉴를 닫는 순간 숨김 표시까지 지워진다 — 전용 클래스를 쓴다. */
    btn.classList.toggle('office-hiding', _officeHidden);
    btn.title = _officeHidden ? '우클릭: 화면 다시 보이기'
              : (officeMode ? '상태 (우클릭: 화면 숨기기)' : '상태');
  }
  /* 숨길 때 열려 있던 **칩 팝업**(상태·더보기·알림 등)은 닫는다 — 지나가는 것들이라 숨김을
     푼 뒤에도 떠 있으면 오히려 거슬린다.
     ⚠️ 창(설정·포커스 기록·마이홈 …)은 여기서 닫지 않는다. 그쪽은 CSS 의 body.office-hidden 이
       display 만 끄므로 상태를 쥔 채 사라졌다가 그대로 돌아온다 — 하던 일이 날아가면 안 된다.
       숨김 대상을 JS 로 나열하지 않는 이유는 CSS 쪽 주석 참고. */
  if(_officeHidden){
    /* force=true — 🎵 플레이리스트까지 닫는다. 이 창만은 예외로 남기면 안 된다:
       재생 중이면 _plSyncBgmBounds 가 패널 자리를 main 에 계속 알려서, 화면을 숨겨도
       유튜브 자식창이 그 자리에 그대로 떠 있게 된다(숨김이 안 된 것처럼 보인다). */
    try{ _closeChipPopups(null, true); }catch(_){}
    const sm=document.getElementById('myStatusMenu'); if(sm) sm.classList.add('hidden');
  }
}
function refreshOfficeChipUI(){
  if(!officeMode && _officeHidden) setOfficeHidden(false);   // 모드를 끄면 숨김도 반드시 풀린다
  else setOfficeHidden(_officeHidden);                       // 툴팁 문구를 모드에 맞춰 다시 씀
}
/* 숨기기 진입점 = **상태칩 ■ 버튼 우클릭** 하나다.
   ★ 예전엔 칩 그룹에 ▪ 전용 버튼을 하나 더 뒀는데, 그러려고 버튼이 일곱 개가 됐다.
     숨겼을 때 남는 것이 그 ■ 버튼이므로, 되돌리는 손짓도 같은 자리에 두는 편이 자연스럽다.
   ⚠️ 이 버튼은 #myStatusChip 안에 있어 클릭 통과 화이트리스트에 자동 포함된다 —
     밖으로 옮기면 숨긴 순간 되돌릴 길이 사라진다(그때는 앱 재시작밖에 없다).
   ⚠️ preventDefault 를 빼면 Electron 에서 기본 컨텍스트 메뉴가 같이 뜬다. */
(function bindOfficeHideGesture(){
  const btn=document.getElementById('myStatusChipBtn'); if(!btn) return;
  btn.addEventListener('contextmenu', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!officeMode) return;   // 회사원 모드가 꺼져 있으면 아무 일도 없다(토스트도 안 띄운다)
    setOfficeHidden(!_officeHidden);
  });
})();
refreshOfficeChipUI();   // ★ officeMode 선언 뒤에서만 부를 것 (위 TDZ 주석 참고)
/* 🔎 회사원 모드 진단 — **일부 사용자에게서만** "켜도 안 켜진다"는 제보가 있고, 코드만 봐서는
     어느 단계가 끊기는지 가릴 수가 없다(저장이 안 남는 것인지, 버튼이 안 붙은 것인지,
     켜지긴 하는데 눈에 보이는 변화가 없는 것인지). 세 가지를 한 번에 찍는다.
   ★ 런처/생성기 화면에서 F12 → `__officeDiag()`. 실행 화면은 창이 투명해 콘솔을 열기 어렵다
     (__mouseDiag 를 같은 이유로 같은 방식으로 두었다 — 그쪽 주석 참고).
   ⚠️ 진단만 한다. 여기서 상태를 고치지 말 것 — 고치면 그 다음 제보에서 원인이 또 지워진다. */
window.__officeDiag = function(){
  let 새키쓰기 = null;
  try{
    localStorage.setItem('tw.__probe', '1');
    새키쓰기 = (localStorage.getItem('tw.__probe') === '1');
    localStorage.removeItem('tw.__probe');
  }catch(e){ 새키쓰기 = '실패: ' + ((e && e.name) || e); }
  let used = 0;
  try{ for(const k in localStorage){ const v = localStorage.getItem(k); if(v != null) used += (k.length + v.length) * 2; } }catch(_){}
  return {
    저장값       : (()=>{ try{ return localStorage.getItem(OFFICE_MODE_KEY); }catch(e){ return '읽기실패'; } })(),
    메모리값     : officeMode,
    새키쓰기     : 새키쓰기,          // false 또는 '실패:…' 면 저장 공간이 원인이다
    저장사용량MB : (used / 1048576).toFixed(2),
    토글버튼     : !!document.getElementById('progOfficeModeToggle'),
    화면숨김중   : _officeHidden,
    숨김클래스   : document.body.classList.contains('office-hidden'),
  };
};
/* ===== 포커스 시간 누적 + 레벨 시스템 =====
   평생 누적 포커스 시간 1시간당 레벨 1 상승, 최대 999레벨(999시간 달성 시 더 안 늘어남).
   오늘 하루 누적은 [기록 열기] 팝업에 hh:mm:ss로 표시(자정 지나면 0으로 리셋, 레벨엔 영향 없음 — 평생 누적 별도). */
/* 본문은 focus-total.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FOCUS_TOTAL_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const focusTotalMod = (typeof TwFocusTotal === 'undefined') ? FOCUS_TOTAL_MOD_OFF : TwFocusTotal.createFocusTotal({
});
let _focusTotalSec=focusTotalMod._loadFocusTotalSec();

/* ═══ 📊 오늘 기록 전시 (2026-09-23 · handoff-2026-09-21-features §3 · 사용자 확정: 🕒 를 눌러 켜고 끈다) ═══
   포커스 기록창 첫 줄(현재/누적 기록) 옆 🕒(#focusLogShowClock)를 누르면 켜짐/꺼짐.
   켜지면 방 사람들 화면의 내 머리 위에 «오늘 H:MM». **초는 보내지 않는다.** 1분에 한 번 갱신(2026-09-23 요청).
   ★ 이모지 칸은 비운다 — 커스텀 상태 배관이라 이모지를 넣으면 캐릭터 앞(책상 위)에도 같이 떴다(제보).
   ★ 배관은 커스텀 상태 그대로(Presence.setFocusShow → _statusOut) — 규칙 · 필드 변경 없음.
   ★ 상태가 켜져 있으면 그것이 먼저 보이고, 상태를 끄면 기록이 보인다(_statusOut · statusConfFor).
   ★ 회사원 모드에서는 안 보낸다(토글을 켜 둬도 null). 모드를 켜는 순간 거둔다(progOfficeModeToggle).
   ★ 켜짐은 기억한다(tw.focusShow) — 설정 성격의 작은 값이라 _lsSet.
   ⚠️ 값은 보내는 쪽이 정한다(setLevel 과 같은 수준). 랭킹을 붙일 거면 서버 값이 필요하다. */
/* 본문은 focus-share.js 로 옮겼다(앱 FSD 45번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FOCUS_SHARE_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const focusShareMod = (typeof TwFocusShare === 'undefined') ? FOCUS_SHARE_MOD_OFF : TwFocusShare.createFocusShare({
  Presence: Presence,
  _lsSet: (...a)=>_lsSet(...a),
  _rolloverFocusToday: (...a)=>focusTotalMod._rolloverFocusToday(...a),
  officeMode: ()=>officeMode,
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatus,
});

/* ═══ 🫧 자리비움 그림 (2026-09-23 · handoff-2026-09-21-features §2 · 시안 A 확정 · 500×500 · 캐릭터 자리) ═══════════
   [내 정보] 머리 아래 «자리비움 그림» 칸에서 투명 PNG 를 등록하면, 자리비움일 때 **캐릭터 자리에** 그 그림이 선다
   (내 화면 + 방 사람들 화면). 등록 안 한 사람 · 구버전 · 못 불러온 그림은 예전 그대로(투명 캐릭터 + 책상 🫧).
   ★ 그림은 500×500 캔버스에 비율 유지로 맞춰 **WebP** 로 굽는다(투명 유지). 300KB 를 넘으면 품질을 낮춰 다시 굽고,
     끝까지 넘으면 올리지 않는다. Storage 규칙도 `away/` 경로만 300KB 미만(users/ 2MB 와 별개 경로 — 규칙이 OR 라서).
   ★ 전파는 URL 한 줄 — users/{uid}/awayImg(기기 간) + 방 payload awayImg. Storage 주소(https://firebasestorage.googleapis.com/)
     가 아니면 받는 쪽이 버린다(_awayUrlOk) — 아무 주소나 방 사람들 화면에서 불러오게 두지 않는다.
   ★ 원격 주소를 3D 로 그리는 것은 방 얼굴(_loadImgCors)이 이미 하는 길 그대로다. 못 불러오면 조용히 🫧.
   ★ 회사원 모드에서는 그림을 세우지 않는다(보는 사람 기준 · 예전 모양).
   ⚠️ 관리자가 [그림 내리기] 하면 users/{uid}/awayImg 와 파일이 지워진다 — 파일이 없으니 남들 화면은 곧바로 🫧,
     본인 기기는 다음 부팅의 _awayBootSync 가 로컬 값을 비운다. */
/* 본문은 away-pic.js 로 옮겼다(앱 FSD 22번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const AWAY_PIC_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const awayPicMod = (typeof TwAwayPic === 'undefined') ? AWAY_PIC_MOD_OFF : TwAwayPic.createAwayPic({
  Presence: Presence,
  _loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  camera: camera,
  findMySeat: (...a)=>findMySeat(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  measureHeadBoxNoParts: (...a)=>measureHeadBoxNoParts(...a),
  officeMode: ()=>officeMode,
  renderer: renderer,
  seats: seats,
  toast: (...a)=>toast(...a),
});

/* ═══ 🚩 신고하기 (2026-09-23 · 시안 확정) ═══════════════════════════════════════════════════════════
   좌석 · 책상 · 이름표 우클릭 «🚩 신고하기…» → 사유 라디오(캐릭터 · 자리비움 그림 · 닉네임 · 기타 40자) → [신고].
   ★ 서버: reports/{신고당한 uid}/{내 uid} = { kind, note?, nick, code4, ts } — 규칙이 «로그인한 본인 칸만» 쓰게 한다.
     같은 사람을 또 신고하면 같은 칸을 덮는다 = 칸 수가 곧 «서로 다른 신고자 수».
   ★ 신고자에 대해 남기는 것은 **닉네임 + 친구 코드 뒷자리 4자리 + 사유**뿐(요청).
   ★ 신고하면 내 화면에서 그 사람을 숨긴다(_reportHiddenUids · 계정 기준 · 모든 방).
   ★ 관리자 목록(_openReportAdmin)에는 서로 다른 REPORT_ADMIN_MIN 명 이상에게 신고된 사람만 뜬다. */
/* 본문은 둘로 나눠 옮겼다 — 신고 창 · 공용 도우미는 report.js(앱 FSD 11번), 관리자 신고 목록은 admin/admin-report.js.
   팝업 칸(한 번에 하나만 열리는 자리)은 report.js 가 가지고, 관리자 목록은 읽는 · 쓰는 함수로만 만진다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const REPORT_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const reportMod = (typeof TwReport === 'undefined') ? REPORT_OFF : TwReport.createReport({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  awayUrlOk: (...a)=>awayPicMod._awayUrlOk(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  reportHiddenSave: (...a)=>hiddenSeatsMod._reportHiddenSave(...a),
  reportHiddenUids: hiddenSeatsMod._reportHiddenUids,
  myFriendCodeKey: MY_FRIEND_CODE_KEY,
});
const ADMIN_REPORT_OFF = {};
const adminReport = (typeof TwAdminReport === 'undefined' || reportMod === REPORT_OFF) ? ADMIN_REPORT_OFF : TwAdminReport.createAdminReport({
  toast: (...a)=>toast(...a),
  awayUrlOk: (...a)=>awayPicMod._awayUrlOk(...a),
  isAdmin: ()=>isAdmin,
  reportClose: (...a)=>reportMod.close(...a),
  reportBox: (...a)=>reportMod.box(...a),
  kinds: reportMod.KINDS,
  adminMin: reportMod.ADMIN_MIN,
  reportOv: (...a)=>reportMod.ov(...a),
  setReportOv: (...a)=>reportMod.setOv(...a),
  reportEsc: (...a)=>reportMod.esc(...a),
  setReportEsc: (...a)=>reportMod.setEsc(...a),
});

/* ═══ ⭐ 포커스 레벨 · 해금 안내 · 회차 별 색 ═══ */
/* 본문은 focus-level.js 로 옮겼다(앱 FSD 26번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const FOCUS_LEVEL_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const focusLevelMod = (typeof TwFocusLevel === 'undefined') ? FOCUS_LEVEL_MOD_OFF : TwFocusLevel.createFocusLevel({
  DANCE_MOVES: iDeskMod.DANCE_MOVES,
  FOCUS_CYCLE_CAP: focusTotalMod.FOCUS_CYCLE_CAP,
  FOCUS_CYCLE_SEC: focusTotalMod.FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS: focusTotalMod.FOCUS_LEVEL_CAP_HOURS,
  FOCUS_TODAY_DATE_KEY: focusTotalMod.FOCUS_TODAY_DATE_KEY,
  FOCUS_TODAY_SEC_KEY: focusTotalMod.FOCUS_TODAY_SEC_KEY,
  FOCUS_TOTAL_CAP_SEC: focusTotalMod.FOCUS_TOTAL_CAP_SEC,
  FOCUS_TOTAL_KEY: focusTotalMod.FOCUS_TOTAL_KEY,
  IDESK_ENABLED: iDeskMod.IDESK_ENABLED,
  INTERACTION_DESKS: iDeskMod.INTERACTION_DESKS,
  Presence: Presence,
  _acctDetached: ()=>accountMod._acctDetached(),
  _focusDayStr: (...a)=>focusTotalMod._focusDayStr(...a),
  _focusSessionSec: ()=>focusTotalMod._focusSessionSec(),
  _focusTodaySec: ()=>focusTotalMod._focusTodaySec(),
  _focusTotalSec: ()=>_focusTotalSec,
  _myInbox: ()=>_myInbox,
  _myInboxReady: ()=>_myInboxReady,
  appMode: ()=>appMode,
  findMySeat: (...a)=>findMySeat(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyLoginEmail: (...a)=>accountMod.getMyLoginEmail(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  myInfoMod: myInfoMod,
  renderLauncher: (...a)=>renderLauncher(...a),
  toast: (...a)=>toast(...a),
  wdDraftDef: ()=>wardrobeMod.wdDraftDef(),
  setFocusSessionSec: (v)=>{ focusTotalMod.setFocusSessionSec(v); },
  setFocusTodaySec: (v)=>{ focusTotalMod.setFocusTodaySec(v); },
  setFocusTotalSec: (v)=>{ _focusTotalSec = v; },
});
function getFocusLevel(...a){ return focusLevelMod.getFocusLevel(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)

/* ═══ 🎰 가챠 모듈 연결 · 🔑 쓰기 거부 안내 ═══ */
/* 🎰 파츠 가챠 — 코어(보유분 · 확률 · 뽑기 · 서버 동기화 · 미보유 파츠 회수)와 파츠 보관함(T) · 뽑기 창은 parts/gacha.js 로 옮겼다
   (앱 FSD 8번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(localStorage 읽기 · 시각 부트스트랩 · 부팅 동기화 4.2초 타이머 · 10분 tick ·
     창 버튼 · 끌기 · ESC · 바깥 클릭 · blur 연결)이 예전과 같은 때 돈다.
   저장 키 세 줄은 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)이 같이 써서 여기 두고 값으로 넘긴다(달성표 CHAL_KEY 와 같은 방식).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). isAdmin · savedParts · PART_CATS · wdDraftDef · activeWdAdj 는 다시 대입되는 let 이라 읽는 함수로,
   activeWdAdj 를 바꾸는 것은 쓰는 함수로 넘긴다. seats · slots · Presence 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   부르는 곳은 gachaMod.이름(전부 이 줄보다 늦게 돈다). 바로 아래 🔑 «서버가 조용히 거부하는 기기» 안내는 캐릭터 슬롯도 써서 여기 남겼다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다.
   ⚠️ 이름을 gacha 로 짓지 않은 까닭 — partsInCatFor(cat, gacha) · 파츠 등록의 const gacha 가 가린다. */
const GACHA_OWNED_KEY = 'tw.gachaOwned';
const GACHA_TS_KEY    = 'tw.gachaOwnedTs';   // 이 기기가 마지막으로 gachaOwned 를 '바꾼' 시각(ms)
const GACHA_BONUS_KEY = 'tw.gachaBonus';     // 👑달성표 주간 보상으로 얹힌 추가 뽑기 횟수
const GACHA_OFF = { isGachaPart:()=>false, isGachaColorUnlocked:()=>false, gachaCount:()=>0, sceneHasColorGroup:()=>true, DUPES_FOR_COLOR:4,
  syncGachaToServer(){}, pruneUnownedGachaParts(){}, renderGachaInv(){}, toggleGachaInv(){}, isInvOpen:()=>false, isDrawOpen:()=>false,
  selId:()=>null, owned:()=>({}), bonus:()=>0, setBonusLocal(){}, resetMemory(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const gachaMod = (typeof TwGacha === 'undefined') ? GACHA_OFF : TwGacha.createGacha({
  toast: (...a)=>toast(...a),
  srvNow: (...a)=>roomSyncMod._srvNow(...a),
  warnServerWriteDenied: (...a)=>_warnServerWriteDenied(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  findMySeat: (...a)=>findMySeat(...a),
  escHtml: (...a)=>escHtml(...a),
  openPartRegister: (...a)=>adminPartReg.openPartRegister(...a),
  syncPartRegGachaLock: (...a)=>adminPartReg.syncPartRegGachaLock(...a),
  toggleEquip: (...a)=>wardrobeMod.toggleEquip(...a),
  createWardrobeAdjPanel: (...a)=>wardrobeMod.createWardrobeAdjPanel(...a),
  deletePart: (...a)=>adminPartReg.deletePart(...a),
  clearMultiPanelRef: (...a)=>wardrobeMod._clearMultiPanelRef(...a),
  refreshWdPreviewColorSection: (...a)=>wardrobeMod.refreshWdPreviewColorSection(...a),
  updateWdGizmoForActivePanel: (...a)=>wardrobeMod.updateWdGizmoForActivePanel(...a),
  commitWdDraft: (...a)=>wardrobeMod.commitWdDraft(...a),
  syncWdPreviewOwner: (...a)=>wardrobeMod.syncWdPreviewOwner(...a),
  wdPreviewSavedPos: (...a)=>wardrobeMod.wdPreviewSavedPos(...a),
  placeWdPreview: (...a)=>wardrobeMod.placeWdPreview(...a),
  clampWdPreviewIntoView: (...a)=>wardrobeMod.clampWdPreviewIntoView(...a),
  refreshWdPreviewChar: (...a)=>wardrobeMod.refreshWdPreviewChar(...a),
  detachWdGizmo: (...a)=>wardrobeMod.detachWdGizmo(...a),
  isAdmin: ()=>isAdmin,
  savedParts: ()=>premiumMod.savedParts(),
  partCats: ()=>premiumMod.PART_CATS(),
  wdDraftDef: ()=>wardrobeMod.wdDraftDef(),
  activeWdAdj: ()=>wardrobeMod.activeWdAdj(),
  setActiveWdAdj: (v)=>{ wardrobeMod.setActiveWdAdj(v); },
  seats: seats,
  slots: slots,
  presence: Presence,
  ownedKey: GACHA_OWNED_KEY,
  tsKey: GACHA_TS_KEY,
  bonusKey: GACHA_BONUS_KEY,
});

/* 🔑 [2026-09-12 제보] «서버가 조용히 거부하는 기기» ══════════════════════════════
   [제보] "2번 PC 에서 뽑은 가챠가 1번 PC 에서 안 보인다. 2번에서도 같은 구글 계정으로 연동하니 해결됐다."
   [무슨 일인가] 유저 코드가 구글 계정에 묶이면(userAuth/{코드}) 규칙이 users/{코드} 의 자기 소유
     가지를 «주인이 없거나 나일 때»로 잠근다. 그런데 **비밀번호 계정 이전은 인증을 만들지 않는다** —
     코드만 갈아탈 뿐이다. 그래서 제보자의 순서대로
       ① PC2 가 비밀번호로 코드 A 를 받고 → ② PC1 이 코드 A 에 구글 연동을 하면
     그 순간부터 PC2 의 users/A 쓰기가 전부 거부된다.
   [왜 가장 늦게 신고되는 종류인가] 거부는 예외를 던지지 않는다. 로컬 값은 그대로 남아 화면에는
     멀쩡히 보이고, 서버에만 안 올라간다 — «내 PC 에선 있는데 다른 PC 엔 없다» 로만 드러난다.
     게다가 이 앱의 동기화는 ts 최신 승 **통째 덮어쓰기**라, 거부당하는 기기는 자기 것도 못 올리고
     남의 것도 못 지우므로 그냥 영원히 갈라진 채로 남는다.
   [고치는 길은 이미 있다] 그 기기에서 같은 구글 계정으로 로그인하면 주인이 되어 쓰기가 통과한다.
     제보자가 스스로 찾아낸 그 길이 정답이다 — 그러니 여기서 할 일은 **그 길을 알려주는 것**이다.
   ★ 막지 않는다. 쓰기 시도는 그대로 두고(로그인하는 순간 다음 동기화가 그대로 올린다) 안내만 한다.
   ⚠️ 세션당 한 번만. 가챠·집중·마이홈이 각자 실패할 때마다 띄우면 토스트가 도배된다.
   ⚠️ «주인이 없다/조회 실패»면 아무 말도 하지 않고 표식도 도로 푼다 — 네트워크가 끊긴 부팅에서
     있지도 않은 계정 경고를 띄우면 안 되고, 진짜로 묶여 있을 때 그 한 번을 써버려도 안 된다.
   ⚠️ 로그인돼 있는데 실패했다면 그건 다른 원인이다(규칙 배포 누락 등). 그때는 조용히 물러난다 —
     틀린 안내는 안 하느니만 못하다. 콘솔에는 남으므로 추적은 가능하다. */
let _srvDeniedWarned = false;
async function _warnServerWriteDenied(what){
  if(_srvDeniedWarned) return;
  _srvDeniedWarned = true;                    // 판정하는 동안 또 불려도 두 번 뜨지 않게 먼저 세운다
  const code = getMyUserId();
  let owner;
  try{
    owner = (window.firebaseAPI && firebaseAPI.authOwnerOf) ? await firebaseAPI.authOwnerOf(code) : undefined;
  }catch(_){ owner = undefined; }
  if(owner === undefined || owner === null){ _srvDeniedWarned = false; return; }   // 조회 실패·주인 없음
  let mine = null;
  try{ mine = (window.firebaseAPI && firebaseAPI.authCurrentUid) ? firebaseAPI.authCurrentUid() : null; }catch(_){}
  if(mine && mine === owner){ _srvDeniedWarned = false; return; }                  // 주인이 맞다 = 다른 원인
  try{ console.warn('[계정] ' + what + ' 서버 반영 거부 — 이 기기는 코드 ' + code + ' 의 주인이 아니다(주인 uid=' + owner + ')'); }catch(_){}
  try{ toast('🔑 ' + what + ' 기록이 서버에 저장되지 않았어요 — 이 PC의 로그인이 풀려 있어요. 앱을 다시 시작하면 로그인 화면이 나와요'); }catch(_){}
}

/* ═══ 🎨 디자인 테마 ═══════════════════════════════════════════════════════
   축이 두 개다 — '모양'(테마)과 '색'(액센트). 두 축은 독립이라 2×5=10가지가 나온다.
     · 모양 : <html data-theme>  = (없음)=기본 / "bubble"
     · 색   : <html data-accent> = c1~c5
   실제 색·모서리·글꼴 값은 전부 HTML의 CSS 변수에 있다. 여기서는 속성만 건다.

   ★ 색상 5칸의 '내용'은 테마마다 다르다(CSS에서 html[data-theme="bubble"][data-accent=...]로 덮어씀).
     Win98은 채도 높은 색이, 버블은 파스텔이 어울려서 같은 색표를 공유하면 한쪽이 반드시 촌스러워진다.
   ★ 저장은 localStorage 2개(tw.theme / tw.accent). 계정 동기화로 옮기려면 이 두 값만 서버에 얹으면 된다.
   ★ 부팅 시 최대한 이른 시점에 applyTheme()을 부른다 — 늦게 부르면 기본 테마가 한 프레임 번쩍인다. */
/* 본문은 theme.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const THEME_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const themeMod = (typeof TwTheme === 'undefined') ? THEME_MOD_OFF : TwTheme.createTheme({
  themeUiMod: ()=>themeUiMod,
});
function applyTheme(...a){ return themeMod.applyTheme(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
/* ═══ 🎨 [2026-09-15 제보 5] 테마 「버블」이 마이홈 방명록엔 안 먹음 ═══════════════════════
   [원인] 방명록·디자인 창은 window.open → main.js setWindowOpenHandler 가 **별도 BrowserWindow** 로 연다.
     별도 창 = 별도 document 라 메인 <html> 의 data-theme 이 거기까지 안 간다. 게다가 그 창들의 CSS(GB_HTML·
     DS_HTML)는 색이 전부 하드코딩이라 속성을 걸어도 받을 규칙이 없었다 — 고장이 아니라 구조였다.
   [대응] 둘 다 메운다.
     ① GB_HTML·DS_HTML 의 색·모서리·글꼴을 var(--win-*) 로 바꿨다(폴백은 예전 값 — 토큰이 없으면 옛 모습).
     ② 창을 열 때 이 함수가 메인 문서의 data-theme·data-accent 를 자식 <html> 에 걸고, 토큰 값을
        getComputedStyle 로 읽어 <style id=twThemeTokens> 로 넣는다. 값을 옮기므로 메인 CSS 와 두 벌이 안 된다.
     ③ applyTheme 가 열린 창에도 다시 건다(_themeChildDocs) — 창을 띄운 채 테마를 바꿔도 즉시 따라간다.
   ⚠️ 토큰 목록에 없는 변수는 자식 창에서 var() 폴백으로 떨어진다. 자식 CSS 에 --win-* 를 새로 쓰면 여기도 추가할 것. */
/* 본문은 theme-ui.js 로 옮겼다(앱 FSD 44번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const THEME_UI_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const themeUiMod = (typeof TwThemeUi === 'undefined') ? THEME_UI_MOD_OFF : TwThemeUi.createThemeUi({
  ACCENT_KEY: themeMod.ACCENT_KEY,
  THEME_COLORS: themeMod.THEME_COLORS,
  THEME_DEFAULT_ACCENT: themeMod.THEME_DEFAULT_ACCENT,
  THEME_KEY: themeMod.THEME_KEY,
  applyTheme: (...a)=>themeMod.applyTheme(...a),
  getAccent: (...a)=>themeMod.getAccent(...a),
  getTheme: (...a)=>themeMod.getTheme(...a),
});
/* ★ 최상위 호출은 반드시 위 const 선언들 '뒤'에 둔다.
   앞에서 부르면 THEME_COLORS가 아직 TDZ라 ReferenceError가 나고, 최상위에서 터지므로
   app.js 전체가 그 줄에서 멈춘다 = 프로그램이 아예 안 켜진다. (실제로 한 번 그렇게 만들었다) */
themeMod.applyTheme();      // 파싱 즉시 1회 — 늦게 부르면 기본 테마가 한 프레임 번쩍인다
themeUiMod.bindThemeUI();     // 설정창 테마·색상 칩 바인딩 (요소가 없으면 조용히 넘어감)

/* ═══ ⭐ 경험치 바 ═══════════════════════════════════════════════════════════
   캐릭터 발밑에 1px 외곽선 통짜 게이지로 레벨 진행도를 보여준다. 내 좌석·상대 좌석 공용.

   · getFocusLevel() = 1 + floor(누적초/3600) 이므로 '1시간 = 1레벨'.
   · 레벨 안 진행도는 (누적초 % 3600)을 5분(300초) 단위로 끊어 0~12칸으로 센다.
     ★ 칸 단위로 끊는 건 의도적이다 — 부드럽게 채우면 "5분마다 오른다"가 눈에 안 보인다.
   · 색은 레벨 구간별 단색이고, 친구창 레벨 배지(.mh-flv)와 '같은' 구간을 쓴다 —
     경계값은 lvTierNum() 한 곳에서, 색은 CSS 「🏅 레벨 티어 토큰」 한 곳에서 나온다.
     같은 레벨인데 배지와 바 색이 다르면 그게 더 헷갈리므로, 어느 쪽도 여기서 다시 적지 않는다.

   ★ 상대방 좌석도 보인다. 진행도는 프리즌스 하트비트에 exp(0~12) 한 필드로 실려 온다.
     하트비트는 원래 30초마다 lastSeen을 쓰고 있으므로 '추가 쓰기가 0회'다.
     따로 push하면 시간당 12회가 늘지만, 어차피 5분 단위 바라 30초 지연은 티도 안 난다. */
/* 본문은 exp-bar.js 로 옮겼다(앱 FSD 45번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const EXP_BAR_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const expBarMod = (typeof TwExpBar === 'undefined') ? EXP_BAR_MOD_OFF : TwExpBar.createExpBar({
  _focusTotalSec: ()=>_focusTotalSec,
  _starPaint: (...a)=>lvTierMod._starPaint(...a),
  lvBarClass: (...a)=>lvTierMod.lvBarClass(...a),
  lvStarBarClass: (...a)=>lvTierMod.lvStarBarClass(...a),
  overheadMod: overheadMod,
});

/* ═══ 🕒 포커스 누적 기기 간 공유 ═══════════════════════════════════════════
   예전엔 tw.focusTotalSec이 순수 로컬이라, 계정을 연동해도 A컴퓨터의 3시간이 B컴퓨터에
   반영되지 않았다(계정 이전 스냅샷으로 '연동 그 순간' 값만 1회 복사, 그것도 덮어쓰기).
   이제 서버(users/{uid}/focus/totalSec)를 원본으로 두고 양방향으로 맞춘다.

   ★★ 병합 규칙은 **증분 + max 바닥** 이다. 서버는 이 한 줄로 요약된다:
         새 서버값 = max(서버값 + 이 기기의 증분, 이 기기의 로컬 누적치)
     두 항이 각각 다른 사고를 막는다.
       · 증분(서버값 + delta) — "이 기기에서 **새로 일한 만큼**"을 반드시 얹는다.
         이게 없으면 뒤처진 기기에서 한 작업이 통째로 증발한다. 실제 사례:
           a=8h, b=2h 인 상태에서 연동이 안 따라와 b 로 4시간을 일해 b=6h 가 됐다.
           max 만 쓰면 a 로 돌아갔을 때 8h 가 이겨서 그 4시간이 사라진다. 증분이면 8+4=12h.
       · max 바닥(로컬 누적치) — 마크가 어긋나 증분이 0으로 잡히는 상황(연동/해제 직후,
         구버전에서 올라온 기기, 동기화가 오래 끊겼던 기기)에서도 **최소한 큰 쪽은 따라간다**.
         레벨이 눈에 띄게 깎이는 사고는 이 항이 막는다.
     두 항 모두 서버 트랜잭션 안에서 계산되므로 값은 절대 줄어들지 않는다(단조 증가).

   ★ 증분의 근거는 마크(FOCUS_SYNCED_KEY) = "이 기기가 마지막으로 서버에 반영한 로컬 누적치".
       delta = 로컬 − 마크. 마크가 **아예 없으면**(이 기기가 서버와 한 번도 안 맞춰봄)
       delta 를 0 으로 두고 max 바닥만 태운다 — 로컬 값이 서버에 얼마나 반영돼 있는지 알 수
       없는 상태라, 통째로 증분으로 올리면 공유 이력이 두 번 세어져 누적이 거의 두 배가 된다.

   ⚠️ 증분은 멱등이 아니다. 서버 쓰기는 성공했는데 응답을 못 받으면(끊김) 같은 증분이 다음에
     한 번 더 올라간다. 그래서 마크는 **응답이 ok 일 때만** 옮긴다. 그래도 완전히 막을 수는
     없는 성질이라, 이 부작용이 감당 안 되면 delta 를 0 으로 고정해 max 전용으로 바꾸면 된다
     (서버 쪽은 그대로 두어도 동작한다). */
/* (앱 FSD 26번) 이 자리의 본문도 focus-level.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══════════════════════════════════════════════════════════════════════════════
   📱 태블릿·폰 포커싱 연결 (개정 74 · handoff-2026-09-18 §4-③)
   ───────────────────────────────────────────────────────────────────────────────
   폰·태블릿은 «지금 켜진 앱» 을 알려 주지 않는다 → 기기 자동화(iOS 단축어 · MacroDroid)가
   앱 열림/닫힘 때 mobileLink/{uid}/state 에 { on, app } 을 쓰고, **PC 가 여기서 판정한다.**
   ★ 판정은 이 파일 한 곳(_applyActiveAppState)에서 합친다. main.js · preload 는 안 건드린다.
   ★ lastActivity 를 인위로 갱신하지 않는다 — 펜 앱 판정·입력 진단(main.js)과 섞인다. 전용 플래그로 가른다.
   ⚠️ 안전 상한 MOBILE_MAX_ON_MS — 새 «열림» 없이 이보다 오래 켜져 있으면 꺼짐으로 본다
      (배터리 방전·강제 종료로 «닫힘» 이 안 온 경우). 4시간 넘게 연속으로 그리면 앱을 한 번 다시 열면 된다.
   ═══════════════════════════════════════════════════════════════════════════ */
/* (앱 FSD 26번) 이 자리의 본문도 focus-level.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🖥️ 활성 앱 판정(_applyActiveAppState) ═══ */
let _focusLastTick=performance.now(), _focusWasActive=false;
function _applyActiveAppState(state){
  if(!state) return;
  const now=performance.now(), dt=(now-_focusLastTick)/1000; _focusLastTick=now;
  // 직전 폴링 시점에 "등록된 포커스 앱을 실제로 쓰고 있었다"면 그 사이 흐른 시간만큼 누적.
  // dt가 비정상적으로 크면(창 최소화·컴퓨터 절전 등으로 폴링이 끊겼던 경우) 오차 누적 방지로 건너뜀.
  // ★ 기록 정지 기준 = 캐릭터가 idle로 바뀌는 순간(FOCUS_MS). 예전엔 sleep(SLEEP_MS=8초) 기준이라
  //   손을 뗀 뒤 캐릭터가 이미 idle인데도 8초까진 기록이 계속 쌓였다. 이제 마지막 입력 후 FOCUS_MS가
  //   지나 캐릭터가 '집중(focus) 포즈'를 벗어나면(=idle 진입) 즉시 누적을 멈춘다.
  //   → "실제로 입력하며 집중하는 동안"만 시간이 쌓임. 입력이 재개되면 다음 폴링부터 다시 누적.
  /* 📱 폰 켜짐이면 PC 입력 조건을 건너뛴다 — PC 입력이 없는 게 정상이라 그대로 두면 한 초도 안 쌓인다(요구: PC 와 똑같이). */
  const mobOn = focusLevelMod._mobileOn();
  const pcNotFocusing = (now - lastActivity) > focusWindowMs();
  const notFocusingNow = mobOn ? false : pcNotFocusing;
  if(_focusWasActive && !notFocusingNow && dt>0 && dt<30) focusLevelMod.addFocusSeconds(dt);
  /* 👑 달성표 🎯집중 — "오늘 그 앱을 몇 초 썼나"를 같은 dt 로 여기서 센다.
     ★ 새 타이머를 만들지 않는 이유: dt 는 _focusLastTick 을 소비해서 나온다. 밖에서 따로 재면
       같은 구간을 두 번 세거나 서로 _focusLastTick 을 리셋해서 둘 다 틀린다.
     ★ _focusWasActive(=등록된 포커스 앱이 활성)를 조건에 안 거는 이유: 그건 평생 누적치용 게이트다.
       달성표는 사용자가 고른 exe 하나만 보므로, 그 앱이 포커싱 어플 슬롯에서 빠져도 계속 세야 한다. */
  if(dt>0 && dt<30 && !pcNotFocusing) weeklyChal.focusTick(state, dt);   // 📱 폰 시간은 안 넣는다(exe 기준 · 이번 범위 밖)
  /* 이 기기의 플랫폼 접두사를 main 이 보낸 키에서 배운다 — 렌더러가 스스로 판단하지 않는다.
     구버전 main 은 key 를 안 보내므로 null 로 남고, 그때는 플랫폼 판정을 아예 안 한다. */
  if(state.key) weeklyChal.setKeyPlatform(String(state.key).split(':')[0] || null);
  _penAppFocused = !!state.isPenApp;   // 🖊️ 펜 앱이면 기록 창을 4초로 넓힘(focusWindowMs)
  focusGateSleep = figureMode ? false : (mobOn ? false : (state.hasAnyRegistered ? !state.isFocusedAppRegistered : true));
  _focusWasActive = !!(state.hasAnyRegistered && state.isFocusedAppRegistered) || mobOn;
}

/* ═══ 👑 달성표 · 🍅 뽀모도로 모듈 연결 ═══ */
/* 👑 달성표(주간 규칙 · 기록 · 화면) — parts/weekly-challenge.js 로 옮겼다(앱 FSD 2번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(localStorage 읽기 · 부팅 동기화 타이머 · 20초 tick · 버튼 연결)이
     예전과 같은 때 돈다. 함수 deps 는 화살표로 감싼다(부를 때 찾게). appMode · _gachaBonus 는 다시 대입되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const CHAL_KEY = 'tw.chal';   // 👑 달성표 로컬 기록 — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)도 쓴다
const WEEKLY_CHAL_OFF = { syncChalToServer(){}, open(){}, isOpen:()=>false, focusTick(){}, setKeyPlatform(){}, resetMemory(){} };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const weeklyChal = (typeof TwWeeklyChallenge === 'undefined') ? WEEKLY_CHAL_OFF : TwWeeklyChallenge.createWeeklyChallenge({
  getMyUserId: ()=>getMyUserId(),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  formatHMS: (...a)=>focusLevelMod.formatHMS(...a),
  premiumOn: ()=>_premiumOn(),
  dayShifted: (...a)=>focusTotalMod._dayShifted(...a),
  focusDayStr: (...a)=>focusTotalMod._focusDayStr(...a),
  dayStartHour: focusTotalMod.DAY_START_HOUR,
  setGachaBonusLocal: (...a)=>gachaMod.setBonusLocal(...a),
  renderGachaInv: ()=>gachaMod.renderGachaInv(),
  gachaBonus: ()=>gachaMod.bonus(),
  appMode: ()=>appMode,
  storageKey: CHAL_KEY,
});

/* 🍅 뽀모도로(포커스 기록창 안쪽 서랍 · 집중 / 휴식 타이머)는 parts/pomodoro.js 로 옮겼다(앱 FSD 6번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(tw.pomo · tw.pomoRun 읽기 · 버튼 연결 · 첫 그리기 · 1초 tick)이
     예전과 같은 때 돈다. toast · _focusShowPush 는 화살표로 감싼다(부를 때 찾게). weeklyChal(바로 위) · _pomoSnd(효과음 공장)는
     이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   ★ 머리 위 문구는 예전처럼 _focusShowConf 가 typeof _pomoShowText 로 본다 — 그 함수는 이 줄보다 먼저(bindFocusShow) 불려서
     반환값을 볼 수 없으므로 모듈이 window._pomoShowText 고리를 건다(만들기 전에는 '' — 예전과 같다).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const POMODORO_OFF = { showText:()=>'', open(){}, render(){}, tick(){}, cfg:()=>null, run:()=>null };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const pomodoro = (typeof TwPomodoro === 'undefined') ? POMODORO_OFF : TwPomodoro.createPomodoro({
  toast: (...a)=>toast(...a),
  focusShowPush: (...a)=>focusShareMod._focusShowPush(...a),
  weeklyChal: weeklyChal,
  pomoSnd: sfxMod._pomoSnd,
});

/* ═══ 🖥️ 데스크탑 실행 화면 — 창 크기 · 업데이트 배너 · 전역 입력 · 클릭 통과 · 하트비트 ═══ */
let myHomeOpen = false;   // ★ 마이홈 팝업이 "런처에서" 열려있는지 — 이때만 창 크기를 생성기처럼 키움
                          //   (실행 화면은 이미 전체화면이라 그 안에서 여는 건 그대로 둬도 잘 맞음)
function applyDesktopRunClass(){ if(!desktopMode) return;
  const launcherOn = document.getElementById('launcher').classList.contains('on');
  /* 🪟 **여는 쪽 플래그가 아니라 화면을 본다.** 예전엔 myHomeOpen 만 봤는데, 그 플래그를 세우는
     자리가 셋(open · openFriendHomeView · 런처 복귀)이라 한 곳만 어긋나도 창 크기가 갈렸다.
     실제로 openFriendHomeView 가 이 함수를 안 불러서 마이홈이 380px 창 밖으로 나갔다(제보).
     오버레이의 .on 이 곧 "지금 마이홈이 떠 있다"이므로 그걸 직접 본다 — 새 진입 경로가 생겨도
     플래그를 세우는 것을 잊었다는 이유로 창 크기가 틀리는 일이 없어진다.
     ⚠️ 그래도 이 함수는 **누군가 불러줘야** 한다. 오버레이를 여는 새 경로를 만들면 여기도 부를 것. */
  const mhOv = document.getElementById('myHomeOverlay');
  const mhOn = !!(mhOv && mhOv.classList.contains('on')) || myHomeOpen;
  const showMyHomeSized = mhOn && launcherOn;
  const config = launcherOn || creatorOpen;
  const runOverlay = appMode==='run' && !config;
  document.body.classList.toggle('runmode', runOverlay);
  document.body.classList.toggle('config', config);   // 런처/생성기 열림 여부 — CSS에서 #scene 숨김에 사용
  if(typeof floor!=='undefined') floor.visible = !runOverlay;        // 투명 오버레이일 땐 바닥 숨김(데스크톱 비침)
  // 화면 종류에 따라 창 크기가 달라야 함: 생성기는 넓게, 마이홈(런처에서 열렸을 때)도 넓게, 런처는 카드 크기, 실행은 전체화면
  const mode = creatorOpen ? 'creator' : (showMyHomeSized ? 'myhome' : (launcherOn ? 'launcher' : 'run'));
  // 🎨 런처 마이홈 — 창 밖으로 나간 스티커만큼 창을 넓혀 달라고 같이 보낸다(_mhStickerOverhang)
  const extra = (mode === 'myhome') ? mhStLayoutMod._mhStickerOverhang() : null;
  if(window.companion&&companion.setConfigMode) companion.setConfigMode(config, mode, extra);
}
/* 본문은 desktop-run.js 로 옮겼다(앱 FSD 32번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const DESKTOP_RUN_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기
const desktopRunMod = (typeof TwDesktopRun === 'undefined') ? DESKTOP_RUN_MOD_OFF : TwDesktopRun.createDesktopRun({
  _applyActiveAppState: (...a)=>_applyActiveAppState(...a),
  _charBoundsLatest: ()=>_charBoundsLatest,
  _penAppFocused: ()=>_penAppFocused,
  _skipFlyingRigs: (...a)=>hiddenSeatsMod._skipFlyingRigs(...a),
  _skipHiddenDesk: (...a)=>hiddenSeatsMod._skipHiddenDesk(...a),
  _twMoveSeenAt: ()=>_twMoveSeenAt,
  activity: (...a)=>activity(...a),
  anyInput: (...a)=>anyInput(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  camera: camera,
  desktopMode: desktopMode,
  drag: ()=>drag,
  focusGateSleep: ()=>focusGateSleep,
  lastActivity: ()=>lastActivity,
  lastAnyInput: ()=>lastAnyInput,
  moveMode: ()=>moveMode,
  ray: ray,
  renderer: renderer,
  seats: seats,
  setTwMoveSeenAt: (v)=>{ _twMoveSeenAt = v; },
  setLastActivity: (v)=>{ lastActivity = v; },
  setLastAnyInput: (v)=>{ lastAnyInput = v; },
});
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
if(typeof adminMode.refreshAdminVisibility==='function') adminMode.refreshAdminVisibility();   // 관리자 전용 UI는 기본 숨김 (관리자 모드 진입 시 노출)
{ const lbl=document.getElementById('lcLicenseLbl'); if(lbl) lbl.textContent = isPremium ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록'; }
/* 🏠 마이홈 시작(내 접속 표시 · 프로필 · 친구 · 요청 · 우편 구독) — 모듈을 다 만든 뒤 여기서 한 번.
   첫 일이 «Firebase 붙을 때까지 기다리기» 라, 부팅 중 어디서 불러도 실제 시작은 firebaseAPI 가 생긴 뒤다. */
mhInitMod.initMyHome();
loadBaseGLB().then(ok=>{ if(!ok) console.warn('기본 GLB 로드 실패 — 스탠드인 사용');
  return Promise.all([loadSkins(), slotSaveMod.loadSlots()]); }).then(()=>{ renderLauncher(); }).catch(()=>renderLauncher());
requestAnimationFrame(frame);
requestAnimationFrame(launcherLoop);
/* 🛡️ 얼굴 자동 복구 주기 점검 — 위 repairBlankFaces 주석 참고.
   ★ 렌더 루프(frame)에 넣지 않는다. 얼굴이 비는 상황은 대개 무거운 프로그램과 같이 돌 때라,
     그때 프레임마다 도는 점검을 얹는 것은 방향이 반대다. 4초 간격이면 사용자가 «사라졌다»고
     느끼기 전에 대개 돌아온다. */
setInterval(()=>{ try{ faceHealMod.repairBlankFaces(); }catch(_){} }, faceHealMod.FACE_WATCH_MS);
function resize(){ layoutSeats(); if(lRenderer&&document.getElementById('launcher').classList.contains('on')) sizeLauncherPreview(); }
addEventListener('resize',resize); resize();
/* ═══════════════ 🙋 투게더룸 친구 초대 ═══════════════ */
/* 🙋 친구 고르기 창 · 초대 보내기 · 🚪 방 초대 받기(수락 / 거절 팝업 · 3분 자동 거절 · 작업표시줄 깜빡임)는
   parts/room-invite-ui.js 로 옮겼다(앱 FSD 10번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(창 버튼 · 끌기 · resize 연결, 초대 수신 구독 또는 firebase-ready 기다림)이
     예전과 같은 때 돈다. 밖에서 부르는 이름은 없다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeFriends 는 다시 대입되는 let 이라 읽는 함수로,
   Presence 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const ROOM_INVITE_UI_OFF = { showPopup(){}, busy:()=>false };   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기 — SCHEDULER_OFF 와 같은 방식
const roomInviteUi = (typeof TwRoomInviteUi === 'undefined') ? ROOM_INVITE_UI_OFF : TwRoomInviteUi.createRoomInviteUi({
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  startRoom: (...a)=>roomEntryMod.startRoom(...a),
  doLeaveRoom: (...a)=>roomEntryMod.doLeaveRoom(...a),
  friendInRoom: (...a)=>inboxMod.friendInRoom(...a),
  myHomeFriends: ()=>_myHomeFriends,
  presence: Presence,
});

/* ═══════════ 🛰 서버 모듈 감시견 — 안 붙으면 다시 붙이고, 그래도 안 되면 말해준다 ═══════════
   [무엇을 고치는가] `parts/firebase-init.js` 는 Firebase SDK 를 gstatic 에서 **실행 시점에**
     받아온다. 그 import 하나가 실패하면 모듈 본문이 통째로 실행되지 않아 파일 끝의
     `window.firebaseAPI = {...}` 와 `firebase-ready` 이벤트까지 도달하지 못한다.
     그러면 app.js 곳곳의 `if(!window.firebaseAPI) return;` 가 **전부 조용히 물러난다** —
     잔여 워킹룸 · 룸 접속 · 마이홈 · 친구 · 우편함 · 버그제보가 한꺼번에 사라진다.
     기능 여섯 개가 따로 고장 난 게 아니라 하나가 안 붙은 것인데, 화면에는 아무 말도 안 뜬다.
     (제보 두 건이 같은 문장으로 온 이유다: "로딩되지 않음/증발". 재설치로는 안 고쳐진다 —
      설치 파일 문제가 아니라 그 순간의 네트워크 문제이기 때문이다.)

   [왜 이렇게 고치는가]
     ★ 다시 붙이는 것이 실제로 복구가 된다. app.js 는 어디서나
       `window.firebaseAPI ? 바로 : addEventListener('firebase-ready', …)` 꼴로 기다리고 있어서,
       늦게 도착한 이벤트에도 열세 곳이 전부 제 일을 시작한다. 재시작 없이 살아난다.
     ⚠️ 그래서 **재주입은 신중해야 한다.** 원본이 그냥 느린 것뿐인데 성급히 하나 더 꽂으면
       모듈이 두 번 돌아 구독이 겹친다. 그래서 ① 원본 태그의 error 이벤트(확정 신호)에는 즉시,
       ② 시간 초과에는 넉넉히 기다렸다가만 움직인다.
     ⚠️ 캐시 무력화 쿼리를 붙인다. 실패한 응답이 캐시에 눌러앉으면 재시도가 같은 실패를 되풀이한다.

   🔵 되돌리려면 이 블록만 지우면 된다. 바깥에 남기는 것은 없다. */
/* (앱 FSD 35번) 이 자리의 본문도 room-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */