/** 붙일 그림 크기 — 얼굴 판(200)에 그리니 이보다 커도 보이는 것은 같다(코드 크기만 커진다) */
export const FACE_IMAGE_SIZE = 256;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** 원본에서 잘라 올 가운데 정사각형 [x, y, 한 변] — 짧은 변에 맞추고 긴 쪽 양 끝을 같이 자른다(늘리지 않는다). 크기가 없으면 null. */
export function centerSquare(w: number, h: number): [number, number, number] | null {
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const s = Math.min(w, h);
  return [(w - s) / 2, (h - s) / 2, s];
}

/** 고른 파일 → 256×256 PNG dataURL(가운데 정사각형). 그림이 아니거나 못 열면 null(화면은 «열 수 없어요»). */
export async function fileToFaceImage(file: File): Promise<string | null> {
  if (!TYPES.includes(file.type)) return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const sq = centerSquare(bmp.width, bmp.height);
    if (!sq) return null;
    const c = document.createElement('canvas');
    c.width = c.height = FACE_IMAGE_SIZE;
    const ctx = c.getContext('2d');
    if (!ctx) return null; // 그리지 못한 빈 그림을 성공으로 내보내지 않는다
    ctx.drawImage(bmp, sq[0], sq[1], sq[2], sq[2], 0, 0, FACE_IMAGE_SIZE, FACE_IMAGE_SIZE);
    return c.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    bmp.close();
  }
}
