import { describe, expect, it } from 'vitest';
import {
  BANNED_WORD_MAX_LEN,
  BANNED_WORDS_PATH,
  bannedWordsDetail,
  parseBannedInput,
  parseBannedWords,
} from '@/entities/room';

describe('방 제목 금칙어(config/bannedWords)', () => {
  it('서버 값 — 배열 · {0:…} 모양을 받고 문자열 아닌 칸은 버린다', () => {
    expect(parseBannedWords(['욕', 3, '', '나쁜말'])).toEqual(['욕', '나쁜말']);
    expect(parseBannedWords({ 0: '가', 1: '나' })).toEqual(['가', '나']);
    expect(parseBannedWords(null)).toEqual([]);
    expect(parseBannedWords('욕')).toEqual([]);
    expect(BANNED_WORDS_PATH).toBe('config/bannedWords');
  });

  it('입력 — 줄 · 쉼표로 나누고 공백 걷고 겹침은 하나로', () => {
    expect(parseBannedInput(' 나쁜말 \n욕설, 나쁜말\n\n').words).toEqual(['나쁜말', '욕설']);
    expect(parseBannedInput('').words).toEqual([]);
  });

  it('입력 — 20자 넘는 낱말은 저장할 수 없다(규칙과 같은 상한)', () => {
    const r = parseBannedInput(
      ['가'.repeat(BANNED_WORD_MAX_LEN), '가'.repeat(BANNED_WORD_MAX_LEN + 1)].join('\n'),
    );
    expect(r.words).toEqual(['가'.repeat(BANNED_WORD_MAX_LEN)]);
    expect(r.tooLong).toEqual(['가'.repeat(BANNED_WORD_MAX_LEN + 1)]);
  });

  it('알림 — 숫자 · 기호만(걸리지 않음) · 한 글자(넓게 막음)', () => {
    const r = parseBannedInput('18\n!!\n욕\n욕 1\n나쁜말');
    expect(r.noLetter).toEqual(['18', '!!']);
    expect(r.oneLetter).toEqual(['욕', '욕 1']);
    expect(r.words).toEqual(['18', '!!', '욕', '욕 1', '나쁜말']);
  });

  it('기록 글 — 더함 · 뺌', () => {
    expect(bannedWordsDetail(['가', '나'], ['나', '다', '라'])).toBe('2개 → 3개 (더함 2 · 뺌 1)');
    expect(bannedWordsDetail([], [])).toBe('0개 → 0개 (더함 0 · 뺌 0)');
  });
});
