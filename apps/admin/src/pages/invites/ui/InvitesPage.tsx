import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GroupInvitesPanel,
  RevokeInvitesAllButton,
} from '@/features/user/grant-invites';

// ✉️ 초대장 — 관리자가 초대를 나눠 주는 일을 한곳에. 고른 사람에게 지급 · 회수는 표에서 사람을 골라야 해서 👥 사용자 화면에 둔다.
export function InvitesPage() {
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
      <GroupInvitesPanel />
    </>
  );
}
