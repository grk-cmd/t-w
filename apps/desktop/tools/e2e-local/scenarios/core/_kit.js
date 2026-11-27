// core 묶음 시나리오가 같이 쓰는 도구 — 새 계정 가입 · 관리자 · 되돌리기 · 공유 스택 잠금 · 화면 도우미
// 단계 기록 · 판정 · 앱 켜기 · API 부르기 · 시드 SQL 은 ../_shared.js. 시나리오 한 파일 = run(name, async (t) => { … }). 단계 하나라도 FAIL 이면 종료 코드 1.
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, docker, API_HOST, APP_DIR, MAIN_WIN_TITLE } = require('../../lib.js');
const S = require('../_shared.js');
const { wait, PW, PG, LAUNCH_MARK, headlessLogin, seedSql, query, launchRetry } = S;
const { markQuietFail, STACK_WAIT_MS } = require('../../runlock.js');

const ROOT = path.join(S.OUT_ROOT, 'core');
const INVITE = S.inviteCode('INVT-C2RE-TEST');   // 이 묶음의 초대 코드(규칙은 _shared.js inviteCode)
const RT = process.env.TW_E2E_RT || 'tw-dev-local-rooms-dev-1';
// 공유 컨테이너를 멈추거나 다시 켤 때만 잡는 잠금(mkdir 은 원자적). 같은 스택을 쓰는 모든 시험이 같은 경로를 써야 해서
// 기본값을 두지 않는다 — 비어 있으면 컨테이너를 건드리는 시나리오가 시작 전에 멈춘다
const LOCK = process.env.TW_E2E_STACK_LOCK || '';

// 잠금을 기다린 시간은 시나리오 상한에 세지 않는다(run 이 frame 의 uncapped 를 건다)
let uncapped = (fn) => fn();

async function withStackLock(fn, maxWaitMs = STACK_WAIT_MS){
  if(!LOCK) throw new Error('TW_E2E_STACK_LOCK(공유 스택 잠금 경로)가 없다 — 컨테이너를 건드리지 않고 멈춤');
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  await uncapped(async () => {
    const t0 = Date.now();
    for(;;){
      try { fs.mkdirSync(LOCK); return; }
      catch(e){
        if(e.code !== 'EEXIST') throw e;
        if(Date.now() - t0 > maxWaitMs) throw new Error('스택 잠금을 못 잡음: ' + LOCK);
        await wait(2000);
      }
    }
  });
  try { fs.writeFileSync(path.join(LOCK, 'owner'), `e2e-core ${process.pid} ${new Date().toISOString()}`); } catch(_){}
  // 신호로 끝나도 잠금 폴더를 남기지 않는다(남으면 다른 세션이 10분 기다리다 실패한다)
  const drop = () => { try { fs.rmSync(path.join(LOCK, 'owner'), { force: true }); } catch(_){} try { fs.rmdirSync(LOCK); } catch(_){} };
  process.on('exit', drop);
  try { return await fn(); }
  finally { process.removeListener('exit', drop); drop(); }
}

// 공유 realtime 컨테이너 멈추기 · 풀기 — 스택 잠금 안에서만 부른다. 신호로 끝나도 exit 에서 푼다(멈춘 채 남으면 다른 세션의 realtime 이 멈춘다)
let rtPaused = false;
function pauseRt(){
  if(!LOCK || !fs.existsSync(LOCK)) throw new Error('스택 잠금 밖에서 realtime 을 멈추려 함');
  docker(['pause', RT]); rtPaused = true;
}
function unpauseRt(){
  if(!rtPaused) return;
  try { docker(['unpause', RT]); rtPaused = false; } catch(e){ throw new Error('realtime 풀기 실패: ' + String(e.message).split('\n')[0]); }
}
process.on('exit', () => { if(rtPaused){ try { docker(['unpause', RT]); } catch(_){} } });

const poll = (fn, ms, what, every = 300) => S.waitUntil(fn, { ms, what, every });

// 앱 없이 만드는 계정 — 신고자처럼 «사람 수» 만 필요한 쪽 · 정리용 관리자. { fc, uid, userCode, call }
async function headlessUser(){
  const u = await S.apiUser(INVITE);
  await u.token();
  return u;
}

function run(name, body){
  const F = S.frame('core', name);
  const { out, steps } = F;
  uncapped = (fn) => F.uncapped(fn);
  // t.undo 로 건 «되돌릴 일» — 이름 → fn(정리용 관리자). 돌리기 전에 빼서 한 번만 돈다(본문과 신호 처리기가 겹쳐도).
  // 도는 중인 것은 running 에 두어, 신호 처리기가 다시 돌리지 않고 끝나기를 기다린다
  const undos = new Map(), running = new Map();
  const runUndo = (label) => {
    if(running.has(label)) return running.get(label);
    const fn = undos.get(label);
    if(!fn) return Promise.resolve();
    undos.delete(label);
    const p = t.cleanup(label, async () => fn(await t.headlessAdmin())).finally(() => running.delete(label));
    running.set(label, p);
    return p;
  };
  process.on('exit', () => {
    if(!undos.size && !running.size) return;
    const left = [...undos.keys(), ...running.keys()].join(' · ');
    steps.push(`FAIL 정리 못 함(끝날 때 남음): ${left}`); F.save();
    markQuietFail(`core/${name}: 되돌리지 못한 서버 값 — ${left}`);
  });
  const t = {
    out, steps, PW, API_HOST, wait, poll, query, seedSql, docker, withStackLock, pauseRt, unpauseRt, RT, PG, headlessUser,
    note: F.note, step: F.step, knownBug: F.knownBug,
    check(cond, msg){ if(!cond) throw new Error(msg); },
    // 모두가 보는 서버 값 되돌리기 — fn 이 돌려준 응답(또는 응답 배열)이 2xx 가 아니거나 던지면 «FAIL 정리» 로 남기고 시나리오를 실패로.
    // 되돌리지 못한 것을 눈에 띄게 하려는 것이다(다른 묶음 · 다른 사람의 시험이 그 값을 본다)
    async cleanup(label, fn){
      try {
        const r = await fn();
        for(const x of [].concat(r == null ? [] : r)){
          if(x && typeof x.status === 'number' && (x.status < 200 || x.status >= 300)) throw new Error('응답 ' + x.status + ' ' + JSON.stringify(x.body).slice(0, 120));
        }
        steps.push(`ok   정리: ${label}`);
      } catch(e){ F.fail(); steps.push(`FAIL 정리: ${label}: ${S.firstLine(e)}`); }
      F.save();
    },
    // 되돌릴 일 등록 — 모두가 보는 값을 바꾸기 전에 건다. 돌려받은 함수를 finally 에서 부르면 정리(cleanup)를 돌고 목록에서 빠진다.
    // 신호로 끝나면 신호 처리기가 남은 것을 돌리고, 끝날 때까지 못 돈 것은 «FAIL 정리 못 함» · e2e-quiet-fail 로 남는다(다음 실행이 멈춘다).
    // fn 은 정리용 관리자(headlessAdmin)를 받는다 — 관리자 만들기가 실패해도 «FAIL 정리» 로 남게 정리 안에서 만든다
    undo(label, fn){
      undos.set(label, fn);
      return () => runUndo(label);
    },
    // 정리용 관리자 — 앱 없는 계정을 관리자로(seed/admin.sql). 앱이 죽었어도 되돌리기가 돈다. 한 시나리오에 한 번만 만든다
    async headlessAdmin(){
      if(t._admin) return t._admin;
      const u = await headlessUser();
      seedSql('admin.sql', { uid: u.uid });
      await poll(async () => (await u.call('GET', '/v2/admin/admins/me')).status === 200, 40000, '정리용 관리자 /v2/admin/admins/me 200');
      t._admin = u;
      return u;
    },
    // 격리된 앱 한 벌(결과 폴더 안 label 폴더) — 켜기만 한다
    async launch(label = 'a'){
      const A = makeApp(path.join(out, label));
      fs.mkdirSync(A.out, { recursive: true });
      F.add({ label, A, get w(){ return A.w; } });
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
        A.fc = await S.signupForm(w, INVITE);
        // 친구 코드는 서버가 가입 때 정해 준다(그 전엔 자리 표시 'MATE-····')
        t.check(/^[A-Z]+-[A-Z0-9]{4,}$/.test(A.fc), '가입 뒤 친구 코드 모양이 이상함: ' + A.fc);
        t.note(`[${label}] 친구 코드 ${A.fc}`);
      });
      await t.step(`[${label}] 시작하기 → 다시 켜기 → 로그인된 런처`, async () => {
        if(!(await S.restartAfter(A, () => w.click('#sdStart')))) throw new Error('20초 안에 꺼지지 않음');
        w = A.w = await launchRetry(A);
        // 시험이 API 를 부르기 전에 — 다시 켠 앱이 스스로 계정 확인(/v2/me)을 보냈는가
        const mark = A.reqs.lastIndexOf(LAUNCH_MARK);
        await poll(() => A.reqs.slice(mark + 1).some((r) => /^GET \/v2\/me 200/.test(r)), 30000, '다시 켠 앱이 스스로 /v2/me 200');
        A.bootMeByApp = true;
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
    api: (A, method, p, body) => S.apiIn(A.w, method, p, body),
    // 로그인 토큰의 Firebase uid(서버 관리자 표의 열쇠)
    uid: (A) => S.uidOf(A.w),
    // 서버가 이 계정을 관리자로 알게 한다(seed/admin.sql) — 관리자 확인 길이 200 이 될 때까지
    async makeAdmin(A){
      const uid = await t.uid(A);
      t.seedSql('admin.sql', { uid });
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
    // 관리자 비밀번호 창 열기 — Ctrl(맥 ⌘)+후원 버튼
    async openAdminPrompt(A){
      await A.w.click('#lcDonateBtn', { modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
      await A.w.locator('#adminPassInput').waitFor({ state: 'visible', timeout: 5000 });
    },
    // 앱 관리자 모드 켜기 — 비밀번호 창 → 서버 관리자 확인 → body.admin
    async enterAdmin(A){
      const pass = await t.adminPass(A);
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
      return A.app.evaluate(({ BrowserWindow, screen }, title) => {
        const m = BrowserWindow.getAllWindows().find((x) => x.getTitle().includes(title)) || BrowserWindow.getAllWindows()[0];
        return { b: m.getBounds(), top: m.isAlwaysOnTop(), shown: m.isVisible(), work: screen.getPrimaryDisplay().workArea };
      }, MAIN_WIN_TITLE);
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
  S.drive(F, {
    invite: INVITE,
    body: () => body(t),
    // 신호 · 시간 초과로 끝날 때 — 모두가 보는 서버 값을 되돌린 뒤 끝낸다(켜진 채 남으면 같은 스택을 쓰는 모든 시험이 막힌다)
    onSignal: async () => { for(const label of [...running.keys(), ...undos.keys()]) await runUndo(label); },
  });
}

module.exports = { run, headlessLogin, query, seedSql, docker, withStackLock, poll, wait, PW, INVITE, PG, RT, ROOT };
