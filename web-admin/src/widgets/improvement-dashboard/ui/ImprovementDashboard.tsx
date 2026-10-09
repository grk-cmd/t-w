import { useMemo, useState } from 'react';
import {
  changePct,
  formatUsd,
  improvementResult,
  improvementWindows,
  mbPerConnOf,
  PRICES,
  toKstInput,
  useImprovements,
  useRefreshImprovements,
  useRefreshRecentUsage,
  useServerNow,
  useUsageDates,
  USD_KRW,
  WINDOW_DAYS,
  MONTH_DAYS,
  type DayUsage,
  type Improvement,
  type WindowStat,
} from '@/entities/metrics/usage';
import {
  ImprovementActions,
  ImprovementForm,
  SeedImprovementButton,
} from '@/features/metrics/edit-improvement';
import { DAY_MS, errorMessage, kstDateKey, kstDayStart } from '@/shared/lib';
import { DailyBars } from '@/shared/ui';
import styles from './ImprovementDashboard.module.css';

// 추세 그래프 날 수 — 어제까지(오늘은 덜 차서 접속당 값이 낮게 나온다)
const TREND_DAYS = 45;

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const span = (dates: readonly string[]) => `${shortDate(dates[0])}~${shortDate(dates[dates.length - 1])}`;
const fixed = (v: number | null, digits: number, unit: string) =>
  v === null
    ? '–'
    : `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
const pct = (v: number | null) => (v === null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);

export function ImprovementDashboard() {
  const now = useServerNow();
  const list = useImprovements();
  const refreshList = useRefreshImprovements();
  const refreshUsage = useRefreshRecentUsage();
  const [editing, setEditing] = useState<string | null>(null);
  const today = now.data === undefined ? undefined : kstDateKey(now.data);

  const trendDates = useMemo(
    () =>
      today
        ? Array.from({ length: TREND_DAYS }, (_, i) =>
            kstDateKey(kstDayStart(today) - (TREND_DAYS - i) * DAY_MS),
          )
        : [],
    [today],
  );
  const entries = list.data;
  const dates = useMemo(
    () => [
      ...trendDates,
      ...(entries ?? []).flatMap((e) => {
        const w = improvementWindows(e);
        return [...w.before, ...w.after];
      }),
    ],
    [trendDates, entries],
  );
  const usage = useUsageDates(dates, today);
  const byDate = usage.data;

  const trend = useMemo(
    () => (byDate ? trendDates.map((date) => ({ date, value: mbPerConnOf(byDate.get(date)) ?? 0 })) : null),
    [byDate, trendDates],
  );
  const markers = useMemo(
    () =>
      (entries ?? [])
        .map((e) => ({ date: kstDateKey(e.releasedAt), label: e.version, title: e.title }))
        .filter((m) => trendDates.includes(m.date)),
    [entries, trendDates],
  );

  const error = now.error ?? list.error ?? usage.error;
  const refresh = () => {
    void refreshList();
    void refreshUsage();
  };

  return (
    <>
      <div className={styles.toolbar}>
        <p className="soft">
          릴리스마다 DB 다운로드가 얼마나 줄었나 — 💰 사용량의 날짜 기록(서울)으로 계산
          <br />
          <strong>금액은 추정</strong>(${PRICES.dbDownloadPerGB}/GB · 1달러 = {USD_KRW.toLocaleString()}원) ·
          무료 한도 · 할인 · 세금 · 사용자 수 변화 미반영
        </p>
        <div className={styles.tools}>
          {entries && <SeedImprovementButton list={entries} />}
          <button type="button" className="btn" onClick={refresh} disabled={usage.fetching}>
            새로고침
          </button>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            추가
          </button>
        </div>
      </div>

      {error && <p className="warn">{errorMessage(error, '불러오기 실패')}</p>}
      {editing === 'new' && <ImprovementForm onDone={() => setEditing(null)} />}

      <section className={`card ${styles.trend}`} aria-label="접속당 다운로드 추세">
        <h2>접속당 다운로드 추세</h2>
        <p className="soft">하루 DB 다운로드 ÷ 그날 최대 동시 접속 · 빨간 점선 = 릴리스</p>
        {!trend ? (
          <p className="soft">불러오는 중…</p>
        ) : (
          <DailyBars
            label="접속당 다운로드"
            unit="MB"
            digits={1}
            days={trend}
            markers={markers}
            lastIsToday={false}
          />
        )}
      </section>

      {entries && entries.length === 0 && editing !== 'new' && (
        <section className="card">
          <p className="soft">기록 없음 — «추가» 또는 «0.10.2 기록 추가»</p>
        </section>
      )}
      {!entries && !list.error && <p className="soft">불러오는 중…</p>}

      {entries?.map((e) =>
        editing === e.id ? (
          <ImprovementForm key={e.id} entry={e} onDone={() => setEditing(null)} />
        ) : (
          <ImprovementCard
            key={e.id}
            entry={e}
            byDate={byDate}
            today={today}
            onEdit={() => setEditing(e.id)}
          />
        ),
      )}
    </>
  );
}

function ImprovementCard({
  entry,
  byDate,
  today,
  onEdit,
}: {
  entry: Improvement;
  byDate: ReadonlyMap<string, DayUsage> | undefined;
  today: string | undefined;
  onEdit: () => void;
}) {
  const w = improvementWindows(entry);
  const r = byDate && today ? improvementResult(entry, byDate, today, PRICES.dbDownloadPerGB) : null;
  const notYet = today !== undefined && w.after[0] >= today;
  const head = (label: string, dates: readonly string[], s: WindowStat | undefined, measuring: boolean) => (
    <>
      {label} <span className="soft">{span(dates)}</span>
      {s && (
        <small className={measuring ? 'warn' : 'soft'}>
          {measuring ? `측정 중 · ${s.days}일치` : `${s.days}일치`}
        </small>
      )}
    </>
  );
  const saving = r?.monthlySavingUsd ?? null;

  return (
    <section className={`card ${styles.entry}`} aria-label={entry.title}>
      <div className={styles.entryHead}>
        <div>
          <h2>{entry.title}</h2>
          <p className="soft">
            {entry.version} · 릴리스 {toKstInput(entry.releasedAt).replace('T', ' ')} · 적용 기간{' '}
            {entry.adoptDays}일
          </p>
        </div>
        <div className={styles.tools}>
          <ImprovementActions entry={entry} onEdit={onEdit} />
        </div>
      </div>
      <ul className={styles.items}>
        {entry.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            <th>{head('전', w.before, r?.before, !!r && r.before.days < WINDOW_DAYS)}</th>
            <th>{head('후', w.after, r?.after, !!r && r.measuring)}</th>
            <th>변화</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>하루 DB 다운로드</th>
            <td>{r ? fixed(r.before.gbPerDay, 1, 'GB') : '…'}</td>
            <td>{r ? fixed(r.after.gbPerDay, 1, 'GB') : '…'}</td>
            <td className={tone(r?.gbChangePct)}>{r ? pct(r.gbChangePct) : '…'}</td>
          </tr>
          <tr>
            <th>접속당 다운로드</th>
            <td>{r ? fixed(r.before.mbPerConn, 1, 'MB') : '…'}</td>
            <td>{r ? fixed(r.after.mbPerConn, 1, 'MB') : '…'}</td>
            <td className={tone(r?.perConnChangePct)}>{r ? pct(r.perConnChangePct) : '…'}</td>
          </tr>
          <tr>
            <th>최대 동시 접속(평균)</th>
            <td className="soft">{r ? fixed(r.before.peakAvg, 0, '') : '…'}</td>
            <td className="soft">{r ? fixed(r.after.peakAvg, 0, '') : '…'}</td>
            <td className="soft">{r ? pct(changePct(r.before.peakAvg, r.after.peakAvg)) : '…'}</td>
          </tr>
        </tbody>
      </table>

      <p className={styles.saving}>
        {notYet ? (
          <span className="soft">후 구간 {shortDate(w.after[0])}부터 측정</span>
        ) : saving === null ? (
          <span className="soft">{r ? '전 · 후 기록 부족 — 절감 추정 보류' : '…'}</span>
        ) : saving >= 0 ? (
          <>
            한 달 절감 추정 <strong>{formatUsd(saving)}</strong>
            {r?.measuring && <span className="warn"> · 측정 중 값</span>}
          </>
        ) : (
          <>
            한 달 증가 추정 <strong className="warn">{formatUsd(-saving)}</strong>
          </>
        )}
      </p>
      <p className={`soft ${styles.foot}`}>
        추정 = (전 − 후 하루 GB) × {MONTH_DAYS}일 × ${PRICES.dbDownloadPerGB}/GB · 전 = 릴리스 날 앞{' '}
        {WINDOW_DAYS}일 · 후 = 릴리스 + 적용 기간부터 {WINDOW_DAYS}일 · 오늘 · 기록 없는 날 제외
        <br />
        접속당 = 하루 다운로드 ÷ 그날 최대 동시 접속 — 최대 동시 접속은 순간 최대값(실제 접속자 수 아님)
      </p>
    </section>
  );
}

const tone = (v: number | null | undefined) =>
  v === null || v === undefined ? undefined : v < 0 ? styles.down : v > 0 ? 'warn' : undefined;
