import { expect, test } from './fixtures';
import { dbGetAs, signUpUser } from './support/emulator';
import { openMenu } from './support/ui';

const DAY = 24 * 60 * 60 * 1000;
const GB = 2 ** 30;
// 함수(functions/usage-snapshot.js)와 같은 서울 날짜 — 테스트가 도는 «오늘» 기준으로 넣는다.
const kst = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function usageDay(at: number, sentGB: number, calls: number) {
  return {
    db: { sentBytes: sentGB * GB, storedBytes: 2 * GB, peakConnections: 40, at },
    functions: { calls, byName: { roomStats: calls - 10, visitPing: 10 }, at },
    hosting: { sentBytes: 5 * 2 ** 20, at },
  };
}

// 지난날 다섯은 하루 1GB, 어제 3GB(평균의 2배 넘음), 오늘 0.5GB. Storage 기록은 없다.
function usageData() {
  const now = Date.now();
  const daily: Record<string, unknown> = {};
  for (let i = 2; i <= 6; i++) daily[kst(now - i * DAY)] = usageDay(now - i * DAY, 1, 1440);
  daily[kst(now - DAY)] = usageDay(now - DAY, 3, 1440);
  daily[kst(now)] = usageDay(now, 0.5, 600);
  return { metrics: { usage: daily } };
}

const stat = (page: import('@playwright/test').Page, section: string, label: string) =>
  page
    .locator(`section[aria-label="${section}"] > div > div`)
    .filter({ has: page.getByText(label, { exact: true }) });
const DB = 'DB 다운로드';
const FN = '함수 호출';
const ST = 'Storage';
const STORE = 'DB 저장 용량 · 최대 동시 접속';

test('사용량은 «성능 · 비용» 묶음에서 지표 바로 뒤 메뉴이고, 다운로드 · 함수 · 저장 용량 · 추정 금액을 보여 준다', async ({
  page,
  seed,
}) => {
  await seed(usageData());
  await page.goto('/admin/');
  const menu = page
    .getByRole('navigation')
    .getByRole('group', { name: '📊 성능 · 비용' })
    .getByRole('button');
  await expect(menu.nth(0)).toHaveText(/지표/);
  await expect(menu.nth(1)).toHaveText(/사용량/);
  await openMenu(page, 'usage');

  await expect(page.getByText('금액은 추정')).toBeVisible();
  const month = page.locator('section[aria-label="이번 달 예상 청구액"]');
  await expect(month).toContainText('추정 $');
  await expect(month.locator('tr')).toHaveCount(6);
  await expect(stat(page, DB, '오늘')).toContainText('0.5GB');
  await expect(stat(page, DB, '어제')).toContainText('3GB');
  await expect(stat(page, DB, '어제')).toContainText('추정 $3.00');
  await expect(stat(page, DB, '일평균')).toContainText('1GB');
  await expect(stat(page, DB, '일평균')).toContainText('한 달 추정 $30.00');
  await expect(stat(page, DB, '최대')).toContainText('3GB');

  await expect(stat(page, FN, '어제')).toContainText('1,440회');
  await expect(stat(page, FN, '최근 30일 합')).toContainText('9,240회'); // 1,440 × 6 + 600
  await expect(stat(page, FN, '최근 30일 합')).toContainText('무료 한도 안');
  await expect(page.locator(`section[aria-label="${FN}"]`)).toContainText(
    '어제 함수별: roomStats 1,430 · visitPing 10',
  );

  await expect(stat(page, ST, '오늘 다운로드')).toContainText('–');
  await expect(stat(page, ST, '저장 용량')).toContainText('–');

  await expect(stat(page, STORE, 'DB 저장 용량')).toContainText('2GB');
  await expect(stat(page, STORE, 'DB 저장 용량')).toContainText('한 달 추정 $5.00'); // (2 - 무료 1) × $5
  await expect(stat(page, STORE, '30일 최대')).toContainText('40개');
  await expect(page.getByRole('img', { name: /최근 30일/ })).toHaveCount(4);
});

test('어제 다운로드가 지난날 일평균의 2배를 넘으면 그 칸이 빨갛고 한 줄 경고가 뜬다', async ({
  page,
  seed,
}) => {
  await seed(usageData());
  await openMenu(page, 'usage');
  await expect(stat(page, DB, '어제')).toHaveAttribute('data-alert', 'true');
  await expect(stat(page, DB, '일평균')).not.toHaveAttribute('data-alert', 'true');
  const section = page.locator(`section[aria-label="${DB}"]`);
  await expect(section.getByRole('alert')).toContainText('DB 다운로드 평소보다 많음');
  await expect(section.getByRole('alert')).toContainText('어제(3 GB)');
  await expect(page.locator(`section[aria-label="${ST}"]`).getByRole('alert')).toHaveCount(0);
});

test('평소와 비슷하면 경고가 없다', async ({ page, seed }) => {
  const data = usageData();
  const now = Date.now();
  (data.metrics.usage as Record<string, unknown>)[kst(now - DAY)] = usageDay(now - DAY, 1.5, 1440);
  (data.metrics.usage as Record<string, unknown>)[kst(now)] = usageDay(now, 0.01, 10);
  await seed(data);
  await openMenu(page, 'usage');
  await expect(stat(page, DB, '어제')).toContainText('1.5GB');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('기록이 없으면 – 와 «기록이 아직 없음»', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'usage');
  await expect(page.locator(`section[aria-label="${DB}"]`)).toContainText('기록이 아직 없음');
  await expect(stat(page, DB, '오늘')).toContainText('–');
  await expect(stat(page, FN, '최근 30일 합')).toContainText('무료 한도 안');
});

test('규칙: 관리자가 아니면 metrics/usage 를 읽지 못한다', async ({ seed }) => {
  await seed(usageData());
  const { idToken } = await signUpUser(`usage-${Date.now()}@e2e.test`);
  expect(await dbGetAs(idToken, 'metrics/usage')).toBe(401);
  expect(await dbGetAs(idToken, `metrics/usage/${kst(Date.now())}/db`)).toBe(401);
});
