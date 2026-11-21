// PC 등록 — 계정마다 서버가 정한 상한까지 · 다 찼으면 새 PC 는 «가장 오래된 기기를 지우고 이 PC를 쓸까요?» [취소] · [지우고 사용]
// 앞의 PC 들은 서버가 409 를 줄 때까지 API 로 등록한다(기기 id 만 다른 «PC» — 서버 판정은 앱 PC 와 같다 · 상한 숫자는 박지 않는다). 그다음이 진짜 앱이다
// 판정: 묻는 글(가장 오래된 기기 이름 · 등록일) · [취소] 는 아무것도 안 지우고 로그아웃 → 로그인 화면 · [지우고 사용] 은 그 기기만 지우고 이 PC 를 들임
'use strict';
const K = require('./_kit.js');

const dateKo = (iso) => { const d = new Date(iso); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };

K.scenario('device-limit', async (t) => {
  const acct = await t.step('API 로 계정', () => K.apiAccount());
  const others = [];
  const list = async () => ((await acct.api('GET', '/v2/me/devices')).data.devices || []).map((d) => d.deviceId).sort();
  let oldest;
  await t.step('다른 PC 를 상한까지 등록(API) — 서버가 409 USER_DEVICE_LIMIT 를 줄 때까지', async () => {
    const oses = ['windows', 'mac', 'linux'];
    for(let i = 0; ; i++){
      if(i > 20) throw new Error('20대를 넘게 등록해도 409 가 오지 않음');
      const id = 'e2e-dev-' + i + '-' + K.uniq(), os = oses[i % oses.length];
      const r = await acct.api('POST', '/v2/me/devices', { deviceId: id, session: 's-' + K.uniq(), os }, id);
      if(r.status === 409 && r.body && r.body.code === 'USER_DEVICE_LIMIT') break;
      if(r.status !== 200) throw new Error(id + ' 등록 ' + r.status + ' ' + JSON.stringify(r.body));
      others.push([id, os]);
      if(!oldest) oldest = r.data;
      await t.wait(50);
    }
    if(!others.length || (await list()).length !== others.length) throw new Error('기기 수가 등록한 수와 다름');
  });
  const pc = await t.app('pc-new');
  const q = () => K.text(pc.w, '#devLimitQ');
  const expectQ = '가장 오래된 기기 Windows PC (' + dateKo(oldest.claimedAt) + ' 등록) · 마지막 사용 ' + dateKo(oldest.lastSeenAt) + ' — 이 기기를 지우고 이 PC를 쓸까요?';
  // 로그아웃된 PC 에서 로그인하면 계정을 맞추며 다시 켠다 — 등록(과 확인창)은 다시 켠 뒤
  const login = async () => {
    await K.waitShown(pc.w, '#inviteGateFc', 30000);
    await K.fillChecked(pc.w, [['#inviteGateFc', acct.fc], ['#inviteGatePw', acct.pw]]);
    await pc.relaunchAfter(() => pc.w.click('#inviteGateFcBtn'));
    await K.waitShown(pc.w, '#devLimitQ', 30000);
  };
  await t.step('새 PC 로그인 → 서버 409 → 확인창(제목 · 묻는 글 · 단추 둘 · 기본 포커스 [취소])', async () => {
    await login();
    if((await q()) !== expectQ) throw new Error('묻는 글이 다름: ' + await q() + ' / 기대 ' + expectQ);
    if(!pc.A.reqs.some((r) => /^POST \/v2\/me\/devices 409/.test(r))) throw new Error('POST /v2/me/devices 409 없음');
    const d = await pc.w.evaluate(() => {
      const box = document.getElementById('devLimitQ').closest('[role="alertdialog"]');
      return { title: box.firstChild.textContent, no: box.querySelector('[data-a="no"]').textContent, ok: box.querySelector('[data-a="ok"]').textContent, focus: document.activeElement && document.activeElement.getAttribute('data-a') };
    });
    if(d.title !== '등록할 수 있는 PC를 다 썼어요' || /\d/.test(d.title) || d.no !== '취소' || d.ok !== '지우고 사용' || d.focus !== 'no') throw new Error('확인창 모양: ' + JSON.stringify(d));
  });
  await t.step('[취소] → 아무것도 안 지움 · 로그아웃 · 다시 켜기 → 로그인 화면', async () => {
    await pc.relaunchAfter(() => pc.w.click('[role="alertdialog"] [data-a="no"]'));
    await K.waitShown(pc.w, '#inviteGateFc', 30000);
    const now = await list();
    if(JSON.stringify(now) !== JSON.stringify(others.map((o) => o[0]).sort())) throw new Error('기기 목록이 바뀜 ' + now);
  });
  await t.step('다시 로그인 → [지우고 사용] → 가장 오래된 기기만 빠지고 이 PC 가 들어감', async () => {
    await login();
    if((await q()) !== expectQ) throw new Error('두 번째 묻는 글이 다름: ' + await q());
    await pc.w.click('[role="alertdialog"] [data-a="ok"]');
    await K.waitEntered(pc);
    const me = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
    const want = [me, ...others.slice(1).map((o) => o[0])].sort();
    await K.waitFor(async () => JSON.stringify(await list()) === JSON.stringify(want), 10000, '기기 목록 = 이 PC + 나머지');
  });
});
