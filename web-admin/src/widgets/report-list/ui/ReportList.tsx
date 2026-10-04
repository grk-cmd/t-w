import { reportReason, type ReportTarget } from '@/entities/report';
import { realName, useUserBrief } from '@/entities/user';
import { ReportActions } from '@/features/user/moderate-report';
import { formatDate, type Selection } from '@/shared/lib';
import { RowCheckbox } from '@/shared/ui';
import styles from './ReportList.module.css';

// 신고된 사람 한 명당 이름 · 친구코드 · 그림 세 칸만 읽는다 — 목록에 뜬 사람(3명 이상 신고)만.
function ReportRow({ item, selection }: { item: ReportTarget; selection: Selection }) {
  const brief = useUserBrief(item.target);
  const b = brief.data;
  const name = realName(b?.name);
  const who = name ?? b?.friendCode ?? item.target;

  return (
    <div className={`row ${styles.item}`}>
      <RowCheckbox
        label={`${who} 선택`}
        checked={selection.isSelected(item.target)}
        onChange={() => selection.toggle(item.target)}
      />
      <div className={styles.thumb}>
        {b?.awayImg ? (
          <a href={b.awayImg} target="_blank" rel="noreferrer" title="원본 크게 보기">
            <img src={b.awayImg} alt={`${who} 님의 자리비움 그림`} />
          </a>
        ) : (
          <small className="soft">{brief.isLoading ? '…' : '그림 없음'}</small>
        )}
      </div>
      <div className={styles.body}>
        <span className="grow">
          <b>{name ?? (brief.isLoading ? '…' : '이름 없음')}</b>
          <code className="key">{b?.friendCode ?? item.target}</code>
          <b className="warn">🚩 {item.reports.length}명</b>
        </span>
        <ul className={styles.reasons}>
          {item.reports.map((r, i) => (
            <li key={i}>
              {r.nick || '이름 없음'} #{r.code4 || '----'} · {reportReason(r)}
              {r.ts ? <small className="soft"> · {formatDate(r.ts)}</small> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.actions}>
        <ReportActions target={item.target} who={who} awayImg={b?.awayImg ?? null} />
      </div>
    </div>
  );
}

/** 선택은 신고된 사람(target)으로 — 페이지가 고른 것을 들고 있다. */
export function ReportList({ items, selection }: { items: ReportTarget[]; selection: Selection }) {
  return (
    <div className="list">
      {items.map((item) => (
        <ReportRow key={item.target} item={item} selection={selection} />
      ))}
    </div>
  );
}
