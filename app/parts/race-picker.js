/* race-picker.js — 🐾 종족 선택창 — 사람 · 동물 고르기 · 미리보기
   app.js «🐾 종족 선택창 — 사람 · 동물 고르기 · 미리보기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 2줄 —
     BASE_SCENE 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _raceTargetSlot · openRacePicker — app.js 는 racePickerMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRacePicker — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-race-picker.js */
(function(){

function createRacePicker(deps){
const BASE_SCENE = deps.BASE_SCENE;   // 읽는 함수
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _KEY_LIGHT_MUL = deps._KEY_LIGHT_MUL;
const _MAIN_LIGHT_COL = deps._MAIN_LIGHT_COL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _mkFrontFill = deps._mkFrontFill;
const applyDesktopRunClass = deps.applyDesktopRunClass;
const applyLightPresetToInstance = deps.applyLightPresetToInstance;
const instantiateBase = deps.instantiateBase;
const normalizeModel = deps.normalizeModel;
const openCreator = deps.openCreator;
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
  const k=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL); k.position.set(0,4,0); rScene.add(k);
  rScene.add(_mkFrontFill(_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));   // ★ 실행 화면과 같은 정면 필
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
  if(!rChar && BASE_SCENE()){
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
let _raceTargetSlot=null;   // ★ [＋]가 눌린 칸 번호. 이 값이 곧 저장 대상이 된다(추측 금지)
function openRacePicker(target){
  // ⚠️ 여기 상한이 3으로 박혀 있어서, 슬롯을 5칸으로 늘린 뒤 **4·5번 칸의 [＋]가 null 로 떨어졌다.**
  //   그러면 아래 crDone 이 '예전 폴백(추측)'을 타서 엉뚱한 칸을 고른다. 숫자를 박지 말 것.
  _raceTargetSlot = (typeof target==='number' && target>=0 && target<CHAR_SLOT_MAX) ? target : null;
  try{ window.__twRaceTargetSlot = _raceTargetSlot; }catch(_){}   // animal.js는 IIFE라 window로만 읽을 수 있음
  initRacePreview();
  document.getElementById('raceOverlay').classList.add('on');
  if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();   // 창이 런처(작은) 크기인지 강제 재확인
  // GLB 로드가 아직 끝나지 않은 경우를 대비해 다음 프레임에서 한 번 더 시도
  requestAnimationFrame(renderRacePreview);
  if(!BASE_SCENE()) setTimeout(renderRacePreview, 200);
}
document.getElementById('raceCancel').onclick=()=>document.getElementById('raceOverlay').classList.remove('on');
document.getElementById('raceHuman').onclick=()=>{
  document.getElementById('raceOverlay').classList.remove('on');
  openCreator({kind:'slot',edit:false,slot:_raceTargetSlot});   // ★ [＋]로 확정된 칸을 그대로 넘김
};

return {
  _raceTargetSlot: ()=>_raceTargetSlot,   // 읽는 함수
  openRacePicker,
};
}

const api = { createRacePicker };
if(typeof window !== 'undefined') window.TwRacePicker = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
