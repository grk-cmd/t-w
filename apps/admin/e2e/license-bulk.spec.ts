import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { openMenu, toast } from './support/ui';

type License = { valid: boolean; note: string };
type InboxMessage = { tag: string; title: string; body: string };

const CSV = [
  '친구코드,메모',
  'MATE-AB12,1월 후원',
  'cd34,2월 후원', // 뒤 4자리 · 소문자 — COZY- 로 찾는다
  'MATE-NONE,주인 없음',
  ',키만 필요',
  'MATE-AB12,같은 사람 또',
].join('\n');

test('CSV 를 올리면 미리보기 → 발급 → 결과, 키와 수령함이 쓰인다', async ({ page, seed }) => {
  await seed({
    friendCodes: { 'MATE-AB12': { userId: 'ua1b2c3d4e5f6' }, 'COZY-CD34': { userId: 'ucd34ef56gh78' } },
    users: { ua1b2c3d4e5f6: { profile: { name: '철수' } }, ucd34ef56gh78: { profile: { name: '영희' } } },
  });
  await openMenu(page, 'license');
  await page.getByRole('tab', { name: '일괄 발급' }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: '후원자.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV, 'utf8'),
  });

  await expect(page.getByText('후원자.csv · 5행')).toBeVisible();
  await expect(page.getByText('수령함 발송 2')).toBeVisible();
  await expect(page.getByText('키만 발급 1')).toBeVisible();
  await expect(page.getByText('건너뜀 2')).toBeVisible();
  const table = page.locator('table');
  await expect(table.locator('tr', { hasText: 'cd34' })).toContainText('영희');
  await expect(table.locator('tr', { hasText: 'cd34' })).toContainText('→ COZY-CD34');
  await expect(table.locator('tr', { hasText: '주인 없음' })).toContainText('✗ 유저 없음');
  await expect(table.locator('tr', { hasText: '같은 사람 또' })).toContainText('✗ 중복 (2행)');

  await page.getByRole('button', { name: '3건 발급' }).click();
  await expect(toast(page)).toHaveText('일괄 발급 완료 · 수령함 2 · 키만 1');
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
  await expect(table.locator('tr', { hasText: '1월 후원' })).toContainText('✓ 보냄');
  await expect(table.locator('tr', { hasText: '키만 필요' })).toContainText('🔑 키 생성');
  // 수령함으로 못 보낸 키는 직접 전달하도록 따로 보여 준다.
  await expect(page.getByText('직접 전달할 키')).toBeVisible();

  const licenses = (await dbGet<Record<string, License>>('licenses'))!;
  const notes = Object.values(licenses)
    .map((l) => l.note)
    .sort();
  expect(notes).toEqual([
    '엑셀 일괄 · 키만 필요',
    '영희 · 친구코드 COZY-CD34 · 2월 후원',
    '철수 · 친구코드 MATE-AB12 · 1월 후원',
  ]);
  expect(Object.values(licenses).every((l) => l.valid)).toBe(true);

  for (const uid of ['ua1b2c3d4e5f6', 'ucd34ef56gh78']) {
    const messages = Object.values((await dbGet<Record<string, InboxMessage>>(`inbox/${uid}`))!);
    expect(messages).toHaveLength(1);
    const key = messages[0].body.match(/[A-Z2-9]{4}(-[A-Z2-9]{4}){3}/)![0];
    expect(licenses[key]).toBeTruthy();
  }
  expect(Object.keys((await dbGet<Record<string, unknown>>('inbox'))!)).toHaveLength(2);
});
