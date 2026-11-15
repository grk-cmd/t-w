/* account-store.js — 🗂️ 계정별 로컬 칸 (검사 sim-account-store.js)
   [왜] PC 한 칸(`tw.focusTodaySec` 등)에 계정 값을 두면 같은 PC 에서 계정을 바꿀 때 «지우기 / 넘기기» 둘 중 하나를 골라야 하고,
     고르다 틀리면 앞 계정 값이 다음 계정에 섞인다(#582). 0.13 부터 계정 데이터는 서버가 원본이라, PC 에 남는 값만 계정별 칸 `tw.u.<계정코드>.<이름>` 에 둔다.
     계정을 바꾸면 다른 칸이 열릴 뿐이라 지우기 · 넘기기 판단이 없다.
   [계정 코드] 부를 때마다 deps.getAccountCode() 로 읽는다(값으로 받으면 계정이 바뀐 뒤에도 옛 칸을 쓴다). 모양은 app.js _setMyUserId 와 같다.
   [로그인 전(코드 없음)] 읽기 null · 쓰기 false · 지우기 false — PC 공용 칸으로 돌려 쓰지 않는다(그게 섞임의 뿌리).
     로그인 전에는 남길 계정 값이 없다(초대 게이트 · 로그인 화면뿐). 쓰는 쪽은 false 를 «저장 안 됨» 으로 다룬다.
   [종류] ACCOUNT_KEYS(PREFIXES) 에 있는 이름만 받는다 — 기기 공용 값(DEVICE_KEYS)이나 모르는 이름은 던진다(잘못 쓴 코드를 조용히 넘기지 않는다).
   [옮긴 키] MOVED_KEYS 는 «PC 칸에서 계정 칸으로 이미 옮겨 읽는» 키다. migrateLegacy 는 이것만 옮긴다 — 아직 옛 칸을 읽는 키를 옮기면 값이 사라진다.
     각 묶음이 자기 키를 옮길 때 MOVED_KEYS 에 더한다(표는 shared/README.md).
   ⚠️ 새 이름은 `tw.` 로 시작한다(칸 이름에서는 앞 `tw.` 를 뗀다). 디스크 칸 이름이 바뀌면 이미 쓴 값이 안 보인다.
   classic script — window.TwAccountStore. 쓰는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const CELL_PREFIX = 'tw.u.';
const MIGRATED_KEY = 'tw.accountStoreMigrated';   // PC 칸 — 옛 칸에서 이미 처리한 키 이름 목록(JSON 배열)
const CODE_RE = /^u[0-9a-z]{8,40}$/i;              // app.js _setMyUserId 와 같은 모양

/* 기기 공용 — 이 PC 의 성질. 계정을 바꿔도 그대로 둔다(계정 칸에 넣지 않는다). */
const DEVICE_KEYS = Object.freeze([
  'tw.deviceId', 'tw.apiBaseUrl', 'tw.realtimeUrl', 'tw.remoteConfig', 'tw.glReloads', 'tw.renderQuality', 'tw.dotRender',
  'tw.figureMode', 'tw.officeMode', 'tw.deskPan', 'tw.focusCharScale', 'tw.chipHorz', 'tw.chipCollapsed',
  'tw.nameplate', 'tw.nameplateSize', 'tw.theme', 'tw.accent', 'tw.mockRoom', 'tw.updateNoticeDismissedTs',
  'tw.chatFontSize', 'tw.chatOpacity', 'tw.chatSfx', 'tw.chatSfxId', 'tw.listenMute', 'tw.listenVol',
  'tw.noise.fold', 'tw.noise.kind', 'tw.noise.others', 'tw.noise.vol', 'tw.pkBgmMuted', 'tw.gapSolo', 'tw.gapMulti',
  'tw.roomSeatMode', 'tw.focusLogMini', 'tw.annivAreaH', 'tw.adBanner', 'tw.thumbSigs',
  'tw.playlistVol', 'tw.playlistMini', 'tw.playlistLoop', 'tw.playlistLoopKind', 'tw.playlistLoopMode', 'tw.playlistLoopOn', 'tw.playlistPos',
  'tw_chat_win_pos', 'tw.bellWinPos', 'tw.gachaWinPos', 'tw.wdPreviewPos', 'tw.ideskInvPos',
  /* 신원 · 로그인 — 계정 코드를 정하는 쪽이라 계정 칸에 둘 수 없다(닭과 달걀). */
  'tw.myUserId', 'tw.loginEmail', 'tw.loginAuthUid', 'tw.myFriendCode', 'tw.myFriendCodePrev', 'tw.myPrevUserIds',
  'tw.invitePassed', 'tw.inviteToken', 'tw.signupPending', 'tw.licenseKey', 'tw.licenseOptOut', 'tw.licenseReqId',
  /* 0.13 첫 실행 — 옛 캐릭터를 이 PC 에서 이 계정으로 올렸다는 표시(값 = 계정 코드). 계정 칸이 열리기 전에 읽는 단계라 기기 공용 칸이다 */
  'tw.legacyCloset013',
  /* 이 PC 의 성질이거나 계정 코드를 정하기 전에 읽는 값 — 효과음 켜기(기기 설정) · 0.13 첫 실행을 끝낸 계정 코드 · 서버 확인 답 사본 · 그래픽 복구 시각 · 옛 값 옮기기 기록 */
  'tw.demojiSfx', 'tw.firstRun013', 'tw.me', 'tw.glRelaunchAt', 'tw.accountStoreMigrated',
]);

/* 계정별 — 그 사람의 기록 · 고른 것 · 보관 · 캐시. 아직 옛 PC 칸을 읽는 것도 포함(표 · 옮길 묶음은 shared/README.md). */
const ACCOUNT_KEYS = Object.freeze([
  /* 이번 PR 이 옮긴 것 */
  'tw.focusTodaySec', 'tw.focusTodayDate', 'tw.advZ.v2', 'tw.advZ.v1',
  /* 포커스 — 서버에 아직 못 올린 집중 시간(초). 레벨 · 누적은 서버 값이라 이 PC 에 두지 않는다(옛 tw.focusTotalSec · tw.focusSyncedSec · tw.starColor · 해금 안내 기록은 첫 실행이 지운다) */
  'tw.focusPendingSec',
  /* 달성표 — 오늘 진행(서버에 없는 이 PC 사실). 목표 · 기록 · 보상은 서버 한 벌이라 두지 않는다(옛 tw.chal 은 첫 실행이 오늘 진행만 옮기고 지운다) */
  /* 옮길 묶음 몫 */
  'tw.focusShow', 'tw.pomo', 'tw.pomoRun',
  'tw.bonkDay', 'tw.chalToday',
  'tw.curSlot', 'tw.extraSeatSlots', 'tw.roomFaceUrls', 'tw.slotGlbUrls',
  'tw.savedDesks', 'tw.savedItems', 'tw.savedParts', 'tw.decoParts', 'tw.deskPresets', 'tw.animalPresets', 'tw.animalEverUnlocked',
  'tw.animalCheatUnlock', 'tw.charColorHistory', 'tw.seatEq', 'tw.activeInteractionDesk', 'tw.emojiReactions',
  /* 플레이리스트 목록 · 한마디 · 공개는 서버가 원본이다(D10) — 이 PC 에는 «지금 고른 목록 번호» 와 시크릿룸 음악만 둔다(옛 목록 이름들은 첫 실행이 지운다) */
  'tw.playlistCur', 'tw.secretRoomMusic', 'tw.annivView',
  'tw.userName', 'tw.customStatus', 'tw.userStatus', 'tw.awayKind', 'tw.awayImg', 'tw.awaySz', 'tw.myAdBannerImg',
  'tw.inboxBcRead', 'tw.bellSeenTs', 'tw.reportHidden', 'tw.mobileKey',
]);
/* 이름 뒤에 방 · 친구 · 종류가 붙는 키 */
const ACCOUNT_KEY_PREFIXES = Object.freeze([
  'tw.mhRecentColors.', 'tw.mhGbLastRead:', 'tw.chatTab.', 'tw.dailyPlay.', 'tw_chat_read:', 'tw_chat_join:',
]);

/* 이미 계정 칸에서 읽고 쓰는 키 — migrateLegacy 가 PC 칸에서 옮기는 대상. */
const MOVED_KEYS = Object.freeze(['tw.focusTodaySec', 'tw.focusTodayDate', 'tw.pomo', 'tw.pomoRun', 'tw.mobileKey', 'tw.advZ.v2', 'tw.advZ.v1',
  'tw.userStatus', 'tw.customStatus', 'tw.awayKind', 'tw.reportHidden',
  'tw.curSlot', 'tw.extraSeatSlots', 'tw.decoParts', 'tw.seatEq', 'tw.emojiReactions',   // S-4a — 만들 때 읽던 보기 설정 깃발(launcher/user-local.js 가 확인 뒤 읽는다)
  'tw.charColorHistory', 'tw.activeInteractionDesk',
  'tw.myAdBannerImg', 'tw.secretRoomMusic', 'tw.annivView',
  'tw.deskPresets', 'tw.animalPresets']);
/* 접두로 이미 계정 칸에서 읽고 쓰는 키 — migrateLegacy 가 PC 칸을 훑어 접두가 맞는 이름마다 옮긴다(최근 색 · 방명록 읽음 시각 · 채팅 탭 · 읽음 표시 · 입장 표시).
   ⚠️ ACCOUNT_KEY_PREFIXES 의 부분집합 — 서버가 세는 `tw.dailyPlay.` 는 옮기지 않는다. */
const MOVED_KEY_PREFIXES = Object.freeze(['tw.mhRecentColors.', 'tw.mhGbLastRead:', 'tw.chatTab.', 'tw_chat_read:', 'tw_chat_join:']);

function isAccountKey(key){
  if(typeof key !== 'string' || !key) return false;
  return ACCOUNT_KEYS.includes(key) || ACCOUNT_KEY_PREFIXES.some(p => key.startsWith(p) && key.length > p.length);
}
function validCode(code){ return typeof code === 'string' && CODE_RE.test(code); }
function cellName(code, key){ return CELL_PREFIX + code + '.' + key.replace(/^tw\./, ''); }

/** @param {{ storage: Storage, getAccountCode: () => (string|null), isWriteLocked: () => boolean }} deps */
function createAccountStore(deps){
  const storage = deps.storage;
  const getAccountCode = deps.getAccountCode;
  const isWriteLocked = deps.isWriteLocked;   // 계정을 놓은 틈(코드가 바뀌었는데 앱은 재시작 전)에는 쓰기를 거절한다

  /* 🔓 열림 — 서버가 계정을 확인해 준 뒤(launcher/app-boot.js begin, 옛 값 옮기기 직후)에만 열린다. 처음엔 닫힘:
     읽기 null · 쓰기 거절 + 키마다 한 번 경고. 확인 전에 먼저 쓴 값이 옛 PC 값 옮기기를 «kept» 로 막고 옛 값을 지우던 일을 장치로 막는다.
     닫힘의 결과는 isWriteLocked(계정을 놓은 틈)와 같다. 로그아웃의 지우기는 이 틈에서 isWriteLocked 가 거절한다. */
  let opened = null;   // 열린 계정 코드 — 열린 뒤 계정 코드가 바뀌면(앱은 다시 켜야 한다) 닫힘으로 돌아간다
  const warned = new Set();
  function open(code){
    if(!validCode(code) || code !== getAccountCode()){
      console.warn('[계정 칸] 열지 않았다 — 열려는 코드와 지금 계정 코드가 다르거나 모양이 틀리다');
      return false;
    }
    opened = code;
    return true;
  }
  /* 로그인 세션이 끝날 때(shared/session.js dispose) 닫는다 — 다시 열기 전까지 읽기 null · 쓰기 거절. 안 열려 있으면 아무 일 없음 */
  function close(){ opened = null; }
  function cellOf(key){
    if(!isAccountKey(key)) throw new Error('[계정 칸] 계정별 키가 아니다 — ' + key);
    const code = getAccountCode();
    return validCode(code) ? cellName(code, key) : null;
  }
  function closedFor(key){
    if(opened !== null && opened === getAccountCode()) return false;
    if(!warned.has(key)){ warned.add(key); console.warn('[계정 칸] 계정 확인 전 접근', key); }
    return true;
  }
  function get(key){
    const cell = cellOf(key);
    if(!cell || closedFor(key)) return null;
    try{ return storage.getItem(cell); }catch(_){ return null; }
  }
  /* 쓰기 거절 판단은 이 한 곳 — set · remove 가 본다. */
  function set(key, value){
    const cell = cellOf(key);
    if(!cell || closedFor(key) || isWriteLocked()) return false;
    try{ storage.setItem(cell, String(value)); return true; }catch(_){ return false; }
  }
  function remove(key){
    const cell = cellOf(key);
    if(!cell || closedFor(key) || isWriteLocked()) return false;
    try{ storage.removeItem(cell); return true; }catch(_){ return false; }
  }

  /* Storage 모양(getItem · setItem · removeItem)으로 보여 준다 — 저장소를 값으로 받는 모듈용(JSON 칸 json-store.js · 방명록 읽음 시각).
     닫혀 있으면 읽기 null · 쓰기는 던진다(진짜 Storage 가 못 쓸 때 던지는 것과 같게 — 받는 쪽이 «저장 못 함» 을 안다). 계정별 키가 아니면 get · set 처럼 던진다. */
  function asStorage(){
    const refused = (k) => { const e = new Error('[계정 칸] 쓰지 못했다 — ' + k); e.name = 'AccountStoreRefused'; return e; };
    return { getItem: (k) => get(k), setItem: (k, v) => { if(!set(k, v)) throw refused(k); }, removeItem: (k) => { if(!remove(k)) throw refused(k); } };
  }
  function readMigrated(){
    try{ const a = JSON.parse(storage.getItem(MIGRATED_KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(_){ return []; }
  }
  /* 옛 PC 칸의 MOVED_KEYS 값을 `code` 계정 칸으로 한 번 옮긴다(첫 실행 순서 — 로그인한 계정 코드가 정해진 뒤 불린다).
     · 계정 칸에 이미 값이 있으면 덮지 않는다. 처리한 키는 PC 칸에서 지우고 «처리함» 목록에 올려 두 번 돌지 않는다.
     · 처리함 목록은 PC 칸 하나 — 나중 판이 MOVED_KEYS 에 키를 더하면 그 키만 새로 옮긴다.
     · 코드가 없거나 모양 밖이면 아무것도 하지 않는다(PC 칸 그대로).
     · MOVED_KEY_PREFIXES 는 PC 칸을 훑어 접두가 맞는 이름마다 같은 규칙으로 옮긴다. 한 이름이라도 못 옮겼으면 그 접두는 «처리함» 에 올리지 않아 다음에 남은 것만 다시 옮긴다.
     @return {{ moved: string[], kept: string[], skipped: string|null }} moved = 옮김 · kept = 계정 칸 값이 있어 덮지 않음 */
  function migrateLegacy(code){
    const res = { moved: [], kept: [], skipped: null };
    if(!validCode(code)){ res.skipped = 'no-code'; return res; }
    const done = readMigrated();
    const todo = MOVED_KEYS.filter(k => !done.includes(k));
    const todoPrefixes = MOVED_KEY_PREFIXES.filter(p => !done.includes(p));
    if(!todo.length && !todoPrefixes.length){ res.skipped = 'already'; return res; }
    const handled = [];
    /* 이름 하나를 옮긴다 — true = 끝냄(옮겼거나 계정 칸에 값이 있어 안 덮음 · PC 칸에 없음) · false = 저장소를 못 읽거나 못 써서 다음에 다시 */
    const moveOne = (k) => {
      let old = null;
      try{ old = storage.getItem(k); }catch(_){ return false; }   // 저장소를 못 읽으면 이 키는 다음에 다시
      if(old === null) return true;
      const cell = cellName(code, k);
      let have = null;
      try{ have = storage.getItem(cell); }catch(_){ return false; }
      if(have !== null) res.kept.push(k);
      else{
        try{ storage.setItem(cell, old); }catch(_){ return false; }   // 못 쓰면 옛 칸을 지우지 않고 다음에 다시
        res.moved.push(k);
      }
      try{ storage.removeItem(k); }catch(_){}
      return true;
    };
    for(const k of todo) if(moveOne(k)) handled.push(k);
    for(const p of todoPrefixes){
      let names = null;
      try{
        names = [];
        for(let i = 0; i < storage.length; i++){ const k = storage.key(i); if(typeof k === 'string' && k.length > p.length && k.startsWith(p)) names.push(k); }   // 옮기며 지우면 번호가 밀리므로 이름부터 모은다
      }catch(_){ names = null; }
      if(names === null) continue;   // 저장소를 훑지 못하면 이 접두는 다음에 다시
      let all = true;
      for(const k of names) if(!moveOne(k)) all = false;
      if(all) handled.push(p);
    }
    try{ storage.setItem(MIGRATED_KEY, JSON.stringify(done.concat(handled))); }catch(_){}
    return res;
  }

  return { get, set, remove, open, close, migrateLegacy, asStorage };
}

const api = { CELL_PREFIX, MIGRATED_KEY, DEVICE_KEYS, ACCOUNT_KEYS, ACCOUNT_KEY_PREFIXES, MOVED_KEYS, MOVED_KEY_PREFIXES, isAccountKey, cellName, createAccountStore };
if(typeof window !== 'undefined') window.TwAccountStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
