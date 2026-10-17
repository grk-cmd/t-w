/* desk-visual.js — 🪑 책상 모양 — 커스텀 · 카탈로그 책상 GLB 로 바꿔 끼기 · 색 · 좌석 책상 그리기
   책임: 책상 그룹(deskGroup)의 «모양» 만 — 기본 책상 메쉬를 숨기고 커스텀 GLB 로 바꿔 끼우며(swapDeskVisual — 톤 · _col 색 메쉬 · 애니메이션 재생 모드), 바닥 · 가운데 맞춤(normalizeDeskObj), _col 색(applyDeskColorToCustom), 좌석 def 의 카탈로그 책상을 찾아 그리기(applyDeskCatalogRefToSeat — 라이선스 전용은 내 좌석에서만 막는다).
   받는 deps: 저장 책상(commissionMod) · GLB 풀기(assetCodeMod · b64ToBuf) · 톤(_applyItemMatTone · _setDeskMatColor) · 재생 목록(activeItemMixers · _idleItemPivots) · 크기(setDeskScale) · 라이선스(isPremium · isAdmin · toast) · DEFAULT_DESK_OVERRIDE_ID.
   내보내는 것: swapDeskVisual · applyDeskColorToCustom · applyDeskCatalogRefToSeat(normalizeDeskObj 는 안에서만).
   app.js «🔄 카탈로그 실시간 동기화» 사이의 applyDeskCatalogRefToSeat 와 «🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기» 구역 가운데(모양 몫)를 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 1줄 —
     isAdmin · isPremium 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: applyDeskCatalogRefToSeat · applyDeskColorToCustom · swapDeskVisual — app.js 는 deskVisualMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDeskVisual — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-desk-visual.js */
(function(){

function createDeskVisual(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const _applyItemMatTone = deps._applyItemMatTone;
const _idleItemPivots = deps._idleItemPivots;
const _setDeskMatColor = deps._setDeskMatColor;
const activeItemMixers = deps.activeItemMixers;
const assetCodeMod = deps.assetCodeMod;
const b64ToBuf = deps.b64ToBuf;
const commissionMod = deps.commissionMod;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const setDeskScale = deps.setDeskScale;
const toast = deps.toast;
// 좌석의 charDef.deskCatalogId를 보고 지금 카탈로그에 있는 최신 GLB로 책상을 그려줌(없으면 기본 책상)
async function applyDeskCatalogRefToSeat(seat, def){
  if(!seat || !seat.desk) return;
  const rec = commissionMod.savedDesks().find(d=>d.id===def.deskCatalogId);
  if(!rec){
    swapDeskVisual(seat.desk,null);
    setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
    return;
  }
  /* 라이선스 게이트 — 전용 책상인데 라이선스가 없으면 기본 책상 + 안내.
     ⚠️ 내 좌석에만 건다(!seat.remote) — 친구 좌석에 걸면 남이 쓴 책상이 내 화면에서 기본 책상으로 보인다. 막는 건 장착 때뿐. */
  if(rec.licenseOnly && !seat.remote && !isPremium() && !isAdmin()){
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

/* 커스텀 책상: 기본 책상 메쉬를 숨기고 커스텀 GLB로 교체(앵커는 그대로) */
// 크기는 GLB 원본 그대로(조절은 «책상 크기» 슬라이더 setDeskScale 만) — 여기선 바닥 가운데로 자리만 맞춘다.
const DESK_FRONT_Z = 0.6;   // 책상 가운데를 좌석 원점에서 앞으로 둘 거리
const DESK_LIFT_Y = 0.15;   // 바닥에 피벗을 맞춘 뒤 메쉬를 올리는 높이
function normalizeDeskObj(obj){ obj.scale.set(1,1,1); obj.position.set(0,0,0); obj.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(obj); const c=box.getCenter(new THREE.Vector3());
  obj.position.x+=(0-c.x); obj.position.z+=(DESK_FRONT_Z-c.z); 
  // 피벗은 바닥, 메쉬만 0.15만큼 올리기 (수치 조절 가능)
  obj.position.y+=(0-box.min.y) + DESK_LIFT_Y; 
  return obj; }
function swapDeskVisual(deskGroup,template,isDefaultOverride,animations,playMode){ if(!deskGroup)return;
  const prev=deskGroup.getObjectByName('customDesk'); if(prev)deskGroup.remove(prev);
  // 이전 책상에 애니메이션 mixer가 있었으면 해제
  if(deskGroup.userData.deskMixer){ activeItemMixers.delete(deskGroup.userData.deskMixer); deskGroup.userData.deskMixer=null; }
  if(deskGroup.userData.deskIdlePivot){ _idleItemPivots.delete(deskGroup.userData.deskIdlePivot); deskGroup.userData.deskIdlePivot=null; }
  const defaults=deskGroup.children.filter(ch=>ch.name!=='deskAnchor'&&ch.name!=='customDesk');
  if(template){ const obj=template.clone(true); obj.name='customDesk';
    const mats=[];
    // 책상 머티리얼도 캐릭터와 같은 플랫 조명 — 텍스처 있는 메쉬만 emissive(_col 같은 단색 메쉬에 넣으면 너무 밝다).
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
    // ⚠️ 새 책상도 GLB 원본 크기 그대로 — 새 책상만 자동 크기를 걸었더니 같은 크기로 만든 기본 책상과 달라졌다(그 자동 크기 코드는 지웠다).
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

return {
  applyDeskCatalogRefToSeat,
  applyDeskColorToCustom,
  swapDeskVisual,
};
}

const api = { createDeskVisual };
if(typeof window !== 'undefined') window.TwDeskVisual = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
