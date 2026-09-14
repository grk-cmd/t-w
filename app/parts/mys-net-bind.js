/* 🔒 CSP — 이 파일은 원래 desk-companion-prototype.html 안의 인라인 <script> 였다.
   `script-src` 에서 'unsafe-inline' 을 버리기 위해 밖으로 뺐다. 내용은 그대로다.
   ⚠️ classic script 로(type 없이) 불러야 한다. 파싱 중에 즉시 실행돼서
     ① parts/mystery-au.js 보다 먼저 window.MYS_NET 을 만들고
     ② 지연 실행되는 parts/firebase-init.js 가 window.__mysNetBind 를 찾을 수 있다.
     defer/async 를 붙이거나 parts/mystery-au.js 뒤로 옮기면 파티 전송선이 조용히 끊긴다. */

(function(){
  var impl = null, waitJoin = null, waitMsg = [], warned = false;
  window.__mysNetBind = function(f){
    impl = f;
    if(waitJoin){
      var w = waitJoin; waitJoin = null;
      try{ impl.join(w[0], w[1], w[2]); }catch(e){ console.warn('[미스테리au] 합류 실패', e); }
    }
    var q = waitMsg; waitMsg = [];
    q.forEach(function(m){ try{ impl.send(m); }catch(_){} });
  };
  window.MYS_NET = {
    join: function(room, me, onMsg){
      if(impl) return impl.join(room, me, onMsg);
      waitJoin = [room, me, onMsg]; waitMsg = [];
      /* 끝내 안 꽂히면(오프라인·firebase-config 누락) 조용히 아무 일도 안 일어난다.
         그건 고장으로 읽히므로 콘솔에 이유를 남긴다. */
      if(!warned){ warned = true; setTimeout(function(){
        if(!impl) console.warn('[미스테리au] 파티 전송선이 아직 안 꽂혔다 — firebase 초기화를 확인할 것');
      }, 8000); }
    },
    leave: function(){ waitJoin = null; waitMsg = []; if(impl) impl.leave(); },
    /* ⚠ 대기 중 쌓인 것은 8개까지만. 그보다 오래 밀린 위치를 뒤늦게 흘리면
         파티원 화면에서 내가 과거로 걸어간다. */
    send: function(msg){ if(impl) impl.send(msg); else if(waitMsg.length < 8) waitMsg.push(msg); }
  };
})();
