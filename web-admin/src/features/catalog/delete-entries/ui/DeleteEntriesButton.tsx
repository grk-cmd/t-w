import { KIND_LABEL, type CatalogEntry } from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useArchives, useDeleteEntries } from '../model/useDeleteEntries';

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
  // API 판은 지우지 않고 단종한다 — 모두에게서 사라지는 결과는 같고 행은 남아 되살릴 수 있다(설계 R13).
  const archives = useArchives();
  const verb = archives ? '단종' : '삭제';

  // 지운 줄과 함께 이 버튼이 내려간다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    if (!entries.length) return;
    const what = single
      ? `«${entries[0].name || entries[0].id}»`
      : `선택한 ${KIND_LABEL[entries[0].kind]} ${entries.length}개`;
    const ask = archives
      ? `${what} 를 단종할까요? 모든 사용자에게서 사라져요. 행은 남아서 되살릴 수 있어요.`
      : `${what} 를 지울까요? 모든 사용자에게서 사라지고 되돌릴 수 없어요.`;
    if (!confirm(withProdMark(env, ask))) return;
    try {
      const r = await remove.mutateAsync({ entries, rest: all });
      toast(
        `${r.removed}개 ${verb}했어요` +
          (r.filesLeft ? ` · 파일 ${r.filesLeft}개는 못 지웠어요` : '') +
          (r.failed.length ? ` · ${r.failed.length}개는 안 됐어요(${r.failed[0].reason})` : ''),
      );
      onDone?.();
    } catch (e) {
      toast(errorMessage(e, `${verb}하지 못했어요. ${archives ? '단종한' : '지운'} 항목은 없어요`));
    }
  };

  return (
    <button
      type="button"
      className="btn danger"
      disabled={!entries.length || remove.isPending}
      onClick={onClick}
    >
      {remove.isPending
        ? `${verb} 중…`
        : single
          ? archives
            ? '단종(숨기기)'
            : '삭제'
          : `선택 ${verb} (${entries.length})`}
    </button>
  );
}
