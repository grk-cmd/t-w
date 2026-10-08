import { useState, type FormEvent } from 'react';
import {
  BUG_DAILY_MAX_DEFAULT,
  BUG_DAILY_MAX_MAX,
  BUG_DAILY_MAX_MIN,
  parseBugDailyMax,
  useBugDailyMax,
} from '@/entities/bug-board';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveBugDailyMax } from '../model/useSaveBugDailyMax';
import styles from './BugDailyMaxCard.module.css';

type Message = { text: string; error: boolean } | null;

/** config/bugDailyMax — 앱이 버그 게시판을 열 때 한 번 읽는다(없으면 5). 관리자 글은 세지 않는다. */
export function BugDailyMaxCard() {
  const env = useEnv();
  const { data: saved, error, isPending } = useBugDailyMax();
  const save = useSaveBugDailyMax();
  const current = saved ?? BUG_DAILY_MAX_DEFAULT;
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const value = draft ?? String(current);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const max = parseBugDailyMax(value);
    if (max === null) {
      setMessage({ text: `${BUG_DAILY_MAX_MIN}~${BUG_DAILY_MAX_MAX} 사이 숫자`, error: true });
      return;
    }
    if (max === saved) {
      setMessage({ text: '지금 값과 같음', error: true });
      return;
    }
    if (
      !confirm(
        withProdMark(env, `버그 제보 하루 상한 ${current}건 → ${max}건 — 게시판을 새로 여는 사용자부터`),
      )
    )
      return;
    save.mutate(
      { max, before: saved ?? null },
      {
        onSuccess: () => {
          setMessage({ text: `저장 · 하루 ${max}건`, error: false });
          setDraft(null);
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>버그 제보 하루 상한</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form className={styles.row} onSubmit={submit}>
          <label htmlFor="bugDailyMax">한 사람이 하루에 쓸 수 있는 제보</label>
          <span className={styles.count}>
            <input
              id="bugDailyMax"
              type="text"
              inputMode="numeric"
              maxLength={3}
              disabled={isPending}
              value={isPending ? '' : value}
              onChange={(e) => setDraft(e.target.value)}
            />
            건
          </span>
          <button
            type="submit"
            className="btn primary"
            disabled={save.isPending || isPending || draft === null}
          >
            {save.isPending ? '저장 중…' : '저장'}
          </button>
          <small className={`soft ${styles.hint}`}>
            {!isPending && saved === null && `서버 값 없음 → 기본 ${BUG_DAILY_MAX_DEFAULT}건 · `}
            앱에서만 막는 제한 · 관리자 글은 세지 않음
          </small>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
