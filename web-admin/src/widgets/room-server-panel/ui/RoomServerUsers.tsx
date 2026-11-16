import { useMemo, useState } from 'react';
import { ROOM_SERVER_MIN_APP_VER, useRoomServerConfig } from '@/entities/room-server';
import {
  isBadLicense,
  currentVer,
  LICENSE_LABEL,
  useRowName,
  useRowPresence,
  verLabel,
  type UserRow,
} from '@/entities/user';
import { appVerBlock, ServerSelect } from '@/features/room-server/manage-allow';
import {
  useReloadUsers,
  useUserPage,
  useUserPageKeyset,
  useUserRowsPort,
  useUserStats,
} from '@/features/user/user-rows';
import {
  errorMessage,
  formatDate,
  pageForSize,
  readPageSize,
  savePageSize,
  useDebouncedValue,
  useKeysetPaging,
  type Paging,
} from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './RoomServerUsers.module.css';

type Message = { text: string; error: boolean } | null;

// 이름이 계정 요약에 없을 때만 그 사람 이름 한 칸을 읽는다(사용자 화면과 같은 캐시).

type PresenceQuery = ReturnType<typeof useRowPresence>;

// 마지막 접속 — 보이는 쪽의 줄만 presence 한 칸씩 읽는다(사용자 화면과 같은 방식).
function LastSeen({ p }: { p: PresenceQuery }) {
  if (p.isLoading) return <span className="soft">…</span>;
  if (p.error) return <span className="soft">읽지 못함</span>;
  if (p.data?.online) return <span className={styles.online}>접속 중</span>;
  const seen = p.data?.lastSeen ? formatDate(p.data.lastSeen) : '—';
  // online 이 null 이면 «꺼짐» 이 아니라 «모름» 이다.
  return <span className="soft">{p.data?.online === null ? `접속 여부 모름 · ${seen}` : seen}</span>;
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
  const { name } = useRowName(row);
  const who = `${name ?? '이름 없음'}(${row.friendCode ?? row.userCode})`;
  // 앱 버전 — 마지막 접속과 같은 presence 한 번(따로 안 읽음).
  const presence = useRowPresence(row);
  const ver = currentVer(presence.data ?? null, row);
  const block = presence.isLoading ? null : appVerBlock(ver);
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
        <LastSeen p={presence} />
      </td>
      <td>
        <small className={block ? 'warn' : undefined}>{presence.isLoading ? '…' : verLabel(ver)}</small>
      </td>
      <td>
        <ServerSelect
          userCode={row.userCode}
          who={who}
          servers={servers}
          current={current}
          disabled={!row.hasAccount && !current}
          blocked={block !== null}
          onResult={onResult}
        />
        {block && (row.hasAccount || current) && <small className={`warn ${styles.block}`}>{block}</small>}
      </td>
    </tr>
  );
}

const LIST_KEY = 'roomServerUsers';
/** 입력이 이만큼 멈추면 묻는다 — 글자마다 서버에 묻지 않게. */
const SEARCH_DEBOUNCE_MS = 300;

interface ViewProps {
  text: string;
  onText: (text: string) => void;
  /** 조건에 맞는 수 · 전체 수 — 둘 다 받았을 때만. */
  count: string;
  error: Error | null;
  loaded: boolean;
  paging: Pick<Paging<UserRow>, 'items' | 'page' | 'pageCount' | 'size' | 'total' | 'setPage' | 'setSize'>;
  more?: boolean;
}

function RoomServerUsersView({ text, onText, count, error, loaded, paging, more }: ViewProps) {
  const reload = useReloadUsers();
  const { data: cfg } = useRoomServerConfig();
  const [message, setMessage] = useState<Message>(null);
  const servers = Object.keys(cfg?.servers ?? {}).sort();
  const onResult = (t: string, err: boolean) => setMessage({ text: t, error: err });

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="grow">사용자별 서버</h2>
        <span className="soft">{count}</span>
        <button type="button" className="btn" onClick={reload}>
          새로고침
        </button>
      </div>
      <p className="soft">
        고른 서버에 방을 만든다 · 투게더룸을 열려면 라이선스 필요(서버 지정은 어디에 열지만 정함) · 앱{' '}
        {ROOM_SERVER_MIN_APP_VER} 이상만.
      </p>
      <input
        type="search"
        className={styles.search}
        aria-label="사용자 찾기"
        placeholder="이름 · 친구 코드 · 사용자 코드(u…)"
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      {error && <p className="msg err">{errorMessage(error, '사용자 목록을 불러오지 못했어요')}</p>}
      {!error && !loaded && <p className="soft">불러오는 중…</p>}
      {loaded && (
        <div className={styles.wrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>친구코드</th>
                <th>라이선스</th>
                <th>마지막 접속</th>
                <th>앱 버전</th>
                <th>서버</th>
              </tr>
            </thead>
            <tbody>
              {paging.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="soft">
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
      <Pager paging={paging} more={more} />
    </section>
  );
}

// 사용자 목록에서 바로 서버 지정 — 사용자 화면과 같은 목록(API 사본 · 폴백은 통째 캐시)을 쪽 단위로, 줄마다 읽는 칸은 보이는 쪽만.
function PagedRoomServerUsers() {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(() => readPageSize(LIST_KEY));
  const list = useUserPage({ filter: 'all', q, ver: undefined }, page, size);
  const stats = useUserStats();
  const view = list.data;
  if (view && !list.isPlaceholderData && page > view.pageCount) setPage(view.pageCount);
  const paging = {
    items: view?.items ?? [],
    page: view?.page ?? page,
    pageCount: view?.pageCount ?? 1,
    size,
    total: view?.total ?? 0,
    setPage: (next: number) => setPage(Math.max(1, next)),
    setSize: (next: number) => {
      savePageSize(LIST_KEY, next);
      setPage(pageForSize(page, size, next));
      setSize(next);
    },
  };
  return (
    <RoomServerUsersView
      text={text}
      onText={(next) => {
        setText(next);
        setPage(1);
      }}
      count={view && stats.data ? `${view.total} / ${stats.data.total}명` : ''}
      error={list.error}
      loaded={!!view}
      paging={paging}
    />
  );
}

// API 판 — 서버가 찾고 센다. 받은 쪽을 이어 붙여 쪽으로 자른다.
function KeysetRoomServerUsers() {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const query = useMemo(() => ({ filter: 'all' as const, q, ver: undefined }), [q]);
  const list = useUserPageKeyset(query);
  const stats = useUserStats();
  const paging = useKeysetPaging(list, LIST_KEY);
  return (
    <RoomServerUsersView
      text={text}
      onText={(next) => {
        setText(next);
        paging.setPage(1);
      }}
      count={list.data && stats.data ? `${paging.total} / ${stats.data.total}명` : ''}
      error={list.error}
      loaded={!!list.data}
      paging={paging}
      more={paging.more}
    />
  );
}

export function RoomServerUsers() {
  return useUserRowsPort().kind === 'keyset' ? <KeysetRoomServerUsers /> : <PagedRoomServerUsers />;
}
