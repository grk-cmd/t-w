// 0.13 dev 앱을 처음부터 끝까지 — 가입 → 다시 켜기 → 로그인된 책상 → 얼굴 · GLB 올리기 · 받기 → 오프라인 · 온라인
// node flow.js <결과 폴더> [초대 코드]
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, wait, API_HOST, PW } = require('./lib.js');

const [outArg, invite = 'INVT-E2E2-TEST'] = process.argv.slice(2);
if(!outArg){ console.error('쓰는 법: node flow.js <결과 폴더> [초대 코드]'); process.exit(2); }
const A = makeApp(outArg);
const out = A.out;
const steps = [];
const save = () => {
  fs.writeFileSync(path.join(out, 'console.txt'), A.logs.join('\n'));
  fs.writeFileSync(path.join(out, 'requests.txt'), A.reqs.join('\n'));
  fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n'));
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let w = await A.launch();
  const shot = (n) => w.screenshot({ path: path.join(out, n + '.png') });
  const step = async (name, fn) => {
    const t = Date.now();
    try { await fn(); steps.push(`ok   ${name} (${Date.now() - t}ms)`); }
    catch(e){ steps.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await shot('fail-' + steps.length).catch(() => {}); throw e; }
    finally { save(); }
  };
  let fc = '';
  await step('초대 화면', async () => {
    await w.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 20000 });
    await shot('01-invite');
  });
  await step('초대 코드 입력', async () => {
    await w.fill('#inviteGateInput', invite);
    await w.click('#inviteGateOk');
    await w.locator('#signupPw').waitFor({ state: 'visible', timeout: 15000 });
    fc = (await w.textContent('#signupCode')).trim();
    steps.push('     친구 코드 ' + fc);
    await shot('02-signup');
  });
  await step('가입', async () => {
    await w.fill('#signupPw', PW);
    await w.fill('#signupPw2', PW);
    await w.click('#signupOk');
    await w.locator('#sdStart').waitFor({ state: 'visible', timeout: 30000 });
    await shot('03-signup-done');
  });
  fs.writeFileSync(path.join(out, 'account.json'), JSON.stringify({ fc, pw: PW }));
  // [시작하기] 는 앱을 다시 켠다(relaunch + 종료). 시험에서는 relaunch 예약만 막고 같은 결과 폴더로 스크립트가 다시 켠다
  await step('시작하기 → 다시 켜기', async () => {
    await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
    const closed = new Promise((r) => A.app.once('close', r));
    await w.click('#sdStart');
    await Promise.race([closed, wait(20000).then(() => { throw new Error('20초 안에 꺼지지 않음'); })]);
    A.logs.push('--- relaunch ---');
    w = await A.launch();
  });
  await step('로그인된 책상', async () => { await wait(15000); await shot('04-desk'); });
  // 얼굴(PNG) · GLB 를 앱의 Storage 길(window.firebaseAPI)로 올리고, 받은 주소를 앱 화면에서 다시 내려받는다(CSP img-src · connect-src 까지)
  await step('얼굴 올리기 · 받기', async () => {
    const r = await w.evaluate(async (host) => {
      const me = await (await fetch(`https://${host}/v2/me`, { headers: { Authorization: 'Bearer ' + await window.firebaseAPI.getIdToken() } })).json();
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#f80';
      g.fillRect(0, 0, 64, 64);
      const up = await window.firebaseAPI.uploadRoomFace(me.data.userCode, 'e2e' + Date.now(), c.toDataURL('image/png'));
      if(!up.ok) return { up };
      const size = await new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(-1); im.src = up.url; });
      return { up, size };
    }, API_HOST);
    steps.push('     ' + JSON.stringify(r).slice(0, 200));
    if(!r.up.ok || r.size !== 64) throw new Error('얼굴 왕복 실패');
  });
  await step('GLB 올리기 · 받기', async () => {
    const r = await w.evaluate(async (host) => {
      const me = await (await fetch(`https://${host}/v2/me`, { headers: { Authorization: 'Bearer ' + await window.firebaseAPI.getIdToken() } })).json();
      // glTF 머리(glTF · 판 2 · 길이 64) 뒤에 알아볼 수 있는 바이트를 채운다
      const bytes = new Uint8Array(64);
      bytes.set([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 64, 0, 0, 0]);
      for(let i = 12; i < 64; i++) bytes[i] = i;
      const up = await window.firebaseAPI.uploadSlotGlb(me.data.userCode, 'e2e' + Date.now(), btoa(String.fromCharCode(...bytes)));
      if(!up.ok) return { up };
      const got = new Uint8Array(await (await fetch(up.url)).arrayBuffer());
      return { up, same: got.length === 64 && got.every((v, i) => v === bytes[i]) };
    }, API_HOST);
    steps.push('     ' + JSON.stringify(r).slice(0, 200));
    if(!r.up.ok || !r.same) throw new Error('GLB 왕복 실패');
  });
  // 로그인한 채로 오프라인 → 온라인(열린 localhost 웹소켓은 이걸로 안 끊긴다 — README «함정»)
  await step('오프라인', async () => { A.reqs.push('--- offline ---'); await A.net(true); await wait(20000); await shot('05-offline'); });
  await step('온라인', async () => { A.reqs.push('--- online ---'); await A.net(false); await wait(25000); await shot('06-online'); });
  save();
  await A.quit();
})().catch(async (e) => {
  steps.push('ABORT ' + e.message.split('\n')[0]);
  save();
  await A.quit().catch(() => {});
  process.exit(1);
});
