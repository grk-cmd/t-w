// 조용한 창(quiet-main.js) 확인 — 네 묶음이 같이 쓰는 검사라 lib.js 만 쓴다(계정 · 서버 시드 없이 돈다)
// ① 켠 뒤 몇 초 — 모든 창의 진짜 자리(__e2eRealBounds)가 화면 밖 · 진짜 투명도 0 · 소리 끔 · 포커스 받은 창 없음
// ② 앱이 창을 앞으로 · 화면 안으로 부르는 길을 main 에서 직접 부른다(show · focus · moveTop · center · maximize ·
//    setAlwaysOnTop(true) · setPosition · app.focus — 크기 · setBounds 는 같은 하위 클래스로 만든 시험 창) → 그래도 진짜 창은 화면 밖 · 투명 · 소리 끔 · 포커스 없음 · 크기는 따름 ·
//    앱이 읽는 값(getBounds · getPosition · isAlwaysOnTop · getOpacity · isAudioMuted)은 앱이 정한 값
// ③ 창 목록(getAllWindows · fromWebContents · getFocusedWindow)이 감싸지 않았을 때와 같다 · ④ 렌더러 window.open 자식 창(방명록 길)도 조용
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
        muted: typeof w.webContents.__e2eRealAudioMuted === 'function' ? w.webContents.__e2eRealAudioMuted() : null,
        realAot: typeof w.__e2eRealAlwaysOnTop === 'function' ? w.__e2eRealAlwaysOnTop() : null };
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
      const bad = s.wins.filter((w) => !w.real || !offscreen(w.real, s.displays) || w.focus || w.opacity !== 0 || w.muted !== true || w.realAot !== false);
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
      // 앱 창은 앱이 크기를 정해 두기도 해서(런처 고정 크기) 크기 판정은 같은 하위 클래스로 만든 시험 창에서 본다 — 앱 창은 앞으로 · 화면 안 길만 부른다
      await A.app.evaluate(({ app, BrowserWindow }) => {
        const W = BrowserWindow.getAllWindows()[0].constructor;
        globalThis.__twQuietProbe = new W({ width: 300, height: 200, show: true, webPreferences: { offscreen: false } });
        for(const w of BrowserWindow.getAllWindows()){
          w.show(); w.focus(); w.moveTop(); w.center(); w.maximize();
          w.setAlwaysOnTop(true, 'screen-saver');
          w.setPosition(10, 10);
        }
        const p = globalThis.__twQuietProbe;
        p.setBounds({ x: 0, y: 0, width: 520, height: 410 });
        p.setPosition(10, 10);
        app.focus({ steal: true });
      });
      const s = await holdQuiet('부른 뒤');   // 진짜 창은 화면 밖 · 투명 · 소리 끔 그대로
      for(const w of s.wins){
        if(w.aot !== true) throw new Error('isAlwaysOnTop 이 기억한 값(true)이 아님');
        if(w.app.x !== 10 || w.app.y !== 10) throw new Error('getBounds 자리가 앱이 정한 10,10 이 아님 ' + JSON.stringify(w.app));
      }
      const c = await A.app.evaluate(() => {
        const w = globalThis.__twQuietProbe;
        const first = { app: w.getBounds(), real: w.__e2eRealBounds() };
        w.setBounds({ x: 0, y: 0, width: 520, height: 410 });
        w.setOpacity(1); w.setIgnoreMouseEvents(false); w.webContents.setAudioMuted(false);
        return { first, app: w.getBounds(), pos: w.getPosition(), real: w.__e2eRealBounds(), op: w.getOpacity(), realOp: w.__e2eRealOpacity(),
          muted: w.webContents.isAudioMuted(), realMuted: w.webContents.__e2eRealAudioMuted(), ignore: w.__e2eIgnoreMouse() };
      });
      if(JSON.stringify(c.first.app) !== JSON.stringify({ x: 10, y: 10, width: 520, height: 410 })) throw new Error('시험 창 getBounds 가 앱이 정한 {10,10,520,410} 이 아님 ' + JSON.stringify(c.first));
      if(c.real.width !== 520 || c.real.height !== 410) throw new Error('진짜 크기가 setBounds 를 안 따름 ' + JSON.stringify(c.real));
      if(JSON.stringify(c.app) !== JSON.stringify({ x: 0, y: 0, width: 520, height: 410 }) || c.pos[0] !== 0 || c.pos[1] !== 0) throw new Error('getBounds · getPosition 이 {0,0,520,410} 이 아님 ' + JSON.stringify(c));
      if(c.op !== 1 || c.realOp !== 0) throw new Error('투명도 — 앱 값 1 · 진짜 0 이어야 ' + JSON.stringify(c));
      if(c.muted !== false || c.realMuted !== true) throw new Error('소리 — 앱 값 false · 진짜 끔이어야 ' + JSON.stringify(c));
      if(c.ignore !== false) throw new Error('클릭 통과 기억 값이 false 가 아님');
      await holdQuiet('앱이 되돌리려 한 뒤', 2000);   // 진짜 창은 여전히 화면 밖 · 투명 · 소리 끔
    });
    await step('창 목록 — getAllWindows · fromWebContents 가 감싸지 않았을 때와 같다(수 · 같은 창)', async () => {
      const r = await A.app.evaluate(({ BrowserWindow, BaseWindow, webContents }) => {
        const all = BrowserWindow.getAllWindows(), base = BaseWindow.getAllWindows();
        return { n: all.length, base: base.length, same: base.every((w) => all.includes(w)),
          from: all.every((w) => BrowserWindow.fromWebContents(w.webContents) === w), name: all[0] && all[0].constructor.name,
          focused: BrowserWindow.getFocusedWindow() };
      });
      if(!r.n || r.n !== r.base || !r.same) throw new Error('getAllWindows 가 BaseWindow 와 다름 ' + JSON.stringify(r));
      if(!r.from) throw new Error('fromWebContents 가 같은 창을 돌려주지 않음');
      if(r.name !== 'BrowserWindow') throw new Error('constructor.name ' + r.name);
      if(r.focused) throw new Error('getFocusedWindow 가 창을 돌려줌(포커스를 받은 창)');
    });
    await step('자식 창(렌더러 window.open → 앱의 setWindowOpenHandler · did-create-window 길)도 조용', async () => {
      const n0 = (await look()).wins.length;
      // 방명록과 같은 길 — 앱 handler 가 mhGuestbook* 이름에 alwaysOnTop · parent 를 붙여 연다
      await A.app.windows()[0].evaluate(() => { window.__twQuietChild = window.open('', 'mhGuestbookE2E'); });
      let s;
      for(let k = 0; k < 40; k++){ s = await look(); if(s.wins.length > n0) break; await wait(250); }
      if(s.wins.length <= n0) throw new Error('자식 창이 안 열림 ' + JSON.stringify(s.wins.length));
      s = await holdQuiet('자식 창');
      const kid = await A.app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((x) => x.getParentWindow());
        return w ? { aot: w.isAlwaysOnTop(), realAot: w.__e2eRealAlwaysOnTop(), app: w.getBounds(), real: w.__e2eRealBounds(), name: w.constructor.name } : null;
      });
      if(!kid) throw new Error('부모가 있는 자식 창을 못 찾음');
      if(kid.aot !== true || kid.realAot !== false) throw new Error('자식 창 늘 위 — 앱 값 true · 진짜 false 여야 ' + JSON.stringify(kid));
      if(kid.real.width !== 320 || kid.real.height !== 560) throw new Error('자식 창 크기가 앱 옵션(320x560)이 아님 ' + JSON.stringify(kid.real));
      await A.app.windows()[0].evaluate(() => { try { window.__twQuietChild.close(); } catch(_){} });
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
