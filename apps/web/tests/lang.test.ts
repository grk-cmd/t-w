import { describe, expect, it } from 'vitest';
import { DEFAULT_LANG, LANGS, isLang, langFromPath, messagesFor, pathFor } from '@/shared/i18n';

describe('언어 · 주소', () => {
  it('기본 언어는 맨 앞, 나머지는 /언어/', () => {
    expect(pathFor('ko')).toBe('/');
    expect(pathFor('en')).toBe('/en/');
    expect(pathFor('ja')).toBe('/ja/');
  });

  it('주소 → 언어 → 주소가 되돌아온다', () => {
    for (const l of LANGS) expect(langFromPath(pathFor(l))).toBe(l);
  });

  it('언어가 아닌 첫 마디 · 빈 경로 · 기본 언어 경로는 기본 언어', () => {
    for (const p of ['', '/', '/fr/', '/ko/', '/EN/', '/en', 'en', '/admin/']) {
      const want = p === '/en' || p === 'en' ? 'en' : DEFAULT_LANG;
      expect(langFromPath(p)).toBe(want);
    }
  });

  it('isLang 은 아는 이름만', () => {
    expect(LANGS.every(isLang)).toBe(true);
    for (const v of ['', 'KO', 'fr', null, undefined, 1, {}]) expect(isLang(v)).toBe(false);
  });
});

describe('화면 글', () => {
  it('언어마다 빈 칸이 없다', () => {
    for (const l of LANGS) {
      const m = messagesFor(l);
      for (const [k, v] of Object.entries(m)) {
        if (typeof v === 'string') expect(v.trim(), `${l}.${k}`).not.toBe('');
      }
      for (const f of m.features)
        for (const v of Object.values(f)) expect(v.trim(), `${l}.features`).not.toBe('');
    }
  });

  it('기능 목록은 언어마다 같은 수 · 같은 아이콘 차례', () => {
    const icons = (l: (typeof LANGS)[number]) => messagesFor(l).features.map((f) => f.icon);
    for (const l of LANGS) expect(icons(l)).toEqual(icons(DEFAULT_LANG));
  });

  it('영어 · 일본어 글에 한글이 섞이지 않았다(번역 빠짐)', () => {
    const hangul = /[가-힣]/;
    for (const l of LANGS.filter((x) => x !== 'ko')) {
      const all = JSON.stringify(messagesFor(l));
      expect(hangul.test(all), l).toBe(false);
    }
  });
});
