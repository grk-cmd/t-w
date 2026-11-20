// 계정 시나리오 공통부 — 앱 여러 벌 · API 로 계정 만들기 · 다시 켜기 · 구글 로그인 흉내 · 화면 도우미
// 단계 기록 · 판정 · 앱 켜기 · 가입 · 시드 SQL 은 ../_shared.js. 시나리오 파일은 K.scenario(이름, async (t) => { … }) 하나만 부른다
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeApp, API_HOST } = require('../../lib.js');
const S = require('../_shared.js');
const { wait, PW, API, http, emuSignIn, withToken, seedSql: sql, query: sqlQuery, fillChecked } = S;

const INVITE = 'INVT-ACCT-E2E5';   // seed/invite.sql 로 넣는 이 묶음의 초대 코드
const STEP_MAX_MS = 5 * 60 * 1000;   // 한 단계가 끝없이 기다리지 않게(앱 다시 켜기 · 확인창을 넉넉히 품는 상한)

// 에뮬레이터는 서명을 보지 않는다 — 구글이 준 것처럼 생긴 서명 없는 ID 토큰
function fakeGoogleIdToken(sub, email){
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'none', typ: 'JWT' }) + '.' + b({ iss: 'https://accounts.google.com', aud: 'tw-e2e', sub, email, email_verified: true, iat: now, exp: now + 3600 }) + '.';
}
const uniq = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

/** 관리자 계정 — API 로 만들고 seed/admin.sql 로 관리자 표에 넣는다. 서버는 역할 판정을 잠깐(10초) 들고 있어 관리자로 보일 때까지 기다린다 */
async function adminAccount(){
  const a = await apiAccount();
  await a.token();
  sql('admin.sql', { uid: a.authUid });
  const t0 = Date.now();
  while(Date.now() - t0 < 30000){
    const me = await a.api('GET', '/v2/me');
    if(me.data && me.data.admin === true) return a;
    await wait(2000);
  }
  throw new Error('관리자로 보이지 않음');
}
/** 관리자가 라이선스 키 한 장 발급 → 키 */
async function issueLicense(admin){
  const r = await admin.api('POST', '/v2/admin/licenses', { requestId: crypto.randomUUID(), grants: [{ note: 'e2e account' }] });
  const k = r.data && r.data[0] && r.data[0].key;
  if(!k) throw new Error('라이선스 발급 실패 ' + r.status + ' ' + JSON.stringify(r.body));
  return k;
}
/** 이 계정 옷장에 캐릭터 하나(최소 def) — place 'BOX' 면 보관함으로 옮긴다. avatarId */
async function apiAvatar(acct, slot, place){
  const r = await acct.api('POST', '/v2/me/avatars', { requestId: crypto.randomUUID(), def: { race: 'human', name: 'e2e' }, slot });
  if(!r.data) throw new Error('캐릭터 만들기 실패 ' + JSON.stringify(r.body));
  if(place === 'BOX'){
    const m = await acct.api('POST', '/v2/me/avatars/' + r.data.avatarId + '/move', { to: 'BOX' });
    if(!m.data) throw new Error('보관함 옮기기 실패 ' + JSON.stringify(m.body));
  }
  return r.data.avatarId;
}
/** API 로 비밀번호 계정 하나 — 화면을 지나갈 필요 없는 상대 계정 · 미리 채울 기기용 */
const apiAccount = (invite = INVITE) => S.apiUser(invite);

/** 한 시나리오 — 결과 폴더를 비우고, 단계마다 steps.txt 에 ok · FAIL 을 적고, 끝나면 앱을 다 끄고 종료 코드로 알린다 */
function scenario(name, body){
  const area = path.basename(path.dirname(require.main.filename));   // scenarios/<area>/<이름>.js
  const F = S.frame(area, name, { stepMs: STEP_MAX_MS });
  const t = {
    out: F.out, steps: F.steps, wait, API_HOST,
    note: F.note, step: F.step, knownBug: F.knownBug,
    /** 격리된 앱 한 벌(<결과 폴더>/<id>) — opts.version 으로 이 앱이 아는 판을 바꾼다 */
    async app(id, opts = {}){
      const dir = path.join(F.out, id);
      fs.mkdirSync(dir, { recursive: true });
      const A = makeApp(dir, opts);
      const inst = F.add({ id, label: id, dir, A, w: null });
      inst.launch = async () => {
        inst.w = await S.launchRetry(A);
        await stubGoogle(inst);
        return inst.w;
      };
      inst.quit = async () => { await A.quit(); inst.w = null; };
      // 앱이 스스로 다시 켜는 흐름 — relaunch 예약을 막고, 꺼지면 같은 폴더로 다시 켠다
      inst.relaunchAfter = async (trigger, ms = 30000) => {
        // 다시 켜기 예약은 기록만 하고, 앱이 스스로 꺼지기를 몇 초 기다린 뒤에도 남아 있으면 그 자리에서 끈다
        // (바쁜 PC 에서 종료 처리가 30초를 넘기는 때가 있다 — 판정할 것은 «다시 켜기를 불렀나» 다)
        await A.app.evaluate(({ app: a }) => { a.relaunch = () => { console.log('[e2e] relaunch 요청'); setTimeout(() => a.exit(0), 3000); }; });
        const pid = A.app.process().pid;
        const closed = new Promise((r) => A.app.once('close', r));
        const l0 = A.logs.length;
        await trigger();
        // 앱은 꺼졌는데 붙어 있는 디버거(--inspect)를 기다리며 남는 때가 있다 — 그 줄이 보이면 끝난 것으로 보고 끈다
        const exiting = waitFor(() => A.logs.slice(l0).some((l) => /Waiting for the debugger to disconnect/.test(l)), ms, '종료')
          .then(() => { try { process.kill(pid, 'SIGKILL'); } catch(_){} }, () => new Promise(() => {}));
        await Promise.race([closed, exiting, wait(ms).then(async () => {
          const asked = A.logs.slice(l0).some((l) => /\[e2e\] relaunch 요청/.test(l));
          const msg = await inst.w.evaluate(() => { const e = document.getElementById('inviteGateLoginMsg'); return e ? e.textContent : ''; }).catch(() => '');
          throw new Error(ms / 1000 + '초 안에 꺼지지 않음(다시 켜기 요청 ' + (asked ? '있음' : '없음') + (msg ? ' · 안내 «' + msg + '»' : '') + ')');
        })]);
        await S.gone(pid);   // 옛 프로세스가 남아 있으면 새 앱이 «두 번째 실행» 으로 바로 꺼진다
        if(!A.logs.slice(l0).some((l) => /\[e2e\] relaunch 요청/.test(l))) throw new Error('앱이 다시 켜기를 부르지 않고 꺼짐');
        A.logs.push('--- relaunch ---'); A.reqs.push('--- relaunch ---');
        return inst.launch();
      };
      // GET /v2/config 응답을 이 앱에만 고쳐 준다(edit(data) → data · 밖 값을 잡지 않는 순수 함수). 설정은 같이 쓰는 로컬 묶음 전체에 걸려 다른 시험을 막으므로 서버 값은 건드리지 않는다.
      // 고치는 자리는 main 의 주소 돌리기(route-main.js) — lib.js editJson
      inst.editConfig = (edit) => A.editJson('GET', '^/v2/config(\\?|$)', edit);
      inst.google = null;   // { sub, email } — 구글 창 대신 돌려줄 계정
      inst.reqsSince = (n) => A.reqs.slice(n);
      await inst.launch();
      return inst;
    },
    apiAccount, sql, sqlQuery, http, API,
  };
  S.drive(F, { prepare: () => sql('invite.sql', { code: INVITE }), body: () => body(t) });
}

// 구글 로그인 창(main.js companion:signInWithGoogle)은 진짜 구글 OAuth 라 시험에서 열 수 없다 —
// 같은 IPC 자리에서 에뮬레이터가 받는 가짜 구글 ID 토큰을 돌려준다. 그 뒤(Auth signInWithCredential → 서버)는 앱 그대로
async function stubGoogle(inst){
  await inst.A.app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('companion:signInWithGoogle');
    ipcMain.handle('companion:signInWithGoogle', () => globalThis.__twGoogle || { ok: false, reason: '시험: 구글 계정 없음', canceled: true });
  });
  if(inst.google) await setGoogle(inst, inst.google);
}
async function setGoogle(inst, g){
  inst.google = g;
  const idToken = fakeGoogleIdToken(g.sub, g.email);
  await inst.A.app.evaluate((_e, tok) => { globalThis.__twGoogle = { ok: true, idToken: tok }; }, idToken);
}

// ── 화면 도우미 ──
// 조상까지 본다(checkVisibility) — 고정 겹창은 offsetParent 가 null 이라 그것으로는 못 가린다
const shown = (w, sel) => w.evaluate((s) => { const e = document.querySelector(s); return !!e && e.checkVisibility({ visibilityProperty: true }); }, sel);
async function waitShown(w, sel, ms = 20000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){ if(await shown(w, sel).catch(() => false)) return; await wait(250); }
  throw new Error(sel + ' 가 ' + ms / 1000 + '초 안에 안 보임');
}
async function waitFor(fn, ms = 20000, what = '조건'){
  const t0 = Date.now();
  let last;
  while(Date.now() - t0 < ms){ try { last = await fn(); if(last) return last; } catch(_){} await wait(300); }
  throw new Error(what + ' 가 ' + ms / 1000 + '초 안에 안 됨');
}
const text = (w, sel) => w.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
// 로그인돼 계정에 들어간 런처 — 서버가 이 PC 를 들였다(POST /v2/me/devices 200) · 런처가 보인다
async function waitEntered(inst, ms = 40000){
  // 이번 켜기 뒤에 서버가 이 PC 를 들였나
  await waitFor(() => inst.A.reqs.slice(inst.A.reqs.lastIndexOf('--- launch ---')).some((r) => /^POST \/v2\/me\/devices 200/.test(r)), ms, '기기 등록(POST /v2/me/devices 200)');
  await waitShown(inst.w, '#lcLoad', ms);
}
/** 게이트에서 초대 코드 → 비밀번호 가입 → 완료 화면 [시작하기] → 다시 켜기 → 들어감. { fc, pw } */
async function signupUi(t, inst, invite = INVITE){
  const w = inst.w;
  await S.signupForm(w, invite);
  const fc = await text(w, '#sdCode');
  if(!/^MATE-[0-9A-Z]{4}$/.test(fc)) throw new Error('완료 화면 친구 코드 모양이 아님: ' + fc);
  await inst.relaunchAfter(() => inst.w.click('#sdStart'));
  await waitEntered(inst);
  return withToken({ fc, pw: PW });
}
/** 게이트에서 친구 코드 + 비밀번호 로그인 → (처음 쓰는 PC 라) 다시 켜기 → 들어감 */
async function loginUi(inst, fc, pw = PW){
  await waitShown(inst.w, '#inviteGateFc', 30000);
  await fillChecked(inst.w, [['#inviteGateFc', fc], ['#inviteGatePw', pw]]);
  await inst.relaunchAfter(() => inst.w.click('#inviteGateFcBtn'));
  await waitEntered(inst);
}
/** 구글로 가입 — [구글로 로그인] → (가입 기록 없음) 초대 코드 → 구글 가입 → [시작하기] → 들어감. 친구 코드를 돌려준다 */
async function googleSignupUi(inst, g, invite = INVITE){
  await setGoogle(inst, g);
  await waitShown(inst.w, '#inviteGateGoogleBtn', 30000);
  await inst.w.click('#inviteGateGoogleBtn');
  await waitFor(async () => /초대 코드를 넣어 주세요/.test(await text(inst.w, '#inviteGateLoginMsg') || ''), 20000, '초대 코드 안내');
  await inst.w.fill('#inviteGateInput', invite);
  await inst.w.click('#inviteGateOk');
  await waitShown(inst.w, '#sdStart', 30000);
  const fc = await text(inst.w, '#sdCode');
  await inst.relaunchAfter(() => inst.w.click('#sdStart'));
  await waitEntered(inst);
  return fc;
}
const newGoogle = () => ({ sub: 'e2e-g-' + uniq(), email: 'e2e-' + uniq() + '@example.com' });
/** 런처 → 내 정보 열기(tab: box · trash · acct) */
async function openMyInfo(inst, tab){
  const w = inst.w;
  await w.evaluate(() => { const ov = document.getElementById('updateNoticeUserOverlay'); if(ov && getComputedStyle(ov).display !== 'none') document.getElementById('updateNoticeOkBtn').click(); });
  if(!(await shown(w, '#lcMyInfo'))) await w.click('#lcLoad');
  await waitShown(w, '#lcMyInfo');
  if(tab){
    await w.click({ box: '#miTabBox', trash: '#miTabTrash', acct: '#miTabAcct' }[tab]);
    await waitShown(w, { box: '#miPageBox', trash: '#miPageTrash', acct: '#miPageAcct' }[tab]);
  }
}

module.exports = { scenario, fillChecked, emuSignIn, adminAccount, issueLicense, apiAvatar, apiAccount, withToken, sql, sqlQuery, http, fakeGoogleIdToken, uniq, setGoogle,
  shown, waitShown, waitFor, text, waitEntered, signupUi, loginUi, googleSignupUi, newGoogle, openMyInfo, PW, INVITE, API };
