// 투게더룸 대화 — 보내기 · 받기(두 사람) · 머리 위 말풍선 · 받을 때 알림음 · 복사 · 내 화면 지우기 · 방장 기록 삭제
'use strict';
const kit = require('../room/_kit.js');

// 소리 재생 수 · 복사한 글 — 시험이 이 PC 의 스피커 · 클립보드를 건드리지 않게 가로채 센다
const spy = () => {
  window.__e2ePlays = 0;
  HTMLMediaElement.prototype.play = function(){ window.__e2ePlays++; return Promise.resolve(); };
  window.__e2eClip = [];
  navigator.clipboard.writeText = async (s) => { window.__e2eClip.push(s); };
};

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  const code = await t.step('a: 투게더룸 만들기', () => a.createRoom({ channel: 'together', title: '대화방' }));
  await t.step('투게더룸 코드 · 채널', async () => {
    t.ok('PLAY- 코드 ' + code, /^PLAY-/.test(code));
    t.eq('채널', (await a.room()).meta.channel, 'togetherroom');
  });
  await t.step('b(라이선스 없음): 참여', () => b.joinRoom(code));
  await t.step('둘 다 책상 모드 · 대화창 열기', async () => {
    for(const u of [a, b]){ await u.desk(); await u.eval(spy); await u.openChat(); }
  });
  const m1 = 'a의말' + String(Date.now()).slice(-5);
  await t.step('a 가 보내면 b 대화창 · a 대화창에 보임', async () => {
    await a.say(m1);
    await t.until('b 대화창에 a 글', async () => (await b.chatText()).includes(m1), 15000);
    await t.until('a 대화창에 내 글', async () => (await a.chatText()).includes(m1), 15000);
    t.eq('입력칸 비움', await a.eval(() => document.getElementById('chatInput').value), '');
  });
  await t.step('b 화면: a 머리 위 말풍선에 그 글', async () => {
    await t.until('말풍선', () => b.eval((m) => seats.some((s) => s.remote && s.bubbleEl && s.bubbleEl.textContent.includes(m)), m1), 10000);
  });
  await t.step('b: 대화창을 닫아 두면 받을 때 알림음(열려 있으면 안 남)', async () => {
    t.eq('기본 알림음 켜짐', await b.eval(() => localStorage.getItem('tw.chatSfx') !== '0'), true);
    const open0 = await b.eval(() => window.__e2ePlays);
    await a.say('열림' + Date.now());
    await kit.wait(1500);
    t.eq('창이 열려 있으면 소리 없음', await b.eval(() => window.__e2ePlays), open0);
    await b.w.click('#chatCloseBtn');
    await t.until('b 창 닫힘', async () => !(await b.shown('#chatOverlay')));
    await kit.wait(1500);
    await a.say('소리' + Date.now());
    await t.until('소리 재생', async () => (await b.eval(() => window.__e2ePlays)) > open0, 10000);
    await b.openChat();
  });
  const m2 = 'b의답' + String(Date.now()).slice(-5);
  await t.step('b 가 보내면 a 가 받음', async () => {
    await b.say(m2);
    await t.until('a 대화창에 b 글', async () => (await a.chatText()).includes(m2), 15000);
  });
  await t.step('서버 기록(GET /v2/rooms/{코드}/chats)에 두 줄', async () => {
    const r = await a.api('GET', `/v2/rooms/${code}/chats?tab=GENERAL&limit=50`);
    t.eq('기록 응답', r.status, 200);
    const s = JSON.stringify(r.body);
    t.ok('기록에 둘 다 ' + s.slice(0, 200), s.includes(m1) && s.includes(m2));
  });
  await t.step('b: 메시지 우클릭 «이 메시지 복사»', async () => {
    await b.eval((m) => {
      const row = [...document.querySelectorAll('#chatMessages .cm-row[data-i]')].find((r) => r.textContent.includes(m));
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    }, m1);
    await t.until('복사 메뉴', () => b.eval(() => document.getElementById('chatCtx').classList.contains('on')));
    await b.w.click('#chatCtx [data-act="copyMsg"]');
    await t.until('복사한 글', async () => (await b.eval(() => window.__e2eClip)).some((x) => x.includes(m1)), 5000);
  });
  await t.step('b: 지우기(내 화면만) → 안 보임 · 되돌리기 → 다시 보임', async () => {
    await b.w.click('#chatClearMenu');
    await b.w.click('#chatClearNow');
    await t.until('가려짐', async () => !(await b.chatText()).includes(m1), 5000);
    await b.w.click('#chatClearMenu');
    await b.w.click('#chatClearUndo');
    await t.until('다시 보임', async () => (await b.chatText()).includes(m1), 5000);
  });
  await t.step('b(방장 아님): 기록 삭제 버튼 안 보임', async () => {
    t.eq('b 기록 삭제', await b.shown('#chatDelLog'), false);
  });
  await t.step('a(방장): 기록 삭제 → 확인 → 서버 기록 · b 대화창에서 사라짐', async () => {
    await a.eval(() => document.getElementById('chatDelLog').click());
    await t.until('확인창', () => a.shown('#chatDelOv'), 5000);
    await t.until('확인 버튼 켜짐', () => a.eval(() => !document.getElementById('chatDelOk').disabled), 10000);
    await a.w.click('#chatDelOk');
    await t.until('b 대화창에서 사라짐', async () => !(await b.chatText()).includes(m1), 15000);
    const r = await a.api('GET', `/v2/rooms/${code}/chats?tab=GENERAL&limit=50`);
    t.ok('서버 기록에 없음 ' + JSON.stringify(r.body).slice(0, 200), !JSON.stringify(r.body).includes(m1));
  });
});
