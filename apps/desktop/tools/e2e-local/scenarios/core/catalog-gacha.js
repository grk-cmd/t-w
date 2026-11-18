// 카탈로그 받기 · 갱신 · 가챠
// 카탈로그: 시험 파츠 두 줄(seed/catalog-parts.sql — 꾸미기용 · 가챠용)을 넣고 관리자 A 가 이름을 고치면(PATCH) B 가 받는 카탈로그(/v2/catalog)와
//   B 앱의 카탈로그 한 벌(서버 알림 catalog → 다시 받기)에 새 이름이 실린다.
// 가챠: 뽑기 수 = floor(레벨 / 5) + 보너스. B 레벨 12 · 보너스 1 → 모은 수 3. 서버 값(/v2/me/gacha)과 앱 뽑기 창 «남은 뽑기 3회» · 다음 뽑기 Lv 15 를 보고,
//   [1회 뽑기] → 남은 2회 · 서버 보유분에 가챠 파츠 1개.
// 로컬 묶음은 Storage 봇이 없어 카탈로그 파일(GLB · 썸네일)을 올리거나 받지 못한다 — 파일이 필요 없는 판정만 한다(FEATURES.md «카탈로그»).
'use strict';
const { run } = require('./_kit.js');

run('catalog-gacha', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  const tag = Date.now().toString(36);
  const gid = 'e2eg' + tag, cid = 'e2ec' + tag;
  await t.step('A 서버 관리자 · 시험 파츠 두 줄', async () => {
    await t.makeAdmin(A);
    t.seed('catalog-parts.sql', { tag });
  });
  try {
    await t.step('A 이름 고침(PATCH) → 서버 카탈로그에 새 이름 · 가챠 표시 · B 앱이 알림을 받고 다시 받음', async () => {
      const newName = 'e2e새이름 ' + tag;
      // B 앱의 요청 기록에는 앱 스스로 보낸 것만 남게 한다 — 서버 확인은 앱 없는 계정(C)으로
      const C = await t.headlessUser();
      const n = B.reqs.length;
      const r = await t.api(A, 'PATCH', '/v2/admin/catalog/parts/' + gid, { version: 0, name: newName });
      t.check(r.status === 200, 'PATCH ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
      const cat = await t.poll(async () => { const x = await C.call('GET', '/v2/catalog'); const p = (x.body && x.body.data && x.body.data.parts) || []; return p.some((q) => q.partId === gid && q.name === newName) && p; }, 15000, '서버 카탈로그에 새 이름');
      const g = cat.find((q) => q.partId === cid);
      t.check(g && JSON.stringify(g).includes('GACHA'), '가챠 파츠가 가챠로 안 실림: ' + JSON.stringify(g).slice(0, 200));
      // 앱은 서버 알림(catalog)을 받으면 카탈로그를 다시 받는다 — PATCH 뒤 B 앱이 스스로 보낸 요청에 있는가(이 단계는 B 창으로 API 를 부르지 않는다)
      await t.poll(() => B.reqs.slice(n).some((x) => /^GET \/v2\/catalog 200/.test(x)), 70000, 'B 앱이 카탈로그를 다시 받음');
    });
    await t.step('B 레벨 12 · 보너스 1 → 서버 뽑기 수 = floor(12/5) + 1 = 3', async () => {
      const uid = await t.uid(B);
      t.seed('focus-level.sql', { uid, level: 12 });
      t.seed('gacha-bonus.sql', { uid, tag: 'e2e-' + tag, amount: 1 });
      const g = await t.poll(async () => { const x = await t.api(B, 'GET', '/v2/me/gacha'); return x.body && x.body.data && x.body.data.left === 3 && x.body.data; }, 10000, '/v2/me/gacha left 3');
      t.check(g.earned === 2 && g.bonus === 1, '서버 earned · bonus: ' + JSON.stringify(g));
    });
    await t.step('B 앱 뽑기 창 — «남은 뽑기 3회» · 다음 뽑기 Lv 15', async () => {
      await t.relaunch(B);   // 레벨 · 뽑기 수는 켤 때 받는다
      await t.waitLoggedIn(B);
      await t.createCharacter(B);
      await t.enterDesk(B);
      await B.w.keyboard.press('t');
      await B.w.locator('#gachaGoDraw').waitFor({ state: 'visible', timeout: 10000 });
      await B.w.click('#gachaGoDraw');
      await B.w.locator('#gachaDrawBar').waitFor({ state: 'visible', timeout: 10000 });
      const bar = await t.poll(async () => { const s = await B.w.textContent('#gachaDrawBar'); return /남은 뽑기 3회/.test(s) && s; }, 15000, '«남은 뽑기 3회»');
      t.check(/다음 뽑기 Lv 15/.test(bar), '다음 뽑기 레벨: ' + bar);
      await t.shot(B, '01-gacha');
    });
    await t.step('B [1회 뽑기] → 남은 2회 · 서버 보유분에 가챠 파츠', async () => {
      await B.w.click('#gachaDraw1');
      await t.poll(async () => /남은 뽑기 2회/.test(await B.w.textContent('#gachaDrawBar')), 15000, '«남은 뽑기 2회»');
      const r = await t.api(B, 'GET', '/v2/me/collection');
      t.check(JSON.stringify(r.body.data).includes(cid), '서버 보유분에 가챠 파츠가 없음: ' + JSON.stringify(r.body.data).slice(0, 200));
      const g = (await t.api(B, 'GET', '/v2/me/gacha')).body.data;
      t.check(g.left === 2, '서버 남은 수 ' + g.left);
      await t.shot(B, '02-drawn');
    });
  } finally {
    // 시험 파츠는 단종(ARCHIVED)으로 내린다 — 관리자 쓰기라 서버 카탈로그 캐시도 같이 비워진다(줄을 SQL 로 지우면 캐시에 남는다)
    const ADM = await t.headlessAdmin();
    for(const id of [gid, cid]){
      await t.cleanup('시험 파츠 ' + id + ' 단종', () => {
        const v = Number(t.sql(`SELECT version FROM part WHERE part_id = '${id}'`) || 0);
        return ADM.call('POST', '/v2/admin/catalog/listings/bulk', { action: 'ARCHIVE', items: [{ kind: 'part', id, version: v }] });
      });
    }
  }
});
