import { describe, expect, it } from 'vitest';
import { checkBugReport, getBugReport, saveBugReport } from '@/entities/bug-report';
import { fakeDb, withoutAudits, NOW } from '../shared/fakeDb';

describe('버그 제보 탭', () => {
  it('공지 · 링크 · ts 를 쓴다 — 링크가 비어도 빈 문자열로 쓴다(앱과 같다)', async () => {
    const { db, writes } = fakeDb();
    await saveBugReport(db, ' 알려 주세요 ', ' https://open.kakao.com/x ');
    await saveBugReport(db, '알려 주세요', '');
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'bugReport/current', { notice: '알려 주세요', link: 'https://open.kakao.com/x', ts: NOW }],
      ['commit', 'bugReport/current', { notice: '알려 주세요', link: '', ts: NOW }],
    ]);
  });

  it('공지 600자 · 링크 300자로 자른다(규칙 한도)', async () => {
    const { db, writes } = fakeDb();
    await saveBugReport(db, 'a'.repeat(700), 'https://' + 'b'.repeat(400));
    const v = writes[0][2] as { notice: string; link: string };
    expect(v.notice).toHaveLength(600);
    expect(v.link).toHaveLength(300);
  });

  it('공지는 꼭, 링크는 비우거나 http(s) 로', () => {
    expect(checkBugReport('', '')).not.toBeNull();
    expect(checkBugReport('공지', 'open.kakao.com/x')).not.toBeNull();
    expect(checkBugReport('공지', 'javascript:alert(1)')).not.toBeNull();
    expect(checkBugReport('공지', '')).toBeNull();
    expect(checkBugReport('공지', 'HTTPS://open.kakao.com/x')).toBeNull();
  });

  it('현재 값은 bugReport/current 한 노드만 읽는다', async () => {
    const cur = { notice: 'n', link: '', ts: 1 };
    expect(await getBugReport(fakeDb({ 'bugReport/current': cur }).db)).toEqual(cur);
  });
});
