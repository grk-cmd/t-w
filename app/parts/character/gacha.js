/* gacha.js — 🎰 파츠 가챠 — 코어(보유분 · 확률 · 뽑기 · 서버 동기화 · 미보유 파츠 회수) + 파츠 보관함(T) · 뽑기 창(캡슐 연출)
   app.js 의 두 구역(«🎰 파츠 가챠 — 코어» · «🎰 파츠 보관함 (T키) · 가챠 뽑기 창»)을 그대로 옮긴 모듈이다(앱 FSD 8번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 한 파일이다(👑 달성표 weekly-challenge.js 와 같은 방식 — entities 규칙 + widgets 화면). 보관함 · 뽑기 창이 코어의 이름
     스무 개 가까이(보유 수 · 풀 · 시즌 · 남은 뽑기 · 보너스 · 동기화 …)를 그대로 쓰고, 코어의 동기화도 보관함을 다시 그린다 —
     둘로 나누면 그 이름이 전부 deps 로 오가며 글자 그대로 옮기기가 깨진다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 app.js 의 let 을 읽고 쓰는 방법뿐이다.
       · isAdmin → isAdmin() · savedParts → savedParts() · PART_CATS → PART_CATS() · wdDraftDef → wdDraftDef() · activeWdAdj → activeWdAdj()
         app.js 가 다시 대입하는 let 이라(관리자 로그인 · 카탈로그 도착 · 카테고리 구독 · 꾸미기 초안 · 상세조정 선택) 값이 아니라 읽는 함수로 받는다.
       · activeWdAdj = x → _setActiveWdAdj(x) — 상세조정 선택은 꾸미기 창 · 기즈모 · 색상 영역이 같이 보는 app.js 의 let 이다.
       · GACHA_OWNED_KEY · GACHA_TS_KEY · GACHA_BONUS_KEY 는 deps 값 — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)이 같은 이름을 쓰므로
         정의(세 줄)는 app.js 에 남겼다(달성표 CHAL_KEY 와 같은 방식).
   ★ 두 구역 사이에 끼어 있던 🔑 «서버가 조용히 거부하는 기기» 안내(_warnServerWriteDenied)는 가챠만의 것이 아니라
     app.js 에 남겼다 — 🧍 캐릭터 슬롯 동기화도 부른다. 여기서는 deps 로 받는다.
   ★ 다른 구역이 다시 대입하던 상태는 함수로 바꾼다 — gachaOwned · _gachaTs · _gachaBonus(로그아웃 지우기) → resetMemory().
   ★ 밖으로 내놓는 이름은 반환값이다(isGachaPart · isGachaColorUnlocked · gachaCount · sceneHasColorGroup · DUPES_FOR_COLOR ·
     syncGachaToServer · pruneUnownedGachaParts · renderGachaInv · toggleGachaInv · isInvOpen · isDrawOpen · selId · owned · bonus ·
     setBonusLocal · resetMemory). 부르는 곳(꾸미기 창 · 파츠 등록 · 카탈로그 도착 · 런처 복귀 · 로그아웃 · 계정 연동 · 달성표 보상 · T 키)은
     전부 만드는 줄보다 늦게 돈다(부팅 중에 먼저 불리는 곳 없음 — 헤드리스로 확인) — app.js 에서 gachaMod.이름 으로 부른다.
     예전부터 window 에 걸던 고리 셋(openGachaInv · closeGachaInv · _gachaRestorePos)은 그대로 건다.
   ★ createGacha 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(localStorage 읽기 · 시각 부트스트랩 · 부팅 동기화 4.2초 타이머 ·
     10분 tick · 창 버튼 · 끌기 · ESC · 바깥 클릭 · blur 연결 bindGachaWindows)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ firebaseAPI · localStorage · document · window · confirm 은 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwGacha — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-gacha.js — 만들 때 · 보유 · 색상 해금 · 풀 · 남은 뽑기(보너스) · 뽑기 · 서버 동기화(최신 승 · pull · 미래 ts ·
         실패) · 보관함(탭 · 카테고리 · 시즌 · 페이지) · 뽑기 창(연출 · 오류) · app.js 배선 · html 순서. */
(function(){

function createGacha(deps){
const toast = deps.toast;
const _srvNow = deps.srvNow;                                   // 🕒 서버 시계 — app.js(_gachaNow 가 한 곳에서 읽는다)
const _warnServerWriteDenied = deps.warnServerWriteDenied;     // 🔑 쓰기 거부 안내 — app.js(캐릭터 슬롯 동기화도 쓴다)
const getMyUserId = deps.getMyUserId;
const getFocusLevel = deps.getFocusLevel;                      // ⭐ 레벨 — 뽑기 수(레벨/5)
const catEquippedIds = deps.catEquippedIds;                    // 👕 착용 목록 도우미 — app.js(꾸미기)
const removeEntryFromCat = deps.removeEntryFromCat;
const unequipStackablePart = deps.unequipStackablePart;
const unequipPartFromSeat = deps.unequipPartFromSeat;
const applyClothVisibility = deps.applyClothVisibility;
const saveSlots = deps.saveSlots;
const findMySeat = deps.findMySeat;
const escHtml = deps.escHtml;
const openPartRegister = deps.openPartRegister;                // 🛠 관리자 파츠 등록 창 — app.js
const syncPartRegGachaLock = deps.syncPartRegGachaLock;
const toggleEquip = deps.toggleEquip;                          // 👕 착용 배관 — 꾸미기(F2)와 같은 것
const createWardrobeAdjPanel = deps.createWardrobeAdjPanel;
const deletePart = deps.deletePart;
const _clearMultiPanelRef = deps.clearMultiPanelRef;
const refreshWdPreviewColorSection = deps.refreshWdPreviewColorSection;
const updateWdGizmoForActivePanel = deps.updateWdGizmoForActivePanel;
const commitWdDraft = deps.commitWdDraft;
const syncWdPreviewOwner = deps.syncWdPreviewOwner;            // 🖼 꾸미기 미리보기 패널 — app.js
const wdPreviewSavedPos = deps.wdPreviewSavedPos;
const placeWdPreview = deps.placeWdPreview;
const clampWdPreviewIntoView = deps.clampWdPreviewIntoView;
const refreshWdPreviewChar = deps.refreshWdPreviewChar;
const detachWdGizmo = deps.detachWdGizmo;
const isAdmin = deps.isAdmin;                                  // 🔑 관리자 — app.js 의 let(로그인할 때 다시 대입된다)
const savedParts = deps.savedParts;                            // 📦 파츠 카탈로그 — app.js 의 let(카탈로그 도착 때 다시 대입된다)
const PART_CATS = deps.partCats;                               // 🏷️ 카테고리 — app.js 의 let(커스텀 카테고리 구독 때 다시 대입된다)
const wdDraftDef = deps.wdDraftDef;                            // ✏️ 꾸미기 초안 — app.js 의 let
const activeWdAdj = deps.activeWdAdj;                          // 🖱️ 상세조정 선택 — app.js 의 let(꾸미기 창 · 기즈모 · 색상 영역이 같이 본다)
const _setActiveWdAdj = deps.setActiveWdAdj;
const seats = deps.seats;                                      // 좌석 · 슬롯 · 접속 — app.js 앞쪽에 선언되고 다시 대입되지 않는 const
const slots = deps.slots;
const Presence = deps.presence;
const GACHA_OWNED_KEY = deps.ownedKey;                         // 'tw.gachaOwned' — 정의는 app.js(계정 전환 지움 목록 ACCOUNT_LOCAL_KEYS 가 같이 쓴다)
const GACHA_TS_KEY = deps.tsKey;                               // 'tw.gachaOwnedTs'
const GACHA_BONUS_KEY = deps.bonusKey;                         // 'tw.gachaBonus'

/* ═══ 🎰 파츠 가챠 — 코어 ══════════════════════════════════════════════════
   성격은 '집중 보상'이다. 수집 경쟁이 아니므로 등급(rarity)도 꽝도 없고 확률은 균등하다.
   화면(보관함·뽑기 연출)은 아직 없다 — 여기 있는 것은 상태·계산·뽑기까지다.

   저장은 이 한 노드가 전부다:
     users/{uid}/gacha/owned/{partId} = 4      // 뽑은 횟수(누적). 4 이상 = 색상 변경 해금
     users/{uid}/gacha/ts             = 172…   // 마지막으로 바꾼 시각(ms). 어느 기기가 최신인지 가른다
   꽝이 없으므로 '총 뽑기 횟수 = 소유 개수의 합'이 항상 성립한다 → used를 따로 안 저장한다.
     남은 뽑기 = floor(레벨/5) − Σowned

   ★ 서버 병합은 '최신 기기 통째로 덮어쓰기'다(ts 비교). 합치지도, max 를 잡지도 않는다.
     자세한 이유와 함정은 syncGachaToServer 주석에 적어 두었다.
   ⚠️ 규칙 파일에 users/$userId/gacha 블록을 반드시 같이 넣을 것. audit 검사 7은 최상위 경로만
     보므로 users 하위 키가 비면 잡히지 않고 **조용히 전부 거부**된다. */
const GACHA_LEVELS_PER_TICKET = 5;    // 5레벨당 뽑기 1회. ⚠️ 한 번 풀면 회수 불가 — 완화만 가능
const GACHA_DUPES_FOR_COLOR   = 4;    // 같은 파츠 총 4개(첫 개 + 중복 3) → 그 파츠 색상 변경 해금
/* 🎨 색을 바꿀 수 없는 파츠(= GLB 안에 _col 메쉬가 하나도 없는 것)는 몇 개가 필요한가.
   [왜 나눴나] 4개를 모으는 보상이 '색상 변경 해금' 하나뿐이라, 바꿀 색이 없는 파츠는
     2~4번째 뽑기가 아무 진척도 아니게 된다 — 중복 낭비 0 이라는 가챠 설계가 그 파츠에서만 깨진다.
     그래서 색이 없는 파츠는 1개로 끝내고 풀에서 빠진다.
   ⚠️ 판정은 등록할 때 GLB 를 훑어 rec.noColor 에 적어 둔다. **옛 파츠에는 그 필드가 없고,
      없으면 예전대로 4개다** — 이미 모으던 사람의 진척이 사라지지 않는다. 색 없는 옛 파츠를
      1개짜리로 바꾸고 싶으면 등록창에서 한 번 다시 저장하면 된다. */
const GACHA_DUPES_NO_COLOR    = 1;
/* 이 파츠를 몇 개까지 모으는가 — 풀에서 빠지는 기준이자 화면의 ●○ 개수. */
/* 🎨 이 GLB 에 색을 바꿀 자리(_col)가 하나라도 있는가 — 등록할 때 1회만 훑는다.
   ⚠️ 판정 규칙(메쉬 이름 또는 머티리얼 이름의 _col)은 장착 경로(equipPartOnSeat 의 colorGroups)와
      **반드시 같아야 한다.** 여기만 다르면 '색을 바꿀 수 있는데 1개로 끝나는' 파츠가 생긴다. */
function sceneHasColorGroup(scene){
  let found = false;
  try{
    scene.traverse(o=>{
      if(found || !o.isMesh) return;
      const m = o.material;
      if((o.name && /_col(\d*)/i.test(o.name)) || (m && m.name && /_col(\d*)/i.test(m.name))) found = true;
    });
  }catch(_){ return true; }   // 못 훑으면 '있다'로 둔다 — 색이 있는 파츠를 1개짜리로 만드는 쪽이 더 나쁘다
  return found;
}
function gachaDupesFor(rec){
  return (rec && rec.noColor) ? GACHA_DUPES_NO_COLOR : GACHA_DUPES_FOR_COLOR;
}
/* 🕒 가챠 ts 는 **서버 시계**로 찍는다.
   [무엇이 문제였나] 병합이 'ts 가 큰 쪽이 통째로 이긴다'인데 그 ts 를 각 기기가 Date.now() 로
     스스로 신고했다. 시계가 앞선 기기(수동으로 시각을 맞춘 PC, 시간 동기화가 꺼진 VM)가 한 대만
     있어도 미래 ts 가 서버에 박히고, 그 시각이 **실제로 올 때까지** 정상 기기는 뽑는 족족
     `sTs > _gachaTs` 로 걸려 _adopt 만 한다 — 방금 뽑은 파츠가 그 자리에서 사라지고 서버에는
     아무것도 안 올라간다. 뽑기 횟수는 `earned − Σowned` 라 자동으로 돌아오므로, 유저에게는
     "뽑았는데 아무것도 안 나오고 횟수만 돌아왔다"로 보인다(sim-gacha-push 5번).
   ★ firebaseAPI.serverNow() 는 `.info/serverTimeOffset` 으로 보정된 값이다. 없으면(부팅 초반,
     오프라인, 구버전 firebase-init) 예전 그대로 Date.now() 로 물러난다 — 나빠지는 경우가 없다.
   ⚠️ ts 를 찍는 자리는 전부 이 함수를 거칠 것. 한 군데라도 Date.now() 로 남으면 그 경로에서만
     다시 기기 시계가 기준이 되어, 고쳐진 기기와 안 고쳐진 값이 섞인다. */
function _gachaNow(){
  return _srvNow();   // ★ 서버 시계는 한 곳에서만 읽는다 — 두 벌이 되면 한쪽만 고쳐진다
}
/* 서버 ts 가 이만큼 미래면 '시계가 틀어진 채 올라간 값'으로 본다.
   왕복 지연과 오프셋이 아직 안 온 창을 넉넉히 덮으면서, 진짜 방금 뽑기(초 단위)와는 겹치지 않는 폭. */
const GACHA_TS_SKEW_TOL_MS = 5*60*1000;
let gachaOwned = {};                  // {partId: 뽑은 횟수}
let _gachaTs = 0;                     // 위 값의 시각. 서버 ts 와 비교해 어느 쪽이 최신인지 가른다
let _gachaSyncing = false;
/* 진행 중이라 삼켜진 동기화 요청 — 끝난 뒤 한 번 다시 돈다.
   [왜] 예전엔 `if(_gachaSyncing) return;` 이 끝이었다. 부팅 동기화가 느린 회선에서 몇 초씩
     걸리는 동안 보관함을 열면(openGachaInv 의 'inv-open') 그 호출이 통째로 사라져, 화면을
     맞출 기회가 10분 뒤 tick 까지 없었다. */
let _gachaSyncPending = null;
/* 이 세션에서 서버 보유분을 **실제로 한 번이라도 읽었는가**.
   미보유 파츠 회수(pruneUnownedGachaParts)의 유일한 전제다 — 이 값이 서지 않았는데 회수하면
   '보유분을 모르는 채로' 벗기는 것이 되어, 오프라인 부팅에서 멀쩡한 파츠가 사라진다. */
let _gachaSrvSeen = false;
/* 👑 달성표 보상분(추가 뽑기 횟수). 서버에서는 **users/{uid}/chalBonus** 에 따로 산다 —
   gacha 노드 안에 두면 saveGachaOwned 의 통째 set 이 지운다(옛 버전 클라이언트가 특히 그렇다).
   여기 값은 서버 합계를 받아 적는 사본이다.
   ⚠️ 서버를 못 읽었을 때는 절대 손대지 않는다(로컬 값 유지) — 0 으로 내려가면 이미 준 보상이
     사라진 것처럼 보인다. 그래서 loadChalBonus 는 실패를 null 로 돌려주고 0 과 구분한다. */
let _gachaBonus = 0;
try{ _gachaBonus = Math.max(0, parseInt(localStorage.getItem(GACHA_BONUS_KEY) || '0', 10) || 0); }catch(_){}
function _setGachaBonusLocal(n){
  _gachaBonus = Math.max(0, Math.min(9999, Math.floor(Number(n) || 0)));
  try{ localStorage.setItem(GACHA_BONUS_KEY, String(_gachaBonus)); }catch(_){}
}

function _loadGachaLocal(){
  try{ const v = JSON.parse(localStorage.getItem(GACHA_OWNED_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; }
  catch(e){ return {}; }
}
/* touch=true → "이 기기에서 방금 바뀌었다"고 시각을 새로 찍는다(뽑기).
   touch=숫자 → 서버에서 받아온 값의 시각을 그대로 물려받는다(내려받기). 새로 찍으면 안 된다 —
     찍는 순간 이 기기가 최신이 되어, 방금 받아온 것을 도로 올리는 핑퐁이 된다. */
function _saveGachaLocal(touch){
  if(touch === true) _gachaTs = _gachaNow();   // ★ 서버 시계(_gachaNow) — 기기 시계로 찍으면 병합 판정이 통째로 어긋난다
  else if(typeof touch === 'number' && touch > 0) _gachaTs = touch;
  try{
    localStorage.setItem(GACHA_OWNED_KEY, JSON.stringify(gachaOwned));
    localStorage.setItem(GACHA_TS_KEY, String(_gachaTs));
  }catch(e){}
}
gachaOwned = _loadGachaLocal();
/* 시각 부트스트랩 —
   · 저장된 시각이 있으면 그대로 쓴다.
   · 없는데 뽑은 게 **있으면** 지금으로 찍는다. 시각 개념이 생기기 전(규칙 파일에 gacha 블록이 없어
     서버 쓰기가 조용히 거부되던 시절) 로컬에만 쌓인 사람들이다. 이 기기를 '최신'으로 봐야
     그 기록이 서버로 올라간다 — 0 으로 두면 첫 동기화에서 빈 서버 값에 덮여 통째로 사라진다.
   · 없고 뽑은 것도 없으면 0. 새 기기/새 설치라 서버가 항상 이긴다(원하는 동작). */
try{
  const _t = parseInt(localStorage.getItem(GACHA_TS_KEY) || '0', 10);
  if(_t > 0) _gachaTs = _t;
  else if(Object.keys(gachaOwned).length) _saveGachaLocal(true);
}catch(_){}

/* 지금 가챠 중인 시즌. 클라이언트 시계 기준이라 조작하면 다른 시즌을 뽑을 수 있지만,
   §5와 같은 결로 감수한다 — 조작해도 남에게 피해가 가지 않는다. */
function gachaSeasonNow(){
  const m = new Date().getMonth() + 1;
  if(m === 12 || m <= 2) return 'winter';
  if(m <= 5) return 'spring';
  if(m <= 8) return 'summer';
  return 'autumn';
}
const GACHA_SEASON_LABEL = { '':'상시', spring:'🌸 봄', summer:'🌊 여름', autumn:'🍂 가을', winter:'❄ 겨울' };

function isGachaPart(rec){ return !!(rec && rec.gacha); }
function gachaCount(partId){ return gachaOwned[partId] | 0; }
function isGachaOwnedPart(partId){ return gachaCount(partId) > 0; }
// 색상 변경 해금 — 🔴 이 게이트는 가챠 파츠에만 건다. 기존 꾸미기 파츠의 색상은 조건 없이 열려 있고,
//   전체에 걸면 기존 유저가 쓰던 기능을 잃는다.
/* 🔑 관리자는 게이트를 통과한다 — 파츠를 등록·검수하려면 4개를 모으기 전에 색이 어떻게 먹는지
     봐야 한다(요청 사양). 게이트가 게임 진행이지 보안 경계가 아니라서 열어도 잃는 게 없다.
   ⚠️ **여기만 열고 gachaPool() 은 건드리지 않는다.** 풀은 `gachaCount(p.id) < GACHA_DUPES_FOR_COLOR`
      를 직접 보는데, 그쪽까지 관리자를 통과시키면 풀이 통째로 비어 관리자 계정에서 가챠 자체가
      안 돌아간다(뽑을 게 없다고 뜬다). 두 조건이 같은 숫자를 볼 뿐 목적이 다르다.
   ⚠️ isAdmin 은 이 함수보다 뒤에서 선언되므로(let, 14644행) typeof 로 감싼다 —
      로딩 순서가 바뀌어 이 함수가 먼저 불려도 ReferenceError 로 죽지 않게. */
function isGachaColorUnlocked(partId){
  if(typeof isAdmin !== 'undefined' && isAdmin()) return true;
  const rec = (typeof savedParts!=='undefined' && savedParts()) ? savedParts().find(p=>p.id===partId) : null;
  return gachaCount(partId) >= gachaDupesFor(rec);
}

/* 이번 시즌 가챠 풀. 4개를 다 모은 파츠는 빠진다 — 그래서 중복 낭비가 0이고 모든 뽑기가 진척이 된다. */
function gachaPool(){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p)
    && (!p.season || p.season === season)
    && gachaCount(p.id) < gachaDupesFor(p));   // 색 없는 파츠는 1개만 모으면 빠진다
}
// 이번 시즌에 뽑힐 수 있는 전체(다 모은 것 포함) — 보관함의 "이번 시즌 컴플리트" 판정용
function gachaSeasonParts(){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p) && (!p.season || p.season === season));
}
function gachaUsedTotal(){ let n = 0; for(const k in gachaOwned) n += gachaOwned[k] | 0; return n; }
/* ⚠️ 예전 불변식은 "총 뽑기 = 레벨/5" 하나였다. 👑달성표 주간 보상(_gachaBonus)이 붙으면서
     항이 하나 늘었다 — 화면에 "5레벨당 1회"만 적으면 거짓말이 되므로 renderGachaInv 표기도 같이 고쳤다. */
function gachaTicketsEarned(){ return Math.floor(getFocusLevel() / GACHA_LEVELS_PER_TICKET) + (_gachaBonus | 0); }
function gachaTicketsLeft(){ return Math.max(0, gachaTicketsEarned() - gachaUsedTotal()); }

/* 뽑기. n회를 굴려 결과 배열을 돌려준다 — 연출은 이 결과를 받아 그리기만 하면 된다.
   티켓이 모자라거나 풀이 비면 그 자리에서 멈춘다(요청한 n보다 적게 나올 수 있다). */
function gachaDraw(n){
  const out = [];
  for(let i = 0; i < Math.max(1, n | 0); i++){
    if(gachaTicketsLeft() <= 0) break;
    const pool = gachaPool();
    if(!pool.length) break;
    const rec = pool[Math.floor(Math.random() * pool.length)];
    const after = gachaCount(rec.id) + 1;
    gachaOwned[rec.id] = after;
    out.push({
      id: rec.id, rec, count: after,
      isNew: after === 1,
      // ★ 색이 없는 파츠는 열릴 색 자체가 없으므로 이 표식이 서면 안 된다("색상 변경이 열렸어요"가 거짓말이 된다)
      unlockedColor: !rec.noColor && after === GACHA_DUPES_FOR_COLOR   // 이 뽑기로 막 열린 경우만 true
    });
  }
  if(out.length){
    _saveGachaLocal(true);   // ★ true = 이 기기가 방금 바꿨다고 시각을 찍는다(최신 판정의 근거)
    // 서버 반영은 기다리지 않는다 — 실패해도 로컬에 남아 있고, 다음 동기화에서 올라간다.
    syncGachaToServer('draw');
  }
  return out;
}

/* 서버와 맞추기 — 부팅 직후 1회, 뽑을 때마다, 그리고 계정 연동 직후.

   ★ 병합 규칙은 **최신 기기 통째로 덮어쓰기(last-write-wins)** 다. 합치지 않는다(요청사항).
     users/{uid}/gacha 에 owned 와 함께 ts(마지막으로 바꾼 시각)를 두고, ts 가 큰 쪽이 이긴다.
       · 서버 ts > 내 ts  → 서버 것으로 로컬을 통째 교체 (내 ts 는 서버 ts 를 그대로 물려받는다)
       · 내 ts > 서버 ts  → 내 것으로 서버를 통째 교체 (set — 사라진 파츠도 서버에서 지워진다)
       · 같으면 아무것도 안 한다
     [왜 바꿨나] 예전의 max 병합은 A기기 abc + B기기 bcd → abcd 로 합쳐졌다. 연동이 안 따라온
       상태에서 두 기기를 따로 쓴 사람에게는 "최근에 쓴 기기 것이 정답"이 자연스럽다.
     ⚠️ 덮어쓰기라 지는 쪽 기록은 사라진다. 규칙 파일에 gacha 블록이 들어간 뒤로는 뽑는 즉시
       올라가므로 두 기기가 갈라질 창이 거의 없지만, 오프라인에서 뽑고 나중에 켜면 그 사이에
       다른 기기가 뽑은 것이 이긴다. 이 성질을 바꾸려면 max 로 되돌리는 수밖에 없다.

   mode='pull' — ts 를 보지 않고 **무조건 서버 것을 받는다**. 계정 연동 전용이다:
     연동은 "저쪽 계정으로 갈아탄다"는 뜻이라, 이 기기의 로컬이 더 최신이어도 그 계정 것이 정답이다.
     단 서버가 비어 있으면(한 번도 동기화 안 된 계정) 로컬을 지우지 않고 그대로 올린다. */
/* 🎰 보유하지 않은 가챠 파츠를 착용 목록에서 걷어낸다 — **보유분이 바뀔 수 있는 자리마다 부른다.**

   [경위] 동기화(ts 승패)나 계정 연동(pull)은 gachaOwned 를 통째로 갈아끼우는데, 착용 정보
     (def.equippedParts)는 예전부터 **아무도 손대지 않았다.** 그래서 "보관함에는 없는데 실행
     화면에는 그대로 붙어 있는" 파츠가 남는다(제보: 초기화된 욕조가 계속 보임).
     게다가 renderGachaInv 는 보유 0 인 칸을 locked 로 그리며 **onclick 을 아예 안 붙이고**,
     비시즌 파츠면 목록에서 빠지기까지 한다 — 즉 사용자가 스스로 벗을 방법이 없는 상태다.

   ⚠️ 지우는 조건이 좁은 것이 이 함수의 요점이다:
     · savedParts 에서 **조회에 성공하고** rec.gacha 가 참인 것만 건드린다. 조회 실패를
       '가챠 아님'으로 단정하지 않는 것은 이 코드베이스의 관례다 — 반대로 단정했다가 착용
       파츠를 지운 사고가 있었다(pruneSeatPartsAgainstDef 주석). 카탈로그가 아직 안 내려온
       부팅 직후에 불려도 이 조건 덕에 아무 일도 일어나지 않는다.
     · 남의 좌석(seat.remote)은 건드리지 않는다 — 그 사람 보유분은 그 사람 기기가 판단한다.
     · 관리자는 통째로 건너뛴다. 보유 없이 착용해 검수하는 것이 등록 절차라(renderGachaInv 의
       isAdmin 우회와 같은 이유) 여기서 지우면 등록하자마자 벗겨진다.
   ★ 좌석 → 슬롯 순서를 지킬 것. 앉아 있는 캐릭터는 seat.charDef === slots[i] 로 **같은 객체**라,
     슬롯을 먼저 돌면 def 에서 이미 빠진 뒤라 좌석 순회가 아무것도 못 찾고 화면의 wrapper 만
     유령으로 남는다. 좌석을 먼저 돌아 def 와 wrapper 를 같이 정리하고, 슬롯 순회는 그때
     자리에 없던 캐릭터(자리추가 안 한 슬롯)만 줍는 뒷정리로 둔다.
     removeEntryFromCat 은 이미 없는 id 에 다시 불러도 안전하다. */
function pruneUnownedGachaParts(){
  /* ★ 전제 검사는 **호출부가 아니라 여기** 있어야 한다. 호출 지점이 넷으로 늘었고(동기화 완료,
     카탈로그 도착, 꾸미기 커밋, 삼켜진 요청 재시도), 그때마다 같은 조건을 복사하면 언젠가 하나를
     빠뜨린다. 그 하나가 곧 "보유분을 모르는 채 벗김" 사고다. */
  if(!_gachaSrvSeen) return 0;
  if(typeof savedParts === 'undefined' || !savedParts() || !savedParts().length) return 0;
  if(typeof isAdmin !== 'undefined' && isAdmin()) return 0;
  const _unowned = id => {
    const rec = savedParts().find(p => p.id === id);
    return !!(rec && isGachaPart(rec) && gachaCount(id) <= 0);
  };
  /* def 에서만 뺀다. 화면(wrapper) 정리는 좌석을 아는 호출부가 반환값을 받아서 한다. */
  const _pruneDef = def => {
    const hit = [];
    if(!def || !def.equippedParts) return hit;
    Object.keys(def.equippedParts).forEach(cat => {
      catEquippedIds(def, cat).forEach(id => {
        if(_unowned(id)){ removeEntryFromCat(def, cat, id); hit.push({ cat, id }); }
      });
    });
    return hit;
  };
  let n = 0;
  // 1) 화면에 있는 내 좌석 — def 에서 빼고, 그 자리에서 실제 wrapper 도 걷어낸다
  try{
    seats.forEach(s => {
      if(!s || s.remote) return;
      const hits = _pruneDef(s.charDef);
      if(!hits.length) return;
      n += hits.length;
      hits.forEach(h => {
        if(s.stackedPartObjs && s.stackedPartObjs[h.cat] && s.stackedPartObjs[h.cat][h.id]) unequipStackablePart(s, h.cat, h.id);
        // 그 카테고리에 아무것도 안 남았으면 일반 wrapper 까지 정리(deletePart 와 같은 관례)
        if(!s.charDef.equippedParts[h.cat]) unequipPartFromSeat(s, h.cat);
      });
      try{ applyClothVisibility(s); }catch(_){}
    });
  }catch(e){ console.warn('[가챠] 좌석 정리 실패', e); }
  // 2) 저장 슬롯 — 지금 앉아 있지 않은 캐릭터는 위 순회가 못 본다
  try{ slots.forEach(d => { n += _pruneDef(d).length; }); }catch(e){ console.warn('[가챠] 슬롯 정리 실패', e); }
  // 3) 꾸미기 초안 — 열어둔 채로 정리되면 창을 닫을 때(commitWdDraft) 되살아난다
  try{ if(typeof wdDraftDef !== 'undefined' && wdDraftDef()) n += _pruneDef(wdDraftDef()).length; }catch(_){}
  if(!n) return 0;
  try{ if(typeof saveSlots === 'function') saveSlots(); }catch(_){}
  try{
    const me = (typeof findMySeat === 'function') ? findMySeat() : null;
    if(me && typeof Presence !== 'undefined' && Presence.active()) Presence.updateDef(me.charDef);
  }catch(_){}
  /* ★ 조용히 벗기지 않는다 — 아무 말 없이 파츠가 사라지면 그것대로 "파츠가 증발했다" 제보가 된다.
     지금 벌어진 일은 '보유분과 화면을 맞춘 것'이므로 그렇게 적는다. */
  try{ if(typeof toast === 'function') toast('🎰 지금 보유하지 않은 가챠 파츠 ' + n + '개를 벗었어요'); }catch(_){}
  console.warn('[가챠] 미보유 착용 파츠 ' + n + '개 해제');
  return n;
}

async function syncGachaToServer(reason, mode){
  if(_gachaSyncing){
    /* 버리지 않고 적어 둔다 — 아래 finally 가 한 번 다시 부른다.
       ★ 'pull'(계정 연동)은 다른 모드에 덮이면 안 된다. 연동은 "저쪽 계정 것으로 갈아탄다"는
         뜻이라 ts 비교로 대체할 수 없다. */
    if(!_gachaSyncPending || mode === 'pull') _gachaSyncPending = { reason, mode };
    return;
  }
  if(!(window.firebaseAPI && firebaseAPI.loadGachaOwned && firebaseAPI.saveGachaOwned)) return;
  _gachaSyncing = true;
  /* 서버 보유분을 실제로 읽었는가 — 아래 finally 의 착용 정리가 이 값에만 의지한다.
     (읽기 실패와 '읽었는데 비어 있다'는 완전히 다른 상태다) */
  let _srvRead = false;
  try{
    const uid = getMyUserId();
    if(!uid) return;   // 🪪 uid 가 정해지기 전 — _srvRead=false 라 finally 의 착용 정리도 안 돈다
    const srv = await firebaseAPI.loadGachaOwned(uid);   // {owned, ts} | null(읽기 실패)
    if(srv === null) return;                             // 읽기 실패 — 아무것도 안 한다(덮어쓰기는 위험)
    _srvRead = true;
    _gachaSrvSeen = true;                                // 이 세션에서 보유분을 알게 됐다 → 회수를 허용
    const sOwned = (srv && srv.owned) || {};
    /* ⚠️ ms 시각에 |0 을 쓰면 안 된다 — 32비트로 잘려 **음수**가 된다(1786320000000|0 = -386395136).
       그러면 sTs 는 항상 음수, _gachaTs 는 양수라 `sTs > _gachaTs` 가 영영 참이 안 되고,
       "서버가 최신이면 받아온다"는 가지가 통째로 죽는다 — 늘 로컬을 올리기만 했다.
       (계정 연동 pull 로 한 번 _adopt 되면 로컬 ts 까지 음수로 저장돼 그 뒤 비교가 전부 무의미해진다) */
    const sTs    = Number(srv && srv.ts) || 0;
    const sHas   = Object.keys(sOwned).length > 0;

    const _adopt = ()=>{                                  // 서버 것으로 로컬 교체
      gachaOwned = {};
      for(const k in sOwned){ const n = sOwned[k] | 0; if(n > 0) gachaOwned[k] = n; }
      _saveGachaLocal(sTs || _gachaNow());
      if(typeof _gachaInvOpen === 'function' && _gachaInvOpen() && typeof renderGachaInv === 'function') renderGachaInv();
    };
    const _push = async ()=>{                             // 내 것으로 서버 교체
      if(!_gachaTs) _saveGachaLocal(true);                // 시각이 없으면 지금 찍고 올린다
      /* 🔑 [2026-09-12 제보] **쓰기 실패를 삼키지 않는다.**
         saveGachaOwned 는 실패하면 false 를 돌려주는데(콘솔에만 남는다), 여기서 반환값을 버리고
         있었다. 그래서 "규칙이 거부한 기기"는 뽑을 때마다 로컬에만 쌓이고 화면에는 멀쩡히
         보이는데 서버에는 한 번도 안 올라간다 — 다른 기기에서는 영영 안 보인다.
         제보의 경위가 정확히 이것이다(자세한 판정은 _warnServerWriteDenied 주석). */
      const ok = await firebaseAPI.saveGachaOwned(uid, gachaOwned, _gachaTs);
      if(ok === false){ try{ _warnServerWriteDenied('가챠'); }catch(_){} }
      return ok !== false;
    };

    /* 🕒 미래 ts 치유 — 모든 판정보다 **먼저** 본다. 서버 ts 가 지금(서버 시계)보다 한참 앞이면
       시계가 틀어진 기기가 올린 값이고, 그게 살아 있는 한 정상 기기는 영영 _adopt 만 한다.
       ★ 이때만은 **합친다**(파츠별 max). 평소 규칙은 통째 덮어쓰기지만, 여기서는 ts 자체가
         못 믿을 값이라 "어느 쪽이 최신인가"에 답이 없다 — 한쪽을 골랐다가 틀리면 되돌릴
         방법이 없으므로, 둘 다 살리는 것이 유일하게 안전한 선택이다. 뽑기 횟수는
         `earned − Σowned` 라 합친 만큼 정직하게 줄어든다(공짜로 얻는 것이 아니다).
       ★ 치유는 계정당 사실상 한 번이다 — 정정한 ts 로 서버를 덮으면 다음부터는 이 가지에 안 온다.
       ⚠️ pull 보다 위에 있어야 한다. 연동 직후에도 서버 ts 가 오염돼 있을 수 있고, 그 값을 그대로
         물려받으면 새 계정까지 같은 상태로 묶인다. */
    if(sTs > _gachaNow() + GACHA_TS_SKEW_TOL_MS){
      const merged = {};
      for(const k in sOwned){ const n = sOwned[k] | 0; if(n > 0) merged[k] = n; }
      for(const k in gachaOwned){ const n = gachaOwned[k] | 0; if(n > (merged[k] | 0)) merged[k] = n; }
      gachaOwned = merged;
      _saveGachaLocal(true);                              // 서버 시계 기준 '지금'으로 다시 찍는다
      await _push();
      console.warn('[가챠] 서버 ts 가 미래(' + new Date(sTs).toISOString() + ')라 정정했습니다 — 보유분은 양쪽을 합쳤습니다');
      if(typeof _gachaInvOpen === 'function' && _gachaInvOpen() && typeof renderGachaInv === 'function') renderGachaInv();
      return;
    }
    if(mode === 'pull'){
      if(sHas) _adopt();
      else if(Object.keys(gachaOwned).length) await _push();
      return;
    }
    if(sTs > _gachaTs)      _adopt();
    else if(_gachaTs > sTs) await _push();
    /* ts 가 같은데 내용이 다른 경우는 시각 부트스트랩이 겹칠 때뿐이라 사실상 없다.
       그래도 서버에 아무것도 없고 로컬엔 있으면 한 번 올려준다 — 조용히 유실되는 쪽을 막는다. */
    else if(!sHas && Object.keys(gachaOwned).length) await _push();
  }catch(e){ console.warn('[가챠] 동기화 실패', e); }
  finally{
    _gachaSyncing = false;
    /* 🎰 보유분과 착용을 맞춘다 — **어느 가지로 빠졌든** 마지막에 한 번 돈다.
       ★ _adopt 안에서만 부르면 안 된다. 이미 예전 버전에서 보유분을 잃은 채로 저장된 기기는
         다음 부팅부터 서버와 ts 가 같아 _adopt 가지로 들어가지 않는다 — 그 기기는 영영
         '보관함엔 없는데 화면엔 붙어 있는' 상태에 갇힌다. 여기서 돌아야 스스로 빠져나온다.
       ⚠️ **서버를 못 읽은 경우(_srvRead=false)에는 절대 돌지 않는다.** finally 는 위쪽
         `if(srv === null) return;` 으로 빠져나갈 때도 실행되므로, 플래그 없이 여기 두면
         네트워크가 끊긴 부팅에서 "보유분을 모르는 채로" 착용을 벗기게 된다. 그건 이 수정이
         고치려는 사고보다 더 나쁘다.
       ⚠️ 카탈로그(savedParts)가 아직 없으면 함수가 스스로 물러난다 — 부팅 4.2초 호출이
         카탈로그보다 빨라도 아무 일도 안 일어나고, 10분 뒤 tick 이 다시 본다. */
    if(_srvRead){
      try{ pruneUnownedGachaParts(); }catch(e){ console.warn('[가챠] 미보유 파츠 정리 실패', e); }
    }
    /* 이번 왕복 중에 들어와 삼켜진 요청을 여기서 한 번 흘려보낸다.
       ⚠️ _gachaSyncing 을 false 로 되돌린 **뒤에** 부를 것 — 먼저 부르면 그 호출이 다시
         pending 에 적히고 아무도 실행하지 않는다. 꼬리물기는 안 생긴다: 이 시점에는 진행 중인
         동기화가 없으므로 재시도분은 pending 이 아니라 본문으로 들어간다. */
    const _pend = _gachaSyncPending; _gachaSyncPending = null;
    if(_pend){ try{ syncGachaToServer(_pend.reason, _pend.mode); }catch(_){} }
  }
}
// 부팅 직후 1회 — firebaseAPI와 계정 ID가 준비될 시간을 준다(집중 동기화와 같은 시점).
setTimeout(()=>{ try{ syncGachaToServer('boot'); }catch(_){} }, 4200);
/* ⏱️ 그 뒤로 주기적으로 — **이게 없어서 가챠만 사실상 동기화가 안 됐다.**
   [무엇이 문제였나] 예전 호출 시점은 '부팅 4.2초'와 '뽑을 때' 둘뿐이었다. 이 앱은 켜두고 쓰는
     앱이라 그 4.2초가 그 세션의 처음이자 마지막 조회였고, 게다가 그 시점에 firebaseAPI 가 아직
     안 붙어 있으면 조용히 return 해서 **그 세션에는 재시도가 아예 없었다**(집중 누적 쪽은 주기
     타이머가 다시 시도해 준다 — 그 차이 하나로 증상이 갈렸다).
   [왜 단순히 '안 보임'으로 끝나지 않는가] 병합이 ts 최신 승 **통째 덮어쓰기**라, 받아오지 못한
     기기에서 한 번만 뽑으면 그 기기의 목록이 서버를 덮어 다른 기기의 뽑기가 사라진다.
     즉 안 받아오는 것이 곧 지우는 것이다 — 그래서 '연동이 안 된다'로 보인다.
   [비용] 읽기 1회/10분/기기. 쓰기는 내 ts 가 더 클 때만이라 평소엔 0회다. */
const GACHA_SYNC_INTERVAL_MS = 10*60*1000;   // 10분 — 집중 누적(FOCUS_SYNC_INTERVAL_MS)과 같은 박자
setInterval(()=>{ try{ syncGachaToServer('tick'); }catch(_){} }, GACHA_SYNC_INTERVAL_MS);

/* ═══ 🎰 파츠 보관함 (T키) · 가챠 뽑기 창 ══════════════════════════════════
   ★ 착용은 꾸미기(F2)와 같은 배관을 그대로 탄다 — toggleEquip(cat, id).
     draft에 얹고 미리보기에 붙인 뒤, 창을 닫을 때 commitWdDraft()로 실제 캐릭터에 저장한다.
     가챠 파츠는 stackable이 강제로 켜져 있으므로 기존 꾸미기 파츠를 밀어내지 않는다.
   🚧 뽑기 연출(캡슐 크랙·도트 파티클)은 아직 없다. 지금은 결과만 뜬다. */
let _gachaTab = 'all';   // all | always | season
/* 🏷️ 카테고리 소분류 — 'all' 또는 PART_CATS 의 cat 값. 상시/시즌 탭과 **직교하는 두 번째 축**이다.
   ★ _gachaTab 과 같은 모듈 변수라 창을 닫았다 열어도 유지된다(탭과 같은 관례를 일부러 맞췄다).
   ★ 상시↔시즌을 오갔을 때 그쪽에 그 카테고리가 하나도 없으면 renderGachaInv 가 'all' 로 되돌린다 —
     안 그러면 파츠는 있는데 화면만 텅 빈 상태가 되어 "보관함이 비었다"로 오해한다. */
let _gachaCat = 'all';
/* 🍂 시즌 드롭다운 — 'all' 또는 GACHA_SEASON_LABEL 의 시즌 키(spring/summer/autumn/winter).
   ★ **시즌 탭에서만** 쓰인다. 상시 탭은 정의상 p.season 이 없는 것들이라 거를 축이 없고,
     전체 탭에서 걸면 «시즌으로 걸러진 전체»라는 앞뒤가 안 맞는 상태가 된다.
   ★ _gachaCat 과 같은 모듈 변수 — 창을 닫았다 열어도, 탭을 오갔다 돌아와도 유지된다.
   ★ 고른 시즌이 목록에서 사라지면 _gachaSeasonCounts 가 조용히 'all' 로 되돌린다. */
let _gachaSeason = 'all';
/* 📄 파츠 그리드 페이지 — 4열 × 2줄 = 한 페이지 8칸.
   ★ 세로 스크롤 대신 페이지로 끊는다. 그리드의 max-height:46vh · overflow-y:auto 는 **그대로 둔다** —
     우클릭 상세조정 패널이 끼면 8칸에 더해 한 줄이 더 붙어서 46vh를 넘길 수 있고, 그때는
     예전처럼 스크롤되는 편이 안전하다(패널의 scrollIntoView 도 그 스크롤 박스를 전제로 쓴다).
   ⚠️ 열을 바꾸려면 CSS(#gachaInvGrid 의 repeat(4,1fr))와 여기를 **같이** 고쳐야 한다.
     한쪽만 고치면 페이지당 칸 수와 실제 줄 수가 어긋나 마지막 줄이 잘리거나 빈칸이 남는다. */
const GACHA_GRID_COLS = 4, GACHA_GRID_ROWS = 2;
const GACHA_PAGE_SIZE = GACHA_GRID_COLS * GACHA_GRID_ROWS;
let _gachaPage = 0;
/* 다음 렌더 때 '이 파츠가 있는 페이지'로 한 번 점프하고 스스로 비워지는 예약 슬롯.
   [왜 필요한가] 창을 열면 미리보기 아래 색상 영역은 _gachaSelId 를 따라가는데, 정작 그 칸이
     3페이지에 있으면 "색상은 모자 것인데 화면엔 모자가 없다"가 된다. 뽑기 직후도 같다 —
     새로 뽑은 파츠가 안 보이면 안 들어온 줄 안다.
   ★ 매 렌더마다 따라가면 안 된다. 그러면 3페이지를 보다가 파츠를 하나 착용하는 것만으로
     선택이 옮겨가 페이지가 제멋대로 튄다. 그래서 '한 번만' 쓰고 지운다. */
let _gachaJumpId = null;
// 방금 뽑은 파츠 — [보관함으로] 를 누를 때 _gachaJumpId 로 옮겨진다(그 페이지가 열린다).
let _gachaLastDrawId = null;
let _gachaSelId = null;  // 지금 보고 있는 파츠 — 미리보기 아래 색상 영역이 이걸 따라간다

/* 관리자 등록 — 꾸미기의 [+ 등록]과 같은 흐름(#partRegOverlay)을 그대로 쓴다.
   신규일 때만 🎰 를 미리 켜준다(수정은 그 파츠의 저장값을 그대로 보여야 한다). */
function openGachaPartRegister(cat, rec){
  if(typeof openPartRegister!=='function') return;
  openPartRegister(cat, rec);
  if(!rec){
    const g=document.getElementById('partRegGacha'); if(g) g.checked = true;
    if(typeof syncPartRegGachaLock==='function') syncPartRegGachaLock();
  }
}

function _gachaWornIds(){
  const def = (typeof wdDraftDef!=='undefined' && wdDraftDef()) || (findMySeat() && findMySeat().charDef);
  const out = [];
  if(def && def.equippedParts){
    for(const c in def.equippedParts){ (catEquippedIds(def, c)||[]).forEach(i=>out.push(i)); }
  }
  return out;
}
function _gachaThumb(rec){ return rec.thumbUrl || rec.thumbnail || null; }
function _gachaPips(n, max){ const m = max || GACHA_DUPES_FOR_COLOR;
  return '●'.repeat(Math.min(n, m)) + '○'.repeat(Math.max(0, m - n)); }
const GACHA_SEASON_MONTH = { spring:'3월', summer:'6월', autumn:'9월', winter:'12월' };

/* 🏷️ 카테고리 소분류 줄 — 꾸미기창의 하위 카테고리(.wd-sub-row)와 같은 Win98 라디오 관례.
   [무엇을 푸는가] 보관함에는 상시/시즌 축밖에 없어서, 파츠가 늘어나면 모자를 찾으려고
     4열 그리드를 끝까지 스크롤해야 했다.
   ★ **지금 목록에 실제로 존재하는 카테고리만** 낸다. PART_CATS 전부를 늘어놓으면 가챠 파츠가
     하나도 없는 카테고리까지 라디오가 생겨, 눌러도 빈 화면만 나오는 선택지가 된다.
     (PART_CATS 는 customPartCats 병합분이라 개수가 고정도 아니다 — 12개를 넘기면 줄이 계속 늘어난다.)
   ★ 순서는 PART_CATS 순서를 따른다. 등장 순서로 정렬하면 파츠를 하나 뽑을 때마다 라디오가
     자리를 바꿔서, 늘 같은 곳에 있던 '모자'를 매번 다시 찾아야 한다.
   ⚠️ 여기서 _gachaCat 을 되돌리는 일이 있으므로 **호출부는 이 함수 뒤에 필터를 걸어야 한다.**
      순서를 바꾸면 사라진 카테고리로 한 프레임 동안 빈 그리드가 그려진다. */
/* 🍂 시즌 후보 집계 — **시즌 필터를 걸기 전 목록**으로 센다.
   ⚠️ 걸고 나서 세면 지금 고른 시즌 하나만 남아 나머지 선택지가 화면에서 사라진다
     (한 번 고르면 다른 시즌으로 돌아올 수 없게 된다). 카테고리 라디오가 listBeforeCat 을
     받는 것과 똑같은 이유다.
   ⚠️ 여기서 _gachaSeason 을 되돌리는 일이 있으므로 **호출부는 이 함수 뒤에 필터를 걸어야 한다.**
     순서를 바꾸면 사라진 시즌으로 한 프레임 동안 빈 그리드가 그려진다. */
function _gachaSeasonCounts(listBeforeSeason){
  const cnt = Object.create(null);
  (listBeforeSeason||[]).forEach(p=>{ if(p.season) cnt[p.season] = (cnt[p.season]|0) + 1; });
  /* 고른 시즌이 이 목록에 없으면 조용히 전체로 되돌린다 — 카테고리 라디오와 같은 처리(토스트 없음). */
  if(_gachaSeason !== 'all' && !cnt[_gachaSeason]){ _gachaSeason = 'all'; _gachaPage = 0; }
  return cnt;
}

/* 🍂 시즌 드롭다운 — 카테고리 라디오와 **같은 줄** 오른쪽 끝(#gachaInvSubs).
   [왜 이 줄인가] 이 줄은 원래도 :empty 면 통째로 사라진다 — 「시즌 탭에서만 나타나는 컨트롤」이
     이 줄에서는 새로 만드는 성질이 아니라 이미 있는 성질이다. 폴더탭 줄(#gachaInvTabs)에 얹으면
     탭과 아래 패널을 잇는 border-bottom:none 라인을 sunken 컨트롤이 끊는다 — 그 줄은
     '아래와 이어져 보이는 것'이 일이라 거기에 다른 컨트롤을 두면 안 된다.
   ★ 후보는 «지금 목록에 실제로 있는 시즌»뿐이다 — 눌러도 빈 화면인 선택지를 만들지 않는다.
     관리자는 renderGachaInv 의 filter 를 isAdmin 이 앞에서 끊어 목록 자체가 전부이므로,
     **이 규칙 하나만으로 네 시즌이 다 뜬다.** 관리자 분기를 따로 두지 않는 이유다.
   ★ 선택지가 0~1종이면 그리지 않는다 — 카테고리 라디오의 cats.length<2 와 같은 관례.
   ⚠️ 색·테두리는 전부 토큰 경유여야 한다(CSS #gachaInvSeason). 여기서 style 을 직접 박으면
     버블 테마에서 이 컨트롤만 Win98 로 남는다(audit 검사 12·13). */
function _appendGachaSeasonSel(row, seasonCnt){
  if(!seasonCnt) return;
  const keys = Object.keys(GACHA_SEASON_LABEL).filter(k => k && seasonCnt[k]);
  if(keys.length < 2) return;
  const sel = document.createElement('select');
  sel.id = 'gachaInvSeason';
  sel.title = '시즌으로 걸러요';
  const total = keys.reduce((s,k)=> s + (seasonCnt[k]|0), 0);
  const add = (v, label)=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    if(_gachaSeason === v) o.selected = true;
    sel.appendChild(o);
  };
  add('all', '전체 시즌 ' + total);
  keys.forEach(k => add(k, (GACHA_SEASON_LABEL[k] || k) + ' ' + (seasonCnt[k]|0)));
  sel.onchange = ()=>{
    const v = sel.value;
    if(_gachaSeason === v) return;
    _gachaSeason = v;
    _gachaPage = 0;   // 시즌이 바뀌면 목록 자체가 다른 것이다 — 3페이지에서 시작하면 안 된다
    /* 상세조정 패널은 접는다 — 열려 있던 파츠가 다른 시즌이라 목록에서 사라지면 패널만 남아
       어느 파츠 것인지 알 수 없는 상태가 된다(카테고리 라디오와 같은 처리). */
    if(typeof activeWdAdj!=='undefined' && activeWdAdj()){
      _setActiveWdAdj(null);
      if(typeof _clearMultiPanelRef==='function') _clearMultiPanelRef();
    }
    renderGachaInv();
    if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
  };
  row.appendChild(sel);
}

function _renderGachaCatRow(listBeforeCat, seasonCnt){
  const row = document.getElementById('gachaInvSubs');
  if(!row) return;
  const cnt = Object.create(null);
  (listBeforeCat||[]).forEach(p=>{ cnt[p.cat] = (cnt[p.cat]|0) + 1; });
  const cats = (typeof PART_CATS!=='undefined' ? PART_CATS() : []).filter(c => cnt[c.cat]);

  /* 고른 카테고리가 이 탭에 없으면 조용히 전체로 되돌린다.
     [왜 토스트를 안 띄우나] 탭을 누른 것은 유저이고, 그 결과가 화면에 바로 보인다 —
       여기에 알림까지 붙이면 탭을 오갈 때마다 토스트가 쌓인다. */
  if(_gachaCat !== 'all' && !cnt[_gachaCat]) { _gachaCat = 'all'; _gachaPage = 0; }

  row.innerHTML = '';

  const total = (listBeforeCat||[]).length;
  const mk = (cat, label, n)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gc-sub-btn' + (_gachaCat === cat ? ' on' : '');
    b.innerHTML = escHtml(label) + ' <span class="gc-sub-n">' + (n|0) + '</span>';
    b.onclick = ()=>{
      if(_gachaCat === cat) return;
      _gachaCat = cat;
      _gachaPage = 0;   // 카테고리가 바뀌면 목록 자체가 다른 것이다 — 3페이지에서 시작하면 안 된다
      /* 상세조정 패널은 접는다 — 열려 있던 파츠가 다른 카테고리라 목록에서 사라지면
         패널만 남아 어느 파츠 것인지 알 수 없는 상태가 된다(꾸미기창이 탭을 바꿀 때와 같은 처리). */
      if(typeof activeWdAdj!=='undefined' && activeWdAdj()){
        _setActiveWdAdj(null);
        if(typeof _clearMultiPanelRef==='function') _clearMultiPanelRef();
      }
      renderGachaInv();
      if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
    };
    return b;
  };
  /* 카테고리가 0~1종뿐이면 라디오를 아예 안 그린다 — 선택지가 하나인 라디오는 자리만 먹는다.
     ⚠️ 예전에는 여기서 return 해 줄을 통째로 비웠다. 지금은 시즌 드롭다운이 **같은 줄**을 쓰므로
       카테고리가 하나여도 드롭다운은 나와야 한다. 둘 다 없으면 줄은 여전히 비고,
       #gachaInvSubs:empty 가 알아서 숨긴다(관례 그대로). */
  if(cats.length >= 2){
    /* 라디오만 따로 감싼다 — 넘칠 때 세로 스크롤되는 것은 **이 안쪽**이어야 한다.
       [왜] 예전엔 #gachaInvSubs 자체가 max-height:66px + overflow-y:auto 였다. 그대로 두고
         드롭다운을 같은 줄에 넣으면 카테고리가 많을 때 드롭다운이 스크롤 안으로 밀려 들어가
         「보이지 않는 필터」가 된다. 스크롤 상자를 한 겹 안으로 옮겨 드롭다운은 늘 제자리에 둔다. */
    const box = document.createElement('div');
    box.id = 'gachaInvCats';
    box.appendChild(mk('all', '전체', total));
    cats.forEach(c=> box.appendChild(mk(c.cat, (c.icon||'') + ' ' + c.label, cnt[c.cat])));
    row.appendChild(box);
  }
  _appendGachaSeasonSel(row, seasonCnt);
}

/* 📄 ◀ 1/2 ▶ — 하단 버튼 줄 왼쪽. 한 페이지뿐이면 통째로 비운다(:empty 로 숨겨진다).
   ★ 그리드는 건드리지 않는다. 페이저는 '몇 번째 8칸을 보여줄지'만 정하고,
     실제 목록은 상시/시즌 탭과 카테고리 라디오가 정한다. */
function _renderGachaPager(pages){
  const box = document.getElementById('gachaInvPager');
  if(!box) return;
  box.innerHTML = '';
  if(pages <= 1) return;
  const step = d=>()=>{
    const next = Math.min(pages - 1, Math.max(0, _gachaPage + d));
    if(next === _gachaPage) return;
    _gachaPage = next;
    renderGachaInv();
    /* 색상 영역은 건드리지 않는다 — 페이지를 넘긴 것뿐이고 고른 파츠(_gachaSelId)는 그대로다.
       여기서 갱신하면 페이지를 넘길 때마다 색상 영역이 깜빡인다. */
  };
  const mk = (txt, title, dis, fn)=>{
    const b = document.createElement('button');
    b.type='button'; b.textContent = txt; b.title = title; b.disabled = !!dis;
    if(!dis) b.onclick = fn;
    return b;
  };
  box.appendChild(mk('◀', '이전 페이지', _gachaPage <= 0, step(-1)));
  const n = document.createElement('span'); n.className='gc-pg-num';
  n.textContent = (_gachaPage + 1) + '/' + pages;
  box.appendChild(n);
  box.appendChild(mk('▶', '다음 페이지', _gachaPage >= pages - 1, step(1)));
}

function renderGachaInv(){
  const bar = document.getElementById('gachaInvBar');
  const grid = document.getElementById('gachaInvGrid');
  if(!bar || !grid) return;
  const season = gachaSeasonNow();
  const left = gachaTicketsLeft();
  bar.innerHTML = '레벨 <b>' + getFocusLevel() + '</b> · 남은 뽑기 <b>' + left + '회</b>'
    + ' <span style="opacity:.6">(' + GACHA_LEVELS_PER_TICKET + '레벨당 1회'
      + ((_gachaBonus|0) > 0 ? ' + 👑달성표 ' + (_gachaBonus|0) + '회' : '') + ')</span><br>'
    + '이번 시즌 가챠 — <b>' + (GACHA_SEASON_LABEL[season] || season) + '</b>';

  // 보여줄 것: 이번 시즌 가챠분 전부 + 지금은 안 나오지만 내가 가진 비시즌 파츠
  // ★ 관리자는 시즌·소유와 무관하게 전부 본다 — 등록한 파츠를 그 자리에서 테스트해야 하기 때문이다.
  let list = savedParts().filter(p => isGachaPart(p)
    && (isAdmin() || !p.season || p.season === season || gachaCount(p.id) > 0));
  if(_gachaTab === 'always') list = list.filter(p => !p.season);
  if(_gachaTab === 'season') list = list.filter(p => !!p.season);
  /* 🍂 시즌 축 — **시즌 탭에서만** 건다. 집계(=드롭다운 후보)가 먼저, 필터는 그 뒤다.
     ★ 상시 탭은 정의상 p.season 이 없는 것들이라 거를 축이 없고, 전체 탭에서 걸면
       «시즌으로 걸러진 전체»가 되어 탭 이름과 내용이 어긋난다. */
  let seasonCnt = null;
  if(_gachaTab === 'season'){
    seasonCnt = _gachaSeasonCounts(list);
    if(_gachaSeason !== 'all') list = list.filter(p => p.season === _gachaSeason);
  }
  /* 🏷️ 소분류 줄은 **카테고리 필터를 걸기 전 목록**으로 그린다 — 걸고 나서 세면 지금 고른
     카테고리 하나만 남아 나머지 선택지가 화면에서 사라진다(고르면 되돌아올 수 없게 된다). */
  _renderGachaCatRow(list, seasonCnt);
  if(_gachaCat !== 'all') list = list.filter(p => p.cat === _gachaCat);
  list.sort((a,b)=> (a.order|0) - (b.order|0));

  const worn = _gachaWornIds();
  grid.innerHTML = '';
  if(!list.length){
    const d = document.createElement('div');
    d.style.cssText = 'grid-column:1/-1;font-size:11px;opacity:.7;text-align:center;padding:18px 6px;line-height:1.7;';
    d.textContent = isAdmin() ? '등록된 가챠 파츠가 없어요. 아래 [+ 등록]으로 만들어 주세요.'
                            : '아직 이 시즌에 가챠로 나오는 파츠가 없어요.';
    grid.appendChild(d);
  }
  // 선택이 비었거나 목록에서 사라졌으면 착용 중인 것 → 가진 것 순으로 하나 잡아둔다.
  if(!list.some(p => p.id === _gachaSelId)){
    const pick = list.find(p => worn.includes(p.id)) || list.find(p => gachaCount(p.id) > 0) || null;
    _gachaSelId = pick ? pick.id : null;
  }

  /* 📄 페이지 확정 — 예약된 점프가 있으면 그 파츠가 있는 쪽으로 한 번만 옮기고 예약을 지운다.
     ⚠️ 점프는 _gachaPage 를 덮으므로 반드시 범위 보정보다 **먼저** 온다. */
  const pages = Math.max(1, Math.ceil(list.length / GACHA_PAGE_SIZE));
  if(_gachaJumpId){
    const at = list.findIndex(p => p.id === _gachaJumpId);
    if(at >= 0) _gachaPage = Math.floor(at / GACHA_PAGE_SIZE);
    _gachaJumpId = null;   // 성공하든 못 찾든 한 번 쓰고 버린다 — 안 지우면 매 렌더마다 페이지가 튄다
  }
  /* 목록이 줄어 지금 페이지가 사라지는 경우가 있다(관리자 삭제·시즌 교체·서버 동기화).
     그대로 두면 빈 페이지가 열리고 "파츠가 다 사라졌다"로 보인다. */
  _gachaPage = Math.min(pages - 1, Math.max(0, _gachaPage | 0));
  const pageList = list.slice(_gachaPage * GACHA_PAGE_SIZE, (_gachaPage + 1) * GACHA_PAGE_SIZE);

  pageList.forEach(rec => {
    const have = gachaCount(rec.id);
    const show = have > 0 || isAdmin();         // ★ isAdmin 우회 — 없으면 등록 후 테스트를 못 한다
    const cell = document.createElement('div');
    cell.className = 'gc-cell' + (show ? '' : ' locked') + (worn.includes(rec.id) ? ' worn' : '')
      + (rec.id === _gachaSelId ? ' sel' : '');
    const offSeason = rec.season && rec.season !== season;
    const th = _gachaThumb(rec);
    if(show && th){
      const img = document.createElement('img'); img.className='gc-thumb'; img.src = th; img.alt='';
      cell.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className='gc-ph';
      ph.textContent = show ? (rec.icon || '🎁') : '❔';
      cell.appendChild(ph);
    }
    const nm = document.createElement('div'); nm.className='gc-name';
    // ⚠️ 미획득 파츠는 이름을 숨긴다 — 이름이 보이면 실루엣의 의미가 없다.
    nm.textContent = show ? (rec.name || '파츠') : '???';
    cell.appendChild(nm);
    if(show){
      const pip = document.createElement('div'); pip.className='gc-pips';
      // 🎨 색이 없는 파츠는 ●○ 도 1칸이고 '색상 변경' 이야기도 하지 않는다 — 없는 보상을 예고하면 안 된다.
      const _dup = gachaDupesFor(rec);
      pip.textContent = _gachaPips(have, _dup) + ((!rec.noColor && isGachaColorUnlocked(rec.id)) ? ' 🎨' : '')
        + (isAdmin() && !have ? ' (미보유)' : '');
      cell.appendChild(pip);
      cell.title = (rec.name||'파츠') + ' — ' + have + '/' + _dup
        + (rec.noColor ? ' · 색상 변경이 없는 파츠예요'
                       : (isGachaColorUnlocked(rec.id) ? ' · 색상 변경 열림' : ''))
        + '\n' + (GACHA_SEASON_LABEL[rec.season||''] || '') + ' 가챠'
        + '\n눌러서 착용/해제' + (isAdmin() ? '\n더블클릭 = 파츠 수정' : '');
      cell.onclick = async ()=>{
        _gachaSelId = rec.id;                 // 색상 영역이 이 파츠를 따라간다
        await toggleEquip(rec.cat, rec.id);
        renderGachaInv();
        if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
      };
      /* 🖱️ 우클릭 = 상세조정 — 꾸미기 카드와 완전히 같은 관례·같은 패널(createWardrobeAdjPanel).
         [왜] 보관함에서 착용하면 미리보기에는 붙는데 위치·크기·회전을 만질 방법이 없었다.
           가챠 파츠는 stackable이 강제라 꾸미기 창에도 안 뜨므로, 여기서 못 하면 아예 못 한다.
         ★ activeWdAdj 를 그대로 쓴다 — 기즈모 부착(updateWdGizmoForActivePanel)과 미리보기 하단
           색상 영역이 전부 이 값을 보고 움직이기 때문에, 별도 상태를 만들면 셋이 따로 논다. */
      cell.oncontextmenu = e=>{
        e.preventDefault();
        if(!worn.includes(rec.id)){ toast('먼저 파츠를 착용해 주세요'); return; }
        if(activeWdAdj() && activeWdAdj().id===rec.id){ _setActiveWdAdj(null); _clearMultiPanelRef(); }
        else { _setActiveWdAdj({cat:rec.cat, id:rec.id}); _gachaSelId=rec.id; }
        renderGachaInv();
        if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
      };
      if(isAdmin()){
        // 꾸미기 카드와 같은 관례 — 더블클릭으로 수정, ✕로 삭제
        cell.ondblclick = ev=>{ ev.stopPropagation(); openGachaPartRegister(rec.cat, rec); };
        const del = document.createElement('button'); del.className='gc-del'; del.type='button';
        del.textContent='✕'; del.title='이 파츠 삭제 (관리자)';
        del.onclick = ev=>{
          ev.stopPropagation();
          if(!confirm('「'+(rec.name||'파츠')+'」을(를) 삭제할까요?')) { window.focus(); return; }
          window.focus();
          deletePart(rec.id);
          renderGachaInv();
        };
        cell.appendChild(del);
      }
    } else if(offSeason){
      /* ★ "매년 돌아온다"를 UI로 못박는 자리다. 1회 한정으로 바꾸려면 이 문구부터 걷어야 한다. */
      const bk = document.createElement('div'); bk.className='gc-back';
      bk.textContent = (GACHA_SEASON_MONTH[rec.season]||'') + '에 돌아옴';
      cell.appendChild(bk);
      cell.title = '지금은 가챠에 나오지 않는 시즌 파츠예요';
    } else {
      cell.title = '아직 안 뽑은 파츠예요';
    }
    /* 🖱️ 잠긴 칸(미보유)에도 우클릭 응답을 준다.
       [왜] 예전엔 oncontextmenu 가 show 블록 안에만 있어서, 안 뽑은 파츠를 우클릭하면
         토스트조차 없이 완전히 무반응이었다 — 유저에겐 "우클릭 기능이 고장났다"로 보인다.
         특히 서버 동기화가 막혀 보유 목록이 비어버린 사람은 전 칸이 잠기므로 전멸처럼 느껴진다. */
    if(!show){
      cell.oncontextmenu = e=>{
        e.preventDefault();
        toast(offSeason ? '지금은 가챠에 안 나오는 시즌 파츠예요'
                        : '아직 안 뽑은 파츠라 조정할 수 없어요');
      };
    }
    grid.appendChild(cell);
    /* 상세조정 패널은 그 칸 **바로 뒤**에 끼운다(꾸미기 그리드와 같은 관례).
       그리드가 4열이라 그냥 넣으면 한 칸짜리로 찌그러진다 — 한 줄을 통째로 쓰게 한다. */
    if(activeWdAdj() && activeWdAdj().id === rec.id && worn.includes(rec.id)){
      const panel = createWardrobeAdjPanel(rec.cat, rec.id);
      panel.style.gridColumn = '1 / -1';
      grid.appendChild(panel);
      /* ★ 그리드는 max-height:46vh 짜리 스크롤 박스다. 아랫줄 칸을 우클릭하면 패널이
         스크롤 밖에 열려서 "아무것도 안 나온다"로 보인다 — 열자마자 보이는 데까지 끌어온다.
         block:'nearest' 이라 이미 보이는 위치면 화면이 튀지 않는다. */
      requestAnimationFrame(()=>{ try{ panel.scrollIntoView({block:'nearest'}); }catch(_){} });
    }
  });
  /* 📄 마지막 페이지의 남는 자리를 보이지 않는 칸으로 채워 그리드 높이를 2줄로 고정한다.
     [왜] 안 채우면 페이지를 넘길 때마다 창이 줄었다 늘었다 하고, 그 아래 [가챠 뽑으러 가기]가
       위아래로 움직인다 — ▶ 를 누른 손이 그대로 뽑기 버튼을 누르는 사고가 난다.
     ★ 페이지가 하나뿐이면 채우지 않는다. 파츠가 3개뿐인 사람의 창이 억지로 2줄로 늘어나면
       빈 칸이 '아직 안 뽑은 파츠'처럼 보인다(잠긴 칸과 구분이 안 된다). */
  if(pages > 1){
    for(let i = pageList.length; i < GACHA_PAGE_SIZE; i++){
      const hole = document.createElement('div');
      hole.className = 'gc-cell gc-hole';
      grid.appendChild(hole);
    }
  }
  _renderGachaPager(pages);
  _renderGachaAdminFoot();
  // ★ 기즈모 부착·기즈모 바 표시는 꾸미기와 같은 함수가 담당한다(activeWdAdj를 보고 판단).
  if(typeof updateWdGizmoForActivePanel==='function') updateWdGizmoForActivePanel();
}

/* 관리자 등록 줄 — 카테고리를 고르고 [+ 등록]. 꾸미기의 카테고리별 [+ 등록]과 같은 모달로 간다. */
function _renderGachaAdminFoot(){
  const sel = document.getElementById('gachaAdminCat'), btn = document.getElementById('gachaAdminAdd');
  if(!sel || !btn) return;
  if(!isAdmin()){ sel.style.display='none'; btn.style.display='none'; return; }
  sel.style.display=''; btn.style.display='';
  if(!sel.options.length && typeof PART_CATS!=='undefined'){
    PART_CATS().forEach(c=>{
      const o=document.createElement('option'); o.value=c.cat; o.textContent=(c.icon||'')+' '+c.label;
      sel.appendChild(o);
    });
  }
  btn.onclick = ()=>openGachaPartRegister(sel.value || (PART_CATS()[0] && PART_CATS()[0].cat));
}

/* ── 뽑기 연출 — 캡슐 크랙 · 도트풍 ──────────────────────────────────────
   ★ 곡선을 쓰지 않는다. 캡슐은 계단식 픽셀 실루엣이고 파티클도 픽셀 사각형이다.
     타이밍은 전부 steps() — 부드러운 트윈을 쓰면 도트 체감이 통째로 사라진다.
   ★ 대기 상태에서는 캡슐이 부르르 떨기만 한다. 갈라짐·파티클·파츠 등장은
     뽑기 버튼을 눌렀을 때만 이어지는 시퀀스다.
   ⚠️ 애니메이션 노드는 창을 닫을 때 통째로 지운다 — run 모드에서 상시 도는 것을 막는다.
   ⚠️ 시퀀스 도중에 창을 닫거나 다시 뽑으면 앞 시퀀스의 타이머가 늦게 도착해 화면을 덮어쓴다.
     _gachaAnimToken 으로 세대를 세어 늦게 온 것은 버린다. */
const GACHA_CAPSULE = [
  '....######....',
  '..##########..',
  '.############.',
  '##############',
  '##############',
  '##############',
  '##############',
  '==============',
  '**************',
  '**************',
  '**************',
  '**************',
  '.************.',
  '..**********..',
  '....******....'
];
const GACHA_CAP_SPLIT = 7;   // 이 줄까지가 위 껍질(= 띠). 아래는 아래 껍질.

function _gachaCapsuleSVG(px){
  const map = GACHA_CAPSULE, H = map.length, W = map[0].length, O = 1;   // O = 외곽선 여유 한 칸
  const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && map[y][x] !== '.';
  const rect = (x, y, cls) => '<rect x="' + ((x+O)*px) + '" y="' + ((y+O)*px)
    + '" width="' + px + '" height="' + px + '" class="' + cls + '"/>';
  const top = [], bot = [];
  const push = (y, s) => { (y <= GACHA_CAP_SPLIT ? top : bot).push(s); };
  // 굵은 외곽선 — 빈 칸이 채워진 칸에 대각까지 닿으면 그린다(계단 모서리가 뭉툭해진다).
  for(let y = -O; y < H+O; y++) for(let x = -O; x < W+O; x++){
    if(filled(x, y)) continue;
    let touch = false;
    for(let dy = -1; dy <= 1 && !touch; dy++) for(let dx = -1; dx <= 1; dx++){ if(filled(x+dx, y+dy)){ touch = true; break; } }
    if(touch) push(Math.max(0, Math.min(H-1, y)), rect(x, y, 'gc-px-o'));
  }
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const c = map[y][x];
    if(c === '.') continue;
    push(y, rect(x, y, c === '#' ? 'gc-px-a' : (c === '=' ? 'gc-px-b' : 'gc-px-c')));
  }
  const w = (W + 2*O) * px, h = (H + 2*O) * px;
  return '<svg class="gc-capsule" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h
    + '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">'
    + '<g class="gc-cap-top">' + top.join('') + '</g>'
    + '<g class="gc-cap-bot">' + bot.join('') + '</g></svg>';
}

let _gachaAnimToken = 0;
function _gachaStage(){ return document.getElementById('gachaDrawStage'); }
function _gachaStopAnim(){ _gachaAnimToken++; const s = _gachaStage(); if(s) s.innerHTML = ''; }

function _gachaMsg(text){
  const s = _gachaStage(); if(!s) return;
  s.innerHTML = '';
  const d = document.createElement('div'); d.className = 'gc-empty';
  d.style.whiteSpace = 'pre-line'; d.textContent = text;
  s.appendChild(d);
}
// 대기 — 캡슐 하나가 부르르 떨고만 있다.
function _gachaStageIdle(){
  const s = _gachaStage(); if(!s) return;
  s.innerHTML = '<div class="gc-cap-wrap idle">' + _gachaCapsuleSVG(7) + '</div>';
}

/* 연출 중 잠금 — 뽑기 버튼과 [보관함으로]만 잠근다.
   ⚠️ 닫기(✕)는 **절대 잠그지 않는다.** 예전엔 여기 gachaDrawClose 가 들어 있어서 pointer-events 가
     꺼졌는데, 아래 시퀀스에는 busy 를 못 풀고 빠져나가는 return 이 여럿 있었다. 그 조합이
     "창이 통째로 얼어서 닫지도 못한다"였다. 잠금이 풀리지 않아도 최소한 닫을 수는 있어야 한다. */
function _gachaSetBusy(on){
  ['gachaDraw1','gachaDraw5','gachaBackInv'].forEach(id=>{
    const b = document.getElementById(id); if(!b) return;
    if(b.tagName === 'BUTTON') b.disabled = !!on; else b.style.pointerEvents = on ? 'none' : '';
  });
}

/* 뽑기 버튼을 누른 순간부터의 시퀀스: 빠른 떨림 → 갈라짐 + 픽셀 파티클 → 결과 팝인
   ★ n 은 '요청 횟수'다. 티켓이 모자라면 gachaDraw 가 알아서 줄여서 돌려준다 —
     호출부에서 Math.min 으로 깎아 넘기지 않는다(그게 5연속 먹통의 원인이었다. 아래 참고). */
function _gachaRunDraw(n){
  /* 잠금 해제를 한 곳으로 모은다. 예전엔 시퀀스 안의 return 이 전부 busy 를 남긴 채 빠져나가서,
     한 번 어긋나면 버튼이 영영 죽은 채로 남았다. */
  let _done = false;
  const finish = ()=>{ if(_done) return; _done = true; _gachaSetBusy(false); renderGachaDrawBar(); };

  let res = [];
  try{ res = gachaDraw(n) || []; }
  catch(e){ console.warn('[가챠] 뽑기 실패', e); toast('뽑기에 실패했어요 — 잠시 후 다시 시도해 주세요'); finish(); return; }

  /* 📄 방금 뽑은 것 중 마지막 파츠를 기억해 둔다 — [보관함으로] 를 누르면 그 페이지가 열린다.
     [왜] 8칸 페이지로 끊은 뒤로는 새로 뽑은 파츠가 3페이지에 들어앉을 수 있다.
       보관함에 안 보이면 유저는 뽑기가 안 들어온 줄 안다. */
  if(res.length) _gachaLastDrawId = res[res.length - 1].id;

  if(!res.length){
    toast(gachaTicketsLeft() <= 0 ? '남은 뽑기가 없어요' : '이번 시즌에 뽑을 파츠가 없어요');
    renderGachaDraw(null); return;
  }
  const s = _gachaStage(); if(!s){ renderGachaDraw(res); return; }
  const token = ++_gachaAnimToken;
  const alive = () => token === _gachaAnimToken && _gachaDrawOpen();
  _gachaSetBusy(true);
  s.innerHTML = '<div class="gc-cap-wrap rumble">' + _gachaCapsuleSVG(7) + '</div>';
  /* 🛟 안전장치 — 어떤 이유로든 시퀀스가 끝까지 못 가면 1.6초 뒤에 잠금을 푼다.
     연출은 총 880ms 라 정상 흐름에서는 이 타이머가 발동하기 전에 finish 가 끝나 있다. */
  setTimeout(()=>{ if(token === _gachaAnimToken) finish(); }, 1600);

  setTimeout(()=>{
    if(!alive()) { finish(); return; }
    const wrap = s.querySelector('.gc-cap-wrap'); if(!wrap) { finish(); return; }
    wrap.classList.remove('rumble');
    /* ⚠️ classList.add 는 **토큰 하나씩** 넘겨야 한다. 공백이 든 문자열을 주면 그 자리에서
       InvalidCharacterError 를 던진다(DOMTokenList 규격).
       [경위] 예전엔 add('crack' + (res.length > 1 ? ' wide' : '')) 였다. 1회 뽑기는 'crack' 이라
         멀쩡했지만, 2회 이상이면 'crack wide' 라 여기서 예외가 났다. 예외가 나면 아래 파티클·
         결과 팝인·finish 가 통째로 안 돌아서, 껍질이 갈라지지도 결과가 뜨지도 않는다 —
         화면에서는 "5연속만 캡슐이 떨다가 멈추고 아무것도 안 열린다"로 보인다(제보 그대로).
         1.6초 뒤 안전장치가 잠금만 풀어주므로 버튼은 살아나고, 그래서 더 원인을 찾기 어려웠다.
       ★ 인자를 둘로 나누면 add('crack','wide') 가 되어 규격에 맞는다. */
    wrap.classList.add('crack');
    if(res.length > 1) wrap.classList.add('wide');
    // 픽셀 파티클 — 사각형만 쓴다. 방향은 인라인 변수로 주고 움직임은 CSS가 steps()로 끊어 그린다.
    const burst = document.createElement('div'); burst.className = 'gc-burst';
    for(let i = 0; i < 14; i++){
      const p = document.createElement('i');
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const d = 30 + Math.random() * 26;
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      p.style.animationDelay = (Math.random() * 90 | 0) + 'ms';
      burst.appendChild(p);
    }
    wrap.appendChild(burst);

    setTimeout(()=>{
      if(!alive()) { finish(); return; }
      /* ★ 껍질은 남긴다. 위/아래 가장자리로 밀려난 껍질 사이에 결과가 서는 게 이 연출의 모양이다. */
      const reveal = document.createElement('div'); reveal.className = 'gc-reveal';
      res.forEach((r, i) => {
        const box = document.createElement('div'); box.className = 'gc-res';
        box.style.animationDelay = (i * 110) + 'ms';   // 왼쪽부터 순차 팝인
        const th = _gachaThumb(r.rec);
        if(th){ const img = document.createElement('img'); img.src = th; img.alt = ''; box.appendChild(img); }
        else { const ph = document.createElement('div'); ph.className = 'gc-ph'; ph.textContent = r.rec.icon || '🎁'; box.appendChild(ph); }
        const nm = document.createElement('div'); nm.className = 'gc-rn'; nm.textContent = r.rec.name || '파츠';
        box.appendChild(nm);
        const st = document.createElement('div');
        st.className = 'gc-rs' + (r.isNew || r.unlockedColor ? ' new' : '');
        st.textContent = r.unlockedColor ? '🎨 색상 해금!' : (r.isNew ? 'NEW!' : _gachaPips(r.count, gachaDupesFor(r.rec)));
        box.appendChild(st);
        reveal.appendChild(box);
      });
      wrap.appendChild(reveal);
      finish();
      // 요청한 만큼 못 뽑았으면 이유를 말해준다 — 조용히 적게 나오면 "버그"로 읽힌다.
      if(res.length < Math.max(1, n | 0)) toast(res.length + '회만 뽑았어요 — 남은 뽑기가 거기까지였어요');
      const un = res.filter(r => r.unlockedColor);
      if(un.length) toast('🎨 「' + un[0].rec.name + '」 색상 변경이 열렸어요!');
    }, 460);
  }, 420);
}

// 정보줄과 버튼만 다시 그린다 — 무대는 안 건드린다(연출 중에 결과가 지워지면 안 된다).
function renderGachaDrawBar(){
  const bar = document.getElementById('gachaDrawBar');
  const b1 = document.getElementById('gachaDraw1'), b5 = document.getElementById('gachaDraw5');
  if(!bar) return;
  const left = gachaTicketsLeft(), pool = gachaPool();
  bar.innerHTML = '남은 뽑기 <b>' + left + '회</b> · 이번 시즌 <b>'
    + (GACHA_SEASON_LABEL[gachaSeasonNow()] || '') + '</b> 가챠 <b>' + pool.length + '종</b>';
  if(b1) b1.disabled = (left <= 0 || !pool.length);
  if(b5){
    /* ★ 티켓이 5장 미만이면 숫자만 줄인다. **disabled 로 죽이지 않는다.**
       [경위] 예전엔 n<2 일 때 `b5.disabled = true` 였는데 라벨은 "5연속 뽑기" 그대로였다.
         티켓이 1장 남은 사람에게는 멀쩡해 보이는 버튼이 눌러도 아무 반응이 없는 것으로 보였다
         (1회 뽑기는 되는데 5연속만 먹통 — 제보 그대로다).
       ⚠️ 호출부도 함께 봐야 한다. _gachaRunDraw(5) 로 '요청 횟수'를 그대로 넘기고,
         실제로 몇 번 뽑히는지는 gachaDraw 가 티켓을 보고 정한다. 여기서 미리 깎지 않는다. */
    const n = Math.min(5, left);
    b5.textContent = (n >= 2 ? n : 5) + '연속 뽑기';
    b5.disabled = (left <= 0 || !pool.length);
    b5.title = (n >= 2) ? '' : '남은 뽑기가 ' + left + '회라 그만큼만 뽑혀요';
  }
}

function renderGachaDraw(results){
  renderGachaDrawBar();
  const stage = _gachaStage(); if(!stage) return;
  _gachaAnimToken++;                       // 이전 시퀀스의 늦은 타이머를 무효화
  const left = gachaTicketsLeft(), pool = gachaPool();
  if(!pool.length){
    _gachaMsg(gachaSeasonParts().length
      ? '이번 시즌 컴플리트 — 티켓은 그대로 보관돼요.\n다음 시즌에 쓸 수 있어요.'
      : '아직 이 시즌에 가챠로 나오는 파츠가 없어요.');
    return;
  }
  if(!results || !results.length){
    if(left > 0) _gachaStageIdle();
    else _gachaMsg('남은 뽑기가 없어요.\n집중해서 레벨을 올리면 다시 채워져요.');
    return;
  }
  // 연출 없이 결과만 다시 그릴 때(복원용)
  stage.innerHTML = '';
  const reveal = document.createElement('div'); reveal.className = 'gc-reveal shown';
  results.forEach(r => {
    const box = document.createElement('div'); box.className = 'gc-res';
    const th = _gachaThumb(r.rec);
    if(th){ const img = document.createElement('img'); img.src = th; img.alt = ''; box.appendChild(img); }
    else { const ph = document.createElement('div'); ph.className = 'gc-ph'; ph.textContent = r.rec.icon || '🎁'; box.appendChild(ph); }
    const nm = document.createElement('div'); nm.className = 'gc-rn'; nm.textContent = r.rec.name || '파츠';
    box.appendChild(nm);
    const st = document.createElement('div');
    st.className = 'gc-rs' + (r.isNew || r.unlockedColor ? ' new' : '');
    st.textContent = r.unlockedColor ? '🎨 색상 해금!' : (r.isNew ? 'NEW!' : _gachaPips(r.count, gachaDupesFor(r.rec)));
    box.appendChild(st);
    reveal.appendChild(box);
  });
  stage.appendChild(reveal);
}

function openGachaInv(){
  const ov = document.getElementById('gachaInvOverlay'); if(!ov) return;
  const dv = document.getElementById('gachaDrawOverlay'); if(dv) dv.style.display='none';
  /* 🎰 열자마자 서버와 한 번 맞춘다 — 뽑기 창은 이 창을 거쳐야만 들어갈 수 있으므로(#gachaGoDraw),
     여기가 '뽑기 직전'을 잡을 수 있는 유일한 관문이다. 낡은 목록으로 뽑으면 그 뽑기가 서버를
     통째로 덮어써서 다른 기기의 파츠를 지운다(syncGachaToServer 의 last-write-wins).
     ★ 기다리지 않는다 — 받아오면 _adopt 안에서 renderGachaInv 를 다시 부른다(그쪽 코드 참고). */
  if(typeof syncGachaToServer==='function'){ try{ syncGachaToServer('inv-open'); }catch(_){} }
  /* 📄 열 때는 지금 보고 있는 파츠(_gachaSelId)가 있는 페이지에서 시작한다.
     [왜] 미리보기 아래 색상 영역이 _gachaSelId 를 따라간다. 그 칸이 3페이지에 있는데 1페이지가
       열리면 "색상은 모자 것인데 화면 어디에도 모자가 없다"가 된다. */
  _gachaJumpId = _gachaSelId;
  renderGachaInv();
  ov.style.display = 'block';
  if(typeof window._gachaRestorePos === 'function'){
    window._gachaRestorePos('inv', document.getElementById('gachaInvWin'));
  }
  /* 좌측 미리보기는 꾸미기 것을 그대로 재사용한다 — 착용 결과를 캐릭터로 바로 본다.
     ★ z-index 를 .gacha-ov(122) 위로 올린다. 다만 z-index 는 '누가 위냐'만 정할 뿐이라,
       겹치는 한 어느 쪽이 위로 와도 다른 한쪽은 가려진다. 그래서 **자리를 아예 안 겹치게 잡는다.**
       미리보기 기본 자리는 right:352px·width:320px(꾸미기 창 레이아웃 전제)라 왼쪽 끝이
       (창너비-672), 보관함 창은 정중앙 360px 라 오른쪽 끝이 (창너비/2+180) —
       즉 창 너비가 1704px 미만이면 반드시 겹친다. 1920 100% 배율은 안 걸려도
       1600/1440/1366 이나 Windows 배율 125%(=1536 CSS px)는 전부 걸린다.
     ⚠️ 유저가 직접 옮겨 둔 자리가 있으면 그건 존중한다 — 화면 안으로 끌어오기만 한다.
     ⚠️ z-index 는 닫을 때 반드시 되돌린다 — 안 그러면 꾸미기(F2) 창에서도 계속 122 위에 남는다. */
  const wp = document.getElementById('wdPreviewPanel');
  if(wp){
    if(typeof syncWdPreviewOwner==='function') syncWdPreviewOwner();   // .on + z-index(123) 부여
    if(!wdPreviewSavedPos()){
      const gw = document.getElementById('gachaInvWin');
      const gr = gw ? gw.getBoundingClientRect() : null;
      const pr = wp.getBoundingClientRect();
      const pwid = pr.width || 320, phgt = pr.height || 420;
      if(gr && gr.width){
        // 보관함 왼쪽에 붙인다. 왼쪽이 좁으면 오른쪽으로 넘긴다(placeWdPreview 가 화면 안으로 clamp).
        let x = gr.left - pwid - 12;
        if(x < 8) x = gr.right + 12;
        placeWdPreview(x, (innerHeight - phgt) / 2);
      }
    }
    clampWdPreviewIntoView();
  }
  if(typeof refreshWdPreviewChar==='function') refreshWdPreviewChar();
  // 색상 영역이 꾸미기 탭이 아니라 보관함 선택을 따라가게 한 번 다시 그린다.
  if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
}
function closeGachaInv(){
  const ov = document.getElementById('gachaInvOverlay'); if(ov) ov.style.display='none';
  const dv = document.getElementById('gachaDrawOverlay'); if(dv) dv.style.display='none';
  // ⚠️ 무대를 비운다 — 안 비우면 캡슐 떨림 애니메이션이 run 모드 내내 계속 돈다.
  if(typeof _gachaStopAnim==='function') _gachaStopAnim();
  if(typeof _gachaSetBusy==='function') _gachaSetBusy(false);
  // ★ 꾸미기와 같은 관례 — 닫을 때 저장한다. 저장 버튼이 따로 없으므로 여기서 안 하면 착용이 날아간다.
  if(typeof commitWdDraft==='function') commitWdDraft();
  // ★ openGachaInv 에서 올려둔 z-index 를 되돌린다(꾸미기 창의 기본값 54로 복귀).
  //   ⚠️ 꾸미기 창이 아직 열려 있으면 미리보기 자체는 남겨야 한다 — 판정은 syncWdPreviewOwner 한 곳에서만.
  if(typeof syncWdPreviewOwner==='function') syncWdPreviewOwner();
  /* ★ 상세조정 선택도 같이 푼다. 안 풀면 activeWdAdj 가 가챠 파츠를 가리킨 채 남아, 다음에 꾸미기
     창을 열었을 때 기즈모 바만 떠 있고 정작 그 파츠는 목록에 없는(가챠는 걸러진다) 상태가 된다. */
  _setActiveWdAdj(null);
  if(typeof _clearMultiPanelRef==='function') _clearMultiPanelRef();
  if(typeof detachWdGizmo==='function') detachWdGizmo();
  // ★ 색상 영역은 보관함이 열린 동안 가챠 선택을 따라간다 — 닫을 때 꾸미기 기준으로 되돌린다.
  if(typeof refreshWdPreviewColorSection==='function') refreshWdPreviewColorSection();
}
function _gachaInvOpen(){ const ov=document.getElementById('gachaInvOverlay'); return !!(ov && ov.style.display!=='none'); }
function _gachaDrawOpen(){ const ov=document.getElementById('gachaDrawOverlay'); return !!(ov && ov.style.display!=='none'); }
/* 🎰 보관함·가챠는 **라이선스 없이도** 쓸 수 있다(요청사항).
   [왜 안전한가] 가챠 파츠는 renderWardrobe 의 !isGachaPart 필터에 걸려 꾸미기(F2) 창에 한 칸도
     안 뜬다. 그래서 보관함만 열어줘도 라이선스 전용인 '일반 꾸미기 파츠'와는 섞이지 않는다.
     착용 배관(toggleEquip / commitWdDraft / #wdPreviewPanel)에는 원래 라이선스 검사가 없었다.
   ⚠️ 게이트를 되살릴 일이 생기면 여기 한 곳만 되돌리면 된다 — 뽑기 창은 보관함 안의
     #gachaGoDraw 로만 들어오므로 진입점이 여기 하나다. */
function toggleGachaInv(){
  if(_gachaInvOpen() || _gachaDrawOpen()) closeGachaInv(); else openGachaInv();
}

(function bindGachaWindows(){
  const inv=document.getElementById('gachaInvOverlay'), dw=document.getElementById('gachaDrawOverlay');
  if(!inv || !dw) return;
  const q=id=>document.getElementById(id);
  /* 🖱️ 타이틀바 드래그 — idesk 인벤토리와 같은 방식(transform 중앙정렬 → left/top 절대좌표 전환).
     ★ 두 창은 자리를 **따로** 기억한다. 보관함과 뽑기 창은 크기가 달라서, 하나로 묶으면
       한쪽을 옮긴 뒤 다른 쪽을 열었을 때 화면 밖으로 삐져나갈 수 있다. */
  const GACHA_POS_KEY = 'tw.gachaWinPos';
  let _gachaPos = {};
  try{ _gachaPos = JSON.parse(localStorage.getItem(GACHA_POS_KEY) || '{}') || {}; }catch(_){ _gachaPos = {}; }
  function _gachaSavePos(key, win){
    try{ _gachaPos[key] = { left:win.style.left, top:win.style.top };
      localStorage.setItem(GACHA_POS_KEY, JSON.stringify(_gachaPos)); }catch(_){}
  }
  /* 저장된 자리로 되돌린다. 그 사이 모니터가 바뀌거나 해상도가 줄어 화면 밖이면 가운데로 되돌린다 —
     안 그러면 창이 열려 있는데 안 보이고, 유저에게는 "T를 눌러도 아무 일이 없다"로 보인다. */
  function _gachaRestorePos(key, win){
    const p = _gachaPos[key];
    if(!p || !p.left || !p.top) return;
    win.style.transform='none'; win.style.left=p.left; win.style.top=p.top;
    const r = win.getBoundingClientRect();
    if(r.right < 40 || r.bottom < 40 || r.left > innerWidth - 40 || r.top > innerHeight - 40){
      win.style.left=''; win.style.top=''; win.style.transform='translate(-50%,-50%)';
    }
  }
  function _gachaBindDrag(key, win, head, closeSel){
    if(!win || !head) return;
    let dragging=false, offX=0, offY=0;
    head.addEventListener('pointerdown', e=>{
      if(e.target.closest && e.target.closest(closeSel)) return;   // ✕ 버튼은 드래그가 아니다
      dragging=true;
      const r=win.getBoundingClientRect();
      offX=e.clientX-r.left; offY=e.clientY-r.top;
      win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px';
      try{ head.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    });
    head.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const w=win.offsetWidth, h=win.offsetHeight;
      win.style.left = Math.max(0, Math.min(innerWidth-w,  e.clientX-offX)) + 'px';
      win.style.top  = Math.max(0, Math.min(innerHeight-h, e.clientY-offY)) + 'px';
    });
    const end=e=>{ if(!dragging) return; dragging=false;
      try{ head.releasePointerCapture(e.pointerId); }catch(_){}
      _gachaSavePos(key, win); };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    // 타이틀바 더블클릭 = 가운데로 복귀 (플레이리스트 창과 같은 관례)
    head.addEventListener('dblclick', e=>{
      if(e.target.closest && e.target.closest(closeSel)) return;
      win.style.left=''; win.style.top=''; win.style.transform='translate(-50%,-50%)';
      delete _gachaPos[key];
      try{ localStorage.setItem(GACHA_POS_KEY, JSON.stringify(_gachaPos)); }catch(_){}
    });
  }
  /* 🪟 창 위치 초기화 버튼(F1 → 화면 표시)이 부른다 — 저장 키만 지우면 이 메모리 값이 남아
     다음에 열 때 그대로 그 자리로 간다. */
  (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _gachaPos = {}; });
  _gachaBindDrag('inv',  q('gachaInvWin'),  q('gachaInvHead'),  '#gachaInvClose');
  _gachaBindDrag('draw', q('gachaDrawWin'), q('gachaDrawHead'), '#gachaDrawClose');
  window._gachaRestorePos = _gachaRestorePos;
  if(q('gachaInvClose')) q('gachaInvClose').onclick = closeGachaInv;
  if(q('gachaDrawClose')) q('gachaDrawClose').onclick = closeGachaInv;
  if(q('gachaGoDraw')) q('gachaGoDraw').onclick = ()=>{
    inv.style.display='none'; dw.style.display='block';
    _gachaRestorePos('draw', q('gachaDrawWin'));
    renderGachaDraw(null);
  };
  if(q('gachaBackInv')) q('gachaBackInv').onclick = ()=>{
    _gachaStopAnim();
    dw.style.display='none'; inv.style.display='block';
    _gachaRestorePos('inv', q('gachaInvWin'));
    // 📄 방금 뽑은 파츠가 있는 페이지로. 안 뽑고 돌아왔으면 null 이라 아무 일도 안 일어난다.
    _gachaJumpId = _gachaLastDrawId; _gachaLastDrawId = null;
    renderGachaInv();
  };
  if(q('gachaDraw1')) q('gachaDraw1').onclick = ()=>_gachaRunDraw(1);
  /* ★ Math.min(5, gachaTicketsLeft()) 로 미리 깎아 넘기지 않는다 — 티켓이 0이면 n=0 이 넘어가
     Math.max(1,0)=1 로 되살아나는 등 경계가 지저분했다. 요청 횟수를 그대로 주고 gachaDraw 가 정한다. */
  if(q('gachaDraw5')) q('gachaDraw5').onclick = ()=>_gachaRunDraw(5);
  inv.querySelectorAll('.gc-tab').forEach(b=>{
    b.onclick = ()=>{
      _gachaTab = b.dataset.gtab || 'all';
      _gachaPage = 0;   // 📄 탭이 바뀌면 목록 자체가 다른 것이다 — 3페이지에서 시작하면 안 된다
      inv.querySelectorAll('.gc-tab').forEach(x=>x.classList.toggle('on', x===b));
      renderGachaInv();
    };
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && (_gachaInvOpen() || _gachaDrawOpen())) closeGachaInv();
  });
  /* 🖱️ 바깥을 누르면 저장하고 닫는다(요청사항). closeGachaInv가 commitWdDraft를 부르므로
     "닫으면 저장"은 ✕·ESC와 완전히 같은 경로다 — 여기서 따로 저장하지 않는다.
     ⚠️ .gacha-ov 는 pointer-events:none 이라 오버레이에 핸들러를 걸면 클릭이 아예 안 온다.
       그래서 document 캡처 단계에서 받고, "닫으면 안 되는 곳"만 제외한다.
     ★ 미리보기 패널은 반드시 제외 — 기즈모를 끌거나 캐릭터를 돌리는 것도 '바깥 클릭'이 되어
       조정하려는 순간 창이 닫혀버린다. 관리자 등록 모달·색상 팝업도 같은 이유. */
  const _GACHA_KEEP = '#gachaInvWin, #gachaDrawWin, #wdPreviewPanel, #wardrobePanel,'
    + ' #partRegOverlay, #assetImpOverlay, #categoryManageOverlay, #programSettingsOverlay,'
    + ' .wd-color-palette, .mh-color-pop, .toast';
  document.addEventListener('mousedown', e=>{
    if(!(_gachaInvOpen() || _gachaDrawOpen())) return;
    const t=e.target;
    if(t && t.closest && t.closest(_GACHA_KEEP)) return;
    closeGachaInv();
  }, true);
  /* ★ .gacha-ov 는 pointer-events:none — "진짜 바깥"(투명 오버레이 영역) 클릭은 mousedown 이
     아예 안 온다(Electron 클릭통과). 꾸미기 창과 같은 보완: 창이 포커스를 잃는 시점도 닫힘으로 처리.
     ⚠️ 파일 선택 다이얼로그(파츠 등록 GLB 선택 등)로 포커스가 잠깐 빠질 때 닫히면 등록 창까지
       같이 사라진다 — 꾸미기가 쓰는 modalOpen 가드를 그대로 가져온다. */
  window.addEventListener('blur', ()=>{
    if(!(_gachaInvOpen() || _gachaDrawOpen())) return;
    const modalOpen = document.querySelector('#partRegOverlay.on, #deskRegOverlay.on, #assetImpOverlay.on, #assetGenOverlay.on, #glbEncOverlay.on, #glbLoadOverlay.on, #exportOverlay.on, #adminPassOverlay.on, #licenseGenOverlay.on, #announceOverlay.on, #adBannerOverlay.on, #commGenOverlay.on, #inviteOverlay.on, #raceOverlay.on, #creatorOverlay.on, #programSettingsOverlay.on, #myHomeOverlay.on, #categoryManageOverlay.on, #pkOverlay.on');
    if(modalOpen) return;
    closeGachaInv();
  });
  window.openGachaInv = openGachaInv;
  window.closeGachaInv = closeGachaInv;
})();

return {
  /* 밖에서 부르는 이름 — app.js 는 gachaMod.이름 */
  isGachaPart,                          // 꾸미기 창 · 카탈로그 · 라이선스 접기가 가챠 파츠를 거른다
  isGachaColorUnlocked,                 // 꾸미기 미리보기 색상 영역 — 🔒 게이트
  gachaCount,
  sceneHasColorGroup,                   // 관리자 파츠 등록 — 색 없는 파츠(rec.noColor) 판정
  DUPES_FOR_COLOR: GACHA_DUPES_FOR_COLOR,
  syncGachaToServer,                    // 런처 복귀('launcher') · 로그아웃 직전('logout') · 계정 연동('transfer','pull')
  pruneUnownedGachaParts,               // 꾸미기 커밋 · 카탈로그 도착
  renderGachaInv,                       // 파츠 등록 · 썸네일 재생성 · 계정 연동 · 👑 달성표 보상
  toggleGachaInv,                       // T 키
  isInvOpen: _gachaInvOpen,
  isDrawOpen: _gachaDrawOpen,
  selId: ()=>_gachaSelId,               // 보관함에서 지금 보고 있는 파츠 — 꾸미기 미리보기 색상 영역이 따라간다
  owned: ()=>gachaOwned,                // 계정 전환 검문 — «뽑은 파츠 N개»
  bonus: ()=>_gachaBonus,               // 👑 달성표 — 보너스 뽑기 수
  setBonusLocal: _setGachaBonusLocal,
  resetMemory(){ gachaOwned = {}; _gachaTs = 0; _gachaBonus = 0; },   // 로그아웃 지우기 — 메모리도 빈 기기 값으로
  /* 화면 없이 검사하는 셈 · 상태 — sim-gacha.js · sim-gacha-prune.js · sim-part-color-entry.js */
  draw: gachaDraw, pool: gachaPool, seasonNow: gachaSeasonNow, ticketsLeft: gachaTicketsLeft, ticketsEarned: gachaTicketsEarned,
  openGachaInv, closeGachaInv, runDraw: _gachaRunDraw, renderGachaDraw,
  state: {
    ts: ()=>_gachaTs, srvSeen: ()=>_gachaSrvSeen, page: ()=>_gachaPage, tab: ()=>_gachaTab, cat: ()=>_gachaCat, season: ()=>_gachaSeason,
    setOwned(v){ gachaOwned = v; }, setSelId(v){ _gachaSelId = v; },
  },
};
}

const api = { createGacha };
if(typeof window !== 'undefined') window.TwGacha = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
