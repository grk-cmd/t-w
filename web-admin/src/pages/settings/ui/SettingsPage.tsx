import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { MinVersionCard } from '@/features/settings/set-min-version';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { BugDailyMaxCard } from '@/features/settings/set-bug-daily-max';
import { RoomConfigCard } from '@/features/settings/edit-room-config';
import { SignupFlagsCard } from '@/features/settings/toggle-signup-flags';

export function SettingsPage() {
  return (
    <>
      <AdBannerCard />
      <GameConfigCard />
      <BugDailyMaxCard />
      <RoomConfigCard />
      <SignupFlagsCard />
      <div className="grid2">
        <MinVersionCard kind="room" />
        <MinVersionCard kind="app" />
      </div>
    </>
  );
}
