/* sim-request-id.js — 🔁 요청 번호(shared/request-id.js) 검사
   ・1절: 모양 — 서버 규칙 ^[A-Za-z0-9_-]{8,64}$ 경계(7 · 8 · 64 · 65자 · 다른 글자 · 글자가 아닌 값)
   ・2절: 만들기 — randomUUID · getRandomValues · random 세 길 모두 규칙 안 · 겹치지 않음 · randomUUID 가 이상한 값이면 다른 길
   ・3절: 다시 보내기 — 같은 키는 끝낼 때까지 같은 번호 · 끝내면 새 번호 · 다른 키는 다른 번호 · 상한 넘으면 오래된 것부터 버림
   ・4절: 배선 — window.TwRequestId · html 이 app.js 보다 먼저 싣는다(smoke 는 html 차례대로 싣는다)
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  RID: pick(at('request-id.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, win) => { const w = win || {}; new Function('window', 'module', src)(w, undefined); return w.TwRequestId; };
const SERVER_RE = /^[A-Za-z0-9_-]{8,64}$/;   // 서버 RequestId.PATTERN 과 같은 글(검사 쪽 정답)

function judge(S){
  let R = null;
  try{ R = load(S.RID, { crypto: require('crypto').webcrypto }); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  if(!R){ chk(false, 'window.TwRequestId 가 없다'); return; }

  say('── 1. 모양');
  chk(String(R.PATTERN) === String(SERVER_RE), '규칙이 서버와 같은 글 ' + String(R.PATTERN));
  const cases = [['a'.repeat(7), false], ['a'.repeat(8), true], ['a'.repeat(64), true], ['a'.repeat(65), false],
    ['abc_DEF-12', true], ['abc.defgh', false], ['abc defgh', false], ['한글한글한글한글', false], [12345678, false], [null, false], [undefined, false], ['', false]];
  const bad = cases.filter(([v, ok]) => R.isValid(v) !== ok).map(([v]) => JSON.stringify(v));
  chk(!bad.length, '경계 — 7자 · 65자 · 점 · 빈칸 · 한글 · 숫자 · null 은 아니고 8 · 64자 · _ - 는 맞다' + (bad.length ? ' — 틀림: ' + bad.join(', ') : ''));

  say('── 2. 만들기');
  const seen = new Set();
  let allOk = true;
  for(let i = 0; i < 2000; i++){ const v = R.newId(); if(!SERVER_RE.test(v)) allOk = false; seen.add(v); }
  chk(allOk && seen.size === 2000, '브라우저 한 벌 — 2000개가 다 규칙 안 · 겹치지 않음');
  const viaRandomValues = R.createIdMaker({ crypto: { getRandomValues: (a) => require('crypto').webcrypto.getRandomValues(a) } });
  const viaRandom = R.createIdMaker({ crypto: null, random: Math.random });
  const viaBadUuid = R.createIdMaker({ crypto: { randomUUID: () => 'x', getRandomValues: (a) => require('crypto').webcrypto.getRandomValues(a) } });
  const three = [viaRandomValues(), viaRandom(), viaBadUuid()];
  chk(three.every((v) => SERVER_RE.test(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)),
    '  ↳ randomUUID 가 없거나 이상한 값을 내도 uuid 모양(v4)으로 · ' + three.join(' · '));
  chk(R.uuidFrom(new Uint8Array(16)) === '00000000-0000-4000-8000-000000000000' && R.uuidFrom(new Uint8Array(16).fill(255)) === 'ffffffff-ffff-4fff-bfff-ffffffffffff', '  ↳ 경계 바이트(0 · 255)도 v4 표시가 맞다');

  say('── 3. 다시 보내기');
  let n = 0;
  const p = R.createPending({ newId: () => 'id-' + String(++n).padStart(6, '0') });
  const a1 = p.idFor('gift:u1'), a2 = p.idFor('gift:u1'), b1 = p.idFor('gift:u2');
  chk(a1 === a2 && a1 !== b1, '같은 키는 같은 번호(닿지 못해 다시 보냄) · 다른 키는 다른 번호');
  p.settle('gift:u1');
  const a3 = p.idFor('gift:u1');
  chk(a3 !== a1 && !p.has('nope'), '  ↳ 끝내면(settle) 다음은 새 번호');
  chk(p.idFor(7) === p.idFor('7'), '  ↳ 키는 글자로 맞춘다(7 과 \'7\' 은 같은 일)');
  const q = R.createPending({ newId: () => 'q-' + String(++n).padStart(6, '0'), max: 3 });
  const first = q.idFor('k1'); q.idFor('k2'); q.idFor('k3'); q.idFor('k4');
  chk(q.size() === 3 && !q.has('k1') && q.idFor('k1') !== first, '  ↳ 상한을 넘으면 가장 오래된 키부터 버린다(' + q.size() + ')');
  const dflt = R.createPending();
  chk(SERVER_RE.test(dflt.idFor('x')) && R.PENDING_MAX >= 50, '  ↳ 기본은 브라우저 newId · 상한 ' + R.PENDING_MAX);

  say('── 4. 배선');
  const h = S.HTML, iR = h.indexOf('<script src="parts/shared/request-id.js"></script>'), iA = h.indexOf('<script src="parts/app.js"></script>');
  chk(iR > 0 && iR < iA, 'html — request-id.js 를 app.js 보다 먼저 싣는다');
}

judge(SRC0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ['RID', "const PATTERN = /^[A-Za-z0-9_-]{8,64}$/;", "const PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;", '규칙이 서버와 다름'],
  ['RID', "      if(isValid(v)) return v;", "      return v;", 'randomUUID 값을 거르지 않음'],
  ['RID', "  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;", "", 'uuid v4 표시를 안 함'],
  ['RID', "      if(ids.has(k)) return ids.get(k);", "", '같은 키에 새 번호(두 번 뽑힘)'],
  ['RID', "    settle(key){ ids.delete(String(key)); },", "    settle(key){},", '끝내도 같은 번호'],
  ['RID', "      if(ids.size > max) ids.delete(ids.keys().next().value);", "", '상한 없이 쌓임'],
  ['RID', "      const k = String(key);", "      const k = key;", '키를 글자로 맞추지 않음'],
  ['HTML', '<script src="parts/shared/request-id.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
