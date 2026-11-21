import { useState, type FormEvent } from 'react';
import {
  CHAT_KEEP_DEFAULT,
  CHAT_KEEP_KINDS,
  CHAT_KEEP_MAX,
  CHAT_KEEP_MIN,
  CHAT_KEEP_PRIVACY_DAYS,
  chatKeepChanges,
  chatKeepDetail,
  effectiveKeep,
  parseKeepInput,
  useChatKeep,
  type ChatKeepKind,
} from '@/entities/room';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveChatKeep } from '../model/useSaveChatKeep';
import styles from './ChatKeepDaysCard.module.css';

type Message = { text: string; error: boolean } | null;
type Drafts = Partial<Record<ChatKeepKind, string>>;

/** config/chatKeepDays — 함수 chatExpire 가 매시간 읽어 그 일수가 지난 대화를 지운다. 앱 릴리스 없이 옛 앱에도 적용된다. */
export function ChatKeepDaysCard() {
  const env = useEnv();
  const { data: saved = {}, error, isPending } = useChatKeep();
  const save = useSaveChatKeep();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [message, setMessage] = useState<Message>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<ChatKeepKind, number | null>> = {};
    for (const [kind, text] of Object.entries(drafts) as [ChatKeepKind, string][]) {
      const v = parseKeepInput(text);
      if (v === undefined) {
        setMessage({ text: `${CHAT_KEEP_MIN}~${CHAT_KEEP_MAX} 사이 숫자 (빈 칸 = 기본값)`, error: true });
        return;
      }
      next[kind] = v;
    }
    const updates = chatKeepChanges(saved, next);
    if (!Object.keys(updates).length) {
      setMessage({ text: '지금 값과 같음', error: true });
      return;
    }
    const after = { ...saved };
    for (const [p, v] of Object.entries(updates)) {
      const kind = p.split('/').pop() as string;
      if (v === null) delete after[kind];
      else after[kind] = v;
    }
    const longer = CHAT_KEEP_KINDS.some(({ kind }) => effectiveKeep(after, kind) > CHAT_KEEP_PRIVACY_DAYS);
    const warn = longer
      ? `\n\n⚠️ 처리방침에는 서버 ${CHAT_KEEP_PRIVACY_DAYS}일로 적혀 있어요 — 처리방침을 먼저 고쳐 주세요.`
      : '';
    if (
      !confirm(
        withProdMark(
          env,
          `대화 보관 일수 — ${chatKeepDetail(saved, updates)}\n다음 정각 30분 정리부터 적용돼요.${warn}`,
        ),
      )
    )
      return;
    save.mutate(
      { before: saved, updates },
      {
        onSuccess: () => {
          setDrafts({});
          setMessage({ text: '저장 · 다음 정각 30분부터 적용', error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>서버 대화 보관 일수</h2>
      <p className="soft">
        방 종류마다 서버에 대화를 며칠 둘지 정해요. 빈 칸은 기본값을 따라요. 워킹룸 · 시크릿룸 대화는 각자 PC
        에도 남아요.
      </p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form onSubmit={submit}>
          {CHAT_KEEP_KINDS.map(({ kind, label }) => (
            <div key={kind} className={styles.row}>
              <label htmlFor={`chatKeep-${kind}`} className={styles.label}>
                {label}
              </label>
              <span className={styles.count}>
                <input
                  id={`chatKeep-${kind}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  disabled={isPending}
                  placeholder={isPending ? '' : String(effectiveKeep(saved, kind))}
                  value={drafts[kind] ?? (isPending ? '' : String(saved[kind] ?? ''))}
                  onChange={(e) => setDrafts({ ...drafts, [kind]: e.target.value })}
                />
                일
              </span>
            </div>
          ))}
          <div className={styles.row}>
            <button
              type="submit"
              className="btn primary"
              disabled={save.isPending || isPending || !Object.keys(drafts).length}
            >
              {save.isPending ? '저장 중…' : '저장'}
            </button>
            <small className={`soft ${styles.hint}`}>
              {CHAT_KEEP_MIN}~{CHAT_KEEP_MAX}일 · 아무것도 없으면 {CHAT_KEEP_DEFAULT}일 · 방 정보가 이미
              지워진 빈 방은 기본값 · 매시간 30분에 정리
            </small>
          </div>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
