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

function makeApp(outArg){
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
    fs.writeFileSync(path.join(wrap, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, main: 'main.js' }));
    fs.writeFileSync(path.join(wrap, 'main.js'),
      `require('electron').app.setPath('appData', ${JSON.stringify(path.join(out, 'appdata'))});\n`
      + `require(${JSON.stringify(path.join(APP_DIR, pkg.main || 'main.js'))});\n`);
    app = await _electron.launch({
      args: [wrap, '--tw-firebase=dev'],
      cwd: APP_DIR,
      executablePath: require(path.join(APP_DIR, 'node_modules', 'electron')),
    });
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
    app.process().stdout.on('data', (d) => logs.push('[main] ' + String(d).trim().slice(0, 300)));
    app.process().stderr.on('data', (d) => logs.push('[main-err] ' + String(d).trim().slice(0, 300)));
    app.on('window', hook);
    app.windows().forEach(hook);
    const w = await app.firstWindow();
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
