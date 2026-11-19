/* sim-z-layers.js — 🪟 창 층 표(desk-companion-prototype.html :root --z-…) · 창마다 실제 앞뒤 값
   실행:  node sim-z-layers.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 창 앞뒤(z-index)를 창마다 숫자로 적어 두어 «이 창이 저 창보다 위» 가 우연한 숫자 크기로만 정해졌다(B-1016-4 —
     마이홈(71)이 캐릭터 편집(55) 위에 겹침). 앞뒤는 :root 의 «창 층 표» 한 곳에서 이름으로만 정한다.
   ・1절: 표 — :root 에 이름이 다 있다 · 숫자
   ・2절: 창마다 — 표의 이름만 쓴다(숫자를 직접 적지 않는다) · 풀어 본 값
   ・3절: 층 차례 — 대화상자는 창 쌓기(83~92) · 꾸미기 위 · 막는 창은 대화상자 위 · 편집 · 종족은 창 쌓기 목록 안
   ・4절: 창 쌓기를 실제로 돌려 본다 — 마이홈을 누른 뒤 편집을 열면 편집이 위 · 그 뒤 마이홈을 누르면 마이홈이 위(B-1016-4)
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'app/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html');
const WS = (() => { for (const c of ['win-stack.js', 'parts/shared/win-stack.js', 'app/parts/shared/win-stack.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
if (!HTML && require.main === module) { say('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); }

/* 창(id) → 층 이름. 이 창들은 화면 맨 바깥에 뜨고 서로 겹칠 수 있다. */
const WINDOWS = {
  friendPicker: '--z-friend-picker', launcher: '--z-launcher', creatorOverlay: '--z-work', raceOverlay: '--z-work',
  codeOverlay: '--z-dialog-code', exportOverlay: '--z-dialog', glbEncOverlay: '--z-dialog', glbLoadOverlay: '--z-dialog', assetGenOverlay: '--z-dialog',
  assetImpOverlay: '--z-dialog', inviteOverlay: '--z-dialog', commGenOverlay: '--z-dialog', partRegOverlay: '--z-dialog', deskRegOverlay: '--z-dialog',
  focusSettingsPanel: '--z-win-settings', mobLinkOverlay: '--z-dialog-admin',
  inviteGrantOverlay: '--z-dialog-admin', inviteIssuedOverlay: '--z-dialog-admin', adminPassOverlay: '--z-dialog-admin', licenseGenOverlay: '--z-dialog-admin',
  announceOverlay: '--z-dialog-admin', updateNoticeAdminOverlay: '--z-dialog-admin', categoryManageOverlay: '--z-dialog-admin', gameCfgOverlay: '--z-dialog-admin',
  adBannerOverlay: '--z-dialog-admin', totalStatsOverlay: '--z-dialog-admin', roomInvitePickOverlay: '--z-dialog-admin',
  bellWin: '--z-win-bell', focusLogOverlay: '--z-win-focuslog', myHomeOverlay: '--z-win-myhome', mhGbOverlay: '--z-win-guestbook',
  updateNoticeUserOverlay: '--z-dialog-notice', chatOverlay: '--z-win-chat', pkOverlay: '--z-win-chat', wardrobePanel: '--z-wardrobe', wdPreviewPanel: '--z-wardrobe',
  charsLinkedOverlay: '--z-gate-device', deviceSessionOverlay: '--z-gate-device', inviteGateOverlay: '--z-gate-invite', mhDesignOverlay: '--z-mh-design',
  existingSignupOverlay: '--z-gate-signup', needLoginOverlay: '--z-gate-signup', signupDoneOverlay: '--z-gate-done',
};
/* 지금 값 — 이 표가 바뀌면 화면 앞뒤가 바뀐다(바꿀 때는 이 표와 관계 판정을 같이) */
const WANT = { '--z-friend-picker': 46, '--z-launcher': 50, '--z-work': 55, '--z-win-settings': 58, '--z-win-bell': 62, '--z-win-focuslog': 70, '--z-win-myhome': 71,
  '--z-win-guestbook': 74, '--z-win-chat': 82, '--z-wardrobe': 93, '--z-dialog-code': 100, '--z-dialog': 101, '--z-dialog-program': 102, '--z-dialog-admin': 103,
  '--z-dialog-notice': 104, '--z-gate-device': 110, '--z-gate-invite': 111, '--z-mh-design': 111, '--z-gate-signup': 112, '--z-gate-done': 113 };
const DIALOGS = ['--z-dialog-code', '--z-dialog', '--z-dialog-program', '--z-dialog-admin', '--z-dialog-notice'];
const GATES = ['--z-gate-device', '--z-gate-invite', '--z-gate-signup', '--z-gate-done'];

function parseTable(html) {
  const m = /:root\{([^}]*--z-[^}]*)\}/.exec(html);
  const t = {};
  if (m) for (const x of m[1].matchAll(/(--z-[\w-]+):\s*(\d+);/g)) t[x[1]] = +x[2];
  return t;
}
/* 창의 z-index 글 — 인라인 style 이 있으면 그것, 아니면 CSS 규칙(쉼표 묶음 · body.desktop 같은 앞붙이 없는 규칙)에서 */
function zTextOf(html, id) {
  const inl = new RegExp('<div id="' + id + '" style="([^"]*)"').exec(html);
  if (inl) { const z = /z-index:([^;]+);/.exec(inl[1]); if (z) return z[1].trim(); }
  const css = html.split('<style>').slice(1).map((x) => x.split('</style>')[0]).join('\n');
  const re = new RegExp('(?:^|\\n|\\})\\s*((?:#[\\w-]+\\s*,\\s*)*#' + id + '(?:\\s*,\\s*#[\\w-]+)*)\\s*\\{([^}]*)\\}', 'g');
  let m, out = null;
  while ((m = re.exec(css))) { const z = /z-index:\s*([^;]+);/.exec(m[2]); if (z) out = z[1].trim(); }
  return out;
}

function judge(html, ws) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const T = parseTable(html);
  const names = Object.keys(WANT);
  t(names.every((n) => n in T), ':root 창 층 표에 이름 ' + names.length + '개가 다 있다' + (names.filter((n) => !(n in T)).length ? ' — 없음: ' + names.filter((n) => !(n in T)).join(' · ') : ''));
  const diff = names.filter((n) => T[n] !== WANT[n]);
  t(!diff.length, '층 값 — ' + names.map((n) => n.slice(4) + ' ' + WANT[n]).join(' · ') + (diff.length ? ' — 다름: ' + diff.join(' · ') : ''));
  const raw = [], wrongName = [], unresolved = [];
  for (const [id, name] of Object.entries(WINDOWS)) {
    const z = zTextOf(html, id);
    if (z == null) { unresolved.push(id); continue; }
    const v = /^var\((--z-[\w-]+)\)$/.exec(z);
    if (!v) raw.push(id + '=' + z); else if (v[1] !== name) wrongName.push(id + '→' + v[1]);
  }
  t(!unresolved.length, '창 ' + Object.keys(WINDOWS).length + '개의 앞뒤 글을 찾았다' + (unresolved.length ? ' — 못 찾음: ' + unresolved.join(' · ') : ''));
  t(!raw.length, '창은 숫자를 직접 적지 않고 표의 이름(var(--z-…))만 쓴다' + (raw.length ? ' — 숫자: ' + raw.join(' · ') : ''));
  t(!wrongName.length, '창마다 맞는 층 이름 — 편집 · 종족 = 작업창, 코드 · 등록 = 대화상자, 마이홈 · 대화창 … = 창 쌓기, 가입 · 로그인 = 막는 창' + (wrongName.length ? ' — 다름: ' + wrongName.join(' · ') : ''));
  /* 층 차례 */
  const zmax = +((/WIN_Z_MIN = \d+, WIN_Z_MAX = (\d+)/.exec(ws || '') || [])[1] || NaN);
  /* 칸 하나 = id 하나 또는 함께 뜨지 않는 창 묶음(배열) — 칸 수는 묶음을 하나로 센다 */
  const listText = ((/const _WIN_Z_LAYERS = \[([\s\S]*?)\];/.exec(ws || '') || [])[1] || '');
  const layers = listText.match(/'[\w-]+'/g) || [];
  const slots = listText.trim() ? listText.replace(/\[[^\]]*\]/g, 'G').split(',').filter((x) => x.trim()).length : 0;
  const dMin = Math.min(...DIALOGS.map((n) => T[n])), dMax = Math.max(...DIALOGS.map((n) => T[n])), gMin = Math.min(...GATES.map((n) => T[n]));
  t(dMin > zmax && dMin > T['--z-wardrobe'], '★ 대화상자는 창 쌓기 맨 위(' + zmax + ') · 꾸미기(' + T['--z-wardrobe'] + ')보다 위 — 편집 · 마이홈 위에서 연 대화상자가 숨지 않는다(' + dMin + ')');
  t(gMin > dMax && T['--z-mh-design'] > dMax, '막는 창(가입 · 로그인 · 기기) · 마이홈 디자인은 대화상자보다 위(예전 차례 그대로)');
  t(DIALOGS.map((n) => T[n]).every((v, i, a) => !i || v > a[i - 1]), '대화상자끼리 차례는 예전 그대로(코드 < 묶음 < 프로그램 설정 < 관리자 < 공지)');
  t(["'creatorOverlay'", "'animalCreatorOverlay'", "'raceOverlay'", "'myHomeOverlay'", "'chatOverlay'"].every((x) => layers.includes(x)), '★ 편집 · 동물 만들기 · 종족 창도 창 쌓기 목록에 있다(마이홈 · 대화창과 같은 규칙)');
  const zmin = +((/WIN_Z_MIN = (\d+)/.exec(ws || '') || [])[1] || NaN);
  t(slots > 0 && zmax - zmin + 1 >= slots, '창 쌓기 칸(' + zmin + '~' + zmax + ')이 목록 칸 수(' + slots + ' — 창 ' + layers.length + '개 · 함께 뜨지 않는 묶음은 한 칸)보다 모자라지 않는다');
  return r;
}

/* 창 쌓기를 가짜 화면에 올려 돌린다 — 보임(display)은 el.shown, 관찰은 MutationObserver 가짜가 붙잡는다 */
function runStack(ws) {
  const els = {}, obs = [], L = {};
  const mk = (id) => (els[id] = { id, shown: false, style: { zIndex: '' }, classList: { contains: () => false } });
  ['chatOverlay', 'focusSettingsPanel', 'myStatusChip', 'focusLogOverlay', 'bellWin', 'myHomeOverlay', 'mhGbOverlay', 'pkOverlay', 'creatorOverlay', 'raceOverlay'].forEach(mk);
  const body = { id: 'body' };
  const doc = { body, getElementById: (id) => els[id] || null, addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, querySelector: () => null };
  class MO { constructor(cb) { this.cb = cb; obs.push(this); } observe(el) { this.el = el; } disconnect() { this.el = null; } }
  const win = {};
  const api = new Function('window', 'document', 'MutationObserver', 'getComputedStyle', 'module', ws + '\nreturn window.TwWinStack;')(win, doc, MO, (el) => ({ display: el.shown ? 'block' : 'none', visibility: 'visible' }), undefined);
  const out = api.createWinStack({});
  const show = (id, v) => { els[id].shown = v; obs.filter((o) => o.el === els[id]).forEach((o) => o.cb([])); };
  const press = (id) => (L.pointerdown || []).forEach((f) => f({ composedPath: () => [els[id], doc], target: els[id] }));
  /* 처음 열 때 만들어 body 에 붙는 창(동물 만들기) — 붙인 뒤 body 관찰을 부른다 */
  const append = (id, shown) => { mk(id).shown = !!shown; obs.filter((o) => o.el === body).forEach((o) => o.cb([])); };
  return { els, show, press, append, out, z: (id) => parseInt(els[id].style.zIndex, 10) || 0 };
}
function judgeStack(ws) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = runStack(ws); } catch (e) { err = e; }
  t(!err && w, '창 쌓기를 만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  w.show('myHomeOverlay', true); w.press('myHomeOverlay');
  w.show('creatorOverlay', true);
  t(w.z('creatorOverlay') > w.z('myHomeOverlay') && w.z('creatorOverlay') >= 83, '★ 마이홈을 띄운 채 편집을 열면 편집이 마이홈 위(B-1016-4)');
  w.press('myHomeOverlay');
  t(w.z('myHomeOverlay') > w.z('creatorOverlay'), '그 뒤 마이홈을 누르면 마이홈이 위(둘 다 떠 있고 누른 쪽이 앞)');
  w.show('chatOverlay', true);
  t(w.z('chatOverlay') > w.z('myHomeOverlay'), '나중에 연 창이 맨 앞(누르지 않아도) — 대화창');
  const before = w.z('chatOverlay'); w.els.chatOverlay.style.zIndex = String(before); w.show('chatOverlay', true);
  t(w.z('chatOverlay') === before, '이미 떠 있는 창의 class · style 이 바뀌어도 다시 올리지 않는다');
  /* 천장 — 목록 창 10개를 차례로 여러 번 눌러도 83~92 를 넘지 않는다 */
  const ids = Object.keys(w.els);
  for (let k = 0; k < 3; k++) ids.forEach((id) => w.press(id));
  const zs = ids.map((id) => w.z(id));
  t(zs.every((z) => z >= 83 && z <= 92) && w.z(ids[ids.length - 1]) === Math.max(...zs), '여러 번 눌러도 83~92 안 · 마지막에 누른 창이 맨 위(천장에서 다시 매길 때 올리는 창은 빼고)');
  w.show('raceOverlay', false);
  w.show('raceOverlay', true);
  t(w.z('raceOverlay') > w.z('chatOverlay'), '종족 선택도 열면 맨 앞');
  /* 동물 만들기 — 실을 때 없고 처음 열 때 body 에 붙는다 · 사람 편집과 한 칸 */
  w.show('creatorOverlay', false); w.show('raceOverlay', false);
  w.press('myHomeOverlay'); w.press('chatOverlay');
  w.append('animalCreatorOverlay', true);
  t(w.z('animalCreatorOverlay') > w.z('chatOverlay') && w.z('animalCreatorOverlay') > w.z('myHomeOverlay'), '★ 처음 열 때 만들어진 동물 만들기 창도 열면 맨 앞(마이홈 · 대화창 위)');
  t(w.z('animalCreatorOverlay') === w.z('creatorOverlay'), '  ↳ 사람 편집과 한 칸 — 같은 숫자(둘은 함께 뜨지 않는다)');
  w.press('myHomeOverlay');
  t(w.z('myHomeOverlay') > w.z('animalCreatorOverlay'), '  ↳ 그 뒤 마이홈을 누르면 마이홈이 위');
  w.press('animalCreatorOverlay');
  t(w.z('animalCreatorOverlay') > w.z('myHomeOverlay'), '  ↳ 동물 창을 누르면 다시 위');
  w.show('animalCreatorOverlay', false); w.press('chatOverlay'); w.show('animalCreatorOverlay', true);
  t(w.z('animalCreatorOverlay') > w.z('chatOverlay'), '  ↳ 닫았다 다시 열어도 맨 앞(붙은 뒤엔 보통 창처럼 관찰)');
  const ids2 = Object.keys(w.els);
  for (let k = 0; k < 3; k++) ids2.forEach((id) => w.press(id));
  t(ids2.every((id) => w.z(id) >= 83 && w.z(id) <= 92), '창이 11개(칸 10)여도 83~92 를 넘지 않는다');
  /* 사람 편집이 맨 앞 숫자를 가진 채 동물 창이 처음 붙는 길(편집 창에서 동물 캐릭터 고치기 — 종족 선택을 안 거친다) */
  const v = runStack(ws);
  v.show('myHomeOverlay', true); v.show('chatOverlay', true);
  v.show('creatorOverlay', true); v.show('creatorOverlay', false);
  v.append('animalCreatorOverlay', true);
  t(v.z('animalCreatorOverlay') > v.z('chatOverlay') && v.z('animalCreatorOverlay') > v.z('myHomeOverlay'), '★ 사람 편집이 맨 앞인 채 붙은 동물 창도 맨 앞(묶음의 높은 숫자를 «이미 맨 앞» 으로 보지 않는다)');
  return r;
}

/* 다른 검사가 쓰는 풀이 — z-index 글(숫자 · var(--z-…))을 숫자로. 창 앞뒤를 읽는 검사는 이것으로 읽는다(표를 따로 풀지 말 것). */
function resolveZ(html, text) {
  if (text == null) return null;
  const s0 = String(text).trim();
  if (/^\d+$/.test(s0)) return +s0;
  const v = /^var\((--z-[\w-]+)\)$/.exec(s0);
  if (!v) return null;
  const T = parseTable(html);
  return v[1] in T ? T[v[1]] : null;
}
module.exports = { parseTable, resolveZ, zTextOf };

if (require.main === module) {
say('── 1 · 2 · 3. 창 층 표 · 창마다 · 층 차례');
judge(HTML, WS).forEach(([ok, msg]) => chk(ok, msg));
say('── 4. 창 쌓기를 돌려 본다');
judgeStack(WS).forEach(([ok, msg]) => chk(ok, msg));
say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['마이홈이 숫자를 직접', (h) => h.replace('#myHomeOverlay{display:none;position:fixed;inset:0;z-index:var(--z-win-myhome);', '#myHomeOverlay{display:none;position:fixed;inset:0;z-index:71;')],
  ['편집 창이 대화상자 층', (h) => h.replace('#creatorOverlay{position:fixed;inset:0;z-index:var(--z-work);', '#creatorOverlay{position:fixed;inset:0;z-index:var(--z-dialog);')],
  ['관리자 창 인라인 숫자', (h) => h.replace(/(<div id="adBannerOverlay" style="[^"]*?)z-index:var\(--z-dialog-admin\);/, '$1z-index:60;')],
  ['표 값 바뀜', (h) => h.replace('--z-work: 55;', '--z-work: 54;')],
  ['표 이름 빠짐', (h) => h.replace(/\n\s*--z-win-bell: 62;[^\n]*/, '')],
  ['대화상자를 창 쌓기 아래로(옛 57)', (h) => h.replace('--z-dialog: 101;', '--z-dialog: 57;')],
  ['막는 창이 대화상자 아래로', (h) => h.replace('--z-gate-invite: 111;', '--z-gate-invite: 95;')],
  ['편집 창을 창 쌓기에서 뺌', null, (w) => w.replace(", ['creatorOverlay', 'animalCreatorOverlay'], 'raceOverlay'];", ", 'raceOverlay'];")],
  ['동물 만들기를 칸 묶음에서 뺌', null, (w) => w.replace("['creatorOverlay', 'animalCreatorOverlay']", "'creatorOverlay'")],
  ['나중에 붙는 창 관찰 없앰', null, (w) => w.replace('late.observe(document.body, { childList:true });', '')],
  ['열면 맨 앞 규칙 없앰', null, (w) => w.replace('if(now && !shown) bringWinToFront(id);', '')],
  ['칸 숫자를 묶음의 가장 높은 창으로', null, (w) => w.replace('Math.min(..._winSlotEls(slot).map(_winZOf))', 'Math.max(0, ..._winSlotEls(slot).map(_winZOf))')],
  ['천장에서 올리는 창까지 다시 매김', null, (w) => w.replace('.filter(x=>x!==slot && _winSlotEls(x).length)', '.filter(x=>_winSlotEls(x).length)')],
];
for (const [name, f, fw] of breaks) {
  const h2 = f ? f(HTML) : HTML, w2 = fw ? fw(WS) : WS;
  const changed = h2 !== HTML || w2 !== WS;
  let rows; try { rows = judge(h2, w2).concat(judgeStack(w2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 창 앞뒤는 :root 창 층 표에서'));
process.exit(fail ? 1 : 0);
}
