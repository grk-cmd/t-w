/* sim-myhome-sticker-rules.js — 🔒 마이홈 스티커 잠금 · 그리는 순서 규칙(myhome-sticker-rules.js)
   실행:  node sim-myhome-sticker-rules.js   (myhome-sticker-rules.js · myhome-edit.js · app.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 순서를 키 이름에 기대면 서버가 사전순으로 돌려줘 ▲▼ 가 저장 뒤에 되돌아가고,
     z 없는 옛 스티커가 새 스티커 앞으로 튀어나오면 붙인 지 오래된 것이 갑자기 위를 덮는다. 잠금은 끌기 한 길이라도 빠지면 «잠갔는데 움직였다» 가 된다.
   ・1절: 규칙을 실제로 돌린다 — 잠금 · 풀기 · 순서(z · 옛 스티커 · 섞임 · 같은 z) · 새 z · ▲▼(끝 · 없는 id · 잘못된 방향 · 다시 매김)
   ・2절: 깨 보기 — 규칙 글을 망가뜨려 1절 판정이 빨강이 되는지 스스로 굴린다
   ・3절: 배선 — 끌기(myhome-edit.js)가 잠금을 본다 · 새 스티커 z · 그리기 순서(app.js) · html · smoke 순서 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/parts/myhome/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome-sticker-rules.js'), EDIT = read('myhome-edit.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !EDIT || !APP || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — myhome-sticker-rules.js · myhome-edit.js · app.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwMyHomeStickerRules; };

/* 1절 판정 — 깨 보기(2절)가 같은 판정을 다시 굴린다. 실패한 줄 이름을 돌려준다. */
function judge(R){
  const bad = [];
  const t = (ok, name) => { if (!ok) bad.push(name); };
  try {
    t(R.isLocked({ locked: true }) === true && R.isLocked({}) === false && R.isLocked(null) === false && R.isLocked(undefined) === false, '잠금 판정');
    const s = { x: 1 }; R.setLocked(s, true); const on = s.locked === true; R.setLocked(s, false);
    t(on && !('locked' in s) && s.x === 1, '잠그기 · 풀면 칸 지움');
    t(JSON.stringify(R.orderedIds({ s1: {}, s2: {}, s3: {} })) === '["s1","s2","s3"]', '옛 스티커(z 없음)는 키 순서');
    t(JSON.stringify(R.orderedIds({ a: { z: 2 }, b: { z: 0 }, c: { z: 1 } })) === '["b","c","a"]', 'z 작은 것부터(뒤 → 앞)');
    t(JSON.stringify(R.orderedIds({ old1: {}, n: { z: 0 }, old2: {} })) === '["old1","old2","n"]', '옛 스티커는 z 받은 것보다 뒤');
    t(JSON.stringify(R.orderedIds({ a: { z: 1 }, b: { z: 1 } })) === '["a","b"]', '같은 z 는 키 순서');
    t(JSON.stringify(R.orderedIds({ a: { z: 'x' }, b: { z: NaN } })) === '["a","b"]', '숫자 아닌 z 는 없는 것으로');
    t(R.orderedIds(null).length === 0 && R.orderedIds(undefined).length === 0, '빈 묶음');
    t(R.nextZ({}) === 0 && R.nextZ({ a: {}, b: {} }) === 0 && R.nextZ({ a: { z: 4 }, b: { z: 1 } }) === 5 && R.nextZ(null) === 0, '새 z = 맨 앞 + 1');
    const st = { a: {}, b: {}, c: {} };
    t(R.move(st, 'a', 1) === true && JSON.stringify(R.orderedIds(st)) === '["b","a","c"]' && st.a.z === 1 && st.b.z === 0 && st.c.z === 2, '▲ 한 칸 앞 · 모두 다시 매김');
    t(R.move(st, 'c', 1) === false && st.c.z === 2, '맨 앞에서 ▲ 는 안 함');
    t(R.move(st, 'b', -1) === false, '맨 뒤에서 ▼ 는 안 함');
    t(R.move(st, 'c', -1) === true && JSON.stringify(R.orderedIds(st)) === '["b","c","a"]', '▼ 한 칸 뒤');
    t(R.move(st, 'zz', 1) === false && R.move(st, 'a', 2) === false && R.move(null, 'a', 1) === false, '없는 id · 잘못된 방향 · 빈 묶음');
    const mixed = { old: {}, n1: { z: 0 }, n2: { z: 1 } };
    R.move(mixed, 'old', 1);
    t(JSON.stringify(R.orderedIds(mixed)) === '["n1","old","n2"]' && mixed.old.z === 1, '옛 스티커도 옮기면 자리를 받는다');
  } catch (e) { bad.push('던짐 — ' + (e && e.message)); }
  return bad;
}

say('── 1. 규칙 실제로 돌리기');
const R = load(MOD);
chk(!!R && ['isLocked', 'setLocked', 'orderedIds', 'nextZ', 'move'].every(k => typeof R[k] === 'function'), '싣기만 하면 window.TwMyHomeStickerRules — 다섯 이름');
const bad = judge(R);
['잠금 판정', '잠그기 · 풀면 칸 지움', '옛 스티커(z 없음)는 키 순서', 'z 작은 것부터(뒤 → 앞)', '옛 스티커는 z 받은 것보다 뒤', '같은 z 는 키 순서',
 '숫자 아닌 z 는 없는 것으로', '빈 묶음', '새 z = 맨 앞 + 1', '▲ 한 칸 앞 · 모두 다시 매김', '맨 앞에서 ▲ 는 안 함', '맨 뒤에서 ▼ 는 안 함', '▼ 한 칸 뒤',
 '없는 id · 잘못된 방향 · 빈 묶음', '옛 스티커도 옮기면 자리를 받는다'].forEach(n => chk(!bad.includes(n), n));
chk(!bad.some(n => /^던짐/.test(n)), '던지지 않는다' + (bad.find(n => /^던짐/.test(n)) ? ' — ' + bad.find(n => /^던짐/.test(n)) : ''));

say('── 2. 깨 보기 — 규칙을 망가뜨리면 1절이 빨강인가');
const BREAKS = [
  ['옛 스티커를 앞으로', 'i - ids.length;', 'i + 1000;'],
  ['z 를 거꾸로', '(a.z - b.z) || (a.i - b.i)', '(b.z - a.z) || (a.i - b.i)'],
  ['풀 때 false 를 남김', 'else delete s.locked;', 'else s.locked = false;'],
  ['새 z 를 0 으로', 'return max + 1;', 'return 0;'],
  ['다시 매기지 않음', 'order.forEach((id, k) => { stickers[id].z = k; });', ''],
  ['끝 넘어 옮김', 'if(j < 0 || j >= order.length) return false;', ''],
];
for (const [name, a, b] of BREAKS) {
  if (!MOD.includes(a)) { chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음(규칙 글이 바뀌었으면 이 표도)'); continue; }
  let R2 = null; try { R2 = load(MOD.replace(a, b)); } catch (_) {}
  chk(!R2 || judge(R2).length > 0, '깨 보기 «' + name + '» → 빨강');
}

say('── 3. 배선');
const zd = EDIT.slice(EDIT.indexOf("zone.addEventListener('mousedown'"), EDIT.indexOf('dragSticker=el;'));
chk(/^const mhStickerRules = TwMyHomeStickerRules;/m.test(EDIT) && /mhStickerRules\.isLocked\(\(_myHomeData\(\)\.stickers\|\|\{\}\)\[el\.dataset\.sid\]\)\) return;/.test(zd), '★ 마이홈 스티커 끌기(편집모드 밖)도 잠긴 스티커는 안 잡는다');
chk(/z: mhStickerRules\.nextZ\(_myHomeData\(\)\.stickers\),/.test(EDIT), '  새 스티커는 맨 앞 z');
const rs = APP.slice(APP.indexOf('function renderMyHomeStickers(){'), APP.indexOf('function renderMyHomeStickers(){') + 1200);
chk(/TwMyHomeStickerRules\.orderedIds\(data\)\.forEach\(sid=>/.test(rs) && !/Object\.keys\(data\)\.forEach\(sid=>/.test(rs), '★ 그리기는 z 순서(뒤 → 앞) — 키 순서로 그리지 않는다');
chk(/TwMyHomeStickerRules\.isLocked\(s\)\) el\.classList\.add\('locked'\)/.test(rs) && /\.mh-sticker\.locked\{cursor:not-allowed;\}/.test(HTML), '  잠긴 스티커 표시(커서)');
const iR = HTML.indexOf('<script src="parts/myhome/myhome-sticker-rules.js">');
chk(iR > 0 && iR < HTML.indexOf('<script src="parts/myhome/myhome-sticker.js">') && iR < HTML.indexOf('<script src="parts/myhome/myhome-edit.js">') && iR < HTML.indexOf('<script src="parts/app.js">'), 'html — 규칙은 관리 창 · 편집 묶음 · app.js 보다 먼저');
const iS = SMOKE.indexOf("PRELOAD.push('myhome-sticker-rules.js')");
chk(iS > 0 && iS < SMOKE.indexOf("PRELOAD.push('myhome-sticker.js')"), 'smoke — 관리 창보다 먼저 싣는다');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 잠근 스티커는 그대로 · 순서는 z 로'));
process.exit(fail ? 1 : 0);
