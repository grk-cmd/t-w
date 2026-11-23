import { useEffect, useState } from 'react';
import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GroupInvitesPanel,
  RevokeInvitesAllButton,
} from '@/features/user/grant-invites';
import { useUserByCode } from '@/features/user/user-rows';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { UserDetail } from '@/widgets/user-detail';

// ✉️ 초대장 — 관리자가 초대를 나눠 주는 일을 한곳에. 고른 사람에게 지급 · 회수는 표에서 사람을 골라야 해서 👥 사용자 화면에 둔다.
export function InvitesPage() {
  // 외부인 초대장 가입자를 누르면 👥 사용자 화면과 같은 회원 정보 창 — 같은 훅(useUserByCode)으로 그 한 사람만 읽는다.
  const toast = useToast();
  const [openUid, setOpenUid] = useState<string | null>(null);
  const found = useUserByCode(openUid);
  const missing = openUid !== null && (found.error !== null || found.data === null);
  // 못 찾음 · 못 불러옴은 누른 자리에서 멀리 그리지 않고 알림으로.
  useEffect(() => {
    if (!openUid) return;
    if (found.error) toast(errorMessage(found.error, '회원 정보를 불러오지 못했어요'));
    else if (found.data === null) toast(`${openUid} 사용자를 찾지 못했어요`);
  }, [openUid, found.error, found.data, toast]);
  const close = () => setOpenUid(null);
  return (
    <>
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
      <GroupInvitesPanel onOpenUser={setOpenUid} />
      <UserDetail
        row={missing ? null : (found.data ?? null)}
        onOpen={setOpenUid}
        onClose={close}
        onDeleted={close}
      />
    </>
  );
}
