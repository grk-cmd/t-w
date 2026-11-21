import { useState } from 'react';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import type { GrantScope } from '../model/grantInvites';
import { useLoadAllUserIds, useRevokeInvites } from '../model/useGrantInvites';
import { InviteDialog } from './InviteDialog';
import styles from './InviteDialog.module.css';

// 되돌릴 수 없는 일이라 전체 회수는 한 번 더 손으로 적게 한다. 선택 회수는 고른 사람이 화면에 보이니 묻지 않는다.
const CONFIRM_WORD = '전체 회수';

interface Props {
  scope: GrantScope;
  uids: string[];
  /** 대상을 누를 때 받는다(전체) — 있으면 uids 대신 쓴다. */
  load?: () => Promise<string[]>;
  /** 회수를 마치고 창을 닫을 때 — 선택 회수는 선택을 비운다. */
  onDone?: () => void;
}

function RevokeInvitesButton({ scope, uids, load, onDone }: Props) {
  const env = useEnv();
  const revoke = useRevokeInvites(scope);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  // 창을 연 순간의 대상 — 도는 중에 선택이 바뀌어도 진행 표시가 흔들리지 않게.
  const [targets, setTargets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const all = scope === 'all';

  const show = async () => {
    setTyped('');
    revoke.reset();
    setLoadError(null);
    if (load) {
      setLoading(true);
      try {
        setTargets(await load());
      } catch (e) {
        setTargets([]);
        setLoadError(e);
      } finally {
        setLoading(false);
      }
    } else setTargets(uids);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (revoke.data) onDone?.();
  };

  const r = revoke.data;
  const running = revoke.isPending;
  const ready = !running && targets.length > 0 && (!all || typed.trim() === CONFIRM_WORD);

  return (
    <>
      <button
        type="button"
        className={all ? 'btn danger' : 'btn'}
        disabled={loading || (!load && !uids.length)}
        onClick={() => void show()}
      >
        {all ? (loading ? '대상 읽는 중…' : '전체 초대권 회수') : `선택 초대권 회수 (${uids.length})`}
      </button>
      <InviteDialog
        open={open}
        title={withProdMark(env, all ? '전체 사용자 초대권 회수' : `선택한 ${targets.length}명 초대권 회수`)}
        locked={running}
        onClose={close}
      >
        <p>
          대상 <b>{targets.length}명</b>의 남은 초대권을 <b>0장</b>으로 바꿔요.
        </p>
        <ul className={styles.rules}>
          <li>
            <span className="soft">1장 이상</span>0장으로
          </li>
          <li>
            <span className="soft">0장 · 정보 없음</span>건너뜀
          </li>
          <li>
            <span className="soft">마이너스</span>그대로 둠 (빚은 지우지 않아요)
          </li>
        </ul>
        <p className="soft">
          <small>
            이미 만든 초대 코드는 그대로 쓸 수 있어요. 되돌리기는 없어서, 다시 주려면 초대권 지급을 써요.
          </small>
        </p>
        {all && !r && (
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
        {revoke.progress && (
          <>
            <progress
              className={styles.progress}
              value={revoke.progress.done}
              max={revoke.progress.total || 1}
            />
            <small className="soft">
              {revoke.progress.done} / {revoke.progress.total}명 처리
            </small>
          </>
        )}
        {r && (
          <p className="msg">
            {r.stopped ? '멈춤 · ' : '완료 · '}
            {r.revoked}명에게서 {r.taken}장 회수 · {r.skipped}명 건너뜀
            {r.failed ? ` · ${r.failed}명 실패` : ''}
          </p>
        )}
        {!!loadError && <p className="msg err">{errorMessage(loadError, '대상 사용자를 읽지 못했어요')}</p>}
        {revoke.error && <p className="msg err">{errorMessage(revoke.error, '회수를 시작하지 못했어요')}</p>}
        <div className={styles.actions}>
          {running ? (
            <button type="button" className="btn" onClick={revoke.stop}>
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
              className={`btn ${styles.dangerFill}`}
              disabled={!ready}
              onClick={() => revoke.mutate({ uids: targets })}
            >
              {running ? '회수 중…' : `${targets.length}명 초대권 0장으로`}
            </button>
          )}
        </div>
      </InviteDialog>
    </>
  );
}

const NO_UIDS: string[] = [];

export function RevokeInvitesAllButton() {
  return <RevokeInvitesButton scope="all" uids={NO_UIDS} load={useLoadAllUserIds()} />;
}

export function RevokeInvitesSelectedButton({ uids, onDone }: { uids: string[]; onDone: () => void }) {
  return <RevokeInvitesButton scope="selected" uids={uids} onDone={onDone} />;
}
