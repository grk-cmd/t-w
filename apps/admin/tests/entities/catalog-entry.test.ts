import { describe, expect, it } from 'vitest';
import {
  catalogEntries,
  isCatalogFileUrl,
  moveId,
  orderWrite,
  removeEntriesWrite,
  toEntry,
} from '@/entities/catalog';

const FILE = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/${encodeURIComponent(path)}?alt=media&token=t`;

describe('카탈로그 항목', () => {
  it('앱 merge 정렬과 같게 order 오름차순 · 없으면 뒤로 · 같으면 키 순', () => {
    const list = catalogEntries('parts', {
      c: { name: 'C' },
      b: { name: 'B', order: 1 },
      a: { name: 'A' },
      d: { name: 'D', order: 0 },
    });
    expect(list.map((e) => e.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('썸네일은 thumbUrl(https) 다음 thumbnail(data:image) — 지울 파일은 catalog/ 아래 Storage 파일만', () => {
    const e = toEntry('desks', 'd1', {
      name: '책상',
      glbUrl: FILE('catalog/desks/d1.glb'),
      thumbUrl: FILE('catalog/desks/d1.thumb.png'),
      glb: 'AAAA',
    });
    expect(e.thumb).toBe(FILE('catalog/desks/d1.thumb.png'));
    expect(e.files).toEqual([FILE('catalog/desks/d1.glb'), FILE('catalog/desks/d1.thumb.png')]);
    expect(e.base64).toBe(true);
    expect(e.cat).toBeNull();

    const old = toEntry('parts', 'p1', { cat: 'hat', thumbnail: 'data:image/png;base64,AA', gacha: true });
    expect(old).toMatchObject({
      thumb: 'data:image/png;base64,AA',
      files: [],
      legacyGacha: true,
      cat: 'hat',
    });
  });

  it('남의 파일 · 다른 호스트 · 깨진 주소는 지울 파일로 보지 않는다', () => {
    expect(isCatalogFileUrl(FILE('catalog/parts/a.glb'))).toBe(true);
    expect(isCatalogFileUrl('http://127.0.0.1:9199/v0/b/demo/o/catalog%2Fparts%2Fa.glb')).toBe(true); // 에뮬레이터
    expect(isCatalogFileUrl(FILE('users/u1/away.png'))).toBe(false);
    expect(isCatalogFileUrl('https://example.com/v0/b/x/o/catalog%2Fa.glb')).toBe(false);
    expect(isCatalogFileUrl('not a url')).toBe(false);
    expect(isCatalogFileUrl(undefined)).toBe(false);
  });

  it('끌어 놓기는 앱 reorderSavedPart 와 같다', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(moveId(['a', 'b'], 'a', 'x')).toEqual(['a', 'b']);
  });

  it('순서는 바뀌는 항목만, 제 종류 경로에 쓰고 옛 가챠 항목은 뺀다', () => {
    const parts = catalogEntries('parts', {
      a: { order: 0 },
      b: { order: 1 },
      old: { gacha: true },
    });
    expect(orderWrite([parts[1], parts[0], parts[2]])).toEqual({
      'catalog/parts/b/order': 0,
      'catalog/parts/a/order': 1,
    });
    const gacha = catalogEntries('gachaParts', { g1: {}, g2: { order: 0 } });
    expect(orderWrite(gacha)).toEqual({ 'catalog/gachaParts/g1/order': 1 });
  });

  it('파츠 지우기는 앱 unpublishPart 처럼 parts · gachaParts 양쪽, 책상은 제 경로만', () => {
    expect(removeEntriesWrite('gachaParts', ['p'])).toEqual({
      'catalog/parts/p': null,
      'catalog/gachaParts/p': null,
    });
    expect(removeEntriesWrite('desks', ['d1', 'd2'])).toEqual({
      'catalog/desks/d1': null,
      'catalog/desks/d2': null,
    });
  });
});
