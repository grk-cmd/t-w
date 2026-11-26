/* device-toggle.js — 이 PC 의 켜고 끄는 화면 설정 하나(기본 켜짐) (검사 sim-device-toggle.js)
   설정 창과 그 설정을 읽는 기능이 같이 쓰는 값이라 맨 아래(shared)에 둔다 — 기능 모듈에 두면 «설정 창 → 기능 모듈» 순환이 된다(sim-dep-cycles).
   바뀐 뒤 할 일은 위층을 부르지 않고 onChange 에 건다. 저장은 localStorage 한 칸('0' 이면 꺼짐 · 그 밖은 켜짐) — 키는 기기 칸 목록(account-store.js)에도 넣는다.
   classic script(window.TwDeviceToggle) — 읽는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

/** @param {{ storage: { getItem: Function, setItem: Function } | null, key: string }} deps */
function createDeviceToggle(deps){
  const storage = deps.storage;
  const key = deps.key;
  if(typeof key !== 'string' || key.indexOf('tw.') !== 0) throw new Error('[device-toggle] 저장 키는 tw. 로 시작해야 한다 — ' + key);
  const fns = [];
  let on = true;
  try{ on = !storage || storage.getItem(key) !== '0'; }catch(_){ on = true; }

  function set(v){
    const next = !!v;
    if(next === on) return;
    on = next;
    try{ if(storage) storage.setItem(key, on ? '1' : '0'); }catch(_){}
    fns.slice().forEach(fn => fn(on));
  }
  /** 바뀌면 부른다(켜짐 여부) — 돌려주는 함수로 뗀다 */
  function onChange(fn){
    fns.push(fn);
    return () => { const i = fns.indexOf(fn); if(i >= 0) fns.splice(i, 1); };
  }
  return { on: () => on, set, onChange };
}

const api = Object.freeze({ createDeviceToggle });
if(typeof window !== 'undefined') window.TwDeviceToggle = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
