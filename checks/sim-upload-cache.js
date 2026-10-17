/* sim-upload-cache.js — 🗂️ 업로드 캐시 상한 규칙(shared/upload-cache.js) 검사
   ・1절: trim — 상한 이하 그대로 · 옛 해시 먼저 버림 · 그래도 넘치면 비움 · GLB 는 바로 비움 · 빈 값
   ・2절: 쓰는 두 모듈(room-sync · slot-sync)이 이 규칙을 부르고 «넘치면 비우기» 를 따로 쓰지 않는다
   ・3절: 깨 보기 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const say = (m) => console.log(m);
const chk = (ok, m) => { if(ok){ pass++; say('  ✓ ' + m); } else { fail++; say('  ✗ ' + m); } };
const read = (...c) => { for(const f of c){ try{ return fs.readFileSync(f, 'utf8'); }catch(_){} } return null; };
const need = (rel) => { const s = read('app/parts/' + rel, 'parts/' + rel, rel.split('/').pop(), '../app/parts/' + rel); if(s == null){ say('  ? 원본 못 찾음 — ' + rel); process.exit(0); } return s; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const SRC = need('shared/upload-cache.js');
const ROOM = need('room/room-sync.js');
const SLOT = need('character/slot-sync.js');
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

function judge(src){
  const U = load(src); const ok = [];
  const mk = (n, legacy) => { const o = {}; for(let i = 0; i < n; i++) o['face:' + (legacy && i < legacy ? 'x' : 'h2') + i] = 'u' + i; return o; };
  const a = mk(60); ok.push([U.trim(a, 60, { dropLegacyFirst: true }) === a && Object.keys(a).length === 60, '상한(60) 이하면 그대로 · 같은 객체']);
  const b = mk(61, 5); const tb = U.trim(b, 60, { dropLegacyFirst: true });
  ok.push([Object.keys(tb).length === 56 && Object.keys(tb).every(k => /:h2/.test(k)), '61칸 중 옛 해시 5칸 → 옛 것만 버리고 새 해시 56칸은 남긴다']);
  const c = mk(70, 2); ok.push([Object.keys(U.trim(c, 60, { dropLegacyFirst: true })).length === 0, '옛 것을 버려도 넘치면(68) 비운다(지금 동작)']);
  const d = mk(41); ok.push([Object.keys(U.trim(d, 40)).length === 0, 'GLB 는 옛 해시 구분 없이 넘치면(41) 비운다(지금 동작)']);
  const e = mk(40); ok.push([Object.keys(U.trim(e, 40)).length === 40, 'GLB 40 은 그대로(경계)']);
  ok.push([JSON.stringify(U.trim(null, 60)) === '{}' && JSON.stringify(U.trim(undefined, 40)) === '{}', '빈 값 → 빈 객체']);
  ok.push([U.FACE_CACHE_MAX === 60 && U.GLB_CACHE_MAX === 40, '상한 상수 — 얼굴 60 · GLB 40(지금 값)']);
  const inst = U.createUploadCache(); ok.push([inst.trim === U.trim && inst.FACE_CACHE_MAX === 60 && inst.GLB_CACHE_MAX === 40, 'createUploadCache 는 같은 규칙 · 상수를 내준다']);
  return ok;
}
function judgeWiring(room, slot){
  const r = strip(room), s = strip(slot); const ok = [];
  ok.push([/const faceUploadCache = deps\.faceUploadCache;/.test(r) && /faceUploadCache\.trim\(st, faceUploadCache\.FACE_CACHE_MAX, \{ dropLegacyFirst: true \}\)/.test(r), 'room-sync — deps 로 받아 얼굴 캐시를 이 규칙으로 다듬는다']);
  ok.push([/const glbUploadCache = deps\.glbUploadCache;/.test(s) && /glbUploadCache\.trim\(st, glbUploadCache\.GLB_CACHE_MAX\)/.test(s), 'slot-sync — deps 로 받아 GLB 캐시를 이 규칙으로 다듬는다']);
  ok.push([!/length\s*>\s*\d+\s*\)\s*\{?\s*(st\s*=\s*\{\}|for\b)/.test(r + s), '두 모듈에 «넘치면 비우기» 를 따로 쓰지 않는다']);
  return ok;
}
say('── 1. trim 규칙');
judge(SRC).forEach(([o, m]) => chk(o, m));
say('── 2. 쓰는 두 모듈');
judgeWiring(ROOM, SLOT).forEach(([o, m]) => chk(o, m));
say('── 3. 깨 보기');
const bad = (rows) => rows.some(([o]) => !o);
chk(bad(judge(SRC.replace('if(!_isCurrentHash(k)) delete st[k];', ''))), '옛 해시 먼저 버리기를 빼면 빨강');
chk(bad(judge(SRC.replace('const FACE_CACHE_MAX = 60;', 'const FACE_CACHE_MAX = 100;'))), '얼굴 상한을 바꾸면 빨강(이 커밋은 무변경)');
chk(bad(judgeWiring(SLOT.replace('return glbUploadCache.trim(st, glbUploadCache.GLB_CACHE_MAX);', 'if(Object.keys(st).length > 40) st = {};\n  return st;'), SLOT)), 'room-sync 자리에 옛 «넘치면 비우기» 를 다시 쓰면 빨강');
chk(bad(judgeWiring(ROOM, SLOT.replace('return glbUploadCache.trim(st, glbUploadCache.GLB_CACHE_MAX);', 'if(Object.keys(st).length > 40) st = {};\n  return st;'))), 'slot-sync 에 옛 «넘치면 비우기» 를 다시 쓰면 빨강');
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
