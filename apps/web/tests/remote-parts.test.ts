import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE, reduce, setRemoteParts } from '@/features/character-maker';
import { fetchWebParts } from '@/features/character-maker/api/web-parts';
import { drawFace, type DrawCtx } from '@/features/character-maker/lib/draw-front';
import { createPartImages, type ImgLike } from '@/features/character-maker/lib/part-images';
import { accItems, findItem, layerItems } from '@/features/character-maker/model/catalog';
import { parseRemoteParts, partImageUrlOk } from '@/features/character-maker/model/remote-parts';
import { API_ORIGIN } from '@/shared/config';

const IMG = `${API_ORIGIN}/v1/assets/h2a.png`;
const SHUT = `${API_ORIGIN}/v1/assets/h2c.png`;
const name = { ko: '별눈', en: 'Star', ja: 'ほし' };
const piece = (o: Record<string, unknown> = {}) => ({
  id: 'p1',
  kind: 'decal',
  target: { kind: 'baseModel' },
  surface: 'face',
  slot: 'pupil',
  src: IMG,
  w: 20,
  h: 22,
  ...o,
});
const product = (pieces: unknown[], o: Record<string, unknown> = {}) => ({
  id: 'i1',
  target: { kind: 'baseModel' },
  name,
  thumb: IMG,
  locked: false,
  pieces,
  ...o,
});
/** 조각 하나짜리 상품 하나의 응답 data */
const one = (o: Record<string, unknown> = {}) => ({ products: [product([piece(o)])] });

afterEach(() => setRemoteParts([]));

describe('parseRemoteParts — 서버 상품을 고르기 판 항목(조각 하나씩)으로 펼친다', () => {
  it('상품 차례 · 상품 안 조각 차례 · 이름은 상품 이름 · 같은 조각 id 는 앞의 것만', () => {
    const got = parseRemoteParts({
      products: [
        product([piece({ id: 'b', slot: 'brows' }), piece({ id: 'a' })], {
          id: 'cat',
          name: { ko: '고양이', en: 'Cat', ja: 'ねこ' },
        }),
        product([piece({ id: 'a', slot: 'mouth' }), piece({ id: 'c', slot: 'acc' })], { id: 'dog' }),
      ],
    });
    expect(got.map((p) => `${p.id}:${p.slot}:${p.name.ko}`)).toEqual([
      'b:brows:고양이',
      'a:pupil:고양이',
      'c:acc:별눈',
    ]);
    expect(got[1]).toEqual({
      id: 'a',
      slot: 'pupil',
      name: { ko: '고양이', en: 'Cat', ja: 'ねこ' },
      src: IMG,
      closedSrc: null,
      w: 20,
      h: 22,
    });
  });

  it('그릴 수 없는 것은 건너뛴다 — 잠긴 상품 · 다른 모델 · 3D 모양 · 다른 종류 · 다른 면 · 3D 위 그림 · 모르는 slot', () => {
    const got = parseRemoteParts({
      products: [
        {
          id: 'lock',
          target: { kind: 'baseModel' },
          name,
          thumb: IMG,
          locked: true,
          requires: { kind: 'entitlement', key: 'premium' },
        },
        product([piece({ id: 'lk' })], { id: 'lock2', locked: true }), // 잠겼는데 조각이 실려 와도 쓰지 않는다
        product([piece({ id: 'm1' })], { id: 'part', target: { kind: 'part', id: 'hat01' } }),
        product(
          [
            piece({ id: 'p3d', kind: 'part', partId: 'part_catear' }),
            piece({ id: 'pk', kind: 'sticker' }),
            piece({ id: 'ear', surface: 'earL' }), // 다른 면만 다름(slot 은 얼굴 것)
            piece({ id: 'body', surface: 'body', slot: 'pattern' }),
            piece({ id: 'onp', target: { kind: 'part', id: 'part_catear' } }), // 3D 위 그림 — target 만 다름(면은 face)
            piece({ id: 'dim', dimension: '2d' }), // 옛 규격의 dimension 칸이 와도 받는다
            piece({ id: 'ok' }),
          ],
          { id: 'mix' },
        ),
        product([piece({ id: 'x', slot: 'hair' })], { id: 'unk' }),
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['dim', 'ok']);
  });

  it('그림 주소는 우리 API 서버의 /v1/assets/ 아래 https 만', () => {
    expect(partImageUrlOk(IMG)).toBe(true);
    for (const bad of [
      'http://api.together-working.com/v1/assets/a.png',
      'https://evil.example/a.png',
      'https://together-working.com/v1/assets/a.png',
      `${API_ORIGIN}/v1/admin/assets/a.png`, // API 서버라도 공개 파일 길이 아니면
      `${API_ORIGIN}/v1/assetsX/a.png`,
      `${API_ORIGIN}/v1/decal-images/a.png`, // 옛 규격 경로
      `${API_ORIGIN}/web-creator/images/a.png`,
      'https://api.together-working.com.evil.example/v1/assets/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      42,
    ])
      expect(partImageUrlOk(bad), String(bad)).toBe(false);
    expect(parseRemoteParts(one({ src: 'https://evil.example/a.png' }))).toEqual([]);
  });

  it('상품 이름 셋(한 · 영 · 일)이 다 있어야 · 너무 길면 안 받는다 · 크기는 0 < 크기 ≤ 200 · id 모양', () => {
    const badItems = [
      product([piece()], { name: { ko: '별', en: 'Star' } }),
      product([piece()], { name: { ...name, ja: '  ' } }),
      product([piece()], { name: { ...name, ko: '가'.repeat(21) } }),
      product([piece()], { id: '../x' }),
      product('no' as unknown as unknown[]),
    ];
    for (const b of badItems) expect(parseRemoteParts({ products: [b] }), JSON.stringify(b)).toEqual([]);
    const badPieces = [
      { w: 0 },
      { h: 201 },
      { w: Number.NaN },
      { w: '20' },
      { id: '../x' },
      { kind: undefined },
    ];
    for (const o of badPieces) expect(parseRemoteParts(one(o)), JSON.stringify(o)).toEqual([]);
    expect(parseRemoteParts(one({ w: 200, h: 0.5 }))).toHaveLength(1);
  });

  it('눈 감은 얼굴 그림(variants.closed)은 모든 자리 · 모르는 표정 · 틀린 주소는 버리고 기본 그림', () => {
    for (const slot of ['eyeline', 'mouth', 'pupil', 'acc'])
      expect(parseRemoteParts(one({ slot, variants: { closed: SHUT } }))[0]?.closedSrc, slot).toBe(SHUT);
    expect(parseRemoteParts(one({ variants: { smile: SHUT } }))[0]?.closedSrc).toBeNull();
    expect(
      parseRemoteParts(one({ variants: { closed: 'https://evil.example/c.png' } }))[0]?.closedSrc,
    ).toBeNull();
    expect(parseRemoteParts(one({ variants: 'x' }))[0]?.closedSrc).toBeNull();
  });

  it('모양이 아닌 응답은 빈 목록 · 옛 모양({ parts } · { sets } · { items })도 빈 목록', () => {
    for (const d of [
      null,
      undefined,
      3,
      'x',
      [],
      { products: 'no' },
      { parts: [piece()] },
      { sets: [product([piece()])] },
      { items: [product([piece()])] }, // 지난 판 이름
    ])
      expect(parseRemoteParts(d)).toEqual([]);
  });

  it('펼친 조각은 200개까지', () => {
    const products = Array.from({ length: 11 }, (_, i) =>
      product(
        Array.from({ length: 20 }, (_, j) => piece({ id: `d${j}_${i}` })),
        { id: `s${i}` },
      ),
    );
    expect(parseRemoteParts({ products })).toHaveLength(200);
  });
});

describe('setRemoteParts — 기본 그림 뒤에 붙는다', () => {
  it('레이어 · 액세서리에 «w:» 를 붙여 넣고 빈 목록이면 기본만', () => {
    const before = layerItems('pupil').length;
    setRemoteParts(parseRemoteParts({ products: [product([piece(), piece({ id: 'acc1', slot: 'acc' })])] }));
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
    setRemoteParts(parseRemoteParts(one()));
    expect(pick()).toBe('w:p1');
  });

  it('감은눈 그림이 없는 아이라인은 기본 감은 줄로 — 감은눈 얼굴이 비지 않게', () => {
    setRemoteParts(parseRemoteParts(one({ slot: 'eyeline' })));
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
    setRemoteParts(parseRemoteParts(one()));
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

describe('눈 감은 얼굴 그림(표정 closed) 그리기', () => {
  /** 그린 그림 주소 차례 — 그림 객체를 주소로 돌려받는다 */
  function drawn(state: ReturnType<typeof reduce>, expr: 'open' | 'closed'): string[] {
    const out: string[] = [];
    const noop = () => {};
    const ctx = {
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      transform: noop,
      beginPath: noop,
      ellipse: noop,
      fill: noop,
      stroke: noop,
      clearRect: noop,
      drawImage: (i: unknown) => out.push((i as { src: string }).src),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
    } as unknown as DrawCtx;
    drawFace(ctx, state, expr, {
      makePath: () => ({}) as Path2D,
      images: (src) => ({ src }) as unknown as CanvasImageSource,
    });
    return out;
  }
  const pick = (kind: 'pupil' | 'brows', o: Record<string, unknown> = {}) => {
    setRemoteParts(parseRemoteParts(one({ slot: kind, ...o })));
    return reduce(DEFAULT_STATE, { t: 'item', kind, id: 'w:p1' });
  };

  it('눈썹 · 입 같은 자리 — 감은 얼굴엔 감은 그림, 없으면 뜬 그림 그대로', () => {
    expect(drawn(pick('brows', { variants: { closed: SHUT } }), 'open')).toEqual([IMG, IMG]);
    expect(drawn(pick('brows', { variants: { closed: SHUT } }), 'closed')).toEqual([SHUT, SHUT]);
    expect(drawn(pick('brows'), 'closed')).toEqual([IMG, IMG]);
  });

  it('동공 · 하이라이트 — 감은 얼굴엔 감은 그림이 있을 때만(없으면 예전처럼 안 그림)', () => {
    expect(drawn(pick('pupil'), 'closed')).toEqual([]);
    expect(drawn(pick('pupil', { variants: { closed: SHUT } }), 'closed')).toEqual([SHUT, SHUT]);
  });

  it('액세서리도 감은 그림을 쓴다', () => {
    setRemoteParts(parseRemoteParts(one({ slot: 'acc', variants: { closed: SHUT } })));
    const s = reduce(DEFAULT_STATE, { t: 'accAdd', id: 'w:p1' });
    expect(drawn(s, 'open')).toEqual([IMG]);
    expect(drawn(s, 'closed')).toEqual([SHUT]);
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

  it('API 서버의 /v1/products(기본 몸 모델 · 얼굴 면)를 쿠키 없이 · 봉투 data 를 검사해 돌려준다', async () => {
    const f = vi.fn(async () => res(200, { success: true, data: one() }));
    const r = await fetchWebParts(f as unknown as typeof fetch);
    expect(r).toEqual({ t: 'ok', parts: parseRemoteParts(one()) });
    expect(f).toHaveBeenCalledWith(
      `${API_ORIGIN}/v1/products?target=baseModel&surface=face`,
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
    const f = (async () => res(200, { success: true, data: { products: [] } })) as unknown as typeof fetch;
    expect(await fetchWebParts(f)).toEqual({ t: 'ok', parts: [] });
  });
});
