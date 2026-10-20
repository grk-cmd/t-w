/* 🎀 파츠 붙이기의 캐릭터 몫 — 파츠 GLB 장면을 캐릭터에 붙일 한 벌로 만든다(복제 · 재질 · _col 색 묶음 · _pic 그림칸 ·
   리깅 판정 · 캐릭터 본에 다시 묶기 · 가운데 맞춘 wrapper · 저작 오프셋).
   좌석 몫(장착 차례 · 겹치는 옷 벗기기 · 귀 까닥임 등록 · 애니메이션 · 진단 로그 · 좌석에 저장)은 앱이 한다.
   재질 톤 · 그림칸 규칙은 아직 앱 모듈이라 주입받는다(색조 #437 에서 코어로). */

type Three = any;
type Obj = any;

export interface PartsDeps {
  THREE: Three;
  /** 파츠 재질 톤(조명 평탄화) — 썸네일과 같은 함수 */
  applyPartMatTone(m: Obj): void;
  /** 투명 재질의 알파 출력을 불투명으로 — 그리는 차례가 바뀌어도 같게 */
  forceOpaqueAlphaOutput(m: Obj): void;
  /** 그림칸(_pic) 메쉬인가 */
  meshIsPic(o: Obj): boolean;
  /** 그림칸의 진짜 UV 가 두 번째 칸에 있으면 첫 칸으로 옮긴다 — 옮겼으면 true */
  picRepairUV(o: Obj): boolean;
  /** 텍스처가 있는데 첫 UV 칸이 비었나(고치지 않고 알리기만) */
  uvLooksBroken(o: Obj): boolean;
  log?: (msg: string) => void;
  warn?: (msg: string, e?: unknown) => void;
}

export interface PrepareHooks {
  onPicUvRepaired?(mesh: Obj): void;
  onUvBroken?(mesh: Obj): void;
}

/** 카테고리 기본 오프셋 { cat: {x, y, z} } — 눈으로 눌러 맞춰 둔 카테고리 상수 */
export type DefaultOffsets = Record<string, { x: number; y: number; z: number } | undefined>;

export interface RigOptions {
  /** 캐릭터 본에 자동 연결하지 않는 파츠(🧷 단독 부착 등 — 부르는 쪽이 정한다)면 리깅으로 보지 않는다 */
  standalone: boolean;
  /** 같은 리그 계열인가(동물이 아니다) — 본이 1~2개뿐인 파츠를 리깅으로 인정하는 완화 규칙은 같은 계열에만 */
  rigFamilyMatches: boolean;
}

const COL_RE = /_col(\d*)/i;

export function createParts(deps: PartsDeps) {
  const { THREE } = deps;
  if (!THREE) throw new Error('char-core: deps.THREE 가 필요하다');
  const log = deps.log || ((m: string) => console.log(m));
  const warn = deps.warn || ((m: string, e?: unknown) => console.warn(m, e));
  const cloneScene = (scene: Obj) => (THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(scene) : scene.clone(true));

  /** 메쉬마다 재질 복제 · 톤 · 투명 차례 — 본체와 다중 파츠 인스턴스가 같은 규칙 */
  function prepMaterial(o: Obj): Obj {
    o.castShadow = true;
    o.frustumCulled = false;
    const m = o.material && o.material.clone ? o.material.clone() : o.material;
    o.material = m;
    if (m) {
      deps.applyPartMatTone(m);
      // 투명 재질은 장면에 들어가는 차례에 따라 그려지는 차례가 바뀐다 — 차례와 무관하게 늘 같게
      if (m.transparent) { o.renderOrder = 10; deps.forceOpaqueAlphaOutput(m); }
    }
    return m;
  }
  /** "_col" 은 메쉬 이름 · 재질 이름 어디에 붙어도 — 번호가 없으면 col1 */
  function addColorGroup(groups: Record<string, Obj[]>, o: Obj, m: Obj, meshNameFirst: boolean) {
    const colMatch = (meshNameFirst ? o.name.match(COL_RE) : o.name && o.name.match(COL_RE)) || (m && m.name && m.name.match(COL_RE));
    if (!colMatch) return;
    const key = 'col' + (colMatch[1] || '1');
    if (m && m.color) o.userData.origColor = m.color.getHexString();
    (groups[key] = groups[key] || []).push(o);
  }

  /** 파츠 장면 → 붙일 한 벌. 이 파츠의 모든 본에 _partAdopted 를 찍는다 — 뒤에 붙는 파츠가 이 본을 캐릭터 본으로 오인하지 않게. */
  function prepareScene(scene: Obj, cat: string, hooks: PrepareHooks = {}) {
    const obj = cloneScene(scene);
    const colorGroups: Record<string, Obj[]> = {};
    const picMeshes: Obj[] = [];
    obj.traverse((o: Obj) => {
      if (!o.isMesh) return;
      const m = prepMaterial(o);
      // ⚠️ _pic 은 _col 대상에서 뺀다 — 둘을 걸면 색(곱셈)이 그림 위에 겹쳐 고른 색과 찍히는 색이 어긋난다.
      if (deps.meshIsPic(o)) {
        if (deps.picRepairUV(o) && hooks.onPicUvRepaired) hooks.onPicUvRepaired(o);
        picMeshes.push(o);
        return;
      }
      if (m && m.map && deps.uvLooksBroken(o) && hooks.onUvBroken) hooks.onUvBroken(o);
      addColorGroup(colorGroups, o, m, true);
    });
    obj.name = '__part_' + cat;
    obj.traverse((o: Obj) => { if (o.isBone) { o.userData = o.userData || {}; o.userData._partAdopted = true; } });
    return { obj, colorGroups, picMeshes };
  }

  /** 캐릭터 본 이름 → 본. 다른 파츠가 입양시킨 본(_partAdopted)은 캐릭터 본이 아니다. 같은 이름은 처음 것. */
  function collectCharBones(charRoot: Obj, into: Record<string, Obj> = {}): Record<string, Obj> {
    for (const k in into) delete into[k];
    if (charRoot) charRoot.traverse((o: Obj) => { if (o.isBone && !(o.userData && o.userData._partAdopted) && !into[o.name]) into[o.name] = o; });
    return into;
  }

  /** 캐릭터가 스킨드 메쉬를 쓰는가(파츠 것은 빼고) — 본이 아직 안 보이면 잠시 기다려야 할 캐릭터 */
  function hasSkinnedChar(charRoot: Obj): boolean {
    let has = false;
    if (charRoot) charRoot.traverse((o: Obj) => { if (o.isSkinnedMesh && !String(o.name || '').startsWith('__part')) has = true; });
    return has;
  }

  function skinnedMeshesOf(obj: Obj): Obj[] {
    const out: Obj[] = [];
    obj.traverse((o: Obj) => { if (o.isSkinnedMesh) out.push(o); });
    return out;
  }

  /** 리깅 파츠 판정 — 스킨드 메쉬의 조인트 과반수가 캐릭터 본과 이름이 같다.
      본이 전부 일치하면 개수와 무관하게 리깅(head 하나짜리 모자) — 같은 리그 계열일 때만. */
  function isRiggedPart(skinnedMeshes: Obj[], charBones: Record<string, Obj>, o: RigOptions): boolean {
    return !o.standalone && skinnedMeshes.length > 0 && skinnedMeshes.some((sm) => {
      if (!sm.skeleton) return false;
      const total = sm.skeleton.bones.length;
      const matched = sm.skeleton.bones.filter((b: Obj) => !!charBones[b.name]).length;
      if (total === 0) return false;
      if (matched === total && o.rigFamilyMatches) return true;
      return matched >= Math.max(2, Math.ceil(total / 2));
    });
  }

  /** 리깅 파츠를 캐릭터 본에 다시 묶는다. 캐릭터에 없는 본은 이름이 맞는 가장 가까운 조상 본(없으면 spine · 첫 본) 밑으로 입양.
      boneInverses 는 파츠 값 그대로 — 바인드 공간 스킨 중심(xf 피봇)과 입양한 본을 돌려준다. */
  function rebindRigged(skinnedMeshes: Obj[], charBones: Record<string, Obj>) {
    const bindCenter = new THREE.Vector3();
    let bcCount = 0;
    const adoptedBones: Obj[] = [];
    skinnedMeshes.forEach((sm) => {
      sm.userData._origBind = sm.bindMatrix.clone(); // xf 를 bindMatrix 에 굽기 위해 원본 바인드 보존
      if (sm.geometry) {
        sm.geometry.computeBoundingBox();
        const c0 = sm.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(sm.userData._origBind);
        bindCenter.add(c0);
        bcCount++;
      }
      const src = sm.skeleton;
      const mapped = src.bones.map((b: Obj) => {
        if (charBones[b.name]) return charBones[b.name];
        let host: Obj = null, p = b.parent;
        while (p) { if (p.isBone && charBones[p.name]) { host = charBones[p.name]; break; } p = p.parent; }
        (host || charBones['spine'] || Object.values(charBones)[0])?.add(b);
        b.userData._partAdopted = true;
        adoptedBones.push(b);
        return b;
      });
      sm.bind(new THREE.Skeleton(mapped, src.boneInverses.map((m4: Obj) => m4.clone())), sm.bindMatrix);
      sm.frustumCulled = false;
    });
    if (bcCount) bindCenter.multiplyScalar(1 / bcCount);
    return { bindCenter, adoptedBones };
  }

  /** 메쉬 중심을 피봇으로 감싼다(회전 · 크기가 중심 기준). 리깅 파츠는 본이 자리를 정하므로 옮기지 않는다. */
  function wrapPart(obj: Obj, cat: string, isRigged: boolean) {
    const bb = new THREE.Box3().setFromObject(obj);
    const center = isRigged ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3());
    if (!isRigged) obj.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.name = '__partWrap_' + cat;
    wrapper.add(obj);
    wrapper.userData.baseCenter = center.clone();
    return { wrapper, bb, center };
  }

  /** 캐릭터 고유 스킨드 메쉬의 본별 boneInverse(바인드 자세 — 애니메이션과 무관). 파츠 것은 뺀다. */
  function charBoneBindInverses(modelRoot: Obj): Record<string, Obj> {
    const out: Record<string, Obj> = {};
    if (!modelRoot) return out;
    modelRoot.traverse((o: Obj) => {
      if (!o.isSkinnedMesh || !o.skeleton) return;
      if (String(o.name || '').indexOf('__part') === 0) return;
      if (o.userData && o.userData._origBind) return; // 리깅 파츠의 스킨드메시
      let p = o, isPart = false;
      while (p && p !== modelRoot) {
        if (typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0) { isPart = true; break; }
        p = p.parent;
      }
      if (isPart) return;
      const sk = o.skeleton;
      (sk.bones || []).forEach((b: Obj, i: number) => {
        if (!b || !b.name || out[b.name]) return;
        const inv = sk.boneInverses && sk.boneInverses[i];
        if (inv) out[b.name] = inv;
      });
    });
    return out;
  }

  /** 예전에 유저가 «떠 있는 걸 눌러 맞춰 둔» xf.pos 인가 — 저작 오프셋 방향으로 절반 넘게 되밀어 둔 값 */
  function isLegacyAuthorCompensation(pos: unknown[] | null | undefined, ao: Obj): boolean {
    if (!ao || !pos) return false;
    const L2 = ao.lengthSq();
    if (!(L2 > 1e-6)) return false;
    const dot = (+(pos[0] as number) || 0) * ao.x + (+(pos[1] as number) || 0) * ao.y + (+(pos[2] as number) || 0) * ao.z;
    return -dot / L2 >= 0.5;
  }

  /** 저작 오프셋 — «캐릭터에 씌운 채 저작된 파츠»가 본에 붙으면 그만큼 떠오른다. 그 상쇄량(없으면 null).
      판정: 본이 퍼진 범위가 파츠보다 크고 · 파츠가 원점에서 멀고 · 가장 가까운 본이 원점보다 훨씬 가깝다. 바인드 자세로 잰다. */
  function computeAuthorOffset(bb: Obj, center: Obj, bone: Obj, modelRoot: Obj, cat: string, charBones: Record<string, Obj>, defaultOffsets: DefaultOffsets): Obj {
    try {
      if (!bb || bb.isEmpty() || !center || !bone || !modelRoot) return null;
      const size = bb.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (!(maxDim > 1e-6)) return null;
      modelRoot.updateMatrixWorld(true);
      const bp = new THREE.Vector3();
      const binds = charBoneBindInverses(modelRoot);
      const m4 = new THREE.Matrix4();
      const bonePos = (nm: string, cb: Obj) => {
        const inv = binds[nm];
        if (inv) return bp.setFromMatrixPosition(m4.copy(inv).invert());
        cb.getWorldPosition(bp); modelRoot.worldToLocal(bp); return bp; // 스키닝 없는 캐릭터
      };
      let dNear = Infinity, nearName = '', boneSpread = 0;
      for (const nm in charBones || {}) {
        const cb = charBones[nm];
        if (!cb) continue;
        bonePos(nm, cb);
        const bl = bp.length();
        if (bl > boneSpread) boneSpread = bl;
        const dd = center.distanceTo(bp);
        if (dd < dNear) { dNear = dd; nearName = nm; }
      }
      if (!isFinite(dNear)) return null;
      const dOrigin = center.length();
      const ok = boneSpread > maxDim * 0.5 && dOrigin > maxDim * 0.5 && dNear < dOrigin * 0.5;
      if (!ok) {
        if (dOrigin > maxDim * 0.5) log('[파츠 저작오프셋] ' + cat + ' — 보정 안 함(원점 기준 저작으로 판정). '
          + '최근접본 ' + (nearName || '?') + '까지 ' + dNear.toFixed(3) + ' / 원점거리 ' + dOrigin.toFixed(3)
          + ' (임계 ' + (dOrigin * 0.5).toFixed(3) + ') / 본 퍼짐 ' + boneSpread.toFixed(3) + ' / 파츠크기 ' + maxDim.toFixed(3));
        return null;
      }
      const boneLocal = bone.getWorldPosition(new THREE.Vector3());
      modelRoot.worldToLocal(boneLocal);
      // 바인드 자세로 환산 — 지금 자세로 재면 숨쉬기 · 고개짓 기울기가 오프셋에 굳어 실행 화면에서만 어긋난다
      const bindInv = binds[bone.name];
      let want;
      if (bindInv) want = center.clone().applyMatrix4(bindInv);
      else { want = modelRoot.localToWorld(center.clone()); bone.worldToLocal(want); }
      const off = center.clone().sub(want);
      if (!isFinite(off.x) || !isFinite(off.y) || !isFinite(off.z)) return null;
      // 카테고리 상수가 이미 같은 양을 눌러 맞춰 뒀으면 또 상쇄하면 이중 보정 — 손대지 않는다
      const dOff = defaultOffsets[cat];
      if (dOff && isLegacyAuthorCompensation([dOff.x, dOff.y, dOff.z], off)) {
        log('[파츠 저작오프셋] ' + cat + ' — PART_DEFAULT_OFFSET(' + dOff.x + ', ' + dOff.y + ', ' + dOff.z + ')이 이미 '
          + '같은 양을 눌러 맞춰둔 카테고리라 보정 생략(이중 보정 방지). 계산된 상쇄량은 '
          + '(' + off.x.toFixed(3) + ', ' + off.y.toFixed(3) + ', ' + off.z.toFixed(3) + ')');
        return null;
      }
      log('[파츠 저작오프셋] ' + cat + ' — 캐릭터에 씌운 채 저작된 파츠로 판정, 상쇄 적용 '
        + '(' + off.x.toFixed(3) + ', ' + off.y.toFixed(3) + ', ' + off.z.toFixed(3) + ') | '
        + '파츠중심 (' + center.x.toFixed(3) + ', ' + center.y.toFixed(3) + ', ' + center.z.toFixed(3) + ') / '
        + '부착본 ' + (bone.name || '?') + ' (' + boneLocal.x.toFixed(3) + ', ' + boneLocal.y.toFixed(3) + ', ' + boneLocal.z.toFixed(3) + ') / '
        + '최근접본 ' + (nearName || '?') + '까지 ' + dNear.toFixed(3) + ' < 원점거리 ' + dOrigin.toFixed(3) + '×0.5 '
        + '/ 파츠크기 ' + maxDim.toFixed(3));
      return off;
    } catch (e) {
      warn('[파츠 저작오프셋] 계산 실패 — 보정 생략', e);
      return null;
    }
  }

  /** 리깅 파츠 wrapper 를 캐릭터 루트에 단 뒤 — 기즈모가 옷 위에 붙게 스킨 메쉬의 실제(자세 반영) 중심을 부모 로컬로 */
  function riggedBaseCenter(wrapper: Obj, skinnedMeshes: Obj[], charRoot: Obj): Obj {
    wrapper.updateMatrixWorld(true);
    const skinBB = new THREE.Box3();
    skinnedMeshes.forEach((sm) => {
      sm.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(sm);
      if (bb.isEmpty()) return;
      if (skinBB.isEmpty()) skinBB.copy(bb);
      else skinBB.union(bb);
    });
    if (skinBB.isEmpty()) return null;
    const local = skinBB.getCenter(new THREE.Vector3()).clone();
    charRoot.worldToLocal(local);
    return local;
  }

  /** 다중 파츠의 추가 인스턴스 하나 — 같은 GLB 복제 · 재질 · 자기만의 _col 묶음 · 가운데 맞춘 wrapper(그림칸은 없다) */
  function prepareExtra(scene: Obj, cat: string, i: number) {
    const obj = cloneScene(scene);
    const colorGroups: Record<string, Obj[]> = {};
    obj.traverse((o: Obj) => {
      if (!o.isMesh) return;
      const m = prepMaterial(o);
      addColorGroup(colorGroups, o, m, false);
    });
    obj.name = '__part_' + cat + '_i' + i;
    const bb = new THREE.Box3().setFromObject(obj);
    const center = bb.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.name = '__partWrap_' + cat + '_i' + i;
    wrapper.add(obj);
    wrapper.userData.baseCenter = center.clone();
    return { wrapper, obj, colorGroups };
  }

  return {
    prepareScene,
    collectCharBones,
    hasSkinnedChar,
    skinnedMeshesOf,
    isRiggedPart,
    rebindRigged,
    wrapPart,
    charBoneBindInverses,
    isLegacyAuthorCompensation,
    computeAuthorOffset,
    riggedBaseCenter,
    prepareExtra,
  };
}

export type Parts = ReturnType<typeof createParts>;
