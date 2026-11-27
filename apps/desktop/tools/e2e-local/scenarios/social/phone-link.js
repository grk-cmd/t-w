// 📱 폰 · 태블릿 연결 — QR 창(키 만들기) · 폰 쪽 신호는 폰 자동화가 부르는 API 를 그대로(POST /v2/focus/mobile-link/state · X-Mobile-Key)
// → PC 화면 «📱 앱 사용 중» · 끄면 «쉬는 중» · 연결 끊기(두 번 누르기) 뒤에는 그 키가 거절된다
// 키는 [복사] 가 클립보드에 쓰는 값을 받는다(이 PC 클립보드를 건드리지 않게 렌더러의 clipboard.writeText 만 가로챈다)
'use strict';
const { scenario, assert, enterDesk, openSettings } = require('./_kit.js');
const { API } = require('../../lib.js');

async function phone(key, on, app){
  const r = await fetch(API + '/v2/focus/mobile-link/state', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mobile-Key': key }, body: JSON.stringify({ on, app }) });
  return { status: r.status, body: await r.text() };
}

scenario('phone-link', async (t) => {
  const a = await t.user('a', { name: '에이' });
  let key;
  await t.step('준비: 책상 모드 › ⚙ 설정 — «연결 안 됨»', async () => {
    await enterDesk(a);
    await openSettings(a);
    assert((await a.text('#fsMobMain')) === '연결 안 됨', '처음 상태 ' + await a.text('#fsMobMain'));
  });

  await t.step('QR로 연결하기 → 키 생김 · [복사] 로 키 받기', async () => {
    await a.eval(() => document.getElementById('fsMobQr').click());
    await a.until(() => document.getElementById('mobLinkOverlay').classList.contains('on'), null, { what: 'QR 창' });
    assert(a.sawReq(/^POST \/v2\/me\/focus\/mobile-link 200$/), '키 만들기 API');
    await a.eval(() => { window.__twCopied = null; navigator.clipboard.writeText = async (s) => { window.__twCopied = s; }; });
    await a.eval(() => document.getElementById('mobLinkCopy').click());
    key = await a.until(() => window.__twCopied, null, { what: '복사한 키' });
    const shown = await a.text('#mobLinkKey');
    assert(shown.endsWith(key.slice(-4)), `창의 키 끝 ${shown} · 복사 ${key.slice(-4)}`);
    await a.eval(() => document.getElementById('mobLinkDone').click());
    assert((await a.text('#fsMobQr')) === 'QR 다시 보기', 'QR 단추 글');
  });

  await t.step('폰: 앱 켬 신호 → PC «📱 열품타 사용 중»', async () => {
    const r = await phone(key, true, '열품타');
    assert(r.status === 200, '폰 신호 ' + r.status + ' ' + r.body);
    const m = await a.until(() => { const e = document.getElementById('fsMobMain'); return /사용 중/.test(e.textContent) && e.textContent; }, null, { timeout: 20000, what: '사용 중' });
    assert(m === '📱 열품타 사용 중', '상태 ' + m);
    assert(/포커스 시간이 쌓이고 있어요/.test(await a.text('#fsMobSub')), '보조 글 ' + await a.text('#fsMobSub'));
  });

  await t.step('폰: 앱 끔 → «연결됨 · 폰에서 쉬는 중»', async () => {
    const r = await phone(key, false, '열품타');
    assert(r.status === 200, '폰 신호 ' + r.status);
    await a.until(() => document.getElementById('fsMobMain').textContent === '연결됨 · 폰에서 쉬는 중', null, { timeout: 20000, what: '쉬는 중' });
  });

  await t.step('잘못된 키는 거절', async () => {
    const r = await phone('wrong-' + key, true, 'x');
    assert(r.status >= 400, '잘못된 키가 받아짐 ' + r.status);
  });

  await t.step('연결 끊기(두 번 누르기) → 그 키로 보낸 신호가 거절된다', async () => {
    await a.eval(() => document.getElementById('fsMobUnlink').click());
    assert((await a.text('#fsMobUnlink')).includes('한 번 더'), '첫 누름 글');
    await a.eval(() => document.getElementById('fsMobUnlink').click());
    await a.until(() => document.getElementById('fsMobMain').textContent === '연결 안 됨', null, { what: '연결 안 됨' });
    assert(a.sawReq(/^DELETE \/v2\/me\/focus\/mobile-link 20\d$/), '끊기 API');
    const r = await phone(key, true, '열품타');
    assert(r.status >= 400, '끊은 키가 받아짐 ' + r.status);
  });
});
