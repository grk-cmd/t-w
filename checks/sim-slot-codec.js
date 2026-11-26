/* ═══ 🧬 sim-slot-codec.js — 캐릭터 한 칸 ↔ 서버 def 바꾸기(character/slot-codec.js) ═══════════════
   서버 def 에는 그림 · GLB 의 원문(data: · base64)이 실리지 않는다 — Storage 주소만. 이 파일은 바꾸는 함수를 가짜 올리기 · 가짜 fetch 위에서 실제로 돌린다.
   ・1절: 서버로 — 얼굴 · 감은눈 · 동물 그림 여섯이 주소로 · 섬네일(올려도 못 올려도 push 를 접지 않음) · 커미션 / 책상 / 아이템 GLB 가 주소로 ·
          파츠 그림 · 귀 그림의 dataURL 은 뺌 · 하나라도 못 올리면 null(칸을 얼굴 없이 올리지 않는다) · 이미 주소인 값은 그대로 · 원본 객체를 안 바꿈
   ・2절: 올리기 이름 — 내용 해시(다른 그림은 다른 이름 · 같은 그림은 한 번만 올림) · 캐시 합치기 · 상한
   ・3절: 서버에서 — 주소 → dataURL · 얼굴 / 감은눈 없으면 던짐 · GLB 되받기 · 섬네일 비움 · 받기 줄(동시에 4개 · 먼저 부른 칸 먼저) · 멈춤만 끊는 시간 상한 · 하나라도 못 받으면 던짐 · 올리고 되받은 값이 원래 저장 모양과 같다(되받아 저장해도 안 올라가는 핑퐁 없음)
   ・4절: mutation test
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
  const w = { ls: new Map(), uploads: [], faceUp: [], fetched: [], fetchOpts: [], failKey: o.failKey || null, inflight: 0, maxIn: 0 };
  const store = new Map();
  const ctx = { window: {}, AbortSignal, AbortController, setTimeout, clearTimeout, console: { warn(){}, log(){} }, JSON, Object, Array, Promise, Error, Number, String, Math, Date, Uint8Array, atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    localStorage: { getItem: (k) => w.ls.has(k) ? w.ls.get(k) : null, setItem: (k, v) => w.ls.set(k, String(v)), removeItem: (k) => w.ls.delete(k) },
    fetch: async (u, fo) => { w.fetched.push(u); w.fetchOpts.push(fo);
      if(o.delay){ w.inflight++; w.maxIn = Math.max(w.maxIn, w.inflight); await new Promise(r => setTimeout(r, o.delay)); w.inflight--; }
      if(String(u).includes('BAD')) return { ok: false, status: 404 };
      if(o.stream && (!o.stream.only || o.stream.only.test(String(u)))){   /* 느린 망 흉내 — 조각 o.stream.n 개를 o.stream.ms 마다 하나씩(signal 이 끊으면 던진다) · only 를 주면 그 주소만 */
        let k = 0; const sig = fo && fo.signal;
        return { ok: true, headers: { get: () => 'image/png' }, body: { getReader: () => ({ read: () => new Promise((res, rej) => {
          if(sig && sig.aborted) return rej(new Error('aborted'));
          const tm = setTimeout(() => { if(sig && sig.aborted) return rej(new Error('aborted')); k++; res(k > o.stream.n ? { done: true } : { done: false, value: new Uint8Array([65 + k]) }); }, o.stream.ms);
          if(sig) sig.addEventListener('abort', () => { clearTimeout(tm); rej(new Error('aborted')); });
        }) }) } };
      }
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
  t(w.fetchOpts.length > 0 && w.fetchOpts.every(fo => fo && fo.signal), '  내려받기마다 시간 상한(signal)을 건다 — 옷장 서버 일은 한 줄이라 끝나지 않는 내려받기가 줄을 묶지 않게');
  t(/^data:image\//.test(back.face) && /^data:image\//.test(back.blink) && !('faceUrl' in back) && back.animalBody.startsWith('data:image/') && back.thumb === null && back._norm === 1, '서버 def → 화면 모양: 주소가 dataURL 로, 섬네일은 비움, 저장 모양(slotToObj)을 한 번 지난다');
  t(typeof back.commGlb === 'string' && !('commGlbUrl' in back) && typeof back.deskGlb === 'string' && typeof back.customItems.c1.glb === 'string' && !('glbUrl' in back.customItems.c1), '  GLB 주소는 base64 로 되받는다');
  t(w.fetched.every(u => /^https:\/\/st\/users\/uA\//.test(u) || /already/.test(u)), '  받는 곳은 서버 def 에 적힌 주소뿐');
  let threw = null; try{ await w.codec._slotFromServerObj({ skin: 1, blinkUrl: 'https://st/b.png' }); }catch(e){ threw = e; }
  t(threw, '★ 얼굴이 없으면 던진다 — 호출부가 이번 적용을 접는다(빈 얼굴 캐릭터를 앉히지 않는다)');
  threw = null; try{ await w.codec._slotFromServerObj({ faceUrl: 'https://BAD/f.png', blinkUrl: 'https://st/b.png' }); }catch(e){ threw = e; }
  t(threw, '  그림 받기가 실패해도 던진다(빈 그림으로 굳지 않게)');
  t((await w.codec._slotFromServerObj(null)) === null, '  null 칸은 null');
  /* 한 칸의 그림 · GLB 는 한꺼번에 받는다 — 하나씩 기다리면 켤 때 그림 수 × 왕복 시간이 걸린다 */
  w = mkWorld(src, { delay: 5 });
  const server2 = await mkWorld(src).codec._slotToServerObj('uA', OBJ(), {}, {});
  await w.codec._slotFromServerObj(server2);
  t(w.fetched.length >= 8 && w.maxIn === 4, '★ 한 칸의 그림 · GLB 를 하나씩 기다리지 않는다 — 받기 줄 4개가 꽉 차게(동시에 ' + w.maxIn + ' / ' + w.fetched.length + ')');
  /* 여러 칸을 같이 불러도 동시에 4개까지 · 먼저 부른 칸의 받기가 먼저 시작한다(느린 망에서 모두가 같이 시간 상한에 걸리지 않게) */
  w = mkWorld(src, { delay: 5 });
  const sA = await mkWorld(src).codec._slotToServerObj('uA', OBJ(), {}, {});
  const sB = await mkWorld(src).codec._slotToServerObj('uB', OBJ(), {}, {});
  await Promise.all([w.codec._slotFromServerObj(sA), w.codec._slotFromServerObj(sB)]);
  const firstB = w.fetched.findIndex((u) => u.includes('/uB/')), lastA = w.fetched.map((u) => u.includes('/uA/')).lastIndexOf(true);
  t(w.fetched.length >= 16 && w.maxIn <= 4 && firstB > lastA, '★ 두 칸을 같이 불러도 동시에 4개 이하(' + w.maxIn + ') · 먼저 부른 칸(uA)의 받기가 다 시작된 뒤에 다음 칸(uB)');
  w = mkWorld(src, { delay: 5 });
  threw = null; try{ await w.codec._slotFromServerObj(Object.assign({}, server2, { deskGlbUrl: 'https://BAD/d.glb' })); }catch(e){ threw = e; }
  t(threw, '  한꺼번에 받아도 하나라도 못 받으면 그 칸 전체가 던진다(반쯤 받은 칸을 앉히지 않는다)');
  /* 느리게라도 바이트가 오면 끊지 않는다 — 시간 상한은 «멈춤» 을 잰다(전체 시간이 상한보다 길어도 받는다). 상한을 60ms 로 줄여 돌린다 */
  { const fast = src.replace('const FETCH_TIMEOUT_MS = 20000;', 'const FETCH_TIMEOUT_MS = 60;');
    let ok1 = null; try{ ok1 = await mkWorld(fast, { stream: { n: 6, ms: 30 } }).codec._slotFromServerObj({ faceUrl: 'https://st/f.png', blinkUrl: 'https://st/b.png' }); }catch(_){ ok1 = null; }
    t(fast !== src && ok1 && /^data:image\/png;base64,/.test(ok1.face), '★ 조각이 상한(60ms)보다 짧은 사이로 오면 다 받는 데 180ms 가 걸려도 끊지 않는다');
    let threw2 = null; try{ await mkWorld(fast, { stream: { n: 3, ms: 120 } }).codec._slotFromServerObj({ faceUrl: 'https://st/f.png', blinkUrl: 'https://st/b.png' }); }catch(e){ threw2 = e; }
    t(threw2, '  조각 사이가 상한보다 길면(멈춤) 끊고 그 칸은 던진다'); }
  /* 받기 줄이 새지 않는다 — 실패 · 멈춤으로 끝난 받기도 자리를 돌려줘서, 같은 세상의 다음 칸이 끝까지 받는다 */
  { const leakIn = async (s2) => {
      const fast = s2.replace('const FETCH_TIMEOUT_MS = 20000;', 'const FETCH_TIMEOUT_MS = 40;');
      const keep = setTimeout(() => {}, 5000);   // AbortSignal.timeout 타이머는 Node 에서 프로세스를 붙잡지 않는다
      const W = mkWorld(fast, { delay: 1 });
      const bad = { faceUrl: 'https://BAD/1', blinkUrl: 'https://BAD/2', animalBodyUrl: 'https://BAD/3', animalEarPaintLUrl: 'https://BAD/4', animalBlinkUrl: 'https://BAD/5' };
      try{ await W.codec._slotFromServerObj(bad); }catch(_){}
      const S = mkWorld(fast, { stream: { n: 2, ms: 200, only: /\/st\/s[1-5]\.png$/ } });   // 첫 묶음(s1~s5)만 조각 사이가 상한보다 길다 — 멈춤으로 끊긴다 · 그 뒤 칸은 보통 받기
      const stall = Object.assign({}, bad, { faceUrl: 'https://st/s1.png', blinkUrl: 'https://st/s2.png', animalBodyUrl: 'https://st/s3.png', animalEarPaintLUrl: 'https://st/s4.png', animalBlinkUrl: 'https://st/s5.png' });
      try{ await S.codec._slotFromServerObj(stall); }catch(_){}
      const good = await mkWorld(src).codec._slotToServerObj('uA', OBJ(), {}, {});
      const all = Promise.allSettled([W.codec._slotFromServerObj(good), S.codec._slotFromServerObj(Object.assign({}, good))]);
      const r = await Promise.race([all, new Promise((x) => setTimeout(() => x('stuck'), 1500))]);
      clearTimeout(keep);
      if(r === 'stuck') return 'stuck';
      const fine = (x) => x.status === 'fulfilled' && x.value && /^data:image\//.test(x.value.face);
      return (fine(r[0]) && fine(r[1])) ? 'ok' : ('W ' + r[0].status + ' · S ' + r[1].status);
    };
    /* 바뀐 글(mutation)에서는 준비 단계에서 멈출 수 있다 — 통째로 상한을 둔다 */
    const leak = (s2) => { let tm; return Promise.race([leakIn(s2), new Promise((x) => { tm = setTimeout(() => x('stuck'), 4000); })]).finally(() => clearTimeout(tm)); };
    const lr = await leak(src);
    t(lr === 'ok', '★ 받기 줄이 새지 않는다 — 404 다섯(W) · 멈춤 다섯(S)으로 끝난 뒤에도 같은 세상의 다음 칸이 둘 다 끝까지 받아 얼굴 dataURL 이 선다(' + lr + ')');
    const onlyOk = src.replace("      Promise.resolve().then(job).then(resolve, reject).finally(() => { poolActive--; const next = poolWait.shift(); if(next) next(); });", "      Promise.resolve().then(job).then((v) => { poolActive--; const next = poolWait.shift(); if(next) next(); resolve(v); }, reject);");
    t(onlyOk !== src && (await leak(onlyOk)) !== 'ok', '  mutation test — 성공할 때만 자리를 돌려주면 실패 뒤 다음 칸이 영영 기다린다(빨강)');
    const onlyFail = src.replace("      Promise.resolve().then(job).then(resolve, reject).finally(() => { poolActive--; const next = poolWait.shift(); if(next) next(); });", "      Promise.resolve().then(job).then(resolve, (e) => { poolActive--; const next = poolWait.shift(); if(next) next(); reject(e); });");
    t(onlyFail !== src && (await leak(onlyFail)) !== 'ok', '  mutation test — 실패할 때만 자리를 돌려주면 성공한 받기 넷 뒤 다음이 영영 기다린다(빨강)'); }
  t(w.codec.SLOT_JSON_MAX === 150000 && w.codec.SLOT_IMG_FIELDS.length === 8, '상한(150000자) · 그림 칸 여덟');
  return r;
}

(async () => {
  (await behave(SRC)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 4. mutation test');
  const bb = [
    ['하나라도 못 올려도 계속 보냄', "if(!url) return null;\n    out[field + 'Url'] = url;", "out[field + 'Url'] = url;"],
    ['파츠 그림 원문을 안 뺌', "if(typeof v.pic === 'string' && v.pic.startsWith('data:')) delete v.pic;", ''],
    ['GLB 원문을 안 뺌', "delete out.commGlb;\n    const url", "const url"],
    ['얼굴 없어도 통과', "if(typeof out.face !== 'string' || typeof out.blink !== 'string') throw new Error('얼굴·감은눈 URL 이 없음');", ''],
    ['그림을 하나씩 기다림', "jobs.push(_fetchImgDataUrl(u).then(v => { out[field] = v; }));", "out[field] = await _fetchImgDataUrl(u);"],
    ['시간 상한을 받기 전체에 한 번만 검', "    const rd = res.body.getReader(), parts = [];\n    let n = 0;\n    for(;;){\n      const { done, value } = await step(rd.read());", "    const rd = res.body.getReader(), parts = [];\n    let n = 0;\n    const t0 = Date.now();\n    for(;;){\n      const { done, value } = await rd.read();\n      if(Date.now() - t0 > FETCH_TIMEOUT_MS){ ctl.abort(); throw new Error('전체 시간 넘김'); }"],
    ['받기 줄 상한이 없음', "const FETCH_POOL = 4;", "const FETCH_POOL = 999;"],
    ['GLB 하나 실패를 삼킴', "await Promise.all(jobs);", "await Promise.allSettled(jobs);"],
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
