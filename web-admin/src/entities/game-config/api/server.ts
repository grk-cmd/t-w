// API 판 — 카탈로그의 레벨 해금 줄 `ANIMAL_CHARACTER / animal`. 읽기 `GET /v2/admin/catalog` 의 `unlocks[]` ·
// 쓰기 `PUT /v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal { version, level, label }`.
// `label` 은 읽은 그대로 돌려 보낸다 — 읽은 줄의 `version` · `label` 은 화면이 들고 있다가(`raw.effective` = label) 저장에 싣는다.
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireNumber,
  wireObject,
  wireString,
  type Api,
  type Versioned,
} from '@/shared/api';
import type { GameConfigPort } from './port';

export const ANIMAL_UNLOCK = { kind: 'ANIMAL_CHARACTER', key: 'animal' } as const;

function build(api: Api | null): GameConfigPort {
  return {
    async getAnimalUnlockLevel() {
      const catalog = wireObject(
        await portCall(api, (a) => a.get<unknown>(adminPath('/catalog')), '해금 레벨을 불러오지 못했어요'),
        '카탈로그',
      );
      const rows = wireArray(catalog.unlocks, '카탈로그의 unlocks').map((u, i) =>
        wireObject(u, `unlocks[${i}]`),
      );
      const row = rows.find((u) => u.kind === ANIMAL_UNLOCK.kind && u.key === ANIMAL_UNLOCK.key);
      if (!row) throw new PortError('notFound', '서버에 동물 해금 줄이 없어요');
      const unlock: Versioned<number | null> = {
        value: wireNumber(row.level, '동물 해금 레벨'),
        version: wireNumber(row.version, '동물 해금 줄의 version'),
        raw: { effective: wireString(row.label, '동물 해금 줄의 label'), defaults: null },
      };
      return unlock;
    },
    async saveAnimalUnlockLevel(from, level) {
      if (!from.raw) throw new PortError('invalid', '읽은 값이 이 판의 것이 아니에요 (동물 해금)');
      await portCall(
        api,
        (a) =>
          a.send('PUT', adminPath(`/catalog/unlocks/${ANIMAL_UNLOCK.kind}/${ANIMAL_UNLOCK.key}`), {
            body: { version: from.version, level, label: from.raw?.effective },
          }),
        '저장하지 못했어요',
      );
    },
  };
}

export const createServerGameConfigPort = perApi(build);
