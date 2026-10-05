import { useState, type FormEvent } from 'react';
import { compareVersion, MIN_ROOM_VER_MAX, minRoomVerProblem, useMinRoomVer } from '@/entities/min-room-ver';
import { useReleaseDownloads } from '@/entities/release';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveMinRoomVer } from '../model/useSaveMinRoomVer';
import styles from './MinRoomVerCard.module.css';

type Message = { text: string; error: boolean } | null;

// 올리면 그보다 낮은 앱은 업데이트 전까지 방에 못 들어간다 — 같은 버전을 한 번 더 적어야 저장된다.
export function MinRoomVerCard() {
  const env = useEnv();
  const { data: current, error, isPending } = useMinRoomVer();
  const releases = useReleaseDownloads();
  const latest = releases.data?.[0]?.version ?? null;
  const save = useSaveMinRoomVer();
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const before = current ?? null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = minRoomVerProblem(next, before, latest);
    if (problem) return setMessage({ text: problem, error: true });
    const v = next.trim();
    const lower = before !== null && compareVersion(v, before) < 0;
    const text = lower
      ? `${before} → ${v} 로 낮출까요?`
      : `${before ?? '제한 없음'} → ${v} — ${v} 보다 낮은 앱은 업데이트 전까지 방에 못 들어가요.`;
    if (!confirm(withProdMark(env, text))) return;
    save.mutate(
      { version: v, before },
      {
        onSuccess: () => {
          setMessage({ text: `저장했어요 · ${v}`, error: false });
          setNext('');
          setAgain('');
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장하지 못했어요'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>방 입장 최소 버전</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오지 못했어요')}</p>
      ) : (
        <>
          <p className={styles.now}>
            지금 <code className="key">{isPending ? '…' : (current ?? '제한 없음')}</code>
            <span className="soft">최신 릴리스 {latest ?? (releases.isLoading ? '…' : '확인 못 함')}</span>
          </p>
          <form className={styles.row} onSubmit={submit}>
            <input
              type="text"
              aria-label="새 최소 버전"
              placeholder="0.10.2"
              maxLength={MIN_ROOM_VER_MAX}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <input
              type="text"
              aria-label="한 번 더"
              placeholder="한 번 더"
              maxLength={MIN_ROOM_VER_MAX}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={save.isPending || isPending || !next.trim() || next.trim() !== again.trim()}
            >
              저장
            </button>
          </form>
        </>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
