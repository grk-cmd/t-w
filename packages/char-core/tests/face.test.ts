import { describe, expect, it } from 'vitest';
import { CANVAS_SZ, createFace, SKIN_COLORS } from '../src/index';
import type { CanvasLike } from '../src/index';

/** 그리기 기록 + 알파 한 칸을 고를 수 있는 가짜 캔버스 */
type Fake = CanvasLike & { id: number; ops: unknown[][]; alpha: number };
let seq = 0;
function fakeCanvas(): Fake {
  const c = { id: ++seq, width: 0, height: 0, ops: [] as unknown[][], alpha: 0 } as unknown as Fake;
  const ctx = {
    fillStyle: '' as unknown,
    fillRect: (...a: unknown[]) => c.ops.push(['fillRect', ctx.fillStyle, ...a]),
    clearRect: (...a: unknown[]) => c.ops.push(['clearRect', ...a]),
    drawImage: (img: unknown, ...a: unknown[]) => { c.ops.push(['drawImage', img, ...a]); if (img && (img as Fake).alpha) c.alpha = (img as Fake).alpha; },
    getImageData: (_x: number, _y: number, w: number, h: number) => { const d = new Uint8ClampedArray(w * h * 4); d[d.length - 1] = c.alpha; return { data: d }; },
  };
  c.getContext = () => ctx;
  return c;
}
const make = (warns: unknown[][] = []) => createFace({ makeCanvas: fakeCanvas, isDrawable: (v) => !!v && typeof v === 'object' && 'ops' in (v as object), warn: (...a) => warns.push(a) });

describe('얼굴 그림판', () => {
  it('새 캔버스는 512² · 피부 5칸은 피부색으로 칠해 둔다', () => {
    const f = make();
    expect([f.newCanvas().width, f.newCanvas().height]).toEqual([CANVAS_SZ, CANVAS_SZ]);
    expect(f.skinCanvases).toHaveLength(5);
    f.skinCanvases.forEach((cv, i) => expect((cv as Fake).ops).toEqual([['fillRect', SKIN_COLORS[i], 0, 0, 512, 512]]));
    expect(f.FACE_SYM_SUM).toBe(0.36);
  });
  it('피부 번호가 없으면 0번', () => {
    const f = make();
    expect(f.skinCanvasFor(9)).toBe(f.skinCanvases[0]);
    expect(f.skinColorFor(-1)).toBe('#FFE0BD');
    expect(f.skinColorFor(4)).toBe('#8D5524');
  });
  it('compositeFace — 피부 위에 그림 · 그림이 아니면 피부만 + 경고 한 번', () => {
    const warns: unknown[][] = [];
    const f = make(warns);
    const draw = fakeCanvas();
    const out = f.compositeFace(2, draw) as Fake;
    expect(out.ops).toEqual([['drawImage', f.skinCanvases[2], 0, 0], ['drawImage', draw, 0, 0]]);
    const skinOnly = f.compositeFace(1, 'data:image/png;base64,AA') as Fake;
    expect(skinOnly.ops).toEqual([['drawImage', f.skinCanvases[1], 0, 0]]);
    f.compositeFace(1, null);
    expect(warns).toHaveLength(1);
    expect(warns[0]![1]).toBe('[object String]');
  });
  it('불러온 피부를 배열 같은 칸에 넣으면 합성에 쓰인다', () => {
    const f = make();
    const loaded = fakeCanvas();
    f.skinCanvases[3] = loaded;
    expect((f.compositeFace(3, fakeCanvas()) as Fake).ops[0]![1]).toBe(loaded);
  });
  it('snapCanvas — 새 512 캔버스에 그대로 그린다', () => {
    const f = make();
    const src = fakeCanvas();
    const c = f.snapCanvas(src) as Fake;
    expect(c.width).toBe(512);
    expect(c.ops).toEqual([['drawImage', src, 0, 0]]);
  });
});

describe('isBlankDraw — true 는 저장을 막는다', () => {
  const f = make();
  const sized = (alpha: number) => { const c = fakeCanvas(); c.width = c.height = 512; c.alpha = alpha; return c; };
  it('알파가 하나도 없으면 비었다 · 하나라도 있으면 안 빔', () => {
    expect(f.isBlankDraw(sized(0))).toBe(true);
    expect(f.isBlankDraw(sized(1))).toBe(false);
  });
  it('판정할 수 없으면 false(캔버스 아님 · 크기 0 · 읽다 던짐)', () => {
    expect(f.isBlankDraw(null)).toBe(false);
    expect(f.isBlankDraw('x')).toBe(false);
    expect(f.isBlankDraw(fakeCanvas())).toBe(false);
    const g = createFace({ makeCanvas: () => { const c = fakeCanvas(); c.getContext = () => ({ ...fakeCanvas().getContext('2d')!, getImageData: () => { throw new Error('tainted'); } }); return c; }, isDrawable: () => true });
    expect(g.isBlankDraw(sized(0))).toBe(false);
  });
  it('makeCanvas 가 없으면 만들 때 거절', () => {
    expect(() => createFace({} as never)).toThrow(/makeCanvas/);
  });
});
