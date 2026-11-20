// 앱 끄기 시나리오(quit-*.js)가 같이 쓰는 도구 — 못 올린 캐릭터 고침 만들기 · 메뉴 «종료» · before-quit 기록 · 꺼질 때까지 재기 · 서버 def 읽기
'use strict';
const fs = require('fs');
const path = require('path');

const { APP_DIR } = require('../../lib.js');
const { GUARD_MS } = require(path.join(APP_DIR, 'quit-hold.js'));   // 앱 값 그대로 — 렌더러가 답하지 못해도 이 안에 끈다
const EXIT_WAIT_MS = GUARD_MS + 5000;   // 꺼질 때까지 기다리는 한도 — 상한을 넘겨도 판정할 수 있게 넉넉히
const GUARD_S = GUARD_MS / 1000;
const API = 'http://127.0.0.1:8080';

// main 의 before-quit 을 net.txt(route-main.js 의 요청 기록)에 «E2E <시각> before-quit held|go» 로 남긴다 — 같은 파일이라 저장 요청(REQ PUT)과 앞뒤를 견줄 수 있다.
// held = 앱(quit-hold.js)이 막았다(붙잡음) · go = 막지 않았다(꺼짐). 앱 리스너보다 먼저 preventDefault 를 감싸 두고, 뒤에 붙인 리스너가 읽는다
async function watchQuit(A){
  await A.app.evaluate(({ app }, f) => {
    if(global.__e2eQuitWatch) return;
    global.__e2eQuitWatch = true;
    const fs = process.mainModule.require('fs');
    app.prependListener('before-quit', (e) => {
      const p = e.preventDefault;
      e.preventDefault = function(){ e.__e2eHeld = true; return p.apply(this, arguments); };
    });
    app.on('before-quit', (e) => fs.appendFileSync(f, `E2E ${Date.now()} before-quit ${e.__e2eHeld ? 'held' : 'go'}\n`));
  }, path.join(A.out, 'net.txt'));
}

// net.txt 를 읽어 끄기 기록 · 캐릭터 저장 요청을 순서대로 돌려준다
function quitTrail(A){
  let buf = '';
  try { buf = fs.readFileSync(path.join(A.out, 'net.txt'), 'utf8'); } catch(_){}
  const out = [];
  for(const line of buf.split('\n')){
    let m = line.match(/^E2E (\d+) before-quit (held|go)$/);
    if(m){ out.push({ kind: m[2], at: Number(m[1]) }); continue; }
    m = line.match(/^REQ (PUT|POST) \/v2\/me\/avatars(\/[^ ]*)? (\S+)/);
    if(m) out.push({ kind: 'save', method: m[1], path: '/v2/me/avatars' + (m[2] || ''), status: m[3] });
  }
  return out;
}

// 런처에서 지금 캐릭터를 고쳐 책상 색을 바꾸고 [완성] — 옷장이 3초 묶음 저장을 예약한 채(못 올린 고침 1) 돌아온다
async function pendingEdit(t, A, color){
  const w = A.w;
  await w.click('#lcGear');
  await w.click('#lcEdit');
  await w.locator('#crNext').waitFor({ state: 'visible', timeout: 20000 });
  await w.click('[data-stg="1"]');
  await w.evaluate((c) => {
    const e = document.querySelector('#deskColor'); e.value = c;
    e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
  for(let i = 0; i < 20 && !(await t.shown(A, '#crDone')); i++){ await w.click('#crNext'); await t.wait(300); }
  await w.click('#crDone');
  await t.poll(() => w.evaluate(() => closetMod.unsavedCount() > 0), 2000, '고친 뒤 못 올린 고침 1(3초 묶음 저장 예약)');
}

// 앱 메뉴의 «종료»(role quit)를 main 에서 누른다 — OS 키는 보내지 않는다.
// mac 의 role quit 은 네이티브 항목이라 MenuItem.click() 이 아무것도 안 한다 — 메뉴가 누를 때 보내는 terminate: 를 그대로 보낸다(Cmd+Q 와 같은 길).
// 윈도우 · 리눅스는 앱 메뉴가 없어(main.js APP_MENU_TEMPLATE) 제목줄 × 와 같은 companion:quitApp 을 보낸다. 누른 시각(ms)
async function menuQuit(A){
  const how = await A.app.evaluate(({ Menu }) => {
    const find = (m) => {
      for(const it of (m ? m.items : [])){
        if(it.role === 'quit' || it.role === 'Quit') return it;
        const sub = find(it.submenu);
        if(sub) return sub;
      }
      return null;
    };
    const it = find(Menu.getApplicationMenu());
    if(!it) return 'none';
    if(process.platform === 'darwin'){ setTimeout(() => Menu.sendActionToFirstResponder('terminate:'), 0); return 'menu terminate:'; }
    setTimeout(() => it.click(), 0);
    return 'menu';
  });
  const at = Date.now();
  if(how === 'none') await A.w.evaluate(() => window.companion.quitApp());
  return { how, at };
}

// 앱 프로세스가 끝날 때까지 — 끝난 시각(ms). ms 안에 안 끝나면 던진다
function waitExit(A, ms){
  const proc = A.app.process();
  if(proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve(Date.now());
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(ms + 'ms 안에 앱이 안 꺼짐')), ms);
    proc.once('exit', () => { clearTimeout(timer); res(Date.now()); });
  });
}

// 앱 없이 그 계정으로 서버에 묻는다(Auth 에뮬레이터 로그인 → API) — 창이 닫혀 있어도 서버 값을 본다
async function serverDef(fc, pw, avatarId){
  const login = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fc.toLowerCase() + '@tw.local', password: pw, returnSecureToken: true }) })).json();
  if(!login.idToken) throw new Error('에뮬레이터 로그인 실패 ' + JSON.stringify(login).slice(0, 120));
  const r = await fetch(API + '/v2/me/avatars/' + avatarId, { headers: { Authorization: 'Bearer ' + login.idToken } });
  const j = await r.json();
  if(r.status !== 200) throw new Error('GET /v2/me/avatars/' + avatarId + ' ' + r.status);
  return j.data.def;
}

// 끄기 기록 판정 — 처음 before-quit 은 붙잡히고(held) · 그 뒤 저장 요청이 200 · 그 뒤 놓아 줌(go). 붙잡은 시간(ms)
function checkHeldSave(t, trail, from){
  const tr = trail.slice(from);
  const held = tr.findIndex((x) => x.kind === 'held');
  t.check(held >= 0, '끄기를 붙잡지 않음(before-quit held 없음) — ' + JSON.stringify(tr));
  const save = tr.findIndex((x, i) => i > held && x.kind === 'save' && x.method === 'PUT');
  t.check(save > held, '붙잡은 뒤 캐릭터 저장(PUT /v2/me/avatars/…)이 없음 — ' + JSON.stringify(tr));
  t.check(tr[save].status === '200', '저장 응답 ' + tr[save].status);
  const go = tr.findIndex((x, i) => i > save && x.kind === 'go');
  t.check(go > save, '저장 뒤 끄기(before-quit go)가 없음 — ' + JSON.stringify(tr));
  return tr[go].at - tr[held].at;
}

module.exports = { GUARD_MS, GUARD_S, EXIT_WAIT_MS, watchQuit, quitTrail, pendingEdit, menuQuit, waitExit, serverDef, checkHeldSave };
