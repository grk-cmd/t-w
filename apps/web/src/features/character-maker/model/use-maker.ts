import { useCallback, useReducer } from 'react';
import { DEFAULT_STATE, randomState, reduce, type Action, type CreatorState } from './state';

const HISTORY_MAX = 40;

interface Hist {
  cur: CreatorState;
  past: CreatorState[];
}

type HistAction =
  { t: 'do'; a: Action } | { t: 'undo' } | { t: 'random'; rnd?: () => number } | { t: 'reset' };

export function histReduce(h: Hist, a: HistAction): Hist {
  const push = (next: CreatorState): Hist =>
    next === h.cur ? h : { cur: next, past: [...h.past, h.cur].slice(-HISTORY_MAX) };
  switch (a.t) {
    case 'do':
      return push(reduce(h.cur, a.a));
    case 'random':
      return push(randomState(h.cur, a.rnd));
    case 'reset':
      return push(DEFAULT_STATE);
    case 'undo': {
      const prev = h.past[h.past.length - 1];
      return prev ? { cur: prev, past: h.past.slice(0, -1) } : h;
    }
  }
}

/** 생성기 상태 + 되돌리기(최근 40번) */
export function useMaker() {
  const [h, dispatch] = useReducer(histReduce, { cur: DEFAULT_STATE, past: [] });
  return {
    state: h.cur,
    canUndo: h.past.length > 0,
    act: useCallback((a: Action) => dispatch({ t: 'do', a }), []),
    undo: useCallback(() => dispatch({ t: 'undo' }), []),
    random: useCallback(() => dispatch({ t: 'random' }), []),
    reset: useCallback(() => dispatch({ t: 'reset' }), []),
  };
}
