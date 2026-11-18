// 올라타기 — 동물 캐릭터(레벨 50 보상 · 시험은 앱의 숨김 해금 «L 누른 채 동물 카드 10번»으로 연다)를 끌어 남의 머리 위에 놓으면 올라탐 · 방에 퍼져 남 화면에서도 · 끌어 내리면 내려옴
'use strict';
const kit = require('./_kit.js');

// 화면 자리(창 좌표) — 내 몸의 mesh 만 잰 가운데(누를 곳 · 머리 위 Z 같은 스프라이트는 뺀다) · 내 rig 원점 · 남의 머리
const points = () => {
  const proj = (v) => { const p = v.clone().project(camera); const rc = canvas.getBoundingClientRect(); return { x: rc.left + (p.x + 1) / 2 * rc.width, y: rc.top + (1 - p.y) / 2 * rc.height }; };
  const me = seats.find((s) => !s.remote), host = seats.find((s) => s.remote);
  const box = new THREE.Box3();
  (me.bodyWrap || me.rig).traverse((o) => { if(o.isMesh && !o.isSprite && o.visible) box.expandByObject(o); });
  return {
    grab: proj(box.getCenter(new THREE.Vector3())),
    rig: proj(me.rig.getWorldPosition(new THREE.Vector3())),
    head: proj(((host.bones && host.bones.head) || host.headAnchor).getWorldPosition(new THREE.Vector3())),
  };
};
const riding = () => { const s = seats.find((x) => !x.remote); return !!(s && s.ridingOn); };
const remoteRiding = () => { const s = seats.find((x) => x.remote); return !!(s && s.ridingOn); };

kit.scenario(__filename, async (t) => {
  const a = await t.user('a', { character: false });
  const b = await t.user('b');
  await t.step('a: 빈 칸 → 동물 카드 잠김(Lv.50) → L 누른 채 10번 눌러 해금', async () => {
    await a.w.click('#lcEmpty');
    await a.w.locator('#raceAnimal').waitFor({ state: 'visible', timeout: 20000 });
    await a.w.click('#raceAnimal');
    await a.toastSeen(/동물 캐릭터는 Lv\.\d+ 달성 보상/);
    await a.w.keyboard.down('l');
    for(let i = 0; i < 10; i++){ await a.w.click('#raceAnimal'); await kit.wait(100); }
    await a.w.keyboard.up('l');
    await a.toastSeen(/동물 캐릭터가 해금됐어요/);
  });
  await t.step('a: 동물 → 다음 끝까지 → 완성', async () => {
    await a.w.locator('#anpNextBtn').waitFor({ state: 'visible', timeout: 30000 });
    for(let i = 0; i < 12 && await a.shown('#animalCreatorOverlay'); i++){ await a.w.click('#anpNextBtn'); await kit.wait(400); }
    for(let i = 0; i < 10; i++){
      if(await a.eval(() => getComputedStyle(document.getElementById('crDone')).display !== 'none')) break;
      await a.w.click('#crNext'); await kit.wait(300);
    }
    await a.w.click('#crDone');
    await t.until('동물 슬롯', () => a.eval(() => slots.some((s) => s && s.animal)), 30000);
  });
  await t.step('a: 방 만들기 · b 참여 · 둘 다 책상 모드', async () => {
    const c = await a.createRoom({ title: '탑' });
    await b.joinRoom(c);
    for(const u of [a, b]) await u.desk();
    await t.until('a 좌석 둘', async () => (await a.seats()).length === 2);
    await kit.wait(2000);
  });
  await t.step('a: 내 동물을 끌어 b 머리 위에 놓음 → 올라탐', async () => {
    const p0 = await a.eval(points);
    t.note('누름 ' + JSON.stringify(p0));
    let x = p0.grab.x, y = p0.grab.y;
    await a.w.mouse.move(x, y);
    await a.w.mouse.down();
    // 끄는 동안 몸이 마우스를 따라가는 비율을 모르니, 매번 rig 와 남의 머리 사이를 다시 재서 그만큼 더 민다
    for(let i = 0; i < 8; i++){
      const p = await a.eval(points);
      const dx = p.head.x - p.rig.x, dy = p.head.y - p.rig.y;
      if(Math.hypot(dx, dy) < 4) break;
      for(let k = 1; k <= 6; k++){ await a.w.mouse.move(x + dx * k / 6, y + dy * k / 6); await kit.wait(20); }
      x += dx; y += dy;
      await kit.wait(80);
    }
    await a.w.mouse.up();
    await t.until('a 화면 올라탐', () => a.eval(riding), 5000);
  });
  await t.step('b 화면에서도 a 가 b 위에', async () => {
    await t.until('b 화면 a ridingOn', () => b.eval(remoteRiding), 15000);
  });
});
