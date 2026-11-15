import { REMOTE_CONFIG_EDIT_LOCKED, REMOTE_CONFIG_LOCK_NOTE } from '@/shared/config';
import { useState } from 'react';
import {
  flagConfirmText,
  SIGNUP_FLAG_META,
  useSignupFlagPort,
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
  const { data: from, error, isPending } = useSignupFlags();
  const flags = from?.value;
  const save = useSetSignupFlag();
  const { flags: shown } = useSignupFlagPort();
  const [message, setMessage] = useState<Message>(null);

  const toggle = (flag: SignupFlag, value: boolean) => {
    if (!from) return;
    if (!confirm(withProdMark(env, flagConfirmText(flag, value)))) return;
    save.mutate(
      { flag, from, value },
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
      {REMOTE_CONFIG_EDIT_LOCKED && <p className="soft">{REMOTE_CONFIG_LOCK_NOTE}</p>}
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        shown.map((flag) => {
          const m = SIGNUP_FLAG_META[flag];
          return (
            <div key={flag} className={styles.item}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={flags?.[flag] ?? true}
                  disabled={isPending || save.isPending || REMOTE_CONFIG_EDIT_LOCKED}
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
