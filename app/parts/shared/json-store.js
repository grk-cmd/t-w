/* json-store.js — 💾 localStorage JSON 칸 읽기 · 쓰기 한 곳 — 실패를 삼키지 않고 결과({ok, err})로 돌려준다
   ・책임: 한 키의 JSON 을 읽고(해석) 쓰기(만들기 · 쓰기). 생성기 프리셋 두 벌(사람 책상 tw.deskPresets — creator/desk-preset-store.js ·
     동물 tw.animalPresets — character/animal.js)이 같은 «읽기 → 해석 / 만들기 → 쓰기» 를 따로 들고 실패를 try/catch 로 삼키던 것을 여기 한 곳에.
   ・받는 deps: storage() — 부를 때 저장소를 돌려주는 함수(실릴 때 못 열 수도 있다). 렌더러에서는 window.localStorage 로 하나를 만들어 둔다.
   ・내놓는 것: load(key, fallback) → { ok, list, err, bytes } · save(key, value) → { ok, err, bytes } · createJsonStore(deps)
     · load: 키가 없거나 빈 글이면 ok:true · list=fallback. 해석 · 읽기 실패면 ok:false · list=fallback · err. 값의 모양(배열 · 객체)은 부르는 쪽이 본다.
     · save: 만들기 · 쓰기가 던지면 ok:false · err. bytes 는 (키 + 글) × 2(크로미움 저장 한도를 세는 단위).
   ⚠️ DOM · 토스트를 모른다(shared). 알리는 건 부르는 쪽. 전역 이름 TwJsonStore(Tw 접두사 #103).
   검사: checks/sim-json-store.js */
(function(){
'use strict';

function createJsonStore(deps){
  const d = deps || {};
  const storage = d.storage || (()=>null);
  function load(key, fallback){
    let bytes = 0;
    try{
      const raw = storage().getItem(key);
      if(!raw) return { ok: true, list: fallback, err: null, bytes: 0 };
      bytes = (key.length + raw.length) * 2;
      return { ok: true, list: JSON.parse(raw), err: null, bytes };
    }catch(err){ return { ok: false, list: fallback, err, bytes }; }
  }
  function save(key, value){
    let bytes = 0;
    try{
      const text = JSON.stringify(value);
      bytes = (key.length + (text ? text.length : 0)) * 2;
      storage().setItem(key, text);
      return { ok: true, err: null, bytes };
    }catch(err){ return { ok: false, err, bytes }; }
  }
  return { load, save };
}

const api = { createJsonStore };
if(typeof window !== 'undefined'){
  const store = createJsonStore({ storage: ()=>window.localStorage });
  api.load = store.load;
  api.save = store.save;
  window.TwJsonStore = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
