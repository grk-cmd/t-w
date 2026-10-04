import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu } from './support/ui';

test('광고 배너 — 이미지가 있는 칸만 배열로 통째로 저장한다', async ({ page, seed }) => {
  await seed({
    catalog: { adBanner: [{ img: 'https://ads.example/old.png', link: 'https://old.example' }] },
  });
  await openMenu(page, 'settings');
  const banner = card(page, '광고 배너');
  const imgs = banner.getByPlaceholder('이미지 주소 (https)');
  const links = banner.getByPlaceholder('링크 (선택)');
  await expect(imgs.nth(0)).toHaveValue('https://ads.example/old.png');

  await imgs.nth(2).fill('http://ads.example/plain.png');
  await banner.getByRole('button', { name: '게시' }).click();
  await expect(banner.getByText('이미지 주소는 https:// 로 시작해야 해요')).toBeVisible();
  expect(await dbGet('catalog/adBanner')).toEqual([
    { img: 'https://ads.example/old.png', link: 'https://old.example' },
  ]);

  // 가운데 칸을 비우면 빈 칸 없이 앞으로 당겨 쓴다.
  await imgs.nth(0).fill('https://ads.example/a.png');
  await links.nth(0).fill('https://a.example');
  await imgs.nth(2).fill('  https://ads.example/c.png  ');
  await banner.getByRole('button', { name: '게시' }).click();
  await expect(banner.getByText('게시했어요 · 2장')).toBeVisible();
  expect(await dbGet('catalog/adBanner')).toEqual([
    { img: 'https://ads.example/a.png', link: 'https://a.example' },
    { img: 'https://ads.example/c.png', link: '' },
  ]);
});

test('게임 설정 — 지금 값이 든 칸을 고쳐 저장하고, 다른 설정은 남긴다', async ({ page, seed }) => {
  await seed({ catalog: { gameConfig: { animalUnlockLevel: 30, futureFlag: 'keep' } } });
  await openMenu(page, 'settings');
  const game = card(page, '게임 설정');
  const level = game.getByLabel('동물 캐릭터 해금 레벨');
  await expect(level).toHaveValue('30');
  await expect(game.getByRole('button', { name: '저장' })).toBeDisabled();

  await level.fill('0');
  await game.getByRole('button', { name: '저장' }).click();
  await expect(game.getByText('1~999 사이 숫자를 넣어 주세요')).toBeVisible();

  await level.fill('45');
  await game.getByRole('button', { name: '저장' }).click();
  await expect(game.getByText('저장했어요 · Lv.45')).toBeVisible();
  await expect(level).toHaveValue('45');
  expect(await dbGet('catalog/gameConfig')).toEqual({ animalUnlockLevel: 45, futureFlag: 'keep' });
});

test('게임 설정 — 서버 값이 없으면 기본값 50 을 보여 준다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'settings');
  const game = card(page, '게임 설정');
  await expect(game.getByLabel('동물 캐릭터 해금 레벨')).toHaveValue('50');
  await expect(game.getByText('서버 값 없음 → 기본값 Lv.50')).toBeVisible();
});

test('방 입장 최소 버전은 보기만 한다', async ({ page, seed }) => {
  await seed({ config: { minRoomVer: '1.4.2' } });
  await openMenu(page, 'settings');
  const minVer = card(page, '방 입장 최소 버전');
  await expect(minVer.locator('code.key')).toHaveText('1.4.2');
  await expect(minVer.getByRole('textbox')).toHaveCount(0);
  await expect(minVer.getByRole('button')).toHaveCount(0);
});
