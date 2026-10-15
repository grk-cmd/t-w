/* room-sync.js — 📦 방으로 보내는 def(직렬화 · 얼굴 URL · 델타 전송 · Firebase provider) · 🛰 poke 신선도 · 🚪 자리비움 자동 퇴장 · 🛰 서버 모듈 감시견
   app.js 네 구역(«📦 방으로 보내는 def» · «🛰 poke 신선도» · «🚪 자리비움 자동 퇴장» · «🛰 서버 모듈 감시견») 본문을 그대로 옮긴 모듈이다(앱 FSD 35번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. poke 구역에 섞여 있던 날리기(canFly · startFlight)는 도메인이 달라 app.js 에 남겼다. 방 통신 두 통로 정리(-net 전략)는 컨벤션 단계에서 한다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 4개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 5줄 —
     DESK_LICENSE_HOLD · ITEM_LICENSE_HOLD · Presence · roomEntryMod · savedDesks 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: AUTO_EXIT_AFTER_AWAY_MS · AUTO_EXIT_WARN_MS · POKE_SKEW_MS · _autoExitCancel · _autoExitWarn · _defSizeNames · _loadImgCors · _pokeFresh · _quickHash · _roomFaceCacheLoad · _roomFaceCacheSave · _srvNow · _storageFaceUrlOne · defWireForSize · deserializeDefFromNetwork · ensureRoomFaceUrls · makeFirebaseProvider · serializeDefForNetwork — app.js 는 roomSyncMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRoomSync — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-room-sync.js */
(function(){

function createRoomSync(deps){
const DESK_LICENSE_HOLD = deps.DESK_LICENSE_HOLD;   // 읽는 함수
const ITEM_LICENSE_HOLD = deps.ITEM_LICENSE_HOLD;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const _chatIsHost = deps._chatIsHost;
const _chatIsSecretRoom = deps._chatIsSecretRoom;
const getMyUserId = deps.getMyUserId;
const loadImg = deps.loadImg;
const newCanvas = deps.newCanvas;
const roomEntryMod = deps.roomEntryMod;   // 읽는 함수
const savedDesks = deps.savedDesks;   // 읽는 함수
const toast = deps.toast;
const POKE_FRESH_MS = 30000;   // 이보다 오래된 알림은 재생하지 않는다
const POKE_SKEW_MS  = 60000;   // 기기 시계가 서버보다 앞설 때의 여유(음수 나이 허용폭)
/* 서버 시계 — 가챠 ts 와 같은 곳을 본다(firebaseAPI.serverNow). 없으면 기기 시계로 물러난다. */
function _srvNow(){
  try{ if(window.firebaseAPI && typeof firebaseAPI.serverNow === 'function') return firebaseAPI.serverNow(); }catch(_){}
  return Date.now();
}
function _pokeFresh(ts){
  if(!ts) return true;                       // 옛 클라이언트가 ts 없이 보낸 값 — 예전처럼 그냥 받는다
  const age = _srvNow() - ts;
  return age <= POKE_FRESH_MS && age >= -POKE_SKEW_MS;
}



const AUTO_EXIT_AFTER_AWAY_MS = 6 * 60 * 60 * 1000;   // 자동 자리비움 진입 후 이만큼 지나면 퇴장
const AUTO_EXIT_WARN_MS       = 60 * 1000;            // 퇴장 몇 ms 전에 알릴 것인가
let _autoExitOv = null, _autoExitTimer = null, _autoExitDue = 0, _autoExitDone = false;

function _autoExitInRoom(){
  try{ return !!(typeof Presence() !== 'undefined' && Presence().active && Presence().active()); }
  catch(_){ return false; }
}
/* 유일한 예외 — 시크릿룸 방장. 두 판정 모두 채팅 쪽이 이미 쓰는 함수를 그대로 쓴다(근거를 둘로 만들지 않는다). */
function _autoExitExempt(){
  try{ return _chatIsSecretRoom() && _chatIsHost(); }
  catch(_){ return false; }
}
/* 창을 닫고 시계를 멈춘다. **몇 번 불러도 안전해야 한다** —
   [취소] 핸들러가 setUserStatus 를 부르고, 그것이 Presence 의 _clearAutoAwayMarks 를 거쳐
   다시 이 함수로 돌아오기 때문이다(재진입). */
function _autoExitCancel(){
  if(_autoExitTimer){ clearInterval(_autoExitTimer); _autoExitTimer = null; }
  if(_autoExitOv){ try{ _autoExitOv.remove(); }catch(_){} _autoExitOv = null; }
  _autoExitDue = 0; _autoExitDone = false;
}
/* ⏰ 시간이 다 됐다 — 방에서 나가고, 같은 창을 결과 안내로 바꾼다. */
function _autoExitDo(){
  if(_autoExitTimer){ clearInterval(_autoExitTimer); _autoExitTimer = null; }
  _autoExitDone = true; _autoExitDue = 0;
  const body = document.getElementById('autoExitBody');
  const btn  = document.getElementById('autoExitBtn');
  if(body) body.textContent = '자리비움이 길어 방에서 나왔어요.';
  if(btn)  btn.textContent  = '확인';
  try{ Promise.resolve(roomEntryMod().doLeaveRoom()).catch(err => console.warn('[자동퇴장] 방 나가기 실패', err)); }
  catch(err){ console.warn('[자동퇴장] 방 나가기 실패', err); }
  /* 🕒 시계를 다시 감는다. 안 감으면 이 상태(여전히 자리비움) 그대로 다른 방에 들어가는 순간
     «이미 6시간 지났다»로 읽혀서 들어가자마자 또 팝업이 뜬다. */
  try{ if(typeof window._autoAwayResetClock === 'function') window._autoAwayResetClock(); }catch(_){}
  console.log('[자동퇴장] 자리비움 ' + (AUTO_EXIT_AFTER_AWAY_MS / 3600000) + '시간 — 방에서 나왔습니다');
}
/* 🔔 퇴장 1분 전 안내. 이미 떠 있거나, 방 밖이거나, 시크릿룸 방장이면 아무 일도 안 한다. */
function _autoExitWarn(){
  if(_autoExitOv) return;
  if(!_autoExitInRoom() || _autoExitExempt()) return;
  _autoExitDue = Date.now() + AUTO_EXIT_WARN_MS;
  _autoExitDone = false;

  const ov = document.createElement('div');
  ov.className = 'app-popup-ov';   // ⚠️ 마우스 통과 화이트리스트 매칭용 — 빼지 말 것(위 주석)
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.45);'
    + 'display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'width:300px;background:var(--win-face);border:2px solid;'
    + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    + 'border-radius:var(--win-radius-el);box-shadow:4px 4px 0 rgba(0,0,0,.35);';
  box.innerHTML =
    '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;'
  +     'padding:5px 8px;font-size:12px;font-weight:bold;">🚪 자동 퇴장</div>'
  + '<div id="autoExitBody" style="padding:16px 14px;color:var(--ink);font-size:12px;line-height:1.7;">'
  +   '오랫동안 자리를 비웠어요.<br><b id="autoExitCd">01분 00초</b> 후에 자동 퇴장됩니다.'
  + '</div>'
  + '<div style="display:flex;padding:0 14px 14px;justify-content:flex-end;">'
  +   '<button id="autoExitBtn" class="lc-btn" style="min-width:70px;">취소</button>'
  + '</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  _autoExitOv = ov;

  const btn = box.querySelector('#autoExitBtn');
  if(btn) btn.onclick = ()=>{
    if(_autoExitDone){ _autoExitCancel(); return; }   // 이미 나온 뒤 = [확인], 창만 닫는다
    _autoExitCancel();
    /* 🔵 버튼을 눌렀다 = 사람이 돌아왔다 → 온라인으로 되돌린다(요청).
       ★ 반드시 **전역** setUserStatus 다. Presence 내부에도 같은 이름이 있어서(스코프 가림)
         그쪽을 부르면 Presence 상태만 바뀌고 상태칩·캐릭터 모션은 자리비움 그대로 남는다
         (_autoAwayCheck 의 setStatus 주석과 같은 함정). */
    try{ if(typeof window.setUserStatus === 'function') window.setUserStatus(null); }catch(err){ console.warn('[자동퇴장] 상태 복원 실패', err); }
  };

  /* 250ms — 글자는 초 단위로만 바뀌지만, 1000ms 로 재면 표시가 한 박자씩 밀려 보인다. */
  _autoExitTimer = setInterval(()=>{
    // 그 사이에 사람이 직접 방을 나갔거나 방이 해산됐다 — 더 셀 이유가 없다
    if(!_autoExitInRoom()){ _autoExitCancel(); return; }
    const left = Math.max(0, Math.ceil((_autoExitDue - Date.now()) / 1000));
    const cd = document.getElementById('autoExitCd');
    if(cd) cd.textContent = String(Math.floor(left / 60)).padStart(2, '0') + '분 '
                          + String(left % 60).padStart(2, '0') + '초';
    if(left <= 0) _autoExitDo();
  }, 250);
}

/* Firebase Realtime Database 연동 — 실제 함수는 HTML의 <script type="module">이 window.firebaseAPI로 노출.
   Presence가 기대하는 join/update/leave 인터페이스로 감싸기만 함. */
// ★ Canvas 객체는 Firebase(JSON 기반)로 그대로 못 보냄 — 보낼 때 dataURL 문자열로 바꾸고,
//   받을 때 다시 Canvas로 복원해야 함. 그동안 가짜(mock) 친구는 내 Canvas를 그대로 재사용해서
//   이 변환이 없어도 문제없이 보였는데, 실제 Firebase 왕복에서는 반드시 필요함.
/* 🏊 방 payload 다이어트 (가) — 얼굴/눈감기 PNG를 Storage URL로.
   · ensureRoomFaceUrls: 입장/캐릭터 변경 시 내 얼굴 PNG를 Storage에 올리고 URL을 def에 실어둠.
     같은 그림이면(해시 일치) 재업로드하지 않음 — localStorage에 마지막 업로드 해시·URL 기억.
   · ROOM_FACE_SEND_DATAURL: 혼재 기간 안전 스위치.
     true(현재) = dataURL과 URL을 함께 전송 — 구버전 사용자도 내 얼굴을 정상적으로 봄.
     false(다음 릴리즈, 수영장) = URL만 전송 — 이때부터 다운로드 절감이 실제로 발생.
     구버전이 충분히 사라진 뒤 false로 바꾸면 됨. */
const ROOM_FACE_SEND_DATAURL = false;   // ★ true→false (0.7.0). 얼굴 PNG를 방 데이터에 싣지 않고
                                       //   Storage URL만 보낸다. 이게 서버 다운로드의 99%였다.
                                       //   되돌리려면 이 값만 true로 바꾸면 즉시 원상복구된다.
/* 🔑 내용 해시 — 이 값이 **곧 파일 이름**이다(`roomface_{key}_{h}.png` · `pic_{h}` · GLB `{key}_{h}`).
   [2026-09-18 · 제보 3-7 (나)] 예전 구현은 7글자마다 한 번씩만 봤다 — `for(i=0; i<len; i+=7)`.
     얼굴 dataURL 은 수십만 자인데 **1/7 만 보고 나머지 6/7 은 해시에 안 들어갔다.** 내용이 달라도
     표본이 같으면 같은 이름이 나오고, 이름이 곧 파일이라 **다른 캐릭터의 그림이 같은 파일에
     덮어써진다.** 캐시(`st[ck]`)도 같은 키라 재업로드가 안 일어나 그 덮어씀은 **영구적**이다
     (동물 머리에 엉뚱한 텍스처가 발린 그 증상). 파츠 그림·GLB 도 같은 함수를 탄다.
   ⇒ **전수로 본다.** 누산기 둘(djb2 · FNV-1a)을 같이 돌려 64비트 + 길이.
     FNV 의 곱셈은 32비트를 넘겨 배정밀도에서 하위 비트가 날아가므로 시프트 덧셈으로 푼다.
   ⚠️ 접두어 `h2` 는 **옛 이름과 절대 안 겹치게** 하려고 붙였다 — 겹치면 새 이름이 옛 충돌 파일을
     그대로 물려받아 고친 것이 없어진다. 값이 바뀌므로 **모두가 그림마다 한 번씩 다시 올린다**
     (Class A 1회, `_roomFaceCacheLoad` 주석이 겪은 그 요금). 그 비용을 **두 번** 치르지 않게
     `_roomFaceCacheLoad` 가 전환기에 캐시를 통째로 비우지 않는다 — 그 짝을 깨지 말 것.
   ⚠️ **구분 기호를 쓰지 않는다.** `uploadRoomFace` 가 파일 이름에서 `[^a-zA-Z0-9_-]` 를 전부 지운다
     (firebase-init.js) — 옛 `{해시}.{길이}` 는 점이 지워진 채 올라가서(`roomface_face_2irv4n63142.png`)
     `ab.1234` 와 `ab1.234` 가 **같은 파일 이름**이 되는 길이 열려 있었다. 그래서 두 누산기를
     36진수 7자리로 **고정폭**으로 적는다 — 경계가 자리로 정해지므로 지울 것이 없고,
     정제기를 통과해도 값이 한 글자도 안 변한다(파일 이름이 곧 해시다).
   ⚠️ 옛 이름으로 올라간 파일은 Storage 에 그대로 남는다(참조만 끊긴다). 지우는 것은 별건이다 —
     아직 옛 URL 을 들고 있는 남의 기기·서버 슬롯이 있다.
   ★ 전수라 GLB(수 MB base64)에서도 돈다. 업로드 직전 한 번뿐이라 체감되지 않는다. */
function _quickHash(str){
  let a = 5381, b = 2166136261;
  for(let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i);
    a = ((a << 5) + a + c) >>> 0;                                             // djb2
    b = (b ^ c) >>> 0;
    b = (b + ((b << 1) + (b << 4) + (b << 7) + (b << 8) + (b << 24))) >>> 0;  // FNV-1a 의 ×16777619
  }
  const w = n => n.toString(36).padStart(7, '0');                             // 32비트 = 36진수 7자리 이내
  return 'h2' + w(a) + w(b) + str.length.toString(36);
}
/* 🗂️ 얼굴 업로드 캐시 "{key}:{해시} → URL" — localStorage tw.roomFaceUrls.
   [2026-09-16] ensureRoomFaceUrls 안에 있던 것을 그대로 밖으로 뺐다. 슬롯 동기화(_slotToServerObj)가
     **같은 캐시·같은 파일명 규칙**을 쓰기 위해서다 — 방에 한 번이라도 들어간 캐릭터는 얼굴이 이미
     roomface_{key}_{hash}.png 로 올라가 있으므로, 슬롯을 올릴 때 그 그림은 한 장도 다시 안 올라간다.
     캐시를 두 벌로 갈랐다면 같은 그림이 두 번 올라갔을 것이다(Class A 요금). 동작은 한 글자도 안 바뀌었다. */
function _roomFaceCacheLoad(){
  let st = {}; try{ st = JSON.parse(localStorage.getItem('tw.roomFaceUrls')||'{}'); }catch(_){}
  if(!st || typeof st !== 'object') st = {};
  /* 🗂️ 캐시 형태를 "{key}:{해시} → URL" 로 바꾼다.
     [경위] 예전엔 key 하나당 해시 하나만 기억했다(st.faceHash / st.faceUrl).
       캐릭터 슬롯이 둘 이상인 사람이 캐릭터를 바꾸면 해시가 어긋나 재업로드되고, 도로 바꾸면
       또 재업로드됐다 — 슬롯을 오갈 때마다 무한히 PUT 이 나갔다(Cloud Storage Class A 폭증의 정체).
       파일명이 이미 내용 해시라(roomface_{key}_{hash}.png) 같은 그림은 같은 파일인데도 매번 올린 셈이다.
     ⚠️ 옛 형태를 여기서 한 번 이관한다 — 안 하면 업데이트 직후 모두가 한 번씩 재업로드한다. */
  ['face','blink','aBody','aEarL','aEarR','aBlink'].forEach(k=>{
    if(st[k+'Hash'] && st[k+'Url']){ st[k+':'+st[k+'Hash']] = st[k+'Url']; }
    delete st[k+'Hash']; delete st[k+'Url'];
  });
  // 무한정 쌓이지 않게 상한 — 넘으면 다음 장착 때 한 번만 다시 올린다.
  /* ⚠️ [2026-09-18 · 제보 3-7 (나)] 넘었다고 **통째로** 비우면 안 된다. 해시가 바뀐 전환기에는
     한 그림이 옛 이름·새 이름 두 칸을 차지해 상한에 금방 닿는데, 거기서 통째로 비우면 방금 올린
     새 파일까지 잊고 **전원이 또 재업로드한다** — Class A 를 두 번 치르는 길이다.
     그래서 구형(`h2` 로 시작하지 않는) 항목을 **먼저** 버리고, 그러고도 넘칠 때만 통째로 비운다.
     ★ 구형 항목을 조회에 **쓰지는 않는다**(_storageFaceUrlOne 은 새 키 하나만 본다) — 옛 해시가
       같다는 것은 「그림이 같다」는 뜻이 아니어서, 그걸 믿고 URL 을 물려주면 이 제보가 그대로
       재현된다. 여기서 남기는 것은 순전히 «전환기에 통째 비움을 늦추기» 위해서다. */
  if(Object.keys(st).length > 60){
    for(const k of Object.keys(st)){
      const h = k.slice(k.indexOf(':') + 1);
      if(!/^h2/.test(h)) delete st[k];
    }
    if(Object.keys(st).length > 60) st = {};
  }
  return st;
}
function _roomFaceCacheSave(st){ try{ localStorage.setItem('tw.roomFaceUrls', JSON.stringify(st)); }catch(_){} }
/* 그림 한 장 → Storage URL. 캐시(st)에 있으면 업로드 없이 그 URL. 실패·그림 아님 → null.
   ★ 파일 이름에 '그림 내용 해시'를 넣는다 — 예전엔 users/{uid}/roomface_face.png 처럼
     캐릭터 구분 없이 한 경로만 써서, 동물을 만들면 그 얼굴(투명 배경)이 인간이 쓰던 파일을
     그대로 덮어썼다. 캐시가 1년이라 한 번 덮이면 오래 남는다.
     내용이 같으면 같은 파일, 다르면 다른 파일 → 캐릭터끼리 절대 충돌하지 않고 중복 업로드도 없다. */
async function _storageFaceUrlOne(uid, st, key, cv){
  const dataUrl = (cv && typeof cv.toDataURL==='function') ? cv.toDataURL('image/png') : (typeof cv==='string' ? cv : null);
  if(!dataUrl || !dataUrl.startsWith('data:')) return null;
  const h = _quickHash(dataUrl);
  const ck = key + ':' + h;
  if(st[ck]) return st[ck];   // 이 그림은 전에 올려둔 적이 있다 — 캐릭터를 몇 번 바꿔도 다시 안 올린다
  const r = await firebaseAPI.uploadRoomFace(uid, key + '_' + h, dataUrl);
  if(r && r.ok){ st[ck] = r.url; return r.url; }
  return null;
}
async function ensureRoomFaceUrls(def){
  try{
    if(!def || !window.firebaseAPI || !firebaseAPI.uploadRoomFace) return def;
    const uid = getMyUserId(); if(!uid) return def;
    const st = _roomFaceCacheLoad();
    const one = (key, cv)=> _storageFaceUrlOne(uid, st, key, cv);
    def._faceUrl  = await one('face',  def.face);
    def._blinkUrl = await one('blink', def.blink);
    // 🐾 동물 — 몸·귀·감은눈 페인트(저장 시 dataURL 문자열)도 같은 방식으로 업로드
    if(def.animal){
      def._aBodyUrl  = await one('aBody',  def.animalBody);
      def._aEarLUrl  = await one('aEarL',  def.animalEarPaintL);
      def._aEarRUrl  = await one('aEarR',  def.animalEarPaintR);
      // 🐾 감은눈 귀 — 표정 귀와 같은 그림이면 one() 의 내용 해시가 같아 재업로드 없이 같은 URL이 온다.
      def._aEarLBUrl = await one('aEarLB', def.animalEarBlinkL);
      def._aEarRBUrl = await one('aEarRB', def.animalEarBlinkR);
      def._aBlinkUrl = await one('aBlink', def.animalBlink);
    }
    _roomFaceCacheSave(st);
  }catch(_){}
  return def;
}
function serializeDefForNetwork(def, opts){
  if(!def) return def;
  const _quiet = !!(opts && opts.quiet);   // 📦 용량 재기(defWireForSize)는 콘솔에 안 찍는다
  const out=Object.assign({}, def);
  if(def.face && typeof def.face.toDataURL==='function') out.face=def.face.toDataURL('image/png');
  if(def.blink && typeof def.blink.toDataURL==='function') out.blink=def.blink.toDataURL('image/png');
  // 🏊 Storage URL 동봉 (ensureRoomFaceUrls가 미리 준비) — 내부 필드는 전송에서 제거
  if(typeof def._faceUrl==='string')  out.faceUrl  = def._faceUrl;
  if(typeof def._blinkUrl==='string') out.blinkUrl = def._blinkUrl;
  delete out._faceUrl; delete out._blinkUrl;
  if(!ROOM_FACE_SEND_DATAURL){   // 다음 릴리즈: URL이 준비된 경우 무거운 dataURL 생략
    if(out.faceUrl)  delete out.face;
    if(out.blinkUrl) delete out.blink;
  }
  // 🐾 동물 — 페인트는 처음부터 URL만 전송(dataURL 4장은 무거움).
  //   구버전 클라이언트는 animal 필드를 몰라 인간으로 폴백하므로 dataURL을 함께 보낼 이유가 없음 — 즉시 비용 절감.
  //   수신 측 buildAnimalBase가 animalBodyUrl 등도 그대로 텍스처로 로드함(CORS 처리됨).
  if(def.animal){
    if(typeof def._aBodyUrl==='string'){  out.animalBodyUrl=def._aBodyUrl;   delete out.animalBody; }
    if(typeof def._aEarLUrl==='string'){  out.animalEarPaintLUrl=def._aEarLUrl; delete out.animalEarPaintL; }
    if(typeof def._aEarRUrl==='string'){  out.animalEarPaintRUrl=def._aEarRUrl; delete out.animalEarPaintR; }
    if(typeof def._aEarLBUrl==='string'){ out.animalEarBlinkLUrl=def._aEarLBUrl; delete out.animalEarBlinkL; }
    if(typeof def._aEarRBUrl==='string'){ out.animalEarBlinkRUrl=def._aEarRBUrl; delete out.animalEarBlinkR; }
    if(typeof def._aBlinkUrl==='string'){ out.animalBlinkUrl=def._aBlinkUrl; delete out.animalBlink; }
    // 표정/감은눈(face/blink)은 동물에선 animalBody와 같은 그림 — URL이 있으면 dataURL 중복 전송 제거.
    //   폴백(동물 모듈 없는 옛 클라이언트)은 faceUrl로 인간 얼굴을 복원해 렌더하므로 안전.
    if(out.faceUrl)  delete out.face;
    if(out.blinkUrl) delete out.blink;
  }
  delete out._aBodyUrl; delete out._aEarLUrl; delete out._aEarRUrl; delete out._aBlinkUrl;
  delete out._aEarLBUrl; delete out._aEarRBUrl;
  /* 💰 로컬 전용 필드 제거 — 방 payload는 "친구 화면을 그리는 데 필요한 것"만 담는다.
     여기 있는 두 필드는 받는 쪽(applyCharToSeat / defToBase / buildAnimalBase)에서 단 한 번도
     읽지 않는데, 지금까지 방 노드에 통째로 실려 모든 참여자가 입장·재접속마다 내려받고 있었다.
       · thumb        — 런처 슬롯 아이콘용 3D 스냅샷. cRenderer(222×300, pixelRatio 2 → 실제 444×600)를
                        toDataURL('image/png')로 뜬 것이라 얼굴 PNG에 맞먹거나 더 크다.
                        쓰는 곳은 슬롯 아이콘(slotIconEl) 하나뿐 — 방과는 무관.
       · partXfMemory — 생성기가 "파츠 id별 마지막 조정값"을 기억하는 편집용 메모리.
                        실제 착용 정보는 equippedParts에 {id, xf}로 따로 들어가므로 렌더에 불필요.
     ★ Object.assign(def)로 통째 복사하는 구조라, 새 로컬 필드를 def에 추가하면 자동으로 방에도
       실린다. 그래서 아래 _defPayloadDiag가 큰 필드를 발견하면 콘솔에 경고를 띄운다. */
  delete out.thumb;
  delete out.partXfMemory;
  delete out._imgBroken;   // 로컬 복원 실패 표식 — 방과는 무관
  /* 🪑 [제보 2] 라이선스 전용 자산의 «접어 둔 값» — 방에는 **절대 안 나간다.**
     이 두 필드가 실려 나가면 받는 쪽이 seat.remote 라 게이트 없이 그려서 제보 2 가 그대로 재현된다.
     ⚠️ 이 두 줄과 pruneUnownedLicenseAssets 는 한 벌이다. 접기만 하고 여기를 빼면 필드 이름만
        바뀐 채 같은 값이 계속 전파된다 — sim-license-leak.js 가 이 자리를 본다. */
  delete out[DESK_LICENSE_HOLD()];
  delete out[ITEM_LICENSE_HOLD()];
  /* 🖍️ 안전망 — 파츠 그림은 **URL 만** 나간다.
     [왜 안전망까지 두는가] equippedParts 는 위의 face/blink 처럼 걸러지는 필드가 아니라
       Object.assign 으로 통째로 실려 나간다. 어떤 경로로든 xf.pic 에 dataURL(512 PNG ≈ 수십~수백 KB)이
       한 번 들어가면, def 가 갱신될 때마다 그리고 방에 들어오는 모든 사람이 그걸 통째로 내려받는다.
       업로드가 실패한 경우가 그 길이다(uploadPartPic 이 null 을 돌려줘도 화면에는 그림이 남아 있다).
     ★ 여기서는 지우기만 한다 — 내 화면의 그림은 draft 쪽 xf 에 그대로 있어서 사라지지 않고,
       다음 저장 때 업로드가 성공하면 URL 로 정상 전송된다. */
  if(out.equippedParts){
    let _picStripped = 0;
    try{
      const _eq = JSON.parse(JSON.stringify(out.equippedParts));
      const _walk = v=>{
        if(!v || typeof v !== 'object') return;
        if(Array.isArray(v)){ v.forEach(_walk); return; }
        if(typeof v.pic === 'string' && v.pic.startsWith('data:')){ delete v.pic; _picStripped++; }
        for(const k in v) _walk(v[k]);
      };
      _walk(_eq);
      if(_picStripped) out.equippedParts = _eq;
    }catch(_){}
    if(_picStripped && !_quiet) console.warn('[파츠 그림] 업로드 안 된 그림 ' + _picStripped + '장을 방 전송에서 뺐습니다 — 내 화면에는 그대로 있고, 다음 저장 때 다시 올립니다.');
  }
  /* 🐾 귀 그림도 URL 만 — 위 파츠 그림 안전망과 같은 이유(업로드 실패 때 dataURL 이 남는다) */
  ['earPicL','earPicR'].forEach(k=>{ if(typeof out[k]==='string' && out[k].startsWith('data:')) delete out[k]; });
  if(!_quiet) _defPayloadDiag(out);
  return out;
}
/* 📦 용량 재기용 직렬화(def-size.js) — 실제 전송과 같은 serializeDefForNetwork 를 탄다.
   단 그림(얼굴 · 감은눈 · 동물 페인트)은 보내기 전에 ensureRoomFaceUrls 가 Storage 에 올려 URL 만 나가므로
   URL 자리표시로 바꿔 잰다 — 캔버스를 PNG 로 굽지 않아 싸고, 재는 값도 실제로 나가는 크기와 맞는다. */
const _DEF_SIZE_URL = 'https://firebasestorage.googleapis.com/v0/b/together-working.appspot.com/o/users%2F'
  + 'x'.repeat(28) + '%2Froomface_face_h2xxxxxxxxxx.png?alt=media&token=' + 'x'.repeat(36);
const _DEF_SIZE_IMGS = [['face','_faceUrl'],['blink','_blinkUrl'],['animalBody','_aBodyUrl'],
  ['animalEarPaintL','_aEarLUrl'],['animalEarPaintR','_aEarRUrl'],['animalEarBlinkL','_aEarLBUrl'],
  ['animalEarBlinkR','_aEarRBUrl'],['animalBlink','_aBlinkUrl']];
function defWireForSize(def){
  if(!def) return null;
  const d = Object.assign({}, def);
  _DEF_SIZE_IMGS.forEach(([k, u])=>{ if(d[k]){ d[u] = (typeof def[u]==='string') ? def[u] : _DEF_SIZE_URL; d[k] = null; } });
  return serializeDefForNetwork(d, { quiet: true });
}
/* 안내에 붙일 이름 — 책상 3D 는 def 에 이름이 없어서 보관함(savedDesks)에서 찾는다. */
function _defSizeNames(def){
  const n = {};
  try{ const r = def && def.deskGlb && savedDesks().find(d=>d.glb && d.glb===def.deskGlb); if(r && r.name) n.deskGlb = r.name; }catch(_){}
  return n;
}
/* 🔬 [def-diag] 방으로 나가는 def의 필드별 바이트 — 무엇이 무거운지 추측 대신 실측한다.
   같은 지문이면 다시 찍지 않는다(입장·상태변경마다 콘솔이 도배되지 않게).
   2KB를 넘는 필드는 "이게 방 인원수만큼 곱해져 내려간다"는 뜻이라 따로 경고한다. */
const DEF_DIAG_WARN_BYTES = 2048;
let _defDiagLastSig = '';
function _defPayloadDiag(out){
  try{
    if(!out) return;
    const rows = [];
    let total = 0;
    for(const k in out){
      let n = 0;
      try{ n = JSON.stringify(out[k] == null ? null : out[k]).length; }catch(_){ n = 0; }
      total += n;
      rows.push([k, n]);
    }
    rows.sort((a,b)=>b[1]-a[1]);
    const sig = total + ':' + rows.slice(0,4).map(r=>r[0]+r[1]).join(',');
    if(sig === _defDiagLastSig) return;
    _defDiagLastSig = sig;
    const top = rows.filter(r=>r[1] >= 256).slice(0, 8)
                    .map(r=>r[0]+' '+(r[1]>=1024 ? (r[1]/1024).toFixed(1)+'KB' : r[1]+'B')).join(' · ');
    console.log('[def-diag] 방 전송 def '+(total/1024).toFixed(1)+'KB — '+(top||'(모든 필드 256B 미만)'));
    const heavy = rows.filter(r=>r[1] > DEF_DIAG_WARN_BYTES);
    if(heavy.length){
      console.warn('[def-diag] ⚠️ 2KB 초과 필드 — 이건 방 인원수만큼 곱해져 내려갑니다: '
        + heavy.map(r=>r[0]+'('+(r[1]/1024).toFixed(1)+'KB)').join(', ')
        + ' · GLB 계열(commGlb/deskGlb/customItems)이 보이면 얼굴처럼 Storage URL로 옮길 대상입니다.');
    }
  }catch(_){}
}
// 🏊 Storage의 얼굴 이미지를 CORS로 로드 — crossOrigin 없이 https 이미지를 캔버스에 그리면
//   캔버스가 오염(taint)되어 THREE 텍스처 업로드가 실패함. Storage는 CORS 허용이라 이 방식이 안전.
/* ★ loadImg 와 같은 «크기 0» 가드를 여기에도 둔다 — 빠져 있었다.
   Storage 가 튀어 0바이트/잘린 응답이 오면 onerror 없이 naturalWidth 0 으로 onload 가 뜼고,
   그걸 drawImage 하면 아무것도 안 그려진 **빈 캔버스**가 성공처럼 돌아온다.
   그러면 아래 catch 가 안 돌아 dataURL 폴백도 못 타고, 친구 얼굴이 조용히 피부색만 남는다. */
function _loadImgCors(src){ return new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous';
  i.onload=()=>{ if(!i.naturalWidth || !i.naturalHeight) rej(new Error('이미지 크기가 0')); else res(i); };
  i.onerror=rej; i.src=src; }); }
/* URL → 캔버스.
   ⚠️ [2026-09-18 · 제보 3-7 (다)] 캔버스를 **그림의 원래 크기**로 잡는다. 예전엔 `newCanvas()` 가
     늘 512(CANVAS_SZ)인데 그림은 **원래 크기 그대로 (0,0)** 에 그려졌다 — 512 보다 크면 오른쪽·아래가
     잘리고, 작으면 왼쪽 위 구석에 몰린다. 그 조각이 UV 전체에 펴 발려서 «얼굴 텍스처가 밀렸다» 가
     된다. 공유 코드로 들어온 텍스처는 256(CODE_TEX_SIZE)이라 정확히 1/4 구석에 몰렸다.
     사람 얼굴·감은눈은 512 라 멀쩡했던 것도 이것으로 갈린다. 크기를 못 읽으면 예전처럼 512. */
async function _roomFaceUrlToCanvas(url){
  const img = await _loadImgCors(url);
  const w = img.naturalWidth || img.width || 0, h = img.naturalHeight || img.height || 0;
  const c = newCanvas();
  if(w > 0 && h > 0){ c.width = w; c.height = h; }
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}
async function deserializeDefFromNetwork(def){
  if(!def) return def;
  const out=Object.assign({}, def);
  try{
    // 🏊 URL이 있으면 그걸 우선 사용(캐시가 걸려 있어 두 번째부터는 다운로드가 없음) — 실패 시 dataURL 폴백
    /* ⚠️ ROOM_FACE_SEND_DATAURL=false 부터 보내는 쪽이 face dataURL 을 지우고 URL 만 싣는다.
       그래서 여기서 URL 로드가 실패하면 out.face 가 **아예 없는 상태**가 되고, compositeFace 는
       피부만 칠한다 = 상대 얼굴이 통째로 사라져 보인다. 실패를 조용히 삼키지 않고, dataURL 이
       함께 왔으면 그걸로 되돌리고, 그것도 없으면 최소한 콘솔에 남긴다. */
    if(typeof def.faceUrl==='string'){
      try{ out.face = await _roomFaceUrlToCanvas(def.faceUrl); }
      catch(e){ if(typeof def.face!=='string') console.warn('[방] 얼굴 이미지 로드 실패 — 피부색만 보입니다', def.faceUrl, e); }
    }
    if(typeof def.blinkUrl==='string'){
      try{ out.blink = await _roomFaceUrlToCanvas(def.blinkUrl); }
      catch(e){ if(typeof def.blink!=='string') console.warn('[방] 감은눈 이미지 로드 실패', def.blinkUrl, e); }
    }
    if(typeof out.face==='string'){ const img=await loadImg(out.face); const c=newCanvas(); c.getContext('2d').drawImage(img,0,0); out.face=c; }
    if(typeof out.blink==='string'){ const img=await loadImg(out.blink); const c=newCanvas(); c.getContext('2d').drawImage(img,0,0); out.blink=c; }
  }catch(e){ /* 이미지 복원 실패 시 원본 문자열 그대로 둠 — compositeFace에서 또 실패하겠지만 앱 전체가 죽진 않게 위쪽에서 방어 */ }
  return out;
}
/* 💰 방 업데이트 델타 전송.
   [왜] RTDB 프로파일러 실측: 한 멤버가 1바이트를 쓰면 방에 있는 나머지 인원수만큼 내려간다
        (올린 739kB → 내려간 2.94MB = ×4.0). 즉 다운로드 비용은 "쓰기 바이트 × 방 인원"이다.
   [문제] setState/setUserStatus/broadcastRide 등은 전부 _basePayload()를 통째로 보낸다.
        state 하나만 바뀌어도 10개 필드가 전부 다시 날아가고, update()는 값이 같아도 그대로 쓴다.
        실측에서 순수 하트비트 멤버는 41.8B/회인데 상태 갱신이 잦은 멤버는 385B~2.47kB/회였다.
   [해결] 마지막으로 보낸 값과 대조해서 "실제로 바뀐 필드"만 보낸다. 바뀐 게 없으면 쓰기 자체를 생략.
   ★ def·chat은 항상 통과 — def는 명시적 변경 요청이고, chat은 ts가 매번 달라서 델타의 의미가 없다.
   ★ html의 재접속 재등록은 _myMemberData(updateMe가 Object.assign으로 계속 누적)를 통째로 set하므로,
     델타로 보내도 _myMemberData에는 전체 상태가 남아 있어 재등록 내용이 깨지지 않는다. */
let _lastSentRoomPayload = null;
/* 🛰 방 스냅샷 일련번호 — 늦게 끝난 낡은 스냅샷이 새 것을 덮어쓰지 못하게 하는 유일한 기준.
   방을 옮겨도 계속 올라가기만 하면 된다(비교만 하고 값 자체는 의미가 없다). */
let _roomSnapSeq = 0;
function _sameRoomVal(a, b){
  if(a === b) return true;
  if(a == null && b == null) return true;   // null/undefined는 같은 것으로 취급(둘 다 "값 없음")
  if(a == null || b == null) return false;
  if(typeof a === 'object' || typeof b === 'object'){
    try{ return JSON.stringify(a) === JSON.stringify(b); }catch(_){ return false; }
  }
  return false;
}
function _diffRoomPayload(payload){
  if(!payload) return payload;
  if(!_lastSentRoomPayload){                 // 입장 후 첫 갱신 — 기준값이 없으니 전체를 보내고 기준을 만든다
    _lastSentRoomPayload = {};
    for(const k in payload){ if(k!=='def' && k!=='chat') _lastSentRoomPayload[k]=payload[k]; }
    return payload;
  }
  const out = {}; let changed = 0;
  for(const k in payload){
    if(k === 'def' || k === 'chat'){ out[k] = payload[k]; changed++; continue; }
    if(_sameRoomVal(_lastSentRoomPayload[k], payload[k])) continue;
    out[k] = payload[k]; _lastSentRoomPayload[k] = payload[k]; changed++;
  }
  return changed ? out : null;               // null = 보낼 게 없음
}
function makeFirebaseProvider(hooks){
  return {
    join(room, me, changeCb, onPoked){
      const payload=Object.assign({}, me, { def: serializeDefForNetwork(me.def) });
      _lastSentRoomPayload = null;   // 새 방 = 새 기준. 첫 update가 전체를 보내며 다시 잡는다.
      window.firebaseAPI.joinRoom(room, payload, async (friends)=>{
        friends=friends||{};
        /* 🛰 **스냅샷 순서 보장** — 이 콜백은 async 라서 여러 스냅샷이 겹쳐 돌 수 있고,
             안에서 def 를 await 로 푸는 동안 나중 스냅샷이 먼저 끝나 버릴 수 있다.
           [무엇이 터졌나] 그러면 **낡은 스냅샷이 새 것을 덮어쓴다.** poke 는 사람마다 한 칸뿐이고
             값이 지워지지 않으므로, 낡은 스냅샷에는 아까 던진 `fly:` 가 그대로 들어 있다.
             수신부는 "ts 가 직전과 다르면 새 이벤트"로 보니, 새 poke(dance) 를 먼저 본 뒤 낡은
             fly 가 도착하면 **다시 날린다.** 제보의 "폭탄으로 날린 적 있는 사람만 /80 에 날아간다"가
             정확히 이것이다 — 그 사람들의 칸에만 fly 가 남아 있으니까.
             /80 은 방 인원 수만큼 poke 를 연달아 쓰므로 스냅샷이 몰려 들어와 순서가 잘 뒤집힌다.
           ★ 스냅샷은 **방 전체의 완전한 상태**다. 낡은 것은 합치지 않고 통째로 버리는 게 맞다.
           ★ 겸사겸사 순차 await 를 Promise.all 로 바꾼다 — 인원수만큼 직렬로 기다리던 것이 한 번에 끝난다. */
        const _seq = ++_roomSnapSeq;
        const ids = Object.keys(friends);
        const defs = await Promise.all(ids.map(id=>deserializeDefFromNetwork(friends[id].def)));
        if(_seq !== _roomSnapSeq) return;          // 더 새 스냅샷이 이미 지나갔다 — 이건 버린다
        const restored={};
        ids.forEach((id,i)=>{ restored[id]=Object.assign({}, friends[id], { def: defs[i] }); });
        changeCb(restored);
      }, onPoked, hooks);
    },
    update(payload){
      // def가 같이 왔으면(크기·파츠 변경 등) 직렬화해서 보냄 — join과 마찬가지로 Canvas는 그대로 못 보냄
      if(payload && payload.def) payload=Object.assign({}, payload, { def: serializeDefForNetwork(payload.def) });
      const delta = _diffRoomPayload(payload);
      if(!delta) return;   // 바뀐 게 없음 — 쓰기 생략(방 인원수만큼의 다운로드도 함께 사라진다)
      window.firebaseAPI.updateMe(delta);
    },
    poke(targetId, type){
      if(window.firebaseAPI.poke) window.firebaseAPI.poke(targetId, type);
    },
    pokeSelf(type){
      if(window.firebaseAPI.pokeSelf) window.firebaseAPI.pokeSelf(type);
    },
    leave(){
      return window.firebaseAPI.leaveRoom();
    }
  };
}

(function _fbBootWatch(){
  const FIRST_WAIT_MS = 12000;   // 첫 판단까지 — 느린 회선의 정상 부팅을 방해하지 않을 만큼
  const RETRY_GAP_MS  = 6000;
  const MAX_RETRY     = 3;
  let tries = 0, done = false, timer = null, noticeEl = null;

  const alive = ()=> !!window.firebaseAPI;

  function hideNotice(){ if(noticeEl){ try{ noticeEl.remove(); }catch(_){} noticeEl = null; } }
  /* 안내는 **떠 있는 막대**다. 토스트로는 안 된다 — 이 상황은 몇 초 뒤에 사라지면 안 되고,
     사용자가 "지금 서버에 연결이 안 된 상태"임을 계속 알고 있어야 한다. */
  function showNotice(text, retryable){
    hideNotice();
    const el = document.createElement('div');
    el.className = 'fb-boot-notice';
    el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483600;'
      + 'background:var(--win-face);color:var(--ink);'
      + 'border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
      + 'box-shadow:2px 2px 6px rgba(0,0,0,.35);padding:8px 12px;font-size:12px;'
      + 'display:flex;align-items:center;gap:10px;max-width:92vw;';
    const msg = document.createElement('span');
    msg.textContent = text;
    el.appendChild(msg);
    const mkBtn = (label, fn)=>{
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font-size:11px;padding:2px 8px;cursor:pointer;';
      b.onclick = fn;
      el.appendChild(b);
      return b;
    };
    if(retryable) mkBtn('다시 시도', ()=>{ tries = 0; clearTimeout(timer); inject(); });
    mkBtn('닫기', hideNotice);
    document.body.appendChild(el);
    noticeEl = el;
  }

  function inject(){
    if(done || alive()) return;
    if(tries >= MAX_RETRY){
      showNotice('서버에 연결하지 못했어요 — 방·마이홈·친구 기능이 멈춘 상태예요. 네트워크 확인 후 다시 시도하거나 프로그램을 재시작해 주세요.', true);
      return;
    }
    tries++;
    showNotice('서버에 연결하는 중이에요… (' + tries + '/' + MAX_RETRY + ')', false);
    try{
      const s = document.createElement('script');
      s.type = 'module';
      // ⚠️ 쿼리로 캐시를 피한다 — 실패한 응답을 다시 읽으면 재시도가 무의미하다
      s.src = 'parts/firebase-init.js?fbretry=' + tries + '&t=' + Date.now();
      s.onerror = ()=>{ clearTimeout(timer); timer = setTimeout(inject, 1200); };
      document.head.appendChild(s);
    }catch(_){}
    clearTimeout(timer);
    timer = setTimeout(inject, RETRY_GAP_MS);
  }

  window.addEventListener('firebase-ready', ()=>{
    done = true; clearTimeout(timer); hideNotice();
    if(tries > 0) toast('🛰 서버에 다시 연결됐어요');
  });

  /* 원본 <script type="module"> 의 error 는 **확정 신호**다(시간 초과와 달리 기다릴 이유가 없다).
     🛑 [고침] 예전엔 이 리스너를 DOMContentLoaded 에서 붙였고, 그래서 **한 번도 발동한 적이 없다.**
       type="module" 은 defer 취급이라 실행·실패가 DOMContentLoaded **보다 먼저** 끝난다.
       그때 붙이면 error 이벤트는 이미 지나간 뒤라 영영 안 온다 — 확정 신호 경로가 죽어 있었고
       실제로는 항상 12초 타이머만 돌았다(복구가 그만큼 늦다).
     ★ 지금은 app.js 최상위에서 곧바로 붙인다. HTML 의 로드 순서가 근거다:
         parts/firebase-init.js (module, defer)  ← 문서상 **앞**
         parts/app.js           (classic, 파싱 중 즉시 실행)  ← 문서상 뒤
       classic 인 app.js 가 먼저 실행되는 시점에 그 태그는 이미 DOM 에 있고(앞에 있으므로),
       module 은 아직 실행 전이다. 즉 "붙일 수는 있는데 아직 안 터진" 유일한 창이 여기다.
     ⚠️ 순서가 바뀌어 못 찾는 경우를 대비해 DOMContentLoaded 에서 한 번 더 시도한다(무해한 중복).*/
  let _origBound = false;
  function bindOrigError(){
    if(_origBound) return;
    try{
      const orig = document.querySelector('script[src*="firebase-init"]');
      if(orig){ _origBound = true; orig.addEventListener('error', ()=>{ clearTimeout(timer); inject(); }); }
    }catch(_){}
  }
  bindOrigError();

  window.addEventListener('DOMContentLoaded', ()=>{
    if(alive()) { done = true; return; }
    bindOrigError();
    timer = setTimeout(inject, FIRST_WAIT_MS);
  });
})();

return {
  AUTO_EXIT_AFTER_AWAY_MS,
  AUTO_EXIT_WARN_MS,
  POKE_SKEW_MS,
  _autoExitCancel,
  _autoExitWarn,
  _defSizeNames,
  _loadImgCors,
  _pokeFresh,
  _quickHash,
  _roomFaceCacheLoad,
  _roomFaceCacheSave,
  _srvNow,
  _storageFaceUrlOne,
  defWireForSize,
  deserializeDefFromNetwork,
  ensureRoomFaceUrls,
  makeFirebaseProvider,
  serializeDefForNetwork,
};
}

const api = { createRoomSync };
if(typeof window !== 'undefined') window.TwRoomSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
