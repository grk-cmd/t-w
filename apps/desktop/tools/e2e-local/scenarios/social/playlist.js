// 🎵 플레이리스트 — 창 열기 · 유튜브 링크 추가(제목 자동) · 서버 사본 · 친구가 [🌊] 우클릭으로 내 목록 파도타기
// 유튜브 제목 조회(oembed)는 바깥 사이트라 시험이 가짜 답을 준다
'use strict';
const { scenario, assert, befriend, answerPrompt } = require('./_kit.js');

scenario('playlist', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  const VID = 'dQw4w9WgXcQ', TITLE = 'e2e 노래 ' + Date.now().toString(36);
  await a.A.app.context().route(/youtube\.com\/oembed/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: TITLE }) }));
  const openPl = async (u) => {
    await u.eval(() => document.getElementById('myPlBtn').click());   // 상태칩 줄의 🎵 — 런처 화면에선 줄이 숨어 있어 단추를 직접 누른다
    await u.until(() => !document.getElementById('myPlaylistBox').classList.contains('hidden'), null, { what: '플레이리스트 창' });
  };

  await t.step('a: 🎵 창 열기 · ＋ 추가 → 링크 → 목록에 제목', async () => {
    await openPl(a);
    assert((await a.text('#myPlCount')) === '0/20', '처음 곡 수 ' + await a.text('#myPlCount'));
    await a.eval(() => document.getElementById('myPlAdd').click());
    await answerPrompt(a, 'https://youtu.be/' + VID);
    await a.until((x) => document.getElementById('myPlList').textContent.includes(x), TITLE, { what: '목록에 곡' });
    assert((await a.text('#myPlCount')) === '1/20', '곡 수 ' + await a.text('#myPlCount'));
  });

  await t.step('서버: 내 플레이리스트 사본에 곡(3초 뒤 올림)', async () => {
    let pl;
    for(let i = 0; i < 40; i++){ pl = JSON.stringify((await a.api('GET', '/v2/me/playlist')).json.data); if(pl.includes(VID)) break; await t.wait(300); }
    assert(pl.includes(VID) && pl.includes(TITLE), '서버 플레이리스트 ' + pl.slice(0, 300));
    const pub = JSON.stringify((await b.api('GET', `/v2/playlists/${a.me.userCode}`)).json);
    assert(pub.includes(VID), '친구가 읽은 a 목록 ' + pub.slice(0, 300));
  });

  await t.step('b: 🌊 우클릭 → 친구 a 고르기 → a 의 목록이 보인다', async () => {
    await openPl(b);
    await b.eval(() => { const e = document.getElementById('myPlPeek'); const r = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 2, clientY: r.y + 2, button: 2 })); });
    const row = b.w.locator('#myPlFriendPick .pfRow', { hasText: '에이' });
    await row.waitFor({ state: 'attached', timeout: 15000 });
    await row.evaluate((e) => e.click());
    await b.until((x) => document.getElementById('myPlList').textContent.includes(x), TITLE, { timeout: 15000, what: 'a 의 곡' });
    // 런처 화면에선 플레이리스트 줄 전체가 숨어 있어 화면 보임 판정은 늘 거짓 — 단추 자신의 표시만 본다
    assert(await b.eval(() => { const e = document.getElementById('myPlBack'); return !!e && !e.hidden && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }), '«← 내 목록» 이 안 보임');
    await b.eval(() => document.getElementById('myPlBack').click());
    await b.until((x) => !document.getElementById('myPlList').textContent.includes(x), TITLE, { what: '내 목록으로 돌아옴' });
  });
});
