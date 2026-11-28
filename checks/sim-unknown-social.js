/* sim-unknown-social.js — 🔓 모르는 서버 값을 그럴듯한 값으로 바꾸지 않는다(CLAUDE.md) — 동물 해금 · 복제 코드 동물 판정 · 남의 레벨
   실행: node checks/run.js sim-unknown-social
   ★ 왜 — 해금 레벨(서버 해금 표)을 받기 전 animal.js 가 50 으로 쳐서, 서버 값이 더 높은 사람도 «조건 만족» 으로 열리고
     그 판단이 계정 칸 tw.animalEverUnlocked 에 영구로 남았다(모름에서 나온 값을 저장). 남의 레벨은 모르면 Lv.1 로 그렸다.
   ・1절 animal.js — 해금 레벨 모름(null): 카드 «해금 정보를 받는 중» · 누르면 같은 안내 · 열지 않음 · EVER_KEY 안 적음
         받은 뒤: 레벨이 넘으면 열고 EVER_KEY 를 적음 · 모자라면 «Lv.N 보상» · 내 레벨 모름이면 tellLevelUnknown(안 적음) · 지난번 서버에서 받아 둔 EVER 는 그대로 연다
   ・2절 char-code.js — 복제 코드 동물: 해금 레벨 모름이면 «받는 중» 으로 막음 · 내 레벨 모름이면 tellLevelUnknown · animal.js 가 없을 때도 모름으로 열지 않음
   ・3절 room-entry.js · frame-loop.js — 방에 실린 남의 레벨: 1 이상 정수만, 아니면 null(이름표는 이름만)
   ・4절 mutation test — 옛 대신 값(50 · `|| 50` · `|| 1`)을 되살리면 빨강 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, path.basename(f), path.join('apps', 'desktop', 'app', 'parts', f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const ANIMAL = read('character/animal.js'), CC = read('character/char-code.js'), RE = read('room/room-entry.js'), FL = read('launcher/frame-loop.js');
if (!ANIMAL || !CC || !RE || !FL) { say('  ? 원본 못 찾음 — animal.js · char-code.js · room-entry.js · frame-loop.js'); process.exit(2); }

/* 이름 · 머리글로 덩어리 하나를 오려 낸다(중괄호 짝) */
function cutFrom(src, head){
  const at = src.indexOf(head);
  if (at < 0) return null;
  const open = src.indexOf('{', at + head.length - 1);
  let d = 0;
  for (let j = open; j < src.length; j++){
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(at, j + 1);
  }
  return null;
}
const cutFn = (src, name) => { const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src); return m ? cutFrom(src, m[0]) : null; };
const line = (src, re) => { const m = re.exec(src); return m ? m[0] : null; };

/* ── animal.js 의 해금 몫을 가짜 카드 · 계정 칸 위에서 돌린다 ── */
function animalWorld(src, o){
  const parts = [
    line(src, /let UNLOCK_LEVEL = [^;]+;/), line(src, /const CHEAT_KEY = [^;]+;/), line(src, /const CHEAT_CLICKS = [^;]+;/),
    line(src, /let _lKeyDown=[^;]+;/), line(src, /let _cheatOn=[^;]+;/), line(src, /const EVER_KEY = [^;]+;/), line(src, /const UNLOCK_LOADING_TEXT = [^;]+;/),
    cutFn(src, '_cheatUnlocked'), cutFn(src, '_everUnlocked'), cutFn(src, '_unlockOk'), cutFn(src, 'myLevel'), cutFn(src, '_lockMsg'), cutFn(src, 'admin'), cutFn(src, 'initCard'),
    cutFrom(src, 'window._setAnimalUnlockLevel = function(lv){'), cutFrom(src, 'window._animalLoadLocal = function(){'),
  ];
  if (parts.some(p => !p)) throw new Error('오려 낼 덩어리를 못 찾음 — ' + parts.map((p, i) => p ? '' : i).filter(String).join(','));
  const log = { toasts: [], sets: [], started: 0, unknownTold: 0 };
  const store = new Map(Object.entries(o.store || {}));
  const under = { style: { display: '' }, textContent: '' };
  const card = { classList: { remove(){} }, removeAttribute(){}, style: {}, title: '', onclick: null, querySelector: (s) => (s === '.race-underwork' ? under : null) };
  const document = { getElementById: (id) => (id === 'raceAnimal' ? card : null) };
  const window = {};
  const lv = () => o.level;
  const focusLevelMod = { getFocusLevel: lv, shownFocusLevel: lv, levelGate: (min) => (lv() == null ? 'unknown' : (lv() >= min ? 'ok' : 'low')), tellLevelUnknown: () => { log.unknownTold++; } };
  const accountStoreMod = { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => { log.sets.push([k, v]); store.set(k, v); } };
  new Function('window', 'document', 'focusLevelMod', 'accountStoreMod', 'isAdmin', 'toast', 'startNewAnimal', 'renderAnimalCardThumb', 'setTimeout',
    parts.join('\n'))(window, document, focusLevelMod, accountStoreMod, () => false, (m) => log.toasts.push(m), () => { log.started++; }, () => {}, () => 0);
  window._animalLoadLocal();   // 계정 칸이 열린 뒤(확인 뒤) — 해금 기록을 읽고 카드를 그린다
  return { window, card, under, log, store, setLevel: (v) => { o.level = v; } };
}
function animalRows(src){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    let w = animalWorld(src, { level: 120 });
    t(w.under.textContent === '🔒 해금 정보를 받는 중이에요' && /해금 정보를 받는 중/.test(w.card.title), '해금 레벨을 받기 전 — 카드는 «🔒 해금 정보를 받는 중이에요»(Lv.50 같은 글자를 지어내지 않는다)');
    w.card.onclick();
    t(w.log.started === 0 && w.log.toasts.length === 1 && /^🔒 해금 정보를 받는 중이에요/.test(w.log.toasts[0]), '  누르면 같은 안내 · 열지 않는다');
    t(w.log.sets.length === 0 && !w.store.has('tw.animalEverUnlocked'), '  ★ 모르는 해금 레벨로 «영구 해금»(tw.animalEverUnlocked)을 적지 않는다');
    t(w.window._setAnimalUnlockLevel(100) === true && w.under.style.display === 'none', '서버 해금 표가 오면(100) Lv.120 은 열린다 · 띠를 숨긴다');
    t(w.log.sets.length === 1 && w.log.sets[0][0] === 'tw.animalEverUnlocked' && w.log.sets[0][1] === '1', '  그때 처음 영구 해금을 적는다(내 레벨 · 해금 레벨 둘 다 서버 값)');
    w = animalWorld(src, { level: 120 }); w.window._setAnimalUnlockLevel(150); w.card.onclick();
    t(w.log.started === 0 && w.log.toasts[0] === '🔒 동물 캐릭터는 Lv.150 달성 보상이에요 (현재 Lv.120)' && w.log.sets.length === 0 && w.under.textContent === '🔒 Lv.150 달성 시 해금', '받았는데 모자라면(150 > 120) «Lv.150 보상» · 안 적음');
    w = animalWorld(src, { level: null }); w.window._setAnimalUnlockLevel(100); w.card.onclick();
    t(w.log.started === 0 && w.log.unknownTold === 1 && w.log.toasts.length === 0 && w.log.sets.length === 0, '내 레벨을 모르면 tellLevelUnknown(«불러오는 중» · «못 불러옴 [다시 시도]») · 안 적음');
    w = animalWorld(src, { level: null }); w.card.onclick();
    t(w.log.unknownTold === 1 && w.log.toasts.length === 0, '  둘 다 모르면 내 레벨 쪽 안내 하나');
    w = animalWorld(src, { level: null, store: { 'tw.animalEverUnlocked': '1' } }); w.card.onclick();
    t(w.log.started === 1 && w.under.style.display === 'none', '지난번 서버 값으로 적어 둔 영구 해금은 모를 때도 그대로 연다(출처가 서버)');
    t(w.window._setAnimalUnlockLevel(0) === false && w.window._setAnimalUnlockLevel('x') === false, '  해금 레벨 받기는 1~999 정수만');
  } catch (e) { t(false, 'animal.js 해금 몫을 돌리다 멈춤 — ' + e.message); }
  return r;
}

/* ── char-code.js 의 동물 판정 덩어리 ── */
function ccRun(src, o){
  const block = cutFrom(src, 'if(def.animal){');
  if (!block) throw new Error('char-code.js 에 동물 판정 덩어리가 없다');
  const log = { toasts: [], unknownTold: 0 };
  const window = { _animalUnlockLevel: o.ulv };
  if (o.unlockedFn !== undefined) window._animalUnlocked = () => o.unlockedFn;
  const fl = { getFocusLevel: () => o.level, shownFocusLevel: () => o.level, levelGate: (m) => (o.level == null ? 'unknown' : (o.level >= m ? 'ok' : 'low')), tellLevelUnknown: () => { log.unknownTold++; } };
  const ok = new Function('window', 'focusLevelMod', 'isAdmin', 'toast', 'def', block + '\nreturn true;')(window, () => fl, () => false, (m) => log.toasts.push(m), { animal: true });
  return { ok, log };
}
function ccRows(src){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    let x = ccRun(src, { ulv: null, level: 120, unlockedFn: false });
    t(x.ok === false && x.log.toasts.length === 1 && /^🔒 해금 정보를 받는 중이에요/.test(x.log.toasts[0]), '해금 레벨을 모르면 «해금 정보를 받는 중» 으로 막는다(«Lv.50 필요» 가 아니다)');
    x = ccRun(src, { ulv: 100, level: null, unlockedFn: false });
    t(x.ok === false && x.log.unknownTold === 1 && x.log.toasts.length === 0, '내 레벨을 모르면 tellLevelUnknown');
    x = ccRun(src, { ulv: 100, level: 60, unlockedFn: false });
    t(x.ok === false && x.log.toasts[0] === '🔒 동물 캐릭터는 Lv.100 달성 후 불러올 수 있어요 (현재 Lv.60)', '받았는데 모자라면 «Lv.100 … (현재 Lv.60)»');
    x = ccRun(src, { ulv: 100, level: 120, unlockedFn: true });
    t(x.ok === true && x.log.toasts.length === 0, '열려 있으면 그대로 진행');
    x = ccRun(src, { ulv: null, level: 60 });
    t(x.ok === false, 'animal.js 가 없을 때(판정 창구 없음)도 해금 레벨을 모르면 열지 않는다(50 으로 치지 않는다)');
    x = ccRun(src, { ulv: 50, level: 60 });
    t(x.ok === true, '  창구가 없고 둘 다 알면 레벨로 판정(60 ≥ 50)');
  } catch (e) { t(false, 'char-code.js 동물 판정을 돌리다 멈춤 — ' + e.message); }
  return r;
}

/* ── 남의 레벨 ── */
function levelRows(re, fl){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    const fn = cutFn(re, '_remoteLevel');
    if (!fn) throw new Error('room-entry.js 에 _remoteLevel 이 없다');
    const L = new Function(fn + '\nreturn _remoteLevel;')();
    t(L(3) === 3 && L(1) === 1 && L(999) === 999, '1 이상 정수는 그대로(1 · 3 · 999)');
    t([undefined, null, 0, -1, 2.5, '5', NaN].every(v => L(v) === null), '  모르는 값(없음 · 0 · 음수 · 소수 · 글자 · NaN)은 null — Lv.1 로 치지 않는다');
    t(/\n\s*s\.friendLevel=_remoteLevel\(friends\[id\]\.level\);/.test(re), '  방 좌석에 앉힐 때(syncFriendSeats) 이 함수로 받는다');
    t(/lv = st \? st\.lv : seat\.friendLevel;/.test(fl) && !/friendLevel\s*\|\|\s*1/.test(fl), 'frame-loop — 남의 이름표 · 바는 그 값 그대로(null 이면 이름만 — overhead.js setSeatNamePlate)');
  } catch (e) { t(false, '남의 레벨 판정이 멈춤 — ' + e.message); }
  return r;
}

const all = (rows) => rows.every(([ok]) => ok);
say('── 1. animal.js — 동물 해금');
animalRows(ANIMAL).forEach(([ok, m]) => chk(ok, m));
say('── 2. char-code.js — 복제 코드 동물');
ccRows(CC).forEach(([ok, m]) => chk(ok, m));
say('── 3. 남의 레벨');
levelRows(RE, FL).forEach(([ok, m]) => chk(ok, m));

say('── 4. mutation test — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['A', 'let UNLOCK_LEVEL = null;', 'let UNLOCK_LEVEL = 50;', '해금 레벨 처음 값을 50 으로(받기 전 열리고 영구 해금을 적음)'],
  ['A', 'if(lv != null && UNLOCK_LEVEL != null && lv >= UNLOCK_LEVEL){', 'if(lv != null && lv >= UNLOCK_LEVEL){', '해금 레벨을 모를 때도 «만족» 으로(null 비교 — 영구 해금을 적음)'],
  ['A', "      if(UNLOCK_LEVEL == null){ toast(UNLOCK_LOADING_TEXT + ' — 잠시 뒤 다시 해 주세요'); return; }", '', '모를 때 «Lv.null 보상» 을 띄움'],
  ['A', "under.textContent = UNLOCK_LEVEL == null ? UNLOCK_LOADING_TEXT : ('🔒 Lv.'+UNLOCK_LEVEL+' 달성 시 해금');", "under.textContent = '🔒 Lv.'+UNLOCK_LEVEL+' 달성 시 해금';", '카드 띠에 모르는 레벨 글자를 씀'],
  ['A', "      if(focusLevelMod.getFocusLevel() == null){ focusLevelMod.tellLevelUnknown(); return; }", '', '내 레벨을 모를 때 «Lv.N 보상» 으로'],
  ['C', 'const _ulv = (window._animalUnlockLevel == null) ? null : window._animalUnlockLevel;', 'const _ulv = window._animalUnlockLevel || 50;', '복제 코드 — 해금 레벨 모름을 50 으로(옛 `|| 50`)'],
  ['C', '    else if(_lv == null || _ulv == null) _ok = isAdmin();   // 둘 중 하나라도 모르면 레벨로는 열지 않는다\n', '', '복제 코드 — 모름끼리 비교(null >= null 이 열림)'],
  ['C', "    if(!_ok && _ulv == null){ toast('🔒 해금 정보를 받는 중이에요 — 잠시 뒤 다시 해 주세요'); return false; }", '', '복제 코드 — 모를 때 «Lv.null» 안내'],
  ['R', "? v : null; }", "? v : 1; }", '남의 레벨 모름을 1 로'],
  ['R', 's.friendLevel=_remoteLevel(friends[id].level);', 's.friendLevel=friends[id].level||1;', '좌석에 앉힐 때 옛 `|| 1`'],
  ['F', 'lv = st ? st.lv : seat.friendLevel;', 'lv = st ? st.lv : (seat.friendLevel||1);', '이름표에 옛 `|| 1`'],
];
const missed = [];
for (const [where, from, to, what] of BREAKS){
  const src = { A: ANIMAL, C: CC, R: RE, F: FL }[where];
  if (src.indexOf(from) < 0){ missed.push(what + '(글을 못 찾음)'); continue; }
  const m = src.split(from).join(to);
  const rows = where === 'A' ? animalRows(m) : where === 'C' ? ccRows(m) : levelRows(where === 'R' ? m : RE, where === 'F' ? m : FL);
  if (all(rows)) missed.push(what);
}
chk(!missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 모르는 해금 레벨 · 남의 레벨을 그럴듯한 값으로 바꾸지 않는다'));
process.exit(fail ? 1 : 0);
