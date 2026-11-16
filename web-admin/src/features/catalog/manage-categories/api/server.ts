// API 판 — 이름 · 아이콘 고치기 `PUT /v2/admin/catalog/categories/{code} { version, label, icon }` → 그 카테고리,
// 기본 카테고리를 처음 값으로 되돌리기(이름 · 아이콘을 비우거나 기본값과 같게 저장) `POST …/categories/{code}/reset?version=` → 그 카테고리.
// 무엇을 보낼지(처음 값과 같으면 되돌리기 · 빈 아이콘 · 빈 이름)는 Firebase 판과 한 곳(`categoryAfterNameSave`)에서 정한다.
// 글자 수 · 빈 이름 판정은 서버가 한다(400 `CATALOG_INVALID_ITEM`). 남이 먼저 고쳤으면(409 `CONCURRENT_UPDATE`) 카테고리를 한 번 받아 캐시에 둔다.
import { CATALOG_BASE, categoryAfterNameSave, createServerCatalogPort, toCatView } from '@/entities/catalog';
import { isPortError, perApi, portCall, type Api } from '@/shared/api';
import type { ManageCategoriesPort } from './port';

function build(api: Api | null): ManageCategoriesPort {
  const catalog = createServerCatalogPort(api);

  return {
    check: () => null,

    async save(cat, label, icon) {
      const after = categoryAfterNameSave(cat, label, icon);
      const path = `${CATALOG_BASE}/categories/${encodeURIComponent(cat.id)}`;
      try {
        const saved = toCatView(
          await portCall(
            api,
            (a) =>
              cat.builtin && !after.overridden
                ? a.send<unknown>('POST', `${path}/reset`, { query: { version: cat.version } })
                : a.send<unknown>('PUT', path, {
                    body: { version: cat.version, label: after.label, icon: after.icon },
                  }),
            '저장하지 못했어요',
          ),
        );
        return { ok: true, changed: true, edits: [{ op: 'category', cat: saved }] };
      } catch (error) {
        if (!isPortError(error, 'conflict') || error.code !== 'CONCURRENT_UPDATE') throw error;
        const categories = await catalog.categories();
        return { ok: false, conflict: true, edits: [{ op: 'categories', categories }] };
      }
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerManageCategoriesPort = perApi(build);
