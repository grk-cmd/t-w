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

// 조용히 켜기(기본) — 창을 화면 밖에 두고 포커스 · 앞으로 나오기 · Dock 을 막는다. TW_E2E_QUIET=0 이면 창이 보인다(눈으로 볼 때)
// e2e-room 묶음의 덮개에 맨 위(setAlwaysOnTop) · app.show 막기와 준비 전 accessory 를 더한 것 — 네 묶음이 같은 글을 쓴다
const QUIET = process.env.TW_E2E_QUIET !== '0';

// 감싸는 진입점에 글로 박혀 앱 main.js 보다 먼저 돈다(이 파일의 다른 이름을 쓰지 않는다)
function quietWindows(){
  const { app } = require('electron');
  const OFF = -20000;
  // 화면 밖 · 가려진 창도 타이머 · 그리기 · WebGL 이 멈추지 않게
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  if(process.platform === 'darwin'){
    try { app.setActivationPolicy('accessory'); } catch(_){}   // 준비 전에도 — Dock 아이콘 없음 · 앞으로 안 나옴
    app.whenReady().then(() => { app.setActivationPolicy('accessory'); });
  }
  app.focus = () => {};
  app.show = () => {};
  app.on('browser-window-created', (_e, w) => {
    w.webContents.setBackgroundThrottling(false);
    w.webContents.setAudioMuted(true);   // 같이 듣기 · 효과음이 이 PC 스피커로 나가지 않게
    // 앱이 정한 자리는 그대로 기억해 두고(앱이 읽으면 이 값을 준다) 실제 창만 화면 밖으로 민다.
    // ⚠️ 실제 자리에서 거꾸로 셈하면 안 된다 — 맥은 창을 화면 밖으로 다 못 밀어 가장자리에 붙이므로
    //   거꾸로 센 값이 엉뚱해지고(예: 19660) 앱이 그 값을 «지난 자리» 로 저장한다
    const real = { setBounds: w.setBounds.bind(w), getBounds: w.getBounds.bind(w), setPosition: w.setPosition.bind(w) };
    const b0 = real.getBounds();
    let vx = b0.x, vy = b0.y;
    const keep = (b) => { if(b && typeof b.x === 'number'){ vx = b.x; vy = typeof b.y === 'number' ? b.y : vy; } };
    w.setBounds = (b, an) => { keep(b); real.setBounds(b && typeof b.x === 'number' ? { ...b, x: OFF + b.x } : b, an); };
    w.getBounds = () => ({ ...real.getBounds(), x: vx, y: vy });
    const setCB = w.setContentBounds.bind(w), getCB = w.getContentBounds.bind(w);
    w.setContentBounds = (b, an) => { keep(b); setCB(b && typeof b.x === 'number' ? { ...b, x: OFF + b.x } : b, an); };
    w.getContentBounds = () => { const c = getCB(), r = real.getBounds(); return { ...c, x: vx + (c.x - r.x), y: vy + (c.y - r.y) }; };
    w.setPosition = (x, y, an) => { vx = x; vy = y; real.setPosition(OFF + x, y, an); };
    w.getPosition = () => [vx, vy];
    w.focus = () => {};
    w.moveTop = () => {};
    w.show = () => w.showInactive();
    // 맨 위 — 실제 창은 늘 보통 층에 두고, 앱이 바란 값만 기억해 isAlwaysOnTop 으로 돌려준다(시나리오가 «맨 위로 했나» 를 본다)
    const realTop = w.setAlwaysOnTop.bind(w);
    let top = false;
    realTop(false);
    w.setAlwaysOnTop = (v) => { top = !!v; };
    w.isAlwaysOnTop = () => top;
    // 맥은 창을 화면 밖으로 다 못 민다(가장자리가 남는다) — 안 보이게 하고 마우스도 통과시킨다.
    // 시험의 누르기는 CDP 로 들어가 OS 마우스와 상관없다. 앱의 setIgnoreMouseEvents 는 실제로 걸지 않는다(시나리오가 부른 값만 본다)
    w.setOpacity(0);
    w.setOpacity = () => {};
    w.setIgnoreMouseEvents(true, { forward: false });
    w.setIgnoreMouseEvents = () => {};
    w.__e2eRealBounds = () => real.getBounds();   // 조용한 창 시험(scenarios/core/quiet-check.js)이 실제 자리를 본다
    real.setPosition(OFF + vx, vy);
  });
}

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
      + (QUIET ? `(${quietWindows.toString()})();\n` : '')
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
