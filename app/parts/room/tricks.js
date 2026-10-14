/* tricks.js — 💃 깜짝쇼(날아가기 · 어지러움 · 연속) · 🪄 때리기(말풍선 · 재생 · 방 전파 · 조준 모드)
   app.js «💃💥 깜짝쇼» · «🪄 때리기(bonk)» · «🪄 때리기 — 말풍선 · 재생 · 전파 · 조준 모드» 세 구역의 본문을 그대로 옮긴 모듈이다
   (앱 FSD 25번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다. 사이의 «🔊 효과음 공장»(채팅 · 뽀모도로도 씀)은 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 26줄 —
     FLOATER_BURST · Presence · _bonkSnd · _flyActive · creatorOpen · ndc · officeMode · purikuraUi · ray 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setFlyActive(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 18개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: BONK_BUBBLE_IMG · BONK_BUBBLE_MARK · BONK_BUBBLE_PX · BONK_CURSOR_IMG · BONK_DAILY_MAX · BONK_DAY_KEY · BONK_SND_SRC · BONK_SND_VOL · _bonkAimClick · _bonkAiming · _bonkFrame · _bonkLeft · _eggCountCmd · _eggFire · _eggReadyFor · _flyAimClick · _flyAiming · _flyChatLog · _myFlyCoolUntil · _updateFlyingSeats · applyRemoteBonk · applyRemoteFly · bonkSeat · setBonkAiming · setFlyAiming — app.js 는 tricksMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwTricks — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-tricks.js */
(function(){

function createTricks(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const CHAR_Z = deps.CHAR_Z;
const FLOATER_BURST = deps.FLOATER_BURST;   // 읽는 함수
const FLY_COOL_MS = deps.FLY_COOL_MS;
const FLY_DIZZY_MS = deps.FLY_DIZZY_MS;
const FLY_DROP = deps.FLY_DROP;
const FLY_EDGE_TOP = deps.FLY_EDGE_TOP;
const FLY_EDGE_X = deps.FLY_EDGE_X;
const FLY_MS = deps.FLY_MS;
const FLY_RETURN_MS = deps.FLY_RETURN_MS;
const FLY_STREAK = deps.FLY_STREAK;
const FLY_STREAK_MS = deps.FLY_STREAK_MS;
const Presence = deps.Presence;   // 읽는 함수
const _bonkSnd = deps._bonkSnd;   // 읽는 함수
const _flyActive = deps._flyActive;   // 읽는 함수
const _hitsSkipHidden = deps._hitsSkipHidden;
const _premiumOn = deps._premiumOn;
const _rideIsAbove = deps._rideIsAbove;
const _rideLeaveTower = deps._rideLeaveTower;
const _seatLabelName = deps._seatLabelName;
const _skipHiddenDesk = deps._skipHiddenDesk;
const _todayStr = deps._todayStr;
const camera = deps.camera;
const canFly = deps.canFly;
const canvas = deps.canvas;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const flySeed = deps.flySeed;
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const ndc = deps.ndc;   // 읽는 함수
const officeMode = deps.officeMode;   // 읽는 함수
const purikuraUi = deps.purikuraUi;   // 읽는 함수
const ray = deps.ray;   // 읽는 함수
const seatCharZ = deps.seatCharZ;
const seatFromObject = deps.seatFromObject;
const seatScale = deps.seatScale;
const seats = deps.seats;
const showChatBubble = deps.showChatBubble;
const spawnFloater = deps.spawnFloater;
const startFlight = deps.startFlight;
const toast = deps.toast;
const setFlyActive = deps.setFlyActive;   // 쓰는 함수
const EGG_WINDOW_MS = 60000;
const EGG_DANCE_N   = 3;
let _eggCmdAt = [];       // 내가 친 춤 명령들 [{cmd, t}] — 같은 cmd 가 이어질 때만 쌓인다
/* 이번 명령으로 세 번째가 되는가 — 세면서 판정한다. 부르는 쪽이 카운트를 만지지 않게 여기서 닫는다.
   n = 이 한 줄이 몇 번인가(`/80/80/80` 이면 3). 이어쓰기와 따로 보내기를 한 자리에서 처리한다. */
function _eggCountCmd(cmd, n){
  if(!cmd) return false;                 // 버튼 춤 등 명령이 아닌 춤 — 세지도, 흐름을 끊지도 않는다
  const now = Date.now();
  n = Math.max(1, n|0);
  _eggCmdAt = _eggCmdAt.filter(e => e && e.cmd === cmd && now - e.t < EGG_WINDOW_MS);
  for(let i=0;i<n;i++) _eggCmdAt.push({ cmd, t: now });
  if(_eggCmdAt.length < EGG_DANCE_N) return false;
  _eggCmdAt = [];           // ★ 터뜨렸으면 처음부터 다시 — 네 번째 명령에 연달아 터지지 않는다
  return true;
}
/* 지금 깜짝쇼를 터뜨릴 수 있는 자리인가. 여기서 걸러지는 것이 곧 규칙이다.
   ★ 종류마다 조건이 다르다:
     · 'fly'   — 날릴 상대가 있어야 한다. 방에 아무도 없을 때 센 명령을 쌓아 두면,
                 친구가 들어오자마자 한 번만 더 쳐도 터진다.
     · 'turbo' — **내 회전만 빨라진다.** 상대가 필요 없으므로 혼자여도 센다(방에 있으면
                 스타일이 그대로 전파돼 친구 화면의 내 캐릭터도 같이 빨라진다). */
function _eggReadyFor(kind){
  try{
    if(typeof officeMode() !== 'undefined' && officeMode()) return false;
    if(window._activeChannel !== 2) return false;
    if(kind === 'turbo') return true;
    if(!(typeof Presence() !== 'undefined' && Presence().active())) return false;
    return seats.some(s=>s.remote && s.friendId);
  }catch(_){ return false; }
}
function _eggReady(){ return _eggReadyFor('fly'); }
/* 발동 — 춤은 부른 쪽에서 이미 시작했다. 여기서는 남들만 날린다. */
function _eggFire(){
  seats.filter(s=>s.remote && s.friendId).forEach(s=>{
    if(!canTargetFly(s).ok) return;           // 쉬는 중이거나 올라타 있는 사람은 조용히 건너뛴다
    throwFlyAt(s, true);                      // true = 대화 기록 없음(깜짝쇼)
  });
}

/* ─────────── 🎯 남을 날리기 ───────────
   전파는 **기존 poke 채널**을 그대로 쓴다(`dizzy`·`pet`·`dance` 가 이미 이 길이다).
   새 필드를 파지 않은 이유가 둘이다:
     · poke 는 **맞는 사람의 노드**에 쓰인다(`rooms/$room/$targetId/poke`). 방 안의 모두가
       모든 멤버 노드를 이미 구독하고 있으므로, 한 번 쓰면 전원이 같은 이벤트를 받는다.
       "던진 사람이 각자에게 알린다"가 아니라 "맞은 자리에 표시가 남는다"에 가깝다.
     · 규칙 파일에 poke 전용 항목이 없다 = 이미 통과하고 있는 경로다. 새 필드를 만들면
       `.validate` 를 다시 봐야 한다.
   값 형식은 `dance:스타일` 관례를 따라 `fly:시드` 한 문자열이다.

   ★ 던진 사람도 **자기 화면에서 미리 재생하지 않는다.** 방송이 돌아오면 그때 시작한다.
     먼저 돌리면 내 화면만 왕복 시간만큼 앞서가서, 같은 시드인데도 남들과 위상이 어긋난다.
     대가는 누른 뒤 한 박자(왕복) 늦게 뜨는 것이다. */

/* 내가 지금 쉬는 중인가 — 이 값은 **내 클라이언트가 정하고** 방에 실어 보낸다.
   맞는 쪽이 세는 규칙이므로 판정도 맞는 쪽에서 나야 한다. */
let _myFlyCoolUntil = 0;

/* 이 좌석을 표적으로 삼을 수 있는가. canFly(움직임이 가능한가)와 별개다. */
function canTargetFly(seat){
  /* 🏢 회사원 모드 — 조용히 막는다(토스트 없음). 조준을 켜 둔 채 모드를 켠 경우의 마지막 그물이다.
     ★ 내 화면이 어차피 아무 반응도 안 하므로(applyRemoteFly 게이트), 던지게 두면
       "던졌는데 아무 일도 안 일어난다"가 된다. */
  if(typeof officeMode() !== 'undefined' && officeMode()) return {ok:false, quiet:true};
  if(!seat || !seat.remote || !seat.friendId) return {ok:false, why:'방에 있는 다른 분만 날릴 수 있어요'};
  const nm = (_seatLabelName(seat) || '이 분');
  const cool = seat.remoteFlyCool || 0;
  if(cool && Date.now() < cool){
    return {ok:false, why:nm + '님은 쉬는 중이에요 (' + Math.ceil((cool - Date.now())/1000) + '초)'};
  }
  const c = canFly(seat);
  return c.ok ? {ok:true} : {ok:false, why:nm + '님은 지금 날릴 수 없어요'};
}

/* ─── 조준 모드 ─── */
let _flyAiming = false;
function setFlyAiming(on, quiet){
  if(_flyAiming === !!on) return;
  _flyAiming = !!on;
  try{ canvas.style.cursor = _flyAiming ? 'crosshair' : ''; }catch(_){}
  try{ const b = document.getElementById('chatBombBtn'); if(b) b.classList.toggle('on', _flyAiming); }catch(_){}
  if(!quiet){
    toast(_flyAiming ? '💣 날려버릴 분을 클릭하세요 — ESC · 우클릭 · 빈 곳 클릭으로 취소'
                     : '취소했어요');
  }
}
/* 취소 세 갈래 — ESC · 우클릭 · 빈 곳 클릭(빈 곳은 아래 pointerdown 가로채기에서).
   ⚠️ ESC 는 **앱에 포커스가 있을 때만** 온다. run 모드는 전체화면 투명 오버레이라, 다른 창을
     보고 있는 동안에는 keydown 이 여기까지 오지 않는다. 다만 조준은 채팅창의 💣 를 눌러야
     시작되므로 그 시점엔 항상 포커스가 있다 — 지금 구조에서는 문제가 안 된다. */
window.addEventListener('keydown', e=>{ if(e.key === 'Escape' && _flyAiming) setFlyAiming(false); }, true);
window.addEventListener('contextmenu', e=>{ if(_flyAiming){ e.preventDefault(); setFlyAiming(false); } });

/* 조준 중 클릭 — pointerdown 맨 앞에서 가로채 부른다. */
function _flyAimClick(e){
  if(window._activeChannel !== 2){ setFlyAiming(false, true); return; }
  const r = canvas.getBoundingClientRect();
  ndc().x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc().y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray().setFromCamera(ndc(), camera);
  const hit = _skipHiddenDesk(_hitsSkipHidden(ray().intersectObjects(seats.map(s=>s.group), true)));   // 🙈 숨긴 캐릭터는 표적이 아니다
  const seat = hit.length ? seatFromObject(hit[0].object) : null;
  if(!seat){ setFlyAiming(false); return; }            // 빈 곳 클릭 = 취소
  const t = canTargetFly(seat);
  if(!t.ok){ if(!t.quiet && t.why) toast(t.why); return; }   // 조준은 유지 — 다른 분을 고르면 된다
  setFlyAiming(false, true);
  throwFlyAt(seat);
}

/* 날리기 — 방에 알리고 대화 기록을 남긴다. 내 화면의 재생은 방송이 돌아올 때 시작된다. */
function throwFlyAt(seat, quiet){
  const seed = flySeed();
  try{ if(typeof Presence()!=='undefined' && Presence().active()) Presence().poke(seat.friendId, 'fly:' + seed); }
  catch(_){ toast('전송에 실패했어요'); return; }
  if(quiet) return;                            // 깜짝쇼로 던진 것 — 기록을 남기면 예고가 된다
  const target = (_seatLabelName(seat) || '누군가');
  _flyChatLog(getDisplayName() + '님이 ' + target + '님을 날려버렸어요.💥💥');
}

/* 대화 기록 한 줄 — 🎲 주사위와 같은 경로(sendChatLog).
   ⚠️ 조사는 붙이지 않고 "님이/님을"로 통일한다. 받침 판정 함수를 새로 만들 필요가 없고,
     이모지가 섞인 닉네임에서도 안 깨진다. */
function _flyChatLog(text){
  try{
    const room = (typeof Presence()!=='undefined' && Presence().roomCode) ? Presence().roomCode() : null;
    if(room && window.firebaseAPI && firebaseAPI.sendChatLog){
      firebaseAPI.sendChatLog(room, { uid:getMyUserId(), name:getDisplayName(), text });
    }
  }catch(_){}
}

/* 방송을 받아 실제로 날린다 — 던진 사람 화면 포함 전원이 이 경로를 탄다.
   🏢 회사원 모드 — **내 화면에서는 아무 반응도 하지 않는다.**
     ★ 게이트가 여기 하나인 이유: `fly:` 는 던진 사람도 방송을 받아 재생하는 규약이라
       이 함수가 모든 화면의 유일한 재생 입구다. 여기서 막으면 내가 던진 것도, 남이 던진 것도,
       남끼리 던진 것도 내 화면에서 조용하다. 🪄때리기의 소리 게이트와 같은 자리·같은 기준이다.
     ⚠️ **보는 사람 기준이다.** 던진 사람이 회사원 모드가 아니면 그 사람 화면에서는 정상으로 날아간다 —
       화면마다 판정이 갈리는 것이 의도다(회사에서 티가 안 나는 것이 목적이므로).
     ⚠️ 그래도 **맞은 횟수는 센다.** 안 세면 쉬는 시간(remoteFlyCool)이 안 걸려서, 남들 화면에서는
       내 캐릭터가 끝없이 날아가는 표적이 된다. 방 전체가 같은 규칙 위에 있어야 한다. */
function applyRemoteFly(seat, seedStr){
  if(typeof officeMode() !== 'undefined' && officeMode()){
    if(seat && seat.isMe) registerFlyHit();
    return;
  }
  const seed = parseInt(seedStr, 10);
  /* 🗼 탑 안이면 먼저 뺀다 — **모든 화면이 같은 순서로**(받은 쪽마다 여기서) 한다. 그래야 방 전원의 탑이 같은 모양으로 남는다.
     각 좌석의 주인은 자기 좌석의 새 ridingOn 을 곧 방송하고(mountRide/unmountRide → broadcastRide), 남의 화면은 그걸로 맞춘다. */
  if(seat && (seat.ridingOn || seats.some(s=>s.ridingOn===seat)) && canFly(seat, true).ok) _rideLeaveTower(seat);
  const ok = startFlight(seat, isFinite(seed) ? seed : 0, true);
  /* ★ 카운터는 **맞은 사람의 클라이언트에서만** 올린다. 남의 화면에서 같이 세면 방마다
     따로 세게 되고, 쉬는 시간 판정이 사람마다 어긋난다. */
  if(ok && seat.isMe) registerFlyHit();
}

/* 내가 맞았다 — 연속 횟수를 세고, 기준을 넘으면 쉬는 시간을 걸어 방에 알린다. */
function registerFlyHit(){
  const t = Date.now();
  if(_myFlyLastHit && (t - _myFlyLastHit) > FLY_STREAK_MS) _myFlyHits = 0;   // 시간으로 끊긴다
  _myFlyHits++; _myFlyLastHit = t;
  if(_myFlyHits < FLY_STREAK) return;
  _myFlyHits = 0;
  _myFlyCoolUntil = t + FLY_COOL_MS;
  try{ if(typeof Presence()!=='undefined' && Presence().active() && Presence().broadcastNow) Presence().broadcastNow(); }catch(_){}
  /* 안내는 **착지한 뒤에** 띄운다 — 날아가는 중에 뜨면 무슨 일로 뜬 건지 안 읽힌다. */
  setTimeout(()=>{
    /* 🏢 회사원 모드에서는 토스트를 띄우지 않는다 — 화면에 아무 반응도 없어야 하는데
       글자가 튀어나오면 그 목적이 깨진다(우클릭 차단이 토스트조차 안 띄우는 것과 같은 이유).
       ⚠️ 대화 기록(_flyChatLog)은 남긴다. 그건 방의 기록이라 남들이 읽는 것이고,
         빼면 남들 화면에서 "왜 갑자기 쉬는 중인지" 알 수 없게 된다. */
    if(!(typeof officeMode() !== 'undefined' && officeMode())){
      toast('어지러워요 — ' + (FLY_COOL_MS/1000) + '초 동안 쉬어가요 💫');
    }
    _flyChatLog(getDisplayName() + '님은 잠시 쉬어갑니다.');
  }, FLY_MS + FLY_RETURN_MS);
}
let _myFlyHits = 0, _myFlyLastHit = 0;

const _flyV = new THREE.Vector3();
const _flyBox = new THREE.Box3(), _flyW = new THREE.Vector3();
/* 벽 판정에 쓸 **기준점 높이**(rig 원점에서 몸통 중심까지, 월드 단위).
   ⚠️ 여기를 상수로 박으면 안 된다. 동물은 ANIMAL_RUN_SCALE(0.6)로 줄어들고 좌석 평준화
     (seatEqK)·유저 배율(userScale)도 곱해지므로, 인간 기준 값을 그대로 쓰면 **작은 캐릭터일수록
     실제 몸보다 한참 위를 재게 되고** 그만큼 위 벽에 일찍 부딪힌다("동물이 화면 꼭대기까지
     못 올라간다"가 이 증상이다).
   그래서 파츠까지 포함한 실제 경계상자를 비행 시작 때 **한 번** 잰다. 커스텀 GLB 로 키가
   제각각이어도 자동으로 맞는다. 실패하면 배율만 곱한 근삿값으로 물러선다. */
const FLY_PROBE_FALLBACK = 0.35;
function _flyProbeY(seat){
  try{
    seat.rig.updateMatrixWorld(true);
    _flyBox.setFromObject(seat.rig);
    seat.rig.getWorldPosition(_flyW);
    const mid = (_flyBox.min.y + _flyBox.max.y) / 2 - _flyW.y;
    if(isFinite(mid) && mid > 0.02 && mid < 5) return mid;
  }catch(_){}
  return FLY_PROBE_FALLBACK
       * seatScale(seat)
       * ((seat && seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1);
}
/* 캐릭터의 화면 좌표(NDC). project() 는 인자를 덮어쓰므로 매번 새로 담는다. */
function _flyNdc(seat, probeY){
  seat.rig.getWorldPosition(_flyV);
  _flyV.y += probeY;               // 발밑이 아니라 몸통 중심 — 발끝이 벽에 닿아 튕기면 몸은 이미 화면 밖이다
  _flyV.project(camera);
  return _flyV;
}

/* 매 프레임 — 날고 있는 좌석의 rig 좌표를 **덮어쓴다.**
   frame() 의 seats.forEach 가 rig 를 제자리로 lerp 해 두므로 반드시 그 뒤에 돌아야 한다
   (_updateRideChains 와 같은 이유·같은 자리). */
function _updateFlyingSeats(now, dt){
  /* ★ _flyActive 를 여기서 **다시 센다.** startFlight 가 올리고 endFlight 가 내리는 것만으로는
     방을 나가거나 캐릭터가 교체돼 좌석이 seats 에서 빠지면 그 좌석의 endFlight 가 영영 안 불려
     카운터가 0 으로 안 돌아온다. 그러면 비포커스 프레임 상한이 영구히 풀린 채로 남는다
     (배터리가 조용히 새는 종류의 사고라 눈으로는 못 잡는다). 매 프레임 세면 스스로 낫는다. */
  let live = 0;
  /* 🎥 카메라의 '오른쪽'·'위' 축(월드). 비행 좌표(f.x·f.y)는 월드 X·Y 가 아니라 **이 두 축**을
       탄다.
     [왜] 실행 화면 카메라는 yaw 5° 로 비스듬히 서 있다(applyCameraAndCanvas). 월드 X 로 옮기면
       옆으로 갈수록 카메라와의 거리가 sin(5°)=0.087 배씩 딸려 들어가고, 원근이라 그만큼
       **캐릭터가 커진다.** 화면상 왼쪽으로 갈수록 커지던 게 이것이다.
       화면과 나란한 면 위에서 움직이면 깊이가 변하지 않아 크기가 그대로다.
     ★ 흔들기 드래그가 이미 이 방식이다(grabPlane 이 카메라 방향에 수직인 평면이다). 즉 이
       수정으로 비행과 드래그가 **같은 평면 위에서** 움직이게 된다.
     ⚠️ elements 로 직접 읽는다 — extractBasis 를 쓰면 스모크의 THREE 스텁에 없는 메서드라 부팅
       검사가 죽는다. 행렬 열 0=오른쪽, 열 1=위.
     ⚠️ 이걸로도 **완전히 일정해지지는 않는다.** 남는 변화는 광각 렌즈(RUN_FOV_DEG 50) + 오프센터
       투영 때문에 화면 가장자리에서 형태가 늘어나는 것으로, 좌석을 화면 끝으로 끌어다 놓을 때
       책상이 몸을 가리던 그 현상과 뿌리가 같다. 그건 카메라 설정을 바꿔야 없어진다. */
  const _cm = (camera && camera.matrixWorld && camera.matrixWorld.elements) || null;
  const rx = _cm ? _cm[0] : 1, ry = _cm ? _cm[1] : 0, rz = _cm ? _cm[2] : 0;
  const ux = _cm ? _cm[4] : 0, uy = _cm ? _cm[5] : 1, uz = _cm ? _cm[6] : 0;
  for(let i = 0; i < seats.length; i++){
    const seat = seats[i], f = seat.fly;
    if(!f) continue;
    const cz = seatCharZ(seat);
    /* 비행 좌표 → 좌석 로컬 좌표. group 은 이동만 하고 회전·배율이 없으므로 월드 오프셋이
       그대로 로컬 오프셋이 된다(회전하는 group 이 생기면 여기부터 손봐야 한다). */
    const place = (ax, ay) => seat.rig.position.set(
      rx * ax + ux * ay,
      ry * ax + uy * ay,
      cz + rz * ax + uz * ay
    );

    if(f.phase === 'air'){
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      place(f.x, f.y);
      seat.rig.rotation.z = f.spin * (now - f.t0) / 1000;
      seat.group.updateMatrixWorld(true);        // 방금 옮긴 값으로 투영해야 한 프레임 늦지 않는다

      if(f.probeY == null) f.probeY = _flyProbeY(seat);
      const n = _flyNdc(seat, f.probeY);
      if(f.yLo == null) f.yLo = n.y - FLY_DROP;  // 시작 높이 기준 — 카메라 줌이 어떻든 책상 줄 언저리
      if(n.x >  FLY_EDGE_X   && f.vx > 0) f.vx = -f.vx;
      if(n.x < -FLY_EDGE_X   && f.vx < 0) f.vx = -f.vx;
      if(n.y >  FLY_EDGE_TOP && f.vy > 0) f.vy = -f.vy;
      if(n.y <  f.yLo        && f.vy < 0) f.vy = -f.vy;

      if(now - f.t0 >= f.dur){
        f.phase = 'back'; f.backAt = now; f.fromX = f.x; f.fromY = f.y;
        f.fromRot = seat.rig.rotation.z % (Math.PI * 2);
      }
    } else {
      const p = Math.min(1, (now - f.backAt) / FLY_RETURN_MS);
      const e = p * p * (3 - 2 * p);             // smoothstep — 끝에서 툭 멈추지 않게
      place(f.fromX * (1 - e), f.fromY * (1 - e));
      seat.rig.rotation.z = f.fromRot * (1 - e);
      if(p >= 1) endFlight(seat, now);
    }
    if(seat.fly) live++;                         // endFlight 가 돌았으면 여기서 빠진다
  }
  setFlyActive(live);
}

function endFlight(seat, now){
  seat.fly = null;   // 카운터(_flyActive)는 _updateFlyingSeats 가 매 프레임 다시 센다
  seat.rig.position.set(0, 0, seatCharZ(seat));
  seat.rig.rotation.z = 0;
  seat.dizzyUntil = now + FLY_DIZZY_MS;          // seatState 가 'dizzy' 를 돌려준다
  for(let i = 0; i < FLOATER_BURST(); i++) setTimeout(()=>spawnFloater('💫','#f5a94f', seat), i * 300);
}

const BONK_FLAT_MS   = 1200;    // 납작해져 있는 시간
const BONK_SPRING_MS = 700;     // 보잉(감쇠 진동)으로 돌아오는 시간
const BONK_FLAT_Q    = 0.55;    // 납작할 때의 세로 배율
const BONK_DIZZY_MS  = 2500;    // 맞은 뒤 어지러움 — 흔들기·플라잉체어와 같은 값
const BONK_DAILY_MAX = 30;      // 하루 한도 — ★ 대상별이 아니라 **전체** 30회다
                                //   ⚠️ 숫자를 다른 곳에 적지 말 것. 우클릭 메뉴·조준 안내가 이 상수를 읽는다.
/* 🔊 음량 — **1.0 이다.** BGM(_advBgm 등)의 0.5 를 베끼면 안 된다.
   ⚠️ 처음에 0.5 로 뒀다가 "소리가 잘 안 들린다" 제보를 받았다. 재 보니 이유가 둘이었다:
     ① 파일 자체의 최대 진폭이 -4.8 dBFS 였다(잘라 만든 파일이라 여유가 남아 있었다)
     ② 거기에 0.5(=-6 dB)를 더 곱해 실효 -10.8 dBFS 가 됐다
   파일은 -1.4 dBFS 로 노멀라이즈했고(같은 길이·같은 128kbps·페이드 유지), 여기는 1.0 으로 둔다.
   ★ BGM 은 **밑에 깔리는** 소리이고 타격음은 **뚫고 나와야 하는** 소리다 — 같은 값을 쓸 이유가 없다.
   ⚠️ 전역 효과음 음량 설정이 아직 없다. 생기면 이 상수 자리를 그 값으로 갈아끼울 것(8절 ③). */
const BONK_SND_VOL   = 0.5;
/* 🔊 파일 경로 폴백 — mystery-au.js 선례(['parts/x.mp3','x.mp3']). 검사 폴더에서도 돌게. */
const BONK_SND_SRC   = ['parts/bonk.mp3', 'bonk.mp3'];

/* 📅 하루 카운터 — 웹박수 선례(localStorage + 날짜)를 따르지만 **키에 대상을 넣지 않는다.**
   ⚠️ 웹박수는 `gbClap:대상:날짜` 로 대상별이다. 그걸 그대로 베끼면 사람마다 따로 한도가
     생겨 사실상 무제한이 된다 — 그래서 대상 없는 키 하나다.
   ⚠️ 날짜는 `_todayStr()`(로컬)를 쓴다. 웹박수의 toISOString 은 UTC 라 하루 어긋난다. */
const BONK_DAY_KEY = 'tw.bonkDay';
function _bonkDayRec(){
  try{
    const raw = localStorage.getItem(BONK_DAY_KEY);
    const rec = raw ? JSON.parse(raw) : null;
    if(rec && rec.d === _todayStr()) return { d: rec.d, n: Math.max(0, rec.n|0) };
  }catch(_){}
  return { d: _todayStr(), n: 0 };
}
function _bonkLeft(){ return Math.max(0, BONK_DAILY_MAX - _bonkDayRec().n); }
function _bonkUse(){
  const rec = _bonkDayRec(); rec.n++;
  try{ localStorage.setItem(BONK_DAY_KEY, JSON.stringify(rec)); }catch(_){}
}

/* 🎬 납작 계수 q(e) — 호흡(breathe)이 이미 부피보존 스쿼시라 **같은 꼴로 q 를 곱하면 된다.**
     q < 1 이면 세로로 눌리고 가로·앞뒤가 1/√q 로 벌어진다(부피 보존).
   납작 구간은 상수, 그 뒤는 1 로 돌아오는 감쇠 사인 — `pet` 의 감쇠 진동과 같은 종류다. */
function _bonkQ(e){
  if(e < BONK_FLAT_MS) return BONK_FLAT_Q;
  const d = e - BONK_FLAT_MS;
  if(d > BONK_SPRING_MS) return 1;
  const w = 2 * Math.PI * 1.75 / BONK_SPRING_MS;
  const tau = BONK_SPRING_MS / 3.2;
  return 1 - (1 - BONK_FLAT_Q) * Math.cos(d * w) * Math.exp(-d / tau);
}

/* 매 프레임 — 스쿼시를 **곱하고**, 끝나는 프레임에서 dizzy 를 파생시킨다.
   ★ 절대값이 아니라 배율이다. 세 분기(clipped·rigged·폴백)가 각자 다른 값을 써 놓은 뒤에
     이 함수가 그 위에 곱한다 — 그래서 호출은 분기 **밖에서 한 번**이면 세 분기가 다 덮인다.
     ⚠️ `_bs = seatScale(seat)` 규약(동물 40%·평준화 eqK 가 그 안에 들어 있다)을 건드리지 않는
       유일한 방법이다. 여기서 scale.set(절대값) 을 하면 CSP 핸드오프 3절의 그 실수가 된다.
   ⚠️ dizzy 를 setTimeout 으로 걸지 않는다 — 연타하면 타이머가 누적돼 dizzy 가 겹쳐 늘어난다.
     스쿼시가 이미 프레임 루프에 있으므로 거기서 파생시키는 게 맞다. */
function _bonkFrame(seat, now){
  if(!seat || !seat.bonkStart || !seat.bodyWrap) return;
  const e = now - seat.bonkStart;
  if(e < 0) return;
  if(e >= BONK_FLAT_MS + BONK_SPRING_MS){
    if(!seat._bonkDizzyDone){
      seat._bonkDizzyDone = true;
      seat.dizzyUntil = now + BONK_DIZZY_MS;   // seatState 가 'dizzy' 를 돌려준다
      for(let i = 0; i < FLOATER_BURST(); i++) setTimeout(()=>spawnFloater('💫','#f5a94f', seat), i * 300);
    }
    seat.bonkStart = 0;
    return;
  }
  const q = _bonkQ(e), inv = 1 / Math.sqrt(q), s = seat.bodyWrap.scale;
  s.set(s.x * inv, s.y * q, s.z * inv);
}

function _bonkPlaySound(){ _bonkSnd().play(); }

/* 🪄 때리기 말풍선에 넣는 **전용 마커**와 그 그림(뿅망치).
   예전에는 말풍선에 '🪄' 글자 한 개를 넣었다 — 말풍선 폰트(15px Tahoma)를 그대로 타서 실제로
   15px 남짓으로 나왔고, 시스템 이모지 폰트에 따라 모양도 기기마다 달랐다. 지금은 마커를 넣고
   setSeatHeadBubble 이 그림으로 바꿔 그린다(48px).
   ★ demoji 표에 등록하지 않은 이유가 둘이다.
     ① 등록하면 이모티콘 팔레트와 /명령에 뿅망치가 같이 올라간다 — 때리기 연출로 쓰려던 것이
        채팅으로 아무 때나 보낼 수 있는 이모티콘이 되어 버린다.
     ② 그 경로는 30px 이 상한이다(춤만 60px). 30px 에서는 머리의 빨강/노랑 줄무늬가 서로 섞여
        주황 덩어리로 뭉갠다 — 뿅망치로 안 읽힌다.
   ★ 그림은 96px 로 넣고 48px 로 줄여 그린다. 고밀도 화면에서 뭉개지지 않게 하려는 2배수다.
   ★ data: 인 것은 자리비움 스프라이트(EMOJI_TEX_IMG)와 같은 이유다 — file:// 에서도 확실히
     뜨고, 늦게 도착해 한 프레임 빈칸이 스치는 일이 없다. (CSP 의 img-src 에 data: 가 이미 있다.)
   ⚠️ 이 마커는 **화면에만** 쓴다. 방송으로 오가는 것은 poke.type 이고 _bonkPlay 는 받는 쪽에서
     각자 도는 함수다 — 그래서 이 값을 바꿔도 통신 규약은 그대로고, 구버전 상대와도 안 어긋난다.
   ⚠️ 마커 문자열을 바꾸면 setSeatHeadBubble 의 **두 자리**를 같이 고쳐야 한다:
     회사원 모드 되돌림, 그리고 마커 정규식. 한쪽만 고치면 대괄호가 글자로 찍힌다. */
const BONK_BUBBLE_MARK = '[bonk]';
const BONK_BUBBLE_PX   = 28;
const BONK_BUBBLE_IMG  = 'data:image/png;base64,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';

/* 🪄 말풍선을 띄울 좌석 = **때린 사람**의 좌석.
   ⚠️ poke.from 으로는 못 찾는다 — 그건 방 세션마다 새로 뽑히는 memberId 이고 app.js 는 자기
     memberId 를 모른다. 그래서 영구 userId 를 payload(type)에 실어 보낸다.
   ⚠️ 구버전 상대는 userId 가 없어 friendUserId 가 null 일 수 있다 → 🪄 만 생략하고 스쿼시는
     그대로 재생한다(효과가 통째로 사라지면 버그로 보인다). */
function _bonkHitterSeat(hitterUid){
  if(!hitterUid) return null;
  try{
    if(hitterUid === getMyUserId()) return seats.find(s=>s.isMe) || null;
    return seats.find(s=>s.friendUserId === hitterUid) || null;
  }catch(_){ return null; }
}

/* 실제 재생 — 이 함수가 화면에 보이는 전부다. 로컬 즉시 재생과 방송 수신이 **같은 경로**를 탄다.
   🐾 동물탑: 맞은 좌석 위에 (직·간접으로) 올라탄 좌석 전부에 같은 bonkStart 를 심는다.
     _rideIsAbove(rider, base) 가 ridingOn 사슬을 16단까지 거스르므로 2층·3층이 자동 포함된다.
     ⚠️ 인자 순서를 뒤집으면 위층이 아니라 **아래층**을 모은다(사양서 5-2 의 예시가 뒤집혀 있었다). */
function _bonkPlay(targetSeat, hitterUid){
  if(!targetSeat) return;
  const now = performance.now();
  let list = [targetSeat];
  try{ list = list.concat(seats.filter(s=>s !== targetSeat && _rideIsAbove(s, targetSeat))); }catch(_){}
  list.forEach(s=>{
    s.bonkStart = now;
    s._bonkDizzyDone = false;
    // 표정 반응 — triggerPet 과 같은 한 줄. 상태를 새로 만들지 않는다.
    if(s.blink && s.blink.pulses) s.blink.pulses.push({ start: now, dur: 240 });
  });
  _bonkPlaySound();
  const hs = _bonkHitterSeat(hitterUid);
  if(hs) showChatBubble(hs, BONK_BUBBLE_MARK);
}

/* 지금 이 좌석을 때릴 수 있는가 — **여기서 걸러지는 것이 곧 규칙이다.**
   ★ 진입이 둘(우클릭 메뉴 · b 키 조준)이라 게이트를 양쪽에 복사하면 한쪽만 고쳐지는 사고가 난다.
     두 진입 경로가 이 함수 하나를 통과한다.
   quiet=true 는 "토스트도 띄우지 않는다" — 회사원 모드와 비프리미엄이 그렇다. */
function canBonk(seat){
  if(!_premiumOn())                    return { ok:false, quiet:true };   // 파츠 licenseOnly 와 같은 태도
  if(!seat)                            return { ok:false, why:'좌석이 없어요' };
  if(seat.isPlaceholder)               return { ok:false, why:'아직 캐릭터가 없어요' };
  if(seat.inPreview)                   return { ok:false, why:'미리보기 중에는 안 돼요' };
  if(seat.fly)                         return { ok:false, why:'날아가는 중에는 때릴 수 없어요' };
  /* 🏢 회사원 모드 — 상대 캐릭터는 우클릭 자체가 안 먹는다(토스트도 없다). 내 캐릭터는 통과한다:
     소리는 수신 쪽 게이트가 알아서 무음 처리하므로 "회사에서 조용함"은 지켜지고,
     여기까지 막으면 회사원 모드에서 내 캐릭터 편집 메뉴를 못 열게 된다. */
  if(typeof officeMode() !== 'undefined' && officeMode() && seat.remote) return { ok:false, quiet:true };
  if(_bonkLeft() <= 0)                 return { ok:false, why:'오늘은 다 썼어요' };
  return { ok:true };
}

/* 때린다 — 카운터·로컬 재생·전파. 두 진입 경로의 **공통 출구**다. */
function bonkSeat(seat){
  const c = canBonk(seat);
  if(!c.ok){ if(!c.quiet && c.why) toast(c.why); return false; }
  _bonkUse();
  const myUid = getMyUserId();
  _bonkPlay(seat, myUid);                     // ★ 즉시 로컬 재생 — 왕복을 기다리지 않는다
  /* 전파 — 새 RTDB 필드를 만들지 않는다. poke 는 규칙 파일이 이미 통과시키는 경로다.
     ⚠️ 방에 혼자이거나 방 밖이면 보낼 곳이 없다 → 로컬 재생만 하고 조용히 넘어간다(pet 과 같은 규약). */
  try{
    if(typeof Presence() !== 'undefined' && Presence().active()){
      if(seat.remote && seat.friendId) Presence().poke(seat.friendId, 'bonk:' + myUid);
      /* 🆕 자기 때리기 — 내 노드에 쓴다. 그래야 "내가 나를 때리는 걸 친구가 본다".
         app.js 는 자기 memberId 를 모르므로 firebaseAPI 쪽 진입점(pokeSelf)이 필요하다. */
      else if(!seat.remote && Presence().pokeSelf) Presence().pokeSelf('bonk:' + myUid);
    }
  }catch(_){}
  return true;
}

/* 방송을 받아 재생한다 — 수신 분기 **두 곳**이 같이 부른다(내 노드 / 친구 sync).
   ⚠️ 내가 보낸 poke 는 sync 를 타고 나에게도 돌아온다. 때린사람이 나면 이미 로컬에서
     재생했으므로 건너뛴다 — 안 그러면 한 번 때린 게 두 번 보인다. */
function applyRemoteBonk(seat, payload){
  const hitterUid = String(payload || '').slice(5);   // 'bonk:' 다음
  try{ if(hitterUid && hitterUid === getMyUserId()) return; }catch(_){}
  _bonkPlay(seat, hitterUid);
}

/* ─── 🎯 조준 모드 — 💣 선례(setFlyAiming/_flyAimClick)를 그대로 베낀다 ───
   b 키로 켜고 캐릭터를 클릭하면 때린다. 한 번 때리면 해제.
   🔨 커서는 data URL PNG 다 — CSP `img-src ... data:` 로 이미 허용되고(정책 수정 불필요),
   못 그리는 환경에서는 뒤의 crosshair 로 떨어져 💣 와 같은 모양이 된다. */
/* 🔨 조준 커서 그림 — 위 BONK_BUBBLE_IMG(96px 뿅망치)를 **32px 로 줄인 같은 그림**이다.
   [2026-08 교체] 예전엔 SVG 안에 '🪄' 글자를 그려 넣은 커서였다. 시스템 이모지 폰트를 타서
     기기마다 모양이 달랐고, 말풍선에 뜨는 그림(뿅망치)과도 서로 달랐다 — 같은 동작인데 조준할 땐
     마법봉, 맞을 땐 망치였다. 이제 둘이 같은 그림이다.
   ⚠️ BONK_BUBBLE_IMG 를 그대로 쓰지 않은 이유: 그건 96px 이고, 커서는 그린 크기 그대로 뜬다
     — 화면에 손바닥만 한 망치가 따라다닌다. 그래서 32px 판을 따로 둔다.
     ⚠️ 그림을 바꿀 땐 **둘 다** 바꿔야 색·모양이 안 어긋난다.
   ⚠️ 크로미움은 커서 그림을 128px 까지만 받는다 — 더 키우면 조용히 무시되고 뒤의 crosshair 만 남는다. */
const BONK_CURSOR_IMG = 'data:image/png;base64,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';
/* 손잡이 끝이 아니라 **망치 머리 한가운데**(19,12)를 조준점으로 둔다 — 클릭한 지점에 머리가 얹힌다.
   (예전 마법봉은 4,28 = 왼쪽 아래였다. 그림이 바뀌었으니 이 숫자도 같이 바뀐 것이다.) */
const BONK_CURSOR = 'url("' + BONK_CURSOR_IMG + '") 19 12, crosshair';
let _bonkAiming = false;
function setBonkAiming(on, quiet){
  if(_bonkAiming === !!on) return;
  _bonkAiming = !!on;
  // 조준이 둘 겹치면 캐릭터를 클릭했을 때 날아갈지 맞을지가 순서로 갈린다 — 한쪽을 켜면 다른 쪽을 끈다
  try{ if(_bonkAiming && typeof _flyAiming !== 'undefined' && _flyAiming) setFlyAiming(false, true); }catch(_){}
  try{ canvas.style.cursor = _bonkAiming ? BONK_CURSOR : ''; }catch(_){}
  if(!quiet){
    toast(_bonkAiming
      ? '때릴 분을 클릭하세요 (' + _bonkLeft() + '/' + BONK_DAILY_MAX + ') — ESC · 우클릭 · 빈 곳 클릭으로 취소'
      : '취소했어요', _bonkAiming ? BONK_CURSOR_IMG : null);
  }
}
/* 조준 중 클릭 — pointerdown 맨 앞에서 가로채 부른다(드래그·흔들기보다 먼저). */
function _bonkAimClick(e){
  const r = canvas.getBoundingClientRect();
  ndc().x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc().y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray().setFromCamera(ndc(), camera);
  const hit = _skipHiddenDesk(_hitsSkipHidden(ray().intersectObjects(seats.map(s=>s.group), true)));   // 🙈 숨긴 캐릭터는 표적이 아니다
  const seat = hit.length ? seatFromObject(hit[0].object) : null;
  if(!seat){ setBonkAiming(false); return; }          // 빈 곳 클릭 = 취소
  const c = canBonk(seat);
  if(!c.ok){ if(!c.quiet && c.why) toast(c.why); return; }  // 조준 유지 — 다른 분을 고르면 된다
  setBonkAiming(false, true);                          // 한 번 때리면 해제
  bonkSeat(seat);
}
/* ⌨️ b — 조준 토글.
   ⚠️ e.repeat 를 걸러야 한다. 꾹 누르면 하루 10회가 1초에 사라진다.
   ⚠️ 입력창 포커스 중에는 안 먹어야 한다 — 채팅에 "bonk" 을 치면 매 글자마다 조준이 켜진다.
     (생성기의 C·X·Z 단축키가 쓰는 것과 같은 가드다.)
   ★ 비프리미엄은 **무반응**이다. 메뉴가 때리기 줄을 아예 안 넣는 것과 같은 태도로,
     "프리미엄이면 쓸 수 있어요" 같은 안내는 이 파일에 없던 규약이다. */
window.addEventListener('keydown', e=>{
  if(hotkeyLetter(e) !== 'b') return;
  if(e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const t = e.target, tag = (t && t.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) return;
  try{ if(creatorOpen()) return; }catch(_){ return; }    // 편집창에서는 그리기 단축키의 영역이다
  /* 📷 촬영 창이 열려 있으면 키는 무대의 것이다 — OPEN_MODAL_SEL 이 F1~F5 를 막는 것과 같은 이유.
     이 핸들러는 그 목록을 안 보므로 여기에 한 줄이 더 필요하다. */
  try{ if(purikuraUi().isOpen()) return; }catch(_){}
  if(!_premiumOn()) return;
  if(_bonkAiming){ setBonkAiming(false); return; }
  if(_bonkLeft() <= 0){ toast('오늘은 다 썼어요'); return; }
  setBonkAiming(true);
});
/* ESC 취소 — 캡처 단계에서 소비했을 때만 전파를 끊는다(ESC 핸들러가 16곳에 흩어져 있어,
   안 끊으면 한 번에 조준과 다른 창이 같이 닫힌다). */
window.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && _bonkAiming){ e.stopPropagation(); setBonkAiming(false); }
}, true);

return {
  BONK_BUBBLE_IMG,
  BONK_BUBBLE_MARK,
  BONK_BUBBLE_PX,
  BONK_CURSOR_IMG,
  BONK_DAILY_MAX,
  BONK_DAY_KEY,
  BONK_SND_SRC,
  BONK_SND_VOL,
  _bonkAimClick,
  _bonkAiming: ()=>_bonkAiming,   // 읽는 함수
  _bonkFrame,
  _bonkLeft,
  _eggCountCmd,
  _eggFire,
  _eggReadyFor,
  _flyAimClick,
  _flyAiming: ()=>_flyAiming,   // 읽는 함수
  _flyChatLog,
  _myFlyCoolUntil: ()=>_myFlyCoolUntil,   // 읽는 함수
  _updateFlyingSeats,
  applyRemoteBonk,
  applyRemoteFly,
  bonkSeat,
  setBonkAiming,
  setFlyAiming,
};
}

const api = { createTricks };
if(typeof window !== 'undefined') window.TwTricks = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
