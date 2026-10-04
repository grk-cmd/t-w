import { AnnounceCard } from '@/features/announce';
import { BugReportCard } from '@/features/bug-report';
import { SendBroadcastCard } from '@/features/send-broadcast';
import { UpdateNoticeCard } from '@/features/update-notice';
import { BroadcastList } from '@/widgets/broadcast-list';

export function NoticesPage() {
  return (
    <>
      <AnnounceCard />
      <div className="grid2">
        <UpdateNoticeCard />
        <BugReportCard />
      </div>
      <SendBroadcastCard />
      <BroadcastList />
    </>
  );
}
