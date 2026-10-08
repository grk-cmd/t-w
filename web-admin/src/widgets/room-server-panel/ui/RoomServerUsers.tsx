import { useMemo, useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import {
  isBadLicense,
  LICENSE_LABEL,
  realName,
  useUserName,
  useUserPresence,
  type UserRow,
} from '@/entities/user';
import { ServerSelect } from '@/features/room-server/manage-allow';
import { filterUsers } from '@/features/user/user-filter';
import { useUserRows } from '@/features/user/user-rows';
import { errorMessage, formatDate, usePaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './RoomServerUsers.module.css';

type Message = { text: string; error: boolean } | null;

// 이름이 계정 요약에 없을 때만 그 사람 이름 한 칸을 읽는다(사용자 화면과 같은 캐시).
function useRowName(row: UserRow): string | null {
  const fetched = useUserName(row.userCode, !row.name);
  return row.name ?? realName(fetched.data) ?? null;
}

// 마지막 접속 — 보이는 쪽의 줄만 presence 한 칸씩 읽는다(사용자 화면과 같은 방식).
function LastSeen({ uid }: { uid: string }) {
  const p = useUserPresence(uid);
  if (p.isLoading) return <span className="soft">…</span>;
  if (p.error) return <span className="soft">읽지 못함</span>;
  if (p.data?.online) return <span className={styles.online}>접속 중</span>;
  return <span className="soft">{p.data?.lastSeen ? formatDate(p.data.lastSeen) : '—'}</span>;
}

function UserLine({
  row,
  servers,
  current,
  onResult,
}: {
  row: UserRow;
  servers: string[];
  current: string | null;
  onResult: (text: string, error: boolean) => void;
}) {
  const name = useRowName(row);
  const who = `${name ?? '이름 없음'}(${row.friendCode ?? row.userCode})`;
  return (
    <tr>
      <td>{name ?? <span className="soft">이름 없음</span>}</td>
      <td>
        <code className="key">{row.friendCode ?? '—'}</code>
      </td>
      <td>
        <small className={isBadLicense(row.licenseState) ? 'warn' : 'soft'}>
          {LICENSE_LABEL[row.licenseState]}
        </small>
      </td>
      <td>
        <LastSeen uid={row.userCode} />
      </td>
      <td>
        <ServerSelect
          userCode={row.userCode}
          who={who}
          servers={servers}
          current={current}
          disabled={!row.hasAccount && !current}
          onResult={onResult}
        />
      </td>
    </tr>
  );
}

// 사용자 목록에서 바로 서버 지정 — 목록은 사용자 화면과 같은 요약(캐시 공유) · 쪽 단위로만 줄마다 읽는다.
export function RoomServerUsers() {
  const { rows, error, refresh } = useUserRows();
  const { data: cfg } = useRoomServerConfig();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const found = useMemo(() => (rows ? filterUsers(rows, 'all', text) : []), [rows, text]);
  const paging = usePaging(found, 'roomServerUsers');
  const servers = Object.keys(cfg?.servers ?? {}).sort();
  const onResult = (t: string, err: boolean) => setMessage({ text: t, error: err });

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="grow">사용자별 서버</h2>
        <span className="soft">{rows && `${found.length} / ${rows.length}명`}</span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <p className="soft">
        고른 서버에 방을 만든다 · 투게더룸을 열려면 라이선스 필요(서버 지정은 어디에 열지만 정함).
      </p>
      <input
        type="search"
        className={styles.search}
        aria-label="사용자 찾기"
        placeholder="이름 · 친구 코드 · 사용자 코드(u…)"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          paging.setPage(1);
        }}
      />
      {error && <p className="msg err">{errorMessage(error, '사용자 목록을 불러오지 못했어요')}</p>}
      {!error && !rows && <p className="soft">불러오는 중…</p>}
      {rows && (
        <div className={styles.wrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>친구코드</th>
                <th>라이선스</th>
                <th>마지막 접속</th>
                <th>서버</th>
              </tr>
            </thead>
            <tbody>
              {paging.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="soft">
                    맞는 사용자 없음
                  </td>
                </tr>
              )}
              {paging.items.map((row) => (
                <UserLine
                  key={row.userCode}
                  row={row}
                  servers={servers}
                  current={cfg?.allow[row.userCode] ?? null}
                  onResult={onResult}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
      <Pager paging={paging} />
    </section>
  );
}
