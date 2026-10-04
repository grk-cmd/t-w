import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dbGet, dbSet } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

// rooms/{방} = { _meta, chatLog, {멤버id}: { lastSeen, … } } — 인원은 밑줄 키 · chatLog 를 뺀 키 수.
const room = (channel: string, members: Record<string, number> = {}) => ({
  _meta: { channel, host: 'uhost', ts: 1 },
  chatLog: { m1: { name: '손님', text: '안녕', ts: 1 } },
  ...Object.fromEntries(Object.entries(members).map(([id, lastSeen]) => [id, { lastSeen, name: id }])),
});

// roomIndex: 살아 있음 2개 · 유령 1개(90초 넘게 신호 없음).
// rooms 에만 있는 방: 고아(멤버 없음) 1개 · 옛 앱이 연 방(roomIndex 를 안 쓰지만 멤버가 살아 있음) 1개 · 시크릿룸 1개.
function roomData() {
  const now = Date.now();
  return {
    roomIndex: {
      'WORK-AAAA': { lastSeen: now, channel: 'workingroom' },
      'PLAY-BBBB': { lastSeen: now - 10_000, channel: 'togetherroom', open: true },
      'WORK-GHST': { lastSeen: now - 10 * 60_000, channel: 'workingroom' },
    },
    rooms: {
      'WORK-AAAA': room('workingroom', { u1: now, u2: now - 5_000 }),
      'PLAY-BBBB': room('togetherroom', { u3: now - 10_000 }),
      'WORK-GHST': room('workingroom'),
      'WORK-ORPH': room('workingroom'),
      'WORK-OLDC': room('workingroom', { u4: now - 3_000 }),
      'SCRT-ZZ99': room('togetherroom', { u5: now, u6: now }),
    },
  };
}

const roomRow = (page: Page, code: string) => page.locator('tbody tr').filter({ hasText: code });
const roomKeys = async () => Object.keys((await dbGet<Record<string, unknown>>('rooms')) ?? {}).sort();
const indexKeys = async () => Object.keys((await dbGet<Record<string, unknown>>('roomIndex')) ?? {}).sort();

test('열린 방 목록 — 인원 수, roomIndex 에 없는 고아 · 시크릿룸도 따로 표시', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');

  await expect(page.getByText('살아 있음 3 · 전체 5 · 시크릿룸 1')).toBeVisible();
  await expect(roomRow(page, 'WORK-AAAA')).toContainText('🟢 살아 있음');
  await expect(roomRow(page, 'WORK-AAAA')).toContainText('2명');
  await expect(roomRow(page, 'PLAY-BBBB')).toContainText('투게더룸');
  await expect(roomRow(page, 'PLAY-BBBB')).toContainText('🎲 공개');
  await expect(roomRow(page, 'PLAY-BBBB')).toContainText('1명');
  await expect(roomRow(page, 'WORK-GHST')).toContainText('👻 유령');
  await expect(roomRow(page, 'WORK-GHST')).toContainText('0명');
  await expect(roomRow(page, 'WORK-ORPH')).toContainText('👻 고아');
  // 옛 앱이 연 방 — roomIndex 에 없어도 멤버 신호가 살아 있으면 살아 있는 방이다.
  await expect(roomRow(page, 'WORK-OLDC')).toContainText('🟢 살아 있음');
  await expect(roomRow(page, 'SCRT-ZZ99')).toContainText('🔒 시크릿룸');
  await expect(roomRow(page, 'SCRT-ZZ99')).toContainText('2명');
  await expect(page.locator('tbody tr').last()).toContainText('SCRT-ZZ99');
  await expect(page.getByText('서버 집계 없음')).toBeVisible();
});

test('rooms 본체는 받지 않는다 — 방 코드 · 인원은 shallow 로만', async ({ page, seed }) => {
  await seed(roomData());
  const shallow: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.port === '9000' && url.pathname.startsWith('/rooms')) {
      shallow.push(
        `${url.pathname} ${url.searchParams.get('shallow') ?? ''} ${url.searchParams.has('auth')}`,
      );
    }
  });
  await openMenu(page, 'rooms');
  await expect(roomRow(page, 'WORK-AAAA')).toContainText('2명');
  expect(shallow).toContain('/rooms.json true true');
  expect(shallow).toContain('/rooms/WORK-AAAA.json true true');
  expect(shallow.every((line) => line.includes(' true '))).toBe(true);
});

test('유령 방 청소 — 고아 방까지 rooms · roomIndex 를 지우고, 살아 있는 방 · 시크릿룸은 남긴다', async ({
  page,
  seed,
}) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  const ghost = card(page, '🧹 유령 방 청소');
  await expect(ghost.getByText('대상 2개')).toBeVisible();
  await expect(ghost.locator('code')).toHaveText(['WORK-GHST', 'WORK-ORPH']);
  await ghost.getByRole('button', { name: '청소' }).click();

  await expect(toast(page)).toHaveText('유령 방 2개를 정리했어요');
  await expect(ghost.getByText('정리할 유령 방이 없어요')).toBeVisible();
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA']);
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'SCRT-ZZ99', 'WORK-AAAA', 'WORK-OLDC']);
});

test('유령 방 청소 — 보여 준 뒤 고아 방에 사람이 돌아오면 그 방은 남긴다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  const ghost = card(page, '🧹 유령 방 청소');
  await expect(ghost.getByText('대상 2개')).toBeVisible();
  await dbSet('rooms/WORK-ORPH/u9', { lastSeen: Date.now(), name: 'u9' });
  await ghost.getByRole('button', { name: '청소' }).click();

  await expect(toast(page)).toHaveText('유령 방 1개를 정리했어요 · 그새 다시 살아난 1개는 남겼어요');
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'SCRT-ZZ99', 'WORK-AAAA', 'WORK-OLDC', 'WORK-ORPH']);
});

test('목록에서 방 하나를 종료한다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  await roomRow(page, 'WORK-AAAA').getByRole('button', { name: '종료' }).click();

  await expect(toast(page)).toHaveText('WORK-AAAA 방을 종료했어요');
  await expect(roomRow(page, 'WORK-AAAA')).toHaveCount(0);
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-GHST']);
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'SCRT-ZZ99', 'WORK-GHST', 'WORK-OLDC', 'WORK-ORPH']);
});

test('선택 종료 — 고른 방만 한 묶음으로 닫는다(시크릿룸도 고를 수 있다)', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  await page.getByRole('checkbox', { name: 'PLAY-BBBB 선택' }).check();
  await page.getByRole('checkbox', { name: 'SCRT-ZZ99 선택' }).check();
  await page.getByRole('button', { name: '선택 종료 (2)' }).click();

  await expect(toast(page)).toHaveText('방 2개를 종료했어요');
  await expect(roomRow(page, 'PLAY-BBBB')).toHaveCount(0);
  await expect(roomRow(page, 'SCRT-ZZ99')).toHaveCount(0);
  await expect(page.getByText('0개 선택')).toBeVisible();
  expect(await indexKeys()).toEqual(['WORK-AAAA', 'WORK-GHST']);
  expect(await roomKeys()).toEqual(['WORK-AAAA', 'WORK-GHST', 'WORK-OLDC', 'WORK-ORPH']);
});

test('코드로 종료 — 코드만 아는 방을 닫는다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  const byCode = card(page, '코드로 방 종료');
  const close = byCode.getByRole('button', { name: '종료' });

  await byCode.getByPlaceholder('방 코드 (SCRT-AB12)').fill('rooms/../x');
  await expect(close).toBeDisabled();
  await byCode.getByPlaceholder('방 코드 (SCRT-AB12)').fill(' scrt-zz99 ');
  await close.click();

  await expect(toast(page)).toHaveText('SCRT-ZZ99 방을 종료했어요');
  await expect(byCode.getByPlaceholder('방 코드 (SCRT-AB12)')).toHaveValue('');
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA', 'WORK-GHST', 'WORK-OLDC', 'WORK-ORPH']);
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA', 'WORK-GHST']);
});

test('전체 종료 — «종료» 를 적어야 열리고, 앱처럼 시크릿룸 · 고아까지 모두 닫는다', async ({
  page,
  seed,
}) => {
  await seed(roomData());
  const asked: string[] = [];
  page.on('dialog', (d) => void asked.push(d.message()));
  await openMenu(page, 'rooms');
  const all = card(page, '🛑 전체 방 종료');
  await expect(all.getByText('대상 6개 (시크릿룸 1개 포함)')).toBeVisible();
  const go = all.getByRole('button', { name: '전체 종료' });
  await expect(go).toBeDisabled();
  await all.getByPlaceholder('종료').fill('종료');
  await go.click();

  await expect(toast(page)).toHaveText('방 6개를 종료했어요');
  expect(asked[0]).toContain('방 6개를 모두 종료할까요? (시크릿룸 1개 포함)');
  await expect(page.getByText('열린 방이 없어요')).toBeVisible();
  expect(await indexKeys()).toEqual([]);
  expect(await roomKeys()).toEqual([]);
});
