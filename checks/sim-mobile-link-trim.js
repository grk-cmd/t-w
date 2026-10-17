/*
 * 📱 폰 연결 주소 공백 떼기(functions/mobile-link-trim.js) 검사 — 함수를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 옮기기 · 지우기 갈래  2. 정상 칸은 읽지도 않음  3. index.js 연결(진짜 index.js 를 가짜 모듈로 돌려 처리기를 부른다)
 * 4. 규칙과 같은 코드 모양  5. 깨 보기
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const need = (f) => { const s = read(f); if (s == null) { say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const FX = need('functions/index.js');
const SRC = need('functions/mobile-link-trim.js');

const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, require); return m.exports; };

/* 가짜 DB — 읽은 경로 · 지운 경로 · 한 번에 쓴 묶음을 적는다 */
function fakeDb(data){
  const log = { reads: [], removes: [], updates: [] };
  const get = (p) => p.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), data);
  const db = {
    ref: (p) => ({
      get: async () => { log.reads.push(p); const v = get(p || ''); return { val: () => v, exists: () => v != null }; },
      remove: async () => { log.removes.push(p); },
      update: async (o) => { log.updates.push(o); },
    }),
  };
  return { db, log };
}

const U = 'umu00pdxvk6d9x8mx', KEY = 'E8WQEKFC4C73LU9DKRU7D7SE';
const ST = { on: true, app: 'Procreate', ts: 1792126033404, key: KEY };
const world = (over) => Object.assign({ mobileKeys: { [U]: KEY }, mobileLink: { [U]: { live: { at: 1 } } } }, over || {});

async function cases(mod){
  const r = {};
  const run = async (name, key, val, data) => { const f = fakeDb(data || world()); r[name] = { res: await mod.runMobileLinkTrim(f.db, key, val), log: f.log }; };
  await run('normal', U, ST);
  await run('lead', ' ' + U, ST);
  await run('trail', U + ' ', ST);
  await run('two', '  ' + U, ST);
  await run('wrongKey', ' ' + U, Object.assign({}, ST, { key: 'ZZZZZZZZZZZZZZZZZZZZZZZZ' }));
  await run('noKey', ' ' + U, { on: true, ts: 1 });
  await run('noMobileKey', ' ' + U, ST, world({ mobileKeys: {} }));
  await run('pcOff', ' ' + U, ST, world({ mobileLink: {} }));
  await run('gone', ' ' + U, null);
  await run('badNull', ' null', ST);
  await run('badUndef', ' undefined', ST);
  await run('badShort', ' u1234', ST);
  await run('notString', 42, ST);
  return r;
}

(async () => {
  const mod = load(SRC);
  const r = await cases(mod);
  const moved = (c) => c.res === 'moved' && c.log.updates.length === 1 &&
    JSON.stringify(c.log.updates[0][`mobileLink/${U}/state`]) === JSON.stringify(ST) && Object.keys(c.log.updates[0]).length === 2;

  say('── 1. 옮기기 · 지우기');
  chk(moved(r.lead) && r.lead.log.updates[0]['mobileLink/ ' + U] === null, '앞 공백 · 키 맞음 · PC 켜짐 → 정상 칸 state 로 그대로 옮기고 공백 칸은 같은 묶음에서 지움');
  chk(moved(r.trail) && moved(r.two), '  ↳ 뒤 공백 · 공백 두 칸도 같은 정상 칸으로');
  chk(r.wrongKey.res === 'mismatch' && !r.wrongKey.log.updates.length && r.wrongKey.log.removes[0] === 'mobileLink/ ' + U, '연결 키가 틀리면 옮기지 않고 공백 칸만 지움');
  chk(r.noKey.res === 'mismatch' && r.noMobileKey.res === 'mismatch' && !r.noKey.log.updates.length && !r.noMobileKey.log.updates.length, '  ↳ 키가 없거나 그 사람이 연결 키를 만든 적 없어도');
  chk(r.pcOff.res === 'off' && !r.pcOff.log.updates.length && r.pcOff.log.removes.length === 1, 'PC 가 꺼져 있으면(live 없음) 옮기지 않음 — 폰이 정상 칸에 쓸 때와 같은 조건');
  chk(['badNull', 'badUndef', 'badShort'].every(k => r[k].res === 'bad' && !r[k].log.updates.length && r[k].log.reads.length === 0 && r[k].log.removes.length === 1),
    '공백을 빼도 사용자 코드가 아니면(null · undefined · 짧음) 읽지 않고 공백 칸만 지움');

  say('── 2. 정상 칸은 아무것도 안 함');
  chk(r.normal.res === 'skip' && !r.normal.log.reads.length && !r.normal.log.removes.length && !r.normal.log.updates.length, '공백 없는 칸 — 읽기 · 쓰기 0(거의 모든 신호가 여기서 끝)');
  chk(r.gone.res === 'gone' && !r.gone.log.reads.length && !r.gone.log.removes.length, '지워진 쓰기(옮긴 뒤 지운 것 포함) — 아무것도 안 함(제자리 돌기 없음)');
  chk(r.notString.res === 'skip', '키가 문자열이 아니면 건너뜀');

  say('── 3. index.js 연결 — 진짜 index.js 를 가짜 모듈로 돌려 처리기를 부른다');
  {
    const handlers = {};
    const f = fakeDb(world());
    const anyFn = new Proxy(function () { return anyFn; }, { get: () => anyFn, apply: () => anyFn });
    const fakeReq = (name) => {
      if (name === './mobile-link-trim') return mod;
      if (name === 'firebase-admin/database') return { getDatabase: () => f.db, ServerValue: {} };
      if (name === 'firebase-functions/v2/database') {
        const reg = (kind) => (opts, h) => { handlers[opts.ref] = { kind, opts, h }; return h; };
        return { onValueWritten: reg('written'), onValueCreated: reg('created'), onValueDeleted: reg('deleted') };
      }
      return anyFn;
    };
    const m = { exports: {} };
    let loaded = true;
    try { new Function('module', 'exports', 'require', FX)(m, m.exports, fakeReq); } catch (e) { loaded = false; say('  (index.js 를 못 돌림: ' + e.message + ')'); }
    const hd = handlers['/mobileLink/{key}/state'];
    chk(loaded && !!hd && hd.kind === 'written' && typeof m.exports.mobileLinkTrim === 'function', 'mobileLinkTrim 이 /mobileLink/{key}/state 쓰기(onValueWritten)에 걸림');
    chk(!!hd && hd.opts.retry === false, '  ↳ 다시 시도 안 함(다음 신호가 또 온다)');
    if (hd) {
      await hd.h({ params: { key: ' ' + U }, data: { before: { val: () => null }, after: { val: () => ST } } });
      chk(f.log.updates.length === 1 && JSON.stringify(f.log.updates[0][`mobileLink/${U}/state`]) === JSON.stringify(ST), '  ↳ 처리기가 경로의 key 와 쓰인 뒤 값(after)을 넘겨 실제로 옮김');
    } else chk(false, '  ↳ 처리기를 못 찾음');
  }

  say('── 4. 규칙과 같은 코드 모양');
  {
    const ex = RULES.mobileLink.$userId['.validate'];
    const ruleOk = (k) => { const P = String.prototype; P.matches = function (re) { return re.test(String(this)); };
      try { return !!new Function('$userId', 'return (' + ex.replace(/\.replace\(/g, '.replaceAll(') + ');')(k); } finally { delete P.matches; } };
    const keys = [U, ' ' + U, U + ' ', '  ' + U, ' null', ' undefined', ' u1234', ' U0ABCDEFGH', ' xmu00pdxvk6d9x8mx'];
    const diff = keys.filter(k => ruleOk(k) !== (mod.USER_CODE_RE.test(mod.fixedKey(k)) && mod.fixedKey(k) !== 'undefined'));
    chk(!diff.length, '규칙이 받는 폰 연결 칸 = 함수가 옮기는 코드' + (diff.length ? ' — 다름: ' + JSON.stringify(diff) : ''));
  }

  say('── 5. 깨 보기 — 함수를 망가뜨리면 빨강');
  {
    const breaks = [
      ['연결 키를 안 봄', (s) => s.replace("|| val.key !== want", '')],
      ['PC 꺼짐을 안 봄', (s) => s.replace("if (!live) { await dropSpaced(); return 'off'; }", '')],
      ['공백을 첫 칸만 뗌', (s) => s.replace('.replace(/ /g, \'\')', ".replace(' ', '')")],
      ['공백 칸을 안 지움', (s) => s.replace(", [`${LINK}/${key}`]: null", '')],
      ['정상 칸도 읽음', (s) => s.replace("if (fixed === key) return 'skip';", '')],
    ];
    for (const [name, fn] of breaks) {
      const src = fn(SRC);
      if (src === SRC) { chk(false, `깨 보기 «${name}» — 고칠 자리를 못 찾음`); continue; }
      const r2 = await cases(load(src));
      const same = JSON.stringify(Object.keys(r).map(k => [r[k].res, r[k].log])) === JSON.stringify(Object.keys(r2).map(k => [r2[k].res, r2[k].log]));
      chk(!same, `«${name}» 이면 결과가 달라져 잡힌다`);
    }
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
