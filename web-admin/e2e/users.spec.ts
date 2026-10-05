import type { Locator, Page } from '@playwright/test';
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
    uminsu0000001: {
      invite: { invitesLeft: 2, joinedAt: Date.UTC(2026, 8, 10, 3) },
      presence: { online: true, lastSeen: T0 },
    },
    ujiyoung00002: {
      invite: { invitesLeft: 0, invitedBy: 'uminsu0000001', joinedAt: Date.UTC(2026, 9, 3, 3) },
    },
    urevoked00003: { invite: { invitesLeft: 998 } },
    unoacct000004: { profile: { name: '계정없는이' }, presence: { online: false, lastSeen: T0 + 60_000 } },
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
  // 마지막 접속은 presence — 계정이 없어도 보이고, 접속 중이면 시각 대신 «접속 중».
  await expect(userRow(page, 'MATE-CCC3')).toContainText(new RegExp(`2026-01-01 \\d{2}:01`));
  await expect(userRow(page, '김민수')).toContainText('접속 중');
  await expect(userRow(page, '박지영')).toContainText('—');
  // 가입 — 초대한 사람이 없으면 «기존», 있으면 «초대». 칸이 없으면(옛 앱) «—».
  await expect(userRow(page, '김민수')).toContainText('2026-09-10 기존 · 초대권 2장');
  await expect(userRow(page, '박지영')).toContainText('2026-10-03 초대 · 초대권 0장');
  // 최근 갱신 순 — 계정 없는 사람(갱신 기록 없음)이 맨 뒤.
  await expect(page.locator('tbody tr').first()).toContainText('김민수');
  await expect(page.locator('tbody tr').last()).toContainText('MATE-CCC3');

  const search = page.getByPlaceholder('이름 · 친구코드 · 사용자코드 · 키');
  const go = () => page.getByRole('button', { name: '검색', exact: true }).click();
  // 글자는 «검색» 을 눌러야 걸린다.
  await search.fill('박지');
  await count(page, '4 / 4명');
  await go();
  await count(page, '1 / 4명');
  await expect(userRow(page, '박지영')).toBeVisible();
  await search.fill('live-aaaa');
  await go();
  await count(page, '1 / 4명');
  await expect(userRow(page, '김민수')).toBeVisible();

  // 기간 — 가입일 10월은 지영만(민수는 9월 · 나머지는 기록 없음), 마지막 접속 2026-01-01 은 민수 · 계정없는이.
  await search.fill('');
  await page.getByLabel('시작일').fill('2026-10-01');
  await page.getByLabel('종료일').fill('2026-10-31');
  await go();
  await count(page, '1 / 4명');
  await expect(userRow(page, '박지영')).toBeVisible();
  await page.getByLabel('기간 기준').selectOption('seen');
  await page.getByLabel('시작일').fill('2026-01-01');
  await page.getByLabel('종료일').fill('2026-01-01');
  await go();
  await count(page, '2 / 4명');
  await page.getByRole('button', { name: '초기화' }).click();

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

test('키 중복 — 같은 키를 쓰는 사람끼리 모아 보이고, 라이선스 칸에 사용자 수', async ({ page, seed }) => {
  // 민수의 키를 소문자 · 공백 섞어 쓰는 사람 하나를 더한다 — 계정 요약의 키는 정규화해 맞춘다.
  await seed({
    ...DATA,
    accountSnap: {
      ...DATA.accountSnap,
      ushare0000005: { name: '최공유', friendCode: 'MATE-EEE5', license: ' live-aaaa-aaaa-aaaa ', ts: T0 },
    },
  });
  await openMenu(page, 'users');

  await count(page, '5 / 5명');
  // 다른 칩에서도 중복 키를 쓰는 줄에만 표시된다.
  await expect(userRow(page, '김민수')).toContainText('2명 사용');
  await expect(userRow(page, '최공유')).toContainText('2명 사용');
  await expect(userRow(page, '이회수')).not.toContainText('명 사용');

  await page.getByRole('button', { name: '키 중복', exact: true }).click();
  await count(page, '2 / 5명');
  await expect(page.locator('tbody tr').first()).toContainText('김민수');
  await expect(page.locator('tbody tr').last()).toContainText('최공유');

  // 검색 · 선택도 함께 — 좁혀도 중복 표시는 목록 전체 기준.
  await page.getByPlaceholder('이름 · 친구코드 · 사용자코드 · 키').fill('최공');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await count(page, '1 / 5명');
  await expect(userRow(page, '최공유')).toContainText('2명 사용');
  await page.getByRole('checkbox', { name: '최공유 선택' }).check();
  await expect(page.getByText('1개 선택')).toBeVisible();
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
  await expect(userRow(page, '김민수')).toContainText('초대권 4장');
});

test('초대권 칸이 없는 계정에는 지급 버튼이 잠긴다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await userRow(page, 'MATE-CCC3').getByRole('button', { name: '초대권 지급' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('지금 초대 정보 없음')).toBeVisible();
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

test('초대 코드 만들기 — 고른 개수만큼 invites 에 생기고, 이미 있는 코드는 건드리지 않는다', async ({
  page,
  seed,
}) => {
  await seed({ ...DATA, invites: { 'INVT-KEEP-KEEP': { issuedBy: 'u1', createdAt: 1, usedBy: 'u2' } } });
  await openMenu(page, 'users');

  await page.getByRole('button', { name: '초대 코드 만들기' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('button', { name: '3개 만들기' }).click();

  const codes = dialog.getByRole('list', { name: '만든 초대 코드' }).getByRole('listitem');
  await expect(codes).toHaveCount(3);
  const made = await codes.allInnerTexts();
  for (const code of made) {
    expect(code).toMatch(/^INVT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(await dbGet(`invites/${code}`)).toMatchObject({ issuedBy: 'admin' });
  }
  expect(await dbGet('invites/INVT-KEEP-KEEP')).toMatchObject({ usedBy: 'u2' });
});

// 상세 창의 한 칸 — «라벨» 바로 옆 값.
const field = (scope: Locator, label: string) => scope.locator(`dt:text-is("${label}") + dd`);

test('이름을 누르면 상세 창 — 칸마다 그 사람 몫만 읽어 보여 주고, 같은 키 · 초대한 사람으로 건너간다', async ({
  page,
  seed,
}) => {
  const away = 'https://firebasestorage.googleapis.com/v0/b/demo-tw.appspot.com/o/away%2Fm.png?alt=media';
  const exp = Date.UTC(2099, 0, 1, 3);
  await seed({
    ...DATA,
    accountSnap: {
      ...DATA.accountSnap,
      ushare0000005: { name: '최공유', friendCode: 'MATE-EEE5', license: 'LIVE-AAAA-AAAA-AAAA', ts: T0 },
    },
    users: {
      ...DATA.users,
      uminsu0000001: {
        ...DATA.users.uminsu0000001,
        presence: { online: true, lastSeen: T0, room: 'WORK-ROOM' },
        focus: { totalSec: 5400 },
        awayImg: away,
        secretRoom: 'SCRT-MINS',
      },
    },
    reports: {
      uminsu0000001: {
        ur1: { kind: 'nick', nick: 'a', code4: '1', ts: 1 },
        ur2: { kind: 'char', nick: 'b', code4: '2', ts: 2 },
      },
    },
    secretRooms: { 'SCRT-MINS': { k: 'x', pub: { owner: 'uminsu0000001', ts: T0, exp } } },
  });
  await openMenu(page, 'users');

  await userRow(page, '박지영').getByRole('button', { name: '박지영' }).click();
  let detail = page.getByRole('dialog', { name: '박지영 상세' });
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText('박지영');
  await expect(field(detail, '사용자코드')).toContainText('ujiyoung00002');
  await expect(field(detail, '계정')).toHaveText('있음');
  await expect(field(detail, '키')).toHaveText('—');
  await expect(field(detail, '가입일')).toContainText('2026-10-03');
  await expect(field(detail, '받은 신고')).toHaveText('0명');
  await expect(field(detail, '자리비움 그림')).toHaveText('없음');
  await expect(field(detail, '코드')).toHaveText('—');
  // 초대한 사람(사용자코드)은 이름으로 — 누르면 그 사람으로 바뀐다.
  await expect(field(detail, '경로')).toHaveText('초대 · 김민수');
  await field(detail, '경로').getByRole('button', { name: '김민수' }).click();

  detail = page.getByRole('dialog', { name: '김민수 상세' });
  await expect(field(detail, '친구코드')).toHaveText('MATE-AAA1');
  await expect(field(detail, '키')).toContainText('LIVE-AAAA-AAAA-AAAA');
  await expect(field(detail, '키')).toContainText('사용 중');
  await expect(field(detail, '같은 키')).toHaveText('1명최공유');
  await expect(field(detail, '마지막 접속')).toHaveText('접속 중 · WORK-ROOM');
  await expect(field(detail, '집중')).toHaveText('1.5시간');
  await expect(field(detail, '경로')).toHaveText('기존');
  await expect(field(detail, '초대권')).toContainText('2장');
  await expect(field(detail, '받은 신고')).toHaveText('2명');
  await expect(field(detail, '자리비움 그림').getByRole('img')).toHaveAttribute('src', away);
  await expect(field(detail, '코드')).toHaveText('SCRT-MINS2099-01-01 까지');

  await field(detail, '같은 키').getByRole('button', { name: '최공유' }).click();
  detail = page.getByRole('dialog', { name: '최공유 상세' });
  await expect(field(detail, '같은 키')).toHaveText('1명김민수');
  // invite 칸이 없는 사람(옛 앱)은 가입 기록 없음.
  await expect(field(detail, '가입')).toHaveText('기록 없음');

  await detail.getByRole('button', { name: '닫기' }).click();
  await expect(detail).toBeHidden();
});

test('계정 없는 사람 · 관리자 초대 — 이름은 따로 읽고, 경로는 «관리자»', async ({ page, seed }) => {
  await seed({
    ...DATA,
    users: {
      ...DATA.users,
      unoacct000004: {
        ...DATA.users.unoacct000004,
        invite: { invitesLeft: 0, invitedBy: 'admin', joinedAt: T0 },
      },
    },
  });
  await openMenu(page, 'users');

  await userRow(page, 'MATE-CCC3').getByRole('button', { name: '계정없는이' }).click();
  const detail = page.getByRole('dialog', { name: 'MATE-CCC3 상세' });
  await expect(field(detail, '이름')).toHaveText('계정없는이');
  await expect(field(detail, '계정')).toHaveText('없음');
  await expect(field(detail, '경로')).toHaveText('초대 · 관리자');
  await expect(field(detail, '마지막 접속')).toContainText('2026-01-01');

  // 폰 폭에서는 화면을 꽉 채운다.
  await page.setViewportSize({ width: 375, height: 700 });
  await expect.poll(async () => (await detail.boundingBox())?.width).toBe(375);
});

test('상세 창에서 초대권을 지급하면 창과 목록이 함께 갱신된다', async ({ page, seed }) => {
  await seed(DATA);
  await openMenu(page, 'users');

  await userRow(page, '김민수').getByRole('button', { name: '김민수' }).click();
  const detail = page.getByRole('dialog', { name: '김민수 상세' });
  await expect(field(detail, '초대권')).toContainText('2장');
  await field(detail, '초대권').getByRole('button', { name: '초대권 지급' }).click();

  const grant = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: '김민수 님에게 초대권 지급' }) });
  await expect(grant.getByText('지금 2장')).toBeVisible();
  await grant.getByRole('button', { name: '1장 지급' }).click();

  await expect(toast(page)).toHaveText('김민수 님에게 초대권 1장 지급 · 지금 3장');
  await expect(grant).toBeHidden();
  // 지급 창이 닫혀도 상세 창은 그대로 남는다.
  await expect(detail).toBeVisible();
  await expect(field(detail, '초대권')).toContainText('3장');
  expect(await dbGet('users/uminsu0000001/invite/invitesLeft')).toBe(3);
  await detail.getByRole('button', { name: '닫기' }).click();
  await expect(userRow(page, '김민수')).toContainText('초대권 3장');
});
