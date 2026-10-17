/* source-switch.js — 🎚️ 기능별 받는 곳 고르기 — «서버(우리 API · 방 서버) / 파이어베이스(옛 길)» 를 고르는 규칙 한 곳
   책임: 기능(친구 · 방 · 카탈로그 …)마다 어디서 받을지 정하고(pickSource), «서버 먼저 → 못 받으면 파이어베이스» 를 한 벌로 돌린다(serverFirst).
     기능 쪽(friends-port.js · room-server-gate.js · catalog-cache.js)은 이것만 부른다 — 스위치 이름 · 기본값 · 넘어가기 조건을 다시 쓰지 않는다.
   스위치 자리: 원격 설정 sources.{기능}(쓰기 원본 Firebase config/sources/{기능} · 웹 관리자 «🎚️ 기능 스위치») = 'server' | 'firebase'.
     칸이 없으면 기능 표(FEATURES)의 옛 자리를 읽는다(옛 관리자 · 옛 앱과 같은 값) — 지금 동작이 기본값이다.
   받는 deps(createSourceSwitch): valueOf(기능) → 새 칸 원값 · legacyOf(기능) → 옛 칸 원값. 둘 다 원격 설정(remote-config.js)에서 읽는다.
   내놓는 것: SOURCE · FEATURES · SKIP · cleanSource · pickSource(기능, 새 값, 옛 값) · serverFirst(받는 곳, 서버 함수, 파이어베이스 함수, 실패 알림)
     · createSourceSwitch(deps) → { pick(기능), serverFirst } · store(브라우저 — 원격 설정 한 벌에 이어 둔 것).
   ★ 새 기능을 서버로 옮길 때는 FEATURES 에 한 줄 · 웹 관리자 기능 스위치 표에 한 줄을 더한다.
   검사: checks/sim-source-switch.js(이 규칙 · 기능 쪽이 이것만 쓰는지) */
(function(){
'use strict';

const SOURCE = Object.freeze({ SERVER: 'server', FIREBASE: 'firebase' });

/* 서버 함수가 «이번엔 서버 값을 못 쓴다(예: 사본 버전이 다름)» 를 알릴 때 돌려주는 표시 — 실패 알림 없이 파이어베이스로 넘어간다. */
const SKIP = Object.freeze({ skip: true });

/* 기능 표 — 새 칸(sources.{기능})이 없을 때 옛 칸을 어떻게 읽나. 지금 동작과 같게 둔다.
     friends : 옛 flags.friendsApi — 끌 때만 false, 값이 없으면 켜짐(서버 먼저)
     rooms   : 옛 roomServer.on — true 일 때만 방 서버(허용 목록 · 비율 · 기본 서버는 그다음에 room-server-gate.js 가 본다)
     catalog : 옛 스위치 없음 — 늘 서버(읽기 사본) 먼저 */
const FEATURES = Object.freeze({
  friends: Object.freeze({ legacy: (v) => (v === false ? SOURCE.FIREBASE : SOURCE.SERVER), legacyOf: (rc) => rc.friendsApi() }),
  rooms: Object.freeze({ legacy: (v) => (v === true ? SOURCE.SERVER : SOURCE.FIREBASE), legacyOf: (rc) => rc.roomServer().on }),
  catalog: Object.freeze({ legacy: () => SOURCE.SERVER, legacyOf: () => undefined }),
});

/* 새 칸 값 → 'server' | 'firebase' | null(칸 없음 · 모르는 값) */
function cleanSource(v){
  return (v === SOURCE.SERVER || v === SOURCE.FIREBASE) ? v : null;
}

/* ★ 받는 곳을 고르는 곳은 이 함수 하나다. 모르는 기능은 파이어베이스(옛 길 — 안전한 쪽). */
function pickSource(feature, value, legacy){
  const f = FEATURES[feature];
  if(!f) return SOURCE.FIREBASE;
  return cleanSource(value) || f.legacy(legacy);
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

function createSourceSwitch(deps){
  const valueOf = deps.valueOf;
  const legacyOf = deps.legacyOf;
  /* 원격 설정을 아직 못 읽었거나 읽다 실패하면 칸 없음(undefined)으로 본다 — 기본값(지금 동작)으로 간다. */
  const read = (fn, feature) => { try{ return fn(feature); }catch(_){ return undefined; } };
  function pick(feature){
    return pickSource(feature, read(valueOf, feature), read(legacyOf, feature));
  }
  return { pick, serverFirst };
}

const api = { SOURCE, SKIP, FEATURES, cleanSource, pickSource, serverFirst, createSourceSwitch };
if(typeof window !== 'undefined'){
  /* 브라우저 한 벌 — 원격 설정(remote-config.js · 이 파일보다 먼저 싣는다) store 를 부를 때마다 읽는다. */
  const rc = () => window.TwRemoteConfig.store;
  api.store = createSourceSwitch({
    valueOf: (feature) => rc().sources()[feature],
    legacyOf: (feature) => (FEATURES[feature] ? FEATURES[feature].legacyOf(rc()) : undefined),
  });
  window.TwSourceSwitch = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
