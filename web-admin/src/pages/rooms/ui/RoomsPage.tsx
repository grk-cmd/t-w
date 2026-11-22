import { useRoomPort } from '@/entities/room';
import { GhostCleanupCard } from '@/features/room/clean-ghost-rooms';
import { CloseAllRoomsCard, CloseByCodeCard } from '@/features/room/close-room';
import { useEnv } from '@/shared/api';
import { RoomList } from '@/widgets/room-list';
import { RoomLoadCard } from '@/widgets/room-load';

export function RoomsPage() {
  // 유령 방 청소는 Firebase 판에만 있다 — 포트가 알려 준다(방이 realtime 메모리인 API 판에는 유령이 없다)
  const { features } = useRoomPort();
  // 지금 접속 · 방 안 인원은 운영 realtime 의 /health — API 판 · 운영 프로젝트일 때만(dev · e2e 는 운영 realtime 을 읽지 않는다)
  const env = useEnv();
  return (
    <>
      {features.liveLoad && env.isProd && <RoomLoadCard />}
      <RoomList />
      <div className="grid2">
        {features.ghostCleanup && <GhostCleanupCard />}
        <CloseAllRoomsCard />
      </div>
      <CloseByCodeCard />
    </>
  );
}
