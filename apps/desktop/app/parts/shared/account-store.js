/* account-store.js — 🗂️ 계정별 로컬 칸 (검사 sim-account-store.js)
   [왜] PC 한 칸(`tw.focusTotalSec` 등)에 계정 값을 두면 같은 PC 에서 계정을 바꿀 때 «지우기 / 넘기기» 둘 중 하나를 골라야 하고,
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
]);

/* 계정별 — 그 사람의 기록 · 고른 것 · 보관 · 캐시. 아직 옛 PC 칸을 읽는 것도 포함(표 · 옮길 묶음은 shared/README.md). */
const ACCOUNT_KEYS = Object.freeze([
  /* 이번 PR 이 옮긴 것 */
  'tw.focusTotalSec', 'tw.focusTodaySec', 'tw.focusTodayDate', 'tw.focusSyncedSec', 'tw.advZ.v2', 'tw.advZ.v1',
  /* 옮길 묶음 몫 */
  'tw.focusShow', 'tw.danceNotified', 'tw.danceNotifiedFix', 'tw.ideskNotified', 'tw.starColor', 'tw.pomo', 'tw.pomoRun',
  'tw.bonkDay', 'tw.chal', 'tw.gachaOwned', 'tw.gachaOwnedTs', 'tw.gachaBonus',
  'tw.curSlot', 'tw.extraSeatSlots', 'tw.roomFaceUrls', 'tw.slotGlbUrls', 'tw.charsLinked', 'tw.charsMoveFails',
  'deskFriends.slots.v1', 'deskFriends.slots.ts', 'deskFriends.slots.seen', 'deskFriends.slots.loss', 'deskFriends.slots.lastsync',
  'deskFriends.slots.pushfail', 'deskFriends.slots.bak', 'deskFriends.slots.bak.meta',
  'deskFriends.chars.v1', 'deskFriends.chars.desk', 'deskFriends.chars.trashPend',
  'tw.savedDesks', 'tw.savedItems', 'tw.savedParts', 'tw.decoParts', 'tw.deskPresets', 'tw.animalPresets', 'tw.animalEverUnlocked',
  'tw.animalCheatUnlock', 'tw.charColorHistory', 'tw.seatEq', 'tw.activeInteractionDesk', 'tw.emojiReactions',
  'tw.playlist', 'tw.playlistSets', 'tw.playlistCur', 'tw.playlistTitle', 'tw.playlistBio', 'tw.playlistHomePublic', 'tw.playlistPrivate',
  'tw.playlistEditTs', 'tw.playlistBackup', 'tw.secretRoomMusic',
  'tw.userName', 'tw.customStatus', 'tw.userStatus', 'tw.awayKind', 'tw.awayImg', 'tw.awaySz', 'tw.myAdBannerImg',
  'tw.bookmarks', 'tw.mallangGiftHidden', 'tw.inboxBcRead', 'tw.bellSeenTs', 'tw.reportHidden', 'tw.mobileKey',
]);
/* 이름 뒤에 방 · 친구 · 종류가 붙는 키 */
const ACCOUNT_KEY_PREFIXES = Object.freeze([
  'tw.mhRecentColors.', 'tw.mhGbLastRead:', 'tw.mallang.', 'tw.chatTab.', 'tw.dailyPlay.', 'tw_chat_read:', 'tw_chat_join:',
]);

/* 이미 계정 칸에서 읽고 쓰는 키 — migrateLegacy 가 PC 칸에서 옮기는 대상. */
const MOVED_KEYS = Object.freeze(['tw.focusTotalSec', 'tw.focusTodaySec', 'tw.focusTodayDate', 'tw.focusSyncedSec', 'tw.advZ.v2', 'tw.advZ.v1']);

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
  let opened = false;
  const warned = new Set();
  function open(code){
    if(!validCode(code) || code !== getAccountCode()){
      console.warn('[계정 칸] 열지 않았다 — 열려는 코드와 지금 계정 코드가 다르거나 모양이 틀리다');
      return false;
    }
    opened = true;
    return true;
  }
  function cellOf(key){
    if(!isAccountKey(key)) throw new Error('[계정 칸] 계정별 키가 아니다 — ' + key);
    const code = getAccountCode();
    return validCode(code) ? cellName(code, key) : null;
  }
  function closedFor(key){
    if(opened) return false;
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

  function readMigrated(){
    try{ const a = JSON.parse(storage.getItem(MIGRATED_KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(_){ return []; }
  }
  /* 옛 PC 칸의 MOVED_KEYS 값을 `code` 계정 칸으로 한 번 옮긴다(첫 실행 순서 — 로그인한 계정 코드가 정해진 뒤 불린다).
     · 계정 칸에 이미 값이 있으면 덮지 않는다. 처리한 키는 PC 칸에서 지우고 «처리함» 목록에 올려 두 번 돌지 않는다.
     · 처리함 목록은 PC 칸 하나 — 나중 판이 MOVED_KEYS 에 키를 더하면 그 키만 새로 옮긴다.
     · 코드가 없거나 모양 밖이면 아무것도 하지 않는다(PC 칸 그대로).
     @return {{ moved: string[], kept: string[], skipped: string|null }} moved = 옮김 · kept = 계정 칸 값이 있어 덮지 않음 */
  function migrateLegacy(code){
    const res = { moved: [], kept: [], skipped: null };
    if(!validCode(code)){ res.skipped = 'no-code'; return res; }
    const done = readMigrated();
    const todo = MOVED_KEYS.filter(k => !done.includes(k));
    if(!todo.length){ res.skipped = 'already'; return res; }
    const handled = [];
    for(const k of todo){
      let old = null;
      try{ old = storage.getItem(k); }catch(_){ continue; }   // 저장소를 못 읽으면 이 키는 다음에 다시
      if(old !== null){
        const cell = cellName(code, k);
        let have = null;
        try{ have = storage.getItem(cell); }catch(_){ continue; }
        if(have !== null) res.kept.push(k);
        else{
          try{ storage.setItem(cell, old); }catch(_){ continue; }   // 못 쓰면 옛 칸을 지우지 않고 다음에 다시
          res.moved.push(k);
        }
        try{ storage.removeItem(k); }catch(_){}
      }
      handled.push(k);
    }
    try{ storage.setItem(MIGRATED_KEY, JSON.stringify(done.concat(handled))); }catch(_){}
    return res;
  }

  return { get, set, remove, open, migrateLegacy };
}

const api = { CELL_PREFIX, MIGRATED_KEY, DEVICE_KEYS, ACCOUNT_KEYS, ACCOUNT_KEY_PREFIXES, MOVED_KEYS, isAccountKey, createAccountStore };
if(typeof window !== 'undefined') window.TwAccountStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
