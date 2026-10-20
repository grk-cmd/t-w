import { useState } from 'react';
import {
  checkBroadcast,
  INBOX_BODY_MAX,
  INBOX_TAG_LABEL,
  INBOX_TITLE_MAX,
  type InboxMessage,
  type InboxTag,
} from '@/entities/inbox';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useSendBroadcast } from '../model/useSendBroadcast';
import styles from './SendBroadcastCard.module.css';

const EMPTY: InboxMessage = { tag: 'notice', title: '', body: '' };
const TAGS = Object.keys(INBOX_TAG_LABEL) as InboxTag[];

export function SendBroadcastCard() {
  const toast = useToast();
  const send = useSendBroadcast();
  const [message, setMessage] = useState<InboxMessage>(EMPTY);
  const [pinned, setPinned] = useState(false);
  const edit = (patch: Partial<InboxMessage>) => setMessage((m) => ({ ...m, ...patch }));

  const onSend = () => {
    const problem = checkBroadcast(message);
    if (problem) return toast(problem);
    const label = `[${INBOX_TAG_LABEL[message.tag]}]${pinned ? ' 📌고정' : ''}`;
    if (!confirm(`전체 유저에게 ${label} "${message.title.trim()}" 메시지를 보낼까요?`)) return;
    send.mutate(
      { message, pinned },
      {
        onSuccess: () => {
          setMessage(EMPTY);
          setPinned(false);
          toast('전체 수령함으로 보냈어요');
        },
        onError: (e) => toast(errorMessage(e, '보내지 못했어요')),
      },
    );
  };

  return (
    <section className="card">
      <h2>📩 수령함 전체 공지</h2>
      <div className={styles.tags} role="radiogroup" aria-label="태그">
        {TAGS.map((tag) => (
          <label key={tag}>
            <input
              type="radio"
              name="broadcast-tag"
              checked={message.tag === tag}
              onChange={() => edit({ tag })}
            />
            {INBOX_TAG_LABEL[tag]}
          </label>
        ))}
        <label className={styles.pin}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />맨 위 고정
        </label>
      </div>
      <div className="field">
        <input
          type="text"
          maxLength={INBOX_TITLE_MAX}
          placeholder="제목"
          value={message.title}
          onChange={(e) => edit({ title: e.target.value })}
        />
      </div>
      <textarea
        className={styles.textarea}
        rows={5}
        maxLength={INBOX_BODY_MAX}
        placeholder="내용"
        value={message.body}
        onChange={(e) => edit({ body: e.target.value })}
      />
      <div className={styles.actions}>
        <small className="soft grow">
          {message.body.length} / {INBOX_BODY_MAX}
        </small>
        <button type="button" className="btn primary" disabled={send.isPending} onClick={onSend}>
          {send.isPending ? '보내는 중…' : '보내기'}
        </button>
      </div>
    </section>
  );
}
