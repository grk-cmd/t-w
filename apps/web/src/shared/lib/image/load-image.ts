/** 주소(파일 · dataURL) → 그릴 수 있는 그림. 못 열면 던진다. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('그림을 못 열었다'));
    img.src = url;
  });
}
