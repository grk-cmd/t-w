import { adminUid, expect, test } from './fixtures';
import { dbGet, dbGetAs, dbSetAs, signUpUser } from './support/emulator';
import { card, openMenu, row } from './support/ui';

const PROD_URL = 'wss://rooms.togetherworking.duckdns.org';

const actions = async () =>
  Object.values((await dbGet<Record<string, { action: string; target: string }>>('adminLog')) ?? {}).map(
    (l) => `${l.action}:${l.target}`,
  );

test('방 서버 — 스위치 · 서버 목록 · 방 개수 상한 · 사용자별 서버 · 기록', async ({ page, seed }) => {
  await seed({
    friendCodes: { 'MATE-AB12': { userId: 'u1abc2345' }, 'MATE-CD34': { userId: 'u2abc2345' } },
    users: { u1abc2345: { profile: { name: '철수' } }, u2abc2345: { profile: { name: '영희' } } },
    accountSnap: {
      u1abc2345: { license: 'ABCD-EFGH-JKLM-NPQR', friendCode: 'MATE-AB12', ver: '0.10.3' },
      // 버전을 안 올리는 옛 앱(0.10.2 이하) — 서버를 못 고른다
      u2abc2345: { friendCode: 'MATE-CD34' },
    },
    licenses: { 'ABCD-EFGH-JKLM-NPQR': { valid: true, createdAt: 1, redeemedAt: 2 } },
  });
  await openMenu(page, 'roomServer');

  // 스위치 — «방 서버 사용» 하나뿐(따라가기는 켜져 있으면 늘)
  const sw = card(page, '스위치');
  await expect(sw.getByLabel('방 따라가기')).toHaveCount(0);
  await sw.getByLabel('방 서버 사용').click();
  await expect(sw.getByText('방 서버 사용 켜짐')).toBeVisible();
  expect(await dbGet('config/roomServer/on')).toBe(true);

  // 서버 목록 — 형식 검사 · 추가 · CSP 밖 주소 표시
  const servers = card(page, '서버 목록');
  await expect(servers.getByLabel('서버 이름')).toHaveAttribute('placeholder', /realtime-/);
  await servers.getByLabel('서버 이름').fill('realtime-1');
  await servers.getByLabel('서버 주소').fill('https://x.example');
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(servers.getByText('주소는 wss://호스트[:포트] 형식')).toBeVisible();
  await servers.getByLabel('서버 주소').fill(PROD_URL);
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(servers.getByText('저장 · realtime-1')).toBeVisible();
  await servers.getByLabel('서버 이름').fill('lab');
  await servers.getByLabel('서버 주소').fill('wss://lab.example');
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(row(servers, 'lab')).toContainText('앱이 안 씀');
  expect(await dbGet('config/roomServer/servers')).toEqual({
    'realtime-1': PROD_URL,
    lab: 'wss://lab.example',
  });

  // 방 개수 상한 — 칸이 없으면 기본 250 · 범위 검사 · 저장
  const limits = card(page, '방 개수 상한');
  await expect(limits.getByLabel('워킹룸 상한')).toHaveValue('250');
  await limits.getByLabel('워킹룸 상한').fill('0');
  await limits.getByRole('button', { name: '저장' }).click();
  await expect(limits.getByText('워킹룸 — 1~100000 사이 정수')).toBeVisible();
  await limits.getByLabel('워킹룸 상한').fill('400');
  await limits.getByRole('button', { name: '저장' }).click();
  await expect(limits.getByText('저장 · 1분 안에 서버에 반영')).toBeVisible();
  expect(await dbGet('config/roomServer/limits')).toEqual({ workingroom: 400, togetherroom: 250 });

  // 기본 서버 · 비율 — 처음엔 «없음» · 범위 검사 · 저장 · 기본 서버는 못 뺀다
  const dflt = card(page, '기본 서버 · 비율');
  await expect(dflt.getByText('허용 목록에 없는 사람도 이 비율만큼 기본 서버에 방을 열어요')).toBeVisible();
  await expect(dflt.getByLabel('기본 서버')).toHaveValue('');
  await expect(dflt.getByLabel('비율 %')).toBeDisabled();
  await dflt.getByLabel('기본 서버').selectOption('realtime-1');
  await dflt.getByLabel('비율 %').fill('150');
  await dflt.getByRole('button', { name: '저장' }).click();
  await expect(dflt.getByText('비율 — 0~100 사이 정수')).toBeVisible();
  await dflt.getByRole('button', { name: '10', exact: true }).click();
  await expect(dflt.getByLabel('비율 %')).toHaveValue('10');
  await dflt.getByRole('button', { name: '저장' }).click();
  await expect(dflt.getByText('저장 · realtime-1 10%')).toBeVisible();
  expect(await dbGet('config/roomServer/default')).toBe('realtime-1');
  expect(await dbGet('config/roomServer/defaultPercent')).toBe(10);
  await row(servers, 'realtime-1').getByRole('button', { name: '빼기' }).click();
  await expect(
    servers.getByText('realtime-1 은 기본 서버 — 먼저 «기본 서버 · 비율» 에서 바꾸기'),
  ).toBeVisible();
  await dflt.getByLabel('기본 서버').selectOption('');
  await dflt.getByRole('button', { name: '저장' }).click();
  await expect(dflt.getByText('저장 · 기본 서버 없음')).toBeVisible();
  expect(await dbGet('config/roomServer/default')).toBeNull();
  expect(await dbGet('config/roomServer/defaultPercent')).toBeNull();

  // 사용자별 서버 — 옛 앱은 서버를 못 고른다(Firebase(기본)만)
  const users = card(page, '사용자별 서버');
  await users.getByLabel('사용자 찾기').fill('cd34');
  await expect(users.getByText('앱 업데이트 필요 (현재 0.10.2 이하)')).toBeVisible();
  await expect(users.getByLabel('영희(MATE-CD34) 서버').locator('option[value="realtime-1"]')).toBeDisabled();

  // 목록에서 찾아 드롭다운으로 지정
  await users.getByLabel('사용자 찾기').fill('ab12');
  const pick = users.getByLabel('철수(MATE-AB12) 서버');
  await expect(pick).toHaveValue('');
  await expect(users.locator('tr', { hasText: 'MATE-AB12' })).toContainText('0.10.3');
  await pick.selectOption('realtime-1');
  await expect(users.getByText('철수(MATE-AB12) → realtime-1')).toBeVisible();
  expect(await dbGet('config/roomServer/allow')).toEqual({ u1abc2345: 'realtime-1' });

  // 지정된 사용자 목록에 바로 보인다
  const allow = card(page, /서버로 지정된 사용자/);
  await expect(row(allow, 'u1abc2345')).toContainText('철수');
  await expect(row(allow, 'u1abc2345')).toContainText('🔑 라이선스');

  // 쓰는 서버는 못 뺀다
  await row(servers, 'realtime-1').getByRole('button', { name: '빼기' }).click();
  await expect(servers.getByText('realtime-1 을 쓰는 시범 이용자 1명 — 먼저 옮기거나 빼기')).toBeVisible();

  await row(allow, 'u1abc2345').getByLabel('철수(u1abc2345) 서버').selectOption('lab');
  await expect(allow.getByText('철수(u1abc2345) → lab')).toBeVisible();
  expect(await dbGet('config/roomServer/allow/u1abc2345')).toBe('lab');
  await row(allow, 'u1abc2345').getByLabel('철수(u1abc2345) 서버').selectOption('');
  await expect(allow.getByText('없음 — 아래 사용자 목록에서 서버를 고르면 여기에 나온다')).toBeVisible();
  expect(await dbGet('config/roomServer/allow')).toBeNull();

  await sw.getByLabel('방 서버 사용').click();
  await expect(sw.getByText('방 서버 사용 꺼짐')).toBeVisible();
  expect(await dbGet('config/roomServer/on')).toBe(false);

  expect(await actions()).toEqual(
    expect.arrayContaining([
      'roomServer.switch:on',
      'roomServer.server:realtime-1',
      'roomServer.server:lab',
      'roomServer.limits:limits',
      'roomServer.default:default',
      'roomServer.allow:u1abc2345',
      'roomServer.allowDelete:u1abc2345',
    ]),
  );
});

test('방 서버 — 규칙: 칸 하나씩만 공개 · 쓰기는 관리자만 · 모양 검사 · roomDir 은 앱이 못 씀', async ({
  seed,
}) => {
  const admin = await signUpUser(`rs-admin-${Date.now()}@e2e.test`);
  const user = await signUpUser(`rs-user-${Date.now()}@e2e.test`);
  await seed({
    admins: { [adminUid()]: true, [admin.uid]: true },
    config: {
      minRoomVer: '0.10.2',
      roomServer: {
        on: true,
        follow: false,
        servers: { 'rooms-1': PROD_URL },
        allow: { u1abc2345: 'rooms-1' },
        limits: { workingroom: 300 },
      },
    },
    roomDir: { 'WORK-AB12': { srv: 'rooms-1', ts: 1 } },
  });
  // 앱이 읽는 칸 — 누구나
  for (const p of [
    'config/minRoomVer',
    'config/roomServer/on',
    'config/roomServer/follow',
    'config/roomServer/allow/u1abc2345',
    'config/roomServer/servers/rooms-1',
    'config/roomServer/limits',
    'config/roomServer/limits/workingroom',
    'roomDir/WORK-AB12',
  ])
    expect(await dbGetAs(user.idToken, p), p).toBe(200);
  // 목록 통째 — 일반 사용자는 거절
  for (const p of [
    'config',
    'config/roomServer',
    'config/roomServer/allow',
    'config/roomServer/servers',
    'roomDir',
  ])
    expect(await dbGetAs(user.idToken, p), p).toBe(401);
  expect(await dbGetAs(admin.idToken, 'config/roomServer')).toBe(200);

  // 쓰기 — 일반 사용자 거절 · 관리자는 모양이 맞을 때만
  expect(await dbSetAs(user.idToken, 'config/roomServer/allow/u2abc2345', 'rooms-1')).toBe(401);
  expect(await dbSetAs(user.idToken, 'roomDir/WORK-ZZ99', { srv: 'rooms-1', ts: 1 })).toBe(401);
  expect(await dbSetAs(admin.idToken, 'roomDir/WORK-ZZ99', { srv: 'rooms-1', ts: 1 })).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/allow/u2abc2345', 'rooms-1')).toBe(200);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/allow/u2abc2345', 'Rooms 1')).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/allow/MATE-AB12', 'rooms-1')).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/servers/rooms-2', 'https://x.example')).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/servers/rooms-2', 'ws://127.0.0.1:8787')).toBe(200);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/on', 'yes')).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/extra', true)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/allow/u2abc2345', null)).toBe(200);
  // 방 개수 상한 — 관리자만 · 채널마다 정수 1~100000 · 모르는 칸 거절
  expect(await dbSetAs(user.idToken, 'config/roomServer/limits/workingroom', 400)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/limits/workingroom', 400)).toBe(200);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/limits/togetherroom', 100000)).toBe(200);
  for (const bad of [0, 100001, 2.5, '300'])
    expect(await dbSetAs(admin.idToken, 'config/roomServer/limits/workingroom', bad), String(bad)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/limits/secret', 10)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/limits', null)).toBe(200);
  // 기본 서버 · 비율 — 누구나 한 칸 읽기 · 관리자만 · 이름 형식 · 정수 0~100
  for (const p of ['config/roomServer/default', 'config/roomServer/defaultPercent'])
    expect(await dbGetAs(user.idToken, p), p).toBe(200);
  expect(await dbSetAs(user.idToken, 'config/roomServer/default', 'rooms-1')).toBe(401);
  expect(await dbSetAs(user.idToken, 'config/roomServer/defaultPercent', 10)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/default', 'rooms-1')).toBe(200);
  for (const bad of ['Rooms 1', 'a'.repeat(33), 7])
    expect(await dbSetAs(admin.idToken, 'config/roomServer/default', bad), String(bad)).toBe(401);
  for (const ok of [0, 100, 37])
    expect(await dbSetAs(admin.idToken, 'config/roomServer/defaultPercent', ok), String(ok)).toBe(200);
  for (const bad of [-1, 101, 2.5, '50', true])
    expect(await dbSetAs(admin.idToken, 'config/roomServer/defaultPercent', bad), String(bad)).toBe(401);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/defaultPercent', null)).toBe(200);
  expect(await dbSetAs(admin.idToken, 'config/roomServer/default', null)).toBe(200);
});
