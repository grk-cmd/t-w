/* ═══ 🛣️ sim-api-routes.js — 앱이 부르는 /v2 endpoint 가 서버에 있는가 ═══════════════════════════
   [왜] #887 이 앱의 서버 endpoint 앞부분을 /v1 → /v2 로 기계적으로 바꾸며 서버에 없는 endpoint 가 둘 생겼다
     (GET /v2/catalog/{parts·gachaParts·items·desks} · GET /v2/users/{uid}/card). 어느 검사도 «서버에 그 endpoint 가 있나» 를 보지 않아 그대로 나갔다.
     이 검사는 앱 코드가 부르는 모든 /v2 endpoint(메서드 포함)가 서버 endpoint 목록 server-routes.json 에 있는지 본다 — 같은 실수를 앱에서 막는 장치다.
   [서버 endpoint 목록] checks/server-routes.json — origin/dev 컨트롤러에서 뽑아 커밋한 것(맨 위에 어느 커밋에서 뽑았는지 · 다시 뽑는 법). 서버 endpoint 가 바뀌면 같이 고친다.
   1. 목록 — 모양 · /v2 만 · 겹침 없음 · 어느 커밋에서 뽑았는지가 적혀 있다
   2. 앱 endpoint 뽑기 — 앱 코드(parts/ · hosting help)의 '/v2/…' 글(+ 이어 붙인 조각 · 템플릿)에서 endpoint · 메서드를 뽑는다. 뽑은 수가 바닥 아래로 내려가면 빨강(뽑기가 낡아 조용히 0개를 보는 것을 막는다)
   3. 대조 — 뽑은 endpoint 마다: 메서드를 알면 «메서드 endpoint» 가 서버 목록에 있어야 한다. 메서드를 못 정한 endpoint(상수 표만 있고 부르는 줄이 따로 있는 것)는 어느 메서드로든 endpoint 가 있어야 한다
   4. mutation test — 없는 endpoint(#887 의 둘 · 만든 endpoint) · 틀린 메서드를 앱 글에 넣으면 빨강 · 서버 목록에서 endpoint 를 지우면 빨강 · 뽑기를 망가뜨리면 빨강
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const HERE = __dirname;
const ROUTES_FILE = path.join(HERE, 'server-routes.json');
if(!fs.existsSync(ROUTES_FILE)){ say('  ? 원본 못 찾음 — server-routes.json'); process.exit(2); }
const SERVER = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));

/* 앱 코드 모으기 — parts/ 아래 .js(vendor 뺌) + 도움말 link.html. 러너 스테이징(parts/ · hosting/help/)과 저장소 checks/ 에서 둘 다 찾는다. */
const PART_ROOTS = ['parts', path.join('app', 'parts'), path.join('..', 'apps', 'desktop', 'app', 'parts'), path.join('..', 'app', 'parts')].map((d) => path.resolve(HERE, d));
const PART_ROOT = PART_ROOTS.find((d) => fs.existsSync(d));
const HTML_CANDIDATES = ['hosting/help/link.html', '../firebase/hosting/help/link.html', 'help/link.html'].map((d) => path.resolve(HERE, d));
function walk(dir, out){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    if(e.name === 'vendor' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p, out);
    else if(e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
if(!PART_ROOT){ say('  ? 원본 못 찾음 — parts/ (앱 코드 폴더)'); process.exit(2); }
const FILES = {};
for(const p of walk(PART_ROOT, [])) FILES[path.relative(PART_ROOT, p)] = fs.readFileSync(p, 'utf8');
const html = HTML_CANDIDATES.find((p) => fs.existsSync(p));
if(html) FILES['help/link.html'] = fs.readFileSync(html, 'utf8');

/* ── 글자 훑기 — 주석을 걷고 글(문자열)은 남긴다. 글 안의 // 나 /* 에 속지 않는다. 정규식 글(/…/)은 따로 못 가리므로 글 시작 · 끝을 따라가며 틀어지면 그 줄만 놓친다 ── */
function codeOnly(src){
  let out = '', i = 0; const n = src.length;
  while(i < n){
    const c = src[i], d = src[i + 1];
    if(c === '/' && d === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
    if(c === '/' && d === '*'){ const j = src.indexOf('*/', i + 2); const end = j < 0 ? n : j + 2; for(let k = i; k < end; k++) if(src[k] === '\n') out += '\n'; i = end; continue; }
    if(c === '\'' || c === '"'){
      let j = i + 1; while(j < n && src[j] !== c && src[j] !== '\n'){ if(src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if(c === '`'){
      let j = i + 1, depth = 0;
      while(j < n){
        if(src[j] === '\\'){ j += 2; continue; }
        if(depth === 0 && src[j] === '`') break;
        if(src[j] === '$' && src[j + 1] === '{'){ depth++; j += 2; continue; }
        if(depth > 0 && src[j] === '}'){ depth--; j++; continue; }
        j++;
      }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/* 글 하나(따옴표 포함)를 읽어 { text(정적 글 · 변수 자리는 {}), end } — 템플릿의 ${…} 는 {} 로 */
function readString(code, i){
  const q = code[i], n = code.length;
  if(q === '\'' || q === '"'){
    let j = i + 1, t = '';
    while(j < n && code[j] !== q){ if(code[j] === '\\'){ t += code[j + 1]; j += 2; continue; } t += code[j]; j++; }
    return { text: t, end: j + 1 };
  }
  let j = i + 1, t = '';
  while(j < n && code[j] !== '`'){
    if(code[j] === '\\'){ t += code[j + 1]; j += 2; continue; }
    if(code[j] === '$' && code[j + 1] === '{'){ let d = 1; j += 2; while(j < n && d){ if(code[j] === '{') d++; else if(code[j] === '}') d--; j++; } t += '{}'; continue; }
    t += code[j]; j++;
  }
  return { text: t, end: j + 1 };
}
/* 변수 자리 하나를 건너뛴다 — 다음 최상위 + , ) ] } ; 줄바꿈(괄호 밖) 앞까지 */
function skipOperand(code, i){
  const n = code.length; let d = 0;
  while(i < n){
    const c = code[i];
    if(c === '(' || c === '[' || c === '{') d++;
    else if(c === ')' || c === ']' || c === '}'){ if(d === 0) break; d--; }
    else if(d === 0 && (c === '+' || c === ',' || c === ';' || c === '\n')) break;
    else if(c === '\'' || c === '"' || c === '`'){ i = readString(code, i).end; continue; }
    i++;
  }
  return i;
}
const ws = (code, i) => { while(i < code.length && /[ \t\r\n]/.test(code[i])) i++; return i; };

/* i 부터 «+ 조각» 을 이어 붙인 글 — 글 조각은 그대로, 변수 자리는 {}. 쿼리(?)부터는 멈춘다 */
function chain(code, i, base){
  let text = '', dynamic = false;
  for(;;){
    let k = ws(code, i);
    if(code[k] !== '+') break;
    k = ws(code, k + 1);
    if(code[k] === '\'' || code[k] === '"' || code[k] === '`'){ const s = readString(code, k); text += s.text; i = s.end; }
    else{
      const e = skipOperand(code, k);
      if(/query|qs\(|search/i.test(code.slice(k, e).replace(/\s+/g, ''))){ text += '?'; i = e; break; }   // queryOf({ … }) 같은 쿼리 만들기 — endpoint 가 아니다
      if(!((base || '') + text).endsWith('/')){ text += '?'; i = e; break; }   // endpoint 조각 사이(/)가 아닌 자리에 붙는 변수(PATHS.list + q)는 쿼리 글이다
      text += '{}'; dynamic = true; i = e;
    }
    if(text.indexOf('?') >= 0) break;
  }
  return { text, end: i, dynamic };
}

/* '/v2/…' 로 시작하는 글을 찾아 이어 붙인 조각까지 모은 endpoint 를 돌려준다 → [{ file, line, path, prefix, key, method }] */
function extract(files){
  const found = [];
  for(const [file, raw] of Object.entries(files)){
    const isHtml = file.endsWith('.html');
    const code = codeOnly(isHtml ? (raw.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || []).join('\n') : raw);
    const re = /(['"`])\/v2\//g; let m;
    while((m = re.exec(code))){
      const start = m.index;
      const first = readString(code, start);
      const ch = chain(code, first.end, first.text);
      let p = first.text + ch.text; const i = ch.end, dynamic = ch.dynamic;
      p = p.split('?')[0].split('#')[0];
      const prefix = p.endsWith('/') && !dynamic;   // '/v2/catalog/assets/' 처럼 뒤를 다른 데서 붙이는 머리
      const line = code.slice(0, start).split('\n').length;
      found.push({ file, line, path: p, prefix, dynamic, start, end: i, code });
    }
  }
  return found;
}

/* 메서드 — ① 바로 앞이 .get( · .post( … 이거나 ('GET', ② 상수 표의 칸(key: 또는 const KEY =)이면 같은 글에서 그 이름을 부르는 .get(…KEY … 를 찾는다. 못 정하면 '?' */
const VERB = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE', delete: 'DELETE' };
/* 돌려줌: [{ method, extra }] — extra 는 부르는 줄에서 상수 뒤에 더 붙인 endpoint(EMOJI_PATH + '/' + slot → '/{}') */
function methodOf(item){
  const { code, start } = item;
  const before = code.slice(Math.max(0, start - 80), start);
  let m = /\.(get|post|put|patch|del|delete)\(\s*(?:\(?[\w.$]*\)?\s*\?[^:]*:\s*)?$/.exec(before);
  if(m) return [{ method: VERB[m[1]], extra: '' }];
  m = /\(\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*$/.exec(before);
  if(m) return [{ method: m[1], extra: '' }];
  m = /([A-Za-z_$][\w$]*)\s*(?::|=)\s*(?:\([^)]*\)\s*=>\s*)?$/.exec(before);
  if(m){
    const key = m[1], out = [], path0 = item.path;
    const use = new RegExp('\\.(get|post|put|patch|del|delete)\\(\\s*(?:[\\w$.]*\\.)?' + key.replace(/\$/g, '\\$') + '\\b', 'g');
    let u;
    while((u = use.exec(code))){
      let k = u.index + u[0].length;
      if(code[k] === '('){ let d = 0; for(; k < code.length; k++){ if(code[k] === '(') d++; else if(code[k] === ')'){ d--; if(!d){ k++; break; } } } }   // PATHS.friend(code) — 이 함수가 endpoint 를 만든다
      else{ const c = chain(code, k, path0); out.push({ method: VERB[u[1]], extra: c.text }); continue; }
      out.push({ method: VERB[u[1]], extra: chain(code, k, path0).text });
    }
    if(out.length) return out;
  }
  return [{ method: '?', extra: '' }];
}

/* ── 대조 ── */
const norm = (p) => p.replace(/\{[^}]*\}/g, '{}');
const segRe = (seg) => new RegExp('^' + seg.split('{}').map((s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[^/]+') + '$');
const segOk = (a, s) => (s.indexOf('{}') < 0 ? a === s : segRe(s).test(a.split('{}').join('x')));   // 서버 변수 칸은 무엇이든 받는다 · 서버 고정 칸은 같은 글만
function matches(appPath, serverPath){
  const a = appPath.split('/'), s = serverPath.split('/');
  return a.length === s.length && a.every((seg, i) => segOk(seg, s[i]));
}
function parseRoutes(list){
  return list.map((r) => { const i = r.indexOf(' '); return { method: r.slice(0, i), path: norm(r.slice(i + 1)) }; });
}
/* 앱 endpoint 하나가 서버에 있나 */
function exists(item, method, routes, extra){
  const ap = norm((item.path + (extra || '')).split('?')[0]);
  if(item.prefix) return routes.some((r) => (method === '?' || r.method === method) && r.path.startsWith(ap));
  return routes.some((r) => (method === '?' || r.method === method) && matches(ap, r.path));
}
function judge(files, list){
  const routes = parseRoutes(list);
  const items = extract(files);
  const missing = [], unknown = [], ok = [];
  for(const it of items){
    for(const { method, extra } of methodOf(it)){
      const label = method + ' ' + (it.path + extra).split('?')[0] + '  (' + it.file + ':' + it.line + ')';
      if(method === '?') unknown.push(label);
      if(exists(it, method, routes, extra)) ok.push(label); else missing.push(label);
    }
  }
  return { items, missing, unknown, ok };
}

(async () => {
  say('── 1. 서버 endpoint 목록(server-routes.json)');
  {
    const L = SERVER.routes;
    chk(Array.isArray(L) && L.length >= 150 && L.every((r) => /^(GET|POST|PUT|PATCH|DELETE) \/v2\/\S+$/.test(r)), '★ «메서드 /v2/경로» 모양만 ' + (L ? L.length : 0) + '개 — /v1 · /internal 은 넣지 않는다');
    chk(new Set(L).size === L.length, '  ↳ 겹친 줄이 없다');
    chk(/origin\/dev [0-9a-f]{7,40}/.test(String(SERVER.source)) && Array.isArray(SERVER.howToRegenerate) && SERVER.howToRegenerate.length >= 3 && Object.keys(SERVER)[0] === 'source',
      '★ 맨 위에 어느 커밋에서 뽑았는지(source) · 다시 뽑는 법(howToRegenerate)이 적혀 있다');
    const need = ['GET /v2/catalog', 'GET /v2/myhomes/cards', 'GET /v2/config', 'GET /v2/me'];
    chk(need.every((r) => L.includes(r)), '  ↳ 이번에 고친 endpoint(GET /v2/catalog · GET /v2/myhomes/cards)와 점검 판정 endpoint(GET /v2/config)가 들어 있다');
    chk(!L.includes('GET /v2/users/{uid}/card') && !L.some((r) => /^GET \/v2\/catalog\/(parts|gachaParts|items|desks)$/.test(r)), '  ↳ #887 이 만든 없는 endpoint 둘은 목록에 없다(있으면 목록이 거짓이다)');
  }

  say('── 2. 앱 endpoint 뽑기');
  const REAL = judge(FILES, SERVER.routes);
  {
    chk(Object.keys(FILES).length >= 100, '앱 코드 ' + Object.keys(FILES).length + '개 파일을 훑는다');
    chk(REAL.items.length >= 80, '★ 뽑은 /v2 글 ' + REAL.items.length + '개(바닥 80) — 0 에 가까우면 뽑기가 낡은 것이다');
    const cat = REAL.items.find((i) => i.file.endsWith('catalog-api.js') && i.path === '/v2/catalog');
    const assets = REAL.items.find((i) => i.file.endsWith('catalog-api.js') && i.path === '/v2/catalog/assets/');
    chk(!!cat && methodOf(cat).some((x) => x.method === 'GET') && !!assets && assets.prefix, '  ↳ 표본 — 카탈로그 endpoint(상수 + api.get)와 파일 endpoint 머리(뒤를 따로 붙임)를 읽는다');
    const frs = REAL.items.filter((i) => i.file.endsWith('social-api.js') && /accept$/.test(i.path));
    chk(frs.length === 1 && frs[0].path === '/v2/me/friend-requests/{}/accept' && methodOf(frs[0]).map((x) => x.method).join() === 'POST', '  ↳ 표본 — 이어 붙인 endpoint(\'/v2/me/friend-requests/\' + enc(from) + \'/accept\')은 {} 로 · 메서드는 부르는 줄(authed.post(PATHS.accept…))에서');
    const known = REAL.ok.length - REAL.unknown.length;
    chk(REAL.ok.length >= 80, '  ↳ 서버에 있는 것으로 확인된 endpoint ' + REAL.ok.length + '줄(메서드까지 확인 ' + Math.max(0, known) + ' · 메서드를 못 정한 ' + REAL.unknown.length + ')');
  }

  say('── 3. 앱 endpoint ↔ 서버 endpoint');
  {
    chk(REAL.missing.length === 0, '★ 앱이 부르는 모든 /v2 endpoint(메서드 포함)가 서버 endpoint 목록에 있다' + (REAL.missing.length ? ' — 서버에 없음: ' + REAL.missing.join(' | ') : ''));
  }

  say('── 4. mutation test');
  {
    const inject = (extra) => Object.assign({}, FILES, { 'zz-inject.js': extra });
    const red = (name, files, list, needle) => {   // 진짜 앱 글의 결과와 상관없이, 심은 것(또는 지운 endpoint)이 «없음» 으로 잡혀야 한다
      const r = judge(files, list || SERVER.routes), hit = r.missing.filter((x) => x.indexOf(needle || 'zz-inject') >= 0);
      chk(hit.length > 0, 'mutation test: ' + name + ' → 빨강' + (hit.length ? ' (' + hit[0].split('  (')[0] + ')' : ''));
    };
    red('#887 의 첫 실수 — GET /v2/catalog/parts?v=', inject("const r = api.get('/v2/catalog/' + kind + '?v=' + ver);"));
    red('#887 의 둘째 실수 — GET /v2/users/{uid}/card', inject("const API_PATHS = { card: (uid) => '/v2/users/' + encodeURIComponent(uid) + '/card' };\nconst d = await api.get(API_PATHS.card(uid));"));
    red('만든 endpoint — GET /v2/nothing/here', inject("await authed.get('/v2/nothing/here');"));
    red('템플릿 글로 만든 없는 endpoint', inject("await authed.get(`/v2/me/friends/${code}/nope`);"));
    red('endpoint 는 있는데 메서드가 틀림 — DELETE /v2/me(서버는 GET · PATCH)', inject("await authed.del('/v2/me');"));
    red('endpoint 는 있는데 메서드가 틀림 — POST /v2/catalog(서버는 GET)', inject("await authed.post('/v2/catalog', {});"));
    red('상수 표의 endpoint + 틀린 메서드', inject("const PATHS = { cards: '/v2/myhomes/cards' };\nawait authed.post(PATHS.cards, {});"));
    red('서버 목록에서 GET /v2/catalog 를 지움(서버가 endpoint 를 바꿈)', FILES, SERVER.routes.filter((r) => r !== 'GET /v2/catalog'), 'GET /v2/catalog ');
    red('서버 목록에서 GET /v2/me/gacha 를 지움', FILES, SERVER.routes.filter((r) => r !== 'GET /v2/me/gacha'), 'GET /v2/me/gacha ');
    const ok1 = judge({ 'zz-inject.js': "await authed.get('/v2/me/friends/' + code);\nawait authed.get(`/v2/myhomes/${code}/bookshelf`);" }, SERVER.routes);
    chk(ok1.missing.length === 0, '  ↳ 짝 확인: 서버에 있는 endpoint 를 이어 붙이거나 템플릿으로 써도 빨강이 아니다(오탐 없음)');
    const dead = judge({ 'zz.js': "await authed.get('/v2/nothing/here');" }, []);
    chk(dead.items.length === 1 && dead.missing.length === 1, '  ↳ 서버 목록이 비면 앱 endpoint 가 전부 «없음» 으로 나온다(목록을 못 읽고 초록이 되지 않는다)');
    /* 뽑기를 망가뜨리면 바닥 판정이 빨강 */
    const cut = {}; for(const k of Object.keys(FILES)) cut[k] = FILES[k].replace(/['"`]\/v2\//g, '"/v3/');
    chk(judge(cut, SERVER.routes).items.length < 80, 'mutation test: 앱 글의 /v2/ 를 못 알아보게 하면 뽑은 수가 바닥 아래로 내려가 빨강이 된다');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
