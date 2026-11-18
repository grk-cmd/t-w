// 피규어 · 회사원 모드 — 프로그램 설정 › 시스템의 두 단추.
// 피규어: 끄면 책상 모드에서 입력이 없을 때(8초) 잠들어 머리 위에 Z 가 뜨고, 켜면 잠들지 않는다(Z 0개). 다시 켜도 켜진 채.
// 회사원: 켜면 «회사원 모드가 켜졌어요» · 책상 모드에서 상태칩 ■ 우클릭으로 화면이 숨고(body.office-hidden) 다시 우클릭으로 돌아온다. 끄면 우클릭해도 안 숨는다.
'use strict';
const { run } = require('./_kit.js');

async function setToggle(t, A, id, on){
  await A.w.click('#lcProgSettingsBtn');
  await A.w.click('#progTabBtnSystem');
  const cur = /켜짐/.test(await A.w.textContent(id));
  if(cur !== on) await A.w.click(id);
  t.check(/켜짐/.test(await A.w.textContent(id)) === on, id + ' 단추 글자가 안 바뀜');
  await A.w.click('#progSettingsCloseBtn');
}
// 머리 위 Z 는 캔버스에 'Z' 를 쓰는 스프라이트 — 쓴 횟수를 센다
const countZ = (A) => A.w.evaluate(() => {
  if(window.__e2eZ === undefined){
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(s, ...a){ if(s === 'Z') window.__e2eZ++; return f.call(this, s, ...a); };
  }
  window.__e2eZ = 0;
});
const zNow = (A) => A.w.evaluate(() => window.__e2eZ);

run('figure-office', async (t) => {
  const A = await t.newUser('a');
  await t.step('캐릭터 만들기', () => t.createCharacter(A));
  await t.step('피규어 끔 → 책상 모드에서 14초 가만히 두면 잠듦(Z)', async () => {
    await setToggle(t, A, '#progFigureModeToggle', false);
    await countZ(A);
    await t.enterDesk(A);
    await t.wait(14000);
    const z = await zNow(A);
    t.note('Z ' + z + '개');
    t.check(z > 0, '잠들지 않음(Z 0개)');
    await t.leaveDesk(A);
  });
  await t.step('피규어 켬 → 같은 14초에 잠들지 않음(Z 0개) · 저장됨', async () => {
    await setToggle(t, A, '#progFigureModeToggle', true);
    t.check((await A.w.evaluate(() => localStorage.getItem('tw.figureMode'))) === '1', 'tw.figureMode 가 1 이 아님');
    await countZ(A);
    await t.enterDesk(A);
    await t.wait(14000);
    t.check((await zNow(A)) === 0, '피규어 모드인데 잠듦(Z ' + (await zNow(A)) + '개)');
    await t.leaveDesk(A);
  });
  await t.step('회사원 켬 → 알림 · 책상 모드에서 ■ 우클릭으로 화면 숨김 · 다시 보이기', async () => {
    await setToggle(t, A, '#progOfficeModeToggle', true);
    t.check(/회사원 모드가 켜졌어요/.test(await A.w.textContent('#toast')), '켜짐 알림 없음');
    await t.enterDesk(A);
    const hidden = () => A.w.evaluate(() => document.body.classList.contains('office-hidden'));
    await A.w.click('#myStatusChipBtn', { button: 'right' });
    await t.poll(hidden, 3000, '화면 숨김(office-hidden)');
    t.check(!(await t.shown(A, '#seatLabelsLayer')), '숨겼는데 이름표가 보임');
    t.check(await t.shown(A, '#myStatusChipBtn'), '되돌릴 ■ 단추까지 숨음');
    await t.shot(A, '01-office-hidden');
    await A.w.click('#myStatusChipBtn', { button: 'right' });
    await t.poll(async () => !(await hidden()), 3000, '다시 보이기');
    await t.leaveDesk(A);
  });
  await t.step('다시 켜도 두 모드가 켜진 채', async () => {
    await t.relaunch(A);
    await t.waitLoggedIn(A);
    await A.w.click('#lcProgSettingsBtn');
    await A.w.click('#progTabBtnSystem');
    t.check(/켜짐/.test(await A.w.textContent('#progFigureModeToggle')), '피규어가 꺼짐');
    t.check(/켜짐/.test(await A.w.textContent('#progOfficeModeToggle')), '회사원이 꺼짐');
    await A.w.click('#progSettingsCloseBtn');
  });
  await t.step('회사원 끔 → ■ 우클릭해도 안 숨음', async () => {
    await setToggle(t, A, '#progOfficeModeToggle', false);
    await t.enterDesk(A);
    await A.w.click('#myStatusChipBtn', { button: 'right' });
    await t.wait(800);
    t.check(!(await A.w.evaluate(() => document.body.classList.contains('office-hidden'))), '회사원 모드가 꺼졌는데 숨음');
  });
});
