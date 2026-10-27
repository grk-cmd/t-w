/* gacha.js — 🎰 파츠 가챠 — 코어(보유분 · 확률 · 뽑기 · 서버 동기화 · 미보유 파츠 회수) + 도감(꾸미기 창 «도감» 탭) · 뽑기 창(캡슐 연출)
   app.js 의 두 구역(«🎰 파츠 가챠 — 코어» · «🎰 파츠 보관함 · 가챠 뽑기 창»)을 옮긴 모듈이다(앱 FSD 8번 — docs/APP_FSD_MAP.md).
   ★ 한 파일이다(👑 달성표 weekly-challenge.js 와 같은 방식 — entities 규칙 + widgets 화면). 도감 · 뽑기 창이 코어의 이름
     스무 개 가까이(보유 수 · 풀 · 시즌 · 남은 뽑기 · 보너스 · 동기화 …)를 그대로 쓰고, 코어의 동기화도 도감을 다시 그린다.
   ★ 도감은 따로 뜨는 창이 아니다 — 꾸미기 창(wardrobe.js)이 «도감» 탭을 그릴 때 #gachaInvHost 를 만들고 renderGachaInv 를 부른다.
     T 키 · [도감으로] 는 꾸미기 창을 «도감» 탭으로 연다(wardrobe-panel.js). 도감 줄 · 쪽 규칙은 gacha-album.js(순수).
   ★ app.js 의 let 은 읽는 함수로 받는다 — isAdmin() · savedParts() · PART_CATS() · wdDraftDef() · activeWdAdj()(쓰기는 _setActiveWdAdj).
     GACHA_OWNED_KEY · GACHA_TS_KEY · GACHA_BONUS_KEY 는 deps 값 — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)이 같은 이름을 쓰므로 정의는 app.js.
   ★ 🔑 «서버가 조용히 거부하는 기기» 안내(_warnServerWriteDenied)는 app.js — 🧍 캐릭터 슬롯 동기화도 부른다. 여기서는 deps 로 받는다.
   ★ 밖으로 내놓는 이름은 반환값이다 — app.js 에서 gachaMod.이름 으로 부른다(만드는 줄보다 늦게 돈다).
     window 고리는 _gachaRestorePos 하나(뽑기 창 자리).
   ★ createGacha 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(localStorage 읽기 · 시각 부트스트랩 · 부팅 동기화 4.2초 타이머 ·
     10분 tick · 뽑기 창 버튼 · 끌기 · ESC · 바깥 클릭 · blur 연결 bindGachaWindows)이 같은 순서로 돈다.
   ⚠️ firebaseAPI · localStorage · document · window · confirm 은 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwGacha — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-gacha.js — 만들 때 · 보유 · 색상 해금 · 풀 · 남은 뽑기(보너스) · 뽑기 · 서버 동기화(최신 승 · pull · 미래 ts ·
         실패) · 도감(목록 · 칸 · 쪽 · [도감으로]) · 뽑기 창(연출 · 오류) · app.js 배선 · html 순서. */
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
const notifyError = deps.notifyError;                          // ⚠️ 에러코드 알림 — TwErrorCodes.notify
const isGachaPart = deps.isGachaPart;                          // 가챠 파츠인가(rec.gacha) — 카탈로그(premium-assets.js)가 정의한다
const gachaSource = deps.gachaSource;                          // 🎚️ 받는 곳 — 'server' | 'firebase'(source-switch.js · 원격 설정 sources.gacha)
const gachaServer = deps.gachaServer;                          // 🎰 서버 길 — gacha-server.js(서버가 뽑고 저장)
/* 🛠 관리자 파츠 등록 · 삭제 — app.js 가 setPartEditor 로 건다(가챠는 관리자 모듈을 부르지 않는다) */
let openPartRegister = null, syncPartRegGachaLock = null, deletePart = null;
function setPartEditor(a){ openPartRegister = a.openPartRegister; syncPartRegGachaLock = a.syncPartRegGachaLock; deletePart = a.deletePart; }
const toggleEquip = deps.toggleEquip;                          // 👕 착용 배관 — 꾸미기(F2)와 같은 것
const createWardrobeAdjPanel = deps.createWardrobeAdjPanel;
const _clearMultiPanelRef = deps.clearMultiPanelRef;
const refreshWdPreviewColorSection = deps.refreshWdPreviewColorSection;
const updateWdGizmoForActivePanel = deps.updateWdGizmoForActivePanel;
const twNav = deps.twNav;                                      // 🧭 창 열기 통로(nav.js) — [도감으로] 가 꾸미기 창 «도감» 탭을 부탁한다(가챠는 꾸미기 창을 모른다)
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
   화면(도감 · 뽑기 연출)은 이 파일 아래쪽에 있다 — 여기 있는 것은 상태 · 계산 · 뽑기까지다.

   저장은 이 한 노드가 전부다:
     users/{uid}/gacha/owned/{partId} = 4      // 뽑은 횟수(누적). 4 이상 = 색상 변경 해금
     users/{uid}/gacha/ts             = 172…   // 마지막으로 바꾼 시각(ms). 어느 기기가 최신인지 가른다
   꽝이 없으므로 '총 뽑기 횟수 = 소유 개수의 합'이 항상 성립한다 → used를 따로 안 저장한다.
     남은 뽑기 = floor(레벨/5) − Σowned

   ★ 서버가 원본이다 — 뽑기는 서버 트랜잭션이 저장해야 끝나고(gachaDraw), 기기끼리는 파츠마다 큰 쪽으로 합친다
     (syncGachaToServer). ts 는 옛 판(0.11 이하)이 «최신 기기» 판정에 쓰는 값이라, 이 판은 쓸 때 지금으로 찍기만 한다.
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
const GACHA_OWNED_MAX = 9999;         // 파츠 하나 보유 상한 — 규칙 users/$userId/gacha/owned/$partId 와 같은 값
let gachaOwned = {};                  // {partId: 뽑은 횟수}
let _gachaTs = 0;                     // 서버 ts 사본 — 이 판은 판정에 안 쓴다(옛 판 호환으로 저장만)
let _gachaSyncing = false;
/* 진행 중이라 삼켜진 동기화 요청 — 끝난 뒤 한 번 다시 돈다.
   [왜] 예전엔 `if(_gachaSyncing) return;` 이 끝이었다. 부팅 동기화가 느린 회선에서 몇 초씩
     걸리는 동안 도감을 열면(onAlbumShow 의 'inv-open') 그 호출이 통째로 사라져, 화면을
     맞출 기회가 10분 뒤 tick 까지 없었다. */
let _gachaSyncPending = null;
/* 이 세션에서 서버 보유분을 **실제로 한 번이라도 읽었는가**.
   미보유 파츠 회수(pruneUnownedGachaParts)의 유일한 전제다 — 이 값이 서지 않았는데 회수하면
   '보유분을 모르는 채로' 벗기는 것이 되어, 오프라인 부팅에서 멀쩡한 파츠가 사라진다. */
let _gachaSrvSeen = false;
/* 👑 달성표 보상분(추가 뽑기 횟수). 서버에서는 **users/{uid}/chalBonus** 에 따로 산다 —
   gacha 노드 안에 두면 옛 판(0.11 이하)의 통째 set 이 지운다.
   여기 값은 서버 합계를 받아 적는 사본이다.
   ⚠️ 서버를 못 읽었을 때는 절대 손대지 않는다(로컬 값 유지) — 0 으로 내려가면 이미 준 보상이
     사라진 것처럼 보인다. 그래서 loadChalBonus 는 실패를 null 로 돌려주고 0 과 구분한다. */
let _gachaBonus = 0;
try{ _gachaBonus = Math.max(0, parseInt(localStorage.getItem(GACHA_BONUS_KEY) || '0', 10) || 0); }catch(_){}
/* 서버 길(sources.gacha = 'server')에서 서버가 알려 준 { earned, left, season } — 남은 뽑기 · 시즌을 서버 값으로 그린다.
   옛 길이거나 아직 못 받았으면 null(이 PC 의 레벨 · 시계로 센다). */
let _srvState = null;
/* 서버 길 뽑기가 성공할 때마다 올린다 — 그 전에 나간 상태 받기(GET)가 늦게 와 방금 뽑은 것을 덮지 않게(갈아 끼우기라 옛 길의 합치기처럼 안전하지 않다). */
let _srvDrawGen = 0;
const _serverMode = () => gachaSource() === 'server';
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
try{
  const _t = parseInt(localStorage.getItem(GACHA_TS_KEY) || '0', 10);
  if(_t > 0) _gachaTs = _t;
}catch(_){}

/* 지금 가챠 중인 시즌. 클라이언트 시계 기준이라 조작하면 다른 시즌을 뽑을 수 있지만,
   §5와 같은 결로 감수한다 — 조작해도 남에게 피해가 가지 않는다. */
const GACHA_SEASON_KEYS = Object.freeze({ spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' });
function gachaSeasonNow(){
  if(_serverMode() && _srvState && GACHA_SEASON_KEYS[_srvState.season]) return GACHA_SEASON_KEYS[_srvState.season];   // 서버 길 — 서버 시계(서울)의 시즌(아는 이름만)
  const m = new Date().getMonth() + 1;
  if(m === 12 || m <= 2) return 'winter';
  if(m <= 5) return 'spring';
  if(m <= 8) return 'summer';
  return 'autumn';
}
const GACHA_SEASON_LABEL = { '':'상시', spring:'🌸 봄', summer:'🌊 여름', autumn:'🍂 가을', winter:'❄ 겨울' };

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
  if(isAdmin()) return true;
  const rec = savedParts() ? savedParts().find(p=>p.id===partId) : null;
  return gachaCount(partId) >= gachaDupesFor(rec);
}

/* 이번 시즌 가챠 풀. 4개를 다 모은 파츠는 빠진다 — 그래서 중복 낭비가 0이고 모든 뽑기가 진척이 된다. */
function _poolFor(owned){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p)
    && (!p.season || p.season === season)
    && (owned[p.id] | 0) < gachaDupesFor(p));   // 색 없는 파츠는 1개만 모으면 빠진다
}
function gachaPool(){ return _poolFor(gachaOwned); }
// 이번 시즌에 뽑힐 수 있는 전체(다 모은 것 포함) — 뽑기 창의 "이번 시즌 컴플리트" 판정용
function gachaSeasonParts(){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p) && (!p.season || p.season === season));
}
function _usedIn(owned){ let n = 0; for(const k in owned) n += owned[k] | 0; return n; }
function gachaUsedTotal(){ return _usedIn(gachaOwned); }
/* ⚠️ 예전 불변식은 "총 뽑기 = 레벨/5" 하나였다. 👑달성표 주간 보상(_gachaBonus)이 붙으면서
     항이 하나 늘었다 — 화면에 "5레벨당 1회"만 적으면 거짓말이 되므로 renderGachaInv 표기도 같이 고쳤다. */
function gachaTicketsEarned(){
  if(_serverMode() && _srvState) return _srvState.earned;   // 서버 길 — 서버가 센 값(레벨 · 달성표 보상)
  return Math.floor(getFocusLevel() / GACHA_LEVELS_PER_TICKET) + (_gachaBonus | 0);
}
function gachaTicketsLeft(){
  if(_serverMode() && _srvState) return Math.max(0, Math.floor(Number(_srvState.left)) || 0);   // 서버 길 — 남은 횟수도 서버가 센 값
  return Math.max(0, gachaTicketsEarned() - gachaUsedTotal());
}

/* 보유분 씻기 — 0 이하 · 숫자 아님 · 규칙이 거부하는 키는 빼고 상한에서 자른다(규칙 owned/$partId 와 같은 모양).
   ⚠️ 규칙에 안 맞는 옛 키를 하나라도 다시 쓰면 트랜잭션 전체가 거부된다. */
const GACHA_BAD_KEY_RE = /^(null|undefined|NaN)$|^ | $/;
function _cleanOwned(o){
  const out = {};
  for(const k in (o || {})){
    if(GACHA_BAD_KEY_RE.test(k)) continue;
    const n = Math.max(0, Math.min(GACHA_OWNED_MAX, Math.floor(Number(o[k]) || 0)));
    if(n > 0) out[k] = n;
  }
  return out;
}
/* 두 벌을 파츠마다 큰 쪽으로 합친다. 보유 수는 늘기만 한다(줄이는 길이 없다) — 그래서 합쳐도 잃는 것이 없고,
   서버에 못 올라간 이 PC 의 뽑기(옛 판 · 로그인이 풀린 채 뽑은 것)가 살아남는다. */
function _mergeOwned(a, b){
  const out = _cleanOwned(a), add = _cleanOwned(b);
  for(const k in add) if(add[k] > (out[k] | 0)) out[k] = add[k];
  return out;
}
function _sameOwned(a, b){
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
}
/* 서버에 없는 이 PC 의 뽑기 수 — 로그아웃 전 검문이 «지워질 뽑기» 를 센다. */
function gachaUnsynced(srvOwned){
  const srv = _cleanOwned(srvOwned), mine = _cleanOwned(gachaOwned);
  let n = 0;
  for(const k in mine) n += Math.max(0, mine[k] - (srv[k] | 0));
  return n;
}
/* 서버 값을 이 PC 사본으로 받는다 — 이 PC 에만 있는 뽑기는 지우지 않는다(합치기). */
function _adoptServer(v){
  if(!v) return;
  gachaOwned = _mergeOwned(v.owned, gachaOwned);
  _saveGachaLocal(Number(v.ts) || 0);
  _gachaSrvSeen = true;
  if(_gachaInvOpen()) renderGachaInv();
}

/* 서버 길 — 서버 상태를 이 PC 사본으로 **갈아 끼운다**(합치지 않는다 — 서버 값만 원본 · 이 PC 에만 있는 뽑기는 올리지 않는다). */
function _adoptServerState(st){
  gachaOwned = st.owned;
  _saveGachaLocal(st.ts || _gachaNow());
  _srvState = st;
  _gachaSrvSeen = true;
  if(_gachaInvOpen()) renderGachaInv();
}
/* 서버 결과 줄에 카탈로그 항목을 붙인다 — 연출 · 이름 · 그림이 rec 를 읽는다. 카탈로그에 없으면 이름 없는 칸으로. */
function _withRec(out){
  const list = savedParts() || [];
  return out.map(r => Object.assign({ rec: list.find(p => p.id === r.id) || { id: r.id, name: '파츠' } }, r));
}

/* 뽑기 계산 — owned 에서 n회를 굴려 { owned: 새 보유분, out } 을 돌려준다(받은 owned 는 안 바꾼다).
   티켓이 모자라거나 풀이 비면 그 자리에서 멈춘다(요청한 n보다 적게 나올 수 있다). */
function _planDraw(owned, n){
  const next = Object.assign({}, owned), out = [];
  const earned = gachaTicketsEarned();
  for(let i = 0; i < Math.max(1, n | 0); i++){
    if(earned - _usedIn(next) <= 0) break;
    const pool = _poolFor(next);
    if(!pool.length) break;
    const rec = pool[Math.floor(Math.random() * pool.length)];
    const after = (next[rec.id] | 0) + 1;
    next[rec.id] = after;
    out.push({
      id: rec.id, rec, count: after,
      isNew: after === 1,
      // ★ 색이 없는 파츠는 열릴 색 자체가 없으므로 이 표식이 서면 안 된다("색상 변경이 열렸어요"가 거짓말이 된다)
      unlockedColor: !rec.noColor && after === GACHA_DUPES_FOR_COLOR   // 이 뽑기로 막 열린 경우만 true
    });
  }
  return { owned: next, out };
}

/* 뽑기 — 서버가 원본이다. 남은 횟수 확인 · 굴리기 · 저장을 서버 트랜잭션 하나에서 하고, 저장이 끝나야 결과를 돌려준다.
   ★ 횟수와 풀은 트랜잭션 안에서 **서버 보유분**으로 센다 — 다른 PC 가 동시에 뽑으면 트랜잭션이 새 값으로 다시 돌아,
     남은 횟수를 넘겨 뽑지 못한다.
   ★ 실패하면 이 PC 는 아무것도 바꾸지 않는다(횟수 그대로). ⚠️ 이 PC 에 먼저 적지 말 것 — 로그인이 풀린 PC 에서 뽑은 것이 그 PC 에만 남는다.
   ★ 늦게 붙은 저장(시간 초과 뒤 서버에 들어감)은 onLate 로 사본에 합친다 — 뽑기가 사라지지 않는다.
   @return { ok:true, out } | { ok:false, reason:'busy'|'nouser'|'offline'|'timeout'|'denied'|'error' } */
let _gachaDrawing = false;
async function gachaDraw(n){
  if(_gachaDrawing) return { ok:false, reason:'busy' };
  const uid = getMyUserId();
  if(!uid) return { ok:false, reason:'nouser' };
  _gachaDrawing = true;
  if(_serverMode()){
    try{
      const r = await gachaServer.draw(n);
      if(!r.ok){
        try{ syncGachaToServer('draw-fail'); }catch(_){}   // 시간 초과 뒤 서버엔 들어갔을 수 있다 — 서버 값을 다시 받는다
        return { ok:false, reason: r.reason };
      }
      _srvDrawGen++;
      _adoptServerState(r.state);
      return { ok:true, out: _withRec(r.out) };
    }finally{ _gachaDrawing = false; }
  }
  try{
    const mine = _cleanOwned(gachaOwned);   // 이 PC 에만 있는 뽑기도 같이 올린다 — syncGachaToServer 와 같은 합치기
    let out = [];
    const r = await firebaseAPI.updateGacha(uid, cur => {
      const plan = _planDraw(_mergeOwned(cur && cur.owned, mine), n);
      out = plan.out;
      return plan.out.length ? { owned: plan.owned, ts: _gachaNow() } : null;   // null = 뽑을 것 없음(쓰지 않음)
    }, { onLate: _adoptServer });
    if(!r.ok) return { ok:false, reason: r.reason };
    _adoptServer(r.value);
    return { ok:true, out: r.committed ? out : [] };
  }finally{ _gachaDrawing = false; }
}

/* 서버와 맞추기 — 부팅 직후 1회 · 10분마다 · 도감을 열 때 · 런처 복귀 · 로그아웃 직전 · 계정 연동 직후.

   ★ 서버가 원본이고 이 PC 는 사본이다. 맞출 때는 **파츠마다 큰 쪽으로 합친다**(_mergeOwned) — 덮어쓰지 않는다.
       · 이 PC 에만 있는 뽑기가 없으면 → 서버 값을 받는다(쓰기 0)
       · 있으면(옛 판 · 로그인이 풀린 채 뽑은 것) → 서버 트랜잭션 안에서 합쳐 올린다
     ⚠️ «ts 가 큰 기기가 통째로 이긴다» 로 되돌리지 말 것 — 진 기기의 뽑기가 지워진다.

   mode='pull' — 계정 연동 전용. 이 PC 사본은 다른 계정 것일 수 있어 합치지 않고 **서버 것을 받는다**.
     서버가 비어 있으면(한 번도 동기화 안 된 계정) 로컬을 지우지 않고 올린다. */
/* 🎰 보유하지 않은 가챠 파츠를 착용 목록에서 걷어낸다 — **보유분이 바뀔 수 있는 자리마다 부른다.**

   [경위] 계정 연동(pull)은 gachaOwned 를 통째로 갈아끼우는데, 착용 정보
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
  if(!savedParts() || !savedParts().length) return 0;
  if(isAdmin()) return 0;
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
  try{ if(wdDraftDef()) n += _pruneDef(wdDraftDef()).length; }catch(_){}
  if(!n) return 0;
  try{ saveSlots(); }catch(_){}
  try{
    const me = findMySeat();
    if(me && typeof Presence !== 'undefined' && Presence.active()) Presence.updateDef(me.charDef);
  }catch(_){}
  /* ★ 조용히 벗기지 않는다 — 아무 말 없이 파츠가 사라지면 그것대로 "파츠가 증발했다" 제보가 된다.
     지금 벌어진 일은 '보유분과 화면을 맞춘 것'이므로 그렇게 적는다. */
  try{ toast('🎰 지금 보유하지 않은 가챠 파츠 ' + n + '개를 벗었어요'); }catch(_){}
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
  if(_serverMode()) return _syncFromServer(reason, mode);
  if(!(window.firebaseAPI && firebaseAPI.loadGachaOwned && firebaseAPI.updateGacha)) return;
  _gachaSyncing = true;
  /* 서버 보유분을 실제로 읽었는가 — 아래 finally 의 착용 정리가 이 값에만 의지한다.
     (읽기 실패와 '읽었는데 비어 있다'는 완전히 다른 상태다) */
  let _srvRead = false;
  try{
    const uid = getMyUserId();
    if(!uid) return;   // 🪪 uid 가 정해지기 전 — _srvRead=false 라 finally 의 착용 정리도 안 돈다
    const srv = await firebaseAPI.loadGachaOwned(uid);   // {owned, ts} | null(읽기 실패)
    if(srv === null) return;                             // 읽기 실패 — 아무것도 안 한다
    _srvRead = true;
    _gachaSrvSeen = true;                                // 이 세션에서 보유분을 알게 됐다 → 회수를 허용
    const sOwned = _cleanOwned(srv && srv.owned);
    if(mode === 'pull'){
      if(Object.keys(sOwned).length){
        gachaOwned = sOwned;
        _saveGachaLocal(Number(srv.ts) || _gachaNow());
        if(_gachaInvOpen()) renderGachaInv();
        return;
      }
      if(!Object.keys(_cleanOwned(gachaOwned)).length) return;
    }else if(_sameOwned(_mergeOwned(sOwned, gachaOwned), sOwned)){
      _adoptServer(srv);                                 // 이 PC 에만 있는 뽑기 없음 — 서버 값을 받는다
      return;
    }
    const mine = _cleanOwned(gachaOwned);
    const r = await firebaseAPI.updateGacha(uid, cur => ({ owned: _mergeOwned(cur && cur.owned, mine), ts: _gachaNow() }), { onLate: _adoptServer });
    if(r.ok) _adoptServer(r.value);
    else if(r.reason === 'denied'){ try{ _warnServerWriteDenied('가챠'); }catch(_){} }
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
/* 서버 길의 맞추기 — 받기만 한다(올리지 않음). pull(계정 연동)도 같다: 서버 값이 그 계정의 원본이다.
   못 받으면 아무것도 바꾸지 않고 착용 정리도 하지 않는다(옛 길과 같은 전제 — 보유분을 모르는 채 벗기지 않는다). */
async function _syncFromServer(reason, mode){
  _gachaSyncing = true;
  let _srvRead = false;
  try{
    if(!getMyUserId()) return;
    const gen = _srvDrawGen;
    let st = null;
    try{ st = await gachaServer.load(); }catch(e){ console.warn('[가챠] 서버 상태 받기 실패', e && (e.code || e.kind)); return; }
    if(gen !== _srvDrawGen) return;   // 받는 사이 뽑기가 끝났다 — 이 답은 뽑기 전 상태(뽑기 답이 이미 더 새 값을 넣었다)
    _srvRead = true;
    _adoptServerState(st);
  }finally{
    _gachaSyncing = false;
    if(_srvRead){
      try{ pruneUnownedGachaParts(); }catch(e){ console.warn('[가챠] 미보유 파츠 정리 실패', e); }
    }
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
   [비용] 읽기 1회/10분/기기. 쓰기는 이 PC 에만 있는 뽑기가 있을 때만이라 평소엔 0회다. */
const GACHA_SYNC_INTERVAL_MS = 10*60*1000;   // 10분 — 집중 누적(FOCUS_SYNC_INTERVAL_MS)과 같은 박자
setInterval(()=>{ try{ syncGachaToServer('tick'); }catch(_){} }, GACHA_SYNC_INTERVAL_MS);

/* ═══ 🎰 도감(꾸미기 창 «도감» 탭) · 가챠 뽑기 창 ══════════════════════════════════
   ★ 도감은 꾸미기 창(#wardrobePanel)의 탭 하나다 — 꾸미기 창이 «도감» 탭을 그릴 때 #gachaInvHost 를 만들고
     renderGachaInv 를 부른다. 그 자리가 없으면(다른 탭 · 창 닫힘) 아무것도 그리지 않는다.
   ★ 착용은 꾸미기와 같은 배관이다 — toggleEquip(cat, id). 저장은 꾸미기 창을 닫을 때(commitWdDraft).
     가챠 파츠는 stackable 이 강제라 꾸미기 파츠를 밀어내지 않는다.
   ★ 도감 줄 · 쪽 규칙은 gacha-album.js(순수 함수). */
const gachaAlbum = TwGachaAlbum;
/* 지금 연 도감 — null 이면 도감 목록, '' 은 상시, 시즌 키면 그 시즌. 창을 닫았다 열어도 남는다. */
let _gachaAlbum = null;
/* 📄 4열 × 3줄 = 한 쪽 12칸.
   ⚠️ 열을 바꾸면 CSS(#gachaInvGrid 의 repeat(4,1fr))도 같이 고친다 — 한쪽만 고치면 마지막 줄이 잘리거나 빈칸이 남는다. */
const GACHA_GRID_COLS = 4, GACHA_GRID_ROWS = 3;
const GACHA_PAGE_SIZE = GACHA_GRID_COLS * GACHA_GRID_ROWS;
let _gachaPage = 0;
/* 다음 그리기 때 '이 파츠가 있는 쪽'으로 한 번 옮기고 스스로 비우는 예약.
   ★ 매번 따라가면 3쪽을 보다가 파츠 하나 착용하는 것만으로 쪽이 튄다 — 한 번만 쓰고 지운다. */
let _gachaJumpId = null;
let _gachaLastDrawId = null;   // 방금 뽑은 파츠 — [도감으로] 가 그 도감 · 그 쪽을 연다
let _gachaSelId = null;  // 지금 보고 있는 파츠 — 미리보기 아래 색상 영역이 이걸 따라간다

/* 관리자 등록 — 꾸미기의 [+ 등록]과 같은 흐름(#partRegOverlay)을 그대로 쓴다.
   신규일 때만 🎰 를 미리 켜준다(수정은 그 파츠의 저장값을 그대로 보여야 한다). */
function openGachaPartRegister(cat, rec){
  openPartRegister(cat, rec);
  if(!rec){
    const g=document.getElementById('partRegGacha'); if(g) g.checked = true;
    syncPartRegGachaLock();
  }
}

function _gachaWornIds(){
  const def = wdDraftDef() || (findMySeat() && findMySeat().charDef);
  const out = [];
  if(def && def.equippedParts){
    for(const c in def.equippedParts){ (catEquippedIds(def, c)||[]).forEach(i=>out.push(i)); }
  }
  return out;
}
function _gachaThumb(rec){ return TwSafeHtml.safeUrl(rec.thumbUrl || rec.thumbnail, 'image') || null; }   // 카탈로그 그림 — 허용된 그림 주소만
function _gachaPips(n, max){ const m = max || GACHA_DUPES_FOR_COLOR;
  return '●'.repeat(Math.min(n, m)) + '○'.repeat(Math.max(0, m - n)); }
const GACHA_SEASON_MONTH = { spring:'3월', summer:'6월', autumn:'9월', winter:'12월' };

function _gachaHost(){ return document.getElementById('gachaInvHost'); }
/* 상세조정 패널은 접는다 — 열려 있던 파츠가 다른 도감이라 화면에서 사라지면 패널만 남아 어느 파츠 것인지 모른다. */
function _gachaDropAdj(){
  if(activeWdAdj()){ _setActiveWdAdj(null); _clearMultiPanelRef(); }
}

/* 📚 도감 탭을 처음 보일 때 — 꾸미기 창을 «도감» 탭으로 열거나 탭을 바꿀 때 꾸미기 창이 부른다.
   ★ 서버와 한 번 맞춘다(다른 PC 에서 뽑은 것이 보이게) — 기다리지 않는다. 받아오면 _adoptServer 가 다시 그린다.
   ★ 고른 파츠가 있는 쪽에서 시작한다 — 색상 영역은 그 파츠를 따라가는데 칸이 3쪽에 있으면 화면에 안 보인다. */
let _gachaSkipSync = false;   // [도감으로] — 방금 뽑기가 서버 값을 받아 왔으니 한 번 건너뛴다
function onAlbumShow(){
  if(_gachaSkipSync) _gachaSkipSync = false;
  else { try{ syncGachaToServer('inv-open'); }catch(_){} }
  _gachaJumpId = _gachaSelId;
}

/* 아래 줄(꾸미기 창 #gachaInvFoot) — 남은 뽑기 · 이번 시즌 · 관리자 등록 */
function _renderGachaFoot(){
  const bar = document.getElementById('gachaInvBar');
  if(bar){
    const season = gachaSeasonNow();
    bar.innerHTML = '🎰 남은 뽑기 <b>' + gachaTicketsLeft() + '회</b> · ' + escHtml(GACHA_SEASON_LABEL[season] || season) + ' 시즌';
    bar.title = GACHA_LEVELS_PER_TICKET + '레벨마다 뽑기 1회' + ((_gachaBonus|0) > 0 ? ' + 👑 달성표 ' + (_gachaBonus|0) + '회' : '');
  }
  _renderGachaAdminFoot();
}

/* 도감 목록 — 줄마다 그림 셋 · 이름 · 모은 막대 · «n / m 모음». 지금 시즌 도감은 «지금» 표시. */
function _renderGachaAlbumList(host, all){
  const rows = gachaAlbum.albumList(all, gachaCount);
  if(!rows.length){
    const d = document.createElement('div'); d.className = 'gc-empty';
    d.textContent = isAdmin() ? '등록된 가챠 파츠가 없어요. 아래 [+ 등록]으로 만들어 주세요.'
                              : '아직 가챠로 나오는 파츠가 없어요.';
    host.appendChild(d);
    return;
  }
  const now = gachaSeasonNow();
  let seasonHead = false;
  rows.forEach(a => {
    if(!a.key || !seasonHead){
      const h = document.createElement('div'); h.className = 'gc-al-sec';
      h.textContent = a.key ? '🗂 시즌별 도감' : '⭐ 상시';
      host.appendChild(h);
      if(a.key) seasonHead = true;
    }
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'gc-album' + (a.key && a.key === now ? ' now' : '');
    const th = document.createElement('div'); th.className = 'gc-al-thumbs';
    for(let i = 0; i < gachaAlbum.ALBUM_THUMBS; i++){
      const rec = a.thumbs[i];
      const src = rec ? _gachaThumb(rec) : null;
      if(src){ const img = document.createElement('img'); img.src = src; img.alt = ''; th.appendChild(img); }
      else { const ph = document.createElement('span'); ph.className = 'gc-al-ph'; ph.textContent = rec ? (rec.icon || '🎁') : '❔'; th.appendChild(ph); }
    }
    row.appendChild(th);
    const body = document.createElement('div'); body.className = 'gc-al-body';
    const tt = document.createElement('div'); tt.className = 'gc-al-title';
    tt.textContent = a.label;
    if(a.key && a.key === now){ const b = document.createElement('span'); b.className = 'gc-al-now'; b.textContent = '지금'; tt.appendChild(b); }
    body.appendChild(tt);
    const bar = document.createElement('div'); bar.className = 'gc-al-bar';
    const fill = document.createElement('i'); fill.style.width = gachaAlbum.albumPct(a.owned, a.total) + '%';
    bar.appendChild(fill);
    const n = document.createElement('span'); n.className = 'gc-al-n'; n.textContent = a.owned + ' / ' + a.total + ' 모음';
    const line = document.createElement('div'); line.className = 'gc-al-line';
    line.appendChild(bar); line.appendChild(n);
    body.appendChild(line);
    row.appendChild(body);
    const go = document.createElement('span'); go.className = 'gc-al-go'; go.textContent = '›';
    row.appendChild(go);
    row.title = a.label + ' 도감 — ' + a.owned + ' / ' + a.total + ' 모음';
    row.onclick = ()=>{
      _gachaAlbum = a.key;
      _gachaPage = 0;
      _gachaJumpId = _gachaSelId;   // 고른 파츠가 이 도감에 있으면 그 쪽부터
      _gachaDropAdj();
      renderGachaInv();
      refreshWdPreviewColorSection();
    };
    host.appendChild(row);
  });
}

/* 📄 ⏮ ◀ 1/2 ▶ ⏭ — 칸 아래. 한 쪽뿐이어도 그린다(자리가 늘 같아야 누른 손이 다른 버튼을 누르지 않는다). */
function _renderGachaPager(box, pages){
  const go = p=>()=>{
    const next = Math.min(pages - 1, Math.max(0, p));
    if(next === _gachaPage) return;
    _gachaPage = next;
    renderGachaInv();
    /* 색상 영역은 건드리지 않는다 — 쪽을 넘긴 것뿐이고 고른 파츠(_gachaSelId)는 그대로다. */
  };
  const mk = (txt, title, dis, fn)=>{
    const b = document.createElement('button');
    b.type='button'; b.textContent = txt; b.title = title; b.disabled = !!dis;
    if(!dis) b.onclick = fn;
    return b;
  };
  box.appendChild(mk('⏮', '첫 쪽', _gachaPage <= 0, go(0)));
  box.appendChild(mk('◀', '이전 쪽', _gachaPage <= 0, go(_gachaPage - 1)));
  const n = document.createElement('span'); n.className='gc-pg-num';
  n.textContent = (_gachaPage + 1) + ' / ' + pages;
  box.appendChild(n);
  box.appendChild(mk('▶', '다음 쪽', _gachaPage >= pages - 1, go(_gachaPage + 1)));
  box.appendChild(mk('⏭', '마지막 쪽', _gachaPage >= pages - 1, go(pages - 1)));
}

/* 한 도감의 칸 — 뽑은 것은 그림 · 이름 · ●○ · 🎨, 안 뽑은 것은 점선 «???»(시즌 밖이면 «n월에 돌아옴»). */
function _renderGachaAlbumGrid(host, list){
  const season = gachaSeasonNow();
  const head = document.createElement('div'); head.className = 'gc-al-head';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'gc-al-back';
  back.textContent = '‹'; back.title = '도감 목록으로';
  back.onclick = ()=>{ _gachaAlbum = null; _gachaDropAdj(); renderGachaInv(); refreshWdPreviewColorSection(); };
  head.appendChild(back);
  const tt = document.createElement('span'); tt.className = 'gc-al-title';
  tt.textContent = gachaAlbum.ALBUM_LABEL[_gachaAlbum];
  head.appendChild(tt);
  const cnt = document.createElement('span'); cnt.className = 'gc-al-n';
  cnt.textContent = list.filter(p => gachaCount(p.id) > 0).length + ' / ' + list.length + ' 모음';
  head.appendChild(cnt);
  host.appendChild(head);

  const worn = _gachaWornIds();
  const grid = document.createElement('div'); grid.id = 'gachaInvGrid';
  // 선택이 비었거나 목록에서 사라졌으면 착용 중인 것 → 가진 것 순으로 하나 잡아둔다.
  if(!list.some(p => p.id === _gachaSelId)){
    const pick = list.find(p => worn.includes(p.id)) || list.find(p => gachaCount(p.id) > 0) || null;
    _gachaSelId = pick ? pick.id : null;
  }
  /* 📄 쪽 확정 — 예약된 점프가 먼저(쪽을 덮으므로), 범위 보정이 그 뒤.
     목록이 줄어 지금 쪽이 사라지는 경우가 있다(관리자 삭제 · 서버 동기화) — 빈 쪽이 열리면 «다 사라졌다» 로 보인다. */
  if(_gachaJumpId){
    const at = gachaAlbum.pageOf(list, _gachaJumpId, GACHA_PAGE_SIZE);
    if(at >= 0) _gachaPage = at;
    _gachaJumpId = null;   // 찾든 못 찾든 한 번 쓰고 버린다
  }
  _gachaPage = gachaAlbum.clampPage(_gachaPage, list.length, GACHA_PAGE_SIZE);
  const pages = gachaAlbum.pageCount(list.length, GACHA_PAGE_SIZE);
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
    // ⚠️ 안 뽑은 파츠는 이름을 숨긴다 — 이름이 보이면 실루엣의 의미가 없다.
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
        refreshWdPreviewColorSection();
      };
      /* 🖱️ 우클릭 = 상세조정 — 꾸미기 카드와 같은 관례 · 같은 패널(createWardrobeAdjPanel).
         ★ activeWdAdj 를 그대로 쓴다 — 기즈모 부착과 미리보기 색상 영역이 전부 이 값을 본다. */
      cell.oncontextmenu = e=>{
        e.preventDefault();
        if(!worn.includes(rec.id)){ toast('먼저 파츠를 착용해 주세요'); return; }
        if(activeWdAdj() && activeWdAdj().id===rec.id){ _setActiveWdAdj(null); _clearMultiPanelRef(); }
        else { _setActiveWdAdj({cat:rec.cat, id:rec.id}); _gachaSelId=rec.id; }
        renderGachaInv();
        refreshWdPreviewColorSection();
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
    /* 🖱️ 안 뽑은 칸에도 우클릭 응답을 준다 — 무반응이면 «우클릭이 고장났다» 로 보인다. */
    if(!show){
      cell.oncontextmenu = e=>{
        e.preventDefault();
        toast(offSeason ? '지금은 가챠에 안 나오는 시즌 파츠예요'
                        : '아직 안 뽑은 파츠라 조정할 수 없어요');
      };
    }
    grid.appendChild(cell);
    /* 상세조정 패널은 그 칸 **바로 뒤**에 한 줄을 통째로 써서 끼운다(4열에 그냥 넣으면 한 칸짜리로 찌그러진다). */
    if(activeWdAdj() && activeWdAdj().id === rec.id && worn.includes(rec.id)){
      const panel = createWardrobeAdjPanel(rec.cat, rec.id);
      panel.style.gridColumn = '1 / -1';
      grid.appendChild(panel);
      requestAnimationFrame(()=>{ try{ panel.scrollIntoView({block:'nearest'}); }catch(_){} });
    }
  });
  /* 📄 남는 자리는 점선 빈칸으로 채워 칸 높이를 늘 3줄로 둔다 — 쪽을 넘길 때 창 높이가 출렁이지 않게.
     안 뽑은 칸(«???»)과는 글자가 없어서 갈린다. */
  for(let i = pageList.length; i < GACHA_PAGE_SIZE; i++){
    const hole = document.createElement('div');
    hole.className = 'gc-cell gc-hole';
    grid.appendChild(hole);
  }
  host.appendChild(grid);
  const pg = document.createElement('div'); pg.id = 'gachaInvPager'; pg.className = 'gc-pg';
  _renderGachaPager(pg, pages);
  host.appendChild(pg);
}

function renderGachaInv(){
  const host = _gachaHost();
  if(!host) return;
  _renderGachaFoot();
  const all = savedParts().filter(p => isGachaPart(p));
  // 연 도감이 비었으면(관리자 삭제 · 시즌 정리) 목록으로 — 빈 칸만 있는 도감은 «다 사라졌다» 로 보인다.
  if(_gachaAlbum !== null && !gachaAlbum.albumParts(all, _gachaAlbum).length) _gachaAlbum = null;
  host.innerHTML = '';
  if(_gachaAlbum === null) _renderGachaAlbumList(host, all);
  else _renderGachaAlbumGrid(host, gachaAlbum.albumParts(all, _gachaAlbum));
  // ★ 기즈모 부착 · 기즈모 바 표시는 꾸미기와 같은 함수가 담당한다(activeWdAdj를 보고 판단).
  updateWdGizmoForActivePanel();
}

/* 관리자 등록 줄 — 카테고리를 고르고 [+ 등록]. 꾸미기의 카테고리별 [+ 등록]과 같은 모달로 간다. */
function _renderGachaAdminFoot(){
  const sel = document.getElementById('gachaAdminCat'), btn = document.getElementById('gachaAdminAdd');
  if(!sel || !btn) return;
  if(!isAdmin()){ sel.style.display='none'; btn.style.display='none'; return; }
  sel.style.display=''; btn.style.display='';
  if(!sel.options.length){
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

/* 연출 중 잠금 — 뽑기 버튼과 [도감으로]만 잠근다.
   ⚠️ 닫기(✕)는 **절대 잠그지 않는다.** 예전엔 여기 gachaDrawClose 가 들어 있어서 pointer-events 가
     꺼졌는데, 아래 시퀀스에는 busy 를 못 풀고 빠져나가는 return 이 여럿 있었다. 그 조합이
     "창이 통째로 얼어서 닫지도 못한다"였다. 잠금이 풀리지 않아도 최소한 닫을 수는 있어야 한다. */
function _gachaSetBusy(on){
  ['gachaDraw1','gachaDraw5','gachaBackInv'].forEach(id=>{
    const b = document.getElementById(id); if(!b) return;
    if(b.tagName === 'BUTTON') b.disabled = !!on; else b.style.pointerEvents = on ? 'none' : '';
  });
}

/* 뽑기 실패를 알린다(문구는 error-codes.js 표). 어느 경우든 이 PC 는 아무것도 안 바뀌고 횟수도 그대로다. */
function _gachaNotifyFail(reason){
  if(reason === 'denied' || reason === 'nouser') notifyError('E-CHAR-09', reason);
  else if(reason === 'offline') notifyError('E-CHAR-10', reason);
  else if(reason === 'timeout') notifyError('E-CHAR-11', reason);
  else notifyError('E-CHAR-12', reason);
}

/* 뽑기 버튼을 누른 순간부터의 시퀀스: 빠른 떨림 → 갈라짐 + 픽셀 파티클 → 결과 팝인
   ★ n 은 '요청 횟수'다. 티켓이 모자라면 gachaDraw 가 알아서 줄여서 돌려준다 —
     호출부에서 Math.min 으로 깎아 넘기지 않는다(그게 5연속 먹통의 원인이었다. 아래 참고). */
async function _gachaRunDraw(n){
  if(_gachaDrawing) return;   // 이미 뽑는 중 — 그쪽이 마무리한다
  /* 잠금 해제를 한 곳으로 모은다. 예전엔 시퀀스 안의 return 이 전부 busy 를 남긴 채 빠져나가서,
     한 번 어긋나면 버튼이 영영 죽은 채로 남았다. */
  let _done = false;
  const finish = ()=>{ if(_done) return; _done = true; _gachaSetBusy(false); renderGachaDrawBar(); };

  /* 서버 저장을 기다리는 동안 캡슐이 떤다 — 저장이 끝나야 연다(서버가 받아 준 결과만 보인다). */
  _gachaSetBusy(true);
  const s0 = _gachaStage();
  if(s0) s0.innerHTML = '<div class="gc-cap-wrap rumble">' + _gachaCapsuleSVG(7) + '</div>';
  let r;
  try{ r = await gachaDraw(n); }
  catch(e){ console.warn('[가챠] 뽑기 실패', e); r = { ok:false, reason:'error' }; }
  if(!r.ok){
    try{ renderGachaDraw(null); _gachaNotifyFail(r.reason); }
    finally{ finish(); }   // 안내가 던져도 버튼이 잠긴 채 남지 않게
    return;
  }
  const res = r.out;

  /* 📄 방금 뽑은 것 중 마지막 파츠를 기억해 둔다 — [도감으로] 를 누르면 그 도감 · 그 쪽이 열린다
     (새로 뽑은 파츠가 안 보이면 뽑기가 안 들어온 줄 안다). */
  if(res.length) _gachaLastDrawId = res[res.length - 1].id;

  if(!res.length){
    toast(gachaTicketsLeft() <= 0 ? '남은 뽑기가 없어요' : '이번 시즌에 뽑을 파츠가 없어요');
    renderGachaDraw(null); finish(); return;
  }
  const s = _gachaStage(); if(!s){ renderGachaDraw(res); finish(); return; }
  const token = ++_gachaAnimToken;
  const alive = () => token === _gachaAnimToken && _gachaDrawOpen();
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

/* 뽑기 창 닫기 — ✕ · ESC · 바깥 클릭 · 창이 포커스를 잃을 때. 꾸미기 창은 그대로 둔다(뽑은 것을 바로 입혀 볼 수 있게).
   ⚠️ 무대를 비운다 — 안 비우면 캡슐 떨림 애니메이션이 실행 화면 내내 돈다. */
function closeGachaDraw(){
  const dv = document.getElementById('gachaDrawOverlay'); if(dv) dv.style.display='none';
  _gachaStopAnim();
  _gachaSetBusy(false);
}
/* 도감이 화면에 있는가 — 꾸미기 창이 «도감» 탭을 그릴 때만 #gachaInvHost 가 있다(다른 탭은 그 자리를 비운다). */
function _gachaInvOpen(){ return !!_gachaHost(); }
function _gachaDrawOpen(){ const ov=document.getElementById('gachaDrawOverlay'); return !!(ov && ov.style.display!=='none'); }

(function bindGachaWindows(){
  const dw=document.getElementById('gachaDrawOverlay');
  if(!dw) return;
  const q=id=>document.getElementById(id);
  /* 🖱️ 타이틀바 드래그 — transform 가운데 → left/top 절대좌표로 바꿔 옮긴다. 자리는 'draw' 칸에 기억한다. */
  const GACHA_POS_KEY = 'tw.gachaWinPos';
  let _gachaPos = {};
  try{ _gachaPos = JSON.parse(localStorage.getItem(GACHA_POS_KEY) || '{}') || {}; }catch(_){ _gachaPos = {}; }
  function _gachaSavePos(key, win){
    try{ _gachaPos[key] = { left:win.style.left, top:win.style.top };
      localStorage.setItem(GACHA_POS_KEY, JSON.stringify(_gachaPos)); }catch(_){}
  }
  /* 저장된 자리로 되돌린다. 그 사이 모니터가 바뀌어 화면 밖이면 가운데로 — 안 그러면 열려 있는데 안 보인다. */
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
  /* 🪟 창 위치 초기화 버튼(F1 → 화면 표시)이 부른다 — 저장 키만 지우면 이 메모리 값이 남는다. */
  (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _gachaPos = {}; });
  _gachaBindDrag('draw', q('gachaDrawWin'), q('gachaDrawHead'), '#gachaDrawClose');
  window._gachaRestorePos = _gachaRestorePos;
  if(q('gachaDrawClose')) q('gachaDrawClose').onclick = closeGachaDraw;
  if(q('gachaGoDraw')) q('gachaGoDraw').onclick = ()=>{
    dw.style.display='block';
    _gachaRestorePos('draw', q('gachaDrawWin'));
    renderGachaDraw(null);
  };
  if(q('gachaBackInv')) q('gachaBackInv').onclick = ()=>{
    closeGachaDraw();
    /* 📄 방금 뽑은 파츠의 도감 · 그 쪽으로 — 새로 뽑은 파츠가 안 보이면 안 들어온 줄 안다.
       안 뽑고 돌아왔으면 보던 자리 그대로. */
    const rec = _gachaLastDrawId ? savedParts().find(p => p.id === _gachaLastDrawId) : null;
    if(rec && gachaAlbum.isAlbumKey(rec.season || '')){
      if(_gachaAlbum !== (rec.season || '')) _gachaDropAdj();   // 다른 도감으로 가면 보던 파츠의 상세조정 · 기즈모를 접는다
      _gachaAlbum = rec.season || ''; _gachaSelId = rec.id;
    }
    _gachaLastDrawId = null;
    _gachaSkipSync = true;
    twNav.go(twNav.NAV.WARDROBE_ALBUM);
    _gachaSkipSync = false;   // 꾸미기 창이 «도감» 탭을 안 그렸어도(창 없음) 예약을 남기지 않는다   // 꾸미기 창을 «도감» 탭으로(이미 열려 있으면 탭만) — onAlbumShow 가 고른 파츠의 쪽으로 옮긴다
  };
  if(q('gachaDraw1')) q('gachaDraw1').onclick = ()=>_gachaRunDraw(1);
  /* ★ Math.min(5, gachaTicketsLeft()) 로 미리 깎아 넘기지 않는다 — 요청 횟수를 그대로 주고 gachaDraw 가 정한다. */
  if(q('gachaDraw5')) q('gachaDraw5').onclick = ()=>_gachaRunDraw(5);
  /* ESC — 뽑기 창이 맨 위다. 캡처 단계에서 닫고 멈춰서 뒤의 꾸미기 창(같은 ESC 를 듣는다)은 그대로 둔다. */
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape' || !_gachaDrawOpen()) return;
    closeGachaDraw();
    e.stopPropagation();
  }, true);
  /* 🖱️ 바깥을 누르면 닫는다. .gacha-ov 는 pointer-events:none 이라 document 캡처 단계에서 받고, 닫으면 안 되는 곳만 뺀다.
     ★ 꾸미기 창 · 미리보기는 뺀다 — 뽑은 파츠를 입혀 보는 곳이다. 관리자 등록 모달 · 색상 팝업도 같은 까닭. */
  const _GACHA_KEEP = '#gachaDrawWin, #wdPreviewPanel, #wardrobePanel,'
    + ' #partRegOverlay, #assetImpOverlay, #categoryManageOverlay, #focusSettingsPanel.fs-in-launcher,'
    + ' .wd-color-palette, .mh-color-pop, .toast';
  document.addEventListener('mousedown', e=>{
    if(!_gachaDrawOpen()) return;
    const t=e.target;
    if(t && t.closest && t.closest(_GACHA_KEEP)) return;
    closeGachaDraw();
  }, true);
  /* ★ "진짜 바깥"(투명 영역) 클릭은 mousedown 이 안 온다(Electron 클릭통과) — 창이 포커스를 잃을 때도 닫는다.
     ⚠️ 파일 선택 창(파츠 등록 GLB 등)으로 포커스가 잠깐 빠질 때는 닫지 않는다(꾸미기 창과 같은 modalOpen 가드). */
  window.addEventListener('blur', ()=>{
    if(!_gachaDrawOpen()) return;
    const modalOpen = document.querySelector('#partRegOverlay.on, #deskRegOverlay.on, #assetImpOverlay.on, #assetGenOverlay.on, #glbEncOverlay.on, #glbLoadOverlay.on, #exportOverlay.on, #adminPassOverlay.on, #licenseGenOverlay.on, #announceOverlay.on, #adBannerOverlay.on, #commGenOverlay.on, #inviteOverlay.on, #raceOverlay.on, #creatorOverlay.on, #focusSettingsPanel.fs-in-launcher.on, #myHomeOverlay.on, #categoryManageOverlay.on, #pkOverlay.on');
    if(modalOpen) return;
    closeGachaDraw();
  });
})();

return {
  /* 밖에서 부르는 이름 — app.js 는 gachaMod.이름 */
  isGachaPart,                          // 꾸미기 창 · 카탈로그 · 라이선스 접기가 가챠 파츠를 거른다
  setPartEditor,                        // 🛠 관리자 등록 창을 건다(app.js)
  isGachaColorUnlocked,                 // 꾸미기 미리보기 색상 영역 — 🔒 게이트
  gachaCount,
  sceneHasColorGroup,                   // 관리자 파츠 등록 — 색 없는 파츠(rec.noColor) 판정
  DUPES_FOR_COLOR: GACHA_DUPES_FOR_COLOR,
  syncGachaToServer,                    // 런처 복귀('launcher') · 로그아웃 직전('logout') · 계정 연동('transfer','pull')
  pruneUnownedGachaParts,               // 꾸미기 커밋 · 카탈로그 도착
  renderGachaInv,                       // 파츠 등록 · 썸네일 재생성 · 계정 연동 · 👑 달성표 보상 · 꾸미기 창 «도감» 탭
  onAlbumShow,                          // 꾸미기 창이 «도감» 탭을 보일 때(서버와 맞추기 · 고른 파츠 쪽으로)
  isInvOpen: _gachaInvOpen,
  isDrawOpen: _gachaDrawOpen,
  selId: ()=>_gachaSelId,               // 도감에서 지금 보고 있는 파츠 — 꾸미기 미리보기 색상 영역이 따라간다
  owned: ()=>gachaOwned,                // 계정 전환 검문 — «뽑은 파츠 N개»
  unsynced: (srv)=>_serverMode() ? 0 : gachaUnsynced(srv),   // 로그아웃 전 검문 — 서버에 없는 이 PC 의 뽑기 수(서버 길은 이 PC 몫을 올리지 않으니 0)
  bonus: ()=>_gachaBonus,               // 👑 달성표 — 보너스 뽑기 수
  setBonusLocal: _setGachaBonusLocal,
  resetMemory(){ gachaOwned = {}; _gachaTs = 0; _gachaBonus = 0; _srvState = null; },   // 로그아웃 지우기 — 메모리도 빈 기기 값으로
  /* 화면 없이 검사하는 셈 · 상태 — sim-gacha.js · sim-gacha-prune.js · sim-part-color-entry.js */
  draw: gachaDraw, pool: gachaPool, seasonNow: gachaSeasonNow, ticketsLeft: gachaTicketsLeft, ticketsEarned: gachaTicketsEarned,
  closeGachaDraw, runDraw: _gachaRunDraw, renderGachaDraw,
  state: {
    ts: ()=>_gachaTs, srvSeen: ()=>_gachaSrvSeen, page: ()=>_gachaPage, album: ()=>_gachaAlbum,
    setOwned(v){ gachaOwned = v; }, setSelId(v){ _gachaSelId = v; }, setAlbum(v){ _gachaAlbum = v; _gachaPage = 0; },
  },
};
}

const api = { createGacha };
if(typeof window !== 'undefined') window.TwGacha = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
