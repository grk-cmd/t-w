import { useGroupInviteUses, type GroupInviteUse } from '@/entities/invite';
import { isPortError } from '@/shared/api';
import { errorMessage, formatDate, useKeysetPaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './GroupInvitesPanel.module.css';

// 그 코드로 가입한 사람(외부인 · 개인 코드 모두) — 그릴 때만 그 코드 몫을 받는다. 없는 코드(목록을 받은 뒤 지워짐)는 notFound — 문구는 서버 code 표(API_ERROR_TEXT)에서 온다. 아무도 안 쓴 코드는 빈 목록.
export function InviteUses({
  code,
  onCopyUserCode,
}: {
  code: string;
  onCopyUserCode: (userCode: string) => void;
}) {
  const query = useGroupInviteUses(code, true);
  const paging = useKeysetPaging(query, 'groupInviteUses');
  if (query.isPending) return <p className="soft">불러오는 중…</p>;
  if (isPortError(query.error, 'notFound')) return <p className="soft">{query.error.message}</p>;
  if (query.error)
    return <p className="msg err">{errorMessage(query.error, '가입한 사람을 불러오지 못했어요')}</p>;
  if (paging.items.length === 0) return <p className="soft">이 코드로 들어온 기록이 없어요</p>;
  return (
    <>
      <table className={styles.table} aria-label={`${code} 로 가입한 사람`}>
        <thead>
          <tr>
            <th>번호</th>
            <th>들어온 시각</th>
            <th>유저코드</th>
            <th>이름</th>
          </tr>
        </thead>
        <tbody>
          {paging.items.map((u) => (
            <UseRow key={u.n} use={u} onCopyUserCode={onCopyUserCode} />
          ))}
        </tbody>
      </table>
      <Pager paging={paging} more={paging.more} />
    </>
  );
}

function UseRow({
  use,
  onCopyUserCode,
}: {
  use: GroupInviteUse;
  onCopyUserCode: (userCode: string) => void;
}) {
  const { userCode } = use;
  return (
    <tr>
      <td>{use.n}</td>
      <td>{use.joinedAt !== null ? formatDate(use.joinedAt) : <span className="soft">—</span>}</td>
      <td>
        {userCode !== null ? (
          <button type="button" className="btn" title="복사" onClick={() => onCopyUserCode(userCode)}>
            <code className="key soft">{userCode}</code>
          </button>
        ) : (
          <span className="soft">유저코드 없음</span>
        )}
      </td>
      <td>{use.name ?? <span className="soft">—</span>}</td>
    </tr>
  );
}
