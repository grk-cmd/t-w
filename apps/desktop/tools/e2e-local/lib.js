// 격리된 dev 앱 한 벌을 켜고 끄는 공통부 — flow.js · repl.js 가 쓴다
'use strict';
const { _electron } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..', '..');   // apps/desktop
const API_HOST = 'api-dev.together-working.com';
const API = 'http://127.0.0.1:8080';
const AUTH_EMU = 'http://127.0.0.1:9099';
const STORAGE_EMU = 'http://127.0.0.1:9199';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// opts.version — 앱이 스스로 아는 판(app.getVersion)을 바꾼다(판 확인 시나리오가 «옛 판 · 새 판 PC» 를 흉내 낼 때)
// opts.quiet — 이 앱만 조용한 창을 켜고 끈다(없으면 TW_E2E_QUIET)
function makeApp(outArg, opts = {}){
  const out = path.resolve(outArg);
  const logs = [], reqs = [];
  let offline = false, app = null;

  // 앱이 부르는 dev 주소를 이 PC 의 서버 · 에뮬레이터로 돌린다. keepHost: Auth 에뮬레이터는 주소 앞에 원래 호스트를 붙여 받는다
  async function proxy(route, base, keepHost){
    const r = route.request(), u = new URL(r.url());
    const tag = `${r.method()} ${u.host === API_HOST ? '' : u.host}${u.pathname}`;
    if(offline){ reqs.push(`${tag} OFFLINE`); return route.abort('internetdisconnected'); }
    try {
      const resp = await route.fetch({ url: base + (keepHost ? '/' + u.host : '') + u.pathname + u.search });
      reqs.push(`${tag} ${resp.status()}`);
      await route.fulfill({ response: resp });
    } catch(e){ reqs.push(`${tag} ERR ${e.message}`); await route.abort().catch(() => {}); }
  }

  // 앱은 닫기를 가로챈다(트레이 · 종료 확인) — app.close() 가 멈추므로 exit(0) 하고, 그래도 남으면 그 PID 만 죽인다
  async function quit(){
    if(!app) return;
    const pid = app.process().pid;
    const closed = new Promise((r) => app.once('close', r));
    await app.evaluate(({ app: a }) => setTimeout(() => a.exit(0), 50)).catch(() => {});
    await Promise.race([closed, wait(10000)]);
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch(_){}
  }

  async function launch(){
    // dev 판은 userData 를 appData/<이름>-dev 로 바꾼다(main.js) — --user-data-dir 로는 못 막는다.
    // 감싸는 진입점이 appData 만 시험 폴더로 돌린 뒤 앱 main.js 를 불러, 이 PC 의 dev 앱 폴더를 건드리지 않는다
    const wrap = path.join(out, 'wrap');
    fs.mkdirSync(wrap, { recursive: true });
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(wrap, 'package.json'), JSON.stringify({ name: pkg.name, version: opts.version || pkg.version, main: 'main.js' }));
    // 조용한 창(TW_E2E_QUIET, 기본 켬) — 시험 창이 화면 밖에 뜨고 포커스 · Dock 을 빼앗지 않게. 끄려면 TW_E2E_QUIET=0.
    // 창은 누를 수 있게 둔다(setFocusable(false) 는 입력을 막는다). 화면 밖 창도 타이머 · WebGL 이 돌게 배경 늦추기를 끈다
    const quiet = opts.quiet !== undefined ? !!opts.quiet : process.env.TW_E2E_QUIET !== '0';
    const quietJs = quiet ? [
      `const { app: __a } = require('electron');`,
      `if(process.platform === 'darwin') __a.setActivationPolicy('accessory');`,
      `__a.on('browser-window-created', (_e, w) => {`,
      `  const off = () => { try { if(!w.isDestroyed()) w.setPosition(-20000, -20000); } catch(_){} };`,
      `  off(); w.on('move', () => { const [x] = w.getPosition(); if(x > -10000) off(); });`,
      `  try { w.webContents.setBackgroundThrottling(false); } catch(_){}`,
      `});`,
    ].join('\n') + '\n' : '';
    fs.writeFileSync(path.join(wrap, 'main.js'),
      `require('electron').app.setPath('appData', ${JSON.stringify(path.join(out, 'appdata'))});\n`
      + quietJs
      + `require(${JSON.stringify(path.join(APP_DIR, pkg.main || 'main.js'))});\n`);
    app = await _electron.launch({
      args: [wrap, '--tw-firebase=dev'],
      cwd: APP_DIR,
      executablePath: require(path.join(APP_DIR, 'node_modules', 'electron')),
    });
    // 메인 로그는 켜자마자 건다 — 첫 창이 안 뜨는 실패도 까닭이 남게
    app.process().stdout.on('data', (d) => logs.push('[main] ' + String(d).trim().slice(0, 300)));
    app.process().stderr.on('data', (d) => logs.push('[main-err] ' + String(d).trim().slice(0, 300)));
    const ud = await app.evaluate(({ app: a }) => a.getPath('userData'));
    if(!ud.startsWith(out)){ await quit(); throw new Error('userData 가 시험 폴더 밖: ' + ud); }
    const ctx = app.context();
    await ctx.route(`https://${API_HOST}/**`, (r) => proxy(r, API, false));
    await ctx.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, (r) => proxy(r, AUTH_EMU, true));
    await ctx.route('https://firebasestorage.googleapis.com/**', (r) => proxy(r, STORAGE_EMU, false));
    const hook = (p) => {
      p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
      p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    };
    app.on('window', hook);
    app.windows().forEach(hook);
    const w = await app.firstWindow({ timeout: 90000 });   // 바쁜 PC 에서는 30초 안에 첫 창이 안 뜨는 때가 있다
    // 길 돌리기가 걸리기 전에 첫 화면이 이미 요청을 보냈다 — 다시 읽어 처음부터 돌린 길로 가게 한다
    await w.reload();
    return w;
  }

  // 오프라인 흉내 — 크로미움 쪽 끊기와 길 돌리기 쪽 끊기를 같이 건다
  async function net(off){
    offline = off;
    await app.evaluate(({ session }, o) => session.defaultSession.enableNetworkEmulation({ offline: o }), off);
  }

  return { launch, quit, net, logs, reqs, out, get app(){ return app; } };
}

module.exports = { makeApp, wait, APP_DIR, API_HOST };
