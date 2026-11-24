// 📘 도움말 탭 — 칸 안의 도움말 페이지가 보낸 목차가 왼쪽에 그려진다 · 묶음을 펴고 편을 누르면 그 편이 열린다
// 도움말 사이트(help.together-working.com)는 route-main.js 가 저장소의 firebase/hosting/help 파일로 답한다(바깥 인터넷 없이 · 지금 저장소의 페이지로)
// 못 불러올 때(E-MH-01)는 안 본다 — 그 사이트를 이 PC 파일로 답하므로 «닿지 못함» 을 만들 길이 없다(sim-help-tab 이 본다)
'use strict';
const { scenario, assert, openMyHome } = require('./_kit.js');

scenario('help-tab', async (t) => {
  const a = await t.user('a', { name: '에이' });

  await t.step('도움말 탭 → 목차가 그려진다', async () => {
    await openMyHome(a, 'help');
    await a.until(() => document.querySelectorAll('#mhHelpRail .mh-help-grp').length > 0, null, { timeout: 20000, what: '목차 묶음' });
    assert(!(await a.eval(() => document.getElementById('mhHelpFail').classList.contains('on'))), '«못 불러옴» 이 켜짐');
    assert(a.sawReq(/^GET help\.together-working\.com\/[^ ]* 200$/), '도움말 페이지 요청 — ' + a.A.reqs.filter((l) => /help\./.test(l)).slice(0, 5).join(','));
    const groups = await a.eval(() => [...document.querySelectorAll('#mhHelpRail .mh-help-grp')].map((e) => e.textContent.trim()));
    t.note('목차 ' + groups.join(' / ').slice(0, 200));
  });

  await t.step('묶음을 펴고 편을 누르면 그 편이 열린다', async () => {
    await a.w.locator('#mhHelpRail .mh-help-grp').first().click();
    const ep = a.w.locator('#mhHelpRail .mh-help-ep').first();
    await ep.waitFor({ state: 'visible', timeout: 10000 });
    const title = (await ep.textContent()).trim();
    await ep.click();
    await a.until(() => !!document.querySelector('#mhHelpRail .mh-help-ep.on'), null, { what: '편 표시' });
    const src = await a.eval(() => document.querySelector('#mhHelpView iframe').src);
    assert(/help\.together-working\.com\/[a-z0-9-]+\?theme=/.test(src), '틀 주소 ' + src);
    const on = (await a.text('#mhHelpRail .mh-help-ep.on')).trim();
    assert(on === title, `켜진 편 ${on} ≠ ${title}`);
    const slug = src.match(/help\.together-working\.com\/([a-z0-9-]+)\?/)[1];
    assert(a.sawReq(new RegExp('^GET help\\.together-working\\.com/' + slug + ' 200$')), '편 페이지 요청 ' + slug);
  });
});
