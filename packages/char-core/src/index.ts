/* @tw/char-core — 캐릭터 3D 코어(에픽 #430).
   앱(apps/desktop · classic script window.TwCharCore)과 웹(apps/web · ESM)이 같은 한 벌을 쓴다.
   three 는 번들에 넣지 않고 주입받는다 — 앱은 vendor/three(r128) 전역, 웹은 같은 판 의존성. */

/** 이 판의 코어가 맞춰 만든 three 판. 다른 판이면 뼈 · 재질 API 가 달라 조용히 어긋나므로 만들 때 거절한다. */
export const THREE_REVISION = '128';

export const VERSION: string = __CHAR_CORE_VERSION__;

export {
  CLONE_CODE_PREFIX,
  CLONE_TEX_SIZE,
  b64,
  unb64,
  deriveKey,
  clonePayload,
  encryptPayload,
  decryptPayload,
  defFromPayload,
  encodeCloneCode,
  decodeCloneCode,
} from './clone-code';
export type { CloneDefIn, CloneDefOut, DataUrlSource, EncodeOptions } from './clone-code';
export * as uvFill from './uv-fill';
export { createBody, BASE_HEIGHT } from './body';
export { createFace, CANVAS_SZ, FACE_SYM_SUM, SKIN_COLORS } from './face';
export { createParts } from './parts';
export type { Parts, PartsDeps, PrepareHooks, RigOptions, DefaultOffsets } from './parts';
export type { Face, FaceDeps, CanvasLike } from './face';
export type { Body, BodyDeps, BaseInstance, AssembleOptions, GltfParser } from './body';
export type { GeometryLike, UvPoint, FillOptions, Tri, Ctx2DLike, CanvasLayout } from './uv-fill';

/** 코어가 three 에서 기대는 몫 — 옮기는 단계마다 쓰는 것만 늘린다. */
export interface ThreeLike {
  readonly REVISION: string;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface CharCoreDeps {
  THREE: ThreeLike;
  log?: (level: LogLevel, msg: string) => void;
}

export interface CharCore {
  readonly version: string;
  readonly threeRevision: string;
}

export function createCharCore(deps: CharCoreDeps): CharCore {
  const THREE = deps?.THREE;
  if (!THREE) throw new Error('char-core: deps.THREE 가 필요하다');
  if (THREE.REVISION !== THREE_REVISION) {
    throw new Error(`char-core: three r${THREE_REVISION} 에 맞춘 판이다 — 받은 것 r${THREE.REVISION}`);
  }
  return Object.freeze({ version: VERSION, threeRevision: THREE.REVISION });
}
