import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

test('커스텀 카테고리 — 추가는 규칙을 통과하는 모양으로, 이미 있는 ID 는 막는다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'catalog');
  const custom = card(page, '커스텀 카테고리');
  await expect(custom.getByText('커스텀 카테고리가 없어요')).toBeVisible();

  await custom.getByLabel('그룹').selectOption('hand');
  await expect(custom.getByLabel('부착 본')).toHaveValue('handR');
  await custom.getByLabel('이름').fill('장갑');
  await custom.getByLabel('ID').fill('hat');
  await custom.getByRole('button', { name: '추가' }).click();
  await expect(custom.getByText('이미 있는 ID 예요')).toBeVisible();

  await custom.getByLabel('ID').fill('Glove');
  await custom.getByLabel('부착 본').selectOption('handL');
  await custom.getByRole('button', { name: '추가' }).click();
  await expect(toast(page)).toHaveText('«장갑» 를 추가했어요');
  await expect(row(custom, 'glove')).toContainText('🏷️ 장갑');
  expect(await dbGet('catalog/customCats/glove')).toMatchObject({
    cat: 'glove',
    label: '장갑',
    icon: '🏷️',
    group: 'hand',
    bone: 'handL',
  });
});

test('커스텀 카테고리 — 고른 것만 한 묶음으로 지운다', async ({ page, seed }) => {
  const cat = (id: string, label: string) => ({ cat: id, label, icon: '🏷️', group: 'head', bone: 'head' });
  await seed({
    catalog: {
      customCats: { crown: cat('crown', '왕관'), horn: cat('horn', '뿔'), ribbon: cat('ribbon', '리본') },
    },
  });
  await openMenu(page, 'catalog');
  const custom = card(page, '커스텀 카테고리');
  await custom.getByRole('checkbox', { name: 'crown 선택' }).check();
  await custom.getByRole('checkbox', { name: 'ribbon 선택' }).check();
  await custom.getByRole('button', { name: '선택 삭제 (2)' }).click();
  await expect(toast(page)).toHaveText('2개 삭제했어요');
  await expect(row(custom, 'crown')).toHaveCount(0);
  expect(Object.keys((await dbGet<Record<string, unknown>>('catalog/customCats'))!)).toEqual(['horn']);
});

test('기본 카테고리 — 이름 · 아이콘을 덮어쓰고 되돌린다', async ({ page, seed }) => {
  await seed({ catalog: { catOverrides: { wing: { label: '날개옷', updatedAt: 1 } } } });
  await openMenu(page, 'catalog');
  const builtin = card(page, '기본 카테고리');

  const cape = row(builtin, 'cape');
  await cape.getByRole('button', { name: '수정' }).click();
  await builtin.getByLabel('cape 이름').fill('겉옷');
  await builtin.getByLabel('cape 아이콘').fill('🧥');
  await builtin.getByRole('button', { name: '저장' }).click();
  await expect(toast(page)).toHaveText('«겉옷» 로 바꿨어요');
  await expect(row(builtin, 'cape')).toContainText('🧥 겉옷');
  expect(await dbGet('catalog/catOverrides/cape')).toMatchObject({ label: '겉옷', icon: '🧥' });

  await builtin.getByRole('checkbox', { name: 'cape 선택' }).check();
  await builtin.getByRole('checkbox', { name: 'wing 선택' }).check();
  await builtin.getByRole('checkbox', { name: 'hat 선택' }).check();
  await builtin.getByRole('button', { name: '선택 되돌리기 (2)' }).click();
  await expect(toast(page)).toHaveText('2개 되돌렸어요');
  await expect(row(builtin, 'cape')).toContainText('🧣 망토');
  await expect(row(builtin, 'wing')).toContainText('🪽 날개');
  expect(await dbGet('catalog/catOverrides')).toBeNull();
});
