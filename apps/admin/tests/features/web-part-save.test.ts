import { describe, expect, it } from 'vitest';
import { parseAdminParts, type WebPart, type WebPartDraft } from '@/entities/web-creator/part';
import { savePart } from '@/features/web-creator/manage-parts';
import type { Api, ApiWriteMethod } from '@/shared/api';

const draft: WebPartDraft = { slot: 'mouth', name: { ko: '입', en: 'Mouth', ja: 'くち' }, w: 20, h: 10 };
const IMG = new Uint8Array([1]);
const SHUT = new Uint8Array([2]);
const FILE = (h: string) => `https://api.together-working.com/v1/assets/${h}.png`;

/** 파일 올리기는 차례로 h2up1 · h2up2 … 를 돌려준다 · failUpload 면 올리기에서 던진다 */
function fakeApi(failUpload = false) {
  const calls: { method: string; body?: unknown }[] = [];
  let n = 0;
  const api: Api = {
    get: async <T>() => null as T,
    send: async <T>(method: ApiWriteMethod, _path: string, body?: unknown) => {
      calls.push({ method, body });
      return null as T;
    },
    upload: async <T>(_path: string, bytes: Uint8Array) => {
      calls.push({ method: 'UPLOAD', body: bytes[0] });
      if (failUpload) throw new Error('올리기 실패');
      return { hash: `h2up${++n}` } as T;
    },
  };
  return { api, calls };
}

const existing = (): WebPart => {
  const p = parseAdminParts({
    products: [
      {
        id: 'i1',
        target: { kind: 'baseModel' },
        name: draft.name,
        status: 'active',
        pieces: [
          {
            id: 'pc1',
            kind: 'decal',
            target: { kind: 'baseModel' },
            surface: 'face',
            slot: 'mouth',
            src: FILE('h2a'),
            variants: { closed: FILE('h2c') },
            w: 20,
            h: 10,
          },
        ],
      },
    ],
  })[0];
  if (!p) throw new Error('시험용 상품을 읽지 못했다');
  return p;
};
const pieceOf = (c: { body?: unknown } | undefined) =>
  (c?.body as { pieces: Record<string, unknown>[] }).pieces[0];

describe('웹 생성기 파츠 저장 — 파일 → 감은 그림 → 상품 차례', () => {
  it('새 파츠: 그림 · 감은 그림을 차례로 올리고 받은 해시로 만든다', async () => {
    const { api, calls } = fakeApi();
    await savePart(api, { part: null, draft, image: IMG, closedImage: SHUT });
    expect(calls.map((c) => `${c.method}:${String(c.body instanceof Object ? '' : c.body)}`)).toEqual([
      'UPLOAD:1',
      'UPLOAD:2',
      'POST:',
    ]);
    expect(calls[2]?.body).toMatchObject({ thumb: 'h2up1' });
    expect(pieceOf(calls[2])).toMatchObject({ image: 'h2up1', variants: { closed: 'h2up2' } });
  });

  it('새 파츠인데 그림이 없으면 아무것도 보내지 않는다', async () => {
    const { api, calls } = fakeApi();
    await expect(savePart(api, { part: null, draft, closedImage: SHUT })).rejects.toThrow('그림');
    expect(calls).toEqual([]);
  });

  it('고치기: 그림을 안 바꾸면 올리지 않는다 · 감은 그림 그대로(없음) / 뺌(null) / 바꿈(바이트)', async () => {
    const keep = fakeApi();
    await savePart(keep.api, { part: existing(), draft });
    expect(keep.calls.map((c) => c.method)).toEqual(['PATCH']);
    expect(pieceOf(keep.calls[0])).toMatchObject({ image: 'h2a', variants: { closed: 'h2c' } });

    const drop = fakeApi();
    await savePart(drop.api, { part: existing(), draft, closedImage: null });
    expect(drop.calls.map((c) => c.method)).toEqual(['PATCH']);
    expect(pieceOf(drop.calls[0])).not.toHaveProperty('variants');

    const change = fakeApi();
    await savePart(change.api, { part: existing(), draft, closedImage: SHUT });
    expect(change.calls.map((c) => c.method)).toEqual(['UPLOAD', 'PATCH']);
    expect(pieceOf(change.calls[1])).toMatchObject({ image: 'h2a', variants: { closed: 'h2up1' } });
    expect(change.calls[1]?.body).not.toHaveProperty('thumb'); // 본 그림은 그대로
  });

  it('올리다 실패하면 상품은 쓰지 않는다', async () => {
    const { api, calls } = fakeApi(true);
    await expect(savePart(api, { part: existing(), draft, image: IMG })).rejects.toThrow('올리기 실패');
    expect(calls.map((c) => c.method)).toEqual(['UPLOAD']);
  });
});
