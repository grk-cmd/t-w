import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dbGet, fileExists, uploadFile } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

// 에뮬레이터 주소로 넣는 이유는 catalog-parts.spec 와 같다.
const upload = async (path: string) =>
  (await uploadFile(path, Buffer.from('glTF-e2e'))).replace(
    'https://firebasestorage.googleapis.com',
    'http://127.0.0.1:9199',
  );

async function openTab(page: Page, tab: '책상' | '아이템') {
  await openMenu(page, 'catalog');
  await page.getByRole('tab', { name: tab, exact: true }).click();
  return card(page, tab);
}

test('책상 — 이름 · 아이콘만 바꾸고 glbUrl 같은 나머지 필드는 남긴다', async ({ page, seed }) => {
  const glbUrl = await upload('catalog/desks/d1.glb');
  await seed({
    catalog: { desks: { d1: { name: '나무책상', icon: '🪵', glbUrl, licenseOnly: true, createdAt: 1 } } },
  });
  const list = await openTab(page, '책상');
  await row(list, '나무책상').getByRole('button', { name: '수정' }).click();
  await list.getByLabel('d1 이름').fill('ㄱ'.repeat(31));
  await expect(list.getByLabel('d1 이름')).toHaveValue('ㄱ'.repeat(30)); // 칸이 30자에서 멈춘다
  await list.getByLabel('d1 이름').fill('큰 나무책상');
  await list.getByLabel('d1 아이콘').fill('🪑');
  await list.getByRole('button', { name: '저장' }).click();
  await expect(toast(page)).toHaveText('저장했어요');
  await expect(row(list, 'd1')).toContainText('🪑 큰 나무책상');
  expect(await dbGet('catalog/desks/d1')).toEqual({
    name: '큰 나무책상',
    icon: '🪑',
    glbUrl,
    licenseOnly: true,
    createdAt: 1,
  });
});

test('책상 — 지우면 DB 와 Storage glb · 썸네일이 같이 지워진다', async ({ page, seed }) => {
  const glbUrl = await upload('catalog/desks/d1.glb');
  const thumbUrl = await upload('catalog/desks/d1.thumb.png');
  await seed({ catalog: { desks: { d1: { name: '나무책상', icon: '🪵', glbUrl, thumbUrl } } } });
  const list = await openTab(page, '책상');
  await row(list, '나무책상').getByRole('button', { name: '삭제' }).click();
  await expect(toast(page)).toHaveText('1개 삭제했어요');
  await expect(list.getByText('비어 있어요')).toBeVisible();
  expect(await dbGet('catalog/desks')).toBeNull();
  expect(await fileExists('catalog/desks/d1.glb')).toBe(false);
  expect(await fileExists('catalog/desks/d1.thumb.png')).toBe(false);
});

test('아이템 — 끌어 놓은 순서를 쓰고, 고른 것만 한 묶음으로 지운다', async ({ page, seed }) => {
  const glbUrl = await upload('catalog/items/x.glb');
  const item = (name: string, order?: number) => ({
    name,
    icon: '☕',
    glbUrl,
    ...(order === undefined ? {} : { order }),
  });
  await seed({
    catalog: { items: { a: item('머그컵', 0), b: item('화분', 1), c: item('스탠드') } },
  });
  const list = await openTab(page, '아이템');
  await expect(list.locator('.row').last()).toContainText('스탠드'); // order 가 없으면 뒤로

  await row(list, '스탠드').dragTo(row(list, '머그컵'));
  await expect(toast(page)).toHaveText('순서를 바꿨어요');
  await expect(list.locator('.row').first()).toContainText('스탠드');
  expect(await dbGet('catalog/items/c/order')).toBe(0);
  expect(await dbGet('catalog/items/a/order')).toBe(1);
  expect(await dbGet('catalog/items/b/order')).toBe(2);

  await list.getByRole('checkbox', { name: '머그컵 선택' }).check();
  await list.getByRole('checkbox', { name: '화분 선택' }).check();
  await list.getByRole('button', { name: '선택 삭제 (2)' }).click();
  await expect(toast(page)).toHaveText('2개 삭제했어요');
  expect(Object.keys((await dbGet<Record<string, unknown>>('catalog/items'))!)).toEqual(['c']);
  expect(await fileExists('catalog/items/x.glb')).toBe(true); // 남은 스탠드가 같은 파일을 쓴다
});
