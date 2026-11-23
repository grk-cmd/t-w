import { fetchAllPages, KEYSET_PAGE_MAX } from '@/shared/lib';
import { GROUP_INVITE_MAX_USES, type GroupInviteUse } from '../model/groupInvite';
import type { InvitePort } from './port';

/** 그 코드로 들어온 사람 전부 — 내보내기처럼 한 번에 다 필요할 때만. 화면은 쪽으로 받는다(useGroupInviteUses).
 * 인원 상한 ÷ 한 쪽보다 많은 쪽은 있을 수 없어 거기서 멈춘다. */
export function listAllGroupInviteUses(
  port: Pick<InvitePort, 'uses'>,
  code: string,
  limit = KEYSET_PAGE_MAX,
): Promise<GroupInviteUse[]> {
  return fetchAllPages(
    async (cursor) => {
      const page = await port.uses(code, cursor, limit);
      return { items: page.items, nextCursor: page.nextCursor ?? null };
    },
    { maxPages: Math.ceil(GROUP_INVITE_MAX_USES / limit) + 1 },
  );
}
