import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

const room = (channel: string) => ({
  _meta: { channel, host: 'uhost', ts: 1 },
  chatLog: { m1: { name: '손님', text: '안녕', ts: 1 } },
});

// 살아 있음 2개 · 유령 1개(90초 넘게 신호 없음) + roomIndex 에 안 적히는 시크릿룸 1개.
function roomData() {
  const now = Date.now();
  return {
    roomIndex: {
      'WORK-AAAA': { lastSeen: now, channel: 'workingroom' },
      'PLAY-BBBB': { lastSeen: now - 10_000, channel: 'togetherroom', open: true },
      'WORK-GHST': { lastSeen: now - 10 * 60_000, channel: 'workingroom' },
    },
    rooms: {
      'WORK-AAAA': room('workingroom'),
      'PLAY-BBBB': room('togetherroom'),
      'WORK-GHST': room('workingroom'),
      'SCRT-ZZ99': room('togetherroom'),
    },
  };
}

const roomRow = (page: Page, code: string) => page.locator('tbody tr').filter({ hasText: code });
const roomKeys = async () => Object.keys((await dbGet<Record<string, unknown>>('rooms')) ?? {}).sort();
const indexKeys = async () => Object.keys((await dbGet<Record<string, unknown>>('roomIndex')) ?? {}).sort();

test('열린 방 목록 — 살아 있는 방이 위, 유령은 따로 표시', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');

  await expect(page.getByText('살아 있음 2 · 전체 3')).toBeVisible();
  await expect(page.locator('tbody tr').last()).toContainText('WORK-GHST');
  await expect(roomRow(page, 'WORK-GHST')).toContainText('👻 유령');
  await expect(roomRow(page, 'PLAY-BBBB')).toContainText('투게더룸');
  await expect(roomRow(page, 'PLAY-BBBB')).toContainText('🎲 공개');
  await expect(roomRow(page, 'WORK-AAAA')).toContainText('🟢 살아 있음');
  await expect(roomRow(page, 'SCRT-ZZ99')).toHaveCount(0);
  await expect(page.getByText('서버 집계 없음')).toBeVisible();
});

test('유령 방 청소 — rooms · roomIndex 둘 다 지우고 살아 있는 방은 남긴다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  const ghost = card(page, '🧹 유령 방 청소');
  await expect(ghost.getByText('대상 1개')).toBeVisible();
  await ghost.getByRole('button', { name: '청소' }).click();

  await expect(toast(page)).toHaveText('유령 방 1개를 정리했어요');
  await expect(ghost.getByText('정리할 유령 방이 없어요')).toBeVisible();
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA']);
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'SCRT-ZZ99', 'WORK-AAAA']);
});

test('목록에서 방 하나를 종료한다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  await roomRow(page, 'WORK-AAAA').getByRole('button', { name: '종료' }).click();

  await expect(toast(page)).toHaveText('WORK-AAAA 방을 종료했어요');
  await expect(roomRow(page, 'WORK-AAAA')).toHaveCount(0);
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-GHST']);
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'SCRT-ZZ99', 'WORK-GHST']);
});

test('코드로 종료 — 목록에 없는 시크릿룸도 닫는다', async ({ page, seed }) => {
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
  expect(await roomKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA', 'WORK-GHST']);
  expect(await indexKeys()).toEqual(['PLAY-BBBB', 'WORK-AAAA', 'WORK-GHST']);
});

test('전체 종료 — «종료» 를 적어야 열리고, roomIndex 의 방을 모두 닫는다', async ({ page, seed }) => {
  await seed(roomData());
  await openMenu(page, 'rooms');
  const all = card(page, '🛑 전체 방 종료');
  await expect(all.getByText('대상 3개')).toBeVisible();
  const go = all.getByRole('button', { name: '전체 종료' });
  await expect(go).toBeDisabled();
  await all.getByPlaceholder('종료').fill('종료');
  await go.click();

  await expect(toast(page)).toHaveText('방 3개를 종료했어요');
  await expect(page.getByText('열린 방이 없어요')).toBeVisible();
  expect(await indexKeys()).toEqual([]);
  // 시크릿룸은 roomIndex 에 없어 전체 종료 대상이 아니다.
  expect(await roomKeys()).toEqual(['SCRT-ZZ99']);
});
