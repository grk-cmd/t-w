import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE, reduce, setRemoteParts } from '@/features/character-maker';
import { fetchWebParts } from '@/features/character-maker/api/web-parts';
import { drawFace, type DrawCtx } from '@/features/character-maker/lib/draw-front';
import { createPartImages, type ImgLike } from '@/features/character-maker/lib/part-images';
import { accItems, findItem, layerItems } from '@/features/character-maker/model/catalog';
import { parseRemoteParts, partImageUrlOk } from '@/features/character-maker/model/remote-parts';
import { API_ORIGIN } from '@/shared/config';

const IMG = `${API_ORIGIN}/web-creator/images/a.png`;
const name = { ko: '별눈', en: 'Star', ja: 'ほし' };
const part = (o: Record<string, unknown> = {}) => ({
  id: 'p1',
  slot: 'pupil',
  name,
  src: IMG,
  w: 20,
  h: 22,
  order: 1,
  ...o,
});

afterEach(() => setRemoteParts([]));

describe('parseRemoteParts — 서버에서 받은 파츠 검사', () => {
  it('맞는 모양은 그대로 · 숨김 · 모양이 틀린 것은 뺀다 · order 차례', () => {
    const got = parseRemoteParts({
      parts: [
        part({ id: 'b', order: 2 }),
        part({ id: 'a', order: 1 }),
        part({ id: 'h', hidden: true }),
        part({ id: 'x', slot: 'hair' }),
        part({ id: 'a', order: 0 }), // 같은 id 는 앞의 것만
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['a', 'b']);
    expect(got[0]).toEqual({
      id: 'a',
      slot: 'pupil',
      name,
      src: IMG,
      closedSrc: null,
      w: 20,
      h: 22,
      order: 1,
    });
  });

  it('그림 주소는 우리 API 서버 https 만', () => {
    expect(partImageUrlOk(IMG)).toBe(true);
    for (const bad of [
      'http://api.together-working.com/a.png',
      'https://evil.example/a.png',
      'https://together-working.com/a.png',
      'https://api.together-working.com.evil.example/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      42,
    ])
      expect(partImageUrlOk(bad), String(bad)).toBe(false);
    expect(parseRemoteParts({ parts: [part({ src: 'https://evil.example/a.png' })] })).toEqual([]);
  });

  it('이름 셋(한 · 영 · 일)이 다 있어야 · 너무 길면 안 받는다 · 크기는 0 < 크기 ≤ 200', () => {
    const bad = [
      part({ name: { ko: '별', en: 'Star' } }),
      part({ name: { ...name, ja: '  ' } }),
      part({ name: { ...name, ko: '가'.repeat(21) } }),
      part({ w: 0 }),
      part({ h: 201 }),
      part({ w: Number.NaN }),
      part({ id: '../x' }),
    ];
    for (const b of bad) expect(parseRemoteParts({ parts: [b] }), JSON.stringify(b)).toEqual([]);
    expect(parseRemoteParts({ parts: [part({ w: 200, h: 0.5 })] })).toHaveLength(1);
  });

  it('감은눈 그림은 아이라인만 받는다', () => {
    const closed = `${API_ORIGIN}/web-creator/images/c.png`;
    expect(parseRemoteParts({ parts: [part({ slot: 'eyeline', closedSrc: closed })] })[0]?.closedSrc).toBe(
      closed,
    );
    expect(
      parseRemoteParts({ parts: [part({ slot: 'mouth', closedSrc: closed })] })[0]?.closedSrc,
    ).toBeNull();
  });

  it('모양이 아닌 응답은 빈 목록', () => {
    for (const d of [null, undefined, 3, 'x', [], { parts: 'no' }]) expect(parseRemoteParts(d)).toEqual([]);
  });
});

describe('setRemoteParts — 기본 그림 뒤에 붙는다', () => {
  it('레이어 · 액세서리에 «w:» 를 붙여 넣고 빈 목록이면 기본만', () => {
    const before = layerItems('pupil').length;
    setRemoteParts(parseRemoteParts({ parts: [part(), part({ id: 'acc1', slot: 'acc' })] }));
    expect(layerItems('pupil').length).toBe(before + 1);
    expect(layerItems('pupil').at(-1)?.id).toBe('w:p1');
    expect(accItems().at(-1)?.id).toBe('w:acc1');
    setRemoteParts([]);
    expect(layerItems('pupil').length).toBe(before);
    expect(accItems().some((a) => a.id === 'w:acc1')).toBe(false);
  });

  it('고르기는 목록에 있는 것만 — 들어오기 전엔 안 받고 들어온 뒤엔 받는다', () => {
    const pick = () => reduce(DEFAULT_STATE, { t: 'item', kind: 'pupil', id: 'w:p1' }).pupil;
    expect(pick()).toBe(DEFAULT_STATE.pupil);
    setRemoteParts(parseRemoteParts({ parts: [part()] }));
    expect(pick()).toBe('w:p1');
  });

  it('감은눈 그림이 없는 아이라인은 기본 감은 줄로 — 감은눈 얼굴이 비지 않게', () => {
    setRemoteParts(parseRemoteParts({ parts: [part({ slot: 'eyeline' })] }));
    expect(findItem('eyeline', 'w:p1').closed).toEqual(findItem('eyeline', 'thin').closed);
  });
});

describe('그림 파츠 그리기', () => {
  function fake() {
    const log: string[] = [];
    const ctx = {
      save() {},
      restore() {},
      translate() {},
      scale() {},
      transform() {},
      beginPath() {},
      ellipse() {},
      fill() {},
      stroke() {},
      clearRect() {},
      drawImage: (_i: unknown, x: number, y: number, w: number, h: number) =>
        log.push(`img ${x} ${y} ${w} ${h}`),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
    };
    return { ctx: ctx as unknown as DrawCtx, log };
  }
  const makePath = () => ({}) as Path2D;

  it('불러온 그림은 가운데를 자리에 맞춰 w × h 로 · 아직이면 건너뛴다', () => {
    setRemoteParts(parseRemoteParts({ parts: [part()] }));
    const s = reduce(DEFAULT_STATE, { t: 'item', kind: 'pupil', id: 'w:p1' });
    const img = {} as CanvasImageSource;
    let r = fake();
    drawFace(r.ctx, s, 'open', { makePath, images: (src) => (src === IMG ? img : null) });
    expect(r.log.filter((l) => l === 'img -10 -11 20 22')).toHaveLength(2); // 왼 · 오른 눈
    r = fake();
    drawFace(r.ctx, s, 'open', { makePath, images: () => null });
    expect(r.log).toEqual([]);
  });
});

describe('createPartImages — 그림 불러오기', () => {
  it('주소마다 한 번 · CORS 로 · 다 불러오면 알리고 그 뒤에야 그림을 준다', () => {
    const made: ImgLike[] = [];
    const onLoad = vi.fn();
    const images = createPartImages(onLoad, () => {
      const im = { crossOrigin: null, src: '', onload: null, onerror: null } as ImgLike;
      made.push(im);
      return im;
    });
    expect(images(IMG)).toBeNull();
    expect(images(IMG)).toBeNull();
    expect(made).toHaveLength(1);
    expect(made[0]?.crossOrigin).toBe('anonymous');
    expect(made[0]?.src).toBe(IMG);
    made[0]?.onload?.(new Event('load'));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(images(IMG)).toBe(made[0]);
  });

  it('못 불러온 그림은 계속 null — 다시 부르지도 않는다', () => {
    const made: ImgLike[] = [];
    const images = createPartImages(
      () => {},
      () => {
        const im = { crossOrigin: null, src: '', onload: null, onerror: null } as ImgLike;
        made.push(im);
        return im;
      },
    );
    images(IMG);
    (made[0]?.onerror as (() => void) | null)?.();
    expect(images(IMG)).toBeNull();
    expect(made).toHaveLength(1);
  });
});

describe('fetchWebParts — 공개 목록 읽기', () => {
  const res = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  it('API 서버의 /web-creator/parts 를 쿠키 없이 · 봉투 data 를 검사해 돌려준다', async () => {
    const f = vi.fn(async () => res(200, { success: true, data: { parts: [part()] } }));
    const r = await fetchWebParts(f as unknown as typeof fetch);
    expect(r).toEqual({ t: 'ok', parts: parseRemoteParts({ parts: [part()] }) });
    expect(f).toHaveBeenCalledWith(
      `${API_ORIGIN}/web-creator/parts`,
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('실패는 «failed» 로 — 상태 코드 · 봉투가 아님 · 연결 안 됨 · 시간 초과', async () => {
    const cases: (typeof fetch)[] = [
      (async () => res(404, null)) as unknown as typeof fetch,
      (async () => res(200, { success: false })) as unknown as typeof fetch,
      (async () => res(200, '<html>')) as unknown as typeof fetch,
      (async () => {
        throw new TypeError('network');
      }) as unknown as typeof fetch,
    ];
    for (const f of cases) expect((await fetchWebParts(f)).t).toBe('failed');
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_, rej) =>
        init.signal?.addEventListener('abort', () => rej(new Error('abort'))),
      )) as unknown as typeof fetch;
    expect(await fetchWebParts(slow, API_ORIGIN, 5)).toEqual({ t: 'failed', why: '시간 초과' });
  });

  it('올린 파츠가 없으면 빈 목록(실패와 다르다)', async () => {
    const f = (async () => res(200, { success: true, data: { parts: [] } })) as unknown as typeof fetch;
    expect(await fetchWebParts(f)).toEqual({ t: 'ok', parts: [] });
  });
});
