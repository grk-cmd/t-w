import { useRoomServerConfig } from '@/entities/room-server';
import { DefaultCard } from '@/features/room-server/edit-default';
import { LimitsCard } from '@/features/room-server/edit-limits';
import { ServersCard } from '@/features/room-server/edit-servers';
import { AllowCard } from '@/features/room-server/manage-allow';
import { RoomServerSwitchCard } from '@/features/room-server/switch-room-server';
import { useUsersByCode } from '@/features/user/user-rows';
import { RoomServerUsers } from './RoomServerUsers';

// 방 서버(웹소켓) 시험 운영 — config/roomServer. 앱은 방에 들어갈 때 필요한 칸만 읽는다(room-server-gate.js).
export function RoomServerPanel() {
  // 지정된 사람만 사용자코드로 찾는다(API 사본 · 폴백이면 사용자 화면과 같은 통째 캐시).
  const { data: cfg } = useRoomServerConfig();
  const { data: byCode, error } = useUsersByCode(Object.keys(cfg?.allow ?? {}));
  return (
    <>
      <div className="grid2">
        <RoomServerSwitchCard />
        <ServersCard />
      </div>
      <DefaultCard />
      <LimitsCard />
      <AllowCard summaryOf={byCode ? (code) => byCode.get(code) : error ? undefined : null} />
      <RoomServerUsers />
    </>
  );
}
