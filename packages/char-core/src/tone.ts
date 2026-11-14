/* 💡 캐릭터 재질 톤 — 얼굴 텍스처 걸기 · 몸 재질 평탄 조명 · 파츠 재질 톤 · 텍스처 파츠 색조(Hue) 셰이더.
   평탄 조명 배율(flatEmissive)은 화면 밝기 예산에서 남는 몫이라 조명을 가진 쪽(앱 · 웹 미리보기)이 계산해 넘긴다.
   책상 · 아이템 재질 톤은 앱 몫이다. */

type Three = any;
type Obj = any;

export interface ToneDeps {
  THREE: Three;
  /** 평탄 조명 emissive 배율 — 캐릭터 · 파츠가 같은 값을 받는다 */
  flatEmissive: number;
  /** GLB 재질 조명 고치기(금속성 1 재질 눕히기 등) */
  fixMatLighting(m: Obj): void;
}

export interface HueUniforms {
  uHue: { value: number };
  uSat: { value: number };
  uVal: { value: number };
  uOn: { value: number };
}
export interface Hsv { h?: number; s?: number | null; v?: number | null }

/* 텍스처 파츠는 색을 덮어쓰면 «텍스처 × 색» 이라 무늬가 탁해진다 — 셰이더에서 색조만 돌리고 명암 · 무늬는 그대로 둔다.
   emissiveMap 도 같은 텍스처라 emissive 쪽에도 같은 변환을 넣어야 색이 어긋나지 않는다. */
export const HUE_GLSL = `
vec3 twRgb2Hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 twHsv2Rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 twHueShift(vec3 rgb, float hue, float sat, float val){
  vec3 hsv = twRgb2Hsv(rgb);
  hsv.x = hue;
  /* 채도는 0 이 중립. 양수는 진한 쪽을 따라가고(흑백 텍스처에 색), 음수는 원본에 (1+sat) 을 곱해 내린다(-1 = 회색).
     ⚠️ 음수 쪽을 max() 로 하면 절대 안 내려간다. */
  hsv.y = (sat >= 0.0) ? max(hsv.y, sat * 0.9) : hsv.y * (1.0 + sat);
  hsv.y = clamp(hsv.y, 0.0, 1.0);
  /* 밝기는 덮어쓰기가 아니라 배율 — 픽셀마다 다른 명암에 곱해야 무늬가 산다. val=1.0 이 중립. */
  hsv.z = clamp(hsv.z * val, 0.0, 1.0);
  return twHsv2Rgb(hsv);
}
`;

export function createTone(deps: ToneDeps) {
  const { THREE } = deps;
  if (!THREE) throw new Error('char-core: deps.THREE 가 필요하다');
  if (typeof deps.flatEmissive !== 'number' || !isFinite(deps.flatEmissive)) throw new Error('char-core: deps.flatEmissive 가 필요하다');
  const FLAT = deps.flatEmissive;
  // 텍스처 있는 파츠 메쉬의 평탄 몫 — FLAT 을 따라간다(따로 두면 파츠만 하얗게 뜬다)
  const PART_TEX_FLAT = FLAT;

  /** 얼굴 맵을 갈 때 emissiveMap 도 같이 — 안 그러면 이전 텍스처가 emissive 로 남아 깜빡임이 흐려진다 */
  function setFaceMap(mat: Obj, tex: Obj): void {
    if (!mat || !tex) return;
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.needsUpdate = true;
  }

  /** 몸 한 벌의 재질에 생성기와 같은 평탄 조명 — 이름으로 안 갈리는 나머지 메쉬도 텍스처 유무와 무관하게 */
  function applyLightPresetToInstance(inst: Obj): void {
    if (!inst) return;
    const flat = FLAT;
    if (inst.faceMat) { inst.faceMat.emissiveMap = inst.faceMat.map; inst.faceMat.emissive.setScalar(flat); inst.faceMat.needsUpdate = true; }
    for (const k of ['upMat', 'loMat', 'hatMat']) {
      const m = inst[k];
      if (!m) continue;
      if (m.map && m.emissiveMap !== m.map) { m.emissiveMap = m.map; m.needsUpdate = true; }
      m.emissive.copy(m.color).multiplyScalar(flat);
    }
    if (inst.litMats) {
      inst.litMats.forEach((m: Obj) => {
        if (m === inst.faceMat || m === inst.upMat || m === inst.loMat) return; // 위에서 처리함
        if (!m || !m.emissive) return;
        if (m.map && m.emissiveMap !== m.map) { m.emissiveMap = m.map; m.needsUpdate = true; }
        if (m.color) m.emissive.copy(m.color).multiplyScalar(flat);
        else m.emissive.setScalar(flat);
        m.needsUpdate = true;
      });
    }
  }

  /** 파츠 재질에 평탄 조명을 얹는 단 한 곳(장착 · 다중 파츠 · 썸네일). 배율을 baseFlat 으로 기억 — _col 색을 바꿀 때 같은 배율로. */
  function applyPartMatTone(m: Obj): void {
    if (!m) return;
    deps.fixMatLighting(m); // 금속성 1 재질은 emissive 를 맞춰도 톤이 안 맞는다
    if (m.map) m.emissiveMap = m.map;
    const flat = m.map ? PART_TEX_FLAT : FLAT;
    if (m.emissive) m.emissive.copy(m.color || new THREE.Color(0xffffff)).multiplyScalar(flat);
    m.userData = m.userData || {};
    m.userData.baseFlat = flat;
    m.needsUpdate = true;
  }

  /** 재질의 평탄 배율 — 심어 둔 baseFlat(0 도 심은 값), 없으면 공용 기준 */
  function baseFlatOf(mat: Obj): number {
    return mat && mat.userData && mat.userData.baseFlat != null ? mat.userData.baseFlat : FLAT;
  }

  function rgbHexToHsv(hex: unknown) {
    const c = new THREE.Color(hex);
    const hsl: { h: number; s: number; l: number } = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    const v = hsl.l + hsl.s * Math.min(hsl.l, 1 - hsl.l);
    const s = v === 0 ? 0 : 2 * (1 - hsl.l / v);
    return { h: hsl.h, s: Math.min(1, Math.max(0, s)), v };
  }
  /** 슬라이더 값 → 표시용 hex(저장의 진짜 값은 colorHSV) */
  function hsvToHex(h: number, sv: number, v?: number | null): string {
    const c = new THREE.Color();
    c.setHSL(h, Math.max(0, Math.min(1, sv)), Math.max(0, Math.min(1, 0.5 * (v == null ? 1 : v))));
    return '#' + c.getHexString();
  }
  /** 색조 모드로 쓸 수 있는가 = 텍스처가 있다 */
  function isHueTintMesh(mesh: Obj): boolean {
    return !!(mesh && mesh.material && mesh.material.map);
  }
  /** 색조 셰이더 주입 — u 를 클로저로 잡는다.
      ⚠️ r128 Material.copy 는 onBeforeCompile 을 복사하지 않는다 — 재질을 복제한 쪽은 이 함수로 다시 건다. */
  function hueOBC(u: HueUniforms) {
    return (shader: Obj) => {
      shader.uniforms.uHue = u.uHue; shader.uniforms.uSat = u.uSat; shader.uniforms.uVal = u.uVal; shader.uniforms.uOn = u.uOn;
      shader.fragmentShader = 'uniform float uHue;\nuniform float uSat;\nuniform float uVal;\nuniform float uOn;\n' + HUE_GLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n  if(uOn > 0.5){ diffuseColor.rgb = twHueShift(diffuseColor.rgb, uHue, uSat, uVal); }',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  if(uOn > 0.5){ totalEmissiveRadiance = twHueShift(totalEmissiveRadiance, uHue, uSat, uVal); }',
      );
    };
  }
  function ensureHueUniforms(mat: Obj): HueUniforms {
    if (mat.userData && mat.userData._hueU) return mat.userData._hueU;
    mat.userData = mat.userData || {};
    const u: HueUniforms = { uHue: { value: 0 }, uSat: { value: 0 }, uVal: { value: 1 }, uOn: { value: 0 } };
    mat.userData._hueU = u;
    mat.onBeforeCompile = hueOBC(u);
    mat.needsUpdate = true;
    return u;
  }
  /** hex 도 hsv 도 없으면 색조 해제. hsv 가 있으면 그쪽이 우선.
      ⚠️ hex 만 있는 옛 데이터는 v=1(중립) — hex 의 밝기를 배율로 쓰면 저장된 파츠가 일제히 어두워진다. */
  function applyHueTint(mesh: Obj, hex: unknown, hsvOpt?: Hsv | null): boolean {
    if (!mesh || !mesh.material || !mesh.material.map) return false;
    const u = ensureHueUniforms(mesh.material);
    if (!hex && !hsvOpt) { u.uOn.value = 0; return true; }
    if (hsvOpt) {
      u.uHue.value = hsvOpt.h || 0;
      u.uSat.value = hsvOpt.s == null ? 0 : hsvOpt.s;
      u.uVal.value = hsvOpt.v == null ? 1 : hsvOpt.v;
    } else {
      const hsv = rgbHexToHsv(hex);
      u.uHue.value = hsv.h; u.uSat.value = hsv.s; u.uVal.value = 1;
    }
    u.uOn.value = 1;
    return true;
  }

  return {
    FLAT_EMISSIVE: FLAT,
    setFaceMap,
    applyLightPresetToInstance,
    applyPartMatTone,
    baseFlatOf,
    rgbHexToHsv,
    hsvToHex,
    isHueTintMesh,
    hueOBC,
    ensureHueUniforms,
    applyHueTint,
  };
}

export type Tone = ReturnType<typeof createTone>;
