// 방 · 채팅 시나리오 공통부 — 새 계정 만들기 · 캐릭터 · 방 들어가기 · 단계 기록 · 판정
// 시나리오 파일은 kit.scenario(__filename, async (t) => { ... }) 한 번만 부른다. 끝나면 종료 코드 0(전부 ok) · 1(FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeApp, wait, quietProblems, API_HOST } = require('../../lib.js');
const { acquire } = require('../../runlock.js');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const SEED = path.resolve(__dirname, '..', '..', 'seed');
const PW = 'e2e-pass-1234';   // 에뮬레이터 안에서만 쓰는 시험 비밀번호
const INVITE = 'INVT-RMRM-E2E3';   // seed/room.sql 이 넣는 초대 코드(여러 번 쓸 수 있게 크게 잡음)
const PG = process.env.TW_E2E_PG || 'tw-dev-local-postgres-1';

// 로컬 묶음의 DB 에 시드 SQL 을 넣는다 — 이미 있으면 그대로(ON CONFLICT DO NOTHING)
function seed(file, vars){
  const args = ['exec', '-i', PG, 'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', 'tw_api_dev', '-d', 'tw_dev'];
  for(const [k, v] of Object.entries(vars || {})) args.push('-v', `${k}=${v}`);
  const docker = process.env.DOCKER_HOST ? ['docker'] : ['docker', '--context', 'orbstack'];
  return execFileSync(docker[0], [...docker.slice(1), ...args], { input: fs.readFileSync(path.join(SEED, file)), encoding: 'utf8' });
}

const until = async (what, fn, ms = 20000, gap = 250) => {
  const end = Date.now() + ms;
  let last;
  for(;;){
    try { last = await fn(); if(last) return last; } catch(e){ last = e.message; }
    if(Date.now() > end) throw new Error(`${what} — ${ms}ms 안에 안 됨 (마지막 값 ${JSON.stringify(last)?.slice(0, 200)})`);
    await wait(gap);
  }
};
const eq = (what, got, want) => {
  if(JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)} ≠ 기대 ${JSON.stringify(want)}`);
};
// 앱은 한 폴더에 한 벌만 뜬다(single instance) — 앞 프로세스가 다 끝난 뒤 다시 켠다
async function gone(pid){
  const alive = () => { try { process.kill(pid, 0); return true; } catch(_){ return false; } };
  for(let i = 0; i < 40 && alive(); i++) await wait(250);
  if(alive()){ try { process.kill(pid, 'SIGKILL'); } catch(_){} await wait(500); }
}
const ok = (what, v) => { if(!v) throw new Error(what); };

function scenario(file, body){
  const area = path.basename(path.dirname(file)), name = path.basename(file, '.js');
  const out = path.resolve(process.argv[2] || path.join(process.env.TW_E2E_OUT || '/tmp/tw-e2e', area, name));
  if(out === REPO || out.startsWith(REPO + path.sep)){ console.error('결과 폴더는 저장소 밖에: ' + out); process.exit(2); }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const steps = [], users = [];
  const save = () => {
    fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
    for(const u of users){
      fs.writeFileSync(path.join(u.A.out, 'console.txt'), u.A.logs.join('\n'));
      fs.writeFileSync(path.join(u.A.out, 'requests.txt'), u.A.reqs.join('\n'));
      fs.writeFileSync(path.join(u.A.out, 'ws.txt'), [...u.A.wsOut.map((x) => '> ' + x), ...u.A.wsIn.map((x) => '< ' + x)].join('\n'));
    }
  };
  const t = {
    out, steps, until, eq, ok, wait, users,
    note: (s) => { steps.push('     ' + s); },
    // 단계 하나가 멈춰 있으면(앱이 답하지 않음) ms 뒤 실패로 끊는다
    async step(label, fn, ms = 180000){
      const t0 = Date.now();
      let timer;
      const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${ms}ms 안에 끝나지 않음`)), ms); });
      try {
        const r = await Promise.race([fn(), limit]);
        // 단계마다 창이 조용한지 본다(lib.js quietProblems — 네 묶음 같은 판정: 자식 창까지 · 화면 밖 · 투명 · 소리 끔 · 포커스 없음 · 진짜 늘 위 아님)
        for(const u of users){
          const bad = u.A.quiet ? await quietProblems(u.A.app).catch((e) => ['판정 못 함 ' + e.message]) : [];
          if(bad.length){
            const msg = `${u.label}: 창이 조용하지 않음 — ${bad.join(' / ')}`;
            // TW_E2E_QUIET_FAIL=<파일> 이면 그 파일에 적어 둔다 — run-all 은 그 파일이 생기면 남은 시나리오를 돌리지 않는다
            if(process.env.TW_E2E_QUIET_FAIL) fs.writeFileSync(process.env.TW_E2E_QUIET_FAIL, `${area}/${name} · ${label}\n${msg}\n`);
            throw new Error(msg);
          }
        }
        steps.push(`ok   ${label} (${Date.now() - t0}ms)`); return r;
      }
      catch(e){
        steps.push(`FAIL ${label}: ${String(e.message).split('\n')[0]}`); console.error(e.stack);
        for(const u of users) await u.shot(`fail-${steps.length}`).catch(() => {});
        throw e;
      } finally { clearTimeout(timer); save(); }
    },
    // 새 계정 하나 = 격리된 앱 한 벌(결과 폴더 아래 <이름>/). 가입 → 다시 켜기 → 캐릭터 만들기까지
    async user(label, opts = {}){
      const u = openUser(t, path.join(out, label), label);
      users.push(u);
      await t.step(`${label}: 켜기`, () => u.start(), 300000);
      await t.step(`${label}: 가입`, () => u.signup(), 360000);
      if(opts.character !== false) await t.step(`${label}: 캐릭터 만들기`, () => u.makeCharacter());
      return u;
    },
    // 같은 계정을 다른 PC(앱 한 벌 더)에서 친구 코드 · 비밀번호로 로그인
    async sameAccount(src, label){
      const u = openUser(t, path.join(out, label), label);
      users.push(u);
      await t.step(`${label}: 켜기`, () => u.start(), 300000);
      await t.step(`${label}: ${src.label} 계정으로 로그인`, () => u.login(src.fc, src.pw), 360000);
      return u;
    },
  };
  // 시나리오 전체 상한 — 넘으면 앱을 모두 끄고 실패로 끝낸다(러너가 다음 시나리오로 가게)
  const limitMin = Number(process.env.TW_E2E_SCENARIO_MIN || 20);
  const watchdog = () => setTimeout(() => {
    steps.push(`ABORT 시나리오가 ${limitMin}분 안에 끝나지 않음`);
    save();
    for(const u of users){ try { process.kill(u.A.app.process().pid, 'SIGKILL'); } catch(_){} }
    unlock();
    console.log(`FAIL ${area}/${name} — ${out}/steps.txt`);
    process.exit(1);
  }, limitMin * 60000).unref();
  // 실행 잠금은 runlock.js 한 벌(TW_E2E_RUN_LOCK · run-all.js 가 잡았으면 다시 안 잡음)
  let unlock = () => {};
  // 손으로 끊어도(Ctrl+C · kill) 앱과 자물쇠를 남기지 않는다
  for(const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
    for(const u of users){ try { process.kill(u.A.app.process().pid, 'SIGKILL'); } catch(_){} }
    unlock();
    process.exit(130);
  });
  (async () => {
    unlock = await acquire(`${area}/${name}`);
    watchdog();
    seed('room.sql');
    await body(t);
    steps.push('PASS');
  })().catch((e) => {
    if(!steps.some((s) => s.startsWith('FAIL'))) steps.push('ABORT ' + String(e.message).split('\n')[0]);
    process.exitCode = 1;
  }).finally(async () => {
    save();
    for(const u of users) await u.A.quit().catch(() => {});
    unlock();
    console.log(`${process.exitCode ? 'FAIL' : 'PASS'} ${area}/${name} — ${out}/steps.txt`);
    process.exit(process.exitCode || 0);
  });
}

function openUser(t, out, label){
  fs.mkdirSync(out, { recursive: true });
  const A = makeApp(out);
  const u = { label, A, fc: '', pw: PW, code: '', uid: '' };
  wrapLaunch(A);
  u.start = async () => { u.w = await A.launch(); };
  u.shot = (n) => u.w.screenshot({ path: path.join(out, n + '.png') });
  u.eval = (fn, arg) => u.w.evaluate(fn, arg);
  // 사람처럼 누르되, 책상 모드처럼 런처 단추가 가려진 화면이면 같은 처리기를 부른다(3초 안에 못 누르면)
  u.press = async (sel) => {
    try { await u.w.click(sel, { timeout: 3000 }); }
    catch(_){ await u.eval((x) => document.querySelector(x).click(), sel); }
  };
  // 앱의 로그인 토큰으로 API 를 부른다(길 돌리기를 거쳐 로컬 API 로 · 요청은 requests.txt 에 남는다)
  u.api = (method, p, body) => u.w.evaluate(async ({ host, method, p, body }) => {
    const r = await fetch(`https://${host}${p}`, { method, headers: { Authorization: 'Bearer ' + await window.firebaseAPI.getIdToken(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch(_){}
    return { status: r.status, body: j };
  }, { host: API_HOST, method, p, body });
  u.relaunch = async () => {
    const pid = A.app.process().pid;
    await A.quit();
    await gone(pid);
    A.logs.push('--- relaunch ---');
    u.w = await A.launch();
    await u.waitDesk();
  };
  u.waitDesk = () => until(`${label}: 런처`, () => u.eval(() => {
    const l = document.getElementById('lcEmpty') || document.getElementById('lcInvite');
    return !!(l && typeof roomEntryMod === 'object' && window.firebaseAPI && TwRtHub.store && TwRoomRt.store.isReady());
  }), 60000);
  u.signup = async () => {
    const w = u.w;
    await w.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 45000 });
    await w.fill('#inviteGateInput', INVITE);
    await w.click('#inviteGateOk');
    await w.locator('#signupPw').waitFor({ state: 'visible', timeout: 45000 });   // 바쁜 PC 에선 초대 코드 확인이 20초를 넘는다
    u.fc = (await w.textContent('#signupCode')).trim();
    await w.fill('#signupPw', PW);
    await w.fill('#signupPw2', PW);
    await w.click('#signupOk');
    await w.locator('#sdStart').waitFor({ state: 'visible', timeout: 30000 });
    // [시작하기] 는 앱을 다시 켠다 — relaunch 예약만 막고 같은 결과 폴더로 다시 켠다(README «함정»)
    await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
    const pid = A.app.process().pid;
    const closed = new Promise((r) => A.app.once('close', r));
    await w.click('#sdStart');
    if(!await Promise.race([closed.then(() => true), wait(20000).then(() => false)])) await A.quit();
    await gone(pid);
    A.logs.push('--- relaunch ---');
    u.w = await A.launch();
    await u.waitDesk();
    await u.whoami();
    fs.writeFileSync(path.join(out, 'account.json'), JSON.stringify({ fc: u.fc, pw: PW, code: u.code, uid: u.uid }));
    t.note(`${label} 친구 코드 ${u.fc} · userCode ${u.code}`);
  };
  u.whoami = async () => {
    const me = await until(`${label}: /v2/me`, async () => { const r = await u.api('GET', '/v2/me'); return r.status === 200 && r.body; });
    u.code = me.data.userCode;
    u.fc = me.data.friendCode;   // 가입 화면은 친구 코드를 가려 보인다 — 서버 값을 쓴다
    u.uid = await u.eval(async () => JSON.parse(atob((await window.firebaseAPI.getIdToken()).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).user_id);
    return me.data;
  };
  u.login = async (fc, pw) => {
    const w = u.w;
    await w.locator('#inviteGateFc').waitFor({ state: 'visible', timeout: 30000 });
    await w.fill('#inviteGateFc', fc);
    await w.fill('#inviteGatePw', pw);
    await A.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
    const pid = A.app.process().pid;
    const closed = new Promise((r) => A.app.once('close', r));
    await w.click('#inviteGateFcBtn');
    // 로그인 뒤 다시 켜는 판과 그 자리에서 이어 가는 판이 있다 — 꺼지면 다시 켠다
    const r = await Promise.race([closed.then(() => 'closed'), until(`${label}: 로그인 뒤 런처`, () => u.eval(() => typeof roomEntryMod === 'object' && TwRoomRt.store.isReady()), 40000).then(() => 'stay')]);
    if(r === 'closed'){ await gone(pid); A.logs.push('--- relaunch ---'); u.w = await A.launch(); }
    await u.waitDesk();
    await u.whoami();
  };
  // 런처의 빈 칸 → 사람 → «다음» 끝까지 → «완성 → 저장»(README «해 본 것»)
  u.makeCharacter = async () => {
    const w = u.w;
    await w.click('#lcEmpty');
    await w.locator('#raceHuman').waitFor({ state: 'visible', timeout: 20000 });
    await w.click('#raceHuman');
    await until(`${label}: 생성기`, () => u.eval(() => getComputedStyle(document.getElementById('crNext')).display !== 'none' || getComputedStyle(document.getElementById('crDone')).display !== 'none'), 20000);
    for(let i = 0; i < 10; i++){
      const done = await u.eval(() => getComputedStyle(document.getElementById('crDone')).display !== 'none');
      if(done) break;
      await w.click('#crNext');
      await wait(300);
    }
    await w.click('#crDone');
    await until(`${label}: 슬롯 저장`, () => u.eval(() => Array.isArray(slots) && slots.some(Boolean) && getComputedStyle(document.getElementById('crDone')).display === 'none' || !document.getElementById('crDone').offsetParent), 30000);
    await until(`${label}: 슬롯 저장됨`, () => u.eval(() => slots.some(Boolean)), 30000);
  };
  // 방 상태 한 장 — 판정은 이 값과 화면 글로 한다
  u.room = () => u.eval(() => ({
    code: Presence.active() ? Presence.roomCode() : null,
    me: TwRoomRt.store.myCode(),
    host: window._roomMetaCache ? window._roomMetaCache.host : null,
    meta: window._roomMetaCache || null,
    friends: Presence.active() ? Object.fromEntries(Object.entries(Presence.friendsObj()).map(([k, f]) => [k, { name: f.name, level: f.level, userStatus: f.userStatus, state: f.state, awayImg: f.awayImg }])) : {},
  }));
  u.toasts = () => u.eval(() => window.__e2eToasts || []);
  u.openLobby = async () => {
    await u.eval(() => { document.getElementById('inviteOverlay').classList.remove('on'); });
    // 책상 모드에선 런처 단추가 안 보인다 — 같은 처리기를 부른다(모달은 그 화면에서도 뜬다)
    await u.press('#lcInvite');
    await until(`${label}: 방 모달`, () => u.eval(() => document.getElementById('inviteOverlay').classList.contains('on')));
  };
  u.closeLobby = () => u.eval(() => { const b = document.getElementById('inviteClose'); if(document.getElementById('inviteOverlay').classList.contains('on')) b.click(); });
  // 로비의 [방 만들기] → 창에서 채널 · 제목 · 공개 → [방 만들기]. 들어간 방 코드를 돌려준다
  u.createRoom = async (o = {}) => {
    await u.openLobby();
    await u.press('#lobbyCreate');
    await u.w.locator('#roomCreatePanel').waitFor({ state: 'visible', timeout: 10000 });
    await u.press(o.channel === 'together' ? '#rcChTogether' : '#rcChWorking');
    if(o.title !== undefined) await u.w.fill('#rcTitle', o.title);
    if(o.open === false) await u.w.uncheck('#rcOpen');
    if(o.music) await u.w.check('#rcMusic');
    await u.press('#rcCreate');
    const code = await until(`${label}: 방에 들어감`, async () => { const r = await u.room(); return r.code && r.host && r.code; }, 30000);
    await u.closeLobby();
    return code;
  };
  // 로비 아래 방 코드 칸에 붙여넣기 → [입장]
  u.joinRoom = async (code, expect = code) => {
    await u.openLobby();
    // 칸은 maxlength 5 라 «WORK-AB12» 를 치면 잘린다 — 앱의 붙여넣기 길(값 넣고 input)과 같게 넣는다
    await u.eval((c) => { const el = document.getElementById('inviteCode'); el.value = c; el.dispatchEvent(new Event('input')); }, code);
    await u.press('#inviteJoin');
    await until(`${label}: ${expect} 에 들어감`, async () => { const r = await u.room(); return r.code === expect && !!r.host; }, 30000);
    await u.closeLobby();
  };
  u.leaveRoom = async () => {
    await u.openLobby();
    await u.press('#inviteLeave');
    await until(`${label}: 방에서 나옴`, async () => !(await u.room()).code, 20000);
    await u.closeLobby();
  };
  // 관리자로 만든다(seed/admin.sql) → 다시 켜서 서버가 프리미엄을 붙인 것을 확인. 투게더룸 · 시크릿룸 · 프리미엄 기능에 쓴다
  u.makeAdmin = async () => {
    seed('admin.sql', { uid: u.uid });
    await u.relaunch();
    await until(`${label}: 서버가 관리자 · 프리미엄으로 봄`, async () => { const me = await u.whoami(); return me.admin && me.premium; });
    await until(`${label}: 앱이 프리미엄으로 봄`, () => u.eval(() => roomEntryMod._myRoomLicensed()), 30000);
  };
  u.toastSeen = (re, ms = 15000) => until(`${label}: 토스트 ${re}`, async () => (await u.toasts()).some((x) => re.test(x)), ms);
  u.text = (sel) => u.eval((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
  u.shown = (sel) => u.eval((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
  // 좌석 — 내 것(remote 아님) · 남의 것(remote). 이름표 글은 머리 위에 그린 그대로
  u.seats = () => u.eval(() => seats.map((s) => ({
    remote: !!s.remote, friendId: s.friendId || null, userId: s.friendUserId || null,
    x: s.group ? +s.group.position.x.toFixed(3) : null,
    visible: s.rig ? s.rig.visible : null,
    status: s.remote ? (s.remoteUserStatus || null) : null,
    awayImg: s.remote ? (s.remoteAwayImg || '') : '',
    plate: s.namePlateEl ? s.namePlateEl.textContent.replace(/\s+/g, ' ').trim() : null,
  })));
  // 좌석 우클릭 메뉴(앱의 우클릭 처리기와 같은 함수) — 열린 메뉴의 줄 글을 돌려준다
  // 열린 좌석 메뉴는 ESC 로 닫는다(메뉴와 같이 깔린 투명 뒷판까지 — 지우기만 하면 뒷판이 남아 화면 클릭을 먹는다)
  u.closeSeatMenu = async () => {
    if(await u.eval(() => !!document.querySelector('.cr-preset-ctx'))) await u.w.keyboard.press('Escape');
    await until(`${label}: 좌석 메뉴 닫힘`, () => u.eval(() => !document.querySelector('.cr-preset-ctx')), 5000);
  };
  u.seatMenu = async (remote) => { await u.closeSeatMenu(); return u.eval((r) => {
    const seat = seats.find((s) => !!s.remote === r);
    if(!seat) return null;
    // 이름표 우클릭(사람이 누르는 자리 — 좌석 우클릭과 같은 메뉴) · 이름표가 없으면 좌석 우클릭 처리기
    const ev = new MouseEvent('contextmenu', { clientX: 200, clientY: 200, bubbles: true, cancelable: true, button: 2 });
    if(seat.namePlateEl) seat.namePlateEl.dispatchEvent(ev); else seatMenuMod._seatCtxMenu(ev, seat);
    const m = document.querySelector('.cr-preset-ctx');
    return m ? [...m.children].map((c) => c.textContent.trim()).filter(Boolean) : null;
  }, remote); };
  u.seatMenuClick = (text) => u.eval((t) => {
    const it = [...document.querySelectorAll('.cr-preset-ctx > *')].find((c) => c.textContent.trim().startsWith(t));
    if(!it) throw new Error('메뉴에 없음: ' + t);
    it.click();
    return true;
  }, text);
  // 좌석 몸 가운데의 화면 자리(캔버스 기준 → 창 좌표) — 그 자리를 마우스로 누르면 앱의 레이캐스트가 그 좌석을 맞힌다
  u.seatPoint = (remote) => u.eval((r) => {
    const s = seats.find((x) => !!x.remote === r);
    const box = new THREE.Box3().setFromObject(s.bodyWrap || s.rig);
    const v = box.getCenter(new THREE.Vector3()).project(camera);
    const rc = canvas.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height };
  }, remote);
  // 대화창(F5 와 같은 길) — 투게더룸 · 시크릿룸에서만 열린다
  u.openChat = async () => {
    await u.eval(() => { if(!chatUiMod._chatWindowIsOpen()) chatUiMod.openChatWindow(); });
    await until(`${label}: 대화창 열림`, () => u.shown('#chatOverlay'));
  };
  u.say = async (text) => {
    await u.w.fill('#chatInput', text);
    await u.w.press('#chatInput', 'Enter');
  };
  u.chatText = () => u.text('#chatMessages');
  // 책상 모드(실행 화면) — 좌석 · 상태칩은 여기서만 만들어진다
  u.desk = async () => {
    const on = () => u.eval(() => !document.getElementById('launcher').classList.contains('on') && launcherStateMod.appMode() === 'run');
    if(!(await on())) await u.w.click('#lcPreview');
    await until(`${label}: 책상 모드`, on, 20000);
    await until(`${label}: 상태칩`, () => u.shown('#myStatusChipBtn'), 20000);
  };
  return u;
}

// 토스트를 기록해 두고 판정에 쓴다(뜨고 사라지는 글이라 DOM 만으로는 놓친다)
const toastSpy = () => {
    if(window.__e2eToastSpy) return;
    window.__e2eToastSpy = true;
    window.__e2eToasts = [];
    new MutationObserver((ms) => {
      for(const m of ms) for(const n of m.addedNodes){
        const el = n.nodeType === 1 ? n : n.parentElement;
        if(!el) continue;
        const box = el.closest && el.closest('#toast, .toast, [id^="toast"]');
        if(box) window.__e2eToasts.push(box.textContent.trim());
      }
      const t = document.getElementById('toast');
      if(t && t.textContent && window.__e2eToasts[window.__e2eToasts.length - 1] !== t.textContent.trim()) window.__e2eToasts.push(t.textContent.trim());
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
};

// 켠 직전 창의 첫 읽기가 길 돌리기보다 먼저 떠나 처음 요청이 바깥 dev 주소로 새는 때가 있다 —
// 돌린 요청이 하나도 안 찍히면 다시 읽는다. 토스트 기록도 켤 때마다 다시 건다
function wrapLaunch(A){
  const launch = A.launch;
  A.wsIn = []; A.wsOut = [];
  A.launch = async () => {
    let n = A.reqs.length, w;
    // 여러 벌이 같이 뜨는 동안 첫 창이 30초 안에 안 오는 때가 있다 — 그 프로세스만 끄고 세 번까지 다시 켠다
    for(let i = 0; ; i++){
      try { w = await launch(); break; }
      catch(e){
        if(i >= 3 || !/firstWindow/.test(e.message)) throw e;
        A.logs.push('--- 첫 창이 안 와서 다시 켬 ---');
        const pid = A.app && A.app.process().pid;
        await A.quit().catch(() => {});
        if(pid) await gone(pid);
      }
    }
    for(let i = 0; i < 3; i++){
      const routed = await until('돌린 요청', () => A.reqs.length > n, 12000).then(() => true, () => false);
      if(routed) break;
      A.logs.push('--- 돌린 요청이 없어 다시 읽음 ---');
      n = A.reqs.length;
      await w.reload();
    }
    await w.evaluate(toastSpy).catch(() => {});
    // realtime 이 오간 글(ws.txt · 실패를 볼 때 참고) — 앱이 창을 띄우자마자 붙은 연결은 놓칠 수 있어 판정에는 쓰지 않는다
    w.on('websocket', (ws) => {
      ws.on('framereceived', (f) => A.wsIn.push(String(f.payload).slice(0, 2000)));
      ws.on('framesent', (f) => A.wsOut.push(String(f.payload).slice(0, 2000)));
    });
    return w;
  };
}

module.exports = { scenario, seed, until, eq, ok, wait, PW, INVITE };
