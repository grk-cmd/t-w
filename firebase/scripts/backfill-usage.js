#!/usr/bin/env node
/* ═══ 💰 scripts/backfill-usage.js — 사용량 기록(metrics/usage)의 빠진 지난 날짜를 Cloud Monitoring 에서 채우기 ═══
   함수 usageSnapshot(functions/usage-snapshot.js)은 매시간 어제 · 오늘만 적는다. 함수를 배포하기 전 날짜 · 함수가 멈췄던 날은
   칸이 비어 📉 개선 기록의 «전» 구간을 잴 수 없다. 이 도구가 Monitoring 에 남아 있는 날(약 6주)만 같은 지표 · 같은 집계로 채운다.
   앱에 실리지 않는 관리용 도구다.

   실행(저장소 루트 · gcloud 로그인 — 그 계정에 프로젝트 Monitoring 읽기 · RTDB 관리 권한이 있어야 한다):
     node scripts/backfill-usage.js --project together-working-dev            ← 미리 보기(읽기만 · 날짜별 값과 채울 날짜 출력)
     node scripts/backfill-usage.js --project together-working-dev --write    ← 빠진 날짜만 한 번의 update 로 쓰기
   --project 는 꼭 적는다(기본 프로젝트가 운영이라 빠뜨리면 운영을 읽는다).
   --days <n>(기본 42 · 최대 45) 오늘부터 거슬러 볼 날 수 · --bucket <이름>(기본 {project}.firebasestorage.app) · --instance <이름>

   읽는 것: metrics/usage 날짜 키 목록(shallow · 값 없음) 1번 + Monitoring 지표 7개(usage-snapshot.js 의 QUERIES 그대로 · 1시간 칸).
   쓰는 것: **칸이 아예 없는 날짜만**. 이미 있는 날짜는 일부 무리가 비어 있어도 건드리지 않는다(덮어쓰지 않는다).
     어제 · 오늘은 함수 몫이라 보지 않는다. Monitoring 에 DB 다운로드 · 동시 접속 표본이 없는 날은 0 으로 채우지 않고 건너뛴다
     (보존 기간을 넘긴 날 · 지표가 아직 없던 날). 무리(함수 · Storage · Hosting)도 그날 표본이 있을 때만 쓴다.
   쓰기 직전에 날짜 키를 다시 읽어 그사이 생긴 날짜는 뺀다. 두 번 돌려도 같다(채운 날짜는 다음엔 «있음»). */
'use strict';
const { execFileSync } = require('child_process');
const { kstDateKey } = require('../functions/daily-active');
const { METRICS_USAGE, QUERIES, kstDayStart, foldByGroup, usageUpdates, fetchSeries } = require('../functions/usage-snapshot');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 42;
const MAX_DAYS = 45;
const GB = 2 ** 30;
const MB = 2 ** 20;

/** 오늘(서울)에서 거슬러 n 일 ~ 그제. 어제 · 오늘은 함수가 매시간 다시 쓰므로 뺀다. 오래된 날부터. */
function candidateDates(nowMs, days) {
  const today = kstDayStart(kstDateKey(nowMs));
  const out = [];
  for (let i = days; i >= 2; i--) out.push(kstDateKey(today - i * DAY_MS));
  return out;
}

/** Monitoring 을 받을 구간 — 가장 오래된 날 하루 전(저장 용량 «그 전 마지막 값») ~ 어제 서울 자정(그제까지). 정시라 칸이 맞는다. */
function fetchRange(dates) {
  return { start: kstDayStart(dates[0]) - DAY_MS, end: kstDayStart(dates[dates.length - 1]) + DAY_MS };
}

/** 그날 표본이 하나라도 있었나 — 지표 이름 → 날짜 → 참/거짓. Storage 지표는 앱 버킷 묶음만 본다. */
function presence(results, dates, bucket) {
  const out = {};
  for (const name of Object.keys(QUERIES)) {
    if (results[name] === undefined) continue;
    const q = QUERIES[name];
    const byGroup = foldByGroup(results[name], dates, q.fold, q.groupBy);
    const only = name === 'stSent' || name === 'stStored' ? bucket : null;
    out[name] = {};
    for (const date of dates) {
      out[name][date] = Object.keys(byGroup).some((k) => (only === null || k === only) && byGroup[k][date] !== null);
    }
  }
  return out;
}

/**
 * 받은 응답 → 쓸 묶음. existing 은 이미 있는 날짜(Set) — 그 날짜는 절대 쓰지 않는다.
 * 돌려주는 것: { updates, fill: [채울 날짜], have: [이미 있는 날짜], empty: [표본이 없어 건너뛴 날짜] }
 */
function backfillPlan(results, dates, existing, nowMs, bucket) {
  const have = dates.filter((d) => existing.has(d));
  const missing = dates.filter((d) => !existing.has(d));
  const raw = usageUpdates(results, missing, nowMs, bucket);
  const has = presence(results, missing, bucket);
  const ok = (name, date) => !!(has[name] && has[name][date]);
  const groupNeeds = { db: ['dbSent', 'dbConn'], functions: ['fnCalls'], storage: ['stSent'], hosting: ['hostSent'] };
  const updates = {};
  const fill = [];
  const empty = [];
  for (const date of missing) {
    if (!ok('dbSent', date) || !ok('dbConn', date) || !raw[`${METRICS_USAGE}/${date}/db`]) {
      empty.push(date);
      continue;
    }
    fill.push(date);
    for (const group of Object.keys(groupNeeds)) {
      const key = `${METRICS_USAGE}/${date}/${group}`;
      if (raw[key] && groupNeeds[group].every((n) => ok(n, date))) updates[key] = raw[key];
    }
  }
  return { updates, fill, have, empty };
}

module.exports = { candidateDates, fetchRange, presence, backfillPlan };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const WRITE = args.includes('--write');
  const PROJECT = opt('--project');
  const INSTANCE = opt('--instance');
  const DAYS = Math.max(3, Math.min(MAX_DAYS, Number(opt('--days')) || DEFAULT_DAYS));
  const BUCKET = opt('--bucket') || (PROJECT ? PROJECT + '.firebasestorage.app' : null);
  // 두 프로젝트 모두 RTDB 가 asia-southeast1 이다(functions · 앱 설정과 같다).
  const DB_URL = `https://${INSTANCE || PROJECT + '-default-rtdb'}.asia-southeast1.firebasedatabase.app`;

  if (!PROJECT) {
    console.error('✗ --project 를 적어 주세요 (예: --project together-working-dev). 기본 프로젝트는 운영이라 빠뜨리면 안 돼요.');
    process.exit(2);
  }

  const token = () => execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  const fmt = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  (async () => {
    console.log(`프로젝트 ${PROJECT}${INSTANCE ? ' · ' + INSTANCE : ''} · 버킷 ${BUCKET} · ${WRITE ? '쓰기(--write)' : '미리 보기(읽기만)'}`);
    const tok = token();
    const auth = { headers: { Authorization: 'Bearer ' + tok } };
    const readKeys = async () => {
      const res = await fetch(`${DB_URL}/${METRICS_USAGE}.json?shallow=true`, auth);
      if (!res.ok) throw new Error(`${METRICS_USAGE} 날짜 목록 HTTP ${res.status}`);
      return new Set(Object.keys((await res.json()) || {}));
    };

    const nowMs = Date.now();
    const dates = candidateDates(nowMs, DAYS);
    const existing = await readKeys();
    console.log(`볼 날짜 ${dates[0]} ~ ${dates[dates.length - 1]} (${dates.length}일 · 어제 · 오늘은 함수 몫) · 이미 있는 날짜 ${dates.filter((d) => existing.has(d)).length}개`);

    const { start, end } = fetchRange(dates);
    const results = {};
    const failed = [];
    for (const name of Object.keys(QUERIES)) {
      try { results[name] = await fetchSeries(fetch, tok, PROJECT, QUERIES[name], start, end); }
      catch (e) { failed.push(name + ': ' + String((e && e.message) || e)); }
    }
    if (failed.length) console.warn('  ! 못 받은 지표 — 그 무리는 쓰지 않는다:\n    ' + failed.join('\n    '));

    const plan = backfillPlan(results, dates, existing, nowMs, BUCKET);
    console.log('\n날짜         상태        DB 다운로드  최대 동시 접속  접속당');
    for (const date of dates) {
      const db = plan.updates[`${METRICS_USAGE}/${date}/db`];
      const state = existing.has(date) ? '있음(안 씀)' : db ? '채움' : '표본 없음';
      const line = db
        ? `${fmt(db.sentBytes / GB, 2).padStart(9)} GB  ${String(db.peakConnections).padStart(12)}  ${db.peakConnections ? fmt(db.sentBytes / db.peakConnections / MB, 2) + ' MB' : '–'}`
        : '';
      console.log(`${date}  ${state.padEnd(10)}  ${line}`);
    }
    console.log(`\n채울 날짜 ${plan.fill.length}개 · 이미 있음 ${plan.have.length}개 · 표본 없어 건너뜀 ${plan.empty.length}개 · 쓸 칸 ${Object.keys(plan.updates).length}개`);
    if (!WRITE) { console.log('미리 보기만 했어요 — 쓰려면 --write 를 붙여 다시 실행하세요.'); return; }
    if (!plan.fill.length) { console.log('채울 날짜가 없어요.'); return; }

    const again = await readKeys();
    const updates = {};
    for (const [k, v] of Object.entries(plan.updates)) if (!again.has(k.split('/')[2])) updates[k] = v;
    const res = await fetch(`${DB_URL}/.json`, { method: 'PATCH', headers: { ...auth.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error(`쓰기 HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    console.log(`✅ ${Object.keys(updates).length}칸을 썼어요. 💰 사용량 · 📉 개선 기록에서 확인하세요.`);
  })().catch((e) => { console.error('✗ ' + ((e && e.message) || e)); process.exit(1); });
}
