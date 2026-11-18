// 캐릭터 복제 코드 — A 가 만든 캐릭터를 런처 ⚙ › «복제 코드 만들기» 로 암호를 걸어 코드로 내보내고,
// B 가 빈 슬롯 + › «코드 입력하기» 에 코드 · 암호를 넣으면 같은 캐릭터가 B 슬롯 · 서버 보관함에 들어온다. 틀린 암호는 «암호가 틀렸거나» 로 거절.
// 커미션 코드: 관리자 A 가 «커미션 캐릭터 등록» 에 zip(character.glb · face.png · blink.png)을 넣어 DCM1 코드를 만들고, B 가 같은 칸에 넣으면 그 이름의 캐릭터가 등록된다.
'use strict';
const { run } = require('./_kit.js');
const { tinyGlb } = require('./_glb.js');

const PASS = 'e2e-code-pass';
// 캐릭터 모양 비교용 — 서버 보관함 def 에서 신원 · 시각처럼 계정마다 다른 칸을 뺀 몸 · 색
const shapeOf = (def) => JSON.stringify({ race: def.race, body: def.body, skin: def.skin, hair: def.hair, outfit: def.outfit, colors: def.colors });

run('char-code', async (t) => {
  const A = await t.newUser('a');
  const B = await t.newUser('b');
  await t.step('A 캐릭터 만들기', () => t.createCharacter(A));
  let code, commCode;
  await t.step('A ⚙ › 복제 코드 만들기 → 암호 걸린 코드', async () => {
    await A.w.click('#lcGear');
    await A.w.click('#lcExport');
    await A.w.fill('#exportPass', PASS);
    await A.w.click('#exportGen');
    code = await t.poll(async () => { const v = await A.w.inputValue('#exportText'); return /^DCC1\./.test(v) && v; }, 10000, 'DCC1. 코드');
    t.note('코드 길이 ' + code.length);
    t.check(!code.includes(PASS), '코드에 암호가 그대로 들어 있음');
    await A.w.click('#exportCancel');
  });
  const openCodeEntry = async () => {
    await B.w.click('#lcEmpty');
    await B.w.locator('#raceCommCode').waitFor({ state: 'visible', timeout: 15000 });
    await B.w.click('#raceCommCode');
    await B.w.locator('#commImpCode').waitFor({ state: 'visible', timeout: 5000 });
  };
  const enter = async (c, p) => { await B.w.fill('#commImpCode', c); await B.w.fill('#commImpPass', p); await B.w.click('#commImpGo'); };
  await t.step('B 틀린 암호 → 거절 · 슬롯 그대로', async () => {
    await openCodeEntry();
    await enter(code, 'wrong-pass');
    await t.poll(async () => /암호가 틀렸거나/.test(await B.w.textContent('#toast')), 10000, '틀린 암호 안내');
    const r = await t.api(B, 'GET', '/v2/me/avatars');
    t.check(!r.body.data.slots.some(Boolean), '틀린 암호인데 슬롯이 찼음');
  });
  await t.step('B 맞는 암호 → «불러왔어요» · 서버 슬롯에 A 와 같은 캐릭터', async () => {
    await enter(code, PASS);
    await t.poll(async () => /불러왔어요/.test(await B.w.textContent('#toast')), 15000, '«불러왔어요»');
    const b = await t.poll(async () => { const x = await t.api(B, 'GET', '/v2/me/avatars'); return x.body.data.slots[0] && x.body.data; }, 15000, 'B 서버 슬롯 0');
    const a = (await t.api(A, 'GET', '/v2/me/avatars')).body.data;
    const da = (await t.api(A, 'GET', '/v2/me/avatars/' + a.slots[0])).body.data;
    const db = (await t.api(B, 'GET', '/v2/me/avatars/' + b.slots[0])).body.data;
    t.check(da && db && da.def && db.def, '보관함 def 를 못 읽음');
    t.check(shapeOf(da.def) === shapeOf(db.def), '모양이 다름\nA ' + shapeOf(da.def).slice(0, 200) + '\nB ' + shapeOf(db.def).slice(0, 200));
    t.check(/\(1\/5\)/.test(await B.w.textContent('#lcCount')), 'B 런처 슬롯 수가 1/5 가 아님');
  });
  await t.step('A 관리자 · 커미션 zip → DCM1 코드', async () => {
    await t.makeAdmin(A); await t.enterAdmin(A);
    // zip 은 앱 창의 JSZip 으로 만든다(앱이 푸는 것과 같은 라이브러리) — 얼굴 · 눈 감은 얼굴은 64px 단색 PNG
    const zipB64 = await A.w.evaluate(async (glb) => {
      const png = (c) => { const k = document.createElement('canvas'); k.width = k.height = 64; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 64, 64); return k.toDataURL('image/png').split(',')[1]; };
      const z = new JSZip();
      z.file('character.glb', glb, { base64: true });
      z.file('face.png', png('#f6c'), { base64: true });
      z.file('blink.png', png('#c6f'), { base64: true });
      return z.generateAsync({ type: 'base64' });
    }, tinyGlb(7).toString('base64'));
    await A.w.click('#lcCommissionGen');
    await A.w.fill('#commGenName', 'e2e커미션');
    await A.w.fill('#commGenPass', PASS);
    await A.w.setInputFiles('#commGenFile', { name: 'e2e.zip', mimeType: 'application/zip', buffer: Buffer.from(zipB64, 'base64') });
    await A.w.click('#commGenGo');
    commCode = await t.poll(async () => { const v = await A.w.inputValue('#commGenOut'); return /^DCM1\./.test(v) && v; }, 15000, 'DCM1. 코드');
  });
  await t.step('B 커미션 코드 → «e2e커미션» 캐릭터 등록 · 서버 슬롯 1', async () => {
    await B.w.keyboard.press('Escape').catch(() => {});
    await B.w.click('#lcNext').catch(() => {});
    await openCodeEntry();
    await enter(commCode, PASS);
    await t.poll(async () => /e2e커미션.*등록했어요/.test(await B.w.textContent('#toast')), 15000, '«캐릭터를 등록했어요»');
    await t.poll(async () => { const x = await t.api(B, 'GET', '/v2/me/avatars'); return x.body.data.slots.filter(Boolean).length === 2; }, 15000, 'B 서버 슬롯 2개');
  });
});
