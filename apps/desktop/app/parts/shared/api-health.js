/* api-health.js — 🩺 API 가 닿는가 한 곳 · 닿지 않는 동안 확인 요청 하나 (검사 sim-api-health.js)
   [왜] API 배포로 서버가 30초~1분 내려간 사이에 앱을 켜면 켤 때 읽기가 실패하는데, 앱은 서버가 돌아온 때를 몰라 그 값이 «못 받음» 으로 남았다
     (B-1128-2 — 레벨 1). 기능마다 타이머로 다시 묻게 하면 요청만 늘고, 사용자 수백 명이 같은 때 켜면 서버가 돌아오자마자 몰린다.
     그래서 «닿지 않음» 을 여기 한 곳에서 보고, 그 동안에만 가벼운 확인 요청 하나를 간격을 두고 보낸다. 무엇이든 하나 성공하면 «복귀» 를 한 번 알린다.
   [모양] createApiHealth({ probe, setTimeout, clearTimeout, note, delays? }) → { down(), ok(), onRecover(fn) → 떼는 함수, isDown(), reset() }
     down() — api-client.js 가 «서버가 답하지 못한» 실패(네트워크 · 시간 초과 · 봉투가 아닌 응답 — 앞단 502/503 페이지)를 봤을 때.
       4xx · notReady · 우리 API 가 봉투로 답한 5xx 는 부르지 않는다(서버는 답했다 — 그 기능의 실패일 뿐. 세면 확인 성공 → 복귀 → 다시 받기 → 같은 5xx 로 끝없이 돈다).
       닿지 않음이 처음이면 진단 `[api] 닿지 않음` · 확인 타이머가 없으면 하나 건다.
     ok() — 아무 요청이든 성공했을 때. 닿지 않음이었으면 타이머를 멈추고 진단 `[api] 복귀` · onRecover 구독자를 한 번씩 부른다.
     확인 — DELAYS 간격(10초 · 30초 · 1분 · 2분 · 5분, 그 뒤 5분마다)으로 probe() 하나(진단 `[api] 확인 n번째 · 간격 N초`). 여러 기능이 실패해 있어도 타이머는 하나다.
       확인이 실패해 아직 닿지 않음이면 다음 간격으로 하나 더. 닿지 않음이 아니면 타이머가 없다.
     reset() — 계정을 놓을 때(api-client forgetSession) 타이머를 멈추고 닿지 않음을 잊는다(구독자는 남는다 — 기능은 자기 세션에서 거른다).
   ★ DOM · 전역 타이머 · 요청을 직접 모른다 — probe · setTimeout · clearTimeout · note 는 부르는 쪽(api-client.js 앱 한 벌)이 넣는다. 앱 한 벌은 TwApi.health.
   ★ 받는 쪽은 «못 받은 상태일 때만 한 번» 다시 받는다(shared/load-state.js) — 복귀 알림이 곧 다시 묻기 계기다. 기능별 재시도 타이머를 두지 않는다.
   classic script(window.TwApiHealth) — api-client.js 보다 먼저 싣는다. */
(function(){
'use strict';

const DELAYS = Object.freeze([10000, 30000, 60000, 120000, 300000]);   // 확인 간격 — n 번째 확인은 DELAYS[n-1](끝 값 5분에서 멈추고 그 뒤로는 5분마다)

/** @param {{ probe: () => Promise<unknown>, setTimeout: (fn: Function, ms: number) => unknown, clearTimeout: (h: unknown) => void, note?: (line: string) => unknown, delays?: number[] }} deps */
function createApiHealth(deps){
  const probe = deps.probe;
  const tSet = deps.setTimeout;
  const tClear = deps.clearTimeout;
  const note = deps.note || (() => {});
  const delays = deps.delays || DELAYS;
  let downNow = false;
  let sent = 0;          // 이번 닿지 않음 동안 보낸 확인 수
  let timer = null;
  const fns = [];

  function say(line){ try{ note('[api] ' + line); }catch(_){} }
  function arm(){
    if(timer != null || !downNow) return;
    const ms = delays[Math.min(sent, delays.length - 1)];
    timer = tSet(() => fire(ms), ms);
  }
  function fire(ms){
    timer = null;
    if(!downNow) return;
    sent++;
    say('확인 ' + sent + '번째 · 간격 ' + Math.round(ms / 1000) + '초');
    let p;
    try{ p = Promise.resolve(probe()); }catch(e){ p = Promise.reject(e); }
    p.catch(() => {}).then(() => arm());   // 아직 닿지 않음이면 다음 간격(성공했으면 ok() 가 이미 풀었다 · 4xx 로 끝나도 닿지 않음이 남아 있으면 이어 간다)
  }
  function down(){
    if(!downNow){ downNow = true; say('닿지 않음'); }   // sent 는 ok() · reset() 이 비운다 — 다시 닿지 않으면 간격을 처음부터
    arm();
  }
  function ok(){
    if(!downNow) return;
    downNow = false; sent = 0;
    if(timer != null){ try{ tClear(timer); }catch(_){} timer = null; }
    say('복귀');
    fns.slice().forEach((fn) => { try{ fn(); }catch(e){ console.warn('[api] 복귀 알림 실패', e); } });
  }
  function onRecover(fn){
    fns.push(fn);
    return () => { const i = fns.indexOf(fn); if(i >= 0) fns.splice(i, 1); };
  }
  function reset(){
    downNow = false; sent = 0;
    if(timer != null){ try{ tClear(timer); }catch(_){} timer = null; }
  }
  return { down, ok, onRecover, isDown: () => downNow, reset };
}

const api = { DELAYS, createApiHealth };
if(typeof window !== 'undefined') window.TwApiHealth = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
