import {
  KIND_LABEL,
  shortUid,
  useOrnament,
  useRefreshXmas,
  useReportedLetter,
  useXmasReports,
  type XmasReport,
} from '@/entities/seasonal/xmas-event';
import { XmasReportActions } from '@/features/xmas/moderate-report';
import { errorMessage, formatDate, usePaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './XmasReportList.module.css';

function OrnamentView({ tree, slot }: { tree: number; slot: number }) {
  const { data, isLoading } = useOrnament(tree, slot);
  if (isLoading) return <p className="soft">…</p>;
  if (!data) return <p className="soft">이미 없는 장식이에요(바꿨거나 지워짐) — 문제없음으로 비우면 돼요</p>;
  return (
    <div className={styles.orn}>
      <div className={styles.thumb}>
        {data.img ? (
          <img src={data.img} alt="신고된 장식 그림" />
        ) : (
          <small className="soft">{KIND_LABEL[data.kind] ?? data.kind}</small>
        )}
      </div>
      <div>
        <div>{data.word ? `«${data.word}»` : <span className="soft">한마디 없음</span>}</div>
        <small className="soft">
          트리 #{tree} · 자리 {slot} · 건 사람{' '}
          <code className="key" title={data.owner ?? ''}>
            {data.owner ? shortUid(data.owner) : '?'}
          </code>
        </small>
      </div>
    </div>
  );
}

function LetterView({ got, n }: { got: string; n: number }) {
  const { data, isLoading } = useReportedLetter(got, n);
  if (isLoading) return <p className="soft">…</p>;
  if (!data) return <p className="soft">편지를 찾지 못했어요(지워졌을 수 있어요)</p>;
  return (
    <div>
      <p className={styles.text}>{data.text}</p>
      <small className="soft">
        받은 사람{' '}
        <code className="key" title={got}>
          {shortUid(got)}
        </code>{' '}
        · {n}번째 · 쓴 사람{' '}
        <code className="key" title={data.uid}>
          {shortUid(data.uid)}
        </code>
      </small>
    </div>
  );
}

function ReportRow({ report }: { report: XmasReport }) {
  return (
    <div className={`row ${styles.item}`}>
      <div className={styles.body}>
        <span>
          <b>{report.kind === 'orn' ? '🎄 장식' : '✉️ 받은 편지'}</b>{' '}
          <b className="warn">🚩 {report.by.length}명</b>
        </span>
        {report.kind === 'orn' ? (
          <OrnamentView tree={report.tree} slot={report.slot} />
        ) : (
          <LetterView got={report.got} n={report.n} />
        )}
        <ul className={styles.reasons}>
          {report.by.map((b) => (
            <li key={b.uid}>
              {b.note || '메모 없음'}
              {b.ts ? <small className="soft"> · {formatDate(b.ts)}</small> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.actions}>
        <XmasReportActions report={report} />
      </div>
    </div>
  );
}

/** 장식 · 받은 편지 신고 — 신고한 사람이 많은 순. 장식 신고는 그 장식이 바뀌면 지워지지 않으니 «문제없음» 으로 비운다. */
export function XmasReportList() {
  const { data, error } = useXmasReports();
  const refresh = useRefreshXmas();
  const paging = usePaging(data ?? [], 'xmasReports');
  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">크리스마스 신고{data && ` · ${data.length}건`}</span>
        <button type="button" className="btn" onClick={refresh.reports}>
          새로고침
        </button>
      </div>
      {error && <p className="msg err">{errorMessage(error, '신고를 불러오지 못했어요')}</p>}
      {!error && !data && <p className="soft">불러오는 중…</p>}
      {data?.length === 0 && <p className="soft">살펴볼 신고가 없어요</p>}
      {data && data.length > 0 && (
        <>
          <div className="list">
            {paging.items.map((r) => (
              <ReportRow key={r.key} report={r} />
            ))}
          </div>
          <Pager paging={paging} />
        </>
      )}
    </section>
  );
}
