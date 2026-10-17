/* desk-preset.js — 🗂 책상 · 좌석 세팅 프리셋: 지금 생성기의 책상 · 좌석 세팅을 5칸에 담고, 고른 칸을 지금 캐릭터에 한 번에 적용한다
   app.js «런처3-2 프리셋» 조각(저장 빼고)을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄은 읽는 함수 자리 11줄 · 옛 이야기형 주석 줄이기).
   ・책임: 담기(captureDeskPreset — 책상 색 · 크기 · 길이 · 위치 · 모델 · 아이템 · 로컬 아이템 · 좌석) · 적용(applyDeskPreset — 좌석 → 아이템 목록 → 책상 → 모델 →
     아이템 다시 놓기 → 카메라 다시 맞추기) · 칸 화면(renderDeskPresetSlots — 클릭 불러오기 · 우클릭 저장/비우기 · 팝업 버튼).
   ・받는 deps 28 — notifyError — 번호 실패 알림(shared/error-codes.js) · 값 crState · deskPresetStoreMod(5칸 읽기 · 쓰기) · premiumMod · DEFAULT_DESK_OVERRIDE_ID · 함수 15 · 읽는 함수 8(뒤에서 만들어지는 모듈 · isAdmin · isPremium).
   ・내놓는 것: 없음 — 만들 때 팝업 버튼을 건다(DOM 이 준비 전이면 DOMContentLoaded 에).
   ・입구 전제: 적용 · 저장은 캐릭터(crState.cBase)가 있어야 한다(없으면 «먼저 캐릭터를 선택해 주세요») · 칸 상자(#crPresetSlots) · 버튼이 없으면 그리지 · 걸지 않는다.
   ⚠️ document · localStorage · setTimeout 은 전역 이름 그대로. 전역 이름은 TwDeskPreset(Tw 접두사 #103).
   검사: checks/sim-desk-preset.js */
(function(){

function createDeskPreset(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const applyCreatorXform = deps.applyCreatorXform;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const autoSaveDeskItemsNow = deps.autoSaveDeskItemsNow;
const b64ToBuf = deps.b64ToBuf;
const catalogGlbMod = deps.catalogGlbMod;   // 읽는 함수
const clampCharY = deps.clampCharY;
const clampDeskScale = deps.clampDeskScale;
const collectDeskItems = deps.collectDeskItems;
const commissionMod = deps.commissionMod;   // 읽는 함수
const crState = deps.crState;
const crXformMod = deps.crXformMod;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const deskItemsMod = deps.deskItemsMod;   // 읽는 함수
const deskPresetStoreMod = deps.deskPresetStoreMod;
const equipDeskItem = deps.equipDeskItem;
const fitCreator = deps.fitCreator;
const frameDeskCam = deps.frameDeskCam;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const premiumMod = deps.premiumMod;
const setCreatorDeskScale = deps.setCreatorDeskScale;
const setDeskPos = deps.setDeskPos;
const swapDeskVisual = deps.swapDeskVisual;
const toast = deps.toast;
const notifyError = deps.notifyError;
function captureDeskPreset(){
  // 지금 생성기의 실제 상태로부터 프리셋 페이로드 생성
  const p = {
    // 책상
    deskColor: crState.cDeskColor,
    deskScale: crState.cDeskScale,
    deskLenX: crState.cDeskLenX,
    deskPos: {x:crState.cDeskPos.x, y:crState.cDeskPos.y, z:crState.cDeskPos.z},
    deskCatalogId: crState.activeCustomDeskId || null,
    deskGlb: (crState.activeCustomDeskId && crState.cDeskGlbB64) ? crState.cDeskGlbB64 : null,
    deskItems: crState.cBase ? collectDeskItems(crState.cBase) : null,
    // 커스텀 아이템(카탈로그에 없는 로컬 등록분)도 함께 — 다른 슬롯에서 불러올 때 참조가 살아있게
    customItems: (function(){ const ci={}; Object.keys(customItems()).forEach(id=>{ const c=customItems()[id]; ci[id]={name:c.name, glb:c.glb}; }); return Object.keys(ci).length?ci:null; })(),
    // 좌석 (편집 도중이라 cXform 참조 — 슬라이더/스와치와 동일한 값)
    // 🧍 z(앞뒤) → y(높이). 옛 프리셋의 z 는 로드 쪽에서 무시한다.
    seat: { s:crState.cXform.s, y:clampCharY(crState.cXform.y), rot:crState.cXform.rot },
    ts: Date.now(),
  };
  return p;
}
// 프리셋 적용 뒤 카메라를 다시 맞춘다 — fitCreator 는 캐릭터 기준, frameDeskCam 은 책상까지 넣어 거리를 잡는다.
function _refitPreviewAfterPreset(){
  try{
    fitCreator(crState.crStep<=4 ? 'edit' : 'app');
    if((crState.crStep===5||crState.crStep===6)) frameDeskCam(false);
  }catch(_){}
}
function applyDeskPreset(p){
  if(!p || !crState.cBase){ toast('먼저 캐릭터를 선택해 주세요'); return; }
  // 이전 카메라 상태를 지운다 — 안 그러면 5 · 6단계 재진입 때 옛 책상 기준 카메라가 돌아와 새 책상 크기와 어긋난다.
  crState.deskCamSaved = null;
  // 1) 좌석 세팅 적용 (슬라이더 값 + 즉시 반영)
  if(p.seat){
    if(typeof p.seat.s==='number')   { crState.cXform.s   = p.seat.s;   const el=document.getElementById('crScale'); if(el) el.value=p.seat.s; }
    /* 🧍 높이 — #crZ 가 이제 높이 슬라이더다. 옛 프리셋의 p.seat.z(앞뒤)는 폐기된 값이라 읽지 않는다
       (읽으면 앞뒤로 맞춰둔 옛 숫자가 그대로 '높이' 로 해석돼 캐릭터가 공중에 뜬다). */
    if(typeof p.seat.y==='number')   { crState.cXform.y   = clampCharY(p.seat.y); const el=document.getElementById('crZ'); if(el) el.value=crState.cXform.y; }
    if(typeof p.seat.rot==='number') { crState.cXform.rot = p.seat.rot; const el=document.getElementById('crRot');   if(el) el.value=p.seat.rot; }
    applyCreatorXform();
  }
  // 2) 커스텀 아이템 카탈로그(세션) 병합 — 프리셋이 참조하는 로컬 아이템이 있으면 함께 복원
  if(p.customItems) Object.keys(p.customItems).forEach(id=>{
    /* licenseOnly 는 프리셋({name, glb})이 아니라 원본 카탈로그 레코드(savedItems)에서 — false 로 박으면 장착의 라이선스 게이트가 안 걸린다. */
    if(!customItems()[id]){
      let _si=null; try{ _si=commissionMod().savedItems(); }catch(_){}
      const _rec = (_si && _si.find) ? _si.find(s=>s.id===id) : null;
      customItems()[id] = Object.assign({id, cat:'item', deskItem:true, licenseOnly:!!(_rec && _rec.licenseOnly)}, p.customItems[id]);
    }
  });
  // 3) 책상 색/크기/길이 (슬라이더/스와치도 갱신)
  if(typeof p.deskColor==='string'){
    crState.cDeskColor = p.deskColor;
    const el=document.getElementById('deskColor'); if(el){ el.value=crState.cDeskColor; el.dispatchEvent(new Event('input',{bubbles:true})); }
    if(crState.cDeskMat) crState.cDeskMat.color.set(crState.cDeskColor);
    applyDeskColorToCustom(crState.cDesk, crState.cDeskColor);
  }
  if(typeof p.deskScale==='number'){ crState.cDeskScale=clampDeskScale(p.deskScale); const el=document.getElementById('deskScale'); if(el) el.value=crState.cDeskScale; setCreatorDeskScale(crState.cDeskScale); }
  if(typeof p.deskLenX==='number'){  crState.cDeskLenX=p.deskLenX;  const el=document.getElementById('deskLenX');  if(el) el.value=crState.cDeskLenX;  setCreatorDeskScale(crState.cDeskScale); }
  if(p.deskPos && typeof p.deskPos==='object'){ crState.cDeskPos={x:+p.deskPos.x||0, y:+p.deskPos.y||0, z:+p.deskPos.z||0}; setDeskPos(crState.cDesk, crState.cDeskPos); crXformMod().updateDeskPosNum(); }
  // 4) 책상 모델(카탈로그 id or GLB)
  const applyDeskModel = ()=>{
    // 현재 아이템 전부 제거 (프리셋의 아이템으로 교체)
    if(crState.cBase){ deskItemsMod().allDeskItems().forEach(def=>{ if(crState.cBase.deskItems && crState.cBase.deskItems[def.id]) equipDeskItem(crState.cBase,def,false); }); }
    // 프리셋에 아이템 복원
    if(p.deskItems && crState.cBase) applyDeskItemsTo(crState.cBase, p.deskItems);
    autoSaveDeskItemsNow();
  };
  /* 프리셋에 남은 라이선스 전용 책상은 라이선스가 없으면 쓰지 않는다(쓰면 완료 때 def 에 굳는다) — 기본 책상으로 열고 프리셋은 그대로 둔다. */
  const _presetDeskLocked = (!isPremium() && !isAdmin()) && premiumMod._licenseLockedDeskId(p.deskCatalogId);
  if(p.deskCatalogId && p.deskGlb && !_presetDeskLocked){
    assetCodeMod().parseGlbBytes(b64ToBuf(p.deskGlb)).then(sc=>{
      crState.cDeskTemplate=sc; crState.cDeskGlbB64=p.deskGlb; crState.activeCustomDeskId=p.deskCatalogId;
      const isDefaultOverride = (p.deskCatalogId === DEFAULT_DESK_OVERRIDE_ID);
      if(crState.cDesk){ swapDeskVisual(crState.cDesk, sc, isDefaultOverride); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale); }
      applyDeskModel();
      _refitPreviewAfterPreset();
    }).catch((err)=>{ notifyError('E-CHAR-03', err); applyDeskModel(); _refitPreviewAfterPreset(); });
  } else {
    crState.cDeskTemplate=null; crState.cDeskGlbB64=null; crState.activeCustomDeskId=null;
    // «기본 책상» 프리셋 — 관리자가 등록한 기본 책상(DEFAULT_DESK_OVERRIDE_ID)이 있으면 그것을(생성기 재진입 · 실행 화면과 같은 모델 · 내장 책상과 폭이 다르다).
    const ov = commissionMod().savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
    if(ov){
      (async ()=>{
        if(!ov.glb && ov.glbUrl){
          try{ await catalogGlbMod().resolveCatalogGlb(ov); }catch(_){}
        }
        try{
          const sc = await assetCodeMod().parseGlbBytes(b64ToBuf(ov.glb));
          if(crState.cDesk){ swapDeskVisual(crState.cDesk, sc, true); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale); }
        }catch(_){
          if(crState.cDesk){ swapDeskVisual(crState.cDesk, null); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale); }
        }
        applyDeskModel();
        _refitPreviewAfterPreset();
      })();
    } else {
      if(crState.cDesk){ swapDeskVisual(crState.cDesk, null); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale); }
      applyDeskModel();
      _refitPreviewAfterPreset();
    }
  }
  renderDeskPresetSlots();   // 저장 시각/썸네일 갱신
  toast('프리셋을 불러왔어요');
}
/* 저장 성공 안내는 실제로 써진 뒤에만 — 실패면 이유 · 번호를 띄워 사용자가 불러 줄 수 있게. */
function _saveNotice(res, slot, okMsg){
  if(res.ok){ toast(okMsg); return; }
  if(res.blocked){ notifyError('E-CHAR-06', res.err); return; }   // 망가진 저장분 위에는 쓰지 않았다 — 나머지 칸을 지키려고
  console.warn(deskPresetStoreMod.diagSave(res, slot));
  notifyError('E-CHAR-01', res.err, deskPresetStoreMod.saveFailText(res.err));
}
function renderDeskPresetSlots(){
  const box=document.getElementById('crPresetSlots'); if(!box) return;
  const arr=deskPresetStoreMod.loadDeskPresets();
  box.innerHTML='';
  for(let i=0;i<deskPresetStoreMod.PRESET_SLOTS;i++){
    const p=arr[i]||null;
    const btn=document.createElement('button');
    btn.type='button';
    btn.style.cssText='flex:1;padding:8px 6px;font-size:12px;cursor:pointer;'
      + 'background:'+(p?'#fff':'#eee')+';border:1px solid;border-color:#888 #ddd #ddd #888;'
      + 'color:'+(p?'#333':'#888')+';';
    btn.textContent = (i+1) + (p?' ✓':'');
    btn.title = p ? ('클릭 = 불러오기 / 우클릭 = 덮어쓰기·삭제  (저장 시각: '+new Date(p.ts).toLocaleString()+')')
                  : ('빈 슬롯 — 우클릭해서 지금 세팅을 여기 저장');
    btn.onclick = ()=>{
      if(!p) return toast('빈 슬롯이에요 — 우클릭해서 지금 세팅을 저장할 수 있어요');
      applyDeskPreset(p);
    };
    btn.oncontextmenu = ev=>{
      ev.preventDefault();
      const menu=document.createElement('div');
      menu.className='cr-preset-ctx';   // 팝업 outside-close에서 예외 처리하려고
      const rect=btn.getBoundingClientRect();
      menu.style.cssText='position:fixed;z-index:9999;background:var(--win-face);'
        +'border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
        +'box-shadow:2px 2px 4px rgba(0,0,0,.3);padding:4px 0;font-size:11px;min-width:130px;'
        +'left:'+ev.clientX+'px;top:'+ev.clientY+'px;';
      const mk=(label, fn)=>{ const it=document.createElement('div'); it.textContent=label;
        it.style.cssText='padding:5px 10px;cursor:pointer;color:var(--ink);';
        it.onmouseenter=()=>it.style.background='var(--win-select)'; it.onmouseleave=()=>it.style.background='';
        it.onclick=()=>{ fn(); menu.remove(); document.removeEventListener('mousedown', closer, true); };
        menu.appendChild(it); };
      mk(p?'💾 이 슬롯에 덮어쓰기':'💾 지금 세팅을 여기 저장', ()=>{
        if(!crState.cBase){ toast('먼저 캐릭터를 선택해 주세요'); return; }
        const cur=deskPresetStoreMod.loadDeskPresets(); cur[i]=captureDeskPreset(); const res=deskPresetStoreMod.saveDeskPresets(cur);
        renderDeskPresetSlots(); _saveNotice(res, i+1, '프리셋 '+(i+1)+'번에 저장했어요');
      });
      if(p) mk('🗑 이 슬롯 비우기', ()=>{
        const cur=deskPresetStoreMod.loadDeskPresets(); cur[i]=null; const res=deskPresetStoreMod.saveDeskPresets(cur);
        renderDeskPresetSlots(); _saveNotice(res, i+1, '프리셋 '+(i+1)+'번을 비웠어요');
      });
      document.body.appendChild(menu);
      const closer=(e)=>{ if(!menu.contains(e.target)){ menu.remove(); document.removeEventListener('mousedown', closer, true); } };
      setTimeout(()=>document.addEventListener('mousedown', closer, true), 0);
    };
    box.appendChild(btn);
  }
}
// 생성기 진입 시 UI 그림
(function _initDeskPresetBar(){
  function bind(){
    renderDeskPresetSlots();
    const btn=document.getElementById('crPresetBtn'), pop=document.getElementById('crPresetPopup');
    if(!btn || !pop || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const open = pop.style.display !== 'none';
      pop.style.display = open ? 'none' : 'block';
      if(!open) renderDeskPresetSlots();   // 열 때마다 최신 상태로
    });
    document.addEventListener('mousedown', e=>{
      if(pop.style.display==='none') return;
      if(pop.contains(e.target) || e.target===btn) return;
      // 우클릭 메뉴(뜬 상태에서 슬롯 우클릭 → contextmenu에서 열림)는 유지 — 그 안 클릭 시 자동 닫힘 신경 X
      if(e.target.closest && e.target.closest('.cr-preset-ctx')) return;
      pop.style.display='none';
    }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();

return {

};
}

const api = { createDeskPreset };
if(typeof window !== 'undefined') window.TwDeskPreset = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
