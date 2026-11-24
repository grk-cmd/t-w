/* part-equip.js — 🎀 파츠 붙이기 · 떼기 · def 대조(앱 FSD · app.js 분리 T6)
   app.js «WARDROBE PARTS (꾸미기 파츠 부착)» 의 본 찾기 · equipPartOnSeat · 떼기 · 좌석 def 와 대조 · 저장된 파츠 한꺼번에 입히기를 0.13 app.js 글 그대로 옮긴 모듈이다.
   복제 · 재질 · _col · _pic · 리깅 판정 · 다시 묶기 · wrapper 는 캐릭터 코어(createParts) 호출이고, 좌석 몫(장착 차례 · 옷 겹침 · 귀 까닥임 · 애니메이션 · 진단)이 여기 남는다.
   0.12.4 에만 있는 #830(같은 뼈대 한 벌)의 skelShare.shareSkeletons 두 줄(본체 · 다중 파츠 사본)은 그대로 있다(0.13 글에도 있다 — sim-skeleton-share 가 지킨다).
   ・책임: extractBonesInto · equipPartOnSeat · _invalidatePendingEquip · _disposeWrapperFromSeat · _sweepOrphanPartWrappers · _refitAfterUnequip · unequipPartFromSeat · unequipStackablePart · pruneSeatPartsAgainstDef · _equipWarnOnce · applyEquippedPartsToSeat(+ 귀 이름 판별 둘).
   ・받는 deps 21 — 값 premiumMod · rideBenchMod · seatRefitMod · skelShare · partsCore · 옛 이름으로 받은 part-xf · cloth-visibility · part-anim 함수들 · 함수 boneSide · _diagRiggedPartAlignment · 읽는 함수 partSceneMod(뒤에서 만들어진다).
   ・내놓는 것: 밖에서 부르는 아홉(extractBonesInto · equipPartOnSeat · unequipPartFromSeat · unequipStackablePart · pruneSeatPartsAgainstDef · applyEquippedPartsToSeat · _invalidatePendingEquip · _disposeWrapperFromSeat · _sweepOrphanPartWrappers) — app.js 는 같은 이름 const 로 받는다.
   ⚠️ 진행 중이던 비동기 장착은 _invalidatePendingEquip 의 번호로 무효화한다(파츠 GLB 가 늦게 와도 떼인 파츠가 되살아나지 않게). 순서를 바꾸지 말 것.
   검사: checks/sim-part-equip-mod.js */
(function(){

function createPartEquip(deps){
const premiumMod = deps.premiumMod;
const rideBenchMod = deps.rideBenchMod;
const seatRefitMod = deps.seatRefitMod;
const skelShare = deps.skelShare;
const partsCore = deps.partsCore;
const partSceneMod = deps.partSceneMod;   // 읽는 함수
const boneSide = deps.boneSide;
const _diagRiggedPartAlignment = deps._diagRiggedPartAlignment;
const _applyXfToWrapper = deps._applyXfToWrapper;
const _computeAnimalHeadDy = deps._computeAnimalHeadDy;
const _computePartAuthorOffset = deps._computePartAuthorOffset;
const _diagPartHeadSpace = deps._diagPartHeadSpace;
const applyPartXf = deps.applyPartXf;
const _unequipClothCat = deps._unequipClothCat;
const applyClothVisibility = deps.applyClothVisibility;
const _clipHasMotion = deps._clipHasMotion;
const _partAnimNotice = deps._partAnimNotice;
const _pickPartClip = deps._pickPartClip;
const _setupPartIdleAnim = deps._setupPartIdleAnim;
const _stripPartClipOwnedTracks = deps._stripPartClipOwnedTracks;
const _teardownPartIdleAnim = deps._teardownPartIdleAnim;
// 루트에서 본(스켈레톤)을 찾아 seat류 객체(.bones)에 채워넣는 공용 헬퍼 — 꾸미기 파츠를 붙일 부착점을 찾는 데 필요함.
// setupSeatModel(런타임 좌석)뿐 아니라 런처/생성기 미리보기처럼 가벼운 컨텍스트에서도 재사용.
function extractBonesInto(target, root){
  target.bones={spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]};
  root.traverse(o=>{ if(o.isBone){ const n=o.name.toLowerCase();
    if(!target.bones.spine&&(n.includes('spine')||n.includes('chest')||n.includes('torso')))target.bones.spine=o;
    if(!target.bones.head&&n.includes('head'))target.bones.head=o;
    if(n.includes('hand')||n.includes('arm')){const s=boneSide(n);
      if(s==='l'&&!target.bones.handL)target.bones.handL=o; if(s==='r'&&!target.bones.handR)target.bones.handR=o;}
    if(n.includes('leg')||n.includes('thigh')){const s=boneSide(n);
      if(s==='l'&&!target.bones.legL)target.bones.legL=o; if(s==='r'&&!target.bones.legR)target.bones.legR=o;}
    if(n.includes('ear'))target.bones.ear.push(o);
  }});
  target.equippedPartObjs = target.equippedPartObjs || {};
}
/* 🐰 귀 파츠에서 '까닥일 대상'을 찾는다 ───────────────────────────────────────
   [증상] 귀 본이 들어 있는 귀 파츠 일부가 까닥이지 않고, 대신 파츠가 통째로 앞뒤로 크게 움직인다.
   [원인 1 — 이름 판정] 예전 판정은 `^ear[_-]?[lr]$` 라서 구분자를 '_'·'-' 만 받았다.
     블렌더의 좌우 대칭 접미사는 **'.L/.R' 이 표준**이라 `ear.L`·`Ear.R` 로 저작된 파츠는
     통째로 안 걸렸다. 안 걸리면 그 파츠는 부착 본(head)만 따라가므로, 화면에서는
     '까닥임 없이 머리 끄덕임을 따라 앞뒤로 움직이는' 것으로 보인다.
   [원인 2 — 같은 이름이 둘] 블렌더에서 오브젝트 이름까지 'ear_L' 이면 GLB 안에 같은 이름의
     **노드(메쉬/빈 오브젝트)와 본**이 같이 들어온다. 노드 쪽이 잡히면 회전 피봇이 파츠 원점이라
     귀가 제자리에서 까닥이는 대신 큰 호를 그리며 앞뒤로 흔들린다 — 제보의 그 증상이다.
   [대책] 구분자를 넓히고, 본이 하나라도 잡히면 **본만** 쓴다. 이미 잡힌 것의 자손도 뺀다
     (부모와 자식을 같이 돌리면 각도가 두 배로 먹는다).
   ⚠️ 'earring'(귀걸이) 처럼 ear 로 시작만 하는 이름은 잡으면 안 된다. 'ear' 뒤에 남는 것이
     좌우 표시와 번호뿐일 때만 참으로 본다. 'DEF-ear.L' 처럼 앞에 접두어가 붙는 리그도 있어서
     구분자로 끝나는 접두어 하나까지는 허용한다('spear' 는 구분자가 없으므로 안 걸린다). */
function _isEarObjName(n){
  return /^(?:[a-z0-9]+[._\- ])?ear(?:[._\- ]?(?:l|r|left|right))?(?:[._\- ]?\d+)*$/i
    .test(String(n||'').trim());
}
function _collectPartEarObjs(obj, cat){
  const hit = [];
  obj.traverse(o=>{ if(_isEarObjName(o.name)) hit.push(o); });
  const bones = hit.filter(o=>o.isBone);
  const pool  = bones.length ? bones : hit;   // 본이 아예 없는 리지드 귀 파츠는 노드라도 쓴다
  const out = pool.filter(o=>{
    for(let p=o.parent; p; p=p.parent) if(pool.indexOf(p)>=0) return false;
    return true;
  });
  /* 🩺 진단 — 이 판정은 실패해도 아무 에러가 안 난다(그냥 안 까닥일 뿐이라 원인을 못 찾는다).
     그래서 잡힌 것과 못 잡은 이유를 반드시 남긴다. */
  try{
    if(out.length){
      console.log('[파츠 귀] '+cat+' — 까닥일 대상 '+out.length+'개: '+out.map(o=>o.name).join(', ')
        + (hit.length !== out.length
            ? ' (같은 이름으로 '+hit.length+'개가 잡혀 '+(bones.length?'본':'최상위')+'만 씀)' : ''));
    }else{
      const all = []; obj.traverse(o=>{ if(o.isBone) all.push(o.name); });
      if(all.length) console.log('[파츠 귀] '+cat+' — 귀로 볼 이름의 본이 없음. 파츠 본: '+all.join(', ')
        + ' → ear_L / ear.R / Ear.L 처럼 지으면 까닥임에 등록됩니다.');
    }
  }catch(_){}
  return out;
}
async function equipPartOnSeat(seat, cat, rec, opts){
  if(!seat) return;
  seat.equippedPartObjs = seat.equippedPartObjs || {};
  // 🔗 stackable 모드: rec.stackable=true인 파츠는 seat.stackedPartObjs[cat][id]에 저장.
  //   기존 파츠(같은 카테고리의 다른 파츠들)를 지우지 않고 함께 유지.
  const stackable = !!(rec && rec.stackable);
  if(stackable){
    seat.stackedPartObjs = seat.stackedPartObjs || {};
    seat.stackedPartObjs[cat] = seat.stackedPartObjs[cat] || {};
  }
  /* ⚠️ 여기가 **조용한 실패 지점**이었다. 카테고리가 PART_CATS 에 없으면 아무 흔적도 없이
     돌아간다 — 화면에는 "파츠를 눌렀는데 아무 일도 안 일어난다"로만 보인다.
     PART_CATS = BUILTIN + customPartCats(Firebase 구독)라, 커스텀 카테고리는 구독이 아직
     안 왔거나 실패하면 여기서 걸린다. 아래 '부착할 자리 없음' 경고와 같은 급의 사건이므로
     같이 남긴다(세션당 카테고리별 1회 — 매 프레임 도배되지 않게). */
  const info = premiumMod.partCatInfo(cat);
  if(!info){
    _equipWarnOnce('cat:'+cat, '[파츠] 카테고리 정보를 못 찾아 장착을 건너뜁니다: '+cat
      + ' — PART_CATS 에 없습니다(커스텀 카테고리 구독 미도착/실패일 수 있음). 파츠 id: '+(rec&&rec.id));
    return;
  }
  // ★ Phase 5: 옷 카테고리 충돌 정리 — 새로 착용할 파츠의 rec.hides와 겹치는 부위를 요구하는 기존 파츠는 해제.
  //   예) 원피스(hides:['top','bottom']) 착용 → 티셔츠(hides:['top'])는 상의 겹침 → 티셔츠 해제.
  //   예) 겉옷(hides:[]) 착용 → 아무것도 안 겹치므로 상의 유지.
  //   ★ getRecHides로 sentinel/Firebase 객체 정규화 (null 반환 시엔 옛 파츠 → 관례 fallback)
  if(rec && info.group==='cloth'){
    const explicit = premiumMod.getRecHides(rec);
    const newHides = (explicit !== null) ? explicit
      : (cat==='onepiece' ? ['top','bottom','onepiece']
        : cat==='cape' ? []
        : [cat]);   // 하위호환
    ['top','bottom','onepiece','cape'].forEach(other=>{
      if(other===cat) return;
      const entry = premiumMod.firstEntryForCat(seat.charDef, other);
      if(!entry) return;
      const otherId = premiumMod.partEntryId(entry);
      const otherRec = premiumMod.savedParts().find(p=>p.id===otherId);
      const otherExplicit = premiumMod.getRecHides(otherRec);
      const otherHides = (otherExplicit !== null) ? otherExplicit
        : (other==='onepiece' ? ['top','bottom','onepiece']
          : other==='cape' ? []
          : [other]);
      // 두 파츠가 hide하는 부위 중 겹치는 게 하나라도 있으면 충돌 → 기존 파츠 해제
      const overlap = newHides.some(h=>otherHides.includes(h));
      if(overlap) _unequipClothCat(seat, other);
    });
  }
  // 기존 같은 카테고리 파츠 제거 — stackable 모드에서는 이 파츠 id만 해제.
  //   non-stackable 모드에서는 기존 non-stackable만 교체하고, stackable 파츠들(공존 중)은 유지.
  if(stackable){
    unequipStackablePart(seat, cat, rec.id);
    // ★ 같은 파츠가 예전에 non-stackable로 붙어 있었으면 함께 제거 —
    //   rec.stackable이 카탈로그 동기화로 뒤바뀌면 두 경로에 동시에 존재하게 되고, 그게 유령의 원인.
    const _prevMain = seat.equippedPartObjs && seat.equippedPartObjs[cat];
    if(_prevMain && _prevMain.userData && _prevMain.userData.partId === rec.id){
      _disposeWrapperFromSeat(seat, _prevMain);
      delete seat.equippedPartObjs[cat];
    }
  } else {
    unequipPartFromSeat(seat, cat, false);   // false = stackable 파츠들 유지
    // ★ 반대 경우 — 같은 파츠가 stackable로 붙어 있었으면 제거
    if(rec && seat.stackedPartObjs && seat.stackedPartObjs[cat] && seat.stackedPartObjs[cat][rec.id]){
      unequipStackablePart(seat, cat, rec.id);
    }
  }
  if(!rec){ applyClothVisibility(seat); return; }   // rec 없으면 해제만 + 기본 메시 가시성 갱신
  const bone = premiumMod.partAttachTarget(seat, info);
  if(!bone){ console.warn('부착할 자리 없음:', info.bone,
    premiumMod.isDeskPartCat(info) ? '(책상 카테고리인데 이 좌석에 deskAnchor 가 없음)' : ''); return; }
  // ★ 이중 장착 레이스 가드 — 캐릭터 로드 시 applyEquippedPartsToSeat가 두 경로(초기 로드 + 카탈로그
  //   구독 재시도)에서 거의 동시에 호출될 수 있음. GLB 파싱이 비동기라 늦게 끝난 쪽이 equippedPartObjs를
  //   덮어쓰고 먼저 끝난 쪽 wrapper는 씬에 유령으로 남는 문제(같은 파츠 두 개 + 해제해도 하나 남음).
  //   시퀀스 토큰으로 "이 카테고리(+stackable이면 id)에 대해 가장 마지막에 시작된 장착"만 부착 완료하게 함.
  seat._equipSeq = seat._equipSeq || {};
  const seqKey = stackable ? (cat + ':' + rec.id) : cat;
  const mySeq = (seat._equipSeq[seqKey] = (seat._equipSeq[seqKey] || 0) + 1);
  try{
    const {scene, animations} = await partSceneMod().getPartScene(rec);
    // ★ 파싱 대기 중에 같은 카테고리에 새 장착이 시작됐다면 이건 낡은 호출 — 부착하지 않고 중단.
    if(seat._equipSeq[seqKey] !== mySeq) return;
    /* 복제 · 재질 톤 · _col 색 묶음 · _pic 그림칸(UV 구제) · 이 파츠 본에 _partAdopted 표식 — 코어.
       ⚠️ 표식은 뒤에 붙는 파츠가 이 본을 캐릭터 본으로 오인해 리바인드하지 않게 하는 것(비리깅 파츠의 ear 본 등). */
    const { obj, colorGroups, picMeshes } = partsCore.prepareScene(scene, cat, {
      onPicUvRepaired: (o)=>_equipWarnOnce('uv2:'+cat+':'+(rec&&rec.id),
        '[파츠] UV 가 두 번째 칸에 있어 첫 칸으로 옮겼습니다 — cat=' + cat + ' mesh=' + (o.name||'이름없음')
        + ' / 블렌더에서 비어 있는 첫 UV 맵을 지우고 다시 내보내는 것이 정식 수정입니다.'),
      onUvBroken: (o)=>_equipWarnOnce('uv2warn:'+cat+':'+(rec&&rec.id),
        '[파츠] 텍스처가 있는데 첫 UV 칸이 비었습니다 — cat=' + cat + ' mesh=' + (o.name||'이름없음')
        + ' / 파츠가 단색으로 보인다면 이게 원인입니다(블렌더 UV 맵 순서).'),
    });
    /* ★ 여기서 모으는 것은 **이 파츠 자신의** 귀 본이다(캐릭터 본이 아니다).
       ⚠️ 예전에는 standalone(🧷 단독 부착) 파츠를 통째로 건너뛰었는데, 그건 과잉 방어였다.
         🧷 의 약속은 "캐릭터의 같은 이름 본에 **자동 연결**하지 않는다"이고, 그 약속을 지키는 것은
         아래 리깅 판정(standalone → isRigged 강제 false)과 _partAdopted 표식이다.
         파츠 자신의 본을 까닥임 목록에 넣는 것은 캐릭터 본과 아무 상관이 없는데도 같이 막혀 있어서,
         귀 파츠에 🧷 를 켜면(=커미션 캐릭터의 귀에 딸려가지 말라고 켜는 바로 그 경우) 귀가
         영영 안 까닥이는 상태가 됐다. 그래서 standalone 여부와 무관하게 모은다. */
    const partEarObjs = _collectPartEarObjs(obj, cat);
    // ★ seat.boneRest.ear가 아직 없는(캐릭터 로딩 초기 등) 시점에 파츠가 먼저 부착되면 여기서 에러가
    //   나서 이 파츠뿐 아니라 이후 파츠 부착 전체가 조용히 실패하던 심각한 버그가 있었음 — 방어 추가.
    if(!seat.boneRest) seat.boneRest={};
    if(!seat.boneRest.ear) seat.boneRest.ear=[];
    // ※ 실제 ear 등록은 아래 "리깅 판정" 이후에 함 — 리깅(옷) 파츠는 캐릭터 스켈레톤이 움직임을
    //   담당하므로 귀 까닥임 시스템에 등록하면 안 되기 때문(옷 파츠 ≠ 귀 파츠, 기능 분리).
    // ★ 어플 6: 리깅(스키닝) 파츠 감지 — 파츠 GLB가 캐릭터와 같은 본 이름으로 스키닝돼 있으면
    //   (예: 기본 캐릭터 아마추어로 제작한 망토/옷) 리지드 부착 대신 캐릭터의 실제 본에 리바인드해서
    //   캐릭터 애니메이션(타이핑/절차 모션)을 그대로 따라 움직이게 함.
    const charBones = {};   // 캐릭터 본 이름 → Bone (파츠 추가 전에 수집해야 파츠 자신의 본과 안 섞임)
    // ★ 캐릭터 모델 루트는 컨텍스트마다 이름이 다름 — 실행 좌석(gltfRoot), 런처/생성기/꾸미기 미리보기(root),
    //   그 외(bodyWrap/group). 순서대로 찾아서 어느 화면에서든 본 수집이 되게 함(런처 미리보기 리깅 누락 버그 수정).
    const charRoot = seat.gltfRoot || seat.root || seat.bodyWrap || seat.group || null;
    /* 🎩 저작 오프셋 계산 전용 기준 노드 — charRoot와 구분해야 한다.
       ・charRoot : wrapper를 실제로 매다는 부모(리깅 파츠)·본 수집 범위. 실행 좌석에선 fitModel이
                    scale을 얹는 보호 wrap.
       ・modelRoot: 본과 메쉬가 들어 있는 노드. 그 로컬 단위가 파츠 GLB가 저작된 '리그 원본 단위'다.
       인간·커미션은 wrap 안의 root가 scale 1이라 두 노드의 로컬 좌표계가 같아서 결과가 동일하다.
       동물만 다르다 — buildAnimalBase가 root에 normalizeModel(배율 0.1765)을 걸어두기 때문에,
       charRoot로 재면 본 위치가 5.7배 작게 나와 판정과 환산이 통째로 어긋난다. */
    const modelRoot = seat.modelRoot || seat.root || charRoot;
    // ★ 다른 파츠가 입양시킨 본(_partAdopted)은 캐릭터 고유 본이 아니므로 제외 — 안 그러면 나중에 장착한
    //   파츠(예: 동물귀)가 먼저 장착된 옷(cape)의 ear 본에 리바인드돼서 옷의 본을 따라가는 버그가 생김.
    const _collectCharBones = ()=>partsCore.collectCharBones(charRoot, charBones);
    _collectCharBones();
    // ★ 원격 좌석 초기화 레이스 방어 —
    //   상대 화면은 "캐릭터 GLB 로드 → 파츠 장착"이 연달아 일어나서, 스켈레톤이 완성되기 전에
    //   리깅 파츠가 먼저 도착하면 charBones가 비어 리깅 판정이 실패 → 비리깅 경로로 부착돼
    //   좌표 체계가 달라짐(= 상대 화면에서만 귀 파츠가 어긋나는 증상).
    //   캐릭터가 스킨드 메시를 쓰는데(=본이 있어야 정상) 본이 아직 안 보이면 잠시 기다렸다 재수집.
    {
      const _hasSkinnedChar = partsCore.hasSkinnedChar(charRoot);
      let _waited = 0;
      while(_hasSkinnedChar && Object.keys(charBones).length < 2 && _waited < 3000){
        await new Promise(r=>setTimeout(r, 150)); _waited += 150;
        if(seat._equipSeq[seqKey] !== mySeq) return;   // 그 사이 새 장착이 시작됐으면 중단
        _collectCharBones();
      }
    }
    const skinnedMeshes = partsCore.skinnedMeshesOf(obj);
    // "리깅 파츠" 판정: SkinnedMesh가 있고 조인트의 **과반수 이상**이 캐릭터 본과 이름 일치.
    //  → 실수로 armature와 함께 export된 리지드 파츠(1~2개만 우연히 이름 겹치는 경우)를 리깅으로
    //    오탐지해서 기즈모가 사라지는 버그를 방지(요청사항 B).
    // ★ standalone 파츠는 리깅 판정 강제 false — 파츠 본이 캐릭터 본에 매핑되지 않도록 해서
    //   비리깅 방식(info.bone에 wrapper 단위로 부착)으로 처리됨(버그2). 커미션 캐릭터의 기존 ear 등에
    //   파츠가 딸려가지 않고, 관리자가 지정한 카테고리 본(head 등) 기준으로 자유롭게 위치 조정 가능.
    // ★ 이름이 같아도 리그가 같다는 보장은 없다. 특히 동물 캐릭터는 사람과 rest pose·비율이 전혀 달라서,
    //   'head' 하나가 우연히 일치한 사람용 모자를 리바인드하면 파츠의 boneInverses와 동물 본의 월드 행렬이
    //   맞지 않아 메쉬가 길게 늘어난다(→ 그 늘어난 박스를 실측하는 상태칩까지 위로 날아감).
    //   본이 1~2개뿐인 파츠를 리깅으로 인정하는 완화 규칙은 같은 리그 계열(비동물)에만 적용한다.
    const _rigFamilyMatches = !(seat.charDef && seat.charDef.animal);
    /* 🪑 책상 파츠는 리깅 판정을 아예 안 탄다. 리깅으로 잡히면 캐릭터 스켈레톤에 리바인드되어
       charRoot 에 붙는데, 그러면 '캐릭터를 안 따라온다'는 이 카테고리의 존재 이유가 사라진다.
       (등록창의 🧷 단독 부착을 강제로 켠 것과 같은 상태다) */
    const _deskPart = premiumMod.isDeskPartCat(info);
    // 본이 전부 일치하면 개수와 무관하게 리깅(head 하나짜리 모자) — 같은 리그 계열일 때만(코어 isRiggedPart)
    const isRigged = partsCore.isRiggedPart(skinnedMeshes, charBones, { standalone:_deskPart || !!rec.standalone, rigFamilyMatches:_rigFamilyMatches });   // 책상 파츠는 캐릭터를 따라오면 안 되므로 단독 부착처럼
    let adoptedBones = [];   // 캐릭터에 없어서 캐릭터 본 밑으로 입양시킨 파츠 본들(해제 시 제거용)
    // ── 🐰 귀 파츠 기능과 분리 ──
    //   리깅(옷) 파츠: 캐릭터 스켈레톤에 리바인드되므로 캐릭터의 진짜 귀 본이 움직임을 담당한다.
    //     파츠 안의 ear_L/ear_R 본을 귀 까닥임 목록에 넣으면 안 됨(리바인드 후 쓰이지도 않는 본이라
    //     목록만 오염되고, 옷 파츠가 귀 파츠 동작에 얽히게 됨).
    //   비리깅(귀 등 부착형) 파츠: 기존대로 ear_L/ear_R를 귀 애니메이션 시스템에 등록해 같이 까닥임.
    if(isRigged || _deskPart){
      // 리깅 파츠는 캐릭터 본이 움직임을 담당하고, 책상 파츠는 애초에 캐릭터와 무관하다 —
      // 둘 다 귀 까닥임 목록에 넣으면 안 된다(책상 위 물건이 귀처럼 까닥인다).
      partEarObjs.length = 0;
    }else if(partEarObjs.length && seat.bones && seat.bones.ear){
      partEarObjs.forEach(o=>{ seat.bones.ear.push(o); seat.boneRest.ear.push(o.quaternion.clone()); });
      /* 타이머는 개수로만 재생성 여부를 판단한다(animateRig). 귀 2개짜리 파츠를 다른 귀 2개짜리로
         갈아끼우면 개수가 그대로라 옛 타이머가 남고, 새 파츠가 남의 까닥임 도중 자세로 시작한다.
         등록이 바뀌었으면 그냥 새로 만들게 한다(_registerAnimalEarOn 과 같은 처리). */
      seat.earTimers = null;
    }
    // 🩺 리깅 판정 진단 — 본이 들어있는데 리깅으로 인식되지 않으면 이유를 남김(스키닝 누락/이름 불일치 구분용)
    if(!isRigged && !rec.standalone && !_deskPart){
      let _boneCount = 0; obj.traverse(o=>{ if(o.isBone) _boneCount++; });
      if(_boneCount > 0){
        const _detail = skinnedMeshes.map(sm=>{
          const t = sm.skeleton ? sm.skeleton.bones.length : 0;
          const m = sm.skeleton ? sm.skeleton.bones.filter(b=>!!charBones[b.name]).length : 0;
          return sm.name+'('+m+'/'+t+' 일치)';
        }).join(', ');
        console.log('[파츠 리깅] '+cat+' — 본 '+_boneCount+'개가 있지만 리깅 파츠로 인식되지 않음. '
          +'스킨드메시 '+skinnedMeshes.length+'개'+(_detail?(' ['+_detail+']'):'')
          +' / 캐릭터 본 '+Object.keys(charBones).length+'개.'
          +(skinnedMeshes.length===0 ? ' → 메쉬에 아마추어 스키닝(Armature Deform)이 안 걸려 있을 가능성이 큽니다.' : ' → 본 이름이 캐릭터와 달라 과반수 일치에 실패했을 가능성이 큽니다.'));
      }
    }
    if(isRigged){
      // 캐릭터 본으로 다시 묶고(없는 본은 조상 본 밑으로 입양) 바인드 공간 스킨 중심(xf 피봇)을 잰다 — 코어
      const _rb = partsCore.rebindRigged(skinnedMeshes, charBones);
      const bindCenter = _rb.bindCenter;
      adoptedBones = _rb.adoptedBones;
      // wrapper에 기록 — applyPartXf가 이 피봇 기준으로 bindMatrix 오프셋을 합성
      // (wrapper.userData는 아래 wrapper 생성 후 세팅되므로 임시 보관)
      obj.userData._rigBindCenter = bindCenter;
      obj.userData._rigSkinnedMeshes = skinnedMeshes;
      console.log('[파츠 리깅] '+cat+' — 스킨드메시 '+skinnedMeshes.length+'개를 캐릭터 본에 리바인드'+(adoptedBones.length?(', 입양 본 '+adoptedBones.map(b=>b.name).join('/')):''));
      // 🩺 리깅으로 붙었는데도 파츠가 뜨는 경우의 원인 확정용 — 아래 함수 주석 참고.
      _diagRiggedPartAlignment(cat, skinnedMeshes, charRoot);
    }
    // 리깅 파츠는 캐릭터 뼈로 다시 묶였으니 몸 · 다른 파츠의 Skeleton 과도 맞춰 본다(뼈 · 역행렬이 같을 때만 함께 씀)
    skelShare.shareSkeletons(skinnedMeshes, isRigged ? skelShare.skinnedMeshesOf(charRoot) : []);
    // 메시 중심을 피봇으로 만들기 위해 wrapper 그룹에 감싸기 (회전·스케일이 중심 기준)
    //  — 리깅 파츠는 본이 위치를 결정하므로 재중심화하지 않고 원본 좌표 그대로 둠
    const { wrapper, bb, center } = partsCore.wrapPart(obj, cat, isRigged);   // baseCenter 는 applyPartXf 가 쓴다
    /* 🎩 저작 오프셋 — "캐릭터에 씌운 채 저작된 파츠"가 머리 위로 공중부양하던 문제(핸드오프 3장 0번)
       보정량. 원점 기준 저작 파츠·리깅 파츠는 null 이라 기존 동작 그대로다.
       판정 근거는 콘솔 [파츠 저작오프셋] 참고. **캐릭터 본에 붙는 파츠 전용**이다.
       🪑 책상 카테고리(bone:'desk')는 제외한다.
       [경위] 이 보정은 부착 대상이 '캐릭터 리그 안의 본'이고 파츠 중심과 본이 같은 리그 단위라는 것을
         전제로 계산한다. 그런데 책상 파츠의 부착 대상은 seat.deskAnchor 로, 책상 그룹 아래에 있어
         월드 배율이 0.175(동물은 ×0.4 로 0.07)다. 그 상태로 아래 폴백 경로를 타면
             want = modelRoot.localToWorld(center); bone.worldToLocal(want);
         에서 deskAnchor 의 작은 배율로 나누느라 want 가 5.7~14배로 튀고, off = center - want 가
         엉뚱하게 커진다. 그 값을 wrapper.position 에서 빼기 때문에 파츠가 책상을 떠나
         캐릭터 얼굴 높이 같은 곳에 나타난다(제보: 보관함에서 위치를 잡아도 꾸미기 미리보기에서 얼굴 가운데).
       ★ 책상 파츠는 애초에 '캐릭터에 씌운 채 저작' 이라는 사고가 성립하지 않는다 —
         평평한 앵커 위에 놓는 것이라 상쇄할 것이 없다. 판정을 시도하지 말고 통째로 건너뛴다.
       ⚠️ 이 수정 전에 책상 파츠 위치를 기즈모로 맞춰뒀다면, 그 xf.pos 는 엉뚱한 보정을 되밀던
         값이라 한 번 다시 잡아줘야 한다(_isLegacyAuthorCompensation 은 본 파츠 기준이라 여기선 안 돈다). */
    wrapper.userData.authorOff = (isRigged || premiumMod.isDeskPartCat(info)) ? null
      : _computePartAuthorOffset(bb, center, bone, modelRoot, cat, charBones);
    // 🐾 동물 머리 파츠 세로 보정 — 사람 리그 기준으로 앉은 파츠를 이 캐릭터의 머리 꼭대기에 맞춘다.
    wrapper.userData.animalHeadDy = _computeAnimalHeadDy(seat, info, cat, bone, modelRoot, isRigged, wrapper.userData.authorOff);
    // 🩺 머리 계열 파츠는 캐릭터별 머리 크기·높이가 제각각이라 여기서 실측을 남긴다.
    if(info.group === 'head') _diagPartHeadSpace(cat, modelRoot, bone, bb, center, seat, isRigged);
    wrapper.userData.cat = cat;
    wrapper.userData.partId = rec.id;   // ★ applyPartXf가 카테고리가 아니라 '이 파츠'의 entry를 되찾기 위한 표식
    wrapper.userData.__twPartWrap = true;   // ★ 유령 청소 대상 표식 — 이름만 보고 지우면 동물 귀 등 다른 부속까지 지울 위험
    wrapper.userData.rigged = isRigged;             // ★ 리깅 파츠 표시 — xf는 bindMatrix로 적용됨
    if(isRigged){
      wrapper.userData.rigBindCenter = obj.userData._rigBindCenter || new THREE.Vector3();
      wrapper.userData.rigSkinnedMeshes = obj.userData._rigSkinnedMeshes || [];
    }
    wrapper.userData.adoptedBones = adoptedBones;   // 해제 시 캐릭터 본에서 다시 떼어내기 위해 기억
    wrapper.userData.colorGroups = colorGroups;   // 색상 변경 대상 그룹 { col1:[mesh,...], col2:[...] }
    wrapper.userData.picMeshes  = picMeshes;      // 🖍️ 그릴 수 있는 면(비어 있으면 연필 버튼이 안 뜬다)
    // 🎨 진단 로그 — "색상/색조 행이 안 보인다"를 자가 진단할 수 있게, 감지된 _col 그룹과 모드를 남긴다.
    //   그룹이 0개면 메쉬·머터리얼 이름에 _col이 없다는 뜻(대소문자 무관, _col2 같은 번호도 가능).
    try{
      const _gk = Object.keys(colorGroups);
      if(!_gk.length){
        const _names = [];
        obj.traverse(o=>{ if(o.isMesh) _names.push(o.name + (o.material&&o.material.name ? ('/'+o.material.name) : '') + (o.material&&o.material.map?' [텍스처]':'')); });
        console.log('[파츠 색상] '+cat+' — _col 그룹 없음. 메쉬/머터리얼 이름:', _names.join(', ') || '(메쉬 없음)');
      } else {
        console.log('[파츠 색상] '+cat+' — 감지된 그룹: ' + _gk.map(k=>{
          const hue = colorGroups[k].some(m=>m.material && m.material.map);
          return k+'('+(hue?'색조·텍스처 있음':'색상·단색')+', 메쉬 '+colorGroups[k].length+'개)';
        }).join(', '));
      }
    }catch(_){}
    wrapper.userData.partEarObjs = partEarObjs;   // 해제 시 seat.bones.ear에서 제거하기 위해 기억
    // ★ 관리자가 등록 시 "발광 효과"를 켜뒀으면(rec.glow) 파츠 옆에 은은한 원형 빛 스프라이트를 추가함.
    // ★ 발광 효과 비활성화(요청사항) — 파츠도 동일하게 발광 적용 안 함.
    // if(rec.glow) wrapper.userData.glowSprite = applyGlowEffect(obj);
    // 클립 이름에 "idle"이 포함된 게 있으면 반복 재생
    //  — 단, 리깅 파츠는 캐릭터 본이 움직임을 담당하므로 파츠 자체 애니메이션은 재생하지 않음(리그 충돌 방지)
    //  ▶ rec.animMode:
    //     ''(기본)   = 장착하자마자 계속 반복재생 (기존 동작 그대로)
    //     'active'   = 마우스·타이핑이 감지될 때(seatState==='focus')만 재생, 자리비움·어지러움 등에선 일시정지.
    //                  책상 위 아이템의 playMode='idle'과 같은 동작이며, updateActivePartPlayback()이 매 프레임 전환한다.
    /* 🎬 [진단] "애니메이션 파츠를 만들었는데 안 움직인다"를 스스로 확인할 수 있게 로그를 남긴다.
       조용히 안 되는 경우가 셋이라 눈으로는 구분이 안 됐다:
         ① GLB 안에 클립이 0개 (블렌더에서 액션을 NLA로 밀거나 Fake User 를 안 걸면 export 에서 빠진다)
         ② 리깅 파츠 — 캐릭터 본이 움직임을 담당하므로 파츠 자체 애니메이션은 **일부러** 안 튼다(리그 충돌 방지)
         ③ 클립 이름에 'idle' 이 없음
       ③ 은 이제 첫 클립으로 넘어가게 고쳤다(아래) — 아이템·책상 GLB 는 원래 그렇게 동작했는데
          파츠만 fallback 이 없어서, 같은 GLB 를 아이템으로 넣으면 움직이고 파츠로 넣으면 안 움직였다. */
    if(!isRigged && animations && animations.length){
      const idleClip = _stripPartClipOwnedTracks(_pickPartClip(animations), obj, partEarObjs);
      if(idleClip && idleClip.tracks && idleClip.tracks.length){
        /* 🎬 고른 클립이 정지 포즈면 화면은 '안 움직임'이 된다 — 클립 0개와 증상이 똑같아서
           반드시 구분해 줘야 한다(안 그러면 블렌더 export 옵션만 계속 뒤지게 된다).
           ⚠️ 위에서 트랙을 걷어내서 안 움직이게 된 경우는 여기 해당 없음 — 그건 의도한 결과라
             바로 앞줄에 이유가 이미 찍혔다. 여기서 또 경고하면 원인을 엉뚱한 데서 찾게 된다. */
        if(!_clipHasMotion(idleClip) && !idleClip._twStrippedTracks){
          console.log('[파츠 애니] '+(rec.name||rec.id)+' — 클립은 있는데 값이 전부 같습니다(정지 포즈).'
            + ' 고른 클립: "' + idleClip.name + '" / 전체: ' + animations.map(c=>c.name).join(', '));
          _partAnimNotice(rec, '⚠️ 클립은 ' + animations.length + '개 있는데 전부 정지 포즈예요 —'
            + ' 블렌더에서 그 액션에 실제 키프레임이 들어갔는지 확인해 주세요');
        }
        if(!/idle/i.test(idleClip.name)){
          console.log('[파츠 애니] '+(rec.name||rec.id)+' — 이름에 "idle"이 든 클립이 없어 첫 클립 "'
            + idleClip.name + '"을 재생합니다. 클립: ' + animations.map(c=>c.name).join(', '));
        }
        _partAnimNotice(rec, '▶ 애니메이션 재생 — 클립 "' + idleClip.name + '"'
          + (rec.animMode==='active' ? ' (활동 중에만)' : ''));
        _setupPartIdleAnim(wrapper, obj, idleClip, rec, seat);
        // 다중 파츠 extras도 각자 독립 믹서를 갖도록 재료를 남겨둠
        wrapper.userData._idleClip = idleClip;
      }
    }else if(!isRigged){
      console.log('[파츠 애니] '+(rec.name||rec.id)+' — GLB 안에 애니메이션 클립이 0개입니다.'
        + ' (블렌더라면 export 옵션의 Animation 체크와, 액션에 Fake User(방패 아이콘) 또는 NLA 스택 등록을 확인)');
      _partAnimNotice(rec, '⚠️ GLB 안에 애니메이션 클립이 0개예요 — 블렌더 export 의 Animation 체크와 액션 Fake User 를 확인해 주세요');
    }else if(animations && animations.length){
      console.log('[파츠 애니] '+(rec.name||rec.id)+' — 리깅(스키닝) 파츠라 파츠 자체 애니메이션은 재생하지 않습니다.'
        + ' 움직임은 캐릭터 본이 담당합니다. 클립: ' + animations.map(c=>c.name).join(', '));
      _partAnimNotice(rec, '⚠️ 리깅 파츠로 잡혀서 자체 애니메이션을 끕니다 — 등록창의 🧷 단독 부착을 켜 보세요');
    }
    // ★ 레이스 가드 2차 체크 — 위 파싱 이후에도 색상/애니메이션 준비 등 처리가 있어서
    //   그 사이 새 장착이 시작됐으면 여기서도 중단 (유령 wrapper 방지).
    if(seat._equipSeq[seqKey] !== mySeq) return;
    if(isRigged){
      // 리깅 파츠는 특정 본이 아니라 캐릭터 모델 루트에 원좌표 그대로 부착 — 실제 위치는 스켈레톤이 결정
      charRoot.add(wrapper);
      // ★ 리깅 파츠의 기즈모/미세조정 지원 —
      //   TransformControls는 attach 대상 오브젝트의 로컬 원점을 기즈모 위치로 사용하는데, 리깅 파츠의
      //   wrapper는 원좌표(0,0,0)에 놓여있고 실제 스킨 메시는 스켈레톤이 어딘가로 옮겨놓은 상태라
      //   기즈모가 mesh와 동떨어진 위치에 붙어 보임. 그래서 부착 후 스킨 메시의 월드 중심을 재보정
      //   해서 wrapper를 그 위치로 옮김 — 그러면 기즈모가 정확히 옷 위에 붙고, 이후 유저의 드래그
      //   오프셋도 그 자리에서부터 계산됨.
      // (스킨드메시의 월드 바운딩박스 = 스켈레톤 자세를 반영한 실제 화면상 크기/위치)
      const _rc = partsCore.riggedBaseCenter(wrapper, skinnedMeshes, charRoot);
      if(_rc) wrapper.userData.baseCenter = _rc;   // applyPartXf가 이 위에 xf를 얹음
    } else {
      bone.add(wrapper);
    }
    // 🔗 stackable: seat.stackedPartObjs[cat][id]에 저장 (같은 카테고리 다른 파츠와 공존).
    //   xf 적용은 applyPartXf가 def.equippedParts를 참조하는데 stackable은 배열이라 별도 처리.
    if(stackable){
      /* ★ 맵을 다시 보장한다 — 도입부에서 만들어도, 바로 아래 unequipStackablePart(같은 id 재장착
         정리)가 "그 카테고리의 마지막 파츠"를 지우면서 맵째 delete 한다. 그 상태로 여기 대입하면
         TypeError → 바깥 try/catch가 삼켜서 "재장착이 조용히 실패"가 된다.
         [증상] 카테고리에 혼자 있는 🔗 파츠(가챠는 전부 이 경우)가 커밋(창 닫기)마다
                붙었다 → 사라졌다를 번갈았다: 홀수 번째 커밋은 붙고 짝수 번째는 이 크래시.
                (sim-gacha-race.js 로 재현·수정 확인) */
      seat.stackedPartObjs = seat.stackedPartObjs || {};
      seat.stackedPartObjs[cat] = seat.stackedPartObjs[cat] || {};
      seat.stackedPartObjs[cat][rec.id] = wrapper;
      // ★ 버그 수정(파츠 위치 초기화): 예전엔 opts.stackableXf가 없으면 무조건 defaultPartXf()(원점)를
      //   적용했다 — 카탈로그 동기화(mergeCatalogIntoSavedParts)처럼 옵션 없이 부르는 호출자가 있으면
      //   유저가 맞춰둔 위치가 리셋됐음(등록 직후 "잠시 뒤" 원위치 증상의 원인).
      //   non-stackable이 applyPartXf로 charDef entry를 읽는 것과 동일하게, entry.xf를 진실의 원천으로 사용.
      let xf = (opts && opts.stackableXf) || null;
      if(!xf){ try{ const e = premiumMod.findEntryById(seat.charDef, cat, rec.id); if(e) xf = premiumMod.partEntryXf(e); }catch(_){} }
      _applyXfToWrapper(wrapper, xf || premiumMod.defaultPartXf(), cat);
    } else {
      seat.equippedPartObjs[cat] = wrapper;
      applyPartXf(seat, cat);   // 카테고리 기본 오프셋 + 캐릭터별 xf 적용 (리깅 파츠는 내부에서 건너뜀)
    }
    // ★ 런처9 — 다중 파츠: rec.multi가 true이고 entry.instances에 추가 인스턴스가 있으면 각각 wrapper를 clone해서 부착
    if(rec.multi === true && !isRigged){
      const def = seat.charDef;
      // ★ 버그 수정: def.equippedParts[cat]을 통째로 집으면 배열/Firebase 숫자키 맵일 때 entry가 아니고,
      //   instances도 숫자키 객체면 Array.isArray가 false라 extraCount가 0이 돼 extra wrapper가
      //   아예 생성되지 않았다(= 개수를 늘려도 기즈모가 붙을 대상이 없음).
      // ★ 반드시 '이 파츠'의 entry여야 한다. 못 찾으면 다른 파츠의 인스턴스 수를 따라가 복제본이 생기므로
      //   폴백(firstEntryForCat)을 쓰지 않고 추가 생성을 포기한다.
      const entry = premiumMod.findEntryById(def, cat, rec.id);
      const insArr = premiumMod.partEntryInstances(entry);   // 정규화 포함, [xf0, xf1, ...]
      const extraCount = Math.max(0, insArr.length - 1);
      // 🔍 진단 — "파츠 하나 꼈는데 여러 개로 보인다"의 원인을 바로 알 수 있게.
      //   entryId가 rec.id와 다르면 엉뚱한 파츠의 인스턴스 수를 따라간 것이고,
      //   같은데 extraCount>0이면 그 파츠에 다중 파츠 인스턴스가 실제로 저장돼 있는 것.
      if(extraCount > 0){
        console.log('[다중 파츠] '+cat+' — rec.id='+rec.id+' / entryId='+premiumMod.partEntryId(entry)
          + ' / 추가 '+extraCount+'개 생성'+(premiumMod.partEntryId(entry)!==rec.id ? '  ⚠️ id 불일치!' : ''));
      }
      if(extraCount > 0){
        wrapper.userData.multiExtras = [];   // 추가 wrapper들만 여기에 (main은 seat.equippedPartObjs[cat])
        for(let i=1; i<=extraCount; i++){
          // 같은 GLB 복제 · 재질 · 이 인스턴스만의 _col 묶음 · 가운데 맞춘 wrapper — 코어
          const { wrapper:extraWrap, obj:extraObj, colorGroups:extraColorGroups } = partsCore.prepareExtra(scene, cat, i);
          skelShare.shareSkeletons(skelShare.skinnedMeshesOf(extraObj));
          // 🎩 같은 GLB의 clone이라 extraCenter === center. 메인 wrapper가 계산해둔 상쇄량을 그대로 쓴다
          //    (다시 계산하면 본 자세가 그새 바뀌어 인스턴스끼리 미세하게 어긋날 수 있다).
          extraWrap.userData.authorOff = wrapper.userData.authorOff ? wrapper.userData.authorOff.clone() : null;
          extraWrap.userData.animalHeadDy = wrapper.userData.animalHeadDy || 0;   // 🐾 같은 머리 보정을 인스턴스에도
          extraWrap.userData.cat = cat;
          extraWrap.userData.partId = rec.id;
          extraWrap.userData.__twPartWrap = true;
          extraWrap.userData.instanceIdx = i;
          extraWrap.userData.rigged = false;
          extraWrap.userData.colorGroups = extraColorGroups;   // 색상 팝업이 이 그룹을 대상으로 편집
          // ▶ 원본과 같은 애니메이션을 이 인스턴스에도 (믹서는 인스턴스마다 독립)
          if(wrapper.userData._idleClip){
            _setupPartIdleAnim(extraWrap, extraObj, wrapper.userData._idleClip, rec, seat);
          }
          bone.add(extraWrap);
          wrapper.userData.multiExtras.push(extraWrap);
        }
        // 메인 wrapper에도 인덱스 표식 (클릭으로 활성화 시 사용)
        wrapper.userData.instanceIdx = 0;
        applyPartXf(seat, cat);   // instances 반영해 다시 적용
      }
    }
  }catch(e){ console.warn('파츠 부착 실패', e); }
  _sweepOrphanPartWrappers(seat);   // 🧹 이번 장착으로 밀려난 유령 wrapper가 있으면 여기서 제거
  applyClothVisibility(seat);   // 옷 착용 상태에 따라 기본 상/하의 메시 숨김 갱신
  // ★ 자리비움 등으로 캐릭터가 숨겨져 있을 때 새 파츠가 나타나는 문제 대응 —
  //   _lastOp 초기화해서 다음 프레임에 setSeatOpacity가 새 mesh들에도 visible을 적용하게 함.
  seat._lastOp = null;
  /* 🎩 이 좌석 머리 위에 이미 누가 올라타 있다면, 그 좌석이 캐시한 '머리 꼭대기'는 **이 파츠가
     붙기 전의 값**이다. 여기서 한 번 다시 잰다 — 동물 귀(_registerAnimalEarOn)와 같은 처리다.
     [경위] 파츠 GLB 는 비동기로 붙는데 _measureHostHeadTop 은 mountRide 에서 **1회**만 돈다.
       손으로 얹을 때는 파츠가 이미 붙어 있어서 문제가 없었다. 그런데 런처에서 실행 화면으로
       돌아오면 좌석이 재조립되면서 파츠 로딩과 다시 얹기가 동시에 일어난다. 얹기가 먼저 끝나면
       '파츠 없음(null)' 이 캐시로 굳고, _applyRemoteRides 는 같은 상태면 재실측을 건너뛰므로
       그 세션 내내 파츠 위에 안 얹힌다. [증상] "잘 되다가 런처 갔다 오면 안 먹힌다."
     ⚠️ 매 프레임 재는 방식으로 바꾸지 말 것 — 이름표·말풍선이 이 높이를 보고 자리를 잡는다.
       부착이 끝난 이 지점에서의 1회여야 한다.
     ★ 파츠 종류를 가리지 않고 부른다. 머리 파츠가 아니면 측정값이 그대로일 뿐이고,
       올라탄 좌석이 없으면 _remeasureRideHeadTop 이 즉시 빠져나온다(비용이 없다). */
  try{ rideBenchMod._remeasureRideHeadTop(seat); }catch(_){}
}

/* ★ 진행 중이던 비동기 장착을 무효화한다.
   [증상] 꾸미기 창에서 파츠를 넣었다 바로 빼면, 뺀 파츠가 엉뚱한 위치에 유령으로 남는다.
          (나갔다 다시 들어오면 _purgeSeatParts + 재빌드로 정상 복구)
   [원인] equipPartOnSeat은 GLB 파싱(8216)과 본 대기 루프(8286, 최대 3초) 때문에 비동기다.
          그 사이 해제가 일어나도 wrapper가 아직 없어서 지울 게 없고, _equipSeq도 그대로라
          대기가 끝난 낡은 장착이 검사(8218·8288·8398)를 통과해 그대로 부착돼 버린다.
          동물은 스켈레톤 수집이 늦어 대기 루프가 실제로 돌기 때문에 창이 훨씬 넓다.
   [대응] 해제할 때 그 키의 시퀀스를 올려서, 늦게 도착한 장착이 스스로 중단하게 한다.
          _purgeSeatParts(전 키 +1)와 같은 패턴을 좁은 범위에 적용한 것.
   ※ equipPartOnSeat 내부의 해제 호출(8201·8203)은 mySeq 발급(8214)보다 '먼저' 실행되므로
     여기서 올린 값 위에 새 번호가 얹힌다 — 자기 자신을 무효화하지 않는다. */
function _invalidatePendingEquip(seat, cat, id, includeStackable){
  if(!seat || !seat._equipSeq || !cat) return;
  if(id){ const k=cat+':'+id; seat._equipSeq[k]=(seat._equipSeq[k]||0)+1; return; }
  seat._equipSeq[cat]=(seat._equipSeq[cat]||0)+1;                 // non-stackable 키
  if(includeStackable === false) return;                          // stackable은 유지해야 하는 호출
  const pre = cat + ':';
  for(const k in seat._equipSeq){ if(k.indexOf(pre)===0) seat._equipSeq[k]++; }
}
function _disposeWrapperFromSeat(seat, obj){
  if(!obj) return;
  // 런처9 다중 파츠(같은 파츠 여러 개): 추가 인스턴스 wrapper들도 함께 제거
  if(obj.userData && Array.isArray(obj.userData.multiExtras)){
    obj.userData._multiExtrasWas = obj.userData.multiExtras.slice();   // 믹서 정리용으로 잠시 보관
    obj.userData.multiExtras.forEach(ex=>{ try{ if(ex.parent) ex.parent.remove(ex); }catch(_){} });
    obj.userData.multiExtras = [];
  }
  // 반복재생 중이던 믹서 정리 — 다중 파츠 extras의 믹서도 함께(안 그러면 떼어낸 뒤에도 매 프레임 갱신됨)
  _teardownPartIdleAnim(obj);
  if(obj.userData && Array.isArray(obj.userData._multiExtrasWas)) obj.userData._multiExtrasWas.forEach(_teardownPartIdleAnim);
  // 리깅 파츠 해제: 캐릭터 본에 입양시켰던 파츠 본들을 다시 떼어냄
  if(obj.userData && obj.userData.adoptedBones && obj.userData.adoptedBones.length){
    obj.userData.adoptedBones.forEach(b=>{ try{ if(b.parent) b.parent.remove(b); }catch(_){} });
  }
  // 파츠의 ear_L/ear_R가 캐릭터 귀 애니메이션 시스템에 등록돼 있었으면 제거
  if(obj.userData && obj.userData.partEarObjs && obj.userData.partEarObjs.length && seat.bones && seat.bones.ear){
    obj.userData.partEarObjs.forEach(o=>{
      const idx = seat.bones.ear.indexOf(o);
      if(idx>=0){ seat.bones.ear.splice(idx,1); seat.boneRest.ear.splice(idx,1); seat.earTimers = null; }
    });
  }
  if(obj.parent) obj.parent.remove(obj);
}

/* 🧹 유령 파츠 wrapper 청소 — equippedPartObjs / stackedPartObjs 어디에도 등록돼 있지 않은
   '__partWrap_' 노드를 씬에서 제거한다.
   ★ 같은 파츠가 stackable 경로와 non-stackable 경로로 각각 붙으면(카탈로그 동기화로 rec.stackable이
     바뀌는 순간 등) 레이스 가드의 시퀀스 키가 'cat:id' vs 'cat'으로 갈려 둘 다 통과한다.
     해제는 한쪽 경로만 지우므로 나머지가 공중에 남는다("하나 꼈는데 둘, 빼도 하나 남음").
     원인이 무엇이든 등록부를 진실의 원천으로 삼아 쓸어내면 유령이 남지 않는다. */
function _sweepOrphanPartWrappers(seat){
  if(!seat || !seat.group) return;
  const live = new Set();
  const addLive = w=>{
    if(!w) return;
    live.add(w);
    const ex = w.userData && w.userData.multiExtras;
    if(Array.isArray(ex)) ex.forEach(e=>{ if(e) live.add(e); });
  };
  if(seat.equippedPartObjs) for(const c in seat.equippedPartObjs) addLive(seat.equippedPartObjs[c]);
  if(seat.stackedPartObjs) for(const c in seat.stackedPartObjs){
    const m = seat.stackedPartObjs[c]; if(!m) continue;
    for(const id in m) addLive(m[id]);
  }
  const orphans = [];
  const walk = node=>{
    if(!node) return;
    if(node.userData && node.userData.__twPartWrap){
      // ★ equipPartOnSeat가 만든 wrapper만 대상. 이름(__partWrap_)만으로 판단하면
      //   같은 규칙을 쓰는 다른 부속(동물 귀 등)까지 지워 머리 높이 측정이 어긋날 수 있다.
      if(!live.has(node)) orphans.push(node);
      return;   // 파츠 내부로는 더 들어가지 않음
    }
    const kids = node.children; if(!kids) return;
    for(let i=0;i<kids.length;i++) walk(kids[i]);
  };
  walk(seat.group);
  /* 🪑 '책상 위'(bone:'desk') 파츠는 seat.group 이 아니라 seat.deskAnchor 에 붙는다.
     실행 좌석은 책상이 group 안에 있어서 위 순회에 같이 걸리지만, **생성기 미리보기는 책상(cDesk)이
     cBase.group 밖(cScene 직속)에 있어서 통째로 빠졌다** — 그래서 미리보기에서만 책상 위 파츠가
     유령으로 남았다. group 밖에 있을 때만 따로 훑는다(안에 있으면 중복 순회가 된다). */
  if(seat.deskAnchor){
    let under = false;
    for(let p=seat.deskAnchor; p; p=p.parent){ if(p===seat.group){ under = true; break; } }
    if(!under) walk(seat.deskAnchor);
  }
  if(!orphans.length) return;
  orphans.forEach(w=>{ try{ _disposeWrapperFromSeat(seat, w); }catch(_){} });
  console.log('[파츠 정리] 등록되지 않은 유령 wrapper '+orphans.length+'개 제거: '+orphans.map(o=>o.name).join(', '));
}

/* 🦶 파츠를 뗀 좌석은 다음 프레임에 발밑 · 올라탄 사람 높이를 다시 맞춘다(seat-refit.js requestRefit — 같은 프레임 여러 번이면 한 번).
   [왜] 떼는 길(가챠 회수 · 카탈로그 삭제 · 관리자 삭제 · 친구 화면의 파츠 빼기)마다 다시 맞추기가 있거나 없어서, 칠판(rideTop)을 빼도
     남의 화면에서는 위에 탄 동물이 재실행 전까지 떠 있었다. 바로 재지 않고 다음 프레임인 까닭: 뗀 뒤 applyClothVisibility 가 기본 메쉬를
     되돌려야 맞는 높이가 나온다(applyClothVisibility 끝 주석).
   ⚠️ seatRefitMod 는 좌석 배치 자리에서 만든다 — 그보다 먼저 떼는 일이 생겨도 떼기 자체는 끝나야 해서 try 로 감싼다. */
function _refitAfterUnequip(seat){
  try{ seatRefitMod.requestRefit(seat); }catch(_){}
}
function unequipPartFromSeat(seat, cat, includeStackable){
  if(!seat) return;
  if(includeStackable === undefined) includeStackable = true;
  // ★ wrapper가 아직 없어도(로딩 중이어도) 반드시 먼저 무효화 — 이게 유령 파츠의 핵심 방어다.
  _invalidatePendingEquip(seat, cat, null, includeStackable);
  // 기존 단일(non-stackable) 카테고리 파츠 제거
  let removed = false;
  if(seat.equippedPartObjs && seat.equippedPartObjs[cat]){
    _disposeWrapperFromSeat(seat, seat.equippedPartObjs[cat]);
    delete seat.equippedPartObjs[cat];
    removed = true;
  }
  // 🔗 stackable로 붙어있던 파츠들도 정리 (기본 true; non-stackable 파츠 교체 시엔 false로 유지)
  if(includeStackable && seat.stackedPartObjs && seat.stackedPartObjs[cat]){
    for(const id in seat.stackedPartObjs[cat]){
      _disposeWrapperFromSeat(seat, seat.stackedPartObjs[cat][id]);
      removed = true;
    }
    delete seat.stackedPartObjs[cat];
  }
  _sweepOrphanPartWrappers(seat);   // 등록되지 않은 채 씬에 남은 wrapper까지 확실히 제거
  if(removed) _refitAfterUnequip(seat);
}

// 🔗 stackable 파츠 중 특정 id만 해제 (같은 카테고리의 다른 파츠들은 유지)
function unequipStackablePart(seat, cat, id){
  if(!seat) return;
  _invalidatePendingEquip(seat, cat, id);   // ★ wrapper가 없어도(로딩 중) 무효화가 먼저다
  if(!seat.stackedPartObjs || !seat.stackedPartObjs[cat]) return;
  const wrapper = seat.stackedPartObjs[cat][id];
  if(!wrapper) return;
  _disposeWrapperFromSeat(seat, wrapper);
  delete seat.stackedPartObjs[cat][id];
  if(Object.keys(seat.stackedPartObjs[cat]).length === 0) delete seat.stackedPartObjs[cat];
  _sweepOrphanPartWrappers(seat);
  _refitAfterUnequip(seat);
}

/* def.equippedParts({cat:{id,xf}} 또는 {cat:[{id,xf},...]})를 좌석에 모두 반영 */
/* def(장착 목록)에 더 이상 없는 파츠를 좌석에서 걷어내는 공용 정리.
   ★ 카테고리 단위(equippedPartObjs)만 보면 안 됨:
   · 🔗 stackable 파츠는 stackedPartObjs[cat][id]에 개별 저장 → id 단위로 대조해야 "뺀 파츠"가 지워짐
   · 한 카테고리에 stackable만 남고 일반 파츠를 뺀 경우엔 카테고리는 살아있어서 일반 wrapper가 유령으로 남음
   내 캐릭터(commitWdDraft)와 원격 캐릭터(def 수신) 양쪽에서 같이 씀. */
function pruneSeatPartsAgainstDef(seat, def){
  if(!seat) return;
  const eq = (def && def.equippedParts) || {};
  // 1) 일반 파츠: def의 그 카테고리에 "일반(non-stackable) entry"가 하나도 없으면 wrapper 해제
  if(seat.equippedPartObjs){
    Object.keys(seat.equippedPartObjs).forEach(cat=>{
      const hasNormal = premiumMod.entriesForCat(def, cat).some(e=>{
        const id = premiumMod.partEntryId(e);
        // ★ 버그 수정(착용 파츠 증발): 카탈로그 동기화로 savedParts가 막 교체된 직후나 스키마 차이로
        //   rec 조회가 실패할 수 있는데, 예전엔 그걸 "일반 파츠 없음"으로 취급해 wrapper를 지웠다 —
        //   착용 중이던 모자 등이 사라지던 경로. def에 entry가 "있는" 파츠는 정보를 못 찾았다고
        //   지우면 안 됨(prune의 목적은 def에서 "빠진" 파츠 제거) — 조회 실패 시 보수적으로 유지.
        const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat) || premiumMod.savedParts().find(p=>p.id===id);
        if(!rec) return true;   // 조회 실패 = 장착 유지
        return !rec.stackable;
      });
      // ★ includeStackable=false 필수 — 기본값(true)이면 같은 카테고리에 살아있어야 할
      //   🔗 stackable 파츠까지 함께 지워버림. stackable 정리는 아래 2)가 id 단위로 담당.
      if(!hasNormal) unequipPartFromSeat(seat, cat, false);
    });
  }
  // 2) stackable 파츠: def entry 목록에 없는 id는 개별 해제
  if(seat.stackedPartObjs){
    Object.keys(seat.stackedPartObjs).forEach(cat=>{
      const liveIds = premiumMod.entriesForCat(def, cat).map(premiumMod.partEntryId);
      Object.keys(seat.stackedPartObjs[cat]).forEach(id=>{
        if(!liveIds.includes(id)) unequipStackablePart(seat, cat, id);
      });
    });
  }
}

/* 🔎 파츠 장착 진단 경고 — 같은 원인으로 도배되지 않게 세션당 키별 1회만 남긴다.
   [왜 필요한가] 파츠가 안 붙는 경로 둘(카테고리 정보 없음 · 파츠 정보 조회 실패)이 지금까지
   **아무 흔적도 없이** return 했다. 제보는 "눌렀는데 아무 일도 안 일어난다"로만 들어오고,
   콘솔에도 남는 게 없어서 어느 쪽인지 가릴 수가 없었다. 동작은 바꾸지 않는다 — 이름만 붙인다. */
const _equipWarnSeen = new Set();
function _equipWarnOnce(key, msg){
  if(_equipWarnSeen.has(key)) return;
  _equipWarnSeen.add(key);
  try{ console.warn(msg); }catch(_){}
}

async function applyEquippedPartsToSeat(seat, def){
  /* ⚠️ 예전엔 `if(!seat || !def || !def.equippedParts) return;` 한 줄이었다.
       그러면 **꾸미기 파츠가 하나도 없는 캐릭터**는 아래 두 줄(가시성 최종 갱신 + _lastOp 재무장)을
       통째로 건너뛴다. 그 두 줄은 파츠와 무관한 뒷정리인데 파츠 유무에 얹혀 있었다.
     [무엇이 깨지나] 자리비움(opacity 0)으로 숨어 있는 동안 그 좌석이 다시 빌드되면
       (캐릭터 교체·방 def 갱신 등) 새로 만들어진 메시들은 visible=true 인 채로 들어온다.
       그런데 seat._lastOp 가 여전히 0 이라 다음 프레임의 setSeatOpacity(seat, 0) 은
       맨 첫 줄 `if(seat._lastOp===op) return;` 에서 그대로 나가버린다 —
       즉 새 메시에는 숨김도, _prevVisible 기록도 걸리지 않는다.
       파츠가 있는 캐릭터는 아래 `seat._lastOp = null` 덕에 우연히 구제되고 있었을 뿐이다.
     ★ 파츠 순회만 조건부로 두고, 뒷정리 두 줄은 항상 지나가게 한다. */
  if(!seat) return;
  if(def && def.equippedParts) for(const cat in def.equippedParts){
    // 🔗 stackable 지원: entriesForCat로 배열/단일 모두 순회
    const entries = premiumMod.entriesForCat(def, cat);
    for(const entry of entries){
      const id = premiumMod.partEntryId(entry);
      const rec = premiumMod.savedParts().find(p=>p.id===id && p.cat===cat);
      if(rec) await equipPartOnSeat(seat, cat, rec, { stackableXf: rec.stackable ? premiumMod.partEntryXf(entry) : null });
      /* ⚠️ 조회 실패 = 조용한 누락. def 에는 있는데 화면에는 안 붙고, 흔적도 안 남는다.
         ★ 여기 조회는 **(id, cat) 둘 다 일치**를 요구하는데, pruneSeatPartsAgainstDef 의 같은
           조회는 `|| savedParts.find(p=>p.id===id)` 로 id 만으로도 한 번 더 찾는다(그쪽 주석 참고).
           즉 **두 함수가 같은 파츠를 다르게 판정할 수 있다** — prune 은 "있다"고 보고 유지하는데
           여기서는 "없다"고 보고 안 붙이면, 그 파츠는 def 에 남은 채 영영 화면에 안 나온다.
           그게 지금 제보(적용 안 됨)의 모양과 정확히 같다.
         🔴 폴백을 여기에도 넣는 것이 후보 수정이지만, 실제로 cat 불일치가 나는지 확인되기 전에는
           넣지 않는다. 아래 경고가 한 번이라도 뜨면 그때 넣는다 — 그 판단 근거가 이 줄이다. */
      else _equipWarnOnce('rec:'+cat+':'+id,
        '[파츠] 파츠 정보를 못 찾아 장착을 건너뜁니다 — cat=' + cat + ' id=' + id
        + ' / id 만으로 찾으면: ' + (premiumMod.savedParts().find(p=>p.id===id) ? ('있음(cat=' + premiumMod.savedParts().find(p=>p.id===id).cat + ')') : '없음'));
    }
  }
  applyClothVisibility(seat);   // 모두 반영 후 가시성 최종 갱신
  seat._lastOp = null;
}

return {
  extractBonesInto,
  equipPartOnSeat,
  unequipPartFromSeat,
  unequipStackablePart,
  pruneSeatPartsAgainstDef,
  applyEquippedPartsToSeat,
  _invalidatePendingEquip,
  _disposeWrapperFromSeat,
  _sweepOrphanPartWrappers,
};
}

const api = { createPartEquip };
if(typeof window !== 'undefined') window.TwPartEquip = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
