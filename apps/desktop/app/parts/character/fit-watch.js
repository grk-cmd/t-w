/* fit-watch.js — 🩺 다시 맞춘 캐릭터 높이가 이상하면 경고 한 줄 (검사 sim-fit-watch.js)
   [왜] B-1109-9 — 파츠 보관함(T)을 닫으면 캐릭터가 뜬 채 남는데(런처에서 다시 입장하면 내려옴) 어느 값이 띄우는지
     화면 밖에서 알 길이 없었다. fitModel 이 높이를 정하는 값(크기 · 발바닥 보정 · 높이 슬라이더 · 발밑 깊이)을
     지난번과 견주어, 설명되지 않게 바뀌었으면 console.warn 한 줄 — 오류 기록(tw-error.log)에 WARN 으로 모인다.
   ・설명되는 바뀜: 발밑 깊이(욕조 · 방석을 붙이고 뗌) · 높이 슬라이더 값이 바뀐 만큼은 경고하지 않는다.
   ・함께 적는 것: 다시 맞출 때의 rig 높이(액자 고정 · 끌기 중) · bodyWrap 눕힘 · 액자 고정 · 올라탐 · 동물.
   ⚠️ 모델(gltfRoot)마다 따로 견준다 — 새 모델의 첫 값은 견줄 것이 없어 적기만 한다.
   ⚠️ 순수 모듈 — DOM · three · firebase 없음. app.js 가 fitModel 안에서 note 를 부른다.
   window.TwFitWatch = { createFitWatch({ warn }) } → { note(seat, terms, ctx) → 'first' | 'same' | 'warn' | null } */
(function(){
'use strict';

const TOL_Y = 0.01;        // 높이 차이 허용(모델 로컬 단위) — 수치 오차보다 크고 눈에 보이는 뜸보다 작게
const TOL_SCALE = 0.01;    // 크기 비율 차이 허용
const RIG_LIFT = 0.05;     // 다시 맞출 때 rig 가 이만큼 떠 있으면 같이 알린다(액자 고정 · 끌기)

function createFitWatch(deps){
  const warn = deps.warn;
  const last = new WeakMap();   // gltfRoot → 지난번 값
  const f = (n) => (Number(n) || 0).toFixed(3);
  function note(seat, t, ctx){
    if(!seat || !seat.gltfRoot || !t) return null;
    const root = seat.gltfRoot, c = ctx || {};
    const p = last.get(root);
    last.set(root, { ...t });
    if(!p) return 'first';
    const explained = (t.under - p.under) + (t.userY - p.userY);   // 파츠 · 슬라이더로 설명되는 바뀜
    const dy = (t.y - p.y) - explained;
    const ds = p.scale ? Math.abs(t.scale - p.scale) / p.scale : 0;
    const rigUp = Math.abs(Number(c.rigY) || 0) > RIG_LIFT;
    if(Math.abs(dy) <= TOL_Y && ds <= TOL_SCALE && !rigUp) return 'same';
    warn('[높이] 다시 맞춘 캐릭터 높이가 설명 안 되게 바뀜 — y ' + f(p.y) + '→' + f(t.y)
      + ' · 크기 ' + f(p.scale) + '→' + f(t.scale) + ' · 발바닥 ' + f(p.foot) + '→' + f(t.foot)
      + ' · 높이값 ' + f(p.userY) + '→' + f(t.userY) + ' · 발밑 ' + f(p.under) + '→' + f(t.under)
      + ' · rig y ' + f(c.rigY) + ' · 눕힘 ' + f(c.wrapRotX)
      + (c.pinned ? ' · 액자 고정' : '') + (c.riding ? ' · 올라탐' : '') + (c.animal ? ' · 동물' : ''));
    return 'warn';
  }
  return { note };
}

const api = { createFitWatch, TOL_Y, TOL_SCALE, RIG_LIFT };
if(typeof window !== 'undefined') window.TwFitWatch = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
