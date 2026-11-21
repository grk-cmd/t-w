import { GhostCleanupCard } from '@/features/room/clean-ghost-rooms';
import { CloseAllRoomsCard, CloseByCodeCard } from '@/features/room/close-room';
import { RoomList } from '@/widgets/room-list';

export function RoomsPage() {
  return (
    <>
      <RoomList />
      <div className="grid2">
        <GhostCleanupCard />
        <CloseAllRoomsCard />
      </div>
      <CloseByCodeCard />
    </>
  );
}
