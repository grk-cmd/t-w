import { useMemo, useState } from 'react';
import {
  filterLicenses,
  licenseStatus,
  useLicenses,
  useRefreshLicenses,
  type LicenseStatus,
} from '@/entities/license';
import { KeyActions } from '@/features/license/revoke-key';
import { copyText, errorMessage, formatDate, paginate } from '@/shared/lib';
import { Pager, useToast } from '@/shared/ui';

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<LicenseStatus, string> = {
  unused: '⬜ 미사용',
  used: '✅ 사용됨',
  revoked: '🚫 회수됨',
};

export function LicenseList() {
  const toast = useToast();
  const { data: licenses, error } = useLicenses();
  const refresh = useRefreshLicenses();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => (licenses ? filterLicenses(licenses, search) : []), [licenses, search]);
  const view = paginate(rows, page, PAGE_SIZE);

  const changeSearch = (next: string) => {
    setSearch(next);
    setPage(1);
  };

  const copy = async (key: string) => toast((await copyText(key)) ? '복사했어요' : '복사하지 못했어요');

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">{licenses && `${rows.length} / ${Object.keys(licenses).length}건`}</span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <div className="field">
        <input
          type="search"
          placeholder="키 · 메모로 검색"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </div>
      <div className="list tall">
        {error && errorMessage(error, '목록을 불러오지 못했어요')}
        {!error && !licenses && '불러오는 중…'}
        {licenses && rows.length === 0 && (search.trim() ? '검색 결과가 없어요' : '아직 발급된 키가 없어요')}
        {view.items.map(([key, license]) => {
          const status = licenseStatus(license);
          return (
            <div key={key} className={status === 'revoked' ? 'row dim' : 'row'}>
              <span className="grow">
                <code className="key">{key}</code>
                <span className="meta">
                  {STATUS_LABEL[status]} · {formatDate(license.createdAt)}
                </span>
                <span className="note">{license.note || '메모 없음'}</span>
              </span>
              <button type="button" className="btn" onClick={() => copy(key)}>
                복사
              </button>
              <KeyActions licenseKey={key} status={status} />
            </div>
          );
        })}
      </div>
      <Pager page={view.page} pageCount={view.pageCount} onChange={setPage} />
    </section>
  );
}
