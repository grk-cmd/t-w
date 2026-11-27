import { ADMIN_EMAIL, signInWithEmulatorPopup } from '../e2e/support/auth';
import { expect, test } from './fixtures';

const ME = 'GET /v2/admin/admins/me';

test('관리자로 들어가면 머리에 «API 판» 이 보이고 메뉴가 열린다', async ({ page, api }) => {
  await page.goto('/admin/');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('API 판');
  expect(api.requestsTo(ME).length).toBeGreaterThan(0);
});

test.describe('관리자가 아닌 계정', () => {
  test.use({ storageState: { cookies: [], origins: [] }, asAdmin: false });

  test('«관리자 계정이 아니에요» 와 «등록할 uid» 를 보이고 메뉴를 열지 않는다', async ({ page, api }) => {
    void api; // 가짜 서버를 세운다
    await page.goto('/admin/');
    await signInWithEmulatorPopup(page, 'outsider@e2e.test');

    await expect(page.getByRole('heading', { name: '관리자 계정이 아니에요' })).toBeVisible();
    await expect(page.getByText('등록할 uid:')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page.getByRole('button', { name: '구글 계정으로 로그인' })).toBeVisible();
  });
});

test.describe('서버가 안 될 때', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('닿지 못하면 관리자 화면을 열지 않고 «다시 시도» 를 보인다', async ({ page, api }) => {
    api.on(ME, { status: 503, code: 'SERVICE_UNAVAILABLE' });
    await page.goto('/admin/');
    await signInWithEmulatorPopup(page, ADMIN_EMAIL);

    await expect(page.getByRole('heading', { name: '서버에 연결하지 못했어요' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    api.on(ME, { data: { name: '관리자', grantedAt: 't', version: 1 } });
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('서버가 아직 옮기기 전(501)이면 «점검 뒤에 쓰는 판» 안내로 멈춘다', async ({ page, api }) => {
    api.on(ME, { status: 501, code: 'NOT_IMPLEMENTED' });
    await page.goto('/admin/');
    await signInWithEmulatorPopup(page, ADMIN_EMAIL);

    await expect(page.getByText('이 빌드는 점검 뒤에 쓰는 판이에요')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });
});
