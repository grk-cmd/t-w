/*
 * 버그 제보 정리(bugCleanup) 검사. functions/bug-cleanup.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 판정(순수) — 해결 시각 적기 · 지우기 경계(29일 · 30일) · 미해결 · 공지 · 다시 미해결 · 상한
 * 2. 한 번 돌기 — 받는 줄 · 지우는 경로 · 작업 기록 · 두 번째 날
 * 3. 지우는 경로가 웹 관리자 deleteWrite 와 같다 · 탈퇴(account-delete.js)도 같은 bugPaths
 * 4. index.js 연결 · 규칙(doneTs 칸 · 색인) · 웹 관리자(되돌리면 doneTs 지움 · 작업 기록 이름) · 처리방침
 * 5. 일부러 깨 보기
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const needAny = (...fs_) => { for (const f of fs_){ const s = read(f); if (s != null) return s; } return need(fs_[fs_.length - 1]); };
const clone = (v) => JSON.parse(JSON.stringify(v));

const SRC = need('functions/bug-cleanup.js');
const FX = need('functions/index.js');
const AD = need('functions/account-delete.js');
const RULES = need('firebase-database-rules.json');
const PRIVACY = needAny('hosting/help/privacy.html', '../hosting/help/privacy.html');
const WA_BUG = read('web-admin/src/entities/bug-board/model/bugBoard.ts');   // 러너는 web-admin 을 빼므로 있을 때만
const WA_AUDIT = read('web-admin/src/shared/api/audit.ts');

const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, require); return m.exports; };

function fakeDb(tree){
  const reads = [];
  const at = (p) => p.split('/').filter(Boolean).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
  const setAt = (p, v) => {
    const ks = p.split('/').filter(Boolean); let n = tree;
    for (const k of ks.slice(0, -1)){ if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
    if (v === null) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = v;
  };
  const snap = (v) => ({ val: () => (v === undefined || (v && typeof v === 'object' && !Object.keys(v).length) ? null : clone(v)) });
  const pick = (p, test) => { const all = at(p) || {}; const out = {}; for (const k in all) if (all[k] && test(all[k])) out[k] = all[k]; return out; };
  const updates = [];
  const db = {
    ref: (p = '') => ({
      get: async () => { reads.push(p); return snap(at(p)); },
      orderByChild: (c) => ({
        equalTo: (x) => ({ get: async () => { reads.push(p + '?' + c + '=' + x); return snap(pick(p, (r) => (x === null ? r[c] == null : r[c] === x))); } }),
        startAt: (x) => ({ get: async () => { reads.push(p + '?' + c + '>=' + x); return snap(pick(p, (r) => typeof r[c] === 'number' && r[c] >= x)); } }),
      }),
      update: async (patch) => {
        if (p) throw new Error('루트 update 만 쓴다');
        updates.push(patch);
        for (const k of Object.keys(patch)) setAt(k, patch[k]);
      },
    }),
  };
  return { db, reads, updates, at };
}

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 10, 20);
const rand = () => 0.123456;

function judge(src){
  const m = load(src);
  const rows = {
    a: { status: 'fixed', doneTs: NOW - 30 * DAY },          // 딱 30일 — 지움
    b: { status: 'norepro', doneTs: NOW - 29 * DAY },        // 29일 — 둠
    c: { status: 'fixed' },                                   // 시각 없음 — 오늘 적기만
    d: { status: 'checking', openTs: 1 },                     // 미해결 — 그대로
    e: { status: 'unfixed', openTs: 1, doneTs: NOW - 40 * DAY }, // 다시 미해결 — 시각 지움(안 지움)
    f: { status: 'fixed', nts: 1, notice: true, doneTs: NOW - 99 * DAY }, // 공지 — 안 건드림
    g: { status: 'new', openTs: 1 },
  };
  const p = m.planBugCleanup(rows, NOW);
  const out = [];
  out.push([p.remove.join() === 'a', '30일 지난 해결 제보만 지운다(딱 30일 지움 · 29일 둠)']);
  out.push([p.stamp.join() === 'c', '해결 시각이 없는 해결 제보는 지우지 않고 오늘 시각만 적는다(바로 안 지움)']);
  out.push([p.unstamp.join() === 'e', '다시 미해결로 바뀐 제보는 해결 시각을 지운다(지우지 않음)']);
  out.push([!p.remove.includes('f') && !p.stamp.includes('f'), '공지는 건드리지 않는다']);
  out.push([!['d', 'g'].some((k) => p.remove.includes(k) || p.stamp.includes(k)), '미해결(new · checking)은 건드리지 않는다']);
  const many = {}; for (let i = 0; i < m.RUN_MAX + 5; i++) many['k' + i] = { status: 'fixed', doneTs: NOW - 40 * DAY - i };
  const pm = m.planBugCleanup(many, NOW);
  out.push([pm.remove.length === m.RUN_MAX && pm.more === 5 && pm.remove[0] === 'k' + (m.RUN_MAX + 4), '한 번에 상한까지 · 오래된 것부터 · 남은 수를 알린다']);
  out.push([m.KEEP_MS === 30 * DAY && m.DONE_STATUS.join() === 'fixed,norepro', '보관 30일 · 해결 = 수정 완료 · 재현 안 됨']);
  return out;
}

async function judgeRun(src){
  const m = load(src);
  const tree = { bugBoard: {
    list: {
      old: { status: 'fixed', vis: 'prv', authUid: 'u1', code: 'c1', ts: 1, no: 'B-0901-1', doneTs: NOW - 31 * DAY },
      neu: { status: 'fixed', vis: 'pub', authUid: 'u2', code: 'c2', ts: 2 },
      opn: { status: 'checking', vis: 'pub', authUid: 'u3', code: 'c3', ts: 3, openTs: 3 },
      back: { status: 'unfixed', vis: 'pub', authUid: 'u4', code: 'c4', ts: 4, openTs: 4, doneTs: NOW - 5 * DAY },
    },
    pub: { neu: { title: 't', body: 'b' }, opn: { title: 't', body: 'b' } },
    prv: { u1: { old: { title: 't', body: 'b' } } },
    ans: { prv: { old: { r1: { text: 'x', ts: 1 } } } },
    rep: { prv: { old: { x: { text: 'y', ts: 2 } } } },
    likes: { old: { u9: true } },
    seq: { '2026-09-01': 1 },
  } };
  const W = fakeDb(tree);
  const r = await m.runBugCleanup(W.db, NOW, rand);
  const out = [];
  out.push([r.removed === 1 && r.stamped === 1 && r.unstamped === 1, '하루 한 번: 지움 1 · 시각 적기 1 · 시각 지움 1']);
  out.push([!W.at('bugBoard/list/old') && !W.at('bugBoard/prv/u1/old') && !W.at('bugBoard/ans/prv/old') && !W.at('bugBoard/rep/prv/old') && !W.at('bugBoard/likes/old'),
    '지운 제보는 목록 줄 · 비공개 내용 · 답변 · 답글 · 공감까지 통째로']);
  out.push([W.at('bugBoard/seq/2026-09-01') === 1 && !!W.at('bugBoard/pub/opn') && !!W.at('bugBoard/list/opn'), '번호 카운터 · 미해결 제보는 남는다']);
  out.push([W.at('bugBoard/list/neu/doneTs') === NOW && !!W.at('bugBoard/pub/neu'), '시각 없는 해결 제보는 오늘 시각만 적고 남긴다']);
  out.push([W.at('bugBoard/list/back/doneTs') === undefined && !!W.at('bugBoard/list/back'), '다시 미해결이 된 제보는 시각만 지운다']);
  out.push([W.reads.length === 2 && W.reads.includes('bugBoard/list?openTs=null') && W.reads.includes('bugBoard/list?doneTs>=0') && !W.reads.includes('bugBoard/list'),
    '읽기는 해결 줄(openTs 없음) · 시각 있는 줄 색인 조회 둘뿐 — 목록 · 내용을 통째로 받지 않는다']);
  const logs = Object.entries(W.updates[0] || {}).filter(([k]) => k.startsWith('adminLog/'));
  const log = logs.length === 1 ? logs[0][1] : {};
  out.push([logs.length === 1 && log.action === 'bug.autoClean' && log.target === 'B-0901-1' && /1건/.test(log.detail || '') && Object.keys(log).sort().join() === 'action,at,by,detail,target',
    '작업 기록 한 줄 — 번호만(제목 · 이름 없음) · 규칙이 받는 다섯 칸']);
  out.push([W.updates.length === 1, '지우기 · 시각 · 기록을 한 묶음으로']);
  // 둘째 날 — 31일째 neu 는 아직(오늘 시각을 적었으니) · 아무것도 안 지움
  const W2 = fakeDb(clone(tree));
  await m.runBugCleanup(W2.db, NOW, rand);
  const r2 = await m.runBugCleanup(W2.db, NOW + DAY, rand);
  out.push([r2.removed === 0 && r2.stamped === 0 && !!W2.at('bugBoard/list/neu'), '다음 날 — 막 시각을 적은 제보는 아직 안 지운다']);
  const r3 = await m.runBugCleanup(W2.db, NOW + 30 * DAY, rand);
  out.push([r3.removed === 1 && !W2.at('bugBoard/list/neu') && !W2.at('bugBoard/pub/neu'), '시각을 적은 날부터 30일 뒤에 지운다']);
  return out;
}

(async () => {
say('── 1. 판정');
judge(SRC).forEach(([ok, msg]) => chk(ok, msg));

say('── 2. 한 번 돌기');
(await judgeRun(SRC)).forEach(([ok, msg]) => chk(ok, msg));

say('── 3. 지우는 경로 한 벌');
const m = load(SRC);
const mine = m.bugPaths('X', { vis: 'prv', authUid: 'U' }).concat(m.bugPaths('X', { vis: 'pub', authUid: 'U' })).sort();
if (WA_BUG){
  const fn = (WA_BUG.match(/export function deleteWrite\([\s\S]*?\n\}/) || [''])[0];
  const wa = new Set();
  for (const vis of ['pub', 'prv']){
    const content = vis === 'pub' ? 'bugBoard/pub/X' : 'bugBoard/prv/U/X';
    wa.add(content);
    for (const t of fn.match(/\$\{BUG_(?:ROOT|LIST)\}\/[^`]*/g) || []){
      const path = t.replace('${BUG_LIST}', 'bugBoard/list').replace('${BUG_ROOT}', 'bugBoard').replace('${item.authUid}', 'U').replace('${item.id}', 'X');
      if (!/^bugBoard\/(pub|prv)\//.test(path)) wa.add(path);   // 내용 경로는 공개 · 비공개 갈래로 위에서 넣었다
    }
  }
  const waList = [...wa].sort();
  const mineSet = [...new Set(mine)].sort();
  chk(waList.join() === mineSet.join(), '지우는 경로가 웹 관리자 «글 지우기»(deleteWrite)와 같다' + (waList.join() === mineSet.join() ? '' : ' — 웹 ' + waList.join(' ') + ' / 함수 ' + mineSet.join(' ')));
} else say('  · 웹 관리자 원본이 없어(러너가 뺌) 맞대기는 건너뛴다 — 저장소에서 node checks/sim-bug-cleanup.js 로 본다');
chk(m.bugPaths('X', { vis: 'prv' }).every((p) => !p.includes('undefined')) && !m.bugPaths('X', { vis: 'prv' }).some((p) => p.startsWith('bugBoard/prv/')),
  '비공개 글의 글쓴이를 모르면 비공개 내용 경로는 만들지 않는다(엉뚱한 곳을 지우지 않게)');
chk(/require\('\.\/bug-cleanup'\)/.test(AD) && /bugPaths\(id, bugs\[id\]\)/.test(AD), '회원 탈퇴(account-delete.js)도 같은 bugPaths 를 쓴다');

say('── 4. 연결 · 규칙 · 웹 관리자 · 처리방침');
chk(/exports\.bugCleanup = onSchedule\(\{ schedule: '40 4 \* \* \*', timeZone: 'Asia\/Seoul'/.test(FX) && /require\('\.\/bug-cleanup'\)\.runBugCleanup\(getDatabase\(\), Date\.now\(\)\)/.test(FX),
  'index.js — 매일 서울 04:40 · runBugCleanup');
let list = null; try{ list = JSON.parse(RULES).rules.bugBoard.list; }catch(_){}
chk(!!list && list['.indexOn'].includes('doneTs') && list['$id'].doneTs && list['$id'].doneTs['.validate'] === 'newData.isNumber()',
  '규칙: 목록 줄에 doneTs 칸(숫자) · 색인 — 없으면 $other 가 막고, 색인이 없으면 함수가 목록을 통째로 받는다');
if (WA_BUG) chk(/\.\.\.\(isOpen\(status\) \? \{ \[`\$\{base\}\/doneTs`\]: null \} : \{\}\)/.test(WA_BUG), '웹 관리자: 미해결로 되돌리면 doneTs 를 지운다(해결 때는 안 적음 — 함수가 적는다)');
if (WA_AUDIT) chk(/'bug\.autoClean'/.test(WA_AUDIT), '웹 관리자 작업 기록 이름에 bug.autoClean');
const P = PRIVACY.replace(/<[^>]*>/g, ' ');
chk(/버그 제보/.test(P) && /해결[^.]{0,40}1달|해결[^.]{0,40}한 달/.test(P) && /탈퇴[^.]{0,80}(버그 제보|제보)/.test(P),
  '처리방침: 버그 제보 항목 · 해결 뒤 1달 · 탈퇴 때 삭제를 적었다');

say('── 5. 일부러 깨 보기');
const breaks = [
  ['30일을 하루 줄임', (s) => s.replace('const KEEP_MS = 30 * DAY_MS;', 'const KEEP_MS = 29 * DAY_MS;')],
  ['시각 없는 해결 제보를 바로 지움', (s) => s.replace("if (!has){ stamp.push(id); continue; }", "if (!has){ remove.push(id); continue; }")],
  ['공지도 지움', (s) => s.replace('|| isNotice(row)', '')],
  ['다시 미해결이어도 시각을 둠', (s) => s.replace("if (row.doneTs != null) unstamp.push(id); continue;", 'continue;')],
  ['공감을 안 지움', (s) => s.replace("    ROOT + '/likes/' + id,\n", '')],
  ['목록을 통째로 읽음', (s) => s.replace("db.ref(LIST).orderByChild('openTs').equalTo(null).get()", 'db.ref(LIST).get()')],
];
for (const [what, mut] of breaks){
  const b = mut(SRC);
  if (b === SRC){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  let caught = false;
  try{
    caught = judge(b).some(([ok]) => !ok) || (await judgeRun(b)).some(([ok]) => !ok);
    if (!caught && WA_BUG){ const mm = load(b); const s2 = mm.bugPaths('X', { vis: 'pub', authUid: 'U' }); caught = !s2.includes('bugBoard/likes/X'); }
  }catch(_){ caught = true; }
  chk(caught, '  깨 보기: ' + what + ' → 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
