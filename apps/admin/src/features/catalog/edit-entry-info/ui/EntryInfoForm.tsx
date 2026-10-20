import { useState, type FormEvent } from 'react';
import { ENTRY_ICON_MAX, entryInfoProblem, NAME_MAX, type CatalogEntry } from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { EmojiInput, useToast } from '@/shared/ui';
import { useEditEntryInfo } from '../model/useEditEntryInfo';
import styles from './EntryInfoForm.module.css';

interface Props {
  entry: CatalogEntry;
  onDone: () => void;
}

export function EntryInfoForm({ entry, onDone }: Props) {
  const toast = useToast();
  const env = useEnv();
  const save = useEditEntryInfo();
  const [name, setName] = useState(entry.name);
  const [icon, setIcon] = useState(entry.icon);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = entryInfoProblem(name, icon);
    if (p) return setProblem(p);
    if (name.trim() === entry.name && icon.trim() === entry.icon) return onDone();
    if (!confirm(withProdMark(env, `«${name.trim()}» 로 저장할까요? 모든 사용자에게 바로 보여요.`))) return;
    try {
      await save.mutateAsync({ entry, name, icon });
      toast('저장했어요');
      onDone();
    } catch (err) {
      setProblem(errorMessage(err, '저장하지 못했어요'));
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <EmojiInput label={`${entry.id} 아이콘`} maxLength={ENTRY_ICON_MAX} value={icon} onChange={setIcon} />
      <input
        type="text"
        aria-label={`${entry.id} 이름`}
        maxLength={NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn primary" disabled={save.isPending}>
        {save.isPending ? '저장 중…' : '저장'}
      </button>
      <button type="button" className="btn" onClick={onDone}>
        취소
      </button>
      {problem && <span className="note warn">{problem}</span>}
    </form>
  );
}
