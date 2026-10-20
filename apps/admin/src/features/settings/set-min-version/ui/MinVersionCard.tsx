import { useState, type FormEvent } from 'react';
import {
  compareVersion,
  MIN_VERSIONS,
  minVersionProblem,
  useMinVersion,
  type MinVersionKind,
} from '@/entities/min-version';
import { useReleaseDownloads } from '@/entities/release';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage, toVersionParts, type VersionParts } from '@/shared/lib';
import { VersionInput } from '@/shared/ui';
import { useSaveMinVersion } from '../model/useSaveMinVersion';
import styles from './MinVersionCard.module.css';

type Message = { text: string; error: boolean } | null;

// 카드 아래 한 줄 — 무엇이 막히는지. app 은 이 장치가 든 판부터만 읽는다는 것도.
const HINTS: Record<MinVersionKind, string | null> = {
  room: null,
  app: '0.11.0 부터 든 장치예요 — 그보다 옛 앱은 이 값을 읽지 않아요.',
};

// 숫자 세 칸 — 화살표 · 휠 · 키보드 ↑↓ 로 하나씩 올린다. 올리면 그보다 낮은 앱은 업데이트 전까지 막힌다.
export function MinVersionCard({ kind }: { kind: MinVersionKind }) {
  const env = useEnv();
  const meta = MIN_VERSIONS[kind];
  const { data: current, error, isPending } = useMinVersion(kind);
  const releases = useReleaseDownloads();
  const latest = releases.data?.[0]?.version ?? null;
  const save = useSaveMinVersion(kind);
  const before = current ?? null;
  // 고치기 전에는 지금 값을 그대로 보여 준다.
  const [draft, setDraft] = useState<VersionParts | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const parts = draft ?? toVersionParts(before, '0').parts;
  const next = parts.map((p) => String(Number(p) || 0)).join('.');

  const setParts = (next: VersionParts) => {
    setDraft(next);
    setMessage(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = minVersionProblem(kind, next, before, latest);
    if (problem) return setMessage({ text: problem, error: true });
    const lower = before !== null && compareVersion(next, before) < 0;
    const text = lower
      ? `${meta.title}: ${before} → ${next} 로 낮출까요?`
      : `${meta.title}: ${before ?? '제한 없음'} → ${next} — ${next} 보다 낮은 앱은 ${meta.blocked}.`;
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

  const hint = HINTS[kind];

  return (
    <section className="card">
      <h2>{meta.title}</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오지 못했어요')}</p>
      ) : (
        <>
          <p className={styles.now}>
            지금 <code className="key">{isPending ? '…' : (current ?? '제한 없음')}</code>
            <span className="soft">최신 릴리스 {latest ?? (releases.isLoading ? '…' : '확인 못 함')}</span>
          </p>
          <form className={styles.row} onSubmit={submit}>
            <VersionInput value={parts} onChange={setParts} disabled={isPending} />
            <button
              type="submit"
              className="btn primary"
              disabled={save.isPending || isPending || draft === null}
            >
              저장
            </button>
          </form>
          {hint && <p className="soft">{hint}</p>}
        </>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
