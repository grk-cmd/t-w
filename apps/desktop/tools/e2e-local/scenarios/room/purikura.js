// 스티커사진(purikura) — 투게더룸 대화창 📷 → 둘이 같은 세션에 자리 · 방장만 [시작] · 시작하면 하루 정원이 하나 줄고 둘 다 촬영 시작을 받음 · 나가기
'use strict';
const kit = require('./_kit.js');

const quota = async (u) => (await u.api('GET', '/v2/rooms/photo-quota')).body.data;

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  await t.step('a: 투게더룸 · b 참여 · 둘 다 책상 모드 · 대화창', async () => {
    const c = await a.createRoom({ channel: 'together', title: '사진' });
    await b.joinRoom(c);
    for(const u of [a, b]){ await u.desk(); await u.openChat(); }
  });
  const q0 = await t.step('하루 정원 읽기(GET /v2/rooms/photo-quota)', async () => {
    const q = await quota(a);
    t.note('정원 ' + JSON.stringify(q));
    t.ok('남은 수 있음', q && q.left > 0);
    return q;
  });
  await t.step('a 📷 → 촬영 창 · 자리 1', async () => {
    await a.w.click('#chatPhotoBtn');
    await t.until('a 창', () => a.shown('#pkOverlay'), 20000);
    await t.until('a 자리 받음(photoWelcome)', () => a.eval(() => { const P = purikuraUi.state(); return P.open && P.slot >= 0; }), 15000);
    t.eq('a 가 방장', await a.eval(() => purikuraUi.state().host), true);
  });
  await t.step('b 📷 → 같은 세션에 자리 · 둘 다 자리 둘', async () => {
    await b.w.click('#chatPhotoBtn');
    await t.until('b 창', () => b.shown('#pkOverlay'), 20000);
    await t.until('b 자리 받음', () => b.eval(() => { const P = purikuraUi.state(); return P.open && P.slot >= 0; }), 15000);
    t.eq('b 는 방장 아님', await b.eval(() => purikuraUi.state().host), false);
    const both = (u) => u.eval((codes) => { const m = JSON.stringify(purikuraUi.state().members); return codes.every((c) => m.includes(c)); }, [a.code, b.code]);
    await t.until('a 쪽 자리 둘', () => both(a), 15000);
    await t.until('b 쪽 자리 둘', () => both(b), 15000);
  });
  await t.step('[시작] 은 방장 a 만 누를 수 있음', async () => {
    await t.until('a 시작 켜짐', () => a.eval(() => !document.getElementById('pkStartBtn').disabled), 15000);
    t.eq('b 시작 꺼짐', await b.eval(() => document.getElementById('pkStartBtn').disabled), true);
  });
  await t.step('a [시작] → 둘 다 촬영 시작 · 정원 하나 줄어듦', async () => {
    await a.w.click('#pkStartBtn');
    await t.until('a 촬영 중', () => a.eval(() => purikuraUi.phase() === 'shooting'), 15000);
    await t.until('b 촬영 중', () => b.eval(() => purikuraUi.phase() === 'shooting'), 15000);
    const q1 = await quota(a);
    t.eq('남은 수', q1.left, q0.left - 1);
  });
  await t.step('b: 창 닫기(나가기) → a 쪽 자리에서 빠짐', async () => {
    await b.eval(() => { const x = document.getElementById('pkCloseBtn'); x.click(); });
    await t.until('b 창 닫힘', async () => !(await b.shown('#pkOverlay')), 15000);
    await t.until('a 쪽 자리에서 b 빠짐', () => a.eval((c) => !JSON.stringify(purikuraUi.state().members).includes(c), b.code), 15000);
  });
});
