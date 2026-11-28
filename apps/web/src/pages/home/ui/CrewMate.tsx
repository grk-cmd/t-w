import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '@/shared/i18n';
import {
  BOOM_MS,
  BOP_MS,
  DIZZY_MS,
  LAUNCH_MS,
  REDUCED_LAND_MS,
  TAP_WINDOW_MS,
  bopFrames,
  bubbleShift,
  launchFrames,
  nextTap,
} from '../model/crew';

/** 말풍선이 떠 있는 시간 */
const SAY_MS = 2500;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** 사람 그림 하나 — 한 번 누르면 통통 · 말풍선(누를 때마다 다음 대사) · 셋째부터 머리 위 💣 치익 · 연타(5번)면 💥 펑 날아갔다 떨어져 💫 어질어질 ·
    아래에 이름표. 💣 동작은 시안 docs/prototypes/main-site(main.js 운영진 날리기) 그대로 */
export function CrewMate({ name, role, lines, src, w, h, headX }: Props) {
  const { m } = useI18n();
  /** 말풍선 글(대사 · «으아아~!» · «어질어질…») — 없으면 말풍선 없음 */
  const [say, setSay] = useState<string | null>(null);
  /** 날아가는 중 · 떨어져 어지러운 중엔 누름을 받지 않는다 */
  const [flying, setFlying] = useState(false);
  const [fuse, setFuse] = useState(false);
  const [boom, setBoom] = useState(false);
  const [dizzy, setDizzy] = useState(false);
  const taps = useRef<number[]>([]);
  // 다음에 보일 대사 — 말풍선이 사라져도 이어진다(천천히 눌러도 다음 대사)
  const nextLine = useRef(0);
  const bubble = useRef<HTMLSpanElement>(null);
  const live = useRef<HTMLSpanElement>(null);
  const fx = useRef<HTMLSpanElement>(null);
  // ⚠️ 홈페이지 CSP 는 style-src 'self' — 마크업의 style="" 속성은 막힌다(미리 그린 HTML · 하이드레이션 모두).
  //    머리 위 자리는 스크립트(CSSOM)로 넣는다 — 말풍선보다 먼저(아래 효과가 이 자리를 잰다)
  useLayoutEffect(() => {
    for (const el of [live.current, fx.current]) if (el) el.style.left = `${headX * 100}%`;
  }, [headX]);
  // 도트 테두리(border-image 아홉 조각)는 반 픽셀에 앉으면 조각이 안 맞아 흐려진다 — 앱(_bubSnapTransform)처럼 정수 px 로 맞춘다
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    el.style.width = '';
    el.style.transform = '';
    el.style.left = '';
    el.style.bottom = '';
    const w = Math.ceil(el.getBoundingClientRect().width);
    el.style.width = `${w}px`;
    el.style.transform = `translateX(${-Math.round(w / 2)}px)`;
    const r = el.getBoundingClientRect();
    // 머리 위가 화면 끝에 가까우면(폰) 몸통만 안으로 밀고 꼬리는 머리를 가리킨 채 둔다 — 꼬리는 몸통 안쪽까지만
    const { push, tail } = bubbleShift(
      Math.round(r.left),
      Math.round(r.right),
      w,
      document.documentElement.clientWidth,
    );
    // 꼬리(15px)를 가운데에 두면 7.5px 반 픽셀에 앉아 이음매가 흐려진다 — 안쪽(테두리 9px 안) 정수 px 로
    el.style.setProperty('--tail-x', `${Math.floor((w - 18 - 15) / 2) + tail}px`);
    // transform 으로 옮기면 그리는 층이 소수 px 에 남아 꼬리 그림 가장자리가 섞인다 — 자리(left · bottom)로 옮겨 정수 px 에 그리게
    el.style.transform = 'none';
    el.style.left = `${-Math.round(w / 2) + push + Math.round(r.left) - r.left}px`;
    el.style.bottom = `${r.top - Math.round(r.top)}px`;
  }, [say]);
  const body = useRef<HTMLSpanElement>(null);
  /** 돌던 통통을 멈춘다 — 다시 누를 때(처음부터) · 날아갈 때(날기와 겹치지 않게) */
  const stopBop = () => {
    for (const a of body.current?.getAnimations() ?? []) a.cancel();
  };
  /** 눌렀을 때 통통 — 누를 때마다 처음부터 · 애니메이션 줄이기 설정이면 안 튄다 */
  const bop = () => {
    const el = body.current;
    stopBop();
    if (!el || reduced()) return;
    el.animate(bopFrames(), { duration: BOP_MS, easing: 'linear' });
  };
  /** 말풍선 · 💣 예고 · 💥 · 땅에 떨어진 뒤 — 이름마다 하나씩, 새로 걸면 앞 것을 지운다 · 사라질 때 모두 지운다 */
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const later = (key: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(fn, ms));
  };
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  /** 떨어진 뒤 — 💫 어질어질 · 끝나면 다시 누를 수 있다 */
  const land = () => {
    setSay(m.crewDizzy);
    setDizzy(true);
    later('say', DIZZY_MS, () => {
      setDizzy(false);
      setSay(null);
      setFlying(false);
    });
  };
  /** 💣 펑 — 💥 · «으아아~!» · 좌우 무작위로 날아갔다 떨어진다(줄이기 설정이면 날지 않고 곧 어질어질) */
  const launch = () => {
    stopBop();
    setFlying(true);
    setFuse(false);
    setBoom(true);
    later('boom', BOOM_MS, () => setBoom(false));
    setSay(m.crewYell);
    clearTimeout(timers.current.get('say'));
    const el = body.current;
    if (!el || reduced()) return later('land', REDUCED_LAND_MS, land);
    const side = Math.random() < 0.5 ? -1 : 1;
    el.animate(launchFrames(side), { duration: LAUNCH_MS }).onfinish = land;
  };

  const tap = () => {
    if (flying) return;
    const r = nextTap(taps.current, Date.now());
    taps.current = r.taps;
    if (r.fly) return launch();
    bop();
    if (r.fuse) {
      setFuse(true);
      later('fuse', TAP_WINDOW_MS, () => setFuse(false));
    }
    setSay(lines[nextLine.current] ?? null);
    nextLine.current = (nextLine.current + 1) % lines.length;
    later('say', SAY_MS, () => setSay(null));
  };

  return (
    <figure className="crew-mate">
      {/* 알리는 칸은 늘 있어야 화면 낭독기가 새 대사를 읽는다 — 말풍선 모양은 안쪽에만 */}
      <span ref={live} className="crew-live" aria-live="polite">
        {say !== null && (
          <span ref={bubble} className="crew-say">
            {say}
          </span>
        )}
      </span>
      <button type="button" className="crew-btn" onClick={tap} aria-label={`${role} ${name}`}>
        {/* 통통 · 날기는 이 칸(Web Animations) · 숨쉬기는 그림(CSS) — 다른 요소라 겹쳐도 덮어쓰지 않는다 */}
        <span ref={body} className="crew-body">
          <img className="crew" src={src} width={w} height={h} alt="" />
        </span>
      </button>
      <span ref={fx} className="crew-fx" aria-hidden="true">
        {fuse && <span className="bomb">💣</span>}
        {boom && <span className="boom">💥</span>}
        {dizzy && <span className="dz">💫</span>}
      </span>
      <figcaption className="crew-tag">
        <span className="crew-role">{role}</span> <span className="crew-name">{name}</span>
      </figcaption>
    </figure>
  );
}
