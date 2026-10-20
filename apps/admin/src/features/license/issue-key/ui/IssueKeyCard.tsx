import { useState } from 'react';
import { NOTE_MAX } from '@/entities/license';
import { copyText, errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useIssueKey } from '../model/useIssueKey';
import styles from './IssueKeyCard.module.css';

export function IssueKeyCard() {
  const toast = useToast();
  const issue = useIssueKey();
  const [note, setNote] = useState('');
  const [issued, setIssued] = useState<{ key: string; note: string } | null>(null);

  const onIssue = () => {
    const memo = note.trim();
    issue.mutate(memo, {
      onSuccess: (key) => {
        setIssued({ key, note: memo });
        setNote('');
      },
      onError: (e) => toast(errorMessage(e, '발급하지 못했어요')),
    });
  };

  const copy = async (key: string) => toast((await copyText(key)) ? '복사했어요' : '복사하지 못했어요');

  return (
    <section className="card">
      <h2>새 키 발급</h2>
      <div className="field">
        <input
          type="text"
          maxLength={NOTE_MAX}
          placeholder="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className="btn primary" disabled={issue.isPending} onClick={onIssue}>
          {issue.isPending ? '발급 중…' : '발급'}
        </button>
      </div>
      {issued && (
        <div className={styles.result}>
          <span className="grow">
            <code className="key">{issued.key}</code>
            <span className="note">{issued.note || '메모 없음'}</span>
          </span>
          <button type="button" className="btn" onClick={() => copy(issued.key)}>
            복사
          </button>
        </div>
      )}
    </section>
  );
}
