import { useState, type FormEvent } from 'react';
import { checkUserCount } from '@/entities/user-count';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useAdjustUserCount } from '../model/useAdjustUserCount';
import styles from './AdjustUserCount.module.css';

export function AdjustUserCount({ current }: { current: number }) {
  const toast = useToast();
  const adjust = useAdjustUserCount();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = checkUserCount(value, current);
    if (!check.ok) {
      setError(
        check.reason === 'not-number'
          ? '0 이상의 숫자를 넣어 주세요'
          : `지금 값(${current}명)보다 작게는 바꿀 수 없어요 — 규칙이 늘리는 쪽만 받아요`,
      );
      return;
    }
    setError('');
    adjust.mutate(check.value, {
      onSuccess: () => {
        toast(`가입 수를 ${check.value}명으로 맞췄어요`);
        setValue('');
      },
      onError: (err) => setError(errorMessage(err, '바꾸지 못했어요 — 네트워크를 확인해 주세요')),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={9}
        placeholder={`보정 (${current} 이상)`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn" disabled={adjust.isPending}>
        {adjust.isPending ? '저장 중…' : '보정'}
      </button>
      {error && <small className={styles.error}>{error}</small>}
    </form>
  );
}
