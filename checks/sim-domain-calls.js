/* sim-domain-calls.js — 🧱 도메인 모듈이 **다른 도메인 모듈을 직접 부르는 곳이 늘지 않는가**
   실행:  node sim-domain-calls.js   (러너 스테이징 또는 저장소 루트에서)
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-domain-calls.js --write-baseline` → checks/domain-calls-baseline.json
   ★ 왜 — CLAUDE.md «도메인끼리는 서로의 모듈을 직접 부르지 않는다 — app.js 가 deps 로 이어 준다(shared 는 도메인을 모른다)».
     글로만 있으면 지키지 않아도 빨강이 안 난다. 지금 있는 곳은 기준선(파일별 개수)으로 두고 **새로 생기는 곳만** 막는다.
     걷어서 줄었으면 같은 PR 에서 --write-baseline 으로 내린다(합계가 늘면 쓰기를 거절).
   ・도메인 = app/parts/<폴더>. 폴더 밖 파일(app.js · firebase-init.js …)은 잇는 쪽이라 세지 않는다.
   ・«직접 부름» 세 가지 — 모두 그 파일이 같은 이름을 선언(const · let · var · function · 매개변수 아님)하지 않았을 때만:
       ① app.js 가 만든 다른 도메인 모듈 인스턴스(`const xMod = TwY.createY(…)`)를 `xMod.` 로 읽기
       ② 다른 도메인 파일이 거는 전역 모듈(`window.TwY =`)을 `TwY` · `window.TwY` 로 읽기
       ③ 다른 도메인 파일이 거는 창 고리(`window.이름 =`)를 `window.이름` 으로 읽기
     도메인 → shared 는 아래로 가는 방향이라 세지 않는다. shared → 도메인은 센다(shared 는 도메인을 모른다).
   ・안 잡는 것: `window.` 없이 맨이름으로 부르는 창 고리 · deps 로 받은 함수(그건 잇는 쪽이 이은 것) · 문자열로 만든 이름.
   ・1절: 파일 · 예외 · 기준선 · 2절: 파일마다 기준선 이하 · 줄었으면 내린다 · 3절: 가짜 입력으로 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const BASE = ['.', 'app', path.join('apps', 'desktop', 'app')].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const BASE_FILE = path.join(__dirname, 'domain-calls-baseline.json');
const SHARED = 'shared';

/* 일부러 여러 도메인이 바로 읽게 만든 것 — 이름 → why. 세지 않는다 */
const EXEMPT = {
  TwMyHomeHooks: { why: '마이홈 고리판 — 다른 파일이 HOOK 이름으로 부르게 만든 순환 끊기 판(CLAUDE.md 구조 표 myhome-hooks.js)' },
  TwDemojiCatalog: { why: '기본 이모티콘 표 — 바꿀 수 없는 공용 표, 채팅에 두면 순환이라 맨 아래로 취급(demoji-catalog.js)' },
  TwRtHub: { why: 'realtime 연결 하나 — 방 · 대화 · 사진 · 친구 접속이 같은 웹소켓 하나(서버 규약 pv 2)를 쓰도록 만든 공용 연결(realtime/rt-hub.js store)' },
  TwRoomRt: { why: '방 포트 — 같은 연결 위의 대화 · 사진 포트가 «지금 방» · 대화 탭 이름(s1↔S1)을 같은 한 벌로 읽는다(room/room-rt.js store · tabToWire)' },
  _activeChannel: { why: '방 공용 상태 — room-state.js 가 처음 값을 두고 여러 모듈이 읽는 값(sim-room-state.js)' },
};

/* 주석 · 문자열을 같은 길이의 빈칸으로 — 줄 번호를 흔들지 않는다 */
const blank = (m) => m.replace(/[^\n]/g, ' ');
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, blank)
  .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, a) => a + blank(m.slice(a.length)));
const ID = '[A-Za-z_$][\\w$]*';

/* files: [[상대경로('dom/x.js'), 글]] · appSrc: app.js 글 → { counts: {파일: 개수}, pairs: {'from → to': 개수}, hits: [[파일, to, 종류, 이름]], exempt: {이름: 개수}, total } */
function judge(files, appSrc) {
  const F = files.map(([rel, src]) => ({ rel, dom: rel.split('/')[0], c: strip(src) }));
  const globals = {}, hooks = {};   // 이름 → Set(도메인)
  for (const f of F) for (const m of f.c.matchAll(new RegExp('\\bwindow\\.(' + ID + ')\\s*=(?!=)', 'g'))) {
    const t = /^(Tw|Mh)[A-Z]/.test(m[1]) ? globals : hooks;
    (t[m[1]] = t[m[1]] || new Set()).add(f.dom);
  }
  const inst = {};                 // app.js 인스턴스 이름 → 도메인
  for (const m of strip(appSrc || '').matchAll(new RegExp('\\bconst\\s+(' + ID + ')\\s*=\\s*(?:window\\.)?(' + ID + ')\\.create', 'g'))) {
    const o = globals[m[2]]; if (o && o.size === 1) inst[m[1]] = [...o][0];
  }
  const counts = {}, pairs = {}, exempt = {}, hits = []; let total = 0;
  for (const f of F) {
    const declared = new Set([...f.c.matchAll(new RegExp('\\b(?:const|let|var|function)\\s+(' + ID + ')', 'g'))].map(m => m[1]));
    const hit = (to, kind, name) => {
      if (to === f.dom || (to === SHARED && f.dom !== SHARED)) return;
      if (EXEMPT[name]) { exempt[name] = (exempt[name] || 0) + 1; return; }
      counts[f.rel] = (counts[f.rel] || 0) + 1; total++;
      const k = f.dom + ' → ' + to; pairs[k] = (pairs[k] || 0) + 1;
      hits.push([f.rel, to, kind, name]);
    };
    const one = (set) => set && set.size === 1 ? [...set][0] : null;
    for (const m of f.c.matchAll(new RegExp('(?<![\\w$.])(' + ID + ')\\s*\\.\\s*[A-Za-z_$]', 'g'))) {
      const n = m[1]; if (!declared.has(n) && inst[n]) hit(inst[n], '인스턴스', n);
    }
    for (const m of f.c.matchAll(new RegExp('(?<![\\w$])(window\\.)?((?:Tw|Mh)[A-Z][\\w$]*)\\b', 'g'))) {
      if (!m[1] && m.index > 0 && f.c[m.index - 1] === '.') continue;
      const n = m[2]; if (declared.has(n)) continue;
      const own = globals[n]; if (!own || own.has(f.dom)) continue;
      const to = one(own); if (to) hit(to, '전역 모듈', n);
    }
    for (const m of f.c.matchAll(new RegExp('\\bwindow\\.(' + ID + ')(?!\\s*=[^=])', 'g'))) {
      const n = m[1]; if (/^(Tw|Mh)[A-Z]/.test(n)) continue;
      const own = hooks[n]; if (!own || own.has(f.dom)) continue;
      hit([...own].sort()[0], '창 고리', n);
    }
  }
  return { counts, pairs, hits, exempt, total, inst };
}
/* 기준선과 견주기 → { up: [파일 지금>기준], down: [파일 지금<기준] } */
function compare(counts, base) {
  const up = [], down = [];
  for (const f of new Set([...Object.keys(counts), ...Object.keys(base)])) {
    const a = counts[f] || 0, b = base[f] || 0;
    if (a > b) up.push(f + ' ' + b + '→' + a); else if (a < b) down.push(f + ' ' + b + '→' + a);
  }
  return { up: up.sort(), down: down.sort() };
}

function walk(dir, rel, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (d.name !== 'vendor' && d.name !== 'node_modules') walk(path.join(dir, d.name), rel + d.name + '/', out); }
    else if (d.name.endsWith('.js') && rel) out.push([rel + d.name, fs.readFileSync(path.join(dir, d.name), 'utf8')]);
  }
  return out;
}
const PARTS = path.join(BASE, 'parts');
const FILES = walk(PARTS, '', []).sort((a, b) => a[0] < b[0] ? -1 : 1);
const APP = fs.readFileSync(path.join(PARTS, 'app.js'), 'utf8');
const R = judge(FILES, APP);
let base = null;
try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch (_) {}

if (process.argv.includes('--write-baseline')) {
  if (base && R.total > base.total) { say('  ✗ 합계가 기준선보다 많다(' + base.total + '→' + R.total + ') — 새 직접 호출을 deps 로 바꾸거나 EXEMPT 에 이유와 함께 넣는다. 기준선은 안 썼다'); process.exit(1); }
  const counts = {}; for (const f of Object.keys(R.counts).sort()) counts[f] = R.counts[f];
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-domain-calls.js 기준선 — 파일별 «다른 도메인 모듈 직접 부름» 개수(예외 빼고). 줄기만 한다: 걷었으면 같은 PR 에서 --write-baseline 으로 내리고, 새 직접 호출은 넣지 말 것(app.js 가 deps 로 잇는다).',
    total: R.total, counts,
  }, null, 1) + '\n');
  say('  ✓ 기준선을 썼다 — 직접 호출 ' + R.total + '곳 · 파일 ' + Object.keys(counts).length + '개 → ' + BASE_FILE);
  process.exit(0);
}

say('── 1. 파일 · 예외 · 기준선');
chk(FILES.length >= 150 && FILES.some(([f]) => f.startsWith('room/')), '도메인 폴더 .js ' + FILES.length + '개를 읽었다(vendor/ 빼고 · 폴더 밖 app.js 등은 잇는 쪽이라 뺌)');
chk(Object.keys(R.inst).length >= 100, 'app.js 가 만드는 모듈 인스턴스 ' + Object.keys(R.inst).length + '개의 도메인을 알아냈다');
const stale = Object.keys(EXEMPT).filter(n => !R.exempt[n]);
chk(!stale.length, '예외 ' + Object.keys(EXEMPT).length + '개가 모두 실제로 걸린다(없어진 예외는 표에서 뺀다)' + (stale.length ? ' — ' + stale.join(' · ') : ''));
chk(!!base && typeof base.total === 'number' && !!base.counts, '기준선 파일을 읽었다 — ' + path.basename(BASE_FILE));

say('── 2. 도메인 직접 호출이 늘지 않았다 (지금 ' + R.total + '곳' + (base ? ' · 기준선 ' + base.total : '') + ')');
say('     ' + Object.entries(R.pairs).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
if (base) {
  const c = compare(R.counts, base.counts);
  const why = (f) => R.hits.filter(h => h[0] === f.split(' ')[0]).map(h => h[2] + ' ' + h[3]).join(', ');
  chk(!c.up.length, '파일마다 기준선 이하' + (c.up.length ? ' — ' + c.up.map(f => f + ' (' + why(f) + ')').join(' · ') + ' — 다른 도메인 모듈은 app.js 가 deps 로 넘겨 준 것으로 부른다. 일부러 공용으로 만든 것이면 EXEMPT 에 이유와 함께' : ''));
  chk(!c.down.length, '기준선보다 준 파일 0' + (c.down.length ? ' — 줄었어요. 같은 PR 에서 기준선을 내려 주세요: node checks/sim-domain-calls.js --write-baseline (' + c.down.join(' · ') + ')' : ''));
}

say('── 3. 가짜 입력으로 깨 보기');
{
  const app = "const overheadMod = TwOverhead.createOverhead({});\nconst barMod = TwBar.createBar({});\nconst netMod = TwNet.createNet({});\n";
  const lib = [
    ['room/overhead.js', "window.TwOverhead = { createOverhead(){} };\nwindow.openRoomThing = function(){};\n"],
    ['focus/bar.js', "window.TwBar = { createBar(){} };\n"],
    ['shared/net.js', "window.TwNet = { createNet(){} };\n"],
  ];
  const ok = judge([...lib, ['focus/x.js', "const bindLabelDrag = deps.bindLabelDrag;\nbindLabelDrag(el);\nnetMod.ready();\nbarMod.draw();\n"]], app);
  chk(!ok.total, 'deps 로 받은 것 · 같은 도메인 · 도메인 → shared 는 안 센다');
  const bad = judge([...lib, ['focus/x.js', "overheadMod.bindLabelDrag(el, seat);\n"]], app);
  chk(bad.counts['focus/x.js'] === 1 && bad.pairs['focus → room'] === 1, '다른 도메인 인스턴스를 바로 부르면(경험치 바 → 이름표) 센다');
  chk(judge([...lib, ['focus/y.js', "const a = window.TwOverhead;\nTwOverhead.createOverhead({});\n"]], app).counts['focus/y.js'] === 2, '다른 도메인 전역 모듈(window. 있든 없든)을 센다');
  const hk = judge([...lib, ['focus/z.js', "window.openRoomThing();\n"], ['chat/w.js', "window.openRoomThing = null;\n"]], app);
  chk(hk.counts['focus/z.js'] === 1 && !hk.counts['chat/w.js'], '다른 도메인 창 고리 읽기는 세고 거는 줄은 안 센다');
  chk(judge([...lib, ['shared/s.js', "barMod.draw();\n"]], app).pairs['shared → focus'] === 1, 'shared 가 도메인을 부르면 센다');
  chk(!judge([...lib, ['focus/c.js', "/* overheadMod.x() */\nconst s = 'overheadMod.y()';\n// TwOverhead\n"]], app).total, '주석 · 문자열 안은 안 센다');
  chk(!judge([...lib, ['focus/d.js', "const overheadMod = deps.overheadMod;\noverheadMod.x();\nfoo.overheadMod.y();\n"]], app).total, '그 파일이 같은 이름을 선언했거나 다른 것의 속성이면 안 센다');
  chk(!judge([...lib, ['launcher/e.js', "const h = TwMyHomeHooks;\n"], ['myhome/myhome-hooks.js', "window.TwMyHomeHooks = {};\n"]], app).total, '예외(마이홈 고리판)는 안 센다');
  chk(compare(bad.counts, {}).up.length === 1, '기준선에 없던 파일에 생기면 빨강');
  chk(compare({ 'a.js': 1 }, { 'a.js': 2 }).down.length === 1, '줄면 기준선을 내리라고 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
