import { listAllGroupInviteUses, type GroupInviteUse, type InvitePort } from '@/entities/invite';
import { formatDate, realName } from '@/shared/lib';
import type { Grid } from '@/shared/sheet';

export const USES_SHEET_HEAD = ['번호', '들어온 시각', '유저코드', '친구코드', '닉네임'];

/** 가입한 사람 → 엑셀 한 시트(머리 줄 + 사람마다 한 줄). 친구코드는 유저코드로 찾은 값(`friendCodes`). 없는 값은 빈 칸. */
export function usesSheet(
  uses: readonly GroupInviteUse[],
  friendCodes: ReadonlyMap<string, string | null>,
): Grid {
  return [
    USES_SHEET_HEAD,
    ...uses.map((u) => [
      String(u.n),
      u.joinedAt !== null ? formatDate(u.joinedAt) : '',
      u.userCode ?? '',
      (u.userCode !== null ? friendCodes.get(u.userCode) : null) ?? '',
      realName(u.name) ?? '',
    ]),
  ];
}

/** 파일 이름 — 코드 · 내보낸 날(서울). */
export const usesFileName = (code: string, day: string) => `외부인초대장_${code}_가입자_${day}.xlsx`;

/** 유저코드 → 친구코드(못 찾은 사람은 빠진다). 사용자 조회는 다른 기능 몫이라 페이지가 넘겨준다. */
export type FriendCodesOf = (userCodes: readonly string[]) => Promise<ReadonlyMap<string, string | null>>;

/** 사용자 조회 결과(유저코드 → 줄) → 유저코드 → 친구코드. */
export function friendCodesFromRows(
  rows: ReadonlyMap<string, { friendCode: string | null }>,
): Map<string, string | null> {
  return new Map([...rows].map(([code, row]) => [code, row.friendCode]));
}

/**
 * 엑셀 한 장 — 가입자를 쪽 끝까지 받고, 유저코드가 있는 사람만 모아 친구코드를 한 번에 찾아 시트로.
 * 유저코드가 하나도 없으면 친구코드를 묻지 않는다. 어느 쪽이든 못 받으면 던진다(파일을 만들지 않는다).
 */
export async function usesExportGrid(
  port: Pick<InvitePort, 'uses'>,
  code: string,
  friendCodesOf: FriendCodesOf,
): Promise<Grid> {
  const uses = await listAllGroupInviteUses(port, code);
  const codes = uses.flatMap((u) => (u.userCode !== null ? [u.userCode] : []));
  const friends = codes.length > 0 ? await friendCodesOf(codes) : new Map<string, string | null>();
  return usesSheet(uses, friends);
}
