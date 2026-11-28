# xmas — 🎄 크리스마스 이벤트(2026 · 일회성)

런처 [🎄 크리스마스] → 크리스마스 창. 함께 꾸미는 3D 트리(장식 1개 · 한마디 · 300개씩 채널) · 마니또 편지(한 사람 한 통 · 25일에 쓴 사람끼리 · 추천곡).
기획 정본은 이슈 #963, 서버는 api `xmas` 컨텍스트(#1097 · 설계 tw-docs `docs/design/11-xmas.md`) — 옛 `firebase/functions/xmas.js` · 규칙 `xmas*`(#964 · #966)는 이벤트 뒤 걷는다.

**걷기**: 이벤트가 끝나면 다음 업데이트에서 이 폴더 · html 의 `#xmasOverlay` · `#lcXmas` · CSS `#xmas*` · `.xm-*` · 스크립트 줄 여덟 · app.js 의 `TwXmasWindow.createXmasWindow` 줄 ·
음악 파일 `xmas-bgm*.mp3` 여섯 · html css `body:has(#xmasOverlay.on)` 세 줄(트리 창이 뜨면 런처 카드 · 스크롤 막대 숨김) · `shared/panel-fit.js` `fitTopLeft`(다른 곳이 안 쓰면 — sim-panel-fit 1-2절도) · program-settings 의 `onOfficeModeChanged`(app.js deps 한 줄) · 글꼴 `vendor/galmuri`(`third-party-notices.js` VENDOR · `oss-notices.js` 다시 만들기) · 저장 키 `tw.xmasBgmMuted`(account-store 기기 칸) · firebase-init 의 `xmas:` · `applyDesktopRunClass` 의 `xmasOv` 줄 · `UI_HIT_SEL` · `OPEN_MODAL_SEL` 의 `#xmasOverlay` · 오류 코드 `E-XMAS-*`(→ `RETIRED`) · 검사 `sim-xmas-*` ·
main.js 배경음악 창의 주인 `'xmas'`(`bgmPanelMode` · `companion:openXmasSong`) · preload `openXmasSong` · nav.js `XMAS`(sim-nav OWNER) · 알림함 태그 `xmas`(inbox-sections `tagOf` · myhome-inbox 아이콘 · 이름 · 누르기) 를 걷는다.
(`NAV.MY_HOME_CLOSE` 는 크리스마스 전용이 아니다 — 부르는 곳이 없어지면 sim-nav 가 알려 준다.)
버튼은 받은 편지 열람 끝(2027-01-06 0시 · 서버 시각)부터 저절로 숨는다. 장식 · 신고는 이벤트 끝(1월 1일 0시)에 막힌다.

> 0.14.0: 서버는 api 의 `xmas` 컨텍스트(#1097 · tw-docs `docs/design/11-xmas.md`). app.js 가 `TwServerFeatures.on('xmas')` 일 때만 창을 만들고, net 은 `xmas-api.js`. 저장소(storage)는 값으로 받는다.

## xmas-rules.js — 순수 규칙
- **책임**: 편지 칸 · 반송 사유(서버 `RETURN_REASONS` 와 같음) · 받은 편지 다듬기 · 마감 D-day(한국 날짜) · 읽음 표시 · 날짜 판정(`eventOn` · `letterOpen` · `lettersArrived` · `buttonOn` · `inDeliveryWindow` — 날짜 한 벌 `s` 를 받고, 안 주면 처음 값 `SCHEDULE` · 서버 값은 `scheduleOf`) · 한마디 다듬기(`cleanWord` — 서버와 같음) · 장식 자리(`slotPositions` — 같은 n 이면 늘 같은 자리) · 다시 받을 그림(`changedImgSlots` — 판이 **다른** 자리) · 바꾸기 간격(`cooldownLeft` 5초) · 반짝임 10번(`blinkOpacity`) · 10번 누르기(`createTaps`) · 흔들기(`createShake`).
- **함정**: 날짜의 정본은 서버 `GET /v2/xmas/trees/current`(`letterDeadline` · `eventEnd` · `lettersViewUntil`)다. 처음 값과 상한은 아래 표와 같아야 한다 — 서버 저장소가 비공개라 표를 여기 옮겨 적고 `sim-xmas-rules` 가 이 표를 읽어 견준다(한마디 다듬기 · 사유 표는 아직 `functions/xmas.js` 와 견준다).

  서버와 같은 숫자(tw-docs `docs/design/11-xmas.md` 1-1 · 1-2):

  | 이름 | 값 | 뜻 |
  |---|---|---|
  | `LETTER_DEADLINE_MS` | 1798124400000 | 2026-12-25 00:00 KST — 편지 마감 · 짝 짓기 |
  | `EVENT_END_MS` | 1798729200000 | 2027-01-01 00:00 KST — 장식 · 신고 막힘 |
  | `LETTERS_VIEW_UNTIL_MS` | 1799161200000 | 2027-01-06 00:00 KST — 받은 편지 열람 · 런처 버튼 끝 |
  | `TREE_MAX` | 300 | 트리 하나의 자리 |
  | `WORD_MAX` | 30 | 한마디 |
  | `IMG_PX` | 64 | 그림 가로 · 세로 |
- 검사: `sim-xmas-rules.js`

## xmas-api.js — 서버 endpoint provider
- **책임**: 트리(`GET /v2/xmas/trees/current` · `/{t}/ornaments` — 모두에게 같은 응답 · 서버가 몇 초 캐시) · 내 몫(`GET /v2/me/xmas`) · 장식(`PUT /v2/me/xmas/ornament`) · 편지(`PUT` · `DELETE /v2/me/xmas/letters/{lid}` · `DELETE /v2/me/xmas/returned/{lid}`) · 신고(`POST /v2/xmas/reports`) · 그림 바이트(Storage `xmas/{imageId}.png?alt=media` — api 를 거치지 않는다). 서버 모양 → 화면 모양(장식 `{ k, v, w, id }`) · 서버 오류 이름 → 옛 code(`ERROR_CODES` — 설계 6-4)는 여기 한 곳.
- **만드는 법**: app.js 가 `TwXmasApi.createXmasApi({ authed: TwApi.authed, rules: TwXmasRules, myCode, storageBucket, fetch, warn })` 한 번 → 크리스마스 창의 `net`.
- **내놓는 것(16)**: `refreshSchedule()`(날짜 한 벌만 한 번 — 켤 때 마감 앞뒤 하루에만 app.js 가 부른다) · `reset()`(세션이 끝나면 판 기억 · 날짜를 버린다) · `me()`(읽음 표시 열쇠 — 내 사람 코드) · `where()` · `tree(t)` · `img(imageId)`(PNG data URL) · `hang(data)` · `reportOrnament(t, s, note)` · `reportLetter(n, note)` · `myLetters()` · `saveLetter(lid, text, song, fromReturned)` · `removeLetter(lid)` · `clearReturned(lid)` · `got()`(받은 편지 + `matched`) · `schedule()`(마지막으로 읽은 날짜 한 벌 · 못 읽었으면 null) · `scheduleNow()`(날짜 판정에 쓸 한 벌 — 못 읽었으면 처음 값 · 창과 mail-feed 기다림이 같이 쓴다).
- **함정**: 신고 · 반송 표시 지우기도 쓰기처럼 읽은 토큰의 주인과 묶는다(앞 계정의 열린 창이 새 계정 토큰으로 보내지 않게). 판(`version`)은 여기서 기억한다 — 쓰기는 마지막으로 읽은(쓴) 판을 싣고 읽은 토큰의 주인과 묶는다(`expectOwner`). 409 `CONCURRENT_UPDATE` 는 다시 보내지 않고 `conflict` — 화면이 다시 읽는다. 가입 전(`USER_CODE_NOT_BOUND`)은 트리를 그리고 내 장식 없음. 그림 id 는 `^[0-9a-f]{32}$` 만 · 16KB 넘는 바이트는 버린다. 던지지 않고 `{ ok:false, code }`.
- 검사: `sim-xmas-api.js`

## xmas-tree.js — 3D 트리
- **책임**: 트리 · 장식 그리기(세로 300 도트 · 색 31단계 · 디더 절반) · 끌어 돌리기 · 휠 확대(1~3배 · 마우스 자리 중심 · 처음보다 작게는 안 됨) · 한마디 라벨 자리(왼클릭만) · 이스터에그(10번 누르기 · 흔들기 — 이 화면에서만 · 저장 안 함) · 내 장식 반짝임 10번 · 우클릭 신고(남의 장식만 — 내 장식이 겹쳐도 뒤의 것).
- **내놓는 것**: `createXmasTree({ THREE, rules, ps1Dither })` → `{ open(canvas), close(), setOrnaments(list), onSay(fn), onReport(fn) }` · `baseCanvas(kind, doc, tint)`(기본 장식 16칸 그림 — 고르기 단추도 같은 그림 · 점 그림을 16칸 가운데로) · `dotsOffset(rows, size)`(그 가운데 맞춤 칸 수) · `ornScale(n, max)`(걸린 장식 수 → 크기 배율 · 60개까지 1 · 꽉 차면 0.7) · `ornLook(kind, slot)`(트리 위 기본 장식 모양 — 자리 번호로 정함: 양말 뒤집기 · ±30도, 사탕 지팡이 ±30도, 구슬 · 선물 상자 색 번호) · `ORN_TINTS`(구슬 · 상자 색표 — 0 번은 그림 그대로) · `faceZ(x, z, yaw)` · `BACK_HIDE`(장식이 트리 앞쪽인지 — 뒤로 넘어간 남의 장식은 그리지도 누르지도 않는다 · 깊이 당김 때문에 비쳐 보여서 · 내 장식은 늘 앞) · `popOut(shader)`(장식 재질 onBeforeCompile — 깊이만 판 반지름만큼 카메라 쪽으로 · three r128 스프라이트 셰이더의 `#include <logdepthbuf_vertex>` 자리에 끼운다 · three 판을 올리면 sim-xmas-tree 가 본다).
- **함정**: 창마다 WebGL 컨텍스트를 하나 잡는다 — `close()` 에서 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러를 꼭 버린다. 장식은 `sizeAttenuation:false` · 내 장식은 `depthTest:false` + `renderOrder 999`(늘 앞).
- 검사: `sim-xmas-tree.js`(WebGL 없이 볼 수 있는 것 — 실제 그림은 브라우저로 확인)

## xmas-song.js — 편지 추천곡 뮤직바
- **책임**: 마이홈 BGM 위젯과 같은 모양 · 같은 동작의 바 — [▶ / ▐▐][긴 제목 흐름][((o 링크 · 제목 넣기(쓰기 칸만)]. 바가 여럿이어도 재생은 한 곡(컨트롤러 하나).
- **만드는 법**: xmas-window 가 `TwXmasSong.createXmasSong({ doc, win, companion, ytVideoId, asyncPrompt, toast, songTitleMax })` → `{ bar(el, { editable, onChange }), stop(), playing(), onPlay(fn) }`(`onPlay` — 추천곡 소리가 나기 시작 · 멈출 때 알림 · 배경음악이 물러난다).
- **함정**: 소리는 공용 배경음악 창 하나 — 주인 `'xmas'`(main.js `bgmOpen` · 패널 뒤에 숨고 · 신호 없이 되풀이)로 연다. 나중에 튼 쪽이 이긴다: `onBgmMode`(다른 주인) · `onBgmClosed` 면 ▶ 로. `stop()` 은 내가 주인일 때만 창을 닫는다(남의 곡을 끊지 않게). 재생 창 알림은 처음 틀 때 건다(앱 밖엔 companion 이 없다). 곡 제목은 남이 쓴 값 — `textContent` 로만.
- 검사: `sim-xmas-song.js`(main.js · preload 의 `'xmas'` 주인까지)

## xmas-bgm.js — 배경음악 곡 목록 · 출처 글
- **책임**: 크리스마스 창 배경음악의 값 — 곡 목록 `TRACKS`(여섯 · `xmas-bgm.mp3` «투게더트리» · 음악 제작 HADA / `xmas-bgm-wish` · `-silent` · `-wish2` 캐롤 셋 · 공유마당(한국저작권위원회) / `-jingle3`(Jingle Punks) · `-wish3`(E's Jammy Jams) · 유튜브 오디오 라이브러리) · 폴더 `DIRS` · 음량 · 저장 키 `tw.xmasBgmMuted` · 출처 글 `CREDIT`.
- **재생**: `shared/win-bgm.js`(스티커사진 창과 같이 쓴다) — xmas-window 가 이 값들과 `others`(듣던 유튜브 BGM 재우기 · `shared/bgm-hush.js` — app.js 가 만들어 넘긴다)로 만든다. 창을 열면 첫 곡부터 차례로, 끝나면 처음으로.
- **함정**: 편지 추천곡이 나는 동안은 물러난다(xmas-song 의 `onPlay` → `duck`). 다른 음악(플레이리스트 · 마이홈)이 재생 창을 가져가서 추천곡이 멈춘 것이면(`taken`) 돌아오지 않는다 — 사용자가 튼 음악을 다시 재우지 않게. 닫을 때는 편지 창보다 먼저 멈춘다. 창을 연 채 회사원 모드를 켜고 끄면 program-settings 가 `onOfficeModeChanged` → `syncBgm()` 으로 알린다.
- 검사: `sim-xmas-bgm.js`(값 · 출처 · 배선) · `sim-win-bgm.js`(재생 규칙)

## xmas-credit.js — 음악 출처 올라가기
- **책임**: 제목줄 [음악 출처] 를 누르면 출처 글이 트리 화면 아래에서 위로 한 번 올라가고 사라진다. 올라가는 중에 다시 누르면 바로 걷는다.
- **만드는 법**: xmas-window 가 `TwXmasCredit.createXmasCredit({ doc, box: #xmasCredit, lines: TwXmasBgm.CREDIT })` → `{ toggle, stop, showing }`.
- **함정**: 움직임 · 모양은 CSS(`.xm-roll.go` · `@keyframes xmCredit` · 도트 글꼴 Galmuri11 — `vendor/galmuri` · OFL-1.1 · 오픈소스 라이선스 창에 실린다). 글 상자는 `pointer-events:none` 이라 올라가는 동안에도 트리를 누를 수 있다. 글은 `textContent` 로만.
- 검사: `sim-xmas-bgm.js` 4절

## xmas-letter.js — 마니또 편지 창
- **책임**: 트리 창 아래 [편지 쓰기 (n/1)] · [편지 열람] · 그 위에 겹쳐 뜨는 편지 창(✕ · Esc). ✍️ 쓰기(12/24 23:59 까지 — 맡긴 목록 · 수정 · 삭제(거두기) · 새 편지 · 반송된 편지의 사유 · 다시 쓰기 · 지우기 · 운영자 확인 안내 한 줄) · 📬 열람(12/25 부터 — 봉투 · 열기 · 추천곡 · 신고 · 읽음) · 빨간 점(런처 [크리스마스] · [편지 열람]).
- **만드는 법**: xmas-window 가 `TwXmasLetter.createXmasLetter({ doc, rules, net, song, serverNow, schedule, toast, notifyError, escRegisterWindow, storage, onDot })` → `{ open, close, isOpen, refresh, checkGot, paintBtn }`.
- **함정**: 반송을 다시 쓰면 **빈 칸**에 맡기며 `fromReturned`(반송 칸)를 실어 보낸다 — 서버가 같은 트랜잭션에서 반송 기록을 지운다(반송 칸에 새 편지가 있을 수 있다 · 맡기기가 실패하면 표시가 남는다). 다른 PC 가 먼저 고쳤으면(`conflict`) 편지함을 다시 읽는다. 받은 편지는 다시 묻지 않는다(폴링 없음) — 편지 창을 열 때 한 번 · 알림함에 «받은 편지»(`XMAS_LETTER`) 알림이 처음 보이면(읽음 여부와 상관없이 — 알림 읽음은 서버 값이고 받은 편지 읽음은 이 PC 값이라, 다른 PC 에서 알림을 읽어도 이 PC 는 켤 때 한 번 읽는다) 창이 0~30초 무작위로 기다렸다 `checkGot` 한 번(0시에 앱 수천 대가 한꺼번에 읽지 않게 · 설계 5-3). 마감 뒤 짝 짓기 전(`matched=false`)이면 «배달하는 중» 을 그리고 기다린다. 실패는 «없음» 으로 굳히지 않는다 · 계정이 바뀌면 앞 계정의 점을 지운다. 읽음 표시는 이 PC `tw.xmasGotRead.{uid}`(번호 몇 개). 받은 글 · 곡 제목은 `textContent` 로만.
- 오류 코드: `E-XMAS-04`(편지 못 불러옴) · `E-XMAS-05`(맡기기 · 고치기 · 거두기 · 반송 표시 치우기 실패) · `E-XMAS-06`(편지 신고 못 보냄)
- 검사: `sim-xmas-letter.js`

## xmas-window.js — 크리스마스 창
- **책임**: 런처 버튼(서버 시각 열람 끝부터 숨김 · 서버 시계가 맞춰질 때(`TwRtHub.store.onClock`) · 날짜 한 벌이 바뀔 때(`onSchedule`) · 다음 바뀔 때(마감 · 열람 끝 — `rules.nextChange`)에 타이머 하나로 다시 봄 · 1분마다 돌지 않음) · 창 열고 닫기 · 내 트리(없으면 지금 트리 미리 보기) 불러오기 · 그림 사본(GLB 영구 캐시 IndexedDB · 키 `xmasimg:{트리}/{자리}@{판}` — 판이 같으면 안 받음 · 45일 뒤 저절로 치움 · ⚠️ localStorage 금지 — 트리 하나가 수 MB) · 장식 고르기 · 내 그림 올리기(64px · 넘치면 48 · 32 PNG) · 한마디 · 달기 / 바꾸기(5초 간격) · «트리가 이미 다 차버렸어요» · 장식 신고 확인창.
- **만드는 법**: app.js `const xmasWinMod = TwXmasWindow.createXmasWindow({ THREE, ps1Dither, rules, treeMod, net: ()=>xmasApiMod, serverNow, onClock: (fn)=>TwRtHub.store.onClock(fn), notifyError, toast, escRegisterWindow, onSizeChange: ()=>applyDesktopRunClass(), idbGet, idbPut, songMod, letterMod, companion, ytVideoId, asyncPrompt, storage, twNav, random })`(서버 기능 표가 꺼져 있으면 null) — 편지 창 · 뮤직바를 여기서 만든다. 세션마다 `startXmas` 가 `start()`(알림 걸기) · 세션이 끝나면 `reset()`(알림 · 타이머 풀기). 밖에서 부르는 이름은 `onMail(items)`(우편이 바뀌면 app.js 가 `mailFeed.items()` 를 넘긴다 — 처음 보는 받은 편지 알림이면 무작위로 기다렸다 받은 편지 한 번 읽기) — 📩 알림함은 창 열기 통로 `NAV.XMAS`(`'letter'` 면 편지 창까지)로 연다(마이홈과 같은 층이라 `NAV.MY_HOME_CLOSE` 로 마이홈을 먼저 닫는다).
- **세션**: app-boot 차례 `xmas`(app.js)가 `session.onReset` 에 `xmasApiMod.reset()` · `xmasWinMod.reset()` 을 건다 — 계정이 바뀌면 창을 닫고 내 장식 · 트리 · 본 알림 · 기다림 · 편지 · 받은 편지 · 빨간 점을 비운다(편지 모듈 `reset` 은 늦게 온 앞 계정 답도 버린다). 내 장식 덮어 그리기는 내 몫(`GET /v2/me/xmas` 의 mine)으로만 — 지운 장식은 다시 그리지 않는다.
- **함정**: Esc 는 트리 창을 편지 창보다 **먼저** 등록한다 — 알림함 길은 두 창을 같은 틱에 열어 창 쌓기가 등록 순서로 쌓는다(거꾸로면 Esc 에 트리 창이 통째로 닫힌다). 남이 쓴 한마디는 `textContent` 로만, 받은 그림 주소는 `TwSafeHtml.safeUrl(d, 'image')` 로 거른다. 닫은 뒤 늦게 온 답은 버린다(`seq`). 런처에서 열면 창 크기를 마이홈 크기로(`applyDesktopRunClass` 가 `#xmasOverlay.on` 을 본다).
- 창 자리: 처음엔 가운데. 런처에서 열었으면 제목줄을 끌 때 앱 창째 옮긴다(deps `osDrag` — `shared/os-drag.js` · 마이홈 창과 같은 규칙 · 모니터 어디로든). 실행 화면이면 창 안에서 끌고, 창 전체가 화면 안에 들게(`panelFit.fitTopLeft` — deps `panelFit`) · 열 때 · 앱 창 크기가 바뀔 때 다시 맞춘다. 창이 떠 있는 동안 뒤 런처 창(`.lc-card`)은 숨긴다(html css `body:has(#xmasOverlay.on)`).
- 고르는 줄 · 한마디: 불러올 때마다 지금 걸린 내 장식에 맞춘다(`syncPickToMine` — 내 그림이면 IndexedDB 사본으로 «내 그림» 칸 하나 · 기본 장식이면 그 단추 · 한마디 칸 채움). 그림을 못 받았으면 고른 것을 건드리지 않는다. 세션 reset 이 «내 그림» 칸 · 한마디를 비운다.
- 로그인 안 됨: 트리는 «로그인한 뒤 트리를 볼 수 있어요»(오류 코드 아님) · 신고는 «로그인한 뒤 신고할 수 있어요»(가입 전 익명은 net 이 쓰기 전에 auth 로).
- 오류 코드: `E-XMAS-01`(못 불러옴) · `E-XMAS-02`(장식 못 걺) · `E-XMAS-03`(신고 못 보냄)
- 검사: `sim-xmas-window.js`(가짜 화면 · 가짜 서버로 흐름을 돌린다)
