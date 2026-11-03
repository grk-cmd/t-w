/* launcher-controls.js — 🎛️ 런처 컨트롤 — 슬롯 넘기기 · 톱니 메뉴 · 삭제 · 보관함 이동
   app.js «🎛️ 런처 컨트롤» 구역 본문을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   보관함 이동 · 삭제(휴지통 이동)는 서버 원본 옷장(closet.js)에 요청하고 된 뒤에만 칸을 당긴다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 21줄 —
     curSlot · racePickerMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: closeGearMenu — app.js 는 launcherCtlMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLauncherControls — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-launcher-controls.js */
(function(){

function createLauncherControls(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const closetMod = deps.closetMod;   // 읽는 함수 — 서버 원본 옷장(character/closet.js)
const curSlot = deps.curSlot;   // 읽는 함수
const launchApp = deps.launchApp;
const openCreator = deps.openCreator;
const racePickerMod = deps.racePickerMod;   // 읽는 함수
const renderLauncher = deps.renderLauncher;
const saveCurSlot = deps.saveCurSlot;
const settingsMod = deps.settingsMod;
const slots = deps.slots;
const toast = deps.toast;
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
/* --- 런처 컨트롤 --- */
const gearMenu=document.getElementById('lcGearMenu');
function closeGearMenu(){gearMenu.classList.remove('on'); try{ lcDeleteAskEnd(); }catch(_){}}
/* 🗑️ 캐릭터 삭제 되묻기 — 톱니 메뉴 안에서 [네]/[아니오] 로 한 번 더 묻는다.
   ⚠️ 네이티브 확인 대화상자는 쓰지 않는다(Electron 투명 창에서 멈춘 것처럼 보인다 · audit 검사 4 — 이 주석에 그 함수 이름을 괄호까지 붙여 적지 말 것).
   ★ 묻는 상태는 closeGearMenu 가 함께 취소한다 — 슬롯이 바뀐 뒤 [네]가 엉뚱한 캐릭터를 지우지 않게. */
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
  try{ const t=document.getElementById('lcDelAskText'); if(t) t.textContent=closetMod().deleteWords().ask; }catch(_){}
  ['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'].forEach(id=>{ const b=document.getElementById(id); if(b) b.style.display='none'; });
  ask.style.display='flex';
}
document.getElementById('lcPrev').onclick=()=>{setCurSlot((curSlot()+CHAR_SLOT_MAX-1)%CHAR_SLOT_MAX);saveCurSlot();renderLauncher();};
document.getElementById('lcNext').onclick=()=>{setCurSlot((curSlot()+1)%CHAR_SLOT_MAX);saveCurSlot();renderLauncher();};
// ★ 빈 슬롯의 [＋] — "지금 보고 있는 이 칸"을 저장 대상으로 확정해 넘긴다(저장 때 칸을 추측하면 다른 칸을 덮어쓴다).
document.getElementById('lcEmpty').onclick=()=>{
  if(slots[curSlot()]) return;                       // 캐릭터가 있는 칸이면 [＋]가 아니므로 무시
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  racePickerMod().openRacePicker(curSlot());
};
const previewWrap=document.querySelector('.lc-preview-wrap');
previewWrap.addEventListener('mouseenter',()=>{if(slots[curSlot()])previewWrap.classList.add('show-go');});
previewWrap.addEventListener('mouseleave',()=>previewWrap.classList.remove('show-go'));
document.getElementById('lcPreview').addEventListener('click',()=>{if(slots[curSlot()])launchApp({mode:'run'});});
document.getElementById('lcGear').onclick=e=>{e.stopPropagation();
  try{ const w=closetMod().deleteWords(); const d=document.getElementById('lcDelete'); if(d) d.textContent=w.btn; e.currentTarget.title=w.gear; }catch(_){}
  gearMenu.classList.toggle('on');};
document.addEventListener('click',()=>closeGearMenu());
gearMenu.addEventListener('click',e=>e.stopPropagation());
document.getElementById('lcEdit').onclick=()=>{closeGearMenu();if(slots[curSlot()])openCreator({kind:'slot',edit:true,slot:curSlot()});};
document.getElementById('lcDelete').onclick=()=>{ lcDeleteAskStart(); };   // 🗑️ 바로 지우지 않고 되묻는다
/* 🧰 [보관함 이동] — 되묻지 않는다. 지우는 게 아니라 슬롯에서 내려 보관함에 둔다. */
document.getElementById('lcToBox').onclick=()=>{ closeGearMenu(); doMoveCurSlotToBox(); };
/* 칸 i 가 서버에서 빠진 뒤 화면 정리 — "자리 추가"(extraSeatSlots)는 슬롯 '번호'만 저장한다. 같이 당기지 않으면 옆자리 캐릭터가 조용히 바뀐다. */
function afterSlotRemoved(at){
  if(Array.isArray(settingsMod.extraSeatSlots())){
    settingsMod.setExtraSeatSlots(settingsMod.extraSeatSlots().filter(n=>n!==at).map(n=>n>at?n-1:n));
    settingsMod._saveExtraSeatSlots();
  }
  // ★ 당긴 뒤 curSlot 이 빈 칸을 가리키면 이후 저장이 엉뚱한 자리를 고른다 — 여기서 정리한다.
  if(!slots[curSlot()]){ let last=-1; slots.forEach((x,i)=>{ if(x) last=i; }); setCurSlot(last>=0 ? last : 0); }
  saveCurSlot();
  renderLauncher();
}
/* 실제 삭제(휴지통 이동) — [네]를 눌렀을 때만 불린다. 서버에 옮기고 된 뒤에만 칸을 당긴다(서버가 같은 규칙으로 뒤 칸을 당긴다 — 예: 1번 삭제하면 2번→1번). 못 하면 칸은 그대로. */
let _slotOpBusy = false;
async function doDeleteCurSlot(){
  if(!slots[curSlot()]) return;   // 되묻는 사이 비었으면(다른 경로로 삭제 등) 아무 것도 안 한다
  if(_slotOpBusy){ toast('옮기는 중이에요 — 잠시만요'); return; }
  _slotOpBusy = true;
  let r;
  try{ r = await closetMod().trashSlot(curSlot()); }catch(e){ r = { ok: false, why: 'err' }; }
  finally{ _slotOpBusy = false; }
  if(!r.ok){ toast(closetMod().moveMsg(r)); return; }
  afterSlotRemoved(r.slot);
  toast(closetMod().deleteWords().done);
}
/* 🧰 [보관함 이동] — 되묻지 않는다. 지우는 게 아니라 슬롯에서 내려 보관함에 둔다. 서버에 옮기고 된 뒤에만 칸을 당긴다.
   ★ 진행 중이면 다시 안 들어간다(연타 때 겹친 호출이 엉뚱한 칸을 당겼다). */
async function doMoveCurSlotToBox(){
  if(_slotOpBusy){ toast('보관함으로 옮기는 중이에요 — 잠시만요'); return; }
  const i = curSlot();
  if(!slots[i]) return;
  _slotOpBusy = true;
  let r;
  try{ r = await closetMod().moveToBox(i); }catch(e){ r = { ok: false, why: 'err' }; }
  finally{ _slotOpBusy = false; }
  if(!r.ok){ toast(closetMod().moveMsg(r)); return; }
  afterSlotRemoved(r.slot);
  toast('보관함으로 옮겼어요');
}

return {
  closeGearMenu,
};
}

const api = { createLauncherControls };
if(typeof window !== 'undefined') window.TwLauncherControls = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
