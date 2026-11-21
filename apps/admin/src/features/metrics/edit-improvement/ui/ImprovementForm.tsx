import { useState, type FormEvent } from 'react';
import {
  ADOPT_DAYS_MAX,
  ITEM_MAX,
  ITEMS_MAX,
  TITLE_MAX,
  VERSION_MAX,
  type Improvement,
} from '@/entities/metrics/usage';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { draftOf, emptyForm, formOf, type ImprovementForm as Form } from '../model/form';
import { useSaveImprovement } from '../model/useImprovementMutations';
import styles from './ImprovementForm.module.css';

/** 새 기록(entry 없음) 또는 고치기. 저장하거나 취소하면 onDone. */
export function ImprovementForm({ entry, onDone }: { entry?: Improvement; onDone: () => void }) {
  const toast = useToast();
  const save = useSaveImprovement();
  const [form, setForm] = useState<Form>(() => (entry ? formOf(entry) : emptyForm(Date.now())));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = draftOf(form);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setError(null);
    save.mutate(
      { draft: r.draft, id: entry?.id },
      {
        onSuccess: () => {
          toast(entry ? '수정 완료' : '추가 완료');
          onDone();
        },
        onError: (err) => setError(errorMessage(err, '저장 실패')),
      },
    );
  };

  return (
    <form className={`card ${styles.form}`} onSubmit={submit}>
      <h2>{entry ? `${entry.version} 수정` : '개선 기록 추가'}</h2>
      <div className={styles.grid}>
        <label>
          버전
          <input type="text" maxLength={VERSION_MAX} value={form.version} onChange={set('version')} />
        </label>
        <label>
          릴리스 시각(서울)
          <input type="datetime-local" value={form.releasedAt} onChange={set('releasedAt')} />
        </label>
        <label>
          적용 기간(일)
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={form.adoptDays}
            onChange={set('adoptDays')}
            title={`0~${ADOPT_DAYS_MAX} — 사용자 대부분이 업데이트할 때까지. 이 기간 뒤부터 «후» 를 잰다`}
          />
        </label>
      </div>
      <label className={styles.wide}>
        제목
        <input type="text" maxLength={TITLE_MAX} value={form.title} onChange={set('title')} />
      </label>
      <label className={styles.wide}>
        바뀐 것 — 한 줄에 하나 · {ITEMS_MAX}줄 · 줄마다 {ITEM_MAX}자까지
        <textarea rows={5} value={form.items} onChange={set('items')} />
      </label>
      {error && <p className="msg err">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={onDone} disabled={save.isPending}>
          취소
        </button>
        <button type="submit" className="btn primary" disabled={save.isPending}>
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
