// API 판 — `PATCH /v2/admin/catalog/{parts|desks|desk-props}/{id} { version, name?, icon? }` → 그 물건. 고친 칸만 보내고 진열 · 모델 · 모양은 서버가 그대로 둔다.
// 이름 · 아이콘 길이 · 빈 이름 판정은 서버가 한다(400 `CATALOG_INVALID_ITEM`) — 값은 그대로 보내고 서버 문구로 띄운다.
// 남이 먼저 고쳤으면(409 `CONCURRENT_UPDATE`) 그 종류를 한 번 받아 최신 진열대를 캐시에 둔다.
import {
  createServerCatalogPort,
  ITEM_FIELD,
  ITEM_PATH,
  shelfKindOf,
  toCatalogRow,
  CATALOG_BASE,
  type CatalogEntry,
} from '@/entities/catalog';
import { isPortError, perApi, portCall, wireObject, type Api } from '@/shared/api';
import type { EditEntryInfoPort } from './port';

function build(api: Api | null): EditEntryInfoPort {
  const catalog = createServerCatalogPort(api);

  return {
    check: () => null,

    async save(entry: CatalogEntry, name, icon) {
      const body = {
        version: entry.version,
        ...(name !== entry.name ? { name } : {}),
        ...(icon !== entry.icon ? { icon } : {}),
      };
      try {
        const data = wireObject(
          await portCall(
            api,
            (a) =>
              a.send<unknown>(
                'PATCH',
                `${CATALOG_BASE}/${ITEM_PATH[entry.kind]}/${encodeURIComponent(entry.id)}`,
                {
                  body,
                },
              ),
            '저장하지 못했어요',
          ),
          '고친 물건',
        );
        const saved = toCatalogRow(shelfKindOf(entry.kind), data[ITEM_FIELD[entry.kind]], 'absent');
        return {
          ok: true,
          changed: true,
          edits: [
            {
              op: 'update',
              kind: entry.kind,
              id: entry.id,
              change: { name: saved.name, icon: saved.icon, version: saved.version, state: saved.state },
            },
          ],
        };
      } catch (error) {
        if (!isPortError(error, 'conflict') || error.code !== 'CONCURRENT_UPDATE') throw error;
        const shelf = await catalog.shelf(shelfKindOf(entry.kind), 'order');
        return { ok: false, conflict: true, edits: [{ op: 'seed', kind: entry.kind, shelf }] };
      }
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerEditEntryInfoPort = perApi(build);
