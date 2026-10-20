import { useState, type ReactNode } from 'react';
import { Base64CleanupCard, CatalogAnalysisCard } from '@/features/catalog/diagnose-catalog';
import { CategoryNamesCard } from '@/features/catalog/manage-categories';
import { CatalogList } from '@/widgets/catalog-list';
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
    render: () => <CategoryNamesCard />,
  },
  { id: 'parts', label: '파츠', render: () => <CatalogList kind="parts" /> },
  { id: 'gachaParts', label: '가챠 파츠', render: () => <CatalogList kind="gachaParts" /> },
  { id: 'desks', label: '책상', render: () => <CatalogList kind="desks" editable /> },
  { id: 'items', label: '아이템', render: () => <CatalogList kind="items" editable /> },
  {
    id: 'diagnose',
    label: '진단',
    render: () => (
      <>
        <CatalogAnalysisCard />
        <Base64CleanupCard />
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
      {/* 탭마다 새로 그린다 — 종류가 달라도 같은 CatalogList 라 정렬 · 선택 같은 상태가 다음 탭으로 넘어간다. */}
      <div role="tabpanel" key={tab.id}>
        {tab.render()}
      </div>
    </>
  );
}
