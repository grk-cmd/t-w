/* part-paint.js — 🖍️ 파츠에 직접 그리기 · 파츠 그림칸(_pic) · UV 구제 · 그림 올리기
   app.js «🖍️ 파츠에 직접 그리기» · «🖍️ 파츠 그림칸(_pic) · UV 구제 · 그림 올리기» 두 구역의 본문을 그대로 옮긴 모듈이다(앱 FSD 21번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 섞여 있던 공용 도우미 findMySeat(내 좌석 찾기 — 백색소음 등도 씀)는 app.js 에 남겼다. animal.js 는 partPaintMod.이름 으로 부른다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 24줄 —
     CANVAS_SZ · activeWdAdj · currentWdTab · savedParts · wdCam · wdEar · wdGizmo · wdPreviewBase 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 20개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _picIntersect · _picRepairUV · _stampWrapCenter · _stampWrapFill · _wdActivePartRef · _wdPic · _wdPicUvScale · applyPartPic · enterWdPicMode · exitWdPicMode · g_uvLooksBroken · meshIsPic · refreshWdPicUI · wrapperHasPic — app.js 는 partPaintMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPartPaint — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-part-paint.js */
(function(){

function createPartPaint(deps){
const CANVAS_SZ = deps.CANVAS_SZ;   // 읽는 함수
const _applyPartMatTone = deps._applyPartMatTone;
const _loadImgCors = deps._loadImgCors;
const _quickHash = deps._quickHash;
const _roomFaceCacheLoad = deps._roomFaceCacheLoad;
const _roomFaceCacheSave = deps._roomFaceCacheSave;
const activeWdAdj = deps.activeWdAdj;   // 읽는 함수
const buildFreeColorPicker = deps.buildFreeColorPicker;
const catEquippedIds = deps.catEquippedIds;
const currentWdTab = deps.currentWdTab;   // 읽는 함수
const findEntryById = deps.findEntryById;
const getMyUserId = deps.getMyUserId;
const humanEar = deps.humanEar;
const mirrorUVOn = deps.mirrorUVOn;
const newCanvas = deps.newCanvas;
const partEntryId = deps.partEntryId;
const partEntryInstances = deps.partEntryInstances;
const partEntryXf = deps.partEntryXf;
const refreshWdPreviewColorSection = deps.refreshWdPreviewColorSection;
const savedParts = deps.savedParts;   // 읽는 함수
const sizeWdPreview = deps.sizeWdPreview;
const strokeSeg = deps.strokeSeg;
const toast = deps.toast;
const updateWdCam = deps.updateWdCam;
const updateWdGizmoForActivePanel = deps.updateWdGizmoForActivePanel;
const wdCam = deps.wdCam;   // 읽는 함수
const wdEar = deps.wdEar;   // 읽는 함수
const wdGizmo = deps.wdGizmo;   // 읽는 함수
const wdPreviewBase = deps.wdPreviewBase;   // 읽는 함수
let _wdActivePartRef = null;   // refreshWdPreviewColorSection 이 정한 {cat, entry, xf, wrapper}
/* 🐾 대상은 **목록**이다(tgts) — 파츠는 한 장, 귀는 좌·우 두 장. 되돌리기 · 취소 · 지우기 · 저장이 목록을 한꺼번에 다룬다.
   wrp · user 는 첫 대상을 가리키는 옛 이름(이름표 · 파츠 판정에서 쓴다). earSym = 대칭을 반대쪽 귀에 긋는가. */
const _wdPic = {
  on:false, wrp:null, xf:null, meshes:[], user:null, tgts:[], ear:false, symOk:true,
  color:'#333333', size:11, eraser:false, sym:false, fill:false,   // fill = 🪣 클릭한 메쉬 채우기(uv-fill.js) · eraser · fill 은 아래 도구 줄(wdPaintTool)이 정한다
  hist:[], redo:[], orig:null,
  drawing:false, lx:null, ly:null, sx:null, sy:null,
  luv:null, smuv:null, lp:null, lobj:null,   // 🧵 직전 점의 UV·3D 위치·면 — 솔기를 건너뛰었는지 판정용
  lsx:null, lsy:null,   // 🪡 직전 포인터 화면 좌표 — 빠른 움직임을 쪼개는 기준
  rc:null   // 우클릭 눌린 자리 — 안 움직이고 떼면 스포이드
};
/* 🖌 꾸미기 그리기 도구 — 생성기와 같은 줄(paint-tools.js): 붓 · 페인트통 · 지우개 중 **하나만**.
   예전엔 펜/지우개와 🪣 채우기가 따로 켜져서 «지우개 + 채우기» 가 같이 켜질 수 있었다. 이제 eraser · fill 은
   도구에서만 나온다. 파츠를 통째로 지우는 일(예전 지우개 + 채우기)은 페인트통 Shift+클릭으로 옮겼다. */
const wdPaintTool = (typeof PaintTools==='undefined') ? null : PaintTools.createPaintTools({
  doc:document, btnClass:'wd-pic-btn',
  hotkeyLetter:hotkeyLetter,
  tips:{ bucket:'페인트통 (G) — 누른 모델의 칠할 자리 전체를 지금 색으로 · Shift+클릭은 그 자리 지우기' },
  onChange:(t)=>{ _wdPic.eraser=(t==='eraser'); _wdPic.fill=(t==='bucket');
    if(t==='bucket' && _wdPic.on) toast('🪣 페인트통 — 칠할 모델을 눌러요 (Shift+클릭 = 지우기)'); } });

const WD_PIC_HIST_MAX = 30;

function _wdPicSection(){ return document.getElementById('wdPicSection'); }
/* id 하나로 wrapper 를 되찾는다 — 색상 줄이 쓰는 규칙과 같다(🔗 stackable 먼저, 그다음 메인). */
function _wdWrapperForPartId(cat, id){
  if(!wdPreviewBase() || !cat || !id) return null;
  const st = wdPreviewBase().stackedPartObjs && wdPreviewBase().stackedPartObjs[cat] && wdPreviewBase().stackedPartObjs[cat][id];
  if(st) return st;
  const main = wdPreviewBase().equippedPartObjs && wdPreviewBase().equippedPartObjs[cat];
  if(main && (!main.userData || !main.userData.partId || main.userData.partId === id)) return main;
  return null;
}
/* 🖍️ **그릴 파츠**를 고른다.
   1순위는 색상 줄이 고른 그 파츠다 — 보통은 둘이 같은 파츠를 가리키는 게 맞다.
   그 파츠에 그림칸이 없으면 **같은 칸에 같이 착용된 다른 파츠**를 본다.

   [왜 이 두 번째 길이 필요한가 — 실제로 걸린 사고]
     한 칸(예: 머리)에 파츠를 둘 이상 착용하면 색상 줄은 그중 '대표' 하나만 잡는다
     (메인 wrapper, 보통 나중에 쓴 평범한 파츠). 그런데 그림칸은 다른 쪽 파츠(🔗 stackable 로
     겹쳐 쓴 것)에 있을 수 있다. 그러면 대표에 그림칸이 없다는 이유로 **연필이 아예 안 떴다.**
     증상은 "_col 파츠랑 같이 착용하면 그릴 수가 없다" 로 보인다 — 파츠 자체는 멀쩡한데.
     (한 파츠 안에 _pic 과 _col 메쉬가 같이 있는 경우는 이 문제가 아니다. 그건 원래 잘 된다.)
   ⚠️ entry(저장 대상)와 wrapper(그리는 대상)는 **언제나 같은 id 에서** 되찾는다.
     이 파일이 색상에서 이미 한 번 겪은 어긋남(모자에 칠하고 귀에 저장)을 그림에서 반복하지 않는다.
   ⚠️ 우클릭으로 고른 파츠(activeWdAdj)가 있으면 그건 색상 줄이 이미 1순위로 쓰고 있다 —
     여기서 다시 볼 필요가 없다. */
function _wdResolvePicTarget(){
  if(wdEar().isActive()) return wdEar().picTarget();   // 🐾 귀 탭 — 좌·우 귀(파츠 판정을 안 탄다)
  const ref = _wdActivePartRef;
  if(ref && wrapperHasPic(ref.wrapper)) return ref;
  if(!wdPreviewBase() || !wdPreviewBase().charDef) return null;
  const cat = (ref && ref.cat) || (activeWdAdj() && activeWdAdj().cat) || currentWdTab();
  if(!cat) return null;
  const def = wdPreviewBase().charDef;
  const skip = (ref && ref.entry) ? partEntryId(ref.entry) : null;
  const ids = catEquippedIds(def, cat);
  for(let i = 0; i < ids.length; i++){
    const id = ids[i];
    if(!id || id === skip) continue;
    const w = _wdWrapperForPartId(cat, id);
    if(!wrapperHasPic(w)) continue;
    const e = findEntryById(def, cat, id); if(!e) continue;
    const inst = partEntryInstances(e);
    return { cat: cat, entry: e, xf: (inst && inst[0]) || partEntryXf(e), wrapper: w };
  }
  return null;
}
let _wdPicTarget = null;   // 방금 고른 그릴 파츠 — 연필 표시와 enterWdPicMode 가 같은 값을 본다
/* 연필 버튼과 그리기 줄의 표시 상태를 한 곳에서 정한다.
   ★ refreshWdPreviewColorSection(_finish)과 updateWdGizmoForActivePanel 둘 다 이걸 마지막에 부른다 —
     어느 쪽이 나중에 돌든 결과가 같아지도록. */
function refreshWdPicUI(){
  _wdPicTarget = _wdResolvePicTarget();
  /* 그리던 파츠가 바뀌거나(다른 카드를 눌렀다) 사라졌으면(벗었다) 여기서 끝낸다.
     ★ 바뀐 경우는 **저장하고** 끝낸다 — 이 창의 규약이 "떠나는 것이 곧 저장"이라,
       다른 파츠를 눌렀다고 방금 그린 것이 조용히 사라지면 안 된다.
     ★ 사라진 경우는 저장할 자리(파츠)가 없으니 그냥 접는다.
     ⚠️ exitWdPicMode 안에서 이 함수가 다시 불리지만 그때는 on 이 false 라 여기서 멈춘다. */
  if(_wdPic.on){
    /* 🐾 귀는 대상이 둘 — 하나라도 떨어졌으면 사라진 것, 귀 탭을 떠났거나 귀 구성이 바뀌었으면 옮긴 것 */
    const gone = !_wdPic.tgts.length || _wdPic.tgts.some(t=>!t.wrp || !t.wrp.parent);
    const moved = !gone && (_wdPic.ear
      ? !(_wdPicTarget && _wdPicTarget.ear && _wdPicTarget.targets.length === _wdPic.tgts.length
          && _wdPicTarget.targets.every((t,i)=>t.wrapper === _wdPic.tgts[i].wrp))
      : !!(_wdPicTarget && _wdPicTarget.wrapper !== _wdPic.wrp));
    if(gone || moved){ exitWdPicMode(!gone); return; }
  }
  const btn = document.getElementById('wdPencilBtn');
  const bar = document.getElementById('wdGizmoBar');
  const sec = _wdPicSection();
  const can = !!_wdPicTarget;
  if(btn){
    btn.style.display = can ? '' : 'none';
    btn.classList.toggle('on', _wdPic.on);
  }
  /* 상세조정 패널이 안 열려 있어도 그림칸이 있으면 바를 띄운다 — 연필만 보이게.
     (이동·회전·크기는 붙일 기즈모가 없으니 그때는 숨긴다) */
  if(bar){
    // 🐾 귀 탭은 이동·회전 버튼이 귀 몫이라 «연필만» 으로 줄이지 않는다
    if(can && !(activeWdAdj() && activeWdAdj().cat) && !wdEar().isActive()){ bar.style.display='flex'; bar.classList.add('pic-only'); }
    else bar.classList.remove('pic-only');
    bar.classList.toggle('drawing', _wdPic.on);
  }
  const _earRow = document.getElementById('wdEarAdjRow');
  if(_earRow) _earRow.classList.toggle('drawing', _wdPic.on);   // 그리는 동안 조정할 귀 줄도 잠근다
  if(sec){
    const want = _wdPic.on ? 'flex' : 'none';
    if(sec.style.display !== want){
      sec.style.display = want;
      sizeWdPreview();
      updateWdCam();
    }
  }
  // 그리는 동안에는 색상 줄을 내린다 — 320px 창에 둘을 같이 펴면 세로가 터진다.
  const colorSec = document.getElementById('wdPreviewColorSection');
  if(colorSec && _wdPic.on) colorSec.style.display = 'none';
}
/* 그리기 시작 — 지금 색상 줄이 가리키는 그 파츠에 그린다. */
function enterWdPicMode(){
  if(_wdPic.on) return;
  /* 🐾 귀는 늘 새로 구한다 — 미리보기가 다시 지어지면(창 열기 · 파츠 장착) 귀 wrap 도 새로 생기는데,
     기억해 둔 대상은 옛 wrap 이라 들어가자마자 «대상이 바뀌었다» 로 빠져나온다. */
  const ref = wdEar().isActive() ? _wdResolvePicTarget() : (_wdPicTarget || _wdResolvePicTarget());
  /* 🐾 귀는 대상이 둘이고 저장 자리가 초안의 earPicL·R 이다. 파츠는 한 장 · xf.pic. */
  const list = !ref ? [] : ref.ear
    ? ref.targets.map(t=>({ wrp:t.wrapper, put:v=>wdEar().setPic(t.side, v) }))
    : [{ wrp:ref.wrapper, put:v=>{ if(v) ref.xf.pic = v; else delete ref.xf.pic; } }];
  const tgts = list.filter(t=>wrapperHasPic(t.wrp) && (t.user = _picSetup(t.wrp)));
  if(!tgts.length){ toast(ref && ref.ear ? '귀에 그릴 자리가 없어요' : '이 파츠에는 그릴 자리가 없어요'); return; }
  _wdPicTarget = ref;
  _wdPic.on = true;
  _wdPic.tgts = tgts; _wdPic.ear = !!ref.ear; _wdPic.symOk = ref.ear ? !!ref.symOk : true;
  if(!_wdPic.symOk) _wdPic.sym = false;
  _wdPic.wrp = tgts[0].wrp; _wdPic.xf = ref.ear ? null : ref.xf;
  _wdPic.meshes = [].concat(...tgts.map(t=>t.wrp.userData.picMeshes));
  _wdPic.user = tgts[0].user;
  _wdPic.hist.length = 0; _wdPic.redo.length = 0;
  // 취소용 원본 — '취소'는 들어오기 전 그림으로 정확히 되돌린다.
  _wdPic.orig = _wdPicSnap();
  /* 기즈모 핸들을 내린다 — 좌클릭을 기즈모가 먼저 먹으면 첫 획이 파츠 이동으로 나간다.
     선택 상태(wdGizmoCat)는 건드리지 않는다. 나갈 때 updateWdGizmoForActivePanel 이 그대로 되붙인다. */
  try{ if(wdGizmo()) wdGizmo().detach(); }catch(_){}
  _buildWdPicSection();
  refreshWdPicUI();
}
/* 그리기 끝 — save=true 면 올리고 저장, false 면 들어오기 전으로 되돌린다. */
async function exitWdPicMode(save){
  if(!_wdPic.on) return;
  const tgts = _wdPic.tgts.slice(), orig = _wdPic.orig;
  _wdPic.on = false; _wdPic.drawing = false; _wdPic.rc = null;
  if(save){
    let notUp = false;
    for(const t of tgts){
      if(!t.user) continue;
      let v = null;
      if(!_wdPicIsBlank(t.user)){
        const dataUrl = t.user.toDataURL('image/png');
        const url = await uploadPartPic(dataUrl);
        /* 업로드가 실패해도 내 화면의 그림은 남긴다 — 방으로 나갈 때 serializeDefForNetwork 가
           dataURL 을 걸러내므로 남의 화면에 안 보일 뿐, 다음 저장 때 다시 올라간다. */
        v = url || dataUrl;
        if(!url) notUp = true;
      }
      t.put(v);
      if(t.wrp) t.wrp.userData._picSrc = v;
    }
    if(notUp) toast('그림은 저장했지만 아직 못 올렸어요 — 다음에 다시 올릴게요');
  } else {
    tgts.forEach((t, i)=>{
      if(!t.user) return;
      try{ if(orig && orig[i]) t.user.getContext('2d').putImageData(orig[i],0,0);
           else t.user.getContext('2d').clearRect(0,0,CANVAS_SZ(),CANVAS_SZ()); }catch(_){}
      if(t.wrp) _picBlit(t.wrp);
    });
  }
  _wdPic.wrp=null; _wdPic.xf=null; _wdPic.meshes=[]; _wdPic.user=null; _wdPic.orig=null;
  _wdPic.tgts=[]; _wdPic.ear=false; _wdPic.symOk=true;
  _wdPicSetFill(false); _wdPic.fill=false;   // 나가면 페인트통은 붓으로(다음에 들어와 한 번 눌렀는데 통째로 칠해지지 않게)
  { const pc=document.getElementById('wdPreviewCanvas'); if(pc) pc.style.cursor=''; }
  _wdPic.hist.length=0; _wdPic.redo.length=0;
  const sec=_wdPicSection(); if(sec) sec.innerHTML='';
  try{ updateWdGizmoForActivePanel(); }catch(_){}
  try{ refreshWdPreviewColorSection(); }catch(_){}   // 색상 줄을 다시 올린다(그 안에서 refreshWdPicUI 도 돈다)
}
/* 아무것도 안 그린 상태인가 — 그렇다면 pic 을 저장하지 않는다(빈 PNG 를 올릴 이유가 없다). */
function _wdPicIsBlank(cv){
  try{
    const d = cv.getContext('2d').getImageData(0,0,CANVAS_SZ(),CANVAS_SZ()).data;
    for(let i=3;i<d.length;i+=16){ if(d[i]>4) return false; }   // 알파만 성기게 훑는다(512² 전수는 과하다)
    return true;
  }catch(_){ return false; }
}
/* 대상 전부의 그림을 한 장씩 — 되돌리기 한 칸 · 취소용 원본이 이 묶음이다(대칭 획은 두 귀를 한 번에 바꾼다). */
function _wdPicSnap(){
  return _wdPic.tgts.map(t=>{ try{ return t.user.getContext('2d').getImageData(0,0,CANVAS_SZ(),CANVAS_SZ()); }catch(_){ return null; } });
}
function _wdPicRestore(snap){
  _wdPic.tgts.forEach((t, i)=>{
    if(snap && snap[i]){ try{ t.user.getContext('2d').putImageData(snap[i],0,0); }catch(_){} }
    _picBlit(t.wrp);
  });
}
function _wdPicPush(){
  _wdPic.hist.push(_wdPicSnap());
  if(_wdPic.hist.length>WD_PIC_HIST_MAX) _wdPic.hist.shift();
  _wdPic.redo.length = 0;   // 새로 그렸으면 앞으로 가기는 버린다(표준 동작)
}
function _wdPicUndo(){
  if(!_wdPic.on || !_wdPic.hist.length) return;
  _wdPic.redo.push(_wdPicSnap()); if(_wdPic.redo.length>WD_PIC_HIST_MAX) _wdPic.redo.shift();
  _wdPicRestore(_wdPic.hist.pop());
}
function _wdPicRedo(){
  if(!_wdPic.on || !_wdPic.redo.length) return;
  _wdPic.hist.push(_wdPicSnap()); if(_wdPic.hist.length>WD_PIC_HIST_MAX) _wdPic.hist.shift();
  _wdPicRestore(_wdPic.redo.pop());
}
function _wdPicClear(){
  if(!_wdPic.on) return;
  _wdPicPush();
  _wdPic.tgts.forEach(t=>{
    t.user.getContext('2d').clearRect(0,0,CANVAS_SZ(),CANVAS_SZ());
    _picBlit(t.wrp);   // ★ 원본 텍스처는 base 층에 있다 — 지우기는 '원본으로 돌아가기'다
  });
}
/* 맞힌 메쉬가 어느 대상의 것인가 */
function _wdPicTgtOf(mesh){
  return _wdPic.tgts.find(t=>t.wrp.userData.picMeshes.indexOf(mesh) >= 0) || _wdPic.tgts[0];
}
/* 지우개 켜기 · 끄기. 끄기(색을 고름 · 스포이드)는 «지우개였으면 붓으로» — 페인트통은 그대로 둔다. */
function _wdPicSetEraser(v){
  if(wdPaintTool){ if(v) wdPaintTool.set('eraser'); else wdPaintTool.dropEraser(); return; }
  _wdPic.eraser = !!v;
}
/* 🪣 채우기(페인트통) — 켜 두면 좌클릭이 획 대신 «맞힌 메쉬의 UV 자리 전체» 를 칠한다(Shift 면 지운다) */
function _wdPicSetFill(v){
  if(wdPaintTool){ if(v) wdPaintTool.set('bucket'); else if(wdPaintTool.is('bucket')) wdPaintTool.set('brush'); return; }
  _wdPic.fill = !!v;
}
/* 메쉬 하나를 조각 사이 여백까지 채운다 — 같은 그림판을 쓰는 이 파츠의 다른 메쉬 안쪽은 안 덮는다(uv-fill.js 여백 몫 주석: 테두리 실선) */
function _wdPicFillMesh(ctx, wrp, mesh, opt){
  const peers=((wrp && wrp.userData.picMeshes) || []).filter(m=>m!==mesh && m.geometry).map(m=>m.geometry);
  return UvFill.fillMeshOwned(ctx, CANVAS_SZ(), mesh.geometry, peers, opt);
}
function _wdPicFillHit(hit, erase){
  if(!hit || !hit.object) return;
  const tgt=_wdPicTgtOf(hit.object);
  const opt={ color:_wdPic.color, erase:!!erase };
  _wdPicFillMesh(tgt.user.getContext('2d'), tgt.wrp, hit.object, opt);
  _picBlit(tgt.wrp);
  /* 🐾 귀 대칭 — 반대쪽 귀의 같은 번호 메쉬도 채운다(파츠는 메쉬 전체라 대칭이 따로 필요 없다) */
  if(_wdPic.ear && _wdPic.sym){
    const mt=_wdPic.tgts.find(t=>t!==tgt);
    const om=mt && mt.wrp.userData.picMeshes[tgt.wrp.userData.picMeshes.indexOf(hit.object)];
    if(om){ _wdPicFillMesh(mt.user.getContext('2d'), mt.wrp, om, opt); _picBlit(mt.wrp); }
  }
}
function _wdPicSetSym(v){
  if(v && !_wdPic.symOk){ toast('좌우 귀가 같은 종류일 때만 대칭으로 그릴 수 있어요'); return; }
  _wdPic.sym = !!v;
  const b=document.getElementById('wdPicSym'); if(b) b.classList.toggle('on', _wdPic.sym);
}

/* ── 그리기 줄(옆줄) ──
   ★ 색은 꾸미기창이 이미 쓰고 있는 팔레트를 **그대로** 쓴다(buildFreeColorPicker).
     생성기와 공용이라 최근 색 5개(tw.charColorHistory)도 같이 이어진다 — 표정 그릴 때 쓴 색이
     파츠를 그릴 때 그대로 나온다. 여기에 팔레트를 따로 만들면 그 연결이 끊긴다. */
function _buildWdPicSection(){
  const sec=_wdPicSection(); if(!sec) return;
  sec.innerHTML='';
  const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; };

  /* 어느 파츠에 그리는지 적는다 — 위 색상 줄이 가리키는 파츠와 **다를 수 있다.**
     같은 칸에 파츠를 둘 이상 착용했고 그림칸이 그중 한쪽에만 있으면 그렇게 된다
     (_wdResolvePicTarget 참고). 안 적으면 "왜 저 파츠에 그려지지?" 가 된다. */
  let _tname = _wdPic.ear ? '귀' : '이 파츠';
  if(!_wdPic.ear) try{
    const _tid = _wdPic.wrp && _wdPic.wrp.userData ? _wdPic.wrp.userData.partId : null;
    const _trec = _tid && Array.isArray(savedParts()) ? savedParts().find(p=>p.id===_tid) : null;
    if(_trec && _trec.name) _tname = _trec.name;
  }catch(_){}
  sec.appendChild(mk('div','wd-preview-color-head', _wdPic.ear ? '✎ 귀에 그리는 중' : '✎ '+_tname+' 에 그리는 중'));

  const tools=mk('div','wd-pic-row');
  const toolSeg=mk('span',null);   toolSeg.id='wdPicTools';   // 🖌 붓 · 페인트통 · 지우개 (paint-tools.js — 생성기와 같은 줄)
  if(wdPaintTool) wdPaintTool.mount(toolSeg);
  const symB=mk('button','wd-pic-btn','대칭');     symB.id='wdPicSym';
  const swat=mk('button','wd-pic-swatch');         swat.id='wdPicColor';
  swat.style.background=TwSafeHtml.cssColor(_wdPic.color); swat.title='색 고르기';
  symB.onclick=()=>_wdPicSetSym(!_wdPic.sym);
  symB.classList.toggle('on', _wdPic.sym);
  if(_wdPic.ear){
    symB.title = _wdPic.symOk ? '반대쪽 귀에 좌우를 뒤집어 같이 그려요' : '좌우 귀가 같은 종류일 때만 대칭으로 그릴 수 있어요';
    if(!_wdPic.symOk) symB.disabled = true;
  }
  let pal=null;
  const closePal=()=>{ if(pal){ pal.remove(); pal=null; document.removeEventListener('mousedown', outside, true); } };
  const outside=e=>{ if(pal && !pal.contains(e.target) && e.target!==swat) closePal(); };
  swat.onclick=()=>{
    if(pal){ closePal(); return; }
    pal=buildFreeColorPicker(_wdPic.color, v=>{ _wdPic.color=v; swat.style.background=TwSafeHtml.cssColor(v); _wdPicSetEraser(false); });
    /* 옆줄 안에 그냥 넣으면 조상의 overflow 에 잘린다 — 색상 줄이 쓰는 방식 그대로 body 에 붙이고
       스와치 위치를 기준으로 좌표를 계산한다. */
    pal.style.position='fixed';
    const r=swat.getBoundingClientRect();
    pal.style.left=r.left+'px'; pal.style.top=(r.bottom+4)+'px'; pal.style.zIndex='9999';
    document.body.appendChild(pal);
    requestAnimationFrame(()=>{
      const pr=pal.getBoundingClientRect();
      if(pr.bottom>innerHeight) pal.style.top=(r.top-pr.height-4)+'px';
      if(pr.right>innerWidth) pal.style.left=Math.max(4, innerWidth-pr.width-4)+'px';
    });
    setTimeout(()=>document.addEventListener('mousedown', outside, true), 0);
  };
  [toolSeg,symB,swat].forEach(b=>tools.appendChild(b));
  sec.appendChild(tools);

  const sz=mk('div','wd-pic-row');
  sz.appendChild(mk('span','wd-pic-lab','굵기'));
  const rng=document.createElement('input');
  rng.type='range'; rng.min='1'; rng.max='40'; rng.step='1'; rng.value=String(_wdPic.size); rng.style.flex='1';
  const dot=mk('span','wd-pic-dot');
  const syncDot=()=>{ const d=Math.max(4,Math.min(18,_wdPic.size)); dot.style.width=d+'px'; dot.style.height=d+'px'; dot.style.background=TwSafeHtml.cssColor(_wdPic.color); };
  rng.oninput=()=>{ _wdPic.size=parseInt(rng.value,10)||1; syncDot(); };
  syncDot();
  sz.appendChild(rng); sz.appendChild(dot);
  sec.appendChild(sz);

  const hist=mk('div','wd-pic-row');
  const uB=mk('button','wd-pic-btn','↶ 되돌리기'); uB.title='Ctrl+Z';
  const rB=mk('button','wd-pic-btn','↷ 다시');     rB.title='Ctrl+Shift+Z';
  const cB=mk('button','wd-pic-btn','전체 지우기'); cB.title='Delete — 원본 텍스처로 돌아갑니다';
  uB.onclick=_wdPicUndo; rB.onclick=_wdPicRedo; cB.onclick=_wdPicClear;
  [uB,rB,cB].forEach(b=>hist.appendChild(b));
  sec.appendChild(hist);

  const hint=mk('div','wd-pic-hint');
  if(_wdPic.ear) sec.appendChild(mk('div','wd-pic-hint','귀를 눌러 그려요. 대칭을 켜면 반대쪽 귀에 좌우를 뒤집어 같이 그려요.'));
  hint.innerHTML='Ctrl+Z 되돌리기 · Ctrl+Shift+Z 다시 · Delete 전체 지우기<br>B 붓 · G 페인트통(Shift+클릭 = 지우기) · E·C 지우개<br>X 대칭 · 우클릭 스포이드';
  sec.appendChild(hint);

  const foot=mk('div','wd-pic-row wd-pic-foot');
  const cancel=mk('button','wd-pic-btn','취소');
  const done=mk('button','wd-pic-btn wd-pic-done','완료');
  cancel.onclick=()=>exitWdPicMode(false);
  done.onclick=()=>exitWdPicMode(true);
  foot.appendChild(cancel); foot.appendChild(done);
  sec.appendChild(foot);
}

/* ── 캔버스 입력 ──
   ⚠️ 레이캐스트 대상은 **이 파츠의 _pic 메쉬뿐**이다. 파츠 전체를 대상으로 하면 안쪽의 다른 메쉬에
     맞은 UV 로 엉뚱한 자리에 획이 찍힌다. */
const _wdPicRay=new THREE.Raycaster(), _wdPicNdc=new THREE.Vector2(), _picCastRay=new THREE.Raycaster();

/* ── 🦴 리깅 파츠(스킨드 메시) 레이캐스트 ─────────────────────────────────────
   [증상] 모자에는 그려지는데 **상의에는 한 획도 안 찍힌다.** 오류도 안 나고 아무 일도 안 일어난다.
   [원인] three r128 의 기본 레이캐스트는 **스키닝을 계산하지 않는다.** 본을 따라 움직인 '지금 모양'이
     아니라 내보낼 때의 바인드 포즈(대개 T 포즈)를 맞힌다. 모자는 본에 통째로 매달린 리지드 파츠라
     바인드 포즈와 실제 위치가 같아서 멀쩡했고, 상의처럼 **몸에 스키닝된 파츠**는 광선이 허공에서
     놀아 hit 이 아예 안 나온다. 그래서 카테고리를 타는 것처럼 보인다 — 실제 기준은 리깅 여부다.
   [대응] 스킨드 메시는 지금 자세의 정점을 직접 구해서 삼각형을 훑는다.
   ★ 정점 계산은 **프레임당 한 번만** 한다. 획 하나를 긋는 동안 pointermove 가 수십 번 오는데
     그때마다 전체 정점을 다시 구하면 그리는 손이 눈에 띄게 끊긴다.
   ⚠️ 여기서 나온 hit 에는 face(법선)가 없다 — 대칭은 mirrorUVOn 의 카메라 방향 폴백을 탄다.
     얼굴 그리기가 법선을 못 구할 때 쓰는 것과 같은 길이라 새 규칙이 아니다. */
const _pskVec=new THREE.Vector3(), _pskBase=new THREE.Vector3(), _pskMat=new THREE.Matrix4(), _pskAcc=new THREE.Vector3();
const _pskSi=new THREE.Vector4(), _pskSw=new THREE.Vector4();
const _pskA=new THREE.Vector3(), _pskB=new THREE.Vector3(), _pskC=new THREE.Vector3(), _pskP=new THREE.Vector3();
const _pskUvA=new THREE.Vector2(), _pskUvB=new THREE.Vector2(), _pskUvC=new THREE.Vector2(), _pskBary=new THREE.Vector3();
const _pskInv=new THREE.Matrix4(), _pskN=new THREE.Vector3();
const _pskLA=new THREE.Vector3(), _pskLB=new THREE.Vector3(), _pskLC=new THREE.Vector3(), _pskT=new THREE.Vector3();
function _picIsSkinned(o){
  return !!(o && o.isSkinnedMesh && o.skeleton && o.geometry && o.geometry.attributes
            && o.geometry.attributes.skinIndex && o.geometry.attributes.skinWeight);
}
/* 지금 자세의 정점을 월드 좌표로 — 16ms 캐시. */
function _picSkinnedPositions(sm){
  const g=sm.geometry, pos=g.attributes.position, n=pos.count, ud=sm.userData;
  const now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  if(ud._picSkinArr && ud._picSkinArr.length===n*3 && (now-(ud._picSkinT||0))<16) return ud._picSkinArr;
  const arr=(ud._picSkinArr && ud._picSkinArr.length===n*3) ? ud._picSkinArr : new Float32Array(n*3);
  const si=g.attributes.skinIndex, sw=g.attributes.skinWeight, sk=sm.skeleton;
  for(let i=0;i<n;i++){
    _pskSi.fromBufferAttribute(si,i); _pskSw.fromBufferAttribute(sw,i);
    _pskBase.fromBufferAttribute(pos,i).applyMatrix4(sm.bindMatrix);
    _pskAcc.set(0,0,0);
    for(let k=0;k<4;k++){
      const w=_pskSw.getComponent(k); if(!w) continue;
      const bone=sk.bones[_pskSi.getComponent(k)]; if(!bone) continue;
      _pskMat.multiplyMatrices(bone.matrixWorld, sk.boneInverses[_pskSi.getComponent(k)]);
      _pskAcc.addScaledVector(_pskVec.copy(_pskBase).applyMatrix4(_pskMat), w);
    }
    _pskAcc.applyMatrix4(sm.bindMatrixInverse).applyMatrix4(sm.matrixWorld);
    arr[i*3]=_pskAcc.x; arr[i*3+1]=_pskAcc.y; arr[i*3+2]=_pskAcc.z;
  }
  ud._picSkinArr=arr; ud._picSkinT=now;
  return arr;
}
function _picSkinnedIntersect(ray, sm){
  const g=sm.geometry, uvAttr=g.attributes.uv; if(!uvAttr) return null;
  const P=_picSkinnedPositions(sm);
  const idx=g.index, cnt=idx?idx.count:g.attributes.position.count;
  let best=null, bestD=Infinity;
  for(let t=0;t+2<cnt;t+=3){
    const i0=idx?idx.getX(t):t, i1=idx?idx.getX(t+1):t+1, i2=idx?idx.getX(t+2):t+2;
    _pskA.fromArray(P,i0*3); _pskB.fromArray(P,i1*3); _pskC.fromArray(P,i2*3);
    /* 🚫 뒷면은 아예 안 맞힌다(backfaceCulling=true).
       [경위] 처음엔 "옷은 얇으니 뒷면도 받자"고 열어 뒀는데, 그게 **직선 사고의 주범**이었다.
         실루엣을 스치는 광선은 앞판을 지나쳐 **뒤판**을 맞힌다. 뒤판의 UV 는 앞판과 다른 섬이라
         직전 점과 이으면 텍스처를 가로지르는 직선이 그어진다.
       ★ 안 보이는 면에 칠할 이유가 없다 — 못 맞히면 hit 이 없고, hit 이 없으면 획이 끊긴다.
         그게 실루엣을 넘어갔을 때 우리가 원하는 동작이다. */
    if(!ray.intersectTriangle(_pskA,_pskB,_pskC,true,_pskP)) continue;
    const d=ray.origin.distanceToSquared(_pskP);
    if(d>=bestD) continue;
    THREE.Triangle.getBarycoord(_pskP,_pskA,_pskB,_pskC,_pskBary);
    if(!(_pskBary.x>=-0.001)) continue;   // 찌그러진 삼각형 — getBarycoord 가 (-2,-1,-1) 을 돌려준다
    bestD=d;
    _pskUvA.fromBufferAttribute(uvAttr,i0); _pskUvB.fromBufferAttribute(uvAttr,i1); _pskUvC.fromBufferAttribute(uvAttr,i2);
    /* 🪞 대칭에 쓸 **표면 법선**을 같이 돌려준다.
       [경위] 처음엔 face:null 로 뒀다. 그러면 mirrorUVOn 이 법선을 못 찾아 '카메라 방향' 폴백을 탄다.
         얼굴처럼 한 겹 볼록한 면에서는 그 폴백이 충분했지만, 옷은 몸통·소매가 겹쳐 있어서
         카메라 쪽에서 쏜 광선이 **반대편 표면 대신 앞쪽의 다른 천**을 먼저 맞힌다.
         그래서 대칭 획이 엉뚱한 자리에 조금씩 어긋나 찍혔다 — "대칭이 조금 이상하다"가 이것이다.
       ★ mirrorUVOn 은 법선을 **로컬 좌표**로 받는다(받아서 matrixWorld 로 돌린다). 여기 정점은
         월드 좌표라 로컬로 되돌린 뒤 법선을 낸다. 이겨낸 삼각형 하나에 대해서만 계산한다. */
    _pskInv.copy(sm.matrixWorld).invert();
    _pskLA.copy(_pskA).applyMatrix4(_pskInv);
    _pskLB.copy(_pskB).applyMatrix4(_pskInv);
    _pskLC.copy(_pskC).applyMatrix4(_pskInv);
    _pskN.copy(_pskLC).sub(_pskLB).cross(_pskT.copy(_pskLA).sub(_pskLB)).normalize();
    /* faceIndex — 페인트통(paint-tools.js)이 누른 삼각형의 UV 섬을 찾는다. three 기본 캐스트와 같은 번호(인덱스/3). */
    best={ object:sm, point:_pskP.clone(), face:{ normal:_pskN.clone() }, faceIndex:t/3,
      uv:new THREE.Vector2(
        _pskUvA.x*_pskBary.x + _pskUvB.x*_pskBary.y + _pskUvC.x*_pskBary.z,
        _pskUvA.y*_pskBary.x + _pskUvB.y*_pskBary.y + _pskUvC.y*_pskBary.z) };
  }
  return best;
}
/* 그리기용 레이캐스트 — 리깅이면 위의 길, 아니면 평소 길. 가장 가까운 hit 하나. */
function _picIntersect(ray, meshes){
  let best=null, bestD=Infinity;
  for(let i=0;i<meshes.length;i++){
    const o=meshes[i]; if(!o || o.visible===false) continue;
    let h=null;
    if(_picIsSkinned(o)) h=_picSkinnedIntersect(ray,o);
    else {
      _picCastRay.ray.copy(ray); _picCastRay.near=0; _picCastRay.far=Infinity;
      const hs=_picCastRay.intersectObject(o,false);
      /* 🚫 여기서도 **카메라를 향한 면**만 쓴다. 파츠 재질은 대개 양면(doubleSided)이라
         three 가 뒷면 hit 도 같이 돌려준다 — 거리순이므로 앞에서부터 훑어 처음 만나는 앞면을 쓴다.
         (스킨드 경로는 삼각형 단계에서 이미 걸러진다) */
      h=null;
      for(let k=0;k<hs.length;k++){
        const c=hs[k]; if(!c || !c.uv) continue;
        const n=c.face && c.face.normal;
        if(n){
          _pskN.copy(n).transformDirection(o.matrixWorld);
          if(_pskN.dot(ray.direction) >= 0) continue;   // 뒷면 — 건너뛴다
        }
        h=c; break;
      }
    }
    if(!h || !h.uv) continue;
    const d=ray.origin.distanceToSquared(h.point);
    if(d<bestD){ bestD=d; best=h; }
  }
  return best;
}
/* 🩹 [2026-10-08 제보 #3] 도장 «감아 칠하기» — 턱 아래처럼 정면 광선이 못 맞히는 곳까지 이어서 칠한다.
   [왜] 도장은 지금 카메라 정면에서 격자마다 광선을 쏴 **앞면에 맞은 점만** 찍는다. 턱 밑은 아래를 향해서
     정면 광선이 스쳐 지나가고, 그 칸은 버려졌다(「얼굴을 벗어나 잘렸어요」).
   [방법] 빗나간 격자점마다 그 광선이 얼굴 중심에 가장 가까워지는 점 P 를 잡고, 중심에서 P 쪽 바깥에서
     **중심을 향해** 다시 쏜다(방사 투영). 맞은 곳은 턱 밑 표면의 실제 자리라, 도장 아랫부분이 턱선을 넘어
     감기듯 이어지고 비스듬한 면이라 그만큼 늘어나 보인다(요청한 모양).
   ⚠️ 예전 «번짐 띠»(EXTRA_MAX 주석)와 원리가 다르다 — 그건 추정 UV 가 텍스처 가장자리 한 점에 뭉쳐서 났다.
     여기 점들은 전부 메시의 실제 다른 자리라 뭉치지 않는다. 그래도 엉뚱한 곳(귀 · 뒤통수)으로 튀지 않게
     ① 이미 맞은 이웃에서 한 고리씩만 자라고(STAMP_WRAP_RINGS) ② 이웃 점과 3D 거리가 보통 간격의 4배를 넘으면 버리고
     ③ 얼굴 **아래쪽**(중심보다 아래 방향)만 감는다. 이음새 판정(_uvFar)은 그리기 단계에서 그대로 한 번 더 걸린다.
   ★ 사람(commitStamp) · 동물(animal.js aCommitStamp)이 같이 쓴다. */
const STAMP_WRAP_RINGS = 6;          // 실루엣 밖으로 몇 칸까지 감을지(격자 칸 수)
const STAMP_WRAP_MAX_STEP = 4;       // 이웃과의 3D 거리 상한 — 보통 격자 간격의 배수
const STAMP_WRAP_DOWN = -0.35;
const STAMP_WRAP_MAX_R = 0.35;        // 이웃과의 3D 거리 상한(얼굴 반지름 비율) — 이보다 멀면 다른 부위로 튄 것       // 이 값보다 아래를 향한 쪽만 감는다(얼굴 위쪽 축 기준 cos)
function _stampWrapCenter(mesh){
  const g = mesh && mesh.geometry; if(!g) return null;
  if(!g.boundingSphere) g.computeBoundingSphere();
  if(!g.boundingSphere) return null;
  mesh.updateMatrixWorld(true);
  const c = g.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);
  const sc = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
  return { c, r: g.boundingSphere.radius * Math.max(Math.abs(sc.x), Math.abs(sc.y), Math.abs(sc.z)), up };
}
/* arr: 격자 (N+1)² — {x,y,p?} 또는 null. rays: 빗나간 칸 표시(감아 칠할 후보). 채운 칸 수를 돌려준다.
   [걷기] 빗나간 칸 옆의 맞은 점 Q 와 그 안쪽 점 Q2 가 향하던 방향(Q−Q2)으로 **한 칸 크기만큼** 더 나간 자리 T 를 잡고,
     얼굴 중심에서 T 쪽 바깥에서 중심을 향해 쏴 표면에 다시 붙인다. 다음 고리는 그 점에서 또 한 칸 — 그래서 턱선을 넘어
     표면을 따라 고르게 감겨 들어간다.
   ⚠️ «광선이 중심에 가장 가까운 점» 으로 붙이는 방식은 처음에 썼다가 버렸다 — 아래 칸으로 갈수록 점이 턱 밑 한 곳에
     몰리고 앞쪽으로 되돌아와 그림이 접혔다(구 흉내에서 확인). */
function _stampWrapFill(arr, N, rays, meshes, ctr){
  if(!ctr || !meshes || !meshes.length) return 0;
  const W = N + 1, ds = [];
  for(let j=0;j<=N;j++) for(let i=0;i<N;i++){
    const a = arr[j*W+i], b = arr[j*W+i+1];
    if(a && b && a.p && b.p) ds.push(a.p.distanceTo(b.p));
  }
  for(let j=0;j<N;j++) for(let i=0;i<=N;i++){
    const a = arr[j*W+i], b = arr[(j+1)*W+i];
    if(a && b && a.p && b.p) ds.push(a.p.distanceTo(b.p));
  }
  if(!ds.length) return 0;
  ds.sort((x,y)=>x-y);
  const cell = Math.max(1e-6, ds[ds.length>>1]);   // 칸 크기(3D) — 걸음 한 번의 길이
  /* 이웃과의 3D 거리 상한 — 칸 크기의 배수, 단 얼굴 반지름의 일정 비율까지는 허용(턱선 바로 밑은 원래 벌어져 있다). */
  const maxStep = Math.max(cell * STAMP_WRAP_MAX_STEP, ctr.r * STAMP_WRAP_MAX_R);
  const ray = new THREE.Ray(), T = new THREE.Vector3(), dir = new THREE.Vector3(), v = new THREE.Vector3();
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  let filled = 0;
  for(let ring=0; ring<STAMP_WRAP_RINGS; ring++){
    const add = [];
    for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){
      const k = j*W+i;
      if(arr[k] || !rays[k]) continue;
      let best = null;
      for(const [di,dj] of DIRS){
        const i1 = i+di, j1 = j+dj, i2 = i+2*di, j2 = j+2*dj;
        if(i2<0||i2>N||j2<0||j2>N) continue;
        const q = arr[j1*W+i1], q2 = arr[j2*W+i2];
        if(!q || !q2 || !q.p || !q2.p) continue;
        dir.copy(q.p).sub(q2.p); const L = dir.length(); if(L < 1e-9) continue;
        T.copy(q.p).addScaledVector(dir, cell / L);      // 같은 방향으로 한 칸 더
        v.copy(T).sub(ctr.c); const len = v.length(); if(len < 1e-6) continue;
        v.multiplyScalar(1/len);
        if(v.dot(ctr.up) > STAMP_WRAP_DOWN) continue;   // 아래쪽만
        ray.origin.copy(ctr.c).addScaledVector(v, ctr.r * 2.5);
        ray.direction.copy(v).negate();
        const h = _picIntersect(ray, meshes);
        if(!h || !h.uv) continue;
        const dq = h.point.distanceTo(q.p);
        if(dq > maxStep || dq < cell * 0.2) continue;   // 멀리 튐 · 제자리(더 못 감음)
        if(!best || dq < best.d) best = { d: dq, u: { x:h.uv.x, y:h.uv.y, p:h.point.clone(), wrap:true } };
      }
      if(best) add.push([k, best.u]);
    }
    if(!add.length) break;
    add.forEach(([k,u])=>{ arr[k] = u; }); filled += add.length;
  }
  return filled;
}
function _wdPicHit(e){
  const cv=document.getElementById('wdPreviewCanvas'); if(!cv || !_wdPic.meshes.length) return null;
  const r=cv.getBoundingClientRect();
  _wdPicNdc.x=((e.clientX-r.left)/r.width)*2-1;
  _wdPicNdc.y=-((e.clientY-r.top)/r.height)*2+1;
  _wdPicRay.setFromCamera(_wdPicNdc, wdCam());
  return _picIntersect(_wdPicRay.ray, _wdPic.meshes);
}
/* 🧵 이 메쉬에서 "3D 로 1 만큼 움직이면 UV 로 얼마나 움직이는가" — 솔기 판정의 기준자.
   삼각형 200 개 정도만 훑어 중앙값을 쓴다(한 번 재고 기억한다). UV 가 균일하지 않아도
   중앙값이면 대표값으로 충분하다 — 우리가 가리려는 것은 '몇 배 큰' 튐이지 미세한 왜곡이 아니다. */
function _wdPicUvScale(mesh){
  if(mesh.userData.picUvScale != null) return mesh.userData.picUvScale;
  let s = 1;
  try{
    const g=mesh.geometry, pos=g.attributes.position, uv=g.attributes.uv, idx=g.index;
    const sc=new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
    const k=Math.max(sc.x, sc.y, sc.z) || 1;
    const cnt=idx?idx.count:pos.count;
    const step=Math.max(3, Math.floor(cnt/600)*3);
    const rs=[];
    for(let t=0;t+1<cnt;t+=step){
      const a=idx?idx.getX(t):t, b=idx?idx.getX(t+1):t+1;
      const dx=pos.getX(a)-pos.getX(b), dy=pos.getY(a)-pos.getY(b), dz=pos.getZ(a)-pos.getZ(b);
      const wl=Math.sqrt(dx*dx+dy*dy+dz*dz)*k; if(wl<=1e-6) continue;
      const ux=uv.getX(a)-uv.getX(b), uy=uv.getY(a)-uv.getY(b);
      const ul=Math.sqrt(ux*ux+uy*uy); if(ul<=1e-9) continue;
      rs.push(ul/wl);
    }
    if(rs.length){ rs.sort((p,q)=>p-q); s=rs[rs.length>>1]; }
  }catch(_){}
  mesh.userData.picUvScale = s;
  return s;
}
function _wdPicPaint(hit){
  const tgt=_wdPicTgtOf(hit.object);
  const g=tgt.user.getContext('2d');
  g.lineCap='round'; g.lineJoin='round';
  g.lineWidth=_wdPic.size;
  g.globalCompositeOperation=_wdPic.eraser?'destination-out':'source-over';
  g.strokeStyle=_wdPic.color;
  /* 🧵 UV 솔기·뒷면 건너뜀 판정.
     [증상] 파츠 영역을 벗어나게 그으면 엉뚱한 **직선**이 텍스처를 가로지른다.
     [원인] 실루엣을 넘는 순간 광선이 앞면 대신 **뒷면**을 맞힌다(옷은 양면이다). 그 지점의 UV 는
       앞면과 전혀 다른 섬에 있어서, 직전 점과 이으면 텍스처 위를 가로지르는 긴 직선이 그려진다.
       앞판→뒤판처럼 UV 섬이 갈리는 자리를 지날 때도 똑같다.
     [판정] 3D 로는 조금 움직였는데 UV 로는 그것으로 설명이 안 될 만큼 뛰었으면 솔기를 건넌 것이다.
       그때는 잇지 않고 **거기서 획을 끊는다**(다음 점부터 새 획). 빠르게 긋는 것과 구분되는 이유가
       이 '3D 이동량 대비' 다 — 빨리 그으면 3D 도 같이 많이 움직이므로 허용치도 같이 커진다.
     ⚠️ 지우개도 같은 길을 탄다 — 안 그러면 지우다가 반대편이 같이 지워진다. */
  const cx=hit.uv.x*CANVAS_SZ(), cy=hit.uv.y*CANVAS_SZ();
  const wD=(_wdPic.lp && hit.point) ? _wdPic.lp.distanceTo(hit.point) : 0;
  /* ⚠️ 허용치에 **천장**을 둔다. 이동량 비례만 두면 "빠르게 그으면서 솔기를 넘는" 경우에
     3D 이동량이 커진 만큼 허용치도 같이 커져서 튐이 안 걸린다 — 가끔 직선이 남던 나머지 절반이
     이것이었다. 한 이벤트에 UV 를 25% 넘게 건너뛰는 것은 정상적인 획이 아니다. */
  const allow = Math.min(0.25, wD * _wdPicUvScale(hit.object) * 4 + 0.02);
  const jumped = !!(_wdPic.luv &&
    (_wdPic.lobj !== hit.object ||   // 같은 파츠의 다른 면으로 넘어갔다 — UV 판이 아예 다르다
     Math.hypot(hit.uv.x-_wdPic.luv.x, hit.uv.y-_wdPic.luv.y) > allow));
  let lx=_wdPic.lx, ly=_wdPic.ly;
  if(jumped){ lx=null; ly=null; }
  strokeSeg(g,lx,ly,cx,cy);
  _wdPic.lx=cx; _wdPic.ly=cy;
  _wdPic.luv={x:hit.uv.x, y:hit.uv.y};
  _wdPic.lobj=hit.object;
  if(hit.point){ if(!_wdPic.lp) _wdPic.lp=new THREE.Vector3(); _wdPic.lp.copy(hit.point); }
  if(_wdPic.sym){
    /* 🐾 귀 — 반대쪽 귀의 같은 자리(human-ear.js mirrorUv). 파츠 — 같은 파츠 안에서 좌우 되쏘기. */
    let m=null, mg=g, mt=tgt;
    if(_wdPic.ear){
      mt=_wdPic.tgts.find(t=>t!==tgt) || null;
      const om=mt && mt.wrp.userData.picMeshes[tgt.wrp.userData.picMeshes.indexOf(hit.object)];
      m=om ? humanEar.mirrorUv(hit, om) : null;
      if(mt){
        mg=mt.user.getContext('2d');
        mg.lineCap='round'; mg.lineJoin='round'; mg.lineWidth=_wdPic.size;
        mg.globalCompositeOperation=g.globalCompositeOperation; mg.strokeStyle=_wdPic.color;
      }
    } else {
      m=mirrorUVOn(hit, hit.object, wdCam(), _wdPicMirrorCx(hit.object),
                   (ray, mesh)=>_picIntersect(ray,[mesh]), _wdPicMirrorOff(hit.object));
    }
    if(m && mt){
      // 귀는 본 획이 솔기에서 끊기면 반대쪽도 끊는다(다른 캔버스라 UV 튐만으로는 못 본다) · 파츠는 예전 그대로
      const mj = !!((_wdPic.ear && jumped) || (_wdPic.smuv && Math.hypot(m.x-_wdPic.smuv.x, m.y-_wdPic.smuv.y) > allow));
      const mx=m.x*CANVAS_SZ(), my=m.y*CANVAS_SZ();
      strokeSeg(mg, mj?null:_wdPic.sx, mj?null:_wdPic.sy, mx, my);
      _wdPic.sx=mx; _wdPic.sy=my; _wdPic.smuv={x:m.x, y:m.y};
      mg.globalCompositeOperation='source-over';
      if(mt!==tgt) _picBlit(mt.wrp);
    }
    else { _wdPic.sx=_wdPic.sy=null; _wdPic.smuv=null; }
  }
  g.globalCompositeOperation='source-over';
  _picBlit(tgt.wrp);
}
/* 대칭 되쏘기를 표면에서 얼마나 물러나 시작할까 — 이 메쉬 크기에 맞춘다.
   ⚠️ 상수 0.6(얼굴 기준)을 옷에 그대로 쓰면 몸통 반대편이 아니라 앞쪽 천에서 출발한다.
   ★ 한 번만 재고 기억한다. */
function _wdPicMirrorOff(mesh){
  if(mesh.userData.picMirrorOff != null) return mesh.userData.picMirrorOff;
  let off = 0.6;
  try{
    const gm = mesh.geometry;
    if(gm){
      if(!gm.boundingSphere) gm.computeBoundingSphere();
      const s = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
      const r = gm.boundingSphere.radius * Math.max(s.x, s.y, s.z);
      if(r > 0) off = Math.max(0.02, Math.min(0.6, r * 0.5));
    }
  }catch(_){}
  mesh.userData.picMirrorOff = off;
  return off;
}
/* 대칭 기준선 — 이 메쉬 자신의 가운데다(얼굴이 cBase.faceCx 를 쓰는 것과 같다).
   기하에서 한 번만 재고 기억한다. */
function _wdPicMirrorCx(mesh){
  if(mesh.userData.picCx != null) return mesh.userData.picCx;
  let cx = 0;
  try{
    const gm = mesh.geometry;
    if(gm){ if(!gm.boundingBox) gm.computeBoundingBox(); cx = (gm.boundingBox.min.x + gm.boundingBox.max.x)/2; }
  }catch(_){}
  mesh.userData.picCx = cx;
  return cx;
}
/* 우클릭 스포이드 — 보이는 그대로(원본 텍스처 포함)에서 집는다. */
function _wdPicEyedrop(e){
  const hit=_wdPicHit(e); if(!hit) return false;
  const comp=hit.object.userData.picComp; if(!comp) return false;
  const W=hit.object.userData.picW||comp.width, H=hit.object.userData.picH||comp.height;
  const x=Math.max(0,Math.min(W-1,Math.floor(hit.uv.x*W)));
  const y=Math.max(0,Math.min(H-1,Math.floor(hit.uv.y*H)));
  let d; try{ d=comp.getContext('2d').getImageData(x,y,1,1).data; }catch(_){ return false; }
  if(d[3]<8) return false;   // 빈 픽셀은 무시
  _wdPic.color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  _wdPicSetEraser(false);
  const sw=document.getElementById('wdPicColor'); if(sw) sw.style.background=TwSafeHtml.cssColor(_wdPic.color);
  const dot=document.querySelector('#wdPicSection .wd-pic-dot'); if(dot) dot.style.background=TwSafeHtml.cssColor(_wdPic.color);
  return true;
}
/* 획을 끊는다 — 다음 점부터 새 획. 끊는 자리가 여러 곳이라 한 함수로 모은다. */
function _wdPicBreak(){
  _wdPic.lx=_wdPic.ly=_wdPic.sx=_wdPic.sy=null;
  _wdPic.luv=_wdPic.smuv=_wdPic.lp=_wdPic.lobj=null;
}
/* 🪡 빠른 움직임 쪼개기.
   [왜] 포인터 이벤트 하나가 화면에서 100px 을 건너뛰면, 그 사이에 실루엣을 넘었는지 솔기를 지났는지
     **알 방법이 없다.** 두 점만 보고 판정하니 "빠르게 그으면서 솔기를 넘는" 경우가 계속 새어 나갔다
     (직선이 '가끔' 남던 나머지 절반이 이것이다).
   ★ 화면 경로를 몇 px 단위로 쪼개 각 지점을 따로 맞힌다. 그러면 한 걸음이 작아져서
     솔기 판정(3D 이동량 대비 UV 튐)이 제대로 걸리고, 덤으로 빠른 획의 끊김도 메워진다.
   ⚠️ 걸음 수에 상한을 둔다 — 무거운 메쉬에서 한 이벤트에 수십 번 레이캐스트하면 손이 끊긴다. */
const WD_PIC_STEP_PX = 6, WD_PIC_MAX_STEPS = 8;
function _wdPicStrokeTo(e){
  const sx=_wdPic.lsx, sy=_wdPic.lsy;
  if(sx==null){
    const h=_wdPicHit(e); if(h) _wdPicPaint(h); else _wdPicBreak();
    _wdPic.lsx=e.clientX; _wdPic.lsy=e.clientY; return;
  }
  const dx=e.clientX-sx, dy=e.clientY-sy;
  const n=Math.min(WD_PIC_MAX_STEPS, Math.max(1, Math.ceil(Math.hypot(dx,dy)/WD_PIC_STEP_PX)));
  for(let i=1;i<=n;i++){
    const h=_wdPicHit({ clientX: sx+dx*i/n, clientY: sy+dy*i/n });
    if(h) _wdPicPaint(h); else _wdPicBreak();   // 파츠 밖 — 거기서 끊는다
  }
  _wdPic.lsx=e.clientX; _wdPic.lsy=e.clientY;
}
(function bindWdPicInput(){
  const cv=document.getElementById('wdPreviewCanvas'); if(!cv) return;
  cv.addEventListener('pointerdown', e=>{
    if(!_wdPic.on) return;
    if(e.button===2){ _wdPic.rc={x:e.clientX,y:e.clientY,moved:false}; return; }   // 우클릭은 아래 pointerup 에서 판정
    if(e.button!==0) return;
    const hit=_wdPicHit(e); if(!hit) return;
    e.preventDefault(); e.stopPropagation();   // 다중 인스턴스 선택 클릭이 같이 먹지 않게
    if(_wdPic.fill){ _wdPicPush(); _wdPicFillHit(hit, e.shiftKey); return; }   // 🪣 한 번 누르면 끝 — 끌기 획이 아니다 · Shift = 그 자리 지우기
    _wdPicPush();
    _wdPic.drawing=true; _wdPicBreak();
    _wdPic.lsx=e.clientX; _wdPic.lsy=e.clientY;   // 🪡 쪼개기의 출발점
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    _wdPicPaint(hit);
  }, true);
  cv.addEventListener('pointermove', e=>{
    if(!_wdPic.on) return;
    if(wdPaintTool){ const cu=wdPaintTool.cursor(); if(cv.style.cursor!==cu) cv.style.cursor=cu; }   // 🖌 커서 = 지금 도구
    if(_wdPic.rc && !_wdPic.rc.moved &&
       Math.abs(e.clientX-_wdPic.rc.x)+Math.abs(e.clientY-_wdPic.rc.y)>4) _wdPic.rc.moved=true;
    if(!_wdPic.drawing) return;
    _wdPicStrokeTo(e);   // 🪡 한 이벤트가 크게 건너뛰었으면 그 사이를 쪼개서 훑는다
  }, true);
  const end=e=>{
    if(!_wdPic.on) return;
    /* 우클릭을 **안 움직이고** 뗐으면 스포이드. 움직였으면 그건 회전이었다(기존 오빗이 처리했다). */
    if(e.button===2 && _wdPic.rc){
      const wasClick=!_wdPic.rc.moved; _wdPic.rc=null;
      if(wasClick) _wdPicEyedrop(e);
      return;
    }
    if(!_wdPic.drawing) return;
    _wdPic.drawing=false; _wdPicBreak(); _wdPic.lsx=_wdPic.lsy=null;
    try{ cv.releasePointerCapture(e.pointerId); }catch(_){}
  };
  cv.addEventListener('pointerup', end, true);
  cv.addEventListener('pointercancel', e=>{ _wdPic.rc=null; end(e); }, true);
})();

/* ── 단축키 ──
   window 캡처 단계 = 가장 이른 자리. 여기서 잡고 stopImmediatePropagation 으로 **끊는다**.
   끊지 않으면 생성기·재생목록·스티커사진이 같은 키를 한 번 더 처리한다. */
function _wdPicKey(e){
  if(!_wdPic.on) return;
  const t=e.target, tag=(t&&t.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||(t&&t.isContentEditable)) return;   // 채팅·이름칸이 우선이다
  const stop=()=>{ e.preventDefault(); e.stopImmediatePropagation(); };
  const k=(e.key||'').toLowerCase();
  if(e.ctrlKey||e.metaKey){
    if(k==='z'){ stop(); e.shiftKey ? _wdPicRedo() : _wdPicUndo(); }
    else if(k==='y'){ stop(); _wdPicRedo(); }   // 윈도 관습 — 스티커사진 꾸미기도 같이 받는다
    return;
  }
  if(e.altKey) return;
  if(e.key==='Delete'){ stop(); _wdPicClear(); }
  else if(k==='x'){ stop(); _wdPicSetSym(!_wdPic.sym); }
  else if(k==='c'){ stop(); _wdPicSetEraser(!_wdPic.eraser); }
  else if(wdPaintTool && wdPaintTool.handleKey(e)){ stop(); }   // B 붓 · G 페인트통 · E 지우개 — 생성기와 같은 글자(한글 상태 맥 포함)
  else if(e.key==='Escape'){ stop(); exitWdPicMode(false); }   // 창이 같이 닫히지 않게 여기서 끊는다
}
window.addEventListener('keydown', _wdPicKey, true);

/* 🖍️ 파츠 그림칸(_pic) ────────────────────────────────────────────────────────
   메쉬(또는 머티리얼) 이름에 _pic 이 붙어 있으면 그 면에 유저가 직접 그릴 수 있다.
   판정 규칙은 _col 과 **똑같은 모양**이다(대소문자 무관 · 번호 허용 · 메쉬/머티리얼 어느
   이름에 붙어도 인식). 두 규칙이 갈리면 "색은 바뀌는데 그림은 안 되는" 파츠가 생긴다 —
   sceneHasColorGroup 옆에 붙은 경고와 같은 종류의 사고다.

   ★ 원본 텍스처를 **절대 지우지 않는다.** 층이 셋이다:
       picBase (원본 map, 없으면 원래 색을 구운 것)
       picUser (유저가 그린 것 — 파츠 하나에 하나, 저장·전송되는 것도 이것뿐)
       picComp (둘을 합친 것 = 실제로 메쉬에 걸리는 map)
     '전체 지우기'는 picUser 만 비운다 = 원본으로 돌아온다. 원본이 파괴되는 길이 아예 없다.
   ★ 한 파츠에 _pic 메쉬가 여럿이면 picUser 를 **같이 쓴다**(그림칸은 하나다).
     UV 를 나눠 쓰는 앞판·뒷판이 이걸로 자연스럽게 한 장에 담긴다.
   ⚠️ _pic 메쉬는 _col 대상에서 뺀다(equipPartOnSeat 참고). 한 메쉬에 둘을 같이 걸면
     색(곱셈)이 그림 위에 겹쳐서 고른 색과 찍히는 색이 계속 어긋난다.
   ⚠️ 텍스처의 flipY 는 **원본과 같은 값**으로 맞춘다(원본이 없으면 false — 생성기 dispTex 와 같다).
     여기가 어긋나면 그림이 위아래로 뒤집혀 찍히는데, 화면에서는 "엉뚱한 데 그려진다"로 보인다. */
const PART_PIC_RE = /_pic(\d*)/i;
/* 🧭 UV 칸 구제 — "진짜 UV 가 0번이 아니라 1번 칸에 들어 있는" 파츠.
   [증상] 그린 대로 안 찍히고 **파츠 전체가 옅게 물든다.** 굵기를 최대로 올려도 그대로다.
   [원인] 블렌더에서 UV 맵이 두 개이고 첫 번째가 비어 있으면, glTF 의 TEXCOORD_0 이
     전 정점 같은 값(축퇴)으로 나가고 진짜 UV 는 TEXCOORD_1(three 의 uv2)에 실린다. 그러면
       (a) 원본 텍스처가 텍셀 **하나**로 면 전체를 칠하고,
       (b) 레이캐스트가 돌려주는 uv 도 늘 같은 한 점이라 모든 획이 그 점에 겹쳐 찍힌다.
     그 텍셀 하나가 조금 물들면 → 파츠 전체가 옅게 변한다. **굵기와 무관한 이유가 이것이다.**
     (실제 제보 GLB: TEXCOORD_0 이 277 정점 전부 (0,1) 하나, TEXCOORD_1 에 진짜 UV)
   ★ three r128 의 map 은 언제나 uv 를 쓴다 — 채널을 지정할 방법이 없다. 그래서 uv2 를 uv 로
     옮기는 것이 화면(원본 텍스처)과 그리기를 **한 번에** 되돌리는 유일한 길이다.
   ⚠️ 축퇴가 확실할 때만 손댄다. uv 가 넓이를 가지면 멀쩡한 파츠이므로 건드리지 않는다.
   ⚠️ 진짜 해결은 저작 쪽이다 — 블렌더에서 비어 있는 첫 UV 맵을 지우고 다시 내보내면 된다.
     여기 구제는 "조용히 이상해지는" 것을 막는 그물이지, 저작 실수를 정당화하는 자리가 아니다. */
function _uvSpread(a){
  if(!a || !a.count) return 0;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i), y=a.getY(i);
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  return Math.max(x1-x0, y1-y0);
}
/* 고치지 않고 "이 실수인가"만 본다 — 경고용. */
function g_uvLooksBroken(o){
  try{
    const g = o && o.geometry; if(!g || !g.attributes) return false;
    const uv = g.attributes.uv, uv2 = g.attributes.uv2;
    if(!uv2) return false;
    return (!uv || _uvSpread(uv) <= 1e-4) && _uvSpread(uv2) > 1e-4;
  }catch(_){ return false; }
}
function _picRepairUV(o){
  try{
    const g = o && o.geometry; if(!g || !g.attributes) return false;
    const uv = g.attributes.uv, uv2 = g.attributes.uv2;
    if(!uv2) return false;
    if(uv && _uvSpread(uv) > 1e-4) return false;   // 멀쩡한 UV — 손대지 않는다
    if(_uvSpread(uv2) <= 1e-4) return false;       // 두 칸 다 비었다 — 구제할 것이 없다
    g.setAttribute('uv', uv2.clone());
    return true;
  }catch(_){ return false; }
}

function meshIsPic(o){
  if(!o || !o.isMesh) return false;
  const m = o.material;
  return PART_PIC_RE.test(o.name || '') || !!(m && PART_PIC_RE.test(m.name || ''));
}
/* 이 파츠에 그릴 자리가 있는가 — UI(연필 버튼)를 낼지 말지의 단 하나의 기준. */
function wrapperHasPic(wrp){
  return !!(wrp && wrp.userData && wrp.userData.picMeshes && wrp.userData.picMeshes.length);
}
/* 층을 만든다(파츠당 한 번). 이미 만들어져 있으면 그대로 둔다. */
/* 층을 만든다(파츠당 한 번). 이미 만들어져 있으면 그대로 둔다.
   ★ base/comp 는 **원본 텍스처의 원래 크기**로 만든다(상한 PIC_BASE_MAX).
     [왜] 예전엔 전부 512(CANVAS_SZ)로 만들었는데, 그러면 1024 텍스처로 만든 파츠를 그냥 착용만 해도
       원본이 512로 줄어든 채 화면에 나갔다 — 아무도 그리지 않았는데 파츠가 흐려진다.
       원본은 원래 크기로 두고, 유저가 그린 512 층만 그 위에 늘려 얹는다.
   ★ 그리는 층(picUser)은 512 그대로다 — 얼굴 그리기와 같은 좌표계를 써야 붓 굵기·좌표 계산이
     두 화면에서 같은 뜻을 갖는다. */
const PIC_BASE_MAX = 2048;   // 원본 텍스처 상한 — 이보다 큰 텍스처만 줄인다
function _picSetup(wrp){
  if(!wrapperHasPic(wrp)) return null;
  if(wrp.userData.picUser) return wrp.userData.picUser;
  wrp.userData.picUser = newCanvas();
  wrp.userData.picMeshes.forEach(o=>{
    const m = o.material; if(!m) return;
    const img = (m.map && m.map.image) || null;
    let W = CANVAS_SZ(), H = CANVAS_SZ(), flip = false;
    if(img){
      flip = !!m.map.flipY;
      const iw = img.width || img.naturalWidth || 0, ih = img.height || img.naturalHeight || 0;
      if(iw > 0 && ih > 0){
        const k = Math.min(1, PIC_BASE_MAX / Math.max(iw, ih));
        W = Math.max(1, Math.round(iw * k)); H = Math.max(1, Math.round(ih * k));
      }
    }
    const mkC = ()=>{ const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const base = mkC(), bx = base.getContext('2d');
    if(img){
      try{ bx.drawImage(img, 0, 0, W, H); }
      catch(_){ bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, W, H); }
    } else {
      /* 원본 텍스처가 없는 파츠 — 원래 색을 base 에 굽고 재질은 흰색으로 둔다.
         안 그러면 map(그림) × color(원래 색) 이 곱해져서 파랑을 골랐는데 보라가 찍힌다. */
      bx.fillStyle = (m.color ? '#' + m.color.getHexString() : '#ffffff');
      bx.fillRect(0, 0, W, H);
      if(m.color) m.color.set('#ffffff');
    }
    const comp = mkC();
    const tex = new THREE.CanvasTexture(comp);
    tex.flipY = flip;
    if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    if(m.map){ tex.wrapS = m.map.wrapS; tex.wrapT = m.map.wrapT; }
    o.userData.picW = W; o.userData.picH = H;
    o.userData.picBase = base; o.userData.picComp = comp; o.userData.picTex = tex;
    m.map = tex;
    _applyPartMatTone(m);   // ★ emissiveMap 을 **새 map 으로** 다시 건다 — 이 앱의 화면 색은 emissive 가 정한다
    m.needsUpdate = true;
  });
  _picBlit(wrp);
  return wrp.userData.picUser;
}
/* base + user → comp. 획 하나마다 불린다(512×512 두 장이라 가볍다). */
function _picBlit(wrp){
  if(!wrapperHasPic(wrp)) return;
  const user = wrp.userData.picUser; if(!user) return;
  wrp.userData.picMeshes.forEach(o=>{
    const comp = o.userData.picComp, tex = o.userData.picTex; if(!comp || !tex) return;
    const W = o.userData.picW || comp.width, H = o.userData.picH || comp.height;
    const g = comp.getContext('2d');
    g.clearRect(0, 0, W, H);
    if(o.userData.picBase) g.drawImage(o.userData.picBase, 0, 0);
    g.drawImage(user, 0, 0, W, H);   // 그린 층(512)만 원본 크기에 맞춰 늘린다
    tex.needsUpdate = true;
  });
}
/* 저장된 그림(dataURL 또는 Storage URL)을 user 층에 올린다. src 가 없으면 비운다. */
async function _picLoad(wrp, src){
  if(!_picSetup(wrp)) return;
  const g = wrp.userData.picUser.getContext('2d');
  g.clearRect(0, 0, CANVAS_SZ(), CANVAS_SZ());
  if(src){
    try{ g.drawImage(await _loadImgCors(src), 0, 0, CANVAS_SZ(), CANVAS_SZ()); }
    catch(e){ console.warn('[파츠 그림] 불러오기 실패 — 원본 텍스처만 보입니다', src, e); }
  }
  _picBlit(wrp);
}
/* xf.pic 을 파츠에 반영. _applyXfToWrapper 가 부른다.
   ⚠️ 같은 그림이면 다시 안 올린다 — 기즈모를 만질 때마다 이미지 로드가 나가면 그리는 손이 끊긴다.
   ⚠️ **지금 그 파츠에 그리고 있는 중이면 손대지 않는다.** 안 그러면 위치를 한 번 건드릴 때마다
     그리던 획이 저장본으로 덮여 사라진다. */
function applyPartPic(wrp, src){
  if(!wrapperHasPic(wrp)) return;
  if(_wdPic.on && _wdPic.tgts.some(t=>t.wrp === wrp)) return;
  const v = (typeof src === 'string' && src) ? src : null;
  /* 아무도 안 그린 파츠는 **손대지 않는다.**
     [왜] 층을 만드는 순간 원본 map 이 캔버스 텍스처로 갈아 끼워진다. 그린 것이 없으면 그림도
       원본 그대로라 화면은 같아 보이지만, 파츠 하나당 캔버스 두 장이 공짜로 생기고 원본 텍스처가
       한 번 더 복사된다. 그림칸이 있다는 이유만으로 모든 착용자가 그 값을 치를 이유가 없다.
     ★ 그리기 모드로 들어갈 때는 enterWdPicMode 가 _picSetup 을 직접 부른다. */
  if(!v && !wrp.userData.picUser){ wrp.userData._picSrc = null; return; }
  if(wrp.userData._picSrc === v && wrp.userData.picUser) return;
  wrp.userData._picSrc = v;
  _picLoad(wrp, v);
}
/* 그림 한 장을 Storage 에 올리고 URL 을 돌려준다.
   ⚠️ 방 payload(equippedParts)에는 **URL 만** 실린다. dataURL 을 넣으면 def 가 갱신될 때마다,
     그리고 방에 들어오는 모든 사람이 512 PNG 를 통째로 내려받는다 — ensureRoomFaceUrls 주석의
     그 비용 사고와 같은 길이다. serializeDefForNetwork 에 안전망이 한 겹 더 있다.
   ★ 얼굴·귀 그림과 **같은 캐시**를 쓴다(tw.roomFaceUrls). 파일 이름이 곧 내용 해시라
     같은 그림은 몇 번을 저장해도 다시 안 올라간다. */
async function uploadPartPic(dataUrl){
  try{
    if(!dataUrl || !/^data:/.test(dataUrl)) return null;
    if(!window.firebaseAPI || !firebaseAPI.uploadRoomFace) return null;
    const uid = getMyUserId(); if(!uid) return null;
    /* ⚠️ [2026-09-18] 예전엔 여기서 `tw.roomFaceUrls` 를 **직접** 읽고, 넘치면
       `st = { [ck]: r.url }` 로 **방금 것 하나만 남기고 전부 버렸다.** 같은 저장 키를 얼굴이
       함께 쓰므로 파츠 그림 한 장이 얼굴 URL 을 통째로 날리는 길이었고, 해시가 바뀐 전환기에는
       그 상한에 훨씬 빨리 닿는다. 얼굴과 **같은 로더/세이버**를 쓰게 해 규칙을 한 벌로 맞춘다. */
    const st = _roomFaceCacheLoad();
    const h = _quickHash(dataUrl), ck = 'pic:' + h;
    if(st[ck]) return st[ck];
    const r = await firebaseAPI.uploadRoomFace(uid, 'pic_' + h, dataUrl);
    if(!r || !r.ok) return null;
    st[ck] = r.url;
    _roomFaceCacheSave(st);
    return r.url;
  }catch(e){ console.warn('[파츠 그림] 업로드 실패', e); return null; }
}

return {
  _picIntersect,
  _picRepairUV,
  _stampWrapCenter,
  _stampWrapFill,
  _wdActivePartRef: ()=>_wdActivePartRef,   // 읽는 함수
  setWdActivePartRef: (v)=>{ _wdActivePartRef = v; },   // 쓰는 함수 — app.js 가 비운다
  _wdPic,
  _wdPicUvScale,
  applyPartPic,
  enterWdPicMode,
  exitWdPicMode,
  g_uvLooksBroken,
  meshIsPic,
  refreshWdPicUI,
  wrapperHasPic,
};
}

const api = { createPartPaint };
if(typeof window !== 'undefined') window.TwPartPaint = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
