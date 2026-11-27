/* catalog-sync.js — 🔄 카탈로그 실시간 동기화 — 아이템 · 책상 · 파츠 · 카테고리 구독을 저장 목록과 좌석에 반영
   책임: 서버 카탈로그(items · desks · parts · 카테고리 · 해금 레벨) 구독을 걸고, 스냅샷이 오면 저장 목록(savedItems · savedDesks · savedParts)에 합친 뒤(카탈로그 순서 · 지워진 것 빼기 · 로컬 전용 남기기) 떠 있는 좌석 · 생성기 · 런처 · 꾸미기 미리보기에 다시 반영한다.
   받는 deps: 저장 목록 모듈(commissionMod · premiumMod) · GLB 해결(catalogGlbMod) · 서버(catalogApiMod — character/catalog-api.js) · 좌석에 입히기(equipDeskItem · applyDeskItemsTo · equipPartOnSeat · applyDeskCatalogRefToSeat …) · 생성기 상태(cDesk · cBase · creatorOpen …, 읽는 · 쓰는 함수) · 화면 다시 그리기(wardrobeMod · gachaMod · adminCategory · renderLauncher).
   내보내는 것: start(session) — 로그인 뒤 app-boot STEPS 'catalog' 가 한 번 부른다(구독 다섯을 세션에 맡긴다 — 만들 때는 요청 0) ·
     fillGlb() — 첫 화면 뒤 app-boot LATER 'catalogGlb' 가 한 번(GLB 를 다 받아 두고 새로 채운 종류만 다시 합친다). 합치기 규칙 mergeCatalogList 는 이 안의 순수 함수(검사는 글을 뽑아 직접 돌린다).
   ★ 합치기는 GLB 를 기다리지 않는다 — 아이템 · 책상은 이 PC 캐시에 있는 것만 채워 합치고, 파츠는 GLB 없이 합친다(입은 파츠는 part-scene 이 · 책상은 desk-visual 이 그릴 때 받는다).
   app.js «🔄 카탈로그 실시간 동기화» 구역을 그대로 옮겼다(구역 떼기 C · w2 — 좌석 책상을 그리는 applyDeskCatalogRefToSeat 는 책상 몫이라 남김). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 18줄 —
     activeCustomDeskId · cBase · cDesk · cDeskColor · cDeskGlbB64 · cDeskScale · cDeskTemplate · creatorOpen · customItems · gachaMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCDeskGlbB64 · setCDeskTemplate(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 17개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: start · fillGlb(app-boot).
   ⚠️ firebaseAPI 는 쓰지 않는다(서버는 catalogApiMod 로만). document · window · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCatalogSync — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-catalog-sync.js */
(function(){

function createCatalogSync(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const activeCustomDeskId = deps.activeCustomDeskId;   // 읽는 함수
const adminCategory = deps.adminCategory;
const applyInteractionUnlocks = deps.applyInteractionUnlocks;   // 춤 · 상호작용 책상 해금 레벨 앉히기(room/interaction-desk.js)
const setAnimalUnlockLevel = deps.setAnimalUnlockLevel;   // 동물 캐릭터 해금 레벨 앉히기(animal.js 의 고리 — 그 파일이 app.js 보다 뒤에 실려, 서버 답은 둘 다 실린 뒤에 온다)
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
const catalogApiMod = deps.catalogApiMod;
const clearHolderDeskItems = deps.clearHolderDeskItems;
const commissionMod = deps.commissionMod;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const equipDeskItem = deps.equipDeskItem;
const equipPartOnSeat = deps.equipPartOnSeat;
const gachaMod = deps.gachaMod;   // 읽는 함수
const loadSavedItemsIntoSession = deps.loadSavedItemsIntoSession;
const premiumMod = deps.premiumMod;
const refitSeatAfterParts = deps.refitSeatAfterParts;
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
/* 카탈로그 스냅샷을 저장 목록과 합치는 규칙 — 아이템 · 책상 · 파츠가 같이 쓴다(순수 계산 · DOM · 3D · 서버 없음).
   ★ 카탈로그 항목은 fromCatalog:true 로 서버판이 이기고, order 오름차순(관리자가 드래그로 정한 순서 · 없으면 CATALOG_ORDER_LAST 로 뒤).
   ★ fromCatalog 인데 지금 목록에 없으면 관리자가 지운 것(removedIds) — 로컬에도 안 남긴다. 남기는 건 카탈로그에 온 적 없는 로컬 전용뿐(뒤에).
   norm 을 주면 카탈로그 항목마다 먼저 다듬는다(파츠 — _normPartRec). saved 는 바꾸지 않는다. */
const CATALOG_ORDER_LAST = 9999;   // order 가 없는 옛 항목의 자리 — 뒤로
function mergeCatalogList(catalogObj, saved, norm){
  const catalogList = Object.keys(catalogObj||{}).map(id=>{ const rec = { id, ...catalogObj[id], fromCatalog:true }; return norm ? norm(rec) : rec; });
  catalogList.sort((a,b)=> (a.order!=null?a.order:CATALOG_ORDER_LAST) - (b.order!=null?b.order:CATALOG_ORDER_LAST));
  const catalogIds = new Set(catalogList.map(p=>p.id));
  const removedIds = saved.filter(p=>p.fromCatalog && !catalogIds.has(p.id)).map(p=>p.id);
  const localOnly = saved.filter(p=>!catalogIds.has(p.id) && !p.fromCatalog);
  return { list: [...catalogList, ...localOnly], removedIds };
}
/* 카탈로그에 있는 id 는 늘 서버 최신본으로 덮고, 카탈로그에 온 적 없는 로컬 항목은 남긴다. 구독(onValue)이라 켜 둔 동안에도 새 항목이 뜬다. */
async function mergeCatalogIntoSavedItems(catalogObj){
  const { list, removedIds } = mergeCatalogList(catalogObj, commissionMod.savedItems());
  if(removedIds.length){
    // 삭제된 아이템을 지금 올려놓은 좌석이 있으면 치움
    seats.forEach(s=>{ removedIds.forEach(id=>{ if(s.deskItems && s.deskItems[id]){ const def=customItems()[id]||{id}; equipDeskItem(s,def,false); } }); });
    removedIds.forEach(id=>{ delete customItems()[id]; });
  }
  commissionMod.setSavedItems(list);
  restoreHeldLicenseAssets();   // 서버 locked 가 풀린 접어 둔 것을 되돌린 뒤 아래에서 다시 그린다
  // 카탈로그 몫은 따로 저장하지 않는다(서버가 원본 · 한 벌은 catalog-api.js) — 이 계정 몫은 바뀐 게 없다
  /* ⚠️ 세션 등록이 끝난 **뒤에** 좌석을 다시 적용한다 — 기다리지 않으면 옛 정의(크기 0.8)로 다시 만든다. */
  await loadSavedItemsIntoSession();   // 세션 customItems에도 최신 상태 반영(새로 추가/수정된 GLB 등록) — 깨진 GLB 는 그 함수가 하나씩 경고 + E-CHAR-25 로 드러내고, 그 밖의 실패는 던져 구독 쪽에 드러난다(삼키지 않는다)
  // 캐릭터 로드가 카탈로그 동기화보다 먼저 끝났을 수 있어서(비동기 타이밍), 이미 떠 있는 좌석들의 아이템도 다시 적용
  seats.forEach(s=>{ clearHolderDeskItems(s); if(s.charDef && s.charDef.deskItems) applyDeskItemsTo(s, s.charDef.deskItems); });
  // 생성기를 연 채 관리자가 아이템을 고쳐도 바로 보이게 장착분도 다시 올린다.
  // ⚠️ 위치 · 크기 조정값은 일부러 안 지킨다 — 지키면 자동 크기 계산을 바꿔도 옛 값이 덮어써 안 보인다.
  /* 받기 전에 건너뛴 아이템(holder._skippedItems — 건너뛰는 순간 붙잡은 원본 항목)은 holder 가 아니라 그 항목에서 저장된 위치 · 크기째 올린다 — 올려 보고 아직 막히면 표시가 남는다 */
  if(cBase() && creatorOpen() && cBase()._skippedItems && cBase()._skippedItems.size){
    const pick = {};
    cBase()._skippedItems.forEach((entry, id)=>{ if(entry && customItems()[id]) pick[id] = entry; });
    applyDeskItemsTo(cBase(), pick);
  }
  if(cBase() && creatorOpen() && cBase().deskItems){
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
/* 받은 한 벌(종류마다 마지막 것) — 첫 화면 뒤 GLB 를 다 받으면(fillGlb) 같은 한 벌로 다시 합친다 */
const lastObj = { items: null, desks: null, parts: null };
/* 합치기 전 GLB 는 이 PC 캐시(메모리 · IndexedDB)에서만 채운다 — 서버에서 받는 것은 첫 화면 뒤(fillGlb)와 그릴 때(파츠 part-scene · 책상 desk-visual) */
function subscribeCatalogItems(){
  return catalogApiMod.subscribe('items', async catalogObj=>{
    lastObj.items = catalogObj;
    await catalogGlbMod.resolveCatalogGlbAll(catalogObj, true);
    await mergeCatalogIntoSavedItems(catalogObj);
  });
}
function mergeCatalogIntoSavedDesks(catalogObj){
  const { list, removedIds } = mergeCatalogList(catalogObj, commissionMod.savedDesks());
  if(removedIds.length){
    // 삭제된 책상을 지금 쓰고 있는 좌석이 있으면 기본 책상으로 되돌림
    seats.forEach(s=>{ if(s.charDef && removedIds.includes(s.charDef.deskCatalogId)){ s.charDef.deskCatalogId=null; s.charDef.deskGlb=null; if(s.desk) swapDeskVisual(s.desk,null); } });
  }
  commissionMod.setSavedDesks(list);
  restoreHeldLicenseAssets();   // 서버 locked 가 풀린 접어 둔 것을 되돌린 뒤 아래 좌석 순회가 다시 그린다
  // 지금 이 책상을 쓰고 있는 좌석이 있으면(수정됐을 수 있으니) 즉시 새 GLB로 다시 그림 — "교체하면 실시간 반영" 요구사항
  // 기본 책상(별도 deskCatalogId/deskGlb 없음)을 쓰는 좌석도 __default_desk__ 오버라이드가 있으면/없어졌으면 반영
  /* 옛 deskGlb 좌석은 카탈로그와 무관해 건너뛴다. 어떤 책상을 그릴지(기본 책상 교체본 포함)는 def 그대로 넘겨 desk-visual.js deskBodyPlan 이 정한다 —
     여기서 def 를 손으로 다시 만들면 칸이 빠진다(deskLenX 가 빠져 길이가 1 로 돌아갔다) */
  seats.forEach(s=>{
    if(s.charDef && (s.charDef.deskCatalogId || !s.charDef.deskGlb)) applyDeskCatalogRefToSeat(s, s.charDef);
  });
  /* 🪑 licenseOnly 는 카탈로그 레코드에만 있어 지금이 «전용인가» 를 알 첫 순간이다(라이선스가 있거나 카탈로그가 비면 접기가 스스로 물러난다). */
  try{ premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 책상 카탈로그 도착 후 정리 실패', e); }
  // 생성기를 연 채 등록 · 수정하면 3D 미리보기(cDesk)도 바로 새 GLB 로.
  if(typeof cDesk()!=='undefined' && cDesk() && creatorOpen()){
    if(cDeskGlbB64() && activeCustomDeskId()){
      const rec=commissionMod.savedDesks().find(d=>d.id===activeCustomDeskId());
      if(rec){ catalogGlbMod.resolveCatalogGlb(rec).then(()=>assetCodeMod.parseGlbBytes(b64ToBuf(rec.glb))).then(sc=>{ setCDeskTemplate(sc); setCDeskGlbB64(rec.glb); swapDeskVisual(cDesk(),sc); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }).catch(()=>{}); }
    } else if(!activeCustomDeskId()){
      const ov=commissionMod.savedDesks().find(d=>d.id===DEFAULT_DESK_OVERRIDE_ID);
      if(ov){ catalogGlbMod.resolveCatalogGlb(ov).then(()=>assetCodeMod.parseGlbBytes(b64ToBuf(ov.glb))).then(sc=>{ swapDeskVisual(cDesk(),sc,true); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }).catch(()=>{}); }
      else { swapDeskVisual(cDesk(),null); applyDeskColorToCustom(cDesk(),cDeskColor()); setCreatorDeskScale(cDeskScale()); }
    }
  }
  if(creatorOpen()) renderCrItems();
}
function subscribeCatalogDesks(){
  return catalogApiMod.subscribe('desks', async catalogObj=>{
    lastObj.desks = catalogObj;
    await catalogGlbMod.resolveCatalogGlbAll(catalogObj, true);
    mergeCatalogIntoSavedDesks(catalogObj);
  });
}

function mergeCatalogIntoSavedParts(catalogObj){
  const { list, removedIds } = mergeCatalogList(catalogObj, premiumMod.savedParts(), r=>premiumMod._normPartRec(r));   // 🎰 가챠 = stackable(_normPartRec 주석)
  if(removedIds.length){
    // 삭제된 파츠를 지금 착용 중인 좌석이 있으면 해제
    seats.forEach(s=>{ if(s.charDef&&s.charDef.equippedParts){ for(const c in s.charDef.equippedParts){ if(removedIds.includes(premiumMod.partEntryId(s.charDef.equippedParts[c]))){ delete s.charDef.equippedParts[c]; unequipPartFromSeat(s,c); } } } applyClothVisibility(s); });
  }
  premiumMod.setSavedParts(list);   // 카탈로그는 catalog-api.js 가 서버 한 벌로 채운다 — 카탈로그 몫을 이 계정 칸에 쓰지 않는다
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
      refitSeatAfterParts(s, { wait: Promise.all(_pending.map(p=>Promise.resolve(p).catch(()=>{}))), layout: true });
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
  return catalogApiMod.subscribe('parts', async catalogObj=>{
    lastObj.parts = catalogObj;
    mergeCatalogIntoSavedParts(catalogObj);   // GLB 를 기다리지 않는다 — 입은 파츠는 붙일 때 받는다(part-scene.js getPartScene)
  });
}
/* 카테고리 — 서버 한 벌의 categories 한 줄로 받는다: 운영이 더한 카테고리(PART_CATS 에 합침) · 기본 카테고리의 바뀐 이름 · 아이콘(예: 망토 → 겉옷) */
function subscribeCategories(){
  return catalogApiMod.subscribe('categories', cats=>{
    premiumMod.setCustomPartCats(cats.customCats);
    premiumMod.setPartCatOverrides(cats.catOverrides);
    premiumMod.rebuildPartCats();
    wardrobeMod.renderWardrobe();
    if(typeof adminCategory.renderCategoryManager==='function') adminCategory.renderCategoryManager();
  });
}
/* 해금 레벨 — 서버 한 벌의 unlocks. 동물 캐릭터(ANIMAL_CHARACTER · animal)는 여기서, 춤 · 상호작용 책상은 applyInteractionUnlocks 로 앉힌다.
   서버에 그 줄이 없으면 앉히지 않고 알린다(animal.js 의 처음 값이 남는다). */
const ANIMAL_UNLOCK = { kind: 'ANIMAL_CHARACTER', key: 'animal' };
function subscribeUnlocks(){
  return catalogApiMod.subscribe('unlocks', unlocks=>{
    applyInteractionUnlocks(unlocks);   // 춤 · 상호작용 책상
    const row = unlocks[ANIMAL_UNLOCK.kind] && unlocks[ANIMAL_UNLOCK.kind][ANIMAL_UNLOCK.key];
    if(!row){ console.warn('[catalog] 서버 해금 표에 동물 캐릭터 줄이 없다'); return; }
    setAnimalUnlockLevel(row.level);
  });
}

/* 접어 둔 전용 자산 중 서버 locked 가 풀린 것을 되돌린다 — 라이선스가 바뀌면 서버가 locked 를 바꾸고(realtime license → 다시 받기) 그 카탈로그가 올 때 여기를 지난다 */
function restoreHeldLicenseAssets(){
  try{ premiumMod.restoreLicenseHeldAssets(); }
  catch(e){ console.warn('[라이선스] 접어 둔 자산 복원 실패', e); }
}
/* 세션이 끝나면 카탈로그 몫(fromCatalog — 서버가 이 사람에게 정한 locked 를 든 레코드)을 저장 목록 셋과 customItems 에서 뺀다 — 다음 계정이 앞 계정의 locked 로 시작하지 않게.
   이 계정 몫(코드로 추가한 것)은 userLocal 의 reset 이 따로 비운다. 비운 뒤 다음 카탈로그가 올 때까지는 레코드가 없어 막을 것도 없다(레코드 없는 책상은 기본 책상으로 그린다). */
function clearCatalogShare(){
  commissionMod.savedItems().filter(p=>p.fromCatalog).forEach(p=>{ delete customItems()[p.id]; });
  commissionMod.setSavedItems(commissionMod.savedItems().filter(p=>!p.fromCatalog));
  commissionMod.setSavedDesks(commissionMod.savedDesks().filter(p=>!p.fromCatalog));
  premiumMod.setSavedParts(premiumMod.savedParts().filter(p=>!p.fromCatalog));
}
/* 첫 화면 뒤 한 번(app-boot LATER catalogGlb) — 카탈로그 GLB 를 서버에서 다 받아 영구 캐시에 두고(꾸미기 · 만들기 · 방에서 바로 보이게),
   새로 채운 것이 있는 종류만 같은 한 벌로 다시 합친다(아이템 등록 · 좌석 책상 · 붙지 못한 파츠). 못 받은 것은 그릴 때 다시 받는다 */
async function fillGlb(){
  for(const kind of ['items', 'desks', 'parts']){
    const obj = lastObj[kind];
    if(!obj) continue;
    const added = await catalogGlbMod.resolveCatalogGlbAll(obj, false);
    if(!added || lastObj[kind] !== obj) continue;   // 그 사이 새 한 벌이 왔으면 그쪽 합치기가 이미 돌았다
    if(kind === 'items') await mergeCatalogIntoSavedItems(obj);
    else if(kind === 'desks') mergeCatalogIntoSavedDesks(obj);
    else mergeCatalogIntoSavedParts(obj);
  }
}
/* 로그인 세션이 시작될 때 한 번(launcher/app-boot.js STEPS 'catalog') — 다섯 구독을 세션에 맡긴다. 세션이 끝나면 풀리고, 마지막이 풀리면 catalog-api 가 받은 값을 비운다. */
function start(session){
  session.on(subscribeCatalogItems());
  session.on(subscribeCatalogDesks());
  session.on(subscribeCatalogParts());
  session.on(subscribeCategories());
  session.on(subscribeUnlocks());
  session.onReset(clearCatalogShare);
  session.onReset(()=>{ lastObj.items = lastObj.desks = lastObj.parts = null; });
}

return {
  fillGlb,
  start,
};
}

const api = { createCatalogSync };
if(typeof window !== 'undefined') window.TwCatalogSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
