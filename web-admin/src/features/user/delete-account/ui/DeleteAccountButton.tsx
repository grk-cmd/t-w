import { useState } from 'react';
import { accountErrorMessage, useEnv, withProdMark } from '@/shared/api';
import { ADMIN_MEMO_MAX } from '@/shared/lib';
import { useModalDialog, useToast } from '@/shared/ui';
import { ONLINE_UNKNOWN_LABEL } from '@/entities/user';
import { useDeleteAccountPort } from '../api/index';
import { authLabel, confirmMatches, doneSummary, type AccountDeleteResult } from '../model/deleteAccount';
import {
  acceptedText,
  contextLabel,
  filesText,
  providersLabel,
  type ServerDeleteAccepted,
  type ServerDeletePreview,
} from '../model/serverDelete';
import {
  useAccountDelete,
  useAccountDeletePreview,
  useServerDelete,
  useServerDeletePreview,
} from '../model/useDeleteAccount';
import styles from './DeleteAccount.module.css';

const CALL_FAIL = '삭제 함수를 부르지 못했어요 — 함수가 배포됐는지, 관리자 계정인지 확인해 주세요';

interface Props {
  /** 사용자 상세에서 열면 그 사람의 사용자 코드가 미리 들어간다. 없으면 직접 넣는다. */
  code?: string;
  /** 지운 뒤 — 목록을 다시 읽고 상세 창을 닫는 데 쓴다. */
  onDeleted?: () => void;
}

function Preview({ r }: { r: AccountDeleteResult }) {
  return (
    <>
      <dl className={styles.who}>
        <dt>이름</dt>
        <dd>{r.name ?? <span className="soft">없음</span>}</dd>
        <dt>친구 코드</dt>
        <dd>
          <code className="key">{r.friendCode ?? '—'}</code>
        </dd>
        <dt>사용자 코드</dt>
        <dd>
          <code className="key">{r.code}</code>
          {r.online && <b className="warn"> · 접속 중</b>}
        </dd>
      </dl>
      {r.warnings.map((w) => (
        <p key={w} className="warn">
          {w}
        </p>
      ))}
      {r.empty ? (
        <p className="soft">지울 것이 없어요 — 이미 지웠거나 없는 코드예요.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>지울 것</th>
              <th>개수</th>
            </tr>
          </thead>
          <tbody>
            {r.groups.map((g) => (
              <tr key={g.key}>
                <td>
                  <details>
                    <summary>{g.label}</summary>
                    <ul className={styles.paths}>
                      {g.paths.map((p) => (
                        <li key={p}>
                          <code className="key">{p}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td>{g.count}</td>
              </tr>
            ))}
            <tr>
              <td>
                <details>
                  <summary>올린 파일 (자리비움 · 이모티콘 · 3D 모델 · 마이홈 그림 등)</summary>
                  <ul className={styles.paths}>
                    {r.storage.places.map((s) => (
                      <li key={s.place}>
                        <code className="key">{s.place}</code> {s.count}개
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
              <td>{r.storage.count}</td>
            </tr>
            <tr>
              <td>로그인 계정</td>
              <td>{authLabel(r.auth)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <details className={styles.kept}>
        <summary>남기는 것 {r.kept.length}가지</summary>
        <ul>
          {r.kept.map((k) => (
            <li key={k.label}>
              {k.label} <small className="soft">— {k.why}</small>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

function FunctionsBody({
  code: initial,
  onDone,
}: {
  code?: string;
  onDone: (r: AccountDeleteResult) => void;
}) {
  const env = useEnv();
  const [input, setInput] = useState(initial ?? '');
  const [typed, setTyped] = useState('');
  const preview = useAccountDeletePreview();
  const remove = useAccountDelete();
  const r = preview.data;
  const ready = !!r && !r.empty && confirmMatches(typed, r);

  const look = () => {
    setTyped('');
    remove.reset();
    preview.mutate(input);
  };

  const run = () => {
    if (!r || !ready) return;
    remove.mutate(r.code, { onSuccess: onDone });
  };

  if (remove.data?.done) {
    return (
      <p className="msg">
        지웠어요 — {doneSummary(remove.data.done)}
        {'\n'}작업 기록에 남겼어요.
      </p>
    );
  }

  return (
    <>
      <p className="soft">
        개인정보 처리방침 8항의 삭제 요청을 처리해요. 미리 보기로 지울 것을 확인한 뒤, 코드를 한 번 더 넣어야
        지워져요. 되돌릴 수 없어요.
      </p>
      <form
        className={styles.line}
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
      >
        <input
          type="text"
          aria-label="사용자 코드 또는 친구 코드"
          placeholder="사용자 코드(u…) 또는 친구 코드(MATE-XXXX)"
          value={input}
          disabled={!!initial}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn"
          disabled={!input.trim() || preview.isPending || remove.isPending}
        >
          {preview.isPending ? '확인 중…' : '미리 보기'}
        </button>
      </form>
      {preview.error && <p className="msg err">{accountErrorMessage(preview.error, CALL_FAIL)}</p>}
      {r && <Preview r={r} />}
      {r && !r.empty && (
        <form
          className={styles.confirm}
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label>
            지우려면 사용자 코드(또는 친구 코드)를 그대로 입력하세요
            <input
              type="text"
              aria-label="확인 코드"
              placeholder={r.code}
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <button type="submit" className="btn danger" disabled={!ready || remove.isPending}>
            {remove.isPending ? '지우는 중…' : withProdMark(env, '삭제')}
          </button>
        </form>
      )}
      {remove.error && <p className="msg err">{accountErrorMessage(remove.error, CALL_FAIL)}</p>}
    </>
  );
}

/** API 판 미리 보기 — 서버가 센 양 · 계정 소개 · 남기는 것. 못 읽은 칸은 못 읽었다고 적는다. */
function ServerPreview({ p }: { p: ServerDeletePreview }) {
  return (
    <>
      <dl className={styles.who}>
        <dt>이름</dt>
        <dd>{p.name || <span className="soft">없음</span>}</dd>
        <dt>친구 코드</dt>
        <dd>
          <code className="key">{p.friendCode}</code>
        </dd>
        <dt>사용자 코드</dt>
        <dd>
          <code className="key">{p.userCode}</code>
          {p.online === true && <b className="warn"> · 접속 중</b>}
          {p.online === null && <small className="soft"> · {ONLINE_UNKNOWN_LABEL}</small>}
        </dd>
      </dl>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>지울 것</th>
            <th>개수</th>
          </tr>
        </thead>
        <tbody>
          {p.byContext.map((c) => (
            <tr key={c.context}>
              <td>{contextLabel(c.context)}</td>
              <td>{c.count}</td>
            </tr>
          ))}
          <tr>
            <td>DB 합계</td>
            <td>{p.items}</td>
          </tr>
          <tr>
            <td>올린 파일</td>
            <td>{filesText(p.files)}</td>
          </tr>
          <tr>
            <td>로그인 계정</td>
            <td>{p.hasLogin ? providersLabel(p.loginProviders) : '없음'}</td>
          </tr>
        </tbody>
      </table>
      <details className={styles.kept}>
        <summary>남기는 것 {p.kept.length}가지</summary>
        <ul>
          {p.kept.map((k) => (
            <li key={k.label}>
              {k.label} <small className="soft">— {k.why}</small>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

function ServerBody({ code: initial, onDone }: { code?: string; onDone: (r: ServerDeleteAccepted) => void }) {
  const env = useEnv();
  const [input, setInput] = useState(initial ?? '');
  const [typed, setTyped] = useState('');
  const [memo, setMemo] = useState('');
  const preview = useServerDeletePreview();
  const remove = useServerDelete();
  const p = preview.data;
  const ready = !!p && confirmMatches(typed, { code: p.userCode, friendCode: p.friendCode });

  const look = () => {
    setTyped('');
    remove.reset();
    preview.mutate(input);
  };

  const run = () => {
    if (!p || !ready) return;
    remove.mutate({ userCode: p.userCode, memo }, { onSuccess: onDone });
  };

  if (remove.data) {
    return (
      <p className="msg">
        {acceptedText(remove.data)}
        {'\n'}작업 기록에 남겼어요.
      </p>
    );
  }

  return (
    <>
      <p className="soft">
        개인정보 처리방침 8항의 삭제 요청을 처리해요. 미리 보기로 지울 것을 확인한 뒤, 코드를 한 번 더 넣어야
        삭제를 시작해요. 서버가 받은 뒤 뒤에서 지우고, 되돌릴 수 없어요.
      </p>
      <form
        className={styles.line}
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
      >
        <input
          type="text"
          aria-label="사용자 코드 또는 친구 코드"
          placeholder="사용자 코드(u…) 또는 친구 코드(MATE-XXXX)"
          value={input}
          disabled={!!initial}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn"
          disabled={!input.trim() || preview.isPending || remove.isPending}
        >
          {preview.isPending ? '확인 중…' : '미리 보기'}
        </button>
      </form>
      {preview.error && <p className="msg err">{accountErrorMessage(preview.error, CALL_FAIL)}</p>}
      {p && <ServerPreview p={p} />}
      {p && (
        <form
          className={styles.confirm}
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label>
            메모(왜 지우나 — 작업 기록에 남아요)
            <input
              type="text"
              aria-label="메모"
              placeholder="삭제 요청 · 제보 번호 · 연락 경로"
              autoComplete="off"
              required
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            {/* 글자 수 힌트 — 서버 한도(1~60자)를 막지 않고 알려 주기만 한다. */}
            <small className="soft">
              {memo.length}/{ADMIN_MEMO_MAX}
            </small>
          </label>
          <label>
            지우려면 사용자 코드(또는 친구 코드)를 그대로 입력하세요
            <input
              type="text"
              aria-label="확인 코드"
              placeholder={p.userCode}
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <button type="submit" className="btn danger" disabled={!ready || remove.isPending}>
            {remove.isPending ? '보내는 중…' : withProdMark(env, '삭제')}
          </button>
        </form>
      )}
      {remove.error && <p className="msg err">{accountErrorMessage(remove.error, CALL_FAIL)}</p>}
    </>
  );
}

export function DeleteAccountButton({ code, onDeleted }: Props) {
  const port = useDeleteAccountPort();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const close = () => {
    setOpen(false);
    if (deleted) onDeleted?.();
    setDeleted(false);
  };
  // 사용자 상세 창 안에서 열린다 — 훅이 이 창 자신의 close 만 받는다.
  const { dialogProps } = useModalDialog({ open, onClose: close });

  const done = (r: AccountDeleteResult) => {
    setDeleted(true);
    if (r.done) toast(`계정을 지웠어요 — ${doneSummary(r.done)}`);
  };
  const accepted = (r: ServerDeleteAccepted) => {
    setDeleted(true);
    toast(acceptedText(r));
  };

  return (
    <>
      <button type="button" className="btn danger" onClick={() => setOpen(true)}>
        계정 삭제
      </button>
      <dialog {...dialogProps} className={styles.dialog} aria-label="계정 삭제">
        <div className={styles.head}>
          <h2>계정 삭제</h2>
          <button type="button" className="btn" onClick={close}>
            닫기
          </button>
        </div>
        {/* 열 때마다 새로 — 지난번 미리 보기 · 확인 입력이 남지 않게. */}
        {open &&
          (port.kind === 'server' ? (
            <ServerBody code={code} onDone={accepted} />
          ) : (
            <FunctionsBody code={code} onDone={done} />
          ))}
      </dialog>
    </>
  );
}
