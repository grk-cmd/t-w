/* sim-gl-recover.js — 🧯 메인 캔버스 WebGL 연결 끊김 대응 검사 (제보 #11 · B-1114-5)
   실행:  node sim-gl-recover.js   (gl-recover.js · gl-fail-notice.js · app.js · desk-companion-prototype.html · main.js · preload.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — GPU 를 잃으면 three.js 는 돌아오기를 기다리기만 해서 캐릭터가 안 보인 채 남는다.
     화면만 다시 불러오면 WebGL 을 못 만들어 app.js 가 첫 줄에서 죽고 런처 바탕이 모니터를 덮었다(B-1114-5).
     안 돌아오면 앱을 다시 켜고(gl-recover) · 10분 안에 또면 안내만 · WebGL 을 못 만들면 안내(gl-fail-notice)를 띄우는지 본다.

   §1 gl-recover.js 실행 — 끊김 → 6초 → 앱 다시 켜기 · 시각 기록 · 10분 안에 또면 안내 · 경계 · 두 번째 끊김 · 저장소 못 씀
   §2 gl-fail-notice.js 실행 — 렌더러 만들기 실패 → 안내 · 다시 던짐 · 한 번만 · 버튼 · E-SYS-05
   §3 연결 — HTML 순서 · app.js 가 렌더러를 guard 로 만들고 같은 캔버스에 붙임 · localStorage · preload/main 통로
   §4 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const GR = read('gl-recover.js'), GF = read('gl-fail-notice.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), MAIN = read('main.js'), PRE = read('preload.js');
if (!GR || !GF || !APP || !HTML || !MAIN || !PRE) { say('  ? 원본 못 찾음 — gl-recover.js · gl-fail-notice.js · app.js · HTML · main.js · preload.js'); process.exit(2); }

say('§1 gl-recover.js (실행)');
const loadGR = (src) => { const mod = { exports: {} }; new Function('module', 'window', src)(mod, undefined); return mod.exports; };
const MIN10 = 10 * 60 * 1000;
const env = () => {
  const e = { t: 1e9, timers: [], logs: [], relaunches: 0, notices: 0, mem: {}, after: 0 };
  e.deps = {
    log: (m) => e.logs.push(m), relaunch: () => e.relaunches++, notice: () => e.notices++, now: () => e.t, afterRestore: () => e.after++,
    setTimer: (fn, ms) => { e.timers.push({ fn, at: e.t + ms, dead: false }); return e.timers.length - 1; },
    clearTimer: (id) => { if (e.timers[id]) e.timers[id].dead = true; },
    store: { get: (k) => (k in e.mem ? e.mem[k] : null), set: (k, v) => { e.mem[k] = v; } },
  };
  e.tick = (ms) => { e.t += ms; e.timers.forEach(x => { if (!x.dead && x.at <= e.t) { x.dead = true; x.fn(); } }); };
  return e;
};
function judgeGR(src){
  const r = {};
  try {
    const G = loadGR(src);
    r.consts = G.WAIT_MS === 6000 && G.RELAUNCH_GAP_MS === MIN10 && /^tw\./.test(G.RELAUNCH_KEY);
    r.decide = G.decide(MIN10 * 3, 0) === 'relaunch' && G.decide(MIN10 * 3, null) === 'relaunch' && G.decide(MIN10 * 3, 'x') === 'relaunch'
      && G.decide(MIN10 * 3, MIN10 * 2 + 1) === 'notice' && G.decide(MIN10 * 3, MIN10 * 2) === 'relaunch'
      && G.decide(MIN10, MIN10 * 2) === 'notice';   // 시계가 뒤로 감 — 다시 켜지 않는다
    { const e = env(), g = G.createGlRecover(e.deps);
      g.onLost(); e.tick(5000); const wait = e.relaunches === 0 && g.isLost();
      e.tick(1000);
      r.relaunch = wait && e.relaunches === 1 && e.notices === 0 && e.mem[G.RELAUNCH_KEY] === String(e.t) && e.logs.some(m => /앱 다시 켜기/.test(m)); }
    { const e = env(), g = G.createGlRecover(e.deps);
      g.onLost(); e.tick(2000); g.onRestored(); e.tick(10000);
      r.restored = e.relaunches === 0 && e.notices === 0 && !g.isLost() && e.logs.some(m => /복구 — 2000ms/.test(m)) && e.after === 1; }
    { const e = env(); e.mem[G.RELAUNCH_KEY] = String(e.t - 60000);
      const g = G.createGlRecover(e.deps); g.onLost(); e.tick(6000);
      r.recent = e.relaunches === 0 && e.notices === 1 && e.logs.some(m => /안에 또 끊겨/.test(m)); }
    { const e = env(); e.mem[G.RELAUNCH_KEY] = String(e.t + 6000 - MIN10);
      const g = G.createGlRecover(e.deps); g.onLost(); e.tick(6000);
      r.edge = e.relaunches === 1 && e.notices === 0; }
    { const e = env(), g = G.createGlRecover(e.deps);
      g.onLost(); e.tick(3000); g.onLost(); e.tick(4000); const re = e.relaunches === 0;
      e.tick(2000);
      r.second = re && e.relaunches === 1; }
    { const e = env(); e.mem[G.RELAUNCH_KEY] = String(e.t - 1000);
      const g = G.createGlRecover(e.deps); g.onLost(); e.tick(6000); g.onLost(); e.tick(6000);
      r.twice = e.relaunches === 0 && e.notices === 2; }
    { const e = env(); e.deps.store = { get() { throw new Error('x'); }, set() { throw new Error('x'); } };
      const g = G.createGlRecover(e.deps); g.onLost(); e.tick(6000);
      r.noStore = e.relaunches === 0 && e.notices === 1 && e.logs.some(m => /적지 못해/.test(m)); }
    { const e = env(); e.deps.afterRestore = () => { throw new Error('점검 오류'); };
      const g = G.createGlRecover(e.deps); g.onLost(); g.onRestored();
      r.afterThrow = !g.isLost() && e.logs.some(m => /복구 뒤 점검 실패 — 점검 오류/.test(m)); }
  } catch (err) { r.err = err && err.message; }
  return r;
}
const R = judgeGR(GR);
if (R.err) chk(false, '돌리다 멈춤 — ' + R.err);
chk(R.consts, '기다림 6초 · 다시 켜기 간격 10분 · 저장 키 tw. 접두사');
chk(R.decide, 'decide — 처음 · 10분 지남은 다시 켜기 · 10분 안 · 시계가 뒤로 감은 안내 · 경계(딱 10분)는 다시 켜기');
chk(R.relaunch, '★ 6초 안에 안 돌아오면 앱을 다시 켠다 · 시각을 적는다 · 기록 한 줄');
chk(R.restored, '★ 그 안에 돌아오면 다시 켜지 않는다 · 걸린 시간 · 좌석 그림 점검 한 번');
chk(R.recent, '★ 10분 안에 다시 켰으면 또 켜지 않고 안내(무한 재시작 없음) · 기록 한 줄');
chk(R.edge, '  경계 — 다시 켠 지 딱 10분이면 다시 켠다');
chk(R.second, '  두 번째 끊김은 시계를 다시 잰다(앞 타이머 취소) · 다시 잰 6초 뒤 한 번만');
chk(R.twice, '  10분 안 두 번째 끊김도 같은 규칙(투명하게 «기록만» 남지 않고 안내)');
chk(R.noStore, '  저장소를 못 쓰면 다시 켜지 않고 안내(무한 재시작 막기)');
chk(R.afterThrow, '  점검이 던져도 복구 처리는 끝나고 기록만 남긴다');

say('§2 gl-fail-notice.js (실행)');
const fakeDoc = () => {
  const mk = (tag) => ({ tag, children: [], style: {}, attrs: {}, textContent: '', className: '', id: '',
    appendChild(c){ this.children.push(c); return c; }, setAttribute(k, v){ this.attrs[k] = v; }, focus(){},
    set innerHTML(_){ throw new Error('innerHTML 금지'); } });
  const body = mk('body');
  return { body, createElement: mk };
};
const walk = (n, f) => { f(n); (n.children || []).forEach(c => walk(c, f)); };
function judgeGF(src){
  const r = {};
  try {
    const w = {}; new Function('window', 'module', src)(w, undefined);
    const M = w.TwGlFailNotice;
    const run = () => {
      const doc = fakeDoc(), L = { codes: [], notes: [], rel: 0, quit: 0 };
      const n = M.createGlFailNotice({ doc, notifyError: (c, e) => L.codes.push([c, e]), note: (m) => L.notes.push(m), relaunch: () => L.rel++, quit: () => L.quit++ });
      return { n, doc, L };
    };
    { const { n, doc, L } = run();
      const boom = new Error('WebGL 못 만듦');
      let thrown = null; try { n.guard(() => { throw boom; }); } catch (e) { thrown = e; }
      const ov = doc.body.children[0];
      const texts = [], buttons = [];
      if (ov) walk(ov, (x) => { if (x.textContent) texts.push(x.textContent); if (x.tag === 'button') buttons.push(x); });
      r.create = thrown === boom && n.isShown() && !!ov && ov.id === M.OV_ID && /app-popup-ov/.test(ov.className)
        && texts.includes(M.TEXT.body) && L.codes.length === 1 && L.codes[0][0] === 'E-SYS-05' && L.codes[0][1] === boom
        && L.notes.some(m => /안내 띄움 — create/.test(m)) && /background:var\(--win-face\)/.test(ov.style.cssText);
      const again = buttons.find(b => b.textContent === M.TEXT.relaunch), close = buttons.find(b => b.textContent === M.TEXT.close);
      if (again) again.onclick();
      if (close) close.onclick();
      r.buttons = !!again && !!close && L.rel === 1 && L.quit === 1;
      r.once = n.show('lost') === false && doc.body.children.length === 1 && L.codes.length === 1; }
    { const { n } = run(); r.pass = n.guard(() => 42) === 42 && !n.isShown(); }
    { const { n, doc } = run(); n.show('lost'); const ov = doc.body.children[0];
      r.lost = !!ov && /background:none/.test(ov.style.cssText) && /pointer-events:none/.test(ov.style.cssText); }
  } catch (err) { r.err = err && err.message; }
  return r;
}
const F = judgeGF(GF);
if (F.err) chk(false, '돌리다 멈춤 — ' + F.err);
chk(F.create, '★ 렌더러를 못 만들면 안내를 띄우고(덮는 바탕 · 문구) E-SYS-05 · 진단 한 줄 · 같은 오류를 다시 던진다');
chk(F.buttons, '  [다시 켜기] → 앱 다시 켜기 · [닫기] → 앱 끄기');
chk(F.once, '  안내는 한 번만(두 번째 show 는 아무것도 안 함)');
chk(F.pass, '  만들기가 되면 그대로 돌려주고 안내 없음');
chk(F.lost, '  실행 중 끊김(lost) 안내는 모니터를 덮지 않는다(바탕 없음 · 상자만 눌림)');

say('§3 연결');
const iG = HTML.indexOf('<script src="parts/shared/gl-recover.js"></script>'), iF = HTML.indexOf('<script src="parts/shared/gl-fail-notice.js"></script>');
const iE = HTML.indexOf('<script src="parts/shared/error-codes.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iG > 0 && iE > 0 && iF > iE && iA > iF && iA > iG, 'HTML — gl-recover · gl-fail-notice(error-codes 다음)를 app.js 보다 먼저 싣는다');
const iN = APP.indexOf('const glFail = TwGlFailNotice.createGlFailNotice({'), iR = APP.indexOf('const renderer=glFail.guard(() => new THREE.WebGLRenderer({canvas,'), iW = APP.indexOf('GlRecover.createGlRecover({');
chk(iN >= 0 && iR > iN && iW > iR && /\}\)\.attach\(canvas\);/.test(APP.slice(iW, iW + 900)), '★ app.js — 안내를 만들고 · 렌더러를 guard 로 만든 뒤 같은 캔버스에 붙인다');
const blk = APP.slice(iW, iW + 900);
chk(/relaunch: \(\) => companion\.relaunchApp\(\)/.test(blk) && /notice: \(\) => glFail\.show\('lost'\)/.test(blk) && /localStorage\.getItem\(k\)/.test(blk) && !/location\.reload/.test(blk), '  다시 켜기는 relaunchApp · 안내는 glFail.show · 시각은 localStorage(앱을 다시 켜도 남음) · 화면만 다시 불러오기 없음');
chk(/afterRestore: \(\) => faceHealMod\.reportGlReset\(\),/.test(APP), '  돌아오면 좌석 그림 점검(face-heal reportGlReset)');
chk(/relaunchApp\(\) \{\s*ipcRenderer\.send\('companion:relaunchApp'\)/.test(PRE) && /ipcMain\.on\('companion:relaunchApp'/.test(MAIN), 'preload · main — 앱 다시 켜기 통로(이미 있는 것)');
chk(/diagNote\(msg\) \{\s*ipcRenderer\.send\('companion:diagNote'/.test(PRE), 'preload — diagNote 통로');
chk(/ipcMain\.on\('companion:diagNote'/.test(MAIN) && /e\.sender !== mainWindow\.webContents\) return;/.test(MAIN) && /_diagLog\('\[렌더러\] '/.test(MAIN), 'main — 메인 창에서 온 것만 · 한 줄로 기록');
const iD = MAIN.indexOf('app.disableDomainBlockingFor3DAPIs();'), iReady = MAIN.indexOf('app.whenReady()');
chk(iD > 0 && iReady > iD, '★ main — GPU 가 죽은 뒤 WebGL 을 막지 않게 한다 (ready 전에)');

say('§4 깨 보기');
const breakGR = (from, to) => { const m = GR.replace(from, to); return m === GR ? null : judgeGR(m); };
const b1 = breakGR("if(decide(now, lastAt()) === 'notice') return giveUp();", '');
chk(!!b1 && (!b1.recent || !b1.twice), '10분 규칙을 빼면(늘 다시 켬) 빨강');
const b2 = breakGR("catch(_){ deps.log('WebGL 복구 안 됨 — 다시 켠 시각을 적지 못해 다시 켜지 않고 안내'); deps.notice(); return; }", 'catch(_){}');
chk(!!b2 && !b2.noStore, '시각을 못 적어도 다시 켜면 빨강');
const b3 = breakGR('if(last > 0 && now - last < RELAUNCH_GAP_MS)', 'if(last > 0 && now - last < RELAUNCH_GAP_MS && now >= last)');
chk(!!b3 && !b3.decide, '시계가 뒤로 갔을 때 다시 켜면 빨강');
const b4 = breakGR('deps.relaunch();', 'deps.notice();');
chk(!!b4 && !b4.relaunch, '앱을 다시 켜지 않으면 빨강');
const breakGF = (from, to) => { const m = GF.replace(from, to); return m === GF ? null : judgeGF(m); };
const b5 = breakGF("catch(e){ show('create', e); throw e; }", "catch(e){ show('create', e); return null; }");
chk(!!b5 && !b5.create, '안내 뒤 다시 던지지 않으면(죽은 렌더러로 계속) 빨강');
const b6 = breakGF('if(shown) return false;', '');
chk(!!b6 && !b6.once, '안내를 여러 번 띄우면 빨강');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅');
process.exit(fail ? 1 : 0);
