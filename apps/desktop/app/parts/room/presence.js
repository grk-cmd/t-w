/* presence.js — 🛰 방 접속 상태(Presence): 방 입장 · 내 상태 payload 보내기 · 자동 자리비움 · 남이 내게 한 poke 받기
   app.js «🛰 방 접속 상태(Presence)» 구역 본문을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다.
   ・책임: 지금 방(provider · room · friends)과 내가 방에 보내는 값(상태 · 레벨 · 자리비움 그림 · 소음 · 채팅 …)을 한 곳에서 들고 보낸다.
     20분 무반응 자동 자리비움 · 6시간 자동 퇴장 시계도 내 상태(myUserStatus)를 같이 써서 이 안에 있다.
   ・받는 deps 16 — 함수 2(toast · triggerPet)는 화살표, 다시 대입되거나 뒤에서 선언되는 7개
     (awayPicMod · customStatusConf · expBarMod · focusLevelMod · focusShareMod · lastAnyInput · roomEntryMod)는 읽는 함수 — 이름() 으로 읽는다.
   ・방 통신은 start 가 받는 provider(room-rt.js 방 포트) 하나 — 신원(userId) · 프리미엄(lic)은 싣지 않는다(서버가 토큰 · 라이선스로 안다).
   ・내놓는 것: { Presence } — app.js 가 «const Presence = presenceMod.Presence;» 한 줄로 옛 전역 이름을 잇는다(app.js 의 54곳 · animal.js · noise.js 가 Presence.이름 으로 부른다).
   ⚠️ firebaseAPI 는 보지 않는다. document · window · localStorage · companion 은 예전처럼 전역 이름으로 쓴다. 전역 setUserStatus 는 꼭 window. 으로(안쪽 같은 이름이 가린다).
   ⚠️ 전역 이름은 TwPresence — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-presence.js */
(function(){

function createPresence(deps){
const USER_STATUSES = deps.USER_STATUSES;
const awayPicMod = deps.awayPicMod;   // 읽는 함수
const chatUiMod = deps.chatUiMod;
const customStatusConf = deps.customStatusConf;   // 읽는 함수
const expBarMod = deps.expBarMod;   // 읽는 함수
const floatersMod = deps.floatersMod;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const focusShareMod = deps.focusShareMod;   // 읽는 함수
const iDeskMod = deps.iDeskMod;
const lastAnyInput = deps.lastAnyInput;   // 읽는 함수
const roomEntryMod = deps.roomEntryMod;   // 읽는 함수
const roomSyncMod = deps.roomSyncMod;
const seats = deps.seats;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const triggerPet = deps.triggerPet;
/* 방으로 보내는 칸의 길이 상한 · 처음 값 — 서버 규칙과 짝(채팅 text ≤ 140). 바꾸면 규칙 · 방 서버도 같이 본다. */
const CHAT_TEXT_MAX = 140;   // 채팅 한 줄 글자 수
const CHAT_TAB_MAX = 16;     // 채팅 탭 이름
const FLY_COLOR_MAX = 16;    // 날리기 색 글
const FLY_SIZE_MAX = 2;      // 날리기 크기 글('m' · 's')
const AWAY_SZ_DEFAULT = 80;  // 자리비움 그림 화면 크기 처음 값(awayPicMod 의 기본과 같은 값)
const Presence=(()=>{
  let provider=null, room=null, friends={}, myDef=null, myName='나', myState='idle', myUserStatus=null, myLevel=1, onChange=null;
  /* 🛰 내 노드 poke 의 중복·유통기한 판정용. friends 쪽 `_lastPokeTs` 와 같은 역할이다.
     _joinedAt 은 '이 방에 들어온 시각' — 들어오기 전에 찍힌 알림(내가 없던 사이의 마지막 값)을 거른다. */
  let _myPokeSeenTs = 0, _joinedAt = 0;
  let myNoise='';          // 🌙 백색소음 종류('pencil'|'keyboard'|'page' · 없으면 빈 문자열) — parts/noise.js 가 정한다. 구버전은 이 칸을 무시한다
  let myAwayImg='';        // 🫧 자리비움 그림 URL — 방에 실어 보낸다(없으면 빈 문자열 · 구버전은 무시)
  /* 📏 그 그림의 화면 크기(60·80·100) — 받는 쪽이 이 크기로 그린다(구버전은 무시 → 그쪽 고정값).
     ⚠️ 초기값을 AWAY_PIC_SCREEN_PX 로 쓰지 말 것 — 그 var 는 파일 아래쪽이라 이 IIFE 가 도는 순간엔 undefined 이고,
       Firebase 는 undefined 가 든 payload 를 통째로 거절한다(방 입장이 깨진다). 이 파일 위 숫자 상수로 둔다. */
  let myAwaySz=AWAY_SZ_DEFAULT;
  let myFocusShow=null;   // 📊 오늘 기록 전시 {emo,text} — 상태가 없을 때만 custom 칸으로 실어 보낸다(_statusOut)
  let myCustomStatus=null;   // ✨ 커스텀 상태(프리미엄) {emo,text} — userStatus==='custom'일 때 친구에게 보여줄 문구

  // ────────────────────────────────────────────────────────────────────
  // 🌙 자동 자리비움 전환 — 20분간 마우스/키보드 반응이 없으면 userStatus를 'away'로 자동 세팅.
  //   예외: 'meal'(밥먹는중), 'gaming'(게임중)은 유저 의도 존중해서 자동 전환하지 않음.
  //   활동 재개 시(마우스/키보드 사용) 자동 해제. 단, 유저가 수동으로 설정한 자리비움은 유지.
  //   (수동/자동 구분은 _autoAwayApplied 플래그로 판정 — 자동 전환한 것만 자동 해제됨)
  // ────────────────────────────────────────────────────────────────────
  const AUTO_AWAY_MS = 20 * 60 * 1000;   // 20분 무반응 → 자동 자리비움
  // ★ 비대칭 틱 — 진입 판정과 복귀 판정은 요구되는 반응 속도가 다름.
  //   · 평소(IDLE_TICK 60초): 임계값이 20분이라 1분 오차는 무의미. 부하 최소화.
  //   · 자동 자리비움 중(BACK_TICK 5초): 사람이 돌아왔는데 캐릭터가 영혼 상태로 남아있으면 곧바로
  //     어색하므로 촘촘히 감시해서 빨리 복귀시킴.
  const AUTO_AWAY_TICK_IDLE_MS = 60 * 1000;   // 평소 체크 주기
  const AUTO_AWAY_TICK_BACK_MS = 5 * 1000;    // 자동 자리비움 중일 때 복귀 감시 주기
  let _autoAwayApplied = false;      // 지금의 'away'가 자동 전환된 것인지 (수동 설정과 구분)
  let _preAutoAwayStatus = null;     // 자동 전환 직전 상태 — 활동 재개 시 여기로 복원
  /* 🚪 자동 자리비움에 **들어간 시각**. 6시간 자동 퇴장의 기준점이다(_autoExitWarn 주석).
     0 = 자동 자리비움이 아니다. */
  let _autoAwayAt = 0;
  /* 자동 퇴장 뒤 시계를 되감는 통로 — 팝업 쪽(_autoExitDo)이 부른다. 그 자리에서는 이 변수가
     안 보이므로(IIFE 안이다) 여기서 내준다. */
  window._autoAwayResetClock = ()=>{ _autoAwayAt = Date.now(); };
  // 유저가 상태칩으로 직접 상태를 고르면 자동 전환 흔적을 리셋 (내부 setUserStatus에서 호출)
  /* ⚠️ 자동 퇴장 안내창도 함께 거둔다 — 사람이 직접 상태를 골랐다는 것은 자리에 있다는 뜻이라,
     «곧 나갑니다» 를 그대로 세워두면 거짓말이 된다. _autoExitCancel 은 재진입에 안전하다. */
  function _clearAutoAwayMarks(){
    _autoAwayApplied = false; _preAutoAwayStatus = null; _autoAwayAt = 0;
    try{ roomSyncMod._autoExitCancel(); }catch(_){}
  }
  /* 🩹 #1 — 자동/수동 자리비움 종류를 tw.awayKind 에 남겨 재시작 뒤에도 «자동» 이면 마우스로 풀리게 한다.
     ★ 기록이 없는 'away' 는 자동으로 본다(옛 판본이 남긴 값 — 갇힌 사람을 풀어 주는 쪽).
     ⚠️ 6시간 자동 퇴장 시계(_autoAwayAt)는 부팅 시각부터 다시 센다. */
  const AWAY_KIND_KEY = 'tw.awayKind';
  function _saveAwayKind(kind, pre){
    try{
      if(kind) localStorage.setItem(AWAY_KIND_KEY, JSON.stringify({ k: kind, pre: pre || null }));
      else localStorage.removeItem(AWAY_KIND_KEY);
    }catch(_){}
  }
  (function _restoreBootStatus(){
    let v = null;
    try{ v = localStorage.getItem('tw.userStatus') || null; }catch(_){}
    if(!v || !USER_STATUSES[v]) return;
    myUserStatus = v;
    if(v !== 'away') return;
    let rec = null;
    try{ rec = JSON.parse(localStorage.getItem(AWAY_KIND_KEY) || 'null'); }catch(_){}
    if(rec && rec.k === 'manual') return;   // 손으로 고른 자리비움 — 그대로 둔다
    _autoAwayApplied = true;
    _preAutoAwayStatus = (rec && rec.pre && USER_STATUSES[rec.pre] && rec.pre !== 'away') ? rec.pre : null;
    _autoAwayAt = Date.now();
  })();
  // 유휴 시간(ms) — OS의 powerMonitor 값이 있으면 그걸 우선 사용(마우스 "이동"까지 포함되어 가장 정확).
  //   IPC가 없거나 실패하면 렌더러가 직접 기록한 lastAnyInput(클릭·키 입력)으로 폴백.
  async function _idleMs(){
    if(window.companion && companion.getIdleSeconds){
      try{
        const sec = await companion.getIdleSeconds();
        if(typeof sec === 'number' && isFinite(sec) && sec >= 0) return sec * 1000;
      }catch(_){}
    }
    return performance.now() - lastAnyInput();
  }
  // 다음 틱을 현재 상태에 맞는 주기로 예약 (자동 자리비움 중이면 촘촘하게)
  let _autoAwayTimer = null;
  function _scheduleAutoAwayTick(){
    const delay = _autoAwayApplied ? AUTO_AWAY_TICK_BACK_MS : AUTO_AWAY_TICK_IDLE_MS;
    clearTimeout(_autoAwayTimer);
    _autoAwayTimer = setTimeout(_autoAwayTick, delay);
  }
  async function _autoAwayTick(){
    try{ await _autoAwayCheck(); }
    catch(err){ console.warn('[autoAway] 체크 실패', err); }
    finally{ _scheduleAutoAwayTick(); }   // 어떤 경우에도 다음 틱은 계속 예약 (루프가 끊기지 않게)
  }
  async function _autoAwayCheck(){
    /* 📱 폰에서 포커싱 어플을 쓰는 중이면 PC 입력이 없어도 자리에 있는 것이다 — 20분 자동 자리비움 · 6시간 퇴장을 건너뛴다.
       0 으로 두면 이미 자동 자리비움이었던 사람은 아래 «활동 재개» 갈래로 복원된다. */
    const idle = focusLevelMod()._mobileOn() ? 0 : await _idleMs();
    // 밥먹는중·게임중은 자리를 비운 게 아니라 의도적으로 둔 상태 — 자동 전환하지 않음
    const skipStatus = myUserStatus === 'meal' || myUserStatus === 'gaming';
    // 상태 변경은 전역 setUserStatus로 해야 UI(상태칩)+캐릭터 모션까지 함께 갱신됨.
    //   ★ Presence IIFE 안에도 같은 이름의 내부 setUserStatus가 있어(스코프 가림) 반드시 window.으로 명시.
    //     내부 것을 부르면 Presence 상태만 바뀌고 화면은 그대로인 버그가 남.
    //   ★ 전역 setUserStatus → Presence.setUserStatus → _clearAutoAwayMarks()로 흔적이 지워지므로,
    //     자동 전환/복원 표시는 반드시 호출 "이후"에 세팅해야 함.
    const setStatus = (v)=>{
      try{ window.setUserStatus(v); return true; }
      catch(err){ console.warn('[autoAway] 상태 전환 실패', err); return false; }
    };
    if(idle >= AUTO_AWAY_MS && !skipStatus && myUserStatus !== 'away'){
      const prev = myUserStatus;   // 복원용으로 기억 (null이면 기본 상태였다는 뜻)
      if(setStatus('away')){
        _autoAwayApplied = true;
        _preAutoAwayStatus = prev;
        _autoAwayAt = Date.now();   // 🚪 6시간 자동 퇴장 시계는 여기서 시작한다
        _saveAwayKind('auto', prev);   // 🩹 #1 — 재시작해도 «자동» 이었음을 잊지 않게(위 _restoreBootStatus)
      }
    } else if(idle < AUTO_AWAY_MS && _autoAwayApplied && myUserStatus === 'away'){
      // 활동 재개 → 자동 전환 직전 상태로 복원 (빡일중이었으면 다시 빡일중, 기본이었으면 기본)
      const restore = _preAutoAwayStatus;
      if(setStatus(restore)){
        _autoAwayApplied = false;
        _preAutoAwayStatus = null;
        _autoAwayAt = 0;
        try{ roomSyncMod._autoExitCancel(); }catch(_){}   // 🚪 돌아왔으니 «곧 나갑니다» 안내도 거둔다
      }
    }
    /* 🚪 [건의 2026-09-12] 자리비움이 6시간에 1분 남았으면 안내창을 띄운다.
       ★ 진입/복귀 판정보다 **뒤**에 둔다. 앞에 두면 방금 돌아온 사람에게도 한 번 뜬다.
       ★ 판정만 여기서 하고, 방을 나갈지·시크릿룸 방장인지는 _autoExitWarn 이 정한다 —
         이 함수는 «자리비움이 얼마나 됐나»만 알면 되고, 방 사정은 저쪽이 안다.
       ⚠️ 이 틱은 자동 자리비움 중에 5초 주기다(AUTO_AWAY_TICK_BACK_MS). 1분 경고에 충분하다. */
    if(_autoAwayApplied && _autoAwayAt
       && (Date.now() - _autoAwayAt) >= (roomSyncMod.AUTO_EXIT_AFTER_AWAY_MS - roomSyncMod.AUTO_EXIT_WARN_MS)){
      try{ roomSyncMod._autoExitWarn(); }catch(err){ console.warn('[자동퇴장] 안내 실패', err); }
    }
  }
  _scheduleAutoAwayTick();   // 첫 틱 예약 (이후 틱마다 현재 상태에 맞는 주기로 스스로 재예약)

  /* opts.provider — 방 포트 provider(room-entry makeRoomProvider · room-rt.js). 입장 결과를 기다려 { ok, code, others, meta } 를 돌려준다.
     없으면 가짜 방(개발 표식 tw.mockRoom=1)일 때만 — 가짜 캐릭터가 실제 방으로 새지 않게. 그 밖은 { ok:false, code:'noProvider' }. */
  async function start(roomCode, def, name, changeCb, opts){
    if(provider) await stop();   // 이미 연결돼있는데 다시 시작하면(연결끊기 없이 재접속 등) 이전 접속 삭제가 끝난 뒤에 새로 join — 안 그러면 옛 항목이 아직 안 지워진 채로 남아 자기 자신이 중복으로 보일 수 있음
    room=roomCode; myDef=def; myName=name||'나'; myLevel=focusLevelMod().getFocusLevel(); _lvKey=''; onChange=changeCb||onChange; friends={};
    _myPokeSeenTs = 0; _joinedAt = roomSyncMod._srvNow();   // 🛰 새 방 = 새 우편함. 들어오기 전 알림은 안 읽는다
    // ✨ 앱 재시작 후 첫 접속 — localStorage에서 복원된 커스텀 상태 문구를 join 페이로드에 실어보냄
    //   (setCustomStatus를 거치지 않고 바로 join하는 경로라 여기서 한 번 동기화해줘야 친구 화면에 문구가 보임)
    if(typeof customStatusConf()!=='undefined' && customStatusConf() && customStatusConf().text){
      myCustomStatus = { emo: customStatusConf().emo||'', text: customStatusConf().text };
    }
    // 🏊 얼굴 PNG를 Storage에 올려 URL 준비 — 실패해도 dataURL 병행 전송이라 입장엔 지장 없음
    try{ await roomSyncMod.ensureRoomFaceUrls(myDef); }catch(_){}
    const _srv = (opts && opts.provider) || null;
    if(!_srv && !roomEntryMod()._mockRoomAllowed()){
      room = null; provider = null; friends = {}; if(onChange) onChange({});
      console.warn('[방] provider 없이 입장을 불렀다 — 멈춤(가짜 방으로 떨어지지 않음)');
      return { ok:false, code:'noProvider' };
    }
    provider = _srv || roomEntryMod().makeMockProvider();
    try{ myAwayImg = awayPicMod()._awayUrlOk(awayPicMod().awayImgUrl()) ? awayPicMod().awayImgUrl() : ''; }catch(_){ myAwayImg = ''; }   // 🫧 입장 때 한 번
    try{ myAwaySz = awayPicMod()._awaySzOk(awayPicMod().awayImgSz()) ? awayPicMod().awayImgSz() : awayPicMod().AWAY_PIC_SCREEN_PX(); }catch(_){ myAwaySz = awayPicMod().AWAY_PIC_SCREEN_PX(); }
    try{ myFocusShow = focusShareMod()._focusShowConf(); focusShareMod()._focusShowMarkSent(myFocusShow); }catch(_){ myFocusShow = null; }   // 📊 입장 때 한 번 — 입장 페이로드에 싣고 5분 시계를 여기서 시작
    try{ myNoise = (window.TW_NOISE && TW_NOISE.kind) ? TW_NOISE.kind() : ''; }catch(_){ myNoise = ''; }   // 🌙 입장 때 한 번
    const _st0 = _statusOut();
    const _joinRes = provider.join(room, {def:myDef,name:myName,awaySz:myAwaySz,state:myState,userStatus:_st0.userStatus,customStatus:_st0.customStatus,level:myLevel, ...focusLevelMod().myStarOut(),mobile:focusLevelMod()._mobileRoomLabel(), noise:myNoise, awayImg:myAwayImg}, fr=>{ friends=fr; if(onChange)onChange(friends); },
      // 다른 사람이 내 캐릭터를 쓰다듬거나 흔들었을 때 — 내 화면의 'me' 좌석에 그 반응을 그대로 재생
      p=>{ const me=seats.find(s=>s.isMe); if(!me||!p) return;
        /* 🛰 같은 알림을 두 번 재생하지 않고, 지나간 알림은 아예 보지 않는다 — poke 자리는 마지막 값을 들고 있어
           재배달(serverTimestamp 확정 · 재접속)되면 아무도 안 눌렀는데 캐릭터가 날아간다.
           ⚠️ ts 가 없는 값(옛 클라이언트)은 예전처럼 그냥 재생한다 — 막으면 그쪽과 안 통한다. */
        const _pts = (typeof p.ts === 'number') ? p.ts : 0;
        if(_pts){
          if(_pts <= _myPokeSeenTs) return;                          // 같거나 뒤로 가는 값은 안 본다
          _myPokeSeenTs = _pts;
          if(_joinedAt && _pts < _joinedAt - roomSyncMod.POKE_SKEW_MS) return;   // 내가 들어오기 전에 찍힌 값
          if(!roomSyncMod._pokeFresh(_pts)) return;                              // 유통기한 지난 값
        }
        if(p.type==='pet'){
          // 💗 방금 내가 직접 쓰다듬은 것의 에코면 건너뛴다(이미 로컬에서 하트를 띄웠다 — 제보 #12)
          if(performance.now() - floatersMod._myPetLocalAt() < floatersMod.MY_PET_ECHO_MS) return;
          triggerPet(me); for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('♥','#f2607d',me),i*320);
        }
        else if(p.type==='dizzy'){ me.dizzyUntil=performance.now()+2500; for(let i=0;i<floatersMod.FLOATER_BURST;i++) setTimeout(()=>floatersMod.spawnFloater('💫','#f5a94f',me),i*300); }
        else if(typeof p.type==='string' && p.type.indexOf('fly:')===0){ tricksMod.applyRemoteFly(me, p.type.slice(4)); }   // 🪑 내가 날아간다 — 연속 횟수도 여기서 센다
        /* 🪄 내가 맞았다. 내가 나를 때린 경우도 이 노드로 돌아오는데, 그건 이미 로컬에서
           재생했으므로 applyRemoteBonk 안에서 걸러진다(때린사람 id 가 내 id). */
        else if(typeof p.type==='string' && p.type.indexOf('bonk:')===0){ tricksMod.applyRemoteBonk(me, p.type); }
        else if(typeof p.type==='string' && p.type.indexOf('dance')===0){   // 💃 방 전원 춤(댄스배틀 포함) — 타고 있으면 유지
          if(!me.ridingOn){
            const style = p.type.split(':')[1] || 'sway';
            const dd = iDeskMod.DANCE_MOVES.find(d=>d.style===style);
            me.danceUntil = performance.now() + ((dd && dd.dur) || 6000);   // 이미 춤추는 중이어도 새 춤으로 교체(배틀) — 레벨 무관 동참
            me.danceStyle = style;
            try{ if(Presence.broadcastRide) Presence.broadcastRide(); }catch(_){}   // 스타일 변경을 즉시 페이로드로
          }
        }
      });
    if(!_srv) return { ok:true, others:Object.keys(friends).length, meta:null };   // 가짜 방
    const r = await _joinRes;
    if(!(r && r.ok)){
      if(provider === _srv){ provider = null; room = null; friends = {}; if(onChange) onChange({}); }
      return { ok:false, code:(r && r.code) || 'fail' };
    }
    return r;
  }
  // 매 update마다 함께 보내는 공통 페이로드 (✨ customStatus 포함 — 친구 화면에서 커스텀 문구를 보여주기 위함)
  /* 🐾 올라타기·탑쌓기 공유 — '내가 바로 아래 누구 위에 타고 있는가' 하나만 보낸다.
     각자 자기 바로 아래만 전송하면 받는 쪽에서 관계를 이어 붙여 탑 전체가 재구성되므로,
     1층이든 4층이든 데이터 구조가 같다(값 하나). 문자열 하나라 방 사용량 영향도 사실상 없다.
     ★ 값은 '상대 식별자' — 내 좌석이 친구 위에 타면 그 친구의 id, 내 캐릭터 위면 'me'. */
  function _myRidingOn(){
    try{
      const me = seats.find(x=>x.isMe);
      if(!me || !me.ridingOn) return null;
      const h = me.ridingOn;
      if(h.isMe) return 'self';
      // ★ friendId는 '방 세션마다 새로 뽑히는 memberId'라 받는 쪽에서 자기 자신을 알아볼 수가 없다.
      //   (내가 상대 머리에 올라탔다고 보내도, 상대는 그 값이 자기라는 걸 몰라서 곧바로 내려버렸다)
      //   join 페이로드에 함께 싣는 userId는 양쪽이 공유하는 안정적인 값이라 이걸 쓴다.
      return h.friendUserId || null;
    }catch(_){ return null; }
  }
  // 🪑 내가 앉은 벤치 슬롯 — {host:<상대userId 또는 'self'>, slot:n} 또는 null.
  function _mySeatedOn(){
    try{
      const me = seats.find(x=>x.isMe);
      if(!me || !me.seatedOn) return null;
      const h = me.seatedOn;
      const host = h.isMe ? 'self' : (h.friendUserId || null);
      if(host==null) return null;
      return { host, slot: me.seatSlot|0 };
    }catch(_){ return null; }
  }
  // 🪑 내가 벤치를 놨는지 — {seats, deskId} 또는 null. 친구 화면에도 같은 벤치가 생기게 전송.
  function _myBench(){
    try{ const me = seats.find(x=>x.isMe); return (me && me.bench) ? { seats:(me.bench.userData.benchSeatCount||2), deskId:(me.benchDeskId||null) } : null; }catch(_){ return null; }
  }
  // 💃 내가 지금 추는 춤 스타일 — 춤추는 중일 때만 값, 아니면 null(친구 화면이 내 춤 종류를 알게).
  function _myDanceStyle(){
    try{
      const me = seats.find(x=>x.isMe);
      return (me && me.danceUntil && performance.now() < me.danceUntil) ? (me.danceStyle||'sway') : null;
    }catch(_){ return null; }
  }
  /* ⭐ exp = 레벨 안 진행도(0~12칸). 하트비트에도 실리지만 여기에도 넣어야 입장 직후 첫 30초 동안
     상대 화면에 바가 비어 보이지 않는다. 이 push들은 원래 발생하던 것이라 추가 쓰기는 없다. */
  function _myExpCells(){ try{ return expBarMod().myExpCells(); }catch(_){ return null; } }
  /* 🪑 내가 쉬는 중인 시각(ms) — 지나갔으면 null 로 보내서 필드를 비운다.
     ★ 새 쓰기를 거의 만들지 않는다: 값이 바뀌는 순간(연속 기준 도달)에만 broadcastNow 가 한 번
       나가고, 그 뒤로는 원래 나가던 update 에 필드 하나(숫자)가 얹혀 갈 뿐이다. */
  function _myFlyCool(){
    try{ return (typeof tricksMod._myFlyCoolUntil()==='number' && tricksMod._myFlyCoolUntil() > Date.now()) ? tricksMod._myFlyCoolUntil() : null; }
    catch(_){ return null; }
  }
  /* 📊 오늘 기록 전시 — **새 필드를 만들지 않는다.** 상태가 없을 때(myUserStatus null)만 userStatus 'custom' +
     customStatus {🕒, '오늘 H:MM'} 로 싣는다. 받는 쪽은 기존 커스텀 상태 경로 그대로라 구버전도 보인다.
     ★ 상태(밥·자리비움·커스텀 …)가 있으면 그것이 그대로 나간다 = 상태 메시지 우선 · 남의 설정을 덮지 않는다.
     ⚠️ 규칙: customStatus.text ≤ 12 · emo ≤ 4 — «오늘 99:59» 10자 · 🕒 2 로 안에 든다(규칙 변경 없음). */
  function _statusOut(){
    /* 📱 폰 켜짐이면 🕒 오늘 기록보다 «📱 앱» 이 먼저다(사용자가 고른 상태는 그대로 이긴다) — 받는 쪽이 mobile 칸을 띄운다. */
    if(!myUserStatus && focusLevelMod()._mobileOn()) return { userStatus:myUserStatus, customStatus:myCustomStatus };
    if(!myUserStatus && myFocusShow) return { userStatus:'custom', customStatus:myFocusShow };
    return { userStatus:myUserStatus, customStatus:myCustomStatus };
  }
  function setAwayImg(url){
    const v = awayPicMod()._awayUrlOk(url) ? url : '';
    if(v === myAwayImg) return;
    myAwayImg = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  /* 📏 자리비움 그림 화면 크기 — 규칙 변경 없는 방 payload 한 칸(awayImg 와 같은 방식). */
  function setAwaySz(px){
    const v = awayPicMod()._awaySzOk(px) ? px : awayPicMod().AWAY_PIC_SCREEN_PX();
    if(v === myAwaySz) return;
    myAwaySz = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  /* 🌙 백색소음 — 고른 소리 종류 한 칸만 싣는다(상태 focus/idle/sleep 은 이미 흐른다 · 규칙 변경 없음 — awayImg 와 같은 방식).
     ★ 끄면 빈 문자열 — null 로 보내면 칸이 지워져 _diffRoomPayload 기준값과 어긋난다. */
  function setNoise(kind){
    const v = (typeof kind === 'string' && /^(pencil|keyboard|page)$/.test(kind)) ? kind : '';
    if(v === myNoise) return;
    myNoise = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  function setFocusShow(conf){
    const v = (conf && conf.text) ? { emo: conf.emo || '', text: conf.text } : null;
    if(JSON.stringify(v) === JSON.stringify(myFocusShow)) return;
    myFocusShow = v;
    if(provider && provider.update) provider.update(_basePayload());
  }
  function _basePayload(){ const _st=_statusOut(); return {state:myState, userStatus:_st.userStatus, customStatus:_st.customStatus, level:myLevel, exp:_myExpCells(), ...focusLevelMod().myStarOut(), awaySz:myAwaySz, awayImg:myAwayImg, ridingOn:_myRidingOn(), seatedOn:_mySeatedOn(), bench:_myBench(), mobile:focusLevelMod()._mobileRoomLabel(), danceStyle:_myDanceStyle(), tab:chatUiMod._chatTabOut(), flyCool:_myFlyCool(), noise:myNoise}; }
  /* 올라타기/하차 직후 즉시 반영 — 상태 틱을 기다리면 상대 화면에 몇 초 늦게 나타난다. */
  function broadcastRide(){ try{ if(provider && provider.update) provider.update(_basePayload()); }catch(_){} }
  function setState(s){ if(s===myState)return; myState=s; if(provider&&provider.update)provider.update(_basePayload()); }
  function setUserStatus(s){
    if(s===myUserStatus){
      /* 🩹 #1 — 부팅 때 «자동» 으로 되살린 자리비움을 사람이 칩에서 다시 고르면 그때부터 «수동» 이다.
         값이 같아 아래로 안 내려가므로 여기서 따로 바꿔 준다(안 하면 마우스만 움직여도 풀린다). */
      if(s === 'away' && _autoAwayApplied){ _clearAutoAwayMarks(); _saveAwayKind('manual'); }
      return;
    }
    myUserStatus=s; _clearAutoAwayMarks();
    /* 🩹 #1 — 여기는 «사람이 고른» 경로다. 자동 전환은 이 뒤에 'auto' 로 덮어쓴다(_autoAwayCheck). */
    _saveAwayKind(s === 'away' ? 'manual' : null);
    if(provider&&provider.update)provider.update(_basePayload());
  }
  /* 🌟 회차에서는 해금 레벨(n)이 999 에 머문다 — 이번 바퀴 레벨·회차·색도 같이 보고 바뀌었을 때만 보낸다.
     ★ 매 프레임 불린다(좌석 루프) — 값 비교만 하고 쓰기는 바뀔 때 한 번. */
  let _lvKey = '';
  function setLevel(n){ const so=focusLevelMod().myStarOut(), k=n+'|'+so.cyc+'|'+so.clv+'|'+so.starC; if(k===_lvKey)return; _lvKey=k; myLevel=n; if(provider&&provider.update)provider.update(_basePayload()); }
  /* 🏷️ 닉네임 변경을 방에 즉시 반영 — myName 은 start() 에서 한 번만 잡히므로 '남에게 보이는 내 이름' 은 여기서 보낸다.
     (내 화면의 내 이름표는 매 프레임 getDisplayName() 을 직접 읽는다.) */
  function setName(n){
    const v = n || '나';
    if(v === myName) return;
    myName = v;
    // ⚠️ _basePayload 에는 name 이 없다(입장 뒤로는 안 바뀌는 값이라 매 틱 실어보내지 않는다).
    //   여기서만 얹어 보낸다 — provider.update 는 델타 병합이라 이 한 항목만 나간다.
    if(provider && provider.update) provider.update(Object.assign(_basePayload(), { name: myName }));
  }
  // ✨ 커스텀 상태 문구 등록/변경 — 지금 custom 상태를 쓰고 있으면 친구 화면도 즉시 갱신됨
  function setCustomStatus(conf){
    myCustomStatus = (conf && conf.text) ? {emo: conf.emo||'', text: conf.text} : null;
    if(provider&&provider.update) provider.update(_basePayload());
  }
  // 내가 남의 캐릭터(friend seat)를 쓰다듬거나 흔들었을 때 그 사람에게 알림
  function poke(targetFriendId, type){ if(provider&&provider.poke) provider.poke(targetFriendId, type); }
  /* 🪄 내 노드에 poke 를 쓴다 — 내가 내 캐릭터에 한 일(자기 때리기)을 방 전체가 보게.
     ★ app.js 는 자기 memberId 를 모른다(방 세션마다 새로 뽑히고 페이로드에도 안 실린다).
       그래서 대상 id 를 받지 않고, 자기 자신을 아는 provider 쪽이 대신 채운다. */
  function pokeSelf(type){ if(provider&&provider.pokeSelf) provider.pokeSelf(type); }
  // 내 캐릭터 정의(크기·꾸미기 파츠 등)가 방에 들어간 뒤에 바뀌었을 때 다시 전송 — 안 그러면 상대는 join 시점 모습 그대로 봄.
  function updateDef(newDef){ myDef=newDef;
    // 🏊 새 캐릭터의 얼굴 URL을 준비한 뒤 전송 — 준비 실패해도 dataURL이 함께 가므로 상대 화면은 항상 정상
    roomSyncMod.ensureRoomFaceUrls(newDef).catch(()=>{}).then(()=>{ if(provider&&provider.update)provider.update(Object.assign(_basePayload(), {def:newDef})); });
  }
  /* 💬 채팅 — 마지막 메시지+타임스탬프만 내 항목에 실어 보냄(대화 기록 저장은 안 함, ts로 "새 메시지" 판별).
     🌊 fly / flyColor — 「날리기」. 체크하고 보낸 줄은 말풍선 대신 화면을 가로질러 흐른다.
       ★ 서버 규칙은 `chat.text` 만 검사해 이 두 칸은 규칙을 안 고쳐도 통과한다.
       ★ fly 가 거짓이면 칸 자체를 안 싣는다 — 방 payload 를 키우지 않게.
       ⚠️ flyColor 는 «보낸 사람이 고른 값»일 뿐 권한이 아니다. Lv.200 판정은 **받는 쪽**에서
         friends[id].level 로 다시 한다 — 여기서만 막으면 값을 조작해 색을 쓸 수 있다. */
  /* 💬 tab — 채팅 탭. #일반이 아니면 `chat` 이 아니라 새 칸 `chatTab` 으로 보낸다.
     ★ 구버전은 chatTab 을 몰라 아예 안 띄운다 — 영화 탭의 말풍선 · 날리기가 #일반 사람 · 구버전에게 새지 않는 이유가 이것이다.
       `chat` 칸으로 보내면 구버전이 탭을 모른 채 방 전원에게 띄운다(sim-chat-tabs ①). */
  function sendChat(text, fly, flyColor, flySize, tab){
    if(!(provider && provider.update)) return;
    const chat = { text:String(text).slice(0,CHAT_TEXT_MAX), ts:Date.now() };
    if(tab && tab !== 'general') chat.tab = String(tab).slice(0,CHAT_TAB_MAX);
    if(fly){
      chat.fly = true;
      if(flyColor) chat.flyColor = String(flyColor).slice(0,FLY_COLOR_MAX);
      // 대(l)는 기본값이라 안 싣는다 — 받는 쪽이 «없으면 대» 로 읽는다.
      if(flySize && flySize !== 'l') chat.flySize = String(flySize).slice(0,FLY_SIZE_MAX);
    }
    if(chat.tab){ provider.update(Object.assign(_basePayload(), { chatTab: chat })); return; }
    provider.update(Object.assign(_basePayload(), { chat }));
  }
  function stop(){
    const p = (provider && provider.leave) ? Promise.resolve(provider.leave()) : Promise.resolve();
    provider=null; room=null; friends={}; if(onChange)onChange({});
    return p;   // 호출부에서 await하면 서버에 삭제가 반영된 뒤에 재접속하도록 할 수 있음
  }
  return { start, setState, setUserStatus, setCustomStatus, setFocusShow, setAwayImg, setAwaySz, setNoise, setLevel, setName, poke, pokeSelf, updateDef, sendChat, stop, broadcastRide,
           /* 🪑 상태 변화를 지금 당장 방에 실어 보낸다(같은 _basePayload). 쉬는 시간처럼
              "다음 상태 틱까지 기다리면 늦는" 값이 생겼을 때 부른다. */
           broadcastNow: broadcastRide,
           active:()=>!!provider, roomCode:()=>room, friendsObj:()=>friends,
           myDef:()=>myDef,   // 방에 마지막으로 보낸(입장 · updateDef) 내 def — launchApp 이 바뀌었는지 본다
           // 🛰 지금 방이 방 서버로 붙어 있으면 그 provider(방장 설정 chatOff 를 서버로 보낼 때) · 아니면 null
           serverProvider:()=>(provider && provider.kind === 'server') ? provider : null };
})();

return {
  Presence,
};
}

const api = { createPresence };
if(typeof window !== 'undefined') window.TwPresence = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
