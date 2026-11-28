import { describe, expect, it } from 'vitest';
import {
  endsEdit,
  isStaleNewsError,
  STALE_EDIT_TEXT,
  STALE_LIST_TEXT,
  staleNewsText,
} from '@/features/notice/edit-site-news';
import { PortError } from '@/shared/api';

const conflict = new PortError('conflict', '먼저 고침', 'CONCURRENT_UPDATE');
const gone = new PortError('notFound', '없음', 'SITE_NEWS_NOT_FOUND');
const down = new PortError('unreachable', '연결 안 됨');

describe('홈페이지 소식 카드 — 쓰기가 실패했을 때 쓰던 폼', () => {
  it('옛 판 실패는 409 · 404 뿐', () => {
    expect(isStaleNewsError(conflict)).toBe(true);
    expect(isStaleNewsError(gone)).toBe(true);
    expect(isStaleNewsError(down)).toBe(false);
    expect(isStaleNewsError(new Error('x'))).toBe(false);
  });

  it('지금 고치는 그 글이 옛 판으로 실패했을 때만 폼을 비운다', () => {
    expect(endsEdit('a', 'a', conflict)).toBe(true);
    expect(endsEdit('a', 'a', gone)).toBe(true);
    expect(endsEdit('a', 'a', down)).toBe(false); // 연결 실패면 쓰던 것을 지키고 다시 누르게
  });

  it('다른 글을 내리다 실패해도 쓰던 글(새 글 · 다른 글 고치기)은 그대로', () => {
    expect(endsEdit('a', 'b', conflict)).toBe(false);
    expect(endsEdit(null, 'b', gone)).toBe(false);
  });

  it('옛 판 글: 고치던 글이 닫혔으면 «다시 열어 주세요» · 다른 글(내리기)이면 «확인하고 다시»', () => {
    expect(staleNewsText(endsEdit('a', 'a', conflict))).toBe(STALE_EDIT_TEXT);
    expect(staleNewsText(endsEdit('a', 'b', conflict))).toBe(STALE_LIST_TEXT);
    expect(staleNewsText(endsEdit(null, 'b', gone))).toBe(STALE_LIST_TEXT);
    expect(STALE_LIST_TEXT).not.toContain('[고치기]');
  });
});
