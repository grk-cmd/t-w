import { describe, expect, it } from 'vitest';
import {
  addMonths,
  expireSecretRoom,
  formatDay,
  genSecretCode,
  issueSecretRoom,
  overwriteWarning,
  parseMonths,
  parseWantCode,
  periodText,
  planExpiry,
  staleReason,
} from '@/entities/secret-room';
import { fakeDb } from '../shared/fakeDb';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();
const DAY = 86_400_000;

describe('시크릿룸 — 기간 계산', () => {
  it('개월은 달력으로 더하고, 없는 날은 말일로 당기고, 그날 23:59:59 까지', () => {
    expect(formatDay(addMonths(at(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(formatDay(addMonths(at(2028, 1, 31), 1))).toBe('2028-02-29');
    expect(formatDay(addMonths(at(2026, 11, 15), 3))).toBe('2027-02-15');
    const end = new Date(addMonths(at(2026, 3, 10), 1));
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59]);
  });

  it('개월 수: 빈칸은 영구, 숫자 아닌 값 · 범위 밖은 막는다', () => {
    expect(parseMonths('  ')).toEqual({ ok: true, months: 0 });
    expect(parseMonths('6')).toEqual({ ok: true, months: 6 });
    expect(parseMonths('3개월').ok).toBe(false);
    expect(parseMonths('0').ok).toBe(false);
    expect(parseMonths('121').ok).toBe(false);
  });

  it('원하는 코드: 영문 · 숫자만 남겨 4자리', () => {
    expect(parseWantCode(' ab-12 ')).toEqual({ ok: true, want: 'AB12' });
    expect(parseWantCode('')).toEqual({ ok: true, want: '' });
    expect(parseWantCode('ABC').ok).toBe(false);
  });

  it('자동 코드는 SCRT- + 헷갈리는 글자 없는 4자리', () => {
    expect(genSecretCode()).toMatch(/^SCRT-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('같은 사람 · 남은 기간이 있으면 이어붙인다', () => {
    const now = at(2026, 5, 1);
    const prev = { owner: 'u1', ts: 0, exp: at(2026, 7, 10) };
    const r = planExpiry(prev, 'u1', 3, now);
    expect(r.mode).toBe('extend');
    expect(formatDay(r.expMs)).toBe('2026-10-10');
  });

  it('영구였는데 개월을 넣으면 지금부터 기간제, 비우면 영구 그대로', () => {
    const now = at(2026, 5, 1);
    const perm = { owner: 'u1', ts: 0 };
    expect(planExpiry(perm, 'u1', 2, now)).toEqual({ expMs: addMonths(now, 2), mode: 'perm-to-term' });
    expect(planExpiry(perm, 'u1', 0, now)).toEqual({ expMs: 0, mode: 'new' });
  });

  it('이미 만료됐거나 주인이 다르면 지금부터 센다', () => {
    const now = at(2026, 5, 1);
    expect(planExpiry({ owner: 'u1', ts: 0, exp: now - DAY }, 'u1', 1, now)).toEqual({
      expMs: addMonths(now, 1),
      mode: 'new',
    });
    expect(planExpiry({ owner: 'u2', ts: 0, exp: now + DAY }, 'u1', 1, now).mode).toBe('new');
  });

  it('기간 문구', () => {
    expect(periodText(0, 0, 'new')).toBe('영구');
    expect(periodText(1, at(2026, 6, 1), 'extend')).toBe('1개월 · 2026-06-01 까지 · 남은 기간에 이어붙임');
  });
});

describe('시크릿룸 — 확인 게이트', () => {
  const now = at(2026, 5, 10);

  it('접속 기록이 없거나 7일 넘게 없으면 의심', () => {
    expect(staleReason(null, 'MATE-AB12', 'MATE-AB12', now)).toBe('접속 기록이 없어요');
    expect(staleReason(now - 8 * DAY, 'MATE-AB12', 'MATE-AB12', now)).toBe('8일째 접속이 없어요');
    expect(staleReason(now - DAY, 'mate-ab12', 'MATE-AB12', now)).toBeNull();
  });

  it('계정에 적힌 친구코드가 다르거나 없으면 의심, 읽지 못했으면 넘어간다', () => {
    expect(staleReason(now, 'COZY-ZZ99', 'MATE-AB12', now)).toMatch(/COZY-ZZ99/);
    expect(staleReason(now, null, 'MATE-AB12', now)).toMatch(/\(없음\)/);
    expect(staleReason(now, undefined, 'MATE-AB12', now)).toBeNull();
  });

  it('이미 발급된 코드 — 남에게면 덮어쓰기, 내 것이면 연장 · 재시작 · 영구 해제', () => {
    expect(overwriteWarning('SCRT-AB12', { owner: 'u2', ts: 0 }, 'u1', 1, now)).toMatch(
      /다른 사람에게 덮어씁니다/,
    );
    expect(overwriteWarning('SCRT-AB12', { owner: 'u1', ts: 0, exp: now + DAY }, 'u1', 1, now)).toMatch(
      /남은 기간에 이어붙입니다/,
    );
    expect(overwriteWarning('SCRT-AB12', { owner: 'u1', ts: 0, exp: now - DAY }, 'u1', 1, now)).toMatch(
      /이미 만료.*지금부터 다시/,
    );
    expect(overwriteWarning('SCRT-AB12', { owner: 'u1', ts: 0 }, 'u1', 3, now)).toMatch(
      /영구가 풀리고 .*3개월/,
    );
    expect(overwriteWarning('SCRT-AB12', { owner: 'u1', ts: 0 }, 'u1', 0, now)).toMatch(/영구를 그대로/);
  });
});

describe('시크릿룸 — 쓰기 모양', () => {
  it('발급은 노드를 통째로 — 열쇠 k 와 pub(owner · name 20자 · ts · exp)', async () => {
    const { db, writes } = fakeDb();
    await issueSecretRoom(db, 'SCRT-AB12', { uid: 'u1', name: '가'.repeat(30) }, 'KEY', 1234.7, 99);
    await issueSecretRoom(db, 'SCRT-CD34', { uid: 'u1', name: '' }, 'KEY', 0, 99);
    expect(writes).toEqual([
      [
        'set',
        'secretRooms/SCRT-AB12',
        { k: 'KEY', pub: { owner: 'u1', name: '가'.repeat(20), ts: 99, exp: 1234 } },
      ],
      ['set', 'secretRooms/SCRT-CD34', { k: 'KEY', pub: { owner: 'u1', name: '', ts: 99 } }],
    ]);
  });

  it('만료는 기존 pub 을 그대로 두고 exp 만 1초 전으로', async () => {
    const pub = { owner: 'u1', name: '철수', ts: 5 };
    const { db, writes } = fakeDb({ 'secretRooms/SCRT-AB12/pub': pub });
    expect(await expireSecretRoom(db, 'SCRT-AB12', 'KEY', 10_000)).toBe(true);
    expect(writes).toEqual([['set', 'secretRooms/SCRT-AB12', { k: 'KEY', pub: { ...pub, exp: 9_000 } }]]);
    expect(await expireSecretRoom(db, 'SCRT-NONE', 'KEY')).toBe(false);
  });
});
