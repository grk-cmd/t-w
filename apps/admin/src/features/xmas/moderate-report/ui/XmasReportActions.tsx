import type { XmasReport } from '@/entities/seasonal/xmas-event';
import { ApiError } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDismissXmasReport, useRemoveReported } from '../model/useModerateXmas';

/** [지우기](장식 · 받은 편지) · [문제없음](신고만 비움). 처리한 줄은 목록에서 빠진다. version = 상세에서 본 장식의 판(없으면 null — 이미 없는 장식). */
export function XmasReportActions({ report, version }: { report: XmasReport; version: number | null }) {
  const toast = useToast();
  const remove = useRemoveReported();
  const dismiss = useDismissXmasReport();
  const busy = remove.isPending || dismiss.isPending;
  const what = report.kind === 'orn' ? '장식' : '받은 편지';

  const onRemove = async () => {
    const more =
      report.kind === 'orn' ? ' 건 사람은 다시 걸 수 있어요.' : ' 받은 사람의 편지함에서 사라져요.';
    if (!confirm(`이 ${what}을(를) 지울까요?${more} 되돌릴 수 없어요.`)) return;
    try {
      await remove.mutateAsync({ report, version });
      toast(`${what}을(를) 지웠어요`);
    } catch (e) {
      toast(
        e instanceof ApiError && e.code === 'CONCURRENT_UPDATE'
          ? '그새 바뀐 장식이에요 — 새로고침해서 다시 봐 주세요'
          : errorMessage(e, '지우지 못했어요'),
      );
    }
  };
  const onDismiss = async () => {
    if (!confirm('이 신고를 문제없음으로 비울까요?')) return;
    try {
      await dismiss.mutateAsync(report.key);
      toast('신고를 비웠어요');
    } catch (e) {
      toast(errorMessage(e, '비우지 못했어요'));
    }
  };

  return (
    <>
      <button type="button" className="btn danger" disabled={busy} onClick={onRemove}>
        {remove.isPending ? '지우는 중…' : `${what} 지우기`}
      </button>
      <button type="button" className="btn" disabled={busy} onClick={onDismiss}>
        {dismiss.isPending ? '비우는 중…' : '문제없음'}
      </button>
    </>
  );
}
