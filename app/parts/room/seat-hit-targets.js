/* seat-hit-targets.js — 🎯 좌석에서 «누를 수 있는 조각» 과 그 히트 맵 — 그린 직후에 만들고, 커서 자리에서 그 조각에만 광선
   왜: 통과 판정은 모든 좌석의 자손 전부에 광선을 쏜다(뼈까지 돈다). 조각마다 광선 판정이 스스로 쓰는 첫 거르기(경계 구)를
     그린 직후 화면 사각형으로 셈해 두면(launcher/hit-map.js), 커서가 사각형 안인 조각만 쏴도 답이 같다.
   ★ 조각 = 좌석 group 아래에서 스스로 raycast 를 가진 자손(three 의 intersectObject 와 같게 layers 도 본다).
     빼는 것은 지금 통과 판정이 히트에서 빼는 것과 같다 — 날아가는 몸 · 숨은 책상(hidden-seats.js 의 _partSkipped 한 곳).
     숨은 자리비움 몸은 넣는다(쓰다듬기 — hidden-seats.js 주석).
   ★ 경계 구: 메시는 Mesh.raycast 와 같은 구(boundingSphere × matrixWorld) · 스프라이트는 자리 + 크기 · 그 밖(InstancedMesh ·
     Line · 꺼 둔 raycast 등 처음 보는 raycast)은 «전체»(늘 정밀) — 모르는 것을 «멀다» 로 치지 않는다.
   ★ 지도는 캐시가 아니라 그린 장마다 새로 만든 값이다(무효화 없음). 낡았거나(HIT_MAP_STALE_MS) 못 만들었으면 pick 은
     모든 좌석에 광선(지금 판정과 같은 길).
   ★ 0.12.4 는 그림자 운행 — 통과 판정의 답은 옛 판정이 정하고, desktop-run.js 가 pick 을 옆에서 돌려 다르면 센다(launcher/hit-shadow.js).
   설계: tw-docs design/app/hit-map.md · 검사: checks/sim-seat-hit-targets.js */
(function(){
'use strict';

/**
 * @param {{
 *   THREE: any,
 *   hitMap: any,                      // TwHitMap(launcher/hit-map.js)
 *   seats: any[],
 *   camera: any,
 *   ray: any,                         // 통과 판정이 쓰는 Raycaster — layers 를 같이 본다
 *   canvasRect: () => {left:number, top:number, width:number, height:number} | null,   // 이번 장의 캔버스 사각형(CSS px)
 *   partSkipped: (obj: any) => boolean,   // 통과 판정이 히트에서 빼는 조각(날아가는 몸 · 숨은 책상)
 *   skipHits: (hits: any[]) => any[],     // 같은 규칙을 히트 목록에(낡은 지도일 때의 전체 광선)
 *   now: () => number,
 *   noteBuild: (ms: number, st: any, err: boolean) => void,
 * }} deps
 */
function createSeatHitTargets(deps){
  const THREE = deps.THREE;
  const HitMap = deps.hitMap;
  const seats = deps.seats;
  const camera = deps.camera;
  const ray = deps.ray;
  const canvasRect = deps.canvasRect;
  const partSkipped = deps.partSkipped;
  const skipHits = deps.skipHits;
  const now = deps.now;
  const noteBuild = deps.noteBuild;

  const NO_RC = THREE.Object3D.prototype.raycast;   // 빈 함수 — Group · Bone · Object3D
  const MESH_RC = THREE.Mesh.prototype.raycast;     // SkinnedMesh 도 이것(r128)
  const SPRITE_RC = THREE.Sprite.prototype.raycast;

  const map = HitMap.createMap();
  const objs = [];                 // 지도 조각 번호 → Object3D
  const st = { seats: 0, parts: 0, tris: 0, full: 0 };
  const _v = new THREE.Vector3(), _s = new THREE.Vector3();
  const _cand = [], _pickObjs = [], _all = [];
  let V = null, P = null, vp = null;

  function addObj(o, si, kind){
    const rc = o.raycast;
    if(rc === NO_RC) return;
    if(partSkipped(o)) return;
    if(rc === MESH_RC){
      if(o.material === undefined) return;   // Mesh.raycast 가 바로 돌아가는 조각
      const g = o.geometry;
      if(!g){ HitMap.addFull(map, si, kind); objs.push(o); return; }
      if(g.boundingSphere === null) g.computeBoundingSphere();   // Mesh.raycast 가 처음 부를 때 하는 일과 같다
      const bs = g.boundingSphere;
      _v.copy(bs.center).applyMatrix4(o.matrixWorld);
      const i = HitMap.addSphere(map, si, kind, _v.x, _v.y, _v.z, bs.radius * o.matrixWorld.getMaxScaleOnAxis(), V, P, vp);
      if(i >= 0) objs.push(o);
      const pos = g.attributes && g.attributes.position;
      st.tris += g.index ? g.index.count / 3 : (pos ? pos.count / 3 : 0);
      return;
    }
    /* Sprite.raycast — 꼭짓점 = 카메라 기준 자리 + (v − center + 0.5) × 크기(회전). 크기를 거리로 늘리는 판(sizeAttenuation 끔)은 모름 */
    if(rc === SPRITE_RC && o.material && o.center && !(camera.isPerspectiveCamera && o.material.sizeAttenuation === false)){
      _s.setFromMatrixScale(o.matrixWorld);
      const ex = Math.max(Math.abs(o.center.x), Math.abs(1 - o.center.x)) * Math.abs(_s.x);
      const ey = Math.max(Math.abs(o.center.y), Math.abs(1 - o.center.y)) * Math.abs(_s.y);
      _v.setFromMatrixPosition(o.matrixWorld);
      const i = HitMap.addSphere(map, si, kind, _v.x, _v.y, _v.z, Math.hypot(ex, ey) * camera.matrixWorld.getMaxScaleOnAxis(), V, P, vp);
      if(i >= 0) objs.push(o);
      return;
    }
    HitMap.addFull(map, si, kind); objs.push(o);
  }
  function walk(o, si, rig, inRig){
    const r = inRig || o === rig;
    if(o.layers.test(ray.layers)) addObj(o, si, r ? 'rig' : 'base');
    const ch = o.children;
    for(let k = 0; k < ch.length; k++) walk(ch[k], si, rig, r);
  }

  /* 그린 직후에 부른다(행렬은 renderer.render 가 세웠다). why 가 있으면 빈 지도(회사원 숨김 · 실행 화면 아님) */
  function rebuild(why){
    const t0 = now();
    let err = false;
    objs.length = 0;
    st.seats = 0; st.parts = 0; st.tris = 0; st.full = 0;
    try{
      if(why){ HitMap.reset(map, t0, why, null); return; }
      const rect = canvasRect();
      if(!rect || !(rect.width > 0 && rect.height > 0)){ HitMap.reset(map, -Infinity, 'noCanvas', null); return; }
      vp = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      V = camera.matrixWorldInverse.elements; P = camera.projectionMatrix.elements;
      HitMap.reset(map, t0, '', vp);
      for(let i = 0; i < seats.length; i++){
        const s = seats[i];
        if(!s || !s.group) continue;
        st.seats++;
        walk(s.group, i, s.rig, false);
      }
      st.parts = map.n; st.full = map.full; st.tris = Math.round(st.tris);
    }catch(_){
      err = true;
      HitMap.reset(map, -Infinity, 'error', null); objs.length = 0;   // 못 만들면 늘 낡음 — pick 이 전체 광선으로
    }finally{
      noteBuild(now() - t0, st, err);
    }
  }

  /* 새 판정 — ray 는 이미 setFromCamera 됐다(통과 판정이 세운 그 광선). allowRay 가 거짓이면 광선은 안 쏘고 지도만 본다.
     돌려주는 값: { hit, obj, inRect, stale, skipped } */
  function pick(r, cx, cy, allowRay){
    const t = now();
    const stale = !HitMap.fresh(map, t);
    const inRect = HitMap.candidates(map, cx, cy, HitMap.HIT_MAP_PAD_PX, _cand).length > 0;
    if(stale){
      if(!allowRay) return { hit: false, obj: null, inRect, stale, skipped: true };
      _all.length = 0;
      for(let i = 0; i < seats.length; i++) _all.push(seats[i].group);
      const hits = skipHits(r.intersectObjects(_all, true));
      return { hit: hits.length > 0, obj: hits.length ? hits[0].object : null, inRect, stale, skipped: false };
    }
    if(!inRect) return { hit: false, obj: null, inRect, stale, skipped: false };
    if(!allowRay) return { hit: false, obj: null, inRect, stale, skipped: true };
    _pickObjs.length = 0;
    for(let i = 0; i < _cand.length; i++) _pickObjs.push(objs[_cand[i]]);
    const hits = r.intersectObjects(_pickObjs, false);
    return { hit: hits.length > 0, obj: hits.length ? hits[0].object : null, inRect, stale, skipped: false };
  }

  function seatOf(obj){
    for(let o = obj; o; o = o.parent){
      for(let i = 0; i < seats.length; i++) if(seats[i] && seats[i].group === o) return i;
    }
    return -1;
  }
  function inRigOf(obj, seat){
    const rig = seat && seat.rig;
    for(let o = obj; o; o = o.parent) if(o === rig) return true;
    return false;
  }
  /* 다를 때 줄의 재료 — 맞은 조각(obj)이 어느 좌석 · 몸인지 · 그 좌석 사각형 · 지도 나이 · 그 좌석 상태 */
  function describe(obj, cx, cy, extra){
    const si = seatOf(obj), seat = si >= 0 ? seats[si] : null;
    const kind = seat ? (inRigOf(obj, seat) ? 'rig' : 'base') : '';
    const q = si >= 0 ? map.seats[si] : null;
    return Object.assign({
      x: cx, y: cy, seat: si, kind, rect: q ? q[kind] || null : null, age: now() - map.at,
      fly: !!(seat && seat.fly), ride: !!(seat && seat.ridingOn), bench: !!(seat && (seat.bench || seat._benchSit)), away: !!(seat && seat._bodyOff),
      oldWhy: seat ? (seat.isMe ? 'char:me' : 'char:other#' + si) : (obj ? 'char:?' : '-'),
    }, extra || {});
  }

  return { rebuild, pick, describe, map: () => map, objs: () => objs };
}

const api = { createSeatHitTargets };
if(typeof window !== 'undefined') window.TwSeatHitTargets = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
