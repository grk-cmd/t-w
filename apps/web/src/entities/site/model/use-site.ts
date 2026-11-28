import { useEffect, useSyncExternalStore } from 'react';
import { fetchSite, type SiteResult } from '../api/site';
import type { Site } from './site';

/** 미리 그린 페이지 · 첫 그리기는 'loading' — 받기는 브라우저에서만 */
export type SiteState = { s: 'loading' } | { s: 'failed' } | { s: 'ready'; site: Site };

export interface SiteStore {
  get(): SiteState;
  subscribe(l: () => void): () => void;
  /** 아직 안 받았으면 받는다 — 몇 곳이 불러도 한 번 */
  ensure(): void;
  /** 사람이 [다시 시도] 를 눌렀을 때만 — 곧바로 'loading' 으로 */
  retry(): void;
}

/** 소식 창 · 내려받기 단추가 같은 답을 쓰는 한 벌 — 못 받으면 'failed'(글 없음 · 닫힘으로 바꾸지 않는다) */
export function createSiteStore(fetcher: () => Promise<SiteResult> = () => fetchSite()): SiteStore {
  let state: SiteState = { s: 'loading' };
  let started = false;
  const listeners = new Set<() => void>();
  const set = (next: SiteState) => {
    state = next;
    for (const l of listeners) l();
  };
  const load = () => {
    started = true;
    set({ s: 'loading' });
    void fetcher().then((r) => {
      if (r.t === 'ok') return set({ s: 'ready', site: r.site });
      // 웹이라 개발자 도구로 볼 수 있다 — 화면엔 «불러오지 못했어요 · 다시 시도»
      console.warn('홈페이지 소식 · 내려받기를 못 불러옴:', r.why);
      set({ s: 'failed' });
    });
  };
  return {
    get: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    ensure: () => {
      if (!started) load();
    },
    retry: load,
  };
}

/** 한 페이지에 한 벌 */
const store = createSiteStore();
const SERVER_STATE: SiteState = { s: 'loading' };

export function useSite(): { state: SiteState; retry: () => void } {
  const now = useSyncExternalStore(store.subscribe, store.get, () => SERVER_STATE);
  useEffect(() => store.ensure(), []);
  return { state: now, retry: store.retry };
}
