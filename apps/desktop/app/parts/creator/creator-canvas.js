/* creator-canvas.js — 🎨 생성기 그림판 — 되돌리기 · 그리기 연결 · 붓 · 카메라 키 · 색 · 피부(앱 FSD · app.js 분리 M20)
   app.js 의 생성기 그림판 구역(되돌리기 기록 · blit · bindPaint · 붓 색 · 도구 줄 · 도장 · 되돌리기 버튼 · 카메라 키 · 옷 색 · 색 스와치 · 피부 스와치 · 피부 PNG 불러오기)을 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다.
   ・책임: histF · histB · redoF · redoB · pushHistory · undo · redo(되돌리기 · 다시 하기) · actC(지금 그리는 캔버스) · blit(합성 텍스처 갱신) · bindPaint(미리보기 위 마우스 그리기 연결) · 붓 색 · 크기 · 도구 줄 · 대칭 · 지우기 · 도장 단추 · 표정 ↔ 감은눈 복사 · 카메라 키(bindCamKey) · 옷 색 입력 · _syncCrColorSwatches · 피부 스와치(swEl · skinRow) · loadSkins(내장 피부 PNG 를 skin[0..4] 에).
   ・내놓는 것: _crDropEraser · histF · histB · redoF · redoB · isDrawStep · actC · blit · pushHistory · bindPaint · swEl · _syncCrColorSwatches · loadSkins(값 · 함수 — app.js 는 같은 이름 const 로 받는다).
   ⚠️ 얼굴 합성(compositeFace) · 몸 만들기(buildCreatorBase · defToBase)는 creator-face.js(T7)가 맡는다. 모듈을 만들 때 버튼 · 입력 듣기가 한 번 걸린다(옛 자리와 같은 때).
   검사: checks/sim-creator-canvas.js */
(function(){

function createCreatorCanvas(deps){
const bindHold = deps.bindHold;   // 함수
const openCharColorPicker = deps.openCharColorPicker;   // 함수 — window 고리(캐릭터 색 고르기 창이 건다)
const blinkC = deps.blinkC;
const camTarget = deps.camTarget;   // 읽는 함수
const CANVAS_SZ = deps.CANVAS_SZ;
const cBodyCenter = deps.cBodyCenter;   // 읽는 함수
const cFaceCenter = deps.cFaceCenter;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const creatorPrevMod = deps.creatorPrevMod;   // 읽는 함수
const crStampMod = deps.crStampMod;
const crState = deps.crState;
const dispC = deps.dispC;
const dispTex = deps.dispTex;
const faceC = deps.faceC;
const newCanvas = deps.newCanvas;
const paintStrokeMod = deps.paintStrokeMod;
const SKIN_COLORS = deps.SKIN_COLORS;
const skinCanvases = deps.skinCanvases;
const skinCanvasFor = deps.skinCanvasFor;
const strokePointer = deps.strokePointer;   // 🖊 획이 이어지나 · 끊겼나(shared/stroke-pointer.js)
const toast = deps.toast;   // 함수
const wardrobeMod = deps.wardrobeMod;
function _crDropEraser(){ if(crState.crPaintTool) crState.crPaintTool.dropEraser(); else crState.eraser=false; }
const histF=[], histB=[];
const redoF=[], redoB=[];
function isDrawStep(){return crState.crStep===2||crState.crStep===3;}
function activeFace(){return crState.crStep===3?'blink':'face';}
function actC(){return activeFace()==='blink'?blinkC:faceC;}
function curHist(){return activeFace()==='blink'?histB:histF;}
function curRedo(){return activeFace()==='blink'?redoB:redoF;}
function blit(){const x=dispC.getContext('2d');x.clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
  x.drawImage(skinCanvasFor(crState.skinIndex),0,0);          // 베이스 피부(지워지지 않는 원본)
  x.drawImage(crState.crStep===3?blinkC:faceC,0,0);           // 그림 레이어
  dispTex.needsUpdate=true;}
function pushHistory(){const h=curHist();try{h.push(actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ));}catch(e){}if(h.length>30)h.shift();
  curRedo().length=0;   // 새 액션 → redo 스택 폐기 (표준 동작)
}
function undo(){const h=curHist();if(!h.length)return;
  try{const cur=actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ); const rs=curRedo(); rs.push(cur); if(rs.length>30)rs.shift();}catch(e){}
  actC().getContext('2d').putImageData(h.pop(),0,0);blit();}
function redo(){const rs=curRedo();if(!rs.length)return;
  try{const cur=actC().getContext('2d').getImageData(0,0,CANVAS_SZ,CANVAS_SZ); curHist().push(cur); if(curHist().length>30)curHist().shift();}catch(e){}
  actC().getContext('2d').putImageData(rs.pop(),0,0);blit();}
function endStroke(){crState.painting=false;crState.lastPX=crState.lastPY=null;crState.lastSX=crState.lastSY=null;}
function bindPaint(){const cv=document.getElementById('creatorPreview');
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{
    // 🖱️ 우클릭: 드래그하면 카메라 회전, 움직임 없이 떼면 기존처럼 스포이드(그리기 단계에서만).
    //   어느 단계에서든 우클릭 드래그로 캐릭터를 돌려볼 수 있음 — 동물 생성기와 통일된 조작.
    if(e.button===2){ crState._rcOrbit={x:e.clientX,y:e.clientY,moved:false}; cv.setPointerCapture(e.pointerId); return; }
    if(!isDrawStep())return;
    // 도장 편집 중에는 캔버스 클릭으로 그리지 않음(오버레이 조작 우선)
    if(crState.stampMode) return;
    if(e.button!==0)return;
    const act=crState.crPaintTool?crState.crPaintTool.pointerAction(e):'stroke';
    if(act!=='stroke'){ paintStrokeMod.bucketFromEvent(e, act==='fillErase'); return; }   // 🪣 한 번 누르면 끝 — 끌기 획이 아니다
    if(crState.crStep===3)crState.blinkEdited=true;pushHistory();crState.painting=true;paintStrokeMod._paintBreak();crState._pLastScr=null;paintStrokeMod.paintFromEvent(e);cv.setPointerCapture(e.pointerId);   // 🩹 #12 — 새 획: 솔기·쪼개기 기억도 비운다
  });
  cv.addEventListener('pointermove',e=>{
    if(crState._rcOrbit){
      const dx=e.clientX-crState._rcOrbit.x, dy=e.clientY-crState._rcOrbit.y;
      if(crState._rcOrbit.moved || Math.abs(dx)+Math.abs(dy)>4){
        crState._rcOrbit.moved=true;
        crState.camYaw += wardrobeMod.ORBIT_DRAG_DIR * dx*0.012;   // 오른쪽 드래그 = 앵글도 오른쪽으로 (부호는 ORBIT_DRAG_DIR 한 곳에서 관리 — 꾸미기 미리보기와 동일)
        crState.camPitch = Math.max(-0.6, Math.min(1.0, crState.camPitch + dy*0.008));
        creatorPrevMod().updateCreatorCam();
        crState._rcOrbit.x=e.clientX; crState._rcOrbit.y=e.clientY;
      }
      return;
    }
    /* 🖌 커서 = 지금 도구(붓 + · 페인트통 · 지우개). 단계 이동(gotoStep)이 crosshair 로 되돌려도 움직이면 다시 맞는다. */
    if(crState.crPaintTool && isDrawStep() && !crState.stampMode){ const cu=crState.crPaintTool.cursor(); if(cv.style.cursor!==cu) cv.style.cursor=cu; }
    if(!crState.painting)return;
    if(!strokePointer.isDown(e)){ endStroke(); return; }   // 뗀 펜(떠 있는 움직임)은 그리지 않는다
    const evs=(typeof e.getCoalescedEvents==='function')?e.getCoalescedEvents():null;
    /* 🖊️ [Mac 제보 2026-09-23] "표정을 그리면 선이 위아래로 튄다."
       getCoalescedEvents 의 점들은 **마지막 것이 이 이벤트 자신**이어야 한다(규격). 그런데 환경에 따라
       (mac · 확대/축소 · 투명 창) 묶인 점이 다른 좌표계로 오면, 진짜 점과 어긋난 점이 번갈아 찍혀 선이 지그재그로 튄다.
       ★ 마지막 묶인 점이 이 이벤트와 2px 안일 때만 믿는다. 아니면 이 이벤트 하나만 쓴다(조금 덜 매끄럽지만 튀지 않는다). */
    const _cLast = (evs && evs.length) ? evs[evs.length-1] : null;
    const _cOk = !!(_cLast && Math.abs(_cLast.clientX - e.clientX) <= 2 && Math.abs(_cLast.clientY - e.clientY) <= 2);
    if(_cOk){ for(const ce of evs) paintStrokeMod.paintFromEvent(ce); }
    else paintStrokeMod.paintFromEvent(e);
  });
  cv.addEventListener('pointerup',(e)=>{
    if(crState._rcOrbit){
      const was=crState._rcOrbit; crState._rcOrbit=null;
      // 움직이지 않고 뗀 우클릭 = 기존 스포이드 동작 그대로
      if(!was.moved && isDrawStep() && !crState.stampMode){ if(crState.crStep===3)crState.blinkEdited=true; paintStrokeMod.eyedropFromEvent(e); }
      return;
    }
    endStroke();
  });
  /* 펜 끌기가 끊기면(pointercancel — pointerup 이 안 온다) 획 · 우클릭 회전을 끝낸다 */
  strokePointer.onLost(cv, ()=>{ crState._rcOrbit=null; endStroke(); });
  cv.addEventListener('wheel',e=>{e.preventDefault();crState.camDist=Math.max(0.4,Math.min(7,crState.camDist*(e.deltaY>0?1.12:0.89)));creatorPrevMod().updateCreatorCam();},{passive:false});
  // 드래그앤드롭: 이미지 파일을 캔버스에 떨어뜨리면 도장으로 불러옴
  cv.addEventListener('dragover',e=>{e.preventDefault();});
  cv.addEventListener('drop',e=>{e.preventDefault(); if(!isDrawStep())return;
    const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) crStampMod.loadStampFromFile(f);
  });
  crStampMod.bindStampOverlay();
}
addEventListener('keydown',e=>{
  if(!creatorOpen())return;
  // Ctrl+Shift+Z = redo (Ctrl+Z보다 먼저 체크 — shift 조합이 더 구체적)
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&hotkeyLetter(e)==='z'){e.preventDefault();redo();return;}
  if((e.ctrlKey||e.metaKey)&&hotkeyLetter(e)==='z'){e.preventDefault();undo();return;}
  // Delete: 표정 그리기 단계에서 전체 지우기 (clearBtn과 동일 동작). input/textarea에 포커스면 무시.
  if(e.key==='Delete' && isDrawStep()){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    pushHistory();
    actC().getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
    blit();
  }
  // C: 지우개 ON/OFF 토글 (포토샵식). modifier가 있으면 무시 (Ctrl+C 복사 등과 충돌 회피)
  if(hotkeyLetter(e)==='c' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    if(crState.crPaintTool) crState.crPaintTool.toggleEraser();   // 지우개 ↔ 붓 — eraser 변수와 버튼 표시는 도구 줄(onChange)이 맞춘다
  }
  // B 붓 · G 페인트통 · E 지우개 (paint-tools.js — 한글 상태 맥도 hotkeyLetter 로 같은 키)
  if(crState.crPaintTool && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag!=='input' && tag!=='textarea' && crState.crPaintTool.handleKey(e)) e.preventDefault();
  }
  // X: 좌우 대칭 ON/OFF 토글
  if(hotkeyLetter(e)==='x' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    const sb=document.getElementById('symBtn');
    if(sb) sb.click();
  }
  // L: 원색 보기(조명 끄고 칠한 색 그대로) 켬/끔
  if(hotkeyLetter(e)==='l' && isDrawStep() && creatorPrevMod().crFlatView && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    creatorPrevMod().crFlatView.toggle();
  }
  // Z: 도장 모드 ON/OFF 토글 (찍기는 Enter 또는 ✓ 버튼)
  if(hotkeyLetter(e)==='z' && isDrawStep() && !e.ctrlKey && !e.metaKey && !e.altKey){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    e.preventDefault();
    crStampMod.setStampMode(!crState.stampMode);
  }
  // Enter: 도장 편집 중이면 찍기 (✓ 버튼과 동일)
  if(e.key==='Enter' && crState.stampMode && crState.stampImg){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='button')return;   // 버튼 포커스 중엔 무시(스페이스/엔터로 버튼 활성화)
    e.preventDefault();
    crStampMod.commitStamp();
  }
  // ESC: 도장 편집 중이면 취소(박지 않고 빠져나옴)
  if(e.key==='Escape' && crState.stampMode){
    e.preventDefault();
    crStampMod.cancelStamp();
  }
});
const swEl=document.getElementById('brushColors');
['#333333','#ffffff','#e0607a','#5a8fd8','#e0a050'].forEach((c,i)=>{const s=document.createElement('span');
  s.className='sw'+(i===0?' on':'');s.style.background=c;
  s.onclick=()=>{crState.brushColor=c;_crDropEraser();[...swEl.children].forEach(x=>x.classList.toggle('on',x===s));};
  swEl.appendChild(s);});
document.getElementById('brushCustom').addEventListener('input',e=>{crState.brushColor=e.target.value;_crDropEraser();
  [...swEl.children].forEach(x=>x.classList.remove('on'));});
/* 🎨 [2026-10-02 제보] "자유 색으로 칠하다 기본 칩을 눌렀다가, 아까 그 자유 색으로 돌아가려고 칸을 다시
   눌러도 그 색이 안 잡힌다." — <input type="color"> 는 **값이 바뀔 때만** input/change 를 보낸다.
   같은 색 그대로 창을 닫으면 이벤트가 없어서 브러시가 기본 칩 색에 머물렀다.
   ⇒ 칸을 누르는 순간 지금 들어 있는 색(=마지막 자유 색·스포이드 색)을 바로 브러시로 잡는다.
     창은 평소처럼 열리고, 거기서 색을 바꾸면 위 input 이 그대로 이어받는다. */
document.getElementById('brushCustom').addEventListener('click',e=>{crState.brushColor=e.target.value;_crDropEraser();
  [...swEl.children].forEach(x=>x.classList.remove('on'));});
document.getElementById('brushSize').addEventListener('input',e=>crState.brushSize=+e.target.value);
/* 🖌 도구 줄 — 붓 · 페인트통 · 지우개. eraser 변수(paintAt 이 본다)는 여기서만 맞춘다.
   붓이 아닌 도구를 고르면 도장 모드를 닫는다(예전 «지우개와 도장은 동시 사용 X» 와 같은 이유 — 도장 중엔 캔버스 클릭이 안 칠한다). */
if(typeof PaintTools!=='undefined'){
  crState.crPaintTool=PaintTools.createPaintTools({ doc:document, uvFill:UvFill,
    hotkeyLetter:hotkeyLetter,
    onChange:(t)=>{ crState.eraser=(t==='eraser'); if(t!=='brush' && crState.stampMode) crStampMod.setStampMode(false);
      const cv=document.getElementById('creatorPreview'); if(cv && isDrawStep() && !crState.stampMode) cv.style.cursor=crState.crPaintTool.cursor(); } });
  crState.crPaintTool.mount(document.getElementById('crToolSeg'));
}
document.getElementById('symBtn').addEventListener('click',e=>{crState.symmetry=!crState.symmetry;e.target.classList.toggle('on',crState.symmetry);});
document.getElementById('clearBtn').addEventListener('click',()=>{pushHistory();actC().getContext('2d').clearRect(0,0,CANVAS_SZ,CANVAS_SZ);blit();});
/* 도장 모드 + 파일 입력 + 슬라이더 */
document.getElementById('stampBtn').addEventListener('click',()=>crStampMod.setStampMode(!crState.stampMode));
document.getElementById('stampLoad').addEventListener('click',()=>document.getElementById('stampFile').click());
document.getElementById('stampFile').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0]; if(f) crStampMod.loadStampFromFile(f);
  e.target.value='';
});
document.getElementById('stampApply').addEventListener('click',()=>crStampMod.commitStamp());
document.getElementById('stampCancel').addEventListener('click',()=>crStampMod.cancelStamp());
/* ↺ 초기화 — 크기·회전·위치를 처음 불러온 상태로. 도장이 미리보기 밖으로 나가 손잡이를 못 잡게 됐을 때의
   유일한 복구 통로라, 오버레이가 아니라 **항상 제자리에 있는 패널**에 둔다. */
{ const sr=document.getElementById('stampReset');
  if(sr) sr.addEventListener('click', ()=>{ crStampMod.resetStampPlacement(true); }); }
document.getElementById('blinkResetBtn').addEventListener('click',()=>{ if(crState.crStep!==3)return;
  pushHistory();   // 되돌리기 가능하게
  const bx=blinkC.getContext('2d'); bx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); bx.drawImage(faceC,0,0); crState.blinkEdited=false; blit(); });
/* 🙂 감은눈 → 표정 (2단계). 위 ⟳ 표정 복사의 **반대 방향**이다.
   ⚠️ 두 버튼은 대칭이 아니다 — 그 차이가 아래 두 줄의 이유다.
     · 감은눈은 표정에서 **파생된다**(gotoStep 의 `n===3 && !blinkEdited` 자동 복사). 그래서
       ⟳ 표정 복사는 "파생 상태로 되돌리기"이고 blinkEdited=false 로 되돌린다.
     · 표정은 원본이다. 여기서 blinkEdited 를 건드리면 3단계에 들어가는 순간 감은눈이 표정으로
       다시 덮여서, 방금 가져온 그림이 사라진다. **손대지 않는다.**
   ⚠️ 감은눈을 한 번도 안 고쳤으면 그 캔버스는 비어 있다(신규 캐릭터는 3단계에 들어가야 채워진다).
     그대로 복사하면 표정이 통째로 지워지므로 막는다. 버튼도 gotoStep 에서 같이 잠근다.
   ★ 확인을 묻지 않는다 — pushHistory 를 먼저 하므로 [↶ 되돌리기]와 Ctrl+Z 로 되돌아온다.
     그게 이 창의 관례고, 팝업을 하나 더 띄우는 것보다 손이 덜 간다. */
document.getElementById('faceCopyBlinkBtn').addEventListener('click',()=>{ if(crState.crStep!==2)return;
  if(!crState.blinkEdited){ toast('아직 감은눈을 그린 적이 없어요 — 3단계에서 먼저 그려주세요'); return; }
  pushHistory();   // 표정은 원본이라 덮어쓰기 전에 반드시 되돌릴 자리를 남긴다
  const fx=faceC.getContext('2d'); fx.clearRect(0,0,CANVAS_SZ,CANVAS_SZ); fx.drawImage(blinkC,0,0); blit(); });
document.getElementById('undoBtn').addEventListener('click',undo);
const ROT_STEP=Math.PI/12;   // 15°
// ★ 버튼을 꾹 누르면 연속으로 이동하도록(bindHold, 기존 아이템 위치조작 버튼과 동일한 방식) 변경.
// ◀▶ 버튼·←→ 키도 우클릭 드래그와 같은 부호를 써야 한다 — 안 그러면 같은 창에서 조작끼리 반대로 돈다.
bindHold(document.getElementById('cpLeft'), ()=>{crState.camYaw-=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;creatorPrevMod().updateCreatorCam();});
bindHold(document.getElementById('cpRight'), ()=>{crState.camYaw+=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;creatorPrevMod().updateCreatorCam();});
bindHold(document.getElementById('cpUp'), ()=>{camTarget().y+=0.12;creatorPrevMod().updateCreatorCam();});
bindHold(document.getElementById('cpDown'), ()=>{camTarget().y-=0.12;creatorPrevMod().updateCreatorCam();});
// ★ 키보드 방향키로도 동일하게 조작 — 생성기가 열려있을 때만 동작, 꾹 누르면 버튼처럼 연속 이동.
//   입력창(텍스트 필드 등)에 포커스 중이면 방향키 원래 용도(커서 이동)를 방해하지 않도록 건너뜀.
function bindCamKey(key, fn){
  let iv=null, delayTimer=null;
  const stop=()=>{ if(iv){clearInterval(iv);iv=null;} if(delayTimer){clearTimeout(delayTimer);delayTimer=null;} };
  document.addEventListener('keydown', e=>{
    if(!creatorOpen() || e.key!==key) return;
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea') return;
    e.preventDefault();
    if(e.repeat) return;   // OS 자체 반복은 무시 — 버튼과 똑같은 리듬(350ms 뒤 60ms 간격)으로만 반복
    fn();
    delayTimer=setTimeout(()=>{ iv=setInterval(fn,60); },350);
  });
  document.addEventListener('keyup', e=>{ if(e.key===key) stop(); });
}
bindCamKey('ArrowLeft',  ()=>{crState.camYaw-=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;creatorPrevMod().updateCreatorCam();});
bindCamKey('ArrowRight', ()=>{crState.camYaw+=wardrobeMod.ORBIT_DRAG_DIR*ROT_STEP;creatorPrevMod().updateCreatorCam();});
bindCamKey('ArrowUp',    ()=>{camTarget().y+=0.12;creatorPrevMod().updateCreatorCam();});
bindCamKey('ArrowDown',  ()=>{camTarget().y-=0.12;creatorPrevMod().updateCreatorCam();});
document.getElementById('cpReset').addEventListener('click',()=>{
  // 현재 단계 그룹의 저장된 카메라를 비우고 그 그룹의 기본 카메라로 되돌림
  if(crState.crStep<=3){          // 표정·감은눈 그룹
    crState.faceCamSaved=null;
    if(cFaceCenter()){ camTarget().copy(cFaceCenter()); crState.camDist=crState.cFaceDist; crState.camYaw=0; crState.camPitch=0.0; }
  } else if(crState.crStep>=5){   // 책상·좌석 그룹
    crState.deskCamSaved=null;
    creatorPrevMod().frameDeskCam(false);
  } else {                // 4단계(전신 색상) — 단독
    camTarget().copy(cBodyCenter()); crState.camDist=crState.cBodyDist; crState.camYaw=0; crState.camPitch=0.04;
  }
  creatorPrevMod().updateCreatorCam();
});
document.getElementById('topColor').addEventListener('input',e=>{crState.cTopColor=e.target.value;if(crState.cBase&&crState.cBase.upMat)crState.cBase.upMat.color.set(crState.cTopColor);if(crState.cBase&&crState.cBase.hatMat)crState.cBase.hatMat.color.set(crState.cTopColor);creatorPrevMod().updateCreatorLights();});
document.getElementById('botColor').addEventListener('input',e=>{crState.cBotColor=e.target.value;if(crState.cBase&&crState.cBase.loMat)crState.cBase.loMat.color.set(crState.cBotColor);creatorPrevMod().updateCreatorLights();});
// ★ 런처8: 생성기의 세 컬러픽커에 꾸미기와 동일한 커스텀 팝업을 얹음 — 최근 5색 공유(localStorage 'tw.charColorHistory').
//   네이티브 <input type="color">는 상태 저장 그릇으로만 남기고 클릭 시 우리 팝업을 대신 띄움.
const _crColorSw = [];   // 색 입력칸 ↔ 보이는 스와치 짝 (아래 _syncCrColorSwatches 가 쓴다)
(function bindCreatorCustomColorPickers(){
  // ★ 런처8: 네이티브 <input type="color">를 숨기고, 그 앞에 눈에 보이는 스와치 버튼을 만들어
  //   커스텀 팝업만 뜨게 함. (mousedown/click preventDefault로도 못 막는 환경 대비 — 아예 클릭이
  //   input에 닿지 않게 하는 것이 가장 확실)
  const bind = (id)=>{
    const inp=document.getElementById(id); if(!inp) return;
    if(inp.dataset.customBound) return;   // 이미 붙었다 — 스와치를 두 개 만들지 않는다
    inp.dataset.customBound = '1';
    inp.style.display='none';
    const btn=document.createElement('button'); btn.type='button';
    btn.className='cr-color-sw';
    btn.style.cssText='width:46px;height:26px;border-radius:13px;border:1px solid rgba(0,0,0,.12);'
      +'cursor:pointer;padding:0;vertical-align:middle;';
    btn.style.background = TwSafeHtml.cssColor(inp.value || '#888888');
    inp.parentNode.insertBefore(btn, inp);
    btn.addEventListener('click', e=>{
      e.preventDefault(); e.stopPropagation();
      openCharColorPicker(btn, inp.value, (c)=>{
        inp.value = c; btn.style.background = TwSafeHtml.cssColor(c);
        inp.dispatchEvent(new Event('input', {bubbles:true}));
      });
    });
    /* ⚠️ [제보] "옷 색을 바꾸고 수정하러 들어가면 팔레트만 기본색으로 돌아간다."
       원래 의도는 아래 한 줄이었다 — "외부에서 inp.value 가 갱신되면 스와치도 따라온다".
       그런데 **`inp.value = …` 는 input 이벤트를 발생시키지 않는다.** 프로그램이 값을 넣는 경우
       (생성기 재진입 등)에는 이 줄이 한 번도 안 돌고, 스와치는 bind 시점의 HTML 기본값
       (#9dba8a·#d98e73)에 그대로 멈춰 있다. 진짜 input 요소는 display:none 이라 보이지도 않는다.
       ★ cTopColor·3D 미리보기·저장은 전부 정상이었다 — 어긋난 것은 스와치 «표시»뿐이라
         "미리보기는 맞는데 팔레트만 기본색"이라는 제보 문구가 정확히 그 모양이다.
       ★ 그래서 이벤트에 기대지 않고 **직접 맞추는 창구**(_syncCrColorSwatches)를 둔다.
         change 도 함께 듣는다 — 브라우저 기본 색상 선택기는 input 없이 change 만 주는 경우가 있다. */
    inp.addEventListener('input',  ()=>{ btn.style.background = TwSafeHtml.cssColor(inp.value); });
    inp.addEventListener('change', ()=>{ btn.style.background = TwSafeHtml.cssColor(inp.value); });
    _crColorSw.push({ inp, btn });
  };
  bind('topColor');
  bind('botColor');
  bind('deskColor');
})();
/* 색 스와치를 지금 값으로 다시 칠한다. 값을 프로그램이 넣은 뒤에는 반드시 이걸 부른다.
   ★ 요소가 셋뿐이라 비용이 없다 — 잊어버리기 쉬운 자리(단계 이동)에서도 그냥 한 번 더 부른다.
     "부르는 것을 잊어서 또 어긋나는" 쪽이 실제로 일어난 사고라, 싸게 여러 번 부르는 편을 택했다. */
function _syncCrColorSwatches(){
  try{ _crColorSw.forEach(o=>{ if(o.inp && o.btn) o.btn.style.background = TwSafeHtml.cssColor(o.inp.value); }); }catch(_){}
}
const skinRow=document.getElementById('skinRow');
const skinSwatchEls=[];
SKIN_COLORS.forEach((c,i)=>{const s=document.createElement('button');s.className='skin-sw'+(i===0?' on':'');s.style.background=c;
  s.onclick=()=>{crState.skinIndex=i;[...skinRow.children].forEach((x,j)=>x.classList.toggle('on',j===i));blit();};   // 스킨은 face 텍스처 베이스로 합성됨
  skinRow.appendChild(s);skinSwatchEls.push(s);});
/* 스와치 대표색을 캔버스에서 추출 (평평한 피부 영역 샘플) */
function swatchColorFromCanvas(cv){try{const p=cv.getContext('2d').getImageData(Math.floor(CANVAS_SZ*0.8),Math.floor(CANVAS_SZ*0.8),1,1).data;return 'rgb('+p[0]+','+p[1]+','+p[2]+')';}catch(e){return null;}}
function refreshSkinSwatch(i){const col=swatchColorFromCanvas(skinCanvasFor(i));if(col&&skinSwatchEls[i])skinSwatchEls[i].style.background=col;}
/* 내장된 피부 PNG를 skin[0..4]에 로드 (skin-data.js의 window.SKIN_PNGS) */
function loadSkins(){const pngs=window.SKIN_PNGS||{};
  /* ★ 예전엔 실패를 통째로 삼켰다(onerror에서 그냥 resolve). skin-data.js가 로드되지 않았거나 이미지가
       깨져도 아무 표시 없이 넘어가고, 피부는 초기 단색 채움 상태로 남는다 — 화면상 '피부 텍스처가 없는'
       상태가 되는데 원인을 알 방법이 없었다(특정 유저만 겪는 제보를 진단하기 어려웠던 이유).
       실패를 콘솔에 남기고, 전부 실패하면 사용자에게도 알린다. */
  if(!window.SKIN_PNGS || !Object.keys(pngs).length){
    console.warn('[피부] skin-data.js의 SKIN_PNGS를 찾지 못했습니다 — 피부 텍스처 없이 단색으로 표시됩니다. 빌드에 skin-data.js가 포함됐는지 확인하세요.');
    try{ toast('피부 텍스처를 불러오지 못했어요 — 프로그램을 다시 설치해 주세요'); }catch(_){}
    return Promise.resolve();
  }
  let failed=0, total=Object.keys(pngs).length;
  return Promise.all(Object.keys(pngs).map(k=>new Promise(res=>{const idx=+k;const img=new Image();
    img.onload=()=>{try{const cv=newCanvas();cv.getContext('2d').drawImage(img,0,0,CANVAS_SZ,CANVAS_SZ);skinCanvases[idx]=cv;refreshSkinSwatch(idx);
    }catch(e){ failed++; console.warn('[피부] skin['+idx+'] 처리 실패', e); }res();};
    img.onerror=()=>{ failed++; console.warn('[피부] skin['+idx+'] 이미지 로드 실패'); res(); };
    img.src=pngs[k];}))).then(()=>{
      if(failed) console.warn('[피부] '+failed+'/'+total+'개 실패 — 해당 피부는 단색으로 표시됩니다.');
      if(failed >= total){ try{ toast('피부 텍스처를 불러오지 못했어요 — 프로그램을 다시 설치해 주세요'); }catch(_){} }
    });}

return {
  _crDropEraser,
  histF,
  histB,
  redoF,
  redoB,
  isDrawStep,
  actC,
  blit,
  pushHistory,
  bindPaint,
  swEl,
  _syncCrColorSwatches,
  loadSkins,
};
}

const api = { createCreatorCanvas };
if(typeof window !== 'undefined') window.TwCreatorCanvas = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
