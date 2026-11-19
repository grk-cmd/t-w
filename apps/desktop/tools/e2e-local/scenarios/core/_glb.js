// 시험용 GLB 한 개 — 삼각형 하나짜리 glTF 2.0(카탈로그 등록 · 미리보기 · 썸네일이 읽을 수 있는 가장 작은 모델)
// seed 를 바꾸면 꼭짓점이 달라져 파일 해시도 달라진다(서버가 해시로 파일을 가린다)
'use strict';

function tinyGlb(seed = 0){
  const s = 0.05 + (seed % 97) / 1000;
  const pos = new Float32Array([0, 0, 0, s, 0, 0, 0, s, 0]);
  const bin = Buffer.from(pos.buffer);
  const json = {
    asset: { version: '2.0', generator: 'tw-e2e' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'e2e' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.5, 0.2, 1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [s, s, 0] }],
  };
  let j = Buffer.from(JSON.stringify(json));
  if(j.length % 4) j = Buffer.concat([j, Buffer.alloc(4 - (j.length % 4), 0x20)]);
  const total = 12 + 8 + j.length + 8 + bin.length;
  const head = Buffer.alloc(12);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write('JSON', 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
  return Buffer.concat([head, jh, j, bh, bin]);
}

module.exports = { tinyGlb };
