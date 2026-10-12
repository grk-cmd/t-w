import { useEffect, useState } from 'react';

/** value 가 delayMs 동안 바뀌지 않으면 따라간다 — 입력할 때마다 서버에 묻지 않게. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
