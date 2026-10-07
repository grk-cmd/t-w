/*
 * 날짜별 숫자 요약 — 지난 하루가 끝나면 그날의 숫자만 따로 남긴다. 나중에 목록(u · ip)을 지워도 지난 지표가 남게.
 *   metrics/summary/{YYYY-MM-DD} = { dau, ipVisitors, visits, pings, wau, mau, at }
 *     wau · mau = 그날 기준(그날 포함) 최근 7일 · 30일 고유 사용자 수(u 목록 합집합)
 * 새 함수를 만들지 않고 1분 주기 roomStats(room-stats.js)가 부른다. 어제 요약이 있으면 점 읽기 1번으로 끝난다.
 * 자정 직후 몇 초 동안은 전날로 적히는 쓰기가 아직 들어올 수 있어, 자정이 지나고 SUMMARY_GRACE_MS 뒤에 계산한다.
 * 계산할 수 있는 건 어제 하루뿐이다 — 함수가 하루 내내 못 돌았으면 그날 요약은 없고, 웹 관리자가 목록에서 센다.
 */
'use strict';
const { kstDateKey, METRICS_DAILY } = require('./daily-active');

const METRICS_SUMMARY = 'metrics/summary';
const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_GRACE_MS = 10 * 60 * 1000;
const WAU_DAYS = 7;
const MAU_DAYS = 30;

const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const keysOf = (v) => (v && typeof v === 'object' ? Object.keys(v) : []);

// 요약할 날 — 서울 자정 + 10분이 지나야 «어제» 로 넘어간다.
function summaryDateKey(nowMs){
  return kstDateKey(Number(nowMs) - DAY_MS - SUMMARY_GRACE_MS);
}

// day 를 끝으로 n 일의 날짜 키(오래된 날 → day).
function datesUpTo(day, n){
  const end = Date.parse(day + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

// 순수 — 그날 노드 하나 + 날짜별 사용자 목록(최근 30일) → 요약.
function buildSummary(dayNode, usersByDate, day, nowMs){
  const node = dayNode && typeof dayNode === 'object' ? dayNode : {};
  const union = (n) => {
    const all = new Set();
    for (const d of datesUpTo(day, n)) for (const u of (usersByDate[d] || [])) all.add(u);
    return all.size;
  };
  return {
    dau: keysOf(node.u).length,
    ipVisitors: keysOf(node.ip).length,
    visits: count(node.visits),
    pings: count(node.pings),
    wau: union(WAU_DAYS),
    mau: union(MAU_DAYS),
    at: Number(nowMs),
  };
}

// 어제 요약이 없을 때만 계산해 쓴다. 이미 있으면 null.
// Admin SDK 에는 shallow 가 없어 사용자 목록은 값(true)까지 받는다 — 하루 한 번, 사람당 수십 바이트.
async function ensureDailySummary(db, nowMs){
  const day = summaryDateKey(nowMs);
  const at = (await db.ref(METRICS_SUMMARY + '/' + day + '/at').get()).val();
  if (at !== null && at !== undefined) return null;
  const dayNode = (await db.ref(METRICS_DAILY + '/' + day).get()).val();
  const usersByDate = { [day]: keysOf(dayNode && dayNode.u) };
  for (const d of datesUpTo(day, MAU_DAYS)){
    if (d === day) continue;
    usersByDate[d] = keysOf((await db.ref(METRICS_DAILY + '/' + d + '/u').get()).val());
  }
  const summary = buildSummary(dayNode, usersByDate, day, nowMs);
  await db.ref(METRICS_SUMMARY + '/' + day).set(summary);
  return { day, summary };
}

module.exports = { summaryDateKey, datesUpTo, buildSummary, ensureDailySummary,
  METRICS_SUMMARY, SUMMARY_GRACE_MS, WAU_DAYS, MAU_DAYS };
