import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { userInviteQuery } from '@/entities/invite';
import { userPresenceQuery, type UserRow } from '@/entities/user';
import { useDb } from '@/shared/api';
import type { PeriodField } from './filter';

// 사람마다 작은 칸 하나라 20명씩 함께 읽는다 — 목록 칸과 같은 캐시라 이미 본 사람은 다시 받지 않는다.
const CHUNK = 20;

export interface PeriodTimes {
  /** 사용자코드 → 시각. 다 읽기 전에는 null. */
  times: Map<string, number | null> | null;
  progress: { done: number; total: number } | null;
}

/**
 * 기간 검색에 쓸 시각을 rows 전원 몫 읽는다. 검색 버튼을 눌렀을 때만(rows 가 바뀔 때만) 돈다.
 * 계정 요약에는 이 두 시각이 없어 사람마다 읽어야 한다.
 */
export function usePeriodTimes(rows: UserRow[] | null, field: PeriodField): PeriodTimes {
  const db = useDb();
  const client = useQueryClient();
  // 어느 요청(rows · field)의 결과인지 같이 둔다 — 요청이 바뀌면 렌더에서 «읽는 중» 으로 본다.
  const [state, setState] = useState<{ rows: UserRow[]; field: PeriodField } & PeriodTimes>();

  useEffect(() => {
    if (!rows) return;
    let cancelled = false;
    const times = new Map<string, number | null>();
    const report = (done: boolean) =>
      !cancelled &&
      setState({
        rows,
        field,
        times: done ? times : null,
        progress: done ? null : { done: times.size, total: rows.length },
      });
    (async () => {
      for (let i = 0; i < rows.length && !cancelled; i += CHUNK) {
        await Promise.all(
          rows.slice(i, i + CHUNK).map(async ({ userCode }) => {
            try {
              const t =
                field === 'joined'
                  ? (await client.fetchQuery(userInviteQuery(db, userCode)))?.joinedAt
                  : (await client.fetchQuery(userPresenceQuery(db, userCode)))?.lastSeen;
              times.set(userCode, t ?? null);
            } catch {
              times.set(userCode, null);
            }
          }),
        );
        report(false);
      }
      report(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, field, db, client]);

  if (!rows) return { times: null, progress: null };
  if (state?.rows !== rows || state.field !== field)
    return { times: null, progress: { done: 0, total: rows.length } };
  return { times: state.times, progress: state.progress };
}
