import { useState, type FormEvent } from 'react';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import type { StorageOwnersPort } from '../api/port';
import {
  BACKFILL_MEMO_MAX,
  DEFAULT_BACKFILL_MEMO,
  storageOwnersReport,
  type StorageOwnersResult,
} from '../model/storageOwners';
import { useStorageOwners } from '../model/useStorageOwners';
import styles from './StorageOwnersCard.module.css';

type Shown = { what: string; result: StorageOwnersResult } | { what: string; error: string } | null;

/** Storage 규칙을 올리기 전 — 계정마다 주인 문서가 있나 확인하고, 없으면 채운다. */
export function StorageOwnersCard({ port }: { port: StorageOwnersPort }) {
  const env = useEnv();
  const { check, backfill } = useStorageOwners(port);
  const [memo, setMemo] = useState(DEFAULT_BACKFILL_MEMO);
  const [shown, setShown] = useState<Shown>(null);
  const busy = check.isPending || backfill.isPending;
  const filled = memo.trim() !== '';

  const runCheck = () => {
    setShown(null);
    check.mutate(undefined, {
      onSuccess: (result) => setShown({ what: '확인', result }),
      onError: (err) => setShown({ what: '확인', error: errorMessage(err, '확인하지 못했어요') }),
    });
  };

  const runBackfill = (e: FormEvent) => {
    e.preventDefault();
    if (!filled) return;
    const text = `모든 계정의 Storage 주인 문서를 써요(몇 번 돌려도 같아요 · 작업 기록에 남아요). 메모: ${memo.trim()}`;
    if (!confirm(withProdMark(env, text))) return;
    setShown(null);
    backfill.mutate(memo, {
      onSuccess: (result) => setShown({ what: '채우기', result }),
      onError: (err) => setShown({ what: '채우기', error: errorMessage(err, '채우지 못했어요') }),
    });
  };

  return (
    <section className="card">
      <h2>Storage 주인</h2>
      <p className="soft">
        Storage 규칙을 올리기 전 한 번 채우고, 가끔 확인할 때 써요 — 채우기는 수십 초 걸려요.
      </p>
      <form className={styles.row} onSubmit={runBackfill}>
        <button type="button" className="btn" onClick={runCheck} disabled={busy}>
          {check.isPending ? '확인 중…' : '확인'}
        </button>
        <label className={styles.memo}>
          메모
          <input
            type="text"
            aria-label="채우기 메모"
            autoComplete="off"
            maxLength={BACKFILL_MEMO_MAX}
            value={memo}
            disabled={busy}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>
        <button type="submit" className="btn primary" disabled={busy || !filled}>
          {backfill.isPending ? '채우는 중…' : '채우기'}
        </button>
      </form>
      {shown &&
        ('error' in shown ? (
          <p className="msg err">
            {shown.what}: {shown.error}
          </p>
        ) : (
          <div className={styles.result} aria-label={`${shown.what} 결과`}>
            {storageOwnersReport(shown.result).map((line) => (
              <p key={line} className={line.startsWith('✗') ? 'msg err' : 'msg'}>
                {line}
              </p>
            ))}
          </div>
        ))}
    </section>
  );
}
