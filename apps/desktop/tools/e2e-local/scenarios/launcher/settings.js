// 설정 창(런처 ⚙️ 설정) — 탭 · 판 표시 · 테마 · 화질 · 회사원 모드 · 닫기 · 다시 켠 뒤 그대로
// 판정: 탭마다 그 구획만 보임 · 판 줄이 이 앱 판(app.getVersion — 시험용 판을 넣어 확인) · 테마는 <html data-theme> · 화질 안내 문구 · 토글 글 · 다시 켜도 유지
// 자동 실행 토글은 이 PC 의 로그인 항목을 바꾸므로 누르지 않는다
'use strict';
const K = require('../account/_kit.js');
const VER = '0.13.77';

K.scenario('settings', async (t) => {
  const a = await t.app('pc', { version: VER });
  await t.step('가입', () => K.signupUi(t, a));
  const open = async () => {
    await a.w.click('#lcProgSettingsBtn');
    await K.waitShown(a.w, '#programSettingsOverlay');
  };
  const tab = async (name) => {
    await a.w.click('#progTabBtn' + name);
    for(const n of ['License', 'Display', 'System']){
      const on = await K.shown(a.w, '#progTab' + n);
      if(on !== (n === name)) throw new Error(name + ' 탭인데 ' + n + ' 구획 보임=' + on);
    }
  };
  await t.step('열기 · 탭 셋이 서로 바뀐다', async () => {
    await open();
    await tab('License'); await tab('Display'); await tab('System');
  });
  await t.step('시스템 탭 — 판 줄이 이 앱 판', async () => {
    await K.waitFor(async () => (await K.text(a.w, '#progVersionText')) === 'v' + VER, 5000, 'v' + VER);
  });
  await t.step('회사원 모드 켜기 → 켜짐', async () => {
    if((await K.text(a.w, '#progOfficeModeToggle')) !== '꺼짐') throw new Error('처음부터 켜짐');
    await a.w.click('#progOfficeModeToggle');
    await K.waitFor(async () => (await K.text(a.w, '#progOfficeModeToggle')) === '켜짐', 5000, '켜짐');
  });
  await t.step('모니터 탭 — 테마 «버블» · 화질 «가볍게»', async () => {
    await tab('Display');
    await a.w.click('#themeOptBubble');
    await K.waitFor(() => a.w.evaluate(() => document.documentElement.getAttribute('data-theme') === 'bubble'), 5000, 'data-theme=bubble');
    await a.w.click('#progQualityRow [data-q="light"]');
    await K.waitFor(async () => (await K.text(a.w, '#progQualityHint') || '').startsWith('해상도를 낮추고 테두리 다듬기를 꺼서'), 5000, '가볍게 안내');
    if(!(await a.w.evaluate(() => document.querySelector('#progQualityRow [data-q="light"]').classList.contains('current')))) throw new Error('«가볍게» 가 골라진 표시가 아님');
  });
  await t.step('[닫기] → 창이 닫힌다', async () => {
    await a.w.click('#progSettingsCloseBtn');
    await K.waitFor(async () => !(await K.shown(a.w, '#programSettingsOverlay')), 5000, '닫힘');
  });
  await t.step('다시 켜도 테마 · 화질 · 회사원 모드 그대로', async () => {
    await a.quit();
    await a.launch();
    await K.waitEntered(a);
    if(!(await a.w.evaluate(() => document.documentElement.getAttribute('data-theme') === 'bubble'))) throw new Error('테마가 돌아감');
    await open();
    await tab('Display');
    if(!(await a.w.evaluate(() => document.querySelector('#progQualityRow [data-q="light"]').classList.contains('current')))) throw new Error('화질이 돌아감');
    await tab('System');
    await K.waitFor(async () => (await K.text(a.w, '#progOfficeModeToggle')) === '켜짐', 5000, '회사원 모드 켜짐 유지');
  });
});
