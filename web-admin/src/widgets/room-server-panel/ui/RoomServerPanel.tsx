import { useMemo } from 'react';
import { LimitsCard } from '@/features/room-server/edit-limits';
import { ServersCard } from '@/features/room-server/edit-servers';
import { AllowCard } from '@/features/room-server/manage-allow';
import { RoomServerSwitchCard } from '@/features/room-server/switch-room-server';
import { useUserRows } from '@/features/user/user-rows';
import { RoomServerUsers } from './RoomServerUsers';

// 방 서버(웹소켓) 시험 운영 — config/roomServer. 앱은 방에 들어갈 때 필요한 칸만 읽는다(room-server-gate.js).
// TODO: «비율로 넓히기»(defaultPercent · defaultServer) 는 여기에 카드로 더한다.
export function RoomServerPanel() {
  // 아래 사용자 목록과 같은 요약 캐시 — 따로 읽지 않는다.
  const { rows, error } = useUserRows();
  const byCode = useMemo(() => new Map(rows?.map((r) => [r.userCode, r])), [rows]);
  return (
    <>
      <div className="grid2">
        <RoomServerSwitchCard />
        <ServersCard />
      </div>
      <LimitsCard />
      <AllowCard summaryOf={rows ? (code) => byCode.get(code) : error ? undefined : null} />
      <RoomServerUsers />
    </>
  );
}
