import type { ThreeLike } from '../src/index';

/** 가짜 THREE — 코어가 three 에서 쓰는 몫만 흉내 낸다. 옮기는 단계마다 쓰는 것을 여기에 더한다. */
export function fakeThree(revision = '128'): ThreeLike {
  return { REVISION: revision };
}
