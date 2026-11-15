// API 판 — 카탈로그의 레벨 해금 줄 `ANIMAL_CHARACTER / animal`. 읽기 `GET /v2/admin/catalog` 의 `unlocks[]` ·
// 쓰기 `PUT /v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal { version, level, label }`(label 은 읽은 그대로 돌려 보낸다).
import { adminPath, NO_API_TEXT, PortError, toPortError, type Api } from '@/shared/api';
import type { GameConfigPort } from './port';

export const ANIMAL_UNLOCK = { kind: 'ANIMAL_CHARACTER', key: 'animal' } as const;
const FALLBACK_LABEL = '동물 캐릭터';

interface Unlock {
  kind?: unknown;
  key?: unknown;
  level?: unknown;
  label?: unknown;
  version?: unknown;
}

export function createServerGameConfigPort(api: Api | null): GameConfigPort {
  let seen: { version: number; label: string } | null = null;

  async function load(): Promise<number | null> {
    if (!api) throw new PortError('unreachable', NO_API_TEXT);
    try {
      const catalog = await api.get<{ unlocks?: Unlock[] }>(adminPath('/catalog'));
      const row = (catalog.unlocks ?? []).find(
        (u) => u.kind === ANIMAL_UNLOCK.kind && u.key === ANIMAL_UNLOCK.key,
      );
      if (!row) {
        seen = null;
        return null;
      }
      seen = {
        version: typeof row.version === 'number' ? row.version : 0,
        label: typeof row.label === 'string' && row.label ? row.label : FALLBACK_LABEL,
      };
      return typeof row.level === 'number' ? row.level : null;
    } catch (error) {
      throw toPortError(error, '해금 레벨을 불러오지 못했어요');
    }
  }

  return {
    getAnimalUnlockLevel: load,
    async saveAnimalUnlockLevel(level) {
      if (!api) throw new PortError('unreachable', NO_API_TEXT);
      if (seen === null) await load();
      try {
        const saved = await api.send<Unlock>(
          'PUT',
          adminPath(`/catalog/unlocks/${ANIMAL_UNLOCK.kind}/${ANIMAL_UNLOCK.key}`),
          {
            body: { version: seen?.version ?? 0, level, label: seen?.label ?? FALLBACK_LABEL },
          },
        );
        seen = {
          version: typeof saved?.version === 'number' ? saved.version : (seen?.version ?? 0) + 1,
          label: seen?.label ?? FALLBACK_LABEL,
        };
      } catch (error) {
        const failure = toPortError(error, '저장하지 못했어요');
        if (failure.kind === 'conflict') seen = null;
        throw failure;
      }
    },
  };
}
