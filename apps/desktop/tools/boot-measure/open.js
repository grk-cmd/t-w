// open.js <e2e-local 폴더> <결과 폴더> — 켠 뒤 마이홈 · 플레이리스트 · 꾸미기 창을 차례로 열어 그때 나간 요청(ddays · playlist · collection · gacha)과 화면을 남긴다
'use strict';
const path = require('path'), fs = require('fs');
const E = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]);
const lib = require(E + '/lib.js');
(async () => {
  const A = lib.makeApp(OUT); const w = await A.launch();
  const mark = () => A.reqs.length; const since = (n) => A.reqs.slice(n).filter((r) => /ddays|gacha|collection|playlist/.test(r));
  await lib.wait(9000);
  const out = { boot: since(0) };
  let n = mark(); await w.click('#lcNameBtn'); await lib.wait(2500); out.myhome = since(n); await w.screenshot({ path: OUT + '/myhome.png' });
  await w.keyboard.press('Escape'); await lib.wait(800);
  await w.evaluate(() => { const o = document.getElementById('myHomeOverlay'); if(o) o.classList.remove('on'); });
  await w.click('#lcPreview'); await lib.wait(3000); out.wins = A.app.windows().length; out.run = await w.evaluate(() => document.body.className + ' ' + !!document.getElementById('myPlBtn') + ' ' + location.href.slice(-40)).catch((e) => 'ERR ' + e.message);
  console.log(JSON.stringify(out)); n = mark(); await w.evaluate(() => document.getElementById('myPlBtn').click()); await lib.wait(2500); out.playlist = since(n); await w.screenshot({ path: OUT + '/playlist.png' });
  n = mark(); await w.evaluate(() => document.getElementById('myWardrobeBtn').click()); await lib.wait(3000); out.wardrobe = since(n); await w.screenshot({ path: OUT + '/wardrobe.png' });
  console.log(JSON.stringify(out));
  fs.writeFileSync(OUT + '/console.txt', A.logs.join('\n'));
  await A.quit(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
