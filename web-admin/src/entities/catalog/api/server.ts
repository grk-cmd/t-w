// API 판 — `GET /v2/admin/catalog?kind=part|desk|deskProp&sort=order|popular` 한 번에 그 종류의 물건 줄(초안 · 단종 포함)과
// 카테고리 · 진열대를 받는다. 쪽 넘기기는 없다(한 진열대를 한 화면에서 끌어 옮기는 화면이라 서버가 통째 한 벌을 준다 — 설계 D1).
// 거르기 · 세기(장착 수 `equipCount`) · 많이 쓰는 순 정렬은 서버가 한다 — 웹은 값을 그대로 보낸다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNumber,
  wireObject,
  wireOmittable,
  wireString,
  type Api,
} from '@/shared/api';
import type { CatView } from '../model/category';
import type { CatalogEntry, CatalogKind, ListingState } from '../model/entry';
import type { CatalogShelf, ShelfKind } from '../model/shelf';
import type { CatalogPort } from './port';

export const CATALOG_BASE = adminPath('/catalog');

/** 서버 `?kind=` 이름 — 파츠 · 책상 · 소품(웹의 «아이템»). */
const KIND_PARAM: Record<ShelfKind, string> = { parts: 'part', desks: 'desk', items: 'deskProp' };
/** 목록 응답에서 그 종류 줄이 든 배열 이름과 줄의 id 칸. */
const ROWS: Record<ShelfKind, { array: string; id: string; what: string }> = {
  parts: { array: 'parts', id: 'partId', what: '파츠' },
  desks: { array: 'desks', id: 'deskId', what: '책상' },
  items: { array: 'deskProps', id: 'deskPropId', what: '소품' },
};

const STATES: readonly ListingState[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

/** 이름 표에서 찾는다 — 모르는 이름이면 짐작으로 채우지 않고 던진다. */
function oneOf<T extends string>(table: readonly T[], value: unknown, what: string): T {
  const key = wireString(value, what);
  const found = table.find((t) => t === key);
  if (found === undefined) throw wireError(what, table.join(' · '));
  return found;
}

/**
 * 물건 줄 하나. `equip` 은 목록 줄만 싣는다(`'required'`) — 한 건 · 고치기 응답은 싣지 않아(`'absent'`) null.
 * 서버가 NON_NULL 로 싣지 않는 칸(`thumb` · 책상 · 소품의 `listing.acquisition`)은 읽지 않는다.
 */
export function toCatalogRow(kind: ShelfKind, w: unknown, equip: 'required' | 'absent'): CatalogEntry {
  const spec = ROWS[kind];
  const o = wireObject(w, `${spec.what} 줄`);
  const id = wireString(o[spec.id], `${spec.what} 줄의 ${spec.id}`);
  const what = (field: string) => `${spec.what} ${id} 의 ${field}`;
  const listing = wireObject(o.listing, what('listing'));
  const gacha =
    kind === 'parts'
      ? oneOf(
          ['GIVEN', 'GACHA'],
          wireObject(listing.acquisition, what('listing.acquisition')).kind,
          what('listing.acquisition.kind'),
        ) === 'GACHA'
      : false;
  return {
    kind,
    id,
    name: wireString(o.name, what('name')),
    icon: wireString(o.icon, what('icon')),
    cat: kind === 'parts' ? wireString(o.category, what('category')) : null,
    // 서버가 배열 순서로 진열 순서를 준다 — 번호 칸은 없다.
    order: null,
    // 파일 그림 주소는 이 판의 목록에 싣지 않는다(해시 → 주소는 공개 파일 길로 받는다).
    thumb: null,
    files: [],
    base64: false,
    legacyGacha: false,
    gacha,
    version: wireNumber(o.version, what('version')),
    state: oneOf(STATES, listing.state, what('listing.state')),
    equip: equip === 'required' ? wireNumber(o.equipCount, what('equipCount')) : null,
  };
}

/** 카테고리 한 줄(목록 · 고치기 · 원래대로 응답이 같은 모양). 처음 값 칸은 기본 카테고리에만 온다. */
export function toCatView(w: unknown): CatView {
  const o = wireObject(w, '카테고리 줄');
  const code = wireString(o.code, '카테고리 줄의 code');
  const what = (field: string) => `카테고리 ${code} 의 ${field}`;
  const builtin = wireBool(o.builtin, what('builtin'));
  const defaultLabel = wireOmittable(o, 'defaultLabel', (v) => wireString(v, what('defaultLabel')));
  const defaultIcon = wireOmittable(o, 'defaultIcon', (v) => wireString(v, what('defaultIcon')));
  if (builtin && (defaultLabel === null || defaultIcon === null))
    throw wireError(what('defaultLabel · defaultIcon'), '기본 카테고리의 처음 이름 · 아이콘');
  return {
    id: code,
    cat: code,
    label: wireString(o.label, what('label')),
    icon: wireString(o.icon, what('icon')),
    group: wireString(o.group, what('group')),
    builtin,
    overridden: wireBool(o.overridden, what('overridden')),
    version: wireNumber(o.version, what('version')),
    // 운영 추가 카테고리는 처음 값이 없다 — 서버가 싣지 않는다.
    defaultLabel: defaultLabel ?? '',
    defaultIcon: defaultIcon ?? '',
  };
}

function toShelves(w: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of wireArray(w, '카탈로그의 shelves')) {
    const o = wireObject(s, '진열대 줄');
    const scope = wireString(o.scope, '진열대 줄의 scope');
    out[scope] = wireNumber(o.version, `진열대 ${scope} 의 version`);
  }
  return out;
}

function build(api: Api | null): CatalogPort {
  /** 한 벌을 받는다 — 물건 줄은 `kind` 로 거르고, 카테고리 · 진열대는 늘 온다. */
  const get = (kind: ShelfKind, sort: 'order' | 'popular') =>
    portCall(
      api,
      async (a) =>
        wireObject(await a.get<unknown>(CATALOG_BASE, { kind: KIND_PARAM[kind], sort }), '카탈로그'),
      '카탈로그를 불러오지 못했어요',
    );

  return {
    sort: 'server',
    diagnosable: false,

    async shelf(kind, sort): Promise<CatalogShelf> {
      const data = await get(kind, sort);
      const spec = ROWS[kind];
      return {
        entries: wireArray(data[spec.array], `카탈로그의 ${spec.array}`).map((r) =>
          toCatalogRow(kind, r, 'required'),
        ),
        categories: wireArray(data.categories, '카탈로그의 categories').map(toCatView),
        shelves: toShelves(data.shelves),
      };
    },

    // 물건 줄은 거르고 카테고리는 늘 온다 — 줄이 가장 적은 종류(책상)로 받는다.
    async categories() {
      return wireArray((await get('desks', 'order')).categories, '카탈로그의 categories').map(toCatView);
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerCatalogPort = perApi(build);

/** 서버 «종류» 이름(`kind` · 경로) — 쓰기 포트가 쓴다. */
export const ITEM_KIND: Record<CatalogKind, string> = {
  parts: 'part',
  gachaParts: 'part',
  desks: 'desk',
  items: 'deskProp',
};
export const ITEM_PATH: Record<CatalogKind, string> = {
  parts: 'parts',
  gachaParts: 'parts',
  desks: 'desks',
  items: 'desk-props',
};
/** 한 건 응답에서 그 물건이 든 칸. */
export const ITEM_FIELD: Record<CatalogKind, string> = {
  parts: 'part',
  gachaParts: 'part',
  desks: 'desk',
  items: 'deskProp',
};
