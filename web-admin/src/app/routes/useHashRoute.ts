import { useEffect, useState } from 'react';

// 주소 뒤 #/<id> 로 화면을 고른다 — 새로고침해도 보던 화면이 남는다. 정적 호스팅이라 경로 라우팅 대신 해시를 쓴다.
const read = () => window.location.hash.replace(/^#\/?/, '');

export function useHashRoute(fallback: string): [string, (id: string) => void] {
  const [id, setId] = useState(() => read() || fallback);

  useEffect(() => {
    const onChange = () => setId(read() || fallback);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [fallback]);

  return [id, (next) => (window.location.hash = `/${next}`)];
}
