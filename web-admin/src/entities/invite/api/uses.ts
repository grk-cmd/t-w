import { KEYSET_PAGE_MAX } from '@/shared/lib';
import type { GroupInviteUse } from '../model/groupInvite';
import { GROUP_INVITE_MAX_USES } from '../model/groupInvite';
import type { InvitePort } from './port';

/** 쪽을 끝까지 넘겨도 이보다 많을 수 없다(코드 하나 인원 상한 ÷ 한 쪽) — 서버가 커서를 끝내지 않아도 멈춘다. */
const MAX_PAGES = Math.ceil(GROUP_INVITE_MAX_USES / KEYSET_PAGE_MAX) + 1;

/** 그 코드로 들어온 사람 전부 — 내보내기처럼 한 번에 다 필요할 때만. 화면은 쪽으로 받는다(useGroupInviteUses). */
export async function listAllGroupInviteUses(
  port: Pick<InvitePort, 'uses'>,
  code: string,
  limit = KEYSET_PAGE_MAX,
): Promise<GroupInviteUse[]> {
  const all: GroupInviteUse[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await port.uses(code, cursor, limit);
    all.push(...page.items);
    if (!page.nextCursor) return all;
    cursor = page.nextCursor;
  }
  throw new Error('가입한 사람 쪽이 끝나지 않아요 — 서버 응답을 확인해 주세요');
}
