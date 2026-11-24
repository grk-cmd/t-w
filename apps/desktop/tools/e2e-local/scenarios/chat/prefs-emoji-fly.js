// 대화창 설정(투명도 · 글자 크기 · 알림음 끄기 · 소리 고르기 — 다시 켜도 남음) · 기본 이모티콘 · 🌊 날리기(남 화면을 가로지르는 글)
'use strict';
const kit = require('../room/_kit.js');

const playSpy = () => {
  window.__e2ePlays = 0;
  HTMLMediaElement.prototype.play = function(){ window.__e2ePlays++; return Promise.resolve(); };
};

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  const code = await t.step('a: 투게더룸 · b 참여 · 둘 다 대화창', async () => {
    const c = await a.createRoom({ channel: 'together', title: '설정' });
    await b.joinRoom(c);
    for(const u of [a, b]){ await u.desk(); await u.eval(playSpy); await u.openChat(); }
    return c;
  });
  await t.step('b: 투명도 60% → 창이 흐려지고 저장', async () => {
    await b.eval(() => { const s = document.getElementById('chatOpacity'); s.value = '60'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
    t.eq('창 투명도', await b.eval(() => document.getElementById('chatWindow').style.opacity), '0.6');
    t.eq('저장', await b.eval(() => localStorage.getItem('tw.chatOpacity')), '60');
  });
  await t.step('b: 보기 › 글자 크기 «아주 크게» → 대화 칸 16px', async () => {
    await b.w.click('#chatViewMenu');
    await b.w.click('#chatFsMenu');
    await b.w.click('#chatFsSub .chat-fs-item[data-fs="16"]');
    await t.until('글자 크기', () => b.eval(() => getComputedStyle(document.getElementById('chatMessages')).fontSize === '16px'), 5000);
    t.eq('저장', await b.eval(() => localStorage.getItem('tw.chatFontSize')), '16');
  });
  await t.step('b: 알림음 소리 2 고르고 · 끄기 → 받아도 소리 안 남', async () => {
    await b.eval(() => document.getElementById('chatViewMenu').classList.remove('open'));
    await b.w.click('#chatViewMenu');
    await b.w.click('#chatSfxList .chat-sfx-item[data-sfx="2"]');
    t.eq('소리 저장', await b.eval(() => localStorage.getItem('tw.chatSfxId')), '2');
    await b.w.click('#chatSfxToggle');
    t.eq('끔 저장', await b.eval(() => localStorage.getItem('tw.chatSfx')), '0');
    await b.eval(() => document.getElementById('chatViewMenu').classList.remove('open'));
    await b.w.click('#chatCloseBtn');   // 소리는 창을 닫아 뒀을 때만 난다
    await kit.wait(1500);
    const before = await b.eval(() => window.__e2ePlays);
    const m = '조용' + Date.now();
    await a.say(m);
    await t.until('받음(방 말풍선)', () => b.eval((x) => seats.some((s) => s.remote && s.bubbleEl && s.bubbleEl.textContent.includes(x)), m), 15000);
    await kit.wait(1000);
    t.eq('소리 수 그대로', await b.eval(() => window.__e2ePlays), before);
    await b.openChat();
  });
  await t.step('b: 다시 켜고 다시 들어가도 투명도 · 글자 크기 · 알림음 그대로', async () => {
    await b.relaunch();
    await b.joinRoom(code);
    await b.desk();
    await b.openChat();
    t.eq('투명도', await b.eval(() => document.getElementById('chatWindow').style.opacity), '0.6');
    t.eq('글자 크기', await b.eval(() => getComputedStyle(document.getElementById('chatMessages')).fontSize), '16px');
    t.eq('알림음 끔', await b.eval(() => localStorage.getItem('tw.chatSfx')), '0');
  });
  await t.step('a: 이모티콘 창의 기본 이모티콘 «/개죽» → b 대화창에 그 그림', async () => {
    await a.w.click('#chatEmojiBtn');
    await t.until('이모티콘 창', () => a.eval(() => document.getElementById('chatEmojiWin').classList.contains('on')));
    await a.w.click('#chatEmojiWin .emoji-chip[data-cmd="개죽"]');
    t.eq('입력칸', (await a.eval(() => document.getElementById('chatInput').value)).trim(), '/개죽');
    await a.w.press('#chatInput', 'Enter');
    await t.until('b 대화창 그림 d06', () => b.eval(() => !!document.querySelector('#chatMessages img[src*="d06"]')), 15000);
  });
  await t.step('a: 🌊 날리기 켜고 보내면 b 화면을 가로지르는 글', async () => {
    await a.w.check('#chatFlyChk');
    const m = '날아라' + String(Date.now()).slice(-4);
    await a.say(m);
    await t.until('b 날리기 칸', () => b.eval((x) => document.getElementById('flyLayer').textContent.includes(x), m), 15000);
    await a.w.uncheck('#chatFlyChk');
  });
});
