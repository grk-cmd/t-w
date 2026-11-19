import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { MinVersionCard } from '@/features/settings/set-min-version';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { BugDailyMaxCard } from '@/features/settings/set-bug-daily-max';
import { ChatKeepDaysCard } from '@/features/settings/set-chat-keep-days';
import { RoomConfigCard } from '@/features/settings/edit-room-config';
import { BannedWordsCard } from '@/features/settings/edit-banned-words';
import { useRoomPort } from '@/entities/room';
import { useOpsConfigPort } from '@/entities/server/ops-config';
import { MaintenanceCard } from '@/features/settings/edit-maintenance';
import { ApiOpsCard, DailyLimitsCard, RoomServerTuningCard } from '@/features/settings/edit-ops-config';
import { SignupFlagsCard } from '@/features/settings/toggle-signup-flags';

export function SettingsPage() {
  // API 판에만 있는 카드는 포트가 내놓는 것만 보인다(Firebase 판의 포트는 null)
  const { maintenance } = useOpsConfigPort();
  const { bannedWords } = useRoomPort();
  return (
    <>
      {maintenance && <MaintenanceCard />}
      <AdBannerCard />
      <GameConfigCard />
      <BugDailyMaxCard />
      <ChatKeepDaysCard />
      <RoomConfigCard />
      {bannedWords && <BannedWordsCard />}
      <SignupFlagsCard />
      <RoomServerTuningCard />
      <DailyLimitsCard />
      <ApiOpsCard />
      <div className="grid2">
        <MinVersionCard kind="room" />
        <MinVersionCard kind="app" />
      </div>
    </>
  );
}
