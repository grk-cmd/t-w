/* ═══ 🧯 3D 그리기 연결이 끊겼을 때 — parts/gl-recover.js ═══════════════════════════
   메인 화면 캔버스의 WebGL 연결(context)이 끊기면 기록하고, 정해진 시간 안에 안 돌아오면 화면을 **한 번** 다시 불러온다.
   [왜] OBS 를 켠 채 앱을 켜면 «앱이 멈추고 얼굴이 사라진 뒤 OBS 가 크래시» 제보(#11). OBS 충돌 보고서는 OBS 의
     브라우저 소스(크롬 엔진)가 GPU 를 잃고 스스로 멈춘 모양이었다 — 같은 순간 우리 크롬 엔진도 GPU 를 잃는다.
     three.js(r128)는 끊기면 preventDefault 하고 돌아오면 다시 올리지만, **돌아오지 않으면** 얼굴 없는 화면에 그대로 남는다.
   ★ 순수 규칙만 — 화면 · IPC 는 deps 로 받는다(sim-gl-recover.js 가 node 로 돌린다).
   ⚠️ 다시 불러오기는 세션당 RELOAD_MAX 번. 계속 끊기는 PC 에서 무한 재시작으로 CPU 를 태우지 않게 한다.
     세는 값은 sessionStorage(다시 불러와도 남고, 앱을 끄면 사라진다).
   ⚠️ app.js 보다 먼저 싣는다(classic script · window.GlRecover). */
(function(root){
  'use strict';
  const WAIT_MS = 6000;
  const RELOAD_MAX = 1;
  const RELOAD_KEY = 'tw.glReloads';

  /* deps: { log(msg), reload(), setTimer(fn, ms) → id, clearTimer(id), now(), store: {get(k), set(k, v)} } */
  function createGlRecover(deps){
    let lost = false, lostAt = 0, timer = null, losses = 0;
    const reloads = () => { try{ return Number(deps.store.get(RELOAD_KEY)) || 0; }catch(_){ return 0; } };
    function onLost(){
      losses++;
      lost = true;
      lostAt = deps.now();
      deps.log('WebGL 연결 끊김 #' + losses + ' — ' + (WAIT_MS / 1000) + '초 기다림');
      if(timer !== null) deps.clearTimer(timer);
      timer = deps.setTimer(() => {
        timer = null;
        if(!lost) return;
        const n = reloads();
        if(n >= RELOAD_MAX){ deps.log('WebGL 복구 안 됨 — 다시 불러오기는 이미 ' + n + '번 해서 기록만'); return; }
        try{ deps.store.set(RELOAD_KEY, String(n + 1)); }catch(_){}
        deps.log('WebGL 복구 안 됨 — 화면 다시 불러오기');
        deps.reload();
      }, WAIT_MS);
    }
    function onRestored(){
      const took = lost ? deps.now() - lostAt : 0;
      lost = false;
      if(timer !== null){ deps.clearTimer(timer); timer = null; }
      deps.log('WebGL 연결 복구 — ' + took + 'ms');
    }
    function attach(canvas){
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
    }
    return { onLost, onRestored, attach, isLost: () => lost };
  }

  const api = { WAIT_MS, RELOAD_MAX, RELOAD_KEY, createGlRecover };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GlRecover = api;
})(typeof window !== 'undefined' ? window : this);
