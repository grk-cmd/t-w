// API 판 — 한 장은 `PATCH /v2/admin/licenses/{licenseId} { version, status: REVOKED }` · `DELETE …/{licenseId}?version=`,
// 여러 장은 `POST …/licenses/bulk { action: REVOKE | DELETE, items: [{ licenseId, version }] ≤500 }` → 줄마다 `{ id, ok, code? }`.
// 번호(`version`)는 목록이 읽은 줄에 실려 오고, 그 사이 다른 관리자가 고쳤으면 서버가 409 → `conflict`.
import {
  adminPath,
  perApi,
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
import type { SelectedKey } from '../model/revokeKeys';
import type { RevokeKeyPort } from './port';

const BASE = adminPath('/licenses');
/** 한 번에 보내는 상한(서버 `items` 1~500). */
const BULK_MAX = 500;

type Target = { licenseId: string; version: number };

/** 줄의 id · 번호 — API 판 목록은 늘 싣는다. 없으면 이 판의 읽기를 거치지 않은 줄이라 코드 실수다. */
function targetOf(row: SelectedKey): Target {
  if (row.licenseId === undefined || row.version === undefined)
    throw new PortError('invalid', `읽은 키에 id · 번호가 없어요 (${row.key})`);
  return { licenseId: row.licenseId, version: row.version };
}

/** 묶음 결과의 한 줄 — 안 된 줄은 `code` 가 있다. */
function toBulkRow(r: unknown): { ok: boolean; code: string | null } {
  const o = wireObject(r, '묶음 결과 줄');
  wireString(o.id, '묶음 결과 줄의 id');
  const ok = wireBool(o.ok, '묶음 결과 줄의 ok');
  const code = wireNullableString(o.code, '묶음 결과 줄의 code');
  if (!ok && code === null) throw wireError('묶음 결과 줄의 code', '실패한 줄의 글자');
  return { ok, code };
}

function build(api: Api | null): RevokeKeyPort {
  /** 줄마다 결과가 오는 묶음 — 안 된 줄이 있으면 «n개 됨 · m개 안 됨» 으로 던진다(목록은 화면이 다시 받는다). */
  async function bulk(action: 'REVOKE' | 'DELETE', targets: Target[], fallback: string): Promise<number> {
    let ok = 0;
    let failed = 0;
    let conflict = false;
    for (let i = 0; i < targets.length; i += BULK_MAX) {
      const items = targets.slice(i, i + BULK_MAX);
      const rows = await portCall(
        api,
        async (a) =>
          wireArray(
            await a.send<unknown>('POST', `${BASE}/bulk`, { body: { action, items } }),
            '묶음 결과',
          ).map(toBulkRow),
        fallback,
      );
      if (rows.length !== items.length) throw wireError('묶음 결과', `${items.length}줄`);
      for (const row of rows) {
        if (row.ok) ok += 1;
        else {
          failed += 1;
          if (row.code === 'CONCURRENT_UPDATE') conflict = true;
        }
      }
    }
    if (failed) throw new PortError(conflict ? 'conflict' : 'invalid', `${ok}개 됨 · ${failed}개 안 됨`);
    return ok;
  }

  return {
    async revoke(keys) {
      // 요청을 보내기 전에 번호를 다 모은다 — 중간에 모자라서 앞 묶음만 나가는 일이 없게.
      const targets = keys.map(targetOf);
      if (targets.length === 0) return 0;
      if (targets.length === 1) {
        const [t] = targets;
        await portCall(
          api,
          (a) =>
            a.send('PATCH', `${BASE}/${encodeURIComponent(t.licenseId)}`, {
              body: { version: t.version, status: 'REVOKED' },
            }),
          '회수하지 못했어요',
        );
        return 1;
      }
      return bulk('REVOKE', targets, '회수하지 못했어요');
    },
    async remove(keys) {
      const targets = keys.map(targetOf);
      if (targets.length === 0) return 0;
      if (targets.length === 1) {
        const [t] = targets;
        await portCall(
          api,
          (a) =>
            a.send('DELETE', `${BASE}/${encodeURIComponent(t.licenseId)}`, { query: { version: t.version } }),
          '삭제하지 못했어요',
        );
        return 1;
      }
      return bulk('DELETE', targets, '삭제하지 못했어요');
    },
  };
}

export const createServerRevokeKeyPort = perApi(build);
