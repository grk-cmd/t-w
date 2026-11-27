// 두 번째 실행 — 켜 둔 앱이 멀쩡하면 새로 켠 것은 바로 꺼지고 옛 창이 앞으로(second-instance) ·
// 옛 창의 렌더러가 죽은 채면 옛 앱을 정리하고 새로 띄운다(relaunch). 같은 결과 폴더(같은 userData = 같은 단일 실행 잠금)로 Electron 을 하나 더 켠다
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const K = require('../account/_kit.js');
const { APP_DIR } = require('../../lib.js');

// 두 번째 실행 — 도구 없이 같은 진입점을 한 번 더 켠다. 꺼질 때까지 기다려 종료 코드 · 걸린 시간
function secondLaunch(dir, ms = 30000){
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(require(path.join(APP_DIR, 'node_modules', 'electron')), [path.join(dir, 'wrap'), '--tw-firebase=dev'], { cwd: APP_DIR, stdio: 'ignore' });
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch(_){} resolve({ code: 'timeout', ms: Date.now() - t0 }); }, ms);
    p.on('exit', (code) => { clearTimeout(timer); resolve({ code, ms: Date.now() - t0 }); });
  });
}

K.scenario('second-instance', async (t) => {
  const a = await t.app('a');
  await K.waitShown(a.w, '#inviteGateCard', 30000);
  await a.A.app.evaluate(({ app }) => { globalThis.__twSecond = 0; app.on('second-instance', () => { globalThis.__twSecond++; }); });
  await t.step('멀쩡할 때 — 새로 켠 것은 바로 꺼지고 옛 앱이 신호를 받는다 · 옛 창 그대로', async () => {
    const r = await secondLaunch(a.dir);
    t.note('두 번째 실행: 종료 ' + r.code + ' · ' + r.ms + 'ms');
    if(r.code !== 0) throw new Error('두 번째 실행이 바로 안 꺼짐: ' + r.code);
    await K.waitFor(() => a.A.app.evaluate(() => globalThis.__twSecond), 10000, 'second-instance 신호');
    const alive = await a.A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.isVisible()).length);
    if(alive < 1) throw new Error('옛 창이 없음');
    if(!(await K.shown(a.w, '#inviteGateCard'))) throw new Error('옛 화면이 바뀜');
  });
  await t.step('렌더러가 죽은 채면 — 옛 앱이 다시 켜기를 부르고 꺼진다', async () => {
    // 렌더러는 한 번은 스스로 다시 불러온다(RENDERER_AUTO_RELOAD_MAX) — 두 번 죽여 죽은 채로 둔다
    for(let i = 0; i < 2; i++){
      await a.A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
      await t.wait(3000);
    }
    const crashed = await a.A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isCrashed());
    if(!crashed) throw new Error('렌더러가 죽은 채가 아님');
    await a.A.app.evaluate(({ app }) => { app.relaunch = () => { console.log('[e2e] relaunch 요청'); }; });
    const pid = a.A.app.process().pid;
    const l0 = a.A.logs.length;
    const r = await secondLaunch(a.dir);
    t.note('두 번째 실행: 종료 ' + r.code + ' · ' + r.ms + 'ms');
    await K.waitFor(() => a.A.logs.slice(l0).some((l) => /\[e2e\] relaunch 요청/.test(l)), 15000, '옛 앱의 다시 켜기');
    await K.waitFor(() => { try { process.kill(pid, 0); return false; } catch(_){ return true; } }, 15000, '옛 앱 꺼짐');
  });
});
