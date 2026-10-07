import { expect, test } from './fixtures';
import { dbGetAs, signUpUser } from './support/emulator';
import { card, openMenu } from './support/ui';

const DAY = 24 * 60 * 60 * 1000;
// 함수(functions/daily-active.js)와 같은 서울 날짜 — 테스트가 도는 «오늘» 기준으로 넣는다.
const kst = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const users = (...codes: string[]) => Object.fromEntries(codes.map((c) => [c, true]));
// IP 해시 키(functions/visit-ping.js 는 16자 16진수) — 화면은 키 수만 센다.
const ips = (n: number, from = 0) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [(from + i).toString(16).padStart(16, '0'), true]));

function metricsData() {
  const now = Date.now();
  return {
    metrics: {
      daily: {
        [kst(now - 9 * DAY)]: { u: users('ua0000001', 'ub0000001', 'ue0000001'), visits: 4 },
        [kst(now - DAY)]: { u: users('ua0000001', 'uc0000001'), visits: 3, ip: ips(6), pings: 8 },
        [kst(now)]: {
          u: users('ua0000001', 'uc0000001', 'ud0000001'),
          visits: 7,
          ip: ips(4, 100),
          pings: 12,
        },
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
  await expect(stat(page, '오늘 방문자(IP 기준)')).toContainText('4명');
  await expect(stat(page, '어제 방문자(IP 기준)')).toContainText('6명');
  const chart = card(page, '최근 30일');
  await expect(chart).toContainText(
    `로그인 연결된 사용자 기준 · ${kst(Date.now() - 9 * 24 * 60 * 60 * 1000)}부터 기록`,
  );
  await expect(chart).toContainText(
    `IP 기준 방문자: 같은 IP 는 하루 1번 · IP 원문은 저장하지 않음 · ${kst(Date.now() - DAY)}부터`,
  );
  await expect(chart.getByRole('img')).toHaveCount(3);

  await chart.getByText('날짜별 숫자').click();
  const today = chart.locator('tbody tr').first();
  await expect(today.locator('td')).toHaveText([kst(Date.now()), '3', '7', '4', '12']);
  await expect(chart.locator('tbody tr').nth(1).locator('td')).toHaveText([
    kst(Date.now() - DAY),
    '2',
    '3',
    '6',
    '8',
  ]);
  await expect(chart.locator('tbody tr')).toHaveCount(30);
});

test('지난날 요약(metrics/summary)이 있으면 목록 없이도 숫자가 나온다 — 그날 IP 목록은 받지 않는다', async ({
  page,
  seed,
}) => {
  const now = Date.now();
  const d2 = kst(now - 2 * DAY);
  await seed({
    metrics: {
      summary: { [d2]: { dau: 40, ipVisitors: 55, visits: 70, pings: 90, wau: 41, mau: 42, at: now - DAY } },
      daily: { [kst(now)]: { u: users('ua0000001'), visits: 1, ip: ips(2), pings: 2 } },
    },
  });
  const asked: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.port === '9000' && url.pathname.startsWith('/metrics')) asked.push(url.pathname);
  });
  await openMenu(page, 'metrics');
  const chart = card(page, '최근 30일');
  await chart.getByText('날짜별 숫자').click();
  await expect(chart.locator('tbody tr').nth(2).locator('td')).toHaveText([d2, '40', '70', '55', '90']);
  await expect(chart).toContainText(`로그인 연결된 사용자 기준 · ${d2}부터 기록`);
  await expect(chart).toContainText(`· ${d2}부터`);
  expect(asked).not.toContain(`/metrics/daily/${d2}/ip.json`);
  expect(asked).toContain(`/metrics/daily/${d2}/u.json`); // 사용자 목록은 WAU · MAU 때문에 받는다
});

test('기록이 없으면 0 과 «기록이 아직 없음»', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'metrics');
  await expect(stat(page, '오늘 DAU')).toContainText('0명');
  await expect(stat(page, 'MAU')).toContainText('0명');
  await expect(card(page, '최근 30일')).toContainText('로그인 연결된 사용자 기준 · 기록이 아직 없음');
});

test('사용자 · IP 키는 shallow 로만 받는다 — 날짜 노드를 통째로 받지 않는다', async ({ page, seed }) => {
  await seed(metricsData());
  const asked: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.port === '9000' && url.pathname.startsWith('/metrics'))
      asked.push(`${url.pathname} ${url.searchParams.get('shallow')}`);
  });
  await openMenu(page, 'metrics');
  await expect(stat(page, 'MAU')).toContainText('5명');
  await expect(stat(page, '오늘 방문자(IP 기준)')).toContainText('4명');
  const today = kst(Date.now());
  expect(asked).toContain(`/metrics/daily/${today}/u.json true`);
  expect(asked).toContain(`/metrics/daily/${today}/ip.json true`);
  // 목록(u · ip)은 shallow 로만 — 그 밖에 HTTP 로 오는 건 없다(숫자 칸 · 요약은 SDK 웹소켓으로 한 칸씩)
  expect(asked.every((line) => /\/(u|ip)\.json true$/.test(line))).toBe(true);
});

test('규칙: 관리자가 아니면 metrics 를 읽지 못한다', async ({ seed }) => {
  await seed(metricsData());
  const { idToken } = await signUpUser(`metrics-${Date.now()}@e2e.test`);
  expect(await dbGetAs(idToken, 'metrics')).toBe(401);
  expect(await dbGetAs(idToken, `metrics/daily/${kst(Date.now())}/visits`)).toBe(401);
});
