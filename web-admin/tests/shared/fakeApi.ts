import type { Api } from '@/shared/api';

/** 읽기만 쓰는 시험의 가짜 `Api` 에 채우는 `send` — 불리면 시험이 빨개진다. */
export const unusedSend: Api['send'] = async () => {
  throw new Error('이 시험은 send 를 쓰지 않아요');
};
