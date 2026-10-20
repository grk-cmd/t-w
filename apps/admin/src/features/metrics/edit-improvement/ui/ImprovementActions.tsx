import type { Improvement } from '@/entities/metrics/usage';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { hasVersion, SEED_0_10_2 } from '../model/seed';
import { useDeleteImprovement, useSaveImprovement } from '../model/useImprovementMutations';

/** 기록 한 줄의 수정 · 삭제 — 수정은 위젯이 폼을 연다. */
export function ImprovementActions({ entry, onEdit }: { entry: Improvement; onEdit: () => void }) {
  const env = useEnv();
  const toast = useToast();
  const remove = useDeleteImprovement();

  const onDelete = async () => {
    if (!confirm(withProdMark(env, `«${entry.version}» 개선 기록 삭제 — 사용량 기록은 그대로`))) return;
    try {
      await remove.mutateAsync(entry);
      toast('삭제 완료');
    } catch (e) {
      toast(errorMessage(e, '삭제 실패'));
    }
  };

  return (
    <>
      <button type="button" className="btn" disabled={remove.isPending} onClick={onEdit}>
        수정
      </button>
      <button type="button" className="btn danger" disabled={remove.isPending} onClick={onDelete}>
        {remove.isPending ? '삭제 중…' : '삭제'}
      </button>
    </>
  );
}

/** 0.10.2 기록을 한 번에 — 이미 있으면 안 보인다. */
export function SeedImprovementButton({ list }: { list: readonly Improvement[] }) {
  const env = useEnv();
  const toast = useToast();
  const save = useSaveImprovement();
  if (hasVersion(list, SEED_0_10_2.version)) return null;

  const onSeed = async () => {
    if (!confirm(withProdMark(env, `«${SEED_0_10_2.title}» 기록 추가 (10/5 17:44 릴리스)`))) return;
    try {
      await save.mutateAsync({ draft: SEED_0_10_2 });
      toast('0.10.2 기록 추가 완료');
    } catch (e) {
      toast(errorMessage(e, '추가 실패'));
    }
  };

  return (
    <button type="button" className="btn" disabled={save.isPending} onClick={onSeed}>
      {save.isPending ? '추가 중…' : '0.10.2 기록 추가'}
    </button>
  );
}
