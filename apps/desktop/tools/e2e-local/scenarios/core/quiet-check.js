// 조용한 창이 실제로 지켜지는가 — 켜기 · 가입 · 책상 모드(맨 위 · 화면 덮기)를 거치는 동안 실제 창은 늘 화면 밖 · 투명 · 포커스 없음.
// 앱이 setBounds · setAlwaysOnTop · show · focus 를 불러도 덮개가 막는지 본다(lib.js quietWindows). TW_E2E_QUIET=0 이면 건너뛴다.
'use strict';
const { run } = require('./_kit.js');

// 모든 창의 실제 자리 · 투명도 · 포커스
const realState = (A) => A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({
  title: w.getTitle(), b: w.__e2eRealBounds ? w.__e2eRealBounds() : null, opacity: w.getOpacity(), focused: w.isFocused(),
})));

run('quiet-check', async (t) => {
  if(process.env.TW_E2E_QUIET === '0'){ t.note('TW_E2E_QUIET=0 — 건너뜀'); return; }
  const A = await t.newUser('a');
  const samples = [];
  const sample = async (when) => { const s = await realState(A); samples.push(when); for(const w of s){
    t.check(w.b, `[${when}] 덮개가 안 걸린 창: ${w.title}`);
    // 맥은 창을 화면 밖으로 다 못 밀고 가장자리에 조금 남긴다 — 화면(x ≥ 0) 안에 든 폭이 40px 이하면 밖으로 본다(남은 몫은 투명도 0 이 가린다)
    const inside = Math.max(0, w.b.x + w.b.width) - Math.max(0, w.b.x);
    t.check(inside <= 40, `[${when}] 창이 화면 안에 ${inside}px 들어옴: ${w.title} ${JSON.stringify(w.b)}`);
    t.check(w.opacity === 0, `[${when}] 창이 보임(투명도 ${w.opacity}): ${w.title}`);
    t.check(!w.focused, `[${when}] 창이 포커스를 가짐: ${w.title}`);
  } };
  await t.step('가입 뒤 런처', () => sample('launcher'));
  await t.step('캐릭터 · 책상 모드(앱이 화면 덮기 · 맨 위를 부름)', async () => {
    await t.createCharacter(A); await t.enterDesk(A);
    const s = await t.win(A);
    t.check(s.top, '앱이 맨 위를 부르지 않음(덮개의 기억 값)');
    await sample('desk');
  });
  await t.step('런처로 돌아옴', async () => { await t.leaveDesk(A); await sample('back'); });
  t.note('본 때: ' + samples.join(', '));
});
