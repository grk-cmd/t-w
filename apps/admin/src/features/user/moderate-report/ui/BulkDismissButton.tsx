import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDismissReportsMany } from '../model/useModerateReport';

interface Props {
  targets: string[];
  onDone: () => void;
}

export function BulkDismissButton({ targets, onDone }: Props) {
  const toast = useToast();
  const dismiss = useDismissReportsMany();

  // 비운 사람은 목록에서 빠져 이 버튼이 내려갈 수 있다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    if (!confirm(`선택한 ${targets.length}명에 대한 신고를 비울까요?`)) return;
    try {
      toast(`${await dismiss.mutateAsync(targets)}명의 신고를 비웠어요`);
      onDone();
    } catch (e) {
      toast(errorMessage(e, '비우지 못했어요. 비운 신고는 없어요'));
    }
  };

  return (
    <button type="button" className="btn" disabled={!targets.length || dismiss.isPending} onClick={onClick}>
      {dismiss.isPending ? '비우는 중…' : `선택 문제없음 (${targets.length})`}
    </button>
  );
}
