import { AllowCard } from '@/features/room-server/manage-allow';
import { ServersCard } from '@/features/room-server/edit-servers';
import { RoomServerSwitchCard } from '@/features/room-server/switch-room-server';

// 방 서버(웹소켓) 시험 운영 — config/roomServer. 앱은 방에 들어갈 때 필요한 칸만 읽는다(room-server-gate.js).
// TODO: «서버 상태»(/health) · «비율로 넓히기»(defaultPercent · defaultServer) 는 여기에 카드로 더한다.
export function RoomServerPanel() {
  return (
    <>
      <div className="grid2">
        <RoomServerSwitchCard />
        <ServersCard />
      </div>
      <AllowCard />
      <p className="soft">서버 상태 · 비율로 넓히기 — 준비 중</p>
    </>
  );
}
