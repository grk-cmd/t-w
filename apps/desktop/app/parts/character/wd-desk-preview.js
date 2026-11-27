/* wd-desk-preview.js — 🪑 꾸미기 미리보기의 책상 몸 · 책상 위치(기즈모) 계산
   책임: 꾸미기 미리보기 장면에 «책상 몸» 그룹 하나를 세우고(내장 기본 책상 · GLB 책상 · 책상 없음), 기즈모로 옮긴 자리를 def.deskPos 로 바꿔 준다.
     저장 · 방 전파 · 실제 좌석 책상 옮기기 · 기즈모 붙이기는 부르는 쪽(wardrobe.js)이 한다.
   받는 deps: buildDesk(내장 책상 메쉬) · deskBodyPlan · drawDeskGlb · hideDeskBody · applyDeskColor(desk-visual.js) · syncDeskPartAnchor(desk-place.js) · DEFAULT_DESK_OVERRIDE_ID
   내놓는 것: rebuild({ scene, def, anchorGroup, anim }) · dispose() · setShown(on) · tune(def) · body() · readPos() · resetPos() · isZero(pos)
   ★ 미리보기에는 책상 그룹이 둘이다 — anchorGroup(wardrobe.js 의 빈 그룹 · «책상 위» 파츠가 붙는 자리 · 자리 식은 그쪽에)과 이 모듈의 몸 그룹.
     몸 그룹은 anchorGroup 의 자리 · 크기를 그대로 받는다(식을 여기서 다시 쓰지 않는다). 책상 탭이 아니면 몸만 숨긴다(옷을 고를 때 몸을 가리지 않게).
   ⚠️ 몸 그룹에 setDeskScale · setDeskPos 를 부르지 말 것 — 그 둘은 좌석 규약(z 보정)으로 position.z 를 다시 써서 미리보기 자리(−CHAR_Z · xf 보정)가 깨진다.
   ⚠️ deskPos 는 100% 단위다 — 화면 자리에는 anim(동물 0.4 · 사람 1)을 곱해 더하고, 읽을 때는 나눈다(setDeskPos 의 배율과 같은 값).
   classic script(window.TwWdDeskPreview) — wardrobe.js · app.js 보다 먼저 싣는다. 검사: checks/sim-wd-desk-preview.js */
(function(){

const ROUND = 1000;   // deskPos 소수 셋째 자리까지(생성기 표시와 같은 정밀도보다 한 자리 더)

/** @param {{ buildDesk: Function, deskBodyPlan: Function, drawDeskGlb: Function, hideDeskBody: Function, applyDeskColor: Function,
 *    syncDeskPartAnchor: Function, DEFAULT_DESK_OVERRIDE_ID: string }} deps */
function createWdDeskPreview(deps){
const buildDesk = deps.buildDesk;
const deskBodyPlan = deps.deskBodyPlan;
const drawDeskGlb = deps.drawDeskGlb;
const hideDeskBody = deps.hideDeskBody;
const applyDeskColor = deps.applyDeskColor;
const syncDeskPartAnchor = deps.syncDeskPartAnchor;
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;

/* st: 지금 세운 몸 — null 이면 없음. base0 = deskPos 를 뺀 자리(anchorGroup.position − deskPos × anim) */
let st = null, shown = false;

const isZero = (p) => !p || (!p.x && !p.y && !p.z);
const r3 = (v) => Math.round(v * ROUND) / ROUND || 0;   // -0 → 0

function dispose(){
  if(!st) return;
  st.alive = false;                       // 받는 중인 GLB 가 늦게 와도 끼우지 않는다
  st.scene.remove(st.body);
  st = null;
}
function paint(def){ if(st && def.deskColor) applyDeskColor(st.seat, def.deskColor); }
function place(){ st.body.position.copy(st.anchorGroup.position); st.body.scale.copy(st.anchorGroup.scale); }

/* 미리보기를 다시 만들 때마다 부른다 — 앞 몸은 치우고 새로 세운다. 돌려주는 Promise 는 몸을 다 그렸을 때 끝난다. */
function rebuild(o){
  dispose();
  const def = o.def, anim = o.anim || 1;
  const body = buildDesk(true);
  const top = body.getObjectByName('deskTop');
  let deskMat = null;
  if(top){ top.material = top.material.clone(); deskMat = top.material; }   // 좌석(createSeat)과 같게 — 색을 칠해도 공용 재질이 안 바뀐다
  const dp = def.deskPos || {};
  const me = st = { scene:o.scene, body, anchorGroup:o.anchorGroup, anim, alive:true, seat:{ desk:body, deskMat },
    base0:{ x:o.anchorGroup.position.x - (+dp.x||0)*anim, y:o.anchorGroup.position.y - (+dp.y||0)*anim, z:o.anchorGroup.position.z - (+dp.z||0)*anim } };
  place();
  body.visible = shown;
  o.scene.add(body);
  const plan = deskBodyPlan(def.deskCatalogId ? def : { deskCatalogId: DEFAULT_DESK_OVERRIDE_ID }, true);
  if(plan.kind === 'none'){ hideDeskBody(body); return Promise.resolve(); }
  if(plan.kind === 'builtin'){ paint(def); return Promise.resolve(); }
  paint(def);   // GLB 를 받는 동안 보이는 내장 책상
  return drawDeskGlb(body, plan.rec, !def.deskCatalogId || def.deskCatalogId === DEFAULT_DESK_OVERRIDE_ID, null, ()=>me.alive)
    .then(()=>{ if(me.alive) paint(def); });
}
function setShown(on){ shown = !!on; if(st) st.body.visible = shown; }
/* 색 · 크기 · 길이를 끄는 동안 — 다시 만들지 않고 몸 그룹만 맞춘다(anchorGroup 은 놓을 때 다시 만들어진다) */
function tune(def){
  if(!st) return;
  const s = (def.deskScale != null) ? def.deskScale : 1, lx = (def.deskLenX != null) ? def.deskLenX : 1, a = st.anim;
  st.body.scale.set(s*lx*a, s*a, s*a);
  paint(def);
}
/* 기즈모를 붙일 몸 — 숨겨져 있거나 «책상 없음» 이면 null */
function body(){ return (st && shown && !st.body.userData.noDesk) ? st.body : null; }
/* 기즈모가 몸을 옮긴 뒤 — 자리를 deskPos(100% 단위)로 읽고, 바닥 아래로는 못 가게 막고, anchorGroup · 파츠 핀을 같은 자리로 맞춘다 */
function readPos(){
  if(!st) return null;
  const b = st.body.position, a = st.anim;
  const pos = { x:r3((b.x - st.base0.x)/a), y:Math.max(0, r3((b.y - st.base0.y)/a)), z:r3((b.z - st.base0.z)/a) };
  apply(pos);
  return pos;
}
function apply(pos){
  const a = st.anim;
  st.body.position.set(st.base0.x + pos.x*a, st.base0.y + pos.y*a, st.base0.z + pos.z*a);
  st.anchorGroup.position.copy(st.body.position);
  /* 파츠 핀은 deskPosBase 만 상쇄한다 — 0 이면 지워 둔다(wardrobe.js 가 처음 만들 때와 같은 모양) */
  if(isZero(pos)) delete st.anchorGroup.userData.deskPosBase; else st.anchorGroup.userData.deskPosBase = { x:pos.x, y:pos.y, z:pos.z };
  syncDeskPartAnchor(st.anchorGroup);
}
function resetPos(){ if(!st) return null; const z = { x:0, y:0, z:0 }; apply(z); return z; }

return { rebuild, dispose, setShown, tune, body, readPos, resetPos, isZero };
}

const api = { createWdDeskPreview };
if(typeof window !== 'undefined') window.TwWdDeskPreview = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
