import { describe, expect, it } from 'vitest';
import { reportReason, reportTargets } from '@/entities/report';
import { getUserBrief } from '@/entities/user';
import { fakeDb } from '../shared/fakeDb';

const rec = (ts: number, kind = 'away') => ({ kind, nick: 'n', code4: '1234', ts });

describe('신고 목록 집계', () => {
  it('서로 다른 3명 이상에게 신고된 사람만, 많은 순으로', () => {
    const rows = reportTargets({
      two: { a: rec(1), b: rec(2) },
      three: { a: rec(1), b: rec(3), c: rec(2) },
      four: { a: rec(1), b: rec(1), c: rec(1), d: rec(1) },
    });
    expect(rows.map((r) => r.target)).toEqual(['four', 'three']);
    expect(rows[1].reports.map((r) => r.ts)).toEqual([3, 2, 1]);
  });

  it('모양이 틀린 칸은 세지 않는다', () => {
    expect(reportTargets({ t: { a: rec(1), b: rec(2), c: 'junk', d: { nick: 'x' } } })).toEqual([]);
  });

  it('사유 글자 — 기타만 메모를 붙인다', () => {
    expect(reportReason({ kind: 'etc', note: '도배' })).toBe('기타 · 도배');
    expect(reportReason({ kind: 'nick', note: '무시' })).toBe('닉네임');
    expect(reportReason({ kind: '???' })).toBe('기타');
  });
});

describe('신고 대상 요약', () => {
  it('세 칸만 읽고, Storage 주소가 아닌 그림은 없는 것으로 본다', async () => {
    const { db } = fakeDb({
      'users/u1/profile/name': '가나',
      'users/u1/friendCode': 'MATE-AAAA',
      'users/u1/awayImg': 'data:image/png;base64,xx',
    });
    expect(await getUserBrief(db, 'u1')).toEqual({ name: '가나', friendCode: 'MATE-AAAA', awayImg: null });
  });
});
