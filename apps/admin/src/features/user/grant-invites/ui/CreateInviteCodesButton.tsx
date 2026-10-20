import { useState } from 'react';
import { INVITE_CODE_MAX } from '@/entities/invite';
import { useEnv, withProdMark } from '@/shared/api';
import { copyText, errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCreateInviteCodes } from '../model/useGrantInvites';
import { CountStepper, InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

// 앱 런처의 관리자 «🎟️ 초대장 (무제한)» — 남은 장수를 깎지 않고 invites/{code} 를 만든다.
export function CreateInviteCodesButton() {
  const env = useEnv();
  const toast = useToast();
  const create = useCreateInviteCodes();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);

  const show = () => {
    setCount(1);
    create.reset();
    setOpen(true);
  };
  const copyAll = async () =>
    toast((await copyText(create.codes.join('\n'))) ? '복사했어요' : '복사하지 못했어요');

  return (
    <>
      <button type="button" className="btn" onClick={show}>
        초대 코드 만들기
      </button>
      <InviteDialog
        open={open}
        title={withProdMark(env, '초대 코드 만들기')}
        locked={create.isPending}
        onClose={() => setOpen(false)}
      >
        <CountStepper value={count} onChange={setCount} max={INVITE_CODE_MAX} unit="개" />
        {create.codes.length > 0 && (
          <ul className={styles.codes} aria-label="만든 초대 코드">
            {create.codes.map((c) => (
              <li key={c}>
                <code className="key">{c}</code>
              </li>
            ))}
          </ul>
        )}
        {create.error && (
          <p className="msg err">{errorMessage(create.error, '초대 코드를 만들지 못했어요')}</p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn" disabled={create.isPending} onClick={() => setOpen(false)}>
            닫기
          </button>
          {create.codes.length > 0 && (
            <button type="button" className="btn" onClick={copyAll}>
              모두 복사
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={create.isPending}
            onClick={() => create.mutate(count)}
          >
            {create.isPending ? '만드는 중…' : `${count}개 만들기`}
          </button>
        </div>
      </InviteDialog>
    </>
  );
}
