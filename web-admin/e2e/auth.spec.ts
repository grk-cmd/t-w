import { adminUid, expect, test } from './fixtures';
import { signInWithEmulatorPopup } from './support/auth';
import { dbGet, dbSet, dbSetAs, signUpUser } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

test.describe('관리자가 아닌 계정', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('로그인하면 «등록할 uid» 를 보여 주고 막는다', async ({ page, seed }) => {
    await seed();
    await page.goto('/admin/');
    await signInWithEmulatorPopup(page, 'outsider@e2e.test');

    const denied = page.getByText(/등록할 uid: /);
    await expect(denied).toBeVisible();
    await expect(denied).toContainText('outsider@e2e.test 은(는) 관리자로 등록된 계정이 아니에요');
    const uid = (await denied.textContent())!.match(/등록할 uid: (\S+)/)![1];
    expect(uid).not.toBe(adminUid());
    // 막힌 뒤에는 로그인 화면에 머문다 — 메뉴도 로그아웃 버튼도 없다.
    await expect(page.getByRole('button', { name: '구글 계정으로 로그인' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('규칙이 관리자 아닌 계정의 쓰기를 거부한다', async ({ seed }) => {
    await seed();
    const { idToken } = await signUpUser(`writer-${Date.now()}@e2e.test`);
    const now = Date.now();

    expect(await dbSetAs(idToken, 'licenses/AAAA-BBBB-CCCC-DDDD', { valid: true, createdAt: now })).toBe(401);
    expect(await dbSetAs(idToken, 'inboxBroadcast/b1', { tag: 'notice', title: 't', ts: now })).toBe(401);
    expect(await dbSetAs(idToken, 'announce/current', { text: 'x', ts: now, duration: 1 })).toBe(401);
    expect(await dbGet('licenses')).toBeNull();
    expect(await dbGet('inboxBroadcast')).toBeNull();
    expect(await dbGet('announce')).toBeNull();
  });
});

test('로그아웃하면 로그인 화면으로 돌아간다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'license');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '구글 계정으로 로그인' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('화면을 연 뒤 관리자에서 빠지면 쓰기가 규칙에 막히고 «권한이 없어요» 를 알린다', async ({
  page,
  seed,
}) => {
  await seed();
  await openMenu(page, 'license');
  await expect(page.getByText('아직 발급된 키가 없어요')).toBeVisible();

  await dbSet(`admins/${adminUid()}`, null);
  const issue = card(page, '새 키 발급');
  await issue.getByPlaceholder('메모').fill('거부될 키');
  await issue.getByRole('button', { name: '발급' }).click();

  await expect(toast(page)).toHaveText('권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요');
  expect(await dbGet('licenses')).toBeNull();
});
