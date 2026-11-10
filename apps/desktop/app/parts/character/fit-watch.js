/* fit-watch.js — 🩺 다시 맞춘 캐릭터 높이가 이상하면 경고 한 줄 (검사 sim-fit-watch.js)
   [왜] B-1109-9 — 파츠 보관함(T)을 닫으면 캐릭터가 뜬 채 남는데(런처에서 다시 입장하면 내려옴) 어느 값이 띄우는지
     화면 밖에서 알 길이 없었다. fitModel 이 높이를 정하는 값(크기 · 발바닥 보정 · 높이 슬라이더 · 발밑 깊이)을
     지난번과 견주어, 설명되지 않게 바뀌었으면 console.warn 한 줄 — 오류 기록(tw-error.log)에 WARN 으로 모인다.
   ・설명되는 바뀜: 발밑 깊이 · 높이 슬라이더 몫(fitModel 이 실제로 더한 값 — 동물 배율 · 캐릭터 크기 반영)만큼은 높이 경고를 안 낸다.
     다만 발밑 깊이가 슬라이더 몫으로 설명 안 되게 바뀌면 «[높이 · 발밑]» 한 줄을 따로 남긴다 — 깊이를 잘못 재 뜨는 경우가 여기 숨는다
     (파츠를 붙이거나 뗀 값 — 입장 때 파츠가 붙는 것 포함 — 은 빼고: 파츠 그대로인데 깊이만 바뀐 것).
   ・함께 적는 것: rig 높이 · 좌석 높이(올라탐) · bodyWrap 눕힘 · 높이 슬라이더 날값 · 액자 고정 · 올라탐 · 동물.
   ・한 번 경고하면 그 모델이 다시 «그대로» 가 될 때까지 또 적지 않는다(슬라이더를 끄는 동안 수십 줄이 쌓이지 않게).
     rig 뜸은 지난번과 달라졌을 때만 본다(액자 고정은 처음 한 번).
   ⚠️ 모델(gltfRoot)마다 따로 견준다 — 새 모델의 첫 값은 견줄 것이 없어 적기만 한다.
   ⚠️ 순수 모듈 — DOM · three · firebase 없음. app.js 가 fitModel 안에서 note 를 부른다.
   window.TwFitWatch = { createFitWatch({ warn }) } → { note(seat, terms, ctx) → 'first' | 'same' | 'warn' | 'held' | null } */
(function(){
'use strict';

const TOL_Y = 0.01;        // 높이 차이 허용(모델 로컬 단위) — 수치 오차보다 크고 눈에 보이는 뜸보다 작게
const TOL_SCALE = 0.01;    // 크기 비율 차이 허용
const RIG_LIFT = 0.05;     // 다시 맞출 때 rig 가 이만큼 떠 있으면 같이 알린다(액자 고정 · 끌기)

/* 지금 붙어 있는 파츠 묶음 표시 — «무엇이 · 어디에» 붙었나. 파츠를 붙이거나 떼거나(입장 때 파츠가 붙는 것 포함) 옮기면 바뀐다.
   ⚠️ wrapper 의 uuid 를 쓰지 않는다 — equipPartOnSeat 는 같은 파츠도 다시 붙일 때마다 wrapper 를 새로 만든다(T 를 닫을 때마다).
     칸 + partId(모든 wrapper 에 단다) · 쌓기는 칸:id, 거기에 저장된 착용 목록(def.equippedParts — 자리 · 크기 포함)을 더한다 */
function partsKey(seat){
  const one = (k, w) => k + '=' + ((w && w.userData && w.userData.partId) || '?');
  const eq = seat.equippedPartObjs || {}, st = seat.stackedPartObjs || {};
  return Object.keys(eq).sort().map((k) => one(k, eq[k])).join(',') + '|'
    + Object.keys(st).sort().map((c) => c + ':' + Object.keys(st[c] || {}).sort().map((id) => one(id, st[c][id])).join('+')).join(',')
    + '#' + JSON.stringify((seat.charDef && seat.charDef.equippedParts) || null);
}
function createFitWatch(deps){
  const warn = deps.warn;
  const last = new WeakMap();   // gltfRoot → { t: 지난 값, rigY, held: 경고 뒤 'same' 이 올 때까지 다시 안 적음 }
  const f = (n) => (Number(n) || 0).toFixed(3);
  const state = (c) => ' · rig y ' + f(c.rigY) + ' · 좌석 y ' + f(c.groupY) + ' · 눕힘 ' + f(c.wrapRotX) + ' · 높이 슬라이더 ' + f(c.userY)
    + (c.pinned ? ' · 액자 고정' : '') + (c.riding ? ' · 올라탐' : '') + (c.animal ? ' · 동물' : '');
  function note(seat, t, ctx){
    if(!seat || !seat.gltfRoot || !t) return null;
    const root = seat.gltfRoot, c = ctx || {};
    const L = last.get(root);
    const rigY = Number(c.rigY) || 0;
    const parts = partsKey(seat);
    last.set(root, { t: { ...t }, rigY, held: L ? L.held : false, parts });
    if(!L) return 'first';
    const p = L.t;
    /* 발밑 깊이가 바뀌면 따로 한 줄 — 파츠를 붙이고 뗄 때만 바뀌니 양은 적고, 깊이를 잘못 재 뜨는 경우를 여기서 본다 */
    /* 발밑 파츠가 바닥 아래에 있는 동안은 슬라이더를 올린 만큼 깊이가 줄어든다(합은 그대로) — 그 몫은 빼고 본다.
       파츠 묶음이 바뀐 값(붙이고 뗌 · 입장 때 파츠가 붙음)은 깊이가 바뀌는 게 당연하다 — 파츠 그대로인데 깊이만 바뀐 것만 적는다 */
    const underMoved = Math.abs(t.under - p.under) > TOL_Y && Math.abs((t.under + t.lift) - (p.under + p.lift)) > TOL_Y;
    if(underMoved && parts === L.parts) warn('[높이 · 발밑] 발밑 깊이가 바뀜 ' + f(p.under) + '→' + f(t.under) + ' (파츠는 그대로 — 뜬 원인일 수 있음)' + state(c));
    const dy = (t.y - p.y) - ((t.under - p.under) + (t.lift - p.lift));   // 파츠 · 슬라이더(실제로 더한 값)로 설명되는 몫을 뺀다
    const ds = p.scale ? Math.abs(t.scale - p.scale) / p.scale : 0;
    const rigUp = Math.abs(rigY) > RIG_LIFT && Math.abs(rigY - L.rigY) > RIG_LIFT;   // 떠 있는 채로 «바뀌었을 때» 만(액자 고정은 처음 한 번)
    if(Math.abs(dy) <= TOL_Y && ds <= TOL_SCALE && !rigUp){ last.get(root).held = false; return 'same'; }
    if(L.held) return 'held';
    last.get(root).held = true;
    warn('[높이] 다시 맞춘 캐릭터 높이가 설명 안 되게 바뀜 — y ' + f(p.y) + '→' + f(t.y)
      + ' · 크기 ' + f(p.scale) + '→' + f(t.scale) + ' · 발바닥 ' + f(p.foot) + '→' + f(t.foot)
      + ' · 슬라이더 몫 ' + f(p.lift) + '→' + f(t.lift) + ' · 발밑 ' + f(p.under) + '→' + f(t.under) + state(c));
    return 'warn';
  }
  return { note };
}

const api = { createFitWatch, partsKey, TOL_Y, TOL_SCALE, RIG_LIFT };
if(typeof window !== 'undefined') window.TwFitWatch = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
