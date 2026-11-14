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
    startAt as _sdkStartAt, equalTo as _sdkEqualTo, onChildAdded, onChildChanged, goOffline, goOnline
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
    linkWithCredential, reauthenticateWithCredential, EmailAuthProvider,
    signOut as fbSignOut, setPersistence, browserLocalPersistence, onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { firebaseConfig } from "./firebase-config.js";
  import { ROOM_ALIVE_HB, ROOM_ALIVE_STALE_MS } from "./room/room-alive.js";   // 관리자 유령 방 청소(cleanGhostRooms)만 — 앱 관리자 창을 걷을 때 같이
  import { createInviteRevokeAll } from "./account/invite-revoke.js";
  import { createAppVersion } from "./shared/app-version.js";
  import { createChatHistory, createIdbChatStore } from "./chat/chat-history.js";
  import { createCatalogSync, createApiCatalogFetch } from "./character/catalog-cache.js";
  import { createRealtimeLink } from "./realtime/realtime-link.js";
  import { createApiPublicReads } from "./shared/api-public-reads.js";
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

  // ⏱ 서버 시간 오프셋 — stale 판정을 로컬 시계로 하면 PC 시계가 몇 분만 틀어져도
  //   상대의 멀쩡한 하트비트를 "오래됨"으로 오판해 숨김(A↔B 비대칭의 원인 후보). 서버 오프셋으로 보정.
  let _svTimeOffset = 0;
  try{ onValue(ref(db, '.info/serverTimeOffset'), s => { _svTimeOffset = s.val() || 0; }); }catch(e){}
  const _svNow = () => Date.now() + _svTimeOffset;
  let _myFriendsOff = null;   // 지금 걸린 watchMyFriendList 의 해제 함수 — 동시에 하나만(새로 걸면 앞의 것을 푼다)
  let _myPresenceRef = null, _presenceRoom = null, _presenceOnline = true, _presenceInRoom = false;
  let _presenceWritten = false;   // presence 를 한 번이라도 set 했는가 — 버전이 늦게 오면 그때만 메운다
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
  if(_rc){
    _rc.start({
      api: (window.TwApi && window.TwApi.client) || null,   // 앱 공통 API 통로(api-client.js) — 운영/dev 주소는 거기서
      storage: _lsOrNull(),
      win: window,
      rt: window.TwRtHub.store,   // realtime 알림 config — 서버가 바꿨을 때 · 오래 끊겼다 붙었을 때 다시 묻는다
    });
  }
  onValue(ref(db, window.TwMaintenance.MAINTENANCE_PATH), (s) => _mt.onValue(s.val()), () => {});   // 🛠 서버 점검 표시 — 점검 중에도 규칙이 이 칸 읽기는 연다
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
    // 서버 방에 들어가고 나갈 때 친구 목록의 «온라인 · 방코드» — Firebase 방은 joinRoom · leaveRoom 이 직접 한다.
    setPresenceRoom(code){ _syncPresenceRoom(code || null); },
    // ===== 마이홈 친구 시스템 =====
    // 친추코드 → userId 조회. 없으면 null.
    async getUserNameById(uid){
      try{ const snap = await get(ref(db, `users/${uid}/profile`)); const p = snap.val(); return (p && p.name) ? String(p.name) : null; }
      catch(_){ return null; }
    },
    /* ===== 🎵 플레이리스트 =====
       내 목록 · 파도타기는 서버 API 로 옮겼다(status/playlist-api.js). 여기엔 명함 읽기(아래)만 남는다. */
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
    /* 👥 명함 날것은 API 에만 있다 — api-public-reads.js 가 바꿔 끼운다. 그 전엔 거절(친구 포트가 옛 길 카드로). */
    fetchUserCardApi(){ return Promise.reject(Object.assign(new Error('API 통로 없음'), { code: 'NO_API' })); },
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
    /* ===== 🧬 캐릭터 슬롯 · 보관함은 서버 원본(character/closet-api.js — /v1/me/avatars). 여기는 Storage 올리기만 남았다 =====
       🧍 슬롯에 딸린 GLB(커미션 베이스·커스텀 책상·커스텀 아이템)를 Storage 에.
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
    /* 내 프로필 이름 저장 — 친구 목록이 이 노드를 아직 듣는다. 레벨 · 별(level · cyc · clv · starC)은 서버 진척이 원본이라 쓰지 않고,
       update 라 그 칸들은 마지막 값 그대로 남는다(통째로 덮으면 지워진다 — 친구 쪽 갈아타기는 서버 빈칸 G2). */
    async setMyProfile(userId, name){
      /* 🚧 부팅 직후 첫 쓰기다. 세션 복원을 기다리지 않으면 구글에 묶인 계정에서 permission_denied 가 난다. */
      await _whenAuthReady();
      await update(ref(db, `users/${userId}/profile`), { name: name||'(이름 없음)', updatedAt: Date.now() });
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
    /* 범용 이미지 업로드 — 디자인 스튜디오 등에서 파일로 고른 이미지를 Storage에 올리고 URL을 받음.
       slot: 'bg' | 'panel_xxx' 등 용도별 키. 같은 slot에 다시 올리면 덮어씀(용량 누적 방지). */
    // 🏊 방 입장용 얼굴/눈감기 PNG를 Storage에 올리고 URL 반환 — 방 payload 다이어트(가) 단계.
    //   예전엔 512 PNG dataURL이 rooms/{code}/{member}/def에 통째로 들어가 모든 참여자가 매번 내려받았음.
    //   Storage는 캐시 헤더(1년)가 붙어 있어 같은 얼굴은 두 번째부터 다운로드가 발생하지 않음.
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

    /* 📚 마이홈 북마크 책장은 서버 길(myhome/bookshelf-store.js · myhome-api.js)로 옮겼다 — Firebase 책장 메서드는 없다. */

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
       이름 · 레벨 · 소개 · 사진은 목록을 열 때 한 번(getFriendCard · 서버 먼저 — friends/friends-port.js), 프로필은 목록이 열려 있는 동안만(watchFriendProfile), 접속 상태는 realtime(friends/friends-presence-rt.js).
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
    /* 친구 한 명의 프로필(이름 · 레벨 · 회차) — 구독은 목록이 열려 있는 동안만(friends-sub.js · @return 해제 함수), 한 번 읽기는 목록이 닫혀 있을 때 마이홈 구경.
       💰 규칙상 작은 칸 여섯뿐(name ≤20자 · level · cyc · clv · starC · updatedAt)이고 쓰기는 켤 때 · 이름 · 레벨이 바뀔 때만이다. */
    watchFriendProfile(fid, onChange){ const off = onValue(ref(db, `users/${fid}/profile`), snap=>onChange(snap.val())); return ()=>{ try{ off(); }catch(_){} }; },
    async getFriendProfile(fid){ return (await get(ref(db, `users/${fid}/profile`))).val(); },
    // (마이홈 페이지)
    // 읽기 · 쓰기 · 그림 올리기는 서버 API(myhome/myhome-api.js · 상태 주인 myhome-store.js)로 옮겼다 — 여기 남은 길 없음(getMyHome · saveMyHome · _myHomeLimits 걷음).
    // ===== 방명록 / 웹박수 =====
    // 읽기 · 쓰기 · 박수 · 폭죽 · 그림은 서버 API(myhome/guestbook-api.js)로 옮겼다 — 여기 남은 길 없음.
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
    /* 발급 · 만료 처리는 서버(POST /v1/admin/secret-rooms · 앱 admin/admin-license-bulk.js)가 한다 — Firebase 로 쓰던 issueSecretRoom · expireSecretRoom 은 D8-5 에서 걷었다. */
    // 후원자 본인 코드 조회 — 참여 화면이 "내 시크릿룸"을 자동으로 펼치고 채워넣는 데 쓴다.
    async getMySecretRoom(userId){
      try{ const s = await get(ref(db, `users/${userId}/secretRoom`)); return s.val() || null; }
      catch(_){ return null; }
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

    // ---- 라이선스 요청 (관리자 쪽만 — 사용자 요청 화면은 0.13 에서 걷음) ----
    // licenseRequests/{reqId} = { name, status:'pending'|'approved', requestedAt, issuedKey|null, approvedAt|null, ver? }

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
    // (마이홈 바탕화면 배경 · 폴더 — 읽기 · 쓰기는 서버 API(myhome/myhome-api.js · 상태 주인 myhome-store.js)로 옮겼다. saveAdvBg · getAdvBg · getAdvBgEx 걷음)
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
      /* 웹 캐시를 거치지 않는다 — 깨진 응답이 캐시에 남으면 서버에 다시 묻지 않고 그것만 계속 꺼낸다(E-CHAR-14).
         받은 GLB 는 부르는 쪽이 IndexedDB 에 저장하므로(glb-idb-cache.js) 요청 수는 그대로다. */
      const res = await fetch(url, { cache: 'no-store' });
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
       받기 · 읽음 · 지우기 · 공지는 서버 API 로 옮겼다(myhome/inbox-api.js · launcher/notice-api.js).
       여기엔 관리자 코드(admin/)가 아직 부르는 «개별 보내기» 만 남는다 — 관리자 묶음이 서버 길로 옮기면 같이 걷는다. */
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

    /* ═══════════ 🔑 로그인(Firebase Auth) 원시 — 토큰 받기만 ═══════════
       0.13 은 로그인만 앱 ↔ Firebase Auth 가 하고 «이 로그인이 누구인가» 는 서버가 정한다(GET /v1/me — account/login-flow.js).
       여기는 Auth SDK 를 부르는 얇은 자리다 — 유저 코드 묶기 · 가입 · 비밀번호 붙이기 · 바꾸기는 서버(account/user-api.js)가 한다.
       ⚠️ 로그인 창은 여기서 열지 않는다(file:// + frame-src 'none') — main.js 가 연 창에서 받은 ID 토큰만 받는다. */
    /* 🚧 저장된 로그인 세션이 복원될 때까지 기다린다(최대 8초, 실패해도 반드시 풀린다). */
    authReady(){ return _whenAuthReady(); },
    authCurrentUid(){ return (auth && auth.currentUser) ? auth.currentUser.uid : null; },
    authCurrentEmail(){ return (auth && auth.currentUser) ? (auth.currentUser.email || null) : null; },
    /* 지금 로그인 → { uid, anonymous } | null — login-flow.js 의 판정 재료 */
    authUser(){ const u = auth && auth.currentUser; return u ? { uid: u.uid, anonymous: !!u.isAnonymous } : null; },

    /* 구글 ID 토큰으로 로그인 → { ok, uid, email } | { ok:false, reason } */
    async authSignInWithGoogle(idToken){
      if(!auth) return { ok:false, reason:'로그인 기능을 쓸 수 없어요 (초기화 실패)' };
      if(!idToken) return { ok:false, reason:'구글 토큰이 없어요' };
      try{
        const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        return { ok:true, uid: cred.user.uid, email: cred.user.email || null };
      }catch(e){
        const c = String((e && e.code) || e || '');
        if(c.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [Google] 로그인을 켜주세요' };
        if(c.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'구글 계정 확인에 실패했어요 (' + (c || '알 수 없음') + ')' };
      }
    },
    /* 친구 코드 + 비밀번호 로그인 — Auth 이메일은 `{코드 소문자}@tw.local`(계정은 서버가 가입 때 만든다) → { ok, uid, email } | { ok:false, reason } */
    async authSignInWithFriendCode(code, password){
      if(!auth) return { ok:false, reason:'로그인 기능을 쓸 수 없어요 (초기화 실패)' };
      const c = String(code || '').trim().toUpperCase();
      if(!c || !password) return { ok:false, reason:'친구 코드와 비밀번호를 입력해 주세요' };
      const email = c.toLowerCase() + '@tw.local';
      try{
        const cred = await signInWithEmailAndPassword(auth, email, String(password));
        return { ok:true, uid: cred.user.uid, email };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('operation-not-allowed')) return { ok:false, reason:'Firebase 콘솔에서 [이메일/비밀번호] 로그인을 켜주세요' };
        if(k.includes('too-many-requests')) return { ok:false, reason:'시도가 너무 많았어요 — 잠시 뒤 다시 해 주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        if(k.includes('invalid-credential') || k.includes('wrong-password') || k.includes('user-not-found') || k.includes('invalid-email') || k.includes('invalid-login'))
          return { ok:false, reason:'친구 코드나 비밀번호가 맞지 않아요' };
        return { ok:false, reason:'로그인에 실패했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* 🔗 지금 로그인(비밀번호로 가입)에 구글을 **붙인다** — 같은 authUid 그대로. 그 구글이 이미 다른 계정 것이면 거절(자동 병합 없음).
       TODO: 서버 길이 없다(지도 6장 ⑧) — 생기면 서버 길로 옮긴다. */
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

    /* 🔐 로그인 수단 — 계정 탭이 «구글 · 친구 코드+비밀번호» 를 보인다. authProviders() → null(세션 없음) | { authUid, anonymous, google, googleEmail, password, passwordEmail } */
    authProviders(){ return _providersOf(auth && auth.currentUser); },
    /* 서버가 로그인 수단을 바꾼 뒤(비밀번호 붙이기) 이 PC 의 Auth 사본을 다시 읽는다 */
    async authReload(){ if(auth && auth.currentUser){ try{ await auth.currentUser.reload(); }catch(_){} } },
    /* 비밀번호로 다시 확인(구글 없는 계정 — 5분 안 로그인이 필요한 일) — 지금 세션을 바꾸지 않고 최근 로그인만 새로 한다.
       이메일은 이 세션이 가진 비밀번호 로그인의 것(authProviders().passwordEmail — 친구 코드 로그인이 만드는 모양과 같다).
       → { ok:true } | { ok:false, wrong:true }(비밀번호가 다름 — 창에서 다시 입력) | { ok:false, reason } */
    async authReauthPassword(password){
      if(!auth || !auth.currentUser) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
      const pv = _providersOf(auth.currentUser);
      if(!pv || !pv.passwordEmail || !password) return { ok:false, reason:'비밀번호로 확인할 수 없는 계정이에요' };
      try{
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(pv.passwordEmail, String(password)));
        return { ok:true };
      }catch(e){
        const k = String((e && e.code) || e || '');
        if(k.includes('wrong-password') || k.includes('invalid-credential') || k.includes('invalid-login')) return { ok:false, wrong:true };
        if(k.includes('too-many-requests')) return { ok:false, reason:'시도가 너무 많았어요 — 잠시 뒤 다시 해 주세요' };
        if(k.includes('network')) return { ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' };
        return { ok:false, reason:'비밀번호 확인에 실패했어요 (' + (k || '알 수 없음') + ')' };
      }
    },
    /* 구글로 다시 확인(5분 안 로그인이 필요한 일 — 비밀번호 붙이기 · 바꾸기 · 탈퇴) — 지금 세션을 **바꾸지 않고** 최근 로그인만 새로 한다.
       다른 구글을 고르면 user-mismatch */
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
    async advSendInvite(){ return { ok:false, reason:'서비스 종료' }; },
    async advClearInvite(){},
    async advJoinParty(){ return { ok:false, reason:'서비스 종료' }; },
    async advUpdateMember(){},
    async advLeaveParty(){ return { ok:true }; },
    async advDisbandParty(){ return { ok:true }; },
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

  /* 🌐 공개 읽기(파도타기 · 명함 · 사진 · 방 개수 표시 · 랜덤 참여 후보)는 API 사본 먼저 → 실패면 위 함수 그대로(api-public-reads.js). */
  createApiPublicReads({ api: (window.TwApi && window.TwApi.client) || null, readCell: (path) => get(ref(db, path)).then(s => s.val()) }).wrap(window.firebaseAPI);
  try{ window.firebaseAPI.chatHistory.bindSettings(document, (m) => { window.toast(m); }); }catch(_){}   // 설정 › 시스템 [저장된 대화 지우기]
  window.dispatchEvent(new Event('firebase-ready'));
