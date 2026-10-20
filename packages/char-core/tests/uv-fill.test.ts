import { describe, expect, it } from 'vitest';
import { uvFill } from '../src/index';
import type { GeometryLike } from '../src/index';

/** 손으로 만든 geometry — uv 는 [u0,v0, u1,v1, …], index 는 없으면 정점 순서 그대로 */
function geo(uv: number[], index?: number[]): GeometryLike {
  const a = { count: uv.length / 2, getX: (i: number) => uv[i * 2] as number, getY: (i: number) => uv[i * 2 + 1] as number };
  return { attributes: { uv: a }, index: index ? { count: index.length, getX: (i: number) => index[i] as number } : null };
}
/** 칠하기 호출을 기록하고 getImageData 는 size² 빈 그림을 준다 */
function ctx(size = 8) {
  const log: string[] = [];
  const data = new Uint8ClampedArray(size * size * 4);
  const c = {
    log, data, globalCompositeOperation: '', fillStyle: '' as unknown, strokeStyle: '' as unknown, lineJoin: '', lineWidth: 0,
    save: () => log.push('save'), restore: () => log.push('restore'), beginPath: () => log.push('begin'),
    moveTo: (x: number, y: number) => log.push(`M${x},${y}`), lineTo: (x: number, y: number) => log.push(`L${x},${y}`),
    closePath: () => log.push('Z'), fill: () => log.push('fill'), stroke: () => log.push('stroke'),
    getImageData: () => ({ data }), putImageData: () => log.push('put'),
  };
  return c;
}
// 두 섬: 왼쪽 아래 삼각형 두 개(정점 공유 X · UV 같음) + 오른쪽 위 삼각형 하나
const TWO = geo([0, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.75, 0.75, 1, 0.75, 1, 1]);

describe('uvTriangles', () => {
  it('uv × 크기 좌표 · 인덱스 있음 / 없음 · UV 없음', () => {
    expect(uvFill.uvTriangles(geo([0, 0, 1, 0, 0, 1]), 10)).toEqual([[0, 0, 10, 0, 0, 10]]);
    expect(uvFill.uvTriangles(geo([0, 0, 1, 0, 0, 1], [2, 1, 0]), 10)).toEqual([[0, 10, 10, 0, 0, 0]]);
    expect(uvFill.uvTriangles({ attributes: {} }, 10)).toEqual([]);
    expect(uvFill.uvTriangles(null, 10)).toEqual([]);
    expect(uvFill.uvTriangles(geo([0, 0, NaN, 0, 0, 1]), 10)).toEqual([]);
  });
});

describe('fillTriangles', () => {
  it('칠하기 · 지우기는 1px 더 넓게 · 빈 목록이면 아무것도 안 한다', () => {
    const c = ctx();
    expect(uvFill.fillTriangles(c, [[0, 0, 4, 0, 0, 4]], { color: '#ff0000' })).toBe(1);
    expect([c.globalCompositeOperation, c.fillStyle, c.lineWidth]).toEqual(['source-over', '#ff0000', 3]);
    expect(c.log).toEqual(['save', 'begin', 'M0,0', 'L4,0', 'L0,4', 'Z', 'fill', 'stroke', 'restore']);
    const e = ctx();
    uvFill.fillTriangles(e, [[0, 0, 4, 0, 0, 4]], { erase: true });
    expect([e.globalCompositeOperation, e.lineWidth, e.fillStyle]).toEqual(['destination-out', 5, '#000000']);
    const z = ctx();
    expect(uvFill.fillTriangles(z, [], {})).toBe(0);
    expect(z.log).toEqual([]);
    const p0 = ctx();
    uvFill.fillTriangles(p0, [[0, 0, 4, 0, 0, 4]], { pad: 0 });
    expect(p0.log).not.toContain('stroke');
  });
});

describe('UV 섬', () => {
  it('UV 가 같은 정점은 한 섬으로 잇는다', () => {
    const ids = uvFill.islandIds(TWO)!;
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });
  it('triangleAtUv — 품은 삼각형 · 밖이면 -1', () => {
    expect(uvFill.triangleAtUv(TWO, 0.1, 0.1)).toBe(0);
    expect(uvFill.triangleAtUv(TWO, 0.9, 0.8)).toBe(2);
    expect(uvFill.triangleAtUv(TWO, 0.9, 0.1)).toBe(-1);
    expect(uvFill.triangleAtUv(TWO, NaN, 0)).toBe(-1);
  });
  it('islandTriangles — faceIndex 또는 uv 로 섬 · 넓이 0 섬은 빈 목록', () => {
    expect(uvFill.islandTriangles(TWO, 8, 1)).toHaveLength(2);
    expect(uvFill.islandTriangles(TWO, 8, null, { x: 0.9, y: 0.8 })).toHaveLength(1);
    expect(uvFill.islandTriangles(TWO, 8, 99)).toEqual([]);
    expect(uvFill.islandTriangles(geo([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), 8, 0)).toEqual([]);
  });
});

describe('여백 몫', () => {
  it('모든 텍셀이 어느 조각의 몫이 되고, 채우면 그 몫만 칠한다', () => {
    const L = uvFill.canvasLayout(8, [TWO]);
    expect(L.islands).toHaveLength(2);
    expect(Array.from(L.owner).every((o) => o > 0)).toBe(true);
    const c = ctx(8);
    const n = uvFill.fillIslandOwned(c, 8, TWO, 2, null, null, { color: '#00ff00' });
    const mine = Array.from(L.owner).filter((o) => o === L.index.get([...L.index.keys()].find((k) => L.index.get(k) === uvFill.islandIndex(L, TWO, 2))!)! + 1).length;
    expect(n).toBe(mine);
    expect([c.data[1], c.data[3]].some((v) => v === 255) || n < 64).toBe(true);
    expect(c.log).toEqual(['put']);
  });
  it('같은 묶음이면 표를 다시 만들지 않고 · 상한을 넘으면 오래된 것을 버린다', () => {
    const a = uvFill.canvasLayout(8, [TWO]);
    expect(uvFill.canvasLayout(8, [TWO])).toBe(a);
    for (let i = 0; i <= uvFill.LAYOUT_CACHE_MAX; i++) uvFill.canvasLayout(8, [geo([0, 0, 1, 0, 0, 1])]);
    expect(uvFill.canvasLayout(8, [TWO])).not.toBe(a);
  });
  it('fillMeshOwned — 그 메쉬의 넓이 있는 조각 전부 · 못 찾으면 0', () => {
    const c = ctx(8);
    expect(uvFill.fillMeshOwned(c, 8, TWO, null, { erase: true })).toBe(64);
    expect(uvFill.fillIslandOwned(ctx(8), 8, TWO, 99, null, null)).toBe(0);
  });
});
