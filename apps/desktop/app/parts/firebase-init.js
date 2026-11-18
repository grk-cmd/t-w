/* 🔒 CSP — 이 파일은 원래 desk-companion-prototype.html 안의 인라인 <script type="module"> 였다.
   `script-src` 에서 'unsafe-inline' 을 버리기 위해 밖으로 뺐다. 내용은 한 글자도 안 바꿨고,
   바뀐 것은 firebase-config 의 상대경로 한 줄뿐이다(파일이 parts/ 안으로 들어왔으므로
   './parts/firebase-config.js' → './firebase-config.js').
   ⚠️ HTML 에서 반드시 type="module" 로 불러야 한다 — import 문이 들어 있고,
     module 은 지연 실행이라 그 덕분에 parts/app.js(classic) 뒤에 도는 기존 순서가 유지된다.
   ⚠️ (걷힘 · 개정 61) 예전에는 맨 끝에서 window.__mysNetBind(미스테리au 파티 전송선)를 불렀다. 그 게임과 함께 걷었다. */

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getDatabase, ref as _dbRef, get as _sdkGet, forceWebSockets } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";   // 남은 DB 읽기는 점검 칸(config/maintenance) 하나
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
  import { createChatHistory, createIdbChatStore } from "./chat/chat-history.js";
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
  forceWebSockets();   // 연결은 웹소켓으로만 — CSP script-src 에 DB 주소가 없어 긴 폴링(스크립트 태그)은 막힌다. SDK 가 남기는 «웹소켓 실패 기억»(localStorage)으로 폴링을 먼저 쓰지 않게(E-6)
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

  /* 💰 Storage 캐시 정책 — 한 번 받은 파일은 브라우저/앱이 재사용해서 다운로드 대역폭(=서버비)을 아낌. */
  const STORAGE_CACHE = 'public, max-age=31536000';
  /* 🛠 점검 표시 — 서버 /v2/config 가 먼저, 서버에 닿지 못할 때만 이 Firebase 칸을 한 번 읽는다(점검 중에도 규칙이 이 칸 읽기는 연다). 읽는 때 · 주인은 maintenance-gate.js 한 곳 */
  const _mt = window.TwMaintenance.store;
  _mt.start({ readServer: () => window.TwApi.client.get(window.TwMaintenance.CONFIG_PATH),   // 앱 공통 API 통로 — 원격 설정과 같은 길이면 하나로 합치고 같은 값이면 304
    readFlag: () => _sdkGet(ref(db, window.TwMaintenance.MAINTENANCE_PATH)).then((s) => s.val()), rt: window.TwRtHub.store });
  const _getIdToken = (force) => (auth && auth.currentUser) ? auth.currentUser.getIdToken(!!force) : Promise.resolve(null);
  /* 🌐 로그인이 필요한 API 통로(api-client.js TwApi.authed — 쉬기 없음 · 기기 머리) — 토큰 출처만 여기서 잇는다. */
  window.TwApi.bindToken(_getIdToken);
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
    getIdToken(force){ return _getIdToken(force); },
    // 서버 방에 들어가고 나갈 때 친구 목록의 «온라인 · 방코드» — Firebase 방은 joinRoom · leaveRoom 이 직접 한다.
    /* ===== 🧬 캐릭터 슬롯 · 보관함은 서버 원본(character/closet-api.js — /v2/me/avatars). 여기는 Storage 올리기만 남았다 =====
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
       Storage `away/{uid}/away_{ts}.webp`(규칙: 300KB 미만 · 삭제 허용) → URL 은 서버로(PUT /v2/me/away-image — away-pic.js).
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
    /* 다운로드 URL 로 Storage 파일을 지운다 — 없거나 거절돼도 조용히(옛 그림 정리용). */
    async deleteStorageUrl(url){
      if(!url || !/^https:\/\/firebasestorage\.googleapis\.com\//.test(url)) return;
      try{ await deleteObject(_stRef(storage, url)); }catch(_){}
    },

    // (마이홈 페이지)
    // 읽기 · 쓰기 · 그림 올리기는 서버 API(myhome/myhome-api.js · 상태 주인 myhome-store.js)로 옮겼다 — 여기 남은 길 없음(getMyHome · saveMyHome · _myHomeLimits 걷음).
    // ===== 방명록 / 웹박수 =====
    // 읽기 · 쓰기 · 박수 · 폭죽 · 그림은 서버 API(myhome/guestbook-api.js)로 옮겼다 — 여기 남은 길 없음.
    // 🔒 시크릿룸 — 발급 · 만료 · 조회는 전부 서버 API 다(Firebase 길 없음).
    /* 발급 · 만료 처리는 서버(POST /v2/admin/secret-rooms · 앱 admin/admin-license-bulk.js)가 한다 — Firebase 로 쓰던 issueSecretRoom · expireSecretRoom 은 D8-5 에서 걷었다. */
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
      subscribeSince: (room, tab, since, onMsg, onReady, onFail) => window.TwChatRt.store.subscribeSince(room, tab, since, onMsg, onReady, onFail),
      clearLog: (room, tab) => window.TwChatRt.store.clear(room, tab) }),
    /* 😊 내 이모티콘 그림 올리기 — 서버가 받는 자리 users/{내 코드}/emojis/{칸}.png|gif 에만. 칸 저장 · 지우기는 API(chat-rt.js). 반환: 내려받기 주소 */
    async uploadEmojiImage(userCode, slot, dataUrl, isGif){
      const storageRef = sref(storage, `users/${userCode}/emojis/${slot | 0}.${isGif ? 'gif' : 'png'}`);
      await uploadString(storageRef, dataUrl, 'data_url', { cacheControl: STORAGE_CACHE, contentType: isGif ? 'image/gif' : 'image/png' });
      return getDownloadURL(storageRef);
    },
    /* ═══════════ 🔑 로그인(Firebase Auth) 원시 — 토큰 받기만 ═══════════
       0.13 은 로그인만 앱 ↔ Firebase Auth 가 하고 «이 로그인이 누구인가» 는 서버가 정한다(GET /v2/me — account/login-flow.js).
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

    /* 📷 스티커사진 — 세션 · 정원은 세션 포트(purikura/purikura-rt.js). 여기는 프레임 그림 올리기만 남았다. */
    /* 🖼 올린 프레임을 Storage 에 올리고 **URL 만** 돌려준다.
       ★ 왜 _uploadDataUrlIfNeeded 를 안 쓰나 — 그쪽은 업로드가 실패하면 **dataURL 을 그대로
         돌려준다.** 프로필 사진에는 맞는 처리다(이미지가 통째로 날아가느니 DB 에 두는 게 낫다).
         그런데 여기서는 그 값이 곧장 setFrameUrl(세션 포트) 로 가서 방 전원에게 내려간다 — dataURL 은
         서버가 거절하고(주소는 우리 버킷의 purikura/{방}/{방장 userCode}/ 경로만), 받은 사람도 큰 값을 내려받게 된다.
         그래서 여기서는 **실패를 실패로** 알린다.
       ⚠️ 경로 purikura/{방}/{내 userCode}/{컷}.webp 는 부르는 쪽(purikura-ui.js)이 만든다 — 서버는 방장 경로의 주소만 받는다.
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

  try{ window.firebaseAPI.chatHistory.bindSettings(document, (m) => { window.toast(m); }); }catch(_){}   // 설정 › 시스템 [저장된 대화 지우기]
  window.dispatchEvent(new Event('firebase-ready'));
