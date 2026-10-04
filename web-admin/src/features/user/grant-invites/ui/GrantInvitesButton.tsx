import { useState } from 'react';
import { useInvitesLeft } from '@/entities/invite';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useGrantInvites } from '../model/useGrantInvites';
import { CountStepper, InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

interface Props {
  uid: string;
  /** 창 제목에 쓸 이름 — 이름이 없으면 친구코드나 사용자코드. */
  who: string;
}

export function GrantInvitesButton({ uid, who }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [error, setError] = useState('');
  const left = useInvitesLeft(uid, open);
  const grant = useGrantInvites(uid);

  const show = () => {
    setCount(1);
    setError('');
    setOpen(true);
    // 숫자 한 칸이라 열 때마다 새로 본다 — 그 사이 본인이 초대권을 썼을 수 있다.
    if (left.data !== undefined) left.refetch();
  };

  const submit = () =>
    grant.mutate(count, {
      onSuccess: (r) => {
        if (r.ok) {
          setOpen(false);
          toast(`${who} 님에게 초대권 ${count}장 지급 · 지금 ${r.after}장`);
        } else {
          setError(r.reason === 'no-invite' ? '초대권 칸이 없는 계정이에요' : '이미 상한(999장)이에요');
        }
      },
      onError: (e) => setError(errorMessage(e, '지급하지 못했어요')),
    });

  return (
    <>
      <button type="button" className="btn" onClick={show}>
        초대권 지급
      </button>
      <InviteDialog open={open} title={`${who} 님에게 초대권 지급`} onClose={() => setOpen(false)}>
        <p className="soft">
          지금{' '}
          {left.isLoading
            ? '…'
            : left.error
              ? '읽지 못함'
              : left.data === null
                ? '초대권 칸 없음'
                : `${left.data}장`}
        </p>
        <CountStepper value={count} onChange={setCount} />
        {error && <p className="msg err">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={grant.isPending || left.isLoading || left.data === null}
            onClick={submit}
          >
            {grant.isPending ? '지급 중…' : `${count}장 지급`}
          </button>
        </div>
      </InviteDialog>
    </>
  );
}
