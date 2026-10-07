import { expect, type Locator, type Page } from '@playwright/test';

export type Menu =
  'license' | 'users' | 'reports' | 'notices' | 'settings' | 'rooms' | 'catalog' | 'log' | 'metrics';

/** 메뉴 화면을 바로 연다(#/<id>). 로그인 확인이 끝나 머리줄에 «로그아웃» 이 뜰 때까지 기다린다. */
export async function openMenu(page: Page, menu: Menu) {
  await page.goto(`/admin/#/${menu}`);
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
}

/** 제목(h2)으로 카드 한 장을 고른다 — 같은 이름의 버튼(«발급» · «보내기» · «삭제»)이 여러 카드에 있다. */
export function card(page: Page, heading: string | RegExp): Locator {
  return page.locator('section.card').filter({ has: page.getByRole('heading', { name: heading }) });
}

/** 잠깐 떴다 사라지는 알림. */
export function toast(page: Page): Locator {
  return page.getByRole('status');
}

/** 글자를 품은 목록 한 줄(.row) — 그 줄의 버튼을 누를 때. */
export function row(scope: Page | Locator, text: string | RegExp): Locator {
  return scope.locator('.row').filter({ hasText: text });
}
