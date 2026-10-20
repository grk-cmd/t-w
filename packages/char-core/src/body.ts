/* 🧍 사람 몸 — 기본 몸 모델(GLB) 불러오기 · 캐릭터마다 복제 · 크기 맞추기 · 조립.
   코어는 장면(scene)을 모른다 — 캐릭터 그룹만 돌려준다. 몸 모델 바이트는 앱 · 웹이 자산 공급자로 넘긴다.
   재질 톤(조명 평탄화 · 얼굴 텍스처 걸기)과 귀 붙이기는 아직 앱 몫이라 주입받는다(색조 #437 · 귀 #435 에서 코어로). */

/* three 의 타입은 r128 타입을 들이기 전까지 느슨하게 둔다 — 읽는 몫은 아래 함수들이 쓰는 것뿐이다. */
type Three = any;
type Obj = any;

export interface GltfParser {
  parse(data: ArrayBuffer, path: string, onLoad: (gltf: { scene: Obj; animations?: Obj[] }) => void, onError: (e: unknown) => void): void;
}

export interface BodyDeps {
  THREE: Three;
  /** GLTFLoader 인스턴스(DRACO 붙인 것) */
  gltf: GltfParser;
  /** GLB 재질 조명 고치기(금속성 · aoMap 등) — 메쉬마다 복제한 재질에 한 번 */
  fixMatLighting(mat: Obj): void;
  /** 얼굴 재질에 얼굴 텍스처 걸기 */
  setFaceMap(mat: Obj, tex: Obj): void;
  /** 몸 한 벌에 화면 톤(emissive) 걸기 */
  applyLightPreset(inst: BaseInstance): void;
  warn?: (msg: string, e?: unknown) => void;
}

export interface BaseInstance {
  root: Obj;
  faceMat: Obj; upMat: Obj; loMat: Obj;
  faceMesh: Obj; upMesh: Obj; loMesh: Obj;
  glassesMesh: Obj; hatMesh: Obj; hatMat: Obj; maskMesh: Obj; onepieceMesh: Obj; wingMesh: Obj;
  handLMesh: Obj; handRMesh: Obj; capeMesh: Obj;
  litMats: Obj[];
}

export interface AssembleOptions {
  /** 커미션 몸처럼 따로 받은 장면 — 없으면 기본 몸 */
  customScene?: Obj;
  faceTex: Obj;
  blinkTex: Obj;
  top: unknown;
  bot: unknown;
  /** 상의 · 하의 · 기본 모자 색을 칠할지(완성형 몸은 칠하지 않는다) */
  recolor: boolean;
  /** 키 맞춘 뒤 더 곱할 배율 */
  scaleMul?: number;
  /** 기본 몸을 못 쓸 때 대신 세우는 몸의 피부색 */
  skinColor: unknown;
  /** 크기를 맞춘 뒤(감싸기 전) 몸 뿌리에 할 일 — 귀 붙이기 */
  onRoot?: (root: Obj) => void;
}

/** 캐릭터 기본 키 — 좌석 · 미리보기 · 기본 몸 재기가 같은 값을 쓴다 */
export const BASE_HEIGHT = 1.4;

export function createBody(deps: BodyDeps) {
  const { THREE } = deps;
  if (!THREE) throw new Error('char-core: deps.THREE 가 필요하다');
  if (!deps.gltf) throw new Error('char-core: deps.gltf 가 필요하다');
  const warn = deps.warn || ((m: string, e?: unknown) => console.warn(m, e));

  let baseScene: Obj = null;
  let baseAnims: Obj[] = [];
  let meshMinY: number | null = null;
  let meshHeight: number | null = null;

  /** 몸 모델 바이트를 읽어 기본 몸으로 둔다. 바이트가 없거나 못 읽으면 false(대신 세우는 몸을 쓴다). */
  function loadBase(buf: ArrayBuffer | null | undefined): Promise<boolean> {
    return new Promise((res) => {
      if (!buf) { res(false); return; }
      deps.gltf.parse(buf, '', (gltf) => {
        baseScene = gltf.scene;
        baseAnims = gltf.animations || [];
        baseScene.traverse((o: Obj) => { if (o.isMesh) o.frustumCulled = false; });
        measureBaseGeometry(); // 기본 시각 영역 — 커미션 몸을 기본과 같은 위치 · 키로 맞출 기준값
        res(true);
      }, (e) => { warn('base GLB parse fail', e); res(false); });
    });
  }

  /** 스킨드 메시 복제 — 캐릭터마다 독립 스켈레톤 · 재질. 메쉬 · 재질 이름으로 얼굴 · 옷 · 미리 씌운 파츠를 찾는다. */
  function instantiateBase(customScene?: Obj): BaseInstance | null {
    const src = customScene || baseScene;
    if (!src || !THREE.SkeletonUtils) return null;
    const root = THREE.SkeletonUtils.clone(src);
    let faceMat: Obj = null, upMat: Obj = null, loMat: Obj = null, faceMesh: Obj = null, upMesh: Obj = null, loMesh: Obj = null;
    // 커미션 몸에 미리 씌워진 파츠 — 꾸미기에서 같은 칸 파츠를 끼우면 숨기고 빼면 다시 보인다(앱 applyClothVisibility).
    let glassesMesh: Obj = null, hatMesh: Obj = null, hatMat: Obj = null, maskMesh: Obj = null, onepieceMesh: Obj = null, wingMesh: Obj = null, handLMesh: Obj = null, handRMesh: Obj = null, capeMesh: Obj = null;
    // ⚠️ 조명 평탄화는 이름으로 나뉜 파츠만이 아니라 모든 메쉬에 — 안 걸린 이름의 메쉬만 톤이 달라 보인다.
    const litMats: Obj[] = [];
    // 짧고 흔한 낱말(hat · cap · wing · left)은 부분 문자열이면 오탐(«landscape» 의 cap)이라 낱말 경계로 본다.
    const has = (str: string, word: string) => new RegExp('(?:^|[^a-z])' + word + '(?:$|[^a-z])', 'i').test(str);
    root.traverse((o: Obj) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
      const cm = o.material && o.material.clone ? o.material.clone() : o.material;
      o.material = cm;
      const nm = ((cm && cm.name) || '').toLowerCase();
      const meshName = (o.name || '').toLowerCase();
      if (cm) { litMats.push(cm); deps.fixMatLighting(cm); }
      const hasBoth = (word: string) => has(nm, word) || has(meshName, word);
      // 재질 이름이 없어도 메쉬 이름이 head 면 얼굴(생성기 피부 칸)로 잡는다
      if (nm.includes('face') || meshName.includes('head')) { faceMat = cm; faceMesh = o; }
      else if (!upMesh && (nm.includes('upper') || nm.includes('up_cloth') || nm.includes('up_clothes'))) { upMat = cm; upMesh = o; }
      else if (!loMesh && (nm.includes('lower') || nm.includes('low_cloth') || nm.includes('low_clothes'))) { loMat = cm; loMesh = o; }
      else if (!glassesMesh && (nm.includes('glass') || meshName.includes('glass'))) { glassesMesh = o; }
      else if (!capeMesh && hasBoth('cape')) { capeMesh = o; } // 첫 매치만 — 뒤에 만난 것으로 덮어쓰지 않게
      else if (!hatMesh && (hasBoth('hat') || hasBoth('cap'))) { hatMesh = o; hatMat = cm; }
      else if (!maskMesh && hasBoth('mask')) { maskMesh = o; }
      else if (!onepieceMesh && (nm.includes('dress') || meshName.includes('dress'))) { onepieceMesh = o; }
      else if (!wingMesh && hasBoth('wing')) { wingMesh = o; }
      else if (!handLMesh && hasBoth('left')) { handLMesh = o; }
      else if (!handRMesh && hasBoth('right')) { handRMesh = o; }
    });
    return { root, faceMat, upMat, loMat, faceMesh, upMesh, loMesh, glassesMesh, hatMesh, hatMat, maskMesh, onepieceMesh, wingMesh, handLMesh, handRMesh, capeMesh, litMats };
  }

  /** 자기 상자 기준으로 키를 targetH 에 맞추고 발을 바닥 · 가운데로. 걸은 배율을 돌려준다. */
  function normalizeModel(group: Obj, targetH: number, scaleMul = 1): number {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    let s = targetH / (size.y || 1);
    s *= scaleMul;
    group.scale.setScalar(s);
    group.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    return s;
  }

  /** 메쉬 geometry 상자만 합친 «진짜 메쉬 영역»(본 영향 0) — 커미션 몸 정렬용 */
  function calcMeshBox(group: Obj): Obj {
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    group.updateMatrixWorld(true);
    group.traverse((o: Obj) => {
      if (o.isMesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (o.geometry.boundingBox) {
          tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          box.union(tmp);
        }
      }
    });
    return box;
  }

  function measureBaseGeometry(): void {
    const inst = instantiateBase();
    if (!inst || !inst.root) return;
    normalizeModel(inst.root, BASE_HEIGHT); // 조립의 일반 길과 같은 정규화
    inst.root.updateMatrixWorld(true);
    const box = calcMeshBox(inst.root);
    if (!box.isEmpty()) {
      meshMinY = box.min.y;
      meshHeight = box.max.y - box.min.y;
    }
  }

  /** 머리 앞면을 감싸는 곡면 패치(평면 UV — 그린 캔버스가 얼굴에 그대로 박혀 보인다) */
  function buildFacePatchGeo(R: number, half: number, seg: number): Obj {
    const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sqrt(Math.max(0.0001, R * R - x * x - y * y)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  /** 기본 몸 모델이 없을 때 세우는 대신 몸(공 몇 개 + 얼굴 패치) */
  function buildCreatorBase(fTex: Obj, bTex: Obj, skinColor: unknown, top: unknown, bot: unknown) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });
    const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.85 });
    const botMat = new THREE.MeshStandardMaterial({ color: bot, roughness: 0.85 });
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 28), botMat); lower.scale.set(1, 0.7, 0.9); lower.position.y = 0.4; lower.castShadow = true; g.add(lower);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 28), topMat); upper.scale.set(1, 0.92, 0.92); upper.position.y = 0.72; upper.castShadow = true; g.add(upper);
    [-0.42, 0.42].forEach((x) => {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), topMat); a.scale.set(0.7, 0.7, 1.1); a.position.set(x, 0.64, 0.2); a.castShadow = true; g.add(a);
    });
    const head = new THREE.Group(); head.position.y = 1.18; g.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), skin); hm.castShadow = true; head.add(hm);
    const faceMat = new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }); faceMat.name = 'Face';
    const face = new THREE.Mesh(buildFacePatchGeo(0.421, 0.27, 22), faceMat); head.add(face);
    return { group: g, faceMat, topMat, botMat, skinMat: skin, face, fT: fTex, bT: bTex };
  }

  /** 사람 몸 한 벌 — 기본(또는 받은) 몸을 복제해 얼굴 · 색 · 톤 · 크기를 맞추고 그룹으로 감싼다. 몸 모델이 없으면 대신 몸. */
  function assemble(o: AssembleOptions) {
    const fT = o.faceTex, bT = o.blinkTex;
    const inst = instantiateBase(o.customScene);
    if (inst) {
      deps.setFaceMap(inst.faceMat, fT);
      if (o.recolor) {
        if (inst.upMat) inst.upMat.color.set(o.top);
        if (inst.loMat) inst.loMat.color.set(o.bot);
        if (inst.hatMat && inst.hatMat.color) inst.hatMat.color.set(o.top); // 기본 모자는 상의색을 따라간다
      }
      deps.applyLightPreset(inst);
      normalizeModel(inst.root, BASE_HEIGHT, o.scaleMul);
      if (o.onRoot) o.onRoot(inst.root);
      const wrap = new THREE.Group();
      wrap.add(inst.root);
      // 꾸미기 파츠를 끼울 때 미리 씌운 메쉬를 숨기려면 이 참조들이 같이 나가야 한다
      return {
        group: wrap, root: inst.root, faceMat: inst.faceMat, upMat: inst.upMat, loMat: inst.loMat, fT, bT,
        faceMesh: inst.faceMesh, upMesh: inst.upMesh, loMesh: inst.loMesh, glassesMesh: inst.glassesMesh,
        hatMesh: inst.hatMesh, hatMat: inst.hatMat, maskMesh: inst.maskMesh, onepieceMesh: inst.onepieceMesh, wingMesh: inst.wingMesh,
        handLMesh: inst.handLMesh, handRMesh: inst.handRMesh, capeMesh: inst.capeMesh,
      };
    }
    const b = buildCreatorBase(fT, bT, o.skinColor, o.top, o.bot);
    return { group: b.group, root: b.group, faceMat: b.faceMat, fT, bT };
  }

  return {
    loadBase,
    instantiateBase,
    normalizeModel,
    calcMeshBox,
    measureBaseGeometry,
    buildFacePatchGeo,
    buildCreatorBase,
    assemble,
    baseScene: () => baseScene,
    baseAnims: () => baseAnims,
    baseMeshMinY: () => meshMinY,
    baseMeshHeight: () => meshHeight,
  };
}

export type Body = ReturnType<typeof createBody>;
