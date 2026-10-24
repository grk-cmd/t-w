import { describe, expect, it } from 'vitest';
import {
  createWebPart,
  deleteWebPart,
  draftProblem,
  emptyDraft,
  imageProblem,
  movedIds,
  isPng,
  pngSize,
  listWebParts,
  NoApiError,
  parseAdminParts,
  PART_IMAGE_MAX_BYTES,
  reorderWebParts,
  setWebPartHidden,
  toBase64,
  updateWebPart,
  uploadDecalImage,
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
const IMG = (h: string) => `https://api.together-working.com/v1/decal-images/${h}.png`;

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

const decal = (o: Record<string, unknown> = {}) => ({
  id: 'd1',
  surface: 'face',
  slot: 'pupil',
  src: IMG('h2a'),
  w: 10,
  h: 12,
  ...o,
});
const setRow = (o: Record<string, unknown> = {}) => ({
  id: 's1',
  target: { kind: 'baseModel' },
  name: { ko: '가', en: 'a', ja: 'あ' },
  position: 10,
  hidden: false,
  decals: [decal()],
  ...o,
});
const partOf = (o: Record<string, unknown> = {}): WebPart => {
  const p = parseAdminParts({ sets: [setRow(o)] })[0];
  if (!p) throw new Error('시험용 세트를 읽지 못했다');
  return p;
};

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

describe('웹 생성기 파츠 — 목록 읽기(세트)', () => {
  it('서버 순서 그대로 · 숨긴 것 포함 · 한 장짜리 얼굴 세트만 고칠 수 있다', () => {
    const got = parseAdminParts({
      sets: [
        setRow({ id: 'b', hidden: true }),
        setRow({ id: 'a' }),
        setRow({ id: 'multi', decals: [decal(), decal({ id: 'd2', slot: 'mouth' })] }),
        setRow({ id: 'ear', decals: [decal({ surface: 'earL', slot: 'ear' })] }),
        setRow({ id: 'other', target: { kind: 'part', id: 'hat' } }),
        setRow({ id: '' }),
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['b', 'a', 'multi', 'ear']);
    expect(got[0]?.hidden).toBe(true);
    expect(got[1]?.decal).toMatchObject({ id: 'd1', slot: 'pupil', w: 10, h: 12, image: 'h2a' });
    expect(got[2]).toMatchObject({ decal: null, decalCount: 2, thumb: IMG('h2a') });
    expect(got[3]?.decal).toBeNull(); // 다른 면은 이 화면에서 고치지 않는다
    expect(parseAdminParts(null)).toEqual([]);
    expect(parseAdminParts({ parts: [] })).toEqual([]); // 옛 모양
  });

  it('그림 해시 — 응답에 있으면 그 값, 없으면 그림 주소의 파일 이름 · 모르면 null', () => {
    expect(partOf({ decals: [decal({ image: 'given' })] }).decal?.image).toBe('given');
    expect(partOf().decal?.image).toBe('h2a');
    expect(partOf({ decals: [decal({ src: 'https://x.example/a.png' })] }).decal?.image).toBeNull();
    const eye = partOf({ decals: [decal({ slot: 'eyeline', closedSrc: IMG('h2c') })] }).decal;
    expect([eye?.closedSrc, eye?.closedImage]).toEqual([IMG('h2c'), 'h2c']);
  });

  it('한 칸 옮기기 — 끝을 넘으면 null', () => {
    const list = parseAdminParts({ sets: ['a', 'b', 'c'].map((id) => setRow({ id })) });
    expect(movedIds(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movedIds(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(movedIds(list, 0, -1)).toBeNull();
    expect(movedIds(list, 2, 1)).toBeNull();
    expect(movedIds(list, 5, -1)).toBeNull();
  });
});

describe('웹 생성기 파츠 — API(#517 경로 · 본문)', () => {
  it('목록은 모델로 자르고 · 그림은 바이트 그대로 올려 해시를 받는다', async () => {
    const { api, calls } = fakeApi({ hash: 'h2new' });
    await listWebParts(api);
    await expect(uploadDecalImage(api, PNG)).resolves.toBe('h2new');
    expect(calls[0]).toMatchObject({ path: '/v1/admin/decal-sets', params: { target: 'baseModel' } });
    expect(calls[1]).toMatchObject({
      method: 'UPLOAD',
      path: '/v1/admin/decal-images',
      body: PNG,
      type: 'image/png',
    });
    await expect(uploadDecalImage(fakeApi({}).api, PNG)).rejects.toThrow('모양');
  });

  it('새 파츠 = 한 장짜리 세트 — target · 이름 · 숨김 · 데칼(얼굴 면 · 해시)', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft({ hidden: true }), 'h2i');
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/v1/admin/decal-sets',
      body: {
        target: { kind: 'baseModel' },
        name: draft().name,
        hidden: true,
        decals: [{ surface: 'face', slot: 'pupil', image: 'h2i', w: 24, h: 24 }],
      },
    });
  });

  it('감은눈 그림은 아이라인만 — 만들기 · 고치기 둘 다', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft({ slot: 'eyeline' }), 'I', 'C');
    await createWebPart(api, draft({ slot: 'mouth' }), 'I', 'C');
    await updateWebPart(api, partOf(), draft({ slot: 'mouth' }), undefined, 'C');
    const decals = calls.map((c) => (c.body as { decals: Record<string, unknown>[] }).decals[0]);
    expect(decals[0]).toMatchObject({ closedImage: 'C' });
    expect(decals[1]).not.toHaveProperty('closedImage');
    expect(decals[2]).not.toHaveProperty('closedImage');
  });

  it('고치기 — 데칼 id 는 그대로 · 안 바꾼 그림은 지금 해시 · 아이라인을 떠나면 감은눈은 뺀다', async () => {
    const { api, calls } = fakeApi();
    const eye = partOf({ id: 'a/b', decals: [decal({ slot: 'eyeline', closedSrc: IMG('h2c') })] });
    await updateWebPart(api, eye, draft({ slot: 'eyeline' }));
    await updateWebPart(api, eye, draft({ slot: 'eyeline' }), 'h2n', 'h2m');
    await updateWebPart(api, eye, draft({ slot: 'brows' }));
    expect(calls[0]?.path).toBe('/v1/admin/decal-sets/a%2Fb'); // id 는 경로 한 칸으로만
    const decals = calls.map((c) => (c.body as { decals: Record<string, unknown>[] }).decals[0]);
    expect(decals[0]).toMatchObject({ id: 'd1', image: 'h2a', closedImage: 'h2c' });
    expect(decals[1]).toMatchObject({ id: 'd1', image: 'h2n', closedImage: 'h2m' });
    expect(decals[2]).toMatchObject({ id: 'd1', slot: 'brows', image: 'h2a' });
    expect(decals[2]).not.toHaveProperty('closedImage');
    expect(calls[0]?.body).toMatchObject({ name: draft().name, hidden: false });
  });

  it('고칠 수 없는 경우는 보내지 않는다 — 여러 장 세트 · 그림 해시를 모름', () => {
    const { api, calls } = fakeApi();
    const multi = partOf({ decals: [decal(), decal({ id: 'd2', slot: 'mouth' })] });
    expect(() => updateWebPart(api, multi, draft())).toThrow('여러 장');
    const unknownHash = partOf({ decals: [decal({ src: 'https://x.example/a.png' })] });
    expect(() => updateWebPart(api, unknownHash, draft())).toThrow('다시 골라');
    expect(calls).toEqual([]);
    expect(() => updateWebPart(api, unknownHash, draft(), 'h2n')).not.toThrow(); // 새 그림이면 된다
  });

  it('숨기기는 hidden 만 · 지우기 · 순서는 모델과 id 전부', async () => {
    const { api, calls } = fakeApi();
    await setWebPartHidden(api, 'p1', true);
    await deleteWebPart(api, 'p1');
    await reorderWebParts(api, ['b', 'a']);
    expect(calls).toEqual([
      { method: 'PATCH', path: '/v1/admin/decal-sets/p1', body: { hidden: true } },
      { method: 'DELETE', path: '/v1/admin/decal-sets/p1', body: undefined },
      {
        method: 'PUT',
        path: '/v1/admin/decal-sets/order',
        body: { target: { kind: 'baseModel' }, ids: ['b', 'a'] },
      },
    ]);
  });

  it('API 가 없는 환경(dev · e2e)은 예전 방식이 없어 «API 없음» 오류', async () => {
    await expect(listWebParts(null)).rejects.toBeInstanceOf(NoApiError);
    await expect(uploadDecalImage(null, PNG)).rejects.toBeInstanceOf(NoApiError);
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
