/* ═══ 👁 깜빡임 시간표 — 언제 눈을 감는가 (실행 화면 좌석) ══════════════
   한 번씩 깜빡이기를 2~3번 하고 나면 세 번 연달아 깜빡인다. 사이 간격은 무작위.
   ★ 시간은 실제 시각(ms)으로만 센다 — 프레임 수로 세면 주사율 · 프레임 상한에 따라 주기가 달라진다.
   DOM · THREE 를 안 본다 — 순수 계산만(검사 sim-blink-timing.js). */
(function(){
'use strict';

const FIRST_MIN_MS = 800;          // 처음 깜빡임까지 — 최소
const FIRST_SPAN_MS = 2200;        //                  + 무작위 폭
const SINGLES_MIN = 2;             // 세 번 연달아 깜빡이기 전 한 번씩 깜빡이는 횟수 — 최소
const SINGLES_SPAN = 2;            //                                              + 0 ~ (이 값 - 1)
const SINGLE_DUR_MS = 170;         // 한 번 깜빡임(감았다 뜨기) 길이
const SINGLE_GAP_MIN_MS = 1800;    // 한 번 깜빡인 뒤 다음까지 — 최소
const SINGLE_GAP_SPAN_MS = 1900;   //                          + 무작위 폭
const TRIPLE_COUNT = 3;            // 연달아 깜빡이는 횟수
const TRIPLE_DUR_MS = 160;         // 연달아 깜빡임 하나의 길이
const TRIPLE_STEP_MS = 280;        // 연달아 깜빡임 사이
const TRIPLE_TAIL_MS = 720;        // 연달아 깜빡임이 끝나기까지(다음 간격은 여기부터 센다)
const TRIPLE_GAP_MIN_MS = 2400;    // 연달아 깜빡인 뒤 다음까지 — 최소
const TRIPLE_GAP_SPAN_MS = 1800;   //                           + 무작위 폭
const SHUT_AT = 0.5;               // eyeClose 가 이보다 크면 «감은 눈» 그림으로 바꾼다

function createBlink(now, rand){
  const r = rand || Math.random;
  return { pulses: [], nextAt: now + FIRST_MIN_MS + r() * FIRST_SPAN_MS, singles: SINGLES_MIN + Math.floor(r() * SINGLES_SPAN), closed: false };
}

/* 때가 됐으면 다음 깜빡임(들)을 예약한다 */
function scheduleBlinks(bl, now, rand){
  if(now < bl.nextAt) return;
  const r = rand || Math.random;
  if(bl.singles > 0){
    bl.pulses.push({ start: now, dur: SINGLE_DUR_MS });
    bl.singles--;
    bl.nextAt = now + SINGLE_GAP_MIN_MS + r() * SINGLE_GAP_SPAN_MS;
  } else {
    for(let i = 0; i < TRIPLE_COUNT; i++) bl.pulses.push({ start: now + i * TRIPLE_STEP_MS, dur: TRIPLE_DUR_MS });
    bl.singles = SINGLES_MIN + Math.floor(r() * SINGLES_SPAN);
    bl.nextAt = now + TRIPLE_TAIL_MS + TRIPLE_GAP_MIN_MS + r() * TRIPLE_GAP_SPAN_MS;
  }
}

/* 지금 눈을 감은 정도 0(뜸) ~ 1(감음). 끝난 깜빡임은 지운다 */
function eyeClose(bl, now){
  let c = 0;
  for(let i = bl.pulses.length - 1; i >= 0; i--){
    const p = bl.pulses[i], e = now - p.start;
    if(e < 0) continue;
    if(e > p.dur){ bl.pulses.splice(i, 1); continue; }
    c = Math.max(c, Math.sin(e / p.dur * Math.PI));
  }
  return c;
}

const api = { SHUT_AT, createBlink, scheduleBlinks, eyeClose };
if(typeof window !== 'undefined') window.TwBlinkTiming = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
