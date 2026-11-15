/* creator-open.js — 🧍 생성기 여는 입구 · 런처 다시 그리기(앱 FSD · app.js 분리 M21)
   app.js 의 openCreator(생성기를 여는 입구 — 동물 생성기 · 종족 선택창 · 친구 추가 · 런처가 부르고, 동물이면 동물 생성기로 되돌리는 연결 자리)와 renderLauncher(런처 다시 그리기 — 여러 모듈이 부른다)를 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다.
   ・책임: openCreator(mode) — 3D 미리보기를 먼저 만들고(못 만들면 열지 않는다 — F1) · 꾸미기 창을 닫아 저장하고 · 모드(새로 · 수정 · 좌석 · 책상 · 동물 · 커미션)에 따라 def · 단계 · 책상 · 아이템을 세우고 생성기를 연다 · renderLauncher() — 런처 미리보기 · 슬롯 개수 · 빈 칸 · 톱니 · 컨트롤 · 연동 띠를 다시 맞춘다.
   ・내놓는 것: openCreator · renderLauncher(함수 — app.js 는 같은 이름 const 로 받는다).
   ⚠️ 이 둘은 여러 모듈이 부르는 연결 자리라 모듈로 옮겨도 deps 가 많다(46개) — 생성기 모듈 · 런처 모듈로 더 나누면 슬롯 · 라이선스 모듈과 순환이 생긴다.
   검사: checks/sim-creator-open.js */
(function(){

function createCreatorOpen(deps){
const _editRoute = deps._editRoute;
const _syncCrColorSwatches = deps._syncCrColorSwatches;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const applyDesktopRunClass = deps.applyDesktopRunClass;   // 함수
const closeWardrobe = deps.closeWardrobe;   // 함수 — window 고리(꾸미기 모듈이 건다)
const applyEquippedPartsToSeat = deps.applyEquippedPartsToSeat;
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const b64ToBuf = deps.b64ToBuf;
const blinkC = deps.blinkC;
const CANVAS_SZ = deps.CANVAS_SZ;
const catalogGlbMod = deps.catalogGlbMod;   // 읽는 함수
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const clampCharY = deps.clampCharY;
const clampDeskScale = deps.clampDeskScale;
const commissionMod = deps.commissionMod;   // 읽는 함수
const creatorFlowMod = deps.creatorFlowMod;
const creatorMode = deps.creatorMode;   // 읽는 함수
const setCreatorMode = deps.setCreatorMode;   // 쓰는 함수
const setCreatorOpen = deps.setCreatorOpen;   // 쓰는 함수
const creatorPrevMod = deps.creatorPrevMod;
const crState = deps.crState;
const crXformMod = deps.crXformMod;
const curSlot = deps.curSlot;   // 읽는 함수
const setCustomItems = deps.setCustomItems;   // 쓰는 함수
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;
const deskItemsMod = deps.deskItemsMod;   // 읽는 함수
const deskPlaceMod = deps.deskPlaceMod;   // 읽는 함수
const deskSetupMod = deps.deskSetupMod;
const deskVisualMod = deps.deskVisualMod;   // 읽는 함수
const faceC = deps.faceC;
const histB = deps.histB;
const histF = deps.histF;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const launcherCtlMod = deps.launcherCtlMod;   // 읽는 함수
const launcherPrevMod = deps.launcherPrevMod;   // 읽는 함수
const licenseGateMod = deps.licenseGateMod;
const loadSavedItemsIntoSession = deps.loadSavedItemsIntoSession;   // 함수
const NO_DESK_ID = deps.NO_DESK_ID;
const redoB = deps.redoB;
const redoF = deps.redoF;
const reopenAnimalFromCreator = deps.reopenAnimalFromCreator;
const slots = deps.slots;
const slotSyncMod = deps.slotSyncMod;   // 읽는 함수
const toast = deps.toast;   // 함수
/* 생성기 여는 입구 — 동물 생성기 · 종족 선택창 · 친구 추가 · 런처가 부르고, 동물이면 동물 생성기로 되돌리는 연결 자리라 app.js 에 둔다
   (creator-flow.js 로 옮기면 animal.js ↔ 생성기 모듈 순환이 생긴다). 3D 는 creatorPrevMod · 단계는 creatorFlowMod. */
function openCreator(mode){
  if(!creatorPrevMod.ensureCreatorPreview()) return;   // 3D 를 못 만들면 열지 않는다(안내 · 실패 번호는 gl-context 가 냄)
  // ★ 꾸미기 창이 켜진 채로 생성기를 열면 같은 종류의 "떠 있는 채 안 닫힘" 문제가 생길 수 있어 미리 닫음(저장하며 — backToLauncher 와 같다).
  const wp=document.getElementById('wardrobePanel');
  if(wp && wp.classList.contains('on')){ try{ closeWardrobe(); }catch(_){} }
  if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  setCreatorMode(mode||{kind:'slot',edit:false});
  // ★ 진입 시점에 런처 화면이 보이고 있었는지 기록 — 아래에서 launcher의 'on'을 강제로 뺄 것이므로,
  //   완료/닫기 시 이 값을 보고 되돌려야 함(안 그러면 런처에서 우클릭 수정 후 완료 눌렀을 때 화면이 통째로 사라짐).
  creatorMode().cameFromLauncher = document.getElementById('launcher').classList.contains('on');
  let src=null;
  if(creatorMode().kind==='slot'&&creatorMode().edit) src=slots[creatorMode().slot];
  if(creatorMode().kind==='seat') src=creatorMode().seat.charDef;
  crState.currentCreatorDef = src;   // 커미션 여부 등 판정용 (gotoStep·잠금에서 사용)
  // 🐾 동물 편집은 모양(동물 생성기)부터 — 거기서 [다음 → 책상·좌석] 이 fromAnimal 을 달고 다시 이리로 온다
  if(_editRoute && _editRoute.entryRoute(src, creatorMode())==='animal' && reopenAnimalFromCreator('face')) return;
  faceC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);blinkC.getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
  histF.length=0;histB.length=0;redoF.length=0;redoB.length=0;
  if(src){faceC.getContext('2d').drawImage(src.face,0,0);blinkC.getContext('2d').drawImage(src.blink,0,0);crState.cTopColor=src.top;crState.cBotColor=src.bot;crState.skinIndex=src.skin||0;}
  else{crState.cTopColor='#9dba8a';crState.cBotColor='#d98e73';crState.skinIndex=0;}
  if(crState.cBase) crState.cBase.charDef = src;   // applyPartXf가 파츠별 위치/크기(xf)를 찾을 때 필요 — 실제 파츠 부착은 베이스 재구성 이후(swapCreatorBaseTo* 다음)에 함
  crState.blinkEdited=!!src;   // 편집이면 기존 감은눈 유지, 신규면 3단계에서 표정을 복사해 시작
  document.getElementById('topColor').value=crState.cTopColor;document.getElementById('botColor').value=crState.cBotColor;
  _syncCrColorSwatches();   // ★ value 대입은 input 이벤트를 안 낸다 — 스와치는 여기서 직접 맞춘다
  [...document.getElementById('skinRow').children].forEach((x,j)=>x.classList.toggle('on',j===crState.skinIndex));
  if(crState.cBase){ if(crState.cBase.upMat)crState.cBase.upMat.color.set(crState.cTopColor); if(crState.cBase.loMat)crState.cBase.loMat.color.set(crState.cBotColor); if(crState.cBase.hatMat)crState.cBase.hatMat.color.set(crState.cTopColor); }
  creatorPrevMod.updateCreatorLights();   // 수정 진입 시에도 emissive 톤 갱신
  /* 🧍 높이는 살리고 앞뒤는 죽인다 — z 는 폐기된 값이라 옛 저장본이 무엇을 갖고 있든 0 으로 읽는다.
     ★ 이 함수 말고도 읽는 자리가 넷 더 있다(applyCharToSeat · 런처 미리보기 · 꾸미기 미리보기 ·
       프리셋 로드). 전부 0 으로 죽여야 "어느 화면에서만 옛 앞뒤가 살아 있는" 상태가 안 생긴다. */
  crState.cXform = (src&&src.xf) ? {s:src.xf.s, y:clampCharY(src.xf.y), z:0, rot:src.xf.rot} : {s:0.7,y:0,z:0,rot:0};
  // ★ 방어: 예전 저장 데이터에 xf.s가 없거나 0이면 cXform.s가 0이 되어 fitCreator에서 캐릭터 크기가
  //   0으로 계산되던 버그(첫 진입 시 캐릭터 축소 원인). 유효한 값(>0)이 아니면 기본 슬라이더 중간값으로.
  if(!(typeof crState.cXform.s==='number' && isFinite(crState.cXform.s) && crState.cXform.s>0)) crState.cXform.s = 0.7;
  crState.cXform.y = clampCharY(crState.cXform.y);   // 🧍 NaN·음수·상한 초과를 한 곳에서 정리
  crState.cXform.z = 0;                      // 🚫 폐기
  if(typeof crState.cXform.rot!=='number' || !isFinite(crState.cXform.rot)) crState.cXform.rot = 0;
  crState.faceCamSaved=null; crState.deskCamSaved=null;
  crState.cDeskColor = (src&&src.deskColor) || '#c9a36a';
  if(crState.cDeskMat) crState.cDeskMat.color.set(crState.cDeskColor);
  setCustomItems({}); crState.cDeskTemplate=null; crState.cDeskGlbB64=null; crState.cDeskScale=clampDeskScale((src&&src.deskScale)||DESK_SCALE_DEFAULT);
  crState.cDeskPos = (src && src.deskPos) ? {x:+src.deskPos.x||0, y:+src.deskPos.y||0, z:+src.deskPos.z||0} : {x:0,y:0,z:0};   // 세션 커스텀 에셋 초기화(기본은 슬라이더 중간값, 범위 벗어난 옛날 값은 clamp)
  crState.cDeskLenX = (src&&src.deskLenX) || 1;
  const lenEl=document.getElementById('deskLenX'); if(lenEl) lenEl.value=crState.cDeskLenX;
  crState.activeCustomDeskId=null;
  if(crState.cDesk){ deskPlaceMod().setCreatorDeskScale(crState.cDeskScale); deskPlaceMod().setDeskPos(crState.cDesk, crState.cDeskPos); crXformMod.updateDeskPosNum(); }
  if(crState.cBase){ creatorPrevMod.applyCreatorXform(); creatorPrevMod.clearCreatorItems(); creatorPrevMod.clearCreatorParts();   /* 🪑 이전 세션의 '책상 위' 파츠까지 걷어낸다(아래 applyEquippedPartsToSeat 가 다시 붙인다) */
    if(crState.cDesk)crState.cDesk.userData.deskScale=crState.cDeskScale; deskVisualMod().swapDeskVisual(crState.cDesk,null);
    (async()=>{
      if(src&&src.deskCatalogId===NO_DESK_ID){ crState.activeCustomDeskId=NO_DESK_ID; deskVisualMod().hideDeskBody(crState.cDesk); }
      else if(src&&src.deskCatalogId){
        const m=commissionMod().savedDesks().find(d=>d.id===src.deskCatalogId);
        /* 🔒 [2026-09-15] 라이선스가 빠진 뒤 남은 전용 책상 참조는 생성기에 싣지 않는다 — 실으면 저장 때
           deskCatalogId 가 다시 굳어 실행 화면에서 매번 기본 책상으로 떨어지는 상태가 이어진다. 기본 책상으로 열린다. */
        if(m && m.licenseOnly && !isPremium() && !isAdmin()){ toast('🔒 "'+(m.name||'이 책상')+'"은(는) 라이선스 보유자만 사용할 수 있어요 — 기본 책상으로 열어요'); }
        else if(m){
          if(!m.glb && m.glbUrl){
            try{ await catalogGlbMod().resolveCatalogGlb(m); }catch(_){}
          }
          try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(m.glb)); crState.cDeskGlbB64=m.glb; crState.cDeskTemplate=sc; crState.activeCustomDeskId=m.id;
            deskVisualMod().swapDeskVisual(crState.cDesk,sc); deskVisualMod().applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); }catch(e){}
        }
      } else if(src&&src.deskGlb){ crState.cDeskGlbB64=src.deskGlb; try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(src.deskGlb)); crState.cDeskTemplate=sc; deskVisualMod().swapDeskVisual(crState.cDesk,sc); deskVisualMod().applyDeskColorToCustom(crState.cDesk,crState.cDeskColor);
        const m=commissionMod().savedDesks().find(d=>d.glb===src.deskGlb); if(m) crState.activeCustomDeskId=m.id;
      }catch(e){} } else {
        const ov=commissionMod().savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
        if(ov){
          if(!ov.glb && ov.glbUrl){
            try{ await catalogGlbMod().resolveCatalogGlb(ov); }catch(_){}
          }
          try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(ov.glb)); deskVisualMod().swapDeskVisual(crState.cDesk,sc,true); deskVisualMod().applyDeskColorToCustom(crState.cDesk,crState.cDeskColor);
            // ★ 코드베이스의 다른 swapDeskVisual 호출부(8381·8399·8407·9241·13717·13720·13721)는 전부
            //   직후에 setCreatorDeskScale로 크기를 다시 먹인다. 이 '기본 책상 override' 분기만 빠져 있어서
            //   교체 전 스케일 상태에 의존하고 있었다 — 실행 경로(applyDeskCatalogRefToSeat)와 동일하게 맞춤.
            deskPlaceMod().setCreatorDeskScale(crState.cDeskScale);
          }catch(e){ console.warn('[생성기] 기본 책상 GLB 파싱 실패', e); }
        }
      }
      if(src&&src.customItems){ for(const id in src.customItems){ const c=src.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod().parseGlbFull(b64ToBuf(c.glb)); deskItemsMod().registerCustomItem(id,c.name,c.glb,sc,c.icon||'',animations);}catch(e){} } }
      await loadSavedItemsIntoSession();   // localStorage에 저장된 아이템 모두 customItems에 등록
      if(src&&src.deskItems) applyDeskItemsTo(crState.cBase, src.deskItems);
      if(crState.crStep===5) deskSetupMod.renderCrItems();
      // 런처4-2: 페이지 전환 시 활성 아이템 없으면 기즈모 숨김 (등록/삭제/재렌더 후 잔상 방지)
      if(crState.crStep===5) crXformMod.attachItemGizmoToActive();
      // ★ 커스텀 책상 GLB가 이 시점에야 로드 완료됨(비동기) — 그 전에 이미 한 번 계산된 카메라 프레이밍은
      //   기본 책상 크기 기준이라, 실제 책상 크기(스케일 값 자체는 정상)와 화면에 보이는 줌이 어긋나 보이던
      //   원인. 로드가 다 끝난 지금 시점에 책상/좌석 화면이면 카메라를 다시 계산해서 맞춤.
      if(crState.crStep===5||crState.crStep===6){ creatorPrevMod.fitCreator('app'); creatorPrevMod.frameDeskCam(false); }   // 아이템도 비동기로 늦게 붙을 수 있어 크기·카메라 둘 다 다시 계산
    })();
  }
  document.getElementById('creatorOverlay').classList.add('on');document.getElementById('launcher').classList.remove('on');
  setCreatorOpen(true);
  if(creatorPrevMod.crFlatView) creatorPrevMod.crFlatView.set(false);   // 지난번에 켜 둔 원색 보기를 다음 열기로 끌고 오지 않는다
  // 커미션 캐릭터면 책상 세팅(5단계)부터 진입 + cBase의 베이스 GLB를 커미션 GLB로 교체
      if(src && src.animal){
        creatorFlowMod.gotoStep(_editRoute ? _editRoute.deskStep(creatorMode()) : 5);   // 🐾 동물 생성기 «좌석 세팅» 으로 왔으면 6
        creatorPrevMod.swapCreatorBaseToAnimal(src).then(()=>{
          if(crState.cBase) creatorPrevMod.fitCreator('app');
          // 진단(임시) — 실행 쪽과 같은 조건(책상 GLB 비동기 로드 완료 후)에서 재야 비교가 성립한다.
          /* 🐾 착용 파츠 부착 — 이 한 줄이 **이 가지에만 빠져 있었다.**
             커미션(아래)·기본(그 아래) 두 가지는 베이스 교체 직후 applyEquippedPartsToSeat 을 부르는데
             동물만 안 불러서, 생성기 미리보기에 동물 몸만 서고 모자·안경·책상 위 파츠가 전부 안 보였다
             (제보: "동물 캐릭터 수정하면 적용한 파츠가 안 나온다"). 실행 화면(applyCharToSeat)과
             꾸미기 미리보기(refreshWdPreviewChar)는 각자 부르고 있어서 생성기에서만 나던 증상이다.
             ★ 순서가 중요하다 — swapCreatorBaseToAnimal 이 extractBonesInto 로 부착점을 다시 뽑은
               **뒤**여야 한다. 그 전에 부르면 옛 인간 본에 붙었다가 베이스와 함께 사라진다.
             ★ 부착이 끝난 뒤 fitCreator 를 한 번 더 — 파츠가 바운딩박스를 늘리므로(커미션 가지와 같은 이유). */
          if(crState.cBase && src.equippedParts){
            applyEquippedPartsToSeat(crState.cBase, src).then(()=>{
              if(crState.cBase) creatorPrevMod.fitCreator(crState.crStep<=4 ? 'edit' : 'app');
            });
          }
        });
      } else if(src && src.isCommission){
        creatorFlowMod.gotoStep(5);
        creatorPrevMod.swapCreatorBaseToCommission(src).then(()=>{
          if(crState.cBase && src.equippedParts){
            applyEquippedPartsToSeat(crState.cBase, src).then(()=>{
              // ★ 파츠가 비동기로 늦게 붙는데, 그 전에 이미 계산돼서 굳어버린 크기(fitCreator)가 그대로
              //   남아있던 문제 — 부착이 끝난 시점에 지금 스텝에 맞는 모드로 다시 계산해서 맞춤.
              if(crState.cBase) creatorPrevMod.fitCreator(crState.crStep<=4 ? 'edit' : 'app');
            });
          }
        });
      } else {
        // 💡 기다릴 필요 없이 즉시 뼈대 복구 후 1단계로 진입합니다.
        creatorPrevMod.swapCreatorBaseToDefault(); 
        if(crState.cBase && src && src.equippedParts){
          applyEquippedPartsToSeat(crState.cBase, src).then(()=>{
            // ★ 파츠가 붙은 뒤 다시 계산 — 파츠(망토·귀 등)가 캐릭터 바운딩박스를 늘려서 refSize.y가
            //   달라짐. 첫 진입 때 파츠가 아직 안 붙은 상태로 계산된 크기가 작게 나오던 원인.
            if(crState.cBase) creatorPrevMod.fitCreator(crState.crStep<=4 ? 'edit' : 'app');
          });
        }
        creatorFlowMod.gotoStep(1);
      }
      requestAnimationFrame(creatorPrevMod.creatorLoop);
      applyDesktopRunClass();
}
/* 런처 다시 그리기 — 여러 모듈이 부르는 연결 자리라 app.js 에 둔다(launcher-preview.js 로 옮기면 슬롯 · 라이선스 모듈과 순환이 생긴다). */
function renderLauncher(){
  launcherPrevMod().ensureLauncherPreview();
  // 🎟️ 런처를 열 때마다 초대장 버튼 상태 갱신 (invite 노드 삭제/지급 등 외부 변화 반영)
  licenseGateMod.refreshInviteBtn();
  const def=slots[curSlot()];
  document.getElementById('lcCount').textContent='('+(curSlot()+1)+'/'+CHAR_SLOT_MAX+')';
  document.getElementById('lcEmpty').style.display=def?'none':'flex';
  document.getElementById('lcGear').style.display=def?'block':'none';
  document.getElementById('lcPreview').style.display=def?'block':'none';
  /* #lcLoad([내 정보]) · lcCreate(HTML 에서 늘 disabled)는 여기서 토글하지 않는다. */
  launcherPrevMod().sizeLauncherPreview();launcherPrevMod().setLauncherChar(def);launcherCtlMod().closeGearMenu();
  try{ slotSyncMod()._slotsRenderBand(); }catch(_){}}   // 🛟 연동 띠(3-7-2 A안)

return {
  openCreator,
  renderLauncher,
};
}

const api = { createCreatorOpen };
if(typeof window !== 'undefined') window.TwCreatorOpen = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
