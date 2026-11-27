/* asset-import.js — 📥 코드로 추가하기: 판매자가 준 암호 코드를 풀어 책상 · 아이템 · 파츠를 이 기기에 넣는다(생성기 · 꾸미기 안에서)
   app.js «책상·아이템 코드: 가져오기(생성기 안에서)» 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다
   (바뀐 줄은 읽는 함수 자리 13줄 · 꾸미기 다시 그리기를 구독으로 · 입구 가드).
   ・책임: 창 열기(openAssetImport — 어느 버튼으로 열었는지 = 넣을 종류) · [추가] — 복호화 → 1MB · 개수 한도 → (생성기에 바로 실리는 책상 · 아이템이면) 캐릭터 용량 →
     종류별 등록(책상은 바로 끼우기 · 아이템은 등록하고 장착 · 파츠는 이 기기 꾸미기 통). 카탈로그(Firebase)에는 올리지 않는다.
   ・받는 deps 18 — 값 crState(_assetImpKind · _assetImpCat · cBase · cDesk · cDeskScale …) · premiumMod · 함수 8 · 읽는 함수 8(뒤에서 만들어지는 모듈 · 다시 대입되는 값).
   ・내놓는 것: openAssetImport(kind, cat) · onPartAdded(fn) — 파츠를 넣은 뒤 부를 곳(app.js 가 꾸미기 다시 그리기를 잇는다 · 꾸미기가 이 창을 열기도 해서 deps 대신 구독).
   ・입구 전제: 창 요소(#assetImpOverlay · #assetImpGo · #assetImpCancel)가 있어야 버튼을 걸고 연다 — 없으면 아무것도 안 한다.
   ⚠️ document · window.crypto 는 전역 이름 그대로. 전역 이름은 TwAssetImport(Tw 접두사 #103).
   검사: checks/sim-asset-import.js */
(function(){

function createAssetImport(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 꾸미기 · 생성기 배치 버튼이 이 창을 이름으로 연다(꾸미기 ↔ 이 모듈 순환을 안 만든다)
const DEF_SIZE_TOAST_MS = deps.DEF_SIZE_TOAST_MS;   // 읽는 함수
const _creatorBuildDef = deps._creatorBuildDef;
const _defSizeFile = deps._defSizeFile;
const applyDeskColorToCustom = deps.applyDeskColorToCustom;
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const codeCryptoMod = deps.codeCryptoMod;   // 읽는 함수
const commissionMod = deps.commissionMod;   // 읽는 함수
const crState = deps.crState;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const deskItemsMod = deps.deskItemsMod;   // 읽는 함수
const equipDeskItem = deps.equipDeskItem;
const partSceneMod = deps.partSceneMod;   // 읽는 함수
const premiumMod = deps.premiumMod;
const renderCrItems = deps.renderCrItems;
const setCreatorDeskScale = deps.setCreatorDeskScale;
const swapDeskVisual = deps.swapDeskVisual;
const toast = deps.toast;
/* 파츠를 넣은 뒤 꾸미기 창을 다시 그릴 곳 — 꾸미기(wardrobe)가 이 창을 열기도 해서 deps 로 받으면 둘이 서로를 부른다(sim-dep-cycles).
   app.js 가 만드는 줄 바로 뒤에서 구독으로 잇는다. */
const _partAddedFns = [];
function onPartAdded(fn){ if(fn) _partAddedFns.push(fn); }
const assetImpOverlay=document.getElementById('assetImpOverlay');
function openAssetImport(kind, cat){ if(!assetImpOverlay) return;   // 입구 전제 — 창이 있어야 연다
  crState._assetImpKind=kind; crState._assetImpCat=cat||null;
  const label = kind==='desk'?'책상' : kind==='part'?((premiumMod.partCatInfo(cat)&&premiumMod.partCatInfo(cat).label)||'파츠') : '아이템';
  document.getElementById('assetImpTitle').textContent=label+' 코드로 추가하기';
  document.getElementById('assetImpCode').value=''; document.getElementById('assetImpPass').value=''; assetImpOverlay.classList.add('on'); }
/* 입구 전제 — 만들 때 버튼을 건다. 예전엔 app.js 부팅 흐름이 «창이 있다» 를 말없이 보장했다(없으면 부팅이 섰다). */
if(assetImpOverlay && document.getElementById('assetImpCancel') && document.getElementById('assetImpGo')){
document.getElementById('assetImpCancel').onclick=()=>assetImpOverlay.classList.remove('on');
document.getElementById('assetImpGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  const code=document.getElementById('assetImpCode').value, pass=document.getElementById('assetImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  try{ const dec=await assetCodeMod().decryptAssetCode(code,pass); const u=assetCodeMod().unwrapAsset(dec.buf);
    if(u.glbBuf.byteLength>commissionMod().MAX_GLB_BYTES){ toast('GLB가 1MB를 넘어요'); return; }
    const kind = crState._assetImpKind;   // 코드 자체에 담긴 종류가 아니라, 사용자가 어느 버튼(책상/아이템/파츠)으로 열었는지를 기준으로 등록
    // 한도 검사: 같은 종류의 저장 배열 길이 확인
    // ★ 파츠는 꾸미기 통만 센다 — 코드로 받는 커미션 파츠는 언제나 비(非)가챠라, 관리자가 등록해둔
    //   가챠 파츠 때문에 유저의 코드 추가가 막히면 안 된다(등록 쪽과 같은 이유).
    const arr = (kind==='desk') ? commissionMod().savedDesks() : (kind==='part') ? premiumMod.partsInCatFor(crState._assetImpCat, false) : commissionMod().savedItems();
    const _maxAssets = (kind==='desk') ? commissionMod().MAX_CUSTOM_ASSETS : (kind==='part') ? premiumMod.MAX_PARTS_PER_CAT : commissionMod().MAX_CUSTOM_ITEMS;
    if(arr.length>=_maxAssets){ toast('최대 '+_maxAssets+'개까지 추가할 수 있어요. 카드의 X로 지운 뒤 다시 시도해 주세요'); return; }
    const glbB64=codeCryptoMod()._b64(u.glbBuf);
    /* 📦 넣자마자 이 캐릭터에 실리는 것(책상 · 아이템)은 파일 하나로 남은 용량을 넘으면 받지 않는다.
       책상은 지금 책상 자리를 비운 나머지와 견준다(바꿔 끼우는 것이라). 파츠는 def 에 GLB 가 안 실린다. */
    if(creatorOpen() && crState.cBase && (kind==='desk' || kind==='item')){
      const _rest = _creatorBuildDef(true);
      if(kind==='desk'){ delete _rest.deskGlb; delete _rest.deskCatalogId; }
      const _add = (kind==='desk' ? DefSize.jsonBytes(glbB64) + 12 : DefSize.jsonBytes({ name: u.name, glb: glbB64 }) + 20);
      const _sz = _defSizeFile(_rest, _add);
      if(!_sz.ok){ toast(_sz.message, null, DEF_SIZE_TOAST_MS()); return; }
    }
    const {scene, animations}=await assetCodeMod().parseGlbFull(u.glbBuf.slice(0));
    const id='c'+Date.now().toString(36);
    const rec={id, name:u.name, icon:u.icon||'', glb:glbB64};
    if(kind==='desk'){
      commissionMod().savedDesks().push(rec); commissionMod().persistSavedAssets();
      // 즉시 활성 책상으로 swap (사용자 의도 — 방금 추가한 책상은 바로 보이도록)
      // ★ 크기(cDeskScale)는 건드리지 않음 — 이전에 슬라이더로 맞춰둔 값을 그대로 유지(고정값으로 리셋하면 매번 슬라이더가 튀어 보임)
      crState.cDeskTemplate=scene; crState.cDeskGlbB64=glbB64;
      if(crState.cDesk){ swapDeskVisual(crState.cDesk,scene); setCreatorDeskScale(crState.cDeskScale); applyDeskColorToCustom(crState.cDesk,crState.cDeskColor); }
      crState.activeCustomDeskId=id;
      toast('책상을 추가했어요');
      renderCrItems();
    } else if(kind==='part'){
      // ★ 관리자 등록(admin)과 달리 카탈로그(Firebase)에는 절대 안 올림 — 이 기기(로컬)에만 저장됨.
      rec.cat = crState._assetImpCat; rec.order = premiumMod.partsInCat(crState._assetImpCat).length;
      premiumMod.savedParts().push(rec); premiumMod.persistSavedParts();
      partSceneMod().partSceneCache.delete(id);   // 혹시 모를 캐시 충돌 방지
      toast('파츠를 추가했어요(이 기기에만 저장됨)');
      _partAddedFns.forEach((f)=>f());   // 꾸미기 창 다시 그리기(app.js 구독)
    } else {
      commissionMod().savedItems().push(rec); commissionMod().persistSavedAssets();
      deskItemsMod().registerCustomItem(id,u.name,glbB64,scene,u.icon||'',animations);
      if(crState.cBase&&crState.cBase.deskAnchor) equipDeskItem(crState.cBase,customItems()[id],true);
      toast('아이템을 추가했어요');
      renderCrItems();
    }
    assetImpOverlay.classList.remove('on');
  }catch(e){ toast('추가 실패: 코드나 비밀번호를 확인해 주세요'); } };
}

twNav.on(twNav.NAV.ASSET_IMPORT, openAssetImport);

return {
  onPartAdded,
  openAssetImport,
};
}

const api = { createAssetImport };
if(typeof window !== 'undefined') window.TwAssetImport = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
