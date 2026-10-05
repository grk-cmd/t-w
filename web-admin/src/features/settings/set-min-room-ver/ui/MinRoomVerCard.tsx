import { useState, type FormEvent } from 'react';
import { compareVersion, minRoomVerProblem, useMinRoomVer } from '@/entities/min-room-ver';
import { useReleaseDownloads } from '@/entities/release';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveMinRoomVer } from '../model/useSaveMinRoomVer';
import styles from './MinRoomVerCard.module.css';

type Message = { text: string; error: boolean } | null;
type Parts = [string, string, string];

const PART_LABELS = ['주', '부', '수'] as const;
const PART_MAX = 9999;

const toParts = (v: string | null): Parts => {
  const [a = '0', b = '0', c = '0'] = (v ?? '0.0.0').split('-')[0].split('.');
  return [a, b, c];
};

// 숫자 세 칸 — 화살표 · 휠 · 키보드 ↑↓ 로 하나씩 올린다. 올리면 그보다 낮은 앱은 업데이트 전까지 방에 못 들어간다.
export function MinRoomVerCard() {
  const env = useEnv();
  const { data: current, error, isPending } = useMinRoomVer();
  const releases = useReleaseDownloads();
  const latest = releases.data?.[0]?.version ?? null;
  const save = useSaveMinRoomVer();
  const before = current ?? null;
  // 고치기 전에는 지금 값을 그대로 보여 준다.
  const [draft, setDraft] = useState<Parts | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const parts = draft ?? toParts(before);
  const next = parts.map((p) => String(Number(p) || 0)).join('.');

  const setPart = (i: number, value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    const copy: Parts = [...parts];
    copy[i] = digits;
    setDraft(copy);
    setMessage(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = minRoomVerProblem(next, before, latest);
    if (problem) return setMessage({ text: problem, error: true });
    const lower = before !== null && compareVersion(next, before) < 0;
    const text = lower
      ? `${before} → ${next} 로 낮출까요?`
      : `${before ?? '제한 없음'} → ${next} — ${next} 보다 낮은 앱은 업데이트 전까지 방에 못 들어가요.`;
    if (!confirm(withProdMark(env, text))) return;
    save.mutate(
      { version: next, before },
      {
        onSuccess: () => {
          setMessage({ text: `저장했어요 · ${next}`, error: false });
          setDraft(null);
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
            {parts.map((p, i) => (
              <span key={PART_LABELS[i]} className={styles.part}>
                {i > 0 && <b className="soft">.</b>}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={PART_MAX}
                  step={1}
                  aria-label={`${PART_LABELS[i]} 버전`}
                  disabled={isPending}
                  value={p}
                  onChange={(e) => setPart(i, e.target.value)}
                />
              </span>
            ))}
            <button
              type="submit"
              className="btn primary"
              disabled={save.isPending || isPending || draft === null}
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
