import { useMemo, useState, type DragEvent } from 'react';
import {
  byPopularity,
  categoryViews,
  equipCountOf,
  equipKindOf,
  KIND_LABEL,
  useCatalogEntries,
  useCatOverrides,
  useCustomCats,
  useEquipCounts,
  useRefreshCatalog,
  useRefreshEquipCounts,
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

type SortMode = 'order' | 'popular';

const SORT_LABEL: Record<SortMode, string> = {
  order: '진열 순서',
  popular: '많이 쓰는 순',
};

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

function EquipCount({ count, state }: { count: number; state: 'ok' | 'loading' | 'error' }) {
  if (state === 'loading') return <span className={`soft ${styles.equip}`}>장착 …</span>;
  if (state === 'error')
    return (
      <span className={`soft ${styles.equip}`} title="장착 수를 불러오지 못했어요">
        장착 ?
      </span>
    );
  return (
    <span className={count ? styles.equip : `soft ${styles.equip}`} title="슬롯에 이 항목을 낀 사람 수">
      장착 {count.toLocaleString('ko-KR')}명
    </span>
  );
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
  const equipKind = equipKindOf(kind);
  const counts = useEquipCounts(equipKind);
  const refreshCounts = useRefreshEquipCounts();
  const [sort, setSort] = useState<SortMode>('order');
  const popular = sort === 'popular';
  const baseGroups = useGroups(kind, entries);
  const groups = useMemo(
    () =>
      popular ? baseGroups.map((g) => ({ ...g, entries: byPopularity(g.entries, counts.data) })) : baseGroups,
    [popular, baseGroups, counts.data],
  );
  const countState = counts.error ? 'error' : counts.data ? 'ok' : 'loading';
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
        <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
          {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {SORT_LABEL[mode]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={isFetching || counts.isFetching}
          onClick={() => {
            refresh(kind);
            refreshCounts(equipKind);
          }}
        >
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
      {popular && (
        <p className={`soft ${styles.hint}`}>
          장착 수는 슬롯에 그 항목을 낀 사람 수예요(한 사람이 여러 칸에 껴도 1명). 이 순서에서는 끌어서 진열
          순서를 바꿀 수 없어요.
        </p>
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
                draggable={!popular && !entry.legacyGacha && !reorder.isPending && editing !== entry.id}
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
                <span className={popular ? `${styles.handle} ${styles.off}` : styles.handle} aria-hidden>
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
                    <EquipCount count={equipCountOf(counts.data, entry.id)} state={countState} />
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
