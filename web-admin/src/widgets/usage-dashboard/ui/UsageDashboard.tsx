import { useMemo, type ReactNode } from 'react';
import {
  ALERT_RATIO,
  byteUnit,
  BYTES_PER_GB,
  formatUsd,
  FREE,
  overAverage,
  PRICES,
  usageStats,
  useRecentUsage,
  useRefreshRecentUsage,
  type ByteUnit,
  type DayUsage,
} from '@/entities/metrics/usage';
import { errorMessage, formatDate } from '@/shared/lib';
import { DailyBars, StatSection, type DailyPoint } from '@/shared/ui';
import styles from './UsageDashboard.module.css';

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const gb = (bytes: number) => bytes / BYTES_PER_GB;
const points = (days: readonly DayUsage[], value: (d: DayUsage) => number | null): DailyPoint[] =>
  days.map((d) => ({ date: d.date, value: value(d) ?? 0 }));
const fmtIn = (u: ByteUnit) => (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: u.digits });
const inUnit = (bytes: number | null | undefined, u: ByteUnit) =>
  bytes === undefined ? undefined : bytes === null ? null : bytes / u.div;
const sumOf = (days: readonly DayUsage[], value: (d: DayUsage) => number | null) =>
  days.reduce((s, d) => s + (value(d) ?? 0), 0);

/** 한 다운로드 계열(바이트)의 숫자 칸 넷 · 경고 · 그래프 — DB · Storage 가 같은 모양이다. */
function useBytesSeries(
  days: DayUsage[] | undefined,
  value: (d: DayUsage) => number | null,
  at: (d: DayUsage) => number | null,
) {
  return useMemo(() => {
    if (!days) return null;
    const today = days[days.length - 1];
    const yesterday = days[days.length - 2] ?? null;
    const s = usageStats(days, value, at(today));
    const unit = byteUnit(Math.max(s.max, s.todayProjected ?? 0));
    const yv = yesterday ? value(yesterday) : null;
    return {
      unit,
      stats: s,
      today: value(today),
      yesterday: yv,
      todayAlert: overAverage(s.todayProjected, s),
      yesterdayAlert: overAverage(yv, s),
      points: points(days, (d) => {
        const v = value(d);
        return v === null ? null : v / unit.div;
      }),
    };
  }, [days, value, at]);
}

const dbSent = (d: DayUsage) => d.db?.sentBytes ?? null;
const dbAt = (d: DayUsage) => d.db?.at ?? null;
const stSent = (d: DayUsage) => d.storage?.sentBytes ?? null;
const stAt = (d: DayUsage) => d.storage?.at ?? null;
const fnCalls = (d: DayUsage) => d.functions?.calls ?? null;
const peak = (d: DayUsage) => d.db?.peakConnections ?? null;

export function UsageDashboard() {
  const usage = useRecentUsage();
  const refresh = useRefreshRecentUsage();
  const days = usage.data;
  const today = days?.at(-1);
  const yesterday = days && days.length > 1 ? days[days.length - 2] : null;
  const recorded = days?.find((d) => d.db || d.functions || d.storage || d.hosting)?.date;

  const db = useBytesSeries(days, dbSent, dbAt);
  const st = useBytesSeries(days, stSent, stAt);
  const fn = useMemo(
    () => (days ? usageStats(days, fnCalls, today?.functions?.at ?? null) : null),
    [days, today],
  );
  const conn = useMemo(() => (days ? usageStats(days, peak, null) : null), [days]);
  const fnMonth = days ? sumOf(days, fnCalls) : undefined;

  // 저장 용량은 «지금 얼마» 라 가장 최근 값(오늘이 없으면 어제)
  const latest = (pick: (d: DayUsage) => number | null | undefined) => {
    if (!days) return undefined;
    for (let i = days.length - 1; i >= Math.max(0, days.length - 2); i--) {
      const v = pick(days[i]);
      if (typeof v === 'number') return v;
    }
    return null;
  };
  const dbStored = latest((d) => d.db?.storedBytes);
  const stStored = latest((d) => d.storage?.storedBytes);

  const body = (render: () => ReactNode) =>
    usage.error ? (
      <p className="warn">{errorMessage(usage.error, '사용량을 불러오지 못했어요')}</p>
    ) : !days ? (
      <p className="soft">불러오는 중…</p>
    ) : (
      render()
    );

  const since =
    days === undefined
      ? ''
      : recorded
        ? ` · ${recorded}부터 기록`
        : ' · 기록이 아직 없음(서버 함수 usageSnapshot 이 매시간 기록)';

  const downloadAlert = (name: string, s: NonNullable<typeof db>): ReactNode => {
    if (!s.todayAlert && !s.yesterdayAlert) return undefined;
    const f = (v: number) => `${fmtIn(s.unit)(v / s.unit.div)} ${s.unit.unit}`;
    const avg = f(s.stats.avg ?? 0);
    const which = [
      s.todayAlert && s.stats.todayProjected !== null ? `오늘(하루로 환산 ${f(s.stats.todayProjected)})` : '',
      s.yesterdayAlert && s.yesterday !== null ? `어제(${f(s.yesterday)})` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return `${name} 다운로드 평소보다 많음 — ${which}, 지난날 일평균(${avg})의 ${ALERT_RATIO}배 넘음`;
  };

  const usd = (v: number | null | undefined) => (typeof v === 'number' ? `추정 ${formatUsd(v)}` : undefined);

  return (
    <>
      <div className={styles.toolbar}>
        <p className="soft">
          서울 날짜 기준 · 매시간 갱신(어제 · 오늘)
          {today?.db ? ` · 마지막 측정 ${formatDate(today.db.at)}` : ''}
          <br />
          <strong>금액은 추정</strong> — 다운로드는 무료 한도 빼기 전 정가, 저장 용량 · 함수 호출은 무료 한도
          초과분만. 할인 · 세금 제외. 실제 금액은 Google Cloud 결제 화면 기준.
        </p>
        <button type="button" className="btn" onClick={() => void refresh()} disabled={usage.fetching}>
          새로고침
        </button>
      </div>

      <StatSection
        title="DB 다운로드"
        desc={<>앱 · 웹 관리자가 Realtime Database 에서 내려받은 양 — 요금 대부분이 여기서 나와요{since}</>}
        stats={
          db
            ? [
                {
                  label: '오늘',
                  value: inUnit(db.today, db.unit),
                  unit: db.unit.unit,
                  format: fmtIn(db.unit),
                  main: true,
                  alert: db.todayAlert,
                  hint: '오늘 0시부터 지금까지 — 하루가 끝날 때까지 늘어남',
                  sub:
                    db.stats.todayProjected !== null
                      ? `하루 환산 ${fmtIn(db.unit)(db.stats.todayProjected / db.unit.div)}${db.unit.unit} · ${usd(gb(db.stats.todayProjected) * PRICES.dbDownloadPerGB)}`
                      : undefined,
                },
                {
                  label: '어제',
                  value: inUnit(db.yesterday, db.unit),
                  unit: db.unit.unit,
                  format: fmtIn(db.unit),
                  alert: db.yesterdayAlert,
                  sub: db.yesterday !== null ? usd(gb(db.yesterday) * PRICES.dbDownloadPerGB) : undefined,
                },
                {
                  label: '일평균',
                  value: inUnit(db.stats.avg, db.unit),
                  unit: db.unit.unit,
                  format: fmtIn(db.unit),
                  hint: '오늘 · 어제를 뺀 지난날 평균(기록이 있는 날만)',
                  sub:
                    db.stats.avg !== null
                      ? `한 달 ${usd(gb(db.stats.avg) * 30 * PRICES.dbDownloadPerGB)}`
                      : undefined,
                },
                {
                  label: '최대',
                  value: inUnit(db.stats.max, db.unit),
                  unit: db.unit.unit,
                  format: fmtIn(db.unit),
                  sub: db.stats.maxDate ? shortDate(db.stats.maxDate) : undefined,
                },
              ]
            : loadingStats(['오늘', '어제', '일평균', '최대'])
        }
        alert={db ? downloadAlert('DB', db) : undefined}
        chart={body(() => (
          <DailyBars label="DB 다운로드" unit={db!.unit.unit} digits={db!.unit.digits} days={db!.points} />
        ))}
        foot={`추정 금액 = 다운로드 × $${PRICES.dbDownloadPerGB}/GB (무료 한도 월 ${FREE.dbDownloadGBMonth}GB 빼기 전)`}
      />

      <StatSection
        title="함수 호출"
        desc="Cloud Functions 가 불린 횟수 — 예약 함수(1분마다 방 집계 등) · 앱이 부르는 함수 모두"
        stats={[
          {
            label: '오늘',
            value: days ? (today ? fnCalls(today) : null) : undefined,
            unit: '회',
            main: true,
          },
          { label: '어제', value: days ? (yesterday ? fnCalls(yesterday) : null) : undefined, unit: '회' },
          {
            label: '일평균',
            value: fn ? (fn.avg === null ? null : Math.round(fn.avg)) : undefined,
            unit: '회',
            hint: '오늘 · 어제를 뺀 지난날 평균(기록이 있는 날만)',
          },
          {
            label: '최근 30일 합',
            value: fnMonth,
            unit: '회',
            sub:
              fnMonth === undefined
                ? undefined
                : fnMonth <= FREE.functionsCallsMonth
                  ? `무료 한도 안 (월 ${(FREE.functionsCallsMonth / 10_000).toLocaleString()}만 회)`
                  : usd(((fnMonth - FREE.functionsCallsMonth) / 1_000_000) * PRICES.functionsPerMillion),
          },
        ]}
        chart={body(() => (
          <DailyBars label="함수 호출" unit="회" days={points(days!, fnCalls)} />
        ))}
        foot={
          yesterday?.functions && Object.keys(yesterday.functions.byName).length
            ? `어제 함수별: ${Object.entries(yesterday.functions.byName)
                .sort((a, b) => b[1] - a[1])
                .map(([name, v]) => `${name} ${v.toLocaleString()}`)
                .join(' · ')} — 호출 요금만 셈(CPU · 메모리 시간 요금 제외)`
            : '호출 요금만 셈(CPU · 메모리 시간 요금 제외)'
        }
      />

      <StatSection
        title="Storage"
        desc="Firebase Storage(그림 · 3D 파일) 버킷에서 내려받은 양과 저장 용량 — 함수 배포 소스 버킷은 뺌"
        stats={
          st
            ? [
                {
                  label: '오늘 다운로드',
                  value: inUnit(st.today, st.unit),
                  unit: st.unit.unit,
                  format: fmtIn(st.unit),
                  main: true,
                  alert: st.todayAlert,
                  sub:
                    st.stats.todayProjected !== null
                      ? `하루 환산 ${fmtIn(st.unit)(st.stats.todayProjected / st.unit.div)}${st.unit.unit} · ${usd(gb(st.stats.todayProjected) * PRICES.storageDownloadPerGB)}`
                      : undefined,
                },
                {
                  label: '어제 다운로드',
                  value: inUnit(st.yesterday, st.unit),
                  unit: st.unit.unit,
                  format: fmtIn(st.unit),
                  alert: st.yesterdayAlert,
                  sub:
                    st.yesterday !== null ? usd(gb(st.yesterday) * PRICES.storageDownloadPerGB) : undefined,
                },
                {
                  label: '일평균 다운로드',
                  value: inUnit(st.stats.avg, st.unit),
                  unit: st.unit.unit,
                  format: fmtIn(st.unit),
                  hint: '오늘 · 어제를 뺀 지난날 평균(기록이 있는 날만)',
                  sub:
                    st.stats.avg !== null
                      ? `한 달 ${usd(gb(st.stats.avg) * 30 * PRICES.storageDownloadPerGB)}`
                      : undefined,
                },
                storedStat('저장 용량', stStored, PRICES.storageStoragePerGBMonth, FREE.storageStorageGB),
              ]
            : loadingStats(['오늘 다운로드', '어제 다운로드', '일평균 다운로드', '저장 용량'])
        }
        alert={st ? downloadAlert('Storage', st) : undefined}
        chart={body(() => (
          <DailyBars
            label="Storage 다운로드"
            unit={st!.unit.unit}
            digits={st!.unit.digits}
            days={st!.points}
          />
        ))}
        foot={`추정 금액 = 다운로드 × $${PRICES.storageDownloadPerGB}/GB · 저장 × $${PRICES.storageStoragePerGBMonth}/GB·월 (다운로드는 무료 월 ${FREE.storageDownloadGBMonth}GB 빼기 전 · 저장은 무료 ${FREE.storageStorageGB}GB 넘는 만큼)${
          yesterday?.hosting
            ? ` · 참고: 어제 Hosting(웹 관리자 · 안내 페이지) 다운로드 ${hostingText(yesterday.hosting.sentBytes)}`
            : ''
        }`}
      />

      <StatSection
        title="DB 저장 용량 · 최대 동시 접속"
        desc="Realtime Database 에 쌓인 데이터 크기와 한 번에 연결된 기기 수(Spark 한도 100 · Blaze 한도 20만)"
        stats={[
          storedStat('DB 저장 용량', dbStored, PRICES.dbStoragePerGBMonth, FREE.dbStorageGB),
          {
            label: '오늘 최대 동시 접속',
            value: days ? (today ? peak(today) : null) : undefined,
            unit: '개',
            main: true,
          },
          {
            label: '어제 최대 동시 접속',
            value: days ? (yesterday ? peak(yesterday) : null) : undefined,
            unit: '개',
          },
          {
            label: '30일 최대',
            value: conn?.max,
            unit: '개',
            sub: conn?.maxDate ? shortDate(conn.maxDate) : undefined,
          },
        ]}
        chart={body(() => (
          <DailyBars label="최대 동시 접속" unit="개" days={points(days!, peak)} />
        ))}
        foot={`추정 금액 = 저장 × $${PRICES.dbStoragePerGBMonth}/GB·월 (무료 ${FREE.dbStorageGB}GB 넘는 만큼)`}
      />
    </>
  );
}

function loadingStats(labels: string[]) {
  return labels.map((label) => ({ label, value: undefined, unit: '' }));
}

function hostingText(bytes: number) {
  const u = byteUnit(bytes);
  return `${fmtIn(u)(bytes / u.div)} ${u.unit}`;
}

/** 저장 용량 칸 — 단위 자동 · 무료 한도를 넘는 만큼의 한 달 추정 금액. */
function storedStat(label: string, bytes: number | null | undefined, perGBMonth: number, freeGB: number) {
  const u = byteUnit(bytes ?? 0);
  return {
    label,
    value: inUnit(bytes, u),
    unit: bytes == null ? '' : u.unit,
    format: fmtIn(u),
    hint: '가장 최근에 잰 값',
    sub:
      typeof bytes === 'number'
        ? gb(bytes) <= freeGB
          ? `무료 한도 안 (${freeGB}GB)`
          : `한 달 추정 ${formatUsd((gb(bytes) - freeGB) * perGBMonth)}`
        : undefined,
  };
}
