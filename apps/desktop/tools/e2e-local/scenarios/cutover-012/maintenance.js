// 런북 T+0 점검 켜기 — 운영 0.12.3 이 config/maintenance 를 받으면 무엇을 보이나
// ① 점검 끔: 사용자 동작(방 만들기 / 참여하기)에도 점검 창 없음
// ② 점검 켬(on · endsAt · message): 동작이 없으면 창 없음 → 동작이 서버를 부르면 «서버 점검 중» 창(문구 · 끝 시각) · «확인» 으로 닫힘 · 앱은 살아 있음
// ③ 점검 늘리기(endsAt · message 고침): 다음 동작에서 새 문구
// 결과: <결과 폴더>/steps.txt · 화면 NN-*.png · pc/net.txt · rtdb.txt
'use strict';
const k = require('./_kit.js');

const hm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

k.run('maintenance', async (t) => {
  await k.seedNormal(t);
  const A = t.newApp('pc');
  let w;
  await t.step('준비 — 0.12.3 규칙 · 점검 끔 · 로그인한 옛 사용자', async () => { const u = await k.prepareUser(t, A); w = u.w; return u.code; });

  await t.step('점검 끔 — «방 만들기 / 참여하기» 를 눌러도 점검 창 없음', async () => {
    await w.click('#lcInvite');
    await k.wait(2000);
    const s = await k.screen(w);
    if(s.maint) throw new Error('점검 창이 뜸: ' + s.maint.text);
    await w.click('#inviteClose');
  });

  const ends1 = Date.now() + 3 * 3600 * 1000;
  const msg1 = '서버를 새로 옮기고 있어요. ' + hm(ends1) + '쯤 끝나요. 끝나면 새 버전으로 업데이트해 주세요.';
  await t.step('T+0 점검 켜기(config/maintenance) — 사용자 동작이 없으면 창이 안 뜸', async () => {
    await t.db.set('config/maintenance', { on: true, endsAt: ends1, message: msg1 });
    await k.wait(3000);
    const s = await k.screen(w);
    if(s.maint) throw new Error('동작 없이 점검 창이 뜸: ' + s.maint.text);
  });

  await t.step('사용자 동작(방 만들기 / 참여하기)이 서버를 부르면 «서버 점검 중» 창 · 문구 · 끝 시각', async () => {
    await w.click('#lcInvite');
    const s = await k.until(async () => { const x = await k.screen(w); return x.maint ? x : null; }, 5000);
    if(!s) throw new Error('점검 창이 안 뜸');
    await t.shot(w, 'maint-on');
    if(!/^서버 점검 중/.test(s.maint.text)) throw new Error('제목이 다름: ' + s.maint.text);
    if(!s.maint.text.includes(msg1)) throw new Error('문구가 없음: ' + s.maint.text);
    if(!s.maint.text.includes(hm(ends1) + '쯤 끝날 예정이에요')) throw new Error('끝 시각이 없음: ' + s.maint.text);
    if(JSON.stringify(s.maint.buttons) !== '["확인"]') throw new Error('단추가 «확인» 하나가 아님: ' + s.maint.buttons);
    return s.maint.text.replace(/\s+/g, ' ').slice(0, 160);
  });

  await t.step('«확인» 을 누르면 닫히고 앱은 그대로(렌더러 살아 있음 · 런처 그대로)', async () => {
    await k.closeMaint(w);
    const s = await k.screen(w);
    if(s.maint) throw new Error('창이 안 닫힘');
    await k.alive(A, w);
    if(!(await w.isVisible('#launcher'))) throw new Error('런처가 사라짐');
    return '토스트 «' + s.toast + '»';
  });

  const ends2 = ends1 + 3600 * 1000;
  const msg2 = '점검이 길어지고 있어요. ' + hm(ends2) + '쯤 끝나요.';
  await t.step('점검 늘리기(endsAt · message 고침) — 다음 동작에서 새 문구', async () => {
    await t.db.set('config/maintenance', { on: true, endsAt: ends2, message: msg2 });
    await k.wait(1500);
    await w.click('#inviteClose').catch(() => {});
    await w.click('#lcInvite');
    const s = await k.until(async () => { const x = await k.screen(w); return x.maint && x.maint.text.includes(msg2) ? x : null; }, 5000);
    if(!s) throw new Error('새 문구가 안 보임: ' + JSON.stringify((await k.screen(w)).maint));
    if(!s.maint.text.includes(hm(ends2))) throw new Error('새 끝 시각이 없음');
    await t.shot(w, 'maint-extended');
    await k.closeMaint(w);
    await k.alive(A, w);
  });
});
