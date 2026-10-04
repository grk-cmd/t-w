import { useState } from 'react';
import { usePendingRequests } from '@/entities/license-request';
import { GrantByCodeCard } from '@/features/grant-by-code';
import { IssueKeyCard } from '@/features/issue-key';
import { LicenseList } from '@/widgets/license-list';
import { RequestList } from '@/widgets/request-list';
import styles from './LicensePage.module.css';

type Tab = 'licenses' | 'requests';

export function LicensePage() {
  const [tab, setTab] = useState<Tab>('licenses');
  // 대기 건수를 탭에 보여야 해서 «발급된 키» 탭을 보고 있어도 요청을 지켜본다.
  const { data: requests } = usePendingRequests();

  return (
    <>
      <div className="grid2">
        <IssueKeyCard />
        <GrantByCodeCard />
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'licenses'}
          onClick={() => setTab('licenses')}
        >
          발급된 키
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          onClick={() => setTab('requests')}
        >
          대기 중인 요청
          {requests && requests.length > 0 && <span className={styles.badge}>{requests.length}</span>}
        </button>
      </div>

      {tab === 'licenses' ? <LicenseList /> : <RequestList />}
    </>
  );
}
