// 조용한 창(quiet-main.js) 확인 — 네 묶음이 같이 쓰는 검사라 lib.js 만 쓴다(계정 · 서버 시드 없이 돈다)
// ① 켠 뒤 몇 초 — 모든 창의 진짜 자리(__e2eRealBounds)가 화면 밖 · 진짜 투명도 0 · 소리 끔 · 포커스 받은 창 없음
// ② 앱이 창을 앞으로 · 화면 안으로 부르는 길을 main 에서 직접 부른다(show · focus · moveTop · center · maximize ·
//    setAlwaysOnTop(true) · setBounds · setPosition · app.focus) → 그래도 진짜 창은 화면 밖 · 투명 · 소리 끔 · 포커스 없음 · 크기는 따름 ·
//    앱이 읽는 값(getBounds · getPosition · isAlwaysOnTop · getOpacity · isAudioMuted)은 앱이 정한 값
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
  const look = () => A.app.evaluate(({ BrowserWindow, screen }) => ({
    wins: BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => {
      const b = typeof w.__e2eRealBounds === 'function' ? w.__e2eRealBounds() : null;
      return { real: b, app: w.getBounds(), focus: w.isFocused(), aot: w.isAlwaysOnTop(),
        opacity: typeof w.__e2eRealOpacity === 'function' ? w.__e2eRealOpacity() : null,
        muted: typeof w.webContents.__e2eRealAudioMuted === 'function' ? w.webContents.__e2eRealAudioMuted() : null };
    }),
    focused: !!BrowserWindow.getFocusedWindow(),
    displays: screen.getAllDisplays().map((d) => d.bounds),
  }));
  // 화면 밖인가 — mac 은 화면 밖 창을 화면 끝으로 당겨 놓는다. 진짜 창이 어느 화면과도 4분의 1 넘게 겹치지 않으면 밖으로 본다(투명 · 클릭 통과는 따로 본다)
  const overlap = (r, d) => Math.max(0, Math.min(r.x + r.width, d.x + d.width) - Math.max(r.x, d.x)) * Math.max(0, Math.min(r.y + r.height, d.y + d.height) - Math.max(r.y, d.y));
  const offscreen = (r, ds) => ds.every((d) => overlap(r, d) <= 0.25 * r.width * r.height);
  const holdQuiet = async (where, ms = 4000) => {
    const t0 = Date.now();
    let s;
    while(Date.now() - t0 < ms){
      s = await look();
      const bad = s.wins.filter((w) => !w.real || !offscreen(w.real, s.displays) || w.focus || w.opacity !== 0 || w.muted !== true);
      if(!s.wins.length || bad.length || s.focused) throw new Error(where + ' — 화면 안 · 포커스 · 보임 · 소리 · 감싸지 않은 창: ' + JSON.stringify(s));
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
    await step('켠 뒤 4초 — 모든 창이 화면 밖 · 투명 · 소리 끔 · 포커스 없음', () => holdQuiet('켠 뒤'));
    await step('앱이 부르는 앞으로 · 화면 안 · 보이기 · 소리 길을 직접 불러도 진짜 창은 그대로 · 앱이 읽는 값은 앱이 정한 값', async () => {
      await A.app.evaluate(({ app, BrowserWindow }) => {
        for(const w of BrowserWindow.getAllWindows()){
          w.show(); w.focus(); w.moveTop(); w.center(); w.maximize();
          w.setAlwaysOnTop(true, 'screen-saver');
          w.setBounds({ x: 0, y: 0, width: 520, height: 410 });
          w.setPosition(10, 10);
        }
        app.focus({ steal: true });
      });
      const s = await holdQuiet('부른 뒤');   // 진짜 창은 화면 밖 · 투명 · 소리 끔 그대로
      for(const w of s.wins){
        if(w.real.width !== 520 || w.real.height !== 410) throw new Error('크기를 안 따름 ' + JSON.stringify(w.real));
        if(w.aot !== true) throw new Error('isAlwaysOnTop 이 기억한 값(true)이 아님');
        // setPosition(10,10) 이 마지막 — 앱이 읽는 자리는 그것, 크기는 setBounds 그대로
        if(JSON.stringify(w.app) !== JSON.stringify({ x: 10, y: 10, width: 520, height: 410 })) throw new Error('getBounds 가 앱이 정한 값이 아님 ' + JSON.stringify(w.app));
      }
      const c = await A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => {
        w.setBounds({ x: 0, y: 0, width: 520, height: 410 });
        w.setOpacity(1); w.setIgnoreMouseEvents(false); w.webContents.setAudioMuted(false);
        return { app: w.getBounds(), pos: w.getPosition(), real: w.__e2eRealBounds(), op: w.getOpacity(), realOp: w.__e2eRealOpacity(),
          muted: w.webContents.isAudioMuted(), realMuted: w.webContents.__e2eRealAudioMuted(), ignore: w.__e2eIgnoreMouse() };
      }));
      for(const w of c){
        if(JSON.stringify(w.app) !== JSON.stringify({ x: 0, y: 0, width: 520, height: 410 }) || w.pos[0] !== 0 || w.pos[1] !== 0) throw new Error('getBounds · getPosition 이 {0,0,520,410} 이 아님 ' + JSON.stringify(w));
        if(w.op !== 1 || w.realOp !== 0) throw new Error('투명도 — 앱 값 1 · 진짜 0 이어야 ' + JSON.stringify(w));
        if(w.muted !== false || w.realMuted !== true) throw new Error('소리 — 앱 값 false · 진짜 끔이어야 ' + JSON.stringify(w));
        if(w.ignore !== false) throw new Error('클릭 통과 기억 값이 false 가 아님');
      }
      await holdQuiet('앱이 되돌리려 한 뒤', 2000);   // 진짜 창은 여전히 화면 밖 · 투명 · 소리 끔
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
