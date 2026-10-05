import { AnnounceCard } from '@/features/notice/announce';
import { BugReportCard } from '@/features/notice/bug-report';
import { SendBroadcastCard } from '@/features/notice/send-broadcast';
import { UpdateNoticeCard } from '@/features/notice/update-notice';
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
