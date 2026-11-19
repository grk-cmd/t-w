import { describe, expect, it } from 'vitest';
import { createFirebaseRoomPort } from '@/entities/room/api/firebase';
import {
  BANNED_WORD_MAX_LEN,
  BANNED_WORDS_MAX,
  bannedWordsDetail,
  bannedWordsProblem,
  parseBannedInput,
} from '@/entities/room';
import { fakeDb } from '../shared/fakeDb';

describe('방 제목 금칙어 — 입력 · 확인(서버 키 room.bannedWords 와 같은 상한)', () => {
  it('입력 — 줄 · 쉼표로 나누고 공백 걷고 겹침은 하나로', () => {
    expect(parseBannedInput(' 나쁜말 \n욕설, 나쁜말\n\n').words).toEqual(['나쁜말', '욕설']);
    expect(parseBannedInput('').words).toEqual([]);
  });

  it('입력 — 20자 넘는 낱말은 저장할 수 없다', () => {
    const r = parseBannedInput(
      ['가'.repeat(BANNED_WORD_MAX_LEN), '가'.repeat(BANNED_WORD_MAX_LEN + 1)].join('\n'),
    );
    expect(r.words).toEqual(['가'.repeat(BANNED_WORD_MAX_LEN)]);
    expect(r.tooLong).toEqual(['가'.repeat(BANNED_WORD_MAX_LEN + 1)]);
    expect(bannedWordsProblem(r, [])).toBe(`20자를 넘는 낱말: ${'가'.repeat(21)}`);
  });

  it('확인 — 500개를 넘으면 · 지금 값과 같으면 저장하지 않는다 · 빈 목록 저장은 된다', () => {
    const many = Array.from({ length: BANNED_WORDS_MAX + 1 }, (_, i) => `낱말${i}`).join('\n');
    expect(bannedWordsProblem(parseBannedInput(many), [])).toBe('500개까지 넣을 수 있어요 (지금 501개)');
    const exact = Array.from({ length: BANNED_WORDS_MAX }, (_, i) => `낱말${i}`).join('\n');
    expect(bannedWordsProblem(parseBannedInput(exact), [])).toBeNull();
    expect(bannedWordsProblem(parseBannedInput('가나\n다라'), ['가나', '다라'])).toBe('지금 값과 같음');
    expect(bannedWordsProblem(parseBannedInput(''), ['가나'])).toBeNull();
  });

  it('알림 — 숫자 · 기호만(걸리지 않음) · 한 글자(넓게 막음)', () => {
    const r = parseBannedInput('18\n!!\n욕\n욕 1\n나쁜말');
    expect(r.noLetter).toEqual(['18', '!!']);
    expect(r.oneLetter).toEqual(['욕', '욕 1']);
    expect(r.words).toEqual(['18', '!!', '욕', '욕 1', '나쁜말']);
  });

  it('알림은 realtime 판정과 같은 뜻 — NFKC · 소문자 · 글자 단위로 센다', () => {
    const r = parseBannedInput('Ⓐ\n㈜\nﬀ\n𠀀');
    expect(r.noLetter).toEqual([]);
    expect(r.oneLetter).toEqual(['Ⓐ', '㈜', '𠀀']);
  });

  it('확인 창 글 — 더함 · 뺌', () => {
    expect(bannedWordsDetail(['가', '나'], ['나', '다', '라'])).toBe('2개 → 3개 (더함 2 · 뺌 1)');
    expect(bannedWordsDetail([], [])).toBe('0개 → 0개 (더함 0 · 뺌 0)');
  });

  it('Firebase 판에는 없다 — 설정 화면이 카드를 그리지 않는다', () => {
    expect(createFirebaseRoomPort(fakeDb({}).db, null).bannedWords).toBeNull();
  });
});
