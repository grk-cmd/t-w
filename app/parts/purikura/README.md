# 📷 `purikura/` — 스티커사진 모듈 사용 안내

스티커사진 모듈의 쓰는 법을 모듈마다 한 절씩 적는다. 통신 · 요금은 `purikura-net.js`(`window.Purikura`), 화면은 `purikura-ui.js`(`window.TwPurikuraUi` — app.js 가 원래 자리에서 `createPurikuraUi(deps)`).

## `purikura-ui.js` — 화면에 넣는 값

**책임** — 로비 자리 칸 · 프레임 그림처럼 **같은 방 사람의 값**을 그린다.

**쓰는 법** — 자리 칸의 이름은 `TwSafeHtml.text(m.name)` 로 씻어 마크업에 넣는다(«초마 <뚱쟁이>» 같은 이름이 친 그대로 보인다). 방장이 올린 프레임 주소는 `TwSafeHtml.safeUrl(u, 'image')` 를 지난 것만 받는다 — 허용 안 되면 그 칸은 비운다.

**함정** — 판 모양 표(세로형 · 가로형 · 컷 수)와 이 기기 카메라 사진(canvas `data:`)은 검사 예외(`checks/sim-safe-html.js` ALLOW)에 이유와 함께 있다. 새로 남의 값을 그리면 예외에 적지 말고 `TwSafeHtml` 로 감싼다.
검사: `checks/sim-safe-html.js` · `checks/sim-purikura-ui.js`.
