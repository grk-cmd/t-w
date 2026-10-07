import { expect, test } from './fixtures';

test('관리자로 들어가 왼쪽 메뉴가 모두 보인다', async ({ page, seed }) => {
  await seed();
  await page.goto('/admin/');
  for (const name of ['라이선스', '사용자', '신고', '공지', '설정', '방', '카탈로그', '지표']) {
    await expect(page.getByRole('navigation').getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
});
