import type { Api, ApiParams, ApiSendOptions } from '@/shared/api';

/** 읽기만 쓰는 시험의 가짜 `Api` 에 채우는 `send` · `upload` — 불리면 시험이 빨개진다. */
export const unusedWrites: Pick<Api, 'send' | 'upload'> = {
  send: async () => {
    throw new Error('이 시험은 send 를 쓰지 않아요');
  },
  upload: async () => {
    throw new Error('이 시험은 upload 를 쓰지 않아요');
  },
};

export interface FakeCall {
  method: string;
  path: string;
  body?: unknown;
  query?: ApiParams;
}

/** 길(`GET /경로`)마다 답을 정해 두는 가짜 `Api` — 모르는 길을 부르면 시험이 빨개진다. 부른 것은 `calls` 에 쌓인다. */
export function fakeApiOf(handlers: Record<string, (call: FakeCall) => unknown>) {
  const calls: FakeCall[] = [];
  const answer = (call: FakeCall) => {
    calls.push(call);
    const h = handlers[`${call.method} ${call.path}`];
    if (!h) throw new Error(`모르는 길 ${call.method} ${call.path}`);
    return h(call);
  };
  const api: Api = {
    async get<T>(path: string, query?: ApiParams) {
      return answer({ method: 'GET', path, query }) as T;
    },
    async send<T>(method: string, path: string, options?: ApiSendOptions) {
      return answer({ method, path, body: options?.body, query: options?.query }) as T;
    },
    async upload() {
      throw new Error('upload 안 씀');
    },
  };
  return { api, calls };
}
