import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dbGet, dbSet } from './support/emulator';
import { openMenu, toast } from './support/ui';

const T0 = Date.UTC(2026, 0, 1);

// 계정 있음 3명(키 사용 중 · 회수된 키 · 키 없음) + 친구코드만 있는(계정 없음) 1명.
// 초대권 칸: 민수 2장 · 지영 0장 · 회수 998장 · 계정 없음은 칸 자체가 없다.
const DATA = {
  accountSnap: {
    uminsu0000001: { name: '김민수', friendCode: 'MATE-AAA1', license: 'LIVE-AAAA-AAAA-AAAA', ts: T0 + 3 },
    ujiyoung00002: { name: '박지영', friendCode: 'MATE-BBB2', ts: T0 + 2 },
    urevoked00003: { name: '이회수', friendCode: 'MATE-DDD4', license: 'DEAD-AAAA-AAAA-AAAA', ts: T0 + 1 },
  },
  friendCodes: {
    'MATE-AAA1': { userId: 'uminsu0000001' },
    'MATE-BBB2': { userId: 'ujiyoung00002' },
    'MATE-DDD4': { userId: 'urevoked00003' },
    'MATE-CCC3': { userId: 'unoacct000004' },
  },
  licenses: {
    'LIVE-AAAA-AAAA-AAAA': { valid: true, createdAt: T0, redeemedAt: T0 + 1 },
    'DEAD-AAAA-AAAA-AAAA': { valid: false, createdAt: T0 },
  },
  users: {
    uminsu0000001: { invite: { invitesLeft: 2 } },
    ujiyoung00002: { invite: { invitesLeft: 0 } },
    urevoked00003: { invite: { invitesLeft: 998 } },
    unoacct000004: { profile: { name: '계정없는이' } },
  },
};

const userRow = (page: Page, text: string) => page.locator('tbody tr').filter({ hasText: text });
const count = (page: Page, text: string) => expect(page.getByText(text, { exact: true })).toBeVisible();

test('목록 · 검색 · 필터 칩', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await count(page, '4 / 4명');
  await expect(userRow(page, '김민수')).toContainText('사용 중');
  await expect(userRow(page, '이회수')).toContainText('회수됨');
  // 계정 요약에 없는 사람은 이름 한 칸을 따로 읽어 채운다.
  await expect(userRow(page, 'MATE-CCC3')).toContainText('계정없는이');
  await expect(userRow(page, 'MATE-CCC3')).toContainText('계정 없음');
  // 최근 갱신 순 — 계정 없는 사람(갱신 기록 없음)이 맨 뒤.
  await expect(page.locator('tbody tr').first()).toContainText('김민수');
  await expect(page.locator('tbody tr').last()).toContainText('MATE-CCC3');

  const search = page.getByPlaceholder('이름 · 친구코드 · 사용자코드 · 키 검색');
  await search.fill('박지');
  await count(page, '1 / 4명');
  await expect(userRow(page, '박지영')).toBeVisible();
  await search.fill('live-aaaa');
  await count(page, '1 / 4명');
  await expect(userRow(page, '김민수')).toBeVisible();
  await search.fill('');

  const chips: [string, string[]][] = [
    ['라이선스 사용 중', ['김민수']],
    ['회수 · 없는 키', ['이회수']],
    ['라이선스 없음', ['박지영']],
    ['계정 없음', ['MATE-CCC3']],
  ];
  for (const [chip, names] of chips) {
    await page.getByRole('button', { name: chip, exact: true }).click();
    await count(page, `${names.length} / 4명`);
    for (const name of names) await expect(userRow(page, name)).toBeVisible();
  }
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await count(page, '4 / 4명');
});

test('한 명에게 초대권을 지급하면 invitesLeft 가 늘어난다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await userRow(page, '김민수').getByRole('button', { name: '초대권 지급' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('김민수 님에게 초대권 지급');
  await expect(dialog.getByText('지금 2장')).toBeVisible();
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('button', { name: '2장 지급' }).click();

  await expect(toast(page)).toHaveText('김민수 님에게 초대권 2장 지급 · 지금 4장');
  await expect(dialog).toBeHidden();
  expect(await dbGet('users/uminsu0000001/invite/invitesLeft')).toBe(4);
});

test('초대권 칸이 없는 계정에는 지급 버튼이 잠긴다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await userRow(page, 'MATE-CCC3').getByRole('button', { name: '초대권 지급' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('지금 초대권 칸 없음')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '1장 지급' })).toBeDisabled();
  await dialog.getByRole('button', { name: '취소' }).click();
  expect(await dbGet('users/unoacct000004/invite')).toBeNull();
});

test('전체 지급은 «전체 지급» 을 적어야 열리고, 칸 없는 사람 · 상한은 건너뛴다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await page.getByRole('button', { name: '전체 초대권 지급' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('전체 사용자에게 초대권 지급');
  await expect(dialog).toContainText('대상 4명');
  await dialog.getByRole('button', { name: '+' }).click();
  const go = dialog.getByRole('button', { name: '4명에게 2장씩 지급' });
  await expect(go).toBeDisabled();
  await dialog.getByPlaceholder('«전체 지급» 입력').fill('전체');
  await expect(go).toBeDisabled();
  await dialog.getByPlaceholder('«전체 지급» 입력').fill('전체 지급');
  await go.click();

  await expect(dialog.getByText('완료 · 3명 지급 · 1명 건너뜀')).toBeVisible();
  expect(await dbGet('users/uminsu0000001/invite/invitesLeft')).toBe(4);
  expect(await dbGet('users/ujiyoung00002/invite/invitesLeft')).toBe(2);
  // 999 에서 자른다 — 넘기면 규칙이 쓰기를 통째로 거부한다.
  expect(await dbGet('users/urevoked00003/invite/invitesLeft')).toBe(999);
  expect(await dbGet('users/unoacct000004/invite')).toBeNull();
});

test('지급 창을 연 뒤 본인이 초대권을 쓰면 그 값에 더한다 — 읽어 둔 값으로 덮지 않는다', async ({
  page,
  seed,
}) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await userRow(page, '김민수').getByRole('button', { name: '초대권 지급' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('지금 2장')).toBeVisible();
  // 창이 2장을 보여 준 뒤 본인이 1장을 썼다.
  await dbSet('users/uminsu0000001/invite/invitesLeft', 1);
  await dialog.getByRole('button', { name: '1장 지급' }).click();

  await expect(toast(page)).toHaveText('김민수 님에게 초대권 1장 지급 · 지금 2장');
  expect(await dbGet('users/uminsu0000001/invite/invitesLeft')).toBe(2);
});

test('선택 지급 — 고른 사람에게만, 상한 999 에서 자르고 칸 없는 사람은 건너뛴다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  for (const name of ['김민수', '이회수', 'MATE-CCC3']) {
    await page.getByRole('checkbox', { name: `${name} 선택` }).check();
  }
  await page.getByRole('button', { name: '선택 초대권 지급 (3)' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('선택한 3명에게 초대권 지급');
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('button', { name: '3명에게 2장씩 지급' }).click();

  await expect(dialog.getByText('완료 · 2명 지급 · 1명 건너뜀')).toBeVisible();
  expect(await dbGet('users/uminsu0000001/invite/invitesLeft')).toBe(4);
  expect(await dbGet('users/urevoked00003/invite/invitesLeft')).toBe(999);
  expect(await dbGet('users/ujiyoung00002/invite/invitesLeft')).toBe(0);
  expect(await dbGet('users/unoacct000004/invite')).toBeNull();

  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('0개 선택')).toBeVisible();
});
