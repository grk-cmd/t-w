import { AdBannerCard } from '@/features/edit-ad-banner';
import { GameConfigCard } from '@/features/edit-game-config';
import { MinRoomVerCard } from '@/features/set-min-room-ver';

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
