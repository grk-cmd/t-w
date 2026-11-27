// 친구 접속 표시 — 온라인 · 오프라인으로 보이기 토글 · 🔒 고정(show_online · 다시 켜도 유지) · 앱을 끄면 오프라인
'use strict';
const { scenario, assert, befriend, openMyHome } = require('./_kit.js');

scenario('friend-presence', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  // b 화면에서 a 줄의 상태 — 'on' | 'off'
  const seen = (want) => b.until((w) => { const r = document.querySelector('#mhFriendList .mh-frow'); if(!r) return null; const on = !r.classList.contains('off') && r.querySelector('.mh-fsub').textContent === '온라인'; return (on ? 'on' : 'off') === w ? w : null; }, want, { timeout: 30000, what: 'b 화면의 a = ' + want });

  await t.step('b: a 가 온라인', async () => {
    await openMyHome(b, 'friend');
    await seen('on');
  });

  await t.step('a: 오프라인으로 보이기 → b 에게 오프라인', async () => {
    await openMyHome(a, 'friend');
    assert((await a.text('#mhPresenceToggle')).includes('온라인'), '처음 토글 글');
    await a.w.click('#mhPresenceToggle');
    await a.until(() => document.getElementById('mhPresenceToggle').textContent.includes('오프라인 (누르면 온라인)'), null, { what: '토글 글' });
    await seen('off');
  });

  await t.step('a: 다시 온라인 → b 에게 온라인', async () => {
    await a.w.click('#mhPresenceToggle');
    await seen('on');
  });

  await t.step('a: 오프라인 + 🔒 고정 → 서버 show_online=false', async () => {
    await a.w.click('#mhPresenceToggle');
    await seen('off');
    await a.w.click('#mhPresenceLock');
    let pref;
    for(let i = 0; i < 20; i++){
      pref = (await a.api('GET', '/v2/me')).json.data.presencePref;
      if(pref.locked && pref.online === false) break;
      await t.wait(300);
    }
    assert(pref.locked === true && pref.online === false, '서버 presencePref ' + JSON.stringify(pref));
  });

  await t.step('a: 앱을 다시 켜도 b 에게는 계속 오프라인', async () => {
    await a.relaunch();
    await openMyHome(a, 'friend');
    assert((await a.text('#mhPresenceToggle')).includes('오프라인'), '다시 켠 뒤 토글 ' + await a.text('#mhPresenceToggle'));
    await t.wait(5000);   // 다시 붙은 뒤 온라인 신호가 잘못 나가면 이 사이에 b 가 받는다
    await seen('off');
  });

  await t.step('a: 고정 풀고 온라인 → b 에게 온라인', async () => {
    await a.w.click('#mhPresenceLock');
    await a.w.click('#mhPresenceToggle');
    await seen('on');
  });

  await t.step('a: 앱을 끄면 b 에게 오프라인', async () => {
    await a.A.quit();
    await seen('off');
  });
});
