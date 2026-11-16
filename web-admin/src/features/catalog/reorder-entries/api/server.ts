// API 판 — `PUT /v2/admin/catalog/shelves/{scope} { version, order }` → `{ scope, order, version }`. 범위는 파츠 `CATEGORY:{code}` · 책상 `DESK` · 소품 `DESK_PROP`.
// 한 번 끌기 = 요청 하나. `order` 에는 그 칸 줄 전부를 새 순서로 싣는다(서버는 «목록에 없는 물건은 맨 뒤»). 모르는 물건 · 겹침 판정은 서버가 한다.
// 남이 먼저 바꿨으면(409 `CONCURRENT_UPDATE`) 그 종류를 한 번 받아 최신 진열대를 캐시에 둔다.
import { CATALOG_BASE, createServerCatalogPort, moveId, shelfKindOf, shelfScope } from '@/entities/catalog';
import {
  isPortError,
  perApi,
  portCall,
  wireArray,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { ReorderEntriesPort } from './port';

function build(api: Api | null): ReorderEntriesPort {
  const catalog = createServerCatalogPort(api);

  return {
    async reorder({ group, dragged, target, version }) {
      const first = group[0];
      const scope = shelfScope(first);
      const order = moveId(
        group.map((e) => e.id),
        dragged,
        target,
      );
      try {
        const saved = wireObject(
          await portCall(
            api,
            (a) =>
              a.send<unknown>('PUT', `${CATALOG_BASE}/shelves/${encodeURIComponent(scope)}`, {
                body: { version, order },
              }),
            '순서를 바꾸지 못했어요',
          ),
          '진열대',
        );
        return {
          ok: true,
          changed: true,
          edits: [
            {
              op: 'order',
              kind: first.kind,
              scope: wireString(saved.scope, '진열대의 scope'),
              ids: wireArray(saved.order, '진열대의 order').map((id) => wireString(id, '진열대 order 의 id')),
              version: wireNumber(saved.version, '진열대의 version'),
            },
          ],
        };
      } catch (error) {
        if (!isPortError(error, 'conflict') || error.code !== 'CONCURRENT_UPDATE') throw error;
        const shelf = await catalog.shelf(shelfKindOf(first.kind), 'order');
        return { ok: false, conflict: true, edits: [{ op: 'seed', kind: first.kind, shelf }] };
      }
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerReorderEntriesPort = perApi(build);
