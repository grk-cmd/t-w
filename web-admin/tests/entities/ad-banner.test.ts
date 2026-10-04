import { describe, expect, it } from 'vitest';
import {
  buildSlides,
  getAdBanner,
  isPreviewable,
  saveAdBanner,
  slideProblem,
  toSlides,
} from '@/entities/ad-banner';
import { fakeDb } from '../shared/fakeDb';

describe('광고 배너', () => {
  it('DB 값: 배열이 아니면 없음, 이미지 없는 장은 뺀다', async () => {
    expect(toSlides(null)).toEqual([]);
    expect(toSlides({ img: 'https://a' })).toEqual([]);
    expect(toSlides([{ img: 'https://a' }, null, { link: 'https://b' }])).toEqual([
      { img: 'https://a', link: '' },
    ]);
    const { db } = fakeDb({ 'catalog/adBanner': [{ img: 'https://a', link: 'https://l' }] });
    expect(await getAdBanner(db)).toEqual([{ img: 'https://a', link: 'https://l' }]);
  });

  it('입력 → 배열: 공백 자르고 이미지 빈 칸은 건너뛰고 3장까지', () => {
    expect(
      buildSlides([
        { img: '', link: 'https://x' },
        { img: ' https://a ', link: ' ' },
        { img: 'https://b', link: 'https://l' },
        { img: 'https://c', link: '' },
      ]),
    ).toEqual([
      { img: 'https://a', link: '' },
      { img: 'https://b', link: 'https://l' },
      { img: 'https://c', link: '' },
    ]);
  });

  it('입력 검사: 이미지는 https, 링크는 비우거나 http(s)', () => {
    expect(slideProblem({ img: 'https://a/b.png', link: '' })).toBeNull();
    expect(slideProblem({ img: 'https://a/b.png', link: 'http://shop' })).toBeNull();
    expect(slideProblem({ img: 'http://a/b.png', link: '' })).not.toBeNull();
    expect(slideProblem({ img: 'https://a/b.png', link: 'javascript:alert(1)' })).not.toBeNull();
    expect(isPreviewable(' https://a/b.png ')).toBe(true);
    expect(isPreviewable('data:image/png;base64,xx')).toBe(false);
  });

  it('배열을 통째로 쓴다 — 앱과 같은 모양', async () => {
    const { db, writes } = fakeDb();
    await saveAdBanner(db, [{ img: 'https://a', link: '' }]);
    expect(writes).toEqual([['set', 'catalog/adBanner', [{ img: 'https://a', link: '' }]]]);
  });
});
