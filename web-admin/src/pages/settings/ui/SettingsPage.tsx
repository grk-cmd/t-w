import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { MinRoomVerView } from '@/entities/min-room-ver';

export function SettingsPage() {
  return (
    <>
      <AdBannerCard />
      <div className="grid2">
        <GameConfigCard />
        <MinRoomVerView />
      </div>
    </>
  );
}
