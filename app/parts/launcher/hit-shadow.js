/* hit-shadow.js — 🗺️ 히트 맵 그림자 운행(나란히 돌리기)의 셈 · 1분 [지도] 줄
   왜: 통과 판정을 히트 맵(hit-map.js)으로 바꾸기 전에, 옛 판정이 답을 정하는 그대로 두고 새 판정을 옆에서 돌려
     «두 답이 다른 적이 있나 · 지도가 낡은 적이 얼마나 되나 · 판정이 어느 구간에서 얼마나 걸리나» 를 사용자 PC 들에서 모은다.
   ★ 판정 · 화면 · 요청은 안 바꾼다 — 세고 줄을 만들기만. 끝내는 조건(지도만통과 0 · 지도만받기 0 · 낡음 1% 아래 ·
     지도 만들기 평균 0.2ms 아래)은 설계 tw-docs design/app/hit-map.md 3-4.
   ★ 새 판정은 옛 판정을 한 번 더 도는 셈이라 비용이 는다 — 광선을 쏘는 몫은 BUDGET_MS(1초 창마다)까지만 쓰고
     넘으면 그 판정은 건너뛴다(건너뜀 칸). 지도 안에 드는지만 보는 몫은 늘 돈다(구간 칸).
   ⚠️ main 은 렌더러 진단 줄을 200자에서 자른다 — 줄은 LINE_MAX 안에서 끝난다.
   검사: checks/sim-hit-shadow.js */
(function(){
'use strict';

const TAG = '[지도]';
const TAG_X = '[지도✗]';
const LINE_MAX = 200;              // main.js 가 렌더러 진단 줄을 자르는 길이
const BUDGET_MS = 10;              // 새 판정이 1초에 쓸 수 있는 시간(그 창 안에서 넘으면 건너뜀)
const BUDGET_WINDOW_MS = 1000;
const KIND = { leak: '지도만통과', grab: '지도만받기' };   // leak = 옛 판정은 맞음 · 새 판정은 못 맞춤(샘)
const ZONES = ['far', 'near', 'on'];
const ZONE_NAME = { far: '먼', near: '근처', on: '위' };

function stat(){ return { n: 0, sum: 0, max: 0 }; }
function add(s, ms){
  if(!(ms >= 0) || !isFinite(ms)) return;
  s.n++; s.sum += ms; if(ms > s.max) s.max = ms;
}

/* now 는 ms 를 주는 함수(검사는 가짜 시계) */
function createHitShadow(opt){
  const now = (opt && opt.now) || (() => performance.now());
  let acc, since = now(), winAt = -Infinity, winSpent = 0;
  let last = { seats: 0, parts: 0, tris: 0, full: 0 };
  function reset(){
    acc = { n: 0, same: 0, leak: 0, grab: 0, stale: 0, skip: 0, err: 0,
      zone: { far: stat(), near: stat(), on: stat() }, neu: stat(), build: stat(), buildErr: 0,
      detail: { leak: null, grab: null } };
  }
  reset();
  /* 이 판정에서 새 판정이 광선을 쏴도 되나 — 1초 창마다 BUDGET_MS 까지 */
  function allow(t){
    if(t - winAt >= BUDGET_WINDOW_MS || t < winAt){ winAt = t; winSpent = 0; }
    return winSpent < BUDGET_MS;
  }
  /* 판정 한 번 — r = { old: 옛 답, neu: 새 답(건너뛰었으면 null), stale, inRect, oldMs, newMs, err, detail }
     detail 은 다를 때만(부르는 쪽이 만든다) — 종류마다 1분에 첫 번째 것만 남긴다 */
  function record(r){
    acc.n++;
    const zone = r.old ? 'on' : (r.inRect ? 'near' : 'far');
    add(acc.zone[zone], r.oldMs);
    if(r.stale) acc.stale++;
    if(r.err){ acc.err++; return; }
    if(r.newMs >= 0){ add(acc.neu, r.newMs); winSpent += r.newMs; }
    if(r.neu === null || r.neu === undefined){ acc.skip++; return; }
    if(!!r.old === !!r.neu){ acc.same++; return; }
    const k = r.old ? 'leak' : 'grab';
    acc[k]++;
    if(!acc.detail[k] && r.detail) acc.detail[k] = r.detail;
  }
  /* 지도 한 장 만든 시간 · 그 장의 크기(좌석 · 조각 · 삼각형 · 모르는 조각) */
  function build(ms, st, err){
    add(acc.build, ms);
    if(err) acc.buildErr++;
    if(st) last = { seats: st.seats | 0, parts: st.parts | 0, tris: st.tris | 0, full: st.full | 0 };
  }
  /* 1분 몫을 돌려주고 비운다 */
  function take(){
    const t = now();
    const out = Object.assign({ sec: Math.max(0.001, (t - since) / 1000), last }, acc);
    reset(); since = t;
    return out;
  }
  return { allow, record, build, take };
}

function f(x){
  x = +x || 0;
  if(x < 10) return x.toFixed(2);
  if(x < 100) return x.toFixed(1);
  return String(Math.round(x));
}
const avg = (s) => s && s.n ? s.sum / s.n : 0;
const k = (n) => n >= 1000 ? Math.round(n / 1000) + 'k' : String(n | 0);
const cut = (s) => s.length > LINE_MAX ? s.slice(0, LINE_MAX) : s;

/* [지도] 한 줄 — r = take(). 판정이 없던 분이면 null.
   예) [지도] 판정 5400 같음 5398 지도만통과 0 지도만받기 0 낡음 2 건너뜀 2 · 먼 4100 0.06 근처 1100 4.10 위 200 5.20ms · 새 0.01/5.90ms · 지도 1200장 0.03/0.20ms 좌석 3 조각 96 삼각 41k 모름 0 · 더함 초당 0.95ms
   구간 = 옛 판정 횟수 · 평균 시간. «새» = 새 판정 평균/최대. «더함 초당» = (새 판정 + 지도 만들기) 합 ÷ 초 — 이 운행이 더하는 몫 */
function line(r){
  if(!r || !r.n) return null;
  const z = r.zone || {};
  const zs = ZONES.map(n => ZONE_NAME[n] + ' ' + (z[n] ? z[n].n : 0) + ' ' + f(avg(z[n]))).join(' ');
  const b = r.build || stat(), nu = r.neu || stat(), ls = r.last || {};
  const sec = r.sec > 0 ? r.sec : 60;
  const extra = (nu.sum + b.sum) / sec;
  const s = TAG + ' 판정 ' + r.n + ' 같음 ' + r.same + ' ' + KIND.leak + ' ' + r.leak + ' ' + KIND.grab + ' ' + r.grab
    + ' 낡음 ' + r.stale + ' 건너뜀 ' + r.skip + (r.err ? ' 오류 ' + r.err : '')
    + ' · ' + zs + 'ms'
    + ' · 새 ' + f(avg(nu)) + '/' + f(nu.max) + 'ms'
    + ' · 지도 ' + b.n + '장 ' + f(avg(b)) + '/' + f(b.max) + 'ms' + (r.buildErr ? ' 실패 ' + r.buildErr : '')
    + ' 좌석 ' + (ls.seats | 0) + ' 조각 ' + (ls.parts | 0) + ' 삼각 ' + k(ls.tris) + ' 모름 ' + (ls.full | 0)
    + ' · 더함 초당 ' + f(extra) + 'ms';
  return cut(s);
}

/* [지도✗] 다를 때 줄 — d = { x, y, seat, kind, rect, age, fly, ride, bench, away, drag, oldWhy }
   예) [지도✗] 지도만통과 (812,640) 좌석#2 몸 사각(700,500,180,260) 나이 48ms 날 0 탐 1 벤 0 비움 0 끌 0 옛=char:other#2 */
function detailLine(kind, d){
  d = d || {};
  const n = (v) => isFinite(v) ? String(Math.round(v)) : (v > 0 ? '∞' : '-∞');
  const rc = d.rect ? '사각(' + n(d.rect.l) + ',' + n(d.rect.t) + ',' + n(d.rect.r - d.rect.l) + ',' + n(d.rect.b - d.rect.t) + ')' : '사각없음';
  const b = (v) => v ? 1 : 0;
  const s = TAG_X + ' ' + (KIND[kind] || kind) + ' (' + n(d.x) + ',' + n(d.y) + ') 좌석#' + (d.seat >= 0 ? d.seat : '?')
    + ' ' + (d.kind === 'rig' ? '몸' : d.kind === 'base' ? '책상' : '?') + ' ' + rc
    + ' 나이 ' + (isFinite(d.age) ? Math.round(d.age) + 'ms' : '없음')
    + ' 날 ' + b(d.fly) + ' 탐 ' + b(d.ride) + ' 벤 ' + b(d.bench) + ' 비움 ' + b(d.away) + ' 끌 ' + b(d.drag)
    + ' 옛=' + (d.oldWhy || '-');
  return cut(s);
}

/* 1분에 적을 줄들 — [지도] 한 줄 + 다른 종류마다 [지도✗] 한 줄. 판정이 없던 분이면 빈 배열 */
function lines(r){
  const head = line(r);
  if(!head) return [];
  const out = [head];
  for(const kd of ['leak', 'grab']) if(r[kd] && r.detail && r.detail[kd]) out.push(detailLine(kd, r.detail[kd]));
  return out;
}

const api = { TAG, TAG_X, LINE_MAX, BUDGET_MS, BUDGET_WINDOW_MS, KIND, createHitShadow, line, detailLine, lines };
if(typeof window !== 'undefined') window.TwHitShadow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
