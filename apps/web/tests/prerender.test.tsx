import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prerenderAll, renderPage } from '@/app/entry-server';
import { HELP_URL, PRIVACY_URL, SITE_ORIGIN } from '@/shared/config';
import { LANGS, messagesFor, pathFor } from '@/shared/i18n';
import { CREW } from '@/pages/home/model/crew';
import { FEATURE_SHOTS } from '@/pages/home/model/feature-shots';

/** webp 머리에서 가로 · 세로 — 손실(VP8) · 무손실(VP8L) · 확장(VP8X) 세 모양 */
function webpSize(b: Buffer): { w: number; h: number } | null {
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const n = b.readUInt32LE(21);
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  return null;
}

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
      expect(html).not.toContain('↓'); // 내려받기는 화살표 글자 대신 아이콘
      expect(html).not.toContain('class="btn big default" href="#download"'); // 첫 화면 내려받기 단추는 없다(위 메뉴 · 아래 칸에 있음)
      expect(html).toContain(`<h2 id="about-title">${m.aboutTitle}</h2></div>`); // 소개 · 내려받기 머리엔 설명 줄이 없다
      expect(html).toContain(`<h2 id="dl-title">${m.dlTitle}</h2></div>`);
      expect(html).toContain(m.newsTitle); // 📰 소식 창 자리 — 글은 아직 빈 안내
      // 소식은 브라우저에서 서버로 받는다 — 미리 그린 페이지는 «불러오는 중»(글 없음으로 보이지 않게)
      expect(html).toContain(m.newsLoading);
      expect(html).not.toContain(m.newsEmpty);
      // 소식 창 아래 사람 그림 — 표(crew.ts)마다 그림 단추 · 이름표(역할 + 이름) · 말풍선은 누르기 전엔 비어 있다
      for (const c of CREW) {
        const role = m.crew[c.key].role;
        expect(html).toContain(`aria-label="${role} ${c.name}"`);
        expect(html).toContain(
          `<span class="crew-body"><img class="crew" src="${c.src}" width="${c.w}" height="${c.h}" alt=""/></span>`,
        );
        expect(html).toContain(
          `<figcaption class="crew-tag"><span class="crew-role">${role}</span> <span class="crew-name">${c.name}</span></figcaption>`,
        );
      }
      // 말풍선은 누르기 전엔 없다 · 알리는 칸은 늘 있다(머리 위 자리는 스크립트가 넣는다)
      for (const c of CREW) {
        expect(c.headX).toBeGreaterThan(0);
        expect(c.headX).toBeLessThan(1);
      }
      expect(html).toContain('<span class="crew-live" aria-live="polite"></span>');
      // 홈페이지 CSP 는 style-src 'self' — 마크업의 style="" 은 브라우저가 막는다(로컬 미리보기엔 CSP 가 없어 안 보인다)
      expect(html).not.toMatch(/\sstyle="/);
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

  it('캐릭터 만들기는 페이지에 없다 — 자리 · 메뉴 · 첫 화면 단추 모두', () => {
    for (const lang of LANGS) {
      const { body } = renderPage(lang);
      expect(body).not.toContain(messagesFor(lang).creator.loading);
      expect(body).not.toContain('id="maker"');
      expect(body).not.toContain('href="#maker"');
    }
  });

  it('소개는 기능마다 앱 화면이 하나씩 — 언어마다 기능 수와 같고 파일이 있고, 미리 그린 페이지엔 첫 기능 화면', () => {
    for (const lang of LANGS) expect(messagesFor(lang).features).toHaveLength(FEATURE_SHOTS.length);
    for (const s of FEATURE_SHOTS) {
      const file = new URL(`../public${s.src}`, import.meta.url);
      expect(existsSync(file), s.src).toBe(true);
      expect(webpSize(readFileSync(file)), s.src).toEqual({ w: s.w, h: s.h }); // 표의 크기 = 실제 그림 크기
    }
    const { body } = renderPage('ko');
    const first = FEATURE_SHOTS[0];
    expect(body).toContain(
      `<img class="feat-shot" src="${first.src}" width="${first.w}" height="${first.h}"`,
    );
    expect(body.match(/class="feat-shot"/g)).toHaveLength(1);
  });

  it('사람 그림 — 표의 width · height 가 실제 그림 크기', () => {
    for (const c of CREW)
      expect(webpSize(readFileSync(new URL(`../public${c.src}`, import.meta.url))), c.src).toEqual({
        w: c.w,
        h: c.h,
      });
  });

  it('내려받기 단추는 서버 답을 받기 전엔 눌리지 않는다 — 미리 그린 페이지는 «확인하는 중»', () => {
    const { body } = renderPage('ko');
    const m = messagesFor('ko');
    for (const label of [m.dlWindows, m.dlMac])
      expect(body).toMatch(new RegExp(`<button[^>]*disabled[^>]*><svg class="ico"[^]*?</svg>${label}<`));
    expect(body).toContain(m.dlChecking);
    expect(body).not.toContain('releases/download/');
  });
});
