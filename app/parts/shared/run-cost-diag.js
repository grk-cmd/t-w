/* ═══ 🩺 run-cost-diag.js — 실행 화면 렌더러가 그리기 밖에서 쓰는 시간(1분 [비용] 줄) ══════════════
   «실행 화면 렌더러가 frame() 밖에서 초당 수백 ms CPU 를 쓴다(창을 내려도)» 를 진단 기록 한 장으로 가르려는 진단이다.
   하트비트(100ms) · 클릭 통과 판정 · 방 patch · 좌석 맞춤(syncFriendSeats) · 한 장 안의 좌석 반복 / 그리기 / 나머지를
   1분 동안 모아 한 줄로 낸다. 재는 쪽은 performance.now() 차이만 넘긴다 — 동작 · 요청 · 화면은 안 바꾼다.
   ⚠️ main 은 렌더러 진단 줄을 200자에서 자른다(main.js companion:diagNote) — 줄은 LINE_MAX 안에서 끝난다.
   순수 계산은 검사 sim-run-cost-diag.js 가 가짜 시계로 돌린다. */
(function(){
'use strict';

const TAG = '[비용]';
const LINE_MAX = 200;   // main.js 가 렌더러 진단 줄을 자르는 길이
const KEYS = ['hb', 'hit', 'patch', 'sync', 'frame', 'seat', 'render'];
const ROOM = { solo: '혼자', work: '워킹룸', play: '투게더룸' };

/* 재는 장치 — 칸마다 횟수 · 합 · 최대. now 는 ms 를 주는 함수(검사는 가짜 시계) */
function createRunCostDiag(opt){
  const now = (opt && opt.now) || (() => performance.now());
  let acc = {}, since = now();
  function reset(){ acc = {}; for(const k of KEYS) acc[k] = { n: 0, sum: 0, max: 0 }; }
  reset();
  function slot(key){ return acc[key] || (acc[key] = { n: 0, sum: 0, max: 0 }); }
  function add(key, ms){
    if(!(ms >= 0) || !isFinite(ms)) return;
    const s = slot(key);
    s.n++; s.sum += ms; if(ms > s.max) s.max = ms;
  }
  function count(key){ slot(key).n++; }
  function sinceT(key, t0){ add(key, now() - t0); }
  /* fn 을 감싸 부를 때마다 걸린 시간을 key 에 더한다(던져도 잰다 · 돌려준 값은 그대로) */
  function timed(key, fn){
    return function(){
      const t0 = now();
      try{ return fn.apply(this, arguments); }
      finally{ add(key, now() - t0); }
    };
  }
  /* 1분 몫 — { sec, hb: {n, sum, max}, … } 를 돌려주고 비운다 */
  function take(){
    const t = now();
    const out = Object.assign({ sec: Math.max(0.001, (t - since) / 1000) }, acc);
    reset(); since = t;
    return out;
  }
  return { add, count, since: sinceT, timed, take };
}

/* 좌석 수 — 전체 · 보이는 몸(숨김 rig · 자리비움 투명 제외) · 반짝임 꾸밈(경험치 바 .lvx · 이름표 .np-star) */
function shown(el){ return !!el && !(el.style && el.style.display === 'none'); }
function countSeats(seats){
  const out = { all: 0, body: 0, shiny: 0 };
  if(!seats) return out;
  for(const s of seats){
    if(!s) continue;
    out.all++;
    if(s.rig && s.rig.visible !== false && !(s._lastOp < 0.001)) out.body++;   // 자리비움은 setSeatOpacity 가 _lastOp 0 으로 몸을 숨긴다
    const exp = s.expBarEl, np = s.namePlateEl;
    const lvx = shown(exp) && /(^|\s)lvx(\s|$)/.test(exp.className || '');
    const star = shown(np) && !!(np.querySelector && np.querySelector('.np-star'));
    if(lvx || star) out.shiny++;
  }
  return out;
}

/* 방 종류 — 방 코드가 없으면 혼자, 채널 2(투게더룸 · 시크릿룸)면 투게더룸, 아니면 워킹룸(room-state.js) */
function roomKind(code, channel){
  if(!code) return ROOM.solo;
  return channel === 2 ? ROOM.play : ROOM.work;
}

/* 숫자 — 작으면 소수 둘째, 크면 줄인다(줄 길이) */
function f(x){
  x = +x || 0;
  if(x < 10) return x.toFixed(2);
  if(x < 100) return x.toFixed(1);
  return String(Math.round(x));
}
const avg = (s) => s && s.n ? s.sum / s.n : 0;
const pair = (s) => (s ? s.n : 0) + '회 ' + f(avg(s)) + '/' + f(s ? s.max : 0) + 'ms';

/* [비용] 한 줄 — r = take() 결과, seats = countSeats(), room = roomKind().
   예) [비용] 하트비트 600회 0.42/3.10ms · 통과 1200회 0.08/1.20ms · patch 340 · 맞춤 340회 합 120 최대 4.20ms · 밖 초당 3.20ms · 한 장 1800 좌석 0.12 그리기 0.80 나머지 0.30ms · 좌석 8 몸 6 반짝 2 · 워킹룸
   n회 a/b = 횟수 · 평균/최대. «밖 초당» = 하트비트 + 통과 + 맞춤 합 ÷ 초. «한 장» 은 그린 장 수와 한 장 평균의 쪼갬 */
function line(r, seats, room){
  r = r || {};
  const sec = r.sec > 0 ? r.sec : 60;
  const hb = r.hb, hit = r.hit, sync = r.sync, fr = r.frame;
  const out = (s) => s ? s.sum : 0;
  const outside = (out(hb) + out(hit) + out(sync)) / sec;
  const n = fr ? fr.n : 0;
  const per = (s) => n ? out(s) / n : 0;
  const rest = Math.max(0, per(fr) - per(r.seat) - per(r.render));
  const st = seats || { all: 0, body: 0, shiny: 0 };
  const s = TAG + ' 하트비트 ' + pair(hb) + ' · 통과 ' + pair(hit)
    + ' · patch ' + (r.patch ? r.patch.n : 0)
    + ' · 맞춤 ' + (sync ? sync.n : 0) + '회 합 ' + f(out(sync)) + ' 최대 ' + f(sync ? sync.max : 0) + 'ms'
    + ' · 밖 초당 ' + f(outside) + 'ms'
    + ' · 한 장 ' + n + ' 좌석 ' + f(per(r.seat)) + ' 그리기 ' + f(per(r.render)) + ' 나머지 ' + f(rest) + 'ms'
    + ' · 좌석 ' + st.all + ' 몸 ' + st.body + ' 반짝 ' + st.shiny
    + ' · ' + (room || ROOM.solo);
  return s.length > LINE_MAX ? s.slice(0, LINE_MAX) : s;
}

/* 창 하나에 하나 — app.js(하트비트 · 프레임) · desktop-run(통과 판정) · room-entry(맞춤) · firebase-init(patch)이 같은 것에 더한다 */
const page = createRunCostDiag();

const api = { TAG, LINE_MAX, KEYS, ROOM, createRunCostDiag, countSeats, roomKind, line, page };
if(typeof window !== 'undefined') window.TwRunCostDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
