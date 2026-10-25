import { describe, expect, it } from 'vitest';
import { imageProblem, parseAdminParts } from '@/entities/web-creator/part';
import {
  BUILTIN_PARTS,
  importBuiltins,
  missingBuiltins,
  type BuiltinPart,
} from '@/features/web-creator/manage-parts';
import { bytesFromDataUrl, parseManifest } from '@/features/web-creator/manage-parts/model/builtinParts';
import type { Api, ApiParams, ApiWriteMethod } from '@/shared/api';

// 그림을 data 주소로 받아 바이트로 — 앱이 쓰는 것과 같은 파일
const PNGS = import.meta.glob<string>('../../src/features/web-creator/manage-parts/builtin/*.png', {
  query: '?inline',
  import: 'default',
  eager: true,
});
const pngOf = (file: string): Uint8Array | null => {
  const data = PNGS[`../../src/features/web-creator/manage-parts/builtin/${file}`];
  return data ? bytesFromDataUrl(data) : null;
};
const product = (id: string, slot: string, ko: string, status = 'active') => ({
  id,
  target: { kind: 'baseModel' },
  name: { ko, en: 'x', ja: 'x' },
  status,
  position: 10,
  pieces: [
    {
      id: `pc_${id}`,
      kind: 'decal',
      target: { kind: 'baseModel' },
      surface: 'face',
      slot,
      src: `https://api.together-working.com/v1/assets/h2${id}.png`,
      w: 10,
      h: 10,
    },
  ],
});

/** 목록은 live · archived 따로 · 올리기는 h2up1 … · 만들기 본문을 모은다 */
function fakeApi(live: unknown[], archived: unknown[] = []) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  let n = 0;
  const api: Api = {
    get: async <T>(_p: string, params?: ApiParams) =>
      ({ products: params?.status === 'archived' ? archived : live }) as T,
    send: async <T>(method: ApiWriteMethod, path: string, body?: unknown) => {
      calls.push(`${method} ${path}`);
      bodies.push(body);
      // 만든 상품은 다음 목록 읽기에 보인다(서버처럼 맨 뒤)
      if (method === 'POST') {
        const b = body as { name: { ko: string }; pieces: { slot: string }[] };
        live.push(product(`n${live.length}`, b.pieces[0]?.slot ?? '', b.name.ko, 'draft'));
      }
      return null as T;
    },
    upload: async <T>() => {
      calls.push('UPLOAD');
      return { hash: `h2up${++n}` } as T;
    },
  };
  return { api, calls, bodies };
}
const bytes = async (file: string) => new TextEncoder().encode(file);

describe('기본 파츠 목록(뽑은 그림)', () => {
  it('28개 · 코드에 남는 처음 얼굴 · «없음» 은 없다 · 아이라인만 감은 그림 · 처음 얼굴은 동공 «동그랑» · 아이라인 «얇은»', () => {
    expect(BUILTIN_PARTS).toHaveLength(28);
    const keys = BUILTIN_PARTS.map((b) => b.key);
    for (const kept of ['highlight/dot', 'brows/arc', 'mouth/smile', 'cheek/blush'])
      expect(keys).not.toContain(kept);
    expect(keys.some((k) => k.endsWith('/none'))).toBe(false);
    for (const b of BUILTIN_PARTS) expect(b.closedFile !== null, b.key).toBe(b.slot === 'eyeline');
    expect(new Set(keys).size).toBe(keys.length);
    expect(BUILTIN_PARTS.filter((b) => b.lead).map((b) => b.key)).toEqual(['pupil/round', 'eyeline/thin']);
  });

  it('그림 파일이 다 있고 서버 규칙(PNG · 512KB · 1024px · 크기 0~200)을 지킨다', () => {
    for (const b of BUILTIN_PARTS) {
      for (const f of [b.file, b.closedFile].filter((x): x is string => x !== null)) {
        const png = pngOf(f);
        expect(png, f).not.toBeNull();
        expect(imageProblem(png ?? new Uint8Array()), f).toBeNull();
      }
      expect(b.w > 0 && b.w <= 200 && b.h > 0 && b.h <= 200, b.key).toBe(true);
    }
  });

  it('data 주소 → 바이트(작은 그림은 빌드가 data 주소로 넣는다)', () => {
    expect([...bytesFromDataUrl('data:image/png;base64,iVBORw==')]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('목록 모양이 틀리면 가져오기 전에 막는다', () => {
    expect(() => parseManifest({})).toThrow('모양');
    expect(() => parseManifest([{ key: 'x', slot: 'hair' }])).toThrow('0번');
  });
});

describe('기본 파츠 가져오기', () => {
  const two: BuiltinPart[] = [
    {
      key: 'mouth/o',
      slot: 'mouth',
      name: { ko: '오', en: 'Oh', ja: 'お' },
      w: 14,
      h: 16,
      file: 'mouth-o.png',
      closedFile: null,
      lead: false,
    },
    {
      key: 'eyeline/thick',
      slot: 'eyeline',
      name: { ko: '굵은', en: 'Thick', ja: 'ふとい' },
      w: 34,
      h: 34,
      file: 'eyeline-thick.png',
      closedFile: 'eyeline-thick-closed.png',
      lead: false,
    },
  ];

  it('없는 것 = 같은 자리 · 같은 한국어 이름이 없는 것(다른 자리 같은 이름은 별개)', () => {
    const existing = parseAdminParts({
      products: [product('a', 'mouth', '오'), product('b', 'brows', '굵은')],
    });
    expect(missingBuiltins(existing, two).map((b) => b.key)).toEqual(['eyeline/thick']);
  });

  it('단종까지 새로 읽어 없는 것만 차례로 초안으로 — 감은 그림도 올리고 진행을 알린다', async () => {
    const { api, calls, bodies } = fakeApi([], [product('old', 'mouth', '오', 'archived')]);
    const seen: string[] = [];
    const done = await importBuiltins(api, bytes, (d, t) => seen.push(`${d}/${t}`), two);
    expect(done).toBe(1);
    expect(seen).toEqual(['0/1', '1/1']);
    expect(calls).toEqual(['UPLOAD', 'UPLOAD', 'POST /v1/admin/products']);
    expect(bodies[0]).toEqual({
      target: { kind: 'baseModel' },
      name: { ko: '굵은', en: 'Thick', ja: 'ふとい' },
      thumbHash: 'h2up1',
      pieces: [
        {
          kind: 'decal',
          target: { kind: 'baseModel' },
          surface: 'face',
          slot: 'eyeline',
          imageHash: 'h2up1',
          variantHashes: { closed: 'h2up2' },
          w: 34,
          h: 34,
        },
      ],
    });
  });

  it('처음 얼굴(lead)을 올렸으면 진열 순서 맨 앞으로 — 나머지 순서는 그대로', async () => {
    const lead: BuiltinPart = {
      key: 'eyeline/thin',
      slot: 'eyeline',
      name: { ko: '얇은', en: 'Thin', ja: 'ほそい' },
      w: 30,
      h: 32,
      file: 'eyeline-thin.png',
      closedFile: null,
      lead: true,
    };
    const { api, calls, bodies } = fakeApi([product('a', 'mouth', '오'), product('b', 'eyeline', '굵은')]);
    expect(await importBuiltins(api, bytes, () => {}, [...two, lead])).toBe(1);
    expect(calls.at(-1)).toBe('PUT /v1/admin/products/order');
    expect(bodies.at(-1)).toEqual({ target: { kind: 'baseModel' }, ids: ['n2', 'a', 'b'] });
  });

  it('처음 얼굴이 이미 있으면 순서를 건드리지 않는다', async () => {
    const lead = { ...two[0], lead: true } as BuiltinPart;
    const { api, calls } = fakeApi([product('a', 'mouth', '오')]);
    expect(await importBuiltins(api, bytes, () => {}, [lead, two[1] as BuiltinPart])).toBe(1);
    expect(calls).not.toContain('PUT /v1/admin/products/order');
  });

  it('다 있으면 아무것도 올리지 않는다(다시 눌러도 겹치지 않음)', async () => {
    const { api, calls } = fakeApi([product('a', 'mouth', '오'), product('b', 'eyeline', '굵은', 'draft')]);
    expect(await importBuiltins(api, bytes, () => {}, two)).toBe(0);
    expect(calls).toEqual([]);
  });
});
