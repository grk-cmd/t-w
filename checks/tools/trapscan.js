/* ═══ 주석함정 훑기 — CHECKS.md §4-⑧ · §12 ═══════════════════════════════════
   [무엇을 잡나] 검사가 원본에 정규식을 걸 때 **주석을 걷지 않은 본문**에 걸면,
     원본 주석에 「하지 말 것」으로 인용해 둔 옛 코드에 걸려 **코드를 통째로 지워도 초록**이 된다.
     빨강이 아니라 조용한 초록이라 눈으로는 절대 안 보인다.

   [두 쪽짜리 일이다]
     tokens — 원본 쪽. 「주석에만 있고 본문에는 없는 토큰」을 뽑는다.
              검사가 어느 판이든 상관없다. 원본의 성질이다.
     sweep  — 검사 쪽. 검사가 건 정규식을 원본의 **원문**과 **주석제거본** 양쪽에 대 본다.
              원문에만 걸리면 그게 진짜 함정이다.

   ⚠️ sweep 은 반드시 **정본 판 검사**로 돌릴 것. 옛 판으로 돌리면 옛 판의 정규식을 대는 것이라
     결과가 통째로 무의미하다 — 판 대조는 CHECKS.md §3 표로 먼저 한다.

   사용:
     node trapscan.js tokens main.js overlay-win.js …
     node trapscan.js sweep  sim-overlay-gap.js main.js app.js
*/
'use strict';
const fs = require('fs'), path = require('path');

/* ── 주석 제거 ────────────────────────────────────────────────────────────
   문자열·템플릿·정규식 리터럴을 건너뛰며 한 글자씩 간다. 주석 자리는 같은 길이의
   공백으로 채워 **오프셋을 보존한다** — 줄번호가 안 밀려야 자리를 짚을 수 있다. */
function stripJS(s){
  const out = s.split(''); let i = 0; const n = s.length;
  const blank = (a,b) => { for(let k=a;k<b;k++) if(out[k] !== '\n') out[k] = ' '; };
  let prev = '';                       // 직전 의미 있는 글자 — 정규식/나눗셈 구분용
  while(i < n){
    const c = s[i], d = s[i+1];
    if(c === '/' && d === '/'){ let j = s.indexOf('\n', i); if(j < 0) j = n; blank(i,j); i = j; continue; }
    if(c === '/' && d === '*'){ let j = s.indexOf('*/', i+2); j = (j<0? n : j+2); blank(i,j); i = j; continue; }
    if(c === '"' || c === "'" || c === '`'){
      let j = i+1;
      while(j < n){ if(s[j] === '\\'){ j += 2; continue; } if(s[j] === c) break; j++; }
      i = j+1; prev = c; continue;
    }
    if(c === '/' && /[^\w)\]$]/.test(prev || ' ')){       // 정규식 리터럴로 본다
      let j = i+1, cls = false, ok = false;
      while(j < n){
        const e = s[j];
        if(e === '\\'){ j += 2; continue; }
        if(e === '\n') break;
        if(e === '[') cls = true; else if(e === ']') cls = false;
        else if(e === '/' && !cls){ ok = true; break; }
        j++;
      }
      if(ok){ i = j+1; prev = '/'; continue; }
    }
    if(!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

/* HTML — <!-- --> 를 지우고 <script> 안쪽은 JS 규칙으로 한 번 더. */
function stripHTML(s){
  const out = s.split('');
  const blank = (a,b) => { for(let k=a;k<b;k++) if(out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while(i < s.length){
    const j = s.indexOf('<!--', i); if(j < 0) break;
    let e = s.indexOf('-->', j+4); e = (e<0? s.length : e+3);
    blank(j, e); i = e;
  }
  return out.join('').replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,
    (m, body) => m.slice(0, m.length - body.length - 9) + stripJS(body) + '</script>');
}
const strip = f => /\.html?$/i.test(f) ? stripHTML : stripJS;

/* ── 모드 1: tokens ─────────────────────────────────────────────────────── */
const NOISE = new Set(('the and for not with this that from into when where which what have been will ' +
  'function return const let var if else true false null undefined new class async await try catch ' +
  'string number object boolean window document console require module exports typeof instanceof').split(/\s+/));

/* 산문 단어는 검사 정규식이 겨눌 일이 거의 없다. 코드꼴만 앞에 낸다 —
   밑줄·달러로 시작 / 대문자 상수 / camelCase. */
const codeish = t => /^[_$]/.test(t) || /^[A-Z0-9_]+$/.test(t) || /[a-z][A-Z]/.test(t);

function tokensOf(s){
  const m = s.match(/[A-Za-z_$][A-Za-z0-9_$]{4,}/g) || [];
  return new Set(m.filter(t => !NOISE.has(t.toLowerCase())));
}

function cmdTokens(files, all){
  for(const f of files){
    const raw = fs.readFileSync(f, 'utf8');
    const body = strip(f)(raw);
    const live = tokensOf(body);
    const only = [...tokensOf(raw)].filter(t => !live.has(t)).sort();
    const code = only.filter(codeish), prose = only.filter(t => !codeish(t));
    const pct = 100 * (raw.length - body.replace(/ +$/gm,'').length) / raw.length;
    console.log(`\n═══ ${path.basename(f)} — ${raw.split('\n').length}줄 · 주석 ${pct.toFixed(0)}%`);
    console.log(`  주석에만 있는 토큰 ${only.length}개 — 코드꼴 ${code.length} · 산문 ${prose.length}`);
    console.log('  ── 코드꼴 (검사가 겨눌 수 있는 것)');
    for(const t of code) console.log('    ' + t);
    if(prose.length && !all) console.log(`  ── 산문 ${prose.length}개 생략 (--all)`);
    if(all) for(const t of prose) console.log('    · ' + t);
  }
}

/* ── 모드 2: sweep ──────────────────────────────────────────────────────── */
const RX = String.raw`\/(?:\\.|\[(?:\\.|[^\]\n])*\]|[^\/\\\n])+\/[gimsuy]*`;

/* 검사가 어느 변수에 무엇을 담았는지, 주석을 걷었는지 알아낸다. */
const STRIPPY = /strip|noComment|decomment|uncomment|comm|code/i;
function bindings(code){
  const map = new Map();     // 변수 → { file, stripped }
  const seen = new Map();    // 변수 → 파일
  let m;

  /* ① 이름 = …'파일.확장자'… — 비탐욕이라 한 줄에 여럿 있어도 각각 잡힌다
        (`const APP = need('app.js'), MAIN = need('main.js')` 가 실제로 있다). */
  /* ⚠️ 이름이 경로와 붙어 오는 검사가 있다 — `__dirname + '/app.js'` · `'./parts/app.js'`.
     앞을 안 열어 두면 그 검사가 통째로 안 보이고 **조용한 0건**이 된다(가짜 초록). */
  const r1 = /([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*?)['"][^'"\n]*?([\w.\-]+\.(?:js|html?|json|py))['"]/g;
  while((m = r1.exec(code))){
    const [, name, rhs, file] = m;
    seen.set(name, file);
    /* 경로만 만드는 줄(`path.join(__dirname,'main.js')`)은 내용이 아니다 — 뒤에서 읽힌다. */
    if(!/(?:^|[^\w.])join\s*\($/.test(rhs)){
      const prev = map.get(name);
      /* ⚠️ 한 변수에 원본 **둘을 이어붙이는** 검사가 있다(`bothSrc = ovlSrc + src`).
         하나만 대면 다른 쪽에 살아 있는 코드를 못 보고 **가짜 함정**이 난다. 목록으로 모은다. */
      map.set(name, { files: prev ? [...new Set([...prev.files, file])] : [file],
                      stripped: (prev && prev.stripped) || STRIPPY.test(rhs) });
    }
  }

  /* ② 파생을 물려받는다 — 이름 = …아는 변수…
        검사는 원본을 통째로 훑지 않고 **잘라서** 훑는다: `src.slice(a,b)` · `fnBody(SRC,'f')` ·
        `stripComments(src)` · `src.match(...)[1]`. 잘라낸 것도 그 원본의 글자다.
     ⚠️ 이 사슬을 안 따라가면 그 정규식들이 **어느 칸에도 안 들어간 채** 사라지고,
        「함정 후보 0」이 「아무것도 안 봤다」와 구분이 안 된다. 실제로 그렇게 56% 가 샜다.
     주석을 걷었는지도 같이 물려받되, 주석 꼴을 지우는 replace 는 걷은 것으로 본다. */
  const STRIPRX = /\\\/\\\*|\\\/\\\/|<!--/;
  for(let pass = 0; pass < 4; pass++){
    const r2 = /([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g;
    while((m = r2.exec(code))){
      const [, name, rhs] = m;
      if(map.has(name) || !rhs) continue;
      /* ⚠️ 함수 정의는 원본 조각이 아니다 — `const chk = (c,m) => …` 의 chk 를 원본으로 집으면
         **「주석 걷음」이 잘못 물들어 그 항목을 안 보고 건너뛴다.** 함정을 놓치는 방향의 오류다. */
      if(/=>|\bfunction\b/.test(rhs)) continue;
      /* ⚠️ **RHS 에 나오는 아는 변수를 전부** 모은다. 첫 하나만 보면
         `bothSrc = ovlSrc + src` 에서 main.js 쪽을 통째로 놓쳐 **가짜 함정**이 난다. */
      const froms = [...new Set((rhs.match(/[A-Za-z_$][\w$]*/g) || [])
                      .filter(w => w !== name && seen.has(w)))];
      if(!froms.length) continue;
      const files = [...new Set(froms.flatMap(w => (map.get(w) || {}).files || [seen.get(w)]))];
      seen.set(name, files[0]);
      map.set(name, { files,
        stripped: STRIPPY.test(rhs) || STRIPRX.test(rhs)
                  || froms.every(w => (map.get(w) || {}).stripped === true) });
    }
  }

  return map;
}

function cmdSweep(check, originals){
  const code = stripJS(fs.readFileSync(check, 'utf8'));   // 검사 자신의 주석은 먼저 걷는다
  const bind = bindings(code);
  /* ⚠️ **이름을 두 번 다르게 쓰는 검사가 있다.** `sim-slot-fit` 의 `strip` 은 §1 에서 CSS 규칙,
     §3 에서 가짜 DOM 객체다. 어느 쪽을 집어도 반은 틀리므로 **판정에서 뺀다** —
     틀린 쪽을 집으면 **가짜 함정**이 나고, 가짜 함정은 진짜를 덮는다.
     빼되 세어서 찍는다(안 본 것을 0 으로 숨기지 않는다). */
  const times = new Map();
  for(const m2 of code.matchAll(/(?:^|[^\w.$])([A-Za-z_$][\w$]*)\s*=[^=]/g))
    times.set(m2[1], (times.get(m2[1]) || 0) + 1);
  let ambiguous = 0;
  for(const v of [...bind.keys()]) if((times.get(v) || 0) > 1){ bind.delete(v); ambiguous++; }
  /* ⚠️ 없는 원본에 스택 트레이스를 뱉지 않는다. 경로를 잘못 준 것은 흔한 일이고
     (`app.js` 는 루트가 아니라 `app/parts/` 에 있다), 그때 나와야 하는 말은
     「그 파일이 없다」 한 줄이지 node 의 내부 호출 스택이 아니다. */
  const have = new Map(), gone = [];
  for(const f of originals){
    let t; try{ t = fs.readFileSync(f, 'utf8'); }catch(_){ gone.push(f); continue; }
    have.set(path.basename(f), { raw: t, body: strip(f)(t) });
  }

  console.log(`\n═══ ${path.basename(check)}`);
  for(const f of gone) console.log(`  ? ${f} — 없다. 이 원본을 보는 항목은 「건너뜀」으로 샌다`);
  if(!bind.size){ console.log('  원본을 담는 변수를 못 찾았다 — 손으로 볼 것'); return 0; }
  for(const [v, b] of bind)
    console.log(`  ${v} ← ${b.files.join(' + ')}  ${b.stripped ? '(주석 걷음)' : '★ 원문 그대로'}`);
  if(new Set([...bind.values()].map(b => b.stripped)).size > 1)
    console.log('  ⚠️ 혼용 — 같은 검사 안에서 한쪽은 걷고 한쪽은 안 걷는다 (§4-⑧ 가 말한 그 모양)');

  /* 정규식을 변수에 담아 쓰는 검사가 있다 — `const re = /…/; re.exec(HTML)`.
     담은 자리를 먼저 모아 두지 않으면 그 항목이 통째로 안 보인다. */
  const rxVar = new Map();
  let m;
  const r0 = new RegExp(`([A-Za-z_$][\\w$]*)\\s*=\\s*(${RX})\\s*[;,\\n]`, 'g');
  while((m = r0.exec(code))) rxVar.set(m[1], m[2]);

  const uses = [];
  /* ⚠️ `.replace` · `.split` 은 **변환**이다(검사 제 손의 주석 제거기가 여기 걸린다).
     판정이 아니므로 훑기 대상이 아니다 — 넣으면 검사의 주석 제거기 자신이 함정으로 찍힌다. */
  const r1 = new RegExp(`(${RX})\\s*\\.(?:test|exec)\\(\\s*([A-Za-z_$][\\w$]*)`, 'g');
  while((m = r1.exec(code))) uses.push({ rx: m[1], v: m[2], at: m.index });
  const r2 = new RegExp(`([A-Za-z_$][\\w$]*)\\s*\\.(?:match|search)\\(\\s*(${RX})`, 'g');
  while((m = r2.exec(code))) uses.push({ rx: m[2], v: m[1], at: m.index });
  const r3 = /([A-Za-z_$][\w$]*)\s*\.(?:test|exec)\(\s*([A-Za-z_$][\w$]*)/g;
  while((m = r3.exec(code))) if(rxVar.has(m[1])) uses.push({ rx: rxVar.get(m[1]), v: m[2], at: m.index });

  /* ★ 주석에만 걸린다고 전부 함정은 아니다. **주석이 살아 있는지를 일부러 보는 항목**이
     있다 — 오버레이 검사의 「근거 주석 삭제 → ✗」가 그것이다(변이 목록에 있다).
     가르는 단서는 옆에 붙은 설명 문구다. 판정이 아니라 **분류**이므로 애매하면 함정 쪽에 둔다. */
  const ON_PURPOSE = /주석|근거|적어|적혀|기록|남겨|남아|why|이유/;
  /* 두 번째 단서 — **정규식 자체에 코드꼴 토큰이 없으면** 그건 코드를 찾는 것이 아니라
     문장을 찾는 것이다(「실기기 미검증」·「알파만 바꾼다」처럼 라벨이 주석 문구 그대로인 판).
     한쪽 단서만으로는 못 가른다. 둘 다 아닐 때만 함정 후보로 올린다. */
  const proseRx = rx => !/[A-Za-z_$][\w$]{3,}/.test(rx.replace(/^\/|\/[gimsuy]*$/g,''));
  const labelAt = at => {
    /* ⚠️ **같은 문장 안에서만** 찾는다. 창을 글자 수로 열어 두면 다음 줄 코드가 딸려 들어와
       엉뚱한 문구로 분류된다 — CHECKS.md §5-① 의 「글자 수 창」과 같은 실수다. */
    let seg = code.slice(at, at + 400);
    const end = seg.indexOf(';');
    if(end > 0) seg = seg.slice(0, end);
    const m = seg.match(/['"]((?:\\.|[^'"\\\n]){6,})['"]/);
    return m ? m[1].trim() : '';
  };

  const dyn = (code.match(/new RegExp\(/g) || []).length;
  let traps = 0, onpurpose = 0, checked = 0, skipped = 0, already = 0, notsrc = 0;
  for(const u of uses){
    const b = bind.get(u.v); if(!b){ notsrc++; continue; }
    const parts = b.files.map(f => have.get(f)).filter(Boolean);
    if(!parts.length){ skipped++; continue; }
    const src = { raw: parts.map(x=>x.raw).join('\n'), body: parts.map(x=>x.body).join('\n') };
    if(b.stripped){ already++; continue; }                // 이미 걷었으면 함정이 아니다
    checked++;
    let re; try{ re = eval(u.rx); }catch(_){ continue; }
    const one = new RegExp(re.source, re.flags.replace('g',''));
    if(!(one.test(src.raw) && !one.test(src.body))) continue;
    const line = code.slice(0, u.at).split('\n').length, lab = labelAt(u.at);
    /* 정규식이 `//` · `/*` · `<!--` 를 **대놓고 품고 있으면** 주석을 찾는 것이다
       (`/_pkApplyBg\(\); \/\/ 비율이…/` — 1회차가 의도된 것으로 분류한 그 항목). */
    const wantsComment = /\\\/\\\/|\\\/\\\*|<!--/.test(u.rx);
    if(ON_PURPOSE.test(lab) || proseRx(u.rx) || wantsComment){
      onpurpose++;
      console.log(`  · 주석을 일부러 봄 — :${line}  ${u.rx}  「${lab.slice(0,44)}」`);
    }else{
      traps++;
      console.log(`  ✗ 함정 후보 — :${line}  ${u.rx}  → ${b.files.join(' + ')} 의 **주석에만** 걸린다`
                + (lab ? `  「${lab.slice(0,44)}」` : ''));
    }
  }
  console.log(`  정규식 ${uses.length}건 · 댄 것 ${checked} · 이미 걷음 ${already}`
            + ` · 원본 없어 건너뜀 ${skipped} · 원본 변수가 아님 ${notsrc}`
            + (ambiguous ? ` · 이름을 두 번 쓴 변수 ${ambiguous}개는 판정에서 뺐다` : '')
            + ` · 주석을 일부러 봄 ${onpurpose} · 함정 후보 ${traps}`
            + (dyn ? ` · new RegExp ${dyn}건은 손으로 볼 것` : ''));
  return traps;
}

/* ── 진입 ──────────────────────────────────────────────────────────────── */
const [, , mode, ...rest] = process.argv;
const all  = rest.includes('--all');
const args = rest.filter(a => !a.startsWith('--'));
if(mode === 'tokens') cmdTokens(args, all);
else if(mode === 'sweep') process.exit(cmdSweep(args[0], args.slice(1)) ? 1 : 0);
else{
  console.log('사용:\n  node trapscan.js tokens <원본...> [--all]\n  node trapscan.js sweep <검사.js> <원본...>');
  process.exit(2);
}
