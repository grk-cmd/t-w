import { useState } from 'react';
import { BugBoardList } from '@/widgets/bug-board-list';
import { BugPostDetail } from '@/widgets/bug-post-detail';

export function BugBoardPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <BugBoardList onOpen={setOpenId} />
      <BugPostDetail id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
