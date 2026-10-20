import { useEffect, useState } from 'react';
import { hashParts } from '@/shared/lib';

// 주소 뒤 #/<id> 로 화면을 고른다 — 새로고침해도 보던 화면이 남는다. 정적 호스팅이라 경로 라우팅 대신 해시를 쓴다.
// #/<id>/<하위> 의 하위는 그 화면이 읽는다(useHashSub).
const read = () => hashParts(window.location.hash).id;

export function useHashRoute(fallback: string): [string, (id: string) => void] {
  const [id, setId] = useState(() => read() || fallback);

  useEffect(() => {
    const onChange = () => setId(read() || fallback);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [fallback]);

  return [id, (next) => (window.location.hash = `/${next}`)];
}
