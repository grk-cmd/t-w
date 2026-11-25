// create.js <e2e-local 폴더> <결과 폴더>/seed — seed.js 로 로그인해 둔 appdata 에 캐릭터 3칸을 만들고 칸마다 카탈로그 파츠 셋을 입힌다
'use strict';
const path = require('path'), fs = require('fs');
const E = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]);
process.env.TW_E2E_OUT = path.dirname(OUT);
const lib = require(E + '/lib.js');
const S = require(E + '/scenarios/_shared.js');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const A = lib.makeApp(OUT);
  const w = await A.launch();
  try{
  await w.locator('#lcNameBtn').waitFor({ state: 'visible', timeout: 60000 });
  await S.waitUntil(() => w.evaluate(() => TwRtHub.store.state() === 'ready' && closetMod.state() === 'ready'), { ms: 40000, what: 'ready' });
  const uid = await S.uidOf(w);
  S.seedSql('admin.sql', { uid });
  const shown = (sel) => w.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetWidth > 0; }, sel);
  for(let slot = 0; slot < 3; slot++){
    if(await w.evaluate((i) => !!slots[i], slot)) { log('이미', slot); continue; }
    await w.evaluate((i) => { curSlot = i; renderLauncher(); }, slot);
    await S.waitUntil(async () => { if(await shown('#raceHuman')) return true; await w.click('#lcEmpty'); await lib.wait(1500); return shown('#raceHuman'); }, { ms: 30000, what: '종족 창' });
    await w.click('#raceHuman');
    await w.locator('#crNext').waitFor({ state: 'visible', timeout: 20000 });
    for(let i = 0; i < 20 && !(await shown('#crDone')); i++){ await w.click('#crNext'); await lib.wait(400); }
    await w.screenshot({ path: OUT + '/c' + slot + '.png' });
    await w.click('#crDone');
    await lib.wait(3000);
    await w.screenshot({ path: OUT + '/d' + slot + '.png' });
    log('toast', await w.textContent('#toast'));
    await S.waitUntil(async () => { const x = await S.apiIn(w, 'GET', '/v2/me/avatars'); return x.body && x.body.data && x.body.data.slots[slot]; }, { ms: 20000, what: '슬롯 ' + slot });
    log('캐릭터', slot);
  }
  const cats = JSON.parse(process.env.CATS || '["hat","mask","glasses","top","bottom","onepiece","cape","wing","handL"]');
  const worn = await w.evaluate(async (cats) => {
    const out = [];
    for(let i = 0; i < 3; i++){
      const ep = {};
      for(let k = 0; k < 3; k++){ const n = i * 3 + k; ep[cats[n % cats.length]] = { id: 'bench' + String(n).padStart(3, '0') }; }
      slots[i].equippedParts = ep; out.push(ep);
    }
    curSlot = 0; saveCurSlot();
    slotSaveMod.saveSlots(); await closetMod.flushSlots();
    return out;
  }, cats);
  log('입힘', JSON.stringify(worn));
  const av = await S.apiIn(w, 'GET', '/v2/me/avatars');
  log('서버', JSON.stringify(av.body.data).slice(0, 300));
  fs.writeFileSync(path.join(path.dirname(OUT), 'account.json'), JSON.stringify({ uid, worn }));
  } finally {
  fs.writeFileSync(OUT + '/console.txt', A.logs.join('\n'));
  fs.writeFileSync(OUT + '/requests.txt', A.reqs.join('\n'));
  await A.quit();
  }
  process.exit(0);
})().catch((e) => { console.error('실패', e); process.exit(1); });
