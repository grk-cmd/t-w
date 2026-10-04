import { errorMessage } from '@/shared/lib';
import { useMinRoomVer } from '../api/minRoomVer';

// 잘못 올리면(공개 안 된 버전) 아무도 방에 못 들어간다 — 바꾸기는 릴리스 확인 · 승인을 거치는 워크플로에서만 한다.
export function MinRoomVerView() {
  const { data, error, isPending } = useMinRoomVer();

  return (
    <section className="card">
      <h2>방 입장 최소 버전</h2>
      <p className="soft">이 버전보다 낮은 앱은 워킹룸 · 투게더룸에 들어갈 수 없어요.</p>
      <p>
        {error ? (
          <span className="msg err">{errorMessage(error, '불러오지 못했어요')}</span>
        ) : isPending ? (
          <span className="soft">불러오는 중…</span>
        ) : (
          <code className="key">{data ?? '제한 없음'}</code>
        )}
      </p>
      <p className="soft">
        바꾸기는 GitHub Actions 의 <code>min-room-ver</code> 워크플로에서만 해요 — 공개된 릴리스인지 확인하고
        승인을 받아요. 절차는 docs/RELEASE.md.
      </p>
    </section>
  );
}
