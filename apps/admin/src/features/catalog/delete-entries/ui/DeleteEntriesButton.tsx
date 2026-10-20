import { KIND_LABEL, type CatalogEntry } from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDeleteEntries } from '../model/useDeleteEntries';

interface Props {
  entries: CatalogEntry[];
  /** 같은 목록 전체 — 남는 항목이 쓰는 파일은 지우지 않는다. */
  all: CatalogEntry[];
  /** 줄 하나의 «삭제» 면 true. */
  single?: boolean;
  onDone?: () => void;
}

export function DeleteEntriesButton({ entries, all, single, onDone }: Props) {
  const toast = useToast();
  const env = useEnv();
  const remove = useDeleteEntries();

  // 지운 줄과 함께 이 버튼이 내려간다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    if (!entries.length) return;
    const what = single
      ? `«${entries[0].name || entries[0].id}»`
      : `선택한 ${KIND_LABEL[entries[0].kind]} ${entries.length}개`;
    if (!confirm(withProdMark(env, `${what} 를 지울까요? 모든 사용자에게서 사라지고 되돌릴 수 없어요.`)))
      return;
    try {
      const r = await remove.mutateAsync({ entries, rest: all });
      toast(`${r.removed}개 삭제했어요` + (r.filesLeft ? ` · 파일 ${r.filesLeft}개는 못 지웠어요` : ''));
      onDone?.();
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요. 지운 항목은 없어요'));
    }
  };

  return (
    <button
      type="button"
      className="btn danger"
      disabled={!entries.length || remove.isPending}
      onClick={onClick}
    >
      {remove.isPending ? '삭제 중…' : single ? '삭제' : `선택 삭제 (${entries.length})`}
    </button>
  );
}
