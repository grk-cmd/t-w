/* admin-part-register.js — 🛠️ 파츠 · 책상 · 아이템 등록 창 · 파츠 삭제 (관리자)
   app.js 의 «🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자)» · «🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자)» 두 구역을 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 4번 — docs/APP_FSD_MAP.md).
   ★ 등록 · 고치기 · 삭제(단종)는 서버 카탈로그에 쓴다(deps.catalogAdmin — admin/catalog-admin-api.js). 서버가 받은 뒤에야 화면을 바꾼다 — 못 쓰면 번호로 알리고 이 PC 만 바꾸지 않는다.
     새 물건은 서버 한 벌이 돌아오면 목록에 뜬다(catalog-sync.js). 파일 크기 · 카테고리당 진열 수 같은 서버 제한은 앱이 미리 거절하지 않는다(서버 오류를 번호로 보인다).

   ★ 뒤에 선언되거나 다시 대입되는 값은 읽는 함수로 받는다 —
     값(PART_CATS · gachaMod ·
     partSceneCache · savedDesks · savedItems · savedParts · wdGizmo · wdPreviewBase)를 이름() 으로 읽는다. 이 모듈을 만드는 줄보다
     뒤에 선언되거나(const · TDZ) app.js 가 다시 대입하는 let 이라 값이 아니라 읽는 함수로 받는다. 파츠 삭제의 savedParts = … 는 setSavedParts(…).
     자리는 파서(typescript)로 찾아 바꿨다 — 주석 · 글자 · 속성 이름(obj.savedParts 같은)은 건드리지 않았다.
   ★ app.js 함수 스물일곱은 app.js 가 화살표로 넘긴다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름 넷 — openPartRegister · openDeskRegister · deletePart · syncPartRegGachaLock.
     app.js 는 adminPartReg.이름 으로 부르고, 🎰 gacha.js 에는 예전처럼 deps 로 넘긴다.
   ⚠️ document · window · firebaseAPI · confirm · FileReader · Image · THREE 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminPartRegister — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-part-register.js */
(function(){

function createAdminPartRegister(deps){
const _b64 = deps._b64;
const catalogAdmin = deps.catalogAdmin;   // 카탈로그 쓰기 서버 경로
const resolveCatalogGlb = deps.resolveCatalogGlb;
const applyClothVisibility = deps.applyClothVisibility;
const catEquippedIds = deps.catEquippedIds;
const equipPartOnSeat = deps.equipPartOnSeat;
const findEntryById = deps.findEntryById;
const generatePartThumbnail = deps.generatePartThumbnail;
const getPartScene = deps.getPartScene;
const getRecHides = deps.getRecHides;
const parseGlbBytes = deps.parseGlbBytes;
const partCatInfo = deps.partCatInfo;
const partEntryXf = deps.partEntryXf;
const persistSavedParts = deps.persistSavedParts;
const refitSeatAfterParts = deps.refitSeatAfterParts;
const removeEntryFromCat = deps.removeEntryFromCat;
const renderCrItems = deps.renderCrItems;
const renderWardrobe = deps.renderWardrobe;
const saveSlots = deps.saveSlots;
const syncWdGizmoToXf = deps.syncWdGizmoToXf;
const toast = deps.toast;
const unequipPartFromSeat = deps.unequipPartFromSeat;
const unequipStackablePart = deps.unequipStackablePart;
const seats = deps.seats;   // 좌석 배열 — 다시 대입되지 않는 같은 객체
const PART_CATS = deps.PART_CATS;   // 읽는 함수
const gachaMod = deps.gachaMod;   // 읽는 함수
const partSceneCache = deps.partSceneCache;   // 읽는 함수
const savedDesks = deps.savedDesks;   // 읽는 함수
const savedItems = deps.savedItems;   // 읽는 함수
const savedParts = deps.savedParts;   // 읽는 함수
const wdGizmo = deps.wdGizmo;   // 읽는 함수
const wdPreviewBase = deps.wdPreviewBase;   // 읽는 함수
const setSavedParts = deps.setSavedParts;   // 파츠 삭제가 목록을 바꿔 끼운다
const setAdminPartActions = deps.setAdminPartActions;
async function deletePart(id){
  const rec=savedParts().find(p=>p.id===id); if(!rec)return;
  /* 서버 카탈로그에 있던 파츠는 먼저 단종(진열에서 내림)한다 — 못 하면 이 PC 목록도 그대로 둔다(서버와 어긋나지 않게) */
  if(rec.fromCatalog){
    try{ await catalogAdmin.archive('part', id); }
    catch(e){ await catalogAdmin.reportFail(e, 'item'); return; }
  }
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
  saveSlots();
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
  document.addEventListener(TwNav.ADMIN_EXIT_EVENT, ()=>ov.classList.remove('on'));   // 세션이 끝나면 자기 닫기로
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
    /* 📂 카테고리는 셀렉트가 정한다 — 수정할 때 다른 부위로 옮길 수 있다.
       ⚠️ 아래 로직이 전부 _partRegCat 을 참조하므로 여기서 한 번에 갈아끼운다. */
    const _catSel2=document.getElementById('partRegCat');
    if(_catSel2 && _catSel2.value) _partRegCat = _catSel2.value;
    const info=partCatInfo(_partRegCat);
    const name=(document.getElementById('partRegName').value.trim())||(info?info.label:'파츠');
    /* 아이콘 입력란은 없앴다(카테고리 자리로 대체). 기존 값은 그대로 이어받는다 —
       썸네일이 없는 옛 파츠는 카드에 이 아이콘을 쓰기 때문에 비우면 빈칸이 된다. */
    const _oldRec = editing ? savedParts().find(p=>p.id===_partRegEditId) : null;
    const icon = (_oldRec && _oldRec.icon) || '';
    if(!editing && !f){toast('GLB 파일을 선택해 주세요');return;}
    /* 서버 카탈로그에 없는 파츠(코드로 추가해 이 PC 에만 있는 것)는 서버가 모르는 물건이라 고칠 수 없다 — 서버를 부르지 않고 번호로 알린다 */
    if(editing && _oldRec && !_oldRec.fromCatalog){ catalogAdmin.notifyLocalOnly(); return; }
    const btn=document.getElementById('partRegGo'); btn.disabled=true; btn.textContent=editing?'수정 중...':'등록 중...';
    const resetBtn = ()=>{ btn.disabled=false; btn.textContent=editing?'수정 완료':'등록'; };
    let glbB64, glbBytes = null, noColor, defaultXf = null, thumbnail = null;
    const id = _partRegEditId || ('p'+Date.now().toString(36));
    const glowChk=document.getElementById('partRegGlow'); const glow = !!(glowChk && glowChk.checked);
    const multiChk=document.getElementById('partRegMulti'); const multi = !!(multiChk && multiChk.checked);
    // 🧷 단독 부착: 파츠 GLB 에 캐릭터와 같은 이름 본(예: ear_L/ear_R)이 있어도 자동 매칭 안 함(커미션 캐릭터의 귀에 딸려가는 문제 방지). 관리자가 파츠별로 선택.
    const standaloneChk=document.getElementById('partRegStandalone'); const standalone = !!(standaloneChk && standaloneChk.checked);
    // 🔗 stackable: 같은 카테고리에서 다른 파츠와 함께 착용(악세사리 등). 🎰 가챠 파츠는 늘 켠다 — 안 켜면 착용하는 순간 쓰던 기존 파츠를 밀어낸다.
    const stackableChk=document.getElementById('partRegStackable');
    const gachaChk=document.getElementById('partRegGacha'); const gacha = !!(gachaChk && gachaChk.checked);
    const seasonSel=document.getElementById('partRegSeason');
    const season = (seasonSel && ['spring','summer','autumn','winter'].includes(seasonSel.value)) ? seasonSel.value : '';
    const stackable = gacha ? true : !!(stackableChk && stackableChk.checked);
    // 🎩 '얹을 수 있음' — 납작한지 뾰족한지를 자동으로 가르지 않고 관리자가 정한다(RIDE_PART_CENTER_MARGIN 주석)
    const rideTopChk=document.getElementById('partRegRideTop'); const rideTop = !!(rideTopChk && rideTopChk.checked);
    const animChk=document.getElementById('partRegAnimActive');
    const animMode = (animChk && animChk.checked) ? 'active' : '';
    const charTypeEl = document.querySelector('input[name="partRegCharType"]:checked');
    const charType = (charTypeEl && charTypeEl.value === 'commission') ? 'commission' : 'default';
    const hides = Array.from(document.querySelectorAll('.partRegHides:checked')).map(c=>c.value);
    try{
      let _regScene = null;   // 🎨 _col 판정용 — 새 파일을 올린 경우엔 방금 파싱한 씬을 그대로 쓴다
      if(f){ const glb=await f.arrayBuffer(); glbBytes = new Uint8Array(glb); _regScene = await parseGlbBytes(glb.slice(0)); glbB64=_b64(glb); }
      else {
        const rec=savedParts().find(p=>p.id===_partRegEditId);
        // 로컬 rec 에 glb 가 없으면(캐시엔 glbUrl 만 있다) 썸네일 · 색 판정에 쓸 GLB 를 받아 온다
        if(rec && !rec.glb && rec.glbUrl){
          try{ await resolveCatalogGlb(rec); }catch(_){}
        }
        glbB64 = rec && rec.glb;
      }
      if(!glbB64){ toast('GLB 데이터를 찾을 수 없어요'); resetBtn(); return; }
      /* 🎨 색을 바꿀 자리가 있는지 — 없으면 가챠에서 1개만 모으면 된다(gachaDupesFor 주석 참고).
         ⚠️ 어느 쪽으로도 못 보면 noColor 를 **적지 않는다** — 판정 실패가 조용히 '1개짜리'로 둔갑하는 일이 없다. */
      try{
        let _sc = _regScene;
        if(!_sc){ const _r = savedParts().find(p=>p.id===id); if(_r) _sc = (await getPartScene(_r)).scene; }
        if(_sc) noColor = !gachaMod().sceneHasColorGroup(_sc);
      }catch(_){ noColor = undefined; }
      // 🎯 관리자가 미리보기에서 조정한 xf 를 이 파츠의 defaultXf 로 저장 — 다른 유저가 처음 착용할 때 그 위치/크기/회전에서 시작한다(색은 개인 취향이라 뺀다).
      const saveXfChk = document.getElementById('partRegSaveXf');
      if(saveXfChk && saveXfChk.checked && wdPreviewBase() && wdPreviewBase().charDef){
        // ★ 기즈모 콜백은 렌더 프레임과 어긋나 마지막 몇 픽셀이 xf 에 안 실릴 수 있다 — 저장 직전에 강제로 맞춘다.
        try{ if(wdGizmo() && wdGizmo().object) syncWdGizmoToXf(); }catch(e){}
        // ★ 수정 모드에선 "지금 수정 중인 파츠(id)"의 entry 만 읽는다 — 다른 파츠(B)의 값이 A 의 기본값으로 섞이지 않게.
        let entry = null;
        if(editing){
          entry = findEntryById(wdPreviewBase().charDef, _partRegCat, id);
          if(!entry) console.log('[파츠 등록] 수정 중인 파츠가 미리보기에 장착돼 있지 않아 defaultXf는 저장 안 함:', id);
        } else {
          entry = wdPreviewBase().charDef.equippedParts && wdPreviewBase().charDef.equippedParts[_partRegCat];
          if(Array.isArray(entry)) entry = entry[entry.length-1];   // stackable 카테고리면 마지막 장착분
        }
        if(entry){
          const xf = partEntryXf(entry);
          defaultXf = { scale:xf.scale, pos:xf.pos.slice(), rot:xf.rot.slice() };
          console.log('[파츠 등록] defaultXf 저장:', _partRegCat, JSON.stringify(defaultXf));
        }
      }
      // 도트 썸네일(등록 · 수정 모두) — 굽지 못하면(null) 썸네일 없이 계속한다(고치기는 지금 서버 썸네일을 그대로 둔다)
      if(f) partSceneCache().delete(id);
      thumbnail = await generatePartThumbnail(Object.assign({}, _oldRec || {}, { id, cat:_partRegCat, name, icon, glb:glbB64 }));
    }catch(e){ toast((editing?'수정':'등록')+' 실패: GLB 파일을 확인해 주세요'); resetBtn(); return; }
    /* 서버에 먼저 쓴다 — 파일(GLB · 썸네일)을 올리고 물건 한 건을 PUT(고치기는 지금 version 으로). 못 쓰면 이 PC 도 바꾸지 않는다 */
    try{
      await catalogAdmin.savePart(id, {
        name, icon, category:_partRegCat, glb:glbBytes, modelHash:_oldRec && _oldRec.modelHash,
        thumbDataUrl:thumbnail, thumbHash:_oldRec && _oldRec.thumbHash,
        glow, multi, standalone, stackable, rideTop, noColor, animMode, charType, hides, gacha, season,
        defaultXf: defaultXf || (_oldRec && _oldRec.defaultXf), listingAccess: _oldRec && _oldRec.listingAccess,
      }, { create: !editing });
    }catch(e){ await catalogAdmin.reportFail(e, 'item'); resetBtn(); return; }
    try{
      if(editing){
        // 이미 이 파츠를 착용 중인 좌석 · 꾸미기 미리보기는 새 모습으로 다시 장착한다(서버 한 벌이 돌아오기 전에 바로 보이게)
        const rec = savedParts().find(p=>p.id===id);
        if(rec){ rec.name=name; rec.cat=_partRegCat; rec.glb=glbB64; rec.glow=glow; rec.multi=multi; rec.charType=charType; rec.hides=hides; rec.standalone=standalone; rec.stackable=stackable; rec.animMode=animMode; rec.gacha=gacha; rec.season=season; rec.rideTop=rideTop;
          if(noColor !== undefined) rec.noColor = noColor; else delete rec.noColor;
          if(defaultXf) rec.defaultXf=defaultXf;
          if(thumbnail) rec.thumbnail=thumbnail;
          partSceneCache().delete(id);   // 캐시 무효화 — 새 GLB가 반영되게
          seats.forEach(s=>{
            if(!s.charDef || !s.charDef.equippedParts) return;
            for(const c in s.charDef.equippedParts){
              const entry = findEntryById(s.charDef, c, id);
              if(entry){
                const stackableXf = rec.stackable ? partEntryXf(entry) : null;
                /* 🦶 파츠 GLB 를 고쳐 저장하면 발밑 깊이도 달라진다 — 다시 붙인 뒤 바닥을 맞춘다. */
                refitSeatAfterParts(s, { wait: Promise.resolve(equipPartOnSeat(s, c, rec, { stackableXf })) });
              }
            }
            applyClothVisibility(s);
          });
          // ★ 꾸미기 미리보기(wdPreviewBase)도 같이 재장착 — hides 등 새 설정이 반영되게
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
        }
      }
      toast(editing ? ('"'+name+'" 수정 완료') : ('"'+name+'" 등록 완료'));
      ov.classList.remove('on');
      renderWardrobe();
      // 🎰 보관함이 열려 있으면 같이 갱신 — 관리자가 등록하고 바로 그 화면으로 돌아온다
      if(gachaMod().isInvOpen()) gachaMod().renderGachaInv();
    }catch(e){ console.warn('[파츠 등록] 서버에는 썼지만 이 화면을 바꾸지 못했다', e); toast('저장했어요 — 화면은 곧 서버 목록으로 바뀌어요'); ov.classList.remove('on'); }
    resetBtn();
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
  if(licenseChk) licenseChk.checked = !!(rec && rec.licenseOnly);   // 진열 분류(catalog-api.js 가 채운다) — 막기(locked)와 다르다
  document.getElementById('deskRegGo').textContent = rec ? '수정 완료' : '등록';
  document.getElementById('deskRegOverlay').classList.add('on');
  window.focus();
  setTimeout(()=>{ window.focus(); document.getElementById('deskRegName').focus(); }, 120);
}
(function bindDeskRegister(){
  const ov=document.getElementById('deskRegOverlay'); if(!ov) return;
  document.getElementById('deskRegCancel').onclick=()=>ov.classList.remove('on');
  document.addEventListener(TwNav.ADMIN_EXIT_EVENT, ()=>ov.classList.remove('on'));   // 세션이 끝나면 자기 닫기로
  document.getElementById('deskRegGo').onclick=async()=>{
    const isDesk = _deskRegKind==='desk';
    const arr = isDesk ? savedDesks() : savedItems();
    const label = isDesk ? '책상' : '아이템';
    const f=document.getElementById('deskRegFile').files[0];
    const name=(document.getElementById('deskRegName').value.trim())||label;
    const icon=document.getElementById('deskRegIcon').value;
    const editing = !!_deskRegEditId;
    if(!editing && !f){ toast('GLB 파일을 선택해 주세요'); return; }
    const btn=document.getElementById('deskRegGo'); btn.disabled=true; btn.textContent=editing?'수정 중...':'등록 중...';
    const old = editing ? arr.find(d=>d.id===_deskRegEditId) : null;
    let glbBytes = null;
    try{
      if(f){ const buf=await f.arrayBuffer(); await parseGlbBytes(buf.slice(0)); glbBytes = new Uint8Array(buf); }   // 읽을 수 있는 GLB 인지 먼저 본다
    }catch(e){ toast('처리 실패: GLB 파일을 확인해 주세요'); btn.disabled=false; btn.textContent=editing?'수정 완료':'등록'; return; }
    const id = _deskRegEditId || ((isDesk?'d':'i')+Date.now().toString(36));
    const modeEl = document.querySelector('input[name="deskRegPlayMode"]:checked');
    const licenseChk=document.getElementById('deskRegLicense');
    const fields = { name, icon:icon||'', glb:glbBytes, modelHash:old && old.modelHash, thumbHash:old && old.thumbHash,
      playMode:(modeEl && modeEl.value) || 'click', glow:!!(document.getElementById('deskRegGlow') && document.getElementById('deskRegGlow').checked),
      licenseOnly:!!(licenseChk && licenseChk.checked), listingAccess:old && old.listingAccess };
    if(!isDesk){
      const attachSel=document.getElementById('deskRegAttach'); fields.attachTo = (attachSel && attachSel.value) || 'desk';
      const sizeInput=document.getElementById('deskRegSize'); const sizeVal=parseFloat(sizeInput&&sizeInput.value);
      fields.defaultSize = (isFinite(sizeVal) && sizeVal>0) ? sizeVal : 0.8;   // 칸이 비었을 때의 처음 값 — 범위는 서버가 본다
    }
    try{
      await (isDesk ? catalogAdmin.saveDesk : catalogAdmin.saveDeskProp)(id, fields, { create: !editing });
      toast(editing ? '"'+name+'" 수정 완료 — 쓰던 사람들도 자동으로 바뀌어요' : '"'+name+'" 등록 완료');
      ov.classList.remove('on');
      renderCrItems();
    }catch(e){ await catalogAdmin.reportFail(e, 'item'); }
    btn.disabled=false; btn.textContent=editing?'수정 완료':'등록';
  };
})();
document.getElementById('deskRegBtn').onclick=()=>openDeskRegister('desk',null);
document.getElementById('itemRegBtn').onclick=()=>openDeskRegister('item',null);

setAdminPartActions({ openPartRegister, deletePart });   // 꾸미기 창의 [+ 등록] · × · 더블클릭
return { openPartRegister, openDeskRegister, deletePart, syncPartRegGachaLock };
}

const api = { createAdminPartRegister };
if(typeof window !== 'undefined') window.TwAdminPartRegister = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
