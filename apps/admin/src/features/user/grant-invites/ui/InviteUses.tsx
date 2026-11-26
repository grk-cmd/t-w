import { useState } from 'react';
import { useGroupInviteUses, useInvitePort, type GroupInviteUse } from '@/entities/invite';
import { isPortError } from '@/shared/api';
import { errorMessage, formatDate, kstDateKey, useKeysetPaging } from '@/shared/lib';
import { downloadBytes, writeXlsx } from '@/shared/sheet';
import { Pager } from '@/shared/ui';
import { usesExportGrid, usesFileName, type FriendCodesOf } from '../model/usesSheet';
import styles from './GroupInvitesPanel.module.css';

/** 가입한 사람 줄에서 하는 일 — 유저코드 복사 · 회원 정보 열기(창은 페이지가 띄운다) · 엑셀에 넣을 친구코드 찾기. */
export interface UseActions {
  copy: (userCode: string) => void;
  open: (userCode: string) => void;
  friendCodes: FriendCodesOf;
}

// 그 코드로 가입한 사람(외부인 · 개인 코드 모두) — 그릴 때만 그 코드 몫을 받는다. 없는 코드(목록을 받은 뒤 지워짐)는 notFound — 문구는 서버 code 표(API_ERROR_TEXT)에서 온다. 아무도 안 쓴 코드는 빈 목록.
export function InviteUses({ code, actions }: { code: string; actions: UseActions }) {
  const query = useGroupInviteUses(code, true);
  const paging = useKeysetPaging(query, 'groupInviteUses');
  if (query.isPending) return <p className="soft">불러오는 중…</p>;
  if (isPortError(query.error, 'notFound')) return <p className="soft">{query.error.message}</p>;
  if (query.error)
    return <p className="msg err">{errorMessage(query.error, '가입한 사람을 불러오지 못했어요')}</p>;
  if (paging.items.length === 0) return <p className="soft">이 코드로 들어온 기록이 없어요</p>;
  return (
    <>
      <ExportUses code={code} friendCodes={actions.friendCodes} />
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
            <UseRow key={u.n} use={u} actions={actions} />
          ))}
        </tbody>
      </table>
      <Pager paging={paging} more={paging.more} />
    </>
  );
}

// 엑셀 — 화면은 쪽으로 받지만 파일에는 전부 넣는다(누를 때만 끝까지 받는다 · 5000명이면 쪽 50번 · 친구코드는 100명씩 나눈 사용자 조회를 한꺼번에).
function ExportUses({ code, friendCodes }: { code: string; friendCodes: FriendCodesOf }) {
  const port = useInvitePort();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const grid = await usesExportGrid(port, code, friendCodes);
      downloadBytes(await writeXlsx(grid, code), usesFileName(code, kstDateKey(Date.now())));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.actions}>
      {error !== null && <span className="msg err">{errorMessage(error, '엑셀로 내보내지 못했어요')}</span>}
      <button type="button" className="btn" disabled={busy} onClick={() => void run()}>
        {busy ? '내보내는 중…' : '엑셀로 내보내기'}
      </button>
    </div>
  );
}

function UseRow({ use, actions }: { use: GroupInviteUse; actions: UseActions }) {
  const { userCode } = use;
  return (
    <tr>
      <td>{use.n}</td>
      <td>{use.joinedAt !== null ? formatDate(use.joinedAt) : <span className="soft">—</span>}</td>
      <td>
        {userCode !== null ? (
          <button type="button" className="btn" title="복사" onClick={() => actions.copy(userCode)}>
            <code className="key soft">{userCode}</code>
          </button>
        ) : (
          <span className="soft">유저코드 없음</span>
        )}
      </td>
      <td>
        {userCode !== null ? (
          <button
            type="button"
            className={styles.link}
            title="회원 정보"
            onClick={() => actions.open(userCode)}
          >
            {use.name ?? '정보 보기'}
          </button>
        ) : (
          <span className="soft">—</span>
        )}
      </td>
    </tr>
  );
}
