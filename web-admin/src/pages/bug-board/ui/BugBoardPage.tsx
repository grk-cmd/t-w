import { useState } from 'react';
import { useHashSub } from '@/shared/lib';
import { BugBoardList } from '@/widgets/bug-board-list';
import { BugPostDetail } from '@/widgets/bug-post-detail';

export function BugBoardPage() {
  const [picked, setPicked] = useState<string | null>(null);
  // #/bugs/<제보 id> 로 들어오면(할 일 화면의 제보 번호) 그 글을 연다.
  const sub = useHashSub();
  const openId = picked ?? (sub || null);
  const close = () => {
    setPicked(null);
    if (sub) window.location.hash = '/bugs';
  };
  return (
    <>
      <BugBoardList onOpen={setPicked} />
      <BugPostDetail id={openId} onClose={close} />
    </>
  );
}
