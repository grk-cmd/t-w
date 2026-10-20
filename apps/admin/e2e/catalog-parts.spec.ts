import { expect, test } from './fixtures';
import { dbGet, fileExists, uploadFile } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

const GLB = Buffer.from('glTF-e2e');

// 에뮬레이터에 붙은 Storage SDK 는 googleapis 주소를 제 것으로 못 알아봐(reports.spec 참고) 에뮬레이터 주소로 넣는다.
// 카탈로그 규칙은 glbUrl 의 호스트를 보지 않는다.
const upload = async (path: string) =>
  (await uploadFile(path, GLB)).replace('https://firebasestorage.googleapis.com', 'http://127.0.0.1:9199');

// 규칙 catalog/parts .validate 를 통과하는 항목 — icon 이 없으면 어떤 쓰기도 거절된다.
const part = (
  cat: string,
  name: string,
  order: number,
  glbUrl: string,
  extra: Record<string, unknown> = {},
) => ({
  cat,
  name,
  icon: '🎩',
  order,
  glbUrl,
  ...extra,
});

async function openParts(page: import('@playwright/test').Page) {
  await openMenu(page, 'catalog');
  await page.getByRole('tab', { name: '파츠', exact: true }).click();
  return card(page, '파츠');
}

test('파츠 — 카테고리별로 보이고, 지우면 DB 와 Storage 의 glb · 썸네일이 같이 지워진다', async ({
  page,
  seed,
}) => {
  const glbUrl = await upload('catalog/parts/p1.glb');
  const thumbUrl = await upload('catalog/parts/p1.thumb.png');
  const other = await upload('catalog/parts/p2.glb');
  await seed({
    catalog: {
      parts: {
        p1: part('hat', '빨간모자', 0, glbUrl, { thumbUrl }),
        p2: part('glasses', '동그란안경', 0, other),
      },
      catOverrides: { glasses: { label: '선글라스' } },
    },
  });
  const list = await openParts(page);
  await expect(list.getByRole('group', { name: /모자 · hat/ })).toContainText('빨간모자');
  await expect(list.getByRole('group', { name: /선글라스 · glasses/ })).toContainText('동그란안경');

  await row(list, '빨간모자').getByRole('button', { name: '삭제' }).click();
  await expect(toast(page)).toHaveText('1개 삭제했어요');
  await expect(row(list, '빨간모자')).toHaveCount(0);
  expect(await dbGet('catalog/parts/p1')).toBeNull();
  expect(await fileExists('catalog/parts/p1.glb')).toBe(false);
  expect(await fileExists('catalog/parts/p1.thumb.png')).toBe(false);
  expect(await fileExists('catalog/parts/p2.glb')).toBe(true);
});

test('파츠 — 고른 것만 한 묶음으로 지운다', async ({ page, seed }) => {
  const url = await upload('catalog/parts/a.glb');
  await seed({
    catalog: {
      parts: {
        a: part('hat', '첫모자', 0, url),
        b: part('hat', '둘모자', 1, url),
        c: part('hat', '셋모자', 2, url),
      },
    },
  });
  const list = await openParts(page);
  await list.getByRole('checkbox', { name: '첫모자 선택' }).check();
  await list.getByRole('checkbox', { name: '셋모자 선택' }).check();
  await list.getByRole('button', { name: '선택 삭제 (2)' }).click();
  await expect(toast(page)).toHaveText('2개 삭제했어요');
  await expect(list.getByText('0개 선택')).toBeVisible();
  expect(Object.keys((await dbGet<Record<string, unknown>>('catalog/parts'))!)).toEqual(['b']);
});

test('파츠 — 카테고리 안에서 끌어 놓으면 order 를 한 묶음으로 바꾼다', async ({ page, seed }) => {
  const url = await upload('catalog/parts/x.glb');
  await seed({
    catalog: {
      parts: {
        a: part('hat', '첫모자', 0, url),
        b: part('hat', '둘모자', 1, url),
        c: part('hat', '셋모자', 2, url),
        g: part('glasses', '안경하나', 0, url),
      },
    },
  });
  const list = await openParts(page);
  const hats = list.getByRole('group', { name: /모자 · hat/ });
  await row(hats, '셋모자').dragTo(row(hats, '첫모자'));
  await expect(toast(page)).toHaveText('순서를 바꿨어요');
  await expect(hats.locator('.row').first()).toContainText('셋모자');
  expect(await dbGet('catalog/parts/c/order')).toBe(0);
  expect(await dbGet('catalog/parts/a/order')).toBe(1);
  expect(await dbGet('catalog/parts/b/order')).toBe(2);

  // 다른 카테고리 위에는 놓을 수 없다.
  await row(hats, '첫모자').dragTo(row(list, '안경하나'));
  expect(await dbGet('catalog/parts/a/order')).toBe(1);
  expect(await dbGet('catalog/parts/g/order')).toBe(0);
});

test('파츠 · 가챠 파츠 — 장착 N명이 보이고, 많이 쓰는 순으로 고르면 카테고리 안에서 다시 선다', async ({
  page,
  seed,
}) => {
  const url = await upload('catalog/parts/pop.glb');
  await seed({
    catalog: {
      parts: {
        a: part('hat', '첫모자', 0, url),
        b: part('hat', '둘모자', 1, url),
        c: part('hat', '셋모자', 2, url),
        g: part('glasses', '안경하나', 0, url),
      },
      gachaParts: { k: part('hat', '반짝모자', 0, url) },
    },
    // 서버 함수가 적는 자리 — 파츠 · 가챠 파츠 둘 다 parts 아래. 0 이하 · 없는 항목은 0명.
    metrics: { parts: { equipped: { parts: { c: 7, b: 2, a: 0, k: 3 } } } },
  });
  const list = await openParts(page);
  const hats = list.getByRole('group', { name: /모자 · hat/ });
  await expect(row(hats, '셋모자')).toContainText('장착 7명');
  await expect(row(hats, '첫모자')).toContainText('장착 0명');
  await expect(row(list, '안경하나')).toContainText('장착 0명');
  await expect(hats.locator('.row').first()).toContainText('첫모자'); // 처음엔 진열 순서

  await list.getByLabel('정렬').selectOption({ label: '많이 쓰는 순' });
  await expect(hats.locator('.row').nth(0)).toContainText('셋모자');
  await expect(hats.locator('.row').nth(1)).toContainText('둘모자');
  await expect(hats.locator('.row').nth(2)).toContainText('첫모자');
  await expect(row(hats, '셋모자')).toHaveAttribute('draggable', 'false'); // 이 순서에선 끌어 놓기 없음
  expect(await dbGet('catalog/parts/a/order')).toBe(0); // 정렬은 화면만 — 진열 순서는 그대로

  await page.getByRole('tab', { name: '가챠 파츠', exact: true }).click();
  await expect(row(card(page, '가챠 파츠'), '반짝모자')).toContainText('장착 3명');
});
