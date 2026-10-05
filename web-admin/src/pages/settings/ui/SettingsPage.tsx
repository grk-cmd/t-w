import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { MinRoomVerCard } from '@/features/settings/set-min-room-ver';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { ReleaseDownloadsView } from '@/entities/release';

export function SettingsPage() {
  return (
    <>
      <ReleaseDownloadsView />
      <AdBannerCard />
      <div className="grid2">
        <GameConfigCard />
        <MinRoomVerCard />
      </div>
    </>
  );
}
