import { useMutation } from '@tanstack/react-query';
import { saveBugDailyMax, useRefreshBugDailyMax } from '@/entities/bug-board';
import {
  intGroupChanges,
  useOpsConfigPort,
  useRefreshOpsConfig,
  type IntGroup,
  type IntValues,
} from '@/entities/server/ops-config';
import { refreshOnConflict, useDb, type Versioned } from '@/shared/api';

/** Firebase 판 — `config/bugDailyMax` + RTDB 작업 기록(Firebase 판을 걷을 때 같이 걷는다). */
export function useSaveBugDailyMax() {
  const db = useDb();
  const refresh = useRefreshBugDailyMax();
  return useMutation({
    mutationFn: ({ max, before }: { max: number; before: number | null }) => saveBugDailyMax(db, max, before),
    onSuccess: refresh,
  });
}

/** API 판 — 서버 설정 키 `bug.dailyMax` 를 읽은 번호로 쓴다(작업 기록은 서버가 남긴다). 그 사이 바뀌었으면 다시 읽는다. */
export function useSaveServerBugDailyMax(group: IntGroup) {
  const port = useOpsConfigPort();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: ({ from, max }: { from: Versioned<IntValues>; max: number }) =>
      port.saveIntGroup(
        group,
        'settings.bugDailyMax',
        `하루 ${max}건`,
        from,
        intGroupChanges(group, from.value, { [group.fields[0].key]: max }),
      ),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
