// 런처 광고 배너 · 게임 설정 — 관리자(앱 A)가 런처에서 배너 두 장을 저장하면, 다른 사람(앱 B) 런처에 서버 알림으로 뜨고
// 4초마다 다음 장으로 넘어간다 · 다 비우면 둘 다 숨는다. 게임 설정(동물 해금 레벨)을 바꾸면 B 가 받는 카탈로그에 그 값이 실린다.
// 배너 · 해금 레벨은 모두가 같이 보는 서버 값이라 끝에(실패해도) 비우고 원래 레벨로 되돌린다.
'use strict';
const { run } = require('./_kit.js');

const SLIDES = [
  { img: 'https://help.together-working.com/e2e-banner-a.png', link: 'https://together-working.com/e2e-a' },
  { img: 'https://help.together-working.com/e2e-banner-b.png', link: 'https://together-working.com/e2e-b' },
];

async function fillBanner(A, slides){
  await A.w.click('#lcAdBannerEdit');
  await A.w.locator('#adBannerSaveBtn').waitFor({ state: 'visible', timeout: 10000 });
  for(let i = 0; i < 3; i++){
    await A.w.fill('#adBannerImgInput' + i, slides[i] ? slides[i].img : '');
    await A.w.fill('#adBannerLinkInput' + i, slides[i] ? slides[i].link : '');
  }
  await A.w.click('#adBannerSaveBtn');
}
const bannerOf = (A) => A.w.evaluate(() => {
  const a = document.getElementById('lcAdBanner');
  return { shown: getComputedStyle(a).display !== 'none', src: document.getElementById('lcAdBannerImg').getAttribute('src'), href: a.getAttribute('href') };
});
const animalUnlock = async (t, A) => {
  const r = await t.api(A, 'GET', '/v2/catalog');
  const u = ((r.body && r.body.data && r.body.data.unlocks) || []).find((x) => x.kind === 'ANIMAL_CHARACTER' && x.key === 'animal');
  return u ? u.level : null;
};

run('ad-banner', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  await t.step('A 관리자 모드', async () => { await t.makeAdmin(A); await t.enterAdmin(A); });
  const lv0 = await animalUnlock(t, B);
  t.note('처음 동물 해금 레벨 ' + lv0);
  try {
    await t.step('A 배너 두 장 저장 → 저장 알림 · A 런처에 첫 장', async () => {
      await fillBanner(A, SLIDES);
      await t.poll(async () => /배너가 저장됐어요 \(2개\)/.test(await A.w.textContent('#toast')), 8000, '저장 알림');
      const b = await bannerOf(A);
      t.check(b.shown && b.src === SLIDES[0].img && b.href === SLIDES[0].link, 'A 배너: ' + JSON.stringify(b));
    });
    await t.step('B 런처에 서버 알림으로 배너가 뜬다', async () => {
      const b = await t.poll(async () => { const x = await bannerOf(B); return x.shown && x; }, 70000, 'B 배너 보임');
      t.check(SLIDES.some((s) => s.img === b.src && s.link === b.href), 'B 배너가 저장한 장이 아님: ' + JSON.stringify(b));
      await t.shot(B, '01-banner');
    });
    await t.step('B 배너가 4초마다 다음 장으로', async () => {
      const first = (await bannerOf(B)).src;
      const next = await t.poll(async () => { const x = await bannerOf(B); return x.src !== first && x; }, 6000, '다음 장');
      t.check(SLIDES.some((s) => s.img === next.src && s.link === next.href), '다음 장이 저장한 장이 아님');
    });
    await t.step('A 게임 설정 — 동물 해금 레벨을 바꾸면 B 의 카탈로그에 실린다', async () => {
      const want = lv0 === 37 ? 38 : 37;
      await A.w.click('#lcGameCfg');
      await A.w.locator('#gameCfgAnimalLv').waitFor({ state: 'visible', timeout: 10000 });
      await A.w.fill('#gameCfgAnimalLv', String(want));
      await A.w.click('#gameCfgSaveBtn');
      await t.poll(async () => new RegExp('동물 해금 Lv\\.' + want).test(await A.w.textContent('#toast')), 8000, '저장 알림');
      await t.poll(async () => (await animalUnlock(t, B)) === want, 10000, 'B 카탈로그 동물 해금 ' + want);
    });
    await t.step('A 배너를 다 비움 → B 배너 숨음', async () => {
      await fillBanner(A, []);
      await t.poll(async () => !(await bannerOf(A)).shown, 8000, 'A 배너 숨음');
      await t.poll(async () => !(await bannerOf(B)).shown, 70000, 'B 배너 숨음');
    });
  } finally {
    // 모두가 보는 값이라 되돌린다(앞 단계가 실패했어도)
    await t.api(A, 'GET', '/v2/admin/notices/launcher-banner').then((r) => r.body && r.body.data && r.body.data.version != null
      && t.api(A, 'PUT', '/v2/admin/notices/launcher-banner', { version: r.body.data.version, slides: [] })).catch(() => {});
    if(lv0 != null){
      const r = await t.api(A, 'GET', '/v2/catalog').catch(() => null);
      const u = r && ((r.body.data.unlocks) || []).find((x) => x.kind === 'ANIMAL_CHARACTER' && x.key === 'animal');
      if(u && u.level !== lv0) await t.api(A, 'PUT', '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal', { version: u.version, level: lv0, label: u.label }).catch(() => {});
    }
  }
});
