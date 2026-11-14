import styles from './LoginPage.module.css';

interface Props {
  /** 첫 줄 — 무엇이 막혔나. */
  title: string;
  /** 덧붙임(여러 줄이면 줄바꿈 그대로). */
  detail?: string;
  /** 닿지 못했을 때만 — «다시 시도». */
  onRetry?: () => void;
  onSignOut: () => void;
}

/** 로그인은 됐지만 관리자 화면을 열 수 없을 때(관리자가 아님 · 서버에 닿지 못함). 관리자 화면 · 메뉴는 열지 않는다. */
export function SessionBlocked({ title, detail, onRetry, onSignOut }: Props) {
  return (
    <main className="center">
      <section className={`card ${styles.login}`}>
        <h1>{title}</h1>
        {detail && <p className={`msg err ${styles.detail}`}>{detail}</p>}
        <div>
          {onRetry && (
            <button type="button" className="btn primary" onClick={onRetry}>
              다시 시도
            </button>
          )}{' '}
          <button type="button" className="btn" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      </section>
    </main>
  );
}
