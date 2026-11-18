// 토스트 · 오류 번호 알림 — 보통 안내는 토스트 글 그대로 · 서버가 실패하면(시험이 그 요청 하나만 500 으로 돌려준다) «⚠️ … · 오류 E-FR-01» 토스트 ·
// 같은 번호는 잠깐 사이 한 번만 · 오류 기록(tw-error.log)에 번호 한 줄 · 실패한 요청은 화면에 남는다(다시 누르면 된다)
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
    await openMyHome(b, 'friend');
    await b.until(() => document.querySelectorAll('#mhFmList .mh-req').length === 1, null, { what: '받은 요청 줄' });
  });

  let hits = 0;
  await t.step('서버 500 → [수락] → «오류 E-FR-01» 토스트 · 요청은 남는다', async () => {
    await b.A.app.context().route(/\/v2\/me\/friend-requests\/[^/]+\/accept$/, (r) => { hits++; return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, code: 'INTERNAL_ERROR', message: 'e2e' }) }); });
    await b.w.click('#mhFmList .mh-req button.ok');
    const tt = await b.until(() => /오류 E-/.test(document.getElementById('toast').textContent) && document.getElementById('toast').textContent, null, { what: '오류 토스트' });
    assert(tt === '⚠️ 친구 요청을 수락하지 못했어요 · 오류 E-FR-01', '오류 토스트 ' + tt);
    assert(hits === 1, '수락 요청 수 ' + hits);
    await b.until(() => { const btn = document.querySelector('#mhFmList .mh-req button.ok'); return btn && !btn.disabled; }, null, { what: '줄이 남고 다시 누를 수 있음' });
    const rb = (await b.api('GET', '/v2/me/friend-requests')).json.data;
    assert(rb.received.length === 1, '서버 요청이 사라짐');
  });

  await t.step('오류 기록(tw-error.log)에 번호 한 줄', async () => {
    const log = path.join(b.A.out, 'appdata', 'together-working-dev', 'tw-error.log');
    let txt = '';
    for(let i = 0; i < 20 && !/E-FR-01/.test(txt); i++){ try { txt = fs.readFileSync(log, 'utf8'); } catch(_){} await t.wait(300); }
    assert(/E-FR-01/.test(txt), 'tw-error.log 에 E-FR-01 없음');
  });

  await t.step('길을 되돌리면 다시 누른 [수락] 이 된다', async () => {
    await b.A.app.context().unroute(/\/v2\/me\/friend-requests\/[^/]+\/accept$/);
    await b.w.click('#mhFmList .mh-req button.ok');
    await b.until(() => /친구가 됐어요/.test(document.getElementById('toast').textContent), null, { what: '수락 토스트' });
    const fb = (await b.api('GET', '/v2/me/friends')).json.data;
    assert(fb.length === 1, '친구 수 ' + fb.length);
  });
});
