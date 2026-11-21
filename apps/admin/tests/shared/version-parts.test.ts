import { describe, expect, it } from 'vitest';
import { releaseFromParts } from '@/entities/admin/todo';
import { cleanVersionPart, joinVersionParts, toVersionParts, versionPartsFilled } from '@/shared/lib';

describe('버전 세 칸 (shared/lib versionParts)', () => {
  it('나누기 — 꼬리 · v 접두 · 빈 값', () => {
    expect(toVersionParts('0.11.3')).toEqual({ parts: ['0', '11', '3'], tail: '' });
    expect(toVersionParts('0.12.0-beta.1')).toEqual({ parts: ['0', '12', '0'], tail: '-beta.1' });
    expect(toVersionParts('v1.2.3')).toEqual({ parts: ['1', '2', '3'], tail: '' });
    expect(toVersionParts('')).toEqual({ parts: ['', '', ''], tail: '' });
    expect(toVersionParts(null, '0')).toEqual({ parts: ['0', '0', '0'], tail: '' });
    expect(toVersionParts('0.11', '0').parts).toEqual(['0', '11', '0']);
  });

  it('칸 글자 — 숫자만 네 자리까지', () => {
    expect(cleanVersionPart('1a2-')).toBe('12');
    expect(cleanVersionPart('123456')).toBe('1234');
    expect(cleanVersionPart('')).toBe('');
  });

  it('찬 정도 · 잇기 — 빈 칸을 0 으로 보지 않는다', () => {
    expect(versionPartsFilled(['', '', ''])).toBe('none');
    expect(versionPartsFilled(['0', '', '3'])).toBe('some');
    expect(versionPartsFilled(['0', '0', '0'])).toBe('all');
    expect(joinVersionParts(['0', '', '3'])).toBeNull();
    expect(joinVersionParts(['00', '011', '3'])).toBe('0.11.3');
  });
});

describe('할 일 릴리스 버전 입력 (releaseFromParts)', () => {
  it('모두 빈 칸이면 «버전 없음»', () => {
    expect(releaseFromParts(['', '', ''])).toEqual({ release: '' });
    expect(releaseFromParts(['', '', ''], '-beta.1')).toEqual({ release: '' });
  });

  it('일부만 차 있으면 안내 — 0 으로 채우지 않는다', () => {
    expect(releaseFromParts(['0', '11', ''])).toEqual({ error: expect.stringMatching(/세 칸/) });
    expect(releaseFromParts(['', '', '3'])).toHaveProperty('error');
  });

  it('세 칸 다 차면 버전 · 베타 꼬리는 그대로 붙인다', () => {
    expect(releaseFromParts(['0', '11', '3'])).toEqual({ release: '0.11.3' });
    expect(releaseFromParts(['0', '12', '0'], '-beta.1')).toEqual({ release: '0.12.0-beta.1' });
    expect(releaseFromParts(['0', '011', '03'])).toEqual({ release: '0.11.3' });
  });

  it('나눴다 다시 이으면 같은 값', () => {
    for (const v of ['0.11.3', '0.12.0-beta.1', '10.0.12']) {
      const { parts, tail } = toVersionParts(v);
      expect(releaseFromParts(parts, tail)).toEqual({ release: v });
    }
  });
});
