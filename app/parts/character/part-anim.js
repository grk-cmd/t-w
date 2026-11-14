/* part-anim.js — ▶ 파츠 · 책상 아이템 애니메이션 재생(앱 FSD · app.js 분리 M4)
   app.js BUILDERS 구역의 «재생» 조각을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(deps 로 받는 세 이름만 읽는 함수로 바뀜).
   ・책임: 파츠 클립 고르기(_pickPartClip · 움직이는 클립이 이름보다 먼저) · 귀 파츠 클립에서 남이 맡은 본 트랙 걷기 · 파츠 믹서 세우기 / 걷기(_setupPartIdleAnim · _teardownPartIdleAnim) ·
     «활동 중에만 재생» 파츠(updateActivePartPlayback) · 아이템 idle 재생(updateIdleItemPlayback) · 손 본 따라가기(updateItemHandTrackers) · 아이템 눌러 재생(playItemIdle).
   ・받는 deps 4 — seatState(좌석 활동 상태) · toast · 읽는 함수: isAdmin · seats · userStatus(다시 대입되는 let 이거나 늦게 선언돼서).
   ・내놓는 것: activeItemMixers(매 프레임 돌릴 믹서 Set — frame() 이 돌린다) · _idleItemPivots · _clipHasMotion · _pickPartClip · _partAnimNotice · _stripPartClipOwnedTracks ·
     _setupPartIdleAnim · _teardownPartIdleAnim · updateActivePartPlayback · updateIdleItemPlayback · updateItemHandTrackers · playItemIdle
   ⚠️ 멈출 때 stop() 이 아니라 paused=true — stop 은 0프레임으로 되감아 파츠가 툭 튄다. 재생 판정은 seatState(holder) === 'focus'(활동 중)일 때만.
   ⚠️ _partAnimNotice 는 첫 줄 return 으로 꺼져 있다(토스트 잡음). 진단은 console.log [파츠 애니] 로.
   검사: checks/sim-part-anim.js */
(function(){

function createPartAnim(deps){
const seatState = deps.seatState;
const toast = deps.toast;
const isAdmin = deps.isAdmin;
const seats = deps.seats;
const userStatus = deps.userStatus;
const activeItemMixers = new Set();   // 매 프레임 업데이트해야 할 아이템 애니메이션 믹서들
// ★ 어플 8: playMode='idle'로 등록된 아이템 pivot들 — 매 프레임 소유 좌석 상태에 따라 재생/정지 전환.
//   ★ 이름이 헷갈리지만 요청 동작은 이거예요:
//     유저가 활동 중(마우스/타이핑) = 캐릭터 seatState()가 'focus' → 아이템 애니메이션 재생.
//     가만히 있음(idle) / 자리비움(sleep) / 어지러움(dizzy) / 기타 → 정지.
//   (관리자 UI에서 부르는 "idle 애니메이션"은 아이템 자체의 대기·존재감 연출 애니메이션이라는 뜻이고,
//    이건 유저가 화면을 볼 만한 시점에만 돌아가면 됨.)
const _idleItemPivots = new Set();

/* ▶ 꾸미기 파츠 애니메이션 ─────────────────────────────────────────────────
   책상 위 아이템의 playMode='idle'과 같은 동작을 파츠에도 제공한다.
   animMode==='active'인 파츠는 아래 Set에 등록되고, updateActivePartPlayback()이 매 프레임
   소유 좌석 상태를 보고 재생/일시정지를 전환한다.
     재생  : seatState==='focus' (마우스·타이핑이 감지되는 활동 중)
     일시정지: 그 외 전부 — 자리비움(sleep) · 어지러움(dizzy) · 가만히 있음(idle) 등
   ★ stop()이 아니라 paused=true를 쓰는 이유: stop은 0프레임으로 되감아 파츠가 툭 튀는데,
     일시정지는 그 자리에 멈춰 있다가 활동을 재개하면 이어서 움직인다. */
const _activePartWraps = new Set();
/* 🎬 파츠 애니메이션 진단을 **화면에도** 띄운다.
   [경위] 진단은 원래 console.log 뿐이었는데, "안 움직인다"를 보고할 때 F12 를 열어 보는 사람이
     없다시피 했다. 그래서 같은 내용을 토스트로도 한 번 낸다 — 원인 셋이 화면에서 전부 똑같이
     '안 움직임'으로 보이는 것이 이 문제의 본질이라, 구분해 주는 것 자체가 답이다.
   ⚠️ 관리자에게만 낸다. 일반 유저는 남의 파츠를 장착할 때마다 이 안내를 받을 이유가 없다.
   ⚠️ 같은 파츠에 대해 한 번만 낸다 — 장착·재조립이 반복될 때마다 뜨면 토스트가 화면을 덮는다. */
/* 🎬 이 클립이 **실제로 움직이는가** — 키프레임 값이 첫 프레임과 전부 같으면 '정지 포즈'다.
   [경위] 클립이 여러 개 든 GLB 에서, 이름은 idle 인데 값이 전부 같은(포즈만 든) 클립이 실제로 있었다.
     그러면 앱은 정상적으로 재생하는데 화면은 안 움직여서, '클립이 0개'인 경우와 구분이 안 된다.
   ⚠️ 첫 프레임과의 차이만 본다 — 아주 느린 클립도 어딘가 한 프레임은 달라지므로 충분하다. */
function _clipHasMotion(clip){
  try{
    if(!clip || !clip.tracks || !clip.tracks.length) return false;
    for(const t of clip.tracks){
      const v = t.values; if(!v || v.length < 2) continue;
      const n = (typeof t.getValueSize === 'function') ? t.getValueSize() : 1;
      if(!n) continue;
      for(let i = n; i < v.length; i++){
        if(Math.abs(v[i] - v[i % n]) > 1e-4) return true;
      }
    }
    return false;
  }catch(_){ return true; }   // 못 판단하면 '움직인다'로 둔다 — 멀쩡한 클립을 건너뛰는 쪽이 더 나쁘다
}
/* 🎬 어떤 클립을 틀지 고른다.
   ★ 우선순위에 '실제로 움직이는가'가 이름보다 앞선다. 이름이 idle 인 정지 포즈를 골라 두면
     그 GLB 는 영영 안 움직이는데, 정작 움직이는 클립이 같은 파일 안에 들어 있다.
   ⚠️ 이름 매칭은 정확히 'idle' 인 것을 먼저 본다. 예전엔 /idle/ 포함으로만 찾아서
     'dou_idle' 같은 이름이 배열에서 앞에 있으면 정작 'idle' 을 제치고 뽑혔다(실제 사례). */
function _pickPartClip(animations){
  if(!animations || !animations.length) return null;
  const exact   = c => /^idle$/i.test(c.name || '');
  const partial = c => /idle/i.test(c.name || '');
  const moving  = animations.filter(_clipHasMotion);
  return moving.find(exact) || moving.find(partial) || moving[0]
      || animations.find(exact) || animations.find(partial) || animations[0];
}
const _partAnimNoticed = new Set();
/* 🔇 토스트 알림은 끈다(요청사항).
   [경위] 관리자 화면에서 파츠를 장착할 때마다 "클립이 0개예요" 같은 안내가 토스트로 떴다.
     진단으로는 유용했지만, 애니메이션이 없는 파츠가 정상인 경우가 훨씬 많아서 실제로는
     장착할 때마다 화면을 덮는 잡음이 됐다.
   ★ console.log 진단은 그대로 남는다 — 호출부에서 이 함수와 짝으로 항상 찍고 있으므로,
     "이 파츠가 왜 안 움직이지"를 볼 때는 개발자 콘솔에서 [파츠 애니] 로 검색하면 된다.
   되살리려면 아래 return 한 줄만 지우면 된다. */
function _partAnimNotice(rec, msg){
  return;
  /* eslint-disable no-unreachable */
  try{
    if(!isAdmin()) return;
    const key = (rec && rec.id) || '';
    if(_partAnimNoticed.has(key)) return;
    _partAnimNoticed.add(key);
    toast('[' + ((rec && rec.name) || '파츠') + '] ' + msg);
  }catch(_){}
}

/* 🐰 파츠 자체 클립에서 '남이 맡은 본' 트랙을 걷어낸다 ────────────────────────
   [증상] 귀 파츠 하나가 까닥임과 별개로 혼자 뒤로 갔다 앞으로 오며 회전한다(rabbit 제보).
   [원인] 그 GLB 는 원본 캐릭터의 아마추어를 통째로 안고 나왔다(spine·head·hand_L/R·leg_L/R·ear_L/R).
     안에 든 클립 넷 중 셋(dou_idle·flower_idle·flowerAction)이 **키가 2개뿐인 정지 포즈**라,
     _pickPartClip 이 '실제로 움직이는' 유일한 클립인 ArmatureAction — 원본 캐릭터의 몸통 동작
     (head 회전 0.23rad + 손 흔들기) — 을 골랐다. 귀 밑동 웨이트가 head 에 39% 걸려 있어서
     그 head 회전이 귀 전체를 앞뒤로 흔들었다. 이름 판정과는 무관한 별개 원인이다.
   [원칙] 리지드 파츠에서 **까닥임이 맡은 귀 본과 그 조상**은 파츠 클립의 소관이 아니다.
     조상(head·spine)이 하는 일은 이미 캐릭터의 진짜 본이 하고 있고(파츠는 거기 매달려 있다),
     귀 본은 까닥임이 쓴다. 클립이 같은 본을 겹쳐 쓰면 파츠가 캐릭터와 따로 논다.
   ★ 나머지 트랙은 그대로 둔다 — 클립을 통째로 끄면 진짜 애니메이션 귀 파츠까지 같이 죽는다.
   ⚠️ GLTFLoader 는 트랙 이름에 노드 이름을 **정제해서** 넣는다('ear.L' → 'earL').
     그래서 원본 이름과 정제 이름을 둘 다 넣고 비교한다. */
function _sanitizeNodeName(s){
  try{ if(THREE.PropertyBinding && THREE.PropertyBinding.sanitizeNodeName)
         return THREE.PropertyBinding.sanitizeNodeName(String(s)); }catch(_){}
  return String(s).replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'');
}
function _stripPartClipOwnedTracks(clip, obj, earObjs){
  if(!clip || !clip.tracks || !earObjs || !earObjs.length) return clip;
  const owned = new Set();
  earObjs.forEach(e=>{
    for(let n=e; n; n=n.parent){
      if(n.name){ owned.add(n.name); owned.add(_sanitizeNodeName(n.name)); }
      if(n===obj) break;
    }
  });
  const keep = clip.tracks.filter(t=>{
    let nm = '';
    try{ nm = (THREE.PropertyBinding.parseTrackName(t.name)||{}).nodeName || ''; }
    catch(_){ nm = String(t.name||'').split('.')[0]; }
    return !owned.has(nm);
  });
  const cut = clip.tracks.length - keep.length;
  if(!cut) return clip;
  const out = clip.clone(); out.tracks = keep; out._twStrippedTracks = cut;
  console.log('[파츠 애니] 클립 "'+clip.name+'" — 까닥임·부착이 맡은 본의 트랙 '+cut+'개 제외'
    + ' (제외 대상: '+Array.from(owned).join(', ')+'). 이 본들은 캐릭터와 귀 까닥임이 담당합니다.');
  return out;
}
function _setupPartIdleAnim(wrapper, obj, idleClip, rec, holder){
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(idleClip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  wrapper.userData.itemMixer = mixer;
  wrapper.userData.idleAction = action;
  if(rec && rec.animMode === 'active'){
    wrapper.userData.animHolder = holder;
    action.play(); action.paused = true;      // 판정은 updateActivePartPlayback이 매 프레임 담당
    _activePartWraps.add(wrapper);
  } else {
    action.play();
    activeItemMixers.add(mixer);              // 기존 동작 — 계속 반복재생
  }
}
function _teardownPartIdleAnim(wrapper){
  if(!wrapper || !wrapper.userData) return;
  if(wrapper.userData.itemMixer) activeItemMixers.delete(wrapper.userData.itemMixer);
  _activePartWraps.delete(wrapper);
}
function updateActivePartPlayback(){
  if(!_activePartWraps.size) return;
  const now = performance.now();
  _activePartWraps.forEach(wrp=>{
    const ud = wrp.userData || {};
    const a = ud.idleAction, m = ud.itemMixer, holder = ud.animHolder;
    if(!a || !m || !holder){ _activePartWraps.delete(wrp); return; }
    // 꾸미기 미리보기 캐릭터는 좌석이 아니라 상태 개념이 없다 — 확인용으로 계속 재생.
    const isPreview = !seats().includes(holder);
    const shouldPlay = isPreview || (seatState(holder, now) === 'focus');
    if(shouldPlay){
      if(a.paused) a.paused = false;
      if(!a.isRunning()) a.play();
      activeItemMixers.add(m);
    } else if(!a.paused){
      a.paused = true;                 // 그 자리에 정지 — 되감지 않음
      activeItemMixers.delete(m);
    }
  });
}
function updateIdleItemPlayback(){
  if(!_idleItemPivots.size) return;
  const now = performance.now();
  _idleItemPivots.forEach(pivot=>{
    const a = pivot.userData && pivot.userData.idleAction;
    const m = pivot.userData && pivot.userData.itemMixer;
    const holder = pivot.userData && pivot.userData.holder;
    if(!a || !m || !holder) return;
    const state = seatState(holder, now);
    const shouldPlay = (state === 'focus');
    const isPlaying = a.isRunning();
    if(shouldPlay && !isPlaying){
      a.reset(); a.play();
      activeItemMixers.add(m);
    } else if(!shouldPlay && isPlaying){
      a.stop();
      activeItemMixers.delete(m);
    }
    // 🔥 빡일중(grind) 상태일 땐 이 아이템의 재생 속도를 2배로 (요청사항 — 유저가 몰입 중일 때 아이템도 활발히)
    //   본인 좌석은 userStatus, 친구 좌석은 remoteUserStatus를 참조 (seatState와 동일 규칙)
    if(shouldPlay){
      const us = holder.isMe ? userStatus() : (holder.remote ? holder.remoteUserStatus : null);
      a.timeScale = (us === 'grind') ? 2.0 : 1.0;
    }
  });
}
// ★ 좌석의 활성 책상 아이템 중 handTrackers(hand_L/hand_R 마커)가 있는 것들을, 그 좌석 캐릭터의
//   실제 손 본 위치에 맞춰 매 프레임 갱신 — frame() 루프에서 좌석별 포즈 갱신 뒤에 호출됨.
const _handWorldTmp = new THREE.Vector3();
function updateItemHandTrackers(seat){
  if(!seat.deskItems) return;
  for(const id in seat.deskItems){
    const pivot=seat.deskItems[id]; if(!pivot || !pivot.userData.handTrackers) continue;
    const tr=pivot.userData.handTrackers;
    ['L','R'].forEach(side=>{
      const node=tr[side]; const bone=seat.bones && seat.bones['hand'+side];
      if(!node || !bone) return;
      bone.updateWorldMatrix(true,false);   // 이번 프레임 포즈(타이핑 등)가 반영된 최신 위치를 확실히 가져오기 위함
      bone.getWorldPosition(_handWorldTmp);
      if(node.parent) node.parent.worldToLocal(_handWorldTmp);
      node.position.copy(_handWorldTmp);
    });
  }
}

// 아이템 pivot을 클릭했을 때 idle 애니메이션을 한 번 재생 (끝나면 마지막 프레임에서 정지)
function playItemIdle(pivot){
  const a=pivot && pivot.userData && pivot.userData.idleAction; if(!a) return false;
  a.reset(); a.play();
  activeItemMixers.add(pivot.userData.itemMixer);
  return true;
}

return {
  activeItemMixers,
  _idleItemPivots,
  _clipHasMotion,
  _pickPartClip,
  _partAnimNotice,
  _stripPartClipOwnedTracks,
  _setupPartIdleAnim,
  _teardownPartIdleAnim,
  updateActivePartPlayback,
  updateIdleItemPlayback,
  updateItemHandTrackers,
  playItemIdle,
};
}

const api = { createPartAnim };
if(typeof window !== 'undefined') window.TwPartAnim = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
