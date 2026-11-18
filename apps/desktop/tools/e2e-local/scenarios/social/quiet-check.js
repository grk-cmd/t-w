// 🔇 조용한 창 확인 — 앱이 창을 옮기고 · 올리고 · 보여도(setBounds · setPosition · show · focus · moveTop · setAlwaysOnTop) 실제 창은 화면 밖에 남고 앱이 앞으로 나오지 않는다
// TW_E2E_QUIET=0 이면 확인할 것이 없어 건너뛴다
'use strict';
const { scenario, assert } = require('./_kit.js');

scenario('quiet-check', async (t) => {
  if(process.env.TW_E2E_QUIET === '0'){ t.note('TW_E2E_QUIET=0 — 건너뜀'); return; }
  const a = await t.user('a', { name: '에이' });
  await t.step('앱이 창을 화면 안으로 옮기고 올려도 실제 창은 화면 밖', async () => {
    const r = await a.A.app.evaluate(({ BrowserWindow, app, screen }) => {
      const area = screen.getPrimaryDisplay().workArea;
      const ws = BrowserWindow.getAllWindows();
      ws.forEach((w) => { w.setBounds({ x: area.x + 10, y: area.y + 10, width: 400, height: 600 }); w.setPosition(area.x + 20, area.y + 20); w.show(); w.focus(); w.moveTop(); w.setAlwaysOnTop(true); });
      const inside = (b) => b.x + b.width > area.x && b.x < area.x + area.width;
      return {
        n: ws.length,
        // 원래 getBounds 는 앱이 정한 자리를 돌려준다 — 실제 자리는 네이티브 창 사각형(getNormalBounds 도 덮였을 수 있어 화면 겹침은 isFocused · 투명도로 본다)
        focused: ws.some((w) => w.isFocused()),
        onTop: ws.some((w) => w.isAlwaysOnTop()),
        opacity: ws.map((w) => w.getOpacity()),
        appSays: ws.map((w) => w.getBounds()).map(inside),
        active: typeof app.isActive === 'function' ? app.isActive() : null,
      };
    });
    t.note(JSON.stringify(r));
    assert(r.n >= 1, '창이 없음');
    assert(!r.focused, '창이 포커스를 받음');
    assert(!r.onTop, '항상 위가 켜짐');
    assert(r.opacity.every((o) => o === 0), '창이 보임 ' + JSON.stringify(r.opacity));
    assert(r.active !== true, '앱이 앞으로 나옴');
    assert(r.appSays.every(Boolean), '앱이 읽는 자리는 앱이 정한 값이어야 함');   // 앱의 «지난 자리» 저장이 어긋나지 않게
  });
});
