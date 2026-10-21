import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixMatLighting } from '@/entities/character/lib/mat-fix';
import {
  FILL_LIGHT_MUL,
  FLAT_EMISSIVE,
  KEY_LIGHT_MUL,
  LIGHT_HSL,
  MAIN_LIGHT_INT,
} from '@/entities/character/lib/lighting';

/* 웹 생성기 밝기 · 재질 고치기는 앱 생성기와 같아야 한다 — 앱 원본을 읽어 견준다(앱만 고치면 여기가 빨강). */
const PARTS = new URL('../../desktop/app/parts/', import.meta.url);
const read = (f: string) => readFileSync(new URL(f, PARTS), 'utf8');
const APP = read('app.js');
const TONE = read('shared/light-tone.js');
const PREVIEW = read('creator/creator-preview.js');

const num = (src: string, name: string): number => {
  const m = new RegExp(`^const ${name}\\s*=\\s*([0-9.\\s*]+);`, 'm').exec(src);
  if (!m?.[1]) throw new Error(`${name} 를 앱 원본에서 못 찾았다`);
  return m[1].split('*').reduce((p, v) => p * Number(v), 1);
};

describe('앱 생성기와 같은 빛', () => {
  it('조명 상수', () => {
    expect(MAIN_LIGHT_INT).toBeCloseTo(num(APP, '_MAIN_LIGHT_INT'), 12);
    expect(FILL_LIGHT_MUL).toBe(num(APP, '_FILL_LIGHT_MUL'));
    expect(KEY_LIGHT_MUL).toBe(num(APP, '_KEY_LIGHT_MUL'));
  });

  it('FLAT_EMISSIVE — 앱과 같은 손잡이(TONE_FRONT_TOTAL)에서 같은 식', () => {
    const total = num(TONE, 'TONE_FRONT_TOTAL');
    const main = num(APP, '_MAIN_LIGHT_INT'),
      fill = num(APP, '_FILL_LIGHT_MUL');
    expect(FLAT_EMISSIVE).toBeCloseTo(Math.max(0, total - 0.95 * main - main * fill), 12);
  });

  it('빛 색 — 생성기 HSL(LIGHT_PRESET.h · 0.45 · 0.85)', () => {
    const h = Number(/^const LIGHT_PRESET\s*=\s*\{[^}]*\bh:\s*([0-9.]+)/m.exec(TONE)?.[1]);
    const sl = /setHSL\(h,\s*([0-9.]+),\s*([0-9.]+)\)/.exec(PREVIEW);
    expect([...LIGHT_HSL]).toEqual([h, Number(sl?.[1]), Number(sl?.[2])]);
  });
});

describe('앱과 같은 재질 고치기', () => {
  // 앱 함수 본문을 그대로 꺼내 돌린다(콘솔 줄은 조용히)
  const body = /function _fixGlbMatLighting\(m\)\{[\s\S]*?\n\}/.exec(APP)?.[0];
  const appFix = new Function('console', `${body}; return _fixGlbMatLighting;`)({ log() {} }) as (
    m: object,
  ) => void;

  const cases = [
    {
      isMeshStandardMaterial: true,
      metalness: 1,
      roughness: 0,
      metalnessMap: null,
      aoMap: 1,
      lightMap: 1,
      vertexColors: true,
    },
    {
      isMeshStandardMaterial: true,
      metalness: 1,
      roughness: 0.5,
      metalnessMap: 1,
      aoMap: null,
      lightMap: null,
      vertexColors: false,
    },
    {
      isMeshStandardMaterial: true,
      metalness: 0.6,
      roughness: 0.1,
      metalnessMap: null,
      aoMap: null,
      lightMap: null,
      vertexColors: false,
    },
    {
      isMeshStandardMaterial: false,
      metalness: 1,
      roughness: 0,
      metalnessMap: null,
      aoMap: null,
      lightMap: 1,
      vertexColors: true,
    },
  ];
  it.each(cases.map((c, i) => [i, c] as const))('재질 %i — 고친 결과가 같다', (_i, c) => {
    const a = { ...c, name: '' },
      w = { ...c, name: '' };
    appFix(a);
    fixMatLighting(w as never);
    const pick = (m: Record<string, unknown>) => [
      m.metalness,
      m.roughness,
      m.aoMap,
      m.lightMap,
      m.vertexColors,
    ];
    expect(pick(w)).toEqual(pick(a));
  });
  it('null 은 그냥 지나간다', () => {
    expect(() => fixMatLighting(null)).not.toThrow();
  });
});
