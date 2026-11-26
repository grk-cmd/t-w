import { useCallback, useReducer } from 'react';
import { DEFAULT_STATE, randomState, reduce, type Action, type CreatorState } from './state';

const HISTORY_MAX = 40;

export interface Hist {
  cur: CreatorState;
  past: CreatorState[];
  /** 끄는 중(슬라이더 · 색 고르개)이면 끌기 전 상태 — 놓을 때 한 번만 기록에 쌓는다 */
  liveFrom: CreatorState | null;
}

export type HistAction =
  | { t: 'do'; a: Action }
  | { t: 'live'; a: Action }
  | { t: 'commit' }
  | { t: 'undo' }
  | { t: 'random'; rnd?: () => number }
  | { t: 'reset' };

export function histReduce(h: Hist, a: HistAction): Hist {
  // 끄는 중에 다른 일이 오면 끈 것을 먼저 쌓고 이어 간다
  const base = h.liveFrom ? settle(h) : h;
  const push = (next: CreatorState): Hist =>
    next === base.cur
      ? base
      : { cur: next, past: [...base.past, base.cur].slice(-HISTORY_MAX), liveFrom: null };
  switch (a.t) {
    case 'live': {
      const next = reduce(h.cur, a.a);
      return next === h.cur ? h : { ...h, cur: next, liveFrom: h.liveFrom ?? h.cur };
    }
    case 'commit':
      return base;
    case 'do':
      return push(reduce(base.cur, a.a));
    case 'random':
      return push(randomState(base.cur, a.rnd));
    case 'reset':
      return push(DEFAULT_STATE);
    case 'undo': {
      const prev = base.past[base.past.length - 1];
      return prev ? { cur: prev, past: base.past.slice(0, -1), liveFrom: null } : base;
    }
  }
}

/** 끈 것을 한 칸으로 쌓는다(끌기 전과 같으면 쌓지 않는다) */
function settle(h: Hist): Hist {
  if (!h.liveFrom || h.liveFrom === h.cur) return { ...h, liveFrom: null };
  return { cur: h.cur, past: [...h.past, h.liveFrom].slice(-HISTORY_MAX), liveFrom: null };
}

/** 생성기 상태 + 되돌리기(최근 40번) */
export function useMaker() {
  const [h, dispatch] = useReducer(histReduce, { cur: DEFAULT_STATE, past: [], liveFrom: null });
  return {
    state: h.cur,
    canUndo: h.past.length > 0 || h.liveFrom !== null,
    act: useCallback((a: Action) => dispatch({ t: 'do', a }), []),
    /** 끄는 동안 — 화면만 바꾸고 기록은 commit 때 한 번 */
    live: useCallback((a: Action) => dispatch({ t: 'live', a }), []),
    commit: useCallback(() => dispatch({ t: 'commit' }), []),
    undo: useCallback(() => dispatch({ t: 'undo' }), []),
    random: useCallback(() => dispatch({ t: 'random' }), []),
    reset: useCallback(() => dispatch({ t: 'reset' }), []),
  };
}
