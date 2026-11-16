// API 판 — 서버엔 지우기가 없어 «단종» 한다: `POST /v2/admin/catalog/listings/bulk { action: 'ARCHIVE', items: [{ kind, id, version }] }`
// → 보낸 순서대로 줄마다 `{ kind, id, ok, code? }`. 물건마다 따로 처리해 하나가 안 돼도 나머지는 남는다(안 된 까닭은 `code`).
// 행은 남고 모두에게서 사라질 뿐이라 되살릴 수 있다. 한 번에 100개까지 같은 판정은 서버가 한다(400) — 고른 만큼 그대로 보낸다.
// 단종하면 줄의 번호 · 상태가 바뀌어 받아 둔 목록을 다시 받아야 한다(응답에 새 번호가 없다).
import { CATALOG_BASE, ITEM_KIND } from '@/entities/catalog';
import {
  perApi,
  portCall,
  rowCodeText,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireOmittable,
  wireString,
  type Api,
} from '@/shared/api';
import type { DeleteEntriesPort } from './port';

/** 줄 하나 — 안 된 줄은 까닭 `code` 가 있고, 된 줄에는 없다. */
function toRow(w: unknown): { kind: string; id: string; ok: boolean; code: string | null } {
  const o = wireObject(w, '단종 결과 줄');
  const ok = wireBool(o.ok, '단종 결과 줄의 ok');
  const code = wireOmittable(o, 'code', (v) => wireNullableString(v, '단종 결과 줄의 code'));
  if (ok && code !== null) throw wireError('단종 결과 줄의 code', '된 줄에는 없음');
  if (!ok && code === null) throw wireError('단종 결과 줄의 code', '안 된 줄의 까닭');
  return {
    kind: wireString(o.kind, '단종 결과 줄의 kind'),
    id: wireString(o.id, '단종 결과 줄의 id'),
    ok,
    code,
  };
}

function build(api: Api | null): DeleteEntriesPort {
  return {
    archives: true,
    async remove(entries) {
      if (!entries.length) return { removed: 0, filesLeft: 0, failed: [], edits: [] };
      const items = entries.map((e) => ({ kind: ITEM_KIND[e.kind], id: e.id, version: e.version }));
      const rows = wireArray(
        await portCall(
          api,
          (a) =>
            a.send<unknown>('POST', `${CATALOG_BASE}/listings/bulk`, { body: { action: 'ARCHIVE', items } }),
          '단종하지 못했어요',
        ),
        '단종 결과',
      ).map(toRow);
      if (
        rows.length !== items.length ||
        rows.some((r, i) => r.kind !== items[i].kind || r.id !== items[i].id)
      )
        throw wireError('단종 결과', '보낸 순서대로 한 줄씩');
      return {
        removed: rows.filter((r) => r.ok).length,
        filesLeft: 0,
        failed: rows.filter((r) => !r.ok).map((r) => ({ id: r.id, reason: rowCodeText(r.code ?? '') })),
        // 줄마다 번호가 바뀌었다(안 된 줄은 남이 먼저 고친 것일 수 있다) — 받아 둔 종류를 다시 받게 한다.
        edits: [{ op: 'refetch', kind: entries[0].kind }],
      };
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerDeleteEntriesPort = perApi(build);
