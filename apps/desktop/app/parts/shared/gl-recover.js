/* ═══ 🧯 3D 그리기 연결이 끊겼을 때 — parts/gl-recover.js ═══════════════════════════
   메인 화면 캔버스의 WebGL 연결(context)이 끊기면 기록하고, 정해진 시간 안에 안 돌아오면 **앱을 다시 켠다**.
   [왜] three.js(r128)는 끊기면 돌아오기를 기다리기만 해서, 안 돌아오면 캐릭터가 안 보이는 화면에 그대로 남는다.
     화면만 다시 불러오면(location.reload) GPU 를 잃은 크롬 엔진이 WebGL 을 못 만들어 app.js 가 첫 줄에서 죽고,
     창은 실행 화면 크기 그대로라 런처 바탕이 모니터를 덮은 채 남았다(B-1114-5). 앱을 다시 켜야 GPU 를 새로 잡는다.
   ★ 순수 규칙만 — 화면 · IPC 는 deps 로 받는다(sim-gl-recover.js 가 node 로 돌린다).
   ⚠️ 다시 켠 지 RELAUNCH_GAP_MS 안에 또 안 돌아오면 다시 켜지 않고 안내만 띄운다 — 계속 끊기는 PC 에서 무한 재시작을 막는다.
     마지막으로 다시 켠 시각은 앱을 다시 켜도 남는 곳(localStorage)에 둔다. 적지 못하면 다시 켜지 않는다(같은 까닭).
   ⚠️ app.js 보다 먼저 싣는다(classic script · window.GlRecover). */
(function(root){
  'use strict';
  const WAIT_MS = 6000;
  const RELAUNCH_GAP_MS = 10 * 60 * 1000;
  const RELAUNCH_KEY = 'tw.glRelaunchAt';

  /* 다시 켤까, 안내만 할까 — 마지막으로 다시 켠 지 RELAUNCH_GAP_MS 가 안 됐으면(시계가 뒤로 갔어도) 안내 */
  function decide(now, lastAt){
    const last = Number(lastAt) || 0;
    if(last > 0 && now - last < RELAUNCH_GAP_MS) return 'notice';
    return 'relaunch';
  }

  /* deps: { log(msg), relaunch(), notice(), setTimer(fn, ms) → id, clearTimer(id), now(), store: {get(k), set(k, v)}, afterRestore() }
     afterRestore — 돌아온 직후 할 일(좌석 그림 점검 · face-heal.js reportGlReset). 2D 캔버스도 같은 GPU 를 잃어 같이 빌 수 있다. */
  function createGlRecover(deps){
    let lost = false, lostAt = 0, timer = null, losses = 0;
    const lastAt = () => { try{ return deps.store.get(RELAUNCH_KEY); }catch(_){ return null; } };
    function giveUp(){
      deps.log('WebGL 복구 안 됨 — ' + (RELAUNCH_GAP_MS / 60000) + '분 안에 또 끊겨 다시 켜지 않고 안내');
      deps.notice();
    }
    function onLost(){
      losses++;
      lost = true;
      lostAt = deps.now();
      deps.log('WebGL 연결 끊김 #' + losses + ' — ' + (WAIT_MS / 1000) + '초 기다림');
      if(timer !== null) deps.clearTimer(timer);
      timer = deps.setTimer(() => {
        timer = null;
        if(!lost) return;
        const now = deps.now();
        if(decide(now, lastAt()) === 'notice') return giveUp();
        try{ deps.store.set(RELAUNCH_KEY, String(now)); }
        catch(_){ deps.log('WebGL 복구 안 됨 — 다시 켠 시각을 적지 못해 다시 켜지 않고 안내'); deps.notice(); return; }
        deps.log('WebGL 복구 안 됨 — 앱 다시 켜기');
        deps.relaunch();
      }, WAIT_MS);
    }
    function onRestored(){
      const took = lost ? deps.now() - lostAt : 0;
      lost = false;
      if(timer !== null){ deps.clearTimer(timer); timer = null; }
      deps.log('WebGL 연결 복구 — ' + took + 'ms');
      try{ deps.afterRestore(); }catch(e){ deps.log('복구 뒤 점검 실패 — ' + (e && e.message || e)); }
    }
    function attach(canvas){
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
    }
    return { onLost, onRestored, attach, isLost: () => lost };
  }

  const api = { WAIT_MS, RELAUNCH_GAP_MS, RELAUNCH_KEY, decide, createGlRecover };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GlRecover = api;
})(typeof window !== 'undefined' ? window : this);
