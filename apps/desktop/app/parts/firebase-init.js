/* 🔒 CSP — 이 파일은 원래 desk-companion-prototype.html 안의 인라인 <script type="module"> 였다.
   `script-src` 에서 'unsafe-inline' 을 버리기 위해 밖으로 뺐다. 내용은 한 글자도 안 바꿨고,
   바뀐 것은 firebase-config 의 상대경로 한 줄뿐이다(파일이 parts/ 안으로 들어왔으므로
   './parts/firebase-config.js' → './firebase-config.js').
   ⚠️ HTML 에서 반드시 type="module" 로 불러야 한다 — import 문이 들어 있고,
     module 은 지연 실행이라 그 덕분에 parts/app.js(classic) 뒤에 도는 기존 순서가 유지된다.
   ⚠️ (걷힘 · 개정 61) 예전에는 맨 끝에서 window.__mysNetBind(미스테리au 파티 전송선)를 불렀다. 그 게임과 함께 걷었다. */

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getDatabase, ref as _dbRef, set as _sdkSet, update as _dbUpdate, remove as _sdkRemove, onValue as _sdkOnValue, off, onDisconnect, serverTimestamp, get as _sdkGet, runTransaction,
    push as _sdkPush, query as _sdkQuery, limitToLast as _sdkLimitToLast, orderByChild as _sdkOrderByChild, orderByKey as _sdkOrderByKey,
    startAt as _sdkStartAt, endBefore, equalTo as _sdkEqualTo, onChildAdded, onChildChanged, goOffline, goOnline
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
  // Storage: 큰 base64 데이터(GLB 등)를 Realtime Database에서 빼내 스토리지에 두고 URL만 저장 (Firebase 사용량 절감)
  import {
    getStorage, ref as _stRef, uploadString, getDownloadURL, deleteObject
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
  /* 🔑 Auth — 구글 계정으로 신원을 서버가 보증하게 만든다.
     ★ 왜 필요한가 — 이 앱의 신원은 지금까지 localStorage 의 `tw.myUserId` 한 줄뿐이었다.
       서버는 그것이 누구인지 몰라서 규칙에 `auth` 조건을 걸 수 없었고(그래서 `.write:true`),
       계정 이전의 비밀번호도 `users/{uid}/transferHash` 를 **클라이언트가 읽어서** 비교했다.
       구글 로그인을 쓰면 비밀번호가 아예 없고, 신원 확인은 구글 서버에서 끝난다.
     ★ 로그인 창은 여기서 열지 않는다 — file:// + `frame-src 'none'` 이라 팝업·리다이렉트가 둘 다
       막힌다. 창은 main.js 가 열고(companion.signInWithGoogle), 여기는 그 결과로 받은
       **ID 토큰만** 받아 signInWithCredential 을 부른다.
     ⚠️ connect-src 에 `https://*.googleapis.com` 이 이미 열려 있어 CSP 는 손대지 않았다
       (identitytoolkit / securetoken 이 그 아래다). 토큰 교환은 main.js(Node)가 하므로
       렌더러 CSP 와 무관하다. script-src 도 gstatic 이 이미 있다. */
  import {
    getAuth, signInWithCredential, GoogleAuthProvider, signInWithEmailAndPassword,
    signInAnonymously, linkWithCredential, EmailAuthProvider, reauthenticateWithCredential,
    signOut as fbSignOut, setPersistence, browserLocalPersistence, onAuthStateChanged,
    getAdditionalUserInfo, deleteUser
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { firebaseConfig } from "./firebase-config.js";
  import { createGachaTx } from "./character/gacha-tx.js";
  import { ROOM_ALIVE_HB, ROOM_ALIVE_STALE_MS } from "./room/room-alive.js";   // 관리자 유령 방 청소(cleanGhostRooms)만 — 앱 관리자 창을 걷을 때 같이
  import { createInviteAccount } from "./account/invite-account.js";
  import { createInviteRevokeAll } from "./account/invite-revoke.js";
  import { createGroupInvite } from "./account/group-invite.js";
  import { createAppVersion } from "./shared/app-version.js";
  import { createAppVersionGate, createAppVersionGateDom } from "./shared/app-version-gate.js";
  import { createBugBoard } from "./support/bug-board.js";
  import { createChatHistory, createIdbChatStore } from "./chat/chat-history.js";
  import { createCatalogSync, createApiCatalogFetch } from "./character/catalog-cache.js";
  import { createBroadcastSync } from "./myhome/broadcast-cache.js";
  import { createVisitPing } from "./shared/visit-ping.js";
  import { createRealtimeLink } from "./realtime/realtime-link.js";
  import { createApiPublicReads } from "./shared/api-public-reads.js";
  import { createAccountDelete } from "./account/account-delete-net.js";
  /* 🔐 [회원가입 C2 · 개정 14] Cloud Functions — 함수 `changePassword` 의 리전. RTDB(databaseURL)와 같은 asia-southeast1.
     ★ 함수 SDK 는 **위에서 import 하지 않는다** — 부를 때 동적으로 들여온다(authChangePassword). 모듈 머리에 두면
       그 한 줄이 못 받아졌을 때(오프라인 첫 부팅 · 캐시 없음) 이 파일 전체가 안 돌고 로그인·동기화가 통째로 죽는다.
     ⚠️ 리전을 바꾸면 HTML CSP connect-src 의 함수 호스트도 같이 바꾼다. */
  const FUNCTIONS_REGION = 'asia-southeast1';
  const FUNCTIONS_SDK_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';   // 위 import 들과 같은 판
  /* 로그인 수단 읽기 — authProviders · authChangePassword 가 같이 쓴다. 세션이 없으면 null. */
  function _providersOf(cu){
    if(!cu) return null;
    const pd = cu.providerData || [];
    const g  = pd.find(p => p && p.providerId === 'google.com');
    const pw = pd.find(p => p && p.providerId === 'password');
    return { authUid:cu.uid, anonymous:!!cu.isAnonymous, google:!!g, googleEmail:(g && g.email) || null,
             password:!!pw, passwordEmail:(pw && pw.email) ? String(pw.email).toLowerCase() : null };
  }

  /* 🪪 [회원가입 설계 §3 · 개정 8] 빈 uid 경로 안전망 — uid 가 정해지기 전에 나가는 요청을 한 곳에서 막는다.
     [왜 여기인가] app.js `getMyUserId()` 는 이제 uid 를 만들어 내지 않는다 — 처음 쓰는 PC 에서는
       게이트가 uid 를 정할 때까지 null 을 돌려준다. 그런데 게이트는 부팅을 막지 않아서(26600 initInviteGate)
       그 사이 마이홈·일정·동기화 타이머가 그대로 돌고, 이들이 부르는 경로가 `users/null/…` 이 된다.
       123곳을 하나씩 막는 대신 **경로가 만들어지는 자리(ref · sref · 다중 경로 update)** 에서 잡는다.
     ★ 던지지 않는다 — `_noUid/` 아래로 돌린다. 규칙 루트가 `.read:false · .write:false` 라 읽기·쓰기가
       전부 permission_denied 로 끝나고, 그건 부르는 쪽이 이미 «오프라인·거부» 로 다루는 실패다.
       던지면 onValue 같은 동기 호출이 부팅 IIFE 를 도중에 끊어 게이트 화면까지 못 올 수 있다.
     ★ 기존 사용자에겐 아무 일도 없다 — 부팅 때부터 uid 가 있으니 이 모양의 경로가 안 생긴다.
       uid 가 정해진 PC 는 재시작해서(게이트 · _acctRelaunchAfterDetach) 처음부터 제대로 돈다.
     ⚠️ 세그먼트 'null' · 'undefined' · 빈 세그먼트('//' · 끝의 '/' 는 제외)만 본다. */
  const _NOUID_SEG = /(^|\/)(null|undefined)(\/|$)|[^:]\/\//;
  const _noUidWarned = new Set();
  function _noUidPath(p){
    if(typeof p !== 'string' || !_NOUID_SEG.test(p)) return p;
    const head = p.split('/').slice(0, 3).join('/');
    if(!_noUidWarned.has(head)){ _noUidWarned.add(head); console.warn('[uid-guard] uid 없이 만든 경로 — 서버에 닿지 않게 돌림:', p); }
    return '_noUid/' + p.replace(/\/+/g, '/').replace(/^\//, '');
  }
  const ref  = (d, p) => (p === undefined ? _dbRef(d) : _dbRef(d, _noUidPath(p)));
  const sref = (st, p) => _stRef(st, _noUidPath(p));
  /* 기본 동작(get · set · update · remove · push · onValue)은 이 이름들로만 — 요청마다 서버 점검 창(maintenance-gate.js touch)을 먼저 본다.
     옛 Firebase 길이 남은 동안의 한 벌이다(기능 묶음이 API 로 옮기며 걷는다 — 새 기능은 여기 더하지 않는다). */
  const orderByChild = _sdkOrderByChild, orderByKey = _sdkOrderByKey, limitToLast = _sdkLimitToLast, startAt = _sdkStartAt, equalTo = _sdkEqualTo, query = _sdkQuery;
  const _mt = window.TwMaintenance.store;
  const _touched = (f) => (...a) => { _mt.touch(); return f(...a); };   // 🛠 사람이 방금 누른 동작이 서버에 닿으면 점검 창
  const get = _touched(_sdkGet);
  const set = _touched(_sdkSet);
  const remove = _touched(_sdkRemove);
  const push = _touched(_sdkPush);
  const onValue = _touched(_sdkOnValue);
  const _update = _touched(_dbUpdate);
  /* 다중 경로 update(루트 ref + {경로: 값}) 는 경로가 키에 있다 — 하나라도 빈 uid 면 통째로 거절한다
     (update 는 한 덩어리라 그 한 줄만 빼고 보내면 규칙이 보던 짝이 깨진다). */
  const update = (r, v) => {
    if(v && typeof v === 'object'){
      for(const k of Object.keys(v)){
        if(_noUidPath(k) !== k) return Promise.reject(new Error('[uid-guard] uid 없는 다중 경로 update: ' + k));
      }
    }
    return _update(r, v);
  };

  /* 🛰 중복 로드 방지 — app.js 의 감시견(_fbBootWatch)이 이 파일을 다시 꽂을 수 있다.
     ★ 원본이 **느렸을 뿐**인데 재시도분이 겹치면 이 파일이 두 번 돌아, 방 리스너·서버시간
       구독·MYS_NET 바인딩이 이중으로 걸린다. 그쪽이 겹칠 위험을 감수하는 대신 여기서 막는다.
     ⚠️ 모듈은 top-level return 이 안 되므로 **던져서** 나머지를 건너뛴다. 콘솔에 남는 이 줄은
       오류가 아니라 정상 동작이다(원본이 이미 붙었다는 뜻).
     ⚠️ import 가 실패한 경우에는 여기까지 오지도 못하므로 플래그가 서지 않는다 —
       즉 "정말 실패한 판"은 재시도가 정상적으로 통과한다. 그게 이 위치의 이유다.

     🛑 [고침] 그런데 플래그 하나만 보면 **import 는 성공했고 그 뒤에서 실패한 판**이 영구히 잠긴다.
       (initializeApp 예외 · firebase-config 값 오류 · 이 아래 2600여 줄 어딘가의 throw)
       그때는 플래그만 서고 window.firebaseAPI 는 끝내 안 생기는데, 감시견이 다시 꽂아도
       이 첫 줄에서 튕겨나가 재시도가 **구조적으로 성공할 수 없다** — 막대의 [다시 시도]가
       눌러도 아무 일이 안 일어나는 버튼이 된다.
     ★ 그래서 "시작했나"가 아니라 **"끝까지 갔나"**를 본다. firebaseAPI 는 이 파일 맨 끝에서만
       붙으므로, 그게 있다 = 앞선 판이 완주했다 = 지금 판은 진짜 중복이다.
       앞선 판이 도중에 죽었으면 firebaseAPI 가 없으니 이 판이 통과해 처음부터 다시 세운다.
     ⚠️ 완주한 판이 있는데 또 도는 경우에만 막으면 되므로, 중복 구독 방지는 그대로 성립한다. */
  if(window.__fbInitStarted && window.firebaseAPI) throw new Error('[firebase-init] 이미 로드됨 — 중복 실행 건너뜀');
  window.__fbInitStarted = true;

  const fbApp = initializeApp(firebaseConfig);
  const db = getDatabase(fbApp);
  const storage = getStorage(fbApp);
  /* 🔑 auth 는 **없어도 앱이 살아야 한다.** 여기서 예외가 새면 이 파일이 통째로 죽고
     window.firebaseAPI 가 영영 안 생긴다 — 방·마이홈·친구가 전부 멎는다는 뜻이다.
     로그인은 부가 기능이고 나머지는 본체이므로, 실패하면 auth 만 null 로 두고 계속 간다.
     아래 auth* 메서드는 전부 첫 줄에서 이 null 을 확인한다. */
  let auth = null;
  try{
    auth = getAuth(fbApp);
    /* 세션 유지는 localStorage 로 못 박는다. 기본값(IndexedDB 우선)은 file:// 에서
       판에 따라 조용히 세션 저장으로 떨어져, 껐다 켜면 로그아웃돼 보인다. */
    setPersistence(auth, browserLocalPersistence).catch(e => console.warn('[auth] 지속성 설정 실패', e));
  }catch(e){ console.warn('[auth] 초기화 실패 — 로그인 기능만 비활성', e); auth = null; }

  /* ═══════════ 🚧 로그인 복원 대기선 (auth barrier) ═══════════
     [무엇을 막는가] getAuth() 는 즉시 돌아오지만 **저장된 세션을 되읽는 일은 비동기다.**
       그 사이 auth.currentUser 는 null 이고, 그때 나가는 쓰기에는 토큰이 안 붙는다.
       규칙이 users/{코드} 의 자기 소유 가지를 잠그기 전에는 이게 아무 문제도 아니었다 —
       토큰이 없어도 통과했으니까. 규칙을 게시한 순간부터는 **구글에 묶인 계정만**
       (userAuth/{코드} 가 존재하므로 auth.uid 일치를 요구받아) 부팅 직후 쓰기가 전부 거부된다.
       거부는 화면에 아무 표시도 남기지 않는다. 그래서 원인이 아니라 증상만 신고된다.
     ★ 이 약속은 **로그인 여부와 무관하게 반드시 resolve 된다.** 로그인 안 한 기기까지
       여기서 멈추면 규칙이 열어둔 경로(!userAuth exists)마저 죽는다.
     ⚠️ 타임아웃이 있어야 한다 — auth 초기화가 실패했거나(위 catch) 네트워크가 없어
       콜백이 영영 안 오는 판에서 부팅이 통째로 걸리면 안 된다. */
  const AUTH_READY_TIMEOUT_MS = 8000;
  let _authSettled = false;
  const _authReadyPromise = new Promise(resolve => {
    const done = ()=>{ if(!_authSettled){ _authSettled = true; resolve(); } };
    if(!auth){ done(); return; }
    try{ onAuthStateChanged(auth, done, done); }catch(_){ done(); return; }
    setTimeout(()=>{ if(!_authSettled) console.warn('[auth] 세션 복원이 늦어 대기선을 통과시킴'); done(); }, AUTH_READY_TIMEOUT_MS);
  });
  /* 소유권이 걸린 쓰기(users/{코드}/…)는 전부 이 줄을 먼저 지나야 한다.
     이미 통과했으면 await 비용은 0이다(정착된 뒤엔 마이크로태스크 한 번). */
  const _whenAuthReady = ()=> _authSettled ? Promise.resolve() : _authReadyPromise;

  /* 구글 로그인을 묶지 않고 물릴 때 — 이번 로그인으로 막 생긴 계정이면 지운다.
     로그아웃만 하면 빈 계정이 그 구글을 붙잡아, 나중에 진짜 계정에 구글을 연결할 때 credential-already-in-use 가 난다.
     ⚠️ 막 생긴 계정만 — 원래 있던 계정은 어딘가에 묶였을 수 있다. */
  const _dropGoogleSession = async (cred)=>{
    let fresh = false;
    try{ fresh = !!(cred && getAdditionalUserInfo(cred)?.isNewUser); }catch(_){}
    if(fresh){ try{ await deleteUser(cred.user); return; }catch(_){} }
    try{ await fbSignOut(auth); }catch(_){}
  };

  // ⏱ 서버 시간 오프셋 — stale 판정을 로컬 시계로 하면 PC 시계가 몇 분만 틀어져도
  //   상대의 멀쩡한 하트비트를 "오래됨"으로 오판해 숨김(A↔B 비대칭의 원인 후보). 서버 오프셋으로 보정.
  let _svTimeOffset = 0;
  try{ onValue(ref(db, '.info/serverTimeOffset'), s => { _svTimeOffset = s.val() || 0; }); }catch(e){}
  const _svNow = () => Date.now() + _svTimeOffset;
  let _myFriendsOff = null;   // 지금 걸린 watchMyFriendList 의 해제 함수 — 동시에 하나만(새로 걸면 앞의 것을 푼다)
  let _myPresenceRef = null, _presenceRoom = null, _presenceOnline = true, _presenceInRoom = false;
  let _presenceWritten = false;   // presence 를 한 번이라도 set 했는가 — 버전이 늦게 오면 그때만 메운다
  let _mobLive = null;   // 📱 태블릿·폰 연결 — { uid, stop } (mobileLinkStart)
  let _sessionRef = null, _sessionId = null, _sessionUnsub = null, _sessionLost = false;   // 🖥️ 한 계정 한 기기(claimDeviceSession)
  // 방 입장/퇴장 시 presence에 현재 방 코드를 같이 기록 — 친구 목록의 "온라인 · COZY-9K2M" 배지에 쓰임
  /* 🔒 단, **시크릿룸 코드는 기기 밖으로 내보내지 않는다.**
     [왜 화면에서 가리는 게 아니라 여기서 막나] presence 는 친구라면 누구나 읽는 노드다. 화면에서만
       숨기면 코드 자체는 서버에 그대로 남아, 앱을 거치지 않고 노드를 들여다보는 것만으로 새어나간다.
       시크릿룸은 "별표를 아는 사람만 들어오는 방"이라(doJoinRoom 사양 주석) 코드가 곧 열쇠다 —
       열쇠를 친구 목록에 올려두면 잠금장치가 없는 것과 같다.
     ★ 대신 `inRoom` **불리언 하나**를 따로 올린다. 친구 목록의 🏠(=지금 방에 있음)는 이 값만 본다.
       코드는 여전히 안 나가므로 열쇠는 지켜지고, "지금 뭔가 하는 중"이라는 신호는 남는다.
     ⚠️ `room:'SCRT'` 같은 **가짜 코드를 올리는 방식은 쓰지 않는다.** 그건 값 자체가 "쟤 비밀방에
       있다"를 말해버려서, 나중에 표시 규칙을 어떻게 바꾸든 노드만 읽으면 드러난다. 불리언은
       일반 방이든 시크릿룸이든 똑같은 true 라 구분이 안 된다. */
  function _syncPresenceRoom(code){
    const _secret = typeof code === 'string' && code.indexOf('SCRT-') === 0;
    _presenceRoom = (_secret ? null : (code || null));
    _presenceInRoom = !!code;
    if(_myPresenceRef && _presenceOnline) update(_myPresenceRef, _appVer.withVer({ room: _presenceRoom, inRoom: _presenceInRoom, lastSeen: Date.now() }));
  }

  // ★ Firebase 사용량 절감: 카탈로그 GLB(수백KB~1MB)를 Realtime Database 대신 Storage에 저장.
  //   data.glb가 base64면 → Storage로 업로드하고 { ...나머지, glbUrl } 반환.
  //   구버전 데이터는 그대로 { glb } — 마이그레이션 전까지 앱은 둘 다 지원.
  // 💰 Storage 캐시 정책 — 한 번 받은 파일은 브라우저/앱이 재사용해서 다운로드 대역폭(=서버비)을 아낌.
  const STORAGE_CACHE = 'public, max-age=31536000';
  async function _uploadGlbIfNeeded(path, data){
    const out = { ...data };
    if(out.glb && typeof out.glb === 'string'){
      const b64 = out.glb;
      const storageRef = sref(storage, path);
      // 💰 캐시 헤더 — 같은 파일을 매번 다시 받지 않게 1년 캐시. 파일을 새로 올리면 다운로드 URL의
      //   토큰이 바뀌므로 갱신은 정상적으로 반영됨(오래된 캐시가 남는 문제 없음).
      await uploadString(storageRef, b64, 'base64', { cacheControl: STORAGE_CACHE, contentType: 'model/gltf-binary' });
      out.glbUrl = await getDownloadURL(storageRef);
      delete out.glb;
    }
    return out;
  }
  // 💰 도트 썸네일도 Storage로 — 예전엔 base64 PNG를 Realtime DB의 카탈로그에 그대로 넣어서,
  //   모든 사용자가 앱을 켤 때마다 전체 썸네일을 다시 내려받았음(DB 다운로드 비용의 주범).
  //   여기서 Storage에 올리고 DB엔 thumbUrl(짧은 문자열)만 남긴다. 앱은 thumbUrl/thumbnail 둘 다 지원.
  const _gachaTx = createGachaTx({ db, ref, get, runTransaction, waitConnected: ms => window.firebaseAPI.waitConnected(ms), whenAuthReady: _whenAuthReady });
  const _groupInvite = createGroupInvite({ db, ref, get, update });
  /* presence · onDisconnect 는 set(통째 덮기)이라 그 객체마다 ver 를 실어야 꺼진 뒤에도 남는다.
     ⚠️ presence 에 쓰는 것은 update 까지 **전부** withVer 를 거친다 — 규칙은 online:true 인데 ver 가 없으면
       옛 앱으로 보고 내 읽기 · 쓰기를 막는다(ver 없는 오프라인 쓰기도 inRoom 이 있으면 거절). withVer 는 모르면 'unknown' 을 싣는다.
     버전보다 presence 가 먼저 쓰였으면 받은 뒤 ver 만 update 하고 onDisconnect 도 ver 를 실어 다시 건다. */
  const _appVer = createAppVersion({
    getVersion: () => (window.companion && window.companion.getAppVersion) ? window.companion.getAppVersion() : null,
    onReady: (ver) => {
      if(!_myPresenceRef || !_presenceWritten) return;
      try{ onDisconnect(_myPresenceRef).set(_appVer.withVer({ online:false, lastSeen: Date.now() })); }catch(_){}
      update(_myPresenceRef, { ver }).catch(()=>{});
    },
  });
  /* ⚙️ 원격 설정(remote-config.js — 읽는 차례 · 주기는 그 머리 주석) */
  const _lsOrNull = () => { try{ return window.localStorage; }catch(_){ return null; } };
  const _rc = (window.TwRemoteConfig && window.TwRemoteConfig.store) || null;
  const MIN_APP_VER_WAIT_MS = 7000;   // 첫 답을 이만큼만 기다린다(API 시간 제한 + 여유 · 게이트 8초보다 짧게) — 넘으면 막지 않는다
  if(_rc){
    _rc.start({
      api: (window.TwApi && window.TwApi.client) || null,   // 앱 공통 API 통로(api-client.js) — 운영/dev 주소는 거기서
      storage: _lsOrNull(),
      win: window,
      rt: window.TwRtHub.store,   // realtime 알림 config — 서버가 바꿨을 때 · 오래 끊겼다 붙었을 때 다시 묻는다
    });
  }
  /* 앱 최소 버전(app-version-gate.js) — 원격 설정의 첫 답(이번 실행에 받은 값만)으로 «업데이트해 주세요» · 못 받으면 막지 않는다. */
  createAppVersionGate({
    readMin: () => _rc ? _rc.ready(null, MIN_APP_VER_WAIT_MS).then(() => _rc.minAppVer()) : null,
    getVersion: () => _appVer.ready,
    companion: window.companion || null,
    ui: createAppVersionGateDom(document),
  }).start().then(r => { if(r.blocked) console.warn('[앱 최소 버전] 막음 —', r.my, '<', r.min); });
  onValue(ref(db, window.TwMaintenance.MAINTENANCE_PATH), (s) => _mt.onValue(s.val()), () => {});   // 🛠 서버 점검 표시 — 점검 중에도 규칙이 이 칸 읽기는 연다
  /* IP 기준 일일 방문자(visit-ping.js) — 로그인과 상관없이 켤 때 한 번. 함수 SDK 는 위 FUNCTIONS_SDK_URL 주석대로 부를 때 들여온다.
     ⚠️ CSP connect-src 에 운영 함수 호스트만 있어 dev(together-working-dev)에서는 막힌다 — 지표만 빠지고 앱은 그대로다. */
  createVisitPing({
    callPing: async (data) => {
      const mod = await import(FUNCTIONS_SDK_URL);
      return mod.httpsCallable(mod.getFunctions(fbApp, FUNCTIONS_REGION), 'visitPing')(data);
    },
    getVersion: () => _appVer.ready,
  }).start();
  const _getIdToken = (force) => (auth && auth.currentUser) ? auth.currentUser.getIdToken(!!force) : Promise.resolve(null);
  /* 🌐 로그인이 필요한 API 통로(api-client.js TwApi.authed — 쉬기 없음 · 기기 머리) — 토큰 출처만 여기서 잇는다. */
  window.TwApi.bindToken(_getIdToken);
  const _authApi = window.TwApi.authed;
  /* 🛰 realtime 연결 하나(realtime/rt-hub.js) — 연결 공통부 · 토큰 · 버전만 잇는다. 켜기(start) · 끄기는 로그인 흐름 몫. */
  window.TwRtHub.store.bind({ createLink: createRealtimeLink, getToken: _getIdToken, getVersion: () => _appVer.ready });
  async function _uploadThumbIfNeeded(path, data){
    const out = { ...data };
    if(out.thumbnail && typeof out.thumbnail === 'string' && out.thumbnail.startsWith('data:')){
      const url = await _uploadDataUrlIfNeeded(path, out.thumbnail);
      if(url && !url.startsWith('data:')){ out.thumbUrl = url; delete out.thumbnail; }
    }
    return out;
  }
  async function _tryDeleteStorage(path){
    try{ await deleteObject(sref(storage, path)); }catch(_){ /* 없어도 무시 */ }
  }

  /* 카탈로그 버전 확인 + 로컬 캐시 — 구조와 이유는 catalog-cache.js 머리말에 있다.
     경로를 여기 두는 이유: audit 검사 7 이 «코드가 접근하는 최상위 경로가 규칙에 있는가» 를 이 파일에서 찾는다.
     scope = DB 주소 — 운영과 dev 가 같은 PC 에서 돌아도 캐시가 섞이지 않게. */
  const _subscribeCatalogKind = createCatalogSync({
    metaRef:    (kind) => ref(db, 'catalogMeta/' + kind),
    catalogRef: (kind) => ref(db, 'catalog/' + kind),
    onValue, get,
    scope: (firebaseConfig && (firebaseConfig.databaseURL || firebaseConfig.projectId)) || '',
    /* 본문은 API 읽기 사본(GET /v1/catalog/{종류}?v=) 먼저 — 못 받으면 아래 Firebase get. 버전 알림은 위 metaRef 그대로. */
    fetch: createApiCatalogFetch({
      api: (window.TwApi && window.TwApi.client) || null,
      shouldFallback: window.TwApi && window.TwApi.shouldFallback,
      firebaseGet: (kind) => get(ref(db, 'catalog/' + kind)),
      source: () => window.TwSourceSwitch.store.pick('catalog'),   // 받는 곳 — 원격 설정 sources.catalog(없으면 늘 서버 먼저)
      serverFirst: window.TwSourceSwitch.serverFirst, SKIP: window.TwSourceSwitch.SKIP,
    }),
  });
  /* 카탈로그 쓰기는 전부 여기를 지난다 — 같은 다중 경로 update 로 catalogMeta/{종류} 버전(서버 시각)도 올린다.
     하나라도 빠지면 그 종류는 버전이 그대로라 사용자가 옛 카탈로그(캐시)를 계속 본다(최대 수명 24시간까지).
     catalog/parts · gachaParts · items · desks 에 쓰는 함수를 새로 만들면 반드시 이걸 쓴다(웹 관리자는 catalogCommit).
     규칙에 catalogMeta 가 아직 없으면(규칙 배포 전) 루트가 막혀 있어 update 가 통째로 거부된다.
     그때만 버전 없이 카탈로그만 한 번 더 쓴다 — 그 DB 를 쓰는 앱은 catalogMeta 구독이 거부돼
     통째 구독으로 돌고 있으므로 바로 반영된다(catalog-cache.js 안전장치 ①). */
  async function _catalogUpdate(updates, kinds){
    const withMeta = Object.assign({}, updates);
    for(const k of kinds) withMeta['catalogMeta/' + k] = serverTimestamp();
    try{
      await update(ref(db), withMeta);
    }catch(e){
      const code = String((e && (e.code || e.message)) || '');
      if(!/permission|PERMISSION_DENIED/i.test(code)) throw e;
      await update(ref(db), updates);   // 이것도 거부면(관리자 아님 · 형식 오류) 그 오류를 그대로 던진다
      console.warn('[catalog-cache] catalogMeta 규칙이 없어 버전 없이 카탈로그만 썼다 —', kinds.join(','));
    }
  }

  /* 공용 공지 버전 확인 + 로컬 캐시 — 구조는 broadcast-cache.js 머리말. 경로를 여기 두는 이유는 위 카탈로그와 같다. */
  const BROADCAST_OWN_WRITE_MS = 15000;   // 이 기기에서 쓴 뒤 이만큼은 공지 바뀜을 모으지 않는다(아래 liveNow)
  let _broadcastWroteAt = 0;
  const _subscribeBroadcast = createBroadcastSync({
    metaRef:     () => ref(db, 'inboxBroadcastMeta'),
    fullRef:     () => ref(db, 'inboxBroadcast'),
    latestQuery: (n) => query(ref(db, 'inboxBroadcast'), orderByChild('ts'), limitToLast(n)),
    pinnedQuery: () => query(ref(db, 'inboxBroadcast'), orderByChild('pinned'), equalTo(true)),
    onValue, get,
    scope: (firebaseConfig && (firebaseConfig.databaseURL || firebaseConfig.projectId)) || '',
    /* 이 기기에서 방금 쓴 바뀜은 모으지 않고 바로 받는다 — 관리자가 보낸 · 지운 공지가 자기 화면에 늦게 반영되지 않게 */
    liveNow: () => Date.now() - _broadcastWroteAt < BROADCAST_OWN_WRITE_MS,
  });
  /* 공용 공지 쓰기(보내기 · 고정 · 삭제)는 전부 여기를 지난다 — 같은 다중 경로 update 로 inboxBroadcastMeta(서버 시각)도 올린다.
     빠지면 사용자는 캐시해 둔 옛 공지를 캐시 수명(24시간)까지 본다. 웹 관리자는 broadcastCommit 이 같은 일을 한다.
     규칙에 inboxBroadcastMeta 가 아직 없으면 update 가 통째로 거부된다 — 그때만 버전 없이 공지만 한 번 더 쓴다
     (그 DB 를 쓰는 앱은 버전 구독이 거부돼 통째 구독으로 돌고 있으므로 바로 반영된다). */
  async function _broadcastUpdate(updates){
    _broadcastWroteAt = Date.now();   // update 를 부르는 순간 버전 구독이 (서버 시각 추정값으로) 먼저 울린다 — 그 전에 표시
    try{
      await update(ref(db), Object.assign({}, updates, { inboxBroadcastMeta: serverTimestamp() }));
    }catch(e){
      const code = String((e && (e.code || e.message)) || '');
      if(!/permission|PERMISSION_DENIED/i.test(code)) throw e;
      await update(ref(db), updates);   // 이것도 거부면(관리자 아님 · 형식 오류) 그 오류를 그대로 던진다
      console.warn('[broadcast-cache] inboxBroadcastMeta 규칙이 없어 버전 없이 공지만 썼다');
    }
  }

  /* ★ Storage Phase 2: 유저 이미지(프로필/배경/스티커/박수)를 Realtime DB의 base64 대신 Storage에 저장.
     dataURL("data:image/...;base64,...")이 들어오면 Storage에 올리고 다운로드 URL을 돌려줌.
     이미 URL(https://...)이면 그대로 통과 — 재저장 시 중복 업로드 방지.
     실패하면 원본 dataURL을 그대로 돌려줌(업로드 실패로 이미지가 통째로 날아가지 않게). */
  /* 이름이 내용 해시(«종류_h2…»)인 파일은 이미 있으면 그 URL 만 받는다 — 같은 이름 = 같은 그림이라 다시 올릴 까닭이 없다.
     캐시를 잃은 기기(새 PC · 지운 캐시)가 같은 그림을 전부 다시 올리던 길. 확인(읽기)은 올리기보다 훨씬 싸다.
     못 찾거나 확인이 거절되면 null — 부르는 쪽이 평소처럼 올린다. */
  async function _existingUrlIfHashed(path){
    if(!/_h2[0-9a-z]+\.[a-z]+$/.test(path)) return null;
    try{ return await getDownloadURL(sref(storage, path)); }catch(_){ return null; }
  }

  async function _uploadDataUrlIfNeeded(path, dataUrl){
    if(!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    if(!dataUrl.startsWith('data:')) return dataUrl;   // 이미 URL이거나 빈 값
    try{
      const storageRef = sref(storage, path);
      await uploadString(storageRef, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE });
      return await getDownloadURL(storageRef);
    }catch(e){
      console.warn('[storage] 이미지 업로드 실패 — DB에 그대로 저장합니다', path, e);
      return dataUrl;
    }
  }

  /* 🔐 계정 스냅샷 한 벌을 accountSnap 규칙 모양으로 — 범위 밖 항목은 **그 항목만** 뺀다(null = 쓰지 않음).
     규칙(firebase-database-rules.json accountSnap)과 같은 값: license ≤40 · focusTotalSec 0..359640000 · name ≤40 · friendCode ≤12 · ts 숫자 · ver ≤20 · 그 밖 거절.
     ver 는 스냅샷 값이 아니라 지금 앱 버전이다 — 웹 관리자가 사용자 수천 명의 버전을 이 모음 한 번으로 센다(presence 를 한 명씩 읽지 않게). */
  function _acctSnapClean(snap, ts, ver){
    const s = snap || {};
    const str = (v, n) => (typeof v === 'string' && v && v.length <= n) ? v : null;
    const f = Number(s.focusTotalSec);
    return {
      license: str(s.license, 40),
      focusTotalSec: (s.focusTotalSec != null && Number.isFinite(f) && f >= 0 && f <= 359640000) ? f : null,
      name: (typeof s.name === 'string' && s.name) ? s.name.slice(0, 40) : null,
      friendCode: str(s.friendCode, 12),
      ts: Number.isFinite(ts) ? ts : Date.now(),
      ver: str(ver, 20)
    };
  }

  window.firebaseAPI = {
    /* 🕒 서버 시계 — 위에서 이미 구독해 둔 `.info/serverTimeOffset` 보정값을 밖으로 낸다.
       [왜 내보내나] 가챠 병합이 **ts 가 큰 쪽이 이긴다**라서, 기기 시계를 그대로 믿으면 시계가
         앞선 기기 한 대가 올린 미래 ts 가 그 시각이 실제로 올 때까지 그 계정의 모든 기기를
         묶는다 — 뽑아도 그 자리에서 서버 값으로 덮이고 서버에는 안 올라간다(제보).
         하트비트 stale 판정이 같은 이유로 이미 이 값을 쓰고 있었다(_svNow) — 새 구독이 아니라
         쓰던 것을 공유하는 것뿐이라 비용이 0 이다.
       ⚠️ 오프셋이 아직 안 왔거나 오프라인이면 0 이라 Date.now() 와 같아진다 — 호출부는 그 경우를
         '보정 없음'으로 그냥 받아들이면 된다(지금보다 나빠지지 않는다). */
    serverNow(){ return _svNow(); },
    getIdToken(force){ return _getIdToken(force); },
    // 로그인 API GET — get(path, { auth:true, headers, timeoutMs }) 그대로(api-client.js). 통로가 없으면 'unavailable'(NO_API).
    apiGetAuthed(path, opts){ return _authApi ? _authApi.get(path, opts) : Promise.reject(Object.assign(new Error('API 통로 없음'), { kind: 'unavailable', code: 'NO_API', status: 0 })); },
    apiPostAuthed(path, body, opts){ return _authApi ? _authApi.post(path, body, opts) : Promise.reject(Object.assign(new Error('API 통로 없음'), { kind: 'unavailable', code: 'NO_API', status: 0 })); },
    // 서버 방에 들어가고 나갈 때 친구 목록의 «온라인 · 방코드» — Firebase 방은 joinRoom · leaveRoom 이 직접 한다.
    setPresenceRoom(code){ _syncPresenceRoom(code || null); },
    /* 🛰 소켓이 실제로 열렸는가 — 감시견(app.js `_fbBootWatch`)이 부팅 때 한 번 부른다.
       [왜 필요한가] `window.firebaseAPI` 가 있다는 것과 **서버에 닿는다**는 것은 다른 질문이다.
         initializeApp·getDatabase 는 네트워크를 안 타므로 CSP connect-src 나 방화벽이 소켓만
         막아도 이 파일은 끝까지 완주하고 firebase-ready 까지 발화한다. 그 뒤의 모든 읽기·쓰기가
         조용히 멈추는데 화면에는 아무 말도 안 뜬다 — 제보된 "방 개수 확인 중에서 안 넘어감 /
         마이홈·친구가 빈 채로 뜸"이 그 상태다.
       ★ `.info/connected` 는 서버 왕복이 아니라 **클라이언트가 들고 있는 소켓 상태**라 공짜다.
         부팅마다 불러도 요금이 0 이라 이 자리에 둘 수 있다.
       ⚠️ true 를 볼 때까지 기다리다 시간이 지나면 false 를 준다. 어느 쪽으로 끝나든 구독은 반드시
         해제한다 — 안 하면 재시도할 때마다 리스너가 쌓인다. */
    waitConnected(timeoutMs){
      return new Promise(resolve=>{
        let settled = false, unsub = null;
        const fin = v => {
          if(settled) return;
          settled = true;
          clearTimeout(t);
          try{ if(unsub) unsub(); }catch(_){}
          resolve(v);
        };
        const t = setTimeout(()=>fin(false), Math.max(1000, timeoutMs || 8000));
        try{
          unsub = onValue(ref(db, '.info/connected'), s=>{ if(s.val() === true) fin(true); }, ()=>fin(false));
        }catch(_){ fin(false); }
      });
    },
    // ===== 마이홈 친구 시스템 =====
    // 친추코드 → userId 조회. 없으면 null.
    /* 🔴 그 계정이 마지막으로 접속한 시각(ms) — 없으면 null.
       시크릿룸/라이선스 발급 전에 "친구코드가 가리키는 계정이 살아 있는가"를 보는 데 쓴다.
       (계정 이전으로 friendCodes가 버린 uid를 가리키면 발급이 조용히 허공으로 간다) */
    async getUserLastSeen(uid){
      try{
        const snap = await get(ref(db, `users/${uid}/presence`));
        const p = snap.val();
        return (p && typeof p.lastSeen === 'number') ? p.lastSeen : null;
      }catch(_){ return null; }
    },
    async getUserNameById(uid){
      try{ const snap = await get(ref(db, `users/${uid}/profile`)); const p = snap.val(); return (p && p.name) ? String(p.name) : null; }
      catch(_){ return null; }
    },
    /* ===== 🎵 플레이리스트 =====
       저장 구조를 둘로 나눈다. 합치면 "파도타기" 한 번이 전원의 곡 목록을 통째로 끌어온다.
         users/{uid}/playlist  = {items:[{id,title}], ts}   — 고른 사람 것만 1회 읽음
         playlistIndex/{uid}   = {name, n, ts}              — 무작위로 고르기 위한 가벼운 색인(1인 약 60바이트)
       색인도 전체를 읽지 않고 ts 최신 60명만 훑는다(limitToLast) — 인원이 늘어도 읽는 양이 안 늘어난다.
       ★ 이 상한은 규칙에도 박아뒀다: playlistIndex 의 .read 가 "query.limitToLast <= 60" 이다.
         limitToLast 를 떼면 query.limitToLast 가 null 이 되어 조건이 거짓 → 조용히 비싸지는 대신 거부된다.
         (규칙 파일에는 주석을 달 수 없다 — 경로 키의 값은 반드시 객체여야 해서 "_note":"…" 를 넣으면
          'Expected {' 로 저장이 거부된다. 그래서 규칙 설명은 여기에 적는다.)
       ⚠️ audit 검사 9의 정규식은 get(ref(db,'…')) 형태만 본다. 아래는 get(query(ref(db,…)))라
          검사에 안 걸리지만 **의도적으로 상한이 걸린 읽기**다. limitToLast를 떼면 그 보호가 사라진다. */
    /* meta = { bio, homePublic, private } — bio·homePublic 은 목록과 **같은 노드**에 얹는다.
       파도타기는 어차피 이 노드를 한 번 읽으므로 한마디와 공개 여부를 보여주는 데 읽기가 늘지 않는다.
       ⚠️ 프로필(users/{uid}/profile)에 넣지 않는 이유: setMyProfile 이 set() 으로 통째로 덮어써서
          레벨이 오를 때마다 한마디가 조용히 지워진다.
       🔒 meta.private 는 **노드에 저장하지 않는다.** 이건 서버가 알아야 할 값이 아니라
          "색인에 올릴지 말지"를 정하는 내 기기 설정이고, 효과는 아래 색인 분기 하나로 끝난다.
          노드에 남기면 남이 읽어갈 수 있는 값이 하나 늘 뿐 하는 일이 없다. */
    /* 🎵 프리셋 세 벌을 통째로 올린다(sets). 예전에는 «보고 있는 프리셋» 하나만 올렸다.
       ★ **items 거울을 같이 쓴다.** 옛 빌드의 fetchRandomPlaylist 는 pv.items 만 읽으므로,
         sets 만 쓰면 아직 업데이트 안 한 사람들 화면에서 이 사람이 통째로 사라진다.
         거울에는 **비지 않은 첫 프리셋**을 넣는다 — 옛 빌드에서도 뭔가는 들린다.
       ⚠️ 이 거울은 «한시적»이다. 옛 빌드가 충분히 빠진 뒤 지울 것 —
         남겨두면 같은 곡 목록을 두 벌 쓰게 되어 쓰기가 계속 두 배다.
       ⚠️ n(색인)은 **세 벌 합계**다. fetchRandomPlaylist 가 n > 0 으로 사람을 거르므로,
         활성 프리셋만 세면 «빈 프리셋을 열어 둔 사람이 파도타기에서 사라지는» 옛 옆효과가 남는다. */
    async publishMyPlaylist(uid, name, sets, meta, editTs){
      try{
        const ts = Number(editTs) > 0 ? Number(editTs) : Date.now();   // 고친 시각 — 다른 기기가 «어느 쪽이 나중인가» 를 가른다(editTs 칸 · 옛 앱은 이 칸을 안 써서 «모름» 이 된다)
        const m = meta || {};
        const ss = (Array.isArray(sets) ? sets : []).map(s => ({
          name: String((s && s.name) || ''),
          items: (s && s.items) || [],
        }));
        const total = ss.reduce((n, s) => n + s.items.length, 0);
        const mirror = (ss.find(s => s.items.length) || { items: [] }).items;
        await set(ref(db, `users/${uid}/playlist`), { sets: ss, items: mirror, ts, editTs: ts,
          bio: String(m.bio || '').slice(0, 140), homePublic: !!m.homePublic });
        /* 🔒 비공개 — 색인에서만 뺀다. 무작위 파도타기는 이 색인에서 사람을 고르므로 안 걸리고,
           친구 지목 파도타기(fetchPlaylistOf)는 노드를 직접 읽으므로 **그대로 들린다.**
           ★ 그게 의도다 — 모르는 사람에게는 안 열고, 친구에게는 연다.
           ⚠️ 노드의 곡 목록을 비우는 방식으로 막지 말 것. 그러면 친구 지목까지 같이 막힌다. */
        if(m.private) await remove(ref(db, `playlistIndex/${uid}`));
        else await set(ref(db, `playlistIndex/${uid}`), { name: String(name || '').slice(0, 20), n: total, ts });
        return true;
      }catch(e){ console.warn('[플레이리스트] 공개 실패', e); return false; }
    },
    /* 목록을 비웠다 — 색인에서는 지워 파도타기에 안 걸리게 하되, 노드 자체는 한마디·공개 여부를
       담아 남긴다. 통째로 지우면 곡을 전부 뺐다가 다시 넣는 사이에 써둔 한마디가 사라진다. */
    async removeMyPlaylist(uid, meta, editTs){
      try{
        const m = meta || {};
        /* 노드는 지우지 않고 빈 목록 + 고친 시각으로 남긴다 — 지우면 다른 기기가 «서버에 없다» 로 읽고 옛 목록을 다시 올린다.
           ⚠️ sets 도 같이 비운다(옛 프리셋이 남으면 친구 지목 파도타기에 계속 걸린다). */
        const ts = Number(editTs) > 0 ? Number(editTs) : Date.now();
        await set(ref(db, `users/${uid}/playlist`), { sets: [], items: [], ts, editTs: ts,
          bio: String(m.bio || '').slice(0, 140), homePublic: !!m.homePublic });
        await remove(ref(db, `playlistIndex/${uid}`));
        return true;
      }catch(e){ console.warn('[플레이리스트] 공개 해제 실패', e); return false; }
    },
    /* 👤 목록 주인의 명함 — 이름·레벨·프로필 사진. 파도타기로 **건너간 순간에만** 1회 읽는다.
       ★ 친구 목록이 이미 구독 중인 경로 둘을 그대로 쓴다(users/{uid}/profile, users/{uid}/home/avatar).
         home 을 통째로 읽으면 게시글·테마·스티커까지 딸려 와서 파도탈 때마다 수백 KB가 나간다.
       ⚠️ 실패해도 null 만 돌려준다 — 명함이 없다고 목록을 못 듣게 되면 안 된다. */
    async fetchPlaylistCard(uid){
      try{
        const [ps, as] = await Promise.all([
          get(ref(db, `users/${uid}/profile`)),
          get(ref(db, `users/${uid}/home/avatar`)),
        ]);
        const p = ps.val() || {};
        return { name: p.name ? String(p.name) : null,
          level: (typeof p.level === 'number' && p.level >= 1) ? p.level : null,
          cyc: p.cyc, clv: p.clv, starC: p.starC,   // 🌟 회차(개정 70) — 거르는 것은 app.js starFromRemote
          avatar: as.val() || null };
      }catch(e){ console.warn('[플레이리스트] 명함 읽기 실패', e); return null; }
    },
    /* 🖼 프로필 사진 한 칸 — home 통째 대신(api-public-reads.js 가 API 명함을 먼저 보고, 못 받으면 여기). */
    async fetchAvatar(uid){
      try{ return (await get(ref(db, `users/${uid}/home/avatar`))).val() || null; }catch(_){ return null; }
    },
    /* 🏆 내 순위 한 줄은 API 에만 있다 — Firebase 길은 undefined(부르는 쪽이 100줄 + rankOf). */
    async fetchMyRank(){ return undefined; },
    /* 👥 명함 날것은 API 에만 있다 — api-public-reads.js 가 바꿔 끼운다. 그 전엔 거절(친구 포트가 옛 길 카드로). */
    fetchUserCardApi(){ return Promise.reject(Object.assign(new Error('API 통로 없음'), { code: 'NO_API' })); },
    /* 🎲 남의 목록에서 **비지 않은 프리셋 하나를 무작위로** 고른다.
       [왜 여기 한 곳인가] 무작위 파도타기와 친구 지목 파도타기가 같은 규칙을 써야 한다.
         두 곳에서 각각 뽑으면 «친구 것은 늘 1번만 뜬다» 같은 어긋남이 조용히 생긴다.
       ★ 옛 사람 호환 — `sets` 가 없고 `items` 만 있는 사본(업데이트 안 한 기기가 올린 것)은
         **한 벌짜리 프리셋**으로 읽는다. 그래야 그 사람도 계속 파도타기에 걸린다.
       ★ 빈 프리셋은 후보에서 뺀다 — 눌러도 빈 목록인 것을 보여주지 않는다.
       ⚠️ RTDB 는 배열을 객체로 돌려줄 수 있어 Object.values 로 받는다(items 쪽과 같은 이유).
         그래서 **순서를 신뢰하지 않는다** — 프리셋 번호는 name 이 없을 때만 쓰는 보조값이다. */
    _plPickSet(pv){
      let cand = [];
      const raw = (pv && pv.sets) ? Object.values(pv.sets) : null;
      if(raw && raw.length){
        cand = raw.map((s, i)=>({
          idx: i,
          name: (s && s.name) ? String(s.name) : '',
          items: (s && s.items) ? Object.values(s.items).filter(x => x && x.id) : [],
        })).filter(s => s.items.length);
      }else{
        const it = (pv && pv.items) ? Object.values(pv.items).filter(x => x && x.id) : [];
        if(it.length) cand = [{ idx:0, name:'', items:it }];
      }
      if(!cand.length) return null;
      return cand[Math.floor(Math.random() * cand.length)];
    },
    // 최근 갱신 60명 중 나를 뺀 무작위 1명. 곡이 없는 사람은 색인에서 지워지므로 여기 안 나온다.
    async fetchRandomPlaylist(myUid, excludeUid){
      try{
        const snap = await get(query(ref(db, 'playlistIndex'), orderByChild('ts'), limitToLast(60)));
        const all = snap.val() || {};
        const uids = Object.keys(all).filter(u => u !== myUid && u !== excludeUid && (all[u] && all[u].n > 0));
        if(!uids.length) return null;
        const pick = uids[Math.floor(Math.random() * uids.length)];
        const ps = await get(ref(db, `users/${pick}/playlist`));
        const pv = ps.val();
        const set = this._plPickSet(pv);
        if(!set) return null;
        return { uid: pick, name: (all[pick] && all[pick].name) || '(이름 없음)', items: set.items,
          setName: set.name, setIdx: set.idx,
          bio: (pv && pv.bio) ? String(pv.bio) : '', homePublic: !!(pv && pv.homePublic) };
      }catch(e){ console.warn('[플레이리스트] 파도타기 실패', e); return null; }
    },
    /* 🌊 친구 파도타기 — 지목한 uid 의 목록 하나만 읽는다(읽기 1회).
       ⚠️ playlistIndex/{uid} 는 절대 직접 읽지 않는다. 그 노드의 .read 는 "query.limitToLast <= 60" 이라
         쿼리 없는 단건 읽기는 query.limitToLast 가 null 이 되어 **거부**된다(무작위 파도타기가
         limitToLast(60) 을 쓰는 이유와 같은 규칙).
       ★ 이름은 여기서 안 읽는다 — 부르는 쪽이 이미 친구 목록의 이름을 갖고 있다.
         profile 을 한 번 더 읽으면 읽기만 늘고, 내가 보는 이름과 어긋날 수도 있다. */
    /* 🎵 [2026-09-16 제보 4] **내 계정의 프리셋 세 벌 전부** — 계정을 이어받을 때 쓴다.
       fetchPlaylistOf 는 파도타기용이라 한 벌만 **무작위로** 고른다(_plPickSet). 그걸로 복원하면
       프리셋 2·3 이 사라지고, 로그아웃이 로컬 목록을 지우게 된 지금은 그게 곧 손실이다.
       ★ 노드에 sets 가 없는 옛 판(items 만)은 items 를 0번 프리셋으로 돌려준다.
       @return { sets:[{name, items:[{id,title}]}…], bio, homePublic } | null(노드 없음·읽기 실패) */
    async fetchMyPlaylistSets(uid){
      try{
        const ps = await get(ref(db, `users/${uid}/playlist`));
        const pv = ps.val();
        if(!pv) return { sets: [], bio: '', homePublic: false, ts: 0, editTs: 0 };   // 비어 있음 ≠ 못 읽음(null) — 기기 간 맞추기가 가른다
        const raw = pv.sets ? Object.values(pv.sets) : null;
        let sets;
        if(raw && raw.length){
          sets = raw.map(s => ({
            name: (s && typeof s.name === 'string') ? s.name : '',
            items: (s && s.items) ? Object.values(s.items).filter(x => x && x.id) : [],
          }));
        }else{
          const it = pv.items ? Object.values(pv.items).filter(x => x && x.id) : [];
          sets = [{ name:'', items: it }];
        }
        return { sets, bio: pv.bio ? String(pv.bio) : '', homePublic: !!pv.homePublic, ts: Number(pv.ts) || 0, editTs: Number(pv.editTs) || 0 };   // editTs 없음(옛 앱이 쓴 노드) = 고친 시각 모름
      }catch(e){ console.warn('[플레이리스트] 내 프리셋 읽기 실패', e); return null; }
    },
    async fetchPlaylistOf(uid){
      try{
        const ps = await get(ref(db, `users/${uid}/playlist`));
        const pv = ps.val();
        /* 무작위 파도타기와 **같은 규칙**으로 고른다. 여기만 다르면 «친구 것은 늘 1번만 뜬다»가 된다. */
        const set = this._plPickSet(pv);
        if(!set) return null;
        return { uid, items: set.items, setName: set.name, setIdx: set.idx,
          bio: (pv && pv.bio) ? String(pv.bio) : '', homePublic: !!(pv && pv.homePublic) };
      }catch(e){ console.warn('[플레이리스트] 친구 파도타기 실패', e); return null; }
    },
    async lookupFriendCode(code){
      const snap = await get(ref(db, `friendCodes/${code}`));
      const v = snap.val();
      return (v && v.userId) ? v.userId : null;
    },
    /* 🔗 역방향 — "이 계정이 쓰던 친추 코드는 무엇인가".
       friendCodes 는 코드→uid 뿐이라, uid 로 코드를 알려면 노드 전체를 훑어야 한다(비용 폭탄).
       그래서 코드를 발급/되찾을 때마다 users/{uid}/friendCode 에 거울을 하나 둔다.
       ★ 이게 있어야 **새 PC**에서 옛 코드를 알 수 있다. 로컬 기록은 그 기기에만 있으니
         기기를 갈아타면 통째로 사라진다 — 계정을 따라오는 곳은 서버뿐이다. */
    async setUserFriendCode(uid, code){
      try{ await set(ref(db, `users/${uid}/friendCode`), String(code)); return true; }
      catch(e){ console.warn('[친추코드] 계정에 코드 기록 실패', e); return false; }
    },
    async getUserFriendCode(uid){
      try{ const s = await get(ref(db, `users/${uid}/friendCode`)); const v = s.val(); return (typeof v === 'string' && v) ? v : null; }
      catch(e){ return null; }
    },
    /* 👋 (걷음 · 회원가입 설계 §6-⑧ · CHECKS 개정 56) `migrateFriendRequests` — «버린 uid» 앞의 친구 요청을 지금 계정으로
       끌어오던 것. 부르는 곳(_healFriendCodeOwner 의 «내가 버린 uid» 갈래)이 걷혔다 — 그 uid 는 이제 다른 계정이다. */
    // 내 친추코드를 등록(이미 다른 사람이 쓰고 있으면 실패). 트랜잭션으로 안전하게 "선점".
    async registerFriendCode(code, userId){
      const codeRef = ref(db, `friendCodes/${code}`);
      const result = await runTransaction(codeRef, cur=>{
        if(cur && cur.userId && cur.userId !== userId) return;   // 이미 다른 사람이 쓰는 코드 — 실패(undefined 반환 시 트랜잭션 중단)
        return { userId };
      });
      return !!(result && result.committed);
    },
    /* 🔗 (걷음 · 개정 56) `setFriendCodeOwner` — 친추코드 소유자 강제 지정. 부르던 두 곳(_claimFriendCodeAfterTransfer ·
       _healFriendCodeOwner 되찾기 갈래)이 걷혔다. 남의 계정 코드를 가져가는 통로라 남기지 않는다(선점은 registerFriendCode 뿐). */
    /* ===== 🎰 파츠 가챠 =====
         users/{uid}/gacha/owned/{partId} = 4      // 뽑은 횟수(누적). 4 이상 = 색상 변경 해금
         users/{uid}/gacha/ts             = 172…   // 마지막으로 바꾼 시각(ms)
       내 것만 1회 get 한다 — 목록을 실시간 구독하면 비용이 터진다(audit 검사 9).
       ★ 쓰기는 트랜잭션 한 길(updateGacha → character/gacha-tx.js)뿐이다 — 통째 set 은 다른 PC 의 뽑기를 지운다.
       ⚠️ 규칙 파일의 users/$userId 안에 gacha 블록이 없으면 여기 쓰기가 **조용히 전부 거부**된다.
         audit 검사 7은 최상위 경로만 보므로 users 하위 키는 잡아주지 않는다. */
    async loadGachaOwned(uid){
      try{
        const snap = await get(ref(db, `users/${uid}/gacha`));
        const v = snap.val() || {};
        return { owned: v.owned || {}, ts: Number(v.ts) || 0 };
      }
      catch(e){ console.warn('[가챠] 소유 목록 읽기 실패', e); return null; }   // null = 읽기 실패(값 없음과 구분)
    },
    updateGacha(uid, apply, opt){ return _gachaTx.updateGacha(uid, apply, opt); },
    /* ===== 🧍 캐릭터 슬롯 (기기 간 동기화 · 2026-09-16 제보 6-b) =====
         users/{uid}/slots/ts      = 172…   // 마지막으로 바꾼 시각(ms · 서버 시계)
         users/{uid}/slots/v       = 1
         users/{uid}/slots/s/{i}   = "{…}"  // 칸 i(0~4)의 def 를 **JSON 문자열**로. 빈 칸은 키가 없다.
       [왜 문자열인가] def 안의 deskItems·equippedParts·partXfMemory 는 파츠 id 를 키로 쓴다.
         그걸 RTDB 노드로 펼치면 키에 '.' '#' '$' 가 하나라도 섞이는 순간 쓰기가 거부되고,
         규칙의 .validate 도 필드마다 다시 써야 한다. 문자열 하나면 규칙 두 줄(길이 상한 +
         base64 금지)로 끝나고, 앱 쪽 직렬화 규칙이 바뀌어도 규칙 파일은 손댈 게 없다.
       ⚠️ **그림·GLB 는 절대 여기에 안 실린다.** 얼굴·감은눈·동물 페인트는 방 입장과 같은
         Storage 파일(roomface_*)의 URL 로, 커미션·커스텀 책상·커스텀 아이템 GLB 는 아래
         uploadSlotGlb 의 URL 로 바꿔 실린다 — 변환은 전부 app.js `_slotToServerObj` 가 한다.
         규칙 파일의 `.validate` 가 'data:…;base64' 를 거부하므로, 여기서 새는 dataURL 은
         조용히 저장되지 않고 **쓰기 전체가 거부**된다(그래서 반환값을 버리면 안 된다).
       ★ 병합 판정(ts 최신 승 · 연동 pull)은 전부 app.js `syncSlotsToServer` 가 한다.
         여기는 읽기/쓰기만. 가챠와 같은 자리 나누기다.
       ★ 통째 set — update 면 진 기기에서 지운 칸이 서버에 그대로 남는다(가챠와 같은 이유).
       ★ 부팅 때는 ts 만 먼저 읽는다(loadSlotsTs). 슬롯 본문은 얼굴 URL·파츠 목록까지 실려
         가챠 노드보다 훨씬 크다 — 바뀐 게 없는 부팅에서 그걸 매번 내려받을 이유가 없다. */
    async loadSlotsTs(uid){
      try{ const s = await get(ref(db, `users/${uid}/slots/ts`)); return Number(s.val()) || 0; }
      catch(e){ console.warn('[슬롯] 서버 시각 읽기 실패', e); return null; }   // null = 읽기 실패(0 과 구분)
    },
    async loadSlotsRemote(uid){
      try{
        const snap = await get(ref(db, `users/${uid}/slots`));
        const v = snap.val() || {};
        const s = {};
        const src = v.s || {};
        for(const k in src){ if(typeof src[k] === 'string' && src[k]) s[k] = src[k]; }
        return { s, ts: Number(v.ts) || 0 };
      }
      catch(e){ console.warn('[슬롯] 서버 사본 읽기 실패', e); return null; }   // null = 읽기 실패(값 없음과 구분)
    },
    async saveSlotsRemote(uid, s, ts){
      /* 🚧 소유권이 걸린 쓰기 — syncFocusTotal 과 같은 이유로 대기선을 지난다(제보 6).
         부팅 4.6초 push 가 세션 복원과 경주하면 구글에 묶인 계정은 첫 push 가 조용히 거부된다. */
      await _whenAuthReady();
      try{
        const clean = {};
        for(const k in (s || {})){
          if(!/^[0-4]$/.test(k)) continue;
          if(typeof s[k] !== 'string' || !s[k]) continue;
          clean[k] = s[k];
        }
        /* 🛟 [2026-09-20 ①] 서버 이전 한 벌 — 이 쓰기가 **칸을 줄이면** 덮기 직전의 것을 slotsPrev 에 남긴다.
           로컬 백업(3-7-1)은 캐릭터가 사라진 그 기기에만 있어서, 그 기기를 포맷하거나 로그아웃하면 같이 없어진다.
           서버에 한 벌 있으면 어느 기기에서든(새로 산 PC 에서도) 되돌릴 수 있다.
           ⚠️ 여기서 남기는 이유 — 덮는 쪽(다른 기기)은 자기가 무엇을 덮는지 모른다. 그걸 아는 건 서버 앞의 이 함수뿐이다.
           ⚠️ 하찮은 것으로 덮지 않는다(로컬 백업과 같은 규칙): 이미 있는 prev 가 더 많은 칸을 들고 있으면 그대로 둔다.
           ⚠️ 실패해도 본 쓰기는 막지 않는다 — 백업 때문에 캐릭터가 안 올라가면 다른 제보가 생긴다. */
        try{
          const nNew = Object.keys(clean).length;
          const cur = (await get(ref(db, `users/${uid}/slots`))).val();
          const curS = (cur && cur.s) || {};
          const nCur = Object.keys(curS).filter(k => typeof curS[k] === 'string' && curS[k]).length;
          if(nCur > nNew){
            const prev = (await get(ref(db, `users/${uid}/slotsPrev`))).val();
            const nPrev = prev && prev.s ? Object.keys(prev.s).length : 0;
            if(nPrev <= nCur) await set(ref(db, `users/${uid}/slotsPrev`), { v: 1, s: curS, ts: Number(cur.ts) || 0, at: Date.now() });
          }
        }catch(e){ console.warn('[슬롯] 서버 이전 한 벌 남기기 실패(본 쓰기는 계속)', e); }
        await set(ref(db, `users/${uid}/slots`), { v: 1, s: clean, ts: Math.max(0, Math.floor(Number(ts) || 0)) });
        return true;
      }catch(e){ console.warn('[슬롯] 서버 반영 실패', e); return false; }
    },
    /* 🛟 [①] app.js 가 ④ 충돌에서 «이 기기 것으로» 를 고르면 덮기 직전에 **조건 없이** 한 벌 남긴다(칸 수와 무관 —
       사람이 고른 판은 어느 쪽이든 되돌릴 자리가 있어야 한다). 같은 «더 많은 prev 는 안 덮는다» 규칙. */
    async saveSlotsPrevRemote(uid){
      await _whenAuthReady();
      try{
        const cur = (await get(ref(db, `users/${uid}/slots`))).val();
        const curS = (cur && cur.s) || {};
        const nCur = Object.keys(curS).filter(k => typeof curS[k] === 'string' && curS[k]).length;
        if(!nCur) return false;
        const prev = (await get(ref(db, `users/${uid}/slotsPrev`))).val();
        const nPrev = prev && prev.s ? Object.keys(prev.s).length : 0;
        if(nPrev > nCur) return false;
        await set(ref(db, `users/${uid}/slotsPrev`), { v: 1, s: curS, ts: Number(cur.ts) || 0, at: Date.now() });
        return true;
      }catch(e){ console.warn('[슬롯] 서버 이전 한 벌 실패', e); return false; }
    },
    async loadSlotsPrevRemote(uid){
      try{
        const v = (await get(ref(db, `users/${uid}/slotsPrev`))).val() || {};
        const s = {}; const src = v.s || {};
        for(const k in src){ if(typeof src[k] === 'string' && src[k]) s[k] = src[k]; }
        return { s, ts: Number(v.ts) || 0, at: Number(v.at) || 0 };
      }catch(e){ console.warn('[슬롯] 서버 이전 한 벌 읽기 실패', e); return null; }
    },
    /* ===== 🧬 캐릭터 단위 저장 (회원가입 설계 §2-2 · §5-N · 2026-09-21 · CHECKS 개정 34) =====
         users/{uid}/chars/{cid}          = { def:"{…}", mtime, v } | { del: mtime }   // def 는 slots.s 와 같은 JSON 문자열(서버 표현)
         users/{uid}/trash/{cid}/{mtime}  = { def, why, at }                           // 붙이기만(규칙 잎)
         users/{uid}/charsMeta            = { migratedFrom:'slots', migratedAt, claimAt, v, ts }
                                            ts = chars 를 마지막으로 쓴 시각(개정 36) — 평상시 받기가 이 한 값만 읽고 같으면 본문을 안 받는다(slots.ts 와 같은 구실)
       ★ 판정(짝짓기 · 병합)은 전부 app.js 순수 함수(_charsFromServerSlots · _charsFromLocalSlots · _charsMerge)가 한다. 여기는 읽기/쓰기만.
       ⚠️ 규칙이 **게시되기 전엔 쓰기가 전부 거부된다**(루트 .write:false). app.js 는 CHARS_SYNC_ENABLED 가 꺼져 있으면 쓰는 쪽을 안 부른다. */
    /* 💰 평상시 받기의 첫 걸음 — chars 본문(마리당 최대 15만 자 × 20)을 매번 받지 않으려고 한 값만 읽는다(개정 36).
       돌려주는 값: 숫자(없으면 0) · 읽기 실패면 null. */
    async loadCharsMetaTs(uid){
      try{ const v = (await get(ref(db, `users/${uid}/charsMeta/ts`))).val(); return Number(v) || 0; }
      catch(e){ console.warn('[캐릭터] charsMeta.ts 읽기 실패', e); return null; }
    },
    async loadCharsRemote(uid){
      try{
        const [c, m] = await Promise.all([ get(ref(db, `users/${uid}/chars`)), get(ref(db, `users/${uid}/charsMeta`)) ]);
        const src = c.val() || {}, chars = {};
        for(const k in src){ const e = src[k]; if(e && typeof e === 'object' && (typeof e.def === 'string' || typeof e.del === 'number')) chars[k] = e; }
        return { chars, meta: m.val() || null };
      }catch(e){ console.warn('[캐릭터] 서버 chars 읽기 실패', e); return null; }   // null = 읽기 실패(비어 있음과 구분)
    },
    /* 🔒 이관 선점 — 서버 slots → chars 는 **한 기기만** 한다(두 기기가 하면 같은 마리가 cid 둘).
       migratedAt:0 = 진행 중. 선점한 기기가 쓰기를 마치면 finishCharsMigration 이 시각을 적는다.
       진행 중인 채로 CHARS_CLAIM_STALE_MS 가 지나면(선점한 기기가 도중에 꺼짐) 다른 기기가 다시 잡을 수 있다 —
       다시 잡은 쪽도 지금 chars 를 읽고 짝짓기를 하므로 먼저 쓴 것과 def 문자열이 같으면 새 cid 를 안 뽑는다. */
    async claimCharsMigration(uid, staleMs){
      await _whenAuthReady();
      try{
        const now = _svNow(), stale = Number(staleMs) || 10*60*1000;
        const res = await runTransaction(ref(db, `users/${uid}/charsMeta`), cur => {
          if(cur == null) return { migratedFrom: 'slots', migratedAt: 0, claimAt: now, v: 1 };
          if(!cur.migratedAt && now - (Number(cur.claimAt) || 0) > stale) return Object.assign({}, cur, { claimAt: now });
          return undefined;                                                   // 이미 끝났거나 다른 기기가 진행 중 — 손대지 않는다
        });
        return { claimed: !!res.committed, meta: res.snapshot.val() || null };
      }catch(e){ console.warn('[캐릭터] 이관 선점 실패', e); return null; }
    },
    async finishCharsMigration(uid, at){
      await _whenAuthReady();
      try{ await update(ref(db, `users/${uid}/charsMeta`), { migratedAt: Math.max(1, Math.floor(Number(at) || _svNow())) }); return true; }
      catch(e){ console.warn('[캐릭터] 이관 도장 실패', e); return false; }
    },
    /* 여러 마리를 한 번에 — update 라서 안 건드린 cid 는 그대로다(slots 의 통째 set 과 반대 · 합집합이니까).
       ★ 개정 36: 같은 update 안에서 `charsMeta/ts` 도 찍는다(다중 경로 · 원자적). 따로 쓰면 둘째가 실패했을 때
         다른 기기가 ts 만 보고 «바뀐 것 없음» 으로 영영 못 받는다. 경로 키는 `chars/{cid}` — 합집합은 그대로다.
       돌려주는 값: 찍은 ts(숫자 · 성공) · 쓸 것이 없으면 true · 실패면 false. */
    async saveCharsEntries(uid, entries){
      await _whenAuthReady();
      try{
        const patch = {};
        for(const cid in (entries || {})){
          if(!/^c[a-z0-9]{6,24}$/.test(cid)) continue;
          const e = entries[cid]; if(!e) continue;
          patch['chars/' + cid] = (typeof e.def === 'string')
            ? { def: e.def, mtime: Math.max(0, Math.floor(Number(e.mtime) || 0)), v: 1 }
            : { del: Math.max(0, Math.floor(Number(e.del) || 0)) };
        }
        if(!Object.keys(patch).length) return true;
        const ts = Math.max(1, Math.floor(_svNow()));
        patch['charsMeta/ts'] = ts;
        await update(ref(db, `users/${uid}`), patch);
        return ts;
      }catch(e){ console.warn('[캐릭터] 서버 chars 쓰기 실패', e); return false; }
    },
    /* 🧬 묘비의 마지막 모습 — 첫 채택이 «다른 기기에서 지운 마리» 를 알아보려고 읽는다(개정 35). cid 마다 mtime 이 가장 큰 def.
       돌려주는 값: { cid: def문자열 } (휴지통에 없으면 키 없음) · 읽기 실패면 null. */
    async loadCharsTrashLatest(uid, cids){
      try{
        const out = {};
        await Promise.all((cids || []).map(async cid => {
          const v = (await get(ref(db, `users/${uid}/trash/${cid}`))).val() || {};
          let best = -1;
          for(const k in v){ const t = Number(k); if(v[k] && typeof v[k].def === 'string' && t > best){ best = t; out[cid] = v[k].def; } }
        }));
        return out;
      }catch(e){ console.warn('[캐릭터] 휴지통 읽기 실패', e); return null; }
    },
    /* 🗑️ 휴지통 탭(시안 E · CHECKS 개정 49) — 휴지통 전체. 어떤 줄을 보일지(기한 · 복원됨 접기)는 app.js 순수 함수 _charsTrashView 가 정한다.
       여기는 모양만 거른다: def 문자열 · why 두 값 · at 숫자. [내 정보 › 휴지통]을 열 때만 부른다(평상시 동기화는 안 읽는다).
       돌려주는 값: { cid: { mtime: { def, why, at } } } (없으면 {}) · 읽기 실패면 null(비어 있음과 구분). */
    async loadCharsTrashAll(uid){
      try{
        const v = (await get(ref(db, `users/${uid}/trash`))).val() || {};
        const out = {};
        for(const cid in v){
          if(!/^c[a-z0-9]{6,24}$/.test(cid) || !v[cid] || typeof v[cid] !== 'object') continue;
          for(const mt in v[cid]){
            const t = v[cid][mt];
            if(!t || typeof t.def !== 'string' || (t.why !== 'deleted' && t.why !== 'overwritten')) continue;
            (out[cid] = out[cid] || {})[mt] = { def: t.def, why: t.why, at: Number(t.at) || 0 };
          }
        }
        return out;
      }catch(e){ console.warn('[캐릭터] 휴지통 전체 읽기 실패', e); return null; }
    },
    /* 휴지통 — 한 줄씩. 잎 규칙이 «없을 때만» 이라 한 번에 update 하면 이미 있는 한 줄 때문에 **전부** 거부된다.
       이미 있는 자리(같은 cid·같은 mtime)는 같은 내용이니 실패해도 넘어간다. 돌려주는 값 = 쓴 줄 수. */
    async appendCharsTrash(uid, list){
      await _whenAuthReady();
      let n = 0;
      for(const t of (list || [])){
        if(!t || !/^c[a-z0-9]{6,24}$/.test(t.cid) || typeof t.def !== 'string') continue;
        const why = (t.why === 'deleted') ? 'deleted' : 'overwritten';   // 두 값뿐 — deleted 3일 · overwritten 10일(설계 개정 5 · 청소는 함수)
        try{ await set(ref(db, `users/${uid}/trash/${t.cid}/${Math.max(0, Math.floor(Number(t.mtime) || 0))}`), { def: t.def, why, at: _svNow() }); n++; }
        catch(e){ /* 이미 있음(붙이기만) · 또는 규칙 미게시 — 본 쓰기는 막지 않는다 */ }
      }
      return n;
    },
    /* 🧍 슬롯에 딸린 GLB(커미션 베이스·커스텀 책상·커스텀 아이템)를 Storage 에.
       key 는 app.js 가 '종류_내용해시' 로 만든다 — 같은 파일은 같은 경로라 두 번 올라가지 않고,
       다른 파일은 다른 경로라 서로 덮지 않는다(roomface_* 와 같은 규칙).
       ⚠️ 카탈로그 GLB(_uploadGlbIfNeeded)와 경로를 나눈다 — 그쪽은 관리자 카탈로그, 이쪽은 개인 파일. */
    async uploadSlotGlb(userId, key, b64){
      if(!b64 || typeof b64 !== 'string') return { ok:false, reason:'GLB 가 아니에요' };
      const safeKey = String(key||'glb').replace(/[^a-zA-Z0-9_.-]/g, '');
      try{
        const path = `users/${userId}/slotglb_${safeKey}.glb`;
        const have = await _existingUrlIfHashed(path);
        if(have) return { ok:true, url: have };
        const storageRef = sref(storage, path);
        await uploadString(storageRef, b64, 'base64', { cacheControl: STORAGE_CACHE, contentType: 'model/gltf-binary' });
        const url = await getDownloadURL(storageRef);
        return { ok:true, url };
      }catch(e){ console.warn('[슬롯] GLB 업로드 실패', safeKey, e); return { ok:false, reason:'업로드에 실패했어요' }; }
    },
    /* 🏅 👑달성표 주간 보상 — 추가 뽑기 횟수. users/{uid}/chalBonus (숫자 하나)
       ★ **gacha 노드 안에 두지 않는다.** 옛 판(0.11 이하)이 그 노드를 통째로 set 하는데,
         보상을 모르는 **옛 버전 클라이언트**는 {owned, ts} 만 실어 보낸다 — 그 한 번의 쓰기로
         보상이 증발한다. 기기 두 대 중 하나만 업데이트한 사람에게 실제로 일어나는 일이다.
         노드를 갈라 두면 옛 버전이 건드릴 수 있는 경로 자체가 없다.
       ★ set 이 아니라 트랜잭션인 이유: 지급은 "지금 값에 더하기"다. 두 기기가 토요일 0시에
         동시에 정산하면 set 은 한쪽 지급을 통째로 덮어써서 없앤다.
       ★ 🔒 **두 번 지급**은 트랜잭션으로 못 막는다(트랜잭션은 "지금 값에 더하기"가 안전하다는 것뿐,
         "이미 준 적이 있나"는 모른다). 그래서 tag 를 받아 users/{uid}/chalPaidTags/{tag} 를
         먼저 잡는다 — 같은 tag 로 두 번 부르면 두 번째는 {dup:true} 로 물러난다.
         [왜 서버여야 하나] app.js 의 chalRec 은 ts 최신 승 **통째 덮어쓰기**라, 선지급 표식이
         없는 다른 기기가 나중에 저장하면 그 표식이 지워지고 그 기기가 한 번 더 준다.
         선지급은 "평일 낮에 목표를 채우는 순간"이라 두 기기가 겹칠 일이 흔하다.
         ⚠️ 뽑기는 한 번 나가면 회수 경로가 없다. 이 방어를 걷어내지 말 것. */
    async loadChalBonus(uid){
      try{ const s = await get(ref(db, `users/${uid}/chalBonus`)); return Math.max(0, Math.floor(Number(s.val()) || 0)); }
      catch(e){ console.warn('[달성표] 보상 읽기 실패', e); return null; }   // null = 읽기 실패(0 과 구분)
    },
    async addChalBonus(uid, n, tag){
      try{
        const add = Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
        if(!add) return { ok:true, bonus:null };
        /* 🔒 표식을 **지급보다 먼저** 찍는다. 순서를 뒤집으면 "주고 나서 죽었을 때" 표식이 없어
           다음 실행이 한 번 더 준다. 못 주고 끝나는 쪽이 두 번 주는 쪽보다 낫다
           (지급 실패는 부르는 쪽이 콘솔에 남기고, 다음 tick 에서 다시 시도한다).
           ⚠️ tag 는 RTDB **키**다 — '.', '/', '#', '$', '[', ']' 가 들어가면 경로가 갈라지거나
             쓰기가 거부된다. app.js 는 '2026-W35-wd' 꼴로 만들지만 여기서 한 번 더 씻는다. */
        if(tag){
          const clean = String(tag).replace(/[.$#\[\]/]/g, '-').slice(0, 40);
          const tr = ref(db, `users/${uid}/chalPaidTags/${clean}`);
          /* 사전 get 은 트랜잭션 첫 시도의 cur=null 오해를 막는 장치다(아래 chalBonus 와 같은 이유).
             여기서 이미 값이 보이면 트랜잭션까지 갈 것도 없다. */
          let taken = false;
          try{ const s = await get(tr); taken = (s.val() != null); }catch(_){}
          if(taken) return { ok:true, dup:true, bonus:null };
          const mark = await runTransaction(tr, cur => (cur == null ? Date.now() : undefined));
          if(!mark || !mark.committed) return { ok:true, dup:true, bonus:null };   // 다른 기기가 먼저 잡았다
        }
        const r = ref(db, `users/${uid}/chalBonus`);
        let pre = 0;
        try{ const s = await get(r); pre = Number(s.val()) || 0; }catch(_){}
        const res = await runTransaction(r, cur => {
          const base = (cur === null || cur === undefined) ? pre : (Number(cur) || 0);
          return Math.min(9999, base + add);
        });
        const v = Number(res && res.snapshot && res.snapshot.val());
        return { ok:true, bonus: isFinite(v) ? v : (pre + add) };
      }catch(e){ console.warn('[달성표] 보상 지급 실패', e); return { ok:false, reason:String((e && e.message) || e) }; }
    },
    /* 🕒 포커스 누적 동기화 (기기 간 공유) — users/{uid}/focus/totalSec
       ★ set 이 아닌 이유: A/B 두 기기를 동시에 켜두면 set 은 나중에 쓴 쪽이 상대의 기록을
         통째로 지운다. 아래는 트랜잭션 안에서 증분을 더하고 바닥을 깔기만 하므로 안전하다. */
    /* 누적 집중시간 서버 반영. 병합식은 이 한 줄이다:
           새 값 = max(서버값 + addSec, baselineSec)
       ★ 두 인자는 **어느 쪽도 상대를 대체하지 않는다.** 둘 다 매번 온다.
         · addSec(증분)      — "이 기기에서 새로 일한 만큼". 뒤처진 기기의 작업이 증발하지 않게.
             예) a=8h 서버, b는 연동이 안 따라온 채 2h→6h 로 일했다(증분 4h).
                 max 만 쓰면 8h 가 이겨 4시간이 사라진다. 증분이면 8+4=12h 가 된다.
         · baselineSec(바닥) — "이 기기의 로컬 누적치". 마크가 어긋나 증분이 0 으로 잡히는
             상황(연동/해제 직후, 구버전에서 올라온 기기)에서도 최소한 큰 쪽은 따라가게.
       ★ 계산은 전부 트랜잭션 **안에서** 한다 — 두 기기가 동시에 써도 각자의 증분이 살아남는다.
         (사전 get 의 pre 는 cur===null 일 때의 대체값으로만 쓴다. 아래 주석 참고)
       ⚠️ 값은 절대 줄지 않는다(단조 증가). 서버 값을 낮추는 경로는 여기 없다 — 있어선 안 된다.
       반환: { ok, totalSec } — 합산 후 서버의 최신 누적치(초). */
    async syncFocusTotal(userId, addSec, baselineSec){
      /* 🚧 [2026-09-15 제보 6] 소유권이 걸린 쓰기다 — setMyProfile 과 같은 이유로 대기선을 지난다.
         빠져 있었다: 부팅 4초 동기화가 세션 복원과 경주해서, 구글에 묶인 계정은 첫 push 가
         permission_denied 로 조용히 죽고 다음 10분 주기까지 이 기기의 기록이 서버에 안 갔다. */
      await _whenAuthReady();
      let _readSec = null;   // 🩹 #4a — 쓰기가 거부돼도 읽기는 공개라 서버 값은 받을 수 있다(아래 catch 가 돌려준다)
      try{
        const r = ref(db, `users/${userId}/focus/totalSec`);
        /* ⚠️ 누적 상한 — **app.js 의 FOCUS_TOTAL_CAP_SEC · 규칙 파일의 .validate 와 같은 값이어야 한다.**
           999시간(회차 한 바퀴) × 100회차. 서버 규칙이 더 낮으면 잘리는 게 아니라 쓰기가 통째로 거부된다. */
        const CAP = 999*3600*100;   // 359,640,000초 = 99,900시간
        const delta = Math.max(0, Math.floor(Number(addSec) || 0));
        const bn = Number(baselineSec);
        const baseline = (isFinite(bn) && bn >= 0) ? Math.min(CAP, Math.floor(bn)) : 0;
        // ★ 사전 get: RTDB 트랜잭션은 로컬 캐시가 비어 있으면 첫 시도에 cur=null로 들어온다.
        //   그 상태를 "값 없음"으로 오해해 중단하면 기록이 영영 안 써지므로, 미리 읽어 기준값을 잡는다.
        let pre = 0;
        try{ const s = await get(r); pre = Number(s.val()) || 0; _readSec = pre; }catch(_){}
        // 올릴 게 없으면 쓰지 않는다 — 주기 동기화가 읽기 1회로 끝나게 하는 지점(비용).
        const want = Math.min(CAP, Math.max(pre + delta, baseline));
        if(want <= pre) return { ok:true, totalSec: pre };
        const res = await runTransaction(r, cur => {
          const base = (cur === null || cur === undefined) ? pre : (Number(cur) || 0);
          return Math.min(CAP, Math.max(base + delta, baseline));
        });
        const v = Number(res && res.snapshot && res.snapshot.val());
        return { ok:true, totalSec: isFinite(v) ? v : want };
      }catch(e){
        const reason = String((e && e.message) || e);
        /* 거부를 이름 붙여 돌려준다 — 부르는 쪽이 «세션이 풀렸다» 를 가려낼 유일한 근거다. */
        const denied = /permission[_ ]denied/i.test(reason) || /PERMISSION_DENIED/.test(String(e && e.code || ''));
        /* 🩹 [2026-10-02 제보 #4a] «윈도우 58 → 맥 47» — 쓰기가 거부되면 받아오기도 같이 멈춰서, 거부되는 기기는
           옛 레벨에 영영 머물렀다. 읽어 둔 서버 값(serverSec)을 같이 돌려준다 — 받아올지는 app.js 가 정한다. */
        return { ok:false, reason, denied, authed: !!(auth && auth.currentUser), serverSec: _readSec };
      }
    },
    /* ═══════════ 🏆 전체 랭킹 (개정 73 · handoff-ranking.md) ═══════════
         leaderboard/{userId} = { sec: 누적초, ts: 서버 시각 }
       ★ 이름·사진을 싣지 않는다 — 화면은 **내 순위 하나**만 보여준다. 표에 남는 건 코드와 시간뿐.
       ★ 값은 syncFocusTotal 이 돌려준 **서버 총합**이다(여러 기기 합산이 끝난 값). 로컬 누적을 여기 쓰지 않는다.
       ⚠️ 규칙: 목록 읽기는 «sec 정렬 + limitToLast ≤ 100» 쿼리만(playlistIndex 와 같은 방식 · 표 통째 읽기 거부).
         한 줄 읽기(leaderboard/{코드})는 열려 있다 — 아래 «같은 값이면 안 씀» 이 그걸 쓴다.
       ★ 같은 sec 를 다시 쓰지 않는 이유: ts 가 동점 순서(먼저 도달한 사람이 위)다. 부팅마다·기기마다 같은 값을
         새 ts 로 덮으면 동점에서 뒤로 밀린다. 그래서 서버 줄의 sec 가 같으면 쓰지 않는다(읽기 1회). */
    async setLeaderboardSec(userId, sec){
      await _whenAuthReady();   // 소유권 쓰기 — syncFocusTotal 과 같은 대기선
      try{
        const CAP = 999*3600*100;   // ⚠️ focus/totalSec 과 같은 상한(규칙 leaderboard/sec 도 같은 값 · sim-focus-cap 3절)
        const v = Math.min(CAP, Math.max(0, Math.floor(Number(sec) || 0)));
        const r = ref(db, `leaderboard/${userId}`);
        let cur = null; try{ const s0 = await get(r); cur = s0.val(); }catch(_){}
        if(cur && Number(cur.sec) === v) return { ok:true, sec: v, same:true };
        await set(r, { sec: v, ts: serverTimestamp() });
        return { ok:true, sec: v };
      }catch(e){ return { ok:false, reason: String((e && e.message) || e) }; }
    },
    /* 상위 100줄 — [{ uid, sec, ts }]. 순서는 부르는 쪽(rankOf)이 다시 매긴다. 실패 = null(«없음» 과 구분). */
    async fetchLeaderboardTop(){
      try{
        const snap = await get(query(ref(db, 'leaderboard'), orderByChild('sec'), limitToLast(100)));
        const out = [];
        snap.forEach(ch => { const v = ch.val() || {}; out.push({ uid: ch.key, sec: Number(v.sec) || 0, ts: Number(v.ts) || 0 }); });
        return out;
      }catch(e){ console.warn('[랭킹] 읽기 실패', e); return null; }
    },
    /* ═══════════ 👑 달성표 (주간 5일 달성) ═══════════
         users/{uid}/chal = { ts, week, kind, cfg, pendingCfg, auto, days, today }
       ★ 병합 정책은 **가챠 쪽(ts 최신 승)** 을 베꼈다 — focus/totalSec 의 max+증분이 아니다.
         주간 상태는 눈금이 아니라 "지금 어떤 주를 어떤 조건으로 하고 있는가"라는 한 덩어리라,
         두 기기 값을 합치면 (예: 월은 A기기, 화는 B기기 조건) 말이 안 되는 주가 만들어진다.
         판정·비교는 전부 app.js syncChalToServer 가 하고 여기는 읽기/쓰기만 한다.
       ★ set 을 쓰는 것이 중요하다 — update 면 진 기기에만 있던 요일이 서버에 남아
         "덮어썼는데 옛것이 섞여 있다"가 된다(가챠와 같은 이유).
       ⚠️ 규칙 파일 users/$userId 안에 chal 블록이 없으면 여기 쓰기가 **조용히 전부 거부**된다.
         audit 검사 7은 최상위 경로만 보므로 users 하위 키는 잡아주지 않는다. */
    async loadChal(uid){
      try{
        const snap = await get(ref(db, `users/${uid}/chal`));
        return snap.val() || {};        // {} = 아직 한 번도 안 쓴 사람
      }
      catch(e){ console.warn('[달성표] 읽기 실패', e); return null; }   // null = 읽기 실패(값 없음과 구분)
    },
    async saveChal(uid, rec){
      try{
        await set(ref(db, `users/${uid}/chal`), rec || null);   // null 을 넣으면 노드 삭제(=포기)
        return true;
      }catch(e){ console.warn('[달성표] 쓰기 실패', e); return false; }
    },
    /* 내 프로필(이름·레벨) 저장 — 친구 목록에서 상대방에게 보여줄 값.
       ★ level을 여기에 함께 넣는 이유: 친구 목록은 이미 users/{id}/profile을 구독하고 있어서
         읽기 비용이 전혀 늘지 않는다. 쓰기도 레벨이 실제로 바뀔 때만 1회(숫자 하나)라 사실상 0. */
    async setMyProfile(userId, name, level, star){
      /* 🚧 부팅 직후 첫 쓰기다. 세션 복원을 기다리지 않으면 구글에 묶인 계정에서
         permission_denied 가 나고, 부르는 쪽(app.js initMyHome)이 그 예외로 중단된다. */
      await _whenAuthReady();
      const rec = { name: name||'(이름 없음)', updatedAt: Date.now() };
      const lv = parseInt(level, 10);
      if(isFinite(lv) && lv >= 1 && lv <= 9999) rec.level = lv;
      /* 🌟 회차(개정 70) — { cyc, clv, starC }. 규칙과 같은 범위만 싣는다(cyc 1~100 · clv 1~999 · #rrggbb).
         ★ level 은 해금 레벨 그대로다(999 에서 멈춤). 친구 목록의 별 배지는 이 세 필드로 그린다.
         ⚠️ set() 통째 덮어쓰기라 **부르는 곳이 매번 star 를 넘겨야** 한다 — 빠뜨리면 회차가 지워진다(app.js myStarOut()). */
      if(star){
        const cy = parseInt(star.cyc, 10), cl = parseInt(star.clv, 10);
        const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v);
        if(cy >= 1 && cy <= 100 && cl >= 1 && cl <= 999){
          rec.cyc = cy; rec.clv = cl;
          /* 🌟 [개정 71] starC 가 비어 오면 = 이 기기에 고른 색이 없다(새 기기 · 받아 오기 전). 서버의 기존 값을 **지킨다** —
             안 지키면 set() 통째 덮어쓰기가 다른 기기에서 고른 색을 지운다. 읽기는 이 경우에만 한 번. */
          let sc = star.starC;
          if(!hex(sc)){ try{ const cur = (await get(ref(db, `users/${userId}/profile/starC`))).val(); if(hex(cur)) sc = cur; }catch(_){} }
          if(hex(sc)) rec.starC = sc;
        }
      }
      await set(ref(db, `users/${userId}/profile`), rec);
    },
    /* 🌟 회차 별 색 받아 오기(개정 71) — 프로필 starC 한 값만 읽는다(프로필은 공개 읽기). #rrggbb 가 아니면 null.
       팔레트 대조는 app.js(_starColorOk)가 한다. */
    async fetchProfileStarC(userId){
      if(!userId) return null;
      try{ const v = (await get(ref(db, `users/${userId}/profile/starC`))).val(); return (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v)) ? v : null; }
      catch(_){ return null; }
    },
    // 온라인 상태 등록 — onDisconnect로 앱이 꺼지거나 튕기면 자동으로 offline 처리됨.
    setMyPresenceOnline(userId, startOnline){
      if(_myPresenceRef) return;   // 중복 등록 방지
      _myPresenceRef = ref(db, `users/${userId}/presence`);
      /* 🔒 startOnline — 처음 온라인 여부(Promise · 고정값을 읽은 뒤). 쓰기는 이것이 풀린 뒤에만 — 오프라인 고정인데 «온라인» 이 한 번 보이지 않게.
         없으면(밀려난 뒤 다시 걸기) 지금 값 그대로. 등록(_myPresenceRef)은 바로 한다 — 기기 세션이 밀릴 때 놓는 순서가 그대로이게 */
      const gate = Promise.resolve(startOnline).then(v=>{ if(v === false) _presenceOnline = false; }).catch(()=>{});
      /* 🔌 presence 를 **지금 상태 그대로** 다시 쓰고, onDisconnect 도 함께 다시 건다.
         최초 1회와 재접속이 똑같은 것을 써야 해서 함수로 뺐다.
         ★ online 에 true 가 아니라 `_presenceOnline` 을 넣는 것이 핵심이다 —
           수동으로 오프라인 해 둔 사람을 네트워크가 한 번 끊겼다는 이유로
           온라인으로 되돌리면 안 된다(setMyPresenceState 가 이 값을 세운다). */
      const _armPresence = ()=>gate.then(()=>{
        if(!_myPresenceRef) return;
        onDisconnect(_myPresenceRef).set(_appVer.withVer({ online:false, lastSeen: Date.now() }));
        set(_myPresenceRef, _appVer.withVer({
          online: _presenceOnline, lastSeen: Date.now(),
          room:   _presenceOnline ? _presenceRoom   : null,
          inRoom: _presenceOnline ? _presenceInRoom : false
        }));
        _presenceWritten = true;
      });
      /* 🚧 presence 도 소유권이 걸린 가지다 — 세션 복원 전에 쓰면 조용히 거부되고,
         그 기기는 친구 목록에서 영영 오프라인으로 보인다(재접속 복구가 돌기 전까지).
         ⚠️ .info/connected 쪽은 감싸지 않는다. 그건 이미 부팅이 한참 지난 뒤의 경로다. */
      /* 처음 쓰기는 버전을 받은 뒤 — 'unknown' 으로 먼저 쓰고 메우는 쓰기 두 번을 줄인다(IPC 라 보통 로그인보다 빠르다).
         ready 는 못 받아도 null 로 끝나고(거부 없음), 그 전에 .info/connected 가 먼저 오면 그쪽이 'unknown' 으로 쓴다. */
      _whenAuthReady().then(() => _appVer.ready).then(_armPresence);
      /* 🔌 재접속 복구 — **이게 없으면 한 번 끊긴 사람은 영영 오프라인이다.**
         [기전] 화면 잠금·절전·와이파이 전환으로 소켓이 끊기면 서버가 위 onDisconnect 를 실행해
           presence.online 을 false 로 만든다. 여기까지는 의도된 동작이다.
           깨어나면 SDK 가 알아서 재접속하고 onDisconnect 도 다시 걸어 주지만,
           **online 을 true 로 되돌려 쓰는 주체가 아무도 없었다.**
           · 위의 `if(_myPresenceRef) return` 때문에 이 함수를 다시 부를 수도 없고,
           · 아래 6시간 인터벌은 update 로 lastSeen 만 건드려 online:false 를 그대로 남긴다
             (오히려 '살아 있는 계정'으로 보이게 만들어 이상함을 더 늦게 발견하게 한다).
           ⇒ 수동 토글(setMyPresenceState)을 누르기 전까지 자가 복구 경로가 하나도 없었다.
           제보 그대로다: "누르지도 않았는데 오프라인 · 토글하면 정상 · 직전에 장시간 화면 잠금".
         ★ 방 멤버 노드(joinRoom 의 `.info/connected` 감시)는 이미 같은 방식으로 복구하고 있었다.
           패턴이 코드베이스에 있었는데 presence 에만 적용이 안 돼 있던 것이라, 그것을 옮겨왔다.
         · 첫 콜백은 붙자마자 true 로 즉시 온다 → _armPresence 가 한 번 중복 실행된다.
           presence 는 수십 바이트라 그대로 둔다(방 노드와 같은 사정).
         · 재접속마다 onDisconnect 를 다시 거는 것은 부수 이득이다 — payload 의 lastSeen 이
           '앱 켠 시각'에 고정되던 문제(바로 아래 주석)가 재접속 시점으로 갱신된다.
         · room·inRoom 도 함께 복구된다. onDisconnect 가 set 이라 그 둘이 날아가는데,
           예전에는 방 안에 있어도 재접속 뒤 "온라인 · COZY-…" 배지가 사라진 채로 남았다. */
      try{
        onValue(ref(db, '.info/connected'), s=>{ if(s.val() === true) _armPresence(); });
      }catch(_){}
      /* 🕒 lastSeen 을 6시간마다 새로 찍는다.
         [왜] onDisconnect 의 payload 는 **등록 시점에 고정**된다. 즉 앱을 끄면 '앱을 켠 시각'이
           lastSeen 으로 남고, 켜 두는 동안에는 아무도 갱신하지 않는다.
           그러면 앱을 8일 내리 켜 둔 사람의 lastSeen 이 8일 전이 되어, 매일 쓰는 사람인데도
           시크릿룸 발급 판정(app.js SR_STALE_DAYS=7)에서 '버려진 계정'으로 보인다(예전엔 친추 코드 되찾기도 —
           개정 56 에서 걷었다).
         ⚠️ 주기를 짧게 잡을 이유가 없다. 이 값은 '며칠 단위'로만 쓰이므로 6시간이면 충분하고,
           유저당 하루 4번의 아주 작은 쓰기로 끝난다. */
      try{
        setInterval(()=>{
          if(!_myPresenceRef) return;
          try{ update(_myPresenceRef, _appVer.withVer({ lastSeen: Date.now() })); }catch(_){}
        }, 6 * 60 * 60 * 1000);
      }catch(_){}
    },
    /* 🔒 온라인 고정 — presencePref/{uid} = { lock, online, ts }(본인만 · users/* 밖 — 친구가 «숨긴 오프라인» 을 못 알아보게). 읽기: 비어 있으면 {} · 못 읽으면 null */
    async loadPresencePref(userId){
      if(!userId) return null;
      await _whenAuthReady();
      try{ return (await get(ref(db, `presencePref/${userId}`))).val() || {}; }catch(_){ return null; }
    },
    async savePresencePref(userId, p){
      await _whenAuthReady();
      return set(ref(db, `presencePref/${userId}`), { lock: p.lock === true, online: p.online !== false, ts: serverTimestamp() });
    },
    // 온라인 표시 수동 토글 — false면 친구 목록에서 오프라인으로 보임(앱은 계속 실행됨).
    setMyPresenceState(userId, online){
      _presenceOnline = !!online;
      if(!_myPresenceRef){
        _myPresenceRef = ref(db, `users/${userId}/presence`);
        onDisconnect(_myPresenceRef).set(_appVer.withVer({ online:false, lastSeen: Date.now() }));
      }
      _presenceWritten = true;
      return set(_myPresenceRef, _appVer.withVer({ online: _presenceOnline, lastSeen: Date.now(), room: _presenceOnline ? _presenceRoom : null, inRoom: _presenceOnline ? _presenceInRoom : false }));
    },
    /* ═══════════ 📱 태블릿·폰 포커싱 연결 (개정 74 · handoff-2026-09-18 §4) ═══════════
       mobileKeys/{uid}       = "<키>"                 읽기 금지 · PC 만 쓴다(규칙)
       mobileLink/{uid}/live  = { at }                 PC 가 켜져 있다는 표시 · onDisconnect remove
       mobileLink/{uid}/state = { on, app, ts, key }   폰이 REST 로 쓴다(key 일치 + live 존재일 때만 · 규칙)
       ⚠️ presence 를 «PC 켜짐» 으로 쓰지 않는다 — «오프라인으로 보이기» 가 online:false 를 써서 폰 연결까지 끊긴다.
       ★ 키가 없는 사람(연결 안 한 사람)에게는 이 통로가 **한 번도 안 불린다** — 읽기·쓰기 0.
       onDiag(ev) — 진단 줄(mobile-diag.js)에만: { kind:'reset', v } 부팅 초기화로 내린 원래 값 · { kind:'live', has } PC 켜짐 표시(다른 PC 가 꺼지며 지우면 폰 신호가 거절된다) */
    async mobileLinkStart(userId, cb, onDiag){
      if(!userId || typeof cb !== 'function' || !onDiag) return null;
      await _whenAuthReady();
      if(_mobLive && _mobLive.uid === userId) return _mobLive.stop;
      if(_mobLive) _mobLive.stop();
      const liveRef  = ref(db, `mobileLink/${userId}/live`);
      const stateRef = ref(db, `mobileLink/${userId}/state`);
      const arm = ()=>{
        try{ onDisconnect(liveRef).remove(); }catch(_){}
        set(liveRef, { at: serverTimestamp() }).catch(e=>console.warn('[📱] live 쓰기 실패', e && e.code));
      };
      arm();
      /* 부팅 초기화 — 어제 «닫힘» 이 빠진 채 남은 «켜짐» 이 오늘 시간을 쌓지 않게. on 만 내린다(앱 이름·key 는 둔다). */
      const diag = (ev)=>{ try{ onDiag(ev); }catch(_){} }; try{ const s = (await get(stateRef)).val(); if(s && s.on === true){ await update(stateRef, { on:false }); diag({ kind:'reset', v:s }); } }catch(_){}
      const connRef = ref(db, '.info/connected');
      const onConn = s=>{ if(s.val() === true) arm(); };
      try{ onValue(connRef, onConn); }catch(_){}
      const onState = s=>{ try{ cb(s.val() || null); }catch(_){} };
      onValue(stateRef, onState, e=>{ console.warn('[📱] 구독 실패', e && e.code); try{ cb(null); }catch(_){} });
      const onLive = s=>diag({ kind:'live', has: s.exists() }); onValue(liveRef, onLive, ()=>{});   // 보이기만 · 다시 걸지는 않는다
      const stop = ()=>{
        try{ off(connRef, 'value', onConn); }catch(_){}
        try{ off(stateRef, 'value', onState); }catch(_){}
        try{ off(liveRef, 'value', onLive); }catch(_){}
        try{ onDisconnect(liveRef).cancel(); }catch(_){}
        try{ remove(liveRef); }catch(_){}
        if(_mobLive && _mobLive.stop === stop) _mobLive = null;
      };
      _mobLive = { uid:userId, stop };
      return stop;
    },
    /* 키를 새로 적는다 — 예전 폰은 여기서 끊긴다. 남은 state 도 지운다(예전 폰의 «켜짐» 이 남지 않게). */
    async mobileSetKey(userId, key){
      if(!userId || typeof key !== 'string' || key.length < 16 || key.length > 32) return false;
      await _whenAuthReady();
      try{
        await set(ref(db, `mobileKeys/${userId}`), key);
        try{ await remove(ref(db, `mobileLink/${userId}/state`)); }catch(_){}
        return true;
      }catch(e){ console.warn('[📱] 키 저장 실패', e && e.code); return false; }
    },
    /* 연결 끊기 — 키 · live · state 를 전부 걷는다. */
    async mobileUnlink(userId){
      if(!userId) return false;
      await _whenAuthReady();
      if(_mobLive) _mobLive.stop();
      let ok = true;
      try{ await remove(ref(db, `mobileLink/${userId}`)); }catch(_){ ok = false; }
      try{ await remove(ref(db, `mobileKeys/${userId}`)); }catch(_){ ok = false; }
      return ok;
    },
    /* ═══════════ 📅 스케줄러 ═══════════
       users/{uid}/schedule/{YYYY-MM}/{DD}/{id} = { text, public, tags, ts }
       users/{uid}/ddays/{id}                   = { text, date:'YYYY-MM-DD', public, ts }
       users/{uid}/schedNotices/{id}            = { fromId, fromName, text, date, ts }
       공개 여부: 기본 비공개(public=false). 친구를 태그하면 그 친구에게 알림이 감. */

    // 한 달치 일정을 통째로 읽음 — 달력 한 화면 = 읽기 1회
    async getScheduleMonth(userId, ym){
      const snap = await get(ref(db, `users/${userId}/schedule/${ym}`));
      return snap.val() || {};
    },
    // 실시간 구독 (내 달력용)
    subscribeScheduleMonth(userId, ym, onChange){
      const r = ref(db, `users/${userId}/schedule/${ym}`);
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    async addScheduleItem(userId, ym, dd, item){
      /* 🩹 [2026-10-02 제보 #6] «잘 쓰다가 어느 순간부터 일정 등록이 안 된다»
         소유권이 걸린 쓰기(users/{코드}/schedule)인데 로그인 복원 대기선을 안 지나고 있었다 — 구글에 묶인 계정은
         부팅 직후 토큰 없이 나간 쓰기가 permission_denied 로 떨어진다(위 auth barrier 주석). saveMyHome 이 같은
         함정을 먼저 고친 자리다. 거부 사유 구분·안내는 app.js doAddSched 가 한다. */
      await _whenAuthReady();
      const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      await set(ref(db, `users/${userId}/schedule/${ym}/${dd}/${id}`), {
        text: String(item.text||'').slice(0,40),
        public: !!item.public,
        ts: Date.now(),
      });
      return id;
    },
    async removeScheduleItem(userId, ym, dd, id){
      await remove(ref(db, `users/${userId}/schedule/${ym}/${dd}/${id}`));
    },
    async setScheduleItemPublic(userId, ym, dd, id, isPublic){
      await update(ref(db, `users/${userId}/schedule/${ym}/${dd}/${id}`), { public: !!isPublic });
    },

    // ── D-day (기념일 카운트다운) ──
    subscribeDdays(userId, onChange){
      const r = ref(db, `users/${userId}/ddays`);
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // D-day 카드 저장 (신규/수정 겸용). bgImg는 dataURL이면 Storage로 올려 URL만 저장.
    async saveDday(userId, id, dd){
      await _whenAuthReady();   // 🩹 #6 — 일정과 같은 함정(users/{코드}/ddays 도 소유권 쓰기다)
      const did = id || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2,6));
      let bgImg = dd.bgImg || null;
      if(bgImg) bgImg = await _uploadDataUrlIfNeeded(`users/${userId}/dday_${did}.jpg`, bgImg);
      await set(ref(db, `users/${userId}/ddays/${did}`), {
        kind:   dd.kind === 'dday' ? 'dday' : 'anniv',   // 'anniv'=기념일 카드(정사각) | 'dday'=배너
        text:   String(dd.text||'').slice(0,20),
        date:   String(dd.date||''),          // 'YYYY-MM-DD'
        public: !!dd.public,
        notify: !!dd.notify,                  // 알림 체크 — 다가오면 🔔에 표시
        /* 📌 한국식 셈법(그날이 1일). ⚠️ 없는 값을 undefined 로 흘리면 set 이 이 칸을 통째로
           빼먹고, 읽는 쪽(_ddayBase1)은 «필드 없음»을 켜진 것으로 본다 — 배너까지 켜진다. */
        base1: !!dd.base1,
        bgColor: dd.bgColor || null,          // 카드 배경색
        bgImg:  bgImg || null,                // 카드 배경 이미지 URL
        order:  (typeof dd.order === 'number') ? dd.order : null,   // 드래그로 정한 표시 순서
        ts: dd.ts || Date.now(),
      });
      return did;
    },
    async removeDday(userId, id){
      await remove(ref(db, `users/${userId}/ddays/${id}`));
      try{ await _tryDeleteStorage(`users/${userId}/dday_${id}.jpg`); }catch(_){}
    },
    // 카드 순서 저장 (드래그로 바꾼 결과) — { id: order } 를 한 번에 반영
    async setDdayOrder(userId, orderMap){
      const updates = {};
      Object.keys(orderMap||{}).forEach(id=>{
        updates[`users/${userId}/ddays/${id}/order`] = orderMap[id];
      });
      if(Object.keys(updates).length) await update(ref(db), updates);
    },

    // ── 🔔 친구 태그 알림 ──
    // 일정에 태그된 친구들에게 알림을 보냄 (각자의 schedNotices에 기록)
    async sendScheduleNotices(fromId, fromName, toIds, text, date){
      const now = Date.now();
      const updates = {};
      (toIds||[]).forEach(toId=>{
        const nid = 'n' + now.toString(36) + Math.random().toString(36).slice(2,6);
        updates[`users/${toId}/schedNotices/${nid}`] = {
          fromId, fromName: fromName||'(이름 없음)',
          text: String(text||'').slice(0,40),
          date: String(date||''), ts: now,
        };
      });
      if(Object.keys(updates).length) await update(ref(db), updates);
      return { ok:true };
    },
    subscribeSchedNotices(userId, onChange){
      const r = ref(db, `users/${userId}/schedNotices`);
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    async removeSchedNotice(userId, id){
      await remove(ref(db, `users/${userId}/schedNotices/${id}`));
    },

    /* 범용 이미지 업로드 — 디자인 스튜디오 등에서 파일로 고른 이미지를 Storage에 올리고 URL을 받음.
       slot: 'bg' | 'panel_xxx' 등 용도별 키. 같은 slot에 다시 올리면 덮어씀(용량 누적 방지). */
    // 🏊 방 입장용 얼굴/눈감기 PNG를 Storage에 올리고 URL 반환 — 방 payload 다이어트(가) 단계.
    //   예전엔 512 PNG dataURL이 rooms/{code}/{member}/def에 통째로 들어가 모든 참여자가 매번 내려받았음.
    //   Storage는 캐시 헤더(1년)가 붙어 있어 같은 얼굴은 두 번째부터 다운로드가 발생하지 않음.
    // 🖼 투명 PNG 범용 업로드 — 알파가 살아야 하는 이미지(미스테리au 스탠딩 등).
    //   uploadUserImage는 .jpg로 저장해서 투명이 검게 죽는다. 투명이 필요하면 이쪽을 쓸 것.
    async uploadUserPng(userId, key, dataUrl){
      if(!dataUrl || !dataUrl.startsWith('data:')) return { ok:false, reason:'이미지가 아니에요' };
      const safeKey = String(key||'img').replace(/[^a-zA-Z0-9_-]/g, '');
      const url = await _uploadDataUrlIfNeeded(`users/${userId}/img_${safeKey}.png`, dataUrl);
      if(!url || url.startsWith('data:')) return { ok:false, reason:'업로드에 실패했어요' };
      return { ok:true, url };
    },
    async uploadRoomFace(userId, key, dataUrl){
      if(!dataUrl || !dataUrl.startsWith('data:')) return { ok:false };
      const safeKey = String(key||'face').replace(/[^a-zA-Z0-9_-]/g, '');
      const path = `users/${userId}/roomface_${safeKey}.png`;
      const have = await _existingUrlIfHashed(path);
      if(have) return { ok:true, url: have };
      const url = await _uploadDataUrlIfNeeded(path, dataUrl);
      if(!url || url.startsWith('data:')) return { ok:false };
      return { ok:true, url };
    },
    async uploadUserImage(userId, slot, dataUrl){
      if(!dataUrl || !dataUrl.startsWith('data:')) return { ok:false, reason:'이미지가 아니에요' };
      const safeSlot = String(slot||'img').replace(/[^a-zA-Z0-9_-]/g, '');
      const url = await _uploadDataUrlIfNeeded(`users/${userId}/design_${safeSlot}.jpg`, dataUrl);
      if(url && url.startsWith('data:')) return { ok:false, reason:'업로드에 실패했어요' };   // 업로드 실패 시 원본이 돌아옴
      return { ok:true, url };
    },

    /* ===== 🧸 말랑이 (마이홈 시메지) =====
       users/{uid}/mallang = { imgs:[url,...] }  (최대 4개, 투명 PNG) */
    // 말랑이 이미지 PNG로 업로드 (투명도 유지)
    async uploadMallangImage(userId, slot, dataUrl){
      if(!dataUrl || !dataUrl.startsWith('data:')) return { ok:false, reason:'이미지가 아니에요' };
      const safeSlot = String(slot||'0').replace(/[^a-zA-Z0-9_-]/g, '');
      const url = await _uploadDataUrlIfNeeded(`users/${userId}/mallang_${safeSlot}.png`, dataUrl);
      if(url && url.startsWith('data:')) return { ok:false, reason:'업로드에 실패했어요' };
      return { ok:true, url };
    },
    // 말랑이 이미지 URL 목록 저장
    async saveMallangImgs(userId, imgs){
      try{ await set(ref(db, `users/${userId}/mallang`), { imgs: (imgs||[]).slice(0,4) }); return { ok:true }; }
      catch(e){ return { ok:false }; }
    },
    // 말랑이 이미지 URL 목록 조회 (내 것 또는 방문한 친구 것)
    /* ===== 📚 마이홈 북마크 책장 (2026-09-23 · 개정 61 · 계정 연동) =====
       bookmarks/{uid} = { order:"id,id,…", items:{ id:{url,title,w,h,color,img?,at} }, ts }
       ★ users/{uid} 아래가 아니다 — 그 자리는 `.read: true` 라 **방문자 읽기를 규칙으로 막을 수 없다.**
         책장은 주인만 보는 것이라 최상위에 따로 두고 읽기·쓰기를 주인(+로그인)으로 묶었다.
       ★ order 는 **쉼표로 이은 문자열** 한 줄이다. 배열로 두면 규칙에서 한 칸씩 검사할 길이 마땅치 않고,
         선반 번호는 저장하지 않으므로(서랍 너비로 매번 계산) 순서만 있으면 된다.
       ★ 책등 그림은 Storage `bookmarks/{uid}/{bid}.webp` — 자리비움 그림과 같은 모양(200KB · 이미지만 · 삭제 허용). */
    async getBookmarks(userId){
      try{ const v=(await get(ref(db, `bookmarks/${userId}`))).val(); return { ok:true, data:(v && typeof v==='object') ? v : null }; }
      catch(e){ return { ok:false, data:null }; }
    },
    /* 📚 공개 책장 — **따로 둔 노드**다(bookmarksPub/{uid}). 규칙은 «읽기»를 노드 단위로만 막을 수 있어서,
       한 노드에 공개·비공개를 같이 두면 방문자가 비공개 책까지 받아 간다(화면에서 가리는 것은 방어가 아니다).
       그래서 공개로 표시한 책만 이 노드에 **복사**해 둔다. 주인만 쓰고, 읽기는 열려 있다. */
    async getPublicBookmarks(userId){
      try{ const v=(await get(ref(db, `bookmarksPub/${userId}`))).val(); return { ok:true, data:(v && typeof v==='object') ? v : null }; }
      catch(e){ return { ok:false, data:null }; }
    },
    async savePublicBookmarks(userId, data){
      try{
        if(data) await set(ref(db, `bookmarksPub/${userId}`), data);
        else await remove(ref(db, `bookmarksPub/${userId}`));
        return { ok:true };
      }catch(e){ console.warn('[bookmark] 공개 책장 저장 실패', e); return { ok:false }; }
    },
    async saveBookmarks(userId, data){
      try{ await set(ref(db, `bookmarks/${userId}`), data); return { ok:true }; }
      catch(e){ console.warn('[bookmark] 저장 실패', e); return { ok:false }; }
    },
    async uploadBookmarkImg(userId, bid, dataUrl){
      if(!userId || !bid || !dataUrl || !String(dataUrl).startsWith('data:image/')) return { ok:false, reason:'이미지가 아니에요' };
      try{
        const safe = String(bid).replace(/[^a-zA-Z0-9_-]/g, '');
        const r = sref(storage, `bookmarks/${userId}/${safe}_${Date.now()}.webp`);
        await uploadString(r, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE, contentType: 'image/webp' });
        return { ok:true, url: await getDownloadURL(r) };
      }catch(e){ console.warn('[bookmark] 그림 업로드 실패', e); return { ok:false, reason:'업로드에 실패했어요' }; }
    },

    async getMallangImgs(userId){
      try{ const s=await get(ref(db, `users/${userId}/mallang`)); const v=s.val(); return (v&&Array.isArray(v.imgs))?v.imgs:[]; }
      catch(e){ return []; }
    },

    /* ===== 🫧 자리비움 그림 (2026-09-23 · handoff-2026-09-21-features §2 · 시안 A 확정) =====
       Storage `away/{uid}/away_{ts}.webp`(규칙: 300KB 미만 · 삭제 허용) → URL 을 users/{uid}/awayImg 한 칸에.
       ★ 파일 이름에 시각을 넣는다 — STORAGE_CACHE(1년) 라 같은 이름으로 덮으면 남들이 옛 그림을 계속 본다.
       ★ dataURL 폴백이 없다 — 올리지 못하면 실패로 끝낸다(RTDB 로 새지 않게 · _uploadDataUrlIfNeeded 를 안 쓴다). */
    async uploadAwayImg(userId, dataUrl){
      if(!userId || !dataUrl || !String(dataUrl).startsWith('data:image/')) return { ok:false, reason:'이미지가 아니에요' };
      try{
        const r = sref(storage, `away/${userId}/away_${Date.now()}.webp`);
        await uploadString(r, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE, contentType: 'image/webp' });
        return { ok:true, url: await getDownloadURL(r) };
      }catch(e){ console.warn('[away] 업로드 실패', e); return { ok:false, reason:'업로드에 실패했어요' }; }
    },
    async setAwayImg(userId, url){
      try{
        if(url) await set(ref(db, `users/${userId}/awayImg`), url);
        else await remove(ref(db, `users/${userId}/awayImg`));
        return { ok:true };
      }catch(e){ console.warn('[away] 저장 실패', e); return { ok:false }; }
    },
    async getAwayImg(userId){
      try{ const v=(await get(ref(db, `users/${userId}/awayImg`))).val(); return { ok:true, url:(typeof v==='string')?v:null }; }
      catch(e){ return { ok:false, url:null }; }
    },
    /* 🫧 [2026-10-02 · A안] 자리비움 그림 **화면 크기**(60·80·100 px) — 그림 주인이 정하고 계정을 따라간다.
       규칙 users/$userId/awaySz 가 세 값만 받는다. 그림 URL 과 칸을 나눈 이유: awayImg 규칙이 «Storage 주소 문자열» 이라
       거기에 숫자를 섞을 수 없고, 관리자 [그림 내리기]가 크기까지 지울 이유도 없다. */
    async setAwaySz(userId, px){
      try{
        if(!userId || [60, 80, 100].indexOf(px) < 0) return { ok:false };
        await set(ref(db, `users/${userId}/awaySz`), px);
        return { ok:true };
      }catch(e){ console.warn('[away] 크기 저장 실패', e); return { ok:false }; }
    },
    async getAwaySz(userId){
      try{ const v=(await get(ref(db, `users/${userId}/awaySz`))).val(); return { ok:true, px:([60, 80, 100].indexOf(v) >= 0) ? v : null }; }
      catch(e){ return { ok:false, px:null }; }
    },
    /* 다운로드 URL 로 Storage 파일을 지운다 — 없거나 거절돼도 조용히(옛 그림 정리용). */
    async deleteStorageUrl(url){
      if(!url || !/^https:\/\/firebasestorage\.googleapis\.com\//.test(url)) return;
      try{ await deleteObject(_stRef(storage, url)); }catch(_){}
    },

    /* ===== 🚩 신고 (2026-09-23 · 시안 확정) =====
       reports/{신고당한 uid}/{신고한 uid} = { kind, note?, nick, code4, ts }
       ★ 한 사람이 같은 사람을 여러 번 신고해도 칸이 하나 — «서로 다른 몇 명» 이 곧 칸 수다.
       ★ 규칙: 신고자 칸은 **로그인한 본인 것만**(userAuth/{신고자} === auth.uid) · 읽기와 비우기는 관리자만. */
    async reportUser(targetId, reporterId, rec){
      if(!targetId || !reporterId || targetId === reporterId) return { ok:false, reason:'self' };
      if(!(auth && auth.currentUser)) return { ok:false, reason:'auth' };
      const v = { kind: String(rec.kind||''), nick: String(rec.nick||'').slice(0,20), code4: String(rec.code4||'').slice(-4), ts: Date.now() };
      if(rec.note) v.note = String(rec.note).slice(0,40);
      try{ await set(ref(db, `reports/${targetId}/${reporterId}`), v); return { ok:true }; }
      catch(e){ console.warn('[report] 실패', e); return { ok:false, reason:'denied' }; }
    },
    /* 관리자 — 전체 신고(대상별 묶음). 규칙상 관리자만 읽힌다. */
    async listReports(){
      try{ const v=(await get(ref(db, 'reports'))).val(); return { ok:true, reports: v || {} }; }
      catch(e){ return { ok:false, reports:{} }; }
    },
    async clearReports(targetId){
      try{ await remove(ref(db, `reports/${targetId}`)); return { ok:true }; }catch(e){ return { ok:false }; }
    },
    /* 관리자 목록 한 줄에 필요한 것만 — 이름 · 친구 코드 · 자리비움 그림. */
    async getUserBrief(userId){
      const out = { name:null, friendCode:null, awayImg:null };
      try{ const p=(await get(ref(db, `users/${userId}/profile/name`))).val(); if(typeof p==='string') out.name=p; }catch(_){}
      try{ const c=(await get(ref(db, `users/${userId}/friendCode`))).val(); if(typeof c==='string') out.friendCode=c; }catch(_){}
      try{ const a=(await get(ref(db, `users/${userId}/awayImg`))).val(); if(typeof a==='string') out.awayImg=a; }catch(_){}
      return out;
    },

    /* ── 🎁 말랑이 선물 ──
       users/{받는사람}/mallangGifts/{giftId} = {imgUrl, fromName, fromId, ts}
       users/{보내는사람}/mallangGiftCount/{YYYY-MM-DD} = 그날 발송 횟수
       ⚠️ 하루 한도의 **숫자는 여기 없다** — mallang.js 의 DAILY_LIMIT 한 곳이다.
         여기 숫자를 같이 적으면 한쪽만 고쳐져 화면과 판정이 갈린다(실제로 5→10 때 그럴 뻔했다). */
    // 하루 발송 횟수 조회
    async getMallangGiftCount(fromId, dateStr){
      try{ const s=await get(ref(db, `users/${fromId}/mallangGiftCount/${dateStr}`)); const v=s.val(); return (typeof v==='number')?v:0; }
      catch(e){ return 0; }
    },
    // 선물 보내기 (하루 한도·상대 마이홈 정원 검사는 호출 측(mallang.js)에서 하고, 여기선 발송 + 카운트 증가)
    //  ★ 보내는 순간 이미지를 '선물 전용 경로'로 복사해서 그 URL을 저장한다.
    //    말랑이 원본은 users/{uid}/mallang_{슬롯}.png 처럼 슬롯 번호 고정 경로라, 나중에 그 슬롯 그림을
    //    바꾸면 같은 경로에 덮어써져서 '이미 보낸 선물의 그림까지 같이 바뀌는' 문제가 있었다.
    //    사본을 두면 원본을 아무리 고쳐도 보낸 선물은 그대로 유지된다.
    async sendMallangGift(fromId, fromName, toId, imgUrl, dateStr, msg){
      try{
        const giftRef = push(ref(db, `users/${toId}/mallangGifts`));
        const giftId = giftRef.key;
        // 이미지 스냅샷 — 원본을 받아 선물 전용 경로로 재업로드. 실패하면 원본 URL로 폴백(전송은 성공시킴).
        let snapUrl = String(imgUrl||'');
        try{
          const res = await fetch(snapUrl);
          const blob = await res.blob();
          /* 404 · 오류 페이지를 그림처럼 다시 올리면 받은 사람 칸이 깨진 그림이 된다 — 그림이 아니면 원본 주소를 그대로 보낸다 */
          if(!res.ok || !blob || !blob.size || !/^image\//.test(blob.type || '')) throw new Error('not image');
          const dataUrl = await new Promise((ok,ng)=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=ng; r.readAsDataURL(blob); });
          const up = await _uploadDataUrlIfNeeded(`users/${toId}/giftimg/${giftId}.png`, dataUrl);
          if(up && !up.startsWith('data:')) snapUrl = up;
        }catch(_){ /* 네트워크·CORS 실패 시 원본 참조 유지 */ }
        const payload = { imgUrl:snapUrl, fromName:String(fromName||'').slice(0,20), fromId:String(fromId||''), ts: Date.now() };
        const m = String(msg||'').trim().slice(0,50);
        if(m) payload.msg = m;   // 💬 함께 보낸 짧은 메시지(최대 50자) — 받은 사람이 말랑이를 클릭하면 말풍선으로 표시
        await set(giftRef, payload);
        // 발송 카운트 +1 (트랜잭션)
        await runTransaction(ref(db, `users/${fromId}/mallangGiftCount/${dateStr}`), c => (typeof c==='number'?c:0)+1);
        return { ok:true };
      }catch(e){ return { ok:false, reason:'선물 전송에 실패했어요' }; }
    },
    // 받은 선물 목록 조회 → { giftId: {imgUrl, fromName, fromId, ts} }
    async getMallangGifts(userId){
      try{ const s=await get(ref(db, `users/${userId}/mallangGifts`)); return s.val() || {}; }
      catch(e){ return {}; }
    },
    // 선물 하나 삭제 (보관 한도 초과분 정리 등) — Storage 사본도 같이 지워서 용량이 쌓이지 않게 함
    async deleteMallangGift(userId, giftId){
      try{
        await remove(ref(db, `users/${userId}/mallangGifts/${giftId}`));
        // 스냅샷 사본 제거. 예전 선물(원본 참조)은 이 경로에 파일이 없으므로 조용히 무시된다.
        try{ await deleteObject(sref(storage, `users/${userId}/giftimg/${giftId}.png`)); }catch(_){}
        return { ok:true };
      }catch(e){ return { ok:false }; }
    },
    /* 🎁 선물 '치움' 상태를 서버에 기록 — 방문자 화면에서도 안 보이게 하기 위함.
       ★ 불리언 하나(수십 바이트)라 서버 비용 영향은 사실상 없다. 구버전 클라이언트는 이 필드를 몰라
         그냥 전부 표시하므로 안전하게 폴백된다. */
    async setMallangGiftHidden(userId, giftId, hidden){
      try{ await set(ref(db, `users/${userId}/mallangGifts/${giftId}/hidden`), !!hidden); return { ok:true }; }
      catch(e){ return { ok:false }; }
    },
    /* ⭐ 선물 즐겨찾기 — 서버에 둔다(로컬이면 다른 기기의 자동 정리가 모르고 지운다).
       끌 때는 칸을 지워 구버전과 같은 모양으로 되돌린다. */
    async setMallangGiftStarred(userId, giftId, on){
      try{ await set(ref(db, `users/${userId}/mallangGifts/${giftId}/starred`), on ? true : null); return { ok:true }; }
      catch(e){ return { ok:false }; }
    },
    // 안 읽은 선물 뱃지용 — 마지막 확인 시각 저장/조회
    async getMallangGiftSeen(userId){
      try{ const s=await get(ref(db, `users/${userId}/mallangGiftSeen`)); const v=s.val(); return (typeof v==='number')?v:0; }
      catch(e){ return 0; }
    },
    async setMallangGiftSeen(userId, ts){
      try{ await set(ref(db, `users/${userId}/mallangGiftSeen`), ts||Date.now()); }catch(e){}
    },
    subscribeBugReport(onChange){
      onValue(ref(db, 'bugReport/current'), snap => onChange(snap.val() || null));
    },
    async setBugReport(notice, link){
      await set(ref(db, 'bugReport/current'), {
        notice: String(notice||'').slice(0,600),
        link:   String(link||'').slice(0,300),
        ts: Date.now(),
      });
      return { ok:true };
    },

    /* ═══════════ 👋 친구 요청 (수락/거절) ═══════════
       스키마: friendRequests/{받는사람}/{보낸사람} = { name, ts }
       흐름: 코드 입력 → 상대에게 요청 기록 → 상대가 수락하면 그때 양방향 friends 추가 */

    // 친구 요청 보내기
    /* toName·toCode 는 **보낸 요청 목록에 보여줄 이름표**다(없어도 동작한다).
       스키마상 상대 프로필을 나중에 다시 못 찾는 게 아니라, 목록을 열 때마다 상대 프로필을
       또 읽지 않으려고 보낼 때 한 번 적어두는 것이다. */
    async sendFriendRequest(fromId, toId, fromName, toName, toCode){
      console.log('[친구요청 발송] fromId=', fromId, 'toId=', toId, 'name=', fromName);
      if(fromId === toId){ console.log('[친구요청] 실패: self'); return { ok:false, reason:'self' }; }
      const already = await get(ref(db, `users/${fromId}/friends/${toId}`));
      if(already.exists()){ console.log('[친구요청] 실패: 이미 친구'); return { ok:false, reason:'already' }; }
      /* 📤 진짜 요청과 **내 쪽 미러**를 한 번에 쓴다.
         스키마가 friendRequests/{받는사람}/{보낸사람} 이라 "내가 보낸 것"을 서버에서 못 찾는다.
         그래서 sentFriendRequests/{나}/{상대} 에 같은 사실을 한 벌 더 적어 목록을 만든다.
         ⚠️ update() 한 번으로 **둘 다 되거나 둘 다 안 되게** 한다. 나눠 쓰면 미러만 남거나
           요청만 남는 반쪽 상태가 생기고, 그건 화면에서 구분이 안 된다. */
      const now = Date.now();
      const mirror = { ts: now };
      if(toName) mirror.toName = String(toName).slice(0,20);
      if(toCode) mirror.toCode = String(toCode).slice(0,12);
      try{
        await update(ref(db), {
          [`friendRequests/${toId}/${fromId}`]: { name: fromName || '(이름 없음)', ts: now },
          [`sentFriendRequests/${fromId}/${toId}`]: mirror,
        });
        console.log('[친구요청] 서버 저장 성공: friendRequests/'+toId+'/'+fromId+' (+미러)');
      }catch(e){
        console.error('[친구요청] 서버 저장 실패:', e);
        return { ok:false, reason:'save_failed' };
      }
      return { ok:true };
    },

    /* 📤 내가 보낸 요청 목록 → { [상대id]: {ts, toName?, toCode?} }
       ⚠️ **이 목록만 믿으면 안 된다.** 상대가 구버전으로 수락하면 진짜 요청은 사라지는데
         미러는 남는다(그쪽 코드에 미러를 지우는 줄이 없으므로). 그래서 호출 측이
         isFriendRequestAlive() 로 한 건씩 확인하고, 죽은 것은 pruneSentFriendRequest() 로 치운다. */
    async getSentFriendRequests(myId){
      try{ const s = await get(ref(db, `sentFriendRequests/${myId}`)); return s.val() || {}; }
      catch(e){ return {}; }
    },
    /* 그 요청이 상대 쪽에 아직 살아 있는가 — friendRequests/$toId 는 .read 가 열려 있어 읽을 수 있다.
       한 건짜리 get 이라 목록을 열 때만 몇 번 도는 비용이다(구독이 아니다). */
    async isFriendRequestAlive(toId, myId){
      try{ const s = await get(ref(db, `friendRequests/${toId}/${myId}`)); return s.exists(); }
      catch(e){ return true; }   // 못 읽었으면 살아 있다고 본다 — 멀쩡한 요청을 지우는 쪽이 더 나쁘다
    },
    // 죽은 미러 한 줄 치우기 (자가 치유 — 화면에서 사라지는 것과 별개로 서버도 정리한다)
    async pruneSentFriendRequest(myId, toId){
      try{ await remove(ref(db, `sentFriendRequests/${myId}/${toId}`)); }catch(_){}
    },
    /* 📤 보낸 요청 취소 — 진짜 요청과 미러를 한 번에 지운다.
       ⚠️ friendRequests/{상대}/{나} 는 **남의 노드**지만 $fromId 에 .write:true 가 있어 지울 수 있고,
         RTDB 는 지우는 쓰기에 .validate 를 아예 평가하지 않는다(그래서 hasChildren 이 안 막는다). */
    async cancelFriendRequest(myId, toId){
      try{
        await update(ref(db), {
          [`friendRequests/${toId}/${myId}`]: null,
          [`sentFriendRequests/${myId}/${toId}`]: null,
        });
        return { ok:true };
      }catch(e){ return { ok:false }; }
    },
    // 나에게 온 친구 요청 실시간 구독 → onChange({ [fromId]: {name, ts} })
    // 🚪 방 초대 — 친구에게 현재 방으로 초대장 보내기 { roomCode, fromName, ts }
    async sendRoomInvite(toId, fromId, roomCode, fromName){
      if(!toId || !roomCode) return { ok:false };
      await set(ref(db, `roomInvites/${toId}/${fromId}`), {
        roomCode, fromName: fromName || '(이름 없음)', ts: Date.now()
      });
      return { ok:true };
    },
    subscribeRoomInvites(myId, onChange){
      const r = ref(db, `roomInvites/${myId}`);
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    async clearRoomInvite(myId, fromId){
      try{ await remove(ref(db, `roomInvites/${myId}/${fromId}`)); }catch(_){}
    },
    subscribeFriendRequests(myId, onChange){
      console.log('[친구요청 구독 시작] myId=', myId);
      const reqRef = ref(db, `friendRequests/${myId}`);
      const unsub = onValue(reqRef, snap => {
        const v = snap.val() || {};
        console.log('[친구요청 수신] 개수=', Object.keys(v).length, v);
        onChange(v);
      });
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // 요청 수락 → 양방향 friends 추가 + 요청 삭제 (한 번에 처리해서 중간 상태가 안 생기게)
    async acceptFriendRequest(myId, fromId){
      const now = Date.now();
      await update(ref(db), {
        [`users/${myId}/friends/${fromId}`]: { addedAt: now },
        [`users/${fromId}/friends/${myId}`]: { addedAt: now },
        [`friendRequests/${myId}/${fromId}`]: null,
        // 📤 보낸 쪽 미러도 같이 치운다 — 안 지우면 상대 화면에 '기다리는 중'이 영영 남는다
        [`sentFriendRequests/${fromId}/${myId}`]: null,
      });
      return { ok:true };
    },
    // 요청 거절 → 요청만 삭제 (상대에겐 따로 알리지 않음). 미러는 여기서도 같이 치운다.
    async rejectFriendRequest(myId, fromId){
      await update(ref(db), {
        [`friendRequests/${myId}/${fromId}`]: null,
        [`sentFriendRequests/${fromId}/${myId}`]: null,
      });
      return { ok:true };
    },

    // 양방향 친구 추가 — 코드로 찾은 상대 userId를 서로의 friends 목록에 동시에 기록(승인 절차 없음, 방 코드와 같은 방식).
    async addFriendMutual(myId, friendId){
      if(myId===friendId) return { ok:false, reason:'self' };
      const now = Date.now();
      await update(ref(db), {
        [`users/${myId}/friends/${friendId}`]: { addedAt: now },
        [`users/${friendId}/friends/${myId}`]: { addedAt: now },
      });
      return { ok:true };
    },
    async removeFriend(myId, friendId){
      await update(ref(db), {
        [`users/${myId}/friends/${friendId}`]: null,
        [`users/${friendId}/friends/${myId}`]: null,
      });
    },
    // 내 친구 목록 한 번 읽기 — users/{나}/friends 만({친구id: {addedAt}}). 판정용 · 부르는 곳은 friends-sub.js 한 곳(중복 조회 방지).
    async getMyFriendList(myId){
      const snap = await get(ref(db, `users/${myId}/friends`));
      return snap.val() || {};
    },
    /* 내 친구 목록 실시간 구독 — users/{나}/friends 하나만({친구id:{addedAt}}). 실시간은 추가 · 삭제뿐이다:
       이름 · 레벨 · 소개 · 사진은 목록을 열 때 한 번(getFriendCard · 서버 먼저 — friends/friends-port.js), 접속 상태 · 프로필은 목록이 열려 있는 동안만(watchFriendPresence · watchFriendProfile).
       onError(err) — 거부 · 끊기면 한 번(다시 걸기는 부르는 쪽 · friends-sub.js). @return 해제 함수. ⚠️ 동시에 하나만 — 새로 걸면 앞의 것을 먼저 푼다. */
    watchMyFriendList(myId, onChange, onError){
      if(_myFriendsOff) _myFriendsOff();
      let _dead = false, _listOff = null;
      const teardown = ()=>{
        if(_dead) return;
        _dead = true;
        if(_listOff){ try{ _listOff(); }catch(_){} }
        if(_myFriendsOff === teardown) _myFriendsOff = null;
      };
      _myFriendsOff = teardown;
      _listOff = onValue(ref(db, `users/${myId}/friends`), snap=>{
        if(_dead) return;
        onChange(snap.val() || {});
      }, err=>{
        teardown();
        console.warn('[친구 목록] 구독이 끊겼어요', err);
        if(onError) onError(err);
      });
      if(_dead && _listOff){ try{ _listOff(); }catch(_){} }   // onValue 가 돌아오기 전에 실패가 왔으면 지금 푼다
      return teardown;
    },
    /* 친구 한 명의 이름 · 레벨 · 소개 · 사진 한 번 읽기 → 날것 { profile, bio, avatar }(거르기는 friends-firebase.js cardOf) · 💰 home 통째가 아니라 bio · avatar 두 칸만 */
    async getFriendCard(fid){
      const [p, b, a] = await Promise.all([`users/${fid}/profile`, `users/${fid}/home/bio`, `users/${fid}/home/avatar`].map(path => get(ref(db, path))));
      return { profile: p.val(), bio: b.val(), avatar: a.val() };
    },
    /* 친구 한 명의 접속 상태(presence) 구독 → onChange(날것). 목록(친구 탭 · 초대 목록)이 열려 있는 동안만 건다(friends-sub.js). @return 해제 함수 */
    watchFriendPresence(fid, onChange){
      const presRef = ref(db, `users/${fid}/presence`);   // 읽기만 — 쓰기는 _myPresenceRef 한 곳(sim-app-version)
      const off = onValue(presRef, snap=>onChange(snap.val()));
      return ()=>{ try{ off(); }catch(_){} };
    },
    /* 친구 한 명의 프로필(이름 · 레벨 · 회차) — 구독은 접속 상태와 같이 목록이 열려 있는 동안만(friends-sub.js · @return 해제 함수), 한 번 읽기는 목록이 닫혀 있을 때 마이홈 구경.
       💰 규칙상 작은 칸 여섯뿐(name ≤20자 · level · cyc · clv · starC · updatedAt)이고 쓰기는 켤 때 · 이름 · 레벨이 바뀔 때만이다. */
    watchFriendProfile(fid, onChange){ const off = onValue(ref(db, `users/${fid}/profile`), snap=>onChange(snap.val())); return ()=>{ try{ off(); }catch(_){} }; },
    async getFriendProfile(fid){ return (await get(ref(db, `users/${fid}/profile`))).val(); },
    /* 친구 한 명의 접속 상태 한 번 읽기 — 목록이 닫혀 있을 때 필요한 곳(놀러 가기 · 파도타기 친구 고르기)만 */
    async getFriendPresence(fid){ return (await get(ref(db, `users/${fid}/presence`))).val(); },
    // ===== 마이홈 페이지(프로필사진/소개글/게시글/스티커) =====
    async getMyHome(userId){
      const snap = await get(ref(db, `users/${userId}/home`));
      return snap.val() || {};
    },
    /* 🏠 마이홈 저장 상한 — **규칙 파일(users/$userId/home 의 .validate)과 짝이다.**
       ⚠️ 한쪽만 고치면 그 차이 구간이 «클라이언트는 통과, 서버는 거부» 가 되어
         사용자에게는 원인 없는 실패로만 보인다(채팅 글자수에서 실제로 겪은 그 사고다).
       ★ 여기 없는 필드(stickers · bg)는 규칙에도 크기 검사가 없다 — 스티커 용량은 거부 사유가 아니다. */
    _myHomeLimits(){ return { bio:4000, post:20000, postTitle:60, avatar:200000 }; },
    async saveMyHome(userId, homeData){
      /* 🚧 세션 복원을 기다린다 — setMyProfile 693줄과 **같은 이유, 같은 함정**이다.
         getAuth() 는 즉시 돌아오지만 저장된 세션을 되읽는 일은 비동기라, 그 사이 나가는 쓰기에는
         토큰이 안 붙는다. 구글에 묶인 계정(userAuth 가 있는 계정)은 그때 permission_denied 를 받는다.
         ⚠️ 여기가 빠져 있었다. 창을 열자마자 저장하는 사람에게만 나서 재현이 어렵고,
           증상은 아래 _fail 이 «로그인이 풀렸다»로 이름 붙이는 것과 똑같이 보인다.
         ★ 이미 정착했으면 비용은 마이크로태스크 한 번이다. 타임아웃(8초)이 있어 영영 안 걸린다. */
      await _whenAuthReady();
      // ★ Storage Phase 2 — avatar / bg.img / stickers[*].img를 Storage로 올리고 URL만 DB에 저장.
      //   기존에 base64로 저장돼 있던 데이터도 다음 저장 때 자동으로 이관됨.
      const out = JSON.parse(JSON.stringify(homeData || {}));
      const failedUploads = [];
      const swaps = [];   // 올린 자리 → URL — 부르는 쪽이 들고 있는 데이터도 바꿔 다음 저장 때 같은 그림을 다시 올리지 않게
      const up = async (label, path, val, at)=>{
        const r = await _uploadDataUrlIfNeeded(path, val);
        if(typeof val === 'string' && val.startsWith('data:') && typeof r === 'string' && !r.startsWith('data:')) swaps.push({ path: at, from: val, url: r });
        /* ⚠️ _uploadDataUrlIfNeeded 는 실패하면 **원본 dataURL 을 그대로 돌려준다.**
           예전에는 그게 조용히 DB 로 흘러들어가, 수백 KB 짜리 문자열이 그대로 쓰기에 실려 갔다.
           그 실패를 여기서 붙잡아 두면 «사진이 안 올라갔다»고 정확히 말할 수 있다. */
        if(typeof r === 'string' && r.startsWith('data:')) failedUploads.push(label);
        return r;
      };
      if(out.avatar)          out.avatar  = await up('프로필 사진', `users/${userId}/avatar.jpg`, out.avatar, ['avatar']);
      if(out.bg && out.bg.img) out.bg.img = await up('배경 사진',   `users/${userId}/bg.jpg`,     out.bg.img, ['bg', 'img']);
      if(out.stickers){
        for(const sid of Object.keys(out.stickers)){
          const st = out.stickers[sid];
          if(st && st.img) st.img = await up('스티커', `users/${userId}/sticker_${sid}.png`, st.img, ['stickers', sid, 'img']);
        }
      }
      /* ⚠️ 업로드가 실패했다고 **저장 전체를 막지 않는다.**
         [왜] 규칙이 크기를 보는 것은 avatar 뿐이다. 스티커·배경은 업로드가 실패해도 dataURL 인 채로
           저장되고 **화면에서는 정상 동작한다** — 지금까지 그렇게 돌아왔다. 여기서 막아 버리면
           스티커 하나가 안 올라가는 사람은 소개글 한 줄도 못 고치게 된다. 원래보다 나빠진다.
         ★ 대신 남긴다: 그런 상태는 그 홈을 여는 모든 사람이 그 덩어리를 매번 내려받는다는 뜻이라
           조용히 둘 일이 아니다. 성공해도 경고를 함께 돌려준다.
         ★ avatar 만은 다르다 — dataURL 이 200,000자를 넘으면 규칙이 **반드시** 거부한다.
           그건 아래 상한 검사가 이름을 붙여 잡는다. */
      const uploadWarn = failedUploads.length
        ? ('사진 일부를 서버에 올리지 못했어요 (' + failedUploads.filter((v,i,a)=>a.indexOf(v)===i).join('·') + ') — 저장은 됐지만 연결을 확인해 주세요')
        : null;
      if(uploadWarn) console.warn('[마이홈] ' + uploadWarn);

      /* 🔎 규칙에 걸릴 필드를 **미리** 찾아 이름을 알려준다.
         [경위] 예전에는 실패를 통째로 잡아 "용량이 너무 크면 사진을 다시 등록해보세요" 한 마디만 띄웠다.
           그런데 실제 거부 사유는 넷이다 — 로그인 불일치 · bio · post · avatar. 그중 사진은 하나뿐인데
           문구가 늘 사진을 가리키니, 사용자도 개발자도 멀쩡한 스티커를 지우는 쪽으로 끌려갔다(제보). */
      const L = this._myHomeLimits();
      const over = [];
      const chk = (k, label)=>{ const v = out[k];
        if(typeof v === 'string' && v.length > L[k]) over.push(label + ' ' + v.length + '자(상한 ' + L[k] + ')'); };
      chk('bio', '소개글'); chk('post', '게시글'); chk('postTitle', '게시글 제목'); chk('avatar', '프로필 사진');
      if(over.length){
        console.warn('[마이홈] 상한 초과로 저장 중단 — ' + over.join(' / '));
        return { ok:false, reason:'내용이 너무 길어요 — ' + over.join(' / ') };
      }

      /* 🔑 [제보 2026-09-07] 「저장에 실패한 뒤로 수정도 초기화도 안 된다」 → **재로그인으로 풀렸다.**
         규칙의 .write 는 «이 계정의 주인인가»를 본다(userAuth 대조). 로그인이 풀렸거나 다른 계정으로
         들어와 있으면 내용과 무관하게 전부 거부된다 — **내용을 지워도 낫지 않는 유일한 갈래다.**
         [왜 이름을 갈라야 하나] 예전 문구는 «다른 계정으로 로그인돼 있을 수 있어요» 하나였다.
           그런데 실제로 흔한 쪽은 계정을 바꾼 것이 아니라 **세션이 풀린 것**이고, 그 둘은
           해법이 다르다(전자는 계정 되찾기, 후자는 그냥 재로그인). 한 문구로 뭉치면
           유저는 자기 계정을 의심하며 엉뚱한 곳을 헤맨다 — 「용량」 한 마디로 스티커를 지우게
           만들었던 그 사고와 같은 모양이다.
         ★ 이 대조는 **실패했을 때만** 돈다. 평소 저장에는 읽기가 한 번도 늘지 않는다
           (아래 사진 되돌리기 갈래와 같은 원칙). */
      const _fail = async (code)=>{
        const tail = uploadWarn ? ' [업로드 실패한 사진이 있었어요]' : '';
        if(!/permission|PERMISSION_DENIED/i.test(code)){
          return { ok:false, reason:'저장에 실패했어요 — 잠시 뒤 다시 시도해 주세요' + tail };
        }
        /* 여기서부터 갈래를 가른다. userAuth 는 코드→계정 매핑일 뿐이라 읽기가 열려 있다. */
        let owner = null, mine = null;
        try{ owner = (await get(ref(db, `userAuth/${userId}`))).val(); }catch(_){}
        try{ mine = (auth && auth.currentUser) ? auth.currentUser.uid : null; }catch(_){}
        console.warn('[마이홈] 권한 거부 — userAuth=' + (owner ? '있음' : '없음')
          + ' 현재uid=' + (mine ? '있음' : '없음') + ' 일치=' + (!!owner && owner === mine));

        if(owner && !mine){
          /* 세션이 풀렸다. 토큰이 안 붙어 auth.uid 가 null 이고, 규칙은 null 을 주인으로 안 본다.
             이 상태는 저절로 낫지 않는다 — 다시 로그인해야 새 토큰이 붙는다. */
          return { ok:false, reason:'로그인이 풀려서 저장하지 못했어요 — 로그아웃했다가 다시 로그인해 주세요' + tail,
                   authFix:'relogin' };
        }
        if(owner && mine && owner !== mine){
          return { ok:false, reason:'이 마이홈은 다른 구글 계정에 연결돼 있어요 — 원래 쓰던 계정으로 로그인해 주세요' + tail,
                   authFix:'account' };
        }
        /* 주인 표시가 없거나(=규칙이 열어 두는 경로) 일치하는데도 거부됐다 — 로그인 문제가 아니다.
           엉뚱한 곳을 가리키지 않는다. 이 줄이 뜨면 원인이 따로 있다는 뜻이다. */
        return { ok:false, reason:'저장 권한이 없어요 — 잠시 뒤 다시 시도해 주세요' + tail,
                 authFix:'other' };
      };

      try{
        await set(ref(db, `users/${userId}/home`), out);
        return uploadWarn ? { ok:true, warn:uploadWarn, swaps } : { ok:true, swaps };
      }catch(e){
        const code = String((e && (e.code || e.message)) || '');
        console.warn('[마이홈] 저장 실패', code, e);

        /* 🩹 [조각 하나가 전체를 막지 않게] 제보 — "토스트가 뜬 뒤로는 마이홈에서 무엇을 지우거나
             고쳐도 안 먹힌다. 문제였던 스티커를 지우니 그제서야 풀렸다."
           [왜 그런가] 이 함수는 홈 노드를 **통째로 set** 한다. 그래서 조각 하나가 거부당하면
             소개글 한 줄, 스티커 삭제 하나까지 **같이 막힌다.** 사용자 입장에서는 마이홈 전체가
             굳은 것으로 보이고, 무엇을 지워야 풀리는지도 알 수 없다.
           [고침] 한 번 더 시도한다 — 이번엔 **의심되는 사진만 서버에 있던 값으로 되돌려서.**
             그러면 나머지 수정(삭제·이동·글)은 정상적으로 저장되고, 무엇이 걸림돌인지도 말해 줄 수 있다.
           ★ 의심 대상은 «올리지 못해 dataURL 로 남은 사진» 뿐이다. 그 밖의 것은 손대지 않는다 —
             원인을 모른 채 사용자 데이터를 임의로 깎는 것이 더 나쁘다.
           ★ 이 갈래는 **실패했을 때만** 돈다. 평소 저장에는 읽기 한 번도 늘지 않는다. */
        const slots = [];
        if(typeof out.avatar === 'string' && out.avatar.startsWith('data:'))
          slots.push({ label:'프로필 사진',
            read:h => h && h.avatar,
            put:v => { if(v == null) delete out.avatar; else out.avatar = v; } });
        if(out.bg && typeof out.bg.img === 'string' && out.bg.img.startsWith('data:'))
          slots.push({ label:'배경 사진',
            read:h => h && h.bg && h.bg.img,
            put:v => { if(v == null) delete out.bg.img; else out.bg.img = v; } });
        Object.keys(out.stickers || {}).forEach(sid => {
          const st = out.stickers[sid];
          if(st && typeof st.img === 'string' && st.img.startsWith('data:'))
            slots.push({ label:'스티커',
              read:h => h && h.stickers && h.stickers[sid] && h.stickers[sid].img,
              put:v => { if(v == null) delete st.img; else st.img = v; } });
        });
        if(!slots.length) return await _fail(code);   // 되돌릴 후보가 없다 — 원인이 사진이 아니다

        let prev = null;
        try{ prev = (await get(ref(db, `users/${userId}/home`))).val(); }catch(_){}
        slots.forEach(s => {
          let v = null;
          try{ v = s.read(prev); }catch(_){}
          // 서버에 멀쩡한 URL 이 있으면 그걸로, 없으면 그 사진만 비운다(스티커 자체는 남는다)
          s.put((typeof v === 'string' && !v.startsWith('data:')) ? v : null);
        });

        try{
          await set(ref(db, `users/${userId}/home`), out);
          const uniq = slots.map(s => s.label).filter((v,i,a)=>a.indexOf(v)===i).join('·');
          console.warn('[마이홈] 문제되는 사진(' + uniq + ')을 빼고 저장했습니다 — 나머지 수정은 반영됨');
          return { ok:true, warn:'다른 수정은 저장했어요. 다만 ' + uniq + ' 은(는) 반영하지 못했어요 — 그 사진을 지우고 다시 등록해 주세요' };
        }catch(e2){
          console.warn('[마이홈] 사진을 빼고도 저장 실패 — 사진 문제가 아닙니다', e2);
          return await _fail(String((e2 && (e2.code || e2.message)) || code));
        }
      }
    },
    // ===== 방명록 / 웹박수 =====
    /* ★ 반드시 해지 함수를 돌려줘야 한다 —
       app.js의 _gbSubscribeIfNeeded는 홈 주인이 바뀔 때 이전 구독을 끊으려고 반환값을 보관해뒀다가
       호출한다. 그런데 여기서 아무것도 안 돌려주니 그 해지가 통째로 no-op이 되어, 친구 홈을 구경하면
       그 친구의 리스너가 영영 살아남았다. 내 홈으로 돌아와 다시 구독해도 친구 쪽 리스너가 그대로
       살아 있어서, 둘 중 나중에 도착한 스냅샷이 화면을 덮어썼다(= 내 방명록 자리에 친구 방명록).
       "가끔" 그랬던 건 두 리스너의 도착 순서가 매번 달랐기 때문. */
    subscribeGuestbook(userId, onChange){
      const r = ref(db, `users/${userId}/guestbook`);
      const unsub = onValue(r, snap=> onChange(snap.val()||{}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // 글 등록 후 30개 초과분은 오래된 것(ts 기준)부터 자동 삭제
    async addGuestbookEntry(userId, entry){
      const gid = 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await set(ref(db, `users/${userId}/guestbook/${gid}`), entry);
      const snap = await get(ref(db, `users/${userId}/guestbook`));
      const all = snap.val()||{};
      const ids = Object.keys(all).sort((a,b)=>(all[a].ts||0)-(all[b].ts||0));
      if(ids.length>30){
        const updates={};
        ids.slice(0, ids.length-30).forEach(id=>{ updates[`users/${userId}/guestbook/${id}`]=null; });
        await update(ref(db), updates);
      }
    },
    // 웹박수도 방명록과 같은 짝 — 해지 함수가 없으면 친구 홈의 박수 수/이미지가 내 홈에 남는다.
    /* ⚠️ 해지는 onValue 가 돌려준 함수를 그대로 부른다. 예전엔 그 반환값을 off(ref,'value',…) 의
       세 번째 인자로 넘겼는데, 거기에는 '등록할 때 준 콜백'이 들어가야 한다. 반환된 해지 함수는
       어떤 콜백과도 안 맞아서 off 가 조용히 아무것도 안 지웠다 — 구독이 영영 살아 있었다.
       그래서 친구 홈을 보고 돌아와도 친구의 clap 리스너가 계속 스냅샷을 쏘고, 나중에 도착한 쪽이
       화면을 덮어써서 "웹박수 이미지가 안 돌아온다"가 됐다(제보 증상).
       콜백을 따로 변수에 담아 onValue(r, cb) 로 등록한 경우에만 off(r,'value',cb) 가 맞다. */
    subscribeClap(userId, onChange){
      const r = ref(db, `users/${userId}/clap`);
      const unsub = onValue(r, snap=> onChange(snap.val()||{count:0,img:null}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // 자기가 쓴 방명록 글 삭제 (entry.uid가 내 uid인 글만 renderer에서 삭제 버튼 노출)
    async deleteGuestbookEntry(userId, entryId){
      await remove(ref(db, `users/${userId}/guestbook/${entryId}`));
    },
    // 손님이 웹박수 이미지를 클릭 → total 1 누적 (트랜잭션으로 동시 클릭도 안전)
    async clapOnce(userId){
      await runTransaction(ref(db, `users/${userId}/clap/count`), cur=> (cur||0)+1);
    },
    // 홈 주인이 웹박수 이미지 등록/변경 (400px 이하로 리사이즈된 base64)
    async setClapImage(userId, img){
      // ★ Storage Phase 2 — 박수 이미지도 Storage로
      const url = img ? await _uploadDataUrlIfNeeded(`users/${userId}/clap.jpg`, img) : null;
      await update(ref(db, `users/${userId}/clap`), { img: url });
    },
    /* 🎆 웹박수 폭죽 이모지 — 박수를 누를 때 터질 이모지 한 글자. ''(=null)이면 폭죽 없음.
       손님 화면에서도 터져야 하므로 홈 주인의 clap 노드에 같이 둔다(subscribeClap이 통째로 받아온다).
       ⚠️ clap 아래에 **새로 생긴 키**다. 규칙이 clap 하위를 count/img 로 열거하는 형태라면
         이 쓰기만 조용히 거부된다(핸드오프 §4의 그 함정과 같은 종류). 규칙에 emoji 를 함께 넣을 것. */
    async setClapEmoji(userId, emoji){
      /* ⚠️ 8자로 자르면 👨‍👩‍👧‍👦(UTF-16 11칸)처럼 ZWJ로 이어붙인 이모지가 반쪽만 저장돼 깨진다.
         renderer(gbFirstGrapheme)가 이미 '한 글자'로 줄여서 보내므로, 여기 상한은 그 한 글자가
         아무리 길어도 통과할 만큼만 넉넉하면 된다 — 잘라내기가 아니라 방어선이다. */
      const e = String(emoji||'').slice(0, 32);
      await update(ref(db, `users/${userId}/clap`), { emoji: e || null });
    },
    /* ===== 🔒 시크릿룸 (후원자 전용 고정 투게더룸) =====
       secretRooms/{SCRT-XXXX} = { pub:{owner, name, ts}, k }

       이 프로젝트 RTDB에는 인증이 없고 관리자 모드도 클라이언트 판정이라(ADMIN_PASS_HASH가
       배포본에 그대로 들어 있다) "관리자 UI에서만 쓴다"는 보호가 되지 않는다. 그래서 발급을
       서버 규칙으로 막는다:
         · 쓰기 조건  — newData.k === root.srKey/v
         · srKey 는 .read 가 없어 클라이언트가 절대 못 읽는다(규칙은 읽을 수 있다)
         · pub 만 .read:true — 입장 검증에 필요한 owner/name/ts 만 공개, 열쇠 k 는 비공개
       ⇒ 관리자 화면을 열어도 열쇠를 모르면 서버가 발급을 거부한다 = 정원 밖 투게더룸 우회 차단.

       ⚠️ 열쇠는 config 밑에 두면 안 된다 — config 는 .read:true 이고 읽기 권한은 아래로
          캐스케이드되며 하위에서 취소할 수 없다(1-7의 반대 방향). 반드시 별도 최상위 노드.
       ⚠️ 삭제(remove)는 newData 가 없어 k 검사를 통과할 수 없다 — 규칙상 이 노드는 지울 수 없다.
          그래서 '못 들어가게 하는 것'은 삭제가 아니라 set() 으로 한다(expireSecretRoom).
       🗑️ revokeSecretRoom(owner 를 빈 문자열로 만들어 회수) 은 폐기됐다. 입장 문구가
          "없는 시크릿룸 코드예요" 로 나가 거짓말이 되고, owner 가 사라져 같은 코드로 재발급하는
          연장 경로가 끊기며, 누구 것이었는지 기록도 날아간다. 만료로 내리는 편이 전부 낫다. */
    async getSecretRoomPub(code){
      try{ const s = await get(ref(db, `secretRooms/${code}/pub`)); return s.val() || null; }
      catch(_){ return null; }
    },
    /* 📅 expMs — 이용 기간이 끝나는 시각(ms). 넘기지 않거나 0이면 영구.
       exp 는 pub 안에 둔다 — 입장하려는 사람(주인이 아닌 친구 포함)이 읽어야 판정할 수 있고,
       pub 만 .read:true 이기 때문. 규칙의 pub .validate 는 owner/ts/name 만 보고 나머지 자식은
       제한하지 않으므로 규칙 JSON을 고치지 않아도 통과한다.
       ⚠️ set() 은 노드를 통째로 갈아치우므로, expMs 없이 부르면 기존 exp가 사라진다 —
          그게 의도다(같은 코드로 '영구'로 재발급 = 만료 해제). */
    async issueSecretRoom(code, ownerUserId, name, key, expMs){
      try{
        const pub = { owner: String(ownerUserId || ''), name: String(name || '').slice(0, 20), ts: Date.now() };
        if(typeof expMs === 'number' && isFinite(expMs) && expMs > 0) pub.exp = Math.floor(expMs);
        await set(ref(db, `secretRooms/${code}`), { k: String(key || ''), pub });
        return { ok:true };
      }catch(e){
        // 1-7: permission_denied 를 "네트워크 오류"로 뭉뚱그리지 않는다 — 그게 원인을 가린다.
        const msg = String((e && (e.code || e.message)) || '');
        console.warn('[시크릿룸] 발급 실패', e);
        return { ok:false, denied: /permission[_ ]denied/i.test(msg), reason: msg };
      }
    },
    /* 📅 만료 처리 — owner·name 은 그대로 두고 exp 만 '지금'으로 내린다.
       '회수'(owner 를 비워 없는 코드로 만들기)가 아니라 만료로 내리는 이유:
         · 입장 문구가 자연스럽다 — "없는 코드예요" 대신 기존 만료 안내가 그대로 뜬다
         · owner 가 남아 있어 같은 코드로 재발급 = 연장 경로로 되살릴 수 있다
         · 누구 것이었는지 기록이 남는다
       ⚠️ issueSecretRoom 과 마찬가지로 set() 이라 노드를 통째로 갈아치운다 —
          기존 pub 을 먼저 읽어서 얹지 않으면 name·ts 가 날아간다.
       ⚠️ 쓰기에 발급 열쇠(k)가 필요하다(규칙이 newData.k === root.srKey/v 를 본다).
          즉 관리자만 할 수 있고, 앱이 자동으로 처리할 수는 없다 — srKey 는 .read 가 없다.
       ⚠️ exp 를 정확히 Date.now() 로 두면 입장 게이트의 `Date.now() > exp` 가 같은 밀리초에
          거짓이라 통과한다. 1초 과거로 내려 즉시 만료가 되게 한다. */
    async expireSecretRoom(code, key){
      try{
        const pub = await firebaseAPI.getSecretRoomPub(code);
        if(!pub || !pub.owner) return { ok:false, reason:'not-issued' };
        await set(ref(db, `secretRooms/${code}`),
                  { k: String(key || ''), pub: { ...pub, exp: Date.now() - 1000 } });
        return { ok:true };
      }catch(e){
        const msg = String((e && (e.code || e.message)) || '');
        console.warn('[시크릿룸] 만료 처리 실패', e);
        return { ok:false, denied: /permission[_ ]denied/i.test(msg), reason: msg };
      }
    },
    // 후원자 본인 코드 조회 — 참여 화면이 "내 시크릿룸"을 자동으로 펼치고 채워넣는 데 쓴다.
    async getMySecretRoom(userId){
      try{ const s = await get(ref(db, `users/${userId}/secretRoom`)); return s.val() || null; }
      catch(_){ return null; }
    },
    // 후원자 본인 노드에 코드 기록 — 참여 화면이 위 getMySecretRoom으로 읽는다.
    async setMySecretRoom(userId, code){
      try{ await set(ref(db, `users/${userId}/secretRoom`), code || null); return { ok:true }; }
      catch(_){ return { ok:false }; }
    },
    // ---- 라이선스 (관리자 직접 발급 방식) ----
    // licenses/{key} = { valid:true, note, createdAt, redeemedAt|null, redeemedBy|null(기기 식별용, 선택) }

    // 관리자: 새 라이선스 키 발급. key는 호출부(app.js)에서 랜덤 생성해 넘김.
    async createLicense(key, note){
      await set(ref(db, `licenses/${key}`), { valid:true, note: note||'', createdAt: serverTimestamp(), redeemedAt:null });
      return { ok:true };
    },

    // 관리자: 발급된 키 전체 목록 조회 (최근 것부터 보여주려면 app.js에서 정렬) — 규칙상 관리자만 읽힌다(개정 55)
    async listLicenses(){
      const snap = await get(ref(db, 'licenses'));
      return snap.val() || {};
    },

    // 📊 관리자 통계 — 가입 유저 수 + 라이선스(프리미엄) 보유 유저 수.
    //   · 가입 유저 = users 노드의 자식 수 (invite/profile 등 실사용 흔적이 있는 계정)
    //   · 라이선스 보유 = 유효한(valid) 라이선스가 등록된 유저. licenses 노드에서 valid && usedBy가 있는 것을 셈.
    async getAdminStats(){
      // 👥 가입 유저 수 = stats/userCount 카운터 (users 전체를 읽지 않아 프라이버시 보호)
      // 👑 프리미엄 유저 = licenses 노드에서 valid + usedBy 집계 — 모음 읽기는 **관리자만**(개정 55 · 키 목록이 공개였다). 관리자 화면에서만 부른다.
      const [cntSnap, licSnap] = await Promise.all([
        get(ref(db, 'stats/userCount')),
        get(ref(db, 'licenses')),
      ]);
      const totalUsers = cntSnap.val() || 0;
      const lics = licSnap.val() || {};
      let licValid = 0, licUsed = 0;
      const usedById = {};
      for(const key in lics){
        const L = lics[key] || {};
        if(L.valid){ licValid++; if(L.usedBy){ licUsed++; usedById[L.usedBy] = true; } }
      }
      const premiumUsers = Object.keys(usedById).length;
      return { totalUsers, licValid, licUsed, premiumUsers };
    },
    // 관리자: 카운터를 실제 값으로 보정(선택) — 카운터 도입 이전 가입자를 반영하고 싶을 때 수동 세팅
    async setUserCount(n){ try{ await set(ref(db, 'stats/userCount'), n); return { ok:true }; }catch(e){ return { ok:false }; } },

    // 관리자: 이미 발급한 키 회수(비활성화). 환불 등으로 취소해야 할 때 사용 — valid:false로 바뀌면
    // 다음에 그 사용자가 앱을 켤 때(백그라운드 재검증)나 이 키로 새로 등록 시도할 때 자동으로 막힘.
    async revokeLicense(key){
      await update(ref(db, `licenses/${key}`), { valid:false, revokedAt: serverTimestamp() });
      return { ok:true };
    },

    // 관리자: 회수된 키를 목록에서 완전히 삭제(정리용). 아직 유효한 키는 앱에서 먼저 회수를 요구함.
    async deleteLicense(key){
      await remove(ref(db, `licenses/${key}`));
      return { ok:true };
    },

    // 사용자: 키 검증 + 등록(redeemed 처리). 이미 등록된 키도 "같은 기기 재설치" 허용을 위해 valid하면 통과시킴.
    async redeemLicense(key){
      try{
        const snap = await get(ref(db, `licenses/${key}`));
        const data = snap.val();
        if(!data) return { ok:false, reason:'존재하지 않는 라이선스 키예요' };
        if(data.valid === false) return { ok:false, reason:'비활성화된 라이선스 키예요' };
        // 처음 등록되는 거면 redeemedAt 기록(통계용, 재사용 막지는 않음 — 재설치 시나리오 고려)
        if(!data.redeemedAt){
          await update(ref(db, `licenses/${key}`), { redeemedAt: serverTimestamp() });
        }
        return { ok:true };
      }catch(e){
        return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
      }
    },

    /* ═══════════════════ 🎟️ 초대장 (앱 접근 제한) ═══════════════════
       스키마:
         users/{uid}/invite = { invitesLeft, invitedBy, joinedAt }
         invites/{code}     = { issuedBy, createdAt, usedBy|null, usedAt|null }
       정책:
         · 기존 유저(users/{uid}가 이미 있음) → 무조건 통과 + 초대권 5장 부여(최초 1회)
         · 초대 코드로 들어온 신규 유저 → 초대권 0장 (확산이 1세대에서 멈춤)
         · 관리자 → 무제한 발급, 유저에게 초대권 추가 지급 가능
    ─────────────────────────────────────────────────────────── */

    // 이 uid가 이미 등록된 사용자인지 (친구 시스템을 쓴 적 있으면 profile/home 등이 남아있음)
    /* 🐞 버그제보 게시판 — 경로 · 쿼리 · 묶음 쓰기는 bug-board.js 에 있다. 여기는 연결만. */
    bugBoard: createBugBoard({ db, ref, get, update, query, orderByChild, limitToLast, endBefore, equalTo, runTransaction, push,
                               serverTs: () => serverTimestamp(),
                               getDailyMax: () => _rc ? _rc.refresh({ maxAgeMs: window.TwRemoteConfig.STALE_MS }).then(() => _rc.bugDailyMax()) : null,
                               authUid: () => (auth && auth.currentUser) ? auth.currentUser.uid : null }),
    /* 💬 대화 기록(서버 3일 · 이 PC 화면 캐시 · 시각으로 이어 받기) — 규칙은 chat-history.js · 서버 길은 대화 포트(chat/chat-rt.js). 여기는 연결만. */
    chatHistory: createChatHistory({
      store: createIdbChatStore(typeof indexedDB !== 'undefined' ? indexedDB : null, (firebaseConfig && firebaseConfig.databaseURL) || ''),
      subscribeSince: (room, tab, since, onMsg, onReady) => window.TwChatRt.store.subscribeSince(room, tab, since, onMsg, onReady),
      clearLog: (room, tab) => window.TwChatRt.store.clear(room, tab) }),
    /* 😊 내 이모티콘 그림 올리기 — 서버가 받는 자리 users/{내 코드}/emojis/{칸}.png|gif 에만. 칸 저장 · 지우기는 API(chat-rt.js). 반환: 내려받기 주소 */
    async uploadEmojiImage(userCode, slot, dataUrl, isGif){
      const storageRef = sref(storage, `users/${userCode}/emojis/${slot | 0}.${isGif ? 'gif' : 'png'}`);
      await uploadString(storageRef, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE, contentType: isGif ? 'image/gif' : 'image/png' });
      return getDownloadURL(storageRef);
    },
    /* 🗑️ 회원 탈퇴(함수 deleteMyAccount) — 순서 · 까닭은 account-delete-net.js. 여기는 연결만. */
    accountDelete: createAccountDelete({
      callFn: async (name, data) => { const mod = await import(FUNCTIONS_SDK_URL); return mod.httpsCallable(mod.getFunctions(fbApp, FUNCTIONS_REGION), name, { timeout: 300000 })(data); },
      signedIn: () => { const u = auth && auth.currentUser; return !u ? 'none' : (u.isAnonymous ? 'anonymous' : 'ok'); },
      cancelPresence: () => (_myPresenceRef ? onDisconnect(_myPresenceRef).cancel() : null),
      goOffline: () => goOffline(db), goOnline: () => goOnline(db),
      signOut: () => (auth ? fbSignOut(auth) : null) }),
    getInviteAccount: createInviteAccount({ db, ref, get, databaseURL: db && db.app && db.app.options && db.app.options.databaseURL }),
    // 기존 유저 grandfather 처리 — 초대 정보가 없으면 5장 부여하고 통과
    async grandfatherInvite(userId, grantCount){
      const inviteRef = ref(db, `users/${userId}/invite`);
      const result = await runTransaction(inviteRef, cur=>{
        if(cur) return cur;   // 이미 초대 정보가 있으면 그대로 (중복 지급 방지)
        return { invitesLeft: grantCount, invitedBy: null, joinedAt: Date.now() };
      });
      return result && result.snapshot ? result.snapshot.val() : null;
    },
    /* 초대 코드 소진은 uid 가 아니라 기기 토큰으로 — uid 는 아직 없다. users/ · stats/ 쓰기는 finishInviteSignup 몫
       (여기서 쓰면 users/t… 유령 노드가 생긴다). usedBy === token 이면 같은 기기의 재시도라 다시 통과. */
    async redeemInvite(code, token){
      try{
        if(!token) return { ok:false, reason:'초대 코드를 확인하지 못했어요 — 다시 시도해 주세요' };
        const codeRef = ref(db, `invites/${code}`);
        // ⚠️ 트랜잭션 첫 cur 는 로컬 캐시(null) — 서버 값을 미리 읽어 기준으로 쓴다(issueInvite 와 같은 함정)
        const preSnap = await get(codeRef);
        const preVal = preSnap.val();
        // 한 명짜리에 없으면 관리자가 만든 여러 명짜리 코드인지 본다(group-invite.js)
        if(!preVal) return await _groupInvite.redeem(code, token);
        let failReason = null;
        const result = await runTransaction(codeRef, cur=>{
          const v = cur || preVal;
          if(!v){ failReason = '존재하지 않는 초대 코드예요'; return; }              // 중단
          if(v.usedBy && v.usedBy !== token){ failReason = '이미 사용된 초대 코드예요'; return; }
          if(v.usedBy === token) return v;                                          // 같은 기기의 재시도
          return Object.assign({}, v, { usedBy: token, usedAt: Date.now() });
        });
        if(!result || !result.committed) return { ok:false, reason: failReason || '초대 코드를 사용할 수 없어요' };
        const issuedBy = (result.snapshot.val() || {}).issuedBy || null;
        return { ok:true, issuedBy };
      }catch(e){
        return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
      }
    },
    /* uid 가 정해진 뒤 — 토큰 자리를 uid 로 바꾸고 users/{uid}/invite · 가입 카운터를 한 번만 쓴다(칸이 있으면 안 씀).
       실패하면 { ok:false } — 부르는 쪽은 토큰을 남겨 다음 부팅에 다시 부른다. */
    async finishInviteSignup(code, token, userId){
      try{
        if(!code || !token || !userId) return { ok:false, reason:'값이 비었어요' };
        const codeRef = ref(db, `invites/${code}`);
        const preVal = (await get(codeRef)).val();
        let issuedBy = (preVal && preVal.issuedBy) || null;
        if(!preVal){
          const g = await _groupInvite.finish(code, token, userId);   // 여러 명짜리 코드(group-invite.js)
          if(!g.ok) return g;
          issuedBy = g.issuedBy;
        }else{
          const tr = await runTransaction(codeRef, cur=>{
            const v = cur || preVal;
            if(!v) return;                                             // 코드가 사라졌다 — 바꿀 것 없음
            issuedBy = v.issuedBy || issuedBy;
            if(v.usedBy === userId) return v;                          // 이미 바꿨다
            if(v.usedBy !== token) return;                             // 남의 토큰 — 손대지 않는다
            return Object.assign({}, v, { usedBy: userId });
          });
          const now = tr && tr.snapshot ? tr.snapshot.val() : null;
          if(!now || now.usedBy !== userId) return { ok:false, reason:'초대 코드 기록을 바꾸지 못했어요' };
        }
        const invRef = ref(db, `users/${userId}/invite`);
        const had = (await get(invRef)).exists();
        if(!had){
          await update(invRef, { invitesLeft: 0, invitedBy: issuedBy, joinedAt: Date.now() });   // 초대로 들어온 사람은 0장
          // 전체 users 는 못 읽으니 가입 수는 따로 센다
          try{ await runTransaction(ref(db, 'stats/userCount'), c => (typeof c==='number'?c:0) + 1); }catch(_){}
        }
        return { ok:true };
      }catch(e){
        return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
      }
    },
    // 초대장 발급 — 유저는 invitesLeft를 1 차감(트랜잭션), 관리자(admin=true)는 차감 없이 무제한
    async issueInvite(userId, code, admin){
      try{
        if(!admin){
          const leftRef = ref(db, `users/${userId}/invite/invitesLeft`);
          // ★ RTDB 트랜잭션은 첫 실행을 "로컬 캐시"로 돌림 — 이 경로를 읽은 적 없으면 cur=null.
          //   null일 때 중단(return undefined)하면 서버 값으로 재시도할 기회 자체가 사라져서
          //   실제로는 5장이 있어도 "없다"로 끝남. 미리 서버 값을 읽어 null의 기준값으로 쓰면,
          //   추정이 틀려도 Firebase가 진짜 값으로 자동 재시도함.
          const preSnap = await get(leftRef);
          const preVal = preSnap.val();
          let failReason = null;
          const r = await runTransaction(leftRef, cur=>{
            const n = (typeof cur === 'number') ? cur
                    : (typeof preVal === 'number') ? preVal : 0;
            if(n <= 0){ failReason = '남은 초대장이 없어요'; return; }   // 중단
            return n - 1;
          });
          if(!r || !r.committed) return { ok:false, reason: failReason || '초대장을 발급할 수 없어요' };
        }
        await set(ref(db, `invites/${code}`), {
          issuedBy: userId, createdAt: Date.now(), usedBy: null, usedAt: null
        });
        return { ok:true, code };
      }catch(e){
        return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
      }
    },
    // 남은 초대장 수 조회
    async getInvitesLeft(userId){
      const snap = await get(ref(db, `users/${userId}/invite/invitesLeft`));
      const v = snap.val();
      return (typeof v === 'number') ? v : 0;
    },
    // 관리자: 특정 유저에게 초대권 추가 지급 (기존 값에 더함)
    // 🎟️ 전체 유저 일괄 지급 — invite 노드가 "이미 있는" 유저에게만 count장씩 더함.
    //   노드 없는 계정(게이트 통과 전 유령 계정 등)에 지급하면 노드가 새로 생겨
    //   비정상 계정이 초대권을 갖게 되므로 반드시 제외.
    /* 🎟️ 전체 유저 일괄 지급.
       ★ 예전엔 get(ref(db,'users'))로 유저 노드를 통째로 읽었는데, 규칙상 .read는 users/$userId에만
         있고 users에는 없다. 읽기 권한은 아래로만 전파되므로 이 호출은 항상 거부됐고,
         호출부의 catch가 그걸 "네트워크 오류"로 표시해 원인을 찾기 어려웠다.
         friendCodes(code→{userId})는 모든 유저에 이미 채워져 있는 가장 가벼운 uid 인덱스라
         users 전체를 공개하지 않고도 대상 목록을 얻을 수 있다(유저당 약 50바이트). */
    async grantInvitesAll(count){
      const snap = await get(ref(db, 'friendCodes'));
      const codes = snap.val() || {};
      const seen = {}, uids = [];
      for(const c in codes){
        const uid = codes[c] && codes[c].userId;
        if(uid && !seen[uid]){ seen[uid] = 1; uids.push(uid); }
      }
      let granted = 0, skipped = 0;
      const MAX_INVITES = 999;   // 규칙의 .validate 상한 — 넘기면 쓰기가 거부되므로 미리 자름
      const grantOne = async uid => {
        try{
          const p = ref(db, `users/${uid}/invite/invitesLeft`);
          // ★ 사전 get — 트랜잭션은 로컬 캐시가 비면 첫 시도에 cur=null로 들어온다.
          //   그걸 "초대권 없는 계정"으로 오해하면 전원이 skip되므로 실제 값을 먼저 확인한다.
          const cur = await get(p);
          const base = cur.val();
          if(typeof base !== 'number'){ skipped++; return; }   // 초대권 노드가 없는 계정은 대상 아님
          await runTransaction(p, v => {
            const n = (typeof v === 'number') ? v : base;
            return Math.min(MAX_INVITES, n + count);
          });
          granted++;
        }catch(e){ skipped++; }
      };
      // 순차로 돌리면 유저 수만큼 왕복이 쌓여 매우 느리다 — 20개씩 묶어서 병렬 처리.
      const CHUNK = 20;
      for(let i=0; i<uids.length; i+=CHUNK){
        await Promise.all(uids.slice(i, i+CHUNK).map(grantOne));
      }
      return { ok:true, granted, skipped, total: uids.length };
    },
    // 🎟️ 특정 날짜 이후 가입자의 초대권 회수 — 옛 버전으로 가입해 2장을 받은 계정 정리용.
    //   invite.joinedAt(가입 시각) 기준. dryRun=true면 실제로 바꾸지 않고 대상만 조사해서 돌려줌.
    //   · 대상: joinedAt >= sinceMs 이고 invitesLeft > 0 인 계정
    //   · 처리: invitesLeft에서 amount만큼 빼되 0 밑으로는 내려가지 않음
    // 🧹 유령 방 청소 — 멤버 없이 _meta만 남은 방을 일괄 정리(관리자 전용, dryRun 기본).
    //   예전엔 마지막 사람이 나가도 _meta가 남아 방이 유령으로 남았음. leaveRoom을 고쳤지만
    //   이미 남아있던 옛 유령 방을 청소하는 용도.
    async cleanupGhostRooms(dryRun){
      const snap = await get(ref(db, 'rooms'));
      const all = snap.val() || {};
      const ghosts = [];
      const now = _svNow(); const DEAD = 10*60*1000;   // 삭제는 보수적으로 10분 기준(순간 재연결 보호)
      for(const code in all){
        const room = all[code] || {};
        const members = Object.keys(room).filter(k => k !== '_meta');
        const anyRecent = members.some(k =>
          room[k] && room[k].lastSeen && (now - room[k].lastSeen) < DEAD);
        if(members.length === 0 || !anyRecent) ghosts.push(code);   // 빈 방 또는 전원 사망(10분+) 방
      }
      if(dryRun !== false){ return { ok:true, dryRun:true, count:ghosts.length, ghosts }; }
      let removed = 0, failed = 0;
      for(const code of ghosts){
        try{ await remove(ref(db, `rooms/${code}`)); removed++; }catch(_){ failed++; }
        await remove(ref(db, `roomIndex/${code}`)).catch(()=>{});   // 💰 요약 노드도 함께 정리
      }
      return { ok:true, dryRun:false, removed, failed, ghosts };
    },
    /* ★ 점검용 — 모든 멀티플레이 방을 즉시 종료(관리자 전용).
       rooms 노드를 통째로 비우면, 각 방의 리스너가 '빈 방' 스냅샷을 받아 안에 있던 사람들이 자동으로 튕긴다.
       (별도 강제 퇴장 신호가 필요 없음 — 기존 리스너 구조가 그대로 처리) */
    async closeAllRooms(){
      try{
        const snap = await get(ref(db, 'rooms'));
        const all = snap.val() || {};
        const codes = Object.keys(all);
        // ★ 방을 하나씩 삭제 — rooms 최상위 통째 remove는 규칙(상위 .write 없음)에 막히므로,
        //   rooms/{code}별로 지운다(각 방은 $room 규칙의 삭제 허용으로 처리). 일부 실패해도 나머지는 진행.
        let ok=0, fail=0;
        await Promise.all(codes.map(async code=>{
          try{ await remove(ref(db, `rooms/${code}`)); ok++; }
          catch(_){ fail++; }
        }));
        await Promise.all(codes.map(code => remove(ref(db, `roomIndex/${code}`)).catch(()=>{})));   // 💰 요약 노드도 정리
        return { ok:true, count: ok, failed: fail, codes };
      }catch(e){ return { ok:false, error:String(e&&e.message||e) }; }
    },
    // 🧹 관리자: 유령 방 일괄 청소 — 살아있는 멤버(90초 내 하트비트)가 하나도 없는데
    //   _meta/chatLog만 남은 방을 통째로 삭제. 정상 방(살아있는 멤버 있음)은 절대 안 건드림.
    async cleanGhostRooms(){
      try{
        const snap = await get(ref(db, 'rooms'));
        const all = snap.val() || {};
        /* 🕒 관리자 PC 시계가 앞서 있으면 **살아 있는 방을 유령으로 보고 지운다** — 여기는
           되돌릴 수 없는 삭제라 다른 자리보다 위험하다. 오프셋 보정본을 쓴다. */
        const now = _svNow(); const STALE = 90*1000;
        // 💓 새 하트비트(hb:2) 멤버는 lastSeen 이 입장 때 값에 머문다 — roomAlive 도장으로 본다(room-alive.js)
        const aliveTree = await get(ref(db, 'roomAlive')).then(s => s.val() || {}).catch(() => ({}));
        const ghosts = [];
        for(const code in all){
          const room = all[code] || {};
          let alive = false;
          for(const k in room){
            if(k === '_meta' || k === 'chatLog') continue;
            const mm = room[k];
            if(mm && mm.lastSeen && (now - mm.lastSeen) < STALE){ alive = true; break; }
            const at = aliveTree[code] && aliveTree[code][k];
            if(mm && mm.hb === ROOM_ALIVE_HB && typeof at === 'number' && (now - at) < ROOM_ALIVE_STALE_MS){ alive = true; break; }
          }
          if(!alive) ghosts.push(code);   // 살아있는 멤버 없음 = 유령 방
        }
        let ok=0, fail=0;
        await Promise.all(ghosts.map(async code=>{
          try{
            // 통째 remove(rooms/{code})는 $room 삭제 규칙 게시가 필요하므로,
            // 규칙 게시 없이도 되도록 하위 노드를 개별 삭제(각 하위는 예전부터 .write:true).
            const room = all[code] || {};
            const dels = [];
            for(const k in room){ dels.push(remove(ref(db, `rooms/${code}/${k}`)).catch(()=>{})); }
            if(aliveTree[code]) dels.push(remove(ref(db, `roomAlive/${code}`)).catch(()=>{}));
            await Promise.all(dels);
            ok++;
          }catch(_){ fail++; }
        }));
        // 💰 roomIndex 정리 — 방금 지운 방 + rooms에 더 이상 없는 고아 인덱스를 함께 제거.
        //   (마지막 사람이 강제종료로 나가면 leaveRoom이 못 돌아서 인덱스만 남을 수 있음 —
        //    카운트는 lastSeen 90초 기준이라 어차피 안 세지만, 쓰레기가 쌓이지 않게 여기서 청소)
        try{
          const isnap = await get(ref(db, 'roomIndex'));
          const idx = isnap.val() || {};
          const dels = [];
          for(const code in idx){
            if(idx[code] && idx[code].srv) continue;   // 🛰 방 서버 방 줄 — Firebase rooms 에 없어도 정상(서버가 30초마다 갱신 · 끝나면 서버가 지운다)
            if(!(code in all) || ghosts.indexOf(code) !== -1) dels.push(remove(ref(db, `roomIndex/${code}`)).catch(()=>{}));
          }
          await Promise.all(dels);
        }catch(_){}
        return { ok:true, cleaned: ok, failed: fail, total: Object.keys(all).length };
      }catch(e){ return { ok:false, error:String(e&&e.message||e) }; }
    },
    revokeInvitesAll: createInviteRevokeAll({ db, ref, get, runTransaction }),
    async reclaimInvitesSince(sinceMs, amount, dryRun, allowNegative){
      const snap = await get(ref(db, 'users'));
      const all = snap.val() || {};
      const targets = [];
      let changed = 0, skipped = 0, failed = 0;
      for(const uid in all){
        const inv = all[uid] && all[uid].invite;
        if(!inv || typeof inv.invitesLeft !== 'number'){ skipped++; continue; }
        if(typeof inv.joinedAt !== 'number' || inv.joinedAt < sinceMs){ skipped++; continue; }
        if(inv.invitesLeft <= 0){ skipped++; continue; }
        const after = allowNegative ? (inv.invitesLeft - amount) : Math.max(0, inv.invitesLeft - amount);
        targets.push({ uid, joinedAt: inv.joinedAt, before: inv.invitesLeft, after });
      }
      if(dryRun) return { ok:true, dryRun:true, count:targets.length, targets, skipped };
      for(const t of targets){
        try{
          await runTransaction(ref(db, `users/${t.uid}/invite/invitesLeft`), cur=>{
            const n = (typeof cur === 'number') ? cur : t.before;
            return allowNegative ? (n - amount) : Math.max(0, n - amount);
          });
          changed++;
        }catch(e){ failed++; }
      }
      return { ok:true, dryRun:false, changed, failed, skipped, targets };
    },
    async grantInvites(userId, count){
      try{
        const leftRef = ref(db, `users/${userId}/invite/invitesLeft`);
        const r = await runTransaction(leftRef, cur=>{
          const n = (typeof cur === 'number') ? cur : 0;
          return n + count;
        });
        if(!r || !r.committed) return { ok:false, reason:'지급에 실패했어요' };
        return { ok:true, invitesLeft: r.snapshot.val() };
      }catch(e){
        return { ok:false, reason:'네트워크 오류' };
      }
    },

    // ---- 라이선스 요청 (일반 유저가 앱 안에서 요청 → 관리자가 확인 후 발급) ----
    // licenseRequests/{reqId} = { name, status:'pending'|'approved', requestedAt, issuedKey|null, approvedAt|null, ver? }

    // 사용자: 라이선스 요청 보내기(내 표시 이름과 함께)
    async requestLicense(name){
      const reqId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await _appVer.ready;
      await set(ref(db, `licenseRequests/${reqId}`), _appVer.withVer({ name: name||'(이름 없음)', status:'pending', requestedAt: serverTimestamp(), issuedKey:null }));
      return reqId;
    },
    // 관리자: 대기 중인 요청 목록 실시간 구독
    subscribeLicenseRequests(onChange){
      onValue(ref(db, 'licenseRequests'), snap => onChange(snap.val()||{}));
    },
    // 관리자: 요청 하나를 승인하며 새 키 발급(키 생성은 app.js에서), 요청 노드에도 발급된 키를 남겨서 요청자가 실시간으로 받아볼 수 있게 함
    async approveLicenseRequest(reqId, key, note){
      await set(ref(db, `licenses/${key}`), { valid:true, note: note||'', createdAt: serverTimestamp(), redeemedAt:null });
      await update(ref(db, `licenseRequests/${reqId}`), { status:'approved', issuedKey:key, approvedAt: serverTimestamp() });
      return { ok:true };
    },
    // 관리자: 요청 거절 — 요청 노드를 아예 삭제함(승인 대기 목록에서 사라지고, 요청자 쪽은 다시 처음부터 요청 가능해짐)
    async rejectLicenseRequest(reqId){
      await remove(ref(db, `licenseRequests/${reqId}`));
      return { ok:true };
    },
    // 사용자: 내가 보낸 요청이 승인됐는지(발급된 키가 들어왔는지) 실시간 구독
    subscribeMyLicenseRequest(reqId, onChange){
      onValue(ref(db, `licenseRequests/${reqId}`), snap => onChange(snap.val()));
    },
    // 사용자: 발급받은 키가 그 이후에 회수됐는지(valid:false) 실시간 구독 — "발급됐어요" 화면이 떠있는 동안
    // 관리자가 그 키를 회수하면 즉시 반영해서 안내를 지우기 위함.
    subscribeLicenseValidity(key, onChange){
      onValue(ref(db, `licenses/${key}`), snap => onChange(snap.val()));
    },

    // ---- 책상 카탈로그 (관리자가 등록한 책상을 모든 사용자에게 자동 배포. 수정하면 이미 쓰던 사람도 실시간 반영) ----
    // catalog/desks/{id} = { name, icon, glbUrl, createdAt }
    //   (구버전 데이터는 { name, icon, glb(base64), createdAt } — 마이그레이션 전까지 둘 다 지원)
    /* 쓰기는 set/remove 대신 _catalogUpdate(다중 경로 update) — catalogMeta/desks 버전을 같이 올린다.
       다중 경로 update 에서 경로 하나에 객체를 주면 그 노드 전체 교체라 set 과 같고, null 은 remove 와 같다. */
    async publishDesk(id, data){
      let rec = await _uploadGlbIfNeeded('catalog/desks/'+id+'.glb', data);
      rec = await _uploadThumbIfNeeded('catalog/desks/'+id+'.thumb.png', rec);
      await _catalogUpdate({ [`catalog/desks/${id}`]: { ...rec, createdAt: serverTimestamp() } }, ['desks']);
      return { ok:true };
    },
    async unpublishDesk(id){
      await _tryDeleteStorage('catalog/desks/'+id+'.glb');
      await _catalogUpdate({ [`catalog/desks/${id}`]: null }, ['desks']);
      return { ok:true };
    },
    /* 버전 확인 + 로컬 캐시(catalog-cache.js). 콜백 모양(전체 목록 객체)은 통째 onValue 때와 같다. */
    subscribeCatalogDesks(onChange){
      return _subscribeCatalogKind('desks', onChange);
    },

    // ---- 아이템(소품) 카탈로그 (책상과 동일한 방식) ----
    async publishItem(id, data){
      let rec = await _uploadGlbIfNeeded('catalog/items/'+id+'.glb', data);
      rec = await _uploadThumbIfNeeded('catalog/items/'+id+'.thumb.png', rec);
      await _catalogUpdate({ [`catalog/items/${id}`]: { ...rec, createdAt: serverTimestamp() } }, ['items']);
      return { ok:true };
    },
    async updateDesksOrder(orderMap){
      const updates = {};
      for(const id in orderMap) updates[`catalog/desks/${id}/order`] = orderMap[id];
      await _catalogUpdate(updates, ['desks']);   // 순서만 바뀌어도 버전을 올린다 — 안 올리면 사용자 화면 순서가 그대로다
      return { ok:true };
    },
    async updateItemsOrder(orderMap){
      const updates = {};
      for(const id in orderMap) updates[`catalog/items/${id}/order`] = orderMap[id];
      await _catalogUpdate(updates, ['items']);
      return { ok:true };
    },
    async unpublishItem(id){
      await _tryDeleteStorage('catalog/items/'+id+'.glb');
      await _catalogUpdate({ [`catalog/items/${id}`]: null }, ['items']);
      return { ok:true };
    },
    subscribeCatalogItems(onChange){
      return _subscribeCatalogKind('items', onChange);
    },

    // ---- 광고 배너 ----
    async publishAdBanner(slides){
      await set(ref(db, 'catalog/adBanner'), slides);
      return { ok:true };
    },
    subscribeAdBanner(onChange){
      const r = ref(db, 'catalog/adBanner');
      onValue(r, snap => onChange(snap.val() || []));
      return () => off(r, 'value');
    },

    /* ---- 게임 설정(관리자 전용) ----
       동물 해금 레벨처럼 '앱을 새로 배포하지 않고 바꾸고 싶은 값'을 서버에 둔다.
       광고 배너(catalog/adBanner)와 같은 방식 — 관리자가 저장하면 모든 유저에게 즉시 반영된다. */
    async publishGameConfig(cfg){
      await set(ref(db, 'catalog/gameConfig'), cfg);
      return { ok:true };
    },
    subscribeGameConfig(onChange){
      const r = ref(db, 'catalog/gameConfig');
      onValue(r, snap => onChange(snap.val() || {}));
      return () => off(r, 'value');
    },

    // ---- 파츠 카탈로그 ----
    /* 🎰 가챠 파츠는 catalog/gachaParts 에 따로 산다.
       [왜 경로 분리인가] DB 규칙은 앱 버전을 구분할 수 없다 — catalog/parts 에 gacha 플래그로만
         섞어두면, 가챠 기능 이전 빌드(꾸미기 필터가 없다)가 그대로 받아서 꾸미기 창에 진열하고
         뽑지 않고도 낀다(실제 제보). 구버전은 gachaParts 를 구독하는 코드 자체가 없으므로
         경로를 나누면 받을 방법이 없다.
       ⚠️ Storage 경로(catalog/parts/{id}.glb)는 그대로 둔다 — URL 은 DB 항목에서만 나오므로
         나눌 이유가 없고, 나누면 기존 파일 이동까지 필요해진다. */
    _partPath(gacha){ return gacha ? 'catalog/gachaParts' : 'catalog/parts'; },
    async publishPart(id, data){
      let rec = await _uploadGlbIfNeeded('catalog/parts/'+id+'.glb', data);
      rec = await _uploadThumbIfNeeded('catalog/parts/'+id+'.thumb.png', rec);
      const node = this._partPath(!!rec.gacha), other = this._partPath(!rec.gacha);
      /* 수정으로 가챠↔꾸미기 통이 바뀌었을 수 있다 — 반대편에 남은 옛 항목을 정리(없으면 null 은 조용히 지나간다).
         한 update 로 묶고 두 통의 버전을 같이 올린다 — 반대편 통에서 지워진 것도 그쪽 버전이 올라야 사용자 캐시에서 빠진다.
         두 경로 모두 같은 관리자 .write 라 묶어도 막히지 않는다(null 에는 .validate 가 안 돈다). */
      await _catalogUpdate({
        [`${node}/${id}`]: { ...rec, createdAt: serverTimestamp() },
        [`${other}/${id}`]: null,
      }, ['parts', 'gachaParts']);
      return { ok:true };
    },
    async updatePartsOrder(orderMap, gachaOrderMap){
      const updates = {};
      for(const id in (orderMap||{})) updates[`catalog/parts/${id}/order`] = orderMap[id];
      /* 🎰 가챠 파츠의 순서는 제 경로에 쓴다 — catalog/parts/{가챠id}/order 로 쓰면
         {order}만 있는 항목이 생겨 .validate(cat·name 필수)에 걸리고, RTDB 다중 경로 update 는
         한 경로만 거부돼도 통째로 실패한다(= 꾸미기 순서까지 같이 안 바뀐다). */
      for(const id in (gachaOrderMap||{})) updates[`catalog/gachaParts/${id}/order`] = gachaOrderMap[id];
      /* 실제로 순서를 쓴 통의 버전만 올린다. */
      const kinds = [];
      if(Object.keys(orderMap||{}).length) kinds.push('parts');
      if(Object.keys(gachaOrderMap||{}).length) kinds.push('gachaParts');
      if(Object.keys(updates).length) await _catalogUpdate(updates, kinds);
      return { ok:true };
    },
    /* 🧹 Storage 이관 뒷정리 — 이미 glbUrl이 있는(=Storage로 옮겨진) catalog 항목의 남은 base64 glb 필드만
       DB에서 삭제. glbUrl이 없는 항목은 안전하게 건너뜀(원본 소실 방지). onValue 다운로드 비용의 주범 제거.
       dryRun=true면 실제로 지우지 않고 대상 수/용량만 계산해서 반환. */
    async cleanupCatalogBase64(dryRun){
      const kinds = ['parts','desks','items'];
      const report = { willDelete:0, skipNoUrl:0, alreadyClean:0, bytes:0, byKind:{} };
      const updates = {};
      const touched = [];   // 실제로 지운 종류 — 그 종류의 catalogMeta 버전만 올린다
      for(const kind of kinds){
        report.byKind[kind] = { del:0, skip:0 };
        let snap;
        try{ snap = await get(ref(db, 'catalog/'+kind)); }catch(_){ continue; }
        const obj = snap.val() || {};
        for(const id in obj){
          const rec = obj[id] || {};
          if(!rec.glb){ report.alreadyClean++; continue; }        // 이미 base64 없음
          if(!rec.glbUrl){ report.skipNoUrl++; report.byKind[kind].skip++; continue; }  // Storage 미이관 → 절대 건드리지 않음
          report.willDelete++; report.byKind[kind].del++;
          report.bytes += (rec.glb.length||0);
          if(!dryRun){
            updates[`catalog/${kind}/${id}/glb`] = null;  // 이 필드만 삭제(다른 필드 유지)
            if(touched.indexOf(kind) < 0) touched.push(kind);
          }
        }
      }
      report.mb = (report.bytes/1048576).toFixed(2);
      /* 정리도 카탈로그 쓰기다 — 버전을 안 올리면 사용자 캐시에 base64 가 남은 옛 레코드가 그대로 산다. */
      if(!dryRun && Object.keys(updates).length) await _catalogUpdate(updates, touched);
      return report;
    },
    async unpublishPart(id){
      await _tryDeleteStorage('catalog/parts/'+id+'.glb');
      /* 어느 통에 있는지 호출자가 알 필요 없게 양쪽 다 지운다 — 없는 쪽 null 은 no-op.
         한 update 로 묶고 두 통의 버전을 같이 올린다(publishPart 와 같은 이유). */
      await _catalogUpdate({ [`catalog/parts/${id}`]: null, [`catalog/gachaParts/${id}`]: null }, ['parts', 'gachaParts']);
      return { ok:true };
    },
    // 🔍 카탈로그 용량 진단 — 어떤 레코드가 DB 용량(=모든 사용자 다운로드)을 먹는지 측정.
    //   base64가 DB에 남아 있으면 그 레코드를 모든 사용자가 앱 켤 때마다 통째로 받게 됨.
    async analyzeCatalog(){
      const out = {};
      for(const kind of ['parts','desks','items']){
        const snap = await get(ref(db, `catalog/${kind}`));
        const all = snap.val() || {};
        const recs = [];
        let total = 0, base64Count = 0;
        for(const id in all){
          const r = all[id] || {};
          const size = JSON.stringify(r).length;
          total += size;
          const heavy = [];
          for(const k in r){
            const v = r[k];
            if(typeof v === 'string' && v.length > 2000){
              heavy.push(k + '(' + Math.round(v.length/1024) + 'KB' + (v.startsWith('data:') ? ', base64' : '') + ')');
              if(v.startsWith('data:')) base64Count++;
            }
          }
          recs.push({ id, name: r.name || '', kb: Math.round(size/1024*10)/10, heavy });
        }
        recs.sort((a,b)=> b.kb - a.kb);
        out[kind] = { totalKB: Math.round(total/1024*10)/10, count: recs.length, base64Fields: base64Count, top: recs.slice(0,10) };
      }
      return out;
    },
    subscribeCatalogParts(onChange){
      /* 🎰 두 통(parts + gachaParts)을 합쳐서 한 객체로 넘긴다 — 앱 쪽 병합/삭제 감지는
         "카탈로그 전체 목록"을 기대하기 때문이다.
         ⚠️ 둘 다 최소 한 번 도착하기 전에는 콜백하지 않는다 — parts 가 먼저 오면 아직 안 온
           gachaParts 쪽 파츠들이 "관리자가 삭제한 것"으로 오인돼 착용까지 풀린다
           (mergeCatalogIntoSavedParts 의 removedIds 경로). */
      let parts = null, gacha = null;
      const emit = () => {
        if(parts === null || gacha === null) return;
        const merged = { ...parts };
        for(const id in gacha) merged[id] = { ...gacha[id], gacha: true };
        /* 이관 전 과도기 — parts 쪽에 gacha:true 로 남아 있는 옛 항목 표식.
           앱(관리자 세션)이 이 표식을 보고 migrateGachaCatalog 를 한 번 돌린다. */
        for(const id in parts){ if(parts[id] && parts[id].gacha) merged[id] = { ...parts[id], _legacyGacha: true }; }
        onChange(merged);
      };
      /* 종류별 버전 확인 + 로컬 캐시(catalog-cache.js).
         두 통의 버전은 따로다 — 가챠 파츠만 고치면 gachaParts 만 다시 받는다. 위의 «둘 다 도착하기 전엔 콜백 안 함» 은 그대로. */
      const u1 = _subscribeCatalogKind('parts', v => { parts = v || {}; emit(); });
      const u2 = _subscribeCatalogKind('gachaParts', v => { gacha = v || {}; emit(); });
      return () => { u1(); u2(); };
    },
    /* 🎰 이관 — catalog/parts 에 gacha:true 로 남아 있는 옛 항목을 gachaParts 로 옮긴다.
       멱등이라 몇 번을 불러도 안전하다(옮길 것이 없으면 아무것도 안 한다).
       ★ 이걸 돌리는 순간부터 구버전 클라이언트에서는 그 파츠가 사라진다(착용도 자동 해제) —
         그게 바로 원하는 효과다. */
    async migrateGachaCatalog(){
      const snap = await get(ref(db, 'catalog/parts'));
      const all = snap.val() || {};
      const moved = [];
      for(const id in all){
        const rec = all[id];
        if(!rec || rec.gacha !== true) continue;
        /* 한 update 로 옮긴다(반쯤 옮긴 채로 남지 않는다) + 두 통 버전 올림. */
        await _catalogUpdate({ [`catalog/gachaParts/${id}`]: rec, [`catalog/parts/${id}`]: null }, ['parts', 'gachaParts']);
        moved.push(id);
      }
      return { ok:true, moved };
    },
    // ===== Phase 3: 커스텀 서브카테고리 (관리자가 파츠 종류 추가) =====
    // catalog/customCats/{catId} = { cat, label, icon, group, bone, createdAt }
    async publishCustomCat(catId, data){
      await set(ref(db, 'catalog/customCats/'+catId), Object.assign({}, data, { createdAt: Date.now() }));
      return { ok:true };
    },
    async unpublishCustomCat(catId){
      await remove(ref(db, 'catalog/customCats/'+catId));
      return { ok:true };
    },
    // ===== 🖥️ 마이홈 바탕화면(좀아칼 데스크톱) 배경 — 방문자에게도 보이도록 서버 공유 =====
    // users/{uid}/advBg = { color } 또는 { img }
    /* 🩹 [2026-10-02 제보 #4b·#13] «다른 컴퓨터에서 마이홈을 열면 바탕화면 배경이 초기화되거나 그 기기 것으로 바뀐다»
       [원인] 켤 때마다 각 기기가 **자기 로컬 배경을 서버에 덮어쓰기만** 하고 서버 값을 읽지 않았다(myhome-desktop.js
         advSyncBgOnStart). 그래서 서버는 «마지막에 켠 기기의 배경» 이 되고 기기끼리 서로 덮었다.
       [대응] 값에 ts(고른 시각)를 붙여, 켤 때 서버를 먼저 읽고 **더 최근에 고른 쪽**을 따른다(저쪽 주석).
         ⚠️ 지우기(배경 초기화)도 기록으로 남긴다 — { cleared:true, ts }. 노드를 지워 버리면 «방금 지웠다» 와
           «한 번도 안 골랐다» 가 구분이 안 돼서, 옛 배경을 든 다른 기기가 켜지자마자 도로 올려 버린다.
         ★ 규칙 변경 없음 — advBg 의 .validate 는 img·color 만 검사하고 다른 칸(ts·cleared)을 막지 않는다.
         ★ 방문자 화면은 img·color 가 없으면 «배경 없음» 으로 그린다 — cleared 기록도 그대로 읽힌다. */
    async saveAdvBg(userId, bg){
      try{
        await _whenAuthReady();   // 소유권 쓰기 — 부팅 직후 토큰 없이 나가면 구글 계정은 거부된다
        const rec = bg ? bg : { cleared:true, ts: Date.now() };
        await set(ref(db, `users/${userId}/advBg`), rec);
        return { ok:true };
      }catch(e){ return { ok:false }; }
    },
    async getAdvBg(userId){
      try{ const s=await get(ref(db, `users/${userId}/advBg`)); return s.val() || null; }
      catch(e){ return null; }
    },
    /* 내 배경 동기화용 — **읽기 실패와 «없음» 을 가른다.** getAdvBg 는 둘 다 null 이라, 읽기가 한 번 실패한 것만으로
       옛 로컬 배경을 서버에 덮어쓰는 일이 생긴다(이번 제보와 같은 모양). */
    async getAdvBgEx(userId){
      try{ const s=await get(ref(db, `users/${userId}/advBg`)); return { ok:true, bg: s.val() || null }; }
      catch(e){ return { ok:false, bg:null }; }
    },
    subscribeCustomCats(onChange){
      const r = ref(db, 'catalog/customCats');
      onValue(r, snap => onChange(snap.val() || {}));
      return () => off(r, 'value');
    },
    // ===== 기본(내장) 카테고리 이름/아이콘 덮어쓰기 =====
    // catalog/catOverrides/{catId} = { label, icon } — 예: cape → "겉옷"
    async publishCatOverride(catId, data){
      await set(ref(db, 'catalog/catOverrides/'+catId), Object.assign({}, data, { updatedAt: Date.now() }));
      return { ok:true };
    },
    async unpublishCatOverride(catId){
      await remove(ref(db, 'catalog/catOverrides/'+catId));
      return { ok:true };
    },
    subscribeCatOverrides(onChange){
      const r = ref(db, 'catalog/catOverrides');
      onValue(r, snap => onChange(snap.val() || {}));
      return () => off(r, 'value');
    },
    // Storage에 저장된 GLB를 fetch → base64로 변환 (기존 파츠 로딩 코드와 호환).
    //   앱은 로컬(localStorage/IndexedDB)에서 캐싱을 담당해서 같은 파츠는 두 번 안 받게 함(호출 측).
    async fetchCatalogGlb(url){
      if(!url) throw new Error('empty url');
      const res = await fetch(url);
      if(!res.ok) throw new Error('storage fetch failed '+res.status);
      const buf = await res.arrayBuffer();
      // ArrayBuffer → base64 (한 번에 큰 배열 대상으로 fromCharCode 하면 stack overflow — 청크로 처리)
      const bytes = new Uint8Array(buf);
      let bin = ''; const CHUNK = 0x8000;
      for(let i=0; i<bytes.length; i+=CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+CHUNK));
      return btoa(bin);
    },
    // ===== 📣 확성기 공지 (관리자 → 전체 유저 브로드캐스트, 1분간 유효) — 런처5 =====
    // announce: { text, ts(발행 시각 ms), duration(ms) } — 발행 순간부터 duration 안이면 표시.
    async publishAnnounce(text, durationMs){
      await set(ref(db, 'announce/current'), { text: String(text||'').slice(0,140), ts: Date.now(), duration: +durationMs||60000 });
      return { ok:true };
    },
    async clearAnnounce(){
      await remove(ref(db, 'announce/current'));
      return { ok:true };
    },
    // 전체 유저가 구독 — 초기 접속 시 즉시 1회 + 발행/삭제 시마다 호출. null이면 공지 없음.
    subscribeAnnounce(onChange){
      const r = ref(db, 'announce/current');
      onValue(r, snap => onChange(snap.val() || null));
      return () => off(r, 'value');
    },
    // ===== 📰 업데이트 공지 (관리자가 발행 → 유저 앱 시작 시 팝업) =====
    // updateNotice/current = { title, body, ts } — ts는 발행 시각(버전 구분자로도 씀).
    //   유저가 "다시 보지 않기" 체크하면 localStorage에 그 ts를 기록해서 같은 ts면 스킵.
    async publishUpdateNotice(title, body){
      await set(ref(db, 'updateNotice/current'), {
        title: String(title||'').slice(0,60),
        body: String(body||'').slice(0,800),
        ts: Date.now()
      });
      return { ok:true };
    },
    async clearUpdateNotice(){ await remove(ref(db, 'updateNotice/current')); return { ok:true }; },
    async getUpdateNotice(){
      const snap = await get(ref(db, 'updateNotice/current'));
      return snap.val() || null;
    },
    /* ═══════════ 📩 수령함 (구 DM 자리) ═══════════
       스키마: inbox/{uid}/{msgId} = { tag, title, body, ts, read }
       · tag: 'notice' | 'update' | 'reward'   ← [공지] [업데이트] [보상] 태그로 표시
       · 관리자가 전체 유저에게 일괄 전송(sendInboxBroadcast)하거나,
         시스템(보상 시스템·업데이트 등)에서 특정 유저에게 개별 전송(sendInboxMessage)
       · 유저는 읽기 표시(markInboxRead)와 삭제(deleteInboxMessage)만 가능(작성 불가) */
    subscribeInbox(myId, onChange){
      const r = ref(db, `inbox/${myId}`);
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    async markInboxRead(myId, msgId){
      try{ await update(ref(db, `inbox/${myId}/${msgId}`), { read: true }); }catch(_){}
    },
    async markAllInboxRead(myId){
      try{
        const snap = await get(ref(db, `inbox/${myId}`));
        const v = snap.val() || {};
        const updates = {};
        Object.keys(v).forEach(id=>{ if(!v[id].read) updates[`inbox/${myId}/${id}/read`] = true; });
        if(Object.keys(updates).length) await update(ref(db), updates);
      }catch(_){}
    },
    async deleteInboxMessage(myId, msgId){
      try{ await remove(ref(db, `inbox/${myId}/${msgId}`)); }catch(_){}
    },
    // 개별 유저에게 메시지 전송 — 시스템(보상 지급/업데이트 안내 등)이 호출
    /* extra.bugId — 🐞 답변 알림(tag 'bug')이 가리키는 글. 우편함에서 누르면 그 글을 연다. */
    async sendInboxMessage(toId, tag, title, body, extra){
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const rec = {
        tag: (tag==='update'||tag==='reward'||tag==='bug') ? tag : 'notice',
        title: String(title||'').slice(0,80),
        body:  String(body ||'').slice(0,600),
        ts: Date.now(), read: false,
      };
      if(extra && extra.bugId) rec.bugId = String(extra.bugId).slice(0,40);
      await set(ref(db, `inbox/${toId}/${id}`), rec);
      return { ok:true, id };
    },
    // 관리자: 모든 유저에게 일괄 전송 — users 목록을 읽어서 각자의 inbox에 같은 메시지를 뿌림
    async sendInboxBroadcast(tag, title, body, pinned){
      // ★ 공용 공지 노드(inboxBroadcast)에 1회만 씀 — 모든 유저가 이 노드를 읽음.
      //   (예전엔 users 전체를 읽어 개인 inbox마다 복사했는데, users 전체 읽기가 규칙상 막혀 실패했음.
      //    공지는 내용이 모두 같으니 공용 노드 하나가 맞음. "읽음"은 각자 로컬에 저장.)
      //   📌 pinned=true면 수령함에서 시간과 무관하게 항상 최상단 고정(관리자만 지정).
      const now = Date.now();
      const tagFinal = (tag==='update'||tag==='reward') ? tag : 'notice';
      const id = 'b' + now.toString(36) + Math.random().toString(36).slice(2,6);
      const rec = {
        tag:tagFinal, title:String(title||'').slice(0,80), body:String(body||'').slice(0,600), ts: now
      };
      if(pinned) rec.pinned = true;   // 고정 아닐 땐 아예 키를 안 써서 기존 규칙/데이터와 호환
      await _broadcastUpdate({ [`inboxBroadcast/${id}`]: rec });
      return { ok:true, count:'전체' };
    },
    // 📌 관리자: 기존 공지의 고정 상태만 토글 (내용은 그대로 두고 pinned만 갱신)
    async setInboxBroadcastPinned(msgId, pinned){
      try{
        await _broadcastUpdate({ [`inboxBroadcast/${msgId}/pinned`]: pinned ? true : null });
        return { ok:true };
      }catch(_){ return { ok:false }; }
    },
    // 공용 공지 구독 → onChange({ id:{tag,title,body,ts} }) — 버전 확인 + 로컬 캐시(broadcast-cache.js).
    //   통째가 아니라 최근 30개 + 고정 공지만 온다. 콜백 모양은 예전 통째 onValue 때와 같다.
    subscribeInboxBroadcast(onChange){
      const unsub = _subscribeBroadcast(v => onChange(v || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // 관리자: 공용 공지 삭제
    async deleteInboxBroadcast(msgId){
      try{ await _broadcastUpdate({ [`inboxBroadcast/${msgId}`]: null }); }catch(_){}
    },

    /* ═══════════ 🔑 구글 로그인 — 계정과 유저 코드를 묶는다 ═══════════
       [구조] 신원이 둘이고, 둘을 **줄 두 개로** 묶는다.
         · 유저 코드(userCode) = 기존 `tw.myUserId`. 친구·마이홈·인박스가 전부 이 키에 매달려 있다.
         · Auth uid           = 구글 계정으로 발급되는 계정 식별자.
         묶는 줄:
           authUsers/{authUid} = { userCode, ts }       ← (email 거울은 개정 54 에서 뺌 · §9-2) 로그인할 때 "내 유저 코드가 뭐였지"
           userAuth/{userCode} = authUid               ← 선점 표시(한 유저 코드에 한 계정)
       ★ 왜 유저 코드를 Auth uid 로 **갈아치우지 않는가** — 갈아치우면 친구 양방향 링크,
         친추코드 소유권(friendCodes/{코드}.userId), 인박스, 마이홈, 방명록을 전부 이사시켜야 한다.
         한 곳이라도 실패하면 친구 목록이 반쪽이 되는데 그 상태는 되돌릴 방법이 없다.
         묶는 줄 하나면 데이터는 제자리에 두고 "이 유저 코드의 주인은 이 계정" 만 증명된다.
       ★ 나중에 규칙을 잠글 때도 이 줄이 근거다:
           ".write": "root.child('userAuth/'+$uid).val() === auth.uid"
         지금은 규칙 파일이 이 폴더에 없어 손대지 않았다 — 그때까지 로그인은 '편의' 이고,
         규칙을 바꾼 뒤부터 '자물쇠' 가 된다. 순서를 헷갈리지 말 것.
       ⚠️ 그리고 그 순서를 거꾸로 하면 안 된다. 아직 로그인한 사람이 적을 때 규칙부터 잠그면
         로그인 안 한 기존 유저 전원이 자기 마이홈에 못 쓰게 된다. */
    authAvailable(){ return !!auth; },

    /* 🚧 저장된 로그인 세션이 복원될 때까지 기다린다(최대 8초, 실패해도 반드시 풀린다).
       users/{코드} 아래 **소유권이 걸린 가지에 쓰기 전에** 부를 것. 읽기에는 필요 없다
       — 규칙상 users/{코드} 는 누구나 읽을 수 있고, 읽기까지 늦추면 부팅만 느려진다. */
    authReady(){ return _whenAuthReady(); },
    authSettled(){ return _authSettled; },

    /* 🔎 이 유저 코드의 주인이 있는가 → authUid | null.
       [왜 필요한가] 규칙이 users/{코드} 의 자기 소유 가지를 "주인이 없거나 나일 때"로 잠근 뒤부터,
         **묶여 있는 코드를 로그인 없이 쓰는 기기는 쓰기가 전부 거부된다.** 그런데 거부는 화면에
         아무 표시를 남기지 않는다 — 마이홈을 고쳤는데 다음 부팅에 원래대로 돌아와 있는 식으로만
         드러나고, 유저는 그걸 고장으로 읽는다. 그 침묵을 말로 바꾸려고 미리 물어본다.
       ⚠️ 그래서 userAuth 의 .read 는 열려 있어야 한다(코드→계정 매핑일 뿐 비밀이 아니다).
         auth 를 요구하면 정작 물어봐야 할 쪽 — 로그인 안 한 기기 — 이 못 읽는다.
       ⚠️ 실패는 null 이 아니라 undefined 로 돌려준다. 둘을 섞으면 네트워크가 끊겼을 때
         "주인 없음"으로 읽혀서, 있지도 않은 경고를 띄우거나 반대로 띄워야 할 경고를 삼킨다. */
    async authOwnerOf(userCode){
      if(!userCode) return null;
      try{ const s = await get(ref(db, `userAuth/${userCode}`)); const v = s.val(); return v ? String(v) : null; }
      catch(_){ return undefined; }
    },
    authCurrentUid(){ return (auth && auth.currentUser) ? auth.currentUser.uid : null; },
    authCurrentEmail(){ return (auth && auth.currentUser) ? (auth.currentUser.email || null) : null; },

    /* main.js 가 받아온 구글 ID 토큰으로 로그인하고, 유저 코드와 묶는다.
       @param idToken   companion.signInWithGoogle() 이 돌려준 것
       @param userCode  이 기기의 현재 유저 코드(getMyUserId())
       @return { ok, uid, email, userCode, bound }
               bound=true  → 이 계정이 이 기기 코드를 **새로 가져간** 경우(첫 로그인)
               bound=false → 이미 묶여 있던 계정으로 들어온 경우(기기 이동) */
    async authSignInWithGoogle(idToken, userCode){
      if(!auth) return { ok:false, reason:'로그인 기능을 쓸 수 없어요 (초기화 실패)' };
      if(!idToken) return { ok:false, reason:'구글 토큰이 없어요' };
      let cred = null;
      try{
        cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      }catch(e){
        const c = String((e && e.code) || e || '');
        if(c.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [Google] 로그인을 켜주세요' };
        if(c.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'구글 계정 확인에 실패했어요 (' + (c || '알 수 없음') + ')' };
      }
      const uid = cred.user.uid;
      const email = cred.user.email || null;
      try{
        // ① 이 계정에 이미 묶인 유저 코드가 있는가 — 있으면 그것이 정답이다(기기 이동).
        const s = await get(ref(db, `authUsers/${uid}`));
        const v = s.val();
        if(v && v.userCode){
          /* 📭 (회원가입 설계 §9-2 · CHECKS 개정 54) 서버에 이메일 거울을 두지 않는다 — 예전 판이 남긴 것은 여기서 걷는다.
             userCode 는 절대 건드리지 않는다. 이메일은 돌려주기만 한다(이 PC 의 계정 표시용 · 로컬). */
          if(v.email != null){ try{ await update(ref(db, `authUsers/${uid}`), { email: null }); }catch(_){} }
          return { ok:true, uid, email, userCode:String(v.userCode), bound:false };
        }
        /* ② 이 계정의 첫 로그인 — 이 기기의 유저 코드를 가져간다.
           ★ userCode 가 비어 있으면 **묶지 않고 물러난다.** 부르는 쪽(app.js _loginDoGoogle)이
             "이 기기의 코드는 아직 계정이라고 부를 수 없다"고 판단해서 일부러 비워 보낸 것이다.
           [경위] 예전에는 부르는 쪽이 getMyUserId() 를 그대로 넘겼는데, 그 함수는 코드가 없으면
             **그 자리에서 새로 만들어낸다.** 그래서 초대 게이트에서 [구글 로그인]을 누른 새 기기는
             방금 태어난 임시 코드를 이 계정에 영구히 묶어놓고, 화면에는 "연결된 기록이 없어요"라며
             입장을 거부당했다. 그다음 원래 컴퓨터에서 로그인하면 서버가 그 빈 코드를 정답으로
             돌려줘서 마이홈·친구가 통째로 사라졌다. 묶기를 거절하는 이 한 줄이 그 경로를 끊는다.
           ⚠️ 로그아웃까지 해야 한다 — 세션만 남기면 "로그인은 됐는데 계정은 없는" 상태가 된다(규약 ⑤).
             막 생긴 계정은 로그아웃 대신 지운다(_dropGoogleSession). */
        if(!userCode){
          await _dropGoogleSession(cred);
          return { ok:false, needCode:true, reason:'이 구글 계정에 연결된 기록이 없어요' };
        }
        /* 선점은 runTransaction 으로. set 으로 덮으면 한 기기에서 두 계정으로 로그인한 사람이
           먼저 묶인 계정의 데이터를 통째로 빼앗는다. */
        const tr = await runTransaction(ref(db, `userAuth/${userCode}`), cur => (cur == null ? uid : undefined));
        const owner = tr && tr.snapshot ? tr.snapshot.val() : null;
        if(owner !== uid){
          /* 이 기기 코드는 이미 남의 계정 것이다. 로그아웃시켜 되돌린다 —
             로그인 상태로 남겨두면 "로그인은 됐는데 내 데이터가 아닌" 상태가 된다. */
          await _dropGoogleSession(cred);
          return { ok:false, reason:'이 기기의 계정은 이미 다른 구글 계정에 연결돼 있어요.' };
        }
        await set(ref(db, `authUsers/${uid}`), { userCode:String(userCode), ts: Date.now() });   // 이메일 거울 없음(§9-2)
        return { ok:true, uid, email, userCode:String(userCode), bound:true };
      }catch(e){
        try{ await fbSignOut(auth); }catch(_){}
        return { ok:false, reason:'계정 연결에 실패했어요 — 잠시 뒤 다시 시도해 주세요' };
      }
    },
    /* 🔑 [회원가입 설계 §3 H · §4 · 개정 8] 친구 코드 + 비밀번호 로그인 — 처음 쓰는 PC 의 기존 사용자.
       아이디는 친구 코드, Auth 이메일은 `{코드 소문자}@tw.local`(§4 표). 가입(A · I)이 만든 계정만 여기로 들어온다.
       ★ 결속은 하지 않는다 — 읽기만 한다. `authUsers/{authUid}.userCode` 가 없으면 로그아웃시키고 거절한다
         (구글 쪽 «userCode=null 거절»과 같은 이유: 로그인은 됐는데 계정은 없는 상태를 남기지 않는다).
       ⚠️ Firebase 콘솔에서 [이메일/비밀번호] 로그인을 켜야 한다 — 꺼져 있으면 operation-not-allowed. */
    async authSignInWithFriendCode(code, password){
      if(!auth) return { ok:false, reason:'로그인 기능을 쓸 수 없어요 (초기화 실패)' };
      const c = String(code || '').trim().toUpperCase();
      if(!c || !password) return { ok:false, reason:'친구 코드와 비밀번호를 입력해 주세요' };
      const email = c.toLowerCase() + '@tw.local';
      let cred = null;
      try{
        cred = await signInWithEmailAndPassword(auth, email, String(password));
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [이메일/비밀번호] 로그인을 켜주세요' };
        if(k.includes('too-many-requests')) return { ok:false, reason:'시도가 너무 많았어요 — 잠시 뒤 다시 해 주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        if(k.includes('invalid-credential') || k.includes('wrong-password') || k.includes('user-not-found') || k.includes('invalid-email') || k.includes('invalid-login'))
          return { ok:false, reason:'친구 코드나 비밀번호가 맞지 않아요' };
        return { ok:false, reason:'로그인에 실패했어요 (' + (k || '알 수 없음') + ')' };
      }
      const uid = cred.user.uid;
      try{
        const v = (await get(ref(db, `authUsers/${uid}`))).val();
        if(v && v.userCode) return { ok:true, uid, email, userCode:String(v.userCode) };
        try{ await fbSignOut(auth); }catch(_){}
        return { ok:false, reason:'이 친구 코드의 계정 기록을 찾지 못했어요' };
      }catch(e){
        try{ await fbSignOut(auth); }catch(_){}
        return { ok:false, reason:'계정을 확인하지 못했어요 — 잠시 뒤 다시 시도해 주세요' };
      }
    },
    /* ✍️ [회원가입 설계 §3 A · §9-6 (a) · 개정 10] 가입 — 익명 로그인 → (앱: ② uid · ③ 코드 선점) → ④ 비밀번호 연결 → ⑤ 결속.
       세 통로로 나눈 이유: ③ 은 앱이 한다(친구 코드 후보·재추첨이 app.js 몫) — 그 사이에 끊겨도 각 통로가 **다시 불러도 되게** 짰다.

       ① authSignupEnsure(email) — 쓸 Auth 세션을 준비한다.
          · 익명 세션이 있으면 그대로(같은 authUid 로 이어 간다 — 중단 뒤 재시도).
          · 이미 그 이메일(`{코드}@tw.local`)로 승격된 세션이면 그대로(④ 는 됐고 ⑤ 에서 끊긴 판).
          · 다른 세션(구글 등)이면 놓고 익명으로 — 남의 계정에 비밀번호를 붙이지 않는다.
          ⚠️ 콘솔에서 [익명] 로그인이 꺼져 있으면 admin-restricted-operation. */
    async authSignupEnsure(email){
      if(!auth) return { ok:false, reason:'로그인 기능을 쓸 수 없어요 (초기화 실패)' };
      try{ await _whenAuthReady(); }catch(_){}   // 저장된 세션을 다 읽은 뒤에 본다 — 안 그러면 이어 갈 익명 세션을 못 보고 새로 만든다
      const cu = auth.currentUser;
      if(cu && (cu.isAnonymous || (email && cu.email === email))) return { ok:true, authUid:cu.uid, anonymous:!!cu.isAnonymous };
      if(cu){ try{ await fbSignOut(auth); }catch(_){} }
      try{
        const cred = await signInAnonymously(auth);
        return { ok:true, authUid:cred.user.uid, anonymous:true };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('admin-restricted') || k.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [익명] 로그인을 켜주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'가입을 시작하지 못했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* ② authSignupLinkPassword(code, pw) — ④ 지금 세션(익명)에 `{코드}@tw.local` + 비밀번호를 붙여 승격한다. authUid 는 그대로.
          · 이미 그 이메일이면 성공으로 친다(재시도). */
    async authSignupLinkPassword(code, password){
      if(!auth || !auth.currentUser) return { ok:false, reason:'가입 세션이 없어요 — 다시 시도해 주세요' };
      const email = String(code || '').trim().toLowerCase() + '@tw.local';
      const cu = auth.currentUser;
      if(cu.email === email) return { ok:true, authUid:cu.uid, email };
      try{
        const cred = await linkWithCredential(cu, EmailAuthProvider.credential(email, String(password)));
        return { ok:true, authUid:cred.user.uid, email };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [이메일/비밀번호] 로그인을 켜주세요' };
        if(k.includes('weak-password')) return { ok:false, reason:'비밀번호가 너무 쉬워요 — 6자 이상으로 정해 주세요' };
        if(k.includes('email-already-in-use') || k.includes('credential-already-in-use')) return { ok:false, taken:true, reason:'이 친구 코드는 이미 가입돼 있어요' };
        if(k.includes('provider-already-linked')) return { ok:false, reason:'이미 비밀번호가 붙은 계정이에요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'계정을 만들지 못했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* ③ authSignupBind(userCode) — ⑤ 결속: userAuth/{uid} = authUid 선점(runTransaction · authSignInWithGoogle 과 같은 규칙) → authUsers/{authUid}.
          · 이미 내 것이면 그대로(재시도). 남의 것이면 거절(taken) — 부르는 쪽이 새 uid 로 다시 시작한다.
          · 이메일 거울은 두지 않는다(§9-2 권고 — 친구 코드 계정의 이메일은 코드에서 나온다). */
    async authSignupBind(userCode){
      if(!auth || !auth.currentUser) return { ok:false, reason:'가입 세션이 없어요 — 다시 시도해 주세요' };
      const authUid = auth.currentUser.uid;
      try{
        const tr = await runTransaction(ref(db, `userAuth/${userCode}`), cur => (cur == null || cur === authUid ? authUid : undefined));
        const owner = tr && tr.snapshot ? tr.snapshot.val() : null;
        if(owner !== authUid) return { ok:false, taken:true, reason:'이 아이디는 이미 다른 계정에 연결돼 있어요' };
        await set(ref(db, `authUsers/${authUid}`), { userCode:String(userCode), ts: Date.now() });
        return { ok:true, authUid };
      }catch(e){
        return { ok:false, reason:'계정 연결에 실패했어요 — 잠시 뒤 다시 시도해 주세요' };
      }
    },
    /* 🔗 [회원가입 설계 §7-J · 개정 13] 지금 로그인한 계정(비밀번호로 막 가입)에 구글을 **붙인다** — 같은 authUid 그대로.
       authSignInWithGoogle 과 다르다: 그쪽은 구글로 **로그인**(세션이 바뀐다), 이쪽은 지금 세션에 구글 자격을 더한다.
       · 그 구글이 이미 다른 계정의 것이면 거절(자동 병합 없음 · 설계 §4 표). */
    async authLinkGoogle(idToken){
      if(!auth || !auth.currentUser) return { ok:false, reason:'로그인 상태가 아니에요 — 다시 시도해 주세요' };
      try{
        const cred = await linkWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
        const g = (cred.user.providerData || []).find(p => p && p.providerId === 'google.com');
        return { ok:true, email: (g && g.email) || null };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('credential-already-in-use') || k.includes('email-already-in-use')) return { ok:false, reason:'이 구글 계정은 이미 다른 계정에 쓰이고 있어요' };
        if(k.includes('provider-already-linked')) return { ok:true, already:true, email:null };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'구글을 연결하지 못했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    async authSignOut(){ if(auth){ try{ await fbSignOut(auth); }catch(_){} } },

    /* 🔐 [회원가입 설계 §7-C2·C3 · 개정 14] 로그인 수단 — 계정 탭이 «구글 · 친구 코드+비밀번호» 를 보이고 비밀번호를 만들거나 바꾼다.
       ★ 이 셋은 authSignOut **뒤**에 둔다 — sim-signup 5·6·9절이 authSignInWithFriendCode ~ authSignOut 을 떼어 본다(CHECKS §36 ★).
       authProviders() → null(세션 없음) | { authUid, anonymous, google, googleEmail, password, passwordEmail } */
    authProviders(){ return _providersOf(auth && auth.currentUser); },
    /* C3 · 비밀번호 만들기 — 구글만 있는 계정에 `{코드 소문자}@tw.local` + 비밀번호를 **붙인다**(같은 authUid · 함수 없음).
       이 뒤로 H·K 의 [친구 코드로 로그인](authSignInWithFriendCode)이 이 계정으로 들어온다(authUsers/{authUid}.userCode 가 이미 있다).
       · 로그인한 지 오래됐으면 Firebase 가 requires-recent-login 을 낸다 → needReauth — 부르는 쪽이 구글 재인증(authReauthGoogle) 뒤 다시 부른다.
       · 이미 비밀번호가 있으면 already(C2 몫). 그 이메일이 이미 남의 계정이면 taken. */
    async authLinkPassword(code, password){
      if(!auth || !auth.currentUser) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
      const cu = auth.currentUser;
      if(cu.isAnonymous) return { ok:false, reason:'가입이 끝나지 않은 계정이에요' };
      const c = String(code || '').trim();
      if(!c) return { ok:false, reason:'친구 코드를 확인하지 못했어요' };
      if((cu.providerData || []).some(p => p && p.providerId === 'password')) return { ok:false, already:true, reason:'이미 비밀번호가 있는 계정이에요' };
      const email = c.toLowerCase() + '@tw.local';
      try{
        await linkWithCredential(cu, EmailAuthProvider.credential(email, String(password)));
        return { ok:true, email };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('requires-recent-login')) return { ok:false, needReauth:true, reason:'구글로 한 번 더 확인이 필요해요' };
        if(k.includes('weak-password')) return { ok:false, reason:'비밀번호가 너무 쉬워요 — 6자 이상으로 정해 주세요' };
        if(k.includes('email-already-in-use') || k.includes('credential-already-in-use')) return { ok:false, taken:true, reason:'이 친구 코드로 된 비밀번호 계정이 따로 있어요 — 알려 주세요' };
        if(k.includes('provider-already-linked')) return { ok:false, already:true, reason:'이미 비밀번호가 있는 계정이에요' };
        /* [이메일/비밀번호] 로그인은 A 가입 때문에 이미 켜져 있다 — 여기서 이게 나면 «이메일 바꾸기 전 확인» 정책에 걸린 것일 수 있다(실기기 확인 거리). */
        if(k.includes('operation-not-allowed')) return { ok:false, reason:'이 계정에는 지금 비밀번호를 붙일 수 없어요 (operation-not-allowed) — 알려 주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'비밀번호를 만들지 못했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* 구글 재인증 — 지금 세션을 **바꾸지 않고** 최근 로그인만 새로 한다(C3 의 requires-recent-login 뒤). 다른 구글을 고르면 user-mismatch. */
    async authReauthGoogle(idToken){
      if(!auth || !auth.currentUser) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
      try{
        await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
        return { ok:true };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('user-mismatch')) return { ok:false, reason:'이 계정에 연결된 구글 계정으로 골라 주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'구글 확인에 실패했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* C2 · 비밀번호 바꾸기 — **지금 비밀번호를 묻지 않는다**((가)). 함수 `changePassword`(호출형)가 ID 토큰으로 본인을 확인하고
       Admin SDK 로 바꾼 뒤 이 계정의 refresh token 을 끊는다 → 다른 PC 는 다음 부팅에 K.
       ★ 이 PC 도 같이 끊기므로 함수가 돌아오면 **새 비밀번호로 곧바로 다시 로그인**한다(같은 authUid · 결속 그대로).
         다시 로그인이 실패해도 바꾸기는 성공이다(relogged:false) — 부르는 쪽이 «다시 시작하면 로그인 화면» 을 말한다.
       ★ 로그인 아이디는 친구 코드 거울이 아니라 **password 제공자의 이메일** 그대로 쓴다(그게 Auth 가 아는 아이디다). */
    async authChangePassword(password){
      const pv = _providersOf(auth && auth.currentUser);
      if(!pv) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
      if(!pv.password || !pv.passwordEmail) return { ok:false, reason:'비밀번호가 없는 계정이에요 — 먼저 비밀번호를 만들어 주세요' };
      const pw = String(password || '');
      if(pw.length < 6) return { ok:false, reason:'비밀번호는 6자 이상으로 정해 주세요' };
      let mod = null;
      try{ mod = await import(FUNCTIONS_SDK_URL); }
      catch(_){ return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' }; }
      try{
        const fns = mod.getFunctions(fbApp, FUNCTIONS_REGION);
        await mod.httpsCallable(fns, 'changePassword')({ password: pw });
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('not-found')) return { ok:false, reason:'서버에 비밀번호 바꾸기 기능이 아직 없어요 (함수 배포 전)' };
        if(k.includes('unauthenticated')) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
        if(k.includes('invalid-argument')) return { ok:false, reason:'비밀번호는 6자 이상으로 정해 주세요' };
        if(k.includes('failed-precondition')) return { ok:false, reason:'비밀번호가 없는 계정이에요 — 먼저 비밀번호를 만들어 주세요' };
        if(k.includes('resource-exhausted')) return { ok:false, reason:'시도가 너무 많았어요 — 잠시 뒤 다시 해 주세요' };
        if(k.includes('unavailable') || k.includes('deadline') || k.includes('internal') || k.includes('network')) return { ok:false, reason:'서버에 닿지 못했어요 — 잠시 뒤 다시 시도해 주세요 (' + k + ')' };
        return { ok:false, reason:'비밀번호를 바꾸지 못했어요 (' + (k || '알 수 없음') + ')' };
      }
      try{
        const cred = await signInWithEmailAndPassword(auth, pv.passwordEmail, pw);
        return { ok:true, relogged: !!(cred && cred.user && cred.user.uid === pv.authUid) };
      }catch(_){ return { ok:true, relogged:false }; }
    },

    /* ═══════════ 🖥️ 한 계정 한 기기 — users/{uid}/session ═══════════ [2026-09-17 제보 3 · 시안 확정]
       [제보] 서브 PC 와 기본 PC 둘 다 로그인해 두면 투게더룸·워킹룸에 다중 접속이 된다. 한쪽에 로그인하면
         다른 쪽은 풀리거나 접속이 막혔으면 한다. 제보 ②(오프라인으로 둔 계정이 온라인으로 뜸)도 같은
         뿌리다 — presence 는 계정당 한 노드인데 두 기기가 각자 쓰고 각자 onDisconnect 를 건다.
       [구조] users/{uid}/session = { id, at }. 부팅 때 id 를 새로 뽑아 쓰고 그 노드를 구독한다.
         내가 쓴 id 가 아닌 값이 오면 **이 기기는 밀려난 것** — 방에서 나오고 presence 쓰기를 멈추고
         app.js 가 차단 화면을 띄운다. «여기서 계속 쓰기» 는 다시 claim 하는 것이고, 그러면 반대쪽이 밀린다.
       ★ 로그아웃이 아니다. 로그아웃(_loginDoLogout)은 올리고→검문→지움이 도는 무거운 길이라 원격 신호로
         돌리면 검문에 걸린 기기가 반쯤 남는다. 밀려난 기기는 신원·소지품 그대로, **방 접속과 presence 만** 놓는다.
       ★ 로그인 계정만 대상이다. 로그인 없이는 두 기기가 같은 uid 를 가질 일이 없고, 규칙도 auth 로 잠근다.
       ⚠️ 규칙 파일에 이 블록이 없으면 쓰기가 조용히 거부돼 **지금과 똑같이 둘 다 그대로**다(더 나빠지지 않는다).
         필요한 규칙:  "session": {
                       ".write": "root.child('userAuth/'+$uid).exists() && root.child('userAuth/'+$uid).val() === auth.uid",
                       ".validate": "!newData.exists() || (newData.hasChildren(['id','at']) && ...)" }   ← 실제 문구는 규칙 파일
       ⚠️ presence 를 여기서 false 로 쓰지 않는다 — 그 노드는 이제 이긴 쪽 것이다. 내 onDisconnect 만 거둔다. */
    claimDeviceSession(userId, onLost){
      if(!userId) return Promise.resolve(false);
      return _whenAuthReady().then(async ()=>{
        if(!(auth && auth.currentUser)) return false;           // 로그인 안 한 기기 — 대상 아님
        const myId = 's' + _svNow().toString(36) + Math.random().toString(36).slice(2, 8);
        _sessionId = myId; _sessionLost = false;
        if(_sessionUnsub){ try{ _sessionUnsub(); }catch(_){} _sessionUnsub = null; }
        _sessionRef = ref(db, `users/${userId}/session`);
        try{ await set(_sessionRef, { id: myId, at: serverTimestamp() }); }
        catch(e){ console.warn('[세션] 기기 세션 기록 실패(규칙 미배포?) — 다중 접속 차단 없이 계속', e); _sessionRef = null; return false; }
        const lose = (v) => {
          if(_sessionLost) return;
          _sessionLost = true;
          /* presence 를 놓는다 — 내 onDisconnect 가 남아 있으면 내가 꺼질 때 이긴 쪽을 오프라인으로 만든다. */
          try{ if(_myPresenceRef) onDisconnect(_myPresenceRef).cancel(); }catch(_){}
          _myPresenceRef = null;
          try{ if(typeof onLost === 'function') onLost(v); }catch(_){}
        };
        /* 읽기 거부로 끊김도 밀림 — 같은 계정의 ≤0.10.2 는 presence(ver 없음)를 session 보다 먼저 써서 규칙(옛 앱 읽기 막기)이 이 구독부터 끊는다 */
        _sessionUnsub = onValue(_sessionRef, snap => { const v = snap.val(); if(v && v.id && v.id !== _sessionId) lose(v); }, () => lose(null));
        return true;
      });
    },
    deviceSessionLost(){ return !!_sessionLost; },
    /* 로그아웃·연동 해제 때 — 내 것일 때만 지운다(남의 세션을 지우면 그쪽이 밀린다). */
    async releaseDeviceSession(){
      if(_sessionUnsub){ try{ _sessionUnsub(); }catch(_){} _sessionUnsub = null; }
      if(_sessionRef && _sessionId && !_sessionLost){
        try{ await runTransaction(_sessionRef, cur => (cur && cur.id === _sessionId) ? null : undefined); }catch(_){}
      }
      _sessionRef = null; _sessionId = null; _sessionLost = false;
    },

    /* 🔁 (걷음 · 회원가입 설계 §6-⑧ · CHECKS 개정 52) 결속 고쳐 매기 `authRebindUserCode` — 되찾기 UI(§6-⑤ · 개정 45)가 유일한
       호출자였다. 결속을 되돌릴 일(구글 로그인의 갈아타기)은 게이트(H · K)가 닫았다. */

    /* 계정 스냅샷 — 로그인한 새 기기가 곧바로 받아가는 값들.
       ★ 여기 담기는 건 '서버에 실시간 사본이 없는 것들'뿐이다 — 라이선스·이름·친추코드(·집중 누적초).
         집중 누적초·플레이리스트·가챠·마이홈은 각자 users/{uid} 아래에 사본이 있어서
         유저 코드만 갈아타면 저절로 따라온다.
       ★ [회원가입 설계 §9-12 · 개정 23 · CHECKS 개정 55] 자리는 **accountSnap/{userCode}** — 주인만 읽고 쓴다.
         예전 자리 users/{uid}/transferData 는 `users/$userId .read:true` 아래라 라이선스 키가 누구에게나 읽혔다
         (RTDB 는 아래 가지에서 읽기를 거둘 수 없다). 규칙은 그 자리를 이제 **지우기만** 받는다.
         옮기는 길은 둘: ① 여기(쓸 때 옛 자리를 같이 지움 · 읽을 때 옛 것만 있으면 옮기고 지움)
                        ② 일회용 함수 moveAccountSnap 이 안 들어오는 사람 몫을 옮겼다(2026-09-22 left 0 확인 뒤 걷음).
       ⚠️ 새 자리는 결속된 코드만 쓴다(userAuth/{코드} === 내 authUid). 부르는 셋(가입 끝 · 구글 첫 결속 · 부팅)은 다 결속 뒤다.
       ⚠️ 값이 규칙 범위를 벗어나면 그 항목만 뺀다 — 하나가 틀려 통째로 거절되면 라이선스까지 못 남긴다. */
    async setAccountSnapshot(userCode, snap){
      if(!userCode || !snap) return { ok:false };
      await _appVer.ready;
      const ver = _appVer.get();
      const write = (v) => update(ref(db), {
        [`accountSnap/${userCode}`]: _acctSnapClean(snap, Date.now(), v),
        [`users/${userCode}/transferData`]: null
      });
      try{ await write(ver); return { ok:true }; }
      catch(e){
        // 규칙에 accountSnap ver 가 아직 없으면($other:false) 통째로 거절된다 — 라이선스는 남기도록 ver 를 빼고 한 번 더.
        if(ver){ try{ await write(null); return { ok:true }; }catch(_){} }
        return { ok:false };
      }
    },
    /* 로그인 직후 복원용 — 옛 verifyTransfer(개정 52 걷음)가 돌려주던 것과 **같은 모양**
       { ok, license, focusTotalSec, name, friendCode } — app.js 의 _applyTransferSnapshot 이 이 모양 하나만 받는다(복원 규칙이 한 벌).
       순서: 새 자리 → (없거나 못 읽으면) 옛 자리 — 옛 것이 있으면 새 자리로 옮기고 옛 자리를 지운다(실패해도 값은 돌려준다)
             → 그래도 없는 이름·친추코드는 제자리(profile · friendCode)에서. */
    async fetchAccountSnapshot(userCode){
      const out = { ok:true, license:null, focusTotalSec:null, name:null, friendCode:null };
      if(!userCode) return out;
      let tv = null;
      try{ const s = await get(ref(db, `accountSnap/${userCode}`)); tv = s.val(); }catch(_){ tv = null; }
      if(!tv){
        let old = null;
        try{ const td = await get(ref(db, `users/${userCode}/transferData`)); old = td.val(); }catch(_){}
        if(old && typeof old === 'object'){
          tv = old;
          try{
            await update(ref(db), {
              [`accountSnap/${userCode}`]: _acctSnapClean(old, Number.isFinite(old.ts) ? old.ts : Date.now()),
              [`users/${userCode}/transferData`]: null
            });
          }catch(_){}   // 못 옮겨도 이번 복원은 한다 — 다음 부팅의 setAccountSnapshot 이 옮긴다
        }
      }
      if(tv){
        out.license = (typeof tv.license === 'string' && tv.license) ? tv.license : null;
        out.focusTotalSec = Number.isFinite(tv.focusTotalSec) ? tv.focusTotalSec : null;
        out.name = tv.name || null;
        out.friendCode = tv.friendCode || null;
      }
      // 폴백 — 스냅샷을 한 번도 안 쓴 계정도 이름·친추코드는 제자리에 있다.
      if(out.name == null){ try{ const pf = await get(ref(db, `users/${userCode}/profile`)); const pv = pf.val(); if(pv && pv.name) out.name = pv.name; }catch(_){} }
      if(out.friendCode == null){ try{ const fc = await get(ref(db, `users/${userCode}/friendCode`)); const fv = fc.val(); if(typeof fv === 'string' && fv) out.friendCode = fv; }catch(_){} }
      return out;
    },

    /* ===== 📤 계정 이전 (디바이스 이동) — 걷음 (회원가입 설계 §6-⑧ · CHECKS 개정 52) =====
       `setTransferHash` · `verifyTransfer` 는 [설정 › 계정 › 계정 이전/연동](개정 45 에서 걷음)만 불렀다.
       ★ 계정 스냅샷은 `accountSnap/{uid}` 로 옮겼다(개정 55 · 위). 옛 `users/{uid}/transferData` 는 규칙이 «지우기만» 받는다.
         `transferHash` 는 규칙이 «지우기만» 받는다(개정 45). */

    /* ===== 🧟 좀비 어드벤처 파티 시스템 — 은퇴(stub) =====
       게임은 adventure-zombie.js(현 myhome-desktop.js)의 ADV_GAME_OFF 스위치로 이미 꺼져 있고,
       유저가 들어갈 경로도 없다. 그래서 실제 RTDB 접근부(parties / partyInvites / mergeRequests /
       advGame)를 전부 걷어냈다.

       ⚠️ 왜 '삭제'가 아니라 '빈 껍데기'인가 —
         게임 코드의 firebaseAPI.adv* 호출 66곳 중 11곳은 fbReady() 게이트 밖에 있다(파티 초대·
         전투 구독 계열). 게임 창이 열리지 않으니 실행될 일은 없지만 정적으로 증명되지는 않는다.
         메서드를 없애버리면 만에 하나 그 경로가 돌 때 TypeError로 마이홈이 통째로 죽는다.
         껍데기로 두면 그 위험 없이 DB 경로 참조만 사라진다(audit 검사7이 이 참조를 본다).

       ⚠️ 구독 계열(advWatch*)은 반드시 '해지 함수'를 돌려줘야 한다 —
         호출부가 unsub()을 그대로 부르기 때문에 null을 주면 그 자리에서 TypeError가 난다.

       게임을 되살리려면: 이 블록을 git 히스토리에서 복원 + ADV_GAME_OFF=false +
       firebase-database-rules.json 에 parties/partyInvites/mergeRequests/advGame 규칙 부활. */
    async advGetFriends(){ return {}; },
    async advCreateParty(){ return null; },
    advWatchParty(){ return ()=>{}; },
    advWatchInvites(){ return ()=>{}; },
    advWatchMergeRequests(){ return ()=>{}; },
    async advSendInvite(){ return { ok:false, reason:'서비스 종료' }; },
    async advClearInvite(){},
    async advJoinParty(){ return { ok:false, reason:'서비스 종료' }; },
    async advUpdateMember(){},
    async advLeaveParty(){ return { ok:true }; },
    async advDisbandParty(){ return { ok:true }; },
    async advRestoreParty(){ return { ok:true }; },
    async advSetLeader(){ return { ok:true }; },
    async advSetDeparted(){ return { ok:true }; },
    async advSetAtCamp(){ return { ok:true }; },
    async advSendGameChat(){ return { ok:true }; },
    advWatchGameChat(){ return ()=>{}; },
    async advWriteCombat(){ return { ok:true }; },
    advWatchCombat(){ return ()=>{}; },
    async advWriteGauge(){ return { ok:true }; },
    advWatchGauge(){ return ()=>{}; },
    async advWriteCoord(){ return { ok:true }; },
    advWatchCoords(){ return ()=>{}; },
    async advFindLeaderParty(){ return null; },
    async advSendMerge(){ return { ok:false, reason:'서비스 종료' }; },
    async advClearMerge(){},
    async advMergeParties(){ return { ok:false, reason:'서비스 종료' }; },

    /* ═══════════ 📷 스티커사진 어댑터 (parts/purikura-net.js 전용) ═══════════
       purikura-net.js 는 THREE 도 DOM 도 firebase SDK 도 안 본다 — **아래 일곱 개만** 쓴다.
       그 덕에 node 에서 그대로 굴러가고 sim-purikura-net.js 가 가짜 서버로 검사할 수 있다.
       ⚠️ 경로는 부르는 쪽이 통째로 준다(예: 'rooms/ABCD/_photo/p/2'). 여기서 조립하지 않는다 —
         조립을 두 군데서 하면 언젠가 한쪽만 고쳐진다.
       ⚠️ 이름 앞의 pk 는 일부러다. 위 메서드들과 섞이면 '어디까지가 그 계층인가'가 흐려지고,
         이 계층만 따로 떼어 검사하는 구조가 무너진다. */
    pkGet(path){ return get(ref(db, path)).then(s => s.val()); },
    pkSet(path, value){ return set(ref(db, path), value); },
    pkUpdate(path, obj){ return update(ref(db, path), obj); },
    pkRemove(path){ return remove(ref(db, path)); },

    /* 🚨 여기가 이 어댑터 일곱 개 중 **유일하게 위험한 자리**다.
       purikura-net.js 의 계산 함수는 "쓰지 않는다"를 `null` 로 돌려준다(quotaNext:
       오늘치 소진 · 내 시계가 뒤에 있음). SDK 독립적인 계층이라 그 약속이 맞다.
       그런데 firebase 의 runTransaction 은 **null 을 '그 노드를 지워라'로 읽고 커밋한다.**
       중단은 `undefined` 다. 그대로 넘기면 200번째 다음 사람이 photoQuota 를 **지우고**,
       카운터가 0 부터 다시 시작해 하루 정원이 통째로 무너진다.
       ⚠️ 게다가 규칙도 못 막는다 — .validate 는 삭제에는 안 돌기 때문이다.
       ⚠️ 화면에는 아무 표시가 안 난다. 오히려 "잘 찍힌다".
       → 그래서 «SDK 의 말투로 옮기는 일»을 이 경계에서 한다. 계층 쪽을 고치지 말 것 —
         null 로 두는 편이 가짜 서버에서 읽기 쉽다(sim-purikura-net.js 가 그 약속에 기대 있다).
       ⚠️ 이 계층에는 '노드를 지우는 트랜잭션'이 없다. 생기면 그때 이 매핑을 다시 볼 것. */
    pkTransaction(path, fn){
      return runTransaction(ref(db, path), cur => {
        const v = fn(cur);
        return (v === null) ? undefined : v;      // null = 중단(≠ 삭제)
      }).then(r => ({
        committed: !!(r && r.committed),
        value: (r && r.snapshot) ? r.snapshot.val() : null
      }));
    },

    /* 구독. ⚠️ 반드시 «해제 함수»를 돌려줘야 한다 — 부르는 쪽(watchQuota·subscribe)이
       그걸 그대로 들고 있다가 창을 닫을 때 부른다. 삼키면 구독이 영영 안 끊긴다. */
    pkOnValue(path, cb){
      const r = ref(db, path);
      const un = onValue(r, s => {
        try{ cb(s.val()); }catch(e){ console.warn('[스티커사진] 구독 콜백 오류', path, e); }
      });
      return () => { try{ un(); }catch(_){ try{ off(r); }catch(__){} } };
    },
    pkOnDisconnectRemove(path){ return onDisconnect(ref(db, path)).remove(); },
    /* ⚠️ onDisconnect 는 **경로에 걸린다 — 값이 아니라.** 자리를 놓고 나서도 예약이 살아 있으면,
       그 사이 그 칸을 물려받은 **다른 사람의 자리**를 내 브라우저가 꺼질 때 지운다.
       방 멤버 쪽(joinRoom 의 수동 퇴장)은 이미 같은 이유로 cancel 을 부른다 — 여기만 빠져 있었다. */
    pkOnDisconnectCancel(path){ return onDisconnect(ref(db, path)).cancel(); },

    /* 🖼 올린 프레임을 Storage 에 올리고 **URL 만** 돌려준다.
       ★ 왜 _uploadDataUrlIfNeeded 를 안 쓰나 — 그쪽은 업로드가 실패하면 **dataURL 을 그대로
         돌려준다.** 프로필 사진에는 맞는 처리다(이미지가 통째로 날아가느니 DB 에 두는 게 낫다).
         그런데 여기서는 그 값이 곧장 setFrameUrl → rooms/{방}/_photo/frames 로 간다.
         RTDB 다운로드 단가는 $5/GB, Storage 는 $0.12/GB — **40배**다. 게다가 프레임은 방에 있는
         전원이 내려받는다. 실패 한 번이 요금 사고가 되는 자리라 여기서는 **실패를 실패로** 알린다.
       ⚠️ 규칙도 이걸 한 번 더 막는다(frames/$i 가 https:// 로 시작하는 문자열만 받는다).
         둘 다 있어야 한다 — 규칙은 배포를 잊을 수 있고, 여기는 규칙보다 먼저 잡아 화면에 안내를 띄운다.
       ⚠️ WebP 로 보낼 것(부르는 쪽 책임). 같은 그림이 PNG 464KB → WebP 65KB 다. */
    async pkUploadFrame(path, dataUrl){
      if(typeof dataUrl !== 'string' || !dataUrl.startsWith('data:'))
        throw new Error('프레임은 dataURL 이어야 합니다');
      const storageRef = sref(storage, path);
      await uploadString(storageRef, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE });
      return await getDownloadURL(storageRef);      // 실패하면 그대로 throw — 삼키지 않는다
    },
  };
  /* 👤 내 닉네임 — 게임 파트(parts/mystery-au.js 등)가 `typeof getMyNickname === 'function'`
     으로 확인하고 쓴다. 없으면 게임 쪽 닉네임 발화가 전부 '나'로 나온다.

     ★ 출처는 하나다. 마이홈 이름표(#mhMyName)가 곧 저장값이다 — app.js 가 저장하는 순간
       이름표를 갱신하므로 이름표를 읽는 것이 곧 저장값을 읽는 것이다. 저장 키를 따로 짚으면
       app.js 가 키를 바꾸는 날 조용히 끊긴다.
     ⚠ 폴백의 #mhMyNameInput 은 **제자리 편집 중**에만 존재하는 칸이다. 그 사이에는 이름표가
       display:none 이라도 textContent 는 옛 이름을 쥐고 있으므로 보통은 이름표에서 끝난다.
       (예전 '👤 이름 설정' 모달 #userNameInput 을 보던 자리다. 그 모달은 없앴다.)
     ⚠ 반드시 동기 함수여야 한다. 여기서 firebase 를 읽으면 Promise 가 나가고,
       부르는 쪽은 그걸 그대로 화면에 찍어 "[object Promise]" 님이 말을 하게 된다.
     ⚠ 이름표의 초기값 '-' 는 '아직 안 채워졌다'는 뜻이다. 그대로 돌려주면 '-' 님이 말을 한다.
       빈 문자열을 돌려주면 부르는 쪽이 알아서 자기 기본값으로 떨어진다. */
  window.getMyNickname = function(){
    const pick = v => {
      const t = String(v == null ? '' : v).trim();
      return (!t || t === '-') ? '' : t.slice(0, 16);
    };
    const byId = id => { try{ return document.getElementById(id); }catch(_){ return null; } };
    const label = byId('mhMyName'), input = byId('mhMyNameInput');
    const name = pick(label && label.textContent) || pick(input && input.value);
    /* 마이홈을 한 번도 안 열었거나 다시 그려지는 사이에도 이름이 사라지지 않게 마지막 값을 쥐고 있는다 */
    if(name) window._myNickCache = name;
    return name || window._myNickCache || '';
  };

  /* 🕰 미스테리au 파티 전송선(MYS_NET · mysRooms/…)은 **걷었다**(2026-09-23 · 개정 61).
     게임 파일 둘(parts/mystery-au.js · parts/mys-net-bind.js)과 같은 릴리스에서 함께 지웠다.
     ★ 2026-09-23: 쓰는 사람이 없음을 확인하고 **서버 규칙에서도 `mysRooms` 를 내렸다**(개정 63).
        남은 것은 콘솔의 옛 데이터뿐 — 규칙이 내려간 뒤에 지운다(순서가 반대면 지우자마자 다시 생길 수 있다). */

  /* 🌐 공개 읽기(파도타기 · 명함 · 사진 · 랭킹 · 방 개수 표시 · 랜덤 참여 후보)는 API 사본 먼저 → 실패면 위 함수 그대로(api-public-reads.js). */
  createApiPublicReads({ api: (window.TwApi && window.TwApi.client) || null, readCell: (path) => get(ref(db, path)).then(s => s.val()) }).wrap(window.firebaseAPI);
  try{ window.firebaseAPI.chatHistory.bindSettings(document, (m) => { window.toast(m); }); }catch(_){}   // 설정 › 시스템 [저장된 대화 지우기]
  window.dispatchEvent(new Event('firebase-ready'));
