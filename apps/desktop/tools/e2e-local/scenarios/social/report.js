// 🚩 신고하기 — 같은 방에서 상대 이름표 우클릭 › «🚩 신고하기…» › 사유(기타 · 글) › [신고] → 서버 신고 한 줄 · 내 화면에서 그 사람이 숨는다
// 관리자 목록(GET /v2/admin/reports?minReporters=1)에 그 사람이 오른다 — 관리자 쪽은 seed/social.sql 로 만든 관리자 c 로 본다
'use strict';
const { scenario, assert, makeCharacter, createRoom, makeAdmin, remoteSeats, wait } = require('./_kit.js');
const { enterDesk } = require('./_kit.js');

scenario('report', async (t) => {
  const a = await t.user('a', { name: '신고자' });
  const b = await t.user('b', { name: '비이' });
  let code;
  await t.step('준비: 캐릭터 · a 방 만들기 · b 같은 방', async () => {
    await makeCharacter(a);
    await makeCharacter(b);
    code = await createRoom(a);
    await b.eval((c) => roomEntryMod.startRoom(c), code);
    await b.until((c) => Presence.active() && Presence.roomCode() === c, code, { timeout: 30000, what: 'b 입장' });
    // 남의 좌석은 내 좌석이 있을 때만 만든다(room-entry presenceChanged) — 내 좌석은 책상 모드에서 생긴다
    await enterDesk(a);
    await enterDesk(b);
  });

  await t.step('a: b 이름표 우클릭 → 좌석 메뉴 → 🚩 신고하기…', async () => {
    // 좌석 우클릭은 3D 캔버스 위치 판정 뒤 seatMenuMod._seatCtxMenu(이벤트, 좌석) 를 부른다 — 캔버스 좌표 판정만 건너뛰고 같은 함수를 b 의 좌석으로 부른다
    let rs = [];
    for(let i = 0; i < 60; i++){ rs = await remoteSeats(a); if(Array.isArray(rs) && rs.length === 1 && rs[0].friendUserId) break; await wait(500); }
    t.note('a 가 본 남의 좌석 ' + JSON.stringify(rs));
    assert(Array.isArray(rs) && rs.length === 1 && rs[0].friendUserId, 'b 좌석 ' + JSON.stringify(rs));
    await a.eval(() => { const s = seats.find((x) => x.remote); seatMenuMod._seatCtxMenu(new MouseEvent('contextmenu', { clientX: 200, clientY: 200 }), s); });
    await a.w.locator('.seat-ctx', { hasText: '신고하기' }).waitFor({ state: 'visible', timeout: 10000 });
    await a.w.locator('.seat-ctx div, .seat-ctx button').filter({ hasText: '🚩 신고하기…' }).last().click();
    const q = await a.until(() => { const b2 = [...document.querySelectorAll('b')].find((e) => e.nextSibling && /님을 신고할까요/.test(e.nextSibling.textContent || '')); return b2 && b2.textContent; }, null, { what: '신고 창' });
    assert(q === '비이', '신고 대상 ' + q);
  });

  await t.step('a: 기타 · 사유 → [신고] → 토스트 · 숨김', async () => {
    await a.w.check('input[name="twReportKind"][value="etc"]');
    await a.w.fill('input[aria-label="기타 사유"]', 'e2e 신고 시험');
    await a.w.locator('button.lc-btn', { hasText: /^신고$/ }).click();
    await a.until(() => /신고했어요/.test(document.getElementById('toast').textContent), null, { what: '신고 토스트' });
    assert(a.sawReq(/^POST \/v2\/reports 20\d$/), '신고 API');
    // 숨김은 앱의 판정 한 곳(hidden-seats.js _seatHidden — 그리기 · 누르기가 이것을 본다)으로 본다
    const hidden = await a.until(() => { const s = seats.find((x) => x.remote); return !!s && hiddenSeatsMod._seatHidden(s); }, null, { what: 'b 좌석 숨김' });
    assert(hidden === true, 'b 좌석이 숨지 않음');
    assert(await a.eval((uc) => hiddenSeatsMod._reportHiddenUids.has(uc), b.me.userCode), '신고 숨김 목록에 b 없음');
  });

  await t.step('관리자 목록에 b 가 오른다', async () => {
    await makeAdmin(b);   // b 를 관리자로 써서 목록을 본다(신고 대상이 관리자여도 목록 판정은 같다)
    const r = await b.api('GET', '/v2/admin/reports?minReporters=1');
    const s = JSON.stringify(r.json.data);
    assert(r.status === 200 && s.includes(b.me.userCode), '관리자 신고 목록 ' + r.status + ' ' + s.slice(0, 300));
  });
});
