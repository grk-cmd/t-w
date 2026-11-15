/* cloth-visibility.js — 👕 옷 겹침(앱 FSD · app.js 분리 T4)
   app.js 의 «옷 카테고리만 해제» · «착용된 파츠에 따라 기본 메시 보이기» 를 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(0.13 app.js 의 같은 글 — 0.13 이 이 구역을 안 바꿨다).
   ・책임: _unequipClothCat(옷 카테고리 충돌 정리 — def 는 안 건드림) · applyClothVisibility(착용 파츠의 hides 로 기본 상 · 하의 · 모자 · 안경 · 날개 · 손 메시 보이기 정하기 — 자리비움 중이면 _prevVisible 에 적고, 끝에서 올라탄 좌석의 머리 꼭대기를 한 번 다시 잰다).
   ・받는 deps 4 — 값 3(decoPartsMod · premiumMod · rideBenchMod) · 함수 1(unequipPartFromSeat).
   ・내놓는 것: _unequipClothCat · applyClothVisibility — app.js 는 같은 이름 const 로 받는다.
   ⚠️ setSeatOpacity(room/seat-opacity.js)와 같은 한 표식(mesh.userData._prevVisible)을 본다 — 숨은 동안엔 visible 을 직접 쓰지 않는다.
   검사: checks/sim-cloth-visibility.js */
(function(){

function createClothVisibility(deps){
const decoPartsMod = deps.decoPartsMod;
const premiumMod = deps.premiumMod;
const rideBenchMod = deps.rideBenchMod;
const unequipPartFromSeat = deps.unequipPartFromSeat;
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
  decoPartsMod.applyDecoPartsVisibility(seat);   // 🎁 꾸미기 파츠 표시 설정 — 부착·해제·좌석 재조립 뒤 늘 이 함수를 지나므로 여기서 같이 맞춘다
  /* 🎁 꺼짐이면 «파츠 없음» 으로 센다 — 파츠가 숨기던 기본 메시(머리카락·기본 상의)를 되돌리기 위해서다.
     ⚠️ 책상 위 파츠는 hides 를 안 가지므로 여기서 빼도 달라지는 게 없다. */
  const eq = (decoPartsMod.decoPartsVisible() ? (seat.charDef && seat.charDef.equippedParts) : null) || {};
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

return {
  _unequipClothCat,
  applyClothVisibility,
};
}

const api = { createClothVisibility };
if(typeof window !== 'undefined') window.TwClothVisibility = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
