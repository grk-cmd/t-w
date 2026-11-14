import { describe, expect, it } from 'vitest';
import {
  b64,
  clonePayload,
  CLONE_CODE_PREFIX,
  decodeCloneCode,
  decryptPayload,
  encodeCloneCode,
  encryptPayload,
  unb64,
  type CloneDefIn,
} from '../src/index';
import samples from './fixtures/dcc1-samples.json';
import expected from './fixtures/dcc1-expected.json';

/* 표본은 코어로 옮기기 전 앱(apps/desktop/app/parts/character/code-crypto.js)이 만든 코드와, 그 앱이 되살린 def 다.
   앱은 커미션 이름이 비면 '커미션' 을 채운다(화면 글이라 앱 몫) — 견줄 때 같은 일을 한다. */
const appSide = (d: Record<string, unknown>) => (d.isCommission && !d.commName ? { ...d, commName: '커미션' } : d);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const cv = (u: string) => ({ toDataURL: () => u });
const keep = { shrinkDataUrl: async (u: unknown) => (typeof u === 'string' ? u : null) };

describe('DCC1 읽기 호환 — 옛 앱이 만든 코드', () => {
  for (const [name, { pass, code }] of Object.entries(samples)) {
    it(`${name} 을 옛 앱과 같은 def 로 되살린다`, async () => {
      const d = await decodeCloneCode(code, pass);
      expect(appSide(d)).toEqual((expected as Record<string, unknown>)[name]);
    });
  }

  it('책상 · 아이템 · 커미션 칸을 지우지 않고 그대로 되살린다', async () => {
    const desk = await decodeCloneCode(samples.desk.code, samples.desk.pass);
    expect(desk).toMatchObject({ deskGlb: 'Z2xURg==', deskItems: [{ id: 'mug', x: 1 }], customItems: [{ n: 'c' }], deskCatalogId: 'd_01' });
    const comm = await decodeCloneCode(samples.commission.code, samples.commission.pass);
    expect(comm).toMatchObject({ isCommission: true, commGlb: 'Y29tbQ==', commName: null });
  });

  it('비밀번호가 틀리면 던진다', async () => {
    await expect(decodeCloneCode(samples.human.code, 'wrong')).rejects.toThrow();
  });
});

describe('DCC1 거절', () => {
  it('DCC1 이 아니면 format', async () => {
    for (const bad of ['', 'DCK1.desk.AAAA', 'dcc1.AAAA', null, undefined, 42]) {
      await expect(decryptPayload(bad, 'p')).rejects.toThrow(/^format$/);
    }
  });
  it('캐릭터 코드가 아니면 type', async () => {
    const code = await encryptPayload(JSON.stringify({ t: 'desk' }), 'p');
    await expect(decodeCloneCode(code, 'p')).rejects.toThrow(/^type$/);
  });
  it('줄바꿈 · 띄어쓰기가 끼어도 읽는다', async () => {
    const { code, pass } = samples.human;
    const spaced = CLONE_CODE_PREFIX + code.slice(5).replace(/(.{40})/g, '$1\n  ');
    expect(appSide(await decodeCloneCode(spaced, pass))).toEqual(expected.human);
  });
});

describe('DCC1 만들기', () => {
  it('만든 코드를 다시 읽으면 같은 def 다(사람)', async () => {
    const def: CloneDefIn = { skin: 3, face: cv(PNG), blink: cv(PNG), top: '#111', bot: '#222', earL: 'elf', earPicL: 'https://x/e.png', earPicR: 'data:image/png;base64,AA' };
    const back = await decodeCloneCode(await encodeCloneCode(def, 'pw', keep), 'pw');
    expect(back).toEqual({ type: 'creator', skin: 3, face: PNG, blink: PNG, top: '#111', bot: '#222', earL: 'elf', earPicL: 'https://x/e.png' });
  });

  it('동물 그림 6장만 줄이고 얼굴 · 깜빡임은 줄이지 않는다', async () => {
    const asked: [unknown, number][] = [];
    const shrink = { shrinkDataUrl: async (u: unknown, size: number) => { asked.push([u, size]); return `small:${String(u)}`; } };
    const def: CloneDefIn = { face: cv('F'), blink: cv('B'), animal: true, animalBody: 'b', animalEarPaintL: 'l', animalEarPaintR: 'r', animalBlink: 'k' };
    const o = JSON.parse(await clonePayload(def, shrink));
    expect(asked.map((a) => a[1])).toEqual([256, 256, 256, 256, 256, 256]);
    expect([o.animalBody, o.animalBlink, o.face, o.blink]).toEqual(['small:b', 'small:k', 'F', 'B']);
  });

  it('사람이면 줄이기를 부르지 않는다', async () => {
    let n = 0;
    await clonePayload({ face: cv('F'), blink: cv('B') }, { shrinkDataUrl: async () => { n++; return null; } });
    expect(n).toBe(0);
  });

  it('옛 앱과 칸 순서까지 같은 JSON 을 만든다', async () => {
    const o = JSON.parse(await clonePayload({ face: cv('F'), blink: cv('B'), top: 't', bot: 'b' }, keep));
    expect(Object.keys(o)).toEqual([
      't', 'skin', 'top', 'bot', 'xf', 'decor', 'deskColor', 'deskItems', 'deskGlb', 'deskCatalogId', 'deskScale', 'deskPos',
      'customItems', 'isCommission', 'commName', 'commGlb', 'animal', 'animalFace', 'animalScl', 'animalEarL', 'animalEarR',
      'animalEarAdj', 'animalBody', 'animalEarPaintL', 'animalEarPaintR', 'animalBlink', 'animalEarBlinkL', 'animalEarBlinkR',
      'earL', 'earR', 'earAdj', 'earPicL', 'earPicR', 'face', 'blink',
    ]);
  });

  it('옛 모양(귀 · 감은눈 귀 칸이 없는) 코드도 읽는다', async () => {
    const old = await encryptPayload(JSON.stringify({ t: 'creator', skin: 1, top: 'a', bot: 'b', face: 'F', blink: 'B', animal: true, animalEarPaintL: 'L', animalEarPaintR: 'R' }), 'p');
    const d = await decodeCloneCode(old, 'p');
    expect([d.animalEarBlinkL, d.animalEarBlinkR, d.animalBody, d.animalFace]).toEqual(['L', 'R', null, 0]);
  });
});

describe('base64', () => {
  it('바이트를 그대로 오간다(0 · 255 · 빈 값)', () => {
    for (const bytes of [[], [0], [255, 0, 128], Array.from({ length: 300 }, (_, i) => i % 256)]) {
      const u = new Uint8Array(bytes);
      expect(Array.from(unb64(b64(u)))).toEqual(bytes);
      expect(b64(u.buffer)).toBe(b64(u));
    }
  });
});
