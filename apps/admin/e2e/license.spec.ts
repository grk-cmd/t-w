import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

type License = { valid: boolean; note?: string; createdAt: number; redeemedAt?: number; revokedAt?: number };
type InboxMessage = { tag: string; title: string; body: string; ts: number; read: boolean };
type Request = { name: string; friendCode: string; status: string; issuedKey?: string; approvedAt?: number };

const KEY_RE = /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/;
const T0 = Date.UTC(2026, 0, 1);

const licenses = async () => (await dbGet<Record<string, License>>('licenses')) ?? {};
const inbox = async (uid: string) =>
  Object.values((await dbGet<Record<string, InboxMessage>>(`inbox/${uid}`)) ?? {});

// 수령함 메시지는 키 발급과 한 묶음이다 — 본문에 그 키가 그대로 들어 있어야 앱에서 옮겨 적을 수 있다.
function expectGrantMessage(messages: InboxMessage[], key: string) {
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ tag: 'reward', title: '🎫 라이선스가 도착했어요', read: false });
  expect(messages[0].body).toContain(key);
}

const USER = {
  friendCodes: { 'MATE-AB12': { userId: 'ua1b2c3d4e5f6' } },
  users: { ua1b2c3d4e5f6: { profile: { name: '철수' } } },
};

// 60번이 가장 최근, 'SEED-9999…' 가 가장 오래된 키(목록 맨 끝).
function manyLicenses(n: number): Record<string, License> {
  const seeded: Record<string, License> = {};
  for (let i = 1; i <= n; i++) {
    const id = String(i).padStart(4, '0');
    seeded[`SEED-${id}-AAAA-AAAA`] = { valid: true, note: `묶음 ${id}`, createdAt: T0 + i };
  }
  seeded['SEED-9999-ZZZZ-ZZZZ'] = { valid: true, note: '특별 후원', createdAt: T0 };
  return seeded;
}

const licenseList = (page: Page) =>
  page.locator('section.card').filter({ has: page.getByPlaceholder('키 · 메모로 검색') });
const currentPage = (scope: Locator) => scope.locator('button[aria-current="page"]');

test.describe('발급된 키', () => {
  test('새 키를 메모와 함께 발급하면 목록과 DB 에 생긴다', async ({ page, seed }) => {
    await seed();
    await openMenu(page, 'license');
    const issue = card(page, '새 키 발급');
    await issue.getByPlaceholder('메모').fill('카페 이벤트');
    await issue.getByRole('button', { name: '발급' }).click();

    const shown = issue.locator('code.key');
    await expect(shown).toHaveText(KEY_RE);
    const key = (await shown.textContent())!;
    await expect(issue.getByPlaceholder('메모')).toHaveValue('');

    const all = await licenses();
    expect(Object.keys(all)).toEqual([key]);
    expect(all[key]).toMatchObject({ valid: true, note: '카페 이벤트' });
    expect(typeof all[key].createdAt).toBe('number');
    await expect(row(page, key)).toContainText('⬜ 미사용');
    await expect(row(page, key)).toContainText('카페 이벤트');
  });

  test('메모로 검색하고 50개씩 쪽을 넘긴다', async ({ page, seed }) => {
    await seed({ licenses: manyLicenses(60) });
    await openMenu(page, 'license');
    const list = licenseList(page);

    await expect(page.getByText('61 / 61건')).toBeVisible();
    await expect(list.getByText('총 61개')).toBeVisible();
    await expect(currentPage(list)).toHaveText('1');
    // 최근 발급(createdAt 큰 것)부터 — 첫 쪽에 60번, 둘째 쪽 맨 끝에 가장 오래된 키.
    await expect(row(page, 'SEED-0060-AAAA-AAAA')).toBeVisible();
    await expect(row(page, 'SEED-9999-ZZZZ-ZZZZ')).toHaveCount(0);

    await list.getByRole('button', { name: '다음' }).click();
    await expect(currentPage(list)).toHaveText('2');
    await expect(row(page, 'SEED-9999-ZZZZ-ZZZZ')).toBeVisible();
    await expect(page.locator('.list .row')).toHaveCount(11);

    // 검색하면 첫 쪽으로 돌아간다. 한 쪽뿐이면 쪽 이동은 숨고 총 개수 · 개수 선택은 남는다.
    await page.getByPlaceholder('키 · 메모로 검색').fill('특별');
    await expect(page.getByText('1 / 61건')).toBeVisible();
    await expect(page.locator('.list .row')).toHaveCount(1);
    await expect(list.getByRole('navigation', { name: '쪽 이동' })).toHaveCount(0);
    await expect(list.getByText('총 1개')).toBeVisible();
    await expect(list.getByRole('combobox', { name: '페이지당 개수' })).toBeVisible();

    await page.getByPlaceholder('키 · 메모로 검색').fill('없는메모');
    await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
  });

  test('페이지당 개수를 바꾸면 쪽이 다시 나뉘고, 고른 개수는 다시 열어도 남는다', async ({ page, seed }) => {
    await seed({ licenses: manyLicenses(140) });
    await openMenu(page, 'license');
    const list = licenseList(page);
    const size = list.getByRole('combobox', { name: '페이지당 개수' });
    const rows = page.locator('.list .row');

    await expect(size).toHaveValue('50');
    await expect(rows).toHaveCount(50);
    await list.getByRole('button', { name: '3쪽' }).click();
    await expect(currentPage(list)).toHaveText('3');
    await expect(rows).toHaveCount(41);

    // 20개씩 — 보던 첫 줄(101번째)이 있는 6쪽으로, 쪽이 많으면 줄여서 보인다.
    await size.selectOption('20');
    await expect(currentPage(list)).toHaveText('6');
    await expect(rows).toHaveCount(20);
    const nav = list.getByRole('navigation', { name: '쪽 이동' });
    await expect(nav.getByRole('button', { name: /^\d+쪽$/ })).toHaveText(['1', '4', '5', '6', '7', '8']);
    await expect(nav.getByText('…')).toHaveCount(1);
    await nav.getByRole('button', { name: '8쪽' }).click();
    await expect(rows).toHaveCount(1);
    await expect(row(page, 'SEED-9999-ZZZZ-ZZZZ')).toBeVisible();
    await expect(nav.getByRole('button', { name: '다음' })).toBeDisabled();
    await nav.getByRole('button', { name: '이전' }).click();
    await expect(currentPage(list)).toHaveText('7');

    expect(await page.evaluate(() => localStorage.getItem('tw.admin.pageSize.licenses'))).toBe('20');
    await page.reload();
    await expect(list.getByRole('combobox', { name: '페이지당 개수' })).toHaveValue('20');
    await expect(rows).toHaveCount(20);
    await expect(currentPage(list)).toHaveText('1');
  });

  test('좁은 화면에서도 페이저가 화면 밖으로 넘치지 않는다', async ({ page, seed }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await seed({ licenses: manyLicenses(200) });
    await openMenu(page, 'license');
    const list = licenseList(page);
    await list.getByRole('combobox', { name: '페이지당 개수' }).selectOption('20');
    await list.getByRole('button', { name: '5쪽' }).click();
    await list.getByRole('button', { name: '6쪽' }).click();
    // 1 … 5 6 7 … 11 — 가장 칸이 많은 모양.
    await expect(list.getByRole('navigation', { name: '쪽 이동' }).getByText('…')).toHaveCount(2);
    for (const name of ['이전', '다음', '1쪽', '11쪽']) {
      const box = (await list.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    const sizeBox = (await list.getByRole('combobox', { name: '페이지당 개수' }).boundingBox())!;
    expect(sizeBox.x + sizeBox.width).toBeLessThanOrEqual(360);
  });

  test('회수하면 valid:false 가 되고, 회수된 키만 지울 수 있다', async ({ page, seed }) => {
    const key = 'REVK-AAAA-BBBB-CCCC';
    await seed({
      licenses: {
        [key]: { valid: true, note: '회수할 키', createdAt: T0 + 2 },
        'KEEP-AAAA-BBBB-CCCC': { valid: true, note: '남길 키', createdAt: T0 + 1 },
      },
    });
    await openMenu(page, 'license');
    await expect(row(page, key).getByRole('button', { name: '삭제' })).toHaveCount(0);

    await row(page, key).getByRole('button', { name: '회수' }).click();
    await expect(toast(page)).toHaveText('회수했어요');
    await expect(row(page, key)).toContainText('🚫 회수됨');
    const revoked = (await licenses())[key];
    expect(revoked).toMatchObject({ valid: false, note: '회수할 키' });
    expect(typeof revoked.revokedAt).toBe('number');

    await row(page, key).getByRole('button', { name: '삭제' }).click();
    await expect(toast(page)).toHaveText('삭제했어요');
    await expect(row(page, key)).toHaveCount(0);
    expect(Object.keys(await licenses())).toEqual(['KEEP-AAAA-BBBB-CCCC']);
  });

  test('선택 회수 · 선택 삭제 — 고른 키만, 이미 회수된 키는 회수에서 · 살아 있는 키는 삭제에서 뺀다', async ({
    page,
    seed,
  }) => {
    await seed({
      licenses: {
        'LIVE-AAAA-AAAA-AAAA': { valid: true, note: '하나', createdAt: T0 + 4 },
        'LIVE-BBBB-BBBB-BBBB': { valid: true, note: '둘', createdAt: T0 + 3 },
        'DEAD-CCCC-CCCC-CCCC': { valid: false, note: '셋', createdAt: T0 + 2, revokedAt: T0 },
        'KEEP-DDDD-DDDD-DDDD': { valid: true, note: '남길 키', createdAt: T0 + 1 },
      },
    });
    await openMenu(page, 'license');
    const pick = (key: string) => page.getByRole('checkbox', { name: `${key} 선택` }).check();

    await pick('LIVE-AAAA-AAAA-AAAA');
    await pick('LIVE-BBBB-BBBB-BBBB');
    await pick('DEAD-CCCC-CCCC-CCCC');
    await expect(page.getByRole('button', { name: '선택 삭제 (1)' })).toBeVisible();
    await page.getByRole('button', { name: '선택 회수 (2)' }).click();
    await expect(toast(page)).toHaveText('2개 회수했어요');
    await expect(page.getByText('0개 선택')).toBeVisible();
    await expect(row(page, 'LIVE-BBBB-BBBB-BBBB')).toContainText('🚫 회수됨');
    let all = await licenses();
    expect(all['LIVE-AAAA-AAAA-AAAA']).toMatchObject({ valid: false, note: '하나' });
    expect(all['LIVE-BBBB-BBBB-BBBB'].valid).toBe(false);
    expect(all['KEEP-DDDD-DDDD-DDDD'].valid).toBe(true);

    await pick('LIVE-AAAA-AAAA-AAAA');
    await pick('DEAD-CCCC-CCCC-CCCC');
    await pick('KEEP-DDDD-DDDD-DDDD');
    await expect(page.getByRole('button', { name: '선택 회수 (1)' })).toBeVisible();
    await page.getByRole('button', { name: '선택 삭제 (2)' }).click();
    await expect(toast(page)).toHaveText('2개 삭제했어요');
    await expect(row(page, 'DEAD-CCCC-CCCC-CCCC')).toHaveCount(0);
    all = await licenses();
    expect(Object.keys(all).sort()).toEqual(['KEEP-DDDD-DDDD-DDDD', 'LIVE-BBBB-BBBB-BBBB']);
    expect(all['KEEP-DDDD-DDDD-DDDD'].valid).toBe(true);
  });

  test('통계 카드는 가입 수와 사용 · 미사용 · 회수 개수를 보인다', async ({ page, seed }) => {
    await seed({
      stats: { userCount: 1234 },
      licenses: {
        'UNUS-AAAA-AAAA-AAAA': { valid: true, createdAt: T0 },
        'UNUS-BBBB-BBBB-BBBB': { valid: true, createdAt: T0 },
        'USED-AAAA-AAAA-AAAA': { valid: true, createdAt: T0, redeemedAt: T0 + 1 },
        'REVK-AAAA-AAAA-AAAA': { valid: false, createdAt: T0, redeemedAt: T0 + 1 },
      },
    });
    await openMenu(page, 'license');
    const stats = page.getByRole('region', { name: '전체 통계' });
    await expect(stats).toContainText('1,234명');
    await expect(stats).toContainText('👑 사용 중인 키1개');
    await expect(stats).toContainText('🎟️ 발급된 키4개');
    await expect(stats).toContainText('사용 1 · 미사용 2 · 회수 1');
  });
});

test.describe('친구코드로 발급', () => {
  test('뒤 4자리만 넣어도 키와 수령함 메시지를 한 묶음으로 쓴다', async ({ page, seed }) => {
    await seed(USER);
    await openMenu(page, 'license');
    const grant = card(page, '친구코드로 발급');
    await grant.getByPlaceholder('친구코드 (MATE-XXXX)').fill('ab12');
    await grant.getByRole('button', { name: '보내기' }).click();

    await expect(grant.getByText('철수 님의 수령함으로 보냈어요')).toBeVisible();
    const all = await licenses();
    const keys = Object.keys(all);
    expect(keys).toHaveLength(1);
    expect(all[keys[0]]).toMatchObject({ valid: true, note: '철수 · 친구코드 MATE-AB12' });
    expectGrantMessage(await inbox('ua1b2c3d4e5f6'), keys[0]);
    // 발급 직후 목록도 새로 받는다.
    await expect(row(page, keys[0])).toBeVisible();
  });

  test('주인이 없는 코드면 아무것도 쓰지 않는다', async ({ page, seed }) => {
    await seed(USER);
    await openMenu(page, 'license');
    const grant = card(page, '친구코드로 발급');
    await grant.getByPlaceholder('친구코드 (MATE-XXXX)').fill('MATE-ZZ99');
    await grant.getByRole('button', { name: '보내기' }).click();

    await expect(grant.getByText('이 친구코드를 가진 사용자를 찾지 못했어요')).toBeVisible();
    expect(await dbGet('licenses')).toBeNull();
    expect(await dbGet('inbox')).toBeNull();
  });
});

test.describe('대기 중인 요청', () => {
  const REQUESTS = {
    ...USER,
    friendCodes: { ...USER.friendCodes, 'MATE-CD34': { userId: 'ucd34ef56gh78' } },
    licenseRequests: {
      r1: { name: '영희', friendCode: 'MATE-AB12', status: 'pending', requestedAt: T0 + 1 },
      r2: { name: '민수', friendCode: 'MATE-CD34', status: 'pending', requestedAt: T0 + 2, ver: '0.10.3' },
      r3: { name: '지민', friendCode: 'MATE-EF56', status: 'pending', requestedAt: T0 + 3 },
      done: { name: '끝난 요청', friendCode: 'MATE-AB12', status: 'approved', requestedAt: T0 },
    },
  };

  const openRequests = async (page: import('@playwright/test').Page) => {
    await openMenu(page, 'license');
    const tab = page.getByRole('tab', { name: /대기 중인 요청/ });
    // 다른 탭을 보고 있어도 대기 건수(pending 만)가 배지로 보인다.
    await expect(tab).toHaveText('대기 중인 요청3');
    await tab.click();
  };

  test('한 건 발급하면 요청이 approved + issuedKey 가 되고 수령함으로 간다', async ({ page, seed }) => {
    await seed(REQUESTS);
    await openRequests(page);
    await expect(row(page, '끝난 요청')).toHaveCount(0);
    // 앱 버전 — 보낸 요청에 있으면 보이고, 옛 앱 요청은 없다.
    await expect(row(page, '민수')).toContainText('v0.10.3');
    await expect(row(page, '영희')).not.toContainText('v0.');

    await row(page, '영희').getByRole('button', { name: '발급' }).click();
    await expect(toast(page)).toHaveText('영희 님에게 발급했어요 · 수령함으로 보냈어요');
    await expect(row(page, '영희')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /대기 중인 요청/ })).toHaveText('대기 중인 요청2');

    const req = (await dbGet<Request>('licenseRequests/r1'))!;
    expect(req.status).toBe('approved');
    expect(req.issuedKey).toMatch(KEY_RE);
    expect(typeof req.approvedAt).toBe('number');
    expect((await licenses())[req.issuedKey!]).toMatchObject({
      valid: true,
      note: '요청: 영희 · 친구코드 MATE-AB12',
    });
    expectGrantMessage(await inbox('ua1b2c3d4e5f6'), req.issuedKey!);
  });

  test('두 건을 골라 선택 발급한다 — 주인 없는 코드는 키만 나간다', async ({ page, seed }) => {
    await seed(REQUESTS);
    await openRequests(page);

    await page.getByRole('checkbox', { name: '민수 선택' }).check();
    await page.getByRole('checkbox', { name: '지민 선택' }).check();
    await page.getByRole('button', { name: '선택 발급 (2)' }).click();
    await expect(toast(page)).toHaveText('2건 발급 · 그중 1건은 수령함으로 못 보냄');
    await expect(page.locator('.list .row').filter({ hasText: /민수|지민/ })).toHaveCount(0);

    const all = (await dbGet<Record<string, Request>>('licenseRequests'))!;
    expect(all.r1.status).toBe('pending');
    for (const id of ['r2', 'r3']) {
      expect(all[id].status).toBe('approved');
      expect((await licenses())[all[id].issuedKey!]).toBeTruthy();
    }
    expect(Object.keys(await licenses())).toHaveLength(2);
    expectGrantMessage(await inbox('ucd34ef56gh78'), all.r2.issuedKey!);
  });

  test('쪽을 넘겨도 선택은 남고, 이 쪽 전체 선택은 이 쪽만 고른다', async ({ page, seed }) => {
    const licenseRequests: Record<string, object> = {};
    for (let i = 1; i <= 25; i++) {
      const n = String(i).padStart(2, '0');
      licenseRequests[`p${n}`] = {
        name: `요청${n}`,
        friendCode: 'MATE-EF56',
        status: 'pending',
        requestedAt: T0 + i,
      };
    }
    await seed({ licenseRequests });
    await openMenu(page, 'license');
    await page.getByRole('tab', { name: /대기 중인 요청/ }).click();
    const rows = page.locator('.list .row');
    const pageSize = page.getByRole('combobox', { name: '페이지당 개수' });

    await pageSize.selectOption('20');
    await expect(rows).toHaveCount(20);
    await page.getByRole('checkbox', { name: '이 쪽 전체 선택' }).check();
    await expect(page.getByText('20개 선택')).toBeVisible();

    await page.getByRole('button', { name: '2쪽' }).click();
    await expect(rows).toHaveCount(5);
    // 번호는 목록 전체 순번으로 이어진다.
    await expect(rows.first()).toContainText('21');
    await expect(page.getByRole('checkbox', { name: '이 쪽 전체 선택' })).not.toBeChecked();
    await page.getByRole('checkbox', { name: '이 쪽 전체 선택' }).check();
    await expect(page.getByText('25개 선택')).toBeVisible();
    await page.getByRole('checkbox', { name: '이 쪽 전체 선택' }).uncheck();
    await expect(page.getByText('20개 선택')).toBeVisible();
    await expect(page.getByRole('button', { name: '선택 발급 (20)' })).toBeVisible();
  });

  test('거절하면 요청을 지운다(다시 요청할 수 있게)', async ({ page, seed }) => {
    await seed(REQUESTS);
    await openRequests(page);
    await row(page, '지민').getByRole('button', { name: '거절' }).click();
    await expect(toast(page)).toHaveText('거절했어요');
    await expect(row(page, '지민')).toHaveCount(0);
    expect(await dbGet('licenseRequests/r3')).toBeNull();
    expect(await dbGet('licenses')).toBeNull();
  });
});
