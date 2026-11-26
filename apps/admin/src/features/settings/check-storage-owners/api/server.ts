// API 판 — `GET /v2/admin/storage-owners` · `POST /v2/admin/storage-owners/backfill { memo }`.
// 메모 판정(빈 값 · 길이)은 서버가 한다.
import { adminPath, perApi, portCall, wireBool, wireNumber, wireObject, type Api } from '@/shared/api';
import { STORAGE_OWNERS_TIMEOUT_MS, type StorageOwnersResult } from '../model/storageOwners';
import type { StorageOwnersPort } from './port';

const PATH = adminPath('/storage-owners');
const NAME = 'Storage 주인';

function resultOf(raw: unknown): StorageOwnersResult {
  const o = wireObject(raw, NAME);
  const n = (k: string) => wireNumber(o[k], `${NAME}의 ${k}`);
  return {
    users: n('users'),
    documents: n('documents'),
    written: n('written'),
    missing: n('missing'),
    orphans: n('orphans'),
    ready: wireBool(o.ready, `${NAME}의 ready`),
  };
}

function build(api: Api | null): StorageOwnersPort {
  return {
    check: () =>
      portCall(
        api,
        async (a) =>
          resultOf(await a.get<unknown>(PATH, undefined, { timeoutMs: STORAGE_OWNERS_TIMEOUT_MS })),
        '확인하지 못했어요',
      ),
    backfill: (memo) =>
      portCall(
        api,
        async (a) =>
          resultOf(
            await a.send<unknown>('POST', `${PATH}/backfill`, {
              body: { memo: memo.trim() },
              timeoutMs: STORAGE_OWNERS_TIMEOUT_MS,
            }),
          ),
        '채우지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerStorageOwnersPort = perApi(build);
