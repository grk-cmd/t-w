import { useState } from 'react';
import type { UserRow } from '@/entities/user';
import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GroupInvitesPanel,
  RevokeInvitesAllButton,
} from '@/features/user/grant-invites';
import { useUserRowsPort } from '@/features/user/user-rows';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { UserDetail } from '@/widgets/user-detail';

// ✉️ 초대장 — 관리자가 초대를 나눠 주는 일을 한곳에. 고른 사람에게 지급 · 회수는 표에서 사람을 골라야 해서 👥 사용자 화면에 둔다.
export function InvitesPage() {
  // 외부인 초대장 가입자를 누르면 👥 사용자 화면과 같은 회원 정보 창을 띄운다. 누를 때 그 한 사람만 읽는다.
  const port = useUserRowsPort();
  const toast = useToast();
  const [openRow, setOpenRow] = useState<UserRow | null>(null);
  const openUser = async (uid: string) => {
    try {
      const row = (await port.byCodes([uid])).get(uid);
      if (row) setOpenRow(row);
      else toast(`${uid} 사용자를 찾지 못했어요`);
    } catch (error) {
      toast(errorMessage(error, '회원 정보를 불러오지 못했어요'));
    }
  };
  const close = () => setOpenRow(null);
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
      <GroupInvitesPanel onOpenUser={(uid) => void openUser(uid)} />
      <UserDetail row={openRow} onOpen={(uid) => void openUser(uid)} onClose={close} onDeleted={close} />
    </>
  );
}
