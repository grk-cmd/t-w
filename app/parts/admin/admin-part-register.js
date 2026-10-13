/* admin-part-register.js — 🛠️ 파츠 · 책상 · 아이템 등록 창 · 파츠 삭제 (관리자)
   app.js 의 «🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자)» · «🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자)» 두 구역을 그대로 옮긴
   관리자 모듈이다(관리자 코드 admin 폴더 4번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다(구역 사이 빈 줄 하나 · 들여쓰기도 그대로). 바뀐 줄은 30줄뿐이다 —
     값 열세 개(MAX_CUSTOM_ASSETS · MAX_CUSTOM_ITEMS · MAX_GACHA_PARTS_PER_CAT · MAX_GLB_BYTES · MAX_PARTS_PER_CAT · PART_CATS · gachaMod ·
     partSceneCache · savedDesks · savedItems · savedParts · wdGizmo · wdPreviewBase)를 이름() 으로 읽는다. 이 모듈을 만드는 줄보다
     뒤에 선언되거나(const · TDZ) app.js 가 다시 대입하는 let 이라 값이 아니라 읽는 함수로 받는다. 파츠 삭제의 savedParts = … 는 setSavedParts(…).
     자리는 파서(typescript)로 찾아 바꿨다 — 주석 · 글자 · 속성 이름(obj.savedParts 같은)은 건드리지 않았다.
   ★ app.js 함수 스물일곱은 app.js 가 화살표로 넘긴다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름 다섯 — openPartRegister · openDeskRegister · deletePart · buildPartPublishData · syncPartRegGachaLock.
     app.js 는 adminPartReg.이름 으로 부르고, 🎰 gacha.js 에는 예전처럼 deps 로 넘긴다. PART_PUBLISH_FIELDS 는 검사용으로 함께 내놓는다.
   ⚠️ document · window · firebaseAPI · confirm · FileReader · Image · THREE 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminPartRegister — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-part-register.js */
(function(){

function createAdminPartRegister(deps){
const _b64 = deps._b64;
const applyClothVisibility = deps.applyClothVisibility;
const catEquippedIds = deps.catEquippedIds;
const equipPartOnSeat = deps.equipPartOnSeat;
const findEntryById = deps.findEntryById;
const fitModel = deps.fitModel;
const generatePartThumbnail = deps.generatePartThumbnail;
const getPartScene = deps.getPartScene;
const getRecHides = deps.getRecHides;
const parseGlbBytes = deps.parseGlbBytes;
const partCatInfo = deps.partCatInfo;
const partCatLimit = deps.partCatLimit;
const partEntryXf = deps.partEntryXf;
const partsInCat = deps.partsInCat;
const partsInCatFor = deps.partsInCatFor;
const persistSavedParts = deps.persistSavedParts;
const removeEntryFromCat = deps.removeEntryFromCat;
const renderCrItems = deps.renderCrItems;
const renderWardrobe = deps.renderWardrobe;
const resolveCatalogGlb = deps.resolveCatalogGlb;
const saveSlots = deps.saveSlots;
const syncWdGizmoToXf = deps.syncWdGizmoToXf;
const toHidesForSave = deps.toHidesForSave;
const toast = deps.toast;
const unequipPartFromSeat = deps.unequipPartFromSeat;
const unequipStackablePart = deps.unequipStackablePart;
const seats = deps.seats;   // 좌석 배열 — 다시 대입되지 않는 같은 객체
const MAX_CUSTOM_ASSETS = deps.MAX_CUSTOM_ASSETS;   // 읽는 함수
const MAX_CUSTOM_ITEMS = deps.MAX_CUSTOM_ITEMS;   // 읽는 함수
const MAX_GACHA_PARTS_PER_CAT = deps.MAX_GACHA_PARTS_PER_CAT;   // 읽는 함수
const MAX_GLB_BYTES = deps.MAX_GLB_BYTES;   // 읽는 함수
const MAX_PARTS_PER_CAT = deps.MAX_PARTS_PER_CAT;   // 읽는 함수
const PART_CATS = deps.PART_CATS;   // 읽는 함수
const gachaMod = deps.gachaMod;   // 읽는 함수
const partSceneCache = deps.partSceneCache;   // 읽는 함수
const savedDesks = deps.savedDesks;   // 읽는 함수
const savedItems = deps.savedItems;   // 읽는 함수
const savedParts = deps.savedParts;   // 읽는 함수
const wdGizmo = deps.wdGizmo;   // 읽는 함수
const wdPreviewBase = deps.wdPreviewBase;   // 읽는 함수
const setSavedParts = deps.setSavedParts;   // 파츠 삭제가 목록을 바꿔 끼운다
/* 🗂️ 카탈로그 파츠 노드가 담는 필드의 **단일 목록**과 그 페이로드를 만드는 유일한 함수.
   [왜 있는가] `publishPart` 는 set() = **노드 전체 교체**다. 페이로드에 안 실은 필드는
     서버에서 **그냥 사라진다.** 그런데 로컬 rec 는 안 사라지므로 **관리자 화면만 멀쩡하고
     다른 유저에게만 값이 안 가는** 모양이 된다 — 콘솔에도 아무것도 안 남는다.
   [같은 사고가 네 번 났다] stackable(파츠가 '일반'으로 둔갑해 남의 모자를 밀어냄) ·
     animMode · noColor(가챠 중복 수가 4개로 되돌아감) · defaultXf(기본 위치/크기/회전이
     다른 유저에게 안 감) + order(수정하면 목록 맨 뒤로 밀림).
     매번 "이 필드도 실어야 한다"를 손으로 기억하는 방식이라 계속 재발했다.
   ★ 그래서 목록을 한 곳에 두고, 배포하는 자리는 **전부 이 함수만** 쓴다.
     새 필드를 추가할 때 할 일은 두 가지뿐이다: rec 에 넣고, 아래 목록에 이름을 넣는다.
   ⚠️ `sim-publish-fields.js` 가 "rec 에 쓰는 필드 ⊆ 이 목록" 을 소스에서 대조한다.
     목록에 안 넣으면 검사에서 걸린다 — 그게 이 목록의 존재 이유다.
   ⚠️ 값이 없는 필드는 **아예 빼야 한다.** undefined 를 실으면 Firebase 가 쓰기를 거부한다.
     그래서 아래는 "항상 싣는 것"과 "있을 때만 싣는 것"이 나뉜다. */
const PART_PUBLISH_FIELDS = [
  // 항상 싣는다 — 없으면 기본값으로라도 채운다(빠지면 서버에서 그 필드가 사라진다)
  'cat', 'name', 'icon', 'glb', 'glow', 'multi', 'charType', 'hides',
  'standalone', 'stackable', 'animMode', 'gacha', 'season', 'rideTop',
  // 있을 때만 싣는다
  'order', 'noColor', 'defaultXf', 'thumbnail',
];
function buildPartPublishData(rec, override){
  const r = Object.assign({}, rec || {}, override || {});
  const out = {
    cat: r.cat,
    name: r.name,
    icon: r.icon || '',
    glb: r.glb,
    glow: !!r.glow,
    multi: !!r.multi,
    charType: r.charType || 'default',
    hides: toHidesForSave(getRecHides(r) || []),
    standalone: !!r.standalone,
    stackable: !!r.stackable,
    animMode: r.animMode || '',
    gacha: !!r.gacha,          // 🎰 빠지면 가챠 파츠가 꾸미기 창에 그냥 뜬다(뽑기의 의미가 사라진다)
    rideTop: !!r.rideTop,      // 🎩 빠지면 다른 유저에게만 '얹을 수 있음'이 꺼진 채로 간다
    season: r.season || '',    // ''=상시 가챠
  };
  if(r.order != null) out.order = r.order;
  if(r.noColor !== undefined) out.noColor = !!r.noColor;
  if(r.defaultXf) out.defaultXf = r.defaultXf;
  if(r.thumbnail) out.thumbnail = r.thumbnail;
  return out;
}

function deletePart(id){
  const rec=savedParts().find(p=>p.id===id); if(!rec)return;
  setSavedParts(savedParts().filter(p=>p.id!==id));
  persistSavedParts();
  partSceneCache().delete(id);
  // 모든 좌석에서 이 파츠 착용 해제 (배열/단일 모두 대응)
  seats.forEach(s=>{
    if(!s.charDef || !s.charDef.equippedParts) return;
    for(const c of Object.keys(s.charDef.equippedParts)){
      if(catEquippedIds(s.charDef, c).includes(id)){
        removeEntryFromCat(s.charDef, c, id);
        // 좌석에서도 제거 — stackable(배열)이면 이 id만, 아니면 카테고리 전체
        if(s.stackedPartObjs && s.stackedPartObjs[c] && s.stackedPartObjs[c][id]){
          unequipStackablePart(s, c, id);
        }
        // 이 카테고리에 아무것도 안 남으면 통째로 정리
        if(!s.charDef.equippedParts[c]) unequipPartFromSeat(s, c);
      }
    }
    applyClothVisibility(s);
  });
  if(typeof saveSlots==='function') saveSlots();
  // 카탈로그(Firebase)에도 있던 파츠면 거기서도 제거 — 안 그러면 다른 사용자들한텐 계속 남아있음
  if(window.firebaseAPI && window.firebaseAPI.unpublishPart){
    window.firebaseAPI.unpublishPart(id).catch(()=>{});
  }
  renderWardrobe();
}

/* 파츠 등록 모달 (관리자) — editRec이 있으면 기존 파츠 수정, 없으면 신규 등록 */
let _partRegCat=null, _partRegEditId=null;
/* 🎰 가챠를 켜면 🔗 함께 착용을 같이 켜고 잠근다. 저장 쪽에서도 강제하지만(등록 핸들러),
   화면에서 체크가 안 들어오면 관리자가 "안 켜도 되나 보다"로 읽는다 — 눈에 보이게 묶어둔다. */
function syncPartRegGachaLock(){
  const g=document.getElementById('partRegGacha'), s=document.getElementById('partRegStackable');
  if(!g || !s) return;
  if(g.checked){ s.checked = true; s.disabled = true; } else { s.disabled = false; }
  /* 🎰 지금 등록하는 게 가챠 파츠인지를 **제목에서** 보이게 한다.
     [왜] 체크박스 하나가 "꾸미기 창에 나온다 / 안 나온다"를 가르는데, 폼 중간에 묻혀 있어서
       꾸미기 창의 [+ 등록]으로 만든 파츠가 그냥 일반 파츠가 되는 사고가 난다
       (= "가챠를 안 해도 다 쓸 수 있다"로 보이는 그 증상). 제목이면 안 보고 지나칠 수가 없다. */
  const t=document.getElementById('partRegGachaTag');
  if(t) t.style.display = g.checked ? 'inline' : 'none';
}
function openPartRegister(cat, editRec){
  _partRegCat=cat;
  _partRegEditId = editRec ? editRec.id : null;
  const info=partCatInfo(cat);
  const label = info?info.label:'파츠';
  document.getElementById('partRegCatLabel').textContent = editRec ? ('"'+(editRec.name||label)+'" 수정') : (label+' 등록');
  document.getElementById('partRegName').value = editRec ? (editRec.name||'') : '';
  /* 📂 카테고리 셀렉트 — 열 때마다 다시 채운다. 관리자가 추가한 커스텀 카테고리(customPartCats)가
     PART_CATS에 나중에 합류하므로, 한 번 만들고 재사용하면 새 카테고리가 영영 안 뜬다. */
  const _catSel = document.getElementById('partRegCat');
  if(_catSel){
    _catSel.innerHTML = '';
    (typeof PART_CATS()!=='undefined' ? PART_CATS() : []).forEach(c=>{
      const o=document.createElement('option'); o.value=c.cat; o.textContent=(c.icon||'')+' '+c.label;
      _catSel.appendChild(o);
    });
    _catSel.value = (editRec && editRec.cat) || cat;
    if(!_catSel.value) _catSel.value = cat;
    const _hint=document.getElementById('partRegCatMoveHint');
    const _orig=_catSel.value;
    // 옮기는 경우에만 경고를 보여준다 — 등록할 때는 당연한 선택이라 경고가 소음이 된다.
    _catSel.onchange = ()=>{ if(_hint) _hint.style.display = (editRec && _catSel.value!==_orig) ? 'block' : 'none'; };
    if(_hint) _hint.style.display='none';
  }
  document.getElementById('partRegFile').value='';
  const fh=document.getElementById('partRegFileHint'); if(fh) fh.style.display = editRec ? 'block' : 'none';
  const glowChk=document.getElementById('partRegGlow'); if(glowChk) glowChk.checked = !!(editRec && editRec.glow);
  const multiChk=document.getElementById('partRegMulti'); if(multiChk) multiChk.checked = !!(editRec && editRec.multi);
  const standaloneChk=document.getElementById('partRegStandalone'); if(standaloneChk) standaloneChk.checked = !!(editRec && editRec.standalone);
  const stackableChk=document.getElementById('partRegStackable'); if(stackableChk) stackableChk.checked = !!(editRec && editRec.stackable);
  // 🎰 가챠 전용 + 가챠 시즌
  const gachaChk=document.getElementById('partRegGacha'); if(gachaChk) gachaChk.checked = !!(editRec && editRec.gacha);
  const seasonSel=document.getElementById('partRegSeason'); if(seasonSel) seasonSel.value = (editRec && editRec.season) || '';
  syncPartRegGachaLock();   // 가챠면 🔗 를 켜고 잠근 상태로 열린다
  // ▶ 애니메이션 재생 방식 — animMode:'active'면 활동 중에만 재생
  const rideTopChk=document.getElementById('partRegRideTop'); if(rideTopChk) rideTopChk.checked = !!(editRec && editRec.rideTop);
  const animChk=document.getElementById('partRegAnimActive'); if(animChk) animChk.checked = ((editRec && editRec.animMode) === 'active');
  const saveXfChkInit=document.getElementById('partRegSaveXf'); if(saveXfChkInit) saveXfChkInit.checked = false;
  // charType 라디오 — 없으면 기본 캐릭터로 취급
  const curCharType = (editRec && editRec.charType) === 'commission' ? 'commission' : 'default';
  document.querySelectorAll('input[name="partRegCharType"]').forEach(r=>{ r.checked = (r.value === curCharType); });
  // hides 다중 체크박스 — 모든 카테고리에서 표시 (관리자가 파츠별로 숨길 부위 결정)
  const hidesRow=document.getElementById('partRegHidesRow');
  if(hidesRow) hidesRow.style.display = 'block';
  // sentinel 필터해서 순수 hides만 체크박스에 복원
  const curHides = getRecHides(editRec) || [];
  document.querySelectorAll('.partRegHides').forEach(c=>{ c.checked = curHides.includes(c.value); });
  document.getElementById('partRegGo').textContent = editRec ? '수정 완료' : '등록';
  document.getElementById('partRegOverlay').classList.add('on');
}
(function bindPartRegister(){
  const ov=document.getElementById('partRegOverlay'); if(!ov)return;
  document.getElementById('partRegCancel').onclick=()=>ov.classList.remove('on');
  /* 🎰 가챠를 켜면 🔗 함께 착용도 같이 켜고 잠근다 — 저장 쪽에서도 강제하지만, 화면에서
     체크가 안 들어오면 관리자가 "안 켜도 되나 보다"로 읽는다. 눈에 보이게 묶어둔다. */
  (function bindGachaStackable(){
    const g=document.getElementById('partRegGacha'), s=document.getElementById('partRegStackable');
    if(!g||!s) return;
    g.addEventListener('change', syncPartRegGachaLock);
  })();
  document.getElementById('partRegGo').onclick=async()=>{
    const f=document.getElementById('partRegFile').files[0];
    const editing = !!_partRegEditId;
    /* 📂 카테고리는 이제 셀렉트가 정한다 — 수정할 때 다른 부위로 옮길 수 있다.
       ⚠️ 아래 로직이 전부 _partRegCat 을 참조하므로 여기서 한 번에 갈아끼운다.
         (따로 변수를 두면 상한 검사·order·publish 중 한 곳을 반드시 빠뜨린다) */
    const _catSel2=document.getElementById('partRegCat');
    if(_catSel2 && _catSel2.value) _partRegCat = _catSel2.value;
    const info=partCatInfo(_partRegCat);
    const name=(document.getElementById('partRegName').value.trim())||(info?info.label:'파츠');
    /* 아이콘 입력란은 없앴다(카테고리 자리로 대체). 기존 값은 그대로 이어받는다 —
       썸네일이 없는 옛 파츠는 카드에 이 아이콘을 쓰기 때문에 비우면 빈칸이 된다. */
    const _oldRec = editing ? savedParts().find(p=>p.id===_partRegEditId) : null;
    const icon = (_oldRec && _oldRec.icon) || '';
    if(!editing && !f){toast('GLB 파일을 선택해 주세요');return;}
    if(f && f.size>MAX_GLB_BYTES()){toast('GLB 파일이 1MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
    /* 🎰 상한 검사보다 먼저 "이게 가챠 파츠인가"를 읽는다 — 통이 갈리기 때문이다(partsInCatFor 주석 참고).
       아래 본문에서 다시 읽는 gacha 와 같은 값이지만, 그건 상한 검사 뒤에 있어서 여기서 쓸 수 없다. */
    const _regGachaChk=document.getElementById('partRegGacha');
    const isGachaReg = !!(_regGachaChk && _regGachaChk.checked);
    if(!editing && partsInCatFor(_partRegCat, isGachaReg).length>=partCatLimit(isGachaReg)){
      toast(isGachaReg ? ('이 카테고리의 가챠 파츠는 최대 '+MAX_GACHA_PARTS_PER_CAT()+'개까지예요')
                       : ('이 카테고리는 최대 '+MAX_PARTS_PER_CAT()+'개까지예요 (가챠 파츠는 따로 셉니다)'));
      return;
    }
    const btn=document.getElementById('partRegGo'); btn.disabled=true; btn.textContent=editing?'수정 중...':'등록 중...';
    try{
      let glbB64;
      let _regScene = null;   // 🎨 _col 판정용 — 새 파일을 올린 경우엔 방금 파싱한 씬을 그대로 쓴다
      if(f){ const glb=await f.arrayBuffer(); _regScene = await parseGlbBytes(glb.slice(0)); glbB64=_b64(glb); }
      else {
        const rec=savedParts().find(p=>p.id===_partRegEditId);
        // Storage 이관 후속: 로컬 rec에 glb가 없으면(로컬 캐시엔 glbUrl만 저장돼 있는 상태) Storage에서 받아옴
        if(rec && !rec.glb && rec.glbUrl && typeof resolveCatalogGlb==='function'){
          try{ await resolveCatalogGlb(rec); }catch(_){}
        }
        glbB64 = rec && rec.glb;
      }
      if(!glbB64){ toast('GLB 데이터를 찾을 수 없어요'); btn.disabled=false; btn.textContent=editing?'수정 완료':'등록'; return; }
      const id = _partRegEditId || ('p'+Date.now().toString(36));
      /* 🎨 색을 바꿀 자리가 있는지 — 없으면 가챠에서 1개만 모으면 된다(gachaDupesFor 주석 참고).
         파일을 새로 안 올린 수정이면 이미 파싱해 둔 씬을 캐시에서 꺼내 본다.
         ⚠️ 어느 쪽으로도 못 보면 noColor 를 **적지 않는다** — 필드가 없으면 예전대로 4개라,
            판정 실패가 조용히 '1개짜리'로 둔갑하는 일이 없다. */
      let noColor;
      try{
        let _sc = _regScene;
        if(!_sc){ const _r = savedParts().find(p=>p.id===id); if(_r) _sc = (await getPartScene(_r)).scene; }
        if(_sc) noColor = !gachaMod().sceneHasColorGroup(_sc);
      }catch(_){ noColor = undefined; }
      const newOrder = partsInCat(_partRegCat).length;   // 새로 등록하는 파츠는 항상 맨 끝 순서로
      const glowChk=document.getElementById('partRegGlow'); const glow = !!(glowChk && glowChk.checked);
      const multiChk=document.getElementById('partRegMulti'); const multi = !!(multiChk && multiChk.checked);
      // 🧷 단독 부착 (버그2): 파츠 GLB에 캐릭터와 같은 이름 본(예: ear_L/ear_R)이 있어도 자동 매칭 안 함.
      //   커미션 캐릭터가 이미 ear 본을 가지고 있을 때 귀 파츠가 그 본에 rebind되면서 위치가 캐릭터의
      //   기존 귀에 딸려가는 문제를 방지. 관리자가 파츠별로 선택.
      const standaloneChk=document.getElementById('partRegStandalone'); const standalone = !!(standaloneChk && standaloneChk.checked);
      // 🔗 stackable: 같은 카테고리에 다른 파츠들과 함께 착용 가능 (악세사리 등). 관리자가 파츠별로 선택.
      //   기본은 false — 카테고리당 1개 착용(기존 방식). true면 def.equippedParts[cat]이 배열로 관리됨.
      const stackableChk=document.getElementById('partRegStackable');
      // 🎰 가챠 전용 파츠 — 꾸미기 창에서 빠지고 뽑기로만 얻는다. season:''이면 상시 가챠.
      //   ★ stackable을 강제로 켠다. 안 켜면 착용하는 순간 유저가 쓰던 기존 파츠를 밀어낸다.
      //     체크박스를 안 켜고 등록하는 사고가 반드시 나므로 관리자 선택에 맡기지 않는다.
      const gachaChk=document.getElementById('partRegGacha'); const gacha = !!(gachaChk && gachaChk.checked);
      const seasonSel=document.getElementById('partRegSeason');
      const season = (seasonSel && ['spring','summer','autumn','winter'].includes(seasonSel.value)) ? seasonSel.value : '';
      const stackable = gacha ? true : !!(stackableChk && stackableChk.checked);
      /* 🎩 '얹을 수 있음' — 이 파츠가 머리 중앙에 있으면 위에 캐릭터를 얹는다(RIDE_PART_CENTER_MARGIN 주석).
         납작한지 뾰족한지를 자동으로 가르지 않고 관리자가 정한다 — 자동 판정은 파츠가 늘 때마다 예외가 생긴다. */
      const rideTopChk=document.getElementById('partRegRideTop'); const rideTop = !!(rideTopChk && rideTopChk.checked);
      const animChk=document.getElementById('partRegAnimActive');
      const animMode = (animChk && animChk.checked) ? 'active' : '';   // ''=기존 동작(항상 반복재생)
      // charType (기본 캐릭터 / 커미션 전용) — 꾸미기 창에서 별도 섹션 분리 표시용
      const charTypeEl = document.querySelector('input[name="partRegCharType"]:checked');
      const charType = (charTypeEl && charTypeEl.value === 'commission') ? 'commission' : 'default';
      // hides (착용 시 숨길 부위) — 모든 카테고리에서 관리자가 지정 가능. 미지정 카테고리는 빈 배열.
      //   Firebase가 빈 배열을 자동 삭제하는 문제 대응: 저장은 sentinel로 변환 (getRecHides로 다시 정규화).
      const hidesRaw = Array.from(document.querySelectorAll('.partRegHides:checked')).map(c=>c.value);
      const hides = toHidesForSave(hidesRaw);
      // 🎯 어플 5: 관리자가 미리보기에서 조정한 xf를 이 파츠의 defaultXf로 저장 —
      //   그러면 다른 유저가 처음 착용할 때 그 위치/크기/회전에서 시작함(추후 미세조정은 그대로 가능).
      const saveXfChk = document.getElementById('partRegSaveXf');
      let defaultXf = null;
      if(saveXfChk && saveXfChk.checked && wdPreviewBase() && wdPreviewBase().charDef){
        // ★ 리깅 파츠(귀 등) 대응:
        //   기즈모 objectChange 콜백은 렌더 프레임과 어긋나 마지막 몇 픽셀의 이동이
        //   entry.xf에 반영 안 된 채로 저장 버튼이 눌리는 경우가 있음.
        //   저장 직전에 syncWdGizmoToXf를 강제 호출해서 wrapper.position 최신 값을 xf에 반영.
        try{ if(wdGizmo() && wdGizmo().object && typeof syncWdGizmoToXf==='function') syncWdGizmoToXf(); }catch(e){}
        // ★ 수정 모드에선 "지금 수정 중인 파츠(id)"의 entry만 읽음 — 예전엔 카테고리의 현재 장착 entry를
        //   그대로 읽어서, 미리보기에 다른 파츠(B)가 장착된 채 A를 저장하면 B의 위치/크기/회전이
        //   A의 기본값으로 저장되는 문제가 있었음(파츠별 설정이 서로 섞이던 원인).
        let entry = null;
        if(editing && typeof findEntryById==='function'){
          entry = findEntryById(wdPreviewBase().charDef, _partRegCat, id);
          if(!entry) console.log('[파츠 등록] 수정 중인 파츠가 미리보기에 장착돼 있지 않아 defaultXf는 저장 안 함:', id);
        } else {
          entry = wdPreviewBase().charDef.equippedParts && wdPreviewBase().charDef.equippedParts[_partRegCat];
          if(Array.isArray(entry)) entry = entry[entry.length-1];   // stackable 카테고리면 마지막 장착분
        }
        if(entry){
          const xf = partEntryXf(entry);
          // 색상(color)은 개인 취향이라 defaultXf에는 안 담고 위치/크기/회전만
          defaultXf = { scale:xf.scale, pos:xf.pos.slice(), rot:xf.rot.slice() };
          console.log('[파츠 등록] defaultXf 저장:', _partRegCat, JSON.stringify(defaultXf));
        }
      }
      if(editing){
        const rec = savedParts().find(p=>p.id===id);
        if(rec){ rec.name=name; rec.icon=icon||''; rec.cat=_partRegCat; rec.glb=glbB64; rec.glow=glow; rec.multi=multi; rec.charType=charType; rec.hides=hides; rec.standalone=standalone; rec.stackable=stackable; rec.animMode=animMode; rec.gacha=gacha; rec.season=season; rec.rideTop=rideTop;
          if(noColor !== undefined) rec.noColor = noColor; else delete rec.noColor;   // 🎨 판정 실패 시엔 안 적는다(= 예전대로 4개)
          if(defaultXf) rec.defaultXf=defaultXf; }
        partSceneCache().delete(id);   // 캐시 무효화 — 새 GLB가 반영되게
        // 이미 이 파츠를 착용 중인 좌석이 있으면 즉시 다시 장착해서 변경사항 반영 (배열/단일 모두 대응)
        seats.forEach(s=>{
          if(!s.charDef || !s.charDef.equippedParts) return;
          for(const c in s.charDef.equippedParts){
            const entry = findEntryById(s.charDef, c, id);
            if(entry){
              const stackableXf = rec.stackable ? partEntryXf(entry) : null;
              /* 🦶 파츠 GLB 를 고쳐 저장하면 발밑 깊이도 달라진다 — 다시 붙인 뒤 바닥을 맞춘다.
                 (욕조를 조금 더 깊게 그려 저장했는데 화면은 예전 높이 그대로였던 경로) */
              Promise.resolve(equipPartOnSeat(s, c, rec, { stackableXf })).then(()=>{
                try{ if(s && s.gltfRoot && typeof fitModel==='function') fitModel(s); }catch(_){}
              }).catch(()=>{});
            }
          }
          applyClothVisibility(s);
        });
        // ★ 꾸미기 미리보기(wdPreviewBase)도 같이 재장착 — 편집 저장 후 미리보기가 stale해서
        //   hides 등 새 rec 설정이 반영 안 되던 문제 대응.
        if(wdPreviewBase() && wdPreviewBase().charDef && wdPreviewBase().charDef.equippedParts){
          for(const c in wdPreviewBase().charDef.equippedParts){
            const entry = findEntryById(wdPreviewBase().charDef, c, id);
            if(entry){
              const stackableXf = rec.stackable ? partEntryXf(entry) : null;
              await equipPartOnSeat(wdPreviewBase(), c, rec, { stackableXf });
            }
          }
          applyClothVisibility(wdPreviewBase());
        }
      } else {
        const rec = {id, cat:_partRegCat, name, icon:icon||'', glb:glbB64, order:newOrder, glow, multi, charType, hides, standalone, stackable, animMode, gacha, season, rideTop};
        if(noColor !== undefined) rec.noColor = noColor;   // 🎨 색을 바꿀 자리가 없으면 가챠 1개로 끝

        if(defaultXf) rec.defaultXf = defaultXf;
        savedParts().push(rec);
      }
      // ★ Phase 4: 도트 썸네일 자동 생성 (등록/편집 모두). 실패해도 등록 자체는 계속 진행.
      const thumbRec = savedParts().find(p=>p.id===id);
      let thumbnail = null;
      if(thumbRec){
        thumbnail = await generatePartThumbnail(thumbRec);
        if(thumbnail){ thumbRec.thumbnail = thumbnail; }
      }
      persistSavedParts();
      toast(editing ? ('"'+name+'" 수정 완료') : ('"'+name+'" 등록 완료'));
      ov.classList.remove('on');
      renderWardrobe();
      // 🎰 보관함이 열려 있으면 같이 갱신 — 관리자가 등록하고 바로 그 화면으로 돌아온다
      if(gachaMod().isInvOpen()) gachaMod().renderGachaInv();
      if(window.firebaseAPI && window.firebaseAPI.publishPart){
        /* 🔴 publishPart 는 set() = **노드 전체 교체**다 — 페이로드는 반드시
           buildPartPublishData 로만 만든다(그 함수 주석에 왜인지 다 적혀 있다).
           ★ 이 시점의 rec 에는 이번에 정한 값이 전부 반영돼 있다(위 editing/신규 두 갈래).
             그래서 **rec 하나만 보면** 로컬과 서버가 어긋날 자리가 없다.
           ⚠️ 예전엔 `if(defaultXf) publishData.defaultXf = defaultXf` 였다. 체크박스는
             저장할 때만 켜는 값이라, 그 뒤 아무 수정이나 한 번 하면 체크가 꺼진 채로 set() 이
             돌아 **서버의 defaultXf 가 지워졌다.** 로컬 rec 는 안 지워져서 관리자 화면에서만
             멀쩡해 보였다 — 제보의 그 모양이다. order 도 수정 경로에 아예 없었다.
           ⚠️ 값을 **지우는** 수단은 아직 없다(체크를 풀어도 옛 기본값이 유지된다).
             기본값을 되돌리려면 원점으로 다시 맞춰 저장할 것. */
        const publishData = buildPartPublishData(thumbRec || {}, {
          cat: _partRegCat, name, icon: icon||'', glb: glbB64,
          order: editing ? (thumbRec && thumbRec.order) : newOrder,
          thumbnail: thumbnail || (thumbRec && thumbRec.thumbnail) || null,
        });
        window.firebaseAPI.publishPart(id, publishData)
          .catch(()=>{ toast('⚠ 온라인 배포 실패 — 이 기기에만 반영됐어요(인터넷 연결 확인)'); });
      } else {
        toast('⚠ 온라인 배포 안 됨 — 이 기기에만 반영됐어요');
      }
    }catch(e){ toast((editing?'수정':'등록')+' 실패: GLB 파일을 확인해 주세요'); }
    btn.disabled=false; btn.textContent=editing?'수정 완료':'등록';
  };
})();

/* 책상/아이템 등록·수정 (관리자 전용) — kind:'desk'|'item', editId가 있으면 기존 카탈로그 항목 수정, 없으면 신규 등록 */
let _deskRegEditId=null, _deskRegKind='desk';
function openDeskRegister(kind, editId){
  window.focus();   // ★ 직전에 삭제 확인(confirm()) 같은 네이티브 다이얼로그가 떴다 닫히면서 창 포커스가 안 돌아온 채로
                     //   남아있을 수 있어서, 모달을 열기 "전에도" 한 번 더 명시적으로 포커스를 되찾아옴.
  _deskRegKind = kind||'desk'; _deskRegEditId = editId || null;
  const arr = _deskRegKind==='desk' ? savedDesks() : savedItems();
  const rec = editId ? arr.find(d=>d.id===editId) : null;
  const label = _deskRegKind==='desk' ? '책상' : '아이템';
  const emoji = _deskRegKind==='desk' ? '🪑' : '📦';
  document.getElementById('deskRegTitle').textContent = rec ? (emoji+' "'+(rec.name||label)+'" 수정') : (emoji+' '+label+' 등록');
  document.getElementById('deskRegDesc').textContent = '모든 사용자에게 배포되는 '+label+' GLB예요. 나중에 GLB만 새로 올려서 교체하면, 이미 이 '+label+'을(를) 쓰던 사람들도 자동으로 새 모습으로 바뀌어요.';
  document.getElementById('deskRegName').value = rec ? (rec.name||'') : '';
  document.getElementById('deskRegIcon').value = rec ? (rec.icon||'') : '';
  document.getElementById('deskRegFile').value='';
  document.getElementById('deskRegFileHint').style.display = rec ? 'block' : 'none';
  // 부착 위치/기본 크기/자동재생은 아이템에만 표시(책상 자체는 해당 없음)
  const isItem = (_deskRegKind==='item');
  const attachRow=document.getElementById('deskRegAttachRow');
  if(attachRow){ attachRow.style.display = isItem ? 'block' : 'none'; }
  const attachSel=document.getElementById('deskRegAttach');
  if(attachSel) attachSel.value = (rec && rec.attachTo) ? rec.attachTo : 'desk';
  // 애니메이션/라이선스 옵션은 책상/아이템 둘 다 노출
  const itemOnlyRow=document.getElementById('deskRegItemOnlyRow');
  if(itemOnlyRow){ itemOnlyRow.style.display = 'block'; }
  const sizeInput=document.getElementById('deskRegSize');
  if(sizeInput){
    sizeInput.value = (rec && rec.defaultSize!=null) ? rec.defaultSize : 0.8;
    // 기본 크기 입력줄은 아이템에서만 의미가 있음 → 책상 편집엔 숨김
    const sizeParent = sizeInput.previousElementSibling;   // "기본 크기" 라벨
    sizeInput.style.display = isItem ? '' : 'none';
    if(sizeParent && sizeParent.tagName==='LABEL') sizeParent.style.display = isItem ? '' : 'none';
  }
  // 어플 8: 재생 방식 라디오 초기 상태 — 기존 데이터에 playMode가 없으면 autoPlay를 참조해 매핑
  const initMode = (rec && rec.playMode) || (rec && rec.autoPlay ? 'auto' : 'click');
  document.querySelectorAll('input[name="deskRegPlayMode"]').forEach(r=>{ r.checked = (r.value===initMode); });
  const glowChk=document.getElementById('deskRegGlow');
  if(glowChk) glowChk.checked = !!(rec && rec.glow);
  const licenseChk=document.getElementById('deskRegLicense');
  if(licenseChk) licenseChk.checked = !!(rec && rec.licenseOnly);
  document.getElementById('deskRegGo').textContent = rec ? '수정 완료' : '등록';
  document.getElementById('deskRegOverlay').classList.add('on');
  window.focus();
  setTimeout(()=>{ window.focus(); document.getElementById('deskRegName').focus(); }, 120);
}
(function bindDeskRegister(){
  const ov=document.getElementById('deskRegOverlay'); if(!ov) return;
  document.getElementById('deskRegCancel').onclick=()=>ov.classList.remove('on');
  document.getElementById('deskRegGo').onclick=async()=>{
    const isDesk = _deskRegKind==='desk';
    const arr = isDesk ? savedDesks() : savedItems();
    const apiPublish = isDesk ? 'publishDesk' : 'publishItem';
    const label = isDesk ? '책상' : '아이템';
    const f=document.getElementById('deskRegFile').files[0];
    const name=(document.getElementById('deskRegName').value.trim())||label;
    const icon=document.getElementById('deskRegIcon').value;
    const editing = !!_deskRegEditId;
    if(!editing && !f){ toast('GLB 파일을 선택해 주세요'); return; }
    if(f && f.size>MAX_GLB_BYTES()){ toast('GLB 파일이 1MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)'); return; }
    const _maxAssets = isDesk ? MAX_CUSTOM_ASSETS() : MAX_CUSTOM_ITEMS();
    if(!editing && arr.filter(d=>d.fromCatalog).length>=_maxAssets){ toast(label+'은(는) 최대 '+_maxAssets+'개까지 등록할 수 있어요'); return; }
    if(!window.firebaseAPI || !window.firebaseAPI[apiPublish]){ toast('네트워크 연결을 확인해 주세요'); return; }
    const btn=document.getElementById('deskRegGo'); btn.disabled=true; btn.textContent=editing?'수정 중...':'등록 중...';
    try{
      let glbB64;
      if(f){ const buf=await f.arrayBuffer(); await parseGlbBytes(buf.slice(0)); glbB64=_b64(buf); }
      else {
        const rec=arr.find(d=>d.id===_deskRegEditId);
        if(rec && !rec.glb && rec.glbUrl && typeof resolveCatalogGlb==='function'){
          try{ await resolveCatalogGlb(rec); }catch(_){}
        }
        glbB64 = rec && rec.glb;
      }
      if(!glbB64){ toast('GLB 데이터를 찾을 수 없어요'); btn.disabled=false; return; }
      const id = _deskRegEditId || ((isDesk?'d':'i')+Date.now().toString(36));
      const payload = { name, icon:icon||'', glb:glbB64 };
      // 아이템 전용 필드
      if(!isDesk){
        const attachSel=document.getElementById('deskRegAttach'); payload.attachTo = (attachSel && attachSel.value) || 'desk';
        const sizeInput=document.getElementById('deskRegSize'); const sizeVal=parseFloat(sizeInput&&sizeInput.value);
        payload.defaultSize = (isFinite(sizeVal) && sizeVal>0) ? sizeVal : 0.8;
        if(!editing) payload.order = savedItems().filter(d=>d.fromCatalog).length;
      }
      // 애니메이션 재생 방식 + 라이선스 게이트: 책상/아이템 공용
      const modeEl = document.querySelector('input[name="deskRegPlayMode"]:checked');
      const playMode = (modeEl && modeEl.value) || 'click';
      payload.playMode = playMode;
      payload.autoPlay = (playMode==='auto');
      const licenseChk=document.getElementById('deskRegLicense'); payload.licenseOnly = !!(licenseChk && licenseChk.checked);
      await window.firebaseAPI[apiPublish](id, payload);
      toast(editing ? '"'+name+'" 수정 완료 — 쓰던 사람들도 자동으로 바뀌어요' : '"'+name+'" 등록 완료');
      ov.classList.remove('on');
      renderCrItems();
    }catch(e){ toast('처리 실패: GLB 파일을 확인해 주세요'); }
    btn.disabled=false; btn.textContent=editing?'수정 완료':'등록';
  };
})();
document.getElementById('deskRegBtn').onclick=()=>openDeskRegister('desk',null);
document.getElementById('itemRegBtn').onclick=()=>openDeskRegister('item',null);

return { openPartRegister, openDeskRegister, deletePart, buildPartPublishData, syncPartRegGachaLock,
         PART_PUBLISH_FIELDS };   // 검사용 — sim-publish-fields 가 배포 목록과 rec 필드를 대조한다
}

const api = { createAdminPartRegister };
if(typeof window !== 'undefined') window.TwAdminPartRegister = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
