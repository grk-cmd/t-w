import { useState, type FormEvent } from 'react';
import {
  DEFAULT_ANIMAL_UNLOCK_LEVEL,
  parseUnlockLevel,
  UNLOCK_LEVEL_MAX,
  UNLOCK_LEVEL_MIN,
  useAnimalUnlockLevel,
} from '@/entities/game-config';
import { errorMessage } from '@/shared/lib';
import { useSaveUnlockLevel } from '../model/useSaveUnlockLevel';
import styles from './GameConfigCard.module.css';

type Message = { text: string; error: boolean } | null;

export function GameConfigCard() {
  const { data: saved, error, isPending } = useAnimalUnlockLevel();
  const save = useSaveUnlockLevel();
  const current = saved ?? DEFAULT_ANIMAL_UNLOCK_LEVEL;
  // 고치기 전에는 지금 값을 그대로 보여 준다. 저장되면 다시 서버 값을 따른다.
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const value = draft ?? String(current);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const level = parseUnlockLevel(value);
    if (level === null) {
      setMessage({ text: `${UNLOCK_LEVEL_MIN}~${UNLOCK_LEVEL_MAX} 사이 숫자를 넣어 주세요`, error: true });
      return;
    }
    if (level === saved) {
      setMessage({ text: '지금 값과 같아요', error: true });
      return;
    }
    if (!confirm(`동물 해금 레벨을 Lv.${current} → Lv.${level} 로 바꿀까요? 모든 사용자에게 바로 반영돼요.`))
      return;
    save.mutate(level, {
      onSuccess: () => {
        setMessage({ text: `저장했어요 — 동물 해금 Lv.${level}`, error: false });
        setDraft(null);
      },
      onError: (err) => setMessage({ text: errorMessage(err, '저장하지 못했어요'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>게임 설정</h2>
      <p className="soft">앱을 새로 배포하지 않고 바꾸는 값이에요. 저장하면 모든 사용자에게 바로 반영돼요.</p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오지 못했어요')}</p>
      ) : (
        <form className={styles.row} onSubmit={submit}>
          <label htmlFor="animalUnlockLevel">동물 캐릭터 해금 레벨</label>
          <span className={styles.level}>
            Lv.
            <input
              id="animalUnlockLevel"
              type="text"
              inputMode="numeric"
              maxLength={3}
              disabled={isPending}
              value={isPending ? '' : value}
              onChange={(e) => setDraft(e.target.value)}
            />
          </span>
          <button
            type="submit"
            className="btn primary"
            disabled={save.isPending || isPending || draft === null}
          >
            {save.isPending ? '저장 중…' : '저장'}
          </button>
          {!isPending && saved === null && (
            <small className={`soft ${styles.hint}`}>
              서버에 저장된 값이 없어 앱 기본값(Lv.{DEFAULT_ANIMAL_UNLOCK_LEVEL})을 쓰는 중
            </small>
          )}
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
