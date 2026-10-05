import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { MinRoomVerView } from '@/entities/min-room-ver';
import { ReleaseDownloadsView } from '@/entities/release';

export function SettingsPage() {
  return (
    <>
      <ReleaseDownloadsView />
      <AdBannerCard />
      <div className="grid2">
        <GameConfigCard />
        <MinRoomVerView />
      </div>
    </>
  );
}
