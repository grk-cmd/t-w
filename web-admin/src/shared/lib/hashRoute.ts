import { useSyncExternalStore } from 'react';

/**
 * 주소 #/<화면>/<하위> 를 가른다 — 하위는 그 화면 안에서 열 대상(예: #/todos/<할 일 id>, #/bugs/<제보 id>).
 * 하위가 없으면 ''.
 */
export function hashParts(hash: string): { id: string; sub: string } {
  const [id = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  return { id, sub: decodeURIComponent(rest.join('/')) };
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** 지금 주소의 하위 부분 — 주소가 바뀌면 다시 그린다. */
export function useHashSub(): string {
  return useSyncExternalStore(subscribe, () => hashParts(window.location.hash).sub);
}
