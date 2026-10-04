import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDismissReports, useTakeDownAwayImg } from '../model/useModerateReport';

interface Props {
  target: string;
  who: string;
  /** 지금 보이는 자리비움 그림 — 없으면 «그림 내리기» 를 숨긴다. */
  awayImg: string | null;
}

export function ReportActions({ target, who, awayImg }: Props) {
  const toast = useToast();
  const takeDown = useTakeDownAwayImg(target);
  const dismiss = useDismissReports(target);
  const busy = takeDown.isPending || dismiss.isPending;

  const onTakeDown = () => {
    if (!awayImg) return;
    if (!confirm(`${who} 님의 자리비움 그림을 내리고 신고를 비울까요? 그림 파일은 지워져 되돌릴 수 없어요.`))
      return;
    takeDown.mutate(awayImg, {
      onSuccess: (r) => {
        if (!r.ok) toast('그 사이 그림이 바뀌었어요 — 새 그림을 다시 확인해 주세요');
        else if (r.fileDeleted) toast('자리비움 그림을 내리고 신고를 비웠어요');
        else toast('그림을 내리고 신고를 비웠어요 — 파일은 지우지 못해 저장소에 남았어요');
      },
      onError: (e) => toast(errorMessage(e, '내리지 못했어요 — 아무것도 바뀌지 않았어요')),
    });
  };

  const onDismiss = () => {
    if (!confirm(`${who} 님에 대한 신고를 비울까요?`)) return;
    dismiss.mutate(undefined, {
      onSuccess: () => toast('신고를 비웠어요'),
      onError: (e) => toast(errorMessage(e, '비우지 못했어요')),
    });
  };

  return (
    <>
      {awayImg && (
        <button type="button" className="btn danger" disabled={busy} onClick={onTakeDown}>
          {takeDown.isPending ? '내리는 중…' : '그림 내리기'}
        </button>
      )}
      <button type="button" className="btn" disabled={busy} onClick={onDismiss}>
        {dismiss.isPending ? '비우는 중…' : '문제없음'}
      </button>
    </>
  );
}
