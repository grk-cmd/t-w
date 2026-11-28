/* gacha.js — 🎰 파츠 가챠 — 코어(서버 보유분 · 뽑기 · 미보유 파츠 회수) + 도감(꾸미기 창 «도감» 탭) · 뽑기 창(캡슐 연출)
   ★ 서버가 원본이다(0.13). 보유분 · 뽑기 수 · 시즌 · 색 해금은 서버가 정하고 gacha-api.js 가 받아 온다. 이 PC 에는 사본이 없다 —
     시작할 때 · 도감을 열 때 · 서버 신호(realtime collection)에 받는다.
   ★ 한 파일이다(👑 달성표 weekly-challenge.js 와 같은 방식 — entities 규칙 + widgets 화면). 도감 · 뽑기 창이 코어의 이름
     스무 개 가까이(보유 수 · 풀 · 시즌 · 남은 뽑기 · 받기 …)를 그대로 쓰고, 코어의 받기도 도감을 다시 그린다.
   ★ 도감은 따로 뜨는 창이 아니다 — 꾸미기 창(wardrobe.js)이 «도감» 탭을 그릴 때 #gachaInvHost 를 만들고 renderGachaInv 를 부른다.
     뽑기 창 [도감으로] 는 꾸미기 창을 «도감» 탭으로 연다(wardrobe-panel.js · 따로 단축키 없음 — F2). 도감 줄 · 쪽 규칙은 gacha-album.js(순수).
   ★ app.js 의 let(isAdmin · savedParts · PART_CATS · wdDraftDef · activeWdAdj)은 값이 아니라 읽는 함수로 받는다. activeWdAdj 를 바꾸는 것은 쓰는 함수.
   ★ 밖으로 내놓는 이름은 반환값이다 — app.js 에서 gachaMod.이름 으로 부른다. window 고리는 _gachaRestorePos 하나(뽑기 창 자리).
   ★ 시작은 `startGacha()` 한 번 — launcher/app-boot.js 가 계정 확인 뒤에 부른다. 만들 때는 요청 · 구독 · 타이머를 하지 않는다(뽑기 창 버튼 · 끌기 · ESC 연결뿐).
   ⚠️ document · window · localStorage(창 자리) 는 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwGacha — 크로미움 내장 전역과 겹치는 이름을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-gacha.js — 만들 때 · 보유 · 색상 해금 · 풀 · 남은 뽑기 · 뽑기 · 서버 받기(받는 중 · 못 받음 · 뽑기와의 경합) ·
         도감(목록 · 칸 · 쪽 · [도감으로]) · 뽑기 창 · app.js 배선 · html 순서. */
(function(){

function createGacha(deps){
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
const shownFocusLevel = deps.shownFocusLevel;                  // 화면에 적는 레벨 — 못 받았으면 null(«다음 뽑기 Lv» 를 적지 않는다)
const levelCap = deps.levelCap;                                // ⭐ 레벨 상한 — 넘는 «다음 뽑기 레벨» 은 안 보인다
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
const gachaApi = deps.gachaApi;                                // 🎰 서버 경로 — gacha-api.js(서버가 뽑고 저장 · 원본)
const rtOn = deps.rtOn;                                        // 🛰 서버가 «바뀌었다» 고 알리는 길(TwRtHub.store.on) → 해제 함수
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

/* ═══ 🎰 파츠 가챠 — 코어 ══════════════════════════════════════════════════
   성격은 '집중 보상'이다. 수집 경쟁이 아니므로 등급(rarity)도 꽝도 없고 확률은 균등하다.

   ★ 서버가 원본이다. 보유분 · 뽑기 수 · 시즌 · 색 해금은 서버가 정하고(GET /v2/me/collection · /v2/me/gacha), 뽑기는 서버가 굴려 저장한다
     (POST /v2/me/gacha/draws). 이 PC 에는 사본을 두지 않는다 — 열 때(시작 · 보관함 열기) 받고, 서버가 «바뀌었다»(realtime collection)고 알리면 다시 받는다.
     주기로 맞추지 않고, 실패한 뒤 혼자 되풀이하지 않는다(다시 받는 길은 보관함 열기 · 다시 시도 단추 · 서버 신호).
   ★ 받기 전(loading) · 못 받음(failed)에는 보유분을 모른다 — 빈 보유분으로 그리지 않고, 뽑기도 막는다. 미보유 파츠 회수는 받은 뒤에만 한다.
   ★ 뽑기 수는 레벨/5 에 달성표 보상을 더한 값이고 서버가 센다 — 앱은 `left` 를 그린다. */

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
const GACHA_OWNED_MAX = 9999;         // 보유 표시 상한(서버 규격과 같은 값)
let gachaOwned = {};                  // {partId: 뽑은 횟수} — 서버 값(받기 전엔 비어 있되 _gachaLoad 로 «모름» 을 가른다)
let _gachaUnlocked = {};              // {partId: true} — 서버가 «색 변경 열림» 으로 센 파츠(관리자는 서버가 모두 열어 준다)
let _srvState = null;                 // { earned, bonus, left, season } — 받기 전엔 null
/* 보유분을 아는 정도 — 'idle'(시작 전) | 'loading' | 'ready' | 'failed'.
   미보유 파츠 회수(pruneUnownedGachaParts)의 유일한 전제는 'ready' 다 — 모르는 채로 벗기면 멀쩡한 파츠가 사라진다. */
let _gachaLoad = 'idle';
let _gachaPulling = false;
let _gachaPullAgain = false;          // 받는 중에 온 요청 — 끝난 뒤 한 번 더(서버가 그 사이 바뀌었을 수 있다)
let _gachaPullGen = 0;                // 뽑기 · 비우기가 일어날 때마다 올린다 — 그 전에 나간 받기가 늦게 와 새 값을 덮지 않게
let _gachaDrawing = false;
let _gachaStarted = false;
let _unsubRt = null;   // 서버 신호 구독 해제 함수 — 계정이 바뀌면 풀어 구독이 겹치지 않게

const gachaAlbum = TwGachaAlbum;   // 📚 시즌 이름 · 이름표 · 달의 정본(gacha-album.js) — 도감과 뽑기 풀이 같은 표를 본다
/* 지금 가챠 중인 시즌 — 서버가 정한다(서울 시계). 받기 전엔 null(시즌 파츠를 풀에 넣지 않는다). */
function gachaSeasonNow(){
  const s = _srvState && _srvState.season;
  return (s && gachaAlbum.isAlbumKey(s)) ? s : null;
}
const GACHA_SEASON_LABEL = gachaAlbum.ALBUM_LABEL;

function gachaCount(partId){ return gachaOwned[partId] | 0; }
function isGachaOwnedPart(partId){ return gachaCount(partId) > 0; }
// 색상 변경 해금 — 🔴 이 게이트는 가챠 파츠에만 건다. 기존 꾸미기 파츠의 색상은 조건 없이 열려 있고,
//   전체에 걸면 기존 유저가 쓰던 기능을 잃는다. 다 모았는지는 서버가 센 값(관리자 포함)이다.
/* 🔑 관리자는 게이트를 통과한다 — 파츠를 등록·검수하려면 4개를 모으기 전에 색이 어떻게 먹는지 봐야 한다.
   ⚠️ **여기만 열고 gachaPool() 은 건드리지 않는다.** 관리자까지 풀에서 빼면 풀이 통째로 비어 가챠 자체가 안 돈다. */
function isGachaColorUnlocked(partId){
  if(isAdmin()) return true;
  return _gachaUnlocked[partId] === true;
}

/* 이번 시즌 가챠 풀(화면에 «n종» 을 보이는 용). 실제로 굴리는 것은 서버다. 다 모은 파츠는 빠진다. */
function _poolFor(owned){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p)
    && (!p.season || p.season === season)
    && (owned[p.id] | 0) < gachaDupesFor(p));   // 색 없는 파츠는 1개만 모으면 빠진다
}
function gachaPool(){ return _poolFor(gachaOwned); }
// 이번 시즌에 뽑힐 수 있는 전체(다 모은 것 포함) — 보관함의 "이번 시즌 컴플리트" 판정용
function gachaSeasonParts(){
  const season = gachaSeasonNow();
  return savedParts().filter(p => isGachaPart(p) && (!p.season || p.season === season));
}
/* 뽑기 수 — 서버가 센 값. 받기 전 · 받는 중 · 못 받음이면 null(«모름» — 0 회로 그리거나 버튼을 «남은 뽑기 없음» 으로 끄지 않는다 · CLAUDE.md «모르는 값») */
function _srvNum(k){ return (_gachaLoad === 'ready' && _srvState) ? Number(_srvState[k]) : null; }
function gachaTicketsEarned(){ return _srvNum('earned'); }
function gachaTicketsLeft(){ return _srvNum('left'); }
function gachaBonusNow(){ return _srvNum('bonus'); }
/* 뽑기 수를 모를 때 보일 글 — 받는 중이면 «불러오는 중», 못 받았으면 «못 불러왔어요»(뽑기 창 · 도감 아래 줄이 같이 쓴다) */
const GACHA_LEFT_LOADING = '남은 뽑기를 불러오는 중…';
const GACHA_LEFT_FAILED = '남은 뽑기를 못 불러왔어요';
function _gachaLeftUnknownText(){ return _gachaLoad === 'failed' ? GACHA_LEFT_FAILED : GACHA_LEFT_LOADING; }
/* 다음 뽑기가 생기는 레벨 — 레벨로 받는 몫만 센다(👑 보상은 레벨과 무관). 상한을 넘으면 null · 레벨이 숫자가 아니면(모름) null(0 레벨로 치지 않는다). */
function gachaNextTicketLevel(level, cap){
  const n = Number(level);
  if(level == null || !Number.isFinite(n)) return null;
  const lv = Math.max(0, Math.floor(n));
  const next = (Math.floor(lv / GACHA_LEVELS_PER_TICKET) + 1) * GACHA_LEVELS_PER_TICKET;
  return next <= cap ? next : null;
}
const _nextLv = () => { const lv = shownFocusLevel(); return lv == null ? null : gachaNextTicketLevel(lv, levelCap); };

/* 서버 상태를 그대로 받는다(갈아 끼움) — 이 PC 에만 있는 뽑기는 없다. */
function _adoptServerState(st){
  const wasUnknown = _gachaLoad !== 'ready';
  gachaOwned = st.owned;
  _gachaUnlocked = st.unlocked;
  _srvState = { earned: st.earned, bonus: st.bonus, left: st.left, season: st.season };
  _gachaLoad = 'ready';
  if(_gachaInvOpen()) renderGachaInv();
  if(wasUnknown && _gachaDrawOpen() && !_gachaDrawing) renderGachaDraw(null);   // 뽑기 창이 «불러오는 중 · 못 불러옴» 이었다 — 받은 값으로 다시 그린다(뽑기 연출 중이면 그쪽이 그린다)
}
/* 서버 결과 줄에 카탈로그 항목을 붙인다 — 연출 · 이름 · 그림이 rec 를 읽는다. 카탈로그에 없으면 이름 없는 칸으로. */
function _withRec(out){
  const list = savedParts() || [];
  return out.map(r => Object.assign({ rec: list.find(p => p.id === r.id) || { id: r.id, name: '파츠' } }, r));
}

/* 뽑기 — 서버가 굴리고 저장한다. 저장이 끝나야 결과를 돌려준다.
   ★ 실패하면 이 PC 는 아무것도 바꾸지 않는다(횟수 그대로). 시간 초과 뒤 서버엔 들어갔을 수 있으니, 사용자가 보관함을 여는 때 다시 받는다(혼자 다시 보내지 않는다).
   @return { ok:true, out } | { ok:false, reason:'busy'|'nouser'|'offline'|'timeout'|'error' } */
async function gachaDraw(n){
  if(_gachaDrawing) return { ok:false, reason:'busy' };
  if(!getMyUserId() || _gachaLoad !== 'ready') return { ok:false, reason:'nouser' };   // 받기 전엔 보유분을 모른다 — 굴리지 않는다
  _gachaDrawing = true;
  try{
    const r = await gachaApi.draw(n);
    if(!r.ok) return { ok:false, reason: r.reason };
    _gachaPullGen++;
    _adoptServerState(r.state);
    return { ok:true, out: _withRec(r.out) };
  }finally{ _gachaDrawing = false; }
}


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
  if(_gachaLoad !== 'ready') return 0;
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

/* 🛰 서버에서 받기 — 시작할 때 · 보관함을 열 때 · 서버가 «바뀌었다» 고 알릴 때 · «다시 시도» 를 누를 때. 주기도 대기 타이머도 없다.
   받는 중에 또 부르면 끝난 뒤 한 번 더(그 사이 서버가 바뀌었을 수 있다). 실패하면 아무것도 안 바꾸고 착용도 벗기지 않는다.
   notify=true(사용자가 연 · 누른 받기)일 때만 오류 번호를 보인다 — 서버 신호로 도는 받기는 조용히 두고 화면은 «못 불러왔어요» 로 남긴다.
   @return 'ready' | 'failed' | 'skipped' */
async function pullGacha(notify){
  if(!getMyUserId()) return 'skipped';
  if(_gachaPulling){ _gachaPullAgain = true; return 'skipped'; }
  _gachaPulling = true;
  if(_gachaLoad !== 'ready'){ _gachaLoad = 'loading'; if(_gachaInvOpen()) renderGachaInv(); if(_gachaDrawOpen() && !_gachaDrawing) renderGachaDraw(null); }
  let res = 'failed';
  try{
    const gen = _gachaPullGen;
    let st = null;
    try{ st = await gachaApi.load(); }
    catch(e){
      console.warn('[가챠] 서버 상태 받기 실패', e && (e.code || e.kind));
      if(_gachaLoad === 'loading') _gachaLoad = 'failed';
      if(notify) notifyError('E-CHAR-15', e);
      return res;
    }
    if(gen !== _gachaPullGen){ res = 'skipped'; return res; }   // 받는 사이 뽑기가 끝났다 — 이 답은 뽑기 전 상태(뽑기 답이 이미 더 새 값을 넣었다)
    _adoptServerState(st);
    res = 'ready';
    return res;
  }finally{
    _gachaPulling = false;
    if(res === 'ready'){
      try{ pruneUnownedGachaParts(); }catch(e){ console.warn('[가챠] 미보유 파츠 정리 실패', e); }
    }else{
      if(_gachaInvOpen()) renderGachaInv();
      if(_gachaLoad !== 'ready' && _gachaDrawOpen() && !_gachaDrawing) renderGachaDraw(null);   // 뽑기 창도 «못 불러왔어요 · 다시 시도» 로
    }
    const again = _gachaPullAgain; _gachaPullAgain = false;
    if(again && res !== 'failed') pullGacha(false);   // 실패 뒤에는 되풀이하지 않는다 — 삼켜진 요청도 같이 버린다
  }
}
/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 서버에서 받고, 서버 신호를 듣는다. 두 번 불려도 구독은 한 번. */
function startGacha(session){
  if(_gachaStarted) return;
  _gachaStarted = true;
  _unsubRt = session.on(rtOn('collection', ()=>{ pullGacha(false); }));
  session.onReset(resetGacha);   // 세션이 끝나면 구독을 풀고(위) 메모리를 비운다
  pullGacha(false);
}
/* 로그아웃 · 계정 바뀜 — 메모리를 비우고 서버 신호 구독을 푼다(이 PC 에 남는 가챠 값은 없다). */
function resetGacha(){
  gachaOwned = {}; _gachaUnlocked = {}; _srvState = null; _gachaLoad = 'idle';
  _gachaPullGen++; _gachaPullAgain = false; _gachaStarted = false;
  if(_unsubRt){ _unsubRt(); _unsubRt = null; }
}

/* ═══ 🎰 도감(꾸미기 창 «도감» 탭) · 가챠 뽑기 창 ══════════════════════════════════
   ★ 도감은 꾸미기 창(#wardrobePanel)의 탭 하나다 — 꾸미기 창이 «도감» 탭을 그릴 때 #gachaInvHost 를 만들고
     renderGachaInv 를 부른다. 그 자리가 없으면(다른 탭 · 창 닫힘) 아무것도 그리지 않는다.
   ★ 착용은 꾸미기와 같은 배관이다 — toggleEquip(cat, id). 저장은 꾸미기 창을 닫을 때(commitWdDraft).
     가챠 파츠는 stackable 이 강제라 꾸미기 파츠를 밀어내지 않는다.
   ★ 도감 줄 · 쪽 규칙은 gacha-album.js(순수 함수). */
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

function _gachaHost(){ return document.getElementById('gachaInvHost'); }
/* 상세조정 패널은 접는다 — 열려 있던 파츠가 다른 도감이라 화면에서 사라지면 패널만 남아 어느 파츠 것인지 모른다. */
function _gachaDropAdj(){
  if(activeWdAdj()){ _setActiveWdAdj(null); _clearMultiPanelRef(); }
}

/* 📚 도감 탭을 처음 보일 때 — 꾸미기 창을 «도감» 탭으로 열거나 탭을 바꿀 때 꾸미기 창이 부른다.
   ★ 서버에서 한 번 받는다(다른 PC 에서 뽑은 것이 보이게).
   ★ 고른 파츠가 있는 쪽에서 시작한다 — 색상 영역은 그 파츠를 따라가는데 칸이 3쪽에 있으면 화면에 안 보인다.
   opts.skipSync — [도감으로]: 방금 뽑기가 서버 값을 받아 왔으니 다시 읽지 않는다. */
function onAlbumShow(opts){
  /* 못 받은 상태로 열면 이번이 «다시 시도» 라 오류 번호도 보인다. 받아오면 _adoptServerState 가 다시 그린다(기다리지 않는다). */
  if(!(opts && opts.skipSync)) pullGacha(_gachaLoad === 'failed');
  _gachaJumpId = _gachaSelId;
}

/* 아래 줄(꾸미기 창 #gachaInvFoot) — 남은 뽑기 · 이번 시즌 · 관리자 등록 */
function _renderGachaFoot(){
  const bar = document.getElementById('gachaInvBar');
  if(bar){
    const season = gachaSeasonNow();
    const nextLv = _nextLv();
    const left = gachaTicketsLeft(), bonus = gachaBonusNow();
    bar.innerHTML = (left == null ? '🎰 ' + _gachaLeftUnknownText() : '🎰 남은 뽑기 <b>' + left + '회</b>') + (nextLv ? ' · 다음 뽑기 <b>Lv ' + nextLv + '</b>' : '')
      + (season ? ' · ' + escHtml(GACHA_SEASON_LABEL[season] || season) + ' 시즌' : '');
    bar.title = GACHA_LEVELS_PER_TICKET + '레벨마다 뽑기 1회' + (bonus > 0 ? ' + 👑 달성표 ' + bonus + '회' : '');
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
      bk.textContent = (gachaAlbum.ALBUM_MONTH[rec.season]||'') + '에 돌아옴';
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
  /* 받기 전(불러오는 중) · 못 받음은 빈 도감이 아니다 — 보유분을 모르는 채 «???» 만 그리지 않는다. */
  if(_gachaLoad !== 'ready'){
    host.innerHTML = '';
    const d = document.createElement('div'); d.className = 'gc-empty';
    if(_gachaLoad === 'failed'){
      d.textContent = '내 가챠 도감을 못 불러왔어요 · ';
      const rb = document.createElement('button');
      rb.id = 'gachaRetry'; rb.type = 'button'; rb.className = 'btn'; rb.textContent = '다시 시도';
      rb.onclick = ()=>{ pullGacha(true); };
      d.appendChild(rb);
    }else d.textContent = '불러오는 중…';
    host.appendChild(d);
    updateWdGizmoForActivePanel();
    return;
  }
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
/* 뽑기 수를 모를 때 무대 — 받는 중이면 «불러오는 중…», 못 받았으면 «못 불러왔어요» + [다시 시도](오류 번호가 보이는 받기 — 도감의 다시 시도와 같다) */
function _gachaUnknownStage(){
  const s = _gachaStage(); if(!s) return;
  s.innerHTML = '';
  const d = document.createElement('div'); d.className = 'gc-empty';
  if(_gachaLoad === 'failed'){
    d.textContent = GACHA_LEFT_FAILED + ' · ';
    const rb = document.createElement('button');
    rb.id = 'gachaDrawRetry'; rb.type = 'button'; rb.className = 'btn'; rb.textContent = '다시 시도';
    rb.onclick = ()=>{ pullGacha(true); };
    d.appendChild(rb);
  }else d.textContent = GACHA_LEFT_LOADING;
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
  const nextLv = _nextLv();
  if(left == null){   // 뽑기 수를 모른다 — 0 회로 적지도 «남은 뽑기 없음» 으로 끄지도 않고, 모르는 동안은 누를 수 없다(서버가 받기 전엔 굴리지 않는다 — gachaDraw)
    bar.textContent = _gachaLeftUnknownText();
    if(b1) b1.disabled = true;
    if(b5){ b5.textContent = '5연속 뽑기'; b5.disabled = true; b5.title = ''; }
    return;
  }
  bar.innerHTML = '남은 뽑기 <b>' + left + '회</b>' + (nextLv ? ' · 다음 뽑기 <b>Lv ' + nextLv + '</b>' : '') + ' · 이번 시즌 <b>'
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
  if(left == null){ _gachaUnknownStage(); return; }   // 받기 전 · 못 받음 — 풀(보유분)도 모르니 «컴플리트» · «남은 뽑기 없음» 을 말하지 않는다
  if(!pool.length){
    _gachaMsg(gachaSeasonParts().length
      ? '이번 시즌 컴플리트 — 티켓은 그대로 보관돼요.\n다음 시즌에 쓸 수 있어요.'
      : '아직 이 시즌에 가챠로 나오는 파츠가 없어요.');
    return;
  }
  if(!results || !results.length){
    if(left > 0) _gachaStageIdle();
    else { const nextLv = _nextLv(); _gachaMsg(nextLv ? '남은 뽑기가 없어요.\n레벨 ' + nextLv + '부터 1회가 생겨요.' : '남은 뽑기가 없어요.'); }
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
    if(_gachaLoad === 'failed') pullGacha(true);   // 못 받은 채로 열면 이번이 «다시 시도»(도감 열기와 같다) — 받는 동안 무대는 «불러오는 중»
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
    twNav.go(twNav.NAV.WARDROBE_ALBUM, { skipSync: true });   // 꾸미기 창을 «도감» 탭으로(이미 열려 있으면 탭만) — onAlbumShow 가 고른 파츠의 쪽으로 옮긴다
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
  startGacha,
  isGachaPart,                          // 꾸미기 창 · 카탈로그 · 라이선스 접기가 가챠 파츠를 거른다
  setPartEditor,                        // 🛠 관리자 등록 창을 건다(app.js)
  isGachaColorUnlocked,                 // 꾸미기 미리보기 색상 영역 — 🔒 게이트
  gachaCount,
  sceneHasColorGroup,                   // 관리자 파츠 등록 — 색 없는 파츠(rec.noColor) 판정
  DUPES_FOR_COLOR: GACHA_DUPES_FOR_COLOR,
  pullGacha,                            // 런처 복귀('launcher') · 계정 이어받기 — 서버에서 받기(notify=true 면 실패에 오류 번호)
  pruneUnownedGachaParts,               // 꾸미기 커밋 · 카탈로그 도착
  renderGachaInv,                       // 파츠 등록 · 썸네일 재생성 · 계정 연동 · 👑 달성표 보상 · 꾸미기 창 «도감» 탭
  onAlbumShow,                          // 꾸미기 창이 «도감» 탭을 보일 때(서버와 맞추기 · 고른 파츠 쪽으로)
  isInvOpen: _gachaInvOpen,
  isDrawOpen: _gachaDrawOpen,
  selId: ()=>_gachaSelId,               // 도감에서 지금 보고 있는 파츠 — 꾸미기 미리보기 색상 영역이 따라간다
  owned: ()=>gachaOwned,                // 계정 전환 검문 — «뽑은 파츠 N개»
  bonus: gachaBonusNow,                 // 👑 달성표 — 서버가 센 보너스 뽑기 수
  resetMemory: resetGacha,              // 로그아웃 지우기 — 메모리도 빈 기기 값으로
  /* 화면 없이 검사하는 셈 · 상태 — sim-gacha.js · sim-gacha-prune.js · sim-part-color-entry.js */
  draw: gachaDraw, pool: gachaPool, seasonNow: gachaSeasonNow, ticketsLeft: gachaTicketsLeft, ticketsEarned: gachaTicketsEarned, nextTicketLevel: gachaNextTicketLevel,
  closeGachaDraw,                       // 🪟 모두 닫기(win-stack closeAll — app.js 창 표) · 뽑기 창 ✕
  runDraw: _gachaRunDraw, renderGachaDraw,
  state: {
    load: ()=>_gachaLoad, page: ()=>_gachaPage, album: ()=>_gachaAlbum,
    setOwned(v){ gachaOwned = v; }, setUnlocked(v){ _gachaUnlocked = v; }, setSelId(v){ _gachaSelId = v; }, setAlbum(v){ _gachaAlbum = v; _gachaPage = 0; },
  },
};
}

const api = { createGacha };
if(typeof window !== 'undefined') window.TwGacha = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
