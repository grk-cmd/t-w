import { readFileSync } from 'node:fs';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBody, createParts, createTone } from '../src/index';

/* 진짜 three r128 + 앱의 기본 몸 GLB. 앱은 classic script 라 SkeletonUtils 가 THREE 에 붙어 있다 — 같은 모양. */
const THREE = { ...THREE_NS, SkeletonUtils };
const baseGlb = (): ArrayBuffer => {
  const src = readFileSync(new URL('../../../apps/desktop/app/parts/base-glb.js', import.meta.url), 'utf8');
  const b = Buffer.from(/BASE_GLB_B64="([^"]+)"/.exec(src)![1]!, 'base64');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const calls: string[] = [];
const tone = createTone({ THREE, flatEmissive: 0.3, fixMatLighting() {} });
const parts = createParts({
  THREE,
  tone,
  applyPartMatTone: (m) => { calls.push('tone:' + m.name); m.metalness = 0.1; },
  forceOpaqueAlphaOutput: (m) => calls.push('opaque:' + m.name),
  meshIsPic: (o) => /_pic/i.test(o.name),
  picRepairUV: (o) => o.name.includes('fixme'),
  uvLooksBroken: (o) => o.name.includes('broken'),
  log: (m) => calls.push('log:' + m),
  warn: () => {},
});
const body = createBody({ THREE, gltf: new GLTFLoader(), fixMatLighting() {}, setFaceMap() {}, applyLightPreset() {} });
const mesh = (name: string, matName = '', opts: Record<string, unknown> = {}) =>
  Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: matName, ...opts })), { name });

beforeAll(async () => { expect(await body.loadBase(baseGlb())).toBe(true); });

describe('prepareScene', () => {
  it('복제 · 재질 복제 · 톤 · 투명 차례 · _col 묶음(이름 · 재질 · 번호) · _pic 은 색에서 뺀다', () => {
    calls.length = 0;
    const g = new THREE.Group();
    const a = mesh('brim_col', 'm1'), b = mesh('band', 'paint_col2'), c = mesh('lens', 'glass', { transparent: true }), p = mesh('face_pic_col', 'pp');
    const fix = mesh('x_pic_fixme', 'pf'), broken = mesh('broken', 'bm', { map: new THREE.Texture() });
    g.add(a, b, c, p, fix, broken);
    const repaired: string[] = [], warned: string[] = [];
    const r = parts.prepareScene(g, 'hat', { onPicUvRepaired: (o) => repaired.push(o.name), onUvBroken: (o) => warned.push(o.name) });
    expect(r.obj).not.toBe(g);
    expect(r.obj.name).toBe('__part_hat');
    const byName = (n: string) => r.obj.getObjectByName(n);
    expect(byName('brim_col').material).not.toBe(a.material);
    expect(Object.keys(r.colorGroups).sort()).toEqual(['col1', 'col2']);
    expect(r.colorGroups.col1!.map((o: { name: string }) => o.name)).toEqual(['brim_col']);
    expect(r.colorGroups.col2!.map((o: { name: string }) => o.name)).toEqual(['band']);
    expect(byName('brim_col').userData.origColor).toBe('ffffff');
    expect(r.picMeshes.map((o: { name: string }) => o.name)).toEqual(['face_pic_col', 'x_pic_fixme']);
    expect(byName('lens').renderOrder).toBe(10);
    expect(calls).toContain('opaque:glass');
    expect(calls.filter((x) => x.startsWith('tone:'))).toHaveLength(6);
    expect(repaired).toEqual(['x_pic_fixme']);
    expect(warned).toEqual(['broken']);
    expect(a.material.metalness).not.toBe(0.1); // 원본 재질은 그대로
  });
  it('이 파츠의 본에 _partAdopted 를 찍는다', () => {
    const g = new THREE.Group(); const bone = new THREE.Bone(); bone.name = 'ear_L'; g.add(bone);
    const r = parts.prepareScene(g, 'hat');
    expect(r.obj.getObjectByName('ear_L').userData._partAdopted).toBe(true);
    expect(bone.userData._partAdopted).toBeUndefined();
  });
});

describe('캐릭터 본 · 리깅 판정 · 다시 묶기', () => {
  it('collectCharBones — 입양된 본은 빼고 · 같은 이름은 처음 것', () => {
    const root = new THREE.Group();
    const b1 = new THREE.Bone(); b1.name = 'head'; const b2 = new THREE.Bone(); b2.name = 'head'; const b3 = new THREE.Bone(); b3.name = 'ear'; b3.userData._partAdopted = true;
    root.add(b1, b2, b3);
    const got = parts.collectCharBones(root, { stale: b3 } as Record<string, unknown>);
    expect(Object.keys(got)).toEqual(['head']);
    expect(got.head).toBe(b1);
  });
  it('isRiggedPart — 과반수 · 전부 일치는 같은 계열일 때만 · 단독 부착은 아님', () => {
    const sk = (names: string[]) => ({ skeleton: { bones: names.map((name) => ({ name })) } });
    const char = { head: 1, spine: 1, neck: 1 } as Record<string, unknown>;
    const o = { standalone: false, rigFamilyMatches: true };
    expect(parts.isRiggedPart([sk(['head'])], char, o)).toBe(true);
    expect(parts.isRiggedPart([sk(['head'])], char, { ...o, rigFamilyMatches: false })).toBe(false);
    expect(parts.isRiggedPart([sk(['head', 'spine', 'x'])], char, o)).toBe(true);
    expect(parts.isRiggedPart([sk(['head', 'x', 'y', 'z'])], char, o)).toBe(false);
    expect(parts.isRiggedPart([sk(['head', 'spine'])], char, { ...o, standalone: true })).toBe(false);
    expect(parts.isRiggedPart([], char, o)).toBe(false);
    expect(parts.isRiggedPart([{ skeleton: null }, sk([])], char, o)).toBe(false);
  });
  it('rebindRigged — 진짜 몸의 상의를 캐릭터 본에 묶고 · 없는 본은 조상 밑으로 입양', () => {
    const inst = body.instantiateBase()!;
    const charBones = parts.collectCharBones(inst.root);
    const partScene = SkeletonUtils.clone(body.baseScene());
    const sms = parts.skinnedMeshesOf(partScene);
    expect(parts.isRiggedPart(sms, charBones, { standalone: false, rigFamilyMatches: true })).toBe(true);
    // 캐릭터에 없는 본 하나를 끼운다 — head 밑에 extra 본
    const head = partScene.getObjectByName('head')!;
    const extra = new THREE.Bone(); extra.name = 'ribbon'; head.add(extra);
    const sm = sms[0];
    sm.skeleton = new THREE.Skeleton([...sm.skeleton.bones, extra], [...sm.skeleton.boneInverses, new THREE.Matrix4()]);
    const r = parts.rebindRigged(sms, charBones);
    expect(sm.skeleton.bones.slice(0, -1).every((b: { name: string }) => b === charBones[b.name])).toBe(true);
    expect(r.adoptedBones.map((b: { name: string }) => b.name)).toEqual(['ribbon']);
    expect(extra.parent).toBe(charBones.head);
    expect(extra.userData._partAdopted).toBe(true);
    expect(sm.userData._origBind).toBeTruthy();
    expect(r.bindCenter.y).toBeGreaterThan(0);
  });
});

describe('wrapper · 저작 오프셋', () => {
  it('wrapPart — 비리깅은 메쉬 중심을 피봇으로 · 리깅은 그대로', () => {
    const g = new THREE.Group(); const m = mesh('a'); m.position.set(2, 3, 4); g.add(m);
    const { wrapper, center } = parts.wrapPart(g, 'hat', false);
    expect(wrapper.name).toBe('__partWrap_hat');
    expect([center.x, center.y, center.z]).toEqual([2, 3, 4]);
    expect([g.position.x, g.position.y, g.position.z]).toEqual([-2, -3, -4]);
    expect(wrapper.userData.baseCenter.equals(center)).toBe(true);
    expect(wrapper.userData.baseCenter).not.toBe(center);
    const g2 = new THREE.Group(); g2.add(mesh('b'));
    expect(parts.wrapPart(g2, 'top', true).center.length()).toBe(0);
  });
  it('isLegacyAuthorCompensation — 오프셋 반대로 절반 넘게 되밀어 둔 값만', () => {
    const ao = new THREE.Vector3(0, 2, 0);
    expect(parts.isLegacyAuthorCompensation([0, -1, 0], ao)).toBe(true);
    expect(parts.isLegacyAuthorCompensation([0, -0.99, 0], ao)).toBe(false);
    expect(parts.isLegacyAuthorCompensation([0, 1, 0], ao)).toBe(false);
    expect(parts.isLegacyAuthorCompensation([0, -1, 0], new THREE.Vector3())).toBe(false);
    expect(parts.isLegacyAuthorCompensation(null, ao)).toBe(false);
  });
  it('computeAuthorOffset — 머리에 씌운 채 저작된 모자는 상쇄 · 원점 저작은 null · 카테고리 상수가 이미 맞췄으면 null', () => {
    const inst = body.instantiateBase()!;
    const root = inst.root;
    const charBones = parts.collectCharBones(root);
    const head = charBones.head;
    const binv = parts.charBoneBindInverses(root);
    const headBind = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(binv.head).invert());
    const at = (p: { x: number; y: number; z: number }, s = 0.3) => { const g = new THREE.Group(); const m = mesh('m'); m.scale.setScalar(s); m.position.set(p.x, p.y, p.z); g.add(m); return g; };
    const onHead = at({ x: headBind.x, y: headBind.y + 0.1, z: headBind.z });
    const w1 = parts.wrapPart(onHead, 'hat', false);
    const off = parts.computeAuthorOffset(w1.bb, w1.center, head, root, 'hat', charBones, {});
    expect(off).not.toBe(null);
    // 상쇄량 = 파츠 중심 − (그 중심을 head 본 바인드 로컬로 옮긴 자리) — 본에 붙였을 때 저작 자리로 돌아온다
    expect(w1.center.clone().sub(off).distanceTo(w1.center.clone().applyMatrix4(binv.head))).toBeLessThan(1e-6);
    expect(off.distanceTo(headBind)).toBeLessThan(0.05);
    const atOrigin = at({ x: 0, y: 0, z: 0 });
    const w2 = parts.wrapPart(atOrigin, 'hat', false);
    expect(parts.computeAuthorOffset(w2.bb, w2.center, head, root, 'hat', charBones, {})).toBe(null);
    const legacy = { hat: { x: -off.x, y: -off.y, z: -off.z } };
    expect(parts.computeAuthorOffset(w1.bb, w1.center, head, root, 'hat', charBones, legacy)).toBe(null);
    expect(parts.computeAuthorOffset(null, w1.center, head, root, 'hat', charBones, {})).toBe(null);
  });
  it('charBoneBindInverses — 파츠(wrapper 아래 · 리깅 파츠) 스킨드 메쉬는 뺀다', () => {
    const inst = body.instantiateBase()!;
    const n = Object.keys(parts.charBoneBindInverses(inst.root)).length;
    expect(n).toBeGreaterThan(5);
    const w = new THREE.Group(); w.name = '__partWrap_top';
    const fake = SkeletonUtils.clone(body.baseScene());
    fake.traverse((o: { isBone?: boolean; name: string }) => { if (o.isBone) o.name = 'zz_' + o.name; });
    w.add(fake); inst.root.add(w);
    expect(Object.keys(parts.charBoneBindInverses(inst.root)).length).toBe(n);
    expect(parts.charBoneBindInverses(null)).toEqual({});
  });
});

describe('리깅 기준점 · 다중 파츠', () => {
  it('riggedBaseCenter — 자세가 반영된 스킨 상자 중심을 부모 로컬로 · 비면 null', () => {
    const inst = body.instantiateBase()!;
    const w = new THREE.Group(); inst.root.add(w);
    const sms = parts.skinnedMeshesOf(inst.root);
    const c = parts.riggedBaseCenter(w, sms, inst.root);
    expect(c.y).toBeGreaterThan(0);
    expect(parts.riggedBaseCenter(w, [], inst.root)).toBe(null);
  });
  it('prepareExtra — 이름 · 자기 _col 묶음(재질 이름도) · 가운데 · 그림칸 규칙은 안 탄다', () => {
    calls.length = 0;
    const g = new THREE.Group(); const m = mesh('', 'w_col2'); m.position.set(0, 1, 0); g.add(m); g.add(mesh('x_pic'));
    const r = parts.prepareExtra(g, 'glasses', 2);
    expect(r.obj.name).toBe('__part_glasses_i2');
    expect(r.wrapper.name).toBe('__partWrap_glasses_i2');
    expect(Object.keys(r.colorGroups)).toEqual(['col2']);
    expect(calls.filter((x) => x.startsWith('tone:'))).toHaveLength(2);
    expect(r.wrapper.userData.baseCenter.y).toBeCloseTo(0.5);
  });
  it('THREE · tone 이 없으면 만들 때 거절', () => {
    expect(() => createParts({} as never)).toThrow(/THREE/);
    expect(() => createParts({ THREE } as never)).toThrow(/tone/);
  });
});

describe('applyXfToWrapper', () => {
  const xf0 = () => ({ scale: 1, pos: [0, 0, 0], rot: [0, 0, 0], color: {} });
  const opts = (pics: unknown[] = []) => ({ defaultXf: xf0, defaultOffsets: { hat: { x: 0, y: 0, z: -0.5 } }, applyPic: (_w: unknown, p: unknown) => pics.push(p) });
  const rigid = (ao: unknown = null) => {
    const g = new THREE.Group(); const m = mesh('brim_col', 'b'); g.add(m);
    const pr = parts.prepareScene(g, 'hat');
    const w = parts.wrapPart(pr.obj, 'hat', false).wrapper;
    w.userData.baseCenter = new THREE.Vector3(1, 2, 3);
    w.userData.authorOff = ao; w.userData.colorGroups = pr.colorGroups;
    return w;
  };
  it('비리깅 — 기준점 − 저작 오프셋 + 카테고리 상수 + xf · 세로 보정 · 회전 · 크기 · 그림칸', () => {
    const pics: unknown[] = [];
    const w = rigid(new THREE.Vector3(0, 1, 0));
    w.userData.animalHeadDy = 0.25;
    parts.applyXfToWrapper(w, { scale: 2, pos: [0.1, 0.2, 0.3], rot: [0.1, 0, 0], color: {}, pic: 'P' }, 'hat', opts(pics));
    expect([w.position.x, w.position.y, w.position.z].map((v) => +v.toFixed(6))).toEqual([1.1, 1.45, 2.8]);
    expect(w.scale.x).toBe(2);
    expect(w.rotation.x).toBeCloseTo(0.1);
    expect(pics).toEqual(['P']);
  });
  it('옛 «되밀어 둔» xf.pos 는 오프셋을 되돌리고 · 판정은 wrapper 마다 한 번', () => {
    const w = rigid(new THREE.Vector3(0, 1, 0));
    parts.applyXfToWrapper(w, { scale: 1, pos: [0, -0.9, 0], rot: [0, 0, 0] }, 'cape', opts());
    expect(w.userData._aoLegacy).toBe(true);
    expect(+w.position.y.toFixed(6)).toBe(1.1); // 2 − 1 + (−0.9) + 1
    parts.applyXfToWrapper(w, { scale: 1, pos: [0, 0.5, 0], rot: [0, 0, 0] }, 'cape', opts());
    expect(w.userData._aoLegacy).toBe(true); // 다시 판정하지 않는다
  });
  it('xf 가 없으면 기본값 · 기준점이 없으면 아무것도 안 한다', () => {
    const w = rigid();
    parts.applyXfToWrapper(w, null, 'top', opts());
    expect([w.position.x, w.position.y, w.position.z]).toEqual([1, 2, 3]);
    const bare = new THREE.Group();
    parts.applyXfToWrapper(bare, xf0(), 'top', opts());
    expect(bare.position.length()).toBe(0);
  });
  it('색 — 단색은 색 + 같은 평탄 배율 emissive · 텍스처는 색조만', () => {
    const w = rigid();
    const m = w.userData.colorGroups.col1[0];
    parts.applyXfToWrapper(w, { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0], color: { col1: '#ff0000' } }, 'top', opts());
    expect(m.material.color.getHexString()).toBe('ff0000');
    expect(m.material.emissive.r).toBeCloseTo(0.3);
    m.material.map = new THREE.Texture();
    m.material.color.set('#ffffff');
    parts.applyXfToWrapper(w, { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0], color: { col1: '#00ff00' }, colorHSV: { col1: { h: 0.3, s: 0.5, v: 0.8 } } }, 'top', opts());
    expect(m.material.color.getHexString()).toBe('ffffff');
    expect([m.material.userData._hueU.uHue.value, m.material.userData._hueU.uSat.value, m.material.userData._hueU.uVal.value, m.material.userData._hueU.uOn.value]).toEqual([0.3, 0.5, 0.8, 1]);
  });
  it('리깅 — bindMatrix 에 피봇 기준으로 굽는다', () => {
    const inst = body.instantiateBase()!;
    const charBones = parts.collectCharBones(inst.root);
    const ps = SkeletonUtils.clone(body.baseScene());
    const sms = parts.skinnedMeshesOf(ps);
    const rb = parts.rebindRigged(sms, charBones);
    const w = parts.wrapPart(ps, 'top', true).wrapper;
    Object.assign(w.userData, { rigged: true, rigBindCenter: rb.bindCenter, rigSkinnedMeshes: sms });
    const before = sms[0].bindMatrix.clone();
    parts.applyXfToWrapper(w, { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0] }, 'top', opts());
    expect(sms[0].bindMatrix.equals(sms[0].userData._origBind)).toBe(true);
    parts.applyXfToWrapper(w, { scale: 1.5, pos: [0, 0.1, 0], rot: [0, 0, 0] }, 'top', opts());
    expect(sms[0].bindMatrix.equals(before)).toBe(false);
    const p = new THREE.Vector3().copy(rb.bindCenter).applyMatrix4(new THREE.Matrix4().copy(sms[0].bindMatrix).multiply(new THREE.Matrix4().copy(sms[0].userData._origBind).invert()));
    expect(p.y).toBeCloseTo(rb.bindCenter.y + 0.1, 6); // 피봇은 그 자리에서 크기만 — 옮긴 만큼만 움직인다
    expect(w.position.y).toBeCloseTo(w.userData.baseCenter.y + 0.1, 6);
  });
});
