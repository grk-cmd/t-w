/* sticker-layer.js — 🎨 마이홈 스티커 보이기(이 PC 의 화면 설정 · 기본 켜짐) (검사 sim-sticker-layer.js)
   끄면 이 PC 화면에서 내 홈 · 친구 홈의 스티커를 그리지 않는다 — 버튼 위에 겹친 스티커가 클릭을 가로채거나 스티커가 많은 홈이 느릴 때 쓴다.
   서버 값(스티커 자체)은 그대로다. 설정 창 · 스티커 그리기 · 관리 창이 같이 읽어 맨 아래에 둔다 — 바뀐 뒤 할 일(다시 그리기)은 위층을 부르지 않고 onChange 에 건다.
   classic script(window.TwStickerLayer) — 읽는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const KEY = 'tw.mhStickerLayer';   // '0' 이면 꺼짐 — 그 밖(없음 포함)은 켜짐

/** @param {{ storage: { getItem: Function, setItem: Function } | null }} deps */
function createStickerLayer(deps){
  const storage = deps.storage;
  const fns = [];
  let on = true;
  try{ on = !storage || storage.getItem(KEY) !== '0'; }catch(_){ on = true; }

  function set(v){
    const next = !!v;
    if(next === on) return;
    on = next;
    try{ if(storage) storage.setItem(KEY, on ? '1' : '0'); }catch(_){}
    fns.slice().forEach(fn => fn(on));
  }
  /** 바뀌면 부른다(켜짐 여부) — 돌려주는 함수로 뗀다 */
  function onChange(fn){
    fns.push(fn);
    return () => { const i = fns.indexOf(fn); if(i >= 0) fns.splice(i, 1); };
  }
  return { on: () => on, set, onChange };
}

const api = Object.freeze({ createStickerLayer, KEY });
if(typeof window !== 'undefined') window.TwStickerLayer = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
