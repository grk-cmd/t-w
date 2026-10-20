import { adminUid, expect, test } from './fixtures';
import { dbGet, dbGetAs, dbSetAs, signUpUser } from './support/emulator';
import { card, openMenu, row } from './support/ui';

type LogRecord = { at: number; by: string; action: string; target: string; detail?: string };

const SERVER_TIME = { '.sv': 'timestamp' };
const DAY = 24 * 3600 * 1000;

test('키를 발급하면 같은 묶음에 기록이 남고 «🧾 기록» 에 보인다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'license');
  const issue = card(page, '새 키 발급');
  await issue.getByPlaceholder('메모').fill('카페 이벤트');
  await issue.getByRole('button', { name: '발급' }).click();
  await expect.poll(async () => Object.keys((await dbGet('licenses')) ?? {}).length).toBe(1);

  const [key] = Object.keys((await dbGet<Record<string, unknown>>('licenses'))!);
  const logs = Object.values((await dbGet<Record<string, LogRecord>>('adminLog')) ?? {});
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ by: adminUid(), action: 'license.issue', target: `${key.slice(0, 4)}-…` });
  expect(typeof logs[0].at).toBe('number');
  // 키 원문 · 메모는 기록에 남지 않는다.
  expect(JSON.stringify(logs)).not.toContain(key);
  expect(JSON.stringify(logs)).not.toContain('카페');

  await openMenu(page, 'log');
  const list = card(page, '관리자 작업 기록');
  const line = row(list, '키 발급');
  await expect(line).toContainText(`${key.slice(0, 4)}-…`);
  await expect(line).toContainText('나');

  await list.getByRole('button', { name: '공지' }).click();
  await expect(list.getByText('기록이 없어요')).toBeVisible();
  await list.getByRole('button', { name: '라이선스' }).click();
  await expect(row(list, '키 발급')).toBeVisible();
});

test('오래된 기록은 뒤쪽으로 갈 때만 더 받는다', async ({ page, seed }) => {
  const adminLog: Record<string, LogRecord> = {};
  for (let i = 1; i <= 25; i++)
    adminLog[`s${String(i).padStart(2, '0')}`] = {
      at: Date.UTC(2026, 0, 1) + i * 60_000,
      by: 'otheradminuid',
      action: 'room.close',
      target: `WORK-${String(i).padStart(4, '0')}`,
    };
  await seed({ adminLog });
  await page.addInitScript(() => localStorage.setItem('tw.admin.pageSize.adminLog', '20'));
  await openMenu(page, 'log');
  const list = card(page, '관리자 작업 기록');
  await expect(row(list, 'WORK-0025')).toContainText('othera…');
  await expect(list.getByText('총 20개+')).toBeVisible();
  await list.getByRole('button', { name: '다음' }).click();
  await expect(row(list, 'WORK-0001')).toBeVisible();
  await expect(list.getByText('총 25개', { exact: true })).toBeVisible();
});

test.describe('규칙', () => {
  test('관리자만 새로 쓰고 읽는다 · 이미 있는 기록은 못 고친다 · 최근 기록은 못 지운다', async ({ seed }) => {
    const admin = await signUpUser(`log-admin-${Date.now()}@e2e.test`);
    const outsider = await signUpUser(`log-out-${Date.now()}@e2e.test`);
    const old = { at: Date.now() - 100 * DAY, by: admin.uid, action: 'room.close', target: 'OLD' };
    await seed({ admins: { [adminUid()]: true, [admin.uid]: true }, adminLog: { old } });
    const entry = { at: SERVER_TIME, by: admin.uid, action: 'room.close', target: 'WORK-AB12' };

    // 비관리자 — 쓰기 · 읽기 거절
    expect(await dbSetAs(outsider.idToken, 'adminLog/x1', { ...entry, by: outsider.uid })).toBe(401);
    expect(await dbGetAs(outsider.idToken, 'adminLog')).toBe(401);

    // 관리자 — 새로 쓰기 · 읽기
    expect(await dbSetAs(admin.idToken, 'adminLog/a1', entry)).toBe(200);
    expect(await dbGetAs(admin.idToken, 'adminLog')).toBe(200);
    // 이미 있는 기록은 고치지도 지우지도 못한다(최근 것)
    expect(await dbSetAs(admin.idToken, 'adminLog/a1', { ...entry, target: '바꿈' })).toBe(401);
    expect(await dbSetAs(admin.idToken, 'adminLog/a1', null)).toBe(401);
    // 기기 시각 · 남의 uid · 정해진 칸 밖 필드는 거절
    expect(await dbSetAs(admin.idToken, 'adminLog/a2', { ...entry, at: Date.now() })).toBe(401);
    expect(await dbSetAs(admin.idToken, 'adminLog/a3', { ...entry, by: adminUid() })).toBe(401);
    expect(await dbSetAs(admin.idToken, 'adminLog/a4', { ...entry, email: 'x@y' })).toBe(401);
    // 90일 지난 기록은 정리할 수 있다
    expect(await dbSetAs(admin.idToken, 'adminLog/old', null)).toBe(200);

    const left = (await dbGet<Record<string, LogRecord>>('adminLog')) ?? {};
    expect(Object.keys(left)).toEqual(['a1']);
    expect(left.a1.target).toBe('WORK-AB12');
  });

  test('초대 코드 목록은 관리자만 읽고, 코드 하나는 누구나 읽는다', async ({ seed }) => {
    const admin = await signUpUser(`inv-admin-${Date.now()}@e2e.test`);
    const outsider = await signUpUser(`inv-out-${Date.now()}@e2e.test`);
    await seed({
      admins: { [adminUid()]: true, [admin.uid]: true },
      invites: { 'INVT-AAAA-AAAA': { issuedBy: 'u1', createdAt: 1 } },
    });
    expect(await dbGetAs(admin.idToken, 'invites')).toBe(200);
    expect(await dbGetAs(outsider.idToken, 'invites')).toBe(401);
    expect(await dbGetAs(outsider.idToken, 'invites/INVT-AAAA-AAAA')).toBe(200);
  });
});
