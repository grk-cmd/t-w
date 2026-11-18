// 🌙 백색소음 — 플레이리스트 창의 소리 칸(⌨️ 키보드)을 고르면 내 기기에 기억 · 음량 슬라이더 · 같은 방 사람에게 내 소리 종류가 전해진다(방 payload noise)
// · 남의 소리 듣기 끄기 · 다시 켜도 고른 소리가 남는다
// 실제로 소리가 나는 때(타이핑 자세)는 OS 전역 키 입력(uiohook)으로 정해져 시험이 만들 수 없다 — 소리 합성 비율은 sim-noise 가 본다
'use strict';
const { scenario, assert, makeCharacter, createRoom, remoteSeats, wait } = require('./_kit.js');

scenario('white-noise', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  const openPl = async (u) => {
    await u.eval(() => document.getElementById('myPlBtn').click());
    await u.until(() => !document.getElementById('myPlaylistBox').classList.contains('hidden'), null, { what: '플레이리스트 창' });
    if(await u.eval(() => document.getElementById('myPlNoise').classList.contains('fold'))) await u.eval(() => document.getElementById('myNzFold').click());
  };
  let code;
  await t.step('준비: 캐릭터 · 같은 방', async () => {
    await makeCharacter(a);
    await makeCharacter(b);
    code = await createRoom(a);
    await b.eval((c) => roomEntryMod.startRoom(c), code);
    await b.until((c) => Presence.active() && Presence.roomCode() === c, code, { timeout: 30000, what: 'b 입장' });
  });

  await t.step('a: ⌨️ 키보드 고르기 · 음량 30 → 기억', async () => {
    await openPl(a);
    await a.eval(() => document.querySelector('#myPlNoise .nzK[data-nz="keyboard"]').click());
    await a.until(() => document.querySelector('#myPlNoise .nzK[data-nz="keyboard"]').classList.contains('on'), null, { what: '키보드 켜짐' });
    await a.eval(() => { const v = document.getElementById('myNzVol'); v.value = '30'; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change')); });   // 창이 런처 화면에선 화면 밖이라 슬라이더를 직접 옮긴다
    await a.until(() => document.getElementById('myNzPct').textContent === '30%', null, { what: '음량 30%' });
    const st = await a.eval(() => ({ kind: localStorage.getItem('tw.noise.kind'), vol: localStorage.getItem('tw.noise.vol') }));
    assert(st.kind === 'keyboard' && st.vol === '30', '기억 ' + JSON.stringify(st));
  });

  await t.step('b: 같은 방 a 좌석의 소리 종류가 keyboard', async () => {
    let rs = [];
    for(let i = 0; i < 60; i++){ rs = await remoteSeats(b); if(Array.isArray(rs) && rs.some((x) => x.noise)) break; await wait(500); }
    t.note('b 가 본 남의 좌석 ' + JSON.stringify(rs));
    const got = Array.isArray(rs) && rs.length === 1 ? rs[0].noise : null;
    assert(got === 'keyboard', '받은 종류 ' + JSON.stringify(rs));
    const g = await b.eval(() => TW_NOISE._gather(Date.now()));
    assert(g.others.length === 1 && g.others[0].kind === 'keyboard', '모은 남의 소리 ' + JSON.stringify(g));
  });

  await t.step('b: 남의 소리 끄기 → 모으지 않는다', async () => {
    await openPl(b);
    await b.eval(() => { const c = document.getElementById('myNzOthers'); c.checked = false; c.dispatchEvent(new Event('change')); });
    const g = await b.eval(() => TW_NOISE._gather(Date.now()));
    assert(g.withOthers === false && g.others.length === 0, '끈 뒤 ' + JSON.stringify(g));
  });

  await t.step('a: 끄기 → b 쪽에서도 사라진다', async () => {
    await a.eval(() => document.querySelector('#myPlNoise .nzK[data-nz=""]').click());
    await b.until(() => !seats.some((x) => x.remote && x.remoteNoise), null, { timeout: 30000, what: 'a 소리 꺼짐 전파' });
  });

  await t.step('다시 켜도 고른 소리가 남는다', async () => {
    await a.eval(() => document.querySelector('#myPlNoise .nzK[data-nz="page"]').click());
    await a.relaunch();
    const k = await a.until(() => TW_NOISE.kind(), null, { what: '다시 켠 뒤 종류' });
    assert(k === 'page', '다시 켠 뒤 ' + k);
  });
});
