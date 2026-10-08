/* ═══ 🐾 사람 귀 — 꾸미기 › 머리 › 귀 ══════════════════════════════════════════════════════
   동물 생성기의 귀(ears-glb.js · ANIMAL_EAR_TYPES)를 사람 캐릭터 머리에 붙인다. app.js 보다 먼저 로드된다.
   THREE 와 귀 파서는 deps 로 받는다 — 귀 GLB 파싱 캐시는 animal.js(_parseEar)와 같이 쓴다.

   [자리 맞추기] 귀 GLB 는 동물 몸(animal-glb.js) 좌표에 박혀 있다. 그대로 붙이면 사람 머리 속에 묻힌다
     (사람 머리가 귀 본 기준 1.01 높다). 그래서 «동물 귀 본 → 이 캐릭터 귀 본» 만큼 옮긴다.
     귀 본이 없는 모델은 head 본에서 사람 기본 모델의 거리만큼 떨어진 곳을 귀 본으로 친다.

   [붙는 구조] head 본 ─ holder(Group) ─ wrap(귀 한쪽) ─ 귀 메쉬
     holder 는 **바인드 자세에서** head 본에 attach 해 «모델 원점 좌표» 를 그대로 품는다.
     그래서 wrap 의 위치·회전·크기(조정값)는 늘 모델 원점 기준이고, 머리가 움직이면 같이 따라간다.
     동물 귀처럼 붙인 뒤에 재부모화하면, 귀 파싱이 늦게 끝났을 때 이미 움직이는 머리 기준으로 붙어 비뚤어진다.

   [조정값] 동물과 같은 모양 {px,py,pz,rot,rx,ry,sc,scx,scy,scz} — rot 이 Z 축이다(animal.js EAR_ADJ_DEFAULT 주석). */
(function(){
'use strict';

const EAR_SIDES = ['L', 'R'];
/* 귀 GLB 가 맞춰 만들어진 자리 = animal-glb.js 의 ear_L/ear_R 본(바인드 자세 · 모델 원점 기준).
   sim-human-ear.js 가 GLB 에서 다시 계산해 이 값과 맞는지 본다. */
const ANIMAL_EAR_BONE = { L:[ 0.7872, 2.8279, 0.4792 ], R:[ -0.7872, 2.8279, 0.4792 ] };
/* 귀 본이 없는 모델에서 head 본 → 귀 본 거리 — base-glb.js 실측(같은 검사가 본다). */
const HEAD_TO_EAR = { L:[ 0.7872, 1.8536, 0.3643 ], R:[ -0.7872, 1.8536, 0.3643 ] };
const HOLDER_NAME = '__humanEarHolder';

const EAR_ADJ_DEFAULT = { px:0, py:0, pz:0, rot:0, rx:0, ry:0, sc:1, scx:1, scy:1, scz:1 };
function newAdj(){ return Object.assign({}, EAR_ADJ_DEFAULT); }
function earRot(a){
  return { x:(a && a.rx  != null) ? a.rx  : 0,
           y:(a && a.ry  != null) ? a.ry  : 0,
           z:(a && a.rot != null) ? a.rot : 0 };
}
function earScale(a){
  const u = (a && a.sc != null) ? a.sc : 1;
  return { x:(a && a.scx != null) ? a.scx : u,
           y:(a && a.scy != null) ? a.scy : u,
           z:(a && a.scz != null) ? a.scz : u };
}
/* 방에서 받은 값은 믿지 않는다 — 아는 키의 유한한 숫자만 남긴다. */
function cleanAdj(a){
  const out = newAdj();
  if(!a || typeof a !== 'object') return out;
  Object.keys(EAR_ADJ_DEFAULT).forEach(k=>{ const v = a[k]; if(typeof v === 'number' && isFinite(v)) out[k] = v; });
  return out;
}
/* 좌우 대칭 = x 축 반사 — animal.js ⇆ 와 같은 규칙. X 축 회전은 그대로, Y·Z 축 회전은 부호 반전.
   받는 쪽을 통째로 새 객체로 만든다(일부 키만 덮으면 옛 값이 섞인다). */
function mirrorAdj(a){
  const s = earScale(a), r = earRot(a);
  return { px:-((a && a.px) || 0), py:(a && a.py) || 0, pz:(a && a.pz) || 0,
           rot:-r.z, rx:r.x, ry:-r.y,
           sc:(a && a.sc != null) ? a.sc : 1, scx:s.x, scy:s.y, scz:s.z };
}

function createHumanEar(deps){
  const THREE = deps.THREE;
  const parseEar = deps.parseEar;                       // (key, cb(scene|null))
  const earTypes = deps.earTypes || (()=>[]);           // () => [{key,label}]

  function isEarType(t){ return typeof t === 'string' && earTypes().some(x=>x && x.key === t); }

  /* def → 귀 상태. 모르는 귀 종류(옛 앱이 모르는 새 귀 · 잘못된 값)는 «없음» 으로 본다. */
  function readDef(def){
    const d = def || {}, adj = d.earAdj || {};
    return { L:isEarType(d.earL) ? d.earL : null,
             R:isEarType(d.earR) ? d.earR : null,
             adj:{ L:cleanAdj(adj.L), R:cleanAdj(adj.R) } };
  }
  function hasEars(def){ const s = readDef(def); return !!(s.L || s.R); }

  function _bones(root){
    const b = { head:null, L:null, R:null };
    root.traverse(o=>{
      if(!o.isBone) return;
      const n = String(o.name || '');
      if(!b.head && /^head$/i.test(n)) b.head = o;
      const m = /^ear[_.]?([lr])$/i.exec(n);   // 'earring' 같은 이름은 안 잡는다
      if(m){ const s = m[1].toUpperCase(); if(!b[s]) b[s] = o; }
    });
    if(!b.head) root.traverse(o=>{ if(!b.head && o.isBone && /head/i.test(o.name || '')) b.head = o; });
    return b;
  }

  /* 귀 GLB 를 이 캐릭터에 맞추려고 옮길 양(모델 원점 기준). 귀 본도 head 본도 없으면 null. */
  function shiftFor(root, side){
    const b = _bones(root);
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const local = (o)=>o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    let at = null;
    if(b[side]) at = local(b[side]);
    else if(b.head) at = local(b.head).add(new THREE.Vector3().fromArray(HEAD_TO_EAR[side]));
    if(!at) return null;
    return at.sub(new THREE.Vector3().fromArray(ANIMAL_EAR_BONE[side]));
  }

  function _findHolder(root){
    let h = null;
    root.traverse(o=>{ if(!h && o.name === HOLDER_NAME) h = o; });
    return h;
  }
  /* ⚠️ 바인드 자세에서 불러야 한다 — defToBase 처럼 조립 직후. 머리가 움직이는 중에 만들면 그 각도가 굳는다.
     그래서 defToBase 가 귀가 없어도 미리 만들어 두고, 옮길 양(shift)도 이때 재서 holder 에 적어 둔다 —
     나중에 꾸미기에서 귀를 고르면 이미 움직이는 좌석이라 그때 재면 틀린다. */
  function ensureHolder(root){
    let h = _findHolder(root);
    if(h) return h;
    const shift = { L:shiftFor(root, 'L'), R:shiftFor(root, 'R') };
    h = new THREE.Group();
    h.name = HOLDER_NAME;
    h.userData.shift = shift;
    /* 크기 정규화(measureCharBox · measureHeadBoxNoParts)에서 뺀다 — 동물 귀 wrap 의 rigged 표식과 같은 이유.
       귀는 비동기로 붙어서, 재는 순간에 따라 캐릭터 키가 흔들린다. */
    h.userData.rigged = true;
    root.add(h);
    const head = _bones(root).head;
    if(head){ root.updateMatrixWorld(true); head.attach(h); }
    return h;
  }

  function applyAdj(wrap, adj){
    if(!wrap) return;
    const a = adj || EAR_ADJ_DEFAULT, pv = wrap.userData.pivot || { x:0, y:0, z:0 };
    wrap.position.set(pv.x + (a.px || 0), pv.y + (a.py || 0), pv.z + (a.pz || 0));
    const r = earRot(a); wrap.rotation.set(r.x, r.y, r.z);
    const s = earScale(a); wrap.scale.set(s.x, s.y, s.z);
  }

  /* 기즈모로 움직인 wrap → 조정값. applyAdj 의 역함수다(피봇을 빼고, 회전 세 축 · 축별 크기). */
  function readAdj(wrap){
    const pv = wrap.userData.pivot || { x:0, y:0, z:0 };
    const s = wrap.scale;
    return { px:wrap.position.x - pv.x, py:wrap.position.y - pv.y, pz:wrap.position.z - pv.z,
             rot:wrap.rotation.z, rx:wrap.rotation.x, ry:wrap.rotation.y,
             sc:s.x, scx:s.x, scy:s.y, scz:s.z };
  }

  function findWrap(root, side){
    let w = null;
    root.traverse(o=>{ if(!w && o.userData && o.userData.humanEar === side) w = o; });
    return w;
  }
  function detach(root, side){
    const w = findWrap(root, side);
    if(w && w.parent) w.parent.remove(w);
  }

  /* 한쪽 귀를 붙인다. 이미 붙은 같은 쪽 귀는 떼어 낸다.
     opts.material(side) → 귀 재질 · opts.isStale() → true 면 파싱이 끝났을 때 붙이지 않는다(그사이 종류가 바뀜)
     opts.onAttach(wrap) → 붙은 뒤(동기 캐시 히트면 이 함수 안에서) */
  function attachSide(root, side, type, adj, opts){
    const o = opts || {};
    detach(root, side);
    if(!type || !isEarType(type)) return;
    const holder = ensureHolder(root);
    const shift = (holder.userData.shift && holder.userData.shift[side]) || new THREE.Vector3();
    parseEar('ear_' + type + '_' + side, (scene)=>{
      if(!scene) return;
      if(o.isStale && o.isStale()) return;
      detach(root, side);                     // 같은 쪽을 빠르게 두 번 고르면 콜백이 둘 온다
      const obj = scene.clone(true);
      const mat = o.material ? o.material(side) : null;
      obj.traverse(m=>{ if(m.isMesh){ if(mat) m.material = mat; m.frustumCulled = false; m.castShadow = true; } });
      // 피봇을 귀 중심으로 — animal.js _attachEar 와 같은 보정. 기즈모 위치·회전 중심이 귀에 온다.
      obj.updateMatrixWorld(true);   // 복제본의 matrixWorld 는 원본 시점 값이라 믿지 않는다
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      obj.position.sub(c);
      const wrap = new THREE.Group();
      wrap.add(obj);
      wrap.userData.pivot = c.clone().add(shift);
      wrap.userData.humanEar = side;
      applyAdj(wrap, adj);
      holder.add(wrap);
      if(o.onAttach) o.onAttach(wrap);
    });
  }

  /* def 대로 양쪽 귀를 붙인다. 귀가 하나도 없으면 holder 도 만들지 않는다. */
  function attachFromDef(root, def, opts){
    const s = readDef(def);
    EAR_SIDES.forEach(side=>{
      if(s[side]) attachSide(root, side, s[side], s.adj[side], opts);
      else detach(root, side);
    });
    return s;
  }

  return { readDef, hasEars, shiftFor, ensureHolder, applyAdj, readAdj, findWrap, detach, attachSide, attachFromDef };
}

const api = { EAR_SIDES, ANIMAL_EAR_BONE, HEAD_TO_EAR, HOLDER_NAME, EAR_ADJ_DEFAULT,
              newAdj, earRot, earScale, cleanAdj, mirrorAdj, createHumanEar };
if(typeof window !== 'undefined') window.HumanEar = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
