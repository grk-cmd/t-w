import { useState, type FormEvent } from 'react';
import { MAINTENANCE_MESSAGE_MAX, useMaintenance } from '@/entities/server/ops-config';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  checkMaintenance,
  maintenanceConfirmText,
  toDraft,
  useSaveMaintenance,
  type MaintenanceDraft,
} from '../model/editMaintenance';
import styles from './MaintenanceCard.module.css';

type Message = { text: string; error: boolean } | null;

// 점검 안내 — 서버 설정 키 app.maintenance. 앱은 GET /v2/config 의 maintenance 로 읽는다. API 판에만 있다.
export function MaintenanceCard() {
  const env = useEnv();
  const { data: from, error, isPending } = useMaintenance();
  const saved = from?.value;
  const save = useSaveMaintenance();
  const [draft, setDraft] = useState<MaintenanceDraft | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const form = draft ?? (saved ? toDraft(saved) : { on: false, endsAt: '', message: '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from || !saved) return;
    const r = checkMaintenance(saved, form);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, maintenanceConfirmText(r.next)))) return;
    save.mutate(
      { from, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: r.next.on ? '저장 · 점검 안내 켜짐' : '저장 · 점검 안내 꺼짐', error: false });
        },
        onError: (err) => {
          setDraft(null);
          setMessage({ text: errorMessage(err, '저장 실패'), error: true });
        },
      },
    );
  };

  return (
    <section className="card">
      <h2>점검 안내</h2>
      <p className="soft">켜면 앱 전부에 점검 안내가 떠요. 서버를 다시 띄우지 않고 바로 바뀌어요.</p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.field}>
              <input
                type="checkbox"
                checked={form.on}
                disabled={isPending}
                onChange={(e) => setDraft({ ...form, on: e.target.checked })}
              />
              점검 안내 켜기
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.field}>
              끝나는 시각(선택)
              <input
                type="datetime-local"
                value={form.endsAt}
                disabled={isPending}
                onChange={(e) => setDraft({ ...form, endsAt: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.row}>
            <textarea
              className={styles.text}
              rows={3}
              maxLength={MAINTENANCE_MESSAGE_MAX}
              placeholder="안내 문구(선택)"
              aria-label="점검 안내 문구"
              disabled={isPending}
              value={form.message}
              onChange={(e) => setDraft({ ...form, message: e.target.value })}
            />
          </div>
          <div className={styles.row}>
            <button type="submit" className="btn primary" disabled={isPending || save.isPending || !draft}>
              {save.isPending ? '저장 중…' : '저장'}
            </button>
            <small className={`soft ${styles.hint}`}>
              문구 {MAINTENANCE_MESSAGE_MAX}자까지 · 시각은 이 브라우저의 시간대로 넣어요
            </small>
          </div>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
