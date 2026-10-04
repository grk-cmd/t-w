import { useState } from 'react';
import { usePendingRequests } from '@/entities/license-request';
import { BulkGrantCard } from '@/features/bulk-grant';
import { GrantByCodeCard } from '@/features/grant-by-code';
import { SecretRoomCard } from '@/features/grant-secret-room';
import { IssueKeyCard } from '@/features/issue-key';
import { LicenseList } from '@/widgets/license-list';
import { LicenseStats } from '@/widgets/license-stats';
import { RequestList } from '@/widgets/request-list';
import styles from './LicensePage.module.css';

type Tab = 'licenses' | 'requests' | 'bulk' | 'secret';

export function LicensePage() {
  const [tab, setTab] = useState<Tab>('licenses');
  // 대기 건수를 탭에 보여야 해서 «발급된 키» 탭을 보고 있어도 요청을 지켜본다.
  const { data: requests } = usePendingRequests();

  return (
    <>
      <LicenseStats />
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
        <button type="button" role="tab" aria-selected={tab === 'bulk'} onClick={() => setTab('bulk')}>
          일괄 발급
        </button>
        <button type="button" role="tab" aria-selected={tab === 'secret'} onClick={() => setTab('secret')}>
          시크릿룸
        </button>
      </div>

      {tab === 'licenses' && <LicenseList />}
      {tab === 'requests' && <RequestList />}
      {/* 탭을 떠나면 내린다 — 입력한 발급 열쇠가 화면에 남아 있지 않게. */}
      {tab === 'secret' && <SecretRoomCard />}
      {/* 탭을 옮겨도 진행 중인 발급 · 미리보기가 사라지지 않게 숨기기만 한다. */}
      <div className={styles.panel} hidden={tab !== 'bulk'}>
        <BulkGrantCard />
      </div>
    </>
  );
}
