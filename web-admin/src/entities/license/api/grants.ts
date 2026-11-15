// API 판 발급 요청 — `POST /v2/admin/licenses { requestId, reissue, grants: [{ friendCode?, note? }] 1~500 }` → 줄마다 `{ friendCode, ok, code?, licenseId?, key? }`.
// 한 장 발급 · 친구코드로 발급 · 엑셀 일괄이 같은 길이라 보내기와 답 읽기를 한 곳에 둔다. 요청 번호는 부르는 쪽 포트가 든다.
import {
  adminPath,
  PortError,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';

const BASE = adminPath('/licenses');
/** 서버 한 번에 받는 줄 상한. */
export const GRANTS_MAX = 500;

export interface LicenseGrant {
  /** 있으면 그 사람 우편으로 키가 가고, 없으면 주인 없는 키. */
  friendCode?: string;
  note?: string;
}

/** 줄마다의 결과 — 안 된 줄은 서버 `code`(USER_NOT_FOUND · LICENSE_ALREADY_HAVE · LICENSE_GRANT_DUPLICATE …). */
export type GrantOutcome = { ok: true; key: string } | { ok: false; code: string };

function toOutcome(w: unknown, index: number): GrantOutcome {
  const o = wireObject(w, `발급 결과 ${index + 1}번째 줄`);
  const at = `발급 결과 ${index + 1}번째 줄의`;
  wireNullableString(o.friendCode, `${at} friendCode`);
  if (wireBool(o.ok, `${at} ok`)) return { ok: true, key: wireString(o.key, `${at} key`) };
  const code = wireNullableString(o.code, `${at} code`);
  if (code === null) throw wireError(`${at} code`, '실패한 줄의 글자');
  return { ok: false, code };
}

/** 발급 한 번 — 줄 수와 같은 결과가 같은 순서로 온다. 같은 `requestId` 는 서버가 처음 결과를 돌려준다. */
export async function postGrants(
  api: Api | null,
  requestId: string,
  grants: LicenseGrant[],
  reissue: boolean,
  fallback = '발급하지 못했어요',
): Promise<GrantOutcome[]> {
  if (grants.length < 1 || grants.length > GRANTS_MAX)
    throw new PortError('invalid', `한 번에 1~${GRANTS_MAX}줄까지 발급할 수 있어요`);
  return portCall(
    api,
    async (a) => {
      const rows = wireArray(
        await a.send<unknown>('POST', BASE, { body: { requestId, reissue, grants } }),
        '발급 결과',
      ).map(toOutcome);
      if (rows.length !== grants.length) throw wireError('발급 결과', `${grants.length}줄`);
      return rows;
    },
    fallback,
  );
}
