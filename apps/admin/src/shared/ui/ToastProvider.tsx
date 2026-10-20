import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ToastContext } from './useToast';
import styles from './ToastProvider.module.css';

const TOAST_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number>(undefined);

  const show = useCallback((next: string) => {
    setText(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(null), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {text && (
        <div className={styles.toast} role="status">
          {text}
        </div>
      )}
    </ToastContext.Provider>
  );
}
