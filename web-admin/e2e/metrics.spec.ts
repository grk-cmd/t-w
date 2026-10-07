import { expect, test } from './fixtures';
import { dbGetAs, signUpUser } from './support/emulator';
import { card, openMenu } from './support/ui';

const DAY = 24 * 60 * 60 * 1000;
// 함수(functions/daily-active.js)와 같은 서울 날짜 — 테스트가 도는 «오늘» 기준으로 넣는다.
const kst = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const users = (...codes: string[]) => Object.fromEntries(codes.map((c) => [c, true]));

function metricsData() {
  const now = Date.now();
  return {
    metrics: {
      daily: {
        [kst(now - 9 * DAY)]: { u: users('ua0000001', 'ub0000001', 'ue0000001'), visits: 4 },
        [kst(now - DAY)]: { u: users('ua0000001', 'uc0000001'), visits: 3 },
        [kst(now)]: { u: users('ua0000001', 'uc0000001', 'ud0000001'), visits: 7 },
      },
    },
  };
}

const stat = (page: import('@playwright/test').Page, label: string) =>
  page.locator('section[aria-label="접속 지표"] .card').filter({ hasText: label });

test('지표가 첫 메뉴이고 DAU · 방문 수 · WAU · MAU 를 보여 준다', async ({ page, seed }) => {
  await seed(metricsData());
  await page.goto('/admin/');
  await expect(page.getByRole('navigation').getByRole('button').first()).toHaveText(/지표/);

  await expect(stat(page, '오늘 DAU')).toContainText('3명');
  await expect(stat(page, '어제 DAU')).toContainText('2명');
  await expect(stat(page, '오늘 방문 수')).toContainText('7회');
  await expect(stat(page, 'WAU')).toContainText('3명'); // a · c · d (9일 전은 밖)
  await expect(stat(page, 'MAU')).toContainText('5명'); // a · b · c · d · e
  const chart = card(page, '최근 30일');
  await expect(chart).toContainText(
    `로그인 연결된 사용자 기준 · ${kst(Date.now() - 9 * 24 * 60 * 60 * 1000)}부터 기록`,
  );
  await expect(chart.getByRole('img')).toHaveCount(2);

  await chart.getByText('날짜별 숫자').click();
  const today = chart.locator('tbody tr').first();
  await expect(today).toContainText(kst(Date.now()));
  await expect(today).toContainText('3');
  await expect(today).toContainText('7');
  await expect(chart.locator('tbody tr')).toHaveCount(30);
});

test('기록이 없으면 0 과 «기록이 아직 없음»', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'metrics');
  await expect(stat(page, '오늘 DAU')).toContainText('0명');
  await expect(stat(page, 'MAU')).toContainText('0명');
  await expect(card(page, '최근 30일')).toContainText('로그인 연결된 사용자 기준 · 기록이 아직 없음');
});

test('사용자 키는 shallow 로만 받는다 — 날짜 노드를 통째로 받지 않는다', async ({ page, seed }) => {
  await seed(metricsData());
  const asked: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.port === '9000' && url.pathname.startsWith('/metrics'))
      asked.push(`${url.pathname} ${url.searchParams.get('shallow')}`);
  });
  await openMenu(page, 'metrics');
  await expect(stat(page, 'MAU')).toContainText('5명');
  expect(asked).toContain(`/metrics/daily/${kst(Date.now())}/u.json true`);
  expect(asked.every((line) => line.endsWith('/u.json true'))).toBe(true);
});

test('규칙: 관리자가 아니면 metrics 를 읽지 못한다', async ({ seed }) => {
  await seed(metricsData());
  const { idToken } = await signUpUser(`metrics-${Date.now()}@e2e.test`);
  expect(await dbGetAs(idToken, 'metrics')).toBe(401);
  expect(await dbGetAs(idToken, `metrics/daily/${kst(Date.now())}/visits`)).toBe(401);
});
