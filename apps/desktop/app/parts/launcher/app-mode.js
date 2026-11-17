/* app-mode.js — 🖥 런처 ↔ 실행 화면 전환(앱 FSD · app.js 분리 M13)
   app.js 의 앱 모드 구역(appMode · showEl · applyAppMode · launchApp · backToLauncher · «런처로» 버튼)을 글 그대로 옮긴 모듈이다.
   동작은 옛 자리와 같다(다시 대입되는 값을 읽는 함수 · 쓰는 함수로 받는 줄만 달라진다).
   ・책임: appMode(run | editseat) · applyAppMode(화면 요소 보이기 · 창 크기 맞춤 부르기) · launchApp(런처 → 실행: 내 좌석 만들기 · 방 친구 복원 · Tab 힌트) · backToLauncher(실행 → 런처: 꾸미기 · 마이홈 닫기).
   ・내놓는 것: appMode(읽는 함수) · showEl · applyAppMode · launchApp · backToLauncher — app.js 는 같은 이름 const 로 받는다(appMode 는 appModeMod.appMode() 로 읽는다).
   ⚠️ 만드는 줄은 옛 자리(설정 패널 «캐릭터» 탭 안내 뒤)에 둔다 — «런처로» 버튼 연결이 만들 때 걸린다.
   검사: checks/sim-app-mode.js */
(function(){

function createAppMode(deps){
const applyCharToSeat = deps.applyCharToSeat;
const _bgmDestroy = deps._bgmDestroy;   // 함수 — window 고리(마이홈 편집 모듈이 건다)
const _mhDsClose = deps._mhDsClose;   // 함수 — window 고리
const applyDesktopRunClass = deps.applyDesktopRunClass;   // 함수
const closeWardrobe = deps.closeWardrobe;   // 함수 — window 고리(꾸미기 모듈이 건다)
const commitMyHomePage = deps.commitMyHomePage;   // 함수 — window 고리
const myhomeStore = deps.myhomeStore;   // 🏠 마이홈 상태 주인 — 닫을 때 못 올린 고침 한 번
const createSeat = deps.createSeat;
const curSlot = deps.curSlot;   // 읽는 함수
const layoutSeats = deps.layoutSeats;   // 함수
const setMyHomeOpen = deps.setMyHomeOpen;   // 쓰는 함수
const overheadMod = deps.overheadMod;
const Presence = deps.Presence;   // 읽는 함수
const renderLauncher = deps.renderLauncher;
const rideBenchMod = deps.rideBenchMod;
const roomEntryMod = deps.roomEntryMod;   // 읽는 함수
const scene = deps.scene;
const seatPanelMod = deps.seatPanelMod;
const seats = deps.seats;
const settingsMod = deps.settingsMod;
const slots = deps.slots;
const statusChipMod = deps.statusChipMod;
const toast = deps.toast;   // 함수
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
  const myDef = slots[curSlot()] || slots.find(Boolean);
  if(!myDef){toast('먼저 캐릭터를 만들어 주세요');return;}
  [...seats].forEach(s=>{scene.remove(s.group);overheadMod.removeSeatLabels(s);});seats.length=0;
  const me=createSeat(); applyCharToSeat(me,myDef); me.slot=curSlot(); me.isMe=true;
  seatPanelMod.selectSeat(me);seatPanelMod.renderSeatTabs();seatPanelMod.setManual(null);
  appMode = (opts.mode==='edit') ? 'editseat' : 'run';
  applyAppMode();
  document.getElementById('launcher').classList.remove('on');
  if(Presence().active()){
    roomEntryMod().syncFriendSeats(Presence().friendsObj());   // 초대된 친구 복원
    /* 방에 있는 채로 런처에서 캐릭터를 고쳤거나(⚙ 캐릭터 수정 · 생성기 kind:'slot') 다른 칸을 골라 돌아왔으면
       방에 나간 def 와 지금 def 가 다르다 — 생성기 kind:'slot' 저장은 슬롯에만 쓰고 방으로는 안 보낸다.
       그대로 두면 내 화면만 바뀌고 남의 화면은 옛 모습이다. 캐릭터 교체(switchMainCharacter)와 같은 길로 보낸다.
       슬롯 저장은 새 def 객체를 만들므로 같은 객체면 바뀐 것이 없다 — 런처만 다녀온 왕복은 아무것도 안 보낸다. */
    if(Presence().myDef() !== myDef) Presence().updateDef(myDef);
  }
  else settingsMod.extraSeatSlots().forEach(i=>{ if(i!==curSlot() && slots[i]) settingsMod.addExtraSeat(i); });   // 솔로모드 — 저장해둔 자리추가 좌석들 복원(주캐릭터 슬롯과 겹치면 제외 — 자기 복제 방지)
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
  if(wp && wp.classList.contains('on')){ try{ closeWardrobe(); }catch(_){} }
  if(wp) wp.classList.remove('on');
  const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
  // ★ 마이홈도 동일한 이유로 닫음 — 켜진 채로 런처에 오면 그대로 남아 실행 화면 위에 겹쳐 보임.
  //   commitMyHomePage(true)로 저장까지 처리한 뒤 닫기.
  const mhOv=document.getElementById('myHomeOverlay');
  if(mhOv && mhOv.classList.contains('on')){
    try{ commitMyHomePage(true); myhomeStore.flush(); }catch(_){}   // 못 올린 고침 한 번(결과는 기다리지 않음)
    mhOv.classList.remove('on'); setMyHomeOpen(false);
    _mhGbStopWatch();
    _bgmDestroy();
    _mhDsClose();
  }
  renderLauncher();
  applyDesktopRunClass();
}
document.getElementById('toLauncher').onclick=backToLauncher;

return {
  appMode: ()=>appMode,
  showEl,
  applyAppMode,
  launchApp,
  backToLauncher,
};
}

const api = { createAppMode };
if(typeof window !== 'undefined') window.TwAppMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
