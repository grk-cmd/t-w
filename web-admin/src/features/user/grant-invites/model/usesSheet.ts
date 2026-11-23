import type { GroupInviteUse } from '@/entities/invite';
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
