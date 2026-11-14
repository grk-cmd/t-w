/* ═══════════════════════════════════════════════════════════════════════
   🧸 말랑이 (마이홈 시메지) — mallang.js
   · 마이홈 바탕화면 우측 하단 [말랑이] 폴더.
   · 우클릭 → 투명 PNG 등록(최대 4개 — 서버 상한 TwGiftApi.LIMITS.SLOTS, 가로 160px 리사이징). 칸은 서버가 원본이다 —
     상태 주인 mallang-store.js(내 칸 · 보고 있는 집 칸)가 받고 저장한다. 이 파일은 그리기 · 누름만(칸 값을 직접 고치지 않는다).
   · 폴더 클릭 → 등록된 이미지 중 랜덤으로 말랑이 소환(최대 30마리 — MAX_LIVE).
   · 말랑이는 #myHomeWin 창 전체 위를 통통 튀며 돌아다님(탭 이동해도 유지).
   · 짧게 누르면 하트 뿅뿅 + 제거 / 끌면 드래그(놓으면 다시 돌아다님).
   · 전부 로컬 상태 — 내 화면에만 존재, 마이홈 닫으면 전부 사라짐.
   · 방문 모드: 다른 폴더(좀아칼/캐릭터세팅/인벤토리)는 잠기지만 말랑이 폴더는 열림.
     방문자는 그 집 주인이 등록한 이미지로 자기 화면에 소환(각자 로컬).
   · 모듈 모양: window.TwMallang = { createMallang(deps) } — app.js 가 마이홈 수령함 모듈보다 먼저 만들고,
     마이홈 창(myhome-ui) · 친구 홈 구경(myhome-visit) · 수령함(myhome-inbox)이 deps `mallangMod` 로 받아 부른다.
     deps 5 — toast · getMyUserId · premiumOn(프리미엄 판정 — app.js _premiumOn) · mallangStore(칸 상태 주인 — mallang-store.js) · giftBox(선물 상태 주인 — gift-box.js).
     🎁 받은 선물은 선물 상태 주인(gift-box.js)이 서버에서 받아 오고 «내 선물 중 무엇이 화면에 나와야 하나» 도 정한다(onScreen) — 이 파일은 그 목록을 그리고(syncGifts) 🎁 배지를 맡는다. 선물 id 를 따로 들지 않는다.
     화면 자리(MAX_LIVE 동시 상한)는 이 파일의 사실이라 attachScreen 으로 선물함에 알린다. 남의 집에 나온 선물(방문자)은 이 파일이 한 번 그린다.
     🎁 보내기 창도 서버 길이다(giftBox.send · fetchSentToday — 창 상태는 이 파일 안). 보낸 사람 · 이름은 서버가 토큰에서 정한다.
   검사: checks/sim-mallang-module.js · sim-mallang-store.js · sim-gift-box.js
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

function createMallang(deps){
  const toast = deps.toast;
  const getMyUserId = deps.getMyUserId;
  const premiumOn = deps.premiumOn;   // 👑 프리미엄 판정(app.js _premiumOn) — 전역 window._premiumOn 을 읽지 않는다
  const mallangStore = deps.mallangStore;   // 🧸 칸 상태 주인(mallang-store.js) — mine() · view() · add · toggle · remove · pullMine · openView
  const giftBox = deps.giftBox;   // 🎁 선물 상태 주인(gift-box.js) — onScreen() · enterHome · leaveHome · attachScreen · hide · onChange · fetchVisible
  const LOAD = mallangStore.LOAD;

  const MAX_IMGS = mallangStore.SLOTS;   // 등록 칸 수 — 서버 상한 하나(TwGiftApi.LIMITS.SLOTS)
  /* 동시에 떠다닐 수 있는 말랑이 수 (20 → 30).
     ★ 🎁 선물 상한(서버 recipientCap=30)과 **같은 수로 맞춘다.** 남의 집에 30마리까지 보낼 수 있는데
       화면이 20에서 끊기면, 받는 사람은 "30마리라는데 20마리밖에 안 보인다"가 된다. */
  const MAX_LIVE = 30;
  /* 🎫 **부르는 순간 자리를 예약한다.**
     [경위] 자리 계산이 `live.length` 뿐이었는데, live 에 넣는 자리가 이미지 onload 안이라
       **비동기**다. 선물 30개를 실은 집에 들어가면 loadGifts 가 30번을 연달아 부르는데
       그때는 아직 아무 이미지도 안 실려서 live.length 가 계속 0 이다 — 상한 검사를 30번 다
       통과한다(실측: 30마리 전부 붙었다). 즉 이 문은 **한 마리씩 손으로 부를 때만** 걸려 있었다.
     ★ 그래서 예약분(_pending)을 같이 센다. 실려서 live 로 들어가거나, 로드에 실패하면 반납한다.
     ⚠️ 반납을 빠뜨리면 자리가 영영 줄어든 채로 남는다 — onload·onerror **양쪽**에서 놓을 것. */
  let _pending = 0;
  let _epoch = 0;                    // clearAll 마다 오른다 — 앞 집에서 그림을 받던 말랑이의 늦은 답이 새 집의 예약을 반납하지 않게
  function liveCount(){ return live.length + _pending; }
  function liveFull(){ return liveCount() >= MAX_LIVE; }
  const IMG_W = 80;          // 표시 가로폭(px), 세로는 정비율
  const SAVE_W = IMG_W * 2;  // 저장 해상도는 표시의 2배 — 고해상도 화면에서도 또렷하게 (표시 크기는 그대로 80px)
  const WALK = 0.5;          // 걷기 속도(px/frame)
  const GRAV = 0.6;          // 중력 가속도
  const REST_CHANCE = 0.004; // 매 프레임 쉬기 시작 확률
  const REST_MIN = 60, REST_MAX = 180;   // 쉬는 시간(프레임)

  let live = [];             // 살아있는 말랑이 인스턴스
  let rafId = null;
  let built = false;
  let visiting = false;      // 남의 마이홈 관람 중인가

  /* 잠깐 숨기기 — 마이홈 제목줄 버튼(#mhMallangHideBtn). 말랑이가 가득해 마이홈이 안 보일 때 판(#mlLayer)만 가린다.
     내 화면에서만 · 저장 없음 — 집을 옮기거나 마이홈을 닫으면(clearAll) 다시 보인다. 숨긴 동안은 움직임도 멈춘다(그릴 필요가 없다).
     버튼은 말랑이가 한 마리라도 있을 때만 보인다 — live 를 바꾼 자리는 모두 syncHideBtn() 을 부른다. */
  const HIDE_BTN_ID = 'mhMallangHideBtn';
  const HIDE_LABEL = { off: '말랑이 숨기기', on: '말랑이 보이기' };
  let hidden = false;
  function syncHideBtn(){
    const layer = document.getElementById('mlLayer');
    if(layer) layer.classList.toggle('ml-hidden', hidden);
    const b = document.getElementById(HIDE_BTN_ID); if(!b) return;
    b.style.display = (hidden || liveCount() > 0) ? 'inline' : 'none';
    b.textContent = hidden ? HIDE_LABEL.on : HIDE_LABEL.off;
    b.title = hidden ? '숨긴 말랑이를 다시 보여요' : '떠다니는 말랑이를 잠깐 가려요(이 화면에서만)';
  }
  function setHidden(on){
    hidden = !!on;
    if(!hidden && live.length && !rafId) rafId = requestAnimationFrame(tick);
    syncHideBtn();
  }

  function homeWin(){ return document.getElementById('myHomeWin'); }
  function roomBox(){ return document.getElementById('mhRoomPreview'); }   // 청록 바탕화면 박스
  function myId(){ try{ return getMyUserId(); }catch(_){ return null; } }
  function hasLicense(){ try{ return !!premiumOn(); }catch(_){ return false; } }
  function esc(s){ return TwSafeHtml.text(s); }   // 마크업 글자 안에 넣을 값 — 공용(shared/safe-html.js)

  /* ── 폴더 + 레이어 DOM 주입 ── */
  function build(){
    const win = homeWin(); if(!win || built) return;
    // 떠다니는 레이어 (창 전체, pointer-events는 개별 말랑이만)
    let layer = document.getElementById('mlLayer');
    if(!layer){
      layer = document.createElement('div');
      layer.id = 'mlLayer';
      layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:120;';
      win.appendChild(layer);
    }
    // 폴더는 refreshFolder()에서 조건에 맞게 생성/제거 (이미지 로드 후 호출됨)
    // 숨겨진 파일 입력
    let inp = document.getElementById('mlFileInput');
    if(!inp){
      inp = document.createElement('input');
      inp.id = 'mlFileInput'; inp.type = 'file'; inp.accept = 'image/png,image/*'; inp.style.display = 'none';
      win.appendChild(inp);
    }
    const hideBtn = document.getElementById(HIDE_BTN_ID);
    if(hideBtn) hideBtn.addEventListener('click', ()=>setHidden(!hidden));
    injectStyle();
    /* 칸이 바뀌면(받음 · 저장 · 409 뒤 다시 받음) 열린 등록 창을 다시 그린다 */
    mallangStore.onChange(()=>{
      const pop = document.getElementById('mlManage');
      if(pop && pop.classList.contains('on')) renderSlots(document.getElementById('mlFileInput'));
    });
    giftBox.attachScreen({ room: ()=>MAX_LIVE - liveCount(), has: giftHere });   // 🎁 화면 자리 · 이 선물이 화면에 있는가 — 어느 선물이 나와야 하는지는 선물함이 정한다
    giftBox.onChange(onBoxChange);   // 🎁 선물함이 바뀌면(받기 · 신호 · 봤음 · 치움 …) 배지 · 화면 맞추기
    built = true;
  }

  // 폴더 표시 여부 재판정 (내 집=라이선스 필요 / 방문=그 집에 말랑이 있으면)
  function refreshFolder(){
    const win = homeWin(); if(!win) return;
    const box = roomBox();
    let folder = document.getElementById('mlFolder');
    const shown = mallangStore.view().slots.length;
    const wantFolder = visiting ? (shown>0) : hasLicense();
    /* 🔬 진단 — **"말랑이 폴더가 안 보인다"를 한 줄로 가르기 위한 것.**
       [경위] 폴더가 안 뜨는 길이 넷인데(라이선스 없음 · 방문 중 이미지 0장 · 방 박스를 못 찾음 ·
         이 함수 자체가 안 불림) 화면에서는 전부 똑같이 "폴더가 없다"로만 보인다. 그래서 제보를 받고도
         마이홈 코드를 처음부터 다시 읽어야 했다. 이제 콘솔의 `[말랑이] 폴더` 줄이 첫 단서다.
       ★ 이 줄이 **아예 안 찍히면** 원인은 여기가 아니라 **부르는 쪽**이다 —
         app.js 의 마이홈 open() / _mhApplyVisitUI() 가 앞줄에서 죽은 것이다(그쪽 주석 참고).
       ⚠️ 동작은 바꾸지 않는다. 판정식은 위 한 줄 그대로다. */
    try{
      console.log('[말랑이] 폴더 ' + (wantFolder ? '표시' : '숨김')
        + ' — ' + (visiting ? '방문 중, 그 집 이미지 ' + shown + '장' : '내 집, 라이선스 ' + (hasLicense() ? 'O' : 'X'))
        + (box ? '' : ' · ⚠️ #mhRoomPreview 를 못 찾음'));
    }catch(_){}
    if(folder && !wantFolder){ try{ folder.remove(); }catch(_){} folder=null; }
    if(!folder && box && wantFolder){
      folder = document.createElement('div');
      folder.id = 'mlFolder';
      folder.title = visiting ? '클릭: 말랑이 소환' : '클릭: 말랑이 소환 · 우클릭: 이미지 등록';
      folder.innerHTML = '<div class="ml-ico">📁</div><div class="ml-lbl">👑 말랑이</div>';
      box.appendChild(folder);
      const inp = document.getElementById('mlFileInput');
      bindFolder(folder, inp);
    }
  }

  function injectStyle(){
    if(document.getElementById('mlStyle')) return;
    const s = document.createElement('style');
    s.id = 'mlStyle';
    s.textContent = `
      #mlFolder{position:absolute;right:10px;bottom:34px;width:66px;z-index:30;cursor:pointer;
        text-align:center;user-select:none;}
      #mlFolder .ml-ico{font-size:30px;line-height:1;filter:drop-shadow(1px 1px 0 rgba(0,0,0,.35));}
      #mlFolder .ml-lbl{display:inline-block;margin-top:3px;font-size:10px;color:#fff;padding:1px 3px;line-height:1.3;}
      #mlFolder:hover .ml-lbl{background:#000080;}
      #mlLayer.ml-hidden{visibility:hidden;}   /* 잠깐 숨기기 — 말랑이 · 하트 · 말풍선을 통째로 가린다(누를 수도 없다) */
      #mlLayer .ml-guy{position:absolute;pointer-events:auto;cursor:grab;user-select:none;
        will-change:transform;touch-action:none;}
      #mlLayer .ml-guy img{width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none;}
      #mlLayer .ml-guy .ml-msg{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:6px;
        max-width:150px;width:max-content;background:#fff;color:#222;font-family:Tahoma,'맑은 고딕',sans-serif;font-size:11px;
        line-height:1.45;padding:5px 8px;border:1px solid #555;border-radius:7px;box-shadow:1px 1px 0 rgba(0,0,0,.25);
        white-space:pre-wrap;word-break:break-word;text-align:center;pointer-events:none;opacity:0;transition:opacity .15s;}
      #mlLayer .ml-guy .ml-msg.on{opacity:1;}
      #mlLayer .ml-guy .ml-msg::after{content:'';position:absolute;left:50%;top:100%;transform:translateX(-50%);
        border:5px solid transparent;border-top-color:#555;}
      #mlLayer .ml-guy.dragging{cursor:grabbing;}
      #mlLayer .ml-heart{position:absolute;pointer-events:none;font-size:20px;
        animation:mlHeartUp .9s ease-out forwards;z-index:130;}
      @keyframes mlHeartUp{
        0%{opacity:1;transform:translateY(0) scale(.6);}
        100%{opacity:0;transform:translateY(-70px) scale(1.3);}}
      #mlManage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:140;
        width:280px;background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff;
        box-shadow:3px 3px 0 rgba(0,0,0,.4);display:none;}
      #mlManage.on{display:block;}
      #mlManage .ml-hd{background:linear-gradient(90deg,#00007a,#1084d0);color:#fff;font-weight:bold;
        font-size:11px;padding:3px 7px;display:flex;justify-content:space-between;align-items:center;}
      #mlManage .ml-hd .x{width:15px;height:13px;background:#c0c0c0;color:#000;border:1px solid;
        border-color:#fff #000 #000 #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;}
      #mlManage .ml-bd{padding:9px;}
      #mlManage .ml-note{font-size:10px;color:#333;margin-bottom:8px;line-height:1.5;}
      #mlSlots{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
      #mlSlots .ml-slot{aspect-ratio:1;background:#fff;border:1px solid;border-color:#808080 #fff #fff #808080;
        display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer;}
      #mlSlots .ml-slot img{max-width:100%;max-height:100%;}
      #mlSlots .ml-slot.off img{opacity:.25;filter:grayscale(1);}
      #mlSlots .ml-slot.off::after{content:'꺼짐';position:absolute;font-size:10px;color:#c33;font-weight:bold;
        background:rgba(255,255,255,.85);padding:1px 5px;}
      #mlSlots .ml-slot .ml-empty{font-size:10px;color:#999;text-align:center;}
      #mlSlots .ml-slot .ml-del{position:absolute;top:1px;right:1px;width:15px;height:15px;background:#c33;color:#fff;
        border:none;font-size:10px;cursor:pointer;display:none;align-items:center;justify-content:center;line-height:1;z-index:2;}
      #mlSlots .ml-slot:hover .ml-del{display:flex;}
      #mlSlots .ml-state{grid-column:1 / -1;font-size:10.5px;color:var(--tw-ink);text-align:center;padding:18px 0;}
      #mlSlots .ml-retry{font-size:10.5px;margin-left:4px;cursor:pointer;}
    `;
    document.head.appendChild(s);
  }

  /* ── 폴더 이벤트: 좌클릭 소환, 우클릭 등록 팝업 ── */
  function bindFolder(folder, inp){
    folder.addEventListener('click', ()=>{ summonRandom(); });
    folder.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      if(visiting){ toast('관람 중에는 이미지를 등록할 수 없어요'); return; }
      openManage(inp);
    });
  }

  /* ── 이미지 등록 팝업 ── */
  function openManage(inp){
    let pop = document.getElementById('mlManage');
    if(!pop){
      pop = document.createElement('div');
      pop.id = 'mlManage';
      pop.innerHTML = '<div class="ml-hd"><span>🧸 말랑이 이미지 (최대 4개)</span><span class="x" id="mlManageClose">×</span></div>'+
        '<div class="ml-bd"><div class="ml-note">투명 PNG를 등록하면 폴더 클릭 시 랜덤으로 소환돼요. (가로 150px)<br>이미지 <b>우클릭 = 켜기/끄기</b> · 우상단 × = 삭제. 꺼진 건 소환되지 않아요.</div>'+
        '<div id="mlSlots"></div></div>';
      homeWin().appendChild(pop);
      pop.querySelector('#mlManageClose').addEventListener('click', ()=>pop.classList.remove('on'));
    }
    renderSlots(inp);
    pop.classList.add('on');
  }

  function renderSlots(inp){
    const wrap = document.getElementById('mlSlots'); if(!wrap) return;
    wrap.innerHTML = '';
    const st = mallangStore.mine();
    /* 받기 전 · 받는 중 · 못 받음 — 칸을 그리지 않는다(고치기 잠금). 못 받음과 «말랑이 없음»(빈 칸 넷)을 가른다 */
    if(st.load !== LOAD.READY){
      const msg = document.createElement('div'); msg.className = 'ml-state';
      msg.textContent = st.load === LOAD.FAILED ? '못 불러왔어요 ' : '불러오는 중…';
      if(st.load === LOAD.FAILED){
        const again = document.createElement('button'); again.className = 'ml-retry'; again.textContent = '다시 시도';
        again.addEventListener('click', (e)=>{ e.stopPropagation(); mallangStore.pullMine(); });
        msg.appendChild(again);
      }
      wrap.appendChild(msg);
      return;
    }
    for(let i=0;i<MAX_IMGS;i++){
      const slot = document.createElement('div');
      slot.className = 'ml-slot';
      const item = st.slots[i];
      if(item){
        if(!item.enabled) slot.classList.add('off');
        /* 주소는 남의 것일 수 있다(선물) — 허용된 그림 주소만 · 마크업에 붙이지 않고 요소로 */
        const src = TwSafeHtml.safeUrl(item.imageUrl, 'image');
        if(src){ const im = TwImgRetry.retryOnError(document.createElement('img')); im.src = src; im.alt = ''; slot.appendChild(im); }
        const del = document.createElement('button'); del.className = 'ml-del'; del.dataset.i = String(i); del.textContent = '×';
        slot.appendChild(del);
        slot.querySelector('.ml-del').addEventListener('click', (e)=>{ e.stopPropagation(); mallangStore.remove(i); });
        // 우클릭 = 활성/비활성 토글
        slot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); e.stopPropagation(); mallangStore.toggle(i); });
      } else {
        slot.innerHTML = '<span class="ml-empty">+ 등록</span>';
        slot.addEventListener('click', ()=>{ pickImage(inp); });
      }
      wrap.appendChild(slot);
    }
  }

  // 이미지 처리 공통부 — 소스(File 또는 dataURL)를 리사이즈해 칸 상태 주인에 넘긴다(올리기 · 칸 끝에 더하기 · 저장 · 실패 번호는 그쪽)
  const BUSY_MSG = '말랑이 이미지 처리 중…';
  async function _registerImage(src){
    toast(BUSY_MSG);
    const dataUrl = await resizeToWidth(src, SAVE_W).catch(()=>null);
    if(!dataUrl){ toast('이미지를 불러오지 못했어요'); return; }
    const r = await mallangStore.add(dataUrl);
    if(r === 'ok') toast('말랑이가 등록됐어요!');   // 칸 저장까지 됐을 때만 — 그림만 올라가고 칸이 안 실렸으면 등록이 아니다
    else if(r === 'busy') toast(BUSY_MSG);
  }
  function pickImage(inp){
    if(mallangStore.mine().uploading){ toast(BUSY_MSG); return; }   // 올리는 중 또 등록 — 올린 그림이 어느 칸에 붙을지 흐려진다
    // ★ Electron에선 <input type=file>.click()이 사용자 제스처 판정 때문에 무시되는 경우가 있음
    //   (디자인 스튜디오에서 이미 겪고 고친 것과 동일). main의 OS 파일 대화상자(companion.pickImage)를
    //   우선 사용하고, 그 경로가 없으면(브라우저 미리보기 등) 기존 input 방식으로 폴백.
    if(window.companion && companion.pickImage){
      try{ if(companion.dsHold) companion.dsHold(); }catch(_){}
      companion.pickImage().then(dataUrl=>{
        if(!dataUrl) return;   // 취소
        _registerImage(dataUrl);
      }).catch(()=>{ toast('이미지를 불러오지 못했어요'); });
      return;
    }
    if(!inp){ toast('이미지를 불러올 수 없어요 — 앱을 재시작해 주세요'); return; }
    inp.onchange = async ()=>{
      const file = inp.files && inp.files[0]; inp.value=''; if(!file) return;
      _registerImage(file);
    };
    inp.click();
  }

  /* ── 이미지를 가로 IMG_W에 맞춰 정비율 리사이징 (투명 PNG 유지) ── */
  function _drawResized(img, w){
    // 큰 원본을 한 번에 확 줄이면 뭉개짐 — 절반씩 단계적으로 줄이면서 고품질 보간을 쓰면 훨씬 선명함.
    const ratio = img.height / img.width;
    const targetW = w, targetH = Math.max(1, Math.round(w*ratio));
    let src = img, sw = img.width, sh = img.height;
    while(sw / 2 > targetW){
      const half = document.createElement('canvas');
      half.width = Math.max(targetW, Math.round(sw/2));
      half.height = Math.max(targetH, Math.round(sh/2));
      const hctx = half.getContext('2d');
      hctx.imageSmoothingEnabled = true; hctx.imageSmoothingQuality = 'high';
      hctx.drawImage(src, 0, 0, half.width, half.height);
      src = half; sw = half.width; sh = half.height;
    }
    const cv = document.createElement('canvas'); cv.width=targetW; cv.height=targetH;
    const ctx = cv.getContext('2d'); ctx.clearRect(0,0,targetW,targetH);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, targetW, targetH);
    return cv.toDataURL('image/png');
  }
  function resizeToWidth(src, w){
    // src: File 객체 또는 dataURL 문자열(네이티브 대화상자 경로) 둘 다 지원
    if(typeof src === 'string'){
      return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>{ try{ res(_drawResized(img, w)); }catch(e){ rej(e); } };
        img.onerror = rej;
        img.src = src;
      });
    }
    const file = src;
    return new Promise((res, rej)=>{
      const fr = new FileReader();
      fr.onload = ()=>{
        const img = new Image();
        img.onload = ()=>{ try{ res(_drawResized(img, w)); }catch(e){ rej(e); } };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  /* ── 말랑이 소환 ── */
  function summonRandom(){
    const v = mallangStore.view();
    if(v.load === LOAD.LOADING) return;   // 받는 중 — 답이 오면 다시 누른다
    /* 내 칸을 못 받았으면 누름 = 다시 받기 한 번(실패면 E-GIFT-01) — 받으면 그때 부른다 */
    if(v.mine && v.load === LOAD.FAILED){ mallangStore.pullMine().then(ok=>{ if(ok && !visiting) summonRandom(); }); return; }
    const active = v.slots.filter(x=>x && x.enabled);
    if(!active.length){
      toast(visiting ? '이 친구는 아직 말랑이를 등록하지 않았어요' : '먼저 우클릭으로 말랑이 이미지를 등록하세요');
      return;
    }
    if(liveFull()){
      toast('말랑이가 너무 많아요! (최대 '+MAX_LIVE+')');
      return;
    }
    const pick = active[Math.floor(Math.random()*active.length)];
    spawn(pick.imageUrl);
  }

  function spawn(url, gift){
    const layer = document.getElementById('mlLayer'); if(!layer) return;
    if(liveFull()) return;          // 🎫 부르는 쪽에서도 보지만, 여기가 마지막 문이다
    const win = homeWin(); const rect = win.getBoundingClientRect();
    const guy = document.createElement('div');
    guy.className = 'ml-guy';
    const im = new Image();
    _pending++;                     // 🎫 자리 예약 — 아래 onload/onerror 에서 반드시 놓는다
    let _slotDone = false;
    const _ep = _epoch;
    const _release = ()=>{ if(_slotDone) return; _slotDone = true; if(_ep === _epoch) _pending = Math.max(0, _pending - 1); };
    if(gift){ guy.dataset.gid = gift.giftId; if(gift.isOwner) guy.dataset.own = '1'; }   // 🎁 화면에 있는 선물 표시 — giftHere · syncGifts 가 찾는다
    TwImgRetry.retryOnError(im, ()=>{ _release(); try{ guy.remove(); }catch(_){} });   // 한 번 더 받아도 못 받으면 자리를 놓는다
    im.onload = ()=>{
      _release();
      if(!guy.isConnected){ return; }   // 받는 사이 치웠거나 집을 옮겨 이미 빠진 말랑이는 띄우지 않는다
      const ratio = im.naturalHeight / (im.naturalWidth||1);
      const w = IMG_W, hh = Math.round(IMG_W*ratio);
      guy.style.width = w+'px'; guy.style.height = hh+'px';
      const inst = {
        el:guy, w, hh,
        x: Math.random()*Math.max(1,(rect.width - w)),
        y: 0,
        vx: (Math.random()<.5?-1:1)*WALK,
        vy: 0,
        onGround:false, dragging:false, moved:false, onBox:false,
        rest:0,
        gift: gift || null,          // 선물이면 {giftId, isOwner, msg, url}
      };
      inst.y = Math.random()*rect.height*0.3;
      place(inst); setFacing(inst);
      bindGuy(inst);
      live.push(inst);
      if(!rafId) rafId = requestAnimationFrame(tick);
      syncHideBtn();
    };
    const src = TwSafeHtml.safeUrl(url, 'image');   // 남의 집 · 선물 주소 — 허용된 그림 주소만
    if(!src){ _release(); return; }
    guy.appendChild(im);
    im.src = src;
    layer.appendChild(guy);
  }

  function place(inst){ inst.el.style.transform = 'translate('+inst.x+'px,'+inst.y+'px)'; }
  function setFacing(inst){
    // 진행 방향으로 좌우 반전 (오른쪽 이동이면 정방향) + 벽타기 중이면 기울임.
    // ★ transform은 하나뿐이라 회전과 반전을 같은 문자열에 합쳐야 한다(따로 쓰면 나중 것이 앞을 지움).
    const img = inst.el.firstChild; if(!img) return;
    const flip = (inst.vx < 0) ? 'scaleX(-1)' : 'scaleX(1)';
    let rot = '';
    // ★ 회전 기준점 — 기본은 '중심'이라 90도로 눕는 순간 몸의 절반이 발 아래로 내려가 바닥에 잘린다.
    //   벽타는 동안만 '발밑(50% 100%)'을 축으로 삼으면, 몸이 옆·위로만 돌아 발 아래로는 절대 안 넘어간다.
    img.style.transformOrigin = inst.climb ? '50% 100%' : '';
    if(inst.climb){
      // 왼쪽 벽이면 오른쪽으로, 오른쪽 벽이면 왼쪽으로 기운다(벽에 배를 붙인 모양).
      const deg = WALL_CLIMB_DEG * (inst.climb === 'left' ? 1 : -1);
      rot = 'rotate(' + deg + 'deg) ';
    }
    img.style.transform = rot + flip;
  }

  /* 🧗 벽타기 설정 — 전부 클라이언트 애니메이션이라 서버와 무관하다. */
  const WALL_CLIMB_DEG    = 90;    // ★ 벽에 붙었을 때 기우는 각도(90=벽에 완전히 눕는 자세)
  const WALL_CLIMB_SPEED  = 0.9;   // ★ 올라가는 속도(px/frame)
  const WALL_CLIMB_CHANCE = 0.35;  // ★ 벽에 닿았을 때 오르기를 시도할 확률(나머지는 그냥 돌아섬)
  const WALL_CLIMB_MIN_Y  = 40;    // ★ 이보다 위로는 안 올라감(창 상단 여백)
  const WALL_CLIMB_MAXF   = 260;   // ★ 최대 매달림 프레임 — 이 시간이 지나면 손을 놓고 떨어진다
  const WALL_CLIMB_HUG    = 35;     // ★ 벽 쪽으로 더 붙이는 양(px). 발밑을 축으로 눕히면 몸이 살짝 뜨는 걸 보정.

  /* 🚶 뭉침 방지 헬퍼 ────────────────────────────────
     chainAhead: 진행 방향 앞에 '붙어 줄지어 선' 말랑이 수(접촉 판정은 tryMove와 동일 기준).
     pickDir  : 좌우 중 말랑이가 적은 쪽을 70% 확률로 선택(30%는 랜덤 — 너무 기계적이지 않게). */
  function chainAhead(inst, dir){
    let cur = inst, n = 0;
    for(let guard=0; guard<8; guard++){
      let next = null;
      for(let k=0;k<live.length;k++){
        const o = live[k];
        if(o===cur || o.dragging || !o.onGround || !cur.onGround) continue;
        if(Math.abs((o.y+o.hh) - (cur.y+cur.hh)) >= 20) continue;   // 높이 다르면 딴 줄
        const touch = (dir>0) ? (o.x > cur.x && o.x < cur.x + cur.w*0.75)
                              : (o.x < cur.x && cur.x < o.x + o.w*0.75);
        if(!touch) continue;
        if(!next || (dir>0 ? o.x < next.x : o.x > next.x)) next = o;   // 가장 가까운 상대
      }
      if(!next) break;
      n++; cur = next;
    }
    return n;
  }
  /* 🫨 제자리 떨림 막기 (2026-09-23 제보 «갈 곳이 없으면 좌우로 굉장히 빠르게 움직인다 — 차라리 멈춰 있었으면»)
     [원인] 막히면(tryMove 실패 · 앞에 줄) 그 자리에서 방향만 뒤집었다. 반대쪽도 막혀 있거나, 남의 머리 위처럼
       발 디딜 폭이 몇 px 뿐이면 **한두 프레임마다** 뒤집혀 좌우로 파르르 떤다. 걷는 게 아니라 깜빡이는 것이다.
     [고침] 돌아서는 자리를 한 곳(turnOrRest)으로 모으고, 짧은 간격(JITTER_GAP_F) 안에 JITTER_TURNS 번째로
       돌아서려 하면 뒤집는 대신 **쉰다**(REST_MIN~MAX). 쉬고 나면 pickDir 로 다시 고른다 — 그 사이 자리가 나면 걷는다.
     ★ 평소 걸음(벽에 한 번 닿고 돌아서는 것)은 간격이 길어 여기 안 걸린다. */
  const JITTER_GAP_F = 40;   // ★ 이 프레임 안에 다시 돌아서면 «짧은 간격»(약 0.7초)
  const JITTER_TURNS = 3;    // ★ 짧은 간격으로 이만큼 돌아서려 하면 멈춰 쉰다
  function turnOrRest(inst){
    inst._turnN = ((inst._sinceTurn|0) < JITTER_GAP_F && inst._sinceTurn != null) ? (inst._turnN|0) + 1 : 1;
    inst._sinceTurn = 0;
    if(inst._turnN >= JITTER_TURNS){
      inst._turnN = 0;
      inst.rest = REST_MIN + Math.floor(Math.random()*(REST_MAX-REST_MIN));
      return false;   // 쉰다
    }
    inst.vx = -inst.vx;
    return true;      // 돌아섰다
  }
  function pickDir(inst){
    let _nL=0, _nR=0;   // ★ 고유 이름 — audit 검사6의 파일 단위 const 이름충돌 오탐 회피
    const cx = inst.x + inst.w/2;
    live.forEach(o=>{ if(o===inst || o.dragging) return; const ox=o.x+o.w/2; (ox<cx) ? _nL++ : _nR++; });
    if(_nL===_nR || Math.random()<0.3) return Math.random()<.5 ? -1 : 1;
    return (_nL<_nR) ? -1 : 1;
  }

  /* ↔ 밀어내기 — dx만큼 움직이려 할 때 앞을 막은 말랑이를 함께 민다.
     예전엔 겹치면 서로 방향을 뒤집었는데, 빽빽하면 A→B→A로 되돌려지며 제자리에서 마구 반전했다.
     밀 수 있으면 밀고, 벽까지 꽉 차서 못 밀 때만 돌아선다.
     depth 상한으로 무한 연쇄를 막는다. */
  function tryMove(inst, dx, depth){
    depth = depth || 0;
    const fl = floorFor(inst);
    let nx = inst.x + dx;
    if(nx < fl.minX) nx = fl.minX;
    if(nx > fl.maxX) nx = fl.maxX;
    if(nx === inst.x) return false;                 // 벽에 붙어 더 못 감
    if(depth < 6){
      for(let k=0;k<live.length;k++){
        const o = live[k];
        if(o===inst || o.dragging || !o.onGround || !inst.onGround) continue;
        if(Math.abs((o.y+o.hh) - (inst.y+inst.hh)) >= 20) continue;   // 높이가 다르면 안 부딪힘
        const willHit = (nx < o.x + o.w*0.6) && (o.x < nx + inst.w*0.6);
        if(!willHit) continue;
        const sameDir = (dx > 0) ? (o.x > inst.x) : (o.x < inst.x);
        if(!sameDir) continue;                       // 뒤쪽 상대는 밀 대상이 아님
        if(!tryMove(o, dx, depth+1)) return false;   // 상대가 못 밀리면 나도 못 감
      }
    }
    const moved = nx - inst.x;
    inst.x = nx;
    place(inst);
    // 🧱 내 머리 위에 서 있는 말랑이도 같이 데려간다(안 그러면 발밑이 빠져나가 떨어진다).
    if(depth < 6 && moved){
      // ★ 3층 이상이면 '위의 위'까지 따라와야 한다 — 한 층만 옮기면 맨 위가 발밑을 잃고 떨어진다.
      //   depth 상한(6)이 재귀를 막아주므로 안전하다.
      const _carry = (host, dx, d)=>{
        if(d > 6) return;
        _ridersOf(host).forEach(r=>{
          const rf = floorFor(r);
          r.x = Math.max(rf.minX, Math.min(rf.maxX, r.x + dx));   // 따라갈 때도 영역 밖으로 못 나감
          place(r);
          _carry(r, dx, d+1);
        });
      };
      _carry(inst, moved, depth+1);
    }
    return true;
  }

  // 이 말랑이의 '바닥 y'를 구한다.
  //   inst.onBox=true 이고 중심이 박스 가로 범위 안이면 박스 바닥, 그 외엔 창 바닥.
  function floorFor(inst){
    const win = homeWin(); const wrect = win.getBoundingClientRect();
    const winFloor = { y: wrect.height - inst.hh, kind:'win', minX:0, maxX:wrect.width-inst.w };
    const box = roomBox();
    if(inst.onBox && box){
      const br = box.getBoundingClientRect();
      const bx = br.left - wrect.left, by = br.top - wrect.top;
      const bw = br.width, bh = br.height;
      const cx = inst.x + inst.w/2;
      if(cx >= bx && cx <= bx+bw){
        return _stackFloor(inst, { y: by + bh - inst.hh, kind:'box', minX:bx, maxX:bx+bw-inst.w });   // 박스 위에서도 쌓기 가능
      }
      // 박스 밖으로 벗어남 → 박스에서 내려와 창 바닥으로
      inst.onBox = false;
    }
    return _stackFloor(inst, winFloor);
  }
  /* 🧱 쌓기 — 다른 말랑이의 머리도 '바닥'으로 본다.
     내 발(y+hh)보다 아래에 있는 머리들 중 가장 높은 것을 고른다.
     ★ '내 아래'라는 조건이 없으면 옆에 있는 말랑이 머리로 순간이동하듯 솟구친다.
     좌우 범위(minX/maxX)는 상대 몸 위로 제한해서, 벗어나면 자연스럽게 떨어지게 한다. */
  function _stackFloor(inst, base){
    let best = base;
    for(let i=0;i<live.length;i++){
      const o = live[i];
      if(o===inst || o.dragging || o.climb) continue;
      const cand = o.y - inst.hh;                 // o의 머리 위에 섰을 때의 y
      if(cand >= best.y) continue;                // 지금 바닥보다 낮으면 의미 없음
      if(cand < inst.y - 4) continue;             // 내 현재 위치보다 위 → 밟고 올라설 수 없음
      const cx = inst.x + inst.w/2;
      if(cx < o.x || cx > o.x + o.w) continue;    // 상대 몸 위에 있어야 함
      //  ★ 좌우 한계를 '원래 바닥(창/박스) 범위' 안으로 가둔다.
      //    안 그러면 상대가 가장자리에 있을 때 minX가 음수가 되어, 밀릴 때 마이홈 밖으로 나간다.
      best = { y: cand, kind:'mallang', host:o,
               minX: Math.max(base.minX, o.x - inst.w*0.45),
               maxX: Math.min(base.maxX, o.x + o.w - inst.w*0.55) };
    }
    return best;
  }
  /* 나를 밟고 서 있는 말랑이들 — 내가 움직이면 같이 데려간다. */
  function _ridersOf(inst){
    const out=[];
    for(let i=0;i<live.length;i++){
      const o=live[i];
      if(o===inst || o.dragging || o.climb || !o.onGround) continue;
      if(Math.abs((o.y + o.hh) - inst.y) > 6) continue;   // 내 머리 높이에 발이 있어야
      const cx = o.x + o.w/2;
      if(cx < inst.x || cx > inst.x + inst.w) continue;
      out.push(o);
    }
    return out;
  }
  // 특정 y 좌표가 박스 영역 '위'에 놓인 상태인지 (드래그 놓을 때 판정)
  function droppedOnBox(inst){
    const box = roomBox(); if(!box) return false;
    const win = homeWin(); const wrect = win.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const bx = br.left - wrect.left, by = br.top - wrect.top, bw = br.width, bh = br.height;
    const cx = inst.x + inst.w/2;
    const feet = inst.y + inst.hh;   // 발 위치
    // 중심이 박스 가로 안 + 발이 박스 세로 범위 안(위~바닥)이면 박스에 올려놓은 것
    return (cx >= bx && cx <= bx+bw && feet >= by && feet <= by+bh+inst.hh*0.5);
  }

  /* ── 드래그 vs 클릭 구분 + 하트 제거 ── */
  function bindGuy(inst){
    const el = inst.el;
    let sx=0, sy=0, ox=0, oy=0, down=false;
    const onDown = (e)=>{
      if(e.button===2) return;   // 우클릭은 드래그/점프 아님 (contextmenu에서 처리)
      e.preventDefault();
      down=true; inst.dragging=true; inst.moved=false; inst.rest=0; el.classList.add('dragging');
      const p = point(e); sx=p.x; sy=p.y; ox=inst.x; oy=inst.y;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    const onMove = (e)=>{
      if(!down) return;
      const p = point(e);
      const dx=p.x-sx, dy=p.y-sy;
      if(Math.abs(dx)>3 || Math.abs(dy)>3) inst.moved=true;
      const win = homeWin(); const rect = win.getBoundingClientRect();
      inst.x = Math.max(0, Math.min(rect.width-inst.w, ox+dx));
      inst.y = Math.max(0, Math.min(rect.height-inst.hh, oy+dy));
      place(inst);
    };
    const onUp = (e)=>{
      down=false; inst.dragging=false; el.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if(!inst.moved){ jumpAndHearts(inst); showGiftMsg(inst); }   // 안 움직였으면 = 좌클릭 = 콩콩 점프 + 하트 (+ 선물 메시지 말풍선)
      else {
        inst.onBox = droppedOnBox(inst);
        inst.onGround=false; inst.vy=0;
        inst.vx = pickDir(inst)*WALK; setFacing(inst);   // ★ 덜 붐비는 쪽으로
      }
    };
    el.addEventListener('pointerdown', onDown);
    // 우클릭 = 하트 뿜으며 사라짐
    el.addEventListener('contextmenu', (e)=>{ e.preventDefault(); e.stopPropagation(); heartsAndRemove(inst); });
  }
  function point(e){ return { x: e.clientX, y: e.clientY }; }

  function spawnHearts(inst){
    const layer = document.getElementById('mlLayer'); if(!layer) return;
    const hearts = 3 + Math.floor(Math.random()*3);
    const cx = inst.x + inst.w/2, cy = inst.y + inst.hh*0.3;
    for(let i=0;i<hearts;i++){
      const h = document.createElement('div');
      h.className = 'ml-heart'; h.textContent = ['💗','💖','💕','❤️'][Math.floor(Math.random()*4)];
      h.style.left = (cx + (Math.random()*40-20))+'px';
      h.style.top  = (cy + (Math.random()*20-10))+'px';
      h.style.animationDelay = (Math.random()*0.15)+'s';
      layer.appendChild(h);
      setTimeout(()=>{ try{ h.remove(); }catch(_){} }, 1000);
    }
  }
  // 좌클릭 — 콩콩 점프 + 하트 (제거 안 함)
  // 💬 선물 메시지 말풍선 — 선물받은 말랑이를 클릭하면 머리 위에 메시지만 잠깐 표시.
  //   메시지 없이 보낸 선물은 말풍선이 뜨지 않음. 방문자도 볼 수 있음.
  const MSG_MS = 4000;
  function showGiftMsg(inst){
    const msg = inst.gift && inst.gift.msg;
    if(!msg) return;
    let b = inst._msgEl;
    if(!b){
      b = document.createElement('div');
      b.className = 'ml-msg';
      inst.el.appendChild(b);
      inst._msgEl = b;
    }
    b.textContent = msg;
    b.classList.add('on');
    clearTimeout(inst._msgT);
    inst._msgT = setTimeout(()=>{ try{ b.classList.remove('on'); }catch(_){} }, MSG_MS);
  }

  function jumpAndHearts(inst){
    spawnHearts(inst);
    // 이미 점프 중이 아니면 위로 튕김 → 중력으로 착지
    if(inst.onGround){ inst.onGround=false; inst.vy = -9; }
  }
  // 우클릭 — 하트 뿜으며 사라짐 (선물이면 집주인만 «선물함으로 치움», 방문자는 못 없앰)
  function heartsAndRemove(inst){
    spawnHearts(inst);
    if(inst.gift){
      if(!inst.gift.isOwner){ return; }   // 방문자는 선물 못 없앰 (하트만)
      // ★ 서버 기록은 남기고 '선물함으로 되돌리기'(hidden)만 한다 — 선물함에서 클릭하면 다시 나온다. 하트 연출은 바로, 결과는 서버 답을 보고:
      //   성공하면 안내 · 실패하면 그 말랑이를 다시 띄운다(서버는 «나와 있음»). 이미 없는 선물(gone) · 계정이 바뀜(stale)은 다시 띄우지 않는다.
      //   치우는 즉시 선물함이 화면 목록에서 빼고(emit → syncGifts 가 이 말랑이를 걷음) · 안 되면 일을 지워 목록이 서버 값으로 돌아가며 다시 뜬다. 여기서 손으로 다시 띄우지 않는다.
      const seq = houseSeq;
      giftBox.hide(inst.gift.giftId).then(r=>{
        if(seq !== houseSeq) return;
        if(r === 'ok') toast('🎁 선물함으로 돌아갔어요 (선물함에서 다시 부를 수 있어요)');
      });
      return;
    }
    removeGuy(inst);
    syncGifts();   // 자리가 났다 — 자리가 없어 못 뜬 선물이 있으면 이제 뜬다
  }
  function removeGuy(inst){
    try{ inst.el.remove(); }catch(_){}
    live = live.filter(x=>x!==inst);
    if(!live.length && rafId){ cancelAnimationFrame(rafId); rafId=null; }
    syncHideBtn();
  }

  /* ── 애니메이션 루프: 창 안에서 통통 튀기 ── */
  function tick(){
    const win = homeWin();
    if(!win || hidden){ rafId=null; return; }   // 숨긴 동안은 멈춘다 — 다시 보이면 setHidden 이 깨운다
    const wrect = win.getBoundingClientRect();

    live.forEach(inst=>{
      if(inst.dragging){ if(inst.climb){ inst.climb=null; setFacing(inst); } return; }
      const fl = floorFor(inst);

      // 🧗 벽타기 — 벽에 붙어 위로 올라간다. 시간이 다 되거나 꼭대기에 닿으면 손을 놓고 떨어진다.
      if(inst.climb){
        // ★ 벽 x는 '오르기 시작할 때' 정해 고정한다. 매 프레임 floorFor로 다시 구하면, 올라가는 도중
        //   아래에 있는 다른 말랑이가 바닥으로 잡히면서 그 몸 폭을 벽으로 착각해 벽에서 떨어져 오른다.
        const wallX = inst.climbX;
        inst.x = wallX;
        inst.y -= WALL_CLIMB_SPEED;
        inst.climbF++;
        if(inst.y <= WALL_CLIMB_MIN_Y || inst.climbF > WALL_CLIMB_MAXF){
          inst.climb = null; inst.onGround = false; inst.vy = 0;
          inst.vx = (inst.climb0 === 'left') ? Math.abs(inst.vx) : -Math.abs(inst.vx);   // 벽에서 떨어지며 안쪽으로
          setFacing(inst);
        }
        place(inst);
        return;
      }
      if(!inst.onGround){
        // 낙하 중 — 중력
        inst.vy += GRAV;
        inst.y += inst.vy;
        if(inst.y >= fl.y){ inst.y = fl.y; inst.vy = 0; inst.onGround = true; }
      } else {
        // 바닥에 착지 상태 — 쉬거나 걷기
        if(inst.rest>0){
          inst.rest--;
          if(inst.rest===0){ inst.vx = pickDir(inst)*WALK; setFacing(inst); }   // ★ 깨어날 때 덜 붐비는 쪽으로
        }
        else{
          if(Math.random() < REST_CHANCE){ inst.rest = REST_MIN + Math.floor(Math.random()*(REST_MAX-REST_MIN)); }
          else{
            inst._sinceTurn = (inst._sinceTurn == null) ? JITTER_GAP_F : inst._sinceTurn + 1;   // 🫨 마지막으로 돌아선 뒤 걸은 프레임
            // 앞을 막은 말랑이는 밀고 간다 — 단 ★2마리 이상 줄지어 있으면 못 밀고 돌아선다(뭉침 방지).
            //   양쪽 다 붐비면 반전 반복(제자리 지터) 대신 잠깐 쉰다.
            const _dir = inst.vx > 0 ? 1 : -1;
            if(chainAhead(inst, _dir) >= 2){
              if(chainAhead(inst, -_dir) >= 2){
                inst.rest = REST_MIN + Math.floor(Math.random()*(REST_MAX-REST_MIN));
              } else {
                turnOrRest(inst); setFacing(inst);   // 🫨 짧게 반복되면 뒤집지 않고 쉰다
              }
            }
            else if(!tryMove(inst, inst.vx)){
              const atLeft  = inst.x <= fl.minX + 0.5;
              const atRight = inst.x >= fl.maxX - 0.5;
              // 벽에 닿았고 운이 맞으면 벽타기 시작
              // ★ 창 바닥에 있을 때만 벽타기 — fl.minX/maxX는 '올라탄 상대의 몸 폭'이나 '박스 폭'으로도
              //   좁아지는데, 그걸 벽으로 착각하면 공중에서 벽을 타버린다(실제로 그렇게 터졌음).
              if(fl.kind === 'win' && (atLeft || atRight) && !inst.climb && Math.random() < WALL_CLIMB_CHANCE){
                inst.climb = atLeft ? 'left' : 'right';
                inst.climb0 = inst.climb;                       // 떨어질 때 방향 판정용(위 주석 참고)
                inst.climbX = atLeft ? (fl.minX - WALL_CLIMB_HUG)
                                     : (fl.maxX + WALL_CLIMB_HUG);   // 벽 좌표 고정 + 벽 쪽으로 더 붙임
                inst.climbF = 0;
              }else{
                turnOrRest(inst);   // 🫨 짧게 반복되면 뒤집지 않고 쉰다
              }
              setFacing(inst);
            }
          }
        }
        // 박스에 얹혀 걷다가 박스 밖으로 나갔으면(floorFor가 onBox=false로 바꿈) 다시 낙하
        const fl2 = floorFor(inst);
        if(fl2.y > inst.y + 1){ inst.onGround=false; inst.vy=0; }   // 새 바닥이 더 아래 → 떨어짐
        else inst.y = fl2.y;
      }
      place(inst);
    });

    // ── 충돌: 겹치면 서로 방향 반전 (같은 바닥/비슷한 높이일 때만) ──
    for(let i=0;i<live.length;i++){
      for(let j=i+1;j<live.length;j++){
        const a=live[i], b=live[j];
        if(a.dragging||b.dragging) continue;
        if(!a.onGround||!b.onGround) continue;
        if(a.climb||b.climb) continue;   // 벽타는 중엔 밀리지 않는다(벽에 붙어 있어야 함)
        // 🧱 한쪽이 다른 쪽 위에 서 있으면(쌓인 상태) 밀어내지 않는다 — 밀면 탑이 바로 무너진다.
        if(Math.abs((a.y+a.hh) - b.y) < 6 || Math.abs((b.y+b.hh) - a.y) < 6) continue;
        // 가로로 겹치고 세로로도 비슷하면 충돌
        const ax=a.x, bx=b.x;
        const overlapX = (ax < bx + b.w*0.6) && (bx < ax + a.w*0.6);
        const overlapY = Math.abs((a.y+a.hh) - (b.y+b.hh)) < 20;
        if(overlapX && overlapY){
          // ★ 이미 겹쳐 있는 상태만 부드럽게 떼어놓는다(서로 반대쪽으로 아주 조금).
          //   방향 반전은 하지 않는다 — 예전엔 여기서 뒤집어서 빽빽할 때 제자리 반전이 반복됐다.
          //   진행 방향의 막힘은 tryMove(밀어내기)가 처리한다.
          const push = 0.4;
          if(ax < bx){ tryMove(a, -push); tryMove(b, push); }
          else       { tryMove(a,  push); tryMove(b, -push); }
        }
      }
    }

    rafId = live.length ? requestAnimationFrame(tick) : null;
  }

  /* ── 전부 제거 (마이홈 닫힘 등) ── */
  function clearAll(){
    live.forEach(inst=>{ try{ inst.el.remove(); }catch(_){} });
    live = [];
    _pending = 0;   // 🎫 아직 안 실린 예약도 같이 버린다 — 안 그러면 다음에 열 때 자리가 모자라다
    _epoch++;
    giftBox.leaveHome();   // 🎁 마이홈이 눈앞이 아니다 — 내 선물 목록이 빈다
    if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
    const layer = document.getElementById('mlLayer'); if(layer) layer.innerHTML='';
    hidden = false;   // 집을 옮기거나 닫으면 다시 보인다(«잠깐» 숨기기)
    syncHideBtn();
  }

  /* ── 마이홈이 부르는 셋(반환값) ──
     onOpen(ownerId, isVisiting): 마이홈 열릴 때 (내 집이면 ownerId=내ID, isVisiting=false)
     onClose(): 마이홈 닫힐 때 → 전부 제거
     applyVisit(isVisiting, ownerId): 방문 상태 전환 시 */
  let houseSeq = 0;      // 집을 열 때 · 옮길 때 · 닫을 때마다 오른다 — 늦게 온 앞 집의 답은 아무것도 띄우지 않는다

  /* 그 집 칸을 받고 폴더를 다시 판정한 뒤 선물을 띄운다. 답을 기다리는 사이 집을 옮겼거나 닫았으면(늦은 답) 아무것도 하지 않는다 */
  async function showHouse(ownerId, seq){
    const owner = ownerId||myId();
    if(!(await mallangStore.openView(owner, !visiting))) return;
    if(seq !== houseSeq) return;
    refreshFolder();                  // 칸을 받은 뒤 폴더 표시 여부 재판정 (방문 집 말랑이 유무 반영)
    await loadGifts(owner, seq);      // 🎁 선물받은 말랑이 소환 (내 집: 선물함이 목록을 정함 · 방문: 그 집에 나온 선물)
  }
  async function onOpen(ownerId, isVisiting){
    visiting = !!isVisiting;
    const seq = ++houseSeq;
    build();
    clearAll();                       // 이전 상태 초기화
    await showHouse(ownerId, seq);
  }
  function onClose(){ houseSeq++; clearAll(); mallangStore.closeView(); }   // 닫는 중에 온 칸 · 선물 답은 아무것도 띄우지 않는다
  async function applyVisit(isVisiting, ownerId){
    visiting = !!isVisiting;
    const seq = ++houseSeq;
    clearAll();                       // 집 바뀌면 내 말랑이 사라짐
    await showHouse(ownerId, seq);
  }
  /* 계정을 놓을 때 — 화면에 남은 말랑이 · 열린 창 · 배지를 걷는다(칸 · 선물함 값은 각자의 reset) */
  function reset(){
    houseSeq++;
    clearAll();
    mallangStore.closeView();
    const pop = document.getElementById('mlManage'); if(pop) pop.classList.remove('on');
    closeGiftPopup();
    const tab = document.querySelector('.mh-tab[data-tab="friend"]');
    const badge = tab && tab.querySelector('.ml-giftbadge'); if(badge) badge.remove();
  }

  /* ── 🎁 받은 선물 말랑이 띄우기 ──
     내 집: 어느 선물이 나와야 하는지는 선물함(gift-box onScreen)이 정한다 — 여기는 그 목록을 그리기만 하고 선물 id 를 들지 않는다(enterHome → 받기 성공 → emit → syncGifts).
     남의 집: 그 집에 나온 선물(GET /v1/gifts/{code})을 한 번 띄운다. 못 받으면 아무것도 띄우지 않는다(번호는 그쪽) */
  async function loadGifts(ownerId, seq){
    if(!ownerId) return;                // 내 코드가 없으면 선물을 안 읽는다
    if(visiting){
      const r = await giftBox.fetchVisible(ownerId, { notify: true });
      if(seq !== houseSeq || !r.ok) return;
      r.items.forEach(it=>{
        if(liveFull() || giftHere(it.id)) return;
        spawn(it.imageUrl, { giftId: it.id, isOwner: false, msg: it.message || '', url: it.imageUrl });
      });
      return;
    }
    await giftBox.enterHome();          // 받기가 성공하면 선물함이 emit → syncGifts 가 띄운다
  }
  /* 선물함이 바뀌었다(받기 · 신호 · 봤음 · ⭐ · 치움 …) — 배지 · 화면 */
  function onBoxChange(){
    syncBadge();
    syncGifts();
  }
  /* 이 선물이 화면에 있는가(그림을 받는 중인 것 포함) — 말랑이 한 칸이 선물 id 를 달고 있다 */
  function giftHere(id){
    const layer = document.getElementById('mlLayer'); if(!layer) return false;
    return Array.from(layer.children).some(c=>c.dataset && c.dataset.gid === id);
  }
  /* 화면을 선물함의 목록(onScreen)에 맞춘다 — 목록에 없는 내 선물 말랑이는 걷고, 빠진 것은 자리가 있는 만큼 띄운다. 자리가 없어 못 띄운 것은 «나와야 함» 으로 남아 다음에 다시 시도한다 */
  function syncGifts(){
    const layer = document.getElementById('mlLayer'); if(!layer) return;
    const want = giftBox.onScreen();
    const ids = new Set(want.map(x=>x.id));
    Array.from(layer.children).forEach(c=>{
      if(c.dataset && c.dataset.own === '1' && !ids.has(c.dataset.gid)){ try{ c.remove(); }catch(_){} }
    });
    const gone = live.filter(x=>x.el.parentElement !== layer);
    if(gone.length){
      live = live.filter(x=>x.el.parentElement === layer);
      if(!live.length && rafId){ cancelAnimationFrame(rafId); rafId=null; }
      syncHideBtn();
    }
    for(const it of want){
      if(liveFull()) break;
      if(giftHere(it.id)) continue;
      spawn(it.imageUrl, { giftId: it.id, isOwner: true, msg: it.message || '', url: it.imageUrl });
    }
  }

  // 친구 탭에 안 본 선물 개수 배지 — 값은 서버 unseenCount(받기 전 null 이면 그대로 둔다)
  function syncBadge(){
    const tab = document.querySelector('.mh-tab[data-tab="friend"]'); if(!tab) return;
    const unseen = giftBox.box().unseenCount;
    if(unseen === null) return;
    let badge = tab.querySelector('.ml-giftbadge');
    if(unseen>0){
      if(!badge){ badge = document.createElement('span'); badge.className='ml-giftbadge'; tab.appendChild(badge); injectBadgeStyle(); }
      badge.textContent = '🎁'+unseen;
    } else if(badge){ badge.remove(); }
  }
  function injectBadgeStyle(){
    if(document.getElementById('mlBadgeStyle')) return;
    const s=document.createElement('style'); s.id='mlBadgeStyle';
    s.textContent = `.mh-tab .ml-giftbadge{margin-left:5px;font-size:9px;background:#e0407a;color:#fff;
      padding:1px 5px;border-radius:8px;vertical-align:middle;font-weight:bold;}`;
    document.head.appendChild(s);
  }

  /* ── 🎁 선물 보내기 (친구 우클릭 → myhome-inbox.js 가 호출) ──
     한도(하루 보내기 · 받는 집 정원 · 메시지 길이)는 서버 값이다 — dailyMax · recipientCap 은 응답 숫자, 메시지 상한은 giftBox.MESSAGE_MAX.
     창 상태 pop = { to, name, sent:{count,dailyMax}|null, theirs:{visibleCount,recipientCap}|null, busy } — 창 안에서만 산다(열 때 받고 · 닫으면 버림). */
  let giftPop = null;
  const MSG_MAX = giftBox.MESSAGE_MAX;
  /* 열기 — 내 칸 · 오늘 보낸 수 · 상대 집 선물 수를 나란히 받는다(서로 다른 자원). 내 칸을 못 받으면 E-GIFT-07 · 창을 열지 않는다.
     남은 수 · 상대 수를 못 받으면 «확인하지 못했어요» 만 적고 막지 않는다(판정은 서버) */
  async function openGift(friendId, friendName){
    if(!hasLicense()){ toast('👑 말랑이 선물은 라이선스 보유자 전용이에요'); return; }
    const seq = houseSeq;
    const [ok, sent, theirs] = await Promise.all([
      mallangStore.pullMine({ site: 'sendOpen' }),
      giftBox.fetchSentToday(),
      giftBox.fetchVisible(friendId),
    ]);
    if(!ok || seq !== houseSeq) return;
    if(!mallangStore.mine().slots.length){ toast('먼저 내 말랑이를 등록하세요'); return; }   // 켜고 끔과 상관없이 등록된 것 전부 선물 가능
    buildGiftPopup(friendId, friendName, sent.ok ? { count: sent.count, dailyMax: sent.dailyMax } : null,
      theirs.ok ? { visibleCount: theirs.visibleCount, recipientCap: theirs.recipientCap } : null);
  }

  const giftFull = (p) => !!(p.theirs && p.theirs.visibleCount >= p.theirs.recipientCap);
  const giftRemain = (p) => (p.sent ? Math.max(0, p.sent.dailyMax - p.sent.count) : null);
  /* «지금 보낼 수 있나» 는 여기 하나 — 못 보내면 그 까닭 문구, 보낼 수 있으면 null. 격자 흐림 · 누름이 이것을 본다(안내 줄은 같은 giftFull · giftRemain 으로 문구만 따로 만든다) */
  function giftBlock(p){
    if(giftFull(p)) return '🎁 상대 마이홈이 가득 찼어요 ('+p.theirs.recipientCap+'마리)';
    if(giftRemain(p) === 0) return '오늘은 더 보낼 수 없어요 (하루 '+p.sent.dailyMax+'번)';
    return null;
  }
  /* 안내 줄 — 가득 참과 하루 한도를 다른 문구로 가른다(둘을 뭉치면 «오늘 다 썼나? 상대가 꽉 찼나?» 를 알 수 없다) */
  function giftNote(p){
    if(giftFull(p)){
      return '<div class="ml-note ml-full"><b>'+esc(p.name||'친구')+'</b> 님의 마이홈에 말랑이가 가득 찼어요 ('+esc(p.theirs.visibleCount)+'/'+esc(p.theirs.recipientCap)+')<br>몇 마리 치우면 다시 보낼 수 있어요.</div>';
    }
    const r = giftRemain(p);
    return '<div class="ml-note">보낼 말랑이를 고르세요. 오늘 남은 횟수: <b>'+(r === null ? '확인하지 못했어요' : esc(r)+'/'+esc(p.sent.dailyMax))+'</b></div>';
  }
  /* 칸 격자 — 내 칸 전부(꺼진 것 포함). 칸이 저장으로 바뀌면 다시 그린다. 보내는 중이면 격자 전체가 흐리다 */
  function renderGiftGrid(p){
    const grid = document.getElementById('mlGiftGrid'); if(!grid) return;
    grid.innerHTML = '';
    grid.classList.toggle('off', p.busy || giftBlock(p) !== null);   // 눌러도 안 되는 것이 눈에 보이게(누름도 같은 giftBlock 을 본다)
    mallangStore.mine().slots.forEach(item=>{
      const cell = document.createElement('div'); cell.className='ml-gcell';
      const gsrc = TwSafeHtml.safeUrl(item.imageUrl, 'image');
      if(gsrc){ const gim = TwImgRetry.retryOnError(document.createElement('img')); gim.src = gsrc; gim.alt = ''; cell.appendChild(gim); }
      cell.addEventListener('click', ()=>sendGift(p, item));
      grid.appendChild(cell);
    });
  }
  async function sendGift(p, item){
    if(giftPop !== p || p.busy) return;
    /* 흐리게 만든 것만으로는 부족하다 — 창을 열어둔 채 시간이 지나면 값이 낡는다. 보내기 직전에 한 번 더 본다(요청 없음) */
    const why = giftBlock(p);
    if(why){ toast(why); return; }
    p.busy = true; renderGiftGrid(p);
    const inp = document.getElementById('mlGiftMsg');
    const r = await giftBox.send(p.to, { mallang: item, message: inp ? inp.value : '' });
    if(giftPop !== p) return;   // 그사이 창을 닫았거나 계정을 놓았다 — 이 답은 화면에 쓰지 않는다
    p.busy = false;
    if(r.ok){ toast('🎁 '+(p.name||'친구')+'에게 말랑이를 보냈어요!'); closeGiftPopup(); return; }   // 토스트는 textContent — 씻으면 &lt; 가 글자로 보인다
    if(r.kind === 'guide' && r.message) toast(r.message);   // 서버 문구(숫자가 들어 있다) — 번호 없음
    if(r.kind === 'changed') mallangStore.pullMine();   // 누른 그림이 서버 칸에 없다(저장 전 새 칸 · 다른 기기에서 바꿈) — 칸을 다시 받으면 구독이 격자를 다시 그린다. 안내는 gift-box 가 E-GIFT-08 로 냈다
    renderGiftGrid(p);   // 격자를 다시 켠다
  }
  function closeGiftPopup(){
    giftPop = null;
    if(giftOff){ giftOff(); giftOff = null; }
    const pop = document.getElementById('mlGift'); if(pop) pop.remove();
  }
  let giftOff = null;   // 칸 저장이 끝나면 격자를 다시 그리는 구독 해제

  function buildGiftPopup(friendId, friendName, sent, theirs){
    const win = homeWin(); if(!win) return;
    closeGiftPopup();
    const p = giftPop = { to: friendId, name: friendName, sent, theirs, busy: false };
    const pop = document.createElement('div');
    pop.id = 'mlGift';
    pop.innerHTML =
      '<div class="ml-hd"><span>🎁 '+esc(friendName||'친구')+'에게 말랑이 선물</span><span class="x" id="mlGiftClose">×</span></div>'+
      '<div class="ml-bd">'+giftNote(p)+
      '<div id="mlGiftGrid"></div>'+
      '<div class="ml-msgrow"><label>함께 보낼 메시지 (선택)</label>'+
      '<input id="mlGiftMsg" type="text" maxlength="'+MSG_MAX+'" placeholder="비워두면 말풍선이 뜨지 않아요">'+
      '<div class="ml-msgcnt"><span id="mlGiftMsgCnt">0</span> / '+MSG_MAX+'</div></div>'+
      '</div>';
    win.appendChild(pop);
    pop.querySelector('#mlGiftClose').addEventListener('click', closeGiftPopup);
    const msgInp = pop.querySelector('#mlGiftMsg');
    const msgCnt = pop.querySelector('#mlGiftMsgCnt');
    if(msgInp) msgInp.addEventListener('input', ()=>{ if(msgCnt) msgCnt.textContent = String(msgInp.value.length); });
    renderGiftGrid(p);
    giftOff = mallangStore.onChange(()=>{ if(giftPop === p) renderGiftGrid(p); });   // 메시지 칸은 그대로 둔다
    injectGiftStyle();
  }

  function injectGiftStyle(){
    if(document.getElementById('mlGiftStyle')) return;
    const s=document.createElement('style'); s.id='mlGiftStyle';
    s.textContent = `
      #mlGift{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:145;width:280px;
        background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:3px 3px 0 rgba(0,0,0,.4);}
      #mlGift .ml-hd{background:linear-gradient(90deg,#00007a,#1084d0);color:#fff;font-weight:bold;font-size:11px;
        padding:3px 7px;display:flex;justify-content:space-between;align-items:center;}
      #mlGift .ml-hd .x{width:15px;height:13px;background:#c0c0c0;color:#000;border:1px solid;
        border-color:#fff #000 #000 #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;}
      #mlGift .ml-bd{padding:9px;}
      #mlGift .ml-note{font-size:10.5px;color:#333;margin-bottom:8px;line-height:1.5;}
      /* 🎁 가득 참 — 경고색 한 벌. 방명록 안내줄(#gbMsg)과 같은 톤을 쓴다 */
      #mlGift .ml-full{color:#7a2718;background:#fbe6de;border:1px solid;border-color:#808080 #fff #fff #808080;padding:5px 6px;}
      #mlGiftGrid.off{opacity:.45;pointer-events:none;filter:grayscale(1);}
      #mlGiftGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
      #mlGiftGrid .ml-gcell{aspect-ratio:1;background:#fff;border:1px solid;border-color:#808080 #fff #fff #808080;
        display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;}
      #mlGiftGrid .ml-gcell:hover{outline:2px solid #1084d0;}
      #mlGiftGrid .ml-gcell img{max-width:100%;max-height:100%;}
      #mlGift .ml-msgrow{margin-top:9px;}
      #mlGift .ml-msgrow label{display:block;font-size:10.5px;color:#333;margin-bottom:3px;}
      #mlGift .ml-msgrow input{width:100%;box-sizing:border-box;font-family:var(--tw-font-legacy);font-size:11px;padding:3px 4px;
        border:1px solid;border-color:#808080 #fff #fff #808080;background:#fff;}
      #mlGift .ml-msgcnt{font-size:9.5px;color:#666;text-align:right;margin-top:2px;}
    `;
    document.head.appendChild(s);
  }

  return {
    onOpen, onClose, applyVisit, reset,   // 🏠 마이홈 열기 · 닫기(myhome-ui) · 집 옮기기(myhome-visit) · 계정을 놓을 때
    openGift,                      // 🎁 보내기 창 — 친구 줄 우클릭(myhome-inbox)
  };
}

const api = { createMallang };
if(typeof window !== 'undefined') window.TwMallang = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
