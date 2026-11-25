// 임시 — 크리스마스 화면 손 확인(커밋하지 않음). 결과 폴더는 새 이름으로 넘긴다.
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, wait } = require('./lib.js');
const S = require('./scenarios/_shared.js');
const OUT = process.argv[2];
const SHOTS = process.argv[3];
const log = (...a) => console.log('[xmas]', ...a);
const vis = (w, sel) => w.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
const until = async (fn, ms, what) => { const t = Date.now(); for(;;){ try { if(await fn()) return; } catch(_){} if(Date.now() - t > ms) throw new Error(what); await wait(300); } };

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const INVITE = 'INVT-XMAS-E2E1';
  S.seedSql('invite.sql', { code: INVITE });
  const acct = await S.apiUser(INVITE);
  log('계정', acct.fc);
  const A = makeApp(OUT);
  let w = await A.launch();
  await until(() => vis(w, '#inviteGateFc'), 45000, '로그인 게이트');
  await w.fill('#inviteGateFc', acct.fc); await w.fill('#inviteGatePw', acct.pw);
  await A.app.evaluate(({ app: a }) => { a.relaunch = () => setTimeout(() => a.exit(0), 1500); });
  const closed = new Promise((r) => A.app.once('close', r));
  await w.click('#inviteGateFcBtn');
  await Promise.race([closed, wait(30000)]);
  await A.quit();
  w = await A.launch();
  await until(() => vis(w, '#lcLoad'), 60000, '런처');
  fs.writeFileSync(path.join(OUT, 'acct.json'), JSON.stringify({ fc: acct.fc }));
  fs.writeFileSync(path.join(OUT, 'ready'), String(A.app.process().pid));
  log('ready');
  const cmdDir = path.join(OUT, 'cmd'); fs.mkdirSync(cmdDir, { recursive: true });
  const done = new Set();
  const ctx = { A, get w(){ return w; }, fs, out: OUT, wait, vis, until, shot: async (n) => { await w.screenshot({ path: path.join(SHOTS, n + '.png') }); return n; } };
  for(;;){
    for(const f of fs.readdirSync(cmdDir).filter((x) => x.endsWith('.js')).sort()){
      if(done.has(f)) continue; done.add(f);
      let res;
      try { res = await new Function('c', `return (async () => { const { A, w, fs, out, wait, vis, until, shot } = c; ${fs.readFileSync(path.join(cmdDir, f), 'utf8')} })()`)(ctx); }
      catch(e){ res = 'ERR ' + String(e.stack || e).split('\n').slice(0, 3).join('\n'); }
      fs.writeFileSync(path.join(cmdDir, f.replace(/\.js$/, '.out')), typeof res === 'string' ? res : JSON.stringify(res, null, 1));
      fs.writeFileSync(path.join(OUT, 'console.txt'), A.logs.join('\n'));
      fs.writeFileSync(path.join(OUT, 'requests.txt'), A.reqs.join('\n'));
      if(res === 'QUIT'){ await A.quit(); process.exit(0); }
    }
    await wait(300);
  }
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
