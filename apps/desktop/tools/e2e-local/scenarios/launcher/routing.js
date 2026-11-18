// 주소 돌리기(route-main.js) 확인 — 네 묶음이 같이 쓰는 검사라 lib.js 만 쓴다(계정 · 시드 없이 돈다)
// ① 켤 때 lib.launch 가 이미 확인한다(창에서 https://api-dev…/actuator/health → 이 PC API 200 · 막힌 요청 없음)
// ② 창에서 진짜 주소를 부르면 이 PC 가 답한다 — API · Auth 에뮬레이터 · Storage 에뮬레이터(돌린 기록 REQ 에 남음)
// ③ 막는 목록(우리 데이터를 실을 수 있는 곳)의 https · wss 는 막히고 기록된다 — 창은 네트워크 오류, lib.quietProblems 가 그 주소를 문제로 낸다 · 목록 밖(글꼴)은 그대로
// 결과: <결과 폴더>/steps.txt(ok · FAIL · 끝 줄 PASS) · 종료 코드 0/1. 막는 것을 일부러 만드는 시험이라 e2e-quiet-fail 은 쓰지 않는다
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, wait, quietProblems } = require('../../lib.js');
const { acquire } = require('../../runlock.js');

const out = path.resolve(process.argv[2] || '/tmp/tw-e2e/launcher/routing');
const steps = [];
const save = () => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n'); };

(async () => {
  if(!out.startsWith('/tmp/') && !out.startsWith('/private/tmp/')) { console.error('결과 폴더는 /tmp 아래로: ' + out); process.exit(2); }
  fs.rmSync(out, { recursive: true, force: true });
  const unlock = await acquire('launcher/routing');
  const A = makeApp(path.join(out, 'pc'));
  let code = 0;
  const step = async (label, fn) => {
    const t0 = Date.now();
    try { await fn(); steps.push('ok   ' + label + ' (' + (Date.now() - t0) + 'ms)'); }
    catch(e){ steps.push('FAIL ' + label + ': ' + e.message); throw e; }
  };
  // 창에서 부르기 — 상태 번호 또는 'ERR …'(네트워크 오류)
  const call = (w, url) => w.evaluate(async (u) => {
    try { const r = await fetch(u, { cache: 'no-store' }); return r.status; } catch(e){ return 'ERR ' + e.message; }
  }, url);
  const logged = async (re) => { await wait(400); return A.reqs.some((r) => re.test(r)); };
  try {
    let w;
    await step('켜기 — lib.launch 의 확인(API 주소가 이 PC API 로 · 막힌 요청 없음)', async () => {
      w = await A.launch();
      // 앱은 켜는 동안 창을 한 번 더 읽는다 — 다 읽힌 뒤(앱 준비)에 창에서 부른다
      // waitForFunction 은 글을 eval 해서 앱 CSP(unsafe-eval 없음)에 막힌다 — evaluate 를 되풀이한다(다시 읽는 동안의 맥락 사라짐은 기다림)
      const end = Date.now() + 60000;
      for(;;){
        const ready = await w.evaluate(() => document.readyState === 'complete' && !!window.firebaseAPI).catch(() => false);
        if(ready) break;
        if(Date.now() > end) throw new Error('60초 안에 앱 준비 안 됨');
        await wait(250);
      }
    });
    await step('API — https://api-dev.together-working.com/actuator/health → 이 PC API 200', async () => {
      const s = await call(w, 'https://api-dev.together-working.com/actuator/health');
      if(s !== 200) throw new Error('상태 ' + s);
      if(!(await logged(/^GET \/actuator\/health 200$/))) throw new Error('돌린 기록 없음');
    });
    await step('Auth — https://identitytoolkit.googleapis.com/… → 에뮬레이터가 답함(돌린 기록)', async () => {
      const s = await call(w, 'https://identitytoolkit.googleapis.com/v1/projects');
      if(typeof s !== 'number') throw new Error('네트워크 오류 ' + s);
      if(!(await logged(/^GET identitytoolkit\.googleapis\.com\/v1\/projects \d+$/))) throw new Error('돌린 기록 없음');
    });
    await step('Storage — https://firebasestorage.googleapis.com/… → 에뮬레이터가 답함(돌린 기록)', async () => {
      const s = await call(w, 'https://firebasestorage.googleapis.com/v0/b/e2e-routing/o');
      if(typeof s !== 'number') throw new Error('네트워크 오류 ' + s);
      if(!(await logged(/^GET firebasestorage\.googleapis\.com\/v0\/b\/e2e-routing\/o \d+$/))) throw new Error('돌린 기록 없음');
    });
    await step('막는 목록 밖(fonts.googleapis.com)은 막지 않음', async () => {
      await call(w, 'https://fonts.googleapis.com/css2?family=Roboto');   // 바깥 망 답은 상관없다 — 막힌 기록에 없어야 한다
      await wait(400);
      if(A.blocked.some((b) => b.includes('fonts.googleapis.com'))) throw new Error('막지 말아야 할 글꼴 주소를 막음');
    });
    await step('막는 목록의 googleapis(firestore.googleapis.com)는 막힘', async () => {
      const s = await call(w, 'https://firestore.googleapis.com/e2e-routing');
      if(typeof s === 'number') throw new Error('막혀야 할 요청이 답을 받음 ' + s);
      await wait(400);
      if(!A.blocked.some((b) => b.includes('firestore.googleapis.com/e2e-routing'))) throw new Error('막은 기록에 없음 — ' + JSON.stringify(A.blocked));
    });
    await step('짝이 없는 진짜 주소(https · wss)는 막히고 기록되며 quietProblems 가 문제로 냄', async () => {
      const s = await call(w, 'https://help.together-working.com/e2e-routing');
      if(typeof s === 'number') throw new Error('막혀야 할 요청이 답을 받음 ' + s);
      await w.evaluate(() => new Promise((res) => {
        const ws = new WebSocket('wss://realtime.together-working.com/e2e-routing');
        ws.onerror = ws.onclose = () => res();
        setTimeout(res, 5000);
      }));
      await wait(500);
      const want = ['firestore.googleapis.com/e2e-routing', 'help.together-working.com/e2e-routing', 'realtime.together-working.com/e2e-routing'];
      for(const x of want) if(!A.blocked.some((b) => b.includes(x))) throw new Error('막은 기록에 없음 ' + x + ' — ' + JSON.stringify(A.blocked));
      const bad = await quietProblems(A.app);
      for(const x of want) if(!bad.some((b) => b.includes(x))) throw new Error('quietProblems 가 안 냄 ' + x + ' — ' + JSON.stringify(bad));
    });
  } catch(e){
    code = 1;
    if(!steps.some((l) => l.startsWith('FAIL'))) steps.push('FAIL ' + e.message);
    steps.push('ABORT ' + e.message);
  } finally {
    if(!code) steps.push('PASS');   // run-all 은 steps.txt 의 PASS 줄로 통과를 본다
    save();
    try {
      fs.writeFileSync(path.join(out, 'pc', 'console.txt'), A.logs.join('\n') + '\n');
      fs.writeFileSync(path.join(out, 'pc', 'requests.txt'), A.reqs.join('\n') + '\n');
    } catch(_){}
    await A.quit().catch(() => {});
    unlock();
  }
  console.log((code ? 'FAIL' : 'PASS') + ' launcher/routing');
  process.exit(code);
})();
