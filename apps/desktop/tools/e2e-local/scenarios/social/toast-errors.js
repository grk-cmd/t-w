// 토스트 · 오류 번호 알림 — 보통 안내는 토스트 글 그대로(번호 없음) · 요청이 서버에 못 닿으면(이 앱만 오프라인 — lib.js net) «⚠️ … · 오류 E-…» 토스트 ·
// 오류 기록(tw-error.log)에 같은 번호 한 줄 · 실패한 요청은 화면에 남고 · 다시 연결하면 다시 누른 [수락] 이 된다
'use strict';
const fs = require('fs');
const path = require('path');
const { scenario, assert, openMyHome } = require('./_kit.js');

scenario('toast-errors', async (t) => {
  const a = await t.user('a', { name: '보내는이' });
  const b = await t.user('b', { name: '받는이' });

  await t.step('안내 토스트 — 없는 친구 코드', async () => {
    await openMyHome(a, 'friend');
    await a.w.click('#mhAddToggleBtn');
    await a.w.fill('#mhAddInput', 'ZZZZ');
    await a.w.click('#mhAddBtn');
    const tt = await a.until(() => { const e = document.getElementById('toast'); return e.textContent && getComputedStyle(e).opacity !== '0' && e.textContent; }, null, { what: '안내 토스트' });
    assert(!/오류 E-/.test(tt), '안내인데 오류 번호가 붙음 ' + tt);
    t.note('안내: ' + tt);
  });

  await t.step('준비: a → b 요청(API) · b 받은 요청 목록', async () => {
    const s = await a.api('POST', '/v2/me/friend-requests', { to: b.me.userCode });
    assert(s.status === 200, '요청 ' + s.status);
    // 요청 알림이 마이홈을 여는 사이에 오면 «👋 친구 요청» 창(myhome-init.js)이 탭을 가린다 — 알림(친구 탭 배지)을 받은 뒤 연다
    await b.until(() => { const e = document.querySelector('#myHomeTabs .mh-tab[data-tab="friend"] .mh-tab-badge'); return e && e.style.display !== 'none' && e.textContent; }, null, { what: '친구 탭 배지' });
    await openMyHome(b, 'friend');
    await b.until(() => document.querySelectorAll('#mhFmList .mh-req').length === 1, null, { what: '받은 요청 줄' });
  });

  let code = null;
  await t.step('오프라인 → [수락] → 오류 번호 토스트 · 요청은 남는다', async () => {
    await b.A.net(true);
    await b.w.click('#mhFmList .mh-req button.ok');
    const tt = await b.until(() => { const x = document.getElementById('toast').textContent; return /오류 E-[A-Z]+-\d\d/.test(x) && x; }, null, { what: '오류 토스트' });
    code = tt.match(/E-[A-Z]+-\d\d/)[0];
    t.note('오프라인 [수락] 토스트: ' + tt);
    assert(/^⚠️ .+ · 오류 E-[A-Z]+-\d\d$/.test(tt), '오류 토스트 모양 ' + tt);
    assert(b.sawReq(/^POST \/v2\/me\/friend-requests\/[^ ]+\/accept OFFLINE$/), '수락 요청이 오프라인으로 끝나지 않음 — ' + b.A.reqs.filter((l) => /accept/.test(l)).join(','));
    await b.A.net(false);
    await b.until(() => { const btn = document.querySelector('#mhFmList .mh-req button.ok'); return btn && !btn.disabled; }, null, { what: '줄이 남고 다시 누를 수 있음' });
    const rb = (await b.api('GET', '/v2/me/friend-requests')).json.data;
    assert(rb.received.length === 1, '서버 요청이 사라짐');
  });

  await t.step('오류 기록(tw-error.log)에 같은 번호 한 줄', async () => {
    const log = path.join(b.A.out, 'appdata', 'together-working-dev', 'tw-error.log');
    let txt = '';
    for(let i = 0; i < 20 && !txt.includes(code); i++){ try { txt = fs.readFileSync(log, 'utf8'); } catch(_){} await t.wait(300); }
    assert(txt.includes(code), 'tw-error.log 에 ' + code + ' 없음');
  });

  await t.step('다시 연결하면 다시 누른 [수락] 이 된다', async () => {
    await b.w.click('#mhFmList .mh-req button.ok');
    await b.until(() => /친구가 됐어요/.test(document.getElementById('toast').textContent), null, { what: '수락 토스트' });
    const fb = (await b.api('GET', '/v2/me/friends')).json.data;
    assert(fb.length === 1, '친구 수 ' + fb.length);
  });
});
