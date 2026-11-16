import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { forgetReports } from '@/entities/report/api/hooks';
import { REPORTS_KEY } from '@/entities/report/api/keys';
import type { ReportTarget } from '@/entities/report';

const row = (target: string): ReportTarget => ({ target, reports: [] });

describe('신고 처리 뒤 목록 잊기', () => {
  it('여러 명을 한꺼번에 «문제없음» 해도 키셋 목록은 한 번만 다시 받는다 · 통째 목록은 그 사람들만 뺀다', () => {
    const client = new QueryClient();
    client.setQueryData([...REPORTS_KEY, 'all'], [row('a'), row('b'), row('c'), row('d')]);
    const reset = vi.spyOn(client, 'resetQueries');
    forgetReports(client, ['a', 'c', 'd']);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(client.getQueryData<ReportTarget[]>([...REPORTS_KEY, 'all'])?.map((t) => t.target)).toEqual(['b']);
  });

  it('처리한 사람이 없으면 아무것도 다시 받지 않는다', () => {
    const client = new QueryClient();
    const reset = vi.spyOn(client, 'resetQueries');
    forgetReports(client, []);
    expect(reset).not.toHaveBeenCalled();
  });
});
