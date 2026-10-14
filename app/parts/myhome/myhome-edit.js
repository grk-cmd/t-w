/* myhome-edit.js — 🏠 마이홈 페이지 편집 묶음(자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 스티커 끌기 ·
   닉네임 · 게시글 제목 · 🎵 BGM · 바깥 배경 · 테마) · 👑 디자인 스튜디오 · 디자인 프리셋
   app.js 의 마이홈 페이지 편집 묶음(bindMyHomePage — 즉시 실행 함수 하나)을 그대로 옮긴 모듈이다(앱 FSD 7-2 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   디자인 스튜디오 · 프리셋은 따로 떼지 않았다 — [✎ 마이홈 수정] 버튼(묶음 앞쪽)이 _mhOpenDesignStudio 를,
   스튜디오가 commitMyHomePage · _mhOpenColorPopup(묶음 앞쪽)을 이름으로 부르는 한 몸이라, 나누면 글자 그대로가 깨진다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 app.js 의 이름을 읽고 쓰는 방법뿐이다.
       · _myHomeData → _myHomeData() · _mhViewingUserId → _mhViewingUserId() · _myHomeLoaded → _myHomeLoaded() ·
         _myHomeUid → _myHomeUid() · isPremium → isPremium() · isAdmin → isAdmin()
         app.js 가 다시 대입하는 let 이라(불러오기 · 친구 홈 관람 · 계정 · 라이선스 · 관리자 판정) 값이 아니라 읽는 함수로 받는다.
       · _myHomeLoaded = false → _setMyHomeLoaded(false) · _mhStickerDragDist = x → _setMhStickerDragDist(x)(읽기는 _mhStickerDragDist())
         두 let 은 app.js 의 마이홈 불러오기 · renderMyHomeStickers(드래그 직후 링크 안 엶)가 같이 쓰므로 app.js 에 두고 쓰는 함수로 받는다.
       · USER_NAME_MAX → USER_NAME_MAX() — app.js 에서 이 묶음보다 한참 뒤에 선언되는 const 라 만들 때 값으로 넘기면 TDZ 다.
       · renderMyHomeStickers 를 감싸 다시 대입하던 두 줄 — 옛 함수는 _getRenderMyHomeStickers() 로 받고, 감싼 함수는
         _setRenderMyHomeStickers(…) 로 app.js 의 이름에 다시 넣는다(삭제 버튼에 자동 저장을 한 번 더 붙이는 것 그대로).
         ⚠️ 옛 함수를 화살표(renderMyHomeStickers)로 잡으면 감싼 함수가 자기를 부르는 무한 재귀가 된다.
   ★ 이 묶음이 window 에 거는 이름은 예전 그대로 window 에 건다 — commitMyHomePage · _mhOpenColorPopup · _mhBeginNameEdit ·
     _mhCancelNameEdit · _mhBgmRefresh · _mhBgmPlaying · _mhBgmSetPlaying · _bgmDestroy · _mhApplyBg · _mhApplyTheme · _mhDsClose.
     app.js(마이홈 열기 · 닫기 · 관람 · 마이홈 바탕화면) · myhome-sticker.js · purikura-ui.js 가 그 이름으로 부른다.
   ★ createMyHomeEdit 는 app.js 의 원래 자리(🔗 마이홈 본문 링크 뒤 · 📖 방명록 연결 앞)에서 부른다. 만들 때 바로 도는 것
     (버튼 · 입력칸 연결 · window 고리 · companion.onBgmClosed · onBgmMode 구독)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · window · companion · firebaseAPI · localStorage 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeEdit — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-myhome-edit.js — 만들 때 배선 · 자동저장(관람 · 계정 바뀜 · 불러오기 전) · 글 서식 · 닉네임 · 게시글 제목 ·
         BGM · 배경 · 테마 · 디자인 스튜디오 · 프리셋 · 스티커 끌기 · renderMyHomeStickers 감싸기 · app.js 배선 · html 순서. */
(function(){

function createMyHomeEdit(deps){
const toast = deps.toast;
const asyncPrompt = deps.asyncPrompt;                    // ✏️ 인앱 프롬프트(글 서식 링크 · 이미지 · 스티커 링크 · BGM)
const renderMyHomePage = deps.renderMyHomePage;          // 🏠 마이홈 페이지 다시 그리기(프로필 사진 바꾼 뒤) — app.js
const renderMyHomeStickers = deps.renderMyHomeStickers;  // 🎨 스티커 다시 그리기 — app.js(아래에서 감싸 다시 대입한다 — 부를 때 찾는다)
const _getRenderMyHomeStickers = deps.getRenderMyHomeStickers;   // 감싸기 전 함수(값)
const _setRenderMyHomeStickers = deps.setRenderMyHomeStickers;   // 감싼 함수를 app.js 의 이름에 다시 넣는다
const _mhSaveRT = deps.mhSaveRT;                         // 📝 리치 텍스트 저장 · 글자 수 — app.js(마이홈 페이지 그리기)
const _mhUpdateRTCount = deps.mhUpdateRTCount;
const _mhClampStickerPos = deps.mhClampStickerPos;       // 📐 스티커를 창 안으로 — app.js
const _mhViewingDisplayName = deps.mhViewingDisplayName; // 👀 관람 중인 친구 이름 · 관람 화면 잠금 — app.js
const _mhApplyVisitUI = deps.mhApplyVisitUI;
const _ytVideoId = deps.ytVideoId;                       // 🎵 유튜브 주소 → 영상 id(플레이리스트와 한 벌) — app.js
const applyThemeToChildDoc = deps.applyThemeToChildDoc;  // 🎨 자식 창에 테마 토큰 — app.js
const commitUserName = deps.commitUserName;              // 🏷️ 닉네임 저장 · 읽기 — app.js
const getDisplayName = deps.getDisplayName;
const getUserName = deps.getUserName;
const getMyUserId = deps.getMyUserId;
const _myHomeData = deps.myHomeData;                     // 🏠 마이홈 데이터 — app.js 의 let(불러올 때 · 관람할 때 다시 대입된다)
const _mhViewingUserId = deps.mhViewingUserId;           // 👀 친구 홈 관람 중이면 그 사람 uid — app.js 의 let
const _myHomeLoaded = deps.myHomeLoaded;                 // 🛑 서버에서 내 마이홈을 불러왔는가 — app.js 의 let
const _setMyHomeLoaded = deps.setMyHomeLoaded;
const _myHomeUid = deps.myHomeUid;                       // 🪪 불러온 계정 — app.js 의 let
const _mhStickerDragDist = deps.mhStickerDragDist;       // 드래그 이동거리 — app.js 의 let(renderMyHomeStickers 가 읽는다)
const _setMhStickerDragDist = deps.setMhStickerDragDist;
const isPremium = deps.isPremium;                        // 👑 라이선스 · 관리자 — app.js 의 let(로그인 뒤 정해진다)
const isAdmin = deps.isAdmin;
const USER_NAME_MAX = deps.userNameMax;                  // 닉네임 길이 상한 — app.js 의 const(이 묶음보다 뒤에 선언돼 읽는 함수로)
const myHomeSticker = deps.myHomeSticker;                // 🎨 스티커 관리 창(myhome-sticker.js) — 앞에서 만든 값
const STICKER_MAX = deps.stickerMax;
const STICKER_IMG_MAX_W = deps.stickerImgMaxW;
const DS_IMG_MAX_BG_W = deps.dsImgMaxBgW;                // 👑 디자인 스튜디오 그림 축소 기준 — app.js 의 const
const DS_IMG_MAX_BG_H = deps.dsImgMaxBgH;
const DS_IMG_MAX_PANEL = deps.dsImgMaxPanel;
const DS_IMG_QUALITY = deps.dsImgQuality;

  // ★ 저장 버튼 없이 자동저장 — 아래 여러 지점(사진 변경/스티커 추가삭제이동/텍스트칸에서 포커스 벗어남)에서
  //   이 함수를 호출해서 그 즉시 Firebase에 반영함.
  async function commitMyHomePage(silent){
    // ★ 마이홈2-B: 친구 마이홈 관람 중일 때 저장하면 상대 데이터가 내 홈에 덮어씌워지므로 절대 저장 안 함.
    if(_mhViewingUserId()) return;
    // 🛑 서버에서 내 마이홈을 "성공적으로 로드한 적 없는" 세션에서는 절대 저장하지 않음.
    //   예전엔 로드 실패 → 기본값 렌더 → 창 닫을 때 자동 저장이 그 기본값을 서버에 덮어써서
    //   꾸민 데이터가 통째로 초기화되는 사고가 있었음. 로드 성공(_myHomeLoaded)이 저장의 전제조건.
    /* 🪪 불러온 계정과 지금 계정이 다르면 저장하지 않는다 — 옛 계정 데이터로 새 계정 마이홈을 덮는 길(제보 #2).
       불러온 상태도 같이 무효로 돌려, 다음에 열 때 지금 계정 것을 새로 받게 한다. */
    if(_myHomeLoaded() && _myHomeUid() !== getMyUserId()){
      _setMyHomeLoaded(false);
      console.warn('[마이홈] 계정이 바뀌었다(' + _myHomeUid() + ' → ' + getMyUserId() + ') — 데이터 보호를 위해 저장을 건너뜀');
      if(!silent) toast('계정이 바뀌어서 저장하지 않았어요 — 앱을 다시 시작해 주세요');
      return;
    }
    if(!_myHomeLoaded()){
      if(!silent) toast('마이홈 정보를 아직 불러오지 못했어요 — 창을 닫았다 다시 열어주세요');
      console.warn('[마이홈] 로드 미완료 상태 — 데이터 보호를 위해 저장을 건너뜀');
      return;
    }
    const bioBox=document.getElementById('mhBioBox'), postBox=document.getElementById('mhPostBox');
    if(bioBox) _myHomeData().bio = _mhSaveRT(bioBox, 120);
    if(postBox) _myHomeData().post = _mhSaveRT(postBox, 1000);
    if(!window.firebaseAPI || !firebaseAPI.saveMyHome){ if(!silent) toast('아직 준비 중이에요'); return; }
    /* ⚠️ 예전엔 실패를 통째로 잡아 "용량이 너무 크면 사진을 다시 등록해보세요" 한 마디만 띄웠다.
       실제 거부 사유는 넷인데(로그인 불일치 · 소개글 · 게시글 · 프로필 사진) 문구가 늘 사진을 가리켜서,
       제보자는 멀쩡한 스티커를 지우며 같은 실패를 반복했다. 이제 saveMyHome 이 이유를 돌려준다. */
    try{
      const r = await firebaseAPI.saveMyHome(getMyUserId(), _myHomeData());
      if(r && r.ok === false){ toast(r.reason || '저장에 실패했어요'); return; }
      if(r && r.warn){ toast(r.warn); return; }   // 저장은 됐다 — 조용히 넘기면 원인이 계속 숨는다
      if(!silent) toast('마이홈을 저장했어요');
    }
    catch(e){
      console.warn('[마이홈] 저장 실패', e);
      toast('저장에 실패했어요 — 잠시 뒤 다시 시도해 주세요');
    }
  }
  window.commitMyHomePage = commitMyHomePage;   // 탭 전환/창 닫힘 등 다른 곳에서도 재사용
  // 프로필 사진 — 클릭하면 파일 선택, 선택하면 정사각형으로 크롭+축소해서 용량을 줄인 뒤 base64로 저장
  const avatarBig=document.getElementById('mhAvatarBig');
  const avatarInput=document.getElementById('mhAvatarInput');
  if(avatarBig && avatarInput){
    avatarBig.addEventListener('click', ()=>avatarInput.click());
    avatarInput.addEventListener('change', ()=>{
      const file=avatarInput.files[0]; if(!file) return;
      const img=new Image();
      const reader=new FileReader();
      reader.onload=e=>{ img.onload=()=>{
        const SZ=200;   // 200x200으로 축소해서 Realtime Database 용량 부담을 줄임
        const c=document.createElement('canvas'); c.width=SZ; c.height=SZ;
        const ctx=c.getContext('2d');
        const side=Math.min(img.width,img.height);
        ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0,0, SZ,SZ);
        /* 🖼️ 투명 배경(PNG) 지원 — 예전엔 무조건 JPEG 로 떠서 알파가 검게 메워졌다.
           · 알파가 없는 그림(대부분의 사진)은 그대로 JPEG — PNG 로 뜨면 몇 배 커지기만 한다.
           · 알파가 있으면 PNG. 캔버스는 처음부터 투명이라 drawImage 만으로 알파가 보존된다.
           ⚠️ DB 규칙에 users/{uid}/home 의 avatar 길이 상한 200,000자가 있다
              (firebase-database-rules.json). 200×200 PNG 는 색이 복잡하면 그 선을 넘을 수 있고,
              넘으면 저장이 **조용히 거부**된다(쓰기는 실패했는데 화면엔 새 사진이 떠 있다).
              그래서 길이를 재보고 넘치면 JPEG 로 떨어뜨리고, 투명이 사라진다는 것을 알린다. */
        const AVATAR_MAX_CHARS = 200000;
        let hasAlpha = false;
        try{
          const px = ctx.getImageData(0,0,SZ,SZ).data;
          for(let i=3;i<px.length;i+=4){ if(px[i] < 250){ hasAlpha = true; break; } }
        }catch(_){ /* 판정 실패(보안 오류 등)는 알파 없음으로 취급 — 예전 동작 그대로 */ }
        let out = hasAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82);
        if(out.length > AVATAR_MAX_CHARS){
          out = c.toDataURL('image/jpeg', 0.82);
          if(hasAlpha && typeof toast==='function') toast('사진이 너무 커서 투명 배경은 유지하지 못했어요');
        }
        _myHomeData().avatar = out;
        renderMyHomePage();
        commitMyHomePage(true);
      }; img.src=e.target.result; };
      reader.readAsDataURL(file);
    });
  }
  // 소개글/게시글 — 포커스를 벗어나면(다른 곳 클릭) 자동 저장
  const bioBox=document.getElementById('mhBioBox'), postBox=document.getElementById('mhPostBox');
  if(bioBox){
    bioBox.addEventListener('blur', ()=>commitMyHomePage(true));
    bioBox.addEventListener('input', ()=>_mhUpdateRTCount('mhBioBox'));
  }
  if(postBox){
    postBox.addEventListener('blur', ()=>commitMyHomePage(true));
    postBox.addEventListener('input', ()=>_mhUpdateRTCount('mhPostBox'));
  }
  // 마이홈 4: 리치 텍스트 툴바 바인딩 — bio·post 공통. document.execCommand는 legacy지만 브라우저 전역 지원되고
  //   contenteditable와 짝을 이루는 실용적인 API. 저장 시엔 sanitize를 통해 허용된 태그만 남김.
  //   ★ Electron은 window.prompt()가 no-op이라 asyncPrompt(자체 모달) 사용. 그리고 모달이 뜨는 순간
  //     편집기 selection이 사라지므로, 툴바 조작 직전 selection을 저장해뒀다가 복원한 뒤 명령을 실행.
  //   ★ 저장 range는 target별로 따로 관리 — 안 그러면 post의 range가 bio의 툴바 클릭 때도 복원돼서
  //     명령이 post에 적용되고 bio는 아무 반응 없어 보이는 버그가 생김(요청사항 1번).
  const _mhSavedRanges = new WeakMap();
  function _mhSaveSel(target){
    const sel = window.getSelection();
    if(sel && sel.rangeCount && target.contains(sel.anchorNode)){
      _mhSavedRanges.set(target, sel.getRangeAt(0).cloneRange());
    }
  }
  function _mhRestoreSel(target){
    target.focus();
    const range = _mhSavedRanges.get(target);
    const sel = window.getSelection();
    if(range){
      sel.removeAllRanges(); sel.addRange(range);
    } else {
      // 이 편집기에서 아직 선택 이력이 없으면 끝에 캐럿 위치 — 명령이 어디에 적용될지 확실히 이 target 안이 되게 함.
      const r = document.createRange(); r.selectNodeContents(target); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
  }
  // 최근 사용 색 5개 저장(localStorage). foreColor/hiliteColor 각각 히스토리 유지.
  function _mhLoadRecentColors(kind){
    try{ return JSON.parse(localStorage.getItem('tw.mhRecentColors.'+kind)||'[]'); }catch(_){ return []; }
  }
  function _mhPushRecentColor(kind, hex){
    let arr=_mhLoadRecentColors(kind).filter(c=>c.toLowerCase()!==hex.toLowerCase());
    arr.unshift(hex); arr=arr.slice(0,5);
    try{ localStorage.setItem('tw.mhRecentColors.'+kind, JSON.stringify(arr)); }catch(_){}
  }
  // 기본 팔레트 (자주 쓰이는 색 24개)
  const _MH_PALETTE = [
    '#000000','#404040','#808080','#a0a0a0','#c0c0c0','#e0e0e0','#f0f0f0','#ffffff',
    '#c0392b','#e74c3c','#e67e22','#f39c12','#f1c40f','#27ae60','#2ecc71','#16a085',
    '#3498db','#2980b9','#1e3fa0','#8e44ad','#9b59b6','#d35400','#a04a2a','#7f6a4a',
  ];
  function _mhOpenColorPopup(triggerBtn, kind, onPick, onReset, doc){
    const d = doc || document;   // 👑 디자인 스튜디오(자식 창)에서 쓸 땐 그 문서 안에 렌더
    // 기존 팝업 닫기
    d.querySelectorAll('.mh-color-pop').forEach(p=>p.remove());
    const pop=d.createElement('div'); pop.className='mh-color-pop';
    const rect=triggerBtn.getBoundingClientRect();
    pop.style.left=rect.left+'px'; pop.style.top=(rect.bottom+2)+'px';
    // 최근 색
    const recent=_mhLoadRecentColors(kind);
    let html='<div class="row"><span class="lbl">최근</span><button type="button" class="reset">초기화</button></div>';
    html+='<div class="grid">';
    for(let i=0;i<5;i++){
      const c=recent[i];
      if(c) html+='<div class="sw" data-c="'+c+'" style="background:'+c+';"></div>';
      else html+='<div class="sw" style="background:#fff;border-style:dashed;"></div>';
    }
    html+='</div>';
    // 기본 팔레트
    html+='<div class="lbl">팔레트</div><div class="grid">';
    _MH_PALETTE.forEach(c=>{ html+='<div class="sw" data-c="'+c+'" style="background:'+c+';"></div>'; });
    html+='</div>';
    // 자유 선택 — OS 색 선택 대화상자(스포이드·색 섞기 등 OS 기능 그대로) + HEX 직접 입력.
    //   HEX 칸은 대화상자가 어떤 환경에서 안 뜨더라도 임의 색을 넣을 수 있는 우회로 겸용이다.
    html+='<div class="row" style="margin-top:5px;"><span class="lbl">직접 선택</span><input type="color" class="custom" value="#888888"></div>';
    html+='<div class="row" style="margin-top:2px;"><span class="lbl">#</span><input type="text" class="hex" maxlength="7" placeholder="RRGGBB" spellcheck="false"></div>';
    pop.innerHTML=html;
    d.body.appendChild(pop);
    // 화면 밖으로 나가면 좌측·상단으로 이동 조정
    const vw=d.defaultView || window;
    const pr=pop.getBoundingClientRect();
    if(pr.right>vw.innerWidth) pop.style.left=(vw.innerWidth-pr.width-6)+'px';
    if(pr.bottom>vw.innerHeight) pop.style.top=(rect.top-pr.height-2)+'px';
    // 이벤트
    pop.querySelectorAll('.sw[data-c]').forEach(sw=>{
      sw.addEventListener('mousedown', e=>e.preventDefault());
      sw.addEventListener('click', ()=>{ const c=sw.dataset.c; onPick(c); _mhPushRecentColor(kind, c); pop.remove(); });
    });
    /* 자유 선택 — OS 색 선택 대화상자.
       ★ 열기 직전에 companion.colorDialog(true)로 '항상 위'를 잠시 비켜달라고 알린다.
         스튜디오 창(alwaysOnTop)과 메인 오버레이(screen-saver 레벨)가 topmost라, 그러지 않으면
         대화상자가 그 뒤로 깔려 안 보인다(제보된 증상). 고르거나 취소한 뒤 false로 되돌린다.
         못 보내는 경우까지 main이 포커스 복귀·안전망으로 스스로 복구한다 — 여기 실패가 고착이 되지 않는다.
       ・input : 드래그하는 동안 실시간 미리보기
       ・change: 확정 → 저장·닫기
       ・click 뒤 취소하면 change가 안 오므로, 팝업이 닫힐 때도 한 번 더 false를 보낸다(아래 _dlgOff). */
    const _dlgOn  = ()=>{ try{ if(window.companion && companion.colorDialog) companion.colorDialog(true); }catch(_){} };
    const _dlgOff = ()=>{ try{ if(window.companion && companion.colorDialog) companion.colorDialog(false); }catch(_){} };
    const cust=pop.querySelector('.custom');
    cust.addEventListener('click', _dlgOn);
    cust.addEventListener('input', e=>{ onPick(e.target.value); });
    cust.addEventListener('change', e=>{
      const c=e.target.value; onPick(c); _mhPushRecentColor(kind, c); _dlgOff(); pop.remove();
    });
    // HEX 직접 입력 — #RRGGBB / RRGGBB 둘 다 받는다. 형식이 틀리면 아무 일도 하지 않는다(조용히 무시하지 않고 테두리로 알림).
    const hexIn=pop.querySelector('.hex');
    const applyHex=()=>{
      const v=(hexIn.value||'').trim().replace(/^#/,'');
      if(!/^[0-9a-fA-F]{6}$/.test(v)){ hexIn.style.borderColor='#c0392b'; return; }
      const c='#'+v.toLowerCase();
      onPick(c); _mhPushRecentColor(kind, c); pop.remove();
    };
    hexIn.addEventListener('input', ()=>{ hexIn.style.borderColor=''; });
    hexIn.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); applyHex(); } });
    hexIn.addEventListener('change', applyHex);
    pop.querySelector('.reset').addEventListener('mousedown', e=>e.preventDefault());
    pop.querySelector('.reset').addEventListener('click', ()=>{ onReset(); pop.remove(); });
    // 팝업 자체 클릭이 편집기 포커스를 뺏지 않게
    pop.addEventListener('mousedown', e=>{ if(e.target===pop || e.target.classList.contains('lbl') || e.target.classList.contains('row') || e.target.classList.contains('grid')) e.preventDefault(); });
    // 바깥 클릭 시 닫기
    setTimeout(()=>{
      const closer=(ev)=>{ if(!pop.contains(ev.target) && ev.target!==triggerBtn){ _dlgOff(); pop.remove(); d.removeEventListener('mousedown', closer, true); } };
      d.addEventListener('mousedown', closer, true);
    },0);
  }
  window._mhOpenColorPopup = _mhOpenColorPopup;   // 👑 디자인 스튜디오에서도 같은 컬러 팝업 재사용
  document.querySelectorAll('.mh-rt-toolbar').forEach(bar=>{
    const targetId = bar.dataset.target;
    const target = document.getElementById(targetId);
    if(!target) return;
    // 편집기에서 selection이 바뀔 때마다 저장 (마우스 조작·키보드 이동 모두 커버)
    target.addEventListener('mouseup', ()=>_mhSaveSel(target));
    target.addEventListener('keyup', ()=>_mhSaveSel(target));
    // 버튼/셀렉트/컬러버튼 공통 핸들러
    const applyCmd = (cmd, val)=>{
      _mhRestoreSel(target);
      if(cmd==='hiliteColor'){
        // 크로미움에선 hiliteColor 대신 backColor가 배경색을 span에 적용함. useCSS를 켜야 style로 나옴.
        try{ document.execCommand('styleWithCSS', false, true); }catch(_){}
        document.execCommand('backColor', false, val);
      } else if(cmd==='mhClear'){
        // 서식 초기화 — 선택 텍스트의 서식 제거 (색·굵기·크기 등). 링크는 별도 명령으로.
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
      } else {
        document.execCommand(cmd, false, val);
      }
      _mhSaveSel(target); _mhUpdateRTCount(targetId);
    };
    bar.querySelectorAll('button[data-cmd], select[data-cmd]').forEach(el=>{
      const cmd = el.dataset.cmd;
      // 툴바 클릭이 편집 영역 포커스를 뺏지 않도록 — 안 그러면 selection이 사라져서 명령이 안 먹음.
      // 단, SELECT에 걸면 드롭다운 자체가 안 열리므로 버튼에만 적용.
      if(el.tagName!=='SELECT') el.addEventListener('mousedown', e=>e.preventDefault());
      const trigger = (el.tagName==='SELECT') ? 'change' : 'click';
      el.addEventListener(trigger, async ()=>{
        // 컬러 버튼: 팝업 열기
        if(cmd==='foreColor' || cmd==='hiliteColor'){
          _mhSaveSel(target);   // 팝업 열기 전 selection 저장
          _mhOpenColorPopup(el, cmd,
            (c)=>applyCmd(cmd, c),
            // 초기화: foreColor는 상속색으로 되돌리기 위해 removeFormat 부분 적용, hiliteColor는 투명 배경
            ()=>{
              _mhRestoreSel(target);
              if(cmd==='foreColor'){ document.execCommand('foreColor', false, target===document.getElementById('mhBioBox')?'#444444':'#222222'); }
              else { try{ document.execCommand('styleWithCSS', false, true); }catch(_){} document.execCommand('backColor', false, 'transparent'); }
              _mhSaveSel(target); _mhUpdateRTCount(targetId);
            }
          );
          return;
        }
        // 이미지/링크: asyncPrompt 사용
        if(cmd==='mhImage'){
          const url = await asyncPrompt({title:'이미지 삽입', message:'이미지 URL을 붙여넣으세요', placeholder:'https://...'});
          if(url && /^https?:\/\//i.test(url)) applyCmd('insertImage', url.trim());
          return;
        }
        if(cmd==='mhLink'){
          const url = await asyncPrompt({title:'링크 삽입', message:'링크 URL을 붙여넣으세요\n(선택된 텍스트에 링크가 걸립니다)', placeholder:'https://...'});
          if(url && /^https?:\/\//i.test(url)) applyCmd('createLink', url.trim());
          return;
        }
        const val = (el.tagName==='SELECT') ? el.value : null;
        applyCmd(cmd, val);
      });
    });
  });
  // 스티커 — [+ 스티커]는 이제 **관리 창**을 연다(예전엔 곧바로 파일 선택기가 떴다).
  //   붙인 스티커를 되찾고·고치는 자리가 어디에도 없었기 때문. 새로 붙이는 건 그 창의 [＋ 새 스티커].
  const stickerAddBtn=document.getElementById('mhStickerAddBtn');
  const stickerFile=document.getElementById('mhStickerFileInput');
  if(stickerAddBtn && stickerFile){
    stickerAddBtn.addEventListener('click', ()=>{ myHomeSticker.open(); });
    const pickNewSticker = ()=>{
      if(Object.keys(_myHomeData().stickers||{}).length>=STICKER_MAX){
        toast(`스티커는 최대 ${STICKER_MAX}개까지만 붙일 수 있어요`); return;
      }
      stickerFile.value=''; stickerFile.click();
    };
    const mgrAdd=document.getElementById('stMgrAdd');
    if(mgrAdd) mgrAdd.onclick=pickNewSticker;
    stickerFile.addEventListener('change', ()=>{
      const file=stickerFile.files[0]; if(!file) return;
      const img=new Image(); const reader=new FileReader();
      reader.onload=e=>{ img.onload=async ()=>{
        // ★ 정사각 크롭을 하지 않고 원본 비율을 유지 — 가로 기준 최대 400px로만 축소.
        //   (창 전체에 자유 배치하므로 가로로 긴 배너형 스티커도 자연스럽게 쓸 수 있어야 함)
        const MAXW = STICKER_IMG_MAX_W;
        const scale = Math.min(1, MAXW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        let link=await asyncPrompt({title:'스티커 링크', message:'클릭 시 이동할 링크 (선택 — 비워두면 링크 없음)\n\n※ 나중에 [+ 스티커] → 관리 창에서 바꿀 수 있어요.', defaultValue:'', maxLength:300});
        link=(link||'').trim().slice(0,300);
        const sid='s'+Date.now().toString(36);
        _myHomeData().stickers=_myHomeData().stickers||{};
        // 새 스티커는 창 가운데쯤에 놓아서 바로 눈에 띄게 (겹치지 않게 개수만큼 살짝 어긋냄)
        const n = Object.keys(_myHomeData().stickers).length;
        _myHomeData().stickers[sid]={
          img:c.toDataURL('image/png'),   // PNG로 저장해 알파 채널(투명 배경) 유지
          link:link||null,
          x: 60 + n*18, y: 60 + n*18,
          w, h,                            // 원본 비율 — 렌더 시 이 비율로 표시
          size: 1,
        };
        _mhClampStickerPos(_myHomeData().stickers[sid]);   // 창이 작으면 처음부터 밖에 놓일 수 있다
        renderMyHomeStickers();
        commitMyHomePage(true);
        myHomeSticker.render();           // 관리 창이 열려 있으면 방금 붙인 것이 목록에 바로 뜬다
      }; img.src=e.target.result; };
      reader.readAsDataURL(file);
    });
  }
  // 스티커 드래그 — mousedown한 스티커를 zone 안에서 자유롭게 옮김(경계 안으로 clamp), 놓으면 자동 저장
  let dragSticker=null, dragOffX=0, dragOffY=0, dragStartX=0, dragStartY=0;
  const zone=document.getElementById('mhStickerZone');
  if(zone){
    zone.addEventListener('mousedown', e=>{
      if(_mhViewingUserId() || window._mhPreviewMode) return;   // ★ 관람/미리보기 중에는 스티커를 만질 수 없음
      const el=e.target.closest('.mh-sticker'); if(!el) return;
      dragSticker=el; const r=el.getBoundingClientRect();
      dragOffX=e.clientX-r.left; dragOffY=e.clientY-r.top;
      dragStartX=e.clientX; dragStartY=e.clientY; _setMhStickerDragDist(0);
      e.preventDefault();
    });
    document.addEventListener('mousemove', e=>{
      if(!dragSticker) return;
      _setMhStickerDragDist(Math.max(_mhStickerDragDist(), Math.abs(e.clientX-dragStartX)+Math.abs(e.clientY-dragStartY)));
      const zr=zone.getBoundingClientRect();
      const sid=dragSticker.dataset.sid;
      const s=_myHomeData().stickers && _myHomeData().stickers[sid];
      let x=e.clientX-zr.left-dragOffX, y=e.clientY-zr.top-dragOffY;
      /* ⚠️ 예전엔 40px 고정으로 잘랐다 — 큰 스티커는 그 차이만큼 오른쪽/아래로 삐져나가 잘렸다.
         실제 표시 크기로 잡아 통째로 창 안에 둔다(_mhClampStickerPos와 같은 규칙). */
      if(s){ s.x=x; s.y=y; _mhClampStickerPos(s); x=s.x; y=s.y; }
      else { x=Math.max(0,Math.min(zr.width-40,x)); y=Math.max(0,Math.min(zr.height-40,y)); }
      dragSticker.style.left=x+'px'; dragSticker.style.top=y+'px';
    });
    document.addEventListener('mouseup', ()=>{ if(dragSticker){ dragSticker=null; commitMyHomePage(true); } });
  }
  // 스티커 삭제 시에도 자동 저장(renderMyHomeStickers 안의 삭제 버튼 클릭 핸들러에서 호출)
  const origRenderStickers = _getRenderMyHomeStickers();
  _setRenderMyHomeStickers(function(){ origRenderStickers();
    document.querySelectorAll('.mh-sticker-del').forEach(d=>{
      const prevOnclick=d.onclick;
      d.onclick=e=>{ if(prevOnclick) prevOnclick(e); commitMyHomePage(true); };
    });
  });
  // 이름 변경 링크(마이홈 탭 안) — 친구 탭의 것과 동일한 모달 재사용
  /* ★ "닉네임" 인라인 편집 — 게시글 제목(_mhBeginPostTitleEdit)과 **같은 모양**으로 맞췄다.
       닉네임 자리가 그대로 입력칸이 되고, Enter/포커스아웃 저장 · Esc 취소.
     [왜 창을 안 띄우나] 옛 #userNameOverlay 모달은 마이홈보다 아래 층이라 열려도 뒤에 깔렸다
       (commitUserName 위 주석). 뜨는 것이 없으면 그 사고 자체가 성립하지 않는다.
     ⚠️ 관람(_mhViewingUserId)·미리보기(_mhPreviewMode)에서는 막는다 — _mhApplyVisitUI 가
        「수정」 링크를 숨기는 기준과 같아야 한다. 더블클릭 진입로가 따로 있어서 링크를 숨기는
        것만으로는 부족하다.
     ⚠️ 표시값과 편집값이 다르다. 화면은 getDisplayName()('(이름 없음)')이지만 입력칸에는
        getUserName() 을 넣되 기본값 '나' 는 빈칸으로 준다 — 옛 모달과 같은 규칙이다.
        여기를 getDisplayName() 으로 채우면 이름을 정한 적 없는 사람이 '(이름 없음)' 을
        진짜 자기 이름으로 저장하게 된다. */
  function _mhBeginNameEdit(){
    const nameEl=document.getElementById('mhMyName'); if(!nameEl) return;
    if(_mhViewingUserId() || window._mhPreviewMode) return;   // 관람·미리보기에선 편집 불가
    if(document.getElementById('mhMyNameInput')) return;     // 이미 편집 중
    const editLink=document.getElementById('mhNameEditLink');
    const inp=document.createElement('input');
    inp.id='mhMyNameInput'; inp.type='text'; inp.maxLength=USER_NAME_MAX();
    inp.value = getUserName()==='나' ? '' : getUserName();
    inp.placeholder='닉네임';
    /* 글씨 크기·굵기는 원래 이름표를 실측해 따라간다 — 숫자를 박아 두면 테마나 폰트가 바뀔 때
       입력칸만 혼자 어긋난다. 색은 테마가 nameEl 에 칠하므로(_mhApplyTheme 의 t.name) 건드리지 않는다. */
    let fs='14px', fw='bold';
    try{ const cs=getComputedStyle(nameEl); fs=cs.fontSize||fs; fw=cs.fontWeight||fw; }catch(_){}
    /* 폭은 #mhNameRow 를 꽉 채운다 — 왼쪽 열(#mhHomeLeft 200px, padding 20px)의 안쪽 160px 이라
       프로필 사진(160px)과 정확히 같은 줄에 선다. px 를 박으면 열 폭이 바뀔 때 혼자 어긋난다. */
    inp.style.cssText='font-family:var(--tw-font-legacy);font-size:'+fs+';font-weight:'+fw+';'
      + 'width:100%;padding:1px 4px;box-sizing:border-box;';
    nameEl.style.display='none';
    if(editLink) editLink.style.display='none';   // 편집 중엔 링크도 비운다(눌러도 아무 일 없는 버튼을 남기지 않는다)
    nameEl.parentNode.insertBefore(inp, nameEl);
    inp.focus(); inp.select();
    let canceled=false;
    const finish=()=>{
      window._mhCancelNameEdit = null;
      if(!canceled) commitUserName(inp.value);
      nameEl.textContent = _mhViewingUserId() ? _mhViewingDisplayName() : getDisplayName();
      nameEl.style.display='';
      /* ⚠️ 순서가 중요하다. 입력칸을 **먼저 걷고** 나서 물어야 한다 —
         _mhApplyVisitUI 는 "입력칸이 아직 있으면 링크를 숨긴다"로 판정하므로,
         남겨 둔 채 부르면 편집이 끝났는데도 「수정」이 영영 안 돌아온다. */
      inp.remove();
      /* 링크를 '' 로 되돌리지 않고 판정을 쥔 곳에 다시 묻는다 — 편집하는 사이에 관람 모드로
         넘어갔을 수 있고, 그러면 숨겨야 할 링크가 되살아난다. */
      if(typeof _mhApplyVisitUI==='function') _mhApplyVisitUI();
      else if(editLink) editLink.style.display='';
    };
    inp.addEventListener('keydown', e=>{
      if(e.key==='Enter') inp.blur();
      if(e.key==='Escape'){ canceled=true; inp.blur(); }
      e.stopPropagation();   // 마이홈 창 Escape 닫힘과 충돌 방지
    });
    inp.addEventListener('blur', finish);
    /* 밖에서 이 편집을 **저장 없이** 접는 유일한 길. 관람 모드 전환이 이걸 쓴다.
       ⚠️ finish 안에서 반드시 null 로 되돌린다 — 남겨 두면 이미 사라진 입력칸을 가리킨다. */
    window._mhCancelNameEdit = ()=>{ canceled=true; inp.blur(); };
  }
  window._mhBeginNameEdit = _mhBeginNameEdit;   // 친구 탭 쪽 버튼도 같은 한 벌을 쓴다
  // 「수정」 링크와 닉네임 더블클릭 — 진입로는 둘, 부르는 함수는 하나.
  const nameEditLink=document.getElementById('mhNameEditLink');
  if(nameEditLink) nameEditLink.addEventListener('click', e=>{ e.stopPropagation(); _mhBeginNameEdit(); });
  const myNameEl=document.getElementById('mhMyName');
  if(myNameEl){
    myNameEl.addEventListener('dblclick', _mhBeginNameEdit);
    myNameEl.title='더블클릭해서 닉네임 수정';
    myNameEl.style.cursor='pointer';
  }
  /* ★ "게시글 제목" 인라인 편집 — 더블클릭과 ✏️ 수정 버튼이 **같은 함수 한 벌**을 부른다.
       진입부를 두 벌로 쓰면 반드시 갈라진다(한쪽만 관람 모드 가드가 빠지는 식으로).
     ⚠️ 관람 모드(_mhViewingUserId)뿐 아니라 방문자 시점 미리보기(_mhPreviewMode)에서도 막는다 —
        _mhApplyVisitUI 가 편집 UI 를 잠그는 기준(visiting)과 같아야 한다. */
  function _mhBeginPostTitleEdit(){
    const titleSpan=document.getElementById('mhPostTitle'); if(!titleSpan) return;
    if(_mhViewingUserId() || window._mhPreviewMode) return;   // 관람·미리보기에선 편집 불가
    if(document.getElementById('mhPostTitleInput')) return;  // 이미 편집 중
    const editBtn=document.getElementById('mhPostTitleEditBtn');
    const cur=_myHomeData().postTitle||'';
    const inp=document.createElement('input');
    inp.id='mhPostTitleInput'; inp.type='text'; inp.maxLength=30; inp.value=cur;
    inp.style.cssText='font-family:var(--tw-font-legacy);font-size:12px;font-weight:bold;width:220px;padding:1px 4px;';
    titleSpan.style.display='none';
    if(editBtn) editBtn.style.display='none';   // 편집 중엔 버튼도 비운다(눌러도 아무 일 없는 버튼을 남기지 않는다)
    titleSpan.parentNode.insertBefore(inp, titleSpan);
    inp.focus(); inp.select();
    let canceled=false;
    const commit=()=>{
      if(!canceled){ _myHomeData().postTitle=inp.value.trim().slice(0,30); commitMyHomePage(true); }
      titleSpan.textContent=_myHomeData().postTitle||'게시글 제목';
      titleSpan.style.display='';
      if(editBtn) editBtn.style.display='';
      inp.remove();
    };
    inp.addEventListener('keydown', e=>{
      if(e.key==='Enter') inp.blur();
      if(e.key==='Escape'){ canceled=true; inp.blur(); }
      e.stopPropagation();   // 마이홈 창 Escape 닫힘과 충돌 방지
    });
    inp.addEventListener('blur', commit);
  }
  // ★ "게시글 제목" — 더블클릭 또는 ✏️ 수정 버튼으로 인라인 입력 전환. Enter/포커스아웃 시 저장.
  const titleSpan=document.getElementById('mhPostTitle');
  if(titleSpan) titleSpan.addEventListener('dblclick', _mhBeginPostTitleEdit);
  const titleEditBtn=document.getElementById('mhPostTitleEditBtn');
  if(titleEditBtn) titleEditBtn.addEventListener('click', e=>{ e.stopPropagation(); _mhBeginPostTitleEdit(); });
  // 🎵 배경음악 — 유튜브 링크를 자식 BrowserWindow(main.js에서 관리)로 열어 재생.
  //   ▶/▐▐는 창을 껐다 켰다 하지 않고, 첫 재생만 창을 만들고 이후 일시정지/재개로 처리.
  //   창 자체가 닫히는 건 ✕ 클릭 또는 마이홈 종료 시에만.
  let _bgmPlaying=false;
  let _bgmWinOpen=false;   // BGM 자식창이 열려있는지(일시정지 상태도 열려있음으로 간주)
  function _ytId(url){ return _ytVideoId(url); }   // ★ 최상위 _ytVideoId 로 위임 — 플레이리스트와 파서를 한 벌만 유지
  function _bgmLabelRefresh(){
    const lab=document.getElementById('mhBgmLabel'); const play=document.getElementById('mhBgmPlay');
    const b=_myHomeData().bgm;
    if(lab){
      const txt = (b&&b.url) ? (b.title||'YouTube BGM') : '배경음악 없음';
      lab.textContent = txt;   // 우선 단일 텍스트로 — 넘칠 때만 아래에서 복제본을 붙인다
      _bgmMarqueeApply(lab, txt);
    }
    if(play) play.textContent = _bgmPlaying ? '▐▐' : '▶';
  }
  /* ★ 제목이 뷰포트보다 길 때만 루프 슬라이드(한 방향으로 계속 흐르다 처음으로 순간복귀).
     빈틈 없이 이으려면 제목 한 벌 + 간격 + 복제본을 나란히 두고, 한 벌 폭만큼 왼쪽으로 민다.
     레이아웃이 잡힌 뒤 실측해야 하므로 rAF 뒤에 판정한다(마이홈이 막 열릴 때 폭 0 오판 방지). */
  function _bgmMarqueeApply(lab, txt){
    lab.classList.remove('mh-bgm-marquee');
    lab.style.removeProperty('--mhBgmW');
    lab.style.removeProperty('--mhBgmDur');
    requestAnimationFrame(()=>{
      try{
        const vp=document.getElementById('mhBgmLabelVp'); if(!vp) return;
        if(lab.scrollWidth - vp.clientWidth > 2){
          // 한 벌 폭을 잰다(간격 32px 포함) — 이 값만큼 흐른 뒤 복제본이 그 자리에 와서 순간복귀가 안 보인다.
          const oneW = lab.scrollWidth + 32;
          // 복제본 부착: [원본][간격][복제본]
          lab.textContent = txt;
          const gap=document.createElement('span'); gap.className='mh-bgm-gap'; lab.appendChild(gap);
          const dup=document.createElement('span'); dup.setAttribute('aria-hidden','true'); dup.textContent=txt; lab.appendChild(dup);
          lab.style.setProperty('--mhBgmW', oneW+'px');
          lab.style.setProperty('--mhBgmDur', Math.max(5, oneW/22).toFixed(1)+'s');   // 폭에 비례 → 속도 일정, 최소 5s
          lab.classList.add('mh-bgm-marquee');
        }
      }catch(_){}
    });
  }
  window._mhBgmRefresh=_bgmLabelRefresh;
  /* 📷 스티커사진이 열릴 때 «지금 마이홈 BGM 이 나는 중인가»를 물어보고, 재웠다 깨울 때
     표시를 같이 맞춘다. 창(companion)은 셋이 공유하므로 pause/resume 은 그쪽이 한 번만 부른다 —
     여기서는 **표시만** 바꾼다. ⚠️ 여기서 companion 을 또 부르면 두 번 재워진다. */
  window._mhBgmPlaying = function(){ return !!_bgmPlaying; };
  window._mhBgmSetPlaying = function(on){ _bgmPlaying = !!on; _bgmLabelRefresh(); };
  // ▐▐ 클릭 — 창은 유지, 영상만 일시정지. 다음 ▶ 클릭 시 같은 창에서 재개.
  function _bgmPause(){
    if(window.companion && companion.pauseBgm) companion.pauseBgm();
    _bgmPlaying=false; _bgmLabelRefresh();
  }
  let _bgmLoadedVid = null;   // 실제로 로드된(재생중이거나 일시정지된) 유튜브 영상 id — URL 변경 감지용
  // 마이홈 종료 시 호출 — 실제로 창을 파괴
  function _bgmDestroy(){
    // ★ 창은 🎵 플레이리스트와 공유한다 — 마이홈이 창 주인이 아닐 때(_bgmWinOpen=false)는 닫지 않는다.
    //   안 그러면 마이홈을 끄는 순간 플레이리스트 재생이 같이 끊긴다.
    if(_bgmWinOpen && window.companion && companion.closeBgm) companion.closeBgm();
    _bgmPlaying=false; _bgmWinOpen=false; _bgmLoadedVid=null; _bgmLabelRefresh();
  }
  window._bgmDestroy = _bgmDestroy;   // 마이홈 close 훅에서 재사용
  function _bgmStart(){
    const b=_myHomeData().bgm; const vid=b&&_ytId(b.url);
    if(!vid){ toast('오른쪽 ((o 를 눌러 유튜브 링크를 먼저 등록해주세요'); return; }
    if(!(window.companion && companion.openBgm)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
    // ★ 마이홈5: 창이 열려있어도 유저가 곡을 바꿨으면(_bgmLoadedVid !== vid) resumeBgm으로 이어 재생하지
    //   말고 새 URL을 로드해야 함. 안 그러면 A→B로 바꿔도 재생을 눌렀을 때 A가 계속 나옴.
    if(_bgmWinOpen && _bgmLoadedVid === vid && window.companion.resumeBgm){
      // 창이 이미 열려있으면(일시정지 상태) 새로 로드하지 말고 재개만
      companion.resumeBgm();
    } else {
      // 첫 재생: 창을 새로 만들고 URL 로드
      const url='https://www.youtube.com/watch?v='+vid;
      companion.openBgm(url, (b.title||'YouTube BGM'));
      _bgmWinOpen=true; _bgmLoadedVid=vid;
      setTimeout(()=>{ if(typeof window._mhSyncBgmBounds==='function') window._mhSyncBgmBounds(); }, 60);
    }
    _bgmPlaying=true; _bgmLabelRefresh();
  }
  // ((o로 곡을 새로 등록/변경한 경우엔 URL을 실제로 교체해야 하므로 별도 함수
  function _bgmLoadNew(){
    const b=_myHomeData().bgm; const vid=b&&_ytId(b.url);
    if(!vid) return;
    if(!(window.companion && companion.openBgm)) return;
    const url='https://www.youtube.com/watch?v='+vid;
    companion.openBgm(url, (b.title||'YouTube BGM'));   // 이미 창이 있으면 main.js가 URL만 교체함
    _bgmWinOpen=true; _bgmPlaying=true; _bgmLoadedVid=vid; _bgmLabelRefresh();
    // 창이 새로 만들어지는 경우를 대비해 위치를 확실히 마이홈 뒤로
    setTimeout(()=>{ if(typeof window._mhSyncBgmBounds==='function') window._mhSyncBgmBounds(); }, 60);
  }
  // 자식창이 유저에 의해(× 눌러) 닫히면 renderer 상태도 동기화
  if(window.companion && companion.onBgmClosed) companion.onBgmClosed(()=>{
    _bgmPlaying=false; _bgmWinOpen=false; _bgmLabelRefresh();
  });
  // 창 소유권이 🎵 플레이리스트로 넘어갔으면 마이홈 위젯의 재생 표시를 내린다(나중에 튼 쪽이 이긴다)
  if(window.companion && companion.onBgmMode) companion.onBgmMode(mode=>{
    if(mode !== 'home'){ _bgmPlaying=false; _bgmWinOpen=false; _bgmLoadedVid=null; _bgmLabelRefresh(); }
  });
  const bgmPlay=document.getElementById('mhBgmPlay');
  if(bgmPlay) bgmPlay.addEventListener('click', ()=>{ _bgmPlaying ? _bgmPause() : _bgmStart(); });
  const bgmSet=document.getElementById('mhBgmSet');
  if(bgmSet) bgmSet.addEventListener('click', async ()=>{
    const cur=(_myHomeData().bgm&&_myHomeData().bgm.url)||'';
    const url=await asyncPrompt({title:'배경음악', message:'배경음악으로 쓸 유튜브 링크를 입력하세요\n(비우고 확인 = 삭제)', defaultValue:cur, placeholder:'https://youtu.be/…'});
    if(url===null) return;
    if(!url.trim()){ _myHomeData().bgm=null; _bgmDestroy(); commitMyHomePage(true); return; }
    if(!_ytId(url)){ toast('유튜브 링크를 인식하지 못했어요'); return; }
    const title=await asyncPrompt({title:'곡 제목', message:'위젯에 표시할 곡 제목 (선택)', defaultValue:(_myHomeData().bgm&&_myHomeData().bgm.title)||'', maxLength:40});
    _myHomeData().bgm={ url:url.trim(), title:(title||'').trim().slice(0,40) };
    _bgmLabelRefresh(); commitMyHomePage(true);
    _bgmLoadNew();   // 새 URL로 실제 로드
  });
  // 🎨 마이홈 수정(타이틀바) — 마이홈 창 바깥 프레임(회색 영역) 배경을 색상 또는 이미지로 꾸미기
  function applyMyHomeBg(){
    const win=document.getElementById('myHomeWin'); if(!win) return;
    const bg=_myHomeData().bg;
    if(bg && bg.img) win.style.background='url('+bg.img+') center/cover no-repeat, var(--win-face)';
    else if(bg && bg.color) win.style.background=bg.color;
    else win.style.background='var(--win-face)';
  }
  window._mhApplyBg=applyMyHomeBg;
  // 🎨 마이홈 5 + 👑 프리미엄 디자인: 영역별 테마 — theme{...} 키를 각 요소 배경(색/이미지)·글씨색에 적용.
  //   이미지 키(...Img)가 있으면 색보다 우선. 라이선스 보유자(isPremium)/관리자 전용 편집(적용·표시는 누구나).
  function _mhBg(el, color, img){
    if(!el) return;
    if(img) el.style.background = 'url('+img+') center/cover no-repeat';
    else el.style.background = color || '';
  }
  function applyMyHomeTheme(){
    const t=_myHomeData().theme||{};
    // 공통 — 탭버튼
    document.querySelectorAll('.mh-tab').forEach(el=>{
      if(t.tabImg) el.style.background='url('+t.tabImg+') center/cover no-repeat';
      else el.style.background = t.tab || '';
      el.style.color = t.tabText || '';
    });
    // 마이홈 페이지
    _mhBg(document.getElementById('mhHomeLeft'), t.left, t.leftImg);
    const nameEl=document.getElementById('mhMyName'); if(nameEl) nameEl.style.color = t.name || '';
    const bgm=document.getElementById('mhBgmWidget');
    if(bgm){ _mhBg(bgm, t.bgmBg, null); bgm.style.color = t.bgmText || ''; }
    // 스티커 존 배경 옵션은 제거됨(색이 화면 전체에 번져 보이는 문제) — 기존 저장분(t.stickerBg)이 있어도 적용하지 않음.
    _mhBg(document.getElementById('mhPageHome'), t.right, t.rightImg);
    const pt=document.getElementById('mhPostTitle'); if(pt) pt.style.color = t.postTitle || '';
    const room=document.getElementById('mhRoomPreview');
    if(room){
      if(t.roomImg) room.style.background='url('+t.roomImg+') center/cover no-repeat';
      else if(t.roomBg) room.style.background=t.roomBg;
      else room.style.background='';   // 비우면 CSS의 기본 핑크 그라데이션으로 복귀
    }
    const gbBtn=document.getElementById('mhGuestbookBtn'); if(gbBtn) gbBtn.style.background = t.gbBtn || '';
    // 친구 페이지
    _mhBg(document.getElementById('mhFriendLeft'), t.fList, t.fListImg);
    /* 👥 친구 관리 · 📩 우편함은 **CSS 에서 이미 한 규칙을 공유한다**
         (#mhInboxTop,#mhFmTop / #mhInboxTabs,#mhFmTabs / #mhInboxList,#mhFmList — 그쪽 주석 참고).
       그래서 테마도 같은 토큰을 쓴다. 새 키를 만들면 **CSS 는 같은데 색만 갈라지는** 상태가 되고,
       나란히 서던 두 칸이 테마를 켠 순간 서로 다른 창처럼 보인다.
       [경위] 친구 관리는 뒤에 생긴 칸이라 여기 이름 나열에서 빠져 있었다 — 테마를 칠해도 그 칸만
         흰 채로 남았다(제보). 이 코드베이스에서 "선택자를 하나씩 나열하다 빠뜨림"은 반복된
         실패 양상이고(검사 12·14·15 가 전부 그래서 생겼다), 그래서 검사 21 이 이 짝을 지킨다.
       ⚠️ 짝 중 하나만 적지 말 것. CSS 에서 함께 묶은 것은 여기서도 함께 적는다. */
    // 친구·친구 관리·우편함 상단 헤더 (공통) + 카테고리 줄
    const fHeadEls = [document.getElementById('mhFriendHead'),
                      document.getElementById('mhInboxTop'),
                      document.getElementById('mhFmTop')];
    fHeadEls.forEach(el=>{ if(el){ el.style.background = t.fHead || ''; el.style.color = t.fHeadText || ''; } });
    [document.getElementById('mhInboxTabs'), document.getElementById('mhFmTabs')]
      .forEach(el=>{ if(el) el.style.background = t.fTabsBg || ''; });
    // 📅 스케줄러 — 달력 / 우측(기념일·D-day) 영역
    _mhBg(document.getElementById('mhSchedCal'), t.schedCal, t.schedCalImg);
    _mhBg(document.getElementById('mhSchedDday'), t.schedSide, t.schedSideImg);

    // bio·게시글 칸 배경 — 기본은 투명(패널이 비침), 테마에서 색을 지정하면 그 색으로
    const bioBox = document.getElementById('mhBioBox');
    if(bioBox) bioBox.style.background = t.bioBg || '';
    const postBox = document.getElementById('mhPostBox');
    if(postBox) postBox.style.background = t.postBg || '';
    document.querySelectorAll('#mhFriendList .mh-fname').forEach(el=>{ el.style.color = t.fListText || ''; });
    /* 목록 칸 — 👥 친구 관리와 📩 우편함이 같은 토큰을 쓴다(위 짝 주석 참고). */
    [document.getElementById('mhInboxList'), document.getElementById('mhFmList')].forEach(el=>{
      if(!el) return;
      _mhBg(el, t.fChat, t.fChatImg);
      el.style.color = t.fChatText || '';
    });
    // (프로필 레일 제거됨 — fCard 테마 값은 이제 사용 안 함, 저장돼 있어도 무해)
  }
  window._mhApplyTheme=applyMyHomeTheme;
  const editBtn=document.getElementById('mhEditHomeBtn');
  const bgMenu=document.getElementById('mhBgMenu');
  if(editBtn && bgMenu){
    // 👑 진입 분기: 라이선스 보유자(또는 관리자)는 프리미엄 디자인 스튜디오, 그 외에는 기존 드롭다운
    editBtn.addEventListener('click', e=>{
      e.stopPropagation();
      if(isPremium() || isAdmin()){ bgMenu.classList.remove('on'); _mhOpenDesignStudio(); return; }
      bgMenu.classList.toggle('on');
    });
    document.addEventListener('click', e=>{
      if(!e.target.closest('#mhBgMenu') && !e.target.closest('#mhEditHomeBtn')) bgMenu.classList.remove('on');
    });
    // 색상 팔레트 — 네이티브 <input type="color">를 열어서 사용자가 자유롭게 색 선택
    const colorPicker=document.getElementById('mhBgColorInput');
    document.getElementById('mhBgColorBtn')?.addEventListener('click', ()=>{
      bgMenu.classList.remove('on');
      if(!colorPicker) return;
      colorPicker.value = (_myHomeData().bg && _myHomeData().bg.color) || '#c0c0c0';
      colorPicker.click();
    });
    if(colorPicker){
      // 팔레트에서 색을 옮기는 동안 실시간으로 배경 반영(input) — 저장은 최종 선택 시(change)
      colorPicker.addEventListener('input', ()=>{
        _myHomeData().bg={ color:colorPicker.value }; applyMyHomeBg();
      });
      colorPicker.addEventListener('change', ()=>{
        _myHomeData().bg={ color:colorPicker.value }; applyMyHomeBg(); commitMyHomePage(true);
      });
    }
    const bgFile=document.getElementById('mhBgImgInput');
    document.getElementById('mhBgImgBtn')?.addEventListener('click', ()=>{
      bgMenu.classList.remove('on');
      if(bgFile){ bgFile.value=''; bgFile.click(); }
    });
    if(bgFile) bgFile.addEventListener('change', ()=>{
      const f=bgFile.files[0]; if(!f) return;
      const img=new Image(); const reader=new FileReader();
      reader.onload=e=>{ img.onload=()=>{
        const MAXW=800;   // 저장 용량 제한을 위해 가로 800px 이하로 축소
        const scale=Math.min(1, MAXW/img.width);
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        _myHomeData().bg={ img:c.toDataURL('image/jpeg',0.8) };
        applyMyHomeBg(); commitMyHomePage(true);
      }; img.src=e.target.result; };
      reader.readAsDataURL(f);
    });
    document.getElementById('mhBgResetBtn')?.addEventListener('click', ()=>{
      bgMenu.classList.remove('on');
      _myHomeData().bg=null; _myHomeData().theme=null;
      applyMyHomeBg(); applyMyHomeTheme(); commitMyHomePage(true);
    });
    // (예전 드롭다운형 프리미엄 색 버튼은 👑 디자인 스튜디오 팝업으로 대체됨)
  }
  /* ==== 👑 프리미엄 디자인 스튜디오 — 독립 팝업 창 ====
     방명록처럼 window.open('mhDesign…')으로 별도 OS 창에 띄움(요청사항: 마이홈 밖으로, 드래그 이동,
     닫은 위치 기억 → main.js savedDsPos). 마크업·스타일·이벤트는 opener(여기)에서 child doc에 직접 구성.
     색상 선택 팝업(_mhOpenColorPopup)은 child 문서를 넘겨받아 그 안에 렌더됨. */
  const _MH_DS_ROWS = {
    home: [
      {group:'바깥 배경'},
      {key:'outer', label:'바깥 배경', img:true, special:'bg'},   // 값은 _myHomeData.bg에 저장 (theme와 별개)
      {group:'탭버튼 (마이홈·친구 공통)'},
      {key:'tab',      label:'탭 배경',        img:true},
      {key:'tabText',  label:'탭 글씨색'},
      {group:'왼쪽 프로필 패널'},
      {key:'left',     label:'패널 배경',      img:true},
      {key:'name',     label:'닉네임 글씨색'},
      {key:'bioBg',    label:'소개글 칸 배경'},
      {key:'bgmBg',    label:'BGM 위젯 배경'},
      {key:'bgmText',  label:'BGM 위젯 글씨색'},
      {group:'본문 패널'},
      {key:'right',    label:'본문 배경',      img:true},
      {key:'postTitle',label:'게시글 제목 글씨색'},
      {key:'postBg',   label:'게시글 칸 배경'},
      {key:'roomBg',   label:'방 미리보기 배경', img:true, imgKey:'roomImg'},
      {key:'gbBtn',    label:'방명록 버튼 색'},
    ],
    friend: [
      {group:'상단 헤더'},
      {key:'fHead',    label:'헤더 배경 (친구·관리·우편함 공통)'},
      {key:'fHeadText',label:'헤더 글씨색'},
      {key:'fTabsBg',  label:'카테고리 줄 배경'},
      {group:'친구 목록'},
      {key:'fList',    label:'목록 배경',      img:true},
      {key:'fListText',label:'친구 이름 글씨색'},
      /* 👥 친구 관리(받은 요청·보낸 요청·선물함)와 📩 우편함은 CSS 부터 같은 규칙을 쓰는 한 칸이라
         토큰도 하나다(applyMyHomeTheme 의 짝 주석 참고). 라벨은 그 사실이 보이게 적는다 —
         예전 라벨('수령함 배경')은 수령함이 우편함 탭으로 나가고 그 자리를 친구 관리가 쓰게 된
         뒤로 어디를 가리키는지 알 수 없는 말이 됐다.
         ⚠️ 키 이름(fChat)은 **바꾸지 않는다.** 이미 저장된 테마가 그 이름으로 들어 있다. */
      {group:'오른쪽 칸 (친구 관리 · 우편함)'},
      {key:'fChat',    label:'목록 칸 배경',    img:true},
      {key:'fChatText',label:'목록 칸 글씨색'},
    ],
    sched: [
      {group:'달력'},
      {key:'schedCal',   label:'달력 배경',    img:true},
      {group:'기념일 · D-day'},
      {key:'schedSide',  label:'우측 영역 배경', img:true},
    ],
  };
  let _mhDsWin=null, _mhDsTab='home';
  window._mhDsClose = ()=>{ try{ if(_mhDsWin && !_mhDsWin.closed) _mhDsWin.close(); }catch(_){} _mhDsWin=null; };
  const DS_HTML = '<!doctype html><html><head><meta charset="utf-8"><style>'+
    /* 🎨 [2026-09-15 제보 5] 테마 토큰은 applyThemeToChildDoc 가 넣는다(방명록과 같다). 이 창의 타이틀·프리셋 줄은
       **두 테마 모두 금색** — 유료 표시라 액센트를 안 탄다(--win-title-premium 이 테마별 금색을 정한다). */
    'html{--ds-body:#d8d8d8;}html[data-theme=bubble]{--ds-body:#FBFCFC;}'+
    /* [2026-09-16 제보 5 후속] 창 모서리는 **위 두 개만** 둥글다. 자식 창은 BrowserWindow 하나가 통째로 이
       body 라 아래까지 둥글리면 창 바닥 모서리가 깎여 보인다 — 마이홈 창(본창 안 div)과 같은 인상이 되게 아래는 사각. */
    'body{margin:0;overflow:hidden;background:var(--win-face-grad,none),var(--win-face,#c0c0c0);font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);height:100vh;box-sizing:border-box;'+
    'border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius,0px) var(--win-radius,0px) 0 0;color:var(--win-ink,#000);display:flex;flex-direction:column;}'+
    /* [2026-09-16 제보 5 후속 · 시안 A] 플레이리스트 바(#myPlHead)와 같은 문법으로.
       ① margin 을 뺀다 — 2px 여백이 있으면 창 테두리와 바 사이에 흰 선이 보여 «붙어 있지 않은» 인상이 된다.
       ② 아래 모서리는 사각(위만 --win-radius-2px). 창 body 가 위만 둥근 것과 짝을 맞춘다.
       ③ 글씨 흰 그림자 + 바 아래 안쪽 그림자 — 플레이리스트 바의 입체감이 이 두 줄에서 나온다.
       ⚠️ 기본(각진) 테마에서는 --win-radius 가 0 이라 모서리 값이 전부 0 이 되고, 그림자 두 줄만 남는다.
         그 두 줄은 본창 타이틀바(.win98titlebar)도 테마와 무관하게 쓰고 있어 어긋나지 않는다. */
    '#dsTitle{height:22px;padding:4px 5px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-sizing:border-box;'+
    'background:var(--win-title-premium,linear-gradient(90deg,#7a5a10,#c9a227));color:var(--win-title-premium-ink,#fff);border-radius:max(0px,calc(var(--win-radius,0px) - 2px)) max(0px,calc(var(--win-radius,0px) - 2px)) 0 0;font-size:11.5px;font-weight:bold;user-select:none;-webkit-app-region:drag;'+
    'text-shadow:0 1px 0 rgba(255,255,255,.5);box-shadow:inset 0 -1px 0 rgba(0,0,0,.10);}'+
    '#dsClose{width:16px;height:14px;font-size:9px;line-height:1;cursor:pointer;padding:0;flex-shrink:0;-webkit-app-region:no-drag;'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);color:var(--win-ink,#000);}'+
    // 👑 디자인 프리셋 줄 — 줄 하나·칸 셋·버튼 하나. 이 창은 항목이 많아 스크롤이 생기므로
    //   위에서 먹는 높이가 곧 비용이다. 27px 안으로 유지할 것.
    '#dsPresets{display:flex;align-items:center;gap:4px;margin:6px 6px 0;padding:4px 6px;flex-shrink:0;'+
    'background:#e8e4d2;border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#dsPresets .ps-cap{flex:none;font-size:10px;color:#8a6d1f;font-weight:bold;}'+
    '#dsPresets .ps-tab{flex:1;min-width:0;height:19px;padding:0 4px;font-size:10.5px;cursor:pointer;color:var(--win-ink,#222);'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);'+
    'display:flex;align-items:center;justify-content:center;gap:3px;overflow:hidden;white-space:nowrap;}'+
    '#dsPresets .ps-tab.cur{background:#fff;font-weight:bold;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#dsPresets .ps-tab.armed{background:#fff;color:#c0392b;font-weight:bold;}'+
    '#dsPresets .ps-dot{width:7px;height:7px;flex:none;border:1px solid #8a8a8a;background:#d8d8d8;}'+
    '#dsPresets .ps-nm{overflow:hidden;text-overflow:ellipsis;}'+
    '#dsPresets .ps-nm.empty{color:var(--win-ink-soft,#6b6b6b);font-weight:normal;}'+
    '#dsPresets .ps-save{flex:none;height:19px;padding:0 7px;font-size:10px;cursor:pointer;color:var(--win-ink,#222);'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);display:flex;align-items:center;}'+
    '#dsPresets .ps-save.armed{color:#c0392b;font-weight:bold;}'+
    '#dsPresets .ps-edin{flex:1;min-width:0;height:19px;padding:0 3px;text-align:center;'+
    'font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:10.5px;color:var(--win-ink,#222);background:#fff;'+
    'border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#dsTabs{display:flex;gap:2px;padding:6px 8px 0;flex-shrink:0;}'+
    '.ds-tab{font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:11px;padding:4px 14px;cursor:pointer;color:var(--win-ink-soft,#555);'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);}'+
    '.ds-tab.on{font-weight:bold;color:var(--win-ink,#000);background:#fff;}'+
    '#dsBody{flex:1;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:4px;margin:0 4px;background:var(--ds-body,#d8d8d8);border-radius:var(--win-radius-sm,0px);}'+
    '.ds-group{font-size:10px;color:#8a6d1f;font-weight:bold;margin:6px 0 2px;border-bottom:1px solid #b8a86a;padding-bottom:2px;}'+
    '.ds-row{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--win-ink,#222);padding:2px 0;}'+
    '.ds-row .lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.ds-sw{width:24px;height:18px;flex-shrink:0;cursor:pointer;border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);background:#fff;position:relative;}'+
    '.ds-sw.none:after{content:"\\2014";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#999;font-size:10px;}'+
    '.ds-btn{font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:10px;height:18px;padding:0 6px;cursor:pointer;flex-shrink:0;color:var(--win-ink,#222);'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);}'+
    '.ds-btn.imgon{background:#dcefd8;font-weight:bold;}'+
    '.ds-imgrow{display:flex;gap:3px;margin:2px 0 4px 12px;}'+
    '.ds-imghint{font-size:9px;color:#8a8578;line-height:1.4;margin:0 0 6px 12px;}'+
    '.ds-imgrow input{flex:1;min-width:0;font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:10px;padding:2px 4px;'+
    'border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#dsFoot{display:flex;align-items:center;gap:6px;padding:6px 8px;flex-shrink:0;border-top:1px solid #999;}'+
    '#dsFoot button{font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:11px;padding:3px 12px;cursor:pointer;color:var(--win-ink,#222);'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);}'+
    // 컬러 팝업 (opener의 _mhOpenColorPopup이 이 문서에 그려넣음)
    '.mh-color-pop{position:absolute;background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);z-index:9999;padding:6px;'+
    'border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);box-shadow:2px 2px 5px rgba(0,0,0,.25);'+
    'font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:10px;color:var(--win-ink,#333);user-select:none;}'+
    '.mh-color-pop .lbl{margin:4px 0 2px;color:var(--win-ink-soft,#555);}'+
    '.mh-color-pop .grid{display:grid;grid-template-columns:repeat(8,14px);gap:2px;}'+
    '.mh-color-pop .sw{width:14px;height:14px;cursor:pointer;border:1px solid #999;box-sizing:border-box;}'+
    '.mh-color-pop .sw:hover{outline:1px solid #000;outline-offset:-1px;}'+
    '.mh-color-pop .row{display:flex;gap:2px;align-items:center;}'+
    '.mh-color-pop input[type=color]{width:22px;height:18px;padding:0;border:1px solid #999;cursor:pointer;background:none;}'+
    '.mh-color-pop .hex{flex:1;min-width:0;font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:10px;padding:1px 3px;'+
    'border:1px solid #404040;background:#fff;color:var(--win-ink,#222);}'+
    '.mh-color-pop .reset{margin-left:auto;font-size:10px;padding:1px 6px;cursor:pointer;background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);'+
    'border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);}'+
    '</style></head><body>'+
    '<div id="dsTitle"><span>\uD83D\uDC51 \uD504\uB9AC\uBBF8\uC5C4 \uB514\uC790\uC778</span><button id="dsClose">\u2715</button></div>'+
    '<div id="dsPresets"></div>'+
    '<div id="dsTabs"><button class="ds-tab on" data-dstab="home" type="button">\uB9C8\uC774\uD648</button>'+
    '<button class="ds-tab" data-dstab="friend" type="button">\uCE5C\uAD6C</button>'+
    '<button class="ds-tab" data-dstab="sched" type="button">\uC2A4\uCF00\uC904\uB7EC</button></div>'+
    '<div id="dsBody"></div>'+
    '<div id="dsFoot"><button id="dsResetAll" type="button">\u21BA \uC804\uCCB4 \uCD08\uAE30\uD654</button>'+
    '<span style="flex:1;"></span><button id="dsDone" type="button">\uC644\uB8CC</button></div>'+
    '</body></html>';
  /* ══ 👑 디자인 프리셋 (라이선스 전용) ══════════════════════════════════════
     프리셋 한 칸 = **디자인 한 벌 통째**다. 마이홈·친구·스케줄러 세 탭의 색이 한 덩어리로 들어간다.
     저장 자리: _myHomeData.themePresets (3칸) · themePresetCur (지금 고른 칸)
       → users/{uid}/home 아래로 그대로 따라간다. **DB 규칙은 손댈 것이 없다** —
         그쪽 .validate 는 bio·post·postTitle·avatar 넷에만 걸려 있어 새 자식은 그대로 통과한다.

     ★★ 그림은 담지 않는다 — 용량 때문이 아니라 **덮어쓰기 때문이다.**
        디자인 스튜디오의 이미지는 이제 base64 가 아니라 Storage URL 인데(uploadUserImage),
        올리는 자리가 항목당 **고정 슬롯 하나**다(`users/{uid}/bg.jpg`, `users/{uid}/{imgKey}`).
        즉 프리셋 세 벌이 같은 파일 한 개를 가리키게 되고, 2번 프리셋에서 배경 그림을 바꾸면
        1번·3번의 그림까지 같이 바뀐다. 프리셋마다 다른 그림을 가지려면 슬롯 이름을 프리셋별로
        나누고 지우는 시점까지 관리해야 하는데, 그건 이 기능의 몫이 아니다.
     ⚠️ 그래서 불러오기는 **그림을 건드리지 않는다**. 색만 갈리고 지금 깔린 그림은 그대로 남는다.
       이 성질을 바꾸려면 위 슬롯 문제부터 풀 것. */
  const MH_PRESET_MAX = 3;
  const MH_PRESET_NAME_MAX = 8;   // 세 칸이 340px 안에 나란히 서므로 길면 잘린다
  /* 그림 키 목록은 **_MH_DS_ROWS 에서 뽑아 쓴다.** 여기에 다시 적으면 항목이 늘 때마다 한쪽만
     고쳐지고, 빠뜨린 그림 키가 프리셋에 섞여 들어간다(그 순간 위 덮어쓰기 문제가 터진다). */
  function _mhImgKeySet(){
    const s = new Set();
    Object.keys(_MH_DS_ROWS).forEach(tab=>{
      (_MH_DS_ROWS[tab]||[]).forEach(row=>{ if(row && row.img && !row.group) s.add(_mhDsImgKeyOf(row)); });
    });
    return s;
  }
  /* 저장본을 항상 3칸 배열로 씻어서 돌려준다.
     ⚠️ Realtime DB 는 빈 자리가 있는 배열을 {0:…, 2:…} 객체로 되돌려준다 — 배열로 단정하면
       두 칸만 저장한 사람의 목록이 통째로 사라진다(이 코드베이스의 entriesForCat 과 같은 사정). */
  function _mhPresets(){
    const out = new Array(MH_PRESET_MAX).fill(null);
    const raw = _myHomeData() && _myHomeData().themePresets;
    if(!raw || typeof raw !== 'object') return out;
    for(let i = 0; i < MH_PRESET_MAX; i++){
      const p = raw[i];
      if(!p || typeof p !== 'object') continue;
      out[i] = {
        name : String(p.name || '').slice(0, MH_PRESET_NAME_MAX),
        theme: (p.theme && typeof p.theme === 'object') ? p.theme : {},
        bg   : (p.bg && p.bg.color) ? { color: p.bg.color } : null,
      };
    }
    return out;
  }
  function _mhPresetCur(){
    const n = parseInt(_myHomeData() && _myHomeData().themePresetCur, 10);
    return (n >= 0 && n < MH_PRESET_MAX) ? n : 0;
  }
  function _mhPresetLabel(i){
    const p = _mhPresets()[i];
    return (p && p.name) || String(i + 1);
  }
  /* 칸에 찍는 점 하나 — 바깥 배경색이 그 디자인을 가장 잘 대표한다.
     그것이 없으면(그림을 깔았거나 안 정했으면) 탭·패널 색으로 물러난다. 셋 다 없으면 빈 점. */
  function _mhPresetDot(p){
    if(!p) return '';
    return (p.bg && p.bg.color) || (p.theme && (p.theme.tab || p.theme.left || p.theme.right)) || '';
  }
  /* 지금 화면의 디자인을 i 번 칸에 담는다 — **색만.** */
  function _mhPresetSave(i){
    const imgKeys = _mhImgKeySet();
    const t = _myHomeData().theme || {};
    const theme = {};
    Object.keys(t).forEach(k=>{ if(!imgKeys.has(k) && t[k]) theme[k] = t[k]; });
    const arr = _mhPresets();
    arr[i] = {
      name : (arr[i] && arr[i].name) || '',
      theme,
      bg   : (_myHomeData().bg && _myHomeData().bg.color) ? { color: _myHomeData().bg.color } : null,
    };
    _myHomeData().themePresets = arr;
    _myHomeData().themePresetCur = i;
    commitMyHomePage(true);
    toast('👑 ' + _mhPresetLabel(i) + ' 에 저장했어요');
  }
  /* i 번 칸의 디자인을 화면에 얹는다.
     ★ 색은 **통째로 갈린다** — 프리셋에 없는 색은 지운다. 얹기만 하면 이전 디자인의 색이
       남아 섞이고, 같은 프리셋을 불러도 어디서 왔는지 모를 색이 하나씩 붙는다.
     ⚠️ 그림 키(*Img)와 배경 그림은 **손대지 않는다**(위 ★★ 참고). */
  function _mhPresetApply(i){
    const p = _mhPresets()[i];
    if(!p) return false;
    const imgKeys = _mhImgKeySet();
    const cur = _myHomeData().theme || {};
    const next = {};
    Object.keys(cur).forEach(k=>{ if(imgKeys.has(k)) next[k] = cur[k]; });   // 그림은 그대로 살린다
    Object.keys(p.theme || {}).forEach(k=>{ if(!imgKeys.has(k)) next[k] = p.theme[k]; });
    _myHomeData().theme = next;
    /* 바깥 배경 — 지금 그림이 깔려 있으면 건드리지 않는다. bg 는 color 와 img 가 배타적이라
       색을 넣는 순간 그림이 사라지는데, 그건 "그림은 그대로 남는다"는 약속을 깨는 것이다. */
    if(!(_myHomeData().bg && _myHomeData().bg.img)){
      _myHomeData().bg = (p.bg && p.bg.color) ? { color: p.bg.color } : null;
    }
    _myHomeData().themePresetCur = i;
    if(typeof window._mhApplyBg === 'function') window._mhApplyBg();
    window._mhApplyTheme();
    commitMyHomePage(true);
    toast('👑 ' + _mhPresetLabel(i) + ' 로 바꿨어요');
    return true;
  }
  /* ✏️ 프리셋 이름을 쓰는 **유일한 곳**. 비우면 자리 번호로 돌아간다. */
  function _mhPresetRename(i, raw){
    const v = String(raw == null ? '' : raw).trim().slice(0, MH_PRESET_NAME_MAX);
    const arr = _mhPresets();
    if(!arr[i]) arr[i] = { name:'', theme:{}, bg:null };
    if(arr[i].name === v) return false;
    arr[i].name = v;
    _myHomeData().themePresets = arr;
    commitMyHomePage(true);
    return true;
  }
  /* 되돌릴 수 없는 동작은 그 자리에서 한 번 더 묻는다 — [↺ 전체 초기화]가 쓰는 방식 그대로다.
     ⚠️ 네이티브 확인 대화상자를 쓰지 말 것. Electron 투명 창에서는 렌더러를 블로킹한 채 다이얼로그가 안 보여
       "앱이 멈춘 것"으로 보인다(audit 검사 4 가 그걸 본다). */
  let _mhDsArmed = null, _mhDsArmT = null;
  function _mhDsArm(key, fn){
    if(_mhDsArmed === key){
      clearTimeout(_mhDsArmT); _mhDsArmed = null; _mhDsArmT = null;
      fn();
      return;
    }
    clearTimeout(_mhDsArmT);
    _mhDsArmed = key;
    _mhDsArmT = setTimeout(()=>{ _mhDsArmed = null; _mhDsRenderPresets(); }, 3000);
    _mhDsRenderPresets();
  }
  /* 프리셋 줄을 그린다 — 칸 셋 + [저장] 하나가 전부다.
       · 빈 칸을 누르면  → 그 칸을 고르기만 한다(잃을 게 없으므로 확인 없음)
       · 다른 칸을 누르면 → 한 번 더 눌러야 불러온다
       · 고른 칸을 누르면 → 이름 고치기(입력칸으로 갈아낌)
       · [저장]           → 고른 칸에 덮어쓰기. 빈 칸이면 확인 없이 바로 담는다 */
  function _mhDsRenderPresets(){
    if(!_mhDsWin || _mhDsWin.closed) return;
    const d = _mhDsWin.document;
    const line = d.getElementById('dsPresets'); if(!line) return;
    const arr = _mhPresets(), cur = _mhPresetCur();
    line.innerHTML = '<span class="ps-cap">프리셋</span>';
    for(let i = 0; i < MH_PRESET_MAX; i++){
      const p = arr[i], isCur = (i === cur);
      const tab = d.createElement('span');
      tab.className = 'ps-tab' + (isCur ? ' cur' : '');
      if(_mhDsArmed === 'load:' + i){
        tab.classList.add('armed');
        tab.textContent = '한 번 더';
      } else {
        /* ⚠️ 저장된 색 문자열을 style 속성에 **문자열로 끼워 넣지 않는다.**
           그 값은 서버에서 내려온 것이라 색이 아닌 것이 들어 있을 수 있다 — 속성으로 직접 쓰면
           브라우저가 알아서 거른다(audit 검사 19 가 보는 자리다). */
        const dot = _mhPresetDot(p);
        tab.innerHTML = '<i class="ps-dot"></i><span class="ps-nm' + (p && p.name ? '' : ' empty') + '"></span>';
        if(dot) tab.querySelector('.ps-dot').style.background = dot;
        tab.querySelector('.ps-nm').textContent = _mhPresetLabel(i);
        tab.title = isCur ? (_mhPresetLabel(i) + ' — 지금 이 디자인 (한 번 더 누르면 이름 고치기)')
                  : (p ? (_mhPresetLabel(i) + ' 로 바꾸기') : ((i + 1) + '번 빈 칸 — 눌러서 고른 뒤 [저장]'));
      }
      tab.addEventListener('click', ()=>{
        if(isCur){ _mhDsStartRename(tab, i); return; }
        if(!p){                                   // 빈 칸 — 고르기만 한다
          _myHomeData().themePresetCur = i;
          commitMyHomePage(true);
          _mhDsRenderPresets();
          toast('👑 ' + (i + 1) + '번 칸을 골랐어요 — [저장]을 누르면 여기에 담겨요');
          return;
        }
        _mhDsArm('load:' + i, ()=>{ _mhPresetApply(i); _mhDsRender(); });
      });
      line.appendChild(tab);
    }
    const save = d.createElement('span');
    save.className = 'ps-save' + (_mhDsArmed === 'save' ? ' armed' : '');
    save.textContent = _mhDsArmed === 'save' ? '한 번 더' : '저장';
    save.title = _mhPresetLabel(cur) + ' 에 지금 디자인 담기 (색만 — 그림은 안 담겨요)';
    save.addEventListener('click', ()=>{
      /* 빈 칸에는 덮어쓸 것이 없으므로 그냥 담는다. 되돌릴 수 없는 것만 두 번 묻는다. */
      if(!arr[cur]){ _mhPresetSave(cur); _mhDsRenderPresets(); return; }
      _mhDsArm('save', ()=>{ _mhPresetSave(cur); _mhDsRenderPresets(); });
    });
    line.appendChild(save);
  }
  /* ✏️ 그 칸을 입력칸으로 갈아낀다 — 플레이리스트 프리셋 이름과 같은 규약이다:
     Enter 저장 · Esc 취소 · 포커스를 잃으면 저장.
     ⚠️ 끝나면 DOM 을 손으로 되돌리지 않고 _mhDsRenderPresets 로 통째로 다시 그린다. */
  function _mhDsStartRename(tab, i){
    if(!_mhDsWin || _mhDsWin.closed) return;
    const d = _mhDsWin.document;
    const p = _mhPresets()[i];
    const inp = d.createElement('input');
    inp.type = 'text'; inp.className = 'ps-edin';
    inp.maxLength = MH_PRESET_NAME_MAX; inp.spellcheck = false;
    inp.value = (p && p.name) || '';
    inp.placeholder = String(i + 1);
    tab.replaceWith(inp);
    let done = false;
    const end = save=>{
      if(done) return;
      done = true;
      if(save) _mhPresetRename(i, inp.value);
      _mhDsRenderPresets();
    };
    inp.addEventListener('blur', ()=>end(true));
    inp.addEventListener('keydown', e=>{
      e.stopPropagation();
      if(e.key === 'Enter'){ e.preventDefault(); end(true); }
      else if(e.key === 'Escape'){ e.preventDefault(); end(false); }
    });
    inp.focus(); inp.select();
  }

  function _mhDsImgKeyOf(row){ return row.imgKey || (row.key+'Img'); }
  function _mhDsRender(){
    if(!_mhDsWin || _mhDsWin.closed) return;
    const d=_mhDsWin.document;
    const body=d.getElementById('dsBody'); if(!body) return;
    /* 👑 프리셋 줄도 같은 자리에서 다시 받는다 — 색을 하나 바꿔도 칸의 점이 따라와야 한다.
       ⚠️ 부르는 자리를 여기 하나로 모은다. 항목마다 따로 부르면 한 곳씩 빠뜨린다. */
    _mhDsRenderPresets();
    const t=_myHomeData().theme||{};
    body.innerHTML='';
    (_MH_DS_ROWS[_mhDsTab]||[]).forEach(row=>{
      if(row.group){ const g=d.createElement('div'); g.className='ds-group'; g.textContent=row.group; body.appendChild(g); return; }
      const r=d.createElement('div'); r.className='ds-row';
      // special:'bg'는 _myHomeData.bg에, 나머지는 _myHomeData.theme에 저장
      const isBg = row.special==='bg';
      const cur = isBg ? ((_myHomeData().bg && _myHomeData().bg.color) || '') : (t[row.key]||'');
      const imgKey=_mhDsImgKeyOf(row);
      const hasImg = isBg ? !!(_myHomeData().bg && _myHomeData().bg.img) : !!t[imgKey];
      r.innerHTML='<span class="lb">'+row.label+'</span>'
        +'<span class="ds-sw'+(cur?'':' none')+'" style="'+(cur?('background:'+cur+';'):'')+'" title="색상 선택"></span>'
        +(row.img?('<button type="button" class="ds-btn'+(hasImg?' imgon':'')+'" data-act="img" title="이미지 URL">IMG</button>'):'')
        +'<button type="button" class="ds-btn" data-act="reset" title="이 항목 초기화">↺</button>';
      const sw=r.querySelector('.ds-sw');
      sw.addEventListener('click', ()=>{
        if(window.companion && companion.dsHold) companion.dsHold();   // 팝업 열리는 동안 blur-닫힘 유예
        window._mhOpenColorPopup(sw, 'theme', (c)=>{
          if(isBg){ _myHomeData().bg = { color: c }; if(typeof window._mhApplyBg==='function') window._mhApplyBg(); }
          else { _myHomeData().theme=_myHomeData().theme||{}; _myHomeData().theme[row.key]=c; window._mhApplyTheme(); }
          commitMyHomePage(true); _mhDsRender();
        }, ()=>{
          if(isBg){ _myHomeData().bg=null; if(typeof window._mhApplyBg==='function') window._mhApplyBg(); }
          else if(_myHomeData().theme){ delete _myHomeData().theme[row.key]; window._mhApplyTheme(); }
          commitMyHomePage(true); _mhDsRender();
        }, d);   // ★ 팝업을 child 문서 안에 렌더
      });
      const imgBtn=r.querySelector('[data-act="img"]');
      if(imgBtn) imgBtn.addEventListener('click', async ()=>{
        // 값 적용 헬퍼 (Storage URL을 배경/패널에 반영)
        const applyUrl = (url)=>{
          if(isBg){
            if(!url){ _myHomeData().bg=null; } else { _myHomeData().bg={img:url}; }
            if(typeof window._mhApplyBg==='function') window._mhApplyBg();
          } else {
            _myHomeData().theme=_myHomeData().theme||{};
            if(!url){ delete _myHomeData().theme[imgKey]; } else { _myHomeData().theme[imgKey]=url; }
            window._mhApplyTheme();
          }
          commitMyHomePage(true); _mhDsRender();
        };
        // IMG 클릭 = OS 네이티브 파일 선택 (별도 창에서 input.click()이 무시되는 문제 회피)
        if(!window.companion || !companion.pickImage){ toast('이미지 선택을 지원하지 않는 버전이에요'); return; }
        if(companion.dsHold) companion.dsHold();
        const srcDataUrl = await companion.pickImage();   // 취소 시 null
        if(!srcDataUrl) return;
        if(!window.firebaseAPI || !firebaseAPI.uploadUserImage){ toast('네트워크 연결이 필요해요'); return; }
        const img=new Image();
        img.onload=async ()=>{
          const scale = isBg
            ? Math.min(1, DS_IMG_MAX_BG_W/img.width, DS_IMG_MAX_BG_H/img.height)
            : Math.min(1, DS_IMG_MAX_PANEL/Math.max(img.width, img.height));
          const c=document.createElement('canvas');
          c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          const dataUrl=c.toDataURL('image/jpeg', DS_IMG_QUALITY);
          const kb = Math.round(dataUrl.length * 0.75 / 1024);
          toast(`이미지를 올리는 중… (${c.width}×${c.height}, 약 ${kb}KB)`);
          try{
            const slot = isBg ? 'bg' : String(imgKey);
            const res = await firebaseAPI.uploadUserImage(getMyUserId(), slot, dataUrl);
            if(res && res.ok){ applyUrl(res.url); toast(`이미지를 등록했어요 (${c.width}×${c.height}, 약 ${kb}KB)`); }
            else toast((res && res.reason) || '업로드에 실패했어요');
          }catch(err){ toast('업로드에 실패했어요'); }
        };
        img.onerror=()=>toast('이미지를 불러오지 못했어요');
        img.src=srcDataUrl;
      });
      r.querySelector('[data-act="reset"]').addEventListener('click', ()=>{
        if(isBg){ _myHomeData().bg=null; if(typeof window._mhApplyBg==='function') window._mhApplyBg(); }
        else if(_myHomeData().theme){ delete _myHomeData().theme[row.key]; delete _myHomeData().theme[imgKey]; window._mhApplyTheme(); }
        commitMyHomePage(true); _mhDsRender();
      });
      body.appendChild(r);
    });
  }
  function _mhOpenDesignStudio(){
    if(_mhDsWin && !_mhDsWin.closed){ try{ _mhDsWin.focus(); }catch(_){} _mhDsRender(); return; }
    _mhDsWin = window.open('', 'mhDesign_'+Date.now(), 'width=340,height=580');
    if(!_mhDsWin){ toast('디자인 창을 열 수 없어요'); return; }
    const d=_mhDsWin.document;
    d.open(); d.write(DS_HTML); d.close();
    applyThemeToChildDoc(d);   // 🎨 [제보 5] 방명록과 같은 구조(별도 BrowserWindow)
    d.getElementById('dsClose').onclick=()=>{ try{ _mhDsWin.close(); }catch(_){} };
    d.getElementById('dsDone').onclick=()=>{ commitMyHomePage(true); try{ _mhDsWin.close(); }catch(_){} };
    // ★ confirm()은 Electron 투명 창에서 렌더러를 블로킹한 채 다이얼로그가 안 보여
    //   "멈춘 것처럼" 되는 문제가 있음 → 블로킹 없는 2단계 클릭 확인으로 대체.
    (function(){
      const btn = d.getElementById('dsResetAll');
      let armed = false, timer = null;
      btn.onclick = ()=>{
        if(!armed){
          armed = true;
          btn.textContent = '⚠ 한 번 더 누르면 전체 초기화';
          btn.style.color = '#c0392b';
          timer = setTimeout(()=>{ armed=false; btn.textContent='↺ 전체 초기화'; btn.style.color=''; }, 3000);
          return;
        }
        clearTimeout(timer); armed = false;
        btn.textContent = '↺ 전체 초기화'; btn.style.color='';
        /* 👑 저장해둔 프리셋(themePresets)은 **안 지운다.** 여기서 지우는 것은 '지금 화면의
           디자인' 하나다 — 초기화했다고 모아둔 한 벌까지 날아가면 되돌릴 길이 없다.
           프리셋을 지우는 길은 그 칸에 다시 [저장]하는 것이다. */
        _myHomeData().theme=null; _myHomeData().bg=null;
        if(typeof window._mhApplyBg==='function') window._mhApplyBg();
        window._mhApplyTheme(); commitMyHomePage(true); _mhDsRender();
        toast('디자인을 전부 초기화했어요');
      };
    })();
    d.querySelectorAll('.ds-tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        d.querySelectorAll('.ds-tab').forEach(b=>b.classList.toggle('on', b===btn));
        _mhDsTab=btn.dataset.dstab;
        // 편집 대상 페이지로 마이홈 탭도 같이 전환 — 실시간 미리보기가 눈에 보이게
        const mhTabName = _mhDsTab==='friend' ? 'friend' : (_mhDsTab==='sched' ? 'scheduler' : 'home');
        const mhTab=document.querySelector('.mh-tab[data-tab="'+mhTabName+'"]');
        if(mhTab) mhTab.click();
        _mhDsRender();
      });
    });
    _mhDsTab='home';
    _mhDsRender();
  }
  // 채팅 닫기 버튼은 수령함 도입으로 제거됨

return {
  commit: commitMyHomePage,              // 💾 자동 저장(window.commitMyHomePage 와 같은 함수)
  openColorPopup: _mhOpenColorPopup,     // 🎨 색 고르기 팝업
  beginNameEdit: _mhBeginNameEdit,       // 🏷️ 닉네임 인라인 편집
  beginPostTitleEdit: _mhBeginPostTitleEdit,
  bgmRefresh: _bgmLabelRefresh,          // 🎵 BGM 위젯 표시
  bgmDestroy: _bgmDestroy,
  applyBg: applyMyHomeBg,                // 🖼️ 바깥 배경
  applyTheme: applyMyHomeTheme,          // 🎨 영역별 테마
  openDesignStudio: _mhOpenDesignStudio, // 👑 디자인 스튜디오
  presets: _mhPresets,                   // 👑 디자인 프리셋(검사용)
  presetSave: _mhPresetSave,
  presetApply: _mhPresetApply,
  presetRename: _mhPresetRename,
};
}

const api = { createMyHomeEdit };
if(typeof window !== 'undefined') window.TwMyHomeEdit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
