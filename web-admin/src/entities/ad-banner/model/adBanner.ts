// DB 모양은 앱(app/parts/app.js 광고 배너)과 같아야 한다 — 앱이 이 배열을 그대로 받아 런처 하단에 돌려 보여 준다.
export interface AdSlide {
  img: string;
  link: string;
}

export const AD_SLOTS = 3; // 앱 편집 창의 칸 수

const HTTP_URL = /^https?:\/\/\S+$/i;

/** DB 값 → 보여 줄 장들. 앱 구독과 같게 배열이 아니면 없음으로, 이미지가 없는 장은 뺀다. */
export function toSlides(raw: unknown): AdSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Partial<AdSlide> => !!s && typeof s === 'object' && !!(s as AdSlide).img)
    .map((s) => ({ img: String(s.img), link: s.link ? String(s.link) : '' }));
}

/** 입력 칸들 → 쓸 배열. 앱 저장 버튼과 같게 앞뒤 공백을 자르고 이미지가 빈 칸은 건너뛴다. */
export function buildSlides(inputs: AdSlide[]): AdSlide[] {
  return inputs
    .map((s) => ({ img: s.img.trim(), link: s.link.trim() }))
    .filter((s) => s.img)
    .slice(0, AD_SLOTS);
}

/** 문제가 있으면 그 이유, 없으면 null. 링크는 앱이 외부 브라우저로 여니 http(s) 만 받는다. */
export function slideProblem(slide: AdSlide): string | null {
  if (!/^https:\/\/\S+$/i.test(slide.img)) return '이미지 주소는 https:// 로 시작해야 해요';
  if (slide.link && !HTTP_URL.test(slide.link)) return '링크는 http:// 또는 https:// 로 시작해야 해요';
  return null;
}

export function isPreviewable(img: string): boolean {
  return /^https:\/\/\S+$/i.test(img.trim());
}
