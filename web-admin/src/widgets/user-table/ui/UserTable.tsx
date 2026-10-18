import {
  isBadLicense,
  LICENSE_LABEL,
  realName,
  useUserName,
  currentVer,
  useUserPresence,
  verLabel,
  type UserRow,
} from '@/entities/user';
import { useUserInvite } from '@/entities/invite';
import { GrantInvitesButton } from '@/features/user/grant-invites';
import { formatDate, formatHours, type Selection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox } from '@/shared/ui';
import styles from './UserTable.module.css';

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

// 버전 — 마지막 접속 칸과 같은 presence(캐시 한 벌)를 본다. 계정 요약의 버전은 옛 값이 남을 수 있다.
function VerCell({ row }: { row: UserRow }) {
  const p = useUserPresence(row.userCode);
  if (p.isLoading) return <span className="soft">…</span>;
  const v = currentVer(p.data ?? null, row);
  return <span className={v.ver ? undefined : 'soft'}>{verLabel(v)}</span>;
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

function SharedKeyTag({ count }: { count: number }) {
  return count > 1 ? <small className={`${styles.tag} ${styles.shared}`}>{count}명 사용</small> : null;
}

interface Props {
  rows: UserRow[];
  startIndex: number;
  /** 사용자코드로 고른다. 전체 선택은 이 쪽(rows)만. */
  selection: Selection;
  /** 이름을 누르면 그 사람 상세를 연다. */
  onOpen: (uid: string) => void;
}

export function UserTable({ rows, startIndex, selection, onOpen }: Props) {
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
            <th>버전</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="soft">
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
                <button
                  type="button"
                  className={styles.open}
                  title="상세 보기"
                  onClick={() => onOpen(row.userCode)}
                >
                  <NameCell row={row} />
                </button>
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
                <small className={isBadLicense(row.licenseState) ? 'warn' : 'soft'}>
                  {' '}
                  {LICENSE_LABEL[row.licenseState]}
                </small>
                {/* 같은 키를 쓰는 사람 수(목록 전체 기준) — 2명 이상이면 표시 */}
                <SharedKeyTag count={row.licenseUsers} />
              </td>
              <td>{formatHours(row.focusTotalSec)}</td>
              <td>
                <JoinCell uid={row.userCode} />
              </td>
              <td>
                <LastSeenCell uid={row.userCode} />
              </td>
              <td>
                <VerCell row={row} />
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
