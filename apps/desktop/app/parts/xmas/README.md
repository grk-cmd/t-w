# xmas — 🎄 크리스마스 이벤트(2026 · 일회성)

런처 [🎄 크리스마스] → 크리스마스 창. 함께 꾸미는 3D 트리(장식 1개 · 한마디 · 300개씩 채널) · 마니또 편지(5통 · 25일에 쓴 사람끼리 · 추천곡).
기획 정본은 이슈 #963, 서버는 `firebase/functions/xmas.js` · 규칙 `xmas*`(#964 · #966).

**걷기**: 이벤트가 끝나면 다음 업데이트에서 이 폴더 · html 의 `#xmasOverlay` · `#lcXmas` · CSS `#xmas*` · `.xm-*` · 스크립트 줄 여섯 · app.js 의 `TwXmasWindow.createXmasWindow` 줄 ·
firebase-init 의 `xmas:` · `applyDesktopRunClass` 의 `xmasOv` 줄 · `UI_HIT_SEL` · `OPEN_MODAL_SEL` 의 `#xmasOverlay` · 오류 코드 `E-XMAS-*`(→ `RETIRED`) · 검사 `sim-xmas-*` ·
main.js 배경음악 창의 주인 `'xmas'`(`bgmPanelMode` · `companion:openXmasSong`) · preload `openXmasSong` · nav.js `XMAS`(sim-nav OWNER) · 알림함 태그 `xmas`(inbox-sections `tagOf` · myhome-inbox 아이콘 · 이름 · 누르기) 를 걷는다.
(`NAV.MY_HOME_CLOSE` 는 크리스마스 전용이 아니다 — 부르는 곳이 없어지면 sim-nav 가 알려 준다.)
버튼은 1월 1일 0시(서버 시각)부터 저절로 숨는다.

## xmas-rules.js — 순수 규칙
- **책임**: 편지 칸 · 반송 사유(서버 `RETURN_REASONS` 와 같음) · 받은 편지 다듬기 · 마감 D-day(한국 날짜) · 읽음 표시 · 날짜 판정(`eventOn` · `letterOpen` · `lettersArrived`) · 한마디 다듬기(`cleanWord` — 서버와 같음) · 장식 자리(`slotPositions` — 같은 n 이면 늘 같은 자리) · 다시 받을 그림(`changedImgSlots` — 판이 **다른** 자리) · 바꾸기 간격(`cooldownLeft` 5초) · 반짝임 10번(`blinkOpacity`) · 10번 누르기(`createTaps`) · 흔들기(`createShake`).
- **함정**: 마감 · 끝 시각 · 300 · 30자 · 64px 는 서버(`functions/xmas.js`)와 같아야 한다 — `sim-xmas-rules` 가 서버 모듈을 불러 견준다.
- 검사: `sim-xmas-rules.js`

## xmas-net.js — 서버 읽기 · 쓰기(provider)
- **만드는 법**: firebase-init 이 `firebaseAPI.xmas = TwXmasNet.createXmasNet({ db, ref, get, set, serverTimestamp, authUid, callFn })`.
- **내놓는 것**: `me()` · `where()`(지금 트리 · 내 자리) · `tree(t)`(장식 목록) · `img(t, s)`(그림 한 자리) · `hang(data)`(함수 `xmasHang`) · `reportOrnament(t, s, note)` · 편지 `myLetters()` · `saveLetter(lid, text, song)` · `removeLetter(lid)` · `clearReturned(lid)` · `got()` · `reportLetter(n, note)`.
- **함정**: 읽기는 하위 경로만 — 트리 통째(`xmasTrees/{t}`) · 그림 통째(`xmasImg/{t}`) 읽기 금지. 편지는 내 칸(`xmasLetters` · `xmasReturned` · `xmasGot/{내 uid}`)만. 상시 구독 없음. 던지지 않고 `{ ok:false, code }` — 쓰기 권한 거절은 편지면 `closed`(마감 뒤) · 신고면 `dup`, 가입 전(익명)은 쓰지 않고 `auth`.
- 검사: `sim-xmas-net.js`

## xmas-tree.js — 3D 트리
- **책임**: 트리 · 장식 그리기(세로 300 도트 · 색 31단계 · 디더 절반) · 끌어 돌리기 · 휠 확대(1~3배 · 마우스 자리 중심 · 처음보다 작게는 안 됨) · 한마디 라벨 자리(왼클릭만) · 이스터에그(10번 누르기 · 흔들기 — 이 화면에서만 · 저장 안 함) · 내 장식 반짝임 10번 · 우클릭 신고(남의 장식만 — 내 장식이 겹쳐도 뒤의 것).
- **내놓는 것**: `createXmasTree({ THREE, rules, ps1Dither })` → `{ open(canvas), close(), setOrnaments(list), onSay(fn), onReport(fn) }` · `baseCanvas(kind, doc)`(기본 장식 16칸 그림 — 고르기 단추도 같은 그림).
- **함정**: 창마다 WebGL 컨텍스트를 하나 잡는다 — `close()` 에서 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러를 꼭 버린다. 장식은 `sizeAttenuation:false` · 내 장식은 `depthTest:false` + `renderOrder 999`(늘 앞).
- 검사: `sim-xmas-tree.js`(WebGL 없이 볼 수 있는 것 — 실제 그림은 브라우저로 확인)

## xmas-song.js — 편지 추천곡 뮤직바
- **책임**: 마이홈 BGM 위젯과 같은 모양 · 같은 동작의 바 — [▶ / ▐▐][긴 제목 흐름][((o 링크 · 제목 넣기(쓰기 칸만)]. 바가 여럿이어도 재생은 한 곡(컨트롤러 하나).
- **만드는 법**: xmas-window 가 `TwXmasSong.createXmasSong({ doc, win, companion, ytVideoId, asyncPrompt, toast, songTitleMax })` → `{ bar(el, { editable, onChange }), stop(), playing() }`.
- **함정**: 소리는 공용 배경음악 창 하나 — 주인 `'xmas'`(main.js `bgmOpen` · 패널 뒤에 숨고 · 신호 없이 되풀이)로 연다. 나중에 튼 쪽이 이긴다: `onBgmMode`(다른 주인) · `onBgmClosed` 면 ▶ 로. `stop()` 은 내가 주인일 때만 창을 닫는다(남의 곡을 끊지 않게). 재생 창 알림은 처음 틀 때 건다(앱 밖엔 companion 이 없다). 곡 제목은 남이 쓴 값 — `textContent` 로만.
- 검사: `sim-xmas-song.js`(main.js · preload 의 `'xmas'` 주인까지)

## xmas-letter.js — 마니또 편지 창
- **책임**: 트리 창 아래 [편지 쓰기 (n/5)] · [편지 열람] · 그 위에 겹쳐 뜨는 편지 창(✕ · Esc). ✍️ 쓰기(12/24 23:59 까지 — 맡긴 목록 · 고치기 · 거두기 · 새 편지 · 반송된 편지의 사유 · 다시 쓰기 · 지우기 · 운영자 확인 안내 한 줄) · 📬 열람(12/25 부터 — 봉투 · 열기 · 추천곡 · 신고 · 읽음) · 빨간 점(런처 [크리스마스] · [편지 열람]).
- **만드는 법**: xmas-window 가 `TwXmasLetter.createXmasLetter({ doc, rules, net, song, serverNow, toast, notifyError, escRegisterWindow, storage, onDot })` → `{ open, close, isOpen, refresh, checkGot, paintBtn }`.
- **함정**: 반송을 다시 쓰면 **빈 칸**에 맡긴 뒤 반송 표시를 치운다(반송 칸에 새 편지가 있을 수 있다 · 맡기기가 실패하면 표시를 남긴다). 받은 편지 확인은 25일 0시 뒤 — 짝 짓기가 늦을 수 있어 한 시간만 5분 간격으로 다시 보고 그 뒤엔 앱을 켤 때 한 번(편지를 안 쓴 사람이 계속 읽지 않게). 실패는 세지 않는다 — 앱을 켠 직후엔 로그인 복원 전이라 `auth` 로 오므로 다음 1분에 다시(그 밖 실패는 5분 뒤) · 계정이 바뀌면 앞 계정의 점을 지우고 처음부터. 읽음 표시는 이 PC `tw.xmasGotRead.{uid}`(번호 몇 개). 받은 글 · 곡 제목은 `textContent` 로만.
- 오류 코드: `E-XMAS-04`(편지 못 불러옴) · `E-XMAS-05`(맡기기 · 고치기 · 거두기 · 반송 표시 치우기 실패) · `E-XMAS-06`(편지 신고 못 보냄)
- 검사: `sim-xmas-letter.js`

## xmas-window.js — 크리스마스 창
- **책임**: 런처 버튼(서버 시각 1월 1일 0시부터 숨김 · 1분마다 다시 봄) · 창 열고 닫기 · 내 트리(없으면 지금 트리 미리 보기) 불러오기 · 그림 사본(GLB 영구 캐시 IndexedDB · 키 `xmasimg:{트리}/{자리}@{판}` — 판이 같으면 안 받음 · 45일 뒤 저절로 치움 · ⚠️ localStorage 금지 — 트리 하나가 수 MB) · 장식 고르기 · 내 그림 올리기(64px · 넘치면 48 · 32 PNG) · 한마디 · 달기 / 바꾸기(5초 간격) · «트리가 이미 다 차버렸어요» · 장식 신고 확인창.
- **만드는 법**: app.js `TwXmasWindow.createXmasWindow({ THREE, ps1Dither, rules, treeMod, net: ()=>firebaseAPI.xmas, serverNow, onReady, notifyError, toast, escRegisterWindow, onSizeChange: ()=>applyDesktopRunClass(), idbGet, idbPut, songMod, letterMod, companion, ytVideoId, asyncPrompt, storage, twNav })` — 편지 창 · 뮤직바를 여기서 만든다. 밖에서 부르는 이름 없음 — 📩 알림함은 창 열기 통로 `NAV.XMAS`(`'letter'` 면 편지 창까지)로 연다(마이홈과 같은 층이라 `NAV.MY_HOME_CLOSE` 로 마이홈을 먼저 닫는다).
- **함정**: Esc 는 트리 창을 편지 창보다 **먼저** 등록한다 — 알림함 길은 두 창을 같은 틱에 열어 창 쌓기가 등록 순서로 쌓는다(거꾸로면 Esc 에 트리 창이 통째로 닫힌다). 남이 쓴 한마디는 `textContent` 로만, 받은 그림 주소는 `TwSafeHtml.safeUrl(d, 'image')` 로 거른다. 닫은 뒤 늦게 온 답은 버린다(`seq`). 런처에서 열면 창 크기를 마이홈 크기로(`applyDesktopRunClass` 가 `#xmasOverlay.on` 을 본다).
- 로그인 안 됨: 트리는 «로그인한 뒤 트리를 볼 수 있어요»(오류 코드 아님) · 신고는 «로그인한 뒤 신고할 수 있어요»(가입 전 익명은 net 이 쓰기 전에 auth 로).
- 오류 코드: `E-XMAS-01`(못 불러옴) · `E-XMAS-02`(장식 못 걺) · `E-XMAS-03`(신고 못 보냄)
- 검사: `sim-xmas-window.js`(가짜 화면 · 가짜 서버로 흐름을 돌린다)
