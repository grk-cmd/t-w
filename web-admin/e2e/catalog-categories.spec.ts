import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

test('카테고리 이름 — 칸에 고쳐 저장, 비우고 저장하면 기본값으로', async ({ page, seed }) => {
  const scarf = { cat: 'scarf', label: '목도리', icon: '🧣', group: 'cloth', bone: 'spine' };
  await seed({
    catalog: { customCats: { scarf }, catOverrides: { wing: { label: '날개옷', updatedAt: 1 } } },
  });
  await openMenu(page, 'catalog');
  const names = card(page, '카테고리 이름');

  const save = (cat: string) =>
    names.locator('form').filter({ hasText: cat }).getByRole('button', { name: '저장' });
  await expect(save('cape')).toBeDisabled();
  await names.getByLabel('cape 이름').fill('겉옷');
  await names.getByLabel('cape 아이콘').fill('🧥');
  await save('cape').click();
  await expect(toast(page)).toHaveText('저장했어요');
  expect(await dbGet('catalog/catOverrides/cape')).toMatchObject({ label: '겉옷', icon: '🧥' });

  await expect(names.getByLabel('wing 이름')).toHaveValue('날개옷');
  await names.getByLabel('wing 이름').fill('');
  await save('wing').click();
  await expect(names.getByLabel('wing 이름')).toHaveValue('');
  expect(await dbGet('catalog/catOverrides/wing')).toBeNull();

  await names.getByLabel('scarf 이름').fill('머플러');
  await save('scarf').click();
  await expect(names.getByLabel('scarf 이름')).toHaveValue('머플러');
  expect(await dbGet('catalog/customCats/scarf')).toEqual({ ...scarf, label: '머플러' });
});
