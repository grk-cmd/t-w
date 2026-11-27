import { useEffect, useRef, useState } from 'react';
import styles from './EmojiInput.module.css';

// 카탈로그에 쓰는 것 위주 — 목록에 없으면 «직접» 칸에 붙여 넣는다.
const EMOJIS = [
  '🎩',
  '🧢',
  '👒',
  '🎓',
  '⛑️',
  '👑',
  '🎀',
  '🎭',
  '👓',
  '🕶️',
  '🥽',
  '💇',
  '👕',
  '👔',
  '👚',
  '🧥',
  '🥼',
  '🦺',
  '👖',
  '🩳',
  '👗',
  '👘',
  '🩱',
  '🧣',
  '🧤',
  '🧦',
  '👟',
  '👢',
  '🪽',
  '🦋',
  '🐾',
  '🐕',
  '🐈',
  '🌸',
  '⭐',
  '✨',
  '💍',
  '🎒',
  '👜',
  '🤚',
  '✋',
  '🪑',
  '🌱',
  '☕',
  '📚',
  '🖥️',
  '🧸',
  '🏷️',
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** 버튼 · 직접 입력 칸의 이름 — 예: «cape 아이콘». */
  label: string;
  /** 비어 있을 때 흐리게 보일 값(기본 아이콘). */
  placeholder?: string;
  maxLength?: number;
}

export function EmojiInput({ value, onChange, label, placeholder = '', maxLength }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <span ref={root} className={styles.root}>
      <button
        type="button"
        className={styles.face}
        aria-label={`${label} 고르기`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {value || <span className={styles.ghost}>{placeholder || '＋'}</span>}
      </button>
      {open && (
        <div className={styles.pop} role="dialog" aria-label={`${label} 고르기`}>
          <div className={styles.grid}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={e === value ? styles.on : undefined}
                onClick={() => pick(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className={styles.foot}>
            <input
              type="text"
              aria-label={label}
              placeholder="직접"
              maxLength={maxLength}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <button type="button" className="btn" onClick={() => pick('')}>
              비우기
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
