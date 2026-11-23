import { useEffect, useState } from 'react';
import {
  CreateInviteCodesButton,
  friendCodesFromRows,
  type FriendCodesOf,
  GrantInvitesAllButton,
  GroupInvitesPanel,
  RevokeInvitesAllButton,
} from '@/features/user/grant-invites';
import { useRefreshUsers, useUserByCode, useUserRowsPort } from '@/features/user/user-rows';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { UserDetail } from '@/widgets/user-detail';
import { InviteSearchCard } from '@/widgets/invite-search';

// ✉️ 초대장 — 관리자가 초대를 나눠 주는 일을 한곳에. 고른 사람에게 지급 · 회수는 표에서 사람을 골라야 해서 👥 사용자 화면에 둔다.
export function InvitesPage() {
  // 외부인 초대장 가입자를 누르면 👥 사용자 화면과 같은 회원 정보 창 — 같은 훅(useUserByCode)으로 그 한 사람만 읽는다.
  const toast = useToast();
  const [openUid, setOpenUid] = useState<string | null>(null);
  const found = useUserByCode(openUid);
  const refresh = useRefreshUsers();
  const missing = openUid !== null && (found.error !== null || found.data === null);
  const missText =
    openUid === null
      ? ''
      : found.error
        ? errorMessage(found.error, '회원 정보를 불러오지 못했어요')
        : `${openUid} 사용자를 찾지 못했어요`;
  // 못 찾음 · 못 불러옴은 누른 자리에서 멀리 그리지 않고 알림으로.
  useEffect(() => {
    if (missing) toast(missText);
  }, [missing, missText, toast]);
  // 못 찾은 사람을 다시 누르면 상태가 그대로라 알림이 안 뜬다 — 그때는 바로 다시 알린다.
  const open = (uid: string) => {
    if (uid === openUid && missing) toast(missText);
    else setOpenUid(uid);
  };
  const close = () => setOpenUid(null);
  // 엑셀의 친구코드 — 👥 사용자 화면과 같은 «유저코드로 여러 명» 조회(API 판은 100명씩 한 번).
  const rowsPort = useUserRowsPort();
  const friendCodesOf: FriendCodesOf = async (codes) => friendCodesFromRows(await rowsPort.byCodes(codes));
  // 지운 사람은 사용자 목록 캐시에서도 빠져야 다시 눌렀을 때 창이 뜨지 않는다 — 👥 사용자 화면과 같다.
  const afterDelete = () => {
    close();
    refresh();
  };
  return (
    <>
      <InviteSearchCard onOpenUser={open} friendCodesOf={friendCodesOf} />
      <div className="grid2">
        <section className="card">
          <h2>모든 유저 초대권</h2>
          <p className="soft">
            가입한 모든 사람의 초대권(앱에서 한 장씩 만드는 초대장)을 한 번에 늘리거나 거둬요.
          </p>
          <div className="field">
            <GrantInvitesAllButton />
            <RevokeInvitesAllButton />
          </div>
        </section>
        <section className="card">
          <h2>한 명짜리 초대 코드</h2>
          <p className="soft">
            한 사람만 쓸 수 있는 코드를 여러 개 만들어요(관리자 몫 · 초대권을 깎지 않음).
          </p>
          <div className="field">
            <CreateInviteCodesButton />
          </div>
        </section>
      </div>
      <GroupInvitesPanel onOpenUser={open} friendCodesOf={friendCodesOf} />
      <UserDetail
        row={missing ? null : (found.data ?? null)}
        onOpen={open}
        onClose={close}
        onDeleted={afterDelete}
      />
    </>
  );
}
