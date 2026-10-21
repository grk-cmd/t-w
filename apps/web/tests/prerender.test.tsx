import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prerenderAll, renderPage } from '@/app/entry-server';
import { HELP_URL, PRIVACY_URL, SITE_ORIGIN } from '@/shared/config';
import { LANGS, messagesFor, pathFor } from '@/shared/i18n';

const TEMPLATE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('미리 그린 페이지', () => {
  const pages = new Map(prerenderAll(TEMPLATE));

  it('언어마다 한 장 — index.html · en/index.html · ja/index.html', () => {
    expect([...pages.keys()]).toEqual(['index.html', 'en/index.html', 'ja/index.html']);
  });

  it('페이지 언어 · 제목 · 첫 화면 글이 그 언어', () => {
    for (const lang of LANGS) {
      const html = pages.get(`${pathFor(lang).slice(1)}index.html`) ?? '';
      const m = messagesFor(lang);
      expect(html).toContain(`<html lang="${lang}"`);
      expect(html).toContain(`<title>${m.metaTitle}</title>`);
      expect(html).toContain(m.heroTitleB);
      expect(html).toContain(`aria-label="${m.landAria}"`); // 투게더랜드 잠긴 아이콘 — 경고창은 누를 때만
      expect(html).not.toContain(m.landLocked);
      expect(html).toContain(m.newsTitle); // 📰 소식 창 자리 — 글은 아직 빈 안내
      expect(html).toContain(m.newsEmpty);
      expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${pathFor(lang)}"/>`);
      expect(html).not.toMatch(/%TW_LANG%|<!--tw-head-->|<!--tw-body-->/);
    }
  });

  it('다른 언어 주소(hreflang)가 셋 + 기본', () => {
    const html = pages.get('index.html') ?? '';
    for (const l of LANGS) expect(html).toContain(`hrefLang="${l}" href="${SITE_ORIGIN}${pathFor(l)}"`);
    expect(html).toContain(`hrefLang="x-default" href="${SITE_ORIGIN}/"`);
  });

  it('바깥 링크는 우리 도메인뿐이고 새 창은 noopener noreferrer', () => {
    for (const html of pages.values()) {
      const hrefs = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((x) => x[1] ?? '');
      for (const h of hrefs) expect(new URL(h).hostname, h).toMatch(/(^|\.)together-working\.com$/);
      for (const a of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g))
        expect(a[0]).toContain('rel="noopener noreferrer"');
      expect(html).toContain(HELP_URL);
      expect(html).toContain(PRIVACY_URL);
    }
  });

  it('첫 기능이 열린 채로 나간다(스크립트 없이도 설명이 보인다)', () => {
    const { body } = renderPage('ko');
    const first = messagesFor('ko').features[0];
    expect(body).toContain('aria-selected="true"');
    expect(body).toContain(first?.text);
  });

  it('캐릭터 만들기 자리는 «불러오는 중» 으로 나간다(3D 는 브라우저에서)', () => {
    for (const lang of LANGS) expect(renderPage(lang).body).toContain(messagesFor(lang).creator.loading);
  });

  it('내려받기 단추는 주소가 생기기 전까지 눌리지 않는다', () => {
    const { body } = renderPage('ko');
    const m = messagesFor('ko');
    for (const label of [m.dlWindows, m.dlMac])
      expect(body).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${label}<`));
  });
});
