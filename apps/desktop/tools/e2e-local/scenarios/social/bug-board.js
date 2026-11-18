// 🐞 버그제보 게시판 — 쓰기(비공개) · 남에게는 잠긴 줄 · 관리자 답변 → 글쓴이에게 «새 답변» 표시 · 알림함 우편 · 열면 안 본 답 0
// 관리자 답변은 관리자 API(POST /v2/admin/bugs/{번호}/answers)로 단다 — 앱의 관리자 모드는 비밀번호 창(해시만 앱에 있음)을 거쳐야 켜져 시험이 켤 수 없다
'use strict';
const { scenario, assert, openMyHome, makeAdmin } = require('./_kit.js');

scenario('bug-board', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '제보자' });
  const tag = Date.now().toString(36);
  const TITLE = '버그 e2e ' + tag, BODY = '재현: 마이홈을 열면 ' + tag, ANS = '고쳤어요 ' + tag;
  let num;

  await t.step('b: 버그제보 탭 › 글쓰기(비공개) → 목록 · 서버', async () => {
    await openMyHome(b, 'bugreport');
    await b.w.click('#bbWriteBtn');
    await b.w.locator('#bbWTitle').waitFor({ state: 'visible', timeout: 10000 });
    await b.w.fill('#bbWTitle', TITLE);
    await b.w.fill('#bbWBody', BODY);
    await b.w.check('input[name="bbWVis"][value="prv"]');
    await b.w.click('#bbWSubmit');
    // 올리면 그 글이 열린다 — 글 번호는 열 때 부른 GET /v2/bugs/{번호}
    await b.until((x) => document.getElementById('bbDetailView').textContent.includes(x), BODY, { timeout: 20000, what: '올린 글 열림' });
    const line = b.A.reqs.find((l) => /^GET \/v2\/bugs\/[^ ]+ 200$/.test(l));
    num = decodeURIComponent(line.split(' ')[1].split('/').pop());
    await b.w.click('#bbDetailView [data-act="back"]');
    await b.until((x) => [...document.querySelectorAll('#bbRows .bb-row .bb-tt')].some((e) => e.textContent === x), TITLE, { timeout: 20000, what: '목록의 내 글' });
    const r = await b.api('GET', '/v2/bugs/' + num);
    assert(r.status === 200 && JSON.stringify(r.json.data).includes(BODY), '서버 글 ' + r.status);
    t.note('글 번호 ' + num);
  });

  await t.step('a(일반): 목록엔 잠긴 줄 · 본문은 서버가 막는다', async () => {
    await openMyHome(a, 'bugreport');
    await a.until((x) => [...document.querySelectorAll('#bbRows .bb-row.locked')].some((e) => e.textContent.includes(x)), TITLE, { timeout: 20000, what: '잠긴 줄' });
    const r = await a.api('GET', '/v2/bugs/' + num);
    assert(r.status >= 400 || !JSON.stringify(r.json).includes(BODY), '남이 비공개 본문을 읽음');
  });

  await t.step('a 를 관리자로 → 관리자 API 로 답변', async () => {
    await makeAdmin(a);
    const d = await a.api('GET', '/v2/bugs/' + encodeURIComponent(num));
    assert(d.status === 200 && JSON.stringify(d.json.data).includes(BODY), '관리자가 비공개 본문을 못 읽음 ' + d.status);
    const r = await a.api('POST', `/v2/admin/bugs/${encodeURIComponent(num)}/answers`, { requestId: 'e2e-ans-' + tag, seenLastAnswerAt: null, text: ANS, status: 'CHECKING', visibility: 'PRIVATE' });
    assert(r.status === 200, '답변 ' + r.status + ' ' + JSON.stringify(r.json));
  });

  await t.step('b: «새 답변» 배지 · 알림함 버그 우편 · 글을 열면 배지 꺼짐', async () => {
    const u = await b.api('GET', '/v2/me/bugs/unseen-count');
    assert(JSON.stringify(u.json.data).match(/1/), '안 본 답 수 ' + JSON.stringify(u.json.data));
    let mail;
    for(let i = 0; i < 30 && !mail; i++){
      const d = (await b.api('GET', '/v2/me/notifications?section=MAIL&limit=50')).json.data;
      mail = (d.items || d.notifications || d).find((m) => (m.tag === 'bug' || m.section === 'bug') || /답변/.test(m.title || ''));
      if(!mail) await t.wait(500);
    }
    assert(mail, '버그 답변 우편이 없음');
    await openMyHome(b, 'friend'); await openMyHome(b, 'bugreport');   // 탭을 다시 열면 목록을 새로 받는다
    await b.until((x) => { const r = [...document.querySelectorAll('#bbRows .bb-row')].find((e) => e.getAttribute('data-id') === x); return r && /새 답변/.test(r.textContent); }, String(num), { timeout: 30000, what: '«새 답변» 표시' });
    await b.w.click(`#bbRows .bb-row[data-id="${num}"]`);
    await b.until((x) => document.getElementById('bbDetailView').textContent.includes(x), ANS, { what: '답변 보임' });
    let n2;
    for(let i = 0; i < 20; i++){ n2 = JSON.stringify((await b.api('GET', '/v2/me/bugs/unseen-count')).json.data); if(!/[1-9]/.test(n2)) break; await t.wait(300); }
    assert(!/[1-9]/.test(n2), '열었는데 안 본 답이 남음 ' + n2);
  });
});
