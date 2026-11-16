import { expect, test } from './fixtures';
import { dbGet, fileExists, uploadFile } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

// 에뮬레이터 주소로 넣는 이유는 catalog-parts.spec 와 같다. 가챠 파츠도 Storage 는 catalog/parts/{id}.glb 를 쓴다.
const upload = async (path: string) =>
  (await uploadFile(path, Buffer.from('glTF-e2e'))).replace(
    'https://firebasestorage.googleapis.com',
    'http://127.0.0.1:9199',
  );

const gacha = (name: string, order: number, glbUrl: string) => ({
  cat: 'hat',
  name,
  icon: '🎰',
  order,
  glbUrl,
  gacha: true,
  season: 'winter',
});

test('가챠 파츠 — 파츠 탭에 «가챠» 표시로 섞여 보이고 순서는 각자 통의 order 에 쓴다', async ({
  page,
  seed,
}) => {
  const url = await upload('catalog/parts/g.glb');
  await seed({
    catalog: {
      gachaParts: { g1: gacha('눈모자', 0, url), g2: gacha('털모자', 1, url) },
      parts: { p1: { cat: 'hat', name: '일반모자', icon: '🎩', order: 0, glbUrl: url } },
    },
  });
  await openMenu(page, 'catalog');
  await page.getByRole('tab', { name: '파츠', exact: true }).click();
  const list = card(page, '파츠');
  await expect(row(list, '눈모자')).toContainText('가챠');
  await expect(row(list, '일반모자')).not.toContainText('가챠');

  // 한 카테고리 목록은 order 순(같으면 id 순): 눈모자(g1) · 일반모자(p1) · 털모자(g2).
  await row(list, '털모자').dragTo(row(list, '눈모자'));
  await expect(toast(page)).toHaveText('순서를 바꿨어요');
  expect(await dbGet('catalog/gachaParts/g2/order')).toBe(0);
  expect(await dbGet('catalog/gachaParts/g1/order')).toBe(1);
  expect(await dbGet('catalog/parts/p1/order')).toBe(2);
  expect(await dbGet('catalog/parts/g2')).toBeNull();
});

test('가챠 파츠 — 지우면 gachaParts 와 Storage 파일이 지워지고 일반 파츠는 남는다', async ({
  page,
  seed,
}) => {
  const glbUrl = await upload('catalog/parts/g1.glb');
  const other = await upload('catalog/parts/p1.glb');
  await seed({
    catalog: {
      gachaParts: { g1: gacha('눈모자', 0, glbUrl), g2: gacha('털모자', 1, other) },
      parts: { p1: { cat: 'hat', name: '일반모자', icon: '🎩', order: 0, glbUrl: other } },
    },
  });
  await openMenu(page, 'catalog');
  await page.getByRole('tab', { name: '파츠', exact: true }).click();
  const list = card(page, '파츠');
  await list.getByRole('checkbox', { name: '눈모자 선택' }).check();
  await list.getByRole('button', { name: '선택 삭제 (1)' }).click();
  await expect(toast(page)).toHaveText('1개 삭제했어요');
  expect(Object.keys((await dbGet<Record<string, unknown>>('catalog/gachaParts'))!)).toEqual(['g2']);
  expect(await dbGet('catalog/parts/p1')).not.toBeNull();
  expect(await fileExists('catalog/parts/g1.glb')).toBe(false);
  expect(await fileExists('catalog/parts/p1.glb')).toBe(true);
});
