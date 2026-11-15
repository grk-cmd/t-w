// API 판 — `GET /v2/admin/metrics/daily?days=` 한 번이 `{ today, wau, mau, days[] }` 다(Firebase 판은 날마다 읽고 화면이 WAU · MAU 를 셌다).
// 날마다 묻는 포트 모양에 맞춰 목록을 한 번 받아 두고(2초) 날짜마다 돌려준다. WAU · MAU 는 «오늘» 줄에 싣는다.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import { offsetFromServerToday } from '@/shared/lib';
import type { DayMetrics } from '../model/metrics';
import type { MetricsPort } from './port';

const PATH = adminPath('/metrics/daily');
/** 서버가 받는 가장 긴 기간(1~92). */
const RANGE_DAYS = 92;
const FRESH_MS = 2000;

interface Wire {
  today?: unknown;
  wau?: unknown;
  mau?: unknown;
  days?: { day?: unknown; dau?: unknown; visits?: unknown; ipVisitors?: unknown; pings?: unknown }[];
}

interface Range {
  today: string;
  rows: Map<string, DayMetrics>;
  receivedAt: number;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function parse(wire: Wire, receivedAt: number): Range {
  const today = typeof wire.today === 'string' ? wire.today : '';
  const rows = new Map<string, DayMetrics>();
  for (const d of wire.days ?? []) {
    if (typeof d.day !== 'string') continue;
    rows.set(d.day, {
      date: d.day,
      users: [],
      dau: count(d.dau),
      visits: count(d.visits),
      ipVisitors: count(d.ipVisitors),
      pings: count(d.pings),
    });
  }
  const last = rows.get(today);
  if (last) {
    last.wau = count(wire.wau);
    last.mau = count(wire.mau);
  }
  return { today, rows, receivedAt };
}

function build(api: Api | null): MetricsPort {
  let cached: Range | null = null;
  let loading: Promise<Range> | null = null;

  function range(): Promise<Range> {
    if (cached && Date.now() - cached.receivedAt < FRESH_MS) return Promise.resolve(cached);
    loading ??= portCall(
      api,
      async (a) => (cached = parse(await a.get<Wire>(PATH, { days: RANGE_DAYS }), Date.now())),
      '지표를 불러오지 못했어요',
    ).finally(() => {
      loading = null;
    });
    return loading;
  }

  async function getDay(date: string): Promise<DayMetrics> {
    const { rows } = await range();
    return rows.get(date) ?? { date, users: [], dau: 0, visits: 0, ipVisitors: 0, pings: 0 };
  }

  return {
    getDay: (date) => getDay(date),
    getRecent: (dates) => Promise.all(dates.map(getDay)),
    async serverTimeOffset() {
      const { today } = await range();
      return today ? offsetFromServerToday(today) : 0;
    },
  };
}

/** `api` 마다 하나 — 날마다 묻는 훅들이 목록 한 번을 같이 쓴다. */
export const createServerMetricsPort = perApi(build);
