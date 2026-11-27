import { useState } from 'react';
import { accountErrorMessage, useEnv, withProdMark } from '@/shared/api';
import { useModalDialog, useToast } from '@/shared/ui';
import { useResetPasswordPort } from '../api/index';
import { guideText, KIND_TEXT, MEMO_MAX, type PasswordResetResult } from '../model/resetPassword';
import { usePasswordReset } from '../model/useResetPassword';
import styles from './ResetPassword.module.css';

const CALL_FAIL = '초기화 함수를 부르지 못했어요 — 함수가 배포됐는지, 관리자 계정인지 확인해 주세요';

interface Props {
  /** 사용자 상세에서 연다 — 그 사람의 사용자 코드. */
  code: string;
  /** 안내 글에 쓸 친구 코드 — 서버가 답에 싣지 않는 판(API)을 위해 상세가 넘긴다. */
  friendCode?: string | null;
}

function Done({ r, friendCode }: { r: PasswordResetResult; friendCode: string | null }) {
  const toast = useToast();
  const text = guideText({ ...r, friendCode: r.friendCode ?? friendCode });
  const copy = () => {
    void navigator.clipboard.writeText(text).then(
      () => toast('안내 글을 복사했어요'),
      () => toast('복사하지 못했어요 — 직접 골라 복사해 주세요'),
    );
  };
  return (
    <>
      <p className="msg">{KIND_TEXT[r.kind]} 작업 기록에 남겼어요(비밀번호는 남기지 않아요).</p>
      <dl className={styles.who}>
        <dt>아이디(친구 코드)</dt>
        <dd>
          <code className="key">{r.friendCode ?? friendCode ?? r.code}</code>
        </dd>
        <dt>임시 비밀번호</dt>
        <dd>
          <code className={styles.pw}>{r.tempPassword}</code>
        </dd>
      </dl>
      <p className="warn">
        이 창을 닫으면 다시 볼 수 없어요. 비공개 제보 답변이나 우편함으로만 보내 주세요 — 공개 답변 · 채팅에
        쓰지 마세요.
      </p>
      <textarea className={styles.guide} readOnly value={text} aria-label="사용자에게 보낼 안내" rows={4} />
      <button type="button" className="btn" onClick={copy}>
        안내 글 복사
      </button>
    </>
  );
}

function Body({ code, friendCode }: { code: string; friendCode: string | null }) {
  const env = useEnv();
  const [memoRaw, setMemoRaw] = useState('');
  const port = useResetPasswordPort();
  const reset = usePasswordReset();
  // 비었으면 보낼 것이 없다 — 길이 · 모양 판정은 판마다 다르니 포트(서버)가 한다.
  const filled = memoRaw.trim() !== '';

  if (reset.data) return <Done r={reset.data} friendCode={friendCode} />;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (filled) reset.mutate({ code, memo: memoRaw });
      }}
    >
      <p className="soft">
        비밀번호를 잊었거나 로그인 계정이 없는 사용자가 연락했을 때 써요. 무작위 임시 비밀번호로 «친구 코드 +
        비밀번호» 로그인을 맞춰 주고(없으면 새로 만들어요), 이 계정의 모든 PC 로그인을 끊어요. 사용자는 임시
        비밀번호로 로그인한 뒤 [내 정보 › 계정] 에서 바꿔요.
      </p>
      <label>
        메모(제보 번호 · 연락 경로)
        <input
          type="text"
          aria-label="메모"
          placeholder="B-1017-3 · 오픈채팅 10/17"
          autoComplete="off"
          maxLength={port.kind === 'functions' ? MEMO_MAX : undefined}
          value={memoRaw}
          onChange={(e) => setMemoRaw(e.target.value)}
        />
        {port.kind === 'server' && (
          <small className="soft">
            {memoRaw.length}/{MEMO_MAX}
          </small>
        )}
      </label>
      <button type="submit" className="btn danger" disabled={!filled || reset.isPending}>
        {reset.isPending ? '초기화 중…' : withProdMark(env, '비밀번호 초기화')}
      </button>
      {reset.error && <p className="msg err">{accountErrorMessage(reset.error, CALL_FAIL)}</p>}
    </form>
  );
}

export function ResetPasswordButton({ code, friendCode = null }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  // 사용자 상세 창 안에서 열린다 — 훅이 이 창 자신의 close 만 받는다.
  const { dialogProps } = useModalDialog({ open, onClose: close });
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        비밀번호 초기화
      </button>
      <dialog {...dialogProps} className={styles.dialog} aria-label="비밀번호 초기화">
        <div className={styles.head}>
          <h2>비밀번호 초기화</h2>
          <button type="button" className="btn" onClick={close}>
            닫기
          </button>
        </div>
        {/* 열 때마다 새로 — 지난번 임시 비밀번호가 남지 않게. */}
        {open && <Body code={code} friendCode={friendCode} />}
      </dialog>
    </>
  );
}
