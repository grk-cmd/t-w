/* 🔒 CSP — 이 파일은 원래 desk-companion-prototype.html 안의 인라인 <script type="module"> 였다.
   `script-src` 에서 'unsafe-inline' 을 버리기 위해 밖으로 뺐다. 내용은 한 글자도 안 바꿨고,
   바뀐 것은 firebase-config 의 상대경로 한 줄뿐이다(파일이 parts/ 안으로 들어왔으므로
   './parts/firebase-config.js' → './firebase-config.js').
   ⚠️ HTML 에서 반드시 type="module" 로 불러야 한다 — import 문이 들어 있고,
     module 은 지연 실행이라 그 덕분에 parts/app.js(classic) 뒤에 도는 기존 순서가 유지된다.
   ⚠️ 맨 끝에서 window.__mysNetBind 를 부른다. 그건 parts/mys-net-bind.js 가 정의하는데,
     그쪽은 classic script 라 파싱 중에 먼저 돈다 — 순서가 보장된다. 둘의 위치를 바꾸지 말 것. */

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getDatabase, ref as _dbRef, set, update as _dbUpdate, remove, onValue, off, onDisconnect, serverTimestamp, get, runTransaction,
    push, query, limitToLast, orderByChild, orderByKey, startAt, onChildAdded
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
    signOut as fbSignOut, setPersistence, browserLocalPersistence, onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { firebaseConfig } from "./firebase-config.js";
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
  /* 다중 경로 update(루트 ref + {경로: 값}) 는 경로가 키에 있다 — 하나라도 빈 uid 면 통째로 거절한다
     (update 는 한 덩어리라 그 한 줄만 빼고 보내면 규칙이 보던 짝이 깨진다). */
  const update = (r, v) => {
    if(v && typeof v === 'object'){
      for(const k of Object.keys(v)){
        if(_noUidPath(k) !== k) return Promise.reject(new Error('[uid-guard] uid 없는 다중 경로 update: ' + k));
      }
    }
    return _dbUpdate(r, v);
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

  let _roomRef = null, _roomListener = null, _myMemberRef = null, _fbHeartbeat = null;
  /* 💰 방 리스너에서 chatLog를 떼어내기 위한 상태.
     rooms/{방} 아래 자식은 세 종류뿐이다 — `_meta`, `chatLog`, 그리고 멤버 노드(전부 'm'으로 시작:
     joinRoom의 'm' + Date.now().toString(36) + ...). RTDB 키 정렬은 문자열 순서라 '_'(0x5F) <
     'c'(0x63) < 'm'(0x6D) 이므로, orderByKey().startAt('m') 이면 멤버만 오고 _meta·chatLog는
     아예 전송되지 않는다. 스키마도 규칙도 그대로라 구버전과 데이터가 갈라지지 않는다.
     _meta는 방장 승계에 필요하므로 따로 작게(수십 바이트) 구독한다. */
  /* 💬 방이 비어도 대화 기록을 남긴다 — **한 줄로 뒤집는 자리**.
     [경위] 원래는 방이 비는 순간 `rooms/{방}/chatLog` 를 지웠다(두 곳: 입장 첫 스냅샷 청소 ·
       마지막 퇴장 청소). 그래서 다 같이 앱을 껐다 켜면 그 방의 기록이 서버에서 사라지고,
       모두가 '처음 입장'과 똑같은 화면을 봤다 — 제보된 "재부팅하면 모두가 처음으로 돌아간다".
     [지금] `chatLog` 만 남긴다. `_meta` · `roomIndex` 는 **그대로 지운다** —
       유령 방·채널 오염 방지가 그 둘의 일이고, 인원 계산은 이미 `_isMemberKey` 로
       `_`시작 키와 `chatLog` 를 빼고 세므로 기록만 남은 방은 '빈 방' 그대로다.
     ★ '처음 들어온 사람은 이전 기록을 못 본다'는 규칙은 **여기가 아니라** app.js 의
       입장 컷(`tw_chat_join:` · localStorage)이 맡는다. 기록을 지우는 것으로 대신하고 있었던 셈이라,
       기록을 남기는 지금부터 그 컷이 제 일을 한다(재부팅해도 남으므로 두 번째부터는 다 보인다).
     ⚠️ 저장이 무한히 늘 수 있다. 읽기는 `subscribeChatLog` 의 limitToLast(≤200)로 이미 묶여 있어
       트래픽은 그대로지만, 용량은 관리자 [🧹 유령 방 청소]가 유일한 배출구가 된다
       (그 버튼은 살아있는 멤버가 없는 방의 하위 키를 전부 지우므로 **기록도 함께 사라진다**).
       자동 보존 기간이 필요하면 그건 별도 작업이다 — 규칙(chatLog 하위 삭제 권한)부터 확인할 것.
     🔵 되돌리려면 이 값을 false 로. 두 청소 자리가 같이 예전 동작으로 돌아간다. */
  const KEEP_CHAT_LOG_ON_EMPTY = true;
  let _roomQuery = null, _roomMetaRef = null, _roomMetaCb = null, _roomMetaVal = null, _roomLastFriends = null;
  let _myMemberData = null;    // 내 멤버 전체 페이로드 — 재접속 시 노드를 통째로 재등록할 때 사용
  let _connWatchRef = null, _connWatchCb = null;   // .info/connected 감시 (재접속 감지)
  // ⏱ 서버 시간 오프셋 — stale 판정을 로컬 시계로 하면 PC 시계가 몇 분만 틀어져도
  //   상대의 멀쩡한 하트비트를 "오래됨"으로 오판해 숨김(A↔B 비대칭의 원인 후보). 서버 오프셋으로 보정.
  /* 💬 채팅 한 줄의 최대 글자수. **세 곳이 같은 숫자를 봐야 한다:**
       ① 여기(저장 전 slice) ② app.js 의 CHAT_OUT_MAX ③ firebase-database-rules.json 의 text 상한
     [경위] ①②는 커스텀 이모티콘 마커(URL 때문에 하나가 200자 안팎) 때문에 500→1200 으로 함께
       올렸는데, **③ 규칙만 500 에 남아 있었다.** 그래서 501~1200자 줄은 클라이언트를 통과한 뒤
       서버에서 거부됐다. RTDB 는 낙관적 반영이라 내 화면엔 한 번 떴다가 거부와 함께 사라진다 —
       보내는 사람에게는 «쳤는데 없어지거나 순서가 뒤엉킨» 것으로 보인다.
     ⚠️ 이 숫자를 옮기면 반드시 ②③도 같이 옮길 것. 셋 중 하나만 달라도 그 차이 구간이 통째로 사라진다. */
  const CHAT_TEXT_MAX = 1200;
  /* 💬 대화 정렬 기준 — **서버가 찍은 ts** 가 먼저다.
     [경위] 제보 — "내 메시지는 전부 위에, 상대 메시지는 전부 아래에 뭉쳐 나온다. 재접속하니 정상."
       무작위로 섞인 게 아니라 **사람 단위로 갈렸다**는 것이 단서였다.
     [왜 그런가] 예전에는 push key 순서(Object.keys().sort())를 그대로 썼다. push key 는 **보내는
       사람의 클라이언트가** 만든다 — `Date.now() + 서버시각보정`. 그래서 두 갈래로 어긋난다:
         ① 시계 어긋남 — 보정값이 아직 안 왔거나 틀리면 그 사람 키 전부가 한쪽으로 밀린다
         ② 잠깐 끊김   — 오프라인 큐에 담긴 글은 **부를 때 만든 옛 키**로 나중에 올라간다
       둘 다 «한 사람 것이 통째로» 앞뒤로 몰리는 모양이 되고, 재접속하면 저절로 낫는다. 제보 그대로다.
     [고침] ts 는 serverTimestamp() 라 **서버가 커밋 시점에 찍는다** — 누구의 시계도, 끊김도 타지 않는다.
       화면에 찍히는 시각(hh:mm)이 바로 이 값이므로, 이제 «보이는 시각과 순서»가 항상 일치한다.
     ★ ts 가 같거나(같은 밀리초) 없으면 key 로 가른다 — 정렬이 흔들리지 않게 항상 결말이 있어야 한다.
     ⚠️ 방금 보낸 내 글은 서버 확정 전까지 ts 가 **추정값**(내 시계 기준)이다. 시계가 어긋나 있으면
       그 잠깐 동안만 자리가 틀리고, 서버 값이 오는 순간 제자리로 간다. 예전처럼 굳지 않는다. */
  const _chatOrder = (a, b) => {
    const ta = (typeof a.ts === 'number' && a.ts > 0) ? a.ts : null;
    const tb = (typeof b.ts === 'number' && b.ts > 0) ? b.ts : null;
    if(ta !== null && tb !== null && ta !== tb) return ta - tb;
    const ka = String(a.id || ''), kb = String(b.id || '');
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  };
  let _svTimeOffset = 0;
  try{ onValue(ref(db, '.info/serverTimeOffset'), s => { _svTimeOffset = s.val() || 0; }); }catch(e){}
  const _svNow = () => Date.now() + _svTimeOffset;
  /* 🕒 **방 안에서 쓰는 기준 시각 — 내 시계를 아예 안 본다.**

     [왜 필요한가] 멤버 생존 판정은 `기준시각 - 상대의 lastSeen < 문턱` 이다. 그런데
       `lastSeen` 은 **서버가** 찍은 값이고 기준시각은 **내 PC 시계**였다. 두 시계를 빼고 있었던 것이다.
       내 시계가 서버보다 문턱만큼만 앞서면 **살아 있는 사람 전원이 유령으로 판정된다.**
       그런데 내 노드의 lastSeen 도 서버가 찍으므로 남들 화면에서는 내가 멀쩡하다 —
       제보 "나만 아무도 안 보이는데 남들은 나를 본다" 가 정확히 이 모양이다.
       (_svNow 의 오프셋 보정으로도 부족하다. `.info/serverTimeOffset` 은 **비동기로 늦게 도착**하고
        그 전까지 오프셋은 0 이라, 입장 직후 첫 스냅샷은 보정 없는 생 로컬 시계로 판정된다 —
        같은 PC 인데 "어떤 날은 되고 어떤 날은 안 되는" 이유.)

     [해법] 비교 상대를 바꾼다. **스냅샷 안에 이미 서버 시각이 들어 있다 — 내 노드의 lastSeen 이다.**
       서버가 찍고, 하트비트가 30초마다 갱신하고, 매 스냅샷에 공짜로 실려 온다.
       그 값을 기준으로 쓰면 서버시각 ↔ 서버시각 비교가 되어 **내 시계가 몇 시간 틀려도 결과가 같다.**
       서버를 새로 세우지 않고도 판정의 근거가 전부 서버 값이 된다.

     ⚠️ 내 lastSeen 은 최대 30초(하트비트 주기)까지 뒤처진다 — 그래서 문턱을 그만큼 넓혀 둔다
       (STALE_MS 주석 참고). 안 넓히면 이번엔 멀쩡한 사람이 하트비트 주기마다 깜빡인다.
     ⚠️ 못 구하면(첫 스냅샷에 내 노드가 아직 없음 등) _svNow 로 물러난다 — 예전 동작 그대로라
       이 함수 때문에 나빠지는 경우는 없다. */
  function _roomClockNow(raw, myMemberId){
    const mine = (raw && myMemberId) ? raw[myMemberId] : null;
    const t = mine && mine.lastSeen;
    if(typeof t === 'number' && isFinite(t) && t > 0) return t;
    return _svNow();
  }
  /* 방 스냅샷에서 '나를 뺀 멤버 노드' 개수. 예약 키(_meta·chatLog)를 거르는 규칙은
     화면 필터·checkRoomCapacity·퇴장 청소와 **같아야 한다** — 한 곳만 달라지면 인원 판정이 갈린다. */
  function _roomOccupants(raw, myMemberId){
    let n = 0;
    for(const id in (raw || {})){
      if(id === myMemberId || id.charAt(0) === '_' || id === 'chatLog') continue;
      n++;
    }
    return n;
  }
  let _myPokeRef = null, _myPokeListener = null, _memberId = null, _roomCode = null;
  let _friendListListeners = {};   // {friendId: {profileUnsub, presenceUnsub, bioUnsub, avatarUnsub}} — 각 친구별 실시간 구독 정리용
  let _myPresenceRef = null, _presenceRoom = null, _presenceOnline = true, _presenceInRoom = false;
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
    if(_myPresenceRef && _presenceOnline) update(_myPresenceRef, { room: _presenceRoom, inRoom: _presenceInRoom, lastSeen: Date.now() });
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
  // 방 개수 세기 — "실제 멤버가 있는 방"만. (_meta만 남은 방을 세면 유령 방이 20개 정원을 잠식함)
  /* ★ 방장 승계 판정 — 방 리스너가 갱신될 때마다 호출된다. 경쟁 없는 결정론적 방식.
     [입력] room, 내 memberId, 캡처한 _meta, 살아있는 멤버 friends(중복제거됨)
     [절차]
       1. 방장(_meta.host)이 살아있는 멤버 중에 있으면 → 할 일 없음(정상)
       2. 방장이 없다(이탈) → 남은 멤버를 memberId(=입장순)로 정렬
       3. 프리미엄 방이면: 라이선스 보유자 중 입장순 첫 번째가 후보.
          ★ 보유자가 아무도 없으면 승계 자체가 불가 → 방 해산(각자 솔로 모드로 복귀).
            예전엔 무료 워킹룸으로 강등했는데, 라이선스 없는 사람들이 프리미엄 방을 계속
            쓰는 모양새가 돼서 방을 터뜨리는 쪽으로 바꿨다.
       4. 내가 그 후보일 때만 트랜잭션(claimHostIfVacant) 시도 — 나머지는 아무것도 안 함
     누가 계산해도 같은 후보가 나오므로 트랜잭션은 사실상 후보 1명만 실행한다.
     트랜잭션 자체도 '이미 유효한 host가 있으면 포기'라 이중 안전. */
  let _lastSuccessionAt = 0;
  async function _maybeSucceedHost(room, myMemberId, meta, friends){
    // 🔒 시크릿룸은 방장이 '발급 대상(owner)'으로 고정이다. 승계도, 해산도 하지 않는다 —
    //    후원자가 잠깐 나간 사이에 자기 방이 남의 방이 되거나 방이 터지면 안 되기 때문.
    //    (startRoom이 입장할 때마다 host를 owner로 다시 써주는 것과 한 쌍)
    if(String(room||'').indexOf('SCRT-') === 0) return;
    if(!meta || !meta.host) return;                    // 방장 정보가 없는 방 → 승계 대상 아님
    // ★ 무료방(워킹룸)은 승계하지 않는다 — 방장 권한이 '프리미엄 방 생성 자격'뿐이라 무료방에선 의미가 없다.
    //   참여·채팅 모두 방장과 무관하므로 방장이 나가도 남은 사람들은 그대로 쓰면 된다.
    if(meta.channel !== 'togetherroom') return;
    const ids = Object.keys(friends || {});
    if(ids.length === 0) return;                        // 살아있는 멤버가 없음(내가 나가는 중 등) → 스킵
    // 내가 이 방에 살아있는 멤버인지(내 memberId가 friends에 있어야 승계 주체가 될 수 있음)
    if(ids.indexOf(myMemberId) < 0) return;
    // 1) 방장이 아직 살아있나? (살아있는 멤버의 userId 중 host가 있으면 정상)
    const aliveUserIds = ids.map(id => friends[id] && friends[id].userId).filter(Boolean);
    if(aliveUserIds.indexOf(meta.host) >= 0) return;    // 방장 건재 → 할 일 없음
    // 2) 방장 이탈 — 입장순(memberId 오름차순) 정렬
    const sorted = ids.slice().sort();                  // memberId 앞부분이 입장시각(Date.now 36진수)이라 문자열 정렬=입장순
    // 3) 후보 선출 (프리미엄 방 전용)
    const candidate = sorted.find(id => friends[id] && friends[id].lic);   // 라이선스 보유자 중 입장순 첫
    if(!candidate){
      /* ★ 이어받을 라이선스 보유자가 없다 → 무료 워킹룸 강등이 아니라 '방 해산'.
         남은 사람들은 방 없이 각자 솔로 모드로 돌아간다.
         구현: 서버에 해산 표시를 쓰지 않는다. 이 판정은 모든 클라이언트가 같은 입력
         (_meta + 살아있는 멤버 목록)으로 같은 결론을 내리므로, 각자 알아서 나가면 끝이다.
         → 쓰기도, 트랜잭션도, 경쟁도 없다. 마지막 사람이 나가면 방은 자연히 비어 사라진다. */
      if(typeof window._onRoomDisbanded === 'function') window._onRoomDisbanded();
      return;
    }
    if(candidate !== myMemberId) return;                // 내가 후보가 아니면 아무것도 안 함(경쟁 원천 차단)
    // 4) 내가 후보 — 짧은 시간 내 중복 실행 방지(리스너가 연달아 여러 번 오는 경우)
    const nowMs = Date.now();
    if(nowMs - _lastSuccessionAt < 3000) return;
    _lastSuccessionAt = nowMs;
    const myUserId = friends[myMemberId] && friends[myMemberId].userId;
    if(!myUserId) return;
    try{
      if(window.firebaseAPI && window.firebaseAPI.claimHostIfVacant){
        const r = await window.firebaseAPI.claimHostIfVacant(room, myUserId, aliveUserIds, null);
        if(r && r.ok && r.meta){
          if(typeof window._onHostSucceeded === 'function') window._onHostSucceeded(r.meta);
        }
      }
    }catch(_){}
  }
  /* 🗑️ _countLiveRooms 삭제됨 — rooms "전체 스냅샷"을 받아 세던 시절의 헬퍼.
     카운트가 roomIndex + 핀포인트 프로브(getRoomCounts)로 바뀌면서 전체 스냅샷을 받을 일이 없어짐.
     이 함수가 다시 필요해진다면 그건 어딘가에서 rooms 전체를 읽고 있다는 신호이므로 설계를 재검토할 것. */
  /* 💰 roomIndex 유지 — 방 요약 노드(roomIndex/{code} = {channel, lastSeen})에 하트비트를 기록.
     카운트(getRoomCounts)가 rooms 전체(멤버·아바타·chatLog 포함, 방당 수백 KB) 대신
     이 노드(방당 수십 바이트)만 읽게 하기 위한 것. 쓰기 실패는 조용히 무시 — 카운트가 잠깐 어긋날 뿐. */
  function _touchRoomIndex(room, extra){
    // 🔒 시크릿룸(후원자 전용 고정방)은 인덱스에 기록하지 않는다 — getRoomCounts가 인덱스를 세므로
    //    여기서 빠지는 것만으로 방 개수(정원)에 잡히지 않는다. 카운트 쪽에도 같은 가드가 한 겹 더 있다.
    if(String(room||'').indexOf('SCRT-') === 0) return;
    try{ update(ref(db, `roomIndex/${room}`), Object.assign({ lastSeen: serverTimestamp() }, extra || {})); }catch(_){}
  }
  /* 🔄 마이그레이션 프로브 캐시 — 인덱스에 없는 방의 생존 확인 결과를 60초 기억.
     방 만들기 화면이 30초마다 카운트를 갱신하므로, 같은 방을 매번 다시 찌르지 않게. */
  const _roomProbeCache = {};   // code → { ch: 'workingroom'|'togetherroom'|null(죽은 방), until: ms }
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

  /* ★ Storage Phase 2: 유저 이미지(프로필/배경/스티커/박수)를 Realtime DB의 base64 대신 Storage에 저장.
     dataURL("data:image/...;base64,...")이 들어오면 Storage에 올리고 다운로드 URL을 돌려줌.
     이미 URL(https://...)이면 그대로 통과 — 재저장 시 중복 업로드 방지.
     실패하면 원본 dataURL을 그대로 돌려줌(업로드 실패로 이미지가 통째로 날아가지 않게). */
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
     규칙(firebase-database-rules.json accountSnap)과 같은 값: license ≤40 · focusTotalSec 0..359640000 · name ≤40 · friendCode ≤12 · ts 숫자 · 그 밖 거절.
     ★ functions/index.js 의 snapClean 과 **같은 규칙**이다 — 한쪽만 바꾸면 이관한 것과 앱이 쓴 것이 달라진다. */
  function _acctSnapClean(snap, ts){
    const s = snap || {};
    const str = (v, n) => (typeof v === 'string' && v && v.length <= n) ? v : null;
    const f = Number(s.focusTotalSec);
    return {
      license: str(s.license, 40),
      focusTotalSec: (s.focusTotalSec != null && Number.isFinite(f) && f >= 0 && f <= 359640000) ? f : null,
      name: (typeof s.name === 'string' && s.name) ? s.name.slice(0, 40) : null,
      friendCode: str(s.friendCode, 12),
      ts: Number.isFinite(ts) ? ts : Date.now()
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
    // 🚪 버전 게이트 — 방 입장 최소 허용 버전(예: "0.6.2"). 관리자가 config/minRoomVer만 바꾸면
    //   앱·규칙 재배포 없이 즉시 게이트가 올라감. 값 없으면 null(=제한 없음).
    async getMinRoomVer(){
      try{ const snap = await get(ref(db, 'config/minRoomVer')); const v = snap.val(); return (v==null) ? null : String(v); }
      catch(_){ return null; }
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
    async publishMyPlaylist(uid, name, sets, meta){
      try{
        const ts = Date.now();
        const m = meta || {};
        const ss = (Array.isArray(sets) ? sets : []).map(s => ({
          name: String((s && s.name) || ''),
          items: (s && s.items) || [],
        }));
        const total = ss.reduce((n, s) => n + s.items.length, 0);
        const mirror = (ss.find(s => s.items.length) || { items: [] }).items;
        await set(ref(db, `users/${uid}/playlist`), { sets: ss, items: mirror, ts,
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
    async removeMyPlaylist(uid, meta){
      try{
        const m = meta || {};
        if(m.bio || m.homePublic){
          /* ⚠️ sets 도 같이 비운다. 안 비우면 곡을 전부 뺐는데 옛 프리셋이 서버에 남아
             파도타기에 계속 걸린다(색인만 지우는 것으로는 친구 지목이 안 막힌다). */
          await set(ref(db, `users/${uid}/playlist`), { sets: [], items: [], ts: Date.now(),
            bio: String(m.bio || '').slice(0, 140), homePublic: !!m.homePublic });
        }else{
          await remove(ref(db, `users/${uid}/playlist`));
        }
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
          avatar: as.val() || null };
      }catch(e){ console.warn('[플레이리스트] 명함 읽기 실패', e); return null; }
    },
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
        if(!pv) return null;
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
        return { sets, bio: pv.bio ? String(pv.bio) : '', homePublic: !!pv.homePublic };
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
       ★ 반영은 '최신 기기 통째로 덮어쓰기(set)'다. ts 비교와 판정은 전부 app.js
         syncGachaToServer 가 하고, 여기는 읽기/쓰기만 한다.
         set 을 쓰는 것이 중요하다 — update 면 진 기기에만 있던 파츠가 서버에 그대로 남아
         "덮어썼는데 옛것이 섞여 있다"가 된다.
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
    async saveGachaOwned(uid, owned, ts){
      try{
        const clean = {};
        for(const k in (owned || {})){
          const n = Math.max(0, Math.floor(Number(owned[k]) || 0));
          if(n > 0) clean[k] = n;
        }
        await set(ref(db, `users/${uid}/gacha`), { owned: clean, ts: Math.max(0, Math.floor(Number(ts) || 0)) });
        return true;
      }catch(e){ console.warn('[가챠] 소유 반영 실패', e); return false; }
    },
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
        const storageRef = sref(storage, `users/${userId}/slotglb_${safeKey}.glb`);
        await uploadString(storageRef, b64, 'base64', { cacheControl: STORAGE_CACHE, contentType: 'model/gltf-binary' });
        const url = await getDownloadURL(storageRef);
        return { ok:true, url };
      }catch(e){ console.warn('[슬롯] GLB 업로드 실패', safeKey, e); return { ok:false, reason:'업로드에 실패했어요' }; }
    },
    /* 🏅 👑달성표 주간 보상 — 추가 뽑기 횟수. users/{uid}/chalBonus (숫자 하나)
       ★ **gacha 노드 안에 두지 않는다.** 바로 위 saveGachaOwned 가 그 노드를 통째로 set 하는데,
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
        try{ const s = await get(r); pre = Number(s.val()) || 0; }catch(_){}
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
        return { ok:false, reason, denied, authed: !!(auth && auth.currentUser) };
      }
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
    async setMyProfile(userId, name, level){
      /* 🚧 부팅 직후 첫 쓰기다. 세션 복원을 기다리지 않으면 구글에 묶인 계정에서
         permission_denied 가 나고, 부르는 쪽(app.js initMyHome)이 그 예외로 중단된다. */
      await _whenAuthReady();
      const rec = { name: name||'(이름 없음)', updatedAt: Date.now() };
      const lv = parseInt(level, 10);
      if(isFinite(lv) && lv >= 1 && lv <= 9999) rec.level = lv;
      await set(ref(db, `users/${userId}/profile`), rec);
    },
    // 온라인 상태 등록 — onDisconnect로 앱이 꺼지거나 튕기면 자동으로 offline 처리됨.
    setMyPresenceOnline(userId){
      if(_myPresenceRef) return;   // 중복 등록 방지
      _myPresenceRef = ref(db, `users/${userId}/presence`);
      /* 🔌 presence 를 **지금 상태 그대로** 다시 쓰고, onDisconnect 도 함께 다시 건다.
         최초 1회와 재접속이 똑같은 것을 써야 해서 함수로 뺐다.
         ★ online 에 true 가 아니라 `_presenceOnline` 을 넣는 것이 핵심이다 —
           수동으로 오프라인 해 둔 사람을 네트워크가 한 번 끊겼다는 이유로
           온라인으로 되돌리면 안 된다(setMyPresenceState 가 이 값을 세운다). */
      const _armPresence = ()=>{
        if(!_myPresenceRef) return;
        onDisconnect(_myPresenceRef).set({ online:false, lastSeen: Date.now() });
        set(_myPresenceRef, {
          online: _presenceOnline, lastSeen: Date.now(),
          room:   _presenceOnline ? _presenceRoom   : null,
          inRoom: _presenceOnline ? _presenceInRoom : false
        });
      };
      /* 🚧 presence 도 소유권이 걸린 가지다 — 세션 복원 전에 쓰면 조용히 거부되고,
         그 기기는 친구 목록에서 영영 오프라인으로 보인다(재접속 복구가 돌기 전까지).
         ⚠️ .info/connected 쪽은 감싸지 않는다. 그건 이미 부팅이 한참 지난 뒤의 경로다. */
      _whenAuthReady().then(_armPresence);
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
          try{ update(_myPresenceRef, { lastSeen: Date.now() }); }catch(_){}
        }, 6 * 60 * 60 * 1000);
      }catch(_){}
    },
    // 온라인 표시 수동 토글 — false면 친구 목록에서 오프라인으로 보임(앱은 계속 실행됨).
    setMyPresenceState(userId, online){
      _presenceOnline = !!online;
      if(!_myPresenceRef){
        _myPresenceRef = ref(db, `users/${userId}/presence`);
        onDisconnect(_myPresenceRef).set({ online:false, lastSeen: Date.now() });
      }
      set(_myPresenceRef, { online: _presenceOnline, lastSeen: Date.now(), room: _presenceOnline ? _presenceRoom : null, inRoom: _presenceOnline ? _presenceInRoom : false });
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
      const url = await _uploadDataUrlIfNeeded(`users/${userId}/roomface_${safeKey}.png`, dataUrl);
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
    async getMallangImgs(userId){
      try{ const s=await get(ref(db, `users/${userId}/mallang`)); const v=s.val(); return (v&&Array.isArray(v.imgs))?v.imgs:[]; }
      catch(e){ return []; }
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
    // 내 친구 목록 실시간 구독 — friends 목록이 바뀔 때마다 각 친구의 프로필/온라인상태도 같이 구독해서
    // onChange(friendsObj)로 전달. friendsObj = { [friendId]: {name, online, lastSeen, addedAt} }
    subscribeMyFriends(myId, onChange){
      const friendsRef = ref(db, `users/${myId}/friends`);
      const combined = {};
      /* 🚦 갱신 폭주 묶기 — 친구 1명당 onValue 가 4개(profile·presence·bio·avatar)라,
         부팅 때 콜백이 **친구 수 × 4** 번 몰려온다. onChange 는 마이홈 친구 목록을
         innerHTML 로 통째로 다시 그리므로(renderMyHomeFriendList), 100명이면
         400번 × 100줄 = 4만 줄을 짓는 셈이 되어 창이 눈에 띄게 멈춘다.
         ★ 50ms 창에 한 번만 그린다. **디바운스가 아니라 스로틀(뒷날)이다** —
           디바운스로 하면 콜백이 끊이지 않고 들어오는 동안 화면이 영영 안 그려진다.
         ⚠️ 값 자체는 combined 에 즉시 반영된다. 늦추는 것은 '그리기'뿐이다. */
      let _nTimer = null, _nDirty = false;
      const notify = ()=>{
        _nDirty = true;
        if(_nTimer) return;
        _nTimer = setTimeout(()=>{
          _nTimer = null;
          if(_nDirty){ _nDirty = false; onChange({...combined}); }
        }, 50);
      };
      const listRef = onValue(friendsRef, snap=>{
        const ids = Object.keys(snap.val()||{});
        // 목록에서 빠진 친구는 구독 해제 + combined에서 제거
        Object.keys(_friendListListeners).forEach(fid=>{
          if(!ids.includes(fid)){
            const l=_friendListListeners[fid];
            if(l.profileUnsub) off(l.profileUnsub.ref, 'value', l.profileUnsub.cb);
            if(l.presenceUnsub) off(l.presenceUnsub.ref, 'value', l.presenceUnsub.cb);
            if(l.bioUnsub) off(l.bioUnsub.ref, 'value', l.bioUnsub.cb);
            if(l.avatarUnsub) off(l.avatarUnsub.ref, 'value', l.avatarUnsub.cb);
            if(l.homeUnsub) off(l.homeUnsub.ref, 'value', l.homeUnsub.cb);   // 구버전 잔여 구독 호환
            delete _friendListListeners[fid]; delete combined[fid];
          }
        });
        // 새로 추가된 친구는 프로필/온라인상태/마이홈(사진·소개글) 구독 시작
        ids.forEach(fid=>{
          if(_friendListListeners[fid]) return;
          combined[fid] = combined[fid] || {name:'...', online:false, lastSeen:0, addedAt:(snap.val()[fid]||{}).addedAt};
          const profRef = ref(db, `users/${fid}/profile`);
          const profCb = psnap=>{ const p=psnap.val()||{}; combined[fid].name=p.name||'(이름 없음)';
            //  ★ 값이 없으면 null. '아직 새 버전으로 접속 안 한 친구'와 '진짜 Lv.1'을 구분해야
            //    전원이 Lv.1로 보이는 오해가 안 생긴다(배지를 아예 숨김).
            combined[fid].level = (typeof p.level === 'number' && p.level >= 1) ? p.level : null;
            notify(); };
          onValue(profRef, profCb);
          const presRef = ref(db, `users/${fid}/presence`);
          const presCb = psnap=>{ const p=psnap.val()||{}; combined[fid].online=!!p.online; combined[fid].lastSeen=p.lastSeen||0; combined[fid].room=p.room||null;
            /* 🏠 '방에 있음'은 코드와 **별개 필드**다 — 시크릿룸은 code 를 안 올리므로 room 만 보면 못 잡는다.
               옛 판(inRoom 이 없던 클라이언트)은 room 이 있으면 방에 있는 것으로 친다(하위호환). */
            combined[fid].inRoom = (p.inRoom !== undefined) ? !!p.inRoom : !!p.room;
            notify(); };
          onValue(presRef, presCb);
          // 목업의 이름 아래 소개글/프로필 썸네일용 — 친구의 마이홈에서 bio/avatar만 가져옴.
          // 💰 예전엔 users/{친구}/home 을 통째로 구독해서, 친구가 게시글·테마·스티커를 건드릴 때마다
          //    home 전체(게시글 본문·테마·스티커 목록 등)가 모든 친구에게 다시 전송됐음.
          //    실제로 쓰는 건 bio/avatar 둘뿐이라 그 경로만 각각 구독하도록 좁힘(동작은 동일, 트래픽만 감소).
          const bioRef = ref(db, `users/${fid}/home/bio`);
          const bioCb = bsnap=>{ combined[fid].bio = bsnap.val() || ''; notify(); };
          onValue(bioRef, bioCb);
          const avaRef = ref(db, `users/${fid}/home/avatar`);
          const avaCb = asnap=>{ combined[fid].avatar = asnap.val() || null; notify(); };
          onValue(avaRef, avaCb);
          _friendListListeners[fid] = { profileUnsub:{ref:profRef,cb:profCb}, presenceUnsub:{ref:presRef,cb:presCb},
            bioUnsub:{ref:bioRef,cb:bioCb}, avatarUnsub:{ref:avaRef,cb:avaCb} };
        });
        notify();
      });
    },
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
      const up = async (label, path, val)=>{
        const r = await _uploadDataUrlIfNeeded(path, val);
        /* ⚠️ _uploadDataUrlIfNeeded 는 실패하면 **원본 dataURL 을 그대로 돌려준다.**
           예전에는 그게 조용히 DB 로 흘러들어가, 수백 KB 짜리 문자열이 그대로 쓰기에 실려 갔다.
           그 실패를 여기서 붙잡아 두면 «사진이 안 올라갔다»고 정확히 말할 수 있다. */
        if(typeof r === 'string' && r.startsWith('data:')) failedUploads.push(label);
        return r;
      };
      if(out.avatar)          out.avatar  = await up('프로필 사진', `users/${userId}/avatar.jpg`, out.avatar);
      if(out.bg && out.bg.img) out.bg.img = await up('배경 사진',   `users/${userId}/bg.jpg`,     out.bg.img);
      if(out.stickers){
        for(const sid of Object.keys(out.stickers)){
          const st = out.stickers[sid];
          if(st && st.img) st.img = await up('스티커', `users/${userId}/sticker_${sid}.png`, st.img);
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
        return uploadWarn ? { ok:true, warn:uploadWarn } : { ok:true };
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
    // ===== (기존) 방/좌석 시스템 =====
    // 방 입장 전 현재 인원수 확인 — STALE(5분 이상 응답없음) 멤버는 제외하고 셈. 입장 정원 제한에 사용.
    async checkRoomCapacity(room){
      // 💰 방 전체(아바타 PNG·chatLog 포함, 수백 KB)를 받지 않도록:
      //    shallow로 멤버 키 목록만 얻고(수십 바이트), 각 멤버의 lastSeen 값만 콕 집어 읽는다(멤버당 ~10바이트).
      //    실패하면(네트워크 등) 예전 전체 조회로 자동 폴백.
      try{
        const base = (db && db.app && db.app.options && db.app.options.databaseURL) || null;
        if(base){
          const res = await fetch(base.replace(/\/$/,'') + `/rooms/${room}.json?shallow=true`);
          if(res.ok){
            const keys = await res.json();
            if(keys === null) return 0;   // 방 없음
            if(keys && typeof keys === 'object'){
              const ids = Object.keys(keys).filter(id => id.charAt(0) !== '_' && id !== 'chatLog');
              const now = _svNow(); const STALE_MS = 5*60*1000;   // 🕒 입장 검사는 방 밖이라 내 노드가 없다 — 오프셋 보정본이 최선이다
              const seens = await Promise.all(ids.map(id =>
                get(ref(db, `rooms/${room}/${id}/lastSeen`)).then(s => s.val()).catch(() => undefined)));
              let count = 0;
              // 원래 규칙 그대로: lastSeen이 최근이면 카운트, lastSeen이 아예 없으면(옛 데이터) 카운트.
              seens.forEach(v => { if(v == null || (now - v) < STALE_MS) count++; });
              return count;
            }
          }
        }
      }catch(_){}
      const snap = await get(ref(db, `rooms/${room}`));
      const all = snap.val() || {};
      const now = _svNow(); const STALE_MS = 5*60*1000;   // 🕒 입장 검사는 방 밖이라 내 노드가 없다 — 오프셋 보정본이 최선이다
      let count = 0;
      for(const id in all){
        if(id.charAt(0) === '_' || id === 'chatLog') continue;   // ★ _meta·chatLog 등은 멤버가 아니므로 인원 계산에서 제외
        const m = all[id];
        if(m && m.lastSeen && (now - m.lastSeen) < STALE_MS) count++;
        else if(m && !m.lastSeen) count++;
      }
      return count;
    },
    /* 🔒 시크릿룸 입장 판정 — 인원수와 함께 "방장이 지금 안에 있는지"를 돌려준다: {count, ownerIn} | null
       [왜] 시크릿룸 자리 배분은 '방장 1(예약석) + 자유 MAX_PEOPLE-1'이다. 예약석은 방장이 비워도
            남이 못 앉으므로, 손님을 막을 때는 "지금 인원 중 방장 몫(0 또는 1)"을 빼고 세야 한다.
            checkRoomCapacity 가 돌려주는 숫자 하나로는 그 한 명을 가려낼 수 없다.
       💰 checkRoomCapacity 와 같은 shallow 방식이고, 멤버당 userId 를 하나 더 읽는다(~40바이트).
          8명 방이면 입장 1회에 320바이트 — 방 전체(아바타 포함 수백 KB)를 받는 것과 자릿수가 다르다.
       ⚠️ 생존 판정(STALE_MS·lastSeen 없으면 통과)은 checkRoomCapacity 와 **글자 그대로 같아야** 한다.
          갈라지면 사전 검사와 재확인이 서로 다른 방을 보게 된다.
       ⚠️ 실패하면 null. 부르는 쪽은 기존 정원 검사와 같은 태도로 '막지 않고 진행'한다
          (전체 조회 폴백을 두지 않는다 — 그게 바로 피하려던 비용이다). */
    async checkSecretRoomEntry(room, ownerUid){
      try{
        const base = (db && db.app && db.app.options && db.app.options.databaseURL) || null;
        if(!base) return null;
        const res = await fetch(base.replace(/\/$/,'') + `/rooms/${room}.json?shallow=true`);
        if(!res.ok) return null;
        const keys = await res.json();
        if(keys === null) return { count: 0, ownerIn: false };   // 방 없음
        if(!keys || typeof keys !== 'object') return null;
        const ids = Object.keys(keys).filter(id => id.charAt(0) !== '_' && id !== 'chatLog');
        const now = _svNow(); const STALE_MS = 5*60*1000;   // 🕒 입장 검사는 방 밖이라 내 노드가 없다 — 오프셋 보정본이 최선이다
        const rows = await Promise.all(ids.map(id => Promise.all([
          get(ref(db, `rooms/${room}/${id}/lastSeen`)).then(s => s.val()).catch(() => undefined),
          get(ref(db, `rooms/${room}/${id}/userId`)).then(s => s.val()).catch(() => undefined),
        ])));
        let count = 0, ownerIn = false;
        rows.forEach(([seen, uid]) => {
          if(!(seen == null || (now - seen) < STALE_MS)) return;   // 유령은 안 센다
          count++;
          if(ownerUid && uid === ownerUid) ownerIn = true;
        });
        return { count, ownerIn };
      }catch(_){ return null; }
    },
    // 방 접속 — 내 정보를 rooms/{room}/{memberId}에 쓰고, 같은 방 전체를 실시간 구독.
    // onPoked(선택) — 다른 사람이 "내 캐릭터"를 쓰다듬거나 흔들었을 때(poke) 알림받는 콜백.
    joinRoom(room, me, onChange, onPoked) {
      /* 🕒 [2026-09-17 제보] memberId 앞부분은 **서버 시계 보정본**(_svNow)으로 만든다.
           [무엇이 났나] «방에 가만히 있었는데 누가 들어오면 '같은 순간에…자리가 찼어요' 하고 쫓겨난다».
             정원 초과 자기 퇴장(아래 방 리스너)은 «memberId 오름차순 = 입장순» 으로 늦게 온 사람을 가르는데,
             앞부분이 각자 PC 의 Date.now 였다. 제보자 시계가 몇 분 앞서 있으면 나중에 들어온 사람의 id 가
             더 작아서, 방이 찰 때마다 먼저 앉아 있던 제보자가 «늦게 온 사람» 으로 계산된다 — 반복되는 이유다.
           [대응] 이미 있는 .info/serverTimeOffset 보정(_svNow)을 쓴다. id 형식·정렬 로직·구버전과의 정렬 호환은
             그대로다(같은 base36 밀리초). 오프셋이 아직 안 왔으면 0 이라 예전과 같다. */
      const memberId = 'm' + _svNow().toString(36) + Math.random().toString(36).slice(2, 8);
      _memberId = memberId; _roomCode = room;
      _myMemberRef = ref(db, `rooms/${room}/${memberId}`);
      _myMemberData = { name: me.name, def: me.def, state: me.state, userStatus: me.userStatus||null, level: me.level||1, userId: me.userId||null, lic: !!me.lic };
      set(_myMemberRef, { ..._myMemberData, lastSeen: serverTimestamp() });
      // 🔬 [def-diag] 진단 카운터 — 재접속 재등록 빈도/노드 크기 측정용(임시). 동작 영향 없음.
      try{ window._defDiag = { room, joinAt: Date.now(), reconnectResets: 0,
        memberBytes: JSON.stringify(_myMemberData).length,
        defBytes: JSON.stringify(_myMemberData.def==null?'':_myMemberData.def).length };
        console.log('[def-diag] 입장 — 노드 '+window._defDiag.memberBytes+'B (그중 def '+window._defDiag.defBytes+'B)'); }catch(_){}
      _touchRoomIndex(room);   // 💰 카운트용 요약 노드 갱신 — getRoomCounts가 rooms 전체 대신 이걸 읽음
      // 🧹 이전 세션/chatLog 정리는 아래 방 리스너의 "첫 스냅샷"에서 수행 —
      //   💰 예전엔 여기서 방 전체를 한 번 더 get()했는데(입장마다 전체 다운로드 1회 추가),
      //   리스너 초기 동기화가 어차피 같은 데이터를 통째로 받으므로 그 스냅샷을 재사용한다.
      let _initCleanupDone = false;
      onDisconnect(_myMemberRef).remove();   // 연결 끊기면 자동 삭제

      // ★ 재접속 자동 복구 — 네트워크가 순간 끊기면 위 onDisconnect가 서버에서 내 노드를 지워버림.
      //   재접속해도 노드를 다시 만드는 코드가 없으면: 하트비트(update {lastSeen})는 name/state 필수
      //   규칙에 걸려 조용히 실패 → "상대에겐 내가 안 보이는데 나는 다 보이는" 비대칭이 영구화됨.
      //   .info/connected를 구독해 재접속 순간마다 (1) 내 노드 전체 재등록 (2) onDisconnect 재무장.
      _connWatchRef = ref(db, '.info/connected');
      _connWatchCb = onValue(_connWatchRef, snap => {
        if(_roomCode !== room || _memberId !== memberId) return;   // 낡은 세션 방어
        if(snap.val() !== true || !_myMemberRef) return;
        set(_myMemberRef, { ..._myMemberData, lastSeen: serverTimestamp() }).catch(()=>{});
        // 🔬 [def-diag] 재접속 재등록 1회 카운트 — 이 순간 방 인원수만큼 def가 재전송됨.
        try{ if(window._defDiag){ window._defDiag.reconnectResets++;
          console.log('[def-diag] 재등록 #'+window._defDiag.reconnectResets+' (~'+window._defDiag.memberBytes+'B, def '+window._defDiag.defBytes+'B) — 첫 1회는 입장 직후 자동, 그 이상이 진짜 재접속'); } }catch(_){}
        _touchRoomIndex(room);   // 💰 재접속 시 요약 노드도 되살림
        onDisconnect(_myMemberRef).remove();   // 이전 onDisconnect는 발동하며 소모됐으므로 다시 예약
      });

      _roomRef = ref(db, `rooms/${room}`);
      /* 🎛️ 방 메타는 따로 구독 — 아래 멤버 쿼리가 _meta를 안 실어오기 때문.
         수십 바이트짜리라 비용은 무시 가능. 메타가 뒤늦게 도착해도 _maybeSucceedHost는
         meta가 없으면 그냥 반환하고, 하트비트로 리스너가 30초마다 다시 도니 승계는 곧 재평가된다.
         (여기서도 직접 한 번 더 돌려서 '메타만 늦게 온' 경우를 즉시 따라잡는다) */
      _roomMetaVal = null; _roomLastFriends = null;
      _roomMetaRef = ref(db, `rooms/${room}/_meta`);
      _roomMetaCb = onValue(_roomMetaRef, msnap => {
        if(_roomCode !== room || _memberId !== memberId) return;
        _roomMetaVal = msnap.val() || null;
        /* 🎛️ 렌더러에도 알린다 — 방장 표시와 🔇 채팅 잠금이 이 값을 본다.
           예전에는 입장할 때 getRoomMeta 로 한 번 읽은 사본(window._roomMetaCache)만 있어서,
           방장이 도중에 무언가를 바꿔도 다른 사람 화면은 그대로였다. 구독은 이미 여기 있었으니
           값을 넘겨주기만 하면 된다(수십 바이트라 비용도 그대로다). */
        try{ window._roomMetaCache = _roomMetaVal; }catch(_){}
        try{ if(typeof window._onRoomMeta === 'function') window._onRoomMeta(_roomMetaVal); }catch(_){}
        if(_roomLastFriends){ try{ _maybeSucceedHost(room, memberId, _roomMetaVal, _roomLastFriends); }catch(_){} }
      });
      /* 💰 멤버만 구독 — chatLog가 방 리스너를 타고 내려오던 경로를 없앤다.
         예전엔 (1) 입장 시 chatLog 전체가 최초 동기화로 무제한 딸려오고
              (2) 채팅 한 줄마다 방 리스너와 subscribeChatLog로 "두 번" 배달됐다.
         이제 chatLog는 subscribeChatLog(limitToLast)로만 오므로 구조적으로 100개에 묶인다. */
      _roomQuery = query(_roomRef, orderByKey(), startAt('m'));
      _roomListener = onValue(_roomQuery, snap => {
        // ★ 이 리스너는 "room/memberId 세션"에 묶여서 만들어졌는데, 그 사이 나갔다가 다른 방(또는 같은 방
        //   재접속)으로 넘어가서 _roomCode/_memberId가 이미 바뀌었다면 이건 낡은 세션의 뒤늦은 콜백임.
        //   off()로 확실히 끊었어도 네트워크 타이밍상 이미 날아오던 스냅샷은 막을 수 없어서, 여기서 한 번 더
        //   방어해야 함 — 안 그러면 옛 방의 데이터(내 예전 자신 포함)가 새 방/세션에 계속 반영돼 보임.
        if(_roomCode !== room || _memberId !== memberId) return;
        const _raw = snap.val() || {};
        // 🧹 첫 스냅샷에서 1회: (1) 내(userId) 이전 세션 노드 정리 — 강제종료 등으로 onDisconnect가 못 지운 것.
        //   내 것만 지우므로 다른 사람에겐 영향 없음. (2) 나 말고 살아있는 멤버가 없는데 chatLog 잔재가 있으면 삭제.
        //   ※ _meta는 건드리지 않음 — 빈 방 승격(setRoomChannel)이 방금 쓴 _meta와 충돌할 수 있어서.
        if(!_initCleanupDone){
          _initCleanupDone = true;
          try{
            const myUid = me && me.userId;
            if(myUid){
              for(const id in _raw){
                if(id === memberId || id.charAt(0) === '_' || id === 'chatLog') continue;
                if(_raw[id] && _raw[id].userId === myUid) remove(ref(db, `rooms/${room}/${id}`)).catch(()=>{});
              }
            }
            /* 🕒 여기도 같은 기준을 쓴다 — 이 판정이 어긋나면 '남이 있는데 없다'고 보고
               chatLog 를 지우러 간다(지금은 KEEP_CHAT_LOG_ON_EMPTY 로 막혀 있지만, 그 상수를
               되돌리는 순간 시계가 틀린 사람 하나가 방 기록을 통째로 날린다). */
            const _now0 = _roomClockNow(_raw, memberId); const _STALE0 = 120*1000;
            let _otherAlive = false;
            for(const id in _raw){
              if(id === memberId || id.charAt(0) === '_' || id === 'chatLog') continue;
              const mm = _raw[id];
              if(mm && mm.lastSeen && (_now0 - mm.lastSeen) < _STALE0){ _otherAlive = true; break; }
            }
            if(!_otherAlive && !KEEP_CHAT_LOG_ON_EMPTY){
              /* 이제 스냅샷에 chatLog가 없으므로 "잔재가 있으면"을 확인할 수 없다.
                 없는 경로를 지우는 건 무해하므로 조건 없이 삭제한다(살아있는 다른 멤버가 없을 때만).
                 ⚠️ 지금은 KEEP_CHAT_LOG_ON_EMPTY 로 꺼져 있다 — 그 상수 주석 참고.
                   여기는 **재부팅 직후 첫 사람**이 지나는 자리라, 살아 있으면 기록이 매 부팅마다 날아간다. */
              remove(ref(db, `rooms/${room}/chatLog`)).catch(()=>{});
            }
          }catch(_){}
        }
        const all = Object.assign({}, _raw);
        const _capturedMeta = _roomMetaVal;   // ★ 승계 판정용 — 이제 별도 _meta 리스너가 채워준다
        delete all[memberId];
        delete all._meta;   // 🎛️ 쿼리상 올 수 없지만, 키 규칙이 바뀌어도 좌석으로 그리지 않도록 방어로 남김
        // 하트비트가 30초 간격이라 3회 유실(90초)을 유령 판정선으로 잡는다 — 예전 5분은 강제종료된
        // 이전 세션 노드가 너무 오래 남아 같은 사람이 여럿으로 보이는 시간이 길었음.
        /* 🕒 기준 시각은 **서버가 찍은 내 lastSeen** 이다 — 내 PC 시계가 아니다(_roomClockNow 주석).
           문턱 120초 = 유실 허용 90초 + 내 lastSeen 이 하트비트 주기(30초)만큼 뒤처지는 몫.
           ⚠️ 90 으로 되돌리지 말 것. 기준값 자체가 최대 30초 과거라, 90 이면 멀쩡한 사람이
             하트비트 주기마다 깜빡였다 나타난다. */
        const now = _roomClockNow(_raw, memberId); const STALE_MS = 120*1000;
        const friends = {};
        for(const id in all){
          const m = all[id];
          if(id.charAt(0) === '_' || id === 'chatLog') continue;   // _로 시작하는 키·chatLog는 메타/예약 — 멤버 아님
          // lastSeen이 있는 최근 멤버만 통과. lastSeen이 아예 없는 항목은 정상 입장에선 생길 수 없고
          // (join 시 serverTimestamp로 반드시 기록됨) 옛 테스트·견본 잔여 데이터뿐이라 유령으로 취급해 제외.
          if(m && m.lastSeen && (now - m.lastSeen) < STALE_MS) friends[id] = m;
        }
        /* 🩺 [진단] **스냅샷에 사람이 있는데 한 명도 통과 못 한 순간만** 한 줄 남긴다.
           이 사안은 `friends` 가 비는 갈래가 넷이라(스냅샷 0건 · lastSeen 없음 · 시계 · 중복제거),
           증상만 보고는 못 가른다. 위 수정이 고치는 것은 그중 '시계' 하나뿐이라,
           그래도 제보가 오면 이 줄이 남은 셋 중 어디인지 바로 말해 준다.
           평소에는 아예 안 찍힌다(이상한 순간에만 찍힌다). 필요 없어지면 이 블록만 지우면 된다. */
        if(_roomOccupants(_raw, memberId) > 0 && Object.keys(friends).length === 0){
          try{
            const ages = [];
            for(const id in all){
              if(id.charAt(0) === '_' || id === 'chatLog') continue;
              const m = all[id];
              ages.push(m && typeof m.lastSeen === 'number' ? (now - m.lastSeen) + 'ms' : 'lastSeen없음');
            }
            console.warn('[방] 멤버 ' + ages.length + '명이 왔는데 통과 0명'
              + ' | 기준시각출처=' + ((_raw[memberId] && typeof _raw[memberId].lastSeen === 'number') ? '서버(내 노드)' : '로컬(_svNow 폴백)')
              + ' | 시계보정=' + _svTimeOffset + 'ms'
              + ' | 나이=[' + ages.join(', ') + ']');
          }catch(_){}
        }
        // 👥 같은 사람(userId)이 여러 세션 노드로 남아 있으면(재접속·강제종료 잔여) lastSeen이 가장 최신인
        //   하나만 남김 — 화면에서 캐릭터가 증식돼 보이던 문제의 직접 원인.
        const _byUser = {};
        for(const id in friends){
          const u = friends[id] && friends[id].userId;
          if(!u) continue;   // userId가 없는 항목(아주 옛 데이터)은 중복 판정 불가 — 그대로 둠
          if(!_byUser[u] || (friends[id].lastSeen||0) > (friends[_byUser[u]].lastSeen||0)){
            if(_byUser[u]) delete friends[_byUser[u]];
            _byUser[u] = id;
          } else {
            delete friends[id];
          }
        }
        /* 🚪 정원 초과 자기 퇴장 — 입장 정원은 startRoom 의 사전 검사(checkRoomCapacity) 하나뿐인데,
           그 검사와 실제 joinRoom 사이에는 채널 확정·_meta 조회·얼굴 URL 업로드 같은 await 가 여러 개
           끼어 있다(수 초). 같은 순간에 둘이 들어오면 둘 다 '자리 있음'을 보고 둘 다 써버린다
           — 제보 "자기 포함 7명"이 이것이다. 서버 규칙에는 인원 제한이 없어(rooms/$room/$memberId 는
           형식만 검사) 서버가 막아주지도 않고, 넘쳐 들어온 사람은 화면에는 안 그려져서
           (app.js syncFriendSeats 가 MAX_PEOPLE-1 명까지만 그린다) "있는데 안 보이는 사람"이 된다.
           그래서 들어온 **뒤에** 한 번 더 본다. 모든 클라이언트가 같은 입력(살아있는 멤버 목록)으로
           같은 결론을 내리므로, 넘친 사람만 스스로 나가면 끝이다 — 서버에 표시를 쓸 필요도,
           트랜잭션도, 경쟁도 없다(방 해산 _onRoomDisbanded 과 같은 방식).
           · 순서는 memberId 오름차순 = 입장순(앞부분이 Date.now 의 36진수라 문자열 정렬이 곧 시간순).
             그래서 나가는 쪽은 언제나 '늦게 온 사람'이고, 먼저 있던 사람은 영향을 받지 않는다.
           · 판정 대상은 위에서 이미 걸러진 friends 다 — 유령(90초)·같은 사람의 중복 세션이
             빠진 뒤라, 잔재 노드 때문에 멀쩡한 사람이 쫓겨나지 않는다.
           · 나가기로 한 순간에는 화면을 그리지 않는다(onChange 를 안 부른다) — 어차피 솔로로
             돌아갈 사람에게 남의 좌석을 잠깐 세웠다 지우는 셈이라. */
        /* 🔒 시크릿룸은 자리 배분이 다르다 — 방장 1(예약석) + 손님 MAX_PEOPLE-1.
           · 방장은 이 판정의 대상이 아니다. 예약석이라 밀려날 자리가 없다. 순서가 memberId
             오름차순 = 입장순이라, 안 빼두면 방장이 마지막에 들어올 때 방장이 쫓겨난다
             (startRoom 에서 방장의 정원 검사를 건너뛰게 해도 여기서 도로 튕기면 아무 의미가 없다).
           · 손님끼리만 MAX_PEOPLE-1 자리를 다툰다. 총원 MAX_PEOPLE 로 세면 방장이 없는 동안
             손님 MAX_PEOPLE 명이 눌러앉아 예약석을 먹고, 방장이 들어올 때마다 손님 하나가
             튕겨나간다 — 예약석은 비어 있어도 남이 못 앉아야 예약석이다.
           · 방장 uid 는 window._srOwnerUid(startRoom 이 secretRooms/{code}/pub.owner 로 채움).
             pub 은 .read:true 라 손님도 읽고, 못 읽으면 startRoom 이 입장 자체를 막는다 —
             그래서 방 안에 있는 사람은 전원 같은 값을 갖는다 = 모두 같은 순서를 계산한다.
             그게 이 '각자 알아서 나간다' 방식의 전제다.
             _meta.host 폴백은 규칙이 바뀌었을 때의 안전망일 뿐 1순위로 쓰면 안 된다 — _meta 리스너는
             멤버 스냅샷보다 늦게 올 수 있고, 그 찰나에 나가는 사람이 0명이거나 2명이 된다. */
        const _cap = (typeof window.MAX_PEOPLE === 'number' && window.MAX_PEOPLE > 0) ? window.MAX_PEOPLE : 8;
        const _srOwner = (String(room||'').indexOf('SCRT-') === 0)
          ? (window._srOwnerUid || (_capturedMeta && _capturedMeta.host) || null) : null;
        const _aliveIds = Object.keys(friends);
        const _uidOf = id => (id === memberId ? (me && me.userId) : (friends[id] && friends[id].userId)) || null;
        if(_srOwner){
          if(_uidOf(memberId) !== _srOwner){                 // 방장은 나가지 않는다
            const _guestCap = _cap - 1;                      // 예약석 한 자리를 뺀 손님 정원
            const _guests = _aliveIds.concat([memberId]).filter(id => _uidOf(id) !== _srOwner).sort();
            if(_guests.indexOf(memberId) >= _guestCap){
              if(typeof window._onRoomOverCapacity === 'function') window._onRoomOverCapacity(_guestCap);
              return;
            }
          }
        } else if(_aliveIds.length + 1 > _cap){
          const _myRank = _aliveIds.concat([memberId]).sort().indexOf(memberId);
          if(_myRank >= _cap){
            if(typeof window._onRoomOverCapacity === 'function') window._onRoomOverCapacity(_cap);
            return;
          }
        }
        onChange(friends);
        _roomLastFriends = friends;   // 메타가 늦게 도착했을 때 승계를 즉시 재평가하기 위해 보관
        // ★ 방장 승계 감지 — friends(살아있는 중복제거된 멤버) + _meta로 판정. 경쟁 없는 결정론적 방식.
        try{ _maybeSucceedHost(room, memberId, _capturedMeta, friends); }catch(_){}
      });

      if(onPoked){
        _myPokeRef = ref(db, `rooms/${room}/${memberId}/poke`);
        _myPokeListener = onValue(_myPokeRef, snap => {
          if(_roomCode !== room || _memberId !== memberId) return;   // 낡은 세션의 뒤늦은 콜백 방어
          const p = snap.val(); if(p) onPoked(p);
        });
      }

      if(_fbHeartbeat) clearInterval(_fbHeartbeat);
      _fbHeartbeat = setInterval(()=>{
        if(_myMemberRef){
          /* ⭐ 경험치 진행도(exp, 0~12칸)를 하트비트에 얹어 보낸다.
             ★ 새 쓰기를 만들지 않는 게 핵심 — lastSeen을 어차피 30초마다 쓰고 있으므로
               필드 하나(약 10바이트)만 늘어난다. 따로 push하면 시간당 12회가 더 늘어난다.
             대가는 진행도가 최대 30초 늦게 반영되는 것인데, 5분 단위로 끊기는 바라 티가 안 난다.
             app.js가 아직 안 떴거나 함수가 없으면 필드를 아예 빼서 옛 값이 남게 둔다(0으로 덮으면
             상대 화면에서 "레벨업 직후"로 오해된다). */
          const _hb = { lastSeen: serverTimestamp() };
          try{ if(typeof window.myExpCells === 'function') _hb.exp = window.myExpCells(); }catch(_){}
          update(_myMemberRef, _hb);
          _touchRoomIndex(room);   // 💰 요약 노드 하트비트 — 카운트가 이 lastSeen(90초)으로 살아있는 방을 판정
        }
      }, 30000);
      _syncPresenceRoom(room);   // 친구 목록에 "온라인 · 방코드"로 표시되게
      return memberId;
    },
    updateMe(payload){
      if(_myMemberData) Object.assign(_myMemberData, payload);   // 재접속 재등록 때 최신 상태가 올라가게
      if(_myMemberRef) update(_myMemberRef, { ...payload, lastSeen: serverTimestamp() });
    },
    // 다른 사람의 캐릭터를 쓰다듬거나 흔들었을 때 그 사람에게 실시간으로 알림(찌르기).
    poke(targetId, type){
      if(!_roomCode || !targetId) return;
      set(ref(db, `rooms/${_roomCode}/${targetId}/poke`), { type, from: _memberId, ts: serverTimestamp() });
    },
    /* 🪄 내 노드에 poke 를 쓴다 — "내가 내 캐릭터에 한 일"을 방 전체가 보게(자기 때리기).
       ★ app.js 는 자기 memberId 를 모른다(방 세션마다 새로 뽑히고 페이로드에도 안 실린다).
         그래서 대상 id 를 받지 않고 여기서 _memberId 를 채운다 — poke 와 그것만 다르다.
       ✅ 규칙 파일 수정 불필요: `rooms/$room/$memberId` 는 .write:true 이고 .validate 는
         hasChildren(['name','state']) 만 본다. 이미 있는 내 노드에 필드를 더하는 것이라 통과한다.
       ⚠️ 자기 노드 poke 는 이 앱에서 선례가 없다(pet·dizzy·fly 는 전부 남을 대상으로 한다).
         방에 둘 이상 들어가서 남의 화면에 보이는지 눈으로 확인할 것. */
    pokeSelf(type){
      if(!_roomCode || !_memberId) return;
      set(ref(db, `rooms/${_roomCode}/${_memberId}/poke`), { type, from: _memberId, ts: serverTimestamp() });
    },
    async leaveRoom(){
      // ★ 리스너는 쿼리(_roomQuery)에 붙어 있으므로 해지도 그 쿼리로 해야 한다 —
      //   _roomRef로 off를 부르면 다른 대상이라 끊기지 않고 리스너가 살아남는다.
      if(_roomQuery && _roomListener) off(_roomQuery, 'value', _roomListener);
      if(_roomMetaRef && _roomMetaCb) off(_roomMetaRef, 'value', _roomMetaCb);
      if(_myPokeRef && _myPokeListener) off(_myPokeRef, 'value', _myPokeListener);
      // 나가기 전에 "나 말고 다른 멤버가 있는지" 스냅샷을 찍어둠 — 마지막 사람이면 _meta도 같이 정리해서
      // 다음에 같은 코드로 재입장할 때 채널 정보가 오염된 상태로 남지 않게(=유령 방 방지).
      const roomCodeForCleanup = _roomCode;
      // 🔬 [def-diag] 퇴장 요약 — 체류 시간 대비 재접속 빈도 + def 비중. 이 수치로 def 분리 효과 판단.
      try{ if(window._defDiag){ const d=window._defDiag; const mins=(Date.now()-d.joinAt)/60000;
        const realRecon=Math.max(0, d.reconnectResets-1);
        console.log('[def-diag] 퇴장 요약 — '+mins.toFixed(1)+'분 체류, 진짜 재접속 '+realRecon+'회'
          +(mins>0?(' ('+(realRecon/mins).toFixed(2)+'회/분)'):'')
          +', 노드 '+d.memberBytes+'B 중 def '+d.defBytes+'B('+Math.round(d.defBytes/d.memberBytes*100)+'%). '
          +'재접속 1회마다 방 인원수만큼 이 def가 재전송됨 → 재접속 잦을수록 def 분리 효과 큼.'); } }catch(_){}
      const myMemberIdForCleanup = _memberId;
      let done = Promise.resolve();
      if(_myMemberRef){
        const ref_ = _myMemberRef;
        // 수동으로 정상 나가는 거니까 "연결 끊기면 자동 삭제" 예약 취소 → 그 다음 즉시 삭제, 순서대로 확실히 기다림.
        done = Promise.resolve(onDisconnect(ref_).cancel()).catch(()=>{}).then(()=>remove(ref_)).catch(()=>{});
      }
      // 내 노드 삭제 완료 후, 방에 남은 멤버가 없으면 _meta·chatLog도 지움(마지막 사람 처리).
      done = done.then(async ()=>{
        try{
          if(!roomCodeForCleanup) return;
          // 💰 남은 멤버 유무 판단엔 "키 목록"만 있으면 됨 — shallow로 가볍게(실패 시 전체 조회 폴백).
          let all = null;
          try{
            const base = (db && db.app && db.app.options && db.app.options.databaseURL) || null;
            if(base){
              const res = await fetch(base.replace(/\/$/,'') + `/rooms/${roomCodeForCleanup}.json?shallow=true`);
              if(res.ok){ const keys = await res.json(); all = (keys && typeof keys==='object') ? keys : {}; }
            }
          }catch(_){}
          if(all === null){
            const snap = await get(ref(db, `rooms/${roomCodeForCleanup}`));
            all = snap.val() || {};
          }
          delete all[myMemberIdForCleanup];   // 방금 지운 나
          /* ★ _meta·chatLog는 멤버가 아닌 예약 노드 — 남은 '진짜 멤버'만 센다.
               (이걸 안 빼면 대화 기록이 있던 방은 chatLog 때문에 마지막 사람이 나가도 방이 안 사라짐 = 유령 방)
             ⚠️ 필터는 '_ 로 시작하는 키 전체'를 거른다 — _meta·chatLog 두 개만 이름으로 빼면
                나중에 _ 로 시작하는 예약 노드가 하나만 늘어도 방이 영원히 안 지워진다.
                화면 멤버 필터·checkRoomCapacity 와 같은 규칙이다. */
          const _isMemberKey = k => k.charAt(0) !== '_' && k !== 'chatLog';
          const _finalCleanup = async (keys)=>{
            if(keys && keys._meta)   await remove(ref(db, `rooms/${roomCodeForCleanup}/_meta`)).catch(()=>{});
            /* 💬 chatLog 는 남긴다(KEEP_CHAT_LOG_ON_EMPTY) — 그 상수 주석에 이유가 있다.
               ★ _meta·roomIndex 삭제는 **그대로 둔다.** 유령 방 판정은 `_isMemberKey` 가
                 chatLog 를 이미 멤버에서 빼고 세므로, 기록만 남은 방은 여전히 빈 방이다. */
            if(!KEEP_CHAT_LOG_ON_EMPTY && keys && keys.chatLog) await remove(ref(db, `rooms/${roomCodeForCleanup}/chatLog`)).catch(()=>{});
            await remove(ref(db, `roomIndex/${roomCodeForCleanup}`)).catch(()=>{});   // 💰 요약 노드도 함께 삭제
          };
          const others = Object.keys(all).filter(_isMemberKey);
          if(others.length === 0){
            await _finalCleanup(all);
          }else{
            /* 🧹 동시 퇴장 경쟁 — 여럿이 한꺼번에 나가면 각자 이 스냅샷에서 서로를 아직 '남은 사람'으로
               보기 때문에 others.length === 0 이 아무에게도 참이 아니다. 그러면 rooms/{code}/_meta 가
               영구 잔류하고, 다음에 같은 코드로 들어온 사람이 남의 채널·방장을 그대로 물려받는다
               (멤버 카운트는 lastSeen 90초로 회복되지만 _meta 는 스스로 사라지지 않는다).
               그래서 남은 사람이 있으면 시차를 두고 키 목록만 한 번 더 확인한다.
               · 시차는 memberId 정렬 순서로 정한다(난수가 아니라) — 같은 순간에 몰려 재조회하지 않게.
               · 비용은 퇴장당 최대 shallow 1회(수십 바이트)다. 주기 조회가 아니다.
               · 재조회에 실패하면(null) 아무것도 지우지 않는다 — 살아 있는 방의 _meta 를
                 잘못 지우느니 유령이 남는 편이 낫다(유령은 관리자 청소로 걷힌다). */
            const _ids = others.concat([myMemberIdForCleanup]).sort();
            const _rank = _ids.indexOf(myMemberIdForCleanup);
            await new Promise(r => setTimeout(r, 1200 + (_ids.length - 1 - _rank) * 700));
            let keys2 = null;
            try{
              const base2 = (db && db.app && db.app.options && db.app.options.databaseURL) || null;
              if(base2){
                const res2 = await fetch(base2.replace(/\/$/,'') + `/rooms/${roomCodeForCleanup}.json?shallow=true`);
                if(res2.ok){ const k2 = await res2.json(); keys2 = (k2 && typeof k2==='object') ? k2 : {}; }
              }
            }catch(_){}
            if(keys2 === null) return;
            if(Object.keys(keys2).filter(_isMemberKey).length === 0) await _finalCleanup(keys2);
          }
        }catch(_){}
      });
      if(_fbHeartbeat) { clearInterval(_fbHeartbeat); _fbHeartbeat=null; }
      if(_connWatchRef && _connWatchCb){ try{ off(_connWatchRef, 'value', _connWatchCb); }catch(e){} }
      _connWatchRef=null; _connWatchCb=null; _myMemberData=null;
      // ★ _roomCode/_memberId를 여기서 즉시(동기적으로) 비워두는 게 핵심 — 위 onValue 리스너들이 off() 처리가
      //   끝나기 전에 네트워크상 이미 날아오던 스냅샷을 받아도, 이 값들이 먼저 바뀌어 있어서 그 콜백 안의
      //   가드(_roomCode!==room / _memberId!==memberId)가 즉시 걸러줌.
      _roomRef=null; _roomQuery=null; _roomListener=null; _roomMetaRef=null; _roomMetaCb=null; _roomMetaVal=null; _roomLastFriends=null;
      _myMemberRef=null; _myPokeRef=null; _myPokeListener=null; _memberId=null; _roomCode=null;
      _syncPresenceRoom(null);   // 방에서 나가면 친구 목록의 방코드 배지도 제거
      return done;
    },

    /* 🗑️ subscribeRoomCount 삭제됨 — onValue(ref(db,'rooms'))로 rooms "전체 트리"(모든 방의 모든 멤버
       아바타·chatLog 포함)를 실시간 구독하던 함수. 호출처는 이미 없었지만(죽은 코드), 실수로 다시 쓰면
       사용자마다 수 MB 초기 동기화 + 모든 방의 모든 변경을 전 사용자에게 중계하게 되는 비용 폭탄이라 제거. */

    /* 💰 roomIndex 기반 카운트 + 🔄 마이그레이션 프로브.
       1) roomIndex(방당 수십 바이트)로 살아있는 방을 집계 — 신버전 클라이언트의 방은 전부 여기서 잡힘.
       2) shallow로 rooms의 "방 코드 목록"만 받아(수십 바이트), 인덱스에 없는 방만 개별 생존 확인:
          멤버 lastSeen 몇 개 + _meta/channel만 콕 집어 읽음(방당 수백 바이트, 결과 60초 캐시).
          → 구버전 클라이언트가 연 방(인덱스 미기록)도 정확히 세면서 rooms "전체 트리"는 절대 안 읽음.
          → 전 사용자가 업데이트되면 2)는 대상 0건이 되어 비용 없이 은퇴한다.
       lastSeen 90초 기준(하트비트 30초×3회 유실)은 화면 멤버 필터와 동일.
       반환: { total, workingroom, togetherroom } (모든 소스 실패 시 각 null) */
    async getRoomCounts(){
      const now = _svNow(); const STALE = 90*1000;
      const out = { total:0, workingroom:0, togetherroom:0 };
      let anySource = false;
      const liveIndexed = new Set();
      try{
        const snap = await get(ref(db, 'roomIndex'));
        const idx = snap.val() || {};
        anySource = true;
        for(const code in idx){
          if(code.indexOf('SCRT-') === 0) continue;                  // 🔒 시크릿룸은 정원에 안 잡힘
          const e = idx[code] || {};
          if(!e.lastSeen || (now - e.lastSeen) >= STALE) continue;   // 죽은/고아 인덱스는 무시
          liveIndexed.add(code);
          const ch = (e.channel === 'togetherroom') ? 'togetherroom' : 'workingroom';
          out.total++; out[ch]++;
        }
      }catch(_){}
      // 🔄 인덱스에 없는(=구버전 클라이언트의 방이거나 유령인) 방만 핀포인트 생존 확인
      try{
        const base = (db && db.app && db.app.options && db.app.options.databaseURL) || null;
        if(base){
          const res = await fetch(base.replace(/\/$/,'') + '/rooms.json?shallow=true');
          if(res.ok){
            anySource = true;
            const keys = await res.json();
            const codes = (keys && typeof keys === 'object') ? Object.keys(keys) : [];
            const unknown = codes.filter(c => !liveIndexed.has(c) && c.indexOf('SCRT-') !== 0).slice(0, 40);   // 폭주 방지 상한 · 🔒 시크릿룸 제외
            const probes = await Promise.all(unknown.map(async code => {
              const cached = _roomProbeCache[code];
              if(cached && now < cached.until) return cached.ch;
              let ch = null;   // null = 죽은 방(유령·전원 이탈)
              try{
                const r2 = await fetch(base.replace(/\/$/,'') + `/rooms/${encodeURIComponent(code)}.json?shallow=true`);
                if(r2.ok){
                  const k2 = await r2.json();
                  const ids = (k2 && typeof k2 === 'object')
                    ? Object.keys(k2).filter(id => id.charAt(0) !== '_' && id !== 'chatLog') : [];
                  if(ids.length){
                    const seens = await Promise.all(ids.slice(0, 6).map(id =>
                      get(ref(db, `rooms/${code}/${id}/lastSeen`)).then(s => s.val()).catch(() => null)));
                    if(seens.some(v => v && (now - v) < STALE)){
                      ch = 'workingroom';   // _meta.channel 미기록(구버전) = 워킹룸
                      try{
                        const ms = await get(ref(db, `rooms/${code}/_meta/channel`));
                        if(ms.val() === 'togetherroom') ch = 'togetherroom';
                      }catch(_){}
                    }
                  }
                }
              }catch(_){}
              _roomProbeCache[code] = { ch, until: now + 60*1000 };
              return ch;
            }));
            probes.forEach(ch => { if(ch){ out.total++; out[ch]++; } });
          }
        }
      }catch(_){}
      if(!anySource) return { total:null, workingroom:null, togetherroom:null };
      return out;
    },
    // 하위호환 API — 기존 호출부(app.js의 방 만들기·빈 방 승격 등)가 그대로 동작하게 유지.
    // 이제 채널 지정 여부와 무관하게 가벼운 roomIndex 조회 하나로 처리된다.
    async getRoomCount(channel){
      const c = await firebaseAPI.getRoomCounts();
      if(!channel) return c.total;
      return (channel === 'togetherroom') ? c.togetherroom : c.workingroom;
    },
    // ★ 채널 개편: 방 생성 시 _meta.channel 기록 / 참여 시 방의 채널 조회.
    //   별도 roomsMeta 노드 대신 기존 _meta를 재사용 — 유령방 정리 로직이 이미 _meta를 함께 지운다.
    /* 🎲 open — '랜덤 참여 허용' 여부. findRandomRooms 가 roomIndex 에서 이 값만 보고 후보를 고른다.
       ⚠️ **명시적 boolean 일 때만** 인덱스에 싣는다. 안 넘겼는데 false 를 써버리면 방장이 켠 방이
          하트비트 한 번에 꺼지고, 반대로 늘 실어 보내면 같은 코드로 예전에 열었던 랜덤 방의
          open:true 가 update() 병합 때문에 그대로 남는다(빈 방 승계·재입장 경로가 전부 그렇다). */
    async setRoomChannel(room, channel, hostUserId, open){
      try{
        const meta = { channel: channel||'workingroom', ts: serverTimestamp() };
        if(hostUserId) meta.host = hostUserId;   // ★ 방장 = 방을 만든 사람의 userId(사람 고정값 — 재접속해도 동일)
        await update(ref(db, `rooms/${room}/_meta`), meta);
        const extra = { channel: channel||'workingroom' };
        if(open === true || open === false) extra.open = open;
        _touchRoomIndex(room, extra);   // 💰 채널별 카운트가 인덱스만 읽으면 되게
      }catch(_){}
    },
    /* 🎲 랜덤 참여 후보 찾기 — roomIndex 하나만 읽는다(getRoomCounts 가 이미 읽는 노드라 새 노드가 아니다).
       조건: 워킹룸 · open===true · lastSeen 신선(90초, 화면 멤버 필터와 같은 기준) · SCRT- 아님.
       · 투게더룸은 후보에서 제외한다 — 라이선스 방에 모르는 사람이 랜덤으로 들어가면 안 된다.
         카드에 토글을 안 그리는 것과 함께 두 겹으로 막는다.
       · 정원·생존 확인은 하지 않는다(인덱스는 최대 90초 낡을 수 있다) — 부르는 쪽이
         checkRoomCapacity 로 확인하며 넘어간다.
       반환: 섞은 코드 배열 / 조회 실패는 null / 후보 없음은 [] — 문구를 다르게 내려고 구분한다. */
    async findRandomRooms(limit){
      try{
        const snap = await get(ref(db, 'roomIndex'));
        const idx = snap.val() || {};
        const now = _svNow(); const STALE = 90*1000;
        const out = [];
        for(const code in idx){
          if(code.indexOf('SCRT-') === 0) continue;
          const e = idx[code] || {};
          if(e.open !== true) continue;
          if((e.channel || 'workingroom') !== 'workingroom') continue;
          if(!e.lastSeen || (now - e.lastSeen) >= STALE) continue;
          out.push(code);
        }
        for(let i=out.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); const t=out[i]; out[i]=out[j]; out[j]=t; }
        return (limit > 0) ? out.slice(0, limit) : out;
      }catch(_){ return null; }
    },
    async getRoomMeta(room){
      try{ const snap = await get(ref(db, `rooms/${room}/_meta`)); return snap.val() || null; }catch(_){ return null; }
    },
    /* 🔇 방 전체 채팅 잠금 — 시크릿룸 방장만 부른다(권한 판정은 렌더러가 한다).
       ★ `_meta` 아래 한 칸만 갱신한다 — set 으로 통째로 쓰면 channel·host·ts 가 날아가
         방장 승계가 그 자리에서 깨진다.
       ⚠️ 규칙 파일은 손댈 필요가 없다: `rooms/$room/_meta` 는 `.write:true` 이고 `.validate` 는
         channel·host·ts **가 있을 때만** 형식을 보므로, 새 자식이 늘어도 통과한다. */
    async setRoomChatOff(room, off){
      if(!room) return { ok:false };
      try{ await update(ref(db, `rooms/${room}/_meta`), { chatOff: !!off }); return { ok:true }; }
      catch(e){ return { ok:false }; }
    },
    /* 🗑 대화 기록 통째 삭제 — 방장이 부른다(권한 판정은 렌더러가 한다).
       ★ 방 전원이 `subscribeChatLog` 로 같은 노드를 보고 있으므로, 이 한 번의 remove 로
         **모두의 화면이 같이 빈다.** 각자에게 따로 알릴 필요가 없다.
       ★ `rooms/{방}/chatLog` **만** 지운다. `_meta` 와 멤버 노드는 건드리지 않는다 —
         통째로 지우면 방장·채널이 날아가 그 자리에서 방이 해산된다.
       ⚠️ 되돌릴 수 없다. 되돌리기를 붙이려면 지운 목록을 어딘가에 옮겨 두어야 하는데,
         그건 "지웠다"는 약속을 어기는 것이라 하지 않기로 했다(요청).
       ⚠️ 규칙 파일에 `rooms/$room/chatLog` 의 삭제 권한이 없으면 여기서 조용히 실패한다.
         부르는 쪽이 반드시 반환값을 보고 실패를 사람에게 말할 것 — 삭제는 "눌렀는데 아무 일도
         안 일어났다"가 가장 나쁜 결과다. (같은 경로의 remove 는 '마지막 사람 퇴장' 정리에서
         이미 쓰고 있다 — 이 파일 위쪽 chatLog 정리 주석 참고.) */
    async clearChatLog(room){
      if(!room) return { ok:false };
      try{ await remove(ref(db, `rooms/${room}/chatLog`)); return { ok:true }; }
      catch(e){ return { ok:false, reason:(e && e.message) || '' }; }
    },
    /* 🚪 빈 방 선점 — 아무도 없는 코드에 두 사람이 거의 동시에 들어올 때 방장과 채널을 하나로 정한다.
       [규칙] 라이선스 보유자가 이긴다. 둘 다 보유자면(또는 둘 다 미보유면) 먼저 쓴 쪽이 방장이다.
         ★ '둘 다 보유자면 아무나'를 난수로 뽑지 않는 이유: 트랜잭션 순서가 이미 임의적이라 결과는
           똑같이 '아무나'인데, 난수를 쓰면 뒤에 온 사람이 앞 사람을 뒤집을 수 있어 방장이 한 번 더
           바뀐다(먼저 들어간 사람의 화면에서 방장 표시가 되돌아간다). 먼저 쓴 쪽으로 굳히는 게 낫다.
       [왜 트랜잭션인가] 각자 setRoomChannel 로 그냥 쓰면 나중 쓰기가 이긴다 — 미보유자가 0.1초
         늦게 들어오는 것만으로 보유자의 투게더룸이 워킹룸으로 덮인다.
       [openTs/openLic] 선점 판정 전용 필드다. _meta.ts/host 는 승계(claimHostIfVacant)도 건드리므로
         그걸 기준으로 삼으면, 승계 직후 방이 빈 경우에 '방금 누가 선점했다'로 오판한다.
       [FRESH] 경합 창은 실제로 1~2초다. 그보다 오래된 openTs 는 이 방이 예전에 열렸다는 뜻이므로
         무시하고 새로 연다 — 강제종료로 _meta 만 살아남은 방을 그대로 물려받지 않기 위한 것. */
    async claimEmptyRoom(room, myUserId, licensed){
      const FRESH = 20*1000;
      try{
        const res = await runTransaction(ref(db, `rooms/${room}/_meta`), cur => {
          // ★ null-캐시 함정 방어(audit #3): cur=null 이 와도 중단하지 않고 여기서 새로 채운다.
          const meta = cur || {};
          const justOpened = meta.openTs && (_svNow() - meta.openTs) < FRESH;
          if(justOpened && meta.host && meta.host !== myUserId){
            // 방금 누가 이 방을 열었다 — 선점자가 보유자거나 내가 미보유면 양보(트랜잭션 취소)
            if(meta.openLic || !licensed) return;
            // 나만 보유자 → 뒤집는다(투게더룸으로). 미보유자는 그 방의 손님으로 남는다.
          }
          meta.host = myUserId;
          meta.channel = licensed ? 'togetherroom' : 'workingroom';
          meta.openLic = !!licensed;
          meta.openTs = _svNow();          // serverTimestamp는 트랜잭션 함수 안에서 못 쓴다
          meta.ts = _svNow();
          return meta;
        });
        const val = res.snapshot ? res.snapshot.val() : null;
        const channel = (val && val.channel) || (licensed ? 'togetherroom' : 'workingroom');
        _touchRoomIndex(room, { channel });   // 💰 채널별 카운트가 인덱스만 읽으면 되게
        return { ok:true, mine: !!res.committed, channel, host: (val && val.host) || null };
      }catch(_){ return null; }
    },
    /* 🩹 [2026-09-16 제보 2] `_meta` 가 **없는** 방의 채널을 되살린다. 있으면 한 글자도 안 건드린다.
       [무엇이 터졌나] `_meta` 를 지우는 코드는 퇴장 정리(위 _finalCleanup) 한 곳뿐인데, 동시 퇴장 대비
         **시차 재조회**와 누군가의 재입장이 겹치면 「멤버는 있는데 `_meta` 만 없는」 방이 남는다.
         그 방은 입장 경로가 «빈 방이면 선점, 아니면 서버 채널을 읽기만» 이라 **아무도 `_meta` 를 다시 안 쓴다.**
         → 멤버도 방장도 워킹룸으로 떨어지고 영원히 못 돌아온다(실제 제보 방 `COZY-42W5`).
       [왜 claimEmptyRoom 을 쓰면 안 되나] 그쪽은 `channel` 이 **이미 있어도 덮어쓴다**(빈 방 승격이 그 일이라서).
         멤버가 있는 방에 그걸 태우면 미보유자가 들어오는 것만으로 남의 투게더룸이 워킹룸이 된다 — 사고가 커진다.
       ⇒ 이 함수는 **`channel` 이 없을 때만** 쓴다. 트랜잭션이라 서버 값으로 다시 돌므로, 로컬 읽기가
         실패했거나 그 사이 누가 먼저 되살렸어도 남의 값을 덮지 않는다(그때는 중단하고 그 값을 돌려준다).
       ★ `openTs` 는 **넣지 않는다.** 이건 «방을 여는 것»이 아니라 «잃어버린 표지를 다시 세우는 것»이라,
         넣으면 직후에 들어오는 보유자의 정상 선점(claimEmptyRoom 의 justOpened 분기)이 막힌다.
       반환: { channel, recovered } | null(실패) */
    async recoverRoomChannel(room, myUserId, licensed){
      try{
        let had = false;
        const res = await runTransaction(ref(db, `rooms/${room}/_meta`), cur => {
          if(cur && cur.channel){ had = true; return; }   // 이미 있다 — 중단(아무것도 안 쓴다)
          const meta = cur || {};
          meta.channel = licensed ? 'togetherroom' : 'workingroom';
          if(!meta.host && myUserId) meta.host = myUserId;   // 방장이 비었을 때만 — 남의 방장을 뺏지 않는다
          meta.ts = _svNow();
          return meta;
        });
        const val = res.snapshot ? res.snapshot.val() : null;
        const channel = (val && val.channel) || null;
        if(!had && channel) _touchRoomIndex(room, { channel });
        return { channel, recovered: !had && !!res.committed };
      }catch(e){ console.warn('[방] 채널 복구 실패', e); return null; }
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
    /* ★ 프리미엄 채팅 기록 — rooms/{room}/chatLog 아래에 push로 쌓는다.
       ⚠️ 예전 주석: "방이 폭파되면 기록도 함께 사라진다(원하는 동작)". **더 이상 아니다** —
         그 동작 때문에 다 같이 앱을 껐다 켜면 기록이 통째로 없어졌다. 지금은 방이 비어도
         chatLog 만 남는다(KEEP_CHAT_LOG_ON_EMPTY 주석 참고). 지우는 건 관리자 청소뿐이다.
       한 방에 최대 100개만 화면에 유지(limitToLast — 저장은 그보다 많이 쌓일 수 있다). */
    async sendChatLog(room, msg){
      try{
        const logRef = ref(db, `rooms/${room}/chatLog`);
        // 상한은 CHAT_TEXT_MAX 한 곳에서 온다 — 아래 slice 와 규칙 파일이 같은 숫자를 봐야 한다.
        /* ⚠️ 1200 은 app.js 의 CHAT_OUT_MAX 와 **짝이다**. 커스텀 이모티콘 마커는 URL 때문에
           하나가 200자 안팎이라, 예전 상한 500 에서는 셋만 붙여도 넘어갔다. 그때 마커 한가운데가
           잘리면 `[emoji:https://…` 가 닫히지 않은 채 남아 그 줄이 통째로 깨졌다
           ("등록 이모티콘을 연속 세 번 쓰면 오류"의 정체). 한쪽만 옮기지 말 것.
           ★ 그래도 잘릴 때를 대비해 꼬리에 남은 **열린 마커 조각은 통째로 버린다.** */
        let _t = String(msg.text||'').slice(0, CHAT_TEXT_MAX);
        _t = _t.replace(/\[(?:emoji|demoji)(?::[^\]]*)?$/, '');
        await push(logRef, {
          uid: msg.uid || null,
          name: (msg.name!=null ? String(msg.name).slice(0,20) : '?'),
          text: _t,
          ts: serverTimestamp()
        });
        return { ok:true };
      }catch(e){
        /* ⚠️ 예전엔 `catch(_){}` 로 통째로 삼켰다. 그래서 규칙에 걸려 **서버가 거부한 줄**도
           보낸 사람에게는 아무 표시가 없었다 — RTDB 는 낙관적 반영이라 내 화면에는 한 번
           떴다가, 거부가 돌아오는 순간 조용히 사라진다. 보내는 쪽에서는 그게 «순서가 뒤엉킨
           것»처럼 보인다. 실패는 실패로 돌려주고, 호출부가 사용자에게 알린다. */
        console.warn('[채팅] 기록 저장 실패 — 길이=' + String(msg && msg.text || '').length
          + ' / 서버 규칙 상한=' + CHAT_TEXT_MAX, e);
        return { ok:false, reason:'전송에 실패했어요' };
      }
    },
    subscribeChatLog(room, onChange, limit){
      try{
        // limit 생략 시 100(대화창 본문). 뱃지 카운트처럼 적게만 필요하면 작은 값을 넘겨 트래픽을 줄인다.
        const n = (typeof limit === 'number' && limit > 0) ? Math.min(200, Math.floor(limit)) : 100;
        const q = query(ref(db, `rooms/${room}/chatLog`), limitToLast(n));
        const cb = snap => {
          const val = snap.val() || {};
          /* ★ push key(k)를 id로 함께 넘긴다 — "여기까지 읽었습니다" 구분선이 이 id를 기준으로 잡는다.
             ⚠️ 다만 **순서는 key 로 잡지 않는다.** 아래 _chatOrder 주석을 볼 것. */
          const list = Object.keys(val).map(k => Object.assign({ id:k }, val[k]));
          list.sort(_chatOrder);
          onChange(list);
        };
        onValue(q, cb);
        return () => { try{ off(q, 'value', cb); }catch(_){} };
      }catch(_){ return ()=>{}; }
    },
    /* ★ 커스텀 이모티콘 — 내 계정(users/{uid}/emojis)에 저장. 어느 프리미엄 방에서도 로드된다.
       이미지는 Storage에 올려 1년 캐시 URL만 RTDB에 둔다(메시지엔 URL만 실려 방 사용량 최소).
       slot 0~7, { cmd(공백없는 명령어), url, gif(bool), ts } */
    async saveEmoji(userId, slot, cmd, dataUrl, isGif){
      try{
        const ext = isGif ? 'gif' : 'png';
        const path = `users/${userId}/emojis/${slot}.${ext}`;
        const storageRef = sref(storage, path);
        const fmt = dataUrl.startsWith('data:') ? 'data_url' : 'data_url';
        await uploadString(storageRef, dataUrl, fmt, { cacheControl: STORAGE_CACHE, contentType: isGif?'image/gif':'image/png' });
        const url = await getDownloadURL(storageRef);
        await set(ref(db, `users/${userId}/emojis/${slot}`), { cmd:String(cmd||'').slice(0,10), url, gif:!!isGif, ts: serverTimestamp() });
        return { ok:true, url };
      }catch(e){ return { ok:false, error:String(e&&e.message||e) }; }
    },
    async getEmojis(userId){
      try{ const snap = await get(ref(db, `users/${userId}/emojis`)); return snap.val() || {}; }catch(_){ return {}; }
    },
    async deleteEmoji(userId, slot){
      try{
        // Storage 파일은 png/gif 둘 다 시도 삭제(어느 쪽이 있었는지 몰라도 안전)
        try{ await deleteObject(sref(storage, `users/${userId}/emojis/${slot}.png`)); }catch(_){}
        try{ await deleteObject(sref(storage, `users/${userId}/emojis/${slot}.gif`)); }catch(_){}
        await remove(ref(db, `users/${userId}/emojis/${slot}`));
        return { ok:true };
      }catch(e){ return { ok:false }; }
    },
    /* ★ 방장 승계 — 경쟁 없는 결정론적 방식.
       남은 멤버는 모두 memberId(=입장시각 기반)로 정렬하면 '입장 순서'가 나온다. 누가 계산해도 같은 순서다.
       그 순서로 훑어 첫 라이선스 보유자가 새 방장. 보유자가 없으면 호출부가 아예 이걸 부르지 않고
       방을 해산한다(_maybeSucceedHost 참고) — newChannel은 그래서 지금은 항상 null이다.
       (파라미터는 남겨둔다: 나중에 다른 채널로 옮기는 승계가 생기면 그대로 쓰면 된다)
       트랜잭션은 '유효한 host가 이미 있으면 손대지 않는다' 한 겹만 — 순간적인 동시 판단으로 두 번 쓰는 것 방지. */
    async claimHostIfVacant(room, myUserId, aliveUserIds, newChannel){
      // aliveUserIds: 지금 살아있는 멤버 userId 목록(호출부가 이미 계산). newChannel: 무료 전환 시 'workingroom'.
      try{
        const metaRef = ref(db, `rooms/${room}/_meta`);
        const res = await runTransaction(metaRef, cur => {
          // ★ null-캐시 함정 방어(audit #3): 첫 실행에 cur=null이 와도 중단하지 말고 서버 값으로 재시도되게 한다.
          //   cur가 null이면 _meta가 아직 없다는 뜻 → 아래에서 새로 채운다(사전 get 불필요, 여기서 생성).
          const meta = cur || {};
          const hostAlive = meta.host && aliveUserIds.indexOf(meta.host) >= 0;
          if(hostAlive) return;              // 유효한 방장이 이미 있음 → 아무것도 안 함(undefined 반환 = 트랜잭션 취소)
          // 방장 자리가 비었다 — 내가 차지(또는 무료 전환)
          meta.host = myUserId;
          if(newChannel) meta.channel = newChannel;
          meta.ts = Date.now();              // serverTimestamp는 트랜잭션 함수 안에서 못 씀 — 클라 시각으로 대체
          return meta;
        });
        return { ok: res.committed, meta: res.snapshot ? res.snapshot.val() : null };
      }catch(_){ return { ok:false }; }
    },
    /* ⚠️ [2026-09-16 제보 2] 이 함수는 «투게더룸»·«워킹룸»·«모름» 셋을 **둘로 뭉갠다** —
         읽기 실패도, `_meta` 가 아예 없는 것도 전부 `'workingroom'` 이 된다. 그래서 표지를 잃은 방이
         «정말 워킹룸» 과 구분되지 않았고, 멤버는 조용히 채팅 없는 방에 들어갔다.
       ⇒ 갈라 보고 싶으면 아래 `getRoomChannelEx` 를 쓸 것. 이 함수는 **옛 호출부 호환으로 남긴다**
         (구버전 폴백 경로가 아직 부른다). 새 코드에서 이걸 쓰지 말 것. */
    async getRoomChannel(room){
      try{
        const snap = await get(ref(db, `rooms/${room}/_meta`));
        const meta = snap.val();
        return (meta && meta.channel) ? meta.channel : 'workingroom';   // 구버전 방은 무료로 간주
      }catch(_){ return 'workingroom'; }
    },
    /* 🩹 셋을 가른 판. { channel:'togetherroom'|'workingroom' } · { channel:null } = 표지 없음 · null = 읽기 실패.
       «표지 없음» 과 «읽기 실패» 를 굳이 가르는 이유: 전자는 되살려야 하고, 후자는 아무것도 하면 안 된다
       (네트워크가 나쁜 순간에 남의 투게더룸을 워킹룸으로 되살리면 그게 더 큰 사고다). */
    async getRoomChannelEx(room){
      try{
        const snap = await get(ref(db, `rooms/${room}/_meta`));
        const meta = snap.val();
        return { channel: (meta && meta.channel) ? meta.channel : null };
      }catch(e){ console.warn('[방] 채널 조회 실패', e); return null; }
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
    async getInviteAccount(userId){
      const snap = await get(ref(db, `users/${userId}`));
      const v = snap.val();
      if(!v) return null;
      // hasLegacy: "실사용 흔적" — 친구/마이홈/스케줄/방명록 등.
      //   presence·profile은 앱이 첫 실행에 자동으로 쓰기 때문에 신규 유저도 갖게 됨 → 판정에 쓰면 안 됨.
      const hasLegacy = !!(v.home || v.friends || v.schedule || v.ddays || v.guestbook || v.clap);
      return { exists:true, invite: v.invite || null, hasProfile: !!(v.profile || v.home), hasLegacy };
    },
    // 기존 유저 grandfather 처리 — 초대 정보가 없으면 5장 부여하고 통과
    async grandfatherInvite(userId, grantCount){
      const inviteRef = ref(db, `users/${userId}/invite`);
      const result = await runTransaction(inviteRef, cur=>{
        if(cur) return cur;   // 이미 초대 정보가 있으면 그대로 (중복 지급 방지)
        return { invitesLeft: grantCount, invitedBy: null, joinedAt: Date.now() };
      });
      return result && result.snapshot ? result.snapshot.val() : null;
    },
    // 초대 코드 사용 — 미사용 코드만 소진 가능(트랜잭션으로 동시 사용 방지)
    /* 🎟️ [회원가입 설계 §3 · 개정 8] 초대 코드 소진은 **기기 토큰**으로 한다 — uid 가 아직 없다.
       예전엔 `redeemInvite(code, getMyUserId())` 였고 그 호출 자체가 새 사람의 uid 를 **발명**했다.
       ★ 여기서는 `usedBy`·`usedAt` 만 쓴다. 예전에 같이 하던 `users/{uid}/invite` 와 `stats/userCount`
         는 uid 가 정해진 뒤 `finishInviteSignup` 이 한다 — 토큰 자리에 쓰면 `users/t…` 유령 노드가 생긴다.
       ★ `usedBy === token` 이면 다시 통과한다(같은 기기의 재시도 · 가입 도중 끊긴 판). */
    async redeemInvite(code, token){
      try{
        if(!token) return { ok:false, reason:'초대 코드를 확인하지 못했어요 — 다시 시도해 주세요' };
        const codeRef = ref(db, `invites/${code}`);
        // ★ issueInvite와 같은 함정 — 첫 실행의 cur는 로컬 캐시(null)라서
        //   실제 코드가 있어도 "존재하지 않음"으로 중단돼 버림. 서버 값을 미리 읽어 기준으로 씀.
        const preSnap = await get(codeRef);
        const preVal = preSnap.val();
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
    /* 🎟️ uid 가 정해진 뒤 — 토큰 자리를 진짜 uid 로 바꾸고, 예전 redeemInvite 가 하던 두 쓰기를 한다.
       ★ `usedBy` 가 이 토큰일 때만 바꾼다(이미 uid 면 그대로 둔다 — 재시도해도 한 번).
       ★ `users/{uid}/invite` 가 이미 있으면 다시 안 쓴다 → 가입 카운터도 한 번만 오른다.
       실패하면 { ok:false } — 부르는 쪽은 토큰을 지우지 않고 다음 부팅에 다시 부른다. */
    async finishInviteSignup(code, token, userId){
      try{
        if(!code || !token || !userId) return { ok:false, reason:'값이 비었어요' };
        const codeRef = ref(db, `invites/${code}`);
        const preVal = (await get(codeRef)).val();
        let issuedBy = (preVal && preVal.issuedBy) || null;
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
        const invRef = ref(db, `users/${userId}/invite`);
        const had = (await get(invRef)).exists();
        if(!had){
          // 신규 유저 — 초대로 들어왔으므로 초대권 0장 (신규 지급 중단 · 예전 redeemInvite 그대로)
          await update(invRef, { invitesLeft: 0, invitedBy: issuedBy, joinedAt: Date.now() });
          // 📊 가입 카운터 +1 — 전체 users를 못 읽으니(프라이버시) 숫자만 따로 집계
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
        const ghosts = [];
        for(const code in all){
          const room = all[code] || {};
          let alive = false;
          for(const k in room){
            if(k === '_meta' || k === 'chatLog') continue;
            const mm = room[k];
            if(mm && mm.lastSeen && (now - mm.lastSeen) < STALE){ alive = true; break; }
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
            if(!(code in all) || ghosts.indexOf(code) !== -1) dels.push(remove(ref(db, `roomIndex/${code}`)).catch(()=>{}));
          }
          await Promise.all(dels);
        }catch(_){}
        return { ok:true, cleaned: ok, failed: fail, total: Object.keys(all).length };
      }catch(e){ return { ok:false, error:String(e&&e.message||e) }; }
    },
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
    // licenseRequests/{reqId} = { name, status:'pending'|'approved', requestedAt, issuedKey|null, approvedAt|null }

    // 사용자: 라이선스 요청 보내기(내 표시 이름과 함께)
    async requestLicense(name){
      const reqId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await set(ref(db, `licenseRequests/${reqId}`), { name: name||'(이름 없음)', status:'pending', requestedAt: serverTimestamp(), issuedKey:null });
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
    async publishDesk(id, data){
      let rec = await _uploadGlbIfNeeded('catalog/desks/'+id+'.glb', data);
      rec = await _uploadThumbIfNeeded('catalog/desks/'+id+'.thumb.png', rec);
      await set(ref(db, `catalog/desks/${id}`), { ...rec, createdAt: serverTimestamp() });
      return { ok:true };
    },
    async unpublishDesk(id){
      await _tryDeleteStorage('catalog/desks/'+id+'.glb');
      await remove(ref(db, `catalog/desks/${id}`));
      return { ok:true };
    },
    subscribeCatalogDesks(onChange){
      onValue(ref(db, 'catalog/desks'), snap => onChange(snap.val()||{}));
    },

    // ---- 아이템(소품) 카탈로그 (책상과 동일한 방식) ----
    async publishItem(id, data){
      let rec = await _uploadGlbIfNeeded('catalog/items/'+id+'.glb', data);
      rec = await _uploadThumbIfNeeded('catalog/items/'+id+'.thumb.png', rec);
      await set(ref(db, `catalog/items/${id}`), { ...rec, createdAt: serverTimestamp() });
      return { ok:true };
    },
    async updateDesksOrder(orderMap){
      const updates = {};
      for(const id in orderMap) updates[`catalog/desks/${id}/order`] = orderMap[id];
      await update(ref(db), updates);
      return { ok:true };
    },
    async updateItemsOrder(orderMap){
      const updates = {};
      for(const id in orderMap) updates[`catalog/items/${id}/order`] = orderMap[id];
      await update(ref(db), updates);
      return { ok:true };
    },
    async unpublishItem(id){
      await _tryDeleteStorage('catalog/items/'+id+'.glb');
      await remove(ref(db, `catalog/items/${id}`));
      return { ok:true };
    },
    subscribeCatalogItems(onChange){
      onValue(ref(db, 'catalog/items'), snap => onChange(snap.val()||{}));
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
      await set(ref(db, `${node}/${id}`), { ...rec, createdAt: serverTimestamp() });
      /* 수정으로 가챠↔꾸미기 통이 바뀌었을 수 있다 — 반대편에 남은 옛 항목을 정리.
         (없으면 remove 는 조용히 지나간다) */
      try{ await remove(ref(db, `${other}/${id}`)); }catch(_){}
      return { ok:true };
    },
    async updatePartsOrder(orderMap, gachaOrderMap){
      const updates = {};
      for(const id in (orderMap||{})) updates[`catalog/parts/${id}/order`] = orderMap[id];
      /* 🎰 가챠 파츠의 순서는 제 경로에 쓴다 — catalog/parts/{가챠id}/order 로 쓰면
         {order}만 있는 항목이 생겨 .validate(cat·name 필수)에 걸리고, RTDB 다중 경로 update 는
         한 경로만 거부돼도 통째로 실패한다(= 꾸미기 순서까지 같이 안 바뀐다). */
      for(const id in (gachaOrderMap||{})) updates[`catalog/gachaParts/${id}/order`] = gachaOrderMap[id];
      if(Object.keys(updates).length) await update(ref(db), updates);
      return { ok:true };
    },
    /* 🧹 Storage 이관 뒷정리 — 이미 glbUrl이 있는(=Storage로 옮겨진) catalog 항목의 남은 base64 glb 필드만
       DB에서 삭제. glbUrl이 없는 항목은 안전하게 건너뜀(원본 소실 방지). onValue 다운로드 비용의 주범 제거.
       dryRun=true면 실제로 지우지 않고 대상 수/용량만 계산해서 반환. */
    async cleanupCatalogBase64(dryRun){
      const kinds = ['parts','desks','items'];
      const report = { willDelete:0, skipNoUrl:0, alreadyClean:0, bytes:0, byKind:{} };
      const updates = {};
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
          if(!dryRun) updates[`catalog/${kind}/${id}/glb`] = null;  // 이 필드만 삭제(다른 필드 유지)
        }
      }
      report.mb = (report.bytes/1048576).toFixed(2);
      if(!dryRun && Object.keys(updates).length) await update(ref(db), updates);
      return report;
    },
    async unpublishPart(id){
      await _tryDeleteStorage('catalog/parts/'+id+'.glb');
      /* 어느 통에 있는지 호출자가 알 필요 없게 양쪽 다 지운다 — 없는 쪽 remove 는 no-op */
      await remove(ref(db, `catalog/parts/${id}`));
      try{ await remove(ref(db, `catalog/gachaParts/${id}`)); }catch(_){}
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
      const r1 = ref(db, 'catalog/parts');
      const r2 = ref(db, 'catalog/gachaParts');
      onValue(r1, snap => { parts = snap.val() || {}; emit(); });
      onValue(r2, snap => { gacha = snap.val() || {}; emit(); });
      return () => { off(r1, 'value'); off(r2, 'value'); };
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
        await set(ref(db, `catalog/gachaParts/${id}`), rec);
        await remove(ref(db, `catalog/parts/${id}`));
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
    async saveAdvBg(userId, bg){
      try{
        if(!bg) await remove(ref(db, `users/${userId}/advBg`));
        else await set(ref(db, `users/${userId}/advBg`), bg);
        return { ok:true };
      }catch(e){ return { ok:false }; }
    },
    async getAdvBg(userId){
      try{ const s=await get(ref(db, `users/${userId}/advBg`)); return s.val() || null; }
      catch(e){ return null; }
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
    async sendInboxMessage(toId, tag, title, body){
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      await set(ref(db, `inbox/${toId}/${id}`), {
        tag: (tag==='update'||tag==='reward') ? tag : 'notice',
        title: String(title||'').slice(0,80),
        body:  String(body ||'').slice(0,600),
        ts: Date.now(), read: false,
      });
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
      await set(ref(db, `inboxBroadcast/${id}`), rec);
      return { ok:true, count:'전체' };
    },
    // 📌 관리자: 기존 공지의 고정 상태만 토글 (내용은 그대로 두고 pinned만 갱신)
    async setInboxBroadcastPinned(msgId, pinned){
      try{
        if(pinned) await set(ref(db, `inboxBroadcast/${msgId}/pinned`), true);
        else await remove(ref(db, `inboxBroadcast/${msgId}/pinned`));
        return { ok:true };
      }catch(_){ return { ok:false }; }
    },
    // 공용 공지 구독 → onChange({ id:{tag,title,body,ts} })
    subscribeInboxBroadcast(onChange){
      const r = ref(db, 'inboxBroadcast');
      const unsub = onValue(r, snap => onChange(snap.val() || {}));
      return ()=>{ try{ unsub(); }catch(_){} };
    },
    // 관리자: 공용 공지 삭제
    async deleteInboxBroadcast(msgId){ try{ await remove(ref(db, `inboxBroadcast/${msgId}`)); }catch(_){} },

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
           ⚠️ 로그아웃까지 해야 한다 — 세션만 남기면 "로그인은 됐는데 계정은 없는" 상태가 된다(규약 ⑤). */
        if(!userCode){
          try{ await fbSignOut(auth); }catch(_){}
          return { ok:false, needCode:true, reason:'이 구글 계정에 연결된 기록이 없어요' };
        }
        /* 선점은 runTransaction 으로. set 으로 덮으면 한 기기에서 두 계정으로 로그인한 사람이
           먼저 묶인 계정의 데이터를 통째로 빼앗는다. */
        const tr = await runTransaction(ref(db, `userAuth/${userCode}`), cur => (cur == null ? uid : undefined));
        const owner = tr && tr.snapshot ? tr.snapshot.val() : null;
        if(owner !== uid){
          /* 이 기기 코드는 이미 남의 계정 것이다. 로그아웃시켜 되돌린다 —
             로그인 상태로 남겨두면 "로그인은 됐는데 내 데이터가 아닌" 상태가 된다. */
          try{ await fbSignOut(auth); }catch(_){}
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
        _sessionUnsub = onValue(_sessionRef, snap => {
          const v = snap.val();
          if(!v || !v.id || v.id === _sessionId || _sessionLost) return;
          _sessionLost = true;
          /* presence 를 놓는다 — 내 onDisconnect 가 남아 있으면 내가 꺼질 때 이긴 쪽을 오프라인으로 만든다. */
          try{ if(_myPresenceRef) onDisconnect(_myPresenceRef).cancel(); }catch(_){}
          _myPresenceRef = null;
          try{ if(typeof onLost === 'function') onLost(v); }catch(_){}
        });
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
                        ② 일회용 함수 moveAccountSnap(functions/index.js — 안 들어오는 사람 몫).
       ⚠️ 새 자리는 결속된 코드만 쓴다(userAuth/{코드} === 내 authUid). 부르는 셋(가입 끝 · 구글 첫 결속 · 부팅)은 다 결속 뒤다.
       ⚠️ 값이 규칙 범위를 벗어나면 그 항목만 뺀다 — 하나가 틀려 통째로 거절되면 라이선스까지 못 남긴다. */
    async setAccountSnapshot(userCode, snap){
      if(!userCode || !snap) return { ok:false };
      try{
        await update(ref(db), {
          [`accountSnap/${userCode}`]: _acctSnapClean(snap, Date.now()),
          [`users/${userCode}/transferData`]: null
        });
        return { ok:true };
      }catch(e){ return { ok:false }; }
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
          }catch(_){}   // 못 옮겨도 이번 복원은 한다 — 다음 부팅의 setAccountSnapshot 이나 moveAccountSnap 이 옮긴다
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

  /* ═══════════ 🕰 미스테리au 파티 전송선 (MYS_NET) ═══════════════════════════
     게임(parts/mystery-au.js)은 RTDB 를 모른다. 접점은 join/leave/send 셋뿐이고,
     firebase 를 부르는 곳은 여기 하나다 — 게임 파일에 firebase 를 넣으면 마이홈의 API 가
     바뀌는 날 게임이 같이 죽는다(window.MYHOME_DESKTOP 하나만 본다는 규칙과 같은 이유).

     경로   mysRooms/{코드}/msg/{pushKey} = { ts, j }
       · j = 메시지를 JSON 문자열로 담은 것. 객체를 그대로 쓰면 빈 배열이 사라지고
         undefined 가 섞이면 write 자체가 예외로 죽는다. 문자열이면 보낸 모양 그대로 도착한다.
       · 방 하위(msg)만 만진다. mysRooms 최상위를 통째로 읽거나 구독하지 않는다(audit 검사 9).

     구독   query(msg, limitToLast(20)) + onChildAdded
       ⚠ 창(limitToLast) 없이 노드에 그냥 붙으면 그 방의 과거가 통째로 내려오고,
         이후 누가 한 걸음 걸을 때마다 전원 몫이 다시 내려온다. 그게 rooms 전체 구독으로
         비용이 터졌던 것과 같은 실수다. 창이 있으면 새 메시지 하나만 내려온다.
       ⚠ onChildAdded 는 붙는 순간 창에 남아 있던 것을 한꺼번에 되돌려준다. 그래서 붙기 직전에
         있던 키를 먼저 적어두고 그것만 버린다. 시각(ts)으로 자르지 않는 이유 —
         서버 오프셋이 아직 안 들어온 채로 PC 시계가 틀어져 있으면 남의 멀쩡한 말을 전부
         옛것으로 보고 버려서, 그 사람만 "들어왔는데 아무도 없다"가 된다.

     ⚠ 어댑터는 '전달'만 한다. 정원·잠금·파티장·착수 자격 판정은 전부 게임 쪽 일이다.
       여기에 판정을 넣으면 전송 방식을 바꾸는 날 게임 규칙이 같이 바뀐다.
     ⚠ 에코(내가 보낸 것이 나에게 돌아오는 것)는 게임도 from 으로 거르지만 여기서도 거른다. */
  const MYSNET_KEEP = 6;      // 방에 남겨두는 '내' 메시지 수. 그보다 오래된 내 것은 지운다
  const MYSNET_WIN  = 20;     // 구독 창 크기. 이만큼만 동기화된다
  const MYSNET_MAXJ = 4096;   // 메시지 한 개 상한(문자) — 규칙(.validate)의 값과 같아야 한다
  let _mysRoom = null, _mysUid = null, _mysCb = null, _mysTok = 0;
  let _mysOff = null, _mysMine = [];
  const _mysMsgRef = () => ref(db, `mysRooms/${_mysRoom}/msg`);
  /* 내가 쓴 것만 지운다. ⚠ 남의 메시지에 손대면 상대가 아직 못 읽은 것을 지우게 된다. */
  function _mysTrim(){
    if(!_mysRoom || _mysMine.length <= MYSNET_KEEP) return;
    const cut = _mysMine.splice(0, _mysMine.length - MYSNET_KEEP), patch = {};
    cut.forEach(k => { patch[k] = null; });
    try{ update(_mysMsgRef(), patch).catch(()=>{}); }catch(_){}
  }
  const MYS_NET_IMPL = {
    join(room, me, onMsg){
      MYS_NET_IMPL.leave();
      const code = String(room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const uid  = String((me && me.id) || '');
      if(!code || !uid) return;
      _mysRoom = code; _mysUid = uid; _mysCb = onMsg; _mysMine = [];
      const tok = ++_mysTok;                       // 그새 나갔는지 알아보는 표
      const qy = query(_mysMsgRef(), limitToLast(MYSNET_WIN)), old = Object.create(null);
      const attach = () => {
        if(tok !== _mysTok) return;                // 붙기 전에 나갔거나 다른 방에 들어갔다
        _mysOff = onChildAdded(qy, snap => {
          if(old[snap.key]) return;                // 내가 들어오기 전에 이미 있던 것
          const e = snap.val();
          if(!e || typeof e.j !== 'string') return;
          let msg = null;
          try{ msg = JSON.parse(e.j); }catch(_){ return; }
          if(!msg || msg.from === _mysUid) return;
          try{ if(_mysCb) _mysCb(msg); }
          catch(err){ console.warn('[미스테리au] 수신 처리 실패', err); }
        });
      };
      /* 스냅샷과 구독 사이에 들어온 것은 old 에 없으므로 그대로 전달된다 — 놓치지 않는다. */
      try{ get(qy).then(s => { s.forEach(c => { old[c.key] = 1; }); attach(); }, attach); }
      catch(_){ attach(); }
    },
    send(msg){
      if(!_mysRoom || !_mysUid) return;
      let j = null;
      try{ j = JSON.stringify(msg); }catch(_){ return; }
      if(!j) return;
      if(j.length > MYSNET_MAXJ){
        /* 규칙이 거부할 크기다. 조용히 보내면 '나만 안 보이는' 상태가 되므로 남긴다. */
        console.warn('[미스테리au] 메시지가 너무 커서 보내지 않았다 —', msg && msg.t, j.length);
        return;
      }
      try{
        const r = push(_mysMsgRef(), { ts: _svNow(), j });
        if(r && r.key) _mysMine.push(r.key);
      }catch(e){ console.warn('[미스테리au] 전송 실패', e); return; }
      _mysTrim();
    },
    leave(){
      if(_mysOff){ try{ _mysOff(); }catch(_){} _mysOff = null; }
      const room = _mysRoom, keys = _mysMine;
      _mysTok++; _mysRoom = null; _mysUid = null; _mysCb = null; _mysMine = [];
      if(!room || !keys.length) return;
      /* ⚠ 게임은 나가기 직전에 'bye' 를 보낸다. 그것까지 곧장 지우면 상대가 읽기 전에
         사라져서 35초(TTL)가 지나서야 내가 명단에서 빠진다. 치우는 것만 늦춘다. */
      setTimeout(() => {
        const patch = {};
        keys.forEach(k => { patch[k] = null; });
        try{ update(ref(db, `mysRooms/${room}/msg`), patch).catch(()=>{}); }catch(_){}
      }, 2000);
    }
  };
  /* 껍데기(아래 classic 스크립트)가 먼저 앉아 있다. 그 자리에 실제 어댑터를 꽂는다. */
  if(typeof window.__mysNetBind === 'function') window.__mysNetBind(MYS_NET_IMPL);
  else window.MYS_NET = MYS_NET_IMPL;

  window.dispatchEvent(new Event('firebase-ready'));
