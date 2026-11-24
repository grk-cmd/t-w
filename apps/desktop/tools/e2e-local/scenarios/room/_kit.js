// 방 · 채팅 시나리오 공통부 — 새 계정 만들기 · 캐릭터 · 방 들어가기 · 좌석 · 대화창 도우미
// 단계 기록 · 판정 · 앱 켜기 · 가입 · 시드 SQL 은 ../_shared.js. 시나리오 파일은 kit.scenario(__filename, async (t) => { ... }) 한 번만 부른다
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp } = require('../../lib.js');
const S = require('../_shared.js');
const { wait, PW, seedSql } = S;

const INVITE = S.inviteCode('INVT-RMRM-E2E3');   // 이 묶음의 초대 코드(규칙은 _shared.js inviteCode)

const until = (what, fn, ms = 20000, gap = 250) => S.waitUntil(fn, { ms, every: gap, what });
const eq = (what, got, want) => {
  if(JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)} ≠ 기대 ${JSON.stringify(want)}`);
};
const ok = (what, v) => { if(!v) throw new Error(what); };

function scenario(file, body){
  const F = S.frame(path.basename(path.dirname(file)), path.basename(file, '.js'), { stepMs: 180000 });
  const users = F.insts;
  const t = {
    out: F.out, steps: F.steps, until, eq, ok, wait, users,
    note: F.note, step: F.step, knownBug: F.knownBug,
    // 새 계정 하나 = 격리된 앱 한 벌(결과 폴더 아래 <이름>/). 가입 → 다시 켜기 → 캐릭터 만들기까지
    async user(label, opts = {}){
      const u = F.add(openUser(t, path.join(F.out, label), label));
      await t.step(`${label}: 켜기`, () => u.start(), 300000);
      await t.step(`${label}: 가입`, () => u.signup(), 360000);
      if(opts.character !== false) await t.step(`${label}: 캐릭터 만들기`, () => u.makeCharacter());
      return u;
    },
    // 같은 계정을 다른 PC(앱 한 벌 더)에서 친구 코드 · 비밀번호로 로그인
    async sameAccount(src, label){
      const u = F.add(openUser(t, path.join(F.out, label), label));
      await t.step(`${label}: 켜기`, () => u.start(), 300000);
      await t.step(`${label}: ${src.label} 계정으로 로그인`, () => u.login(src.fc, src.pw), 360000);
      return u;
    },
  };
  S.drive(F, { invite: INVITE, body: () => body(t) });
}

function openUser(t, out, label){
  fs.mkdirSync(out, { recursive: true });
  const A = makeApp(out);
  const u = { label, A, fc: '', pw: PW, code: '', uid: '' };
  wrapLaunch(A);
  u.start = async () => { u.w = await A.launch(); };
  // 실패 때 남기는 것 — 화면과, 그때까지 뜬 토스트 글(조용히 돌아선 까닭이 토스트로만 남는 길이 있다 — 예: 입장 중 · 캐릭터 없음)
  u.shot = async (n) => {
    await u.w.screenshot({ path: path.join(out, n + '.png') });
    const ts = await u.toasts().catch(() => null);
    if(ts) fs.writeFileSync(path.join(out, n + '-toasts.txt'), ts.join('\n') + '\n');
  };
  u.eval = (fn, arg) => u.w.evaluate(fn, arg);
  // 사람처럼 누르되, 책상 모드처럼 런처 단추가 가려진 화면이면 같은 처리기를 부른다(3초 안에 못 누르면)
  u.press = async (sel) => {
    try { await u.w.click(sel, { timeout: 3000 }); }
    catch(_){ await u.eval((x) => document.querySelector(x).click(), sel); }
  };
  // 앱의 로그인 토큰으로 API 를 부른다(길 돌리기를 거쳐 로컬 API 로 · 요청은 requests.txt 에 남는다)
  u.api = (method, p, body) => S.apiIn(u.w, method, p, body, { device: false, noStore: false });
  u.relaunch = async () => {
    const pid = A.app.process().pid;
    await A.quit();
    await S.gone(pid);
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
    u.fc = await S.signupForm(w, INVITE);
    // [시작하기] 는 앱을 다시 켠다 — relaunch 예약만 막고 같은 결과 폴더로 다시 켠다(README «함정»)
    await S.restartAfter(A, () => w.click('#sdStart'));
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
    u.uid = await S.uidOf(u.w);
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
    if(r === 'closed'){ await S.gone(pid); A.logs.push('--- relaunch ---'); u.w = await A.launch(); }
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
    // 서버에 올라갈 때까지 — 보관함은 3초 몰아 저장(closet.js)이라, 그 전에 앱을 끄면(다시 켜기) 캐릭터가 사라진다
    await until(`${label}: 캐릭터가 서버에 올라감`, async () => {
      if(await u.eval(() => closetMod.unsavedCount()) !== 0) return false;
      await u.eval(() => closetMod.waitFlush());
      const r = await u.api('GET', '/v2/me/avatars');
      return r.status === 200 && !!r.body.data && (r.body.data.slots || []).some(Boolean);   // 옷장 { slots: [avatarId|null ×5], … }
    }, 30000);
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
    seedSql('admin.sql', { uid: u.uid });
    await u.relaunch();
    await until(`${label}: 서버가 관리자 · 프리미엄으로 봄`, async () => { const me = await u.whoami(); return me.admin && me.premium; });
    await until(`${label}: 앱이 프리미엄으로 봄`, () => u.eval(() => roomEntryMod._myRoomLicensed()), 30000);
  };
  // 포커스 레벨을 정한다(seed/focus.sql — 서버 레벨 = 1 + 누적초/3600) → 다시 켜서 앱이 그 레벨을 받았는지
  u.setLevel = async (level) => {
    seedSql('focus.sql', { uid: u.uid, sec: (level - 1) * 3600 });
    await u.relaunch();
    await until(`${label}: 앱 레벨 ${level}`, () => u.eval(() => focusLevelMod.getFocusLevel()).then((lv) => lv >= level), 30000);
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

// 켤 때마다 토스트 기록 · realtime 기록을 다시 건다. 주소 돌리기는 main 에서 처음부터 걸리고(route-main.js) lib.launch 가 확인한다
function wrapLaunch(A){
  const launch = A.launch;
  A.wsIn = []; A.wsOut = [];
  A.launch = async () => {
    const w = await S.launchRetry(A, launch);
    await w.evaluate(toastSpy).catch(() => {});
    // realtime 이 오간 글(ws.txt · 실패를 볼 때 참고) — 앱이 창을 띄우자마자 붙은 연결은 놓칠 수 있어 판정에는 쓰지 않는다
    w.on('websocket', (ws) => {
      ws.on('framereceived', (f) => A.wsIn.push(String(f.payload).slice(0, 2000)));
      ws.on('framesent', (f) => A.wsOut.push(String(f.payload).slice(0, 2000)));
    });
    return w;
  };
}

module.exports = { scenario, seedSql, until, eq, ok, wait, PW, INVITE };
