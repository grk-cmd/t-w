#!/usr/bin/env node
/* 판끼리 DB 규칙 어긋남 — 앞 판(먼저 나갈 판 · main)에서 바꾼 규칙이 뒤 판에도 들어갔는가.
   여러 세션이 판마다 따로 규칙을 고치고 «다음 판으로 옮기는 PR» 을 손으로 올려서, 옮기기를 잊으면
   뒤 판 규칙을 운영에 배포하는 순간 앞 판 기능이 막힌다.

   판정(세 갈래) — 두 판이 갈라진 지점(merge-base)을 기준으로, 앞 판 A 가 바꾼 규칙 칸마다:
     · 뒤 판 B 도 A 와 같은 값      → 통과
     · B 가 기준 그대로              → missing(빠짐) — B 로 옮겨 오지 않았다
     · B 가 따로 다른 값으로 바꿨다  → diverged(확인 필요) — 양쪽이 다르게 고쳤다(합칠 때 사람이 본다)
   B 가 일부러 다시 고친 것을 «빠짐» 으로 잡지 않으려고 두 갈래가 아니라 세 갈래로 본다.

   실행:
     node scripts/rules-drift.js                          모든 판 짝(앞 → 뒤)을 본다
     node scripts/rules-drift.js --target release/0.14.0  그 판으로 들어올 것만 본다(그 판 머리 기준)
     node scripts/rules-drift.js --target release/0.14.0 --ref HEAD   판 이름은 release/0.14.0 · 규칙은 HEAD 것(PR 머지 결과)
     --github  GitHub Actions 경고 줄 · 요약(GITHUB_STEP_SUMMARY)으로도 낸다
     --remote <이름>  판 브랜치를 읽을 원격(기본 origin)
   종료 코드: 0 = 다 봤다(어긋남이 있어도 0 — 옮기는 PR 이 머지되기 전엔 늘 잠깐 어긋나서 막지 않고 알린다)
             2 = 보지 못했다(판 브랜치 없음 · 규칙 파일 못 읽음 · git 실패) */
'use strict';
const { execFileSync } = require('child_process');

/* 규칙 파일 자리 — 0.13.0 부터 firebase/ 아래로 옮겼다. 앞 것부터 찾는다. */
const RULES_PATHS = ['firebase/firebase-database-rules.json', 'firebase-database-rules.json'];
const RELEASE_RE = /^release\/(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const MAIN = 'main';

/** 규칙 글 → 객체. 규칙 파일은 JSON 에 // 한 줄 주석을 허락하므로 줄 머리 주석만 걷는다(문자열 속 // 는 건드리지 않음).
 * @param {string} text @returns {object} */
function parseRules(text){
  return JSON.parse(String(text).replace(/^\s*\/\/.*$/gm, ''));
}

/** 규칙 객체 → { '/rules/a/$b/.write': '"식"' } — 칸 하나하나를 비교할 수 있게 편다(값은 JSON 글로).
 * @param {object} obj @returns {Record<string,string>} */
function flatten(obj){
  const out = {};
  const walk = (o, p) => {
    if(o && typeof o === 'object' && !Array.isArray(o)){
      for(const [k, v] of Object.entries(o)){
        if(k.startsWith('.')) out[p + '/' + k] = JSON.stringify(v);
        else walk(v, p + '/' + k);
      }
    } else out[p] = JSON.stringify(o);
  };
  walk(obj, '');
  return out;
}

/** 세 갈래 판정 — 기준(base) 대비 앞 판(src)이 바꾼 칸이 뒤 판(dst)에 있나.
 * @param {Record<string,string>} base @param {Record<string,string>} src @param {Record<string,string>} dst
 * @returns {{ missing: string[], diverged: string[] }} 칸 이름은 정렬해서 */
function drift(base, src, dst){
  const missing = [], diverged = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(src)]);
  for(const k of keys){
    if(src[k] === base[k]) continue;          // 앞 판이 안 바꾼 칸
    if(dst[k] === src[k]) continue;           // 뒤 판에도 들어감
    (dst[k] === base[k] ? missing : diverged).push(k);
  }
  return { missing: missing.sort(), diverged: diverged.sort() };
}

/** 칸 이름 → 묶음(규칙 노드 두 층까지, 예: /rules/playlistPriv). 알림이 칸 수십 줄로 넘치지 않게.
 * @param {string[]} keys @returns {Array<{ node: string, keys: string[] }>} */
function groupKeys(keys){
  const m = new Map();
  for(const k of keys){
    const node = k.split('/').slice(0, 3).join('/');
    if(!m.has(node)) m.set(node, []);
    m.get(node).push(k);
  }
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([node, ks]) => ({ node, keys: ks }));
}

/** 판 브랜치 이름 → 버전 숫자(앞 세 자리). 판 브랜치가 아니면 null. 꼬리(-server 등)는 같은 판의 곁가지로 본다.
 * @param {string} name @returns {{ name: string, core: number[], tag: string } | null} */
function parseRelease(name){
  const m = RELEASE_RE.exec(String(name || ''));
  return m ? { name, core: [+m[1], +m[2], +m[3]], tag: m[4] || '' } : null;
}

/** @param {number[]} a @param {number[]} b @returns {number} */
function cmpCore(a, b){
  for(let i = 0; i < 3; i++) if(a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** 어느 짝을 볼지 — 앞 판(버전 낮음 · main)에서 뒤 판(버전 높음)으로만. 같은 판 곁가지끼리(0.13.0 ↔ 0.13.0-server)는
 * 서로 앞뒤가 없어서 보지 않는다. 앞 판 A 가 다른 판 B 에 통째로 들어갔고 B 도 같은 뒤 판 T 로 가는 짝이면(B 가 T 보다 낮음)
 * A → T 는 B → T 가 대신 말하므로 뺀다 — 빼지 않으면 B 에서 일부러 걷은 규칙이 «빠짐» 으로 다시 잡힌다.
 * 짝마다 본다: B 가 T 보다 높거나 T 의 곁가지면 B → T 짝이 없어서, A 를 빼면 A 의 변경을 아무도 알리지 않는다.
 * @param {Array<{ name: string, core: number[], inside?: string[] }>} branches inside = 이 판이 통째로 들어간 판 이름들
 * @param {string} [target] 이 판으로 들어올 짝만
 * @returns {Array<[string, string]>} [앞, 뒤] */
function pairs(branches, target){
  const out = [];
  const byName = new Map(branches.map(b => [b.name, b]));
  for(const a of branches){
    for(const b of branches){
      if(a === b || cmpCore(a.core, b.core) >= 0) continue;
      if(target && b.name !== target) continue;
      if((a.inside || []).includes(b.name)) continue;   // 받는 판에 이미 통째로 들어감 — 갈라진 곳이 A 머리라 볼 것이 없다
      const covered = (a.inside || []).some(n => { const c = byName.get(n); return !!c && c !== b && cmpCore(c.core, b.core) < 0; });
      if(covered) continue;
      out.push([a.name, b.name]);
    }
  }
  return out;
}

/* ── git 을 읽는 쪽 ─────────────────────────────────────────────────────── */

/** @param {string} cwd */
function gitIn(cwd){
  return (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** 그 커밋의 규칙(펴 둔 것) — 두 자리 중 있는 것. 둘 다 없으면 null(그 판엔 규칙 파일이 없다).
 * @param {(…a: string[]) => string} git @param {string} rev */
function rulesAt(git, rev){
  for(const p of RULES_PATHS){
    let text;
    try{ text = git('show', `${rev}:${p}`); }catch(_){ continue; }
    try{ return flatten(parseRules(text)); }
    catch(e){ throw new Error(`규칙 파일이 JSON 으로 안 읽힘 — ${rev}:${p} (${e.message})`); }
  }
  return null;
}

/** main 의 앱 버전 — main 은 «이미 낸 판» 이라 그 버전 자리에 둔다.
 * @param {(…a: string[]) => string} git @param {string} rev */
function mainCore(git, rev){
  for(const p of ['apps/desktop/package.json', 'package.json']){
    try{
      const v = JSON.parse(git('show', `${rev}:${p}`)).version;
      const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v || '');
      if(m) return [+m[1], +m[2], +m[3]];
    }catch(_){}
  }
  return null;
}

/** 저장소를 읽어 판 목록 · 짝 · 판정을 낸다.
 * @param {{ cwd: string, remote?: string, target?: string, ref?: string }} o
 * @returns {{ branches: object[], results: Array<{ from: string, to: string, base: string, missing: string[], diverged: string[] }> }} */
function scan(o){
  const git = gitIn(o.cwd);
  const remote = o.remote || 'origin';
  const refOf = (name) => (o.target === name && o.ref) ? o.ref : `${remote}/${name}`;
  const names = git('for-each-ref', '--format=%(refname:strip=3)', `refs/remotes/${remote}/release/`)
    .split('\n').map(s => s.trim()).filter(Boolean);
  const branches = names.map(parseRelease).filter(Boolean);
  if(o.target && !branches.some(b => b.name === o.target)){
    const t = parseRelease(o.target);
    if(!t) throw new Error(`판 브랜치 이름이 아니다: ${o.target}`);
    branches.push(t);                         // 아직 원격에 없는 새 판(첫 push 전)도 그 이름으로 본다
  }
  if(!branches.length) throw new Error(`판 브랜치를 못 찾음 — refs/remotes/${remote}/release/* (git fetch ${remote} 'refs/heads/release/*:refs/remotes/${remote}/release/*')`);
  let hasMain = true;
  try{ git('rev-parse', '--verify', '-q', `${remote}/${MAIN}^{commit}`); }catch(_){ hasMain = false; }
  if(hasMain){
    const core = mainCore(git, `${remote}/${MAIN}`);
    if(core) branches.push({ name: MAIN, core, tag: '' });
  }
  /* 다른 판(또는 main)에 통째로 들어간 판 — 짝마다 «대신 말할 판» 이 있는지 pairs 가 본다 */
  const isAnc = (a, b) => { try{ git('merge-base', '--is-ancestor', a, b); return true; }catch(_){ return false; } };
  for(const a of branches){
    a.inside = a.name === MAIN ? [] : branches.filter(b => b !== a && isAnc(refOf(a.name), refOf(b.name))).map(b => b.name);
  }
  branches.sort((a, b) => cmpCore(a.core, b.core) || (a.name < b.name ? -1 : 1));
  const results = [];
  for(const [from, to] of pairs(branches, o.target)){
    const base = git('merge-base', refOf(from), refOf(to)).trim();
    const R = { base: rulesAt(git, base), src: rulesAt(git, refOf(from)), dst: rulesAt(git, refOf(to)) };
    if(!R.src) continue;                     // 앞 판에 규칙 파일이 없으면 옮길 것도 없다
    if(!R.dst) throw new Error(`규칙 파일을 못 읽음 — ${refOf(to)} (${RULES_PATHS.join(' · ')})`);
    const d = drift(R.base || {}, R.src, R.dst);
    results.push({ from, to, base: base.slice(0, 7), ...d });
  }
  return { branches, results };
}

/* ── 알리기 ───────────────────────────────────────────────────────────────── */

const LIST_MAX = 6;   // 한 묶음에서 이름을 보여 줄 칸 수 — 넘으면 «외 n»

/** 사람이 읽는 글(터미널) — 짝마다 빠짐 · 확인 필요를 노드 묶음으로.
 * @param {ReturnType<typeof scan>['results']} results @returns {string} */
function formatText(results){
  const lines = [];
  for(const r of results){
    const n = r.missing.length + r.diverged.length;
    lines.push(`${n ? '⚠' : '✓'} ${r.from} → ${r.to} (갈라진 곳 ${r.base}) — 빠짐 ${r.missing.length} · 확인 필요 ${r.diverged.length}`);
    for(const [label, keys] of [['빠짐', r.missing], ['확인 필요', r.diverged]]){
      for(const g of groupKeys(keys)){
        const shown = g.keys.slice(0, LIST_MAX).map(k => k.slice(g.node.length) || '(노드 자체)');
        const more = g.keys.length > LIST_MAX ? ` 외 ${g.keys.length - LIST_MAX}` : '';
        lines.push(`    ${label} ${g.node}: ${shown.join(' · ')}${more}`);
      }
    }
  }
  return lines.join('\n');
}

/** GitHub Actions 경고 줄 — 짝 하나에 한 줄(묶음 이름만). 줄바꿈 · % 는 GitHub 규칙대로 바꿔 쓴다.
 * @param {ReturnType<typeof scan>['results']} results @returns {string[]} */
function formatAnnotations(results){
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const out = [];
  for(const r of results){
    if(!r.missing.length && !r.diverged.length) continue;
    const parts = [];
    if(r.missing.length) parts.push(`빠짐 ${r.missing.length}칸(${groupKeys(r.missing).map(g => g.node).join(', ')})`);
    if(r.diverged.length) parts.push(`확인 필요 ${r.diverged.length}칸(${groupKeys(r.diverged).map(g => g.node).join(', ')})`);
    out.push(`::warning title=${esc(`DB 규칙: ${r.from} → ${r.to}`)}::${esc(`${r.from} 에서 바꾼 규칙이 ${r.to} 에 없다 — ${parts.join(' · ')}. 자세한 칸은 이 실행의 요약(Summary).`)}`);
  }
  return out;
}

/** 실행 요약(마크다운). @param {ReturnType<typeof scan>['results']} results @returns {string} */
function formatSummary(results){
  const rows = results.map(r => `| ${r.from} → ${r.to} | ${r.base} | ${r.missing.length} | ${r.diverged.length} |`);
  const body = ['## 🔀 판끼리 DB 규칙', '', '| 짝(앞 → 뒤) | 갈라진 곳 | 빠짐 | 확인 필요 |', '|---|---|---|---|', ...rows, ''];
  const detail = formatText(results.filter(r => r.missing.length || r.diverged.length));
  if(detail) body.push('<details><summary>칸 목록</summary>', '', '```', detail, '```', '', '</details>', '');
  body.push('«빠짐» = 앞 판에서 바꿨는데 뒤 판은 그대로 · «확인 필요» = 양쪽이 다르게 고침. 앞 판의 규칙 커밋을 뒤 판으로 옮기는 PR 로 맞춘다.');
  return body.join('\n') + '\n';
}

module.exports = { RULES_PATHS, parseRules, flatten, drift, groupKeys, parseRelease, cmpCore, pairs, rulesAt, scan,
  formatText, formatAnnotations, formatSummary };

if(require.main === module){
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const github = argv.includes('--github');
  try{
    const { results } = scan({ cwd: process.cwd(), remote: opt('--remote'), target: opt('--target'), ref: opt('--ref') });
    console.log(results.length ? formatText(results) : '볼 짝이 없다(앞 판이 없거나 모두 다른 판에 들어감)');
    if(github){
      for(const l of formatAnnotations(results)) console.log(l);
      if(process.env.GITHUB_STEP_SUMMARY) require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(results));
    }
    process.exit(0);
  }catch(e){
    console.error(`판끼리 규칙을 보지 못했다 — ${e.message}`);
    if(github) console.log(`::error title=DB 규칙 비교 실패::${String(e.message).replace(/\n/g, ' ')}`);
    process.exit(2);
  }
}
