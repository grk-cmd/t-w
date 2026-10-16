import { useState, type FormEvent } from 'react';
import { useIntGroup, type IntGroup } from '@/entities/server/ops-config';
import { useEnv, withProdMark, type AuditAction } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { checkIntGroup, intGroupConfirmText, useSaveIntGroup } from '../model/editOpsConfig';
import styles from './OpsConfig.module.css';

type Message = { text: string; error: boolean } | null;

interface Props {
  title: string;
  group: IntGroup;
  action: AuditAction;
  /** 저장 뒤 언제 적용되는지 — 확인 창 · 안내에 쓴다. */
  apply: string;
}

/** 한 노드 아래 정수 칸 묶음 — 손댄 칸만 쓴다 · 빈 칸은 지움(서버 기본값). */
export function IntGroupForm({ title, group, action, apply }: Props) {
  const env = useEnv();
  const { data: saved = {}, error, isPending } = useIntGroup(group);
  const save = useSaveIntGroup(group, action, title);
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<Message>(null);
  const id = (key: string) => `${group.path.replace(/\//g, '-')}-${key}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkIntGroup(group, saved, drafts);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, intGroupConfirmText(title, group, saved, r.next, apply)))) return;
    save.mutate(
      { before: saved, updates: r.next },
      {
        onSuccess: () => {
          setDrafts({});
          setMessage({ text: `저장 · ${apply}`, error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  if (error) return <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>;
  return (
    <form onSubmit={submit}>
      <h3 className={styles.sub}>{title}</h3>
      {group.fields.map((f) => (
        <div key={f.key} className={styles.row}>
          <label htmlFor={id(f.key)} className={styles.label}>
            {f.label}
          </label>
          <span className={styles.count}>
            <input
              id={id(f.key)}
              type="text"
              inputMode="numeric"
              maxLength={String(f.max).length}
              disabled={isPending}
              placeholder={isPending ? '' : String(f.def)}
              value={drafts[f.key] ?? (isPending ? '' : String(saved[f.key] ?? ''))}
              onChange={(e) => setDrafts({ ...drafts, [f.key]: e.target.value })}
            />
            {f.unit}
          </span>
          <small className="soft">
            {f.min}~{f.max} · 기본 {f.def}
            {f.note && <b className={styles.note}> · {f.note}</b>}
          </small>
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
        <small className={`soft ${styles.hint}`}>빈 칸 = 서버 기본값 · {apply}</small>
      </div>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </form>
  );
}
