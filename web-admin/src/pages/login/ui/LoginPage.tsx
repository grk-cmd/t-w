import { FirebaseError } from 'firebase/app';
import { useState } from 'react';
import styles from './LoginPage.module.css';

interface Props {
  onSignIn: () => Promise<void>;
  message?: string;
}

export function LoginPage({ onSignIn, message }: Props) {
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    try {
      await onSignIn();
    } catch (e) {
      if (e instanceof FirebaseError && e.code === 'auth/popup-closed-by-user') return;
      setError(`로그인하지 못했어요 (${e instanceof FirebaseError ? e.code : '알 수 없는 오류'})`);
    }
  };

  const shown = error ?? message;

  return (
    <main className="center">
      <section className={`card ${styles.login}`}>
        <h1>관리자 로그인</h1>
        <p className="soft">관리자로 등록된 구글 계정만 들어올 수 있어요.</p>
        <button type="button" className={`btn primary ${styles.big}`} onClick={signIn}>
          구글 계정으로 로그인
        </button>
        {shown && <p className="msg err">{shown}</p>}
      </section>
    </main>
  );
}
