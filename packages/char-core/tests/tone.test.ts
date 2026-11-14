import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTone, HUE_GLSL } from '../src/index';

const fixed: unknown[] = [];
const tone = createTone({ THREE, flatEmissive: 0.4, fixMatLighting: (m) => fixed.push(m) });
const std = (o: Record<string, unknown> = {}) => new THREE.MeshStandardMaterial(o);

describe('재질 톤', () => {
  it('파츠 톤 — 고치기 → emissive = 색 × 평탄 배율 · 텍스처면 emissiveMap · baseFlat 기억', () => {
    const m = std({ color: '#808080' });
    tone.applyPartMatTone(m);
    expect(fixed).toContain(m);
    expect(m.emissive.r).toBeCloseTo(m.color.r * 0.4);
    expect(m.userData.baseFlat).toBe(0.4);
    const t = std({ map: new THREE.Texture() });
    tone.applyPartMatTone(t);
    expect(t.emissiveMap).toBe(t.map);
    tone.applyPartMatTone(null);
  });
  it('baseFlatOf — 심은 값(0 도) · 없으면 공용', () => {
    expect(tone.baseFlatOf({ userData: { baseFlat: 0 } })).toBe(0);
    expect(tone.baseFlatOf({})).toBe(0.4);
    expect(tone.baseFlatOf(null)).toBe(0.4);
  });
  it('얼굴 맵 — map · emissiveMap 같이 · 빈 값이면 그대로', () => {
    const m = std(); const t = new THREE.Texture();
    tone.setFaceMap(m, t);
    expect([m.map, m.emissiveMap]).toEqual([t, t]);
    tone.setFaceMap(m, null);
    expect(m.map).toBe(t);
  });
  it('몸 평탄 조명 — 얼굴은 배율 · 옷 · 모자 · 나머지 메쉬는 색 × 배율(텍스처 없어도)', () => {
    const face = std({ map: new THREE.Texture() }), up = std({ color: '#ff0000' }), lo = std({ color: '#00ff00', map: new THREE.Texture() }), shoe = std({ color: '#0000ff' });
    tone.applyLightPresetToInstance({ faceMat: face, upMat: up, loMat: lo, litMats: [face, up, lo, shoe] });
    expect(face.emissive.r).toBeCloseTo(0.4);
    expect(face.emissiveMap).toBe(face.map);
    expect([up.emissive.r, up.emissive.g]).toEqual([0.4, 0]);
    expect(lo.emissiveMap).toBe(lo.map);
    expect(shoe.emissive.b).toBeCloseTo(0.4);
    tone.applyLightPresetToInstance(null);
  });
});

describe('색조', () => {
  it('HSV 환산 · 표시용 hex', () => {
    expect(tone.rgbHexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(tone.rgbHexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(tone.hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(tone.hsvToHex(0, 2, null)).toBe('#ff0000');
  });
  it('텍스처 없는 메쉬는 색조 못 씀 · hsv 우선 · hex 만이면 v=1 · 둘 다 없으면 끈다', () => {
    expect(tone.applyHueTint({ material: std() }, '#ff0000')).toBe(false);
    const mesh = { material: std({ map: new THREE.Texture() }) };
    expect(tone.isHueTintMesh(mesh)).toBe(true);
    tone.applyHueTint(mesh, '#00ff00', { h: 0.5, s: null, v: null });
    const u = mesh.material.userData._hueU;
    expect([u.uHue.value, u.uSat.value, u.uVal.value, u.uOn.value, u.uRot.value]).toEqual([0.5, 0, 1, 1, 0]);
    tone.applyHueTint(mesh, '#00ff00', { h: 0.25, s: 0, v: 1, rot: 1 });
    expect(u.uRot.value).toBe(1);
    tone.applyHueTint(mesh, '#808080');
    expect(u.uRot.value).toBe(0);
    expect(u.uVal.value).toBe(1);
    tone.applyHueTint(mesh, null);
    expect(u.uOn.value).toBe(0);
    expect(tone.ensureHueUniforms(mesh.material)).toBe(u);
  });
  it('셰이더 주입 — 유니폼은 같은 객체 · map · emissive 자리에 바꾸기를 넣는다', () => {
    const u = { uHue: { value: 0 }, uSat: { value: 0 }, uVal: { value: 1 }, uOn: { value: 0 }, uRot: { value: 0 } };
    const sh = { uniforms: {} as Record<string, unknown>, fragmentShader: 'x\n#include <map_fragment>\ny\n#include <emissivemap_fragment>\n' };
    tone.hueOBC(u)(sh);
    expect(sh.uniforms.uHue).toBe(u.uHue);
    expect(sh.fragmentShader).toContain(HUE_GLSL);
    expect(sh.fragmentShader).toContain('diffuseColor.rgb = twHueShift');
    expect(sh.fragmentShader).toContain('totalEmissiveRadiance = twHueShift');
    expect(sh.uniforms.uRot).toBe(u.uRot);
    expect(sh.fragmentShader).toContain('uniform float uRot;');
  });
  it('색 하나 바꾸기 — 돌리기는 0 이 원본 · 덮기는 h 로 칠한다(옛 저장값)', () => {
    expect(tone.hueShiftHex('#e68c28', { h: 0, s: 0, v: 1, rot: 1 })).toBe('#e68c28');
    expect(tone.hueShiftHex('#ff0000', { h: 1 / 3, s: 0, v: 1, rot: 1 })).toBe('#00ff00');
    expect(tone.hueShiftHex('#00ff00', { h: 1 / 3, s: 0, v: 1, rot: 1 })).toBe('#0000ff');
    expect(tone.hueShiftHex('#0000ff', { h: 2 / 3, s: 0, v: 1, rot: 1 })).toBe('#00ff00');   // 한 바퀴 넘어감
    // 덮기 — 밝기만 내려도 색조가 h(0 = 빨강)로 바뀌는 옛 동작
    expect(tone.hueShiftHex('#00ff00', { h: 0, s: 0, v: 1 })).toBe('#ff0000');
    // 밝기 배율 · 채도 음수(-1 = 회색)
    expect(tone.hueShiftHex('#ff0000', { h: 0, s: 0, v: 0.5, rot: 1 })).toBe('#7f0000');
    expect(tone.hueShiftHex('#ff0000', { h: 0, s: -1, v: 1, rot: 1 })).toBe('#ffffff');
    // 회색에 양수 채도 → 색이 든다
    expect(tone.hueShiftHex('#808080', { h: 0, s: 1, v: 1, rot: 1 })).toBe('#800c0c');
  });
  it('색 묶음 메쉬 — 텍스처는 셰이더 · 단색은 돌리기면 제 원래 색을 돌린다', () => {
    const flat = { material: std({ color: '#ff0000' }), userData: { origColor: 'ff0000' } };
    tone.tintPartMesh(flat, '#123456', { h: 1 / 3, s: 0, v: 1, rot: 1 });
    expect(flat.material.color.getHexString()).toBe('00ff00');
    expect(flat.material.emissive.g).toBeCloseTo(0.4);
    tone.tintPartMesh(flat, '#123456', { h: 1 / 3, s: 0, v: 1 });
    expect(flat.material.color.getHexString()).toBe('123456');
    const tex = { material: std({ map: new THREE.Texture() }), userData: {} };
    tone.tintPartMesh(tex, '#00ff00', { h: 0.1, s: 0, v: 1, rot: 1 });
    expect(tex.material.userData._hueU.uRot.value).toBe(1);
    expect(tex.material.color.getHexString()).toBe('ffffff');
    tone.tintPartMesh({ material: null }, '#000000');
  });
  it('필요한 값이 없으면 만들 때 거절', () => {
    expect(() => createTone({ THREE } as never)).toThrow(/flatEmissive/);
    expect(() => createTone({ flatEmissive: 1 } as never)).toThrow(/THREE/);
  });
});
