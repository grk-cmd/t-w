/** 붙일 그림 크기 — 얼굴 판(200)에 그리니 이보다 커도 보이는 것은 같다(코드 크기만 커진다) */
export const FACE_IMAGE_SIZE = 256;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** 고른 파일 → 256×256 PNG dataURL. 그림이 아니거나 못 열면 null(화면은 «열 수 없어요»). */
export async function fileToFaceImage(file: File): Promise<string | null> {
  if (!TYPES.includes(file.type)) return null;
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = c.height = FACE_IMAGE_SIZE;
    c.getContext('2d')?.drawImage(bmp, 0, 0, FACE_IMAGE_SIZE, FACE_IMAGE_SIZE);
    bmp.close();
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
