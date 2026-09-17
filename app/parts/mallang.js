/* ═══════════════════════════════════════════════════════════════════════
   🧸 말랑이 (마이홈 시메지) — mallang.js
   · 마이홈 바탕화면 우측 하단 [말랑이] 폴더.
   · 우클릭 → 투명 PNG 등록(최대 4개, 가로 200px 리사이징, Firebase Storage).
   · 폴더 클릭 → 등록된 이미지 중 랜덤으로 말랑이 소환(최대 30마리 — MAX_LIVE).
   · 말랑이는 #myHomeWin 창 전체 위를 통통 튀며 돌아다님(탭 이동해도 유지).
   · 짧게 누르면 하트 뿅뿅 + 제거 / 끌면 드래그(놓으면 다시 돌아다님).
   · 전부 로컬 상태 — 내 화면에만 존재, 마이홈 닫으면 전부 사라짐.
   · 방문 모드: 다른 폴더(좀아칼/캐릭터세팅/인벤토리)는 잠기지만 말랑이 폴더는 열림.
     방문자는 그 집 주인이 등록한 이미지로 자기 화면에 소환(각자 로컬).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const MAX_IMGS = 4;        // 등록 가능한 이미지 수
  /* 동시에 떠다닐 수 있는 말랑이 수 (20 → 30).
     ★ 🎁 선물 상한(GIFT_SEND_CAP=30)과 **같은 수로 맞춘다.** 남의 집에 30마리까지 보낼 수 있는데
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
  function liveCount(){ return live.length + _pending; }
  function liveFull(){ return liveCount() >= MAX_LIVE; }
  const IMG_W = 80;          // 표시 가로폭(px), 세로는 정비율
  const SAVE_W = IMG_W * 2;  // 저장 해상도는 표시의 2배 — 고해상도 화면에서도 또렷하게 (표시 크기는 그대로 80px)
  const WALK = 0.5;          // 걷기 속도(px/frame)
  const GRAV = 0.6;          // 중력 가속도
  const REST_CHANCE = 0.004; // 매 프레임 쉬기 시작 확률
  const REST_MIN = 60, REST_MAX = 180;   // 쉬는 시간(프레임)

  let imgs = [];             // 등록된 이미지 [{url, on}]  (on=활성 여부)
  let live = [];             // 살아있는 말랑이 인스턴스
  let rafId = null;
  let built = false;
  let visiting = false;      // 남의 마이홈 관람 중인가

  function homeWin(){ return document.getElementById('myHomeWin'); }
  function roomBox(){ return document.getElementById('mhRoomPreview'); }   // 청록 바탕화면 박스
  function myId(){ try{ return (typeof getMyUserId==='function') ? getMyUserId() : null; }catch(_){ return null; } }
  function fbReady(){ return !!(window.firebaseAPI && firebaseAPI.getMallangImgs); }
  function hasLicense(){ try{ return (typeof window._premiumOn==='function') ? !!window._premiumOn() : false; }catch(_){ return false; } }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function lsKey(){ return 'tw.mallang.' + (myId()||'anon'); }
  function saveLocal(){ try{ localStorage.setItem(lsKey(), JSON.stringify(imgs)); }catch(_){} }
  /* 💾 로컬 먼저, 서버는 그 다음. **이 함수는 던지지 않는다.**
     [무엇이 문제였나] 예전 판은 `await firebaseAPI.saveMallangImgs(...)` 한 줄이었다. 위험이 둘이다.
       ① **결과를 버린다.** saveMallangImgs 는 실패해도 예외 대신 `{ok:false}` 를 돌려주므로
          (firebase-init 쪽에서 이미 try/catch 로 삼킨다) 서버에 안 올라가도 화면은 성공처럼
          그려졌다. 이 기기에서는 localStorage 로 멀쩡하고 **다른 기기에서만 옛 상태**가 남는다 —
          유저에게는 "말랑이를 지웠는데 회사 컴에서는 그대로"로 보이고, 원인을 짚을 단서가 없다.
       ② **던지면 화면이 안 따라온다.** 세 호출부가 전부 `await persist(); renderSlots();` 라
          여기서 예외가 나면 renderSlots 가 통째로 건너뛴다. imgs 는 이미 바뀐 뒤라
          "지웠는데 그대로 남아 있다 / 등록했는데 아무 반응이 없다"가 된다.
          지금 배관으로는 안 던지지만, 그건 **firebase-init 쪽 사정**이다. 그쪽이 바뀌면
          여기가 조용히 깨진다 — 두 파일에 걸친 약속에 기대지 않는다.
     ★ 로그인 전(uid 없음)은 실패가 아니다 — lsKey 가 'anon' 으로 로컬 저장을 하고 있고,
       그 상태로 `users/null/mallang` 에 쓰면 규칙상 통과해 **엉뚱한 노드에 쌓인다.** 여기서 막는다. */
  async function persist(){
    saveLocal();                       // 서버가 안 되어도 이 기기에서는 남는다 — 순서를 바꾸지 말 것
    if(!fbReady() || !firebaseAPI.saveMallangImgs) return { ok:false, reason:'offline' };
    const uid = myId();
    if(!uid) return { ok:false, reason:'no-uid' };
    try{
      const r = await firebaseAPI.saveMallangImgs(uid, imgs);
      return (r && r.ok) ? { ok:true } : { ok:false, reason:'server' };
    }catch(_){
      return { ok:false, reason:'server' };
    }
  }
  /* 🔔 "이 기기에만 저장됐다"를 알린다 — 조용히 넘어가면 유저는 다른 기기에서야 알게 된다.
     ★ no-uid 는 알리지 않는다. 로그인 전에는 로컬 저장이 정상 동작이고, 그때 토스트를 띄우면
       기능이 고장 난 것처럼 보인다.
     ★ 5초에 한 번만 — 슬롯을 연타하면 토스트가 쌓여 화면을 덮는다. */
  let _persistWarnAt = 0;
  function warnIfUnsaved(r){
    if(!r || r.ok || r.reason === 'no-uid') return;
    const now = Date.now();
    if(now - _persistWarnAt < 5000) return;
    _persistWarnAt = now;
    if(typeof toast==='function') toast('말랑이 변경을 이 기기에만 저장했어요 — 연결을 확인해 주세요');
  }

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
    injectStyle();
    built = true;
  }

  // 폴더 표시 여부 재판정 (내 집=라이선스 필요 / 방문=그 집에 말랑이 있으면)
  function refreshFolder(){
    const win = homeWin(); if(!win) return;
    const box = roomBox();
    let folder = document.getElementById('mlFolder');
    const wantFolder = visiting ? (imgs.length>0) : hasLicense();
    /* 🔬 진단 — **"말랑이 폴더가 안 보인다"를 한 줄로 가르기 위한 것.**
       [경위] 폴더가 안 뜨는 길이 넷인데(라이선스 없음 · 방문 중 이미지 0장 · 방 박스를 못 찾음 ·
         이 함수 자체가 안 불림) 화면에서는 전부 똑같이 "폴더가 없다"로만 보인다. 그래서 제보를 받고도
         마이홈 코드를 처음부터 다시 읽어야 했다. 이제 콘솔의 `[말랑이] 폴더` 줄이 첫 단서다.
       ★ 이 줄이 **아예 안 찍히면** 원인은 여기가 아니라 **부르는 쪽**이다 —
         app.js 의 마이홈 open() / _mhApplyVisitUI() 가 앞줄에서 죽은 것이다(그쪽 주석 참고).
       ⚠️ 동작은 바꾸지 않는다. 판정식은 위 한 줄 그대로다. */
    try{
      console.log('[말랑이] 폴더 ' + (wantFolder ? '표시' : '숨김')
        + ' — ' + (visiting ? '방문 중, 그 집 이미지 ' + imgs.length + '장' : '내 집, 라이선스 ' + (hasLicense() ? 'O' : 'X'))
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
    `;
    document.head.appendChild(s);
  }

  /* ── 폴더 이벤트: 좌클릭 소환, 우클릭 등록 팝업 ── */
  function bindFolder(folder, inp){
    folder.addEventListener('click', ()=>{ summonRandom(); });
    folder.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      if(visiting){ if(typeof toast==='function') toast('관람 중에는 이미지를 등록할 수 없어요'); return; }
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
    for(let i=0;i<MAX_IMGS;i++){
      const slot = document.createElement('div');
      slot.className = 'ml-slot';
      const item = imgs[i];
      if(item){
        if(!item.on) slot.classList.add('off');
        slot.innerHTML = '<img src="'+item.url+'" alt=""><button class="ml-del" data-i="'+i+'">×</button>';
        slot.querySelector('.ml-del').addEventListener('click', (e)=>{ e.stopPropagation(); removeImg(i, inp); });
        // 우클릭 = 활성/비활성 토글
        slot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); e.stopPropagation(); toggleImg(i, inp); });
      } else {
        slot.innerHTML = '<span class="ml-empty">+ 등록</span>';
        slot.addEventListener('click', ()=>{ pickImage(i, inp); });
      }
      wrap.appendChild(slot);
    }
  }

  async function toggleImg(i, inp){
    if(!imgs[i]) return;
    imgs[i].on = !imgs[i].on;
    const r = await persist();
    renderSlots(inp);        // ★ 저장 성공 여부와 무관하게 그린다 — imgs 는 이미 바뀌었다
    warnIfUnsaved(r);
  }

  // 이미지 처리 공통부 — 소스(File 또는 dataURL)를 리사이즈해 업로드하고 슬롯 갱신
  async function _registerImage(slotIdx, src, inp){
    if(typeof toast==='function') toast('말랑이 이미지 처리 중…');
    const dataUrl = await resizeToWidth(src, SAVE_W).catch(()=>null);
    if(!dataUrl){ if(typeof toast==='function') toast('이미지를 불러오지 못했어요'); return; }
    if(!fbReady() || !firebaseAPI.uploadMallangImage){ if(typeof toast==='function') toast('네트워크 연결이 필요해요'); return; }
    const r = await firebaseAPI.uploadMallangImage(myId(), slotIdx, dataUrl);
    if(r && r.ok){
      imgs.push({ url:r.url, on:true });
      const pr = await persist();
      renderSlots(inp);
      /* 사진 자체는 Storage 에 올라갔지만 목록이 서버에 안 실렸을 수 있다 — 그때 "등록됐어요"는
         거짓말이 된다(다른 기기에서는 안 보인다). 성공했을 때만 성공이라고 말한다. */
      if(pr && pr.ok){ if(typeof toast==='function') toast('말랑이가 등록됐어요!'); }
      else warnIfUnsaved(pr);
    } else if(typeof toast==='function') toast((r&&r.reason)||'등록에 실패했어요');
  }
  function pickImage(slotIdx, inp){
    // ★ Electron에선 <input type=file>.click()이 사용자 제스처 판정 때문에 무시되는 경우가 있음
    //   (디자인 스튜디오에서 이미 겪고 고친 것과 동일). main의 OS 파일 대화상자(companion.pickImage)를
    //   우선 사용하고, 그 경로가 없으면(브라우저 미리보기 등) 기존 input 방식으로 폴백.
    if(window.companion && companion.pickImage){
      try{ if(companion.dsHold) companion.dsHold(); }catch(_){}
      companion.pickImage().then(dataUrl=>{
        if(!dataUrl) return;   // 취소
        _registerImage(slotIdx, dataUrl, inp);
      }).catch(()=>{ if(typeof toast==='function') toast('이미지를 불러오지 못했어요'); });
      return;
    }
    if(!inp){ if(typeof toast==='function') toast('이미지를 불러올 수 없어요 — 앱을 재시작해 주세요'); return; }
    inp.onchange = async ()=>{
      const file = inp.files && inp.files[0]; inp.value=''; if(!file) return;
      _registerImage(slotIdx, file, inp);
    };
    inp.click();
  }

  async function removeImg(i, inp){
    imgs.splice(i,1);
    const r = await persist();
    renderSlots(inp);        // ★ 여기가 건너뛰면 "지웠는데 그대로 남아 있다"가 된다
    warnIfUnsaved(r);
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
    const active = imgs.filter(x=>x && x.on);
    if(!active.length){
      if(typeof toast==='function') toast(visiting ? '이 친구는 아직 말랑이를 등록하지 않았어요' : '먼저 우클릭으로 말랑이 이미지를 등록하세요');
      return;
    }
    if(liveFull()){
      if(typeof toast==='function') toast('말랑이가 너무 많아요! (최대 '+MAX_LIVE+')');
      return;
    }
    const pick = active[Math.floor(Math.random()*active.length)];
    spawn(pick.url);
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
    const _release = ()=>{ if(_slotDone) return; _slotDone = true; _pending = Math.max(0, _pending - 1); };
    im.onerror = ()=>{ _release(); try{ guy.remove(); }catch(_){} };
    im.onload = ()=>{
      _release();
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
        gift: gift || null,          // 선물이면 {giftId, isOwner, ownerId}
      };
      inst.y = Math.random()*rect.height*0.3;
      place(inst); setFacing(inst);
      bindGuy(inst);
      live.push(inst);
      if(!rafId) rafId = requestAnimationFrame(tick);
    };
    guy.appendChild(im);
    im.src = url;
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
    const n = 3 + Math.floor(Math.random()*3);
    const cx = inst.x + inst.w/2, cy = inst.y + inst.hh*0.3;
    for(let i=0;i<n;i++){
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
  // 우클릭 — 하트 뿜으며 사라짐 (선물이면 집주인만 서버에서 삭제, 방문자는 못 없앰)
  function heartsAndRemove(inst){
    spawnHearts(inst);
    if(inst.gift){
      if(!inst.gift.isOwner){ return; }   // 방문자는 선물 못 없앰 (하트만)
      // ★ 집주인 → 서버 기록은 남기고 '선물함으로 되돌리기'만 한다(치움 표시).
      //   예전엔 여기서 deleteMallangGift로 영구 삭제해서 다시 부를 방법이 없었다.
      //   선물함에서 클릭하면 _mallangRespawnGift로 다시 나온다.
      _hideGift(inst.gift.giftId);
      // ★ 서버에도 기록 — 로컬만이면 방문자 화면·다른 기기에서는 그대로 보인다.
      if(fbReady() && firebaseAPI.setMallangGiftHidden){
        firebaseAPI.setMallangGiftHidden(inst.gift.ownerId||myId(), inst.gift.giftId, true);
      }
      if(typeof toast==='function') toast('🎁 선물함으로 돌아갔어요 (선물함에서 다시 부를 수 있어요)');
    }
    try{ inst.el.remove(); }catch(_){}
    live = live.filter(x=>x!==inst);
    if(!live.length && rafId){ cancelAnimationFrame(rafId); rafId=null; }
  }

  /* ── 애니메이션 루프: 창 안에서 통통 튀기 ── */
  function tick(){
    const win = homeWin();
    if(!win){ rafId=null; return; }
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
            // 앞을 막은 말랑이는 밀고 간다 — 단 ★2마리 이상 줄지어 있으면 못 밀고 돌아선다(뭉침 방지).
            //   양쪽 다 붐비면 반전 반복(제자리 지터) 대신 잠깐 쉰다.
            const _dir = inst.vx > 0 ? 1 : -1;
            if(chainAhead(inst, _dir) >= 2){
              if(chainAhead(inst, -_dir) >= 2){
                inst.rest = REST_MIN + Math.floor(Math.random()*(REST_MAX-REST_MIN));
              } else {
                inst.vx = -inst.vx; setFacing(inst);
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
                inst.vx = -inst.vx;
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
    if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
    const layer = document.getElementById('mlLayer'); if(layer) layer.innerHTML='';
  }

  /* ── 이미지 목록 로드 (내 것 또는 방문 대상) ── */
  async function loadImgsFor(userId){
    imgs = [];
    let raw = [];
    if(fbReady()) raw = await firebaseAPI.getMallangImgs(userId).catch(()=>[]) || [];
    // 서버가 비었고 '내 것'을 보는 중이면 로컬 백업에서 복원 (규칙 미반영 등 대비)
    if((!raw || !raw.length) && userId===myId()){
      try{ const ls=JSON.parse(localStorage.getItem(lsKey())||'null'); if(Array.isArray(ls)) raw=ls; }catch(_){}
    }
    imgs = (raw||[]).map(x => (typeof x==='string') ? { url:x, on:true } : { url:x.url, on:(x.on!==false) }).filter(x=>x && x.url);
  }

  /* ── 외부 훅 (app.js 마이홈 로직이 호출) ──
     window._mallangOnOpen(ownerId, isVisiting): 마이홈 열릴 때 (내 집이면 ownerId=내ID, isVisiting=false)
     window._mallangOnClose(): 마이홈 닫힐 때 → 전부 제거
     window._mallangApplyVisit(isVisiting, ownerId): 방문 상태 전환 시 */
  window._mallangOnOpen = async function(ownerId, isVisiting){
    visiting = !!isVisiting;
    build();
    clearAll();                       // 이전 상태 초기화
    await loadImgsFor(ownerId||myId());
    refreshFolder();                  // 이미지 로드 후 폴더 표시 여부 재판정 (방문 집 말랑이 유무 반영)
    await loadGifts(ownerId||myId());  // 🎁 선물받은 말랑이 소환 (내 집·방문 모두)
  };
  window._mallangOnClose = function(){ clearAll(); };
  window._mallangApplyVisit = async function(isVisiting, ownerId){
    visiting = !!isVisiting;
    clearAll();                       // 집 바뀌면 내 말랑이 사라짐
    await loadImgsFor(ownerId||myId());
    refreshFolder();                  // 방문/복귀에 맞춰 폴더 재판정
    await loadGifts(ownerId||myId());
  };

  /* ── 🎁 선물 "치움" 상태 (로컬) ──────────────────────────────────────────
     우클릭은 이제 '삭제'가 아니라 '선물함으로 되돌리기'다. 서버 기록(mallangGifts)은 그대로 두고,
     화면에 안 띄울 giftId만 로컬에 기억한다. 선물함에서 클릭하면 이 목록에서 빼고 다시 소환.
     ★ 로컬 저장이라 DB 규칙을 건드리지 않는다(비용·호환 위험 없음). 기기마다 따로 관리됨. */
  const GIFT_HIDE_KEY = 'tw.mallangGiftHidden';
  const GIFT_MAX = 30;   // ★ 선물함 보관 개수. 넘치면 가장 오래된 것부터 서버에서 삭제.
  function _hiddenSet(){
    try{ const a = JSON.parse(localStorage.getItem(GIFT_HIDE_KEY) || '[]');
         return new Set(Array.isArray(a) ? a : []); }catch(_){ return new Set(); }
  }
  function _saveHidden(set){
    try{ localStorage.setItem(GIFT_HIDE_KEY, JSON.stringify([...set])); }catch(_){}
  }
  function _hideGift(giftId){ const h=_hiddenSet(); h.add(giftId); _saveHidden(h); }
  window._mallangIsGiftHidden = function(giftId){ return _hiddenSet().has(giftId); };
  /* 선물함에서 클릭 → 다시 마이홈에 소환 (app.js가 호출) */
  window._mallangRespawnGift = function(giftId, imgUrl, msg){
    try{
      const h=_hiddenSet(); h.delete(giftId); _saveHidden(h);
      if(fbReady() && firebaseAPI.setMallangGiftHidden) firebaseAPI.setMallangGiftHidden(myId(), giftId, false);
      if(live.some(x=>x.gift && x.gift.giftId===giftId)) return 'already';   // 이미 나와 있음
      if(liveFull()) return 'full';
      spawnGift(imgUrl, giftId, true, myId(), msg||'');
      return 'ok';
    }catch(_){ return 'error'; }
  };

  /* ── 🎁 받은 선물 말랑이 로드/소환 ── */
  async function loadGifts(ownerId){
    if(!fbReady() || !firebaseAPI.getMallangGifts) return;
    const gifts = await firebaseAPI.getMallangGifts(ownerId).catch(()=>({})) || {};
    const isOwner = (ownerId===myId());
    let ids = Object.keys(gifts);
    // ★ 보관 한도 — 내 집일 때만, 오래된 것부터 서버에서 정리(최신 GIFT_MAX개 유지)
    if(isOwner && ids.length > GIFT_MAX && firebaseAPI.deleteMallangGift){
      const byOld = ids.slice().sort((a,b)=>(gifts[a].ts||0)-(gifts[b].ts||0));
      const drop = byOld.slice(0, ids.length - GIFT_MAX);
      drop.forEach(id=>{ try{ firebaseAPI.deleteMallangGift(ownerId, id); }catch(_){} delete gifts[id]; });
      ids = Object.keys(gifts);
    }
    // ★ 치워둔 선물은 화면에 안 띄움(선물함에는 그대로 남아 있음). 내 집일 때만 적용 —
    //   방문자 화면은 집주인이 치운 것과 무관하게 서버 기준으로 보여준다.
    // ★ 서버 hidden(집주인이 치운 표시)은 방문자에게도 적용된다. 로컬 목록은 내 집일 때만 추가로 반영.
    const hidden = isOwner ? _hiddenSet() : new Set();
    ids.forEach(giftId=>{
      const g = gifts[giftId]; if(!g || !g.imgUrl) return;
      if(g.hidden) return;
      if(hidden.has(giftId)) return;
      spawnGift(g.imgUrl, giftId, isOwner, ownerId, g.msg||'');
    });
    // 서버에 없어진 id가 숨김 목록에 남아 쌓이지 않게 정리
    if(isOwner && hidden.size){
      let changed=false;
      hidden.forEach(id=>{ if(!gifts[id]){ hidden.delete(id); changed=true; } });
      if(changed) _saveHidden(hidden);
    }
    if(isOwner) updateGiftBadge(gifts);   // 내 집이면 알림 뱃지 갱신
  }

  // 친구 탭에 안 본 선물 개수 뱃지 표시
  async function updateGiftBadge(gifts){
    const tab = document.querySelector('.mh-tab[data-tab="friend"]'); if(!tab) return;
    let seen = 0;
    if(fbReady() && firebaseAPI.getMallangGiftSeen) seen = await firebaseAPI.getMallangGiftSeen(myId()).catch(()=>0);
    // seen 시각 이후에 온 선물 수
    const list = gifts || (fbReady() ? await firebaseAPI.getMallangGifts(myId()).catch(()=>({})) : {});
    let n = 0, latest = 0;
    Object.keys(list).forEach(k=>{ const t=list[k].ts||0; if(t>seen) n++; if(t>latest) latest=t; });
    let badge = tab.querySelector('.ml-giftbadge');
    if(n>0){
      if(!badge){ badge = document.createElement('span'); badge.className='ml-giftbadge'; tab.appendChild(badge); injectBadgeStyle(); }
      badge.textContent = '🎁'+n;
      tab._mlLatest = latest;
    } else if(badge){ badge.remove(); }
  }
  function injectBadgeStyle(){
    if(document.getElementById('mlBadgeStyle')) return;
    const s=document.createElement('style'); s.id='mlBadgeStyle';
    s.textContent = `.mh-tab .ml-giftbadge{margin-left:5px;font-size:9px;background:#e0407a;color:#fff;
      padding:1px 5px;border-radius:8px;vertical-align:middle;font-weight:bold;}`;
    document.head.appendChild(s);
  }
  // 친구 탭 열면 "봤음" 처리 (뱃지 제거) — app.js가 호출
  window._mallangSeenGifts = async function(){
    const tab = document.querySelector('.mh-tab[data-tab="friend"]');
    const badge = tab && tab.querySelector('.ml-giftbadge');
    if(fbReady() && firebaseAPI.setMallangGiftSeen) await firebaseAPI.setMallangGiftSeen(myId(), (tab&&tab._mlLatest)||Date.now());
    if(badge) badge.remove();
  };

  // 선물 말랑이 소환
  function spawnGift(url, giftId, isOwner, ownerId, msg){
    if(liveFull()) return;
    spawn(url, { giftId, isOwner, ownerId, msg: msg||'' });
  }

  /* ── 🎁 선물 보내기 (친구 우클릭 → app.js가 호출) ── */
  const DAILY_LIMIT = 10;   // 하루 발송 한도 (5 → 10)
  const MSG_MAX = 50;   // 선물에 함께 보내는 메시지 최대 길이
  /* 🎁 받는 사람 마이홈이 꽉 찼는가 — **치우지 않은 선물** 이 이 수 이상이면 못 보낸다.
     [세는 기준] `mallangGifts/{id}.hidden` 이 아닌 것. 집주인이 우클릭으로 치우면 서버에 그 표시가
       남으므로(heartsAndRemove 참고) 보내는 쪽에서도 같은 값을 읽을 수 있다 — `users/$userId` 는
       공개 읽기라 규칙을 손댈 필요가 없다.
     ⚠️ 이 수(30)는 보관 한도 GIFT_MAX 와 같지만 **다른 뜻**이다. GIFT_MAX 는 '선물함에 몇 개까지
       쌓아 두는가'이고, 이쪽은 '남의 집에 몇 마리까지 내보낼 수 있는가'다. 한쪽을 고칠 때
       다른 쪽이 따라가야 하는 관계가 아니므로 상수를 따로 둔다.
     ★ 화면 동시 상한 MAX_LIVE 도 **같은 30** 이다. 둘을 다른 수로 두면 "30마리라는데 화면엔
       그만큼 없다"가 되므로, 한쪽을 고치면 다른 쪽도 같이 본다. */
  const GIFT_SEND_CAP = 30;
  function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  /* 상대의 '나와 있는' 선물 수. 못 읽으면 -1 — **막지 않는다.**
     조회 실패로 선물을 못 보내게 하면, 네트워크가 잠깐 흔들린 사람에게는 기능이 고장난 것으로 보인다
     (방 버전 게이트의 '조회 실패는 통과'와 같은 판단이다). */
  async function visibleGiftCount(uid){
    if(!fbReady() || !firebaseAPI.getMallangGifts) return -1;
    const gifts = await firebaseAPI.getMallangGifts(uid).catch(()=>null);
    if(!gifts) return -1;
    return Object.keys(gifts).filter(k => gifts[k] && !gifts[k].hidden).length;
  }

  window._mallangOpenGift = async function(friendId, friendName){
    if(!hasLicense()){ if(typeof toast==='function') toast('👑 말랑이 선물은 라이선스 보유자 전용이에요'); return; }
    if(!fbReady()){ if(typeof toast==='function') toast('네트워크 연결이 필요해요'); return; }
    // 내 말랑이 이미지 로드 (활성/비활성 무관하게 등록된 것 전부 선물 가능)
    let mine = [];
    const raw = await firebaseAPI.getMallangImgs(myId()).catch(()=>[]) || [];
    if(!raw.length){ try{ const ls=JSON.parse(localStorage.getItem(lsKey())||'null'); if(Array.isArray(ls)) mine=ls; }catch(_){} }
    else mine = raw;
    mine = mine.map(x=> (typeof x==='string')?{url:x}:{url:x.url}).filter(x=>x&&x.url);
    if(!mine.length){ if(typeof toast==='function') toast('먼저 내 말랑이를 등록하세요'); return; }
    /* 하루 발송 횟수 + 상대 마이홈이 꽉 찼는지 — **둘을 나란히 부른다.**
       순서대로 기다리면 창이 뜨는 데 왕복이 두 번 걸린다. 서로 무관한 조회다. */
    const [cnt, theirs] = await Promise.all([
      firebaseAPI.getMallangGiftCount(myId(), todayStr()).catch(()=>0),
      visibleGiftCount(friendId),
    ]);
    buildGiftPopup(friendId, friendName, mine, cnt, theirs);
  };

  function buildGiftPopup(friendId, friendName, mine, sentToday, theirVisible){
    const win = homeWin(); if(!win) return;
    let pop = document.getElementById('mlGift');
    if(pop) pop.remove();
    pop = document.createElement('div');
    pop.id = 'mlGift';
    const remain = Math.max(0, DAILY_LIMIT - sentToday);
    /* 🎁 상대 집이 꽉 찼으면 **고르기 전에** 막는다(요청).
       ★ 안내를 하루 한도와 갈라 쓴다 — 둘을 같은 문구로 뭉치면 "오늘 다 썼나? 상대가 꽉 찼나?"를
         유저가 구분할 수 없다. 조회 실패(-1)는 막지 않는다. */
    const full = (theirVisible >= 0 && theirVisible >= GIFT_SEND_CAP);
    const note = full
      ? '<div class="ml-note ml-full"><b>'+esc(friendName||'친구')+'</b> 님의 마이홈에 말랑이가 가득 찼어요 ('+theirVisible+'/'+GIFT_SEND_CAP+')<br>몇 마리 치우면 다시 보낼 수 있어요.</div>'
      : '<div class="ml-note">보낼 말랑이를 고르세요. 오늘 남은 횟수: <b>'+remain+'/'+DAILY_LIMIT+'</b></div>';
    pop.innerHTML =
      '<div class="ml-hd"><span>🎁 '+esc(friendName||'친구')+'에게 말랑이 선물</span><span class="x" id="mlGiftClose">×</span></div>'+
      '<div class="ml-bd">'+note+
      '<div id="mlGiftGrid"></div>'+
      '<div class="ml-msgrow"><label>함께 보낼 메시지 (선택)</label>'+
      '<input id="mlGiftMsg" type="text" maxlength="'+MSG_MAX+'" placeholder="비워두면 말풍선이 뜨지 않아요">'+
      '<div class="ml-msgcnt"><span id="mlGiftMsgCnt">0</span> / '+MSG_MAX+'</div></div>'+
      '</div>';
    win.appendChild(pop);
    pop.querySelector('#mlGiftClose').addEventListener('click', ()=>pop.remove());
    const msgInp = pop.querySelector('#mlGiftMsg');
    const msgCnt = pop.querySelector('#mlGiftMsgCnt');
    if(msgInp) msgInp.addEventListener('input', ()=>{ if(msgCnt) msgCnt.textContent = String(msgInp.value.length); });
    const grid = pop.querySelector('#mlGiftGrid');
    if(full) grid.classList.add('off');   // 눌러도 안 되는 것이 눈에 보이게 (핸들러도 아래에서 한 번 더 막는다)
    mine.forEach(item=>{
      const cell = document.createElement('div'); cell.className='ml-gcell';
      cell.innerHTML = '<img src="'+item.url+'" alt="">';
      cell.addEventListener('click', async ()=>{
        /* ⚠️ 흐리게 만든 것만으로는 부족하다 — 창을 열어둔 채 시간이 지나면 값이 낡는다.
           보내기 직전에 한 번 더 본다(로컬 판정이라 왕복은 없다). */
        if(full){ if(typeof toast==='function') toast('🎁 상대 마이홈이 가득 찼어요 ('+GIFT_SEND_CAP+'마리)'); return; }
        if(remain<=0){ if(typeof toast==='function') toast('오늘은 더 보낼 수 없어요 (하루 '+DAILY_LIMIT+'번)'); return; }
        cell.style.pointerEvents='none'; cell.style.opacity='.5';
        const myName = (typeof getDisplayName==='function') ? getDisplayName() : '친구';
        const msg = msgInp ? msgInp.value.trim().slice(0, MSG_MAX) : '';
        const r = await firebaseAPI.sendMallangGift(myId(), myName, friendId, item.url, todayStr(), msg);
        if(r&&r.ok){ if(typeof toast==='function') toast('🎁 '+esc(friendName||'친구')+'에게 말랑이를 보냈어요!'); pop.remove(); }
        else { cell.style.pointerEvents=''; cell.style.opacity=''; if(typeof toast==='function') toast((r&&r.reason)||'전송 실패'); }
      });
      grid.appendChild(cell);
    });
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
      #mlGift .ml-msgrow input{width:100%;box-sizing:border-box;font-family:Tahoma,"Malgun Gothic",sans-serif;font-size:11px;padding:3px 4px;
        border:1px solid;border-color:#808080 #fff #fff #808080;background:#fff;}
      #mlGift .ml-msgcnt{font-size:9.5px;color:#666;text-align:right;margin-top:2px;}
    `;
    document.head.appendChild(s);
  }

})();
