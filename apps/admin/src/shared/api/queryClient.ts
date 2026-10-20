import { QueryClient } from '@tanstack/react-query';

// 요금이 «내려받은 바이트» 라서 자동 재요청을 끈다 — 다시 받는 것은 새로고침 버튼과 쓰기 직후뿐이다.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});
