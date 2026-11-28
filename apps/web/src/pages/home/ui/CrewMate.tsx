import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { nextTap } from '../model/crew';

/** 말풍선이 떠 있는 시간 · 날아갔다 돌아오는 시간(CSS 애니메이션 길이도 이 값 — --fly-ms) */
const SAY_MS = 2500;
const FLY_MS = 1800;
/** 말풍선이 화면 끝에서 띄울 거리 · 꼬리가 몸통 끝에서 떨어질 거리(테두리 9px + 꼬리 반 폭) */
const EDGE = 8;
const TAIL_IN = 17;

interface Props {
  name: string;
  role: string;
  lines: readonly string[];
  src: string;
  w: number;
  h: number;
  /** 머리 가운데 자리(그림 폭의 0~1) — 말풍선이 여기 위에 뜬다 */
  headX: number;
}

/** 사람 그림 하나 — 한 번 누르면 말풍선(누를 때마다 다음 대사) · 연타하면 💣 와 함께 날아갔다 돌아온다 · 아래에 이름표 */
export function CrewMate({ name, role, lines, src, w, h, headX }: Props) {
  const [say, setSay] = useState<number | null>(null);
  const [flying, setFlying] = useState(false);
  const taps = useRef<number[]>([]);
  // 다음에 보일 대사 — 말풍선이 사라져도 이어진다(천천히 눌러도 다음 대사)
  const nextLine = useRef(0);
  const bubble = useRef<HTMLSpanElement>(null);
  // 도트 테두리(border-image 아홉 조각)는 반 픽셀에 앉으면 조각이 안 맞아 흐려진다 — 앱(_bubSnapTransform)처럼 정수 px 로 맞춘다
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    el.style.width = '';
    el.style.transform = '';
    const w = Math.ceil(el.getBoundingClientRect().width);
    el.style.width = `${w}px`;
    el.style.transform = `translateX(${-Math.round(w / 2)}px)`;
    const r = el.getBoundingClientRect();
    // 머리 위가 화면 끝에 가까우면(폰) 몸통만 안으로 밀고 꼬리는 머리를 가리킨 채 둔다 — 꼬리는 몸통 안쪽까지만
    const vw = document.documentElement.clientWidth;
    const push = Math.min(0, vw - EDGE - Math.round(r.right)) || Math.max(0, EDGE - Math.round(r.left));
    const tail = Math.max(-(w / 2 - TAIL_IN), Math.min(w / 2 - TAIL_IN, -push));
    el.style.setProperty('--tail-dx', `${Math.round(tail)}px`);
    el.style.transform = `translate(${-Math.round(w / 2) + push + Math.round(r.left) - r.left}px, ${Math.round(r.top) - r.top}px)`;
  }, [say]);
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
    setSay(nextLine.current);
    nextLine.current = (nextLine.current + 1) % lines.length;
    timer.current = setTimeout(() => setSay(null), SAY_MS);
  };

  return (
    <figure className="crew-mate">
      {/* 알리는 칸은 늘 있어야 화면 낭독기가 새 대사를 읽는다 — 말풍선 모양은 안쪽에만 */}
      <span className="crew-live" aria-live="polite" style={{ left: `${headX * 100}%` }}>
        {say !== null && (
          <span ref={bubble} className="crew-say">
            {lines[say]}
          </span>
        )}
      </span>
      <button
        type="button"
        className={flying ? 'crew-btn fly' : 'crew-btn'}
        style={{ '--fly-ms': `${FLY_MS}ms` } as CSSProperties}
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
        <span className="crew-role">{role}</span> <span className="crew-name">{name}</span>
      </figcaption>
    </figure>
  );
}
