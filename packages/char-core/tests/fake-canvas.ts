/** 가짜 캔버스 — 얼굴 · 피부 합성(3단계)이 쓰는 몫을 흉내 낸다. 그리기 호출을 기록해 순서 · 인자를 본다. */
export interface DrawCall {
  op: string;
  args: unknown[];
}

export interface FakeCanvas {
  width: number;
  height: number;
  calls: DrawCall[];
  getContext(kind: '2d'): FakeContext2D;
}

export type FakeContext2D = Record<string, unknown>;

export function fakeCanvas(width = 256, height = 256): FakeCanvas {
  const calls: DrawCall[] = [];
  const ctx: FakeContext2D = new Proxy(
    {},
    {
      get: (_t, op: string) => (...args: unknown[]) => {
        calls.push({ op, args });
      },
      set: (_t, op: string, value: unknown) => {
        calls.push({ op: `set:${op}`, args: [value] });
        return true;
      },
    },
  );
  return { width, height, calls, getContext: () => ctx };
}
