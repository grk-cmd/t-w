import { describe, expect, it } from 'vitest';
import {
  createWebPart,
  draftProblem,
  emptyDraft,
  imageProblem,
  isPng,
  listWebParts,
  movedIds,
  NoApiError,
  parseAdminParts,
  PART_IMAGE_MAX_BYTES,
  pngSize,
  reorderWebParts,
  setWebPartStatus,
  toBase64,
  updateWebPart,
  uploadPartFile,
  webPartErrorMessage,
  type WebPart,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import { ApiError, type Api, type ApiWriteMethod } from '@/shared/api';

/** PNG 머리(IHDR)까지 있는 바이트 — 가로 · 세로를 정한다 */
function png(width = 32, height = 32, extra = 0): Uint8Array {
  const b = new Uint8Array(24 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}
const PNG = png();
const draft = (o: Partial<WebPartDraft> = {}): WebPartDraft => ({
  ...emptyDraft('pupil'),
  name: { ko: '별눈', en: 'Star', ja: 'ほし' },
  ...o,
});
const FILE = (h: string) => `https://api.together-working.com/v1/assets/${h}.png`;

function fakeApi(data: unknown = null) {
  const calls: { method: string; path: string; body?: unknown; params?: unknown; type?: string }[] = [];
  const api: Api = {
    get: async <T>(path: string, params?: unknown) => {
      calls.push({ method: 'GET', path, params });
      return data as T;
    },
    send: async <T>(method: ApiWriteMethod, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return data as T;
    },
    upload: async <T>(path: string, body: Uint8Array, type: string) => {
      calls.push({ method: 'UPLOAD', path, body, type });
      return data as T;
    },
  };
  return { api, calls };
}

const piece = (o: Record<string, unknown> = {}) => ({
  id: 'pc1',
  kind: 'decal',
  target: { kind: 'baseModel' },
  surface: 'face',
  slot: 'pupil',
  src: FILE('h2a'),
  w: 10,
  h: 12,
  ...o,
});
const productRow = (o: Record<string, unknown> = {}) => ({
  id: 'i1',
  target: { kind: 'baseModel' },
  name: { ko: '가', en: 'a', ja: 'あ' },
  thumb: FILE('h2t'),
  status: 'active',
  access: { kind: 'everyone', display: 'show' },
  position: 10,
  pieces: [piece()],
  ...o,
});
const partOf = (o: Record<string, unknown> = {}): WebPart => {
  const p = parseAdminParts({ products: [productRow(o)] })[0];
  if (!p) throw new Error('시험용 상품을 읽지 못했다');
  return p;
};
const pieceBody = (c: { body?: unknown }) => (c.body as { pieces: Record<string, unknown>[] }).pieces[0];

describe('웹 생성기 파츠 — 폼 값 검사', () => {
  it('이름 셋 · 크기 범위', () => {
    expect(draftProblem(draft())).toBeNull();
    expect(draftProblem(draft({ name: { ko: '별', en: ' ', ja: 'ほし' } }))).toContain('en');
    expect(draftProblem(draft({ name: { ko: '가'.repeat(21), en: 'a', ja: 'a' } }))).toContain('20자');
    for (const w of [0, -1, 201, Number.NaN]) expect(draftProblem(draft({ w })), String(w)).toContain('크기');
    expect(draftProblem(draft({ w: 200, h: 0.5 }))).toBeNull();
  });

  it('그림은 내용이 PNG 인지 보고 512KB · 1024px 까지', () => {
    expect(isPng(PNG)).toBe(true);
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false); // JPEG
    expect(imageProblem(new Uint8Array([1, 2, 3]))).toContain('PNG');
    expect(imageProblem(png(32, 32, PART_IMAGE_MAX_BYTES - 24))).toBeNull(); // 딱 512KB
    expect(imageProblem(png(32, 32, PART_IMAGE_MAX_BYTES - 23))).toContain('512KB');
    expect(pngSize(png(1024, 7))).toEqual({ width: 1024, height: 7 });
    expect(imageProblem(png(1024, 1024))).toBeNull();
    expect(imageProblem(png(1025, 10))).toContain('1024px');
    expect(imageProblem(png(10, 1025))).toContain('1024px');
    expect(imageProblem(PNG.subarray(0, 20))).toContain('머리'); // 표시만 있고 머리가 잘림
  });

  it('base64 — 큰 그림도 한 번에(쪼개어 바꿈)', () => {
    expect(toBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    const big = new Uint8Array(100_000).fill(65);
    expect(atob(toBase64(big)).length).toBe(100_000);
  });
});

describe('웹 생성기 파츠 — 목록 읽기(상품)', () => {
  it('상태 · 그림(얼굴) 조각 하나짜리만 고칠 수 있다 · 모양이 틀린 줄은 뺀다', () => {
    const got = parseAdminParts({
      products: [
        productRow({ id: 'b', status: 'draft', position: 10 }),
        productRow({ id: 'a', position: 20 }),
        productRow({ id: 'multi', position: 30, pieces: [piece(), piece({ id: 'pc2', slot: 'mouth' })] }),
        productRow({ id: 'ear', position: 40, pieces: [piece({ surface: 'earL', slot: 'ear' })] }),
        productRow({ id: 'p3d', position: 50, pieces: [{ id: 'pp', kind: 'part', partId: 'part_catear' }] }),
        productRow({ id: 'other', target: { kind: 'part', id: 'hat' } }),
        productRow({ id: 'bad', status: 'hidden' }),
        productRow({ id: '' }),
      ],
    });
    expect(got.map((p) => `${p.id}:${p.status}`)).toEqual([
      'b:draft',
      'a:active',
      'multi:active',
      'ear:active',
      'p3d:active',
    ]);
    expect(got[1]?.piece).toMatchObject({ id: 'pc1', slot: 'pupil', w: 10, h: 12, image: 'h2a' });
    expect(got[2]).toMatchObject({ piece: null, pieceCount: 2, thumb: FILE('h2t') });
    expect(got[3]?.piece).toBeNull(); // 다른 면은 이 화면에서 고치지 않는다
    expect(got[4]?.piece).toBeNull(); // 3D 도
    expect(parseAdminParts(null)).toEqual([]);
    expect(parseAdminParts({ sets: [productRow()] })).toEqual([]); // 옛 모양
    expect(parseAdminParts({ items: [productRow()] })).toEqual([]); // 지난 판 이름
  });

  it('파일 해시 — 응답 값 · 없으면 파일 주소의 이름 · 모르면 null · 감은 그림은 주소든 해시든', () => {
    expect(partOf({ pieces: [piece({ image: 'given' })] }).piece?.image).toBe('given');
    expect(partOf().piece?.image).toBe('h2a');
    expect(partOf({ pieces: [piece({ src: 'https://x.example/a.png' })] }).piece?.image).toBeNull();
    const byUrl = partOf({ pieces: [piece({ variants: { closed: FILE('h2c') } })] }).piece;
    expect([byUrl?.closedSrc, byUrl?.closedImage]).toEqual([FILE('h2c'), 'h2c']);
    const byHash = partOf({ pieces: [piece({ variants: { closed: 'h2c' } })] }).piece;
    expect([byHash?.closedSrc, byHash?.closedImage]).toEqual([null, 'h2c']);
    expect(partOf().piece?.closedImage).toBeNull();
  });

  it('썸네일은 주소일 때만 · 해시로 오면 조각 그림', () => {
    expect(partOf({ thumb: 'h2t' }).thumb).toBe(FILE('h2a'));
    expect(partOf().thumb).toBe(FILE('h2t'));
  });

  it('진열 순서 — position 작은 값이 앞 · 같으면 id · 없거나 틀리면 맨 뒤(서버 배열 순서는 믿지 않는다)', () => {
    const got = parseAdminParts({
      products: [
        productRow({ id: 'c', position: 30 }),
        productRow({ id: 'none', position: undefined }),
        productRow({ id: 'b', position: 10 }),
        productRow({ id: 'bad', position: 'x' }),
        productRow({ id: 'a', position: 10 }),
        productRow({ id: 'd', position: 20 }),
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['a', 'b', 'd', 'c', 'bad', 'none']);
  });

  it('한 칸 옮기기 — 끝을 넘으면 null', () => {
    const list = parseAdminParts({ products: ['a', 'b', 'c'].map((id) => productRow({ id })) });
    expect(movedIds(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movedIds(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(movedIds(list, 0, 1)).toEqual(['b', 'a', 'c']); // 첫 줄도 아래로
    expect(movedIds(list, 0, -1)).toBeNull();
    expect(movedIds(list, 2, 1)).toBeNull();
    expect(movedIds(list, 5, -1)).toBeNull();
  });
});

describe('웹 생성기 파츠 — API(#517 경로 · 본문)', () => {
  it('목록은 모델로 자르고(단종은 따로) · 파일은 바이트 그대로 올려 해시를 받는다', async () => {
    const { api, calls } = fakeApi({ hash: 'h2new' });
    await listWebParts(api);
    await listWebParts(api, true);
    await expect(uploadPartFile(api, PNG)).resolves.toBe('h2new');
    expect(calls[0]).toMatchObject({
      path: '/v1/admin/products',
      params: { target: 'baseModel', status: undefined },
    });
    expect(calls[1]).toMatchObject({
      path: '/v1/admin/products',
      params: { target: 'baseModel', status: 'archived' },
    });
    expect(calls[2]).toMatchObject({
      method: 'UPLOAD',
      path: '/v1/admin/assets',
      body: PNG,
      type: 'image/png',
    });
    await expect(uploadPartFile(fakeApi({}).api, PNG)).rejects.toThrow('모양');
  });

  it('새 파츠 = 조각 하나짜리 상품 — target · 이름 · 썸네일(그 그림) · 그림(얼굴) 조각(해시) · 상태 · 순서는 안 보냄', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft(), 'h2i');
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/v1/admin/products',
      body: {
        target: { kind: 'baseModel' },
        name: draft().name,
        thumb: 'h2i',
        pieces: [
          {
            kind: 'decal',
            target: { kind: 'baseModel' },
            surface: 'face',
            slot: 'pupil',
            image: 'h2i',
            w: 24,
            h: 24,
          },
        ],
      },
    });
  });

  it('눈 감은 얼굴 그림은 모든 자리 — variants.closed', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft({ slot: 'mouth' }), 'I', 'C');
    await createWebPart(api, draft({ slot: 'eyeline' }), 'I');
    expect(pieceBody(calls[0] as object)).toMatchObject({ slot: 'mouth', variants: { closed: 'C' } });
    expect(pieceBody(calls[1] as object)).not.toHaveProperty('variants');
  });

  it('고치기 — 본문은 규격 칸만: 조각 id 유지 · 안 바꾼 그림은 지금 해시 · 새 그림이면 썸네일도 · 감은 그림 그대로 / 바꿈 / 뺌', async () => {
    const { api, calls } = fakeApi();
    const eye = partOf({
      id: 'a/b',
      pieces: [piece({ slot: 'eyeline', variants: { closed: FILE('h2c') } })],
    });
    await updateWebPart(api, eye, draft({ slot: 'brows' }));
    await updateWebPart(api, eye, draft(), { image: 'h2n', closed: 'h2m' });
    await updateWebPart(api, eye, draft(), { closed: null });
    const body = (slot: string, image: string, closed?: string) => ({
      id: 'pc1',
      kind: 'decal',
      target: { kind: 'baseModel' },
      surface: 'face',
      slot,
      image,
      ...(closed ? { variants: { closed } } : {}),
      w: 24,
      h: 24,
    });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      Array(3).fill('PATCH /v1/admin/products/a%2Fb'),
    ); // id 는 경로 한 칸으로만
    expect(calls[0]?.body).toEqual({ name: draft().name, pieces: [body('brows', 'h2a', 'h2c')] });
    expect(calls[1]?.body).toEqual({
      name: draft().name,
      thumb: 'h2n',
      pieces: [body('pupil', 'h2n', 'h2m')],
    });
    expect(calls[2]?.body).toEqual({ name: draft().name, pieces: [body('pupil', 'h2a')] });
  });

  it('고칠 수 없는 경우는 보내지 않는다 — 여러 조각 · 그림 해시를 모름 · 감은 그림 해시를 모름', () => {
    const { api, calls } = fakeApi();
    const multi = partOf({ pieces: [piece(), piece({ id: 'pc2', slot: 'mouth' })] });
    expect(() => updateWebPart(api, multi, draft())).toThrow('여러');
    const unknownImage = partOf({ pieces: [piece({ src: 'https://x.example/a.png' })] });
    expect(() => updateWebPart(api, unknownImage, draft())).toThrow('다시 골라');
    const unknownClosed = partOf({ pieces: [piece({ variants: { closed: 'https://x.example/c.png' } })] });
    expect(() => updateWebPart(api, unknownClosed, draft())).toThrow('감은 얼굴');
    expect(calls).toEqual([]);
    expect(() => updateWebPart(api, unknownImage, draft(), { image: 'h2n' })).not.toThrow(); // 새 그림이면 된다
    expect(() => updateWebPart(api, unknownClosed, draft(), { closed: null })).not.toThrow(); // 빼면 된다
  });

  it('상태는 status 만 · 순서는 모델과 id 전부 · 상품 DELETE 는 없다', async () => {
    const { api, calls } = fakeApi();
    await setWebPartStatus(api, 'p1', 'archived');
    await reorderWebParts(api, ['b', 'a']);
    expect(calls).toEqual([
      { method: 'PATCH', path: '/v1/admin/products/p1', body: { status: 'archived' } },
      {
        method: 'PUT',
        path: '/v1/admin/products/order',
        body: { target: { kind: 'baseModel' }, ids: ['b', 'a'] },
      },
    ]);
  });

  it('API 가 없는 환경(dev · e2e)은 예전 방식이 없어 «API 없음» 오류', async () => {
    await expect(listWebParts(null)).rejects.toBeInstanceOf(NoApiError);
    await expect(uploadPartFile(null, PNG)).rejects.toBeInstanceOf(NoApiError);
    expect(() => createWebPart(null, draft(), 'I')).toThrow(NoApiError);
  });
});

describe('웹 생성기 파츠 — 쓰기 실패 글', () => {
  it('서버가 400 · 404 로 보낸 까닭은 붙이고, 권한 · 닿지 못함은 기존 글', () => {
    const f = '저장하지 못했어요';
    expect(webPartErrorMessage(new ApiError('request', 400, 'BAD', 'PNG 가 아니에요'), f)).toBe(
      `${f} — PNG 가 아니에요`,
    );
    expect(webPartErrorMessage(new ApiError('unavailable', 404, '', '이미 지운 파츠예요'), f)).toBe(
      `${f} — 이미 지운 파츠예요`,
    );
    expect(webPartErrorMessage(new ApiError('auth', 401, 'AUTH_REQUIRED', ''), f)).toContain('다시 로그인');
    expect(webPartErrorMessage(new ApiError('auth', 403, 'ACCESS_DENIED', '거절'), f)).toContain(
      '권한이 없어요',
    );
    expect(webPartErrorMessage(new ApiError('unavailable', 0, '', 'API 에 연결하지 못했어요'), f)).toBe(f);
    expect(webPartErrorMessage(new ApiError('unavailable', 502, '', 'API 오류 (502)'), f)).toBe(f);
    expect(webPartErrorMessage(new Error('x'), f)).toBe(f);
  });
});
