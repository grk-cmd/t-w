# xmas — 🎄 크리스마스 이벤트(2026 · 일회성)

런처 [🎄 크리스마스] → 크리스마스 창. 함께 꾸미는 3D 트리(장식 1개 · 한마디 · 300개씩 채널) · 마니또 편지(다음 PR).
기획 정본은 이슈 #963, 서버는 `firebase/functions/xmas.js` · 규칙 `xmas*`(#964 · #966).

**걷기**: 이벤트가 끝나면 다음 업데이트에서 이 폴더 · html 의 `#xmasOverlay` · `#lcXmas` · CSS `#xmas*` · app.js 의 `TwXmasWindow.createXmasWindow` 줄 ·
firebase-init 의 `xmas:` · `applyDesktopRunClass` 의 `xmasOv` 줄 · `UI_HIT_SEL` · `OPEN_MODAL_SEL` 의 `#xmasOverlay` · 오류 코드 `E-XMAS-*`(→ `RETIRED`) · 검사 `sim-xmas-*` 를 걷는다.
버튼은 1월 1일 0시(서버 시각)부터 저절로 숨는다.

## xmas-rules.js — 순수 규칙
- **책임**: 날짜 판정(`eventOn` · `letterOpen` · `lettersArrived`) · 한마디 다듬기(`cleanWord` — 서버와 같음) · 장식 자리(`slotPositions` — 같은 n 이면 늘 같은 자리) · 다시 받을 그림(`changedImgSlots` — 판이 **다른** 자리) · 바꾸기 간격(`cooldownLeft` 5초) · 반짝임 10번(`blinkOpacity`) · 10번 누르기(`createTaps`) · 흔들기(`createShake`).
- **함정**: 마감 · 끝 시각 · 300 · 30자 · 64px 는 서버(`functions/xmas.js`)와 같아야 한다 — `sim-xmas-rules` 가 서버 모듈을 불러 견준다.
- 검사: `sim-xmas-rules.js`

## xmas-net.js — 서버 읽기 · 쓰기(provider)
- **만드는 법**: firebase-init 이 `firebaseAPI.xmas = TwXmasNet.createXmasNet({ db, ref, get, set, serverTimestamp, authUid, callFn })`.
- **내놓는 것**: `where()`(지금 트리 · 내 자리) · `tree(t)`(장식 목록) · `img(t, s)`(그림 한 자리) · `hang(data)`(함수 `xmasHang`) · `reportOrnament(t, s, note)`.
- **함정**: 읽기는 하위 경로만 — 트리 통째(`xmasTrees/{t}`) · 그림 통째(`xmasImg/{t}`) 읽기 금지. 상시 구독 없음. 던지지 않고 `{ ok:false, code }`.
- 검사: `sim-xmas-net.js`

## xmas-tree.js — 3D 트리
- **책임**: 트리 · 장식 그리기(세로 300 도트 · 색 31단계 · 디더 절반) · 끌어 돌리기 · 휠 확대(1~3배 · 마우스 자리 중심 · 처음보다 작게는 안 됨) · 한마디 라벨 자리(왼클릭만) · 이스터에그(10번 누르기 · 흔들기 — 이 화면에서만 · 저장 안 함) · 내 장식 반짝임 10번 · 우클릭 신고(남의 장식만 — 내 장식이 겹쳐도 뒤의 것).
- **내놓는 것**: `createXmasTree({ THREE, rules, ps1Dither })` → `{ open(canvas), close(), setOrnaments(list), onSay(fn), onReport(fn) }` · `baseCanvas(kind, doc)`(기본 장식 16칸 그림 — 고르기 단추도 같은 그림).
- **함정**: 창마다 WebGL 컨텍스트를 하나 잡는다 — `close()` 에서 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러를 꼭 버린다. 장식은 `sizeAttenuation:false` · 내 장식은 `depthTest:false` + `renderOrder 999`(늘 앞).
- 검사: `sim-xmas-tree.js`(WebGL 없이 볼 수 있는 것 — 실제 그림은 브라우저로 확인)

## xmas-window.js — 크리스마스 창
- **책임**: 런처 버튼(서버 시각 1월 1일 0시부터 숨김 · 1분마다 다시 봄) · 창 열고 닫기 · 내 트리(없으면 지금 트리 미리 보기) 불러오기 · 그림 사본(GLB 영구 캐시 IndexedDB · 키 `xmasimg:{트리}/{자리}@{판}` — 판이 같으면 안 받음 · 45일 뒤 저절로 치움 · ⚠️ localStorage 금지 — 트리 하나가 수 MB) · 장식 고르기 · 내 그림 올리기(64px · 넘치면 48 · 32 PNG) · 한마디 · 달기 / 바꾸기(5초 간격) · «트리가 이미 다 차버렸어요» · 장식 신고 확인창.
- **만드는 법**: app.js `TwXmasWindow.createXmasWindow({ THREE, ps1Dither, rules, treeMod, net: ()=>firebaseAPI.xmas, serverNow, onReady, notifyError, toast, escRegisterWindow, onSizeChange: ()=>applyDesktopRunClass(), idbGet, idbPut })` — 밖에서 부르는 이름 없음.
- **함정**: 남이 쓴 한마디는 `textContent` 로만, 받은 그림 주소는 `TwSafeHtml.safeUrl(d, 'image')` 로 거른다. 닫은 뒤 늦게 온 답은 버린다(`seq`). 런처에서 열면 창 크기를 마이홈 크기로(`applyDesktopRunClass` 가 `#xmasOverlay.on` 을 본다).
- 오류 코드: `E-XMAS-01`(못 불러옴) · `E-XMAS-02`(장식 못 걺) · `E-XMAS-03`(신고 못 보냄)
- 검사: `sim-xmas-window.js`(가짜 화면 · 가짜 서버로 흐름을 돌린다)
