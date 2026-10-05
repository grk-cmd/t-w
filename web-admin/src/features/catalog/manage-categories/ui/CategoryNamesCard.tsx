import { useMemo, useState, type FormEvent } from 'react';
import {
  CAT_LABEL_MAX,
  categoryNameProblem,
  categoryViews,
  ICON_MAX,
  useCatOverrides,
  useCustomCats,
  useRefreshCatalog,
  type CatView,
} from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useSaveCategoryName } from '../model/useManageCategories';
import styles from './CategoryCards.module.css';

function NameRow({ cat }: { cat: CatView }) {
  const toast = useToast();
  const env = useEnv();
  const save = useSaveCategoryName();
  // 덮어쓰지 않은 기본 카테고리는 칸을 비워 두고 기본값을 흐리게 보여 준다 — 비우고 저장하면 기본값으로 돌아간다.
  const initLabel = cat.builtin && !cat.overridden ? '' : cat.label;
  const initIcon = cat.builtin && cat.icon === cat.defaultIcon ? '' : cat.icon;
  const [label, setLabel] = useState(initLabel);
  const [icon, setIcon] = useState(initIcon);
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = label.trim() !== initLabel || icon.trim() !== initIcon;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = categoryNameProblem(cat, label, icon);
    if (p) return setProblem(p);
    if (env.isProd && !confirm(withProdMark(env, `${cat.cat} 이름을 바꿀까요? 모든 사용자에게 바로 보여요.`)))
      return;
    try {
      await save.mutateAsync({ cat, label, icon });
      setProblem(null);
      toast('저장했어요');
    } catch (err) {
      setProblem(errorMessage(err, '저장하지 못했어요'));
    }
  };

  return (
    <form className="row" onSubmit={submit}>
      <input
        type="text"
        className={styles.icon}
        aria-label={`${cat.cat} 아이콘`}
        maxLength={ICON_MAX}
        placeholder={cat.defaultIcon || cat.icon}
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
      />
      <input
        type="text"
        aria-label={`${cat.cat} 이름`}
        maxLength={CAT_LABEL_MAX}
        placeholder={cat.defaultLabel}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <code className="key">{cat.cat}</code>
      <button type="submit" className="btn primary" disabled={!dirty || save.isPending}>
        저장
      </button>
      {problem && <span className="note warn">{problem}</span>}
    </form>
  );
}

export function CategoryNamesCard() {
  const custom = useCustomCats();
  const overrides = useCatOverrides();
  const refresh = useRefreshCatalog();
  const error = custom.error ?? overrides.error;
  const cats = useMemo(
    () => (custom.data && overrides.data ? categoryViews(custom.data, overrides.data) : []),
    [custom.data, overrides.data],
  );

  return (
    <section className="card">
      <div className="card-head">
        <h2>카테고리 이름</h2>
        <button
          type="button"
          className="btn"
          onClick={() => {
            refresh('customCats');
            refresh('catOverrides');
          }}
        >
          새로고침
        </button>
      </div>
      <div className="list">
        {error && errorMessage(error, '불러오지 못했어요')}
        {!error && !cats.length && '불러오는 중…'}
        {cats.map((c) => (
          // 저장 뒤 값이 바뀌면 칸을 새 값으로 다시 채운다.
          <NameRow key={`${c.id}|${c.label}|${c.icon}|${c.overridden}`} cat={c} />
        ))}
      </div>
    </section>
  );
}
