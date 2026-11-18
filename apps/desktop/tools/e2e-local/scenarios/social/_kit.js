// 시나리오 공통부 — 새 계정으로 앱 켜기 · API 부르기 · 단계 기록 · 판정(종료 코드)
// 시나리오 파일은 scenario(이름, async (t) => { … }) 하나를 부른다. t.user(이름) 로 앱 한 벌(새 계정)을 켜고, t.step 으로 단계를 판정한다.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeApp, wait, API_HOST } = require('../../lib.js');
const { acquire } = require('../../runlock.js');

const INVITE = process.env.TW_E2E_INVITE || 'INVT-SCAL-E2E3';   // seed/social-invite.sql
const PW = 'e2e-pass-1234';   // 에뮬레이터 안에서만 쓰는 시험 비밀번호
const OUT_ROOT = process.env.TW_E2E_OUT || '/tmp/tw-e2e';
// 로컬 묶음의 DB 컨테이너 — 시드 SQL 을 넣을 때만 쓴다(서버 저장소 dev-local 묶음의 기본 이름)
const PG = {
  container: process.env.TW_E2E_PG_CONTAINER || 'tw-dev-local-postgres-1',
  user: process.env.TW_E2E_PG_USER || 'tw_api_dev',
  db: process.env.TW_E2E_PG_DB || 'tw_dev',
};
const DOCKER_ENV = Object.assign({}, process.env, process.env.DOCKER_HOST ? {} : { DOCKER_HOST: 'unix://' + path.join(process.env.HOME, '.orbstack/run/docker.sock') });

// seed/<file> 을 psql 로 넣는다 — vars 는 psql -v 이름=값
function seedSql(file, vars){
  const args = ['exec', '-i', PG.container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', PG.user, '-d', PG.db];
  for(const [k, v] of Object.entries(vars || {})) args.push('-v', `${k}=${v}`);
  args.push('-f', '-');
  return execFileSync('docker', args, { input: fs.readFileSync(path.join(__dirname, '..', '..', 'seed', file)), env: DOCKER_ENV }).toString();
}

// 렌더러 안에서 앱 토큰으로 API 를 부른다 — 요청이 앱과 같은 길(주소 돌리기 · 요청 기록)로 간다
async function apiIn(w, method, p, body){
  return w.evaluate(async ({ host, method, p, body }) => {
    const token = await window.firebaseAPI.getIdToken();
    const r = await fetch(`https://${host}${p}`, {
      method,
      headers: Object.assign({ Authorization: 'Bearer ' + token, 'X-Device-Id': window.TwDeviceId.store.get() }, body === undefined ? {} : { 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch(_){}
    return { status: r.status, json, text: json ? '' : text.slice(0, 300) };
  }, { host: API_HOST, method, p, body });
}

function assert(cond, msg){ if(!cond) throw new Error(msg); }

// 페이지 안 조건이 참이 될 때까지(기본 20초) — 값을 돌려준다
async function until(w, fn, arg, { timeout = 20000, every = 300, what = '조건' } = {}){
  const end = Date.now() + timeout;
  let last;
  for(;;){
    try { last = await w.evaluate(fn, arg); } catch(e){ last = 'ERR ' + e.message.split('\n')[0]; }
    if(last && !(typeof last === 'string' && last.startsWith('ERR '))) return last;
    if(Date.now() > end) throw new Error(`${what} — ${timeout}ms 안에 안 됨(마지막 값 ${JSON.stringify(last)})`);
    await wait(every);
  }
}

// 앱 여러 벌이 같이 뜨면 첫 창이 30초 안에 안 올 때가 있다 — 그 한 벌만 끄고 다시 켠다
// 이 폴더로 켠 앱 프로세스를 전부 끈다(지난번에 멈춘 채 남은 것까지)
function killLeft(dir){ try { execFileSync('pkill', ['-9', '-f', 'Electron.*' + dir + '/']); } catch(_){} }   // 앱 프로세스만(이 폴더 이름이 든 셸 명령까지 죽이지 않게)

async function launchRetry(A){
  for(let i = 1; ; i++){
    let timer;
    try {
      // 켜기가 아무 답 없이 멈출 때가 있다(디버그 포트 연결 등) — 90초 넘으면 그 한 벌을 죽이고 다시
      const w = await Promise.race([A.launch(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('켜기 90초 넘김')), 90000); })]);
      // 주소 돌리기가 안 걸린 채 첫 화면이 바깥 dev 주소로 나갈 때가 있다(요청 기록이 비고 502) — 다시 읽고, 그래도면 다시 켠다
      const n0 = A.reqs.length;
      for(let k = 0; k < 2; k++){
        for(let j = 0; j < 40 && A.reqs.length === n0; j++) await wait(250);
        if(A.reqs.length > n0) return w;
        A.logs.push('--- 요청이 도구를 안 거침 — 다시 읽기 ---');
        await w.reload();
      }
      throw new Error('주소 돌리기가 안 걸림');
    } catch(e){
      A.logs.push(`--- 켜기 실패 ${i}: ${String(e.message).split('\n')[0]} ---`);
      await A.quit().catch(() => {});
      killLeft(A.out);   // 도우미 프로세스(GPU · 렌더러)까지 — 남으면 다음 켜기도 같은 폴더에서 멈춘다
      if(i >= 3) throw e;
      await wait(3000);
    } finally { clearTimeout(timer); }
  }
}

// 조용한 창 규칙(scenarios/launcher/quiet.js 와 같음) — 단계마다 모든 창의 진짜 자리가 화면 밖이고 포커스가 없어야 한다. TW_E2E_QUIET=0 이면 안 본다
async function assertQuiet(u, where){
  if(process.env.TW_E2E_QUIET === '0' || !u.A.app) return;
  const s = await u.A.app.evaluate(({ BrowserWindow }) => ({
    wins: BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => ({ real: typeof w.__e2eRealBounds === 'function' ? w.__e2eRealBounds() : null, focus: w.isFocused() })),
    focused: !!BrowserWindow.getFocusedWindow(),
  })).catch(() => null);
  if(!s) return;   // 앱을 다시 켜는 중
  const bad = s.wins.filter((w) => !w.real || w.real.x > -10000 || w.real.y > -10000 || w.focus);
  if(bad.length || s.focused) throw new Error(`${u.label}: 조용한 창이 깨짐(${where}) — 화면 안 · 포커스 · 감싸지 않은 창 ${JSON.stringify(s)}`);
}

function scenario(name, body){
  const area = 'social';
  const out = path.join(OUT_ROOT, area, name);
  killLeft(out);
  fs.rmSync(out, { recursive: true, force: true });
  if(!process.env.TW_E2E_INVITE) seedSql('social-invite.sql');   // 이 묶음 초대 코드(있으면 그대로)
  fs.mkdirSync(out, { recursive: true });
  const steps = [];
  const users = [];
  const save = () => {
    fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
    for(const u of users){
      fs.writeFileSync(path.join(u.A.out, 'console.txt'), u.A.logs.join('\n'));
      fs.writeFileSync(path.join(u.A.out, 'requests.txt'), u.A.reqs.join('\n'));
    }
  };
  const note = (s) => { steps.push('     ' + String(s).slice(0, 300)); };

  async function step(label, fn){
    const t0 = Date.now();
    try {
      const r = await fn();
      for(const u of users) await assertQuiet(u, label);
      steps.push(`ok   ${label} (${Date.now() - t0}ms)`);
      return r;
    } catch(e){
      const lines = String(e.message || e).split('\n');
      steps.push(`FAIL ${label}: ${lines[0]}`);
      for(const l of lines.slice(1, 8)) if(l.trim()) note(l.trim());   // 도구가 남긴 기다린 내역(무엇이 가렸는지 등)
      for(const u of users) await u.w.screenshot({ path: path.join(u.A.out, `fail-${steps.length}.png`) }).catch(() => {});
      throw e;
    } finally { save(); }
  }

  // confirm · alert 같은 기본 창은 «확인» 으로 닫고 문구를 남긴다(친구 삭제 확인 등)
  function hookDialogs(u){
    u.w.on('dialog', (d) => { u.dialogs.push(d.type() + ':' + d.message()); d.accept().catch(() => {}); });
  }

  // 새 계정 한 벌: 초대 코드 → 가입 → [시작하기](다시 켜기) → 로그인 · realtime 이 붙을 때까지
  async function user(label, opts = {}){
    const A = makeApp(path.join(out, label));
    fs.mkdirSync(A.out, { recursive: true });
    const u = { label, A, w: null, me: null, dialogs: [] };
    users.push(u);
    u.w = await launchRetry(A);
    const w0 = u.w;
    await step(`${label}: 가입`, async () => {
      await w0.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 30000 });
      await w0.fill('#inviteGateInput', INVITE);
      await w0.click('#inviteGateOk');
      await w0.locator('#signupPw').waitFor({ state: 'visible', timeout: 15000 });
      // 앱 여러 벌이 같이 뜨면 창 포커스가 오가며 글이 다른 칸에 들어갈 때가 있다 — 두 칸 값을 보고 다르면 다시 넣는다
      for(let i = 0; i < 3; i++){
        await w0.fill('#signupPw', PW);
        await w0.fill('#signupPw2', PW);
        const ok = await w0.evaluate((pw) => document.getElementById('signupPw').value === pw && document.getElementById('signupPw2').value === pw, PW);
        if(ok) break;
      }
      await w0.click('#signupOk');
      await w0.locator('#sdStart').waitFor({ state: 'visible', timeout: 30000 });
      // [시작하기] 는 앱을 다시 켠다 — 다시 켜기 예약만 막고 같은 폴더로 이 도구가 다시 켠다(README «함정»)
      await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
      const closed = new Promise((r) => A.app.once('close', r));
      await w0.click('#sdStart');
      // 꺼지면서 «Waiting for the debugger to disconnect» 로 멈출 때가 있다(도구가 붙인 --inspect) — 20초 넘으면 도구가 끈다
      const done = await Promise.race([closed.then(() => true), wait(20000).then(() => false)]);
      if(!done){ note(`${label}: [시작하기] 뒤 20초 안에 안 꺼짐 — 디버거 연결이 남아 도구가 껐음`); await A.quit(); }
      A.logs.push('--- relaunch ---');
      u.w = await launchRetry(A);
      await until(u.w, () => !!(window.TwRtHub && window.TwRtHub.store.isReady()), null, { timeout: 40000, what: 'realtime 연결' });
      const me = await apiIn(u.w, 'GET', '/v2/me');
      assert(me.status === 200 && me.json && me.json.data && me.json.data.userCode, '내 정보 못 받음 ' + me.status);
      u.me = me.json.data;
      hookDialogs(u);
      if(opts.name){
        const r = await apiIn(u.w, 'PATCH', '/v2/me', { displayName: opts.name, version: u.me.version });
        assert(r.status === 200, '이름 정하기 실패 ' + r.status);
        u.me = r.json.data;
      }
      note(`${label} userCode ${u.me.userCode} friendCode ${u.me.friendCode}`);
    });
    u.api = (m, p, b) => apiIn(u.w, m, p, b);
    // 로그인 uid(Auth 에뮬레이터) — 토큰의 sub
    u.uid = () => u.w.evaluate(async () => JSON.parse(atob((await window.firebaseAPI.getIdToken()).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub);
    // 앱을 끄고 같은 폴더로 다시 켠다(로그인 유지) — 서버 쪽 권한을 바꾼 뒤 등
    u.relaunch = async () => {
      await A.quit();
      A.logs.push('--- relaunch ---');
      u.w = await launchRetry(A);
      hookDialogs(u);
      await until(u.w, () => !!(window.TwRtHub && window.TwRtHub.store.isReady()), null, { timeout: 40000, what: 'realtime 연결' });
    };
    u.eval = (fn, arg) => u.w.evaluate(fn, arg);
    u.until = (fn, arg, o) => until(u.w, fn, arg, o);
    u.shot = (n) => u.w.screenshot({ path: path.join(A.out, n + '.png') });
    u.text = (sel) => u.w.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
    // 화면에 고정된 겹창은 offsetParent 가 null 이라 display · visibility 로 본다(README «함정»)
    u.shown = (sel) => u.w.evaluate((s) => {
      const e = document.querySelector(s);
      if(!e) return false;
      for(let n = e; n && n.nodeType === 1; n = n.parentElement){ const cs = getComputedStyle(n); if(cs.display === 'none' || cs.visibility === 'hidden') return false; }
      return true;
    }, sel);
    // 요청 기록에서 찾기 — 'GET /v2/me 200' 모양
    u.sawReq = (re) => A.reqs.some((l) => re.test(l));
    return u;
  }

  const t = { out, step, user, note, wait, assert, apiIn, until, users };
  (async () => {
    await acquire('social/' + name);   // TW_E2E_RUN_LOCK 이 있으면 잡는다(run-all 이 잡았으면 그대로) — 나갈 때 runlock 이 놓는다
    try {
      await body(t);
      steps.push('PASS');
      save();
      for(const u of users) await u.A.quit().catch(() => {});
      // 통과하면 앱 데이터(수백 MB)는 지우고 기록만 남긴다
      for(const u of users){ fs.rmSync(path.join(u.A.out, 'appdata'), { recursive: true, force: true }); fs.rmSync(path.join(u.A.out, 'wrap'), { recursive: true, force: true }); }
      console.log(`PASS ${area}/${name}`);
      process.exit(0);
    } catch(e){
      steps.push('ABORT ' + String(e.message || e).split('\n')[0]);
      save();
      for(const u of users) await u.A.quit().catch(() => {});
      console.log(`FAIL ${area}/${name} — ${String(e.message || e).split('\n')[0]}  (${out}/steps.txt)`);
      process.exit(1);
    }
  })();
}

module.exports = { scenario, wait, assert, apiIn, until, seedSql, API_HOST, PW };

// ── 여러 시나리오가 같이 쓰는 준비 단계 ──

// 친구 맺기 — 화면 판정이 목적이 아닌 시나리오의 준비라 API 로(요청 보내기 → 받은 쪽 수락)
async function befriend(a, b){
  const s = await a.api('POST', '/v2/me/friend-requests', { to: b.me.userCode });
  assert(s.status === 200, '친구 요청 보내기 실패 ' + s.status + ' ' + JSON.stringify(s.json));
  const r = await b.api('POST', `/v2/me/friend-requests/${a.me.userCode}/accept`);
  assert(r.status === 200 || r.status === 204, '친구 수락 실패 ' + r.status);
}

// 캐릭터 만들기 — 방에 들어가려면 캐릭터가 있어야 한다(README «캐릭터 만들기» 순서)
async function makeCharacter(u){
  await u.w.click('#lcEmpty');
  await u.w.locator('#raceHuman').waitFor({ state: 'visible', timeout: 15000 });
  await u.w.click('#raceHuman');
  for(let i = 0; i < 20; i++){
    if(await u.shown('#crDone')) break;
    await u.w.click('#crNext');
    await wait(400);
  }
  await u.w.click('#crDone');
  await u.until(() => !document.querySelector('#crDone') || getComputedStyle(document.getElementById('creatorWin') || document.body).display === 'none' || !document.getElementById('crDone').offsetParent, null, { what: '캐릭터 저장' });
  await u.w.locator('#lcInvite').waitFor({ state: 'visible', timeout: 15000 });
}

// 워킹룸 만들기 → 방 코드
async function createRoom(u){
  await u.w.click('#lcInvite');
  await u.w.locator('#lobbyCreate').waitFor({ state: 'visible', timeout: 15000 });
  await u.w.click('#lobbyCreate');
  await u.w.locator('#rcCreate').waitFor({ state: 'visible', timeout: 15000 });
  await u.w.click('#rcCreate');
  return u.until(() => (typeof Presence !== 'undefined' && Presence.active() && Presence.roomCode()) || null, null, { timeout: 30000, what: '방 입장' });
}

// 마이홈 열기 · 탭 고르기
async function openMyHome(u, tab){
  if(!(await u.shown('#myHomeTabs'))){
    await u.w.click('#lcNameBtn');
    await u.w.locator('#myHomeTabs').waitFor({ state: 'visible', timeout: 15000 });
  }
  if(tab) await u.w.click(`#myHomeTabs .mh-tab[data-tab="${tab}"]`);
  await wait(500);
}

// 지금 떠 있는 토스트 글
const toastText = (u) => u.eval(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });

module.exports.befriend = befriend;
module.exports.makeCharacter = makeCharacter;
module.exports.createRoom = createRoom;
module.exports.openMyHome = openMyHome;
module.exports.toastText = toastText;

// 앱이 window.open 으로 여는 자식 창(방명록 등) — 창을 잡아 돌려준다.
// 방명록 창은 포커스를 잃으면 닫히는데(main.js blur), 시험 중엔 다른 앱 창이 포커스를 가져가 그 사이에 닫힌다 —
// 앱이 파일 고르기에 쓰는 «잠시 닫지 않기»(companion.gbHold)를 건 뒤 열고, 연 창의 blur 닫기를 뗀다(그 닫힘 자체는 판정하지 않는다)
async function openChild(u, clickSel){
  await u.eval(() => window.companion.gbHold());
  const p = u.A.app.waitForEvent('window', { timeout: 15000 });
  await u.w.click(clickSel);
  const cw = await p;
  await u.A.app.evaluate(({ BrowserWindow }) => {
    for(const bw of BrowserWindow.getAllWindows()) if(bw.webContents.getURL() === 'about:blank') bw.removeAllListeners('blur');
  });
  await cw.waitForLoadState();
  return cw;
}
module.exports.openChild = openChild;

// 그림 파일 하나(PNG) — 앱 창의 캔버스로 그려 결과 폴더에 쓴다
async function pngFile(u, name, color, w = 64, h = 64){
  const dataUrl = await u.eval(({ color, w, h }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = color; g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2); g.fill();
    return c.toDataURL('image/png');
  }, { color, w, h });
  const p = path.join(u.A.out, name);
  fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return p;
}

// OS 파일 고르기 창은 시험이 누를 수 없다 — main 의 dialog.showOpenDialog 를 «이 파일을 골랐다» 로 바꿔 둔다(앱 코드는 그대로)
async function stubFileDialog(u, filePath){
  await u.A.app.evaluate(({ dialog }, fp) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fp] }); }, filePath);
}

// 관리자로 만들고(seed/social.sql) 앱을 다시 켠다 — 관리자는 프리미엄(라이선스 기능)이 붙는다
async function makeAdmin(u){
  seedSql('social.sql', { uid: await u.uid() });
  // 서버가 관리자 목록을 잠깐 기억해 두는지 바로 안 바뀔 때가 있다 — /v2/me 가 관리자 · 프리미엄이 될 때까지(최대 60초) 본 뒤 앱을 다시 켠다
  let me;
  for(let i = 0; i < 120; i++){ me = (await u.api('GET', '/v2/me')).json.data; if(me.admin && me.premium) break; await wait(500); }
  assert(me.admin === true && me.premium === true, '관리자 · 프리미엄이 안 붙음 ' + JSON.stringify(me));
  await u.relaunch();
  u.me = (await u.api('GET', '/v2/me')).json.data;
}
module.exports.pngFile = pngFile;
module.exports.stubFileDialog = stubFileDialog;
module.exports.makeAdmin = makeAdmin;

// 인앱 입력 창(asyncPrompt — #mhPromptOverlay)에 값을 넣고 [확인]
async function answerPrompt(u, value){
  await u.w.locator('#mhPromptInput').waitFor({ state: 'visible', timeout: 10000 });
  await u.w.fill('#mhPromptInput', value);
  await u.w.click('#mhPromptOk');
}
module.exports.answerPrompt = answerPrompt;

// 책상 모드(실행 화면)로 — 포커스 기록 · ⚙ 설정 패널은 이 화면에 있다(캐릭터가 있어야 들어간다)
async function enterDesk(u){
  if(!(await u.shown('#lcPreview'))) await makeCharacter(u);
  await u.w.click('#lcPreview');
  await u.until(() => { const b = document.getElementById('myFocusGearBtn'); return !!b && getComputedStyle(b).display !== 'none'; }, null, { timeout: 30000, what: '책상 모드' });
}
// ⚙ 설정 패널 열기(F1 과 같은 단추)
async function openSettings(u){
  if(await u.shown('#focusSettingsPanel .fs-body')) return;
  await u.eval(() => document.getElementById('myFocusGearBtn').click());
  await u.until(() => getComputedStyle(document.getElementById('focusSettingsPanel')).display !== 'none', null, { what: '설정 패널' });
}
// 🕒 포커스 기록 창 열기(설정 › 기록 열기)
async function openFocusLog(u){
  await openSettings(u);
  await u.eval(() => document.getElementById('fsFocusLogBtn').click());
  await u.until(() => getComputedStyle(document.getElementById('focusLogOverlay')).display !== 'none', null, { what: '포커스 기록 창' });
}
// 렌더러의 «지금» 을 ms 만큼 앞으로(타이머 · 자동 거절 같은 시간 판정을 기다리지 않고 보려고) — 되돌릴 함수
async function shiftClock(u, ms){
  await u.eval((d) => { window.__twShift = (window.__twShift || 0) + d; if(!window.__twNow){ window.__twNow = Date.now.bind(Date); Date.now = () => window.__twNow() + window.__twShift; } }, ms);
}
module.exports.enterDesk = enterDesk;
module.exports.openSettings = openSettings;
module.exports.openFocusLog = openFocusLog;
module.exports.shiftClock = shiftClock;

// 같은 방의 남의 좌석 — 판정이 어긋날 때 무엇이 보였는지 남기려고 요약을 함께 돌려준다
async function remoteSeats(u){
  return u.eval(() => { try { return seats.filter((x) => x.remote).map((x) => ({ friendId: x.friendId, friendUserId: x.friendUserId, name: x.friendName, noise: x.remoteNoise })); } catch(e){ return { err: String(e) }; } });
}
module.exports.remoteSeats = remoteSeats;
