/* program-settings.js — ⚙️ 프로그램 설정 창(열기 · 닫기 · 회사원 · 피규어 모드)
   app.js «🏷️ 닉네임 저장 — 모달이 아니라 제자리 편집이 부르는 한 벌» 구역 본문(⚙️ 프로그램 설정 창 열기 · 닫기 · 회사원 · 피규어 모드 포함)을 그대로 옮긴 모듈이다(앱 FSD 40번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 내 이름 도우미(getDisplayName · getUserName · setUserName)는 여러 모듈이 써서 app.js 에 있다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 14줄 —
     FIGURE_MODE_KEY · OFFICE_MODE_KEY · figureMode · focusGateSleep · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setFigureMode · setFocusGateSleep · setOfficeMode(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 12개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 🏷️ 닉네임 저장(USER_NAME_MAX · commitUserName)은 account/user-name.js 로 옮겼다(모듈 순환 끊기 7) — 마이홈 편집 · 내 정보가 설정 창을 바라보지 않게.
   ★ 🎚️ 실행 화면 화질(모니터 탭)은 고르기만 여기서 — 상태는 app.js(_renderQuality · 렌더러를 만들 때 읽는다), 규칙은 shared/frame-budget.js.
   ★ 밖에서 부르는 이름: closeProgramSettings · openProgramSettings — app.js 는 progSettingsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwProgramSettings — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-program-settings.js */
(function(){

function createProgramSettings(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const FIGURE_MODE_KEY = deps.FIGURE_MODE_KEY;   // 읽는 함수
const OFFICE_MODE_KEY = deps.OFFICE_MODE_KEY;   // 읽는 함수
const _applyChatSfxUI = deps._applyChatSfxUI;
const _focusShowPush = deps._focusShowPush;
const _lsSet = deps._lsSet;
const chatUiMod = deps.chatUiMod;
const figureMode = deps.figureMode;   // 읽는 함수
const focusGateSleep = deps.focusGateSleep;   // 읽는 함수
const officeMode = deps.officeMode;   // 읽는 함수
const purikuraUi = deps.purikuraUi;
const refreshCharScaleForCurrentDisplay = deps.refreshCharScaleForCurrentDisplay;
const refreshLicenseUI = deps.refreshLicenseUI;
const refreshOfficeChipUI = deps.refreshOfficeChipUI;
const refreshThemeUI = deps.refreshThemeUI;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const setFigureMode = deps.setFigureMode;   // 쓰는 함수
const setFocusGateSleep = deps.setFocusGateSleep;   // 쓰는 함수
const setOfficeMode = deps.setOfficeMode;   // 쓰는 함수
const renderQuality = deps.renderQuality;   // 읽는 함수 — 실행 화면 화질(FrameBudget.QUALITY)
const setRenderQuality = deps.setRenderQuality;   // 쓰는 함수
const renderAntialias = deps.renderAntialias;   // 값 — 이번 실행의 렌더러가 테두리 다듬기를 켜고 만들어졌는가
const applyRunPixelRatio = deps.applyRunPixelRatio;   // 실행 화면 배율을 지금 화질로 다시 맞춘다

/* --- 프로그램 설정(⚙️) — 라이선스 등록 UI가 이 모달의 "라이선스" 탭 안으로 들어옴, + "모니터" 탭 추가 ---
   모니터 선택은 run 모드의 focusSettingsPanel(renderMonitors)과 동일한 방식: companion.getDisplays()로
   목록을 받아 버튼으로 그리고, 클릭 시 companion.moveToDisplay(id)로 즉시 반영. */
async function renderProgMonitors(){
  const labelEl=document.getElementById('progMonitorLabel');
  const monEl=document.getElementById('progMonitors');
  const singleMsg=document.getElementById('progMonitorSingleMsg');
  if(!monEl || !labelEl) return;
  if(!window.companion || !companion.getDisplays){ labelEl.style.display='none'; monEl.style.display='none'; if(singleMsg) singleMsg.style.display='block'; return; }
  let displays=[];
  try{ displays = await companion.getDisplays(); }catch(e){}
  if(!displays || displays.length<2){
    // 모니터가 1개면 선택할 필요가 없으니 숨김 (focusSettingsPanel과 동일한 규칙)
    labelEl.style.display='none'; monEl.style.display='none'; if(singleMsg) singleMsg.style.display='block';
    return;
  }
  if(singleMsg) singleMsg.style.display='none';
  labelEl.style.display='block'; monEl.style.display='flex';
  monEl.innerHTML='';
  displays.forEach(d=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='fs-mon-btn'+(d.isCurrent?' current':'');
    btn.textContent=d.label; if(d.name) btn.title=d.name;   // OS 가 주는 모니터 이름(제보 #10)
    btn.onclick=async ()=>{
      if(window.companion && companion.moveToDisplay){
        const res=await companion.moveToDisplay(d.id);
        if(res && res.ok){ toast(d.label+'로 이동'); renderProgMonitors(); refreshCharScaleForCurrentDisplay(); }
        else{ toast('이동 실패'); }
      }
    };
    monEl.appendChild(btn);
  });
}
/* 탭 전환 — run 모드 설정 패널(bindFsTabs)과 동일한 방식. 3탭(라이선스/모니터/시스템)
   ★ [회원가입 설계 개정 16] '계정' 탭은 걷었다 — 계정 기능의 자리는 [내 정보 › 계정](C4) 하나다(openMyInfo).
     프로그램 정보(버전)는 유저 정보가 아니므로 시스템에 그대로 있다. */
function setProgSettingsTab(tab){   // tab: 'license' | 'display' | 'system'
  const tabs = [
    { key:'license', btn:'progTabBtnLicense', page:'progTabLicense' },
    { key:'display', btn:'progTabBtnDisplay', page:'progTabDisplay' },
    { key:'system',  btn:'progTabBtnSystem',  page:'progTabSystem'  },
  ];
  tabs.forEach(t=>{
    const b=document.getElementById(t.btn), p=document.getElementById(t.page);
    if(b) b.classList.toggle('on', t.key===tab);
    if(p) p.style.display = (t.key===tab) ? 'block' : 'none';
  });
}
if(document.getElementById('progTabBtnLicense')) document.getElementById('progTabBtnLicense').onclick=()=>setProgSettingsTab('license');
if(document.getElementById('progTabBtnDisplay')) document.getElementById('progTabBtnDisplay').onclick=()=>{ setProgSettingsTab('display'); renderProgMonitors(); refreshThemeUI(); refreshRenderQualityUI(); };
// 🎨 테마·색상 칩 바인딩은 여기서 하면 안 된다 — bindThemeUI()가 THEME_COLORS(const, 파일 아래쪽)를 읽어서
//    TDZ 에러로 app.js 전체 실행이 여기서 멈춘다. 선언 바로 뒤(applyTheme 옆)에서 부른다.
if(document.getElementById('progTabBtnSystem'))  document.getElementById('progTabBtnSystem').onclick =()=>{ setProgSettingsTab('system'); refreshAutoLaunchUI(); refreshFigureModeUI(); refreshOfficeModeUI(); refreshLabVideoUI(); refreshAppVersionUI(); };

/* --- 🎚️ 실행 화면 화질(모니터 탭) — 고르면 이 PC 에 저장 · 배율은 바로, 테두리 다듬기는 다시 켜야 --- */
const RENDER_QUALITY_HINT = {
  sharp: '지금처럼 선명하게 그려요.',
  auto: '화면이 계속 버벅이면 알아서 해상도를 낮춰요. 앱을 다시 켜면 선명하게 다시 시작해요.',
  light: '해상도를 낮추고 테두리 다듬기를 꺼서 가장 가벼워요.',
};
const RENDER_QUALITY_RESTART = ' 테두리 다듬기는 앱을 다시 켜면 바뀌어요.';
function refreshRenderQualityUI(){
  const q = renderQuality();
  document.querySelectorAll('#progQualityRow [data-q]').forEach(b=>b.classList.toggle('current', b.dataset.q === q));
  const hint = document.getElementById('progQualityHint'); if(!hint) return;
  hint.textContent = RENDER_QUALITY_HINT[q] + (FrameBudget.antialiasFor(q) !== renderAntialias ? RENDER_QUALITY_RESTART : '');
}
document.querySelectorAll('#progQualityRow [data-q]').forEach(b=>{
  b.onclick = ()=>{
    const q = FrameBudget.qualityFrom(b.dataset.q);
    if(q === renderQuality()) return;
    setRenderQuality(q);
    _lsSet(FrameBudget.QUALITY_KEY, q);   // 실패하면 여기서 알려준다
    applyRunPixelRatio();
    refreshRenderQualityUI();
  };
});

/* --- 자동 시작(로그인 시 실행) 토글 --- */
async function refreshAutoLaunchUI(){
  const btn=document.getElementById('progAutoLaunchToggle'); if(!btn) return;
  let enabled=false;
  try{ if(window.companion && companion.getAutoLaunch) enabled = !!(await companion.getAutoLaunch()); }catch(e){}
  btn.textContent = enabled ? '켜짐' : '꺼짐';
  btn.classList.toggle('on', enabled);
}
if(document.getElementById('progAutoLaunchToggle')){
  document.getElementById('progAutoLaunchToggle').onclick = async ()=>{
    if(!window.companion || !companion.setAutoLaunch){ toast('이 환경에서는 자동 실행을 설정할 수 없어요'); return; }
    const btn=document.getElementById('progAutoLaunchToggle');
    const wantOn = !btn.classList.contains('on');
    try{
      const actual = !!(await companion.setAutoLaunch(wantOn));
      btn.textContent = actual ? '켜짐' : '꺼짐';
      btn.classList.toggle('on', actual);
      toast(actual ? '자동 실행이 켜졌어요' : '자동 실행이 꺼졌어요');
    }catch(e){ toast('설정에 실패했어요'); }
  };
}

/* ❌ [폐기 2026-08-26] '다른 프로그램 방해 안 함'(창 활성화 차단) 토글은 걷어냈다.
   WS_EX_NOACTIVATE 창에서는 한/영 전환이 **원리적으로** 불가능하다(IME 는 포그라운드 창의
   입력 컨텍스트에 묶인다). 단축키도 같이 죽었다. 켜 둔 사용자가 "한글이 안 쳐진다"로 제보한
   그 토글이라, 남겨 두는 것 자체가 위험해서 통로째 지웠다.
   ⚠️ 다시 만들지 말 것 — main.js 폐기 주석과 handoff-focus-steal-5.md §7 을 먼저 읽을 것.
   ⚠️ 아래 '진단 기록 폴더 열기'는 이 실험과 무관한 별개 기능이라 그대로 둔다. */
if(document.getElementById('progOpenDiagBtn')){
  document.getElementById('progOpenDiagBtn').onclick = async ()=>{
    if(!(window.companion && companion.openDiagFolder)){ toast('이 버전에서는 쓸 수 없어요'); return; }
    try{
      const r = await companion.openDiagFolder();
      if(!r || !r.ok) toast('아직 진단 기록이 없어요');
    }catch(e){ toast('폴더를 열지 못했어요'); }
  };
}

/* --- 피규어 모드 토글 --- */
function refreshFigureModeUI(){
  const btn=document.getElementById('progFigureModeToggle'); if(!btn) return;
  btn.textContent = figureMode() ? '켜짐' : '꺼짐';
  btn.classList.toggle('on', figureMode());
}
if(document.getElementById('progFigureModeToggle')){
  document.getElementById('progFigureModeToggle').onclick = ()=>{
    setFigureMode(!figureMode());
    _lsSet(FIGURE_MODE_KEY(), figureMode()?'1':'0');   // ★ 실패하면 여기서 알려준다(조용한 실패 금지)
    if(figureMode()) setFocusGateSleep(false);   // 즉시 반영 — 다음 폴링까지 안 기다리게
    refreshFigureModeUI();
    toast(figureMode() ? '피규어 모드가 켜졌어요' : '피규어 모드가 꺼졌어요');
  };
}

/* --- 회사원 모드 토글 --- */
function refreshOfficeModeUI(){
  const btn=document.getElementById('progOfficeModeToggle'); if(!btn) return;
  btn.textContent = officeMode() ? '켜짐' : '꺼짐';
  btn.classList.toggle('on', officeMode());
}
if(document.getElementById('progOfficeModeToggle')){
  document.getElementById('progOfficeModeToggle').onclick = ()=>{
    setOfficeMode(!officeMode());
    try{ _focusShowPush(true); }catch(_){}   // 📊 회사원 모드면 오늘 기록 전시를 즉시 거둔다(켜면 다시 보냄)
    let _offNote = '';   // 뒤에 한 줄로 합쳐 알린다 — toast 는 마지막 것만 남는다(덮어쓴다)
    /* 🏢 모드를 켜는 순간 떠 있던 조준을 정리한다 — 안 그러면 십자/🪄 커서가 남고,
       클릭해도 아무 일이 없어 "커서가 고장났다"로 보인다. */
    if(officeMode()){
      try{ if(typeof tricksMod.setFlyAiming === 'function') tricksMod.setFlyAiming(false, true); }catch(_){}
      try{ if(typeof tricksMod.setBonkAiming === 'function') tricksMod.setBonkAiming(false, true); }catch(_){}
      /* 🌊 날리기 — 흐르던 글자는 즉시 걷고 체크도 푼다(doLeaveRoom 과 같은 정리). 줄은 _chatFlyRefreshUI 가 숨긴다. */
      try{ const _fl=document.getElementById('flyLayer'); if(_fl) _fl.innerHTML=''; }catch(_){}
      chatUiMod.setChatFlyOn(false);
      /* 📷 떠 있던 스티커사진 창도 접는다 — 못 열게만 막으면 «켜기 전에 열어 둔 창»이 그대로
         남아서 모드의 목적(지금 당장 화면을 조용하게)이 통째로 무너진다.
         ★ force 로 닫는다. 꾸미기 중이었다면 저장 안 한 것이 날아가지만, 이 모드를 누른 사람은
           «지금 당장 감춰야 한다»를 고른 것이다 — 되묻는 쪽이 오히려 어긋난다. 대신 알린다.
         ⚠️ **촬영 중에는 안 닫는다.** 방장이 빠지면 남은 사람들의 카운트다운이 영영 안 끝나
           그쪽이 창을 닫지도 못하는 상태로 굳는다(closePurikura 의 촬영 중 잠금과 같은 이유).
           최대 4컷 × 약 11초라 곧 끝난다. 그동안은 안내만 한다. */
      try{
        if(purikuraUi.isOpen()){
          if(purikuraUi.phase() === 'shooting') _offNote = ' — 촬영이 끝나면 📷 창을 닫아 주세요';
          else if(purikuraUi.close(true)) _offNote = ' — 📷 창을 닫았어요';
        }
      }catch(_){}
    }
    _lsSet(OFFICE_MODE_KEY(), officeMode()?'1':'0');   // ★ 실패하면 여기서 알려준다(조용한 실패 금지)
    refreshOfficeModeUI();
    refreshOfficeChipUI();   // ■ 버튼 툴팁 갱신 + 모드를 끄면 숨김 해제
    try{ if(typeof chatUiMod._chatFlyRefreshUI === 'function') chatUiMod._chatFlyRefreshUI(); }catch(_){}   // 🌊 날리기 줄 숨김/복귀
    try{ _applyChatSfxUI(); }catch(_){}       // 🔔 알림음 «꺼짐» 표시/복귀
    toast((officeMode() ? '회사원 모드가 켜졌어요' : '회사원 모드가 꺼졌어요') + _offNote);
  };
}

/* --- 🎬 영상 겹침 실험 토글 ---------------------------------------------
   화면공유 영상이 검어지거나 깜빡이는 증상 대응. 오버레이 창에 반투명(알파 252)을 걸어
   크로미움의 '가리는 창' 판정에서 빠지게 한다 — 자세한 근거는 main.js 의
   OVERLAY_LAYERED_ALPHA 주석과 handoff-overlay-video-blackout-5.md §1-2.

   ⚠️ 다른 토글들과 달리 **localStorage 를 안 쓴다.** 값의 원본은 main 의 설정 파일이다
     (창 스타일이라 renderer 가 들고 있어 봐야 쓸 데가 없고, 두 곳에 두면 어긋난다).
   ⚠️ 통로가 없는 구버전에서는 **칸 자체를 숨긴다.** 눌러도 아무 일이 없는 토글을 보여주면
     "고장났다"는 제보가 온다.
   ⚠️ **성공하면 이 블록도 같이 지운다** — HTML 주석 참조. */
/* 🧹 옛 빌드 설정을 기본값으로 되돌렸으면 한 번 알린다(main.js SETTINGS_VER 주석). 부팅 화면이 자리 잡은 뒤에. */
setTimeout(()=>{
  try{
    if(!(window.companion && companion.takeSettingsNotice)) return;   // 구버전 preload
    companion.takeSettingsNotice().then(r=>{
      if(r && r.reset) toast('업데이트하면서 화면 설정(모니터 · 화면 크기 · 영상 겹침 실험)을 기본값으로 되돌렸어요', null, 9000);
    }).catch(()=>{});
  }catch(_){}
}, 2500);
/* 켜 두었는데 실제로는 막혔으면(GPU 합성 꺼짐) 「켜짐」 이라고 말하지 않는다 — 제보 #4.
   ★ .on 은 «값» 기준 그대로 둔다 — 누르면 꺼짐으로 가야 한다. 글자만 사실대로. */
function _labVideoShow(btn, r){
  const on = !!(r && r.on);
  const blocked = on && /^blocked/.test(String((r && r.state) || ''));
  btn.textContent = blocked ? '적용 안 됨' : (on ? '켜짐' : '꺼짐');
  btn.title = blocked ? '켜 두었지만 이 PC 에서는 적용되지 않았어요. 눌러 끈 뒤 다시 눌러 켜 보세요.' : '';
  btn.classList.toggle('on', on);
  return { on, blocked };
}
/* «적용 안 됨» 안내 — main.js 의 부팅 안내 창(_showLabBlockedGuide)과 같은 순서로 말한다. */
const LAB_VIDEO_BLOCKED_GUIDE = '⚠️ 토글은 켜져 있지만 이 PC 에서 실제로는 적용되지 못했어요.\n'
  + '① 버튼을 눌러 끈 뒤, 한 번 더 눌러 다시 켜 주세요.\n'
  + '② 그래도 «적용 안 됨» 이면 마이홈 › 버그제보 탭에 알려 주세요. 아래 «진단 기록 폴더 열기» 의 tw-mouse-diag.log 를 함께 보내 주시면 빨리 볼 수 있어요.';
function _labVideoWarn(blocked){
  const w = document.getElementById('progLabVideoWarn'); if(!w) return;
  w.textContent = blocked ? LAB_VIDEO_BLOCKED_GUIDE : '';
  w.style.display = blocked ? '' : 'none';
}
function refreshLabVideoUI(){
  const row = document.getElementById('progLabVideoRow');
  const hint= document.getElementById('progLabVideoHint');
  const btn = document.getElementById('progLabVideoToggle');
  if(!row || !btn) return;
  if(!(window.companion && companion.getLabVideo)){   // 구버전 — 숨긴 채로 둔다
    row.style.display = 'none';
    if(hint) hint.style.display = 'none';
    return;
  }
  row.style.display = '';
  if(hint) hint.style.display = '';
  companion.getLabVideo().then(r=>{ _labVideoWarn(_labVideoShow(btn, r).blocked); }).catch(()=>{ /* 조회 실패 — 마지막 표시를 그대로 둔다(값을 멋대로 꺼짐으로 보이면 안 된다) */ });
}
if(document.getElementById('progLabVideoToggle')){
  document.getElementById('progLabVideoToggle').onclick = async ()=>{
    if(!(window.companion && companion.setLabVideo)){ toast('이 버전에서는 쓸 수 없어요'); return; }
    const btn = document.getElementById('progLabVideoToggle');
    const wantOn = !btn.classList.contains('on');
    try{
      const r = await companion.setLabVideo(wantOn);
      const v = _labVideoShow(btn, r);
      _labVideoWarn(v.blocked);
      // 켰다 끈 창은 앱을 다시 켤 때까지 불투명 레이어드로 남아 처음(미적용)보다 영상을 더 가린다 — overlay-win.js 끄기 갈래
      toast(v.blocked ? '켜 두었지만 이 PC 에서는 적용되지 않았어요 — 아래 안내를 봐 주세요' : (v.on ? '영상 겹침 실험이 켜졌어요' : '영상 겹침 실험이 꺼졌어요 — 앱을 다시 켜면 완전히 꺼져요'), null, v.on ? 0 : 5000);
    }catch(e){ toast('설정에 실패했어요'); }
  };
}

/* ℹ️ 프로그램 버전 표시 — 시스템 탭 맨 아래 · 첫 화면(초대 게이트) 맨 아래. data-app-version 칸을 모두 같은 글로 채운다.
   companion.getAppVersion()은 main의 app.getVersion() = package.json의 version이라
   빌드된 exe와 항상 일치한다(하드코딩하면 릴리스 때마다 어긋난다).
   브라우저 미리보기처럼 companion이 없는 환경에선 조용히 '-'로 둔다.
   첫 화면은 로그인 전이라 설정 창을 못 연다 — 모듈을 만들 때 한 번 채운다(게이트는 네트워크 준비 뒤에 뜬다). */
const APP_VERSION_SEL = '[data-app-version]';
function refreshAppVersionUI(){
  const els=[...document.querySelectorAll(APP_VERSION_SEL)]; if(!els.length) return;
  const put=(t)=>{ for(const el of els) el.textContent=t; };
  if(!(window.companion && companion.getAppVersion)){ put('-'); return; }
  companion.getAppVersion()
    .then(v=>{ put(v ? ('v'+v) : '-'); })
    .catch(()=>{ put('-'); });
}

/* 프로그램 설정 모달 열기/닫기 — 꾸미기 프리미엄 게이트(라이선스 탭으로 직행)에서도 재사용 */
function openProgramSettings(tab){
  const o=document.getElementById('programSettingsOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  setProgSettingsTab(tab||'license');
  refreshLicenseUI();
  if((tab||'license')==='display') { renderProgMonitors(); refreshThemeUI(); }
  if((tab||'license')==='system')  { refreshAutoLaunchUI(); refreshFigureModeUI(); refreshOfficeModeUI(); refreshLabVideoUI(); refreshAppVersionUI(); }   // 🎬 시스템 탭으로 바로 열려도 실제 적용 상태(적용 안 됨)를 보인다
}
function closeProgramSettings(){
  const o=document.getElementById('programSettingsOverlay'); if(!o) return;
  o.classList.remove('on'); o.style.display='none';
}
document.getElementById('lcProgSettingsBtn').onclick=()=>openProgramSettings('license');
document.getElementById('progSettingsCloseBtn').onclick=()=>closeProgramSettings();

twNav.on(twNav.NAV.PROGRAM_SETTINGS, openProgramSettings);   // 🧭 꾸미기 · 라이선스 요청이 이 통로로 연다 · 닫는다
twNav.on(twNav.NAV.PROGRAM_SETTINGS_CLOSE, closeProgramSettings);
refreshAppVersionUI();
return {
  closeProgramSettings,
  openProgramSettings,
};
}

const api = { createProgramSettings };
if(typeof window !== 'undefined') window.TwProgramSettings = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
