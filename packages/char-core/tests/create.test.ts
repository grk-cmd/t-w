import { describe, expect, it } from 'vitest';
import { createCharCore, THREE_REVISION, VERSION } from '../src/index';
import { fakeThree } from './fake-three';

describe('createCharCore', () => {
  it('r128 three 를 받으면 판을 알려 준다', () => {
    const core = createCharCore({ THREE: fakeThree() });
    expect(core.version).toBe(VERSION);
    expect(core.threeRevision).toBe(THREE_REVISION);
    expect(Object.isFrozen(core)).toBe(true);
  });

  it('three 가 없으면 거절한다', () => {
    expect(() => createCharCore({} as never)).toThrow(/THREE/);
    expect(() => createCharCore(undefined as never)).toThrow(/THREE/);
  });

  it('다른 판 three 는 거절한다', () => {
    for (const rev of ['127', '129', '150', '']) {
      expect(() => createCharCore({ THREE: fakeThree(rev) })).toThrow(/r128/);
    }
  });

  it('판은 semver 모양이다', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/);
  });
});
