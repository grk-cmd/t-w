/* run-rect.js — 🖥️ 실행 화면 창 자리(모니터 작업영역 → 창 사각형) · 🧪 시험 스위치 «아래 띠만» (검사 sim-run-rect.js)
   [왜] 실행 진입 · 모니터 바꾸기 · 표시 설정 바뀜 세 길이 같은 사각형을 써야 한다 — 하나만 다르면 창이 오르내리며 흔들린다.
   ★ 높이는 overlay.runOverlayHeight 로 깎은 값(동영상 검어짐 대응 아래 틈)을 받는다 — 여기서 다시 깎지 않는다.
   🧪 --tw-run-band=0.4 : 실행 창을 아래쪽 그 비율 높이로만 띄운다(CPU 가 창 넓이에 따라 주는지 재 보는 시험 — 바로가기 끝에 붙인다).
     창 아래 끝은 그대로 · 위만 내려온다. 스위치가 없거나 이상한 값이면 지금과 같다(1).
   ★ 순수 함수만. 받는 것 없음. 내보냄: { BAND_MIN, BAND_SWITCH, parseBand, runRect }.
   main.js 가 require 한다(설치본은 app/** 로 들어간다). */
'use strict';

const BAND_SWITCH = 'tw-run-band';
const BAND_MIN = 0.25;   // 이보다 낮으면 캐릭터 머리 위 말풍선 · 이름표가 잘린다

/* 명령줄에서 띠 비율 — 없거나 숫자가 아니거나 0 이하 · 1 이상이면 1(전체). 너무 작으면 BAND_MIN 으로 */
function parseBand(argv){
  const pre = '--' + BAND_SWITCH + '=';
  const arg = (argv || []).find(a => typeof a === 'string' && a.startsWith(pre));
  if(!arg) return 1;
  const v = Number(arg.slice(pre.length));
  if(!Number.isFinite(v) || v <= 0 || v >= 1) return 1;
  return Math.max(BAND_MIN, v);
}

/* 작업영역 { x, y, width } + 깎은 높이 + 띠 비율 → 창 사각형(정수) */
function runRect(workArea, overlayHeight, band){
  const full = Math.round(overlayHeight);
  const h = band < 1 ? Math.max(1, Math.round(full * band)) : full;
  return { x: workArea.x, y: workArea.y + (full - h), width: workArea.width, height: h };
}

module.exports = { BAND_MIN, BAND_SWITCH, parseBand, runRect };
