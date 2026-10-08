/* sim-gl-recover.js — 🧯 메인 캔버스 WebGL 연결 끊김 대응 검사 (제보 #11)
   실행:  node sim-gl-recover.js   (gl-recover.js · app.js · desk-companion-prototype.html · main.js · preload.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — OBS 를 켠 채 앱을 켜면 GPU 를 잃고 «얼굴이 사라진 채» 남는다.
     three.js 는 연결이 돌아오기를 기다리기만 하고, 크로미움은 GPU 가 여러 번 죽으면 그 페이지의 WebGL 을 막아
     돌아오지 않을 수 있다. 막힘을 풀고(main) · 안 돌아오면 한 번만 다시 불러오는지(gl-recover) 본다.

   §1 gl-recover.js 실행 — 끊김 → 6초 → 다시 불러오기 1번 · 그 안에 복구되면 안 함 · 두 번째부터 기록만
   §2 연결 — HTML 순서 · app.js 가 메인 캔버스에 붙임 · preload/main 진단 통로 · main 의 3D 막힘 해제(ready 전) */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const GR = read('gl-recover.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), MAIN = read('main.js'), PRE = read('preload.js');
if (!GR || !APP || !HTML || !MAIN || !PRE) { say('  ? 원본 못 찾음 — gl-recover.js · app.js · HTML · main.js · preload.js'); process.exit(2); }

say('§1 gl-recover.js (실행)');
const mod = { exports: {} };
new Function('module', 'window', GR)(mod, undefined);
const G = mod.exports;
chk(G.WAIT_MS === 6000 && G.RELOAD_MAX === 1 && /^tw\./.test(G.RELOAD_KEY), '기다림 6초 · 다시 불러오기 1번 · 저장 키 tw. 접두사');
const env = () => {
  const e = { t: 0, timers: [], logs: [], reloads: 0, mem: {} };
  e.deps = {
    log: (m) => e.logs.push(m), reload: () => e.reloads++, now: () => e.t,
    setTimer: (fn, ms) => { e.timers.push({ fn, at: e.t + ms, dead: false }); return e.timers.length - 1; },
    clearTimer: (id) => { if (e.timers[id]) e.timers[id].dead = true; },
    store: { get: (k) => e.mem[k] || null, set: (k, v) => { e.mem[k] = v; } },
  };
  e.tick = (ms) => { e.t += ms; e.timers.forEach(x => { if (!x.dead && x.at <= e.t) { x.dead = true; x.fn(); } }); };
  return e;
};
{
  const e = env(), r = G.createGlRecover(e.deps);
  r.onLost(); e.tick(5000);
  chk(e.reloads === 0 && r.isLost(), '끊긴 뒤 5초 — 아직 기다린다');
  e.tick(1000);
  chk(e.reloads === 1 && e.mem[G.RELOAD_KEY] === '1' && e.logs.some(m => /다시 불러오기/.test(m)), '★ 6초 안에 안 돌아오면 화면을 다시 불러온다 · 횟수 기록');
}
{
  const e = env(), r = G.createGlRecover(e.deps);
  r.onLost(); e.tick(2000); r.onRestored(); e.tick(10000);
  chk(e.reloads === 0 && !r.isLost() && e.logs.some(m => /복구 — 2000ms/.test(m)), '★ 그 안에 돌아오면 다시 불러오지 않는다 · 걸린 시간 기록');
}
{
  const e = env(); e.mem[G.RELOAD_KEY] = '1';
  const r = G.createGlRecover(e.deps);
  r.onLost(); e.tick(7000);
  chk(e.reloads === 0 && e.logs.some(m => /이미 1번/.test(m)), '★ 이미 한 번 다시 불러왔으면 기록만 한다 (무한 재시작 없음)');
}
{
  const e = env(), r = G.createGlRecover(e.deps);
  r.onLost(); e.tick(3000); r.onLost(); e.tick(4000);
  chk(e.reloads === 0, '  두 번째 끊김은 시계를 다시 잰다 (앞 타이머 취소)');
  e.tick(2000);
  chk(e.reloads === 1, '  다시 잰 6초가 지나면 한 번만');
}
{
  const e = env(); e.deps.store = { get() { throw new Error('x'); }, set() { throw new Error('x'); } };
  const r = G.createGlRecover(e.deps);
  r.onLost(); e.tick(6000);
  chk(e.reloads === 1, '  저장소를 못 써도 죽지 않는다');
}

say('§2 연결');
const iG = HTML.indexOf('<script src="parts/gl-recover.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iG > 0 && iA > iG, 'HTML — app.js 보다 먼저 싣는다');
const iR = APP.indexOf('const renderer=new THREE.WebGLRenderer({canvas,'), iW = APP.indexOf('GlRecover.createGlRecover({');
chk(iR >= 0 && iW > iR && /\}\)\.attach\(canvas\);/.test(APP.slice(iW, iW + 800)), '★ app.js — 메인 렌더러를 만든 뒤 같은 캔버스에 붙인다');
chk(/reload: \(\) => location\.reload\(\)/.test(APP) && /sessionStorage\.getItem\(k\)/.test(APP), '  다시 불러오기 · 횟수는 sessionStorage (앱을 끄면 초기화)');
chk(/diagNote\(msg\) \{\s*ipcRenderer\.send\('companion:diagNote'/.test(PRE), 'preload — diagNote 통로');
chk(/ipcMain\.on\('companion:diagNote'/.test(MAIN) && /e\.sender !== mainWindow\.webContents\) return;/.test(MAIN) && /_diagLog\('\[렌더러\] '/.test(MAIN), 'main — 메인 창에서 온 것만 · 한 줄로 기록');
const iD = MAIN.indexOf('app.disableDomainBlockingFor3DAPIs();'), iReady = MAIN.indexOf('app.whenReady()');
chk(iD > 0 && iReady > iD, '★ main — GPU 가 죽은 뒤 WebGL 을 막지 않게 한다 (ready 전에)');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅');
process.exit(fail ? 1 : 0);
