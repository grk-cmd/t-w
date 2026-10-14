/* premium-assets.js — 🎀 캐릭터 꾸미기 파츠(프리미엄) · 🪑 라이선스 전용 책상(꾸미기 «책상» 탭) · 라이선스 없는 기기의 전용 자산 접기
   app.js «캐릭터 꾸미기 파츠 (프리미엄)» · «라이선스 전용 책상을 꾸미기창 «책상» 탭으로» · «라이선스 없는 기기에 남은 전용 자산을 접어 둔다» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 37번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 18줄 —
     DESK_SCALE_DEFAULT · DESK_SCALE_MAX · DESK_SCALE_MIN · Presence · cBase · gachaMod · isAdmin · isPremium · savedDesks · savedItems · slots 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 16개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DESK_LICENSE_HOLD · ITEM_LICENSE_HOLD · MAX_GACHA_PARTS_PER_CAT · MAX_PARTS_PER_CAT · PART_CATS · PART_GROUPS · WD_DESK_TAB · _licenseLockedDeskId · _normPartRec · _wdLicenseDesks · addEntryToCat · addPartEntryInstance · catEquippedIds · customPartCats · defaultPartXf · entriesForCat · findEntryById · firstEntryForCat · getRecHides · groupOfCat · isDeskPartCat · loadSavedParts · partAttachTarget · partCatInfo · partCatLimit · partCatOverrides · partEntryId · partEntryInstanceCount · partEntryInstances · partEntryXf · partsInCat · partsInCatFor · partsInGroup · persistSavedParts · pruneUnownedLicenseAssets · rebuildPartCats · removeEntryFromCat · removePartEntryInstance · renderWdDeskSection · reorderSavedPart · restoreLicenseHeldAssets · savedParts · setPartEntryInstanceXf · toHidesForSave · wdEar — app.js 는 premiumMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPremiumAssets — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-premium-assets.js */
(function(){

function createPremiumAssets(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;   // 읽는 함수
const DESK_SCALE_MAX = deps.DESK_SCALE_MAX;   // 읽는 함수
const DESK_SCALE_MIN = deps.DESK_SCALE_MIN;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const _humanEarMat = deps._humanEarMat;
const _humanEarPic = deps._humanEarPic;
const applyDeskCatalogRefToSeat = deps.applyDeskCatalogRefToSeat;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const applyDeskDotThumb = deps.applyDeskDotThumb;
const cBase = deps.cBase;   // 읽는 함수
const clampDeskScale = deps.clampDeskScale;
const deskItemDef = deps.deskItemDef;
const deskPartAnchorOf = deps.deskPartAnchorOf;
const equipDeskItem = deps.equipDeskItem;
const findMySeat = deps.findMySeat;
const gachaMod = deps.gachaMod;   // 읽는 함수
const humanEar = deps.humanEar;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const openAssetImport = deps.openAssetImport;
const partPaintMod = deps.partPaintMod;
const resolveCatalogGlb = deps.resolveCatalogGlb;
const saveSlots = deps.saveSlots;
const savedDesks = deps.savedDesks;   // 읽는 함수
const savedItems = deps.savedItems;   // 읽는 함수
const seats = deps.seats;
const setDeskScale = deps.setDeskScale;
const slots = deps.slots;   // 읽는 함수
const swThumb = deps.swThumb;
const toast = deps.toast;
const wardrobeMod = deps.wardrobeMod;
const WD_DESK_TAB = '__desk_model__';
/* 🐾 «귀» 도 가상 탭이다 — 위와 같은 이유로 PART_CATS 에 안 넣는다(wd-ear.js 머리말). */
/* 모듈이 없으면 탭이 안 보이는 빈 껍데기 — 호출하는 곳마다 null 을 묻지 않게 */
const WD_EAR_OFF = { TAB:'__ear__', available:()=>false, isActive:()=>false, render(){}, syncGizmo(){}, hideRow:()=>false,
  onGizmoChange(){}, scaleStep:()=>false, pickAt:()=>false, onEarAttached(){}, copyIntoDraft(){}, commit:()=>false,
  picTarget:()=>null, setPic(){} };
const wdEar = (typeof WdEar === 'undefined' || !humanEar) ? WD_EAR_OFF : WdEar.createWdEar({
  humanEar, HumanEar, doc:document,
  getTab:()=>wardrobeMod.currentWdTab(),
  getDraft:()=>wardrobeMod.ensureWdDraft(),
  getPreviewRoot:()=>(wardrobeMod.wdPreviewBase() && wardrobeMod.wdPreviewBase().root) || null,
  getGizmo:()=>{ wardrobeMod.ensureWdGizmo(); return wardrobeMod.wdGizmo(); },
  setGizmoMode:()=>wardrobeMod.setWdGizmoMode(wardrobeMod.wdGizmoMode()),
  earTypes:()=>window.ANIMAL_EAR_TYPES || [],
  material:_humanEarMat,
  decorate:(w)=>_humanEarPic(w, wardrobeMod.ensureWdDraft()),
  isDrawing:()=>partPaintMod._wdPic.on,
  onSynced:()=>{ try{ partPaintMod.refreshWdPicUI(); }catch(_){} },
  toast:(m)=>{ if(typeof toast==='function') toast(m); },
  rerender:()=>wardrobeMod.renderWardrobe(),
});
function _wdLicenseDesks(){
  let list = null; try{ list = savedDesks(); }catch(_){ return []; }
  if(!list || !list.length) return [];
  return list.filter(d => d && d.licenseOnly && d.id !== DEFAULT_DESK_OVERRIDE_ID);
}
/* 책상 값을 내 캐릭터에 쓰고 화면·저장·전파까지 한 번에 — 카드와 슬라이더가 같이 쓴다. */
function _wdApplyDeskChange(mutate){
  const seat = (typeof findMySeat==='function') ? findMySeat() : null;
  if(!seat || !seat.charDef) return null;
  const def = seat.charDef;
  mutate(def);
  try{
    if(def.deskCatalogId) applyDeskCatalogRefToSeat(seat, def);
    else applyDeskCatalogRefToSeat(seat, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:def.deskScale, deskLenX:def.deskLenX, deskColor:def.deskColor});
  }catch(_){}
  try{ if(seat.desk){ setDeskScale(seat.desk, def.deskScale||DESK_SCALE_DEFAULT(), def.deskLenX||1); if(def.deskColor) applyDeskColorToCustom(seat.desk, def.deskColor); } }catch(_){}
  // 미리보기는 draft 를 본다 — 같은 값을 적어 주지 않으면 창 안에서만 옛 책상이 남는다
  try{ if(wardrobeMod.wdDraftDef() && wardrobeMod.wdDraftDef()._srcDef === def){ wardrobeMod.wdDraftDef().deskCatalogId=def.deskCatalogId; wardrobeMod.wdDraftDef().deskScale=def.deskScale; wardrobeMod.wdDraftDef().deskLenX=def.deskLenX; wardrobeMod.wdDraftDef().deskColor=def.deskColor; wardrobeMod.wdDraftDef()[DESK_LICENSE_HOLD]=def[DESK_LICENSE_HOLD]; } }catch(_){}
  try{ if(typeof saveSlots==='function') saveSlots(); }catch(_){}
  try{ if(seat.isMe && typeof Presence()!=='undefined' && Presence().active()) Presence().updateDef(def); }catch(_){}
  try{ if(typeof wardrobeMod.refreshWdPreviewChar==='function') wardrobeMod.refreshWdPreviewChar(); }catch(_){}
  return def;
}
function renderWdDeskSection(wrap){
  const seat = (typeof findMySeat==='function') ? findMySeat() : null;
  const def  = seat && seat.charDef;
  if(!def){
    wrap.innerHTML='<div class="wd-empty"><span class="ic">🪑</span>캐릭터를 먼저 실행해 주세요.</div>';
    return;
  }
  const list = _wdLicenseDesks();
  const sec=document.createElement('div'); sec.className='wd-cat';
  const head=document.createElement('div'); head.className='wd-cat-head';
  head.innerHTML='<h3>🪑 라이선스 전용 책상</h3>';
  const actions=document.createElement('div'); actions.className='wd-cat-head-actions';
  const addCode=document.createElement('button'); addCode.className='wd-add-code'; addCode.textContent='+ 코드로 추가';
  addCode.title='코드+비밀번호로 받은 책상을 이 기기에만 추가해요';
  addCode.onclick=()=>{ if(typeof openAssetImport==='function') openAssetImport('desk'); };
  actions.appendChild(addCode); head.appendChild(actions); sec.appendChild(head);

  const grid=document.createElement('div'); grid.className='wd-grid';
  /* «쓰지 않음» — 전용 책상을 벗고 기본으로 돌아가는 길. 이 칸이 없으면 한 번 고른 사람이 갇힌다. */
  const none=swThumb('기본 책상', !def.deskCatalogId, '↺');
  none.classList.add('none-card');
  none.onclick=()=>{ _wdApplyDeskChange(d=>{ d.deskCatalogId=null; d.deskGlb=null; }); wardrobeMod.renderWardrobe(); };
  grid.appendChild(none);
  list.forEach(rec=>{
    const on=(def.deskCatalogId===rec.id);
    const card=swThumb(rec.name||'책상', on, rec.icon||'🪑');
    if(typeof applyDeskDotThumb==='function') applyDeskDotThumb(rec, card);
    card.onclick=async()=>{
      if(def.deskCatalogId===rec.id) return;
      if(!rec.glb && rec.glbUrl && typeof resolveCatalogGlb==='function'){
        try{ await resolveCatalogGlb(rec); }catch(_){}
      }
      if(!rec.glb){ toast('책상 GLB를 불러올 수 없어요 (네트워크 확인)'); return; }
      _wdApplyDeskChange(d=>{ d.deskCatalogId=rec.id; d.deskGlb=null; });
      wardrobeMod.renderWardrobe();
    };
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  if(!list.length){
    const empty=document.createElement('div'); empty.className='wd-empty';
    empty.innerHTML='<span class="ic">🪑</span>아직 등록된 전용 책상이 없어요.';
    sec.appendChild(empty);
  }

  /* 기본·무료 책상이 어디 있는지 한 줄로 알려 준다 — 옮긴 뒤 «무료 책상이 사라졌다» 가 되지 않도록. */
  const hint=document.createElement('p');
  hint.style.cssText='margin:10px 0 0;padding:7px 9px;font-size:10.5px;line-height:1.7;color:var(--ink-soft);background:var(--win-face-2);border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);';
  hint.innerHTML='기본 책상과 무료 책상은 <b>캐릭터 만들기 › 5단계 책상</b>에서 고를 수 있어요.';
  sec.appendChild(hint);

  /* 조절 — 색·크기·길이. 위치(기즈모)는 5단계에 남긴다: 앞뒤·높이·좌우가 서로 물려 있어서
     기즈모가 필요하고, 그것은 생성기 미리보기 카메라와 한 벌이다. */
  const adjHead=document.createElement('div'); adjHead.className='wd-divider';
  adjHead.innerHTML='<span>책상 조절</span><span class="wd-divider-line"></span>';
  sec.appendChild(adjHead);
  const box=document.createElement('div');
  box.style.cssText='display:flex;flex-direction:column;gap:7px;padding:8px;background:var(--win-face-2);border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);';

  const rowColor=document.createElement('div'); rowColor.style.cssText='display:flex;align-items:center;gap:8px;';
  const labColor=document.createElement('label'); labColor.htmlFor='wdDeskColor'; labColor.textContent='책상 색';
  labColor.style.cssText='font-size:11px;width:56px;flex-shrink:0;';
  const inColor=document.createElement('input'); inColor.type='color'; inColor.id='wdDeskColor';
  inColor.value=def.deskColor||'#c9a36a';
  inColor.style.cssText='width:46px;height:22px;padding:0;cursor:pointer;';
  inColor.oninput=()=>{ _wdApplyDeskChange(d=>{ d.deskColor=inColor.value; }); };
  rowColor.appendChild(labColor); rowColor.appendChild(inColor); box.appendChild(rowColor);

  const mkRange=(id,label,min,max,step,val,apply)=>{
    const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;';
    const lab=document.createElement('label'); lab.htmlFor=id; lab.textContent=label;
    lab.style.cssText='font-size:11px;width:56px;flex-shrink:0;';
    const inp=document.createElement('input'); inp.type='range'; inp.id=id;
    inp.min=min; inp.max=max; inp.step=step; inp.value=val;
    inp.style.cssText='flex:1;min-width:0;';
    inp.oninput=()=>apply(parseFloat(inp.value));
    row.appendChild(lab); row.appendChild(inp); box.appendChild(row);
  };
  mkRange('wdDeskScale','책상 크기',DESK_SCALE_MIN(),DESK_SCALE_MAX(),0.01, def.deskScale||DESK_SCALE_DEFAULT(),
    v=>{ _wdApplyDeskChange(d=>{ d.deskScale=clampDeskScale(v); }); });
  mkRange('wdDeskLenX','책상 길이',0.5,2,0.05, def.deskLenX||1,
    v=>{ _wdApplyDeskChange(d=>{ d.deskLenX=v; }); });

  const posHint=document.createElement('p');
  posHint.style.cssText='margin:0;font-size:10px;line-height:1.6;color:var(--ink-soft);';
  posHint.textContent='책상 위치는 캐릭터 만들기 5단계의 기즈모에서 맞춰요.';
  box.appendChild(posHint);
  sec.appendChild(box);
  wrap.appendChild(sec);
}

const DESK_LICENSE_HOLD = 'deskLicenseHold';
const ITEM_LICENSE_HOLD = 'deskItemsLicenseHold';
/* 카탈로그 조회 — savedDesks·savedItems 는 이 줄보다 아래에서 let 으로 선언된다(TDZ).
   부팅 중 initLicense 가 _setPremium 을 부르는 순간에는 아직 그 줄에 닿지 않았을 수 있으므로
   typeof 가 아니라 try 로 감싼다(TDZ 의 let 에 typeof 를 쓰면 그대로 ReferenceError 다). */
function _licenseLockedDeskId(id){
  if(!id) return false;
  let list = null; try{ list = savedDesks(); }catch(_){ return false; }
  if(!list || !list.length) return false;
  const rec = list.find(d => d.id === id);
  return !!(rec && rec.licenseOnly);
}
function _licenseLockedItemId(id){
  if(!id) return false;
  let list = null; try{ list = savedItems(); }catch(_){ return false; }
  if(!list || !list.length) return false;
  const rec = list.find(s => s.id === id);
  return !!(rec && rec.licenseOnly);
}
function pruneUnownedLicenseAssets(){
  /* ★ 전제 검사는 **호출부가 아니라 여기** 있어야 한다 — pruneUnownedGachaParts 와 같은 이유다.
     호출 지점이 여럿이고(라이선스 변경 · 카탈로그 도착 · 코드 불러오기 · 슬롯 복원 · 프리셋),
     그때마다 같은 조건을 복사하면 언젠가 하나를 빠뜨린다. */
  if(typeof isPremium() !== 'undefined' && isPremium()) return 0;
  if(typeof isAdmin() !== 'undefined' && isAdmin()) return 0;
  let _desks = null; try{ _desks = savedDesks(); }catch(_){ return 0; }
  let _items = null; try{ _items = savedItems(); }catch(_){ return 0; }
  if(!(_desks && _desks.length) && !(_items && _items.length)) return 0;   // 카탈로그 미도착 = 판정 불가
  /* def 에서만 옮긴다. 화면 정리는 좌석을 아는 아래 순회가 반환값을 받아서 한다. */
  const _holdDef = def => {
    const hit = { desk:false, items:[] };
    if(!def) return hit;
    if(def.deskCatalogId && _licenseLockedDeskId(def.deskCatalogId)){
      def[DESK_LICENSE_HOLD] = def.deskCatalogId;
      def.deskCatalogId = null;
      hit.desk = true;
    }
    if(def.deskItems){
      Object.keys(def.deskItems).forEach(id => {
        if(!_licenseLockedItemId(id)) return;
        if(!def[ITEM_LICENSE_HOLD]) def[ITEM_LICENSE_HOLD] = {};
        def[ITEM_LICENSE_HOLD][id] = def.deskItems[id];
        delete def.deskItems[id];
        hit.items.push(id);
      });
      // 전부 빠졌으면 null — collectDeskItems 가 「아무것도 없음」을 null 로 적는 것과 같은 모양
      if(!Object.keys(def.deskItems).length) def.deskItems = null;
    }
    return hit;
  };
  let n = 0;
  /* 1) 내 좌석 — def 를 접고 그 자리에서 화면도 기본으로 되돌린다.
        ⚠️ 남의 좌석(remote)은 건드리지 않는다. 되돌리면 「보유자 친구의 책상이 내 화면에서만
           기본으로 보인다」는 옛 제보가 되살아난다. */
  try{
    seats.forEach(s => {
      if(!s || s.remote || !s.charDef) return;
      const hit = _holdDef(s.charDef);
      if(!hit.desk && !hit.items.length) return;
      n += (hit.desk ? 1 : 0) + hit.items.length;
      if(hit.desk && typeof applyDeskCatalogRefToSeat === 'function'){
        applyDeskCatalogRefToSeat(s, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:s.charDef.deskScale, deskLenX:s.charDef.deskLenX, deskColor:s.charDef.deskColor});
      }
      hit.items.forEach(id => {
        const d = (typeof deskItemDef === 'function') ? deskItemDef(id) : null;
        if(d && typeof equipDeskItem === 'function') equipDeskItem(s, d, false);
      });
    });
  }catch(e){ console.warn('[라이선스] 좌석 정리 실패', e); }
  /* 2) 저장 슬롯 — 지금 앉아 있지 않은 캐릭터는 위 순회가 못 본다.
        앉아 있는 캐릭터는 seat.charDef === slots[i] 로 같은 객체지만 _holdDef 는 멱등이라 안전하다. */
  try{ slots().forEach(d => { const h = _holdDef(d); n += (h.desk?1:0) + h.items.length; }); }
  catch(e){ console.warn('[라이선스] 슬롯 정리 실패', e); }
  // 3) 생성기가 열려 있으면 그 초안도 — 안 그러면 완료를 누를 때 crDone 이 되살린다
  try{ if(typeof cBase() !== 'undefined' && cBase() && cBase().charDef){ const h = _holdDef(cBase().charDef); n += (h.desk?1:0) + h.items.length; } }catch(_){}
  if(!n) return 0;
  try{ if(typeof saveSlots === 'function') saveSlots(); }catch(_){}
  // 방에 있으면 즉시 다시 내보낸다 — 이 한 줄이 친구 화면에서 사라지게 하는 자리다
  try{
    const me = (typeof findMySeat === 'function') ? findMySeat() : null;
    if(me && typeof Presence() !== 'undefined' && Presence().active()) Presence().updateDef(me.charDef);
  }catch(_){}
  console.warn('[라이선스] 전용 자산 ' + n + '개를 접어 뒀습니다 — 라이선스를 등록하면 그대로 돌아옵니다');
  return n;
}
/* 접어 뒀던 것을 되돌린다 — 라이선스가 켜지는 모든 통로가 _setPremium 하나를 지나므로 여기 한 곳이면 된다. */
function restoreLicenseHeldAssets(){
  const _ok = (typeof isPremium() !== 'undefined' && isPremium()) || (typeof isAdmin() !== 'undefined' && isAdmin());
  if(!_ok) return 0;
  const _restoreDef = def => {
    let k = 0;
    if(!def) return 0;
    if(def[DESK_LICENSE_HOLD]){ def.deskCatalogId = def[DESK_LICENSE_HOLD]; delete def[DESK_LICENSE_HOLD]; k++; }
    if(def[ITEM_LICENSE_HOLD]){
      if(!def.deskItems) def.deskItems = {};
      Object.keys(def[ITEM_LICENSE_HOLD]).forEach(id => { def.deskItems[id] = def[ITEM_LICENSE_HOLD][id]; k++; });
      delete def[ITEM_LICENSE_HOLD];
    }
    return k;
  };
  let n = 0;
  try{ seats.forEach(s => { if(s && !s.remote && s.charDef) n += _restoreDef(s.charDef); }); }catch(_){}
  try{ slots().forEach(d => { n += _restoreDef(d); }); }catch(_){}
  try{ if(typeof cBase() !== 'undefined' && cBase() && cBase().charDef) n += _restoreDef(cBase().charDef); }catch(_){}
  if(!n) return 0;
  try{ if(typeof saveSlots === 'function') saveSlots(); }catch(_){}
  console.warn('[라이선스] 접어 뒀던 전용 자산 ' + n + '개를 되돌렸습니다');
  return n;
}

const SAVED_PARTS_KEY='tw.savedParts';
/* 카테고리당 꾸미기 파츠 상한 — 진열은 3열 그리드지만 #wardrobeContent가 overflow:auto라
   칸이 넘치면 스크롤된다. 즉 이 숫자는 레이아웃 제약이 아니라 순수한 정책값이라 자유롭게 올린다.
   ⚠️ 다만 "+ 코드로 추가"(커미션 파츠)는 GLB를 **localStorage에 base64로 통째로** 넣는다(파츠당 최대 1.3MB).
     관리자 등록분은 Storage에 올라가고 로컬엔 URL만 남아 무해하지만, 코드로 받은 파츠를 이 상한까지
     꽉 채우면 localStorage(약 10MB)가 먼저 터진다 — persistSavedParts의 '저장 공간이 부족해요'가 그 신호다. */
const MAX_PARTS_PER_CAT=30;
/* 🎰 가챠 파츠는 꾸미기 창의 진열 칸을 안 쓴다(보관함 스크롤 목록에만 뜬다) — 그래서 상한이 따로다.
   시즌이 4개라 시즌당 10개꼴. ⚠️ 뽑기 풀이 커지면 특정 파츠가 나올 확률이 그만큼 낮아진다 —
   숫자를 올릴 때는 GACHA_DUPES_FOR_COLOR(색상 해금까지 4개)를 모으는 체감 시간을 같이 볼 것. */
const MAX_GACHA_PARTS_PER_CAT=40;
/* 카테고리 정의: 부착 본 + 라벨 + 폴백 아이콘 */
// ★ Phase 2: 상위 그룹(group) — 4가지 대분류로 서브 카테고리를 묶어서 꾸미기 창을 정리.
//   group: 'head' (모자·탈·안경) / 'cloth' (상의·하의·한벌옷·망토) / 'deco' (날개) / 'hand' (왼손·오른손)
const PART_GROUPS = [
  { group:'head',  label:'머리', icon:'👤' },
  { group:'cloth', label:'옷',   icon:'👕' },
  { group:'deco',  label:'장식', icon:'🪽' },
  { group:'hand',  label:'손',   icon:'✋' },
  /* 🪑 책상 위 — 캐릭터가 아니라 **책상**에 붙는 파츠. 다른 그룹과 결정적으로 다른 점은
     부착 대상이 본이 아니라 seat.deskAnchor 라는 것 하나뿐이고, 나머지(등록·가챠·색상·
     애니메이션·상세조정 기즈모)는 전부 기존 파츠 배관을 그대로 탄다. */
  { group:'desk',  label:'책상', icon:'🪑' },
];
// PART_CATS는 Phase 3에서 BUILTIN_PART_CATS + customPartCats(Firebase)의 병합 결과로 만들어짐 → 아래 참조.
// ★ Phase 3: 관리자가 커스텀 서브카테고리를 추가할 수 있게 하려고 기본 목록을 별도로 두고,
//   런타임에 customPartCats(Firebase에서 동기화)와 병합해서 최종 PART_CATS를 만듦.
//   기본은 built-in 표시(builtin:true) — UI에서 삭제 불가로 처리.
const BUILTIN_PART_CATS = [
  {cat:'hat',     label:'모자',   bone:'head',  icon:'🎩', group:'head',  builtin:true},
  {cat:'mask',    label:'탈',     bone:'head',  icon:'🎭', group:'head',  builtin:true},
  {cat:'glasses', label:'안경',   bone:'head',  icon:'👓', group:'head',  builtin:true},
  {cat:'top',     label:'상의',   bone:'spine', icon:'👕', cloth:'top',       group:'cloth', builtin:true},
  {cat:'bottom',  label:'하의',   bone:'spine', icon:'👖', cloth:'bottom',    group:'cloth', builtin:true},
  {cat:'onepiece',label:'한벌옷', bone:'spine', icon:'👗', cloth:'onepiece',  group:'cloth', builtin:true},
  {cat:'cape',    label:'망토',   bone:'spine', icon:'🧣',                    group:'cloth', builtin:true},
  {cat:'wing',    label:'날개',   bone:'spine', icon:'🪽',                    group:'deco',  builtin:true},
  {cat:'handL',   label:'왼손',   bone:'handL', icon:'🤚',                    group:'hand',  builtin:true},
  {cat:'handR',   label:'오른손', bone:'handR', icon:'✋',                    group:'hand',  builtin:true},
  /* 🪑 책상 위 아이템 — bone:'desk' 가 표식이다(진짜 본 이름이 아니라 예약어).
     partAttachTarget() 이 이 값을 보고 seat.bones 대신 seat.deskAnchor 를 돌려준다.
     [왜 필요했나] "책상처럼 고정돼서 캐릭터를 드래그해도 안 따라오는" 물건 요청인데,
       파츠는 예외 없이 seat.bones[…] 에 붙어서 캐릭터를 따라간다. 좌석 구조상 desk 와 rig 는
       group 아래 형제라, 붙는 자리만 deskAnchor 로 바꾸면 그것만으로 캐릭터와 독립이 된다. */
  {cat:'deskitem', label:'책상 위', bone:'desk', icon:'🪑',                  group:'desk',  builtin:true},
];
// 그룹별 부착 본 매핑 — 커스텀 카테고리 추가 시 group만 선택해도 bone이 자동 결정됨
const GROUP_TO_BONE = { head:'head', cloth:'spine', deco:'spine', hand:'head', desk:'desk' };   // hand의 경우 UI에서 handL/handR 중 선택
// 커스텀 카테고리 (Firebase catalog/customCats에서 subscribe 후 여기 채워짐)
let customPartCats = [];   // [{cat, label, icon, group, bone}]
// 기본(내장) 카테고리 이름/아이콘 덮어쓰기 — catalog/catOverrides에서 구독. { cat: {label, icon} }
//   예: 관리자가 '망토'를 '겉옷'으로 바꾸면 모든 사용자에게 그 이름으로 보임. cat 식별자와 동작은 그대로.
let partCatOverrides = {};
// 실제 사용될 통합 목록 — BUILTIN + custom 병합.
let PART_CATS = BUILTIN_PART_CATS.slice();
function rebuildPartCats(){
  const _ov = c=>{
    const o = partCatOverrides && partCatOverrides[c.cat];
    if(!o) return c;
    return Object.assign({}, c, {
      label: (o.label!=null && String(o.label).trim()) ? String(o.label) : c.label,
      icon:  (o.icon!=null  && String(o.icon).trim())  ? String(o.icon)  : c.icon,
      renamed: true,
    });
  };
  PART_CATS = BUILTIN_PART_CATS.map(_ov).concat(customPartCats.map(c=>({
    cat: c.cat, label: c.label, icon: c.icon || '🏷️',
    bone: c.bone || GROUP_TO_BONE[c.group] || 'head',
    group: c.group || 'head',
    custom: true,
  })));
}
function partCatInfo(cat){ return PART_CATS.find(c=>c.cat===cat)||null; }
/* 🪑 이 카테고리가 '책상 위'인가 — bone:'desk' 는 본 이름이 아니라 예약어다.
   ⚠️ 캐릭터에 'desk' 라는 본이 생기면 그 본과 여기가 충돌한다. 그럴 일은 없다고 보지만,
      혹시 GLB 에 그런 이름이 들어오면 이 예약어부터 바꿀 것. */
function isDeskPartCat(info){ return !!(info && info.bone === 'desk'); }
/* 파츠 wrapper 를 붙일 자리. 책상 카테고리만 본이 아니라 deskAnchor 로 간다.
   ★ 좌석·생성기 미리보기·꾸미기 미리보기가 전부 deskAnchor 를 갖고 있어야 한다 —
     하나라도 빠지면 그 화면에서만 '부착 본 없음' 으로 조용히 사라진다. */
function partAttachTarget(seat, info){
  if(!seat || !info) return null;
  /* 📌 deskAnchor 자체가 아니라 그 안의 핀에 붙는다 — 핀은 책상 위치 오프셋만 상쇄한다
     (deskPartAnchorOf 주석). 배율·X 스트레치 상쇄는 앵커에서 그대로 물려받으므로
     파츠의 크기와 월드 배율은 예전과 같다. */
  if(isDeskPartCat(info)) return deskPartAnchorOf(seat) || seat.deskAnchor || null;
  return (seat.bones && seat.bones[info.bone]) || null;
}
function partsInGroup(group){ return PART_CATS.filter(c=>c.group===group && !c.animalOnly); }   // 🐾 동물 전용 제외
// 활성 서브카테고리에서 활성 그룹 찾기 (URL 라우팅 없이 상태 유지용)
function groupOfCat(cat){ const info=partCatInfo(cat); return info && info.group; }
/* 파츠 엔트리 — 구버전(문자열 id) ↔ 신버전({id, xf}) 호환 헬퍼 */
function defaultPartXf(){ return {scale:1, pos:[0,0,0], rot:[0,0,0], color:{}}; }
function partEntryId(e){ return (e && typeof e==='object') ? e.id : e; }
// ★ 버그 수정: 예전엔 e.xf가 없으면 매번 새 defaultPartXf 객체를 반환했는데, 그 임시 객체에 색상을
//   저장해도 entry엔 안 붙어서 저장 후 로드 시 색상이 사라졌음. e.xf가 없으면 새로 만들어 e에 붙이는
//   lazy init 방식으로 변경 — 반환된 xf에 값을 넣으면 그대로 entry에 저장됨.
/* ★ 버그 수정(모자 크기 버튼 무반응 + 꾸미기창 재진입 시 크기 리셋):
   equippedParts[cat]은 "entry 하나"일 수도, "entry 여러 개를 담은 컨테이너"(🔗 stackable 배열,
   또는 Firebase가 배열을 저장하며 만든 {0:..,1:..} 숫자키 맵)일 수도 있다.
   호출부가 실수로 컨테이너를 넘겼을 때 아래 lazy init이 컨테이너에 유령 .xf를 만들어 붙였고,
   그 결과 (1) 크기 조절이 아무 파츠에도 반영되지 않고 (2) 숫자키 맵의 경우 entriesForCat의
   "키가 전부 숫자인가" 판정이 깨져 파츠 목록 자체가 무효화 → 다음 진입 때 크기가 초기화됐다.
   컨테이너면 절대 오염시키지 않고 임시 기본값만 돌려준다. */
function isPartEntryContainer(e){
  if(Array.isArray(e)) return true;
  if(!e || typeof e!=='object' || e.id) return false;
  const ks = Object.keys(e).filter(k => k!=='xf' && k!=='instances');
  return ks.length>0 && ks.every(k => /^\d+$/.test(k));
}
function partEntryXf(e){
  if(!e || typeof e!=='object') return defaultPartXf();
  if(isPartEntryContainer(e)) return defaultPartXf();   // ★ 컨테이너엔 xf를 붙이지 않는다
  if(!e.xf) e.xf = defaultPartXf();
  return e.xf;
}
// ★ 런처9: 다중 파츠 인스턴스 지원.
//   entry.instances = [xf1, xf2, ...] (추가 인스턴스만; 인덱스 0은 entry.xf가 담당).
//   partEntryInstances(entry) → [xf0, xf1, ...] 전체 목록 반환 (인덱스 0 포함).
//   ★ 인스턴스 배열의 빈 요소도 lazy init — 위와 같은 이유(임시 객체 저장 방지).
// ★ 버그 수정(다중 파츠가 적용 안 되던 문제):
//   entry.instances는 배열인데, Firebase Realtime DB를 왕복하면 {0:xf, 1:xf} 숫자키 객체로 돌아온다.
//   아래 헬퍼들이 전부 Array.isArray로만 판정해서, 그 순간 인스턴스 개수가 0으로 보이고
//   extra wrapper가 아예 생성되지 않았다(= 개수를 늘려도 기즈모가 붙을 대상이 없음).
//   읽기 전에 한 번 정규화해서 진짜 배열로 되돌린다(in-place라 이후 저장에도 배열로 유지됨).
function normalizePartEntryInstances(e){
  if(!e || typeof e!=='object' || Array.isArray(e)) return null;
  const ins = e.instances;
  if(!ins) return null;
  if(Array.isArray(ins)) return ins;
  if(typeof ins === 'object'){
    const keys = Object.keys(ins).filter(k => /^\d+$/.test(k));
    if(keys.length){
      e.instances = keys.sort((a,b)=>+a-+b).map(k => ins[k]).filter(Boolean);
      return e.instances;
    }
  }
  delete e.instances;   // 알 수 없는 형태는 버림(하위호환)
  return null;
}
function partEntryInstances(e){
  const xf0 = partEntryXf(e);
  if(!e || typeof e!=='object') return [xf0];
  const ins = normalizePartEntryInstances(e);
  if(!ins) return [xf0];
  return [xf0, ...ins.map((x, i)=>{
    if(!x){ e.instances[i] = defaultPartXf(); return e.instances[i]; }
    return x;
  })];
}
function partEntryInstanceCount(e){
  const ins = normalizePartEntryInstances(e);
  return ins ? (1 + ins.length) : 1;
}

// ────────────────────────────────────────────────────────────────────
// 🔗 stackable: 같은 카테고리에 여러 파츠 공존 (rec.stackable=true인 파츠는 다른 파츠와 함께 착용 가능)
//   스키마: def.equippedParts[cat]가 객체 하나(기존) OR 배열(신규 다중)로 둘 다 허용.
//   접근 지점을 이 헬퍼로 감싸서 호출자는 항상 배열로 다룰 수 있음. 하위 호환 안전.
// ────────────────────────────────────────────────────────────────────
function entriesForCat(def, cat){
  if(!def || !def.equippedParts) return [];
  const e = def.equippedParts[cat];
  if(!e) return [];
  if(Array.isArray(e)) return e;
  // 🔗 Firebase Realtime DB는 sparse 배열이나 배열 저장 시 종종 {0:..., 1:...} 객체로 저장.
  //   숫자 키가 있고 id 필드가 없으면 배열이었던 것으로 간주해 복원.
  // ★ 예전엔 every(숫자)를 요구해서, 어딘가 실수로 붙은 xf 키 하나 때문에 판정이 깨지면
  //   파츠 목록 전체가 무효(entry 하나로 오인)가 됐다 — 이미 오염된 저장본도 살아나도록
  //   "숫자 키가 하나라도 있으면" 복원하고 나머지 키는 무시한다(자가 치유).
  if(typeof e === 'object' && !e.id){
    const numKeys = Object.keys(e).filter(k => /^\d+$/.test(k));
    if(numKeys.length){
      return numKeys.sort((a,b)=>+a-+b).map(k => e[k]).filter(v => v && v.id);
    }
  }
  return [e];
}
// 특정 카테고리 첫 번째 entry (기존 단일 파츠 로직 대체용)
function firstEntryForCat(def, cat){ return entriesForCat(def, cat)[0] || null; }
// id로 entry 찾기
function findEntryById(def, cat, id){ return entriesForCat(def, cat).find(e => partEntryId(e) === id) || null; }
// 카테고리에 착용 중인 id 목록
function catEquippedIds(def, cat){ return entriesForCat(def, cat).map(e => partEntryId(e)).filter(Boolean); }

// ────────────────────────────────────────────────────────────────────
// hides 정규화 — Firebase Realtime DB가 빈 배열을 자동 삭제하고, 배열을 종종 {0:x, 1:y} 객체로 저장하는
//   특성 때문에 rec.hides의 원본 형태가 어긋날 수 있음. 이걸 견고하게 처리하는 헬퍼.
//   - 관리자가 명시적으로 빈 hides로 등록한 파츠 vs 옛날 hides 필드가 없던 파츠를 구분해야 함.
//   - 저장 시 빈 배열은 ['__none__'] sentinel로 대체 → Firebase에서도 유지됨.
//   - 로드 시 이 헬퍼가 정규화된 배열을 반환하거나, null(옛 파츠)을 반환.
const HIDES_NONE_SENTINEL = '__none__';
function toHidesForSave(hides){
  return (Array.isArray(hides) && hides.length) ? hides : [HIDES_NONE_SENTINEL];
}
function getRecHides(rec){
  if(!rec) return null;
  let raw = rec.hides;
  // Firebase에서 배열이 {0:x, 1:y}로 저장된 경우 배열로 복원
  if(raw && typeof raw === 'object' && !Array.isArray(raw)){
    const keys = Object.keys(raw);
    if(keys.length && keys.every(k => /^\d+$/.test(k))){
      raw = keys.sort((a,b)=>+a-+b).map(k => raw[k]);
    }
  }
  if(!Array.isArray(raw)) return null;   // 옛 파츠 (hides 필드 자체 없음 → 하위호환 fallback으로 감)
  if(raw.length === 1 && raw[0] === HIDES_NONE_SENTINEL) return [];   // 명시적 "아무것도 안 숨김"
  // 혹시 섞여 있을 경우 sentinel 필터
  return raw.filter(h => h !== HIDES_NONE_SENTINEL);
}
// entry 추가 (stackable) — 이미 있으면 무시(중복 방지)
/* 🧩 {0:..,1:..} 숫자키 맵(Firebase 가 배열을 저장하며 만든 모양)을 진짜 배열로 펴 둔다.
   [왜] 아래 둘은 «배열 아니면 entry 하나» 로만 갈랐다. 숫자키 맵이 오면 add 는 그 맵을 entry 하나로 여겨
     [맵, 새 entry] 로 싸 버리고(맵 안의 모자·리본이 id 없는 덩어리가 되어 안 보인다), remove 는 맵의 .id 가
     없어 **아무것도 안 뺀다.** entriesForCat 은 이미 이 모양을 읽을 줄 안다 — 쓰는 쪽도 같은 눈으로 본다. */
function _flattenCatContainer(def, cat){
  const cur = def && def.equippedParts && def.equippedParts[cat];
  if(cur && !Array.isArray(cur) && isPartEntryContainer(cur)){
    const arr = entriesForCat(def, cat).slice();
    if(arr.length === 0) delete def.equippedParts[cat];
    else def.equippedParts[cat] = (arr.length === 1) ? arr[0] : arr;
  }
}
function addEntryToCat(def, cat, entry){
  def.equippedParts = def.equippedParts || {};
  _flattenCatContainer(def, cat);
  const cur = def.equippedParts[cat];
  const newId = partEntryId(entry);
  if(!cur){ def.equippedParts[cat] = entry; return; }
  if(Array.isArray(cur)){
    if(!cur.find(e => partEntryId(e) === newId)) cur.push(entry);
    return;
  }
  // 기존 단일 → 배열로 승격
  if(partEntryId(cur) !== newId) def.equippedParts[cat] = [cur, entry];
}
// entry 제거 by id
function removeEntryFromCat(def, cat, id){
  if(!def || !def.equippedParts) return;
  _flattenCatContainer(def, cat);
  const cur = def.equippedParts[cat];
  if(!cur) return;
  if(Array.isArray(cur)){
    const idx = cur.findIndex(e => partEntryId(e) === id);
    if(idx >= 0) cur.splice(idx, 1);
    if(cur.length === 0) delete def.equippedParts[cat];
    else if(cur.length === 1) def.equippedParts[cat] = cur[0];   // 하나만 남으면 단일로 축소
    return;
  }
  if(partEntryId(cur) === id) delete def.equippedParts[cat];
}
// 인덱스 idx의 xf를 새 값으로 치환 (idx 0 = entry.xf, idx>=1 = entry.instances[idx-1])
function setPartEntryInstanceXf(e, idx, xf){
  if(!e || typeof e!=='object' || isPartEntryContainer(e)) return;
  if(idx===0){ e.xf = xf; return; }
  normalizePartEntryInstances(e);
  e.instances = Array.isArray(e.instances) ? e.instances : [];
  while(e.instances.length < idx) e.instances.push(defaultPartXf());
  e.instances[idx-1] = xf;
}
function addPartEntryInstance(e){
  if(!e || typeof e!=='object' || isPartEntryContainer(e)) return;
  normalizePartEntryInstances(e);
  e.instances = Array.isArray(e.instances) ? e.instances : [];
  e.instances.push(defaultPartXf());
}
function removePartEntryInstance(e, idx){
  if(!e || typeof e!=='object' || isPartEntryContainer(e)) return;
  const ins = normalizePartEntryInstances(e);
  if(idx===0){
    // 첫 인스턴스는 지울 수 없음 — 대신 두 번째 인스턴스를 첫 자리로 승격
    if(ins && ins.length){ e.xf = ins.shift(); }
    return;
  }
  if(ins && idx-1 < ins.length){ ins.splice(idx-1, 1); }
}
let savedParts=[];   // [{id, cat, name, icon, glb(base64)}]
function loadSavedParts(){
  try{ savedParts=JSON.parse(localStorage.getItem(SAVED_PARTS_KEY)||'[]'); }catch(_){ savedParts=[]; }
  if(Array.isArray(savedParts)) savedParts.forEach(_normPartRec); else savedParts=[];
}
/* 🎰 가챠 파츠는 **항상** 겹쳐 입는다(stackable) — 들어오는 입구 두 곳(로컬 캐시 · 카탈로그)에서 못박는다.
   [제보 2026-09-23] "보관함 모자를 끼웠다 뺐더니 원래 쓰던 기본 모자까지 같이 빠졌다."
   [원인] 등록(신규·수정)은 가챠면 stackable 을 강제한다(파츠 등록 핸들러 주석). 그런데 **그 규칙이 생기기
     전에 올라간 가챠 파츠**는 카탈로그에 stackable:false 로 남아 있고, 여기까지 그대로 들어왔다.
     그러면 toggleEquip 이 그 파츠를 «일반 파츠»로 보고 **같은 칸의 기존 일반 모자를 def 에서 빼고 갈아 끼운다.**
     가챠 모자가 기본 모자를 덮고 있어서 끼울 때는 티가 안 나고, 뺄 때 둘 다 없어진 것으로 보인다.
   ★ 읽는 자리(rec.stackable 을 보는 곳이 열 군데가 넘는다)를 고치지 않고 들어오는 입구에서 값을 맞춘다 —
     등록이 이미 지키는 약속과 같은 값이므로 새 규칙이 아니다. 부팅 때 좌석을 세우기 **전에** 돈다(loadSavedParts).
   ⚠️ 관리자가 그 파츠를 한 번 다시 저장하면 카탈로그 값도 true 로 고쳐진다(buildPartPublishData). */
function _normPartRec(p){ if(p && p.gacha && !p.stackable) p.stackable = true; return p; }
function persistSavedParts(){
  // ★ Storage 이관 후속: base64 glb는 로컬 저장 대상에서 제외 — 용량 폭탄(1MB×N개면 localStorage 5MB 한도 초과) 방지.
  //   glbUrl만 저장하고 실제 GLB는 필요 시점(파츠 렌더/편집)에 Storage에서 fetch. 로컬-전용(fromCatalog=false)은
  //   Storage에 없으므로 base64 그대로 저장(사용자가 직접 추가한 파츠).
  const stripped = savedParts.map(p=>{
    if(p.fromCatalog && p.glbUrl){ const clone={...p}; delete clone.glb; return clone; }
    return p;
  });
  try{ localStorage.setItem(SAVED_PARTS_KEY,JSON.stringify(stripped)); }catch(_){ toast('저장 공간이 부족해요'); }
}
function partsInCat(cat){ return savedParts.filter(p=>p.cat===cat); }
/* 🎰 카테고리 상한은 "꾸미기 창에 진열되는 파츠"의 상한이다.
   [증상] 가챠 파츠를 등록하려는데 "이 카테고리는 최대 12개까지예요"로 막힌다(제보).
   [원인] 상한을 partsInCat(=그 카테고리 전부)으로 셌다. 그런데 가챠 파츠는 renderWardrobe에서
          통째로 걸러져(!isGachaPart) 꾸미기 창에 아예 안 나오고, 파츠 보관함의 **스크롤 목록**에만
          뜬다 — 진열 칸을 하나도 안 쓰는데 칸 수에는 같이 세어졌다. 그래서 모자처럼 꾸미기 파츠가
          이미 찬 카테고리에서는 가챠 파츠를 한 개도 등록할 수 없었고, 반대로 가챠를 몇 개 등록해두면
          그만큼 꾸미기 칸이 줄었다.
   [대응] 두 통을 따로 센다. 세는 기준은 "지금 등록하려는 것이 가챠인가"이므로, 상한 검사보다
          🎰 체크박스를 먼저 읽어야 한다(등록 핸들러 참고).
   ⚠️ order(진열 순서)는 일부러 카테고리 전체 기준 그대로 둔다 — 두 목록 다 order 오름차순으로만
     정렬하므로 값이 계속 커지기만 하면 새 파츠는 자기 통의 맨 끝에 선다. 통마다 따로 매기면
     기존 파츠들과 번호가 겹쳐 순서가 흔들린다. */
function partsInCatFor(cat, gacha){ return partsInCat(cat).filter(p=>!!gachaMod().isGachaPart(p) === !!gacha); }
function partCatLimit(gacha){ return gacha ? MAX_GACHA_PARTS_PER_CAT : MAX_PARTS_PER_CAT; }
/* 관리자 — 같은 카테고리 안에서 드래그로 파츠 진열 순서 변경 (로컬 화면 전용) */
function reorderSavedPart(draggedId, targetId, cat){
  const catItems = savedParts.filter(p=>p.cat===cat);
  const others = savedParts.filter(p=>p.cat!==cat);
  const draggedIdx = catItems.findIndex(p=>p.id===draggedId);
  const targetIdx = catItems.findIndex(p=>p.id===targetId);
  if(draggedIdx<0 || targetIdx<0) return;
  const [item] = catItems.splice(draggedIdx,1);
  catItems.splice(targetIdx,0,item);
  savedParts = [...others, ...catItems];
  // 새 순서를 각 항목의 order 필드로 기록(로컬)
  catItems.forEach((p,i)=>{ p.order=i; });
  persistSavedParts();
  wardrobeMod.renderWardrobe();
  // ★ 카탈로그(Firebase)에 등록된 적 있는 파츠만 순서를 같이 올림 — 순수 로컬 전용 파츠는 카탈로그에
  //   없는 경로라 순서만 써버리면 cat/name/glb 없는 빈 항목이 생겨서 검증에 걸림(의도적으로 제외).
  //   GLB는 다시 안 올리고 order 숫자만 가볍게 업데이트되므로 데이터 사용량 걱정 없음.
  if(window.firebaseAPI && window.firebaseAPI.updatePartsOrder){
    /* 🎰 가챠 파츠는 catalog/gachaParts 에 살므로 순서도 그 경로로 — 한 맵에 섞으면
       catalog/parts/{가챠id}/order 가 .validate 에 걸려 update 전체가 거부된다. */
    const orderMap={}, gachaOrderMap={};
    catItems.forEach((p,i)=>{ if(p.fromCatalog){ (gachaMod().isGachaPart(p)?gachaOrderMap:orderMap)[p.id]=i; } });
    if(Object.keys(orderMap).length || Object.keys(gachaOrderMap).length){
      window.firebaseAPI.updatePartsOrder(orderMap, gachaOrderMap).catch(()=>{ toast('⚠ 순서가 온라인에는 반영 안 됐어요(인터넷 연결 확인) — 이 화면에서만 바뀐 상태예요'); });
    }
  }
}

return {
  DESK_LICENSE_HOLD,
  ITEM_LICENSE_HOLD,
  MAX_GACHA_PARTS_PER_CAT,
  MAX_PARTS_PER_CAT,
  PART_CATS: ()=>PART_CATS,   // 읽는 함수
  PART_GROUPS,
  WD_DESK_TAB,
  _licenseLockedDeskId,
  _normPartRec,
  _wdLicenseDesks,
  addEntryToCat,
  addPartEntryInstance,
  catEquippedIds,
  customPartCats: ()=>customPartCats,   // 읽는 함수
  setCustomPartCats: (v)=>{ customPartCats = v; },   // 쓰는 함수 — app.js 가 비운다
  defaultPartXf,
  entriesForCat,
  findEntryById,
  firstEntryForCat,
  getRecHides,
  groupOfCat,
  isDeskPartCat,
  loadSavedParts,
  partAttachTarget,
  partCatInfo,
  partCatLimit,
  partCatOverrides: ()=>partCatOverrides,   // 읽는 함수
  setPartCatOverrides: (v)=>{ partCatOverrides = v; },   // 쓰는 함수 — app.js 가 비운다
  partEntryId,
  partEntryInstanceCount,
  partEntryInstances,
  partEntryXf,
  partsInCat,
  partsInCatFor,
  partsInGroup,
  persistSavedParts,
  pruneUnownedLicenseAssets,
  rebuildPartCats,
  removeEntryFromCat,
  removePartEntryInstance,
  renderWdDeskSection,
  reorderSavedPart,
  restoreLicenseHeldAssets,
  savedParts: ()=>savedParts,   // 읽는 함수
  setSavedParts: (v)=>{ savedParts = v; },   // 쓰는 함수 — app.js 가 비운다
  setPartEntryInstanceXf,
  toHidesForSave,
  wdEar,
};
}

const api = { createPremiumAssets };
if(typeof window !== 'undefined') window.TwPremiumAssets = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
