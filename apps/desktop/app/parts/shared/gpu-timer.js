/* ═══ 🩺 gpu-timer.js — 실행 화면 한 장에 그래픽 칩 · JS 가 쓴 시간(1분 [프레임] 줄 꼬리) ══════════════
   «노트북에서 켜 두면 블루스크린» · «다른 프로그램이 버벅인다» 제보를 진단 기록 한 장으로 가르려는 진단이다.
   그린 장 수(frame-budget.js)만으로는 «한 장이 얼마나 무거운가» 를 모른다 — 장 수는 다 나와도 내장 그래픽이 꽉 찰 수 있다.
   ★ 그래픽 칩 시간은 WebGL2 타이머 질의(EXT_disjoint_timer_query_webgl2)로 잰다. 답은 몇 장 뒤에 오므로 poll 로 거둔다.
     확장이 없으면(WebGL1 · 꺼진 기기) «GPU 모름» — 0 으로 속이지 않는다.
   ⚠️ 재기만 한다 — 그리기 · 상한은 건드리지 않는다. 순수 계산은 검사 sim-gpu-timer.js 가 가짜 gl 로 돌린다. */
(function(){
'use strict';

const MAX_PENDING = 4;     // 답을 기다리는 질의가 이만큼이면 새로 재지 않는다(표본만 줄어든다 — 질의가 쌓이지 않게)
const STALE_POLLS = 120;   // 이만큼 거둬도 답이 안 오면 버린다(연결 끊김 뒤 되살아난 gl 의 옛 질의는 영영 안 끝난다)
const NS_PER_MS = 1e6;

/* 1분 통계 — 평균 · 최대. 표본이 없으면 null */
function createStats(){
  let n = 0, sum = 0, max = 0;
  function add(ms){
    if(!(ms >= 0) || !isFinite(ms)) return;
    n++; sum += ms; if(ms > max) max = ms;
  }
  function take(){
    const out = n ? { n, avg: sum / n, max } : null;
    n = 0; sum = 0; max = 0;
    return out;
  }
  return { add, take };
}

/* 그래픽 칩 시간 — begin()/end() 로 한 장을 감싸고, 매 장 poll() 로 끝난 답을 거둔다.
   isWebGL2 는 three.js 가 안다(renderer.capabilities.isWebGL2). WebGL1 이거나 확장이 없으면 ok=false 이고 모든 호출이 아무것도 안 한다. */
function createGpuTimer(gl, isWebGL2){
  return createGpuTimerWith(gl, (gl && isWebGL2) ? safeExt(gl) : null);
}
function safeExt(gl){ try{ return gl.getExtension('EXT_disjoint_timer_query_webgl2'); }catch(_){ return null; } }

/* 검사가 가짜 gl · ext 를 넣는 입구 */
function createGpuTimerWith(gl, ext){
  const ok = !!(gl && ext);
  const stats = createStats();
  let active = null, pending = [], lost = 0, waited = 0;

  function begin(){
    if(!ok || active || pending.length >= MAX_PENDING) return;
    try{
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      active = q;
    }catch(_){ active = null; }
  }
  function end(){
    if(!active) return;
    try{ gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); }catch(_){ try{ gl.deleteQuery(active); }catch(__){} }
    active = null;
  }
  function drop(q){ try{ gl.deleteQuery(q); }catch(_){} }
  /* 끝난 답을 앞에서부터 거둔다. 그 사이 «끊김»(disjoint — 절전 · 클럭 변경)이 났으면 기다리던 답은 믿을 수 없어 버린다 */
  function poll(){
    if(!ok || !pending.length) return;
    let disjoint = false;
    try{ disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT); }catch(_){ disjoint = true; }
    if(disjoint){ lost += pending.length; pending.forEach(drop); pending = []; return; }
    while(pending.length){
      const q = pending[0];
      let ready = false;
      try{ ready = !!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); }catch(_){ ready = false; }
      if(!ready){
        if(++waited > STALE_POLLS){ pending.shift(); drop(q); lost++; waited = 0; continue; }
        break;
      }
      pending.shift(); waited = 0;
      try{ stats.add(gl.getQueryParameter(q, gl.QUERY_RESULT) / NS_PER_MS); }catch(_){}
      drop(q);
    }
  }
  /* 1분 몫 — { ok, gpu: {n, avg, max} | null, lost }. ok=false 면 이 기기는 못 잰다 */
  function take(){
    const out = { ok, gpu: stats.take(), lost };
    lost = 0;
    return out;
  }
  return { ok, begin, end, poll, take };
}

/* [프레임] 줄 꼬리 — 예) « · GPU 평균 3.2ms 최대 11.0ms · JS 평균 1.4ms · 그리기 42 · 그림자 31»
   r = { gpu: take() 결과, js: createStats().take(), calls, casters } */
const ms1 = (x) => (Math.round(x * 10) / 10).toFixed(1) + 'ms';
function suffix(r){
  r = r || {};
  const out = [];
  const g = r.gpu;
  if(!g || !g.ok) out.push('GPU 모름');
  else if(!g.gpu) out.push('GPU 표본 없음');
  else out.push('GPU 평균 ' + ms1(g.gpu.avg) + ' 최대 ' + ms1(g.gpu.max));
  if(r.js) out.push('JS 평균 ' + ms1(r.js.avg) + ' 최대 ' + ms1(r.js.max));
  if(typeof r.calls === 'number') out.push('그리기 ' + r.calls);
  if(typeof r.casters === 'number') out.push('그림자 ' + r.casters);
  return ' · ' + out.join(' · ');
}

/* 그림자를 드리우는 보이는 메시 수 — 그림자 지도를 그릴 때 한 번씩 더 그려진다(three.js 는 이 횟수를 info 에 안 센다).
   부모가 숨었으면 안 센다. 1분에 한 번만 부른다(장면 전체를 돈다). */
function countCasters(root){
  let n = 0;
  (function walk(o){
    if(!o || o.visible === false) return;
    if(o.isMesh && o.castShadow) n++;
    const ch = o.children;
    if(ch) for(let i = 0; i < ch.length; i++) walk(ch[i]);
  })(root);
  return n;
}

const api = { MAX_PENDING, STALE_POLLS, createStats, createGpuTimer, createGpuTimerWith, suffix, countCasters };
if(typeof window !== 'undefined') window.TwGpuTimer = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
