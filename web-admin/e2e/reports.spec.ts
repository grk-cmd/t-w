import { expect, test } from './fixtures';
import { dbGet, dbSet, fileExists, uploadFile } from './support/emulator';
import { openMenu, row, toast } from './support/ui';

const T0 = Date.UTC(2026, 0, 1);
const TARGET = 'utarget000001';
const MILD = 'umild00000002';
const IMG_PATH = `awayImg/${TARGET}.png`;

const report = (kind: string, nick: string, i: number) => ({
  kind,
  nick,
  code4: `00${i}0`.slice(-4),
  ts: T0 + i,
});

// 서로 다른 3명에게 신고된 사람은 보이고, 2명에게 신고된 사람은 아직 안 보인다.
function reportData(awayImg?: string) {
  return {
    reports: {
      [TARGET]: {
        ur1: report('away', '신고자일', 1),
        ur2: report('nick', '신고자이', 2),
        ur3: { ...report('etc', '신고자삼', 3), note: '도배' },
      },
      [MILD]: { ur1: report('char', '신고자일', 4), ur2: report('char', '신고자이', 5) },
    },
    users: {
      [TARGET]: { profile: { name: '말썽꾼' }, friendCode: 'MATE-TRGT', ...(awayImg ? { awayImg } : {}) },
      [MILD]: { profile: { name: '조금말썽' } },
    },
  };
}

test('서로 다른 3명 이상에게 신고된 사람만 보인다', async ({ page, seed }) => {
  await seed(reportData());
  await openMenu(page, 'reports');

  await expect(page.getByText('신고 3명 이상 · 1명')).toBeVisible();
  const item = row(page, '말썽꾼');
  await expect(item).toContainText('MATE-TRGT');
  await expect(item).toContainText('🚩 3명');
  // 최근 신고가 위.
  await expect(item.locator('li').first()).toContainText('신고자삼 #0030 · 기타 · 도배');
  await expect(item.locator('li').last()).toContainText('신고자일 #0010 · 자리비움 그림');
  await expect(page.getByText('조금말썽')).toHaveCount(0);
  // 그림이 없으면 내릴 것도 없다.
  await expect(item.getByRole('button', { name: '그림 내리기' })).toHaveCount(0);
});

test('문제없음 — 그 사람의 신고만 비운다', async ({ page, seed }) => {
  await seed(reportData());
  await openMenu(page, 'reports');

  await row(page, '말썽꾼').getByRole('button', { name: '문제없음' }).click();
  await expect(toast(page)).toHaveText('신고를 비웠어요');
  await expect(page.getByText('살펴볼 신고가 없어요')).toBeVisible();
  expect(await dbGet(`reports/${TARGET}`)).toBeNull();
  expect(Object.keys((await dbGet<Record<string, unknown>>(`reports/${MILD}`))!)).toHaveLength(2);
});

test('선택 문제없음 — 고른 사람들의 신고만 한 묶음으로 비운다', async ({ page, seed }) => {
  const data = reportData();
  const OTHER = 'uother0000003';
  const KEEP = 'ukeep00000004';
  await seed({
    ...data,
    reports: {
      ...data.reports,
      [OTHER]: { ur1: report('nick', 'ㄱ', 6), ur2: report('nick', 'ㄴ', 7), ur3: report('nick', 'ㄷ', 8) },
      [KEEP]: { ur1: report('char', 'ㄱ', 9), ur2: report('char', 'ㄴ', 10), ur3: report('char', 'ㄷ', 11) },
    },
    users: {
      ...data.users,
      [OTHER]: { profile: { name: '두번째' } },
      [KEEP]: { profile: { name: '남길사람' } },
    },
  });
  await openMenu(page, 'reports');
  await expect(page.getByText('신고 3명 이상 · 3명')).toBeVisible();

  await page.getByRole('checkbox', { name: '말썽꾼 선택' }).check();
  await page.getByRole('checkbox', { name: '두번째 선택' }).check();
  await page.getByRole('button', { name: '선택 문제없음 (2)' }).click();

  await expect(toast(page)).toHaveText('2명의 신고를 비웠어요');
  await expect(page.getByText('신고 3명 이상 · 1명')).toBeVisible();
  await expect(row(page, '남길사람')).toBeVisible();
  expect(await dbGet(`reports/${TARGET}`)).toBeNull();
  expect(await dbGet(`reports/${OTHER}`)).toBeNull();
  expect(Object.keys((await dbGet<Record<string, unknown>>(`reports/${KEEP}`))!)).toHaveLength(3);
  expect(Object.keys((await dbGet<Record<string, unknown>>(`reports/${MILD}`))!)).toHaveLength(2);
});

// 에뮬레이터에 붙은 Storage SDK 는 firebasestorage.googleapis.com 주소를 자기 것으로 알아보지 못해(호스트가 127.0.0.1:9199)
// 파일 지우기가 늘 실패한다. 그런데 규칙은 awayImg 에 그 주소만 받는다 — 여기서는 «DB 는 비우고 파일은 남은» 쪽만 확인한다.
test('그림 내리기 — awayImg · 신고를 한 묶음으로 비운다(파일 삭제 실패는 알린다)', async ({ page, seed }) => {
  const url = await uploadFile(IMG_PATH, Buffer.from('not-really-a-png'));
  await seed(reportData(url));
  await openMenu(page, 'reports');

  const item = row(page, '말썽꾼');
  await expect(item.getByRole('img', { name: '말썽꾼 님의 자리비움 그림' })).toBeVisible();
  await item.getByRole('button', { name: '그림 내리기' }).click();

  await expect(toast(page)).toHaveText('그림을 내리고 신고를 비웠어요 · 파일 삭제 실패');
  await expect(page.getByText('살펴볼 신고가 없어요')).toBeVisible();
  expect(await dbGet(`users/${TARGET}/awayImg`)).toBeNull();
  expect(await dbGet(`users/${TARGET}/profile/name`)).toBe('말썽꾼');
  expect(await dbGet(`reports/${TARGET}`)).toBeNull();
  expect(await dbGet(`reports/${MILD}`)).not.toBeNull();
  expect(await fileExists(IMG_PATH)).toBe(true);
});

test('그림 내리기 — 화면을 연 뒤 주인이 그림을 바꿨으면 새 그림은 지우지 않는다', async ({ page, seed }) => {
  const shown = await uploadFile(IMG_PATH, Buffer.from('old'));
  await seed(reportData(shown));
  await openMenu(page, 'reports');
  await expect(row(page, '말썽꾼').getByRole('img')).toBeVisible();

  const replaced = await uploadFile(`awayImg/${TARGET}-new.png`, Buffer.from('new'));
  await dbSet(`users/${TARGET}/awayImg`, replaced);
  await row(page, '말썽꾼').getByRole('button', { name: '그림 내리기' }).click();

  await expect(toast(page)).toHaveText('그 사이 그림이 바뀌었어요. 다시 확인해 주세요');
  expect(await dbGet(`users/${TARGET}/awayImg`)).toBe(replaced);
  expect(await dbGet(`reports/${TARGET}`)).not.toBeNull();
  expect(await fileExists(IMG_PATH)).toBe(true);
});
