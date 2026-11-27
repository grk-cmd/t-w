// 방 초대 — 보내기(친구 고르기 창) · 받기 팝업 [수락] → 그 방 · [거절] · 3분 응답 없음 → 자동 거절
// 3분 대기는 받는 창의 Date.now 를 181초 앞으로 돌려 본다(팝업은 Date.now 로 남은 시간을 잰다)
'use strict';
const { scenario, assert, befriend, makeCharacter, createRoom } = require('./_kit.js');

scenario('room-invite', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  let code;
  await t.step('준비: 캐릭터 · a 가 워킹룸', async () => {
    await makeCharacter(a);
    await makeCharacter(b);
    code = await createRoom(a);
    t.note('방 ' + code);
  });
  const popup = () => b.until(() => { const o = [...document.querySelectorAll('.app-popup-ov')].find((e) => /방 초대/.test(e.textContent)); return o && o.textContent; }, null, { timeout: 20000, what: '초대 팝업' });
  const invite = async () => {
    if(!(await a.shown('#roomInvitePickOverlay'))){
      if(!(await a.shown('#inviteFriendBtn'))) await a.w.click('#lcInvite');
      await a.w.click('#inviteFriendBtn');
    }
    const btn = a.w.locator('#roomInvitePickList button').first();
    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await a.until(() => /비이/.test(document.getElementById('roomInvitePickList').textContent), null, { what: '친구 고르기 창의 b' });
    await btn.click();
    await a.until(() => /에게 초대를 보냈어요/.test(document.getElementById('toast').textContent), null, { what: '보냄 토스트' });
  };

  await t.step('a → b 초대 · b [수락] → a 의 방으로', async () => {
    await invite();
    const txt = await popup();
    assert(txt.includes('에이 님이 함께하자고 초대했어요') && /\d:\d\d 안에 응답이 없으면 자동으로 거절돼요/.test(txt), '팝업 글 ' + txt);
    await b.w.locator('.app-popup-ov [data-a="ok"]').click();
    const got = await b.until(() => (Presence.active() && Presence.roomCode()) || null, null, { timeout: 30000, what: 'b 방 입장' });
    assert(got === code, `b 방 ${got} ≠ ${code}`);
  });

  await t.step('b 가 방을 나간다', async () => {
    await b.w.click('#lcInvite');
    await b.w.click('#inviteLeave');
    await b.until(() => !Presence.active(), null, { what: 'b 나감' });
    await b.w.click('#inviteClose').catch(() => {});
  });

  await t.step('a → b 초대 · b [거절] → 방에 안 들어간다', async () => {
    await a.w.click('#roomInvitePickClose').catch(() => {});
    await invite();
    await popup();
    await b.w.locator('.app-popup-ov [data-a="no"]').click();
    await t.wait(3000);
    assert(!(await b.eval(() => Presence.active())), '거절했는데 방에 들어감');
  });

  await t.step('a → b 초대 · 3분 응답 없음 → 자동 거절', async () => {
    await a.w.click('#roomInvitePickClose').catch(() => {});
    await invite();
    await popup();
    await b.eval(() => { const now = Date.now.bind(Date); Date.now = () => now() + 181000; });
    await b.until(() => /3분 동안 응답이 없어 거절했어요/.test(document.getElementById('toast').textContent), null, { what: '자동 거절 토스트' });
    assert(!(await b.eval(() => [...document.querySelectorAll('.app-popup-ov')].some((e) => /방 초대/.test(e.textContent)))), '팝업이 남음');
    assert(!(await b.eval(() => Presence.active())), '자동 거절인데 방에 들어감');
  });
});
