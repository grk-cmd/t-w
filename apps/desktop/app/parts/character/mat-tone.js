/* mat-tone.js — 💡 재질 톤 — 얼굴 텍스처 갈아끼우기(setFaceMap) · 생성기와 같은 평탄 조명(applyLightPresetToInstance)
   app.js «💡 얼굴 텍스처 갈아끼우기 · 생성기 조명» 구역의 재질 함수 둘을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   DOM · 씬 없이 재질 객체만 만진다(순수 계산 — sim 이 가짜 재질로 입력 → 결과를 본다). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 0줄.
   ★ 받는 것: tone(캐릭터 코어 재질 톤 — light-tone.js 의 toneCore) 하나. 사람 몫은 코어, 동물 귀 깜빡임만 여기.
   ★ 밖에서 부르는 이름: applyLightPresetToInstance · setFaceMap — app.js 는 matToneMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMatTone — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-mat-tone.js */
(function(){

function createMatTone(deps){
const tone = deps.tone;
/* 얼굴 맵 · emissiveMap 갈기는 캐릭터 코어(tone.setFaceMap). 🐾 동물 귀는 다른 재질이라 몸 재질의 등록표(userData.animalEars — animal.js)를
   보고 여기서 함께 간다(동물은 앱 몫).
   ★ 깜빡임 스왑은 전부 이 함수를 지난다 — 호출부마다 귀 코드를 넣지 말 것(한 곳이 빠지면 «귀만 뜬» 상태). 표식이 없으면(사람) 몸만 간다. */
function setFaceMap(mat, tex){ if(!mat||!tex)return; tone.setFaceMap(mat, tex);
  const ud=mat.userData;
  if(ud && ud.animalEars && ud.animalEars.length){
    const closed = (tex === ud.animalBlinkTex);
    for(const e of ud.animalEars){
      const t = closed ? e.bT : e.fT;
      if(e.mat && t && e.mat.map!==t){ e.mat.map=t; e.mat.emissiveMap=t; e.mat.needsUpdate=true; }
    }
  }
}

/* 메인 좌석에 들어오는 캐릭터 머티리얼에도 같은 emissive 보정 — 생성기와 톤 일치(코어) */
function applyLightPresetToInstance(inst){ tone.applyLightPresetToInstance(inst); }


return {
  applyLightPresetToInstance,
  setFaceMap,
};
}

const api = { createMatTone };
if(typeof window !== 'undefined') window.TwMatTone = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
