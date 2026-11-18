// 카탈로그 파일 — 파츠 등록(파일 올리기) · 받기 · 꾸미기에서 입기
// 관리자 A 가 책상 모드 🎨 꾸미기 › 모자 › [+ 등록] 에 GLB 를 넣어 등록하면(POST /v2/admin/catalog/assets → 파츠 쓰기) 서버 카탈로그에 그 파츠와 모델 해시가 실리고
// 그 파일을 받을 수 있다(GET /v2/catalog/assets/<해시>.glb). 그 뒤에 켠 B(라이선스 등록 — 꾸미기는 프리미엄)의 앱이 그 GLB 를 서버에서 받고, 꾸미기 › 모자에서 그 파츠를 누르면 입는다.
// 로컬 묶음 API 에 Storage 에뮬레이터 연결이 있어야 돈다(없으면 올리기가 503 — FEATURES.md «부분: Storage»). 시험 파츠는 끝에 단종으로 내린다.
'use strict';
const { run } = require('./_kit.js');
const { tinyGlb } = require('./_glb.js');

const openWardrobe = async (t, A) => {
  if(await A.w.evaluate(() => document.getElementById('myChipMore').classList.contains('hidden'))) await A.w.click('#myChipMoreBtn');
  await A.w.click('#myWardrobeBtn');
  // 빈 칸이면 목록(.wd-grid)이 안 그려진다 — 위 탭으로 창이 열렸는지 본다
  await A.w.locator('#wardrobePanel .wd-group-btn').first().waitFor({ state: 'visible', timeout: 15000 });
};

run('catalog-files', async (t) => {
  const A = await t.newUser('admin');
  const tag = Date.now().toString(36);
  const name = 'e2e파일모자 ' + tag;
  const glb = tinyGlb(13);
  await t.step('A 관리자 모드 · 캐릭터 · 책상 모드 · 꾸미기', async () => {
    await t.makeAdmin(A); await t.enterAdmin(A);
    await t.createCharacter(A); await t.enterDesk(A);
    await openWardrobe(t, A);
  });
  const ADM = await t.headlessAdmin();
  let part;
  try {
    await t.step('A 모자 [+ 등록] → GLB 올리기 · «등록 완료»', async () => {
      await A.w.locator('#wardrobePanel .wd-add').first().click();
      await A.w.locator('#partRegName').waitFor({ state: 'visible', timeout: 5000 });
      await A.w.fill('#partRegName', name);
      await A.w.setInputFiles('#partRegFile', { name: 'e2e.glb', mimeType: 'model/gltf-binary', buffer: glb });
      const n = A.reqs.length;
      await A.w.click('#partRegGo');
      await t.poll(async () => (await A.w.textContent('#toast')).includes(name + '" 등록 완료'), 30000, '«등록 완료»');
      t.check(A.reqs.slice(n).some((r) => /^POST \/v2\/admin\/catalog\/assets 2\d\d/.test(r)), '파일 올리기(POST /v2/admin/catalog/assets)가 2xx 가 아님: ' + A.reqs.slice(n).filter((r) => /assets/.test(r)).join(' | '));
      await t.shot(A, '01-registered');
    });
    await t.step('서버 카탈로그에 그 파츠 · 모델 파일을 받을 수 있음', async () => {
      part = await t.poll(async () => { const x = await ADM.call('GET', '/v2/catalog'); return ((x.body && x.body.data && x.body.data.parts) || []).find((p) => p.name === name); }, 15000, '카탈로그에 새 파츠');
      t.check(part.model, '파츠에 모델 해시가 없음');
      const r = await fetch('http://127.0.0.1:8080/v2/catalog/assets/' + part.model + '.glb');
      const body = Buffer.from(await r.arrayBuffer());
      t.check(r.status === 200, '모델 파일 받기 ' + r.status);
      t.check(body.length === glb.length, `받은 파일 크기 ${body.length} ≠ 올린 크기 ${glb.length}`);
      t.note(`파츠 ${part.partId} · 모델 ${part.model.slice(0, 12)}… · ${body.length}B`);
    });
    const B = await t.newUser('user');
    // 꾸미기는 라이선스(프리미엄)가 있어야 열린다 — 관리자가 B 에게 키를 내고 B 가 등록한 뒤 다시 켠다
    await t.step('B 라이선스 받아 등록 → 프리미엄 · 다시 켜기', async () => {
      const g = await ADM.call('POST', '/v2/admin/licenses', { requestId: 'e2e-cf-' + tag, grants: [{ friendCode: B.fc, note: 'e2e catalog-files' }], reissue: false });
      const row = g.body && Array.isArray(g.body.data) && g.body.data[0];
      t.check(g.status === 200 && row && row.ok && row.key, '라이선스 발급 ' + g.status + ' ' + JSON.stringify(g.body).slice(0, 160));
      const r = await t.api(B, 'POST', '/v2/me/license', { key: row.key, device: { id: await B.w.evaluate(() => TwDeviceId.store.get()), name: 'e2e' } });
      t.check(r.status === 200, '라이선스 등록 ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
      await t.poll(async () => { const m = await t.api(B, 'GET', '/v2/me'); return m.body && m.body.data && m.body.data.premium === true; }, 10000, 'B premium true');
      await t.relaunch(B);
      await t.waitLoggedIn(B);
    });
    await t.step('B 꾸미기 › 모자에서 그 파츠를 누르면 앱이 GLB 를 받아 입힘', async () => {
      await t.createCharacter(B); await t.enterDesk(B);
      await openWardrobe(t, B);
      const card = B.w.locator('#wardrobePanel .wd-card', { hasText: name }).first();
      await card.waitFor({ state: 'visible', timeout: 15000 });
      await card.click();
      // 입었다 = 다시 그린 칸이 «입음»(.wd-card.on). 모델은 앱이 카탈로그를 받을 때 미리 받아 둘 수 있어(이 PC 캐시) 누른 뒤가 아니라 이번 켜기 뒤 어느 때든 서버에서 받았는지 본다
      await t.poll(() => B.w.locator('#wardrobePanel .wd-card.on', { hasText: name }).count(), 10000, '그 파츠 칸이 «입음»');
      const since = B.reqs.lastIndexOf('--- launch ---');
      t.check(B.reqs.slice(since + 1).some((r) => r.startsWith('GET /v2/catalog/assets/' + part.model) && / 200$/.test(r)), 'B 앱이 이번 켜기에 모델 파일을 서버에서 받지 않음');
      t.check(!/E-CHAR/.test(await B.w.textContent('#toast')), '입기 실패 알림: ' + await B.w.textContent('#toast'));
      await t.shot(B, '02-worn');
    });
  } finally {
    await t.cleanup('시험 파츠 단종', async () => {
      const id = part && part.partId || t.sql(`SELECT part_id FROM part WHERE name = '${name.replace(/'/g, "''")}' LIMIT 1`);
      if(!id) return null;
      const v = Number(t.sql(`SELECT version FROM part WHERE part_id = '${id}'`) || 0);
      return ADM.call('POST', '/v2/admin/catalog/listings/bulk', { action: 'ARCHIVE', items: [{ kind: 'part', id, version: v }] });
    });
  }
});
