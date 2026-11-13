/* seat-hit-targets.js — 🎯 좌석에서 «누를 수 있는 조각» 과 그 히트 맵 — 마지막으로 그린 장의 행렬로 만들고, 커서 자리에서 그 조각에만 광선
   왜: 통과 판정은 모든 좌석의 자손 전부에 광선을 쏜다(뼈까지 돈다). 조각마다 광선 판정이 스스로 쓰는 첫 거르기(경계 구)를
     그린 장의 행렬로 화면 사각형을 셈해 두면(launcher/hit-map.js), 커서가 사각형 안인 조각만 쏴도 답이 같다.
   ★ 조각 = 좌석 group 아래에서 스스로 raycast 를 가진 자손(three 의 intersectObject 와 같게 layers 도 본다).
     빼는 것은 지금 통과 판정이 히트에서 빼는 것과 같다 — 날아가는 몸 · 숨은 책상(hidden-seats.js 의 _partSkipped 한 곳).
     숨은 자리비움 몸은 넣는다(쓰다듬기 — hidden-seats.js 주석).
   ★ 경계 구: 메시는 Mesh.raycast 와 같은 구(boundingSphere × matrixWorld) · 스프라이트는 자리 + 크기 · 그 밖(InstancedMesh ·
     Line · 꺼 둔 raycast 등 처음 보는 raycast)은 «전체»(늘 정밀) — 모르는 것을 «멀다» 로 치지 않는다.
   ★ 지도는 «마지막으로 그린 장» 의 행렬로 만든 값이다. 그린 장은 frame() 이 markRendered() 로 표시만 하고, 지도는 판정이
     지도를 찾을 때 그 장 것이 아니면 그때 한 번 만든다(마우스를 안 움직이면 비용 0 · 옛 판정과 같은 시점의 행렬).
     무효화 규칙은 없다 — 장 번호가 바뀌면 다시 만든다. 못 만들었으면 pick 은 모든 좌석에 광선(지금 판정과 같은 길).
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
 *   canvasRect: () => {left:number, top:number, width:number, height:number} | null,   // 캔버스 사각형(CSS px)
 *   officeHidden: () => boolean,      // 회사원 모드 숨김(그리기를 건너뜀)
 *   configHidden: () => boolean,      // 설정 화면이 캔버스를 가림(그리기를 건너뜀)
 *   isRunmode: () => boolean,         // 실행 화면인가(아니면 판정이 3D 까지 안 감)
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
  const officeHidden = deps.officeHidden;
  const configHidden = deps.configHidden;
  const isRunmode = deps.isRunmode;
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
  let seq = 0, renderedAt = -Infinity, mapSeq = -1;   // 그린 장 번호 · 시각 · 지도를 만든 장 번호
  const res = { hit: false, obj: null, inRect: false, stale: false, skipped: false, built: false };   // pick 결과 — 판정마다 새 객체를 안 만든다

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

  /* frame() 이 그린 직후 한 줄로 부른다 — 표시만(지도는 판정이 찾을 때 만든다) */
  function markRendered(){ seq++; renderedAt = now(); }

  /* 지도 만들기 — 까닭(회사원 숨김 · 설정 화면 · 실행 화면 아님)이 있으면 빈 지도 */
  function rebuild(){
    const t0 = now();
    let err = false;
    mapSeq = seq;
    const why = HitMap.skipWhy({ officeHidden: officeHidden(), configHidden: configHidden(), runmode: isRunmode() });
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

  /* 새 판정 — ray 는 이미 setFromCamera 됐다(통과 판정이 세운 그 광선). 지도가 마지막으로 그린 장 것이 아니면 먼저 만든다.
     allowRay 가 거짓이면(예산 넘음) 광선을 안 쏘고, 지도가 지난 장 것이면 다시 만들지도 않는다. 돌려주는 값은 늘 같은 객체(res) — 다음 pick 전에 읽는다.
     { hit, obj, inRect, stale(지도를 못 만들어 전체 광선), skipped, built(이번에 지도를 만들었나) } */
  function pick(r, cx, cy, allowRay){
    const need = mapSeq !== seq;
    const inRectOld = need && !allowRay && HitMap.candidates(map, cx, cy, HitMap.HIT_MAP_PAD_PX, _cand).length > 0;
    res.hit = false; res.obj = null; res.built = false; res.skipped = false;
    if(need && !allowRay){ res.inRect = inRectOld; res.stale = false; res.skipped = true; return res; }   // 예산을 넘은 판정은 지도도 안 만든다(구간은 앞 지도로 어림)
    if(need){ rebuild(); res.built = true; }
    const stale = !isFinite(map.at);
    const inRect = HitMap.candidates(map, cx, cy, HitMap.HIT_MAP_PAD_PX, _cand).length > 0;
    res.inRect = inRect; res.stale = stale;
    if(stale){
      if(!allowRay){ res.skipped = true; return res; }
      _all.length = 0;
      for(let i = 0; i < seats.length; i++) _all.push(seats[i].group);
      const hits = skipHits(r.intersectObjects(_all, true));
      res.hit = hits.length > 0; res.obj = hits.length ? hits[0].object : null;
      return res;
    }
    if(!inRect) return res;
    if(!allowRay){ res.skipped = true; return res; }
    _pickObjs.length = 0;
    for(let i = 0; i < _cand.length; i++) _pickObjs.push(objs[_cand[i]]);
    const hits = r.intersectObjects(_pickObjs, false);
    res.hit = hits.length > 0; res.obj = hits.length ? hits[0].object : null;
    return res;
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
  /* 다를 때 줄의 재료 — 맞은 조각(obj)이 어느 좌석 · 몸인지 · 그 좌석 사각형 · 마지막으로 그린 뒤 시간 · 그 좌석 상태 */
  function describe(obj, cx, cy, extra){
    const si = seatOf(obj), seat = si >= 0 ? seats[si] : null;
    const kind = seat ? (inRigOf(obj, seat) ? 'rig' : 'base') : '';
    const q = si >= 0 ? map.seats[si] : null;
    return Object.assign({
      x: cx, y: cy, seat: si, kind, rect: q ? q[kind] || null : null, age: now() - renderedAt,
      fly: !!(seat && seat.fly), ride: !!(seat && seat.ridingOn), bench: !!(seat && (seat.bench || seat._benchSit)), away: !!(seat && seat._bodyOff),
      oldWhy: seat ? (seat.isMe ? 'char:me' : 'char:other#' + si) : (obj ? 'char:?' : '-'),
    }, extra || {});
  }

  return { markRendered, pick, describe, map: () => map, objs: () => objs };
}

const api = { createSeatHitTargets };
if(typeof window !== 'undefined') window.TwSeatHitTargets = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
