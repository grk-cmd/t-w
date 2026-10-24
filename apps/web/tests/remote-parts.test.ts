import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE, reduce, setRemoteParts } from '@/features/character-maker';
import { fetchWebParts } from '@/features/character-maker/api/web-parts';
import { drawFace, type DrawCtx } from '@/features/character-maker/lib/draw-front';
import { createPartImages, type ImgLike } from '@/features/character-maker/lib/part-images';
import { accItems, findItem, layerItems } from '@/features/character-maker/model/catalog';
import { parseRemoteParts, partImageUrlOk } from '@/features/character-maker/model/remote-parts';
import { API_ORIGIN } from '@/shared/config';

const IMG = `${API_ORIGIN}/v1/decal-images/h2a.png`;
const name = { ko: '별눈', en: 'Star', ja: 'ほし' };
const decal = (o: Record<string, unknown> = {}) => ({
  id: 'p1',
  surface: 'face',
  slot: 'pupil',
  src: IMG,
  w: 20,
  h: 22,
  ...o,
});
const set = (decals: unknown[], o: Record<string, unknown> = {}) => ({
  id: 's1',
  target: { kind: 'baseModel' },
  name,
  decals,
  ...o,
});
/** 데칼 하나짜리 세트 하나의 응답 data */
const one = (o: Record<string, unknown> = {}) => ({ sets: [set([decal(o)])] });

afterEach(() => setRemoteParts([]));

describe('parseRemoteParts — 서버 세트를 고르기 판 항목(데칼 하나씩)으로 펼친다', () => {
  it('세트 안 데칼을 차례대로 · 이름은 세트 이름 · 같은 데칼 id 는 앞의 것만', () => {
    const got = parseRemoteParts({
      sets: [
        set([decal({ id: 'b', slot: 'brows' }), decal({ id: 'a' })], {
          id: 'cat',
          name: { ko: '고양이', en: 'Cat', ja: 'ねこ' },
        }),
        set([decal({ id: 'a', slot: 'mouth' }), decal({ id: 'c', slot: 'acc' })], { id: 'dog' }),
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

  it('그릴 수 없는 것은 건너뛴다 — 다른 모델 · 다른 면 · 모르는 slot · 숨긴 세트(나머지는 그대로)', () => {
    const got = parseRemoteParts({
      sets: [
        set([decal({ id: 'm1' })], { id: 'part', target: { kind: 'part', id: 'hat01' } }),
        set([decal({ id: 'm2' })], { id: 'nt', target: 'baseModel' }),
        set([decal({ id: 'ear', surface: 'earL', slot: 'ear' }), decal({ id: 'ok' })], { id: 'mix' }),
        set([decal({ id: 'x', slot: 'hair' })], { id: 'unk' }),
        set([decal({ id: 'h' })], { id: 'hid', hidden: true }),
      ],
    });
    expect(got.map((p) => p.id)).toEqual(['ok']);
  });

  it('그림 주소는 우리 API 서버의 /v1/decal-images/ 아래 https 만', () => {
    expect(partImageUrlOk(IMG)).toBe(true);
    for (const bad of [
      'http://api.together-working.com/v1/decal-images/a.png',
      'https://evil.example/a.png',
      'https://together-working.com/v1/decal-images/a.png',
      `${API_ORIGIN}/v1/admin/decal-images/a.png`, // API 서버라도 공개 그림 길이 아니면
      `${API_ORIGIN}/v1/decal-imagesX/a.png`,
      `${API_ORIGIN}/web-creator/images/a.png`, // 옛 경로
      'https://api.together-working.com.evil.example/v1/decal-images/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      42,
    ])
      expect(partImageUrlOk(bad), String(bad)).toBe(false);
    expect(parseRemoteParts(one({ src: 'https://evil.example/a.png' }))).toEqual([]);
  });

  it('세트 이름 셋(한 · 영 · 일)이 다 있어야 · 너무 길면 안 받는다 · 크기는 0 < 크기 ≤ 200 · id 모양', () => {
    const badSets = [
      set([decal()], { name: { ko: '별', en: 'Star' } }),
      set([decal()], { name: { ...name, ja: '  ' } }),
      set([decal()], { name: { ...name, ko: '가'.repeat(21) } }),
      set([decal()], { id: '../x' }),
      set('no' as unknown as unknown[]),
    ];
    for (const b of badSets) expect(parseRemoteParts({ sets: [b] }), JSON.stringify(b)).toEqual([]);
    const badDecals = [
      { w: 0 },
      { h: 201 },
      { w: Number.NaN },
      { w: '20' },
      { id: '../x' },
      { surface: undefined },
    ];
    for (const o of badDecals) expect(parseRemoteParts(one(o)), JSON.stringify(o)).toEqual([]);
    expect(parseRemoteParts(one({ w: 200, h: 0.5 }))).toHaveLength(1);
  });

  it('감은눈 그림은 아이라인만 받는다', () => {
    const closed = `${API_ORIGIN}/v1/decal-images/h2c.png`;
    expect(parseRemoteParts(one({ slot: 'eyeline', closedSrc: closed }))[0]?.closedSrc).toBe(closed);
    expect(parseRemoteParts(one({ slot: 'mouth', closedSrc: closed }))[0]?.closedSrc).toBeNull();
  });

  it('모양이 아닌 응답은 빈 목록 · 옛 모양({ parts })도 빈 목록', () => {
    for (const d of [null, undefined, 3, 'x', [], { sets: 'no' }, { parts: [decal()] }])
      expect(parseRemoteParts(d)).toEqual([]);
  });

  it('펼친 데칼은 200개까지', () => {
    const decals = Array.from({ length: 20 }, (_, i) => decal({ id: `d${i}` }));
    const sets = Array.from({ length: 11 }, (_, i) =>
      set(
        decals.map((d) => ({ ...d, id: `${d.id}_${i}` })),
        { id: `s${i}` },
      ),
    );
    expect(parseRemoteParts({ sets })).toHaveLength(200);
  });
});

describe('setRemoteParts — 기본 그림 뒤에 붙는다', () => {
  it('레이어 · 액세서리에 «w:» 를 붙여 넣고 빈 목록이면 기본만', () => {
    const before = layerItems('pupil').length;
    setRemoteParts(parseRemoteParts({ sets: [set([decal(), decal({ id: 'acc1', slot: 'acc' })])] }));
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

  it('API 서버의 /v1/decal-sets(기본 몸 모델 · 얼굴 면)를 쿠키 없이 · 봉투 data 를 검사해 돌려준다', async () => {
    const f = vi.fn(async () => res(200, { success: true, data: one() }));
    const r = await fetchWebParts(f as unknown as typeof fetch);
    expect(r).toEqual({ t: 'ok', parts: parseRemoteParts(one()) });
    expect(f).toHaveBeenCalledWith(
      `${API_ORIGIN}/v1/decal-sets?target=baseModel&surface=face`,
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
    const f = (async () => res(200, { success: true, data: { sets: [] } })) as unknown as typeof fetch;
    expect(await fetchWebParts(f)).toEqual({ t: 'ok', parts: [] });
  });
});
