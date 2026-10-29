/* room-entry.js — 🛰 방 입장 · 나가기 · 승계 · 해산 · 🔢 방 만들기 · 랜덤 참여 · 갈아타기 · 코드 입력칸
   방 통신은 room-rt.js 방 포트 하나(realtime 연결 위 · 서버 통신 규약 pv 2). 정원 · 채널 · 방 상한 · 시크릿룸 입장 · 승계 · 해산 · 버전은 서버가 판정한다 —
   여기서는 입장 결과({ ok, code })를 문구로 바꾸고, 빈 방 접두어 맞추기 · 시크릿룸 «내 방을 비어 있을 때 열기»(같이 듣기)만 가른다.
   ★ 밖에서 부르는 이름: CHANNEL_NAMES · ROOM_PREFIX · _mockRoomAllowed · _srFmtDate · doLeaveRoom · makeMockProvider · refreshInviteUI · startRoom · syncFriendSeats ·
     doCreateRoomInChannel · _myRoomLicensed · onRoomChanged — app.js 는 roomEntryMod.이름 으로 부른다.
   ⚠️ document · window · localStorage 등 브라우저 전역은 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRoomEntry — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-room-entry.js */
(function(){

function createRoomEntry(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const EXP_CELLS = deps.EXP_CELLS;   // 읽는 함수
const FLOATER_BURST = deps.FLOATER_BURST;
const Presence = deps.Presence;
const _chatNotifyIncoming = deps._chatNotifyIncoming;
const _clearHiddenSeats = deps._clearHiddenSeats;
const _onDeviceSessionLost = deps._onDeviceSessionLost;
const _pokeFresh = deps._pokeFresh;
const _refreshChatMembers = deps._refreshChatMembers;
const applyCharToSeat = deps.applyCharToSeat;
const applyEquippedPartsToSeat = deps.applyEquippedPartsToSeat;
const awayPicMod = deps.awayPicMod;   // 읽는 함수
const chatUiMod = deps.chatUiMod;
const createSeat = deps.createSeat;
const curSlot = deps.curSlot;   // 읽는 함수
const deserializeDefFromNetwork = deps.deserializeDefFromNetwork;
const retryDefAfter = deps.retryDefAfter;   // 얼굴 못 받은 def 를 다시 풀 때까지 기다릴 ms(room-sync.js)
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const layoutSeats = deps.layoutSeats;
const _rcStore = deps._rcStore;   // 원격 설정 한 벌(account-state.js)
const maxPeople = deps.maxPeople;
const myExpCells = deps.myExpCells;
const officeMode = deps.officeMode;   // 읽는 함수
const pruneSeatPartsAgainstDef = deps.pruneSeatPartsAgainstDef;
const refitSeatAfterParts = deps.refitSeatAfterParts;
const removeSeatLabels = deps.removeSeatLabels;
const renderSeatTabs = deps.renderSeatTabs;
const rideBenchMod = deps.rideBenchMod;
const scene = deps.scene;
const seats = deps.seats;
const serializeDefForNetwork = deps.serializeDefForNetwork;
const settingsMod = deps.settingsMod;
const showChatBubble = deps.showChatBubble;
const slots = deps.slots;
const spawnFloater = deps.spawnFloater;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const triggerPet = deps.triggerPet;
const updateMyStatusChipPosition = deps.updateMyStatusChipPosition;
const paintRoomInfo = deps.paintRoomInfo;   // 방 안 정보 칸 제목 · [방 설정](room-info-ui.js) — 들어감 · 나감 · meta 가 바뀔 때
/* 🔔 «방이 바뀜»(들어감 · 나감 · meta) 알림 — 위층(🎧 같이 듣기 listen-ui.js)이 만든 뒤 onRoomChanged 로 건다. 이 모듈은 그쪽을 모른다(순환 막기). */
const _roomChangedFns = [];
function onRoomChanged(fn){ _roomChangedFns.push(fn); }
function _roomChanged(){ paintRoomInfo(); _roomChangedFns.forEach(f => f()); }
const mySecretRoom = deps.mySecretRoom;   // 내 시크릿룸 판정(room-lobby-provider.js — 로비와 같은 한 곳)
const roomSettings = deps.roomSettings;   // 방 설정 규칙(room-settings.js — 최대 인원 · 방장 닉네임)
const roomRt = deps.roomRt;   // 🛰 방 포트(room-rt.js TwRoomRt.store) — 입장 · 랜덤 · 들여다보기 · 연결의 나(myCode)
/* 서버 meta { channel, host(userCode), open, chatOff, secret, tabs, title?, max?, hostName?, music?, since } → 방 공용 상태 · 방장이 나로 바뀌면 알림 */
function _onServerRoomMeta(meta, prev){
  window._roomMetaCache = meta;
  window._activeChannel = (meta && meta.channel === 'togetherroom') ? 2 : 1;
  const me = roomRt.myCode();
  if(prev && meta && me && prev.host !== me && meta.host === me) window._onHostSucceeded(meta);
  window._onRoomMeta(meta);
  _roomChanged();
}
/* 💬 대화 기록(firebase-init chatHistory)이 «이 PC 에 저장할지» 를 가르는 채널 — 채널(window._activeChannel)을 바꾸는 곳이 이 파일이라 여기서 건다 */
function _bindChatHistoryChannel(){ firebaseAPI.chatHistory.bindChannel(()=>(window._activeChannel === 2 ? 'togetherroom' : 'workingroom')); }
TwNetReady.whenNetReady(_bindChatHistoryChannel);
/* 방 안에서 방을 놓은 까닭(room-rt onLost) → 안내. off(로그아웃 · 계정을 놓음)는 조용히. */
const ROOM_LOST_MSG = Object.freeze({
  unreachable: '서버 연결이 끊겨 방에서 나왔어요 — 잠시 후 다시 들어와 주세요',
  closed: '관리자가 방을 닫았어요',
  version: '최신 업데이트에서만 방을 이용할 수 있어요. 공지의 링크로 업데이트해 주세요.',
});
const ROOM_LOST_DEFAULT = '서버와 연결이 끊겨 방에서 나왔어요 — 다시 들어가 주세요';
function makeRoomProvider(create){
  return roomRt.makeProvider({
    serializeDef: serializeDefForNetwork,
    deserializeDef: deserializeDefFromNetwork,
    retryDefAfter,
    getExp: ()=>{ try{ return myExpCells(); }catch(_){ return undefined; } },
    onMeta: _onServerRoomMeta,
    onDisband: ()=>{ window._onRoomDisbanded(); },
    onReplaced: ()=>{ _onDeviceSessionLost(); },
    /* 방 안에서 이어 가지 못했다(오래 끊김 · 관리자 종료 · 판이 낮음 · 로그인 끊김) — 방에서 나온다. 다시 들어오면 서버가 같은 방으로 붙인다. */
    onLost: (code)=>{
      console.warn('[방] 방을 이어 가지 못했다 —', code);
      if(code !== 'off') toast(ROOM_LOST_MSG[code] || ROOM_LOST_DEFAULT);
      Promise.resolve(doLeaveRoom()).catch(()=>{});
    },
    // 끊긴 지 15초가 넘었다(true) · 다시 붙었다(false) — room-rt.js RECONNECT_NOTICE_MS
    onReconnecting: (on)=>{ toast(on ? '📡 서버 연결이 끊겨 다시 연결하는 중이에요…' : '서버에 다시 연결됐어요'); },
    onJoined: (room)=>{ try{ firebaseAPI.setPresenceRoom(room); }catch(_){} },
    onLeft: ()=>{ try{ firebaseAPI.setPresenceRoom(null); }catch(_){} },
  }, { create });
}
const ROOM_JOIN_BUSY_MSG = '서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요';
const ROOM_CONNECTING_TOAST_MS = 1000;   // 이만큼 지나도 못 붙었으면 «연결 중» 을 보인다(바로 붙으면 안 띄운다)
/* 입장 실패 코드(room-rt join · 서버 규약 7장) → 안내 문구 */
function _roomJoinMessage(code, isSecret){
  if(code === 'full') return isSecret ? ('이 방은 손님 자리가 다 찼어요(방장 자리 제외 최대 '+(maxPeople()-1)+'명)')
                                      : ('이 방은 이미 가득 찼어요(최대 '+maxPeople()+'명)');
  if(code === 'channelFull'){
    const ch = window._pendingRoomChannel || (_myRoomLicensed() ? 'togetherroom' : 'workingroom');
    return _channelFullMsg(ch);
  }
  if(code === 'secretClosed') return '없는 시크릿룸이거나 이용 기간이 끝났어요';
  if(code === 'forbidden') return '투게더룸은 라이선스가 있어야 열 수 있어요';
  if(code === 'title') return roomSettings.TITLE_ERROR_TEXT.banned;   // 서버가 금칙어로 거절(앱 목록이 늦었을 때)
  if(code === 'version') return ROOM_LOST_MSG.version;
  if(code === 'sessionLost') return '다른 기기에서 이 계정을 쓰는 중이에요 — «여기서 계속 쓰기» 를 누르면 이 PC 로 가져와요';
  return ROOM_JOIN_BUSY_MSG;
}
/* 빈 방을 열 때 채널을 정하는 자격 — 보유자(라이선스 · 관리자)면 투게더룸(서버도 같은 판정 · 접두어 고르기에 쓴다). */
function _myRoomLicensed(){ return !!((typeof isPremium()!=='undefined' && isPremium()) || (typeof isAdmin()!=='undefined' && isAdmin())); }
/* 랜덤 입장 후보 — 서버가 «공개 · 사람 있음 · 정원 안 찬» 워킹룸만 준다. 못 물으면 null(빈 목록 [] 과 다르게 그린다). */
function _randomRooms(limit){ return roomRt.random(limit, 'workingroom'); }

/* 🧪 가짜 방 — 친구들이 타이핑/졸기 하는 걸 보여 주는 로컬 시뮬레이션. 개발 표식(tw.mockRoom=1)이 있을 때만(Presence.start 주석). */
function _mockRoomAllowed(){ try{ return localStorage.getItem('tw.mockRoom') === '1'; }catch(_){ return false; } }
function makeMockProvider(){
  let timer=null, cb=null, fr={};
  const names=['민지','현우','소라'], skins=[2,3,4,1], tops=['#c98a8a','#8aa0c9','#9ac98a'];
  const pick=()=>{ const r=Math.random(); return r<0.55?'focus':(r<0.8?'idle':'sleep'); };
  const pickUs=()=>{ const r=Math.random(); if(r<0.65) return null;   // 65%는 상태 없음
    const arr=['meal','away','grind','gaming']; return arr[Math.floor(Math.random()*arr.length)]; };
  return {
    join(room, me, changeCb){ cb=changeCb;
      const n=2;   // 시연용 가짜 친구 2명
      for(let i=0;i<n;i++){ fr['mock'+i]={ name:names[i], def:mockFriendDef(me.def, skins[i%skins.length], tops[i%tops.length]), state:pick(), userStatus:pickUs(), level:1+Math.floor(Math.random()*40) }; }
      cb(Object.assign({},fr));
      timer=setInterval(()=>{ let ch=false;
        for(const id in fr){
          if(Math.random()<0.45){ fr[id].state=pick(); ch=true; }
          if(Math.random()<0.18){ fr[id].userStatus=pickUs(); ch=true; }   // 친구 활동상태도 가끔 변경
        }
        if(ch)cb(Object.assign({},fr));
      }, 3500);
    },
    update(payload){ /* 로컬 시연: 내 상태는 가짜 친구에게 전달되지 않음 (Firebase 단계에서 push) */ },
    poke(targetId, type){ if(fr[targetId]){ fr[targetId].poke={type, ts:Date.now()}; if(cb) cb(Object.assign({},fr)); } },
    // 🪄 로컬 시연에는 내 노드가 없다 — 자기 때리기는 로컬 재생으로 이미 끝나 있으므로 그냥 넘긴다
    pokeSelf(type){},
    leave(){ if(timer)clearInterval(timer); timer=null; fr={}; }
  };
}
function mockFriendDef(baseDef, skin, top){ baseDef=baseDef||{skin:1,face:null,blink:null,top:'#888',bot:'#666',xf:{}};
  return Object.assign({}, baseDef, { skin, top:top||baseDef.top, deskGlb:null, customItems:null, deskItems:null,
    xf:Object.assign({s:1,y:0,z:0,rot:0}, baseDef.xf||{}, {x:0}) }); }

/* friends 데이터 → 친구 좌석 추가/갱신/제거 */
// 캐릭터 "베이스"(꾸미기 파츠 제외) 정체성 지문 — 이 값이 바뀌면 얼굴/피부/모델 자체가 바뀐 것이므로
// 좌석을 통째로 다시 빌드(applyCharToSeat)해야 함. face/blink는 base64라 좀 크지만 이 비교는 Firebase
// 갱신 때만(초당 여러 번이 아님) 실행되므로 부담 없음.
function _charIdentityFingerprint(def){
  if(!def) return 'null';
  // ★ face/blink는 캔버스 객체라 JSON.stringify하면 전부 '{}'가 되어 비교에 아무 의미가 없었다.
  //   → 얼굴 그림만 바뀐 경우를 감지하지 못해 좌석이 옛 모델 그대로 남았다.
  //     캔버스는 크기로, 문자열(dataURL)은 길이+앞부분으로 가볍게 지문을 만든다(매 갱신마다 도는 비교라
  //     toDataURL 같은 무거운 호출은 피한다).
  // ★ animal 플래그도 빠져 있었다 — 인간↔동물 전환은 모델 자체가 바뀌는데 skin·top·bot이 같으면
  //   지문이 동일해서 재빌드가 안 됐고, 그 결과 인간 모델에 동물 얼굴 텍스처(투명 배경)만 갈아끼워졌다.
  const _imgSig = (v)=>{
    if(!v) return null;
    if(typeof v === 'string') return 's'+v.length+':'+v.slice(22,54);
    if(typeof v.toDataURL === 'function') return 'c'+(v.width||0)+'x'+(v.height||0);
    return 'o';
  };
  return JSON.stringify({
    skin: def.skin, top: def.top, bot: def.bot,
    animal: !!def.animal, animalFace: def.animalFace||0,
    animalEarL: def.animalEarL||null, animalEarR: def.animalEarR||null,
    /* 🐾 사람 귀 — defToBase·applyCharToSeat 가 읽어서 모양을 바꾸는 값(아래 동물 묶음과 같은 이유) */
    earL: def.earL||null, earR: def.earR||null, earAdj: def.earAdj||null,
    /* 그림은 URL 이면 통째로 — _imgSig 는 앞 32자만 보는데 Storage URL 은 그 자리가 전부 같다(동물 …Url 과 같은 처리) */
    earPicL: (typeof def.earPicL==='string' && !def.earPicL.startsWith('data:')) ? def.earPicL : _imgSig(def.earPicL),
    earPicR: (typeof def.earPicR==='string' && !def.earPicR.startsWith('data:')) ? def.earPicR : _imgSig(def.earPicR),
    animalBody: _imgSig(def.animalBody), animalBodyUrl: def.animalBodyUrl||null,
    /* ★ [제보] "F1 으로 캐릭터를 바꿔도 이미 방에 있는 상대 화면엔 반영되지 않는다."
       아래 네 묶음이 지문에서 빠져 있었다. 전부 animal.js buildAnimalBase 가 **실제로 읽어서
       모양을 바꾸는** 값이다 — 머리 본 스케일(animalScl) · 귀 위치/회전/크기(animalEarAdj) ·
       귀 페인트 · 감은눈. 보내는 쪽은 정상적으로 실어 보내는데, 받는 쪽 syncFriendSeats 가
       "정체성도 책상도 그대로"라고 판정해 applyCharToSeat 를 건너뛰고 equippedParts 비교로
       빠져나갔다. 그래서 **동물끼리의 교체·수정이 상대 화면에서 통째로 무시**됐다.
       (_deskStateFingerprint 쪽에도 없다 — 두 지문 어디에도 없던 값들이다.)
       ⚠️ 페인트·감은눈은 dataURL 이라 _imgSig 로 가볍게 잡는다. URL 판(방에서 온 def)은
         짧은 문자열이라 그대로 넣는다 — 둘 중 하나만 오므로 양쪽 다 봐야 한다. */
    animalScl: def.animalScl||null, animalEarAdj: def.animalEarAdj||null,
    animalEarPaintL: _imgSig(def.animalEarPaintL), animalEarPaintLUrl: def.animalEarPaintLUrl||null,
    animalEarPaintR: _imgSig(def.animalEarPaintR), animalEarPaintRUrl: def.animalEarPaintRUrl||null,
    /* 🐾 감은눈 귀도 buildAnimalBase 가 읽어서 모양을 바꾸는 값이다 — 위 네 묶음과 같은 이유로
       지문에 넣어야 친구 화면에서 수정이 반영된다. */
    animalEarBlinkL: _imgSig(def.animalEarBlinkL), animalEarBlinkLUrl: def.animalEarBlinkLUrl||null,
    animalEarBlinkR: _imgSig(def.animalEarBlinkR), animalEarBlinkRUrl: def.animalEarBlinkRUrl||null,
    animalBlink: _imgSig(def.animalBlink), animalBlinkUrl: def.animalBlinkUrl||null,
    // ★ commGlb/deskGlb는 base64 GLB라 수백KB~수MB짜리 문자열이다. 예전엔 이걸 통째로 JSON.stringify에
    //   넣어서, 친구 상태가 갱신될 때마다(방 인원수 × 갱신 횟수) 그 길이만큼 문자열을 새로 만들고 비교했다.
    //   위 _imgSig와 같은 방식(길이+앞부분 지문)으로 바꿔도 "다른 GLB인가" 판정은 그대로다.
    isCommission: def.isCommission, commGlb: _imgSig(def.commGlb),
    deskCatalogId: def.deskCatalogId, deskGlb: _imgSig(def.deskGlb),
    face: _imgSig(def.face), blink: _imgSig(def.blink),
    faceUrl: def.faceUrl||null, blinkUrl: def.blinkUrl||null,
  });
}
// ★ 어플 11: 책상·아이템 관련 필드만의 지문 — 생성기에서 책상 색/크기/길이/아이템/캐릭터 변형(xf)을 바꾸고
//   완료를 눌렀을 때, 캐릭터 전체 재빌드 없이 이 부분만 가볍게 다시 적용하기 위해 별도 지문으로 분리.
function _deskStateFingerprint(def){
  if(!def) return 'null';
  return JSON.stringify({
    deskColor: def.deskColor, deskScale: def.deskScale, deskLenX: def.deskLenX, deskPos: def.deskPos,
    deskItems: def.deskItems, xf: def.xf, decor: def.decor,
  });
}
// (책상 변경도 완료 저장 시에만 오는 이벤트라, 부분 재적용 대신 applyCharToSeat 전체 재빌드로 처리 —
//  캐릭터 xf 적용 로직이 커미션 오프셋 등과 얽혀 있어서 부분 재적용은 오차 위험이 큼)
/* 🐾 친구들이 보내온 ridingOn(식별자)을 실제 좌석 관계로 잇는다.
   ★ 팔 높이(_rideArmH)·대상 머리 꼭대기(_rideHeadTop)는 전송하지 않는다 — 상대 캐릭터가 내 화면에
     그대로 있으므로 받는 쪽에서 직접 실측하는 편이 정확하고 데이터도 안 늘어난다.
   ★ 각자 '바로 아래'만 보내므로, 이 연결만으로 다층 탑이 자동 재구성된다. */
/* 🪑 친구들이 보내온 seatedOn({host,slot})을 실제 벤치 슬롯 관계로 잇는다.
   host는 상대의 userId(또는 'self'). 'self'는 자기 벤치에 자기가 앉은 경우 — 방에선 표현 대상이 없어 무시.
   host가 나(myUid)면 내 벤치, 아니면 그 userId를 가진 친구 좌석의 벤치. */
function _applyRemoteBenchSeats(){
  try{
    const me = seats.find(x=>x.isMe);
    const myUid = getMyUserId();
    const byUser = {};
    seats.filter(x=>x.remote && x.friendUserId).forEach(x=>{ byUser[x.friendUserId]=x; });
    seats.filter(x=>x.remote).forEach(seat=>{
      const want = seat._remoteSeatedOn;
      if(!want || want.host==='self'){ if(seat.seatedOn) rideBenchMod.unmountBench(seat); return; }
      const host = (myUid && want.host===myUid) ? me : (byUser[want.host] || null);
      if(!host || !host.bench){ if(seat.seatedOn) rideBenchMod.unmountBench(seat); return; }
      if(seat.seatedOn===host && seat.seatSlot===(want.slot|0)) return;   // 이미 반영됨
      if(seat.seatedOn) rideBenchMod.unmountBench(seat);
      rideBenchMod.mountBench(seat, host, want.slot|0);
    });
  }catch(_){}
}
function _applyRemoteRides(){
  try{
    const me = seats.find(x=>x.isMe);
    const myUid = getMyUserId();
    const byUser = {}, byFriend = {};
    seats.filter(x=>x.remote).forEach(x=>{ byFriend[x.friendId]=x; if(x.friendUserId) byUser[x.friendUserId]=x; });
    seats.filter(x=>x.remote).forEach(seat=>{
      /* 🗼 날아가는 중인 좌석은 건드리지 않는다 — 탑에서 튕겨 나간 직후, 주인의 «아직 타고 있음» 이 늦게 도착하면
         비행 도중에 머리 위로 다시 붙는다. 주인의 새 값(ridingOn 없음)은 이미 우리 화면의 로컬 상태와 같다. */
      if(seat.fly) return;
      const want = seat._remoteRidingOn;
      //  'self' = 보낸 사람이 자기 자신 위에 탄 경우. 방에서는 사람당 좌석이 하나라 표현할 대상이 없어 무시.
      //  ★ 버그 수정(입장 시 동물이 내려오던 문제): '타고 있지 않다(want 없음/self)'와 '타고 있다는데
      //     이번 사이클엔 대상 좌석을 아직 못 찾음(입장 직후 매핑 미완)'을 구분한다. 후자에서 하차시키면
      //     누가 입장할 때마다 순간적으로 동물이 내려앉는다 → 대상을 못 찾으면 현 상태 유지하고 다음 sync에 재시도.
      if(!want || want === 'self'){ if(seat.ridingOn){ try{ rideBenchMod.unmountRide(seat); }catch(_){} } return; }
      const target = (myUid && want === myUid) ? me : (byUser[want] || byFriend[want] || null);
      if(!target) return;                                  // 일시적 조회 실패 — 내리지 않고 유지(다음 sync에 반영)
      /* 이미 같은 상태면 건드리지 않음(재실측 방지). 파츠가 바뀐 뒤의 높이 다시 재기는 여기서 판단하지 않는다 —
         파츠를 붙이고 떼는 자리가 refitSeatAfterParts · requestRefit(seat-refit.js)으로 그 좌석과 탄 대상 높이를 다시 잰다(판단은 그 한 곳). */
      if(seat.ridingOn === target) return;
      if(target===seat || rideBenchMod._rideIsAbove(target, seat)) return;   // 순환 방지
      try{ seat.ridingOn = null; rideBenchMod.mountRide(seat, target); }catch(_){}
    });
  }catch(_){}
}
function syncFriendSeats(friends){
  friends=friends||{};
  const ids=Object.keys(friends).slice(0, maxPeople()-1);   // 친구는 최대 9(나 제외)
  const have={}; seats.filter(s=>s.remote).forEach(s=>{ have[s.friendId]=s; });
  Object.keys(have).forEach(id=>{ if(!friends[id]){ const s=have[id]; scene.remove(s.group); removeSeatLabels(s); const ix=seats.indexOf(s); if(ix>=0)seats.splice(ix,1); } });
  ids.forEach(id=>{ let s=have[id];
    if(!s){
      s=createSeat(); s.remote=true; s.friendId=id; s.friendUserId=friends[id].userId||null; applyCharToSeat(s, friends[id].def);
      // ★ 방금 막 생긴 좌석(=처음 보거나, 재접속으로 다시 생긴 좌석)은 상대방이 이미 예전에 보냈던
      //   poke/chat 값을 "방금 온 새 이벤트"로 착각해서 재생해버리는 문제가 있었음(재접속하면 dizzy가
      //   재생되던 원인). 생성 시점의 값으로 미리 "이미 봤다"고 표시해서 진짜 새 이벤트만 재생되게 함.
      s._lastPokeTs = (friends[id].poke && friends[id].poke.ts) || null;
      s._lastChatTs = (friends[id].chat && friends[id].chat.ts) || null;
      s._lastChatTabTs = (friends[id].chatTab && friends[id].chatTab.ts) || null;   // 💬 들어오기 전 탭 말풍선은 다시 안 띄운다
      s._lastEquipJSON = JSON.stringify((friends[id].def && friends[id].def.equippedParts) || null);
      s._lastIdentityJSON = _charIdentityFingerprint(friends[id].def);
      s._lastDeskJSON = _deskStateFingerprint(friends[id].def);
    } else {
      /* 🆔 유저 ID 는 좌석을 **만들 때 한 번만** 채워 넣는다. 그래서 그 순간 friends[id].userId 가
         아직 없었으면 그 좌석은 영영 null 로 남는다 — 📷 스티커사진의 _pkSeatOf 가 이 값으로
         남의 좌석을 찾으므로, null 인 좌석은 **무대에 영영 안 선다**(참가자 칸에는 이름이 뜬다).
         뒤늦게 도착했으면 여기서 채운다. 이미 있으면 손대지 않는다. */
      if(!s.friendUserId && friends[id].userId) s.friendUserId = friends[id].userId;
      const fdef = friends[id].def;
      // ★ 캐릭터 자체(피부/얼굴/옷 색/커미션 모델 등)가 바뀌었으면 — 꾸미기 파츠만 비교해서는 이걸
      //   놓침(예전엔 "캐릭터 교체"를 해도 이미 접속해 있던 상대 화면엔 전혀 안 바뀌던 원인). 이런 경우엔
      //   가볍게 파츠만 다시 적용하는 걸로는 부족해서, applyCharToSeat로 통째로 다시 빌드함.
      const newIdentityJSON = _charIdentityFingerprint(fdef);
      const newDeskJSON = _deskStateFingerprint(fdef);
      if(newIdentityJSON !== s._lastIdentityJSON || newDeskJSON !== s._lastDeskJSON){
        // ★ 어플 11: 캐릭터 정체성(모델/얼굴 등)뿐 아니라 책상 색/크기/길이/아이템/캐릭터 변형(xf)이 바뀌어도
        //   통째로 다시 빌드 — 생성기에서 '완료'를 눌러 저장한 책상·아이템 변경이 방 안 사람들에게 즉시 보임.
        s._lastIdentityJSON = newIdentityJSON;
        s._lastDeskJSON = newDeskJSON;
        applyCharToSeat(s, fdef);
        s._lastEquipJSON = JSON.stringify((fdef && fdef.equippedParts) || null);   // applyCharToSeat 안에서 파츠도 같이 적용되므로 최신값으로 맞춰둠
      } else {
        // ★ 이미 접속해 있던 친구가 꾸미기 파츠만 바꾸면(toggleEquip/상세조정 저장) 새 def가 여기로 들어오는데,
        //   지금까지는 이름/레벨/상태만 갱신하고 캐릭터 외형(꾸미기 파츠)은 전혀 다시 반영하지 않고 있었음
        //   — 그래서 "이미 방에 있는 상대"의 실시간 꾸미기 변경이 안 보이던(또는 불안정하던) 근본 원인.
        //   실제로 바뀐 경우에만(불필요한 재적용 방지) 카테고리별로 비교해서 해제/재장착.
        const newEq = (fdef && fdef.equippedParts) || {};
        const newEquipJSON = JSON.stringify(newEq);
        if(newEquipJSON !== s._lastEquipJSON){
          s._lastEquipJSON = newEquipJSON;
          s.charDef = fdef;
          pruneSeatPartsAgainstDef(s, fdef);   // 뺀 파츠 해제 — 🔗 stackable id 단위 포함 (상대 화면 실시간 반영)
          /* 🦶 파츠가 바뀌면 발밑 깊이도 바뀐다 — 여기서도 다시 맞춰야 한다.
             ⚠️ 이 경로가 빠져 있었다. **이미 방에 있던 사람**이 욕조를 다는 경우가 여기로 들어오는데,
               파츠만 붙이고 fitModel 을 안 불러서 내 화면에서는 그 사람만 욕조가 바닥에 파묻힌 채로
               남았다(다른 사람은 applyCharToSeat 경로라 재계산이 있었다 — 그래서 '하나만' 어긋난다).
               욕조를 벗는 쪽도 마찬가지로 뜬 채 남는다.
             ★ 레이스 가드는 applyCharToSeat 와 같은 이유·같은 조건이다 — 파츠 GLB 가
               비동기로 붙는 동안 그 사람이 나가거나 캐릭터를 바꾸면 낡은 좌석에 뒤늦게 발사된다. */
          refitSeatAfterParts(s, { wait: applyEquippedPartsToSeat(s, fdef), layout: true, isCurrent: ()=>s.charDef===fdef });   // 남아있는/새로 생긴 파츠는 적용(교체 포함)
        }
      }
    }
    s.friendName=friends[id].name; s.remoteState=friends[id].state; s.remoteUserStatus=friends[id].userStatus||null;
    s.remoteDanceStyle = friends[id].danceStyle || null;   // 💃 친구가 추는 춤 종류 — animateRig의 dance 분기용
    s._remoteRidingOn = friends[id].ridingOn || null;   // 🐾 누구 위에 타고 있는지(식별자) — 아래에서 좌석 관계로 복원
    s._remoteSeatedOn = friends[id].seatedOn || null;   // 🪑 어느 벤치 슬롯에 앉았는지 {host,slot}
    // 🪑 친구가 벤치를 놨으면 그 좌석에도 같은 벤치를 만들어(내 화면에 보이게, 개인 책상 숨김), 치웠으면 복귀.
    {
      const wb = friends[id].bench || null;                       // {seats,deskId} | (구버전)숫자 | null
      const wantSeats = wb ? (typeof wb==='object' ? (wb.seats||2) : wb) : null;
      const wantDeskId = (wb && typeof wb==='object') ? (wb.deskId||null) : null;
      const haveSeats = s.bench ? (s.bench.userData.benchSeatCount||2) : null;
      if(wantSeats && (wantSeats!==haveSeats || s.benchDeskId!==wantDeskId)){ rideBenchMod.attachBenchToSeat(s, wantSeats, wantDeskId); }
      else if(!wantSeats && haveSeats){ seats.filter(o=>o.seatedOn===s).forEach(rideBenchMod.unmountBench); s.group.remove(s.bench); s.bench=null; s.benchSlots=null; s.benchDeskId=null; s.benchOccupants={}; s._benchOwnerSit=false; s._benchSit=false; if(s.desk) s.desk.visible=true; }
    }
    s.remoteMobile=focusLevelMod()._mobileCleanApp(friends[id].mobile);   // 📱 폰에서 쓰는 앱 이름(없으면 빈 문자열 · 구버전은 칸이 없다)
    s.remoteCustomStatus=friends[id].customStatus||null;   // ✨ 친구의 커스텀 상태 문구 {emo,text}
    s.remoteAwayImg=awayPicMod()._awayUrlOk(friends[id].awayImg) ? friends[id].awayImg : null;   // 🫧 자리비움 그림(Storage URL 만)
    s.remoteAwaySz=awayPicMod()._awaySzOk(friends[id].awaySz) ? friends[id].awaySz : null;          // 📏 그 그림의 화면 크기(없으면 기본 · 구버전)
    s.remoteNoise=(typeof friends[id].noise === 'string' && /^(pencil|keyboard|page)$/.test(friends[id].noise)) ? friends[id].noise : null;   // 🌙 백색소음 종류 — 모르는 값은 버린다(parts/noise.js 가 읽는다)
    s.friendLevel=friends[id].level||1;
    s.friendStar=focusLevelMod().starFromRemote(friends[id]);   // 🌟 회차 · 이번 바퀴 레벨 · 색(모르는 값은 버린다 · 옛 판은 null)
    /* ⭐ 상대 경험치 진행도(0~12칸). 구버전 상대는 이 필드가 없어서 undefined → null로 두고 바를 안 그린다.
       0으로 채우면 상대가 "방금 레벨업했다"로 잘못 읽힌다. */
    s.friendExp = (friends[id].exp==null) ? null : Math.max(0, Math.min(EXP_CELLS(), friends[id].exp|0));
    // poke(누군가 이 친구를 쓰다듬거나 흔들었다는 알림) — ts가 새로 바뀐 경우에만 1회 재생(중복 방지)
    const poke=friends[id].poke;
    /* 🛰 ts 는 **앞으로만 간다**. 예전엔 `!==` 였는데, 그러면 낡은 값이 늦게 도착했을 때
       "직전과 다르다"는 이유로 새 이벤트가 되어 이미 지난 fly 가 다시 재생됐다.
       위(makeFirebaseProvider)에서 낡은 스냅샷을 버리는 것이 1차 방어고, 이건 2차 방어다 —
       한 겹만 두면 다른 경로(재접속 재배달 등)로 같은 사고가 다시 난다. */
    if(poke && poke.ts && poke.ts > (s._lastPokeTs || 0)){
      s._lastPokeTs=poke.ts;
      /* 🛰 지나간 알림은 재생하지 않는다 — 다만 위에서 '봤다'고 표시는 해 둔다.
         [왜 표시부터 하나] 표시를 안 하면 낡은 값이 배달될 때마다 이 검사를 다시 거치게 되고,
           나중에 시계가 흔들려 한 번이라도 통과하는 순간 재생된다. 한 번 본 값은 낡았든 아니든 끝이다. */
      if(_pokeFresh(poke.ts)){
      if(poke.type==='pet'){ triggerPet(s); for(let i=0;i<FLOATER_BURST;i++) setTimeout(()=>spawnFloater('♥','#f2607d',s),i*320); }
      else if(poke.type==='dizzy'){ s.dizzyUntil=performance.now()+2500; for(let i=0;i<FLOATER_BURST;i++) setTimeout(()=>spawnFloater('💫','#f5a94f',s),i*300); }
      /* 🪑 플라잉체어 — 이 친구가 날아간다. 시드가 같으므로 방 안의 모든 화면이 같은 궤적을 그린다.
         던진 사람의 화면도 이 경로로 들어온다(자기 화면에서 미리 재생하지 않는다). */
      else if(typeof poke.type==='string' && poke.type.indexOf('fly:')===0){ tricksMod.applyRemoteFly(s, poke.type.slice(4)); }
      /* 🪄 이 친구가 맞았다(남이 때렸든, 자기가 자기를 때렸든).
         ⚠️ 수신 분기가 **두 곳**이다 — 여기만 고치면 "내가 남을 때린 게 안 보이는" 반쪽이 된다. */
      else if(typeof poke.type==='string' && poke.type.indexOf('bonk:')===0){ tricksMod.applyRemoteBonk(s, poke.type); }
      }
    }
    /* 🪑 이 친구가 "쉬는 중"인 시각(ms). 맞은 본인이 판정해 실어 보낸 값이라 방 전체가 같은 값을 본다. */
    s.remoteFlyCool = friends[id].flyCool || 0;
    s.chatTabId = window.ChatTabs ? ChatTabs.tabOf(friends[id]) : 'general';   // 💬 이 사람이 있는 채팅 탭
    // 💬 채팅 — ts가 새로 바뀐 경우에만 말풍선으로 잠깐 표시(중복 재생 방지)
    const chat=friends[id].chat;
    if(chat && chat.ts && chat.ts!==s._lastChatTs){
      s._lastChatTs=chat.ts;
      // 🚫 채널 개편: 투게더룸 외(채널1=워킹룸)에서는 "텍스트" 채팅 말풍선을 표시하지 않음.
      //   😊 단, 기본 이모티콘 단독 마커([demoji:id] 하나뿐인 메시지)는 모든 방에서 허용 —
      //   채팅 없는 워킹룸의 가벼운 감정 표현용(상태칩 😊 버튼). 텍스트가 섞이면 여전히 차단(일에 집중).
      const _demojiOnly = /^\s*\[demoji:d\d{2}\]\s*$/.test(String(chat.text||''));
      /* 🌊 날리기 — 보낸 사람이 체크한 줄은 말풍선 대신 화면을 가로지른다.
         ★ 채널 조건은 `_activeChannel === 2` **한 줄**이다. 시크릿룸은 언제나 투게더룸으로 열리므로
           (_enterRoom 의 _isSecret 분기 → _channel='togetherroom') 이 한 줄이 곧 "투게더룸+시크릿룸"이다.
           조건을 늘리지 말 것 — _chatDelRefreshUI 주석과 같은 규칙이고, 늘리면 서로 어긋난다.
         ★ 워킹룸(채널1)에서는 fly 가 실려 와도 무시하고 아래 기존 분기로 떨어진다.
           거기서 이모티콘 단독이 아니면 아무것도 안 뜬다 — 「일에 집중」 규약 그대로다.
         ⚠️ 레벨 확인이 **여기** 있다. 보내는 쪽 체크는 UI 편의일 뿐이고, 실제로 색을 인정할지는
           방이 다 같이 보고 있는 friends[id].level 로 받는 쪽이 정한다. */
      /* 🏢 회사원 모드 — **보는 사람 기준**(플라잉체어·효과음과 같은 규칙). 상대가 날려도 내 화면에선
           아래 말풍선/한 줄 라벨 분기로 떨어진다. 던진 사람이 회사원 모드가 아니면 그 화면에선 정상으로 날아간다. */
      let _chatShown = false;
      /* 💬 #일반 말풍선 · 날리기는 #일반에 있는 사람에게만 — 다른 탭에 있으면 안 띄운다(기본 이모티콘 단독은 방 전체 몸짓이라 그대로). */
      const _onGeneral = chatUiMod._chatMyTabId() === 'general';
      if(!_onGeneral && !_demojiOnly){ /* 다른 탭 — 띄우지 않는다 */ }
      else if(chat.fly && window._activeChannel === 2 && !(typeof officeMode() !== 'undefined' && officeMode()) && typeof chatUiMod.showFlyText==='function'){
        chatUiMod.showFlyText(s, chat.text, (friends[id].level|0) >= chatUiMod.FLY_COLOR_LEVEL ? chat.flyColor : '', chat.flySize);
        _chatShown = true;
      }
      else if((window._activeChannel === 2 || _demojiOnly)){ showChatBubble(s, chat.text); _chatShown = true; }
      /* 🔔 알림음 — 상대 채팅이 **화면에 뜬 경우에만** 울린다. 워킹룸에서 걸러진 글자처럼 안 뜬 것은 조용하다.
         ★ 워킹룸(채널1)은 이모티콘 말풍선이 떠도 조용하다 — 일에 집중하는 방이라 소리로 끊지 않는다.
         ⚠ 여기가 유일한 자리다. chatLog 구독(대화창)에도 걸면 한 줄에 두 번 울린다. */
      if(_chatShown && window._activeChannel === 2) _chatNotifyIncoming();
    }
    /* 💬 채팅 탭 말풍선 — **내 탭과 같을 때만** 띄운다(sim-chat-tabs ②). 투게더룸 · 시크릿룸에서만.
       ⚠️ 날리기 · 말풍선 · 알림음 분기는 위 `chat` 과 같은 규칙이다 — 한쪽만 고치지 말 것. */
    const ctab = friends[id].chatTab;
    if(ctab && ctab.ts && ctab.ts !== s._lastChatTabTs){
      s._lastChatTabTs = ctab.ts;
      if(window._activeChannel === 2 && ctab.tab === chatUiMod._chatMyTabId()){
        let _shown = false;
        if(ctab.fly && !(typeof officeMode() !== 'undefined' && officeMode()) && typeof chatUiMod.showFlyText==='function'){
          chatUiMod.showFlyText(s, ctab.text, (friends[id].level|0) >= chatUiMod.FLY_COLOR_LEVEL ? ctab.flyColor : '', ctab.flySize); _shown = true;
        }else showChatBubble(s, ctab.text); _shown = true;
        if(_shown) _chatNotifyIncoming();
      }
    }
  });
  _applyRemoteRides();   // 🐾 친구들의 올라타기·탑쌓기 관계를 좌석에 반영(좌석이 다 만들어진 뒤에)
  _applyRemoteBenchSeats();   // 🪑 친구들의 벤치 앉기 관계 반영
  if(typeof rideBenchMod.restoreInteractionDesk==='function') rideBenchMod.restoreInteractionDesk();   // 🔄 재입장 시 내 상호작용 책상 복원(1회)
  layoutSeats(); renderSeatTabs();
  // ★ 멀티모드 진입/친구 입퇴장으로 좌석 배치가 바뀌면 카메라도 같이 바뀌는데, 상태칩이 다음 프레임까지
  //   기다렸다가 갱신되면 그 사이 잠깐 어긋난 위치(화면 밖으로 밀린 것처럼 보임)가 노출될 수 있어서 즉시 갱신.
  updateMyStatusChipPosition();
}

/* 초대 UI 연결 */
/* 🏷️ [2026-10-02 #9] 방 코드 접두어를 채널로 가른다 — 워킹룸 WORK- · 투게더룸 PLAY- (예전: 둘 다 COZY-).
   ★ 접두어는 «이 방이 지금 어느 채널인가»를 코드에 드러내는 표시다. 채널의 진짜 출처는 여전히
     서버 `rooms/$room/_meta.channel` 이고, 둘이 갈라지는 유일한 순간(빈 방 승격)에는 startRoom 이
     코드 쪽을 채널에 맞춰 바꾼다(_roomPrefixSwap).
   ⚠️ COZY- 는 **옛 방**이다. 사람이 남아 있는 동안은 그대로 들어갈 수 있고(구버전이 아직 거기 있다),
     비면 들어가는 사람의 자격대로 WORK-/PLAY- 로 옮겨 연다 — 자동 이관.
   ⚠️ 친구코드(MATE-/옛 COZY-)와는 별개다. 그쪽 COZY 하위호환(_friendCodeCandidates 등)은 건드리지 말 것. */
const ROOM_PREFIX = { workingroom:'WORK-', togetherroom:'PLAY-' };
const ROOM_CODE_RE = /^(COZY|WORK|PLAY)-([A-Z0-9]{4})$/;
/* 코드 본문(접두어 뺀 4자리) — 규칙 rooms/$room 이 XXXX-XXXX 만 받는다. 다른 길이로 들어가면 쓰기가 전부 조용히 거절돼 아무도 없는 방이 된다. */
const ROOM_CODE_BODY_RE = /^[A-Z0-9]{4}$/;
function _roomPrefixFor(channel){ return ROOM_PREFIX[channel] || ROOM_PREFIX.workingroom; }
/* 빈 방을 열 때 내가 갖게 될 채널의 접두어 — 빈 방 승격 규칙(보유자=투게더룸)과 **같은 판정**이어야 한다. */
function _myRoomPrefix(){
  const lic = (typeof isPremium()!=='undefined' && isPremium()) || (typeof isAdmin()!=='undefined' && isAdmin());
  return _roomPrefixFor(lic ? 'togetherroom' : 'workingroom');
}
function genRoomCode(channel){ const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=_roomPrefixFor(channel); for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)]; return s; }
function presenceChanged(friends){
  const cnt=Object.keys(friends).length;
  const lbl=document.getElementById('inviteFriendCnt'); if(lbl)lbl.textContent=cnt?('· 친구 '+cnt+'명 접속'):'';
  const flbl=document.getElementById('fsInviteFriendCnt'); if(flbl)flbl.textContent=cnt?('· 친구 '+cnt+'명 접속'):'';
  if(seats.some(s=>s.isMe)) syncFriendSeats(friends);
  // 💬 탭별 인원 · 멤버 줄은 사람이 오가거나 탭을 옮길 때 바뀐다
  try{ if(chatUiMod._chatWindowIsOpen()){ chatUiMod._chatTabsRender(); _refreshChatMembers(); } }catch(_){}
}
/* 📅 시크릿룸 만료일 표시용 — 입장 게이트(startRoom)와 관리자 발급 화면이 같은 형식을 쓴다.
   YYYY-MM-DD. 후원자에게 불러줄 값이라 로컬 시간대 기준으로 찍는다(toISOString은 UTC라 하루 어긋난다). */
function _srFmtDate(ms){
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/* 🔒 F1 «멀티모드» 탭의 시크릿룸 칸 — 내 시크릿룸이 있으면 펼치고 코드를 채워 둔다(입장 한 번 · 손님 수는 안 읽는다).
   자주 불리지만(refreshInviteUI) 판정은 세션에 한 번 기억된 값이라 읽기가 늘지 않는다.
   «내 시크릿룸» 판정(pub.owner 가 나 · 만료 전)은 로비와 같은 한 곳(room-lobby-provider.js mySecretRoom)을 쓴다.
   코드를 공유받은 친구는 칸이 안 보여도 된다 — COZY 칸에 «1234*» 로 넣으면 시크릿룸으로 간다. */
/* 🎧 «내 시크릿룸을 같이 듣기로 열기» — 이 기기에 기억(한 계정 한 기기 · 로그아웃 때 지움 account.js). 주인이 빈 방을 열 때 _meta.music 으로 쓴다. */
const SECRET_MUSIC_KEY = 'tw.secretRoomMusic';
function _secretMusicOn(){ try{ return localStorage.getItem(SECRET_MUSIC_KEY) === '1'; }catch(_){ return false; } }
/* 🎧 시크릿룸을 «연다» = 주인이 아무도 없는 방에 들어갈 때만 — 그때만 같이 듣기를 정한다(Firebase 길 · 방 서버 길이 같은 판정).
   손님이 들어올 때마다 정하면 듣던 곡이 지워진다 · 인원을 못 셌으면(null) 정하지 않는다. → { music } | undefined */
function _secretOpenFields(isOwner, othersCount){ return (isOwner && othersCount === 0) ? { music: _secretMusicOn() } : undefined; }
{ const c=document.getElementById('fsSecretMusic'); if(c) c.addEventListener('change', ()=>{ try{ localStorage.setItem(SECRET_MUSIC_KEY, c.checked ? '1' : '0'); }catch(_){} }); }
function _refreshSecretRoomUI(){
  const w=document.getElementById('fsInviteSecretWrap'); const inp=document.getElementById('fsInviteSecretCode');
  if(!w) return;
  Promise.resolve(mySecretRoom()).then(s=>{
    w.style.display = s ? 'flex' : 'none';
    const mr=document.getElementById('fsSecretMusicRow'), mc=document.getElementById('fsSecretMusic');
    if(mr) mr.style.display = s ? '' : 'none';
    if(mc) mc.checked = _secretMusicOn();
    if(s && inp && !inp.value) inp.value=s.code.replace(/^SCRT-/,'');
  }).catch(()=>{});
}
let _hoppingRoom = false;   // 🎲 방 갈아타기 중(아래 doHopRandomRoom) — refreshInviteUI 도 읽어서 여기 둔다
let _wasInRoom = false;   // 방 안 → 밖으로 바뀐 순간을 잡는다(모달이 열린 채 나가면 로비가 다시 읽어야 한다)
function refreshInviteUI(){ const on=Presence.active();
  // 갈아타는 동안(나갔다 바로 들어감)은 «나온 순간» 이 아니다 — 끝에 finally 가 다시 부를 때 판정한다(실패해 밖에 남으면 그때 알림)
  const left = !_hoppingRoom && _wasInRoom && !on;
  if(!_hoppingRoom) _wasInRoom = on;
  _refreshSecretRoomUI();
  document.getElementById('inviteIdle').style.display=on?'none':'';
  document.getElementById('inviteActive').style.display=on?'':'none';
  if(on) document.getElementById('inviteRoomLbl').textContent=Presence.roomCode();
  // ★ 설정 패널 "멀티모드" 탭 안에 인라인으로 넣어둔 동일한 UI도 같이 갱신 — 모달(inviteOverlay)이든
  //   설정 패널 탭이든 어느 쪽에서 방을 만들거나 나가도 둘 다 항상 일치된 상태를 보여줌.
  const fi=document.getElementById('fsInviteIdle'), fa=document.getElementById('fsInviteActive');
  if(fi) fi.style.display=on?'none':'';
  if(fa) fa.style.display=on?'':'none';
  const flbl=document.getElementById('fsInviteRoomLbl'); if(on && flbl) flbl.textContent=Presence.roomCode();
  /* 🎲 방 갈아타기 버튼 — 워킹룸에 있을 때만 보인다.
     투게더룸·시크릿룸에서는 숨긴다: 라이선스로 연 방이나 후원 특전 방을 버리고 모르는 사람 방으로
     가는 건 이 버튼의 용도가 아니고, findRandomRooms 도 워킹룸만 후보로 준다. */
  const _hopOn = on && (window._activeChannel !== 2);
  ['inviteHopRandom','fsInviteHopRandom'].forEach(id=>{
    const b=document.getElementById(id); if(b) b.style.display = _hopOn ? '' : 'none';
  });
  _roomChanged();
  // 모달이 열린 채 방을 나왔으면 로비가 이제 보인다 — 방 안에서 열었을 땐 안 읽었으니 지금 읽게 알린다
  if(left && document.getElementById('inviteOverlay').classList.contains('on')) twNav.go(twNav.NAV.ROOM_LOBBY);
}
// 🚪 버전 게이트 — semver "a" < "b" 이면 true. (숫자 3파트 비교, 누락은 0)
function _verLt(a,b){
  const pa=String(a).split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b).split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){ if((pa[i]||0)<(pb[i]||0)) return true; if((pa[i]||0)>(pb[i]||0)) return false; }
  return false;
}
/* 방 입장 허용 여부 — 내 앱 버전 < 원격 설정 room.minVersion 이면 막고 안내(서버도 같은 값으로 join 을 version 으로 거절한다 — 여기는 먼저 알려 주는 몫).
   웹/개발 환경(companion 없음)이나 조회 실패는 통과(오탐 방지). */
const ROOM_VER_MAX_AGE_MS = 60 * 1000;   // 입장 때 원격 설정이 이보다 오래됐으면 한 번 더 묻는다
async function _ensureRoomVersionOk(){
  try{
    if(!(window.companion && companion.getAppVersion)) return true;
    const my  = await companion.getAppVersion();
    const s = _rcStore();
    if(!s) return true;
    try{ await s.refresh({ maxAgeMs: ROOM_VER_MAX_AGE_MS }); }catch(_){}
    const min = s.minRoomVer();
    if(my && min && _verLt(my, min)){
      toast(ROOM_LOST_MSG.version);
      return false;
    }
  }catch(_){ /* 조회 실패는 통과 */ }
  return true;
}
/* 🔒 내 시크릿룸이 이 코드인가 — { code, name, expiresAt } | null(로비와 같은 한 곳 · 세션에 한 번 읽는다) */
async function _mySecretRoomOf(code){
  let s = null;
  try{ s = await mySecretRoom(); }catch(_){ s = null; }
  return (s && s.code === code) ? s : null;
}
/* 📅 내 시크릿룸 기간이 7일 안으로 남았으면 들어가기 전에 한 번 알린다 — 그냥 안 되는 날이 오는 것보다 낫다 */
const SECRET_EXPIRY_WARN_DAYS = 7;
function _warnSecretExpiry(expiresAt){
  if(!(typeof expiresAt === 'number' && expiresAt > Date.now())) return;
  const left = Math.ceil((expiresAt - Date.now()) / 86400000);
  if(left <= SECRET_EXPIRY_WARN_DAYS) toast('🔒 이 시크릿룸은 ' + left + '일 뒤 만료돼요 (' + _srFmtDate(expiresAt) + ')');
}
async function startRoom(code){
  if(window._deviceSessionLost){ toast('다른 기기에서 이 계정을 쓰는 중이에요 — «여기서 계속 쓰기» 를 누르면 이 PC 로 가져와요'); return; }   // 🖥️ 한 계정 한 기기
  if(!(await _ensureRoomVersionOk())) return;   // 🚪 구버전 방 입장 차단(생성·참여·초대수락 공통 길목)
  const myDef=slots[curSlot()]||slots.find(Boolean);
  if(!myDef){ toast('먼저 내 캐릭터를 만들어 주세요'); return; }
  /* 🔒 시크릿룸 — 발급 · 기간 · 정원(방장은 정원 밖) · 방장 고정은 서버가 판정한다(secretClosed · full).
     여기서는 «내 방을 아무도 없을 때 연다» 만 가른다 — 그때만 같이 듣기를 정한다(서버는 시크릿룸 create 에서 music 만 본다). */
  const isSecret = /^SCRT-/.test(code);
  const creating = !!window._pendingRoomChannel && !isSecret;
  let srOpen;
  if(isSecret){
    const mine = await _mySecretRoomOf(code);
    if(mine){
      _warnSecretExpiry(mine.expiresAt);
      const pk = await roomRt.peek(code);
      srOpen = _secretOpenFields(true, pk ? (pk.exists ? pk.count : 0) : null);
    }
  }
  // 방 만들기 창이 고른 값 — 공개는 두 채널 모두 · 제목 · 최대 인원 · 같이 듣기(방장 이름은 서버가 정한다)
  const create = roomSettings.serverJoinCreate(creating, window._pendingRoomChannel, !!window._pendingRoomOpen, _pendingExtra, srOpen);
  _clearHiddenSeats();   // 🙈 숨김은 그 방에 있는 동안만
  const t = setTimeout(()=>{ if(!roomRt.isReady()) toast('📡 서버에 연결하는 중…'); }, ROOM_CONNECTING_TOAST_MS);
  let r;
  try{ r = await Presence.start(code, myDef, getDisplayName(), presenceChanged, { provider: makeRoomProvider(create) }); }
  finally{ clearTimeout(t); }
  if(!(r && r.ok)){
    toast(_roomJoinMessage(r && r.code, isSecret));
    _clearPendingCreate();
    refreshInviteUI();
    return;
  }
  /* 빈 방을 열었는데 접두어가 채널과 다르면 같은 4자리의 맞는 접두어 방으로 옮긴다(PLAY-AB12 빈 방에 미보유자 → WORK-AB12, 반대도 같다).
     옮긴 코드는 접두어가 내 자격과 맞으므로 다시 옮기지 않는다. 만들기 · 시크릿룸은 여기 오지 않는다. */
  if(!creating && !isSecret && !r.others && r.meta){
    const m = ROOM_CODE_RE.exec(code), want = _roomPrefixFor(r.meta.channel);
    if(m && (m[1] + '-') !== want){
      await Presence.stop();
      console.log('[방] 빈 방이라 코드를 채널에 맞춰 옮겨 엽니다 —', code, '→', want + m[2]);
      await startRoom(want + m[2]);
      return;
    }
  }
  refreshInviteUI(); toast('방에 연결됐어요: '+code);
  _clearPendingCreate();
  settingsMod.applyExtraSeatForMode();   // 멀티모드 진입 — 자리추가 좌석은 자동으로 뺀다
}
document.getElementById('lcInvite').onclick=()=>{ refreshInviteUI(); document.getElementById('inviteOverlay').classList.add('on'); };
document.getElementById('inviteClose').onclick=()=>{
  document.getElementById('inviteOverlay').classList.remove('on');
  refreshInviteUI();   // 다음에 열 때 기본 화면부터
};
/* 💝 후원 링크 — 시스템 기본 브라우저로 연다. 모달의 <a>와 런처의 버튼이 같은 처리를 쓴다.
   ★ <a href>를 그대로 두면 Electron이 앱 창 안에서 페이지를 열어버려 캐릭터 오버레이가 통째로
     날아간다(방명록·광고 배너에서 겪은 것과 같은 문제). preventDefault 후 openBrowser로 넘긴다.
   ★ 주소는 마크업(href / data-url)에 남겨둔다 — 나중에 바꿀 때 코드를 뒤지지 않아도 되고,
     웹(비-Electron)에서는 폴백이 그 값을 그대로 쓴다.
   ★ Ctrl(⌘)+클릭은 열지 않는다 — 관리자 진입 연타용 조합이라 여기서 링크가 열리면 방해가 된다.
     광고 배너(lcAdBanner)와 같은 규칙. */
function _bindDonate(el){
  if(!el) return;
  el.addEventListener('click', e=>{
    e.preventDefault();
    if(e.ctrlKey || e.metaKey) return;
    const url = el.dataset.url || el.getAttribute('href');
    if(!url) return;
    if(window.companion && companion.openBrowser) companion.openBrowser(url);
    else { try{ window.open(url, '_blank', 'noopener'); }catch(_){} }
  });
}
_bindDonate(document.getElementById('donateLink'));    // 방 만들기 / 참여하기 모달
_bindDonate(document.getElementById('lcDonateBtn'));   // 런처 (예전 [공사중] 자리)
_bindDonate(document.getElementById('progIconCredit')); // 설정 → 시스템 → 프로그램 정보 (아이콘 출처 @Miraclelife_CM)
_bindDonate(document.getElementById('progPrivacyLink')); // 설정 → 시스템 → 프로그램 정보 (개인정보 처리방침)
_bindDonate(document.getElementById('miPrivacyLink'));   // 내 정보 맨 아래 (개인정보 처리방침 — 같은 주소)
_bindDonate(document.getElementById('gatePrivacyLink')); // 첫 화면(초대 게이트) 맨 아래 (개인정보 처리방침 — 같은 주소)

/* --- 런처의 "🏠 마이홈" 버튼 (예전엔 이름 설정 버튼이었음) --- */
document.getElementById('lcNameBtn').onclick=()=>{
  twNav.go(twNav.NAV.MY_HOME);
};

/* --- 방 개수 표시(n/상한) + 정원 초과 시 생성 차단 --- */
/* 채널별 방 개수 상한 — 원격 설정 room.limits(채널마다 1~10000). 판정은 서버(새 방만 · channelFull) — 앱은 꽉 찼을 때 문구에만 쓴다. */
const CHANNEL_NAMES = { workingroom: '워킹룸', togetherroom: '투게더룸' };
function roomLimitOf(channel){ const s = _rcStore(); return s ? s.roomLimitOf(channel) : 300; }
/* 꽉 찼을 때 문구 — 서버 channelFull(방 만들기 · 빈 방 열기)이 쓴다. */
function _channelFullMsg(channel){
  const limit = roomLimitOf(channel), name = CHANNEL_NAMES[channel] || '방';
  return `${name}이 지금 꽉 찼어요(${limit}/${limit}) — 잠시 후 다시 시도해 주세요`;
}
/* 설정이 바뀌면 «최대 N명» 자리만 고친다(읽기 없음). */
function _paintMaxPeople(){
  const n = String(maxPeople());
  document.querySelectorAll('[data-tw-max-people]').forEach(el=>{ el.textContent = n; });
}
(function _watchRemoteRoomConfig(){
  const s = _rcStore(); if(!s) return;
  s.onChange((c, key)=>{ if(key === 'roomMaxPeople') _paintMaxPeople(); });
  _paintMaxPeople();
})();

/* 방 만들기 창이 고른 값 { title, max, music } — startRoom 의 만들기 갈래가 한 번 쓰고 비운다(join.create). */
let _pendingExtra = null;
/* 만들기 표시 셋(채널 · 공개 · 고른 값)을 한 번에 비운다 — 다음 입장이 지난 만들기 값을 물려받지 않게 */
function _clearPendingCreate(){ window._pendingRoomChannel = null; window._pendingRoomOpen = false; _pendingExtra = null; }
/* 방 만들기 — 채널 상한 · 프리미엄(투게더룸) · 제목 금칙어는 서버가 본다(channelFull · forbidden · title).
   settings — 방 만들기 창이 고른 { title(확인된 제목), max, open(방 목록 공개 · 랜덤 참여 허용), music(🎧 같이 듣기) }. */
function doCreateRoomInChannel(channel, settings){
  channel = channel || 'workingroom';
  window._pendingRoomChannel = channel;
  window._pendingRoomOpen = !!(settings && settings.open);
  _pendingExtra = { max: roomSettings.clampMax(settings && settings.max, maxPeople()),
    title: (settings && settings.title) || null, music: !!(settings && settings.music) };
  startRoom(genRoomCode(channel));   // 🏷️ 채널대로 WORK-/PLAY-
}
/* 🎲 랜덤 참여 — 코드 없이 '참여'를 누르면 여기로 온다. 후보는 서버가 정원 · 생존을 알고 고른 것이라 따로 확인하지 않는다. */
async function doJoinRandomRoom(){
  const cands = await _randomRooms(12);
  if(cands === null){ TwErrorCodes.notify('E-ROOM-01'); return; }
  if(!cands.length){ toast('지금은 참여할 수 있는 방이 없어요. 방을 만들어 보세요 🎲'); return; }
  startRoom(cands[0]);
}
/* 🎲 방 갈아타기 — 지금 방을 나가고 다른 랜덤 워킹룸으로 옮긴다.
   ★ 후보를 먼저 정한 뒤에 나간다 — 나가고 나서 찾으면 옮길 곳이 없을 때 그냥 혼자 남는다. 지금 방은 후보에서 뺀다.
   ⚠️ 연타 방지 — 나가기 · 입장이 각각 await 라, 두 번 누르면 두 방에 반쯤 걸친 상태가 된다(_hoppingRoom 은 refreshInviteUI 위에 선언). */
function _setHopBusy(busy){
  ['inviteHopRandom','fsInviteHopRandom'].forEach(id=>{
    const b=document.getElementById(id); if(!b) return;
    b.disabled = !!busy;
    b.textContent = busy ? '옮기는 중…' : '🎲 다른 랜덤룸 참여하기';
  });
}
async function doHopRandomRoom(){
  if(_hoppingRoom) return;
  if(!Presence.active()){ toast('먼저 방에 들어가 주세요'); return; }
  const cur = Presence.roomCode();
  _hoppingRoom = true; _setHopBusy(true);
  try{
    const cands = await _randomRooms(12);
    if(cands === null){ TwErrorCodes.notify('E-ROOM-01'); return; }
    const target = cands.find(c => c !== cur);
    if(!target){ toast('지금은 옮겨갈 다른 방이 없어요 — 조금 뒤에 다시 눌러보세요 🎲'); return; }
    await doLeaveRoom({ wipeChat: true });
    await startRoom(target);
    if(!Presence.active()) TwErrorCodes.notify('E-ROOM-02');   // 입장이 막혀 방 밖에 남았다 — 나갔다는 사실만이라도 알린다
  } finally {
    _hoppingRoom = false; _setHopBusy(false);
    refreshInviteUI();
  }
}

/* 🔒 별표(*) 한 글자로 코드 공간을 가른다 — "1234"는 COZY, "1234*"는 SCRT.
   COZY와 SCRT가 둘 다 4자리라 숫자만 보고는 구분할 수 없었고, 조회로 추측하면
   같은 4자리를 쓰는 두 방이 공존할 때 한쪽이 가려진다. 별표는 입력에 명시적으로 담기므로
   COZY-1234와 SCRT-1234가 아무 문제 없이 공존한다(추가 조회도 필요 없다).
   허용 문자는 영숫자 + 맨 뒤 별표 하나뿐 — 나머지 특수문자는 _setupRoomCodeInput이 지운다. */
/* ★ 중복 입장 방지 — 빈 코드일 때 타는 랜덤 참여(doJoinRandomRoom)가 후보를 묻느라 잠깐 걸린다. 그 사이 [참여]를 두 번 누르면 입장이 두 번 돈다. */
let _joiningRoom = false;
/* 🏷️ 4자리 + 고른 접두어(WORK-/PLAY-/붙여 넣은 COZY-)로 갈 방을 정한다. WORK-1234 와 PLAY-1234 는 서로 다른 방으로 공존한다 —
   어느 쪽인지는 입력칸 앞 라벨을 눌러 사람이 고른다(_setupRoomCodeInput). 조회해서 추측하지 않는다(추측하면 같은 4자리의 한쪽이 가려진다). */
function _resolveRoomCode(body, chosen){
  const pre = (chosen === ROOM_PREFIX.togetherroom || chosen === ROOM_PREFIX.workingroom || chosen === 'COZY-') ? chosen : _myRoomPrefix();
  return pre + body;
}
async function doJoinRoom(codeInputEl){
  if(_joiningRoom) return;
  let c=((codeInputEl&&codeInputEl.value)||'').trim().toUpperCase();
  if(!c){ _joiningRoom = true; try{ await doJoinRandomRoom(); } finally{ _joiningRoom = false; } return; }   // 🎲 빈 코드 = 랜덤 참여
  /* 접두어 전체("COZY-XXXX" / "SCRT-XXXX")를 붙여넣어도 정상 처리(하위호환).
     ⚠️ 길이 검사가 **판정과 제거 양쪽에** 필요하다 — genSecretCode 의 알파벳에 S·C·R·T 가 전부
       있어서 코드가 통째로 "SCRT" 로 뽑히는 일이 실제로 가능하다. 예전에는 판정에만 길이 검사가
       있고 제거는 무조건 돌아서, "SCRT" 를 넣으면 접두어로 오인해 코드가 빈 문자열이 됐다
       (→ "방 코드를 입력하세요" 만 뜨고 그 방에는 영영 못 들어간다).
     ★ 별표를 먼저 떼고 길이를 잰다. "SCRT*" 는 별표를 빼면 4자 = 코드 본문이다. */
  const _body0 = c.replace(/\*/g, '');
  const secret = (c.indexOf('*') >= 0) || (_body0.length > 4 && _body0.startsWith('SCRT'));
  /* 🏷️ #9 — 접두어까지 붙여 넣었으면(WORK-/PLAY-/COZY-) 그 방으로 **그대로** 간다. 사람이 고른 것이다.
     ⚠️ 길이 검사가 필요한 이유는 SCRT 와 같다 — 코드 본문이 통째로 "PLAY" 로 뽑힐 수 있다(WORK 는 O 가
       알파벳에 없어 불가). 5자 이상일 때만 접두어로 본다. */
  const _pm = (!secret && _body0.length > 4) ? /^(COZY|WORK|PLAY)-?/.exec(_body0) : null;
  /* 입력칸 정리기가 접두어를 떼고 4자리만 남겼으면 붙여 넣은 접두어는 data-prefix 에 있다(_setupRoomCodeInput). */
  const _dsPre = (!secret && codeInputEl && codeInputEl.dataset && /^(COZY|WORK|PLAY)-$/.test(codeInputEl.dataset.prefix || ''))
    ? codeInputEl.dataset.prefix : null;
  const _explicit = _pm ? (_pm[1] + '-') : _dsPre;
  c = (_body0.length > 4 ? _body0.replace(/^(?:COZY|WORK|PLAY|SCRT)-?/, '') : _body0).replace(/[^A-Z0-9]/g, '');
  if(!c){ toast('방 코드를 입력하세요'); return; }
  if(!ROOM_CODE_BODY_RE.test(c)){ toast('방 코드는 4자리예요'); return; }
  /* 🔒 갈림길은 여기가 전부다 — **별표(또는 SCRT 접두어)가 없으면 무조건 COZY.**

     ★★ 이건 사양이다. 버그가 아니다. ★★
       시크릿룸은 코드로 닫혀 있는 방이 아니라 **별표를 아는 사람만 들어오는 방**이다.
       그래서 별표를 모르는 사람이 같은 4자리를 넣으면 **같은 이름의 코지룸으로 들어가는 것이
       정상 동작**이다. 시크릿룸의 존재조차 드러나지 않아야 한다 — 코드를 나눠줄 때 별표까지
       함께, 조용히 알려주는 것이 이 기능의 사용법이다.

     [다시 넣지 말 것] 예전에 "별표를 몰라 못 들어간다"는 제보를 받고, 별표가 없어도 같은 4자리
       시크릿룸이 있는지 조회해서 있으면 그쪽으로 보내는 '구제' 분기를 넣은 적이 있다. 그것이
       **COZY-AAAA 와 SCRT-AAAA 를 한 방으로 묶어 버리는** 통로였다. 코드만 아는 사람이 전부
       들어오게 되니 시크릿룸이 시크릿룸이 아니게 되고, 동시에 그 4자리를 쓰던 일반 방은 아무도
       못 들어가게 된다. **같은 제보가 또 올라와도 라우팅으로 풀지 않는다.** 그 제보는 "코드를
       별표까지 붙여서 주라"로 답할 문제다.

     ⚠️ 여기서 SCRT 를 조회하지 않는 것 자체가 규칙이다. 조회로 추측하는 순간 두 코드 공간의
       공존이 깨진다. 입력에 담긴 표시 하나만 보고 가른다.
     🏷️ 공개 방 쪽(WORK/PLAY/COZY)은 _resolveRoomCode 가 고른 접두어로 — SCRT 와 무관하다. */
  if(secret){ startRoom('SCRT-' + c); return; }
  startRoom(_resolveRoomCode(c, _explicit || _myRoomPrefix()));
}
/* 🔒 시크릿룸 입장 — 코드 공간이 분리돼 있어(SCRT-) 일반 방 코드와 섞이지 않는다.
   미발급 · 기간이 끝난 코드는 서버가 막는다(secretClosed).
   ★ 이 칸은 '별표를 아는 사람'이 쓰는 전용 입구다. 일반 코드 칸에서 별표 없이 들어오는 길은
     없다(doJoinRoom 의 사양 주석 참고) — 그쪽에 구제 분기를 만들지 말 것. */
function doJoinSecretRoom(codeInputEl){
  /* ★ 별표(*)를 비롯한 특수문자는 여기서 지운다. 이 칸은 이미 SCRT- 프리픽스가 붙어 있어서
     별표가 필요 없는데, "시크릿룸은 뒤에 별표"만 듣고 여기에 치는 사람이 많았다.
     예전엔 maxlength=4 라 다섯 번째 글자가 브라우저에서 막혀 **글자가 아예 안 찍혔고**,
     설령 들어가도 아래 /^[A-Z0-9]{4}$/ 가 거부했다 — "별표가 입력이 안 된다" 제보의 정체. */
  let c=((codeInputEl&&codeInputEl.value)||'').trim().toUpperCase().replace(/\*/g,'');
  /* ⚠️ 접두어 제거도 5자 이상일 때만 — 코드 자체가 "SCRT" 일 수 있다(위 doJoinRoom 주석 참고).
     무조건 지우면 SCRT 코드를 가진 방은 "코드를 입력하세요" 만 뜨고 영영 못 들어간다. */
  if(c.length > 4) c = c.replace(/^SCRT-?/, '');
  c = c.replace(/[^A-Z0-9]/g, '');
  if(!c){ toast('시크릿룸 코드를 입력하세요'); return; }
  if(!ROOM_CODE_BODY_RE.test(c)){ toast('시크릿룸 코드는 4자리예요'); return; }
  startRoom('SCRT-'+c);
}
/* ★ 방장 승계 알림 — 서버 meta 의 host 가 나로 바뀌면(_onServerRoomMeta) 부른다. */
window._onHostSucceeded = function(meta){
  try{
    if(meta) window._roomMetaCache = meta;   // 대화창 방장 표시 갱신
    toast('내가 새 방장이 됐어요 👑');
    _refreshChatMembers();   // 방장 표시 즉시 갱신
  }catch(_){}
};

/* ★ 방 해산 — 투게더룸 방장이 나갔는데 이어받을 라이선스 보유자가 없을 때 서버가 disband 를 보낸다 — 각자 솔로 모드로.
   ⚠️ 나가는 도중에 한 번 더 불려도 한 번만 나간다. */
window._roomDisbanding = false;
window._onRoomDisbanded = function(){
  if(window._roomDisbanding) return;
  window._roomDisbanding = true;
  try{
    toast('방장이 나가고 이어받을 사람이 없어 방이 해산됐어요');
    Promise.resolve(doLeaveRoom({ wipeChat: true })).catch(()=>{}).then(()=>{ window._roomDisbanding = false; });
  }catch(_){ window._roomDisbanding = false; }
};

/* opt.wipeChat === true — 내가 직접 나갈 때만(버튼 · 다른 방으로 옮김 · 초대 이동 · 해산) 이 방의 PC 대화 저장을 지운다.
   연결 끊김 · 정원 초과 · 다른 기기 로그인 같은 «튕김» 은 다시 들어오면 이어져야 해서 안 지운다(chat-history.js). */
async function doLeaveRoom(opt){
  const _leftRoom = (typeof Presence!=='undefined' && Presence.roomCode) ? Presence.roomCode() : null;
  if(opt && opt.wipeChat === true && _leftRoom && window.firebaseAPI && firebaseAPI.chatHistory) firebaseAPI.chatHistory.wipeRoom(_leftRoom);
  _clearHiddenSeats();   // 🙈 방을 나가면 숨김 목록도 비운다
  await Presence.stop();   // 서버에 내 항목 삭제가 반영된 뒤 진행 — 바로 재접속해도 내가 복제되어 보이는 문제 방지
  window._activeChannel = 1;          // ★ 방을 나가면 채널 원복 → 채팅 훅(===2) 자동 비활성
  window._pendingRoomChannel = null;
  window._pendingRoomOpen = false;   // 🎲 방을 나가면 함께 초기화
  window._roomMetaCache = null;
  /* 🌊 날리기 초기화 — 흐르던 글자는 즉시 걷고 체크도 푼다.
     ★ 남겨 두면 방을 나간 뒤에도 몇 초 동안 남의 말이 화면을 가로지른다(그 방 사람도 아닌데).
     ★ 체크가 세션 변수라 다음 방에 그대로 따라붙는데, 방이 바뀌면 끄고 시작하는 편이 맞다. */
  try{ const _fl=document.getElementById('flyLayer'); if(_fl) _fl.innerHTML=''; }catch(_){}
  chatUiMod.setChatFlyOn(false); chatUiMod.setChatFlyColor(''); chatUiMod.setChatFlySize('l'); chatUiMod.setFlyLaneFreeAt([]);
  if(typeof chatUiMod.closeChatWindow==='function') chatUiMod.closeChatWindow();   // 방 나가면 대화창도 닫음
  refreshInviteUI();
  if(typeof settingsMod.applyExtraSeatForMode==='function') settingsMod.applyExtraSeatForMode();
}
async function doCopyRoomCode(){
  const code=Presence.roomCode(); if(!code) return;
  /* 🏷️ [2026-10-02 #9] **접두어까지 통째로 복사한다.** WORK-1234 와 PLAY-1234 가 따로 공존하므로 4자리만으로는
     어느 방인지 모른다. 받은 친구가 입력칸에 붙여 넣으면 정리기가 4자리만 남기고 라벨을 그 접두어로 바꾼다
     (_setupRoomCodeInput) — 따로 고를 필요가 없다. (예전: COZY- 를 떼고 4자리만 복사) */
  try{ await navigator.clipboard.writeText(code); toast('방 코드를 복사했어요: '+code); }
  catch(err){ toast('복사에 실패했어요'); }
}
// 채널 카드 클릭은 방 만들기 창(room-create-ui.js)이 받는다 — 창의 [방 만들기] 가 doCreateRoomInChannel 로 넘긴다.
document.getElementById('inviteJoin').onclick=()=>doJoinRoom(document.getElementById('inviteCode'));
document.getElementById('inviteLeave').onclick=()=>doLeaveRoom({ wipeChat: true });
{ const b=document.getElementById('inviteHopRandom'); if(b) b.onclick=doHopRandomRoom; }
document.getElementById('inviteRoomCopy').addEventListener('click', e=>{ e.preventDefault(); doCopyRoomCode(); });
// ★ 설정 패널 "멀티모드" 탭 — 모달(inviteOverlay)과 완전히 동일한 동작을 하는 버튼들. 로직은 위 공용
//   함수를 그대로 재사용해서 어느 쪽에서 조작해도 동일하게 동작하고 항상 같은 상태를 보여줌.
// ★ F1 탭의 방 만들기 — 모달을 열어 방 목록 로비를 보여 준다(로비 읽기는 room-lobby-ui.js 가 같은 버튼에 건다).
const fsInviteCreate=document.getElementById('fsInviteCreate'); if(fsInviteCreate) fsInviteCreate.onclick=()=>{
  const ov=document.getElementById('inviteOverlay'); if(ov) ov.classList.add('on');
  refreshInviteUI();
};
const fsInviteJoinBtn=document.getElementById('fsInviteJoin'); if(fsInviteJoinBtn) fsInviteJoinBtn.onclick=()=>doJoinRoom(document.getElementById('fsInviteCode'));
{ const b=document.getElementById('fsInviteSecretJoin'); if(b) b.onclick=()=>doJoinSecretRoom(document.getElementById('fsInviteSecretCode')); }
const fsInviteLeaveBtn=document.getElementById('fsInviteLeave'); if(fsInviteLeaveBtn) fsInviteLeaveBtn.onclick=()=>doLeaveRoom({ wipeChat: true });
{ const b=document.getElementById('fsInviteHopRandom'); if(b) b.onclick=doHopRandomRoom; }
const fsInviteRoomCopyBtn=document.getElementById('fsInviteRoomCopy'); if(fsInviteRoomCopyBtn) fsInviteRoomCopyBtn.addEventListener('click', e=>{ e.preventDefault(); doCopyRoomCode(); });

/* 방 코드 입력창 편의 — 프리픽스는 라벨로 별도 표시하므로 input에는 뒷자리 4자(+별표)만 담김.
   ・대문자 자동 변환
   ・"COZY-XXXX" / "SCRT-XXXX" 전체 붙여넣기하면 뒷자리만 남기고 자동 정리 (하위호환)
   ・🔒 별표(*)는 유일하게 허용되는 특수문자 — 맨 뒤 한 개만, 시크릿룸 표시.
     그 외 특수문자(하이픈·공백 등)는 전부 제거
   ・별표가 붙으면 라벨도 COZY- → SCRT- 로 바꿔서 어디로 들어가는지 눈에 보이게 한다
   ・Enter로 즉시 참여 */
function _setupRoomCodeInput(inputEl){
  if(!inputEl) return;
  const preEl = inputEl.closest && inputEl.closest('.room-code-group')
    ? inputEl.closest('.room-code-group').querySelector('.room-code-prefix') : null;
  inputEl.addEventListener('input', e=>{
    /* ⌨️ 한글 IME 조합 중에는 손대지 않는다. 조합 도중 value 를 덮어쓰면 Chromium 에서
       IME 상태가 깨져 이후 타이핑이 통째로 씹히는 경우가 있다(한글 모드로 코드를 치던 사람). */
    if(e && e.isComposing) return;
    let raw = inputEl.value.toUpperCase();
    // 붙여넣기 대응: "COZY-XXXX"/"COZYXXXX"/"SCRT-XXXX"/"SCRTXXXX" 앞부분 제거.
    // SCRT를 통째로 붙여넣은 경우는 별표가 없어도 시크릿룸으로 본다.
    // ⚠️ 코드 자체가 "SCRT"일 수 있으므로(genSecretCode 알파벳에 S·C·R·T 포함) 길이로 가른다.
    const pastedSecret = raw.length > 4 && raw.startsWith('SCRT');
    /* 🏷️ #9 — WORK-/PLAY- 를 붙여 넣으면 그 접두어를 기억해 라벨에 보여 준다(doJoinRoom 도 같은 판정).
       ⚠️ 칸에는 4자리만 남으므로, 붙여 넣은 접두어는 data-prefix 에 따로 들고 있다가 doJoinRoom 이 읽는다. */
    const pastedPre = (!pastedSecret && raw.length > 4) ? (/^(COZY|WORK|PLAY)-?/.exec(raw) || [])[1] : null;
    if(raw.length > 4) raw = raw.replace(/^(?:COZY|WORK|PLAY|SCRT)-?/, '');   // ★ 4자면 그게 코드 본문이다
    const secret = pastedSecret || raw.indexOf('*') >= 0;
    const body = raw.replace(/[^A-Z0-9]/g, '').substring(0, 4);   // 영숫자 4자
    const v = body + (secret ? '*' : '');                          // 별표는 항상 맨 뒤 한 개
    if(v !== inputEl.value) inputEl.value = v;
    if(pastedPre) inputEl.dataset.prefix = pastedPre + '-';
    _paintPre(secret);
  });
  /* 🏷️ 라벨 = 이 4자리를 붙일 접두어. **눌러서 WORK- ↔ PLAY- 를 바꾼다**(요청: 클릭 한 번으로 전환).
     · 고른 적이 없으면 내 자격대로 보여 준다(미보유 WORK- · 보유 PLAY-) — 빈 방을 열 때 쓰일 쪽이다.
     · 한 번 고르면(또는 접두어째 붙여 넣으면) data-prefix 에 남아 칸을 비워도 유지된다.
     · 붙여 넣은 COZY- 는 라벨에 그대로 보이고, 누르면 WORK- 부터 다시 돈다.
     · 별표(시크릿)일 때는 SCRT- 고정이라 눌러도 바뀌지 않는다.
     ⚠️ 새 요소를 만들지 않는다 — 기존 라벨에 커서·툴팁·점선 밑줄만 얹는다(디자인 변경 없음). */
  function _paintPre(secret){
    if(!preEl) return;
    preEl.textContent = secret ? 'SCRT-' : (inputEl.dataset.prefix || _myRoomPrefix());
    preEl.style.cursor = secret ? '' : 'pointer';
    preEl.style.textDecoration = secret ? '' : 'underline dotted';
    preEl.title = secret ? '' : '눌러서 WORK(워킹룸) ↔ PLAY(투게더룸) 바꾸기';
  }
  if(preEl){
    preEl.addEventListener('click', ()=>{
      if(inputEl.value.indexOf('*') >= 0) return;   // 시크릿 입력 중에는 SCRT- 고정
      const cur = inputEl.dataset.prefix || _myRoomPrefix();
      inputEl.dataset.prefix = (cur === ROOM_PREFIX.workingroom) ? ROOM_PREFIX.togetherroom : ROOM_PREFIX.workingroom;
      _paintPre(false);
      try{ inputEl.focus(); }catch(_){}
    });
  }
  inputEl.addEventListener('focus', ()=>_paintPre(inputEl.value.indexOf('*') >= 0));   // 라이선스가 나중에 바뀌어도 맞게
  /* 📋 [2026-10-02 #9] 붙여넣기는 직접 받는다. 칸이 maxlength=5 라 «PLAY-1234» 를 붙이면 브라우저가 «PLAY-» 로
     잘라 버려 코드 본문이 통째로 사라졌다(예전 «COZY-XXXX 붙여넣기 하위호환» 도 실제로는 같은 이유로 안 됐다).
     ★ 스크립트로 넣는 value 는 maxlength 에 안 걸린다 → 원문을 넣고 위 input 정리기를 그대로 태운다. */
  inputEl.addEventListener('paste', e=>{
    const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if(!t) return;
    e.preventDefault();
    inputEl.value = t.trim();
    inputEl.dispatchEvent(new Event('input'));
  });
  _paintPre(false);
  inputEl.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); doJoinRoom(inputEl); }
  });
}
_setupRoomCodeInput(document.getElementById('inviteCode'));
_setupRoomCodeInput(document.getElementById('fsInviteCode'));

/* 🔒 시크릿룸 전용 칸(SCRT- 프리픽스가 이미 붙어 있는 칸) 정리기.
   이 칸에는 _setupRoomCodeInput 을 못 쓴다 — 그건 별표를 보고 프리픽스 라벨을 COZY↔SCRT 로
   바꾸는 물건이라, 항상 SCRT 인 이 칸에서는 라벨이 흔들린다.
   대신 대문자 변환·특수문자 제거·Enter 입장만 붙인다.
   ★ 별표는 '지우지 않고 맨 뒤에 그대로 둔다' — 이 칸에선 아무 의미가 없지만, 치는 족족 사라지면
     유저 눈에는 여전히 "별표가 입력이 안 된다"로 보인다. 표시만 남기고 doJoinSecretRoom 이
     입장 직전에 떼어낸다. maxlength 도 5로 올려 다섯 번째 글자가 브라우저에서 막히지 않게 했다. */
function _setupSecretCodeInput(inputEl){
  if(!inputEl) return;
  inputEl.addEventListener('input', e=>{
    if(e && e.isComposing) return;
    let raw = inputEl.value.toUpperCase();
    if(raw.length > 4) raw = raw.replace(/^SCRT-?/, '');
    const star = raw.indexOf('*') >= 0;
    const v = raw.replace(/[^A-Z0-9]/g, '').substring(0, 4) + (star ? '*' : '');
    if(v !== inputEl.value) inputEl.value = v;
  });
  inputEl.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); doJoinSecretRoom(inputEl); }
  });
}
_setupSecretCodeInput(document.getElementById('fsInviteSecretCode'));

twNav.on(twNav.NAV.LEAVE_ROOM, doLeaveRoom);   // 🧭 다른 기기에 밀려남 · 자리비움 자동 퇴장이 이 통로로 나간다
return {
  doCreateRoomInChannel,
  _myRoomLicensed,
  CHANNEL_NAMES,
  ROOM_PREFIX,
  _mockRoomAllowed,
  _srFmtDate,
  doLeaveRoom,
  makeMockProvider,
  refreshInviteUI,
  startRoom,
  syncFriendSeats,
  onRoomChanged,   // 🔔 «방이 바뀜» 알림 걸기 — 🎧 같이 듣기
};
}

const api = { createRoomEntry };
if(typeof window !== 'undefined') window.TwRoomEntry = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
