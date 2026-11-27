// 🍅 뽀모도로 — 포커스 기록 창 서랍 · 집중 1분/휴식 1분 · 시작 · 일시정지 · 계속 · 시간이 다 되면 휴식으로(토스트) · 건너뛰기 · 다시 켜도 이어짐 · 멈춤
// 1분을 기다리지 않고 렌더러 시계를 앞으로 돌린다(뽀모는 끝나는 시각 endAt 으로 잰다)
'use strict';
const { scenario, assert, enterDesk, openFocusLog, shiftClock } = require('./_kit.js');

scenario('pomodoro', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const phase = () => a.text('#pomoPhase');
  const big = () => a.text('#pomoBig');

  await t.step('준비: 책상 모드 → 포커스 기록 창 → 🍅 서랍', async () => {
    await enterDesk(a);
    await openFocusLog(a);
    await a.eval(() => document.getElementById('pomoBtn').click());
    await a.until(() => document.getElementById('focusLogWin').classList.contains('pomo-on'), null, { what: '뽀모 서랍' });
  });

  await t.step('집중 1분 · 휴식 1분으로 시작 → 01:00 에서 줄어든다', async () => {
    // 시간 칸은 «직접» 프리셋에서만 열린다 — 프리셋 단추 중 숫자 프리셋이 아닌 것을 고른다
    const presets = await a.eval(() => [...document.querySelectorAll('#pomoPresetSeg button[data-p]')].map((b) => b.dataset.p));
    const custom = presets.find((p) => p !== '25' && p !== '50');
    assert(custom, '직접 프리셋 단추 ' + JSON.stringify(presets));
    await a.eval((p) => document.querySelector(`#pomoPresetSeg button[data-p="${p}"]`).click(), custom);
    await a.until(() => !document.getElementById('pomoInFocus').disabled, null, { what: '시간 칸 열림' });
    for(const [id, v] of [['pomoInFocus', '1'], ['pomoInShort', '1']]) await a.eval(([i, x]) => { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('change')); }, [id, v]);
    await a.eval(() => document.getElementById('pomoStart').click());
    await a.until(() => /🍅 집중 1 \//.test(document.getElementById('pomoPhase').textContent), null, { what: '집중 1' });
    const b0 = await big();
    assert(b0 === '01:00' || b0 === '00:59', '처음 남은 시간 ' + b0);
    await a.until(() => /^00:5/.test(document.getElementById('pomoBig').textContent), null, { what: '줄어듦' });
  });

  await t.step('일시정지 → 시간이 멈춘다 → 계속', async () => {
    await a.eval(() => document.getElementById('pomoPause').click());
    assert((await a.text('#pomoPause')).includes('계속'), '일시정지 글');
    const p1 = await big();
    await t.wait(2500);
    assert((await big()) === p1, `멈췄는데 줄어듦 ${p1} → ${await big()}`);
    await a.eval(() => document.getElementById('pomoPause').click());
    assert((await a.text('#pomoPause')).includes('일시정지'), '계속 글');
  });

  await t.step('1분이 지나면 휴식으로 · 토스트', async () => {
    await shiftClock(a, 61000);
    await a.until(() => /휴식/.test(document.getElementById('pomoPhase').textContent), null, { what: '휴식으로' });
    await a.until(() => /집중 끝! 휴식 1분/.test(document.getElementById('toast').textContent), null, { what: '집중 끝 토스트' });
    assert((await a.text('#pomoDots')).startsWith('🍅'), '끝낸 집중 표시 ' + await a.text('#pomoDots'));
  });

  await t.step('건너뛰기 → 다음 집중(2/4)', async () => {
    await a.eval(() => document.getElementById('pomoSkip').click());
    await a.until(() => /🍅 집중 2 \//.test(document.getElementById('pomoPhase').textContent), null, { what: '집중 2' });
  });

  await t.step('앱을 다시 켜도 진행이 이어진다', async () => {
    await a.relaunch();
    await enterDesk(a);
    await openFocusLog(a);
    await a.eval(() => document.getElementById('pomoBtn').click());
    const ph = await a.until(() => document.getElementById('pomoPhase').textContent, null, { what: '단계 글' });
    assert(/집중 2 \//.test(ph), '다시 켠 뒤 단계 ' + ph);
  });

  await t.step('멈춤 → 처음 화면', async () => {
    await a.eval(() => document.getElementById('pomoStop').click());
    await a.until(() => getComputedStyle(document.getElementById('pomoSetup')).display !== 'none', null, { what: '설정 화면으로' });
  });
});
