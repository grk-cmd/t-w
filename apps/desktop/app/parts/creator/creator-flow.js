/* creator-flow.js — 🧍 생성기 단계 · 닫기 — 단계 이동(gotoStep) · 닫기(closeCreator)
   app.js «🧍 생성기 미리보기» 구역의 화면 흐름 둘(gotoStep · closeCreator)을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   3D 쪽은 creator-preview.js(creatorPrevMod), 생성기 상태는 app.js 에 남아 읽는 · 쓰는 함수로 받는다.
   ★ 여는 입구 openCreator 는 app.js 에 남는다 — 동물 생성기 · 종족 선택창 · 친구 추가가 부르고 동물 생성기로 되돌리기도 하는 연결 자리라 옮기면 순환이 생긴다.
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 15줄 —
     blinkEdited · cBodyDist · cDesk · cFaceDist · cXform · camDist · camPitch · camYaw · crStep · creatorMode · creatorOpen · currentCreatorDef · deskCamSaved · faceCamSaved · stampMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCamDist · setCamPitch · setCamYaw · setCrStep · setCreatorOpen(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 16개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: closeCreator · gotoStep — app.js 는 creatorFlowMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCreatorFlow — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-creator-flow.js */
(function(){

function createCreatorFlow(deps){
const CANVAS_SZ = deps.CANVAS_SZ;
const _editRoute = deps._editRoute;
const _syncCrColorSwatches = deps._syncCrColorSwatches;
const applyDesktopRunClass = deps.applyDesktopRunClass;
const blinkC = deps.blinkC;
const blinkEdited = deps.blinkEdited;   // 읽는 함수
const blit = deps.blit;
const cBodyCenter = deps.cBodyCenter;
const cBodyDist = deps.cBodyDist;   // 읽는 함수
const cDesk = deps.cDesk;   // 읽는 함수
const cFaceCenter = deps.cFaceCenter;
const cFaceDist = deps.cFaceDist;   // 읽는 함수
const cXform = deps.cXform;   // 읽는 함수
const camDist = deps.camDist;   // 읽는 함수
const camPitch = deps.camPitch;   // 읽는 함수
const camTarget = deps.camTarget;
const camYaw = deps.camYaw;   // 읽는 함수
const clampCharY = deps.clampCharY;
const clearStampState = deps.clearStampState;
const crStep = deps.crStep;   // 읽는 함수
const creatorMode = deps.creatorMode;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const creatorPrevMod = deps.creatorPrevMod;
const currentCreatorDef = deps.currentCreatorDef;   // 읽는 함수
const deskCamSaved = deps.deskCamSaved;   // 읽는 함수
const deskItemOrigin = deps.deskItemOrigin;
const detachItemGizmo = deps.detachItemGizmo;
const faceC = deps.faceC;
const faceCamSaved = deps.faceCamSaved;   // 읽는 함수
const histB = deps.histB;
const isAnimalEditing = deps.isAnimalEditing;
const isCommissionEditing = deps.isCommissionEditing;
const isDeskSeatOnly = deps.isDeskSeatOnly;
const isDrawStep = deps.isDrawStep;
const redoB = deps.redoB;
const renderLauncher = deps.renderLauncher;
const reopenAnimalFromCreator = deps.reopenAnimalFromCreator;
const setStampMode = deps.setStampMode;
const showEl = deps.showEl;
const stampMode = deps.stampMode;   // 읽는 함수
const toast = deps.toast;
const setCamDist = deps.setCamDist;   // 쓰는 함수
const setCamPitch = deps.setCamPitch;   // 쓰는 함수
const setCamYaw = deps.setCamYaw;   // 쓰는 함수
const setCrStep = deps.setCrStep;   // 쓰는 함수
const setCreatorOpen = deps.setCreatorOpen;   // 쓰는 함수
/* 5단계(책상 · 아이템)에 들어올 때 부를 곳 — 책상 세팅 모듈이 저장(creator-save) → 이 모듈을 거쳐 순환이 되지 않게 deps 대신 구독으로 받는다 */
const _onItemsStep = [];
function onItemsStep(fn){ _onItemsStep.push(fn); }

function gotoStep(n){
  // 1~4단계(피부/표정/감은눈/색상)는 사람용 — 동물은 동물 생성기로, 커미션은 막고 책상(5)에 머문다
  if(_editRoute){
    const r=_editRoute.stepRoute(currentCreatorDef(), n);
    if(r.animal && reopenAnimalFromCreator('blink')) return;
    if(r.toast) toast(r.toast);
    n = r.animal ? 5 : r.step;
  } else if(isDeskSeatOnly() && n<5){
    if(isCommissionEditing()) toast('커미션 캐릭터는 수정할 수 없어요.');
    n = 5;
  }
  setCrStep(n);
  /* 🎨 안전망 — 색 스와치는 «값을 넣은 쪽»이 맞춰 줘야 하는데, 그걸 잊는 사고가 실제로 났다.
     단계 이동은 색 화면이 보이기 직전에 반드시 지나가는 자리라 여기서 한 번 더 맞춘다(요소 셋, 비용 없음). */
  _syncCrColorSwatches();
  if(n===3 && !blinkEdited()){ const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); histB.length=0; redoB.length=0; }  // 아직 감은눈을 안 고쳤으면 최신 표정을 복사해서 시작
  const draw=isDrawStep(), skin=(n===1), color=(n===4), faceView=(n<=3);
  if(creatorPrevMod.crFlatView) creatorPrevMod.crFlatView.show(draw);   // 그리기 단계에서만 · 벗어나면 원래 조명으로
  const stage = n<=4?0 : (n===5?1:2);
  showEl('charStage', n<=4); showEl('deskStage', n===5); showEl('seatStage', n===6);
  document.getElementById('skinRow').style.display=skin?'flex':'none';
  document.getElementById('crTools').style.display=draw?'flex':'none';
  document.getElementById('penHint').style.display=draw?'block':'none';
  if(!draw && stampMode()) setStampMode(false);   // 표정 단계 벗어나면 도장 모드 해제
  document.getElementById('blinkResetBtn').style.display=(n===3)?'inline-block':'none';
  /* 🙂 [⟳ 감은눈 복사]는 2단계에서만. 감은눈을 한 번도 안 고쳤으면 그 캔버스는 비어 있어
     복사할 것이 없다 — 눌리면 표정이 지워지므로 잠그고, **왜 잠겼는지 툴팁에 적는다**
     (그냥 흐려만 두면 "버튼이 고장났다"가 된다). */
  const _fcb=document.getElementById('faceCopyBlinkBtn');
  if(_fcb){
    _fcb.style.display=(n===2)?'inline-block':'none';
    _fcb.disabled = !blinkEdited();
    _fcb.title = blinkEdited() ? '감은눈 그림을 표정으로 가져와요 (되돌리기 가능)'
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
  if(n===5){ for(const fn of _onItemsStep) fn(); }   // 아이템 목록 다시 그리기 — app.js 가 책상 세팅(desk-setup.js)을 잇는다
  if(n===6){ document.getElementById('crScale').value=cXform().s;
    document.getElementById('crZ').value=clampCharY(cXform().y); document.getElementById('crRot').value=cXform().rot; }   // 🧍 crZ = 높이 슬라이더
  const deskView=(n>=5);
  if(cDesk()) cDesk().visible=deskView;
 // if(cFloor) cFloor.visible=deskView;
  if(deskView){ creatorPrevMod.fitCreator('app'); }
  else { creatorPrevMod.fitCreator('edit'); }
  if(faceView){ if(faceCamSaved()){ camTarget.copy(faceCamSaved().target); setCamDist(faceCamSaved().dist); setCamYaw(faceCamSaved().yaw); setCamPitch(faceCamSaved().pitch); }
                else { camTarget.copy(cFaceCenter); setCamDist(cFaceDist()); setCamYaw(0); setCamPitch(0.0); } }   // 1~3단계 사이 각도 유지
  else if(deskView){ if(deskCamSaved()){ camTarget.copy(deskCamSaved().target); setCamDist(deskCamSaved().dist); setCamYaw(deskCamSaved().yaw); setCamPitch(deskCamSaved().pitch); }
                     else { creatorPrevMod.frameDeskCam(false); } }                                  // 책상·좌석(5·6) 사이 각도 유지
  else{camTarget.copy(cBodyCenter);setCamDist(cBodyDist());setCamYaw(0);setCamPitch(0.04);}            // 전체 모습(정면)
  creatorPrevMod.updateCreatorCam();
  document.getElementById('creatorPreview').style.cursor=draw?'crosshair':'default';
  blit();}

function closeCreator(){setCreatorOpen(false);document.getElementById('creatorOverlay').classList.remove('on');
  if(deskItemOrigin) deskItemOrigin.clear();   // 🪑 처음 자리는 이번 편집에서만
  detachItemGizmo();
  clearStampState();   // 도장 이미지·모드 모두 초기화 (다음 생성/수정 진입 시 깨끗한 상태로)
  // ★ 꾸미기/미리보기 창이 켜진 채로 런처가 다시 보이면 런처를 가리던 문제 방지(방어적으로 항상 닫음)
  const wp=document.getElementById('wardrobePanel'); if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  // ★ kind 가 아니라 openCreator 가 적어 둔 cameFromLauncher 로 런처 복귀를 가른다(우클릭 수정 → X 로 닫아도 런처가 돌아오게 · afterApp 제외).
  if(creatorMode().cameFromLauncher && !creatorMode().afterApp){document.getElementById('launcher').classList.add('on');renderLauncher();}
  applyDesktopRunClass();}
document.getElementById('creatorClose').addEventListener('click',closeCreator);

return {
  closeCreator,
  gotoStep,
  onItemsStep,
};
}

const api = { createCreatorFlow };
if(typeof window !== 'undefined') window.TwCreatorFlow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
