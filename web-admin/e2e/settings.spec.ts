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

// 올리면 그보다 낮은 앱이 방에서 막힌다 — 최신 릴리스보다 높은 값은 막고, 같은 버전을 두 번 적어야 저장.
test('방 입장 최소 버전 — 최신 릴리스까지만, 두 번 적어야 저장되고 기록이 남는다', async ({ page, seed }) => {
  await page.route('https://api.github.com/**', (route) => route.fulfill({ json: RELEASES }));
  await seed({ config: { minRoomVer: '0.10.1' } });
  await openMenu(page, 'settings');
  const minVer = card(page, '방 입장 최소 버전');
  await expect(minVer.locator('code.key')).toHaveText('0.10.1');
  await expect(minVer).toContainText('최신 릴리스 0.10.2');

  const save = minVer.getByRole('button', { name: '저장' });
  await minVer.getByLabel('새 최소 버전').fill('0.10.3');
  await minVer.getByLabel('한 번 더').fill('0.10.2');
  await expect(save).toBeDisabled();
  await minVer.getByLabel('한 번 더').fill('0.10.3');
  await save.click();
  await expect(minVer.getByText('최신 릴리스(0.10.2)보다 높아요 — 모두 방에서 막혀요')).toBeVisible();
  expect(await dbGet('config/minRoomVer')).toBe('0.10.1');

  await minVer.getByLabel('새 최소 버전').fill('0.10.2');
  await minVer.getByLabel('한 번 더').fill('0.10.2');
  await save.click();
  await expect(minVer.getByText('저장했어요 · 0.10.2')).toBeVisible();
  await expect(minVer.locator('code.key')).toHaveText('0.10.2');
  expect(await dbGet('config/minRoomVer')).toBe('0.10.2');
  const logs = Object.values(
    (await dbGet<Record<string, { action: string; detail?: string }>>('adminLog')) ?? {},
  );
  expect(logs).toContainEqual(
    expect.objectContaining({ action: 'settings.minRoomVer', detail: '0.10.1 → 0.10.2' }),
  );
});

const RELEASES = [
  {
    tag_name: 'v0.10.3-beta.1',
    published_at: '2026-10-04T00:00:00Z',
    draft: false,
    prerelease: true,
    assets: [{ name: 'beta.yml', download_count: 5 }],
  },
  {
    tag_name: 'v0.10.2',
    published_at: new Date(Date.now() - 5 * 3_600_000 - 60_000).toISOString(),
    draft: false,
    prerelease: false,
    assets: [
      { name: 'Together-Working-Setup-0.10.2.exe', download_count: 1234 },
      { name: 'Together-Working-Setup-0.10.2.exe.blockmap', download_count: 999 },
      { name: 'latest.yml', download_count: 5678 },
      { name: 'Together-Working-0.10.2-arm64.dmg', download_count: 30 },
      { name: 'Together-Working-0.10.2-x64.dmg', download_count: 7 },
    ],
  },
  {
    tag_name: 'v0.9.8',
    published_at: '2026-09-01T00:00:00Z',
    draft: false,
    prerelease: false,
    assets: [
      { name: 'Together.Working-0.9.8-arm64.dmg', download_count: 3 },
      { name: 'Together.Working-0.9.8-x64.dmg', download_count: 2 },
    ],
  },
];

// 실제 GitHub 는 부르지 않는다 — 가짜 응답을 돌려주고, 부른 주소만 확인한다.
test('릴리스 다운로드 — 정식 릴리스만 파일별 수를 보여 준다', async ({ page, seed }) => {
  const calls: string[] = [];
  await page.route('https://api.github.com/**', (route) => {
    calls.push(route.request().url());
    return route.fulfill({ json: RELEASES });
  });
  await seed();
  await openMenu(page, 'settings');
  const releases = card(page, '릴리스 다운로드');
  const rows = releases.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('0.10.2');
  await expect(rows.nth(0)).toContainText('Latest');
  await expect(rows.nth(0)).toContainText('공개 후 5시간');
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText('1,234');
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('37 (arm64 30 · x64 7)');
  await expect(rows.nth(0).locator('td').nth(4)).toHaveText('5,678');
  await expect(rows.nth(1).locator('td').nth(3)).toHaveText('5 (arm64 3 · x64 2)');
  await expect(releases).not.toContainText('beta');
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatch(/^https:\/\/api\.github\.com\/repos\/grk-cmd\/t-w\/releases\?per_page=\d+$/);

  await releases.getByRole('button', { name: '새로고침' }).click();
  await expect.poll(() => calls.length).toBe(2);
});

test('릴리스 다운로드 — 요청 한도 · 실패는 짧게 알리고 다른 카드는 그대로', async ({ page, seed }) => {
  let status = 403;
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({ status, json: { message: 'API rate limit exceeded' } }),
  );
  await seed({ config: { minRoomVer: '1.4.2' } });
  await openMenu(page, 'settings');
  const releases = card(page, '릴리스 다운로드');
  await expect(releases.getByText('GitHub 요청 한도 — 잠시 뒤 새로고침')).toBeVisible();
  await expect(card(page, '방 입장 최소 버전').locator('code.key')).toHaveText('1.4.2');

  status = 500;
  await releases.getByRole('button', { name: '새로고침' }).click();
  await expect(releases.getByText('불러오지 못했어요')).toBeVisible();
});
