import { readFileSync } from 'node:fs';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { BASE_HEIGHT, createBody } from '../src/index';

/* 진짜 three r128(앱 vendor/three 와 같은 판) + 앱에 든 진짜 기본 몸 GLB 로 돌린다.
   앱은 classic script 라 SkeletonUtils 가 THREE 에 붙어 있다 — 같은 모양을 만든다. */
const THREE = { ...THREE_NS, SkeletonUtils };
const baseGlb = (): ArrayBuffer => {
  const src = readFileSync(new URL('../../../apps/desktop/app/parts/base-glb.js', import.meta.url), 'utf8');
  const b64 = /BASE_GLB_B64="([^"]+)"/.exec(src)![1]!;
  const b = Buffer.from(b64, 'base64');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

function make(log: string[] = []) {
  return createBody({
    THREE,
    gltf: new GLTFLoader(),
    fixMatLighting: (m) => log.push('fix:' + (m.name || '')),
    setFaceMap: (m, t) => log.push('face:' + (m ? m.name : 'null') + ':' + t),
    applyLightPreset: (inst) => log.push('tone:' + inst.litMats.length),
    warn: (m) => log.push('warn:' + m),
  });
}

describe('기본 몸 불러오기', () => {
  it('바이트가 없으면 false · 기본 몸 없음', async () => {
    const b = make();
    expect(await b.loadBase(null)).toBe(false);
    expect(b.baseScene()).toBe(null);
    expect(b.instantiateBase()).toBe(null);
  });
  it('로더가 못 읽었다고 알리면 경고하고 false', async () => {
    const log: string[] = [];
    const b = createBody({ THREE, gltf: { parse: (_d, _p, _ok, bad) => bad(new Error('x')) }, fixMatLighting() {}, setFaceMap() {}, applyLightPreset() {}, warn: (m) => log.push(m) });
    expect(await b.loadBase(new ArrayBuffer(4))).toBe(false);
    expect(log).toEqual(['base GLB parse fail']);
  });
  it('로더가 바로 던지면 거절된 약속(옛 앱과 같다 — 부르는 쪽이 대신 몸으로)', async () => {
    await expect(make().loadBase(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow();
  });
});

describe('진짜 기본 몸', () => {
  const log: string[] = [];
  const b = make(log);
  beforeAll(async () => {
    expect(await b.loadBase(baseGlb())).toBe(true);
  });

  it('장면 · 애니메이션을 두고 시각 영역을 잰다', () => {
    expect(b.baseScene()).toBeTruthy();
    expect(Array.isArray(b.baseAnims())).toBe(true);
    expect(b.baseMeshHeight()!).toBeGreaterThan(0);
    expect(b.baseMeshMinY()).not.toBe(null);
  });

  it('복제마다 독립 재질 · 얼굴 · 상의 · 하의를 찾는다', () => {
    const a = b.instantiateBase()!, c = b.instantiateBase()!;
    expect(a.root).not.toBe(c.root);
    expect(a.faceMat).toBeTruthy();
    expect(a.upMat).toBeTruthy();
    expect(a.loMat).toBeTruthy();
    expect(a.faceMat).not.toBe(c.faceMat);
    expect(a.litMats.length).toBeGreaterThanOrEqual(3);
  });

  it('조립 — 얼굴 · 색 · 톤 · 키 1.4 · onRoot 는 크기 맞춘 뒤 · 감싸기 전', () => {
    log.length = 0;
    let seen: { scale: number; parent: unknown } | null = null;
    const r = b.assemble({ faceTex: 'F', blinkTex: 'B', top: '#ff0000', bot: '#00ff00', recolor: true, skinColor: '#fff',
      onRoot: (root) => { seen = { scale: root.scale.x, parent: root.parent }; } });
    expect(log.filter((l) => l.startsWith('face:'))).toHaveLength(1);
    expect(log.some((l) => l.startsWith('tone:'))).toBe(true);
    expect(r.upMat.color.getHexString()).toBe('ff0000');
    expect(r.loMat.color.getHexString()).toBe('00ff00');
    expect(r.group.children[0]).toBe(r.root);
    expect(seen!.parent).toBe(null);
    expect(seen!.scale).toBe(r.root.scale.x);
    const box = new THREE.Box3().setFromObject(r.root);
    expect(box.max.y - box.min.y).toBeCloseTo(BASE_HEIGHT, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect([r.fT, r.bT]).toEqual(['F', 'B']);
  });

  it('완성형 몸(recolor false)은 색을 안 칠하고 · 배율을 더 곱한다', () => {
    const plain = b.assemble({ faceTex: 'F', blinkTex: 'B', top: '#ff0000', bot: '#00ff00', recolor: true, skinColor: '#fff' });
    const comm = b.assemble({ faceTex: 'F', blinkTex: 'B', top: '#ff0000', bot: '#00ff00', recolor: false, scaleMul: 1.15, skinColor: '#fff' });
    expect(comm.upMat.color.getHexString()).not.toBe('ff0000');
    expect(comm.root.scale.x).toBeCloseTo(plain.root.scale.x * 1.15, 6);
  });

  it('받은 장면(커미션)이 있으면 그것을 복제한다', () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ name: 'Face' }));
    g.add(m);
    const inst = b.instantiateBase(g)!;
    expect(inst.faceMat.name).toBe('Face');
    expect(inst.faceMat).not.toBe(m.material);
  });
});

describe('메쉬 이름으로 미리 씌운 파츠 찾기', () => {
  const b = make();
  const mesh = (name: string, mat = '') => { const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: mat })); o.name = name; return o; };
  it('낱말 경계 — landscape 는 모자가 아니다 · 첫 매치만', () => {
    const g = new THREE.Group();
    ['landscape', 'Hat_01', 'hat_02', 'cape', 'wing_L', 'hand_left', 'hand_right', 'my glasses', 'Dress'].forEach((n) => g.add(mesh(n)));
    const i = b.instantiateBase(g)!;
    expect(i.hatMesh.name).toBe('Hat_01');
    expect(i.capeMesh.name).toBe('cape');
    expect(i.wingMesh.name).toBe('wing_L');
    expect(i.handLMesh.name).toBe('hand_left');
    expect(i.handRMesh.name).toBe('hand_right');
    expect(i.glassesMesh.name).toBe('my glasses');
    expect(i.onepieceMesh.name).toBe('Dress');
  });
  it('재질 이름이 없어도 메쉬 이름 head 는 얼굴', () => {
    const g = new THREE.Group();
    g.add(mesh('Head'));
    expect(b.instantiateBase(g)!.faceMesh.name).toBe('Head');
  });
});

describe('대신 몸 · 정규화', () => {
  const b = make();
  it('기본 몸이 없으면 대신 몸(얼굴 패치)', () => {
    const r = b.assemble({ faceTex: null, blinkTex: null, top: '#111111', bot: '#222222', recolor: true, skinColor: '#ffe0bd' });
    expect(r.root).toBe(r.group);
    expect(r.faceMat.name).toBe('Face');
  });
  it('normalizeModel — 키 · 발 바닥 · 가운데 · 배율', () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    m.position.set(5, 3, -1);
    g.add(m);
    const s = b.normalizeModel(g, 2);
    expect(s).toBeCloseTo(0.5);
    const box = new THREE.Box3().setFromObject(g);
    expect([box.min.y, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2].map((v) => +v.toFixed(6))).toEqual([0, 0, 0]);
  });
  it('THREE · gltf 가 없으면 만들 때 거절', () => {
    expect(() => createBody({ gltf: new GLTFLoader() } as never)).toThrow(/THREE/);
    expect(() => createBody({ THREE } as never)).toThrow(/gltf/);
  });
});
