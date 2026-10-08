import { useState } from 'react';
import {
  BUG_CATS,
  BUG_FILTERS,
  BugNoText,
  StatusChip,
  useBugNo,
  useBugPage,
  usePrvTitle,
  useRefreshBugBoard,
  type BugCursor,
  type BugFilter,
  type BugItem,
} from '@/entities/bug-board';
import { errorMessage, formatDate } from '@/shared/lib';
import styles from './BugBoardList.module.css';

function Title({ item }: { item: BugItem }) {
  const prv = usePrvTitle(item);
  if (item.vis === 'pub') return <>{item.title || <span className="soft">(제목 없음)</span>}</>;
  if (prv.isLoading) return <span className="soft">…</span>;
  if (prv.error) return <span className="soft">읽지 못함</span>;
  return <>{prv.data || <span className="soft">(제목 없음)</span>}</>;
}

function Row({ item, onOpen }: { item: BugItem; onOpen: (id: string) => void }) {
  const no = useBugNo(item);
  return (
    <tr>
      <td>
        <button type="button" className={styles.link} onClick={() => onOpen(item.id)}>
          <BugNoText value={no} />
        </button>
      </td>
      <td>
        <StatusChip status={item.status} />
      </td>
      <td>{BUG_CATS[item.cat] ?? item.cat}</td>
      <td>{item.notice ? '📌 공지' : item.vis === 'pub' ? '공개' : '🔒 비공개'}</td>
      <td className={styles.title}>
        <button type="button" className={styles.link} onClick={() => onOpen(item.id)}>
          <Title item={item} />
        </button>
      </td>
      <td>
        {item.name || <span className="soft">이름 없음</span>} <small className="soft key">{item.code}</small>
      </td>
      <td>{formatDate(item.ts)}</td>
      <td className={styles.num}>{item.ansN ?? 0}</td>
    </tr>
  );
}

/**
 * 한 쪽 20개씩(규칙 상한) — 앞 쪽들의 자리(cursor)를 쌓아 [이전] 으로 돌아간다.
 * 쪽 수 · 총 개수는 모른다(세려면 전부 받아야 한다).
 */
export function BugBoardList({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<BugFilter>('open');
  const [cursors, setCursors] = useState<(BugCursor | null)[]>([null]);
  const before = cursors[cursors.length - 1];
  const { data, error, isFetching } = useBugPage(filter, before);
  const refresh = useRefreshBugBoard();

  const pick = (next: BugFilter) => {
    setFilter(next);
    setCursors([null]);
  };
  const page = cursors.length;

  return (
    <section className="card">
      <div className="card-head">
        <h2>🐞 버그 제보</h2>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <div className={styles.chips}>
        {BUG_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === filter}
            className={f.id === filter ? `${styles.filter} ${styles.on}` : styles.filter}
            onClick={() => pick(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="msg err">{errorMessage(error, '제보 목록 불러오기 실패')}</p>}
      {!error && !data && <p className="soft">불러오는 중…</p>}
      {data && data.items.length === 0 && <p className="soft">해당 제보 없음</p>}
      {data && data.items.length > 0 && (
        <div className={styles.wrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>번호</th>
                <th>상태</th>
                <th>분류</th>
                <th>공개</th>
                <th>제목</th>
                <th>작성자</th>
                <th>작성</th>
                <th>답변</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <Row key={item.id} item={item} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.pager}>
        <button
          type="button"
          className="btn"
          disabled={page <= 1 || isFetching}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          이전
        </button>
        <span className="soft">{page}쪽</span>
        <button
          type="button"
          className="btn"
          disabled={!data?.next || isFetching}
          onClick={() => data?.next && setCursors([...cursors, data.next])}
        >
          다음
        </button>
      </div>
    </section>
  );
}
