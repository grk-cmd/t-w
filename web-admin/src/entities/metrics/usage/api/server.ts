// API 판 — 사용량 `GET /v2/admin/metrics/usage?days=`(날마다 `{ storage, hosting }` · 오늘은 `today`) ·
// 개선 기록 `GET · POST /v2/admin/metrics/improvements` · `PUT /{id}`(version) · `DELETE /{id}?version=`.
// 서버는 DB · 함수 사용량을 재지 않는다(설계 R9) — 그 무리는 늘 null. 개선 기록의 `release` 가 화면의 `version`(릴리스 이름)이다.
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { createPayloadRequestId, offsetFromServerToday } from '@/shared/lib';
import { cleanDraft, draftProblem, type Improvement, type ImprovementDraft } from '../model/improvement';
import type { DayUsage } from '../model/usage';
import type { UsagePort } from './port';

const USAGE = adminPath('/metrics/usage');
const IMPROVEMENTS = adminPath('/metrics/improvements');
/** 서버가 받는 가장 긴 기간(1~92). */
const RANGE_DAYS = 92;
const FRESH_MS = 2000;
const PAGE_LIMIT = 100;
/** 개선 기록은 릴리스마다 한 줄이라 몇 쪽이면 끝난다 — 끝없이 돌지 않게 거는 상한. */
const PAGE_CAP = 20;

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

/** 개선 기록 한 줄 — 칸이 약속과 다르면 던진다. 서버 `release` 가 화면의 `version`(릴리스 이름)이다. */
function toRecord(w: unknown): Improvement {
  const o = wireObject(w, '개선 기록');
  const id = wireString(o.id, '개선 기록의 id');
  return {
    id,
    version: wireString(o.release, `개선 기록 ${id} 의 release`),
    releasedAt: isoMs(o.releasedAt, `개선 기록 ${id} 의 releasedAt`),
    title: wireString(o.title, `개선 기록 ${id} 의 title`),
    items: wireArray(o.items, `개선 기록 ${id} 의 items`).map((t, k) => wireString(t, `items[${k}]`)),
    adoptDays: wireNumber(o.adoptDays, `개선 기록 ${id} 의 adoptDays`),
    revision: wireNumber(o.version, `개선 기록 ${id} 의 version`),
  };
}

function build(api: Api | null): UsagePort {
  let cached: Range | null = null;
  let loading: Promise<Range> | null = null;
  const once = createPayloadRequestId();

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

  const body = (d: ImprovementDraft) => ({
    release: d.version,
    releasedAt: new Date(d.releasedAt).toISOString(),
    title: d.title,
    items: d.items,
    adoptDays: d.adoptDays,
  });

  /** 화면이 읽은 줄의 번호 — API 판 목록은 늘 싣는다. 없으면 이 판의 읽기를 거치지 않은 줄이라 코드 실수다. */
  const revisionOf = (entry: Improvement): number => {
    if (entry.revision === undefined)
      throw new PortError('invalid', `읽은 개선 기록에 번호가 없어요 (${entry.id})`);
    return entry.revision;
  };

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
    async listImprovements() {
      return portCall(
        api,
        async (a) => {
          const out: Improvement[] = [];
          let cursor: string | undefined;
          for (let page = 0; ; page++) {
            // 상한에 닿았는데 다음 쪽이 남았으면 앞 쪽만 돌려주지 않고 던진다(잘린 목록을 전부인 듯 보이지 않게).
            if (page >= PAGE_CAP)
              throw new PortError('invalid', `개선 기록이 ${PAGE_CAP}쪽을 넘어요 — 상한을 늘려야 해요`);
            const res = wireObject(
              await a.get<unknown>(IMPROVEMENTS, { limit: PAGE_LIMIT, cursor }),
              '개선 기록 쪽',
            );
            const items = wireArray(res.items, '개선 기록 쪽의 items');
            for (const w of items) out.push(toRecord(w));
            cursor = wireNullableString(res.nextCursor, '개선 기록 쪽의 nextCursor') ?? undefined;
            if (!cursor) break;
          }
          return out.sort((x, y) => y.releasedAt - x.releasedAt);
        },
        '개선 기록을 불러오지 못했어요',
      );
    },
    async saveImprovement(draft, existing) {
      const d = cleanDraft(draft);
      const problem = draftProblem(d);
      if (problem) throw new Error(problem);
      if (existing) {
        const { id } = existing;
        const version = revisionOf(existing);
        await portCall(api, (a) =>
          a.send('PUT', `${IMPROVEMENTS}/${encodeURIComponent(id)}`, { body: { version, ...body(d) } }),
        );
        return id;
      }
      const saved = await once(d, (requestId) =>
        portCall(
          api,
          (a) => a.send<unknown>('POST', IMPROVEMENTS, { body: { requestId, ...body(d) } }),
          '저장하지 못했어요',
        ),
      );
      return wireString(wireObject(saved, '저장한 개선 기록').id, '저장한 개선 기록의 id');
    },
    async deleteImprovement(entry) {
      const version = revisionOf(entry);
      await portCall(api, (a) =>
        a.send('DELETE', `${IMPROVEMENTS}/${encodeURIComponent(entry.id)}`, { query: { version } }),
      );
    },
  };
}

/** `api` 마다 하나 — 날마다 받은 사용량(2초)과 보낸 요청 번호만 들고 있고, 개선 기록의 `revision` 은 화면이 읽은 줄에 실려 온다. */
export const createServerUsagePort = perApi(build);
