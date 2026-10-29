/* source-switch.js — 🎚️ 기능별 받는 곳 — 0.13 에선 «한 길만 돌려주는» 얇은 자리 (검사 sim-source-switch.js)
   [왜 얇은가] 0.13 서버 GET /v1/config 에는 기능 스위치(sources · roomServer · flags.friendsApi)가 없다 — 앱은 한 번에 새 서버로 바꾼다
     (옛 앱 호환 없음). 그래서 원격 설정을 읽지 않고, 기능마다 «지금 도는 한 길» 을 고정 표(ONE_WAY)로 돌려준다.
     표의 값은 스위치 칸이 없을 때 옛 판이 고르던 기본값과 같다 — 이 파일 때문에 동작이 바뀌지 않는다.
   [걷는 차례] 기능 묶음이 그 기능을 API · realtime 길로 갈아 끼우면 부르는 줄(pick · serverFirst)을 걷고 표에서 한 줄을 지운다.
     표가 비면 이 파일을 지운다. 새 기능을 여기 더하지 않는다.
     · friends(친구 목록 — friends-port.js) · catalog(카탈로그 본문 — catalog-cache.js) · gacha(가챠 — gacha.js · 지금 앱이 뽑기). 방은 room-server-gate.js 가 늘 Firebase 를 돌려준다.
   내놓는 것: SOURCE · SKIP · ONE_WAY · pickSource(기능) · serverFirst(받는 곳, 서버 함수, 파이어베이스 함수, 실패 알림) · store({ pick, serverFirst })
   classic script — app.js 보다 먼저 싣는다(window.TwSourceSwitch). 아무것도 읽지 않는다. */
(function(){
'use strict';

const SOURCE = Object.freeze({ SERVER: 'server', FIREBASE: 'firebase' });

/* 서버 함수가 «이번엔 서버 값을 못 쓴다(예: 사본 버전이 다름)» 를 알릴 때 돌려주는 표시 — 실패 알림 없이 파이어베이스로 넘어간다. */
const SKIP = Object.freeze({ skip: true });

/* 기능마다 지금 도는 한 길 — 옛 판의 «스위치 칸 없음» 기본값과 같다 */
const ONE_WAY = Object.freeze({
  friends: SOURCE.SERVER,     // 서버 먼저 → 못 받으면 옛 길(serverFirst)
  catalog: SOURCE.SERVER,     // 서버 먼저 → 못 받으면 옛 길(serverFirst)
  gacha: SOURCE.FIREBASE,     // 앱이 Firebase 트랜잭션으로 뽑기 — 캐릭터 묶음이 서버 뽑기로 갈아 끼운다
});

/* 모르는 기능은 파이어베이스(옛 길 — 안전한 쪽) */
function pickSource(feature){
  return Object.prototype.hasOwnProperty.call(ONE_WAY, feature) ? ONE_WAY[feature] : SOURCE.FIREBASE;
}

/* 서버 먼저 → 못 받으면 파이어베이스. { v, from: 'server' | 'firebase' }.
   serverFn 이 없으면(그 기능의 서버 길이 아직 없음) 바로 파이어베이스. serverFn 이 SKIP 을 돌려주거나 던지면 파이어베이스 —
   던졌을 때만 onFail(e) 로 알린다. 파이어베이스 쪽 오류는 그대로 던진다(옛 길이 실패한 것은 숨기지 않는다). */
async function serverFirst(src, serverFn, firebaseFn, onFail){
  if(src === SOURCE.SERVER && serverFn){
    try{
      const v = await serverFn();
      if(v !== SKIP) return { v, from: SOURCE.SERVER };
    }catch(e){
      if(onFail) onFail(e);
    }
  }
  return { v: await firebaseFn(), from: SOURCE.FIREBASE };
}

const api = { SOURCE, SKIP, ONE_WAY, pickSource, serverFirst, store: { pick: pickSource, serverFirst } };
if(typeof window !== 'undefined') window.TwSourceSwitch = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
