import { useState, type FormEvent } from 'react';
import {
  BUG_DAILY_MAX_DEFAULT,
  BUG_DAILY_MAX_MAX,
  BUG_DAILY_MAX_MIN,
  useBugDailyMax,
} from '@/entities/bug-board';
import { useIntGroup, useOpsConfigPort, type IntGroup } from '@/entities/server/ops-config';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { bugDailyMaxConfirmText, checkBugDailyMax, type BugDailyMaxRange } from '../model/checkBugDailyMax';
import { useSaveBugDailyMax, useSaveServerBugDailyMax } from '../model/useSaveBugDailyMax';
import styles from './BugDailyMaxCard.module.css';

type Message = { text: string; error: boolean } | null;

interface FormProps {
  range: BugDailyMaxRange;
  /** 저장된 값 — 없으면 null(기본값을 따른다). */
  saved: number | null;
  error: unknown;
  isPending: boolean;
  saving: boolean;
  /** 확인 창에 붙는 «언제부터». */
  apply: string;
  hint: string;
  save: (max: number, done: { onSuccess: () => void; onError: (err: unknown) => void }) => void;
}

/** 한 사람이 하루에 쓸 수 있는 제보 수. 관리자 글은 세지 않는다. 읽기 · 저장 통로는 판이 고른다. */
export function BugDailyMaxCard() {
  const { groups } = useOpsConfigPort();
  return groups.bugDailyMax ? <ServerBugDailyMax group={groups.bugDailyMax} /> : <FirebaseBugDailyMax />;
}

/** API 판 — 서버 설정 키 `bug.dailyMax`(`/v2/admin/config`). 서버가 글쓰기에서 막고 작업 기록을 남긴다. */
function ServerBugDailyMax({ group }: { group: IntGroup }) {
  const field = group.fields[0];
  const { data: from, error, isPending } = useIntGroup(group);
  const save = useSaveServerBugDailyMax(group);
  return (
    <BugDailyMaxForm
      range={field}
      saved={from?.value[field.key] ?? null}
      error={error}
      isPending={isPending}
      saving={save.isPending}
      apply="다음 제보부터"
      hint="서버가 글쓰기에서 막는 제한 · 관리자 글은 세지 않음"
      save={(max, done) => from && save.mutate({ from, max }, done)}
    />
  );
}

/** Firebase 판 — `config/bugDailyMax`. 앱이 게시판을 열 때 한 번 읽는다(없으면 5). */
function FirebaseBugDailyMax() {
  const { data: saved, error, isPending } = useBugDailyMax();
  const save = useSaveBugDailyMax();
  return (
    <BugDailyMaxForm
      range={{ min: BUG_DAILY_MAX_MIN, max: BUG_DAILY_MAX_MAX, def: BUG_DAILY_MAX_DEFAULT }}
      saved={saved ?? null}
      error={error}
      isPending={isPending}
      saving={save.isPending}
      apply="게시판을 새로 여는 사용자부터"
      hint="앱에서만 막는 제한 · 관리자 글은 세지 않음"
      save={(max, done) => save.mutate({ max, before: saved ?? null }, done)}
    />
  );
}

function BugDailyMaxForm({ range, saved, error, isPending, saving, apply, hint, save }: FormProps) {
  const env = useEnv();
  const current = saved ?? range.def;
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const value = draft ?? String(current);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkBugDailyMax(range, value, saved);
    if (!r.ok) {
      setMessage({ text: r.error, error: true });
      return;
    }
    if (!confirm(withProdMark(env, bugDailyMaxConfirmText(current, r.max, apply)))) return;
    save(r.max, {
      onSuccess: () => {
        setMessage({ text: `저장 · 하루 ${r.max}건`, error: false });
        setDraft(null);
      },
      onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
    });
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
              maxLength={String(range.max).length}
              disabled={isPending}
              value={isPending ? '' : value}
              onChange={(e) => setDraft(e.target.value)}
            />
            건
          </span>
          <button type="submit" className="btn primary" disabled={saving || isPending || draft === null}>
            {saving ? '저장 중…' : '저장'}
          </button>
          <small className={`soft ${styles.hint}`}>
            {!isPending && saved === null && `서버 값 없음 → 기본 ${range.def}건 · `}
            {hint}
          </small>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
