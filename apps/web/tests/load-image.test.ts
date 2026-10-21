import { afterEach, describe, expect, it, vi } from 'vitest';
import { centerSquare, fileToFaceImage } from '@/features/character-maker/lib/load-image';

describe('내 그림 — 가운데 정사각형 자르기', () => {
  it('가로가 길면 양옆을 같이 자른다', () => {
    expect(centerSquare(400, 200)).toEqual([100, 0, 200]);
  });
  it('세로가 길면 위아래를 같이 자른다', () => {
    expect(centerSquare(300, 900)).toEqual([0, 300, 300]);
  });
  it('정사각형은 그대로', () => {
    expect(centerSquare(256, 256)).toEqual([0, 0, 256]);
  });
  it('홀수 차이는 반 픽셀로 나눈다', () => {
    expect(centerSquare(101, 100)).toEqual([0.5, 0, 100]);
  });
  it('크기가 0 · 음수 · NaN · 무한이면 null', () => {
    expect(centerSquare(0, 100)).toBeNull();
    expect(centerSquare(100, -1)).toBeNull();
    expect(centerSquare(Number.NaN, 100)).toBeNull();
    expect(centerSquare(Number.POSITIVE_INFINITY, 100)).toBeNull();
  });
});

/* 브라우저 몫(createImageBitmap · canvas)을 가짜로 — 파일을 실제로 그 칸만 잘라 그리는지 · 비트맵을 늘 닫는지 본다 */
describe('fileToFaceImage — 고른 파일을 잘라 그린다', () => {
  afterEach(() => vi.unstubAllGlobals());

  function rig(w: number, h: number, opts: { drawThrows?: boolean } = {}) {
    const bmp = { width: w, height: h, close: vi.fn() };
    const drawImage = vi.fn(() => {
      if (opts.drawThrows) throw new Error('깨 봄');
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: () => 'data:image/png;base64,AA',
    };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bmp),
    );
    vi.stubGlobal('document', { createElement: () => canvas });
    return { bmp, drawImage, canvas };
  }
  const png = () => new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });

  it('400×200 → 가운데 200 칸을 256 에 그리고 비트맵을 닫는다', async () => {
    const { bmp, drawImage, canvas } = rig(400, 200);
    expect(await fileToFaceImage(png())).toBe('data:image/png;base64,AA');
    expect(drawImage).toHaveBeenCalledWith(bmp, 100, 0, 200, 200, 0, 0, 256, 256);
    expect([canvas.width, canvas.height]).toEqual([256, 256]);
    expect(bmp.close).toHaveBeenCalledTimes(1);
  });

  it('크기 0 그림 → null · 그리지 않고 닫는다', async () => {
    const { bmp, drawImage } = rig(0, 0);
    expect(await fileToFaceImage(png())).toBeNull();
    expect(drawImage).not.toHaveBeenCalled();
    expect(bmp.close).toHaveBeenCalledTimes(1);
  });

  it('그리다 실패해도 null · 비트맵은 닫는다', async () => {
    const { bmp } = rig(300, 300, { drawThrows: true });
    expect(await fileToFaceImage(png())).toBeNull();
    expect(bmp.close).toHaveBeenCalledTimes(1);
  });

  it('그림이 아닌 파일 · 못 여는 파일 → null', async () => {
    rig(10, 10);
    expect(await fileToFaceImage(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBeNull();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => Promise.reject(new Error('못 엶'))),
    );
    expect(await fileToFaceImage(png())).toBeNull();
  });
});
