import { expect, test } from './fixtures';
import { openMenu } from './support/ui';

// 🎄 크리스마스(일회성) — 원본이 자체 서버(/v2/admin/xmas)라 e2e(API 없음 · firebase.ts E2E)에서는 «운영 관리자에서만» 안내만 본다.
// 서버 모양 · 그림 주소(Storage xmas/{id}.png) · 반송 · 지우기 요청은 tests/entities/xmas-event.test.ts · tests/features/xmas-moderate.test.ts.
test('API 가 없는 환경 — 맡긴 편지 · 신고 탭이 «운영 관리자에서만» 을 보인다(옛 RTDB 로 읽지 않는다)', async ({
  page,
  seed,
}) => {
  await seed({});
  await openMenu(page, 'xmas');
  await expect(page.getByText(/자체 서버 API 가 없어 크리스마스를 볼 수 없어요/).first()).toBeVisible();
  await page.getByRole('tab', { name: /신고/ }).click();
  await expect(page.getByText(/자체 서버 API 가 없어 크리스마스를 볼 수 없어요/).first()).toBeVisible();
});
