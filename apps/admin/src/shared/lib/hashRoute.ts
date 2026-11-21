import { useSyncExternalStore } from 'react';

/** 주소 해시를 경로 · 물음표 뒤(?q=…)로 나눈다. */
const splitHash = (hash: string): [string, string] => {
  const body = hash.replace(/^#\/?/, '');
  const at = body.indexOf('?');
  return at < 0 ? [body, ''] : [body.slice(0, at), body.slice(at + 1)];
};

/**
 * 주소 #/<화면>/<하위> 를 가른다 — 하위는 그 화면 안에서 열 대상(예: #/todos/<할 일 id>, #/bugs/<제보 id>).
 * 하위가 없으면 ''. 물음표 뒤(#/todos?q=…)는 빼고 본다 — hashParam 이 읽는다.
 */
export function hashParts(hash: string): { id: string; sub: string } {
  const [id = '', ...rest] = splitHash(hash)[0].split('/');
  return { id, sub: decodeURIComponent(rest.join('/')) };
}

/** 주소 #/<화면>?<이름>=<값> 의 값 — 없으면 ''. */
export function hashParam(hash: string, name: string): string {
  return new URLSearchParams(splitHash(hash)[1]).get(name) ?? '';
}

/** 값을 바꾼 해시 — 빈 값이면 그 이름을 뺀다. 경로 부분은 그대로. */
export function withHashParam(hash: string, name: string, value: string): string {
  const [path, query] = splitHash(hash);
  const params = new URLSearchParams(query);
  if (value) params.set(name, value);
  else params.delete(name);
  const q = params.toString();
  return `#/${path}${q ? `?${q}` : ''}`;
}

// replaceState 는 hashchange 를 내지 않는다 — 같은 화면 안에서 바꾼 것도 구독자에게 알리려고 따로 쏜다.
const PARAM_EVENT = 'tw-hashparam';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(PARAM_EVENT, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(PARAM_EVENT, onChange);
  };
};

/** 지금 주소의 하위 부분 — 주소가 바뀌면 다시 그린다. */
export function useHashSub(): string {
  return useSyncExternalStore(subscribe, () => hashParts(window.location.hash).sub);
}

/**
 * 주소 해시의 ?<이름>= 값 — 주소를 복사해 주면 같은 상태로 열린다.
 * 바꿀 때는 기록(뒤로 가기)을 쌓지 않고 지금 주소를 바꾼다(글자마다 기록이 생기지 않게).
 */
export function useHashParam(name: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => hashParam(window.location.hash, name));
  const set = (next: string) => {
    const hash = withHashParam(window.location.hash, name, next);
    if (hash === window.location.hash) return;
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new Event(PARAM_EVENT));
  };
  return [value, set];
}
