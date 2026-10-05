import { useMemo, useState, type DragEvent } from 'react';
import {
  categoryViews,
  KIND_LABEL,
  useCatalogEntries,
  useCatOverrides,
  useCustomCats,
  useRefreshCatalog,
  type CatalogEntry,
  type CatalogKind,
} from '@/entities/catalog';
import { DeleteEntriesButton } from '@/features/catalog/delete-entries';
import { EntryInfoForm } from '@/features/catalog/edit-entry-info';
import { useReorderEntries } from '@/features/catalog/reorder-entries';
import { errorMessage, useSelection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox, SelectionBar, useToast } from '@/shared/ui';
import styles from './CatalogList.module.css';

interface Group {
  key: string;
  title: string | null;
  entries: CatalogEntry[];
}

/** 파츠는 카테고리마다 진열 칸이 따로라 칸별로 묶는다 — 앱 카테고리 순서, 모르는 카테고리는 뒤에. */
function useGroups(kind: CatalogKind, entries: CatalogEntry[] | undefined): Group[] {
  const byCat = kind === 'parts' || kind === 'gachaParts';
  const { data: customCats } = useCustomCats();
  const { data: overrides } = useCatOverrides();
  return useMemo(() => {
    if (!entries) return [];
    if (!byCat) return [{ key: '', title: null, entries }];
    const views = categoryViews(customCats ?? {}, overrides ?? {});
    const cats = [...new Set([...views.map((v) => v.cat), ...entries.map((e) => e.cat ?? '')])];
    return cats
      .map((cat) => {
        const view = views.find((v) => v.cat === cat);
        return {
          key: cat,
          title: view ? `${view.icon} ${view.label} · ${cat}` : `❔ ${cat || '카테고리 없음'}`,
          entries: entries.filter((e) => (e.cat ?? '') === cat),
        };
      })
      .filter((g) => g.entries.length > 0);
  }, [byCat, entries, customCats, overrides]);
}

function Thumb({ entry }: { entry: CatalogEntry }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={styles.thumb}>
      {entry.thumb && !broken ? (
        <img
          src={entry.thumb}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        entry.icon || '·'
      )}
    </span>
  );
}

interface Props {
  kind: CatalogKind;
  /** 이름 · 아이콘 수정 — 책상 · 아이템. */
  editable?: boolean;
}

export function CatalogList({ kind, editable }: Props) {
  const toast = useToast();
  const { data: entries, error, isFetching } = useCatalogEntries(kind);
  const refresh = useRefreshCatalog();
  const reorder = useReorderEntries();
  const groups = useGroups(kind, entries);
  const ids = useMemo(() => (entries ?? []).map((e) => e.id), [entries]);
  const selection = useSelection(ids);
  const selected = (entries ?? []).filter((e) => selection.isSelected(e.id));
  const [drag, setDrag] = useState<{ id: string; group: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const onDrop = async (group: Group, target: string) => {
    const dragged = drag;
    setDrag(null);
    if (!dragged || dragged.group !== group.key || dragged.id === target) return;
    try {
      const written = await reorder.mutateAsync({ group: group.entries, dragged: dragged.id, target });
      if (Object.keys(written).length) toast('순서를 바꿨어요');
    } catch (e) {
      toast(errorMessage(e, '순서를 바꾸지 못했어요'));
    }
  };

  const allowDrop = (group: Group) => (e: DragEvent) => {
    if (drag?.group === group.key) e.preventDefault();
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>{KIND_LABEL[kind]}</h2>
        <span className="soft">{entries && `${entries.length}개`}</span>
        <button type="button" className="btn" disabled={isFetching} onClick={() => refresh(kind)}>
          새로고침
        </button>
      </div>
      {!!entries?.length && (
        <SelectionBar
          count={selected.length}
          onClear={selection.clear}
          selectAll={
            <SelectAllCheckbox
              allChecked={selection.allChecked}
              someChecked={selection.someChecked}
              onChange={selection.toggleAll}
            />
          }
        >
          <DeleteEntriesButton entries={selected} all={entries} onDone={selection.clear} />
        </SelectionBar>
      )}
      <div className="list">
        {error && errorMessage(error, '불러오지 못했어요')}
        {!error && !entries && '불러오는 중…'}
        {entries?.length === 0 && '비어 있어요'}
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={group.title ?? KIND_LABEL[kind]}>
            {group.title && (
              <h3 className={styles.group}>
                {group.title} <span className="meta">{group.entries.length}</span>
              </h3>
            )}
            {group.entries.map((entry) => (
              <div
                key={entry.id}
                className={drag?.id === entry.id ? `row ${styles.dragging}` : 'row'}
                draggable={!entry.legacyGacha && !reorder.isPending && editing !== entry.id}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', entry.id);
                  setDrag({ id: entry.id, group: group.key });
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={allowDrop(group)}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(group, entry.id);
                }}
              >
                <RowCheckbox
                  label={`${entry.name || entry.id} 선택`}
                  checked={selection.isSelected(entry.id)}
                  onChange={() => selection.toggle(entry.id)}
                />
                <span className={styles.handle} aria-hidden>
                  ⠿
                </span>
                <Thumb entry={entry} />
                {editing === entry.id ? (
                  <EntryInfoForm entry={entry} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <span className="grow">
                      <b>
                        {entry.icon} {entry.name || '이름 없음'}
                      </b>
                      <code className="key">{entry.id}</code>
                      {entry.base64 && <small className="warn">base64</small>}
                      {entry.legacyGacha && <small className="warn">가챠 이관 전</small>}
                    </span>
                    {editable && (
                      <button type="button" className="btn" onClick={() => setEditing(entry.id)}>
                        수정
                      </button>
                    )}
                  </>
                )}
                <DeleteEntriesButton entries={[entry]} all={entries ?? []} single />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
