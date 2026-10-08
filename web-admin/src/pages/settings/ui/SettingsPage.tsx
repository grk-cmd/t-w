import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { MinVersionCard } from '@/features/settings/set-min-version';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { BugDailyMaxCard } from '@/features/settings/set-bug-daily-max';
import { ReleaseDownloadsView } from '@/entities/release';

export function SettingsPage() {
  return (
    <>
      <ReleaseDownloadsView />
      <AdBannerCard />
      <GameConfigCard />
      <BugDailyMaxCard />
      <div className="grid2">
        <MinVersionCard kind="room" />
        <MinVersionCard kind="app" />
      </div>
    </>
  );
}
