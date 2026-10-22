/* playlist.js — 🎵 상태칩 플레이리스트(데이터 · 화면 · 프리셋 고르기 · 재생 감시견 · 재생 제어 · 버튼 연결)
   app.js 의 다섯 구역(«🎵 상태칩 플레이리스트» · «🎵 프리셋 세 벌» · «🎵 플레이리스트 화면 — 명함 · 목록 · 흐르는 제목 · 미니미 · 파도타기» ·
   «🎵 프리셋 고르기» · «🐕 재생 감시견»)을 그대로 옮긴 모듈이다(앱 FSD 16번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   사이에 끼어 있던 «👤 프로필 소개칸»(머리만) · «🏅 레벨 티어»(LV_TIERS · lvTierNum · lvBadgeClass …)는 app.js 에 남겼다 —
   레벨 배지는 친구 목록 · 좌석 · 내 정보도 쓴다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게). 구역 머리 주석까지 같이 왔고,
     app.js 에는 같은 제목의 한 줄 머리만 남겼다(구역 번호가 밀리지 않게 — 그 아래에 연결 · 옮긴 곳 안내만 있다).
     바뀐 것은 세 줄뿐이다 — 모두 app.js 가 다시 대입하는 let 을 읽는 함수로 읽는다.
       · _myHomeLoaded → _myHomeLoaded() · _myHomeData → _myHomeData()   (마이홈 로드가 다시 대입 — 내 명함 사진)
       · _myHomeFriends → _myHomeFriends()                               (친구 목록 구독이 다시 대입 — 🌊 친구 파도타기 목록)
   ★ 상태(_plSets · _plCur · _plNowSet · _plSel · _plNow · _plView · _plNowView · _plBio · _plHomePublic · _plPrivate · _plPubSig ·
     _plPlaying · _plLastBoundsKey …)는 이 모듈 안에 둔다. 모듈 안에서 수백 번 읽고 쓰므로 app.js 에 남기면 바뀌는 줄이 훨씬 많다.
     밖(계정 이어받기 복원 · 로그아웃 지우기 · 📷 스티커사진의 재생 재우기 · 화면 배율 바뀜)에서 쓰던 것은 상태 묶음 st 로 읽고 쓴다
     — st.sets = … 처럼 이름만 바뀌고 줄 모양은 그대로다(getter · setter).
   ★ 밖으로 내놓는 이름은 createPlaylist 의 반환값이다 — app.js 의 부르는 곳은 plMod.이름 으로 부른다. 전부 만드는 줄보다 늦게 돈다.
     예외 셋 — _plHasSavedPos · _plApplyPos · _plSyncBgmBounds 는 예전처럼 **window 고리**로도 건다. 상태칩 팝업 자리 계산
     (_repositionOpenChipPopups — 만드는 줄보다 위에 선언)과 noise.js(🌙 백색소음 — app.js 뒤에 실림)가 그 이름에 typeof 를 걸고 부른다.
   ★ createPlaylist 는 app.js 의 원래 자리(«🎵 상태칩 플레이리스트» 머리 아래)에서 부른다. 만들 때 예전처럼 돈다 —
     🪟 창 위치 초기화 등록 · 저장값 읽기(_plLoad) · 버튼 · ESC · 끌기 연결 · 미니미 반영 · 300ms 사각형 폴링 · BGM 신호 구독 · 음량 한 번.
     예전엔 «🐕 재생 감시견» 구역 끝(bindMyPlaylist)에서 돌았지만, 그 사이(👤 · 🏅)는 선언뿐이라 다른 일과의 순서는 같다.
   ★ 함수는 app.js 가 화살표로 넘긴다. 본문의 typeof 가드(typeof getDisplayName · typeof getFocusLevel · typeof openFriendHomeView ·
     typeof toast · typeof _myHomeLoaded …)는 예전처럼 늘 통과한다.
   ⚠️ firebaseAPI · companion · document · window · localStorage · navigator · fetch · requestAnimationFrame 은 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPlaylist — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-playlist.js — 프리셋(정규화 · 이관 · 저장 · 이름) · 목록(추가 · 삭제 · 끌기 · ▶ 마커) · 재생(▶ · ▐▐ · ■ · ⏭ · 자동 진행 ·
         반복 · 셔플 · 프리셋 갈아타기) · 파도타기 · 담기 · 비공개 · 감시견 · 상태 묶음 · window 고리 · app.js 배선 · html 순서. */
(function(){

function createPlaylist(deps){
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
const getDisplayName = deps.getDisplayName;
const asyncPrompt = deps.asyncPrompt;                // 🎵 링크 추가 · 곡 제목 묻기(window.prompt 는 Electron 에서 no-op)
// 👤 명함 — 레벨 · 🌟 회차 배지(«🏅 레벨 티어» 구역 · 포커스 기록)
const getFocusLevel = deps.getFocusLevel;
const myFocusShow = deps.myFocusShow;
const starFromRemote = deps.starFromRemote;
const lvBadgeClass = deps.lvBadgeClass;
const lvStarBadgeClass = deps.lvStarBadgeClass;
const lvStarStr = deps.lvStarStr;
const _starPaint = deps.starPaint;
// 🏠 마이홈 — app.js 의 let(다시 대입)과 구경 가기
const _myHomeLoaded = deps.myHomeLoaded;             // 읽는 함수 — 마이홈을 한 번이라도 읽었나(이 줄보다 뒤에 선언)
const _myHomeData = deps.myHomeData;                 // 읽는 함수 — 마이홈 데이터(열 때마다 다시 대입 · 이 줄보다 뒤에 선언)
const _myHomeFriends = deps.myHomeFriends;           // 읽는 함수 — 친구 목록 캐시(구독마다 다시 대입 · 이 줄보다 뒤에 선언)
const friendsRefreshPresence = deps.friendsRefreshPresence;   // (ids) → Promise — 친구 목록이 닫혀 있으면 접속 상태를 한 번 읽는다(friends-sub.js)
const openFriendHomeView = deps.openFriendHomeView;  // 🏠 공개해 둔 남의 목록 → 그 사람 마이홈 구경
// 🪟 상태칩 팝업 · 창 겹침 · ESC
const _closeChipPopups = deps.closeChipPopups;
const _repositionOpenChipPopups = deps.repositionOpenChipPopups;
const bringWinToFront = deps.bringWinToFront;
const escRegisterWindow = deps.escRegisterWindow;
const _escEditable = deps.escEditable;
const plSync = deps.playlistSync;                    // ☁️ 기기 간 맞추기 규칙(playlist-sync.js — 순수)
/* ═══ 🎵 상태칩 플레이리스트 ═════════════════════════════════════════════
   유튜브 링크를 여러 개 담아 순서대로 듣는 목록 + 🌊 남의 목록으로 파도타기 + 재생.

   ── 재생 설계 (HANDOFF '🎵 다음 세션'의 🔴 결정 두 개를 이렇게 정했다) ──
   (1) **창은 마이홈 BGM과 하나를 공유하고, 나중에 튼 쪽이 이긴다.**
       창을 둘로 만들면 소리가 겹쳐 나온다. main.js 에 bgmMode('home'|'playlist')를 두고,
       플레이리스트 모드에서는 마이홈 좌표(bgmRenderRect)를 무시하고 화면 우하단에 작은
       독립 창으로 띄운다 — 마이홈 없이 틀어도 화면을 덮지 않는다. 소유권이 넘어가면 main이
       companion.onBgmMode 로 알려주고 진 쪽이 자기 재생표시를 내린다.
   (2) **곡 종료는 주입 스크립트가 알려준다** — main.js bgmForcePlay 가 플레이리스트 모드에서는
       loop을 걸지 않고 console.log('TWPL:ended')를 찍고, main이 그걸 renderer로 넘긴다.
       임베드 IFrame API를 안 쓴 이유: 이 앱이 watch 페이지를 쓰는 건 임베드가 Error 153으로
       거부됐기 때문이고, 되돌리면 그 위험을 다시 진다. 반대로 <video> 요소 하나를 보는 이
       주입 방식은 광고 음소거·강제재생으로 앱 전체가 이미 의존하고 있다.
       재생할 수 없는 영상(비공개·삭제·지역차단)은 'err'로 와서 다음 곡으로 넘어간다.

   저장: 내 목록의 원본은 로컬(tw.playlist)이다. 파도타기 때문에 서버에도 사본을 올리지만
   (users/{uid}/playlist + playlistIndex/{uid}), 읽기 기준은 항상 로컬 — 서버가 안 되도 목록은 멀쩡하다.
   ⚠️ users/$userId 는 하위 키를 열거하는 방식이라 **없는 키는 조용히 거부**된다.
      firebase-database-rules.json 에 users/$userId/playlist 와 playlistIndex 를 이미 추가해 뒀다.
      audit 검사 7은 최상위 경로만 보므로 users 하위 누락은 잡아주지 않는다(1-7). */
const PL_MAX = 20;          // 목록 상한. **프리셋당** 20곡이다(총 60) — 로컬 저장이라 비용은 0 이고,
                            //   패널 높이(148px)와 맞춰둔 값이라 한 프리셋을 기준으로 두는 것이 맞다.
/* ═══ 🎵 프리셋 세 벌 ══════════════════════════════════════════════════
   목록이 하나(옛 _plList)에서 셋이 됐다. 저장 모양은 [{name, items}, …3] 하나다.

   ★ **상태가 둘인 것이 이 구조의 전부다**(요청 ④ "프리셋을 바꿔도 지금 곡은 계속 나온다"):
       _plCur    — 지금 **보고 있는** 프리셋. 목록·＋·Delete·선택·드래그·이름이 여기에 작용한다.
       _plNowSet — 지금 **재생 중인** 프리셋. 다음 곡은 여기서 뽑는다.
     둘을 하나로 묶으면 프리셋을 바꾼 순간 "지금 나오는 곡의 다음"이 다른 목록의 같은 번호가 되어
     엉뚱한 곡으로 넘어간다. 갈아타는 자리는 **딱 하나 — 곡이 끝나 다음 곡을 뽑을 때**(_plSkipNext)다.
     사람이 곡을 직접 고르면(_plPlayFrom) 그 자리에서 바로 갈아탄다 — ④는 자동 진행의 규칙이다.

   ★ 읽는 창구는 함수 셋뿐이다 — 배열을 변수로 들고 다니면 그게 어느 프리셋의 것인지 잃는다
     (옛 _plList 가 그래서 없어졌다. 같은 값을 읽는 곳이 여럿이면 함수로 묶는다):
       _plMine()     — 내가 고치는 목록 (= _plSets[_plCur].items)
       _plItems()    — 화면에 그리는 목록 (파도타기 중이면 남의 것)
       _plNowItems() — 다음 곡을 뽑는 목록 (= 재생 중 프리셋의 것)
   ⚠️ 프리셋을 바꾸면 _plSel 은 **-1 로 초기화**한다. 남겨두면 8곡짜리에서 12번을 고른 상태가 된다. */
const PL_SETS = 3;
let _plSets = _plBlankSets();   // [{name, items}, …3] — 이 배열이 내 목록의 유일한 원본이다
let _plCur    = 0;          // 보고 있는 프리셋 0~2
let _plNowSet = 0;          // 재생 중인 프리셋 0~2 (_plCur 과 다를 수 있다 — 그게 이 기능의 요지)
let _plSel  = -1;           // 선택된 행. Delete·[▶]·📥 가 이 행에 작용한다
let _plNow  = -1;           // 지금 재생 중인 행 (-1이면 정지). 번호의 기준은 **_plNowSet 의 목록**이다
/* 🔁 반복 버튼 — 축이 둘이다.
     좌클릭 : 켬 / 끔
     우클릭 : 종류 바꾸기 (목록 반복 → 한 곡 반복 → 셔플 → 목록 반복 …)
   ★ 한 버튼으로 네 상태를 돌리면 원하는 데까지 가려고 세 번 눌러야 하고, 지나치면 한 바퀴를
     더 돌아야 한다. 자주 하는 일(껐다 켰다)과 가끔 하는 일(종류 고르기)을 나눠 둔다.
   ⚠️ 끈 상태에서 우클릭하면 종류만 바뀌고 켜지지는 않는다 — 우클릭이 재생 동작을 시작하면
     "메뉴 열려다 음악이 바뀌는" 꼴이 된다. 켜는 것은 언제나 좌클릭 하나다. */
const PL_KIND_LOOP = 0, PL_KIND_ONE = 1, PL_KIND_SHUF = 2;
let _plOn   = false;      // 반복 켬/끔
let _plKind = PL_KIND_LOOP;
let _plVol  = 80;         // 0~100. 실제 적용은 BGM 자식창의 <video>.volume (companion.setBgmVolume)
let _plShufBag = [];      // 셔플용 — 한 바퀴 다 돌기 전에는 같은 곡을 다시 안 뽑는다
/* 모드별 아이콘 — 이모지가 아니라 SVG다. 이모지는 OS 폰트마다 모양·색이 달라 테마와 따로 논다.
   currentColor라 눌림/선택 상태를 그대로 따라간다(기존 🔁 버튼과 같은 관례). */
const _PL_SVG_LOOP = '<svg class="plIco" viewBox="1.6 1.6 12.8 12.8" aria-hidden="true"><path d="M3 7.2A3.2 3.2 0 0 1 6.2 4h5.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9.6 2.2 11.9 4 9.6 5.8Z" fill="currentColor"/><path d="M13 8.8A3.2 3.2 0 0 1 9.8 12H4.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.4 14.2 4.1 12.4 6.4 10.6Z" fill="currentColor"/></svg>';
// 한 곡 반복 = 같은 고리 안에 1. 셔플과 한눈에 갈리는 것이 이 숫자다.
const _PL_SVG_ONE  = '<svg class="plIco" viewBox="1.6 1.6 12.8 12.8" aria-hidden="true"><path d="M3 7.2A3.2 3.2 0 0 1 6.2 4h5.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9.6 2.2 11.9 4 9.6 5.8Z" fill="currentColor"/><path d="M13 8.8A3.2 3.2 0 0 1 9.8 12H4.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.4 14.2 4.1 12.4 6.4 10.6Z" fill="currentColor"/><path d="M7.1 6.6 8.4 5.9h.9v4.3H8.1V7.2l-.7.35Z" fill="currentColor"/></svg>';
const _PL_SVG_SHUF = '<svg class="plIco" viewBox="1.6 1.6 12.8 12.8" aria-hidden="true"><path d="M2.4 4.2h2.3c1 0 1.6.5 2.3 1.4l2.1 3c.6.9 1.2 1.4 2.2 1.4h1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2.4 11h2.3c1 0 1.6-.5 2.3-1.4l2.1-3c.6-.9 1.2-1.4 2.2-1.4h1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11.6 3.1 13.9 4.9 11.6 6.7Z" fill="currentColor"/><path d="M11.6 8.5 13.9 10.3 11.6 12.1Z" fill="currentColor"/></svg>';
// 종류별 아이콘. 끈 상태에서도 지금 고른 종류를 그대로 보여준다 — 좌클릭으로 켜면 뭐가 될지 미리 안다.
const PL_KIND_ICON  = [_PL_SVG_LOOP, _PL_SVG_ONE, _PL_SVG_SHUF];
/* 📥 담기 — 곡 행 안에 들어가는 아이콘. 이모지(📥)를 쓰지 않는 이유는 다른 버튼과 같다:
   OS 폰트마다 색(금색)과 굵기가 달라 목록 안에서 저 혼자 튄다. currentColor 라 고른 행의
   흰 글자색을 그대로 물려받는다. */
const PL_SVG_GRAB = '<svg class="plIco" viewBox="1.6 1.6 12.8 12.8" aria-hidden="true"><path d="M8 3.4v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 6.2 8 8.7l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.7 9.9v2.3h8.6V9.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PL_KIND_LABEL = ['목록 반복', '한 곡 반복', '셔플'];
/* 🌊 파도타기로 보고 있는 남의 목록 — null이면 내 목록. {uid, name, items:[{id,title}]}
   남의 목록은 **읽기 전용**이다: 드래그·삭제·추가가 전부 막히고 듣기만 된다. */
let _plView = null;
/* 👤 목록 주인의 명함 — {name, level, avatar}. 내 것과 파도타기로 보고 있는 사람 것 두 벌.
   내 명함은 마이홈을 한 번도 안 열어본 세션에서도 필요하므로(_myHomeData 가 아직 빈 초기값이다)
   창을 처음 열 때 서버에서 한 번만 읽어 채운다. 마이홈이 로드된 뒤에는 그쪽 값이 최신이라 우선한다. */
let _plMyCard = null;
let _plViewCard = null;
let _plCardTried = false;   // 내 명함 읽기를 이미 시도했는가 — 실패해도 창을 열 때마다 다시 읽지 않는다
/* ✍️ bio 한마디 — 140자. 마이홈 소개글(users/{uid}/home/bio)과는 **별개의 값**이다.
   같은 값으로 묶으면 한쪽을 고칠 때 다른 쪽이 같이 바뀌어서, 플레이리스트에만 걸어두고 싶은
   한마디를 쓸 수가 없다. 저장은 로컬이 원본이고 서버(users/{uid}/playlist)에는 사본이 올라간다. */
const PL_BIO_MAX = 140;
let _plBio = '';
/* 🏠 마이홈 공개 — 켜면 이 목록을 본 사람이 프로필 사진을 눌러 내 마이홈에 들어올 수 있다.
   ⚠️ 기본은 반드시 꺼짐(비공개)다. 켜는 것은 언제나 본인의 명시적인 클릭이어야 한다 —
     저장값이 없을 때 켜짐으로 떨어지면 업데이트 한 번에 전원의 홈이 열린다. */
let _plHomePublic = false;
/* 🔒 플리 비공개 — 켜면 **무작위 파도타기**에 내 목록이 안 걸린다.
   ★ 막는 방법은 색인(playlistIndex)에서 빼는 것 하나뿐이다. 곡 목록(users/{uid}/playlist)은
     그대로 올린다 — 그래야 친구 지목 파도타기([파도타기] 우클릭)는 계속 들린다.
     모르는 사람에게는 안 열고 친구에게는 여는 것이 이 설정의 뜻이다.
   ⚠️ 노드의 곡 목록을 비워서 막으려 하지 말 것. 두 경로가 그 목록을 함께 보므로
     친구 지목까지 같이 막힌다.
   ★ 내가 남의 목록을 파도타는 것은 이 값과 무관하다 — 한쪽만 닫는 것이 허용된다(요청).
   ★ 로컬 목록(프리셋)은 손대지 않는다 — 내 화면·재생은 평소와 완전히 같다.
   ⚠️ 기본은 반드시 꺼짐(공개)이다. 저장값이 없을 때 켜짐으로 떨어지면 업데이트 한 번에
     전원이 무작위 파도타기에서 사라진다(마이홈 공개 체크박스와 같은 이유). */
let _plPrivate = false;
/* 🔽 미니미(최소화) — 폭은 그대로, 높이만 접힌 상태. 창을 닫았다 열어도 유지한다. */
let _plMini = false;
let _plPubTimer = null;
let _plPubSig = null;     // 마지막으로 서버에 올린 목록의 지문 — 같으면 쓰기를 건너뛴다
/* ☁️ 기기 간 맞추기(playlist-sync.js) — 목록 · 한마디 · 공개가 마지막으로 바뀐 시각(이 기기)과 그때의 지문.
   ⚠️ 부팅 때 서버 사본과 맞추기 전(_plSynced=false)에는 서버에 올리지 않는다 — 다른 기기의 옛 목록이 메인 기기 목록을 덮던 길. */
let _plEditTs = 0;
let _plSavedSig = null;
let _plSynced = false;
let _plPlaying = false;   // 지금 소리가 나는 중인지 (일시정지면 false, _plNow 는 그대로 유지)
let _plErrStreak = 0;     // 연속 재생실패 수 — 전부 못 트는 목록에서 무한히 다음 곡으로 넘어가는 것 방지
/* 유저가 타이틀바로 옮겨둔 창 위치. null이면 상태칩 옆(캐스케이드)에 붙는다.
   창을 닫아도 기억하려고 로컬에 남긴다 — 목록과 같은 판단(비용 0, 규칙 변경 없음). */
const PL_POS_KEY = 'tw.playlistPos';
let _plPos = null;

/* 유튜브 videoId 파서 — 마이홈 BGM의 _ytId 가 이걸 위임해 쓴다(파서는 한 벌만 유지).
   youtu.be / v= / embed / shorts 커버. */
function _ytVideoId(url){
  const m = String(url||'').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
/* 유튜브 제목 자동 조회 — oEmbed. API 키도 인증도 없고 응답이 CORS 허용이라 renderer에서 바로 된다.
   실패하는 경우가 실제로 있다(오프라인 · 비공개/삭제된 영상 · 임베드 금지). 그래서 null을 돌려주고
   호출부가 제목을 직접 묻는 길로 빠진다 — 조회 실패가 '추가 실패'가 되면 안 된다. */
async function _ytFetchTitle(vid){
  try{
    const u = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid);
    const r = await fetch(u);
    if(!r.ok) return null;
    const j = await r.json();
    return (j && j.title) ? String(j.title).trim().slice(0, 60) : null;
  }catch(_){ return null; }
}

/* 빈 프리셋 세 벌 — 이름은 빈 문자열("안 정했다")이고 목록은 빈 배열이다.
   ⚠️ 선언(let _plSets)보다 위에서 불린다 — function 선언이라 호이스팅되므로 괜찮다. */
function _plBlankSets(){
  const a = [];
  for(let i = 0; i < PL_SETS; i++) a.push({ name:'', items:[] });
  return a;
}
/* 프리셋 번호 보정 — 저장값이 깨졌거나(문자열·null) 범위를 벗어나면 0 으로 떨어진다. */
function _plSetIdx(i){
  const n = parseInt(i, 10);
  return (isFinite(n) && n >= 0 && n < PL_SETS) ? n : 0;
}
/* 내가 고치는 목록 — ＋·Delete·드래그·📥 가 전부 이 배열에 작용한다.
   ⚠️ **배열을 복사해 돌려주지 않는다.** 호출부가 splice·push 로 그 자리를 고치기 때문이다. */
function _plMine(){ const s = _plSets[_plCur]; return (s && s.items) || []; }
function _plItems(){ return _plView ? _plView.items : _plMine(); }
/* 🌊 지금 **소리가 나고 있는** 남의 목록 — {uid, name, items}. null 이면 내 프리셋(_plNowSet)에서 난다.
   [왜 따로 두나] 예전에는 「보고 있는 목록 = 재생 목록」이라, 파도를 타는 순간 재생 위치(_plNow)를
     버리고 곡이 끊겼다. 보는 것과 트는 것을 가르면 프리셋에서 이미 쓰던 규칙(_plNowSet vs _plCur)이
     파도타기에도 그대로 적용된다 — **곡은 다른 목록을 틀기 전까지 계속 이어진다.**
   ⚠️ items 는 그 순간의 사본이다. 그 사람이 목록을 고쳐도 듣던 곡줄은 안 바뀐다(듣는 중에 바뀌면 위험). */
let _plNowView = null;
/* 다음 곡을 뽑는 목록 — 보고 있는 것이 아니라 **재생 중인 출처**의 것이다(④). */
function _plNowItems(){
  if(_plNowView) return _plNowView.items || [];
  const s = _plSets[_plNowSet];
  return (s && s.items) || [];
}
/* 재생 중인 목록을 지금 화면에서 보고 있는가 — ▶ 마커와 행 번호 보정의 조건이다.
   아니면 ▶ 가 엉뚱한 목록의 같은 번호 행에 찍힌다. 보는 쪽·트는 쪽 **둘 다** 봐야 한다. */
function _plNowHere(){
  if(_plNowView) return !!_plView && _plView.uid === _plNowView.uid;
  return !_plView && _plNowSet === _plCur;
}
/* 🌊 파도타기 제목 — 남의 «어느 프리셋»을 보고 있는지까지 말한다(요청: A안, 창 제목).
   ★ 이름이 있을 때만 붙인다. 이름을 안 정한 프리셋은 내 화면에서는 «프리셋 2»로 부르지만,
     남에게 그 번호는 아무 뜻이 없다 — 그때는 예전 문구를 그대로 쓴다.
   ⚠️ 제목줄은 **창을 잡고 옮기는 손잡이**다. 길어질수록 잡을 곳이 준다. 그래서 「」로 묶어
     «의 플레이리스트 · 이름» 보다 짧게 간다. 미니미(236px)는 이름만 남기므로 여기 안 온다. */
function _plViewTitle(v){
  const nm = v && v.setName ? String(v.setName) : '';
  return nm ? ('🎵 [' + v.name + ']의 「' + nm + '」')
            : ('🎵 [' + v.name + ']의 플레이리스트');
}
/* 자식창 제목 — **트고 있는** 목록의 이름이다(보고 있는 것이 아니다).
   파도타기로 넘어가도 창 제목은 지금 나오는 곡의 주인을 그대로 말한다. */
function _plNowTitle(){
  if(_plNowView) return _plMini ? _plNowView.name : _plViewTitle(_plNowView);
  const nm = _plSetName(_plNowSet);
  if(_plMini) return nm || getDisplayName();
  if(nm) return '🎵 ' + nm;
  return _plNowSet === 0 ? '🎵 플레이리스트' : ('🎵 ' + _plSetLabel(_plNowSet));
}
function _plReadOnly(){ return !!_plView; }
/* 패널 타이틀바 문구 — 재생 창(companion.openBgm)의 제목에도 같은 걸 쓴다. */
/* ✏️ 프리셋 이름 — 제목줄에서 바로 고친다(요청 ①). 값은 **보고 있는 프리셋**의 것이다.
   ★ 읽는 곳(_plSetName)과 쓰는 곳(bindPlTitle 의 end) 각각 한 곳뿐이라 프리셋으로 넘어오는 데
     이 두 줄만 바뀌었다 — 앞 세션이 그렇게 만들어 뒀다.
   ⚠️ 로컬 전용이다. 서버(publishMyPlaylist)는 아직 이 이름을 올리지 않으므로 남이 보는 창의
     제목은 예전처럼 "[아무개]의 플레이리스트" 다 — 올리려면 규칙·publish 를 함께 고쳐야 한다(핸드오프 3절).
   ⚠️ 빈 문자열은 "안 정했다" 는 뜻이고 그때는 기본 문구를 쓴다. 공백만 넣어 저장하면 지워진다. */
const PL_TITLE_MAX = 16;
function _plSetName(i){ const s = _plSets[i]; return (s && s.name) || ''; }
/* ✏️ 프리셋 이름을 쓰는 **유일한 곳**. 고치는 문은 [프리셋 ▼] 목록의 [수정] 하나다.
   [왜 옮겼나] 예전에는 창 제목줄(#myPlTitle)을 눌러 고쳤는데, 그 줄이 곧 **창을 잡고 옮기는
     손잡이**다. 옮기려고 잡으면 편집칸이 열리고, 고치려고 누르면 창이 따라 움직였다.
     _plHeadPointerDown 에 "제목 클릭이면 드래그 아님" 예외까지 두고 있었던 것이 그 흔적이다.
   ★ 문을 둘로 두지 않는다 — 남겨두면 규약이 두 벌이 되고 한쪽만 고쳐진다.
   ⚠️ 빈 문자열은 "안 정했다"는 뜻이고 그때는 _plSetLabel 이 자리로 부른다("프리셋 2").
     공백만 넣어 저장하면 지워진다(trim). */
function _plRenameSet(i, raw){
  const n = _plSetIdx(i);
  const v = String(raw == null ? '' : raw).trim().slice(0, PL_TITLE_MAX);
  if(v === _plSetName(n)) return false;
  _plSets[n].name = v;
  _plSave();
  return true;
}
/* 프리셋 고르기 목록에 쓸 이름 — 안 정했으면 자리로 부른다("프리셋 2"). 창 제목과 규칙이 다르다:
   제목줄은 이름이 없으면 예전 문구('🎵 플레이리스트')를 그대로 쓰고(옛 사용자에게 변화가 없다),
   여기는 셋을 **구별**해야 하는 자리라 반드시 번호가 보여야 한다. */
function _plSetLabel(i){ return _plSetName(i) || ('프리셋 ' + (i + 1)); }
function _plWindowTitle(){
  /* 미니미는 폭 236px 에 제목·버튼 세 개가 같이 들어가므로 "[아무개]의 플레이리스트"가 통째로 잘린다.
     접혔을 때는 이름만 남긴다 — 사진은 제목 앞(.plHeadAva)에 따로 붙는다. */
  if(_plMini) return _plView ? _plView.name : (_plSetName(_plCur) || getDisplayName());
  if(_plView) return _plViewTitle(_plView);
  /* ⚠️ 첫 프리셋만은 이름이 없을 때 옛 문구를 지킨다 — 이관된 사람의 창 제목이 업데이트 한 번에
     바뀌지 않게. 둘째·셋째는 새로 생긴 자리라 번호로 부르는 것이 오히려 필요하다. */
  if(_plSetName(_plCur)) return '🎵 ' + _plSetName(_plCur);
  return _plCur === 0 ? '🎵 플레이리스트' : ('🎵 ' + _plSetLabel(_plCur));
}

// ⚠️ try/catch — _plPos 는 let 이라 이 함수보다 아래에서 선언된다(함수 선언만 호이스팅된다).
//   부팅 도중 _repositionOpenChipPopups 가 먼저 불릴 경로가 생기면 TDZ ReferenceError 로 앱이 안 켜진다.
function _plHasSavedPos(){ try{ return !!_plPos; }catch(_){ return false; } }
/* 기억해둔 자리에 창을 놓는다 — 저장값을 그대로 쓰지 않고 **매번 화면 안으로 clamp**한다.
   모니터를 바꾸거나 해상도가 줄면 예전 좌표가 화면 밖이라 창이 아예 안 보이게 된다. */
function _plApplyPos(){
  const box = document.getElementById('myPlaylistBox');
  if(!box || !_plPos) return;
  const w = box.offsetWidth || 236, h = box.offsetHeight || 240;
  box.style.left = Math.max(8, Math.min(innerWidth  - w - 8, _plPos.x)) + 'px';
  box.style.top  = Math.max(8, Math.min(innerHeight - h - 8, _plPos.y)) + 'px';
  box.style.right = 'auto'; box.style.bottom = 'auto';
  _plSyncBgmBounds();
}
/* 재생 창이 이 패널 뒤에 정확히 숨도록 패널의 화면 사각형을 main.js에 알린다(마이홈 BGM과 같은 방식).
   재생 중이 아니거나 패널이 닫혀 있으면 null — main이 창을 투명하게 만든다.
   ⚠️ 패널은 display:none이 아니라 opacity:0으로 닫히므로 '닫힘'은 .hidden 클래스로 판정해야 한다. */
let _plLastBoundsKey = '';
/* ⚠️ 패널을 끄는 동안에는 rect 를 보내지 않는다(=창을 투명하게 둔다).
   OS 창 이동은 IPC를 거쳐 한 박자 늦게 반영돼서, 드래그 중에는 유튜브 창이 패널 뒤를 못 따라오고
   비어져 나온 채 끌려오는 게 그대로 보인다. 놓는 순간 최종 위치로 한 번에 맞춘다. */
let _plDraggingWin = false;
function _plSyncBgmBounds(){
  if(!(window.companion && companion.setPlBounds)) return;
  const box = document.getElementById('myPlaylistBox');
  let key = 'off', rect = null;
  if(_plNow >= 0 && !_plDraggingWin && box && !box.classList.contains('hidden')){
    const r = box.getBoundingClientRect();
    if(r.width && r.height){
      rect = { x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height) };
      key = rect.x + ',' + rect.y + ',' + rect.w + ',' + rect.h;
    }
  }
  if(key === _plLastBoundsKey) return;   // 안 바뀌었으면 IPC를 아끼자
  _plLastBoundsKey = key;
  companion.setPlBounds(rect);
}
/* 🪟 창 위치 초기화 버튼이 부른다(위 가챠와 같은 이유 — 메모리 값도 같이 비워야 한다). */
try{ (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _plPos = null; }); }catch(_){}
function _plSavePos(){
  try{
    if(_plPos) localStorage.setItem(PL_POS_KEY, JSON.stringify(_plPos));
    else localStorage.removeItem(PL_POS_KEY);
  }catch(_){}
}
/* 타이틀바 드래그 — 이동/놓기 리스너는 document에 단다(행 드래그와 같은 이유: 중간에 다시 그려도 안 끊긴다).
   ✕ 위에서 시작한 것은 닫기이므로 드래그로 삼지 않는다. */
function _plHeadPointerDown(e){
  if(e.button !== 0) return;
  /* 제목줄은 드래그 손잡이지만 그 위에 눌리는 것들이 얹혀 있다 — 여기서 빠져나가지 않으면
     버튼을 누르는 순간 창이 따라 움직인다.
     ⚠️ 제목줄에 무언가를 새로 올리면 이 목록에도 넣을 것(요청으로 편집 도구가 올라온 뒤 셋이 됐다). */
  if(e.target && e.target.closest && e.target.closest('.plX, .plHT')) return;
  /* ✏️ 예전에는 여기에 "제목을 누른 것이면 드래그가 아니다" 예외가 하나 더 있었다.
     이름 고치기가 [프리셋 ▼] 목록으로 옮겨가면서(요청) 그 예외도 같이 없앴다 —
     이제 제목줄은 **잡아서 옮기는 일만** 한다. 그 겹침이 이번 변경의 이유였다. */
  const box = document.getElementById('myPlaylistBox');
  if(!box) return;
  e.preventDefault();
  const r = box.getBoundingClientRect();
  const gx = e.clientX - r.left, gy = e.clientY - r.top;   // 잡은 지점을 유지해야 창이 커서로 튀지 않는다
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const onMove = ev=>{
    if(!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return;
    if(!moved){ _plDraggingWin = true; _plSyncBgmBounds(); }   // 끌기 시작 → 재생 창은 잠시 숨긴다
    moved = true;
    _plPos = { x: ev.clientX - gx, y: ev.clientY - gy };
    _plApplyPos();
  };
  const onUp = ()=>{
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if(moved) _plSavePos();
    _plDraggingWin = false;
    _plSyncBgmBounds();   // 놓은 자리로 재생 창을 한 번에 맞춘다
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}
// 타이틀바 더블클릭 = 옮긴 자리를 버리고 상태칩 옆으로 복귀
function _plResetPos(){ _plPos = null; _plSavePos(); _repositionOpenChipPopups(); }

function _plLoad(){
  try{
    const p = JSON.parse(localStorage.getItem(PL_POS_KEY) || 'null');
    if(p && isFinite(p.x) && isFinite(p.y)) _plPos = { x:Number(p.x), y:Number(p.y) };
  }catch(_){}
  try{
    /* 🎵 프리셋 세 벌 — 새 키(tw.playlistSets)가 있으면 그것을, 없으면 옛 키를 **이관**한다.
       ⚠️ 이관이 빠지면 업데이트 한 번에 모두의 목록이 사라진다. 여기가 그 자리다. */
    const arr  = JSON.parse(localStorage.getItem('tw.playlist') || '[]');
    const sets = JSON.parse(localStorage.getItem('tw.playlistSets') || 'null');
    _plSets = _plNormalizeSets(sets);
    if(!sets && Array.isArray(arr) && arr.length){
      /* 옛 목록 하나 → 프리셋 0. 이름은 앞 세션에서 만든 tw.playlistTitle 을 그대로 물려받는다.
         ⚠️ 이관도 **같은 관문(_plNormalizeSets)을 지난다.** 여기서 배열을 직접 넣으면 옛 저장에
           url 이 없던 항목이 url 없이 들어와 목록에 표시할 게 없어진다(sim-pl-presets §2 가 잡은 자리). */
      _plSets[0] = _plNormalizeSets([{
        name: localStorage.getItem('tw.playlistTitle') || '',
        items: arr,
      }])[0];
    }
    _plCur = _plSetIdx(localStorage.getItem('tw.playlistCur'));
    _plNowSet = _plCur;   // 부팅 직후엔 재생 중인 것이 없다 — 둘을 맞춰 두고 시작한다
    /* 반복 — 저장은 켬/끔과 종류 두 개다. 옛 저장에서 순서대로 이어받는다:
         tw.playlistLoopKind/On (지금)  →  tw.playlistLoopMode (네 상태 한 축)  →  tw.playlistLoop (켬/끔)
       이어받지 않으면 이미 반복을 켜둔 사람이 업데이트 뒤 조용히 꺼진 채로 쓰게 된다. */
    const _k = localStorage.getItem('tw.playlistLoopKind');
    if(_k !== null){
      _plKind = Math.max(0, Math.min(2, parseInt(_k, 10) || 0));
      _plOn = localStorage.getItem('tw.playlistLoopOn') === '1';
    } else {
      const _m = localStorage.getItem('tw.playlistLoopMode');
      if(_m !== null){
        const m = Math.max(0, Math.min(3, parseInt(_m, 10) || 0));   // 0=끔 1=목록 2=한곡 3=셔플
        _plOn = m !== 0;
        _plKind = m === 0 ? PL_KIND_LOOP : (m - 1);
      } else {
        _plOn = localStorage.getItem('tw.playlistLoop') === '1';
        _plKind = PL_KIND_LOOP;
      }
    }
    const _v = parseInt(localStorage.getItem('tw.playlistVol'), 10);
    _plVol = isFinite(_v) ? Math.max(0, Math.min(100, _v)) : 80;
    _plBio = String(localStorage.getItem('tw.playlistBio') || '').slice(0, PL_BIO_MAX);
    /* ✏️ 목록 이름은 이제 프리셋마다 하나다 — 위 프리셋 로드에서 함께 읽었다(tw.playlistTitle 은
       프리셋 0 의 이름을 되돌아갈 때를 위해 거울로만 남긴다). */
    /* ⚠️ 공개는 '1' 일 때만 켜진다. 저장값이 없거나 깨졌으면 무조건 비공개로 떨어진다. */
    _plHomePublic = localStorage.getItem('tw.playlistHomePublic') === '1';
    _plPrivate    = localStorage.getItem('tw.playlistPrivate') === '1';
    _plMini = localStorage.getItem('tw.playlistMini') === '1';
    _plEditTs = Math.max(0, Number(localStorage.getItem('tw.playlistEditTs')) || 0);
    _plDecideTs = _plEditTs;
  }catch(_){ _plSets = _plBlankSets(); _plCur = 0; _plNowSet = 0; }
  _plSavedSig = _plServerShape().sig;
}
/* 저장값을 **믿지 않고** 항상 세 벌 · 이름 16자 · 곡 20개 안으로 깎는다.
   ★ 여기가 유일한 관문이다 — 부팅 로드와 계정 이어받기가 같은 함수를 지난다. 남이 만든 노드나
     옛 판본이 남긴 모양(길이가 둘, name 이 객체, items 가 문자열…)이 그대로 앱에 들어오면
     그 뒤로 모든 인덱스 계산이 조용히 어긋난다. */
function _plNormalizeSets(raw){
  const out = _plBlankSets();
  const src = Array.isArray(raw) ? raw : [];
  for(let i = 0; i < PL_SETS; i++){
    const s = src[i];
    if(!s || typeof s !== 'object') continue;
    /* ⚠️ 문자열만 이름으로 받는다. String(값) 으로 뭉개면 깨진 노드의 객체가 "[object Object]" 라는
       이름으로 앉는다 — 사용자는 그게 왜 생겼는지 알 수 없고 지우는 길도 애매해진다. */
    out[i].name  = (typeof s.name === 'string') ? s.name.slice(0, PL_TITLE_MAX) : '';
    out[i].items = Array.isArray(s.items)
      ? s.items.filter(x => x && x.id).slice(0, PL_MAX).map(x => ({
          id: String(x.id),
          url: x.url ? String(x.url) : ('https://www.youtube.com/watch?v=' + x.id),
          title: String(x.title || '').slice(0, 60),
        }))
      : [];
  }
  return out;
}
function _plSave(){
  try{
    /* 🎵 프리셋 — 새 키가 원본이다. 옛 키(tw.playlist·tw.playlistTitle)는 **프리셋 0 의 거울**로
       계속 써 둔다: 이전 판본으로 되돌아가도 첫 프리셋이 그대로 보인다(tw.playlistLoopMode 를
       지금도 같이 쓰는 것과 같은 이유). ⚠️ 거울은 반드시 **프리셋 0** 이다 — 이관이 tw.playlist 를
       프리셋 0 으로 읽으므로, 활성 프리셋을 거울로 쓰면 되돌아갔다 다시 올 때 목록이 섞인다. */
    localStorage.setItem('tw.playlistSets', JSON.stringify(_plSets));
    localStorage.setItem('tw.playlistCur', String(_plCur));
    localStorage.setItem('tw.playlist', JSON.stringify(_plSets[0].items));
    localStorage.setItem('tw.playlistLoopOn', _plOn ? '1' : '0');
    localStorage.setItem('tw.playlistLoopKind', String(_plKind));
    // 옛 키도 같이 써 둔다 — 이전 버전으로 되돌아가도 "반복이 꺼진 채"가 되지 않는다.
    localStorage.setItem('tw.playlistLoopMode', String(_plOn ? _plKind + 1 : 0));
    localStorage.setItem('tw.playlistLoop', _plOn ? '1' : '0');
    localStorage.setItem('tw.playlistVol', String(_plVol));
    localStorage.setItem('tw.playlistBio', _plBio);
    localStorage.setItem('tw.playlistTitle', _plSets[0].name);   // 위 거울과 짝 — 프리셋 0 의 이름
    localStorage.setItem('tw.playlistHomePublic', _plHomePublic ? '1' : '0');
    localStorage.setItem('tw.playlistPrivate', _plPrivate ? '1' : '0');
    localStorage.setItem('tw.playlistMini', _plMini ? '1' : '0');
    // 목록 · 한마디 · 공개가 바뀐 저장만 «고친 시각» 을 올린다(창 위치 · 반복 · 음량은 기기 설정이라 아님)
    const sig = _plServerShape().sig;
    // 늘 바탕(받은 사본 · 앞 고침)보다 뒤 — 시계가 늦은 기기가 받은 목록 위에서 고친 것이 «더 이르다» 로 지지 않게
    if(sig !== _plSavedSig){ _plSavedSig = sig; _plEditTs = Math.max(Date.now(), _plEditTs + 1); localStorage.setItem('tw.playlistEditTs', String(_plEditTs)); }
  }catch(_){}
  _plPublish();
}
/* 서버에 올리는 모양과 그 지문 — 올리기 · 고친 시각 · 맞추기가 같은 한 벌을 본다 */
function _plServerShape(){
  const sets = _plSets.map(s => ({
    name: String((s && s.name) || '').slice(0, PL_TITLE_MAX),
    items: (((s && s.items) || [])).map(x => ({ id: x.id, title: x.title || '' })),
  }));
  const meta = { bio: _plBio, homePublic: _plHomePublic, private: _plPrivate };
  return { sets, meta, sig: _plPubSigOf(sets, meta) };
}
/* ☁️ 부팅 때 한 번 — 서버 사본과 이 기기 목록을 맞춘다(규칙은 playlist-sync.js).
   못 읽었거나 계정이 아직 없으면 늘려 가는 간격으로 다시. 재생 중이면 목록을 바꾸지 않고 기다린다(듣던 곡이 사라지지 않게). */
let _plSyncTry = 0;
let _plDecideTs = null;   // 맞추기 판단에 쓰는 이 기기 시각 — 불러온 때(또는 계정을 놓은 때) 것으로 묶는다. 맞추기 전에 고쳐도(미루는 동안 · 이어받기 직후) «이 기기가 나중» 으로 뒤집히지 않게(고친 것은 받기 전 백업에)
async function _plBootSync(){
  if(_plSynced) return;
  const again = () => { setTimeout(_plBootSync, plSync.retryDelay(_plSyncTry++)); };
  const uid = getMyUserId();
  if(!uid || !window.firebaseAPI){ again(); return; }   // 서버 연결이 아직 안 붙었다
  let srv = null;
  try{ srv = await firebaseAPI.fetchMyPlaylistSets(uid); }catch(_){}   // 던져도 «못 읽음» — 아래 retry
  if(_plSynced) return;
  const local = _plServerShape();
  const act = plSync.decide(srv, _plDecideTs !== null ? _plDecideTs : _plEditTs, plSync.countItems(local.sets) > 0);
  if(act === 'retry'){ again(); return; }
  if(act === 'adopt'){
    if(_plNow >= 0){ again(); return; }
    _plAdoptServer(srv);
    return;
  }
  if(act === 'none'){ _plSynced = true; _plDecideTs = null; _plPubSig = local.sig; return; }
  _plMarkSynced();
  _plPublish();
}
/* ☁️ 서버 사본을 이 기기에 앉힌다 — 부팅 맞추기 · 계정 연동(account.js)이 같은 한 벌을 부른다.
   ★ 받기 전에 이 기기 목록을 백업 키에 남긴다 — 규칙이 «시각 모름» 을 다 가르지는 못한다(되살릴 길).
   고친 시각은 서버 editTs(옛 앱이 쓴 노드면 0 = 모름) · 지문을 맞춰 같은 목록을 다시 올리지 않는다. */
function _plAdoptServer(srv){
  const prev = _plServerShape();
  if(plSync.countItems(prev.sets) > 0){
    try{ localStorage.setItem('tw.playlistBackup', JSON.stringify({ at: Date.now(), sets: prev.sets, bio: _plBio })); }catch(_){}
  }
  _plSets = _plNormalizeSets(srv.sets);
  _plCur = _plSetIdx(_plCur); _plNowSet = _plCur; _plSel = -1; _plNow = -1; _plView = null; _plNowView = null;
  _plBio = String(srv.bio || '').slice(0, PL_BIO_MAX);
  _plHomePublic = !!srv.homePublic;
  const shape = _plServerShape();
  _plSavedSig = shape.sig; _plPubSig = shape.sig;
  _plEditTs = Number(srv.editTs) > 0 ? Number(srv.editTs) : 0;
  try{ localStorage.setItem('tw.playlistEditTs', String(_plEditTs)); }catch(_){}
  _plSynced = true; _plDecideTs = null;
  _plSave();
  _plRender();
}
/* ☁️ «이 기기 것을 올린다» 로 맞춤을 끝냈다(부팅 맞추기 · 계정 연동).
   시각 모르는 이 기기 것이면 올리는 시각을 이 기기에도 적는다 — 다음 부팅에 같은 목록을 다시 받지 않게 */
function _plMarkSynced(){
  _plSynced = true; _plDecideTs = null;
  if(!_plEditTs){
    _plEditTs = Date.now();
    try{ localStorage.setItem('tw.playlistEditTs', String(_plEditTs)); }catch(_){}
  }
}
/* ☁️ 계정을 놓았다 · 다른 계정으로 이어받는다 — 이 기기는 «새 기기» 와 같다. 앞 계정의 고친 시각(메모리 · 저장)이 다음 계정 목록을 이기지 않게 */
function _plResetSync(){
  _plEditTs = 0; _plSynced = false; _plSyncTry = 0; _plDecideTs = 0;
  try{ localStorage.removeItem('tw.playlistEditTs'); }catch(_){}
  _plSavedSig = _plServerShape().sig;
}
/* 서버에 올린 내용의 지문 — **만드는 자리가 둘**이다(_plPublish · 계정 이어받기 복원).
   ★ 그래서 함수로 묶는다. 예전엔 두 곳이 각각 만들었고 이어받기 쪽이 meta 를 빼먹어서,
     연동 직후 늘 똑같은 목록이 한 번 더 올라갔다(헛쓰기). 한 벌이면 그 사고가 구조적으로 안 난다.
   ★ 인자는 **sets 전체**다([{name, items}, …3]). 한 벌만 넣으면 다른 프리셋만 고쳤을 때
     «안 바뀌었다»로 읽혀 서버에 안 올라간다. */
function _plPubSigOf(sets, meta){
  return JSON.stringify(sets) + '|' + JSON.stringify(meta);
}
/* 서버 사본 갱신 — 3초 debounce. 드래그 한 번에 수십 번 저장되므로 묶지 않으면 쓰기가 그만큼 나간다.
   목록이 비면 색인에서 지운다(파도타기에 빈 목록이 걸리지 않게). */
function _plPublish(){
  if(!_plSynced) return;   // 서버 사본과 맞추기 전 — 맞춘 뒤 _plBootSync 가 올린다
  if(_plPubTimer) clearTimeout(_plPubTimer);
  _plPubTimer = setTimeout(async ()=>{
    _plPubTimer = null;
    try{
      if(typeof firebaseAPI === 'undefined' || !firebaseAPI.publishMyPlaylist) return;
      /* 올라가는 것은 프리셋 세 벌 전부 · 한마디 · 공개 · 비공개(지문도 같은 한 벌 — 하나라도 빠지면 그것만 바꿨을 때 안 올라간다).
         ts 는 이 기기에서 고친 시각 — 다른 기기가 부팅 때 «어느 쪽이 나중인가» 를 이것으로 가른다(playlist-sync.js). */
      const { sets, meta, sig } = _plServerShape();
      const total = sets.reduce((n, s) => n + s.items.length, 0);
      if(sig === _plPubSig) return;
      const uid = getMyUserId();
      if(!total){   // 세 벌이 전부 비었다 — 한 벌만 비어도 지우면 나머지가 사라진다
        if(await firebaseAPI.removeMyPlaylist(uid, meta, _plEditTs)) _plPubSig = sig;
        return;
      }
      // 🔒 비공개여도 올리는 것은 같다 — 색인만 뺀다(곡 목록이 있어야 친구 지목 파도타기가 들린다)
      if(await firebaseAPI.publishMyPlaylist(uid, getDisplayName(), sets, meta, _plEditTs)) _plPubSig = sig;
    }catch(_){}
  }, 3000);
}

/* 선택 표시만 갱신 — 전체 재생성을 하면 그 자리에 있던 행 element가 사라져서
   더블클릭(두 번째 클릭이 다른 element에 떨어짐)과 드래그가 같이 깨진다.
   📌 예전엔 여기서 🗑 버튼의 disabled 도 같이 갱신했다. 버튼이 없어지고 Delete 키가 그 일을
     맡으면서(_plDel 앞의 조건 검사가 그대로 그 역할을 한다) 이 함수는 선택 표시만 본다. */
function _plSyncSel(){
  const list = document.getElementById('myPlList');
  if(list) Array.prototype.forEach.call(list.children, (el, i)=>{ el.classList.toggle('sel', i === _plSel); });
}

/* ═══ 🎵 플레이리스트 화면 — 명함 · 목록 · 흐르는 제목 · 미니미 · 파도타기 ═══ */
/* 레벨 배지 — 친구 목록(_lvBadge)과 **같은 함수**를 쓴다.
   ★ 레벨을 모르는 상대(구버전 접속)는 배지를 아예 숨긴다 — Lv.1 로 오해되지 않게. */
function _plFillLv(el, lv, star){
  if(!el) return;
  el.textContent = '';
  if(lv == null && !star){ el.className = ''; _starPaint(el, null); return; }
  /* 🌟 회차면 'Lv' 자리에 별이 선다(★342) — 숫자는 **이번 바퀴** 레벨(star.lv). 배지 별은 흰색 고정(CSS .mh-flv .pre). */
  const n = star ? star.lv : Math.max(1, parseInt(lv, 10) || 1);
  el.className = 'mh-flv ' + (star ? lvStarBadgeClass() : lvBadgeClass(n));
  const p = document.createElement('i');
  if(star){ p.className = 'pre'; p.textContent = lvStarStr(star.cyc); }
  else { p.className = 'lvp'; p.textContent = 'Lv'; }
  el.appendChild(p);
  el.appendChild(document.createTextNode(String(n)));
  _starPaint(el, star);
}
/* 사진 칸 채우기 — 사진이 없으면 실루엣 글자로 떨어진다(칸이 비면 줄이 무너져 보인다). */
function _plFillAva(el, url){
  if(!el) return;
  el.textContent = '';
  if(url){
    const img = document.createElement('img');
    img.src = TwSafeHtml.safeUrl(url, 'image'); img.draggable = false; img.alt = '';   // 남의 명함 사진일 수 있다
    el.appendChild(img);
  }else{
    el.textContent = '👤';
  }
}
/* 내 명함(이름·레벨·사진) — 마이홈이 이미 로드됐으면 그 값이 최신이라 그쪽을 쓰고,
   아니면 서버에서 한 번만 읽는다. 실패해도 이름·레벨은 로컬에서 나오므로 사진만 비는 정도다. */
function _plMyAvatar(){
  if(_myHomeLoaded() && _myHomeData()){
    return _myHomeData().avatar || null;
  }
  return _plMyCard ? _plMyCard.avatar : null;
}
async function _plLoadMyCard(){
  if(_plCardTried) return;
  _plCardTried = true;
  if(typeof firebaseAPI === 'undefined' || !firebaseAPI.fetchPlaylistCard) return;
  try{
    const c = await firebaseAPI.fetchPlaylistCard(getMyUserId());
    if(c){ _plMyCard = c; _plRenderHead(); }
  }catch(_){}
}
function _plRenderHead(){
  const wrap = document.getElementById('myPlProfile');
  if(!wrap) return;
  const ro = _plReadOnly();
  const card = ro ? (_plViewCard || {}) : (_plMyCard || {});

  // 닉네임 — 남의 목록은 색인에 실려 온 이름이 내가 보는 이름과 같으므로 그걸 먼저 쓴다.
  const nick = ro ? (_plView.name || card.name || '(이름 없음)')
                  : getDisplayName();
  const nickEl = document.getElementById('myPlNick');
  if(nickEl){ nickEl.textContent = nick; nickEl.title = nick; }

  const lv = ro ? (card.level != null ? card.level : null)
                : getFocusLevel();
  const st = ro ? starFromRemote(card) : myFocusShow();   // 🌟 회차면 별 배지(개정 70)
  _plFillLv(document.getElementById('myPlLv'), lv, st);

  const avaUrl = ro ? (card.avatar || null) : _plMyAvatar();
  const ava = document.getElementById('myPlAva');
  _plFillAva(ava, avaUrl);
  _plFillAva(document.getElementById('myPlHeadAva'), avaUrl);
  const headAva = document.getElementById('myPlHeadAva');
  if(headAva) headAva.classList.toggle('has', !!avaUrl);

  /* 🏠 사진 클릭 = 그 사람의 마이홈 구경. 열리는 조건은 **공개를 켜 둔 남의 목록**일 때뿐이다.
     내 사진을 눌러 내 홈으로 가는 길은 만들지 않는다 — 마이홈 버튼이 이미 그 자리다. */
  const canGo = ro && !!_plView.homePublic;
  if(ava){
    ava.classList.toggle('go', canGo);
    ava.title = ro
      ? (canGo ? nick + ' 님의 마이홈 구경하기' : nick + ' 님은 마이홈을 공개하지 않았어요')
      : '내 프로필 사진';
  }

  // [마이홈 공개] 체크박스는 내 목록일 때만. 남의 창에서 남의 설정을 만질 수는 없다.
  const pubWrap = document.getElementById('myPlPubWrap');
  if(pubWrap) pubWrap.style.display = ro ? 'none' : '';
  const pub = document.getElementById('myPlPub');
  if(pub) pub.checked = _plHomePublic;

  const hint = document.getElementById('myPlHint');
  // 4번 요청: 마이홈 공개자에게 뜨던 '사진을 누르면 마이홈으로' 안내 문구 제거.
  //   ⚠️ 클릭 동작 자체는 그대로다(bindPlAvatar). 문구만 비운다 —
  //      .go 클래스로 커서·강조가 이미 붙으므로 눌러볼 수 있다는 신호는 남는다.
  if(hint) hint.textContent = '';

  // ── bio 한마디
  const view = document.getElementById('myPlBioView');
  const edit = document.getElementById('myPlBioEdit');
  const text = ro ? String(_plView.bio || '') : _plBio;
  if(view){
    view.classList.toggle('ro', ro);
    view.classList.toggle('empty', !text);
    view.title = ro ? (text || '') : '눌러서 한마디 쓰기';
    view.style.cursor = ro ? 'default' : 'text';
    const shown = text || (ro ? '' : '오늘의 bio 한마디를 적어주세요');
    /* ★ 흐르는 것은 **남의 한마디뿐**이다(요청).
       내 칸은 눌러서 고치는 자리라, 글자가 흘러가면 어디를 고치는 중인지 눈이 못 따라간다.
       그래서 내 것은 레일 구조(.mq + .mqIn)를 아예 안 만들고 글자만 넣어 … 로 자른다 —
       구조를 만들어 두고 애니메이션만 끄면, 안쪽 inline-flex 때문에 … 도 안 붙는다. */
    if(ro){
      if(!view.classList.contains('mq')){
        view.classList.add('mq'); view.textContent = '';
        const inner = document.createElement('span'); inner.className = 'mqIn';
        inner.appendChild(document.createElement('span'));
        view.appendChild(inner);
      }
      const inner = view.querySelector('.mqIn');
      const first = inner && inner.firstElementChild;
      if(first && first.textContent !== shown){
        // 흐르던 두 번째 벌은 버린다 — 문구가 바뀌면 _plSyncMarquee 가 새 폭으로 다시 붙인다
        while(inner.children.length > 1) inner.removeChild(inner.lastElementChild);
        first.textContent = shown;
        view.classList.remove('on');
      }
    }else{
      view.classList.remove('mq', 'on');
      if(view.textContent !== shown) view.textContent = shown;
    }
  }
  // 읽기 전용으로 넘어가는 순간 열려 있던 입력칸은 닫는다(남의 목록 위에 내 입력칸이 남지 않게)
  if(ro && edit && edit.style.display !== 'none') _plBioEditEnd(false);
}

/* 목록 다시 그리기 — 행은 전부 여기서 만든다(innerHTML 미사용: 곡 제목이 유저·타인 입력이라 XSS 경로가 된다). */
/* 🔗 곡 하나를 **시스템 기본 브라우저**(크롬·웨일 등)에서 열기 — 우클릭 진입점.
   목록 안 재생은 유튜브 임베드라 광고·로그인·임베드 금지 영상에서 막히는데, 그때 원본으로
   건너갈 길이 없었다. 재생 중인 곡(BGM 자식창)과는 **완전히 별개**다 — 이건 앱 밖에서 열린다.
   ⚠️ companion.openBrowser 는 main.js 에서 shell.openExternal 로 간다 = **진짜 외부 브라우저**다.
     앱 안에 뜨는 작은 창은 이것이 아니라 BGM 자식창(openBgm/openPlaylistTrack)이다. 헷갈리지 말 것.
     (preload.js 의 openBrowser 주석이 옛날 구현을 그대로 설명하고 있어 실제로 헷갈렸다 — 같이 고쳤다)
   ⚠️ 웹으로 열었을 때(companion 없음)는 새 탭 폴백. 둘 다 안 되면 주소를 복사해 준다. */
function _plOpenExternal(i){
  const items = _plItems();
  const it = items && items[i];
  if(!it || !it.id){ toast('열 수 있는 주소가 없어요'); return; }
  const url = it.url || ('https://www.youtube.com/watch?v=' + it.id);
  try{
    if(window.companion && companion.openBrowser){ companion.openBrowser(url); return; }
    if(window.open){ window.open(url, '_blank'); return; }
  }catch(_){}
  try{ navigator.clipboard.writeText(url); toast('주소를 복사했어요'); }
  catch(_){ toast('열지 못했어요'); }
}
function _plRender(){
  const list = document.getElementById('myPlList');
  if(!list) return;
  const items = _plItems();
  const ro = _plReadOnly();
  if(_plSel >= items.length) _plSel = items.length - 1;
  /* ▶ 마커의 기준 — _plNow 는 **재생 중 프리셋**의 번호다. 다른 프리셋을 보고 있는 동안 그 번호를
     그대로 쓰면 엉뚱한 행에 ▶ 가 찍힌다(같은 번호의 다른 곡). 그래서 여기서 한 번 걸러 둔다. */
  const nowRow = _plNowHere() ? _plNow : -1;
  const ttl = document.getElementById('myPlTitle');
  if(ttl){
    ttl.textContent = _plWindowTitle();
    /* ✏️ 제목줄은 이제 편집 자리가 아니다 — 잡아서 옮기는 손잡이다.
       ★ 대신 **이름을 어디서 고치는지**를 툴팁으로 알린다. 예전 손짓에 익숙한 분이
         눌러보고 아무 일도 안 일어나면 "고칠 수 없게 됐다"로 읽힌다.
       ⚠️ 툴팁 문구는 여기 한 곳에서만 정한다 — 두 곳에서 쓰면 남의 목록(파도타기)에
         내 프리셋 이야기가 남는다. */
    ttl.title = ro ? '' : '창을 옮기려면 이 줄을 잡으세요 · 이름은 [프리셋 ▼] 에서 고쳐요';
  }
  _plRenderHead();
  _plRenderNow();
  list.classList.toggle('ro', ro);
  list.textContent = '';
  if(!items.length){
    const em = document.createElement('div');
    em.className = 'plEmpty';
    em.textContent = ro ? '이 사람은 목록을 비웠어요.'
                        : '아직 비어 있어요.\n＋ 를 눌러 유튜브 링크를 넣어보세요.';
    list.appendChild(em);
  }else{
    items.forEach((it, i)=>{
      const row = document.createElement('div');
      row.className = 'plRow' + (i === _plSel ? ' sel' : '') + (i === nowRow ? ' now' : '');
      const n = document.createElement('span');
      n.className = 'n'; n.textContent = (i === nowRow) ? '▶' : String(i + 1);
      const tt = document.createElement('span');
      tt.className = 'tt';
      const _label = it.title || it.url || it.id;
      tt.title = it.title ? (it.title + '\n' + (it.url || '')) : (it.url || '');
      if(i === nowRow){
        // 🎵 재생 중인 줄만 흐르기 대상. 두 번째 벌·간격은 _plSyncMarquee가 넘칠 때만 붙인다.
        tt.classList.add('mq');
        const inner = document.createElement('span'); inner.className = 'mqIn';
        const first = document.createElement('span'); first.textContent = _label;
        inner.appendChild(first);
        tt.appendChild(inner);
      }else{
        tt.textContent = _label;
      }
      row.appendChild(n); row.appendChild(tt);
      /* 📥 담기 — 남의 목록에서만, **고른 행의 제목 오른쪽**에 뜬다(요청).
         ★ 행마다 심어두고 보이기는 CSS(.ro .plRow.sel)가 정한다 — 선택이 바뀔 때 도는 _plSyncSel 은
           일부러 클래스만 토글하기 때문이다(행을 다시 만들면 더블클릭·드래그가 깨진다).
         ⚠️ pointerdown 에서 전파를 끊는다 — 안 끊으면 행의 선택/끌기 처리가 같이 돈다. */
      if(ro){
        const g = document.createElement('button');
        g.type = 'button'; g.className = 'plRowGrab';
        g.title = '이 곡을 담을 프리셋 고르기';
        g.setAttribute('aria-label', '담기');
        g.innerHTML = PL_SVG_GRAB;
        g.addEventListener('pointerdown', e=>{ e.stopPropagation(); });
        g.addEventListener('click', e=>{
          e.stopPropagation();
          _plSel = i; _plSyncSel();   // 눌린 행을 기준으로 담는다(hover 로 먼저 눌리는 경로 방어)
          _plOpenGrabPick(g);         // 📥 어디에 담을지는 여기서 고른다(예전엔 곧장 _plCur 로 갔다)
        });
        row.appendChild(g);
      }
      row.addEventListener('dblclick', e=>{ e.stopPropagation(); _plPlayFrom(i); });
      row.addEventListener('pointerdown', e=>_plRowPointerDown(e, row, i));
      /* 🔗 우클릭 — 그 곡을 창 밖(브라우저)에서 연다. 목록 안 재생은 임베드라 광고·로그인이
         필요한 영상에서 막히는데, 그때 원본으로 건너갈 길이 없었다.
         ⚠️ preventDefault 를 해야 한다 — 안 하면 OS 기본 메뉴가 같이 뜬다. */
      row.addEventListener('contextmenu', e=>{
        e.preventDefault(); e.stopPropagation();
        _plOpenExternal(i);
      });
      /* 🗑 버튼이 없어진 자리를 여기서 알린다 — 단축키는 눈에 안 보이므로, 지울 수 있는
         목록(내 목록)의 행에만 한 줄 붙인다. 남의 목록에서는 지울 수 없으니 붙이지 않는다. */
      row.title = (row.title ? row.title + ' · ' : '') + '우클릭: 브라우저에서 열기'
                + (ro ? '' : ' · Delete: 선택한 곡 지우기');
      list.appendChild(row);
    });
  }
  const cnt = document.getElementById('myPlCount');
  if(cnt) cnt.textContent = ro ? (items.length + '곡') : (items.length + '/' + PL_MAX);
  // 남의 목록을 보는 동안에는 편집 버튼을 숨기고 [← 내 목록]을 대신 띄운다(폭이 좁아 둘 다는 안 들어간다).
  const show = (id, on)=>{ const b = document.getElementById(id); if(b) b.style.display = on ? '' : 'none'; };
  show('myPlAdd', !ro); show('myPlBack', ro);
  /* 📥 담기는 제목줄이 아니라 **곡 행 안**에 있다(요청) — 행을 만들 때 함께 심고, 어디로 담기는지는
     그 버튼의 툴팁이 말한다(프리셋 버튼이 숨는 자리를 그것이 메운다). */
  /* 🎵 프리셋 줄 — **파도타기 중에는 줄째로 숨긴다**(요청).
     ★ 그때 화면에 있는 것은 남의 목록(그쪽 프리셋 중 무작위 한 벌)이라, 내 프리셋 버튼은 아무것도
       가리키지 않는다. 예전엔 "📥 담을 곳을 고르는 자리" 로 남겨 뒀는데, 남의 목록을 보는 자리에
       내 설정이 떠 있으면 그게 저쪽 것으로 읽힌다(🔒·마이홈 공개를 숨기는 것과 같은 판단이다).
       담기는 **파도타기 전에 골라 둔 프리셋**으로 들어가고, 토스트가 그 이름을 말해 준다.
     ⚠️ ＋·프리셋·🔒 셋이 다 숨는 줄이라 빈 줄이 남는다 — 그래서 줄 자체를 숨긴다.
     ⚠️ ← 내 목록은 이 줄에 없다. 닉네임 줄 오른쪽(타이틀바 ✕ 아래)으로 옮겼다. */
  show('myPlSetBar', !ro);
  show('myPlSetBtn', !ro);
  if(ro) _plCloseSetPick();   // 파도타기로 넘어가는 순간 열려 있던 고르기 목록은 닫는다
  if(!ro) _plCloseGrabPick(); // 반대로 내 목록으로 돌아오면 담기 메뉴는 가리킬 곡이 없어진다
  /* 🎵 [프리셋 ▼] 버튼의 글자 = **지금 고른 프리셋 이름**. (파도타기 중에는 줄째 숨는다 — 위 참조) */
  const setNm = document.getElementById('myPlSetNm');
  if(setNm) setNm.textContent = _plSetLabel(_plCur);
  const setBtn = document.getElementById('myPlSetBtn');
  if(setBtn) setBtn.title = '프리셋 고르기 (' + _plMine().length + '/' + PL_MAX + ')';
  // 열려 있는 동안에는 곡 수·♪ 표시가 따라 움직여야 한다(닫혀 있으면 만들지 않는다)
  {
    const pick = _plSetPickEl();
    if(pick && pick.classList.contains('on')) _plRenderSetPick();
  }
  /* 🔒 비공개 체크 — 내 목록을 볼 때만 보인다. 남의 목록을 보는 동안 떠 있으면 '이 사람의 설정'
     으로 읽히고, 실제로는 내 설정이라 눌렀을 때 엉뚱한 곳이 바뀐 것처럼 보인다. */
  show('myPlPrivWrap', !ro);
  const privBox = document.getElementById('myPlPriv');
  if(privBox) privBox.checked = _plPrivate;
  /* 📌 🗑 는 목록에서 빠졌다 — 버튼이 없어지고 Delete 키가 그 일을 한다(_plDel 이 스스로
     읽기전용·선택범위를 검사하므로 '비활성' 이라는 상태가 필요 없다). */
  const dis = [['myPlPlay', items.length > 0],
               ['myPlStop', _plNow >= 0],
               /* ⏭ 는 ■ 와 같은 조건이다 — 넘길 '지금 곡'이 있어야 뜻이 있다.
                  (멈춘 상태에서 누르면 무엇을 기준으로 다음인지 정할 수 없다) */
               ['myPlNext', _plNow >= 0],
               ['myPlAdd', !ro && _plMine().length < PL_MAX]];
               /* 📌 📥 담기에는 '비활성' 이라는 상태가 없다 — 고른 행에만 뜨므로 뜨는 것 자체가
                  '누를 수 있다' 는 뜻이다. 꽉 참·중복은 눌렀을 때 이유를 말해준다. */
  dis.forEach(p=>{ const b = document.getElementById(p[0]); if(b) b.disabled = !p[1]; });
  const loopBtn = document.getElementById('myPlLoop');
  if(loopBtn){
    loopBtn.classList.toggle('on', _plOn);
    loopBtn.innerHTML = PL_KIND_ICON[_plKind];
    loopBtn.title = PL_KIND_LABEL[_plKind] + (_plOn ? ' · 켬' : ' · 끔')
      + '\n좌클릭 — ' + (_plOn ? '끄기' : '켜기')
      + '\n우클릭 — 종류 바꾸기 (' + PL_KIND_LABEL[(_plKind + 1) % 3] + ')';
    loopBtn.setAttribute('aria-label', '반복 ' + PL_KIND_LABEL[_plKind] + (_plOn ? ' 켬' : ' 끔'));
  }
  const volIn = document.getElementById('myPlVol');
  if(volIn && document.activeElement !== volIn){ volIn.value = String(_plVol); }
  if(volIn) volIn.title = '음량 ' + _plVol + '%';
  const playBtn = document.getElementById('myPlPlay');
  if(playBtn) playBtn.classList.toggle('playing', _plPlaying && _plNow >= 0);
  /* 🎵 곡 제목 흐르기 판정은 다음 프레임으로 미룬다 — 이 함수는 팝업이 아직 .hidden 인 상태에서도
     불리는데(열기 토글이 _plRender를 먼저 부른다), 숨어 있는 동안 폭은 0이라 지금 재면 항상
     '넘치지 않음'으로 나온다. 다음 프레임엔 .hidden 이 벗겨져 있어 실제 폭으로 잴 수 있다. */
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(_plSyncMarquee);
  else _plSyncMarquee();
}
/* 🎵 재생 중 곡 제목을 왼쪽으로 흘린다 — 길이와 무관하게 항상.
   ・흐를 거리 = 문구 한 벌 폭 + 간격. 그만큼만 밀면 뒤에 붙인 두 번째 벌이 정확히 첫 벌 자리에 와서
     루프가 이어진다(레일처럼 끝없이 도는 느낌).
   ・간격은 최소 PL_MQ_GAP 이지만, 문구가 칸보다 짧으면 **남는 폭만큼 더 벌린다.**
     안 벌리면 짧은 제목이 한 화면에 두 벌 같이 보여서 글자가 중복된 것처럼 읽힌다.
   ・속도를 px/s로 고정해 제목 길이와 무관하게 체감 속도가 같다. 시간으로 고정하면 긴 제목이 휙 지나간다.
   ・칸 폭이 0이면(팝업이 아직 숨은 상태) 아무것도 하지 않는다 — 그 값으로 간격을 계산하면 틀린다. */
const PL_MQ_SPEED = 28;   // px/s — 읽으면서 따라갈 수 있는 정도
const PL_MQ_GAP   = 24;   // 두 벌 사이 최소 간격(px)
function _plSyncMarquee(){
  /* 창 전체에서 찾는다 — 곡 제목뿐 아니라 bio 한마디(#myPlBioView)와 미니미의 현재곡 줄도
     같은 레일을 탄다. 목록 안으로 좁히면 그 둘은 넘쳐도 잘린 채 멈춰 있다. */
  const box = document.getElementById('myPlaylistBox');
  if(!box) return;
  box.querySelectorAll('.tt.mq').forEach(tt=>{
    const inner = tt.querySelector('.mqIn');
    const first = inner && inner.firstElementChild;
    if(!inner || !first) return;
    const w = first.getBoundingClientRect().width;
    const avail = tt.clientWidth;
    if(!(avail > 0) || !(w > 0)) return;   // 아직 화면에 없음 — 다음 렌더의 rAF에서 다시 잰다
    /* ★ 넘치지 않으면 흘리지 않는다.
       [제보] "창을 안 넘어가는 짧은 한마디까지 레일이 돈다."
       [원인] 여기서 넘침 여부를 아예 안 봤다. 아래 gapPx 의 `avail - w + PL_MQ_GAP` 가
         짧은 글에 '칸을 다 비울 만큼 큰 간격'을 만들어 줘서, 글자가 한 번 밀려 나갔다가
         한참 뒤 되돌아오는 모양으로 계속 돌았다. 그게 흐르는 것처럼 보인 것이다.
       ★ .on 을 떼는 것만으로는 부족하다 — 두 번째 벌(mqGap+복제)이 남아 있으면 같은 문구가
         옆에 한 번 더 붙어 보인다. 레일 구조를 첫 벌만 남기고 되돌린다.
       ⚠️ 1px 여유를 둔다. 소수점 폭에서 w 와 avail 이 미세하게 엇갈리면 매 렌더마다
         켜짐/꺼짐이 뒤집혀 글자가 떨린다. */
    if(w <= avail + 1){
      if(tt.classList.contains('on')) tt.classList.remove('on');
      while(inner.children.length > 1) inner.removeChild(inner.lastElementChild);
      inner.style.removeProperty('--pl-mq-gap');
      inner.style.removeProperty('--pl-mq-shift');
      inner.style.removeProperty('--pl-mq-dur');
      return;
    }
    if(inner.children.length < 3){
      while(inner.children.length > 1) inner.removeChild(inner.lastElementChild);
      const gap = document.createElement('span'); gap.className = 'mqGap';
      const dup = document.createElement('span'); dup.textContent = first.textContent;
      dup.setAttribute('aria-hidden', 'true');   // 같은 문구 두 벌 — 스크린리더엔 한 번만
      inner.appendChild(gap); inner.appendChild(dup);
    }
    const gapPx = Math.max(PL_MQ_GAP, avail - w + PL_MQ_GAP);
    const shift = w + gapPx;
    inner.style.setProperty('--pl-mq-gap', gapPx + 'px');
    inner.style.setProperty('--pl-mq-shift', shift + 'px');
    inner.style.setProperty('--pl-mq-dur', Math.max(4, shift / PL_MQ_SPEED).toFixed(2) + 's');
    tt.classList.add('on');
  });
}

/* ── ✍️ bio 한마디 고치기 ────────────────────────────────────────────────
   보기(span)와 쓰기(input)를 같은 자리에 겹쳐 두고 갈아낀다. 늘 input 으로 두지 않는 이유:
   input 은 넘치는 글자를 흘릴 수 없어서(가로 스크롤만 된다) 140자를 다 못 보여준다.
   ・Enter / 포커스 잃음 = 저장   ・Esc = 되돌리기
   ⚠️ 남의 목록을 보는 중에는 열리지 않는다 — 열어봤자 저장할 곳이 내 것뿐이라 헷갈린다. */
function _plBioCount(){
  const edit = document.getElementById('myPlBioEdit');
  const hint = document.getElementById('myPlHint');
  if(edit && hint) hint.textContent = (edit.value || '').length + '/' + PL_BIO_MAX;
}
function _plBioEditStart(){
  if(_plReadOnly()) return;
  const view = document.getElementById('myPlBioView'), edit = document.getElementById('myPlBioEdit');
  if(!view || !edit || edit.style.display !== 'none') return;
  edit.value = _plBio;
  view.style.display = 'none';
  edit.style.display = '';
  _plBioCount();
  edit.focus(); edit.select();
}
function _plBioEditEnd(save){
  const view = document.getElementById('myPlBioView'), edit = document.getElementById('myPlBioEdit');
  if(!view || !edit || edit.style.display === 'none') return;
  if(save){
    const next = String(edit.value || '').replace(/\s+/g, ' ').trim().slice(0, PL_BIO_MAX);
    if(next !== _plBio){ _plBio = next; _plSave(); }   // _plSave 가 서버 사본까지 3초 debounce 로 올린다
  }
  edit.style.display = 'none';
  view.style.display = '';
  const hint = document.getElementById('myPlHint');
  if(hint) hint.textContent = '';
  _plRenderHead();
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(_plSyncMarquee);
}

/* ── 🔽 미니미(최소화) ───────────────────────────────────────────────────
   목록·소개칸·편집툴바를 접고 현재곡 한 줄 + 재생 조작만 남긴다.
   ⚠️ 접히는 동안에는 재생 창을 숨겼다가(=_plDraggingWin 과 같은 수법) 다 접힌 뒤에 한 번에 맞춘다.
     OS 창 이동은 IPC를 거쳐 한 박자 늦게 반영돼서, 줄어드는 도중에는 유튜브 창이 패널보다 커서
     아래로 삐져나온 채로 보인다. 창 크기가 실제로 바뀐 뒤 재는 것이라 rAF 한 번으로는 모자라
     transition 이 없는 지금 구조에서도 다음 프레임까지 기다린다. */
function _plApplyMini(){
  const box = document.getElementById('myPlaylistBox');
  if(!box) return;
  box.classList.toggle('mini', _plMini);
  const btn = document.getElementById('myPlMin');
  if(btn){
    btn.textContent = _plMini ? '□' : '－';
    btn.title = _plMini ? '원래 크기로' : '최소화';
  }
  const ttl = document.getElementById('myPlTitle');
  if(ttl) ttl.textContent = _plWindowTitle();
  _plRenderNow();
  /* 접히면서 창이 화면 아래로 넘칠 수 있다 — 기억해둔 자리로 다시 clamp 한다.
     (옮겨둔 자리가 없으면 상태칩 옆 캐스케이드가 알아서 다시 잡는다) */
  if(_plHasSavedPos()) _plApplyPos();
  _plDraggingWin = true; _plSyncBgmBounds();
  const settle = ()=>{ _plDraggingWin = false; _plSyncBgmBounds(); };
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>requestAnimationFrame(settle));
  else settle();
}
function _plToggleMini(){
  _plMini = !_plMini;
  _plApplyMini();
  _plSave();
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(_plSyncMarquee);
}
/* 미니미의 현재곡 한 줄. 정지 중이면 무엇을 눌러야 하는지 알려준다 — 빈 줄로 두면 고장으로 보인다. */
function _plRenderNow(){
  const box = document.getElementById('myPlNow');
  if(!box) return;
  /* ⚠️ 보고 있는 목록이 아니라 **재생 중 프리셋**의 목록에서 읽는다 — 프리셋을 바꿔 두고 접으면
     예전 식(_plItems)은 다른 목록의 같은 번호, 즉 안 나오는 곡의 제목을 보여준다. */
  const items = _plNowItems();
  const it = (_plNow >= 0) ? items[_plNow] : null;
  const label = it ? (it.title || it.url || it.id) : '멈춤 — ▶ 를 누르면 이어서 나와요';
  box.classList.toggle('idle', !it);
  const tt = box.querySelector('.tt');
  const inner = tt && tt.querySelector('.mqIn');
  const first = inner && inner.firstElementChild;
  if(!first) return;
  if(first.textContent !== label){
    while(inner.children.length > 1) inner.removeChild(inner.lastElementChild);
    first.textContent = label;
    tt.classList.remove('on');
  }
  box.title = it ? label : '';
}

/* ── 눌러서 끌어 순서 바꾸기 ────────────────────────────────────────────
   ⚠️ 이동/놓기 리스너는 **document**에 단다. 순서가 바뀔 때마다 _plRender()가 행을 새로 만들어서,
      행 element에 달아두면 첫 이동에서 리스너째 사라져 드래그가 끊긴다(setPointerCapture도 같이 무효). */
function _plRowPointerDown(e, row, i){
  if(e.button !== 0) return;
  /* 🌊 남의 목록 — 순서는 못 바꾸지만 **고르기는 된다.** 담기 버튼이 고른 행에 뜨는 구조이므로
     여기서 고를 수 없으면 담을 방법이 더블클릭(=재생)뿐이 된다. 예전엔 실제로 그랬다. */
  if(_plReadOnly()){ e.preventDefault(); _plSel = i; _plSyncSel(); return; }
  e.preventDefault();
  _plSel = i; _plSyncSel();
  const h = row.offsetHeight || 21;
  const y0 = e.clientY;
  const mine = _plMine();
  let cur = i, moved = false;
  const onMove = ev=>{
    if(!moved && Math.abs(ev.clientY - y0) > 3) moved = true;
    if(!moved) return;
    let t = i + Math.round((ev.clientY - y0) / h);
    if(t < 0) t = 0;
    if(t > mine.length - 1) t = mine.length - 1;
    if(t === cur) return;
    const it = mine.splice(cur, 1)[0];
    mine.splice(t, 0, it);
    /* 재생 중 표시도 같이 밀린다 — 안 밀면 ▶ 마커가 엉뚱한 곡에 남는다.
       ⚠️ **같은 프리셋을 보고 있을 때만** 이다. 다른 프리셋을 정리하는 중이면 _plNow 는 이 목록의
         번호가 아니므로 손대면 재생 중인 곡의 번호를 망친다. */
    if(_plNowHere()){
      if(_plNow === cur) _plNow = t;
      else if(_plNow > cur && _plNow <= t) _plNow -= 1;
      else if(_plNow < cur && _plNow >= t) _plNow += 1;
    }
    cur = t; _plSel = t;
    _plRender();
  };
  const onUp = ()=>{
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if(moved) _plSave();
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

async function _plAdd(){
  if(_plReadOnly()) return;
  /* ⚠️ 상한은 **프리셋당** 20곡이다 — 셋을 합쳐 60. 넣는 곳은 지금 보고 있는 프리셋이다. */
  const mine = _plMine();
  if(mine.length >= PL_MAX){ toast(_plSetLabel(_plCur) + ' 은 ' + PL_MAX + '곡까지예요'); return; }
  // window.prompt 는 Electron에서 no-op — 마이홈 BGM 등록과 같은 asyncPrompt 를 쓴다.
  const url = await asyncPrompt({ title:'🎵 링크 추가', message:'유튜브 링크를 붙여넣으세요', placeholder:'https://youtu.be/…' });
  if(url === null) return;
  const vid = _ytVideoId(url);
  if(!vid){ toast('유튜브 링크를 인식하지 못했어요'); return; }
  if(mine.some(x => x.id === vid)){ toast('이미 이 프리셋에 있어요'); return; }
  let title = await _ytFetchTitle(vid);
  if(!title){
    // 자동 조회가 안 될 때만 직접 묻는다. 여기서 취소해도 추가는 진행 — 제목 없이 링크가 보인다.
    const typed = await asyncPrompt({ title:'곡 제목', message:'제목을 자동으로 못 가져왔어요. 직접 적어주세요 (비우면 링크가 보여요)', maxLength:60 });
    title = String(typed || '').trim().slice(0, 60);
  }
  mine.push({ id:vid, url:String(url).trim(), title });
  _plSel = mine.length - 1;
  _plSave(); _plRender();
}
function _plDel(){
  const mine = _plMine();
  if(_plReadOnly() || _plSel < 0 || _plSel >= mine.length) return;
  // confirm() 은 쓰지 않는다 — Electron에서 포커스가 멈추는 함정이 있고(audit 검사 4)
  //   한 줄 삭제는 되돌리기 비용이 낮다.
  mine.splice(_plSel, 1);
  /* ⚠️ 재생 중 번호 보정은 **같은 프리셋일 때만** 유효하다. 다른 프리셋을 보며 지우는 중이면
     _plNow 는 이 목록의 번호가 아니다 — 손대면 나오고 있는 곡의 표시가 어긋난다. */
  if(_plNowHere()){
    if(_plNow === _plSel) _plNow = -1; else if(_plNow > _plSel) _plNow -= 1;
  }
  if(_plSel >= mine.length) _plSel = mine.length - 1;
  _plSave(); _plRender();
}
/* 🌊 파도타기 — 최근 갱신 60명 중 나를 뺀 무작위 1명. 연달아 누르면 방금 본 사람은 제외한다. */
async function _plPeek(){
  if(typeof firebaseAPI === 'undefined' || !firebaseAPI.fetchRandomPlaylist){
    toast('파도타기는 인터넷 연결이 필요해요'); return;
  }
  const btn = document.getElementById('myPlPeek');
  if(btn) btn.disabled = true;
  try{
    const r = await firebaseAPI.fetchRandomPlaylist(getMyUserId(), _plView ? _plView.uid : null);
    if(!r){ toast('아직 파도탈 목록이 없어요'); return; }
    /* 🎵 재생 위치(_plNow)는 **건드리지 않는다** — 듣던 곡은 계속 난다.
       고르기(_plSel)만 초기화한다. 새 목록의 몇 번째를 고르고 있었는지는 뜻이 없다. */
    _plView = r; _plSel = -1;
    _plLoadViewCard(r.uid);
    _plRender();
  }finally{ if(btn) btn.disabled = false; }
}
/* 👤 건너간 사람의 명함(사진·레벨)을 뒤늦게 채운다.
   ★ 목록은 기다리지 않는다 — 사진 때문에 곡이 늦게 뜨면 파도타기가 굼떠 보인다.
     명함이 도착하면 그때 소개칸만 다시 그린다. 도중에 또 파도를 탔으면 조용히 버린다. */
function _plLoadViewCard(uid){
  _plViewCard = null;
  if(typeof firebaseAPI === 'undefined' || !firebaseAPI.fetchPlaylistCard) return;
  Promise.resolve(firebaseAPI.fetchPlaylistCard(uid)).then(c=>{
    if(!c || !_plView || _plView.uid !== uid) return;
    _plViewCard = c;
    _plRenderHead();
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(_plSyncMarquee);
  }).catch(()=>{});
}
/* ← 내 목록 — 보기만 되돌린다. 남의 곡을 틀던 중이면 **그 곡은 계속 난다**(_plNowView 유지). */
function _plBack(){ _plView = null; _plViewCard = null; _plSel = -1; _plRender(); }

/* 🌊 친구 파도타기 — [파도타기] 우클릭으로 열리는 친구 목록. 거기서 고른 사람의 목록으로 건너간다.
   ★ 좌클릭(무작위)은 그대로 둔다 — 기본 동작을 바꾸면 지금 쓰던 사람의 흐름이 끊긴다.
   ★ 도착점은 무작위 파도타기와 완전히 같다(_plView 를 채우고 _plRender). 다른 건 "누구를" 고르는가뿐이라
     📥 담기 · ← 내 목록 · 재생이 전부 그대로 동작한다. */
function _plFriendPickEl(){ return document.getElementById('myPlFriendPick'); }
function _plCloseFriendPick(){ const el=_plFriendPickEl(); if(el) el.classList.remove('on'); }
function _plToggleFriendPick(){
  const el=_plFriendPickEl(); if(!el) return;
  if(el.classList.contains('on')){ el.classList.remove('on'); return; }
  _plRenderFriendPick();
  el.classList.add('on');
  /* 온라인 점 · 순서 — 친구 목록이 닫혀 있으면 접속 상태를 안 듣고 있다. 열 때 한 번 읽고, 그때도 열려 있으면 다시 그린다. */
  Promise.resolve(friendsRefreshPresence(Object.keys(_myHomeFriends() || {})))
    .then(()=>{ if(el.classList.contains('on')) _plRenderFriendPick(); }, ()=>{});
}
function _plRenderFriendPick(){
  const el=_plFriendPickEl(); if(!el) return;
  el.innerHTML='';
  /* 친구 목록은 마이홈이 부팅 때 구독해둔 캐시(_myHomeFriends)를 그대로 쓴다 —
     여기서 따로 읽으면 같은 데이터를 두 번 나르게 된다. */
  const src = _myHomeFriends() || {};
  const ids = Object.keys(src);
  if(!ids.length){
    const d=document.createElement('div'); d.className='pfEmpty';
    d.textContent='아직 친구가 없어요.\n마이홈 › 친구에서 추가하면\n그 친구의 목록을 파도탈 수 있어요.';
    el.appendChild(d); return;
  }
  // 온라인 먼저, 그 안에서 이름순 — 친구 탭 목록과 같은 순서라 눈이 헤매지 않는다
  ids.sort((a,b)=>{
    const A=src[a]||{}, B=src[b]||{};
    if(!!A.online !== !!B.online) return A.online ? -1 : 1;
    return String(A.name||'').localeCompare(String(B.name||''));
  });
  ids.forEach(fid=>{
    const f=src[fid]||{};
    const row=document.createElement('div'); row.className='pfRow';
    const dot=document.createElement('span'); dot.className='dot'+(f.online?' on':''); row.appendChild(dot);
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=f.name||'(이름 없음)'; row.appendChild(nm);
    row.title=(f.name||'친구')+' 님의 플레이리스트로 파도타기';
    row.addEventListener('click', e=>{ e.stopPropagation(); _plPeekFriend(fid, f.name||'친구'); });
    el.appendChild(row);
  });
}
async function _plPeekFriend(fid, name){
  if(typeof firebaseAPI === 'undefined' || !firebaseAPI.fetchPlaylistOf){
    toast('파도타기는 인터넷 연결이 필요해요'); return;
  }
  const r = await firebaseAPI.fetchPlaylistOf(fid);
  /* ★ "친구지만 목록이 비었다"를 그대로 말해준다 — 무작위 파도타기의 '아직 파도탈 목록이 없어요'와
     뭉뚱그리면 내 친구가 목록을 안 만든 건지 앱이 고장난 건지 구분이 안 된다. */
  if(!r){ toast(name + ' 님은 아직 공개한 목록이 없어요'); return; }
  _plView = { uid:r.uid, name:name || '(이름 없음)', items:r.items,
    bio:r.bio || '', homePublic:!!r.homePublic };
  _plSel = -1;   // 🎵 재생 위치는 그대로 — 무작위 파도타기와 같은 규칙이다(듣던 곡이 안 끊긴다)
  _plCloseFriendPick();
  _plLoadViewCard(r.uid);
  _plRender();
}

/* ═══ 🎵 프리셋 고르기 ═══════════════════════════════════════════════════
   여는 문은 [프리셋 ▼] 버튼 하나다(요청 2).
   📌 앞 핸드오프의 결정 ⑤("프로필 사진을 누르면 프리셋 고르기")는 이 버튼으로 **대체됐다** —
     사진 클릭은 예전처럼 아무 동작도 없다(남의 목록에서 마이홈 구경만 한다). 문을 둘로 두면
     한쪽만 고쳐지고, 사진은 "누를 수 있다"는 신호가 약해서 아무도 못 찾는다.
   ★ 목록·여닫이는 친구 지목(_plToggleFriendPick)과 같은 관례를 그대로 쓴다 — 같은 창의 같은
     성격이라 규약이 두 벌이 될 이유가 없다. 닫는 길도 같다: 다시 누르거나 · 하나를 고르거나 ·
     창이 닫힐 때. (ESC 는 창째 닫는다 — 친구 지목도 예전부터 그렇다) */
function _plSetPickEl(){ return document.getElementById('myPlSetPick'); }
function _plCloseSetPick(){
  const el = _plSetPickEl(); if(el) el.classList.remove('on');
  const b = document.getElementById('myPlSetBtn');
  if(b){ b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); }
}
function _plToggleSetPick(){
  const el = _plSetPickEl(); if(!el) return;
  if(el.classList.contains('on')){ _plCloseSetPick(); return; }
  _plRenderSetPick();
  el.classList.add('on');
  const b = document.getElementById('myPlSetBtn');
  if(b){ b.classList.add('on'); b.setAttribute('aria-expanded', 'true'); }
}
/* 세 줄을 그린다 — [지금 보는 표시] 이름 [♪ 재생 중] [n곡].
   ⚠️ 부르는 자리는 둘뿐이다 — 열 때(_plToggleSetPick)와, **열려 있는 동안** 다시 그릴 때(_plRender).
     닫혀 있을 때도 부르면 열지도 않은 UI 를 매 렌더마다 만든다. */
function _plRenderSetPick(){
  const el = _plSetPickEl(); if(!el) return;
  el.textContent = '';
  for(let i = 0; i < PL_SETS; i++){
    const s = _plSets[i] || { name:'', items:[] };
    const row = document.createElement('div');
    row.className = 'psRow' + (i === _plCur ? ' cur' : '');
    const mk = document.createElement('span');
    mk.className = 'mk'; mk.textContent = (i === _plCur) ? '●' : String(i + 1);
    row.appendChild(mk);
    const nm = document.createElement('span');
    nm.className = 'nm' + (s.name ? '' : ' empty');
    nm.textContent = _plSetLabel(i);           // 이름이 없으면 자리로 부른다("프리셋 2")
    row.appendChild(nm);
    /* ✏️ [수정] — 점선 밑줄 텍스트 하나다(요청). 버튼 테두리를 주면 세 줄짜리 좁은 목록에
         상자가 셋 더 생겨 답답해진다.
       ★ **지금 보고 있지 않은 프리셋도 그 자리에서 고친다.** 3번 이름을 고치려고 3번으로
         갈아탈 필요가 없다 — 나오던 곡이 안 끊긴다. 예전 제목줄 편집은 구조상 '보고 있는
         프리셋'만 고칠 수 있었다.
       ⚠️ 남의 목록(파도타기)에서는 안 붙인다 — 남의 이름이다. 예전 제목줄이 읽기전용일 때
         점선을 안 붙이던 것과 같은 규칙이다. */
    if(!_plReadOnly()){
      const ed = document.createElement('span');
      ed.className = 'ed';
      ed.textContent = '수정';
      ed.title = _plSetLabel(i) + ' 이름 고치기';
      ed.addEventListener('click', e=>{
        /* ⚠️ 끊지 않으면 줄 클릭(_plSwitchSet)이 같이 먹어서, 이름을 고치려고 눌렀는데
           프리셋이 갈아타진다. */
        e.stopPropagation();
        _plStartRename(row, i);
      });
      row.appendChild(ed);
    }
    /* ♪ 지금 소리가 나는 프리셋 — 다른 프리셋을 보고 있어도 어디서 나오는지 알 수 있다.
       파도타기 중에는 남의 목록이 나오고 있으므로 내 프리셋에는 아무 표시도 안 붙는다. */
    if(!_plView && _plNow >= 0 && i === _plNowSet){
      const now = document.createElement('span');
      now.className = 'now'; now.textContent = '♪'; now.title = '지금 이 프리셋에서 나오고 있어요';
      row.appendChild(now);
    }
    const cnt = document.createElement('span');
    cnt.className = 'cnt'; cnt.textContent = s.items.length + '곡';
    row.appendChild(cnt);
    row.title = _plSetLabel(i) + ' 로 바꾸기';
    row.addEventListener('click', e=>{ e.stopPropagation(); _plSwitchSet(i); });
    el.appendChild(row);
  }
}
/* ✏️ 그 줄을 입력칸으로 갈아낀다 — bio 편집(bindPlBio)과 **같은 규약**이다:
     Enter 저장 · Esc 취소 · 포커스를 잃으면 저장 · PL_TITLE_MAX 자 상한.
   ★ DOM 을 손으로 되돌리지 않는다. 끝나면 _plRender 를 부르고, 그 안에서 목록이 통째로
     다시 그려진다(열려 있을 때만 _plRenderSetPick 을 부르는 그 줄이 이미 있다).
     이름이 바뀌면 창 제목([프리셋 ▼] 버튼 글자·타이틀바)도 같이 바뀌어야 하는데 그 계산은
     _plWindowTitle 한 곳에 있다 — 여기서 span 만 되돌리면 그 둘이 어긋난다.
   ⚠️ end 가 두 번 불릴 수 있다(Enter → 다시 그리며 blur). done 으로 막는다. */
function _plStartRename(row, i){
  if(!row || row.querySelector('.edin')) return;   // 이미 고치는 중
  const nm = row.querySelector('.nm'), ed = row.querySelector('.ed');
  if(!nm) return;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'edin';
  inp.maxLength = PL_TITLE_MAX; inp.spellcheck = false;
  inp.value = _plSetName(i);
  inp.placeholder = '프리셋 ' + (_plSetIdx(i) + 1);   // 비우면 이 자리 이름으로 돌아간다는 뜻
  nm.style.display = 'none';
  if(ed) ed.style.display = 'none';
  row.insertBefore(inp, nm);
  let done = false;
  const end = save=>{
    if(done) return;
    done = true;
    if(save) _plRenameSet(i, inp.value);
    _plRender();
  };
  /* ⚠️ 이 줄 위의 클릭·마우스다운은 전부 끊는다 — 안 끊으면 글자를 고르려고 드래그하는
     동안 줄 클릭이 먹어 프리셋이 갈아타진다(위 [수정] 과 같은 이유). */
  inp.addEventListener('click', e=>e.stopPropagation());
  inp.addEventListener('mousedown', e=>e.stopPropagation());
  inp.addEventListener('blur', ()=>end(true));
  inp.addEventListener('keydown', e=>{
    /* ⚠️ 먼저 끊는다 — 이 창에는 스페이스=재생 단축키가 있고 Delete 는 곡을 지운다.
       이름을 타이핑하는 동안 그것들이 끼어들면 안 된다. */
    e.stopPropagation();
    if(e.key === 'Enter'){ e.preventDefault(); end(true); }
    else if(e.key === 'Escape'){ e.preventDefault(); end(false); }
  });
  inp.focus(); inp.select();
}

/* 프리셋 갈아타기 — **보는 것만** 바꾼다. 나오고 있는 곡은 끝까지 나오고, 다음 곡부터 이 프리셋에서
   뽑힌다(요청 ④). 그 갈아타기는 _plSkipNext 가 한다 — 여기서 _plNowSet 을 건드리면 그 약속이 깨진다.
   ⚠️ _plSel 은 -1 로 초기화한다. 남겨두면 8곡짜리에서 12번을 고른 상태가 된다.
   ⚠️ 단 **파도타기 중에는 선택을 건드리지 않는다** — 그 번호는 남의 목록의 것이고, 📥 담기가
     그것을 쓴다. 이때 프리셋을 바꾸는 것은 "어디에 담을지" 를 고르는 뜻이다. */
function _plSwitchSet(i){
  const n = _plSetIdx(i);
  _plCloseSetPick();
  if(n === _plCur) return;
  const ro = _plReadOnly();
  _plCur = n;
  if(!ro) _plSel = -1;
  _plSave();       // 고른 프리셋도 저장한다(tw.playlistCur) — 창을 닫았다 열어도 그 자리다
  _plRender();
  if(ro){ toast('📥 담을 곳: ' + _plSetLabel(n) + ' (' + _plMine().length + '/' + PL_MAX + ')'); return; }
  const playing = _plNow >= 0 && _plNowSet !== n;
  toast('🎵 ' + _plSetLabel(n) + ' (' + _plMine().length + '곡)'
        + (playing ? ' — 지금 곡이 끝나면 여기서 이어져요' : ''));
}

/* 📥 파도타기 중에 마음에 든 곡을 내 목록으로 담는다.
   ★ 남의 목록은 읽기 전용이므로 저쪽은 아무것도 안 바뀐다 — 내 프리셋(_plMine)에만 복사한다.
   ★ 서버 사본(users/{uid}/playlist)은 _plSave 안의 _plPublish 가 3초 debounce 로 알아서 올린다.
   ⚠️ 남의 목록 항목은 {id, title} 뿐이다(publishMyPlaylist 가 그 둘만 올린다).
      url 은 내 목록 형식에 맞춰 id 로 복원한다 — 안 하면 제목 없는 곡에서 표시할 게 없어진다. */
function _plSetItems(k){ const s = _plSets[_plSetIdx(k)]; return (s && s.items) || []; }
/* 📥 지금 고른 곡을 k 번 프리셋에 담을 수 있는가 — 못 담으면 **이유**를, 담을 수 있으면 null 을 준다.
   ★ 판정을 한 곳에 모은 이유: 드롭메뉴가 줄을 흐리게 그릴 때와 실제로 담을 때가 같은 답을 내야 한다.
     둘로 나뉘면 "흐린데 눌리는" 또는 "멀쩡한데 안 담기는" 줄이 생긴다. */
function _plGrabBlock(k, it){
  const items = _plSetItems(k);
  if(items.length >= PL_MAX) return '꽉 찼어요 (' + PL_MAX + '곡)';
  if(it && it.id && items.some(x => x.id === it.id)) return '이미 담긴 곡이에요';
  return null;
}
/* 📥 지금 고른 곡 — 없으면 null. 드롭메뉴를 열 때와 담을 때가 같은 곡을 봐야 한다. */
function _plGrabSong(){
  const items = _plItems();
  if(_plSel < 0 || _plSel >= items.length) return null;
  const it = items[_plSel];
  return (it && it.id) ? it : null;
}
/* 📥 담기 — **어느 프리셋에 담을지는 부르는 쪽이 정한다**(드롭메뉴가 넘긴다).
   ★ 예전에는 무조건 _plCur 로 들어갔다. 그런데 파도타기 중에는 프리셋 줄이 통째로 숨어서,
     "어디로 담기는지"를 버튼 툴팁으로만 알 수 있었고 바꾸려면 파도타기를 나갔다 와야 했다.
   ★ _plCur 은 건드리지 않는다 — 담았다고 보고 있던 프리셋까지 갈아타면, 파도타기에서 돌아왔을 때
     엉뚱한 목록이 열려 있다. 담기는 '복사'지 '이동'이 아니다. */
function _plGrabTo(k){
  if(!_plReadOnly()) return;                       // 내 목록에서는 의미가 없다(버튼도 숨겨져 있다)
  const it = _plGrabSong();
  if(!it){ toast('담을 곡을 먼저 선택해 주세요'); return; }
  k = _plSetIdx(k);
  const why = _plGrabBlock(k, it);
  if(why){ toast(_plSetLabel(k) + ' — ' + why); return; }
  const dst = _plSetItems(k);
  dst.push({ id: it.id,
             url: 'https://www.youtube.com/watch?v=' + it.id,
             title: String(it.title || '').slice(0, 60) });
  _plSave();
  /* 화면은 남의 목록을 그대로 보여준다(듣던 흐름을 끊지 않는다) — 그래서 결과는 토스트로 알린다. */
  _plRender();
  toast('📥 ' + _plSetLabel(k) + ' 에 담았어요 — ' + dst.length + '/' + PL_MAX
        + (dst.length >= PL_MAX ? ' (꽉 찼어요)' : ''));
}
/* 📥 담을 프리셋 고르기 — 버튼 아래에 붙는 작은 드롭메뉴.
   ★ 클래스는 `cr-preset-ctx` 를 그대로 쓴다(좌석 우클릭 메뉴와 같은 판단). 그 이름이
     _pointHitsInteractive 화이트리스트에 이미 있어서다 — 새 이름을 지으면 메뉴는 떠도 커서를
     올리는 순간 클릭이 뒤 창으로 뚫린다(핸드오프 3절의 그 사고, 이번이 다섯 번째가 될 뻔했다).
     뒷판(seat-ctx-backdrop)도 같은 이유로 그대로 베낀다 — 바깥 클릭으로 닫으려면 판이 있어야 한다.
   ★ 못 담는 줄은 **흐리게 두고 클릭을 막는다**(요청). 이유는 줄 안에 적는다 — 눌러야 알 수 있으면
     굳이 메뉴를 만든 뜻이 없다.
   ⚠️ 메뉴와 뒷판은 수명을 반드시 같이 한다. 남으면 화면 전체가 클릭을 먹는 유령 판이 된다. */
function _plCloseGrabPick(){
  try{ document.querySelectorAll('.pl-grab-ctx, .pl-grab-backdrop').forEach(n=>n.remove()); }catch(_){}
}
function _plOpenGrabPick(btn){
  _plCloseGrabPick();
  const it = _plGrabSong();
  if(!it){ toast('담을 곡을 먼저 선택해 주세요'); return; }
  const backdrop = document.createElement('div');
  backdrop.className = 'seat-ctx-backdrop pl-grab-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
  const menu = document.createElement('div');
  /* 모양은 CSS(.pl-grab-ctx)에 있다 — 여기서는 자리(left/top)만 잡는다.
     ★ cr-preset-ctx 는 화이트리스트용 이름이라 빼면 안 된다(위 주석 참고). */
  menu.className = 'cr-preset-ctx pl-grab-ctx';
  let onEsc = null;
  const close = ()=>{
    _plCloseGrabPick();
    if(onEsc) document.removeEventListener('keydown', onEsc, true);
  };
  for(let k = 0; k < PL_SETS; k++){
    const why = _plGrabBlock(k, it);
    const row = document.createElement('div');
    row.className = 'psRow' + (why ? ' off' : '');   // .off = 못 담는 줄(흐리게 · 클릭 없음)
    const mk = document.createElement('span');
    mk.className = 'mk';
    mk.textContent = (k === _plCur) ? '●' : String(k + 1);     // ● = 지금 보고 있던 프리셋
    const nm = document.createElement('span');
    nm.className = 'nm' + (_plSetName(k) ? '' : ' empty');     // 이름을 안 정했으면 흐리게(고르기 목록과 같은 규칙)
    nm.textContent = _plSetLabel(k);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = why ? why : (_plSetItems(k).length + '/' + PL_MAX);
    row.appendChild(mk); row.appendChild(nm); row.appendChild(cnt);
    row.title = why ? (_plSetLabel(k) + ' — ' + why) : ('이 곡을 ' + _plSetLabel(k) + ' 에 담기');
    // 눌리는 줄만 클릭을 건다 — 흐린 줄은 리스너 자체가 없다(:hover 도 CSS 에서 되돌린다)
    if(!why) row.onclick = e=>{ e.stopPropagation(); close(); _plGrabTo(k); };   // 하나 담으면 닫는다(요청)
    menu.appendChild(row);
  }
  backdrop.addEventListener('mousedown', e=>{ e.stopPropagation(); close(); });
  onEsc = e=>{ if(e.key === 'Escape'){ e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onEsc, true);
  document.body.appendChild(backdrop);
  document.body.appendChild(menu);
  /* 자리 — 버튼 **아래·오른쪽 맞춤**. 화면 밖으로 나가면 안쪽으로 접어 넣는다(작은 창에서 잘림 방지). */
  try{
    const r = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
    let left = r.right - m.width, top = r.bottom + 2;
    left = Math.max(4, Math.min(left, window.innerWidth - m.width - 4));
    if(top + m.height > window.innerHeight - 4) top = Math.max(4, r.top - m.height - 2);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }catch(_){}
}

/* ═══ 🐕 재생 감시견 ═══════════════════════════════════════════════════════
   [제보] "간혹 노래가 끝나도 다음 곡으로 안 넘어간다."
   [왜 생기나] 곡을 넘기는 신호(TWPL:ended)는 BGM 창에 심는 주입 스크립트에서만 나온다.
     그 스크립트가 안 붙거나(did-finish-load 미도래) 죽으면 **아무도 모른 채 멈춘다.**
     main 쪽에도 보루를 뒀지만(재주입), 그것마저 안 되는 경우가 남는다 — 여기가 마지막이다.
   ★ **시간이 아니라 진행 여부로 판정한다.** "N분 지났으면 넘긴다"로 하면 40분짜리 믹스가
     10분에 끊긴다. 재생 위치가 앞으로 안 가는 것만이 «멈췄다»의 증거다.
     그래서 라이브 스트림은 여기 안 걸린다 — 계속 나아가고 있으니 멈춘 것이 아니다.
   ★ 일시정지 중에는 안 센다. 사람이 세운 것을 고장으로 읽으면 안 된다.
   ⚠️ 넘긴 것은 _plErrStreak 에 함께 센다. 목록 전체가 이 상태면 무한히 돌지 않고 멈춘다
     (재생불가 곡과 같은 처리 — 증상이 다를 뿐 "이 곡을 못 틀었다"는 같다).
     **단 하나의 예외: «끝까지 나온 뒤 종료 신호만 놓친 곡».** 아래 [9/11] 참조.

   🔴 [9/11 제보] "셔플 반복·한 곡 반복을 하다 보면 안 넘어가거나 반복 재생이 중단된다."
     9/8 판은 감시견이 넘긴 것을 **전부** 실패로 셌다. 그런데 끝까지 들린 곡은 못 튼 곡이 아니다 —
     신호 하나를 놓쳤을 뿐이다. 그것을 세면 목록 길이만큼 쌓이는 순간 「재생할 수 있는 곡이 없어요」로
     멈춘다(한 곡 반복은 매번 같은 곡이라 반드시 쌓인다. 반복 끔이면 «목록이 끝났어요» 대신 틀린
     이유를 말한다). 이 판에서 세 가지를 바꿨다.
     ① **끝 근처에서 멈췄고, 이번에 연 뒤 재생 위치가 실제로 움직인 적이 있으면 → 정상 종료로 친다.**
        TWPL:ended 가 왔을 때와 똑같이 연속 실패를 0 으로 되돌리고 _plNext 로 간다.
     ② **위치가 «앞으로 간» 것이 아니라 «바뀐» 것을 진행으로 본다.** 앞으로 간 것만 세면
        - 곡을 연 직후 옛 페이지(끝에 선 채 아직 안 죽은)의 하트비트가 한 번 섞였을 때 기준값이 곡 길이로
          올라가, 새 곡이 그 값을 넘기 전까지 «안 나아간다»로 읽혀 25초쯤에 잘린다. 한 곡 반복이면 새 곡
          길이 = 옛 값이라 **절대 못 넘는다.** 하트비트에는 어느 페이지인지 표시가 없어 거를 수도 없다.
        - 사람이 BGM 창에서 뒤로 감으면 그 곡이 잘린다.
     ③ **«움직인 적이 있다»는 첫 하트비트가 아니라 그 다음 변화부터 센다**(_plWatchPlayed).
        ⚠️ 이 조건을 빼면 안 된다. 같은 주소를 다시 열었는데 페이지가 **새로 안 뜨는** 경우(핸드오프 §1
          실측 갈래 ①)에는 하트비트가 처음부터 끝 위치에 서 있기만 한다. 그걸 정상 종료로 치면 멈추지는
          않지만 **소리 없이 30초마다 같은 곡을 영원히 다시 연다** — 지금보다 나쁘다.
          그 경우는 실패로 세서 옛날처럼 목록 길이에서 멈추고, 콘솔에 «재생 없음»으로 따로 남긴다.
          ⇒ 이 로그가 뜨면 갈래 ①이 실제로 있다는 뜻이다. main.js 주입 쪽을 고쳐야 한다.
   ⚠️ 중간에서 굳은 곡·신호가 한 번도 없는 곡은 여전히 실패로 센다(무한 루프 방지는 그대로).
   ✅ 검증기: sim-pl-watchdog.js §5·§6 */
const PL_WATCH_SILENT_MS = 30000;   // 신호가 한 번도 안 옴 — 주입이 아예 안 붙었다
const PL_WATCH_STUCK_MS  = 25000;   // 신호는 오는데 재생 위치가 안 움직인다 — 끝났는데 못 알아챘다
/* 끝 근처로 치는 여유(초). 하트비트는 위치를 내림(floor)해서 보내고, 주입 스크립트는 길이-0.4초에서
   «끝»으로 본다. 그 사이 몇 초의 어긋남을 흡수하는 값이지 «거의 끝났으니 넘긴다»가 아니다. */
const PL_WATCH_END_SLACK_S = 3;
let _plWatchAt = 0;        // 이번 곡을 연 시각
let _plWatchHbAt = 0;      // 마지막 하트비트 시각 (0 = 아직 한 번도 못 들음)
let _plWatchPos = -1;      // 마지막으로 들은 재생 위치(초)
let _plWatchDur = -1;      // 마지막으로 들은 곡 길이(초). 라이브·모름은 -1
let _plWatchMoveAt = 0;    // 재생 위치가 마지막으로 **바뀐** 시각 (앞으로든 뒤로든)
let _plWatchPlayed = false; // 이번에 연 뒤 위치가 **한 번이라도 바뀌었나** — 첫 하트비트는 안 친다(③)
let _plWatchTimer = null;

function _plWatchReset(){
  _plWatchAt = Date.now();
  _plWatchHbAt = 0; _plWatchPos = -1; _plWatchDur = -1; _plWatchMoveAt = 0; _plWatchPlayed = false;
  if(!_plWatchTimer) _plWatchTimer = setInterval(_plWatchTick, 5000);
}
function _plWatchStop(){
  if(_plWatchTimer){ clearInterval(_plWatchTimer); _plWatchTimer = null; }
  _plWatchAt = 0; _plWatchHbAt = 0; _plWatchPos = -1; _plWatchDur = -1; _plWatchMoveAt = 0; _plWatchPlayed = false;
}
/* 하트비트 수신 — "TWPL:hb:<위치>|<길이>|<일시정지>" */
function _plWatchBeat(payload){
  const p = String(payload || '').split('|');
  const pos = parseInt(p[0], 10);
  const dur = parseInt(p[1], 10);
  const paused = p[2] === '1';
  const now = Date.now();
  _plWatchHbAt = now;
  if(paused){ _plWatchMoveAt = now; return; }   // 사람이 세운 것은 멈춤이 아니다
  if(!isFinite(pos)) return;
  if(isFinite(dur)) _plWatchDur = dur;
  /* ② «바뀌었다»가 진행이다. ⚠️ `pos > _plWatchPos` 로 되돌리지 말 것 — 옛 페이지 하트비트가 섞이면
       새 곡이 25초에 잘리고, 한 곡 반복은 영원히 못 넘는다(위 [9/11]). */
  if(pos !== _plWatchPos){
    if(_plWatchPos >= 0) _plWatchPlayed = true;   // ③ 첫 하트비트(-1 에서 오는 것)는 «움직임»이 아니다
    _plWatchPos = pos; _plWatchMoveAt = now;
  }
  else if(!_plWatchMoveAt) _plWatchMoveAt = now;
}
function _plWatchTick(){
  if(_plNow < 0 || !_plWatchAt){ _plWatchStop(); return; }
  const now = Date.now();
  /* ⏸ [2026-09-20 제보 «가만히 있다가 저절로 재생된다»] 사람이 ▐▐ 로 세워 둔 동안은 **판정하지 않는다.**
     [경위] 일시정지 중에도 이 tick 은 돌고, 하트비트가 오는 동안은 _plWatchBeat 의 paused 갈래가
       _plWatchMoveAt 을 갱신해 «멈춤» 으로 안 읽혔다. 그런데 하트비트가 **끊기면** 그 보호가 사라진다 —
       주입 루프는 TWPL_MAX(4시간) 뒤에 죽고(main.js), 세워 둔 동안에도 tick 수는 계속 쌓이므로
       4시간 세워 두면 하트비트가 끊긴다. 그 순간 이 자리가 «진행멈춤» 으로 읽고 _plNext 를 불러
       **다음 곡을 튼다.** 사람이 세운 것은 몇 시간이 지나도 멈춤이 아니다.
     ★ 다시 ▶ 를 누르면(_plPlaying=true) 그때부터 예전처럼 판정한다 — 그때 하트비트가 정말 없으면
       «신호없음/진행멈춤» 으로 넘어가는 것이 맞다(주입이 죽은 페이지는 끝나도 신호를 못 보낸다). */
  if(typeof _plPlaying !== 'undefined' && _plPlaying === false){ _plWatchMoveAt = now; return; }
  let why = '';
  if(!_plWatchHbAt){
    if(now - _plWatchAt > PL_WATCH_SILENT_MS) why = '신호없음';
  }else if(_plWatchMoveAt && now - _plWatchMoveAt > PL_WATCH_STUCK_MS){
    why = '진행멈춤';
  }
  if(!why) return;
  const atEnd = why === '진행멈춤' && _plWatchDur > 0 && _plWatchPos >= _plWatchDur - PL_WATCH_END_SLACK_S;
  /* ① 끝까지 나온 뒤 종료 신호만 놓쳤다 — TWPL:ended 와 똑같이 처리한다(연속 실패 0, 반복 규칙대로 다음). */
  if(atEnd && _plWatchPlayed){
    try{ console.warn('[플레이리스트] 감시견 — 끝에서 종료 신호 놓침 (위치 ' + _plWatchPos + '/' + _plWatchDur + 's) → 정상 종료로 처리'); }catch(_){}
    _plErrStreak = 0;
    _plNext();
    return;
  }
  /* ③ 끝에 서 있는데 이번에 연 뒤 한 번도 안 움직였다 — 곡이 다시 시작되지 않았다. 실패로 센다.
     🔬 이 줄이 뜨면 «같은 주소를 다시 열어도 페이지가 새로 안 뜬다»(핸드오프 §1 갈래 ①)를 의심할 것. */
  try{ console.warn('[플레이리스트] 감시견 — ' + why + (atEnd ? '·끝에 선 채 재생 없음' : '')
    + ' (위치 ' + _plWatchPos + (_plWatchDur > 0 ? '/' + _plWatchDur : '') + 's) → 다음 곡'); }catch(_){}
  _plErrStreak += 1;
  if(_plErrStreak >= Math.max(1, _plNowItems().length)){
    _plStop(); _plWatchStop();
    toast('🎵 재생할 수 있는 곡이 없어요');
    return;
  }
  _plNext();
}

/* 🔁 한 곡 반복을 main 에 알린다 — 켜져 있으면 재생 창이 <video>.loop 로 되풀이한다.
   [왜] 9/11 제보 「한 곡 반복이 안 넘어가다 멈춘다」. 옛 방식은 곡이 끝날 때마다 같은 주소를 다시 열었고,
     그때 페이지가 새로 뜨는지가 확인되지 않은 채였다(핸드오프 §1). loop 로 붙이면 다시 열 일이 없다.
   ★ 부르는 자리는 셋이다: 곡을 여는 문(_plOpenTrack, **열기 직전**), 반복 켬/끔(좌클릭), 종류 바꾸기(우클릭).
     재생 중에 바꿔도 main 이 지금 페이지의 전역을 바로 고치고 감시 루프가 다음 tick 부터 따른다.
   ⚠️ 한 곡 반복일 때만 켠다. 1곡짜리 목록의 목록 반복·셔플도 같은 곡을 되풀이하지만, 목록이 늘어나는 순간
     다음 곡으로 가야 해서 편집마다 다시 알려야 한다 — 그 경로는 옛 방식(_plNext → 같은 주소)으로 둔다.
   ⚠️ 구버전 앱(preload 에 setBgmLoop 없음)은 아무것도 안 하고 false 를 돌려준다. 그때 main 은 loop 을 모르고
     곡이 끝나면 TWPL:ended 를 보내므로, _plNext 의 한 곡 반복 분기(같은 주소 다시 열기)가 그대로 받는다.
     ⇒ 그 분기를 지우면 안 된다. 새 앱에서도 loop 가 어떤 이유로 안 돌 때 감시견이 그 길로 되살린다. */
function _plWantLoop(){ return !!(_plOn && _plKind === PL_KIND_ONE); }
function _plSyncLoop(){
  if(!(window.companion && companion.setBgmLoop)) return false;
  try{ companion.setBgmLoop(_plWantLoop()); }catch(_){ return false; }
  return true;
}
/* ▶ 실제로 자식창을 여는 **유일한 자리**. 창 제목은 패널 타이틀바와 같은 문구(_plWindowTitle)라
   파도타기 중에 틀면 창 제목도 "[닉네임]의 플레이리스트"가 된다.
   ★ 목록을 인자로 받는다 — 프리셋이 생기면서 "어느 목록의 몇 번째" 인지가 호출부마다 다르다
     (사람이 고른 것은 보고 있는 목록, 자동 진행은 재생 중 프리셋의 목록). 열기 자체는 한 벌이다. */
function _plOpenTrack(items, i){
  if(!items || i < 0 || i >= items.length) return false;
  if(!(window.companion && companion.openPlaylistTrack)){
    toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요');
    return false;
  }
  _plSyncLoop();   // 🔁 반드시 열기 **전에** — main 이 새 페이지에 주입할 때 이 값을 심는다
  companion.openPlaylistTrack('https://www.youtube.com/watch?v=' + items[i].id, _plNowTitle());
  _plWatchReset();   // 🐕 곡이 바뀌는 문은 여기 하나뿐이라 감시견도 여기서만 되감는다
  /* 🔊 새 페이지가 다 읽힐 때까지 음량을 몇 번 더 보낸다 — 곡이 바뀌는 자리는 여기 하나뿐이라
     (자동 진행·⏭·손으로 고르기·파도타기가 전부 이 문을 지난다) 여기 한 줄이면 전부 덮인다. */
  _plApplyVolSoon();
  return true;
}
/* ▶ **보고 있는 목록**의 i번째부터 재생 — 사람이 고른 길(행 더블클릭 · ▶ 버튼).
   ★ 손으로 곡을 고르는 것은 곧 "이 프리셋으로 갈아탄다"는 뜻이다 — 그 자리에서 바로 갈아탄다.
     ④의 "다음 곡부터"는 **자동 진행**의 규칙이다. 손으로 고른 곡이 안 나오면 그건 고장으로 읽힌다. */
function _plPlayFrom(i){
  const items = _plItems();
  /* ★ 출처를 **창을 열기 전에** 옮긴다 — 창 제목(_plNowTitle)이 새 주인의 이름으로 뜨게. */
  const prevView = _plNowView, prevSet = _plNowSet;
  /* ⚠️ setName 도 같이 옮긴다 — 빠뜨리면 «보는 창»에는 프리셋 이름이 뜨는데
     «트는 창»에는 안 떠서, 같은 목록인데 제목이 둘로 갈린다. */
  if(_plView) _plNowView = { uid:_plView.uid, name:_plView.name, setName:_plView.setName || '',
                             items:(_plView.items || []).slice() };
  else { _plNowView = null; if(_plNowSet !== _plCur){ _plNowSet = _plCur; _plShufBag = []; } }
  if(prevView !== _plNowView || prevSet !== _plNowSet) _plShufBag = [];   // 가방의 번호는 이전 목록의 것이다
  if(!_plOpenTrack(items, i)){ _plNowView = prevView; _plNowSet = prevSet; return; }
  _plSel = i; _plNow = i; _plPlaying = true;
  _plRender();
}
/* ▶ **재생 중 프리셋**의 i번째 — 자동 진행(곡 종료·⏭)이 쓰는 길. 보고 있는 프리셋과 다를 수 있다.
   ⚠️ 그때 _plSel(선택)은 건드리지 않는다 — 그 번호는 지금 보고 있는 목록의 것이다. */
function _plPlayNow(i){
  const items = _plNowItems();
  if(!_plOpenTrack(items, i)) return;
  _plNow = i; _plPlaying = true;
  if(_plNowHere()) _plSel = i;   // 같은 목록을 보고 있을 때만 선택이 따라간다(예전 동작)
  _plRender();
}
/* ▶ 버튼 — 멈춰 있으면 재생, 나는 중이면 일시정지(창은 그대로 두고 영상만).
   pauseBgm/resumeBgm 은 마이홈 BGM이 쓰던 IPC를 그대로 재사용한다. */
function _plTogglePlay(){
  if(_plNow < 0){ _plPlayFrom(_plSel >= 0 ? _plSel : 0); return; }
  if(!window.companion) return;
  if(_plPlaying){ if(companion.pauseBgm) companion.pauseBgm(); _plPlaying = false; }
  else { if(companion.resumeBgm) companion.resumeBgm(); _plPlaying = true; }
  _plRender();
}
function _plStop(){
  if(window.companion && companion.closeBgm) companion.closeBgm();
  _plVolReCancel();   // 🔊 창을 닫는데 예약된 음량 전송이 남아 있을 이유가 없다
  _plNow = -1; _plPlaying = false; _plErrStreak = 0; _plNowView = null; _plRender();
}
/* 다음 곡 — **자동 진행**(곡이 끝났을 때 main 이 보내는 신호)이 부른다.
   반복이 켜져 있으면 종류가 정한다.
     끔        : 끝에서 정지
     목록 반복 : 끝에서 처음으로
     한 곡     : 같은 칸을 다시 연다
     셔플      : 가방에서 하나 뽑는다
   🔁 [9/11] 새 앱에서는 한 곡 반복을 main 이 <video>.loop 로 돌린다(_plSyncLoop) — 곡이 끝나도 신호가 안 오므로
     아래 한 곡 반복 분기는 **구버전 앱이거나 loop 가 안 돌아 감시견이 부를 때만** 탄다. 지우지 말 것.
   ⚠️ 한 곡 반복은 같은 URL을 다시 여는 방식이라 그 곡의 광고 게이트를 한 번 더 지난다.
     <video>.loop 로 붙이면 매끄럽지만, 그건 main의 감시 루프가 PL 모드에서 loop을 강제로 끄고 있어
     (곡 종료 신호를 받아야 하므로) 거기까지 같이 고쳐야 한다. 지금은 재생 경로를 하나로 유지한다. */
function _plNext(){
  const items = _plNowItems();
  if(_plNow < 0 || !items.length) return;
  /* 🔁 한 곡 반복은 '다음 곡'이 없다 — 프리셋을 바꿔 뒀어도 이 곡을 계속 되풀이한다(갈아타지 않는다).
     ⚠️ _plPlayFrom 이 아니라 _plPlayNow 다. 다른 프리셋을 보고 있을 때 전자를 쓰면 그 목록의
       같은 번호, 즉 **엉뚱한 곡**이 열린다. */
  if(_plOn && _plKind === PL_KIND_ONE){ _plPlayNow(_plNow); return; }
  _plSkipNext();
}
/* ⏭ 다음 곡 — **사람이 눌렀을 때.** 자동 진행과 딱 한 곳만 다르다:
   **'한 곡 반복'을 무시한다.** 자동이면 같은 곡을 다시 여는 게 맞지만, 손으로 ⏭ 를 눌렀는데
   같은 곡이 처음부터 다시 시작하면 "버튼이 고장났다"로 읽힌다(어느 플레이어도 그렇게 안 한다).
   ★ 그 외는 자동과 같은 규칙을 그대로 지난다 — 셔플이면 가방에서 뽑고, 반복이 꺼져 있으면
     마지막 곡에서 멈춘다('반복 끔'인데 손으로 넘기면 처음으로 돌아가는' 예외를 만들지 않는다.
     그 예외를 두면 반복 스위치의 뜻이 버튼마다 달라진다).
   ⚠️ 실패 연속 카운터(_plErrStreak)는 여기서 손대지 않는다 — 자동 진행이 그 값을 세고 바로
     이 함수를 부르기 때문에, 여기서 0 으로 지우면 못 트는 곡만 있는 목록에서 무한 루프가 된다.
     사람이 누른 경로에서만 호출부가 따로 지운다. */
function _plSkipNext(){
  /* ★ ④ 프리셋을 갈아타는 **유일한 자리**. 지금 곡은 이미 끝났고(또는 사람이 넘겼고), 여기서부터가
     "다음 곡" 이다 — 그래서 새 프리셋이 여기서 효력을 갖는다. 자동 진행도 이 함수를 지난다. */
  if(_plAdoptCurSet()) return;
  const items = _plNowItems();
  if(_plNow < 0 || !items.length) return;
  if(_plOn && _plKind === PL_KIND_SHUF){ _plPlayNow(_plShufPick(items.length)); return; }
  let n = _plNow + 1;
  if(n >= items.length){
    if(!_plOn){ _plStop(); toast('🎵 목록이 끝났어요'); return; }
    n = 0;   // 목록 반복
  }
  _plPlayNow(n);
}
/* 보고 있는 프리셋으로 갈아탄다 — 갈아탔으면 true(호출부는 거기서 끝낸다).
   ★ 새 프리셋의 **첫 곡**부터다(셔플이면 무작위 한 곡). 옛 번호를 그대로 쓰면 5번째를 듣다 바꿨을 때
     새 목록의 5번째로 뛰어서 "왜 중간부터 나오지" 가 된다.
   ⚠️ 파도타기 중에는 갈아타지 않는다 — 그때 나오는 것은 남의 목록이고, 내 프리셋 번호와 무관하다. */
function _plAdoptCurSet(){
  /* ⚠️ 남의 목록을 틀고 있는 중(_plNowView)에는 내 프리셋으로 갈아타지 않는다 —
     "다른 목록을 직접 틀기 전까지는 계속 이어진다"가 이 기능의 요지다. */
  if(_plView || _plNowView || _plNowSet === _plCur) return false;
  _plNowSet = _plCur;
  _plShufBag = [];                    // 가방의 번호는 이전 프리셋의 것이다 — 반드시 버린다
  const items = _plNowItems();
  if(!items.length){
    _plStop();
    toast('🎵 ' + _plSetLabel(_plCur) + ' 이 비어 있어요 — 재생을 멈췄어요');
    return true;
  }
  _plPlayNow((_plOn && _plKind === PL_KIND_SHUF) ? Math.floor(Math.random() * items.length) : 0);
  return true;
}
/* 셔플 — 매번 무작위로 뽑으면 같은 곡이 연달아 나오고 어떤 곡은 한참 안 나온다.
   안 나온 곡만 담은 '가방'에서 뽑고, 비면 다시 채운다. */
function _plShufPick(len){
  _plShufBag = _plShufBag.filter(i => i < len && i !== _plNow);
  if(!_plShufBag.length){
    for(let i = 0; i < len; i++) if(i !== _plNow) _plShufBag.push(i);
    if(!_plShufBag.length) return _plNow;   // 곡이 하나뿐이면 그 곡을 다시
  }
  return _plShufBag.splice(Math.floor(Math.random() * _plShufBag.length), 1)[0];
}
/* 볼륨을 BGM 자식창에 전달. 창이 아직 없으면 아무 일도 안 한다 —
   다음에 곡을 열 때 main이 기억해 둔 값으로 시작한다. */
function _plApplyVol(){
  try{ if(window.companion && companion.setBgmVolume) companion.setBgmVolume(_plVol / 100); }catch(_){}
}
/* 🔊 **곡을 새로 열었을 때** 음량을 다시 보낸다 — 제보 "다음 곡 초반 2초만 원래 크기로 들린다".
   ★ 왜 한 번으로는 부족한가 — 다음 곡은 창을 새로 만드는 게 아니라 **같은 자식창이 새 페이지를
     다시 읽는** 것이다. 그 사이에는 <video> 요소가 아직 없다. 음량은 그 요소에 넣는 값이라
     넣을 데가 없는 동안 보낸 것은 그냥 사라지고, 새로 생긴 <video> 는 기본값(=1.0, 100%)으로
     소리를 내기 시작한다. 20% 로 줄여둔 사람에게는 그 몇 초가 다섯 배로 들린다.
     지금까지 음량을 보내는 자리는 **슬라이더를 움직일 때와 부팅 직후 한 번**뿐이었다 —
     곡이 바뀌는 자리에는 아무도 없었다. 그래서 곡을 넘길 때마다 같은 일이 반복된다.
   ★ 그래서 로딩이 끝날 만한 구간에 걸쳐 **같은 값을 몇 번 더** 보낸다. 부르는 것은 슬라이더가
     쓰는 것과 똑같은 호출이고 값도 그대로라, 이미 걸린 뒤에 또 와도 아무 일도 일어나지 않는다.
     비용은 IPC 몇 번이다.
   ⚠️ 곡을 연달아 넘기면 이전 곡의 예약이 남는다 — 새로 열 때 반드시 먼저 지운다.
      안 지우면 넘기는 도중에 슬라이더를 만졌을 때 옛 예약이 **옛 값**을 다시 밀어 넣는다.
   ⚠️ 여기까지가 렌더러가 막을 수 있는 몫이다. 첫 순간까지 완전히 없애려면 main.js 의 주입
      스크립트가 **재생을 시작하기 전에** video.volume 을 먼저 넣어야 한다 — 그쪽은 이 파일 밖이다. */
let _plVolReT = [];
function _plVolReCancel(){ _plVolReT.forEach(clearTimeout); _plVolReT = []; }
function _plApplyVolSoon(){
  _plVolReCancel();
  _plApplyVol();                                   // 지금 한 번 — 창이 아직 옛 페이지라도 해는 없다
  [120, 300, 600, 1000, 1600, 2400].forEach(ms => _plVolReT.push(setTimeout(_plApplyVol, ms)));
}

(function bindMyPlaylist(){
  const btn = document.getElementById('myPlBtn'), box = document.getElementById('myPlaylistBox');
  if(!btn || !box) return;
  _plLoad();
  setTimeout(_plBootSync, 4200);   // ☁️ 계정 · firebaseAPI 가 붙을 틈(가챠 부팅 동기화와 같은 박자)
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    const willOpen = box.classList.contains('hidden');
    // 👤 내 사진·레벨은 창을 처음 열 때 한 번만 읽는다(마이홈을 안 열어본 세션에도 소개칸이 채워지게)
    if(willOpen){ _closeChipPopups('myPlaylistBox'); box._cascadeFlipped = false; _plLoadMyCard(); _plRender(); }   // 새로 열 땐 항상 우측부터 판정
    box.classList.toggle('hidden', !willOpen);
    btn.classList.toggle('on', willOpen);
    // 🪟 열 때는 맨 앞으로 — 채팅창이 이미 떠 있으면 그 뒤에서 열려 "안 열렸다"로 보인다.
    //   (칩째 올린다 — bringWinToFront 주석 참고)
    if(willOpen) bringWinToFront('myStatusChip');
    if(willOpen) _repositionOpenChipPopups();   // 첫 프레임 위치 즉시 계산(깜빡임 방지). 옮겨둔 자리가 있으면 그쪽을 씀
  });
  const head = document.getElementById('myPlHead');
  if(head){
    head.addEventListener('pointerdown', _plHeadPointerDown);
    head.addEventListener('dblclick', e=>{ e.stopPropagation(); _plResetPos(); });
  }
  function _plClose(){ box.classList.add('hidden'); btn.classList.remove('on'); _plCloseFriendPick(); _plCloseSetPick(); _plCloseGrabPick(); }
  /* ⎋ ESC 스택에 태운다 — 옛 캡처 핸들러(이 IIFE 끝에 있었다)를 대신한다. 그쪽 주석의 규약은
     그대로다: 바깥 클릭으로는 안 닫히고, 닫는 길은 ✕ 과 ESC 둘뿐이다.
     ★ 옛 핸들러와 달라진 것 하나 — **입력칸에서는 안 닫힌다.** bio 를 고치다 ESC 를 누르면
       창째로 닫혀서 "취소"가 안 먹던 자리가 이걸로 같이 고쳐진다(_escEditable). */
  escRegisterWindow({
    key:'playlist', el:box,
    isOpen:()=>!box.classList.contains('hidden'),
    close:_plClose,
  });
  function bind(id, fn){
    const b = document.getElementById(id);
    if(b) b.addEventListener('click', e=>{ e.stopPropagation(); fn(); });
  }
  bind('myPlClose', _plClose);
  bind('myPlMin', _plToggleMini);
  _plApplyMini();   // 지난번에 접어둔 채로 껐으면 그 상태로 열린다

  /* 🏠 프로필 사진 클릭 — 공개해 둔 남의 목록에서만 마이홈으로 넘어간다.
     ★ 친구가 아니어도 들어갈 수 있다(요청). openFriendHomeView 는 users/{uid}/home 을 읽는데
       그 경로의 .read 는 원래부터 열려 있어서 규칙 파일은 손대지 않아도 된다.
     ⚠️ 판정을 여기서 한 번 더 한다 — 소개칸이 .go 클래스를 잘못 달고 있어도 비공개 홈은 안 열린다. */
  (function bindPlAvatar(){
    const ava = document.getElementById('myPlAva');
    if(!ava) return;
    ava.addEventListener('click', e=>{
      e.stopPropagation();
      if(!_plView || !_plView.homePublic) return;
      openFriendHomeView(_plView.uid, _plView.name);
    });
  })();

  /* 🏠 마이홈 공개 토글 — 끌 때는 아무것도 묻지 않고, 켤 때만 무슨 일이 벌어지는지 한 줄 알린다.
     (되돌리기 쉬운 쪽은 조용히, 되돌리기 전까지 남에게 보이는 쪽은 말해준다) */
  (function bindPlPublic(){
    const pub = document.getElementById('myPlPub');
    if(!pub) return;
    pub.addEventListener('click', e=>e.stopPropagation());
    pub.addEventListener('change', ()=>{
      _plHomePublic = !!pub.checked;
      _plSave();
      _plRenderHead();
      toast(_plHomePublic ? '내 목록을 본 사람이 마이홈에 들어올 수 있어요' : '마이홈을 다시 비공개로 바꿨어요');
    });
  })();

  /* ✍️ bio 한마디 — 눌러서 고치고, Enter/포커스 잃음으로 저장, Esc 로 되돌린다. */
  /* ✏️ 예전의 bindPlTitle(제목줄 클릭 = 이름 고치기)은 **없앴다**(요청).
     그 줄은 창을 잡고 옮기는 손잡이라 편집과 겹쳤다. 이름을 고치는 문은 이제
     [프리셋 ▼] 목록의 [수정] 하나뿐이다 — _plRenderSetPick / _plStartRename 참고.
     ⚠️ 문을 다시 여기에 만들지 말 것. 둘이 되면 규약이 두 벌이 되고 한쪽만 고쳐진다.
     ⚠️ HTML 의 <input id="myPlTitleIn"> 도 같이 지웠다. 되살리려면 그쪽부터 볼 것
       (audit 검사 1 이 'HTML 에 없는 id 를 부르는가'를 본다 — 한쪽만 되살리면 거기서 걸린다). */
  (function bindPlBio(){
    const view = document.getElementById('myPlBioView'), edit = document.getElementById('myPlBioEdit');
    if(!view || !edit) return;
    view.addEventListener('click', e=>{ e.stopPropagation(); _plBioEditStart(); });
    edit.addEventListener('click', e=>e.stopPropagation());
    edit.addEventListener('input', _plBioCount);
    edit.addEventListener('blur', ()=>_plBioEditEnd(true));
    edit.addEventListener('keydown', e=>{
      e.stopPropagation();   // 창 단축키(스페이스=재생 등)가 타이핑을 가로채지 않게
      if(e.key === 'Enter'){ e.preventDefault(); _plBioEditEnd(true); }
      else if(e.key === 'Escape'){ e.preventDefault(); _plBioEditEnd(false); }
    });
  })();
  // 패널이 옮겨지거나 열고 닫힐 때마다 재생 창이 따라와 숨어야 한다. 드래그·캐스케이드·창크기 변경을
  // 전부 놓치지 않도록 가벼운 폴링으로 확인한다(바뀐 게 없으면 IPC를 보내지 않는다).
  setInterval(_plSyncBgmBounds, 300);
  bind('myPlAdd',   _plAdd);
  /* 🎵 [프리셋 ▼] — 고르기 목록을 여닫는다(요청 2). 여는 문은 이 버튼 하나다. */
  bind('myPlSetBtn', _plToggleSetPick);
  bind('myPlPeek',  _plPeek);
  /* 🌊 [파도타기] 우클릭 = 내 친구 중에서 골라 파도타기. 좌클릭(무작위)은 그대로다. */
  (function bindPlFriendPick(){
    const peek = document.getElementById('myPlPeek');
    if(!peek) return;
    peek.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); _plToggleFriendPick(); });
    peek.title = (peek.title || '') + '\n우클릭 — 친구 중에서 골라 파도타기';
  })();
  bind('myPlBack',  _plBack);
  // 📥 담기는 곡 행 안의 버튼이라 여기서 묶지 않는다(_plRender 가 행마다 달아 준다).
  /* 🗑 → ⌦ **Delete 키로 지운다**(요청 — 버튼은 HTML 에서 없앴고 그 자리는 음량바가 받았다).
     ★ 지우는 로직은 그대로 _plDel 이다 — 읽기전용(_plReadOnly)·선택범위 검사를 이미 자기가 한다.
       여기서 다시 판단하지 않는다(두 벌이 되면 한쪽만 고쳐지는 그 사고가 난다).
     ⚠️ **입력칸에서는 절대 먹으면 안 된다.** 이 창에는 bio 편집칸이 있고, 링크 추가는 프롬프트
       입력칸을 띄운다 — 거기서 Delete 는 '글자 지우기' 다. 캡처 단계는 입력칸 자신의 keydown
       보다 먼저 지나가므로 여기서 걸러야 한다(_escEditable — ESC 스택과 같은 판정을 쓴다).
     ⚠️ 창이 닫혀 있으면 손대지 않는다. 실행 화면 어디서 누른 Delete 든 이 창이 가로채면
       나중에 다른 곳에 Delete 를 붙일 때 원인을 못 찾는다.
     📌 남의 목록(파도타기 중)에서는 조용히 아무 일도 안 한다 — 지울 수 없는 게 정상이고,
       매번 토스트를 띄우면 파도타는 동안 Delete 를 누른 것마다 잔소리가 된다.
     📌 '이 창에 포커스가 있는가' 는 보지 않는다. 이 창은 포커스를 받는 요소가 거의 없어서
       (행은 div 다) 그 조건을 걸면 곡을 골라 놓고 Delete 를 눌러도 안 먹는다. 대신 위 셋으로
       좁힌다 — 열려 있고 · 입력칸이 아니고 · 골라 둔 곡이 있을 때만. */
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Delete') return;
    if(box.classList.contains('hidden')) return;
    if(_escEditable(e.target)) return;
    if(_plReadOnly() || _plSel < 0) return;
    e.preventDefault(); e.stopPropagation();
    _plDel();
  }, true);
  /* 🔒 비공개 토글 — change 로 받는다(클릭·스페이스·라벨 클릭이 전부 한 번씩만 온다).
     ⚠️ label 안의 input 이라 click 으로 받으면 라벨 클릭 때 두 번 들어온다.
     _plSave 가 로컬 저장과 서버 갱신(3초 debounce)을 함께 처리한다. */
  (function bindPlPrivate(){
    const box = document.getElementById('myPlPriv');
    if(!box) return;
    box.addEventListener('change', ()=>{
      _plPrivate = !!box.checked;
      _plSave();
      /* 문구가 '파도타기에서 사라져요'로만 끝나면 친구도 못 듣는 줄 안다 — 남는 길을 같이 말해준다. */
      try{ toast(_plPrivate ? '🔒 무작위 파도타기에서 빠졌어요 (친구는 우클릭으로 들을 수 있어요)'
                            : '🌊 파도타기에 내 목록이 다시 나와요'); }catch(_){}
    });
  })();
  bind('myPlPlay',  _plTogglePlay);
  bind('myPlStop',  _plStop);
  /* ⏭ — 사람이 넘긴 것이므로 자동 진행이 세던 연속 실패 수는 여기서 지운다.
     안 지우면 "못 트는 곡 몇 개를 손으로 넘겼다"는 것만으로 남은 정상 곡에서 재생이 멈춘다. */
  bind('myPlNext',  ()=>{ _plErrStreak = 0; _plSkipNext(); });
  /* 곡이 끝났다 / 재생할 수 없다 — main.js 가 주입 스크립트의 신호를 넘겨준다.
     ⚠️ 못 트는 곡만 있는 목록에서 무한 루프가 되지 않게 연속 실패 수를 센다. */
  if(window.companion && companion.onBgmTrackEnd) companion.onBgmTrackEnd(kind=>{
    /* 🔬 [플레이리스트] 진단 — "마지막 곡에서 안 되감긴다"를 한 줄로 가른다.
       이 줄이 안 찍히면 main 에서 신호가 안 온 것(주입 스크립트 문제),
       찍혔는데 모드가 '반복 끔'이면 상태가 풀린 것, 켜져 있는데 안 넘어가면 재생 요청 문제다. */
    if(typeof kind === 'string' && kind.indexOf('hb:') !== 0)
    try{ console.log('[플레이리스트] 신호=' + kind + ' 현재=' + _plNow + '/' + _plNowItems().length
      + ' 재생출처=' + (_plNowView ? ('파도타기[' + _plNowView.name + ']') : (_plNowSet + (_plNowSet === _plCur ? '' : '(보는 중 ' + _plCur + ')')))
      + ' 반복=' + (_plOn ? PL_KIND_LABEL[_plKind] : '끔')); }catch(_){}
    /* 💓 하트비트는 «곡이 끝났다»가 아니다 — 감시견에만 먹이고 여기서 끝낸다.
       ⚠️ 이 분기가 맨 위에 있어야 한다. 아래로 내려가면 하트비트마다 곡이 넘어간다. */
    if(typeof kind === 'string' && kind.indexOf('hb:') === 0){ _plWatchBeat(kind.slice(3)); return; }
    /* 🔁 한 곡 반복이 loop 로 한 바퀴 돌았다 — 곡이 제대로 나왔다는 증거라 연속 실패만 끊는다.
       ⚠️ 여기서 _plNext 를 부르면 안 된다. 이미 같은 곡이 처음부터 나오고 있다 — 부르면 같은 주소를 또 연다.
       ⚠️ 이 분기도 아래 일반 경로보다 **위**여야 한다. 내려가면 «곡 끝남»으로 읽혀 매 바퀴 곡을 다시 연다. */
    if(kind === 'loop'){ _plErrStreak = 0; return; }
    if(_plNow < 0) return;
    if(kind === 'err'){
      _plErrStreak += 1;
      if(_plErrStreak >= Math.max(1, _plNowItems().length)){
        _plStop();
        toast('🎵 재생할 수 있는 곡이 없어요');
        return;
      }
      toast('⏭ 재생할 수 없는 영상이라 넘겼어요');
    }else{
      _plErrStreak = 0;
    }
    _plNext();
  });
  // 창 소유권이 마이홈 BGM으로 넘어갔다 → 내 재생표시를 내린다(소리는 이미 저쪽 곡이다)
  if(window.companion && companion.onBgmMode) companion.onBgmMode(mode=>{
    if(mode !== 'playlist' && _plNow >= 0){ _plNow = -1; _plPlaying = false; _plNowView = null; _plWatchStop(); _plRender(); }
  });
  // 창이 닫혔다 (유저가 ✕ 또는 마이홈 종료)
  if(window.companion && companion.onBgmClosed) companion.onBgmClosed(()=>{
    if(_plNow >= 0){ _plNow = -1; _plPlaying = false; _plNowView = null; _plWatchStop(); _plRender(); }
  });
  bind('myPlLoop',  ()=>{
    _plOn = !_plOn;
    _plShufBag = [];
    _plSyncLoop();   // 🔁 재생 중이면 지금 곡부터 따른다
    _plSave(); _plRender();
    toast(_plOn ? ('🎵 ' + PL_KIND_LABEL[_plKind]) : '🎵 반복 끔');
  });
  /* 우클릭 — 종류만 바꾼다. 켬/끔은 건드리지 않는다.
     ⚠️ preventDefault 를 빼면 Electron 기본 컨텍스트 메뉴가 뜬다.
     ⚠️ stopPropagation 도 필요하다 — 상태칩 팝업들이 바깥 클릭으로 닫히는 구조라
       여기서 안 막으면 종류를 바꾸는 순간 창이 닫힌다. */
  const _loopBtn = document.getElementById('myPlLoop');
  if(_loopBtn) _loopBtn.addEventListener('contextmenu', e=>{
    e.preventDefault(); e.stopPropagation();
    _plKind = (_plKind + 1) % 3;
    _plShufBag = [];
    _plSyncLoop();   // 🔁 재생 중이면 지금 곡부터 따른다
    _plSave(); _plRender();
    toast('🎵 ' + PL_KIND_LABEL[_plKind] + (_plOn ? '' : ' (반복 꺼짐 — 좌클릭으로 켜기)'));
  });
  /* 🔊 음량 — 값이 바뀔 때마다 자식창에 보낸다(가볍다). 저장만 묶어서 늦춘다.
     ⚠️ companion.setBgmVolume 은 preload.js 에 노출돼 있어야 한다. 없으면 슬라이더는 움직이지만
       소리는 안 바뀐다 — 조용히 실패하지 않게 한 번만 알려준다. */
  const _volIn = document.getElementById('myPlVol');
  if(_volIn){
    let _volT = null, _volWarned = false;
    _volIn.addEventListener('input', ()=>{
      _plVol = Math.max(0, Math.min(100, parseInt(_volIn.value, 10) || 0));
      _volIn.title = '음량 ' + _plVol + '%';
      if(window.companion && companion.setBgmVolume) _plApplyVol();
      else if(!_volWarned){ _volWarned = true;
        toast('음량 조절은 앱을 재시작한 후에 적용돼요'); }
      if(_volT) clearTimeout(_volT);
      _volT = setTimeout(()=>{ _volT = null; _plSave(); }, 400);
    });
  }
  _plApplyVol();   // 부팅 직후 한 번 — main이 기억해 두면 첫 곡부터 이 값으로 시작한다
  /* 🎵 **바깥 클릭으로는 닫지 않는다.**
     ⚠️ 예전엔 다른 칩 팝업과 같은 규칙(바깥 클릭=닫힘)이었다. 그런데 이 창은 '지나가는 메뉴'가
       아니라 **음악을 틀어두고 계속 켜 두는 창**이다. 곡을 고르고 잠깐 딴 데를 누르면 사라져서,
       들을 때마다 다시 열어야 했다(제보).
       닫는 길은 이제 둘뿐이다 — 제목줄의 ✕ 과 Esc.
     ⚠️ 남는 자동 닫힘 경로는 **둘**이다. 셋 중 하나(다른 칩 팝업을 열 때)는
       _CHIP_POPUPS 의 keep:true 로 없앴다 — ▼ 더보기·상태 메뉴를 열어도 안 닫힌다:
       ① Tab 으로 상태칩을 접을 때
       ② 오피스 모드에서 화면을 숨길 때 (_closeChipPopups(null,true) — 그쪽 주석 참고)
     ⎋ **Esc 는 이제 여기서 처리하지 않는다.** 위 escRegisterWindow('playlist') 로 ESC 스택이
       가져갔다 — 창 다섯 개가 다 열려 있을 때 "연타하면 하나씩" 을 지키려면 순서를 아는 곳이
       하나여야 하고, 여기 캡처 핸들러가 남아 있으면 그 결정을 앞질러 가로챈다. */
})();

/* 🪟 window 고리 — 예전엔 app.js 최상위 function 선언이라 저절로 전역이었다. 아래 둘이 그 이름에 typeof 를 걸고 부른다.
     · _repositionOpenChipPopups(상태칩 팝업 자리 — 만드는 줄보다 위에 선언) — _plHasSavedPos · _plApplyPos
     · noise.js(🌙 백색소음 접기/펴기 — app.js 뒤에 실림) — _plApplyPos · _plSyncBgmBounds
   ⚠️ 부르는 곳을 plMod.이름 으로 바꾸지 말 것 — 만들기 전에 불리면 const plMod 가 TDZ 라 typeof 로도 못 막는다. */
try{ window._plHasSavedPos = _plHasSavedPos; window._plApplyPos = _plApplyPos; window._plSyncBgmBounds = _plSyncBgmBounds; }catch(_){}

/* 상태 묶음 — 밖에서 읽고 쓰던 let 을 같은 이름(접두사 _pl 만 뺀)으로. getter · setter 라 읽는 쪽 · 쓰는 쪽 줄 모양이 예전과 같다. */
const st = {
  get sets(){ return _plSets; },           set sets(v){ _plSets = v; },
  get cur(){ return _plCur; },             set cur(v){ _plCur = v; },
  get nowSet(){ return _plNowSet; },       set nowSet(v){ _plNowSet = v; },
  get sel(){ return _plSel; },             set sel(v){ _plSel = v; },
  get now(){ return _plNow; },             set now(v){ _plNow = v; },
  get view(){ return _plView; },           set view(v){ _plView = v; },
  get nowView(){ return _plNowView; },     set nowView(v){ _plNowView = v; },
  get bio(){ return _plBio; },             set bio(v){ _plBio = v; },
  get homePublic(){ return _plHomePublic; }, set homePublic(v){ _plHomePublic = v; },
  get private(){ return _plPrivate; },     set private(v){ _plPrivate = v; },
  get pubSig(){ return _plPubSig; },       set pubSig(v){ _plPubSig = v; },
  get playing(){ return _plPlaying; },     set playing(v){ _plPlaying = v; },
  get lastBoundsKey(){ return _plLastBoundsKey; }, set lastBoundsKey(v){ _plLastBoundsKey = v; },
};

return {
  st,                                              // 상태 묶음 — 계정 이어받기 복원 · 로그아웃 · 📷 재생 재우기 · 화면 배율
  PL_MAX, PL_BIO_MAX, PL_TITLE_MAX,                // 상한 — 계정 이어받기 복원이 같은 값으로 깎는다
  render: _plRender,                               // 🎵 창 다시 그리기 — 계정 이어받기 · 📷 재생 재우기/되살리기
  save: _plSave,                                   // 💾 로컬 저장 + 서버 사본(3초 debounce) — 계정 이어받기
  publish: _plPublish,                             // ☁️ 서버 사본만 — 계정 이어받기(저쪽이 비었을 때)
  markSynced: _plMarkSynced,                       // ☁️ 기기 간 맞추기를 계정 이어받기가 끝냈다(이 기기 것을 올릴 때)
  adoptServer: _plAdoptServer,                     // ☁️ 서버 사본을 앉히기 — 계정 이어받기(부팅 맞추기와 한 벌)
  resetSync: _plResetSync,                         // ☁️ 계정을 놓을 때 — 고친 시각 · 맞춤 상태를 새 기기처럼
  bootSync: _plBootSync,                           // ☁️ 검사용 — 부팅 맞추기 한 번
  normalizeSets: _plNormalizeSets,                 // 🎵 저장값 관문(세 벌 · 16자 · 20곡) — 계정 이어받기
  setIdx: _plSetIdx,                               // 🎵 프리셋 번호 보정 — 계정 이어받기
  blankSets: _plBlankSets,                         // 🎵 빈 세 벌 — 로그아웃
  pubSigOf: _plPubSigOf,                           // ☁️ 서버 사본 지문 — 계정 이어받기(헛쓰기 막기)
  mine: _plMine,                                   // 🎵 보고 있는 프리셋의 곡 — 계정 이어받기(옛 길)
  fillLv: _plFillLv,                               // 🏅 레벨 배지 — 👤 내 정보 머리
  ytVideoId: _ytVideoId,                           // 🔗 유튜브 주소 → 영상 id — 🏠 마이홈 BGM(파서 한 벌)
  syncBgmBounds: _plSyncBgmBounds,                 // 🪟 재생 창 사각형 — 화면 배율 바뀜
  // 검사용
  PL_SETS,
  load: _plLoad,
  mineOf: _plSetItems,
  setLabel: _plSetLabel,
  windowTitle: _plWindowTitle,
  nowTitle: _plNowTitle,
  grabBlock: _plGrabBlock,
  grabSong: _plGrabSong,
  grabTo: _plGrabTo,
  openGrabPick: _plOpenGrabPick,
  closeGrabPick: _plCloseGrabPick,
  switchSet: _plSwitchSet,
  playFrom: _plPlayFrom,
  togglePlay: _plTogglePlay,
  stop: _plStop,
  next: _plNext,
  skipNext: _plSkipNext,
  watchBeat: _plWatchBeat,
  watchTick: _plWatchTick,
  state: ()=>({ sets: _plSets, cur: _plCur, nowSet: _plNowSet, sel: _plSel, now: _plNow, view: _plView, nowView: _plNowView,
    on: _plOn, kind: _plKind, vol: _plVol, bio: _plBio, homePublic: _plHomePublic, private: _plPrivate, mini: _plMini,
    playing: _plPlaying, errStreak: _plErrStreak, pos: _plPos, pubSig: _plPubSig }),
};
}

const api = { createPlaylist };
if(typeof window !== 'undefined') window.TwPlaylist = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
