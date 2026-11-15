// API 판 — 사용량 `GET /v2/admin/metrics/usage?days=`(날마다 `{ storage, hosting }` · 오늘은 `today`) ·
// 개선 기록 `GET · POST /v2/admin/metrics/improvements` · `PUT /{id}`(version) · `DELETE /{id}?version=`.
// 서버는 DB · 함수 사용량을 재지 않는다(설계 R9) — 그 무리는 늘 null. 개선 기록의 `release` 가 화면의 `version`(릴리스 이름)이다.
import { adminPath, perApi, PortError, portCall, type Api } from '@/shared/api';
import { createPayloadRequestId, offsetFromServerToday } from '@/shared/lib';
import {
  cleanDraft,
  draftProblem,
  toImprovement,
  type Improvement,
  type ImprovementDraft,
} from '../model/improvement';
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

interface UsageWire {
  today?: unknown;
  days?: {
    day?: unknown;
    storage?: { sentBytes?: unknown; storedBytes?: unknown; measuredAt?: unknown } | null;
    hosting?: { sentBytes?: unknown; measuredAt?: unknown } | null;
  }[];
}

interface Range {
  today: string;
  rows: Map<string, DayUsage>;
  receivedAt: number;
}

interface ImprovementWire {
  id?: unknown;
  release?: unknown;
  releasedAt?: unknown;
  title?: unknown;
  items?: unknown;
  adoptDays?: unknown;
  version?: unknown;
}

const bytes = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const bytesOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const at = (v: unknown): number => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const emptyDay = (date: string): DayUsage => ({
  date,
  db: null,
  functions: null,
  storage: null,
  hosting: null,
});

function parseUsage(wire: UsageWire, receivedAt: number): Range {
  const rows = new Map<string, DayUsage>();
  for (const d of wire.days ?? []) {
    if (typeof d.day !== 'string') continue;
    rows.set(d.day, {
      ...emptyDay(d.day),
      storage: d.storage
        ? {
            sentBytes: bytes(d.storage.sentBytes),
            storedBytes: bytesOrNull(d.storage.storedBytes),
            at: at(d.storage.measuredAt),
          }
        : null,
      hosting: d.hosting ? { sentBytes: bytes(d.hosting.sentBytes), at: at(d.hosting.measuredAt) } : null,
    });
  }
  return { today: typeof wire.today === 'string' ? wire.today : '', rows, receivedAt };
}

function build(api: Api | null): UsagePort {
  let cached: Range | null = null;
  let loading: Promise<Range> | null = null;
  const revisions = new Map<string, number>();
  const once = createPayloadRequestId();

  function range(): Promise<Range> {
    if (cached && Date.now() - cached.receivedAt < FRESH_MS) return Promise.resolve(cached);
    loading ??= portCall(
      api,
      async (a) => (cached = parseUsage(await a.get<UsageWire>(USAGE, { days: RANGE_DAYS }), Date.now())),
      '사용량을 불러오지 못했어요',
    ).finally(() => {
      loading = null;
    });
    return loading;
  }

  function toRecord(w: ImprovementWire): Improvement | null {
    if (typeof w.id !== 'string') return null;
    const record = toImprovement(w.id, {
      version: w.release,
      releasedAt: at(w.releasedAt),
      title: w.title,
      items: w.items,
      adoptDays: w.adoptDays,
    });
    if (!record) return null;
    const revision = typeof w.version === 'number' ? w.version : undefined;
    if (revision !== undefined) revisions.set(record.id, revision);
    return revision === undefined ? record : { ...record, revision };
  }

  const body = (d: ImprovementDraft) => ({
    release: d.version,
    releasedAt: new Date(d.releasedAt).toISOString(),
    title: d.title,
    items: d.items,
    adoptDays: d.adoptDays,
  });

  const revisionOf = (id: string): number => {
    const r = revisions.get(id);
    if (r === undefined) throw new PortError('conflict', '목록이 낡았어요 — 새로 받아왔어요');
    return r;
  };

  return {
    features: { db: false, functions: false },
    async getDay(date) {
      const { rows } = await range();
      return rows.get(date) ?? emptyDay(date);
    },
    async serverTimeOffset() {
      const { today } = await range();
      return today ? offsetFromServerToday(today) : 0;
    },
    async listImprovements() {
      return portCall(
        api,
        async (a) => {
          const out: Improvement[] = [];
          let cursor: string | undefined;
          for (let page = 0; page < PAGE_CAP; page++) {
            const res = await a.get<{ items?: ImprovementWire[]; nextCursor?: unknown }>(IMPROVEMENTS, {
              limit: PAGE_LIMIT,
              cursor,
            });
            for (const w of res.items ?? []) {
              const r = toRecord(w);
              if (r) out.push(r);
            }
            cursor = typeof res.nextCursor === 'string' ? res.nextCursor : undefined;
            if (!cursor) break;
          }
          return out.sort((x, y) => y.releasedAt - x.releasedAt);
        },
        '개선 기록을 불러오지 못했어요',
      );
    },
    async saveImprovement(draft, id) {
      const d = cleanDraft(draft);
      const problem = draftProblem(d);
      if (problem) throw new Error(problem);
      if (id) {
        const version = revisionOf(id);
        await portCall(api, (a) =>
          a.send('PUT', `${IMPROVEMENTS}/${encodeURIComponent(id)}`, { body: { version, ...body(d) } }),
        );
        return id;
      }
      const saved = await once(d, (requestId) =>
        portCall(
          api,
          (a) => a.send<ImprovementWire>('POST', IMPROVEMENTS, { body: { requestId, ...body(d) } }),
          '저장하지 못했어요',
        ),
      );
      return typeof saved?.id === 'string' ? saved.id : '';
    },
    async deleteImprovement(entry) {
      const version = revisionOf(entry.id);
      await portCall(api, (a) =>
        a.send('DELETE', `${IMPROVEMENTS}/${encodeURIComponent(entry.id)}`, { query: { version } }),
      );
    },
  };
}

/** `api` 마다 하나 — 목록을 읽은 훅 · 고치는 훅이 같은 version(revision) 을 쓴다. */
export const createServerUsagePort = perApi(build);
