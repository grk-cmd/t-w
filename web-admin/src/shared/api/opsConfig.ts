// API 판 — 서버 운영 설정(`/v2/admin/config`) 통로. 설정 화면은 카드마다 자기 키를 묻는데, 서버는 목록 한 번에 다 준다.
// 그래서 목록을 한 번 받아 짧게 들고 있고(여러 카드가 한꺼번에 열려도 요청은 한 번), 저장은 «그 키를 마지막에 본 version» 으로 건다.
import { adminPath, type Api } from './api';
import { PortError, toPortError } from './backend';

/** 서버가 준 설정 한 칸. `value` 가 null 이면 저장한 값이 없어 `default` 를 쓴다. */
interface Row {
  key: string;
  value: unknown;
  default: unknown;
  version: number;
}

/** 키 하나의 지금 상태 — `effective` 는 지금 먹는 값(저장값, 없으면 기본값). */
export interface OpsSetting {
  key: string;
  effective: unknown;
  default: unknown;
  version: number;
}

export interface OpsConfigClient {
  /** 이 키의 지금 값. 목록이 낡았으면(2초) 다시 받는다. */
  read(key: string): Promise<OpsSetting>;
  /**
   * 마지막에 본 version 으로 `build(지금 값, 기본값)` 를 쓴다 — 칸이 여럿인 키는 받은 값에 고친 칸만 바꿔 통째로.
   * 한 번도 못 봤으면 먼저 읽는다. 409 면 낡은 값을 버리고 `conflict` 로 던진다(화면이 다시 받는다).
   */
  update(key: string, build: (current: unknown, defaults: unknown) => unknown): Promise<OpsSetting>;
}

const LIST_FRESH_MS = 2000;
const PATH = adminPath('/config');
export const NO_API_TEXT = '이 환경에는 API 주소가 없어요 — 빌드 값 VITE_API_BASE_URL 로 정해 주세요';

const settingOf = (row: Row): OpsSetting => ({
  key: row.key,
  effective: row.value ?? row.default,
  default: row.default,
  version: row.version,
});

const clients = new WeakMap<Api, OpsConfigClient>();

function createClient(api: Api): OpsConfigClient {
  const seen = new Map<string, OpsSetting>();
  let listedAt = 0;
  let listing: Promise<void> | null = null;

  async function load(): Promise<void> {
    try {
      const rows = await api.get<Row[]>(PATH);
      for (const row of rows) seen.set(row.key, settingOf(row));
      listedAt = Date.now();
    } catch (error) {
      throw toPortError(error, '설정을 불러오지 못했어요');
    }
  }

  function refresh(): Promise<void> {
    listing ??= load().finally(() => {
      listing = null;
    });
    return listing;
  }

  async function read(key: string): Promise<OpsSetting> {
    if (Date.now() - listedAt > LIST_FRESH_MS || !seen.has(key)) await refresh();
    const found = seen.get(key);
    if (!found) throw new PortError('notFound', `서버가 모르는 설정이에요 (${key})`);
    return found;
  }

  async function update(
    key: string,
    build: (current: unknown, defaults: unknown) => unknown,
  ): Promise<OpsSetting> {
    const base = seen.get(key) ?? (await read(key));
    try {
      const row = await api.send<Row>('PUT', `${PATH}/${key}`, {
        body: { version: base.version, value: build(base.effective, base.default) },
      });
      const next = settingOf(row);
      seen.set(key, next);
      return next;
    } catch (error) {
      const failure = toPortError(error, '저장하지 못했어요');
      if (failure.kind === 'conflict') {
        seen.delete(key);
        listedAt = 0;
      }
      throw failure;
    }
  }

  return { read, update };
}

/** `api` 가 없는 환경(주소 없음)이면 어떤 일이든 «주소 없음» 으로 실패한다. */
export function opsConfigClient(api: Api | null): OpsConfigClient {
  if (!api) {
    const fail = () => Promise.reject(new PortError('unreachable', NO_API_TEXT));
    return { read: fail, update: fail };
  }
  let client = clients.get(api);
  if (!client) {
    client = createClient(api);
    clients.set(api, client);
  }
  return client;
}
