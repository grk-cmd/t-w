/* ═══ 🧬 sim-slot-codec.js — 캐릭터 한 칸 ↔ 서버 def 바꾸기(character/slot-codec.js) ═══════════════
   서버 def 에는 그림 · GLB 의 원문(data: · base64)이 실리지 않는다 — Storage 주소만. 이 파일은 바꾸는 함수를 가짜 올리기 · 가짜 fetch 위에서 실제로 돌린다.
   ・1절: 서버로 — 얼굴 · 감은눈 · 동물 그림 여섯이 주소로 · 섬네일(올려도 못 올려도 push 를 접지 않음) · 커미션 / 책상 / 아이템 GLB 가 주소로 ·
          파츠 그림 · 귀 그림의 dataURL 은 뺌 · 하나라도 못 올리면 null(칸을 얼굴 없이 올리지 않는다) · 이미 주소인 값은 그대로 · 원본 객체를 안 바꿈
   ・2절: 올리기 이름 — 내용 해시(다른 그림은 다른 이름 · 같은 그림은 한 번만 올림) · 캐시 합치기 · 상한
   ・3절: 서버에서 — 주소 → dataURL · 얼굴 / 감은눈 없으면 던짐 · GLB 되받기 · 섬네일 비움 · 올리고 되받은 값이 원래 저장 모양과 같다(되받아 저장해도 안 올라가는 핑퐁 없음)
   ・4절: 깨 보기
   [실행] 저장소 루트에서 node checks/run.js sim-slot-codec */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (n) => [__dirname, process.cwd()].flatMap(d => [n, 'parts/character/' + n, 'parts/shared/' + n, 'app/parts/character/' + n, 'app/parts/shared/' + n, 'apps/desktop/app/parts/character/' + n, 'apps/desktop/app/parts/shared/' + n].map(p => path.join(d, p))).find(p => fs.existsSync(p));
const F1 = find('slot-codec.js'), F2 = find('upload-cache.js');
if(!F1 || !F2){ say('  ? 원본 못 찾음 — slot-codec.js · upload-cache.js'); process.exit(2); }
const SRC = fs.readFileSync(F1, 'utf8'), CACHE = fs.readFileSync(F2, 'utf8');
const hash = (s) => 'h2' + String(s).length + String(s).slice(-4);   // 내용이 다르면 다른 값(검사용)

function mkWorld(src, opt){
  const o = opt || {};
  const w = { ls: new Map(), uploads: [], faceUp: [], fetched: [], failKey: o.failKey || null };
  const store = new Map();
  const ctx = { window: {}, console: { warn(){}, log(){} }, JSON, Object, Array, Promise, Error, Number, String, Math, Date, Uint8Array, atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    localStorage: { getItem: (k) => w.ls.has(k) ? w.ls.get(k) : null, setItem: (k, v) => w.ls.set(k, String(v)), removeItem: (k) => w.ls.delete(k) },
    fetch: async (u) => { w.fetched.push(u); if(String(u).includes('BAD')) return { ok: false, status: 404 };
      const bytes = Buffer.from('payload:' + u); return { ok: true, headers: { get: () => (/\.glb/.test(u) ? 'model/gltf-binary' : 'image/webp') }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; } };
  vm.createContext(ctx);
  vm.runInContext(CACHE, ctx);
  const cacheMod = ctx.window.TwUploadCache.createUploadCache();
  vm.runInContext(src, ctx);
  w.codec = ctx.window.TwSlotCodec.createSlotCodec({
    glbUploadCache: cacheMod, _quickHash: hash,
    /* 얼굴 올리기 — 내용 해시 이름. 같은 이름은 캐시(st)에서 */
    _storageFaceUrlOne: async (uid, st, key, dataUrl) => { if(typeof dataUrl !== 'string' || !dataUrl) return null; const ck = key + ':' + hash(dataUrl); if(st[ck]) return st[ck]; w.faceUp.push(key + '_' + hash(dataUrl)); if(w.failKey === key) return null; st[ck] = 'https://st/users/' + uid + '/' + key + '_' + hash(dataUrl) + '.png'; return st[ck]; },
    slotToObj: (x) => Object.assign({}, x, { _norm: 1 }),
    uploadGlb: async (uid, key, b64) => { w.uploads.push(key); if(w.failKey === 'glb') return { ok: false }; return { ok: true, url: 'https://st/users/' + uid + '/slotglb_' + key + '.glb' }; },
  });
  w.ctx = ctx;
  return w;
}
const D = (t) => 'data:image/png;base64,' + t;
const OBJ = () => ({ skin: 1, top: '#aaa', bot: '#bbb', face: D('FACE'), blink: D('BLINK'), thumb: D('THUMB'), animal: true, animalBody: D('BODY'), animalEarPaintL: D('EARL'), animalEarBlinkR: D('EARBR'),
  commGlb: 'COMMGLB', deskGlb: 'DESKGLB', customItems: { c1: { glb: 'ITEMGLB', name: 'x' }, c2: { name: 'noglb' } },
  equippedParts: { hat: [{ id: 'h1', xf: { pic: D('PIC'), s: 1 } }] }, earPicL: D('EARPIC'), earPicR: 'https://already/ear.png', deskItems: { a: 1 } });

async function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = mkWorld(src);
  const o = OBJ(); const before = JSON.stringify(o);
  const so = await w.codec._slotToServerObj('uA', o, {}, {});
  const noData = !/data:|base64/.test(JSON.stringify(so).replace(/"commGlb"|"deskGlb"/g, ''));
  t(so && typeof so.faceUrl === 'string' && typeof so.blinkUrl === 'string' && !('face' in so) && !('blink' in so) && so.faceUrl.includes('/users/uA/') && so.blinkUrl.includes('/users/uA/'), '얼굴 · 감은눈이 주소(faceUrl · blinkUrl)로 바뀐다 — 내 경로(users/{내 코드}/)');
  t(so.animalBodyUrl && so.animalEarPaintLUrl && so.animalEarBlinkRUrl && !('animalBody' in so) && !('animalEarPaintL' in so), '  동물 그림도 주소로');
  t(so.thumbUrl && !('thumb' in so), '  섬네일은 주소(thumbUrl)로 올리고 원문은 뺀다');
  t(so.commGlbUrl && so.deskGlbUrl && !('commGlb' in so) && !('deskGlb' in so) && so.customItems.c1.glbUrl && !('glb' in so.customItems.c1) && so.customItems.c2.name === 'noglb', '커미션 · 책상 · 아이템 GLB 가 주소로(GLB 없는 아이템은 그대로)');
  t(so.equippedParts.hat[0].xf.pic === undefined && so.equippedParts.hat[0].xf.s === 1 && o.equippedParts.hat[0].xf.pic === D('PIC'), '파츠 그림(xf.pic)의 dataURL 은 뺀다 — 원본 객체는 그대로(화면엔 그대로 있고 다음 저장에서 올라간다)');
  t(so.earPicL === undefined && so.earPicR === 'https://already/ear.png', '귀 그림 dataURL 은 빼고 이미 주소인 것은 둔다');
  t(JSON.stringify(o) === before && noData, '입력 객체를 바꾸지 않는다 · 결과에 data: 원문이 없다 (서버가 data: 를 거부한다)');
  /* 이미 주소인 얼굴 */
  const o2 = Object.assign(OBJ(), { face: 'https://already/face.png' });
  const so2 = await w.codec._slotToServerObj('uA', o2, {}, {});
  t(so2.faceUrl === 'https://already/face.png', '이미 주소인 얼굴은 다시 올리지 않고 그대로 faceUrl 로');
  /* 섬네일 — 못 올려도 접지 않음 */
  w = mkWorld(src, { failKey: 'thumb' });
  const so3 = await w.codec._slotToServerObj('uA', Object.assign(OBJ(), { thumbUrl: 'https://old/thumb.png' }), {}, {});
  t(so3 && so3.thumbUrl === 'https://old/thumb.png', '섬네일을 못 올리면 받아 둔 주소를 쓰고 push 를 접지 않는다(없어도 캐릭터는 멀쩡)');
  const so3b = await w.codec._slotToServerObj('uA', OBJ(), {}, {});
  t(so3b && !('thumbUrl' in so3b), '  받아 둔 주소도 없으면 섬네일 없이');
  /* 하나라도 못 올리면 null */
  for(const key of ['face', 'blink', 'aBody', 'aEarL', 'aEarRB', 'glb']){
    w = mkWorld(src, { failKey: key });
    const bad = await w.codec._slotToServerObj('uA', OBJ(), {}, {});
    t(bad === null, '★ ' + key + ' 를 못 올리면 null — 얼굴 없는 캐릭터를 올려 다른 기기에서 «피부색만 보임» 을 만들지 않는다');
  }
  t((await w.codec._slotToServerObj('uA', null, {}, {})) === null, 'null 칸은 null');
  /* 올리기 이름 */
  w = mkWorld(src);
  const st = {}, gst = {};
  await w.codec._slotToServerObj('uA', OBJ(), st, gst);
  const n1 = w.faceUp.length, g1 = w.uploads.length;
  await w.codec._slotToServerObj('uA', OBJ(), st, gst);
  t(w.faceUp.length === n1 && w.uploads.length === g1, '★ 같은 그림 · 같은 GLB 는 캐시에서 — 두 번째는 올리기 0');
  const oDiff = Object.assign(OBJ(), { face: D('FACE2') });
  await w.codec._slotToServerObj('uA', oDiff, st, gst);
  t(w.faceUp.length === n1 + 1 && w.faceUp[w.faceUp.length - 1] !== w.faceUp[0], '  한 글자만 다른 그림은 다른 이름으로 올린다(다른 그림을 덮어쓰지 않는다)');
  await w.codec._slotToServerObj('uA', Object.assign(OBJ(), { deskGlb: 'DESKGLB2' }), st, gst);
  t(w.uploads.filter(k => /^desk_/.test(k)).length === 2 && new Set(w.uploads).size === w.uploads.length, '  GLB 도 내용 해시 이름 — 다른 GLB 는 다른 이름');
  w.codec._slotGlbCacheSave(gst);
  t(Object.keys(JSON.parse(w.ls.get('tw.slotGlbUrls') || '{}')).length === Object.keys(gst).length && w.codec._slotGlbCacheLoad()['desk:' + hash('DESKGLB')], '올리기 캐시 — 저장 · 다시 읽기(이 PC 의 중복 막기용 · 지워져도 다시 올릴 뿐)');
  w.ls.set('tw.slotGlbUrls', '{깨짐');
  t(JSON.stringify(w.codec._slotGlbCacheLoad()) === '{}', '  깨진 캐시는 빈 값으로(던지지 않는다)');
  /* 서버에서 */
  w = mkWorld(src);
  const server = await w.codec._slotToServerObj('uA', OBJ(), {}, {});
  const back = await w.codec._slotFromServerObj(server);
  t(/^data:image\//.test(back.face) && /^data:image\//.test(back.blink) && !('faceUrl' in back) && back.animalBody.startsWith('data:image/') && back.thumb === null && back._norm === 1, '서버 def → 화면 모양: 주소가 dataURL 로, 섬네일은 비움, 저장 모양(slotToObj)을 한 번 지난다');
  t(typeof back.commGlb === 'string' && !('commGlbUrl' in back) && typeof back.deskGlb === 'string' && typeof back.customItems.c1.glb === 'string' && !('glbUrl' in back.customItems.c1), '  GLB 주소는 base64 로 되받는다');
  t(w.fetched.every(u => /^https:\/\/st\/users\/uA\//.test(u) || /already/.test(u)), '  받는 곳은 서버 def 에 적힌 주소뿐');
  let threw = null; try{ await w.codec._slotFromServerObj({ skin: 1, blinkUrl: 'https://st/b.png' }); }catch(e){ threw = e; }
  t(threw, '★ 얼굴이 없으면 던진다 — 호출부가 이번 적용을 접는다(빈 얼굴 캐릭터를 앉히지 않는다)');
  threw = null; try{ await w.codec._slotFromServerObj({ faceUrl: 'https://BAD/f.png', blinkUrl: 'https://st/b.png' }); }catch(e){ threw = e; }
  t(threw, '  그림 받기가 실패해도 던진다(빈 그림으로 굳지 않게)');
  t((await w.codec._slotFromServerObj(null)) === null, '  null 칸은 null');
  t(w.codec.SLOT_JSON_MAX === 150000 && w.codec.SLOT_IMG_FIELDS.length === 8, '상한(150000자) · 그림 칸 여덟');
  return r;
}

(async () => {
  (await behave(SRC)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 4. 일부러 깨 보기');
  const bb = [
    ['하나라도 못 올려도 계속 보냄', "if(!url) return null;\n    out[field + 'Url'] = url;", "out[field + 'Url'] = url;"],
    ['파츠 그림 원문을 안 뺌', "if(typeof v.pic === 'string' && v.pic.startsWith('data:')) delete v.pic;", ''],
    ['GLB 원문을 안 뺌', "delete out.commGlb;\n    const url", "const url"],
    ['얼굴 없어도 통과', "if(typeof out.face !== 'string' || typeof out.blink !== 'string') throw new Error('얼굴·감은눈 URL 이 없음');", ''],
    ['섬네일 원문을 안 뺌', "delete out.thumb; delete out._imgBroken; delete out.thumbUrl;", "delete out._imgBroken;"],
  ];
  for(const [name, a, b] of bb){
    const m2 = SRC.replace(a, b);
    let rows2 = []; if(m2 !== SRC){ try{ rows2 = await behave(m2); }catch(_){ rows2 = [[false, '던짐']]; } }
    chk(m2 !== SRC && rows2.some(([ok]) => !ok), name + (m2 !== SRC ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
