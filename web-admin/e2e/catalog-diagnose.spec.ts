import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

const GLB = 'A'.repeat(3000); // 옛 항목처럼 DB 에 남은 glb base64
const URL =
  'https://firebasestorage.googleapis.com/v0/b/demo-tw.appspot.com/o/catalog%2Fparts%2Fa.glb?alt=media';

test('진단 — 큰 필드를 보여 주고, glbUrl 이 있는 항목의 glb 만 지운다', async ({ page, seed }) => {
  await seed({
    catalog: {
      parts: {
        moved: { cat: 'hat', name: '옮긴모자', icon: '🎩', glb: GLB, glbUrl: URL },
        only: { cat: 'hat', name: '원본만', icon: '🎩', glb: GLB },
        clean: { cat: 'hat', name: '깨끗', icon: '🎩', glbUrl: URL },
      },
      items: { cup: { name: '컵', icon: '☕', glb: GLB, glbUrl: URL } },
    },
  });
  await openMenu(page, 'catalog');
  await page.getByRole('tab', { name: '진단' }).click();

  const analysis = card(page, '용량 진단');
  await expect(analysis.getByRole('row', { name: /^파츠 3/ })).toBeVisible();
  await analysis.getByText('파츠 큰 항목').click();
  await expect(analysis.getByRole('listitem').filter({ hasText: 'moved' })).toContainText('glb(3KB)');

  const cleanup = card(page, 'base64 정리');
  await expect(cleanup.getByText('2개 · 0.01MB')).toBeVisible();
  await expect(cleanup.getByLabel('건너뛸 항목')).toHaveText('파츠/only');
  await cleanup.getByRole('button', { name: '정리' }).click();
  await expect(toast(page)).toHaveText('2개 정리했어요');
  await expect(cleanup.getByText('0개 · 0.00MB')).toBeVisible();
  await expect(cleanup.getByRole('button', { name: '정리' })).toBeDisabled();

  expect(await dbGet('catalog/parts/moved')).toEqual({
    cat: 'hat',
    name: '옮긴모자',
    icon: '🎩',
    glbUrl: URL,
  });
  expect(await dbGet('catalog/items/cup/glb')).toBeNull();
  expect(await dbGet('catalog/items/cup/glbUrl')).toBe(URL);
  expect(await dbGet('catalog/parts/only/glb')).toBe(GLB);
});
