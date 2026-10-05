import { useMemo, useState, type FormEvent } from 'react';
import {
  BONES,
  BUILTIN_CATS,
  CAT_ID_MAX,
  CAT_LABEL_MAX,
  categoryViews,
  CUSTOM_CAT_ICON,
  CUSTOM_GROUPS,
  customCatProblem,
  DEFAULT_BONE,
  ICON_MAX,
  normalizeCatId,
  PART_GROUPS,
  useCustomCats,
  useRefreshCatalog,
  type Bone,
  type CustomGroup,
} from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage, useSelection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox, SelectionBar, useToast } from '@/shared/ui';
import { useAddCustomCat, useDeleteCustomCats } from '../model/useManageCategories';
import styles from './CategoryCards.module.css';

const groupLabel = (group: string) => {
  const g = PART_GROUPS.find((p) => p.group === group);
  return g ? `${g.icon} ${g.label}` : group;
};

function AddCustomCatForm({ taken }: { taken: ReadonlySet<string> }) {
  const toast = useToast();
  const env = useEnv();
  const add = useAddCustomCat();
  const [group, setGroup] = useState<CustomGroup>('head');
  const [bone, setBone] = useState<Bone>(DEFAULT_BONE.head);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [rawId, setRawId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const id = normalizeCatId(rawId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { id, label, icon, group, bone };
    const p = customCatProblem(input, taken);
    if (p) return setProblem(p);
    if (
      !confirm(
        withProdMark(env, `«${label.trim()}» (${id}) 카테고리를 추가할까요? 모든 사용자에게 바로 보여요.`),
      )
    )
      return;
    try {
      await add.mutateAsync(input);
      toast(`«${label.trim()}» 를 추가했어요`);
      setLabel('');
      setIcon('');
      setRawId('');
      setProblem(null);
    } catch (err) {
      setProblem(errorMessage(err, '추가하지 못했어요'));
    }
  };

  return (
    <form className={styles.add} onSubmit={submit}>
      <select
        aria-label="그룹"
        value={group}
        onChange={(e) => {
          const next = e.target.value as CustomGroup;
          setGroup(next);
          setBone(DEFAULT_BONE[next]);
        }}
      >
        {CUSTOM_GROUPS.map((g) => (
          <option key={g} value={g}>
            {groupLabel(g)}
          </option>
        ))}
      </select>
      <input
        type="text"
        className={styles.icon}
        aria-label="아이콘"
        placeholder={CUSTOM_CAT_ICON}
        maxLength={ICON_MAX}
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
      />
      <input
        type="text"
        aria-label="이름"
        placeholder="이름"
        maxLength={CAT_LABEL_MAX}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        type="text"
        aria-label="ID"
        placeholder="ID (scarf)"
        maxLength={CAT_ID_MAX}
        value={rawId}
        onChange={(e) => setRawId(e.target.value)}
      />
      <select aria-label="부착 본" value={bone} onChange={(e) => setBone(e.target.value as Bone)}>
        {BONES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <button type="submit" className="btn primary" disabled={add.isPending}>
        {add.isPending ? '추가 중…' : '추가'}
      </button>
      {problem && <span className="note warn">{problem}</span>}
    </form>
  );
}

export function CustomCatsCard() {
  const toast = useToast();
  const env = useEnv();
  const { data: customCats, error } = useCustomCats();
  const refresh = useRefreshCatalog();
  const remove = useDeleteCustomCats();
  const cats = useMemo(
    () => (customCats ? categoryViews(customCats, {}).filter((c) => !c.builtin) : []),
    [customCats],
  );
  const ids = useMemo(() => cats.map((c) => c.cat), [cats]);
  const taken = useMemo(() => new Set([...BUILTIN_CATS.map((c) => c.cat), ...ids]), [ids]);
  const selection = useSelection(ids);

  const onDelete = async (targets: string[], onDone?: () => void) => {
    const ask = `카테고리 ${targets.join(', ')} 를 지울까요? 그 카테고리의 파츠가 꾸미기 창에서 안 보여요.`;
    if (!confirm(withProdMark(env, ask))) return;
    try {
      await remove.mutateAsync(targets);
      toast(`${targets.length}개 삭제했어요`);
      onDone?.();
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요. 지운 카테고리는 없어요'));
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>커스텀 카테고리</h2>
        <span className="soft">{customCats && `${cats.length}개`}</span>
        <button type="button" className="btn" onClick={() => refresh('customCats')}>
          새로고침
        </button>
      </div>
      {cats.length > 0 && (
        <SelectionBar
          count={selection.selected.length}
          onClear={selection.clear}
          selectAll={
            <SelectAllCheckbox
              allChecked={selection.allChecked}
              someChecked={selection.someChecked}
              onChange={selection.toggleAll}
            />
          }
        >
          <button
            type="button"
            className="btn danger"
            disabled={remove.isPending}
            onClick={() => onDelete(selection.selected, selection.clear)}
          >
            {remove.isPending ? '삭제 중…' : `선택 삭제 (${selection.selected.length})`}
          </button>
        </SelectionBar>
      )}
      <div className="list">
        {error && errorMessage(error, '불러오지 못했어요')}
        {!error && !customCats && '불러오는 중…'}
        {customCats && cats.length === 0 && '커스텀 카테고리가 없어요'}
        {cats.map((c) => (
          <div key={c.cat} className="row">
            <RowCheckbox
              label={`${c.cat} 선택`}
              checked={selection.isSelected(c.cat)}
              onChange={() => selection.toggle(c.cat)}
            />
            <span className="grow">
              <b>
                {c.icon} {c.label}
              </b>
              <code className="key">{c.cat}</code>
              <span className="meta">{groupLabel(c.group)}</span>
            </span>
            <button
              type="button"
              className="btn danger"
              disabled={remove.isPending}
              onClick={() => onDelete([c.cat])}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      {customCats && <AddCustomCatForm taken={taken} />}
    </section>
  );
}
