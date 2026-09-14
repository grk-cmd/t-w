/* ════════════════════════════════════════════════════════════════
   🐾 parts/animal.js — 동물 캐릭터 [1단계: 잠금 카드 + 생성 미리보기]
   ────────────────────────────────────────────────────────────────
   · Lv.100 달성 보상. 캐릭터 선택 창의 "동물" 카드를 활성화하고
     레벨 게이트를 건다 (관리자는 테스트를 위해 항상 통과).
   · 1단계 범위: 실제 base GLB(animal-glb.js)를 로드해 얼굴형 4종 선택과
     얼굴 크기(좌우/상하/전체)를 확인하는 미리보기 창.
     — 크기 조절은 head "본" 스케일 방식: 얼굴 메쉬는 스킨이라 노드 스케일이
       안 먹고, 본을 키워야 실제 게임 화면과 같은 결과가 나옴.
   · 다음 단계에서 이 창을 없애고 기존 생성기 탭(1 얼굴·2 귀·3 표정·4 감은눈)에
     통합 예정 — 승인된 UI 스펙 그대로.
   · app.js는 손대지 않음 — 카드 바인딩·창 생성 모두 이 파일이 처리.
   ════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const ANIMAL_VER='v0.4.0-p6 (860x440 / preview 360)';
console.log('[동물] animal.js '+ANIMAL_VER);

let UNLOCK_LEVEL = 50;   // ★ 기본값. 관리자가 서버(catalog/gameConfig)에서 바꾸면 아래 setter로 갱신된다.
/* 🔓 숨김 해금 — 종족 선택창에서 L키를 누른 채 동물 카드를 연속 클릭하면 레벨 제한 없이 열린다.
   한 번 해금되면 localStorage에 남아 계속 유지된다. */
const CHEAT_KEY = 'tw.animalCheatUnlock';
const CHEAT_CLICKS = 10;
let _lKeyDown=false, _cheatCount=0, _cheatLastAt=0;
function _cheatUnlocked(){ try{ return localStorage.getItem(CHEAT_KEY)==='1'; }catch(_){ return false; } }
/* 🔓 한 번이라도 해금 조건을 만족했으면 그 뒤로는 계속 열려 있다.
   관리자가 이벤트로 해금 레벨을 낮췄다가 되돌려도, 그동안 조건을 만족했던 사람은 잠기지 않는다.
   ★ 표시를 남기는 건 '레벨을 실제로 달성한 경우'뿐이다. 관리자 권한은 원래 항상 열려 있으니
     굳이 영구 표시를 남기지 않는다(권한이 사라지면 원래 상태로 돌아가는 게 맞다).
   ※ 레벨 자체가 기기별로 저장되는 값이라, 이 표시도 같은 기준(기기별)으로 남는다. */
const EVER_KEY = 'tw.animalEverUnlocked';
function _everUnlocked(){ try{ return localStorage.getItem(EVER_KEY)==='1'; }catch(_){ return false; } }
function _unlockOk(){
  if(myLevel() >= UNLOCK_LEVEL){
    try{ localStorage.setItem(EVER_KEY,'1'); }catch(_){}   // 조건 만족 시점에 표시를 남김
    return true;
  }
  return admin() || _cheatUnlocked() || _everUnlocked();
}
try{
  window.addEventListener('keydown', e=>{ if((e.key==='l'||e.key==='L')&&!e.repeat) _lKeyDown=true; });
  window.addEventListener('keyup',   e=>{ if(e.key==='l'||e.key==='L'){ _lKeyDown=false; _cheatCount=0; } });
  window.addEventListener('blur',    ()=>{ _lKeyDown=false; _cheatCount=0; });
}catch(_){}

let overlay=null, renderer=null, scene=null, cam=null, model=null;
let headBone=null, faceNodes=[], curFace=0, raf=0;
let earBoneL=null, earBoneR=null;        // base의 좌/우 귀 본
let handBoneL=null, handBoneR=null;      // base의 좌/우 손 본 — 미리보기 팔 각도를 실행화면과 맞추는 용도
let handRestL=null, handRestR=null;      // 손 본의 bind(rest) 쿼터니언
let earObjL=null, earObjR=null;          // 현재 부착된 귀 3D 오브젝트
let earAdjSide='L';                       // 조정 대상 쪽
let earGizmo=null, earGizmoMode='translate';   // TransformControls 인스턴스·모드
let _gizmoDragging=false;                        // 기즈모 드래그 중 — 미리보기 회전 잠금
/* 좌/우 귀 미세조정(기즈모 결과 저장).
   ★ sc(균일 배율) 하나만 저장하면 기즈모로 X/Y/Z를 따로 늘린 결과가 유실된다(복원 시 setScalar로 균일 적용됨).
     scx/scy/scz를 따로 들고, sc는 구버전 저장 데이터 호환용으로 남긴다(읽을 때 폴백). */
/* ★ 회전도 축이 셋이다. 예전엔 rot(=Z) **하나만** 저장했다 — 기즈모는 setSpace('local') 로
     X·Y·Z 링을 모두 내주는데, 저장되는 것은 Z 뿐이었다.
     [무엇이 터졌나] 접힌 귀를 앞뒤로 눕히는 조정(주로 X·Y)이 편집 화면에서는 보이는데
       — wrap 에 실제로 적용돼 있으니까 — 저장하고 다시 지으면 rot(Z) 만 복원되어 **통째로 사라졌다.**
       제보의 «편집중에서의 귀 vs 저장후에서의 귀» 가 정확히 이것이다.
     [왜 대칭 복사도 어긋났나] 대칭은 rot 만 부호를 뒤집었고 X·Y 는 존재 자체를 몰랐다.
       반대쪽 귀에 남아 있던 옛 X·Y 회전은 그대로 남아 «일부만 따라오는» 모양이 됐다.
   ⚠️ 옛 저장본에는 rx·ry 가 없다 — _earRot 이 0 으로 폴백하므로 지금까지와 똑같이 보인다. */
const EAR_ADJ_DEFAULT = {px:0,py:0,pz:0,rot:0,rx:0,ry:0,sc:1,scx:1,scy:1,scz:1};
function _earAdjNew(){ return Object.assign({}, EAR_ADJ_DEFAULT); }
/* 저장된 조정값에서 회전 세 축을 뽑는다 — rot 은 Z 다(이름을 못 바꾼다: 옛 저장본의 키다) */
function _earRot(a){
  return { x:(a && a.rx  != null) ? a.rx  : 0,
           y:(a && a.ry  != null) ? a.ry  : 0,
           z:(a && a.rot != null) ? a.rot : 0 };
}
/* 저장된 조정값에서 축별 배율을 뽑는다 — scx/scy/scz가 없으면(구버전) sc로 폴백 */
function _earScale(a){
  const u = (a && a.sc != null) ? a.sc : 1;
  return { x:(a && a.scx != null) ? a.scx : u,
           y:(a && a.scy != null) ? a.scy : u,
           z:(a && a.scz != null) ? a.scz : u };
}
const earAdj={ L:_earAdjNew(), R:_earAdjNew() };
const _earLoader = (typeof loader!=='undefined' && loader) ? loader : (typeof THREE!=='undefined' ? new THREE.GLTFLoader() : null);
const _earCache = {};                    // key(ear_cat_L 등) → 파싱된 scene (복제해서 사용)
/* ★ rotY 0 = 정면. 예전엔 -0.4(약 -23°)로 비스듬히 시작해서 표정·무늬를 그릴 때 얼굴이
   비뚤어 보였다. 인간 생성기는 camYaw=0(정면)으로 시작하므로 거기에 맞춘다.
   (드래그로 돌리는 건 그대로 되고, ⟳ 리셋도 정면으로 돌아온다) */
let rotY=0, rotX=0, dragging=false, lastX=0, lastY=0, _prevLauncherOn=false;
let _camDist=6.0;   // 상하 궤도 반경(직교라 크기 영향 없음)
let _zoom=1.0;      // 휠 줌 (0.5~2.6)
let panX=0, panY=0; // 방향키 카메라 평행이동
let scl={x:1, y:1, all:1};

function myLevel(){ try{ return (typeof getFocusLevel==='function') ? getFocusLevel() : 1; }catch(_){ return 1; } }
function admin(){ try{ return (typeof isAdmin!=='undefined') && !!isAdmin; }catch(_){ return false; } }

/* ── 카드 활성화: "공사중" → Lv.100 잠금 카드 ── */
let _rcR=null,_rcS=null,_rcC=null,_rcChar=null;
function renderAnimalCardThumb(){
  const cv=document.getElementById('raceAnimalCv'); if(!cv||typeof THREE==='undefined'||!window.ANIMAL_GLB_B64) return;
  if(!_rcR){
    _rcR=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true});   // 인간 카드와 동일 — 도트 느낌
    _rcR.setPixelRatio(1); _rcR.outputEncoding=THREE.sRGBEncoding;
    cv.style.imageRendering='pixelated';
    _rcS=new THREE.Scene();
    _rcS.add(new THREE.AmbientLight(0xfdfbf7,0.95));
    const k=new THREE.DirectionalLight(0xfdfaf5,1.0); k.position.set(0,4,0); _rcS.add(k);
    _rcC=new THREE.PerspectiveCamera(32,1,0.1,100); _rcC.position.set(0,0.9,3.5); _rcC.lookAt(0,0.7,0);   // 더 멀리·아래를 봐서 몸 전체가 프레임에
  }
  const SCALE=0.4, rw=Math.max(2,Math.round(160*SCALE));   // 인간 카드와 같은 도트 배율
  _rcR.setSize(rw,rw,false); cv.style.width='160px'; cv.style.height='160px';
  if(!_rcChar){
    try{
      const bin=atob(window.ANIMAL_GLB_B64); const buf=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      const ld=(typeof loader!=='undefined'&&loader)?loader:new THREE.GLTFLoader();
      ld.parse(buf.buffer,'',(g)=>{
        _rcChar=g.scene;
        _rcChar.traverse(o=>{ if(o.isMesh&&o.material){ o.material=o.material.clone(); o.material.color.set('#ffffff'); if('roughness'in o.material)o.material.roughness=0.85; if('metalness'in o.material)o.material.metalness=0; } });
        if(typeof normalizeModel==='function') normalizeModel(_rcChar,1.15);   // 전신이 카드에 들어오도록
        _rcChar.rotation.y=Math.PI;
        _rcS.add(_rcChar);
        _rcR.render(_rcS,_rcC);
      },(e)=>console.warn('[동물] 카드 썸네일 파싱 실패',e));
    }catch(e){ console.warn('[동물] 카드 썸네일 오류',e); }
  }
  _rcR.render(_rcS,_rcC);
}
function initCard(){
  const card=document.getElementById('raceAnimal');
  if(!card) return;
  card.classList.remove('disabled');
  renderAnimalCardThumb();
  setTimeout(renderAnimalCardThumb,300);   // GLB 로드 지연 대비
  card.removeAttribute('aria-disabled');
  // 해금됐으면(레벨 달성·관리자·숨김 해금 모두) 안내 띠 자체를 없애서 인간 카드처럼 깔끔하게 보여준다.
  const under=card.querySelector('.race-underwork');
  const _unlocked = _unlockOk();
  if(under){
    if(_unlocked){ under.style.display='none'; }
    else{ under.style.display=''; under.textContent='🔒 Lv.'+UNLOCK_LEVEL+' 달성 시 해금'; }
  }
  card.title = _unlocked ? '동물 캐릭터 만들기' : ('동물 캐릭터 만들기 (Lv.'+UNLOCK_LEVEL+' 보상)');
  card.style.cursor='pointer';
  card.onclick=()=>{
    const lv=myLevel();
    if(!_unlockOk()){
      // 🔓 숨김 해금 — L키를 누른 채 이 카드를 10번 연속 클릭. 중간에 L을 떼거나 2초 이상 쉬면 리셋.
      if(_lKeyDown){
        const now=Date.now();
        if(now - _cheatLastAt > 2000) _cheatCount=0;
        _cheatLastAt=now; _cheatCount++;
        if(_cheatCount >= CHEAT_CLICKS){
          _cheatCount=0;
          try{ localStorage.setItem(CHEAT_KEY,'1'); }catch(_){}
          initCard();   // 잠금 안내 문구 갱신
          if(typeof toast==='function') toast('🔓 동물 캐릭터가 해금됐어요!');
          // ★ 이 경로도 '신규 생성'이다 — 아래 정상 경로와 동일하게 컨텍스트를 초기화하고
          //   [＋]가 정한 칸을 받아둔다. 안 하면 직전 편집의 타깃이 남아 엉뚱한 칸에 저장될 수 있음.
          _editSrcDef=null; _editSeat=null;
          _targetSlot = (typeof window.__twRaceTargetSlot==='number') ? window.__twRaceTargetSlot : null;
          _resetAnimalState();
          openPreview();
          return;
        }
        if(typeof toast==='function') toast('🔓 '+_cheatCount+' / '+CHEAT_CLICKS);
        return;
      }
      if(typeof toast==='function') toast('🔒 동물 캐릭터는 Lv.'+UNLOCK_LEVEL+' 달성 보상이에요 (현재 Lv.'+lv+')');
      return;
    }
    _editSrcDef=null; _editSeat=null;   // 신규 생성 — 이전 편집 컨텍스트가 남아있으면 엉뚱한 슬롯/좌석에 덮어씀
    // app.js가 openRacePicker(칸번호)에서 window에 실어 보낸 값 (IIFE라 window 경유만 가능)
    _targetSlot = (typeof window.__twRaceTargetSlot==='number') ? window.__twRaceTargetSlot : null;
    _resetAnimalState();                // 직전에 만든 동물의 얼굴·귀·페인트가 그대로 남아있지 않게 초기화
    openPreview();
  };
}

/* ── 생성 창 — 인간 생성기(#creatorModal)와 동일한 클래스·구조를 그대로 사용 ── */
function ensureStyle(){
  if(document.getElementById('animalCreatorStyle')) return;
  const st=document.createElement('style');
  st.id='animalCreatorStyle';
  st.textContent = `
    /* 인간 생성기(#creatorOverlay)와 완전히 동일한 배경 규칙 —
       일반 창 모드: 어두운 막(아래 회색 body가 비치지 않게), 데스크탑 모드: 투명 */
    #animalCreatorOverlay{background:rgba(0,0,0,.35);}
    body.desktop #animalCreatorOverlay{background:transparent !important;}
    /* 동물 생성 창이 열려 있는 동안 미니 상태칩 숨김 — 기존 칩 표시 판정은 #creatorOverlay만 검사해서
       주기 갱신이 다시 켜버릴 수 있으므로 CSS로 확실하게 누름 */
    body.animal-creator #myStatusChip{display:none !important;}
    /* 미리보기 확장 — 동물 창에서만 decor-left를 340px로 (모델이 커서 넓게 보여야 함) */
    #animalCreatorOverlay .decor-left{width:360px;}
    /* 도장 오버레이 — 인간 #stampOverlay와 동일 규칙 */
    #anpStampOverlay{position:absolute;z-index:6;pointer-events:none;transform-origin:50% 50%;}
    #anpStampOverlayImg{width:100%;height:100%;pointer-events:auto;cursor:move;opacity:.85;user-select:none;}
    #animalCreatorOverlay .creator-right{padding:10px 12px;gap:7px;}
    #animalCreatorOverlay .cr-groupbox{padding:10px 10px 8px;}
  `;
  document.head.appendChild(st);
}
function buildOverlay(){
  if(overlay) return overlay;
  ensureStyle();
  overlay=document.createElement('div');
  overlay.id='animalCreatorOverlay';
  // 배경·칩 숨김 규칙은 ensureStyle()의 CSS가 담당 (인간 생성기와 동일 규칙)
  overlay.style.cssText='position:fixed;inset:0;z-index:56;display:none;align-items:center;justify-content:center;';
  overlay.innerHTML=
    '<div style="width:860px;max-width:100vw;height:calc(100vh - 4px);max-height:440px;'
    +'background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    +'box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 3px 3px 0 rgba(0,0,0,.35);'
    +'overflow:hidden;display:flex;flex-direction:column;">'
    +'<div class="decor-top"><h2>캐릭터 만들기 — 동물</h2><button id="anpClose">×</button></div>'
    +'<div class="decor-body">'
      +'<div class="decor-left" style="width:360px;flex:none;">'
        +'<button id="anpPresetBtn" type="button" title="프리셋 저장/불러오기" style="position:absolute;top:6px;left:6px;z-index:5;padding:4px 8px;font-size:11px;cursor:pointer;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);font-family:Tahoma,sans-serif;color:var(--ink);">📐 프리셋</button>'
        +'<div id="anpPresetPopup" style="display:none;position:absolute;top:34px;left:6px;z-index:6;background:var(--win-face);padding:10px;min-width:200px;border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);box-shadow:3px 3px 0 rgba(0,0,0,.35);font-family:Tahoma,sans-serif;"><div style="font-size:12px;font-weight:bold;color:var(--ink);margin-bottom:6px;">프리셋 저장/불러오기</div><div id="anpPresetSlots" style="display:flex;gap:5px;"></div><div style="font-size:10px;color:#8a8a8a;margin-top:5px;">클릭 = 불러오기 · 우클릭 = 저장/삭제</div></div>'
        +'<button id="anpResetBtn" title="카메라 앵글 초기화" style="position:absolute;left:8px;bottom:8px;z-index:4;width:28px;height:28px;font-size:14px;line-height:1;cursor:pointer;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2);color:var(--ink);display:flex;align-items:center;justify-content:center;">↺</button>'
        +'<canvas id="anpCv" style="width:360px;height:398px;background:#e9e9ec;cursor:default;"></canvas>'
        +'<div id="anpStampOverlay" style="display:none;">'
          +'<img id="anpStampOverlayImg" draggable="false">'
          +'<div class="stamp-handle stamp-h-tl"></div>'
          +'<div class="stamp-handle stamp-h-tr"></div>'
          +'<div class="stamp-handle stamp-h-bl"></div>'
          +'<div class="stamp-handle stamp-h-br"></div>'
          +'<div class="stamp-handle stamp-h-rot" title="회전 (Shift=15° 스냅)"></div>'
          +'<div class="stamp-rot-stem"></div>'
          +'<div class="stamp-h-reset" title="크기·회전 초기화">↺</div>'
        +'</div>'
        +'<button class="cp-arrow l" id="anpCamL" title="왼쪽으로 15°">&#9664;</button>'
        +'<button class="cp-arrow r" id="anpCamR" title="오른쪽으로 15°">&#9654;</button>'
        +'<button class="cp-arrow u" id="anpCamU" title="카메라 위로">&#9650;</button>'
        +'<button class="cp-arrow d" id="anpCamD" title="카메라 아래로">&#9660;</button>'+'<div id="anpGz" style="position:absolute;inset:0;pointer-events:none;"></div>'
        
      +'</div>'
      +'<div class="creator-right">'
        +'<div class="cr-steps" style="font-weight:700;">'
          +'<span class="on">캐릭터 세팅</span><span style="opacity:.45;" title="다음 단계에서 지원">책상 세팅</span><span style="opacity:.45;" title="다음 단계에서 지원">좌석 세팅</span>'
        +'</div>'
        +'<div class="cr-steps" id="anpTabs" style="font-size:11px;opacity:.95;">'
          +'<span class="on" data-tab="face">1 얼굴</span><span data-tab="ear">2 귀</span><span data-tab="paint">3 표정</span><span data-tab="blink">4 감은눈</span>'
        +'</div>'
        +'<div id="anpBody" style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px;">'
        +'<div id="anpPanelFace">'
        +'<div class="cr-groupbox">'
          +'<span class="cr-groupbox-label">얼굴형을 골라주세요</span>'
          +'<div class="skin-row" id="anpFaces"></div>'
        +'</div>'
        +'<div class="cr-groupbox">'
          +'<span class="cr-groupbox-label">얼굴 크기</span>'
          +'<div style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--ink);">'
          +'<label style="display:flex;align-items:center;gap:8px;">좌우&nbsp;크기 <input type="range" id="anpSx" min="0.6" max="1.5" step="0.01" value="1" style="flex:1;"> <b id="anpSxV" style="width:34px;text-align:right;">1.00</b>'+'<button class="cr-mini" data-rst="x" title="초기화" style="padding:1px 5px;font-size:10px;cursor:pointer;">↺</button></label>'
          +'<label style="display:flex;align-items:center;gap:8px;">상하&nbsp;크기 <input type="range" id="anpSy" min="0.6" max="1.5" step="0.01" value="1" style="flex:1;"> <b id="anpSyV" style="width:34px;text-align:right;">1.00</b>'+'<button class="cr-mini" data-rst="y" title="초기화" style="padding:1px 5px;font-size:10px;cursor:pointer;">↺</button></label>'
          +'<label style="display:flex;align-items:center;gap:8px;">전체&nbsp;크기 <input type="range" id="anpSa" min="0.6" max="1.5" step="0.01" value="1" style="flex:1;"> <b id="anpSaV" style="width:34px;text-align:right;">1.00</b>'+'<button class="cr-mini" data-rst="all" title="초기화" style="padding:1px 5px;font-size:10px;cursor:pointer;">↺</button></label>'
          +'</div>'
        +'</div>'
        +'</div>'/* /anpPanelFace */
        +'<div id="anpPanelEar" style="display:none;">'
          +'<div class="cr-groupbox">'
            +'<span class="cr-groupbox-label">왼쪽 귀</span>'
            +'<div class="skin-row" id="anpEarsL" style="flex-wrap:wrap;gap:5px;"></div>'
          +'</div>'
          +'<div class="cr-groupbox">'
            +'<span class="cr-groupbox-label">오른쪽 귀</span>'
            +'<div class="skin-row" id="anpEarsR" style="flex-wrap:wrap;gap:5px;"></div>'
          +'</div>'
          +'<div class="cr-groupbox" id="anpEarAdjBox" style="display:none;">'
            +'<span class="cr-groupbox-label"><span id="anpEarAdjSide">왼쪽</span> 귀 — 미리보기에서 직접 조정</span>'
            +'<div style="display:flex;gap:4px;margin-bottom:6px;">'
              +'<button class="skin-sw on" id="anpEarSelL" style="flex:1;height:26px;font-size:11px;">◀ 왼쪽 귀</button>'
              +'<button class="skin-sw" id="anpEarSelR" style="flex:1;height:26px;font-size:11px;">오른쪽 귀 ▶</button>'
            +'</div>'
            +'<div style="display:flex;gap:4px;">'
              +'<button class="skin-sw on" data-gz="translate" style="flex:1;height:26px;font-size:11px;" title="이동">✥ 이동</button>'
              +'<button class="skin-sw" data-gz="rotate" style="flex:1;height:26px;font-size:11px;" title="회전">↻ 회전</button>'
              +'<button class="skin-sw" data-gz="scale" style="flex:1;height:26px;font-size:11px;" title="크기">⤢ 크기</button>'
              +'<button class="skin-sw" id="anpEarAdjReset" style="flex:none;width:30px;height:26px;font-size:12px;" title="이 귀의 이동·회전·크기 조정을 처음으로">↺</button>'
            +'</div>'
            +'<button class="lc-btn" id="anpEarMirror" style="width:100%;margin-top:6px;font-size:11px;">⇆ 반대쪽 귀에 좌우대칭으로 복사</button>'
            +'<div style="font-size:10.5px;color:var(--ink-soft);margin-top:5px;">미리보기의 귀에 뜬 핸들을 드래그하세요. 이동/회전/크기 모드를 위에서 전환해요.</div>'
          +'</div>'
          +'<div style="font-size:10.5px;color:var(--ink-soft);line-height:1.5;margin-top:4px;">좌·우 귀를 따로 골라요. 귀를 고르면 미리보기에 조정 핸들(기즈모)이 떠요.</div>'
        +'</div>'/* /anpPanelEar */
        +'<div id="anpPanelPaint" style="display:none;">'
          +'<div class="cr-groupbox">'
            +'<span class="cr-groupbox-label" id="anpPaintLabel">표정 + 몸 무늬 그리기</span>'
            +'<div class="cr-tools" id="anpTools">'
              +'<span class="cr-swatches" id="anpBrushColors"></span>'
              +'<input id="anpBrushCustom" type="color" value="#333333" title="브러시 색">'
              +'<label>굵기<input id="anpBrush" type="range" min="2" max="34" value="9" style="width:58px;vertical-align:middle;"></label>'
              +'<button id="anpSym" title="좌우 대칭 (X)">&#8651; 대칭</button>'
              +'<label id="anpEarMaskLbl" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--ink);cursor:pointer;white-space:nowrap;" title="체크하면 귀에만 칠해져요"><input type="checkbox" id="anpEarMask" style="width:auto;margin:0;">귀만</label>'
              +'<label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--ink);cursor:pointer;white-space:nowrap;" title="체크하면 얼굴에만 칠해져요 (몸·귀 잠금)"><input type="checkbox" id="anpFaceMask" style="width:auto;margin:0;">얼굴만</label>'
              +'<label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--ink);cursor:pointer;white-space:nowrap;" title="체크하면 몸에만 칠해져요 (얼굴·귀 잠금)"><input type="checkbox" id="anpBodyMask" style="width:auto;margin:0;">몸만</label>'
              +'<button id="anpUndo" title="되돌리기 (Ctrl+Z)">↶ 되돌리기</button>'
              +'<button id="anpEraser">지우개</button><button id="anpClear">지우기</button>'
              +'<button id="anpStampBtn" title="이미지 도장 (Z)">이미지</button>'
              +'<button id="anpCopyFace" title="표정을 다시 복사" style="display:none;">⟳ 표정 복사</button>'
              /* 🙂 반대 방향 — 3 표정 탭에서 감은눈 그림을 가져온다(인간 생성기 faceCopyBlinkBtn 과 짝).
                 ⚠️ 두 버튼은 자리를 나눠 쓴다 — 감은눈 탭에서는 ⟳ 표정 복사만, 표정 탭에서는 이것만
                   보인다(syncPaintUI 가 정한다). 둘이 같이 서면 어느 쪽이 어느 방향인지 헷갈린다. */
              +'<button id="anpCopyBlink" style="display:none;">⟳ 감은눈 복사</button>'
            +'</div>'
            +'<div id="anpStampPanel" style="display:none;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap;font-size:11px;">'
              +'<input id="anpStampFile" type="file" accept="image/*" style="display:none;">'
              +'<button id="anpStampLoad" style="padding:3px 8px;">📁 불러오기</button>'
              +'<img id="anpStampThumb" style="display:none;width:28px;height:28px;border:1px solid #c9a37b66;border-radius:6px;object-fit:contain;background:#fff;">'
              +'<button id="anpStampApply" style="padding:3px 8px;display:none;" title="여기에 찍기 (Enter)">&#10003; 찍기</button>'
              +'<button id="anpStampCancel" style="padding:3px 8px;display:none;" title="취소 (ESC)">&#10005; 취소</button>'
              /* ↺ 초기화 — 크기·회전·위치를 처음 불러온 상태로. 오버레이에도 같은 ↺(.anp-stamp-h-reset)가
                 있지만 그건 도장에 붙어 다녀서, 도장이 미리보기 밖으로 나가면 같이 사라져 누를 수가 없다(제보).
                 이 버튼은 패널 고정 자리라 그때도 남는다 — 인간 생성기(#stampReset)와 같은 배치다. */
              +'<button id="anpStampReset" style="padding:3px 8px;display:none;" title="크기·회전·위치를 처음 상태로">&#8634; 초기화</button>'
              +'<span style="color:var(--ink-soft);">이미지 위치를 잡아 Enter 또는 &#10003; 찍기 · Z=모드 켜기/끄기</span>'
            +'</div>'
            +'<div style="font-size:10.5px;color:var(--ink-soft);line-height:1.5;margin:4px 2px -2px;opacity:.85;">'
              +'✏ 우클릭으로 색 추출 · <b>Delete</b>로 전체 지우기 · <b>C</b> 지우개 · <b>X</b> 대칭 · <b>Z</b> 도장모드 · <b>Enter</b> 찍기 · <b>G</b> 전체 채우기 · <b>Ctrl+Shift+Z</b> 다시'
            +'</div>'
          +'</div>'
        +'</div>'/* /anpPanelPaint */
        +'</div>'/* /anpBody — 콘텐츠가 길어지면 여기만 스크롤, 아래 버튼은 항상 보임 */
        +'<div style="margin-top:auto;display:flex;gap:8px;flex:none;">'
          +'<button class="lc-btn" id="anpCloseBtn" style="flex:1;">← 이전</button>'
          +'<button class="lc-btn" id="anpNextBtn" style="flex:1;">다음 →</button>'
        +'</div>'
      +'</div>'
    +'</div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#anpClose').onclick=closePreview;
  overlay.querySelector('#anpCloseBtn').onclick=()=>{
    const cur=overlay.querySelector('#anpTabs span.on')?.dataset.tab || 'face';
    const i=TAB_ORDER.indexOf(cur);
    if(i>0) window.__anpGoTab(TAB_ORDER[i-1]);   // 이전 탭으로
    else closePreview();                          // 첫 탭(얼굴)에선 창 닫기 (캐릭터 선택으로)
  };
  // 얼굴형 스와치 — 인간 피부색 선택과 같은 skin-sw 스타일
  const fw=overlay.querySelector('#anpFaces');
  for(let i=0;i<4;i++){
    const b=document.createElement('button');
    b.className='skin-sw';
    b.title='얼굴형 '+(i+1);
    b.style.cssText='width:40px;height:40px;font-size:10px;font-weight:bold;color:var(--ink);background:var(--win-face-2);';
    b.textContent=(i+1);
    b.onclick=()=>{ curFace=i; applyFace(); markFaceBtns(); };
    fw.appendChild(b);
  }
  // 하위 탭 전환 (1 얼굴 ↔ 2 귀 …) — 클릭과 [다음] 버튼이 같은 함수를 씀
  const TAB_ORDER=['face','ear','paint','blink'];   // B안: 표정·감은눈도 이 창 안에서(자체 페인트)
  const tabs=overlay.querySelectorAll('#anpTabs span[data-tab]');
  window.__anpGoTab=function(tab){
    tabs.forEach(x=>x.classList.toggle('on', x.dataset.tab===tab));
    overlay.querySelector('#anpPanelFace').style.display = tab==='face' ? '' : 'none';
    overlay.querySelector('#anpPanelEar').style.display  = tab==='ear'  ? '' : 'none';
    const pp=overlay.querySelector('#anpPanelPaint'); if(pp) pp.style.display = (tab==='paint'||tab==='blink') ? '' : 'none';
    if(tab==='ear') renderEarLists();
    paintTab = (tab==='paint') ? 'face' : (tab==='blink' ? 'blink' : null);
    if(tab==='blink' && !_blinkTouched){
      // 감은눈 첫 진입 — 표정 그림을 자동으로 가져와 시작(눈만 고치면 되게). 이미 그렸으면 유지.
      _copyPaintSide('face','blink');
    }
    /* 🐾 귀 미리보기를 지금 탭 것으로 되돌린다 — 귀는 disp/tex 를 한 벌만 쓰므로(pDispC 와 같은 구조)
       탭이 바뀌면 그 탭의 draw 를 다시 옮겨 그려야 화면이 따라온다. 이게 없으면 표정 탭으로
       나왔는데 감은눈 귀가 계속 보인다. */
    ['L','R'].forEach(sd=>_blitEar(sd));
    if(paintTab){ ensurePaintTex(); syncPaintUI(); if(earGizmo){ earGizmo.detach(); earGizmo.visible=false; } }
    else if(tab==='ear') attachEarGizmo();
    else if(earGizmo){ earGizmo.detach(); earGizmo.visible=false; }
    /* 🙈 탭이 바뀌면 얼굴 표시를 다시 계산한다 — 페인트 탭을 벗어나면 '몸만' 잠금이 켜져 있어도
       얼굴이 돌아온다(_faceHiddenByMask 가 paintTab 을 함께 본다). 얼굴형 탭에서 얼굴이
       사라져 있으면 그건 고장으로 읽힌다. */
    applyFace();
    // 마지막 탭이면 [다음] 대신 안내
    const nb=overlay.querySelector('#anpNextBtn');
    if(nb){ const i2=TAB_ORDER.indexOf(tab); const last=(i2>=TAB_ORDER.length-1);
      nb.textContent = last ? '다음 → 책상·좌석' : '다음 →';
      nb.disabled=false; nb.style.opacity='1'; nb.style.cursor='pointer'; }
  };
  tabs.forEach(t=>{ t.style.cursor='pointer'; t.onclick=()=>window.__anpGoTab(t.dataset.tab); });
  const nextBtn=overlay.querySelector('#anpNextBtn');
  if(nextBtn) nextBtn.onclick=()=>{
    const cur=overlay.querySelector('#anpTabs span.on')?.dataset.tab || 'face';
    const i=TAB_ORDER.indexOf(cur);
    if(i>=0 && i<TAB_ORDER.length-1) window.__anpGoTab(TAB_ORDER[i+1]);
    else saveAnimalSlot();   // 마지막(감은눈)에서 = 저장
  };
  // 귀 조정 패널 — 좌/우 전환
  const selL=overlay.querySelector('#anpEarSelL'), selR=overlay.querySelector('#anpEarSelR');
  function setEarAdjSide(side){
    earAdjSide=side;
    selL.classList.toggle('on', side==='L'); selR.classList.toggle('on', side==='R');
    overlay.querySelector('#anpEarAdjSide').textContent = side==='L' ? '왼쪽' : '오른쪽';
    attachEarGizmo();   // 기즈모를 그 쪽 귀로 옮김
  }
  if(selL) selL.onclick=()=>setEarAdjSide('L');
  if(selR) selR.onclick=()=>setEarAdjSide('R');
  // 기즈모 모드 (이동/회전/크기)
  overlay.querySelectorAll('#anpEarAdjBox [data-gz]').forEach(b=>{
    b.onclick=()=>{
      overlay.querySelectorAll('#anpEarAdjBox [data-gz]').forEach(x=>x.classList.toggle('on', x===b));
      earGizmoMode=b.dataset.gz;
      if(earGizmo) earGizmo.setMode(earGizmoMode);
    };
  });
  // ↺ 활성 쪽 귀 조정 초기화 — 위치·회전·크기를 부착 직후 상태로
  const adjReset=overlay.querySelector('#anpEarAdjReset');
  if(adjReset) adjReset.onclick=()=>{
    earAdj[earAdjSide]=_earAdjNew();
    _applyEarAdj(earAdjSide);
    if(typeof toast==='function') toast((earAdjSide==='L'?'왼쪽':'오른쪽')+' 귀 조정을 초기화했어요');
  };
  // ⇆ 현재 조정 중인 귀 → 반대쪽에 좌우대칭 복사 (x위치·회전 부호 반전, 나머지 동일)
  const earMirror=overlay.querySelector('#anpEarMirror');
  if(earMirror) earMirror.onclick=()=>{
    const from=earAdjSide, to=from==='L'?'R':'L';
    const a=earAdj[from];
    /* 좌우 대칭 = x 축 반사. 위치는 x 만 뒤집고, 회전은 **반사면에 수직인 축만 살아남는다**:
         · X 축 회전(앞뒤로 눕히기) → 그대로     · Y·Z 축 회전 → 부호 반전
       크기는 반사로 바뀌지 않으므로 축별 값을 그대로 옮긴다.
       ⚠️ 받는 쪽을 통째로 새 객체로 덮는 것이 중요하다 — 일부 키만 대입하면 예전 값이 섞여 남는다. */
    { const _s=_earScale(a), _r=_earRot(a);
      earAdj[to]={ px:-a.px, py:a.py, pz:a.pz,
                   rot:-_r.z, rx:_r.x, ry:-_r.y,
                   sc:a.sc, scx:_s.x, scy:_s.y, scz:_s.z }; }
    _applyEarAdj(to);
    if(typeof toast==='function') toast((from==='L'?'왼쪽':'오른쪽')+' 귀 설정을 반대쪽에 대칭 복사했어요');
  };
  window.__anpSetEarSide=setEarAdjSide;
  // 페인트 도구
  const bCustom=overlay.querySelector('#anpBrushCustom'); if(bCustom) bCustom.addEventListener('input',e=>{ pColor=e.target.value; pEraser=false;
    const swEl=overlay.querySelector('#anpBrushColors'); if(swEl)[...swEl.children].forEach(x=>x.classList.remove('on'));
    syncPaintUI(); });
  const bBrush=overlay.querySelector('#anpBrush'); if(bBrush) bBrush.addEventListener('input',e=>{ pSize=+e.target.value; });
  const bUndo=overlay.querySelector('#anpUndo'); if(bUndo) bUndo.onclick=()=>pUndo();
  const bEr=overlay.querySelector('#anpEraser'); if(bEr) bEr.onclick=()=>{ pEraser=!pEraser; syncPaintUI(); };
  const bCl=overlay.querySelector('#anpClear'); if(bCl) bCl.onclick=()=>pClearAll();
  // 이미지 → 도장 모드 (인간 생성기와 같은 흐름: 위치 조준 → 찍기)
  const stFile=overlay.querySelector('#anpStampFile');
  const stBtn=overlay.querySelector('#anpStampBtn');
  if(stBtn&&stFile){
    stBtn.onclick=()=>aSetStampMode(!aStampMode);   // 이미지 버튼 = 도장 모드 토글(Z와 동일) — 인간 생성기 규약
    const ld=overlay.querySelector('#anpStampLoad');
    if(ld) ld.onclick=()=>{ stFile.value=''; stFile.click(); };
    stFile.addEventListener('change',()=>{ const f=stFile.files&&stFile.files[0]; if(f) aLoadStampFromFile(f); });
  }
  const sApply=overlay.querySelector('#anpStampApply'); if(sApply) sApply.onclick=()=>aCommitStamp();
  const sCancel=overlay.querySelector('#anpStampCancel'); if(sCancel) sCancel.onclick=()=>aSetStampMode(false);
  const sReset=overlay.querySelector('#anpStampReset'); if(sReset) sReset.onclick=()=>aResetStampPlacement(true);
  aBindStampOverlay();
  const bSym=overlay.querySelector('#anpSym'); if(bSym) bSym.onclick=()=>{ pSym=!pSym; syncPaintUI(); };
  /* 부위 잠금 3종 — 서로 배타적(라디오처럼). 둘을 동시에 켜면 칠할 곳이 없어지므로
     하나를 켜면 나머지 체크를 해제한다. 같은 걸 다시 누르면 해제(잠금 없음). */
  {
    const MASKS = [['#anpEarMask','ear','귀만 칠하기 — 귀를 클릭해 색을 칠하세요'],
                   ['#anpFaceMask','face','얼굴만 칠하기 — 몸과 귀는 잠겼어요'],
                   ['#anpBodyMask','body','몸만 칠하기 — 얼굴과 귀는 잠겼어요']];
    const boxes = MASKS.map(([sel])=>overlay.querySelector(sel));
    MASKS.forEach(([sel,part,msg],idx)=>{
      const el = boxes[idx]; if(!el) return;
      el.onchange = ()=>{
        if(el.checked){
          pPartMask = part;
          boxes.forEach((b,i)=>{ if(b && i!==idx) b.checked=false; });
          if(typeof toast==='function') toast(msg);
        } else if(pPartMask === part){
          pPartMask = null;
        }
        applyFace();   // 🙈 '몸만'이면 얼굴을 숨기고, 풀면 되돌린다 (applyFace 주석 참고)
      };
    });
  }
  const bCp=overlay.querySelector('#anpCopyFace'); if(bCp) bCp.onclick=()=>{
    pPushHist();
    _copyPaintSide('face','blink');
    _blinkTouched=true; pBlit(); ['L','R'].forEach(sd=>_blitEar(sd));
    if(typeof toast==='function') toast('표정 그림을 가져왔어요 — 눈만 감은 모양으로 고쳐주세요');
  };
  /* 🙂 감은눈 → 표정. 바로 위 ⟳ 표정 복사의 **반대 방향**이다.
     ⚠️ 두 버튼은 대칭이 아니다.
       · 감은눈은 표정에서 파생된다(__anpGoTab 의 `tab==='blink' && !_blinkTouched` 자동 복사).
         그래서 ⟳ 표정 복사는 _blinkTouched=true 를 찍어 "이제 손댔다"고 못 박는다.
       · 표정은 원본이다. 여기서 _blinkTouched 를 건드리면 감은눈 탭에 들어가는 순간 감은눈이
         표정으로 다시 덮여, 방금 가져온 그림이 사라진다. **손대지 않는다.**
         (pPushHist 도 blink 탭일 때만 그 값을 찍으므로 여기서는 안전하다 — 지금은 face 탭이다)
     ⚠️ 감은눈을 한 번도 안 그렸으면 pBlinkC 는 비어 있다(감은눈 탭에 들어가야 채워진다).
       그대로 복사하면 표정과 몸 무늬가 통째로 지워지므로 막는다. 버튼도 syncPaintUI 에서 잠근다.
     ★ 확인을 묻지 않는다 — pPushHist 를 먼저 하므로 [↶ 되돌리기]로 돌아온다(이 창의 관례). */
  const bCb=overlay.querySelector('#anpCopyBlink'); if(bCb) bCb.onclick=()=>{
    if(paintTab!=='face') return;
    if(!_blinkTouched){ if(typeof toast==='function') toast('아직 감은눈을 그린 적이 없어요 — 4 감은눈 탭에서 먼저 그려주세요'); return; }
    pPushHist();   // 표정은 원본이라 덮어쓰기 전에 반드시 되돌릴 자리를 남긴다
    _copyPaintSide('blink','face');
    pBlit(); ['L','R'].forEach(sd=>_blitEar(sd));
    if(typeof toast==='function') toast('감은눈 그림을 가져왔어요');
  };
  // 슬라이더 초기화(↺) — data-rst 버튼
  overlay.querySelectorAll('.cr-mini[data-rst]').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.rst; scl[k]=1;
      const id = k==='x'?'anpSx' : k==='y'?'anpSy' : 'anpSa';
      const el=overlay.querySelector('#'+id); if(el) el.value='1';
      const v=overlay.querySelector('#'+id+'V'); if(v) v.textContent='1.00';
      applyScale();
    };
  });
  // 슬라이더
  [['anpSx','x'],['anpSy','y'],['anpSa','all']].forEach(([id,k])=>{
    overlay.querySelector('#'+id).addEventListener('input',e=>{
      scl[k]=+e.target.value;
      overlay.querySelector('#'+id+'V').textContent=(+e.target.value).toFixed(2);
      applyScale();
    });
  });
  // 회전: 드래그(상하좌우) + 휠 줌 + 좌우 화살표(15°)
  const cv=overlay.querySelector('#anpCv');
  // 🖱️ 우클릭 드래그 = 회전 (인간 생성기와 통일). 좌클릭은 기즈모 전용.
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  let _rcDown=null;   // 우클릭 상태 — 드래그면 회전, 콕이면 스포이드(페인트 탭)
  cv.addEventListener('pointerdown',e=>{
    if(_gizmoDragging) return;
    if(e.button===0 && paintTab){
      if(aStampMode) return;   // 도장 편집 중 — 오버레이(이동·핸들)가 조작 담당, 캔버스 클릭은 그리지 않음(인간과 동일)
      pPushHist(); pPainting=true; pLastX=pLastY=null; pLastSX=pLastSY=null;   // 브러시
      pPaintEvent(e,true); cv.setPointerCapture(e.pointerId); return;
    }
    if(e.button!==2) return;
    _rcDown={x:e.clientX,y:e.clientY,moved:false};
    dragging=true; lastX=e.clientX; lastY=e.clientY; cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove',e=>{
    if(pPainting){ pPaintEvent(e,false); return; }
    if(!dragging) return;
    if(_rcDown && !_rcDown.moved && Math.abs(e.clientX-_rcDown.x)+Math.abs(e.clientY-_rcDown.y)>4) _rcDown.moved=true;
    rotY += (e.clientX-lastX)*0.012;   // 오른쪽 드래그 = 앵글이 오른쪽으로 (사용자 확정 방향)
    rotX = Math.max(-0.55, Math.min(0.9, rotX + (e.clientY-lastY)*0.008));   // 위/아래에서 보기 (과회전 방지 클램프)
    lastX=e.clientX; lastY=e.clientY;
  });
  cv.addEventListener('pointerup',e=>{
    if(pPainting){ pPainting=false; pLastX=pLastY=null; pLastSX=pLastSY=null; return; }
    if(dragging && _rcDown && !_rcDown.moved && paintTab) pPickColor(e);   // 우클릭 콕 = 색 추출 (인간과 동일)
    _rcDown=null; dragging=false;
  });
  // ▲▼◀▶ — 좌우는 15° 앵글 회전, 상하는 카메라 이동(팬). 인간 생성기(cpLeft 등)와 같은 문법.
  const ROT15=Math.PI/12, PANSTEP=0.14;
  const camBtn=(id,fn)=>{ const b=overlay.querySelector('#'+id); if(!b) return;
    if(typeof bindHold==='function') bindHold(b, fn); else b.onclick=fn; };
  camBtn('anpCamL', ()=>{ rotY -= ROT15; });
  camBtn('anpCamR', ()=>{ rotY += ROT15; });
  camBtn('anpCamU', ()=>{ panY += PANSTEP; });
  camBtn('anpCamD', ()=>{ panY -= PANSTEP; });
  cv.addEventListener('wheel',e=>{
    e.preventDefault();
    _zoom = Math.max(0.5, Math.min(2.6, _zoom + (e.deltaY>0 ? -0.09 : 0.09)));   // 줌인/줌아웃 (직교 zoom)
  },{passive:false});
  // ↺ 카메라 앵글 초기화 — 인간 생성기의 cpReset과 동일(설정이 아니라 시점만 리셋)
  const resetBtn=overlay.querySelector('#anpResetBtn');
  if(resetBtn) resetBtn.onclick=()=>{
    rotY=0; rotX=0; _zoom=1.0; panX=0; panY=0;   // ★ 리셋도 정면(인간 생성기와 동일)
  };
  // 📐 프리셋 — 5슬롯(localStorage). 클릭=불러오기, 우클릭=저장/삭제
  const presetBtn=overlay.querySelector('#anpPresetBtn'), presetPop=overlay.querySelector('#anpPresetPopup');
  if(presetBtn && presetPop){
    presetBtn.onclick=()=>{ presetPop.style.display = presetPop.style.display==='none' ? 'block' : 'none'; if(presetPop.style.display==='block') renderPresetSlots(); };
    document.addEventListener('pointerdown', e=>{ if(presetPop.style.display==='block' && !presetPop.contains(e.target) && e.target!==presetBtn) presetPop.style.display='none'; });
  }
  return overlay;
}
let curEarL=null, curEarR=null;   // 선택된 좌/우 귀 종류 key (null=없음)
/* 내장 귀(window.ANIMAL_EARS + ANIMAL_EAR_TYPES)를 좌/우 그리드에 표시.
   3D 부착·기즈모는 다음 단계 — 지금은 선택 상태만 관리. */
function renderEarLists(){
  if(!overlay) return;
  const types=(window.ANIMAL_EAR_TYPES||[]);
  [['L','anpEarsL',()=>curEarL,v=>curEarL=v],['R','anpEarsR',()=>curEarR,v=>curEarR=v]].forEach(([side,boxId,get,set])=>{
    const box=overlay.querySelector('#'+boxId); if(!box) return;
    box.innerHTML='';
    // "없음"
    const none=document.createElement('button');
    none.className='skin-sw'+(get()==null?' on':'');
    none.textContent='없음';
    none.style.cssText='width:46px;height:40px;font-size:10px;color:var(--ink);background:var(--win-face-2);';
    none.onclick=()=>{ set(null); renderEarLists(); onEarChange(); };
    box.appendChild(none);
    types.forEach(t=>{
      const key='ear_'+t.key+'_'+side;
      if(!(window.ANIMAL_EARS && window.ANIMAL_EARS[key])) return;   // 해당 파일 없으면 건너뜀
      const b=document.createElement('button');
      b.className='skin-sw'+(get()===t.key?' on':'');
      b.title=t.label;
      b.textContent=t.label;
      b.style.cssText='width:46px;height:40px;font-size:9.5px;line-height:1.1;color:var(--ink);background:var(--win-face-2);';
      b.onclick=()=>{ set(t.key); renderEarLists(); onEarChange(); if(typeof window.__anpSetEarSide==='function') window.__anpSetEarSide(side); };
      box.appendChild(b);
    });
  });
  updateEarAdjVisibility();
}
function onEarChange(){ applyEars(); }

/* 선택된 좌/우 귀 종류(curEarL/curEarR)를 base의 ear_L/ear_R 본에 부착.
   귀 GLB는 window.ANIMAL_EARS[key]의 base64. 파싱은 캐시해서 재사용. */
function _parseEar(key, cb){
  if(_earCache[key]){ cb(_earCache[key]); return; }
  const b64 = window.ANIMAL_EARS && window.ANIMAL_EARS[key];
  if(!b64 || !_earLoader){ cb(null); return; }
  try{
    const bin=atob(b64); const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    _earLoader.parse(buf.buffer,'',(g)=>{ _earCache[key]=g.scene; cb(g.scene); }, (e)=>{ console.warn('[동물] 귀 파싱 실패',key,e); cb(null); });
  }catch(e){ console.warn('[동물] 귀 로드 오류',key,e); cb(null); }
}
function _detachEar(side){
  const obj = side==='L' ? earObjL : earObjR;
  if(obj && obj.parent) obj.parent.remove(obj);
  if(side==='L') earObjL=null; else earObjR=null;
}
function _attachEar(side){
  const type = side==='L' ? curEarL : curEarR;
  const bone = side==='L' ? earBoneL : earBoneR;
  _detachEar(side);
  if(!type || !bone) return;
  const key = 'ear_'+type+'_'+side;
  _parseEar(key, (scene)=>{
    if(!scene) return;
    // 부착 시점에 선택이 바뀌었으면 취소
    if((side==='L'?curEarL:curEarR) !== type) return;
    const obj = scene.clone(true);
    obj.traverse(o=>{ if(o.isMesh && o.material){ o.material=o.material.clone(); o.material.color.set('#ffffff'); o.frustumCulled=false; } });
    // 귀 GLB는 base와 같은 좌표계(같은 원점·스케일)로 제작됨 → model에 그대로 붙이면 원래 자리에 정확히 옴.
    //   본에 붙이면 본의 큰 로컬 스케일이 딸려와 좌표가 왜곡되고 기즈모도 멀리 잡힘. model 직결이 깔끔.
    const wrap=new THREE.Group();
    // 피봇 보정 — 귀 지오메트리는 GLB 좌표계에서 머리 옆 위치에 박혀 있어, 그대로 감싸면
    // wrap 원점(=기즈모 위치·회전 중심)이 모델 원점에 남음. 귀의 바운딩 중심을 피봇으로:
    // wrap을 귀 중심으로 옮기고 obj를 그만큼 되당겨서, 화면 위치는 그대로 두되 피봇만 귀에 오게.
    const _bb=new THREE.Box3().setFromObject(obj);
    const _c=_bb.getCenter(new THREE.Vector3());
    obj.position.sub(_c);
    wrap.position.copy(_c);
    wrap.userData.pivot=_c.clone();   // 조정값(earAdj)은 이 피봇 기준 오프셋
    wrap.add(obj);
    model.add(wrap);
    if(side==='L') earObjL=wrap; else earObjR=wrap;
    _applyEarAdj(side);
    // ★ 귀 페인트 다시 물리기 — 위에서 o.material.clone()으로 '새 재질'을 만들기 때문에 텍스처(map) 연결이
    //   끊긴다. 그린 내용(pEar[side].face·blink)은 그대로 살아있는데 화면만 흰색이 되는 것.
    //   귀 종류를 A→B→A로 바꾸거나 재부착될 때마다 재현되던 문제라 부착 직후 여기서 다시 연결한다.
    if(typeof _ensureEarTex==='function') _ensureEarTex(side);
    // ★ 기즈모 재부착 — 귀 클릭 시점엔 파싱이 안 끝나 붙일 대상이 없어서(attach 실패)
    //   기즈모가 안 보이던 버그. 파싱 완료 후 지금 조정 중인 쪽이면 여기서 부착.
    if(earAdjSide===side) attachEarGizmo();
  });
}
function attachEarGizmo(){
  if(!earGizmo) return;
  const wrap = earAdjSide==='L' ? earObjL : earObjR;
  if(wrap){ earGizmo.attach(wrap); earGizmo.setMode(earGizmoMode); earGizmo.visible=true; }
  else { earGizmo.detach(); earGizmo.visible=false; }
}
function updateEarAdjVisibility(){
  if(!overlay) return;
  const box=overlay.querySelector('#anpEarAdjBox'); if(!box) return;
  const anySel = !!(curEarL || curEarR);
  box.style.display = anySel ? '' : 'none';
  const selL=overlay.querySelector('#anpEarSelL'), selR=overlay.querySelector('#anpEarSelR');
  if(selL) selL.style.opacity = curEarL ? '1' : '.45';
  if(selR) selR.style.opacity = curEarR ? '1' : '.45';
  attachEarGizmo();
}
function _applyEarAdj(side){
  const wrap = side==='L' ? earObjL : earObjR;
  if(!wrap) return;
  const a=earAdj[side];
  const pv=wrap.userData.pivot || {x:0,y:0,z:0};
  wrap.position.set(pv.x+a.px, pv.y+a.py, pv.z+a.pz);   // 피봇 기준 오프셋으로 복원
  /* ★ 세 축을 모두 «덮어쓴다». Z 만 대입하던 예전 코드는 X·Y 를 **건드리지 않고 남겨** 뒀다.
     그래서 초기화(↺)를 눌러도 눕혀 놓은 각도가 그대로 남고, 대칭 복사를 해도 받는 쪽의
     옛 X·Y 가 살아남았다 — 사용자에겐 «일부만 적용되는» 것으로 보인다. */
  { const _r=_earRot(a); wrap.rotation.set(_r.x, _r.y, _r.z); }
  const _sc=_earScale(a); wrap.scale.set(_sc.x, _sc.y, _sc.z);   // 축별 크기 복원(구버전은 sc로 폴백)
}
function applyEars(){ _attachEar('L'); _attachEar('R'); }
const ANP_PRESET_KEY='tw.animalPresets';
function _loadPresets(){ try{ return JSON.parse(localStorage.getItem(ANP_PRESET_KEY)||'{}'); }catch(_){ return {}; } }
function _savePresets(o){ try{ localStorage.setItem(ANP_PRESET_KEY, JSON.stringify(o)); }catch(_){} }
function renderPresetSlots(){
  if(!overlay) return;
  const box=overlay.querySelector('#anpPresetSlots'); if(!box) return;
  const presets=_loadPresets();
  box.innerHTML='';
  for(let i=1;i<=5;i++){
    const has=!!presets['p'+i];
    const b=document.createElement('button');
    b.textContent=i;
    b.title = has ? '클릭=불러오기 · 우클릭=삭제' : '우클릭=현재 설정 저장';
    b.style.cssText='width:32px;height:32px;font-size:12px;cursor:pointer;background:'+(has?'#dce9f5':'var(--win-face-2)')+';border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);color:var(--ink);font-weight:'+(has?'bold':'normal')+';';
    b.onclick=()=>{
      const p=_loadPresets()['p'+i]; if(!p){ if(typeof toast==='function') toast('빈 슬롯이에요 (우클릭으로 저장)'); return; }
      curFace=p.face||0; curEarL=p.earL||null; curEarR=p.earR||null;
      scl.x=p.sx||1; scl.y=p.sy||1; scl.all=p.sa||1;
      overlay.querySelector('#anpSx').value=scl.x; overlay.querySelector('#anpSxV').textContent=scl.x.toFixed(2);
      overlay.querySelector('#anpSy').value=scl.y; overlay.querySelector('#anpSyV').textContent=scl.y.toFixed(2);
      overlay.querySelector('#anpSa').value=scl.all; overlay.querySelector('#anpSaV').textContent=scl.all.toFixed(2);
      applyFace(); applyScale(); markFaceBtns(); renderEarLists(); onEarChange();
      overlay.querySelector('#anpPresetPopup').style.display='none';
      if(typeof toast==='function') toast('프리셋 '+i+' 불러왔어요');
    };
    b.oncontextmenu=(e)=>{
      e.preventDefault();
      const all=_loadPresets();
      if(all['p'+i]){ delete all['p'+i]; _savePresets(all); renderPresetSlots(); if(typeof toast==='function') toast('프리셋 '+i+' 삭제'); }
      else { all['p'+i]={face:curFace,earL:curEarL,earR:curEarR,sx:scl.x,sy:scl.y,sa:scl.all}; _savePresets(all); renderPresetSlots(); if(typeof toast==='function') toast('프리셋 '+i+'에 저장했어요'); }
    };
    box.appendChild(b);
  }
}
function markFaceBtns(){
  overlay.querySelectorAll('#anpFaces .skin-sw').forEach((b,i)=>b.classList.toggle('on', i===curFace));
}
/* 🙈 '몸만' 잠금이면 얼굴을 아예 숨긴다(요청사항).
   [왜 숨기는가] 얼굴은 몸 앞에 겹쳐 있어서, 잠가 놓아도 **칠하려는 몸을 가린다.**
     클릭은 _partAllowed 가 이미 막고 있었지만 그건 '안 칠해질 뿐'이고, 뒤에 있는 몸에는
     붓이 닿지도 않았다 — _pTargets() 가 레이캐스트에서 맨 앞 메시를 집기 때문이다.
     visible=false 로 두면 _pTargets() 의 `o.visible` 필터에 걸려 목록에서 빠지므로,
     가려져 있던 몸 표면이 그대로 칠할 수 있는 자리가 된다. 시야와 붓이 한 번에 해결된다.
   ★ 페인트 탭에서만 숨긴다 — 얼굴형 고르는 탭에서 얼굴이 사라지면 그건 고장으로 읽힌다.
   ⚠️ 잠금을 풀거나 다른 부위를 고르거나 탭을 옮기면 즉시 돌아온다(그 세 곳 전부 applyFace 를 부른다). */
function _faceHiddenByMask(){ return pPartMask==='body' && !!paintTab; }
function applyFace(){
  const hide = _faceHiddenByMask();
  faceNodes.forEach((n,i)=>{ n.visible = !hide && (i===curFace); });
}
function applyScale(){
  if(!headBone) return;
  headBone.scale.set(scl.x*scl.all, scl.y*scl.all, scl.all);
}
/* 🐾 미리보기 팔 각도 — 실행화면은 app.js animateRig가 매 프레임 rest×delta로 팔을 잡아주는데,
   생성기 미리보기엔 그 로직이 없어서 바인드 포즈 그대로였다(실행화면과 팔 위치가 달라 보이던 원인).
   같은 값(ANIMAL_HAND_REST)을 한 번만 적용해 정지 자세를 일치시킨다. 상수는 app.js가 단일 관리. */
function applyArmRest(){
  const a = (typeof ANIMAL_HAND_REST!=='undefined') ? ANIMAL_HAND_REST
          : ((typeof window!=='undefined' && window.ANIMAL_HAND_REST!=null) ? window.ANIMAL_HAND_REST : -0.4);
  const put=(bone,restRef)=>{
    if(!bone) return null;
    const rest = restRef || bone.quaternion.clone();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(a,0,0,'XYZ'));
    bone.quaternion.copy(rest).multiply(q);
    return rest;
  };
  handRestL = put(handBoneL, handRestL);
  handRestR = put(handBoneR, handRestR);
}

let _loading=false;   // GLB 파싱 진행 중 — 창을 빨리 닫았다 열면 parse가 겹쳐 모델이 두 개 추가되던 버그 방지
function loadModel(){
  if(model || _loading || !window.ANIMAL_GLB_B64) return;
  _loading=true;
  try{
    const bin=atob(window.ANIMAL_GLB_B64);
    const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    const ld=(typeof loader!=='undefined' && loader) ? loader : new THREE.GLTFLoader();
    ld.parse(buf.buffer,'',(g)=>{
      _loading=false;
      if(model && model.parent) model.parent.remove(model);   // 이중 방어 — 어떤 경로로든 남아있으면 제거
      model=g.scene;
      faceNodes=[]; headBone=null; earBoneL=null; earBoneR=null; handBoneL=null; handBoneR=null;
      model.traverse(o=>{
        if(/^face[1-4]$/.test(o.name)) faceNodes[+o.name.slice(4)-1]=o;
        if(o.isBone && o.name==='head') headBone=o;
        if(o.isBone && o.name==='ear_L') earBoneL=o;
        if(o.isBone && o.name==='ear_R') earBoneR=o;
        if(o.isBone && o.name==='hand_L') handBoneL=o;
        if(o.isBone && o.name==='hand_R') handBoneR=o;
        if(o.isMesh){ o.frustumCulled=false;
          if(o.material){
            o.material=o.material.clone();
            // GLB 기본값이 0.5 회색이라 그대로 두면 어둡고, 흰색으로 두면 배경과 구분이 안 됨.
            // 밑색 없는(전부 페인트) 캐릭터라 미리보기용 중립 베이지를 임시로 입힘 — 나중에 페인트 텍스처가 덮음.
            o.material.color.set('#ffffff');   // 흰색 — 페인트 텍스처(흰 바탕) 그대로. 배경이 회색이라 구분됨
            if('metalness' in o.material) o.material.metalness=0;
            if('roughness' in o.material) o.material.roughness=0.85;
            if('emissive' in o.material && o.material.emissive) o.material.emissive.set('#000000');
          }
        }
      });
      // 크기 정규화(높이 2.6에 맞춤) + 바닥 정렬
      const box=new THREE.Box3().setFromObject(model);
      const h=box.max.y-box.min.y, s=2.6/h;
      model.scale.setScalar(s);
      box.setFromObject(model);
      model.position.y=-box.min.y-1.28;
      scene.add(model);
      applyFace();
      applyArmRest();     // 🐾 실행화면(animateRig)과 같은 팔 각도로 맞춤 — 미리보기는 바인드 포즈라 그냥 두면 팔이 다름
      ensurePaintTex();   // 얼굴 단계부터 페인트 텍스처(회색 바탕) 적용 — 표정 단계와 밝기 동일
      applyEars();   // 저장돼 있던 귀 선택을 부착
    },(e)=>{ _loading=false; console.warn('[동물] GLB 파싱 실패',e); if(typeof toast==='function') toast('동물 모델을 불러오지 못했어요'); });
  }catch(e){ console.warn('[동물] 로드 오류',e); }
}

function openPreview(){
  buildOverlay();
  // ★ 창 크기 모드 전환 — 데스크탑 창은 creatorOpen 여부로 크기가 결정됨(런처 380×680 / 생성기 740×620).
  //   이걸 안 켜면 런처 크기(380px)에 갇혀 오른쪽 패널이 세로로 짓눌림.
  try{
    _prevLauncherOn = document.getElementById('launcher').classList.contains('on');
    if(_prevLauncherOn) document.getElementById('launcher').classList.remove('on');
    creatorOpen = true;
    if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
  }catch(e){ console.warn('[동물] 창 모드 전환 중 오류:', e); }
  // ★ 이중 안전 — 위 경유(applyDesktopRunClass)가 환경에 따라 안 먹는 경우가 보고돼,
  //   생성기 크기(740×620) 전환을 여기서 직접 한 번 더 요청. 마지막 요청이 이겨서 확실함.
  try{
    document.body.classList.add('config');
    if(window.companion && companion.setConfigMode) companion.setConfigMode(true, 'animal');   // 동물 전용 창 크기(860×640)
  }catch(e){ console.warn('[동물] 창 크기 직접 전환 실패:', e); }
  document.body.classList.add('animal-creator');
  window.addEventListener('keydown', onPanKey);
  overlay.style.display='flex';
  console.log('[동물] 창 크기 확인 — innerWidth:', innerWidth, 'innerHeight:', innerHeight, '(기대: 860×440)');
  if(!renderer){
    const cv=overlay.querySelector('#anpCv');
    renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    // 인간 생성기(ensureCreatorPreview)와 동일한 설정 — 해상도·색감이 똑같이 보이게
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.NoToneMapping;
    renderer.setSize(360,398,false);
    scene=new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xfdfbf7,0.95));                    // 인간 생성기와 동일 광원
    const k=new THREE.DirectionalLight(0xfdfaf5,1.0); k.position.set(0,4,0); scene.add(k);
    // 원근 없음(직교) — 비율 왜곡 없이 편집. 휠 줌은 cam.zoom으로.
    { const a=360/398, vh=3.3, vw=vh*a;
      cam=new THREE.OrthographicCamera(-vw/2, vw/2, vh/2, -vh/2, 0.1, 100); }
    cam.position.set(0,0.15,_camDist);
    // 🔧 귀 조정 기즈모 (인간 생성기와 같은 THREE.TransformControls)
    if(typeof THREE.TransformControls==='function'){
      earGizmo=new THREE.TransformControls(cam, renderer.domElement);
      earGizmo.setSize(2.7);   // 사용자 요청: 3배 크기
      earGizmo.setSpace('local');   // 회전·이동 축을 개체 로컬 기준으로
      earGizmo.visible=false;
      // 기즈모 드래그 중에는 미리보기 회전(pointer 드래그)이 끼어들지 않게
      earGizmo.addEventListener('dragging-changed', e=>{ _gizmoDragging=e.value; if(e.value) dragging=false; });   // 기즈모 잡는 순간 회전 드래그 취소
      // 드래그 결과를 earAdj에 저장(프리셋·복원용)
      earGizmo.addEventListener('objectChange', ()=>{
        const w = earAdjSide==='L' ? earObjL : earObjR;
        if(w){ const a=earAdj[earAdjSide]; const pv=w.userData.pivot||{x:0,y:0,z:0};
          a.px=w.position.x-pv.x; a.py=w.position.y-pv.y; a.pz=w.position.z-pv.z;
          /* ★ 세 축을 모두 적는다. Z 만 적던 것이 «회전이 저장 후 사라진다» 의 발원지다.
             rot 이 Z 인 것은 옛 저장본과의 약속이라 이름을 바꾸지 않는다. */
          a.rot=w.rotation.z; a.rx=w.rotation.x; a.ry=w.rotation.y;
          a.scx=w.scale.x; a.scy=w.scale.y; a.scz=w.scale.z; a.sc=w.scale.x; }   // sc는 구버전 호환용(=X축)
      });
      scene.add(earGizmo);
    } else { console.warn('[동물] TransformControls 미로드 — 기즈모 사용 불가'); }
  }
  loadModel();
  markFaceBtns();
  const tick=()=>{
    raf=requestAnimationFrame(tick);
    if(model) model.rotation.y=rotY;
    // 상하 회전은 카메라 궤도로 — 모델을 기울이지 않고 보는 각도만 바꿈(자연스러움)
    cam.position.set(panX, panY + 0.15 + Math.sin(rotX)*_camDist*0.55, Math.cos(rotX)*_camDist);
    if(cam.zoom !== _zoom){ cam.zoom=_zoom; cam.updateProjectionMatrix(); }
    cam.lookAt(panX, panY + 0.05, 0);
    renderer.render(scene,cam);
  };
  cancelAnimationFrame(raf); tick();
}
function onPanKey(e){
  if(!overlay || overlay.style.display==='none') return;
  const t=e.target; if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA')) return;   // 슬라이더 조작 충돌 방지
  // 페인트 단축키 (인간 생성기와 동일 키)
  if(paintTab){
    if((e.ctrlKey||e.metaKey) && (e.key==='z'||e.key==='Z')){
      if(e.shiftKey) pRedoDo(); else pUndo();
      e.preventDefault(); return;
    }
    if(e.key==='z'||e.key==='Z'){ aSetStampMode(!aStampMode); e.preventDefault(); return; }   // Z=도장 모드 토글(인간과 동일)
    if(e.key==='Enter'){ if(aStampMode) aCommitStamp(); e.preventDefault(); return; }          // Enter=찍기
    if(e.key==='Escape'){ if(aStampMode) aSetStampMode(false); e.preventDefault(); return; }
    if(e.key==='c'||e.key==='C'){ pEraser=!pEraser; syncPaintUI(); e.preventDefault(); return; }
    if(e.key==='x'||e.key==='X'){ pSym=!pSym; syncPaintUI(); e.preventDefault(); return; }
    if(e.key==='Delete'){ pClearAll(); e.preventDefault(); return; }
    if(e.key==='g'||e.key==='G'){ pFillAll(); e.preventDefault(); return; }   // G=전체 채우기
  }
  const STEP=0.14; let used=true;
  if(e.key==='ArrowLeft') panX-=STEP;
  else if(e.key==='ArrowRight') panX+=STEP;
  else if(e.key==='ArrowUp') panY+=STEP;
  else if(e.key==='ArrowDown') panY-=STEP;
  else used=false;
  if(used) e.preventDefault();
}
function closePreview(){
  /* 🧠 되돌리기 스냅샷 반납 — 예전엔 아무도 비우지 않아, 동물을 한 번 만들면 최대 144MB 의
     캔버스 메모리가 **세션이 끝날 때까지** 붙들려 있었다. 그 압박이 저장 슬롯의 얼굴 캔버스를
     밀어내는 힘이다(_clearPaintHistory 위 주석 참고).
     ★ 창을 닫으면 되돌리기가 끊기는 것이 맞다 — 다시 들어오면(reopenAnimalCreator) 캔버스를
       저장본에서 새로 그리므로, 남아 있던 옛 스냅샷은 어차피 «되돌릴 자리»가 아니다. */
  try{ _clearPaintHistory(); }catch(_){}
  window.removeEventListener('keydown', onPanKey);
  document.body.classList.remove('animal-creator');
  if(overlay) overlay.style.display='none';
  cancelAnimationFrame(raf); raf=0;
  try{
    creatorOpen = false;
    if(_prevLauncherOn){ document.getElementById('launcher').classList.add('on'); if(typeof renderLauncher==='function') renderLauncher(); }
    if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
    else if(window.companion && companion.setConfigMode) companion.setConfigMode(true, 'launcher');   // 폴백 — 런처 크기 복귀
  }catch(e){ console.warn('[동물] 창 모드 복귀 중 오류:', e); }
}

/* ═══ B안: 자체 페인트 (표정=faceC / 감은눈=blinkC, 전신 한 장 512) ═══ */
const P_SZ=512;
let paintTab=null;                 // 'face' | 'blink' | null(페인트 탭 아님)
let pFaceC=null, pBlinkC=null;     // 몸/얼굴 그림 레이어(투명 바탕)
let pDispC=null, pTex=null;        // 몸/얼굴 합성(회색 바탕+그림) → CanvasTexture
// 귀는 몸과 UV가 겹쳐 같은 캔버스를 쓰면 간섭 → 좌/우 귀 각각 독립 캔버스/텍스처
/* ★ 귀도 몸처럼 표정(face)·감은눈(blink) 두 장을 따로 갖는다.
   예전엔 draw 한 장뿐이라 감은눈 탭에서 그린 귀가 표정에도 그대로 나타났다(제보된 증상).
   화면에 보이는 쪽(disp/tex)은 몸의 pDispC/pTex 과 똑같이 **한 벌**이다 — 탭이 바뀌면
   그 탭의 draw 를 disp 로 다시 옮겨 그린다(_blitEar). 텍스처를 두 개 물리면 재질 교체가
   필요해지는데, 생성기 미리보기는 한 번에 한 탭만 보여주므로 그럴 이유가 없다. */
const pEar={ L:{face:null, blink:null, disp:null, tex:null}, R:{face:null, blink:null, disp:null, tex:null} };
/* 지금 탭에서 칠해야 할 귀 캔버스. pActC() 의 귀 판(版)이다 — 페인트 탭이 아니면 표정 쪽을 준다. */
function _earDraw(side){ const e=pEar[side]; if(!e) return null; return paintTab==='blink' ? e.blink : e.face; }
/* 좌/우 귀의 두 캔버스를 한 번에 확보한다(없을 때만). 여러 곳에서 같은 세 줄을 쓰던 것을 모음 —
   ⚠️ 한쪽만 만들면 _blitEar 가 null 을 그리려다 조용히 실패한다. 반드시 세 장을 함께 만든다. */
function _ensureEarCv(side){ const e=pEar[side]; if(!e) return null;
  if(!e.face){ e.face=_mkCv(); } if(!e.blink){ e.blink=_mkCv(); } if(!e.disp){ e.disp=_mkCv(); } return e; }
/* 표정 ↔ 감은눈 한쪽을 다른 쪽으로 통째로 복사한다(몸/얼굴 + 좌우 귀).
   ★ 귀를 빼먹으면 [⟳ 표정 복사]가 몸만 가져와서, 감은눈 귀가 예전 그림인 채로 남는다.
     감은눈 첫 진입의 자동 복사도 같은 이유로 이 함수를 탄다 — 세 자리가 어긋나지 않게 하나로 모았다.
   ⚠️ 화면 갱신(pBlit/_blitEar)은 부르는 쪽 몫이다. 되돌리기 스냅샷(pPushHist)도 마찬가지 —
     자동 복사 자리는 이력을 남기지 않아야 해서 여기에 넣을 수 없다. */
function _copyPaintSide(from, to){
  const src = from==='blink' ? pBlinkC : pFaceC;
  const dst = to==='blink' ? pBlinkC : pFaceC;
  if(src && dst){ const x=dst.getContext('2d'); x.clearRect(0,0,P_SZ,P_SZ); x.drawImage(src,0,0); }
  ['L','R'].forEach(sd=>{
    const e=_ensureEarCv(sd); if(!e) return;
    const s2=e[from], d2=e[to]; if(!s2||!d2) return;
    const x=d2.getContext('2d'); x.clearRect(0,0,P_SZ,P_SZ); x.drawImage(s2,0,0);
  });
}
let pColor='#333333', pSize=11, pEraser=false, pSym=false;
let pPainting=false, pLastX=null, pLastY=null, pLastSX=null, pLastSY=null;
let _blinkTouched=false;   // 감은눈을 한 번이라도 직접 편집했는지 — 자동복사 재실행 방지
/* ★ 부위 잠금 — 'ear'|'face'|'body'|null. 얼굴(face1~4)과 몸은 캔버스 한 장(P_SZ)을 공유하지만
   메시가 분리돼 있어서(face1~4 노드) 귀와 똑같이 '히트한 메시'로 구분할 수 있다.
   세 개는 서로 배타적이다 — '얼굴만'과 '몸만'을 동시에 켜면 아무 데도 못 칠하므로 라디오처럼 동작. */
let pPartMask=null;
const pHist={face:[], blink:[]};   // 되돌리기 스냅샷(dataURL 아님 — 캔버스 복제)
const pRedo={face:[], blink:[]};   // 다시 실행(Ctrl+Shift+Z)
/* 🧠 [캔버스 메모리] 스냅샷 한 장은 512²×4B ≈ 1MB 의 **브라우저 백킹스토어**다(JS 힙이 아니다).
   한 스냅샷이 몸+귀L+귀R 3장, 한 탭이 12단계, 되돌리기와 다시실행이 각각, 탭이 표정·감은눈 둘 —
   **상한 144MB.** 게다가 창을 닫아도 아무도 비우지 않아 세션 내내 그대로 붙들려 있었다.
   [무슨 일이 벌어지나] 브라우저는 캔버스 메모리가 넘치면 **오래 안 쓴 오프스크린 캔버스의
     백킹스토어부터 버린다.** 저장 슬롯의 얼굴 캔버스(slots[i].face)가 정확히 그 대상이다 —
     화면에 직접 붙어 있지도 않고, 한 번 만든 뒤로는 건드리지 않는다.
     그래서 «동물 캐릭터를 만든 뒤에 기존 캐릭터 얼굴이 사라진다» 가 된다.
     동물이 멀쩡한 이유도 같다 — 동물은 animalBody(문자열)로 렌더하지 캔버스로 렌더하지 않는다.
   ★ 캔버스는 참조를 놓는 것만으로는 즉시 안 풀린다(GC 를 기다린다). width=0 이 백킹스토어를
     그 자리에서 반납하는 유일한 방법이다. */
function _freeCv(c){ try{ if(c && c.width){ c.width=0; c.height=0; } }catch(_){} }
function _freeSnapSet(set){ if(!set) return; ['body','earL','earR'].forEach(k=>_freeCv(set[k])); }
function _clearPaintHistory(){
  [pHist.face, pHist.blink, pRedo.face, pRedo.blink].forEach(arr=>{
    if(!arr) return; arr.forEach(_freeSnapSet); arr.length = 0;
  });
}
/* 캔버스가 완전히 비었는지 싸게 본다 — 32² 로 줄여 그린 뒤 알파만 훑는다(1/256 비용).
   축소는 평균이라 1px 선도 알파가 0 이 되지 않는다. 판정 불가면 «안 비었다»(false) 쪽이 안전하다:
   여기서 true 는 «스냅샷을 안 뜬다»는 뜻이라, 틀리면 되돌리기가 그 칸을 못 살린다. */
let _blankProbe=null;
function _cvBlank(c){
  try{
    if(!c || typeof c.getContext!=='function' || !c.width) return false;
    if(!_blankProbe){ _blankProbe=document.createElement('canvas'); _blankProbe.width=_blankProbe.height=32; }
    const x=_blankProbe.getContext('2d',{willReadFrequently:true});
    x.clearRect(0,0,32,32); x.drawImage(c,0,0,32,32);
    const d=x.getImageData(0,0,32,32).data;
    for(let i=3;i<d.length;i+=4) if(d[i]!==0) return false;
    return true;
  }catch(_){ return false; }
}
// 도장 — 인간 생성기(stampMode/stampPlace/bindStampOverlay/commitStamp)와 동일 구조·조작
let aStampMode=false, aStampImg=null, aStampDirty=false;
let aStampPlace={cx:0,cy:0,w:120,h:120,rot:0,aspect:1};   // 미리보기 캔버스 픽셀 기준
function aStampOv(){ return overlay && overlay.querySelector('#anpStampOverlay'); }
function aRefreshStampOverlay(){
  const ov=aStampOv(); if(!ov) return;
  if(!aStampMode||!aStampImg){ ov.style.display='none'; return; }
  const cv=overlay.querySelector('#anpCv');
  const ox=cv.offsetLeft, oy=cv.offsetTop;   // 오버레이 부모(decor-left) 안 캔버스 오프셋 보정 — 인간과 동일
  ov.style.display='block';
  ov.style.left=(ox+aStampPlace.cx-aStampPlace.w/2)+'px';
  ov.style.top =(oy+aStampPlace.cy-aStampPlace.h/2)+'px';
  ov.style.width=aStampPlace.w+'px';
  ov.style.height=aStampPlace.h+'px';
  ov.style.transform='rotate('+aStampPlace.rot+'rad)';
}
function aSetStampMode(on){
  aStampMode=on;
  const sb=overlay&&overlay.querySelector('#anpStampBtn'); if(sb) sb.classList.toggle('on',on);
  const sp=overlay&&overlay.querySelector('#anpStampPanel'); if(sp) sp.style.display=on?'flex':'none';
  if(on){ pEraser=false; syncPaintUI();
    if(aStampImg){   // 이전에 불러둔 이미지가 있으면 찍기/취소 다시 노출 (인간과 동일)
      const sa=overlay.querySelector('#anpStampApply'); if(sa) sa.style.display='inline-block';
      const sc=overlay.querySelector('#anpStampCancel'); if(sc) sc.style.display='inline-block';
      const sr=overlay.querySelector('#anpStampReset'); if(sr) sr.style.display='inline-block';
    }
  }
  aRefreshStampOverlay();
}
/* 도장 변형 초기화 — 인간 생성기(resetStampPlacement)와 같은 규약.
   · aResetStampPlacement()     — 크기/회전만. 위치 유지. 오버레이 ↺ 손잡이가 쓴다(기존 동작).
   · aResetStampPlacement(true) — 위치까지 중앙으로. 패널 [↺ 초기화] 버튼이 쓴다. */
function aResetStampPlacement(alsoPos){
  if(!aStampImg) return;
  const cv=overlay.querySelector('#anpCv'), r=cv.getBoundingClientRect();
  aStampPlace.aspect=aStampImg.naturalWidth/Math.max(1,aStampImg.naturalHeight);
  const baseW=Math.min(r.width,r.height)*0.4;
  aStampPlace.w=baseW; aStampPlace.h=baseW/aStampPlace.aspect;
  aStampPlace.rot=0; aStampDirty=false;
  // ★ 값은 aLoadStampFromFile 의 첫 배치와 같아야 한다 — "처음 불러온 상태"가 이 버튼의 약속이다.
  if(alsoPos){ aStampPlace.cx=r.width/2; aStampPlace.cy=r.height/2; }
  aRefreshStampOverlay();
}
function aLoadStampFromFile(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return;
  const r=new FileReader();
  r.onload=ev=>{ const im=new Image(); im.onload=()=>{ aStampImg=im;
    const th=overlay.querySelector('#anpStampThumb'); if(th){ th.src=ev.target.result; th.style.display='inline-block'; }
    const oi=overlay.querySelector('#anpStampOverlayImg'); if(oi) oi.src=ev.target.result;
    if(!aStampDirty){
      const cv=overlay.querySelector('#anpCv'), r2=cv.getBoundingClientRect();
      aStampPlace.aspect=im.naturalWidth/Math.max(1,im.naturalHeight);
      const baseW=Math.min(r2.width,r2.height)*0.4;
      aStampPlace.w=baseW; aStampPlace.h=baseW/aStampPlace.aspect;
      aStampPlace.cx=r2.width/2; aStampPlace.cy=r2.height/2; aStampPlace.rot=0;
    } else {
      aStampPlace.aspect=im.naturalWidth/Math.max(1,im.naturalHeight);
    }
    if(!aStampMode) aSetStampMode(true);
    /* 🐞 [같이 고침] 찍기·취소·초기화 버튼은 aSetStampMode(true) 안에서만 노출됐다.
       그런데 [이미지] 로 도장 모드를 **먼저 켠 뒤** 불러오기를 누르는 것이 보통 순서라,
       그때는 aStampMode 가 이미 true 여서 위 줄이 실행되지 않는다 → 이미지는 떴는데
       버튼 셋이 계속 숨어 있었다(Enter 로만 찍을 수 있었다).
       인간 생성기(loadStampFromFile)는 이 자리에서 직접 노출한다 — 같은 규약으로 맞춘다. */
    ['#anpStampApply','#anpStampCancel','#anpStampReset'].forEach(sel=>{
      const b=overlay.querySelector(sel); if(b) b.style.display='inline-block';
    });
    aRefreshStampOverlay();
  }; im.src=ev.target.result; };
  r.readAsDataURL(file);
}
/* 격자 투영 찍기 — 인간 commitStamp와 동일 알고리즘 (대상만 동물 face+body) */
function aCommitStamp(){
  if(!aStampImg||!model)return;
  const cv=overlay.querySelector('#anpCv'), r=cv.getBoundingClientRect();
  // ★ 원본과 미러가 '같은' 오프스크린을 공유한다. 따로 그리면 둘이 겹치는 부분에서 알파가 두 번 쌓인다.
  const off=document.createElement('canvas'); off.width=P_SZ; off.height=P_SZ;
  const ctx=off.getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  const doOnce=(cx)=>{
    const cy=aStampPlace.cy, w=aStampPlace.w, h=aStampPlace.h, rot=aStampPlace.rot;
    const cs=Math.cos(rot), sn=Math.sin(rot);
    const N=18, uvs=[];
    for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*w, ly=(j/N-0.5)*h;
      const sx=cx+lx*cs-ly*sn, sy=cy+lx*sn+ly*cs;
      _pN.x=(sx/r.width)*2-1; _pN.y=-(sy/r.height)*2+1;
      _pRay.setFromCamera(_pN,cam);
      const hit=_pRay.intersectObjects(_pTargets(),false);
      uvs.push(hit.length&&hit[0].uv?{x:hit[0].uv.x,y:hit[0].uv.y}:null);
    }
    /* 가장자리 외삽.
       ★ 예전엔 (-0.05~1.05) 안이기만 하면 무제한으로 채우고 0~1로 잘랐다. 잘린 값들이
         '텍스처 가장자리의 같은 좌표'로 뭉쳐서, 여러 칸이 이미지를 같은 자리에 겹쳐 그리며
         띠처럼 번지는 자국을 남긴다(= 제보된 빗금). 투명 PNG는 그 부분이 투명이라 잘 안 보이고
         배경이 있는 PNG로 찍으면 그대로 드러난다.
       → 인간판(app.js commitStamp)과 동일하게, 방향당 EXTRA_MAX칸까지만 채우고
         범위를 벗어난 값은 아예 채우지 않는다(잘라서 살리지 않는다). */
    const EXTRA_MAX = 2;
    function tryE(arr,i,j,uv){
      if(uv.x<0||uv.x>1||uv.y<0||uv.y>1) return false;   // 메시 밖 = 뭉개짐의 원인 → 폐기
      arr[j*(N+1)+i]={x:uv.x,y:uv.y}; return true; }
    for(let j=0;j<=N;j++){
      let i1=-1,i2=-1;
      for(let i=0;i<=N;i++){ if(uvs[j*(N+1)+i]){ if(i1<0)i1=i; else if(i2<0){i2=i;break;} } }
      if(i1>=0&&i2>=0){ const u1=uvs[j*(N+1)+i1],u2=uvs[j*(N+1)+i2],dx=(u2.x-u1.x)/(i2-i1),dy=(u2.y-u1.y)/(i2-i1);
        for(let i=i1-1;i>=0&&i>i1-1-EXTRA_MAX;i--){ if(!tryE(uvs,i,j,{x:u1.x+dx*(i-i1),y:u1.y+dy*(i-i1)})) break; } }
      let k1=-1,k2=-1;
      for(let i=N;i>=0;i--){ if(uvs[j*(N+1)+i]){ if(k1<0)k1=i; else if(k2<0){k2=i;break;} } }
      if(k1>=0&&k2>=0){ const u1=uvs[j*(N+1)+k1],u2=uvs[j*(N+1)+k2],dx=(u1.x-u2.x)/(k1-k2),dy=(u1.y-u2.y)/(k1-k2);
        for(let i=k1+1;i<=N&&i<k1+1+EXTRA_MAX;i++){ if(!tryE(uvs,i,j,{x:u1.x+dx*(i-k1),y:u1.y+dy*(i-k1)})) break; } }
    }
    for(let i=0;i<=N;i++){
      let j1=-1,j2=-1;
      for(let j=0;j<=N;j++){ if(uvs[j*(N+1)+i]){ if(j1<0)j1=j; else if(j2<0){j2=j;break;} } }
      if(j1>=0&&j2>=0){ const u1=uvs[j1*(N+1)+i],u2=uvs[j2*(N+1)+i],dx=(u2.x-u1.x)/(j2-j1),dy=(u2.y-u1.y)/(j2-j1);
        for(let j=j1-1;j>=0&&j>j1-1-EXTRA_MAX;j--){ if(!tryE(uvs,i,j,{x:u1.x+dx*(j-j1),y:u1.y+dy*(j-j1)})) break; } }
      let m1=-1,m2=-1;
      for(let j=N;j>=0;j--){ if(uvs[j*(N+1)+i]){ if(m1<0)m1=j; else if(m2<0){m2=j;break;} } }
      if(m1>=0&&m2>=0){ const u1=uvs[m1*(N+1)+i],u2=uvs[m2*(N+1)+i],dx=(u1.x-u2.x)/(m1-m2),dy=(u1.y-u2.y)/(m1-m2);
        for(let j=m1+1;j<=N&&j<m1+1+EXTRA_MAX;j++){ if(!tryE(uvs,i,j,{x:u1.x+dx*(j-m1),y:u1.y+dy*(j-m1)})) break; } }
    }
    /* ★ 삼각형을 픽셀 단위로 직접 래스터화한다 (clip + drawImage 사용 안 함).
       [왜] 캔버스의 clip 경계는 안티앨리어싱된다. 그래서 어떤 합성 모드를 써도 이음매가 남는다.
         · source-over + 부풀리기 → 겹침 띠에서 알파가 두 번 쌓임 → '진한' 빗금
                                    (투명 PNG는 0.5→0.75로 확 진해짐)
         · copy + 부풀리기        → 나중 삼각형의 AA 경계가 이웃이 그려둔 픽셀을 지움 → '밝은' 빗금
       둘 다 실패했다. 원인이 AA 경계라 합성 모드로는 못 고친다.
       [해결] 목적지 픽셀마다 삼각형 내부인지 직접 판정하고, 역아핀으로 원본 좌표를 구해
         이중선형 샘플링한 값을 '덮어쓴다'. 겹쳐도 같은 값이라 이음매가 원리적으로 안 생기고,
         알파도 원본 그대로다. 경계는 0.5px 여유를 줘서 인접 삼각형이 같은 픽셀을 덮게 한다.
       [비용] 512² 한 번 = 최대 26만 픽셀. 도장 찍을 때 1회뿐이라 체감되지 않는다. */
    const imgW=aStampImg.naturalWidth, imgH=aStampImg.naturalHeight;
    const _sc=document.createElement('canvas'); _sc.width=imgW; _sc.height=imgH;
    _sc.getContext('2d').drawImage(aStampImg,0,0);
    const srcD=_sc.getContext('2d').getImageData(0,0,imgW,imgH).data;
    const dstImg=ctx.createImageData(P_SZ,P_SZ), dstD=dstImg.data;
    function sampleSrc(u,v,o){
      // 이중선형 — 격자가 성겨도 부드럽게. 범위 밖은 가장자리로 클램프.
      let x=Math.min(imgW-1,Math.max(0,u-0.5)), y=Math.min(imgH-1,Math.max(0,v-0.5));
      const x0=Math.floor(x), y0=Math.floor(y);
      const x1=Math.min(imgW-1,x0+1), y1=Math.min(imgH-1,y0+1);
      const fx=x-x0, fy=y-y0;
      for(let k=0;k<4;k++){
        const p00=srcD[(y0*imgW+x0)*4+k], p10=srcD[(y0*imgW+x1)*4+k];
        const p01=srcD[(y1*imgW+x0)*4+k], p11=srcD[(y1*imgW+x1)*4+k];
        dstD[o+k] = (p00*(1-fx)+p10*fx)*(1-fy) + (p01*(1-fx)+p11*fx)*fy;
      }
    }
    /* UV 점프 가드 — 도장이 실루엣 가장자리를 벗어나면 스치는 레이가 옆면·이음새에 맞아
       인접 격자점 UV가 텍스처 반대편으로 벌어진다. 그대로 그리면 엉뚱한 부위에 늘어나 겹쳐 찍힌다. */
    const UV_EDGE_MAX=0.15;
    function _uvFar(p,q){ const dx=p.x-q.x, dy=p.y-q.y; return (dx*dx+dy*dy) > UV_EDGE_MAX*UV_EDGE_MAX; }
    function drawTri(s0,s1,s2,d0,d1,d2){
      if(_uvFar(d0,d1)||_uvFar(d1,d2)||_uvFar(d0,d2)) return;
      const ax=d0.x*P_SZ, ay=d0.y*P_SZ, bx=d1.x*P_SZ, by=d1.y*P_SZ, cx2=d2.x*P_SZ, cy2=d2.y*P_SZ;
      const area=(bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay);
      if(Math.abs(area)<1e-6) return;
      const inv=1/area;
      // 0.5px 여유 — 인접 삼각형이 경계 픽셀을 같이 덮어 틈이 안 생기게
      const EPS=0.5/Math.max(1e-6,Math.sqrt(Math.abs(area)));
      const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx2)-1)), x1=Math.min(P_SZ-1,Math.ceil(Math.max(ax,bx,cx2)+1));
      const y0=Math.max(0,Math.floor(Math.min(ay,by,cy2)-1)), y1=Math.min(P_SZ-1,Math.ceil(Math.max(ay,by,cy2)+1));
      for(let y=y0;y<=y1;y++){
        const py=y+0.5;
        for(let x=x0;x<=x1;x++){
          const px=x+0.5;
          // 무게중심 좌표
          const w1=((px-ax)*(cy2-ay)-(cx2-ax)*(py-ay))*inv;
          const w2=((bx-ax)*(py-ay)-(px-ax)*(by-ay))*inv;
          const w0=1-w1-w2;
          if(w0<-EPS||w1<-EPS||w2<-EPS) continue;
          // 같은 무게로 원본(이미지) 좌표를 보간 → 역행렬 계산 불필요
          const u=w0*s0.x+w1*s1.x+w2*s2.x, v=w0*s0.y+w1*s1.y+w2*s2.y;
          sampleSrc(u,v,(y*P_SZ+x)*4);
        }
      }
    }
    for(let j=0;j<N;j++) for(let i=0;i<N;i++){
      const A=uvs[j*(N+1)+i],B=uvs[j*(N+1)+(i+1)],C=uvs[(j+1)*(N+1)+i],D=uvs[(j+1)*(N+1)+(i+1)];
      const s0={x:(i/N)*imgW,y:(j/N)*imgH}, s1={x:((i+1)/N)*imgW,y:(j/N)*imgH};
      const s2={x:(i/N)*imgW,y:((j+1)/N)*imgH}, s3={x:((i+1)/N)*imgW,y:((j+1)/N)*imgH};
      if(A&&B&&C) drawTri(s0,s1,s2,A,B,C);
      if(B&&C&&D) drawTri(s1,s2,s3,B,C,D);
    }
    /* 이번 패스 결과를 공유 오프스크린에 얹는다.
       putImageData는 '덮어쓰기'라 미러 패스가 원본 패스를 지워버린다 → 임시 캔버스를 거쳐
       drawImage(source-over)로 합친다. 원본·미러는 겹치지 않게 위에서 걸러지므로 알파는 안 쌓인다. */
    const _tc=document.createElement('canvas'); _tc.width=P_SZ; _tc.height=P_SZ;
    _tc.getContext('2d').putImageData(dstImg,0,0);
    ctx.drawImage(_tc,0,0);
  };
  pPushHist();
  doOnce(aStampPlace.cx);
  // 대칭이 켜져 있으면 화면 중앙선 기준 미러 위치에 한 번 더 — 중앙 부근(겹침)이면 생략 (인간 규약)
  if(pSym){
    const mcx=r.width-aStampPlace.cx;
    if(Math.abs(mcx-aStampPlace.cx) > aStampPlace.w*0.35) doOnce(mcx);
  }
  // ★ 조립 끝 — 그림 캔버스에 source-over로 딱 한 번 얹는다. 여기서만 알파가 합성되므로
  //   반투명 PNG도 원본 그대로의 농도로 찍힌다.
  {
    const dstCtx=pActC().getContext('2d');
    dstCtx.save();
    dstCtx.globalCompositeOperation='source-over';
    dstCtx.imageSmoothingEnabled=true;
    dstCtx.drawImage(off,0,0);
    dstCtx.restore();
  }
  pBlit();
  if(typeof toast==='function') toast('도장을 찍었어요 (Ctrl+Z=되돌리기)');
}
function aBindStampOverlay(){
  const ov=aStampOv(); if(!ov||ov._bound) return; ov._bound=true;
  const img=overlay.querySelector('#anpStampOverlayImg');
  const cv=overlay.querySelector('#anpCv');
  let drag=null;
  function pos(e){ const r=cv.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  img.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation();
    const p=pos(e); drag={type:'move',sx:p.x,sy:p.y,ox:aStampPlace.cx,oy:aStampPlace.cy};
    img.setPointerCapture(e.pointerId);
  });
  ['tl','tr','bl','br'].forEach(corner=>{
    const hd=ov.querySelector('.stamp-h-'+corner);
    hd.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation();
      const sx=(corner==='tl'||corner==='bl')?-0.5:0.5;
      const sy=(corner==='tl'||corner==='tr')?-0.5:0.5;
      const cs=Math.cos(aStampPlace.rot), sn=Math.sin(aStampPlace.rot);
      const fxL=-sx*aStampPlace.w, fyL=-sy*aStampPlace.h;
      drag={type:corner, sx, sy,
        fixedX:aStampPlace.cx+fxL*cs-fyL*sn, fixedY:aStampPlace.cy+fxL*sn+fyL*cs,
        oAspect:aStampPlace.aspect||(aStampPlace.w/Math.max(1,aStampPlace.h))};
      hd.setPointerCapture(e.pointerId);
    });
  });
  const rh=ov.querySelector('.stamp-h-rot');
  rh.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation();
    const p=pos(e); drag={type:'rot',startAng:Math.atan2(p.y-aStampPlace.cy,p.x-aStampPlace.cx),oRot:aStampPlace.rot};
    rh.setPointerCapture(e.pointerId);
  });
  const rs=ov.querySelector('.stamp-h-reset');
  if(rs){ rs.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
    rs.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();aResetStampPlacement();}); }
  function onMove(e){ if(!drag)return; const p=pos(e);
    if(drag.type==='move'){
      aStampPlace.cx=drag.ox+(p.x-drag.sx); aStampPlace.cy=drag.oy+(p.y-drag.sy);
      if(e.shiftKey){ aStampPlace.cx=cv.getBoundingClientRect().width/2; }   // Shift=가로 중앙 스냅
    }
    else if(drag.type==='rot'){
      let rr=drag.oRot+(Math.atan2(p.y-aStampPlace.cy,p.x-aStampPlace.cx)-drag.startAng);
      if(e.shiftKey){ const st=15*Math.PI/180; rr=Math.round(rr/st)*st; }
      aStampPlace.rot=rr; aStampDirty=true;
    }
    else {
      const cs=Math.cos(-aStampPlace.rot), sn=Math.sin(-aStampPlace.rot);
      const dx=p.x-drag.fixedX, dy=p.y-drag.fixedY;
      const localX=dx*cs-dy*sn, localY=dx*sn+dy*cs;
      let newW=Math.abs(localX), newH=Math.abs(localY);
      newW=Math.max(20,newW); newH=Math.max(20,newH);
      if(e.shiftKey){ const ar=drag.oAspect; if(newW/newH>ar) newH=newW/ar; else newW=newH*ar; }
      aStampPlace.w=newW; aStampPlace.h=newH;
      const cs2=Math.cos(aStampPlace.rot), sn2=Math.sin(aStampPlace.rot);
      const cxL=drag.sx*newW, cyL=drag.sy*newH;
      aStampPlace.cx=drag.fixedX+cxL*cs2-cyL*sn2;
      aStampPlace.cy=drag.fixedY+cxL*sn2+cyL*cs2;
      aStampDirty=true;
    }
    aRefreshStampOverlay();
  }
  function onUp(){ drag=null; }
  addEventListener('pointermove',onMove);
  addEventListener('pointerup',onUp);
  addEventListener('pointercancel',onUp);
}
const P_PALETTE=['#333333','#ffffff','#e05a6d','#4a7fd4','#e8a33d','#7a5233','#b0b0b0'];

function _mkCv(){ const c=document.createElement('canvas'); c.width=c.height=P_SZ; return c; }
function ensurePaintTex(){
  if(!pFaceC){ pFaceC=_mkCv(); pBlinkC=_mkCv(); pDispC=_mkCv(); }
  if(!pTex){
    pTex=new THREE.CanvasTexture(pDispC);
    pTex.flipY=false; pTex.encoding=THREE.sRGBEncoding;   // GLB UV 규약 — 인간 dispTex와 동일 설정
  }
  // 동물 재질에 텍스처 연결 + 흰색 곱 (귀 포함 — 같은 재질 계열이면 같이 칠해짐)
  // 귀 메쉬 집합 — 몸 텍스처(pTex) 대상에서 제외하고, 대신 귀 전용 텍스처를 물림
  const earSet=new Set();
  [earObjL,earObjR].forEach(w=>{ if(w) w.traverse(o=>{ if(o.isMesh) earSet.add(o); }); });
  const setMat=(o,tex)=>{ if(!(o&&o.isMesh&&o.material))return;
    o.material.map=tex; o.material.color.set('#ffffff');
    if('roughness' in o.material) o.material.roughness=0.85;
    if('metalness' in o.material) o.material.metalness=0;
    if('emissive' in o.material && o.material.emissive) o.material.emissive.set('#000000');
    o.material.needsUpdate=true;
  };
  // 몸/얼굴 — pTex (귀 제외)
  if(model) model.traverse(o=>{ if(o.isMesh && !earSet.has(o)) setMat(o,pTex); });
  // 귀 — 좌/우 각각 전용 텍스처
  ['L','R'].forEach(side=>_ensureEarTex(side));
  pBlit();
}
function pActC(){ return paintTab==='blink' ? pBlinkC : pFaceC; }
function pBlit(){
  if(!pDispC) return;
  const x=pDispC.getContext('2d');
  x.clearRect(0,0,P_SZ,P_SZ);
  x.fillStyle='#ffffff'; x.fillRect(0,0,P_SZ,P_SZ);   // 안 칠한 곳 = 흰색(기본색). 배경(옅은 회색)과 구분됨
  x.drawImage(pActC(),0,0);
  if(pTex) pTex.needsUpdate=true;
}
function _ensureEarTex(side){
  const w = side==='L'?earObjL:earObjR; if(!w) return;
  const e=pEar[side];
  _ensureEarCv(side);
  if(!e.tex){ e.tex=new THREE.CanvasTexture(e.disp); e.tex.flipY=false; e.tex.encoding=THREE.sRGBEncoding; }
  w.traverse(o=>{ if(o.isMesh&&o.material){
    o.material.map=e.tex; o.material.color.set('#ffffff');
    if('roughness' in o.material) o.material.roughness=0.85;
    if('metalness' in o.material) o.material.metalness=0;
    if('emissive' in o.material && o.material.emissive) o.material.emissive.set('#000000');
    o.material.needsUpdate=true;
  } });
  _blitEar(side);
}
function _blitEar(side){
  const e=pEar[side]; if(!e || !e.disp) return;
  const src=_earDraw(side); if(!src) return;
  const x=e.disp.getContext('2d');
  x.clearRect(0,0,P_SZ,P_SZ); x.fillStyle='#ffffff'; x.fillRect(0,0,P_SZ,P_SZ);
  x.drawImage(src,0,0);
  if(e.tex) e.tex.needsUpdate=true;
}
/* ★ 되돌리기 스냅샷은 '세트'(몸/얼굴 + 귀L + 귀R)로 찍는다.
   예전엔 활성 탭(face/blink) 캔버스 한 장만 찍어서:
     ・ 귀에 그린 스트로크는 이력에 아예 없고,
     ・ 귀에 그리다 Ctrl+Z를 누르면 귀는 그대로인 채 쌓여 있던 '얼굴' 스냅샷이 pop되어
       얼굴이 과거로 되돌아갔다(제보된 증상).
   한 스트로크가 대칭 모드로 몸+귀를 동시에 칠할 수도 있으므로, 대상별 분기가 아니라
   세트 전체를 찍고 세트로 복원하는 것이 어떤 조합에서도 정확하다.
   메모리: 512px 캔버스 3장/스냅샷 × 한도 12개 ≈ 12MB 수준 — 한도를 25→12로 줄여 상쇄. */
function _pSnapSet(){
  const set={};
  set.body=_mkCv(); set.body.getContext('2d').drawImage(pActC(),0,0);
  /* 🧠 아직 아무것도 안 칠한 귀는 **캔버스를 뜨지 않는다** — 되돌릴 내용이 «비어 있음» 하나뿐이라
     1MB 를 복사할 이유가 없다. 귀를 칠하기 전까지는 스냅샷이 3장에서 1장으로 줄어든다.
     ⚠️ 그냥 건너뛰면 안 된다. 이 스트로크에서 처음으로 귀를 칠한 경우, 되돌리기가 «비우기»를
       해야 하는데 표식이 없으면 칠한 것이 그대로 남는다. 그래서 blank 표식을 반드시 남긴다. */
  ['L','R'].forEach(sd=>{ const d=_earDraw(sd);
    if(!d) return;
    if(_cvBlank(d)){ set['ear'+sd+'Blank']=true; return; }
    const c=_mkCv(); c.getContext('2d').drawImage(d,0,0); set['ear'+sd]=c; });
  return set;
}
function _pRestoreSet(set){
  if(set.body){ const x=pActC().getContext('2d'); x.clearRect(0,0,P_SZ,P_SZ); x.drawImage(set.body,0,0); }
  ['L','R'].forEach(sd=>{ const sn=set['ear'+sd]; const d=_earDraw(sd);
    if(!d) return;
    if(sn){ const x=d.getContext('2d'); x.clearRect(0,0,P_SZ,P_SZ); x.drawImage(sn,0,0); _blitEar(sd); }
    // ★ 스냅샷 시점에 비어 있던 귀 — 그 뒤에 칠한 것을 되돌리려면 여기서 «비우기»를 해야 한다
    else if(set['ear'+sd+'Blank']){ d.getContext('2d').clearRect(0,0,P_SZ,P_SZ); _blitEar(sd); } });
  pBlit();
}
function pPushHist(){
  const key=paintTab==='blink'?'blink':'face';
  if(key==='blink') _blinkTouched=true;
  pHist[key].push(_pSnapSet());
  if(pHist[key].length>12) _freeSnapSet(pHist[key].shift());   // 밀려난 스냅샷은 그 자리에서 반납
  pRedo[key].forEach(_freeSnapSet);
  pRedo[key].length=0;   // 새 작업이 시작되면 '다시 실행' 갈래는 사라짐 (일반 규약)
}
function pUndo(){
  const key=paintTab==='blink'?'blink':'face';
  const snap=pHist[key].pop(); if(!snap) return;
  pRedo[key].push(_pSnapSet());
  _pRestoreSet(snap);
}
function pRedoDo(){
  const key=paintTab==='blink'?'blink':'face';
  const snap=pRedo[key].pop(); if(!snap) return;
  pHist[key].push(_pSnapSet());
  _pRestoreSet(snap);
}
function pFillAll(){
  // 현재 탭 캔버스(몸/얼굴 or 감은눈) + 좌우 귀 캔버스를 선택 색으로 가득 채움 (지우기와 동일 범위)
  pPushHist();
  const fill=(c)=>{ const x=c.getContext('2d'); x.globalCompositeOperation='source-over'; x.fillStyle=pColor; x.fillRect(0,0,P_SZ,P_SZ); };
  const fillEars=()=>{ ['L','R'].forEach(side=>{ const d=_earDraw(side); if(d){ fill(d); _blitEar(side); } }); };
  if((pPartMask==='face'||pPartMask==='body') && paintTab!=='blink'){
    /* ★ 얼굴과 몸은 텍스처(캔버스) 한 장을 공유한다 — 부위별로 갈라 채울 방법이 없다(귀만 별도 캔버스).
       [바뀐 이력] 예전엔 그래서 실행을 막고 "잠금을 풀고 써주세요"만 띄웠다. 그런데 그러면 얼굴이나
         몸을 잠가둔 사람은 전체 채우기를 아예 못 쓰고, 쓰려면 잠금을 껐다 켜야 했다.
         이제는 막지 않고 둘 다 채운 뒤 **왜 같이 칠해졌는지 알린다**(요청사항).
       ⚠️ 귀는 건드리지 않는다 — 얼굴·몸만 잠근 사람에게 귀까지 덮이면 그건 진짜 사고다.
       ⚠️ 감은눈 탭은 캔버스가 따로라 이 안내가 거짓말이 된다 — 그래서 조건에서 뺐다(아래 else 로 간다).
       ⚠️ 잠금의 약속을 한 번 깨는 동작이므로 안내는 반드시 띄운다. 위 pPushHist 덕분에
         Ctrl+Z 한 번으로 되돌아간다 — 안내에 그 사실을 같이 적는다. */
    fill(pActC()); pBlit();
    if(typeof toast==='function') toast('얼굴·몸은 텍스처 한 장을 공유해요 — 둘 다 채웠어요 (되돌리기 Ctrl+Z)');
    return;
  }
  if(pPartMask==='ear'){   // 귀만 모드: 귀 캔버스만 채움
    fillEars();
  } else {
    /* 🐾 귀도 탭별로 캔버스가 갈렸으므로 감은눈 탭에서도 함께 채운다 — 채워지는 것은
       그 탭의 귀 캔버스뿐이라 표정 쪽 귀는 그대로 남는다(예전엔 한 장이라 일부러 뺐던 자리). */
    fill(pActC()); pBlit();
    fillEars();
  }
  if(typeof toast==='function') toast('전체를 채웠어요');
}
function pClearAll(){
  pPushHist();
  const clr=(c)=>c.getContext('2d').clearRect(0,0,P_SZ,P_SZ);
  if(pPartMask==='face'||pPartMask==='body'){
    if(typeof toast==='function') toast('얼굴·몸은 텍스처 한 장을 공유해요 — 전체 지우기는 잠금을 풀고 써주세요');
    return;
  }
  /* 🐾 지우는 것은 **지금 탭의** 귀 캔버스뿐이다. 예전엔 귀가 한 장이라 감은눈 탭에서 전체 지우기를
     하면 표정 쪽 귀까지 같이 사라졌다. */
  if(pPartMask==='ear'){   // 귀만 모드 — 귀 캔버스만 지움 (몸/얼굴 보존)
    ['L','R'].forEach(side=>{ const d=_earDraw(side); if(d){ clr(d); _blitEar(side); } });
    return;
  }
  clr(pActC()); pBlit();
  ['L','R'].forEach(side=>{ const d=_earDraw(side); if(d){ clr(d); _blitEar(side); } });
}
function pStroke(x0,y0,x1,y1,target){
  const ctx=(target||pActC()).getContext('2d');
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.globalCompositeOperation = pEraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle=pColor; ctx.lineWidth=pSize;
  ctx.beginPath();
  ctx.moveTo(x0==null?x1:x0, y0==null?y1:y0);
  ctx.lineTo(x1,y1); ctx.stroke();
  ctx.globalCompositeOperation='source-over';
}
const _pRay=new THREE.Raycaster(), _pN=new THREE.Vector2();
function pHit(e){
  const cv=overlay.querySelector('#anpCv'); if(!cv||!cam) return null;
  const r=cv.getBoundingClientRect();
  _pN.x=((e.clientX-r.left)/r.width)*2-1; _pN.y=-((e.clientY-r.top)/r.height)*2+1;
  _pRay.setFromCamera(_pN,cam);
  const hit=_pRay.intersectObjects(_pTargets(),false);
  return (hit.length&&hit[0].uv) ? hit[0] : null;
}
const _mP=new THREE.Vector3(), _mN=new THREE.Vector3(), _mO=new THREE.Vector3(), _mD=new THREE.Vector3(), _mRay=new THREE.Raycaster();
function _pTargets(){
  const t=[]; if(model) model.traverse(o=>{ if(o.isMesh&&o.visible) t.push(o); });
  return t;   // 몸+얼굴+귀 모두 — model.traverse에 귀(자식)도 포함됨
}
// 히트한 메쉬가 어느 페인트 캔버스에 속하는지 판별 → {draw, disp, blit}
/* 히트한 메시가 얼굴(face1~4)인지 — 얼굴형 4종 중 보이는 하나만 faceNodes에 들어있다.
   자식 메시까지 고려해 부모 체인을 따라 올라가며 확인한다. */
function _isFaceMesh(mesh){
  for(const fn of faceNodes){
    if(!fn) continue;
    let o=mesh; while(o){ if(o===fn) return true; o=o.parent; }
  }
  return false;
}
function _canvasForMesh(mesh){
  for(const side of ['L','R']){
    const w = side==='L'?earObjL:earObjR;
    if(w){ let hit=false; w.traverse(o=>{ if(o===mesh) hit=true; });
      if(hit){ _ensureEarCv(side); return {draw:_earDraw(side), blit:()=>_blitEar(side), isEar:true, part:'ear'}; } }
  }
  // 몸/얼굴은 같은 캔버스를 쓰지만 부위는 구분해서 알려준다(부위 잠금용)
  return {draw:pActC(), blit:pBlit, isEar:false, part:_isFaceMesh(mesh)?'face':'body'};
}
/* 지금 잠금 설정에서 이 부위를 칠해도 되는가 */
function _partAllowed(tgt){ return !pPartMask || (tgt && tgt.part===pPartMask); }
function _pMirrorHit(hit){
  if(!model||!hit||!hit.point) return null;
  _mP.copy(hit.point); model.worldToLocal(_mP); _mP.x=-_mP.x; model.localToWorld(_mP);
  const n=hit.face&&hit.face.normal;
  if(n && hit.object){ _mN.set(-n.x,n.y,n.z).transformDirection(hit.object.matrixWorld).normalize(); }
  else { _mN.copy(cam.position).sub(_mP).normalize(); }
  _mO.copy(_mP).addScaledVector(_mN,0.6); _mD.copy(_mN).negate(); _mRay.set(_mO,_mD);
  const h=_mRay.intersectObjects(_pTargets(),false);
  return (h.length&&h[0].uv) ? h[0] : null;
}
function pMirrorUV(hit){
  // 인간 mirrorUV와 동일 원리 — 표면점을 모델 로컬 x 대칭으로 반전해 반대편 표면을 재레이캐스트
  if(!model||!hit||!hit.point) return null;
  _mP.copy(hit.point); model.worldToLocal(_mP); _mP.x=-_mP.x; model.localToWorld(_mP);
  const n=hit.face&&hit.face.normal;
  if(n && hit.object){ _mN.set(-n.x,n.y,n.z).transformDirection(hit.object.matrixWorld).normalize(); }
  else { _mN.copy(cam.position).sub(_mP).normalize(); }
  _mO.copy(_mP).addScaledVector(_mN,0.6);
  _mD.copy(_mN).negate();
  _mRay.set(_mO,_mD);
  const h=_mRay.intersectObjects(_pTargets(),false);
  return (h.length&&h[0].uv) ? h[0].uv : null;
}
function pPaintEvent(e, isStart){
  const hit=pHit(e);
  if(!hit){ pLastX=pLastY=null; pLastSX=pLastSY=null; return; }
  const uv=hit.uv;
  const cx=uv.x*P_SZ, cy=uv.y*P_SZ;   // flipY=false 규약 — uv 그대로 (인간과 동일)
  const tgt=_canvasForMesh(hit.object);   // 히트한 메쉬 소속 캔버스(몸/얼굴 or 귀L/R)
  if(!_partAllowed(tgt)){ pLastX=pLastY=null; return; }   // 부위 잠금(귀만/얼굴만/몸만): 다른 부위 히트는 무시
  // UV 점프 가드
  if(pLastX!=null && (Math.abs(cx-pLastX)+Math.abs(cy-pLastY)) > P_SZ*0.18){ pLastX=pLastY=null; }
  pStroke(pLastX,pLastY,cx,cy,tgt.draw); pLastX=cx; pLastY=cy;
  tgt.blit();
  if(pSym){
    const mh=_pMirrorHit(hit);
    if(mh){ const mt=_canvasForMesh(mh.object);
      if(_partAllowed(mt)){   // 잠금 중이면 다른 부위로 간 미러는 생략
        const mx=mh.uv.x*P_SZ, my=mh.uv.y*P_SZ;
        if(pLastSX!=null && (Math.abs(mx-pLastSX)+Math.abs(my-pLastSY)) > P_SZ*0.18){ pLastSX=pLastSY=null; }
        pStroke(pLastSX,pLastSY,mx,my,mt.draw); pLastSX=mx; pLastSY=my; mt.blit();
      } else pLastSX=pLastSY=null;
    }
    else { pLastSX=pLastSY=null; }
  }
  return;
  pBlit();
}
function pPickColor(e){
  const h=pHit(e); const uv=h&&h.uv; if(!uv||!pDispC) return;
  const d=pDispC.getContext('2d').getImageData(Math.floor(uv.x*P_SZ),Math.floor(uv.y*P_SZ),1,1).data;
  pColor='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  syncPaintUI();
}
function syncPaintUI(){
  if(!overlay) return;
  const lab=overlay.querySelector('#anpPaintLabel');
  if(lab) lab.textContent = paintTab==='blink' ? '감은 눈 그리기' : '표정 + 몸 무늬 그리기';
  const cf=overlay.querySelector('#anpCopyFace'); if(cf) cf.style.display = paintTab==='blink' ? '' : 'none';
  /* 🙂 [⟳ 감은눈 복사]는 표정 탭에서만. 감은눈을 한 번도 안 그렸으면 그 캔버스는 비어 있어
     복사할 것이 없다 — 눌리면 표정·몸 무늬가 지워지므로 잠그고, **왜 잠겼는지 툴팁에 적는다**
     (그냥 흐려만 두면 "버튼이 고장났다"가 된다). */
  const cb=overlay.querySelector('#anpCopyBlink');
  if(cb){
    cb.style.display = paintTab==='face' ? '' : 'none';
    cb.disabled = !_blinkTouched;
    cb.title = _blinkTouched ? '감은눈 그림을 표정으로 가져와요 (되돌리기 가능)'
                             : '아직 감은눈을 그린 적이 없어요 — 4 감은눈 탭에서 먼저 그려주세요';
  }
  const er=overlay.querySelector('#anpEraser'); if(er) er.classList.toggle('on', pEraser);   // 인간과 같은 on 표시
  const sy=overlay.querySelector('#anpSym'); if(sy) sy.classList.toggle('on', pSym);
  const swEl=overlay.querySelector('#anpBrushColors');
  if(swEl && !swEl.children.length){
    // 인간 생성기와 같은 5색·같은 칩 마크업(.sw) — 크기·모양이 전역 CSS로 동일해짐
    ['#333333','#ffffff','#e0607a','#5a8fd8','#e0a050'].forEach((c,i)=>{
      const sw=document.createElement('span');
      sw.className='sw'+(i===0?' on':''); sw.style.background=c;
      sw.onclick=()=>{ pColor=c; pEraser=false; syncPaintUI(); [...swEl.children].forEach(x=>x.classList.toggle('on',x===sw)); };
      swEl.appendChild(sw);
    });
  }
}

/* ═══ 4단계: 슬롯 저장 (실행화면 렌더는 다음 단계) ═══ */
/* 재편집 컨텍스트 — reopenAnimalCreator가 채우고, 동물 카드(신규 생성) 클릭 시 비운다.
   _editSrcDef: 편집 전 원본 def(책상·좌석·아이템 설정 보존용 밑바탕)
   _editSeat  : 실행화면 우클릭으로 들어온 경우의 좌석(저장 후 그 좌석에 되돌려줌) */
let _editSrcDef=null, _editSeat=null;
// ★ 런처 빈 슬롯의 [＋]로 진입했을 때 확정된 칸 번호. 아래 '추론 체인'보다 항상 우선한다.
let _targetSlot=null;
function _cvToDataURL(c){ return c ? c.toDataURL('image/png') : null; }
/* ★ def.face/blink에 캔버스를 '그대로' 넣으면 pFaceC/pBlinkC는 모듈 전역이라 모든 동물 슬롯이 같은 캔버스를
   공유하게 된다(한쪽을 고치면 다른 슬롯도 같이 바뀜). 인간 경로가 snapCanvas로 복사본을 넣는 것과 동일하게 맞춤. */
function _cvCopy(c){ if(!c) return null; const d=_mkCv(); d.getContext('2d').drawImage(c,0,0); return d; }
function saveAnimalSlot(){
  /* 🙈 저장 직전에 부위 잠금을 풀고 얼굴을 되살린다 — '몸만'으로 얼굴을 숨겨 둔 채 저장하면
     이 미리보기 장면에서 뽑는 그림(썸네일 등)에 얼굴 없는 동물이 박힐 수 있다.
     저장은 어차피 다음 단계(책상·좌석)로 넘어가는 지점이라 잠금을 유지할 이유가 없다. */
  if(pPartMask){
    pPartMask = null;
    if(overlay) overlay.querySelectorAll('#anpEarMask,#anpFaceMask,#anpBodyMask')
      .forEach(b=>{ if(b) b.checked=false; });
    applyFace();
  }
  // 동물 def — 구버전 호환: 'animal' 표식 + 확장 필드. 구버전은 이 필드를 모르면 인간으로 폴백.
  //   기존 인간 슬롯 구조(slotToObj)의 face/blink(PNG dataURL)를 그대로 재사용하고,
  //   동물 전용 정보(얼굴형·크기·귀·페인트)는 animalXXX 필드로 얹는다.
  ensurePaintTex();
  // ★ 재편집이면 원본 def를 밑바탕으로 병합한다. 예전엔 완전히 새 객체를 만들어서
  //   xf(좌석 크기·앞뒤·회전)·deskColor·deskItems·deskGlb·deskScale·deskLenX·customItems 등
  //   동물 창 밖에서 설정한 값이 통째로 사라졌음(텍스처만 고쳤는데 책상이 초기화되던 원인).
  const def = Object.assign({}, _editSrcDef || {}, {
    type:'creator', animal:true, skin:0, top:'#ffffff', bot:'#ffffff',
    // 표정/감은눈 — 인간과 같은 필드 (실행 렌더가 이걸 face 텍스처로 씀)
    face: _cvCopy(pFaceC), blink: _cvCopy(pBlinkC),   // slotToObj가 .toDataURL을 부르므로 캔버스로 전달(단, 반드시 복사본)
    // 동물 전용
    animalFace: curFace,
    animalScl: { x:scl.x, y:scl.y, all:scl.all },
    animalEarL: curEarL, animalEarR: curEarR,
    animalEarAdj: JSON.parse(JSON.stringify(earAdj)),
    animalBody: _cvToDataURL(pFaceC),         // 몸/얼굴 무늬
    animalEarPaintL: _cvToDataURL(pEar.L.face),
    animalEarPaintR: _cvToDataURL(pEar.R.face),
    /* 🐾 감은눈 귀 — 새 필드. 옛 필드명(animalEarPaintL/R)은 **표정 쪽**을 계속 가리키므로
       구버전 클라이언트가 이 def 를 읽어도 지금까지와 똑같이 표정 귀로 렌더된다. */
    animalEarBlinkL: _cvToDataURL(pEar.L.blink),
    animalEarBlinkR: _cvToDataURL(pEar.R.blink),
    animalBlink: _cvToDataURL(pBlinkC)
  });
  // 썸네일 — 현재 미리보기 렌더를 캡처 (인간 def.thumb과 같은 역할)
  try{ if(renderer && renderer.domElement){ renderer.render(scene,cam); def.thumb=renderer.domElement.toDataURL('image/png'); } }catch(_){}
  // 슬롯에 저장 — 인간과 동일 경로(slots/curSlot/saveSlots)
  // ── 실행화면 우클릭으로 들어온 좌석 편집: 그 좌석에 직접 반영하고 좌석 모드로 되돌아간다.
  //   이 분기가 없어서 좌석 편집이 (아래 else 경로를 타고) 엉뚱한 빈 슬롯에 저장되고,
  //   openCreator를 slot 모드로 갈아타 버려서 실행 중인 캐릭터엔 영원히 반영되지 않았음.
  if(_editSeat){
    const seatRef=_editSeat;
    try{
      if(typeof applyCharToSeat==='function') applyCharToSeat(seatRef, def);
      // 슬롯 저장은 crDone의 seat 분기와 같은 규칙 — 좌석에 slot이 없으면 내 좌석일 때만 curSlot으로 폴백
      const idx = (seatRef.slot!=null) ? seatRef.slot : (seatRef.isMe ? curSlot : null);
      if(idx!=null){ slots[idx]=def; if(seatRef.slot==null) seatRef.slot=idx; }
      if(typeof saveSlots==='function') saveSlots();
      if(seatRef.isMe && typeof Presence!=='undefined' && Presence.active && Presence.active() && Presence.updateDef) Presence.updateDef(def);
      if(typeof layoutSeats==='function') layoutSeats();
    }catch(e){ console.warn('[동물] 좌석 반영 실패',e); if(typeof toast==='function') toast('반영에 실패했어요 (콘솔 확인)'); return; }
    closePreview();
    try{
      if(typeof openCreator==='function'){
        openCreator({kind:'seat', seat:seatRef});
        if(typeof toast==='function') toast('🐾 수정했어요 — 책상·좌석을 확인하고 저장하세요');
      }
    }catch(e){ console.warn('[동물] 책상·좌석 진입 실패',e); }
    return;
  }
  let target=null;
  try{
    // ★ 런처 [＋]로 확정된 칸이 최우선 — 아래 추론들은 그 정보가 없을 때만 쓴다.
    if(_targetSlot!=null && !_editSrcDef) target=_targetSlot;
    else if(typeof creatorMode!=='undefined' && creatorMode && creatorMode.edit && creatorMode.slot!=null) target=creatorMode.slot;
    // ★ 재편집인데 creatorMode가 슬롯 번호를 안 들고 있는 경우 — 원본 def가 꽂혀 있는 슬롯을 직접 찾는다.
    //   빈 슬롯을 찾아 저장하면 같은 캐릭터가 하나 더 생기는 '슬롯 증식'이 됨.
    else if(_editSrcDef){ const _i=slots.indexOf(_editSrcDef); if(_i>=0) target=_i; }
    // ★ 여기서부터는 '어디에 저장할지'를 잃은 상태다. 예전엔 마지막에 무조건 curSlot을 썼는데,
    //   슬롯 삭제는 뒤 칸을 앞으로 당기는 방식이라 삭제 직후 curSlot이 '다른 캐릭터'를 가리킨다.
    //   그 상태로 저장하면 아무 안내 없이 남의 캐릭터가 사라진다(실제 제보된 사고).
    //   → 빈 칸을 우선 쓰고, 확실하지 않으면 덮어쓰지 말고 거부한다.
    if(target==null && _editSrcDef && slots[curSlot]===_editSrcDef) target=curSlot;   // 지금 보고 있는 그 캐릭터를 수정 중
    if(target==null || target<0){
      const _empty = slots.findIndex(x=>!x);
      if(_empty>=0) target=_empty;                 // 빈 칸이 있으면 거기에
      else if(!slots[curSlot]) target=curSlot;     // 현재 칸이 비어 있으면 거기에
      else{
        // 덮어쓸 뻔한 상황 — 저장하지 않고 알린다.
        console.warn('[동물] 저장 위치를 정할 수 없어 중단했습니다 (빈 슬롯 없음, 원본 위치 불명)');
        if(typeof toast==='function') toast('저장할 빈 자리가 없어요 — 슬롯을 하나 비우고 다시 시도해 주세요');
        return;
      }
    }
    if(slots[target] && slots[target]!==_editSrcDef){
      // 마지막 방어선: 다른 캐릭터가 들어있는 칸을 덮어쓰려는 경우 확인을 받는다.
      const _nm = (slots[target].animal ? '동물' : '인간') + ' 캐릭터';
      if(!confirm('이 자리에는 이미 '+_nm+'가 있어요.\n덮어쓰면 되돌릴 수 없습니다. 계속할까요?')){
        try{ if(typeof window!=='undefined' && window.focus) window.focus(); }catch(_){}
        return;
      }
      try{ if(typeof window!=='undefined' && window.focus) window.focus(); }catch(_){}
    }
    slots[target]=def; curSlot=target;
    if(typeof saveSlots==='function') saveSlots();
    if(typeof saveCurSlot==='function') saveCurSlot();
    if(typeof renderLauncher==='function') renderLauncher();
  }catch(e){ console.warn('[동물] 슬롯 저장 실패',e); if(typeof toast==='function') toast('저장에 실패했어요 (콘솔 확인)'); return; }
  // 동물 창을 닫고 → 인간 생성기 창의 책상·좌석 세팅 단계로 이어감(같은 슬롯을 편집 모드로 연다).
  //   책상/좌석은 캐릭터 종류와 무관한 환경 세팅이라 기존 시스템을 그대로 연계 재사용.
  const savedIdx=target;
  closePreview();
  try{
    if(typeof openCreator==='function'){
      openCreator({kind:'slot', edit:true, slot:savedIdx});
      if(typeof toast==='function') toast('🐾 이제 책상과 좌석을 설정하고 저장하면 완성돼요');
    }
  }catch(e){ console.warn('[동물] 책상·좌석 진입 실패',e); if(typeof toast==='function') toast('동물 캐릭터를 저장했어요'); }
}
/* 책상·좌석에서 [이전] → 동물 창을 저장된 상태로 복원해 다시 편집 */
/* 🐾 신규 생성용 상태 초기화.
   동물 생성기의 편집 상태(얼굴형·크기·귀·페인트·되돌리기 이력)는 전부 모듈 전역이고,
   loadModel()은 모델이 이미 있으면 그대로 재사용한다. 그래서 초기화를 안 하면
   '생성하기 → 동물'로 새로 들어가도 직전에 만든 동물이 그대로 떠서 수정 화면처럼 보였다.
   ★ creatorMode도 같이 정리한다 — 직전 편집값({edit:true, slot:N})이 남아 있으면
     saveAnimalSlot이 그 슬롯을 덮어써서 기존 캐릭터가 사라진다. */
function _resetAnimalState(){
  try{
    curFace = 0;
    curEarL = null; curEarR = null;
    scl.x = 1; scl.y = 1; scl.all = 1;
    earAdj.L = _earAdjNew(); earAdj.R = _earAdjNew();
    earAdjSide = 'L';
    _blinkTouched = false;
    // 페인트 캔버스·되돌리기 이력 비우기 (캔버스 객체는 재사용하고 내용만 지움)
    [pFaceC, pBlinkC].forEach(c=>{ if(c) c.getContext('2d').clearRect(0,0,P_SZ,P_SZ); });
    ['L','R'].forEach(side=>{ const e=pEar[side]; if(!e) return;
      [e.face, e.blink].forEach(c=>{ if(c) c.getContext('2d').clearRect(0,0,P_SZ,P_SZ); }); });
    _clearPaintHistory();   // ⚠️ length=0 만으로는 캔버스 백킹스토어가 GC 때까지 남는다
    // 모델이 이미 로드돼 있으면 초기화한 값으로 즉시 다시 그림
    if(model){ try{ applyFace(); applyScale(); applyEars(); ensurePaintTex(); }catch(_){} }
    if(typeof markFaceBtns==='function') markFaceBtns();
    // ★ 새로 만드는 것이므로 '빈 슬롯에 저장' 흐름이 되도록 편집 표식을 지운다.
    if(typeof creatorMode!=='undefined' && creatorMode){ creatorMode.edit=false; creatorMode.slot=null; }
  }catch(e){ console.warn('[동물] 신규 상태 초기화 실패', e); }
}
/* ★ 해금 여부를 밖(app.js)에서도 물어볼 수 있게 노출한다.
   이 파일은 IIFE로 감싸져 있어 UNLOCK_LEVEL·myLevel·_cheatUnlocked가 밖에서는 보이지 않는다.
   복제코드 불러오기 등 app.js 쪽 경로가 같은 기준으로 판정하려면 이 창구가 필요하다. */
window._animalUnlockLevel = UNLOCK_LEVEL;
/* ★ 서버에서 내려온 해금 레벨을 적용한다(관리자가 게임 설정에서 변경 → 전 유저 반영).
   카드의 잠금 띠·안내 문구도 즉시 다시 그린다. */
window._setAnimalUnlockLevel = function(lv){
  const n = parseInt(lv, 10);
  if(!isFinite(n) || n < 1 || n > 999) return false;
  if(n === UNLOCK_LEVEL) return true;
  UNLOCK_LEVEL = n;
  window._animalUnlockLevel = n;
  try{ initCard(); }catch(_){}
  return true;
};
window._animalUnlocked = function(){
  try{ return _unlockOk(); }catch(_){ return false; }
};
window.reopenAnimalCreator=function(def){
  // 어디서 돌아왔는지 기억 — 저장 시 원본 def에 병합하고, 좌석 편집이면 그 좌석에 직접 반영한다.
  _editSrcDef = def || null;
  _targetSlot = null;   // ★ 재편집은 원본이 꽂힌 칸을 따라가야 하므로 [＋] 타깃을 비운다
  _editSeat = (typeof creatorMode!=='undefined' && creatorMode && creatorMode.kind==='seat') ? creatorMode.seat : null;
  const _fromLauncher = !!(typeof creatorMode!=='undefined' && creatorMode && creatorMode.cameFromLauncher);
  openPreview();   // 창 열기(모델 로드 등)
  // ★ openPreview는 '지금 런처가 켜져 있나'로 _prevLauncherOn을 정하는데, 이 경로는 인간 생성기가 이미 런처를
  //   꺼둔 상태라 항상 false가 된다. 그러면 closePreview가 런처를 복원하지 않고 → 뒤이은 openCreator의
  //   cameFromLauncher도 false → [완료] 후 closeCreator가 renderLauncher()를 안 불러서 런처가 옛 모습 그대로 남았음.
  //   원래 런처에서 시작한 흐름이면 그 사실을 이어받아 복귀 체인을 정상화한다.
  if(_fromLauncher) _prevLauncherOn = true;
  const restore=()=>{
    if(!model){ setTimeout(restore,120); return; }   // 모델 로드 대기
    try{
      if(def){
        curFace = def.animalFace||0;
        if(def.animalScl){ scl.x=def.animalScl.x||1; scl.y=def.animalScl.y||1; scl.all=def.animalScl.all||1; }
        curEarL = def.animalEarL||null; curEarR = def.animalEarR||null;
        if(def.animalEarAdj){ ['L','R'].forEach(side=>{ if(def.animalEarAdj[side]) earAdj[side]=Object.assign(_earAdjNew(), def.animalEarAdj[side]); }); }
        // 페인트 복원 — 저장된 dataURL을 캔버스에 다시 그림
        ensurePaintTex();
        const load=(url,cv,after)=>{ if(!url){ if(after)after(); return; } const im=new Image(); im.onload=()=>{ const x=cv.getContext('2d'); x.clearRect(0,0,P_SZ,P_SZ); x.drawImage(im,0,0,P_SZ,P_SZ); if(after)after(); }; im.src=url; };
        // ★ load()는 비동기(Image.onload)인데 아래 applyFace()는 즉시 실행된다.
        //   그래서 재질이 '아직 비어 있는 캔버스'로 먼저 만들어지고, 이미지가 도착해도 화면 갱신
        //   신호가 안 가면 얼굴·몸 그림이 빈 채로 남는다(수정 진입 시 텍스처가 늦게/안 뜨던 원인).
        //   → 두 로드 모두 완료 콜백에서 pBlit()으로 텍스처를 갱신한다. blink 쪽은 콜백 자체가 없었음.
        load(def.animalBody, pFaceC, ()=>pBlit());
        load(def.animalBlink, pBlinkC, ()=>{ if(def.animalBlink) _blinkTouched=true; pBlit(); });
        // ★ 귀 페인트 캔버스를 '먼저' 확보한다.
        //   load()는 호출 시점의 캔버스 참조를 들고 가는데, 아래 applyEars() → _ensureEarTex가
        //   e.face/e.blink가 비어 있으면 새 캔버스로 갈아끼운다. 그러면 이미지는 버려진 캔버스에 그려지고
        //   화면에는 빈 텍스처가 남는다(수정하려고 들어가면 귀 그림이 사라지던 원인).
        ['L','R'].forEach(sd=>_ensureEarCv(sd));
        load(def.animalEarPaintL, pEar.L.face, ()=>_blitEar('L'));
        load(def.animalEarPaintR, pEar.R.face, ()=>_blitEar('R'));
        /* 🐾 감은눈 귀 — 없으면(옛 저장본) 표정 귀를 그대로 쓴다. 옛 def 는 귀가 한 장뿐이었고
           그 그림이 두 상태 모두에 쓰이고 있었으므로, 그대로 두 장에 넣는 것이 예전과 같은 결과다.
           ⚠️ 폴백 소스로 def.animalEarPaintL 을 그대로 쓴다 — pEar.L.face 는 위 load 가 비동기라
             이 시점에 아직 비어 있을 수 있다(캔버스를 베끼면 빈 그림이 복사된다). */
        load(def.animalEarBlinkL || def.animalEarPaintL, pEar.L.blink, ()=>_blitEar('L'));
        load(def.animalEarBlinkR || def.animalEarPaintR, pEar.R.blink, ()=>_blitEar('R'));
      }
      applyFace(); applyScale(); markFaceBtns(); applyEars();
      // ★ 텍스처 최종 확정 — load()가 비동기라 위 applyFace() 시점엔 아직 그림이 안 들어와 있을 수 있다.
      //   이미지 디코딩이 끝나는 시간을 감안해 몇 번 나눠서 다시 그린다(pBlit은 현재 탭 캔버스를
      //   화면 텍스처로 옮기고 needsUpdate를 세우므로, 늦게 도착한 그림도 이때 반영된다).
      //   ensurePaintTex()도 같이 불러 재질↔텍스처 연결이 끊긴 경우까지 복구한다.
      [80, 300, 800].forEach(ms=>setTimeout(()=>{
        try{ ensurePaintTex(); pBlit(); _blitEar('L'); _blitEar('R'); }catch(_){}
      }, ms));
      // 슬라이더 UI 반영
      ['anpSx','anpSy','anpSa'].forEach(id=>{ const k=id==='anpSx'?'x':id==='anpSy'?'y':'all'; const el=overlay.querySelector('#'+id); if(el) el.value=scl[k]; const v=overlay.querySelector('#'+id+'V'); if(v) v.textContent=(scl[k]).toFixed(2); });
      if(typeof renderEarLists==='function') renderEarLists();
      if(typeof window.__anpGoTab==='function') window.__anpGoTab('blink');   // 마지막 편집 지점(감은눈)으로
    }catch(e){ console.warn('[동물] 창 복원 실패',e); }
  };
  restore();
};
/* ═══ 5-A: 실행화면 렌더 — 저장된 동물 def를 좌석/런처 캐릭터로 조립 ═══ */
let _ANIMAL_SCENE=null, _animalSceneLoading=false;
function _ensureAnimalScene(){
  if(_ANIMAL_SCENE || _animalSceneLoading || !window.ANIMAL_GLB_B64 || typeof THREE==='undefined') return;
  _animalSceneLoading=true;
  try{
    const bin=atob(window.ANIMAL_GLB_B64); const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    const ld=(typeof loader!=='undefined'&&loader)?loader:new THREE.GLTFLoader();
    ld.parse(buf.buffer,'',(g)=>{ _ANIMAL_SCENE=g.scene; _animalSceneLoading=false;
      console.log('[동물] 좌석용 base 파싱 완료 — 동물 좌석 재빌드 시도');
      // 파싱 전에 만들어져 인간으로 폴백된 동물 좌석이 있으면 다시 동물로 세움
      if(typeof window.rebuildAnimalSeats==='function') window.rebuildAnimalSeats(); },
      (e)=>{ _animalSceneLoading=false; console.warn('[동물] 좌석용 base 파싱 실패',e); });
  }catch(e){ _animalSceneLoading=false; console.warn('[동물] 좌석용 base 오류',e); }
}
const ANIMAL_RUN_SCALE=(typeof window!=='undefined'&&window.ANIMAL_RUN_SCALE)||0.6;   // 실행 크기는 app.js fitModel이 최종 결정
function _texFromDataURL(url, fallbackFill){
  // 512 캔버스 텍스처 — 이미지가 비동기로 로드되면 그 위에 그려 갱신. 로드 전엔 흰 바탕.
  const c=document.createElement('canvas'); c.width=c.height=P_SZ;
  const x=c.getContext('2d'); x.fillStyle=fallbackFill||'#ffffff'; x.fillRect(0,0,P_SZ,P_SZ);
  const t=new THREE.CanvasTexture(c); t.flipY=false; t.encoding=THREE.sRGBEncoding;
  if(url){ const im=new Image(); im.crossOrigin='anonymous';   // Storage URL 텍스처용 CORS (dataURL엔 영향 없음)
    im.onload=()=>{ x.drawImage(im,0,0,P_SZ,P_SZ); t.needsUpdate=true; };
    im.onerror=()=>console.warn('[동물] 페인트 텍스처 로드 실패:', (url||'').slice(0,64));
    im.src=url; }
  return t;
}
// 인간 재질과 같은 자체발광 평탄화 — 씬 조명 의존을 줄여 밝기를 인간과 일치시킴
function _animLit(mat){
  const flat = 1 - ((typeof LIGHT_PRESET!=='undefined' && LIGHT_PRESET) ? LIGHT_PRESET.e : 0.5);
  if(mat){ mat.emissiveMap=mat.map; if(mat.emissive) mat.emissive.setScalar(flat); mat.needsUpdate=true; }
  return mat;
}
/* defToBase와 같은 반환 형태 — {group, root, faceMat, fT, bT, faceMesh...} */
window.buildAnimalBase=function(def){
  _ensureAnimalScene();
  if(!_ANIMAL_SCENE || !THREE.SkeletonUtils){
    console.warn('[동물] buildAnimalBase 폴백 — scene:', !!_ANIMAL_SCENE, 'SkeletonUtils:', !!(THREE&&THREE.SkeletonUtils), 'GLB:', !!window.ANIMAL_GLB_B64);
    return null;   // 파싱 전이면 인간 폴백 → 파싱 완료 후 rebuildAnimalSeats가 다시 세움
  }
  const root=THREE.SkeletonUtils.clone(_ANIMAL_SCENE);
  // 텍스처 — 몸/표정(fT)·감은눈(bT). 감은눈엔 몸 무늬가 자동복사돼 있어 통짜 스왑으로 깜빡임 성립.
  // 로컬 슬롯은 dataURL(animalBody), 방에서 온 def는 Storage URL(animalBodyUrl) — 둘 다 지원
  const srcBody  = def.animalBody  || def.animalBodyUrl  || null;
  const srcBlink = def.animalBlink || def.animalBlinkUrl || srcBody;
  const fT=_texFromDataURL(srcBody);
  const bT=_texFromDataURL(srcBlink);
  // 재질값은 인간 베이스 GLB와 동일하게 맞춤(roughness 0.9 / doubleSided). 특히 side를 안 주면 기본 FrontSide라
  //   얇은 부분의 뒷면이 사라져 "동물만 조명이 다른 것처럼" 보임 — 생성기 미리보기는 GLB 재질을 그대로 써서
  //   DoubleSide였기 때문에 실행화면과 차이가 났음.
  // ★ skinning:true 필수 (Three.js r128). GLTFLoader는 로드 시 이 값을 자동으로 켜주는데,
  //   여기서 재질을 통째로 새로 만들어 덮어쓰기 때문에 꺼진 채로 들어감 — 그러면 셰이더가 본 변형을
  //   아예 계산하지 않아서 animateRig가 본을 돌려도 화면은 바인드 포즈로 고정된다(팔·고개·몸통 전부).
  //   콘솔에 매 프레임 'THREE.SkinnedMesh with material.skinning set to false' 경고가 쏟아지던 것도 이것.
  //   동물 메쉬는 body + face1~4 전부 스킨메쉬라 이 재질 하나만 켜면 됨.
  //   (귀는 별도 GLB이고 skins=0인 정적 메쉬로 실측 확인 — 아래 eMat에는 켜지 않는다.)
  const mat=_animLit(new THREE.MeshStandardMaterial({ map:fT, color:'#ffffff', metalness:0, roughness:0.9, side:THREE.DoubleSide, skinning:true }));
  /* 🐾 깜빡임 때 귀도 같이 갈아끼우기 위한 등록표.
     귀는 몸과 다른 재질(eMat)·다른 UV라 몸 텍스처 스왑만으로는 절대 안 바뀐다. 그렇다고 스왑
     호출부(app.js 의 sleep/pet/dizzy/흔들기·런처·좌석)를 하나씩 고치면 언젠가 하나가 빠져
     "몸은 눈 감았는데 귀만 안 바뀌는" 상태가 된다. 호출부는 전부 setFaceMap() 하나를 거치므로,
     **몸 재질에 귀 목록을 달아 두고 setFaceMap 이 함께 처리**하게 한다.
     ⚠️ 귀는 비동기로 늦게 붙는다(_parseEar) — 배열을 미리 만들어 두고 도착할 때마다 밀어 넣는다.
     ⚠️ animalBlinkTex 는 "지금 넘어온 텍스처가 감은눈인가"를 판별하는 기준이다. setFaceMap 은
       인간 캐릭터도 함께 쓰므로 정체를 이 표식으로만 알 수 있다. */
  mat.userData.animalBlinkTex = bT;
  mat.userData.animalEars = [];
  let headBoneS=null; const faces=[];
  root.traverse(o=>{
    if(/^face[1-4]$/.test(o.name)) faces[+o.name.slice(4)-1]=o;
    if(o.isBone && o.name==='head') headBoneS=o;
    if(o.isMesh){ o.material=mat; o.frustumCulled=false; o.castShadow=true; }
  });
  faces.forEach((n,i)=>{ if(n) n.visible=(i===(def.animalFace||0)); });
  if(headBoneS && def.animalScl){ const sc=def.animalScl; headBoneS.scale.set((sc.x||1)*(sc.all||1),(sc.y||1)*(sc.all||1),(sc.all||1)); }
  // 크기 — 인간(1.4)의 60%
  // ★ 정규화 배율을 기록해둔다 — 생성기(fitCreator)가 '측정' 대신 이 확정값으로 크기를 계산하기 위함.
  //   생성기가 매번 measureCharBox로 재면 귀 부착 타이밍에 따라 캐릭터 크기가 흔들리고,
  //   책상은 고정이라 "생성기와 실행의 책상 비율이 다르다"로 나타난다(실행은 이미 확정값으로 막아둠).
  if(typeof normalizeModel==='function'){
    const _ns = normalizeModel(root, 1.4*ANIMAL_RUN_SCALE);
    root.userData.animNormScale = _ns;                    // 원본 대비 배율(raw → 1.4×RUN_SCALE)
    root.userData.animNormH     = 1.4*ANIMAL_RUN_SCALE;   // 정규화 목표 높이
  }
  // 귀 부착 — 생성기와 같은 방식(피봇 보정 + 저장된 조정값 + 귀 전용 페인트)
  /* 🐾 귀 페인트는 표정용·감은눈용 두 장이다. 감은눈 쪽이 없으면(옛 저장본) 표정 쪽으로 폴백한다 —
     옛 def 는 귀가 한 장뿐이었고 그 그림이 두 상태 모두에 쓰였으므로 예전과 같은 결과가 된다. */
  [['L',def.animalEarL,def.animalEarPaintL||def.animalEarPaintLUrl,def.animalEarBlinkL||def.animalEarBlinkLUrl],
   ['R',def.animalEarR,def.animalEarPaintR||def.animalEarPaintRUrl,def.animalEarBlinkR||def.animalEarBlinkRUrl]].forEach(([side,type,paint,paintB])=>{
    if(!type) return;
    _parseEar('ear_'+type+'_'+side,(sceneEar)=>{
      if(!sceneEar) return;
      const obj=sceneEar.clone(true);
      const eTex=_texFromDataURL(paint||null);
      const eTexB=_texFromDataURL(paintB||paint||null);
      const eMat=_animLit(new THREE.MeshStandardMaterial({ map:eTex, color:'#ffffff', metalness:0, roughness:0.9, side:THREE.DoubleSide }));
      obj.traverse(o=>{ if(o.isMesh){ o.material=eMat; o.frustumCulled=false; } });
      /* 등록표에 넣는다 — 이 시점의 눈 상태를 따라가게 현재 맵도 맞춘다. 자고 있는 캐릭터에게
         귀가 뒤늦게 붙는 경우가 있어서(비동기), 그냥 넣기만 하면 그 귀만 눈 뜬 그림으로 남는다. */
      try{
        mat.userData.animalEars.push({ mat:eMat, fT:eTex, bT:eTexB });
        if(mat.map === bT){ eMat.map=eTexB; eMat.emissiveMap=eTexB; eMat.needsUpdate=true; }
      }catch(_){}
      const bb=new THREE.Box3().setFromObject(obj); const c=bb.getCenter(new THREE.Vector3());
      obj.position.sub(c);
      const wrap=new THREE.Group(); wrap.position.copy(c); wrap.add(obj);
      const adj=(def.animalEarAdj&&def.animalEarAdj[side])||{px:0,py:0,pz:0,rot:0,sc:1};
      wrap.position.set(c.x+adj.px, c.y+adj.py, c.z+adj.pz);
      /* ★ 여기가 «저장 후의 귀» 를 짓는 자리다. rotation.z 하나만 세우던 탓에 X·Y 조정이
         완성된 캐릭터에서 전부 0 으로 돌아갔다. 편집 화면(_applyEarAdj)과 같은 규칙을 쓴다. */
      { const _r=_earRot(adj); wrap.rotation.set(_r.x, _r.y, _r.z); }
      { const _s=_earScale(adj); wrap.scale.set(_s.x, _s.y, _s.z); }   // 축별 크기(구버전 def는 sc로 폴백)
      root.add(wrap);
      // ★ 머리 본의 자식으로 재부모화 — Object3D.attach는 월드 변환을 유지하며 부모만 바꾸므로 위치·각도가
      //   그대로 유지된다. 이걸 안 하면 귀가 root의 형제로 남아 머리가 돌아도 따라오지 않음
      //   (생성기는 머리를 애니메이션하지 않아서 root 직결로도 문제가 없었고, 실행화면에서만 드러났음).
      if(headBoneS){ try{ root.updateMatrixWorld(true); headBoneS.attach(wrap); }catch(_){} }
      wrap.userData.animalEar = true;   // 좌석의 귀 본 목록에 등록하기 위한 표식(app.js _sweepAnimalEars)
      // ★ 캐릭터 크기 정규화(measureCharBox)에서 귀를 제외 — 귀는 비동기로 늦게 붙어서, 재는 시점에 따라
      //   높이가 달라지고 그만큼 1.45/height 정규화 배율이 흔들렸다. 그 결과
      //     ・ 생성기는 귀가 붙기 전에 재서 캐릭터가 크게(=책상이 작게) 보이고,
      //     ・ 실행은 파츠 로드 후 fitModel이 한 번 더 돌며 귀를 포함해 재서 캐릭터가 작게(=책상이 크게) 나오고,
      //     ・ 귀 없는 동물은 항상 크게 정규화돼 올라탈 때 팔 높이(_rideArmH)가 커져 붕 떠 보였다.
      //   rigged 표식은 measureCharBox의 제외 조건이며, 다른 rigged 참조부는 seat.equippedPartObjs 계열만
      //   보므로(동물 귀는 거기 없음) 부작용 없음. 이걸로 귀 유무·타이밍과 무관하게 몸통 기준으로 고정된다.
      wrap.userData.rigged = true;
      // 귀 까닥임 등록 — ear 본은 웨이트가 0이라 부착물 자체를 seat.bones.ear에 넣어야 움직인다.
      //   좌석이 아직 연결되기 전(동기 캐시 히트)이면 app.js 쪽 스윕이 대신 잡아준다.
      if(typeof window.registerAnimalEar==='function') window.registerAnimalEar(root, wrap);
    });
  });
  const wrap=new THREE.Group(); wrap.add(root);
  let faceMesh=null; root.traverse(o=>{ if(!faceMesh && o.isMesh) faceMesh=o; });
  return {group:wrap, root, faceMat:mat, fT, bT, faceMesh,
    upMat:null, loMat:null, upMesh:null, loMesh:null, glassesMesh:null, hatMesh:null, hatMat:null,
    maskMesh:null, onepieceMesh:null, wingMesh:null, handLMesh:null, handRMesh:null, capeMesh:null};
};

function init(){
  _ensureAnimalScene();   // 좌석 조립용 base 미리 파싱 — 앱 실행 시점엔 완료돼 있게
  if(typeof THREE==='undefined' || !document.getElementById('raceAnimal')){ setTimeout(init,500); return; }
  initCard();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();
})();
