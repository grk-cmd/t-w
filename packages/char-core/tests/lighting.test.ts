import { describe, expect, it } from 'vitest';
import {
  CREATOR_LIGHT_SL,
  FILL_LIGHT_MUL,
  FLAT_EMISSIVE,
  KEY_LIGHT_MUL,
  LIGHT_PRESET,
  MAIN_LIGHT_INT,
  TONE_FRONT_TOTAL,
  fixMatLighting,
  flatEmissive,
  type LitMaterialLike,
} from '../src/index';

/* 앱 화면 밝기를 바꾸지 않는 것이 이 모듈의 약속이다 — 앱에서 옮겨 올 때의 숫자를 그대로 못 박는다. */
describe('밝기 예산', () => {
  it('앱에서 옮겨 온 값 그대로', () => {
    expect(LIGHT_PRESET).toEqual({ b: 1.2, h: 0.09, e: 0.46 });
    expect(MAIN_LIGHT_INT).toBe(1.2 * 0.46);
    expect(KEY_LIGHT_MUL).toBe(0.29);
    expect(FILL_LIGHT_MUL).toBe(0.29);
    expect(TONE_FRONT_TOTAL).toBe(1.05);
    expect(CREATOR_LIGHT_SL).toEqual({ s: 0.45, l: 0.85 });
    expect(FLAT_EMISSIVE).toBe(Math.max(0, 1.05 - 0.95 * (1.2 * 0.46) - 1.2 * 0.46 * 0.29));
  });

  it('flatEmissive — 남는 몫 · 예산을 넘으면 0 · 조명이 0 이면 총합', () => {
    expect(flatEmissive(0.552, 0.3)).toBeCloseTo(1.05 - 0.95 * 0.552 - 0.552 * 0.3, 12);
    expect(flatEmissive(2, 1)).toBe(0);
    expect(flatEmissive(0, 0)).toBe(1.05);
    expect(flatEmissive(0, 0, 0.8)).toBe(0.8);
  });

  it('바꿀 수 없다(앱 · 웹이 같은 값을 본다)', () => {
    expect(Object.isFrozen(LIGHT_PRESET)).toBe(true);
    expect(Object.isFrozen(CREATOR_LIGHT_SL)).toBe(true);
  });
});

describe('fixMatLighting', () => {
  const mat = (o: Partial<LitMaterialLike> = {}): LitMaterialLike => ({
    name: 'm',
    isMeshStandardMaterial: true,
    metalness: 0,
    roughness: 0.5,
    metalnessMap: null,
    aoMap: null,
    lightMap: null,
    vertexColors: false,
    needsUpdate: false,
    ...o,
  });

  it('금속 1 · 매끈 0 → 0.1 · 0.6, 넷 다 고치면 한 줄', () => {
    const logs: string[] = [];
    const m = mat({ metalness: 1, roughness: 0, aoMap: 1, lightMap: 1, vertexColors: true });
    fixMatLighting(m, (s) => logs.push(s));
    expect([m.metalness, m.roughness, m.aoMap, m.lightMap, m.vertexColors, m.needsUpdate]).toEqual([
      0.1, 0.6, null, null, false, true,
    ]);
    expect(logs).toEqual([
      '[재질 정규화] m — metalness 1.00→0.1 · aoMap 제거(앰비언트를 깎고 있었음) · lightMap 제거 · vertexColors 끔(확산광만 깎여 톤이 어긋남)',
    ]);
  });

  it('경계 — metalness 0.6 은 그대로 · 거친 금속은 roughness 를 지킨다', () => {
    const a = mat({ metalness: 0.6, roughness: 0.1 });
    fixMatLighting(a);
    expect([a.metalness, a.roughness, a.needsUpdate]).toEqual([0.6, 0.1, false]);
    const b = mat({ metalness: 0.61, roughness: 0.2 });
    fixMatLighting(b);
    expect([b.metalness, b.roughness]).toEqual([0.1, 0.2]);
  });

  it('metalnessMap 이 있으면 금속도는 두고 알리기만', () => {
    const logs: string[] = [];
    const m = mat({ name: '', metalness: 1, metalnessMap: 1 });
    fixMatLighting(m, (s) => logs.push(s));
    expect(m.metalness).toBe(1);
    expect(m.needsUpdate).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[재질 주의\] \(이름 없음\) — metalnessMap/);
  });

  it('Standard 가 아닌 재질은 금속도를 안 보고 맵 · 정점색만', () => {
    const m = mat({ isMeshStandardMaterial: false, metalness: 1, roughness: 0, lightMap: 1 });
    fixMatLighting(m);
    expect([m.metalness, m.roughness, m.lightMap, m.needsUpdate]).toEqual([1, 0, null, true]);
  });

  it('정상 재질 · null 은 조용히', () => {
    const logs: string[] = [];
    const m = mat();
    fixMatLighting(m, (s) => logs.push(s));
    fixMatLighting(null, (s) => logs.push(s));
    expect(logs).toEqual([]);
    expect(m.needsUpdate).toBe(false);
  });
});
