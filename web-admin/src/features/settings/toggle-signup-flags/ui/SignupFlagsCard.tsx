import { useState } from 'react';
import {
  flagConfirmText,
  SIGNUP_FLAG_META,
  SIGNUP_FLAGS,
  useSignupFlags,
  type SignupFlag,
} from '@/entities/signup-flag';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSetSignupFlag } from '../model/useSetSignupFlag';
import styles from './SignupFlagsCard.module.css';

type Message = { text: string; error: boolean } | null;

// config/flags — 앱이 가입 화면에서 읽는 스위치. 칸이 없으면 켜진 것으로 본다.
export function SignupFlagsCard() {
  const env = useEnv();
  const { data: flags, error, isPending } = useSignupFlags();
  const save = useSetSignupFlag();
  const [message, setMessage] = useState<Message>(null);

  const toggle = (flag: SignupFlag, value: boolean) => {
    if (!confirm(withProdMark(env, flagConfirmText(flag, value)))) return;
    save.mutate(
      { flag, value },
      {
        onSuccess: () =>
          setMessage({
            text: `${SIGNUP_FLAG_META[flag].label} ${value ? '켜짐' : '꺼짐'} · 앱은 바로 반영`,
            error: false,
          }),
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>가입 스위치</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        SIGNUP_FLAGS.map((flag) => {
          const m = SIGNUP_FLAG_META[flag];
          return (
            <div key={flag} className={styles.item}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={flags?.[flag] ?? true}
                  disabled={isPending || save.isPending}
                  onChange={(e) => toggle(flag, e.target.checked)}
                />
                {m.label}
              </label>
              <small className="soft">{m.on}</small>
              <small className="soft">{m.off}</small>
            </div>
          );
        })
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
