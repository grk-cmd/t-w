import { describe, expect, it } from 'vitest';
import {
  CHAT_KEEP_PATH,
  chatKeepChanges,
  chatKeepDetail,
  effectiveKeep,
  parseChatKeep,
  parseKeepInput,
} from '@/entities/room';

describe('대화 보관 일수(config/chatKeepDays)', () => {
  it('서버 값 — 1~30 정수만, 나머지는 없는 것으로(함수 keepPolicy 와 같다)', () => {
    expect(
      parseChatKeep({ default: 2, secret: 1, workingroom: 0, togetherroom: 31, couple: 1.5, x: '3' }),
    ).toEqual({
      default: 2,
      secret: 1,
    });
    expect(parseChatKeep(null)).toEqual({});
  });

  it('입력 — 빈 칸은 지움(null) · 범위 밖은 undefined', () => {
    expect(parseKeepInput(' 1 ')).toBe(1);
    expect(parseKeepInput('')).toBeNull();
    expect(parseKeepInput('0')).toBeUndefined();
    expect(parseKeepInput('31')).toBeUndefined();
    expect(parseKeepInput('1.5')).toBeUndefined();
  });

  it('적용 값 — 종류 칸 → default → 3', () => {
    expect(effectiveKeep({}, 'secret')).toBe(3);
    expect(effectiveKeep({ default: 2 }, 'secret')).toBe(2);
    expect(effectiveKeep({ default: 2, secret: 1 }, 'secret')).toBe(1);
    expect(effectiveKeep({ secret: 1 }, 'default')).toBe(3);
  });

  it('바뀐 칸만 쓰고, 빈 칸은 지운다 · 기록 글', () => {
    const before = { workingroom: 3, secret: 2 };
    const u = chatKeepChanges(before, { workingroom: 3, secret: null, togetherroom: 1 });
    expect(u).toEqual({ [`${CHAT_KEEP_PATH}/secret`]: null, [`${CHAT_KEEP_PATH}/togetherroom`]: 1 });
    expect(chatKeepDetail(before, u)).toBe('투게더룸 기본 → 1일 · 시크릿룸 2 → 기본');
  });
});
