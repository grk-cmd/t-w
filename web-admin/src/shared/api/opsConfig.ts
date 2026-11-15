// API 판 — 서버 운영 설정(`/v2/admin/config`) 통로. 설정 화면은 카드마다 자기 키를 묻는데, 서버는 목록 한 번에 다 준다.
// 같은 때에 열린 카드들이 목록 요청을 하나로 합쳐 쓸 뿐(진행 중인 요청만 — 받은 값은 들고 있지 않는다),
// 값 · 번호는 읽은 화면이 캐시에 두고 저장할 때 돌려준다. 409 는 `conflict` 로 던진다(화면이 다시 받는다).
import { adminPath, type Api } from './api';
import { NO_API_TEXT, PortError, perApi, toPortError } from './backend';
import { wireArray, wireError, wireNumber, wireObject, wireString } from './wire';

/** 키 하나의 지금 상태 — `effective` 는 지금 먹는 값(저장값, 없으면 기본값). */
export interface OpsSetting {
  key: string;
  effective: unknown;
  default: unknown;
  version: number;
}

export interface OpsConfigClient {
  /** 이 키의 지금 값 · 번호. 서버가 모르는 키면 `notFound`. */
  read(key: string): Promise<OpsSetting>;
  /** `version`(읽은 번호)으로 값을 통째로 쓴다. 그 사이 바뀌었으면 `conflict`. */
  write(key: string, version: number, value: unknown): Promise<OpsSetting>;
  /** `version`(읽은 번호)으로 값을 비워 기본값을 따르게 한다(줄은 남는다). 그 사이 바뀌었으면 `conflict`. */
  clear(key: string, version: number): Promise<OpsSetting>;
}

const PATH = adminPath('/config');

/** 서버 응답 한 칸 `{ key, value, default, version }` — 모양이 다르면 던진다. */
function settingOf(row: unknown): OpsSetting {
  const o = wireObject(row, '설정 칸');
  const key = wireString(o.key, '설정 키');
  if (!('value' in o) || !('default' in o)) throw wireError(`설정 ${key}`, 'value · default 칸');
  return {
    key,
    effective: o.value ?? o.default,
    default: o.default,
    version: wireNumber(o.version, `설정 ${key} 의 version`),
  };
}

function createClient(api: Api): OpsConfigClient {
  let listing: Promise<OpsSetting[]> | null = null;

  /** 지금 진행 중인 목록 요청이 있으면 그것을 같이 쓴다 — 끝나면 비운다(받은 값은 남기지 않는다). */
  function list(): Promise<OpsSetting[]> {
    listing ??= api
      .get<unknown>(PATH)
      .then((rows) => wireArray(rows, '설정 목록').map(settingOf))
      .catch((error: unknown) => {
        throw toPortError(error, '설정을 불러오지 못했어요');
      })
      .finally(() => {
        listing = null;
      });
    return listing;
  }

  async function read(key: string): Promise<OpsSetting> {
    const found = (await list()).find((s) => s.key === key);
    if (!found) throw new PortError('notFound', `서버가 모르는 설정이에요 (${key})`);
    return found;
  }

  async function change(call: () => Promise<unknown>): Promise<OpsSetting> {
    try {
      return settingOf(await call());
    } catch (error) {
      throw toPortError(error, '저장하지 못했어요');
    }
  }

  return {
    read,
    write: (key, version, value) =>
      change(() => api.send<unknown>('PUT', `${PATH}/${key}`, { body: { version, value } })),
    clear: (key, version) =>
      change(() => api.send<unknown>('DELETE', `${PATH}/${key}`, { query: { version } })),
  };
}

const forApi = perApi<OpsConfigClient>((api) => {
  if (!api) {
    const fail = () => Promise.reject(new PortError('unreachable', NO_API_TEXT));
    return { read: fail, write: fail, clear: fail };
  }
  return createClient(api);
});

/** `api` 가 없는 환경(주소 없음)이면 어떤 일이든 «주소 없음» 으로 실패한다. */
export const opsConfigClient = (api: Api | null): OpsConfigClient => forApi(api);
