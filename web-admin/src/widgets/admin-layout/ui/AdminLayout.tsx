import type { ReactNode } from 'react';
import type { Env } from '@/shared/api';
import styles from './AdminLayout.module.css';

export interface NavItem {
  id: string;
  label: string;
}

interface Props {
  env: Env;
  account?: { label: string; onSignOut: () => void };
  nav?: { items: NavItem[]; current: string; onSelect: (id: string) => void };
  title?: string;
  children: ReactNode;
}

// 머리줄(어느 DB 인지 · 누구로 로그인했는지) + 좌측 메뉴 + 본문. 메뉴가 없으면(로그인 전) 본문만 가운데에 둔다.
export function AdminLayout({ env, account, nav, title, children }: Props) {
  return (
    <>
      <header className={styles.header}>
        <b>Together Working 관리자</b>
        <span className={env.isProd ? `${styles.env} ${styles.prod}` : styles.env}>
          {env.isProd ? '운영' : `dev · ${env.projectId}`}
        </span>
        {account && (
          <span className={styles.account}>
            <span>{account.label}</span>
            <button type="button" className="btn" onClick={account.onSignOut}>
              로그아웃
            </button>
          </span>
        )}
      </header>
      {nav ? (
        <div className={styles.layout}>
          <nav className={styles.side}>
            {nav.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === nav.current ? styles.on : undefined}
                onClick={() => nav.onSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <main className={styles.content}>
            {title && <h1>{title}</h1>}
            {children}
          </main>
        </div>
      ) : (
        children
      )}
    </>
  );
}
