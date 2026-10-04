import { useState } from 'react';
import { errorMessage } from '@/shared/lib';
import { useGrantInvitesAll } from '../model/useGrantInvites';
import { CountStepper, InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

interface Props {
  uids: string[];
  /** 지급을 마치고 창을 닫을 때 — 선택을 비운다. */
  onDone: () => void;
}

// 한 명 지급(grantInvites)을 전체 지급과 같은 방식(20명씩 동시에)으로 고른 사람에게만 돌린다.
export function GrantInvitesSelectedButton({ uids, onDone }: Props) {
  const grant = useGrantInvitesAll();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  // 창을 연 순간의 대상 — 도는 중에 선택이 바뀌어도 진행 표시가 흔들리지 않게.
  const [targets, setTargets] = useState<string[]>([]);

  const show = () => {
    setCount(1);
    setTargets(uids);
    grant.reset();
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (grant.data) onDone();
  };

  const r = grant.data;
  const running = grant.isPending;

  return (
    <>
      <button type="button" className="btn" disabled={!uids.length} onClick={show}>
        선택 초대권 지급 ({uids.length})
      </button>
      <InviteDialog
        open={open}
        title={`선택한 ${targets.length}명에게 초대권 지급`}
        locked={running}
        onClose={close}
      >
        <p className="soft">초대권 칸 없음 · 999장은 건너뜀</p>
        <CountStepper value={count} onChange={setCount} />
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
            {r.stopped ? '멈춤 · ' : '완료 · '}
            {r.granted}명 지급 · {r.skipped}명 건너뜀{r.failed ? ` · ${r.failed}명 실패` : ''}
          </p>
        )}
        {grant.error && <p className="msg err">{errorMessage(grant.error, '지급을 시작하지 못했어요')}</p>}
        <div className={styles.actions}>
          {running ? (
            <button type="button" className="btn" onClick={grant.stop}>
              멈추기
            </button>
          ) : (
            <button type="button" className="btn" onClick={close}>
              닫기
            </button>
          )}
          {!r && (
            <button
              type="button"
              className="btn primary"
              disabled={running || !targets.length}
              onClick={() => grant.mutate({ uids: targets, count })}
            >
              {running ? '지급 중…' : `${targets.length}명에게 ${count}장씩 지급`}
            </button>
          )}
        </div>
      </InviteDialog>
    </>
  );
}
