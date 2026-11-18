// 📘 도움말 탭 — 칸 안의 도움말 페이지가 보낸 목차가 왼쪽에 그려진다 · 목차의 편을 누르면 그 편이 열린다 · 못 불러오면 «못 불러옴» + 오류 E-MH-01 · [다시 시도]
// 도움말 사이트(help.together-working.com)는 이 저장소의 firebase/hosting/help 파일을 그대로 돌려준다(바깥 인터넷 없이 · 지금 저장소의 페이지로)
'use strict';
const fs = require('fs');
const path = require('path');
const { scenario, assert, openMyHome } = require('./_kit.js');

const HELP_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'firebase', 'hosting', 'help');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
function serve(route){
  const u = new URL(route.request().url());
  let p = decodeURIComponent(u.pathname);
  if(p.endsWith('/')) p += 'index.html';
  let f = path.join(HELP_DIR, p);
  if(!f.startsWith(HELP_DIR)) return route.fulfill({ status: 404, body: '' });
  if(!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';   // Hosting cleanUrls 와 같게
  if(!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
}

scenario('help-tab', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const HELP = /^https:\/\/help\.together-working\.com\//;
  let mode = 'down';
  await a.A.app.context().route(HELP, (r) => (mode === 'down' ? r.abort('connectionrefused') : serve(r)));
  assert(fs.existsSync(path.join(HELP_DIR, 'embed.js')), '도움말 페이지 폴더 ' + HELP_DIR);

  await t.step('사이트에 못 닿으면 «못 불러옴» · 오류 E-MH-01', async () => {
    await openMyHome(a, 'help');
    await a.until(() => document.getElementById('mhHelpFail').classList.contains('on'), null, { timeout: 20000, what: '못 불러옴' });
    await a.until(() => /오류 E-MH-01/.test(document.getElementById('toast').textContent), null, { what: 'E-MH-01 토스트' });
  });

  await t.step('[다시 시도] → 목차가 그려진다', async () => {
    mode = 'up';
    await a.w.click('#mhHelpRetry');
    await a.until(() => !document.getElementById('mhHelpFail').classList.contains('on') && document.querySelectorAll('#mhHelpRail .mh-help-grp').length > 0, null, { timeout: 20000, what: '목차 묶음' });
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
  });
});
