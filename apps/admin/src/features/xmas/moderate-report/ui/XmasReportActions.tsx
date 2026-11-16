import type { XmasReport } from '@/entities/seasonal/xmas-event';
import { callErrorMessage } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDismissXmasReport, useRemoveReported } from '../model/useModerateXmas';

/** [지우기](장식 · 받은 편지 — 함수) · [문제없음](신고만 비움). 처리한 줄은 목록에서 빠진다. */
export function XmasReportActions({ report }: { report: XmasReport }) {
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
      await remove.mutateAsync(report);
      toast(`${what}을(를) 지웠어요`);
    } catch (e) {
      toast(callErrorMessage(e, '지우지 못했어요'));
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
