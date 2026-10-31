/* focus-level.js — ⭐ 포커스 레벨 · 공유 · 태블릿
   app.js 의 포커스 레벨 · 공유 · 태블릿 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 26번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 26줄 —
     _acctDetached · _focusSessionSec · _focusTodaySec · _focusTotalSec · _myInbox · _myInboxReady · appMode · wdDraftDef 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setFocusSessionSec · setFocusTodaySec · setFocusTotalSec(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 7개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DANCE_NOTIFIED_KEY · DANCE_REPAIR_KEY · FOCUS_SYNCED_KEY · STAR_PALETTE · _adoptStarColorFromProfile · _getFocusSyncedMark · _hasFocusSyncedMark · _mobileBubbleText · _mobileCleanApp · _mobileOn · _mobileRoomLabel · _mobileStart · _notifyDanceUnlocks · _pushLevelIfChanged · _seatMobileApp · addFocusSeconds · focusCycleOf · formatHMS · getFocusLevel · getStarColor · lvStarStr · myFocusShow · myStarOut · myStarProfileOut · setStarColor · starFromRemote · syncFocusTotalToServer — app.js 는 focusLevelMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFocusLevel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-focus-level.js */
(function(){

function createFocusLevel(deps){
const DANCE_MOVES = deps.DANCE_MOVES;
const FOCUS_CYCLE_CAP = deps.FOCUS_CYCLE_CAP;
const FOCUS_CYCLE_SEC = deps.FOCUS_CYCLE_SEC;
const FOCUS_LEVEL_CAP_HOURS = deps.FOCUS_LEVEL_CAP_HOURS;
const FOCUS_TODAY_DATE_KEY = deps.FOCUS_TODAY_DATE_KEY;
const FOCUS_TODAY_SEC_KEY = deps.FOCUS_TODAY_SEC_KEY;
const FOCUS_TOTAL_CAP_SEC = deps.FOCUS_TOTAL_CAP_SEC;
const FOCUS_TOTAL_KEY = deps.FOCUS_TOTAL_KEY;
const IDESK_ENABLED = deps.IDESK_ENABLED;
const INTERACTION_DESKS = deps.INTERACTION_DESKS;
const Presence = deps.Presence;
const _acctDetached = deps._acctDetached;   // 읽는 함수
const focusLevelStore = deps.focusLevelStore;   // 🗂️ 누적 · 마크는 계정별 칸(shared/account-store.js)
const _totalSyncedFns = [];
function onTotalSynced(fn){ _totalSyncedFns.push(fn); }
const _focusDayStr = deps._focusDayStr;
const _focusSessionSec = deps._focusSessionSec;   // 읽는 함수
const _focusTodaySec = deps._focusTodaySec;   // 읽는 함수
const _focusTotalSec = deps._focusTotalSec;   // 읽는 함수
const _myInbox = deps._myInbox;   // 읽는 함수
const _myInboxReady = deps._myInboxReady;   // 읽는 함수
const appMode = deps.appMode;   // 읽는 함수
const findMySeat = deps.findMySeat;
const getDisplayName = deps.getDisplayName;
const getMyLoginEmail = deps.getMyLoginEmail;
const getMyUserId = deps.getMyUserId;
const mobileDiag = deps.mobileDiag;
const renderLauncher = deps.renderLauncher;
const toast = deps.toast;
const wdDraftDef = deps.wdDraftDef;   // 읽는 함수
const setFocusSessionSec = deps.setFocusSessionSec;   // 쓰는 함수
const setFocusTodaySec = deps.setFocusTodaySec;   // 쓰는 함수
const setFocusTotalSec = deps.setFocusTotalSec;   // 쓰는 함수
/* 레벨이 바뀐 순간에만 프로필을 갱신한다(친구 목록 레벨 배지용).
   매초 쓰면 비용이 커지므로, 값이 실제로 달라졌을 때만 1회 쓴다. */
let _lastPushedLevel = 0, _lastPushedStar = '';
function _pushLevelIfChanged(){
  try{
    const lv = getFocusLevel();
    /* 🌟 회차에서는 해금 레벨이 999 에 머문다 — 그래도 이번 바퀴 레벨·회차·색이 바뀌면 프로필을 다시 쓴다(개정 70).
       ★ 해금 알림은 해금 레벨이 바뀔 때만(예전 그대로). */
    const so = myStarProfileOut(), sk = so.cyc + '|' + so.clv + '|' + so.starC;
    if(lv === _lastPushedLevel && sk === _lastPushedStar) return;
    const lvChanged = lv !== _lastPushedLevel;
    _lastPushedLevel = lv; _lastPushedStar = sk;
    if(getMyUserId() && window.firebaseAPI && firebaseAPI.setMyProfile)   // 내 코드가 없으면 보내지 않는다(규칙이 거부)
      Promise.resolve(firebaseAPI.setMyProfile(getMyUserId(), getDisplayName(), lv, so)).catch(e => console.warn('[레벨] 프로필 서버 반영 실패', (e && e.code) || e));   // async 라 바깥 try 는 거부를 못 받는다
    if(!lvChanged) return;
    _notifyDeskUnlocks(lv);   // 🪑 이 레벨에서 새로 해금된 상호작용 책상이 있으면 수령함 알림
    _notifyDanceUnlocks(lv);  // 💃 이 레벨에서 새로 해금된 춤 명령이 있으면 수령함 알림
  }catch(_){}
}
/* 💃 레벨 달성으로 새로 해금된 춤 명령을 수령함에 알림(중복 방지).
   ★ **보낸 것이 확인된 뒤에 표시를 남긴다.** 예전에는 보내기를 걸자마자(성공 여부와 무관하게,
     심지어 firebaseAPI 가 아직 없어도) '알림 완료'로 찍어 저장했다. 그래서 레벨이 올라간 순간이
     하필 로그인 전이거나 쓰기가 거부된 때였으면 그 춤은 **영영 다시 안내되지 않았다** —
     화면에는 아무것도 안 뜨는데 localStorage 에는 이미 보낸 것으로 남는다.
     규칙 거부는 조용히 멎으므로(핸드오프 3절) 이 구조에서는 원인도 안 보인다.
   ★ 못 보내는 상황이면 아무것도 기록하지 않고 그냥 넘긴다. 레벨은 그대로이므로 다음 기회
     (다음 집중 누적·서버 동기화·다음 부팅)에 같은 자리에서 다시 시도한다.
   ★ _dancePending 은 한 세션 안에서 같은 춤을 여러 번 보내지 않기 위한 자물쇠다(비동기라 필요하다). */
const DANCE_NOTIFIED_KEY = 'tw.danceNotified';
/* 🩹 '보냈다고 적혀 있는데 실제로는 없던' 안내를 다시 보낸 기록 — 명령당 한 번만 구제한다.
   ⚠️ 이게 없으면 우편을 **직접 지운 사람**에게 매 부팅마다 같은 안내가 다시 간다. */
const DANCE_REPAIR_KEY = 'tw.danceNotifiedFix';
const _dancePending = new Set();
function _danceNotifiedSet(){ try{ return new Set(JSON.parse(localStorage.getItem(DANCE_NOTIFIED_KEY)||'[]')); }catch(_){ return new Set(); } }
function _danceRepairSet(){ try{ return new Set(JSON.parse(localStorage.getItem(DANCE_REPAIR_KEY)||'[]')); }catch(_){ return new Set(); } }
function _markDanceNotified(cmd){
  try{
    const done = _danceNotifiedSet();
    if(!done.has(cmd)){
      done.add(cmd);
      localStorage.setItem(DANCE_NOTIFIED_KEY, JSON.stringify([...done]));
    }
    const fixed = _danceRepairSet();
    if(!fixed.has(cmd)){
      fixed.add(cmd);
      localStorage.setItem(DANCE_REPAIR_KEY, JSON.stringify([...fixed]));
    }
  }catch(_){}
}
/* 📩 이 춤의 해금 안내가 **수령함에 실제로 있는가.**
   ★ 로컬 기록(localStorage)이 아니라 수령함이 진짜다. 기록은 "보냈다고 생각한다" 일 뿐이고,
     예전 코드가 보내기 전에 찍어 둔 거짓 기록이 남아 있을 수 있다(Lv.150 을 넘겼는데 안내가
     영영 안 오던 그 증상이 이것이다).
   ⚠️ 본문에 적히는 `'/150'` 을 찾는다 — 제목만 보면 다른 춤의 안내와 구분이 안 된다. */
function _danceMailExists(def){
  try{
    const box = (typeof _myInbox() === 'object' && _myInbox()) || {};
    return Object.keys(box).some(id=>{
      const m = box[id] || {};
      return m.tag === 'reward'
          && String(m.title || '').indexOf('새 춤 해금') >= 0
          && String(m.body  || '').indexOf("'/" + def.cmd + "'") >= 0;
    });
  }catch(_){ return false; }
}
/* 이 춤을 지금 안내해야 하는가 — 레벨과 기록만 본다(보낼 수 있는지는 별개 질문이다).
   ★ 관리자 해금(isDanceUnlocked)은 여기서 보지 않는다. 관리자는 레벨과 무관하게 다 쓸 수 있지만
     '달성 보상'은 실제로 레벨을 찍었을 때만 간다 — 안 그러면 Lv.1 관리자에게 축하 우편이 온다. */
function _danceUnlockPending(lv){
  const done = _danceNotifiedSet(), fixed = _danceRepairSet();
  return DANCE_MOVES.filter(def=>{
    if(lv < (def.reqLevel||1)) return false;
    if(!done.has(def.cmd)){
      /* 아직 안 보낸 것 — 평소 경로. 단 **수령함에 이미 있으면** 보낸 것이다.
         [2026-09-16 제보 4] 로그아웃이 이 기록(tw.danceNotified)을 지우게 됐다 — 남기면 다음 사람이
           그 레벨의 안내를 영영 못 받는다. 지우는 대신 여기서 수령함을 한 번 본다: 같은 계정이 돌아오면
           우편이 이미 있으므로 다시 안 가고, 새 계정이면 없으므로 간다.
         ⚠️ 수령함이 아직 안 왔으면 예전처럼 보낸다 — 못 받는 쪽이 한 번 더 받는 쪽보다 나쁘다. */
      if(_myInboxReady() && _danceMailExists(def)){ _markDanceNotified(def.cmd); return false; }
      return true;
    }
    /* 🩹 구제 — 기록은 '보냄'인데 수령함에 없다. 수령함이 **도착한 뒤에만** 판단한다
       (아직 안 왔으면 빈 객체라 전부 없는 것으로 보여 중복 발송이 된다).
       명령당 한 번만 구제하므로, 우편을 직접 지운 사람에게 반복해서 가지 않는다. */
    if(!_myInboxReady() || fixed.has(def.cmd)) return false;
    return !_danceMailExists(def);
  });
}
function _notifyDanceUnlocks(lv){
  try{
    const api = window.firebaseAPI;
    if(!(api && api.sendInboxMessage)) return;      // ★ 지금은 못 보낸다 — 표시도 남기지 않는다
    _danceUnlockPending(lv).forEach(def=>{
      if(_dancePending.has(def.cmd)) return;
      _dancePending.add(def.cmd);
      Promise.resolve(
        api.sendInboxMessage(getMyUserId(), 'reward',
          '💃 새 춤 해금!',
          `Lv.${def.reqLevel} 달성! 투게더룸 채팅에 '/${def.cmd}'를 입력하면 '${def.name}' 춤을 춰요. 워킹룸에서는 춤추기 버튼으로도 나와요.`
        )
      ).then(r=>{
        if(r && r.ok === false) return;             // 서버가 거부 — 기록하지 않는다(다음에 다시 시도)
        _markDanceNotified(def.cmd);
        toast('💃 새 춤 해금! 채팅에 /'+def.cmd);
      }).catch(()=>{})
        .then(()=>{ _dancePending.delete(def.cmd); });
    });
  }catch(_){}
}
/* 🪑 레벨 달성으로 새로 해금된 상호작용 책상을 수령함에 알림.
   중복 방지: 이미 알린 책상 id를 localStorage에 기록. 알림엔 "I키로 확인" 안내만(코드 없음). */
const IDESK_NOTIFIED_KEY = 'tw.ideskNotified';
function _ideskNotifiedSet(){ try{ return new Set(JSON.parse(localStorage.getItem(IDESK_NOTIFIED_KEY)||'[]')); }catch(_){ return new Set(); } }
function _notifyDeskUnlocks(lv){
  try{
    if(typeof IDESK_ENABLED!=='undefined' && !IDESK_ENABLED) return;   // ⏸️ 기능 비활성화 중엔 해금 알림도 보내지 않음
    const done = _ideskNotifiedSet();
    let changed = false;
    INTERACTION_DESKS.forEach(def=>{
      if(lv >= (def.reqLevel||1) && !done.has(def.id)){
        done.add(def.id); changed = true;
        if(window.firebaseAPI && firebaseAPI.sendInboxMessage){
          firebaseAPI.sendInboxMessage(getMyUserId(), 'reward',
            '🔓 새 책상 해금!',
            `Lv.${def.reqLevel} 달성으로 '${def.name}'이(가) 열렸어요. I키를 눌러 확인해보세요!`
          ).catch(()=>{});
        }
        toast('🔓 새 책상 해금! I키로 확인하세요');
      }
    });
    if(changed){ try{ localStorage.setItem(IDESK_NOTIFIED_KEY, JSON.stringify([...done])); }catch(_){} }
  }catch(_){}
}
function addFocusSeconds(sec){
  if(!(sec>0)) return;
  const capSec=FOCUS_TOTAL_CAP_SEC;   // ★ 레벨 상한이 아니라 **누적 상한**이다(999시간 → 100회차)
  if(_focusTotalSec()<capSec) setFocusTotalSec(Math.min(capSec,_focusTotalSec()+sec));   // 99,900시간에서 멈춤
  if(focusLevelStore.get(FOCUS_TODAY_DATE_KEY)!==_focusDayStr()) setFocusTodaySec(0);   // 오전 6시 넘겼으면 오늘치 리셋 후 이어 누적
  setFocusTodaySec(_focusTodaySec() + (sec));
  setFocusSessionSec(_focusSessionSec() + (sec));
  _pushLevelIfChanged();   // 레벨이 올랐을 때만 프로필 갱신(친구 목록 배지용)
  try{
    focusLevelStore.set(FOCUS_TOTAL_KEY,String(_focusTotalSec()));
    focusLevelStore.set(FOCUS_TODAY_SEC_KEY,String(_focusTodaySec()));
    focusLevelStore.set(FOCUS_TODAY_DATE_KEY,_focusDayStr());
  }catch(e){}
}
/* ★ 해금 레벨 — **레벨 상한(999)에서 멈춘다.** 회차가 돼도 모듈로로 접지 않는다(개정 70 · 아래 myFocusShow 주석).
   화면에 보이는 «이번 바퀴» 레벨과 별은 myFocusShow() 가 따로 낸다. */
function getFocusLevel(){ return Math.min(FOCUS_LEVEL_CAP_HOURS, 1+Math.floor(_focusTotalSec()/3600)); }
/* 🌟 회차 별 — 재료 (시안 v2 확정 · 2026-09-23 · CHECKS 개정 69) ──────────────────────────
   [내 정보] «별 색» 구획(_miRenderStar)이 쓰는 것만 먼저 둔다. 실제 좌석·배지에 별을 붙이는 일은 아직이다 —
   그건 getFocusLevel 을 모듈로로 바꾸는 일과 **한 번에** 한다(위 주석 · sim-focus-cap 4절 · handoff §6).
   ★ 회차는 저장하지 않는다. 누적초에서 파생한다(focusCycleOf) — 서버 병합이 단조 증가라 저장하면 어긋날 자리가 생긴다.
   ★ 색은 밝은 톤 16종만 받는다(handoff §3: 별은 검은 외곽선 위, 바는 6px 홈이라 어두운 색은 둘 다 먹힌다).
     목록에 없는 값이 저장돼 있으면(손으로 고쳤거나 옛 판) 첫 색(금)으로 떨어진다 — 자유 색상을 받는 길은 없다.
   ★ [개정 71] 색이 계정을 따라간다 — 원본은 이 기기 localStorage(tw.starColor), 서버 사본은 프로필 starC.
     · 이 기기에 고른 값이 없으면(새 기기 · 로그아웃 뒤) 프로필 starC 를 받아 온다(_adoptStarColorFromProfile).
     · 고른 값이 없는 동안 프로필을 쓰면 starC 를 **비워 보내고**, firebase-init 이 서버의 기존 starC 를 지킨다
       (myStarProfileOut · setMyProfile). 그래서 받아 오기 전에 프로필이 먼저 써져도 금색으로 덮이지 않는다.
     · 돌아올 길이 생겼으므로 ACCOUNT_LOCAL_KEYS 에 넣었다(로그아웃하면 지운다). */
const STAR_COLOR_KEY = 'tw.starColor';
const STAR_PALETTE = [
  ['#ffd76a','금'],   ['#ffe066','레몬'],  ['#ffb86b','살구'], ['#ff9f43','주황'],
  ['#ff8a8a','산호'], ['#ffa3c4','벚꽃'],  ['#ff7ad0','분홍'], ['#e39cff','라일락'],
  ['#c9a0ff','라벤더'], ['#a3adff','달빛'], ['#8fc8ff','하늘'], ['#7fe0f0','물빛'],
  ['#5ff0e4','청록'], ['#6ef0a0','민트'],  ['#b6f36a','연두'], ['#eef3ff','은빛'],
];
function _starColorOk(c){ return STAR_PALETTE.some(p => p[0] === c); }
function getStarColor(){
  let v = null; try{ v = localStorage.getItem(STAR_COLOR_KEY); }catch(_){}
  return _starColorOk(v) ? v : STAR_PALETTE[0][0];
}
/* 이 기기에서 고른(또는 받아 온) 값이 있는가 — 없으면 getStarColor() 는 기본(금)을 돌려준다. */
function _starPicked(){
  let v = null; try{ v = localStorage.getItem(STAR_COLOR_KEY); }catch(_){}
  return _starColorOk(v) ? v : null;
}
function setStarColor(c){
  if(!_starColorOk(c)) return false;
  try{ localStorage.setItem(STAR_COLOR_KEY, c); }catch(_){ return false; }
  return true;
}
/* 누적초 → { cycle: 채운 바퀴 수, lv: 이번 바퀴 안의 레벨(1~999), leftSec: 다음 바퀴까지 남은 초 } */
function focusCycleOf(sec){
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const inCycle = t % FOCUS_CYCLE_SEC;
  return { cycle: Math.floor(t / FOCUS_CYCLE_SEC), lv: 1 + Math.floor(inCycle / 3600), leftSec: FOCUS_CYCLE_SEC - inCycle };
}
/* 회차 → 별 문자열. ☆ = 1회 · ★ = 2회(반 칸 둘이 한 칸). 1:☆ 2:★ 3:☆★ 4:★★ …
   ☆ 는 홀수일 때만 맨 앞에 하나 — 앞머리만 보면 홀짝이 읽힌다. 6글자를 넘으면(13회차부터) «★×13» 으로 접는다
   (안 접으면 이름표가 옆 캐릭터와 겹친다). 0 이하는 빈 문자열. */
function lvStarStr(n){
  n = Math.max(0, Math.floor(Number(n) || 0));
  if(!n) return '';
  const s = '\u2606'.repeat(n % 2) + '\u2605'.repeat(Math.floor(n / 2));
  return s.length > 6 ? '\u2605\u00d7' + n : s;
}
/* 🌟 표시용 회차 — 해금과 표시를 가른다 (개정 70) ─────────────────────────────────────
   ⚠️ **getFocusLevel() 은 모듈로로 바꾸지 않는다.** 그 값은 레벨 «표시» 만이 아니라 해금의 기준이다 —
     춤(isDanceUnlocked) · 상호작용 책상 · 💣(FLY_MIN_LEVEL) · 날리기 색(FLY_COLOR_LEVEL · 받는 쪽도 friends[id].level 로 판정) ·
     동물 · 가챠 뽑기 수(gachaTicketsEarned = 레벨/N). 모듈로로 바꾸면 2회차 사람이 Lv.1 이 되어 **전부 다시 잠기고
     뽑기 수가 줄어든다**(이미 뽑은 게 더 많아진다). 옛 계획(handoff §3-1-b «레벨 = 1 + (누적 % 한 바퀴)»)이
     getFocusLevel 을 고치는 것이었는데, 그 자리를 표시 쪽으로 옮긴 것이 이 두 함수다.
   ★ 프리즌스·프로필의 level 도 해금 레벨 그대로 보낸다(받는 쪽 게이트 · 옛 판 호환). 표시는 cyc/clv/starC 로 따로 간다. */
function myFocusShow(){
  const c = focusCycleOf(_focusTotalSec());
  return c.cycle > 0 ? { cyc: c.cycle, lv: c.lv, color: getStarColor() } : null;
}
/* 보내는 모양 — 프리즌스(_basePayload · 입장)와 프로필(setMyProfile) 한 벌. 회차가 없으면 null(= 지운다 · 옛 판은 모름). */
function myStarOut(){
  const s = myFocusShow();
  return s ? { cyc: s.cyc, clv: s.lv, starC: s.color } : { cyc: null, clv: null, starC: null };
}
/* 프로필에 쓰는 모양 — myStarOut 과 같되 **고른 값이 없으면 starC 를 비운다**(firebase-init 이 서버의 기존 값을 지킨다 · 개정 71).
   ⚠️ 프리즌스(방)는 myStarOut(보이는 색 그대로)을 쓴다 — 방은 지금 보이는 모양을 보내는 자리라서. */
function myStarProfileOut(){
  const o = myStarOut();
  if(o.cyc && !_starPicked()) o.starC = null;
  return o;
}
/* 이 기기에 고른 색이 없으면 프로필 starC 를 받아 온다(개정 71). 팔레트 밖 값은 안 받는다.
   ★ 부르는 곳: 마이홈 초기화(첫 프로필 쓰기 **앞**) · 로그인 복원(_applyTransferSnapshot 끝). 읽기 하나 · 실패하면 조용히 넘어간다. */
async function _adoptStarColorFromProfile(){
  try{
    if(_starPicked()) return false;
    const uid = getMyUserId();
    if(!uid || !window.firebaseAPI || !firebaseAPI.fetchProfileStarC) return false;
    const c = await firebaseAPI.fetchProfileStarC(uid);
    if(!c || _starPicked() || !_starColorOk(c)) return false;   // 기다리는 사이 이 기기에서 골랐으면 그쪽이 이긴다
    return setStarColor(c);
  }catch(_){ return false; }
}
/* 받는 모양 — 남의 값(프리즌스 · 프로필 · 명함)을 표시용 star 로. 범위 밖 · 모르는 색은 버리거나 첫 색으로.
   ★ 색은 **팔레트 안의 값만** 통과한다 — _lvBadge 가 이 값을 style 문자열에 넣는다. */
function starFromRemote(o){
  if(!o) return null;
  const cyc = Math.min(FOCUS_CYCLE_CAP, parseInt(o.cyc, 10) || 0);
  if(!(cyc >= 1)) return null;
  const lv = Math.max(1, Math.min(FOCUS_LEVEL_CAP_HOURS, parseInt(o.clv, 10) || 1));
  return { cyc, lv, color: _starColorOk(o.starC) ? o.starC : STAR_PALETTE[0][0] };
}

const FOCUS_SYNCED_KEY = 'tw.focusSyncedSec';   // 마지막으로 서버에 반영한 로컬 누적치(증분의 기준점)
let _focusSyncing = false;
/* 🩺 [2026-09-15 제보 6] 동기화 실패를 **보이게** 한다.
   [경위] 실패는 `return` 한 줄로 삼켜졌다. 그런데 구글에 묶인 계정은 users/{코드}/focus 쓰기에
     auth.uid 일치가 필요하고, 세션이 풀린 기기(persistence 실패·토큰 갱신 실패)는 그 뒤 모든 push 가
     조용히 거부된다. 그 기기의 시간이 서버에 안 가니 다른 PC 는 옛 값을 보고(80 → 75 제보),
     재로그인하면 돌아온다 — 원인이 아니라 증상만 신고되는 구조였다.
     비밀번호 계정이전 계정은 userAuth 가 없어 이 조건을 안 탄다 → «구글 연동한 뒤로» 가 그래서다.
   [대응] ① 콘솔에 이유를 남긴다(제보 로그의 근거). ② 거부인데 이 기기가 로그인돼 있어야 할
     계정(이메일 기억됨)이고 세션이 없으면 **한 번** 안내한다 — 재로그인이 곧 복구다.
     ③ 부팅 첫 실패는 10분을 기다리지 않고 60초 뒤 한 번 더 — 대기선을 지나도 남는 일시 오류용. */
let _focusSyncFailStreak = 0, _focusSyncNoticed = false, _focusSyncRetryTimer = null;
function _focusSyncFailed(reason, r, delta){
  _focusSyncFailStreak++;
  const why = (r && r.reason) || '응답 없음';
  try{ console.warn('[포커스동기화] 실패 (' + reason + ') — ' + why + ' | 못 올린 증분=' + delta + 's | 연속 ' + _focusSyncFailStreak + '회'); }catch(_){}
  const linked = !!getMyLoginEmail();
  /* ⚠️ 세션이 있는데 거부되는 경우(authed)는 안내하지 않는다 — 재로그인으로 못 고치는 종류(규칙 문제)라서다(sim-focus-auth ②).
     [2026-10-02 #4a] 그 대신 아래에서 서버 값을 받아와 레벨이 기기마다 갈라져 보이지 않게 한다. */
  if(r && r.denied && linked && !r.authed && !_focusSyncNoticed){
    _focusSyncNoticed = true;   // 부팅당 한 번
    try{ toast('🔑 이 PC의 로그인이 풀려 있어요 — 앱을 다시 시작해 다시 로그인하면 이 기기의 기록이 서버에 올라가요'); }catch(_){}
  }
  /* 🩹 #4a — 거부돼도 **받아오기는 한다.** 서버가 더 크면(다른 기기에서 쌓인 시간) 그만큼 올려서 보여 준다.
     ★ 아직 못 올린 이 기기 몫(pending = 지금값 − 마크)은 그대로 얹고, 마크를 서버 값으로 옮긴다 — 다음에 쓰기가
       통하면 pending 만 증분으로 올라간다(서버 값을 증분으로 다시 올려 두 번 세는 일이 없다).
     ⚠️ 서버가 작으면 아무것도 안 한다 — 줄이는 길은 만들지 않는다(기존 원칙). */
  try{
    const S = Number(r && r.serverSec);
    if(r && r.serverSec != null && isFinite(S) && S > _focusTotalSec()){
      const mine = Math.floor(_focusTotalSec());
      const mark = _hasFocusSyncedMark() ? _getFocusSyncedMark() : mine;
      const pending = Math.max(0, mine - mark);
      setFocusTotalSec(Math.min(FOCUS_TOTAL_CAP_SEC, S + pending));
      try{ focusLevelStore.set(FOCUS_TOTAL_KEY, String(_focusTotalSec())); }catch(_){}
      _setFocusSyncedMark(S);
      _pushLevelIfChanged();
      try{ if(typeof appMode()!=='undefined' && appMode()!=='run') renderLauncher(); }catch(_){}
      try{ console.warn('[포커스동기화] 쓰기는 거부됐지만 서버 값을 받아왔어요 — ' + mine + 's → ' + _focusTotalSec() + 's'); }catch(_){}
    }
  }catch(_){}
  if(_focusSyncFailStreak === 1 && !_focusSyncRetryTimer){
    _focusSyncRetryTimer = setTimeout(()=>{ _focusSyncRetryTimer = null; try{ syncFocusTotalToServer('retry'); }catch(_){} }, 60*1000);
  }
}
/* 마지막으로 서버와 맞춘 값. 지금은 진단용 기록일 뿐 **건너뛰기 판단에 쓰지 않는다** —
   그렇게 썼다가 "안 일하는 기기가 남의 기록을 영영 안 받아온다"가 됐다(아래 주기 타이머 주석). */
let _focusLastSyncedVal = -1;

function _setFocusSyncedMark(v){ try{ focusLevelStore.set(FOCUS_SYNCED_KEY, String(Math.max(0, Math.floor(v||0)))); }catch(_){} }
function _getFocusSyncedMark(){ try{ return parseFloat(focusLevelStore.get(FOCUS_SYNCED_KEY))||0; }catch(_){ return 0; } }
// 마크가 "0"인 것과 "아예 없는 것"은 다르다 — 후자만 증분 없이(0) 시작한다.
function _hasFocusSyncedMark(){ try{ return focusLevelStore.get(FOCUS_SYNCED_KEY) !== null; }catch(_){ return false; } }

async function syncFocusTotalToServer(reason){
  if(_focusSyncing) return;
  if(!(window.firebaseAPI && firebaseAPI.syncFocusTotal)) return;
  /* ★ uid 가 아직 없으면 조용히 넘긴다 — 예전엔 부팅 4초 시점에 계정이 안 잡혀 있으면
     그 부팅은 통째로 건너뛰고 다음 런처 복귀까지 기회가 없었다. 이제 아래 주기 타이머가
     다음 차례에 그대로 다시 시도한다(max 라 몇 번을 시도해도 안전하다). */
  /* ⚠️ 신원을 놓은 뒤에는 돌지 않는다. getMyUserId() 는 없으면 **만들어내는** 함수라, 로그아웃이
     신원을 지운 뒤 beforeunload 의 'quit' 호출이 여기로 오면 임시 uid 를 발급해 그 앞으로 옛 누적을
     올렸다(2026-09-16 제보 4 를 손보다 발견). 플래그는 _wipeAccountLocal 이 세운다. */
  if(typeof _acctDetached() !== 'undefined' && _acctDetached()) return;
  const uid = getMyUserId();
  if(!uid) return;
  _focusSyncing = true;
  try{
    const capSec = FOCUS_TOTAL_CAP_SEC;   // ★ 서버 규칙의 .validate 상한과 **같은 값**이어야 한다
    const mine = Math.min(capSec, Math.max(0, Math.floor(_focusTotalSec())));
    /* 마크가 없으면(이 기기가 서버와 한 번도 안 맞춰봄) 증분은 0 — max 바닥만 태운다.
       마크를 mine 으로 두면 delta 가 자연스럽게 0 이 된다. */
    const mark  = _hasFocusSyncedMark() ? _getFocusSyncedMark() : mine;
    const delta = Math.max(0, Math.floor(mine - mark));
    // 서버: max(서버값 + delta, mine). 두 인자를 같이 보낸다 — 어느 쪽도 상대를 대체하지 않는다.
    const r = await firebaseAPI.syncFocusTotal(uid, delta, mine);
    if(!r || !r.ok){ _focusSyncFailed(reason, r, delta); return; }   // 실패 — 마크를 안 옮기므로 다음 차례에 같은 증분을 그대로 재시도
    _focusSyncFailStreak = 0;
    const server = Math.min(capSec, Number(r.totalSec)||0);
    /* ★ 왕복(await) 사이에도 시간은 쌓인다. 그만큼은 아직 서버에 안 올라갔으므로
       마크에 포함시키면 안 된다 — 예전 코드는 왕복 뒤의 현재값을 그대로 마크로 찍어서
       그 사이 일한 시간을 매 동기화마다 조금씩 삼켰다. */
    const grew = Math.max(0, Math.floor(_focusTotalSec()) - mine);
    if(server > _focusTotalSec()){
      setFocusTotalSec(server);
      try{ focusLevelStore.set(FOCUS_TOTAL_KEY, String(_focusTotalSec())); }catch(_){}
      _pushLevelIfChanged();   // 레벨이 올라갔으면 프로필 배지·해금 알림까지 반영
      // 런처 화면이면 다시 그려서 레벨 표시를 갱신(좌석 이름표는 상태 갱신 때 자동 반영됨)
      try{ if(typeof appMode()!=='undefined' && appMode()!=='run') renderLauncher(); }catch(_){}
    }
    const newMark = Math.max(0, Math.floor(_focusTotalSec()) - grew);   // grew 는 다음 차례의 증분으로 남는다
    _setFocusSyncedMark(newMark);
    /* 💃 못 보낸 해금 안내가 남아 있으면 여기서 따라잡는다.
       ★ 이 자리가 좋은 이유: 동기화가 성공했다 = **로그인이 되어 있고 쓰기가 통한다**는 뜻이다.
         레벨이 오르는 순간에 마침 로그인 전이었던 사람은 그때 우편을 못 받는데, 레벨은 이미
         올라 있어서 _pushLevelIfChanged 는 다시 안 불린다. 그 경우를 여는 것이 이 한 줄이다. */
    try{ _notifyDanceUnlocks(getFocusLevel()); }catch(_){}
    _focusLastSyncedVal = newMark;
    /* 🏆 전체 랭킹(개정 73) — **서버 총합**(server)을 올린다. 여러 기기 합산이 끝난 값이라서. 기다리지 않는다(실패해도 동기화는 성공이다).
       올리는 일은 내 정보(my-info.js _lbPush)가 «서버와 맞췄다» 알림(onTotalSynced)으로 받는다 — 포커스 레벨은 내 정보를 부르지 않는다. */
    _totalSyncedFns.forEach(fn=>{ try{ fn(uid, server); }catch(_){} });
  }catch(_){}
  finally{ _focusSyncing = false; }
}
/* ⏱️ 부팅 직후 1회 + 그 뒤로 주기적으로.
   [왜 주기가 필요한가] 예전 호출 시점은 부팅 4초와 런처 복귀 두 곳뿐이었다. 이 앱은
     '켜두고 쓰는' 앱이라 실행 화면에서 그대로 종료하면 그 세션의 기록이 **다음 부팅까지**
     서버에 안 올라간다. 그 사이 다른 기기를 켜면 옛 값만 받아서 한 사이클씩 밀린다.
   [비용] 값이 안 늘었으면 호출 자체를 건너뛴다(집중 안 하는 동안은 0회). 늘었으면 증분이
     실제로 있다는 뜻이라 쓰기 1회가 나가는 게 맞다. 최악이라도 6회/시간 수준이다.
   ⚠️ 주기가 짧을수록 좋은 게 아니다 — 증분은 왕복이 끊기면 중복 반영될 수 있으므로,
     호출 횟수를 늘리면 그 창도 같이 늘어난다. 10분은 '한 세션을 통째로 잃지 않는' 하한이다.

   ★★ [고침] 예전엔 "값이 안 늘었으면 호출 자체를 건너뛴다"는 게이트가 여기 있었다.
     그런데 이 함수는 **올리는 길이자 유일하게 내려받는 길**이다. 게이트는 "이 기기가 지금
     일하고 있지 않을 때" 걸리는데, 그건 정확히 **다른 기기가 일하고 있는 때**다 —
     즉 받아올 것이 가장 많은 순간에만 동기화를 껐다.
       제보: 회사(b)에서 쓰다 집에 오니 a 의 레벨이 그대로다. a 를 켜 둔 채(자동 시작 포함)
       출근했으면 a 는 하루 종일 한 번도 안 물어본다. 부팅 4초의 1회가 그날의 마지막 조회였다.
     이제 늘지 않았어도 매 주기 물어본다. **쓰기는 안 는다** — 서버가 want<=pre 면 쓰지 않고
     현재값만 돌려주도록 이미 돼 있어서(HTML syncFocusTotal), 이 경우 비용은 읽기 1회다. */
const FOCUS_SYNC_INTERVAL_MS = 10*60*1000;   // 10분
setTimeout(()=>{ try{ syncFocusTotalToServer('boot'); }catch(_){} }, 4000);
setInterval(()=>{ try{ syncFocusTotalToServer('tick'); }catch(_){} }, FOCUS_SYNC_INTERVAL_MS);
/* 창이 닫힐 때 마지막으로 한 번 — 비동기라 완료가 보장되진 않지만, 성공하면 위 주기의
   최대 10분 공백을 메워 준다. 실패해도 다음 부팅에서 max 로 그대로 복구된다. */
window.addEventListener('beforeunload', ()=>{ try{ syncFocusTotalToServer('quit'); }catch(_){} });
/* 💾 꾸미기를 연 채 앱을 끄면 — 닫는 것이 곧 저장이라 여기서 닫아 준다. 슬롯 저장은 파츠 받기를 기다리기 전에 도니
   종료 전에 끝난다(_commitWdDraftNow). 계정을 놓은 뒤(_wipeAccountLocal)에는 지운 칸을 도로 쓰지 않게 건너뛴다. */
window.addEventListener('beforeunload', ()=>{
  if(_acctDetached() || !wdDraftDef()) return;
  const wp = document.getElementById('wardrobePanel');
  if(wp && wp.classList.contains('on')){ try{ window.closeWardrobe(); }catch(_){} }
});

function formatHMS(sec){ sec=Math.max(0,Math.floor(sec));
  const h=String(Math.floor(sec/3600)).padStart(2,'0'), m=String(Math.floor((sec%3600)/60)).padStart(2,'0'), s=String(sec%60).padStart(2,'0');
  return h+':'+m+':'+s; }

const MOBILE_MAX_ON_MS = 4*60*60*1000;
const MOBILE_KEY_LS = 'tw.mobileKey';   // { u, k } — 이 PC 가 만든 키. uid 가 다르면 없는 것으로 본다(계정 전환)
const MOBILE_APP_MAX = 40;
let _mobileFocus = { on:false, app:'', since:0, seen:false };   // seen = 이 키로 폰이 한 번이라도 신호를 보냈다
let _mobileStop = null;
let _mobDiag = null, _mobDiagFirst = true;   // 🔍 진단 줄 — 이번 실행에 받은 신호(mobile-diag.js) · first = 구독 뒤 처음 온 값
function _mobileNow(){ try{ if(window.firebaseAPI && firebaseAPI.serverNow) return firebaseAPI.serverNow(); }catch(_){} return Date.now(); }
/* 폰이 지금 «포커싱 어플을 쓰는 중» 인가 — 켜짐 + 상한 안. */
function _mobileOn(){
  const m = _mobileFocus;
  if(!m || !m.on || !m.since) return false;
  return (_mobileNow() - m.since) < MOBILE_MAX_ON_MS;
}
/* 좌석이 띄울 앱 이름 — 남은 받은 값(remoteMobile), 나는 지금 판정. 자리추가 좌석은 안 띄운다. */
function _seatMobileApp(seat){
  if(!seat) return '';
  if(seat.remote) return seat.remoteMobile || '';
  const mine = findMySeat();
  return (seat.isMe || seat === mine) ? _mobileRoomLabel() : '';
}
/* 방에 싣는 값 · 머리 위 말풍선 글자 — 꺼져 있으면 빈 문자열. */
function _mobileRoomLabel(){ return _mobileOn() ? (_mobileFocus.app || '태블릿·폰') : ''; }
function _mobileBubbleText(app){ return app ? ('📱 ' + String(app).slice(0, MOBILE_APP_MAX)) : null; }
function _mobileCleanApp(v){
  if(typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MOBILE_APP_MAX);
}
function _mobileGetKey(){
  try{
    const o = JSON.parse(localStorage.getItem(MOBILE_KEY_LS) || 'null');
    const uid = getMyUserId();
    if(o && uid && o.u === uid && typeof o.k === 'string' && /^[A-Z2-9]{24}$/.test(o.k)) return o.k;
  }catch(_){}
  return null;
}
function _mobileNewKey(){
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 글자(0·O·1·I) 뺌 — 붙여넣기 실수가 줄어든다
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  let s = ''; for(let i = 0; i < 24; i++) s += a[b[i] % a.length];   // 256 % 32 == 0 → 치우침 없음
  return s;
}
function _mobileLinkUrl(uid, key){
  // ★ 키는 # 뒤 — 호스팅 서버 로그에 안 남는다(§4-⑤)
  return 'https://help.together-working.com/link#u=' + encodeURIComponent(uid) + '&k=' + encodeURIComponent(key);
}
/* 서버 state → 전역. 이 PC 의 키로 쓴 것만 믿는다(키를 새로 만든 뒤 예전 값이 늦게 와도 무시). */
function _mobileApplyState(v){
  const key = _mobileGetKey();
  const wasOn = _mobileOn(), wasLabel = _mobileRoomLabel();
  if(!v || !key || v.key !== key){
    _mobileFocus = { on:false, app:'', since:0, seen:false };
  } else {
    const on = v.on === true, ts = Number(v.ts) || 0;
    _mobileFocus = { on, app:_mobileCleanApp(v.app), since: on ? (ts || _mobileNow()) : 0, seen:true };
  }
  if(wasOn !== _mobileOn() || wasLabel !== _mobileRoomLabel()) _mobileChanged();
  try{ _mobRenderPanel(); }catch(_){}
}
/* 켜짐/꺼짐이 바뀌면 방에 바로 싣는다(다음 상태 틱을 기다리면 몇 초 늦다). */
function _mobileChanged(){
  try{ if(typeof Presence !== 'undefined' && Presence.broadcastNow) Presence.broadcastNow(); }catch(_){}
}
/* 부팅 · 연결 · 키 교체 때. 키가 없으면 아무것도 안 한다(비용 0). */
function _mobileStart(){
  const uid = getMyUserId(), key = _mobileGetKey();
  if(!uid || !key || !window.firebaseAPI || !firebaseAPI.mobileLinkStart) return;
  _mobDiag = mobileDiag.empty(); _mobDiagFirst = true;
  const onState = (v)=>{
    const first = _mobDiagFirst; _mobDiagFirst = false;   // 첫 값이 비어 있어도(처음 연결 · 새 키) 깃발은 내린다
    if(v && v.key === key) _mobDiag = mobileDiag.next(_mobDiag, { kind:'state', v, first });
    _mobileApplyState(v);
  };
  const onDiag = (ev)=>{
    if(ev.kind === 'reset' && !(ev.v && ev.v.key === key)) return;   // 다른 키로 쓴 «켜짐» 은 이 PC 의 신호가 아니다
    _mobDiag = mobileDiag.next(_mobDiag, ev); try{ _mobRenderPanel(); }catch(_){}
  };
  Promise.resolve(firebaseAPI.mobileLinkStart(uid, onState, onDiag)).then(stop=>{ if(stop) _mobileStop = stop; }).catch(()=>{});
}
/* ── 📱 설정 › 포커싱어플 칸 + QR 창 (시안 ①~③) ─────────────────────────────
   ★ 그리는 곳은 _mobRenderPanel 하나. 상태가 바뀔 때 · 1분마다 · 창을 열 때 부른다.
   ⚠️ 확인은 2단계 누르기(이 파일 관례) — 네이티브 확인창은 투명 오버레이에서 안 보인다(audit 검사 4). */
function _mobRenderPanel(){
  const st = document.getElementById('fsMobSt'); if(!st) return;
  const main = document.getElementById('fsMobMain'), sub = document.getElementById('fsMobSub');
  const qr = document.getElementById('fsMobQr'), un = document.getElementById('fsMobUnlink'), note = document.getElementById('fsMobNote');
  const paired = !!_mobileGetKey();
  let cls = 'off', m = '연결 안 됨', sb = '';
  if(paired && _mobileOn()){
    const min = Math.max(0, Math.floor((_mobileNow() - _mobileFocus.since) / 60000));
    cls = 'use'; m = '📱 ' + (_mobileFocus.app || '태블릿·폰') + ' 사용 중';
    sb = (min < 1 ? '방금 시작' : (min + '분째')) + ' · 포커스 시간이 쌓이고 있어요';
  } else if(paired && _mobileFocus.seen){
    cls = 'rest'; m = '연결됨 · 폰에서 쉬는 중';
  } else if(paired){
    sb = '폰에서 [신호 보내 보기]를 눌러 보세요';
  }
  st.className = 'fs-mob-st ' + cls;
  if(main){ main.textContent = m; main.title = m; }
  if(sub){ sub.textContent = sb; sub.style.display = sb ? '' : 'none'; }
  if(qr) qr.textContent = paired ? 'QR 다시 보기' : 'QR로 연결하기';
  if(un && !un._armed){ un.style.display = paired ? '' : 'none'; un.textContent = '연결 끊기'; }
  if(note) note.style.display = paired ? '' : 'none';
  const dg = document.getElementById('fsMobDiag');
  if(dg){ dg.style.display = paired ? '' : 'none'; dg.textContent = paired ? mobileDiag.line(_mobDiag) : ''; }
}
function _mobDrawQr(text){
  const cv = document.getElementById('mobLinkQr'); if(!cv || !window.TWQR) return false;
  let q; try{ q = TWQR.make(text, 'M'); }catch(_){ return false; }
  const px = Math.max(1, Math.floor(cv.width / q.n)), off = Math.floor((cv.width - px*q.n)/2);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#000';
  for(let r = 0; r < q.n; r++) for(let c = 0; c < q.n; c++) if(q.dark(r, c)) g.fillRect(off + c*px, off + r*px, px, px);
  return true;
}
function _mobFillWindow(){
  const uid = getMyUserId(), key = _mobileGetKey();
  const k = document.getElementById('mobLinkKey');
  if(k) k.textContent = key ? ('••••-' + key.slice(-4)) : '••••';
  if(uid && key && !_mobDrawQr(_mobileLinkUrl(uid, key))) toast('QR 을 그리지 못했어요 — 앱을 다시 시작해 보세요');
}
/* 키를 만들어 서버에 적고(예전 폰은 끊김) 이 PC 에 기억한다. 성공하면 구독을 새로 건다. */
async function _mobMakeKey(){
  const uid = getMyUserId();
  if(!uid){ toast('로그인한 뒤에 연결할 수 있어요'); return false; }
  if(!window.firebaseAPI || !firebaseAPI.mobileSetKey){ toast('서버에 연결되면 다시 눌러 주세요'); return false; }
  const key = _mobileNewKey();
  const ok = await firebaseAPI.mobileSetKey(uid, key);
  if(!ok){ toast('연결 키를 저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요'); return false; }
  try{ localStorage.setItem(MOBILE_KEY_LS, JSON.stringify({ u:uid, k:key })); }catch(_){}
  try{ if(_mobileStop) _mobileStop(); }catch(_){}
  _mobileStop = null;
  _mobileApplyState(null);
  _mobileStart();
  return true;
}
async function _mobOpenWindow(){
  const ov = document.getElementById('mobLinkOverlay'); if(!ov) return;
  if(!_mobileGetKey() && !(await _mobMakeKey())) return;
  ov.classList.add('on');
  _mobFillWindow();
  _mobRenderPanel();
}
function _mobCloseWindow(){ const ov = document.getElementById('mobLinkOverlay'); if(ov) ov.classList.remove('on'); }
/* 2단계 누르기 — 처음 누르면 글자가 바뀌고, 4초 안에 한 번 더 누르면 실행. */
function _mobArm(btn, armedText, run){
  if(!btn) return;
  btn.onclick = ()=>{
    if(btn._armed){ clearTimeout(btn._armed); btn._armed = 0; btn.textContent = btn._idleText; run(); return; }
    btn._idleText = btn.textContent; btn.textContent = armedText;
    btn._armed = setTimeout(()=>{ btn._armed = 0; btn.textContent = btn._idleText; }, 4000);
  };
}
{
  const q = document.getElementById('fsMobQr'); if(q) q.onclick = ()=>{ _mobOpenWindow(); };
  _mobArm(document.getElementById('fsMobUnlink'), '한 번 더 누르면 끊겨요', async ()=>{
    const uid = getMyUserId();
    try{ if(_mobileStop) _mobileStop(); }catch(_){}
    _mobileStop = null;
    try{ localStorage.removeItem(MOBILE_KEY_LS); }catch(_){}
    _mobileApplyState(null);
    _mobCloseWindow();
    if(uid && window.firebaseAPI && firebaseAPI.mobileUnlink) await firebaseAPI.mobileUnlink(uid);
    toast('📱 폰 연결을 끊었어요');
  });
  _mobArm(document.getElementById('mobLinkRenew'), '한 번 더 누르면 바뀌어요', async ()=>{
    if(await _mobMakeKey()){ _mobFillWindow(); toast('새 키를 만들었어요 — 폰에서 다시 설정해 주세요'); }
  });
  const c = document.getElementById('mobLinkCopy');
  if(c) c.onclick = ()=>{
    const key = _mobileGetKey(); if(!key) return;
    try{ navigator.clipboard.writeText(key).then(()=>toast('연결 키를 복사했어요'), ()=>toast('복사하지 못했어요')); }catch(_){ toast('복사하지 못했어요'); }
  };
  const x = document.getElementById('mobLinkClose'); if(x) x.onclick = _mobCloseWindow;
  const d = document.getElementById('mobLinkDone');  if(d) d.onclick = _mobCloseWindow;
  try{ _mobRenderPanel(); }catch(_){}
}

/* 상한을 넘기는 순간은 새 값이 오지 않으므로 1분마다 한 번 본다(표시 «N분째» 갱신 겸). */
let _mobileWasOnTick = false;
setInterval(()=>{
  const on = _mobileOn();
  if(on !== _mobileWasOnTick){ _mobileWasOnTick = on; _mobileChanged(); }
  try{ _mobRenderPanel(); }catch(_){}
}, 60*1000);

return {
  DANCE_NOTIFIED_KEY,
  onTotalSynced,
  DANCE_REPAIR_KEY,
  FOCUS_SYNCED_KEY,
  STAR_PALETTE,
  _adoptStarColorFromProfile,
  _getFocusSyncedMark,
  _hasFocusSyncedMark,
  _mobileBubbleText,
  _mobileCleanApp,
  _mobileOn,
  _mobileRoomLabel,
  _mobileStart,
  _notifyDanceUnlocks,
  _pushLevelIfChanged,
  _seatMobileApp,
  addFocusSeconds,
  focusCycleOf,
  formatHMS,
  getFocusLevel,
  getStarColor,
  lvStarStr,
  myFocusShow,
  myStarOut,
  myStarProfileOut,
  setStarColor,
  starFromRemote,
  syncFocusTotalToServer,
};
}

const api = { createFocusLevel };
if(typeof window !== 'undefined') window.TwFocusLevel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
