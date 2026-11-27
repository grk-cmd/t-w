import { useForgetXmasReport, type XmasReport } from '@/entities/seasonal/xmas-event';
import { ApiError, isApiConflict } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDismissXmasReport, useRemoveReported, type RemoveTarget } from '../model/useModerateXmas';

/**
 * [지우기](장식 · 받은 편지) · [문제없음](신고만 비움). 처리한 줄은 목록에서 빠진다.
 * removable = 지울 대상(장식은 상세에서 본 판과 함께). 대상이 이미 없으면 null — [지우기] 없이 [문제없음] 만.
 */
export function XmasReportActions({
  report,
  removable,
}: {
  report: XmasReport;
  removable: RemoveTarget | null;
}) {
  const toast = useToast();
  const remove = useRemoveReported();
  const dismiss = useDismissXmasReport();
  const forget = useForgetXmasReport();
  /** 지울 것이 이미 없다(404 — 다른 관리자가 처리했거나 탈퇴로 지워짐) — 목록에서만 뺀다 */
  const gone = (e: unknown) => {
    if (!(e instanceof ApiError && e.kind === 'notFound')) return false;
    forget(report.key);
    toast('이미 처리된 신고예요');
    return true;
  };
  const busy = remove.isPending || dismiss.isPending;
  const what = report.kind === 'orn' ? '장식' : '받은 편지';

  const onRemove = async () => {
    if (!removable) return;
    const more =
      report.kind === 'orn' ? ' 건 사람은 다시 걸 수 있어요.' : ' 받은 사람의 편지함에서 사라져요.';
    if (!confirm(`이 ${what}을(를) 지울까요?${more} 되돌릴 수 없어요.`)) return;
    try {
      await remove.mutateAsync(removable);
      toast(`${what}을(를) 지웠어요`);
    } catch (e) {
      if (gone(e)) return;
      toast(
        isApiConflict(e)
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
      if (gone(e)) return;
      toast(errorMessage(e, '비우지 못했어요'));
    }
  };

  return (
    <>
      {removable && (
        <button type="button" className="btn danger" disabled={busy} onClick={onRemove}>
          {remove.isPending ? '지우는 중…' : `${what} 지우기`}
        </button>
      )}
      <button type="button" className="btn" disabled={busy} onClick={onDismiss}>
        {dismiss.isPending ? '비우는 중…' : '문제없음'}
      </button>
    </>
  );
}
