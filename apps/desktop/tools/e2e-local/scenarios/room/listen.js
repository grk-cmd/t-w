// 같이 듣기 · DJ — 같이 듣기 방(만들 때만 정함) · 방장이 DJ(이름표 «🎧 DJ») · DJ 플레이리스트 첫 곡이 방 전원에게 · DJ 가 나가면 새 방장이 DJ
// 소리는 lib.js 조용히 켜기가 끈다(setAudioMuted)
'use strict';
const kit = require('./_kit.js');

const VIDEO = 'dQw4w9WgXcQ';
const TITLE = 'e2e 같이 듣기 곡';

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 서버 플레이리스트에 곡 하나(PUT /v2/me/playlist) → 다시 켜서 받음', async () => {
    const cur = await a.api('GET', '/v2/me/playlist');
    t.eq('플레이리스트 읽기', cur.status, 200);
    const r = await a.api('PUT', '/v2/me/playlist', { version: cur.body.data.version, sets: [{ name: '', tracks: [{ videoId: VIDEO, title: TITLE }] }], bio: '', listed: false, homePublic: false });
    t.eq('저장 ' + JSON.stringify(r.body).slice(0, 160), r.status, 200);
    await a.relaunch();
    await t.until('앱 목록에 곡', () => a.eval((v) => plMod.mine().some((x) => x.id === v), VIDEO), 30000);
  });
  const code = await t.step('a: «🎧 같이 듣기 방» 체크하고 방 만들기', () => a.createRoom({ title: '듣기', music: true }));
  await t.step('b: 참여 · 둘 다 책상 모드', async () => {
    await b.joinRoom(code);
    t.eq('meta.music', (await b.room()).meta.music, true);
    for(const u of [a, b]) await u.desk();
  });
  await t.step('DJ 는 방장 a — 양쪽 판정 · b 화면 a 이름표 «🎧 DJ»', async () => {
    await t.until('a DJ', () => a.eval((c) => listenUi.djId() === c, a.code));
    await t.until('b DJ', () => b.eval((c) => listenUi.djId() === c, a.code));
    await t.until('b 이름표 DJ', async () => ((await b.seats()).find((s) => s.remote) || {}).plate?.includes('🎧 DJ'), 10000);
  });
  await t.step('DJ 첫 곡이 서버 music 으로 b 에게', async () => {
    await b.w.click('#myPlBtn');
    await t.until('b 같이 듣기 창 곡 제목', async () => (await b.text('#lsTitle')) === TITLE, 15000);
    t.eq('b 단추 모양', await b.text('#myPlBtn'), '🎧');
  });
  await t.step('a 가 나가면 b 가 방장 · DJ', async () => {
    await a.eval(() => roomEntryMod.doLeaveRoom({ wipeChat: true }));
    await t.until('b 방장', async () => (await b.room()).host === b.code, 20000);
    await t.until('b DJ', () => b.eval((c) => listenUi.djId() === c, b.code), 15000);
  });
});
