import { adminUid, expect, test } from './fixtures';
import { dbGet, dbGetAs, dbSetAs, signUpUser } from './support/emulator';
import { card, openMenu, row } from './support/ui';

const PROD_URL = 'wss://rooms.togetherworking.duckdns.org';

const actions = async () =>
  Object.values((await dbGet<Record<string, { action: string; target: string }>>('adminLog')) ?? {}).map(
    (l) => `${l.action}:${l.target}`,
  );

test('방 서버 — 스위치 · 서버 목록 · 시범 이용자(친구 코드로) · 기록', async ({ page, seed }) => {
  await seed({
    friendCodes: { 'MATE-AB12': { userId: 'u1abc2345' } },
    users: { u1abc2345: { profile: { name: '철수' } } },
    accountSnap: { u1abc2345: { license: 'ABCD-EFGH-JKLM-NPQR' } },
    licenses: { 'ABCD-EFGH-JKLM-NPQR': { valid: true, createdAt: 1, redeemedAt: 2 } },
  });
  await openMenu(page, 'roomServer');

  // 스위치
  const sw = card(page, '스위치');
  await sw.getByLabel('방 서버 사용').click();
  await expect(sw.getByText('방 서버 사용 켜짐')).toBeVisible();
  expect(await dbGet('config/roomServer/on')).toBe(true);
  await sw.getByLabel('방 따라가기').click();
  await expect(sw.getByText('방 따라가기 켜짐')).toBeVisible();
  expect(await dbGet('config/roomServer/follow')).toBe(true);

  // 서버 목록 — 형식 검사 · 추가 · CSP 밖 주소 표시
  const servers = card(page, '서버 목록');
  await servers.getByLabel('서버 이름').fill('rooms-1');
  await servers.getByLabel('서버 주소').fill('https://x.example');
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(servers.getByText('주소는 wss://호스트[:포트] 형식')).toBeVisible();
  await servers.getByLabel('서버 주소').fill(PROD_URL);
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(servers.getByText('저장 · rooms-1')).toBeVisible();
  await servers.getByLabel('서버 이름').fill('lab');
  await servers.getByLabel('서버 주소').fill('wss://lab.example');
  await servers.getByRole('button', { name: '저장' }).click();
  await expect(row(servers, 'lab')).toContainText('앱이 안 씀');
  expect(await dbGet('config/roomServer/servers')).toEqual({ 'rooms-1': PROD_URL, lab: 'wss://lab.example' });

  // 시범 이용자 — 친구 코드 뒤 4자리로 추가 · 이름 · 서버 바꾸기 · 빼기
  const allow = card(page, '시범 이용자');
  await allow.getByLabel('사용자 코드 또는 친구 코드').fill('ZZ99');
  await allow.getByRole('button', { name: '추가' }).click();
  await expect(allow.getByText('없는 코드 — 사용자 코드(u…) 또는 친구 코드')).toBeVisible();
  await allow.getByLabel('사용자 코드 또는 친구 코드').fill('ab12');
  await allow.getByLabel('서버', { exact: true }).selectOption('rooms-1');
  await allow.getByRole('button', { name: '추가' }).click();
  await expect(allow.getByText('추가 · MATE-AB12 (u1abc2345) → rooms-1')).toBeVisible();
  await expect(row(allow, 'u1abc2345')).toContainText('철수');
  await expect(row(allow, 'u1abc2345')).toContainText('🔑 라이선스');
  await expect(allow).toContainText('투게더룸을 열려면 라이선스 필요 — 명단은 어디에 열지만 정함');
  expect(await dbGet('config/roomServer/allow')).toEqual({ u1abc2345: 'rooms-1' });

  // 쓰는 서버는 못 뺀다
  await row(servers, 'rooms-1').getByRole('button', { name: '빼기' }).click();
  await expect(servers.getByText('rooms-1 을 쓰는 시범 이용자 1명 — 먼저 옮기거나 빼기')).toBeVisible();

  await row(allow, 'u1abc2345').getByLabel('u1abc2345 서버').selectOption('lab');
  await expect(allow.getByText('바꿈 · u1abc2345 → lab')).toBeVisible();
  expect(await dbGet('config/roomServer/allow/u1abc2345')).toBe('lab');
  await row(allow, 'u1abc2345').getByRole('button', { name: '빼기' }).click();
  await expect(allow.getByText('명단 없음')).toBeVisible();
  expect(await dbGet('config/roomServer/allow')).toBeNull();

  await sw.getByLabel('방 서버 사용').click();
  await expect(sw.getByText('방 서버 사용 꺼짐')).toBeVisible();
  expect(await dbGet('config/roomServer/on')).toBe(false);

  expect(await actions()).toEqual(
    expect.arrayContaining([
      'roomServer.switch:on',
      'roomServer.switch:follow',
      'roomServer.server:rooms-1',
      'roomServer.server:lab',
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
});
