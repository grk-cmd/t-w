/* human-ear-attach.js — 🐾 사람 귀를 뼈대에 붙이기(꾸미기 › 머리 › 귀)(앱 FSD · app.js 분리 M2)
   app.js «사람 귀» 구역을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다. 귀 규칙 자체(파싱 · 붙이기 계산)는 같은 폴더 human-ear.js.
   ・책임: human-ear.js 를 만들고(모듈이 없으면 null — 귀만 꺼진다) · 귀 재질 · 귀 그림 입히기 · 붙은 귀를 좌석 귀 목록(seat.bones.ear)에 올리기(까닥임) · def 에 맞게 붙이기.
   ・받는 deps 6 — _registerAnimalEarOn(동물 귀 등록 — 사람 귀도 같은 등록을 쓴다) · lightToneMod(FLAT_EMISSIVE) · 늦게 만들어지는 것은 읽는 함수: seats · partPaintMod · wardrobeMod · rideBenchMod.
   ・내놓는 것: humanEar · _humanEarMat() · _humanEarPic(wrap, def) · _syncHumanEarRig(seat) · _attachHumanEars(root, def)
   ⚠️ 바인드 자세(조립 직후 · 애니메이션 전)에 불러야 한다. animal.js 는 이 모듈보다 늦게 로드돼 귀 파서는 부를 때 찾는다.
   검사: checks/sim-human-ear-attach.js */
(function(){

function createHumanEarAttach(deps){
const _registerAnimalEarOn = deps._registerAnimalEarOn;
const lightToneMod = deps.lightToneMod;
const seats = deps.seats;
const partPaintMod = deps.partPaintMod;
const wardrobeMod = deps.wardrobeMod;
const rideBenchMod = deps.rideBenchMod;
/* ===== 🐾 사람 귀 (꾸미기 › 머리 › 귀) — human-ear.js. 귀 GLB 파싱은 animal.js 캐시를 같이 쓴다.
   animal.js 는 이 파일보다 늦게 로드되므로 파서는 부를 때 찾는다. */
/* ⚠️ 모듈이 없어도(로드 실패 · app.js 만 평가하는 검사) 앱은 켜져야 한다 — 그때는 귀만 꺼진다. */
const humanEar = (typeof HumanEar === 'undefined') ? null : HumanEar.createHumanEar({
  THREE,
  parseEar:(key, cb)=>{
    const f = window.parseAnimalEar;
    if(f){ f(key, cb); return; }
    setTimeout(()=>{ const g = window.parseAnimalEar; if(g) g(key, cb); else cb(null); }, 500);
  },
  earTypes:()=>window.ANIMAL_EAR_TYPES || [],
});
/* 귀는 흰색으로 시작한다(색은 그리기로만) — 다른 몸 재질과 같은 플랫 조명(applyLightPresetToInstance). */
function _humanEarMat(){
  const m = new THREE.MeshStandardMaterial({ color:'#ffffff', metalness:0, roughness:0.9, side:THREE.DoubleSide });
  m.emissive.setScalar(lightToneMod.FLAT_EMISSIVE);
  return m;
}
/* ⚠️ 바인드 자세일 때(조립 직후 · 애니메이션 전) 불러야 한다 — holder 와 옮길 양을 이때 잰다.
   귀가 없어도 holder 는 만들어 둔다: 나중에 꾸미기에서 귀를 고를 때는 이미 움직이는 좌석이다. */
/* 🖍️ 귀 그림(def.earPicL·R)을 붙은 귀에 입힌다 — 파츠 그림과 같은 배관(applyPartPic · 같은 업로드 캐시) */
function _humanEarPic(wrap, def){
  try{ partPaintMod().applyPartPic(wrap, (def && def['earPic' + wrap.userData.humanEar]) || null); }catch(e){ console.warn('[사람 귀] 그림', e); }
}
/* 귀 까닥임 — 붙어 있는 사람 귀를 좌석의 귀 목록(seat.bones.ear)에 올리고, 떨어진 옛 귀는 걷는다.
   동물 귀와 같은 등록(_registerAnimalEarOn)을 쓴다 — 사람 기본 모델의 ear 본도 웨이트가 없어서
   본만 돌리면 아무것도 안 움직인다(부착물 자체를 돌려야 한다). */
function _syncHumanEarRig(seat){
  if(!seat || !seat.bones || !seat.bones.ear || !seat.modelRoot) return;
  if(!seat.boneRest) seat.boneRest = {};
  if(!seat.boneRest.ear) seat.boneRest.ear = [];
  const live = [];
  try{ seat.modelRoot.traverse(o=>{ if(o.userData && o.userData.humanEar) live.push(o); }); }catch(_){}
  for(let i = seat.bones.ear.length - 1; i >= 0; i--){
    const o = seat.bones.ear[i];
    if(o && o.userData && o.userData.humanEar && live.indexOf(o) < 0){
      seat.bones.ear.splice(i, 1); seat.boneRest.ear.splice(i, 1); seat.earTimers = null;
    }
  }
  live.forEach(w=>_registerAnimalEarOn(seat, w));
}
function _attachHumanEars(root, def){
  if(!humanEar || !root || (def && def.animal)) return;
  try{
    humanEar.ensureHolder(root);
    humanEar.attachFromDef(root, def, { material:_humanEarMat,
      onAttach:(w)=>{
        _humanEarPic(w, def);
        try{ wardrobeMod().wdEar.onEarAttached(root); }catch(_){}
        /* 귀는 늦게 붙는다 — 이 좌석 머리 위에 이미 누가 타 있으면 그 '머리 꼭대기' 는 귀 없던 값이다 */
        try{ const _s = seats().find(x=>x.modelRoot === root); if(_s){ _syncHumanEarRig(_s); rideBenchMod()._remeasureRideHeadTop(_s); } }catch(_){}
      } });
    /* 귀를 뺐거나 파싱 캐시로 바로 붙은 경우 — 콜백만으로는 옛 귀가 목록에 남는다 */
    try{ const _s = seats().find(x=>x.modelRoot === root); if(_s) _syncHumanEarRig(_s); }catch(_){}
  }catch(e){ console.warn('[사람 귀] 붙이기 실패', e); }
}

return {
  humanEar,
  _humanEarMat,
  _humanEarPic,
  _syncHumanEarRig,
  _attachHumanEars,
};
}

const api = { createHumanEarAttach };
if(typeof window !== 'undefined') window.TwHumanEarAttach = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
