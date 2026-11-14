/* desk-item-equip.js — 🪑 책상 위 아이템 장착 · 해제 · 위치 · 색 · 모으기 · 저장 반영(앱 FSD · app.js 분리 M5)
   app.js BUILDERS 구역의 «책상 아이템 장착» 을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(deps 를 읽는 함수로 받는 줄만 `이름()` 으로 달라짐).
   ・책임: 아이템 하나를 좌석 · 생성기 미리보기(holder)에 올리고 내리기(equipDeskItem — 라이선스 전용 막기 · 손 본 부착 · _col 색 그룹 · 손 따라가는 지점 · 재생 방식 등록 ·
     커스텀 GLB 크기 맞춤 · 해제 전 위치 기억) · 저장된 아이템 한 벌 입히기(applyDeskItemsTo) · 모으기(collectDeskItems) · 켜고 끌 때 바로 저장(autoSaveDeskItemsNow) · 색 반영(_applyItemColor) ·
     생성기에서 «처음 나타난 자리» 기억(deskItemOrigin — ⟲ 초기화가 돌아갈 곳).
   ・받는 deps 14 — 값: activeItemMixers · _idleItemPivots(part-anim.js 의 재생 목록) · lightToneMod · toast · 읽는 함수: commissionMod · crState · crXformMod · customItems · deskItemsMod ·
     deskSetupMod · isAdmin · isPremium · launcherPrevMod · slotSaveMod(더 아래에서 만들어지거나 다시 대입되는 것).
   ・내놓는 것: applyDeskAdj · deskItemOrigin(없으면 null) · equipDeskItem · collectDeskItems · autoSaveDeskItemsNow · applyDeskItemsTo · _applyItemColor
   ⚠️ 라이선스 전용 막기는 친구 좌석(holder.remote)에는 걸지 않는다 — 보는 사람의 라이선스로 친구가 올린 아이템을 숨기지 말 것.
   검사: checks/sim-desk-item-equip.js */
(function(){

function createDeskItemEquip(deps){
const _idleItemPivots = deps._idleItemPivots;
const activeItemMixers = deps.activeItemMixers;
const lightToneMod = deps.lightToneMod;
const toast = deps.toast;
const commissionMod = deps.commissionMod;
const crState = deps.crState;
const crXformMod = deps.crXformMod;
const customItems = deps.customItems;
const deskItemsMod = deps.deskItemsMod;
const deskSetupMod = deps.deskSetupMod;
const isAdmin = deps.isAdmin;
const isPremium = deps.isPremium;
const launcherPrevMod = deps.launcherPrevMod;
const slotSaveMod = deps.slotSaveMod;
/* 책상 위 소품(아이템) 시스템 — holder = 좌석 또는 생성기 미리보기 */
function applyDeskAdj(p){ const a=p.userData.adj; p.position.set(a.x||0,a.y||0,a.z||0); p.rotation.set(0,a.rot||0,0); p.scale.setScalar(a.scale||1); }
/* 🪑 생성기 아이템마다 «이번 편집에서 처음 나타난 자리» — ⟲ 이동·회전 초기화가 돌아갈 곳(desk-item-origin.js) */
const deskItemOrigin = (typeof DeskItemOrigin === 'undefined') ? null : DeskItemOrigin.createDeskItemOrigin();
function _rememberCrItemOrigin(holder, p){
  if(!deskItemOrigin || !p || typeof crState().cBase==='undefined' || holder!==crState().cBase) return;
  deskItemOrigin.remember(p, p.userData.adj);
}
function equipDeskItem(holder,def,on){
  // ★ 라이선스 보유자 전용으로 등록된 아이템은 라이선스(isPremium) 또는 관리자가 아니면 장착 자체를 막음.
  //   ⚠️ 단 **친구 좌석(holder.remote)에는 걸지 않는다.** applyDeskItemsTo가 친구 좌석을 그릴 때도
  //     이 함수를 타는데, 여기서 '보는 사람'의 라이선스를 보면 라이선스 있는 친구가 올려둔 아이템이
  //     라이선스 없는 내 화면에서만 사라진다(applyDeskCatalogRefToSeat와 같은 함정).
  /* ⚠️ def.licenseOnly 만 보면 새는 자리가 있다 — 캐릭터에 딸려온 customItems 는 registerCustomItem 을
     licenseOnly 인자 없이 부르는 세 곳(슬롯 적용·좌석 적용·프리셋)에서 **licenseOnly:false 로 등록**된다.
     카탈로그가 먼저 도착했으면 `if(!customItems[id])` 가드에 걸려 무사하지만, 캐릭터가 먼저 닿으면
     그 세션 내내 전용 아이템이 게이트를 통째로 안 탄다. 원본은 카탈로그 레코드(savedItems)이므로
     그쪽도 함께 본다 — 카탈로그가 늦게 와도 그때부터는 맞는 답이 된다.
     savedItems 는 아래에서 let 으로 선언되므로 typeof 가 아니라 try 로 감싼다(TDZ). */
  let _siCat = null; try{ _siCat = commissionMod().savedItems(); }catch(_){}
  const _siRec = (_siCat && _siCat.find && def && def.id) ? _siCat.find(s=>s.id===def.id) : null;
  const _itemLicenseOnly = !!(def && def.licenseOnly) || !!(_siRec && _siRec.licenseOnly);
  if(on && _itemLicenseOnly && !isPremium() && !isAdmin() && !(holder && holder.remote)){
    toast('🔒 "'+(def.name||'이 아이템')+'"은(는) 라이선스 보유자만 사용할 수 있어요');
    return;
  }
  if(!holder.deskItems)holder.deskItems={};
  if(!holder._itemAdjMemory)holder._itemAdjMemory={};   // 해제했다가 다시 장착할 때 이전 위치/크기 조정값을 기억해뒀다가 복원하기 위함
  const cur=holder.deskItems[def.id];
  if(cur){
    holder._itemAdjMemory[def.id]=Object.assign({},cur.userData.adj);   // 해제 직전 값을 기억
    if(cur.userData.colors) holder._itemAdjMemory[def.id]._colors = Object.assign({}, cur.userData.colors);   // 런처3-1: 색상도 함께 기억
    if(cur.userData.itemMixer) activeItemMixers.delete(cur.userData.itemMixer);   // 해제 시 믹서 업데이트 목록에서도 제거
    _idleItemPivots.delete(cur);   // 어플 8: 자리비움 재생 대상에서도 제거
    if(cur.parent)cur.parent.remove(cur); holder.deskItems[def.id]=null;
    if(holder.activeDeskItem===cur){
      holder.activeDeskItem=null;
      // 런처4-2: 활성 아이템이 방금 해제됐으니 기즈모도 즉시 숨김
      if(holder===crState().cBase) crXformMod().attachItemGizmoToActive();
    }
  }
  // ★ 아이템의 attachTo가 'handL'/'handR'이고 캐릭터 본이 있으면 책상 앵커 대신 손 본에 부착 —
  //   기존 꾸미기 파츠(handL/handR 카테고리)와 동일한 seat.bones 조회 방식을 그대로 재사용.
  const wantBone = (def.attachTo && def.attachTo!=='desk') ? def.attachTo : null;
  const boneParent = wantBone && holder.bones && holder.bones[wantBone];
  const attachParent = boneParent || holder.deskAnchor;
  if(on && attachParent){ const obj=def.build(); const pivot=new THREE.Group(); attachParent.add(pivot); pivot.add(obj);
    pivot.userData.isDeskItemPivot=true;   // classifyHit에서 "아이템 클릭"으로 구분하는 마커
    // ★ 런처3-1: 아이템 GLB에도 파츠와 동일한 _col 네이밍(_col, _col1, _col2, ...)이 있으면 색상 그룹으로 인식.
    //   해당 메쉬들을 pivot.userData.colorGroups에 담아두고, 나중에 상세조정 UI에서 색을 바꿀 수 있게 함.
    //   저장·복원은 def.itemColors(=holder에 저장, id별) 형태로 하고, 실제 material.color/emissive를 갱신.
    const itemColorGroups = {};
    obj.traverse(o=>{
      if(!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = mats[0];
      const colMatch = (o.name && o.name.match(/_col(\d*)/i)) || (m && m.name && m.name.match(/_col(\d*)/i));
      if(colMatch){
        const key = 'col'+(colMatch[1]||'1');
        if(m && m.color) o.userData.origColor = m.color.getHexString();
        (itemColorGroups[key] = itemColorGroups[key]||[]).push(o);
      }
    });
    if(Object.keys(itemColorGroups).length) pivot.userData.colorGroups = itemColorGroups;
    // ★ 아이템 GLB 안에 이름이 "hand_L"/"handL"/"hand_R"/"handR"인 자식 오브젝트가 있으면, 그 지점만
    //   캐릭터의 실제 손 본 위치를 매 프레임 따라가도록 등록(예: 반죽 양 끝을 손이 잡고 늘이는 연출).
    //   아이템 자체는 책상/부착 위치에 그대로 있고, 이 특정 지점들만 손을 따라감(frame()의 updateItemHandTrackers 참고).
    const handTrackers={};
    obj.traverse(o=>{
      if(/^hand[_-]?l$/i.test(o.name)) handTrackers.L=o;
      else if(/^hand[_-]?r$/i.test(o.name)) handTrackers.R=o;
    });
    if(handTrackers.L || handTrackers.R) pivot.userData.handTrackers = handTrackers;
    // ★ 관리자가 등록 시 "발광 효과"를 켜뒀으면(def.glow) 아이템 옆에 은은한 원형 빛 스프라이트를 추가함.
    // ★ 발광 효과 비활성화(요청사항: 발광 없는 게 나음) — 기존에 glow로 등록된 아이템도 더 이상 빛나지 않음.
    // if(def.glow) pivot.userData.glowSprite = applyGlowEffect(obj);
    // 클립 이름에 "idle"이 포함된 게 있으면 그걸, 없으면 첫 번째 클립을 클릭 시 재생용 idle 애니메이션으로 지정
    if(def.animations && def.animations.length){
      const mixer=new THREE.AnimationMixer(obj);
      const idleClip = def.animations.find(c=>/idle/i.test(c.name)) || def.animations[0];
      pivot.userData.itemMixer=mixer;
      pivot.userData.idleAction=mixer.clipAction(idleClip);
      // ★ 재생 방식: 'click'(기본, 클릭 시 1회), 'auto'(항상 반복재생), 'idle'(유저가 자리 비웠을 때만 반복재생).
      //   하위호환: 예전 아이템에 def.playMode가 없고 def.autoPlay:true면 'auto'로, 아니면 'click'으로 취급.
      const playMode = def.playMode || (def.autoPlay ? 'auto' : 'click');
      pivot.userData.playMode = playMode;
      if(playMode==='auto'){
        // ★ 관리자가 "자동 재생"으로 등록한 아이템 — 클릭 없이 바로, 계속 반복 재생됨(팬 돌아가기, 촛불 흔들리기 등 배경 연출용)
        pivot.userData.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        pivot.userData.idleAction.play();
        activeItemMixers.add(mixer);
      } else if(playMode==='idle'){
        // ★ 자리비움(idle) 감지 시에만 반복재생 — 매 프레임 체크(updateIdleItemPlayback)에서 켜고 끔.
        //   장착 시점엔 유저가 활동 중이라고 보고 정지 상태로 시작.
        pivot.userData.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        // 자동 등록: 매 프레임 체크에서 이 pivot을 볼 수 있게 컬렉션에 등록
        _idleItemPivots.add(pivot);
      } else {
        pivot.userData.idleAction.setLoop(THREE.LoopOnce,1);
        pivot.userData.idleAction.clampWhenFinished=true;
      }
    }
    if(def.custom){
      // 업로드된 커스텀 아이템: 책상처럼(normalizeDeskObj) 원본 GLB의 실제 크기(바운딩박스)를 재서
      //   목표 크기(가로/세로/높이 중 제일 큰 값 기준)에 자동으로 맞춤 — 원본을 얼마나 크게/작게 export했든
      //   항상 일정한 크기로 나옴(고정 배율 방식보다 훨씬 안정적).
      // ITEM_TARGET_SIZE: 관리자가 등록 시 개별 설정 안 했으면 쓰는 기본값(하위호환용). 개별 설정은 def.defaultSize 우선.
      const ITEM_TARGET_SIZE = (def.defaultSize!=null) ? def.defaultSize : 0.8;
      // ★ 본(스켈레톤)이 있는 모델은 바운딩박스가 실제 자세보다 낮게 잡히는 경우가 있어서(THREE.js가 rest pose
      //   기준으로 계산함) 기본 보정값을 둠. 아래 두 숫자만 조절하면 모든 커스텀 아이템의 시작 위치가 한번에 맞춰짐.
      const ITEM_Y_START_OFFSET = 1.1;   // 높이 보정 — 양수=더 위로, 음수=더 아래로 (고정값)
      const ITEM_Z_START_OFFSET = 0;      // 앞뒤 보정 — 양수=더 앞으로(카메라 쪽), 음수=더 뒤로
      obj.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(obj);
      const center=box.getCenter(new THREE.Vector3());
      // ★ 핵심: obj를 피봇 안에서 다시 배치 — 제작자가 원본 GLB에 잡아둔 원점이 어디든 상관없이,
      //   "메쉬 바닥 중앙"이 피봇의 원점(0,0,0)에 오도록 옮김. 이후 +/-(크기)나 회전은 항상 이 바닥중앙 기준으로
      //   자연스럽게 동작함(원래는 원본 원점 기준이라 크기 조절할 때마다 위치가 이상하게 튀었음).
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      obj.position.y -= box.min.y;
      const sz=box.getSize(new THREE.Vector3());
      const maxDim=Math.max(sz.x,sz.y,sz.z,0.001);
      const itemScale = isFinite(maxDim) ? ITEM_TARGET_SIZE/maxDim : 1;
      // 🔎 진단 로그(아이템 크기 컨텍스트 차이) — 문제 원인 파악 후 이 두 줄만 지우면 됨.
      const _parentSc = (holder && holder.desk) ? holder.desk.scale.x : (holder && holder.deskAnchor ? holder.deskAnchor.getWorldScale(new THREE.Vector3()).x : '?');
      console.log('[아이템크기]', def.id, '| holder=', holder===crState().cBase?'생성기':(holder===launcherPrevMod().lHolder()?'런처':'실행'), '| desk.scale=', _parentSc, '| maxDim=', maxDim.toFixed(3), '| itemScale=', itemScale.toFixed(3));
      pivot.userData.autoScale = itemScale;   // ★ "지금 이 컨텍스트에서" 계산된 순수 자동 크기값 — 저장/복원 시 사용자 조정 비율을 재적용하기 위해 별도 보관
      pivot.userData.adj={x:0,y:ITEM_Y_START_OFFSET,z:ITEM_Z_START_OFFSET,scale:itemScale,rot:0};
    } else {
      pivot.userData.adj={x:0,z:0,scale:1,rot:0};   // 기본 내장 아이템(화분/머그컵/책)은 이미 정확히 맞춰져 있어서 그대로
    }
    if(holder._itemAdjMemory[def.id]){
      // ★ y도 유지 — 유저가 기즈모로 조절한 아이템 높이가 다음 로드 시에도 반영되도록.
      const mem=Object.assign({}, holder._itemAdjMemory[def.id]);
      // 런처3-1: 색상은 별도로 pivot.userData.colors에 복원 (adj와 분리)
      if(mem._colors){ pivot.userData.colors = Object.assign({}, mem._colors); delete mem._colors; }
      Object.assign(pivot.userData.adj, mem);
    }
    holder.deskItems[def.id]=pivot; holder.activeDeskItem=pivot; applyDeskAdj(pivot);
    _rememberCrItemOrigin(holder, pivot);   // 새로 놓인 아이템의 처음 자리(불러온 저장값은 applyDeskItemsTo 가 다시 적는다)
    if(pivot.userData.colors) _applyItemColor(pivot);
    pivot.userData.holder = holder;   // 어플 8: idle 재생 판정에 필요 — 소유 좌석 상태를 알아야 함
    if(typeof crState().cBase!=='undefined' && holder===crState().cBase) deskSetupMod().selectDeskItemForAdjust(pivot);   // 생성기 안에서는 방금 장착한 아이템도 선택 표시
  }
}
function collectDeskItems(holder){ const d={}; let any=false; deskItemsMod().allDeskItems().forEach(def=>{ const p=holder.deskItems&&holder.deskItems[def.id]; if(p){ d[def.id]={adj:Object.assign({},p.userData.adj)}; if(p.userData.autoScale!=null) d[def.id].autoScale=p.userData.autoScale;
  // ★ 색상은 비어있어도 항상 저장 — "초기화(원본으로 복원)한 상태"를 명시적으로 기록해서
  //   실행 화면 로드 시 이전에 저장돼 있던 색이 남지 않게 함. 예전엔 빈 객체면 필드가 빠져서 초기화가 안 반영됐음.
  if(p.userData.colorGroups) d[def.id].colors=Object.assign({},p.userData.colors||{});
  any=true;} }); return any?d:null; }
/* ★ 생성기에서 책상 아이템을 켜고 끌 때 "완성 → 저장"을 눌러야만 반영되던 게 혼란을 줬음(꾸미기 파츠는
   토글 즉시 저장되는 것과 비대칭) — 아이템 켜고/끄는 즉시 여기서 바로 def에 반영 + 저장까지 함.
   단, 새 캐릭터(아직 한 번도 저장 안 한)일 땐 cBase.charDef가 없어서 조용히 건너뜀(완성 시 정상 저장됨). */
function autoSaveDeskItemsNow(){
  if(!crState().cBase || !crState().cBase.charDef) return;
  const def = crState().cBase.charDef;
  const di = collectDeskItems(crState().cBase);
  def.deskItems = di;
  if(di){
    const ci={}; Object.keys(di).forEach(id=>{ const c=customItems()[id]; const rec=commissionMod().savedItems().find(s=>s.id===id);
      if(c && !(rec&&rec.fromCatalog)) ci[id]={name:c.name,glb:c.glb}; });
    if(Object.keys(ci).length) def.customItems=ci;
  }
  slotSaveMod().saveSlots();
}
function applyDeskItemsTo(holder,data){ if(!data||!holder.deskAnchor)return; Object.keys(data).forEach(id=>{ const def=deskItemsMod().deskItemDef(id); if(!def)return; const e=data[id]; equipDeskItem(holder,def,true); const p=holder.deskItems[id]; if(p&&e.adj){
    const savedAdj=Object.assign({},e.adj);
    // ★ 예전엔 y를 자동 계산값(ITEM_Y_START_OFFSET)으로 강제 복원해서 저장값을 무시했음 — 유저가 기즈모로
    //   조절할 수 있는 UI가 없다고 가정한 옛 로직. 지금은 기즈모로 자유롭게 y 조작 가능하므로 저장값 그대로 씀.
    //   (y가 저장 안 된 옛 데이터는 그대로 undefined → applyDeskAdj에서 a.y||0으로 처리)
    // ★ 커스텀 아이템(자동 정규화 대상)이고 저장 당시의 autoScale 정보가 있으면 — "그때 화면에서 사용자가
    //   자동 크기 대비 얼마나 키우거나 줄였는지" 비율을 구해서, 지금 이 화면(생성기/런처/실행)에서 방금
    //   새로 계산된 autoScale에 그 비율을 곱해 절대 크기를 다시 환산함. 책상/좌석 스케일이 화면마다 다른
    //   시점에 적용돼도 아이템 크기가 항상 똑같이(ITEM_TARGET_SIZE 기준으로) 재현됨.
    //   (autoScale 정보가 없는 예전 저장 캐릭터는 예전처럼 절대값 그대로 사용 — 기존 모습 그대로 유지)
    if(e.autoScale && p.userData.autoScale){
      const userMul = (e.adj.scale!=null ? e.adj.scale : e.autoScale) / e.autoScale;
      savedAdj.scale = p.userData.autoScale * userMul;
    }
    // 🔎 진단 로그 2 — 최종 복원 단계. e.autoScale(저장된 자동값), e.adj.scale(저장된 최종값),
    //   p.userData.autoScale(지금 막 새로 계산된 값), savedAdj.scale(이번에 실제로 적용될 최종값)을 비교.
    console.log('[아이템크기-복원]', id, '| holder=', holder===crState().cBase?'생성기':(holder===launcherPrevMod().lHolder()?'런처':'실행'),
      '| 저장된 autoScale=', e.autoScale, '| 저장된 adj.scale=', e.adj.scale,
      '| 지금 계산된 autoScale=', p.userData.autoScale, '| 최종 적용 scale=', savedAdj.scale,
      '| rot=', savedAdj.rot);   // 🔄 [제보 4] 회전이 저장까지 왔는지 한눈에
    Object.assign(p.userData.adj,savedAdj);applyDeskAdj(p);
    _rememberCrItemOrigin(holder, p);   // 불러온 자리가 이 아이템의 처음 자리
    // ★ 런처3-1: 저장된 아이템 색상(colors) 복원 — 그룹별로 material.color/emissive를 갱신.
    //   저장된 colors에 없는 그룹은 원본색(origColor)으로 강제 복원 — 예전에 저장된 색이 남지 않게.
    if(p.userData.colorGroups){
      p.userData.colors = Object.assign({}, e.colors||{});
      Object.keys(p.userData.colorGroups).forEach(key=>{
        if(p.userData.colors[key]!=null) return;   // 저장된 색은 아래 _applyItemColor가 처리
        // 원본 색으로 복원
        (p.userData.colorGroups[key]||[]).forEach(m=>{
          if(!m.material || !m.userData.origColor) return;
          const hex='#'+m.userData.origColor;
          if(m.material.color) m.material.color.set(hex);
          if(m.material.emissive){
            const flat=lightToneMod.baseFlatOf(m.material);
            m.material.emissive.copy(m.material.color).multiplyScalar(flat);
            m.material.needsUpdate=true;
          }
        });
      });
      _applyItemColor(p);
    }
  } }); }
// 색상 그룹의 실제 material에 저장된 색을 반영 (파츠의 applyColor와 같은 로직)
function _applyItemColor(pivot){
  if(!pivot || !pivot.userData || !pivot.userData.colorGroups || !pivot.userData.colors) return;
  Object.keys(pivot.userData.colors).forEach(key=>{
    const val = pivot.userData.colors[key];
    const meshes = pivot.userData.colorGroups[key] || [];
    meshes.forEach(o=>{
      if(!o.material) return;
      if(o.material.color) o.material.color.set(val);
      if(o.material.emissive){
        const flat = lightToneMod.baseFlatOf(o.material);
        o.material.emissive.copy(o.material.color).multiplyScalar(flat);
        o.material.needsUpdate = true;
      }
    });
  });
}

return {
  applyDeskAdj,
  deskItemOrigin,
  equipDeskItem,
  collectDeskItems,
  autoSaveDeskItemsNow,
  applyDeskItemsTo,
  _applyItemColor,
};
}

const api = { createDeskItemEquip };
if(typeof window !== 'undefined') window.TwDeskItemEquip = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
