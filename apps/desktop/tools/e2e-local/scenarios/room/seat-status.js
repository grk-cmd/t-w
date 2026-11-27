// 좌석 배치(둘이 겹치지 않게 한 줄) · 좌석 우클릭 메뉴 · 숨기기 · 다시 보이기 · 상태칩으로 상태 바꾸기 → 남 화면에 상태 · 자리비움 투명
'use strict';
const kit = require('./_kit.js');

// 남의 좌석 몸에서 보이는 mesh 수(자리비움은 투명도 0 이라 mesh 를 끈다 — seat-opacity.js)
const visibleMeshes = () => {
  const s = seats.find((x) => x.remote);
  if(!s || !s.bodyWrap) return -1;
  let n = 0;
  s.bodyWrap.traverse((o) => { if(o.isMesh && o.visible) n++; });
  return n;
};

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  const code = await t.step('a: 방 만들기', () => a.createRoom({ title: '좌석' }));
  await t.step('b: 참여', () => b.joinRoom(code));
  await t.step('둘 다 책상 모드(실행 화면)', async () => {
    for(const u of [a, b]) await u.desk();
  });
  await t.step('좌석 배치 — 둘 · 나 하나 남 하나 · 자리가 겹치지 않음', async () => {
    for(const u of [a, b]){
      const s = await t.until(`${u.label} 좌석 둘`, async () => { const x = await u.seats(); return x.length === 2 && x; });
      t.eq(`${u.label} 남의 좌석 수`, s.filter((x) => x.remote).length, 1);
      t.ok(`${u.label} 두 좌석 x 가 다름 ${JSON.stringify(s.map((x) => x.x))}`, Math.abs(s[0].x - s[1].x) > 0.2);
    }
  });
  await t.step('a: 설정 › 캐릭터 «방에서 내 자리» 를 맨 오른쪽 고정 → 내 좌석이 줄 0번(맨 오른쪽)', async () => {
    await a.press('#fsRoomSeatModeToggle');
    t.eq('저장', await a.eval(() => localStorage.getItem('tw.roomSeatMode')), 'right');
    await t.until('0번이 나', () => a.eval(() => seats.length === 2 && !seats[0].remote), 5000);
    const x = await a.seats();
    t.ok('맨 오른쪽 ' + JSON.stringify(x.map((s) => [s.remote, s.x])), x[0].x > x[1].x);
    await a.press('#fsRoomSeatModeToggle');
    t.eq('되돌림', await a.eval(() => localStorage.getItem('tw.roomSeatMode')), 'row');
  });
  await t.step('a: 남의 좌석 우클릭 메뉴 — 친구 신청 · 숨기기 · 신고하기', async () => {
    const items = await a.seatMenu(true);
    t.note('메뉴 ' + JSON.stringify(items));
    for(const want of ['친구 신청', '숨기기', '신고하기']) t.ok('메뉴에 ' + want, items.some((x) => x.includes(want)));
  });
  await t.step('a: 숨기기 → b 캐릭터가 안 보임 · 메뉴가 «다시 보이기» 로', async () => {
    await a.seatMenuClick('🙈 숨기기');
    await t.until('숨김', async () => (await a.seats()).find((s) => s.remote).visible === false);
    const items = await a.seatMenu(true);
    t.ok('다시 보이기 ' + JSON.stringify(items), items.some((x) => x.includes('다시 보이기')));
    t.ok('숨긴 좌석엔 때리기 없음', !items.some((x) => x.includes('때리기')));
  });
  await t.step('a: 다시 보이기 → 보임', async () => {
    await a.seatMenuClick('🙉 다시 보이기');
    await t.until('보임', async () => (await a.seats()).find((s) => s.remote).visible === true);
  });
  await t.step('a: b 캐릭터를 눌러 쓰다듬기 → b 화면 내 캐릭터 위에 ♥', async () => {
    const p = await a.seatPoint(true);
    await a.w.mouse.click(p.x, p.y);
    await t.until('b 화면 떠오르는 이모지(pet 을 받음)', () => b.eval(() => floatersMod.floaters.length > 0), 10000);
  });
  await t.step('b: 내 좌석 우클릭 메뉴 — 캐릭터 편집 · 자리비움', async () => {
    const items = await b.seatMenu(false);
    t.note('메뉴 ' + JSON.stringify(items));
    t.ok('캐릭터 편집', items.some((x) => x.includes('캐릭터 편집')));
    t.ok('자리비움', items.some((x) => x.includes('자리비움')));
    await b.closeSeatMenu();
  });
  await t.step('b: 상태칩 → «밥 먹는 중» → a 가 받음', async () => {
    await b.w.click('#myStatusChipBtn');
    await b.w.click('#myStatusMenu .stItem[data-st="meal"]');
    await t.until('a 가 본 b 상태', async () => (await a.seats()).find((s) => s.remote).status === 'meal', 15000);
    t.eq('a 방 상태', Object.values((await a.room()).friends)[0].userStatus, 'meal');
  });
  await t.step('b: 내 좌석 메뉴 «자리비움» → a 화면에서 b 몸이 투명(mesh 꺼짐)', async () => {
    const before = await a.eval(visibleMeshes);
    t.ok('처음엔 보이는 mesh 가 있음 ' + before, before > 0);
    await b.seatMenu(false);
    await b.seatMenuClick('🫧 자리비움');
    await t.until('a 가 본 b 상태 away', async () => (await a.seats()).find((s) => s.remote).status === 'away', 15000);
    await t.until('b 몸 mesh 모두 꺼짐', async () => (await a.eval(visibleMeshes)) === 0, 10000);
  });
  await t.step('b: 상태칩 «온라인» → 다시 보임', async () => {
    await b.w.click('#myStatusChipBtn');
    await b.w.click('#myStatusMenu .stItem[data-st=""]');
    await t.until('상태 풀림', async () => (await a.seats()).find((s) => s.remote).status === null, 15000);
    await t.until('mesh 다시 보임', async () => (await a.eval(visibleMeshes)) > 0, 10000);
  });
  await t.step('b 가 나가면 a 화면 좌석 하나(접속 상태)', async () => {
    await b.eval(() => roomEntryMod.doLeaveRoom({ wipeChat: true }));
    await t.until('a 좌석 하나', async () => (await a.seats()).length === 1, 20000);
  });
});
