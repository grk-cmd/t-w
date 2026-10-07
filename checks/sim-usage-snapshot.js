/*
 * 사용량(비용) 기록 검사. functions/usage-snapshot.js 를 그대로 불러 가짜 Monitoring 응답 · 가짜 DB 로 돌린다.
 * 1. 날짜 · 구간  2. 하루 합계(합 · 최대 · 마지막 값 · 날짜 경계)  3. 쓰기 묶음(빈 응답 · 못 받은 지표 · 버킷)
 * 4. 처리기(가짜 fetch · 페이지 · 실패 하나)  5. index.js 연결 · 규칙
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = need('firebase-database-rules.json');
const FX = need('functions/index.js');
need('functions/usage-snapshot.js');
need('functions/daily-active.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

(async () => {
  const f = require(path.resolve('functions/usage-snapshot.js'));
  const T = (iso) => Date.parse(iso);
  // 1시간 칸 하나 — 끝 시각(UTC)과 값
  const pt = (endIso, v, dbl) => ({ interval: { endTime: endIso }, value: dbl ? { doubleValue: v } : { int64Value: String(v) } });
  const ser = (points, labels) => ({ resource: { labels: labels || {} }, points });
  const D = ['2026-10-06', '2026-10-07'];

  say('── 1. 날짜 · 구간');
  {
    const w = f.usageWindow(T('2026-10-07T03:20:00Z'));   // 서울 10-07 12:20
    chk(JSON.stringify(w.dates) === JSON.stringify(D), '다시 쓸 날짜 = 어제 · 오늘(서울)');
    chk(w.start === T('2026-10-04T15:00:00Z'), '구간 시작 = 그제 서울 자정(저장 용량을 그 전 값으로 채울 여유)');
    chk(w.end === T('2026-10-07T04:00:00Z'), '구간 끝 = 정시로 올림(칸이 정시에 맞는다)');
    const w2 = f.usageWindow(T('2026-10-06T15:00:00Z'));  // 서울 자정 딱
    chk(w2.dates[1] === '2026-10-07' && w2.dates[0] === '2026-10-06', '서울 자정이 지나면 날이 넘어간다');
    chk(f.kstDayStart('2026-10-07') === T('2026-10-06T15:00:00Z'), '서울 자정 = 전날 UTC 15시');
  }

  say('── 2. 하루 합계');
  {
    const pts = f.seriesPoints(ser([
      pt('2026-10-06T15:00:00Z', 100),   // 14~15시 UTC = 서울 10-06 23~24시 → 10-06
      pt('2026-10-06T16:00:00Z', 7),     // 서울 10-07 0~1시 → 10-07
      pt('2026-10-07T03:00:00Z', 5),
      pt('2026-10-05T15:00:00Z', 999),   // 끝이 서울 10-06 자정 = 그제 칸 → 어느 날에도 안 더함
      { interval: { endTime: 'x' }, value: { int64Value: '3' } },
    ]));
    chk(pts.length === 4, '끝 시각이 이상한 점은 버린다');
    chk(pts[0].day === '2026-10-06' && pts[1].day === '2026-10-07', '칸 끝이 서울 자정이면 그 칸은 전날 — 끝 직전 1ms 로 날짜');
    const sum = f.foldDays(pts, D, 'sum');
    chk(sum['2026-10-06'] === 100 && sum['2026-10-07'] === 12, '합 — 날짜 경계를 넘지 않고 그날 칸만');
    const max = f.foldDays(pts, D, 'max');
    chk(max['2026-10-07'] === 7, '최대 — 그날 칸 중 가장 큰 값');
    chk(f.foldDays([], D, 'sum')['2026-10-07'] === null, '표본이 없는 날은 null(0 과 «모름» 을 가른다)');
    const stored = f.foldDays(f.seriesPoints(ser([pt('2026-10-05T20:00:00Z', 50, true), pt('2026-10-06T10:00:00Z', 60, true)])), D, 'last');
    chk(stored['2026-10-06'] === 60, '마지막 값 — 그날 마지막 표본');
    chk(stored['2026-10-07'] === 60, '  ↳ 그날 표본이 없으면 그 전 마지막 값(저장 용량은 드문드문 찍힌다)');
    chk(f.seriesPoints(ser([pt('2026-10-07T01:00:00Z', 1.5, true)]))[0].v === 1.5, 'doubleValue 도 읽는다');
    const g = f.foldByGroup([
      ser([pt('2026-10-07T01:00:00Z', 3)], { function_name: 'roomStats' }),
      ser([pt('2026-10-07T02:00:00Z', 4)], { function_name: 'roomStats' }),
      ser([pt('2026-10-07T02:00:00Z', 1)], { function_name: 'visitPing' }),
    ], D, 'sum', 'resource.label.function_name');
    chk(g.roomStats['2026-10-07'] === 7 && g.visitPing['2026-10-07'] === 1, '묶음(함수 이름)별로 합한다');
  }

  say('── 3. 쓰기 묶음 (usageUpdates)');
  {
    const now = T('2026-10-07T03:20:00Z');
    const R = {
      dbSent: [ser([pt('2026-10-06T10:00:00Z', 2000), pt('2026-10-07T01:00:00Z', 300)])],
      dbStored: [ser([pt('2026-10-06T10:00:00Z', 4096)])],
      dbConn: [ser([pt('2026-10-06T10:00:00Z', 3), pt('2026-10-06T11:00:00Z', 9)])],
      fnCalls: [ser([pt('2026-10-07T01:00:00Z', 60)], { function_name: 'roomStats' }), ser([pt('2026-10-07T01:00:00Z', 0)], { function_name: 'idle' })],
      stSent: [
        ser([pt('2026-10-07T01:00:00Z', 70)], { bucket_name: 'p.firebasestorage.app' }),
        ser([pt('2026-10-07T01:00:00Z', 5000)], { bucket_name: 'gcf-v2-sources-1' }),
      ],
      stStored: [ser([pt('2026-10-06T01:00:00Z', 800, true)], { bucket_name: 'p.firebasestorage.app' })],
      hostSent: [],
    };
    const u = f.usageUpdates(R, D, now, 'p.firebasestorage.app');
    const y = 'metrics/usage/2026-10-06', t = 'metrics/usage/2026-10-07';
    chk(JSON.stringify(u[y + '/db']) === JSON.stringify({ sentBytes: 2000, storedBytes: 4096, peakConnections: 9, at: now }), '어제 DB — 다운로드 합 · 저장 용량 · 최대 동시 접속 · at');
    chk(u[t + '/db'].sentBytes === 300 && u[t + '/db'].storedBytes === 4096 && u[t + '/db'].peakConnections === 0, '오늘 DB — 저장 용량은 어제 값 이어받기 · 접속 표본 없으면 0');
    chk(JSON.stringify(u[t + '/functions']) === JSON.stringify({ calls: 60, byName: { roomStats: 60 }, at: now }), '함수 — 합 + 이름별(0 인 함수는 빼고)');
    chk(u[y + '/functions'].calls === 0 && JSON.stringify(u[y + '/functions'].byName) === '{}', '  ↳ 호출 없는 날은 0');
    chk(u[t + '/storage'].sentBytes === 70 && u[t + '/storage'].storedBytes === 800 && u[t + '/storage'].bucket === 'p.firebasestorage.app', 'Storage — 앱 버킷만(함수 소스 버킷 5000 은 뺀다)');
    chk(u[t + '/hosting'].sentBytes === 0, '빈 응답(timeSeries 없음)은 0 으로 쓴다');
    chk(Object.values(u).every((v) => Object.values(v).every((x) => x !== null && x !== undefined)), 'null 칸은 쓰지 않는다(RTDB 에서 null = 지우기)');
    const u2 = f.usageUpdates({ ...R, dbStored: undefined, fnCalls: undefined }, D, now, 'p.firebasestorage.app');
    chk(!(t + '/db' in u2) && !(t + '/functions' in u2) && (t + '/storage' in u2), '못 받은 지표가 든 무리는 쓰지 않는다 — 이전 값을 남긴다 · 나머지는 쓴다');
    const u3 = f.usageUpdates({ ...R, stStored: [] }, D, now, 'p.firebasestorage.app');
    chk(!('storedBytes' in u3[t + '/storage']), '버킷 저장 용량을 모르면 그 칸만 빠진다');
    chk(!(t + '/storage' in f.usageUpdates(R, D, now, null)), '버킷 이름을 모르면 Storage 는 안 쓴다');
    const u4 = f.usageUpdates({ fnCalls: [ser([pt('2026-10-07T01:00:00Z', 2)], { function_name: 'a.b' })] }, D, now, null);
    chk(JSON.stringify(u4[t + '/functions'].byName) === '{}', '키에 못 쓰는 이름(. # $ [ ] /)은 거른다');
    const empty = f.usageUpdates({}, D, now, 'b');
    chk(Object.keys(empty).length === 0, '아무것도 못 받으면 쓰기 묶음이 비어 있다');
  }

  say('── 4. 처리기 (runUsageSnapshot)');
  {
    const asked = [];
    const fakeFetch = async (url) => {
      const u = new URL(url);
      const type = /metric\.type="([^"]+)"/.exec(u.searchParams.get('filter'))[1];
      asked.push({ type, u });
      if (type.includes('active_connections')) return { ok: false, status: 403, json: async () => ({}) };
      if (type.endsWith('/sent_bytes_count') && type.startsWith('firebasedatabase')) {
        if (!u.searchParams.get('pageToken')) return { ok: true, json: async () => ({ timeSeries: [ser([pt('2026-10-07T01:00:00Z', 10)])], nextPageToken: 'p2' }) };
        return { ok: true, json: async () => ({ timeSeries: [ser([pt('2026-10-07T02:00:00Z', 5)])] }) };
      }
      return { ok: true, json: async () => ({}) };
    };
    const L = [];
    const db = { ref: (p) => ({ update: async (v) => { L.push([p, v]); } }) };
    const now = T('2026-10-07T03:20:00Z');
    const r = await f.runUsageSnapshot({ db, fetch: fakeFetch, token: 'TOK', project: 'demo', bucket: 'demo.firebasestorage.app' }, now);
    chk(asked.length === Object.keys(f.QUERIES).length + 1, '지표마다 한 번 + 다음 페이지 한 번');
    const one = asked[0].u;
    chk(one.pathname === '/v3/projects/demo/timeSeries' && one.searchParams.get('aggregation.alignmentPeriod') === '3600s', '1시간 칸으로 받는다');
    chk(asked.every((a) => a.u.searchParams.get('interval.startTime') === '2026-10-04T15:00:00.000Z'), '  ↳ 그제 서울 자정부터');
    chk(r.failed.length === 1 && /active_connections/.test(r.failed[0]), '실패한 지표는 이름과 함께 남긴다');
    chk(L.length === 1 && L[0][0] === undefined, '한 번의 루트 update');
    chk(!('metrics/usage/2026-10-07/db' in L[0][1]), '  ↳ 동시 접속을 못 받아 DB 무리는 이번에 안 쓴다(다운로드 값도 이전 것 유지)');
    chk('metrics/usage/2026-10-07/functions' in L[0][1] && 'metrics/usage/2026-10-07/hosting' in L[0][1], '  ↳ 나머지 무리는 쓴다');
    const ok2 = await f.runUsageSnapshot({ db, fetch: async (url) => /active_connections/.test(url) ? { ok: true, json: async () => ({}) } : fakeFetch(url), token: 'T', project: 'demo', bucket: 'b' }, now);
    chk(ok2.updates['metrics/usage/2026-10-07/db'].sentBytes === 15, '다음 페이지(nextPageToken)까지 합한다');
    const L0 = L.length;
    await f.runUsageSnapshot({ db, fetch: async () => { throw new Error('net'); }, token: 'T', project: 'demo', bucket: 'b' }, now);
    chk(L.length === L0, '모두 실패하면 쓰지 않는다');
  }

  say('── 5. index.js 연결 · 규칙');
  {
    const CODE = strip(FX);
    const m = CODE.match(/exports\.usageSnapshot = onSchedule\(\{[^\n]*\n[\s\S]*?\n  \}\);/);
    chk(!!m, 'usageSnapshot = onSchedule(…)');
    chk(!!m && /schedule: 'every 60 minutes'/.test(m[0]) && /maxInstances: 1/.test(m[0]) && /retryCount: 0/.test(m[0]), '  ↳ 매시간 · 인스턴스 1 · 재시도 없음');
    chk(!!m && /require\('\.\/usage-snapshot'\)\.runUsageSnapshot\(/.test(m[0]), '  ↳ 처리는 usage-snapshot.js 에 맡긴다');
    chk(!!m && /require\('firebase-admin\/database'\)/.test(m[0]), '  ↳ firebase-admin/database 는 실행할 때 읽는다 (배포 때 10초 로딩 제한)');
    chk(/usageSnapshot — 사용량/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    const US = strip(need('functions/usage-snapshot.js'));
    chk(!/require\('firebase-admin/.test(US), 'usage-snapshot.js 는 firebase-admin 을 부르지 않는다(DB · 토큰은 받아서 쓴다)');
    chk(f.METRICS_USAGE === 'metrics/usage', '쓰는 곳 = metrics/usage');
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const mr = rules && rules.metrics;
    chk(!!mr && /admins.*auth\.uid/.test(mr['.read']) && !JSON.stringify(mr).includes('.write') && !('usage' in mr), '규칙: metrics(아래 usage 포함) 읽기는 관리자만 · 쓰기 규칙 없음(서버만)');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
