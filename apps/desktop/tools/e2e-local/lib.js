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
  const quiet = opts.quiet !== undefined ? !!opts.quiet : process.env.TW_E2E_QUIET !== '0';
  let app = null;
  let netLog = '', netPos = 0;
  const blocked = [];
  // route-main.js 의 기록을 읽어 옮긴다(REQ <방법> <표시> <상태> → reqs 에 옛 모양 «<방법> <표시> <상태>» · BLOCK … → blocked)
  function readNet(){
    if(!netLog) return;
    let buf;
    try { buf = fs.readFileSync(netLog, 'utf8'); } catch(_){ return; }
    const fresh = buf.slice(netPos);
    const end = fresh.lastIndexOf('\n');
    if(end < 0) return;
    netPos += end + 1;
    for(const line of fresh.slice(0, end).split('\n')){
      if(line.startsWith('REQ ')) reqs.push(line.slice(4));
      else if(line.startsWith('BLOCK ')) blocked.push(line.slice(6));
    }
  }
  const netTimer = setInterval(readNet, 200);
  netTimer.unref();

  // 앱은 닫기를 가로챈다(트레이 · 종료 확인) — app.close() 가 멈추므로 exit(0) 하고, 그래도 남으면 그 PID 만 죽인다
  async function quit(){
    if(!app) return;
    const pid = app.process().pid;
    const closed = new Promise((r) => app.once('close', r));
    await app.evaluate(({ app: a }) => setTimeout(() => a.exit(0), 50)).catch(() => {});
    await Promise.race([closed, wait(10000)]);
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch(_){}
    readNet();   // 끄기 직전 줄까지
  }

  async function launch(){
    // dev 판은 userData 를 appData/<이름>-dev 로 바꾼다(main.js) — --user-data-dir 로는 못 막는다.
    // 감싸는 진입점이 appData 만 시험 폴더로 돌린 뒤 앱 main.js 를 불러, 이 PC 의 dev 앱 폴더를 건드리지 않는다
    const wrap = path.join(out, 'wrap');
    fs.mkdirSync(wrap, { recursive: true });
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(wrap, 'package.json'), JSON.stringify({ name: pkg.name, version: opts.version || pkg.version, main: 'main.js' }));
    // 조용한 창(TW_E2E_QUIET, 기본 켬) — 시험 창이 화면 밖에 뜨고 포커스 · Dock 을 빼앗지 않게(quiet-main.js). 끄려면 TW_E2E_QUIET=0
    // route-main.js 가 남기는 줄(REQ · BLOCK)을 읽어 reqs · blocked 에 옮긴다 — 켤 때마다 새 파일
    readNet();   // 앞 판(다시 켜기 전)이 남긴 줄을 먼저 옮긴다 — 파일을 비우면 사라진다
    const b0 = blocked.length;   // 이번 켜기에 막힌 것만 본다(앞 판에서 막힌 것은 그때 이미 보고됨)
    netLog = path.join(out, 'net.txt');
    fs.writeFileSync(netLog, '');
    netPos = 0;
    const quietJs = quiet ? `require(${JSON.stringify(path.join(__dirname, 'quiet-main.js'))});\n` : '';
    fs.writeFileSync(path.join(wrap, 'main.js'),
      `require('electron').app.setPath('appData', ${JSON.stringify(path.join(out, 'appdata'))});\n`
      + quietJs
      // 주소 돌리기 · 진짜 서버 막기(route-main.js) — 조용한 창과 상관없이 늘 건다. 앱 main.js 보다 먼저 'ready' 를 들어 첫 요청부터 걸린다
      + `require(${JSON.stringify(path.join(__dirname, 'route-main.js'))})(${JSON.stringify({ log: netLog, api: API, auth: AUTH_EMU, storage: STORAGE_EMU, helpDir: path.resolve(APP_DIR, '..', '..', 'firebase', 'hosting', 'help') })});\n`
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
    const hook = (p) => {
      p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
      p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    };
    app.on('window', hook);
    app.windows().forEach(hook);
    const w = await app.firstWindow({ timeout: 90000 });   // 바쁜 PC 에서는 30초 안에 첫 창이 안 뜨는 때가 있다
    // 주소 돌리기가 정말 걸렸나 — 앱 세션으로 진짜 API 주소를 부르면 이 PC 의 API 가 답해야 한다(돌린 기록에 남음).
    // 창이 아니라 세션(main)에서 부른다 — 창은 켜는 동안 스스로 다시 읽어서 그 사이에 부르면 맥락이 사라진다. 창의 길은 launcher/routing.js 가 본다.
    // 다시 읽기 · 다시 켜기로 감추지 않는다 — 안 걸렸으면 앱을 끄고 실패한다(진짜 서버로 나간 요청이 있으면 그것도 실패)
    readNet();
    const r0 = reqs.length;   // 확인은 이번 부름의 줄로만 — 앞 켜기의 줄로 통과하면 안 된다
    const probe = await app.evaluate(async ({ session }, h) => {
      try { const r = await session.defaultSession.fetch(`https://${h}/actuator/health`, { cache: 'no-store' }); return r.status; }
      catch(e){ return 'ERR ' + e.message; }
    }, API_HOST);
    await wait(400); readNet();
    if(probe !== 200 || !reqs.slice(r0).some((r) => /^GET \/actuator\/health 200$/.test(r))){
      await quit();
      throw new Error(`주소 돌리기가 안 걸림 — 앱 세션의 https://${API_HOST}/actuator/health → ${probe} · 돌린 기록 ${reqs.slice(-3).join(' | ') || '없음'}`);
    }
    if(blocked.length > b0){ await quit(); throw new Error('진짜 서버로 나간 요청을 막음: ' + blocked.slice(b0).join(' | ')); }
    return w;
  }

  // 오프라인 흉내 — 크로미움 쪽 끊기와 주소 돌리기(route-main.js) 쪽 끊기를 같이 건다
  async function net(off){
    await app.evaluate(({ session }, o) => { global.__e2eOffline = o; session.defaultSession.enableNetworkEmulation({ offline: o }); }, off);
  }

  // 이 앱이 받는 API JSON 답의 data 를 고친다(route-main.js 가 돌린 답에서) — 같이 쓰는 로컬 서버 값은 건드리지 않는다.
  // edit 는 밖 값을 잡지 않는 순수 함수(글로 옮겨 main 에서 되살린다) · pathRe 는 «길?질의» 에 맞출 정규식 글
  async function editJson(method, pathRe, edit){
    await app.evaluate((_e, a) => { global.__e2eEdits.push({ method: a.method, re: new RegExp(a.re), fn: (0, eval)('(' + a.src + ')') }); },
      { method, re: pathRe, src: edit.toString() });
  }
  // reqs · blocked 는 읽을 때마다 기록 파일을 따라잡는다 — 타이머만 믿으면 앱이 답을 받은 뒤 0~200ms 동안 줄이 비어 바로 본 검사가 흔들린다
  return { launch, quit, net, editJson, logs, out, quiet,
    get reqs(){ readNet(); return reqs; }, get blocked(){ readNet(); return blocked; }, get app(){ return app; } };
}

/** 조용한 창이 지켜지나 — 켜 둔 앱의 창마다 진짜 자리 · 투명도 · 소리 · 포커스를 보고 어긋난 것을 글로 돌려준다(빈 배열 = 조용함).
 *  화면 밖: mac 은 화면 밖 창을 화면 끝으로 당겨 놓아, 어느 화면과도 4분의 1 넘게 겹치지 않으면 밖으로 본다.
 *  조용히 켜지 않은 앱(makeApp 의 quiet — TW_E2E_QUIET=0 · opts.quiet:false)은 부르는 쪽이 건너뛴다(앱 객체의 .quiet) */
async function quietProblems(app){
  if(!app) return [];
  const s = await app.evaluate(({ BrowserWindow, screen, webContents }) => ({
    blocked: (global.__e2eBlocked || []).slice(),   // route-main.js 가 막은 진짜 서버 요청
    displays: screen.getAllDisplays().map((d) => d.bounds),
    // 창에 안 달린 webContents(BrowserView 의 BGM · 같이 듣기)도 소리를 본다
    loud: webContents.getAllWebContents().filter((c) => !c.isDestroyed() && (typeof c.__e2eRealAudioMuted === 'function' ? !c.__e2eRealAudioMuted() : !c.isAudioMuted())).map((c) => c.getURL().slice(0, 80)),
    focused: !!BrowserWindow.getFocusedWindow(),
    wins: BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => ({
      wrapped: typeof w.__e2eRealBounds === 'function',
      real: typeof w.__e2eRealBounds === 'function' ? w.__e2eRealBounds() : w.getBounds(),
      opacity: typeof w.__e2eRealOpacity === 'function' ? w.__e2eRealOpacity() : w.getOpacity(),
      muted: typeof w.webContents.__e2eRealAudioMuted === 'function' ? w.webContents.__e2eRealAudioMuted() : w.webContents.isAudioMuted(),
      realAot: typeof w.__e2eRealAlwaysOnTop === 'function' ? w.__e2eRealAlwaysOnTop() : w.isAlwaysOnTop(),
      focus: w.isFocused(), title: w.getTitle(),
    })),
  }));
  const overlap = (r, d) => Math.max(0, Math.min(r.x + r.width, d.x + d.width) - Math.max(r.x, d.x)) * Math.max(0, Math.min(r.y + r.height, d.y + d.height) - Math.max(r.y, d.y));
  const bad = [];
  for(const u of s.blocked) bad.push('진짜 서버로 나가려던 요청을 막음 ' + u);
  if(s.focused) bad.push('포커스 받은 창이 있음');
  if(s.loud.length) bad.push('소리 켜진 webContents ' + JSON.stringify(s.loud));
  if(!s.wins.length) bad.push('창이 하나도 안 보임(getAllWindows 0 — 감싸기가 창 목록을 가림)');
  for(const w of s.wins){
    const why = [];
    if(!w.wrapped) why.push('감싸지 않은 창');
    if(s.displays.some((d) => overlap(w.real, d) > 0.25 * w.real.width * w.real.height)) why.push('화면 안 ' + JSON.stringify(w.real));
    if(w.opacity !== 0) why.push('보임(opacity ' + w.opacity + ')');
    if(w.muted !== true) why.push('소리 켜짐');
    if(w.focus) why.push('포커스');
    if(w.realAot) why.push('늘 위');
    if(why.length) bad.push('«' + w.title + '» ' + why.join(' · '));
  }
  return bad;
}

module.exports = { makeApp, wait, quietProblems, APP_DIR, API_HOST };
