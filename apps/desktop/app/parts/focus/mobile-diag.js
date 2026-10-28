/* mobile-diag.js — 📱 태블릿·폰 연결 진단 줄 (검사 sim-mobile-diag.js)
   설정 › 포커싱 칸에 PC 가 받은 신호를 한 줄로 — 설치본에서 연결이 풀리는 까닭을 가를 다른 길이 없다(개발자 도구가 막혀 있다).
   ★ 신호 하나 = 폰이 PUT 한 state 의 ts(서버 시각). 같은 ts 가 다시 오면 새 신호가 아니다 — PC 부팅 초기화(on 만 내림)가 그렇다.
   ⚠️ 읽기만 한다 — 켜짐 판정(_mobileOn)은 그대로다.
   순수 함수(DOM · firebase 없음). focus-level.js 가 deps(mobileDiag)로 받는다. */
(function(){
'use strict';

const HIST_MAX = 2;   // 마지막 신호와 그 전 신호 — 둘의 간격이 «거의 같이 옴» 을 보여 준다

const empty = () => ({ hist: [], count: 0, lastTs: 0, reset: null, live: null });
const tsOf = (x) => (typeof x === 'number' && isFinite(x) && x > 0) ? x : 0;
const appOf = (x) => (typeof x === 'string') ? x.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : '';

/* d: 지금 기록 · ev: { kind:'state', v, first } | { kind:'reset', v } | { kind:'live', has } → 새 기록(d 는 안 바꾼다)
   first = 구독을 건 뒤 처음 온 값(이번 실행 전에 보낸 신호라 수에 넣지 않는다) */
function next(d, ev){
  const o = d || empty();
  if(!ev) return o;
  if(ev.kind === 'live') return { ...o, live: ev.has === true };
  const v = ev.v, ts = tsOf(v && v.ts);
  if(!ts) return o;
  const sig = { on: v.on === true, app: appOf(v.app), ts };
  if(ev.kind === 'reset'){
    // 부팅 초기화가 내린 «켜짐» — 원래 신호를 남기고, 곧 같은 ts 로 오는 «꺼짐» 은 아래에서 버린다
    return { ...o, hist: [sig].concat(o.hist).slice(0, HIST_MAX), lastTs: ts, reset: ts };
  }
  if(ev.kind !== 'state' || ts === o.lastTs) return o;
  return { ...o, hist: [sig].concat(o.hist).slice(0, HIST_MAX), lastTs: ts, count: o.count + (ev.first ? 0 : 1) };
}

const pad = (n) => String(n).padStart(2, '0');
function clock(ts){ const t = new Date(ts); return pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds()); }
const sigText = (s, fmt) => fmt(s.ts) + ' ' + (s.on ? '열림' : '닫힘') + (s.app ? '(' + s.app + ')' : '');

/* 화면에 쓸 한 줄(textContent 로만 넣는다) — fmt 는 시각 글자(검사가 바꿔 끼운다) */
function line(d, fmt){
  const f = fmt || clock;
  const o = d || empty();
  const out = [];
  if(o.live === false) out.push('⚠️ PC 켜짐 표시 없음 — 폰 신호가 거절돼요');
  if(!o.hist.length) out.push('받은 신호 없음');
  else {
    out.push('마지막 신호 ' + sigText(o.hist[0], f));
    if(o.reset && o.reset === o.hist[0].ts) out.push('PC 를 켤 때 꺼짐으로 바꿈');
    if(o.hist[1]) out.push('그 전 ' + sigText(o.hist[1], f));
  }
  out.push('이번 실행 ' + o.count + '번');
  return '🔍 ' + out.join(' · ');
}

window.TwMobileDiag = Object.freeze({ HIST_MAX, empty, next, line });
})();
