// 책상 모드(데스크톱 실행 화면 · 클릭 통과) — 캐릭터를 만들고 런처 미리보기를 누르면 창이 주 모니터 작업 영역을 덮고 맨 위에 뜨며
// 클릭이 뒤 프로그램으로 통과되고(setIgnoreMouseEvents(true)), 내 캐릭터 이름표 · 상태칩이 보인다. «런처로» 를 누르면 런처 크기 · 클릭 받음으로 돌아온다.
// 클릭 통과의 «캐릭터 위에서만 받기» 는 OS 마우스 자리로 판정해서(합성 마우스는 OS 커서를 안 움직인다) 여기서 보지 않는다(sim hit-map · click-through-policy).
'use strict';
const { run } = require('./_kit.js');

// 메인 창의 클릭 통과 호출을 기록한다(값만 적고 원래 함수를 그대로 부른다)
const watchIgnore = (A) => A.app.evaluate(({ BrowserWindow }) => {
  const m = BrowserWindow.getAllWindows().find((x) => /Desk Companion/.test(x.getTitle()));
  global.__e2eIgn = [];
  const f = m.setIgnoreMouseEvents.bind(m);
  m.setIgnoreMouseEvents = (v, o) => { global.__e2eIgn.push(!!v); return f(v, o); };
});
const lastIgnore = (A) => A.app.evaluate(() => global.__e2eIgn[global.__e2eIgn.length - 1]);

run('desk-mode', async (t) => {
  const A = await t.newUser('a');
  await t.step('캐릭터 만들기', () => t.createCharacter(A));
  let launcher;
  await t.step('런처 창 — 작은 창 · 클릭 받음', async () => {
    launcher = (await t.win(A)).b;
    t.check(launcher.width < 600 && launcher.height < 1000, '런처 창 크기: ' + JSON.stringify(launcher));
    await watchIgnore(A);
  });
  await t.step('미리보기 누름 → 책상 모드 — 작업 영역을 덮음 · 맨 위 · 클릭 통과', async () => {
    await t.enterDesk(A);
    const s = await t.win(A);
    // 조용한 창(TW_E2E_QUIET)은 자리를 화면 밖으로 옮기므로 크기만 본다
    t.check(s.b.width === s.work.width && s.b.height === s.work.height, `창 ${JSON.stringify(s.b)} ≠ 작업 영역 크기 ${JSON.stringify(s.work)}`);
    t.check(s.top, '맨 위(alwaysOnTop)가 아님');
    await t.poll(async () => (await lastIgnore(A)) === true, 5000, '클릭 통과(setIgnoreMouseEvents true)');
    t.check(!(await t.shown(A, '#launcher')), '런처가 남아 있음');
    t.check(await t.shown(A, '#myStatusChip'), '상태칩이 안 보임');
    const label = await A.w.evaluate(() => document.getElementById('seatLabelsLayer').innerText);
    t.check(/Lv\.?\s*1/.test(label), '내 이름표(레벨)가 없음: ' + label);
    await t.shot(A, '01-desk');
  });
  await t.step('런처로 → 런처 크기 · 클릭 받음', async () => {
    await t.leaveDesk(A);
    const s = await t.win(A);
    t.check(s.b.width === launcher.width && s.b.height === launcher.height, `런처 크기로 안 돌아옴: ${JSON.stringify(s.b)}`);
    await t.poll(async () => (await lastIgnore(A)) === false, 5000, '클릭 받음(setIgnoreMouseEvents false)');
  });
});
