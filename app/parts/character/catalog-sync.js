/* catalog-sync.js — 🔄 카탈로그 실시간 동기화 — 아이템 · 책상 · 파츠 · 카테고리 구독을 저장 목록과 좌석에 반영
   책임: Firebase 카탈로그(catalog/items · desks · parts · 카테고리) 구독을 걸고, 스냅샷이 오면 저장 목록(savedItems · savedDesks · savedParts)에 합친 뒤(카탈로그 순서 · 지워진 것 빼기 · 로컬 전용 남기기) 떠 있는 좌석 · 생성기 · 런처 · 꾸미기 미리보기에 다시 반영한다.
   받는 deps: 저장 목록 모듈(commissionMod · premiumMod) · GLB 해결(catalogGlbMod) · 좌석에 입히기(equipDeskItem · applyDeskItemsTo · equipPartOnSeat · applyDeskCatalogRefToSeat …) · 생성기 상태(cDesk · cBase · creatorOpen …, 읽는 · 쓰는 함수) · 화면 다시 그리기(wardrobeMod · gachaMod · adminCategory · renderLauncher).
   데이터는 catalogNet() 으로만 본다 — 데이터 provider(지금은 app.js 가 window.firebaseAPI 를 넘김 · 서버로 옮길 때 그 한 줄만 바꾼다).
   내보내는 것: 없음 — 만들 때 구독을 건다(catalogNet() 이 아직 없으면 firebase-ready 를 기다린다).
   app.js «🔄 카탈로그 실시간 동기화» 구역을 그대로 옮겼다(구역 떼기 C · w2 — 좌석 책상을 그리는 applyDeskCatalogRefToSeat 는 책상 몫이라 남김). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 18줄 —
     activeCustomDeskId · cBase · cDesk · cDeskColor · cDeskGlbB64 · cDeskScale · cDeskTemplate · creatorOpen · customItems · gachaMod · isAdmin 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCDeskGlbB64 · setCDeskTemplate(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 17개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ firebaseAPI 는 직접 보지 않는다(catalogNet 으로만). document · window · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCatalogSync — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-catalog-sync.js */
(function(){

function createCatalogSync(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const activeCustomDeskId = deps.activeCustomDeskId;   // 읽는 함수
const adminCategory = deps.adminCategory;
const applyClothVisibility = deps.applyClothVisibility;
const applyDeskCatalogRefToSeat = deps.applyDeskCatalogRefToSeat;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const assetCodeMod = deps.assetCodeMod;
const b64ToBuf = deps.b64ToBuf;
const cBase = deps.cBase;   // 읽는 함수
const cDesk = deps.cDesk;   // 읽는 함수
const cDeskColor = deps.cDeskColor;   // 읽는 함수
const cDeskGlbB64 = deps.cDeskGlbB64;   // 읽는 함수
const cDeskScale = deps.cDeskScale;   // 읽는 함수
const cDeskTemplate = deps.cDeskTemplate;   // 읽는 함수
const catalogGlbMod = deps.catalogGlbMod;
const catalogNet = deps.catalogNet;   // 읽는 함수 — 데이터 provider(지금은 app.js 가 window.firebaseAPI 를 넘긴다) · 준비 전이면 없음
const clearHolderDeskItems = deps.clearHolderDeskItems;
const commissionMod = deps.commissionMod;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const equipDeskItem = deps.equipDeskItem;
const equipPartOnSeat = deps.equipPartOnSeat;
const fitModel = deps.fitModel;
const gachaMod = deps.gachaMod;   // 읽는 함수
const isAdmin = deps.isAdmin;   // 읽는 함수
const layoutSeats = deps.layoutSeats;
const loadSavedItemsIntoSession = deps.loadSavedItemsIntoSession;
const premiumMod = deps.premiumMod;
const renderCrItems = deps.renderCrItems;
const renderLauncher = deps.renderLauncher;
const rideBenchMod = deps.rideBenchMod;
const seats = deps.seats;
const setCreatorDeskScale = deps.setCreatorDeskScale;
const swapDeskVisual = deps.swapDeskVisual;
const toast = deps.toast;
const unequipPartFromSeat = deps.unequipPartFromSeat;
const wardrobeMod = deps.wardrobeMod;
const setCDeskGlbB64 = deps.setCDeskGlbB64;   // 쓰는 함수
const setCDeskTemplate = deps.setCDeskTemplate;   // 쓰는 함수
/* 카탈로그에 있는 id 는 늘 서버 최신본으로 덮고, 카탈로그에 온 적 없는 로컬 항목은 남긴다. 구독(onValue)이라 켜 둔 동안에도 새 항목이 뜬다. */
async function mergeCatalogIntoSavedItems(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>({ id, ...catalogObj[id], fromCatalog:true }));
  // ★ order 필드 기준 오름차순 정렬 — 관리자가 드래그로 정한 순서가 모든 사용자에게 그대로 반영됨.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const removedIds = commissionMod.savedItems().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = commissionMod.savedItems().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 아이템을 지금 올려놓은 좌석이 있으면 치움
    seats.forEach(s=>{ removedIds.forEach(id=>{ if(s.deskItems && s.deskItems[id]){ const def=customItems()[id]||{id}; equipDeskItem(s,def,false); } }); });
    removedIds.forEach(id=>{ delete customItems()[id]; });
  }
  commissionMod.setSavedItems([...catalogList, ...localOnly]);
  commissionMod.persistSavedAssets();
  /* ⚠️ 세션 등록이 끝난 **뒤에** 좌석을 다시 적용한다 — 기다리지 않으면 옛 정의(크기 0.8)로 다시 만든다. */
  try{ await loadSavedItemsIntoSession(); }catch(_){}   // 세션 customItems에도 최신 상태 반영(새로 추가/수정된 GLB 등록)
  // 캐릭터 로드가 카탈로그 동기화보다 먼저 끝났을 수 있어서(비동기 타이밍), 이미 떠 있는 좌석들의 아이템도 다시 적용
  seats.forEach(s=>{ clearHolderDeskItems(s); if(s.charDef && s.charDef.deskItems) applyDeskItemsTo(s, s.charDef.deskItems); });
  // 생성기를 연 채 관리자가 아이템을 고쳐도 바로 보이게 장착분도 다시 올린다.
  // ⚠️ 위치 · 크기 조정값은 일부러 안 지킨다 — 지키면 자동 크기 계산을 바꿔도 옛 값이 덮어써 안 보인다.
  if(typeof cBase()!=='undefined' && cBase() && creatorOpen() && cBase().deskItems){
    Object.keys(cBase().deskItems).forEach(id=>{
      const p=cBase().deskItems[id]; if(!p) return;
      const def=customItems()[id]; if(!def) return;   // 카탈로그(커스텀) 아이템만 대상 — 기본 내장 모양은 고정이라 재적용 불필요
      equipDeskItem(cBase(), def, true);
    });
  }
  if(creatorOpen()) renderCrItems();
  /* 🪑 [제보 2] 책상 카탈로그와 같은 이유 — licenseOnly 아이템 판정은 이 레코드가 와야 선다. */
  try{ premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 아이템 카탈로그 도착 후 정리 실패', e); }
}
function subscribeCatalogItems(){
  if(!catalogNet() || !catalogNet().subscribeCatalogItems) return;
  catalogNet().subscribeCatalogItems(async catalogObj=>{
    await catalogGlbMod.resolveCatalogGlbAll(catalogObj);
    await mergeCatalogIntoSavedItems(catalogObj);
  });
}
if(catalogNet()) subscribeCatalogItems();
else window.addEventListener('firebase-ready', subscribeCatalogItems, { once:true });
function mergeCatalogIntoSavedDesks(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>({ id, ...catalogObj[id], fromCatalog:true }));
  // ★ order 필드 기준 오름차순 정렬 — 관리자가 드래그로 정한 순서가 모든 사용자에게 그대로 반영됨.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const removedIds = commissionMod.savedDesks().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = commissionMod.savedDesks().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 책상을 지금 쓰고 있는 좌석이 있으면 기본 책상으로 되돌림
    seats.forEach(s=>{ if(s.charDef && removedIds.includes(s.charDef.deskCatalogId)){ s.charDef.deskCatalogId=null; s.charDef.deskGlb=null; if(s.desk) swapDeskVisual(s.desk,null); } });
  }
  commissionMod.setSavedDesks([...catalogList, ...localOnly]);
  commissionMod.persistSavedAssets();
  // 지금 이 책상을 쓰고 있는 좌석이 있으면(수정됐을 수 있으니) 즉시 새 GLB로 다시 그림 — "교체하면 실시간 반영" 요구사항
  // 기본 책상(별도 deskCatalogId/deskGlb 없음)을 쓰는 좌석도 __default_desk__ 오버라이드가 있으면/없어졌으면 반영
  seats.forEach(s=>{
    if(s.charDef && s.charDef.deskCatalogId){ applyDeskCatalogRefToSeat(s, s.charDef); }
    else if(s.charDef && !s.charDef.deskGlb){ applyDeskCatalogRefToSeat(s, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:s.charDef.deskScale, deskColor:s.charDef.deskColor}); }
  });
  /* 🪑 licenseOnly 는 카탈로그 레코드에만 있어 지금이 «전용인가» 를 알 첫 순간이다(라이선스가 있거나 카탈로그가 비면 접기가 스스로 물러난다). */
  try{ premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 책상 카탈로그 도착 후 정리 실패', e); }
  // 생성기를 연 채 등록 · 수정하면 3D 미리보기(cDesk)도 바로 새 GLB 로.
  if(typeof cDesk()!=='undefined' && cDesk() && creatorOpen()){
    if(cDeskGlbB64() && activeCustomDeskId()){
      const rec=commissionMod.savedDesks().find(d=>d.id===activeCustomDeskId());
      if(rec){ assetCodeMod.parseGlbBytes(b64ToBuf(rec.glb)).then(sc=>{ setCDeskTemplate(sc); setCDeskGlbB64(rec.glb); swapDeskVisual(cDesk(),sc); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }).catch(()=>{}); }
    } else if(!activeCustomDeskId()){
      const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
      if(ov){ assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb)).then(sc=>{ swapDeskVisual(cDesk(),sc,true); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }).catch(()=>{}); }
      else { swapDeskVisual(cDesk(),null); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }
    }
  }
  if(creatorOpen()) renderCrItems();
}
function subscribeCatalogDesks(){
  if(!catalogNet() || !catalogNet().subscribeCatalogDesks) return;
  catalogNet().subscribeCatalogDesks(async catalogObj=>{
    await catalogGlbMod.resolveCatalogGlbAll(catalogObj);
    mergeCatalogIntoSavedDesks(catalogObj);
  });
}
if(catalogNet()) subscribeCatalogDesks();
else window.addEventListener('firebase-ready', subscribeCatalogDesks, { once:true });

function mergeCatalogIntoSavedParts(catalogObj){
  const catalogList = Object.keys(catalogObj||{}).map(id=>premiumMod._normPartRec({ id, ...catalogObj[id], fromCatalog:true }));   // 🎰 가챠 = stackable(_normPartRec 주석)
  // ★ order 오름차순(관리자가 드래그로 정한 순서) · order 없는 옛 항목은 뒤로.
  catalogList.sort((a,b)=> (a.order!=null?a.order:9999) - (b.order!=null?b.order:9999));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  // ★ fromCatalog 인데 지금 목록에 없으면 관리자가 지운 것 — 로컬에도 남기지 않는다(남기는 건 카탈로그에 온 적 없는 로컬 전용뿐).
  const removedIds = premiumMod.savedParts().filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = premiumMod.savedParts().filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  if(removedIds.length){
    // 삭제된 파츠를 지금 착용 중인 좌석이 있으면 해제
    seats.forEach(s=>{ if(s.charDef&&s.charDef.equippedParts){ for(const c in s.charDef.equippedParts){ if(removedIds.includes(premiumMod.partEntryId(s.charDef.equippedParts[c]))){ delete s.charDef.equippedParts[c]; unequipPartFromSeat(s,c); } } } applyClothVisibility(s); });
  }
  premiumMod.setSavedParts([...catalogList, ...localOnly]);
  premiumMod.persistSavedParts();   // 오프라인에서도 마지막으로 받은 카탈로그를 쓸 수 있게 캐시
  // 시작 때 rec.glb 가 없어 못 붙인 파츠를 다시 붙인다 — entry 단위로 돈다.
  // ⚠️ 겹쳐 다는(stackable) 파츠는 stackedPartObjs 에 있다 — equippedPartObjs 만 보면 매번 xf 없이 다시 붙어 자리가 원점으로 간다.
  seats.forEach(s=>{
    if(!s.charDef || !s.charDef.equippedParts) return;
    s.equippedPartObjs = s.equippedPartObjs || {};
    const _pending = [];   // 🦶 이번에 새로 붙은 파츠들 — 다 붙은 뒤 바닥을 다시 맞춘다
    for(const cat in s.charDef.equippedParts){
      premiumMod.entriesForCat(s.charDef, cat).forEach(entry=>{
        const id = premiumMod.partEntryId(entry);
        const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat);
        if(!rec) return;
        const attached = rec.stackable
          ? !!(s.stackedPartObjs && s.stackedPartObjs[cat] && s.stackedPartObjs[cat][id])
          : !!s.equippedPartObjs[cat];
        if(attached) return;
        _pending.push(equipPartOnSeat(s, cat, rec, { stackableXf: rec.stackable ? premiumMod.partEntryXf(entry) : null }));
      });
    }
    applyClothVisibility(s);
    /* 🦶 카탈로그가 늦게 와 여기서 붙은 파츠도 바닥 맞춤을 받아야 한다(부팅 fitModel 은 이미 지나갔다).
       ★ 새로 붙은 게 없으면 fitModel 을 안 부른다 — 카탈로그가 올 때마다 좌석 전부가 다시 굴러간다. */
    if(_pending.length){
      Promise.all(_pending.map(p=>Promise.resolve(p).catch(()=>{}))).then(()=>{
        try{ if(s && s.gltfRoot){ fitModel(s); layoutSeats(); } }catch(_){}
      });
    }
    /* 🎩 카탈로그가 늦게 와 rideTop(위에 얹을 수 있음)만 바뀐 경우 — 이미 붙은 파츠라 위 루프는 건너뛰므로
       머리 꼭대기를 좌석마다 직접 다시 잰다. ⚠️ _pending 과 무관하게 부른다(아무도 안 타면 바로 빠져나온다). */
    try{ rideBenchMod._remeasureRideHeadTop(s); }catch(_){}
  });
  // 런처 슬롯 미리보기도 다시 — 처음엔 rec.glb 가 없어 파츠가 빠져 그려졌을 수 있다.
  const launcher = document.getElementById('launcher');
  if(launcher && launcher.classList.contains('on')){
    renderLauncher();
  }
  // 꾸미기창 미리보기도 열려있으면 재빌드
  const wdPanel = document.getElementById('wdPreviewPanel');
  if(wdPanel && wdPanel.classList.contains('on')){
    wardrobeMod.refreshWdPreviewChar();
  }
  wardrobeMod.renderWardrobe();
  /* 🎰 savedParts 가 찬 지금이 미보유 가챠 파츠를 회수할 첫 순간이다(부팅 회수는 카탈로그가 없어 거의 물러난다).
     ★ 서버를 아직 못 읽었으면 pruneUnownedGachaParts 가 스스로 물러난다. */
  try{ gachaMod().pruneUnownedGachaParts(); }
  catch(e){ console.warn('[가챠] 카탈로그 도착 후 정리 실패', e); }
}
function subscribeCatalogParts(){
  if(!catalogNet() || !catalogNet().subscribeCatalogParts) return;
  catalogNet().subscribeCatalogParts(async catalogObj=>{
    await catalogGlbMod.resolveCatalogGlbAll(catalogObj);
    mergeCatalogIntoSavedParts(catalogObj);
    /* 🎰 이관 과도기 — catalog/parts 에 남은 옛 가챠 항목(_legacyGacha)을 관리자 세션이 gachaParts 로 옮긴다(옛 앱이 뽑지 않고 낀다).
       ⚠️ 관리자만 — 일반 기기가 조용히 카탈로그를 옮기게 두지 않는다. 멱등이라 관리자 기기가 여럿이어도 된다. */
    if(isAdmin() && !window.__gachaMigrated && catalogNet().migrateGachaCatalog
       && Object.keys(catalogObj||{}).some(id=>catalogObj[id] && catalogObj[id]._legacyGacha)){
      window.__gachaMigrated = true;   // 콜백이 연달아 와도 한 번만
      catalogNet().migrateGachaCatalog()
        .then(r=>{ if(r && r.moved && r.moved.length) toast('🎰 가챠 파츠 '+r.moved.length+'개를 새 카탈로그 경로로 옮겼어요 (구버전 노출 차단)'); })
        .catch(()=>{ window.__gachaMigrated = false; });   // 실패하면 다음 콜백에서 재시도
    }
  });
}
if(catalogNet()) subscribeCatalogParts();
else window.addEventListener('firebase-ready', subscribeCatalogParts, { once:true });
// 커스텀 서브카테고리 구독 — 받아서 PART_CATS 에 합친다.
function subscribeCustomCats(){
  if(!catalogNet() || !catalogNet().subscribeCustomCats) return;
  catalogNet().subscribeCustomCats(catObj=>{
    premiumMod.setCustomPartCats(Object.keys(catObj||{}).map(k=>catObj[k]).filter(c=>c && c.cat));
    premiumMod.rebuildPartCats();
    wardrobeMod.renderWardrobe();
    if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();
  });
}
// 기본 카테고리 이름 덮어쓰기 구독 (예: 망토 → 겉옷)
function subscribeCatOverrides(){
  if(!catalogNet() || !catalogNet().subscribeCatOverrides) return;
  catalogNet().subscribeCatOverrides(obj=>{
    premiumMod.setPartCatOverrides(obj || {});
    premiumMod.rebuildPartCats();
    wardrobeMod.renderWardrobe();
    if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();
  });
}
if(catalogNet()){ subscribeCustomCats(); subscribeCatOverrides(); }
else window.addEventListener('firebase-ready', ()=>{ subscribeCustomCats(); subscribeCatOverrides(); }, { once:true });

return {

};
}

const api = { createCatalogSync };
if(typeof window !== 'undefined') window.TwCatalogSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
