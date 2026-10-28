/* device-id.js — 🖥️ 이 기기 id(tw.deviceId) 한 곳 (검사 sim-device-id.js)
   [왜] 서버는 프리미엄을 «이 기기» 로 판정한다(라이선스 등록 기기 3대). 로그인 요청 머리 X-Device-Id 와 realtime hello.deviceId 에
     **같은 값** 을 싣는다 — 신원이 아니라 등록 기기 칸의 이름이다(신원은 로그인 토큰뿐).
   [모양] ^[A-Za-z0-9_-]{8,64}$ — API(요청 머리) · realtime(hello) 둘 다 받는 모양. 만드는 값은 uuid(request-id.js newId).
   [언제] 처음 부를 때 한 번 만들어 저장하고 그 뒤로는 저장값. 저장값이 모양 밖이면(손으로 고침 · 깨짐) 새로 만들어 덮는다.
     저장이 막혀 있으면(사생활 창 · 저장소 거부) 이번 실행 동안만 같은 값 — 다음 실행은 다른 기기로 보인다.
   ⚠️ 계정을 바꿔도 지우지 않는다(계정 전환 지움 목록에 넣지 말 것) — 기기 칸 이름이 바뀌면 같은 PC 가 등록 기기를 하나 더 차지한다.
   classic script — request-id.js 다음 · api-client.js · app.js 보다 먼저 싣는다(window.TwDeviceId). */
(function(){
'use strict';

const STORAGE_KEY = 'tw.deviceId';
const PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** @param {{ storage: { getItem(k: string): string | null, setItem(k: string, v: string): void } | null, newId: () => string }} deps */
function createDeviceId(deps){
  const storage = deps.storage;
  const newId = deps.newId;
  let cur = null;   // 이번 실행의 값 — 처음 get() 에서 정한다
  function readSaved(){
    try{ const v = storage ? storage.getItem(STORAGE_KEY) : null; return (typeof v === 'string' && PATTERN.test(v)) ? v : null; }catch(_){ return null; }
  }
  function get(){
    if(cur) return cur;
    const saved = readSaved();
    if(saved){ cur = saved; return cur; }
    const made = newId();
    if(typeof made !== 'string' || !PATTERN.test(made)) throw new Error('[기기 id] 만든 값이 모양 밖 — ' + made);
    cur = made;
    try{ if(storage) storage.setItem(STORAGE_KEY, cur); }catch(_){}
    return cur;
  }
  return { get };
}

const api = { STORAGE_KEY, PATTERN, createDeviceId };
if(typeof window !== 'undefined'){
  let st = null; try{ st = window.localStorage; }catch(_){ st = null; }
  api.store = createDeviceId({ storage: st, newId: () => window.TwRequestId.newId() });
  window.TwDeviceId = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
