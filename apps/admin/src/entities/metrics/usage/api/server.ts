// API 판 — 사용량 `GET /v2/admin/metrics/usage?days=`(날마다 `{ storage, hosting }` · 오늘은 `today`).
// 서버는 DB · 함수 사용량을 재지 않는다(설계 R9) — 그 무리는 늘 null.
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireError,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { offsetFromServerToday } from '@/shared/lib';
import type { DayUsage } from '../model/usage';
import type { UsagePort } from './port';

const USAGE = adminPath('/metrics/usage');
/** 서버가 받는 가장 긴 기간(1~92). */
const RANGE_DAYS = 92;
const FRESH_MS = 2000;

interface Range {
  today: string;
  rows: Map<string, DayUsage>;
  receivedAt: number;
}

/** 서버가 «잰 값 없음» 을 null 로 주는 칸(Hosting 보낸 바이트) — null 만 0 으로 본다. 숫자도 null 도 아니면 던진다. */
const sentBytes = (v: unknown, what: string): number => (v === null ? 0 : wireNumber(v, what));

const isoMs = (v: unknown, what: string): number => {
  const t = Date.parse(wireString(v, what));
  if (Number.isNaN(t)) throw wireError(what, 'ISO 시각');
  return t;
};

const emptyDay = (date: string): DayUsage => ({
  date,
  db: null,
  functions: null,
  storage: null,
  hosting: null,
});

function parseUsage(data: unknown, receivedAt: number): Range {
  const wire = wireObject(data, '사용량');
  const rows = new Map<string, DayUsage>();
  wireArray(wire.days, '사용량의 days').forEach((item, i) => {
    const d = wireObject(item, `days[${i}]`);
    const date = wireString(d.day, `days[${i}].day`);
    const storage = d.storage === null ? null : wireObject(d.storage, `days[${i}].storage`);
    const hosting = d.hosting === null ? null : wireObject(d.hosting, `days[${i}].hosting`);
    rows.set(date, {
      ...emptyDay(date),
      storage: storage && {
        sentBytes: sentBytes(storage.sentBytes, `days[${i}].storage.sentBytes`),
        storedBytes:
          storage.storedBytes === null
            ? null
            : wireNumber(storage.storedBytes, `days[${i}].storage.storedBytes`),
        at: isoMs(storage.measuredAt, `days[${i}].storage.measuredAt`),
      },
      hosting: hosting && {
        sentBytes: sentBytes(hosting.sentBytes, `days[${i}].hosting.sentBytes`),
        at: isoMs(hosting.measuredAt, `days[${i}].hosting.measuredAt`),
      },
    });
  });
  return { today: wireString(wire.today, '사용량의 today'), rows, receivedAt };
}

function build(api: Api | null): UsagePort {
  let cached: Range | null = null;
  let loading: Promise<Range> | null = null;

  function range(): Promise<Range> {
    if (cached && Date.now() - cached.receivedAt < FRESH_MS) return Promise.resolve(cached);
    loading ??= portCall(
      api,
      async (a) => (cached = parseUsage(await a.get<unknown>(USAGE, { days: RANGE_DAYS }), Date.now())),
      '사용량을 불러오지 못했어요',
    ).finally(() => {
      loading = null;
    });
    return loading;
  }

  return {
    features: { db: false, functions: false },
    async getDay(date) {
      const { rows } = await range();
      // 서버는 기간(오늘까지 최대 92일 · 이번 달 1일까지) 안의 날을 빠짐없이 준다 — 없는 날은 기간 밖이라 빈 값으로 덮지 않고 던진다.
      const row = rows.get(date);
      if (!row) throw new PortError('notFound', `서버가 준 기간 밖의 날이에요 (${date})`);
      return row;
    },
    async serverTimeOffset() {
      const { today } = await range();
      return offsetFromServerToday(today);
    },
  };
}

/** `api` 마다 하나 — 날마다 받은 사용량(2초)만 들고 있다. */
export const createServerUsagePort = perApi(build);
