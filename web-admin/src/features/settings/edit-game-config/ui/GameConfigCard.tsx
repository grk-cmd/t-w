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

type Message = { text: string; error: boolean } | null;

export function GameConfigCard() {
  const { data: saved, error, isPending } = useAnimalUnlockLevel();
  const save = useSaveUnlockLevel();
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const current = saved ?? DEFAULT_ANIMAL_UNLOCK_LEVEL;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const level = parseUnlockLevel(input);
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
        setInput('');
      },
      onError: (err) => setMessage({ text: errorMessage(err, '저장하지 못했어요'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>게임 설정</h2>
      <p className="soft">앱을 새로 배포하지 않고 바꾸는 값이에요. 저장하면 모든 사용자에게 바로 반영돼요.</p>
      <p>
        동물 캐릭터 해금 레벨:{' '}
        {error ? (
          <span className="warn">{errorMessage(error, '불러오지 못했어요')}</span>
        ) : isPending ? (
          <span className="soft">불러오는 중…</span>
        ) : (
          <b>
            Lv.{current}
            {saved === null && <span className="soft"> (서버 값 없음 — 앱 기본값)</span>}
          </b>
        )}
      </p>
      <form className="field" onSubmit={submit}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={3}
          placeholder={`새 해금 레벨 (${UNLOCK_LEVEL_MIN}~${UNLOCK_LEVEL_MAX})`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={save.isPending || isPending || !!error}>
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
