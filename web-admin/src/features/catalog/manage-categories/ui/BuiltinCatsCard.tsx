import { useMemo, useState, type FormEvent } from 'react';
import {
  CAT_LABEL_MAX,
  categoryViews,
  ICON_MAX,
  overrideProblem,
  useCatOverrides,
  useRefreshCatalog,
  type CatView,
} from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage, useSelection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox, SelectionBar, useToast } from '@/shared/ui';
import { useRevertCatOverrides, useSaveCatOverride } from '../model/useManageCategories';
import styles from './CategoryCards.module.css';

function OverrideForm({ cat, onDone }: { cat: CatView; onDone: () => void }) {
  const toast = useToast();
  const env = useEnv();
  const save = useSaveCatOverride();
  const [label, setLabel] = useState(cat.label);
  const [icon, setIcon] = useState(cat.icon);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = overrideProblem(label, icon);
    if (p) return setProblem(p);
    if (
      !confirm(withProdMark(env, `${cat.cat} → «${label.trim()}» 로 바꿀까요? 모든 사용자에게 바로 보여요.`))
    )
      return;
    try {
      await save.mutateAsync({ cat: cat.cat, label, icon });
      toast(`«${label.trim()}» 로 바꿨어요`);
      onDone();
    } catch (err) {
      setProblem(errorMessage(err, '저장하지 못했어요'));
    }
  };

  return (
    <form className={styles.edit} onSubmit={submit}>
      <input
        type="text"
        className={styles.icon}
        aria-label={`${cat.cat} 아이콘`}
        maxLength={ICON_MAX}
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
      />
      <input
        type="text"
        aria-label={`${cat.cat} 이름`}
        maxLength={CAT_LABEL_MAX}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button type="submit" className="btn primary" disabled={save.isPending}>
        {save.isPending ? '저장 중…' : '저장'}
      </button>
      <button type="button" className="btn" onClick={onDone}>
        취소
      </button>
      {problem && <span className="note warn">{problem}</span>}
    </form>
  );
}

export function BuiltinCatsCard() {
  const toast = useToast();
  const env = useEnv();
  const { data: overrides, error } = useCatOverrides();
  const refresh = useRefreshCatalog();
  const revert = useRevertCatOverrides();
  const [editing, setEditing] = useState<string | null>(null);
  const cats = useMemo(
    () => (overrides ? categoryViews({}, overrides).filter((c) => c.builtin) : []),
    [overrides],
  );
  const ids = useMemo(() => cats.map((c) => c.cat), [cats]);
  const selection = useSelection(ids);
  const toRevert = cats.filter((c) => c.overridden && selection.isSelected(c.cat)).map((c) => c.cat);

  const onRevert = async (targets: string[], onDone?: () => void) => {
    if (!confirm(withProdMark(env, `${targets.join(', ')} 를 기본 이름으로 되돌릴까요?`))) return;
    try {
      await revert.mutateAsync(targets);
      toast(`${targets.length}개 되돌렸어요`);
      onDone?.();
    } catch (e) {
      toast(errorMessage(e, '되돌리지 못했어요'));
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>기본 카테고리</h2>
        <button type="button" className="btn" onClick={() => refresh('catOverrides')}>
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
            className="btn"
            disabled={!toRevert.length || revert.isPending}
            onClick={() => onRevert(toRevert, selection.clear)}
          >
            선택 되돌리기 ({toRevert.length})
          </button>
        </SelectionBar>
      )}
      <div className="list">
        {error && errorMessage(error, '불러오지 못했어요')}
        {!error && !overrides && '불러오는 중…'}
        {cats.map((c) => (
          <div key={c.cat} className="row">
            <RowCheckbox
              label={`${c.cat} 선택`}
              checked={selection.isSelected(c.cat)}
              onChange={() => selection.toggle(c.cat)}
            />
            {editing === c.cat ? (
              <OverrideForm cat={c} onDone={() => setEditing(null)} />
            ) : (
              <>
                <span className="grow">
                  <b>
                    {c.icon} {c.label}
                  </b>
                  <code className="key">{c.cat}</code>
                  {c.overridden && <span className="meta">바꿈</span>}
                </span>
                <button type="button" className="btn" onClick={() => setEditing(c.cat)}>
                  수정
                </button>
                {c.overridden && (
                  <button
                    type="button"
                    className="btn"
                    disabled={revert.isPending}
                    onClick={() => onRevert([c.cat])}
                  >
                    되돌리기
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
