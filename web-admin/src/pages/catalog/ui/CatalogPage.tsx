import { useState, type ReactNode } from 'react';
import { BuiltinCatsCard, CustomCatsCard } from '@/features/catalog/manage-categories';
import styles from './CatalogPage.module.css';

interface Tab {
  id: string;
  label: string;
  render: () => ReactNode;
}

// 보이는 탭만 그린다 — 종류마다 노드를 따로 받으므로 열어 본 종류만 내려받는다.
const TABS: Tab[] = [
  {
    id: 'categories',
    label: '카테고리',
    render: () => (
      <>
        <CustomCatsCard />
        <BuiltinCatsCard />
      </>
    ),
  },
];

export function CatalogPage() {
  const [current, setCurrent] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === current) ?? TABS[0];

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            className={t.id === tab.id ? styles.on : undefined}
            onClick={() => setCurrent(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab.render()}</div>
    </>
  );
}
