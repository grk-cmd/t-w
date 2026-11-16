/* xmas-rules.js — 🎄 크리스마스 이벤트(2026 · 일회성 — 다음 업데이트에서 걷는다 · 이슈 #963)의 순수 규칙 (검사 sim-xmas-rules.js)
   화면 · 서버를 모르는 계산만 — 날짜 판정 · 장식 자리 · 다시 받을 그림 · 흔들기 · 연달아 누르기 · 반짝임 · 한마디 정리.
   ⚠️ 날짜 · 상한 숫자는 서버(firebase/functions/xmas.js · 규칙 xmas*)와 같아야 한다 — sim-xmas-rules 가 견준다.
   classic script(window.TwXmasRules) — xmas-tree.js · xmas-window.js · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const TREE_MAX = 300;
const KINDS = Object.freeze(['bulb', 'star', 'sock', 'cane', 'gift']);
const WORD_MAX = 30;
const IMG_PX = 64;
const LETTER_DEADLINE_MS = 1798124400000;   // 2026-12-25T00:00:00+09:00 — 편지 마감 · 짝 짓기
const EVENT_END_MS = 1798729200000;          // 2027-01-01T00:00:00+09:00 — 버튼 숨김 · 장식 막음
const HANG_COOLDOWN_MS = 5000;               // 장식 바꾸기 간격 — 바꿀 때마다 남의 앱이 그림을 다시 받는다
const BLINK_COUNT = 10;
const BLINK_HALF_MS = Math.PI / 0.004;       // |cos(t·0.004)| 한 번 ≈ 0.79초
const TAPS_TO_DROP = 10, TAP_GAP_MS = 1500;
const SHAKE_PX = 22, SHAKE_GAP_MS = 350, SHAKE_RESET_MS = 600;

/** 서버 시각으로 — 버튼을 보일까(1월 1일 0시 전) · 편지를 쓸까(마감 전) · 받은 편지를 볼까(마감부터) */
const eventOn = (now) => Number.isFinite(now) && now < EVENT_END_MS;
const letterOpen = (now) => Number.isFinite(now) && now < LETTER_DEADLINE_MS;
const lettersArrived = (now) => Number.isFinite(now) && now >= LETTER_DEADLINE_MS && now < EVENT_END_MS;

/** 한마디 다듬기 — 서버 cleanWord 와 같은 규칙(제어 문자 · 줄바꿈 → 공백 · 공백 묶기 · 앞뒤 걷기) */
function cleanWord(w){
  return String(w == null ? '' : w).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 트리 층(원뿔) — 3D 와 자리 계산이 같이 쓴다 */
const TIERS = Object.freeze([ { y: 0.6, h: 1.9, r: 2.05 }, { y: 1.75, h: 1.6, r: 1.6 }, { y: 2.75, h: 1.35, r: 1.15 }, { y: 3.6, h: 1.05, r: 0.72 } ]);
/**
 * 장식 자리 n 개 — 층 넓이만큼 나눠 원뿔 겉면에 황금각 나선으로(빈자리 자동 배치 · 자리 번호 = 서버 slot).
 * 같은 n 이면 늘 같은 자리 → 모든 사람의 화면에서 같은 장식이 같은 곳에 걸린다.
 */
function slotPositions(n){
  const out = [], area = TIERS.map(t => t.r * t.h), sum = area.reduce((a, b) => a + b, 0);
  let k = 0;
  TIERS.forEach((t, i) => {
    const cnt = i === TIERS.length - 1 ? n - k : Math.round(n * area[i] / sum);
    for (let j = 0; j < cnt; j++){
      const f = (j + 0.5) / cnt;
      const hy = 0.12 + 0.8 * f;
      const rr = t.r * (1 - hy) * 1.04 + 0.05;
      const a = (k + j) * 2.39996;
      out.push({ x: Math.cos(a) * rr, y: t.y + t.h * hy, z: Math.sin(a) * rr });
    }
    k += cnt;
  });
  return out;
}

/** 장식 목록(xmasTrees/{t}/o) → 걸린 수 */
const countOf = (o) => (o && typeof o === 'object') ? Object.keys(o).filter(s => o[s]).length : 0;

/**
 * 다시 받을 그림 자리 — 내 그림 장식 중 앱이 들고 있는 판과 **다른** 것(크다/작다가 아니라 다르다 —
 * 동시 바꾸기의 쓰기 차례에 따라 마지막 판이 더 작을 수 있다).
 */
function changedImgSlots(o, have){
  const out = [];
  for (const s of Object.keys(o || {})){
    const e = o[s];
    if (e && e.k === 'img' && (!have || have[s] !== e.v)) out.push(s);
  }
  return out;
}

/** 장식 바꾸기 간격 — 마지막으로 건 시각 기준 남은 ms(0 = 지금 걸 수 있음) */
const cooldownLeft = (lastAt, now) => (Number.isFinite(lastAt) ? Math.max(0, HANG_COOLDOWN_MS - (now - lastAt)) : 0);

/** 내 장식 반짝임 — 단 뒤 BLINK_COUNT 번만 깜빡이고 1(또렷)로 멈춘다 */
function blinkOpacity(elapsed){
  if (!(elapsed >= 0) || elapsed >= BLINK_COUNT * BLINK_HALF_MS) return 1;
  return 0.6 + 0.4 * Math.abs(Math.cos(elapsed * 0.004));
}

/** 연달아 누르기(이스터에그) — tap(now) 가 true 면 장식을 다 떨어뜨린다 */
function createTaps(){
  let n = 0, last = -Infinity;
  return {
    tap(now){ n = (now - last < TAP_GAP_MS) ? n + 1 : 1; last = now; if (n >= TAPS_TO_DROP){ n = 0; return true; } return false; },
    count: () => n,
  };
}

/**
 * 흔들기(이스터에그) — 끌기 한 번(d px)마다 feed(d, now) → 이번에 떨어뜨릴 장식 수.
 * 한 번 움직임이 SHAKE_PX 이상 빠르고 SHAKE_GAP_MS 안에 방향을 뒤집으면 «왕복» — 왕복할수록 더 많이(1 + ⌊왕복²·0.4⌋).
 * 잠깐(SHAKE_RESET_MS) 멈추면 세기가 처음으로.
 */
function createShake(){
  let shake = 0, sign = 0, at = -Infinity;
  return {
    feed(d, now){
      const sg = Math.sign(d);
      if (Math.abs(d) < SHAKE_PX){ if (now - at > SHAKE_RESET_MS){ shake = 0; sign = 0; } return 0; }
      let drop = 0;
      if (sign && sg !== sign && now - at < SHAKE_GAP_MS){ shake += 1; drop = 1 + Math.floor(shake * shake * 0.4); }
      sign = sg; at = now;
      return drop;
    },
    level: () => shake,
  };
}

const api = Object.freeze({
  TREE_MAX, KINDS, WORD_MAX, IMG_PX, LETTER_DEADLINE_MS, EVENT_END_MS, HANG_COOLDOWN_MS, BLINK_COUNT, BLINK_HALF_MS,
  TAPS_TO_DROP, TAP_GAP_MS, SHAKE_PX, SHAKE_GAP_MS, SHAKE_RESET_MS, TIERS,
  eventOn, letterOpen, lettersArrived, cleanWord, slotPositions, countOf, changedImgSlots, cooldownLeft, blinkOpacity, createTaps, createShake,
});
if (typeof window !== 'undefined') window.TwXmasRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
