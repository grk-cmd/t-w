import { describe, expect, it } from 'vitest';
import {
  answerNoticeBody,
  answerWrite,
  bugNo,
  bugNoLabel,
  BUG_DAILY_MAX_DEFAULT,
  BUG_NO_RE,
  getBugDailyMax,
  isStaffPost,
  parseBugDailyMax,
  saveBugDailyMax,
  BUG_PRV_NOTICE_BODY,
  checkAnswer,
  dayOrder,
  deleteWrite,
  getBugPost,
  getDayOrder,
  listBugPage,
  shortNo,
  statusWrite,
  toBugItem,
  toBugPage,
  type BugItem,
} from '@/entities/bug-board';
import { kstDayStart } from '@/shared/lib';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const DAY = kstDayStart('2026-10-08');
const row = (ts: number, extra: Record<string, unknown> = {}) => ({
  vis: 'pub',
  status: 'new',
  cat: 'bug',
  name: '가나',
  authUid: 'uid1',
  code: 'u1',
  ts,
  openTs: ts,
  title: '제목',
  ...extra,
});
const item = (extra: Partial<BugItem> = {}): BugItem => ({
  ...(toBugItem('p1', row(DAY + 1000)) as BugItem),
  ...extra,
});

describe('하루 상한 · 운영진 글', () => {
  it('상한 입력 — 1~100 정수만', () => {
    expect(parseBugDailyMax(' 7 ')).toBe(7);
    expect(parseBugDailyMax('100')).toBe(100);
    for (const bad of ['0', '101', '2.5', '-1', 'x', '']) expect(parseBugDailyMax(bad)).toBeNull();
    expect(BUG_DAILY_MAX_DEFAULT).toBe(5);
  });

  it('상한 읽기 · 저장 — config/bugDailyMax 한 칸 + 작업 기록(이전 → 다음)', async () => {
    const { db, writes } = fakeDb({ 'config/bugDailyMax': 3 });
    expect(await getBugDailyMax(db)).toBe(3);
    expect(await getBugDailyMax(fakeDb({ 'config/bugDailyMax': '3' }).db)).toBeNull();
    await saveBugDailyMax(db, 8, null);
    expect(withoutAudits(writes)).toEqual([['commit', 'config/bugDailyMax', 8]]);
    expect(auditsOf(writes)[0]).toMatchObject({
      action: 'settings.bugDailyMax',
      target: '하루 8건',
      detail: '기본 5 → 8',
    });
  });

  it('🛡 — byAdmin(관리자만 쓰는 칸) 또는 공지일 때만, 이름은 보지 않는다', () => {
    expect(isStaffPost(toBugItem('p1', row(DAY, { byAdmin: true })) as BugItem)).toBe(true);
    expect(isStaffPost(toBugItem('p1', row(DAY, { byAdmin: 'yes', name: '운영자' })) as BugItem)).toBe(false);
    expect(isStaffPost(toBugItem('p1', row(DAY, { notice: true })) as BugItem)).toBe(true);
  });
});

describe('고정 번호', () => {
  it('저장된 no 가 있으면 그것, 없으면 임시 번호 — 기록용 이름엔 «(임시)»', () => {
    const fixed = bugNo({ ts: DAY + 5, no: 'B-1008-7' }, 2);
    expect(fixed).toEqual({ no: 'B-1008-7', temp: false });
    expect(bugNoLabel(fixed)).toBe('B-1008-7');
    const temp = bugNo({ ts: DAY + 5 }, 2);
    expect(temp).toEqual({ no: 'B-1008-2', temp: true });
    expect(bugNoLabel(temp)).toBe('B-1008-2(임시)');
  });

  it('목록 줄의 no 는 모양이 맞을 때만 읽는다', () => {
    expect(toBugItem('p1', row(DAY, { no: 'B-1008-12' }))?.no).toBe('B-1008-12');
    expect(toBugItem('p1', row(DAY, { no: 'B-10-1' }))?.no).toBeUndefined();
    expect(toBugItem('p1', row(DAY, { no: 3 }))?.no).toBeUndefined();
    expect(toBugItem('p1', row(DAY))?.no).toBeUndefined();
    expect(BUG_NO_RE.test('B-1009-1') && !BUG_NO_RE.test('B-1009-12345')).toBe(true);
  });

  it('지우기 — 목록 · 내용(공개/비공개 자리) · 답변 둘 · 공감, 카운터는 건드리지 않는다', () => {
    expect(deleteWrite(item())).toEqual({
      'bugBoard/list/p1': null,
      'bugBoard/pub/p1': null,
      'bugBoard/ans/pub/p1': null,
      'bugBoard/ans/prv/p1': null,
      'bugBoard/likes/p1': null,
    });
    const prv = deleteWrite(item({ vis: 'prv' }));
    expect(prv).toHaveProperty(['bugBoard/prv/uid1/p1'], null);
    expect(prv).not.toHaveProperty(['bugBoard/pub/p1']);
    expect(Object.keys(prv).some((p) => p.startsWith('bugBoard/seq'))).toBe(false);
  });
});

describe('짧은 번호', () => {
  it('B-MMDD-n — 서울 날짜, 순번은 그날 ts 순(같으면 키 순)', () => {
    const order = dayOrder({ c: { ts: 30 }, a: { ts: 10 }, b: { ts: 10 }, bad: { x: 1 } });
    expect([...order]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(shortNo(DAY + 5, 3)).toBe('B-1008-3');
    // 서울 자정 직전(UTC 로는 전날 낮)도 서울 날짜로
    expect(shortNo(DAY - 1, 1)).toBe('B-1007-1');
    expect(shortNo(DAY, undefined)).toBe('B-1008-?');
  });

  it('그날 것만 받아 센다 — 하루가 20개를 넘으면 거슬러 이어 받는다', async () => {
    const list: Record<string, unknown> = { prev: row(DAY - 1), next: row(DAY + 86_400_000) };
    for (let i = 0; i < 25; i++) list[`k${String(i).padStart(2, '0')}`] = row(DAY + 1000 + (i % 5));
    const { db } = fakeDb({ 'bugBoard/list': list });
    const asked: unknown[] = [];
    const getLast = db.getLast;
    db.getLast = (path, child, n, range) => (asked.push([child, n, range]), getLast(path, child, n, range));
    const order = await getDayOrder(db, '2026-10-08');
    expect(order.size).toBe(25);
    expect(order.has('prev') || order.has('next')).toBe(false);
    expect(order.get('k00')).toBe(1); // ts 1000 · 키 순 맨 앞
    expect(order.get('k24')).toBe(25); // ts 1004 · 키 순 맨 뒤
    expect(asked).toHaveLength(2);
    expect(asked.every((a) => (a as [string, number])[0] === 'ts' && (a as [string, number])[1] <= 20)).toBe(
      true,
    );
  });
});

describe('목록 한 쪽', () => {
  it('꽉 찼는지는 거르기 전 개수로 — 공지 · 모양이 틀린 줄이 섞여도 [다음] 이 남는다', () => {
    const raw: Record<string, unknown> = {};
    for (let i = 0; i < 18; i++) raw[`p${i}`] = row(DAY + i);
    raw.n1 = row(DAY + 100, { notice: true, nts: DAY + 100 });
    raw.junk = { ts: DAY + 50 }; // vis 없음 — 보여 주진 않지만 쪽은 꽉 찬 것
    const page = toBugPage(raw, 'ts', 20);
    expect(page.items).toHaveLength(19);
    expect(page.items[0].id).toBe('n1');
    expect(page.next).toEqual({ value: DAY, key: 'p0' });
  });

  it('정렬 칸이 없는 줄이 섞였으면 그 칸이 있는 줄은 다 받은 것 — 다음 없음', () => {
    const raw: Record<string, unknown> = {};
    for (let i = 0; i < 19; i++) raw[`p${i}`] = row(DAY + i);
    raw.done = row(DAY - 5, { status: 'fixed', openTs: undefined });
    const page = toBugPage(raw, 'openTs', 20);
    expect(page.items).toHaveLength(19);
    expect(page.next).toBeNull();
  });

  it('덜 찬 쪽은 다음 없음', () => {
    expect(toBugPage({ a: row(DAY) }, 'ts', 20).next).toBeNull();
  });

  it('[다음] 은 (값, 키) 뒤부터 — 같은 시각이 경계에 걸려도 빠지거나 겹치지 않는다', async () => {
    const list: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) list[`k${String(i).padStart(2, '0')}`] = row(DAY + Math.floor(i / 10));
    const { db } = fakeDb({ 'bugBoard/list': list });
    const first = await listBugPage(db, 'all', null);
    const second = await listBugPage(db, 'all', first.next);
    const ids = [...first.items, ...second.items].map((it) => it.id);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(10);
    expect(new Set(ids).size).toBe(30);
    expect(second.next).toBeNull();
  });
});

describe('상태 · 답변 쓰기 — 앱 addAnswer 와 같은 칸', () => {
  it('미해결로 바꾸면 openTs = ts, 끝내면 openTs 지움 · 공지는 늘 없음', () => {
    const it1 = item({ status: 'fixed', openTs: undefined });
    expect(statusWrite(it1, 'checking')).toEqual({
      'bugBoard/list/p1/status': 'checking',
      'bugBoard/list/p1/openTs': it1.ts,
    });
    expect(statusWrite(item(), 'norepro')).toEqual({
      'bugBoard/list/p1/status': 'norepro',
      'bugBoard/list/p1/openTs': null,
    });
    expect(statusWrite(item({ notice: true }), 'new')['bugBoard/list/p1/openTs']).toBeNull();
  });

  it('답변 — ans · status · lastReplyTs · ansN+1 · openTs 를 한 묶음으로, 비공개 글은 비공개 답변만', () => {
    const w = answerWrite(item({ ansN: 2 }), { text: ' 고쳤어요 ', vis: 'pub', status: 'fixed' }, 'r1', NOW);
    expect(w).toEqual({
      'bugBoard/ans/pub/p1/r1': { text: '고쳤어요', ts: NOW },
      'bugBoard/list/p1/status': 'fixed',
      'bugBoard/list/p1/openTs': null,
      'bugBoard/list/p1/lastReplyTs': NOW,
      'bugBoard/list/p1/ansN': 3,
    });
    const p = answerWrite(
      item({ vis: 'prv', title: undefined }),
      { text: '확인 중', vis: 'pub', kakao: 'https://open.kakao.com/o/x' },
      'r2',
      NOW,
    );
    expect(p['bugBoard/ans/prv/p1/r2']).toEqual({
      text: '확인 중',
      ts: NOW,
      kakao: 'https://open.kakao.com/o/x',
    });
    expect(p['bugBoard/list/p1/status']).toBe('new');
    expect(p['bugBoard/list/p1/openTs']).toBe(DAY + 1000);
    expect(p['bugBoard/list/p1/ansN']).toBe(1);
  });

  it('입력 확인 — 빈 답변 · 카카오 아닌 링크', () => {
    expect(checkAnswer({ text: '  ' })).toBe('답변 내용 필요');
    expect(checkAnswer({ text: 'a', kakao: 'https://evil.example/' })).toMatch(/open\.kakao\.com/);
    expect(checkAnswer({ text: 'a', kakao: 'http://open.kakao.com/o/x' })).not.toBeNull();
    expect(checkAnswer({ text: 'a', kakao: 'https://open.kakao.com/o/x' })).toBeNull();
    expect(checkAnswer({ text: 'a', kakao: '' })).toBeNull();
  });
});

describe('답변 알림 본문', () => {
  it('비공개 글은 제목 없이 고정 문구만 — 우편함은 누구나 읽는다', () => {
    expect(answerNoticeBody('prv', '비밀 제목', false)).toBe(BUG_PRV_NOTICE_BODY);
    expect(answerNoticeBody('prv', '비밀 제목', true)).not.toContain('비밀 제목');
    expect(answerNoticeBody('pub', '공개 제목', true)).toBe('공개 제목\n💬 오픈카톡 연결이 함께 왔어요');
  });
});

describe('상세', () => {
  it('비공개 글은 prv/{authUid} 에서 내용, 공개 답변 칸은 읽지 않는다', async () => {
    const { db } = fakeDb({
      'bugBoard/list/p1': row(DAY, { vis: 'prv', title: undefined }),
      'bugBoard/prv/uid1/p1': { title: '비밀', body: '본문' },
      'bugBoard/ans/prv/p1': { r2: { text: '둘', ts: 2 }, r1: { text: '하나', ts: 1 } },
    });
    const asked: string[] = [];
    const get = db.get;
    db.get = (path) => (asked.push(path), get(path));
    const post = await getBugPost(db, 'p1');
    expect(post?.content).toEqual({ title: '비밀', body: '본문' });
    expect(post?.answers.map((a) => a.text)).toEqual(['하나', '둘']);
    expect(asked).not.toContain('bugBoard/ans/pub/p1');
  });
});
