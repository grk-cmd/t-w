import { useEffect, useSyncExternalStore } from 'react';
import { fetchSite } from '../api/site';
import type { Site } from './site';

/** 미리 그린 페이지 · 첫 그리기는 'loading' — 받기는 브라우저에서만 */
export type SiteState = { s: 'loading' } | { s: 'failed' } | { s: 'ready'; site: Site };

/** 소식 창 · 내려받기 단추가 같은 답을 쓴다 — 한 페이지에서 한 번만 받는다 */
let state: SiteState = { s: 'loading' };
let started = false;
const listeners = new Set<() => void>();

function set(next: SiteState) {
  state = next;
  for (const l of listeners) l();
}

function load() {
  started = true;
  set({ s: 'loading' });
  void fetchSite().then((r) => {
    if (r.t === 'ok') return set({ s: 'ready', site: r.site });
    // 설치본처럼 개발자 도구가 막힌 곳이 아니라 웹이라 콘솔에 까닭을 남긴다 — 화면엔 «불러오지 못했어요 · 다시 시도»
    console.warn('홈페이지 소식 · 내려받기를 못 불러옴:', r.why);
    set({ s: 'failed' });
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER_STATE: SiteState = { s: 'loading' };

export function useSite(): { state: SiteState; retry: () => void } {
  const now = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  useEffect(() => {
    if (!started) load();
  }, []);
  return { state: now, retry: load };
}
