/* sim-rt-status-ui.js — 🛰 realtime 끊김 화면(realtime/rt-status-ui.js) 검사 — 가짜 연결 · 띠 · 시계로 상태마다 돌리고, 진짜 rt-hub 위에서도 한 번
   ・1절: 상태 → 할 일 — 다시 연결 중 띠(방 밖 · 15초 · 한 번 붙은 뒤에만 · 붙으면 사라짐) · authFailed E-RT-01 → 로그인 · accountGone E-RT-02 → 로그인(탈퇴 중엔 없음) ·
          update → 강제 업데이트 창 · maintenance → 점검 창(다시 시도 = claim 없이 start) · closed E-RT-03 + [다시 연결] · sessionLost 는 아무것도 안 함
   ・2절: 진짜 rt-hub · realtime-link 위에서 — 서버가 4999 로 닫으면 띠 · 4001 두 번이면 로그인 · 1006 이 15초 넘으면 띠
   ・3절: 띠 화면 — 글은 textContent · 단추는 있을 때만
   ・4절: 배선 — html 차례(rt-hub → rt-status-ui → app.js) · 클릭 통과 목록 #rtBand · app.js 가 만든다
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  UI: pick(at('rt-status-ui.js', 'realtime')),
  HUB: pick(at('rt-hub.js', 'realtime')),
  LINK: pick(at('realtime-link.js', 'realtime')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  DR: pick(at('desktop-run.js', 'launcher')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const loadLink = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  return new Function('Buffer', src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
};
const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
function mkClock(){
  const c = { t: 1_800_000_000_000, q: [], id: 0 };
  c.setTimeout = (f, ms) => { const h = { id: ++c.id, at: c.t + Math.max(0, ms | 0), f }; c.q.push(h); return h; };
  c.clearTimeout = (h) => { const i = c.q.indexOf(h); if(i >= 0) c.q.splice(i, 1); };
  c.advance = async (ms) => {
    const end = c.t + ms;
    for(;;){
      await tick();
      c.q.sort((a, b) => a.at - b.at || a.id - b.id);
      const h = c.q[0];
      if(!h || h.at > end) break;
      c.t = h.at; c.q.shift(); h.f();
    }
    c.t = end; await tick();
  };
  return c;
}
/* 가짜 연결(상태만) · 띠 · 기록 */
function rig(U, o){
  o = o || {};
  const clock = mkClock(), log = [];
  let fn = null, st = 'off', press = null;
  const band = { shown: null, show(v, p){ this.shown = v; press = p; log.push('band:' + v.text + (v.button ? '[' + v.button + ']' : '')); }, hide(){ this.shown = null; } };
  const state = { inRoom: !!o.inRoom, withdrawing: !!o.withdrawing };
  const rt = { onState: (f) => { fn = f; return () => { fn = null; }; }, state: () => st, start: (x) => log.push('start:' + JSON.stringify(x)) };
  const ui = U.createRtStatusUi({
    rt, inRoom: () => state.inRoom, band,
    notifyError: (c) => log.push('err:' + c), toLogin: () => log.push('toLogin'), withdrawing: () => state.withdrawing,
    forceUpdate: () => log.push('update'), maintenance: (retry, dismiss) => { log.push('maint'); state.retry = retry; state.dismiss = dismiss; },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
  });
  const set = (s) => { st = s; if(fn) fn(s); };
  return { ui, clock, log, band, state, set, press: () => press(), has: (x) => log.includes(x) };
}

async function judge(S){
  let U;
  try{ U = loadMod(S.UI); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }

  say('── 1. 상태 → 할 일');
  {
    const r = rig(U);
    r.set('connecting'); r.set('ready'); r.set('retrying');
    await r.clock.advance(14999);
    chk(r.band.shown === null, '다시 붙는 중 — 15초 전엔 띠 없음(짧은 끊김엔 아무것도 안 보임)');
    await r.clock.advance(1);
    chk(r.band.shown && r.band.shown.text === '서버에 다시 연결하는 중…' && !r.band.shown.button, '  ↳ 15초 넘으면 방 밖에서 띠 «서버에 다시 연결하는 중…»(단추 없음)');
    r.set('ready');
    chk(r.band.shown === null, '  ↳ 붙으면 사라진다');
    r.set('retrying'); await r.clock.advance(5000); r.set('ready'); await r.clock.advance(20000);
    chk(r.band.shown === null, '  ↳ 15초 안에 붙으면 띠가 안 뜬다(타이머를 지운다)');
    r.set('retrying'); await r.clock.advance(5000); r.set('ready'); await r.clock.advance(5000); r.set('retrying');
    await r.clock.advance(14000);
    chk(r.band.shown === null, '  ↳ 붙었다 다시 끊기면 15초를 처음부터 센다(앞 끊김의 타이머가 남지 않음)');
    await r.clock.advance(1000);
    chk(!!r.band.shown, '  ↳ 새로 15초가 지나면 띠');
    r.set('ready');
    const room = rig(U, { inRoom: true });
    room.set('ready'); room.set('retrying'); await room.clock.advance(20000);
    chk(room.band.shown === null, '  ↳ 방 안이면 띠 없음(방 화면이 «다시 연결 중» 을 보인다)');
    const boot = rig(U);
    boot.set('connecting'); boot.set('retrying'); await boot.clock.advance(20000);
    chk(boot.band.shown === null, '  ↳ 한 번도 붙지 못한 켜는 중엔 띠 없음(서버에 닿지 못한 화면 몫)');
    const offr = rig(U);
    offr.set('ready'); offr.set('off'); offr.set('retrying'); await offr.clock.advance(20000);
    chk(offr.band.shown === null, '  ↳ 끈(off) 뒤엔 «붙은 적 있음» 을 지운다');

    const a = rig(U);
    a.set('ready'); a.set('authFailed'); a.set('authFailed');
    chk(a.log.join() === 'err:E-RT-01,toLogin', 'authFailed — E-RT-01 «로그인이 풀렸어요» → 로그인 화면 · 한 번만 — ' + a.log.join());
    const g = rig(U);
    g.set('ready'); g.set('accountGone');
    chk(g.log.join() === 'err:E-RT-02,toLogin', 'accountGone — E-RT-02 «계정이 이 기기에서 로그아웃됐어요» → 로그아웃 처리 · 로그인 화면');
    const w = rig(U, { withdrawing: true });
    w.set('ready'); w.set('accountGone');
    chk(w.log.length === 0, '  ↳ 탈퇴 흐름이 도는 중이면 따로 안내하지 않는다(그 흐름이 로그아웃 · 다시 켜기를 한다)');
    const u = rig(U);
    u.set('ready'); u.set('update');
    chk(u.log.join() === 'update', 'update(4003) — 업데이트 강제 창');
    const m = rig(U);
    m.set('ready'); m.set('maintenance');
    chk(m.log.join() === 'maint' && typeof m.state.retry === 'function', 'maintenance(4006) — 점검 창');
    m.state.retry();
    chk(m.log.join() === 'maint,start:{"claim":false}', '  ↳ 점검 창의 다시 시도 · 해제 = claim 없이 다시 붙기(남을 밀지 않음)');
    m.log.length = 0; m.state.dismiss();
    chk(m.log.join() === 'band:서버 점검 중이에요[다시 연결]', '★ 점검 창을 «확인» 으로 닫으면 띠 «서버 점검 중이에요» + [다시 연결] — ' + m.log.join());
    const c = rig(U);
    c.set('ready'); c.set('closed');
    chk(c.log.join() === 'err:E-RT-03,band:서버 연결이 끊겼어요[다시 연결]', 'closed(모르는 4000번대) — E-RT-03 · 띠 «서버 연결이 끊겼어요» + [다시 연결] — ' + c.log.join());
    await c.clock.advance(60000);
    chk(!c.log.some((x) => x.startsWith('start')), '  ↳ 저절로 다시 붙지 않는다(자동 재시도 없음)');
    c.press();
    chk(c.band.shown === null && c.has('start:{"claim":false}'), '  ↳ [다시 연결] — 띠를 닫고 claim 없이 다시 붙기');
    c.set('connecting'); c.set('ready');
    chk(c.band.shown === null, '  ↳ 붙으면 띠 없음');
    const sl = rig(U);
    sl.set('ready'); sl.set('sessionLost'); await sl.clock.advance(20000);
    chk(sl.log.length === 0 && sl.band.shown === null, 'sessionLost — 여기선 아무것도 안 한다(밀려난 기기 화면은 로그인 흐름 몫)');
    const rb = rig(U);
    rb.set('ready'); rb.set('retrying'); await rb.clock.advance(16000); rb.set('closed');
    chk(rb.band.shown && rb.band.shown.button === '다시 연결', '  ↳ «다시 연결 중» 띠가 떠 있다가 멈추면 [다시 연결] 띠로 바뀐다');
  }

  say('── 2. 진짜 rt-hub 위에서');
  {
    const L = loadLink(S.LINK), H = loadMod(S.HUB);
    const mk = () => {
      const clock = mkClock(), socks = [], log = [];
      class FakeWS {
        constructor(){ this.sent = []; this.closed = false; socks.push(this); }
        send(s){ if(this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); }
        close(){ if(this.closed) return; this.closed = true; if(this.onclose) this.onclose({ code: 1000 }); }
        kill(code){ this.closed = true; if(this.onclose) this.onclose({ code }); }
        open(){ if(this.onopen) this.onopen(); }
        msg(m){ if(this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
      }
      const hub = H.createRtHub({ createLink: L.createRealtimeLink, WebSocket: FakeWS, url: () => 'wss://x', getToken: async () => 't', getVersion: async () => '0.13.0',
        deviceId: () => 'd', session: 's', now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5, log: { warn(){} } });
      const band = { shown: null, press: null, show(v, p){ this.shown = v; this.press = p; }, hide(){ this.shown = null; } };
      U.createRtStatusUi({ rt: hub, inRoom: () => false, band, notifyError: (c) => log.push('err:' + c), toLogin: () => log.push('toLogin'), withdrawing: () => false,
        forceUpdate: () => log.push('update'), maintenance: () => log.push('maint'), setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
      const ready = async () => { await tick(); const w = socks[socks.length - 1]; w.open(); await tick(); w.msg({ t: 'ready', pv: 3, now: 0, userCode: 'u', graceMs: 20000 }); await tick(); return w; };
      return { hub, clock, socks, log, band, ready };
    };
    const e = mk(); e.hub.start(); const w = await e.ready();
    w.kill(4999); await tick();
    chk(e.band.shown && e.band.shown.button === '다시 연결' && e.log.join() === 'err:E-RT-03', '서버가 4999 로 닫음 → 띠 [다시 연결] · E-RT-03');
    e.band.press(); await e.ready();
    chk(e.hub.isReady() && e.band.shown === null && e.socks.length === 2, '  ↳ [다시 연결] 로 붙고 띠는 사라진다');
    const a = mk(); a.hub.start(); const aw = await a.ready();
    aw.kill(4001); await tick(); await a.clock.advance(1000); await tick();
    a.socks[a.socks.length - 1].open(); await tick(); a.socks[a.socks.length - 1].kill(4001); await tick();
    chk(a.log.join() === 'err:E-RT-01,toLogin', '4001 두 번 → E-RT-01 · 로그인 화면 — ' + a.log.join());
    const n = mk(); n.hub.start(); const nw = await n.ready();
    nw.kill(1006); await tick();
    await n.clock.advance(16000);
    chk(n.band.shown && n.band.shown.text === '서버에 다시 연결하는 중…', '1006 이 15초 넘게 이어지면 «다시 연결하는 중» 띠');
    const p = mk(); p.hub.start(); const pw = await p.ready();
    pw.kill(4003); await tick();
    chk(p.log.join() === 'update', '4003 → 업데이트 강제 창');
  }

  say('── 3. 띠 화면');
  {
    const mkEl = (tag) => ({ tag, style: {}, children: [], textContent: '', attrs: {}, appendChild(c){ this.children.push(c); }, setAttribute(k, v){ this.attrs[k] = v; } });
    const body = mkEl('body');
    const doc = { createElement: mkEl, body };
    const d = U.createRtBandDom(doc);
    let pressed = 0;
    d.show({ text: '<b>서버</b>', button: null }, () => { pressed++; });
    const b = body.children[0];
    chk(b && b.id === U.BAND_ID && b.children[0].textContent === '<b>서버</b>' && b.children[1].style.display === 'none' && b.style.display === 'flex',
      '띠 — 글은 textContent · 단추가 없으면 숨김 · id ' + U.BAND_ID);
    d.show({ text: '끊김', button: '다시 연결' }, () => { pressed++; });
    b.children[1].onclick();
    chk(body.children.length === 1 && b.children[1].textContent === '다시 연결' && b.children[1].style.display === '' && pressed === 1, '  ↳ 단추 글 · 누르면 부른다 · 띠는 하나만 만든다');
    d.hide();
    chk(b.style.display === 'none', '  ↳ hide');
  }

  say('── 4. 배선');
  {
    const h = S.HTML.replace(/<!--[\s\S]*?-->/g, ''), i = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(i('realtime/rt-hub.js') > 0 && i('realtime/rt-status-ui.js') > i('realtime/rt-hub.js') && i('app.js') > i('realtime/rt-status-ui.js'), 'html — rt-hub.js → rt-status-ui.js → app.js 차례');
    const hit = (S.DR.match(/const UI_HIT_SEL = '([^']*)'/) || [])[1] || '';
    chk(hit.split(',').map((x) => x.trim()).includes('#' + U.BAND_ID), '클릭 통과 목록(UI_HIT_SEL)에 #' + U.BAND_ID + ' — 투명 창에서도 [다시 연결] 을 누른다');
    const blk = (S.APP.split('TwRtStatusUi.createRtStatusUi({')[1] || '').split('\n});')[0];
    chk(/rt: TwRtHub\.store/.test(blk) && /forceUpdate: \(\)=>updateFlowMod\.forceProtocol\(\)/.test(blk) && /maintenance: \(retry, onDismiss\)=>TwMaintenance\.store\.serverClosed\(retry, onDismiss\)/.test(blk)
      && /withdrawing: \(\)=>accountMod\.withdrawing\(\)/.test(blk) && /toLogin: \(\)=>accountMod\._loginDoLogout\(\{ force:true \}\)\.then\(\(\)=>acctStateMod\._acctRelaunchAfterDetach\(null\)\)/.test(blk),
      'app.js — 연결 · 업데이트 강제 창 · 점검 창 · 탈퇴 중 · 강제 로그아웃 뒤 다시 켜기(게이트가 로그인 화면)를 잇는다');
  }
}

(async () => {
await judge(SRC0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ['UI', "        if(rt.state() === S.RETRYING && !deps.inRoom()) band.show(", "        if(rt.state() === S.RETRYING) band.show(", '방 안에서도 띠'],
  ['UI', "      if(bandTimer || !sawReady) return;", "      if(bandTimer) return;", '켜는 중에도 «다시 연결» 띠'],
  ['UI', "const RETRY_BAND_MS = 15000;", "const RETRY_BAND_MS = 1000;", '짧은 끊김에도 띠'],
  ['UI', "    [S.READY]: () => { sawReady = true; clearBand(); },", "    [S.READY]: () => { sawReady = true; },", '붙어도 띠가 남음'],
  ['UI', "    if(bandTimer){ deps.clearTimeout(bandTimer); bandTimer = null; }\n", "", '붙어도 15초 타이머가 남아 띠'],
  ['UI', "if(beginSignOut()){ notifyError('E-RT-01'); deps.toLogin(); }", "if(beginSignOut()){ deps.toLogin(); }", '로그인 풀림에 번호 없음'],
  ['UI', "if(beginSignOut()){ notifyError('E-RT-01'); deps.toLogin(); }", "if(beginSignOut()){ notifyError('E-RT-01'); }", '로그인 풀림인데 로그인 화면으로 안 감'],
  ['UI', "    if(signingOut) return false;\n", "", '로그인 화면 보내기를 두 번'],
  ['UI', "if(!deps.withdrawing() && beginSignOut())", "if(beginSignOut())", '탈퇴 중에도 «로그아웃됐어요»'],
  ['UI', "{ notifyError('E-RT-02'); deps.toLogin(); }", "{ notifyError('E-RT-02'); }", '계정 로그아웃인데 로그인 화면으로 안 감'],
  ['UI', "    [S.UPDATE]: () => { clearBand(); deps.forceUpdate(); },", "    [S.UPDATE]: () => { clearBand(); },", '4003 에 업데이트 창 없음'],
  ['UI', "deps.maintenance(() => rt.start({ claim: false }), showMaintBand);", "deps.maintenance(() => rt.start({ claim: true }), showMaintBand);", '점검 뒤 다시 붙기가 claim(남을 밈)'],
  ['UI', "deps.maintenance(() => rt.start({ claim: false }), showMaintBand);", "rt.start({ claim: false });", '점검이면 창 없이 바로 다시 붙음'],
  ['UI', "deps.maintenance(() => rt.start({ claim: false }), showMaintBand);", "deps.maintenance(() => rt.start({ claim: false }));", '점검 창을 닫으면 [다시 연결] 띠가 없음'],
  ['UI', "      notifyError('E-RT-03');\n", "", '모르는 닫힘에 번호 없음'],
  ['UI', "      band.show({ text: TEXT.CLOSED, button: TEXT.RECONNECT }, reconnect);", "      reconnect();", '모르는 닫힘에 저절로 다시 붙음'],
  ['UI', "  const reconnect = () => { band.hide(); rt.start({ claim: false }); };", "  const reconnect = () => { band.hide(); };", '[다시 연결] 이 안 붙음'],
  ['UI', "      els.text.textContent = v.text;", "      els.text.innerHTML = v.text;", '띠 글을 HTML 로'],
  ['HTML', '<script src="parts/realtime/rt-status-ui.js"></script>', '', 'html 에 안 실음'],
  ['DR', "#rtBand, ", "", '클릭 통과 목록에 띠 없음'],
  ['APP', "  forceUpdate: ()=>updateFlowMod.forceProtocol(),", "  forceUpdate: ()=>{},", 'app.js 가 업데이트 창을 안 이음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
