# 📷 `purikura/` — 스티커사진 모듈 사용 안내

스티커사진 모듈의 쓰는 법을 모듈마다 한 절씩 적는다. 순수 계산(시트 기하 · 필터 · 좌표 인코딩 · 하루 경계 문구)은 `purikura-net.js`(`window.Purikura`), 서버와의 통신(세션 · 정원)은 `purikura-rt.js`(`window.TwPurikuraRt`), 화면은 `purikura-ui.js`(`window.TwPurikuraUi` — app.js 가 원래 자리에서 `createPurikuraUi(deps)`).

## `purikura-rt.js` — 📷 스티커사진 세션 포트(realtime 연결 하나)

**책임** — 세션(자리 넷 · 방장 · 설정 · 프레임 · 좌표 · 사건 · 셔터)과 하루 정원은 서버가 가진다. 이 모듈은 `photo*` 메시지를 보내고 받아 화면이 읽던 모양으로 옮긴다. 방장은 서버가 정한다 — 판(meta)의 `host`(방장 userCode)가 원본이고 바뀌면 서버가 `photoMeta` 를 다시 보낸다(앱이 번호를 다시 계산하지 않는다).

**만드는 법** — app.js `_purikura()` 한 곳(세션 하나 · 콜백 한 벌):

```js
const session = TwPurikuraRt.createPhotoSession({
  hub: TwRtHub.store, api: TwApi.authed, P: Purikura,
  serverNow: ()=>…,                       // 방 포트의 서버 시각 — 카운트다운 · 필터 잠금이 여기서 센다 · 모르면 null(PC 시계로 대신하지 않는다 — 컷을 열지 않고 E-PK-03)
  onPeers, onMeta, onEvent, onShot,       // 남의 좌표 · 판 · 사건 · 셔터
  onSlots, onFrames,                      // 자리 배치 · 프레임 목록 — 서버가 통째로 보내 준다
  onRefused,                              // 서버가 방장 일을 거절했다({ ref, code })
  onLateStart,                            // 시간 초과로 접은 촬영 시작이 서버에서는 됐다 — 방장 화면이 이어 간다
});
```

**내놓는 것** — `open(방, { userCode })` → `{ ok, slot, host }` | `{ ok:false, reason }`(`busy` 촬영 중 · `full` 넷이 참 · `notInRoom` 방 밖 · `notReady` 연결 없음 · `timeout` · `error`) · `close()` · `release()`(꾸미기로 넘어갈 때 — 같은 일) · `isHost()` · `mySlot()` · `hostSlot()` · `setConfig` · `setFilter` · `setCam` · `setCut(i, 0|시각)` · `setDone` · `setFrameUrl(i, url|null)` · `fireShutter(n)`(방장 일 — 방장이 아니면 `false`) · `start()` → `{ ok, n, left, nth }` | `{ ok:false, reason, message }`(`closed` 정원 다 씀 · `unavailable` 정원을 못 물음 · `not-host` · `notInRoom` · `notReady` · `timeout` · `error`) · `sendPos` · `sendEvent` · `checkQuota()`(`GET /v2/rooms/photo-quota` — 못 읽으면 던짐) · `watchQuota(cb)`(창이 열려 있는 동안만 — 알림 `photoQuota`가 오면 다시 GET) · `slotsNow` · `framesNow` · `metaNow` · `peersNow` · `serverNow`.

**함정** — ⓪ open · start 는 요청마다 rid 를 실어 보내고, 서버가 그 rid 를 답(photoWelcome · photoStarted · 오류)에 돌려준다 — 답은 rid 로 제 요청에 짝짓는다. 시간 초과로 지운 요청의 늦은 답은 모르는 rid 라 버려진다(start 만 stale 로 남겨 늦은 photoStarted 로 방장 화면이 이어 간다 · 끊기거나 자리를 잃으면 모두 지운다). ① 자리 칸은 `{ uid, name, fx }` 이고 `uid` 는 userCode(연결의 나 · 방 포트 `myCode`) — 좌석의 `friendUserId` 와 견준다. ② 연결이 끊기거나 서버가 «방 밖» 이라고 답하면 세션을 버리고 `onSlots({})` 로 알린다 — 혼자 다시 들어가지 않는다(창을 닫았다 다시 열면 서버가 같은 자리를 돌려준다). ③ 방 코드는 싣지 않는다 — 서버가 지금 방으로 정한다. ④ `setCut` 의 시각은 서버가 찍는다(앱 시계를 싣지 않는다). ⑤ 프레임 그림은 Storage 에 올리고 주소만 `setFrameUrl` — 경로는 `purikura/{방}/{방장 userCode}/{i}.webp` 여야 서버가 받는다.
검사: `checks/sim-purikura-rt.js`(가짜 연결 · 서버 규약 대조 · mutation test).

## `purikura-ui.js` — 화면에 넣는 값

**책임** — 로비 자리 칸 · 프레임 그림처럼 **같은 방 사람의 값**을 그린다.

**쓰는 법** — 자리 칸의 이름은 `TwSafeHtml.text(m.name)` 로 씻어 마크업에 넣는다(«초마 <뚱쟁이>» 같은 이름이 친 그대로 보인다). 방장이 올린 프레임 주소는 `TwSafeHtml.safeUrl(u, 'image')` 를 지난 것만 받는다 — 허용 안 되면 그 칸은 비운다.

**함정** — 판 모양 표(세로형 · 가로형 · 컷 수)와 이 기기 카메라 사진(canvas `data:`)은 검사 예외(`checks/sim-safe-html.js` ALLOW)에 이유와 함께 있다. 새로 남의 값을 그리면 예외에 적지 말고 `TwSafeHtml` 로 감싼다.
검사: `checks/sim-safe-html.js` · `checks/sim-purikura-ui.js`.

## 🎵 스티커사진 창 BGM

**책임** — 창이 열려 있는 동안만 BGM 을 튼다. 제목줄 «음악 끄기 / 음악 켜기»(`#pkBgmBtn`)로 끄고 켜고, 끈 상태는 이 PC 에 기억한다(`tw.pkBgmMuted`). 듣던 유튜브 BGM(마이홈 · 플레이리스트)은 열 때 재우고 닫을 때 되살린다(`shared/bgm-hush.js` — 꺼 둔 PC 에서도 재운다).

**만드는 법** — 따로 파일이 없다. 재생 · 끄기 기억은 `shared/win-bgm.js`(크리스마스 창과 같이 쓴다)이고, `purikura-ui.js` 가 만들 때 한 번 만든다:

```js
const pkBgm = TwWinBgm.createWinBgm({
  Audio, tracks: PK_BGM_TRACKS, dirs: PK_BGM_DIRS, volume: PK_BGM_VOL, muteKey: PK_BGM_MUTE_KEY, tag: '스티커사진',
  others: TwWinBgm.NO_OTHERS,            // 재우기는 _pkHushOthers 가 여닫을 때 따로
  storage: localStorage,                 // 읽기만 — 끈 상태
  save: (k, v)=>_lsSet(k, v),            // 쓰기 — 실패하면 app.js _lsSet 이 한 번 알린다
  officeMode: ()=>officeMode(),          // 회사원 모드면 소리 없음
  warn: (...a)=>console.warn(...a),
});
```

**함정** — 버튼은 제목줄 끌기에서 빠져 있어야 한다(`_pkBindDrag`). 촬영 중 회사원 모드는 창을 닫지 않는다(위 «회사원 모드» 절).

검사: `checks/sim-win-bgm.js`(재생 규칙) · `checks/sim-purikura-deco.js` §14.
