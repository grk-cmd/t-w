/*
 * 사용량(비용) 기록 — Cloud Monitoring 에서 어제 · 오늘(서울 날짜)의 하루 합계를 받아 metrics/usage/{YYYY-MM-DD} 에 적는다.
 *   db       { sentBytes, storedBytes, peakConnections, at }   RTDB 다운로드 · 저장 용량 · 최대 동시 접속
 *   functions{ calls, byName: { 함수 이름: 호출 수 }, at }       Cloud Functions 호출 수(v2 도 execution_count 에 잡힌다)
 *   storage  { bucket, sentBytes, storedBytes, at }            앱 버킷(Firebase Storage)만 — 함수 배포 소스 버킷은 뺀다
 *   hosting  { sentBytes, at }                                 Firebase Hosting 다운로드
 * 어제 값은 하루가 끝나도 Monitoring 에 몇 분 늦게 들어오므로 매시간 어제 · 오늘을 둘 다 다시 쓴다.
 * 무리마다 따로 쓴다 — 한 지표를 못 받으면 그 무리만 이전 값을 남겨 두고 나머지는 새로 쓴다.
 * 시계열은 1시간 칸으로 받아 칸의 끝 시각(직전 1ms)이 속한 서울 날짜에 더한다. 서울 자정은 UTC 정시라 칸이 날짜를 넘지 않는다.
 */
'use strict';
const { kstDateKey } = require('./daily-active');

const METRICS_USAGE = 'metrics/usage';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;
const MONITORING_URL = 'https://monitoring.googleapis.com/v3/projects/';

// fold: sum = 하루 합 · max = 하루 최대 · last = 그날 마지막 값(그날 표본이 없으면 그 전 마지막 값 — 저장 용량은 드문드문 찍힌다)
const QUERIES = {
  dbSent: { type: 'firebasedatabase.googleapis.com/network/sent_bytes_count', aligner: 'ALIGN_SUM', fold: 'sum' },
  dbStored: { type: 'firebasedatabase.googleapis.com/storage/total_bytes', aligner: 'ALIGN_MAX', fold: 'last' },
  dbConn: { type: 'firebasedatabase.googleapis.com/network/active_connections', aligner: 'ALIGN_MAX', fold: 'max' },
  fnCalls: {
    type: 'cloudfunctions.googleapis.com/function/execution_count', aligner: 'ALIGN_SUM', fold: 'sum',
    groupBy: 'resource.label.function_name',
  },
  stSent: {
    type: 'storage.googleapis.com/network/sent_bytes_count', aligner: 'ALIGN_SUM', fold: 'sum',
    groupBy: 'resource.label.bucket_name',
  },
  stStored: {
    type: 'storage.googleapis.com/storage/total_bytes', aligner: 'ALIGN_MAX', fold: 'last',
    groupBy: 'resource.label.bucket_name',
  },
  hostSent: { type: 'firebasehosting.googleapis.com/network/sent_bytes_count', aligner: 'ALIGN_SUM', fold: 'sum' },
};

/** 서울 자정(그 날짜가 시작하는 UTC ms). */
function kstDayStart(date) {
  return Date.parse(date + 'T00:00:00Z') - KST_OFFSET_MS;
}

/** 다시 쓸 날짜(어제 · 오늘)와 받을 구간. 구간은 그제부터 — 저장 용량을 «그 전 마지막 값» 으로 채울 여유. */
function usageWindow(nowMs) {
  const today = kstDateKey(nowMs);
  const yesterday = kstDateKey(nowMs - DAY_MS);
  const start = kstDayStart(kstDateKey(nowMs - 2 * DAY_MS));
  const end = Math.ceil(nowMs / HOUR_MS) * HOUR_MS;   // 정시로 올려야 칸이 정시에 맞는다
  return { dates: [yesterday, today], start, end };
}

const pointValue = (p) => {
  const v = p && p.value ? (p.value.int64Value ?? p.value.doubleValue) : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Monitoring 응답의 timeSeries 하나 → [{ day, end, v }]. 끝 시각이 이상한 점은 버린다. */
function seriesPoints(ts) {
  const out = [];
  for (const p of (ts && ts.points) || []) {
    const end = Date.parse(p && p.interval && p.interval.endTime);
    if (!Number.isFinite(end)) continue;
    out.push({ day: kstDateKey(end - 1), end, v: pointValue(p) });
  }
  return out;
}

/** 점들 → 날짜마다 하나의 값. 표본이 하나도 없는 날은 null(sum · max) — «0» 과 «모름» 을 가른다. */
function foldDays(points, dates, fold) {
  const out = {};
  const sorted = [...points].sort((a, b) => a.end - b.end);
  for (const date of dates) {
    const inDay = sorted.filter((p) => p.day === date);
    if (fold === 'last') {
      const until = kstDayStart(date) + DAY_MS;
      const upto = sorted.filter((p) => p.end <= until);
      out[date] = upto.length ? upto[upto.length - 1].v : null;
    } else if (!inDay.length) {
      out[date] = null;
    } else if (fold === 'max') {
      out[date] = Math.max(...inDay.map((p) => p.v));
    } else {
      out[date] = inDay.reduce((s, p) => s + p.v, 0);
    }
  }
  return out;
}

/** 묶음 이름(함수 이름 · 버킷 이름)별 날짜 값. groupBy 가 없으면 '' 하나. */
function foldByGroup(timeSeries, dates, fold, groupBy) {
  const label = groupBy ? groupBy.replace(/^resource\.label\./, '') : null;
  const pts = {};
  for (const ts of timeSeries || []) {
    const key = label ? String((ts.resource && ts.resource.labels && ts.resource.labels[label]) || '') : '';
    (pts[key] = pts[key] || []).push(...seriesPoints(ts));
  }
  const out = {};
  for (const key of Object.keys(pts)) out[key] = foldDays(pts[key], dates, fold);
  return out;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
// RTDB 키에 못 쓰는 글자(. # $ [ ] /) — 함수 이름엔 없지만 혹시 몰라 걸러 낸다.
const safeKey = (k) => typeof k === 'string' && k !== '' && !/[.#$[\]/]/.test(k);

/**
 * 받은 응답들 → 쓰기 묶음 { 'metrics/usage/{날짜}/{무리}': {...} }.
 * results[이름] = timeSeries 배열(빈 응답이면 []) 또는 undefined(못 받음 — 그 무리는 쓰지 않는다).
 */
function usageUpdates(results, dates, nowMs, bucket) {
  const g = (name) => {
    const q = QUERIES[name];
    return results[name] === undefined ? undefined : foldByGroup(results[name], dates, q.fold, q.groupBy);
  };
  const one = (byGroup, date) => {
    let sum = null;
    for (const k in byGroup) if (byGroup[k][date] !== null) sum = num(sum) + byGroup[k][date];
    return sum;
  };
  const dbSent = g('dbSent'), dbStored = g('dbStored'), dbConn = g('dbConn');
  const fn = g('fnCalls'), stSent = g('stSent'), stStored = g('stStored'), host = g('hostSent');
  const updates = {};
  for (const date of dates) {
    const base = METRICS_USAGE + '/' + date;
    if (dbSent && dbStored && dbConn) {
      updates[base + '/db'] = {
        sentBytes: num(one(dbSent, date)),
        storedBytes: one(dbStored, date),
        peakConnections: num(one(dbConn, date)),
        at: nowMs,
      };
    }
    if (fn) {
      const byName = {};
      let calls = 0;
      for (const name of Object.keys(fn).sort()) {
        const v = fn[name][date];
        if (!v || !safeKey(name)) continue;
        byName[name] = v;
        calls += v;
      }
      updates[base + '/functions'] = { calls, byName, at: nowMs };
    }
    if (stSent && stStored && bucket) {
      const sent = stSent[bucket] ? stSent[bucket][date] : null;
      const stored = stStored[bucket] ? stStored[bucket][date] : null;
      updates[base + '/storage'] = { bucket, sentBytes: num(sent), storedBytes: stored, at: nowMs };
    }
    if (host) updates[base + '/hosting'] = { sentBytes: num(one(host, date)), at: nowMs };
  }
  // null 은 RTDB 에서 «지우기» 라 빼고 쓴다 — 저장 용량을 아직 모르면 칸이 없다.
  for (const k in updates) for (const f in updates[k]) if (updates[k][f] === null) delete updates[k][f];
  return updates;
}

/** Monitoring 에서 한 지표를 받는다(페이지를 끝까지). 실패하면 던진다. */
async function fetchSeries(fetchFn, token, project, q, start, end) {
  const all = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const u = new URL(MONITORING_URL + encodeURIComponent(project) + '/timeSeries');
    u.searchParams.set('filter', `metric.type="${q.type}"`);
    u.searchParams.set('interval.startTime', new Date(start).toISOString());
    u.searchParams.set('interval.endTime', new Date(end).toISOString());
    u.searchParams.set('aggregation.alignmentPeriod', '3600s');
    u.searchParams.set('aggregation.perSeriesAligner', q.aligner);
    // 같은 묶음(함수 · 버킷) 안의 여러 시계열은 시간 칸마다 더한다 — 동시 접속은 DB 가 하나라 더해도 같다.
    u.searchParams.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
    if (q.groupBy) u.searchParams.append('aggregation.groupByFields', q.groupBy);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetchFn(u.toString(), { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error(q.type + ' HTTP ' + res.status);
    const j = await res.json();
    all.push(...((j && j.timeSeries) || []));
    pageToken = j && j.nextPageToken;
    if (!pageToken) break;
  }
  return all;
}

/**
 * 한 번 돌기. deps = { db, fetch, token, project, bucket } — 검사에서 가짜로 바꿔 끼운다.
 * 지표 하나가 실패해도(권한 · 일시 오류) 나머지는 쓴다. 쓰기는 한 번의 루트 update.
 */
async function runUsageSnapshot(deps, nowMs) {
  const { dates, start, end } = usageWindow(nowMs);
  const results = {};
  const failed = [];
  await Promise.all(Object.keys(QUERIES).map(async (name) => {
    try { results[name] = await fetchSeries(deps.fetch, deps.token, deps.project, QUERIES[name], start, end); }
    catch (e) { failed.push(name + ': ' + String(e && e.message || e)); }
  }));
  const updates = usageUpdates(results, dates, nowMs, deps.bucket);
  if (Object.keys(updates).length) await deps.db.ref().update(updates);
  console.log('[usageSnapshot]', JSON.stringify({ dates, wrote: Object.keys(updates).length, failed }));
  return { updates, failed };
}

module.exports = {
  METRICS_USAGE, QUERIES, usageWindow, kstDayStart, seriesPoints, foldDays, foldByGroup, usageUpdates,
  fetchSeries, runUsageSnapshot,
};
