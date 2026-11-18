// 방 놀이 — 워킹룸: 🔫 러시안룰렛 · 😊 이모티콘(머리 위) / 투게더룸: 🎲 주사위(1 이면 내가 날아감 = 플라잉체어) · 💃 깜짝쇼(/80 세 번 → 남이 날아감) · 🪄 때리기 · 💣 레벨 문턱
// 주사위 · 룰렛 눈은 Math.random 을 정해 두고 굴린다(결과 갈래를 매번 같게)
'use strict';
const kit = require('./_kit.js');

const remoteFly = () => { const s = seats.find((x) => x.remote); return !!(s && s.fly); };
const myFly = () => { const s = seats.find((x) => !x.remote); return !!(s && s.fly); };
const fixRandom = (v) => { window.__e2eRandom = Math.random; Math.random = () => v; };
const realRandom = () => { if(window.__e2eRandom) Math.random = window.__e2eRandom; };

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  const wcode = await t.step('a: 워킹룸 만들기 · b 참여', async () => {
    const c = await a.createRoom({ channel: 'working', title: '놀이1' });
    await b.joinRoom(c);
    return c;
  });
  await t.step('둘 다 책상 모드', async () => {
    for(const u of [a, b]) await u.desk();
    await t.until('a 좌석 둘', async () => (await a.seats()).length === 2);
    await t.until('b 좌석 둘', async () => (await b.seats()).length === 2);
  });
  await t.step('워킹룸 😊 이모티콘 → b 화면 a 머리 위 말풍선에 그림', async () => {
    await a.eval(() => Presence.sendChat('[demoji:d06]'));
    await t.until('말풍선 그림', () => b.eval(() => seats.some((s) => s.remote && s.bubbleEl && /d06\./.test(s.bubbleEl.innerHTML))), 10000);
  });
  await t.step('워킹룸 🔫 룰렛(눈 4·4 — 안 날아감) → 내 머리 위 주사위 · b 에겐 가지만 워킹룸이라 말풍선 없음', async () => {
    await a.eval(fixRandom, 0.5);
    await a.w.click('#myChipMoreBtn');
    await t.until('룰렛 버튼', () => a.shown('#myRouletteBtn'));
    await a.w.click('#myRouletteBtn');
    await a.eval(realRandom);
    // [dice:N] 은 말풍선에서 주사위 그림(svg)으로 그려진다
    await t.until('a 말풍선 주사위 그림 둘', () => a.eval(() => seats.some((s) => !s.remote && s.bubbleEl && (s.bubbleEl.innerHTML.match(/<svg/g) || []).length === 2)), 10000);
    await t.until('b 가 받음(친구 chat)', () => b.eval(() => Object.values(Presence.friendsObj()).some((f) => f.chat && f.chat.text === '[dice:4][dice:4]')), 10000);
    await kit.wait(1000);
    // 워킹룸은 «일에 집중» — 기본 이모티콘 하나뿐인 글만 남의 머리 위에 뜬다(room-entry.js)
    t.eq('b 화면 주사위 말풍선 없음', await b.eval(() => seats.some((s) => s.remote && s.bubbleEl && s.bubbleEl.style.display !== 'none' && /<svg/.test(s.bubbleEl.innerHTML))), false);
    t.eq('a 안 날아감', await a.eval(myFly), false);
  });
  await t.step('워킹룸 나가기 → 투게더룸으로', async () => {
    await b.leaveRoom();
    await a.leaveRoom();
    const c = await a.createRoom({ channel: 'together', title: '놀이2' });
    await b.joinRoom(c);
    for(const u of [a, b]){ await u.desk(); await u.openChat(); }
    await t.until('a 좌석 둘', async () => (await a.seats()).length === 2);
    await t.until('b 좌석 둘', async () => (await b.seats()).length === 2);
    t.note('워킹룸 ' + wcode + ' → 투게더룸 ' + c);
  });
  await t.step('💣 레벨 문턱 — a(레벨 1)가 누르면 «레벨 100부터»', async () => {
    await a.w.click('#chatBombBtn');
    await a.toastSeen(/레벨 100부터/);
  });
  await t.step('🎲 주사위(눈 4·4) → b 대화창에 주사위 줄 · 안 날아감', async () => {
    await a.eval(fixRandom, 0.5);
    await a.w.click('#chatDiceBtn');
    await a.eval(realRandom);
    await t.until('b 대화창 주사위 그림', () => b.eval(() => /<svg/.test(document.getElementById('chatMessages').innerHTML)), 15000);
    await kit.wait(1500);
    t.eq('a 안 날아감', await a.eval(myFly), false);
  });
  // 깜짝쇼는 날아간 뒤 쉬는 시간(flyCool)이 있는 사람을 조용히 건너뛴다 — 그래서 주사위 1 보다 먼저 한다
  await t.step('💃 깜짝쇼 — b 가 /80 세 번 → 방의 다른 사람(a)이 날아감 · b 화면 · a 화면 둘 다', async () => {
    for(let i = 0; i < 3; i++){ await b.say('/80'); await kit.wait(700); }
    await t.until('b 화면에서 a 날아감', () => b.eval(remoteFly), 15000);
    await t.until('a 화면에서 내가 날아감', () => a.eval(myFly), 15000);
  });
  await t.step('🎲 주사위(눈 1·1) → a 가 날아감(플라잉체어) · b 화면에서도 a 가 날아감', async () => {
    await t.until('a 착지', async () => !(await a.eval(myFly)) && !(await b.eval(remoteFly)), 30000);
    await kit.wait(3500);   // 주사위 연타 쉬는 시간
    await a.eval(fixRandom, 0);
    await a.w.click('#chatDiceBtn');
    await a.eval(realRandom);
    await t.until('a 화면 a 날아감', () => a.eval(myFly), 8000);
    await t.until('b 화면 a 날아감', () => b.eval(remoteFly), 8000);
  });
  await t.step('🪄 때리기 — a 가 b 좌석 메뉴 «때리기» → 하루 남은 수가 줄고 b 에게 bonk 가 감', async () => {
    await t.until('착지', async () => !(await b.eval(remoteFly)) && !(await a.eval(myFly)), 30000);
    const before = await a.eval(() => tricksMod._bonkLeft());
    const items = await a.seatMenu(true);
    t.ok('메뉴에 때리기 ' + JSON.stringify(items), items.some((x) => x.startsWith('때리기')));
    const t0 = await b.eval(() => performance.now());
    await a.seatMenuClick('때리기');
    t.eq('남은 수', await a.eval(() => tricksMod._bonkLeft()), before - 1);
    // b 화면 내 좌석이 맞는 연출을 시작(bonkStart) — poke 'bonk:<때린 사람>' 을 받은 쪽만 한다
    await t.until('b 화면 내가 맞음', () => b.eval((x) => { const s = seats.find((y) => !y.remote); return (s.bonkStart || 0) > x; }, t0), 10000);
  });
  await t.step('b(프리미엄 아님) 메뉴엔 때리기 없음', async () => {
    const items = await b.seatMenu(true);
    t.ok('없음 ' + JSON.stringify(items), !items.some((x) => x.startsWith('때리기')));
    await b.closeSeatMenu();
  });
});
