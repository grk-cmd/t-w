# 📷 `purikura/` — 스티커사진 모듈 사용 안내

스티커사진 모듈의 쓰는 법을 모듈마다 한 절씩 적는다. 통신 · 요금은 `purikura-net.js`(`window.Purikura`), 화면은 `purikura-ui.js`(`window.TwPurikuraUi` — app.js 가 원래 자리에서 `createPurikuraUi(deps)`).

## `purikura-ui.js` — 화면에 넣는 값

**책임** — 로비 자리 칸 · 프레임 그림처럼 **같은 방 사람의 값**을 그린다.

**쓰는 법** — 자리 칸의 이름은 `TwSafeHtml.text(m.name)` 로 씻어 마크업에 넣는다(«초마 <뚱쟁이>» 같은 이름이 친 그대로 보인다). 방장이 올린 프레임 주소는 `TwSafeHtml.safeUrl(u, 'image')` 를 지난 것만 받는다 — 허용 안 되면 그 칸은 비운다.

**함정** — 판 모양 표(세로형 · 가로형 · 컷 수)와 이 기기 카메라 사진(canvas `data:`)은 검사 예외(`checks/sim-safe-html.js` ALLOW)에 이유와 함께 있다. 새로 남의 값을 그리면 예외에 적지 말고 `TwSafeHtml` 로 감싼다.
검사: `checks/sim-safe-html.js` · `checks/sim-purikura-ui.js`.

## `pk-bgm.js` — 🎵 스티커사진 창 BGM

**책임** — 창이 열려 있는 동안만 BGM 을 튼다. 제목줄 «음악 끄기 / 음악 켜기»(`#pkBgmBtn`)로 끄고 켜고, 끈 상태는 이 PC 에 기억한다(`tw.pkBgmMuted`). 다른 BGM(유튜브 — 마이홈 · 플레이리스트) 재우기 · 되살리기는 `purikura-ui.js`(`_pkHushOthers` · `_pkUnhushOthers`)가 그대로 한다 — 꺼 둬도 창을 열면 유튜브는 잠깐 멈춘다.

**만드는 법** — `purikura-ui.js` 가 만들 때 한 번(html · smoke PRELOAD 에서 그보다 먼저 싣는다):

```js
const pkBgm = TwPkBgm.createPkBgm({
  Audio, srcs: PK_BGM_SRC, volume: PK_BGM_VOL,
  storage: localStorage,                 // 읽기만 — 끈 상태
  save: (k, v)=>_lsSet(k, v),            // 쓰기 — 실패하면 app.js _lsSet 이 한 번 알린다
  officeMode: ()=>officeMode(),          // 회사원 모드면 소리 없음
  warn: (...a)=>console.warn(...a),
});
```

**내놓는 것** — `start()`(창을 열 때 — 처음부터 · 꺼 뒀으면 소리 없음) · `stop()`(닫을 때 — 되감기) · `toggle()`(열려 있으면 바로 · 켤 때는 멈춘 자리부터) · `isMuted()` · `label()`(버튼 글).

**함정** — 경로 후보는 «있는 곳 먼저», 파일이 없으면 다음 후보로 갈아타고 다 떨어지면 소리 없이 창은 그대로. 자동재생 잠금은 삼키지 않고 경고로 남긴다. 버튼은 제목줄 끌기에서 뺀다(`_pkBindWinDrag` 의 `#pkBgmBtn`).
검사: `checks/sim-pk-bgm.js`.
