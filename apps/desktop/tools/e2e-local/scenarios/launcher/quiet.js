// 조용한 창(quiet-main.js) 확인 — 네 묶음이 같이 쓰는 검사라 lib.js 만 쓴다(계정 · 서버 시드 없이 돈다)
// ① 켠 뒤 몇 초 — 모든 창의 진짜 자리(__e2eRealBounds)가 화면 밖 · 포커스 받은 창 없음
// ② 앱이 창을 앞으로 · 화면 안으로 부르는 길을 main 에서 직접 부른다(show · focus · moveTop · center · maximize ·
//    setAlwaysOnTop(true) · setBounds · setPosition · app.focus) → 그래도 화면 밖 · 포커스 없음 · 크기는 따름 · isAlwaysOnTop 은 기억한 값
// 결과: <결과 폴더>/steps.txt(ok · FAIL) · 종료 코드 0/1. TW_E2E_QUIET=0 이면 볼 것이 없어 건너뛴다
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, wait } = require('../../lib.js');
const { acquire } = require('../../runlock.js');

const out = path.resolve(process.argv[2] || '/tmp/tw-e2e/launcher/quiet');
const steps = [];
const save = () => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n'); };

(async () => {
  if(process.env.TW_E2E_QUIET === '0'){ steps.push('ok   TW_E2E_QUIET=0 — 건너뜀'); save(); return; }
  if(!out.startsWith('/tmp/') && !out.startsWith('/private/tmp/')) { console.error('결과 폴더는 /tmp 아래로: ' + out); process.exit(2); }
  fs.rmSync(out, { recursive: true, force: true });
  const unlock = await acquire('launcher/quiet');
  const A = makeApp(path.join(out, 'pc'));
  let code = 0;
  const look = () => A.app.evaluate(({ BrowserWindow }) => ({
    wins: BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => {
      const b = typeof w.__e2eRealBounds === 'function' ? w.__e2eRealBounds() : null;
      return { real: b, focus: w.isFocused(), aot: w.isAlwaysOnTop() };
    }),
    focused: !!BrowserWindow.getFocusedWindow(),
  }));
  const holdQuiet = async (where, ms = 4000) => {
    const t0 = Date.now();
    let s;
    while(Date.now() - t0 < ms){
      s = await look();
      const bad = s.wins.filter((w) => !w.real || w.real.x > -10000 || w.real.y > -10000 || w.focus);
      if(!s.wins.length || bad.length || s.focused) throw new Error(where + ' — 화면 안 · 포커스 · 감싸지 않은 창: ' + JSON.stringify(s));
      await wait(250);
    }
    return s;
  };
  const step = async (label, fn) => {
    const t0 = Date.now();
    try { await fn(); steps.push('ok   ' + label + ' (' + (Date.now() - t0) + 'ms)'); }
    catch(e){ steps.push('FAIL ' + label + ': ' + e.message); throw e; }
  };
  try {
    await A.launch();
    await step('켠 뒤 4초 — 모든 창이 화면 밖 · 포커스 없음', () => holdQuiet('켠 뒤'));
    await step('앱이 부르는 앞으로 · 화면 안 길을 직접 불러도 화면 밖 · 크기는 따름', async () => {
      await A.app.evaluate(({ app, BrowserWindow }) => {
        for(const w of BrowserWindow.getAllWindows()){
          w.show(); w.focus(); w.moveTop(); w.center(); w.maximize();
          w.setAlwaysOnTop(true, 'screen-saver');
          w.setBounds({ x: 0, y: 0, width: 520, height: 410 });
          w.setPosition(10, 10);
        }
        app.focus({ steal: true });
      });
      const s = await holdQuiet('부른 뒤');
      for(const w of s.wins){
        if(w.real.width !== 520 || w.real.height !== 410) throw new Error('크기를 안 따름 ' + JSON.stringify(w.real));
        if(w.aot !== true) throw new Error('isAlwaysOnTop 이 기억한 값(true)이 아님');
      }
    });
  } catch(e){
    code = 1;
    if(!steps.some((l) => l.startsWith('FAIL'))) steps.push('FAIL ' + e.message);
    steps.push('ABORT ' + e.message);
  } finally {
    save();
    try { fs.writeFileSync(path.join(out, 'pc', 'console.txt'), A.logs.join('\n') + '\n'); } catch(_){}
    await A.quit().catch(() => {});
    unlock();
  }
  console.log((code ? 'FAIL' : 'PASS') + ' launcher/quiet');
  process.exit(code);
})();
