import {
  KIND_LABEL,
  useRefreshXmas,
  useReportDetail,
  useXmasReports,
  type ReportDetail,
  type XmasReport,
  xmasErrorMessage,
} from '@/entities/seasonal/xmas-event';
import { XmasReportActions, type RemoveTarget } from '@/features/xmas/moderate-report';
import { formatDate, usePaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './XmasReportList.module.css';

function OrnamentView({
  report,
  detail,
}: {
  report: Extract<XmasReport, { kind: 'orn' }>;
  detail: ReportDetail;
}) {
  const data = detail.ornament;
  if (!data) return <p className="soft">이미 없는 장식이에요(지워짐) — 문제없음으로 비우면 돼요</p>;
  return (
    <div className={styles.orn}>
      <div className={styles.thumb}>
        {data.img ? (
          // 남이 올린 그림 — Storage xmas/{32자 id}.png 주소만 그린다
          <img src={data.img} alt="신고된 장식 그림" />
        ) : (
          <small className="soft">{KIND_LABEL[data.kind] ?? data.kind}</small>
        )}
      </div>
      <div>
        <div>{data.word ? `«${data.word}»` : <span className="soft">한마디 없음</span>}</div>
        <small className="soft">
          트리 #{report.tree} · 자리 {report.slot} · 건 사람 <code className="key">{data.owner ?? '?'}</code>
        </small>
      </div>
    </div>
  );
}

function LetterView({
  report,
  detail,
}: {
  report: Extract<XmasReport, { kind: 'got' }>;
  detail: ReportDetail;
}) {
  const data = detail.received;
  if (!data) return <p className="soft">편지를 찾지 못했어요(지워졌을 수 있어요)</p>;
  return (
    <div>
      <p className={styles.text}>{data.text}</p>
      <small className="soft">
        받은 사람 <code className="key">{report.got}</code> · {report.n}번째 · 쓴 사람{' '}
        <code className="key">{data.sender ?? '?'}</code>
      </small>
    </div>
  );
}

/** 지울 대상 — 이미 없으면 null(그때는 [문제없음] 만 · 판 없는 지우기를 보내지 않는다) */
function removableOf(report: XmasReport, d: ReportDetail): RemoveTarget | null {
  if (report.kind === 'orn')
    return d.ornament
      ? { key: report.key, kind: 'orn', tree: report.tree, slot: report.slot, version: d.ornament.version }
      : null;
  return d.received ? { key: report.key, kind: 'got', got: report.got, n: report.n } : null;
}

function ReportRow({ report }: { report: XmasReport }) {
  const { data, error, isLoading } = useReportDetail(report.key);
  return (
    <div className={`row ${styles.item}`}>
      <div className={styles.body}>
        <span>
          <b>{report.kind === 'orn' ? '🎄 장식' : '✉️ 받은 편지'}</b>{' '}
          <b className="warn">🚩 {report.count}명</b>
        </span>
        {/* 못 읽음과 «없음» 을 나눈다 — 못 읽었는데 «없어요 · 문제없음으로 비우면 돼요» 로 그리면 진짜 신고를 비우게 된다 */}
        {error && (
          <p className="msg err">{xmasErrorMessage(error, '신고를 불러오지 못했어요 — 새로고침해 주세요')}</p>
        )}
        {isLoading && <p className="soft">…</p>}
        {data &&
          (report.kind === 'orn' ? (
            <OrnamentView report={report} detail={data} />
          ) : (
            <LetterView report={report} detail={data} />
          ))}
        {data && (
          <ul className={styles.reasons}>
            {data.by.map((b, i) => (
              <li key={`${b.who}-${i}`}>
                {b.note || '메모 없음'}
                {b.at ? <small className="soft"> · {formatDate(b.at)}</small> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.actions}>
        {data && <XmasReportActions report={report} removable={removableOf(report, data)} />}
      </div>
    </div>
  );
}

/** 장식 · 받은 편지 신고 — 신고한 사람이 많은 순(서버가 정렬). 장식 신고는 그 장식이 바뀌면 지워지지 않으니 «문제없음» 으로 비운다. */
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
      {error && <p className="msg err">{xmasErrorMessage(error, '신고를 불러오지 못했어요')}</p>}
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
