// 3D 장치(WebGL) 끊김 복구 — 메인 캔버스(#scene)의 WebGL 연결을 WEBGL_lose_context 로 일부러 끊는다.
// ① 6초 안에 돌아오면: 끊김 · 복구를 기록하고 앱은 그대로(다시 켜지 않음) · 캔버스가 다시 그려진다
// ② 6초 안에 안 돌아오면: 다시 켠 시각을 남기고 앱을 다시 켠다(relaunch + quit)
// ③ 다시 켠 뒤 10분 안에 또 안 돌아오면: 다시 켜지 않고 «그래픽(3D) 문제» 안내를 띄운다
'use strict';
const fs = require('fs');
const path = require('path');
const { run } = require('./_kit.js');

// 메인 프로세스의 다시 켜기 예약을 파일 한 줄로 바꾼다 — 시험 도구가 모르는 앱이 뜨지 않게 · 불렸는지는 파일로 본다
async function catchRelaunch(A, mark){
  await A.app.evaluate(({ app: a }, f) => {
    a.relaunch = () => process.mainModule.require('fs').writeFileSync(f, String(Date.now()));
  }, mark);
}

const lose = (w) => w.evaluate(() => {
  const c = document.getElementById('scene');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const ext = gl.getExtension('WEBGL_lose_context');
  window.__e2eLose = ext;
  ext.loseContext();
  return gl.isContextLost();
});

run('gl-recover', async (t) => {
  const A = await t.newUser('a');
  const mark = path.join(A.out, 'relaunched');
  const logHas = (re) => A.logs.some((l) => re.test(l));
  await t.step('① 끊고 1초 뒤 되돌림 → 복구 기록 · 앱은 그대로', async () => {
    await catchRelaunch(A, mark);
    t.check(await lose(A.w), '끊기지 않음(isContextLost false)');
    await t.poll(() => logHas(/\[WebGL\] WebGL 연결 끊김 #1/), 3000, '끊김 기록');
    await t.wait(1000);
    await A.w.evaluate(() => window.__e2eLose.restoreContext());
    await t.poll(() => logHas(/\[WebGL\] WebGL 연결 복구 — \d+ms/), 3000, '복구 기록');
    await t.wait(7000);   // 6초 타이머가 남아 있으면 이 사이에 다시 켠다
    t.check(!fs.existsSync(mark), '복구했는데 다시 켜기를 부름');
    const ok = await A.w.evaluate(() => {
      const c = document.getElementById('scene');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return !gl.isContextLost();
    });
    t.check(ok, '복구 뒤에도 연결이 끊긴 채');
    t.check(await t.shown(A, '#launcher'), '런처가 안 보임');
  });
  await t.step('② 끊고 안 되돌림 → 6초 뒤 다시 켠 시각 저장 · 다시 켜기 · 앱 꺼짐', async () => {
    const closed = new Promise((r) => A.app.once('close', r));
    const t0 = Date.now();
    await lose(A.w);
    await Promise.race([closed, t.wait(15000).then(() => { throw new Error('15초 안에 꺼지지 않음'); })]);
    t.check(fs.existsSync(mark), '다시 켜기(relaunch)를 부르지 않고 꺼짐');
    const took = Number(fs.readFileSync(mark, 'utf8')) - t0;
    t.note(`끊고 ${took}ms 뒤 다시 켜기`);
    t.check(took >= 5500 && took <= 9000, `다시 켜기까지 ${took}ms — 6초가 아님`);
    t.check(logHas(/WebGL 복구 안 됨 — 앱 다시 켜기/), '다시 켜기 기록이 없음');
  });
  await t.step('③ 다시 켠 뒤 또 안 돌아오면 → 다시 켜지 않고 안내', async () => {
    fs.rmSync(mark, { force: true });
    A.logs.push('--- relaunch ---');
    const w = await t.relaunchFresh(A);
    await t.waitLoggedIn(A);
    const at = await w.evaluate(() => localStorage.getItem('tw.glRelaunchAt'));
    t.check(at && Date.now() - Number(at) < 120000, '다시 켠 시각(tw.glRelaunchAt)이 남지 않음: ' + at);
    await catchRelaunch(A, mark);
    await lose(w);
    await t.poll(() => t.shown(A, '#glFailNotice'), 10000, '«그래픽(3D) 문제» 안내');
    const txt = await w.textContent('#glFailNotice');
    t.check(/다시 켜기/.test(txt) && /그래픽/.test(txt), '안내 글자: ' + txt);
    t.check(!fs.existsSync(mark), '10분 안에 또 끊겼는데 다시 켬');
    t.check(logHas(/분 안에 또 끊겨 다시 켜지 않고 안내/), '안내 기록이 없음');
    await t.shot(A, '01-notice');
  });
});
