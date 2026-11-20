// 시나리오 공통부 — 새 계정으로 앱 켜기 · 친구 · 방 · 마이홈 · 설정 도우미
// 단계 기록 · 판정 · 앱 켜기 · 가입 · API 부르기 · 시드 SQL 은 ../_shared.js.
// 시나리오 파일은 scenario(이름, async (t) => { … }) 하나를 부른다. t.user(이름) 로 앱 한 벌(새 계정)을 켜고, t.step 으로 단계를 판정한다.
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, API_HOST } = require('../../lib.js');
const S = require('../_shared.js');
const { wait, PW, seedSql } = S;

const INVITE = process.env.TW_E2E_INVITE || 'INVT-SCAL-E2E3';   // seed/invite.sql 에 code 로 넘겨 넣는다(묶음마다 코드를 따로 — 사용 횟수를 나눠 쓰지 않게)

// 렌더러 안에서 앱 토큰으로 API 를 부른다 — 요청이 앱과 같은 길(주소 돌리기 · 요청 기록)로 간다
const apiIn = (w, method, p, body) => S.apiIn(w, method, p, body, { noStore: false });

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

function scenario(name, body){
  const F = S.frame('social', name);
  const users = F.insts;
  const { step, note } = F;

  // confirm · alert 같은 기본 창은 «확인» 으로 닫고 문구를 남긴다(친구 삭제 확인 등)
  function hookDialogs(u){
    u.w.on('dialog', (d) => { u.dialogs.push(d.type() + ':' + d.message()); d.accept().catch(() => {}); });
  }

  // 새 계정 한 벌: 초대 코드 → 가입 → [시작하기](다시 켜기) → 로그인 · realtime 이 붙을 때까지
  async function user(label, opts = {}){
    const A = makeApp(path.join(F.out, label));
    fs.mkdirSync(A.out, { recursive: true });
    const u = F.add({ label, A, w: null, me: null, dialogs: [] });
    u.w = await S.launchRetry(A);
    const w0 = u.w;
    await step(`${label}: 가입`, async () => {
      await S.signupForm(w0, INVITE);
      // [시작하기] 는 앱을 다시 켠다 — 다시 켜기 예약만 막고 같은 폴더로 이 도구가 다시 켠다(README «함정»)
      if(!(await S.restartAfter(A, () => w0.click('#sdStart')))) note(`${label}: [시작하기] 뒤 20초 안에 안 꺼짐 — 디버거 연결이 남아 도구가 껐음`);
      u.w = await S.launchRetry(A);
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
    // 로그인 uid(Auth 에뮬레이터)
    u.uid = () => S.uidOf(u.w);
    // 앱을 끄고 같은 폴더로 다시 켠다(로그인 유지) — 서버 쪽 권한을 바꾼 뒤 등
    u.relaunch = async () => {
      await A.quit();
      A.logs.push('--- relaunch ---');
      u.w = await S.launchRetry(A);
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

  const t = { out: F.out, step, user, note, wait, assert, apiIn, until, users, knownBug: F.knownBug };
  S.drive(F, {
    prepare: () => seedSql('invite.sql', { code: INVITE }),
    body: () => body(t),
    // 통과하면 앱 데이터(수백 MB)는 지우고 기록만 남긴다 — 도우미 프로세스가 다 끝난 뒤에(남아서 쓰면 지우기가 ENOTEMPTY 로 실패한다)
    onPass: async () => {
      for(const u of users){
        await S.goneDir(u.A.out);
        fs.rmSync(path.join(u.A.out, 'appdata'), { recursive: true, force: true });
        fs.rmSync(path.join(u.A.out, 'wrap'), { recursive: true, force: true });
      }
    },
  });
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

// 관리자로 만들고(seed/admin.sql) 앱을 다시 켠다 — 관리자는 프리미엄(라이선스 기능)이 붙는다
async function makeAdmin(u){
  seedSql('admin.sql', { uid: await u.uid() });
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
  // 방을 만든 뒤에는 방 창이 런처를 덮고 있어 화면 누르기가 막힌다 — 런처 미리보기의 누름을 직접 부른다(누르면 같은 처리)
  await u.eval(() => document.getElementById('lcPreview').click());
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
