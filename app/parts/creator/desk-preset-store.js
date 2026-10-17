/* desk-preset-store.js — 💾 책상 · 좌석 세팅 프리셋 저장: 5칸을 localStorage(tw.deskPresets)에 읽고 쓴다
   app.js «런처3-2 프리셋» 조각에서 저장 부분만 그대로 떼어 낸 모듈이다(C 구역 떼기 w4 · 바뀐 줄 0).
   ・책임: 읽기(loadDeskPresets — 늘 5칸 · 빈 칸 null · 깨진 값이면 빈 5칸) · 쓰기(saveDeskPresets — 앞 5칸만 · 결과를 돌려준다).
   ・받는 deps: jsonStore(shared/json-store.js — 읽기 · 쓰기 한 곳). 내놓는 것: loadDeskPresets() · saveDeskPresets(arr) → { ok, err, bytes } — 담기 · 적용 · 칸 화면은 creator/desk-preset.js.
   ⚠️ 전역 이름은 TwDeskPresetStore(Tw 접두사 #103).
   검사: checks/sim-desk-preset.js */
(function(){

function createDeskPresetStore(deps){
const jsonStore = deps.jsonStore;
const PRESET_KEY = 'tw.deskPresets';
const PRESET_SLOTS = 5;   // 프리셋 칸 수(칸 화면 desk-preset.js 도 이 값을 쓴다)
const _emptySlots = () => new Array(PRESET_SLOTS).fill(null);
function loadDeskPresets(){
  const arr = jsonStore.load(PRESET_KEY, []).list;
  return Array.isArray(arr) ? arr.slice(0,PRESET_SLOTS).concat(_emptySlots()).slice(0,PRESET_SLOTS) : _emptySlots();
}
function saveDeskPresets(arr){ return jsonStore.save(PRESET_KEY, arr.slice(0,PRESET_SLOTS)); }

return {
  PRESET_SLOTS,
  loadDeskPresets,
  saveDeskPresets,
};
}

const api = { createDeskPresetStore };
if(typeof window !== 'undefined') window.TwDeskPresetStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
