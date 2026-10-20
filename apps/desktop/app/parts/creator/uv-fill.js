/* ═══ 🪣 메쉬 채우기 — 클릭한 메쉬의 UV 삼각형만 그림판에 칠한다 ═══════════════════════════════════
   본문은 캐릭터 코어로 옮겼다(packages/char-core/src/uv-fill.ts · #433). 여기서는 앱이 부르던 전역 이름 UvFill 을 코어에 잇는다 —
   부르는 곳(app.js · paint-tools.js · part-paint.js)은 그대로. html 이 코어(vendor/char-core) 다음 · 부르는 파일보다 먼저 싣는다.
   검사: sim-uv-fill.js · sim-paint-tools.js(코어 빌드 사본으로 돌린다) · 코어 시험 packages/char-core/tests/uv-fill.test.ts */
window.UvFill = TwCharCore.uvFill;
