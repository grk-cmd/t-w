/* desk-setup.js — 🪑 생성기 책상 세팅(5단계): 책상 카드 · 아이템 카드(쪽 넘김)를 그리고, 고르기 · 지우기(회수) · 순서 바꾸기 · 색 · 아이템 고르기를 잇는다
   app.js «책상 세팅(5단계)» 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다
   (바뀐 줄은 읽는 함수 자리 · 갈고리 둘(setHooks) · firebaseAPI 를 데이터 provider(catalogNet)로 · 입구 가드 · 옛 이야기형 주석 줄이기).
   ・책임: renderCrItems(기본 · 저장 책상 카드 — 라이선스 잠금 🔒 · 관리자 ✎ · ☰ / 기본 · 커스텀 아이템 카드 5개씩 쪽 넘김 · 개수 한도 표시) ·
     reorderSavedItem · reorderSavedDesk(관리자 순서 바꾸기 → 카탈로그 순서 저장) · selectDeskItemForAdjust(놓인 아이템 고르기) · 미리보기 우클릭으로 아이템 고르기 · 책상 색 칸.
   ・받는 deps 29 — 값 crState · assetCardsMod(카드 · 도트 썸네일 · ☰ 손잡이) · premiumMod · DESK_ITEMS · DESK_SCALE_DEFAULT · DEFAULT_DESK_OVERRIDE_ID · ndc · ray ·
     함수 10 · 읽는 함수 11(뒤에서 만들어지는 모듈 · isAdmin · isPremium · catalogNet — 데이터 provider, 지금은 app.js 가 window.firebaseAPI 를 넘긴다).
   ・내놓는 것: renderCrItems · selectDeskItemForAdjust · setHooks({ openDeskRegister, attachItemGizmo }) — app.js 가 crXformMod 를 만든 뒤 잇는다.
   ・입구 전제: 카드 줄(#crDeskRow · #crItemRow) · 색 칸(#deskColor) · 미리보기(#creatorPreview)가 없으면 그리지 · 걸지 않는다 · 아이템 고르기는 캐릭터(crState.cBase)가 있어야.
   ⚠️ document · confirm 은 전역 이름 그대로. firebaseAPI 는 catalogNet() 으로만. 전역 이름은 TwDeskSetup(Tw 접두사 #103).
   검사: checks/sim-desk-setup.js */
(function(){

function createDeskSetup(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const DEF_SIZE_TOAST_MS = deps.DEF_SIZE_TOAST_MS;   // 읽는 함수
const DESK_ITEMS = deps.DESK_ITEMS;
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;
const _creatorSizeGrow = deps._creatorSizeGrow;
const _syncCrColorSwatches = deps._syncCrColorSwatches;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const assetCardsMod = deps.assetCardsMod;
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const autoSaveDeskItemsNow = deps.autoSaveDeskItemsNow;
const b64ToBuf = deps.b64ToBuf;
const catalogGlbMod = deps.catalogGlbMod;   // 읽는 함수
const clampDeskScale = deps.clampDeskScale;
const commissionMod = deps.commissionMod;   // 읽는 함수
const crState = deps.crState;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const deskItemsMod = deps.deskItemsMod;   // 읽는 함수
const equipDeskItem = deps.equipDeskItem;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const lightToneMod = deps.lightToneMod;   // 읽는 함수
const ndc = deps.ndc;
const premiumMod = deps.premiumMod;
const ray = deps.ray;
const setCreatorDeskScale = deps.setCreatorDeskScale;
const swapDeskVisual = deps.swapDeskVisual;
const toast = deps.toast;
const catalogNet = deps.catalogNet;   // 읽는 함수 — 데이터 provider(카탈로그 회수 · 순서 저장), 준비 전이면 없음
/* 관리자 등록 창 열기 · 아이템 기즈모 붙이기 — 그 두 모듈(admin-part-register · creator-xform)은 책상 카드를 다시 그리려고 이 모듈을 부른다.
   여기서 그 둘을 deps 로 받으면 서로를 부르게 되어(sim-dep-cycles) app.js 가 crXformMod 를 만든 뒤 setHooks 로 잇는다. */
const _hooks = { openDeskRegister: null, attachItemGizmo: null };
function setHooks(h){ Object.assign(_hooks, h || {}); }
const DESK_ICON={plant:'🪴',cup:'☕',books:'📚'};
function renderCrItems(){
  /* 입구 전제 — 카드 줄 · 색 칸이 있어야 그린다. 예전엔 생성기 화면이 말없이 보장했다(없으면 던졌다). */
  if(!document.getElementById('crDeskRow') || !document.getElementById('crItemRow') || !document.getElementById('deskColor')) return;
  const dr=document.getElementById('crDeskRow'); dr.innerHTML='';
  // 기본 책상 카드 (활성 책상이 커스텀이 아닐 때 on)
  const defThumb=assetCardsMod.swThumb('기본 책상', !crState.activeCustomDeskId, '🪑');
  defThumb.onclick=async()=>{
    crState.cDeskTemplate=null; crState.cDeskGlbB64=null; crState.activeCustomDeskId=null;
    if(crState.cDesk){
      const ov=commissionMod().savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);   // 관리자가 기본 책상을 교체해뒀으면 그거 표시
      if(ov){
        if(!ov.glb && ov.glbUrl){
          try{ await catalogGlbMod().resolveCatalogGlb(ov); }catch(_){}
        }
        try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(ov.glb)); swapDeskVisual(crState.cDesk,sc,true); }catch(e){ swapDeskVisual(crState.cDesk,null); }
      }
      else swapDeskVisual(crState.cDesk,null);
      applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale);
    }
    renderCrItems();
  };
  if(isAdmin()) defThumb.oncontextmenu=e=>{ e.preventDefault(); _hooks.openDeskRegister('desk', DEFAULT_DESK_OVERRIDE_ID); };
  dr.appendChild(defThumb);
  // 저장된 책상 카드들
  /* 라이선스 전용 책상은 꾸미기 › 책상 에서 고른다 — 관리자만 여기서 본다(등록 · 검수 · 순서). 아래 deskLocked 갈래는 관리자 화면과
     카탈로그가 늦게 와 licenseOnly 를 아직 모르는 순간의 안전망이라 지우지 않는다. */
  commissionMod().savedDesks().filter(rec=>rec.id!==DEFAULT_DESK_OVERRIDE_ID && (isAdmin() || !rec.licenseOnly)).forEach(rec=>{
    const on=(crState.activeCustomDeskId===rec.id);
    const deleteHandler = (rec.fromCatalog && !isAdmin()) ? null : ()=>{
      // X 삭제: localStorage에서 제거 + 현재 활성 책상이면 기본으로 복귀
      // 카탈로그에서 온 것(fromCatalog)이면 관리자 전용 "회수"로 처리 — 모두에게서 배포 취소
      if(rec.fromCatalog){
        if(!confirm('"'+(rec.name||'책상')+'"을(를) 모든 사용자에게서 회수할까요?')){ window.focus(); return; } window.focus();
        if(catalogNet() && catalogNet().unpublishDesk) catalogNet().unpublishDesk(rec.id).catch(()=>toast('회수 실패(네트워크 확인)'));
      }
      commissionMod().setSavedDesks(commissionMod().savedDesks().filter(d=>d.id!==rec.id)); commissionMod().persistSavedAssets();
      if(crState.activeCustomDeskId===rec.id){ crState.cDeskTemplate=null; crState.cDeskGlbB64=null; crState.activeCustomDeskId=null;
        if(crState.cDesk){
          const ov=commissionMod().savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);   // 관리자가 기본 책상을 교체해뒀으면 그거로 복귀(진짜 원본 아님)
          if(ov){ assetCodeMod().parseGlbBytes(b64ToBuf(ov.glb)).then(sc=>{ swapDeskVisual(crState.cDesk,sc,true); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); }).catch(()=>{ swapDeskVisual(crState.cDesk,null); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); }); }
          else { swapDeskVisual(crState.cDesk,null); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); }
        } }
      renderCrItems();
    };
    const card=assetCardsMod.swThumb(rec.name||'책상', on, rec.icon||'🪑', deleteHandler);
    card.dataset.reorderId = rec.id;   // bindReorderHandle의 elementFromPoint 탐색용
    /* 라이선스 전용 책상은 라이선스 · 관리자가 아니면 고르지 못한다(아이템 카드와 같은 모양 · 조건) — 고르면 실행 화면에서 기본 책상으로 떨어진다. */
    const deskLocked = !!(rec.licenseOnly && !isPremium() && !isAdmin());
    if(deskLocked){
      const lock=document.createElement('div'); lock.textContent='🔒'; lock.title='라이선스 보유자 전용';
      lock.style.cssText='position:absolute;bottom:-4px;right:-4px;font-size:13px;filter:drop-shadow(0 1px 1px #fff);z-index:2;';
      card.firstChild.appendChild(lock);
      card.style.opacity='.55';
    }
    if(isAdmin() && rec.fromCatalog){
      const edit=document.createElement('div'); edit.textContent='✎';
      edit.style.cssText='position:absolute;top:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#7ba05b;color:#fff;font-size:11px;line-height:18px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
      edit.onclick=e=>{ e.stopPropagation(); _hooks.openDeskRegister('desk', rec.id); };
      card.firstChild.appendChild(edit);   // box(첫 자식)에 붙임 — swThumb 구조상 첫 자식이 아이콘 박스
      card.oncontextmenu=e=>{ e.preventDefault(); _hooks.openDeskRegister('desk', rec.id); };
      // ☰ 드래그 핸들 — 책상 카드 순서 재배치(전체 사용자에게 동기화됨). 아이템 카드와 동일한 방식.
      const handle=document.createElement('div'); handle.textContent='☰';
      handle.title='드래그해서 순서 바꾸기';
      handle.style.cssText='position:absolute;bottom:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#8a7d6b;color:#fff;font-size:10px;line-height:18px;text-align:center;cursor:grab;box-shadow:0 1px 3px #0003;z-index:2;';
      card.firstChild.appendChild(handle);
      assetCardsMod.bindReorderHandle(handle, card, rec.id, reorderSavedDesk);
    }
    card.onclick=async()=>{
      if(crState.activeCustomDeskId===rec.id) return;   // 이미 활성
      if(deskLocked){ toast('🔒 "'+(rec.name||'이 책상')+'"은(는) 라이선스 보유자만 사용할 수 있어요'); return; }   // 🔒 위 주석
      // Storage 이관 후속: rec.glb가 없고 glbUrl만 있으면 Storage에서 fetch
      let glbErr = null;
      if(!rec.glb && rec.glbUrl){
        try{ await catalogGlbMod().resolveCatalogGlb(rec); }catch(e){ glbErr = e; }
      }
      if(!rec.glb){ TwErrorCodes.notify('E-CHAR-14', glbErr || (rec.glbUrl ? 'no-glb' : 'no-url')); return; }
      /* 📦 코드로 넣은 책상만 GLB 가 def 에 실린다(카탈로그 책상은 id 만) — crDone 과 같은 갈래. */
      if(!rec.fromCatalog){
        const _sz = _creatorSizeGrow(d=>{ d.deskGlb = rec.glb; delete d.deskCatalogId; });
        if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS()); return; }
      }
      try{ const sc=await assetCodeMod().parseGlbBytes(b64ToBuf(rec.glb));
        crState.cDeskTemplate=sc; crState.cDeskGlbB64=rec.glb; crState.cDeskScale=clampDeskScale(crState.cDeskScale||DESK_SCALE_DEFAULT); crState.activeCustomDeskId=rec.id;
        if(crState.cDesk){ swapDeskVisual(crState.cDesk,sc); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); setCreatorDeskScale(crState.cDeskScale); }
        renderCrItems();
      }catch(e){ toast('책상 적용 실패'); }
    };
    dr.appendChild(card);
  });

  /* 전용 책상이 꾸미기로 갔다는 안내 — 등록된 전용 책상이 있고 관리자가 아닐 때만. */
  const _licHint = document.getElementById('crDeskLicenseHint');
  if(_licHint){
    const _hasLic = premiumMod._wdLicenseDesks().length;
    _licHint.style.display = (_hasLic && !isAdmin()) ? 'flex' : 'none';
  }

  document.getElementById('deskColor').value=crState.cDeskColor;
  _syncCrColorSwatches();   // ★ 위 topColor·botColor 와 같은 이유
  const dsc=document.getElementById('deskScale'); if(dsc){ dsc.value=crState.cDeskScale; dsc.parentElement.style.display='flex'; setCreatorDeskScale(crState.cDeskScale); }
  const row=document.getElementById('crItemRow'); row.innerHTML='';
  // ★ 기본 내장 아이템(화분/머그컵/책)과 커스텀 아이템을 하나의 목록으로 합쳐서 페이지네이션 적용
  //   (요청사항 — 예전엔 기본 아이템은 항상 위에 고정으로 보여서 5개 기준 계산에서 빠져있었음).
  const _builtinIds=new Set(DESK_ITEMS.map(d=>d.id));
  const _allEntries = [
    ...DESK_ITEMS.map(def=>({type:'builtin', def})),
    ...commissionMod().savedItems().filter(rec=>!_builtinIds.has(rec.id)).map(rec=>({type:'custom', rec})),
  ];
  const CR_ITEM_PAGE_SIZE = 5;
  const _totalPages = Math.max(1, Math.ceil(_allEntries.length / CR_ITEM_PAGE_SIZE));
  if(crState.crItemPage >= _totalPages) crState.crItemPage = _totalPages-1;
  if(crState.crItemPage < 0) crState.crItemPage = 0;
  const _pageEntries = _allEntries.slice(crState.crItemPage*CR_ITEM_PAGE_SIZE, crState.crItemPage*CR_ITEM_PAGE_SIZE + CR_ITEM_PAGE_SIZE);

  _pageEntries.forEach(entry=>{
    if(entry.type==='builtin'){
      const def=entry.def;
      const on=!!(crState.cBase&&crState.cBase.deskItems&&crState.cBase.deskItems[def.id]);
      const active = !!(crState.cBase && crState.cBase.activeDeskItem && on && crState.cBase.deskItems[def.id]===crState.cBase.activeDeskItem);
      const eff0=deskItemsMod().deskItemDef(def.id)||def;   // ★ 관리자가 교체해뒀으면 그 이름으로 표시 (예전엔 기본 이름 고정이던 문제)
      const it=assetCardsMod.swThumb(eff0.name||def.name,on,DESK_ICON[def.id]||'▫',null,active);
      assetCardsMod.applyDeskDotThumb(commissionMod().savedItems().find?commissionMod().savedItems().find(r=>r.id===def.id):null, it);   // 교체분 GLB 도트 썸네일
      it.onclick=()=>{ if(!crState.cBase||!crState.cBase.deskAnchor)return; const eff=deskItemsMod().deskItemDef(def.id)||def; equipDeskItem(crState.cBase,eff,!on); renderCrItems(); autoSaveDeskItemsNow(); };   // eff: 관리자가 교체해뒀으면 그 커스텀 def, 아니면 기본
      if(isAdmin()) it.oncontextmenu=e=>{ e.preventDefault(); _hooks.openDeskRegister('item', def.id); };   // def.id(plant/cup/books) 그대로 써서 진짜 교체되게
      else it.oncontextmenu=e=>{ e.preventDefault(); if(on && crState.cBase.deskItems[def.id]) selectDeskItemForAdjust(crState.cBase.deskItems[def.id]); };   // 일반모드: 이미 장착돼있으면 우클릭으로 바로 선택
      row.appendChild(it);
      return;
    }
    // 커스텀 아이템
    const rec = entry.rec;
    const def = customItems()[rec.id]; if(!def) return;   // 아직 세션에 파싱 안 된(로딩 중) 아이템은 건너뜀
    const on=!!(crState.cBase&&crState.cBase.deskItems&&crState.cBase.deskItems[def.id]);
    const active = !!(crState.cBase && crState.cBase.activeDeskItem && on && crState.cBase.deskItems[def.id]===crState.cBase.activeDeskItem);
    const deleteHandler = (rec && rec.fromCatalog && !isAdmin()) ? null : ()=>{
      // X 삭제: 세션 + localStorage + 현재 장착돼 있으면 해제
      // 카탈로그에서 온 것(fromCatalog)이면 관리자 전용 "회수"로 처리 — 모두에게서 배포 취소
      if(rec && rec.fromCatalog){
        if(!confirm('"'+(def.name||'아이템')+'"을(를) 모든 사용자에게서 회수할까요?')){ window.focus(); return; } window.focus();
        if(catalogNet() && catalogNet().unpublishItem) catalogNet().unpublishItem(def.id).catch(()=>toast('회수 실패(네트워크 확인)'));
      }
      if(crState.cBase&&crState.cBase.deskItems&&crState.cBase.deskItems[def.id]) equipDeskItem(crState.cBase,def,false);
      delete customItems()[def.id];
      commissionMod().setSavedItems(commissionMod().savedItems().filter(s=>s.id!==def.id)); commissionMod().persistSavedAssets();
      renderCrItems();
    };
    const it=assetCardsMod.swThumb(def.name, on, def.icon||'📦', deleteHandler, active);
    assetCardsMod.applyDeskDotThumb(rec, it);   // 🎨 GLB 도트 썸네일 (생성 전까진 이모지)
    it.dataset.reorderId = def.id;   // bindReorderHandle의 elementFromPoint 탐색용
    if(def.licenseOnly && !isPremium() && !isAdmin()){
      const lock=document.createElement('div'); lock.textContent='🔒'; lock.title='라이선스 보유자 전용';
      lock.style.cssText='position:absolute;bottom:-4px;right:-4px;font-size:13px;filter:drop-shadow(0 1px 1px #fff);z-index:2;';
      it.firstChild.appendChild(lock);
      it.style.opacity='.55';
    }
    if(isAdmin() && rec && rec.fromCatalog){
      const edit=document.createElement('div'); edit.textContent='✎';
      edit.style.cssText='position:absolute;top:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#7ba05b;color:#fff;font-size:11px;line-height:18px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
      edit.onclick=e=>{ e.stopPropagation(); _hooks.openDeskRegister('item', def.id); };
      it.firstChild.appendChild(edit);
      it.oncontextmenu=e=>{ e.preventDefault(); _hooks.openDeskRegister('item', def.id); };
      // ☰ 드래그 핸들 — 커스텀 아이템끼리 순서 재배치(전체 사용자에게 동기화됨)
      const handle=document.createElement('div'); handle.textContent='☰';
      handle.title='드래그해서 순서 바꾸기';
      handle.style.cssText='position:absolute;bottom:-6px;left:-6px;width:18px;height:18px;border-radius:50%;background:#8a7d6b;color:#fff;font-size:10px;line-height:18px;text-align:center;cursor:grab;box-shadow:0 1px 3px #0003;z-index:2;';
      it.firstChild.appendChild(handle);
      assetCardsMod.bindReorderHandle(handle, it, def.id, reorderSavedItem);
    } else if(!isAdmin()){
      it.oncontextmenu=e=>{ e.preventDefault(); if(on && crState.cBase.deskItems[def.id]) selectDeskItemForAdjust(crState.cBase.deskItems[def.id]); };   // 일반모드: 이미 장착돼있으면 우클릭으로 바로 선택
    }
    it.onclick=()=>{ if(!crState.cBase||!crState.cBase.deskAnchor)return;
      /* 📦 켜는 것만 잰다 — 카탈로그 아이템은 GLB 를 def 에 안 싣는다(crDone 과 같은 갈래). */
      if(!on && !(rec && rec.fromCatalog)){
        const _sz = _creatorSizeGrow(d=>{ d.customItems = d.customItems || {}; d.customItems[def.id] = { name: def.name, glb: def.glb }; });
        if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS()); return; }
      }
      equipDeskItem(crState.cBase,def,!on); renderCrItems(); autoSaveDeskItemsNow(); };
    row.appendChild(it);
  });
  // 페이지 버튼 렌더 — 페이지가 2개 이상일 때만 표시
  const pager = document.getElementById('crItemPager');
  if(pager){
    pager.innerHTML='';
    if(_totalPages > 1){
      pager.style.display='flex';
      for(let p=0; p<_totalPages; p++){
        const pbtn=document.createElement('button'); pbtn.className='cr-item-page-btn'+(p===crState.crItemPage?' on':'');
        pbtn.textContent=String(p+1); pbtn.type='button';
        pbtn.onclick=()=>{ crState.crItemPage=p; renderCrItems(); };
        pager.appendChild(pbtn);
      }
    } else {
      pager.style.display='none';
    }
  }
  // 한도 표시: 6개 다 차면 "+ 코드로 추가하기" 비활성화 느낌
  const dac=document.getElementById('deskAddCode'), iac=document.getElementById('itemAddCode');
  if(dac){ const full=commissionMod().savedDesks().length>=commissionMod().MAX_CUSTOM_ASSETS; dac.style.opacity=full?'0.4':'1'; dac.title=full?'최대 '+commissionMod().MAX_CUSTOM_ASSETS+'개. 카드 X로 지운 뒤 추가하세요':''; }
  if(iac){ const full=commissionMod().savedItems().length>=commissionMod().MAX_CUSTOM_ITEMS; iac.style.opacity=full?'0.4':'1'; iac.title=full?'최대 '+commissionMod().MAX_CUSTOM_ITEMS+'개. 카드 X로 지운 뒤 추가하세요':''; }
}
/* 관리자 — 커스텀 아이템끼리 드래그로 진열 순서 변경, 카탈로그(Firebase)에 order 반영해서 전체 사용자 동기화 */
function reorderSavedItem(draggedId, targetId){
  const draggedIdx = commissionMod().savedItems().findIndex(p=>p.id===draggedId);
  const targetIdx = commissionMod().savedItems().findIndex(p=>p.id===targetId);
  if(draggedIdx<0 || targetIdx<0) return;
  const [item] = commissionMod().savedItems().splice(draggedIdx,1);
  commissionMod().savedItems().splice(targetIdx,0,item);
  commissionMod().savedItems().forEach((p,i)=>{ p.order=i; });
  commissionMod().persistSavedAssets();
  renderCrItems();
  // 런처4-2: 활성 아이템이 없으면(사용자가 카드 선택 안 함) 캐릭터 위에 남아있던 기즈모 숨김.
  if(_hooks.attachItemGizmo) _hooks.attachItemGizmo();
  if(catalogNet() && catalogNet().updateItemsOrder){
    const orderMap={};
    commissionMod().savedItems().forEach((p,i)=>{ if(p.fromCatalog) orderMap[p.id]=i; });
    if(Object.keys(orderMap).length){
      catalogNet().updateItemsOrder(orderMap).catch(()=>{ toast('⚠ 순서가 온라인에는 반영 안 됐어요(인터넷 연결 확인) — 이 화면에서만 바뀐 상태예요'); });
    }
  }
}
function reorderSavedDesk(draggedId, targetId){
  const draggedIdx = commissionMod().savedDesks().findIndex(p=>p.id===draggedId);
  const targetIdx = commissionMod().savedDesks().findIndex(p=>p.id===targetId);
  if(draggedIdx<0 || targetIdx<0) return;
  const [item] = commissionMod().savedDesks().splice(draggedIdx,1);
  commissionMod().savedDesks().splice(targetIdx,0,item);
  commissionMod().savedDesks().forEach((p,i)=>{ p.order=i; });
  commissionMod().persistSavedAssets();
  renderCrItems();
  if(catalogNet() && catalogNet().updateDesksOrder){
    const orderMap={};
    commissionMod().savedDesks().forEach((p,i)=>{ if(p.fromCatalog) orderMap[p.id]=i; });
    if(Object.keys(orderMap).length){
      catalogNet().updateDesksOrder(orderMap).catch(()=>{ toast('⚠ 순서가 온라인에는 반영 안 됐어요(인터넷 연결 확인) — 이 화면에서만 바뀐 상태예요'); });
    }
  }
}
if(document.getElementById('deskColor')) document.getElementById('deskColor').addEventListener('input',e=>{ crState.cDeskColor=e.target.value; lightToneMod()._setDeskMatColor(crState.cDeskMat, crState.cDeskColor); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); });
// 일반(비관리자) 모드: 3D 미리보기에서 이미 놓인 아이템을 우클릭하면 그걸 선택 상태로 만들어서
// 껐다 켜지 않고도 바로 위치조작 버튼으로 조정할 수 있게 함. 선택되면 주황색 테두리로 표시.
function selectDeskItemForAdjust(pivot){
  if(!crState.cBase) return;   // 입구 전제 — 캐릭터가 있어야 고른다
  crState.cBase.activeDeskItem = pivot;
  if(creatorOpen()) renderCrItems();
  if(_hooks.attachItemGizmo) _hooks.attachItemGizmo();
}
if(document.getElementById('creatorPreview')) document.getElementById('creatorPreview').addEventListener('contextmenu', e=>{
  console.log('[아이템 우클릭 감지] isAdmin:', isAdmin(), '| crStep:', crState.crStep, '| cBase 있음:', !!crState.cBase, '| deskItems:', crState.cBase&&crState.cBase.deskItems);
  if(isAdmin()) return;   // 관리자는 카드 우클릭으로 GLB 수정하는 흐름을 쓰므로 여기선 건너뜀
  if(crState.crStep!==5 || !crState.cBase || !crState.cBase.deskItems || !crState.cCam) return;   // 책상 세팅 단계에서만
  const pivots = Object.values(crState.cBase.deskItems).filter(Boolean);
  console.log('[아이템 우클릭] pivots 개수:', pivots.length);
  if(!pivots.length) return;
  e.preventDefault();
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  ndc.x=((e.clientX-r.left)/r.width)*2-1; ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc, crState.cCam);
  const hit = ray.intersectObjects(pivots, true);
  console.log('[아이템 우클릭] 히트 개수:', hit.length);
  if(!hit.length) return;
  let p=hit[0].object; while(p && !p.userData.isDeskItemPivot) p=p.parent;
  if(p) selectDeskItemForAdjust(p);
});

return {
  renderCrItems,
  selectDeskItemForAdjust,
  setHooks,
};
}

const api = { createDeskSetup };
if(typeof window !== 'undefined') window.TwDeskSetup = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
