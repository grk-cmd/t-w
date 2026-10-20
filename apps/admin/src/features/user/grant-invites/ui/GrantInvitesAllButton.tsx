import { useState } from 'react';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useGrantInvitesAll, useLoadAllUserIds } from '../model/useGrantInvites';
import { CountStepper, InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

// 사용자 수만큼 쓰는 일이라 한 번 더 손으로 적게 한다.
const CONFIRM_WORD = '전체 지급';

export function GrantInvitesAllButton() {
  const env = useEnv();
  // 대상은 단추를 눌렀을 때만 받는다(friendCodes 통째) — 화면을 열기만 해서 받지 않게.
  const loadUids = useLoadAllUserIds();
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const grant = useGrantInvitesAll('all');
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [typed, setTyped] = useState('');

  const show = async () => {
    setCount(1);
    setTyped('');
    grant.reset();
    setLoadError(null);
    setLoading(true);
    try {
      setUids(await loadUids());
    } catch (e) {
      setUids([]);
      setLoadError(e);
    } finally {
      setLoading(false);
    }
    setOpen(true);
  };

  const r = grant.data;
  const running = grant.isPending;

  return (
    <>
      <button type="button" className="btn danger" disabled={loading} onClick={() => void show()}>
        {loading ? '대상 읽는 중…' : '전체 초대권 지급'}
      </button>
      <InviteDialog
        open={open}
        title={withProdMark(env, '전체 사용자에게 초대권 지급')}
        locked={running}
        onClose={() => setOpen(false)}
      >
        <p>
          대상 <b>{uids.length}명</b>{' '}
          <span className="soft">· 초대 정보가 없는 계정 · 이미 999장인 계정은 빼고 줘요</span>
        </p>
        <CountStepper value={count} onChange={setCount} />
        {!r && (
          <div className="field">
            <input
              type="text"
              placeholder={`«${CONFIRM_WORD}» 입력`}
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
            {r.stopped ? '멈춤 · ' : '완료 · '}
            {r.granted}명 지급 · {r.skipped}명 건너뜀{r.failed ? ` · ${r.failed}명 실패` : ''}
          </p>
        )}
        {!!loadError && <p className="msg err">{errorMessage(loadError, '대상 사용자를 읽지 못했어요')}</p>}
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
              disabled={running || !uids.length || typed.trim() !== CONFIRM_WORD}
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
