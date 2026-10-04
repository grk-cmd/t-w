import { useMemo, useState } from 'react';
import { useFriendCodes } from '@/entities/user';
import { errorMessage } from '@/shared/lib';
import { uniqueUserIds } from '../model/grantInvites';
import { useGrantInvitesAll } from '../model/useGrantInvites';
import { CountStepper, InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

// 사용자 수만큼 쓰는 일이라 한 번 더 손으로 적게 한다.
const CONFIRM_WORD = '전체 지급';

export function GrantInvitesAllButton() {
  // 사용자 화면이 이미 받아 둔 friendCodes 캐시를 그대로 쓴다 — 다시 받지 않는다.
  const friendCodes = useFriendCodes();
  const uids = useMemo(() => (friendCodes.data ? uniqueUserIds(friendCodes.data) : []), [friendCodes.data]);
  const grant = useGrantInvitesAll();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [typed, setTyped] = useState('');

  const show = () => {
    setCount(1);
    setTyped('');
    grant.reset();
    setOpen(true);
  };

  const r = grant.data;
  const running = grant.isPending;

  return (
    <>
      <button type="button" className="btn danger" disabled={!uids.length} onClick={show}>
        전체 초대권 지급
      </button>
      <InviteDialog
        open={open}
        title="전체 사용자에게 초대권 지급"
        locked={running}
        onClose={() => setOpen(false)}
      >
        <p>
          친구코드가 있는 <b>{uids.length}명</b>에게 한 사람씩 더해요. 초대권 칸이 없는 계정(가입을 마치지
          않은 계정)과 이미 999장인 사람은 건너뛰어요.
        </p>
        <CountStepper value={count} onChange={setCount} />
        {!r && (
          <div className="field">
            <input
              type="text"
              placeholder={`확인하려면 «${CONFIRM_WORD}» 라고 적어 주세요`}
              value={typed}
              disabled={running}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        {grant.progress && (
          <>
            <progress
              className={styles.progress}
              value={grant.progress.done}
              max={grant.progress.total || 1}
            />
            <small className="soft">
              {grant.progress.done} / {grant.progress.total}명 처리
            </small>
          </>
        )}
        {r && (
          <p className="msg">
            {r.stopped ? '멈췄어요 — ' : '끝났어요 — '}
            {r.granted}명 지급 · {r.skipped}명 건너뜀{r.failed ? ` · ${r.failed}명 실패` : ''}
          </p>
        )}
        {grant.error && (
          <p className="msg err">{errorMessage(grant.error, '전체 지급을 시작하지 못했어요')}</p>
        )}
        <div className={styles.actions}>
          {running ? (
            <button type="button" className="btn" onClick={grant.stop}>
              멈추기
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              닫기
            </button>
          )}
          {!r && (
            <button
              type="button"
              className="btn primary"
              disabled={running || typed.trim() !== CONFIRM_WORD}
              onClick={() => grant.mutate({ uids, count })}
            >
              {running ? '지급 중…' : `${uids.length}명에게 ${count}장씩 지급`}
            </button>
          )}
        </div>
      </InviteDialog>
    </>
  );
}
