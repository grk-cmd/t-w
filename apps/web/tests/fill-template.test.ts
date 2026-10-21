import { describe, expect, it } from 'vitest';
import { SLOTS, fillTemplate } from '@/shared/lib/html-template';

const T = `<html lang="${SLOTS.lang}"><head>${SLOTS.head}</head><body><div id="root">${SLOTS.body}</div></body></html>`;

describe('fillTemplate', () => {
  it('자리표 셋을 채운다', () => {
    const out = fillTemplate(T, { lang: 'en', head: '<title>t</title>', body: '<main>hi</main>' });
    expect(out).toBe(
      '<html lang="en"><head><title>t</title></head><body><div id="root"><main>hi</main></div></body></html>',
    );
  });

  it('글 속 $& · $1 같은 바꾸기 패턴을 그대로 둔다', () => {
    const out = fillTemplate(T, { lang: 'ko', head: '', body: '<p>$& $1 $$</p>' });
    expect(out).toContain('<p>$& $1 $$</p>');
  });

  it('자리표가 빠지거나 두 번이면 던진다(깨 보기)', () => {
    const page = { lang: 'ko', head: '', body: '' };
    for (const slot of Object.values(SLOTS)) {
      expect(() => fillTemplate(T.replace(slot, ''), page)).toThrow(/자리표/);
      expect(() => fillTemplate(T + slot, page)).toThrow(/자리표/);
    }
  });

  it('언어 이름이 이상하면 던진다', () => {
    for (const lang of ['', 'kor', 'k"o', '"><script>']) {
      expect(() => fillTemplate(T, { lang, head: '', body: '' })).toThrow(/언어/);
    }
  });
});
