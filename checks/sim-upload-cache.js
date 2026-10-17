/* sim-upload-cache.js — 🗂️ 업로드 캐시 규칙(shared/upload-cache.js)과 «같은 그림 다시 안 올리기» 길 검사
   ・1절: trim — 상한 이하 그대로 · 넘치면 옛 해시 → 섬네일 10 → 오래 안 쓴 것부터 · 통째로 비우지 않는다 · 빈 값
   ・2절: touch · merge · once(같은 키 동시 업로드는 한 번) · applyUrlSwaps(그 사이 바뀐 자리는 안 덮음)
   ・3절: 쓰는 곳 — 얼굴 · GLB 캐시(쓴 것 맨 뒤 · 같은 업로드 한 번 · 저장 때 합치기) · 업로드(이름이 내용 해시면 있나 먼저) · 마이홈(올린 자리 → URL) · 런처 섬네일(외모 지문)
   ・4절: 깨 보기 */
const fs = require('fs');
let pass = 0, fail = 0;
const say = (m) => console.log(m);
const chk = (ok, m) => { if(ok){ pass++; say('  ✓ ' + m); } else { fail++; say('  ✗ ' + m); } };
const read = (...c) => { for(const f of c){ try{ return fs.readFileSync(f, 'utf8'); }catch(_){} } return null; };
const need = (rel) => { const s = read('app/parts/' + rel, 'parts/' + rel, rel.split('/').pop(), '../app/parts/' + rel); if(s == null){ say('  ? 원본 못 찾음 — ' + rel); process.exit(0); } return s; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const SRC = need('shared/upload-cache.js');
const ROOM = need('room/room-sync.js');
const SLOT = need('character/slot-sync.js');
const FI = need('firebase-init.js');
const EDIT = need('myhome/myhome-edit.js');
const LCP = need('launcher/launcher-preview.js');
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

async function judge(src){
  const U = load(src); const ok = [];
  const mk = (n, legacy, kind) => { const o = {}; for(let i = 0; i < n; i++) o[(kind || 'face') + ':' + (legacy && i < legacy ? 'x' : 'h2') + i] = 'u' + i; return o; };
  const a = mk(100); ok.push([U.trim(a, 100) === a && Object.keys(a).length === 100, '상한(100) 이하면 그대로 · 같은 객체']);
  const b = mk(103, 5); const tb = U.trim(b, 100);
  ok.push([Object.keys(tb).length === 98 && Object.keys(tb).every(k => /:h2/.test(k)), '넘치면(103) 옛 해시 5칸을 먼저 버린다 → 98']);
  const c = mk(130); const tc = U.trim(c, 100);
  ok.push([Object.keys(tc).length === 100 && tc['face:h20'] === undefined && tc['face:h229'] === undefined && tc['face:h230'] === 'u30' && tc['face:h2129'] === 'u129', '그래도 넘치면(130) 오래 안 쓴 앞쪽 30칸만 버린다 — 통째로 비우지 않는다']);
  const d = Object.assign(mk(5), mk(14, 0, 'thumb')); const td = U.trim(d, 100);
  ok.push([Object.keys(td).filter(k => k.startsWith('thumb:')).length === 10 && td['thumb:h20'] === undefined && td['thumb:h213'] === 'u13' && Object.keys(td).filter(k => k.startsWith('face:')).length === 5, '섬네일은 10장까지(오래된 4장 버림) · 얼굴은 그대로']);
  const e = mk(41); ok.push([Object.keys(U.trim(e, 40)).length === 40 && U.trim(mk(41), 40)['face:h240'] === 'u40', 'GLB 41 → 40(맨 앞 하나만 버림)']);
  ok.push([JSON.stringify(U.trim(null, 60)) === '{}' && JSON.stringify(U.trim(undefined, 40)) === '{}', '빈 값 → 빈 객체']);
  ok.push([U.FACE_CACHE_MAX === 100 && U.GLB_CACHE_MAX === 40 && U.THUMB_CACHE_MAX === 10, '상한 상수 — 얼굴 100 · GLB 40 · 섬네일 10']);
  const t = { 'a:h21': 1, 'a:h22': 2, 'a:h23': 3 }; U.touch(t, 'a:h21'); U.touch(t, 'zz');
  ok.push([Object.keys(t).join() === 'a:h22,a:h23,a:h21' && !('zz' in t), 'touch — 쓴 항목을 맨 뒤로 · 없는 키는 그대로']);
  const mg = U.merge({ 'a:h21': 'old', 'b:h21': 'b' }, { 'a:h21': 'new', 'c:h21': 'c' });
  ok.push([Object.keys(mg).join() === 'b:h21,a:h21,c:h21' && mg['a:h21'] === 'new', 'merge — 저장본에만 있는 항목을 잃지 않고 · 내 항목이 뒤(최근)에 · 내 값이 이긴다']);
  ok.push([JSON.stringify(U.merge(null, { x: 1 })) === '{"x":1}' && JSON.stringify(U.merge({ x: 1 }, null)) === '{"x":1}', 'merge — 한쪽이 비어도']);
  const home = { avatar: 'data:A', bg: { img: 'data:B' }, stickers: { s1: { img: 'data:C' }, s2: { img: 'data:CHANGED' } } };
  const n = U.applyUrlSwaps(home, [{ path: ['avatar'], from: 'data:A', url: 'https://a' }, { path: ['bg', 'img'], from: 'data:B', url: 'https://b' },
    { path: ['stickers', 's1', 'img'], from: 'data:C', url: 'https://c' }, { path: ['stickers', 's2', 'img'], from: 'data:OLD', url: 'https://x' }, { path: ['nope', 'img'], from: 'd', url: 'u' }, null]);
  ok.push([n === 3 && home.avatar === 'https://a' && home.bg.img === 'https://b' && home.stickers.s1.img === 'https://c' && home.stickers.s2.img === 'data:CHANGED', 'applyUrlSwaps — 올린 세 자리를 URL 로 · 그 사이 바뀐 자리 · 없는 자리는 그대로']);
  const inst = U.createUploadCache(); let runs = 0;
  const slow = () => new Promise(r => setTimeout(() => { runs++; r({ ok: true, url: 'u' }); }, 5));
  const [p1, p2] = await Promise.all([inst.once('k', slow), inst.once('k', slow)]);
  const p3 = await inst.once('k', slow); const p4 = await inst.once('other', slow);
  ok.push([runs === 3 && p1 === p2 && p1.url === 'u' && p3.url === 'u' && p4.url === 'u', 'once — 같은 키를 동시에 두 번 → 한 번만 올린다 · 끝난 뒤 다시 부르면 다시 · 다른 키는 따로']);
  let threw = false; try{ await inst.once('bad', () => { throw new Error('x'); }); }catch(_){ threw = true; }
  let again = 0; await inst.once('bad', () => { again++; return 1; });
  ok.push([threw && again === 1, 'once — 실패하면 그대로 던지고 · 다음 부름은 새로 돈다(실패를 기억하지 않는다)']);
  return ok;
}
function judgeUses(room, slot, fi, edit, lcp){
  const r = strip(room), s = strip(slot), f = strip(fi), e = strip(edit), l = strip(lcp); const ok = [];
  ok.push([/faceUploadCache\.trim\(st, faceUploadCache\.FACE_CACHE_MAX\)/.test(r) && /faceUploadCache\.trim\(faceUploadCache\.merge\(cur, st\), faceUploadCache\.FACE_CACHE_MAX\)/.test(r), '얼굴 캐시 — 불러올 때 다듬고 · 저장 때 지금 저장본과 합친다']);
  ok.push([/if\(st\[ck\]\)\{ faceUploadCache\.touch\(st, ck\); return st\[ck\]; \}/.test(r) && /faceUploadCache\.once\('face\/' \+ uid \+ '\/' \+ ck, \(\)=>firebaseAPI\.uploadRoomFace\(/.test(r), '얼굴 업로드 — 쓴 것은 맨 뒤로 · 같은 그림 동시 업로드는 한 번']);
  ok.push([/glbUploadCache\.trim\(st, glbUploadCache\.GLB_CACHE_MAX\)/.test(s) && /glbUploadCache\.trim\(glbUploadCache\.merge\(cur, st\), glbUploadCache\.GLB_CACHE_MAX\)/.test(s), 'GLB 캐시 — 불러올 때 다듬고 · 저장 때 합친다']);
  ok.push([/if\(st\[ck\]\)\{ glbUploadCache\.touch\(st, ck\); return st\[ck\]; \}/.test(s) && /glbUploadCache\.once\('glb\/' \+ uid \+ '\/' \+ ck, \(\)=>firebaseAPI\.uploadSlotGlb\(/.test(s), 'GLB 업로드 — 쓴 것은 맨 뒤로 · 같은 파일 동시 업로드는 한 번']);
  ok.push([!/length\s*>\s*\d+\s*\)\s*\{?\s*(st\s*=\s*\{\}|for\b)/.test(r + s), '두 모듈에 «넘치면 비우기» 를 따로 쓰지 않는다']);
  const exist = (f.match(/async function _existingUrlIfHashed\(path\)\{[\s\S]*?\n  \}/) || [''])[0];
  ok.push([/_h2\[0-9a-z\]\+/.test(exist) && /getDownloadURL\(sref\(storage, path\)\)/.test(exist) && /catch\(_\)\{ return null; \}/.test(exist), '업로드 앞 «있나» — 이름이 내용 해시일 때만 · 못 찾으면 null(평소처럼 올린다)']);
  ok.push([(f.match(/const have = await _existingUrlIfHashed\(path\);\s*if\(have\) return \{ ok:true, url: have \};/g) || []).length === 2, '  ↳ 얼굴(uploadRoomFace) · 슬롯 GLB(uploadSlotGlb) 두 곳이 먼저 묻는다']);
  ok.push([/swaps\.push\(\{ path: at, from: val, url: r \}\)/.test(f) && /\['stickers', sid, 'img'\]/.test(f) && /return uploadWarn \? \{ ok:true, warn:uploadWarn, swaps \} : \{ ok:true, swaps \};/.test(f), '마이홈 저장 — 올린 자리(프로필 · 배경 · 스티커)와 URL 을 돌려준다']);
  ok.push([/const homeUploadCache = deps\.homeUploadCache;/.test(e) && /if\(r && r\.swaps\) homeUploadCache\.applyUrlSwaps\(_myHomeData\(\), r\.swaps\);/.test(e), '마이홈 편집 — 돌려받은 URL 을 들고 있는 데이터에 바꿔 넣는다(다음 저장 때 다시 안 올림)']);
  ok.push([/if\(sig && job\.def\.thumb && sigs\[_quickHash\(job\.def\.thumb\)\] === sig\) return;/.test(l) && /delete o\.thumb; delete o\.thumbUrl; delete o\.partXfMemory;/.test(l) && /LC_THUMB_SIGS_KEY = 'tw\.thumbSigs'/.test(l), '런처 섬네일 — 외모 지문이 같으면 다시 찍지 않는다 · 지문은 이 PC 에만(tw.thumbSigs)']);
  return ok;
}
(async () => {
say('── 1·2. 규칙');
(await judge(SRC)).forEach(([o, m]) => chk(o, m));
say('── 3. 쓰는 곳');
judgeUses(ROOM, SLOT, FI, EDIT, LCP).forEach(([o, m]) => chk(o, m));
say('── 4. 깨 보기');
const bad = (rows) => rows.some(([o]) => !o);
chk(bad(await judge(SRC.replace('  for(let i = 0; i < rest.length - max; i++) delete st[rest[i]];\n  return st;', '  if(rest.length > max) return {};\n  return st;'))), '넘치면 통째로 비우게 되돌리면 빨강');
chk(bad(await judge(SRC.replace('    if(inflight.has(key)) return inflight.get(key);\n', ''))), '같은 키 동시 업로드 묶기를 빼면 빨강');
chk(bad(await judge(SRC.replace('if(o && o[last] === s.from){', 'if(o){'))), '그 사이 바뀐 자리까지 덮으면 빨강');
chk(bad(await judge(SRC.replace('if(!(mine && k in mine)) out[k] = stored[k];', ''))), '저장 때 저장본 항목을 버리면 빨강');
chk(bad(judgeUses(ROOM.replace('faceUploadCache.merge(cur, st)', 'st'), SLOT, FI, EDIT, LCP)), '얼굴 캐시 저장이 합치지 않으면 빨강');
chk(bad(judgeUses(ROOM, SLOT, FI, EDIT.replace('if(r && r.swaps) homeUploadCache.applyUrlSwaps(_myHomeData(), r.swaps);', ''), LCP)), '마이홈이 URL 을 안 바꿔 넣으면 빨강');
chk(bad(judgeUses(ROOM, SLOT, FI, EDIT, LCP.replace("if(sig && job.def.thumb && sigs[_quickHash(job.def.thumb)] === sig) return;", ''))), '섬네일 지문 확인을 빼면 빨강');
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
