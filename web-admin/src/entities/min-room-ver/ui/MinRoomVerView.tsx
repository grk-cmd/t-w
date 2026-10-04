import { errorMessage } from '@/shared/lib';
import { useMinRoomVer } from '../api/minRoomVer';

// 잘못 올리면(공개 안 된 버전) 아무도 방에 못 들어간다 — 바꾸기는 릴리스 확인 · 승인을 거치는 워크플로에서만 한다.
export function MinRoomVerView() {
  const { data, error, isPending } = useMinRoomVer();

  return (
    <section className="card">
      <h2>방 입장 최소 버전</h2>
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
        바꾸기: GitHub Actions <code>min-room-ver</code> 워크플로
      </p>
    </section>
  );
}
