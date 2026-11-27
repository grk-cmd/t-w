/* ============================================================ SETUP */
/* 🎚️ 실행 화면 화질(설정 › 디스플레이 — FrameBudget.QUALITY). antialias 는 WebGL 을 만들 때만 정해져서 «가볍게» 는 다시 켜야 적용된다.
   ⚠️ 도트 렌더 저장값으로 antialias 를 정하지 말 것 — 개발 실행 · 설치본이 저장소를 같이 써서 안 보이게 꺼진 채 굳었다(도트 느낌은 DOT_RENDER_SCALE 로 충분). */
let _renderQuality = FrameBudget.qualityFrom(localStorage.getItem(FrameBudget.QUALITY_KEY));
let _runLowered = false;   // «자동» 이 이번 실행에서 배율을 낮췄는가
const _renderAA = FrameBudget.antialiasFor(_renderQuality);
/* 🧭 런처 공용 상태(launcher/launcher-state.js) — 앱 모드 · 마이홈이 런처 위에 열려 있나. 읽는 모듈(친구 관리 · 마이홈 · 달성표 · 창 모드)을 만드는 줄보다 먼저 있게 맨 앞에서 만든다. */
const launcherStateMod = TwLauncherState.createLauncherState();
/* 🎬 3D 무대 한 벌(shared/stage.js) — 렌더러(못 만들면 안내) · 연결 끊김 감시 · 씬 · 카메라 · 바닥 · GLTF 로더. 아래 const 는 옛 전역 이름이다. */
const _renderShadows = FrameBudget.shadowsFor(_renderQuality);   // «최저» 면 그림자 끔 — 켜고 끄면 재질을 다시 만들어야 해서 antialias 처럼 다시 켜야 적용
const stageMod = TwStage.createStage({
  _renderAA: _renderAA,
  _renderShadows: _renderShadows,
  afterRestore: () => faceHealMod.reportGlReset(),   // 좌석 그림 점검 — faceHealMod 는 첫 프레임 전에 아래에서 만들어진다
});
const canvas = stageMod.canvas;   // 옛 전역 이름 — 다른 모듈 · 이 파일 곳곳이 아직 전역으로 읽는다(도메인 단계에서 deps 로 바꾸고 걷는다)
const renderer = stageMod.renderer;   // 옛 전역 이름
const scene = stageMod.scene;   // 옛 전역 이름
const camera = stageMod.camera;   // 옛 전역 이름
const floor = stageMod.floor;   // 옛 전역 이름
const sizeFloorTo = stageMod.sizeFloorTo;   // 옛 전역 이름
const loader = stageMod.loader;   // 옛 전역 이름
/* 🩺 한글 조합 중 입력칸이 포커스를 잃으면 진단 기록에 한 줄(shared/input-diag.js) — 맥 한글 씹힘 제보를 제보자 PC 기록으로 가른다 */
TwInputDiag.createImeWatch({
  note: (m) => { if(window.companion && companion.diagNote) companion.diagNote(m); },   // 브라우저 미리보기 · 검사엔 companion 이 없다
  now: () => Date.now(),
  defer: (fn) => setTimeout(fn, 0),
}).attach(document, window);
/* 캐릭터 몸 박스 재기 — 규칙은 character/body-measure.js 한 곳. 키 정규화 · 올라타기 · 바닥 맞춤 · 날기 벽이 부팅 중에도 부를 수 있어 맨 앞에서 만든다. */
const bodyMeasureMod = TwBodyMeasure.createBodyMeasure({
});
/* ✨ 빛나는 스프라이트 · 재질 발광(character/glow.js) — 지금 부르는 곳은 없다(아이템 발광 호출은 주석 처리됨) */
const glowMod = TwGlow.createGlow({
});

/* 💡 조명 — 밝기 예산 숫자 · 재질 고치기는 캐릭터 코어 한 벌(packages/char-core/src/lighting.ts · 웹 생성기와 같이 쓴다).
   화면을 더 밝게 · 어둡게 하려면 코어 TONE_FRONT_TOTAL 하나만 옮긴다. */
// 빛 색은 거의 백색 — 채도를 올리면 조명 몫과 emissive(플랫) 몫의 색이 갈라져 고른 색이 다르게 보인다.
const _MAIN_LIGHT_COL = new THREE.Color().setHSL(0.09, 0.06, 0.88);
const _MAIN_LIGHT_INT = TwCharCore.MAIN_LIGHT_INT;
const _KEY_LIGHT_MUL = TwCharCore.KEY_LIGHT_MUL;     // 위를 보는 면만(거품 · 머리띠 위 · 책상 윗면)
const _FILL_LIGHT_MUL = TwCharCore.FILL_LIGHT_MUL;   // 카메라를 보는 면(옷 앞면 · 얼굴)
/* GLB 재질을 이 장면의 플랫 조명 규약에 맞게 눕힌다(캐릭터 · 파츠 · 아이템 · 책상 모두) — 규칙은 코어.
   고친 것이 있으면 콘솔에 한 줄 — «이 파츠만 어둡다» 가 오면 어느 칸이었는지 바로 보인다. */
function _fixGlbMatLighting(m){
  TwCharCore.fixMatLighting(m, (msg)=>{ try{ console.log(msg); }catch(_){} });
}
/* 재질 톤 · 실행 화면 조명 한 벌 — 메인 씬 조명이 바로 아래에서 쓰므로 조명 상수 바로 뒤에서 만든다(shared/light-tone.js).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const lightToneMod = TwLightTone.createLightTone({
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,
  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,
  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,
  _fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),
  charCore: TwCharCore,
});
/* 메인 씬 — 앰비언트 · 키(정수리 위 · 그림자) · 뒤쪽 냉색 바운스 · 정면 필(옷 앞면 · 얼굴 · 욕조 앞면) */
const key = lightToneMod.addRunLights(scene, { keyPos: [0, 5, 0], backBounce: true }).key;
key.castShadow=true; key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=1; key.shadow.camera.far=30;
key.shadow.camera.left=-22; key.shadow.camera.right=22; key.shadow.camera.top=8; key.shadow.camera.bottom=-8;
key.shadow.bias=-0.0003; key.shadow.normalBias=0.03;

/* 🪑 기본 책상 · 소품 · 대신 몸 만들기와 재질(room/desk-build.js) — 아래 const 는 옛 전역 이름이다. */
const deskBuildMod = TwDeskBuild.createDeskBuild({
});
const M = deskBuildMod.M;   // 옛 전역 이름
const matWood = deskBuildMod.matWood;   // 옛 전역 이름
const matWoodD = deskBuildMod.matWoodD;   // 옛 전역 이름
const DESK_ITEMS = deskBuildMod.DESK_ITEMS;   // 옛 전역 이름
const DEFAULT_DESK_OVERRIDE_ID = deskBuildMod.DEFAULT_DESK_OVERRIDE_ID;   // 옛 전역 이름
const NO_DESK_ID = deskBuildMod.NO_DESK_ID;   // 옛 전역 이름
const buildDesk = deskBuildMod.buildDesk;   // 옛 전역 이름
const buildPlaceholder = deskBuildMod.buildPlaceholder;   // 옛 전역 이름

/* 🧍 캐릭터 높이 · 깊이 · 자리 · 크기 저장 · 끌기 한계 · 책상 반폭(room/char-place.js) — 아래 const 는 옛 전역 이름이다. */
const charPlaceMod = TwCharPlace.createCharPlace({
  bodyMeasureMod: bodyMeasureMod,
  camera: camera,
  seats: ()=>seats,
});
charPlaceMod.attachLayout({
  layoutSeats: ()=>layoutSeats(),
});
const CHAR_Z = charPlaceMod.CHAR_Z;   // 옛 전역 이름
const CHAR_Y_MAX = charPlaceMod.CHAR_Y_MAX;   // 옛 전역 이름
const clampCharY = charPlaceMod.clampCharY;   // 옛 전역 이름
const seatCharZ = charPlaceMod.seatCharZ;   // 옛 전역 이름
const BASE_PXW = charPlaceMod.BASE_PXW;   // 옛 전역 이름
const ANIMAL_RUN_SCALE = charPlaceMod.ANIMAL_RUN_SCALE;   // 옛 전역 이름
const saveCharPos = charPlaceMod.saveCharPos;   // 옛 전역 이름
const saveCharScale = charPlaceMod.saveCharScale;   // 옛 전역 이름
const refreshCharScaleForCurrentDisplay = charPlaceMod.refreshCharScaleForCurrentDisplay;   // 옛 전역 이름
const clampDeskPan = charPlaceMod.clampDeskPan;   // 옛 전역 이름
const seatDeskHalfWidth = charPlaceMod.seatDeskHalfWidth;   // 옛 전역 이름
// ★ animal.js도 이 값을 써야 함(정규화 높이) — 예전엔 animal.js가 자체 기본값 0.6을 들고 있어서 값이 두 곳에
//   갈라져 있었음. 여기서 window로 노출해 "한 곳에서만 관리"되게 한다. (app.js가 animal.js보다 먼저 로드됨)
try{ window.ANIMAL_RUN_SCALE = ANIMAL_RUN_SCALE; }catch(_){}
const FLOOR_DEFAULT='#cdb88f';
const floorMat=M(0xcdb88f,0.95);
// 바닥은 밝은 조명에서 흰색으로 날아가기 쉬워서, 알베도를 낮춰 "고른 색이 그대로 보이게" 함(클리핑 방지)
// (사용자가 바닥색 기능을 제거함 — 함수는 더 이상 사용 안 됨)


/* 🐾 사람 귀 붙이기(character/human-ear-attach.js) — 아래 const 는 옛 전역 이름이다(꾸미기 · 파츠 그림 모듈이 deps 로 받는다). */
const humanEarAttachMod = TwHumanEarAttach.createHumanEarAttach({
  _registerAnimalEarOn: (...a)=>_registerAnimalEarOn(...a),
  lightToneMod: lightToneMod,
  partPaintMod: ()=>partPaintMod,
  rideBenchMod: ()=>rideBenchMod,
  seats: ()=>seats,
  wardrobeMod: ()=>wardrobeMod,
});
const humanEar = humanEarAttachMod.humanEar;   // 옛 전역 이름
const _humanEarMat = humanEarAttachMod._humanEarMat;   // 옛 전역 이름
const _humanEarPic = humanEarAttachMod._humanEarPic;   // 옛 전역 이름
const _syncHumanEarRig = humanEarAttachMod._syncHumanEarRig;   // 옛 전역 이름
const _attachHumanEars = humanEarAttachMod._attachHumanEars;   // 옛 전역 이름

/* ===== 기본 캐릭터 GLB (임베드) — face/cloth_upper/cloth_lower + 리깅 ===== */
/* 몸 모델 공급 · 복제 · 크기는 character/base-body.js(코어 몸 포함) — 아래 const 는 옛 이름이다. */
const skelShare = TwSkeletonShare;
const baseBodyMod = TwBaseBody.createBaseBody({
  loader: loader,
  skelShare: skelShare,
  _fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),
  setFaceMap: (...a)=>matToneMod.setFaceMap(...a),
  applyLightPreset: (...a)=>matToneMod.applyLightPresetToInstance(...a),
  assetCodeMod: ()=>assetCodeMod,
});
const bodyCore = baseBodyMod.bodyCore;   // 옛 전역 이름
const b64ToBuf = baseBodyMod.b64ToBuf;   // 옛 전역 이름
const loadBaseGLB = baseBodyMod.loadBaseGLB;   // 옛 전역 이름
const instantiateBase = baseBodyMod.instantiateBase;   // 옛 전역 이름
const commSceneCache = baseBodyMod.commSceneCache;   // 옛 전역 이름
const getCommissionScene = baseBodyMod.getCommissionScene;   // 옛 전역 이름
const mkFaceTex = baseBodyMod.mkFaceTex;   // 옛 전역 이름
const COMMISSION_SCALE_CORRECTION = baseBodyMod.COMMISSION_SCALE_CORRECTION;   // 옛 전역 이름
const normalizeModel = baseBodyMod.normalizeModel;   // 옛 전역 이름
/* ============================================================ BUILDERS */
/* ▶ 파츠 · 아이템 애니메이션 재생(character/part-anim.js) — 아래 const 는 옛 전역 이름이다. */
const partAnimMod = TwPartAnim.createPartAnim({
  isAdmin: ()=>isAdmin,
  seatState: (...a)=>seatState(...a),
  seats: ()=>seats,
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatusMod.userStatus(),
});
const activeItemMixers = partAnimMod.activeItemMixers;   // 옛 전역 이름
const _idleItemPivots = partAnimMod._idleItemPivots;   // 옛 전역 이름
const _clipHasMotion = partAnimMod._clipHasMotion;   // 옛 전역 이름
const _pickPartClip = partAnimMod._pickPartClip;   // 옛 전역 이름
const _partAnimNotice = partAnimMod._partAnimNotice;   // 옛 전역 이름
const _stripPartClipOwnedTracks = partAnimMod._stripPartClipOwnedTracks;   // 옛 전역 이름
const _setupPartIdleAnim = partAnimMod._setupPartIdleAnim;   // 옛 전역 이름
const _teardownPartIdleAnim = partAnimMod._teardownPartIdleAnim;   // 옛 전역 이름
const updateActivePartPlayback = partAnimMod.updateActivePartPlayback;   // 옛 전역 이름
const updateIdleItemPlayback = partAnimMod.updateIdleItemPlayback;   // 옛 전역 이름
const updateItemHandTrackers = partAnimMod.updateItemHandTrackers;   // 옛 전역 이름
const playItemIdle = partAnimMod.playItemIdle;   // 옛 전역 이름
/* 🪑 책상 아이템 장착(character/desk-item-equip.js) — 아래 const 는 옛 전역 이름이다. */
const deskItemEquipMod = TwDeskItemEquip.createDeskItemEquip({
  _idleItemPivots: _idleItemPivots,
  activeItemMixers: activeItemMixers,
  commissionMod: ()=>commissionMod,
  crState: ()=>crState,
  crXformMod: ()=>crXformMod,
  customItems: ()=>customItems,
  deskItemsMod: ()=>deskItemsMod,
  deskSetupMod: ()=>deskSetupMod,
  launcherPrevMod: ()=>launcherPrevMod,
  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),
  catalogReceived: ()=>!!catalogApiMod.current(),
  slotSaveMod: ()=>slotSaveMod,
  lightToneMod: lightToneMod,
  toast: (...a)=>toast(...a),
});
const applyDeskAdj = deskItemEquipMod.applyDeskAdj;   // 옛 전역 이름
const deskItemOrigin = deskItemEquipMod.deskItemOrigin;   // 옛 전역 이름
const equipDeskItem = deskItemEquipMod.equipDeskItem;   // 옛 전역 이름
const collectDeskItems = deskItemEquipMod.collectDeskItems;   // 옛 전역 이름
const autoSaveDeskItemsNow = deskItemEquipMod.autoSaveDeskItemsNow;   // 옛 전역 이름
const applyDeskItemsTo = deskItemEquipMod.applyDeskItemsTo;   // 옛 전역 이름
const _applyItemColor = deskItemEquipMod._applyItemColor;   // 옛 전역 이름

/* ============================================================ SEATS */
/* 🪑 좌석 목록 · 만들기 · 지우기 · 고른 좌석 · 간격(room/seats.js) — 아래 const 는 옛 전역 이름이다. */
const seatsMod = TwSeats.createSeats({
  CHAR_Z: CHAR_Z,
  buildDesk: buildDesk,
  buildPlaceholder: buildPlaceholder,
  scene: scene,
});
const seats = seatsMod.seats;   // 옛 전역 이름
const GAP_MIN = seatsMod.GAP_MIN;   // 옛 전역 이름
const GAP_MAX = seatsMod.GAP_MAX;   // 옛 전역 이름
const GAP_STEPS = seatsMod.GAP_STEPS;   // 옛 전역 이름
const saveGap = seatsMod.saveGap;   // 옛 전역 이름
const createSeat = seatsMod.createSeat;   // 옛 전역 이름
// ★ 마이홈/친구 시스템용 "영구" 사용자 ID — 방 접속용 memberId(매번 새로 생김)와 다르게, 이 값은
//   한 번 만들어지면 이 기기에서 계속 유지됨. 친구 목록이 이 ID를 기준으로 저장되기 때문에 꼭 필요.
const MY_USER_ID_KEY = 'tw.myUserId';
const MY_FRIEND_CODE_KEY = 'tw.myFriendCode';
/* 🔗 이 기기가 **버린** 친추 코드들 (최신 먼저, 최대 5개).
   [왜 필요한가] 되찾기가 코드 입력을 요구했는데, 정작 코드를 잃는 순간은 자동 치유나
   계정 연동이 **자동으로** 갈아끼울 때다. 그 순간 화면에는
   새 코드만 남고 옛 코드는 어디에도 안 적힌다 — 외워두지 않았으면 되찾을 방법이 없었다.
   그런데 갈아끼우는 그 코드에서 **우리는 옛 코드를 손에 쥐고 있었다.** 버리기 전에 적어둔다.
   ⚠️ 로컬 기록이라 이 기기에서 잃은 코드만 안다. 새 PC에서 처음 연동하며 잃은 코드는
     여기 없다 — 그 경우는 여전히 직접 입력해야 한다(서버에 옛 코드 이력을 남기려면
     users 노드 스키마와 규칙을 함께 바꿔야 해서 지금은 안 한다). */
/* ⚠️ 되찾기 UI 가 사라진 뒤로 이 기록을 **읽는 화면은 없다.** 지우지 않고 남겨둔 이유는
   하나뿐이다 — 코드가 바뀌었다는 제보가 오면 F12 콘솔에서 getOldFriendCodes() 로
   "이 기기가 무슨 코드를 언제 버렸는지"를 물어볼 수 있다. 그게 유일한 용도다.
   새 기능을 여기에 얹지 말 것. 코드는 서버가 정한다(로그인 때 _enterAccount 가 적는다). */
const MY_FRIEND_CODE_PREV_KEY = 'tw.myFriendCodePrev';
/* 🪪 (걷음 · 회원가입 설계 §6-② · CHECKS 개정 56) «이 기기가 버린 내 uid» 목록 `tw.myPrevUserIds` · `_rememberPrevUserId` ·
   `_isMyPrevUserId`. 계정이 없던 시절(한 사람 = 기기마다 다른 uid)의 장치였다 — 그 uid 를 가리키는 친구 코드·친구 요청을
   **조건 없이** 끌어왔다. 이제 로그인은 비밀번호·구글로 확인된 계정이라, 이 기기의 이전 uid 는 **다른 계정**이다
   (한 PC 를 둘이 쓰면 다른 사람). 코드와 요청은 그 코드를 가진 계정에 그대로 둔다.
   ★ 예전 판이 남긴 값은 여기서 한 번 지운다(로그아웃 목록 ACCOUNT_LOCAL_KEYS 에서도 뺐다). */
try{ localStorage.removeItem('tw.myPrevUserIds'); }catch(_){}
function _rememberOldFriendCode(code){
  const c = String(code || '').toUpperCase().trim();
  if(!/^(MATE|COZY)-[A-Z0-9]{4}$/.test(c)) return;
  try{
    let list = JSON.parse(localStorage.getItem(MY_FRIEND_CODE_PREV_KEY) || '[]');
    if(!Array.isArray(list)) list = [];
    // ⚠️ 여기서 '지금 코드인가'를 거르지 않는다. 이 함수는 대개 **교체 직전**에 불려서
    //   그 시점엔 아직 지금 코드이기 때문이다. 거르는 일은 읽는 쪽(getOldFriendCodes)이 한다.
    list = [c].concat(list.filter(x => x !== c)).slice(0, 5);
    localStorage.setItem(MY_FRIEND_CODE_PREV_KEY, JSON.stringify(list));
  }catch(_){}
}
function getOldFriendCodes(){
  let cur = null, list = [];
  try{ cur = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  try{ list = JSON.parse(localStorage.getItem(MY_FRIEND_CODE_PREV_KEY) || '[]'); }catch(_){}
  if(!Array.isArray(list)) list = [];
  return list.filter(c => typeof c === 'string' && c && c !== cur);
}
/* 🪪 **읽기만 한다 — 없으면 null.** 0.13 — uid(userCode)는 서버가 가입 때 만들고, 로그인 뒤 서버가 돌려준 값을
   `_setMyUserId` 한 곳으로 적는다(account.js _enterAccount). 앱은 uid 를 만들지 않는다.
   ★ uid 가 없는 동안 나가는 서버 요청은 firebase-init 의 빈 uid 안전망(`_noUidPath`)이 막는다. */
function getMyUserId(){
  try{ return localStorage.getItem(MY_USER_ID_KEY) || null; }catch(e){ return null; }
}
/* 🗂️ 계정별 로컬 칸 한 벌 — 계정 코드는 부를 때마다 getMyUserId 로 읽는다(shared/account-store.js). 쓰는 모듈에는 deps 로, 마이홈 바탕화면(myhome-desktop.js)은 이 전역 이름으로 받는다. */
const accountStoreMod = TwAccountStore.createAccountStore({ storage: localStorage, getAccountCode: getMyUserId, isWriteLocked: ()=>acctStateMod._acctDetached() });
/* 🗂️ JSON 칸 읽기 · 쓰기(shared/json-store.js)를 계정 칸 위에 얹은 한 벌 — 책상 · 동물 프리셋이 쓴다(닫혀 있으면 읽기 null · 쓰기는 «저장 못 함» 결과). animal.js 는 이 전역 이름으로 받는다. */
const accountJsonStoreMod = TwJsonStore.createJsonStore({ storage: ()=>accountStoreMod.asStorage() });
/* 🪪 uid 를 **기록하는** 한 입구 — 서버가 돌려준 계정 코드만 적는다(account.js _enterAccount). 성공하면 true. */
function _setMyUserId(uid){
  if(typeof uid !== 'string' || !/^u[0-9a-z]{8,40}$/i.test(uid)) return false;
  try{ localStorage.setItem(MY_USER_ID_KEY, uid); return localStorage.getItem(MY_USER_ID_KEY) === uid; }catch(e){ return false; }
}
/* 🔗 친구 코드는 서버가 가입 때 정하고, 로그인 때 이 PC 에 적는다(account.js _enterAccount — GET /v2/me 의 friendCode 가 원본).
   앱은 코드를 뽑지 · 등록하지 · Firebase 의 코드 노드와 맞춰 보지 않는다. */
/* 🔒 친추코드 재발급 금지의 근거를 검사가 잡을 수 있게 이름 붙인 결정. 되살리려면 이 상수만 볼 것이 아니라
   위 갈래 전체를 되살려야 한다 — 이 상수는 문서이지 스위치가 아니다. */
const FC_NEVER_REISSUE = true;
/* 🔗 [제거됨] 예전 친추 코드 되찾기 (reclaimMyFriendCode + 설정 UI)
   코드가 바뀌는 경로 자체를 없앴기 때문에 수동 되찾기가 할 일이 남지 않았다.
     · 로그인    → 서버 계정의 코드로 맞춘다(account.js _enterAccount · 0.13)
     (개정 56: «버린 uid» 되찾기 · 7일 되찾기 · 로그인 직후 소유자 강제 정정은 걷었다 — 전부 남의 계정 것을 가져오는 길이다)
   ⚠️ 되살릴 일이 생기면 lastSeen 판정을 반드시 함께 되살릴 것. 그 판정 없이 코드 문자열만으로
     소유권을 넘기면 4자리를 찍어서 남의 코드와 친구 요청을 가져갈 수 있다.
   🔒 [2026-09-20] 그 마지막 경우에도 이제 **자동 재발급을 하지 않는다**(0.13 — 코드는 서버가 정한다).
     사용자가 직접 코드를 바꾸는 UI 는 이미 없고, 자동으로 바뀌는 길도 이것으로 사라졌다 —
     **로컬 코드를 지우는 자리는 로그아웃(ACCOUNT_LOCAL_KEYS)뿐**이다. */
let dotRenderEnabled = (localStorage.getItem('tw.dotRender')==='1');   // 기본 꺼짐
const DOT_RENDER_SCALE = 0.45;   // 저해상도(도트) 렌더 배율 — 작을수록 거친 도트. 0.45=PS1급 도트감. 0.55=은은, 0.35=더 거침.
/* ═══ 🪑 좌석 크기 평준화 — 배율(k)을 정하는 곳은 여기 하나다 ═══════════════════
   내 화면에서만 남의 좌석을 내 캐릭터 크기에 맞춘다(서버에 안 쓴다). 방식 · 함정은 character/seat-equalize.js 머리에. */
/* 본문은 character/seat-equalize.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatEqMod = TwSeatEqualize.createSeatEqualize({
  seatEqAccountStore: accountStoreMod,
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  clampCharY: (...a)=>clampCharY(...a),
  findMySeat: (...a)=>findMySeat(...a),
  fitModel: (...a)=>fitModel(...a),
  seats: seats,
  setDeskPos: (...a)=>deskPlaceMod.setDeskPos(...a),
  setDeskScale: (...a)=>deskPlaceMod.setDeskScale(...a),
  syncSeatDeskZ: (...a)=>deskPlaceMod.syncSeatDeskZ(...a),
});
let roomSeatMode = window.TwSeatPin ? TwSeatPin.loadMode(localStorage) : 'row';   // 🪑 방에서 내 자리 — 줄 안에 함께 · 맨 오른쪽 고정(seat-pin.js)
/* 본문은 character/deco-parts-visibility.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({
  decoAccountStore: accountStoreMod,
  premiumMod: ()=>premiumMod,
});
/* (구역 떼기 C · w1) 이 자리의 본문도 character/seat-equalize.js 로 옮겼다 — 만드는 줄은 첫 자리. */
// 🐾 동물 전용 팔 기본각 — 동물 GLB의 hand 본 rest 자세가 인간과 달라 인간의 HAND_REST를 그대로 쓰면 팔이 뜬다.
//   ★ 팔 높이 조정은 이 숫자 하나만 바꾸면 됨: 양수 쪽(예 -0.2)으로 갈수록 내려가고, 음수 쪽(예 -0.8)일수록 올라간다.
//   ★ 실행화면(animateRig) · 런처 미리보기(applyStaticHandRest) · 동물 생성기(animal.js applyArmRest)가
//     모두 이 값을 읽는다 — 여기만 고치면 세 곳이 함께 바뀜.
const ANIMAL_HAND_REST = -0.4;
try{ window.ANIMAL_HAND_REST = ANIMAL_HAND_REST; }catch(_){}
/* 본문은 room/ride-tuning.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const rideTuneMod = TwRideTuning.createRideTuning({
});
/* 본문은 room/ride-measure.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const rideMeasureMod = TwRideMeasure.createRideMeasure({
  seatEqMod: seatEqMod,
});
/* (구역 떼기 C · w1) 이 자리의 본문도 room/ride-tuning.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* (구역 떼기 C · w1) 이 자리의 본문도 room/ride-measure.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* (구역 떼기 C · w1) 이 자리의 본문도 room/ride-tuning.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 🐾 mountRide/unmountRide가 호출하는 전역 진입점. 방에 있을 때만 실제 전송한다.
   (예전엔 이 함수가 없어서 typeof 가드에 걸려 조용히 넘어갔고, 그래서 올라타기가 남에게 안 보였다) */
function broadcastRide(){
  try{ if(typeof Presence!=='undefined' && Presence.active() && Presence.broadcastRide) Presence.broadcastRide(); }catch(_){}
}
/* 🐾 올라타기 체인 헬퍼 ─────────────────────────────────────────────
   A가 B 위에, B가 C 위에 탄 상태를 'ridingOn' 연결로 표현한다. 아래 함수들이 그 사슬을 다룬다.
   ★ 순환(A→B→A)은 무한 루프가 되므로 반드시 막아야 하고, 안전을 위해 순회 횟수 상한도 둔다. */
/* 🐾 올라탄 좌석들의 위치를 '체인 순서대로' 갱신한다.
   ★ 반드시 아래층부터 처리해야 한다. seats 배열 순서대로 돌면 위층이 아래층보다 먼저 계산될 수 있고,
     그러면 위층이 한 프레임 전 위치를 보고 따라가면서 탑이 덜덜 떨린다.
     _rideDepth로 정렬해 바닥에 가까운 좌석부터 확정한 뒤 그 위를 올린다.
   ★ 각 층 계산 직후 matrixWorld를 갱신해야 바로 위층이 최신 머리 위치를 읽는다. */
/* 🎪 탑 전체를 무너뜨린다 — sleep 인원이 기준을 넘겨 균형을 잃은 경우.
   ★ unmountRide는 '위층을 아래로 내려앉히는' 동작이라 와해에는 맞지 않는다.
     여기서는 위층부터 순서대로 전원 하차시키고, 받치고 있던 맨 아래(인간 포함)까지 어지러움을 준다. */
function _collapseRideTower(bottomSeat, now){
  try{
    // 이 탑에 속한 좌석 전부 수집(위층 우선)
    const members = seats.filter(x=>x.ridingOn && rideBenchMod._rideIsAbove(x, bottomSeat) && x!==bottomSeat);
    members.sort((a,b)=>rideBenchMod._rideDepth(b)-rideBenchMod._rideDepth(a));   // 높은 층부터
    members.forEach(m=>{
      m.ridingOn = null;                       // unmountRide의 '아래로 내려앉기'를 타지 않게 직접 끊음
      try{ if(m.desk) m.desk.visible = true; }catch(_){}
      try{ m.group.position.y = 0; m.group.position.z = 0;
           m.group.quaternion.identity(); m.group.rotation.set(0,0,0); }catch(_){}
      m._circusOn = false; m._circusPanicAt = 0; m._rideHeadTop = null;
      m.dizzyUntil = now + rideTuneMod.CIRCUS_DIZZY_MS;    // 각자 자기 자리로 돌아가며 어지러움
      for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f', m), i*300);
    });
    // 받치고 있던 맨 아래(인간일 수도 있음)도 어지러움
    bottomSeat.dizzyUntil = now + rideTuneMod.CIRCUS_DIZZY_MS;
    bottomSeat._circusPanicAt = 0;
    for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f', bottomSeat), i*300);
    if(members.length) toast('🎪 균형을 잃고 무너졌어요!');
    /* 전원이 자기 자리로 돌아간다 — 이 경로는 unmountRide 를 안 타므로(직접 ridingOn 을 끊는다)
       재배치도 여기서 직접 부른다. 안 부르면 무너진 좌석들이 남의 자리에 겹쳐 선다. */
    if(members.length){ try{ layoutSeats(); }catch(_){} }
  }catch(e){ console.warn('[묘기] 와해 처리 실패', e); }
}
/* 🎪 탑마다 sleep 인원을 세어 흔들림/와해를 판정한다. */
/* 본문은 room/flying-chair.js 로 옮겼다(앱 FSD · app.js 분리 M18). 비행 상수 · canFly · startFlight · _flyActive 의 주인이다. 뒤에서 선언되는 값은 함수로 넘긴다. */
const flyChairMod = TwFlyingChair.createFlyingChair({
  seats: seats,
  toast: (...a)=>toast(...a),
});
const FLY_MS = flyChairMod.FLY_MS;   // 옛 전역 이름
const FLY_EDGE_X = flyChairMod.FLY_EDGE_X;   // 옛 전역 이름
const FLY_EDGE_TOP = flyChairMod.FLY_EDGE_TOP;   // 옛 전역 이름
const FLY_DROP = flyChairMod.FLY_DROP;   // 옛 전역 이름
const FLY_RETURN_MS = flyChairMod.FLY_RETURN_MS;   // 옛 전역 이름
const FLY_DIZZY_MS = flyChairMod.FLY_DIZZY_MS;   // 옛 전역 이름
const FLY_MIN_LEVEL = flyChairMod.FLY_MIN_LEVEL;   // 옛 전역 이름
const FLY_STREAK = flyChairMod.FLY_STREAK;   // 옛 전역 이름
const FLY_STREAK_MS = flyChairMod.FLY_STREAK_MS;   // 옛 전역 이름
const FLY_COOL_MS = flyChairMod.FLY_COOL_MS;   // 옛 전역 이름
const flySeed = flyChairMod.flySeed;   // 옛 전역 이름
const canFly = flyChairMod.canFly;   // 옛 전역 이름
const startFlight = flyChairMod.startFlight;   // 옛 전역 이름

/* ═══ 🙈 워킹룸 캐릭터 숨기기 (2026-09-23 · handoff-2026-09-21-features §5) ═══════════════════
   상대 캐릭터 우클릭 → «🙈 숨기기». **내 화면에서만 · 그 방에 있는 동안만 · 워킹룸(채널 1)에서만.**
   ★ 키 = seat.friendId(방 세션 memberId). 방마다 새로 뽑히는 값이라 사람 단위 영구 기억이 아니다(그건 «차단» — 별개 설계).
   ★ localStorage 에 쓰지 않는다. 방 입장 직전(Presence.start 앞)과 doLeaveRoom 에서 비운다.
   ★ 적용은 프레임 루프가 **매 프레임** 한다(rig.visible · 머리 위 말풍선 · 책상 위 상태 이모지).
     좌석이 재동기화·재접속으로 새로 그려져도 friendId 가 같으면 다음 프레임에 그대로 다시 숨는다.
   ★ 책상·이름표·경험치 바는 남긴다 — 빈 책상이 누구 것인지 보여야 우클릭 «🙉 다시 보이기» 로 풀 수 있다.
   ⚠️ three.js 레이캐스트는 visible=false 를 거르지 않는다 → 좌클릭 잡기 · 💣 조준 · 🪄 때리기 조준 세 곳이
     _hitsSkipHidden 으로 거른다. **우클릭 메뉴는 거르지 않는다**(책상을 눌러 «다시 보이기» 가 떠야 한다).
   ⚠️ 숨긴 캐릭터 위에 올라탄 남의 캐릭터는 그대로 둔다(허공에 떠 보일 수 있음 — 범위 밖). */
/* 본문은 hidden-seats.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const hiddenSeatsMod = TwHiddenSeats.createHiddenSeats({
  hiddenAccountStore: accountStoreMod,
  _flyActive: ()=>flyChairMod._flyActive(),
  seatFromObject: (...a)=>seatFromObject(...a),
  seats: seats,
});

/* ═══ 🛰 poke 신선도 ═══════════════════════════════════════════════════
   방 노드의 `poke` 는 **한 칸짜리 우편함**이다(rooms/$room/$memberId/poke). 새 알림이 오면
   덮어쓸 뿐, 다 읽었다고 비워지지 않는다. 그래서 마지막에 담긴 값(예: `fly:1234`)이 그 자리에
   계속 남고, 그 값이 다시 배달되기만 하면 **아무도 폭탄을 안 눌렀는데 캐릭터가 날아간다.**
   다시 배달되는 경로가 실제로 여럿이다:
     · `serverTimestamp()` 는 로컬 추정값으로 한 번, 서버 확정값으로 또 한 번 — 한 번의 poke 에
       onValue 가 **두 번** 온다. 두 번째가 늦게 오면 이미 끝난 비행이 다시 시작된다.
     · 재접속하면 리스너가 다시 붙으면서 그 자리의 현재 값이 즉시 한 번 배달된다.
   ★ 그래서 판정을 둘 둔다: **같은 ts 는 한 번만**(중복), **오래된 ts 는 아예 안 본다**(유통기한).
     친구 좌석 쪽은 예전부터 ts 중복 검사가 있었는데 내 좌석 쪽에는 없었다 — 같은 규칙으로 맞춘다.
   ⚠️ 유통기한은 비행 길이(FLY_MS=10초)보다 넉넉해야 한다. 짧게 잡으면 왕복이 느린 회선에서
     진짜 알림이 버려진다. */
/* 본문은 room-sync.js 로 옮겼다(앱 FSD 35번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
/* 🧭 창 열기 통로(nav.js) — 아래 기능이 «설정 창 · 마이홈 열어 줘 · 방에서 나가 줘» 를 부탁하는 한 곳(모듈 순환 끊기 6).
   창 모듈이 만들 때 여는 함수를 걸고, 부르는 모듈은 이름으로 부탁만 한다 */
const twNav = TwNav;
const demojiCatalog = TwDemojiCatalog;   // 😊 기본 이모티콘 목록(demoji-catalog.js — 채팅 · 마이홈 바탕화면이 같이 읽는 맨 아래 표)
const uploadCacheMod = TwUploadCache.createUploadCache();   // 🗂️ 업로드 캐시 상한 규칙 — 얼굴(room-sync) · 슬롯 GLB(slot-codec)가 같이 쓴다
const roomSyncMod = TwRoomSync.createRoomSync({
  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,
  ITEM_LICENSE_HOLD: ()=>premiumMod.ITEM_LICENSE_HOLD,
  Presence: ()=>Presence,
  _autoAwayResetClock: (...a)=>window._autoAwayResetClock(...a),   // 🛰 Presence(room/presence.js)가 거는 시계 되감기 — 모듈끼리 window 로 서로 부르지 않게 여기서 잇는다
  _chatIsSecretRoom: (...a)=>chatLockMod._chatIsSecretRoom(...a),
  faceUploadCache: uploadCacheMod,
  getMyUserId: (...a)=>getMyUserId(...a),
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
  twNav: twNav,
  savedDesks: ()=>commissionMod.savedDesks(),
  toast: (...a)=>toast(...a),
  diagNote: (...a)=>{ if(window.companion && companion.diagNote) companion.diagNote(...a); },   // 브라우저 미리보기 · 검사엔 companion 이 없다
});

/* ═══ 💃💥 깜짝쇼 ═══════════════════════════════════════════════════
   **같은 춤 명령을 세 번** 쓰면 명령마다 다른 일이 일어난다:
     · `/80` ×3  — 나는 춤추고 **나머지는 전부 날아간다**(폭발).
     · `/150` ×3 — 아무도 안 날아가고 **회전만 두 배로 빨라진다**(터보). 6초 안에 10바퀴.
   두 가지 쓰는 법을 모두 받는다:
     · 한 줄에 이어쓰기 — `/80/80/80`, `/150/150/150` (한 번 보내면 그 자리에서 걸린다)
     · 따로 보내기 — `/80` · `/80` · `/80` (1분 안에)
   ★ 설계 원칙 넷:
     · **명령으로만 센다.** 춤추기 버튼(startMyDance 를 cmd 없이 부른다)은 세지 않는다.
       예전에는 '춤을 세 번'이라 버튼으로도 터졌는데, 누르려던 게 아닌 사람이 터뜨리게 된다.
     · **같은 명령이어야 한다.** `/80` 다음 `/150` 이 오면 흐름이 끊기고 새 명령부터 다시 센다
       (`_eggCountCmd` 의 필터가 cmd 까지 본다). 종류가 섞이지 않는 것은 여기서 보장된다.
     · **알리지 않는다.** 한 번·두 번째에 아무 표시도 하지 않고, 터져도 대화 기록을 남기지 않는다.
       깜짝쇼라서 예고하면 재미가 없다(일반 폭탄은 기록을 남기지만 이건 일부러 뺀다).
     · **내 화면의 기억일 뿐이다.** 서버에 새 필드를 만들지 않는다 — 폭발은 평소와 똑같은 fly poke 고,
       터보는 평소와 똑같은 `dance:스타일` poke 다. 받는 쪽 코드는 한 줄도 바뀌지 않는다.
       남이 걸어준 춤(poke 수신)도 세지 않는다 — 세면 남이 내 깜짝쇼를 대신 터뜨릴 수 있다.
   ⚠️ 춤 명령에는 5초 쿨다운이 있다 — 따로 세 번이면 최소 10초, 60초 창 안에 넉넉히 들어간다.
     쿨다운을 늘리려면 이 창(EGG_WINDOW_MS)도 같이 볼 것.
     이어쓰기(`/80/80/80`)는 한 번의 전송이라 쿨다운을 한 번만 먹는다 — 그래서 창과 무관하다. */
/* 본문은 tricks.js 로 옮겼다(앱 FSD 25번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const tricksMod = TwTricks.createTricks({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CHAR_Z: CHAR_Z,
  FLOATER_BURST: ()=>floatersMod.FLOATER_BURST,
  FLY_COOL_MS: FLY_COOL_MS,
  FLY_DIZZY_MS: FLY_DIZZY_MS,
  FLY_DROP: FLY_DROP,
  FLY_EDGE_TOP: FLY_EDGE_TOP,
  FLY_EDGE_X: FLY_EDGE_X,
  FLY_MS: FLY_MS,
  FLY_RETURN_MS: FLY_RETURN_MS,
  FLY_STREAK: FLY_STREAK,
  FLY_STREAK_MS: FLY_STREAK_MS,
  Presence: ()=>Presence,
  _bonkSnd: ()=>sfxMod._bonkSnd,
  _flyActive: ()=>flyChairMod._flyActive(),
  _hitsSkipHidden: (...a)=>hiddenSeatsMod._hitsSkipHidden(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  _rideIsAbove: (...a)=>rideBenchMod._rideIsAbove(...a),
  _rideLeaveTower: (...a)=>rideBenchMod._rideLeaveTower(...a),
  _seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  _skipHiddenDesk: (...a)=>hiddenSeatsMod._skipHiddenDesk(...a),
  _todayStr: (...a)=>focusTotalMod._todayStr(...a),
  camera: camera,
  canFly: (...a)=>canFly(...a),
  canvas: canvas,
  creatorOpen: ()=>creatorOpen,
  flySeed: (...a)=>flySeed(...a),
  getUserName: (...a)=>getUserName(...a),
  myCode: ()=>TwRoomRt.store.myCode(),
  chatNet: TwChatRt.store,
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
  ndc: ()=>ndc,
  officeMode: ()=>officeModeMod.officeMode(),
  purikuraUi: ()=>purikuraUi,
  ray: ()=>ray,
  seatCharZ: (...a)=>seatCharZ(...a),
  seatFromObject: (...a)=>seatFromObject(...a),
  seatScale: (...a)=>seatEqMod.seatScale(...a),
  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),
  seats: seats,
  showChatBubble: (...a)=>showChatBubble(...a),
  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),
  startFlight: (...a)=>startFlight(...a),
  toast: (...a)=>toast(...a),
  setFlyActive: (v)=>{ flyChairMod.setFlyActive(v); },
});

/* ═══ 🔊 효과음 공장(_mkSndPool) — 때리기 · 클릭음 · 채팅 · 뽀모도로 알림음 풀 ═══ */
/* 본문은 sfx.js 로 옮겼다(앱 FSD 42번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const sfxMod = TwSfx.createSfx({
  officeMode: ()=>officeModeMod.officeMode(),
});
/* ═══ 🗼 올라타기(탑) · 벤치 좌석 자리 잡기 ═══ */
/* 탑 바닥 찾기는 room/ride-chain.js(순수) — 올라타기 · 좌석 줄 배치가 서로를 부르지 않고 같이 쓴다. */
const rideChainMod = TwRideChain.createRideChain({
});
/* 본문은 ride-bench.js 로 옮겼다(앱 FSD 30번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const rideBenchMod = TwRideBench.createRideBench({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CIRCUS_FOOT_CENTER: rideTuneMod.CIRCUS_FOOT_CENTER,
  CIRCUS_FOOT_SINK: rideTuneMod.CIRCUS_FOOT_SINK,
  CIRCUS_FOOT_Z: rideTuneMod.CIRCUS_FOOT_Z,
  CIRCUS_FOOT_Z_FROM_TOP: rideTuneMod.CIRCUS_FOOT_Z_FROM_TOP,
  CIRCUS_MIN_DEPTH: rideTuneMod.CIRCUS_MIN_DEPTH,
  CIRCUS_PANIC_MS: rideTuneMod.CIRCUS_PANIC_MS,
  CIRCUS_PANIC_SLEEPERS: rideTuneMod.CIRCUS_PANIC_SLEEPERS,
  CIRCUS_SWAY_CALM: rideTuneMod.CIRCUS_SWAY_CALM,
  CIRCUS_SWAY_PANIC: rideTuneMod.CIRCUS_SWAY_PANIC,
  CIRCUS_SWAY_SPEED: rideTuneMod.CIRCUS_SWAY_SPEED,
  CIRCUS_TOP_SLAB: rideTuneMod.CIRCUS_TOP_SLAB,
  CIRCUS_TREMOR_AMP: rideTuneMod.CIRCUS_TREMOR_AMP,
  CIRCUS_TREMOR_AT: rideTuneMod.CIRCUS_TREMOR_AT,
  CIRCUS_TREMOR_CALMDOWN: rideTuneMod.CIRCUS_TREMOR_CALMDOWN,
  CIRCUS_TREMOR_SPD: rideTuneMod.CIRCUS_TREMOR_SPD,
  CIRCUS_YAW_MAX: rideTuneMod.CIRCUS_YAW_MAX,
  CIRCUS_YAW_MIN: rideTuneMod.CIRCUS_YAW_MIN,
  CIRCUS_YAW_RANDOM: rideTuneMod.CIRCUS_YAW_RANDOM,
  CIRCUS_Z_DEPTH_K_ON_ANIMAL: rideTuneMod.CIRCUS_Z_DEPTH_K_ON_ANIMAL,
  IDESK_ENABLED: ()=>iDeskMod.IDESK_ENABLED,
  INTERACTION_DESKS: ()=>iDeskMod.INTERACTION_DESKS,
  Presence: ()=>Presence,
  RIDE_ARM_SINK: rideTuneMod.RIDE_ARM_SINK,
  RIDE_ARM_SINK_ON_ANIMAL: rideTuneMod.RIDE_ARM_SINK_ON_ANIMAL,
  RIDE_ARM_SIZE_FOLLOW: rideTuneMod.RIDE_ARM_SIZE_FOLLOW,
  RIDE_FOLLOW_HEAD_TILT: rideTuneMod.RIDE_FOLLOW_HEAD_TILT,
  RIDE_HEAD_OFFSET_Y: rideTuneMod.RIDE_HEAD_OFFSET_Y,
  RIDE_HEAD_OFFSET_Z: rideTuneMod.RIDE_HEAD_OFFSET_Z,
  RIDE_HEAD_OFFSET_Z_ON_ANIMAL: rideTuneMod.RIDE_HEAD_OFFSET_Z_ON_ANIMAL,
  RIDE_MAX_STACK: rideTuneMod.RIDE_MAX_STACK,
  RIDE_PART_CENTER_MARGIN: rideTuneMod.RIDE_PART_CENTER_MARGIN,
  RIDE_Z_DEPTH_K_ON_ANIMAL: rideTuneMod.RIDE_Z_DEPTH_K_ON_ANIMAL,
  _collapseRideTower: (...a)=>_collapseRideTower(...a),
  _deskDefById: (...a)=>iDeskMod._deskDefById(...a),
  _measureAnimalArmH: (...a)=>rideMeasureMod._measureAnimalArmH(...a),
  _measureCircusFootOff: (...a)=>rideMeasureMod._measureCircusFootOff(...a),
  _rideAwayP: rideTuneMod._rideAwayP,
  _rideAwayS: rideTuneMod._rideAwayS,
  _rideAxisY: rideTuneMod._rideAxisY,
  _rideBottom: (...a)=>rideChainMod._rideBottom(...a),
  _rideFootOff: rideTuneMod._rideFootOff,
  _rideHostSpinY: (...a)=>rideMeasureMod._rideHostSpinY(...a),
  _rideOff: rideTuneMod._rideOff,
  _rideQC: rideTuneMod._rideQC,
  _rideQD: rideTuneMod._rideQD,
  _rideQP: rideTuneMod._rideQP,
  _rideQR: rideTuneMod._rideQR,
  _rideQSpin: rideTuneMod._rideQSpin,
  _rideQY: rideTuneMod._rideQY,
  _rideTmp: rideTuneMod._rideTmp,
  _rideWP: rideTuneMod._rideWP,
  broadcastRide: (...a)=>broadcastRide(...a),
  charLiftWorld: (...a)=>seatEqMod.charLiftWorld(...a),
  diagNote: (...a)=>{ if(window.companion && companion.diagNote) companion.diagNote(...a); },   // 브라우저 미리보기 · 검사엔 companion 이 없다
  getActiveInteractionDeskId: (...a)=>iDeskMod.getActiveInteractionDeskId(...a),
  isDeskUnlocked: (...a)=>iDeskMod.isDeskUnlocked(...a),
  levelText: (...a)=>iDeskMod.levelText(...a),
  lockedToast: (...a)=>iDeskMod.lockedToast(...a),
  isPartByRigOrName: (...a)=>bodyMeasureMod.isPartByRigOrName(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  matWood: matWood,
  matWoodD: matWoodD,
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
  measureHeadBoxNoParts: (...a)=>charMeasureMod.measureHeadBoxNoParts(...a),
  savedParts: ()=>premiumMod.savedParts(),
  seatScale: (...a)=>seatEqMod.seatScale(...a),
  seatState: (...a)=>seatState(...a),
  seats: seats,
  setActiveInteractionDeskId: (...a)=>iDeskMod.setActiveInteractionDeskId(...a),
  toast: (...a)=>toast(...a),
});
/* ═══════════════════════════════════════════════════════════════════
   🪑 상호작용 책상 카탈로그 + 레벨 해금 (I키 인벤토리)
   · 번들 내장(GLB + 도트 썸네일 PNG). 코드는 자격을 여는 잠금해제일 뿐 — 서버 비용 0.
   · 해금 조건: 내 레벨 ≥ reqLevel. 관리자는 전부 해금.
   · GLB는 아직 준비 전이므로 glb=null이면 임시 프리미티브 벤치로 대체(검증용).
   ═══════════════════════════════════════════════════════════════════ */
/* 본문은 interaction-desk.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const iDeskMod = TwInteractionDesk.createInteractionDesk({
  accountStore: accountStoreMod,
  CIRCUS_ARM_DROP: rideTuneMod.CIRCUS_ARM_DROP,
  CIRCUS_LEG_LIFT: rideTuneMod.CIRCUS_LEG_LIFT,
  CIRCUS_LEG_STAND: rideTuneMod.CIRCUS_LEG_STAND,
  Presence: ()=>Presence,
  RIDE_MAX_STACK: rideTuneMod.RIDE_MAX_STACK,
  RIDE_SNAP_DIST: rideTuneMod.RIDE_SNAP_DIST,
  _rideTmp: rideTuneMod._rideTmp,
  _rideWP: rideTuneMod._rideWP,
  focusLevelMod: ()=>focusLevelMod,
  isAdmin: ()=>isAdmin,
  rideBenchMod: rideBenchMod,
  seats: seats,
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});

/* ═══ 🪑 좌석 배치(layoutSeats) · 카메라 · 도트 텍스처 필터 ═══ */
/* 본문은 room/seat-layout.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatLayoutMod = TwSeatLayout.createSeatLayout({
  MULTIPLAYER_SPACING: ()=>seatsMod.MULTIPLAYER_SPACING(),
  SPACING: ()=>seatsMod.SPACING(),
  _rideBottom: (...a)=>rideChainMod._rideBottom(...a),
  clampDeskPan: (...a)=>clampDeskPan(...a),
  deskPanX: ()=>charPlaceMod.deskPanX(),
  deskPanY: ()=>charPlaceMod.deskPanY(),
  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),
  roomSeatMode: ()=>roomSeatMode,
  seatCameraMod: ()=>seatCameraMod,
  seatDeskHalfWidth: (...a)=>seatDeskHalfWidth(...a),
  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),
  seats: seats,
  syncSeatEqualize: (...a)=>seatEqMod.syncSeatEqualize(...a),
  setCachedRowCenter: (v)=>{ charPlaceMod.setCachedRowCenter(v); },
  setCachedRowSpan: (v)=>{ charPlaceMod.setCachedRowSpan(v); },
  setDeskPanX: (v)=>{ charPlaceMod.setDeskPanX(v); },
  setDeskPanY: (v)=>{ charPlaceMod.setDeskPanY(v); },
});
/* layoutSeats 는 이 이름 그대로 app.js 에 둔다 — 부르는 곳 · 다른 모듈 deps 가 이 이름을 본다. 배치한 뒤 할 일(데스크탑 창 크기 맞춤)은 아래에서 알림(onLaidOut)에 건다. */
function layoutSeats(){ seatLayoutMod.layoutAndNotify(); }
/* 파츠 구성이 바뀐 뒤 좌석 다시 맞추기 한 벌(room/seat-refit.js) — 꾸미기 저장 · 친구 파츠 변경 · 좌석 다시 짓기 · 카탈로그 · 관리자 등록이 같이 부른다. */
const seatRefitMod = TwSeatRefit.createSeatRefit({
  fitModel: (...a)=>fitModel(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  requestFrame: (...a)=>requestAnimationFrame(...a),
  seats: seats,
});
seatRefitMod.onRefitted((s)=>{ rideBenchMod._remeasureRideArm(s); rideBenchMod._remeasureRideHeadTop(s); });   // 탄 동물 팔 높이 · 올라탄 사람 높이 다시 재기 — 알림으로 거는 까닭은 seat-refit.js 머리 주석
/* 본문은 room/seat-camera.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatCameraMod = TwSeatCamera.createSeatCamera({
  BASE_PXW: BASE_PXW,
  DOT_RENDER_SCALE: DOT_RENDER_SCALE,
  _cachedRowCenter: ()=>charPlaceMod._cachedRowCenter(),
  _cachedRowSpan: ()=>charPlaceMod._cachedRowSpan(),
  camera: camera,
  canvas: canvas,
  deskPanX: ()=>charPlaceMod.deskPanX(),
  deskPanY: ()=>charPlaceMod.deskPanY(),
  dotRenderEnabled: ()=>dotRenderEnabled,
  dotRenderMod: ()=>dotRenderMod,
  focusCharScale: ()=>charPlaceMod.focusCharScale(),
  renderer: renderer,
  sizeFactor: ()=>charPlaceMod.sizeFactor(),
  renderQuality: ()=>_renderQuality,
  runLowered: ()=>_runLowered,
});
/* 본문은 shared/dot-render.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const dotRenderMod = TwDotRender.createDotRender({
  scene: scene,
  ps1Dither: TwPs1Dither,
});
/* ============================================================ FIT */
/* 본문은 character/char-measure.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const charMeasureMod = TwCharMeasure.createCharMeasure({
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
});
const restPoseMod = TwRestPose.createRestPose();   // 🧍 fitModel 은 기본 자세로 잰다(character/rest-pose.js)
const fitWatchMod = TwFitWatch.createFitWatch({ warn: (m)=>console.warn(m) });   // 🩺 다시 맞춘 높이가 설명 안 되면 경고 → tw-error.log
/* 본문은 character/floor-snap-diag.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const floorSnapDiagMod = TwFloorSnapDiag.createFloorSnapDiag({
  charMeasureMod: charMeasureMod,
  findMySeat: (...a)=>findMySeat(...a),
  wardrobeMod: ()=>wardrobeMod,
});
/* 📐 몸 · 책상 맞춤(character/fit-model.js) — 아래 const 는 옛 전역 이름이다. */
const fitModelMod = TwFitModel.createFitModel({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  COMMISSION_SCALE_CORRECTION: COMMISSION_SCALE_CORRECTION,
  charMeasureMod: charMeasureMod,
  clampCharY: clampCharY,
  creatorPrevMod: ()=>creatorPrevMod,
  refreshRiggedPartsXf: (...a)=>refreshRiggedPartsXf(...a),
  seatEqMod: seatEqMod,
  restPoseMod: restPoseMod,
  fitWatchMod: fitWatchMod,
});
const fitModel = fitModelMod.fitModel;   // 옛 전역 이름
const fitDesk = fitModelMod.fitDesk;   // 옛 전역 이름

/* ============================================================ FILE LOADING */
/* 본문은 character/seat-model-load.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({
  assetCodeMod: ()=>assetCodeMod,
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  boneSide: (...a)=>boneSide(...a),
  fitDesk: (...a)=>fitDesk(...a),
  fitModel: (...a)=>fitModel(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  loader: loader,
  selected: ()=>seatsMod.selected(),
  setInfo: (...a)=>seatPanelMod.setInfo(...a),
  sliders: ()=>seatPanelMod.sliders,
  toast: (...a)=>toast(...a),
});
/* ============================================================ UI */
/* 본문은 character/seat-panel.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatPanelMod = TwSeatPanel.createSeatPanel({
  activity: (...a)=>activity(...a),
  seats: seats,
  selected: ()=>seatsMod.selected(),
  triggerPet: (...a)=>triggerPet(...a),
  setSelected: (v)=>{ seatsMod.setSelected(v); },
});
/* 🪑 좌석 목록이 위층(줄 배치 · 좌석 탭 · 좌석 고르기)을 부르지 않게 알림을 건다 — layoutSeats 는 아래에서 정의되므로 부를 때 찾는다. createSeat · removeSeat 보다 먼저. */
seatsMod.attach({
  layoutSeats: ()=>layoutSeats(),
  renderSeatTabs: ()=>seatPanelMod.renderSeatTabs(),
  selectSeat: (seat)=>seatPanelMod.selectSeat(seat),
});

document.getElementById('glbInput').addEventListener('change',e=>seatModelLoadMod.handleFiles(e.target.files,seatsMod.selected()));
document.getElementById('deskInput').addEventListener('change',e=>seatModelLoadMod.handleFiles(e.target.files,seatsMod.selected()));
document.getElementById('texInput').addEventListener('change',e=>seatModelLoadMod.handleFiles(e.target.files,seatsMod.selected()));
document.getElementById('resetBtn').addEventListener('click',()=>seatModelLoadMod.resetSeat(seatsMod.selected()));
document.getElementById('sZoom').addEventListener('input',e=>{charPlaceMod.setSizeFactor(+e.target.value);layoutSeats();});
document.getElementById('sScale').addEventListener('input',e=>{seatsMod.selected().userScale=+e.target.value;fitModel(seatsMod.selected());saveSeatXf(seatsMod.selected());layoutSeats();});
/* 🧍 높이 — 0 하한·CHAR_Y_MAX 상한. 슬라이더 범위도 여기서 심는다(HTML 의 min 이 음수면 죽은 구간이 된다). */
(function _sYSliderRange(){ const el=document.getElementById('sY'); if(!el) return;
  el.min=0; el.max=CHAR_Y_MAX; el.step=0.01; el.title='캐릭터 높이'; })();
document.getElementById('sY').addEventListener('input',e=>{seatsMod.selected().userY=clampCharY(e.target.value);fitModel(seatsMod.selected());saveSeatXf(seatsMod.selected());layoutSeats();});
/* 🚫 앞뒤(userZ)는 폐기 — 이 슬라이더를 움직여도 0 을 유지한다. 값을 되살리면 생성기·미리보기에는
   대응하는 조정 수단이 없어서 그 화면들과만 어긋난다(그게 폐기한 이유다). HTML 에서 이 슬라이더를
   지우는 편이 낫지만, 남아 있어도 사고가 나지 않게 여기서 막는다. */
document.getElementById('sZ').addEventListener('input',e=>{seatsMod.selected().userZ=0;e.target.value=0;fitModel(seatsMod.selected());saveSeatXf(seatsMod.selected());layoutSeats();});
document.getElementById('sRot').addEventListener('input',e=>{seatsMod.selected().userRot=+e.target.value;fitModel(seatsMod.selected());saveSeatXf(seatsMod.selected());});

/* ============================================================ USER STATUS (활동 상태)
   A안 — 자동감지(focus/idle/sleep/pet)는 그대로 유지하고, 이 상태는 별도 축으로 동작:
   · 🍚 meal / 🎮 gaming: 책상 위에 판넬 표시 (본인 좌석만), 머리 위 이모지(모든 좌석)
   · 🫧 away: 자동상태 무시하고 sleep 모션 강제 + 캐릭터 opacity 0.30 (영혼)
   · 🔥 grind: idle 상태일 때만 모션 변형(머리 더 숙임/호흡 빠름/미세 흔들)
   본인 변경은 자기 화면 칩으로, 친구에게는 머리 위 이모지로만 보임.
   Phase 7(Firebase) 단계에서 Presence.update에 userStatus 필드를 함께 송수신할 예정. */
/* 본문은 status/user-status-table.js 로 옮겼다(구역 떼기 C · w1).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const userStatusTableMod = TwUserStatusTable.createUserStatusTable({
  statusAccountStore: accountStoreMod,
});

/* 🫧 활동 상태(밥 · 게임 · 자리비움 · 빡일 · 커스텀) 저장 · 칩 · 메뉴 + 좌석 xf 저장(status/user-status.js) — 아래 const 는 옛 전역 이름이다. */
const userStatusMod = TwUserStatus.createUserStatus({
  accountStoreMod: accountStoreMod,
  clampCharY: clampCharY,
  findMySeat: (...a)=>findMySeat(...a),
  isPremium: ()=>isPremium,
  slots: ()=>slots,
  userStatusTableMod: userStatusTableMod,
});
/* 다른 도메인(방 알림 · 오늘 기록 전시 · 슬롯 저장 · 칩 색 변환)은 모듈이 부르지 않고 알림으로 건다 — 상태를 바꾸기 전에. */
userStatusMod.attachStatusHooks({
  focusShowMine: ()=>focusShareMod._focusShowMine(),
  hexToRgba: (...a)=>statusChipMod.hexToRgba(...a),
  saveSlots: ()=>slotSaveMod.saveSlots(),
  setCustomStatus: (c)=>Presence.setCustomStatus(c),
  setUserStatus: (v)=>Presence.setUserStatus(v),
});
const _premiumOn = userStatusMod._premiumOn;   // 옛 전역 이름
const saveCustomStatusConf = userStatusMod.saveCustomStatusConf;   // 옛 전역 이름
const statusConfFor = userStatusMod.statusConfFor;   // 옛 전역 이름
const setUserStatus = userStatusMod.setUserStatus;   // 옛 전역 이름
const loadUserStatusFromStorage = userStatusMod.loadUserStatusFromStorage;   // 옛 전역 이름
const refreshMyStatusUI = userStatusMod.refreshMyStatusUI;   // 옛 전역 이름
const refreshCustomStatusMenuItem = userStatusMod.refreshCustomStatusMenuItem;   // 옛 전역 이름
const saveSeatXf = userStatusMod.saveSeatXf;   // 옛 전역 이름
window.setUserStatus = setUserStatus;   // presence.js · room-sync.js 가 window. 로 부른다(옛 함수 선언이 걸어 주던 전역 — 안쪽 같은 이름이 가려서 꼭 window. 로)
/* 본문은 status/chip-popups.js 로 옮겼다(구역 떼기 C · w1). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const chipPopupsMod = TwChipPopups.createChipPopups({
  userStatus: ()=>userStatusMod.userStatus(),
});

/* ═══ 🪟 창 겹침 — 누른 창 맨 앞(bringWinToFront) · ESC 스택(escRegisterWindow) ═══ */
/* 본문은 win-stack.js 로 옮겼다(앱 FSD 42번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const winStackMod = TwWinStack.createWinStack({
  closers: ()=>windowClosers,
  backToLauncher: (...a)=>backToLauncher(...a),
});

/* ═══ 📐 상태칩 팝업 · 입력창 자리 계산 · 캐릭터 실측 ═══ */
/* 본문은 status-chip.js 로 옮겼다(앱 FSD 36번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const statusChipMod = TwStatusChip.createStatusChip({
  CUSTOM_STATUS_MAXLEN: userStatusTableMod.CUSTOM_STATUS_MAXLEN,
  Presence: ()=>Presence,
  _CHIP_POPUPS: chipPopupsMod._CHIP_POPUPS,
  _charBadWhy: ()=>moveModeMod._charBadWhy(),
  _charBoundsLatest: ()=>moveModeMod._charBoundsLatest(),
  _charProjSane: (...a)=>_charProjSane(...a),
  _closeChipPopups: (...a)=>chipPopupsMod._closeChipPopups(...a),
  _danceCmdCooldownAt: ()=>iDeskMod._danceCmdCooldownAt(),
  _lowestDanceReq: (...a)=>iDeskMod._lowestDanceReq(...a),
  lockedToast: (...a)=>iDeskMod.lockedToast(...a),
  _moveModeJustToggled: ()=>moveModeMod._moveModeJustToggled(),
  _officeHidden: ()=>officeModeMod._officeHidden(),
  _seatHidden: (...a)=>hiddenSeatsMod._seatHidden(...a),
  _pickUnlockedDance: (...a)=>iDeskMod._pickUnlockedDance(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  _rollRoulette: (...a)=>rouletteMod._rollRoulette(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  camera: camera,
  chatUiMod: ()=>chatUiMod,
  clickPolicy: TwClickThroughPolicy,
  customStatusConf: ()=>userStatusTableMod.customStatusConf(),
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
  moveMode: ()=>moveModeMod.moveMode(),
  renderer: renderer,
  rideBenchMod: rideBenchMod,
  saveCustomStatusConf: (...a)=>saveCustomStatusConf(...a),
  seats: seats,
  setUserStatus: (...a)=>setUserStatus(...a),
  startMyDance: (...a)=>iDeskMod.startMyDance(...a),
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatusMod.userStatus(),
  setCharBadWhy: (v)=>{ moveModeMod.setCharBadWhy(v); },
  setCharBoundsLatest: (v)=>{ moveModeMod.setCharBoundsLatest(v); },
  setDanceCmdCooldownAt: (v)=>{ iDeskMod.setDanceCmdCooldownAt(v); },
  setMoveModeJustToggled: (v)=>{ moveModeMod.setMoveModeJustToggled(v); },
  setMoveMode: (v)=>{ moveModeMod.setMoveMode(v); },
});
/* 칩 첫 그리기 → 이 모니터 캐릭터 크기 복원. 저장된 상태 · 커스텀 상태는 만들 때가 아니라 확인 뒤에 읽는다(userLocal 의 status 조각 — 계정 칸).
   ⚠️ statusChipMod 를 만든 **뒤**에 부른다 — 모듈 안에서 부르면 refreshMyStatusUI 가 아직 없는 statusChipMod 를 읽어
   던지고(상태를 저장해 둔 사람만), 그 뒤 app.js 가 통째로 멈춘다. 칩 버튼 · 메뉴가 없는 화면은 예전처럼 건너뛴다. */
if(document.getElementById('myStatusChipBtn') && document.getElementById('myStatusMenu')){
  refreshMyStatusUI();
  refreshCharScaleForCurrentDisplay();
  refreshCustomStatusMenuItem();
}

/* ═══ 😊 기본 이모티콘 (demoji) 말풍선 — 채팅이 없는 워킹룸용 ═══
   · 라이선스 여부와 무관하게 방에 있는 모두가 사용 가능(텍스트 채팅은 여전히 투게더룸 전용).
   · 전송 형식은 프리미엄 채팅과 동일한 [demoji:id] 마커 하나 — 좌석 말풍선 렌더러가 이미 지원하므로
     수신 측은 구버전 클라이언트도 이미지로 정상 표시됨(전송만 신버전 필요).
   · 팔레트는 첫 클릭 때 DEMOJI_LIST로 지연 생성(DEMOJI_LIST는 아래쪽에서 const 선언되므로 로드 시점엔 TDZ). */
/* 본문은 demoji-palette.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const demojiPalMod = TwDemojiPalette.createDemojiPalette({
  Presence: ()=>Presence,
  _closeChipPopups: (...a)=>chipPopupsMod._closeChipPopups(...a),
  chatUiMod: ()=>chatUiMod,
  findMySeat: (...a)=>findMySeat(...a),
  showChatBubble: (...a)=>showChatBubble(...a),
  statusChipMod: statusChipMod,
  demojiSfxOn: (...a)=>chatPrefsMod._demojiSfxOn(...a),
  setDemojiSfxOn: (...a)=>chatPrefsMod._setDemojiSfxOn(...a),
  sfxOfficeLock: (...a)=>chatPrefsMod._chatSfxOfficeLock(...a),
});
/* ═══ 🎵 상태칩 플레이리스트 ═══ */
/* 🎵 플레이리스트(데이터 · 화면 · 프리셋 고르기 · 🐕 재생 감시견 · 재생 제어 · 버튼 연결)는 parts/playlist.js 로 옮겼다(앱 FSD 16번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 만들 때 예전처럼 돈다(🪟 창 위치 초기화 등록 · 저장값 읽기 · 버튼 · ESC · 끌기 연결 · 미니미 · 300ms 폴링 ·
     BGM 신호 구독 · 음량 한 번). 예전엔 «🐕 재생 감시견» 구역 끝에서 돌았지만 그 사이(👤 · 🏅)는 선언뿐이라 순서는 같다.
   부르는 곳은 plMod.이름(전부 이 줄보다 늦게 돈다). 상태는 모듈 안에 있고 밖(계정 이어받기 복원 · 로그아웃 · 📷 재생 재우기 · 화면 배율)은
     상태 묶음 plMod.st 로 읽고 쓴다. 상태칩 팝업 자리(_repositionOpenChipPopups — 이 줄보다 위) · noise.js 가 typeof 를 걸고 부르는
     _plHasSavedPos · _plApplyPos · _plSyncBgmBounds 는 모듈이 window 고리로도 건다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeLoaded · _myHomeData · _myHomeFriends 는 이 줄보다 뒤에 선언되고 다시 대입되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const playlistApiMod = TwPlaylistApi.createPlaylistApi({ authed: TwApi.authed, random: ()=>Math.random(), warn: (...a)=>console.warn(...a) });   // 🌐 플레이리스트 서버 endpoint(/v2/me/playlist · /v2/playlists/…)
/* 👍 플레이리스트 반응 — 플레이리스트보다 먼저 만든다(만들 때 소개칸을 그리며 부른다) */
const plLikeUi = TwPlaylistLikeUi.createPlaylistLikeUi({ likeRules: TwPlaylistLike, net: ()=>TwServerFeatures.noServer('playlistLike'),
  getMyUserId: (...a)=>getMyUserId(...a), notifyError: (...a)=>TwErrorCodes.notify(...a),
  enabled: ()=>TwServerFeatures.on('playlistLike') });   // 서버 길이 생길 때까지 꺼짐(TODO: net 을 서버 provider 로)
/* 🎄 크리스마스 창(일회성 · 다음 업데이트에서 걷는다) — 런처 [🎄 크리스마스] · 📩 편지 알림(NAV.XMAS)이 연다 · 창 크기는 applyDesktopRunClass · 그림 사본은 GLB 영구 캐시(IndexedDB · 45일)에 · 추천곡은 공용 배경음악 창(주인 'xmas')
   서버는 xmas-api.js(/v2/xmas · /v2/me/xmas · 그림은 Storage). 서버 기능 표(shared/server-features.js)가 꺼져 있으면 만들지 않는다(런처 버튼은 html 에서 hidden 으로 시작해 그대로 숨는다 · NAV.XMAS 는 걸리지 않아 아무 일도 안 한다). */
const xmasApiMod = TwXmasApi.createXmasApi({ authed: TwApi.authed, rules: TwXmasRules, myCode: ()=>getMyUserId(), storageBucket: ()=>firebaseAPI.storageBucket(),
  fetch: (...a)=>window.fetch(...a), warn: (...a)=>console.warn(...a) });   // 🌐 크리스마스 서버 endpoint
const xmasWinMod = !TwServerFeatures.on('xmas') ? null : TwXmasWindow.createXmasWindow({ THREE, ps1Dither: TwPs1Dither, rules: TwXmasRules, treeMod: TwXmasTree, net: ()=>xmasApiMod, serverNow: ()=>TwRtHub.store.serverNow(),
  onReady: (fn)=>TwNetReady.whenNetReady(fn), notifyError: (...a)=>TwErrorCodes.notify(...a), toast: (...a)=>toast(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a), onSizeChange: ()=>applyDesktopRunClass(),
  idbGet: (k)=>glbIdbMod._glbIdbGet(k), idbPut: (k, v)=>glbIdbMod._glbIdbPut(k, v), songMod: TwXmasSong, letterMod: TwXmasLetter, companion: ()=>window.companion,
  ytVideoId: (u)=>plMod.ytVideoId(u), asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a), storage: localStorage,
  twNav: twNav,
  random: ()=>Math.random(),
  bgmMod: TwXmasBgm, winBgmMod: TwWinBgm, creditMod: TwXmasCredit, Audio: (typeof Audio === 'undefined') ? null : Audio,
  save: (k, v)=>_lsSet(k, v), officeMode: ()=>officeModeMod.officeMode(), warn: (...a)=>console.warn(...a),
  bgmHush: TwBgmHush.createBgmHush({ companion: ()=>window.companion,
    plPlaying: ()=>plMod.st.playing, setPlPlaying: (v)=>{ plMod.st.playing = v; }, plRender: ()=>plMod.render(),
    homePlaying: ()=>!!TwMyHomeHooks.call(TwMyHomeHooks.HOOK.BGM_PLAYING), setHomePlaying: (v)=>{ TwMyHomeHooks.call(TwMyHomeHooks.HOOK.BGM_SET_PLAYING, v); } }),
});
const plMod = TwPlaylist.createPlaylist({
  playlistAccountStore: accountStoreMod,
  playlistApi: playlistApiMod,
  fetchPlaylistCard: (...a)=>apiPublicReadsMod.fetchPlaylistCard(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  // 👤 명함 — 레벨 · 🌟 회차 배지
  shownFocusLevel: (...a)=>focusLevelMod.shownFocusLevel(...a),
  myFocusShow: (...a)=>focusLevelMod.myFocusShow(...a),
  starFromRemote: (...a)=>focusLevelMod.starFromRemote(...a),
  lvBadgeClass: (...a)=>lvTierMod.lvBadgeClass(...a),
  lvStarBadgeClass: (...a)=>lvTierMod.lvStarBadgeClass(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  starPaint: (...a)=>lvTierMod._starPaint(...a),
  // 🏠 마이홈
  myhomeAvatar: ()=>myhomeStoreMod.avatar(),
  myHomeFriends: ()=>_myHomeFriends,
  friendsRefreshPresence: (...a)=>friendsSubMod.refreshPresence(...a),
  openFriendHomeView: (...a)=>mhVisitMod.openFriendHomeView(...a),
  // 🪟 상태칩 팝업 · 창 겹침 · ESC
  closeChipPopups: (...a)=>chipPopupsMod._closeChipPopups(...a),
  repositionOpenChipPopups: (...a)=>statusChipMod._repositionOpenChipPopups(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  escEditable: (...a)=>winStackMod._escEditable(...a),
  playlistLikeUi: plLikeUi,
});
TwBgmDiag.createBgmDiag({ companion: window.companion });   // 🔍 플레이리스트 소리 진단 줄
/* ═══ 🏅 레벨 티어 — 경계값이 사는 **유일한 곳** ═══════════════════════════════
   예전엔 같은 삼항 사슬(n<=20?'t1':…)이 세 군데(프로필 목록·친구창 배지·경험치 바)에 각각
   복사돼 있었고, 주석에 "고칠 일이 생기면 둘 다 고칠 것"이라고 적어 두는 것이 방어의 전부였다.
   상한을 130 → 999 로 늘리면서 칸이 t7 에서 t12 로 늘어나므로 그 방식으로는 반드시 어긋난다.
   → 표 하나 + 함수 두 개로 모은다. 색은 CSS 의 「🏅 레벨 티어 토큰」 블록이 유일한 출처이고,
     여기는 '몇 번 칸인가'만 정한다.

   ★ 표식 클래스(lvx·lvglow)를 여기서 **티어와 함께** 붙이는 것이 핵심이다.
     CSS 에 `.t7,.t8,.t9,…` 를 나열하는 자리를 만들면 티어를 늘릴 때마다 빠뜨린다 —
     검사 12·14·15 가 전부 그 나열에서 빠뜨려 생긴 실패다.
       lvx    광택이 흐른다 (t7 이상)
       lvglow 바가 홈 바깥으로 빛을 흘린다 (t8 이상)
       shine  흰 빛줄기가 훑는다 (Lv.81 이상 — 티어가 아니라 레벨 기준. 예전 그대로)
   ★ 상한(FOCUS_LEVEL_CAP_HOURS=999)을 넘는 값은 없지만, 표 마지막 칸을 Infinity 로 열어 둬서
     그런 값이 들어와도 조용히 t12 로 떨어진다(클래스가 아예 안 붙으면 배경이 사라진다). */
/* 본문은 lv-tier.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const lvTierMod = TwLvTier.createLvTier({
});
/* 본문은 launcher/move-mode.js 로 옮겼다(앱 FSD · app.js 분리 M19). 이동 모드 깃발 · 캐릭터 화면 좌표 값의 주인이다 — 듣기가 예전과 같은 때 걸린다. 다시 대입되는 값은 읽는 · 쓰는 함수로 다룬다. */
const moveModeMod = TwMoveMode.createMoveMode({
  charPlaceMod: charPlaceMod,
  clampDeskPan: clampDeskPan,
  layoutSeats: (...a)=>layoutSeats(...a),
  saveCharPos: saveCharPos,
  statusChipMod: statusChipMod,
  toast: (...a)=>toast(...a),
});
const _charProjSane = moveModeMod._charProjSane;   // 옛 전역 이름
const runCost = TwRunCostDiag.page;   // 🩺 1분 [비용] 줄 — 그리기 밖 시간(shared/run-cost-diag.js)
/* 본문(창 보임 구독 · 100ms 타이머)은 launcher/heartbeat.js 로 옮겼다 — 만들 때 한 번 돈다. */
const heartbeatMod = TwHeartbeat.createHeartbeat({
  _charBadWhy: ()=>moveModeMod._charBadWhy(),
  _charBoundsLatest: ()=>moveModeMod._charBoundsLatest(),
  _twMoveSeenAt: ()=>moveModeMod._twMoveSeenAt(),
  otherSeatCircles: (...a)=>statusChipMod.otherSeatCircles(...a),
  runCost: runCost,
});
/* ═══ ⚙ 설정 패널 — 포커싱 어플 · 화면 표시 · 캐릭터 크기 · 탭 · 광고 배너 ═══ */
/* ⚙ 설정 패널 — 포커싱 어플 슬롯 / 캐릭터 크기 / 프로그램 이동 */
/* 본문은 settings-panel.js 로 옮겼다(앱 FSD 27번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const stickerLayerMod = TwDeviceToggle.createDeviceToggle({ storage: localStorage, key: 'tw.mhStickerLayer' });   // 🎨 마이홈 스티커 보이기(이 PC 설정) — 설정 창 · 스티커 그리기 · 관리 창이 같이 읽는다
const awayOthersMod = TwDeviceToggle.createDeviceToggle({ storage: localStorage, key: 'tw.awayPicOthers' });   // 🫧 남의 자리비움 그림 보기(이 PC 설정) — 설정 창 · 자리비움 그림이 같이 읽는다
const settingsMod = TwSettingsPanel.createSettingsPanel({
  settingsAccountStore: accountStoreMod,
  GAP_MAX: GAP_MAX,
  GAP_MIN: GAP_MIN,
  GAP_STEPS: GAP_STEPS,
  MULTIPLAYER_SPACING: ()=>seatsMod.MULTIPLAYER_SPACING(),
  Presence: ()=>Presence,
  SPACING: ()=>seatsMod.SPACING(),
  _chatEsc: (...a)=>_chatEsc(...a),
  _moveModeJustToggled: ()=>moveModeMod._moveModeJustToggled(),
  adBannerSlides: ()=>noticeFeed.banner(),
  allDeskItems: (...a)=>deskItemsMod.allDeskItems(...a),
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  decoPartsVisible: ()=>decoPartsMod.decoPartsVisible(),
  dotRenderEnabled: ()=>dotRenderEnabled,
  drawFaceThumb: (...a)=>addFriendMod.drawFaceThumb(...a),
  emojiReactionsEnabled: ()=>floatersMod.emojiReactionsEnabled(),
  equipDeskItem: (...a)=>equipDeskItem(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  findMySeat: (...a)=>findMySeat(...a),
  focusCharScale: ()=>charPlaceMod.focusCharScale(),
  isPremium: ()=>isPremium,
  layoutSeats: (...a)=>layoutSeats(...a),
  moveMode: ()=>moveModeMod.moveMode(),
  nameplateEnabled: ()=>overheadMod.nameplateEnabled(),
  plMod: plMod,
  refreshCharScaleForCurrentDisplay: (...a)=>refreshCharScaleForCurrentDisplay(...a),
  refreshInviteUI: (...a)=>roomEntryMod.refreshInviteUI(...a),
  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),
  roomSeatMode: ()=>roomSeatMode,
  saveCharScale: (...a)=>saveCharScale(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  saveGap: (...a)=>saveGap(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  scene: scene,
  seatEqualizeOn: ()=>seatEqMod.seatEqualizeOn(),
  seats: seats,
  slots: ()=>slots,
  toast: (...a)=>toast(...a),
  updateCameraOnly: (...a)=>seatCameraMod.updateCameraOnly(...a),
  wardrobeMod: ()=>wardrobeMod,
  setMULTIPLAYER_SPACING: (v)=>{ seatsMod.setMULTIPLAYER_SPACING(v); },
  setSPACING: (v)=>{ seatsMod.setSPACING(v); },
  setMoveModeJustToggled: (v)=>{ moveModeMod.setMoveModeJustToggled(v); },
  setCurSlot: (v)=>{ curSlot = v; },
  setDecoPartsVisible: (v)=>{ decoPartsMod.setDecoPartsVisible(v); },
  setDotRenderEnabled: (v)=>{ dotRenderEnabled = v; },
  setEmojiReactionsEnabled: (v)=>{ floatersMod.setEmojiReactionsEnabled(v); },
  setFocusCharScale: (v)=>{ charPlaceMod.setFocusCharScale(v); },
  setMoveMode: (v)=>{ moveModeMod.setMoveMode(v); },
  setNameplateEnabled: (v)=>{ overheadMod.setNameplateEnabled(v); },
  setRoomSeatMode: (v)=>{ roomSeatMode = v; },
  setSeatEqualizeOn: (v)=>{ seatEqMod.setSeatEqualizeOn(v); },
  isLauncherShown: (...a)=>isLauncherShown(...a),
  statusBubbleEnabled: ()=>overheadMod.statusBubbleEnabled(),
  setStatusBubbleEnabled: (v)=>{ overheadMod.setStatusBubbleEnabled(v); },
  stickerLayer: stickerLayerMod,
  awayOthers: awayOthersMod,
});

/* ═══ 🕒 포커스 기록 팝업 ═══ */
/* 🕒 포커스 기록 팝업(현재 / 누적 · 오늘 기록 · 미니미 · 타이틀바 끌기 · ⎋ 닫기)은 parts/focus-log.js 로 옮겼다(앱 FSD 13번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(버튼 · ESC 등록 · window._focusLogClamp · 매초 갱신 · 타이틀바 끌기)이
     예전과 같은 때 돈다. 밖에서 부르는 이름은 없다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _focusSessionSec 는 다시 대입되고 이 줄보다 한참 뒤(포커스 시간 누적 구역)에
   선언되는 let 이라 읽는 함수로 넘긴다(값으로 넘기면 TDZ). 누적(focusProgressMod)도 더 뒤에 만들어져 같은 까닭으로 읽는 함수.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const focusLog = TwFocusLog.createFocusLog({
  formatHMS: (...a)=>focusLevelMod.formatHMS(...a),
  rolloverFocusToday: (...a)=>focusTotalMod._rolloverFocusToday(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  focusTotalSec: ()=>focusProgressMod.shownTotalSec(),   // 서버 누적 + 못 올린 몫(받기 전 null)
  retryProgress: (...a)=>focusProgressMod.reload(true),   // 못 받았으면 열 때 다시 받는다(번호 알림 E-FOCUS-01)
  progressLoad: ()=>focusProgressMod.progress().load,
  focusSessionSec: ()=>focusTotalMod._focusSessionSec(),
  figureMode: ()=>officeModeMod.figureMode(),
});

/* ═══ ⌨️ 함수키 단축키(F1 ~ F4) ═══ */
/* 본문은 fn-keys.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const fnKeysMod = TwFnKeys.createFnKeys({
  chatUiMod: ()=>chatUiMod,
  iDeskMod: iDeskMod,
  rideBenchMod: rideBenchMod,
});

/* ═══ 🎨 꾸미기 사이드 패널 열고 닫기 ═══ */
/* 본문은 wardrobe-panel.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const wdPanelMod = TwWardrobePanel.createWardrobePanel({
  wardrobeMod: ()=>wardrobeMod,
  twNav: twNav,
});

/* ═══ 👀 꾸미기 미리보기 — 렌더러 · 기즈모 · 창 자리 · 카메라 ═══ */
/* 본문은 wardrobe.js 로 옮겼다(앱 FSD 29번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const wardrobeMod = TwWardrobe.createWardrobe({
  accountStore: accountStoreMod,
  NO_DESK_ID: NO_DESK_ID,
  layoutSeats: (...a)=>layoutSeats(...a),
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  CHAR_Z: CHAR_Z,
  PART_CATS: ()=>premiumMod.PART_CATS(),
  PART_DEFAULT_OFFSET: ()=>PART_DEFAULT_OFFSET,
  PART_GROUPS: ()=>premiumMod.PART_GROUPS,
  Presence: ()=>Presence,
  WD_DESK_TAB: ()=>premiumMod.WD_DESK_TAB,
  _attachHumanEars: (...a)=>_attachHumanEars(...a),
  _disposeWrapperFromSeat: (...a)=>_disposeWrapperFromSeat(...a),
  _hsvToHex: (...a)=>_hsvToHex(...a),
  _invalidatePendingEquip: (...a)=>_invalidatePendingEquip(...a),
  _rgbHexToHsv: (...a)=>_rgbHexToHsv(...a),
  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),
  _wdLicenseDesks: (...a)=>premiumMod._wdLicenseDesks(...a),
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  addEntryToCat: (...a)=>premiumMod.addEntryToCat(...a),
  addPartEntryInstance: (...a)=>premiumMod.addPartEntryInstance(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  applyHueTint: (...a)=>applyHueTint(...a),
  applyPartXf: (...a)=>applyPartXf(...a),
  baseFlatOf: (...a)=>lightToneMod.baseFlatOf(...a),
  bindReorderHandle: (...a)=>assetCardsMod.bindReorderHandle(...a),
  boneSide: (...a)=>boneSide(...a),
  charFootFix: (...a)=>charMeasureMod.charFootFix(...a),
  clampCharY: (...a)=>clampCharY(...a),
  defToBase: (...a)=>defToBase(...a),
  defaultPartXf: (...a)=>premiumMod.defaultPartXf(...a),
  entriesForCat: (...a)=>premiumMod.entriesForCat(...a),
  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),
  escHtml: (...a)=>escHtml(...a),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  findMySeat: (...a)=>findMySeat(...a),
  firstEntryForCat: (...a)=>premiumMod.firstEntryForCat(...a),
  floorClampWrapper: (...a)=>charMeasureMod.floorClampWrapper(...a),
  gachaMod: ()=>gachaMod,
  getCommissionScene: (...a)=>getCommissionScene(...a),
  groupOfCat: (...a)=>premiumMod.groupOfCat(...a),
  hueShiftHex: (...a)=>lightToneMod.toneCore.hueShiftHex(...a),
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  twNav: twNav,
  isDeskPartCat: (...a)=>premiumMod.isDeskPartCat(...a),
  isHueTintMesh: (...a)=>isHueTintMesh(...a),
  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),
  measurePreviewBox: (...a)=>charMeasureMod.measurePreviewBox(...a),
  openAssetImport: (...a)=>twNav.go(twNav.NAV.ASSET_IMPORT, ...a),
  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),
  partEntryId: (...a)=>premiumMod.partEntryId(...a),
  partEntryInstanceCount: (...a)=>premiumMod.partEntryInstanceCount(...a),
  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  partPaintMod: ()=>partPaintMod,
  partsInCat: (...a)=>premiumMod.partsInCat(...a),
  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),
  partsInGroup: (...a)=>premiumMod.partsInGroup(...a),
  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),
  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  removePartEntryInstance: (...a)=>premiumMod.removePartEntryInstance(...a),
  reorderSavedPart: (...a)=>premiumMod.reorderSavedPart(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  savedParts: ()=>premiumMod.savedParts(),
  seats: seats,
  setPartEntryInstanceXf: (...a)=>premiumMod.setPartEntryInstanceXf(...a),
  slots: ()=>slots,
  tintPartMesh: (...a)=>lightToneMod.toneCore.tintPartMesh(...a),
  toast: (...a)=>toast(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,
  DESK_SCALE_DEFAULT: ()=>DESK_SCALE_DEFAULT,
  DESK_SCALE_MAX: ()=>DESK_SCALE_MAX,
  DESK_SCALE_MIN: ()=>DESK_SCALE_MIN,
  _humanEarMat: (...a)=>_humanEarMat(...a),
  _humanEarPic: (...a)=>_humanEarPic(...a),
  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  applyDeskDotThumb: (...a)=>assetCardsMod.applyDeskDotThumb(...a),
  clampDeskScale: (...a)=>clampDeskScale(...a),
  humanEar: humanEar,
  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),
  glbFailWhy: (...a)=>catalogGlbMod.glbFailWhy(...a),
  setDeskScale: (...a)=>deskPlaceMod.setDeskScale(...a),
  setDeskMatColor: (...a)=>lightToneMod._setDeskMatColor(...a),
  swThumb: (...a)=>assetCardsMod.swThumb(...a),
});
/* ══ 🖍️ 파츠에 직접 그리기 ══════════════════════════════════════════════════
   꾸미기창 안에서만 끝난다 — 별도 창도, 별도 단계도 없다. 미리보기가 그대로 그림판이 된다.

   조작은 **생성기(캐릭터 만들기)와 같다.** 좌드래그 그리기 · 우드래그 회전 · 휠 확대,
   그리고 Ctrl+Z / Ctrl+Shift+Z / Delete / X(대칭) / C(지우개) / 우클릭 스포이드.
   같은 일을 두 화면에서 다르게 외우게 하지 않는 것이 이 화면의 유일한 규칙이다.

   ⚠️ 단축키는 **네 개 다 이미 임자가 있다.** 그래서 window 의 캡처 단계에서 잡고 거기서 멈춘다:
     · Ctrl+Z  — 생성기(창이 같이 떠 있을 수 있다)와 스티커사진 꾸미기가 같은 조합을 쓴다.
                 흘려보내면 양쪽이 함께 되돌아간다(_pkdKey 주석의 그 사고).
     · Delete  — 재생목록 창이 document 캡처에서 먼저 먹고 전파를 끊는다.
     · X · C   — 생성기의 대칭·지우개 토글과 같은 키다.
     window 캡처는 document 캡처보다 먼저다 — 그래서 여기가 가장 이른 자리다.
   ⚠️ 입력칸에 포커스가 있으면 전부 손대지 않는다. 채팅창이 같이 떠 있는 게 이 앱의 기본이라,
     채팅을 치다가 x 를 눌렀는데 대칭이 켜지면 안 된다.
   ⚠️ 저장(업로드)은 '완료' 한 번뿐이다. 획마다 저장하면 equippedParts JSON 이 매번 달라져서
     상대 화면이 파츠를 통째로 재장착한다 — 남의 화면에서 내 파츠가 계속 깜빡인다. */
/* 본문은 part-paint.js 로 옮겼다(앱 FSD 21번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const partPaintMod = TwPartPaint.createPartPaint({
  CANVAS_SZ: ()=>CANVAS_SZ,
  _applyPartMatTone: (...a)=>lightToneMod._applyPartMatTone(...a),
  _loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _roomFaceCacheLoad: (...a)=>roomSyncMod._roomFaceCacheLoad(...a),
  _roomFaceCacheSave: (...a)=>roomSyncMod._roomFaceCacheSave(...a),
  activeWdAdj: ()=>wardrobeMod.activeWdAdj(),
  buildFreeColorPicker: (...a)=>wardrobeMod.buildFreeColorPicker(...a),
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  currentWdTab: ()=>wardrobeMod.currentWdTab(),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  humanEar: humanEar,
  mirrorUVOn: (...a)=>paintGeomMod.mirrorUVOn(...a),
  newCanvas: (...a)=>newCanvas(...a),
  partEntryId: (...a)=>premiumMod.partEntryId(...a),
  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  refreshWdPreviewColorSection: (...a)=>wardrobeMod.refreshWdPreviewColorSection(...a),
  savedParts: ()=>premiumMod.savedParts(),
  sizeWdPreview: (...a)=>wardrobeMod.sizeWdPreview(...a),
  strokeSeg: (...a)=>paintGeomMod.strokeSeg(...a),
  toast: (...a)=>toast(...a),
  updateWdCam: (...a)=>wardrobeMod.updateWdCam(...a),
  updateWdGizmoForActivePanel: (...a)=>wardrobeMod.updateWdGizmoForActivePanel(...a),
  wdCam: ()=>wardrobeMod.wdCam(),
  wdEar: ()=>wardrobeMod.wdEar,
  wdGizmo: ()=>wardrobeMod.wdGizmo(),
  wdPreviewBase: ()=>wardrobeMod.wdPreviewBase(),
});
// ★ 이제 toggleEquip/상세조정 모두 mySeat이 아니라 draft+미리보기 좌석을 "직접" 건드리는 구조로
//   바뀌어서(요청사항: 저장 버튼 눌러야 실제 캐릭터에 반영), 예전처럼 "실제 캐릭터에 적용 후 미리보기로
//   따로 미러링"하는 절차 자체가 필요 없어짐.
function findMySeat(){ return seats.find(s=>s.isMe) || seats.find(s=>!s.remote) || null; }

/* ============================================================ 🏠 마이홈 (1단계: 친구 탭) */
/* 👥 친구 상한. **다섯 곳이 전부 이 값 하나를 본다** — 추가·수락(둘)·코드추가·우클릭추가 +
   마이홈 친구창 헤더의 (n/상한) 표기. 한 곳만 빠뜨리면 "추가는 되는데 요청 수락은 막힌다" 가 된다.

   [상시 비용] 상시 구독은 친구 목록(users/{나}/friends) 1개 — 이름 · 사진은 목록을 열 때 한 번(서버 먼저),
     접속 상태는 목록이 열려 있는 동안만 친구 수만큼(friends/friends-port.js · myhome/friends-sub.js).
     상한을 올리면 «열려 있는 동안 구독 수» 와 목록 렌더가 친구 수에 비례해 는다.
   ⚠️ 이 상한은 **클라이언트 판정**이다. 서버 규칙에는 상한이 없다. */
const FRIEND_MAX = 100;
let _myHomeFriends = {};   // 최근 구독 결과 캐시(렌더용)
let _myFriendRequests = {};   // 👋 나에게 온 친구 요청 { [fromId]: {name, ts} }

/* 👑 디자인 스튜디오 이미지 업로드 — 실제 표시 영역에 맞춘 리사이즈 상한.
   큰 원본을 그대로 올리면 Storage/전송 용량이 폭증하므로 업로드 전에 캔버스로 축소한다.
   · 배경(bg): 마이홈 창 760px − 좌우 여백 26px×2 = 약 708×440px의 가로형 영역.
     고해상도 화면을 고려해 1.5배(1060×660)를 상한으로 둠. 비율은 유지하며 축소만 함.
   · 패널: 프로필 박스·아바타 등 88~160px, 넓어야 약 350px 폭. 1.5배인 525px이면 충분. */
const DS_IMG_MAX_BG_W  = 1060;   // 배경 가로 상한 (708px 표시 영역 × 1.5)
const DS_IMG_MAX_BG_H  = 660;    // 배경 세로 상한 (440px 표시 영역 × 1.5)
const DS_IMG_MAX_PANEL = 525;    // 패널류 긴 변 상한 (350px × 1.5)
const DS_IMG_QUALITY   = 0.82;   // JPEG 품질 — 이 정도면 눈에 띄는 열화 없이 용량이 크게 줄어듦

/* 📅 스케줄러(일정 · D-day 달력) · 🔔 일정 알림 — parts/scheduler.js 로 옮겼다(앱 FSD 1번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(버튼 연결 · 🔔 알림 구독 · 자정 넘김 타이머)이 예전과 같은 때 돈다.
   ⚠️ _mhViewingUserId 는 이 줄보다 뒤(마이홈 방문)에 let 으로 선언된다 — 값이 아니라 읽는 함수로 넘긴다.
   함수 deps 도 화살표로 감싼다(부를 때 찾게). ⚠️ 이름을 Scheduler · scheduler 로 짓지 말 것 — 크로미움(Electron) 내장 전역(작업 예약 API)과
     겹쳐 typeof 가드가 늘 통과하고, 모듈이 안 실렸을 때 내장 생성자에 createScheduler 를 부르다 app.js 가 선다. */
const BELL_SEEN_KEY = 'tw.bellSeenTs';   // 🔔 마지막으로 알림창을 연 시각 — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)도 쓴다
/* 🖼 내 그림(마이홈 · 디데이 · 박수 · 말랑이)을 Storage 내 폴더에 바로 올리기(shared/own-image.js) — 경로의 코드는 로그인 뒤 서버가 준 내 코드 */
const ownImageMod = TwOwnImage.createOwnImage({ myCode: ()=>getMyUserId(), newId: ()=>crypto.randomUUID(), put: (...a)=>firebaseAPI.putOwnFile(...a),
  later: TwOwnImage.later, owner: ()=>firebaseAPI.authCurrentUid() });
const scheduleApiMod = TwScheduleApi.createScheduleApi({   // 🌐 일정 · 디데이 · 일정 알림 서버 endpoint(/v2/me/schedules · /v2/me/ddays · /v2/me/notifications) — 원본은 서버
  authed: TwApi.authed,
  newId: ()=>TwRequestId.newId(),
  imageBytes: TwImageBytes,
  ownImage: ownImageMod,
  warn: (...a)=>console.warn(...a),
});
/* 🙋 마지막으로 받은 방 초대 한 줄(room/invite-notice.js) — 받기는 room-invite-ui.js · 보이기는 🔔 일정 알림(scheduler.js) */
const inviteNotice = TwInviteNotice.createInviteNotice({ storage: localStorage, getMyUserId: ()=>getMyUserId(), now: ()=>Date.now() });
const mhScheduler = MhScheduler.createScheduler({
  scheduleAccountStore: accountStoreMod,
  scheduleApi: scheduleApiMod,
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
  getMyUserId: ()=>getMyUserId(),
  viewingUserId: ()=>mhStateMod._mhViewingUserId(),
  myHomeFriends: ()=>_myHomeFriends,
  toast: (...a)=>toast(...a),
  uiIconEl: (...a)=>statusChipMod.uiIconEl(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  closeChipPopups: (...a)=>chipPopupsMod._closeChipPopups(...a),
  positionInputBelowChar: (...a)=>statusChipMod._positionInputBelowChar(...a),
  inboxUnreadCount: ()=>inboxMod.inboxUnreadCount(),
  refreshFriendTabBadge: ()=>inboxMod.refreshFriendTabBadge(),
  bellSeenKey: BELL_SEEN_KEY,
  twNav: twNav,
  roomInvite: inviteNotice,
});

/* 🐞 버그 제보 탭(오픈카톡 기본 링크 폼 포함)은 parts/support/bug-board-ui.js 다 — 게시판은 🚩 신고 다음에서 만든다.
   👥 친구 관리(받은 요청 · 📤 보낸 요청 · 선물함 서브탭) · 👋 새 친구 요청 팝업 · 친구 탭 배지는 parts/friend-manage.js 로 옮겼다
     (앱 FSD 5번 · docs/APP_FSD_MAP.md). ★ 원래 자리인 여기서 만든다(만들 때 바로 도는 일은 없다 — 상태 초기값뿐).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myFriendRequests · _myHomeFriends · myHomeOpen 은 다시 대입되는 값이라
     읽는 함수로 넘긴다(myHomeOpen 의 주인은 launcher-state.js). 부르는 곳은 friendManage.이름.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const friendManage = TwFriendManage.createFriendManage({
  getMyUserId: ()=>getMyUserId(),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  giftStat: (...a)=>inboxMod.giftStat(...a),
  renderGiftBox: (...a)=>inboxMod.renderGiftBox(...a),
  inboxTimeStr: (...a)=>inboxMod.inboxTimeStr(...a),
  myHomeOpen: ()=>launcherStateMod.myHomeOpen(),
  myHomeFriends: ()=>_myHomeFriends,
  myFriendRequests: ()=>_myFriendRequests,
  friendMax: FRIEND_MAX,
  friendsForCheck: (...a)=>friendsSubMod.friendsForCheck(...a),
  requests: ()=>friendRequestsPortMod,
});
let _myHomeReady = false;
/* 포기하지 않는다 — SDK 를 실행 때 gstatic 에서 받아 느린 망이면 20초를 넘긴다(예전 20초 포기 → 친구 · 우편 구독이 영영 안 걸렸다). */
function _waitForFirebaseAPI(cb){
  TwNetReady.whenNetReady(()=>cb());   // 준비 키(need)를 주지 않는다 — 키 이름을 걷은 메서드로 두면 «준비됨» 이 영영 안 온다
}
/* 🔇 소유권이 걸린 쓰기가 거부됐을 때 침묵을 깬다.
   [경위] 규칙을 게시한 뒤 users/{코드} 의 자기 소유 가지는 "주인이 없거나 나일 때"만 쓸 수 있다.
     구글에 묶인 계정인데 이 기기에 로그인 세션이 없으면(혹은 아직 복원 전이면) 그 쓰기가
     permission_denied 로 떨어진다. 거부는 화면에 아무 표시도 안 남긴다 — 유저에게는
     "이름이 안 바뀐다 / 친구가 사라졌다"로만 보인다.
   ⚠️ 막지 않는다. 알려주기만 한다 — 고치는 방법은 재시작 한 번이다(부팅 게이트 K 가 로그인을 받는다 · 개정 16: 설정 › 계정 로그인은 걷었다). */
/* ═══ 🖥️ 계정마다 PC 는 서버가 정한 상한까지 — 이 PC 등록 · 연결이 끊긴 PC 의 처리 ═══════════════
   자리(기기 등록)는 서버 API 가 정한다 — 켤 때 realtime 보다 먼저 등록(device-register.js · 상한이 다 찼으면 확인창 device-limit-dialog.js) · 끊기면 안내(device-lost.js).
   ★ 로그아웃하지 않는다 — 캐릭터·기록·신원 그대로. «다시 등록 · 여기서 계속» = 등록 → 같은 realtime 연결로 다시 붙기. «앱 닫기» = quitApp. */
const deviceLimitDialog = TwDeviceLimitDialog.createDeviceLimitDialog({ document: document });
const deviceRegisterMod = TwDeviceRegister.createDeviceRegister({
  registerDevice: (o)=>TwUserApi.store.registerDevice(o),
  limitOldestOf: (e)=>TwUserApi.limitOldestOf(e),
  deviceId: ()=>TwDeviceId.store.get(),   // API 머리 X-Device-Id · hello.deviceId 와 같은 값
  session: ()=>TwRtHub.store.session(),   // hello.session 과 같은 값 — 등록이 연결보다 먼저 뽑는다
  os: ()=>TwDeviceRegister.osOf(navigator),
  ask: (question)=>deviceLimitDialog.ask(question),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
/* 본문은 device-lost.js 로 옮겼다(앱 FSD 46번).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deviceLostMod = TwDeviceLost.createDeviceLost({
  twNav: twNav,
  continueHere: ()=>deviceRegisterMod.ensure().then((r)=>{ if(r !== 'ok') return false; TwRtHub.store.start({ claim: true }); return true; }),   // 등록 → realtime 연결 하나로 다시(login-flow 를 부르지 않는다 — 그쪽이 이 화면을 부른다)
});

/* ═══ 🏠 마이홈 열기(initMyHome) · 소유자 쓰기 거부 안내 ═══ */
/* 본문은 myhome-init.js 로 옮겼다(앱 FSD 44번 남은 몫). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* 👥 친구 데이터는 포트(friends/friends-port.js) 하나로 — 그 뒤 서버 provider(friends-api.js)가 있다. friends-sub · 화면은 서버 경로를 모른다. */
const socialApiMod = TwSocialApi.createSocialApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) });   // 🌐 친구 · 친구 요청 · 명함 서버 경로(social-api.js)
const apiPublicReadsMod = TwApiPublicReads.createApiPublicReads({ fetchCards: (codes)=>socialApiMod.fetchCards(codes) });   // 🌐 플레이리스트 명함 읽기(api-public-reads.js — 같은 틱에 모인 코드는 요청 하나)
const friendsApiMod = TwFriendsApi.createFriendsApi({
  social: socialApiMod,
  rt: TwRtHub.store,   // 알림 friends · card 를 받으면 다시 받는다
  warn: (...a)=>console.warn(...a),
});
/* 👋 친구 요청 — 포트 하나(friends/friend-requests-port.js) 뒤에 서버 provider */
const friendRequestsApiMod = TwFriendRequestsApi.createFriendRequestsApi({ social: socialApiMod, rt: TwRtHub.store, warn: (...a)=>console.warn(...a) });
const friendRequestsPortMod = TwFriendRequestsPort.createFriendRequestsPort({ api: friendRequestsApiMod });
const friendsPresenceRtMod = TwFriendsPresenceRt.createFriendsPresenceRt({ rt: TwRtHub.store });   // 친구 접속 상태 — realtime 연결 하나(presenceGet · watch)
const friendsPortMod = TwFriendsPort.createFriendsPort({
  presence: friendsPresenceRtMod,
  api: friendsApiMod,
});
const friendsSubMod = TwFriendsSub.createFriendsSub({
  subscribe: (...a)=>friendsPortMod.watchList(...a),
  fetchOnce: (id)=>friendsPortMod.listFriends(id, { idsOnly:true }),
  listFriends: (...a)=>friendsPortMod.listFriends(...a),
  readFriend: (...a)=>friendsPortMod.readFriend(...a),
  watchPresence: (...a)=>friendsPortMod.watchPresence(...a),
  readPresence: (...a)=>friendsPortMod.readPresence(...a),
  retryPresence: ()=>friendsPortMod.retryPresence(),
  watchProfile: (...a)=>friendsPortMod.watchProfile(...a),
  readProfile: (...a)=>friendsPortMod.readProfile(...a),
  current: ()=>_myHomeFriends,
  setFriends: (v)=>{ _myHomeFriends = v; },
  getMyUserId: (...a)=>getMyUserId(...a),
  toast: (...a)=>toast(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  setTimer: (fn, ms)=>setTimeout(fn, ms),
  clearTimer: (id)=>clearTimeout(id),
  onUnload: (fn)=>window.addEventListener('beforeunload', fn),
});
const presenceSelfMod = TwPresenceSelf.createPresenceSelf({   // 내 접속 표시를 realtime 에 알림(status)
  rt: TwRtHub.store,
  onUnload: (fn)=>window.addEventListener('beforeunload', fn),   // friends-sub stop 과 같은 자리 — 계정을 놓으면 보이기 값을 비운다
});
/* 🔒 친구 탭 온라인 토글 · 고정 — 처음 접속 표시는 마이홈 처음 준비가 계정 확인의 me 로 부른다 */
const presenceLockMod = TwPresenceLock.createPresenceLock({
  getMyUserId: (...a)=>getMyUserId(...a),
  toast: (...a)=>toast(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  savePref: (uid, p)=>loginFlowMod.patchMe({ presencePref: { locked: p.lock, online: p.online } }).then((r)=>{ if(!r.ok) throw r.err; }),
  setVisible: (v)=>presenceSelfMod.setVisible(v),
  startVisible: (v)=>presenceSelfMod.start(v),
});
/* 📩 우편 · 📢 공지 — 원본은 서버. 서버 경로(inbox-api.js · notice-api.js)와 받아 들고 있는 한 벌(mail-feed.js · notice-feed.js).
   받은 뒤 화면 · 토스트는 마이홈 처음 준비 모듈(onMailChanged · onNewsChanged)이 맡는다 — 만드는 줄보다 뒤에 도는 arrow 라 TDZ 없음. */
const mailFeed = TwMailFeed.createMailFeed({
  api: TwInboxApi.createInboxApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) }),   // 🌐 /v2/me/notifications
  rt: TwRtHub.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  /* 🎄 짝 짓기 알림이 몰리는 10분(서버 날짜)은 0~30초 무작위로 미뤄 읽는다 — 그 밖은 곧바로 */
  refreshDelayMs: ()=>(TwServerFeatures.on('xmas') ? TwXmasRules.mailDelayMs(TwRtHub.store.serverNow(), xmasApiMod.scheduleNow(), Math.random()) : 0),   // 🎄 짝 짓기 10분엔 무작위로 흩기 — 날짜 한 벌은 xmas-api(창과 같은 것) · 창 모듈을 부르지 않는다(순환)
  timers: window,   // 기다림(setTimeout · clearTimeout) — 검사는 가짜를 넘긴다
});
mailFeed.onChange((e)=>mhInitMod.onMailChanged(e));
if(xmasWinMod) mailFeed.onChange(()=>xmasWinMod.onMail(mailFeed.items()));   // 🎄 «받은 편지» 알림이 처음 보이면(읽음 여부 무관) → 받은 편지 한 번 읽기
const noticeApi = TwNoticeApi.createNoticeApi({ get: (path)=>TwApi.authed.get(path), write: TwApi.authed, pending: TwRequestId.createPending(), warn: (...a)=>console.warn(...a) });   // 🌐 /v2/notices
/* 🛠️ 앱 관리자 창의 서버 endpoint(/v2/admin/...) — 관리자 모드 · 확성기 · 업데이트 공지 · 배너 · 방 종료가 쓴다. 지금 업데이트 공지의 id 는 공지 한 판에서 받는다 */
const adminApi = TwAdminApi.createAdminApi({ authed: TwApi.authed, pending: TwRequestId.createPending(), fetchBoard: ()=>noticeApi.fetchBoard(), errs: TwApiErrors });
/* 🛠️ 카탈로그 관리자 쓰기(파츠 · 책상 · 소품 · 진열 순서 · 카테고리 · 게임 설정) — 고칠 판(version)은 마지막으로 받은 서버 한 벌에서 읽고, 쓴 뒤 한 번 다시 받는다 */
const catalogAdmin = TwCatalogAdminApi.createCatalogAdminApi({
  authed: TwApi.authed, imageBytes: TwImageBytes,
  catalog: { current: ()=>catalogApiMod.current(), load: ()=>catalogApiMod.load() },
  adminApi: adminApi, apiErrors: TwApiErrors.store, notifyError: (...a)=>TwErrorCodes.notify(...a), toast: (...a)=>toast(...a),
});
const noticeFeed = TwNoticeFeed.createNoticeFeed({
  api: noticeApi,
  rt: TwRtHub.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
noticeFeed.onChange((e)=>mhInitMod.onNewsChanged(e));
const mhInitMod = TwMyHomeInit.createMyHomeInit({
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  _myFriendRequests: ()=>_myFriendRequests,
  _myHomeFriends: ()=>_myHomeFriends,
  _myHomeReady: ()=>_myHomeReady,
  _waitForFirebaseAPI: (...a)=>_waitForFirebaseAPI(...a),
  focusLevelMod: ()=>focusLevelMod,
  friendManage: friendManage,
  friendRequests: ()=>friendRequestsPortMod,
  friendsSub: friendsSubMod,
  getMyUserId: (...a)=>getMyUserId(...a),
  inboxMod: ()=>inboxMod,
  mailFeed: mailFeed,
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>launcherStateMod.myHomeOpen(),
  noticeFeed: noticeFeed,
  presenceLock: presenceLockMod,
  toast: (...a)=>toast(...a),
  setMyFriendRequests: (v)=>{ _myFriendRequests = v; },
  setMyHomeFriends: (v)=>{ _myHomeFriends = v; },
  setMyHomeReady: (v)=>{ _myHomeReady = v; },
});
/* ═══ 📩 수령함 상태 · 안 읽은 수 · 친구 탭 배지 ═══ */
/* 개인 우편 · 공용 소식은 서버가 원본이다 — 받아 들고 있는 곳은 mailFeed · noticeFeed(위, 마이홈 처음 준비 만드는 줄 앞).
   수령함이 서버에서 **한 번이라도 도착했는가**(mailFeed.ready())는 «비었다» 와 «아직 안 왔다» 를 가른다 — 수령함을 근거로 판단하는 곳(_danceUnlockPending 의 구제 분기)이 먼저 본다. */
const INBOX_BC_READ_KEY = 'tw.inboxBcRead';   // 공용 공지 읽음 id 집합(로컬)
/* ═══ 🛡️ 공용 HTML 이스케이프(escHtml) ═══ */
/* 🛡️ 공용 HTML 이스케이프 — 본문은 `shared/safe-html.js` 의 `TwSafeHtml.text`(다섯 글자 전부). 이 이름은 옛 호출부가 쓰는 별칭.
   ⚠️ 마크업 문자열을 만들 때만 쓴다 — `el.title` · `el.textContent` 같은 프로퍼티에 쓰면 `&quot;` 가 글자로 보인다.
   ⚠️ 다른 escape 를 새로 만들지 않는다(sim-safe-html.js 가 빨강). */
function escHtml(s){ return TwSafeHtml.text(s); }

/* ═══ 💬 채팅창 투명도 · 글자 크기 ═══ */
/* 본문은 chat-prefs.js 로 옮겼다(앱 FSD 41번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const chatPrefsMod = TwChatPrefs.createChatPrefs({
  CHAT_SFX_DEFAULT_ID: sfxMod.CHAT_SFX_DEFAULT_ID,
  CHAT_SFX_DEFAULT_ON: sfxMod.CHAT_SFX_DEFAULT_ON,
  CHAT_SFX_GAP_MS: sfxMod.CHAT_SFX_GAP_MS,
  CHAT_SFX_ID_KEY: sfxMod.CHAT_SFX_ID_KEY,
  CHAT_SFX_LIST: sfxMod.CHAT_SFX_LIST,
  CHAT_SFX_ON_KEY: sfxMod.CHAT_SFX_ON_KEY,
  Presence: ()=>Presence,
  _chatEsc: (...a)=>_chatEsc(...a),
  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),
  _chatIsSecretRoom: (...a)=>chatLockMod._chatIsSecretRoom(...a),
  _chatLogCache: ()=>_chatLogCache,
  _chatOffOn: (...a)=>chatLockMod._chatOffOn(...a),
  _chatOffRefreshUI: (...a)=>chatLockMod._chatOffRefreshUI(...a),
  _chatRoomCode: (...a)=>chatLockMod._chatRoomCode(...a),
  _chatSfxPools: sfxMod._chatSfxPools,
  chatUiMod: ()=>chatUiMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  myCode: ()=>TwRoomRt.store.myCode(),
  officeMode: ()=>officeModeMod.officeMode(),
  seats: seats,
  toast: (...a)=>toast(...a),
});

/* ═══ 🛡️ 리치 텍스트 sanitize · 저장 · 글자 수 ═══ */
/* 본문은 rich-text.js 로 옮겼다(앱 FSD 42번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const richTextMod = TwRichText.createRichText({
  escHtml: (...a)=>escHtml(...a),
  DOMPurify: () => window.DOMPurify,
});

/* 🧸 말랑이 칸 상태 주인(myhome/mallang-store.js) — 원본은 서버(/v2/me/mallangs · /v2/mallangs/{code}). 말랑이 화면 · 로그아웃 올리기가 받는다. */
const giftApiMod = TwGiftApi.createGiftApi({ authed: TwApi.authed, imageBytes: TwImageBytes, ownImage: ownImageMod, warn: (...a)=>console.warn(...a) });   // 🌐 말랑이 · 선물 서버 경로
const mallangStoreMod = TwMallangStore.createMallangStore({
  api: giftApiMod, giftLib: TwGiftApi, errs: TwApiErrors, apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
});
window.addEventListener('beforeunload', ()=>{ mallangStoreMod.flush(); });   // 앱을 끌 때 못 올린 칸 고침 한 번(결과를 기다리지 않음)
/* 🎁 선물 상태 주인(myhome/gift-box.js) — 원본은 서버(/v2/me/gifts). 말랑이 화면 · 수령함(선물함 격자) · 마이홈 창이 받는다. 만들 때 도는 일 없음(받기는 마이홈을 열 때 · 서브탭 · 서버 신호는 app-boot gift). */
const giftBoxMod = TwGiftBox.createGiftBox({
  api: giftApiMod, giftLib: TwGiftApi, errs: TwApiErrors, apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
  requestIds: TwRequestId.createPending(),   // 보내기 요청 번호 — 받는 사람마다 하나(닿지 못했으면 같은 번호)
});
/* 📚 책장 상태 주인(myhome/bookshelf-store.js) — 원본은 서버(/v2/me/myhome/bookshelf · /v2/myhomes/{code}/bookshelf). 북마크 서랍 · 로그아웃 올리기가 받는다. 만들 때 도는 일 없음. */
const bookshelfApiMod = TwMyHomeApi.createMyHomeApi({ authed: TwApi.authed, imageBytes: TwImageBytes, ownImage: ownImageMod, warn: (...a)=>console.warn(...a) });   // 🌐 마이홈 서버 경로(책장 몫)
const bookshelfStoreMod = TwBookshelfStore.createBookshelfStore({
  api: bookshelfApiMod, lib: TwMyHomeApi, errs: TwApiErrors, apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
});
window.addEventListener('beforeunload', ()=>{ bookshelfStoreMod.flush(); });   // 앱을 끌 때 못 올린 책장 고침 한 번(결과를 기다리지 않음)
/* 🏠 마이홈 상태 주인(myhome/myhome-store.js) — 원본은 서버(/v2/me/myhome · /v2/myhomes/{code}). 마이홈 화면 · 채팅 · 내 정보 · 플레이리스트가 내 사진 · 페이지를 여기서 읽고, 로그아웃 올리기 · 앱 끄기가 flush 한다. 만들 때 도는 일 없음(받기는 마이홈을 열 때). */
const myhomeApiMod = TwMyHomeApi.createMyHomeApi({ authed: TwApi.authed, imageBytes: TwImageBytes, ownImage: ownImageMod, warn: (...a)=>console.warn(...a) });   // 🌐 마이홈 서버 경로(페이지 · 디자인 몫)
const myhomeStoreMod = TwMyHomeStore.createMyHomeStore({
  api: myhomeApiMod, lib: TwMyHomeApi, errs: TwApiErrors, apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
  previewOn: ()=>!!window._mhPreviewMode,   // 👁 방문자 시점 미리보기 중엔 고치지 않는다
  rules: TwMyHomeStickerRules,
});
window.addEventListener('beforeunload', ()=>{ myhomeStoreMod.flush(); });   // 앱을 끌 때 못 올린 고침 한 번(결과를 기다리지 않음)
const socialNamesApi = TwSocialApi.createSocialApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) });   // 🌐 친구 홈 구경 때 이름을 모르는 사람의 이름 한 줄(명함) — 읽기만
/* 📚 마이홈 북마크 서랍(myhome/bookmark.js) — 바탕화면이 준비되면(MYHOME_DESKTOP.onReady) 폴더로 붙는다. */
TwBookmark.createBookmark({
  bookshelfStore: bookshelfStoreMod,
  toast: (...a)=>toast(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  buildFreeColorPicker: (...a)=>wardrobeMod.buildFreeColorPicker(...a),
});
/* 🧸 말랑이 · 🎁 선물(myhome/mallang.js) — 마이홈 수령함 · 창 · 친구 홈 구경이 deps 로 받아서 그보다 먼저 만든다(만들 때 도는 일 없음). */
const mallangMod = TwMallang.createMallang({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  premiumOn: (...a)=>_premiumOn(...a),
  mallangStore: mallangStoreMod,
  giftBox: giftBoxMod,
});

/* ═══ 👥 마이홈 친구 목록 · Ctrl+F 검색 ═══ */
/* 👥 마이홈 친구 목록(Ctrl+F 검색) · 📩 수령함 · 💝 선물함 그리기 · 수령함 함수(안 읽은 수 · 배지 · 공지 읽음) · 친구 방 표시 둘은
     parts/myhome-inbox.js 로 옮겼다(앱 FSD 15번 · docs/APP_FSD_MAP.md). ★ 원래 자리인 여기서 만든다 — 만들 때 바로 도는 일은 없다(상태 초기값뿐).
   부르는 곳은 inboxMod.이름(전부 이 줄보다 늦게 돈다). 개인 우편 · 공용 소식은 mailFeed · noticeFeed(서버 원본)가 들고 있어
     읽는 함수 대신 그 한 벌을 넘긴다. INBOX_BC_READ_KEY 는 로그아웃 지움 목록이 같이 써서
     app.js 에 두고 값으로. isAdmin 은 이 줄보다 뒤에 선언되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
/* 🏠 친구 방에 놀러 가기 — 방 코드 누르기 · 묻는 창 · 이동은 friend-visit.js. 여기는 연결만. */
const friendVisit = window.TwFriendVisit ? TwFriendVisit.createFriendVisit({ document, escHtml, toast, twNav,
  getFriend: fid => _myHomeFriends[fid], refreshFriend: fid => friendsSubMod.refreshPresence([fid]), roomTagOf: (...a)=>inboxMod.friendRoomTag(...a), friendInRoom: (...a)=>inboxMod.friendInRoom(...a), isSecretCode: c => TwRoomState.isSecretCode(c),
  myRoom: () => (typeof Presence !== 'undefined' && Presence.roomCode) ? Presence.roomCode() : null,
  inRoom: () => typeof Presence !== 'undefined' && Presence.active(),
  leaveRoom: () => roomEntryMod.doLeaveRoom({ wipeChat: true }), startRoom: c => roomEntryMod.startRoom(c),
  channelName: c => { const ch = Object.keys(roomEntryMod.ROOM_PREFIX).find(k => String(c).indexOf(roomEntryMod.ROOM_PREFIX[k]) === 0); return ch ? roomEntryMod.CHANNEL_NAMES[ch] : ''; } }) : null;
const inboxMod = TwMyHomeInbox.createMyHomeInbox({
  escHtml: (...a)=>escHtml(...a),
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  giftSave: TwGiftSave.createGiftSave({ fetch: (...a)=>fetch(...a), document, URL, setTimeout: (...a)=>setTimeout(...a), safeUrl: TwSafeHtml.safeUrl, now: ()=>new Date(), notifyFail: e=>TwErrorCodes.notify('E-MH-03', e) }),
  // 📩 수령함
  mailFeed: mailFeed,
  noticeFeed: noticeFeed,
  INBOX_BC_READ_KEY: INBOX_BC_READ_KEY,
  isAdmin: ()=>isAdmin,
  mhScheduler: mhScheduler,
  // 👥 친구 목록
  myHomeFriends: ()=>_myHomeFriends,
  friendsNotice: (...a)=>friendsSubMod.notice(...a),
  FRIEND_MAX: FRIEND_MAX,
  friendVisit: friendVisit,
  mhStripHtml: (...a)=>richTextMod._mhStripHtml(...a),
  starFromRemote: (...a)=>focusLevelMod.starFromRemote(...a),
  lvStarBadgeClass: (...a)=>lvTierMod.lvStarBadgeClass(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  lvBadgeClass: (...a)=>lvTierMod.lvBadgeClass(...a),
  openFriendHomeView: (...a)=>mhVisitMod.openFriendHomeView(...a),
  renderMhProfileRail: (...a)=>myHomeUiMod.renderMhProfileRail(...a),
  twNav: twNav,
  mallangMod: mallangMod,
  giftBox: giftBoxMod,
  // 👥 친구 끊기 — 포트가 서버 · 옛 경로를 고른다
  removeFriend: (...a)=>friendsPortMod.removeFriend(...a),
});
/* ═══ 🏠 마이홈 창 버튼 연결(bindMyHomeUI) ═══ */
/* 본문은 myhome-ui.js 로 옮겼다(앱 FSD 22번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* 📘 도움말 탭 — 테마는 탭에 들어올 때 읽는다(themeMod 는 아래에서 만든다) · 테마를 바꾸면 아래 onApplied 로 다시 연다 */
const helpTabMod = TwHelpTab.createHelpTab({ getTheme: ()=>themeMod.getTheme() });
const myHomeUiMod = TwMyHomeUi.createMyHomeUi({
  FRIEND_MAX: FRIEND_MAX,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  _mhApplyVisitUI: (...a)=>mhVisitMod._mhApplyVisitUI(...a),
  _mhCloseStickerAnim: (...a)=>mhStLayoutMod._mhCloseStickerAnim(...a),
  _mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  _myFriendRequests: ()=>_myFriendRequests,
  _myHomeFriends: ()=>_myHomeFriends,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  closeFriendHomeView: (...a)=>mhVisitMod.closeFriendHomeView(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  friendManage: friendManage,
  friendRequests: ()=>friendRequestsPortMod,
  friendsForCheck: (...a)=>friendsSubMod.friendsForCheck(...a),
  friendsRetry: (...a)=>friendsSubMod.retryIfFailed(...a),
  friendsOpen: (...a)=>friendsSubMod.open(...a),
  friendsClose: (...a)=>friendsSubMod.close(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  helpTab: helpTabMod,
  inboxMod: inboxMod,
  isAdmin: ()=>isAdmin,
  loadMyHomePage: (...a)=>mhPageMod.loadMyHomePage(...a),
  mallangMod: mallangMod,
  giftBox: giftBoxMod,
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>launcherStateMod.myHomeOpen(),
  myHomeSticker: ()=>myHomeSticker,
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  renderMyHomeStickers: (...a)=>stickerRenderMod.renderMyHomeStickers(...a),
  toast: (...a)=>toast(...a),
  setMyHomeOpen: (v)=>{ launcherStateMod.setMyHomeOpen(v); },
  twNav: twNav,
});
/* 👥 친구 목록이 보이는 동안만 friends-sub 에 «열림» — 마이홈을 여닫는 길이 여럿이라(열기 · 친구 홈 구경 · 런처 복귀 · 단축키) 두 칸의 class 를 지켜본다. */
for(const id of ['myHomeOverlay', 'mhPageFriend']){
  const el = document.getElementById(id);
  if(el) new MutationObserver(()=>myHomeUiMod.syncFriendsOpen()).observe(el, { attributes:true, attributeFilter:['class'] });
}

/* ============================================================ 🏠 마이홈 (2단계: 프로필/게시글/스티커) */
/* 본문은 myhome-visit.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* 🏠 마이홈 공용 상태(데이터 · 불러옴 · 계정 · 관람 중 uid · 이름)는 myhome-state.js 에 — 읽는 모듈이 친구 홈 구경을 바라보지 않게(모듈 순환 끊기 4) */
const mhStateMod = TwMyHomeState.createMyHomeState({
  _myHomeFriends: ()=>_myHomeFriends,
  myhomeStore: myhomeStoreMod,
});
/* 🙋 남의 마이홈 [친구 신청] · 사유 창 — 보내기는 좌석 친구 신청과 같은 한 벌(seat-friend-req.js · 뒤에서 만든다 — 누를 때 찾는다) */
const isFriendRequestAlive = async (toId, me)=>(await friendRequestsPortMod.sentIds(me)).includes(toId);   // 내가 보낸 요청이 살아 있나 — 마이홈 단추 · 좌석 신청이 같이 쓴다(GET 한 번 · 이름 안 받음)
const friendReqBtnMod = TwFriendReqBtn.createFriendReqBtn({
  sendFriendReq: (...a)=>seatFriendReqMod.sendFriendReq(...a),
  resultView: (...a)=>seatFriendReqMod.resultView(...a),
  friendNet: ()=>({ isFriendRequestAlive }),
  friends: ()=>_myHomeFriends,
  getMyUserId: (...a)=>getMyUserId(...a),
  toast: (...a)=>toast(...a),
  reasonOn: ()=>TwServerFeatures.on('friendReqMsg'),   // 사유 칸 — 서버 POST /v2/me/friend-requests 의 message(UTF-16 100자)
});
const mhVisitMod = TwMyHomeVisit.createMyHomeVisit({
  _myHomeFriends: ()=>_myHomeFriends,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  loadMyHomePage: (...a)=>mhPageMod.loadMyHomePage(...a),
  mallangMod: mallangMod,
  mhScheduler: mhScheduler,
  myHomeOpen: ()=>launcherStateMod.myHomeOpen(),
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  toast: (...a)=>toast(...a),
  setMyHomeOpen: (v)=>{ launcherStateMod.setMyHomeOpen(v); },
  _mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  _mhViewingName: ()=>mhStateMod._mhViewingName(),
  _mhViewingDisplayName: (...a)=>mhStateMod._mhViewingDisplayName(...a),
  myhomeStore: myhomeStoreMod,
  fetchCards: (...a)=>socialNamesApi.fetchCards(...a),
  refreshFriendProfile: (...a)=>friendsSubMod.refreshProfile(...a),   // 👥 친구면 이름 · 레벨을 새로(목록이 닫혀 있어도)
  friendReqBtn: friendReqBtnMod,   // 🙋 이름 옆 [친구 신청] — 관람 화면을 칠할 때 다시 본다
});

/* ═══ 🔬 __mhClickDiag() — "보이는데 안 눌린다"를 한 줄로 가르는 진단 ═══════════
   [왜 필요한가] 마이홈에서 "버튼이 안 눌린다"는 제보가 두 건 왔는데(방명록 등록 · 닉네임 수정),
     둘 다 코드로는 멀쩡하다 — 리스너도 붙어 있고 핸들러도 예외 없이 끝난다
     (sim-mh-name-edit.js 가 그걸 실제로 눌러서 확인한다). 그러면 남는 원인은 **화면 가림**인데,
     그건 레이아웃이 있어야만 보이는 것이라 소스를 아무리 읽어도 안 나온다.
   [무엇을 하나] 각 버튼의 한가운데 좌표에서 elementFromPoint 를 찍어, **거기서 실제로 클릭을
     받는 것이 누구인지** 이름으로 돌려준다. 가린 것이 있으면 그 정체가 그대로 찍힌다.
   [쓰는 법] 마이홈을 연 상태에서 콘솔에 `__mhClickDiag()`.
     · 보임:false            → 가려진 게 아니라 숨겨진 것이다(관람·미리보기 잠금 쪽을 본다)
     · 가려짐:true + 가린것  → 그 요소가 범인이다
     · 전부 정상             → DOM 은 결백하다. 그때는 클릭 통과(_pointHitsInteractive) 쪽을 본다
   ⚠️ 실행 화면은 창이 투명해 콘솔을 열기 어렵다. 런처/생성기에서 마이홈을 열고 보는 것이 쉽다.
   ⚠️ 이건 **진단이지 방어가 아니다.** 원인을 잡고 나면 지워도 되는 블록이다. */
/* 본문은 myhome-diag.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const mhDiagMod = TwMyHomeDiag.createMyHomeDiag({
  _mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
});

/* ═══ 🏠 마이홈 페이지 불러오기 · 그리기 ═══ */
/* 본문은 myhome-page.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const mhPageMod = TwMyHomePage.createMyHomePage({
  getDisplayName: (...a)=>getDisplayName(...a),
  mhStateMod: mhStateMod,
  myHomeUiMod: myHomeUiMod,
  renderMyHomeStickers: (...a)=>stickerRenderMod.renderMyHomeStickers(...a),
  richTextMod: richTextMod,
  myhomeStore: myhomeStoreMod,
  myHomeOpen: ()=>launcherStateMod.myHomeOpen(),
});
myhomeStoreMod.onChange(()=>mhPageMod.onStoreChange());   // 상태 주인의 값이 바뀌면 열린 마이홈을 다시 그린다(판단은 myhome-page.js)
/* ═══ ✏️ 인앱 프롬프트(asyncPrompt) ═══ */
/* 본문은 async-prompt.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const asyncPromptMod = TwAsyncPrompt.createAsyncPrompt({
});
/* ═══ 🎨 마이홈 스티커 배치 · 그리기(renderMyHomeStickers) · 관리 창 연결 ═══ */
/* 본문은 myhome-sticker-layout.js 로 옮겼다(앱 FSD 44번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const mhStLayoutMod = TwMyHomeStickerLayout.createMyHomeStickerLayout({
  _mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  _myHomeData: ()=>mhStateMod._myHomeData(),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  renderMyHomeStickers: (...a)=>stickerRenderMod.renderMyHomeStickers(...a),
  myhomeStore: myhomeStoreMod,
});
/* 본문은 myhome/myhome-sticker-render.js 로 옮겼다(앱 FSD · app.js 분리 M19). × 로 지우기 · 저장은 상태 주인(myhomeStore.removeSticker)이 한다. */
const stickerRenderMod = TwMyHomeStickerRender.createMyHomeStickerRender({
  mhPageMod: mhPageMod,
  mhStLayoutMod: mhStLayoutMod,
  myHomeSticker: ()=>myHomeSticker,
  myhomeStore: myhomeStoreMod,
  stickerLayer: stickerLayerMod,
});
stickerLayerMod.onChange(()=>stickerRenderMod.renderMyHomeStickers());   // 설정에서 켜고 끄면 바로 다시 그린다

/* 🎨 스티커 관리 창 · 스티커 편집모드 · 드래그 · 회전 · 크기는 parts/myhome-sticker.js 로 옮겼다(앱 FSD 7번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(#stMgrClose · #stMgrBringAll 버튼 연결)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게) — renderMyHomeStickers 는 다시 대입되지 않고(지우기 저장은 상태 주인),
   commitMyHomePage 는 그 묶음이 window 에 거는 이름이다. _myHomeData · _mhViewingUserId · _mhStickerEditSid 는 다시 대입되는 let 이라
   읽는 함수로, _mhStickerEditSid · _mhStickerDragDist 를 바꾸는 것은 쓰는 함수로 넘긴다(둘 다 renderMyHomeStickers 가 읽는다 — _mhStickerEditSid 는 myhome-sticker-layout.js 에, _mhStickerDragDist 는 app.js 에).
   STICKER_* 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로. 부르는 곳은 myHomeSticker.이름(전부 마이홈을 연 뒤에 돈다).
   🔗 마이홈 본문 링크(bindMyHomeExternalLinks)는 스티커 관리 창이 아니라 여기 남겼다(마이홈 페이지 편집 묶음은 아래에서 myhome-edit.js 로 잇는다).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const myHomeSticker = TwMyHomeSticker.createMyHomeSticker({
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  myhomeStore: myhomeStoreMod,
  renderMyHomeStickers: (...a)=>stickerRenderMod.renderMyHomeStickers(...a),
  mhStickerOutOfView: (...a)=>mhStLayoutMod._mhStickerOutOfView(...a),
  mhClampStickerPos: (...a)=>mhStLayoutMod._mhClampStickerPos(...a),
  mhStickerDispSize: (...a)=>mhStLayoutMod._mhStickerDispSize(...a),
  mhHomeWinSize: (...a)=>mhStLayoutMod._mhHomeWinSize(...a),
  mhStickerTransform: (...a)=>mhStLayoutMod._mhStickerTransform(...a),
  mhOpenStickerAnim: (...a)=>mhStLayoutMod._mhOpenStickerAnim(...a),
  myHomeData: ()=>mhStateMod._myHomeData(),
  mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  mhStickerEditSid: ()=>mhStLayoutMod._mhStickerEditSid(),
  setMhStickerEditSid: (v)=>{ mhStLayoutMod.setMhStickerEditSid(v); },
  setMhStickerDragDist: (v)=>{ mhPageMod.setMhStickerDragDist(v); },
  stickerMax: mhStLayoutMod.STICKER_MAX,
  stickerBase: mhStLayoutMod.STICKER_BASE,
  stickerRotSnap: mhStLayoutMod.STICKER_ROT_SNAP,
  stickerLayer: stickerLayerMod,
});

/* ═══ 🔗 마이홈 본문 링크 ═══ */
/* 본문은 myhome-links.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const mhLinksMod = TwMyHomeLinks.createMyHomeLinks({
});

/* ═══ 🏠 마이홈 페이지 편집 묶음 · 📖 방명록 모듈 연결 ═══ */
/* 🏠 마이홈 페이지 편집 묶음(자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 스티커 끌기 · 닉네임 · 게시글 제목 · 🎵 BGM ·
   바깥 배경 · 테마 · 👑 디자인 스튜디오 · 프리셋 — 옛 bindMyHomePage)은 parts/myhome-edit.js 로 옮겼다(앱 FSD 7-2 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 만들 때 바로 도는 일(버튼 · 입력칸 연결 · window 고리 · companion.onBgmClosed · onBgmMode 구독)이
     예전과 같은 때 돈다. 바깥에서 부르는 이름은 예전처럼 window 에 걸린다(commitMyHomePage · _mhApplyBg · _mhApplyTheme · _bgmDestroy 등).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeData · _mhViewingUserId · _mhStickerDragDist · isPremium · isAdmin 은
   다시 대입되거나 마이홈 상태 주인이 들고 있는 값이라 읽는 함수로, _mhStickerDragDist 를 바꾸는 것은 쓰는 함수로 넘긴다.
   USER_NAME_MAX 는 이 줄보다 뒤에 선언되는 const 라(TDZ) 읽는 함수로. 마이홈 페이지 값은 myhomeStore(상태 주인)의 동작 함수로만 고친다 —
   스티커 삭제 저장도 그쪽(removeSticker)이 하므로 renderMyHomeStickers 를 감싸 다시 대입하지 않는다.
   myHomeSticker · STICKER_* · DS_IMG_* 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const myHomeEdit = TwMyHomeEdit.createMyHomeEdit({
  myhomeEditAccountStore: accountStoreMod,
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  renderMyHomePage: (...a)=>mhPageMod.renderMyHomePage(...a),
  renderMyHomeStickers: (...a)=>stickerRenderMod.renderMyHomeStickers(...a),
  mhSaveRT: (...a)=>richTextMod._mhSaveRT(...a),
  mhUpdateRTCount: (...a)=>richTextMod._mhUpdateRTCount(...a),
  mhClampStickerPos: (...a)=>mhStLayoutMod._mhClampStickerPos(...a),
  mhViewingDisplayName: (...a)=>mhStateMod._mhViewingDisplayName(...a),
  mhApplyVisitUI: (...a)=>mhVisitMod._mhApplyVisitUI(...a),
  ytVideoId: (...a)=>plMod.ytVideoId(...a),
  applyThemeToChildDoc: (...a)=>themeUiMod.applyThemeToChildDoc(...a),
  watchMaintenanceInput: (...a)=>TwMaintenance.store.watchInput(...a),
  installMacTip: (...a)=>TwMacTooltip.installChild(...a),
  commitUserName: (...a)=>userNameMod.commitUserName(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getUserName: (...a)=>getUserName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  myHomeData: ()=>mhStateMod._myHomeData(),
  mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  myhomeStore: myhomeStoreMod,
  mhStickerDragDist: ()=>mhPageMod._mhStickerDragDist(),
  setMhStickerDragDist: (v)=>{ mhPageMod.setMhStickerDragDist(v); },
  isPremium: ()=>isPremium,
  isAdmin: ()=>isAdmin,
  userNameMax: ()=>userNameMod.USER_NAME_MAX,
  myHomeSticker,
  stickerMax: mhStLayoutMod.STICKER_MAX,
  stickerImgMaxW: mhStLayoutMod.STICKER_IMG_MAX_W,
  dsImgMaxBgW: DS_IMG_MAX_BG_W,
  dsImgMaxBgH: DS_IMG_MAX_BG_H,
  dsImgMaxPanel: DS_IMG_MAX_PANEL,
  dsImgQuality: DS_IMG_QUALITY,
});

/* 📖 방명록(새 글 배지 · 독립 팝업 창 — 웹박수 · 폭죽 · 글 목록 · 쓰기)은 parts/guestbook.js 로 옮겼다(앱 FSD 4번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(#mhGuestbookBtn 클릭 연결 · window 고리 등록)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _mhViewingUserId 는 다시 대입되는 let 이라 읽는 함수로 넘긴다.
   부르는 곳은 예전처럼 window 고리(_mhGbStartWatch · _mhGbStopWatch · _mhGbRefreshBadge · _mhReSubscribeGuestbook · openMyGuestbook)를 typeof 로 보고 부른다 — 모듈이 없으면 고리가 없어 조용히 넘어간다.
   💬 showChatBubble(머리 위 말풍선)은 방명록이 아니라 바로 아래에 남겼다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const guestbookFeed = TwGuestbookFeed.createGuestbookFeed({   // 🌐 방명록 · 웹박수 서버 endpoint(/v2/guestbooks · /v2/me/guestbook) — 원본은 서버. 받기 · 쓰기 · 알림은 feed 가 한다
  api: TwGuestbookApi.createGuestbookApi({ authed: TwApi.authed, imageBytes: TwImageBytes, ownImage: ownImageMod, warn: (...a)=>console.warn(...a) }),
  rt: TwRtHub.store,
  rtState: TwRtHub.STATE,
  rtDeviceOff: (s)=>TwRtHub.isDeviceOff(s),   // 서버가 이 PC 연결을 끝냄(rt-hub 한 곳)
  pending: TwRequestId.createPending(),
  lastRead: TwGuestbookFeed.createLastReadStore(accountStoreMod.asStorage()),   // 🗂️ 읽음 시각은 이 계정 칸(닫혀 있으면 읽기 0 · 쓰기 안 됨)
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  translate: (e, table)=>TwApiErrors.translate(e, table),
  ACTION: TwApiErrors.ACTION,
  now: ()=>Date.now(),
});
const guestbook = TwGuestbook.createGuestbook({
  feed: guestbookFeed,
  errorText: (code)=>TwErrorCodes.toastText(code),
  getMyUserId: ()=>getMyUserId(),
  getDisplayName: ()=>getDisplayName(),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  applyThemeToChildDoc: (...a)=>themeUiMod.applyThemeToChildDoc(...a),
  watchMaintenanceInput: (...a)=>TwMaintenance.store.watchInput(...a),
  installMacTip: (...a)=>TwMacTooltip.installChild(...a),
  mhViewingUserId: ()=>mhStateMod._mhViewingUserId(),
  mhViewingDisplayName: ()=>mhStateMod._mhViewingDisplayName(),
});

/* ═══ 💬 머리 위 채팅 말풍선(showChatBubble) ═══ */
// 💬 채팅 말풍선 표시 시간(ms) — 이 시간 동안은 상태 말풍선 대신 채팅 내용이 보임.
const CHAT_BUBBLE_MS = 5000;
function showChatBubble(seat, text){
  if(!seat || !text) return;
  seat.chatBubbleText = String(text).slice(0,140);
  seat.chatBubbleUntil = performance.now() + CHAT_BUBBLE_MS;
}
/* ═══════════════ 🌊 채팅 「날리기」 — 흐르는 자막 ═══════════════════════════
   체크하고 보낸 줄은 말풍선 대신 화면 상단 40% 를 가로질러 흐른다(니코동식).

   ⚠️ **「플라잉체어」와 다른 기능이다.** 저쪽(seat.fly · applyRemoteFly · flyCool ·
     sim-fly-egg · sim-fly-replay)은 캐릭터를 날리고, 이쪽은 글자를 흘린다. 이름만 겹친다.

   ★ 움직임은 **CSS 애니메이션 하나**뿐이다. rAF 로 옮기지 말 것 — 포커스가 없을 때
     오버레이 FPS 를 낮추는 구조라(sim-unfocused-fps) rAF 이동은 남의 화면에서 끊긴다.
     여기 JS 가 하는 일은 «요소를 만들고 animationend 에 지우는 것» 뿐이다.
   ★ 한 노드 = 마지막 하나. 말풍선과 같은 한계라, 0.5 초 안에 두 번 날리면 앞 줄이 덮인다.
     chatLog 를 타면 해결되지만 그건 비용 때문에 안 가기로 한 길이라, 보내는 쪽에서
     연타를 억제하는 것으로 갈음한다(_chatFlySendGate).                                */
/* 본문은 chat-ui.js 로 옮겼다(앱 FSD 24번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* 📢 시크릿룸 공지(#공지 탭 · 고정 줄) — parts/chat/chat-notice.js. 채팅 모듈이 값으로 받아 먼저 만든다(채팅 모듈이 onChange 를 건다 — 한쪽으로만). */
const chatNoticeMod = TwChatNotice.createChatNotice({
  document, escHtml: (...a)=>escHtml(...a), toast: (...a)=>toast(...a), getMyUserId: (...a)=>getMyUserId(...a), roomState: TwRoomState,
  roomCode: ()=>Presence.roomCode(), notifyError: (...a)=>TwErrorCodes.notify(...a),
  enabled: ()=>TwServerFeatures.on('chatNotice'),   // 서버 길이 생길 때까지 꺼짐(TODO: provider 를 서버로)
  provider: TwServerFeatures.noServer('chatNotice'),   // 서버 경로가 생기면 그 provider 로(#1098)
});
/* 📊 시크릿룸 #집중 탭 · 내 집중 시간 올리기 — parts/chat/chat-focus.js · parts/focus/room-focus-sync.js. 올리기는 포커스 누적(focusLevelMod)의 알림에 건다. */
const roomFocusSync = TwRoomFocusSync.createRoomFocusSync({
  provider: TwServerFeatures.noServer('chatFocus'),   // 서버 경로가 생기면 그 provider 로(#1099)
  roomCode: ()=>Presence.roomCode(), isSecretRoom: ()=>TwServerFeatures.on('chatFocus') && TwRoomState.isSecretCode(Presence.roomCode()),   // 서버 길이 생길 때까지 올리지 않는다
  getMyUserId: (...a)=>getMyUserId(...a), getMyName: ()=>getDisplayName(),
  dayKey: ()=>TwRoomFocusDays.dayKeyOf(focusTotalMod._focusDayStr()), now: ()=>Date.now(), storage: localStorage,
});
const chatFocusMod = TwChatFocus.createChatFocus({
  document, escHtml: (...a)=>escHtml(...a), toast: (...a)=>toast(...a), getMyUserId: (...a)=>getMyUserId(...a), roomState: TwRoomState,
  roomCode: ()=>Presence.roomCode(), notifyError: (...a)=>TwErrorCodes.notify(...a), sync: roomFocusSync,
  todayKey: ()=>TwRoomFocusDays.dayKeyOf(focusTotalMod._focusDayStr()),
  enabled: ()=>TwServerFeatures.on('chatFocus'),   // 서버 길이 생길 때까지 꺼짐(TODO: provider 를 서버로)
  provider: TwServerFeatures.noServer('chatFocus'),   // 서버 경로가 생기면 그 provider 로(#1099)
});
const chatUiMod = TwChatUi.createChatUi({
  chatNotice: chatNoticeMod,
  chatFocus: chatFocusMod,
  chatAccountStore: accountStoreMod,
  demojiCatalog: demojiCatalog,
  CHAT_WIN_POS_KEY: ()=>CHAT_WIN_POS_KEY,
  Presence: ()=>Presence,
  _chatDelClose: (...a)=>chatPrefsMod._chatDelClose(...a),
  _chatEsc: (...a)=>_chatEsc(...a),
  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),
  _chatLogCache: ()=>_chatLogCache,
  _chatLogUnsub: ()=>_chatLogUnsub,
  _chatOffOn: (...a)=>chatLockMod._chatOffOn(...a),
  _chatOffRefreshUI: (...a)=>chatLockMod._chatOffRefreshUI(...a),
  _chatRoomCode: (...a)=>chatLockMod._chatRoomCode(...a),
  _danceCmdCooldownAt: ()=>iDeskMod._danceCmdCooldownAt(),
  _diceSvg: (...a)=>diceMod._diceSvg(...a),
  myhomeAvatar: ()=>myhomeStoreMod.avatar(),
  ensureMyHome: (...a)=>myhomeStoreMod.ensureMine(...a),
  _officeDemojiHtml: (...a)=>overheadMod._officeDemojiHtml(...a),
  _parseDanceCmdChain: (...a)=>iDeskMod._parseDanceCmdChain(...a),
  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),
  _seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escHtml: (...a)=>escHtml(...a),
  findMySeat: (...a)=>findMySeat(...a),
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  chatNet: TwChatRt.store,
  chatHistory: ()=>firebaseAPI.chatHistory,   // 💬 대화 기록(chat-history.js) — firebase-init 이 만든 것
  myCode: ()=>TwRoomRt.store.myCode(),
  isAdmin: ()=>isAdmin,
  isDanceUnlocked: (...a)=>iDeskMod.isDanceUnlocked(...a),
  lockedToast: (...a)=>iDeskMod.lockedToast(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  seats: seats,
  showChatBubble: (...a)=>showChatBubble(...a),
  startMyDance: (...a)=>iDeskMod.startMyDance(...a),
  toast: (...a)=>toast(...a),
  setChatLogCache: (v)=>{ _chatLogCache = v; },
  setChatLogUnsub: (v)=>{ _chatLogUnsub = v; },
  setDanceCmdCooldownAt: (v)=>{ iDeskMod.setDanceCmdCooldownAt(v); },
  twNav: twNav,
});

/* ═══════════════ 💬 프리미엄 대화창 (1차: 코어) ═══════════════ */
let _chatLogUnsub = null;      // subscribeChatLog 해제 함수
let _chatLogCache = [];        // 화면에 그린 마지막 메시지 목록(기록 저장용)

/* HTML 이스케이프 (메시지 렌더 시 XSS/깨짐 방지) — 지금은 공용 `escHtml` 의 **별칭**이다.
   ⚠️ 여기에 구현을 되돌려 넣지 말 것. 같은 일을 하는 헬퍼가 둘이 되면 한쪽만 약해지는데,
     그게 정확히 이번에 없앤 `_mhEsc` 가 생긴 경위다(escHtml 정의부 주석 참고).
   이름을 남기는 이유: 채팅 쪽 마커 복원 구조와 검사들이 이 이름을 쓴다.
   ⚠️ `const` 가 아니라 **함수 선언**이다. 여기보다 앞줄에서 부르는 자리가 있어서
     호이스팅이 필요하다(const 로 바꾸면 TDZ 로 조용히 죽는다). */
function _chatEsc(str){ return escHtml(str); }

const CHAT_WIN_POS_KEY = 'tw_chat_win_pos';

/* ═══ 🔇 시크릿룸 채팅 잠금 ════════════════════════════════════════════════
   방장이 방 전체의 채팅을 잠근다. 잠겨도 **😊 이모티콘 · 🎲 주사위 · 💣 폭탄 · /80 · /150** 은 된다.
   ─────────────────────────────────────────────────────────────────────────
   ★ 상태는 `rooms/{코드}/_meta/chatOff` **하나**다. 방 전원이 같은 리스너로 받으므로
     "나만 안 막히는" 상태가 구조적으로 안 생긴다. 방장 본인도 똑같이 막힌다(요청).
   ★ 시크릿룸에서만 동작한다 — `_chatIsSecretRoom()` 을 모든 판정의 앞에 둔다.
     그래야 옛 값이 남은 일반 방이 이유 없이 잠기는 일이 없다.
   ⚠️ 입력칸을 잠그지 않는다. 😊 이모티콘이 이 칸에 `/명령어` 를 꽂아 Enter 로 나가는 구조라,
     readonly 로 막으면 허용하기로 한 이모티콘까지 같이 죽는다. 전송하는 자리에서 가른다. */
/* 본문은 chat-lock.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const chatLockMod = TwChatLock.createChatLock({
  Presence: ()=>Presence,
  chatPrefsMod: chatPrefsMod,
  chatUiMod: chatUiMod,
  myCode: ()=>TwRoomRt.store.myCode(),
  roomState: TwRoomState,
});
/* ═══════════════ 🎲 주사위 ═══════════════ */
/* 본문은 dice-games.js 로 옮겼다(앱 FSD 39번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const diceMod = TwDiceGames.createDiceGames({
  Presence: ()=>Presence,
  ROULETTE_FLY_DELAY_MS: ()=>rouletteMod.ROULETTE_FLY_DELAY_MS,
  canFly: (...a)=>canFly(...a),
  chatUiMod: chatUiMod,
  findMySeat: (...a)=>findMySeat(...a),
  flySeed: (...a)=>flySeed(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  chatNet: TwChatRt.store,
  officeMode: ()=>officeModeMod.officeMode(),
  showChatBubble: (...a)=>showChatBubble(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});
/* 📷 스티커사진 세션 포트(parts/purikura/purikura-rt.js)로 가는 유일한 입구 — 세션은 하나(콜백도 한 벌).
   ⚠️ 창이 닫혀 있는 동안에도 콜백은 살아 있다 — 각 핸들러가 PK.open · PK.listening 을 먼저 본다. */
let _pkSession = null;
function _purikura(){
  if(_pkSession) return _pkSession;
  _pkSession = TwPurikuraRt.createPhotoSession({
    hub: TwRtHub.store, api: TwApi.authed, P: Purikura,
    serverNow: ()=>{ const p = Presence.serverProvider(); return p ? p.serverNow() : null; },   // 방 밖 · 시계를 못 맞춤 = null(PC 시계로 대신하지 않는다)
    onPeers: p => { purikuraUi.onPeers(p); },          // 화면 쪽은 parts/purikura/purikura-ui.js
    onMeta : m => { purikuraUi.onMeta(m); },
    onEvent: (slot, ev) => { purikuraUi.onPeerEvent(slot, ev); },
    onShot : s => { purikuraUi.onShot(s); },
    onSlots: o => { purikuraUi.onSlots(o); },
    onFrames: o => { purikuraUi.onFrames(o); },
    onRefused: o => { purikuraUi.onRefused(o); },
    onLateStart: () => { purikuraUi.onLateStart(); },
  });
  return _pkSession;
}

/* 📷 스티커사진 창(촬영 창 · 로비 · 무대 · 키 · 매 프레임 · 촬영 · 꾸미기) — parts/purikura/purikura-ui.js 로 옮겼다(앱 FSD 3번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(_pkWire: 버튼 · 창 끌기 · ⎋ 사다리 등록)이 예전과 같은 때 돈다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). officeMode · _plPlaying(playlist.js 상태 — plMod.st.playing) 은 다시 대입되는 let 이고, Presence · SPINE_AXIS · HEAD_AXIS ·
   HAND_REST · SHAKE_ARM_DROOP 은 이 줄보다 뒤에 선언되는 const 라(지금 읽으면 TDZ) 읽는 함수로 넘긴다.
   세션 입구 _purikura() 는 위에 그대로 — 콜백은 purikuraUi.onPeers · onMeta · onPeerEvent · onShot · onSlots · onFrames · onRefused · onLateStart 로 들어간다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const purikuraUi = TwPurikuraUi.createPurikuraUi({
  purikura: ()=>_purikura(),
  toast: (...a)=>toast(...a),
  myCode: ()=>TwRoomRt.store.myCode(),
  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  plRender: (...a)=>plMod.render(...a),
  plPlaying: ()=>plMod.st.playing,
  setPlPlaying: v=>{ plMod.st.playing = v; },
  officeMode: ()=>officeModeMod.officeMode(),
  lsSet: (...a)=>_lsSet(...a),
  presence: ()=>Presence,
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  findMySeat: (...a)=>findMySeat(...a),
  setFaceMap: (...a)=>matToneMod.setFaceMap(...a),
  animateRig: (...a)=>animateRig(...a),
  targetFor: (...a)=>targetFor(...a),
  setBone: (...a)=>setBone(...a),
  hueOBC: (...a)=>_hueOBC(...a),
  trickArmBase: (...a)=>iDeskMod._trickArmBase(...a),
  trickArmSpread: (...a)=>iDeskMod._trickArmSpread(...a),
  trickLegPose: (...a)=>iDeskMod._trickLegPose(...a),
  seats,
  animalHandRest: ANIMAL_HAND_REST,
  spineAxis: ()=>SPINE_AXIS,
  headAxis: ()=>HEAD_AXIS,
  handRest: ()=>HAND_REST,
  shakeArmDroop: ()=>SHAKE_ARM_DROOP,
});

/* ═══ 🔫 러시안룰렛 ═══════════════════════════════════════════════════
   [2026-09-23 · handoff-2026-09-21-features §1] 상태칩 ▼ 메뉴 💃 춤추기 아래 버튼.
   ★ 버튼은 **투게더룸에서는 안 보인다**(2026-09-23 요청 · 💃 와 같은 자리에서 숨긴다) — 거기선 대화창 🎲 가
     같은 일을 한다. 아래 _rollRoulette 자체에는 채널 게이트가 없다(혼자·워킹룸에서 도는 길).
   **누른 사람만** 주사위 둘을 굴리고, 하나라도 1이면 **본인이** 날아간다(11/36).
   ★ 날리기는 `Presence.pokeSelf('fly:'+시드)` 로만 간다 — 내 노드 우편함에 쓰면 나를 포함한 방 전원이
     `applyRemoteFly` 로 같은 시드를 재생한다. `throwFlyAt`(남을 겨눔)은 쓰지 않는다.
     ⚠️ 먼저 내 화면에서 돌리지 않는다 — 방송이 돌아올 때 시작하는 규약(💣 주석)을 그대로 지킨다.
   ★ 레벨 게이트 없음 — 💣(FLY_MIN_LEVEL)는 «남을 고른다», 룰렛은 «내 운에 맡긴다».
   ★ 채널 게이트 없음 — `_rollDice` 의 채널 2 줄은 일부러 안 옮겼다. 워킹룸·혼자·투게더룸 전부.
     · 말풍선은 모든 채널(워킹룸 이모티콘과 같은 `Presence.sendChat` 경로).
     · 대화 기록은 **채널 2 만**(워킹룸에는 채팅이 없다).
     · 혼자(방 없음)면 방송이 없으므로 `applyRemoteFly` 를 직접 부른다(회사원 게이트·횟수 세기 동일).
   🏢 회사원 모드 — 💣·📷 와 같이 **누를 때 토스트**로 막는다(내가 방금 누른 버튼이라 무반응은 고장으로 읽힌다).
     보는 사람 쪽 게이트는 `applyRemoteFly` 가 이미 한다.
   ⚠️ 난수는 클라이언트가 굴린다(🎲 와 같은 수준) — 콘솔로 조작 가능. */
/* 본문은 roulette.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const rouletteMod = TwRoulette.createRoulette({
  Presence: ()=>Presence,
  canFly: (...a)=>canFly(...a),
  diceMod: diceMod,
  findMySeat: (...a)=>findMySeat(...a),
  getUserName: (...a)=>getUserName(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  showChatBubble: (...a)=>showChatBubble(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
});

/* ═══ 💬 대화창 배선 — 닫기 · 최소화 · 끌기 · 메뉴 · 버튼 ═══ */
const chatWindowMod = TwChatWindow.createChatWindow({
  // 대화창 코어
  closeChatWindow: (...a)=>chatUiMod.closeChatWindow(...a),
  chatWindowIsOpen: (...a)=>chatUiMod._chatWindowIsOpen(...a),
  chatIsMinimized: (...a)=>chatUiMod._chatIsMinimized(...a),
  setChatMinimized: (...a)=>chatUiMod._setChatMinimized(...a),
  saveChatWinPos: (...a)=>chatUiMod._saveChatWinPos(...a),
  sendChatWindowMsg: (...a)=>chatUiMod._sendChatWindowMsg(...a),
  bindChatCopy: (...a)=>chatUiMod._bindChatCopy(...a),
  bindChatTabs: (...a)=>chatUiMod._bindChatTabs(...a),
  toast: (...a)=>toast(...a),
  // 기록 — 저장 · 지우기 · 되돌리기
  saveChatLog: (...a)=>chatUiMod._saveChatLog(...a),
  chatClearNow: (...a)=>chatUiMod._chatClearNow(...a),
  chatClearUndo: (...a)=>chatUiMod._chatClearUndo(...a),
  // 투명도 · 글자 크기
  clampChatOpacity: (...a)=>chatPrefsMod._clampChatOpacity(...a),
  setChatOpacity: (...a)=>chatPrefsMod._setChatOpacity(...a),
  applyChatOpacity: (...a)=>chatPrefsMod._applyChatOpacity(...a),
  setChatFontSize: (...a)=>chatPrefsMod._setChatFontSize(...a),
  applyChatFontSize: (...a)=>chatPrefsMod._applyChatFontSize(...a),
  // 알림음
  chatSfxOn: (...a)=>chatPrefsMod._chatSfxOn(...a),
  setChatSfxOn: (...a)=>chatPrefsMod._setChatSfxOn(...a),
  setChatSfxId: (...a)=>chatPrefsMod._setChatSfxId(...a),
  chatSfxPreview: (...a)=>chatPrefsMod._chatSfxPreview(...a),
  applyChatSfxUI: (...a)=>chatPrefsMod._applyChatSfxUI(...a),
  chatSfxOfficeLock: (...a)=>chatPrefsMod._chatSfxOfficeLock(...a),
  // 날리기 — 체크 · 크기 · 색(세션 변수는 쓰는 함수로)
  setChatFlyOn: (v)=>{ chatUiMod.setChatFlyOn(v); },
  setChatFlySize: (v)=>{ chatUiMod.setChatFlySize(v); },
  setChatFlyColor: (v)=>{ chatUiMod.setChatFlyColor(v); },
  chatFlyRefreshUI: (...a)=>chatUiMod._chatFlyRefreshUI(...a),
  flySizeOk: (...a)=>chatUiMod._flySizeOk(...a),
  FLY_COLOR_LEVEL: chatUiMod.FLY_COLOR_LEVEL,
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  shownFocusLevel: (...a)=>focusLevelMod.shownFocusLevel(...a),
  isAdmin: ()=>isAdmin,
  // 🔇 채팅 잠금 · 🗑 기록 삭제
  chatOffToggleClick: (...a)=>chatPrefsMod._chatOffToggleClick(...a),
  chatDelOpen: (...a)=>chatPrefsMod._chatDelOpen(...a),
  chatDelClose: (...a)=>chatPrefsMod._chatDelClose(...a),
  chatDelRun: (...a)=>chatPrefsMod._chatDelRun(...a),
  // 😊 이모티콘
  toggleEmojiPanel: (...a)=>chatUiMod._toggleEmojiPanel(...a),
  emojiCache: ()=>chatUiMod._emojiCache(),
  EMOJI_SLOTS: chatUiMod.EMOJI_SLOTS,
  onEmojiSlotClick: (...a)=>chatUiMod._onEmojiSlotClick(...a),
  onEmojiFilePicked: (...a)=>chatUiMod._onEmojiFilePicked(...a),
  deleteEmoji: (...a)=>chatUiMod._deleteEmoji(...a),
  // 🎲 주사위
  rollDice: (...a)=>diceMod._rollDice(...a),
  // 💣 플라잉체어 조준
  FLY_MIN_LEVEL: FLY_MIN_LEVEL,
  seats: seats,
  setFlyAiming: (...a)=>tricksMod.setFlyAiming(...a),
  flyAiming: ()=>tricksMod._flyAiming(),
  officeMode: ()=>officeModeMod.officeMode(),
  // 📷 스티커사진
  purikura: (...a)=>_purikura(...a),
  purikuraUi: purikuraUi,
});

/* ═══ 🎨 텍스처 파츠 색조 셰이더 ═══ */
/* 🎨 색조 셰이더 이름 잇기(shared/hue-tint.js) — 본문은 캐릭터 코어. 아래 const 는 옛 이름이다. */
const hueTintMod = TwHueTint.createHueTint({
  lightToneMod: lightToneMod,
});
const _rgbHexToHsv = hueTintMod._rgbHexToHsv;   // 옛 전역 이름
const isHueTintMesh = hueTintMod.isHueTintMesh;   // 옛 전역 이름
const _ensureHueUniforms = hueTintMod._ensureHueUniforms;   // 옛 전역 이름
const _hueOBC = hueTintMod._hueOBC;   // 옛 전역 이름
const applyHueTint = hueTintMod.applyHueTint;   // 옛 전역 이름
const _hsvToHex = hueTintMod._hsvToHex;   // 옛 전역 이름

/* ═══ 🪑 [2026-09-18] 라이선스 전용 책상을 꾸미기창 «책상» 탭으로 옮긴다 ════════════════════
   [왜 옮기나] 전용 책상은 생성기 5단계에서 미보유자에게도 목록에 계속 보였고, 눌러도 토스트만
     떴다. 쓸 수 없는 카드가 목록을 채우는 군더더기였고, 그 카드가 곧 «고르면 저장값에 굳는»
     입구이기도 했다(제보 2 · pruneUnownedLicenseAssets 주석).
   [무엇을 옮기나] **전용 책상만.** 기본 책상·무료 책상과 색·크기·길이·위치는 5단계에 그대로 둔다.
     꾸미기창은 열 때 통째로 라이선스 게이트라(bindWardrobe 의 open), 무료 책상까지 옮기면
     미보유자가 책상을 아예 못 고르게 된다 — 그건 회귀다.
     ⇒ 이 배치라야 «어차피 라이선스 없으면 못 여는 창» 이 문제가 되지 않는다. 그 안에 전용
       책상밖에 없으므로 미보유자가 잃는 것이 없다(2026-09-18 결정).
   [왜 PART_CATS 에 안 넣나] 같은 그룹의 «책상 위»(deskitem)는 bone:'desk' 표식만으로 파츠 배관을
     그대로 탄다 — 부착 대상이 seat.deskAnchor 로 바뀔 뿐이다. 그런데 책상 **본체**는 붙이는 것이
     아니라 seat.desk 를 통째로 갈아 끼우는 것이고(swapDeskVisual), 크기·길이·색이 딸려 있다.
     PART_CATS 에 가짜 카테고리를 하나 넣으면 파츠 등록 UI·카테고리 상한 계산·catEquippedIds·
     applyClothVisibility 가 전부 그것을 «파츠 카테고리» 로 세게 된다. 그래서 **탭만 가상으로**
     끼우고 내용은 renderWdDeskSection 이 따로 그린다.
   ⚠️ 꾸미기창의 draft(wdDraftDef)는 equippedParts·partXfMemory 만 커밋한다(_commitWdDraftNow).
     책상 필드는 커밋 대상이 아니므로 charDef 에 **바로 쓴다** — 생성기의 autoSaveDeskItemsNow 와
     같은 태도다. 다만 미리보기는 draft 를 보므로 draft 에도 같이 적어 준다. */
/* 본문은 premium-assets.js 로 옮겼다(앱 FSD 37번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const premiumMod = TwPremiumAssets.createPremiumAssets({
  catalogAdmin: catalogAdmin,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  accountStore: accountStoreMod,
  Presence: ()=>Presence,
  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),
  cBase: ()=>crState.cBase,
  deskItemDef: (...a)=>deskItemsMod.deskItemDef(...a),
  deskPartAnchorOf: (...a)=>deskPlaceMod.deskPartAnchorOf(...a),
  equipDeskItem: (...a)=>equipDeskItem(...a),
  findMySeat: (...a)=>findMySeat(...a),
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),
  savedDesks: ()=>commissionMod.savedDesks(),
  savedItems: ()=>commissionMod.savedItems(),
  seats: seats,
  slots: ()=>slots,
  toast: (...a)=>toast(...a),
});
/* ═══ 🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자) ═══ */
/* 🗂️ 파츠 페이로드 · 삭제 · 🛠️ 등록 창 본문은 admin/admin-part-register.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에 모은다.
   값 열세 개는 이 줄보다 뒤에 선언되거나 다시 대입되므로 읽는 함수로 넘긴다. 밖에서는 adminPartReg.이름 으로 부른다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminPartReg = TwAdminPartRegister.createAdminPartRegister({
  catalogAdmin: catalogAdmin,
  _b64: (...a)=>codeCryptoMod._b64(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),
  findEntryById: (...a)=>premiumMod.findEntryById(...a),
  generatePartThumbnail: (...a)=>partSceneMod.generatePartThumbnail(...a),
  getPartScene: (...a)=>partSceneMod.getPartScene(...a),
  getRecHides: (...a)=>premiumMod.getRecHides(...a),
  parseGlbBytes: (...a)=>assetCodeMod.parseGlbBytes(...a),
  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),
  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),
  persistSavedParts: (...a)=>premiumMod.persistSavedParts(...a),
  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  renderCrItems: (...a)=>deskSetupMod.renderCrItems(...a),
  renderWardrobe: (...a)=>wardrobeMod.renderWardrobe(...a),
  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  syncWdGizmoToXf: (...a)=>wardrobeMod.syncWdGizmoToXf(...a),
  toast: (...a)=>toast(...a),
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  seats,
  PART_CATS: ()=>premiumMod.PART_CATS(),
  gachaMod: ()=>gachaMod,
  partSceneCache: ()=>partSceneMod.partSceneCache,
  savedDesks: ()=>commissionMod.savedDesks(),
  savedItems: ()=>commissionMod.savedItems(),
  savedParts: ()=>premiumMod.savedParts(),
  wdGizmo: ()=>wardrobeMod.wdGizmo(),
  wdPreviewBase: ()=>wardrobeMod.wdPreviewBase(),
  setSavedParts: (v)=>{ premiumMod.setSavedParts(v); },
  setAdminPartActions: wardrobeMod.setAdminPartActions,
});

/* ═══ 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너 ═══ */
/* 본문은 overhead.js 로 옮겼다(앱 FSD 34번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const overheadMod = TwOverhead.createOverhead({
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  _chatEsc: (...a)=>_chatEsc(...a),
  _diceSvg: (...a)=>diceMod._diceSvg(...a),
  _starPaint: (...a)=>lvTierMod._starPaint(...a),
  _wpTmp3: statusChipMod._wpTmp3,
  camera: camera,
  chatUiMod: chatUiMod,
  focusLevelMod: ()=>focusLevelMod,
  getDisplayName: (...a)=>getDisplayName(...a),
  npStarFill: (...a)=>lvTierMod.npStarFill(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  renderer: renderer,
  rtHub: TwRtHub,
  seatScale: (...a)=>seatEqMod.seatScale(...a),
  seats: seats,
  tricksMod: tricksMod,
});
/* ═══ 👻 캐릭터 투명도 · 활동 판정(seatState) · 쓰다듬기 ═══ */
/* 본문은 room/seat-opacity.js · status/seat-state.js 로 옮겼다(앱 FSD · app.js 분리 M10). 원래 자리인 여기서 만든다 — 활동 시각 듣기(mousemove · keydown · wheel · blur · focus)가 예전과 같은 때 걸린다.
   다시 대입되던 활동 시각 · 펜 앱 · 창 자신 깃발은 모듈 안에 있고 `seatStateMod.이름()` 으로 읽는다. */
const seatOpacityMod = TwSeatOpacity.createSeatOpacity({
});
const setSeatOpacity = seatOpacityMod.setSeatOpacity;   // 옛 전역 이름
const seatStateMod = TwSeatState.createSeatState({
  desktopMode: ()=>desktopMode,
  figureMode: ()=>officeModeMod.figureMode(),
  focusGate: TwFocusGate,
  focusGateSleep: ()=>focusGateSleep,
  focusLevelMod: ()=>focusLevelMod,
  seatPanelMod: seatPanelMod,
  userStatusMod: userStatusMod,
});
const focusWindowMs = seatStateMod.focusWindowMs;   // 옛 전역 이름
const activity = seatStateMod.activity;   // 옛 전역 이름
const anyInput = seatStateMod.anyInput;   // 옛 전역 이름
const seatState = seatStateMod.seatState;   // 옛 전역 이름
const triggerPet = seatStateMod.triggerPet;   // 옛 전역 이름

/* ============================================================ DRAG / PET */
/* 본문은 room/seat-pointer.js 로 옮겼다(앱 FSD · app.js 분리 M11). 원래 자리인 여기서 만든다 — 캔버스 듣기(contextmenu · pointerdown · pointermove · pointerup · pointercancel · blur · mousemove)가 예전과 같은 때 걸린다.
   끄는 중 상태 drag 는 모듈 안에 있고 `seatPointerMod.drag()` 로 읽는다. */
const seatPointerMod = TwSeatPointer.createSeatPointer({
  Presence: ()=>Presence,
  _uiHot: (...a)=>_uiHot(...a),
  activeItemMixers: activeItemMixers,
  camera: camera,
  canvas: canvas,
  floatersMod: ()=>floatersMod,
  hiddenSeatsMod: hiddenSeatsMod,
  iDeskMod: iDeskMod,
  layoutSeats: (...a)=>layoutSeats(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  overheadMod: overheadMod,
  playItemIdle: (...a)=>playItemIdle(...a),
  rideBenchMod: rideBenchMod,
  roomSeatMode: ()=>roomSeatMode,
  seatLayoutMod: seatLayoutMod,
  seatMenuMod: ()=>seatMenuMod,
  seatPanelMod: seatPanelMod,
  seats: seats,
  setSuppressNextContextMenu: (v)=>{ moveModeMod.setSuppressNextContextMenu(v); },
  sfxMod: sfxMod,
  suppressNextContextMenu: ()=>moveModeMod._suppressNextContextMenu(),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  triggerPet: triggerPet,
});
const ray = seatPointerMod.ray;   // 옛 전역 이름
const ndc = seatPointerMod.ndc;   // 옛 전역 이름
const seatFromObject = seatPointerMod.seatFromObject;   // 옛 전역 이름
/* 본문은 myhome/seat-friend-req.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatFriendReqMod = TwSeatFriendReq.createSeatFriendReq({
  FRIEND_MAX: FRIEND_MAX,
  _myHomeFriends: ()=>_myHomeFriends,
  friendNet: ()=>({ sendFriendRequest: (...a)=>friendRequestsPortMod.send(...a), isFriendRequestAlive }),
  getMyUserId: (...a)=>getMyUserId(...a),
  toast: (...a)=>toast(...a),
});
/* 본문은 room/seat-menu.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatMenuMod = TwSeatMenu.createSeatMenu({
  _myHomeFriends: ()=>_myHomeFriends,
  _premiumOn: (...a)=>_premiumOn(...a),
  hiddenSeatsMod: hiddenSeatsMod,
  mhVisitMod: mhVisitMod,
  openCreator: (...a)=>openCreator(...a),
  reportMod: ()=>reportMod,
  seatFriendReqMod: seatFriendReqMod,
  setUserStatus: (...a)=>setUserStatus(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  userStatus: ()=>userStatusMod.userStatus(),
});
overheadMod.setSeatMenu((...a)=>seatMenuMod._seatCtxMenu(...a));   // 이름표 우클릭 → 좌석 메뉴(메뉴가 신고 · 마이홈 · 놀이를 거쳐 이름표로 돌아와 deps 대신 여기서 잇는다)
const seatLabelDragMod = TwSeatLabelDrag.createSeatLabelDrag({
  beginDrag: seatPointerMod._beginLabelSlotDrag,
  flyAiming: ()=>tricksMod._flyAiming(),
  bonkAiming: ()=>tricksMod._bonkAiming(),
});
overheadMod.setLabelDrag((e, seat)=>seatLabelDragMod.onLabelPointerDown(e, seat));



/* ============================================================ FLOATERS */
/* 본문은 floaters.js 로 옮겼다(앱 FSD 46번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const floatersMod = TwFloaters.createFloaters({
  floatersAccountStore: accountStoreMod,
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  focusCharScale: ()=>charPlaceMod.focusCharScale(),
  scene: scene,
});

/* ============================================================ WARDROBE PARTS (꾸미기 파츠 부착)
   캐릭터 본(head/spine/handL/handR)에 GLB 파츠를 부착. 동시 1개/카테고리(양손 각각).
   파츠 GLB는 부착 위치에 맞춰 모델링된 전제(코드는 본에 그대로 add). */
/* 👕 옷 겹침(character/cloth-visibility.js) — 아래 const 는 옛 전역 이름이다. */
const clothVisMod = TwClothVisibility.createClothVisibility({
  decoPartsMod: decoPartsMod,
  premiumMod: premiumMod,
  rideBenchMod: rideBenchMod,
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
});
const _unequipClothCat = clothVisMod._unequipClothCat;   // 옛 전역 이름
const applyClothVisibility = clothVisMod.applyClothVisibility;   // 옛 전역 이름
/* ★ 파츠 카테고리별 "기본 부착 위치" 미세조정 표 — 여기 숫자만 조절하면 해당 카테고리 파츠가
   장착됐을 때 시작 위치가 전부 한 번에 맞춰짐(사용자가 우클릭해서 개별 조정한 값은 이 위에 별도로
   더해지므로 서로 영향 안 줌). x=좌우, y=위아래, z=앞뒤(양수=카메라 쪽/앞, 음수=뒤).
   여기 없는 카테고리는 기본값(0,0,0) — 본(bone) 위치 그대로 붙음. */
const PART_DEFAULT_OFFSET = {
  mask:    {x:0,    y:-1.95, z:-0.3},   // 탈 — 기존 MASK_Y_OFFSET/MASK_Z_OFFSET을 여기로 통합
  hat:     {x:0,    y:0,     z:-0.5},
  glasses: {x:0,    y:-1.95, z:-0.3},
  top:     {x:0,    y:0,     z:0},
  bottom:  {x:0,    y:0,     z:0},
  onepiece:{x:0,    y:0,     z:0},
  wing:    {x:0,    y:0,     z:0},
  handL:   {x:0,    y:0,     z:0},
  handR:   {x:0,    y:0,     z:0},
};
/* 🩺 리깅 파츠 정렬 진단 — "리깅으로 붙었는데도 파츠가 뜬다"의 원인을 숫자로 확정한다.
   (핸드오프 3장 0번이 "리깅으로 붙었는데도 뜬 것이면 다른 원인, 재조사 필요"라고 남겨둔 그 자리)

   리깅 파츠의 최종 위치는 본 '이름'이 아니라 boneInverse가 결정한다:

       최종 = [캐릭터 본의 월드행렬] × [파츠 GLB의 boneInverse] × [파츠 bindMatrix] × 정점
                    ↑ 캐릭터 것        ↑ 파츠 것 — 여기가 어긋나면 그 차이만큼 통째로 밀린다

   equipPartOnSeat은 본만 캐릭터 것으로 갈아끼우고(`mapped`) boneInverses는 파츠 값을 그대로 쓴다.
   그래서 캐릭터 본을 가져다 만들었더라도 export 시 아마추어 위치·스케일이 조금 달랐거나
   (Apply Transform 유무, 아마추어를 원점으로 옮겨 내보내기 등) 역행렬이 달라지고, 파츠는 그만큼 뜬다.
   예: 파츠의 head 본이 바인드 시점에 원점 근처였다면 정확히 '머리 높이'만큼 뜬다.

   이 함수는 아무 것도 바꾸지 않는다. 본별로 아래 둘을 나란히 찍어서 위 가설을 검증만 한다.
     · 파츠 바인드 위치 — inverse(파츠 boneInverse)의 위치 = 저작 시점에 그 본이 있던 자리
     · 캐릭터 바인드 위치 — 캐릭터 자신의 스킨드메시에서 같은 이름 본의 boneInverse로 뽑은 자리
   두 값의 차이(Δ)가 곧 파츠가 밀리는 양이다. Δ≈0 이면 원인은 다른 데 있다.
   (1-5: 판단에 쓰이는 항을 하나도 빠짐없이, 비교 대상과 함께 찍는다) */
function _diagRiggedPartAlignment(cat, skinnedMeshes, charRoot){
  try{
    if(!charRoot || !skinnedMeshes || !skinnedMeshes.length) return;
    // 캐릭터 자신의 boneInverse 수집 (본 이름 → Matrix4). 파츠 메쉬(__part…)는 제외.
    const charInv = {};
    charRoot.traverse(o=>{
      if(!o.isSkinnedMesh || !o.skeleton || String(o.name||'').startsWith('__part')) return;
      const sk = o.skeleton;
      (sk.bones||[]).forEach((b,i)=>{
        if(b && b.name && !charInv[b.name] && sk.boneInverses && sk.boneInverses[i]) charInv[b.name] = sk.boneInverses[i];
      });
    });
    const _pos = m4 => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(m4).invert());
    const rows = [];
    let maxD = 0, maxName = '';
    skinnedMeshes.forEach(sm=>{
      const sk = sm.skeleton; if(!sk) return;
      (sk.bones||[]).forEach((b,i)=>{
        const pInv = sk.boneInverses && sk.boneInverses[i]; if(!b || !pInv) return;
        const cInvM = charInv[b.name];
        const p = _pos(pInv);
        if(!cInvM){ rows.push(b.name+': 파츠 '+p.toArray().map(v=>v.toFixed(2)).join('/')+' (캐릭터 쪽 기준 없음 — 입양 본)'); return; }
        const c = _pos(cInvM);
        const d = p.distanceTo(c);
        if(d > maxD){ maxD = d; maxName = b.name; }
        rows.push(b.name+': 파츠 '+p.toArray().map(v=>v.toFixed(2)).join('/')
          +' vs 캐릭터 '+c.toArray().map(v=>v.toFixed(2)).join('/')+'  Δ'+d.toFixed(3));
      });
    });
    if(!rows.length) return;
    const verdict = (maxD > 0.05)
      ? ('⚠️ boneInverse 불일치 — 최대 Δ'+maxD.toFixed(3)+' ('+maxName+'). 이 값만큼 파츠가 밀립니다. '
         +'파츠를 캐릭터 아마추어 그대로, 아마추어를 옮기지 않은 상태로 다시 export하면 해결됩니다.')
      : '✅ boneInverse는 캐릭터와 일치 — 파츠가 떠 보인다면 원인은 여기가 아닙니다.';
    console.log('[파츠 리깅정렬] '+cat+' — '+verdict+'\n    ' + rows.join('\n    '));
  }catch(e){ console.warn('[파츠 리깅정렬] 진단 실패', e); }
}
/* 🎩 파츠 "저작(모델링) 오프셋" 자동 상쇄 — 핸드오프 3장 0번 "head bone 파츠 공중부양" 수정.

   [증상] 모자·머리장식 중 일부가 캐릭터 머리에서 한참 위(대략 캐릭터 키만큼)에 떠서 붙는다.
   [원인] 비리깅 파츠는 obj.position.sub(center) 와 wrapper.position=baseCenter(+center)가
          서로 상쇄돼 net 0이다. 이 분리는 회전·크기의 피봇을 메쉬 중심에 두려는 목적이지
          위치 보정이 아니다. 결과적으로 파츠는 "자기가 모델링된 좌표 그대로" head 본의 자식이 된다.
          모델러가 원점 근처에서 만들었으면 본 위에 앉지만, 캐릭터에 씌운 상태로(머리 높이 ≈1.4)
          export하면 [본 높이] + [저작 높이]가 겹쳐서 그만큼 위로 뜬다.
          커미션 캐릭터는 본 이름이 표준과 달라 리깅 판정에서 떨어지기 쉬워 특히 잘 나타난다.
   [수정] 파츠가 "캐릭터에 씌운 채 저작된 것"으로 판정되면, 그 저작 좌표를 본 로컬 좌표로 환산해
          차이(authorOff)를 wrapper 위치에서 빼준다. 즉 파츠는 저작 당시 보이던 그 자리에 앉는다.

   ⚠️ 원점 기준으로 저작된 기존 파츠(대다수)는 절대 건드리면 안 된다. 그래서 핸드오프가 적어둔
      "baseCenter를 무조건 0으로"(방안 2)를 쓰지 않고, 아래 3중 판정을 전부 통과할 때만 보정한다.
      애매하면 보정하지 않는다 = 기존 동작 유지.
        1) 캐릭터 본들이 모델 원점에서 충분히 떨어져 있다 — 다 원점 근처면 2·3을 구분할 수 없다
        2) 파츠 중심도 모델 원점에서 충분히 떨어져 있다   — 원점 근처면 원점 기준 저작이 확실
        3) 파츠 중심이 원점보다 '가장 가까운 캐릭터 본'에 뚜렷하게(2배 이상) 가깝다 — 결정적 신호
      '충분히'의 기준은 파츠 자신의 최대 변(maxDim)이라 스케일 불변이다.
      (1-3 대응: 눈으로 맞춘 절대 상수를 새로 만들지 않기 위한 선택. 파츠 크기가 달라도 판정이 안 흔들린다)

   ★ 3)은 처음에 '부착 본(info.bone)'까지의 거리로 쟀는데 그게 틀렸다(1-4: 이름 말고 무엇을 재는지 볼 것).
     판정의 목적은 "이 파츠가 캐릭터에 씌워진 채 저작됐나"이지 "부착 본 바로 옆에 있나"가 아니다.
     후광·귀·날개처럼 부착 본에서 멀찍이 떨어진 자리에 저작된 파츠가 통째로 미발동했다. 실측:
       angelring (본 없는 후광, 중심 y=4.635, maxDim 2.315)
         head까지 2.651 ≥ 임계 2.317 → ❌ 미발동(버그 그대로) / 최근접 ear_L까지 1.225 → ✅ 발동
       kuma (곰 귀, 중심 y=3.849, maxDim 2.789)
         head까지 1.889 vs 임계 1.939 → 여유 2.5%로 아슬아슬 / 최근접 ear_L까지 0.762 → ✅ 여유 있게
     거리는 **가장 가까운 캐릭터 본**으로 재고, 보정량은 그대로 **부착 본 기준**으로 만든다
     (wrapper가 실제로 매달리는 곳이 부착 본이므로).

   ※ 1-2 주의: 여기 쓰는 bb는 equipPartOnSeat가 피봇용으로 만든 것과 '같은' 박스다(visible 검사 없음,
     SkinnedMesh는 바인드 포즈). 보정 후 피봇과 실제 위치가 어긋나지 않으려면 반드시 같은 값이어야 하므로
     의도적으로 공유한다. bb 측정 방식을 고칠 땐 equipPartOnSeat와 여기를 함께 고칠 것.
   ※ 본의 '현재 자세'로 환산한다. 부착 시점 자세가 오프셋에 굳지만, 머리 본은 idle에서 rest에 가깝다. */
/* 🎀 파츠를 캐릭터에 붙일 한 벌로 만들기(복제 · 재질 · _col · _pic · 리깅 판정 · 다시 묶기 · wrapper · 저작 오프셋)는 캐릭터 코어(src/parts.ts · #436).
   좌석 몫(장착 차례 · 옷 겹침 · 귀 까닥임 · 애니메이션 · 진단)은 equipPartOnSeat 에 남는다. */
const partsCore = TwCharCore.createParts({
  THREE,
  tone: lightToneMod.toneCore,
  applyPartMatTone: (m)=>lightToneMod._applyPartMatTone(m),
  forceOpaqueAlphaOutput: (m)=>partSceneMod._forceOpaqueAlphaOutput(m),
  meshIsPic: (o)=>partPaintMod.meshIsPic(o),
  picRepairUV: (o)=>partPaintMod._picRepairUV(o),
  uvLooksBroken: (o)=>partPaintMod.g_uvLooksBroken(o),
});
/* 🎀 파츠 저작 오프셋 · xf 적용(character/part-xf.js) — 아래 const 는 옛 전역 이름이다. */
const partXfMod = TwPartXf.createPartXf({
  partsCore: partsCore,
  PART_DEFAULT_OFFSET: PART_DEFAULT_OFFSET,
  premiumMod: premiumMod,
  partPaintMod: partPaintMod,
  lightToneMod: lightToneMod,
  bodyMeasureMod: bodyMeasureMod,
  charMeasureMod: charMeasureMod,
  instantiateBase: (...a)=>instantiateBase(...a),
});
const _computePartAuthorOffset = partXfMod._computePartAuthorOffset;   // 옛 전역 이름
const _diagPartHeadSpace = partXfMod._diagPartHeadSpace;   // 옛 전역 이름
const _computeAnimalHeadDy = partXfMod._computeAnimalHeadDy;   // 옛 전역 이름
const _isLegacyAuthorCompensation = partXfMod._isLegacyAuthorCompensation;   // 옛 전역 이름
const _applyXfToWrapper = partXfMod._applyXfToWrapper;   // 옛 전역 이름
const applyPartXf = partXfMod.applyPartXf;   // 옛 전역 이름
// wrapper 하나를 씬에서 정리하는 공통 로직 — 파츠 제거 시 공통 처리.
//   unequipPartFromSeat (단일 파츠 카테고리 초기화)와 unequipStackablePart (특정 id만) 양쪽에서 사용.
/* 🎀 파츠 붙이기 · 떼기 · def 대조(character/part-equip.js) — 아래 const 는 옛 전역 이름이다. */
const partEquipMod = TwPartEquip.createPartEquip({
  premiumMod: premiumMod,
  rideBenchMod: rideBenchMod,
  seatRefitMod: seatRefitMod,
  skelShare: skelShare,
  partsCore: partsCore,
  partSceneMod: ()=>partSceneMod,
  boneSide: (...a)=>boneSide(...a),
  _diagRiggedPartAlignment: (...a)=>_diagRiggedPartAlignment(...a),
  _applyXfToWrapper: _applyXfToWrapper,
  _computeAnimalHeadDy: _computeAnimalHeadDy,
  _computePartAuthorOffset: _computePartAuthorOffset,
  _diagPartHeadSpace: _diagPartHeadSpace,
  applyPartXf: applyPartXf,
  _unequipClothCat: _unequipClothCat,
  applyClothVisibility: applyClothVisibility,
  _clipHasMotion: _clipHasMotion,
  _partAnimNotice: _partAnimNotice,
  _pickPartClip: _pickPartClip,
  _setupPartIdleAnim: _setupPartIdleAnim,
  _stripPartClipOwnedTracks: _stripPartClipOwnedTracks,
  _teardownPartIdleAnim: _teardownPartIdleAnim,
});
const extractBonesInto = partEquipMod.extractBonesInto;   // 옛 전역 이름
const equipPartOnSeat = partEquipMod.equipPartOnSeat;   // 옛 전역 이름
const unequipPartFromSeat = partEquipMod.unequipPartFromSeat;   // 옛 전역 이름
const unequipStackablePart = partEquipMod.unequipStackablePart;   // 옛 전역 이름
const pruneSeatPartsAgainstDef = partEquipMod.pruneSeatPartsAgainstDef;   // 옛 전역 이름
const applyEquippedPartsToSeat = partEquipMod.applyEquippedPartsToSeat;   // 옛 전역 이름
const _invalidatePendingEquip = partEquipMod._invalidatePendingEquip;   // 옛 전역 이름
const _disposeWrapperFromSeat = partEquipMod._disposeWrapperFromSeat;   // 옛 전역 이름
const _sweepOrphanPartWrappers = partEquipMod._sweepOrphanPartWrappers;   // 옛 전역 이름

/* ============================================================ CREATOR + LAUNCHER */
/* 🧍 캐릭터 저장 슬롯 개수. 3 → 5 (요청).
   ★ 여기 하나만 고치면 되도록 서버에서 받아 앉히는 순회(applySlotObjs) · 런처 (n/N) 라벨 · ◀▶ 순환이
     전부 이 상수를 본다. 숫자를 다시 흩뿌리지 말 것 — 한 곳만 빠뜨리면 "칸은 보이는데
     저장이 안 되는" 종류의 사고가 난다(서버 슬롯 칸 수도 5 — 바꾸려면 서버 규격과 같이).
   ⚠️ extraSeatSlots(솔로모드 자리추가)는 슬롯 번호 목록이라 자동으로 최대 4석까지 늘어난다.
     layoutSeats 는 인원 수 상한이 없고(방은 이미 10명) 간격·줌을 실측으로 잡으므로 그대로 돈다. */
const CHAR_SLOT_MAX=5;
const slots=new Array(CHAR_SLOT_MAX).fill(null);
/* 🛡️ [얼굴 영구 소실 방어 · 기억] 칸마다 «이 캐릭터는 그림을 가진 적이 있다».
   켜지는 곳은 둘뿐이다 — applySlotObjs(서버에서 받을 때 그림이 있었다) · saveSlots(멀쥰한 그림을 저장했다).
   꺼지는 곳은 하나뿐이다 — 생성기에서 사용자가 «비운 채 저장»을 직접 확인했을 때.
   이 값이 true 인 칸에 빈 그림이 저장되려 하면 그건 사용자의 뜻이 아니라 사고다. */
const _faceEverDrawn  = new Array(CHAR_SLOT_MAX).fill(false);
const _blinkEverDrawn = new Array(CHAR_SLOT_MAX).fill(false);
let _blankFaceConfirmed = false;   // 생성기에서 «비운 채 저장»을 확인한 직후, 바로 뒤 saveSlots 1회만 소비
const CUR_SLOT_KEY='tw.curSlot';
function _loadCurSlot(){ try{ const v=parseInt(accountStoreMod.get(CUR_SLOT_KEY),10); if(v>=0&&v<CHAR_SLOT_MAX) return v; }catch(e){} return 0; }   // 계정 칸 — 확인 뒤(userLocal 조각 curSlot)에만 부른다
function saveCurSlot(){ try{ accountStoreMod.set(CUR_SLOT_KEY, String(curSlot)); }catch(e){} }
/* 🪑 책상 크기 슬라이더의 **기본값** — 흩어져 있던 0.175 리터럴의 단 하나의 출처.
   [왜 상수가 필요해졌나] '책상 위' 파츠가 이 슬라이더를 따라 커지고 작아지는 것을 끊으면서
     "무엇을 기준으로 안 따라가는가"를 정해야 했다. 답이 이 값이다 — 슬라이더가 기본값일 때가
     파츠 크기의 기준이고, 거기서 움직인 몫만 syncDeskPartAnchor 가 상쇄한다.
     그래서 이 값이 흔들리면 **파츠 크기의 기준 자체가 흔들린다.** 리터럴로 흩어 두면 안 된다.
   ⚠️ HTML 슬라이더(`#deskScale` 의 `value="0.175"`)와 **같은 값이어야 한다.** 거기는 마크업이라
     이 상수를 못 읽는다 — 바꿀 때 두 곳을 같이 본다(HTML 쪽에도 이 주석을 걸어 뒀다).
   ⚠️ 슬라이더 범위(DESK_SCALE_MIN·MAX)는 clampDeskScale 옆에 따로 있다. 이 값은 그 사이여야 한다. */
const DESK_SCALE_DEFAULT = 0.175;
/* 🧍 생성기 상태(세션 값 58개) — 본문은 creator/creator-state.js(C 구역 떼기 w4). 읽기 · 쓰기는 crState.이름 — 처음 값도 거기 한 곳.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const crState = TwCreatorState.createCreatorState({
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,
});
let curSlot=0;   // 만들 때는 읽지 않는다(계정 칸은 확인 전엔 닫혀 있다) — 확인 뒤 userLocal 의 curSlot 조각이 _loadCurSlot 로 채운다
/* 본문은 creator/creator-face.js 로 옮겼다(앱 FSD · app.js 분리 T7) — 얼굴 · 피부 캔버스 · 몸 만들기. 코어를 부르는 얇은 이름이다. */
const creatorFaceMod = TwCreatorFace.createCreatorFace({
  bodyCore: bodyCore,
  mkFaceTex: mkFaceTex,
  skelShare: skelShare,
  COMMISSION_SCALE_CORRECTION: COMMISSION_SCALE_CORRECTION,
  _attachHumanEars: (...a)=>_attachHumanEars(...a),
  animalBuilder: ()=>window.buildAnimalBase,
});
const CANVAS_SZ = creatorFaceMod.CANVAS_SZ;   // 옛 전역 이름
const FACE_SYM_SUM = creatorFaceMod.FACE_SYM_SUM;   // 옛 전역 이름
const SYM_PX = creatorFaceMod.SYM_PX;   // 옛 전역 이름
const newCanvas = creatorFaceMod.newCanvas;   // 옛 전역 이름
const _isBlankDraw = creatorFaceMod._isBlankDraw;   // 옛 전역 이름
const snapCanvas = creatorFaceMod.snapCanvas;   // 옛 전역 이름
const SKIN_COLORS = creatorFaceMod.SKIN_COLORS;   // 옛 전역 이름
const skinCanvases = creatorFaceMod.skinCanvases;   // 옛 전역 이름
const skinCanvasFor = creatorFaceMod.skinCanvasFor;   // 옛 전역 이름
const skinColorFor = creatorFaceMod.skinColorFor;   // 옛 전역 이름
const compositeFace = creatorFaceMod.compositeFace;   // 옛 전역 이름
const charDef = creatorFaceMod.charDef;   // 옛 전역 이름
const buildCreatorBase = creatorFaceMod.buildCreatorBase;   // 옛 전역 이름
const defToBase = creatorFaceMod.defToBase;   // 옛 전역 이름
/* --- 캐릭터에 직접 페인팅 (3D) + 단계형 + 양파껍질 + 되돌리기 --- */
const faceC=newCanvas(), blinkC=newCanvas();      // 저장 레이어(깨끗한 원본)
const dispC=newCanvas();                          // 모델에 보이는 합성 텍스처(양파껍질 포함)
const dispTex=new THREE.CanvasTexture(dispC); dispTex.flipY=false;dispTex.encoding=THREE.sRGBEncoding;
let creatorMode={kind:'slot',edit:false};
function isCommissionEditing(){ return !!(crState.currentCreatorDef && crState.currentCreatorDef.isCommission); }
function isAnimalEditing(){ return !!(crState.currentCreatorDef && crState.currentCreatorDef.animal); }
function isDeskSeatOnly(){ return isCommissionEditing() || isAnimalEditing(); }   // 페인트 단계 없이 책상·좌석만 하는 캐릭터
/* 🐾 동물 편집 길잡이(animal-edit-route.js) — 모양은 동물 생성기, 책상·좌석은 여기 5·6단계.
   모듈이 없으면(검사가 app.js 만 평가할 때 등) null — gotoStep · openCreator 가 예전처럼 책상부터 연다. */
const _editRoute = (typeof window!=='undefined' && window.AnimalEditRoute) || null;
/* 사람 생성기를 닫고 지금 편집 중인 동물을 동물 생성기로 연다(같은 슬롯·좌석 — creatorMode 를 animal.js 가 읽는다).
   tab: 동물 생성기에서 처음 보일 탭 — 책상에서 돌아갈 땐 마지막(감은눈), 처음 들어갈 땐 얼굴. */
function reopenAnimalFromCreator(tab){
  const def=crState.currentCreatorDef;
  document.getElementById('creatorOverlay').classList.remove('on'); creatorOpen=false;
  if(typeof window.reopenAnimalCreator==='function'){ window.reopenAnimalCreator(def, {tab}); return true; }
  return false;
}

/* 🗂 책상 · 좌석 세팅 프리셋(5칸 · 모든 캐릭터 칸 공용) — 저장은 creator/desk-preset-store.js, 담기 · 적용 · 칸 화면은 creator/desk-preset.js(C 구역 떼기 w4).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskPresetStoreMod = TwDeskPresetStore.createDeskPresetStore({
  jsonStore: accountJsonStoreMod,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  isCatalogDesk: (id)=>commissionMod.catalogBacked(commissionMod.savedDesks().find(d=>d.id===id)),
});
/* 본문은 creator/desk-preset.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskPresetMod = TwDeskPreset.createDeskPreset({
  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  NO_DESK_ID: NO_DESK_ID,
  hideDeskBody: (...a)=>deskVisualMod.hideDeskBody(...a),
  applyCreatorXform: (...a)=>creatorPrevMod.applyCreatorXform(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),
  assetCodeMod: ()=>assetCodeMod,
  autoSaveDeskItemsNow: (...a)=>autoSaveDeskItemsNow(...a),
  b64ToBuf: (...a)=>b64ToBuf(...a),
  catalogGlbMod: ()=>catalogGlbMod,
  clampCharY: (...a)=>clampCharY(...a),
  clampDeskScale: (...a)=>clampDeskScale(...a),
  collectDeskItems: (...a)=>collectDeskItems(...a),
  commissionMod: ()=>commissionMod,
  crState: crState,
  crXformMod: ()=>crXformMod,
  customItems: ()=>customItems,
  deskItemsMod: ()=>deskItemsMod,
  deskPresetStoreMod: deskPresetStoreMod,
  equipDeskItem: (...a)=>equipDeskItem(...a),
  fitCreator: (...a)=>creatorPrevMod.fitCreator(...a),
  frameDeskCam: (...a)=>creatorPrevMod.frameDeskCam(...a),
  premiumMod: premiumMod,
  setCreatorDeskScale: (...a)=>deskPlaceMod.setCreatorDeskScale(...a),
  setDeskPos: (...a)=>deskPlaceMod.setDeskPos(...a),
  swapDeskVisual: (...a)=>deskVisualMod.swapDeskVisual(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
});
// ★ 책상 크기 슬라이더의 실제 min/max — HTML의 #deskScale range와 반드시 같은 값으로 맞춰야 함.
//   슬라이더 범위를 바꾼 적이 있어서, 그 이전 범위 기준으로 저장된 캐릭터의 deskScale이 새 범위를
//   벗어나 있을 수 있음(예: 옛날엔 0.34가 정상 범위였는데 지금은 최대 0.3) — 그대로 슬라이더에 넣으면
//   브라우저가 슬라이더 표시만 최대치로 잘라버려서 슬라이더가 이상하게 고정된 것처럼 보임.
//   그래서 불러올 때마다 이 범위로 확실히 clamp함.
const DESK_SCALE_MIN = 0.05, DESK_SCALE_MAX = 0.3;
function clampDeskScale(v){ return Math.max(DESK_SCALE_MIN, Math.min(DESK_SCALE_MAX, v)); }
/* 본문은 shared/paint-geom.js 로 옮겼다(C 구역 떼기 w4). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const paintGeomMod = TwPaintGeom.createPaintGeom({
});
/* 본문은 creator/paint-stroke.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const paintStrokeMod = TwPaintStroke.createPaintStroke({
  CANVAS_SZ: CANVAS_SZ,
  _crDropEraser: (...a)=>_crDropEraser(...a),
  actC: (...a)=>actC(...a),
  blit: (...a)=>blit(...a),
  crState: crState,
  isDrawStep: (...a)=>isDrawStep(...a),
  paintGeomMod: paintGeomMod,
  partPaintMod: partPaintMod,
  pushHistory: (...a)=>pushHistory(...a),
  swEl: ()=>swEl,
  toast: (...a)=>toast(...a),
});
/* 본문은 creator/stamp.js 로 옮겼다(C 구역 떼기 w4). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const crStampMod = TwCrStamp.createCrStamp({
  CANVAS_SZ: CANVAS_SZ,
  _crDropEraser: (...a)=>_crDropEraser(...a),
  actC: (...a)=>actC(...a),
  blit: (...a)=>blit(...a),
  crState: crState,
  isDrawStep: (...a)=>isDrawStep(...a),
  paintStrokeMod: paintStrokeMod,
  partPaintMod: partPaintMod,
  pushHistory: (...a)=>pushHistory(...a),
  toast: (...a)=>toast(...a),
});
/* 본문은 creator/creator-canvas.js 로 옮겼다(앱 FSD · app.js 분리 M20). 생성기 그림판(되돌리기 · 그리기 · 붓 · 카메라 키 · 색 · 피부)의 주인이다 — 듣기가 예전과 같은 때 걸린다. 뒤에서 선언되는 값은 읽는 함수로 다룬다. */
const creatorCanvasMod = TwCreatorCanvas.createCreatorCanvas({
  openCharColorPicker: (...a)=>window.openCharColorPicker(...a),
  bindHold: (...a)=>bindHold(...a),
  blinkC: blinkC,
  camTarget: ()=>camTarget,
  CANVAS_SZ: CANVAS_SZ,
  cBodyCenter: ()=>cBodyCenter,
  cFaceCenter: ()=>cFaceCenter,
  creatorOpen: ()=>creatorOpen,
  creatorPrevMod: ()=>creatorPrevMod,
  crStampMod: crStampMod,
  crState: crState,
  dispC: dispC,
  dispTex: dispTex,
  faceC: faceC,
  newCanvas: newCanvas,
  paintStrokeMod: paintStrokeMod,
  SKIN_COLORS: SKIN_COLORS,
  skinCanvases: skinCanvases,
  skinCanvasFor: skinCanvasFor,
  toast: (...a)=>toast(...a),
  wardrobeMod: wardrobeMod,
});
const _crDropEraser = creatorCanvasMod._crDropEraser;   // 옛 전역 이름
const histF = creatorCanvasMod.histF;   // 옛 전역 이름
const histB = creatorCanvasMod.histB;   // 옛 전역 이름
const redoF = creatorCanvasMod.redoF;   // 옛 전역 이름
const redoB = creatorCanvasMod.redoB;   // 옛 전역 이름
const isDrawStep = creatorCanvasMod.isDrawStep;   // 옛 전역 이름
const actC = creatorCanvasMod.actC;   // 옛 전역 이름
const blit = creatorCanvasMod.blit;   // 옛 전역 이름
const pushHistory = creatorCanvasMod.pushHistory;   // 옛 전역 이름
const bindPaint = creatorCanvasMod.bindPaint;   // 옛 전역 이름
const swEl = creatorCanvasMod.swEl;   // 옛 전역 이름
const _syncCrColorSwatches = creatorCanvasMod._syncCrColorSwatches;   // 옛 전역 이름
const loadSkins = creatorCanvasMod.loadSkins;   // 옛 전역 이름
document.getElementById('crNext').addEventListener('click',()=>creatorFlowMod.gotoStep(Math.min(6,crState.crStep+1)));
// 🐾 동물이 책상(5)에서 [이전] 을 누르면 gotoStep 이 동물 생성기로 돌려보낸다(1~4는 사람용 단계).
document.getElementById('crPrev').addEventListener('click',()=>creatorFlowMod.gotoStep(Math.max(1,crState.crStep-1)));
// 상단 3단계 스텝퍼 클릭으로 이동 (캐릭터=1, 책상=5, 좌석=6)
/* 1 피부 · 2 표정 · 3 감은눈 · 4 색상 — 눌러서 그 단계로(위 큰 탭과 같은 길). 동물 · 커미션은 gotoStep 이 알아서 돌려보낸다. */
[...document.getElementById('crSteps').children].forEach((el,i)=>{ el.style.cursor='pointer'; el.addEventListener('click',()=>creatorFlowMod.gotoStep(i+1)); });
[...document.getElementById('crStages').children].forEach(el=>{ el.addEventListener('click',()=>{
  const stg=+el.dataset.stg; creatorFlowMod.gotoStep(stg===0?Math.min(crState.crStep,4):(stg===1?5:6)); }); });
/* === 책상 세팅(5단계): 책상 색 + 책상 위 아이템(소품) + 위치조작 === */
/* 본문은 creator/asset-cards.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const assetCardsMod = TwAssetCards.createAssetCards({
  partSceneMod: ()=>partSceneMod,
});
/* 본문은 creator/desk-setup.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskSetupMod = TwDeskSetup.createDeskSetup({
  NO_DESK_ID: NO_DESK_ID,
  hideDeskBody: (...a)=>deskVisualMod.hideDeskBody(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  DEF_SIZE_TOAST_MS: ()=>creatorSaveMod.DEF_SIZE_TOAST_MS,
  DESK_ITEMS: DESK_ITEMS,
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,
  _creatorSizeGrow: (...a)=>creatorSaveMod._creatorSizeGrow(...a),
  _syncCrColorSwatches: (...a)=>_syncCrColorSwatches(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  assetCardsMod: assetCardsMod,
  assetCodeMod: ()=>assetCodeMod,
  autoSaveDeskItemsNow: (...a)=>autoSaveDeskItemsNow(...a),
  b64ToBuf: (...a)=>b64ToBuf(...a),
  catalogGlbMod: ()=>catalogGlbMod,
  catalogAdmin: catalogAdmin,
  clampDeskScale: (...a)=>clampDeskScale(...a),
  commissionMod: ()=>commissionMod,
  crState: crState,
  creatorOpen: ()=>creatorOpen,
  customItems: ()=>customItems,
  deskItemsMod: ()=>deskItemsMod,
  equipDeskItem: (...a)=>equipDeskItem(...a),
  isAdmin: ()=>isAdmin,
  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),
  lightToneMod: ()=>lightToneMod,
  ndc: ndc,
  premiumMod: premiumMod,
  ray: ray,
  setCreatorDeskScale: (...a)=>deskPlaceMod.setCreatorDeskScale(...a),
  swapDeskVisual: (...a)=>deskVisualMod.swapDeskVisual(...a),
  toast: (...a)=>toast(...a),
});
document.getElementById('deskScale').addEventListener('input',e=>{ crState.cDeskScale=+e.target.value; deskPlaceMod.setCreatorDeskScale(crState.cDeskScale); });   // 카메라 고정 — 책상 크기 가늠 쉽게
// 버튼을 꾹 누르고 있으면 뗄 때까지 계속 반복 실행 (첫 클릭은 즉시, 0.35초 뒤부터 빠르게 반복)
function bindHold(el, fn){
  let iv=null, delayTimer=null;
  const stop=()=>{ if(iv){clearInterval(iv);iv=null;} if(delayTimer){clearTimeout(delayTimer);delayTimer=null;} };
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); fn(); delayTimer=setTimeout(()=>{ iv=setInterval(fn,60); },350); });
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
}

/* 본문은 creator/creator-xform.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const crXformMod = TwCreatorXform.createCreatorXform({
  CHAR_Y_MAX: CHAR_Y_MAX,
  DESK_PART_ANCHOR_NAME: ()=>deskPlaceMod.DESK_PART_ANCHOR_NAME,
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,
  _applyItemColor: (...a)=>_applyItemColor(...a),
  applyCreatorXform: (...a)=>creatorPrevMod.applyCreatorXform(...a),
  applyDeskAdj: (...a)=>applyDeskAdj(...a),
  autoSaveDeskItemsNow: (...a)=>autoSaveDeskItemsNow(...a),
  baseFlatOf: (...a)=>lightToneMod.baseFlatOf(...a),
  bindHold: (...a)=>bindHold(...a),
  cBase: ()=>crState.cBase,
  cCam: ()=>crState.cCam,
  cDesk: ()=>crState.cDesk,
  cDeskLenX: ()=>crState.cDeskLenX,
  cDeskPos: ()=>crState.cDeskPos,
  cDeskScale: ()=>crState.cDeskScale,
  cRenderer: ()=>crState.cRenderer,
  cScene: ()=>crState.cScene,
  cXform: ()=>crState.cXform,
  clampCharY: (...a)=>clampCharY(...a),
  deskItemOrigin: deskItemOrigin,
  floorClampWrapper: (...a)=>charMeasureMod.floorClampWrapper(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  openAssetImport: (...a)=>twNav.go(twNav.NAV.ASSET_IMPORT, ...a),
  setCreatorDeskScale: (...a)=>deskPlaceMod.setCreatorDeskScale(...a),
  setDeskPos: (...a)=>deskPlaceMod.setDeskPos(...a),
  slotSaveMod: ()=>slotSaveMod,
  syncDeskPartAnchor: (...a)=>deskPlaceMod.syncDeskPartAnchor(...a),
  toast: (...a)=>toast(...a),
  setCDeskLenX: (v)=>{ crState.cDeskLenX = v; },
  setCDeskPos: (v)=>{ crState.cDeskPos = v; },
  setCDeskScale: (v)=>{ crState.cDeskScale = v; },
});
deskSetupMod.setHooks({   // 책상 세팅이 부르는 두 모듈 — 그 둘이 책상 카드를 다시 그리려고 deskSetupMod 를 불러서 deps 대신 여기서 잇는다
  openDeskRegister: (...a)=>adminPartReg.openDeskRegister(...a),
  attachItemGizmo: ()=>crXformMod.attachItemGizmoToActive(),
});
/* === 책상·아이템 코드: 생성(판매자) === */
/* 관리자가 쓰는 코드 굽는 창 셋(📦 책상·아이템 코드 · 🎁 커미션 캐릭터 · 🔐 암호화 GLB 불러오기)은 admin/admin-asset.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   셋이 app.js 여기저기 흩어져 있어 이 자리(첫 덩이)에서 한 번 만든다 — 모두 버튼 연결이라 거는 차례와 상관없다. 아래 코드로 추가하기(파일 열기)는 사용자 쪽이라 그대로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminAsset = TwAdminAsset.createAdminAsset({
  toast: (...a)=>toast(...a),
  encryptAssetCode: (...a)=>assetCodeMod.encryptAssetCode(...a),
  wrapAsset: (...a)=>assetCodeMod.wrapAsset(...a),
  _b64: (...a)=>codeCryptoMod._b64(...a),
  encryptCommission: (...a)=>commissionMod.encryptCommission(...a),
  unpackCommissionZip: (...a)=>commissionMod.unpackCommissionZip(...a),
  encryptBytes: (...a)=>assetCodeMod.encryptBytes(...a),
  decryptBytes: (...a)=>assetCodeMod.decryptBytes(...a),
  downloadBlob: (...a)=>charCodeMod.downloadBlob(...a),
  loadEncryptedGlbAsSeat: (...a)=>charCodeMod.loadEncryptedGlbAsSeat(...a),
  maxGlbBytes: ()=>commissionMod.MAX_GLB_BYTES,
  maxCommissionBytes: ()=>commissionMod.MAX_COMMISSION_BYTES,
});
document.getElementById('assetImpFileBtn').onclick=()=>document.getElementById('assetImpFileInput').click();
document.getElementById('assetImpFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ document.getElementById('assetImpCode').value=String(reader.result||'').trim(); toast('파일을 불러왔어요'); };
  reader.onerror=()=>toast('파일을 읽지 못했어요');
  reader.readAsText(f);
  e.target.value='';
});

/* === 커미션 캐릭터 코드: 생성(관리자만) === */
/* 커미션 캐릭터 코드 만들기 창(관리자)은 admin/admin-asset.js 로 옮겼다 — 만드는 줄은 «책상·아이템 코드: 생성(판매자)» 자리. 아래 코드 입력(파일 열기)은 사용자 쪽이라 그대로. */
document.getElementById('commImpFileBtn').onclick=()=>document.getElementById('commImpFileInput').click();
document.getElementById('commImpFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ document.getElementById('commImpCode').value=String(reader.result||'').trim(); toast('파일을 불러왔어요'); };
  reader.onerror=()=>toast('파일을 읽지 못했어요');
  reader.readAsText(f);
  e.target.value='';
});

/* === 책상·아이템 코드: 가져오기(생성기 안에서) === */
/* 본문은 creator/asset-import.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const assetImportMod = TwAssetImport.createAssetImport({
  twNav: twNav,
  DEF_SIZE_TOAST_MS: ()=>creatorSaveMod.DEF_SIZE_TOAST_MS,
  _creatorBuildDef: (...a)=>creatorSaveMod._creatorBuildDef(...a),
  _defSizeFile: (...a)=>creatorSaveMod._defSizeFile(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  assetCodeMod: ()=>assetCodeMod,
  codeCryptoMod: ()=>codeCryptoMod,
  commissionMod: ()=>commissionMod,
  crState: crState,
  creatorOpen: ()=>creatorOpen,
  customItems: ()=>customItems,
  deskItemsMod: ()=>deskItemsMod,
  equipDeskItem: (...a)=>equipDeskItem(...a),
  partSceneMod: ()=>partSceneMod,
  premiumMod: premiumMod,
  renderCrItems: (...a)=>deskSetupMod.renderCrItems(...a),
  setCreatorDeskScale: (...a)=>deskPlaceMod.setCreatorDeskScale(...a),
  swapDeskVisual: (...a)=>deskVisualMod.swapDeskVisual(...a),
  toast: (...a)=>toast(...a),
});
assetImportMod.onPartAdded(()=>wardrobeMod.renderWardrobe());   // 파츠를 넣으면 꾸미기 창을 다시 그린다(꾸미기가 이 창을 열기도 해서 deps 대신 구독)
/* 본문은 shared/light-tone.js 로 옮겼다(C 구역 떼기 w4) — 만드는 줄은 💡 조명 상수 바로 뒤(메인 씬 조명이 쓴다). */
const LIGHT_PRESET = lightToneMod.LIGHT_PRESET;   // 옛 전역 이름 — app.js 안에서 쓴다(animal.js 는 deps 로 받는다)

/* ===== 관리자 모드 =====
   진입: Ctrl(Mac 은 ⌘) 누른 채로 후원 · 캐릭터 생성 · 꾸미기 · 광고배너 중 하나를 한 번 클릭 → 비밀번호 창(bindAdminTrigger)
   비밀번호: 입력값의 SHA-256 을 ADMIN_PASS_HASH 와 비교한다.
   TODO: 비밀번호 교체. 비밀번호 대신 로그인 계정의 admins 등록 여부로 여는 방식 검토.
   세션 단위로만 유지 (브라우저 닫으면 자동 해제). 우상단에 🔧 배지 표시, 클릭하면 종료.
   관리자만 가능: 책상·아이템 코드 등록 (커미션 판매자 작업)
*/
const ADMIN_PASS_HASH = 'e33bd90cf3f9275efe7f408f8a435bbeadc9d22e42601d37b68dfba281661a35';
let isAdmin = false;

/* ═══════════════════════ 🎟️ 게이트 — 로그인 · 가입 (앱 접근 제한) ═══════════════════════
   0.13 — 로그인 없이 쓰는 길은 없다(ADR-0006). 가입 · 초대 코드 판정 · 초대권은 서버가 한다(초대 게이트 스위치는 서버 user.inviteGate —
   꺼져 있으면 초대 코드 없이 가입). 켤 때 판정 순서는 license-gate.js checkInviteGate 머리말.
──────────────────────────────────────────────────────────────────── */
let isPremium = false;   // 프리미엄 여부 — 여러 모듈이 읽어 app.js 에 둔다. 바꾸는 곳은 account-state.js 의 _setPremium 하나
/* 🪪 계정 핵심 상태(라이선스 저장 키 · 프리미엄 깃발 바꾸기 · 신원 놓음 · 다시 켜기)는 account-state.js 에 —
   계정 · 초대 게이트 · 내 정보 · 포커스 레벨이 서로를 바라보지 않게(모듈 순환 끊기 5). isPremium 은 여기(app.js) 그대로, 바꾸는 곳은 _setPremium 하나 */
const acctStateMod = TwAccountState.createAccountState({
  isPremium: ()=>isPremium,
  isAdmin: ()=>isAdmin,
  setIsPremium: (v)=>{ isPremium = v; },
});
/* 🔑 로그인 흐름(account/login-flow.js) — 로그인 → 서버 가입 확인(GET /v2/me) → realtime 켜기 · 서버에 닿지 못했을 때 기다리기. Auth 원시 · 서버 통로 · realtime 은 부를 때 찾는다. */
const userApiMod = TwUserApi.store;   // 🪪 계정 provider(account/user-api.js) — 서버 user · invite 길 · 화면 문구
TwVisitPing.createVisitPing({ callPing: ()=>userApiMod.visit(), win: window }).start();   // 📈 방문 기록 — 켤 때 한 번(로그인과 상관없이 · 실패는 삼킴)
const loginFlowMod = TwLoginFlow.createLoginFlow({
  userApi: userApiMod,
  translate: (e)=>TwApiErrors.translate(e),
  reasonOf: (e)=>TwUserApi.reasonOf(e),
  auth: {
    ready: ()=>new Promise((res)=>TwNetReady.whenNetReady(res)).then(()=>firebaseAPI.authReady()),
    user: ()=>(TwNetReady.isNetReady() ? firebaseAPI.authUser() : null),   // 준비 전엔 «로그인 모름» — 사본도 안 읽는다
    restoring: ()=>firebaseAPI.authRestoring(),
    answered: (ms)=>firebaseAPI.authAnswered(ms),
    signInGoogle: (tok)=>firebaseAPI.authSignInWithGoogle(tok),
    signInPassword: (code, pw)=>firebaseAPI.authSignInWithFriendCode(code, pw),
    signOut: ()=>firebaseAPI.authSignOut(),
    deleteNewLogin: (uid)=>firebaseAPI.authDeleteNewLogin(uid),
    identity: ()=>({ email: firebaseAPI.authCurrentEmail(), uid: firebaseAPI.authCurrentUid() }),
  },
  googleWindow: ()=>companion.signInWithGoogle(),
  askGoogle: (email)=>googleConfirmMod.ask(email, 'signup'),   // 처음 보는 구글로 가입하기 전에 묻기(google-confirm.js — 아래에서 만든다 · 부를 때 찾는다)
  rt: { start: (o)=>TwRtHub.store.start(o), stop: ()=>TwRtHub.store.stop(), bye: (why)=>TwRtHub.store.bye(why), onState: (fn)=>TwRtHub.store.onState(fn), isDeviceOff: (s)=>TwRtHub.isDeviceOff(s) },
  leaveRoom: ()=>Promise.resolve(Presence.active() ? twNav.go(twNav.NAV.LEAVE_ROOM) : null),   // 로그아웃 차례 — 방 leave 가 realtime 작별보다 먼저(방 모듈은 창 열기 통로로 — 순환 없이)
  pending: TwRequestId.createPending(),
  storage: localStorage,
  onSessionLost: (kind)=>deviceLostMod._onDeviceSessionLost(kind),
  forgetSession: ()=>TwApi.authed.forgetSession(),
  now: ()=>Date.now(),
  onConfirmed: (r, info)=>TwLoginDiag.store.confirmed(r, info),   // 🩺 켤 때 로그인 진단(account/login-diag.js)
});
/* 🚚 0.13 첫 실행(account/first-run-013.js) — 로그인 → 캐릭터 올리기 → 라이선스 키 → 포커스 옛 누적 → 이 PC 키 지우기. 라이선스 단계는 이 PC 의 옛 키를 서버에 등록한다(D8-3). */
/* 설정 › 라이선스로 가는 [설정 열기] 달린 안내 — 첫 실행 기기 가득 안내 · 자동 등록 기기 가득 안내가 같이 쓴다 */
const licenseSettingsToast = (msg)=>toast(msg, undefined, 7000, { label: '설정 열기', onClick: ()=>twNav.go(twNav.NAV.PROGRAM_SETTINGS, 'license') });
const firstRunMod = TwFirstRun013.createFirstRun({
  steps: {
    login: TwFirstRun013.loginStep(()=>loginFlowMod.mode() === 'in'),
    gacha: TwFirstRun013.gachaStep(),
    mallang: TwFirstRun013.mallangStep(localStorage),
    myhome: TwFirstRun013.myhomeStep(localStorage),
    legacySync: ()=>closetMod.legacyStep(),
    licenseKey: TwFirstRun013.licenseKeyStep({
      storage: localStorage,
      activate: (key)=>licensePremiumMod.activate(key),
      optOut: ()=>licensePremiumMod.optOutAtStart(),
      optOutKey: TwLicensePremium.OPT_OUT_KEY,
      fullNotice: TwLicensePremium.FULL_NOTICE,
    }),
    focus: TwFirstRun013.focusStep({
      storage: localStorage,
      userCode: ()=>getMyUserId(),
      cellName: (code, key)=>TwAccountStore.cellName(code, key),
      accrue: (sec)=>focusProgressMod.legacyAccrue(sec),
    }),
    chal: TwFirstRun013.chalStep({
      storage: localStorage,
      userCode: ()=>getMyUserId(),
      cellName: (code, key)=>TwAccountStore.cellName(code, key),
      adoptToday: (today)=>chalStoreMod.adoptLegacyToday(today),
    }),
  },
  storage: localStorage,
  userCode: ()=>getMyUserId(),
  notify: (msg, action)=>{ if(action === 'openSettings') licenseSettingsToast(msg); else toast(msg); },
});
/* 🔑 구글을 계정에 처음 붙이기 전에 묻는 창(google-confirm.js) — 초대 게이트 · 계정 · 구글 연결하기가 같이 쓴다 */
const googleConfirmMod = TwGoogleConfirm.createGoogleConfirm({
  storage: localStorage,
  friendCodeKey: MY_FRIEND_CODE_KEY,
  signInWithGoogle: ()=>companion.signInWithGoogle(),
});
/* 본문은 license-gate.js 로 옮겼다(앱 FSD 31번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const licenseGateMod = TwLicenseGate.createLicenseGate({
  googleConfirmMod: googleConfirmMod,
  refreshTheme: (...a)=>themeUiMod.refreshCustom(...a),
  refreshFont: (...a)=>fontUiMod.premiumChanged(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  FRIEND_CODE_LOGIN_RE: ()=>acctStateMod.FRIEND_CODE_LOGIN_RE,
  _loginDoFriendCode: (...a)=>accountMod._loginDoFriendCode(...a),
  _loginDoGoogle: (...a)=>accountMod._loginDoGoogle(...a),
  _enterAccount: (...a)=>accountMod._enterAccount(...a),
  twNav: twNav,
  _wipeAccountLocal: (...a)=>accountMod._wipeAccountLocal(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  loginFlowMod: loginFlowMod,
  userApiMod: userApiMod,
  inviteIds: TwRequestId.createPending(),
  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),
  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),
  awayPicMod: ()=>awayPicMod,
  creatorOpen: ()=>creatorOpen,
  getMyUserId: (...a)=>getMyUserId(...a),
  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),
  refreshCustomStatusMenuItem: (...a)=>refreshCustomStatusMenuItem(...a),
  refreshLauncherPreview: ()=>{ const lc=document.getElementById('launcher'); if(lc && lc.classList.contains('on') && slots[curSlot]) renderLauncher(); },
  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),
  renderCrItems: (...a)=>deskSetupMod.renderCrItems(...a),
  seats: seats,
  toast: (...a)=>toast(...a),
  onPremiumChanged: acctStateMod.onPremiumChanged,
  _acctRelaunchAfterDetach: (...a)=>acctStateMod._acctRelaunchAfterDetach(...a),
  takeLeft: ()=>acctStateMod.takeLeft(),
  _rcStore: (...a)=>acctStateMod._rcStore(...a),
});

/* 📊 전체 통계 · 🎟️ 초대권 지급(관리자) — admin/admin-users.js. 초대장 구역 모듈(license-gate.js) 밖, 여기서 만든다(모듈 연결은 app.js). */
const adminUsers = TwAdminUsers.createAdminUsers({
  toast: (...a)=>toast(...a),
  inviteGrantMax: licenseGateMod.INVITE_GRANT_MAX,
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
/* 🔑 프리미엄 판정(account/license-premium.js) — 서버 확인(GET /v2/me 의 premium)만 isPremium 에 반영한다. 시작은 켜는 차례(app-boot 의 licensePremium) 한 곳 —
   아니면 계정의 라이선스에 이 기기를 자동 등록해 본다(해제 표시 tw.licenseOptOut 이 있으면 안 한다).
   키 등록 · 이 기기 해제 버튼(license-key.js)도 여기를 부른다. */
const licensePremiumMod = TwLicensePremium.createLicensePremium({
  userApi: userApiMod,
  licenseApi: TwLicenseApi.store,
  deviceId: ()=>TwDeviceId.store.get(),
  deviceName: ()=>TwLicenseApi.deviceNameOf(navigator.userAgent),
  setPremium: (v)=>acctStateMod._setPremium(v),
  isPremium: ()=>isPremium,
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
  resetKnown: ()=>acctStateMod.resetPremium(),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  reasonOf: (e)=>TwUserApi.reasonOf(e),
  resetCustomStatus: ()=>{ if(userStatusMod.userStatus()==='custom') setUserStatus(null); },   // 프리미엄을 놓으면 커스텀 상태는 기본으로
  storage: localStorage,
  toast: (...a)=>toast(...a),
  toastFull: (msg)=>licenseSettingsToast(msg),
});

/* ═══ 🔐 라이선스 · 초대 게이트 시작 · 관리자 모드 진입 ═══ */
// 🎟️ 앱 시작 시 초대장 게이트 — firebaseAPI가 준비된 뒤에 확인.
//   원격 설정 inviteGate 가 false면 checkInviteGate가 즉시 통과시키므로 아무 일도 안 일어남.
//   ★ 이 PC 저장값이 있으면 기다리지 않는다 — 저장값으로 바로 판단하고, 새 값은 뒤에서 받아 다음 부팅부터.
//     저장값이 없을 때(처음 켠 PC)만 두 스위치의 첫 답을 최대 3초 기다린다 — 못 받으면 기본값(true · 예전 동작).
const REMOTE_FLAGS_WAIT_MS = 3000;
const MIN_APP_VER_WAIT_MS = 7000;   // 최소 버전 첫 답을 이만큼만 기다린다(update-flow.js 읽기 상한 8초보다 짧게) — 넘으면 막지 않는다
/* 🔄 켤 때 업데이트 흐름(update-flow.js) — 업데이트 창 → 공지 창 → 로그인. 강제 창이 뜨면 로그인으로 넘어가지 않는다. */
const _updRc = acctStateMod._rcStore();
const updateFlowMod = TwUpdateFlow.createUpdateFlow({
  readMin: ()=> _updRc ? _updRc.ready(null, MIN_APP_VER_WAIT_MS).then(()=>_updRc.minAppVer()) : null,
  getMin: ()=> _updRc ? _updRc.minAppVer() : null,
  onMinChange: (fn)=> _updRc ? _updRc.onChange((cur, key)=>{ if(key === 'minVersion') fn(); }) : ()=>{},
  getVersion: ()=>window.companion ? window.companion.getAppVersion() : null,
  companion: window.companion || null,
  ui: TwUpdateFlow.createUpdateDom(document),
  noticeOnce: (fn)=>noticeFeed.onceReady(fn),
  showNotice: (n, done)=>_showUpdateNoticeOnce(n, done),
});
/* 🔄 계정 판 맞추기(account/app-version-sync.js) — 시작은 계정 확인 뒤 app-boot 의 appVersion 차례. 더 새 판을 쓰는 기기가 있으면 업데이트 강제 창(문구만 다르다). */
const appVersionSyncMod = TwAppVersionSync.createAppVersionSync({
  authed: TwApi.authed,
  getVersion: ()=>window.TwAppVersion.ready,
  block: (my, highest)=>updateFlowMod.forceAccount(highest),
  warn: (...a)=>console.warn(...a),
});
/* 🛰 realtime 끊김 화면(realtime/rt-status-ui.js) — 다시 연결 중 띠 · 로그인 풀림 · 계정 로그아웃 · 업데이트 강제 · 점검 · 모르는 닫힘 */
TwRtStatusUi.createRtStatusUi({
  rt: TwRtHub.store, inRoom: ()=>Presence.active(), band: TwRtStatusUi.createRtBandDom(document),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toLogin: ()=>accountMod._loginDoLogout({ force:true }).then(()=>acctStateMod._acctRelaunchAfterDetach(null)),   // 다시 켜면 게이트가 로그인 화면
  withdrawing: ()=>accountMod.withdrawing(),
  forceUpdate: ()=>updateFlowMod.forceProtocol(),
  maintenance: (retry, onDismiss)=>TwMaintenance.store.serverClosed(retry, onDismiss),
  setTimeout: (f, ms)=>setTimeout(f, ms), clearTimeout: (h)=>clearTimeout(h),
});
/* 켤 때 업데이트 · 공지 확인 — Firebase 준비를 기다리지 않고 바로, 로그인과 같이 돈다(firebase-init 이 깨진 판도 새 판 확인 · 받기로 고칠 수 있게).
   계정 기능은 app-boot 가 이 결과(proceed)를 기다린다 — 강제 업데이트면 이 PC 등록 · 읽기 · realtime 이 모두 0 */
const updateFlowP = updateFlowMod.runBeforeLogin();
(function initInviteGate(){
  const run = async ()=>{
    const _s = acctStateMod._rcStore();
    if(_s && _s.source() === 'default'){ try{ await _s.ready(['inviteGate'], REMOTE_FLAGS_WAIT_MS); }catch(_){} }
    licenseGateMod.checkInviteGate()   // 🔑 로그인 · 서버 가입 확인 → 게이트(필요하면) · realtime · 0.13 첫 실행
      .catch(err=>{ console.warn('[invite] 게이트 확인 실패', err); });
  };
  TwNetReady.whenNetReady(run);
})();
/* 🔐 관리자 모드(비밀번호 창 · 켜기 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl·⌘+클릭 진입)는 admin/admin-mode.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   isAdmin 을 바꾸는 곳은 그 모듈 하나다(setIsAdmin). savedParts 는 뒤에서 선언되는 let 이라 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminMode = TwAdminMode.createAdminMode({
  toast: (...a)=>toast(...a),
  refreshInviteBtn: (...a)=>licenseGateMod.refreshInviteBtn(...a),
  adminPassHash: ADMIN_PASS_HASH,
  isAdmin: ()=>isAdmin,
  setIsAdmin: (v)=>{ isAdmin = v; },
  twNav: twNav,
  session: ()=>appBoot.getSession(),
  identity: ()=>loginFlowMod.identity(),
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
});
/* ═══ 💡 얼굴 텍스처 갈아끼우기 · 생성기 조명 ═══ */
/* 본문(setFaceMap · applyLightPresetToInstance)은 character/mat-tone.js 로 옮겼다(C 구역 떼기 · w3).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const matToneMod = TwMatTone.createMatTone({
  tone: lightToneMod.toneCore,
});
/* 🧍 생성기 상태 — 생성기 묶음 전체(그리기 · 책상 · 기즈모 · animal.js)가 같이 읽고 쓴다. 모듈(creator-preview · creator-flow · creator-save)은 읽는 · 쓰는 함수로 받는다. */
let creatorOpen=false;
const camTarget=new THREE.Vector3(0,1.2,0);
const cFaceCenter=new THREE.Vector3(0,1.2,0), cBodyCenter=new THREE.Vector3(0,0.85,0);
/* 본문은 creator/creator-preview.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const creatorPrevMod = TwCreatorPreview.createCreatorPreview({
  ANIMAL_HAND_REST: ANIMAL_HAND_REST,
  BASE_SCENE: ()=>bodyCore.baseScene(),
  CHAR_Z: CHAR_Z,
  COMMISSION_SCALE_CORRECTION: COMMISSION_SCALE_CORRECTION,
  CREATOR_LIGHT_SL: lightToneMod.CREATOR_LIGHT_SL,
  FLAT_EMISSIVE: lightToneMod.FLAT_EMISSIVE,
  FOCUS_ARM_LIFT: ()=>FOCUS_ARM_LIFT,
  HAND_REST: ()=>HAND_REST,
  LIGHT_PRESET: lightToneMod.LIGHT_PRESET,
  M: M,
  _setDeskMatColor: (...a)=>lightToneMod._setDeskMatColor(...a),
  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  allDeskItems: (...a)=>deskItemsMod.allDeskItems(...a),
  bindPaint: (...a)=>bindPaint(...a),
  boneSide: (...a)=>boneSide(...a),
  buildCreatorBase: (...a)=>buildCreatorBase(...a),
  buildDesk: (...a)=>buildDesk(...a),
  cAmb: ()=>crState.cAmb,
  cBase: ()=>crState.cBase,
  cBodyCenter: cBodyCenter,
  cBodyDist: ()=>crState.cBodyDist,
  cBotColor: ()=>crState.cBotColor,
  cCam: ()=>crState.cCam,
  cDesk: ()=>crState.cDesk,
  cDeskColor: ()=>crState.cDeskColor,
  cDeskMat: ()=>crState.cDeskMat,
  cFaceCenter: cFaceCenter,
  cFaceDist: ()=>crState.cFaceDist,
  cFill: ()=>crState.cFill,
  cFloor: ()=>crState.cFloor,
  cKey: ()=>crState.cKey,
  cRenderer: ()=>crState.cRenderer,
  cScene: ()=>crState.cScene,
  cTopColor: ()=>crState.cTopColor,
  cXform: ()=>crState.cXform,
  camDist: ()=>crState.camDist,
  camPitch: ()=>crState.camPitch,
  camTarget: camTarget,
  camYaw: ()=>crState.camYaw,
  charFootFix: (...a)=>charMeasureMod.charFootFix(...a),
  clampCharY: (...a)=>clampCharY(...a),
  compositeFace: (...a)=>compositeFace(...a),
  crStep: ()=>crState.crStep,
  creatorOpen: ()=>creatorOpen,
  deskCamSaved: ()=>crState.deskCamSaved,
  deskItemOrigin: deskItemOrigin,
  dispTex: dispTex,
  equipDeskItem: (...a)=>equipDeskItem(...a),
  extractBonesInto: (...a)=>extractBonesInto(...a),
  faceCamSaved: ()=>crState.faceCamSaved,
  getCommissionScene: (...a)=>getCommissionScene(...a),
  instantiateBase: (...a)=>instantiateBase(...a),
  isAnimalEditing: (...a)=>isAnimalEditing(...a),
  isCommissionEditing: (...a)=>isCommissionEditing(...a),
  matToneMod: matToneMod,
  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),
  measureUnderfootDepth: (...a)=>charMeasureMod.measureUnderfootDepth(...a),
  mkFaceTex: (...a)=>mkFaceTex(...a),
  normalizeModel: (...a)=>normalizeModel(...a),
  runLightInts: (...a)=>lightToneMod.runLightInts(...a),
  sizeFloorTo: (...a)=>sizeFloorTo(...a),
  skinColorFor: (...a)=>skinColorFor(...a),
  skinIndex: ()=>crState.skinIndex,
  toast: (...a)=>toast(...a),
  setCAmb: (v)=>{ crState.cAmb = v; },
  setCBase: (v)=>{ crState.cBase = v; },
  setCBodyDist: (v)=>{ crState.cBodyDist = v; },
  setCCam: (v)=>{ crState.cCam = v; },
  setCDesk: (v)=>{ crState.cDesk = v; },
  setCDeskMat: (v)=>{ crState.cDeskMat = v; },
  setCFaceDist: (v)=>{ crState.cFaceDist = v; },
  setCFill: (v)=>{ crState.cFill = v; },
  setCFloor: (v)=>{ crState.cFloor = v; },
  setCKey: (v)=>{ crState.cKey = v; },
  setCRenderer: (v)=>{ crState.cRenderer = v; },
  setCScene: (v)=>{ crState.cScene = v; },
  setCamDist: (v)=>{ crState.camDist = v; },
  setCamPitch: (v)=>{ crState.camPitch = v; },
  setCamYaw: (v)=>{ crState.camYaw = v; },
  setDeskCamSaved: (v)=>{ crState.deskCamSaved = v; },
  setFaceCamSaved: (v)=>{ crState.faceCamSaved = v; },
});
/* (C 구역 떼기 · w3) 이 자리의 본문도 character/mat-tone.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🧍 생성기 미리보기 — 렌더러 · 카메라 · 열기 · 닫기 · 완료 ═══ */
/* (C 구역 떼기 · w3) 이 자리의 본문도 creator/creator-preview.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 본문은 creator/creator-flow.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const creatorFlowMod = TwCreatorFlow.createCreatorFlow({
  CANVAS_SZ: CANVAS_SZ,
  _editRoute: _editRoute,
  _syncCrColorSwatches: (...a)=>_syncCrColorSwatches(...a),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  blinkC: blinkC,
  blinkEdited: ()=>crState.blinkEdited,
  blit: (...a)=>blit(...a),
  cBodyCenter: cBodyCenter,
  cBodyDist: ()=>crState.cBodyDist,
  cDesk: ()=>crState.cDesk,
  cFaceCenter: cFaceCenter,
  cFaceDist: ()=>crState.cFaceDist,
  cXform: ()=>crState.cXform,
  camDist: ()=>crState.camDist,
  camPitch: ()=>crState.camPitch,
  camTarget: camTarget,
  camYaw: ()=>crState.camYaw,
  clampCharY: (...a)=>clampCharY(...a),
  clearStampState: (...a)=>crStampMod.clearStampState(...a),
  crStep: ()=>crState.crStep,
  creatorMode: ()=>creatorMode,
  creatorOpen: ()=>creatorOpen,
  creatorPrevMod: creatorPrevMod,
  currentCreatorDef: ()=>crState.currentCreatorDef,
  deskCamSaved: ()=>crState.deskCamSaved,
  deskItemOrigin: deskItemOrigin,
  detachItemGizmo: (...a)=>crXformMod.detachItemGizmo(...a),
  faceC: faceC,
  faceCamSaved: ()=>crState.faceCamSaved,
  histB: histB,
  isAnimalEditing: (...a)=>isAnimalEditing(...a),
  isCommissionEditing: (...a)=>isCommissionEditing(...a),
  isDeskSeatOnly: (...a)=>isDeskSeatOnly(...a),
  isDrawStep: (...a)=>isDrawStep(...a),
  redoB: redoB,
  renderLauncher: (...a)=>renderLauncher(...a),
  reopenAnimalFromCreator: (...a)=>reopenAnimalFromCreator(...a),
  setStampMode: (...a)=>crStampMod.setStampMode(...a),
  showEl: (...a)=>showEl(...a),
  stampMode: ()=>crState.stampMode,
  toast: (...a)=>toast(...a),
  setCamDist: (v)=>{ crState.camDist = v; },
  setCamPitch: (v)=>{ crState.camPitch = v; },
  setCamYaw: (v)=>{ crState.camYaw = v; },
  setCrStep: (v)=>{ crState.crStep = v; },
  setCreatorOpen: (v)=>{ creatorOpen = v; },
});
creatorFlowMod.onItemsStep(()=>deskSetupMod.renderCrItems());   // 5단계 아이템 목록 — 구독으로 잇는다(creator-flow ↔ desk-setup 순환 없게)
/* 본문은 creator/creator-open.js 로 옮겼다(앱 FSD · app.js 분리 M21). 생성기 여는 입구 · 런처 다시 그리기의 주인이다. 뒤에서 선언되는 값은 읽는 · 쓰는 함수로 다룬다. */
const creatorOpenMod = TwCreatorOpen.createCreatorOpen({
  acctStateMod: acctStateMod,
  closeWardrobe: (...a)=>window.closeWardrobe(...a),
  _editRoute: _editRoute,
  _syncCrColorSwatches: _syncCrColorSwatches,
  applyDeskItemsTo: applyDeskItemsTo,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  applyEquippedPartsToSeat: applyEquippedPartsToSeat,
  assetCodeMod: ()=>assetCodeMod,
  b64ToBuf: b64ToBuf,
  blinkC: blinkC,
  CANVAS_SZ: CANVAS_SZ,
  catalogGlbMod: ()=>catalogGlbMod,
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  clampCharY: clampCharY,
  clampDeskScale: clampDeskScale,
  commissionMod: ()=>commissionMod,
  creatorFlowMod: creatorFlowMod,
  creatorMode: ()=>creatorMode,
  setCreatorMode: (v)=>{ creatorMode = v; },
  setCreatorOpen: (v)=>{ creatorOpen = v; },
  creatorPrevMod: creatorPrevMod,
  crState: crState,
  crXformMod: crXformMod,
  curSlot: ()=>curSlot,
  setCustomItems: (v)=>{ customItems = v; },
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,
  deskItemsMod: ()=>deskItemsMod,
  deskPlaceMod: ()=>deskPlaceMod,
  deskSetupMod: deskSetupMod,
  deskVisualMod: ()=>deskVisualMod,
  faceC: faceC,
  histB: histB,
  histF: histF,
  launcherCtlMod: ()=>launcherCtlMod,
  launcherPrevMod: ()=>launcherPrevMod,
  loadSavedItemsIntoSession: (...a)=>loadSavedItemsIntoSession(...a),
  NO_DESK_ID: NO_DESK_ID,
  redoB: redoB,
  redoF: redoF,
  reopenAnimalFromCreator: reopenAnimalFromCreator,
  slots: slots,
  toast: (...a)=>toast(...a),
});
const openCreator = creatorOpenMod.openCreator;   // 옛 전역 이름
const renderLauncher = creatorOpenMod.renderLauncher;   // 옛 전역 이름

/* (C 구역 떼기 · w3) 이 자리의 본문도 creator/creator-preview.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* (C 구역 떼기 · w3) 이 자리의 본문도 creator/creator-flow.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 본문은 creator/creator-save.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const creatorSaveMod = TwCreatorSave.createCreatorSave({
  NO_DESK_ID: NO_DESK_ID,
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  Presence: ()=>Presence,
  _blankFaceConfirmed: ()=>_blankFaceConfirmed,
  _isBlankDraw: (...a)=>_isBlankDraw(...a),
  activeCustomDeskId: ()=>crState.activeCustomDeskId,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  blinkC: blinkC,
  cBase: ()=>crState.cBase,
  cBotColor: ()=>crState.cBotColor,
  cCam: ()=>crState.cCam,
  cDeskColor: ()=>crState.cDeskColor,
  cDeskGlbB64: ()=>crState.cDeskGlbB64,
  cDeskLenX: ()=>crState.cDeskLenX,
  cDeskPos: ()=>crState.cDeskPos,
  cDeskScale: ()=>crState.cDeskScale,
  cRenderer: ()=>crState.cRenderer,
  cScene: ()=>crState.cScene,
  cTopColor: ()=>crState.cTopColor,
  cXform: ()=>crState.cXform,
  charDef: (...a)=>charDef(...a),
  clampCharY: (...a)=>clampCharY(...a),
  clearStampState: (...a)=>crStampMod.clearStampState(...a),
  collectDeskItems: (...a)=>collectDeskItems(...a),
  commissionMod: ()=>commissionMod,
  createSeat: (...a)=>createSeat(...a),
  creatorFlowMod: creatorFlowMod,
  creatorMode: ()=>creatorMode,
  creatorOpen: ()=>creatorOpen,
  curSlot: ()=>curSlot,
  currentCreatorDef: ()=>crState.currentCreatorDef,
  customItems: ()=>customItems,
  faceC: faceC,
  layoutSeats: (...a)=>layoutSeats(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),
  roomSyncMod: roomSyncMod,
  saveCurSlot: (...a)=>saveCurSlot(...a),
  selectSeat: (...a)=>seatPanelMod.selectSeat(...a),
  skinIndex: ()=>crState.skinIndex,
  slotSaveMod: ()=>slotSaveMod,
  slots: slots,
  snapCanvas: (...a)=>snapCanvas(...a),
  toast: (...a)=>toast(...a),
  setBlankFaceConfirmed: (v)=>{ _blankFaceConfirmed = v; },
  setCreatorOpen: (v)=>{ creatorOpen = v; },
  setCurSlot: (v)=>{ curSlot = v; },
});

/* ═══ 🖼️ 런처 미리보기 · 슬롯 섬네일 ═══ */
/* 본문은 launcher/launcher-preview.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const launcherPrevMod = TwLauncherPreview.createLauncherPreview({
  CHAR_Z: CHAR_Z,
  FrameBudget: FrameBudget,
  renderQuality: ()=>_renderQuality,
  blinkTiming: TwBlinkTiming,
  RIG_TURN: creatorPrevMod.RIG_TURN,
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _setDeskMatColor: (...a)=>lightToneMod._setDeskMatColor(...a),
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  allDeskItems: (...a)=>deskItemsMod.allDeskItems(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  applyStaticHandRest: (...a)=>creatorPrevMod.applyStaticHandRest(...a),
  assetCodeMod: ()=>assetCodeMod,
  b64ToBuf: (...a)=>b64ToBuf(...a),
  buildDesk: (...a)=>buildDesk(...a),
  clampCharY: (...a)=>clampCharY(...a),
  clearHolderDeskItems: (...a)=>creatorPrevMod.clearHolderDeskItems(...a),
  commSceneCache: commSceneCache,
  customItems: ()=>customItems,
  defToBase: (...a)=>defToBase(...a),
  equipDeskItem: (...a)=>equipDeskItem(...a),
  extractBonesInto: (...a)=>extractBonesInto(...a),
  getCommissionScene: (...a)=>getCommissionScene(...a),
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
  registerCustomItem: (...a)=>deskItemsMod.registerCustomItem(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  scene: scene,
  setDeskPos: (...a)=>deskPlaceMod.setDeskPos(...a),
  setDeskScale: (...a)=>deskPlaceMod.setDeskScale(...a),
  setFaceMap: (...a)=>matToneMod.setFaceMap(...a),
  slotSaveMod: ()=>slotSaveMod,
  slots: slots,
  swapDeskVisual: (...a)=>deskVisualMod.swapDeskVisual(...a),
});

/* ═══ 🎛️ 런처 컨트롤 — 슬롯 넘기기 · 톱니 메뉴 · 삭제 · 보관함 이동 ═══ */
/* 본문은 launcher/launcher-controls.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const launcherCtlMod = TwLauncherControls.createLauncherControls({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  closetMod: ()=>closetMod,
  curSlot: ()=>curSlot,
  launchApp: (...a)=>launchApp(...a),
  openCreator: (...a)=>openCreator(...a),
  racePickerMod: ()=>racePickerMod,
  renderLauncher: (...a)=>renderLauncher(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  settingsMod: settingsMod,
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
});
/* ═══ 🐾 종족 선택창 ═══ */
/* 본문은 race-picker.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const racePickerMod = TwRacePicker.createRacePicker({
  BASE_SCENE: ()=>bodyCore.baseScene(),
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  applyLightPresetToInstance: (...a)=>matToneMod.applyLightPresetToInstance(...a),
  instantiateBase: (...a)=>instantiateBase(...a),
  normalizeModel: (...a)=>normalizeModel(...a),
  openCreator: (...a)=>openCreator(...a),
});

/* === 커미션 캐릭터 코드 입력 (일반 사용자도 가능) === */
/* 본문은 creator/commission-import.js 로 옮겼다(C 구역 떼기 · w3). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const commImpMod = TwCommissionImport.createCommissionImport({
  CANVAS_SZ: CANVAS_SZ,
  charCodeMod: ()=>charCodeMod,
  charDef: (...a)=>charDef(...a),
  commissionMod: ()=>commissionMod,
  creatorSaveMod: creatorSaveMod,
  curSlot: ()=>curSlot,
  openCreator: (...a)=>openCreator(...a),
  racePickerMod: racePickerMod,
  renderLauncher: (...a)=>renderLauncher(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  slotSaveMod: ()=>slotSaveMod,
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
});

// 동물 카드는 의도적으로 핸들러 없음(클릭해도 무반응) — 공사중 표시로 충분
// ★ [캐릭터 생성]은 빈 슬롯의 [＋]로 일원화됨 — 이 버튼은 [🚧 공사중]으로 비워두고
//   나중에 새 기능을 넣을 자리로 남긴다(HTML에서 disabled 상태라 핸들러 없음).
document.getElementById('lcLoad').onclick=()=>myInfoMod.openMyInfo('box');   // 🪪 [개정 16 · §6-⑭] 옛 [캐릭터 불러오기] → [내 정보]. 코드 불러오기는 보관함 탭 맨 아래로 옮겼다.

/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
/* --- 앱 실행: 저장된 슬롯으로 책상 친구들 구성 --- */
// ★ 카메라 앵글·줌이 미리보기와 실행 화면에서 달라서 생기는 시각적 앞뒤 어긋남을 오프셋으로 보정 —
//   미리보기가 정답 기준이라도 이 카메라 차이는 임시 보정 없이 못 맞추므로 필수(수치는 실측 조정값).
//   ★ 요청사항: 커미션 캐릭터는 미리보기 기준으로 xf.z 그대로 사용 (오프셋 적용하니 책상과 더 멀어 보임)
const COMMISSION_Z_OFFSET = 0;   // 커미션 전용 오프셋 — 미리보기가 정답이라 0
// ★ 기본(비커미션) 캐릭터만 따로 미세조정 — 위 공통 보정치로도 기본 캐릭터는 생성기 미리보기와 앞뒤가 살짝
//   안 맞는다는 피드백 반영. 양수면 캐릭터가 더 앞으로(카메라 쪽으로), 음수면 더 뒤로 이동함.
// ★ [배치진단] 결과 실행 캐릭터가 미리보기보다 정확히 이 값만큼 책상 쪽으로 파고들던 원인으로 확인 —
//   FIT_MODEL_Z_NUDGE가 0이 된 지금은 이 보정도 불필요해져서 0으로. (다시 띄우고 싶으면 값 조절)
const DEFAULT_CHAR_Z_EXTRA_OFFSET = 0;
/* 본문은 character/char-apply.js 로 옮겼다(앱 FSD · app.js 분리 M12). 원래 자리인 여기서 만든다 — window.rebuildAnimalSeats · window.registerAnimalEar 가 예전과 같은 때 걸린다.
   다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다. */
const charApplyMod = TwCharApply.createCharApply({
  _attachHumanEars: _attachHumanEars,
  _syncHumanEarRig: _syncHumanEarRig,
  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,
  applyDeskItemsTo: applyDeskItemsTo,
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  applyPartXf: (...a)=>applyPartXf(...a),
  assetCodeMod: ()=>assetCodeMod,
  b64ToBuf: (...a)=>b64ToBuf(...a),
  BASE_ANIMS: ()=>bodyCore.baseAnims(),
  clampCharY: clampCharY,
  commSceneCache: commSceneCache,
  compositeFace: (...a)=>compositeFace(...a),
  creatorPrevMod: creatorPrevMod,
  curSlot: ()=>curSlot,
  customItems: ()=>customItems,
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  defToBase: (...a)=>defToBase(...a),
  deskItemsMod: ()=>deskItemsMod,
  deskPlaceMod: ()=>deskPlaceMod,
  deskVisualMod: ()=>deskVisualMod,
  fitModel: fitModel,
  getCommissionScene: (...a)=>getCommissionScene(...a),
  instantiateBase: (...a)=>instantiateBase(...a),
  lightToneMod: lightToneMod,
  matToneMod: matToneMod,
  mkFaceTex: (...a)=>mkFaceTex(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  rideBenchMod: rideBenchMod,
  seatCharZ: seatCharZ,
  seatEqMod: seatEqMod,
  seatModelLoadMod: seatModelLoadMod,
  seatRefitMod: seatRefitMod,
  seats: seats,
  seatsMod: seatsMod,
  slots: slots,
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
});
const _purgeSeatParts = charApplyMod._purgeSeatParts;   // 옛 전역 이름
const refreshRiggedPartsXf = charApplyMod.refreshRiggedPartsXf;   // 옛 전역 이름
const _registerAnimalEarOn = charApplyMod._registerAnimalEarOn;   // 옛 전역 이름
const applyCharToSeat = charApplyMod.applyCharToSeat;   // 옛 전역 이름

/* ===================== 설정 패널 "캐릭터" 탭 — 캐릭터 교체 / 자리 추가(솔로 전용) =====================
   - 캐릭터 교체: 내 좌석(findMySeat)의 모습을 저장된 다른 슬롯으로 즉시 교체. 멀티모드에서도 가능하며
     Presence.updateDef로 상대방에게도 즉시 동기화됨.
   - 자리 추가: 솔로모드 한정, 저장된 슬롯 중 현재 활성 슬롯을 제외한 나머지를 원하는 만큼(최대 전체) 동시에
     로컬 전용 추가 좌석으로 앉힐 수 있음. 각 슬롯을 독립적으로 켜고 끔. 재시작해도 유지되지만, 멀티모드로
     들어가는 순간 전부 자동으로 빠지고 방 나오면 다시 복원됨(실제 친구 좌석과 혼동 방지). */
/* (앱 FSD 27번) 이 자리의 본문도 settings-panel.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* 🪟 «모두 닫기»(winStackMod.closeAll)가 닫는, ESC 스택에 안 태운 창 — 창마다 여닫는 길이 달라 한 줄씩. 새 창을 만들면 여기에 줄을 더한다(안 더하면 로그아웃 뒤 로그인 화면 위에 남는다).
   마이홈 · 꾸미기 창 · 런처 화면은 backToLauncher 가 닫는다(winStackMod.closeAll 이 맨 끝에 부른다). ESC 스택에 태운 창(설정 · 알림 · 플레이리스트 · 포커스기록 · 마이홈 …)은 표에 넣지 않는다. */
const windowClosers = [
  { key:'chat', isOpen: ()=>{ const o = document.getElementById('chatOverlay'); return !!o && o.style.display === 'block'; }, close: ()=>chatUiMod.closeChatWindow() },
  { key:'gacha', isOpen: ()=>gachaMod.isInvOpen() || gachaMod.isDrawOpen(), close: ()=>gachaMod.closeGachaDraw() },
  { key:'creator', isOpen: ()=>creatorOpen, close: ()=>creatorFlowMod.closeCreator() },
  { key:'myInfo', isOpen: ()=>myInfoMod._miIsOpen(), close: ()=>myInfoMod.closeMyInfo() },
  { key:'idesk', isOpen: ()=>rideBenchMod.isIdeskOpen(), close: ()=>rideBenchMod.closeIdeskInventory() },
];
/* 본문은 launcher/app-mode.js 로 옮겼다(앱 FSD · app.js 분리 M13). 원래 자리인 여기서 만든다 — «런처로» 버튼이 예전과 같은 때 걸린다.
   다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다. */
const appModeMod = TwAppMode.createAppMode({
  _bgmDestroy: (...a)=>window._bgmDestroy(...a),
  _mhDsClose: (...a)=>window._mhDsClose(...a),
  applyCharToSeat: applyCharToSeat,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  closeWardrobe: (...a)=>window.closeWardrobe(...a),
  commitMyHomePage: (...a)=>window.commitMyHomePage(...a),
  createSeat: createSeat,
  curSlot: ()=>curSlot,
  layoutSeats: (...a)=>layoutSeats(...a),
  myhomeStore: myhomeStoreMod,
  launcherState: launcherStateMod,
  overheadMod: overheadMod,
  Presence: ()=>Presence,
  renderLauncher: renderLauncher,
  rideBenchMod: rideBenchMod,
  roomEntryMod: ()=>roomEntryMod,
  scene: scene,
  seatPanelMod: seatPanelMod,
  seats: seats,
  settingsMod: settingsMod,
  slots: slots,
  statusChipMod: statusChipMod,
  toast: (...a)=>toast(...a),
});
const showEl = appModeMod.showEl;   // 옛 전역 이름
const applyAppMode = appModeMod.applyAppMode;   // 옛 전역 이름
const launchApp = appModeMod.launchApp;   // 옛 전역 이름
const backToLauncher = appModeMod.backToLauncher;   // 옛 전역 이름
const isLauncherShown = ()=>document.getElementById('launcher').classList.contains('on');   // ⚙️ 설정 창이 런처에서 열렸나(가운데에 띄운다)

/* ===================== 친구 초대 · 상태 공유 (Presence) =====================
   provider 인터페이스: join(room, me, onFriends) / update(state) / leave()
   지금은 makeMockProvider(로컬 시뮬레이션). 실서비스에선 makeFirebaseProvider로 교체.   */
/* ★ 한 방 정원(나 포함). 5 → 6 → 8 → 10(2026-10-02 요청).
   ⚠️ 서버 규칙에도 방 인원 제한은 없다(rooms/$room/$memberId 는 형식만 검사).
      정원은 startRoom의 사전 검사 하나로만 지켜지므로, 구버전 클라이언트가 섞이면
      정원을 넘겨 들어올 수 있다. 화면은 넘쳐도 깨지지 않고 좌석만 늘어난다.
   ⚠️ [8 → 10] **옛 판(8)과 섞이면** — 옛 판은 친구를 7명까지만 그리고(9·10번째가 안 보임), 8명 이상인 방에는
      못 들어오며, 늦게 들어온 옛 판은 8번째 자리부터 스스로 나간다. 새 판끼리는 10명이 정상이다.
      ⇒ 배포 뒤 관리자가 방 입장 최소 버전(minVersion.room)을 새 판 번호로 올리면 옛 판은 방 입장 자체가 막혀 섞이지 않는다.
   💰 이 숫자는 곧 비용이다 — 한 멤버가 1바이트를 쓰면 방의 나머지 인원수만큼 내려간다
      (_diffRoomPayload 주석의 실측 ×4.0). 6→8은 꽉 찬 방 기준 다운로드가 약 1.4배다.
      8→10 은 꽉 찬 방 기준 약 1.6배다(인원×(인원−1): 56 → 90). */
/* ★ 정원은 원격 설정 roomMaxPeople(remote-config.js · API · 2~50 · 없으면 10) — 바뀌면 다음 판정부터 바로 따른다.
   firebase-init.js(joinRoom 리스너)의 정원 초과 자기 퇴장도 같은 store 를 읽는다 — 숫자를 두 곳에 적지 않는다. */
function maxPeople(){ const s = acctStateMod._rcStore(); return s ? s.maxPeople() : 10; }
/* ═══ 🛰 방 접속 상태(Presence) ═══ */
/* 본문은 room/presence.js 로 옮겼다(C 구역 떼기 w4). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const presenceMod = TwPresence.createPresence({
  presenceAccountStore: accountStoreMod,
  USER_STATUSES: userStatusTableMod.USER_STATUSES,
  awayPicMod: ()=>awayPicMod,
  chatUiMod: chatUiMod,
  customStatusConf: ()=>userStatusTableMod.customStatusConf(),
  expBarMod: ()=>expBarMod,
  floatersMod: floatersMod,
  focusLevelMod: ()=>focusLevelMod,
  focusShareMod: ()=>focusShareMod,
  iDeskMod: iDeskMod,
  lastAnyInput: ()=>seatStateMod.lastAnyInput(),
  roomEntryMod: ()=>roomEntryMod,
  roomSyncMod: roomSyncMod,
  seats: seats,
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  triggerPet: (...a)=>triggerPet(...a),
});
const Presence = presenceMod.Presence;   // 옛 전역 이름 — app.js 와 아직 전역으로 읽는 모듈이 Presence.이름 으로 부른다(animal.js · noise.js 는 deps 로 받는다)

/* ═══ 📦 방으로 보내는 def — 직렬화 · 얼굴 URL · 델타 전송 · Firebase provider ═══ */
/* (앱 FSD 35번) 이 자리의 본문도 room-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🛰 방 서버 provider (관리자 스위치 · 기본 꺼짐) ═══════════════════════════════
   방 통신은 parts/room/room-rt.js 방 포트 하나(realtime 연결 위 · TwRoomRt.store). 정원 · 중복 접속 · 승계 · 해산 · 채널 · 시크릿룸 입장은 서버가 판정한다. */
/* 본문은 room-entry.js 로 옮겼다(앱 FSD 33번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
// 🎧 같이 듣기 — 방 입장 모듈의 «방이 바뀜»(들어감 · 나감 · meta) 알림에 sync 를 건다(room/listen-ui.js · 설계 docs/LISTEN_TOGETHER.md)
const listenUi = TwListenUi.createListenUi({
  model: TwListenModel,
  provider: TwListenProvider.createListenProvider({ server: ()=>Presence.serverProvider(), model: TwListenModel }),
  companion: ()=>window.companion,
  roomCode: ()=>(Presence.active() ? Presence.roomCode() : null),
  meta: ()=>window._roomMetaCache,
  isSecretRoom: ()=>TwRoomState.isSecretCode(Presence.active() ? Presence.roomCode() : null),
  myId: ()=>TwRoomRt.store.myCode(),
  memberIds: ()=>Object.values(Presence.friendsObj() || {}).map(f=>f && f.userId).filter(u=>u && u !== TwRoomRt.store.myCode()),
  nameOf: (uid)=>{
    if(uid === TwRoomRt.store.myCode()) return getDisplayName();
    const f = Object.values(Presence.friendsObj() || {}).find(x=>x && x.userId === uid);
    return TwPersonName.shown(f && f.name);
  },
  djItems: ()=>plMod.mine().slice(),
  stopPersonal: ()=>plMod.stopIfPlaying(),
  positionPopup: (el, btn)=>statusChipMod._positionCascade(el, btn, 'right'),
  closeChipPopups: (id)=>chipPopupsMod._closeChipPopups(id),
  escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
// 🏷️ 방 안 정보 칸 제목 · [방 설정](방장만) — 방 입장 모듈이 들어감 · 나감 · meta 때 paint 를 부른다(room/room-info-ui.js)
const roomInfoUi = TwRoomInfoUi.createRoomInfoUi({
  roomSettings: TwRoomSettings,
  bannedWords: TwBannedWords,
  rcStore: ()=>acctStateMod._rcStore(),
  isHost: ()=>TwRoomState.isHost(window._roomMetaCache, TwRoomRt.store.myCode()),   // 판정은 채팅 잠금과 같은 한 곳(room-state.js)
  isSecretRoom: ()=>TwRoomState.isSecretCode(Presence.active() ? Presence.roomCode() : null),
  roomCode: ()=>(Presence.active() ? Presence.roomCode() : null),
  meta: ()=>window._roomMetaCache,
  saveInfo: (room, info)=>(Presence.serverProvider() ? Presence.serverProvider().setMeta(info) : Promise.resolve({ ok:false, code:'notInRoom' })),   // 방 포트 meta(방장만 · 서버가 판정)
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
// 🗂️ 방 목록 로비 · F1 시크릿룸 칸이 같이 읽는 provider — 방 입장 모듈보다 먼저(room/room-lobby-provider.js)
const roomLobbyProvider = TwRoomLobbyProvider.createRoomLobbyProvider({ apiGet: (p, o)=>TwApi.authed.get(p, o), peek: (code)=>TwRoomRt.store.peek(code),
  roomCode: ()=>(Presence.active() ? Presence.roomCode() : null), myUserId: ()=>getMyUserId(), now: ()=>Date.now() });
const roomEntryMod = TwRoomEntry.createRoomEntry({
  listen: TwListenModel,
  roomEntryAccountStore: accountStoreMod,
  EXP_CELLS: ()=>expBarMod.EXP_CELLS,
  FLOATER_BURST: floatersMod.FLOATER_BURST,
  Presence: Presence,
  _chatNotifyIncoming: (...a)=>chatPrefsMod._chatNotifyIncoming(...a),
  _clearHiddenSeats: (...a)=>hiddenSeatsMod._clearHiddenSeats(...a),
  _demojiNotifyIncoming: (...a)=>chatPrefsMod._demojiNotifyIncoming(...a),
  _pokeFresh: (...a)=>roomSyncMod._pokeFresh(...a),
  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),
  awayPicMod: ()=>awayPicMod,
  chatUiMod: chatUiMod,
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  deserializeDefFromNetwork: (...a)=>roomSyncMod.deserializeDefFromNetwork(...a),
  focusLevelMod: ()=>focusLevelMod,
  myCode: ()=>TwRoomRt.store.myCode(),
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  layoutSeats: (...a)=>layoutSeats(...a),
  maxPeople: (...a)=>maxPeople(...a),
  myExpCells: (...a)=>expBarMod.myExpCells(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),
  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),
  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),
  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),
  retryDefAfter: (...a)=>roomSyncMod.retryDefAfter(...a),
  rideBenchMod: rideBenchMod,
  scene: scene,
  seats: seats,
  serializeDefForNetwork: (...a)=>roomSyncMod.serializeDefForNetwork(...a),
  settingsMod: settingsMod,
  showChatBubble: (...a)=>showChatBubble(...a),
  slots: slots,
  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  triggerPet: (...a)=>triggerPet(...a),
  updateMyStatusChipPosition: (...a)=>statusChipMod.updateMyStatusChipPosition(...a),
  _rcStore: (...a)=>acctStateMod._rcStore(...a),
  twNav: twNav,
  mySecretRoom: ()=>roomLobbyProvider.mySecretRoom(),
  paintRoomInfo: ()=>roomInfoUi.paint(),
  roomSettings: TwRoomSettings,
  roomState: TwRoomState,
  roomRt: TwRoomRt.store,
  runCost: runCost,   // 🩺 좌석 맞춤 시간(1분 [비용] 줄)
});
roomEntryMod.onRoomChanged(()=>listenUi.sync());   // 🎧 같이 듣기가 방 입장 모듈을 몰라도 되게(위층이 건다)
// 🕘 최근 들어간 방 — 연결되면 기록하고, 로비 코드 칸을 누르면 펼친다(room/recent-rooms*.js)
const recentRooms = TwRecentRooms.createRecentRooms({ storage: localStorage, getMyUserId: (...a)=>getMyUserId(...a), now: ()=>Date.now(), isRoomCode: roomEntryMod.isRoomCode, isSecretCode: TwRoomState.isSecretCode });
roomEntryMod.onRoomJoined((code, meta)=>recentRooms.record(code, TwRoomSettings.displayTitle(meta && meta.title, meta && meta.hostName,
  TwBannedWords.cleanBannedList(acctStateMod._rcStore().bannedWords()), TwBannedWords).text));   // 제목은 방 안 제목 칸과 같은 판단(금칙어면 «○○ 님의 방»)
TwRecentRoomsUi.createRecentRoomsUi({ document, recent: recentRooms, agoText: TwRecentRooms.agoText, now: ()=>Date.now(), joinRoom: (code)=>roomEntryMod.joinRoom(code), secretMask: TwRecentRooms.SECRET_MASK, secretCodeFrom: (v)=>roomEntryMod.secretCodeFrom(v), askCode: (o)=>asyncPromptMod.asyncPrompt(o) });
// 🏷️ 방 만들기 창 — 로비의 [방 만들기] 가 열고, 창의 [방 만들기] 가 방 입장 모듈의 만들기로 넘긴다(room/room-create-ui.js)
const roomCreateUi = TwRoomCreateUi.createRoomCreateUi({
  roomSettings: TwRoomSettings,
  bannedWords: TwBannedWords,
  rcStore: ()=>acctStateMod._rcStore(),
  maxPeople: ()=>maxPeople(),
  isLicensed: ()=>roomEntryMod._myRoomLicensed(),
  listenEnabled: TwListenModel.ENABLED,
  onCreate: (ch, settings)=>roomEntryMod.doCreateRoomInChannel(ch, settings),
});
// 🗂️ 방 목록 로비 — 목록 · 내 시크릿룸은 provider 로만 읽는다(room/room-lobby-*.js)
TwRoomLobbyUi.createRoomLobbyUi({
  model: TwRoomLobbyModel,
  provider: roomLobbyProvider,
  inRoom: ()=>Presence.active(),
  twNav: twNav,
  maxPeople: ()=>maxPeople(),
  isLicensed: ()=>roomEntryMod._myRoomLicensed(),
  isBlocked: (card)=>TwListenModel.isBlockedRoom(card),
  joinRoom: (code)=>roomEntryMod.joinRoom(code),   // 입장 중 막기는 room-entry 한 깃발(코드 칸 · 최근 방과 같이)
  openCreate: (ch)=>roomCreateUi.open(ch),
  toast: (...a)=>toast(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  now: ()=>Date.now(),
  random: ()=>Math.random(),
});
const USER_NAME_KEY = 'tw.userName';

// 내 이름 — 서버 계정 이름의 이 PC 사본. 이름이 없으면 '' (localStorage 키를 지운다 — «이름 없음» 을 적지 않는다)
function getUserName(){
  try{ return localStorage.getItem(USER_NAME_KEY) || ''; }catch(e){ return ''; }
}

function setUserName(name){
  try{ localStorage[name ? 'setItem' : 'removeItem'](USER_NAME_KEY, name); }catch(e){}   // 이름이 없으면 칸을 지운다
}

// 화면에 그릴 내 이름 — 이름이 없으면 그릴 때만 «이름 없음»(shared/person-name.js)
function getDisplayName(){ return TwPersonName.shown(getUserName()); }

/* ═══ 🏷️ 닉네임 저장 — **모달이 아니라 제자리 편집**이 부르는 한 벌 ══════════
   [경위] 예전엔 #userNameOverlay 모달이 이 일을 했다. 그 모달은 런처 시절 창이라(z-index:80)
     CSS z-index 가 창 층(83~92)보다 아래였는데, #myHomeOverlay 는 _WIN_Z_LAYERS 에 실려
     있어서 마이홈 안을 **누르는 순간** bringWinToFront 가 인라인 z 를 83 이상으로 올린다.
     즉 「수정」을 누르는 그 클릭 자체가 마이홈을 모달 위로 올려, 모달은 열리는데(.on)
     뒤에 깔려 안 보였다 — "눌러도 창이 안 나온다"는 제보가 이것이다.
   [고친 방향] 창을 위로 올리는 대신 **창을 없앴다.** 게시글 제목과 같이 닉네임 자리가
     그대로 입력칸이 된다(_mhBeginNameEdit). 뜨는 것이 없으니 층 싸움도 없다.
   ⚠️ 저장이 건드리는 곳이 다섯이다 — 로컬 저장 · 서버 프로필 · 방의 이름표 · 마이홈 표시 ·
     알림. 편집 진입로가 늘어나도 저장은 **반드시 이 함수 하나만** 부를 것. */
/* 본문은 program-settings.js 로 옮겼다(앱 FSD 40번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* 🏷️ 닉네임 저장 — 본문은 account/user-name.js(모듈 순환 끊기 7 — 설정 창과 떼어 마이홈 편집 · 내 정보가 설정 창을 바라보지 않게). 원래 자리라 여기서 만든다 */
const userNameMod = TwUserName.createUserName({
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getUserName: (...a)=>getUserName(...a),
  isAdmin: ()=>isAdmin,
  setUserName: (...a)=>setUserName(...a),
  toast: (...a)=>toast(...a),
  saveNameOnServer: (name)=>loginFlowMod.patchMe({ displayName: name }),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
const progSettingsMod = TwProgramSettings.createProgramSettings({
  FIGURE_MODE_KEY: ()=>FIGURE_MODE_KEY,
  OFFICE_MODE_KEY: ()=>OFFICE_MODE_KEY,
  _applyChatSfxUI: (...a)=>chatPrefsMod._applyChatSfxUI(...a),
  _focusShowPush: (...a)=>focusShareMod._focusShowPush(...a),
  _lsSet: (...a)=>_lsSet(...a),
  chatUiMod: chatUiMod,
  figureMode: ()=>officeModeMod.figureMode(),
  focusGateSleep: ()=>focusGateSleep,
  officeMode: ()=>officeModeMod.officeMode(),
  purikuraUi: purikuraUi,
  openLicenseUI: (...a)=>licenseUiMod.openLicenseUI(...a),
  refreshOfficeChipUI: (...a)=>refreshOfficeChipUI(...a),
  refreshThemeUI: (...a)=>themeUiMod.refreshThemeUI(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  setFigureMode: (v)=>{ officeModeMod.setFigureMode(v); },
  setFocusGateSleep: (v)=>{ focusGateSleep = v; },
  setOfficeMode: (v)=>{ officeModeMod.setOfficeMode(v); },
  onOfficeModeChanged: ()=>{ if(xmasWinMod) xmasWinMod.syncBgm(); },
  twNav: twNav,
  renderQuality: ()=>_renderQuality,
  setRenderQuality: (v)=>{ _renderQuality = v; },
  renderAntialias: _renderAA,
  renderShadows: _renderShadows,
  applyRunPixelRatio: (...a)=>seatCameraMod.updateCameraOnly(...a),
  openSettings: (...a)=>settingsMod.openSettings(...a),
  closeSettings: (...a)=>settingsMod.closeSettings(...a),
  onTabShown: (...a)=>settingsMod.onTabShown(...a),
});
TwOssLicenses.createOssLicenses({ document, window, links: [document.getElementById('progOssLink'), document.getElementById('miOssLink')], openUrl: (u)=>companion.openBrowser(u), escRegisterWindow: (...a)=>winStackMod.escRegisterWindow(...a) });

/* ═══════════════════ 🔑 계정 — 로그인 · 로그아웃 · 이 PC 맞추기 ═══════════════════
   0.13 — 로그인(토큰 받기)만 Firebase Auth, «이 로그인이 누구인가» 는 서버(GET /v2/me)가 정한다(login-flow.js).
   다른 PC 이어받기는 같은 계정 로그인으로 끝난다 — 서버가 원본이라 옮길 사본이 없다(계정 이전 · accountSnap 은 걷었다).
   창은 main.js 가 연다(companion.signInWithGoogle — file:// 이라 팝업이 막힌다).
──────────────────────────────────────────────────────────────────── */
/* 본문은 account.js 로 옮겼다(앱 FSD 23번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const accountMod = TwAccount.createAccount({
  googleConfirmMod: googleConfirmMod,
  BELL_SEEN_KEY: BELL_SEEN_KEY,
  accountLegacyStore: accountStoreMod,
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  INBOX_BC_READ_KEY: INBOX_BC_READ_KEY,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  MY_FRIEND_CODE_PREV_KEY: MY_FRIEND_CODE_PREV_KEY,
  MY_USER_ID_KEY: MY_USER_ID_KEY,
  USER_NAME_KEY: USER_NAME_KEY,
  _focusTodaySec: ()=>focusTotalMod._focusTodaySec(),
  unsentSec: (...a)=>focusProgressMod.unsentSec(...a),   // 🕒 로그아웃 검문이 보는 «못 올린 집중 시간»
  leaveFlush: TwLeaveFlush,
  flushFocus: (...a)=>focusProgressMod.flushPending(...a),   // 📤 로그아웃 올리기
  _rememberOldFriendCode: (...a)=>_rememberOldFriendCode(...a),
  _setMyUserId: (...a)=>_setMyUserId(...a),
  extraSeatSlots: ()=>settingsMod.extraSeatSlots(),
  gachaMod: ()=>gachaMod,
  getMyUserId: (...a)=>getMyUserId(...a),
  acctStateMod: acctStateMod,
  plMod: plMod,
  mhScheduler: mhScheduler,
  mallangStore: mallangStoreMod,
  giftBox: giftBoxMod,
  myhomeStore: myhomeStoreMod,
  bookshelfStore: bookshelfStoreMod,
  bugBoardReset: (...a)=>bugBoardUi.reset(...a),
  toast: (...a)=>toast(...a),
  tricksMod: tricksMod,
  weeklyChal: ()=>weeklyChal,
  setFocusTodaySec: (v)=>{ focusTotalMod.setFocusTodaySec(v); },
  setExtraSeatSlots: (v)=>{ settingsMod.setExtraSeatSlots(v); },
  setAcctDetached: (v)=>{ acctStateMod.setAcctDetached(v); },
  LOGIN_EMAIL_KEY: acctStateMod.LOGIN_EMAIL_KEY,
  LOGIN_UID_KEY: acctStateMod.LOGIN_UID_KEY,
  getMyLoginEmail: (...a)=>acctStateMod.getMyLoginEmail(...a),
  FRIEND_CODE_LOGIN_RE: acctStateMod.FRIEND_CODE_LOGIN_RE,
  loginFlowMod: loginFlowMod,
  ME_CACHE_KEY: TwLoginFlow.ME_CACHE_KEY,
  userApiMod: userApiMod,
  sessionLost: ()=>TwRtHub.isDeviceOff(TwRtHub.store.state()),
});
/* ═══ 🪪 [내 정보] — 런처 화면 전환 (CHECKS 개정 48 · 사용자 결정 · 회원가입 설계 §7 B2 · C4 · D · G) ═══════════════
   런처 [내 정보](#lcLoad)를 누르면 **런처 카드 안의 페이지(#lcMyInfo)가 제목줄 아래를 덮는다** — 따로 창도 겹창도 아니다. ◀ 로 돌아간다.
     · 작은 머리 — 마이홈 프로필 사진(44px) · 닉네임 + 레벨 배지(친구 목록과 같은 _plFillLv) + [수정](commitUserName 하나) · 친구 코드 + [복사].
     · [보관함] — **보관함에 넣은 캐릭터만**(슬롯 표 밖의 산 항목 · 런처 톱니 [보관함 이동]으로 넣은 것). 슬롯 캐릭터는 여기 없다.
         줄마다 섬네일 · «마지막 수정 M/D» · [슬롯에 올리기](_charsBoxToDesk). 개수는 «보관함 (n/20)» — «마리» 라는 말은 쓰지 않는다.
         보관함이 아직 안 열렸으면(스위치 · 첫 채택 전) 한 줄로 알린다. 맨 아래 [코드로 캐릭터 불러오기](#codeOverlay).
     · [계정] — C4 그대로(refreshAccountTab · _acctMethodsRender · 로그아웃 3단계 · _slotsRenderAcctSync).
     · [휴지통] (개정 49 · 시안 E) — 탭 순서 보관함 · 휴지통 · 계정(개정 69 에서 사용자가 다시 정함 · 옛 순서 보관함 · 계정 · 휴지통). 보관함이 열린 PC 에서만 보인다. «휴지통 N» · 붉은 글자.
         줄마다 섬네일 · 이름표 «옮김»(3일) / «연동 교체»(10일) · «M/D 사라져요» · [복원](폭 고정 · 무조건 보관함으로 · 20 이면 붉은 상자).
         보관함 줄 끝의 붉은 아이콘 = [휴지통 이동](그 줄 안에서 되묻기). 어떤 줄을 보일지는 _charsTrashView(순수) 몫.
     · [보관함] 가득 참 (개정 51 · 시안 D2) — 보관함 20 이상이면 노란 경고 · 체크칸 · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에(_charsBoxTrashMany).
   ⚠️ 섬네일·사진 src 는 data:image/ · http(s) 만 받는다 — 속성 보간 없이 DOM 으로만 넣는다(audit 검사 19).
   ⚠️ 이 페이지는 런처의 일부다 — 팝업 목록(OPEN_MODAL_SEL · 바깥 클릭 닫기 등)에 넣지 않는다. */
/* 본문은 my-info.js 로 옮겼다(앱 FSD 17번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const myInfoMod = TwMyInfo.createMyInfo({
  EXP_CELLS: ()=>expBarMod.EXP_CELLS,
  EXP_SEC_PER_CELL: ()=>expBarMod.EXP_SEC_PER_CELL,
  EXP_SEC_PER_LEVEL: ()=>expBarMod.EXP_SEC_PER_LEVEL,
  FOCUS_CYCLE_SEC: ()=>focusTotalMod.FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS: ()=>focusTotalMod.FOCUS_LEVEL_CAP_HOURS,
  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,
  STAR_PALETTE: ()=>focusLevelMod.STAR_PALETTE,
  USER_NAME_MAX: userNameMod.USER_NAME_MAX,
  _acctDetached: ()=>acctStateMod._acctDetached(),
  _focusTotalSec: ()=>focusProgressMod.shownTotalSec(),   // 레벨 막대용 — 받기 전 null
  progress: ()=>focusProgressMod.progress(),
  retryProgress: (...a)=>focusProgressMod.reload(true),   // 못 받았으면 열 때 다시 받는다(번호 알림 E-FOCUS-01)
  _loginDoLogout: (...a)=>accountMod._loginDoLogout(...a),
  _loginDoDeleteAccount: (...a)=>accountMod._loginDoDeleteAccount(...a),
  _withdrawPreview: (...a)=>accountMod._withdrawPreview(...a),
  myhomeAvatar: ()=>myhomeStoreMod.avatar(),
  ensureMyHome: (...a)=>myhomeStoreMod.ensureMine(...a),
  closeGearMenu: (...a)=>launcherCtlMod.closeGearMenu(...a),
  commitUserName: (...a)=>userNameMod.commitUserName(...a),
  curSlot: ()=>curSlot,
  focusCycleOf: (...a)=>focusLevelMod.focusCycleOf(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getStarColor: (...a)=>focusLevelMod.getStarColor(...a),
  getUserName: (...a)=>getUserName(...a),
  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),
  myFocusShow: (...a)=>focusLevelMod.myFocusShow(...a),
  npStarFill: (...a)=>lvTierMod.npStarFill(...a),
  openCodeModal: (...a)=>charCodeMod.openCodeModal(...a),
  plMod: plMod,
  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  setStarColor: (...a)=>focusLevelMod.setStarColor(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
  closetMod: ()=>closetMod,
  _acctRelaunchAfterDetach: (...a)=>acctStateMod._acctRelaunchAfterDetach(...a),
  markLeft: (...a)=>acctStateMod.markLeft(...a),
});
/* (앱 FSD 17번) 이 자리의 본문도 my-info.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔑 라이선스 등록 UI ═══ */
/* 🔑 설정 › 라이선스 구획의 상태 · 동작(account/license-screen.js) — 창을 열면 내 라이선스(기기 목록)를 받고, 키 등록 · 기기 해제 · 빼기 · 이 기기 등록은 여기서 한다. */
const licenseScreenMod = TwLicenseScreen.createLicenseScreen({
  licenseApi: TwLicenseApi.store,
  licensePremium: licensePremiumMod,
  deviceId: ()=>TwDeviceId.store.get(),
  isAdmin: ()=>isAdmin,
  isShown: ()=>{ const o=document.getElementById('focusSettingsPanel'), p=document.getElementById('fsTabInfo'); return !!(o && o.classList.contains('on') && p && p.style.display !== 'none'); },   // 0.14 — 라이선스 칸은 설정 창 하나의 «정보» 탭
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
});
/* 본문은 license-ui.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const licenseUiMod = TwLicenseUi.createLicenseUi({
  isPremium: ()=>isPremium,
  licenseScreenMod: licenseScreenMod,
});
/* ═══ 🪟 런처 타이틀바 · 팝업 흐림 ═══ */
/* 본문은 launcher-chrome.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const launcherChromeMod = TwLauncherChrome.createLauncherChrome({
  myInfoMod: myInfoMod,
});

/* ═══ 📢 런처 광고 배너 · ⚙️ 게임 설정 ═══ */
/* 본문은 ad-banner.js 로 옮겼다(앱 FSD 43번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const adBannerMod = TwAdBanner.createAdBanner({
  noticeFeed: noticeFeed,
  settingsMod: settingsMod,
});
/* 관리자 쪽(🛑 전체 방 종료 · ⚙️ 게임 설정 · 📢 광고 배너 편집)은 admin/admin-launcher.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에.
   isAdmin 은 다시 대입되는 let 이라 읽는 함수로 넘긴다. 사용자 쪽(배너 그리기 · 구독)은 바로 위 ad-banner.js(앱 FSD 43번).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminLauncher = TwAdminLauncher.createAdminLauncher({
  catalogAdmin: catalogAdmin,
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  isAdmin: ()=>isAdmin,
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
  refreshBanner: ()=>noticeFeed.refresh(),
});
/* (앱 FSD 43번) 이 자리의 본문도 ad-banner.js 로 옮겼다 — 만드는 줄은 첫 자리. */

/* ═══ 🔑 라이선스 키 등록 · 해제 버튼 ═══ */
/* 본문은 license-key.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const licenseKeyMod = TwLicenseKey.createLicenseKey({
  licenseScreenMod: licenseScreenMod,
});

/* ═══ 🪟 팝업 바깥 클릭으로 닫기 ═══ */
/* 본문은 outside-close.js 로 옮겼다(앱 FSD 47번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const outsideCloseMod = TwOutsideClose.createOutsideClose({
});

/* ═══ 🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자) ═══ */
/* 관리자 몫(라이선스 키 발급 · 목록 · 요청, 📣 확성기 공지 · 📰 업데이트 공지 편집)은 admin/admin-license.js · admin/admin-notice.js 로 옮겼다.
   사용자 쪽(앱을 켤 때 업데이트 공지 팝업)은 아래에 그대로 둔다. 라이선스 요청 · 발급 버튼(옛 «관리자 카테고리 관리» 뒤쪽)도 같은 모듈이라
   거는 때가 그 구역보다 조금 앞당겨졌다 — 모두 버튼 클릭 handler 라 순서와 상관없다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminLicense = TwAdminLicense.createAdminLicense({
  toast: (...a)=>toast(...a),
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
const adminNotice = TwAdminNotice.createAdminNotice({
  toast: (...a)=>toast(...a),
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
});

// 유저: 앱 시작 시 공지 확인 → 미표시 조건 아니면 팝업. 공지 한 판(noticeFeed)을 처음 받았을 때 한 번만 본다.
function _showUpdateNoticeOnce(notice, done){   // done — 창이 닫히거나 보일 게 없을 때 한 번(켜는 흐름이 다음 단계로)
  if(!notice || !notice.ts){ done(); return; }
  // "다시 보지 않기" 체크한 ts와 같으면 스킵
  const dismissedTs = parseInt(localStorage.getItem('tw.updateNoticeDismissedTs')||'0', 10);
  if(dismissedTs === notice.ts){ done(); return; }
  // 팝업 표시
  const ov=document.getElementById('updateNoticeUserOverlay'); if(!ov){ done(); return; }
  document.getElementById('updateNoticeViewTitle').textContent = notice.title || '업데이트 안내';
  { const _nb = document.getElementById('updateNoticeViewBody');
    _nb.innerHTML = inboxMod.linkifyText(notice.body || '');   // 본문 속 주소를 클릭 가능하게
    inboxMod.bindExtLinks(_nb); }
  document.getElementById('updateNoticeDontShow').checked = false;
  ov.style.display = 'flex';
  // 닫기 로직
  const close = ()=>{
    const dontShow = document.getElementById('updateNoticeDontShow').checked;
    if(dontShow){
      try{ localStorage.setItem('tw.updateNoticeDismissedTs', String(notice.ts)); }catch(_){}
    }
    ov.style.display = 'none';
    done();
  };
  document.getElementById('updateNoticeOkBtn').onclick = close;
  document.getElementById('updateNoticeCloseX').onclick = close;
}
// 공지 창은 켜는 흐름(updateFlowMod — 업데이트 창 다음)이 처음 받았을 때 한 번 띄운다
// 켤 때 공지를 받는다 — 공지는 모두에게 같은 공용 데이터라 계정 확인을 기다리지 않는다(로그인 화면 위에도 업데이트 공지가 뜬다). 이후엔 서버가 «공지가 바뀌었다» 하면 다시 받는다 — notice-feed.js
TwNetReady.whenNetReady(()=>noticeFeed.start());
/* ⚙️ 원격 설정 시작 — 읽는 차례 · 주기는 remote-config.js 머리. API 통로 · 이 PC 저장 · realtime 알림만 잇는다. */
TwNetReady.whenNetReady(()=>TwRemoteConfig.store.start({ api: TwApi.client, win: window, rt: TwRtHub.store }));

// ===== Phase 3: 관리자 카테고리 관리 =====
/* 카테고리 관리 본문은 admin/admin-category.js, 뒤쪽의 라이선스 요청 · 발급 버튼 · 친구코드로 발급은 admin/admin-license.js 로 옮겼다.
   PART_GROUPS(뒤에서 선언하는 const) · PART_CATS · partCatOverrides(다시 대입되는 let)는 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminCategory = TwAdminCategory.createAdminCategory({
  catalogAdmin: catalogAdmin,
  toast: (...a)=>toast(...a),
  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),
  partGroups: ()=>premiumMod.PART_GROUPS,
  partCats: ()=>premiumMod.PART_CATS(),
  partCatOverrides: ()=>premiumMod.partCatOverrides(),
});

/* ═══ 🔒 시크릿룸 발급(관리자) ═══ */
/* 📄 엑셀 일괄 발급 · 🔒 시크릿룸 발급 본문은 admin/admin-license-bulk.js 로 옮겼다 — 관리자 코드는 app/parts/admin/ 에 모은다.
   만드는 줄을 여기(원래 자리)에 둬서 버튼을 거는 때가 예전과 같다. 밖에서 부르는 이름은 없다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const adminLicenseBulk = TwAdminLicenseBulk.createAdminLicenseBulk({
  escHtml: (...a)=>escHtml(...a),
  toast: (...a)=>toast(...a),
  adminApi: adminApi,
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  renderLicenseGenList: (...a)=>adminLicense.renderLicenseGenList(...a),
  downloadBlob: (...a)=>charCodeMod.downloadBlob(...a),
  srFmtDate: (...a)=>roomEntryMod._srFmtDate(...a),
});

/* ═══ 👥 책상에서 친구 추가 ═══ */
/* 본문은 add-friend.js 로 옮겼다(앱 FSD 46번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const addFriendMod = TwAddFriend.createAddFriend({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  createSeat: (...a)=>createSeat(...a),
  layoutSeats: (...a)=>layoutSeats(...a),
  openCreator: (...a)=>openCreator(...a),
  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),
  selectSeat: (...a)=>seatPanelMod.selectSeat(...a),
  skinColorFor: (...a)=>skinColorFor(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
});

/* ═══ 💾 슬롯 저장 · 받아 앉히기(saveSlots · applySlotObjs) ═══ */
/* 본문은 slot-save.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const slotSaveMod = TwSlotSave.createSlotSave({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  _blankFaceConfirmed: ()=>_blankFaceConfirmed,
  _blinkEverDrawn: _blinkEverDrawn,
  _faceEverDrawn: _faceEverDrawn,
  _isBlankDraw: (...a)=>_isBlankDraw(...a),
  charDef: (...a)=>charDef(...a),
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
  seats: seats,
  slots: slots,
  toast: (...a)=>toast(...a),
  setBlankFaceConfirmed: (v)=>{ _blankFaceConfirmed = v; },
  withHeldAssets: (o, d)=>premiumMod.withHeldAssets(o, d),   // 접기는 화면에만 — 저장 모양은 사람이 고른 그대로
});
/* 슬롯 저장 · 복원 뒤 할 일 — 이 모듈보다 먼저 만들어지는 위층(프리미엄 · 꾸미기 · 설정 화면)은 여기서 건다.
   서버 원본 옷장(closet.js)은 자기를 만들 때 스스로 건다(onSaved). */
slotSaveMod.onLoaded(()=>premiumMod.pruneUnownedLicenseAssets());
// 옷장은 보통 가챠보다 늦게 받아진다 — 가챠가 끝날 때의 회수는 빈 슬롯을 보고 지나가므로 받아 앉힌 뒤 한 번 더(보유분을 모르면 회수 쪽이 물러난다)
slotSaveMod.onLoaded(()=>gachaMod.pruneUnownedGachaParts());
slotSaveMod.onSeatRelinked((old, cur)=>wardrobeMod.relinkDraftSrc(old, cur));
slotSaveMod.onSlotsReplaced(()=>settingsMod.renderCharSlots());

/* ═══ 🧬 옷장 — 슬롯 5칸 · 보관함 · 휴지통 (서버 원본) ═══════════════════════════════════════
   캐릭터는 서버가 원본이다(0.13). 시작할 때 서버 옷장을 받아 slots[] 에 앉히고(closet.js startCloset — 계정 확인 뒤 app-boot),
   고치면 3초 묶음으로 서버에 쓰고, 슬롯 ↔ 보관함 · 휴지통 · 되살리기는 동작 하나에 요청 하나로 한다. 이 PC 에 캐릭터 저장본 · 보관함 사본 ·
   고친 시각 · 백업 · 충돌 판정은 없다(0.12 의 slot-sync.js · chars.js 맞추기 장치는 걷었다).
   · slot-codec.js — 화면의 캐릭터 한 칸(그림은 dataURL) ↔ 서버 def(그림은 Storage 주소) 바꾸기 + 올리기 캐시
   · closet-api.js — /v2/me/avatars… 서버 경로(provider) · closet.js — 받기 · 쓰기 · 동작 · 0.13 첫 실행 올리기(legacy-sync)
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const slotCodecMod = TwSlotCodec.createSlotCodec({
  glbUploadCache: uploadCacheMod,
  _quickHash: (...a)=>roomSyncMod._quickHash(...a),
  _storageFaceUrlOne: (...a)=>roomSyncMod._storageFaceUrlOne(...a),
  slotToObj: (...a)=>slotSaveMod.slotToObj(...a),
  uploadGlb: (...a)=>firebaseAPI.uploadSlotGlb(...a),   // 개인 GLB 는 아직 Storage 직접 올리기 — 주소만 서버 def 에 실린다
});
const closetApiMod = TwClosetApi.createClosetApi({
  authed: TwApi.authed,
  newRequestId: ()=>TwRequestId.newId(),
});
const closetMod = TwCloset.createCloset({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  closetApi: closetApiMod,
  codec: slotCodecMod,
  roomFaceCache: { load: (...a)=>roomSyncMod._roomFaceCacheLoad(...a), save: (...a)=>roomSyncMod._roomFaceCacheSave(...a) },
  slots: slots,
  slotSave: {   // 슬롯 저장 모듈이 내놓는 것 중 옷장이 쓰는 여섯
    applySlotObjs: (...a)=>slotSaveMod.applySlotObjs(...a),
    lastOut: (...a)=>slotSaveMod.lastOut(...a),
    onSaved: slotSaveMod.onSaved,
    pullForward: (...a)=>slotSaveMod.pullForward(...a),
    _relinkSeatsToSlots: (...a)=>slotSaveMod._relinkSeatsToSlots(...a),
    slotsReplaced: (...a)=>slotSaveMod.slotsReplaced(...a),
  },
  getMyUserId: (...a)=>getMyUserId(...a),
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
  toast: (...a)=>toast(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  creatorOpen: ()=>creatorOpen,
  curSlot: ()=>curSlot,
  storage: localStorage,
});
closetMod.onChange(()=>{ myInfoMod._miBoxChanged(); launcherCtlMod.renderEmptyState(); });   // 옷장이 바뀌면 [내 정보] 보관함 줄을 다시 그린다 — 내 정보가 옷장보다 먼저 만들어져 여기서 건다
/* 앱을 끄기 전 — main 이 끄기를 붙잡고 물으면 못 올린 캐릭터 고침을 올리고 기다린 뒤 답한다(상한 8초 · 없으면 바로 · shared/leave-flush.js) */
TwLeaveFlush.addQuitJob(closetMod.flushUnsaved);
window.addEventListener('beforeunload', ()=>{ closetMod.flushSlots(); });   // 다시 읽기(새로 고침)처럼 끄기를 거치지 않는 내림 — 결과를 기다리지 않는다

/* --- 복제 코드 (현재 base64. 다음 단계에서 AES 암호화로 교체) --- */
/* ★ onload 가 떴다고 그림이 있는 것은 아니다 — 잘린 dataURL, 0바이트 PNG 는 브라우저에 따라
   onerror 없이 **naturalWidth 0** 으로 onload 가 뜬다. 그 이미지를 drawImage 하면 아무것도
   안 그려지고, 그 빈 캔버스가 그대로 저장되면 얼굴이 영구히 사라진다(제보: "피부색만 보임").
   그래서 0크기와 빈 src 를 여기서 실패로 만든다 — 호출부가 실패를 실패로 다룰 수 있게. */
function loadImg(src){return new Promise((res,rej)=>{
  if(typeof src!=='string' || !src){ rej(new Error('이미지 원본이 비어 있음')); return; }
  const i=new Image();
  i.onload=()=>{ if(!i.naturalWidth || !i.naturalHeight) rej(new Error('이미지 크기가 0')); else res(i); };
  i.onerror=()=>rej(new Error('이미지 로드 실패'));
  i.src=src;});}

/* ============================================================ 🛡️ 얼굴 자동 복구 (워치독)
   [무엇을 고치나] 제보 — 클립스튜디오로 작업하는 동안, 아무것도 안 건드렸는데 실행 중에
     캐릭터 얼굴만 사라졌다. 몸·옷·책상은 멀쩡했고 동물 캐릭터도 무사했다.
     동물이 무사한 것이 결정적이다 — 동물은 텍스처를 animalBody(문자열)에서 만들고,
     인간은 def.face(살아 있는 캔버스)를 쓴다. **캔버스 백킹스토어가 회수된 그림**과 맞는다.
     JS 는 def.face 에 손댄 적이 없다(대입하는 곳은 친구 전용 네트워크 경로 두 줄뿐이다).
   [saveSlots 의 공백 방어와 무엇이 다른가]
     · saveSlots 쪽은 **저장을 막는다** — 원본이 빈 그림으로 덮이지 않게 한다(영구 소실 차단).
     · 여기는 **화면을 되돌린다** — 비어 버린 캔버스에 직전 저장 모양(서버에 올린 원본)을 다시 그려 넣는다.
     저장이 한 번도 안 도는 동안에는 saveSlots 쪽이 아예 실행되지 않으므로, 화면 복구는
     별도의 주기 점검이어야 한다. 그래서 둘 다 필요하다.
   [무엇을 안 건드리나]
     · 생성기가 열려 있는 동안은 쉰다 — 사용자가 «지우는 중»일 수 있고, 그때 되살리면
       방금 지운 그림이 눈앞에서 부활한다. 그건 복구가 아니라 버그로 보인다.
     · 동물(def.animal)은 건너뛴다 — 텍스처 경로가 통째로 달라(buildAnimalBase) 이 함수의
       재합성 규칙이 맞지 않는다. 애초에 이 사안의 피해자도 아니다.
     · _imgBroken(부팅 실패) 칸도 건너뛴다 — 그쪽은 이미 자기 보호막이 있고, 원본을 못 읽는
       상태라 다시 그려 봐야 같은 실패를 반복한다.
   ★ «원래부터 빈 얼굴»은 _faceEverDrawn 이 false 라 후보에 들지 않는다. 이미 손상된 저장본도
     마찬가지다(부팅에 빈 그림을 읽었으니 false) — 복구가 무한히 헛도는 일이 없다. */
/* 본문은 face-heal.js 로 옮겼다(앱 FSD 43번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const faceHealMod = TwFaceHeal.createFaceHeal({
  CANVAS_SZ: CANVAS_SZ,
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  lastOut: (...a)=>slotSaveMod.lastOut(...a),
  Presence: Presence,
  SKIN_COLORS: SKIN_COLORS,
  _blinkEverDrawn: _blinkEverDrawn,
  _faceEverDrawn: _faceEverDrawn,
  _isBlankDraw: (...a)=>_isBlankDraw(...a),
  creatorOpen: ()=>creatorOpen,
  loadImg: (...a)=>loadImg(...a),
  loadSkins: (...a)=>loadSkins(...a),
  seats: seats,
  skinCanvasFor: (...a)=>skinCanvasFor(...a),
  skinCanvases: skinCanvases,
  slots: slots,
  toast: (...a)=>toast(...a),
  diagNote: (...a)=>{ if(window.companion && companion.diagNote) companion.diagNote(...a); },
  loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),
});

/* ===== 진짜 암호화: AES-256-GCM + PBKDF2(150k) ===== */
/* 본문은 code-crypto.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const codeCryptoMod = TwCodeCrypto.createCodeCrypto({
  charCore: TwCharCore,
  charDef: (...a)=>charDef(...a),
  loadImg: (...a)=>loadImg(...a),
  newCanvas: (...a)=>newCanvas(...a),
});

/* ===== 풀 GLB 파일 암호화 (.dcc) ===== */
/* 본문은 asset-code.js 로 옮겼다(앱 FSD 48번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const assetCodeMod = TwAssetCode.createAssetCode({
  codeCryptoMod: codeCryptoMod,
  loader: loader,
});
/* ===== 커미션 캐릭터 zip 코드 시스템 =====
   관리자가 zip(character.glb + face.png + blink.png)을 코드로 만들어 고객에게 전달.
   고객이 캐릭터 생성창의 [+ 코드 입력하기]로 받아서 책상 세팅 단계부터 진입.
   - 텍스처는 자동 512×512로 리사이즈
   - 한도 2MB (압축 풀린 zip 내부 합계)
   - 1~4단계 잠금 (피부/표정/감은눈/색상은 완성형이라 수정 불가)
*/
/* 본문은 commission.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const commissionMod = TwCommission.createCommission({
  _b64: (...a)=>codeCryptoMod._b64(...a),
  _deriveKey: (...a)=>codeCryptoMod._deriveKey(...a),
  _unb64: (...a)=>codeCryptoMod._unb64(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  accountStore: accountStoreMod,
});
/* 저장된 아이템(이 계정이 코드로 추가한 것)은 확인 뒤 계정 칸에서 읽는다(userLocal 칸 savedItems) — 만들 때는 비어 있다. 카탈로그 아이템은 카탈로그 동기화가 등록한다. */
/* 커스텀 아이템 레지스트리 (생성기 세션) */
let customItems={};

/* ═══ 🧊 파츠 GLB 파싱 캐시 · 썸네일 ═══ */
/* 본문은 character/part-scene.js 로 옮겼다(구역 떼기 C · w2).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const partSceneMod = TwPartScene.createPartScene({
  FLAT_EMISSIVE: lightToneMod.FLAT_EMISSIVE,
  TONE_FRONT_TOTAL: lightToneMod.TONE_FRONT_TOTAL,
  _applyPartMatTone: (...a)=>lightToneMod._applyPartMatTone(...a),
  addRunLights: (...a)=>lightToneMod.addRunLights(...a),
  assetCodeMod: assetCodeMod,
  b64ToBuf: (...a)=>b64ToBuf(...a),
  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),
  runLightAt1: (...a)=>lightToneMod.runLightAt1(...a),
});
/* 카탈로그 서버 한 벌(GET /v2/catalog — 로그인 뒤 · 서버가 정한 locked 를 그대로 · 못 받으면 E-CHAR-26) — catalog-sync · catalog-glb · 관리자 쓰기가 같이 쓴다 */
const catalogApiMod = TwCatalogApi.createCatalogApi({
  api: TwApi.authed,
  rt: TwRtHub.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  fetch: (...a)=>window.fetch(...a),
  storageBucket: ()=>firebaseAPI.storageBucket(),
});

/* 본문은 admin/admin-thumbs.js 로 옮겼다(구역 떼기 C · w2). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const adminThumbs = TwAdminThumbs.createAdminThumbs({
  catalogAdmin: catalogAdmin,
  gachaMod: ()=>gachaMod,
  isAdmin: ()=>isAdmin,
  partSceneMod: partSceneMod,
  premiumMod: premiumMod,
  toast: (...a)=>toast(...a),
  wardrobeMod: wardrobeMod,
});

/* ═══ 💾 카탈로그 GLB 영구 캐시(IndexedDB) · URL 해결 ═══ */
/* 본문은 shared/glb-idb-cache.js 로 옮겼다(구역 떼기 C · w2).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({
});

/* 본문은 character/catalog-glb.js 로 옮겼다(구역 떼기 C · w2).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const catalogGlbMod = TwCatalogGlb.createCatalogGlb({
  catalogApiMod: catalogApiMod,
  glbIdbMod: glbIdbMod,
});

/* ═══ 🔄 카탈로그 실시간 동기화 — 아이템 · 책상 · 파츠 · 카테고리 ═══ */
/* 본문은 character/catalog-sync.js 로 옮겼다(구역 떼기 C · w2). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const catalogSyncMod = TwCatalogSync.createCatalogSync({
  applyInteractionUnlocks: (...a)=>iDeskMod.applyUnlocks(...a),
  setAnimalUnlockLevel: (...a)=>window._setAnimalUnlockLevel(...a),
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  activeCustomDeskId: ()=>crState.activeCustomDeskId,
  adminCategory: adminCategory,
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),
  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),
  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),
  assetCodeMod: assetCodeMod,
  b64ToBuf: (...a)=>b64ToBuf(...a),
  cBase: ()=>crState.cBase,
  cDesk: ()=>crState.cDesk,
  cDeskColor: ()=>crState.cDeskColor,
  cDeskGlbB64: ()=>crState.cDeskGlbB64,
  cDeskScale: ()=>crState.cDeskScale,
  cDeskTemplate: ()=>crState.cDeskTemplate,
  catalogApiMod: catalogApiMod,
  catalogGlbMod: catalogGlbMod,
  clearHolderDeskItems: (...a)=>creatorPrevMod.clearHolderDeskItems(...a),
  commissionMod: commissionMod,
  creatorOpen: ()=>creatorOpen,
  customItems: ()=>customItems,
  equipDeskItem: (...a)=>equipDeskItem(...a),
  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),
  gachaMod: ()=>gachaMod,
  loadSavedItemsIntoSession: (...a)=>loadSavedItemsIntoSession(...a),
  premiumMod: premiumMod,
  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),
  renderCrItems: (...a)=>deskSetupMod.renderCrItems(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  rideBenchMod: rideBenchMod,
  seats: seats,
  setCreatorDeskScale: (...a)=>deskPlaceMod.setCreatorDeskScale(...a),
  swapDeskVisual: (...a)=>deskVisualMod.swapDeskVisual(...a),
  toast: (...a)=>toast(...a),
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  wardrobeMod: wardrobeMod,
  setCDeskGlbB64: (v)=>{ crState.cDeskGlbB64 = v; },
  setCDeskTemplate: (v)=>{ crState.cDeskTemplate = v; },
});
/* 본문은 character/desk-visual.js 로 옮겼다(구역 떼기 C · w2). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskVisualMod = TwDeskVisual.createDeskVisual({
  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,
  NO_DESK_ID: NO_DESK_ID,
  _applyItemMatTone: (...a)=>lightToneMod._applyItemMatTone(...a),
  _idleItemPivots: _idleItemPivots,
  _setDeskMatColor: (...a)=>lightToneMod._setDeskMatColor(...a),
  activeItemMixers: activeItemMixers,
  assetCodeMod: assetCodeMod,
  b64ToBuf: (...a)=>b64ToBuf(...a),
  commissionMod: commissionMod,
  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),
  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),
  setDeskScale: (...a)=>deskPlaceMod.setDeskScale(...a),
  toast: (...a)=>toast(...a),
});
/* (구역 떼기 C · w2) 이 자리의 본문도 character/catalog-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기 ═══ */
/* 본문은 character/desk-items.js 로 옮겼다(구역 떼기 C · w2). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskItemsMod = TwDeskItems.createDeskItems({
  DESK_ITEMS: DESK_ITEMS,
  _applyItemMatTone: (...a)=>lightToneMod._applyItemMatTone(...a),
  commissionMod: commissionMod,
  customItems: ()=>customItems,
});

/* 저장된 모든 아이템 코드를 customItems에 등록 (생성기 진입 시 호출) */
async function loadSavedItemsIntoSession(){
  const failed=[];
  for(const rec of commissionMod.savedItems()){
    if(!rec.glb && rec.glbUrl) continue;   // 카탈로그 GLB 를 아직 안 받았다 — 첫 화면 뒤 catalogSyncMod.fillGlb 가 받고 다시 합친다(실패가 아니다)
    // ★ 이미 등록돼 있어도 건너뛰지 않고 항상 다시 불러옴 — 카탈로그에서 GLB가 교체됐을 때
    //   (관리자가 우클릭 수정 등) customItems가 옛날 것으로 캐시된 채 남아있으면 실시간 반영이 안 됨.
    try{ const buf=b64ToBuf(rec.glb); const {scene,animations}=await assetCodeMod.parseGlbFull(buf);
      deskItemsMod.registerCustomItem(rec.id, rec.name, rec.glb, scene, rec.icon||'', animations, rec.attachTo, rec.autoPlay, rec.defaultSize, rec.glow, rec.licenseOnly, rec.playMode);
    }catch(e){ console.warn('[저장 아이템] 등록하지 못했어요 — ' + rec.id, e); failed.push(rec.id); }   // 한 개가 깨져도 나머지는 등록한다
  }
  if(failed.length) TwErrorCodes.notify('E-CHAR-25', failed.join());   // 깨진 것은 사용자에게도 한 번 알린다
}

/* (구역 떼기 C · w2) 이 자리의 본문도 character/desk-visual.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 본문은 character/desk-place.js 로 옮겼다(구역 떼기 C · w2).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const deskPlaceMod = TwDeskPlace.createDeskPlace({
  CHAR_Z: CHAR_Z,
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,
  DESK_SCALE_MAX: DESK_SCALE_MAX,
  DESK_SCALE_MIN: DESK_SCALE_MIN,
  crState: crState,
});
/* ═══ 📌 책상 위 파츠 앵커 · 책상 위치 · 배율 ═══ */
/* (구역 떼기 C · w2) 이 자리의 본문도 character/desk-place.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 본문은 character/seat-eq-clamp.js 로 옮겼다(구역 떼기 C · wAC). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const seatEqClampMod = TwSeatEqClamp.createSeatEqClamp({
  DESK_PART_ANCHOR_NAME: deskPlaceMod.DESK_PART_ANCHOR_NAME,
  MULTIPLAYER_SPACING: ()=>seatsMod.MULTIPLAYER_SPACING(),
  SPACING: ()=>seatsMod.SPACING(),
  seatHalfWidth: (...a)=>seatLayoutMod.seatHalfWidth(...a),
  seatEqMod: seatEqMod,
  seatSlot: ()=>seatSlot,
  seats: seats,
});
const seatSlot = (typeof SeatSlot === 'undefined') ? null : SeatSlot.createSeatSlot({ THREE });
/* (구역 떼기 C · w2) 이 자리의 본문도 character/desk-place.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* ═══ 📦 복제 코드 불러오기 · 내보내기 · 풀 GLB ═══ */
/* 본문은 char-code.js 로 옮겼다(앱 FSD 38번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const charCodeMod = TwCharCode.createCharCode({
  CHAR_SLOT_MAX: CHAR_SLOT_MAX,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  closeGearMenu: (...a)=>launcherCtlMod.closeGearMenu(...a),
  createSeat: (...a)=>createSeat(...a),
  curSlot: ()=>curSlot,
  decryptCode: (...a)=>codeCryptoMod.decryptCode(...a),
  encryptCode: (...a)=>codeCryptoMod.encryptCode(...a),
  focusLevelMod: ()=>focusLevelMod,
  gachaMod: ()=>gachaMod,
  isAdmin: ()=>isAdmin,
  isPremium: ()=>isPremium,
  premiumKnown: ()=>acctStateMod.premiumKnown(),
  layoutSeats: (...a)=>layoutSeats(...a),
  loadCharGLB: (...a)=>seatModelLoadMod.loadCharGLB(...a),
  overheadMod: overheadMod,
  premiumMod: premiumMod,
  renderLauncher: (...a)=>renderLauncher(...a),
  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  scene: scene,
  seats: seats,
  selectSeat: (...a)=>seatPanelMod.selectSeat(...a),
  slots: slots,
  toast: (...a)=>toast(...a),
  setCurSlot: (v)=>{ curSlot = v; },
});

/* ═══ 🍞 토스트(toast) · 저장 실패 문구 ═══ */
/* 본문은 shared/toast.js 로 옮겼다(구역 떼기 C · w2). toast · _saveFailMsg 는 app.js 곳곳 · 다른 파일(전역 · window.toast)이 그대로 부르므로 같은 이름의 이음 함수를 둔다 — 부르는 줄은 안 바꿨다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const toastMod = TwToast.createToast({
});
function _saveFailMsg(...a){ return toastMod._saveFailMsg(...a); }   // 옛 전역 이름 — 다른 모듈이 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)
function toast(...a){ return toastMod.toast(...a); }   // 옛 전역 이름 — 다른 모듈 · window.toast 가 아직 전역으로 부른다(도메인 단계에서 deps 로 바꾸고 걷는다)

/* ============================================================ ANIM */
/* 본문은 character/rig-anim.js 로 옮겼다(앱 FSD · app.js 분리 M15). 원래 자리인 여기서 만든다.
   다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다. */
const rigAnimMod = TwRigAnim.createRigAnim({
  ANIMAL_HAND_REST: ANIMAL_HAND_REST,
  camera: camera,
  iDeskMod: iDeskMod,
  rideTuneMod: rideTuneMod,
  seatPointerMod: seatPointerMod,
  userStatusMod: userStatusMod,
});
const STATES = rigAnimMod.STATES;   // 옛 전역 이름
const targetFor = rigAnimMod.targetFor;   // 옛 전역 이름
const lerp = rigAnimMod.lerp;   // 옛 전역 이름
const SPINE_AXIS = rigAnimMod.SPINE_AXIS;   // 옛 전역 이름
const HEAD_AXIS = rigAnimMod.HEAD_AXIS;   // 옛 전역 이름
const HAND_REST = rigAnimMod.HAND_REST;   // 옛 전역 이름
const FOCUS_ARM_LIFT = rigAnimMod.FOCUS_ARM_LIFT;   // 옛 전역 이름
const SHAKE_ARM_DROOP = rigAnimMod.SHAKE_ARM_DROOP;   // 옛 전역 이름
const boneSide = rigAnimMod.boneSide;   // 옛 전역 이름
const setBone = rigAnimMod.setBone;   // 옛 전역 이름
const animateRig = rigAnimMod.animateRig;   // 옛 전역 이름
const setClip = rigAnimMod.setClip;   // 옛 전역 이름

/* 본문은 launcher/frame-pace.js 로 옮겼다(앱 FSD · app.js 분리 M16). 원래 자리인 여기서 만든다 — 타이머 · 포커스 듣기가 예전과 같은 때 걸린다.
   다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다. */
const framePaceMod = TwFramePace.createFramePace({
  _flyActive: ()=>flyChairMod._flyActive(),
  _renderQuality: ()=>_renderQuality,
  setRunLowered: (v)=>{ _runLowered = v; },
  creatorOpen: ()=>creatorOpen,
  frame: (...a)=>frame(...a),
  renderer: renderer,
  seatCameraMod: seatCameraMod,
  seatPointerMod: seatPointerMod,
  seats: seats,
});
const _FB = framePaceMod._FB;   // 옛 전역 이름
const _frameBudget = framePaceMod._frameBudget;   // 옛 전역 이름
const _runSlowWatch = framePaceMod._runSlowWatch;   // 옛 전역 이름
const _gpuTimer = framePaceMod._gpuTimer;   // 옛 전역 이름
const _frameJsStats = framePaceMod._frameJsStats;   // 옛 전역 이름
const _lowerRunQuality = framePaceMod._lowerRunQuality;   // 옛 전역 이름
const _uiHot = framePaceMod._uiHot;   // 옛 전역 이름
const _frameCap = framePaceMod._frameCap;   // 옛 전역 이름
const _frameCapped = framePaceMod._frameCapped;   // 옛 전역 이름
/* 🗺️ 클릭 통과 히트 맵 — 좌석 조각의 경계 구를 화면 사각형으로(room/seat-hit-targets.js · launcher/hit-map.js). 판정이 찾을 때 마지막으로 그린 장의 행렬로 만든다.
   0.12.4 는 그림자 운행: 통과 판정의 답은 옛 판정 그대로, desktop-run 이 새 판정을 옆에서 돌려 hitShadow 에 센다(1분 [지도] 줄). */
const hitShadow = TwHitShadow.createHitShadow();
/* 설정(런처) 화면이 #scene 을 가리는가 — frame() 이 그리기를 건너뛰는 조건 · 히트 맵이 빈 지도를 만드는 조건 한 곳 */
function _configHidesScene(){ return document.body.classList.contains('desktop') && document.body.classList.contains('config'); }
const seatHitMod = TwSeatHitTargets.createSeatHitTargets({
  THREE: THREE,
  hitMap: TwHitMap,
  seats: seats,
  camera: camera,
  ray: ray,
  canvasRect: (...a)=>overheadMod.canvasRect(...a),
  officeHidden: ()=>officeModeMod._officeHidden(),
  configHidden: ()=>_configHidesScene(),
  isRunmode: ()=>document.body.classList.contains('runmode'),
  partSkipped: (...a)=>hiddenSeatsMod._partSkipped(...a),
  skipHits: (...a)=>hiddenSeatsMod._skipUnhittable(...a),
  now: ()=>performance.now(),
  noteBuild: (...a)=>hitShadow.build(...a),
});
/* 🩺 1분 진단 줄([비용] · [프레임])은 launcher/run-diag-minute.js 로 옮겼다 — 만들 때 한 번 돈다. */
const runDiagMinuteMod = TwRunDiagMinute.createRunDiagMinute({
  Presence: Presence,
  _FB: _FB,
  _bodyHidden: (...a)=>hiddenSeatsMod._bodyHidden(...a),
  _frameBudget: _frameBudget,
  _frameCap: (...a)=>_frameCap(...a),
  _frameJsStats: _frameJsStats,
  _gpuTimer: _gpuTimer,
  _renderQuality: ()=>_renderQuality,
  _runLowered: ()=>_runLowered,
  canvas: canvas,
  hitShadow: hitShadow,
  key: key,
  renderer: renderer,
  runCost: runCost,
  scene: scene,
  seats: seats,
});
/* 본문은 launcher/frame-loop.js 로 옮겼다(앱 FSD · app.js 분리 M17). 원래 자리인 여기서 만든다 — 만들기만 하고 부르지 않는다(첫 부름은 INIT 의 requestAnimationFrame(frame)).
   뒤에서 선언되거나 다시 대입되는 값은 읽는 함수로 넘긴다. */
const frameLoopMod = TwFrameLoop.createFrameLoop({
  _configHidesScene: _configHidesScene,
  _frameCap: _frameCap,
  _frameCapped: _frameCapped,
  _frameJsStats: _frameJsStats,
  _gpuTimer: _gpuTimer,
  _lowerRunQuality: _lowerRunQuality,
  _renderQuality: ()=>_renderQuality,
  _runSlowWatch: _runSlowWatch,
  activeItemMixers: activeItemMixers,
  animateRig: animateRig,
  awayPicMod: ()=>awayPicMod,
  camera: camera,
  desktopMode: ()=>desktopMode,
  dotRenderMod: dotRenderMod,
  expBarMod: ()=>expBarMod,
  floatersMod: floatersMod,
  focusLevelMod: ()=>focusLevelMod,
  focusProgressMod: ()=>focusProgressMod,
  framePaceMod: framePaceMod,
  getDisplayName: getDisplayName,
  listenUi: ()=>listenUi,
  myCode: ()=>TwRoomRt.store.myCode(),
  hiddenSeatsMod: hiddenSeatsMod,
  lerp: lerp,
  matToneMod: matToneMod,
  officeModeMod: ()=>officeModeMod,
  overheadMod: overheadMod,
  Presence: Presence,
  renderer: renderer,
  rideBenchMod: rideBenchMod,
  runCost: runCost,
  scene: scene,
  seatCharZ: seatCharZ,
  seatEqClampMod: seatEqClampMod,
  seatEqMod: seatEqMod,
  seatHitMod: seatHitMod,
  seatPanelMod: seatPanelMod,
  seatPointerMod: seatPointerMod,
  seats: seats,
  seatsMod: seatsMod,
  seatState: seatState,
  seatStateMod: seatStateMod,
  setClip: setClip,
  setSeatOpacity: setSeatOpacity,
  STATES: STATES,
  statusChipMod: statusChipMod,
  statusConfFor: statusConfFor,
  targetFor: targetFor,
  tricksMod: tricksMod,
  updateActivePartPlayback: updateActivePartPlayback,
  updateIdleItemPlayback: updateIdleItemPlayback,
  updateItemHandTrackers: updateItemHandTrackers,
  userStatusMod: userStatusMod,
});
const frame = frameLoopMod.frame;   // 옛 전역 이름

/* ============================================================ 데스크탑(Electron) 모드 */
/* 본문은 launcher/office-mode.js 로 옮겼다(앱 FSD · app.js 분리 M14). 원래 자리인 여기서 만든다 — 깃발을 읽고 상태칩 우클릭을 거는 때가 예전과 같다.
   뒤에서 선언되는 값은 읽는 함수로 넘긴다. 깃발을 최상위에서 읽는 코드는 이 줄 아래에 둔다(TDZ). */
const officeModeMod = TwOfficeMode.createOfficeMode({
  chipPopupsMod: chipPopupsMod,
});
const desktopMode = officeModeMod.desktopMode;   // 옛 전역 이름
const FIGURE_MODE_KEY = officeModeMod.FIGURE_MODE_KEY;   // 옛 전역 이름
const OFFICE_MODE_KEY = officeModeMod.OFFICE_MODE_KEY;   // 옛 전역 이름
const refreshOfficeChipUI = officeModeMod.refreshOfficeChipUI;   // 옛 전역 이름
/* 본문은 shared/ls-set.js 로 옮겼다(앱 FSD · app.js 분리 M14). 설정 저장 헬퍼 — 쓰는 곳은 deps 로 `_lsSet` 을 받는다. */
const lsSetMod = TwLsSet.createLsSet({
  toast: toast,
});
const _lsSet = lsSetMod._lsSet;   // 옛 전역 이름

/* 포커싱 어플 게이트 — true면 자동 idle/focus 판정을 sleep으로 강제(=잠듦).
   등록된 앱이 하나도 없으면 항상 true, 등록된 앱이 있으면 "그 앱이 지금 활성 상태"일 때만 false.
   (피규어 모드면 초기값부터 false로 시작 — 첫 폴링 전까지 잠깐 잠든 것처럼 보이는 지연 방지) */
let focusGateSleep = !officeModeMod.figureMode();
/* ===== 포커스 시간 누적 + 레벨 시스템 =====
   평생 누적 포커스 시간 1시간당 레벨 1 상승, 최대 999레벨(999시간 달성 시 더 안 늘어남).
   오늘 하루 누적은 [기록 열기] 팝업에 hh:mm:ss로 표시(자정 지나면 0으로 리셋, 레벨엔 영향 없음 — 평생 누적 별도). */
/* 본문은 focus-total.js 로 옮겼다(앱 FSD 45번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const focusTotalMod = TwFocusTotal.createFocusTotal({
  focusTotalStore: accountStoreMod,
});

/* ═══ 📊 오늘 기록 전시 (2026-09-23 · handoff-2026-09-21-features §3 · 사용자 확정: 🕒 를 눌러 켜고 끈다) ═══
   포커스 기록창 첫 줄(현재/누적 기록) 옆 🕒(#focusLogShowClock)를 누르면 켜짐/꺼짐.
   켜지면 방 사람들 화면의 내 머리 위에 «오늘 H:MM». **초는 보내지 않는다.** 1분에 한 번 갱신(2026-09-23 요청).
   ★ 이모지 칸은 비운다 — 커스텀 상태 배관이라 이모지를 넣으면 캐릭터 앞(책상 위)에도 같이 떴다(제보).
   ★ 배관은 커스텀 상태 그대로(Presence.setFocusShow → _statusOut) — 규칙 · 필드 변경 없음.
   ★ 상태가 켜져 있으면 그것이 먼저 보이고, 상태를 끄면 기록이 보인다(_statusOut · statusConfFor).
   ★ 회사원 모드에서는 안 보낸다(토글을 켜 둬도 null). 모드를 켜는 순간 거둔다(progOfficeModeToggle).
   ★ 켜짐은 기억한다(tw.focusShow) — 설정 성격의 작은 값이라 _lsSet.
   ⚠️ 값은 보내는 쪽이 정한다(setLevel 과 같은 수준). 랭킹을 붙일 거면 서버 값이 필요하다. */
/* 본문은 focus-share.js 로 옮겼다(앱 FSD 45번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const focusShareMod = TwFocusShare.createFocusShare({
  Presence: Presence,
  _lsSet: (...a)=>_lsSet(...a),
  _rolloverFocusToday: (...a)=>focusTotalMod._rolloverFocusToday(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  toast: (...a)=>toast(...a),
  userStatus: ()=>userStatusMod.userStatus(),
});

/* ═══ 🫧 자리비움 그림 (2026-09-23 · handoff-2026-09-21-features §2 · 시안 A 확정 · 500×500 · 캐릭터 자리) ═══════════
   [내 정보] 머리 아래 «자리비움 그림» 칸에서 투명 PNG 를 등록하면, 자리비움일 때 **캐릭터 자리에** 그 그림이 선다
   (내 화면 + 방 사람들 화면). 등록 안 한 사람 · 구버전 · 못 불러온 그림은 예전 그대로(투명 캐릭터 + 책상 🫧).
   ★ 그림은 500×500 캔버스에 비율 유지로 맞춰 **WebP** 로 굽는다(투명 유지). 300KB 를 넘으면 품질을 낮춰 다시 굽고,
     끝까지 넘으면 올리지 않는다. Storage 규칙도 `away/` 경로만 300KB 미만(users/ 2MB 와 별개 경로 — 규칙이 OR 라서).
   ★ 전파는 URL 한 줄 — users/{uid}/awayImg(기기 간) + 방 payload awayImg. Storage 주소(https://firebasestorage.googleapis.com/)
     가 아니면 받는 쪽이 버린다(_awayUrlOk) — 아무 주소나 방 사람들 화면에서 불러오게 두지 않는다.
   ★ 원격 주소를 3D 로 그리는 것은 방 얼굴(_loadImgCors)이 이미 하는 길 그대로다. 못 불러오면 조용히 🫧.
   ★ 회사원 모드에서는 그림을 세우지 않는다(보는 사람 기준 · 예전 모양).
   ⚠️ 관리자가 [그림 내리기] 하면 users/{uid}/awayImg 와 파일이 지워진다 — 파일이 없으니 남들 화면은 곧바로 🫧,
     본인 기기는 다음 부팅의 _awayBootSync 가 로컬 값을 비운다. */
/* 본문은 away-pic.js 로 옮겼다(앱 FSD 22번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const awayPicMod = TwAwayPic.createAwayPic({
  Presence: Presence,
  _loadImgCors: (...a)=>roomSyncMod._loadImgCors(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  camera: camera,
  charLiftWorld: (...a)=>seatEqMod.charLiftWorld(...a),
  findMySeat: (...a)=>findMySeat(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),
  measureHeadBoxNoParts: (...a)=>charMeasureMod.measureHeadBoxNoParts(...a),
  officeMode: ()=>officeModeMod.officeMode(),
  renderer: renderer,
  seats: seats,
  toast: (...a)=>toast(...a),
  userApi: ()=>userApiMod,
  awayOthers: awayOthersMod,
});

/* ═══ 🚩 신고하기 ═══════════════════════════════════════════════════════════
   좌석 · 책상 · 이름표 우클릭 «🚩 신고하기…» → 사유 라디오(캐릭터 · 자리비움 그림 · 닉네임 · 기타 40자) → [신고].
   ★ 신고는 서버 경로(support/report-api.js — POST /v2/reports) — 신고한 사람은 서버가 토큰에서 정한다.
   ★ 신고하면 내 화면에서 그 사람을 숨긴다(_reportHiddenUids · 계정 기준 · 모든 방).
   신고 창 · 공용 도우미는 report.js, 관리자 신고 목록은 admin/admin-report.js. 팝업 칸은 report.js 가 가진다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const reportMod = TwReport.createReport({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  seatLabelName: (...a)=>overheadMod._seatLabelName(...a),
  awayUrlOk: (...a)=>awayPicMod._awayUrlOk(...a),
  reportHiddenSave: (...a)=>hiddenSeatsMod._reportHiddenSave(...a),
  reportHiddenUids: hiddenSeatsMod._reportHiddenUids,
  reportApi: TwReportApi.createReportApi({ authed: TwApi.authed, errs: TwApiErrors }),   // 🌐 POST /v2/reports — 원본은 서버
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
const adminReport = TwAdminReport.createAdminReport({
  toast: (...a)=>toast(...a),
  awayUrlOk: (...a)=>awayPicMod._awayUrlOk(...a),
  isAdmin: ()=>isAdmin,
  reportClose: (...a)=>reportMod.close(...a),
  reportBox: (...a)=>reportMod.box(...a),
  kinds: reportMod.KINDS,
  adminMin: reportMod.ADMIN_MIN,
  reportOv: (...a)=>reportMod.ov(...a),
  setReportOv: (...a)=>reportMod.setOv(...a),
  reportEsc: (...a)=>reportMod.esc(...a),
  setReportEsc: (...a)=>reportMod.setEsc(...a),
  adminApi: TwReportApi.createAdminReportApi({ authed: TwApi.authed, errs: TwApiErrors }),   // 🌐 /v2/admin/reports* — 원본은 서버
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
});
/* 🐞 버그제보 게시판 — 원본은 서버(support/bug-api.js — /v2/bugs*). 만들 때는 버튼만 잇고, 배지 받기는 app-boot STEPS 의 bugBadge(start) · 계정을 놓을 때 reset. */
const bugBoardUi = TwBugBoardUi.createBugBoardUi({
  bugApi: TwBugApi.createBugApi({ authed: TwApi.authed, errs: TwApiErrors, pending: ()=>TwRequestId.createPending() }),
  lib: TwBugBoard,
  apiErrors: TwApiErrors.store,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  safeHtml: TwSafeHtml,
  isAdmin: ()=>isAdmin,
  bugReportLink: ()=>{ const s = acctStateMod._rcStore(); return s ? s.bugReportLink() : ''; },   // 답변 칸 [💬 오픈카톡] 기본 주소
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
});

/* ═══ ⭐ 포커스 레벨 · 해금 안내 · 회차 별 색 ═══ */
/* 본문은 focus-level.js 로 옮겼다(앱 FSD 26번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
/* ⏱ 포커스 진척 — 레벨 · 회차 · 별 색은 서버 값, 이 PC 는 못 올린 초만(focus/focus-progress.js). 시작은 계정 확인 뒤 app-boot 의 focusLevel 차례 */
const focusApiMod = TwFocusApi.createFocusApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) });   // 진척 · 폰 키가 같은 하나 — 읽은 토큰 주인을 같이 쓴다
const focusProgressMod = TwFocusProgress.createFocusProgress({
  focusApi: focusApiMod,
  focusStore: accountStoreMod,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  setServerDay: (t)=>focusTotalMod.setServerDay(t),
  addQuitListener: (fn)=>window.addEventListener('beforeunload', fn),
});
const focusLevelMod = TwFocusLevel.createFocusLevel({
  onFocusAdded: (sec)=>roomFocusSync.add(sec),
  progress: focusProgressMod,
  _focusTotalStarted: ()=>focusTotalMod._focusTotalStarted(),
  FOCUS_CYCLE_CAP: focusTotalMod.FOCUS_CYCLE_CAP,
  FOCUS_CYCLE_SEC: focusTotalMod.FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS: focusTotalMod.FOCUS_LEVEL_CAP_HOURS,
  Presence: Presence,
  _acctDetached: ()=>acctStateMod._acctDetached(),
  _focusSessionSec: ()=>focusTotalMod._focusSessionSec(),
  addFocusToday: (...a)=>focusTotalMod.addFocusToday(...a),
  findMySeat: (...a)=>findMySeat(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  focusApi: focusApiMod,
  focusStore: accountStoreMod,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  rtOnMessage: (...a)=>TwRtHub.store.onMessage(...a),
  serverNow: ()=>TwRtHub.store.serverNow(),   // 방 밖 서버 시계(ready.now) — 모르면 null
  toast: (...a)=>toast(...a),
  wdDraftDef: ()=>wardrobeMod.wdDraftDef(),
  setFocusSessionSec: (v)=>{ focusTotalMod.setFocusSessionSec(v); },
});

focusTotalMod.onDayEnd(()=>{ focusProgressMod.refreshDay(); });   // 하루가 바뀐 때 서버에 새 날을 한 번 묻는다
focusProgressMod.onChange(()=>{ myInfoMod.onProgressChanged(); });   // 진척이 바뀌면 내 정보 머리 · 별 색 구획을 다시 그린다

/* ═══ 🎰 가챠 모듈 연결 ═══ */
/* 🎰 파츠 가챠 — 코어(서버 보유분 · 뽑기 · 미보유 파츠 회수)와 도감(꾸미기 창 «도감» 탭 · T) · 뽑기 창은 character/gacha.js 로 옮겼다.
   ★ 원래 자리인 여기서 만든다 — 만들 때는 창 버튼 · 끌기 · ESC · 바깥 클릭 · blur 연결만 한다. 서버에서 받기는 계정 확인 뒤 startGacha()(app-boot).
   함수 deps 는 화살표로 감싼다(부를 때 찾게). isAdmin · savedParts · PART_CATS · wdDraftDef · activeWdAdj 는 다시 대입되는 let 이라 읽는 함수로,
   activeWdAdj 를 바꾸는 것은 쓰는 함수로 넘긴다. seats · slots · Presence 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   부르는 곳은 gachaMod.이름(전부 이 줄보다 늦게 돈다). 바로 아래 🔑 «서버가 조용히 거부하는 기기» 안내는 캐릭터 슬롯도 써서 여기 남겼다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다.
   ⚠️ 이름을 gacha 로 짓지 않은 까닭 — partsInCatFor(cat, gacha) · 파츠 등록의 const gacha 가 가린다. */
/* 🎰 가챠 서버 경로 — 서버가 뽑고 저장한다(character/gacha-api.js) · 로그인 통로는 TwApi.authed */
const gachaApiMod = TwGachaApi.createGachaApi({
  authed: TwApi.authed,
  newRequestId: ()=>TwRequestId.newId(),
});
const gachaMod = TwGacha.createGacha({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  shownFocusLevel: (...a)=>focusLevelMod.shownFocusLevel(...a),
  levelCap: focusTotalMod.FOCUS_LEVEL_CAP_HOURS,
  catEquippedIds: (...a)=>premiumMod.catEquippedIds(...a),
  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),
  unequipStackablePart: (...a)=>unequipStackablePart(...a),
  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),
  applyClothVisibility: (...a)=>applyClothVisibility(...a),
  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),
  findMySeat: (...a)=>findMySeat(...a),
  escHtml: (...a)=>escHtml(...a),
  toggleEquip: (...a)=>wardrobeMod.toggleEquip(...a),
  createWardrobeAdjPanel: (...a)=>wardrobeMod.createWardrobeAdjPanel(...a),
  clearMultiPanelRef: (...a)=>wardrobeMod._clearMultiPanelRef(...a),
  refreshWdPreviewColorSection: (...a)=>wardrobeMod.refreshWdPreviewColorSection(...a),
  updateWdGizmoForActivePanel: (...a)=>wardrobeMod.updateWdGizmoForActivePanel(...a),
  twNav: twNav,
  isAdmin: ()=>isAdmin,
  savedParts: ()=>premiumMod.savedParts(),
  partCats: ()=>premiumMod.PART_CATS(),
  wdDraftDef: ()=>wardrobeMod.wdDraftDef(),
  activeWdAdj: ()=>wardrobeMod.activeWdAdj(),
  setActiveWdAdj: (v)=>{ wardrobeMod.setActiveWdAdj(v); },
  seats: seats,
  slots: slots,
  presence: Presence,
  isGachaPart: (...a)=>premiumMod.isGachaPart(...a),
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  gachaApi: gachaApiMod,
  rtOn: (kind, fn)=>TwRtHub.store.on(kind, fn),
});
/* 🛠 가챠 보관함의 관리자 등록 · 삭제 — 관리자 모듈이 가챠보다 먼저 만들어져 여기서 건다(가챠는 관리자 모듈을 부르지 않는다) */
gachaMod.setPartEditor({
  openPartRegister: (...a)=>adminPartReg.openPartRegister(...a),
  syncPartRegGachaLock: (...a)=>adminPartReg.syncPartRegGachaLock(...a),
  deletePart: (...a)=>adminPartReg.deletePart(...a),
});

/* ═══ 🎨 디자인 테마 ═══════════════════════════════════════════════════════
   축이 두 개다 — '모양'(테마)과 '색'(액센트). 두 축은 독립이라 2×5=10가지가 나온다.
     · 모양 : <html data-theme>  = (없음)=기본 / "bubble"
     · 색   : <html data-accent> = c1~c5
   실제 색·모서리·글꼴 값은 전부 HTML의 CSS 변수에 있다. 여기서는 속성만 건다.

   ★ 색상 5칸의 '내용'은 테마마다 다르다(CSS에서 html[data-theme="bubble"][data-accent=...]로 덮어씀).
     Win98은 채도 높은 색이, 버블은 파스텔이 어울려서 같은 색표를 공유하면 한쪽이 반드시 촌스러워진다.
   ★ 저장은 localStorage 2개(tw.theme / tw.accent). 계정 동기화로 옮기려면 이 두 값만 서버에 얹으면 된다.
   ★ 부팅 시 최대한 이른 시점에 applyTheme()을 부른다 — 늦게 부르면 기본 테마가 한 프레임 번쩍인다. */
/* 본문은 theme.js 로 옮겼다(앱 FSD 48번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const themeMod = TwTheme.createTheme({
  _premiumOn: (...a)=>_premiumOn(...a),
});
/* ═══ 🎨 [2026-09-15 제보 5] 테마 「버블」이 마이홈 방명록엔 안 먹음 ═══════════════════════
   [원인] 방명록·디자인 창은 window.open → main.js setWindowOpenHandler 가 **별도 BrowserWindow** 로 연다.
     별도 창 = 별도 document 라 메인 <html> 의 data-theme 이 거기까지 안 간다. 게다가 그 창들의 CSS(GB_HTML·
     DS_HTML)는 색이 전부 하드코딩이라 속성을 걸어도 받을 규칙이 없었다 — 고장이 아니라 구조였다.
   [대응] 둘 다 메운다.
     ① GB_HTML·DS_HTML 의 색·모서리·글꼴을 var(--win-*) 로 바꿨다(폴백은 예전 값 — 토큰이 없으면 옛 모습).
     ② 창을 열 때 이 함수가 메인 문서의 data-theme·data-accent 를 자식 <html> 에 걸고, 토큰 값을
        getComputedStyle 로 읽어 <style id=twThemeTokens> 로 넣는다. 값을 옮기므로 메인 CSS 와 두 벌이 안 된다.
     ③ applyTheme 가 열린 창에도 다시 건다(_themeChildDocs) — 창을 띄운 채 테마를 바꿔도 즉시 따라간다.
   ⚠️ 토큰 목록에 없는 변수는 자식 창에서 var() 폴백으로 떨어진다. 자식 CSS 에 --win-* 를 새로 쓰면 여기도 추가할 것. */
/* 본문은 theme-ui.js 로 옮겼다(앱 FSD 44번). 
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const themeUiMod = TwThemeUi.createThemeUi({
  ACCENT_KEY: themeMod.ACCENT_KEY,
  THEME_COLORS: themeMod.THEME_COLORS,
  THEME_DEFAULT_ACCENT: themeMod.THEME_DEFAULT_ACCENT,
  THEME_KEY: themeMod.THEME_KEY,
  applyTheme: (...a)=>themeMod.applyTheme(...a),
  getAccent: (...a)=>themeMod.getAccent(...a),
  getTheme: (...a)=>themeMod.getTheme(...a),
  onApplied: (...a)=>themeMod.onApplied(...a),
  CUSTOM_ID: themeMod.CUSTOM_ID,
  getCustom: (...a)=>themeMod.getCustom(...a),
  customUsable: (...a)=>themeMod.customUsable(...a),
  setCustom: (...a)=>themeMod.setCustom(...a),
  _premiumOn: (...a)=>_premiumOn(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  serverOn: ()=>TwServerFeatures.on('themeCustomSave'),   // 계정 저장을 끄면 이 PC 에만
  loadCustom: (...a)=>TwUserApi.themeCustom.load(...a),   // 👑 GET · PUT /v2/me/theme-custom(account/user-api.js — 판은 provider 가 든다)
  saveCustom: (...a)=>TwUserApi.themeCustom.save(...a),
});
/* ★ 최상위 호출은 반드시 위 const 선언들 '뒤'에 둔다.
   앞에서 부르면 THEME_COLORS가 아직 TDZ라 ReferenceError가 나고, 최상위에서 터지므로
   app.js 전체가 그 줄에서 멈춘다 = 프로그램이 아예 안 켜진다. (실제로 한 번 그렇게 만들었다) */
themeMod.onApplied(()=>helpTabMod.themeChanged());   // 📘 연 도움말 틀도 새 테마로
themeMod.applyTheme();      // 파싱 즉시 1회 — 늦게 부르면 기본 테마가 한 프레임 번쩍인다
themeUiMod.bindThemeUI();     // 설정창 테마·색상 칩 바인딩 (요소가 없으면 조용히 넘어감)
/* 🔤 창 글꼴 — 테마처럼 파싱 즉시 건다(늦으면 기본 글꼴이 번쩍인다) */
const fontUiMod = TwFontUi.createFontUi({ _premiumOn: (...a)=>_premiumOn(...a), refreshChildren: (...a)=>themeMod.applyTheme(...a) });
fontUiMod.apply(); fontUiMod.bind();
TwNetReady.whenNetReady(()=>{ themeUiMod.pullCustom(); });   // 👑 내 색 — 계정 사본 받기(서버 길이 없으면 pullCustom 이 바로 돌아간다)

/* ═══ ⭐ 경험치 바 ═══════════════════════════════════════════════════════════
   캐릭터 발밑에 1px 외곽선 통짜 게이지로 레벨 진행도를 보여준다. 내 좌석·상대 좌석 공용.

   · getFocusLevel() = 1 + floor(누적초/3600) 이므로 '1시간 = 1레벨'.
   · 레벨 안 진행도는 (누적초 % 3600)을 5분(300초) 단위로 끊어 0~12칸으로 센다.
     ★ 칸 단위로 끊는 건 의도적이다 — 부드럽게 채우면 "5분마다 오른다"가 눈에 안 보인다.
   · 색은 레벨 구간별 단색이고, 친구창 레벨 배지(.mh-flv)와 '같은' 구간을 쓴다 —
     경계값은 lvTierNum() 한 곳에서, 색은 CSS 「🏅 레벨 티어 토큰」 한 곳에서 나온다.
     같은 레벨인데 배지와 바 색이 다르면 그게 더 헷갈리므로, 어느 쪽도 여기서 다시 적지 않는다.

   ★ 상대방 좌석도 보인다. 진행도는 프리즌스 하트비트에 exp(0~12) 한 필드로 실려 온다.
     하트비트는 원래 30초마다 lastSeen을 쓰고 있으므로 '추가 쓰기가 0회'다.
     따로 push하면 시간당 12회가 늘지만, 어차피 5분 단위 바라 30초 지연은 티도 안 난다. */
/* 본문은 exp-bar.js 로 옮겼다(앱 FSD 45번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const expBarMod = TwExpBar.createExpBar({
  _focusTotalSec: ()=>focusProgressMod.shownTotalSec(),   // 레벨 막대용 — 받기 전 null(막대를 그리지 않는다)
  _starPaint: (...a)=>lvTierMod._starPaint(...a),
  lvBarClass: (...a)=>lvTierMod.lvBarClass(...a),
  lvStarBarClass: (...a)=>lvTierMod.lvStarBarClass(...a),
  overheadMod: overheadMod,
  bindLabelDrag: (...a)=>overheadMod.bindLabelDrag(...a),   // 이름표 끌기 — 경험치 바(포커스)는 방 모듈을 직접 부르지 않는다
});

/* ═══ 🖥️ 활성 앱 판정(_applyActiveAppState) ═══ */

/* ═══ 👑 달성표 · 🍅 뽀모도로 모듈 연결 ═══ */
/* 👑 달성표(주간 규칙 · 기록 · 화면) — parts/weekly-challenge.js 로 옮겼다(앱 FSD 2번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(localStorage 읽기 · 부팅 동기화 타이머 · 20초 tick · 버튼 연결)이
     예전과 같은 때 돈다. 함수 deps 는 화살표로 감싼다(부를 때 찾게). appMode · _gachaBonus 는 다시 대입되는 let 이라 읽는 함수로.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const chalStoreMod = TwChalStore.createChalStore({
  chalApi: TwFocusApi.createFocusApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) }),
  focusPure: TwFocusApi,
  chalCell: accountStoreMod,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  premiumOn: ()=>_premiumOn(),
  serverDay: ()=>focusTotalMod.serverDay(),
  rolloverToday: ()=>focusTotalMod._rolloverFocusToday(),
  appMode: ()=>launcherStateMod.appMode(),
  addQuitListener: (fn)=>window.addEventListener('beforeunload', fn),
});
const weeklyChal = TwWeeklyChallenge.createWeeklyChallenge({
  chalStore: chalStoreMod,
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  formatHMS: (...a)=>focusLevelMod.formatHMS(...a),
  premiumOn: ()=>_premiumOn(),
  appMode: ()=>launcherStateMod.appMode(),
});
focusTotalMod.onDayEnd(()=>{ weeklyChal.dayEnded(); });   // 하루가 바뀐 때 달성표도 이번 주를 다시 받는다

/* 🍅 뽀모도로(포커스 기록창 안쪽 서랍 · 집중 / 휴식 타이머)는 parts/pomodoro.js 로 옮겼다(앱 FSD 6번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(버튼 연결 · 첫 그리기 · 1초 tick)이 예전과 같은 때 돈다.
     설정 · 진행 읽기(tw.pomo · tw.pomoRun)는 계정 확인 뒤 startPomodoro(app-boot 의 pomodoro 차례). toast · _focusShowPush 는 화살표로 감싼다(부를 때 찾게). weeklyChal(바로 위) · _pomoSnd(효과음 공장)는
     이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로.
   ★ 머리 위 문구는 예전처럼 _focusShowConf 가 typeof _pomoShowText 로 본다 — 그 함수는 이 줄보다 먼저(bindFocusShow) 불려서
     반환값을 볼 수 없으므로 모듈이 window._pomoShowText 고리를 건다(만들기 전에는 '' — 예전과 같다).
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const pomodoro = TwPomodoro.createPomodoro({
  toast: (...a)=>toast(...a),
  focusShowPush: (...a)=>focusShareMod._focusShowPush(...a),
  weeklyChal: weeklyChal,
  pomoSnd: sfxMod._pomoSnd,
  pomoStore: accountStoreMod,
});

/* ═══ 🖥️ 데스크탑 실행 화면 — 창 크기 · 업데이트 배너 · 전역 입력 · 클릭 통과 · 하트비트 ═══ */
/* 본문은 launcher/window-mode.js 로 옮겼다(앱 FSD · app.js 분리 M22). 활성 앱 판정 · 창 모드(applyDesktopRunClass)의 주인이다 — 마이홈 열림 · 앱 모드는 launcherStateMod 에서 읽기만 — 판단은 옛 그대로. 다시 대입되거나 뒤에서 선언되는 값은 읽는 · 쓰는 함수로 다룬다. */
const windowModeMod = TwWindowMode.createWindowMode({
  creatorOpen: ()=>creatorOpen,
  desktopMode: desktopMode,
  floor: floor,
  focusGate: TwFocusGate,
  focusProgressMod: ()=>focusProgressMod,
  setFocusGateSleep: (v)=>{ focusGateSleep = v; },
  focusLevelMod: focusLevelMod,
  focusWindowMs: focusWindowMs,
  key: key,
  launcherState: launcherStateMod,
  mhStLayoutMod: mhStLayoutMod,
  officeModeMod: officeModeMod,
  seatStateMod: seatStateMod,
  weeklyChal: weeklyChal,
});
const _applyActiveAppState = windowModeMod._applyActiveAppState;   // 옛 전역 이름
const applyDesktopRunClass = windowModeMod.applyDesktopRunClass;   // 옛 전역 이름
/* 본문은 desktop-run.js 로 옮겼다(앱 FSD 32번). 다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — 이름이 겹치면 모듈 대신 내장 전역을 부른다. */
const desktopRunMod = TwDesktopRun.createDesktopRun({
  whenUpdateStageDone: (...a)=>updateFlowMod.whenStageDone(...a),
  _applyActiveAppState: (...a)=>_applyActiveAppState(...a),
  _charBoundsLatest: ()=>moveModeMod._charBoundsLatest(),
  _officeHidden: ()=>officeModeMod._officeHidden(),
  _penAppFocused: ()=>seatStateMod.penAppFocused(),
  _skipFlyingRigs: (...a)=>hiddenSeatsMod._skipFlyingRigs(...a),
  _skipHiddenDesk: (...a)=>hiddenSeatsMod._skipHiddenDesk(...a),
  _twMoveSeenAt: ()=>moveModeMod._twMoveSeenAt(),
  activity: (...a)=>activity(...a),
  anyInput: (...a)=>anyInput(...a),
  backToLauncher: (...a)=>backToLauncher(...a),
  camera: camera,
  clickPolicy: TwClickThroughPolicy,
  desktopMode: desktopMode,
  drag: ()=>seatPointerMod.drag(),
  focusGateSleep: ()=>focusGateSleep,
  hitShadow: hitShadow,
  lastActivity: ()=>seatStateMod.lastActivity(),
  lastAnyInput: ()=>seatStateMod.lastAnyInput(),
  moveMode: ()=>moveModeMod.moveMode(),
  otherSeatRegions: (...a)=>statusChipMod.otherSeatRegions(...a),
  ray: ray,
  renderer: renderer,
  seats: seats,
  setTwMoveSeenAt: (v)=>{ moveModeMod.setTwMoveSeenAt(v); },
  setLastActivity: (v)=>{ seatStateMod.setLastActivity(v); },
  setLastAnyInput: (v)=>{ seatStateMod.setLastAnyInput(v); },
  runCost: runCost,   // 🩺 통과 판정 시간(1분 [비용] 줄)
  seatHit: seatHitMod,   // 🗺️ 히트 맵 새 판정 — 그림자 운행
});
/* 좌석 배치 후 데스크탑 창 크기를 펫에 맞춤 — 배치 알림에 건다(옛: layoutSeats 를 감싸 다시 대입) */
seatLayoutMod.onLaidOut(()=>{
  if(desktopMode&&window.companion&&companion.resizeWidget){
    const config=document.getElementById('launcher').classList.contains('on')||creatorOpen;
    if(!config){ const c=document.getElementById('scene'); companion.resizeWidget(parseInt(c.style.width)||320, (parseInt(c.style.height)||240)+28); }
  }
  applyDesktopRunClass(); });

/* ============================================================ INIT */
/* 🚀 켜는 차례는 launcher/run-boot.js 의 표 한 곳(F3) — 여기는 각 칸의 시작 함수를 이어 주고 begin 을 한 번 부른다.
   ★ 모듈을 다 만든 뒤 여기서 한 번이어야 한다(만드는 줄이 INIT 앞에 있고, 뒤에서 만드는 모듈은 INIT 이 안 부른다). */
function resize(){ layoutSeats(); if(launcherPrevMod.lRenderer()&&document.getElementById('launcher').classList.contains('on')) launcherPrevMod.sizeLauncherPreview(); }
const runBoot = TwRunBoot.createRunBoot({
  starts: {
    seatTabs: ()=>{ seatPanelMod.renderSeatTabs(); seatPanelMod.setManual(null); },
    appMode: ()=>{ applyAppMode(); applyDesktopRunClass();
      /* 🗂️ 로비는 여닫는 길이 여럿(런처 · F1 · ✕ · 방 나간 뒤 다시 열기)이라 길마다 부르지 않고 .on 이 바뀔 때 창 크기를 다시 맞춘다 */
      const ov=document.getElementById('inviteOverlay'); if(ov) new MutationObserver(()=>applyDesktopRunClass()).observe(ov, { attributes:true, attributeFilter:['class'] }); },
    adminUi: ()=>{ if(typeof adminMode.refreshAdminVisibility==='function') adminMode.refreshAdminVisibility(); },   // 관리자 전용 UI는 기본 숨김 (관리자 모드 진입 시 노출)
    licenseLabel: ()=>{ const lbl=document.getElementById('lcLicenseLbl'); if(lbl) lbl.textContent = isPremium ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록'; },
    /* 🏠 마이홈 시작(내 접속 표시 · 프로필 · 친구 · 요청 · 우편 구독)은 계정 확인 뒤 app-boot 의 mhInit 차례다. */
    frameLoop: ()=>{ requestAnimationFrame(frame); },
    launcherLoop: ()=>launcherPrevMod.startLauncherLoop(),
    /* 🛡️ 얼굴 자동 복구 주기 점검 — 위 repairBlankFaces 주석 참고.
       ★ 렌더 루프(frame)에 넣지 않는다. 얼굴이 비는 상황은 대개 무거운 프로그램과 같이 돌 때라,
         그때 프레임마다 도는 점검을 얹는 것은 방향이 반대다. 4초 간격이면 사용자가 «사라졌다»고
         느끼기 전에 대개 돌아온다. */
    faceHeal: ()=>{ setInterval(()=>{ try{ faceHealMod.repairBlankFaces(); faceHealMod.repairSeatTextures(); }catch(_){} }, faceHealMod.FACE_WATCH_MS); },
    resize: ()=>{ addEventListener('resize',resize); resize(); },
  },
  baseBody: {
    load: ()=>loadBaseGLB(),
    loadSkins: ()=>loadSkins(),   // 캐릭터 슬롯은 계정 확인 뒤 서버에서 받는다(startCloset)
    renderLauncher: ()=>renderLauncher(),
    onFailed: ()=>TwErrorCodes.notify('E-SYS-08'),   // 기본 몸을 못 불러옴 — 안내 한 번 · 대신 몸으로 계속
  },
});
runBoot.begin();
/* ═══════════════ 🙋 투게더룸 친구 초대 ═══════════════ */
/* 🙋 친구 고르기 창 · 초대 보내기 · 🚪 방 초대 받기(수락 / 거절 팝업 · 3분 자동 거절 · 작업표시줄 깜빡임)는
   parts/room-invite-ui.js 로 옮겼다(앱 FSD 10번 · docs/APP_FSD_MAP.md).
   ★ 원래 자리인 여기서 만든다 — 모듈이 만들 때 바로 하는 일(창 버튼 · 끌기 · resize 연결, 초대 수신 구독 또는 firebase-ready 기다림)이
     예전과 같은 때 돈다. 밖에서 부르는 이름은 없다.
   함수 deps 는 화살표로 감싼다(부를 때 찾게). _myHomeFriends 는 다시 대입되는 let 이라 읽는 함수로,
   Presence 는 이 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로 넘긴다.
   ⚠️ 전역 이름을 크로미움 내장 전역과 겹치게 짓지 말 것(#103 Scheduler) — typeof 가드가 늘 통과해 모듈이 없을 때 app.js 가 선다. */
const roomInviteUi = TwRoomInviteUi.createRoomInviteUi({
  toast: (...a)=>toast(...a),
  escHtml: (...a)=>escHtml(...a),
  invites: TwRoomInviteRt.store,
  startRoom: (...a)=>roomEntryMod.startRoom(...a),
  doLeaveRoom: (...a)=>roomEntryMod.doLeaveRoom(...a),
  friendInRoom: (...a)=>inboxMod.friendInRoom(...a),
  myHomeFriends: ()=>_myHomeFriends,
  friendsNotice: (...a)=>friendsSubMod.notice(...a),
  friendsRetry: (...a)=>friendsSubMod.retryIfFailed(...a),
  friendsOpen: (...a)=>friendsSubMod.open(...a),
  friendsClose: (...a)=>friendsSubMod.close(...a),
  presence: Presence,
  inviteNotice: inviteNotice,
});

/* 🗂️ 이 계정이 이 PC 에서 고른 것 — 모듈은 처음 값으로 만들고, 계정 칸이 열린 뒤(app-boot 의 userLocal 칸) 여기서 읽어 채운다. 세션이 끝나면 처음 값으로 되돌린다(launcher/user-local.js).
   조각을 더할 때: 그 모듈이 loadLocal · resetLocal 을 내놓고 여기 한 줄. 읽은 값이 화면에 걸려 있으면 load 에서 다시 그린다. */
const userLocalMod = TwUserLocal.createUserLocal({ parts: [
  { name: 'seatEq', load: ()=>{ seatEqMod.loadLocal(); if(seatEqMod.seatEqualizeOn()) layoutSeats(); }, reset: ()=>{ const was = seatEqMod.seatEqualizeOn(); seatEqMod.resetLocal(); if(was) layoutSeats(); } },
  { name: 'decoParts', load: ()=>{ decoPartsMod.loadLocal(); if(!decoPartsMod.decoPartsVisible()) seats.forEach(s=>applyClothVisibility(s)); }, reset: ()=>{ const was = decoPartsMod.decoPartsVisible(); decoPartsMod.resetLocal(); if(!was) seats.forEach(s=>applyClothVisibility(s)); } },
  { name: 'status', load: ()=>{ userStatusTableMod.loadCustomStatusFromStorage(); loadUserStatusFromStorage(); Presence.restoreBootStatus(); refreshMyStatusUI(); refreshCustomStatusMenuItem(); },
    reset: ()=>{ userStatusTableMod.setCustomStatusConf({ emo:'', text:'' }); userStatusMod.resetLocal(); Presence.resetBootStatus(); refreshMyStatusUI(); refreshCustomStatusMenuItem(); } },
  { name: 'reportHidden', load: ()=>hiddenSeatsMod.loadReportHidden(), reset: ()=>hiddenSeatsMod._reportHiddenUids.clear() },
  { name: 'curSlot', load: ()=>{ curSlot = _loadCurSlot(); }, reset: ()=>{ curSlot = 0; } },   // 런처는 이어서 받는 옷장(closet 칸)이 다 받은 뒤 그린다
  { name: 'extraSeats', load: ()=>settingsMod.loadExtraSeatSlots(), reset: ()=>settingsMod.setExtraSeatSlots([]) },
  { name: 'playlistCur', load: ()=>plMod.loadLocal(), reset: ()=>{ plMod.st.cur = 0; } },
  { name: 'animal', load: ()=>window._animalLoadLocal(), reset: ()=>window._animalResetLocal() },
  { name: 'emojiReactions', load: ()=>floatersMod.loadLocal(), reset: ()=>floatersMod.resetLocal() },
  /* 코드로 추가한 책상 · 아이템 · 파츠는 이 계정 몫 — 카탈로그 몫(서버가 원본)은 건드리지 않고 이 계정 몫만 더한다(commission.js loadLocalDesks · loadLocalItems · premium-assets.js loadLocal — 칸마다 따로). 아이템은 세션에 등록(GLB 파싱)까지 */
  { name: 'savedDesks', load: ()=>commissionMod.loadLocalDesks(), reset: ()=>{ commissionMod.resetLocalDesks(); } },
  { name: 'savedItems',   // 아이템은 세션에 등록(GLB 파싱)까지 — 비동기 실패는 user-local 이 경고한다
    load: ()=>{ commissionMod.loadLocalItems(); return loadSavedItemsIntoSession(); },
    reset: ()=>{ commissionMod.savedItems().filter(p=>!p.fromCatalog).forEach(p=>{ delete customItems[p.id]; }); commissionMod.resetLocalItems(); } },
  { name: 'savedParts', load: ()=>premiumMod.loadLocal(), reset: ()=>premiumMod.resetLocal() },
] });

/* 🚀 켜는 순서 한 곳(launcher/app-boot.js) — 계정 확인(license-gate.js)이 nav 로 «계정에 들어감» 을 알리면 옛 PC 값 옮기기 → realtime → 아래 차례대로 계정 기능을 시작한다.
   ⚠️ 차례 표는 app-boot.js STEPS — 여기 starts 는 그 이름마다 하나씩(빠지거나 남으면 만들 때 던진다). 계정 기능을 새로 만들면 만들 때 일하지 말고 여기에 건다. */
/* 첫 화면 = 옷장 첫 받기가 끝남(캐릭터가 그려졌거나 못 받음) — app-boot LATER 의 시작 · 카탈로그 GLB 전체 받기가 기다린다 */
const closetSettled = ()=>new Promise((r)=>{ const done = ()=>['ready', 'failed'].includes(closetMod.state()); if(done()) r(); else closetMod.onChange(()=>{ if(done()) r(); }); });
const appBoot = TwAppBoot.createAppBoot({
  twNav: twNav,
  migrateLegacy: (code)=>accountStoreMod.migrateLegacy(code),
  newSession: (me)=>TwSession.createSession({
    me: me,
    openAccountStore: (code)=>accountStoreMod.open(code),
    closeAccountStore: ()=>accountStoreMod.close(),
    timers: { setInterval: (f, ms)=>setInterval(f, ms), clearInterval: (h)=>clearInterval(h), setTimeout: (f, ms)=>setTimeout(f, ms), clearTimeout: (h)=>clearTimeout(h) },
  }),
  registerDevice: ()=>deviceRegisterMod.ensure(),   // 🖥️ realtime 보다 먼저 이 PC 등록(상한이 다 찼으면 확인창)
  toLogin: ()=>accountMod._loginDoLogout({ force:true }).then(()=>acctStateMod._acctRelaunchAfterDetach(null)),   // [취소] — 등록하지 않고 로그인 화면(다시 켜면 게이트가 로그인 화면)
  goOnline: ()=>loginFlowMod.goOnline(),
  updateGate: ()=>updateFlowP.then((f)=>f.proceed === true),
  whenPainted: ()=>closetSettled(),
  idle: ()=>TwApi.authed.whenIdle(),
  holdToast: (msg)=>toastMod.hold(msg),
  starts: {
    userLocal: (code, me, session)=>userLocalMod.start(session),
    catalog: (code, me, session)=>catalogSyncMod.start(session),   // 🧩 카탈로그 서버 한 벌 받기 — 로그인 뒤(서버가 이 사람의 locked 를 정한다) · 세션이 끝나면 풀고 비운다
    closet: (code, me, session)=>closetMod.startCloset(session),
    /* 🏠 마이홈 시작 — 받은 친구 요청 구독 · 우편 구독은 initMyHome 이 세션에 건다. 친구 목록 구독(friendsSub) · 내 접속 표시 구독(presenceSelf)은 시작이 다른 곳(마이홈 · 접속 고정)이라 비우기만 여기서 건다 */
    focusTotal: (code, me, session)=>{ session.onReset(()=>focusTotalMod.setFocusTodaySec(0)); focusTotalMod.startFocusTotal(); },   // 오늘치 메모리는 세션이 끝나면 0 으로
    focusShare: ()=>focusShareMod.startFocusShare(),
    pomodoro: (code, me, session)=>pomodoro.startPomodoro(code, me, session),
    gift: (code, me, session)=>{ session.on(giftBoxMod.listen()); session.onReset(()=>{ giftBoxMod.reset(); mallangStoreMod.reset(); mallangMod.reset(); }); },   // 🎁 서버 신호 `gifts` 만 건다(요청 0 — 받기는 마이홈을 열 때)
    roomInvite: (code, me, session)=>{
      roomInviteUi.startReceive(session);
      session.on(TwRtHub.store.on('license', ()=>roomLobbyProvider.reset()));
      session.onReset(()=>{ TwChatRt.store.reset(); roomLobbyProvider.reset(); if(_pkSession) _pkSession.reset(); });
    },
    awayPic: (code, me)=>awayPicMod.startAwayPic(me),   // 🫧 자리비움 그림 · 크기 — 서버(me.awayImage)가 기준
    desktopBg: (code)=>window.MYHOME_DESKTOP.startBgSync(code),
    licensePremium: (code, me, session)=>{ session.onReset(()=>licensePremiumMod.reset()); return licensePremiumMod.start(me); },   // 알림 구독 해제 함수는 모듈이 쥐고 reset 이 푼다 — 세션이 끝나면 reset 을 부른다
    xmas: (code, me, session)=>TwXmasWindow.startXmas({ api: xmasApiMod, win: xmasWinMod }, session),   // 🎄 세션이 끝나면 창 · 판 기억 · 빨간 점 비우기(요청 0)
    adminMode: (code, me, session)=>{ session.onReset(()=>twNav.go(twNav.NAV.ADMIN_EXIT)); },   // 🔐 세션이 끝나면 관리자 모드를 조용히 끈다(요청 0 · 창 열기 통로로 — 모듈끼리 순환 없이)
    focusLevel: (code, me, session)=>{ focusProgressMod.startFocus(code, me, session); focusLevelMod.startMobile(code, me, session); },
    weeklyChal: (code, me, session)=>weeklyChal.startChallenge(code, me, session),
    mhInit: (code, me, session)=>{ session.onReset(()=>{ friendsSubMod.stop(); presenceSelfMod.reset(); myhomeStoreMod.reset(); bookshelfStoreMod.reset(); }); return mhInitMod.initMyHome(code, me, session); },   // 내 홈 · 책장 메모리도 세션이 끝나면 비운다(늦게 온 답은 gen 으로 버린다)
    bugBadge: (code, me, session)=>{ session.onReset(()=>bugBoardUi.reset()); return bugBoardUi.start(); },   // 배지 · 목록 · 쓰던 글은 세션이 끝나면 비운다
    scheduler: (code, me, session)=>mhScheduler.startSchedule(session),
    /* 🙋 방 초대 받기 — 방 쪽 포트(대화 · 방 목록 · 스티커사진)는 사용자가 들어갈 때 시작해 STEPS 칸이 없다. 대신 계정이 바뀔 때 비우는 일(session.onReset)을 여기서 한 곳에 모은다.
       license 알림(발급 · 연장 · 코드 바꿈 · 끝남) → 읽어 둔 내 시크릿룸을 버려 다음에 다시 읽는다(관리자가 발급한 방이 다시 실행 없이 보이게). */
    ddays: ()=>mhScheduler.loadBoard(),   // 📌 디데이 보드 — 첫 화면 뒤(app-boot LATER · 🔔 알림 배지도 센다)
    gacha: (code, me, session)=>gachaMod.startGacha(session),
    invites: ()=>licenseGateMod.refreshInviteBtn(),   // 🎟️ 런처 초대장 버튼 — 켤 때 한 번(런처를 다시 그릴 때마다 묻지 않는다) · 발급 · 관리자 모드 뒤에는 그 자리에서
    appVersion: (code, me, session)=>appVersionSyncMod.start(session),   // 🔄 이 PC 앱 판을 서버에 알림 — 더 새 판을 쓰는 기기가 있으면 업데이트 창
    xmasDates: ()=>TwXmasWindow.loadXmasDates({ api: xmasApiMod, win: xmasWinMod, rules: TwXmasRules, serverNow: ()=>TwRtHub.store.serverNow(), now: ()=>Date.now() }),   // 🎄 마감 앞뒤 하루만 날짜 한 벌 한 번(그 밖엔 요청 0)
    firstRun: ()=>firstRunMod.run().catch((e)=>console.warn('[0.13 첫 실행] 실패 — 다음 실행에 다시', e)),
    licenseAutoRegister: ()=>licensePremiumMod.autoRegisterAfter(firstRunMod.licenseDone()),   // 첫 실행 뒤 — 0.12 키로 첫 실행이 등록했으면 건너뜀
    catalogGlb: ()=>closetSettled().then(()=>catalogSyncMod.fillGlb()),   // 🧩 카탈로그 GLB 를 다 받아 두기 — 첫 화면 뒤 맨 끝 · 캐릭터가 3초 넘게 안 그려져도 그려질 때까지 기다린다(약 8MB 가 캐릭터 그림과 다투지 않게)
    playlist: (code, me, session)=>plMod.start(session),
  },
});
/* 그 창을 처음 열 때 받는 기능(app-boot OPEN) — 플레이리스트 창 → 플레이리스트 */
TwOpenOnShow.createOpenOnShow({
  open: (name)=>appBoot.open(name),
  targets: [
    { name: 'playlist', el: document.getElementById('myPlaylistBox'), shown: (el)=>!el.classList.contains('hidden') },
  ],
}).start();

/* ═══════════ 🛰 서버 모듈 감시견 — 안 붙으면 다시 붙이고, 그래도 안 되면 말해준다 ═══════════
   [무엇을 고치는가] `parts/firebase-init.js` 는 Firebase SDK 를 gstatic 에서 **실행 시점에**
     받아온다. 그 import 하나가 실패하면 모듈 본문이 통째로 실행되지 않아 파일 끝의
     `window.firebaseAPI = {...}` 와 `firebase-ready` 이벤트까지 도달하지 못한다.
     그러면 app.js 곳곳의 `if(!window.firebaseAPI) return;` 가 **전부 조용히 물러난다** —
     잔여 워킹룸 · 룸 접속 · 마이홈 · 친구 · 우편함 · 버그제보가 한꺼번에 사라진다.
     기능 여섯 개가 따로 고장 난 게 아니라 하나가 안 붙은 것인데, 화면에는 아무 말도 안 뜬다.
     (제보 두 건이 같은 문장으로 온 이유다: "로딩되지 않음/증발". 재설치로는 안 고쳐진다 —
      설치 파일 문제가 아니라 그 순간의 네트워크 문제이기 때문이다.)

   [왜 이렇게 고치는가]
     ★ 다시 붙이는 것이 실제로 복구가 된다. app.js 는 어디서나
       `window.firebaseAPI ? 바로 : addEventListener('firebase-ready', …)` 꼴로 기다리고 있어서,
       늦게 도착한 이벤트에도 열세 곳이 전부 제 일을 시작한다. 재시작 없이 살아난다.
     ⚠️ 그래서 **재주입은 신중해야 한다.** 원본이 그냥 느린 것뿐인데 성급히 하나 더 꽂으면
       모듈이 두 번 돌아 구독이 겹친다. 그래서 ① 원본 태그의 error 이벤트(확정 신호)에는 즉시,
       ② 시간 초과에는 넉넉히 기다렸다가만 움직인다.
     ⚠️ 캐시 무력화 쿼리를 붙인다. 실패한 응답이 캐시에 눌러앉으면 재시도가 같은 실패를 되풀이한다.

   🔵 되돌리려면 이 블록만 지우면 된다. 바깥에 남기는 것은 없다. */
/* (앱 FSD 35번) 이 자리의 본문도 room-sync.js 로 옮겼다 — 만드는 줄은 첫 자리. */
/* 🧩 app.js 를 마친 뒤 만드는 화면 모듈 둘(앱 FSD · M23 — 동물 · 소음. 마이홈 바탕화면은 myhome-desktop-boot.js, 버그 제보 게시판은 🚩 신고 다음에서 만든다)
   예전엔 app.js 다음 <script> 로 실려 app.js 의 전역 이름을 그냥 불렀다. 지금은 app.js 보다 먼저 싣고(html) 여기서 deps 로 이어 준다 —
   옛 «app.js 다음 script» 와 같은 때(INIT 이 끝난 바로 뒤)에 같은 차례로 돈다. 다시 대입되는 let 은 읽는 · 쓰는 함수로 넘긴다. */
TwNoise.createNoise({
  officeModeMod: officeModeMod,
  seats: seats,
  findMySeat: (...a)=>findMySeat(...a),
  seatState: (...a)=>seatState(...a),
  hiddenSeatsMod: hiddenSeatsMod,
  Presence: Presence,
});
TwAnimal.createAnimal({
  isAdmin: ()=>isAdmin,
  curSlot: ()=>curSlot,
  creatorMode: ()=>creatorMode,
  creatorOpen: ()=>creatorOpen,
  setCurSlot: (v)=>{ curSlot = v; },
  setCreatorOpen: (v)=>{ creatorOpen = v; },
  lightToneMod: lightToneMod,
  loader: loader,
  focusLevelMod: focusLevelMod,
  normalizeModel: (...a)=>normalizeModel(...a),
  toast: (...a)=>toast(...a),
  bindHold: (...a)=>bindHold(...a),
  ANIMAL_HAND_REST: ANIMAL_HAND_REST,
  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),
  renderLauncher: (...a)=>renderLauncher(...a),
  partPaintMod: partPaintMod,
  slots: slots,
  applyCharToSeat: (...a)=>applyCharToSeat(...a),
  slotSaveMod: slotSaveMod,
  Presence: Presence,
  layoutSeats: (...a)=>layoutSeats(...a),
  openCreator: (...a)=>openCreator(...a),
  saveCurSlot: (...a)=>saveCurSlot(...a),
  LIGHT_PRESET: LIGHT_PRESET,
  accountStoreMod: accountStoreMod,
  accountJsonStoreMod: accountJsonStoreMod,
});
