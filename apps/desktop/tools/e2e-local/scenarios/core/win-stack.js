// 앱 안 창 앞뒤 · ESC · 바깥 눌러 닫기
// 책상 모드에서 🏠 마이홈 창과 🕒 포커스 기록 창을 둘 다 열고, 누른 창이 맨 앞(z-index 가 더 큼)으로 오는지 · ESC 가 나중에 연 창부터 하나씩 닫는지.
// 런처에서 프로그램 설정 창: 안쪽을 누르면 그대로 · 바깥(어두운 배경)을 누르면 닫힌다.
// OS 창끼리의 앞뒤(다른 프로그램 위에 뜨기)는 시험 도구가 OS 창 순서를 못 읽어 여기서 보지 않는다 — 맨 위(alwaysOnTop)는 desk-mode.js 가 본다.
'use strict';
const { run } = require('./_kit.js');

const zOf = (A, id) => A.w.evaluate((i) => Number(getComputedStyle(document.getElementById(i)).zIndex) || 0, id);
const isOn = (A, sel) => A.w.evaluate((s) => { const el = document.querySelector(s); return !!el && el.classList.contains('on'); }, sel);

// 창 제목줄(위 8px) 한가운데를 누른다 — 버튼이 아닌 자리
async function pressHead(A, sel){
  const box = await A.w.locator(sel).boundingBox();
  await A.w.mouse.click(box.x + box.width / 2, box.y + 8);
}
const ON = (A) => A.w.evaluate(() => [document.getElementById('myHomeOverlay').classList.contains('on'), document.getElementById('focusLogOverlay').classList.contains('on')]);

run('win-stack', async (t) => {
  const A = await t.newUser('a');
  await t.step('캐릭터 만들기 · 책상 모드', async () => { await t.createCharacter(A); await t.enterDesk(A); });
  // 마이홈 겹창은 화면 전체를 덮어 칩 ▼ 메뉴를 가린다 — 포커스 기록을 먼저 연다
  await t.step('포커스 기록 다음 마이홈(⌘4 · F4) 열기 → 나중 연 마이홈이 앞', async () => {
    if(await A.w.evaluate(() => document.getElementById('myChipMore').classList.contains('hidden'))) await A.w.click('#myChipMoreBtn');
    await A.w.click('#myFocusLogMenuBtn');
    await t.poll(() => t.shown(A, '#focusLogWin'), 5000, '포커스 기록 창');
    await A.w.keyboard.press(process.platform === 'darwin' ? 'Meta+Digit4' : 'F4');
    await t.poll(() => t.shown(A, '#myHomeWin'), 8000, '마이홈 창');
    t.check((await zOf(A, 'myHomeOverlay')) > (await zOf(A, 'focusLogOverlay')), '나중에 연 마이홈이 뒤에 있음');
  });
  await t.step('누른 창이 맨 앞으로 — 기록 → 마이홈', async () => {
    // 기록 창이 마이홈 아래에 가렸으면 누를 수 없다 — 마이홈 창 밖으로 옮긴 뒤 누른다
    // 창은 transform 으로 가운데에 놓여 있다 — 잰 자리와의 차이만큼 옮겨 왼쪽 위(10, 10)에 둔다
    await A.w.evaluate(() => {
      const e = document.getElementById('focusLogWin'), r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      e.style.left = (parseFloat(cs.left) + 10 - r.x) + 'px'; e.style.top = (parseFloat(cs.top) + 10 - r.y) + 'px';
    });
    await pressHead(A, '#focusLogWin');
    t.check((await zOf(A, 'focusLogOverlay')) > (await zOf(A, 'myHomeOverlay')), '기록 창을 눌렀는데 뒤에 있음');
    await t.shot(A, '01-log-front');
    await pressHead(A, '#myHomeWin');
    t.check((await zOf(A, 'myHomeOverlay')) > (await zOf(A, 'focusLogOverlay')), '마이홈을 눌렀는데 뒤에 있음');
  });
  await t.step('ESC → 나중에 연 창(마이홈)부터 하나씩 닫힘', async () => {
    await A.w.keyboard.press('Escape');
    await t.poll(async () => { const [h, l] = await ON(A); return !h && l; }, 3000, '마이홈만 닫힘');
    await A.w.keyboard.press('Escape');
    await t.poll(async () => { const [h, l] = await ON(A); return !h && !l; }, 3000, '기록 창도 닫힘');
  });
  await t.step('런처 프로그램 설정 — 안쪽 누르면 그대로 · 바깥 누르면 닫힘', async () => {
    await t.leaveDesk(A);
    await A.w.click('#lcProgSettingsBtn');
    await t.poll(() => isOn(A, '#programSettingsOverlay'), 3000, '프로그램 설정 열림');
    await A.w.click('#progTabBtnSystem');
    await t.wait(300);
    t.check(await isOn(A, '#programSettingsOverlay'), '안쪽을 눌렀는데 닫힘');
    const box = await A.w.locator('#programSettingsOverlay > *').first().boundingBox();
    const vp = A.w.viewportSize() || await A.w.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    // 안쪽 상자 아래 · 위 빈 곳 가운데 넓은 쪽
    const y = (box.y > vp.height - (box.y + box.height)) ? box.y / 2 : (box.y + box.height + vp.height) / 2;
    await A.w.mouse.click(vp.width / 2, y);
    await t.poll(async () => !(await isOn(A, '#programSettingsOverlay')), 3000, '바깥을 눌러 닫힘');
  });
});
