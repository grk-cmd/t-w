/* creator-xform.js — 🧭 생성기 변형: 생성기 미리보기에서 책상 위 아이템 · 책상 · 캐릭터를 옮기고 돌리고 키운다
   app.js «👻 …» 덩어리 안의 «아이템 3D 기즈모(어플 3)» · «좌석 세팅(6단계)» 두 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다.
   ・책임: TransformControls 하나(itemGizmo)를 아이템 또는 책상에 붙이고, 드래그가 끝나면 adj · cDeskPos 로 되짚어 저장한다(바닥 아래로는 못 간다).
     아이템 크기 ＋/－ · 초기화 · 색 패널 · 캐릭터 크기/높이/방향 슬라이더 · 책상 위치/길이/배율 버튼을 만들 때 건다.
   ・받는 deps 28 — 함수 14 · 값 3(CHAR_Y_MAX · DESK_SCALE_DEFAULT · deskItemOrigin) · 읽는 함수 11(생성기 상태 cBase · cDesk · cDeskPos · cXform … ·
     DESK_PART_ANCHOR_NAME · slotSaveMod) · 쓰는 함수 3(setCDeskLenX · setCDeskPos · setCDeskScale — 생성기 상태는 app.js 에 있다).
   ・내놓는 것: attachItemGizmoToActive() · detachItemGizmo() · updateDeskPosNum() — app.js 의 아이템 선택 · 생성기 닫기 · 프리셋이 부른다.
   ⚠️ document · THREE(TransformControls) · window.openCharColorPicker 는 전역 이름 그대로. 전역 이름은 TwCreatorXform(Tw 접두사 #103).
   검사: checks/sim-creator-xform.js */
(function(){

function createCreatorXform(deps){
const CHAR_Y_MAX = deps.CHAR_Y_MAX;
const DESK_PART_ANCHOR_NAME = deps.DESK_PART_ANCHOR_NAME;   // 읽는 함수
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;
const _applyItemColor = deps._applyItemColor;
const applyCreatorXform = deps.applyCreatorXform;
const applyDeskAdj = deps.applyDeskAdj;
const autoSaveDeskItemsNow = deps.autoSaveDeskItemsNow;
const baseFlatOf = deps.baseFlatOf;   // 재질 플랫 배율 읽기(shared/light-tone.js — 대체값 판단은 거기 한 곳)
const bindHold = deps.bindHold;
const cBase = deps.cBase;   // 읽는 함수
const cCam = deps.cCam;   // 읽는 함수
const cDesk = deps.cDesk;   // 읽는 함수
const cDeskLenX = deps.cDeskLenX;   // 읽는 함수
const cDeskPos = deps.cDeskPos;   // 읽는 함수
const cDeskScale = deps.cDeskScale;   // 읽는 함수
const cRenderer = deps.cRenderer;   // 읽는 함수
const cScene = deps.cScene;   // 읽는 함수
const cXform = deps.cXform;   // 읽는 함수
const clampCharY = deps.clampCharY;
const deskItemOrigin = deps.deskItemOrigin;
const floorClampWrapper = deps.floorClampWrapper;
const layoutSeats = deps.layoutSeats;
const openAssetImport = deps.openAssetImport;
const setCreatorDeskScale = deps.setCreatorDeskScale;
const setDeskPos = deps.setDeskPos;
const slotSaveMod = deps.slotSaveMod;   // 읽는 함수
const syncDeskPartAnchor = deps.syncDeskPartAnchor;
const toast = deps.toast;
const setCDeskLenX = deps.setCDeskLenX;   // 쓰는 함수
const setCDeskPos = deps.setCDeskPos;   // 쓰는 함수
const setCDeskScale = deps.setCDeskScale;   // 쓰는 함수
/* 생성기 변형의 박힌 값 — 여기만 고친다 */
const ITEM_GIZMO_SIZE = 2.1;      // 기즈모 크기(기본 0.7 의 3배 — 잘 안 보여서 키움)
const ITEM_SCALE_STEP = 0.05;     // 아이템 크기 ＋/－ 한 칸
const ITEM_SCALE_MAX = 2.5;       // 아이템 크기 상한
const ITEM_SCALE_MIN = 0.05;      // 아이템 크기 하한
const CHAR_SCALE_DEFAULT = 0.7;   // 캐릭터 크기 되돌리기 값
/* ==== 아이템 3D 기즈모 (어플 3) ====
   TransformControls를 생성기 미리보기 씬에 하나만 만들어놓고, 선택된 아이템 pivot에 attach.
   드래그 종료 시 pivot의 실제 position/rotation/scale을 userData.adj에 다시 기록해서
   기존 저장 파이프라인(applyDeskAdj / persistDeskItems)을 그대로 재사용. */
let itemGizmo=null;
let itemGizmoMode='translate';
/* 🔄 회전은 저장 모델(`adj.rot` — Y 축 하나)에 맞춘다: 회전 모드에선 Y 고리만 보이고(_applyItemGizmoMode),
   저장은 rotation.y 가 아니라 쿼터니언을 YXZ 로 풀어 y 를 읽는다(_itemYaw) — 90° 넘게 돌리면 rotation.y 가 거울상 각도를 준다. */
function _itemYaw(p){
  try{ return new THREE.Euler().setFromQuaternion(p.quaternion, 'YXZ').y; }catch(_){ return p.rotation.y; }
}
function _applyItemGizmoMode(g, mode){
  g.setMode(mode);
  const rot = (mode === 'rotate');
  g.showX = !rot; g.showZ = !rot; g.showY = true;
}
function ensureItemGizmo(){
  if(itemGizmo) return itemGizmo;
  if(!cScene() || !cCam() || !cRenderer()) return null;
  if(typeof THREE.TransformControls !== 'function'){
    console.warn('TransformControls가 로드되지 않았어요 — vendor/three/TransformControls.js 파일이 필요합니다.');
    return null;
  }
  itemGizmo = new THREE.TransformControls(cCam(), cRenderer().domElement);
  itemGizmo.setSize(ITEM_GIZMO_SIZE);
  itemGizmo.setSpace('local');   // 회전 시 아이템 자신의 축(=책상 좌표계)을 따르게
  /* 🦶 생성기에서도 책상 · 책상 위 아이템은 바닥(y=0) 아래로 못 간다 — 매 이동(objectChange)마다 걸어 저장 전에 클램프된 값이 되게.
     ⚠️ hard=true(끌고 있는 중 — 상한 없음). 캐릭터는 대상이 아니다(fitCreator 가 발바닥으로 고정). */
  const _crFloorClamp = ()=>{
    try{
      if(deskPosGizOn && cDesk()){
        /* 🔴 측정에서 파츠 핀(__deskPartAnchor)을 뺀다 — 핀은 책상 오프셋을 상쇄해 제자리에 남으므로, 같이 재면
           매 objectChange 마다 같은 깊이가 잡혀 책상이 계속 솟는다. 책상과 함께 움직이는 아이템은 같이 잰다. */
        floorClampWrapper(cDesk(), '책상', true, o => o.name === DESK_PART_ANCHOR_NAME());
        /* 📌 드래그 중엔 기즈모가 cDesk.position 을 직접 움직이므로 상쇄 몫(deskPosBase)을 여기서 갱신한다.
           ⚠️ 생성기 책상은 배율이 1 이라 position 이 곧 deskPos(100% 원본)다 — 생성기에 animCorr 을 심으면 이 전제가 깨진다. */
        cDesk().userData.deskPosBase = { x:cDesk().position.x, y:cDesk().position.y, z:cDesk().position.z };
        syncDeskPartAnchor(cDesk());
        return;
      }
      const p = cBase() && cBase().activeDeskItem;
      if(p) floorClampWrapper(p, '책상 위 아이템', true);
    }catch(_){}
  };
  itemGizmo.addEventListener('objectChange', _crFloorClamp);
  // 드래그 중에는 다른 씬 상호작용(우클릭 히트 등)을 잠시 막고, 드래그 끝나면 저장까지 반영.
  itemGizmo.addEventListener('dragging-changed', e=>{
    if(!e.value){   // 드래그 종료
      /* ⚠️ 저장 직전에 한 번 더 — objectChange 는 렌더 프레임과 어긋나서 마지막 몇 픽셀의 이동이
         클램프를 안 거친 채로 남을 수 있다. 이미 맞은 상태면 무동작(멱등)이라 부담이 없다. */
      _crFloorClamp();
      /* 🪑 책상을 잡고 있었으면 아이템이 아니라 cDeskPos 로 되짚는다.
         ⚠️ 아래 아이템 경로보다 **먼저** 보고 빠져나가야 한다 — 안 그러면 activeDeskItem 이
            남아 있던 경우에 책상을 옮긴 값이 엉뚱한 아이템의 adj 로 들어간다. */
      if(deskPosGizOn && cDesk()){
        setCDeskPos({x:cDesk().position.x, y:cDesk().position.y, z:cDesk().position.z});
        updateDeskPosNum();
        layoutSeats();   // 좌우로 밀었으면 좌석 간격을 다시 잡는다
        return;
      }
      const p = cBase() && cBase().activeDeskItem;
      if(p){
        // pivot의 실제 transform → adj로 되짚기 (기존 코드가 참조하는 유일한 상태)
        p.userData.adj = p.userData.adj || {};
        p.userData.adj.x = p.position.x;
        p.userData.adj.y = p.position.y;   // ★ y도 저장 — 책상 위 잠금 없이 자유롭게 위/아래 이동 가능(요청사항)
        p.userData.adj.z = p.position.z;
        p.userData.adj.rot = _itemYaw(p);   // 🔄 rotation.y 가 아니다 — 위 [2026-09-15 제보 4]
        p.userData.adj.scale = p.scale.x || 1;
        autoSaveDeskItemsNow();
      }
    }
  });
  cScene().add(itemGizmo);
  return itemGizmo;
}
function detachItemGizmo(){
  if(itemGizmo){ try{ itemGizmo.detach(); }catch(_){} }
}
function attachItemGizmoToActive(){
  const p = cBase() && cBase().activeDeskItem;
  const g = ensureItemGizmo();
  if(!g) return;
  // 🪑 아이템을 고르면 책상 위치 모드는 자동으로 꺼진다 — 기즈모가 하나뿐이라 둘 다 켜질 수 없다.
  if(p && deskPosGizOn){ deskPosGizOn = false;
    const b=document.getElementById('deskPosGz'); if(b) b.classList.remove('on'); }
  if(p){ g.attach(p); _applyItemGizmoMode(g, itemGizmoMode); g.visible=true; }
  else { g.detach(); g.visible=false; }
  renderItemColorPanel();   // 런처3-1: 활성 아이템 바뀌면 색상 UI도 갱신
}
// ★ 런처3-1: 활성 아이템의 _col 그룹을 상세조정 패널에 색상 스와치로 표시.
//   커스텀 컬러 팝업(openCharColorPicker) 재사용 — 최근 5색도 생성기/꾸미기와 공유.
function renderItemColorPanel(){
  const box=document.getElementById('crItemColors'); if(!box) return;
  const p = cBase() && cBase().activeDeskItem;
  const groups = p && p.userData && p.userData.colorGroups;
  if(!p || !groups || !Object.keys(groups).length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='block';
  box.innerHTML = '<div style="margin-bottom:4px;font-weight:bold;color:#555;">아이템 색상</div>';
  p.userData.colors = p.userData.colors || {};
  const keys = Object.keys(groups).sort((a,b)=> (parseInt(a.replace('col',''))||1) - (parseInt(b.replace('col',''))||1));
  keys.forEach((key,idx)=>{
    const meshes = groups[key];
    const orig = (meshes[0].userData && meshes[0].userData.origColor) || 'ffffff';
    const cur = p.userData.colors[key] || ('#'+orig);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:6px;margin:3px 0;';
    row.innerHTML =
      '<span style="min-width:44px;color:#666;">색상'+(keys.length>1?(idx+1):'')+'</span>'
      +'<button type="button" class="cr-item-sw" style="width:34px;height:22px;padding:0;cursor:pointer;'
      +' border:1px solid rgba(0,0,0,.15);background:'+cur+';border-radius:4px;"></button>'
      +'<button type="button" class="cr-item-rst ghost" title="원본 색으로">↺</button>';
    const sw=row.querySelector('.cr-item-sw');
    sw.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(typeof window.openCharColorPicker!=='function') return;
      window.openCharColorPicker(sw, cur, (c)=>{
        p.userData.colors[key] = c;
        sw.style.background = c;
        _applyItemColor(p);
        autoSaveDeskItemsNow();
      });
    });
    row.querySelector('.cr-item-rst').addEventListener('click', ()=>{
      delete p.userData.colors[key];
      // 원본으로 복원 (material.color/emissive)
      meshes.forEach(m=>{
        if(!m.material || !m.userData.origColor) return;
        const hex='#'+m.userData.origColor;
        if(m.material.color) m.material.color.set(hex);
        if(m.material.emissive){
          const flat = baseFlatOf(m.material, 0.4);
          m.material.emissive.copy(m.material.color).multiplyScalar(flat);
          m.material.needsUpdate=true;
        }
      });
      sw.style.background='#'+orig;
      autoSaveDeskItemsNow();
    });
    box.appendChild(row);
  });
}
// 모드 버튼 바인딩
document.querySelectorAll('#crItemPos .cr-gz-mode').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#crItemPos .cr-gz-mode').forEach(b=>b.classList.toggle('on', b===btn));
    itemGizmoMode = btn.dataset.mode;
    if(itemGizmo && cBase() && cBase().activeDeskItem) _applyItemGizmoMode(itemGizmo, itemGizmoMode);
  });
});
/* 🦶 크기 ＋/－ 로 키워서 바닥을 뚫는 경우도 막는다 — 기즈모 드래그와 같은 함수를 쓴다.
   ★ 올린 만큼을 adj.y 에 되짚어야 한다. 안 하면 화면만 올라가고 저장값은 옛 y 그대로라,
     다시 열 때 그 값이 되살아나 아이템이 바닥으로 가라앉는다(꾸미기 쪽과 같은 함정). */
function _crClampActiveItemToFloor(){
  const p = cBase() && cBase().activeDeskItem; if(!p) return;
  const dy = floorClampWrapper(p, '책상 위 아이템', true);
  if(dy){ p.userData.adj = p.userData.adj || {}; p.userData.adj.y = p.position.y; }
}
// 크기는 기즈모 대신 ＋/－ 버튼(꾹 누르면 연속 조정)
bindHold(document.getElementById('crItemBigger'), ()=>{
  const p=cBase()&&cBase().activeDeskItem; if(!p){ toast('먼저 크기를 조정할 아이템을 우클릭해서 선택해 주세요'); return; }
  p.userData.adj.scale=Math.min(ITEM_SCALE_MAX,(p.userData.adj.scale||1)+ITEM_SCALE_STEP);
  applyDeskAdj(p);
  _crClampActiveItemToFloor();
  autoSaveDeskItemsNow();
});
bindHold(document.getElementById('crItemSmaller'), ()=>{
  const p=cBase()&&cBase().activeDeskItem; if(!p){ toast('먼저 크기를 조정할 아이템을 우클릭해서 선택해 주세요'); return; }
  p.userData.adj.scale=Math.max(ITEM_SCALE_MIN,(p.userData.adj.scale||1)-ITEM_SCALE_STEP);
  applyDeskAdj(p);
  _crClampActiveItemToFloor();
  autoSaveDeskItemsNow();
});
document.getElementById('crItemRemove').onclick=()=>{
  const p=cBase()&&cBase().activeDeskItem; if(!p)return;
  // ★ 요청사항: 이 초기화는 크기만 원래대로 되돌림 — 위치/회전(기즈모로 잡아둔 값)은 그대로 유지.
  p.userData.adj.scale = (p.userData.autoScale!=null) ? p.userData.autoScale : 1;
  applyDeskAdj(p);
  autoSaveDeskItemsNow();
  if(itemGizmo) itemGizmo.update?.();
};
// ⟲ 이동·회전만 초기화 — 크기는 유지 (크기 초기화 버튼과 짝을 이룸)
//   0 이 아니라 이번 편집에서 처음 나타난 자리로 — 0 은 커스텀 아이템을 책상 속에 묻는다(desk-item-origin.js)
document.getElementById('crItemXfReset').onclick=()=>{
  const p=cBase()&&cBase().activeDeskItem; if(!p){ toast('먼저 초기화할 아이템을 우클릭해서 선택해 주세요'); return; }
  const back = deskItemOrigin ? deskItemOrigin.resetXf(p, p.userData.adj) : false;
  if(!deskItemOrigin){ p.userData.adj.x=0; p.userData.adj.y=0; p.userData.adj.z=0; p.userData.adj.rot=0; }
  applyDeskAdj(p);
  autoSaveDeskItemsNow();
  if(itemGizmo) itemGizmo.update?.();
  toast(back ? '처음 자리로 되돌렸어요' : '위치·회전을 원래대로 되돌렸어요');
};
document.getElementById('deskAddCode').onclick=()=>openAssetImport('desk');
document.getElementById('itemAddCode').onclick=()=>openAssetImport('item');
/* === 좌석 세팅(6단계): 변형 슬라이더 ===
   ⚠️ 이름은 '좌석 세팅' 이지만 여기서 조절하는 것은 **캐릭터 크기 · 캐릭터 높이 · 방향**이다.
      HTML 의 라벨(예전: 좌석 크기 / 좌석 앞뒤)도 캐릭터 크기 / 캐릭터 높이로 고쳐야 한다. */
function bindCrXform(id,key){ document.getElementById(id).addEventListener('input',e=>{
  const v=+e.target.value;
  cXform()[key] = (key==='y') ? clampCharY(v) : v;   // 🧍 높이는 0 하한·CHAR_Y_MAX 상한
  applyCreatorXform(); }); }   // 카메라는 고정 — 크기 가늠 쉽게
/* 🧍 '앞뒤' 슬라이더(#crZ)를 '높이' 슬라이더로 전용한다 — 범위를 여기서 심어서 HTML 을 안 고쳐도
   곧바로 올바르게 동작하게 한다(HTML 의 min 이 음수로 남아 있으면 왼쪽 절반이 죽은 구간이 된다).
   ⚠️ 라벨 문구는 여기서 못 바꾼다 — HTML 쪽도 '캐릭터 높이' 로 고칠 것. */
(function _crZSliderBecomesHeight(){
  const el = document.getElementById('crZ'); if(!el) return;
  el.min = 0; el.max = CHAR_Y_MAX; el.step = 0.01; el.value = 0;
  el.title = '캐릭터 높이';
})();
bindCrXform('crScale','s'); bindCrXform('crZ','y'); bindCrXform('crRot','rot');
document.querySelectorAll('#seatStage .mini-reset[data-rs]').forEach(btn=>{ btn.addEventListener('click',()=>{
  /* 🧍 data-rs="z" 는 HTML 그대로 두고 여기서 높이(y)로 읽는다 — 그 슬라이더가 이제 높이다. */
  const raw=btn.dataset.rs, k=(raw==='z'||raw==='y')?'y':raw, dv=(k==='s')?CHAR_SCALE_DEFAULT:0; cXform()[k]=dv;
  const id=(k==='s')?'crScale':(k==='y'?'crZ':'crRot'); document.getElementById(id).value=dv;
  applyCreatorXform(); }); });
/* 🪑 책상 위치 기즈모 ─────────────────────────────────────────────────
   아이템 기즈모(itemGizmo)를 그대로 빌려 쓴다 — 생성기 씬에 TransformControls 를 둘 만들면
   둘이 동시에 뜨고 드래그가 서로를 가로챈다. 대신 '지금 무엇에 붙어 있는가'를 여기서 관리한다.
   ⚠️ 아이템을 선택하면 그쪽이 기즈모를 가져간다(attachItemGizmoToActive). 그때 이 모드는 꺼진다. */
let deskPosGizOn = false;
function updateDeskPosNum(){
  const el = document.getElementById('deskPosNum'); if(!el) return;
  const z = !cDeskPos().x && !cDeskPos().y && !cDeskPos().z;
  el.textContent = z ? '기본 위치' : ('x ' + cDeskPos().x.toFixed(2) + ' · y ' + cDeskPos().y.toFixed(2) + ' · z ' + cDeskPos().z.toFixed(2));
}
function setDeskPosGizmo(on){
  const btn = document.getElementById('deskPosGz');
  const g = ensureItemGizmo();
  if(on && (!g || !cDesk())){ toast('책상을 아직 불러오는 중이에요'); return; }
  deskPosGizOn = !!on;
  if(btn) btn.classList.toggle('on', deskPosGizOn);
  if(!g) return;
  if(deskPosGizOn){
    // 책상을 잡는 동안에는 아이템 선택을 풀어 둔다 — 안 그러면 어느 쪽이 잡힌 건지 화면으로 알 수 없다.
    if(cBase()) cBase().activeDeskItem = null;
    g.attach(cDesk()); _applyItemGizmoMode(g, 'translate'); g.visible = true;   // 책상은 이동만 — 세 축 다 보인다
  } else {
    try{ g.detach(); }catch(_){}
    g.visible = false;
  }
}
(function bindDeskPos(){
  const gz = document.getElementById('deskPosGz');
  if(gz) gz.addEventListener('click', ()=>setDeskPosGizmo(!deskPosGizOn));
  const rs = document.getElementById('deskPosReset');
  if(rs) rs.addEventListener('click', ()=>{
    setCDeskPos({x:0, y:0, z:0});
    setDeskPos(cDesk(), cDeskPos());
    updateDeskPosNum();
    if(deskPosGizOn && itemGizmo) itemGizmo.attach(cDesk());   // 기즈모 위치도 따라오게
  });
})();
document.getElementById('deskScaleReset').addEventListener('click',()=>{ setCDeskScale(DESK_SCALE_DEFAULT); document.getElementById('deskScale').value=DESK_SCALE_DEFAULT; setCreatorDeskScale(DESK_SCALE_DEFAULT); });
// 어플 3-1: 책상 길이 슬라이더
document.getElementById('deskLenX')?.addEventListener('input', e=>{
  setCDeskLenX(+e.target.value || 1);
  setCreatorDeskScale(cDeskScale());
  if(cBase() && cBase().charDef){ cBase().charDef.deskLenX = cDeskLenX()!==1 ? cDeskLenX() : null; slotSaveMod().saveSlots(); }
});
document.getElementById('deskLenXReset')?.addEventListener('click', ()=>{
  setCDeskLenX(1); const el=document.getElementById('deskLenX'); if(el) el.value=1;
  setCreatorDeskScale(cDeskScale());
  if(cBase() && cBase().charDef){ cBase().charDef.deskLenX = null; slotSaveMod().saveSlots(); }
});

return {
  attachItemGizmoToActive,
  detachItemGizmo,
  updateDeskPosNum,
};
}

const api = { createCreatorXform };
if(typeof window !== 'undefined') window.TwCreatorXform = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
