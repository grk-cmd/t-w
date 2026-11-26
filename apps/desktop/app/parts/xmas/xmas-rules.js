/* xmas-rules.js — 🎄 크리스마스 이벤트(2026 · 일회성 — 다음 업데이트에서 걷는다 · 이슈 #963)의 순수 규칙 (검사 sim-xmas-rules.js)
   화면 · 서버를 모르는 계산만 — 날짜 판정 · 장식 자리 · 다시 받을 그림 · 흔들기 · 연달아 누르기 · 반짝임 · 한마디 정리 ·
   편지 칸 · 반송 사유 · 받은 편지 · 마감 D-day · 읽음 표시.
   ⚠️ 날짜의 정본은 서버(GET /v2/xmas/trees/current 의 letterDeadline · eventEnd · lettersViewUntil)다 — 받으면 scheduleOf 로 바꿔 쓴다.
     받기 전에 쓰는 처음 값(SCHEDULE)과 상한 숫자는 서버와 같아야 한다 — 숫자 표는 README «서버와 같은 숫자», sim-xmas-rules 가 견준다.
   classic script(window.TwXmasRules) — xmas-tree.js · xmas-window.js · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const TREE_MAX = 300;
const KINDS = Object.freeze(['bulb', 'star', 'sock', 'cane', 'gift']);
const WORD_MAX = 30;
const IMG_PX = 64;
const LETTER_DEADLINE_MS = 1798124400000;   // 2026-12-25T00:00:00+09:00 — 편지 마감 · 짝 짓기
const EVENT_END_MS = 1798729200000;          // 2027-01-01T00:00:00+09:00 — 장식 · 신고 막음
const LETTERS_VIEW_UNTIL_MS = 1799161200000; // 2027-01-06T00:00:00+09:00 — 받은 편지 열람 · 런처 버튼 끝(1/5 하루 끝까지)
const DELIVERY_WINDOW_MS = 10 * 60000;       // 마감부터 이만큼 — 짝 짓기 알림이 몰리는 때(알림함 다시 읽기를 흩는다)
const READ_JITTER_MS = 30000;                // 알림을 받은 앱 수천 대가 한꺼번에 읽지 않게 0 ~ 이만큼 무작위로 기다린다(설계 5-3)
const HANG_COOLDOWN_MS = 5000;               // 장식 바꾸기 간격 — 바꿀 때마다 남의 앱이 그림을 다시 받는다
const BLINK_COUNT = 10;
const BLINK_HALF_MS = Math.PI / 0.004;       // |cos(t·0.004)| 한 번 ≈ 0.79초
const TAPS_TO_DROP = 10, TAP_GAP_MS = 1500;
const SHAKE_PX = 22, SHAKE_GAP_MS = 350, SHAKE_RESET_MS = 600;

/** 날짜 한 벌(ms) — 서버 값을 받기 전의 처음 값 */
const SCHEDULE = Object.freeze({ letterDeadline: LETTER_DEADLINE_MS, eventEnd: EVENT_END_MS, lettersViewUntil: LETTERS_VIEW_UNTIL_MS });
/**
 * trees/current 의 날짜(ISO) → 날짜 한 벌. 하나라도 못 읽거나 차례(마감 < 끝 ≤ 열람 끝)가 틀리면 null — 부른 쪽은 쓰던 값을 그대로 둔다.
 * @param {{ letterDeadline?:string, eventEnd?:string, lettersViewUntil?:string }|null} d
 */
function scheduleOf(d){
  if (!d || typeof d !== 'object') return null;
  const ms = (v) => (typeof v === 'string' ? Date.parse(v) : NaN);
  const s = { letterDeadline: ms(d.letterDeadline), eventEnd: ms(d.eventEnd), lettersViewUntil: ms(d.lettersViewUntil) };
  if (!Object.values(s).every(Number.isFinite) || !(s.letterDeadline < s.eventEnd && s.eventEnd <= s.lettersViewUntil)) return null;
  return Object.freeze(s);
}

/** 서버 시각으로(s 를 안 주면 처음 값) — 장식을 걸까(이벤트 끝 전) · 편지를 쓸까(마감 전) · 받은 편지를 볼까(마감부터 열람 끝 전) · 런처 버튼(열람 끝 전) */
const eventOn = (now, s = SCHEDULE) => Number.isFinite(now) && now < s.eventEnd;
const letterOpen = (now, s = SCHEDULE) => Number.isFinite(now) && now < s.letterDeadline;
const lettersArrived = (now, s = SCHEDULE) => Number.isFinite(now) && now >= s.letterDeadline && now < s.lettersViewUntil;
const buttonOn = (now, s = SCHEDULE) => Number.isFinite(now) && now < s.lettersViewUntil;
/** 짝 짓기 알림이 몰리는 때인가(마감부터 10분) */
const inDeliveryWindow = (now, s = SCHEDULE) => Number.isFinite(now) && now >= s.letterDeadline && now < s.letterDeadline + DELIVERY_WINDOW_MS;
/** 무작위 기다림 — r 은 0 이상 1 미만 수 */
const jitterMs = (r) => Math.floor(Math.min(Math.max(Number(r) || 0, 0), 0.999999) * READ_JITTER_MS);
/** 새 알림을 받고 알림함을 다시 읽기 전에 기다릴 ms — 짝 짓기 10분 안이면 무작위 · 그 밖은 0(곧바로) */
const mailDelayMs = (now, s, r) => (inDeliveryWindow(now, s) ? jitterMs(r) : 0);
/** 받은 편지 알림(XMAS_LETTER) 중 아직 안 본 것의 id — 우편 { id: { kind, read } } · seen 은 이미 본 id Set.
    알림의 읽음은 보지 않는다 — 알림 읽음은 서버 값(모든 PC 가 같이 봄)이고 받은 편지 읽음은 이 PC 값이라, 다른 PC 에서 알림을 읽어도 이 PC 는 켤 때 한 번 읽어야 빨간 점이 맞는다 */
const letterMailIds = (items, seen) => Object.keys(items || {}).filter(id => items[id] && items[id].kind === 'XMAS_LETTER' && !(seen && seen.has(id)));

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

/** 장식 목록(xmas-api 의 tree(t).o) → 걸린 수 */
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

/* ── ✉️ 마니또 편지 — 규칙 xmasLetters · 함수 runMatch · handleAdminReturn 과 같은 숫자 ── */
const LETTER_MAX = 5, LETTER_TEXT_MAX = 500, SONG_TITLE_MAX = 40;
const LETTER_IDS = Object.freeze(['l1', 'l2', 'l3', 'l4', 'l5']);
const SONG_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const RETURN_REASONS = Object.freeze({ abuse: '욕설 · 비방', privacy: '개인정보', spam: '광고 · 도배', etc: '기타' });
const DAY_MS = 86400000, KST_MS = 9 * 3600000;

/** 추천곡 칸 — 모양이 맞으면 { id, title } · 아니면 null(남이 쓴 값이라 한 번 더 거른다) */
function songOf(v){
  if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !SONG_ID_RE.test(v.id)) return null;
  return { id: v.id, title: typeof v.title === 'string' ? v.title.slice(0, SONG_TITLE_MAX) : '' };
}
/** 편지 한 통 다듬기 — 앞뒤 공백 · 500자. 빈 글이면 '' */
const cleanLetter = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').trim().slice(0, LETTER_TEXT_MAX);

/** 내 편지함(GET /v2/me/xmas 의 letters) → 칸 번호 순 [{ lid, text, version, song }] — 모양이 틀린 칸은 뺀다 */
function myLettersOf(v){
  const box = (v && typeof v === 'object') ? v : {};
  return LETTER_IDS.filter(id => box[id] && typeof box[id].text === 'string' && box[id].text)
    .map(id => ({ lid: id, text: box[id].text.slice(0, LETTER_TEXT_MAX), version: Number.isInteger(box[id].version) ? box[id].version : 0, song: songOf(box[id].song) }));
}
/** 반송된 편지(GET /v2/me/xmas 의 returned) → [{ lid, reason, why, text, song }] — why = 보여 줄 사유(«기타 — 적은 말») */
function returnedOf(v){
  const box = (v && typeof v === 'object') ? v : {};
  return LETTER_IDS.filter(id => box[id] && typeof box[id].text === 'string')
    .map(id => {
      const r = box[id];
      const reason = Object.prototype.hasOwnProperty.call(RETURN_REASONS, r.reason) ? r.reason : 'etc';
      const note = typeof r.note === 'string' ? r.note : '';
      return { lid: id, reason, why: RETURN_REASONS[reason] + (note ? ' — ' + note : ''), text: r.text.slice(0, LETTER_TEXT_MAX), song: songOf(r.song) };
    });
}
/** 새 편지를 넣을 빈 칸 — 없으면 null(5통 다 맡김) */
function freeLetterId(letters){
  const used = new Set((letters || []).map(l => l.lid));
  return LETTER_IDS.find(id => !used.has(id)) || null;
}
/** 받은 편지(GET /v2/me/xmas 의 received) → 번호 순 [{ n, text, song }] */
function gotOf(v){
  const box = (v && typeof v === 'object') ? v : {};
  return Object.keys(box).filter(k => /^[1-9][0-9]?$/.test(k) && box[k] && typeof box[k].text === 'string')
    .map(k => ({ n: Number(k), text: box[k].text.slice(0, LETTER_TEXT_MAX), song: songOf(box[k].song) }))
    .sort((a, b) => a.n - b.n);
}
/** 마감까지 남은 날(한국 날짜로 · 마감 전날이 D-0) — 마감 뒤면 -1 */
function ddayLeft(now, s = SCHEDULE){
  if (!letterOpen(now, s)) return -1;
  const day = (ms) => Math.floor((ms + KST_MS) / DAY_MS);
  return day(s.letterDeadline - 1) - day(now);
}
/** 받은 편지 읽음 표시(이 PC) — '1,3' ↔ Set. 빨간 점은 안 읽은 편지가 있을 때 */
const readSetOf = (s) => new Set(String(s || '').split(',').filter(x => /^[1-9][0-9]?$/.test(x)).map(Number));
const readSetStr = (set) => [...set].sort((a, b) => a - b).join(',');
const hasUnread = (got, set) => (got || []).some(g => !set.has(g.n));

const api = Object.freeze({
  TREE_MAX, KINDS, WORD_MAX, IMG_PX, LETTER_DEADLINE_MS, EVENT_END_MS, LETTERS_VIEW_UNTIL_MS, DELIVERY_WINDOW_MS, READ_JITTER_MS, SCHEDULE, HANG_COOLDOWN_MS, BLINK_COUNT, BLINK_HALF_MS,
  TAPS_TO_DROP, TAP_GAP_MS, SHAKE_PX, SHAKE_GAP_MS, SHAKE_RESET_MS, TIERS,
  scheduleOf, eventOn, letterOpen, lettersArrived, buttonOn, inDeliveryWindow, jitterMs, mailDelayMs, letterMailIds, cleanWord, slotPositions, countOf, changedImgSlots, cooldownLeft, blinkOpacity, createTaps, createShake,
  LETTER_MAX, LETTER_TEXT_MAX, SONG_TITLE_MAX, LETTER_IDS, RETURN_REASONS,
  songOf, cleanLetter, myLettersOf, returnedOf, freeLetterId, gotOf, ddayLeft, readSetOf, readSetStr, hasUnread,
});
if (typeof window !== 'undefined') window.TwXmasRules = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
