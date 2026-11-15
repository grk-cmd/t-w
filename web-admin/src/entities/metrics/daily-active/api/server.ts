// API 판 — `GET /v2/admin/metrics/daily?days=` 한 번이 `{ today, wau, mau, days[] }` 다(Firebase 판은 날마다 읽고 화면이 WAU · MAU 를 셌다).
// 날마다 묻는 포트 모양에 맞춰 목록을 한 번 받아 두고(2초) 날짜마다 돌려준다. WAU · MAU 는 «오늘» 줄에 싣는다.
import {
  adminPath,
  perApi,
  portCall,
  PortError,
  wireArray,
  wireError,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { offsetFromServerToday } from '@/shared/lib';
import type { DayMetrics } from '../model/metrics';
import type { MetricsPort } from './port';

const PATH = adminPath('/metrics/daily');
/** 서버가 받는 가장 긴 기간(1~92). */
const RANGE_DAYS = 92;
const FRESH_MS = 2000;

interface Range {
  today: string;
  rows: Map<string, DayMetrics>;
  receivedAt: number;
}

/** 서버가 «값 없음» 을 null 로 주는 칸(요약된 날의 IP 방문자) — null 만 0 으로 본다. 숫자도 null 도 아니면 던진다. */
const countOrNull = (v: unknown, what: string): number => (v === null ? 0 : wireNumber(v, what));

function parse(data: unknown, receivedAt: number): Range {
  const wire = wireObject(data, '접속 지표');
  const today = wireString(wire.today, '접속 지표의 today');
  const rows = new Map<string, DayMetrics>();
  wireArray(wire.days, '접속 지표의 days').forEach((item, i) => {
    const d = wireObject(item, `days[${i}]`);
    const date = wireString(d.day, `days[${i}].day`);
    rows.set(date, {
      date,
      users: [],
      dau: wireNumber(d.dau, `days[${i}].dau`),
      visits: wireNumber(d.visits, `days[${i}].visits`),
      ipVisitors: countOrNull(d.ipVisitors, `days[${i}].ipVisitors`),
      pings: wireNumber(d.pings, `days[${i}].pings`),
    });
  });
  const last = rows.get(today);
  if (!last) throw wireError('접속 지표', `오늘(${today}) 줄이 days 에 있어야 해요`);
  last.wau = wireNumber(wire.wau, '접속 지표의 wau');
  last.mau = wireNumber(wire.mau, '접속 지표의 mau');
  return { today, rows, receivedAt };
}

function build(api: Api | null): MetricsPort {
  let cached: Range | null = null;
  let loading: Promise<Range> | null = null;

  function range(): Promise<Range> {
    if (cached && Date.now() - cached.receivedAt < FRESH_MS) return Promise.resolve(cached);
    loading ??= portCall(
      api,
      async (a) => (cached = parse(await a.get<unknown>(PATH, { days: RANGE_DAYS }), Date.now())),
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
    activeUsers(days) {
      const last = days.at(-1);
      if (last?.wau === undefined || last.mau === undefined)
        throw new PortError('invalid', 'WAU · MAU 는 서버가 준 «오늘» 줄에서만 읽어요');
      return { wau: last.wau, mau: last.mau };
    },
    async serverTimeOffset() {
      const { today } = await range();
      return today ? offsetFromServerToday(today) : 0;
    },
  };
}

/** `api` 마다 하나 — 날마다 묻는 훅들이 목록 한 번을 같이 쓴다. */
export const createServerMetricsPort = perApi(build);
