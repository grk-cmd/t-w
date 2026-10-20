import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, toast } from './support/ui';

type SecretRoom = { k: string; pub: { owner: string; name?: string; ts: number; exp?: number } };
type InboxMessage = { tag: string; title: string; body: string };

const UID = 'usr1a2b3c4d5e';

test('발급 열쇠가 틀리면 규칙이 거부하고, 맞으면 secretRooms 와 수령함이 쓰인다', async ({ page, seed }) => {
  await seed({
    srKey: { v: 'right-key' },
    friendCodes: { 'MATE-SR12': { userId: UID } },
    // 최근 접속 · 거울 친구코드가 맞아야 «오래된 계정» 경고 없이 바로 발급된다.
    users: {
      [UID]: {
        profile: { name: '후원자' },
        friendCode: 'MATE-SR12',
        presence: { online: false, lastSeen: Date.now() },
      },
    },
  });
  await openMenu(page, 'license');
  await page.getByRole('tab', { name: '시크릿룸' }).click();
  const form = card(page, '🔒 시크릿룸 발급');

  await form.getByLabel('받는 사람').fill('MATE-SR12');
  await form.getByLabel('원하는 코드').fill('ab23');
  await form.getByLabel('이용 기간(개월)').fill('3');
  await form.getByLabel('발급 열쇠').fill('wrong-key');
  await form.getByRole('button', { name: '발급' }).click();

  await expect(form.getByText('발급 열쇠가 맞지 않아요')).toBeVisible();
  expect(await dbGet('secretRooms')).toBeNull();
  expect(await dbGet('inbox')).toBeNull();

  await form.getByLabel('발급 열쇠').fill('right-key');
  await form.getByRole('button', { name: '발급' }).click();

  await expect(toast(page)).toContainText('시크릿룸 SCRT-AB23 발급 · 3개월 · ');
  await expect(form.locator('.msg')).toContainText('발급 완료 SCRT-AB23');
  await expect(form.locator('.msg')).toContainText('수령함으로 보냈어요');
  await expect(form.locator('.msg')).toContainText(`받는 계정 ${UID} (후원자)`);
  // 같은 기간으로 연달아 발급하는 일이 많아 기간 · 열쇠는 남기고 받는 사람 · 코드만 비운다.
  await expect(form.getByLabel('받는 사람')).toHaveValue('');
  await expect(form.getByLabel('이용 기간(개월)')).toHaveValue('3');

  const room = (await dbGet<SecretRoom>('secretRooms/SCRT-AB23'))!;
  expect(room.k).toBe('right-key');
  expect(room.pub).toMatchObject({ owner: UID, name: '후원자' });
  const days = (room.pub.exp! - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(85);
  expect(days).toBeLessThan(95);
  expect(await dbGet(`users/${UID}/secretRoom`)).toBe('SCRT-AB23');

  const messages = Object.values((await dbGet<Record<string, InboxMessage>>(`inbox/${UID}`))!);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ tag: 'reward', title: '🔒 시크릿룸이 열렸어요' });
  expect(messages[0].body).toContain('SCRT-AB23');
});
