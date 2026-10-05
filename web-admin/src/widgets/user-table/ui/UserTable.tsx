import { realName, useUserName, useUserPresence, type UserLicense, type UserRow } from '@/entities/user';
import { useUserInvite } from '@/entities/invite';
import { GrantInvitesButton } from '@/features/user/grant-invites';
import { formatDate, type Selection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox } from '@/shared/ui';
import styles from './UserTable.module.css';

const LICENSE_LABEL: Record<UserLicense, string> = {
  used: '사용 중',
  unused: '사용 중',
  revoked: '회수됨',
  unknown: '없는 키',
  none: '—',
};

function formatHours(sec: number): string {
  return sec ? `${Math.round(sec / 360) / 10}시간` : '—';
}

// 계정 요약에 이름이 없으면 그 사람 이름 한 칸만 읽는다. 화면에 보이는 줄만 읽고, 한 번 읽은 이름은 캐시에 남는다.
function NameCell({ row }: { row: UserRow }) {
  const fetched = useUserName(row.userCode, !row.name);
  const name = row.name ?? realName(fetched.data);
  if (name) return <>{name}</>;
  return <span className="soft">{fetched.isLoading ? '…' : '이름 없음'}</span>;
}

// 마지막 접속 — 계정 요약은 계정이 있는 사람만 있어서, 옛 앱을 포함한 모두가 쓰는 presence 를 줄마다 읽는다.
function LastSeenCell({ uid }: { uid: string }) {
  const p = useUserPresence(uid);
  if (p.isLoading) return <span className="soft">…</span>;
  if (p.error) return <span className="soft">읽지 못함</span>;
  if (p.data?.online) return <span className={styles.online}>접속 중</span>;
  return <span className="soft">{p.data?.lastSeen ? formatDate(p.data.lastSeen) : '—'}</span>;
}

// 가입 — 초대장 제도의 기록. 초대한 사람이 없으면 제도 전부터 쓰던 «기존»(처음 5장), 있으면 «초대»(0장으로 시작).
function JoinCell({ uid }: { uid: string }) {
  const inv = useUserInvite(uid);
  if (inv.isLoading) return <span className="soft">…</span>;
  if (inv.error) return <span className="soft">읽지 못함</span>;
  if (!inv.data) return <span className="soft">—</span>;
  const { joinedAt, invitedBy, invitesLeft } = inv.data;
  return (
    <span title={invitedBy ? `초대: ${invitedBy}` : undefined}>
      {joinedAt ? formatDate(joinedAt).slice(0, 10) : '—'}{' '}
      <small className="soft">{invitedBy ? '초대' : '기존'}</small>
      {invitesLeft !== null && <small className="soft"> · 초대권 {invitesLeft}장</small>}
    </span>
  );
}

interface Props {
  rows: UserRow[];
  startIndex: number;
  /** 사용자코드로 고른다. 전체 선택은 이 쪽(rows)만. */
  selection: Selection;
}

export function UserTable({ rows, startIndex, selection }: Props) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <SelectAllCheckbox
                allChecked={selection.allChecked}
                someChecked={selection.someChecked}
                disabled={rows.length === 0}
                onChange={selection.toggleAll}
              />
            </th>
            <th>#</th>
            <th>이름</th>
            <th>친구코드</th>
            <th>사용자코드</th>
            <th>라이선스</th>
            <th>집중</th>
            <th>가입</th>
            <th>마지막 접속</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="soft">
                조건에 맞는 사용자가 없어요
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.userCode}>
              <td>
                <RowCheckbox
                  label={`${row.name ?? row.friendCode ?? row.userCode} 선택`}
                  checked={selection.isSelected(row.userCode)}
                  onChange={() => selection.toggle(row.userCode)}
                />
              </td>
              <td className="soft">{startIndex + i + 1}</td>
              <td>
                <NameCell row={row} />
                {!row.hasAccount && <small className={styles.tag}>계정 없음</small>}
              </td>
              <td>
                <code className="key">{row.friendCode ?? '—'}</code>
              </td>
              <td>
                <code className="key soft">{row.userCode}</code>
              </td>
              <td>
                {row.license && <code className="key">{row.license}</code>}
                <small
                  className={
                    row.licenseState === 'revoked' || row.licenseState === 'unknown' ? 'warn' : 'soft'
                  }
                >
                  {' '}
                  {LICENSE_LABEL[row.licenseState]}
                </small>
              </td>
              <td>{formatHours(row.focusTotalSec)}</td>
              <td>
                <JoinCell uid={row.userCode} />
              </td>
              <td>
                <LastSeenCell uid={row.userCode} />
              </td>
              <td>
                <GrantInvitesButton uid={row.userCode} who={row.name ?? row.friendCode ?? row.userCode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
