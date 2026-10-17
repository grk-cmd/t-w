/* sim-z-layers.js — 🪟 창 층 표(desk-companion-prototype.html :root --z-…) · 창마다 실제 앞뒤 값
   실행:  node sim-z-layers.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 창 앞뒤(z-index)를 창마다 숫자로 적어 두어 «이 창이 저 창보다 위» 가 우연한 숫자 크기로만 정해졌다(B-1016-4 —
     마이홈(71)이 캐릭터 편집(55) 위에 겹침). 앞뒤는 :root 의 «창 층 표» 한 곳에서 이름으로만 정한다.
   ・1절: 표 — :root 에 이름이 다 있다 · 숫자
   ・2절: 창마다 — 표의 이름만 쓴다(숫자를 직접 적지 않는다) · 풀어 본 값
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'app/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html');
if (!HTML && require.main === module) { say('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); }

/* 창(id) → 층 이름. 이 창들은 화면 맨 바깥에 뜨고 서로 겹칠 수 있다. */
const WINDOWS = {
  friendPicker: '--z-friend-picker', launcher: '--z-launcher', creatorOverlay: '--z-work', raceOverlay: '--z-work',
  codeOverlay: '--z-dialog-code', exportOverlay: '--z-dialog', glbEncOverlay: '--z-dialog', glbLoadOverlay: '--z-dialog', assetGenOverlay: '--z-dialog',
  assetImpOverlay: '--z-dialog', inviteOverlay: '--z-dialog', commGenOverlay: '--z-dialog', partRegOverlay: '--z-dialog', deskRegOverlay: '--z-dialog',
  focusSettingsPanel: '--z-win-settings', programSettingsOverlay: '--z-dialog-program', mobLinkOverlay: '--z-dialog-admin',
  inviteGrantOverlay: '--z-dialog-admin', inviteIssuedOverlay: '--z-dialog-admin', adminPassOverlay: '--z-dialog-admin', licenseGenOverlay: '--z-dialog-admin',
  announceOverlay: '--z-dialog-admin', updateNoticeAdminOverlay: '--z-dialog-admin', categoryManageOverlay: '--z-dialog-admin', gameCfgOverlay: '--z-dialog-admin',
  adBannerOverlay: '--z-dialog-admin', totalStatsOverlay: '--z-dialog-admin', roomInvitePickOverlay: '--z-dialog-admin',
  bellWin: '--z-win-bell', focusLogOverlay: '--z-win-focuslog', myHomeOverlay: '--z-win-myhome', mhGbOverlay: '--z-win-guestbook',
  updateNoticeUserOverlay: '--z-dialog-notice', chatOverlay: '--z-win-chat', pkOverlay: '--z-win-chat', wardrobePanel: '--z-wardrobe', wdPreviewPanel: '--z-wardrobe',
};
/* 지금 값 — 이 표가 바뀌면 화면 앞뒤가 바뀐다(바꿀 때는 이 표와 관계 판정을 같이) */
const WANT = { '--z-friend-picker': 46, '--z-launcher': 50, '--z-work': 55, '--z-dialog-code': 56, '--z-dialog': 57, '--z-win-settings': 58, '--z-dialog-program': 59,
  '--z-dialog-admin': 60, '--z-win-bell': 62, '--z-win-focuslog': 70, '--z-win-myhome': 71, '--z-win-guestbook': 74, '--z-dialog-notice': 75, '--z-win-chat': 82, '--z-wardrobe': 93 };

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

function judge(html) {
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
  t(!wrongName.length, '창마다 맞는 층 이름 — 편집 · 종족 = 작업창, 코드 · 등록 = 대화상자, 마이홈 · 대화창 … = 창 쌓기' + (wrongName.length ? ' — 다름: ' + wrongName.join(' · ') : ''));
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
say('── 1 · 2. 창 층 표 · 창마다');
judge(HTML).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['마이홈이 숫자를 직접', (h) => h.replace('#myHomeOverlay{display:none;position:fixed;inset:0;z-index:var(--z-win-myhome);', '#myHomeOverlay{display:none;position:fixed;inset:0;z-index:71;')],
  ['편집 창이 대화상자 층', (h) => h.replace('#creatorOverlay{position:fixed;inset:0;z-index:var(--z-work);', '#creatorOverlay{position:fixed;inset:0;z-index:var(--z-dialog);')],
  ['관리자 창 인라인 숫자', (h) => h.replace(/(<div id="adBannerOverlay" style="[^"]*?)z-index:var\(--z-dialog-admin\);/, '$1z-index:60;')],
  ['표 값 바뀜', (h) => h.replace('--z-work: 55;', '--z-work: 54;')],
  ['표 이름 빠짐', (h) => h.replace(/\n\s*--z-win-bell: 62;[^\n]*/, '')],
];
for (const [name, f] of breaks) {
  const h2 = f(HTML);
  const changed = h2 !== HTML;
  const rows = judge(h2);
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 창 앞뒤는 :root 창 층 표에서'));
process.exit(fail ? 1 : 0);
}
