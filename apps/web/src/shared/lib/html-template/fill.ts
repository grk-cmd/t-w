/** 빌드한 index.html 틀에 미리 그린 화면을 채운다 — 자리표는 셋이고 저마다 꼭 한 번 있어야 한다(틀이 바뀌어 하나가 빠지면 빈 페이지가 조용히 나가지 않게 던진다). */
export const SLOTS = { lang: '%TW_LANG%', head: '<!--tw-head-->', body: '<!--tw-body-->' } as const;

const LANG_RE = /^[a-z]{2}$/;

export function fillTemplate(template: string, page: { lang: string; head: string; body: string }): string {
  for (const [name, slot] of Object.entries(SLOTS)) {
    const n = template.split(slot).length - 1;
    if (n !== 1) throw new Error(`index.html 자리표 ${name}(${slot}) 가 ${n}번 있다 — 꼭 한 번이어야 한다`);
  }
  if (!LANG_RE.test(page.lang)) throw new Error(`언어 이름이 이상하다: ${page.lang}`);
  // 함수로 바꿔 넣는다 — 글에 $& 같은 패턴이 있어도 그대로 들어가게
  return template
    .replace(SLOTS.lang, () => page.lang)
    .replace(SLOTS.head, () => page.head)
    .replace(SLOTS.body, () => page.body);
}
