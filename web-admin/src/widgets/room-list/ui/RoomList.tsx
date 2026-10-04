import { useMemo } from 'react';
import {
  CHANNEL_LABEL,
  formatAgo,
  roomRows,
  roomStatsSummary,
  useRefreshRooms,
  useRoomIndex,
  useRoomStats,
  useServerNow,
} from '@/entities/room';
import { CloseRoomButton, CloseSelectedRoomsButton } from '@/features/room/close-room';
import { errorMessage, formatDate, useSelection } from '@/shared/lib';
import { RowCheckbox, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import styles from './RoomList.module.css';

export function RoomList() {
  const index = useRoomIndex();
  const stats = useRoomStats();
  const now = useServerNow();
  const refresh = useRefreshRooms();

  const rows = useMemo(
    () => (index.data && now !== null ? roomRows(index.data, now) : null),
    [index.data, now],
  );
  const summary = now !== null ? roomStatsSummary(stats.data ?? null, now) : null;
  const aliveCount = rows?.filter((r) => r.alive).length ?? 0;
  const ids = useMemo(() => (rows ?? []).map((r) => r.code), [rows]);
  const selection = useSelection(ids);

  return (
    <section className="card">
      <div className="card-head">
        <h2>열린 방</h2>
        <span className="soft">{rows && `살아 있음 ${aliveCount} · 전체 ${rows.length}`}</span>
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
                    label="전체 선택"
                    allChecked={selection.allChecked}
                    someChecked={selection.someChecked}
                    disabled={rows.length === 0}
                    onChange={selection.toggleAll}
                  />
                </th>
                <th>방 코드</th>
                <th>채널</th>
                <th>랜덤 공개</th>
                <th>마지막 신호</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="soft">
                    열린 방이 없어요
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.code} className={row.alive ? undefined : styles.ghost}>
                  <td>
                    <RowCheckbox
                      label={`${row.code} 선택`}
                      checked={selection.isSelected(row.code)}
                      onChange={() => selection.toggle(row.code)}
                    />
                  </td>
                  <td>
                    <code className="key">{row.code}</code>
                  </td>
                  <td>{CHANNEL_LABEL[row.channel]}</td>
                  <td>{row.open ? '🎲 공개' : <span className="soft">—</span>}</td>
                  <td title={row.lastSeen ? formatDate(row.lastSeen) : undefined}>
                    {row.lastSeen !== null && now !== null ? formatAgo(now - row.lastSeen) : '—'}
                  </td>
                  <td>{row.alive ? '🟢 살아 있음' : <span className="warn">👻 유령</span>}</td>
                  <td>
                    <CloseRoomButton code={row.code} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
