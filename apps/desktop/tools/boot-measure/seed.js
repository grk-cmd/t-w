// seed.js <e2e-local 폴더> <결과 폴더>/seed — 측정용 시드: 카탈로그 파츠 100개(약 8MB)를 관리자 계정으로 올리고, 앱으로 가입한 계정 하나의 로그인을 그 폴더 appdata 에 남긴다(캐릭터 · 파츠는 create.js)
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const E = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]);
process.env.TW_E2E_OUT = path.dirname(OUT);
const lib = require(E + '/lib.js');
const S = require(E + '/scenarios/_shared.js');
const INVITE = 'INVT-BTMS-E2E7';
const N = Number(process.env.SEED_N || 100);
/* 이 폴더를 지우고 다시 만든다 — e2e-local 결과 폴더 규칙(outRootProblem)을 지키고 마지막 폴더가 seed 일 때만 */
const WHY = S.outRootProblem(path.dirname(OUT)) || (path.basename(OUT) === 'seed' ? '' : '마지막 폴더가 seed 가 아님');
if(WHY){ console.error('결과 폴더를 지우지 않는다 — ' + OUT + ' · ' + WHY); process.exit(2); }
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function padGlb(seed, pad){
  const s = 0.05 + (seed % 97) / 1000;
  const pos = new Float32Array([0, 0, 0, s, 0, 0, 0, s, 0]);
  const bin = Buffer.from(pos.buffer);
  const json = { asset: { version: '2.0', generator: 'tw-bootm', extras: { seed } }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'm' + seed }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.5, 0.2, 1] } }],
    buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [s, s, 0] }], extras: { pad: crypto.randomBytes(pad).toString('base64').slice(0, pad) } };
  let j = Buffer.from(JSON.stringify(json));
  if(j.length % 4) j = Buffer.concat([j, Buffer.alloc(4 - (j.length % 4), 0x20)]);
  const total = 12 + 8 + j.length + 8 + bin.length;
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write('JSON', 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
  return Buffer.concat([head, jh, j, bh, bin]);
}

(async () => {
  S.seedSql('invite.sql', { code: INVITE });
  const adm = await S.apiUser(INVITE);
  await adm.token();
  S.seedSql('admin.sql', { uid: adm.uid });
  await S.waitUntil(async () => (await adm.call('GET', '/v2/admin/admins/me')).status === 200, { ms: 40000, what: '관리자' });
  log('관리자', adm.fc);
  const cat = await adm.call('GET', '/v2/catalog');
  const cats = (cat.data.categories || []).filter((c) => c.builtin).map((c) => c.code);
  log('카테고리', cats.join(','), '· 파츠', cat.data.parts.length);
  const have = new Set(cat.data.parts.map((p) => p.partId));
  let bytes = 0;
  const tok = 'Bearer ' + await adm.token();
  for(let i = 0; i < N; i++){
    const id = 'bench' + String(i).padStart(3, '0');
    if(have.has(id)) continue;
    const glb = padGlb(i, 60000 + (i * 977) % 40000);
    bytes += glb.length;
    const up = await fetch(lib.API + '/v2/admin/catalog/assets', { method: 'POST', headers: { Authorization: tok, 'Content-Type': 'model/gltf-binary' }, body: glb });
    const uj = await up.json();
    if(up.status !== 200) throw new Error('올리기 ' + up.status + ' ' + JSON.stringify(uj).slice(0, 200));
    const body = { name: '측정 ' + i, icon: '', category: cats[i % cats.length], model: uj.data.hash, glow: false, multi: false, standalone: false, stackable: false, rideTop: false,
      animMode: 'always', charType: 'default', hides: [], noColor: true, listing: { state: 'ACTIVE', access: { kind: 'everyone' }, acquisition: { kind: 'GIVEN' } } };
    const r = await adm.call('PUT', '/v2/admin/catalog/parts/' + id, body);
    if(r.status !== 200) throw new Error('파츠 ' + id + ' ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
  }
  log('올린 GLB', (bytes / 1e6).toFixed(2) + 'MB');
  fs.writeFileSync(path.join(path.dirname(OUT), 'admin.json'), JSON.stringify({ fc: adm.fc, pw: lib.PW, uid: adm.uid }));
  if(process.env.SEED_CATALOG_ONLY) return;

  /* 사용자 — 앱으로 가입(로그인이 그 appdata 에 남게) */
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const A = lib.makeApp(OUT);
  let w = await A.launch();
  const fc = await S.signupForm(w, INVITE);
  log('가입', fc);
  await S.restartAfter(A, () => w.click('#sdStart'));
  w = await A.launch();
  await w.locator('#lcNameBtn').waitFor({ state: 'visible', timeout: 60000 });
  await S.waitUntil(() => w.evaluate(() => TwRtHub.store.state() === 'ready'), { ms: 40000, what: 'realtime ready' });
  fs.writeFileSync(path.join(path.dirname(OUT), 'user.json'), JSON.stringify({ fc, pw: lib.PW }));
  await A.quit();
  log('끝');
  process.exit(0);
})().catch((e) => { console.error('실패', e); process.exit(1); });
