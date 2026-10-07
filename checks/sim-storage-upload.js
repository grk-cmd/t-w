/* ═══ sim-storage-upload.js — 같은 그림 반복 업로드 줄이기 (storage-upload.js) ═══════════════════════════
   ・1절: 진행 중 업로드 나눠 쓰기 — 같은 키 동시 2번 → 1번 · 실패는 기억 안 함(다음에 다시) · uid 가 다르면 따로
   ・2절: 캐시 합치기 — 사본 둘이 각자 저장해도 서로 지우지 않는다
   ・3절: 넘칠 때 — 통째로 비우지 않는다 · 구형부터 · 오래 안 쓴 것부터 · thumb: 몇 장만
   ・4절: 외모 지문 — 섬네일 · 메모리 칸은 무시 · 파츠 · 얼굴 · xf · 책상은 다름
   ・5절: URL 되쓰기 — 같은 dataURL 일 때만 · https 만
   ・6절: app.js 배선 — 슬롯 push 와 chars 가 같은 얼굴을 동시에 올려도 1번 · 늦게 온 사본도 다시 안 올림 · GLB 도
   ・7절: 런처 섬네일 — 외모가 같으면 안 찍음 · 지문은 저장본/서버에 안 들어감
   ・8절: 마이홈 — saveMyHome 이 swaps 를 돌려주고 commitMyHomePage 가 되써 넣는다 · 10번 저장에 업로드 1번
   ・9절: firebase-init — 해시 이름 파일만 «이미 있으면 URL 만» · HTML 로드 순서
   [실행] 러너(checks/run.js)가 원본을 평평한 폴더에 모아 돌린다. */
'use strict';
const fs = require('fs');
const rd = (...names) => { for(const n of names){ try{ return fs.readFileSync(n, 'utf8'); }catch(_){} } return null; };
const UP   = rd('storage-upload.js', 'parts/storage-upload.js', 'app/parts/storage-upload.js');
const SRC  = rd('app.js', 'parts/app.js', 'app/parts/app.js');
const FI   = rd('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const HTML = rd('desk-companion-prototype.html', 'app/desk-companion-prototype.html');

let pass = 0, fail = 0;
const say = s => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
if(!UP || !SRC || !FI || !HTML){ say('  ? 원본 없음 — storage-upload.js · app.js · firebase-init.js · html'); process.exit(2); }
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
const M = new Function(UP + '\nreturn { createUploadShare, createUploadCache, thumbSigOf, applyUrlSwaps, THUMB_SIG_SKIP };')();
const mkLS = () => { const m = new Map(); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  say('── 1. 진행 중 업로드 나눠 쓰기 (createUploadShare)');
  {
    const S = M.createUploadShare();
    let calls = 0, release;
    const gate = new Promise(r => { release = r; });
    const fn = async () => { calls++; await gate; return 'https://st/a'; };
    const p1 = S.run('u1|face|face:h2x', fn), p2 = S.run('u1|face|face:h2x', fn);
    await tick(); release();
    const [a, b] = await Promise.all([p1, p2]);
    chk(calls === 1 && a === 'https://st/a' && b === a, '★ 같은 키를 동시에 두 번 부르면 업로드는 1번 · 둘 다 같은 URL');
    const c = await S.run('u1|face|face:h2x', async () => { calls++; return 'https://st/other'; });
    chk(calls === 1 && c === 'https://st/a', '  끝난 뒤에 와도 이번 실행에서 받은 URL 을 준다(사본이 낡아도 다시 안 올림)');
    const d = await S.run('u2|face|face:h2x', async () => { calls++; return 'https://st/u2'; });
    chk(calls === 2 && d === 'https://st/u2', '  uid 가 다르면 따로 — 계정을 바꾼 뒤 남의 URL 을 받지 않는다');
    let n = 0;
    const r1 = await S.run('u1|face|face:h2fail', async () => { n++; return null; });
    const r2 = await S.run('u1|face|face:h2fail', async () => { n++; return 'https://st/ok'; });
    chk(r1 === null && r2 === 'https://st/ok' && n === 2, '★ 실패는 기억하지 않는다 — 다음에 다시 올린다(예전 동작)');
    let thrown = false;
    try{ await S.run('u1|face|face:h2throw', async () => { throw new Error('x'); }); }catch(_){ thrown = true; }
    const r3 = await S.run('u1|face|face:h2throw', async () => 'https://st/t');
    chk(thrown && r3 === 'https://st/t' && S.pending() === 0, '  예외도 기다리던 쪽에 그대로 · 진행 중 표시는 지워진다');
  }

  say('── 2. 캐시 합치기 — 사본끼리 덮어쓰지 않는다');
  {
    const LS = mkLS();
    const C = M.createUploadCache({ store: LS, key: 'tw.roomFaceUrls', max: 100 });
    const a = C.load(), b = C.load();
    a['face:h2a'] = 'https://st/a';
    b['thumb:h2b'] = 'https://st/b';
    C.save(a); C.save(b);
    const disk = JSON.parse(LS.getItem('tw.roomFaceUrls'));
    chk(disk['face:h2a'] === 'https://st/a' && disk['thumb:h2b'] === 'https://st/b', '★ 슬롯 push 사본과 chars 사본이 각자 저장해도 둘 다 남는다(예전엔 나중 저장이 앞의 것을 지웠다)');
    chk(C.peek('face:h2a') === 'https://st/a' && C.peek('none') === null, '  peek 은 디스크를 다시 읽는다(다른 사본이 저장한 것)');
    LS.setItem('tw.roomFaceUrls', 'not json');
    chk(JSON.stringify(C.load()) === '{}', '  깨진 값은 빈 캐시로');
    const LS2 = mkLS();
    LS2.setItem('k', JSON.stringify({ faceHash: 'h2q', faceUrl: 'https://st/q' }));
    const C2 = M.createUploadCache({ store: LS2, key: 'k', migrate: st => { if(st.faceHash){ st['face:' + st.faceHash] = st.faceUrl; delete st.faceHash; delete st.faceUrl; } } });
    chk(C2.load()['face:h2q'] === 'https://st/q', '  옛 형태 옮기기(migrate)가 읽을 때마다 돈다');
  }

  say('── 3. 넘칠 때 — 통째로 비우지 않는다');
  {
    const LS = mkLS();
    const C = M.createUploadCache({ store: LS, key: 'k', max: 5, groupMax: { 'thumb:': 2 }, isStale: k => !/^h2/.test(k.slice(k.indexOf(':') + 1)) });
    const st = {};
    for(let i = 0; i < 8; i++) st['face:h2n' + i] = 'u' + i;
    const out = C.save(st);
    const ks = Object.keys(out);
    chk(ks.length === 5 && ks[0] === 'face:h2n3' && ks[4] === 'face:h2n7', '★ 상한을 넘으면 오래된 것부터 버린다(통째 {} 아님)');
    C.touch('face:h2n3');
    const ks2 = Object.keys(C.save(Object.assign(C.load(), { 'face:h2n8': 'u8' })));
    chk(ks2.includes('face:h2n3') && !ks2.includes('face:h2n4'), '  최근에 쓴 것(touch)은 남고, 안 쓴 것이 먼저 나간다');
    const LS3 = mkLS();
    const C3 = M.createUploadCache({ store: LS3, key: 'k', max: 4, isStale: k => !/^h2/.test(k.slice(k.indexOf(':') + 1)) });
    const st3 = { 'face:h2a': 1, 'face:old1': 2, 'face:h2b': 3, 'face:old2': 4, 'face:h2c': 5 };
    const k3 = Object.keys(C3.save(st3));
    chk(k3.length === 4 && !k3.includes('face:old1') && k3.includes('face:old2') && k3.includes('face:h2a'), '  구형 키를 먼저 버린다(넘친 만큼만)');
    const LS4 = mkLS();
    const C4 = M.createUploadCache({ store: LS4, key: 'k', max: 50, groupMax: { 'thumb:': 2 } });
    const k4 = Object.keys(C4.save({ 'thumb:h2a': 1, 'face:h2x': 2, 'thumb:h2b': 3, 'thumb:h2c': 4 }));
    chk(k4.length === 3 && !k4.includes('thumb:h2a') && k4.includes('face:h2x'), '★ thumb: 는 몇 장만 — 섬네일이 바뀔 때마다 쌓여 얼굴을 밀어내지 않게');
  }

  say('── 4. 외모 지문 (thumbSigOf)');
  {
    const h = s => { let a = 0; for(let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return a.toString(36); };
    const base = { skin: 1, top: '#111', bot: '#222', face: 'data:image/png;base64,AAA', blink: 'data:image/png;base64,BBB',
      xf: { y: 0, s: 1 }, equippedParts: { hat: { id: 'h1' } }, deskColor: '#c9a36a', deskItems: { lamp: true },
      thumb: 'data:image/png;base64,T1', thumbUrl: 'https://st/t', partXfMemory: { hat: { s: 1 } }, commName: '커미션' };
    const sig = M.thumbSigOf(base, h);
    const same = (o, m) => chk(M.thumbSigOf(Object.assign({}, base, o), h) === sig, m);
    const diff = (o, m) => chk(M.thumbSigOf(Object.assign({}, base, o), h) !== sig, m);
    chk(typeof sig === 'string' && /^v1/.test(sig), '  지문은 버전 머리 v1 + 해시');
    same({ thumb: 'data:image/png;base64,T2' }, '★ 섬네일 자체가 바뀌어도 같은 지문(제 그림이 제 지문을 바꾸지 않는다)');
    same({ thumbUrl: 'https://st/t2', partXfMemory: { hat: { s: 2 } } }, '  thumbUrl · partXfMemory(안 낀 파츠의 기억) 는 무시');
    chk(M.thumbSigOf({ bot: '#222', skin: 1, top: '#111', face: base.face, blink: base.blink, xf: { s: 1, y: 0 }, equippedParts: base.equippedParts, deskColor: base.deskColor, deskItems: base.deskItems }, h) === sig, '  키 순서가 달라도 같다');
    diff({ equippedParts: { hat: { id: 'h2' } } }, '★ 파츠를 바꾸면 다른 지문 → 다시 찍는다');
    diff({ face: 'data:image/png;base64,AAB' }, '  얼굴 그림이 바뀌면 다름');
    diff({ xf: { y: 0.1, s: 1 } }, '  xf(크기 · 높이)가 바뀌면 다름');
    diff({ deskColor: '#000000' }, '  책상 색이 바뀌면 다름');
    diff({ deskItems: { lamp: false } }, '  소품이 바뀌면 다름');
    diff({ animalBody: 'data:image/png;base64,P' }, '  동물 몸 페인트 같은 모르는/새 칸도 지문에 들어간다(안 찍는 쪽으로 틀리지 않게)');
  }

  say('── 5. URL 되쓰기 (applyUrlSwaps)');
  {
    const d = { avatar: 'data:A', bg: { img: 'data:B' }, stickers: { s1: { img: 'data:S1' }, s2: { img: 'data:S2-new' } } };
    const n = M.applyUrlSwaps(d, [
      { at: ['avatar'], from: 'data:A', to: 'https://st/avatar.jpg' },
      { at: ['bg', 'img'], from: 'data:B', to: 'https://st/bg.jpg' },
      { at: ['stickers', 's1', 'img'], from: 'data:S1', to: 'https://st/s1.png' },
      { at: ['stickers', 's2', 'img'], from: 'data:S2-old', to: 'https://st/s2.png' },
      { at: ['stickers', 'gone', 'img'], from: 'data:X', to: 'https://st/x.png' },
      { at: ['avatar'], from: 'https://st/avatar.jpg', to: 'data:evil' },
    ]);
    chk(n === 3 && d.avatar === 'https://st/avatar.jpg' && d.bg.img === 'https://st/bg.jpg' && d.stickers.s1.img === 'https://st/s1.png', '★ 올린 그 dataURL 자리에만 URL 을 넣는다');
    chk(d.stickers.s2.img === 'data:S2-new', '★ 저장이 도는 사이 바꾼 그림은 건드리지 않는다');
    chk(!d.stickers.gone && d.avatar.startsWith('https://'), '  지운 스티커는 되살리지 않는다 · https 가 아닌 값으로는 안 바꾼다');
    chk(M.applyUrlSwaps(null, []) === 0 && M.applyUrlSwaps(d, null) === 0, '  빈 입력은 0');
  }

  say('── 6. app.js 배선 — 같은 얼굴을 두 길이 동시에');
  {
    const names = ['_quickHash', '_roomFaceCache', '_uploadShare', '_roomFaceCacheLoad', '_roomFaceCacheSave', '_slotGlbCache', '_slotGlbCacheLoad', '_slotGlbCacheSave'];
    const fns = names.map(n => grabFn(SRC, n));
    const one = grabFn(SRC, '_storageFaceUrlOne', 'async function '), glbOne = grabFn(SRC, '_storageGlbUrlOne', 'async function ');
    chk(fns.every(Boolean) && one && glbOne, '  함수 떼어 옴: ' + names.join(' · ') + ' · _storageFaceUrlOne · _storageGlbUrlOne');
    const mk = () => {
      const env = { LS: mkLS(), uploads: [], glbUploads: [], opts: [], release: null };
      env.gate = new Promise(r => { env.release = r; });
      const firebaseAPI = {
        uploadRoomFace: async (uid, key, dataUrl, opts) => { env.uploads.push(key); env.opts.push(opts); await env.gate; return { ok: true, url: 'https://st/' + uid + '/roomface_' + key + '.png' }; },
        uploadSlotGlb: async (uid, key, b64, opts) => { env.glbUploads.push(key); env.opts.push(opts); await env.gate; return { ok: true, url: 'https://st/' + uid + '/slotglb_' + key + '.glb' }; },
      };
      env.m = new Function('localStorage', 'firebaseAPI', UP + '\nconst SLOT_GLB_CACHE_KEY = "tw.slotGlbUrls";\n' + fns.join('\n') + '\n' + one + '\n' + glbOne +
        '\nreturn { load:_roomFaceCacheLoad, save:_roomFaceCacheSave, one:_storageFaceUrlOne, gload:_slotGlbCacheLoad, gsave:_slotGlbCacheSave, glb:_storageGlbUrlOne, hash:_quickHash };')(env.LS, firebaseAPI);
      return env;
    };
    const FACE = 'data:image/png;base64,' + 'Q'.repeat(400), THUMB = 'data:image/png;base64,' + 'T'.repeat(200);
    /* 이전: 슬롯 push(_slotsPushToServer)와 chars(_charsSync)가 3초 뒤 같이 돌며 각자 사본으로 올렸다 */
    const e = mk();
    const stPush = e.m.load(), stChars = e.m.load();
    const p1 = (async () => { const a = await e.m.one('u1', stPush, 'face', FACE); const t = await e.m.one('u1', stPush, 'thumb', THUMB); e.m.save(stPush); return [a, t]; })();
    const p2 = (async () => { const a = await e.m.one('u1', stChars, 'face', FACE); const t = await e.m.one('u1', stChars, 'thumb', THUMB); e.m.save(stChars); return [a, t]; })();
    await tick(); e.release();
    const [r1, r2] = await Promise.all([p1, p2]);
    chk(e.uploads.length === 2 && e.uploads.filter(k => /^face_/.test(k)).length === 1 && e.uploads.filter(k => /^thumb_/.test(k)).length === 1,
      '★ 슬롯 push 와 chars 가 동시에 같은 얼굴 · 섬네일을 올려도 각 1번(예전: 각 2번) — 올린 수 ' + e.uploads.length);
    chk(r1[0] === r2[0] && r1[1] === r2[1] && /roomface_face_h2/.test(r1[0]), '  둘 다 같은 URL · 이름은 «종류_내용해시» 그대로');
    const disk = JSON.parse(e.LS.getItem('tw.roomFaceUrls'));
    chk(Object.keys(disk).length === 2, '  캐시에 둘 다 남는다');
    chk(e.opts.every(o => o && o.reuse === true), '  업로드 함수에 { reuse:true } — Storage 에 이미 있으면 URL 만(9절)');
    /* 방 입장(ensureRoomFaceUrls)처럼 저장 전에 읽어 둔 낡은 사본으로 와도 다시 안 올린다 */
    const e2 = mk(); e2.release();
    const stale = e2.m.load();
    const st2 = e2.m.load(); await e2.m.one('u1', st2, 'face', FACE); e2.m.save(st2);
    await e2.m.one('u1', stale, 'face', FACE);
    chk(e2.uploads.length === 1, '★ 낡은 사본(다른 쪽이 저장하기 전에 읽은 것)으로 와도 다시 안 올린다');
    /* GLB 도 같은 길 */
    const e3 = mk();
    const g1 = e3.m.gload(), g2 = e3.m.gload();
    const q = Promise.all([e3.m.glb('u1', g1, 'desk', 'R0xC'.repeat(50)), e3.m.glb('u1', g2, 'desk', 'R0xC'.repeat(50))]);
    await tick(); e3.release(); await q; e3.m.gsave(g1); e3.m.gsave(g2);
    chk(e3.glbUploads.length === 1, '  GLB(책상 · 커미션 · 아이템)도 동시에 1번');
    /* 실패하면 캐시에 안 남고 다음에 다시 */
    const e4 = mk(); e4.release();
    let failOnce = true;
    const api4 = { uploadRoomFace: async () => { e4.uploads.push('x'); if(failOnce){ failOnce = false; return { ok: false }; } return { ok: true, url: 'https://st/ok.png' }; } };
    const m4 = new Function('localStorage', 'firebaseAPI', UP + '\n' + fns.slice(0, 5).join('\n') + '\n' + one + '\nreturn { load:_roomFaceCacheLoad, one:_storageFaceUrlOne };')(e4.LS, api4);
    const s4 = m4.load();
    const f1 = await m4.one('u1', s4, 'face', FACE), f2 = await m4.one('u1', s4, 'face', FACE);
    chk(f1 === null && f2 === 'https://st/ok.png' && e4.uploads.length === 2, '★ 업로드 실패 → null(이번 push 는 접힘) · 다음에 다시 올린다');
    /* 넘쳐도 통째로 비우지 않는다(옛 60개 · 40개 규칙이 사라졌다) */
    const L = strip(grabFn(SRC, '_roomFaceCache') + grabFn(SRC, '_slotGlbCache'));
    chk(!/st = \{\}/.test(strip(grabFn(SRC, '_roomFaceCacheLoad') || '')) && !/st = \{\}/.test(strip(grabFn(SRC, '_slotGlbCacheLoad') || '')) && /createUploadCache/.test(L),
      '★ 얼굴(60개 넘으면 {})· GLB(40개 넘으면 {}) 통째 비우기가 없다 — createUploadCache 의 오래된 것부터 버리기');
    chk(/'thumb:': 10/.test(L), '  섬네일 키(thumb:)는 10장만 — 칸 5개 × 바뀐 직후 한 장');
    const pic = strip(grabFn(SRC, 'uploadPartPic', 'async function ') || '');
    chk(/_storageFaceUrlOne\(uid, st, 'pic', dataUrl\)/.test(pic), '  파츠 그림도 같은 업로더(나눠 쓰기 · 이미 있으면 URL 만)를 탄다');
  }

  say('── 7. 런처 섬네일 — 외모가 바뀌었을 때만');
  {
    const tk = strip(grabFn(SRC, '_lcThumbTake') || '');
    const iSig = tk.indexOf('_lcThumbSigOf(job.def)'), iFresh = tk.indexOf('if(_lcThumbSigFresh(job.def, sig)) return;'), iRender = tk.indexOf('lRenderer.render(');
    chk(iSig > 0 && iFresh > iSig && iRender > iFresh, '★ 찍기 전에 지문을 보고, 같으면 렌더 · 캡처 · saveSlots 전부 건너뛴다');
    chk(/_lcThumbSigRemember\(job\.def\.thumb, sig\)/.test(tk), '  찍은 뒤(바뀌었든 아니든) 지금 섬네일에 지문을 붙인다 — 지문 없는 옛 섬네일은 한 번만 찍는다');
    const names = ['_quickHash', '_lcThumbSigs', '_lcThumbSigRemember', '_lcThumbSigFresh'];
    const fns = names.map(n => grabFn(SRC, n));
    chk(fns.every(Boolean), '  함수 떼어 옴');
    const LS = mkLS();
    const T = new Function('localStorage', UP + '\n' + fns.join('\n') + '\nreturn { rem:_lcThumbSigRemember, fresh:_lcThumbSigFresh };')(LS);
    const def = { thumb: 'data:image/png;base64,THUMB1' };
    chk(T.fresh(def, 'v1abc') === false, '  지문이 없는 섬네일 → 찍는다');
    T.rem(def.thumb, 'v1abc');
    chk(T.fresh(def, 'v1abc') === true, '★ 같은 외모로 다시 넘겨 보면 찍지 않는다');
    chk(T.fresh(def, 'v1xyz') === false, '★ 외모가 바뀌면 찍는다');
    chk(T.fresh({ thumb: 'data:image/png;base64,OTHER' }, 'v1abc') === false && T.fresh({}, 'v1abc') === false && T.fresh(def, null) === false, '  섬네일이 다르거나 없거나 지문을 못 만들면 찍는다(예전 동작)');
    chk(LS.getItem('tw.thumbSigs') && !/data:/.test(LS.getItem('tw.thumbSigs')), '  지문은 tw.thumbSigs(섬네일 해시 → 지문) — 그림 자체는 안 담는다');
    const sto = grabFn(SRC, 'slotToObj') || '';
    chk(!/thumbSig/.test(sto) && !/thumbSig/.test(grabFn(SRC, '_slotToServerObj', 'async function ') || ''), '★ 지문은 슬롯 저장본 · 서버(slots · chars)에 안 들어간다 — 데이터 모양 · 캐릭터 열쇠 그대로(옛 앱 호환)');
    const sigOf = strip(grabFn(SRC, '_lcThumbSigOf') || '');
    chk(/thumbSigOf\(slotToObj\(def\), _quickHash\)/.test(sigOf) && /catch/.test(sigOf), '  지문은 slotToObj 모양(저장되는 외모 칸 전부)에서 · 못 만들면 null');
  }

  say('── 8. 마이홈 — 저장마다 다시 올리지 않는다');
  {
    const save = grabFn(FI, 'saveMyHome', 'async ');
    const body = grabFn(FI, '_saveMyHomeBody', 'async ');
    const lim = grabFn(FI, '_myHomeLimits', '    ');   // 객체 메서드 — 들여쓰기로 정의 자리를 찾는다(this._myHomeLimits() 호출과 구분)
    chk(save && body && lim, '  firebase-init 떼어 옴: saveMyHome · _saveMyHomeBody · _myHomeLimits');
    const env = { uploads: [], sets: 0, fail: false };
    const api = new Function('env', `
      const console = { warn: () => {}, log: () => {} };
      const _whenAuthReady = async () => {};
      const _uploadDataUrlIfNeeded = async (path, v) => { if(!v || !v.startsWith('data:')) return v; env.uploads.push(path); return env.fail ? v : 'https://firebasestorage.googleapis.com/' + path; };
      const ref = () => ({}); const db = {}; const auth = null;
      const set = async () => { env.sets++; }; const get = async () => ({ val: () => null });
      return { ${save}, ${body}, ${lim} };`)(env);
    const A = M.applyUrlSwaps;
    const data = { bio: '', post: '', avatar: 'data:image/jpeg;base64,AV', bg: { img: 'data:image/jpeg;base64,BG' }, stickers: { s1: { img: 'data:image/png;base64,ST', x: 0 } } };
    /* 예전 동작 재현 — swaps 를 무시하면 저장마다 3장 */
    const old = JSON.parse(JSON.stringify(data));
    for(let i = 0; i < 3; i++) await api.saveMyHome('u1', old);
    const before = env.uploads.length;
    env.uploads.length = 0;
    /* 지금 — commitMyHomePage 처럼 받은 swaps 를 되써 넣는다 · 스티커 클릭/끌기 10번 */
    for(let i = 0; i < 10; i++){
      data.stickers.s1.x = i;
      const r = await api.saveMyHome('u1', data);
      if(r && Array.isArray(r.swaps)) A(data, r.swaps);
    }
    chk(before === 9, '  (되쓰기 없이 3번 저장 → 업로드 ' + before + '번 — 고치기 전 모양)');
    chk(env.uploads.length === 3, '★ 10번 저장해도 프로필 · 배경 · 스티커 각 1번만 올린다 — 올린 수 ' + env.uploads.length);
    chk(data.avatar.startsWith('https://') && data.stickers.s1.img.startsWith('https://') && data.bg.img.startsWith('https://'), '  원본(_myHomeData) 자리에 URL 이 들어갔다');
    /* 업로드 실패 — 로컬은 dataURL 그대로 · 다음에 다시 */
    env.uploads.length = 0; env.fail = true;
    const d2 = { bio: '', post: '', stickers: { s9: { img: 'data:image/png;base64,S9' } } };
    const r1 = await api.saveMyHome('u1', d2); A(d2, r1 && r1.swaps);
    const r2 = await api.saveMyHome('u1', d2); A(d2, r2 && r2.swaps);
    chk(env.uploads.length === 2 && d2.stickers.s9.img.startsWith('data:') && !(r1 && r1.swaps), '★ 업로드가 실패하면 swaps 없음 · 원본은 dataURL 그대로 · 다음 저장에서 다시 시도(예전 동작)');
    chk(r1 && r1.ok === true && /사진 일부/.test(r1.warn || ''), '  실패 안내(warn)는 예전 그대로');
    const cm = strip(grabFn(SRC, 'commitMyHomePage', 'async function ') || '');
    const iSave = cm.indexOf('firebaseAPI.saveMyHome('), iApply = cm.indexOf('applyUrlSwaps(_myHomeData, r.swaps)'), iFail = cm.indexOf('r.ok === false');
    chk(iSave > 0 && iApply > iSave && iFail > iApply, '★ commitMyHomePage 가 저장 결과의 swaps 를 _myHomeData 에 되써 넣는다(실패 갈래보다 먼저 — 올린 그림은 저장이 거부돼도 유효하다)');
    chk(/sticker_\$\{sid\}\.png/.test(body) && /avatar\.jpg/.test(body) && /bg\.jpg/.test(body), '  Storage 경로(avatar.jpg · bg.jpg · sticker_{id}.png)는 그대로 — 다른 PC · 옛 앱과 같은 파일');
  }

  say('── 9. firebase-init — 이미 있으면 URL 만 · 로드 순서');
  {
    const f = strip(FI);
    const re = /const HASH_NAMED = (\/.*\/);/.exec(f);
    chk(!!re, '  HASH_NAMED 정규식이 있다');
    const HN = re ? eval(re[1]) : /$^/;
    chk(HN.test('users/u1/roomface_face_h20a1b2c30d4e5f6g9k.png') && HN.test('users/u1/slotglb_desk_h20a1b2c30d4e5f6gab.glb') && HN.test('users/u1/roomface_pic_h20000000000000012.png'),
      '★ 내용 해시 이름(roomface_* · slotglb_*)이면 먼저 «있나» 본다');
    chk(!HN.test('users/u1/avatar.jpg') && !HN.test('users/u1/sticker_s1.png') && !HN.test('users/u1/roomface_face_2irv4n63142.png'),
      '★ 같은 이름에 다른 그림이 오는 파일(avatar · sticker · 옛 해시 이름)은 확인 없이 올린다 — 옛 그림을 물려받지 않게');
    const ex = grabFn(f, '_existingUrl', 'async function ') || '';
    chk(/getDownloadURL\(sref\(storage, path\)\)/.test(ex) && /catch\(_\)\{ return null; \}/.test(ex), '  확인은 getDownloadURL 한 번 · 없거나 거절이면 null → 평소처럼 올린다');
    const ud = grabFn(f, '_uploadDataUrlIfNeeded', 'async function ') || '';
    chk(ud.indexOf('opts.reuse') > 0 && ud.indexOf('opts.reuse') < ud.indexOf('uploadString('), '  reuse 일 때만, 올리기 전에');
    const rf = grabFn(f, 'uploadRoomFace', 'async ') || '', sg = grabFn(f, 'uploadSlotGlb', 'async ') || '';
    chk(/uploadRoomFace\(userId, key, dataUrl, opts\)/.test(rf) && /_uploadDataUrlIfNeeded\([^)]*, dataUrl, opts\)/.test(rf), '  uploadRoomFace 가 opts 를 넘긴다');
    chk(/uploadSlotGlb\(userId, key, b64, opts\)/.test(sg) && sg.indexOf('_existingUrl(') > 0 && sg.indexOf('_existingUrl(') < sg.indexOf('uploadString('), '  uploadSlotGlb 도 올리기 전에 확인');
    const iUp = HTML.indexOf('<script src="parts/storage-upload.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iUp > 0 && iApp > iUp, '★ storage-upload.js 가 app.js 보다 먼저 로드된다(전역 함수)');
    chk(!/firebase|import /.test(strip(UP)), '  storage-upload.js 는 Firebase 를 직접 부르지 않는다(도메인 모듈)');
  }

  say('');
  say('통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(err => { say('  ✗ 예외: ' + (err && err.stack || err)); say('통과 ' + pass + ' · 실패 ' + (fail + 1)); process.exit(1); });
