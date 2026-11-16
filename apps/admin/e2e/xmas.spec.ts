import { adminUid, expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { openMenu, row, toast } from './support/ui';

type LogRecord = { action: string; target: string };

const U1 = 'authUser00001';
const U2 = 'authUser00002';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

// 🎄 크리스마스(일회성) — 반송 · 지우기는 함수라 에뮬레이터(함수 없음)에서는 화면 · 문제없음만 본다(함수 호출은 tests/features/xmas-moderate.test.ts).
const data = {
  xmasLetters: {
    [U1]: {
      l1: { text: '올해 고마웠어요\n내년에도', ts: 1, song: { id: 'abcdefghijk', title: '고요한 밤' } },
      l2: { text: '두 번째', ts: 2 },
    },
    [U2]: { l3: { text: '광고 글', ts: 3 } },
  },
  xmasTrees: { 3: { o: { 12: { k: 'img', v: 2, w: '메리' } } } },
  xmasImg: { 3: { 12: { v: 2, d: PNG } } },
  xmasOwners: { 3: { 12: U2 } },
  xmasReports: { 'o-3-12': { [U1]: { ts: 5, note: '나쁜 그림' } } },
};

test('맡긴 편지 — 사람마다 편지 · 추천곡 · 반송 단추', async ({ page, seed }) => {
  await seed(data);
  await openMenu(page, 'xmas');
  await expect(page.getByText('편지를 맡긴 사람 · 2명')).toBeVisible();
  const first = row(page, '올해 고마웠어요');
  await expect(first).toContainText('고요한 밤');
  await expect(first.getByRole('button', { name: '반송' })).toBeVisible();
  await first.getByRole('button', { name: '반송' }).click();
  await first.getByLabel('반송 사유').selectOption('etc');
  await expect(first.getByRole('button', { name: '반송하기' })).toBeDisabled(); // 기타는 사유를 적어야
  await first.getByLabel('기타 사유').fill('전화번호');
  await expect(first.getByRole('button', { name: '반송하기' })).toBeEnabled();
  await expect(row(page, '광고 글')).toBeVisible();
});

test('신고 — 장식 그림 · 한마디 · 건 사람 · 문제없음', async ({ page, seed }) => {
  await seed(data);
  await openMenu(page, 'xmas');
  await page.getByRole('tab', { name: /신고/ }).click();
  const item = row(page, '나쁜 그림');
  await expect(item).toContainText('«메리»');
  await expect(item).toContainText('트리 #3 · 자리 12');
  await expect(item.getByRole('img', { name: '신고된 장식 그림' })).toBeVisible();
  await item.getByRole('button', { name: '문제없음' }).click();
  await expect(toast(page)).toContainText('신고를 비웠어요');
  await expect.poll(() => dbGet('xmasReports/o-3-12')).toBeNull();
  const logs = Object.values((await dbGet<Record<string, LogRecord & { by: string }>>('adminLog')) ?? {});
  expect(logs).toMatchObject([{ action: 'xmas.dismiss', target: 'o-3-12', by: adminUid() }]);
  await expect(page.getByText('살펴볼 신고가 없어요')).toBeVisible();
});
