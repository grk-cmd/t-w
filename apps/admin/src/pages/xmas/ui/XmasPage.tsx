import { useState } from 'react';
import { useXmasReports } from '@/entities/seasonal/xmas-event';
import { XmasLetterList } from '@/widgets/xmas/letter-list';
import { XmasReportList } from '@/widgets/xmas/report-list';
import styles from './XmasPage.module.css';

type Tab = 'letters' | 'reports';

/** 크리스마스 이벤트(일회성 · 이슈 #1097) — 맡긴 편지 확인 · 반송 / 장식 · 받은 편지 신고 처리. 이벤트가 끝나면 이 화면을 지운다. */
export function XmasPage() {
  const [tab, setTab] = useState<Tab>('letters');
  const { data: reports } = useXmasReports();
  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'letters'} onClick={() => setTab('letters')}>
          맡긴 편지
        </button>
        <button type="button" role="tab" aria-selected={tab === 'reports'} onClick={() => setTab('reports')}>
          신고
          {reports && reports.length > 0 && <span className={styles.badge}>{reports.length}</span>}
        </button>
      </div>
      {tab === 'letters' && <XmasLetterList />}
      {tab === 'reports' && <XmasReportList />}
    </>
  );
}
