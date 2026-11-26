// 런북 T+2 규칙 잠금 · T+145 점검 끄기 — 켜 둔 운영 0.12.3 이 컷오버 규칙(firebase-database-rules-cutover.json)을 만나면
// 준비(0.12.3 규칙): 로그인 · 라이선스 있는 사용자 · 캐릭터 1번 칸 저장(서버에 들어감) · 투게더룸에 들어가 있음
// T+0 점검 켬 → T+2 컷오버 규칙 → 로그인한 0.12.3 은 기기 세션 구독이 읽기 거부로 끊겨 «🖥️ 옛 버전 투게더워킹이 켜져 있어요» 창
//   (device-lost.js oldApp · [다시 시도] [앱 닫기] · 방에서 나감)을 띄운다 — 이 창이 사용자가 보는 것이다. 창을 남긴 채 화면을 찍고,
//   그 아래 기능은 사용자가 못 누르므로 시험만 창을 숨긴 뒤(앱 코드는 그대로)
//   캐릭터 저장(2번 칸) · 마이홈 자기소개 · 대화 보내기 — 셋 다 서버에 안 들어가야 하고(DB 그대로),
//   앱은 죽지 않고, 같은 경로를 계속 다시 쓰지 않는다(쓰기 시도를 30초 셈 — 경로 하나가 30초에 6번 넘으면 실패).
//   화면(점검 창 · 토스트 · 🔑 띠)은 단계 줄에 남긴다
// T+145 점검 끔(최소 버전은 0.12.1 그대로): «점검이 끝났어요» 창 · [지금 다시 켜기] [나중에]
'use strict';
const k = require('./_kit.js');

const MAX_PER_PATH_30S = 6;

k.run('rule-lock', async (t) => {
  await k.seedNormal(t);
  const A = t.newApp('pc');
  let w, u, room, slotsBefore;
  const seen = async () => { const s = await k.screen(w); return `점검 창 «${s.maint ? s.maint.text.split('\n')[0] : '없음'}» · 토스트 «${s.toast}» · 띠 «${s.band}»`; };

  await t.step('준비 — 0.12.3 규칙 · 로그인 · 라이선스 · 캐릭터 1번 칸 저장', async () => {
    u = await k.prepareUser(t, A, { premium: true });
    w = u.w;
    await k.createCharacter(w);
    const slots = await k.until(() => t.db.get(`users/${u.uid}/slots`), 10000);
    if(!slots) throw new Error('규칙 잠금 전인데 캐릭터가 서버에 안 들어감');
    slotsBefore = JSON.stringify(slots);
    return u.code;
  });

  await t.step('준비 — 투게더룸 만들어 들어가 있기', async () => {
    await w.click('#lcInvite');
    await w.click('#chCardTogether');
    room = await k.until(() => w.evaluate(() => { const el = [...document.querySelectorAll('#inviteOverlay b, #inviteOverlay strong')].map((e) => e.textContent).find((x) => /^PLAY-/.test(x)); return el || null; }), 20000);
    if(!room) throw new Error('방 코드가 안 보임');
    await w.locator('#inviteOverlay button:visible', { hasText: '닫기' }).click();
    const meta = await t.db.get(`rooms/${room}/_meta`);
    if(!meta) throw new Error('방이 서버에 없음');
    return room;
  });

  let lockAt;
  await t.step('T+0 점검 켬 · T+2 컷오버 규칙 올림', async () => {
    await t.db.set('config/maintenance', { on: true, endsAt: Date.now() + 3 * 3600 * 1000, message: '서버를 새로 옮기고 있어요.' });
    await t.db.rules(k.RULES_CUTOVER);
    lockAt = new Date().toISOString();
    await k.wait(2000);
    await k.alive(A, w);
    const what = await seen();
    await k.closeMaint(w);   // 방금 누른 «닫기» 1초 안에 나간 요청이 점검 창을 띄웠을 수 있다 — 다음 동작을 가리지 않게
    return what;
  });

  await t.step('T+2 직후 사용자가 보는 것 — «옛 버전 투게더워킹이 켜져 있어요» 창 · 방에서 나감', async () => {
    const s = await k.until(async () => { const x = await k.screen(w); return x.lost ? x : null; }, 15000);
    if(!s) throw new Error('창이 안 뜸 — ' + await seen());
    await t.shot(w, 'old-app-overlay');
    if(!/옛 버전 투게더워킹이 켜져 있어요/.test(s.lost.text)) throw new Error('제목이 다름: ' + s.lost.text);
    if(JSON.stringify(s.lost.buttons) !== '["다시 시도","앱 닫기"]') throw new Error('단추가 다름 ' + JSON.stringify(s.lost.buttons));
    await k.alive(A, w);
    return s.lost.text.replace(/\s+/g, ' ') + ' · 단추 ' + s.lost.buttons.join(' / ') + ' · ' + await seen();
  });

  await t.step('(시험만) 창을 숨김 — 사용자는 못 하는 길 · 아래 세 단계는 쓰기가 막히는지만 본다', async () => {
    await w.evaluate(() => { document.getElementById('deviceSessionOverlay').style.display = 'none'; });
  });

  await t.step('캐릭터 저장(2번 칸 새 캐릭터) — 서버에 안 들어감 · 앱 그대로', async () => {
    await k.closeMaint(w);
    await w.click('#lcNext');
    await k.createCharacter(w);
    await k.wait(3000);
    const shot = await t.shot(w, 'char-save');
    const what = await seen();
    await k.closeMaint(w);
    if(JSON.stringify(await t.db.get(`users/${u.uid}/slots`)) !== slotsBefore) throw new Error('잠근 뒤 캐릭터 칸이 서버에서 바뀜');
    await k.alive(A, w);
    const count = await w.evaluate(() => (document.getElementById('lcCount') || {}).textContent || '');
    return what + ' · 런처 칸 ' + count + ' · 서버 slots 그대로 · ' + shot.split('/').pop();
  });

  await t.step('마이홈 자기소개 저장 — 서버에 안 들어감 · 앱 그대로', async () => {
    await k.closeMaint(w);
    await w.click('#lcNameBtn');
    await k.closeMaint(w);
    await w.click('#mhBioBox');
    await w.keyboard.type('컷오버 중 쓴 자기소개');
    await w.click('#mhPostTitle').catch(() => {});
    await k.wait(6000);   // 자동 저장 디바운스(3초)보다 길게
    await t.shot(w, 'myhome-save');
    const what = await seen();
    await k.closeMaint(w);
    const home = JSON.stringify(await t.db.get(`users/${u.uid}`) || {});
    if(home.includes('컷오버 중 쓴 자기소개')) throw new Error('잠근 뒤 자기소개가 서버에 들어감');
    await k.alive(A, w);
    await w.keyboard.press('Escape');
    await w.keyboard.press('Escape');
    return what;
  });

  await t.step('대화 보내기(책상 모드 · F5) — 방에서 나가 대화창이 없으면 그렇게 적고, 어느 쪽이든 서버 대화 기록은 그대로', async () => {
    const before = JSON.stringify(await t.db.get(`rooms/${room}/chatLog`) || {});
    await k.closeMaint(w);
    if(await w.isVisible('#lcPreview')) await w.click('#lcPreview');
    await k.until(() => w.evaluate(() => document.body.classList.contains('runmode')), 10000);
    await w.keyboard.press('F5');
    await k.wait(1500);
    const open = await w.isVisible('#chatInput');
    if(open){
      await w.fill('#chatInput', '컷오버 중 보낸 대화');
      await w.press('#chatInput', 'Enter');
      await k.wait(3000);
    }
    await t.shot(w, 'chat-send');
    const what = await seen();
    await k.closeMaint(w);
    if(JSON.stringify(await t.db.get(`rooms/${room}/chatLog`) || {}) !== before) throw new Error('잠근 뒤 대화 기록이 서버에서 바뀜');
    const st = await w.evaluate(() => ({ mine: (document.body.innerText.match(/컷오버 중 보낸 대화/g) || []).length, room: !!window._roomMetaCache }));
    await k.alive(A, w);
    return (open ? '대화창 열림 · 보냄 · 내 화면에 ' + st.mine + '번 보임' : '대화창 없음(T+2 에 방에서 나감 — 보낼 길이 없다)') + ' · 방 연결 ' + (st.room ? '있음' : '없음') + ' · ' + what;
  });

  await t.step('30초 동안 쓰기 시도 셈 — 같은 경로를 계속 다시 쓰지 않음', async () => {
    const from = new Date().toISOString();
    await k.wait(30000);
    const all = t.rtdbStats(lockAt), idle = t.rtdbStats(from);
    const worst = Object.entries(idle.byPath).sort((a, b) => b[1] - a[1]);
    t.note('잠근 뒤 전체: 쓰기 시도 ' + all.writes.length + ' · 거절 ' + all.denied.length + ' · 경로별 ' + JSON.stringify(all.byPath));
    t.note('가만히 둔 30초: 쓰기 시도 ' + idle.writes.length + ' · 경로별 ' + JSON.stringify(idle.byPath));
    if(worst.length && worst[0][1] > MAX_PER_PATH_30S) throw new Error('되풀이 쓰기 ' + worst[0][0] + ' ×' + worst[0][1]);
    await k.alive(A, w);
    return `가만히 둔 30초 쓰기 시도 ${idle.writes.length}번(가장 많은 경로 ${worst.length ? worst[0][0] + ' ×' + worst[0][1] : '없음'})`;
  });

  await t.step('T+145 점검 끔(최소 버전 0.12.1 그대로) — «점검이 끝났어요» 창 · [지금 다시 켜기] [나중에]', async () => {
    await t.db.set('config/maintenance', { on: false });
    const s = await k.until(async () => { const x = await k.screen(w); return x.maint && /점검이 끝났어요/.test(x.maint.text) ? x : null; }, 10000);
    if(!s) throw new Error('끝남 창이 안 뜸 — ' + await seen());
    await t.shot(w, 'maint-off');
    if(JSON.stringify(s.maint.buttons) !== '["지금 다시 켜기","나중에"]') throw new Error('단추가 다름 ' + JSON.stringify(s.maint.buttons));
    const gate = (await k.screen(w)).gate;
    await w.locator(k.MAINT + ' button', { hasText: '나중에' }).click();
    await k.alive(A, w);
    return s.maint.text.replace(/\s+/g, ' ') + (gate ? ' · 업데이트 화면도 뜸' : ' · 업데이트 화면 없음(켜 둔 앱은 최소 버전을 켤 때만 본다)');
  });
});
