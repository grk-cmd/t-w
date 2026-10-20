import { cleanVersionPart, type VersionParts } from '@/shared/lib';
import styles from './VersionInput.module.css';

const PART_LABELS = ['주', '부', '수'] as const;
const PART_MAX = 9999;

interface Props {
  value: VersionParts;
  onChange: (parts: VersionParts) => void;
  disabled?: boolean;
  /** 칸 이름 앞말 — «릴리스» 면 «릴리스 주 버전». */
  label?: string;
  /** 빈 칸일 때 흐리게 보일 값(예: 제안 버전). */
  placeholder?: VersionParts;
}

/** 버전 숫자 세 칸(주 . 부 . 수) — 화살표 · 휠 · 키보드 ↑↓ 로 하나씩. 칸마다 숫자 네 자리까지. */
export function VersionInput({ value, onChange, disabled, label, placeholder }: Props) {
  const setPart = (i: number, raw: string) => {
    const next: VersionParts = [...value];
    next[i] = cleanVersionPart(raw);
    onChange(next);
  };
  return (
    <span className={styles.parts}>
      {value.map((p, i) => (
        <span key={PART_LABELS[i]} className={styles.part}>
          {i > 0 && <b className="soft">.</b>}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={PART_MAX}
            step={1}
            aria-label={`${label ? `${label} ` : ''}${PART_LABELS[i]} 버전`}
            disabled={disabled}
            placeholder={placeholder?.[i]}
            value={p}
            onChange={(e) => setPart(i, e.target.value)}
          />
        </span>
      ))}
    </span>
  );
}
