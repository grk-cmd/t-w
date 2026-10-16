/* room-entry.js — 🛰 방 서버 provider · 🔢 방 개수 · 방 만들기 · 랜덤 참여 · 🚪 방 입장 · 나가기 · 승계 · 해산
   app.js «🛰 방 서버 provider» · «🔢 방 개수 · 방 만들기 · 랜덤 참여 · 갈아타기» · «🚪 방 입장 · 나가기 · 승계 · 해산 · 코드 입력칸» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 33번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 여러 모듈이 쓰는 내 이름 도우미(getDisplayName · getUserName · setUserName · USER_NAME_KEY)는 app.js 에 남겼다. Firebase / 방 서버 두 통로를 고르는 전략 정리는 다음 단계(컨벤션)에서 한다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 13줄 —
     EXP_CELLS · awayPicMod · curSlot · focusLevelMod · isAdmin · isPremium · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 25개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: CHANNEL_NAMES · NET_READY_WAIT_MS · ROOM_PREFIX · _mockRoomAllowed · _srFmtDate · _updateRoomCountUI · _waitFirebaseApi · doLeaveRoom · makeMockProvider · refreshInviteUI · startRoom · startRoomCountWatch · syncFriendSeats — app.js 는 roomEntryMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
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
const fitModel = deps.fitModel;
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
const uiIconEl = deps.uiIconEl;
const updateMyStatusChipPosition = deps.updateMyStatusChipPosition;
function _roomServerNet(){
  try{ return (window.firebaseAPI && typeof firebaseAPI.roomServerNet === 'function') ? firebaseAPI.roomServerNet() : null; }
  catch(_){ return null; }
}
// 방 개수 · 랜덤 입장에 서버 몫을 섞을지 — «내 서버»(허용 목록 · 기본 서버 비율)가 있을 때만. 마지막으로 확인한 값(읽기 없음).
function _roomServerOn(){
  try{ return !!(_roomServerNet() && firebaseAPI.roomServerMineNow && firebaseAPI.roomServerMineNow()); }catch(_){ return false; }
}
/* 서버 meta { channel, host(userId), open, chatOff, secret } → Firebase _meta 리스너가 하던 것과 같은 자리로 */
function _onServerRoomMeta(meta, prev){
  window._roomMetaCache = meta;
  window._activeChannel = (meta && meta.channel === 'togetherroom') ? 2 : 1;
  const me = getMyUserId();
  if(prev && meta && prev.host !== me && meta.host === me) window._onHostSucceeded(meta);
  try{ window._onRoomMeta(meta); }catch(_){}
}
/* Firebase 방(firebase-init joinRoom)이 알릴 곳 — 방 서버 provider(makeServerProvider)가 받는 것과 같은 몫.
   firebase-init 은 아래층이라 여기 이름을 직접 부르지 않고 이 묶음을 넘겨받는다. */
function _firebaseRoomHooks(){
  return {
    onDisband: ()=>window._onRoomDisbanded(),
    onHostSucceeded: (meta)=>window._onHostSucceeded(meta),
    onOverCapacity: (cap)=>window._onRoomOverCapacity(cap),
    onMeta: (meta)=>{
      window._roomMetaCache = meta;
      window._onRoomMeta(meta);
    },
    getExp: ()=>myExpCells(),
    secretOwner: ()=>window._srOwnerUid,
  };
}
/* 💬 대화 기록(firebase-init chatHistory)이 «이 PC 에 저장할지» 를 가르는 채널 — 채널(window._activeChannel)을 바꾸는 곳이 이 파일이라 여기서 건다 */
function _bindChatHistoryChannel(){ firebaseAPI.chatHistory.bindChannel(()=>(window._activeChannel === 2 ? 'togetherroom' : 'workingroom')); }
if(window.firebaseAPI) _bindChatHistoryChannel();
else window.addEventListener('firebase-ready', _bindChatHistoryChannel, { once:true });
function makeServerProvider(net, create){
  return net.makeProvider({
    serializeDef: serializeDefForNetwork,
    deserializeDef: deserializeDefFromNetwork,
    getExp: ()=>{ try{ return myExpCells(); }catch(_){ return undefined; } },
    onMeta: _onServerRoomMeta,
    onDisband: ()=>{ window._onRoomDisbanded(); },
    onReplaced: ()=>{ try{ _onDeviceSessionLost(); }catch(_){} },
    /* 방 안에서 끊긴 채 clientGiveUpMs(원격 설정 · 기본 90초) 동안 못 돌아왔다 — Firebase 로 옮기지 않고 방에서 나온다.
       옮기면 사람마다 옮기는 때가 달라 서버 쪽 · Firebase 쪽으로 방이 갈린다(«서로 안 보여요»). 다시 들어오면 서버가 돌아온 뒤 같은 방으로 붙는다. */
    onLost: (code)=>{
      console.warn('[방 서버] 방을 이어 가지 못했다 —', code);
      toast(code === 'unreachable' ? ROOM_SERVER_LOST_MSG : '방 서버와 연결이 끊겨 방에서 나왔어요 — 다시 들어가 주세요');
      Promise.resolve(doLeaveRoom()).catch(()=>{});
    },
    // 끊긴 지 15초가 넘었다(true) · 다시 붙었다(false) — room-server-net RECONNECT_NOTICE_MS
    onReconnecting: (on)=>{ toast(on ? '📡 방 서버 연결이 끊겨 다시 연결하는 중이에요…' : '방 서버에 다시 연결됐어요'); },
    onJoined: (room)=>{ try{ firebaseAPI.setPresenceRoom(room); }catch(_){} },
    onLeft: ()=>{ try{ firebaseAPI.setPresenceRoom(null); }catch(_){} },
  }, { create });
}
const ROOM_SERVER_LOST_MSG = '방 서버 연결이 끊겨 방에서 나왔어요 — 잠시 후 다시 들어와 주세요';
const ROOM_SERVER_BUSY_MSG = '방 서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요';
/* 입장 실패 코드 → 지금 쓰는 안내 문구. null 이면 «못 붙음»(서버 꺼짐 · 인증 · 버전 · 시간 초과 등) — 새 방이면 Firebase 로 열고, 이미 열린 방이면 막는다. */
function _roomServerJoinMessage(code, isSecret, openCh){
  if(code === 'full') return isSecret ? ('이 방은 손님 자리가 다 찼어요(방장 자리 제외 최대 '+(maxPeople()-1)+'명)')
                                      : ('이 방은 이미 가득 찼어요(최대 '+maxPeople()+'명)');
  if(code === 'channelFull'){
    const ch = openCh || ((window._pendingRoomChannel === 'togetherroom') ? 'togetherroom' : 'workingroom');
    return _channelFullMsg(ch);
  }
  if(code === 'secretClosed') return '이 시크릿룸은 이용 기간이 끝났어요';
  if(code === 'forbidden') return '투게더룸은 라이선스가 있어야 열 수 있어요';
  return null;
}
/* startRoom 의 서버 갈래. 'firebase' = 아래 기존 흐름으로 계속 · 그 밖 = 여기서 끝났다.
   어디로 갈지는 firebaseAPI.resolveRoomServer(문지기 · room-server-gate.js) 한 곳이 정한다.
     · 만들기 → 허용 목록에 있거나 기본 서버 비율 안이면 내 서버에 create 로(서버가 roomDir 에 적는다). 아니면 Firebase.
     · 코드로 들어가기
         주소록(roomDir)에 있는 방(from 'dir') → peek 없이 그 서버에 바로 join.
           서버가 재시작 직후면 그 방은 «되살릴 후보» 라 peek 에 안 나오지만 join 하면 원래 설정으로 되살아난다.
           못 붙으면(꺼짐 · 시간 초과 joinWaitMs · 기본 10초) Firebase 로 가지 않고 입장을 막는다 — «잠시 후 다시 시도».
             사람들은 서버 방에 있는데 나만 Firebase 방에 혼자 들어가면 서로 안 보인다. 방 서버를 오래 못 쓰면 관리자가 스위치(on)를 끈다.
           허용 목록에 없는 사람도 방 서버가 켜져 있으면 늘 여기로 온다(따라가기).
         허용된 사람(from 'allow' · 'default' · 'dev')인데 주소록에 없음 → peek: 서버에 있으면 서버로.
           없으면 Firebase 에 살아 있는 사람이 있나 본다 → 있으면 Firebase 로(옛 앱 사람들이 있는 방). 둘 다 없으면 서버가 연다.
       peek 을 못 물었으면(시간 초과 · peek 을 모르는 서버) «서버에 없음» 으로 본다.
     · 주소록에 없는 방(새 방 · 허용된 사람의 peek)에서 서버에 못 붙으면(꺼짐 · 인증 거절 · 버전 · 시간 초과) Firebase 로 — 갈릴 사람이 없다.
       못 붙은 주소는 1분 동안 다시 기다리지 않는다(주소록에 있는 방은 사용자가 다시 시도하면 바로 다시 붙어 본다).
     · 주소록에 칸이 없으면 따라가는 사람은 peek 없이 Firebase — 서버가 재시작해도 칸을 지우지 않으므로(2분 30초 되살릴 후보) 빈틈은
       «쓰기 실패» 뿐이고, 그것 때문에 모든 입장이 서버에 붙어 보는 값은 크다. 허용된 사람만 자기 서버에 peek 한다. */
const ROOM_SERVER_CONNECTING_TOAST_MS = 1000;   // 이만큼 지나도 못 붙었으면 «연결 중» 을 보인다(바로 붙으면 안 띄운다)
/* 빈 방을 열 때 채널을 정하는 자격 — 보유자(라이선스 · 관리자)면 투게더룸. Firebase 갈래 · 서버 갈래가 같은 것을 쓴다. */
function _myRoomLicensed(){ return !!((typeof isPremium()!=='undefined' && isPremium()) || (typeof isAdmin()!=='undefined' && isAdmin())); }
async function _startRoomOnServer(code, ctx){
  const net = _roomServerNet();
  if(!(net && firebaseAPI.resolveRoomServer)) return 'firebase';
  const creating = !!window._pendingRoomChannel && !ctx.isSecret;
  let openCh = null;   // 서버가 빈 방을 열 때 그 채널(상한 검사 · channelFull 문구)
  let rs = null;
  try{ rs = await firebaseAPI.resolveRoomServer(code, { creating }); }catch(_){ rs = null; }
  if(!(rs && rs.via === 'server')) return 'firebase';
  const following = rs.from === 'dir';
  // 이미 열린 방에 못 붙었다 — 막고 안내(만들기 · 시크릿룸 표시는 안 남긴다). Firebase 로 가면 방이 갈린다.
  const blockFollow = (why)=>{
    console.warn('[방 서버] 이미 열린 방에 못 붙음 — 입장을 막습니다 (' + why + ')');
    toast(ROOM_SERVER_BUSY_MSG);
    window._pendingRoomChannel = null;
    window._pendingRoomOpen = false;
    refreshInviteUI();
    return 'stop';
  };
  let rd;
  if(following){
    const t = setTimeout(()=>toast('📡 방 서버에 연결하는 중…'), ROOM_SERVER_CONNECTING_TOAST_MS);
    try{ rd = await net.ensureReady(net.timing().joinWaitMs, { retry: true }); }
    finally{ clearTimeout(t); }
    if(!rd.ok) return blockFollow(rd.code);
  }else{
    rd = await net.ensureReady();
    if(!rd.ok){ console.warn('[방 서버] 연결 안 됨 — Firebase 방식으로 들어갑니다 (' + rd.code + ' · ' + rs.from + ')'); return 'firebase'; }
  }
  if(!creating && !following){
    let pk = null;
    try{ pk = await net.peek(code); }catch(_){ pk = null; }
    if(!(pk && pk.exists)){
      let fb = null;   // Firebase 쪽 사람 수 — 서버에 방이 없을 때만 읽는다
      try{
        if(ctx.isSecret && firebaseAPI.checkSecretRoomEntry){ const sr = await firebaseAPI.checkSecretRoomEntry(code, ctx.secretOwner); fb = sr ? sr.count : null; }
        if(fb === null && firebaseAPI.checkRoomCapacity) fb = await firebaseAPI.checkRoomCapacity(code);
      }catch(_){ fb = null; }
      if(typeof fb === 'number' && fb > 0) return 'firebase';
      /* 서버에도 Firebase 에도 사람이 없다 = 서버가 새 방을 연다 → [방 만들기] 와 같은 상한(개수는 roomIndex — doCreateRoomInChannel 과 같다).
         되살리기(주소록에 있는 방 · from 'dir')는 여기 오지 않는다 — 이미 있던 방이라 세지 않는다. 시크릿룸은 정원 밖. */
      if(!ctx.isSecret){
        openCh = _myRoomLicensed() ? 'togetherroom' : 'workingroom';
        let n = null;
        try{ if(firebaseAPI.getRoomCount) n = await firebaseAPI.getRoomCount(openCh); }catch(_){ n = null; }
        if(n != null && n >= roomLimitOf(openCh)){
          toast(_channelFullMsg(openCh));
          window._pendingRoomChannel = null;
          window._pendingRoomOpen = false;
          return 'stop';
        }
      }
    }
  }
  const create = creating ? { channel: window._pendingRoomChannel,
    open: (window._pendingRoomChannel === 'workingroom') && !!window._pendingRoomOpen } : null;
  _clearHiddenSeats();
  const r = await Presence.start(code, ctx.myDef, getDisplayName(), presenceChanged, { provider: makeServerProvider(net, create) });
  if(!(r && r.ok)){
    const msg = _roomServerJoinMessage(r && r.code, ctx.isSecret, openCh);
    if(!msg && following) return blockFollow(r && r.code);
    if(!msg){ console.warn('[방 서버] 입장 실패 — Firebase 방식으로 들어갑니다 (' + (r && r.code) + ')'); return 'firebase'; }
    toast(msg);
    window._pendingRoomChannel = null;
    window._pendingRoomOpen = false;
    refreshInviteUI();
    return 'stop';
  }
  /* 빈 방을 열었는데 접두어가 채널과 다르면 같은 4자리의 맞는 접두어 방으로 옮긴다(Firebase 갈래의 빈 방 규칙과 같다).
     옮긴 코드는 접두어가 내 자격과 맞으므로 다시 옮기지 않는다. */
  if(!creating && !ctx.isSecret && !r.others && r.meta){
    const m = ROOM_CODE_RE.exec(code), want = _roomPrefixFor(r.meta.channel);
    if(m && (m[1] + '-') !== want){
      await Presence.stop();
      console.log('[방] 빈 방이라 코드를 채널에 맞춰 옮겨 엽니다 —', code, '→', want + m[2]);
      await startRoom(want + m[2]);
      return 'done';
    }
  }
  refreshInviteUI(); toast('방에 연결됐어요: '+code);
  window._pendingRoomChannel = null;
  window._pendingRoomOpen = false;
  if(typeof settingsMod.applyExtraSeatForMode==='function') settingsMod.applyExtraSeatForMode();
  return 'done';
}
/* 방 개수 — 서버 방 몫을 더한다(켜져 있을 때만). 서버 답은 20초 기억한다(방 창이 30초마다 다시 묻는다).
   inclServer — 방 서버가 자기 방을 roomIndex 에 올려 Firebase 합계에 이미 들어 있으면 더하지 않는다(두 번 세기). */
let _srvRoomStats = null, _srvRoomStatsAt = 0;
function _addServerRoomCounts(c){
  const s = _srvRoomStats;
  if(!c || c.inclServer || !s || !_roomServerOn()) return c;
  const add = (a, b)=> (a == null) ? a : a + (b | 0);
  return Object.assign({}, c, { total: add(c.total, s.total), workingroom: add(c.workingroom, s.workingroom), togetherroom: add(c.togetherroom, s.togetherroom) });
}
async function _withServerRoomCounts(c){
  if(!_roomServerOn()) return c;
  if(Date.now() - _srvRoomStatsAt > 20000){
    try{ await firebaseAPI.roomServerMine(false); }catch(_){}   // 주소를 «내 서버» 로(읽기 없음)
    const net = _roomServerNet();
    let s = null;
    try{ s = net ? await net.stats() : null; }catch(_){ s = null; }
    if(s){ _srvRoomStats = s; _srvRoomStatsAt = Date.now(); }
  }
  return _addServerRoomCounts(c);
}
/* 랜덤 입장 후보 — 서버 방을 먼저 본다. 서버가 이미 «열린 워킹룸 · 1~9명» 만 준다. 꺼져 있거나 못 받으면 []. */
async function _serverRandomRooms(limit){
  let mine = null;   // 랜덤은 입장 직전이라 «내 서버» 를 다시 확인한다(on · allow/{내 코드} · default · defaultPercent)
  try{ mine = (_roomServerNet() && firebaseAPI.roomServerMine) ? await firebaseAPI.roomServerMine(true) : null; }catch(_){ mine = null; }
  if(!mine) return [];
  const net = _roomServerNet();
  try{ const list = net ? await net.random(limit) : null; return Array.isArray(list) ? list : []; }catch(_){ return []; }
}

/* 로컬 시뮬레이션 — Firebase 연결 전, 친구들이 타이핑/졸기 하는 걸 보여줌 */
/* 🧪 가짜 방 — 개발 표식이 있을 때만(Presence.start 주석). */
const NET_READY_WAIT_MS = 10000;
function _mockRoomAllowed(){ try{ return localStorage.getItem('tw.mockRoom') === '1'; }catch(_){ return false; } }
function _waitFirebaseApi(ms){
  return new Promise(res=>{
    if(window.firebaseAPI) return res(true);
    let done = false;
    const fin = ()=>{ if(done) return; done = true; res(!!window.firebaseAPI); };
    try{ window.addEventListener('firebase-ready', fin, { once:true }); }catch(_){}
    setTimeout(fin, ms);
  });
}
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
      if(seat.ridingOn === target) return;                 // 이미 같은 상태면 건드리지 않음(재실측 방지)
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
             ★ 레이스 가드는 applyCharToSeat 의 .then 과 같은 이유·같은 조건이다 — 파츠 GLB 가
               비동기로 붙는 동안 그 사람이 나가거나 캐릭터를 바꾸면 낡은 좌석에 뒤늦게 발사된다. */
          applyEquippedPartsToSeat(s, fdef).then(()=>{   // 남아있는/새로 생긴 파츠는 적용(교체 포함)
            try{
              if(s && s.charDef===fdef && s.gltfRoot){ fitModel(s); layoutSeats(); }
            }catch(_){}
          });
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
/* 🔒 시크릿룸 칸 노출 규칙 —
     · 기본 숨김. 후원 안 한 사람 화면엔 "코드가 있어요" 링크 한 줄만 보인다.
     · 후원자(users/{uid}/secretRoom 보유)는 자동으로 펼치고 코드를 채워둔다 → 입장 한 번.
     · 코드를 공유받은 '친구'는 이 필드가 없어 줄 자체가 안 보인다. 대신 일반 COZY 칸에
       4자리를 넣으면 doJoinRoom이 시크릿룸을 먼저 조회해 그쪽으로 보낸다 — 그래서 막히지 않는다.
   조회는 세션당 1회만 (null=아직 조회 전, ''=조회했으나 없음). */
let _mySecretRoomCode = null;
function _refreshSecretRoomUI(){
  const apply = code => {
    [['inviteSecretWrap','inviteSecretCode'],['fsInviteSecretWrap','fsInviteSecretCode']].forEach(([wid,iid])=>{
      const w=document.getElementById(wid); const inp=document.getElementById(iid);
      if(!w) return;
      if(code){ w.style.display='flex'; if(inp && !inp.value) inp.value=String(code).replace(/^SCRT-/,''); }
    });
  };
  if(_mySecretRoomCode !== null){ apply(_mySecretRoomCode); return; }
  try{
    if(!(window.firebaseAPI && firebaseAPI.getMySecretRoom)) return;
    Promise.resolve(firebaseAPI.getMySecretRoom(getMyUserId())).then(c=>{
      _mySecretRoomCode = c || '';
      apply(_mySecretRoomCode);
    }).catch(()=>{ _mySecretRoomCode = ''; });
  }catch(_){}
}
function refreshInviteUI(){ const on=Presence.active();
  _refreshSecretRoomUI();
  document.getElementById('inviteIdle').style.display=on?'none':'';
  // ★ 방 만들기 화면(채널 카드 + 참여 코드)은 상시 표시 — 열릴 때 잠금/카운트만 갱신
  if(!on) _refreshChannelPickUI();
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
}
// 🚪 버전 게이트 — semver "a" < "b" 이면 true. (숫자 3파트 비교, 누락은 0)
function _verLt(a,b){
  const pa=String(a).split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b).split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){ if((pa[i]||0)<(pb[i]||0)) return true; if((pa[i]||0)>(pb[i]||0)) return false; }
  return false;
}
// 방(워킹룸·투게더룸) 입장 허용 여부. 내 앱버전 < 원격 설정 minVersion.room 이면 막고 안내(자세한 링크는 공지).
//   ※ 이 체크 코드가 든 버전부터만 효과 — 컷오버 시 minRoomVer를 올려 발동시킴.
//   ※ 웹/개발 환경(companion 미주입)이나 조회 실패 시엔 막지 않고 통과(오탐 방지).
async function _ensureRoomVersionOk(){
  try{
    if(!(window.companion && companion.getAppVersion)) return true;
    const my  = await companion.getAppVersion();
    const min = (window.firebaseAPI && firebaseAPI.getMinRoomVer) ? await firebaseAPI.getMinRoomVer() : null;
    if(my && min && _verLt(my, min)){
      toast('최신 업데이트에서만 방을 이용할 수 있어요. 공지의 링크로 업데이트해 주세요.');
      return false;
    }
  }catch(_){ /* 조회 실패는 통과 */ }
  return true;
}
async function startRoom(code){
  if(window._deviceSessionLost){ toast('다른 기기에서 이 계정을 쓰는 중이에요 — «여기서 계속 쓰기» 를 누르면 이 PC 로 가져와요'); return; }   // 🖥️ 한 계정 한 기기
  if(!(await _ensureRoomVersionOk())) return;   // 🚪 구버전 방 입장 차단(생성·참여·초대수락 공통 길목)
  const myDef=slots[curSlot()]||slots.find(Boolean);
  if(!myDef){ toast('먼저 내 캐릭터를 만들어 주세요'); return; }
  /* 🔒 시크릿룸 — 후원자에게 발급된 고정 투게더룸.
     · 발급되지 않은 코드는 여기서 막는다. 이 검사가 없으면 아무 SCRT- 코드나 입력해서
       "정원에도 안 잡히고 상한도 없는 투게더룸"을 공짜로 여는 프리미엄 우회가 된다.
     · 방장은 '지금 들어온 사람'이 아니라 발급 대상(owner)으로 고정한다 —
       주인이 나가도 승계·해산이 없다(html의 _maybeSucceedHost SCRT 가드와 한 쌍). */
  const _isSecret = /^SCRT-/.test(code);
  let _secretOwner = null;
  if(_isSecret){
    if(!(window.firebaseAPI && firebaseAPI.getSecretRoomPub)){ toast('네트워크 연결이 필요해요'); return; }
    const _pub = await firebaseAPI.getSecretRoomPub(code);
    if(!_pub || !_pub.owner){ toast('없는 시크릿룸 코드예요'); return; }
    /* 📅 이용 기간 — pub.exp(만료 ms)가 있고 지났으면 입장을 막는다. 없으면 영구(기존 발급분 전부).
       주인이든 코드를 받은 친구든 같은 판정을 받는다 — 방 자체의 기간이라서.
       ⚠️ 판정 기준은 각자의 로컬 시계다. RTDB에 인증이 없어 서버가 강제할 수 없고(규칙은
          '누가 읽는지'를 모른다), 이미 방에 들어와 있는 사람을 도중에 끊지도 않는다
          (만료는 입장 길목에서만 본다). 후원 특전의 기간 관리용이지 보안 경계가 아니다. */
    const _exp = (typeof _pub.exp === 'number' && _pub.exp > 0) ? _pub.exp : 0;
    if(_exp && Date.now() > _exp){
      toast('이 시크릿룸은 이용 기간이 끝났어요 (' + _srFmtDate(_exp) + ' 만료)');
      return;
    }
    // 만료가 가까우면 들어가기 전에 한 번 알려준다 — 그냥 안 되는 날이 오는 것보다 낫다
    if(_exp){
      const _left = Math.ceil((_exp - Date.now()) / 86400000);
      if(_left <= 7) toast('🔒 이 시크릿룸은 ' + _left + '일 뒤 만료돼요 (' + _srFmtDate(_exp) + ')');
    }
    _secretOwner = _pub.owner;
  }
  /* 🔒 시크릿룸 자리 배분 — 방장 1(예약석) + 자유 maxPeople()-1.
     [경위] 예약석 규칙은 설명만 있고 코드에 없었다. 방장도 남과 똑같이 아래 검사를 맞아서,
            친구들이 먼저 자리를 채우면 후원자가 자기 방에 못 들어갔다.
     · 방장(secretRooms/{code}/pub.owner)은 정원 검사를 아예 건너뛴다.
     · 손님은 "방장을 뺀 인원"으로만 센다 — 예약석은 방장이 자리를 비워도 남이 못 앉는다.
       그래서 인원수 하나로는 부족하고 '방장이 지금 안에 있는가'가 필요하다(checkSecretRoomEntry).
     ⚠️ 전부 클라이언트 판정이다. firebase-database-rules.json 의 rooms/$room/$memberId 는
        .write:true + 형식 검사뿐이고 _meta.host 도 누구나 덮어쓸 수 있다 — 서버는 인원도 방장도
        지켜주지 않는다(정원 전체가 원래 그렇다). 진짜 보증은 들어간 뒤의 자기 퇴장이다. */
  const _iAmSrOwner = !!(_isSecret && _secretOwner && _secretOwner === getMyUserId());
  /* (걷음 · 개정 56 · 설계 §6-⑥) 방장이 «내가 버린 uid» 면 재발급을 안내하던 토스트 — 그 목록과 함께. 손님 입장은 그대로. */
  //   html 자기 퇴장 게이트가 읽는다 — _meta.host 보다 이르게(입장 전에) 확정되는 값이라 순서 계산이 안 흔들린다.
  window._srOwnerUid = _isSecret ? (_secretOwner || null) : null;
  /* 🛰 방 서버 — 관리자 스위치가 켜져 있을 때만 서버로(기본 꺼짐 · _startRoomOnServer 주석). 'firebase' 면 아래 기존 흐름 그대로다.
     ★ 아래의 Firebase 쓰기(_meta · roomIndex · 빈 방 선점)보다 **먼저** 가른다 — 서버 방에 Firebase 표지가 생기면 옛 앱이 그 방을 «있는 방» 으로 센다. */
  {
    const _via = await _startRoomOnServer(code, { isSecret:_isSecret, secretOwner:_secretOwner, myDef });
    if(_via !== 'firebase') return;
  }
  // ★ 예전엔 정원 체크가 전혀 없어서 화면에 표시되는 한도(maxPeople())보다 많은 인원이 그냥 입장은 되고,
  //   그 중 화면에 안 보이는 사람이 생기는 문제가 있었음 — 입장 시도 시점에 미리 인원수를 확인해서 막음.
  let _roomCount = null;   // 나를 제외한 현재 방 인원 (빈 방 승격 판정에 재사용)
  if(window.firebaseAPI && window.firebaseAPI.checkRoomCapacity){
    try{
      let _ownerIn = false;
      if(_isSecret && window.firebaseAPI.checkSecretRoomEntry){
        const _sr = await window.firebaseAPI.checkSecretRoomEntry(code, _secretOwner);
        if(_sr){ _roomCount = _sr.count; _ownerIn = !!_sr.ownerIn; }
      }
      if(_roomCount === null) _roomCount = await window.firebaseAPI.checkRoomCapacity(code);
      // ★ count는 "나를 제외한 현재 인원"이므로, 내가 들어가서 총 인원이 maxPeople()을 넘을 때만 막아야 함.
      //   maxPeople()-1로 비교하고 있어서 마지막 한 자리(예: 이미 4명 있을 때 5번째)가 못 들어가던 버그였음.
      // ★ 방장은 예약석이 있으므로 여기를 통과한다 — 값만 채우고 지나간다.
      if(!_iAmSrOwner){
        //   _ownerIn 을 못 구했으면(구버전 API 등) false 로 남아 예약석 한 자리를 늘 비워두는 쪽으로 기운다.
        //   손님 하나가 덜 들어가는 것이, 방장이 못 들어가는 것보다 낫다.
        const _cap  = _isSecret ? (maxPeople() - 1) : maxPeople();
        const _here = _isSecret ? (_roomCount - (_ownerIn ? 1 : 0)) : _roomCount;
        if(_here >= _cap){
          toast(_isSecret ? ('이 방은 손님 자리가 다 찼어요(방장 자리 제외 최대 '+(maxPeople()-1)+'명)')
                          : ('이 방은 이미 가득 찼어요(최대 '+maxPeople()+'명)'));
          return;
        }
      }
    }catch(e){ /* 확인 자체가 실패하면(네트워크 등) 막지 않고 진행 — 입장 자체는 기존처럼 시도됨 */ }
  }
  // ⚠️ 반드시 await — start()는 내부에서 얼굴 URL 업로드를 기다린 뒤에야 provider를 세팅한다.
  //   기다리지 않고 아래 applyExtraSeatForMode()를 부르면 그 시점엔 Presence.active()가 아직 false라서
  //   "방에 없음"으로 판정 → 자리추가 좌석을 제거하는 대신 오히려 복원해버림
  //   (방에 들어가자마자 내 슬롯 캐릭터들이 전부 나타나던 버그의 원인).
  // ★ 채널 확정 — 방을 '만드는' 경우엔 _pendingRoomChannel(선택창에서 정함),
  //   '참여'는 방의 _meta.channel을 읽어 그대로 따른다(스펙: 참여는 선택 없이 방 채널로 입장).
  /* 🏷️ [2026-10-02 #9] 빈 방 승격 = 코드도 채널에 맞춘다.
     빈 방에 들어가면 아래에서 채널이 «들어가는 사람의 자격»으로 다시 정해진다(보유자=투게더룸).
     그런데 접두어가 채널을 드러내므로, 그 채널과 접두어가 다르면 **같은 4자리의 맞는 접두어 방**으로
     옮겨 연다(PLAY-AB12 빈 방에 미보유자 → WORK-AB12, 반대도 같다). 옛 COZY- 빈 방도 여기서 이관된다.
     ★ 옮긴 쪽에 사람이 있으면 그 방에 그냥 들어간다 — 다음 startRoom 이 사람 있는 방 규칙을 탄다.
       옮긴 코드는 접두어가 이미 내 자격과 맞으므로 다시 옮기지 않는다(재귀는 한 번뿐).
     ⚠️ _roomCount 가 null(확인 실패)이면 옮기지 않는다 — 빈 방 판정과 같은 태도.
     ⚠️ 만들기(_pendingRoomChannel)와 시크릿룸은 여기 오지 않는다. */
  if(!_isSecret && !window._pendingRoomChannel && _roomCount === 0){
    const _m = ROOM_CODE_RE.exec(code), _want = _myRoomPrefix();
    if(_m && (_m[1] + '-') !== _want){
      const _next = _want + _m[2];
      console.log('[방] 빈 방이라 코드를 채널에 맞춰 옮겨 엽니다 —', code, '→', _next);
      return startRoom(_next);
    }
  }
  let _channel = window._pendingRoomChannel || null;
  try{
    if(_isSecret){
      // 시크릿룸은 항상 투게더룸이고 투게더룸 상한·빈 방 승격 분기를 타지 않는다(정원 밖).
      // host는 입장할 때마다 owner로 다시 쓴다(멱등) — 주인이 아닌 친구가 먼저 들어와도 방장은 주인.
      _channel = 'togetherroom';
      if(window.firebaseAPI && firebaseAPI.setRoomChannel) await firebaseAPI.setRoomChannel(code, 'togetherroom', _secretOwner);
    } else if(_channel && window.firebaseAPI && firebaseAPI.setRoomChannel){
      /* 만들기: 채널 + 방장(나) 기록. 방을 만든 사람이 최초 방장이다.
         🎲 4번째 인자(open)는 '만들기' 경로에서만 명시적으로 넘긴다 — 다른 경로(시크릿룸·빈 방 승격·
            하트비트)는 안 넘겨서, 같은 코드로 예전에 열었던 랜덤 방의 open:true 를 물려받지 않는다. */
      await firebaseAPI.setRoomChannel(code, _channel, getMyUserId(), (_channel === 'workingroom') && !!window._pendingRoomOpen);
    } else if(!_channel && window.firebaseAPI && firebaseAPI.getRoomChannel){
      const _iAmLicensed = _myRoomLicensed();
      /* 🚪 빈 방(=살아있는 멤버가 0명인 코드)에 들어가는 것은 사실상 '새로 여는 것'이다.
         그래서 채널·방장·개수 상한을 전부 '만들기'와 같은 규칙으로 정한다.

         · 채널은 들어가는 사람의 자격으로 정해진다 — 보유자면 투게더룸, 미보유자면 워킹룸.
           방이 해산되면 코드에는 아무것도 남지 않는다는 기존 사양 그대로다: 남아 있던
           _meta.channel 을 따라가지 않고 여기서 새로 쓴다.
         ★ 이 덮어쓰기가 없으면, 강제종료 등으로 _meta 가 살아남은 투게더룸에 미보유자가 들어갔다가
           방장 승계 판정(_maybeSucceedHost — 이어받을 보유자가 없으면 해산)에 곧바로 튕겨나간다.
           그 찰나에 잠긴 채팅도 잠깐 열린다. 빈 방을 워킹룸으로 내려서 열어주는 편이 옳다:
           승계 쪽이 강등을 그만둔 것은 '사람이 남아 있는 프리미엄 방을 미보유자가 계속 쓰는
           모양새' 때문이었고, 아무도 없는 방은 그 경우가 아니라 그냥 새 방이다.
         · 개수 상한: 빈 방 참여는 roomIndex 에 +1 되므로 만들기와 똑같이 센다. 이 검사가 없으면
           워킹룸 상한이 통째로 우회된다(마지막 사람이 나간 방·한 번도 안 쓴 코드 모두 이 길이다).
         · 동시 입장은 claimEmptyRoom(트랜잭션)이 정리한다 — 보유자 우선, 동급이면 먼저 쓴 쪽.
           그냥 setRoomChannel 로 각자 쓰면 나중 쓰기가 이겨서, 미보유자가 0.1초 늦게 들어오는
           것만으로 보유자의 투게더룸이 워킹룸으로 덮인다.
         · _roomCount 가 null(확인 실패)이면 빈 방 취급을 하지 않는다 — 기존 정원 검사와 같은 태도.
         · 방을 '만드는' 경로는 여기로 오지 않는다(_pendingRoomChannel 이 있어 위 분기로 감) —
           doCreateRoomInChannel 이 이미 검사했으므로 이중 검사가 아니다.
         · 상한 문구·비교식은 doCreateRoomInChannel 과 같은 것을 쓴다(고칠 때 함께 고칠 것). */
      if(_roomCount === 0){
        const _openCh = _iAmLicensed ? 'togetherroom' : 'workingroom';
        const _openLimit = roomLimitOf(_openCh);
        let _openCount = null;
        try{ if(firebaseAPI.getRoomCount){ _openCount = await firebaseAPI.getRoomCount(_openCh); } }catch(_){}
        if(_openCount != null && _openCount >= _openLimit){
          toast(_channelFullMsg(_openCh));
          window._pendingRoomChannel = null;
          window._pendingRoomOpen = false;   // 🎲 만들기 취소 — 토글 값이 다음 입장에 따라붙지 않게
          return;
        }
        let _claim = null;
        try{ if(firebaseAPI.claimEmptyRoom) _claim = await firebaseAPI.claimEmptyRoom(code, getMyUserId(), _iAmLicensed); }catch(_){}
        if(_claim && _claim.channel){
          _channel = _claim.channel;   // 내가 졌으면 이긴 사람이 정한 채널로 들어간다
          if(_claim.mine) toast(_iAmLicensed ? '빈 방을 투게더룸으로 열었어요 👑' : '아무도 없던 방이라 새로 열었어요');
          else toast('같은 순간에 다른 분이 이 방을 열었어요 — ' + (_channel === 'togetherroom' ? '투게더룸' : '워킹룸') + '으로 들어갑니다');
        } else {
          // 구버전 API 폴백 — 선점 없이 예전처럼 그냥 쓴다(동시 입장은 나중 쓰기가 이김)
          _channel = _openCh;
          if(firebaseAPI.setRoomChannel) await firebaseAPI.setRoomChannel(code, _channel, getMyUserId());
        }
      } else {
        /* 사람이 있는 방 — 그 방 채널을 그대로 따른다(방장은 안 건드림).
           🩹 [2026-09-16 제보 2] 단, **표지(`_meta.channel`)가 없으면 되살린다.**
             퇴장 정리의 시차 재조회와 재입장이 겹치면 「멤버는 있는데 `_meta` 만 없는」 방이 남는데,
             예전에는 여기가 무조건 워킹룸으로 떨어뜨렸고 **아무도 다시 쓰지 않아 영원히 워킹룸**이 됐다
             (방장이 다시 들어와도 마찬가지 — 제보의 «나갔다 들어오니 저도 안 뜬다»).
           ⚠️ 되살리는 것은 `recoverRoomChannel` 이다 — `claimEmptyRoom`(빈 방 승격)을 쓰면 **있는 채널도
             덮어써서** 미보유자가 들어오는 것만으로 남의 투게더룸이 워킹룸이 된다.
           ⚠️ 읽기 실패(null)면 **아무것도 하지 않고** 워킹룸으로 간다 — 예전과 같은 자리로 떨어지되,
             그 사이에 표지를 잘못 세우지는 않는다. 네트워크가 나쁜 한 순간에 남의 방을 덮는 것이 더 큰 사고다. */
        let _ex = null;
        try{ if(firebaseAPI.getRoomChannelEx) _ex = await firebaseAPI.getRoomChannelEx(code); }catch(_){}
        if(_ex && _ex.channel){
          _channel = _ex.channel;
        } else if(_ex && !_ex.channel && firebaseAPI.recoverRoomChannel){
          const _iAmLicensed2 = (typeof isPremium()!=='undefined' && isPremium()) || (typeof isAdmin()!=='undefined' && isAdmin());
          let _rec = null;
          try{ _rec = await firebaseAPI.recoverRoomChannel(code, getMyUserId(), _iAmLicensed2); }catch(_){}
          _channel = (_rec && _rec.channel) || 'workingroom';
          if(_rec && _rec.recovered){
            console.log('[방] 표지가 없어 채널을 다시 세웠어요 —', code, _channel);
            if(_channel === 'togetherroom') toast('방 정보가 비어 있어 투게더룸으로 다시 세웠어요' + (_iAmLicensed2 ? ' 👑' : ''));
          }
        } else {
          _channel = await firebaseAPI.getRoomChannel(code);   // 구버전 폴백 · 읽기 실패
        }
      }
    }
  }catch(_){}
  window._activeChannel = (_channel === 'togetherroom') ? 2 : 1;  // 잠긴 채팅 훅(===2)이 이 값으로 부활
  // ★ 대화창 방장 표시용 — 방 메타(host 포함)를 캐시. 실패해도 채팅 자체엔 영향 없음.
  try{
    if(window.firebaseAPI && firebaseAPI.getRoomMeta){ window._roomMetaCache = await firebaseAPI.getRoomMeta(code); }
  }catch(_){ window._roomMetaCache = null; }
  /* 🚪 정원 재확인 — 위 사전 검사(_roomCount)와 여기 사이에는 await 가 여러 개 있다
     (시크릿룸 조회·채널 확정·빈 방 선점·_meta 조회). 그 몇 초 사이에 다른 사람이 먼저
     들어와 자리가 없어질 수 있어서, 실제로 쓰기 직전에 한 번 더 본다.
     ★ 이걸로도 완벽히는 못 막는다 — 확인과 쓰기 사이는 여전히 0 이 아니고, 서버 규칙에
       인원 제한이 없어 서버가 대신 지켜주지도 않는다. 진짜 보증은 들어간 뒤의 자기 퇴장
       (html joinRoom 리스너 → _onRoomOverCapacity)이다. 여기 검사는 그 퇴장이 실제로
       벌어지는 빈도를 낮추는 쪽이다 — 들어갔다 튕기는 것보다 아예 안 들어가는 편이 낫다.
     ⚠️ 확인 실패(네트워크 등)는 막지 않는다 — 사전 검사와 같은 태도. */
  //   🔒 방장은 예약석이 있으므로 재확인 자체를 건너뛴다 — 사전 검사와 같은 규칙이어야 한다.
  //      (여기만 빠뜨리면 사전 검사를 통과한 방장이 몇 초 뒤 이 줄에서 도로 막힌다)
  if(!_iAmSrOwner && window.firebaseAPI && window.firebaseAPI.checkRoomCapacity){
    try{
      let _recount = null, _ownerIn2 = false;
      if(_isSecret && window.firebaseAPI.checkSecretRoomEntry){
        const _sr2 = await window.firebaseAPI.checkSecretRoomEntry(code, _secretOwner);
        if(_sr2){ _recount = _sr2.count; _ownerIn2 = !!_sr2.ownerIn; }
      }
      if(_recount === null) _recount = await window.firebaseAPI.checkRoomCapacity(code);
      const _cap2  = _isSecret ? (maxPeople() - 1) : maxPeople();
      const _here2 = (typeof _recount === 'number')
        ? (_isSecret ? (_recount - (_ownerIn2 ? 1 : 0)) : _recount) : null;
      if(typeof _here2 === 'number' && _here2 >= _cap2){
        toast(_isSecret ? ('이 방은 손님 자리가 다 찼어요(방장 자리 제외 최대 '+(maxPeople()-1)+'명)')
                        : ('이 방은 이미 가득 찼어요(최대 '+maxPeople()+'명)'));
        window._pendingRoomChannel = null;
        window._pendingRoomOpen = false;
        return;
      }
    }catch(_){}
  }
  _clearHiddenSeats();   // 🙈 숨김은 그 방에 있는 동안만
  await Presence.start(code, myDef, getDisplayName(), presenceChanged, { hooks: _firebaseRoomHooks() });
  refreshInviteUI(); toast('방에 연결됐어요: '+code);
  window._pendingRoomChannel = null;
  window._pendingRoomOpen = false;   // 🎲 소비 완료 — 다음 '참여'가 이 값을 물려받지 않게
  if(typeof settingsMod.applyExtraSeatForMode==='function') settingsMod.applyExtraSeatForMode();   // 멀티모드 진입 — 자리추가 좌석은 자동으로 뺌
}
document.getElementById('lcInvite').onclick=()=>{ refreshInviteUI(); startRoomCountWatch(); document.getElementById('inviteOverlay').classList.add('on'); };
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

/* --- 런처의 "🏠 마이홈" 버튼 (예전엔 이름 설정 버튼이었음) --- */
document.getElementById('lcNameBtn').onclick=()=>{
  twNav.go(twNav.NAV.MY_HOME);
};

/* --- 방 개수 표시(n/상한) + 정원 초과 시 생성 차단 --- */
/* ★ 채널별 방 개수 상한 — 원격 설정 roomLimits(remote-config.js · API · 채널마다 1~10000 · 없으면 300).
   Firebase 방 + 방 서버 방을 합친 «전체» 상한이다(방 서버가 roomIndex 장부에 올리면 합계 · 개정 170).
   ⚠️ 이 상한은 **클라이언트에서만** 검사한다 — firebase-database-rules.json의 rooms/$room 은
      "!newData.exists()"(빈 자리에만 생성)만 보고 개수를 세지 않는다. 서버가 셀 수 없는 구조라서다
      (규칙에서 형제 노드 개수를 세려면 rooms 전체를 읽어야 하는데, 그게 바로 예전에 비용 폭탄을
      냈던 접근이다). 그래서 상한을 늘릴 때 규칙 파일은 손댈 게 없다.
   ※ html 기본 표시(#chCountWorking/#chCountTogether «— / 300»)는 기본값과 같게 — 설정을 받으면 _paintRoomLimits 가 고친다. */
const CHANNEL_NAMES = { workingroom: '워킹룸', togetherroom: '투게더룸' };
function roomLimitOf(channel){ const s = _rcStore(); return s ? s.roomLimitOf(channel) : 300; }
/* 꽉 찼을 때 문구 — 방 만들기 · 빈 방 열기(Firebase · 방 서버) · 방 서버 channelFull 이 같은 것을 쓴다. */
function _channelFullMsg(channel){
  const limit = roomLimitOf(channel), name = CHANNEL_NAMES[channel] || '방';
  return `${name}이 지금 꽉 찼어요(${limit}/${limit}) — 잠시 후 다시 시도해 주세요`;
}
/* 설정이 바뀌면 화면 숫자만 고친다(읽기 없음) — «n / 상한» 의 상한 · «최대 N명». */
function _paintRoomLimits(){
  [['chCountWorking','workingroom'],['chCountTogether','togetherroom']].forEach(([id, ch])=>{
    const el = document.getElementById(id); if(!el) return;
    el.textContent = String(el.textContent || '').replace(/\/\s*\d*\s*$/, '/ ' + roomLimitOf(ch));
  });
}
function _paintMaxPeople(){
  const n = String(maxPeople());
  document.querySelectorAll('[data-tw-max-people]').forEach(el=>{ el.textContent = n; });
  const meta = document.getElementById('chMetaTogether');
  if(meta && !meta.querySelector('[data-tw-max-people]')) meta.textContent = String(meta.textContent || '').replace(/최대 \d+명/, '최대 ' + n + '명');
}
(function _watchRemoteRoomConfig(){
  const s = _rcStore(); if(!s) return;
  s.onChange((c, key)=>{ if(key === 'roomLimits') _paintRoomLimits(); else if(key === 'roomMaxPeople') _paintMaxPeople(); });
  _paintRoomLimits(); _paintMaxPeople();
})();
let _liveRoomCount = null;   // 실시간 구독으로 계속 갱신되는 현재 방 개수(모르면 null)
function _updateRoomCountUI(){
  // ⏸️ 요청: [방 만들기 / 참여하기] 아래 "현재 n개 방이 열려 있어요" 문구 숨김.
  //   내부 카운트(_liveRoomCount)와 정원 검사는 그대로 동작 — 화면 문구만 비운다.
  ['inviteRoomCount','fsInviteRoomCount'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.textContent=''; el.style.display='none';
  });
}
/* 💰 방 개수 표시 — 예전엔 앱을 켜는 모든 사용자가 rooms 노드 "전체"를 실시간 구독했음.
   그 안엔 모든 방의 모든 멤버 데이터(얼굴 PNG 포함)가 들어 있어서, 누군가 방에 들어오거나
   하트비트를 보낼 때마다 전 사용자에게 대량 전송 → RTDB 다운로드 폭증의 주원인이었음.
   이제는 "방 창을 열어둔 동안에만" 필요할 때 한 번씩 조회한다(평소 트래픽 0). */
let _roomCountTimer = null;
async function refreshRoomCountOnce(){
  try{
    if(!window.firebaseAPI) return;
    // 💰 getRoomCounts = roomIndex(방당 수십 바이트) 1회 조회. 구버전 API만 있으면 폴백.
    // 표시용이라 서버가 세어 둔 값(quick)이면 충분하다.
    if(firebaseAPI.getRoomCounts){
      const c = await _withServerRoomCounts(await firebaseAPI.getRoomCounts({ quick: true }));
      if(c && c.total != null) _liveRoomCount = c.total;
    } else if(firebaseAPI.getRoomCount){
      _liveRoomCount = await firebaseAPI.getRoomCount();
    } else return;
    _updateRoomCountUI();
  }catch(_){}
}
// 구독으로 받은 숫자를 그린다. null(낡음 · 없음)이면 그대로 두고 아래 30초 확인이 직접 센다.
let _roomCountUnsub = null;
function _paintRoomCounts(c){
  if(!c) return;
  c = _addServerRoomCounts(c);   // 🛰 서버 방 몫(켜져 있을 때 · 마지막으로 받은 값)
  const wl=document.getElementById('chCountWorking'); if(wl && c.workingroom!=null) wl.textContent = `${c.workingroom} / ${roomLimitOf('workingroom')}`;
  const tl=document.getElementById('chCountTogether'); if(tl && c.togetherroom!=null) tl.textContent = `${c.togetherroom} / ${roomLimitOf('togetherroom')}`;
  if(c.total!=null){ _liveRoomCount = c.total; _updateRoomCountUI(); }
}
function startRoomCountWatch(){
  refreshRoomCountOnce();
  if(!_roomCountUnsub && window.firebaseAPI && firebaseAPI.watchRoomCounts) _roomCountUnsub = firebaseAPI.watchRoomCounts(_paintRoomCounts);
  if(_roomCountTimer) return;
  _roomCountTimer = setInterval(()=>{
    // 방 창(모달 또는 F1 멀티모드 탭)이 열려 있을 때만 갱신 — 닫히면 스스로 멈춤
    const ov = document.getElementById('inviteOverlay');
    const fsOpen = document.getElementById('fsInviteRoomCount')?.offsetParent != null;
    if((ov && ov.classList.contains('on')) || fsOpen){
      // 채널 선택 화면이 떠 있으면 _refreshChannelPickUI가 전체+채널별 카운트를 한 번에 갱신하므로
      // refreshRoomCountOnce를 따로 부르지 않음(💰 같은 인덱스를 두 번 읽지 않게).
      const pick=document.getElementById('inviteChannelPick');
      if(pick && pick.style.display!=='none') _refreshChannelPickUI();
      else refreshRoomCountOnce();
    }
    else {
      clearInterval(_roomCountTimer); _roomCountTimer = null;
      if(_roomCountUnsub){ try{ _roomCountUnsub(); }catch(_){} _roomCountUnsub = null; }
    }
  }, 30000);
}

/* ★ 채널 개편: 실제 방 생성 — 채널을 받아 그 채널의 상한을 확인하고 만든다. */
async function doCreateRoomInChannel(channel){
  channel = channel || 'workingroom';
  const limit = roomLimitOf(channel);
  // 해당 채널의 현재 방 개수만 확인(참여는 방 개수가 안 늘어나므로 만들 때만 검사)
  let count = null;
  try{ if(window.firebaseAPI && window.firebaseAPI.getRoomCount){ count = await window.firebaseAPI.getRoomCount(channel); } }catch(e){}
  if(count!=null && count>=limit){
    toast(_channelFullMsg(channel));
    return;
  }
  window._pendingRoomChannel = channel;   // startRoom이 이 값으로 _meta.channel을 기록
  /* 🎲 랜덤 참여 허용 — 워킹룸 카드의 토글만 본다. 투게더룸에는 토글 자체가 없으므로
     혹시 DOM이 남아 있더라도 채널로 한 번 더 막는다(findRandomRooms 의 채널 필터와 함께 세 겹). */
  const _randEl = document.getElementById('chRandOpen');
  window._pendingRoomOpen = (channel === 'workingroom') && !!(_randEl && _randEl.checked);
  const c=genRoomCode(channel);   // 🏷️ #9 — 채널대로 WORK-/PLAY-
  startRoom(c);
}
/* 🎲 랜덤 참여 — 코드 없이 '참여'를 누르면 여기로 온다.
   인덱스는 최대 90초 낡을 수 있어 후보가 이미 꽉 찼거나 사라졌을 수 있다 — 순서대로 확인하며 넘어간다.
   ⚠️ cnt === 0(사람 없이 인덱스만 남은 유령 방)은 건너뛴다. 거기로 들어가면 '빈 방 승격'이 돌아
      새 방을 여는 셈이 되는데, 그건 랜덤 참여의 의도가 아니다(사람을 만나러 누른 것이다).
   ⚠️ 확인은 최대 3회까지만 — 후보마다 shallow 1회 + 멤버당 작은 조회가 붙는다. */
const RANDOM_JOIN_TRIES = 3;
async function doJoinRandomRoom(){
  if(!(window.firebaseAPI && firebaseAPI.findRandomRooms)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
  /* 🛰 서버 방이 먼저(켜져 있을 때만). 서버가 정원 · 생존을 알고 고른 후보라 따로 확인하지 않는다. */
  const _srv = await _serverRandomRooms(12);
  if(_srv.length){ startRoom(_srv[0]); return; }
  const none = ()=>toast('지금은 참여할 수 있는 방이 없어요. 방을 만들어 보세요 🎲');
  let cands = null;
  try{ cands = await firebaseAPI.findRandomRooms(12); }catch(_){}
  if(cands === null){ toast('방 목록을 불러오지 못했어요 — 잠시 후 다시 시도해 주세요'); return; }
  if(!cands.length){ none(); return; }
  let tries = 0;
  for(const code of cands){
    if(tries >= RANDOM_JOIN_TRIES) break;
    tries++;
    let cnt = null;
    try{ if(firebaseAPI.checkRoomCapacity) cnt = await firebaseAPI.checkRoomCapacity(code); }catch(_){}
    if(typeof cnt !== 'number') continue;   // 확인 실패 — 다음 후보로
    if(cnt === 0) continue;                 // 유령 방(인덱스만 남음)
    if(cnt >= maxPeople()) continue;         // 그새 꽉 찼다
    startRoom(code);
    return;
  }
  none();
}
/* 🎲 방 갈아타기 — 지금 방을 나가고 다른 랜덤 워킹룸으로 옮긴다. "여기저기 옮겨다니기"용.
   ★ 후보를 먼저 확정한 뒤에 나간다 — 나가고 나서 찾으면 옮길 곳이 없을 때 그냥 혼자 남는다.
     (그래도 나간 뒤 입장이 실패할 창은 남는다. 그 경우는 아래에서 안내하고 끝낸다)
   ★ 지금 방은 후보에서 뺀다 — 안 그러면 "옮겼는데 그대로"가 된다(제자리 재입장).
   ⚠️ 연타 방지 — 나가기·입장이 각각 await 라, 두 번 누르면 두 방에 반쯤 걸친 상태가 된다. */
let _hoppingRoom = false;
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
  if(!(window.firebaseAPI && firebaseAPI.findRandomRooms)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
  const cur = Presence.roomCode();
  _hoppingRoom = true; _setHopBusy(true);
  try{
    const _srv = (await _serverRandomRooms(12)).filter(c => c !== cur);   // 🛰 서버 방 먼저(켜져 있을 때만)
    if(_srv.length){
      await doLeaveRoom({ wipeChat: true });
      await startRoom(_srv[0]);
      if(!Presence.active()) toast('방을 옮기지 못했어요 — 참여를 다시 눌러주세요');
      return;
    }
    let cands = null;
    try{ cands = await firebaseAPI.findRandomRooms(12); }catch(_){}
    if(cands === null){ toast('방 목록을 불러오지 못했어요 — 잠시 후 다시 시도해 주세요'); return; }
    cands = cands.filter(c => c !== cur);
    /* doJoinRandomRoom 과 같은 후보 검증 — 인덱스는 최대 90초 낡을 수 있다.
       cnt===0(유령 방)을 건너뛰는 이유도 같다: 거기로 가면 '빈 방 승격'이 돌아 새 방을 여는 셈이라
       사람을 만나러 누른 의도와 어긋난다. */
    let target = null, tries = 0;
    for(const code of cands){
      if(tries >= RANDOM_JOIN_TRIES) break;
      tries++;
      let cnt = null;
      try{ if(firebaseAPI.checkRoomCapacity) cnt = await firebaseAPI.checkRoomCapacity(code); }catch(_){}
      if(typeof cnt !== 'number') continue;
      if(cnt === 0) continue;
      if(cnt >= maxPeople()) continue;
      target = code; break;
    }
    if(!target){ toast('지금은 옮겨갈 다른 방이 없어요 — 조금 뒤에 다시 눌러보세요 🎲'); return; }
    await doLeaveRoom({ wipeChat: true });
    await startRoom(target);
    /* startRoom 이 조용히 되돌아가는 경로가 여럿 있다(정원 재확인·버전 게이트 등).
       그 경우 방 밖에 남으므로, 나갔다는 사실만이라도 분명히 알려준다. */
    if(!Presence.active()) toast('방을 옮기지 못했어요 — 참여를 다시 눌러주세요');
  } finally {
    _hoppingRoom = false; _setHopBusy(false);
    refreshInviteUI();
  }
}

/* 채널 선택 화면 표시/복귀 + 라이선스 잠금 반영 */
/* 방 만들기 화면(채널 카드 + 참여 코드)이 상시 표시되므로, 여는 시점에 이 함수로 잠금·카운트만 갱신한다. */
/* 프리미엄(투게더룸) 잠금 상태 + 채널별 카운트 갱신 */
async function _refreshChannelPickUI(){
  const premium = !!(typeof isPremium()!=='undefined' && isPremium()) || !!(typeof isAdmin()!=='undefined' && isAdmin());
  const card=document.getElementById('chCardTogether');
  if(card){
    card.classList.toggle('locked', !premium);
    const emo=document.getElementById('chEmojiTogether');
    const sub=document.getElementById('chSubTogether');
    const meta=document.getElementById('chMetaTogether');
    if(premium){
      /* 💬 .ch-emoji 는 font-size:44px 짜리 큰 자리다 — 그림도 그만큼 키운다.
         ⚠️ 잠금 갈래의 emo.textContent='🚫' 가 이 <img> 를 알아서 걷어낸다(textContent 대입은
           자식 노드를 통째로 비운다). 그래서 되돌리는 코드를 따로 두지 않는다.
         ⚠️ <img> 를 .ch-emoji 에 **직접** 붙이면 안 된다 — .ui-ic-img 가 display:block 이라
           text-align:center 가 먹지 않아 말풍선이 카드 왼쪽 끝에 붙는다(워킹룸 💼 는 글자라
           가운데 있는데 이쪽만 쏠려 보였던 원인). HTML 원본과 똑같이 .ui-ic 스팬(inline-flex)으로
           한 겹 감싸서 _applyUiIcons 가 만들어 두는 모양과 일치시킨다. */
      if(emo){
        emo.textContent='';
        const wrap=document.createElement('span'); wrap.className='ui-ic';
        wrap.appendChild(uiIconEl('chat', 40, '대화하기'));
        emo.appendChild(wrap);
      }
      if(sub){ sub.textContent='대화하며 · 함께'; sub.style.color=''; }
      if(meta) meta.textContent='라이선스 · 최대 '+maxPeople()+'명';
    }else{
      if(emo) emo.textContent='🚫';
      if(sub){ sub.textContent='라이선스가 필요해요'; sub.style.color='#a00'; }
      if(meta) meta.textContent='라이선스 · 최대 '+maxPeople()+'명';
    }
  }
  // 채널별 카운트(가벼운 조회, 실패해도 무시)
  try{
    if(window.firebaseAPI && firebaseAPI.getRoomCounts){
      // 💰 예전엔 getRoomCount(채널)×2 = rooms "전체 트리" 다운로드 2회(회당 ~1MB+)였음 —
      //    이 화면이 떠 있는 동안 30초마다 반복돼 RTDB 다운로드 폭증의 주범이었다.
      //    이제 roomIndex 1회 조회(수 KB 미만)로 전체+채널별 카운트를 한 번에 얻는다.
      // 표시용이라 서버가 세어 둔 값(quick)이면 충분하다.
      const c = await _withServerRoomCounts(await firebaseAPI.getRoomCounts({ quick: true }));
      const wl=document.getElementById('chCountWorking'); if(wl && c.workingroom!=null) wl.textContent = `${c.workingroom} / ${roomLimitOf('workingroom')}`;
      const tl=document.getElementById('chCountTogether'); if(tl && c.togetherroom!=null) tl.textContent = `${c.togetherroom} / ${roomLimitOf('togetherroom')}`;
      if(c.total!=null){ _liveRoomCount = c.total; _updateRoomCountUI(); }   // 전체 문구도 같은 조회로 함께 갱신
    } else if(window.firebaseAPI && firebaseAPI.getRoomCount){
      const [w,t] = await Promise.all([firebaseAPI.getRoomCount('workingroom'), firebaseAPI.getRoomCount('togetherroom')]);
      const wl=document.getElementById('chCountWorking'); if(wl && w!=null) wl.textContent = `${w} / ${roomLimitOf('workingroom')}`;
      const tl=document.getElementById('chCountTogether'); if(tl && t!=null) tl.textContent = `${t} / ${roomLimitOf('togetherroom')}`;
    }
  }catch(_){}
}
/* 🔒 별표(*) 한 글자로 코드 공간을 가른다 — "1234"는 COZY, "1234*"는 SCRT.
   COZY와 SCRT가 둘 다 4자리라 숫자만 보고는 구분할 수 없었고, 조회로 추측하면
   같은 4자리를 쓰는 두 방이 공존할 때 한쪽이 가려진다. 별표는 입력에 명시적으로 담기므로
   COZY-1234와 SCRT-1234가 아무 문제 없이 공존한다(추가 조회도 필요 없다).
   허용 문자는 영숫자 + 맨 뒤 별표 하나뿐 — 나머지 특수문자는 _setupRoomCodeInput이 지운다. */
/* ★ 중복 입장 방지 — 빈 코드일 때 타는 랜덤 참여(doJoinRandomRoom)가 방 목록·정원을 조회하느라
   몇백 ms 걸린다. 그 사이 [참여]를 두 번 누르면 입장이 두 번 돈다.
   (코드를 직접 넣는 경로는 이제 조회 없이 즉시 startRoom 이라 이 가드에 걸릴 일이 없다.) */
let _joiningRoom = false;
/* 🏷️ [2026-10-02 #9] 4자리 + 고른 접두어(WORK-/PLAY-)로 갈 방을 정한다.
   ★ WORK-1234 와 PLAY-1234 는 **서로 다른 방으로 공존한다.** 어느 쪽인지는 입력칸 앞 라벨을 눌러 사람이
     고른다(_setupRoomCodeInput). 그래서 여기서 두 쪽을 조회해 추측하지 않는다 — 추측하면 같은 4자리의
     두 방 중 한쪽이 가려진다(아래 doJoinRoom 의 SCRT 사양과 같은 이유).
   ★ 단 하나의 예외: 고른 방이 비어 있고 같은 4자리의 **옛 COZY- 방**에 사람이 있으면 거기로 간다 —
     구버전 사용자가 아직 쓰는 방이라 새 판에서도 들어갈 길을 남긴다. COZY 방이 비면 이 갈래는 안 탄다.
   ⚠️ 조회 실패는 사람이 없는 것으로 본다(고른 방으로 간다). */
async function _resolveRoomCode(body, chosen){
  const pre = (chosen === ROOM_PREFIX.togetherroom || chosen === ROOM_PREFIX.workingroom || chosen === 'COZY-') ? chosen : _myRoomPrefix();
  if(pre === 'COZY-' || !(window.firebaseAPI && firebaseAPI.checkRoomCapacity)) return pre + body;
  const cnt = async (c)=>{ try{ const n = await firebaseAPI.checkRoomCapacity(c); return (typeof n === 'number') ? n : 0; }catch(_){ return 0; } };
  const [a, z] = await Promise.all([cnt(pre + body), cnt('COZY-' + body)]);
  if(a === 0 && z > 0) return 'COZY-' + body;
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
     🏷️ [#9] 공개 방 쪽(WORK/PLAY/COZY) 안에서의 조회는 _resolveRoomCode 가 한다 — SCRT 와 무관하다. */
  if(secret){ startRoom('SCRT-' + c); return; }
  _joiningRoom = true;
  let _code = null;
  try{ _code = await _resolveRoomCode(c, _explicit || _myRoomPrefix()); } finally{ _joiningRoom = false; }
  startRoom(_code);
}
/* 🔒 시크릿룸 입장 — 코드 공간이 분리돼 있어(SCRT-) 일반 방 코드와 섞이지 않는다.
   미발급 코드 차단은 startRoom 안에서 secretRooms 조회로 한다.
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
  if(!/^[A-Z0-9]{4}$/.test(c)){ toast('시크릿룸 코드는 4자리예요'); return; }
  startRoom('SCRT-'+c);
}
/* ★ 방장 승계 결과 알림 — HTML 리스너의 _maybeSucceedHost가 승계에 성공하면 부른다. */
window._onHostSucceeded = function(meta){
  try{
    if(meta) window._roomMetaCache = meta;   // 대화창 방장 표시 갱신
    toast('내가 새 방장이 됐어요 👑');
    _refreshChatMembers();   // 방장 표시 즉시 갱신
  }catch(_){}
};

/* ★ 방 해산 — 투게더룸 방장이 나갔는데 이어받을 라이선스 보유자가 아무도 없을 때.
   예전엔 무료 워킹룸으로 강등했지만, 이제는 방을 터뜨리고 각자 솔로 모드로 돌린다.
   ★ 이 함수는 남아있는 '모든' 멤버에서 동시에 호출된다(각자 같은 판정을 내리므로).
     그래서 서버에 해산 표시를 쓸 필요가 없고, 대신 여기서 중복 실행만 막으면 된다 —
     방 리스너가 나가는 도중에도 몇 번 더 울리기 때문. */
window._roomDisbanding = false;
window._onRoomDisbanded = function(){
  if(window._roomDisbanding) return;
  window._roomDisbanding = true;
  try{
    toast('방장이 나가고 이어받을 사람이 없어 방이 해산됐어요');
    Promise.resolve(doLeaveRoom({ wipeChat: true })).catch(()=>{}).then(()=>{ window._roomDisbanding = false; });
  }catch(_){ window._roomDisbanding = false; }
};

/* 🚪 정원 초과 — 같은 순간에 여럿이 들어와 정원을 넘겼을 때, 늦게 온 쪽이 스스로 나온다.
   판정은 html(joinRoom 리스너)이 한다 — 살아있는 멤버 목록을 거기서 이미 만들고 있어서다.
   ★ 방 해산(_onRoomDisbanded)과 같은 모양이다: 서버에 표시를 쓰지 않고 각자 같은 판정으로 나간다.
   ⚠️ 리스너가 나가는 도중에도 몇 번 더 울리므로 중복 실행만 막는다. */
window._roomOverCapLeaving = false;
window._onRoomOverCapacity = function(cap){
  if(window._roomOverCapLeaving) return;
  window._roomOverCapLeaving = true;
  try{
    toast('같은 순간에 다른 분이 먼저 들어와 자리가 찼어요(최대 '+(cap||maxPeople())+'명)');
    Promise.resolve(doLeaveRoom()).catch(()=>{}).then(()=>{ window._roomOverCapLeaving = false; });
  }catch(_){ window._roomOverCapLeaving = false; }
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
// ★ 채널 개편 — 채널 카드가 상시 표시되므로 카드 클릭이 곧 방 만들기.
{ const c=document.getElementById('chCardWorking'); if(c) c.onclick=()=>doCreateRoomInChannel('workingroom'); }
/* 🎲 토글은 카드 '안'에 있다 — 그냥 두면 체크하는 순간 카드 클릭이 함께 터져 방이 만들어진다.
   label 활성화(체크 토글)는 버블링과 별개라 stopPropagation 해도 정상 동작한다. */
{ const w=document.getElementById('chRandWrap'); if(w) w.addEventListener('click', e=>e.stopPropagation()); }
{ const c=document.getElementById('chCardTogether'); if(c) c.onclick=()=>{
    const premium = !!(typeof isPremium()!=='undefined' && isPremium()) || !!(typeof isAdmin()!=='undefined' && isAdmin());
    if(!premium){ return; }   // 🚫 라이선스 없으면 눌리지 않음(안내 문구는 카드에 상시 표시)
    doCreateRoomInChannel('togetherroom');
  }; }
document.getElementById('inviteJoin').onclick=()=>doJoinRoom(document.getElementById('inviteCode'));
{ const b=document.getElementById('inviteSecretJoin'); if(b) b.onclick=()=>doJoinSecretRoom(document.getElementById('inviteSecretCode')); }
document.getElementById('inviteLeave').onclick=()=>doLeaveRoom({ wipeChat: true });
{ const b=document.getElementById('inviteHopRandom'); if(b) b.onclick=doHopRandomRoom; }
document.getElementById('inviteRoomCopy').addEventListener('click', e=>{ e.preventDefault(); doCopyRoomCode(); });
// ★ 설정 패널 "멀티모드" 탭 — 모달(inviteOverlay)과 완전히 동일한 동작을 하는 버튼들. 로직은 위 공용
//   함수를 그대로 재사용해서 어느 쪽에서 조작해도 동일하게 동작하고 항상 같은 상태를 보여줌.
// ★ F1 탭의 방 만들기 — 채널 선택이 필요하므로 모달을 열어 채널 카드를 보여준다(모달과 로직 일원화).
const fsInviteCreate=document.getElementById('fsInviteCreate'); if(fsInviteCreate) fsInviteCreate.onclick=()=>{
  const ov=document.getElementById('inviteOverlay'); if(ov){ ov.classList.add('on'); startRoomCountWatch(); }
  refreshInviteUI();   // 카드가 상시 표시 — 잠금/카운트 갱신 포함
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
_setupSecretCodeInput(document.getElementById('inviteSecretCode'));
_setupSecretCodeInput(document.getElementById('fsInviteSecretCode'));

twNav.on(twNav.NAV.LEAVE_ROOM, doLeaveRoom);   // 🧭 다른 기기에 밀려남 · 자리비움 자동 퇴장이 이 통로로 나간다
return {
  CHANNEL_NAMES,
  NET_READY_WAIT_MS,
  ROOM_PREFIX,
  _mockRoomAllowed,
  _srFmtDate,
  _updateRoomCountUI,
  _waitFirebaseApi,
  doLeaveRoom,
  makeMockProvider,
  refreshInviteUI,
  startRoom,
  startRoomCountWatch,
  syncFriendSeats,
};
}

const api = { createRoomEntry };
if(typeof window !== 'undefined') window.TwRoomEntry = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
