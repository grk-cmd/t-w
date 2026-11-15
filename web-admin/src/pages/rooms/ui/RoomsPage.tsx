import { useRoomPort } from '@/entities/room';
import { GhostCleanupCard } from '@/features/room/clean-ghost-rooms';
import { CloseAllRoomsCard, CloseByCodeCard } from '@/features/room/close-room';
import { RoomList } from '@/widgets/room-list';

export function RoomsPage() {
  // 유령 방 청소는 Firebase 판에만 있다 — 포트가 알려 준다(방이 realtime 메모리인 API 판에는 유령이 없다)
  const { features } = useRoomPort();
  return (
    <>
      <RoomList />
      <div className="grid2">
        {features.ghostCleanup && <GhostCleanupCard />}
        <CloseAllRoomsCard />
      </div>
      <CloseByCodeCard />
    </>
  );
}
