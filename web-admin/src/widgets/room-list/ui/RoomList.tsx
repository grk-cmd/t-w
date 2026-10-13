import { useMemo } from 'react';
import {
  CHANNEL_LABEL,
  formatAgo,
  roomRows,
  roomStatsSummary,
  useRefreshRooms,
  useRoomCodes,
  useRoomIndex,
  useRoomProbes,
  useRoomStats,
  useSnapshotNow,
  type RoomRow,
} from '@/entities/room';
import { CloseRoomButton, CloseSelectedRoomsButton } from '@/features/room/close-room';
import { errorMessage, formatDate, usePaging, useSelection } from '@/shared/lib';
import { Pager, RowCheckbox, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import styles from './RoomList.module.css';

function RoomState({ row }: { row: RoomRow }) {
  if (row.secret)
    return <span title="roomIndex 에 안 적혀 신호를 모름 · 유령 방 청소 대상 아님">🔒 시크릿룸</span>;
  if (row.server)
    return row.alive ? (
      <span title={`방 서버(${row.server})에 열린 방 — Firebase 에 멤버가 없어도 정상`}>🛰 방 서버</span>
    ) : (
      <span className="warn" title="방 서버 신호가 90초 넘게 끊김 — 함수가 10분 뒤 줄을 걷는다">
        🛰 방 서버 · 신호 끊김
      </span>
    );
  if (row.alive) return <>🟢 살아 있음</>;
  if (row.kind === 'orphan')
    return (
      <span className="warn" title="rooms 에만 있고 roomIndex 에 줄이 없음">
        👻 고아
      </span>
    );
  return <span className="warn">👻 유령</span>;
}

export function RoomList() {
  const index = useRoomIndex();
  const codes = useRoomCodes();
  const probes = useRoomProbes(index.data, codes.data);
  const stats = useRoomStats();
  const now = useSnapshotNow(index.dataUpdatedAt);
  const refresh = useRefreshRooms();

  // 방 코드(shallow)를 못 받아도 roomIndex 만으로 목록은 보인다.
  const rows = useMemo(
    () =>
      index.data && now !== null && (codes.data || codes.error)
        ? roomRows(index.data, now, { codes: codes.data, probes: probes.data })
        : null,
    [index.data, codes.data, codes.error, probes.data, now],
  );
  const summary = now !== null ? roomStatsSummary(stats.data ?? null, now) : null;
  const aliveCount = rows?.filter((r) => r.alive).length ?? 0;
  const secretCount = rows?.filter((r) => r.secret).length ?? 0;
  const list = useMemo(() => rows ?? [], [rows]);
  // 방 서버 방은 고를 수 없다 — Firebase 에서 지워도 닫히지 않는다(종료 칸도 «—»).
  const ids = useMemo(() => list.filter((r) => !r.server).map((r) => r.code), [list]);
  const paging = usePaging(list, 'rooms');
  const pageIds = useMemo(() => paging.items.filter((r) => !r.server).map((r) => r.code), [paging.items]);
  const selection = useSelection(ids, pageIds);

  return (
    <section className="card">
      <div className="card-head">
        <h2>열린 방</h2>
        <span className="soft">
          {rows &&
            `살아 있음 ${aliveCount} · 전체 ${rows.length - secretCount}` +
              (secretCount ? ` · 시크릿룸 ${secretCount}` : '')}
        </span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>

      <div className={styles.stats}>
        {summary ? (
          <>
            <span>
              서버 집계 <b>{summary.total}</b>개 · {CHANNEL_LABEL.workingroom} {summary.workingroom} ·{' '}
              {CHANNEL_LABEL.togetherroom} {summary.togetherroom}
              {summary.server &&
                ` (방 서버 ${summary.server.workingroom + summary.server.togetherroom}개 포함)`}
            </span>
            <span className={summary.fresh ? 'soft' : 'warn'}>
              {summary.at !== null && now !== null ? `${formatAgo(now - summary.at)} 집계` : '집계 시각 없음'}
              {!summary.fresh && ' · 갱신 멈춤'}
            </span>
          </>
        ) : (
          <span className="soft">{stats.isLoading ? '집계 불러오는 중…' : '서버 집계 없음'}</span>
        )}
      </div>

      {index.error && <p className="msg err">{errorMessage(index.error, '방 목록을 불러오지 못했어요')}</p>}
      {codes.error && (
        <p className="msg err">
          {errorMessage(codes.error, 'rooms 의 방 코드를 받지 못해 roomIndex 의 방만 보여요')}
        </p>
      )}
      {!index.error && !rows && <p className="soft">불러오는 중…</p>}
      {rows && rows.length > 0 && (
        <SelectionBar count={selection.selected.length} onClear={selection.clear}>
          <CloseSelectedRoomsButton codes={selection.selected} onDone={selection.clear} />
        </SelectionBar>
      )}
      {rows && (
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
                <th>방 코드</th>
                <th>채널</th>
                <th>랜덤 공개</th>
                <th>인원</th>
                <th>마지막 신호</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="soft">
                    열린 방이 없어요
                  </td>
                </tr>
              )}
              {paging.items.map((row) => (
                <tr
                  key={row.code}
                  className={row.alive || row.secret || row.server ? undefined : styles.ghost}
                >
                  <td>
                    {!row.server && (
                      <RowCheckbox
                        label={`${row.code} 선택`}
                        checked={selection.isSelected(row.code)}
                        onChange={() => selection.toggle(row.code)}
                      />
                    )}
                  </td>
                  <td>
                    <code className="key">{row.code}</code>
                  </td>
                  <td>{row.channel ? CHANNEL_LABEL[row.channel] : <span className="soft">—</span>}</td>
                  <td>{row.open ? '🎲 공개' : <span className="soft">—</span>}</td>
                  <td>
                    {row.server ? (
                      <span className="soft" title="인원은 방 서버에 있다(Firebase 로는 모름)">
                        —
                      </span>
                    ) : row.members === null ? (
                      <span className="soft">{probes.error ? '—' : '…'}</span>
                    ) : (
                      `${row.members}명`
                    )}
                  </td>
                  <td title={row.lastSeen ? formatDate(row.lastSeen) : undefined}>
                    {row.lastSeen !== null && now !== null ? formatAgo(now - row.lastSeen) : '—'}
                  </td>
                  <td>
                    <RoomState row={row} />
                  </td>
                  <td>
                    {row.server ? (
                      <span className="soft" title="Firebase 에서 지워도 방 서버 방은 닫히지 않는다">
                        —
                      </span>
                    ) : (
                      <CloseRoomButton code={row.code} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} />
    </section>
  );
}
