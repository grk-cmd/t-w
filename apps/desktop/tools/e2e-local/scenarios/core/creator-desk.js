// 캐릭터 만들기 · 책상 세팅 · 프리셋
// 런처 빈 칸 + → 인간 → 생성기에서 «다음» 으로 책상 단계까지 → 책상 색 · 크기를 바꾸고 📐 프리셋 1번에 저장(우클릭)
// → 색을 다른 것으로 바꾼 뒤 프리셋 1번을 누르면 저장한 색 · 크기로 돌아온다 → 완성 → 서버 보관함 def 에 그 책상 색 · 크기 · 사람 종족.
// 다시 켜도 프리셋 1번이 남아 있다(이 PC 계정 칸).
'use strict';
const { run } = require('./_kit.js');

const COLOR_A = '#3366cc', COLOR_B = '#cc3333', SCALE_A = '0.25';
// 색 · 슬라이더 칸은 fill 로 못 넣는다 — 값을 넣고 앱이 듣는 input · change 를 쏜다
const setVal = (A, sel, v) => A.w.evaluate(({ sel, v }) => {
  const e = document.querySelector(sel); e.value = v;
  e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
}, { sel, v });
const presetSlot = (A, n) => A.w.locator('#crPresetSlots button').nth(n - 1);

run('creator-desk', async (t) => {
  const A = await t.newUser('a');
  await t.step('+ → 인간 → «책상 세팅» 탭', async () => {
    await t.poll(async () => { if(await t.shown(A, '#raceHuman')) return true; await A.w.click('#lcEmpty'); await t.wait(1500); return t.shown(A, '#raceHuman'); }, 20000, '종족 고르기 창');
    await A.w.click('#raceHuman');
    await A.w.locator('#crNext').waitFor({ state: 'visible', timeout: 20000 });
    // 생성기 위 탭(캐릭터 · 책상 · 좌석 세팅) 가운데 «책상 세팅»
    await A.w.click('[data-stg="1"]');
    await A.w.locator('#deskColor').waitFor({ state: 'visible', timeout: 10000 });
  });
  await t.step('책상 색 · 크기 바꾸고 프리셋 1번에 저장', async () => {
    await setVal(A, '#deskColor', COLOR_A);
    await setVal(A, '#deskScale', SCALE_A);
    await A.w.click('#crPresetBtn');
    await presetSlot(A, 1).waitFor({ state: 'visible', timeout: 5000 });
    await presetSlot(A, 1).click({ button: 'right' });
    await A.w.locator('.cr-preset-ctx >> text=지금 세팅을 여기 저장').click();
    await t.poll(async () => /프리셋 1번에 저장했어요/.test(await A.w.textContent('#toast')), 5000, '저장 알림');
    t.check(/✓/.test(await presetSlot(A, 1).textContent()), '1번 칸에 ✓ 가 없음');
  });
  await t.step('색을 바꾼 뒤 프리셋 1번 → 저장한 색 · 크기로', async () => {
    await setVal(A, '#deskColor', COLOR_B);
    await setVal(A, '#deskScale', '0.1');
    if(!(await presetSlot(A, 1).isVisible())) await A.w.click('#crPresetBtn');
    await presetSlot(A, 1).click();
    await t.poll(async () => (await A.w.inputValue('#deskColor')).toLowerCase() === COLOR_A, 5000, '책상 색 ' + COLOR_A);
    t.check(Math.abs(Number(await A.w.inputValue('#deskScale')) - Number(SCALE_A)) < 0.01, '책상 크기 ' + await A.w.inputValue('#deskScale'));
    await A.w.keyboard.press('Escape').catch(() => {});
  });
  await t.step('완성 → 서버 보관함 def 에 사람 · 책상 색 · 크기', async () => {
    for(let i = 0; i < 20 && !(await t.shown(A, '#crDone')); i++){ await A.w.click('#crNext'); await t.wait(400); }
    await A.w.click('#crDone');
    await t.poll(async () => /슬롯에 저장했어요/.test(await A.w.textContent('#toast')), 15000, '«슬롯에 저장했어요»');
    const id = await t.poll(async () => { const x = await t.api(A, 'GET', '/v2/me/avatars'); return x.body.data.slots[0]; }, 15000, '서버 슬롯 0');
    const def = (await t.api(A, 'GET', '/v2/me/avatars/' + id)).body.data.def;
    t.note('def ' + JSON.stringify({ race: def.race, deskColor: def.deskColor, deskScale: def.deskScale }));
    t.check(String(def.deskColor).toLowerCase() === COLOR_A, '서버 책상 색 ' + def.deskColor);
    t.check(Math.abs(Number(def.deskScale) - Number(SCALE_A)) < 0.01, '서버 책상 크기 ' + def.deskScale);
    t.check(!def.animal, '사람으로 만들었는데 동물로 저장됨');
    await t.shot(A, '01-launcher');
  });
  await t.step('다시 켜도 프리셋 1번이 남음', async () => {
    await t.relaunch(A);
    await t.waitLoggedIn(A);
    await A.w.click('#lcGear');
    await A.w.click('#lcEdit');
    await A.w.locator('#crPresetBtn').waitFor({ state: 'visible', timeout: 20000 });
    await A.w.click('#crPresetBtn');
    await presetSlot(A, 1).waitFor({ state: 'visible', timeout: 5000 });
    t.check(/✓/.test(await presetSlot(A, 1).textContent()), '다시 켠 뒤 1번 칸이 비어 있음');
  });
});
