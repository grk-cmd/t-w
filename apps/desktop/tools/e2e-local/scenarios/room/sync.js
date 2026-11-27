// 방 동기화 — 내 캐릭터를 고치면(내 좌석 메뉴 › 캐릭터 편집 · 상의 색) 방에 def 가 퍼져 남 화면 내 좌석이 같은 모양으로
'use strict';
const kit = require('./_kit.js');

const COLOR = '#2050e0';
const remoteTop = () => { const s = seats.find((x) => x.remote); return s && s.charDef ? s.charDef.top : null; };

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 방 만들기 · b 참여 · 둘 다 책상 모드', async () => {
    const c = await a.createRoom({ title: '동기화' });
    await b.joinRoom(c);
    for(const u of [a, b]) await u.desk();
    await t.until('b 좌석 둘', async () => (await b.seats()).length === 2);
  });
  const before = await t.step('b 화면 a 의 상의 색 = a 슬롯 상의 색', async () => {
    const mine = await a.eval(() => seats.find((s) => !s.remote).charDef.top);
    await t.until('같음', async () => (await b.eval(remoteTop)) === mine, 15000);
    return mine;
  });
  t.note('처음 색 ' + before);
  await t.step('a: 내 좌석 메뉴 › 캐릭터 편집 → 상의 색 바꾸고 저장', async () => {
    await a.seatMenu(false);
    await a.seatMenuClick('🎨 캐릭터 편집');
    await t.until('생성기', () => a.eval(() => getComputedStyle(document.getElementById('crNext')).display !== 'none' || getComputedStyle(document.getElementById('crDone')).display !== 'none'), 20000);
    await a.eval((c) => { const el = document.getElementById('topColor'); el.value = c; el.dispatchEvent(new Event('input', { bubbles: true })); }, COLOR);
    for(let i = 0; i < 10; i++){
      if(await a.eval(() => getComputedStyle(document.getElementById('crDone')).display !== 'none')) break;
      await a.w.click('#crNext'); await kit.wait(300);
    }
    await a.w.click('#crDone');
    await t.until('a 좌석 색', () => a.eval((c) => seats.find((s) => !s.remote).charDef.top === c, COLOR), 15000);
  });
  await t.step('b 화면 a 좌석이 새 색으로(def 가 방에 퍼짐)', async () => {
    await t.until('b 가 받은 색', async () => (await b.eval(remoteTop)) === COLOR, 20000);
  });
});
