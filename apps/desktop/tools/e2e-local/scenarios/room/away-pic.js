// 자리비움 그림 — 프리미엄만 등록(내 정보 › 그림 등록) · 서버 me.awayImage · 자리비움이면 남 화면에서 캐릭터 대신 그림
'use strict';
const kit = require('./_kit.js');

// 64×64 PNG 하나(앱 안 캔버스로 만들어 파일 고르기 칸에 넣는다)
const pngB64 = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3a8'; g.fillRect(8, 8, 48, 48);
  return c.toDataURL('image/png').split(',')[1];
};

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('b(프리미엄 아님): [그림 등록] 이 막힘', async () => {
    await b.w.click('#lcLoad');
    await t.until('내 정보', () => b.shown('#miAway'), 15000);
    t.eq('등록 단추 꺼짐', await b.eval(() => document.getElementById('miAwayPick').disabled), true);
    t.ok('안내 글', /프리미엄/.test(await b.text('#miAwayMsg')));
    await b.w.click('#miBack');
  });
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  const url = await t.step('a: 내 정보 › 그림 등록 → 올라가고 서버 me.awayImage 에 주소', async () => {
    await a.w.click('#lcLoad');
    await t.until('내 정보', () => a.shown('#miAway'), 15000);
    t.eq('등록 단추 켜짐', await a.eval(() => document.getElementById('miAwayPick').disabled), false);
    const b64 = await a.eval(pngB64);
    await a.w.setInputFiles('#miAwayFile', { name: 'away.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await t.until('미리보기 그림', () => a.shown('#miAwayImg'), 20000);
    const me = await t.until('서버 주소', async () => { const m = await a.whoami(); return m.awayImage && m.awayImage.url && m; }, 15000);
    t.ok('Storage 주소 ' + me.awayImage.url.slice(0, 80), /^https:\/\/firebasestorage\.googleapis\.com\//.test(me.awayImage.url));
    return me.awayImage.url;
  });
  await t.step('a: 내 정보 닫기(← 단추)', async () => {
    await a.w.click('#miBack');
    await t.until('닫힘', () => a.eval(() => !myInfoMod._miIsOpen()), 5000);
  });
  const code = await t.step('a: 방 만들기 · b 참여 · 둘 다 책상 모드', async () => {
    const c = await a.createRoom({ title: '비움' });
    await b.joinRoom(c);
    for(const u of [a, b]) await u.desk();
    return c;
  });
  t.note('방 ' + code);
  await t.step('a: 자리비움 → b 화면에서 a 자리에 그 그림(캐릭터 대신)', async () => {
    await a.w.click('#myStatusChipBtn');
    await a.w.click('#myStatusMenu .stItem[data-st="away"]');
    await t.until('b 가 받은 그림 주소', async () => ((await b.seats()).find((s) => s.remote) || {}).awayImg === url, 15000);
    await t.until('b 화면 그림 스프라이트 보임', () => b.eval(() => { const s = seats.find((x) => x.remote); return !!(s && s._awaySprite && s._awaySprite.visible); }), 20000);
  });
  await t.step('a: 온라인으로 → 그림 내려감', async () => {
    await a.w.click('#myStatusChipBtn');
    await a.w.click('#myStatusMenu .stItem[data-st=""]');
    await t.until('스프라이트 숨김', () => b.eval(() => { const s = seats.find((x) => x.remote); return !(s._awaySprite && s._awaySprite.visible); }), 15000);
  });
  await t.step('a: [기본으로] → 서버 그림 지움', async () => {
    await a.eval(() => document.getElementById('miAwayReset').click());
    await t.until('서버 awayImage 없음', async () => { const m = await a.whoami(); return !(m.awayImage && m.awayImage.url); }, 15000);
  });
});
