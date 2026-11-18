// core 묶음 시나리오가 같이 쓰는 도구 — 결과 폴더 · 단계 기록 · 새 계정 가입 · API 부르기 · DB 시드 · 공유 스택 잠금
// 시나리오 한 파일 = run(name, async (t) => { … }). 단계 하나라도 FAIL 이면 종료 코드 1.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeApp, wait, API_HOST, APP_DIR } = require('../../lib.js');

const ROOT = process.env.TW_E2E_OUT || '/tmp/tw-e2e/core';
const PW = 'e2e-pass-1234';   // 에뮬레이터 안에서만 쓰는 시험 비밀번호
// 이 묶음이 쓰는 초대 코드 — seed/core-invite.sql 이 넣는다(다른 묶음과 사용 횟수를 나눠 쓰지 않게)
const INVITE = process.env.TW_E2E_INVITE || 'INVT-C2RE-TEST';
const PG = process.env.TW_E2E_PG || 'tw-dev-local-postgres-1';
const RT = process.env.TW_E2E_RT || 'tw-dev-local-rooms-dev-1';
// 공유 컨테이너를 멈추거나 다시 켤 때만 잡는 잠금(mkdir 은 원자적). 같은 스택을 쓰는 모든 시험이 같은 경로를 써야 해서
// 기본값을 두지 않는다 — 비어 있으면 컨테이너를 건드리는 시나리오가 시작 전에 멈춘다
const LOCK = process.env.TW_E2E_STACK_LOCK || '';

function docker(args, opts){
  const env = Object.assign({}, process.env);
  // /var/run/docker.sock 이 꺼진 Docker Desktop 을 가리킬 수 있다 — OrbStack 소켓이 있으면 그쪽
  const orb = path.join(process.env.HOME || '', '.orbstack/run/docker.sock');
  if(!env.DOCKER_HOST && fs.existsSync(orb)) env.DOCKER_HOST = 'unix://' + orb;
  return execFileSync('docker', args, Object.assign({ env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }, opts || {}));
}

// psql 한 번 — 결과는 칸 구분 '|' 줄들(머리 없음)
function sql(query){
  return docker(['exec', '-i', PG, 'psql', '-U', 'tw_api_dev', '-d', 'tw_dev', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'], { input: query }).trim();
}
// seed/ 의 SQL 파일을 :'이름' 변수와 함께 돌린다
function seed(file, vars){
  const args = ['exec', '-i', PG, 'psql', '-U', 'tw_api_dev', '-d', 'tw_dev', '-v', 'ON_ERROR_STOP=1', '-At'];
  for(const [k, v] of Object.entries(vars || {})) args.push('-v', `${k}=${v}`);
  return docker(args, { input: fs.readFileSync(path.join(__dirname, '..', '..', 'seed', file), 'utf8') }).trim();
}

// 앱(Electron)을 켜는 동안만 잡는 실행 잠금 — 네 묶음이 같이 쓰는 runlock.js(TW_E2E_RUN_LOCK · run-all 이 들고 있으면 다시 안 잡음)
const { acquire } = require('../../runlock.js');
const QUIET = process.env.TW_E2E_QUIET !== '0';

async function withStackLock(fn, maxWaitMs = 600000){
  if(!LOCK) throw new Error('TW_E2E_STACK_LOCK(공유 스택 잠금 경로)가 없다 — 컨테이너를 건드리지 않고 멈춤');
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const t0 = Date.now();
  for(;;){
    try { fs.mkdirSync(LOCK); break; }
    catch(e){
      if(e.code !== 'EEXIST') throw e;
      if(Date.now() - t0 > maxWaitMs) throw new Error('스택 잠금을 못 잡음: ' + LOCK);
      await wait(2000);
    }
  }
  try { fs.writeFileSync(path.join(LOCK, 'owner'), `e2e-core ${process.pid} ${new Date().toISOString()}`); } catch(_){}
  try { return await fn(); }
  finally {
    try { fs.rmSync(path.join(LOCK, 'owner'), { force: true }); } catch(_){}
    try { fs.rmdirSync(LOCK); } catch(_){}
  }
}

async function poll(fn, ms, what, every = 300){
  const t0 = Date.now();
  let last;
  for(;;){
    try { last = await fn(); if(last) return last; } catch(e){ last = e; }
    if(Date.now() - t0 > ms) throw new Error(`${what} — ${ms}ms 안에 안 됨` + (last instanceof Error ? ` (${last.message.split('\n')[0]})` : ''));
    await wait(every);
  }
}

// 여러 앱이 같이 돌면 켜기(첫 창 · 다시 읽기)가 가끔 30초를 넘겨 멈춘다 — 끄고 두 번까지 다시 켠다
// 켠 뒤 주소 돌리기가 실제로 걸렸는지도 본다 — 가끔 요청이 돌리기를 거치지 않고 바깥 dev 주소로 나간다(502)
async function launchRetry(A){
  for(let i = 0; ; i++){
    try {
      const w = await A.launch();
      const n = A.reqs.length;
      await w.evaluate((h) => fetch(`https://${h}/v2/config?e2e-probe=1`).catch(() => null), API_HOST);
      if(!A.reqs.slice(n).some((r) => r.includes('/v2/config'))) throw new Error('주소 돌리기가 안 걸림');
      return w;
    }
    catch(e){
      A.logs.push('--- launch 실패: ' + String(e.message).split('\n')[0]);
      await A.quit().catch(() => {});
      // 켜다 멈춘 앱이 남아 있으면 같은 폴더의 다음 앱이 «두 번째 실행» 으로 바로 꺼진다 — 이 폴더로 켠 앱만 끈다
      let pids = [];
      try { pids = execFileSync('pgrep', ['-f', path.join(A.out, 'wrap')], { encoding: 'utf8' }).split('\n').map(Number).filter(Boolean); } catch(_){}
      for(const pid of pids){ try { process.kill(pid, 'SIGKILL'); } catch(_){} }
      await wait(1000);
      if(i >= 2) throw e;
    }
  }
}

// 앱 없이 만드는 계정 — 신고자처럼 «사람 수» 만 필요한 쪽. 가입(POST /v2/users) → Auth 에뮬레이터에 친구 코드 메일로 로그인 → 그 토큰으로 API
// 앱과 같은 길(친구 코드 → <코드>@tw.local)을 쓴다 — firebase-init.js
async function headlessUser(){
  const API = 'http://127.0.0.1:8080';
  const j = async (r) => { let b = null; try { b = await r.json(); } catch(_){} return { status: r.status, body: b }; };
  const join = await j(await fetch(API + '/v2/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PW, requestId: 'e2e-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), inviteCode: INVITE }) }));
  if(join.status !== 200) throw new Error('앱 없는 가입 ' + join.status + ' ' + JSON.stringify(join.body).slice(0, 120));
  const fc = join.body.data.friendCode;
  const login = await j(await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fc.toLowerCase() + '@tw.local', password: PW, returnSecureToken: true }) }));
  if(!login.body || !login.body.idToken) throw new Error('에뮬레이터 로그인 실패 ' + JSON.stringify(login.body).slice(0, 120));
  const token = login.body.idToken;
  const call = async (method, p, b) => j(await fetch(API + p, { method,
    headers: Object.assign({ Authorization: 'Bearer ' + token }, b === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: b === undefined ? undefined : JSON.stringify(b) }));
  return { fc, uid: login.body.localId, userCode: join.body.data.userCode, call };
}

function run(name, body){
  const out = path.join(ROOT, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const steps = [];
  const apps = [];
  const save = () => {
    fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
    for(const a of apps){
      fs.writeFileSync(path.join(a.out, 'console.txt'), a.logs.join('\n'));
      fs.writeFileSync(path.join(a.out, 'requests.txt'), a.reqs.join('\n'));
    }
  };
  let failed = false;
  const bugs = new Set();   // 이미 알려진 앱 버그(FEATURES.md «발견한 버그») 가운데 이번에 다시 본 것
  const t = {
    out, steps, PW, API_HOST, wait, poll, sql, seed, docker, withStackLock, RT, PG, headlessUser,
    note(s){ steps.push('     ' + s); save(); },
    // 알려진 앱 버그를 다시 봤다 — 단계는 통과로 두고 steps.txt · 요약에 BUG 로 남긴다
    bug(id, s){ if(bugs.has(id)) return; bugs.add(id); steps.push(`BUG  ${id}: ${s}`); save(); },
    async step(label, fn){
      const t0 = Date.now();
      try { const r = await fn(); await t.assertQuiet(); steps.push(`ok   ${label} (${Date.now() - t0}ms)`); return r; }
      catch(e){
        failed = true;
        steps.push(`FAIL ${label}: ${String(e && e.message || e).split('\n')[0]}`);
        for(const a of apps){ if(a.w) await a.w.screenshot({ path: path.join(a.out, `fail-${steps.length}.png`) }).catch(() => {}); }
        throw e;
      } finally { save(); }
    },
    check(cond, msg){ if(!cond) throw new Error(msg); },
    // 조용한 창이 지켜지는가(단계마다) — scenarios/launcher/quiet.js 와 같은 판정: 진짜 창(__e2eRealBounds)이 어느 화면과도 창 넓이의 4분의 1 넘게
    // 겹치지 않음(mac 은 화면 밖 창을 끝으로 당긴다) · 포커스 받은 창 없음 · 진짜 투명도 0 · 진짜 소리 끔 · 진짜 창은 맨 위 아님. 꺼진 앱은 건너뛴다
    async assertQuiet(){
      if(!QUIET) return;
      const overlap = (r, d) => Math.max(0, Math.min(r.x + r.width, d.x + d.width) - Math.max(r.x, d.x)) * Math.max(0, Math.min(r.y + r.height, d.y + d.height) - Math.max(r.y, d.y));
      const offscreen = (r, ds) => ds.every((d) => overlap(r, d) <= 0.25 * r.width * r.height);
      for(const a of apps){
        if(!a.app) continue;
        let s;
        try {
          s = await a.app.evaluate(({ BrowserWindow, screen }) => ({
            wins: BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => {
              const real = typeof w.__e2eRealBounds === 'function' ? w.__e2eRealBounds() : null;
              const base = Object.getPrototypeOf(Object.getPrototypeOf(w));
              return { title: w.getTitle(), real, focus: w.isFocused(), realTop: real ? base.isAlwaysOnTop.call(w) : null,
                opacity: typeof w.__e2eRealOpacity === 'function' ? w.__e2eRealOpacity() : null,
                muted: typeof w.webContents.__e2eRealAudioMuted === 'function' ? w.webContents.__e2eRealAudioMuted() : null };
            }),
            focused: !!BrowserWindow.getFocusedWindow(),
            displays: screen.getAllDisplays().map((d) => d.bounds),
          }));
        } catch(e){ if(/closed|Target/.test(String(e.message))) continue; throw e; }
        const bad = s.wins.filter((w) => !w.real || !offscreen(w.real, s.displays) || w.focus || w.realTop || w.opacity !== 0 || w.muted !== true);
        if(bad.length || s.focused) throw new Error('조용한 창이 깨짐(' + path.basename(a.out) + '): ' + JSON.stringify(bad.length ? bad : s).slice(0, 300));
      }
    },
    // 격리된 앱 한 벌(결과 폴더 안 label 폴더) — 켜기만 한다
    async launch(label = 'a'){
      const A = makeApp(path.join(out, label));
      fs.mkdirSync(A.out, { recursive: true });
      apps.push(A);
      A.w = await launchRetry(A);
      return A;
    },
    // 앱을 끄고 같은 폴더로 다시 켠다(다시 켜기 예약은 막는다)
    async relaunch(A){
      await A.quit();
      A.logs.push('--- relaunch ---');
      A.w = await launchRetry(A);
      return A.w;
    },
    // 앱이 스스로 꺼진 뒤 같은 폴더로 다시 켠다
    async relaunchFresh(A){
      A.w = await launchRetry(A);
      return A.w;
    },
    // 새 앱 한 벌을 켜서 새 계정으로 가입하고, 다시 켜서 로그인된 런처까지 간다
    async newUser(label = 'a'){
      const A = await t.launch(label);
      let w = A.w;
      await t.step(`[${label}] 초대 코드 · 가입`, async () => {
        await w.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 30000 });
        await w.fill('#inviteGateInput', INVITE);
        await w.click('#inviteGateOk');
        await w.locator('#signupPw').waitFor({ state: 'visible', timeout: 20000 });
        // 가입 카드가 뜨며 포커스를 옮기는 사이에 친 글자가 다른 칸에 들어갈 수 있다 — 두 칸 값이 맞을 때까지 다시 친다
        await poll(async () => {
          await w.fill('#signupPw', PW);
          await w.fill('#signupPw2', PW);
          return (await w.inputValue('#signupPw')) === PW && (await w.inputValue('#signupPw2')) === PW;
        }, 10000, '비밀번호 두 칸 채우기');
        await w.click('#signupOk');
        await w.locator('#sdStart').waitFor({ state: 'visible', timeout: 40000 });
        // 친구 코드는 서버가 가입 때 정해 준다(그 전엔 자리 표시 'MATE-····')
        A.fc = (await w.textContent('#signupCode')).trim();
        t.check(/^[A-Z]+-[A-Z0-9]{4,}$/.test(A.fc), '가입 뒤 친구 코드 모양이 이상함: ' + A.fc);
        t.note(`[${label}] 친구 코드 ${A.fc}`);
      });
      await t.step(`[${label}] 시작하기 → 다시 켜기 → 로그인된 런처`, async () => {
        await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
        const closed = new Promise((r) => A.app.once('close', r));
        await w.click('#sdStart');
        await Promise.race([closed, wait(20000).then(() => { throw new Error('20초 안에 꺼지지 않음'); })]);
        A.logs.push('--- relaunch ---');
        w = A.w = await launchRetry(A);
        await t.waitLoggedIn(A);
      });
      fs.writeFileSync(path.join(A.out, 'account.json'), JSON.stringify({ fc: A.fc, pw: PW }));
      return A;
    },
    // 로그인한 런처 — 내 정보 요청이 성공하고 런처 이름 칸이 보인다
    async waitLoggedIn(A){
      const me = await poll(() => t.api(A, 'GET', '/v2/me').then((r) => r.status === 200 && r.body && r.body.data), 40000, '내 정보 /v2/me 200');
      A.me = me;
      await A.w.locator('#lcNameBtn').waitFor({ state: 'visible', timeout: 30000 });
      // 켜는 순서(app-boot)가 realtime 연결까지 끝났는지 — 그 전엔 계정 칸이 안 열려 런처 누름이 무시된다
      await poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'ready'), 30000, 'realtime ready');
      return me;
    },
    // 앱 창 안에서 API 를 부른다(로그인 토큰을 붙임 · 주소 돌리기를 거친다)
    async api(A, method, p, body){
      return A.w.evaluate(async ({ host, method, p, body }) => {
        const tk = await window.firebaseAPI.getIdToken();
        if(!tk) return { status: 0, body: null };
        // 앱 API 통로처럼 이 PC 의 기기 id 를 싣는다(프리미엄 같은 «이 기기» 판정이 이것을 본다)
        const h = { Authorization: 'Bearer ' + tk, 'X-Device-Id': window.TwDeviceId.store.get() };
        if(body !== undefined) h['Content-Type'] = 'application/json';
        const r = await fetch(`https://${host}${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
        let j = null; try { j = await r.json(); } catch(_){}
        return { status: r.status, body: j };
      }, { host: API_HOST, method, p, body });
    },
    // 로그인 토큰의 Firebase uid(서버 관리자 표의 열쇠)
    async uid(A){
      return A.w.evaluate(async () => {
        const p = (await window.firebaseAPI.getIdToken()).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4))).user_id;
      });
    },
    // 서버가 이 계정을 관리자로 알게 한다(seed/admin.sql) — 관리자 확인 길이 200 이 될 때까지
    async makeAdmin(A){
      const uid = await t.uid(A);
      t.seed('admin.sql', { uid });
      await poll(async () => (await t.api(A, 'GET', '/v2/admin/admins/me')).status === 200, 40000, '/v2/admin/admins/me 200');
      return uid;
    },
    // 관리자 비밀번호 — 앱에는 해시만 있는 운영진 비밀이다. TW_E2E_ADMIN_PASS 가 있으면 그것을 쓰고, 없으면 시험 글자 하나만
    // 그 해시로 바꿔 주는 SHA-256 덮개를 창에 건다(비교 · 서버 확인 · 모드 켜기는 앱 코드 그대로 돈다)
    async adminPass(A){
      if(process.env.TW_E2E_ADMIN_PASS) return process.env.TW_E2E_ADMIN_PASS;
      const pass = 'e2e-admin-pass';
      const src = fs.readFileSync(path.join(APP_DIR, 'app', 'parts', 'app.js'), 'utf8');
      const hash = (src.match(/const ADMIN_PASS_HASH = '([0-9a-f]{64})'/) || [])[1];
      t.check(hash, 'app.js 에서 ADMIN_PASS_HASH 를 못 찾음');
      await A.w.evaluate(({ pass, hash }) => {
        if(window.__e2ePass) return;
        window.__e2ePass = true;
        const orig = crypto.subtle.digest.bind(crypto.subtle);
        crypto.subtle.digest = async (alg, data) => {
          if(new TextDecoder().decode(data) === pass) return new Uint8Array(hash.match(/../g).map((h) => parseInt(h, 16))).buffer;
          return orig(alg, data);
        };
      }, { pass, hash });
      return pass;
    },
    // 발견한 버그 B1: 앱의 관리자 GET(관리자 확인 /v2/admin/admins/me · 배너 읽기)이 로그인 토큰을 안 싣는다(401).
    // 그 요청에만 토큰을 붙여 보내고 버그로 적는다 — 고쳐지면 이 덮개는 불리지 않는다
    async patchAdminAuth(A){
      if(A.adminAuthPatched) return;
      A.adminAuthPatched = true;
      await A.app.context().route(/\/v2\/admin\//, async (r) => {
        const h = r.request().headers();
        if(h.authorization) return r.fallback();
        t.bug('B1', '관리자 GET 요청에 로그인 토큰이 없음: ' + new URL(r.request().url()).pathname);
        const tk = await A.w.evaluate(() => window.firebaseAPI.getIdToken());
        return r.fallback({ headers: Object.assign({}, h, { authorization: 'Bearer ' + tk }) });
      });
    },
    // 관리자 비밀번호 창 열기 — Ctrl(맥 ⌘)+후원 버튼
    async openAdminPrompt(A){
      await A.w.click('#lcDonateBtn', { modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
      await A.w.locator('#adminPassInput').waitFor({ state: 'visible', timeout: 5000 });
    },
    // 앱 관리자 모드 켜기 — 비밀번호 창 → 서버 관리자 확인 → body.admin
    async enterAdmin(A){
      const pass = await t.adminPass(A);
      await t.patchAdminAuth(A);
      await t.openAdminPrompt(A);
      await A.w.fill('#adminPassInput', pass);
      await A.w.click('#adminPassOk');
      await poll(() => A.w.evaluate(() => document.body.classList.contains('admin')), 10000, '관리자 모드(body.admin)');
    },
    // 빈 슬롯에 사람 캐릭터 하나 — 런처 + → 인간 → 다음 … → 완성 → 저장. 서버 보관함 슬롯에 올라간 것까지 본다
    async createCharacter(A, slot = 0){
      const w = A.w;
      // 켠 직후엔 계정 칸이 열리기 전이라 누름이 무시될 수 있다 — 종족 창이 뜰 때까지 다시 누른다
      await poll(async () => { if(await t.shown(A, '#raceHuman')) return true; await w.click('#lcEmpty'); await wait(1500); return t.shown(A, '#raceHuman'); }, 20000, '종족 고르기 창');
      await w.click('#raceHuman');
      await w.locator('#crNext').waitFor({ state: 'visible', timeout: 20000 });
      for(let i = 0; i < 20 && !(await t.shown(A, '#crDone')); i++){ await w.click('#crNext'); await wait(400); }
      await w.click('#crDone');
      await poll(async () => /슬롯에 저장했어요/.test(await w.textContent('#toast')), 15000, '«슬롯에 저장했어요»');
      const r = await poll(async () => { const x = await t.api(A, 'GET', '/v2/me/avatars'); return x.body && x.body.data && x.body.data.slots[slot] && x.body.data; }, 15000, `서버 슬롯 ${slot} 에 캐릭터`);
      return r.slots[slot];
    },
    // 메인 창 상태(메인 프로세스) — 자리 · 맨 위 · 보임 · 주 모니터 작업 영역
    async win(A){
      return A.app.evaluate(({ BrowserWindow, screen }) => {
        const m = BrowserWindow.getAllWindows().find((x) => /Desk Companion/.test(x.getTitle())) || BrowserWindow.getAllWindows()[0];
        return { b: m.getBounds(), top: m.isAlwaysOnTop(), shown: m.isVisible(), work: screen.getPrimaryDisplay().workArea };
      });
    },
    // 런처 → 책상 모드(미리보기 누르기)
    async enterDesk(A){
      await A.w.click('#lcPreview');
      await poll(() => A.w.evaluate(() => document.body.classList.contains('runmode')), 15000, '책상 모드(body.runmode)');
      await wait(800);
    },
    // 책상 모드 → 런처(칩 ▼ → 런처로)
    async leaveDesk(A){
      await A.w.click('#myChipMoreBtn');
      await A.w.locator('#myBackToLauncherBtn').waitFor({ state: 'visible', timeout: 5000 });
      await A.w.click('#myBackToLauncherBtn');
      await poll(() => A.w.evaluate(() => !document.body.classList.contains('runmode')), 10000, '런처로(runmode 풀림)');
      await A.w.locator('#lcPreview').waitFor({ state: 'visible', timeout: 10000 });
    },
    // 화면에 실제로 보이는가 — fixed 겹창은 offsetParent 가 null 이라 computed style 로 본다(README «함정»)
    async shown(A, sel){
      return A.w.evaluate((s) => {
        const el = document.querySelector(s);
        if(!el) return false;
        for(let e = el; e && e.nodeType === 1; e = e.parentElement){
          const cs = getComputedStyle(e);
          if(cs.display === 'none' || cs.visibility === 'hidden') return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, sel);
    },
    async shot(A, n){ await A.w.screenshot({ path: path.join(A.out, n + '.png') }).catch(() => {}); },
  };
  (async () => {
    const unlock = await acquire('e2e-core ' + name);
    // 이 묶음의 초대 코드 — 이미 있으면 그대로(묶음을 새로 만든 빈 DB 에서도 돌게)
    try { seed('core-invite.sql'); } catch(e){ steps.push('ABORT 초대 코드 seed: ' + String(e.message).split('\n')[0]); failed = true; }
    try { if(!failed) await body(t); }
    catch(e){ if(!failed) steps.push('ABORT ' + String(e && e.message || e).split('\n')[0]); failed = true; }
    save();
    for(const a of apps) await a.quit().catch(() => {});
    unlock();
    steps.push(failed ? 'RESULT FAIL' : 'RESULT ok');
    save();
    console.log(`${failed ? 'FAIL' : 'ok  '} ${name}${bugs.size ? '  BUG ' + [...bugs].join(',') : ''}  (${out}/steps.txt)`);
    process.exit(failed ? 1 : 0);
  })();
}

module.exports = { run, sql, seed, docker, withStackLock, poll, wait, PW, INVITE, PG, RT, ROOT };
