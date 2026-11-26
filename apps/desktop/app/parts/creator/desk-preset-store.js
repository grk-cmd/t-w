/* desk-preset-store.js — 💾 책상 · 좌석 세팅 프리셋 저장: 5칸을 localStorage(tw.deskPresets)에 읽고 쓴다
   app.js «런처3-2 프리셋» 조각에서 저장 부분만 그대로 떼어 낸 모듈이다(C 구역 떼기 w4 · 바뀐 줄 0).
   ・책임: 읽기(loadDeskPresets — 늘 5칸 · 빈 칸 null · 깨진 값이면 빈 5칸) · 쓰기(saveDeskPresets — 앞 5칸만 · 결과를 돌려준다).
   ・받는 deps: jsonStore(shared/json-store.js — 읽기 · 쓰기 한 곳) · notifyError — 번호 알림(shared/error-codes.js · 읽기 실패 E-CHAR-02) · isCatalogDesk(id — 카탈로그에서 다시 받는 책상인가).
     내놓는 것: loadDeskPresets() · saveDeskPresets(arr) → { ok, err, bytes }(카탈로그 책상은 GLB 를 빼고 쓴다 — slimPresets) — 담기 · 적용 · 칸 화면은 creator/desk-preset.js.
   ⚠️ 전역 이름은 TwDeskPresetStore(Tw 접두사 #103).
   검사: checks/sim-desk-preset.js */
(function(){

function createDeskPresetStore(deps){
const jsonStore = deps.jsonStore;
const notifyError = deps.notifyError;
const isCatalogDesk = deps.isCatalogDesk;   // (id) → 카탈로그에서 다시 받을 수 있는 책상인가(character/commission.js catalogBacked)
const PRESET_KEY = 'tw.deskPresets';
const PRESET_SLOTS = 5;   // 프리셋 칸 수(칸 화면 desk-preset.js 도 이 값을 쓴다)
const _emptySlots = () => new Array(PRESET_SLOTS).fill(null);
function loadDeskPresets(){
  const r = jsonStore.load(PRESET_KEY, []);
  if(!r.ok){ console.warn(jsonStore.diagLine('load', PRESET_KEY, r)); notifyError('E-CHAR-02', r.err); }
  const arr = r.list;
  return Array.isArray(arr) ? arr.slice(0,PRESET_SLOTS).concat(_emptySlots()).slice(0,PRESET_SLOTS) : _emptySlots();
}
/* 카탈로그에 있는 책상은 GLB 바이트를 빼고 id 만 남긴다 — 1MB 책상을 칸마다 base64 로 담으면 이 PC 저장소가 넘쳐
   4번째 칸쯤부터 저장이 실패한다(10-16 제보 8). 불러올 때 desk-preset.js 가 카탈로그에서 받는다. 옛 칸도 저장할 때 같이 가벼워진다. */
function slimPresets(arr){
  return arr.map(p=>{
    if(!p || !p.deskGlb || !p.deskCatalogId || !isCatalogDesk(p.deskCatalogId)) return p;
    const q = Object.assign({}, p); delete q.deskGlb; return q;
  });
}
function saveDeskPresets(arr){ return jsonStore.save(PRESET_KEY, slimPresets(arr.slice(0,PRESET_SLOTS))); }

/* 저장 실패 문구(이유 한 마디) — 칸 화면(desk-preset.js)이 번호와 함께 띄운다. */
function saveFailText(err){ return jsonStore.saveFailText(err); }
function diagSave(res, slot){ return jsonStore.diagLine('save', PRESET_KEY, res, slot); }

return {
  PRESET_SLOTS,
  saveFailText,
  diagSave,
  loadDeskPresets,
  saveDeskPresets,
  slimPresets,
};
}

const api = { createDeskPresetStore };
if(typeof window !== 'undefined') window.TwDeskPresetStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
