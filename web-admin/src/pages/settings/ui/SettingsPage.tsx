import { AdBannerCard } from '@/features/settings/edit-ad-banner';
import { GameConfigCard } from '@/features/settings/edit-game-config';
import { MinRoomVerCard } from '@/features/settings/set-min-room-ver';

export function SettingsPage() {
  return (
    <>
      <AdBannerCard />
      <div className="grid2">
        <GameConfigCard />
        <MinRoomVerCard />
      </div>
    </>
  );
}
