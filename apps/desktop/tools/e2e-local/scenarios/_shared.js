// 네 묶음(account · room · core · social) 공통부 — 결과 폴더 · 단계 기록 · 판정(종료 코드) · 앱 켜기 · 가입 · API 부르기 · 에뮬레이터 로그인 · 조용한 창 · 시드 SQL
// 묶음마다 _kit.js 가 frame · drive 로 시나리오 틀을 짜고, 그 묶음에만 있는 것(화면 도우미 · 되돌리기 · 공유 스택 잠금 등)만 더한다.
// cutover-012 는 0.12.3 앱을 자기 문지기와 켜서 이 틀을 쓰지 않는다(결과 폴더 · e2e-quiet-fail 확인만 빌려 쓴다)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { wait, quietProblems, docker, API, AUTH_EMU, API_HOST, PW } = require('../lib.js');
const { acquire, QUIET_FAIL, markQuietFail, SCENARIO_MS, OUT_ROOT } = require('../runlock.js');

const PG = process.env.TW_E2E_PG || 'tw-dev-local-postgres-1';   // 로컬 묶음의 DB 컨테이너
const SEED_DIR = path.resolve(__dirname, '..', 'seed');
const LAUNCH_MARK = '--- launch ---';   // A.reqs 에서 «이번 켜기 뒤» 를 가르는 줄
const LAUNCH_MAX_MS = 120000;   // 켜기 한 번이 답 없이 멈출 때 끊는 상한(lib 의 첫 창 기다리기 90초 + 주소 돌리기 확인)
const QUIET_CHECK_MS = 10000;
const SIGNAL_UNDO_MS = 20000;

const firstLine = (e) => String(e && e.message || e).split('\n')[0];
const quietFailed = () => !!QUIET_FAIL && fs.existsSync(QUIET_FAIL);
/** fn() 이 참인 값을 줄 때까지 every ms 마다 묻는다 — 던지면 «아직» 으로 본다. ms 넘으면 마지막 값 · 오류를 실어 던진다 */
async function waitUntil(fn, { ms = 20000, every = 300, what = '조건' } = {}){
  const t0 = Date.now();
  let last;
  for(;;){
    try { last = await fn(); if(last) return last; } catch(e){ last = e; }
    if(Date.now() - t0 > ms) throw new Error(`${what} — ${ms}ms 안에 안 됨` + (last instanceof Error ? ` (${firstLine(last)})` : ` (마지막 값 ${String(JSON.stringify(last)).slice(0, 200)})`));
    await wait(every);
  }
}
async function within(p, ms){
  let timer;
  try { return await Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(ms + 'ms 안에 끝나지 않음')), ms); })]); }
  finally { clearTimeout(timer); }
}

// ── DB · API · 에뮬레이터 ──

function psql(args, input){
  return docker(['exec', '-i', PG, 'psql', '-v', 'ON_ERROR_STOP=1', '-qtA', '-U', 'tw_api_dev', '-d', 'tw_dev', ...args], input).trim();
}
/** seed/<file> 을 psql 로 돌린다. vars 는 psql 변수(:'이름') */
function seedSql(file, vars = {}){
  const args = [];
  for(const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  return psql(args, fs.readFileSync(path.join(SEED_DIR, file), 'utf8'));
}
/** SQL 한 번 — 결과는 칸 구분 '|' 줄들(머리 없음) */
const query = (q) => psql([], q);

// 가입 초대 코드 — 네 묶음 한 규칙. TW_E2E_INVITE 를 주면 부른 사람의 코드라 그대로 쓰고 건드리지 않는다(seed/invite.sql 을 돌리지 않는다).
// 없으면 묶음 기본 코드를 쓰고, drive 가 켤 때마다 seed/invite.sql 로 넣는다(다른 묶음과 사용 횟수를 나눠 쓰지 않게 묶음마다 코드를 따로 둔다)
const GIVEN_INVITE = process.env.TW_E2E_INVITE || '';
const inviteCode = (areaDefault) => GIVEN_INVITE || areaDefault;
function seedInvite(code){ if(!GIVEN_INVITE) seedSql('invite.sql', { code }); }

/** 이 PC 의 서버를 Node 에서 부른다. { status, body, data } */
async function http(method, url, body, headers = {}){
  const h = Object.assign(body === undefined ? {} : { 'Content-Type': 'application/json' }, headers);
  const r = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch(_){}
  return { status: r.status, body: j, data: j && j.data };
}

/** 친구 코드 + 비밀번호로 Auth 에뮬레이터에 로그인 — 앱과 같은 이메일 모양(<코드>@tw.local · firebase-init.js). 실패해도 던지지 않는다 */
async function emuSignIn(fc, pw){
  const r = await http('POST', AUTH_EMU + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e', { email: String(fc).toLowerCase() + '@tw.local', password: pw, returnSecureToken: true });
  return { ok: !!(r.body && r.body.idToken), idToken: r.body && r.body.idToken, uid: r.body && r.body.localId, error: r.body && r.body.error && r.body.error.message };
}
/** 앱 없이 그 계정으로 로그인. { token, uid } · 실패하면 던진다 */
async function headlessLogin(fc, pw){
  const s = await emuSignIn(fc, pw);
  if(!s.ok) throw new Error('에뮬레이터 로그인 실패 ' + (s.error || ''));
  return { token: s.idToken, uid: s.uid };
}
/** 앱 없이 만드는 비밀번호 계정 — 상대 계정 · 정리용 관리자 · 미리 채울 기기용. { fc, userCode, pw, uid, token(), api(), call() } */
async function apiUser(invite){
  const r = await http('POST', API + '/v2/users', { password: PW, requestId: crypto.randomUUID(), inviteCode: invite });
  if(r.status !== 200 || !r.data) throw new Error('API 가입 실패 ' + r.status + ' ' + JSON.stringify(r.body));
  return withToken({ fc: r.data.friendCode, userCode: r.data.userCode, pw: PW });
}
/** 계정 { fc, pw } 에 token() · api(방법, 길, 본문, 기기 id) 를 붙인다. 부를 때마다 에뮬레이터에 로그인한다 */
function withToken(acct){
  acct.token = async () => {
    const { token, uid } = await headlessLogin(acct.fc, acct.pw);
    acct.authUid = acct.uid = uid;
    return token;
  };
  acct.api = async (method, p, body, deviceId) => {
    const h = { Authorization: 'Bearer ' + await acct.token() };
    if(deviceId) h['X-Device-Id'] = deviceId;
    return http(method, API + p, body, h);
  };
  acct.call = acct.api;
  return acct;
}

/** 앱 창 안에서 앱의 로그인 토큰으로 API 를 부른다 — 요청이 앱과 같은 길(주소 돌리기 · requests.txt)로 간다. { status, body, json, text }
 *  opts.device — 앱 API 통로처럼 이 PC 의 기기 id 를 싣는다(프리미엄 같은 «이 기기» 판정이 본다)
 *  opts.noStore — 늘 서버에 묻는다(크로미움 HTTP 캐시가 옛 답을 돌려주지 않게) */
async function apiIn(w, method, p, body, { device = true, noStore = true } = {}){
  return w.evaluate(async ({ host, method, p, body, device, noStore }) => {
    const tk = await window.firebaseAPI.getIdToken();
    if(!tk) return { status: 0, body: null, json: null, text: '' };
    const h = { Authorization: 'Bearer ' + tk };
    if(device) h['X-Device-Id'] = window.TwDeviceId.store.get();
    if(body !== undefined) h['Content-Type'] = 'application/json';
    const init = { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) };
    if(noStore) init.cache = 'no-store';
    const r = await fetch(`https://${host}${p}`, init);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch(_){}
    return { status: r.status, body: json, json, text: json ? '' : text.slice(0, 300) };
  }, { host: API_HOST, method, p, body, device, noStore });
}
/** 앱 로그인 토큰의 Firebase uid(서버 관리자 표의 열쇠) */
const uidOf = (w) => w.evaluate(async () => {
  const p = (await window.firebaseAPI.getIdToken()).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4))).user_id;
});

// ── 앱 켜기 · 끄기 ──

/** 이 폴더로 켠 Electron(도우미 프로세스까지)만 끈다 — 다른 묶음 · 다른 폴더 앱은 건드리지 않는다 */
function killDir(dir){ try { execFileSync('pkill', ['-9', '-f', 'Electron.*' + dir + '/']); } catch(_){} }
/** 이 폴더로 켠 Electron(도우미 프로세스까지)이 다 끝날 때까지 — 메인이 꺼진 뒤에도 도우미가 잠깐 남아 appdata 에 쓴다. ms 넘으면 끝낸다 */
async function goneDir(dir, ms = 10000){
  const left = () => { try { return execFileSync('pgrep', ['-f', 'Electron.*' + dir + '/'], { encoding: 'utf8' }).trim() !== ''; } catch(_){ return false; } };
  const t0 = Date.now();
  while(left()){
    if(Date.now() - t0 > ms){ killDir(dir); await wait(500); return; }
    await wait(200);
  }
}
/** 프로세스가 끝날 때까지(ms 넘으면 SIGKILL) — 앞 프로세스가 남으면 같은 폴더의 새 앱이 «두 번째 실행» 으로 바로 꺼진다 */
async function gone(pid, ms = 10000){
  if(!pid) return;
  const t0 = Date.now();
  for(;;){
    try { process.kill(pid, 0); } catch(_){ return; }
    if(Date.now() - t0 > ms){ try { process.kill(pid, 'SIGKILL'); } catch(_){} await wait(500); return; }
    await wait(200);
  }
}
const pidOf = (A) => { try { return A.app && A.app.process().pid; } catch(_){ return null; } };
/** 앱 끄기 — 15초 안에 안 꺼지면 이 폴더 프로세스를 끝낸다(끄다 멈추면 다음 시나리오가 잠금을 못 받는다) */
async function hardQuit(A){
  const pid = pidOf(A);
  const done = await Promise.race([A.quit().then(() => true, () => true), wait(15000).then(() => false)]);
  if(done) return;
  A.logs.push('--- 15초 안에 안 꺼져 PID 로 끝냄 ---');
  if(pid){ try { process.kill(pid, 'SIGKILL'); } catch(_){} }
  killDir(A.out);
}

const isLeak = (e) => /주소 돌리기가 안 걸림|진짜 서버로 나간 요청/.test(firstLine(e));
/** 켜기 — 주소 돌리기 확인은 lib.js launch 가 한다(안 걸렸거나 진짜 서버로 나간 요청이 있으면 던진다).
 *  그 실패는 다시 켜서 덮지 않는다: 앱을 끄고 e2e-quiet-fail 에 남긴 뒤 멈춘다(요청이 바깥 dev 로 갔을 수 있다).
 *  그 밖의 실패(바쁜 PC 에서 첫 창이 늦음 · 켜기가 답 없이 멈춤)만 그 한 벌을 끄고 세 번까지 켠다. launch 는 감싼 켜기를 줄 때 */
async function launchRetry(A, launch = A.launch){
  for(let i = 1; ; i++){
    A.reqs.push(LAUNCH_MARK);
    try {
      return await within(launch(), LAUNCH_MAX_MS);
    } catch(e){
      A.logs.push(`--- 켜기 실패 ${i}: ${firstLine(e)} ---`);
      await hardQuit(A);
      killDir(A.out);   // 켜다 멈춘 도우미 프로세스까지 — 남으면 같은 폴더의 다음 켜기도 멈춘다
      if(isLeak(e)){ markQuietFail(A.out + ': ' + firstLine(e)); throw e; }
      if(i >= 3) throw e;
      await wait(2000);
    }
  }
}

// ── 가입 화면 ──

/** 칸 여럿 채우기 — 화면이 늦게 포커스를 옮기면(바쁜 PC) 글이 다른 칸으로 가는 때가 있어, 채운 뒤 값을 보고 다르면 다시 채운다 */
async function fillChecked(w, pairs){
  for(let k = 0; k < 3; k++){
    for(const [sel, v] of pairs) await w.fill(sel, v);
    await wait(100);
    const got = await w.evaluate((sels) => sels.map((s) => { const e = document.querySelector(s); return e ? e.value : null; }), pairs.map((p) => p[0]));
    if(got.every((v, i) => v === pairs[i][1])) return;
  }
  throw new Error('칸 값이 안 맞음: ' + pairs.map((p) => p[0]).join(' · '));
}
/** 게이트에서 초대 코드 → 비밀번호 가입 → 완료 화면([시작하기] 가 보임)까지. 가입 화면의 친구 코드 글을 돌려준다 */
async function signupForm(w, invite){
  await w.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 45000 });
  await w.fill('#inviteGateInput', invite);
  await w.click('#inviteGateOk');
  await w.locator('#signupPw').waitFor({ state: 'visible', timeout: 45000 });   // 바쁜 PC 에선 초대 코드 확인이 20초를 넘는다
  // 가입 화면은 50ms 뒤 첫 칸에 포커스를 준다 — 그 전에 둘째 칸을 채우면 글이 첫 칸으로 들어간다
  await waitUntil(() => w.evaluate(() => !!document.activeElement && document.activeElement.id === 'signupPw'), { ms: 5000, every: 100, what: '가입 화면이 첫 비밀번호 칸에 포커스를 주지 않음' });
  await fillChecked(w, [['#signupPw', PW], ['#signupPw2', PW]]);
  await w.click('#signupOk');
  await w.locator('#sdStart').waitFor({ state: 'visible', timeout: 40000 });
  return (await w.textContent('#signupCode')).trim();
}
/** 앱이 스스로 다시 켜는 단추(가입 완료 [시작하기] 등) — relaunch 예약만 막고 누른 뒤 꺼지기를 ms 기다린다(넘으면 이쪽이 끈다).
 *  같은 폴더로 다시 켜는 것은 부르는 쪽 몫. 스스로 꺼졌으면 true */
async function restartAfter(A, click, ms = 20000){
  await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
  const pid = pidOf(A);
  const closed = new Promise((r) => A.app.once('close', r));
  await click();
  // 꺼지면서 «Waiting for the debugger to disconnect» 로 멈출 때가 있다(도구가 붙인 --inspect)
  const done = await Promise.race([closed.then(() => true), wait(ms).then(() => false)]);
  if(!done) await A.quit();
  await gone(pid);
  A.logs.push('--- relaunch ---');
  return done;
}

// ── 시나리오 틀 ──

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const inside = (p, root) => p.startsWith(path.resolve(root) + path.sep);
/** 링크를 따라간 자리 — 아직 없는 폴더는 있는 위 폴더까지만 따라가고 나머지를 붙인다 */
function real(p){
  p = path.resolve(p);
  for(let tail = ''; ; ){
    try { return path.join(fs.realpathSync(p), tail); }
    catch(_){ const up = path.dirname(p); if(up === p) return path.join(p, tail); tail = path.join(path.basename(p), tail); p = up; }
  }
}
/** 결과 뿌리(TW_E2E_OUT 또는 /tmp/tw-e2e)가 e2e 전용 폴더가 아니면 그 까닭 — 마지막 폴더 이름에 «e2e» 가 있어야 하고,
 *  디스크 뿌리 · 홈 · /tmp · 시스템 임시 폴더 · 저장소 자신이거나 그 위 폴더면 안 되며, 저장소 안이어도 안 된다(링크를 따라간 자리도 본다) */
function outRootProblem(root){
  const guarded = [path.parse(root).root, os.homedir(), '/tmp', '/private/tmp', os.tmpdir(), REPO];
  for(const r of new Set([root, real(root)])){
    for(const g of new Set(guarded.flatMap((x) => [path.resolve(x), real(x)]))){
      if(r === g || inside(g, r)) return g + ' 이거나 그 위 폴더';
    }
    if(inside(r, REPO) || inside(r, real(REPO))) return '저장소 안';
  }
  return /e2e/i.test(path.basename(root)) ? '' : '마지막 폴더 이름에 e2e 가 없음';
}
/** 결과 폴더 — run-all 이 `node <파일> <결과 폴더>` 로 넘긴다. 따로 돌리면 <결과 뿌리>/<영역>/<이름>.
 *  frame 이 통째로 지우는 폴더라 e2e 전용 결과 뿌리(outRootProblem) 아래 꼭 <이 영역>/<이름> 두 단만 받는다(<뿌리>/<영역> 을 주면 영역 전체가 지워지므로) */
function outDir(area, name){
  const bad = outRootProblem(OUT_ROOT);
  if(bad){ console.error(`결과 뿌리(TW_E2E_OUT)가 e2e 전용 폴더가 아님 — ${bad}: ${OUT_ROOT}`); process.exit(2); }
  const out = path.resolve(process.argv[2] || path.join(OUT_ROOT, area, name));
  const rel = path.relative(real(OUT_ROOT), real(out)).split(path.sep);
  if(rel.length !== 2 || rel[0] !== area || !rel[1] || rel[1] === '..'){ console.error(`결과 폴더는 ${OUT_ROOT}/${area}/<이름> 으로: ${out}`); process.exit(2); }
  return out;
}

/** 한 시나리오의 기록 — 결과 폴더를 비우고 steps.txt 에 단계마다 ok · FAIL 을 적는다.
 *  insts 는 앱 한 벌마다 { label, A, w, shot? }(묶음 kit 이 F.add 로 넣는다 · shot(n) 이 없으면 화면만 찍는다).
 *  opts.stepMs — 한 단계 상한(없으면 상한 없음) · opts.quietGuard:false — 단계 끝 조용한 창 판정을 끈다(그것 자체를 시험하는 launcher 시나리오) */
function frame(area, name, opts = {}){
  const out = outDir(area, name);
  killDir(out);   // 전에 끊긴 실행이 남긴 앱이 같은 폴더를 쥐고 있으면 새 앱이 «두 번째 실행» 으로 바로 꺼진다
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const steps = [], insts = [];
  let failed = false;
  const F = {
    area, name, out, steps, insts,
    /** fn 이 걸린 시간은 시나리오 상한에 세지 않는다 — 공유 스택 잠금 기다리기처럼 남의 실행을 기다리는 시간(drive 가 다시 건다) */
    uncapped: (fn) => fn(),
    get failed(){ return failed; },
    fail(){ failed = true; },
    add(inst){ insts.push(inst); return inst; },
    save(){
      fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
      for(const { A } of insts){
        fs.writeFileSync(path.join(A.out, 'console.txt'), A.logs.join('\n'));
        fs.writeFileSync(path.join(A.out, 'requests.txt'), A.reqs.join('\n'));
        if(A.wsIn) fs.writeFileSync(path.join(A.out, 'ws.txt'), [...A.wsOut.map((x) => '> ' + x), ...A.wsIn.map((x) => '< ' + x)].join('\n'));
      }
    },
    note(s){ steps.push('     ' + s); F.save(); },
    async quitAll(){ for(const i of insts) await hardQuit(i.A); },
    killAll(){ for(const i of insts){ const pid = pidOf(i.A); if(pid){ try { process.kill(pid, 'SIGKILL'); } catch(_){} } } },
    // 단계마다 조용한 창(lib.js quietProblems — 자식 창까지 · 화면 밖 · 투명 · 소리 끔 · 포커스 없음 · 진짜 늘 위 아님)과 막힌 요청을 본다.
    // 어긋나면 앱을 다 끄고 잠금 폴더 옆 e2e-quiet-fail 에 까닭을 남긴다(run-all 이 다음 시나리오를 켜지 않는다). 꺼진 앱 · 조용히 켜지 않은 앱은 건너뛴다.
    // 판정을 못 했으면(오류 · 10초 넘김) 조용하다고 볼 수 없어 어긋난 것과 같게 다룬다 — 앱이 다시 켜지는 중(창 · 대상 닫힘)만 건너뛴다
    async quietGuard(label){
      const bad = [];
      for(const i of insts){
        const A = i.A;
        if(A.blocked.length) bad.push(i.label + ' 진짜 서버로 나간 요청을 막음: ' + A.blocked.slice(0, 3).join(' | '));
        let app = null;
        try { app = A.app; if(app && (app.process().exitCode !== null || app.process().signalCode !== null)) app = null; } catch(_){ app = null; }
        if(!app || !A.quiet) continue;
        let b;
        try { b = await within(quietProblems(app), QUIET_CHECK_MS); }
        catch(e){ if(!/closed|Target/.test(firstLine(e))) bad.push(i.label + ' 판정 못 함: ' + firstLine(e)); continue; }
        for(const x of b) bad.push(i.label + ' ' + x);
      }
      if(!bad.length) return;
      const msg = `조용한 창이 깨짐(${label}): ` + bad.join(' / ');
      markQuietFail(`${area}/${name} ${msg}`);
      await F.quitAll();
      throw new Error(msg);
    },
    async step(label, fn, ms = opts.stepMs){
      const t0 = Date.now();
      try {
        const r = await (ms ? within(fn(), ms) : fn());
        if(opts.quietGuard !== false) await F.quietGuard(label);
        steps.push(`ok   ${label} (${Date.now() - t0}ms)`);
        return r;
      } catch(e){
        failed = true;
        const lines = String(e && e.message || e).split('\n');
        steps.push(`FAIL ${label}: ${lines[0]}`);
        const n = steps.length;
        for(const l of lines.slice(1, 8)) if(l.trim()) steps.push('     ' + l.trim());   // 도구가 남긴 기다린 내역(무엇이 가렸는지 등)
        for(const i of insts) await within((async () => i.shot ? i.shot(`fail-${n}`) : i.w.screenshot({ path: path.join(i.A.out, `fail-${n}.png`), timeout: 5000 }))(), 8000).catch(() => {});
        throw e;
      } finally { F.save(); }
    },
    /** FEATURES.md «발견한 버그» 에 적은 버그 — 고쳐졌어야 할 모습을 fn 이 판정한다. 아직 틀리면 BUG 줄(종료 코드는 그대로),
     *  맞으면 FIXED 줄(버그 표에서 지우고 이 자리를 t.step 으로 바꾼다). 앱 코드는 이 시험 PR 에서 고치지 않는다 */
    async knownBug(id, label, fn){
      try { await fn(); steps.push(`FIXED ${id} ${label} — FEATURES.md «발견한 버그» 에서 지우고 t.step 으로 바꾼다`); }
      catch(e){ steps.push(`BUG  ${id} ${label}: ${firstLine(e)}`); }
      finally { F.save(); }
    },
  };
  return F;
}

/** 시나리오를 돌린다 — e2e-quiet-fail 이 있으면 켜지 않음 · 실행 잠금(runlock.js) · 초대 코드(seedInvite) · prepare(시드) · body · 앱 끄기 · 끝 줄(PASS · ABORT · RESULT FAIL) · 종료 코드.
 *  invite — 묶음의 초대 코드(inviteCode 로 고른 것). 단계 하나라도 FAIL 이면 실패(종료 코드 1).
 *  신호(Ctrl+C · run-all 시간 초과의 SIGTERM) · 시나리오 상한(runlock SCENARIO_MS · F.uncapped 로 기다린 시간은 빼고 잰다)이면
 *  onSignal(되돌리기 등)을 상한 안에서 돌린 뒤 앱을 죽이고 ABORT 로 끝낸다 — 그 사이 body 가 끝나도 PASS 로 끝내지 않는다.
 *  처음 끝내기가 상한 시계를 끄고, 그 뒤의 신호 · 상한은 처음 것(되돌리기 · 종료 코드)을 기다린다.
 *  onPass 는 통과해 앱을 끈 뒤. evenIfQuietFail — e2e-quiet-fail 이 있어도 돈다(조용한 창 자체를 확인하는 launcher/quiet — 그 파일을 지우기 전에 다시 통과해야 한다) */
function drive(F, { invite, prepare, body, onSignal, onPass, evenIfQuietFail = false }){
  const id = `${F.area}/${F.name}`;
  let unlock = () => {};
  let stopping = null, capTimer = null;
  const stop = (why, code) => {
    clearTimeout(capTimer);
    if(stopping) return stopping;
    stopping = stopOnce(why, code);
    return stopping;
  };
  const stopOnce = async (why, code) => {
    F.fail();
    F.steps.push('ABORT ' + why); F.save();
    try { if(onSignal) await Promise.race([onSignal(why), wait(SIGNAL_UNDO_MS)]); } catch(_){}
    F.killAll();
    unlock();
    console.log(`FAIL ${id} — ${F.out}/steps.txt`);
    process.exit(code);
  };
  for(const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop('신호 ' + sig, 130));
  (async () => {
    const blocked = () => !evenIfQuietFail && quietFailed();
    if(blocked()){ console.log(`FAIL ${id}  e2e-quiet-fail 이 있어 시작하지 않음`); process.exit(1); }
    unlock = await acquire(id, { signals: false });
    // 상한은 남은 시간으로 잰다 — F.uncapped 안에서는 시계를 멈췄다가 나올 때 남은 만큼 다시 건다(겹쳐 불러도 바깥 한 번만 센다)
    let left = SCENARIO_MS, armedAt = 0, held = 0;
    const arm = () => { armedAt = Date.now(); capTimer = setTimeout(() => stop(`시나리오가 ${SCENARIO_MS / 60000}분 안에 끝나지 않음(잠금 기다린 시간 뺌)`, 1), Math.max(0, left)); capTimer.unref(); };
    F.uncapped = async (fn) => {
      if(held++ === 0){ clearTimeout(capTimer); left -= Date.now() - armedAt; }
      try { return await fn(); }
      finally { if(--held === 0 && !stopping) arm(); }
    };
    arm();
    let err = null;
    try {
      if(blocked()) throw new Error('e2e-quiet-fail 이 있어 시작하지 않음');
      if(invite) seedInvite(invite);
      if(prepare) await prepare();
      await body();
    } catch(e){ err = e; }
    // 상한 · 신호가 이미 끝내는 중이면 끝 줄 · 종료 코드는 stop 이 맡는다(되돌리기를 기다리는 사이 body 가 끝나도 PASS 를 적지 않는다)
    if(stopping) return;
    if(err) F.steps.push('ABORT ' + firstLine(err));
    F.save();
    await F.quitAll();
    let pass = !err && !F.failed;
    if(pass && onPass){
      try { await onPass(); }
      catch(e){ pass = false; err = e; F.steps.push('ABORT 통과 뒤 정리: ' + firstLine(e)); }
    }
    if(stopping) return;
    unlock();
    if(!err) F.steps.push(pass ? 'PASS' : 'RESULT FAIL');   // run-all 은 종료 코드와 PASS 줄을 함께 본다
    F.save();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${F.out}/steps.txt`);
    process.exit(pass ? 0 : 1);
  })();
}

module.exports = {
  PW, PG, OUT_ROOT, LAUNCH_MARK, API, API_HOST, wait, waitUntil, within, firstLine, quietFailed,
  seedSql, query, inviteCode, seedInvite, http, emuSignIn, headlessLogin, apiUser, withToken, apiIn, uidOf,
  killDir, goneDir, gone, hardQuit, launchRetry, fillChecked, signupForm, restartAfter,
  outDir, frame, drive,
};
