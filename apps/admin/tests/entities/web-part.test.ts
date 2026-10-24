import { describe, expect, it } from 'vitest';
import {
  createWebPart,
  deleteWebPart,
  draftProblem,
  emptyDraft,
  imageProblem,
  isPng,
  listWebParts,
  NoApiError,
  parseAdminParts,
  PART_IMAGE_MAX_BYTES,
  toBase64,
  updateWebPart,
  webPartErrorMessage,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import { ApiError, type Api, type ApiWriteMethod } from '@/shared/api';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const draft = (o: Partial<WebPartDraft> = {}): WebPartDraft => ({
  ...emptyDraft('pupil'),
  name: { ko: '별눈', en: 'Star', ja: 'ほし' },
  ...o,
});

function fakeApi(data: unknown = null) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const api: Api = {
    get: async <T>(path: string) => {
      calls.push({ method: 'GET', path });
      return data as T;
    },
    send: async <T>(method: ApiWriteMethod, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return data as T;
    },
  };
  return { api, calls };
}

describe('웹 생성기 파츠 — 폼 값 검사', () => {
  it('이름 셋 · 크기 범위 · 순서', () => {
    expect(draftProblem(draft())).toBeNull();
    expect(draftProblem(draft({ name: { ko: '별', en: ' ', ja: 'ほし' } }))).toContain('en');
    expect(draftProblem(draft({ name: { ko: '가'.repeat(21), en: 'a', ja: 'a' } }))).toContain('20자');
    for (const w of [0, -1, 201, Number.NaN]) expect(draftProblem(draft({ w })), String(w)).toContain('크기');
    expect(draftProblem(draft({ w: 200, h: 0.5 }))).toBeNull();
    expect(draftProblem(draft({ order: Number.NaN }))).toContain('순서');
  });

  it('그림은 내용이 PNG 인지 보고 512KB 까지', () => {
    expect(isPng(PNG)).toBe(true);
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false); // JPEG
    expect(imageProblem(new Uint8Array([1, 2, 3]))).toContain('PNG');
    const big = new Uint8Array(PART_IMAGE_MAX_BYTES + 1);
    big.set(PNG.subarray(0, 8));
    expect(imageProblem(big)).toContain('512KB');
    expect(imageProblem(PNG)).toBeNull();
  });

  it('base64 — 큰 그림도 한 번에(쪼개어 바꿈)', () => {
    expect(toBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    const big = new Uint8Array(100_000).fill(65);
    expect(atob(toBase64(big)).length).toBe(100_000);
  });
});

describe('웹 생성기 파츠 — 목록 읽기', () => {
  it('숨긴 것도 보이고 · 자리 → 순서 차례 · 모양이 틀린 줄은 뺀다', () => {
    const row = (o: Record<string, unknown>) => ({
      id: 'x',
      slot: 'pupil',
      name: { ko: '가', en: 'a', ja: 'あ' },
      src: 'https://api.together-working.com/web-creator/images/x.png',
      w: 10,
      h: 10,
      order: 0,
      ...o,
    });
    const got = parseAdminParts({
      parts: [
        row({ id: 'acc', slot: 'acc' }),
        row({ id: 'p2', order: 2, hidden: true }),
        row({ id: 'p1', order: 1 }),
        row({ id: 'bad', slot: 'hair' }),
        row({ id: 'bad2', w: 0 }),
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['p1', 'p2', 'acc']);
    expect(got[1]?.hidden).toBe(true);
    expect(parseAdminParts(null)).toEqual([]);
  });
});

describe('웹 생성기 파츠 — API', () => {
  it('목록 · 더하기 · 고치기 · 지우기 경로와 본문', async () => {
    const { api, calls } = fakeApi({ parts: [] });
    await listWebParts(api);
    await createWebPart(api, draft(), 'IMG');
    await updateWebPart(api, 'a/b', draft({ hidden: true }));
    await updateWebPart(api, 'p1', draft(), 'NEW');
    await deleteWebPart(api, 'p1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /admin/web-creator/parts',
      'POST /admin/web-creator/parts',
      'PATCH /admin/web-creator/parts/a%2Fb', // id 는 경로 한 칸으로만
      'PATCH /admin/web-creator/parts/p1',
      'DELETE /admin/web-creator/parts/p1',
    ]);
    expect(calls[1]?.body).toEqual({ ...draft(), image: 'IMG' });
    expect(calls[2]?.body).toEqual(draft({ hidden: true })); // 그림을 안 골랐으면 싣지 않는다
    expect(calls[3]?.body).toEqual({ ...draft(), image: 'NEW' });
  });

  it('감은눈 그림은 아이라인일 때만 싣는다', async () => {
    const { api, calls } = fakeApi();
    await createWebPart(api, draft({ slot: 'eyeline' }), 'I', 'C');
    await createWebPart(api, draft({ slot: 'mouth' }), 'I', 'C');
    const bodies = calls.map((c) => c.body as Record<string, unknown>);
    expect(bodies[0]).toMatchObject({ closedImage: 'C' });
    expect(bodies[1]).not.toHaveProperty('closedImage');
  });

  it('API 가 없는 환경(dev · e2e)은 예전 방식이 없어 «API 없음» 오류', async () => {
    await expect(listWebParts(null)).rejects.toBeInstanceOf(NoApiError);
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
