/* 🙂 얼굴 · 피부 그림판 — 512 캔버스 · 좌우 대칭축 · 피부 5종 · 피부 위에 그림 얹기 · «완전히 비었나» 판정.
   캔버스는 만드는 함수를 주입받는다(앱 · 웹은 document 캔버스, 시험은 가짜). 피부 그림 불러오기 · 견본 칠하기는 부르는 쪽 몫이고,
   불러온 피부는 skinCanvases 배열의 같은 칸에 넣는다(얼굴 자동 복구도 같은 배열을 본다). */

export const CANVAS_SZ = 512;
/** 얼굴 UV 좌우 대칭축(u0≈0.18) → 미러 u' = 0.36 - u */
export const FACE_SYM_SUM = 0.36;
/** 피부색 5종 — 0번은 기본 그림(face1.png), 1~4번은 피부 그림. 그림을 불러오기 전에는 이 색으로 칠해 둔다. */
export const SKIN_COLORS = ['#FFE0BD', '#F1C898', '#E0AC69', '#C68642', '#8D5524'];
/* 512² 를 통째로 읽으면 1MB — 저장이 자주 불리므로 32² 로 줄여 알파만 본다. 축소는 평균이라 1px 선도 0 이 되지 않는다. */
const BLANK_PROBE_SZ = 32;

export interface Ctx2D {
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(img: unknown, x: number, y: number, w?: number, h?: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d', opts?: { willReadFrequently?: boolean }): Ctx2D | null;
}

export interface FaceDeps {
  makeCanvas(): CanvasLike;
  /** 캔버스나 이미지처럼 그릴 수 있는 값인가 — 문자열(dataURL 복원 실패 등)이면 그리지 않는다 */
  isDrawable(v: unknown): boolean;
  warn?: (...args: unknown[]) => void;
}

export function createFace(deps: FaceDeps) {
  if (!deps || typeof deps.makeCanvas !== 'function') throw new Error('char-core: deps.makeCanvas 가 필요하다');
  const warn = deps.warn || ((...a: unknown[]) => console.warn(...a));

  function newCanvas(): CanvasLike {
    const c = deps.makeCanvas();
    c.width = c.height = CANVAS_SZ;
    return c;
  }

  let probe: CanvasLike | null = null;
  /** 그림 레이어가 완전히 비었는가. ⚠️ 판정할 수 없으면 false — true 에는 저장을 막는 힘이 있어 «모르면 안 빔» 이 안전하다. */
  function isBlankDraw(cv: unknown): boolean {
    try {
      const c = cv as CanvasLike;
      if (!c || typeof c.getContext !== 'function' || !c.width || !c.height) return false;
      if (!probe) { probe = deps.makeCanvas(); probe.width = probe.height = BLANK_PROBE_SZ; }
      const x = probe.getContext('2d', { willReadFrequently: true }) as Ctx2D;
      x.clearRect(0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ);
      x.drawImage(c, 0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ);
      const d = x.getImageData(0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function snapCanvas(src: unknown): CanvasLike {
    const c = newCanvas();
    (c.getContext('2d') as Ctx2D).drawImage(src, 0, 0);
    return c;
  }

  const skinCanvases: CanvasLike[] = SKIN_COLORS.map((col) => {
    const cv = newCanvas();
    const x = cv.getContext('2d') as Ctx2D;
    x.fillStyle = col;
    x.fillRect(0, 0, CANVAS_SZ, CANVAS_SZ);
    return cv;
  });
  const skinCanvasFor = (i: number) => (skinCanvases[i] || skinCanvases[0]) as CanvasLike;
  const skinColorFor = (i: number) => (SKIN_COLORS[i] || SKIN_COLORS[0]) as string;

  let skipWarned = false;
  /** 피부 위에 그림 레이어를 얹은 한 장(지워도 피부는 남는다).
      ⚠️ 그림이 캔버스 · 이미지가 아니면 피부만 칠한다 — 크래시 방지지 수정이 아니라서 한 번은 경고를 남긴다. */
  function compositeFace(skinIdx: number, drawCv: unknown): CanvasLike {
    const cv = newCanvas();
    const x = cv.getContext('2d') as Ctx2D;
    x.drawImage(skinCanvasFor(skinIdx), 0, 0);
    if (deps.isDrawable(drawCv)) x.drawImage(drawCv, 0, 0);
    else if (!skipWarned) {
      skipWarned = true;
      warn('[얼굴] 그림 레이어가 캔버스/이미지가 아니라 건너뜁니다 — 피부색만 보입니다. 받은 값:', Object.prototype.toString.call(drawCv), drawCv);
    }
    return cv;
  }

  return { CANVAS_SZ, FACE_SYM_SUM, SKIN_COLORS, newCanvas, isBlankDraw, snapCanvas, skinCanvases, skinCanvasFor, skinColorFor, compositeFace };
}

export type Face = ReturnType<typeof createFace>;
