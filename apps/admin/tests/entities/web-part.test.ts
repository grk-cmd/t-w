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
  SHELF_SCOPE,
  type WebPart,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import { ApiError, type Api, type ApiSendMethod, type ApiSendOptions } from '@/shared/api';

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
const BASE = 'https://api.test';
/** files 에 없는 해시의 공개 주소 */
const PUBLIC = (h: string) => `${BASE}/v2/catalog/assets/${h}.png`;
/** files 에 실려 온 Storage 주소 */
const STORED = (h: string) => `https://storage.example/${h}.png`;

function fakeApi(data: unknown = null) {
  const calls: { method: string; path: string; body?: unknown; params?: unknown; type?: string }[] = [];
  const api: Api = {
    baseUrl: 'https://api.test',
    get: async <T>(path: string, params?: unknown) => {
      calls.push({ method: 'GET', path, params });
      return data as T;
    },
    send: async <T>(method: ApiSendMethod, path: string, options?: ApiSendOptions) => {
      const body = options?.body;
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
  w: 10,
  h: 12,
  imageHash: 'h2a',
  ...o,
});
/** GET /v2/admin/catalog 의 products 한 줄(CatalogResponse.Product) */
const productRow = (o: Record<string, unknown> = {}) => ({
  productId: 'i1',
  target: { kind: 'baseModel' },
  owner: 'admin',
  names: { ko: '가', en: 'a', ja: 'あ' },
  thumb: 'h2t',
  pieces: [piece()],
  listing: { state: 'ACTIVE', access: { kind: 'everyone', display: 'show' } },
  version: 3,
  ...o,
});
const catalog = (products: unknown[], o: Record<string, unknown> = {}) => ({
  categories: [],
  shelves: [],
  parts: [],
  desks: [],
  deskProps: [],
  products,
  unlocks: [],
  season: 'none',
  files: {},
  ...o,
});
const partOf = (o: Record<string, unknown> = {}): WebPart => {
  const p = parseAdminParts(catalog([productRow(o)]), BASE).parts[0];
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

describe('웹 생성기 파츠 — 목록 읽기(카탈로그 상품)', () => {
  it('상태 · 그림(얼굴) 조각 하나짜리만 고칠 수 있다 · 모양이 틀린 줄은 뺀다 · 서버 배열 순서 그대로', () => {
    const got = parseAdminParts(
      catalog([
        productRow({ productId: 'b', listing: { state: 'DRAFT' } }),
        productRow({ productId: 'a' }),
        productRow({ productId: 'multi', pieces: [piece(), piece({ id: 'pc2', slot: 'mouth' })] }),
        productRow({ productId: 'ear', pieces: [piece({ surface: 'earL', slot: 'ear' })] }),
        productRow({ productId: 'gone', listing: { state: 'ARCHIVED' } }),
        productRow({ productId: 'other', target: { kind: 'part', id: 'hat' } }),
        productRow({ productId: 'bad', listing: { state: 'HIDDEN' } }),
        productRow({ productId: 'nover', version: undefined }),
        productRow({ productId: '' }),
      ]),
      BASE,
    ).parts;
    expect(got.map((p) => `${p.id}:${p.status}:${p.version}`)).toEqual([
      'b:draft:3',
      'a:active:3',
      'multi:active:3',
      'ear:active:3',
      'gone:archived:3',
    ]);
    expect(got[1]?.piece).toMatchObject({ id: 'pc1', slot: 'pupil', w: 10, h: 12, image: 'h2a' });
    expect(got[2]).toMatchObject({ piece: null, pieceCount: 2, thumb: PUBLIC('h2t') });
    expect(got[3]?.piece).toBeNull(); // 다른 면은 이 화면에서 고치지 않는다
    expect(parseAdminParts(null, BASE)).toEqual({ parts: [], shelfVersion: 0 });
    // 지난 판(/v1) 모양 — id · name · status 는 읽지 않는다
    const v1 = { id: 'x', name: { ko: '가' }, status: 'active', target: { kind: 'baseModel' }, pieces: [] };
    expect(parseAdminParts({ products: [v1] }, BASE).parts).toEqual([]);
  });

  it('그림 주소 — files 에 있으면 그 주소 · 없으면 공개 주소 · 감은 그림은 variantHashes.closed', () => {
    const files = { h2a: STORED('h2a') };
    const p = parseAdminParts(
      catalog([productRow({ pieces: [piece({ variantHashes: { closed: 'h2c' } })] })], { files }),
      BASE,
    ).parts[0];
    expect(p?.piece).toMatchObject({
      src: STORED('h2a'),
      image: 'h2a',
      closedSrc: PUBLIC('h2c'),
      closedImage: 'h2c',
    });
    expect(p?.thumb).toBe(PUBLIC('h2t'));
    expect(partOf().piece).toMatchObject({ closedSrc: null, closedImage: null });
    expect(partOf({ pieces: [piece({ imageHash: '' })] }).piece).toBeNull(); // 그림 해시 없는 조각은 고치지 않는다
  });

  it('썸네일이 없으면 조각 그림', () => {
    expect(partOf({ thumb: '' }).thumb).toBe(PUBLIC('h2a'));
  });

  it('진열대 번호 — PRODUCT:baseModel 줄의 version · 없으면 0', () => {
    const shelves = [
      { scope: 'DESK', order: [], version: 9 },
      { scope: SHELF_SCOPE, order: ['a'], version: 4 },
    ];
    expect(SHELF_SCOPE).toBe('PRODUCT:baseModel');
    expect(parseAdminParts(catalog([], { shelves }), BASE).shelfVersion).toBe(4);
    expect(parseAdminParts(catalog([], { shelves: [shelves[0]] }), BASE).shelfVersion).toBe(0);
  });

  it('한 칸 옮기기 — 끝을 넘으면 null', () => {
    const list = parseAdminParts(
      catalog(['a', 'b', 'c'].map((productId) => productRow({ productId }))),
      BASE,
    ).parts;
    expect(movedIds(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movedIds(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(movedIds(list, 0, 1)).toEqual(['b', 'a', 'c']); // 첫 줄도 아래로
    expect(movedIds(list, 0, -1)).toBeNull();
    expect(movedIds(list, 2, 1)).toBeNull();
    expect(movedIds(list, 5, -1)).toBeNull();
  });
});

describe('웹 생성기 파츠 — API(/v2/admin/catalog 경로 · 본문)', () => {
  it('목록은 상품만 · 이 모델로 자르고(단종은 state 로 따로 · 기본 목록에서 뺀다) · 파일은 바이트 그대로 올려 해시를 받는다', async () => {
    const { api, calls } = fakeApi(
      catalog([
        productRow({ productId: 'a' }),
        productRow({ productId: 'z', listing: { state: 'ARCHIVED' } }),
      ]),
    );
    expect((await listWebParts(api)).parts.map((p) => p.id)).toEqual(['a']);
    expect((await listWebParts(api, true)).parts.map((p) => p.id)).toEqual(['a', 'z']); // 거르기는 서버가
    expect(calls[0]).toMatchObject({
      path: '/v2/admin/catalog',
      params: { only: 'products', target: 'baseModel', state: undefined },
    });
    expect(calls[1]).toMatchObject({
      path: '/v2/admin/catalog',
      params: { only: 'products', target: 'baseModel', state: 'ARCHIVED' },
    });
    const up = fakeApi({ hash: 'h2new', kind: 'image', extension: 'png', bytes: 3 });
    await expect(uploadPartFile(up.api, PNG)).resolves.toBe('h2new');
    expect(up.calls[0]).toMatchObject({
      method: 'UPLOAD',
      path: '/v2/admin/catalog/assets',
      body: PNG,
      type: 'image/png',
    });
    await expect(uploadPartFile(fakeApi({}).api, PNG)).rejects.toThrow('모양');
  });

  it('새 파츠 = 조각 하나짜리 상품 — requestId · target · names · thumb(그 그림) · 조각(해시) · 상태 · 순서는 안 보냄', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft(), 'h2i');
    const body = calls[0]?.body as Record<string, unknown>;
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/v2/admin/catalog/products' });
    expect(typeof body.requestId).toBe('string');
    expect(body).toEqual({
      requestId: body.requestId,
      target: { kind: 'baseModel' },
      names: draft().name,
      thumb: 'h2i',
      pieces: [
        {
          kind: 'decal',
          target: { kind: 'baseModel' },
          surface: 'face',
          slot: 'pupil',
          imageHash: 'h2i',
          w: 24,
          h: 24,
        },
      ],
    });
  });

  it('닿지 못해 다시 만들면 같은 requestId · 서버가 답했으면 다음은 새 번호', async () => {
    const calls: string[] = [];
    let fail = true;
    const api: Api = {
      ...fakeApi().api,
      send: async <T>(_m: ApiSendMethod, _p: string, options?: ApiSendOptions) => {
        calls.push(String((options?.body as { requestId?: string } | undefined)?.requestId));
        if (fail) {
          fail = false;
          throw new ApiError('unavailable', 0, '', 'API 에 연결하지 못했어요');
        }
        return null as T;
      },
    };
    await expect(createWebPart(api, draft(), 'h2r')).rejects.toBeInstanceOf(ApiError);
    await createWebPart(api, draft(), 'h2r');
    await createWebPart(api, draft(), 'h2r');
    expect(calls[0]).toBe(calls[1]);
    expect(calls[2]).not.toBe(calls[1]);
  });

  it('눈 감은 얼굴 그림은 모든 자리 — variantHashes.closed', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft({ slot: 'mouth' }), 'I', 'C');
    await createWebPart(api, draft({ slot: 'eyeline' }), 'I');
    expect(pieceBody(calls[0] as object)).toMatchObject({ slot: 'mouth', variantHashes: { closed: 'C' } });
    expect(pieceBody(calls[1] as object)).not.toHaveProperty('variantHashes');
  });

  it('고치기 — version 을 싣고 · 조각 id 유지 · 안 바꾼 그림은 지금 해시 · 새 그림이면 thumb 도 · 감은 그림 그대로 / 바꿈 / 뺌', async () => {
    const { api, calls } = fakeApi();
    const eye = partOf({
      productId: 'a/b',
      version: 7,
      pieces: [piece({ slot: 'eyeline', variantHashes: { closed: 'h2c' } })],
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
      imageHash: image,
      ...(closed ? { variantHashes: { closed } } : {}),
      w: 24,
      h: 24,
    });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      Array(3).fill('PATCH /v2/admin/catalog/products/a%2Fb'),
    ); // id 는 경로 한 칸으로만
    expect(calls[0]?.body).toEqual({
      version: 7,
      names: draft().name,
      pieces: [body('brows', 'h2a', 'h2c')],
    });
    expect(calls[1]?.body).toEqual({
      version: 7,
      names: draft().name,
      thumb: 'h2n',
      pieces: [body('pupil', 'h2n', 'h2m')],
    });
    expect(calls[2]?.body).toEqual({ version: 7, names: draft().name, pieces: [body('pupil', 'h2a')] });
  });

  it('여러 조각 상품은 고치지 않는다', () => {
    const { api, calls } = fakeApi();
    const multi = partOf({ pieces: [piece(), piece({ id: 'pc2', slot: 'mouth' })] });
    expect(() => updateWebPart(api, multi, draft())).toThrow('여러');
    expect(calls).toEqual([]);
  });

  it('상태는 version 과 listing.state(대문자) 만 · 순서는 진열대 PRODUCT:baseModel 에 version 과 id 전부 · 상품 DELETE 는 없다', async () => {
    const { api, calls } = fakeApi();
    await setWebPartStatus(api, partOf({ productId: 'p1', version: 5 }), 'archived');
    await reorderWebParts(api, ['b', 'a'], 2);
    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: '/v2/admin/catalog/products/p1',
        body: { version: 5, listing: { state: 'ARCHIVED' } },
      },
      {
        method: 'PUT',
        path: '/v2/admin/catalog/shelves/PRODUCT%3AbaseModel',
        body: { version: 2, order: ['b', 'a'] },
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
