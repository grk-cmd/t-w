/* settings-panel.js — ⚙ 설정 패널(포커싱 어플 · 화면 표시 · 캐릭터 크기 · 탭 · 광고 배너) · 캐릭터 탭(캐릭터 교체 · 자리 추가)
   app.js «⚙ 설정 패널» · «설정 패널 캐릭터 탭» 두 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 27번 — docs/APP_FSD_MAP.md).
   이동 모드 상태(moveMode 등) · 앱 화면 전환(appMode · launchApp · backToLauncher · applyAppMode)은 부팅 · 화면 핵심이라 app.js 에 남겼다. 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 62줄 —
     MULTIPLAYER_SPACING · Presence · SPACING · _moveModeJustToggled · chipHorizontal · curSlot · decoPartsVisible · dotRenderEnabled · emojiReactionsEnabled · focusCharScale · isPremium · moveMode · nameplateEnabled · roomSeatMode · seatEqualizeOn · slots · wardrobeMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setMULTIPLAYER_SPACING · setSPACING · setMoveModeJustToggled · setChipHorizontal · setCurSlot · setDecoPartsVisible · setDotRenderEnabled · setEmojiReactionsEnabled · setFocusCharScale · setMoveMode · setNameplateEnabled · setRoomSeatMode · setSeatEqualizeOn(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 24개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: EXTRA_SEAT_KEY · MY_AD_BANNER_KEY · _saveExtraSeatSlots · addExtraSeat · applyExtraSeatForMode · extraSeatSlots · loadAdBannerSlides · refreshFsAdBanner · renderCharSlots — app.js 는 settingsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSettingsPanel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-settings-panel.js */
(function(){

function createSettingsPanel(deps){
const GAP_MAX = deps.GAP_MAX;
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — 줌이 바뀌면 마이홈 BGM 창 자리도 다시 보낸다
const GAP_MIN = deps.GAP_MIN;
const GAP_STEPS = deps.GAP_STEPS;
const MULTIPLAYER_SPACING = deps.MULTIPLAYER_SPACING;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const SPACING = deps.SPACING;   // 읽는 함수
const _chatEsc = deps._chatEsc;
const _moveModeJustToggled = deps._moveModeJustToggled;   // 읽는 함수
const allDeskItems = deps.allDeskItems;
const applyCharToSeat = deps.applyCharToSeat;
const applyChipOrientation = deps.applyChipOrientation;
const applyClothVisibility = deps.applyClothVisibility;
const backToLauncher = deps.backToLauncher;
const bringWinToFront = deps.bringWinToFront;
const chipHorizontal = deps.chipHorizontal;   // 읽는 함수
const createSeat = deps.createSeat;
const curSlot = deps.curSlot;   // 읽는 함수
const decoPartsVisible = deps.decoPartsVisible;   // 읽는 함수
const dotRenderEnabled = deps.dotRenderEnabled;   // 읽는 함수
const drawFaceThumb = deps.drawFaceThumb;
const emojiReactionsEnabled = deps.emojiReactionsEnabled;   // 읽는 함수
const equipDeskItem = deps.equipDeskItem;
const escRegisterWindow = deps.escRegisterWindow;
const findMySeat = deps.findMySeat;
const focusCharScale = deps.focusCharScale;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const layoutSeats = deps.layoutSeats;
const moveMode = deps.moveMode;   // 읽는 함수
const nameplateEnabled = deps.nameplateEnabled;   // 읽는 함수
const plMod = deps.plMod;
const refreshCharScaleForCurrentDisplay = deps.refreshCharScaleForCurrentDisplay;
const refreshInviteUI = deps.refreshInviteUI;
const removeSeatLabels = deps.removeSeatLabels;
const roomSeatMode = deps.roomSeatMode;   // 읽는 함수
const saveCharScale = deps.saveCharScale;
const saveCurSlot = deps.saveCurSlot;
const saveGap = deps.saveGap;
const saveSlots = deps.saveSlots;
const scene = deps.scene;
const seatEqualizeOn = deps.seatEqualizeOn;   // 읽는 함수
const seats = deps.seats;
const slots = deps.slots;   // 읽는 함수
const toast = deps.toast;
const updateCameraOnly = deps.updateCameraOnly;
const wardrobeMod = deps.wardrobeMod;   // 읽는 함수
const setMULTIPLAYER_SPACING = deps.setMULTIPLAYER_SPACING;   // 쓰는 함수
const setSPACING = deps.setSPACING;   // 쓰는 함수
const setMoveModeJustToggled = deps.setMoveModeJustToggled;   // 쓰는 함수
const setChipHorizontal = deps.setChipHorizontal;   // 쓰는 함수
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
const setDecoPartsVisible = deps.setDecoPartsVisible;   // 쓰는 함수
const setDotRenderEnabled = deps.setDotRenderEnabled;   // 쓰는 함수
const setEmojiReactionsEnabled = deps.setEmojiReactionsEnabled;   // 쓰는 함수
const setFocusCharScale = deps.setFocusCharScale;   // 쓰는 함수
const setMoveMode = deps.setMoveMode;   // 쓰는 함수
const setNameplateEnabled = deps.setNameplateEnabled;   // 쓰는 함수
const setRoomSeatMode = deps.setRoomSeatMode;   // 쓰는 함수
const setSeatEqualizeOn = deps.setSeatEqualizeOn;   // 쓰는 함수
(function bindFocusSettings(){
  const gearBtn=document.getElementById('myFocusGearBtn');
  const panel=document.getElementById('focusSettingsPanel');
  const slotsEl=document.getElementById('fsSlots');
  const sizeSlider=document.getElementById('fsSizeSlider');
  const moveBtn=document.getElementById('fsMoveBtn');
  const moveHint=document.getElementById('fsMoveHint');
  const backBtn=document.getElementById('fsBackBtn');
  if(!gearBtn||!panel) return;

  // ✥ 설정창 자유 이동 — 타이틀바(⚙️ 설정)를 잡고 드래그. 옮긴 뒤엔 캐릭터 머리 위 자동 따라가기가
  //   중단되고(위 렌더 루프의 _fsPanelDragged 체크), 창을 닫았다 다시 열면 머리 위 기본 위치로 복귀.
  (function bindFsPanelDrag(){
    const bar = panel.querySelector('.fs-titlebar');
    if(!bar) return;
    bar.style.cursor='move';
    let dragging=false, offX=0, offY=0;
    bar.addEventListener('pointerdown', e=>{
      if(e.target.closest && e.target.closest('#fsPanelClose')) return;   // ✕ 버튼은 그대로 닫기
      dragging=true; window._fsPanelDragged=true;
      const px=parseFloat(panel.style.left)||0, py=parseFloat(panel.style.top)||0;
      offX=e.clientX-px; offY=e.clientY-py;
      e.preventDefault();
    });
    document.addEventListener('pointermove', e=>{
      if(!dragging) return;
      // transform:translate(-50%,-100%) 기준 좌표계를 그대로 쓰므로 left/top만 갱신하면 됨
      panel.style.left=(e.clientX-offX)+'px';
      panel.style.top =(e.clientY-offY)+'px';
    });
    document.addEventListener('pointerup', ()=>{ dragging=false; });
  })();

  const FOCUS_APP_SLOTS = 8;   // ★ 4 → 8칸으로 확장. .fs-slots가 flex-wrap이라 2줄로 자동 배치됨.
  /* 📋 "목록에서 직접 고르기" — 슬롯 우클릭으로 연다.
     [왜] 자동 등록은 '방금 전까지 활성이던 창'을 집는데, **게임에서는 거의 항상 틀린다.**
       게임을 쓰다 이 패널을 누르려면 게임에서 빠져나와야 하고, 그 사이 바탕화면·런처가 한 번
       활성이 되어 그게 대신 등록된다(제보: "게임 빼고는 다 정상적으로 등록됨").
     ★ 팝업을 #focusSettingsPanel **안에** 붙인다 — 클릭 통과 화이트리스트가 조상으로 그 id를
       보고 있어서, 안에 넣으면 목록 위에서 클릭이 뒤로 뚫리지 않는다. body 에 직접 붙이면
       선택자를 화이트리스트에 따로 추가해야 하고, 빠뜨리면 "목록은 뜨는데 못 고른다"가 된다. */
  function _closeWinPicker(){
    const old=document.getElementById('fsWinPicker'); if(old) old.remove();
  }
  /* 🎮 [제보] "활동 프로그램 등록에서 게임을 등록하려 우클릭했더니 프로그램이 그대로 멈춰 강종됐다."
     ★ 멈추는 자리 자체는 여기가 아니다 — `companion.listWindows()` 는 main 프로세스의 창 열거이고,
       그게 안 돌아오면 창 드래그·렌더까지 전부 멈춰 Windows 가 '응답 없음'으로 잡는다.
       전체화면 독점 게임·안티치트가 붙은 프로세스에서 열거가 걸리는 것이 알려진 경우다
       (아래 등록 실패 안내의 `no-owner`·`activeWin-*` 와 같은 뿌리).
     ⚠️ 그래서 이 두 줄은 **고치는 것이 아니라 악화를 막는 것**이다. 진짜 수정은 main.js 쪽이다.

     [여기서 막는 것] 화면이 안 뜨면 사람은 우클릭을 몇 번 더 한다. 예전엔 그때마다
       listWindows() 가 **한 번씩 더** 나갔다 — 이미 걸려 있는 열거 위에 세 번, 네 번이 쌓인다.
       한 번이면 몇 초 버티다 돌아왔을 것이 그 지점에서 확실히 죽는다.
       ① 진행 중이면 새 호출을 아예 안 낸다 ② 8초 안에 안 오면 포기하고 안내로 바꾼다. */
  let _winPickerBusy = false;
  const WIN_PICK_TIMEOUT_MS = 8000;
  async function _openWinPicker(idx){
    if(_winPickerBusy) return;   // ★ 연타로 열거가 쌓이는 것을 막는다 (위 주석)
    _closeWinPicker();
    const panel=document.getElementById('focusSettingsPanel'); if(!panel) return;
    if(!(window.companion && companion.listWindows)){ toast('이 버전에서는 목록 고르기를 쓸 수 없어요'); return; }
    const box=document.createElement('div');
    box.id='fsWinPicker';
    box.style.cssText='position:absolute;left:10px;right:10px;top:34px;max-height:230px;overflow-y:auto;z-index:6;'
      +'background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
      +'box-shadow:var(--win-drop-el, 2px 2px 0 rgba(0,0,0,.35));border-radius:var(--win-radius-el);padding:4px;';
    box.innerHTML='<div style="font-size:10px;color:var(--ink-soft);padding:4px 6px;">불러오는 중…</div>';
    panel.appendChild(box);
    let res=null, timedOut=false;
    _winPickerBusy = true;
    try{
      /* ⚠️ 시간 제한은 **렌더러 쪽 포기**일 뿐이다 — main 이 이미 멈췄으면 이 타이머도 안 돈다.
         main 이 느리기만 한 경우에 "불러오는 중…" 이 영영 남지 않게 하는 것이 목적이다. */
      res = await Promise.race([
        companion.listWindows(),
        new Promise(r=>setTimeout(()=>{ timedOut=true; r(null); }, WIN_PICK_TIMEOUT_MS)),
      ]);
    }catch(e){ res=null; }
    finally{ _winPickerBusy = false; }
    if(!document.getElementById('fsWinPicker')) return;   // 그 사이에 닫혔음
    const head='<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:bold;color:var(--ink);padding:3px 6px 5px;">'
      +'<span>'+(Number(idx)+1)+'번 슬롯에 등록할 창</span><span id="fsWinPickX" style="cursor:pointer;padding:0 4px;">×</span></div>';
    if(timedOut){
      /* 여기까지 왔다는 것은 main 이 살아는 있는데 창 열거가 오래 걸린다는 뜻이다.
         강종까지 가지 않은 판이므로, 같은 결과를 얻는 다른 길을 알려준다. */
      box.innerHTML=head+'<div style="font-size:10px;color:var(--ink-soft);padding:6px;line-height:1.5;">'
        +'창 목록을 불러오지 못했어요.<br>게임이 <b>전체화면</b>이면 <b>창 모드</b>(테두리 없는 창)로 바꾼 뒤 다시 열어 주세요.<br>'
        +'게임을 잠깐 껐다가 등록하셔도 됩니다.</div>';
      console.warn('[포커싱어플] listWindows 시간 초과 ('+WIN_PICK_TIMEOUT_MS+'ms) — main 쪽 창 열거가 지연됩니다');
    }
    else if(!res || !res.ok || !res.list || !res.list.length){
      box.innerHTML=head+'<div style="font-size:10px;color:var(--ink-soft);padding:6px;line-height:1.5;">'
        +'열려 있는 창을 찾지 못했어요.<br>등록할 프로그램을 <b>창 모드</b>로 띄운 뒤 다시 열어 주세요.<br>'
        +'관리자 권한으로 실행 중인 프로그램은 목록에 나오지 않아요.</div>';
    }else{
      box.innerHTML=head+res.list.map((w,i)=>
        '<div class="fs-win-item" data-i="'+i+'" style="padding:4px 6px;font-size:11px;color:var(--ink);cursor:pointer;line-height:1.3;border-radius:3px;">'
        +'<b>'+_chatEsc(w.name.replace(/\.exe$/,''))+'</b>'
        +'<div style="font-size:9px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_chatEsc(w.title)+'</div></div>'
      ).join('');
      box.querySelectorAll('.fs-win-item').forEach(row=>{
        row.addEventListener('mouseenter', ()=>{ row.style.background='var(--win-select)'; row.style.color='#fff'; });
        row.addEventListener('mouseleave', ()=>{ row.style.background=''; row.style.color='var(--ink)'; });
        row.addEventListener('click', async ()=>{
          const w=res.list[+row.dataset.i]; if(!w) return;
          try{
            const r = await companion.setFocusApp(idx, w);
            toast((r && r.ok) ? (w.name.replace(/\.exe$/,'')+' 등록됨') : '등록 실패');
          }catch(e){ toast('등록 실패'); }
          _closeWinPicker(); renderSlots();
        });
      });
    }
    const x=document.getElementById('fsWinPickX'); if(x) x.onclick=_closeWinPicker;
  }
  async function renderSlots(){
    if(!slotsEl) return;
    let apps=new Array(FOCUS_APP_SLOTS).fill(null);
    if(window.companion && companion.getFocusApps){
      try{
        const got = await companion.getFocusApps();
        // 구버전 main.js(4칸)와 섞여도 안전하도록 길이를 맞춰서 복사
        if(Array.isArray(got)) for(let i=0;i<Math.min(got.length, FOCUS_APP_SLOTS);i++) apps[i]=got[i]||null;
      }catch(e){}
    }
    slotsEl.innerHTML='';
    const firstEmptyIdx = apps.findIndex(a=>!a);   // 가장 앞의 빈 슬롯 하나만 "+"로 노출
    for(let i=0;i<FOCUS_APP_SLOTS;i++){
      const a=apps[i];
      if(!a && i!==firstEmptyIdx) continue;   // 채워진 것들 + 맨 앞의 빈 슬롯 1개만
      const el=document.createElement('div');
      el.className='fs-slot'+(a?' filled':'');
      el.innerHTML = `<span class="fs-num">${i+1}</span>`+
        (a ? `<span class="fs-name">${TwSafeHtml.text((a.name||'').replace('.exe',''))}</span><span class="fs-x">×</span>`
           : `<span style="font-size:18px;">+</span>`);
      el.title = (a ? `등록됨: ${a.name}\n좌클릭: 지금 초점 앱으로 교체 · ×로 해제`
                    : '좌클릭: 지금 쓰던 프로그램을 등록')
               + '\n우클릭: 열려 있는 창 목록에서 직접 고르기 (게임은 이쪽을 쓰세요)';
      // 🎮 우클릭 = 목록에서 직접 고르기. 게임은 자동 감지가 거의 항상 틀리므로 이 경로가 정답이다.
      el.oncontextmenu = (ev)=>{ ev.preventDefault(); ev.stopPropagation(); _openWinPicker(i); };
      el.onclick = async (ev)=>{
        _closeWinPicker();
        if(ev.target.classList.contains('fs-x')){
          if(window.companion && companion.clearFocusApp) companion.clearFocusApp(i);
          setTimeout(renderSlots, 50);
          return;
        }
        if(window.companion && companion.registerFocusApp){
          const res = await companion.registerFocusApp(i);
          if(!res || !res.ok){
            /* ★ main 은 실패 원인을 res.diag 로 돌려주는데 예전엔 그걸 버리고 한 문장만 띄웠다.
               그래서 "등록이 안 된다"는 제보가 와도 어느 경우인지 구분이 안 됐다. 경우가 다르면
               사용자가 할 일도 다르므로 나눠서 안내한다.
               ・self-active     — 우리 창이 활성이라 '직전에 쓰던 프로그램'을 못 집었다
               ・activeWin-*     — Windows 가 그 창 정보를 안 준다. **관리자 권한으로 뜬 창**이
                 대표적이다(권한이 낮은 프로세스는 높은 프로세스의 창을 조회할 수 없다 — UIPI).
                 이 경우 투게더워킹도 같은 관리자 권한으로 실행해야 보인다.
               ・no-owner        — 전체화면 독점 모드 게임 등, 창 소유 프로세스를 못 읽는 경우 */
            const d = String((res && res.diag) || '');
            let msg;
            if(d.indexOf('self-active') === 0)          msg = '등록할 프로그램을 한 번 클릭해 쓰신 뒤에 눌러 주세요';
            else if(d.indexOf('activeWin') === 0)       msg = '그 창의 정보를 읽을 수 없어요 — 관리자 권한으로 실행 중인 프로그램이면 투게더워킹도 관리자 권한으로 실행해 주세요';
            else if(d.indexOf('no-owner') === 0)        msg = '전체화면 게임은 창(테두리 없는 창) 모드로 바꾼 뒤 등록해 주세요';
            else                                       msg = '먼저 등록할 프로그램을 켜서 사용해 주세요';
            toast(msg);
            console.warn('[포커싱어플] 등록 실패 —', res && res.reason, '| diag =', d, '| self =', res && res.self);
          }
          // 🧭 셸 창(작업표시줄 · 바탕화면 · 파일 탐색기 · UWP 앱)을 건너뛰고 그 앞 창을 등록했으면 알린다 — 조용히 다른 앱이 등록되지 않게
          else if(res.skipped) toast('«' + res.skipped + '» 대신 직전에 쓰던 «' + (res.app.name||'앱') + '» 을(를) 등록했어요 — 원하는 창이 아니면 우클릭으로 직접 골라 주세요', null, 6000);
          else{ toast((res.app.name||'앱')+' 등록됨'); }
          renderSlots();
        }
      };
      slotsEl.appendChild(el);
    }
  }

  async function renderMonitors(){
    const labelEl=document.getElementById('fsMonitorLabel');
    const monEl=document.getElementById('fsMonitors');
    if(!monEl || !labelEl) return;
    if(!window.companion || !companion.getDisplays){ labelEl.style.display='none'; monEl.style.display='none'; return; }
    let displays=[];
    try{ displays = await companion.getDisplays(); }catch(e){}
    if(!displays || displays.length<2){
      // 모니터가 1개면 선택할 필요가 없으니 숨김
      labelEl.style.display='none'; monEl.style.display='none';
      return;
    }
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
          if(res && res.ok){ toast(d.label+'로 이동'); renderMonitors(); refreshCharScaleForCurrentDisplay(); }
          else{ toast('이동 실패'); }
        }
      };
      monEl.appendChild(btn);
    });
  }

  /* ⎋ ESC 스택 — 이 창은 여태 ESC 로 닫히지 않았다(바깥 클릭과 ⚙️ 토글뿐이었다). 스택에 태우면서
     ESC 로도 닫힌다. 닫는 일은 클래스 하나를 떼는 것이라 별도 정리 절차가 없다 —
     ⚠️ 나중에 저장·정리를 붙이게 되면 여기 close 와 gearBtn 토글 **둘 다** 고칠 것. */
  escRegisterWindow({
    key:'focusSettings', el:panel,
    isOpen:()=>panel.classList.contains('on'),
    close:()=>panel.classList.remove('on'),
  });
  gearBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const willOpen = !panel.classList.contains('on');
    panel.classList.toggle('on', willOpen);
    if(willOpen){
      bringWinToFront('focusSettingsPanel');   // 🪟 열 때는 맨 앞으로
      // ✥ 드래그로 옮긴 위치 기억 — 닫았다 열어도 그 자리. 단 화면 밖(해상도 변경 등)이면 머리 위 기본 위치로 복귀.
      if(window._fsPanelDragged){
        const px=parseFloat(panel.style.left)||0, py=parseFloat(panel.style.top)||0;
        if(px<0 || py<0 || px>innerWidth || py>innerHeight) window._fsPanelDragged=false;
      }
      renderSlots(); sizeSlider.value = String(focusCharScale()); renderSizeBar(); renderGapBar(); refreshToggleBtns(); renderMonitors(); renderCharSlots(); refreshFsAdBanner();
    }
  });
  const panelCloseBtn=document.getElementById('fsPanelClose');
  if(panelCloseBtn) panelCloseBtn.addEventListener('click', e=>{ e.stopPropagation(); panel.classList.remove('on'); });
  /* 🪟 **다른 창을 눌렀다고 닫지 않는다.**
     [경위] 채팅창이나 플레이리스트를 누르면 설정창이 그냥 사라졌다(제보). 여기 바깥 클릭 규칙이
       "패널과 ⚙️ 버튼 말고는 전부 바깥"이었기 때문이다. 창을 나란히 놓고 쓰는 사용에서는
       옆 창을 한 번 누를 때마다 설정이 닫히니 설정을 다시 열어야 했다.
     ★ 그래서 **다른 창 위의 클릭은 '바깥'으로 세지 않는다.** 닫히는 것은 이제
       빈 화면·캐릭터·바닥처럼 **창이 아닌 곳**을 눌렀을 때뿐이다(원래 의도한 그 동작).
     ⚠️ 새 창을 만들면 여기 목록에도 넣을 것 — 안 넣으면 그 창을 누를 때만 설정이 닫힌다.
     ⚠️ e.target 이 아니라 **경로(path) 위의 노드**로 판정한다 — 아래 composedPath 주석과 같은 이유다
       (클릭 처리 도중 원래 요소가 DOM 에서 떨어져 나가면 closest 가 못 찾는다). */
  const FS_KEEP_OPEN_SEL = [
    '#myStatusChip',        // 🎵 플레이리스트·상태칩 버튼 줄 전체
    '#chatOverlay',         // 💬 대화창
    '#wardrobePanel', '#wdPreviewPanel',   // 🎨 꾸미기·미리보기
    '#myHomeOverlay', '#bellWin', '#focusLogOverlay',
    '#mobLinkOverlay',      // 📱 태블릿·폰 연결 창 — 설정에서 열었으므로 눌러도 설정이 안 닫힌다
    '.gacha-ov', '.idesk-ov', '.toast'
  ].join(', ');
  document.addEventListener('click', e=>{
    if(!panel.classList.contains('on')) return;
    // ★ e.target 대신 e.composedPath()를 씀 — 클릭 처리 도중(예: 캐릭터 교체/자리추가로 renderCharSlots가
    //   버튼들을 통째로 지웠다가 다시 그리는 경우) 원래 클릭했던 요소가 DOM에서 이미 제거돼버리면
    //   panel.contains(e.target)이 "떨어져나간 노드"라서 무조건 false가 되어 패널 밖 클릭으로 착각,
    //   패널이 의도치 않게 닫혀버리는 문제가 있었음. composedPath()는 클릭 "그 순간"의 경로를 그대로
    //   기억하고 있어서 나중에 DOM이 바뀌어도 안전하게 "그때 패널 안이었는지"를 정확히 판별함.
    const path = e.composedPath ? e.composedPath() : [e.target];
    for(let i = 0; i < path.length; i++){
      const n = path[i];
      if(n && n.matches && n.matches(FS_KEEP_OPEN_SEL)) return;   // 다른 창 위 — 그대로 둔다
    }
    if(!path.includes(panel) && e.target!==gearBtn){
      panel.classList.remove('on');
    }
  });

  function refreshToggleBtns(){
    const emojiBtn=document.getElementById('fsEmojiToggle');
    if(emojiBtn){ emojiBtn.textContent = emojiReactionsEnabled()?'켜짐':'꺼짐'; emojiBtn.classList.toggle('on', emojiReactionsEnabled()); }
    const dotBtn=document.getElementById('fsDotToggle');
    if(dotBtn){ dotBtn.textContent = dotRenderEnabled()?'켜짐':'꺼짐'; dotBtn.classList.toggle('on', dotRenderEnabled()); }
    const npBtn=document.getElementById('fsNameplateToggle');
    if(npBtn){ npBtn.textContent = nameplateEnabled()?'켜짐':'꺼짐'; npBtn.classList.toggle('on', nameplateEnabled()); }
    const coBtn=document.getElementById('fsChipOrientToggle');
    if(coBtn){ coBtn.textContent = chipHorizontal()?'가로':'세로'; coBtn.classList.toggle('on', chipHorizontal()); }
    const eqBtn=document.getElementById('fsSeatEqToggle');
    if(eqBtn){ eqBtn.textContent = seatEqualizeOn()?'켜짐':'꺼짐'; eqBtn.classList.toggle('on', seatEqualizeOn()); }
    const dpBtn=document.getElementById('fsDecoPartsToggle');
    if(dpBtn){ dpBtn.textContent = decoPartsVisible()?'켜짐':'꺼짐'; dpBtn.classList.toggle('on', decoPartsVisible()); }
    const rsBtn=document.getElementById('fsRoomSeatModeToggle');
    if(rsBtn && window.TwSeatPin){ rsBtn.textContent = TwSeatPin.label(roomSeatMode()); rsBtn.classList.toggle('on', roomSeatMode() === TwSeatPin.RIGHT); }
  }
  /* 🪟 창 위치 초기화 — 화면 밖으로 나가 안 보이는 창을 되돌린다.
     [경위] "꾸미기창·파츠 보관함 미리보기가 사라졌다"는 제보. 창 자리는 저마다 localStorage 에
       저장되는데, 모니터를 바꾸거나 해상도가 줄면 그 자리가 화면 밖이 된다. 창은 열려 있지만
       보이지 않으니 유저에게는 기능이 통째로 사라진 것으로 보인다.
     ★ 저장 키를 지우는 것만으로는 부족하다 — 플레이리스트·🔔·가챠는 자리를 **메모리에도** 들고
       있어서, 그 값이 살아 있는 한 다음에 열 때 다시 그 자리로 간다. 그래서 각 모듈이
       `__winPosResetters` 에 자기 초기화를 올려두고 여기서 같이 부른다.
     ⚠️ 새 창에 자리 기억을 붙였다면 **아래 두 목록과 그 배열에 같이 등록**할 것.
       안 하면 그 창만 이 버튼으로 못 되돌린다(= 다시 "사라졌다" 제보가 온다). */
  window.__winPosResetters = window.__winPosResetters || [];
  function resetAllWinPositions(){
    ['tw.wdPreviewPos','tw.gachaWinPos','tw.ideskInvPos','tw.playlistPos','tw.bellWinPos','tw_chat_win_pos']
      .forEach(k=>{ try{ localStorage.removeItem(k); }catch(_){} });
    (window.__winPosResetters||[]).forEach(fn=>{ try{ fn(); }catch(_){} });
    /* 지금 떠 있는 창은 그 자리에서 기본 위치로 돌려놓는다 — 다시 열 때까지 기다리게 하면
       "눌러도 아무 일이 없다"로 보인다. 기본 위치는 CSS 가 정하므로 인라인 값만 지운다. */
    ['wdPreviewPanel','gachaInvWin','gachaDrawWin','ideskInvWin','myPlaylistBox','bellWin','chatWindow']
      .forEach(id=>{
        const el=document.getElementById(id); if(!el) return;
        el.style.left=''; el.style.top=''; el.style.right=''; el.style.transform='';
        el.style.width=''; el.style.height='';
      });
    if(typeof wardrobeMod().clampWdPreviewIntoView==='function') wardrobeMod().clampWdPreviewIntoView();
    toast('\ud83e\ude9f 창 위치를 처음 상태로 되돌렸어요');
  }
  const rwBtn=document.getElementById('fsResetWinPos');
  if(rwBtn) rwBtn.onclick=()=>{ resetAllWinPositions(); };
  /* 🔍 전체 화면 크기 — 캐릭터와 창을 함께(렌더러 줌) [2026-09-16 제보 3-2 · F-1 · 시안 확정]
     [경위] Ctrl+Shift++ / Ctrl+- 는 우리 코드에 없는 일렉트론 기본 줌이라 몇 %인지 알 길도 되돌릴 기준도 없었다.
     ★ 값은 **main.js(applyUiZoom) 한 곳**에만 있다. 이 버튼도 단축키도 Ctrl+휠도 거기로 가고, 바뀐 값은
       onUiZoom 으로 돌아온다 — 그래서 여기서는 숫자를 «받아서 보여 주기만» 한다(어느 길로 바꿔도 맞는다).
     ⚠️ 이 줌은 캐릭터 탭의 «화면 크기»(_charScaleMap · 아바타존만)와 다른 값이다. 둘 다 남긴다.
     ⚠️ 구버전 앱(preload 에 uiZoom 없음)에서는 행을 숨긴다 — 눌러도 아무 일이 없는 버튼을 두지 않는다. */
  (function initUiZoomRow(){
    const row = document.getElementById('fsUiZoomRow');
    if(!row) return;
    const api = (window.companion && typeof companion.uiZoom === 'function') ? companion : null;
    if(!api){ row.style.display = 'none'; return; }
    row.style.display = '';
    const pct = document.getElementById('fsUiZoomPct');
    let _lastZ = null;
    const show = (z) => {
      if(pct && typeof z === 'number' && isFinite(z)) pct.textContent = Math.round(z * 100) + '%';
      /* 🩹 [2026-10-02 제보 #10] 줌이 바뀌면 BGM(유튜브) 창이 숨을 사각형을 다시 보낸다. main 이 새 배율로
         다시 놓지만, 패널 위치가 창 크기에 따라 정해지는 경우 CSS 좌표 자체도 바뀌므로 렌더러 값도 새로 준다.
         ★ _plLastBoundsKey(plMod.st.lastBoundsKey)를 비워야 «안 바뀌었으면 IPC 생략» 에 걸리지 않는다. */
      if(typeof z === 'number' && _lastZ !== null && z !== _lastZ){
        requestAnimationFrame(()=>{
          try{ plMod.st.lastBoundsKey = ''; plMod.syncBgmBounds(); }catch(_){}
          try{ mhHooks.call(mhHooks.HOOK.SYNC_BGM_BOUNDS); }catch(_){}
        });
      }
      if(typeof z === 'number') _lastZ = z;
    };
    const send = (op) => { try{ Promise.resolve(api.uiZoom(op)).then(show).catch(()=>{}); }catch(_){} };
    const b = (id, op) => { const el = document.getElementById(id); if(el) el.onclick = () => send(op); };
    b('fsUiZoomOut', 'out'); b('fsUiZoomIn', 'in'); b('fsUiZoomReset', 'reset');
    if(typeof api.onUiZoom === 'function') api.onUiZoom(show);
    send('get');
  })();
  /* 🪑 좌석 크기 평준화 — 내 화면에서만, 서버에는 안 쓴다(seatEqK 주석 참고). */
  const eqBtn=document.getElementById('fsSeatEqToggle');
  if(eqBtn) eqBtn.onclick=()=>{
    setSeatEqualizeOn(!seatEqualizeOn());
    try{ localStorage.setItem('tw.seatEq', seatEqualizeOn()?'1':'0'); }catch(_){}
    refreshToggleBtns();
    /* ⚠️ syncSeatEqualize 를 직접 부르지 않고 layoutSeats 를 부른다 — 그 안에서 동기화가 먼저 돌고,
       이어서 바뀐 책상 폭으로 좌석 간격·카메라 줌까지 다시 잡힌다. 여기서 동기화만 하면
       크기는 바뀌었는데 간격은 옛 폭 그대로라 좌석이 겹치거나 벌어진다. */
    layoutSeats();
  };
  /* 🪑 방에서 내 자리 — 줄 안에 함께(기본) ↔ 맨 오른쪽 고정. 내 화면에서만(서버에 안 쓴다). 고정하면 layoutSeats 가 나를 0번으로 옮긴다. */
  const rsBtn=document.getElementById('fsRoomSeatModeToggle');
  if(rsBtn && window.TwSeatPin) rsBtn.onclick=()=>{
    setRoomSeatMode(TwSeatPin.next(roomSeatMode()));
    TwSeatPin.saveMode(localStorage, roomSeatMode());
    refreshToggleBtns();
    layoutSeats();
  };
  /* 🎁 꾸미기 파츠 표시 — 내 화면에서만. 전 좌석(나·친구·추가 좌석)에 바로 적용한다. */
  const dpBtn=document.getElementById('fsDecoPartsToggle');
  if(dpBtn) dpBtn.onclick=()=>{
    setDecoPartsVisible(!decoPartsVisible());
    try{ localStorage.setItem('tw.decoParts', decoPartsVisible()?'1':'0'); }catch(_){}
    refreshToggleBtns();
    try{ seats.forEach(s => applyClothVisibility(s)); }catch(_){}
  };
  const coBtn=document.getElementById('fsChipOrientToggle');
  if(coBtn) coBtn.onclick=()=>{
    setChipHorizontal(!chipHorizontal());
    try{ localStorage.setItem('tw.chipHorz', chipHorizontal()?'1':'0'); }catch(_){}
    applyChipOrientation();
    refreshToggleBtns();
  };
  const emojiBtn=document.getElementById('fsEmojiToggle');
  if(emojiBtn) emojiBtn.onclick=()=>{
    setEmojiReactionsEnabled(!emojiReactionsEnabled());
    localStorage.setItem('tw.emojiReactions', emojiReactionsEnabled()?'1':'0');
    refreshToggleBtns();
  };
  const dotBtn=document.getElementById('fsDotToggle');
  if(dotBtn) dotBtn.onclick=()=>{
    setDotRenderEnabled(!dotRenderEnabled());
    localStorage.setItem('tw.dotRender', dotRenderEnabled()?'1':'0');
    refreshToggleBtns();
    layoutSeats();   // 렌더 해상도 즉시 반영
  };
  const npBtn=document.getElementById('fsNameplateToggle');
  if(npBtn) npBtn.onclick=()=>{
    setNameplateEnabled(!nameplateEnabled());
    localStorage.setItem('tw.nameplate', nameplateEnabled()?'1':'0');
    refreshToggleBtns();
  };
  // 이름표(레벨/이름) 크기 슬라이더 — CSS 변수(--nameplate-size)를 갱신해서 즉시 반영, localStorage에 저장.
  const npSizeSlider=document.getElementById('fsNameplateSize');
  if(npSizeSlider){
    // 저장된 값 복원 (없으면 기본 15)
    let saved=15;
    try{ const v=parseInt(localStorage.getItem('tw.nameplateSize'),10); if(isFinite(v)&&v>0) saved=v; }catch(e){}
    npSizeSlider.value=String(saved);
    document.getElementById('seatLabelsLayer').style.setProperty('--nameplate-size', saved+'px');
    npSizeSlider.oninput=()=>{
      const v=+npSizeSlider.value;
      document.getElementById('seatLabelsLayer').style.setProperty('--nameplate-size', v+'px');
      try{ localStorage.setItem('tw.nameplateSize', String(v)); }catch(e){}
    };
  }

  if(backBtn) backBtn.onclick = ()=>{ panel.classList.remove('on'); backToLauncher(); };

  // ★ 부드러운 슬라이더 대신 15칸 막대바 + 좌우 화살표로 변경 — 드래그 중 계속 재계산되던 것과 달리
  //   클릭 한 번에 한 단계만 딱 반영되니 렉(버벅임) 없이 큼직큼직하게 조절 가능.
  const SIZE_MIN=0.6, SIZE_MAX=1.6, SIZE_STEPS=15;
  const sizeStepToValue = i => +(SIZE_MIN + (SIZE_MAX-SIZE_MIN)*i/(SIZE_STEPS-1)).toFixed(3);
  const valueToSizeStep = v => Math.max(0, Math.min(SIZE_STEPS-1, Math.round((v-SIZE_MIN)/(SIZE_MAX-SIZE_MIN)*(SIZE_STEPS-1))));
  function renderSizeBar(){
    const track=document.getElementById('fsSizeBarTrack'); if(!track) return;
    const curStep = valueToSizeStep(focusCharScale());
    track.innerHTML='';
    for(let i=0;i<SIZE_STEPS;i++){
      const seg=document.createElement('div');
      seg.className='fs-seg'+(i<=curStep?' on':'');
      seg.onclick=()=>setSizeStep(i);
      track.appendChild(seg);
    }
  }
  function setSizeStep(i){
    i=Math.max(0,Math.min(SIZE_STEPS-1,i));
    setFocusCharScale(sizeStepToValue(i));
    if(sizeSlider) sizeSlider.value = String(focusCharScale());   // 예전 슬라이더 값도 같이 맞춰둠(다른 코드가 참조할 경우 대비)
    saveCharScale();   // ★ 껐다 켜도 유지되게 즉시 저장
    updateCameraOnly();   // 카메라 거리만 가볍게 갱신(무거운 좌석 재배치 불필요)
    renderSizeBar();
  }
  const sizeBarLeft=document.getElementById('fsSizeBarLeft'), sizeBarRight=document.getElementById('fsSizeBarRight');
  if(sizeBarLeft) sizeBarLeft.onclick=()=>setSizeStep(valueToSizeStep(focusCharScale())-1);
  if(sizeBarRight) sizeBarRight.onclick=()=>setSizeStep(valueToSizeStep(focusCharScale())+1);

  // ★ 좌석 간격 — 멀티모드(방에 친구가 있음)면 MULTIPLAYER_SPACING을, 아니면 SPACING을 조절.
  //   두 값은 서로 독립적으로 저장돼서 모드를 오가도 각자 마지막 설정을 기억함.
  const gapValueToStep = v => Math.max(0, Math.min(GAP_STEPS-1, Math.round((v-GAP_MIN)/(GAP_MAX-GAP_MIN)*(GAP_STEPS-1))));
  const gapStepToValue = i => +(GAP_MIN + (GAP_MAX-GAP_MIN)*i/(GAP_STEPS-1)).toFixed(3);
  function currentGap(){ return (typeof Presence()!=='undefined' && Presence().active()) ? MULTIPLAYER_SPACING() : SPACING(); }
  function setCurrentGap(v){ if(typeof Presence()!=='undefined' && Presence().active()) setMULTIPLAYER_SPACING(v); else setSPACING(v); }
  function renderGapBar(){
    const track=document.getElementById('fsGapBarTrack'); if(!track) return;
    const curStep = gapValueToStep(currentGap());
    track.innerHTML='';
    for(let i=0;i<GAP_STEPS;i++){
      const seg=document.createElement('div');
      seg.className='fs-seg'+(i<=curStep?' on':'');
      seg.onclick=()=>setGapStep(i);
      track.appendChild(seg);
    }
  }
  function setGapStep(i){
    i=Math.max(0,Math.min(GAP_STEPS-1,i));
    setCurrentGap(gapStepToValue(i));
    saveGap();
    layoutSeats();   // 여백이 바뀌면 좌석 배치를 다시 계산해야 함(가벼운 카메라만 갱신하는 걸로는 부족)
    renderGapBar();
  }
  const gapBarLeft=document.getElementById('fsGapBarLeft'), gapBarRight=document.getElementById('fsGapBarRight');
  if(gapBarLeft) gapBarLeft.onclick=()=>setGapStep(gapValueToStep(currentGap())-1);
  if(gapBarRight) gapBarRight.onclick=()=>setGapStep(gapValueToStep(currentGap())+1);

  if(moveBtn) moveBtn.onclick = ()=>{
    setMoveMode(!moveMode());
    setMoveModeJustToggled(true);   // 다음 mousemove에서 시작점을 새로 잡도록 신호
    moveBtn.classList.toggle('active', moveMode());
    moveBtn.textContent = moveMode() ? '클릭해서 위치 확정' : '프로그램 이동';
    if(moveHint) moveHint.style.display = moveMode() ? 'block' : 'none';
    if(moveMode()){ panel.classList.remove('on'); }   // 이동 중엔 패널 가려서 시야 확보
  };
})();

/* 설정 패널 탭 전환 (포커싱어플 / 화면표시 / 캐릭터크기) */
(function bindFsTabs(){
  const tabs=[
    { btn:'fsTabBtnApp', page:'fsTabApp' },
    { btn:'fsTabBtnDisplay', page:'fsTabDisplay' },
    { btn:'fsTabBtnSize', page:'fsTabSize' },
    { btn:'fsTabBtnMulti', page:'fsTabMulti' },
  ];
  tabs.forEach(t=>{
    const btn=document.getElementById(t.btn); if(!btn) return;
    btn.onclick=()=>{
      tabs.forEach(o=>{
        document.getElementById(o.btn).classList.toggle('on', o.btn===t.btn);
        document.getElementById(o.page).style.display = (o.btn===t.btn) ? 'block' : 'none';
      });
      if(t.btn==='fsTabBtnSize') renderCharSlots();
      if(t.btn==='fsTabBtnMulti'){
        refreshInviteUI();
        // 🪑 방에 연결된 상태로 이 탭에 들어오면 자리추가(내 슬롯) 좌석을 정리한다.
        //   방 만들기/참여 경로에서는 이미 호출되지만 F1 탭을 여는 것만으로는 정리가 안 돼,
        //   방 안인데도 내 슬롯 캐릭터들이 화면에 남아 보이던 문제가 있었음.
        applyExtraSeatForMode();
      }
    };
  });
})();

/* 설정 패널 광고 배너 — 기본은 관리자가 등록한 배너(런처와 동일 데이터) 그대로 보여줌.
   라이선스 보유자(isPremium)는 배너 우클릭 시 파일 선택창이 떠서 자기 이미지(로컬 저장, 이 기기 한정)로 바꿀 수 있음.
   라이선스 없으면 우클릭해도 아무 반응 없음. */
const MY_AD_BANNER_KEY = 'tw.myAdBannerImg';
// 공용: 저장된 배너 슬라이드 배열 읽기(빈 슬롯/이미지 없는 항목 제외). 예전 단일 객체 저장 방식과도 호환.
function loadAdBannerSlides(){
  // ★ AD_BANNER_KEY는 파일 뒷부분(11346줄)에 선언된 전역 const — 이 함수가 그보다 먼저 호출되면
  //   TDZ(Temporal Dead Zone) ReferenceError로 죽어 배너가 안 보이는 유저가 생김.
  //   문자열 리터럴을 직접 써서 TDZ를 우회. (뒤의 상수 값과 정확히 일치해야 함)
  try{
    const raw = JSON.parse(localStorage.getItem('tw.adBanner')||'null');
    const arr = Array.isArray(raw) ? raw : (raw && raw.img ? [raw] : []);
    return arr.filter(s=>s && s.img);
  }catch(e){ return []; }
}
let _fsAdSlides=[], _fsAdIdx=0, _fsAdTimer=null;
function refreshFsAdBanner(){
  const img=document.getElementById('fsAdBannerImg'); if(!img) return;
  if(_fsAdTimer){ clearInterval(_fsAdTimer); _fsAdTimer=null; }
  try{
    const mine = localStorage.getItem(MY_AD_BANNER_KEY);
    const mineSrc = TwSafeHtml.safeUrl(mine, 'image');
    if(mineSrc){ img.src=mineSrc; img.style.display='block'; return; }   // 개인 이미지는 고정 하나(슬라이드 아님)
  }catch(e){}
  _fsAdSlides = loadAdBannerSlides(); _fsAdIdx=0;
  if(!_fsAdSlides.length){ img.style.display='none'; return; }
  const show=()=>{ img.src=TwSafeHtml.safeUrl(_fsAdSlides[_fsAdIdx % _fsAdSlides.length].img, 'image'); };   // 서버 광고 그림 — 허용된 그림 주소만
  show(); img.style.display='block';
  if(_fsAdSlides.length>1) _fsAdTimer=setInterval(()=>{ _fsAdIdx=(_fsAdIdx+1)%_fsAdSlides.length; show(); }, 4000);
}
(function bindFsAdBanner(){
  const img=document.getElementById('fsAdBannerImg');
  const fileInput=document.getElementById('fsAdBannerFileInput');
  if(!img||!fileInput) return;
  // 클릭 — 관리자가 등록한 배너 링크가 있으면 앱 안의 작은 브라우저 창으로 열기(시스템 브라우저 대신).
  // 라이선스 유저의 개인 이미지는 이미지만 바꾸는 용도라 별도 링크가 없음 — 지금 보이는 슬라이드의 링크를 재사용.
  img.addEventListener('click', ()=>{
    try{
      const cur=_fsAdSlides[_fsAdIdx];
      const link = cur && cur.link;
      if(link && window.companion && companion.openBrowser) companion.openBrowser(link);
    }catch(e){}
  });
  img.addEventListener('contextmenu', e=>{
    e.preventDefault();
    if(!isPremium()) return;   // 라이선스 없으면 우클릭 무반응
    fileInput.click();
  });
  fileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{ localStorage.setItem(MY_AD_BANNER_KEY, reader.result); refreshFsAdBanner(); toast('배너 이미지를 등록했어요'); }
      catch(err){ toast('저장 공간이 부족해요'); }
    };
    reader.readAsDataURL(f);
    fileInput.value='';   // 같은 파일 다시 선택해도 change 이벤트 발생하게
  });
  // ★ 여기서 즉시 refreshFsAdBanner()를 부르지 않음 — AD_BANNER_KEY/isPremium이 파일 뒷부분에서 선언되는데
  //   이 블록은 스크립트 로드 시점에 바로 실행되므로 아직 선언 전이라 에러가 남. 설정 패널을 열 때(willOpen)
  //   호출하도록 이미 연결해뒀음(그 시점엔 전체 스크립트가 다 로드된 뒤라 안전).
})();

const EXTRA_SEAT_KEY = 'tw.extraSeatSlots';   // 저장 형식: JSON 배열, 예 [1,2]
let extraSeatSlots = [];
(function _loadExtraSeatSlots(){
  try{
    const raw = localStorage.getItem(EXTRA_SEAT_KEY);
    if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)) extraSeatSlots = arr.filter(n=>Number.isInteger(n)); }
  }catch(e){}
})();
function _saveExtraSeatSlots(){ try{ localStorage.setItem(EXTRA_SEAT_KEY, JSON.stringify(extraSeatSlots)); }catch(e){} }

// 저장된 def를 가진 아이템의 desk item(화분/머그컵/책 등)을 전부 제거 — 캐릭터 교체 시 이전 캐릭터의
// 책상 아이템이 새 캐릭터에 그대로 남아있는 걸 방지(applyDeskItemsTo는 "새 def에 있는 것만" 추가할 뿐
// 기존 걸 지우지 않으므로, 교체 직전에 반드시 비워줘야 함).
function clearSeatDeskItems(seat){
  if(!seat || !seat.deskItems) return;
  allDeskItems().forEach(def=>{ if(seat.deskItems[def.id]) equipDeskItem(seat, def, false); });
  seat.activeDeskItem = null;
}

// 내 좌석의 모습을 슬롯 i의 캐릭터로 즉시 교체 (솔로/멀티 공용)
function switchMainCharacter(i){
  const d = slots()[i]; if(!d) return;
  if(i===curSlot()) return;
  const mySeat = findMySeat();
  const extraSeat = seats.find(s=>s.isExtra && s.extraSlot===i);
  if(extraSeat && mySeat){
    // ★ i번 슬롯이 이미 "자리 추가"로 앉아있는 경우 — 캐릭터 모델을 다시 로드하지 않고,
    //   두 좌석의 "역할"(주 캐릭터 ↔ 자리추가)만 서로 맞바꿈. 사용자가 직접 자리를 빼지 않는 한
    //   좌석 활성화 상태 자체는 그대로 유지됨(요청사항) — A/B/C 다 앉아있던 상태에서 주 캐릭터만 바뀜.
    const oldCurSlot = curSlot();
    mySeat.isMe=false; mySeat.isExtra=true; mySeat.extraSlot=oldCurSlot; mySeat.slot=oldCurSlot;
    extraSeat.isExtra=false; extraSeat.extraSlot=null; extraSeat.isMe=true; extraSeat.slot=i;
    // 배열 순서도 맞바꿔서 "메인은 항상 0번(오른쪽 고정)" 규칙 유지 → layoutSeats가 자연스럽게 위치를 애니메이션으로 넘겨줌.
    const ixMy=seats.indexOf(mySeat), ixExtra=seats.indexOf(extraSeat);
    if(ixMy>=0 && ixExtra>=0){ seats[ixMy]=extraSeat; seats[ixExtra]=mySeat; }
    extraSeatSlots = extraSeatSlots.filter(n=>n!==i);
    if(!extraSeatSlots.includes(oldCurSlot)) extraSeatSlots.push(oldCurSlot);
    _saveExtraSeatSlots();
    setCurSlot(i); saveSlots(); saveCurSlot();
    layoutSeats();
    renderCharSlots();
    if(typeof Presence()!=='undefined' && Presence().active()) Presence().updateDef(d);   // 즉시 동기화(보통 솔로 상태지만 방어적으로)
    wardrobeMod()._wdAfterMainSwap();   // 🔀 꾸미기를 연 채 바꿨으면 그 초안은 원래 캐릭터 몫이다
    toast('주 캐릭터를 바꿨어요');
    return;
  }
  // i가 지금 화면에 앉아있지 않은 슬롯(자리추가 안 된 슬롯)이면 기존처럼 실제로 모델을 교체
  if(mySeat) clearSeatDeskItems(mySeat);
  setCurSlot(i); saveSlots(); saveCurSlot();
  if(mySeat){
    applyCharToSeat(mySeat, d);
    mySeat.slot = i;
  }
  layoutSeats();
  renderCharSlots();
  if(typeof Presence()!=='undefined' && Presence().active()) Presence().updateDef(d);   // 즉시 동기화
  wardrobeMod()._wdAfterMainSwap();   // 🔀 꾸미기를 연 채 바꿨으면 그 초안은 원래 캐릭터 몫이다
  toast('캐릭터를 바꿨어요');
}

// 슬롯 i로 앉혀둔 로컬 전용 추가 좌석을 씬에서 제거
function removeExtraSeat(i){
  const s = seats.find(x=>x.isExtra && x.extraSlot===i);
  if(s){ scene.remove(s.group); removeSeatLabels(s); const ix=seats.indexOf(s); if(ix>=0) seats.splice(ix,1); }
  extraSeatSlots = extraSeatSlots.filter(n=>n!==i);
  _saveExtraSeatSlots();
  layoutSeats();
}
// 슬롯 i의 캐릭터를 로컬 전용 추가 좌석으로 새로 앉힘 (이미 앉아있으면 아무 것도 안 함)
function addExtraSeat(i){
  if(i===curSlot()) return;   // ★ 최종 방어 — 주캐릭터 슬롯은 절대 자리추가로 앉힐 수 없음(자기 복제 방지)
  const d = slots()[i]; if(!d) return;
  if(seats.some(x=>x.isExtra && x.extraSlot===i)) return;
  const s = createSeat(); s.isExtra=true; s.extraSlot=i; s.slot=i;   // ★ .slot도 같이 설정 — 안 그러면 생성기에서 우클릭 수정 후 저장할 때 slots[]가 갱신 안 됨(런처 나갔다 오면 초기화되던 버그)
  applyCharToSeat(s, d);
  if(!extraSeatSlots.includes(i)) extraSeatSlots.push(i);
  _saveExtraSeatSlots();
  layoutSeats();
}
// "자리 추가" 슬롯 클릭 — 각 슬롯을 독립적으로 토글(이미 앉아있으면 빼고, 아니면 앉힘). 여러 개 동시에 가능.
function toggleExtraSeat(i){
  if(typeof Presence()!=='undefined' && Presence().active()) return;   // 멀티모드에선 UI 자체를 숨기지만 이중 방지
  if(i===curSlot()) return;   // 주 캐릭터는 자리 추가 대상 아님
  if(extraSeatSlots.includes(i)){ removeExtraSeat(i); }
  else { addExtraSeat(i); }
  renderCharSlots();
}
// 멀티모드 진입/이탈 시 "자리 추가" 좌석들을 자동으로 뺐다 복원 — startRoom 성공 시 / 방 나가기 시 호출.
function applyExtraSeatForMode(){
  // Presence.active()는 provider 세팅 이후에만 true — 비동기 초기화 중 호출될 수 있으므로
  // roomCode()도 함께 확인해 "방에 들어가는 중"도 방 안으로 간주한다(좌석 복원 오작동 방지).
  const inRoom = (typeof Presence()!=='undefined' && (Presence().active() || !!Presence().roomCode()));
  if(inRoom){
    seats.filter(x=>x.isExtra).forEach(s=>{ scene.remove(s.group); removeSeatLabels(s); });
    for(let ix=seats.length-1; ix>=0; ix--){ if(seats[ix].isExtra) seats.splice(ix,1); }
    layoutSeats();
    // extraSeatSlots 값 자체는 저장해둔 채로 유지(방 나가면 복원) — _saveExtraSeatSlots 호출 안 함.
  } else {
    // 이미 씬에 없는(=방에서 나온 직후) 슬롯들만 복원. 그 사이 삭제된 슬롯은 목록에서 정리.
    const toRestore = extraSeatSlots.filter(i=>!seats.some(x=>x.isExtra && x.extraSlot===i));
    extraSeatSlots = extraSeatSlots.filter(i=>slots()[i]);   // 삭제된 슬롯 정리
    _saveExtraSeatSlots();
    toRestore.forEach(i=>{ if(slots()[i]) addExtraSeat(i); });
  }
  renderCharSlots();
}

// 설정 패널 "캐릭터" 탭의 슬롯 UI 렌더링 — 패널 열릴 때 / 탭 전환 시 / 교체·자리추가 후 호출
// 슬롯 아이콘 엘리먼트 생성 — def.thumb(런처 미리보기를 찍은 것 · _lcThumbTake — 런처에서 아직 안 본 슬롯은 생성기 캡처)이 있으면 그걸 그대로 쓰고,
// 없으면(예전에 저장돼서 스냅샷이 없는 캐릭터) 기존 2D 합성 아이콘(drawFaceThumb)으로 대신 보여줌.
function makeCharThumbEl(d){
  const thumb = TwSafeHtml.safeUrl(d.thumb, 'image');
  if(thumb){
    const img=document.createElement('img');
    img.src=thumb;
    return img;
  }
  const cv=document.createElement('canvas'); cv.width=cv.height=80; drawFaceThumb(cv,d);   // drawFaceThumb은 80x80 기준 좌표라 이 크기로 그려야 안 잘림(CSS로 박스 크기에 맞게 축소 표시)
  return cv;
}
function renderCharSlots(){
  const mainWrap=document.getElementById('fsCharSlots');
  const addLabel=document.getElementById('fsAddSeatLabel');
  const addWrap=document.getElementById('fsAddSeatSlots');
  if(!mainWrap) return;
  /* ◀▶ 바인딩은 **맨 먼저** 한다.
     [경위] 제보 — "F1 캐릭터 교체에서 ▶ 를 눌러도 목록이 안 넘어가 5번째를 못 고른다."
       이 호출이 함수 아래쪽, 그것도 `if(inRoom){ … return; }` **뒤에** 있었다.
       방에 들어간 채로 설정을 열면 그 줄에서 되돌아 나가 화살표에 클릭 핸들러가 붙지 않는다.
       그런데 같은 줄이 _fsSyncSlotNav 는 부르므로 화살표는 **보이고 눌리는 것처럼** 남는다 —
       «보이는데 아무 일도 안 일어나는» 정확히 그 모양이다.
     ★ 화살표·창은 정적 HTML 이라 칸을 그리기 전에 붙여도 안전하다. 되돌아 나가는 갈래가
       앞으로 더 생겨도 바인딩만은 항상 지나가도록 여기 둔다. */
  _fsBindSlotNav();
  mainWrap.innerHTML='';
  slots().forEach((d,i)=>{
    const box=document.createElement('div');
    box.className='fs-charslot'+(i===curSlot()?' active':'')+(!d?' empty':'');
    if(d){
      box.appendChild(makeCharThumbEl(d));
      box.title=(i===curSlot())?'현재 캐릭터':'클릭해서 이 캐릭터로 교체';
      box.onclick=()=>switchMainCharacter(i);
    } else {
      box.textContent='empty';
    }
    mainWrap.appendChild(box);
  });
  if(!addWrap || !addLabel) return;
  const inRoom = (typeof Presence()!=='undefined' && Presence().active());
  addLabel.style.display = inRoom ? 'none' : 'block';
  /* ⚠️ 숨기는 대상이 슬롯 줄(#fsAddSeatSlots)이 아니라 **화살표까지 포함한 줄(.fs-slotrow)** 이다.
     안 옮기면 방에 들어갔을 때 칸만 사라지고 ◀▶ 화살표 두 개가 덩그러니 남는다. */
  const addRow = document.getElementById('fsAddSeatRow') || addWrap;
  addRow.style.display = inRoom ? 'none' : 'flex';
  if(inRoom){
    // 방 안에서도 캐릭터 교체 줄은 그대로 쓴다 — 솔로와 같게 «지금 쓰는 칸»을 보여준 뒤 화살표를 맞춘다
    _fsRevealSlot('fsCharSlots', curSlot());
    _fsSyncSlotNav('fsCharSlots');
    return;
  }
  addWrap.innerHTML='';
  slots().forEach((d,i)=>{
    const box=document.createElement('div');
    const isMain=(i===curSlot());
    const isAdded=(!isMain && extraSeatSlots.includes(i));
    box.className='fs-charslot'+(isMain?' active':'')+(isAdded?' added':'')+(!d?' empty':'');
    if(d){
      box.appendChild(makeCharThumbEl(d));
      if(isMain){ box.title='꾸미기 파츠 적용할 (주)캐릭터'; }
      else{
        box.title=isAdded?'클릭해서 자리에서 빼기':'클릭해서 자리에 앉히기';
        box.onclick=()=>toggleExtraSeat(i);
      }
    } else {
      box.textContent='empty';
    }
    addWrap.appendChild(box);
  });
  // 지금 쓰는 칸으로 창을 맞춘 뒤 화살표 상태를 잡는다 (5번째 슬롯을 쓰던 사람 배려)
  _fsRevealSlot('fsCharSlots', curSlot());
  _fsRevealSlot('fsAddSeatSlots', curSlot());
  _fsSyncSlotNav('fsCharSlots');
  _fsSyncSlotNav('fsAddSeatSlots');
}

/* ── 📐 슬롯 줄 좌우 넘김 ────────────────────────────────────────────────
   슬롯이 5칸이 되면서 300px 설정 패널을 넘겼다. 칸을 줄이는 대신 **4칸만 보이는 창**으로
   자르고 ◀▶ 로 민다(폭 계산 근거는 HTML 의 .fs-slotrow 주석에 적어뒀다).

   ⚠️ transform 으로 밀지 않고 창의 scrollLeft 를 쓴다 — 칸 크기·개수가 바뀌어도 브라우저가
     알아서 재는 쪽이 안 깨진다. 예전에 "칸을 3→5로 늘렸더니 계산식만 옛 숫자로 남는" 종류의
     사고를 피하려는 것이다. 여기엔 칸 수도 칸 폭도 적혀 있지 않다. */
/* ⚠️ 예전엔 «한 번 돌았으면 끝»(불리언 하나)이었다. 그러면 어떤 줄 하나가 그때 아직 없어서
     건너뛰어도 플래그는 켜지고, 그 줄은 **영영 바인딩되지 않는다.**
   ★ 줄마다 표시를 남긴다 — 붙은 줄은 다시 안 붙고, 못 붙은 줄은 다음 렌더에서 다시 시도한다. */
function _fsBindSlotNav(){
  const rows = document.querySelectorAll('#focusSettingsPanel .fs-slotrow');
  if(!rows.length) return;   // 아직 DOM 이 없으면 다음 렌더에서 다시 시도한다
  rows.forEach(row=>{
    if(row.dataset && row.dataset.navBound === '1') return;   // 이 줄은 이미 붙었다
    const vp = row.querySelector('.fs-slotvp');
    const strip = vp && vp.firstElementChild;
    if(!vp || !strip) return;   // 이 줄만 건너뛴다 — 다음 렌더에서 다시 시도된다
    row.querySelectorAll('.fs-slot-arrow').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        // 한 번에 창 하나만큼 = 보이는 칸 수만큼. 칸 수를 여기 적지 않는 이유다.
        vp.scrollLeft += (btn.dataset.dir === '-1' ? -1 : 1) * vp.clientWidth;
      });
    });
    // 부드러운 스크롤은 비동기라, 끝난 뒤 상태를 다시 맞춘다
    vp.addEventListener('scroll', ()=>_fsSyncSlotNav(strip.id));
    if(row.dataset) row.dataset.navBound = '1';
  });
}
function _fsSyncSlotNav(stripId){
  const strip = document.getElementById(stripId);
  const vp = strip && strip.parentElement;
  const row = vp && vp.parentElement;
  if(!row || !row.classList.contains('fs-slotrow')) return;
  const max = vp.scrollWidth - vp.clientWidth;
  const need = max > 1;   // 다 들어가면 화살표를 아예 안 보여준다 (칸이 3개로 줄어도 알아서 사라진다)
  row.querySelectorAll('.fs-slot-arrow').forEach(btn=>{
    btn.style.display = need ? '' : 'none';
    btn.disabled = !need || (btn.dataset.dir === '-1'
      ? vp.scrollLeft <= 1
      : vp.scrollLeft >= max - 1);
  });
}
/* 지금 쓰는 칸이 창 밖에 있으면 그 칸이 보이도록 맞춰 준다 —
   5번째 슬롯을 쓰던 사람이 패널을 열었을 때 빈 칸만 보이면 캐릭터가 사라진 줄 안다. */
function _fsRevealSlot(stripId, idx){
  const strip = document.getElementById(stripId);
  const vp = strip && strip.parentElement;
  if(!vp || !vp.classList.contains('fs-slotvp')) return;
  const box = strip.children[idx];
  if(!box) return;
  /* ⚠️ offsetLeft 는 **위치를 가진 가장 가까운 조상**(여기선 설정 패널) 기준이다 — 줄 기준이 아니다.
     그대로 쓰면 패널 안쪽 여백과 ◀ 버튼 폭까지 얹혀서, 창을 맞출 때 수십 px 씩 어긋난다.
     같은 기준인 strip 의 offsetLeft 를 빼면 «줄 안에서의 위치»가 된다. */
  const left = box.offsetLeft - strip.offsetLeft, right = left + box.offsetWidth;
  if(left < vp.scrollLeft) vp.scrollLeft = left;
  else if(right > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = right - vp.clientWidth;
}

return {
  EXTRA_SEAT_KEY,
  MY_AD_BANNER_KEY,
  _saveExtraSeatSlots,
  addExtraSeat,
  applyExtraSeatForMode,
  extraSeatSlots: ()=>extraSeatSlots,   // 읽는 함수
  setExtraSeatSlots: (v)=>{ extraSeatSlots = v; },   // 쓰는 함수 — app.js 가 비운다
  loadAdBannerSlides,
  refreshFsAdBanner,
  renderCharSlots,
};
}

const api = { createSettingsPanel };
if(typeof window !== 'undefined') window.TwSettingsPanel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
