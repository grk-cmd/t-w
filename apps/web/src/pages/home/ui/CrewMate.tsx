import { useEffect, useRef, useState } from 'react';
import { nextTap } from '../model/crew';

/** 말풍선이 떠 있는 시간 · 날아갔다 돌아오는 시간(CSS crew-fly 와 같은 길이) */
const SAY_MS = 2500;
const FLY_MS = 1800;

interface Props {
  name: string;
  role: string;
  lines: readonly string[];
  src: string;
  w: number;
  h: number;
}

/** 사람 그림 하나 — 한 번 누르면 말풍선(누를 때마다 다음 대사) · 연타하면 💣 와 함께 날아갔다 돌아온다 · 아래에 이름표 */
export function CrewMate({ name, role, lines, src, w, h }: Props) {
  const [say, setSay] = useState<number | null>(null);
  const [flying, setFlying] = useState(false);
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tap = () => {
    if (flying) return;
    const r = nextTap(taps.current, Date.now());
    taps.current = r.taps;
    clearTimeout(timer.current);
    if (r.fly) {
      setSay(null);
      setFlying(true);
      timer.current = setTimeout(() => setFlying(false), FLY_MS);
      return;
    }
    setSay((p) => (p === null ? 0 : (p + 1) % lines.length));
    timer.current = setTimeout(() => setSay(null), SAY_MS);
  };

  return (
    <figure className="crew-mate">
      <span className="crew-say" aria-live="polite">
        {say !== null && lines[say]}
      </span>
      <button
        type="button"
        className={flying ? 'crew-btn fly' : 'crew-btn'}
        onClick={tap}
        aria-label={`${role} ${name}`}
      >
        {flying && (
          <span className="crew-boom" aria-hidden="true">
            💣
          </span>
        )}
        <img className="crew" src={src} width={w} height={h} alt="" />
      </button>
      <figcaption className="crew-tag">
        <b>{role}</b> {name}
      </figcaption>
    </figure>
  );
}
