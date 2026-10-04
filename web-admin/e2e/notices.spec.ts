import { expect, test } from './fixtures';
import { dbGet } from './support/emulator';
import { card, openMenu, row, toast } from './support/ui';

type Broadcast = { tag: string; title: string; body: string; ts: number; pinned?: boolean };

test('확성기 — 보내면 1분짜리 공지가 쓰이고, 끄면 지워진다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'notices');
  const announce = card(page, '📣 확성기 공지');
  await expect(announce.getByText('보낸 공지가 없어요')).toBeVisible();

  await announce.getByPlaceholder('공지 문구').fill('  잠시 후 점검합니다  ');
  await announce.getByRole('button', { name: '보내기' }).click();
  await expect(toast(page)).toHaveText('공지를 보냈어요 (1분간 표시)');
  await expect(announce.getByText(/지금 표시 중 · \d+초 남음/)).toBeVisible();
  const current = await dbGet<{ text: string; ts: number; duration: number }>('announce/current');
  expect(current).toMatchObject({ text: '잠시 후 점검합니다', duration: 60_000 });
  expect(Math.abs(current!.ts - Date.now())).toBeLessThan(30_000);

  await announce.getByRole('button', { name: '지금 끄기' }).click();
  await expect(toast(page)).toHaveText('공지를 껐어요');
  await expect(announce.getByText('보낸 공지가 없어요')).toBeVisible();
  expect(await dbGet('announce')).toBeNull();
});

test('업데이트 공지 — 발행하고 삭제한다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'notices');
  const notice = card(page, '📰 업데이트 공지');
  await expect(notice.getByText('발행된 공지가 없어요')).toBeVisible();

  await notice.getByPlaceholder('제목').fill('v2.0 업데이트');
  await notice.getByRole('button', { name: '발행' }).click();
  await expect(toast(page)).toHaveText('제목과 본문을 모두 입력해 주세요');
  expect(await dbGet('updateNotice')).toBeNull();

  await notice.getByPlaceholder('본문').fill('새 캐릭터가 나왔어요');
  await notice.getByRole('button', { name: '발행' }).click();
  await expect(toast(page)).toHaveText('발행했어요');
  await expect(notice.getByText(/지금 발행된 공지 · /)).toBeVisible();
  await expect(notice.getByRole('button', { name: '다시 발행' })).toBeVisible();
  expect(await dbGet('updateNotice/current')).toMatchObject({
    title: 'v2.0 업데이트',
    body: '새 캐릭터가 나왔어요',
  });

  await notice.getByRole('button', { name: '삭제' }).click();
  await expect(toast(page)).toHaveText('삭제했어요');
  await expect(notice.getByText('발행된 공지가 없어요')).toBeVisible();
  await expect(notice.getByPlaceholder('제목')).toHaveValue('');
  expect(await dbGet('updateNotice')).toBeNull();
});

test('버그 제보 문구 — http(s) 가 아닌 링크는 막고, 맞으면 저장한다', async ({ page, seed }) => {
  await seed();
  await openMenu(page, 'notices');
  const bug = card(page, '🐞 버그 제보 탭 문구');
  await expect(bug.getByText('저장된 값 없음 · 기본 글 · [제보하기] 꺼짐')).toBeVisible();
  // 저장된 값이 없으면 앱이 보여 주는 기본 글에서 시작한다.
  await expect(bug.getByPlaceholder('공지')).toHaveValue(/^버그를 발견하셨나요\?/);

  await bug.getByPlaceholder('공지').fill('오픈채팅으로 알려 주세요');
  await bug.getByPlaceholder('제보 링크 (https)').fill('javascript:alert(1)');
  await bug.getByRole('button', { name: '저장' }).click();
  await expect(toast(page)).toHaveText('링크는 http:// 또는 https:// 로 시작해야 해요');
  expect(await dbGet('bugReport')).toBeNull();

  await bug.getByPlaceholder('제보 링크 (https)').fill('https://open.kakao.com/o/e2e');
  await bug.getByRole('button', { name: '저장' }).click();
  await expect(toast(page)).toHaveText('버그 제보 공지를 저장했어요');
  await expect(bug.getByText(/^마지막 저장 · /)).toBeVisible();
  const saved = await dbGet<{ notice: string; link: string; ts: number }>('bugReport/current');
  expect(saved).toMatchObject({ notice: '오픈채팅으로 알려 주세요', link: 'https://open.kakao.com/o/e2e' });
  expect(typeof saved!.ts).toBe('number');
});

test('수령함 전체 공지 — 고정해 보내고, 고정을 풀었다 다시 걸고, 지운다', async ({ page, seed }) => {
  await seed({
    inboxBroadcast: {
      bOld: { tag: 'notice', title: '예전 공지', body: '지난달 소식', ts: Date.UTC(2026, 0, 1) },
    },
  });
  await openMenu(page, 'notices');
  const send = card(page, '📩 수령함 전체 공지');
  const list = card(page, '보낸 전체 공지');
  await expect(list.getByText('1건')).toBeVisible();

  await send.getByRole('radio', { name: '🆕 업데이트' }).check();
  await send.getByRole('checkbox', { name: '맨 위 고정' }).check();
  await send.getByPlaceholder('제목').fill('새 버전이 나왔어요');
  await send.getByPlaceholder('내용').fill('설정에서 업데이트해 주세요');
  await send.getByRole('button', { name: '보내기' }).click();

  await expect(toast(page)).toHaveText('전체 수령함으로 보냈어요');
  await expect(send.getByPlaceholder('제목')).toHaveValue('');
  await expect(list.getByText('2건')).toBeVisible();
  // 고정이 맨 위.
  await expect(list.locator('.row').first()).toContainText('📌');
  await expect(list.locator('.row').first()).toContainText('새 버전이 나왔어요');

  const all = (await dbGet<Record<string, Broadcast>>('inboxBroadcast'))!;
  const [id] = Object.keys(all).filter((k) => k !== 'bOld');
  expect(all[id]).toMatchObject({
    tag: 'update',
    title: '새 버전이 나왔어요',
    body: '설정에서 업데이트해 주세요',
    pinned: true,
  });

  const sent = row(list, '새 버전이 나왔어요');
  await sent.getByRole('button', { name: '고정 풀기' }).click();
  await expect(toast(page)).toHaveText('고정을 풀었어요');
  await expect(sent.getByRole('button', { name: '📌 고정' })).toBeVisible();
  // 풀 때는 false 를 쓰지 않고 키를 지운다(앱과 같은 모양).
  expect(await dbGet(`inboxBroadcast/${id}`)).not.toHaveProperty('pinned');

  await sent.getByRole('button', { name: '📌 고정' }).click();
  await expect(toast(page)).toHaveText('맨 위에 고정했어요');
  expect(await dbGet(`inboxBroadcast/${id}/pinned`)).toBe(true);

  await sent.getByRole('button', { name: '삭제' }).click();
  await expect(toast(page)).toHaveText('삭제했어요');
  await expect(list.getByText('1건')).toBeVisible();
  expect(await dbGet(`inboxBroadcast/${id}`)).toBeNull();
  expect(await dbGet('inboxBroadcast/bOld')).not.toBeNull();
});
