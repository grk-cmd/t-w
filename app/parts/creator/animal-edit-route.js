/* ═══ 🐾 동물 캐릭터 편집 길잡이 — 생성기를 열 때 · 단계를 옮길 때 어느 창으로 갈지 ══════════════════
   동물은 모양(얼굴형 · 귀 · 표정 · 감은눈)을 동물 생성기(animal.js)에서, 책상 · 좌석은 사람 생성기
   5 · 6단계에서 고친다. 순서는 사람과 같게 모양 → 책상 → 좌석이다.
   ・편집으로 들어오면(런처 [캐릭터 수정] · 좌석 [캐릭터 편집]) 동물 생성기부터.
   ・동물 생성기 마지막 단계의 [다음] 은 저장하고 fromAnimal 표식을 달아 사람 생성기를 연다 — 그때는 책상(5)부터.
   ・사람 생성기에서 1~4단계(사람 피부 · 표정 · 감은눈 · 색)로 가려 하면 동물 생성기로 돌려보낸다.
   ・커미션 캐릭터는 예전 그대로 1~4단계를 막고 책상(5)에 머문다.
   ・동물 생성기 위 «책상 세팅» · «좌석 세팅» 은 [다음 → 책상·좌석] 과 같은 저장 뒤 5 · 6단계로(startStep).
     저장할 자리를 못 정하는 새 동물(빈 칸 없음)이면 흐리게 두고 이유를 툴팁에 적는다.
   판정만 한다(화면 · 저장은 app.js 가 한다) — sim-animal-edit-route.js 가 표로 검사한다. */
(function(){
'use strict';

const DESK_STEP = 5;
const COMMISSION_LOCK_MSG = '커미션 캐릭터는 수정할 수 없어요.';
const NO_SLOT_MSG = '저장할 빈 자리가 없어요 — 슬롯을 하나 비우면 책상·좌석으로 갈 수 있어요';
const STAGE_STEP = { desk: 5, seat: 6 };

/* 생성기를 열 때 — 'animal'(동물 생성기로) · 'desk'(책상 5단계부터) · 'paint'(1단계부터) */
function entryRoute(def, mode){
  if(def && def.animal) return (mode && mode.fromAnimal) ? 'desk' : 'animal';
  if(def && def.isCommission) return 'desk';
  return 'paint';
}

/* 사람 생성기에서 n 단계로 가려 할 때 — {animal:true} 면 동물 생성기로, 아니면 {step, toast?} */
function stepRoute(def, n){
  if(n < DESK_STEP){
    if(def && def.animal) return { animal: true };
    if(def && def.isCommission) return { step: DESK_STEP, toast: COMMISSION_LOCK_MSG };
  }
  return { step: n };
}

/* 동물 생성기에서 넘어와 사람 생성기를 열 때 첫 단계 — «좌석 세팅» 으로 왔으면 6, 아니면 책상(5) */
function deskStep(mode){ return (mode && mode.startStep === STAGE_STEP.seat) ? STAGE_STEP.seat : DESK_STEP; }

/* 동물 생성기 위 «책상 세팅» · «좌석 세팅» 을 누를 수 있나 — saveAnimalSlot 이 저장 자리를 정하는 순서와 같다.
   ctx: editSeat(좌석 편집) · editSrc(원본 def — 재편집) · targetSlot(런처 [＋] 칸) · hasEmptySlot */
function animalStageState(ctx, stage){
  const c = ctx || {};
  const ok = !!(c.editSeat || c.editSrc || c.targetSlot != null || c.hasEmptySlot);
  if(!ok) return { enabled: false, title: NO_SLOT_MSG };
  return { enabled: true, step: STAGE_STEP[stage] || DESK_STEP,
    title: '동물을 저장하고 ' + (stage === 'seat' ? '좌석' : '책상') + ' 세팅으로' };
}

/* [이전] — 지금 단계 하나 앞으로. 동물은 책상(5)에서 누르면 동물 생성기로 돌아간다. */
function prevRoute(def, cur){ return stepRoute(def, Math.max(1, cur - 1)); }

const api = { DESK_STEP, COMMISSION_LOCK_MSG, NO_SLOT_MSG, STAGE_STEP, entryRoute, stepRoute, prevRoute, deskStep, animalStageState };
if(typeof window !== 'undefined') window.AnimalEditRoute = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
