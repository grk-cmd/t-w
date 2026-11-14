/* ═══ 🛠 sim-maintenance-gate.js — 서버 점검 창(maintenance-gate.js) ═══════════════
   ・1절: 순수 — maintenanceOf(on 이 정확히 true 일 때만 · 시각 · 문구 상한) · endsAtText(오늘 / 다른 날) · viewOf(단추)
   ・2-1절: 사람이 누른 동작 — 입력 시각 1초 판정(로컬 클릭 3초 뒤 뒤쪽 요청 · «확인» 뒤 요청은 창 없음 · 클릭 직후 요청은 창) · 자식 창(방명록 · 디자인)에서 누르면 그 창에 그림
   ・2-2절: realtime 점검(4006) — serverClosed: 점검 창 + [다시 시도] · 누름 · 점검 해제 때만 한 번 다시 붙기 · 그동안 on()
   ・2절: 창 — 점검 중이어도 사람이 누른 동작일 때만 · 뒤에서 혼자 낸 요청은 조용히 · 떠 있는 창은 바뀐 끝 시각으로 다시 · 끝나면 다시 켜기를 묻는다(본 적 없으면 안 물음) · 단추
   ・3절: 고리 — Firebase 기본 동작(firebase-init.js _touched)이 요청마다 한 번 · API 통로(api-client.js)는 실제로 보낼 때만 · 오류 번호 토스트는 점검 중 조용히(기록은 남김)
   ・2-3절: 점검 값 읽기(0.13) — 서버 /v1/config 먼저 · 네트워크 · 5xx · 시간 초과면 Firebase 한 칸 · 4xx 는 물러나지 않음 · 서버가 답하면 Firebase 를 안 읽음 · ISO 끝 시각 · 읽는 때(시작 · config 알림 · 4006 · 다시 시도)
   ・4절: 연결 · 규칙 — html 싣는 순서 · 클릭 통과 목록 · firebase-init 구독 · config/maintenance 누구나 읽기 · 관리자만 쓰기 · 모양
   ・5절: 깨 보기 — (읽기) 4xx 도 물러나거나 · 서버가 답해도 Firebase 를 읽거나 · 서버 길을 건너뛰거나 · 알림 · 다시 시도에서 안 읽으면 빨강 · 사람이 누른 동작 확인을 빼거나 · 판정 폭을 5초로 · 창 안 입력도 세거나 · 다른 창 것을 안 숨기거나 · 오류 토스트 조용히를 빼거나 · on 판정을 느슨하게 하면 빨강
   [실행] node checks/run.js sim-maintenance-gate */
'use strict';
const fs = require('fs');
const { stripReadGate } = require('./sim-rules-src.js');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const SRC = need('maintenance-gate.js');
const AC = need('api-client.js');
const EC = need('error-codes.js');
const FI = need('firebase-init.js');
const HTML = need('desk-companion-prototype.html');
const DR = need('desktop-run.js');
const RULES = JSON.parse(stripReadGate(need('firebase-database-rules.json'))).rules;
const quiet = { warn(){}, log(){} };
const asModule = (src) => { const mod = { exports: {} }; new Function('window', 'document', 'module', 'console', src)(undefined, undefined, mod, quiet); return mod.exports; };
const asWindow = (src, name) => { const w = {}; new Function('window', 'module', 'console', src)(w, undefined, quiet); return w[name]; };

/* 가짜 창 · 사람 동작 — 부른 것을 적는다 */
function rig(M, active){
  const shows = [], calls = [];
  let hidden = 0, onPress = null;
  const state = { active: !!active };
  const g = M.createMaintenance({
    userActive: () => state.active,
    ui: { show: (v, p) => { shows.push(v); onPress = p; }, hide: () => { hidden++; } },
    relaunch: () => calls.push('relaunch'),
    now: () => new Date(2026, 10, 18, 9, 0).getTime(),
  });
  return { g, shows, calls, state, hidden: () => hidden, press: (a) => onPress(a) };
}

function run(M, label){
  const fails0 = fail;
  say('── 1. 순수' + label);
  chk(M.maintenanceOf(null) === null && M.maintenanceOf({ on: false }) === null && M.maintenanceOf({ on: 'true' }) === null && M.maintenanceOf({ on: 1 }) === null && M.maintenanceOf([]) === null,
      'on 이 정확히 true 가 아니면 점검 아님(없음 · false · 글자 · 숫자 · 배열)');
  const m = M.maintenanceOf({ on: true, endsAt: new Date(2026, 10, 18, 12, 5).getTime(), message: '  ' + 'x'.repeat(M.MESSAGE_MAX + 50) });
  chk(m && m.endsAt > 0 && m.message.length === M.MESSAGE_MAX, '  ↳ 시각 · 문구는 상한 ' + M.MESSAGE_MAX + '자에서 자른다');
  const m2 = M.maintenanceOf({ on: true, endsAt: -1, message: 3 });
  chk(m2 && m2.endsAt === null && m2.message === '', '  ↳ 틀린 시각 · 문구는 비운다(점검은 그대로)');
  const now = new Date(2026, 10, 18, 9, 0).getTime();
  chk(M.endsAtText(new Date(2026, 10, 18, 12, 5).getTime(), now) === '12:05' && M.endsAtText(new Date(2026, 10, 19, 1, 0).getTime(), now) === '11월 19일 01:00',
      'endsAtText — 오늘이면 시:분 · 다른 날이면 날짜까지');
  const v = M.viewOf({ endsAt: new Date(2026, 10, 18, 12, 0).getTime(), message: '' }, now);
  chk(v.title === '서버 점검 중' && v.body.split('\n')[1] === '12:00쯤 끝날 예정이에요.' && v.buttons.length === 1 && v.buttons[0].action === 'close', 'viewOf 점검 중 — 기본 문구 · 줄 바꿔 끝 시각 · 단추 «확인» 하나');
  const e = M.viewOf(null, now);
  chk(e.buttons.map(b => b.action).join() === 'relaunch,close', 'viewOf 끝남 — «지금 다시 켜기» · «나중에»');

  say('── 2. 창' + label);
  let r = rig(M, true);
  chk(r.g.touch() === false && r.shows.length === 0 && r.g.on() === false, '점검 아님 — 눌러도 창 없음');
  r.g.onValue({ on: true, message: '점검해요' });
  chk(r.shows.length === 0 && r.g.on() === true, '점검이 켜지는 순간엔 창을 띄우지 않는다(로컬 기능은 그대로)');
  r.state.active = false;
  chk(r.g.touch() === false && r.shows.length === 0, '★ 앱이 뒤에서 혼자 낸 요청 — 창 없음');
  r.state.active = true;
  chk(r.g.touch() === true && r.shows.length === 1 && r.shows[0].body.indexOf('점검해요') === 0, '★ 사람이 누른 동작이 서버에 닿으면 — 점검 창(관리자 문구)');
  r.g.onValue({ on: true, message: '점검해요', endsAt: new Date(2026, 10, 18, 14, 30).getTime() });
  chk(r.shows.length === 2 && r.shows[1].body.split('\n')[1] === '14:30쯤 끝날 예정이에요.', '★ 창이 떠 있는 동안 관리자가 끝 시각을 늘리면 바로 다시 그린다');
  r.press('close');
  chk(r.hidden() === 1 && r.calls.length === 0, '  ↳ «확인» 은 닫기만');
  r.g.onValue({ on: true, message: '점검해요', endsAt: new Date(2026, 10, 18, 15, 0).getTime() });
  chk(r.shows.length === 2, '  ↳ 닫은 뒤 바뀐 시각은 창을 다시 띄우지 않는다(다음에 누를 때 새 시각)');
  r.g.onValue(null);
  chk(r.shows.length === 3 && r.shows[2].title === '점검이 끝났어요' && r.g.on() === false, '★ 끝나면 다시 켜기를 묻는다');
  r.press('relaunch');
  chk(r.calls.join() === 'relaunch' && r.hidden() === 2, '  ↳ «지금 다시 켜기» 는 앱을 다시 켠다');
  r.g.onValue(null);
  chk(r.shows.length === 3, '  ↳ 꺼진 값이 또 와도 다시 묻지 않는다');
  const r2 = rig(M, true);
  r2.g.onValue(null); r2.g.onValue({ on: false });
  chk(r2.shows.length === 0, '켤 때부터 점검이 아니었으면 묻지 않는다');
  const r3 = rig(M, true);
  r3.g.onValue({ on: true }); r3.g.onValue(null);
  chk(r3.shows.length === 1 && r3.shows[0].title === '점검이 끝났어요', '끝남 창이 떠 있고');
  r3.g.onValue({ on: true, message: '다시 점검' });
  chk(r3.shows.length === 2 && r3.shows[1].title === '서버 점검 중', '  ↳ 그 사이 점검이 다시 켜지면 점검 글로 바꿔 그린다(끝남 창이 남지 않게)');

  say('── 2-2. realtime 점검(4006) — 다시 시도 · 해제 때만 다시 붙기' + label);
  {
    let q = rig(M, false); let n = 0;
    q.g.serverClosed(() => { n++; });
    const sv = q.shows[q.shows.length - 1];
    chk(sv && sv.title === '서버 점검 중' && sv.buttons.map(b => b.action).join() === 'retry,close' && q.g.on() === true,
      'serverClosed — 점검 칸을 못 봤어도 점검 창 · 단추 «다시 시도» «확인» · 그동안 on()(오류 토스트 조용히)');
    q.g.onValue({ on: true }); q.g.onValue({ on: false });
    chk(n === 1 && q.g.on() === false, '  ↳ 점검 칸이 풀리면 한 번 다시 붙는다');
    q.g.onValue({ on: true }); q.g.onValue({ on: false });
    chk(n === 1, '  ↳ 두 번 부르지 않는다');
    q = rig(M, false); n = 0;
    q.g.serverClosed(() => { n++; }); q.press('retry');
    chk(n === 1 && q.hidden() === 1 && q.g.on() === false, '«다시 시도» — 창을 닫고 한 번 다시 붙는다');
    q.press('retry');
    chk(n === 1, '  ↳ 다시 눌러도 또 안 부른다(다시 닫히면 새 창)');
    q = rig(M, false); n = 0; let handed = null;
    q.g.serverClosed(() => { n++; }, (f) => { handed = f; });
    q.press('close');
    chk(n === 0 && typeof handed === 'function' && q.g.on() === false,
      '★ «확인» 으로 닫으면 다시 붙지 않고(자동 재시도 없음) 다시 붙기를 넘긴다(띠 [다시 연결]) · on() 은 거짓 — 오류 알림이 다시 켜진다');
    q.g.onValue({ on: true }); q.g.onValue({ on: false });
    chk(n === 1, '★ 닫은 뒤에도 점검 칸이 풀리면 한 번 붙는다');
    if(handed) handed();   // 깨 본 판에선 안 넘어온다 — 위 줄이 이미 빨강
    chk(n === 1, '  ↳ 그 뒤 띠 [다시 연결] 을 눌러도 또 붙지 않는다(먼저 온 쪽 하나)');
    q = rig(M, false); n = 0; handed = null;
    q.g.serverClosed(() => { n++; }, (f) => { handed = f; });
    q.press('close'); if(handed) handed();
    chk(n === 1, '  ↳ 띠를 먼저 누르면 그때 한 번 붙는다');
    q.g.onValue({ on: true }); q.g.onValue({ on: false });
    chk(n === 1, '  ↳ 그 뒤 점검이 풀려도 또 붙지 않는다');
    q = rig(M, true); q.g.onValue({ on: true, message: '공지' }); q.g.serverClosed(() => {});
    chk(q.shows[q.shows.length - 1].body.indexOf('공지') === 0, '  ↳ 점검 칸을 봤으면 그 문구로');
  }

  say('── 2-1. 사람이 누른 동작' + label);
  let t = 0; const clock = M.createInputClock({ now: () => t });
  chk(clock.active() === false, '입력이 없으면 아님');
  const g = M.createMaintenance({ userActive: clock.active, ui: { show(){}, hide(){} }, relaunch(){}, now: () => t });
  g.onValue({ on: true });
  t = 10000; clock.note(false); t += 3000;
  chk(g.touch() === false, '★ (가) 로컬 클릭 3초 뒤 뒤쪽 요청(꾸미기 저장 디바운스) — 창 없음');
  t = 20000; clock.note(false);
  chk(g.touch() === true, '★ (다) 클릭 직후 같은 틱 요청 — 창');
  t = 30000; clock.note(true); t += 200;
  chk(g.touch() === false, '★ (나) 점검 창 «확인» 을 누른 직후 뒤쪽 요청(하트비트) — 창 없음');
  t = 40000; clock.note(false); t += M.ACTIVE_MS;
  chk(g.touch() === true && M.ACTIVE_MS <= 1000, '  ↳ 판정 폭 경계(' + M.ACTIVE_MS + 'ms)는 안쪽');
  t = 50000; clock.note(false, 'child');
  chk(clock.lastDoc() === 'child', '  ↳ 입력이 난 창(document)을 기억한다');

  // 가짜 document — createMaintenanceDom 이 쓰는 만큼만
  const mkDoc = (name) => {
    const el = () => { const e = { style: {}, children: [], textContent: '', appendChild(c){ this.children.push(c); return c; } }; return e; };
    const body = el();
    return { name, body, createElement: el, documentElement: body };
  };
  const main = mkDoc('main'), child = mkDoc('child');
  let target = main;
  const multi = M.createMultiDocUi(() => target);
  const mv = M.viewOf({ endsAt: null, message: '' }, 0);
  multi.show(mv, () => {});
  target = child;
  multi.show(mv, () => {});
  const ovOf = (d) => d.body.children[0];
  chk(ovOf(child) && ovOf(child).style.display === '' && ovOf(main).style.display === 'none', '★ 자식 창(방명록 · 디자인)에서 누르면 그 창 안에 그리고 본창 것은 숨긴다');
  multi.hide();
  chk(ovOf(child).style.display === 'none' && ovOf(main).style.display === 'none', '  ↳ 닫기는 모든 창에서');
  return fail === fails0;
}

/* 2-3절 — 점검 값 읽기(비동기라 run 밖) */
async function runRead(M, label){
  const fails0 = fail;
  say('── 2-3. 점검 값 읽기 — 서버 먼저 · 닿지 못할 때만 Firebase' + label);
  if(M.maintenanceOfServer){
    const ok = (o) => ({ kind: 'unavailable', status: o || 0 });
    const mk = (server, flag, active) => {
      const r = rig2(M, !!active); r.reads = { server: 0, flag: 0 };
      return r;
    };
    function rig2(MM, active){
      const shows = []; const q = { shows, reads: { server: 0, flag: 0 }, server: null, flag: null, handlers: {} };
      q.g = MM.createMaintenance({
        userActive: () => !!active, ui: { show: (v) => shows.push(v), hide(){} }, relaunch(){}, now: () => 1e12 + (q.t || 0),
        readServer: () => { q.reads.server++; return typeof q.server === 'function' ? q.server() : Promise.resolve(q.server); },
        readFlag: () => { q.reads.flag++; return Promise.resolve(q.flag); },
      });   // deps 로 줘도 start 로 줘도 같다 — 앱에서는 firebase-init 이 start 로 잇는다
      return q;
    }
    const ends = '2026-11-20T03:00:00Z';
    let q = mk(null, null, true);
    q.server = { room: {}, maintenance: { on: true, endsAt: ends, message: '서버 점검' } }; q.flag = { on: false };
    await q.g.check();
    chk(q.reads.server === 1 && q.reads.flag === 0 && q.g.on() === true, '★ 서버가 답하면 서버 값으로 점검 — Firebase 는 읽지 않는다');
    chk(q.g.touch() === true && q.shows[0].body.indexOf('서버 점검') === 0 && q.shows[0].body.split('\n')[1] !== undefined, '  ↳ 서버 문구로 창');
    chk(M.maintenanceOfServer({ on: true, endsAt: ends, message: 'x' }).endsAt === Date.parse(ends) && M.maintenanceOfServer({ on: true, endsAt: null, message: null }).endsAt === null
      && M.maintenanceOfServer({ on: 'true' }) === null && M.maintenanceOfServer({ on: false }) === null && M.maintenanceOfServer(undefined) === null
      && M.maintenanceOfServer({ on: true, endsAt: 'bad' }).endsAt === null, '  ↳ ISO 끝 시각 → ms · 틀린 시각은 비움 · on 은 정확히 true');
    q.server = { room: {}, maintenance: { on: false, endsAt: null, message: null } }; q.flag = { on: true };
    await q.g.check();
    chk(q.g.on() === false && q.reads.flag === 0, '★ 서버가 «점검 아님» 이라 하면 Firebase 가 켜져 있어도 점검 아님(서버가 원본)');
    q = mk(null, null, true); q.server = { room: {} }; q.flag = { on: true };
    await q.g.check();
    chk(q.g.on() === false && q.reads.flag === 0, '  ↳ 옛 서버(maintenance 칸 없음) — 점검 아님 · Firebase 안 읽음');
    for(const [name, err] of [['네트워크', { kind: 'unavailable', status: 0, code: 'NETWORK' }], ['시간 초과', { kind: 'unavailable', status: 0, code: 'TIMEOUT' }], ['5xx', { kind: 'unavailable', status: 502 }], ['5xx 상태만', { status: 502 }], ['503 본문', { kind: 'unavailable', status: 503, code: 'SERVER_ADMIN_ONLY' }], ['쉬는 중', { kind: 'unavailable', status: 0, code: 'BACKOFF' }]]){
      q = mk(null, null, true); q.server = () => Promise.reject(err); q.flag = { on: true, message: 'fb 문구', endsAt: 1e12 };
      await q.g.check();
      chk(q.reads.server === 1 && q.reads.flag === 1 && q.g.on() === true && (q.g.touch(), q.shows[q.shows.length - 1].body.indexOf('fb 문구') === 0), '★ 서버에 닿지 못함(' + name + ') — Firebase 한 칸으로 물러난다');
    }
    for(const err of [{ kind: 'request', status: 400 }, { kind: 'auth', status: 401 }, { kind: 'request', status: 404 }, { kind: 'auth', status: 403 }, { kind: 'request', status: 429 }]){
      q = mk(null, null, true); q.server = () => Promise.reject(err); q.flag = { on: true };
      await q.g.check();
      chk(q.reads.flag === 0 && q.g.on() === false, '★ 서버가 4xx 로 답함(' + err.status + ') — Firebase 로 물러나지 않는다');
    }
    q = mk(null, null, true); q.g.onValue({ on: true }); q.server = () => Promise.reject({ kind: 'request', status: 400 });
    await q.g.check();
    chk(q.g.on() === true, '  ↳ 4xx 는 지금 값을 그대로 둔다(점검 중이던 것을 꺼 버리지 않는다)');
    q = mk(null, null, true); q.server = () => Promise.reject({ kind: 'unavailable', status: 0 }); q.flag = null;
    await q.g.check();
    chk(q.g.on() === false && q.reads.flag === 1, '  ↳ 서버도 못 닿고 Firebase 칸도 비었으면 점검 아님');
    q = mk(null, null, true); q.server = () => Promise.reject({ kind: 'unavailable', status: 0 }); q.g.start({ readFlag: () => { q.reads.flag += 10; return Promise.resolve({ on: true }); } });
    await q.g.check();
    chk(q.g.on() === true && q.reads.flag >= 10, '  ↳ start 로 이은 Firebase 읽기를 쓴다');
    let rel = 0; const hs = {}; q = mk(null, null, true); q.server = { room: {}, maintenance: { on: false } };
    const rt = { on: (k, f) => { hs[k] = f; } };
    await q.g.start({ rt });
    chk(q.reads.server === 1 && typeof hs.config === 'function', '읽는 때 ① 앱 켤 때 한 번 · realtime config 알림을 듣는다');
    hs.config(); await q.g.check();
    chk(q.reads.server === 2, '읽는 때 ② realtime config 알림 — 서버를 다시 읽는다');
    const resolvers = []; q.server = () => new Promise((res) => { resolvers.push(res); });
    const p1 = q.g.check(), p2 = q.g.check();
    chk(p1 === p2 && q.reads.server === 3, '  ↳ 읽는 중에 또 부르면 하나로 합친다'); resolvers.forEach((f) => f({ room: {} })); await Promise.all([p1, p2]);
    q.server = { room: {}, maintenance: { on: true, message: '신호' } }; q.t = 10000; q.reads.server = 0;
    q.g.serverClosed(() => { rel++; }); await q.g.check();
    chk(q.reads.server === 1 && q.g.on() === true, '읽는 때 ③ realtime 이 점검(4006)으로 닫으면 서버 값을 읽는다');
    q.t = 10500; q.reads.server = 0; q.g.serverClosed(() => {});
    chk(q.reads.server === 0, '  ↳ 3초 안에 또 닫히면 다시 읽지 않는다(서버는 점검 아닌데 4006 이 돌 때 서버를 두드리지 않게)');
    q = mk(null, null, true); q.server = { room: {}, maintenance: { on: true } };
    q.g.serverClosed(() => {}); await q.g.check(); q.reads.server = 0; q.t = 60000;
    q.press = null;
    // [다시 시도] — 눌러 닫으면 새 값을 읽는다
    const q2 = rig2(M, false); let pressFn = null;
    q2.g = M.createMaintenance({ userActive: () => false, ui: { show: (v, p) => { pressFn = p; }, hide(){} }, relaunch(){}, now: () => 2e12,
      readServer: () => { q2.reads.server++; return Promise.resolve({ room: {}, maintenance: { on: false } }); }, readFlag: () => Promise.resolve(null) });
    q2.g.serverClosed(() => {}); await q2.g.check(); q2.reads.server = 0;
    pressFn('retry'); await new Promise((r) => setImmediate(r));
    chk(q2.reads.server === 1, '읽는 때 ④ [다시 시도] 를 누르면 서버 값을 읽는다');
  }

  return fail === fails0;
}

const M = asModule(SRC);
run(M, '');

say('── 3. 고리');
{
  /* firebase-init.js 의 감쌈 한 줄을 그대로 돌린다 — 기본 동작 여섯이 다 그 감쌈을 지나는지도 본다 */
  const line = (FI.match(/^  const _touched = .*$/m) || [''])[0];
  let touches = 0; const calls = [];
  let wrap = null;
  try{ wrap = new Function('_mt', line.replace('const _touched =', 'return'))({ touch(){ touches++; } }); }catch(_){ wrap = null; }
  const ops = ['get', 'set', 'update', 'remove', 'onValue', 'push'];
  if(wrap){ for(const k of ops) wrap((...a) => { calls.push(k + ':' + a.join(',')); return k; })(1, 2); }
  chk(!!wrap && touches === 6 && calls.join('|') === ops.map((k) => k + ':1,2').join('|'), 'Firebase 기본 동작 — 요청마다 점검 창 touch 한 번 · 인자 · 돌려주는 값 그대로 · ' + touches);
  const wired = ['get = _touched(_sdkGet)', 'set = _touched(_sdkSet)', 'remove = _touched(_sdkRemove)', 'push = _touched(_sdkPush)', 'onValue = _touched(_sdkOnValue)', '_update = _touched(_dbUpdate)'].filter((x) => FI.indexOf('  const ' + x + ';') < 0);
  chk(!wired.length, '  ↳ get · set · remove · push · onValue · update 가 다 감쌈을 지난다' + (wired.length ? ' — 빠짐: ' + wired.join(', ') : ''));
}
(async () => {
  await runRead(M, '');
  {
    const A = asModule(AC);
    let reqs = 0, fetches = 0;
    const fetch = async () => { fetches++; return { status: 200, ok: true, json: async () => ({ success: true, data: { v: 1 } }) }; };
    const c = A.createApiClient({ baseUrl: 'https://api.together-working.com', fetch, onRequest: () => { reqs++; } });
    await c.get('/v1/x', { cacheMs: 60000 });
    await c.get('/v1/x', { cacheMs: 60000 });
    await c.post('/v1/y', {}, { auth: false });
    chk(reqs === 2 && fetches === 2, 'API 통로 — 실제로 보낼 때만(캐시에서 준 것은 안 셈) · get · post · ' + reqs);
  }
  {
    const E = asModule(EC);
    let muted = true; const toasts = [];
    const N = E.createErrorNotice({ now: () => 1, toast: (m) => toasts.push(m), muted: () => muted });
    const w = console.warn; console.warn = () => {};
    const shown = N.notify('E-FR-01');
    muted = false;
    const shown2 = N.notify('E-FR-01');
    console.warn = w;
    chk(shown === false && toasts.length === 1 && N.recent().length === 2, '오류 번호 — 점검 중엔 토스트 없이 기록만 · 끝나면 그대로 띄운다');
  }

  say('── 4. 연결 · 규칙');
  const at = (s) => HTML.indexOf('<script src="parts/shared/' + s + '"');
  chk(at('maintenance-gate.js') > 0 && at('maintenance-gate.js') < at('error-codes.js') && at('maintenance-gate.js') < at('api-client.js'),
      'html — error-codes.js · api-client.js 보다 먼저 싣는다(firebase-init.js 는 module 이라 늘 뒤에 돈다)');
  const hit = (DR.match(/const UI_HIT_SEL = '([^']*)'/) || [])[1] || '';
  chk(hit.split(',').map(s => s.trim()).includes('#' + M.GATE_ID), '클릭 통과 목록(UI_HIT_SEL)에 #' + M.GATE_ID + ' — 투명 창에서도 단추를 누른다');
  chk(/_mt\.start\(\{ readServer: \(\) => window\.TwApi\.client\.get\(window\.TwMaintenance\.CONFIG_PATH\),/.test(FI) && /readFlag: \(\) => _sdkGet\(ref\(db, window\.TwMaintenance\.MAINTENANCE_PATH\)\)\.then\(\(s\) => s\.val\(\)\), rt: window\.TwRtHub\.store \}\)/.test(FI),
      'firebase-init — 점검 읽기를 gate 에 잇는다(서버 GET /v1/config 먼저 · Firebase 칸은 한 번 읽기 · 늘 듣는 구독 없음)');
  chk(!/onValue\(ref\(db, window\.TwMaintenance\.MAINTENANCE_PATH\)/.test(FI), '  ↳ config/maintenance 를 늘 듣는 구독이 없다(P3)');
  chk(M.CONFIG_PATH === '/v1/config' && !/window\.TwApi/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '  ↳ gate 는 API 통로를 직접 부르지 않는다(api-client.js 와 서로 부르는 순환이 되므로 · 읽기 함수는 firebase-init 이 잇는다)');
  chk(/const touch = \(\) => \{ window\.TwMaintenance\.store\.touch\(\); \};/.test(AC) && /client = createApiClient\(\{ baseUrl, fetch: fetchFn, onRequest: touch \}\);/.test(AC)
    && /authed = createApiClient\(\{ baseUrl, fetch: fetchFn, onRequest: touch,/.test(AC) && /muted: \(\)=>window\.TwMaintenance\.store\.on\(\)/.test(EC), '  ↳ API 통로 두 벌(공용 읽기 · 로그인) · 오류 번호 한 벌에도');
  const n = (RULES.config || {}).maintenance || {};
  chk(n['.read'] === true && /admins/.test(n['.write'] || '') && /auth\.uid/.test(n['.write'] || ''), '★ config/maintenance — 누구나 읽기(로그인 전 · 점검 중) · 관리자만 쓰기');
  const ev = (rule, v) => { try{ return !!new Function('newData', 'return (' + rule + ');')(nd(v)); }catch(_){ return false; } };
  const nd = (v) => ({ isBoolean: () => typeof v === 'boolean', isNumber: () => typeof v === 'number', isString: () => typeof v === 'string', val: () => v,
    hasChildren: (ks) => !!v && typeof v === 'object' && ks.every(k => k in v), child: (k) => nd(v && typeof v === 'object' ? v[k] : undefined) });
  chk(ev(n['.validate'], { on: true }) && ev(n['.validate'], { on: false }) && !ev(n['.validate'], { on: 'true' }) && !ev(n['.validate'], {}), '  ↳ on 은 참 / 거짓 필수');
  chk(ev(n.endsAt['.validate'], 1) && !ev(n.endsAt['.validate'], 0) && ev(n.message['.validate'], 'x'.repeat(M.MESSAGE_MAX)) && !ev(n.message['.validate'], 'x'.repeat(M.MESSAGE_MAX + 1)) && n.$other['.validate'] === false,
      '  ↳ endsAt 양수 · message ' + M.MESSAGE_MAX + '자까지 · 다른 칸 거절');

  say('── 5. 깨 보기');
  const broke = (src, from, to) => { const s = src.replace(from, to); return s === src ? null : s; };
  const saved = [pass, fail];
  const quietRun = (MM) => { const log = console.log; console.log = () => {}; const p0 = pass, f0 = fail; let ok; try{ ok = run(MM, ''); }finally{ console.log = log; } pass = p0; fail = f0; return ok; };
  const b1 = broke(SRC, 'if(!cur || !userActive()) return false;', 'if(!cur) return false;');
  chk(b1 && !quietRun(asModule(b1)), '사람이 누른 동작 확인을 빼면 빨강(뒤에서 혼자 낸 요청에도 창)');
  const b2 = broke(SRC, "raw.on !== true", "!raw.on");
  chk(b2 && !quietRun(asModule(b2)), 'on 판정을 느슨하게 하면 빨강');
  const b3 = broke(SRC, 'if(was){', 'if(true){');
  chk(b3 && !quietRun(asModule(b3)), '본 적 없는데 다시 켜기를 물으면 빨강');
  const b5 = broke(SRC, 'const ACTIVE_MS = 1000;', 'const ACTIVE_MS = 5000;');
  chk(b5 && !quietRun(asModule(b5)), '판정 폭을 5초로 되돌리면 빨강(뒤쪽 요청에 창)');
  const b6 = broke(SRC, 'note(inGate, doc){ if(inGate) return; ', 'note(inGate, doc){ ');
  chk(b6 && !quietRun(asModule(b6)), '점검 창 안 입력도 세면 빨강(«확인» 뒤 창이 다시 뜸)');
  const b7 = broke(SRC, 'for(const [doc, dom] of doms){ if(doc !== target) dom.hide(); }', '');
  chk(b7 && !quietRun(asModule(b7)), '다른 창의 점검 창을 안 숨기면 빨강(두 창에 겹쳐 뜸)');
  const b4 = broke(EC, '    if(d.muted && d.muted()) return false;', '');
  { const E = b4 && asModule(b4); const t = []; const w = console.warn; console.warn = () => {};
    const s = E && E.createErrorNotice({ now: () => 1, toast: (m) => t.push(m), muted: () => true }).notify('E-FR-01'); console.warn = w;
    chk(b4 && s === true, '오류 토스트 조용히를 빼면 빨강'); }
  const b8 = broke(SRC, "    if(action === 'retry'){ const f = takeRetry(); if(f) f(); check(); }   // 사용자 동작 — 새 값 · 끝남을 한 번 읽는다\n", '');
  chk(b8 && !quietRun(asModule(b8)), '«다시 시도» 가 다시 붙지 않으면 빨강');
  const b9 = broke(SRC, '    if(f) f();   // 점검이 풀렸다', '    // 점검이 풀렸다');
  chk(b9 && !quietRun(asModule(b9)), '점검이 풀려도 다시 붙지 않으면 빨강');
  const b12 = broke(SRC, "    if(action === 'close' && rtShown){ rtShown = false; const d = rtDismiss; rtDismiss = null; if(d) d(rtRetry); }", '');
  chk(b12 && !quietRun(asModule(b12)), '«확인» 뒤에도 오류 알림이 꺼진 채면 빨강');
  const b13 = broke(SRC, "    rtRetry = () => { if(done) return; done = true; retry(); };", "    rtRetry = retry;");
  chk(b13 && !quietRun(asModule(b13)), '띠 · 점검 해제가 둘 다 붙으면 빨강');
  const b14 = broke(SRC, "if(action === 'close' && rtShown){ rtShown = false; const d = rtDismiss; rtDismiss = null; if(d) d(rtRetry); }", "if(action === 'close' && rtShown){ const d = rtDismiss; if(d) d(takeRetry()); }");
  chk(b14 && !quietRun(asModule(b14)), '«확인» 뒤 점검이 풀려도 안 붙으면 빨강');
  const b10 = broke(SRC, 'on: () => !!(cur || rtShown)', 'on: () => !!cur');
  chk(b10 && !quietRun(asModule(b10)), 'realtime 점검 동안 오류 토스트가 나면 빨강');
  const b11 = broke(SRC, "  const buttons = retry ? [{ label: '다시 시도', action: 'retry' }, { label: '확인', action: 'close' }] : ", "  const buttons = ");
  chk(b11 && !quietRun(asModule(b11)), '점검 창에 «다시 시도» 가 없으면 빨강');
  const quietRead = async (MM) => { const log = console.log; console.log = () => {}; const p0 = pass, f0 = fail; let ok; try{ ok = await runRead(MM, ''); }catch(_){ ok = false; }finally{ console.log = log; } pass = p0; fail = f0; return ok; };
  const r1 = broke(SRC, "if(!unreachable(e) || !readFlag) return false;", "if(!readFlag) return false;");
  chk(r1 && !(await quietRead(asModule(r1))), '(읽기) 4xx 에도 Firebase 로 물러나면 빨강');
  const r2 = broke(SRC, "apply(maintenanceOfServer(data.maintenance));", "apply(maintenanceOfServer(data.maintenance)); if(readFlag) try{ apply(maintenanceOf(await readFlag())); }catch(_){}");
  chk(r2 && !(await quietRead(asModule(r2))), '(읽기) 서버가 답해도 Firebase 를 또 읽으면 빨강');
  const r3 = broke(SRC, "try{ data = await readServer(); }", "try{ data = await Promise.reject({ kind: 'unavailable' }); }");
  chk(r3 && !(await quietRead(asModule(r3))), '(읽기) 서버 길을 건너뛰고 Firebase 만 읽으면 빨강');
  const r4 = broke(SRC, "return e.kind === 'unavailable' || (typeof e.status === 'number' && e.status >= 500);", "return e.kind === 'unavailable';");
  chk(r4 && !(await quietRead(asModule(r4))), '(읽기) 5xx 를 «닿지 못함» 으로 안 보면 빨강');
  const r5 = broke(SRC, "o.rt.on('config', () => { check(); });", "");
  chk(r5 && !(await quietRead(asModule(r5))), '(읽기) realtime config 알림에 다시 읽지 않으면 빨강');
  const r6 = broke(SRC, "if(f) f(); check(); }", "if(f) f(); }");
  chk(r6 && !(await quietRead(asModule(r6))), '(읽기) [다시 시도] 에 다시 읽지 않으면 빨강');
  const r7 = broke(SRC, "if(now() - lastDone >= SIGNAL_GAP_MS) check();", "check();");
  chk(r7 && !(await quietRead(asModule(r7))), '(읽기) 4006 이 연달아 오면 서버를 두드려 대면 빨강');
  const r8 = broke(SRC, "if(checking) return checking;", "");
  chk(r8 && !(await quietRead(asModule(r8))), '(읽기) 읽는 중에 또 읽으면 빨강');
  const r9 = broke(SRC, "const t = (typeof raw.endsAt === 'string') ? Date.parse(raw.endsAt) : NaN;", "const t = NaN;");
  chk(r9 && !(await quietRead(asModule(r9))), '(읽기) ISO 끝 시각을 못 읽으면 빨강');
  void saved;

  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})();
