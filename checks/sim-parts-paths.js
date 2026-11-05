/* sim-parts-paths.js — 📂 렌더러 파일 경로가 **실제 폴더 기준으로** 다 맞는가 (HTML <script src> · ES 모듈 상대 import)
   실행:  node sim-parts-paths.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 앱 구조 정리 3단계에서 app/parts/ 의 파일을 도메인 폴더(room/ · chat/ …)로 나눈다.
     러너는 app/parts/ 아래 .js 를 **평평하게 펴서** 다른 검사를 돌리므로, 실제 앱에서 <script src> 나
     import "./room-index.js" 경로가 틀려도 다른 검사는 다 초록이다 — 앱을 켜야 «파일 없음» 으로 드러난다.
     그래서 펴기 전 모양(스테이징의 parts/ 폴더째 사본 · 저장소의 app/)으로 경로를 직접 따라가 본다.
   ・1절: HTML 의 <script src> 가 가리키는 파일이 다 있다(외부 주소 제외)
   ・2절: parts/ 아래 .js 의 상대 import · export from · import() 가 가리키는 파일이 다 있다
   ・3절: 일부러 깨 보기 — 없는 경로를 넣으면 잡는다 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* 기준 폴더 = desk-companion-prototype.html 이 있는 곳(스테이징은 그 자리 · 저장소 루트면 app/) */
const BASE = ['.', 'app'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const HTML = fs.readFileSync(path.join(BASE, 'desk-companion-prototype.html'), 'utf8');

/* parts/ 아래 .js 전부(폴더째) — vendor 는 외부 라이브러리라 뺀다 */
function walk(d, out){
  for (const e of fs.readdirSync(d, { withFileTypes: true })){
    const p = path.join(d, e.name);
    if (e.isDirectory()){ if (e.name !== 'vendor' && e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* 판정 — HTML 글 · { 파일 경로: 글 } 을 받아 빠진 경로 목록을 돌려준다(깨 보기에서 같은 판정을 다시 쓴다) */
function judge(html, files, exists){
  const missSrc = [], missImp = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)){
    const src = m[1];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    if (!exists(path.join(BASE, src.split('?')[0]))) missSrc.push(src);
  }
  for (const [file, txt] of Object.entries(files)){
    const code = txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    const specs = [
      ...[...code.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g)].map(x => x[1]),
      ...[...code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map(x => x[1]),
      ...[...code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(x => x[1]),
    ];
    for (const s of specs){
      if (!s.startsWith('./') && !s.startsWith('../')) continue;   // 외부 주소(gstatic 등) · 이름 상수는 대상 아님
      if (!exists(path.resolve(path.dirname(file), s))) missImp.push(path.relative(BASE, file) + ' → ' + s);
    }
  }
  return { missSrc, missImp };
}

const FILES = {};
for (const f of walk(path.join(BASE, 'parts'), [])) FILES[f] = fs.readFileSync(f, 'utf8');
const real = (p) => fs.existsSync(p);

say('── 1. HTML <script src>');
const srcCount = [...HTML.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].length;
const R = judge(HTML, FILES, real);
chk(srcCount > 50, '<script src> ' + srcCount + '줄을 읽었다(너무 적으면 HTML 을 잘못 읽은 것)');
chk(R.missSrc.length === 0, '가리키는 파일이 다 있다' + (R.missSrc.length ? ' — 없음: ' + R.missSrc.join(' · ') : ''));

say('── 2. ES 모듈 상대 import');
const impCount = Object.values(FILES).reduce((n, t) => n + (t.match(/\bfrom\s*['"]\.\.?\//g) || []).length, 0);
chk(impCount >= 16, '상대 import ' + impCount + '줄을 읽었다(firebase-init.js 만 16줄)');
chk(R.missImp.length === 0, '가리키는 파일이 다 있다' + (R.missImp.length ? ' — 없음: ' + R.missImp.join(' · ') : ''));

say('── 3. 일부러 깨 보기 — 없는 경로를 넣으면 잡는다');
{
  const h2 = HTML.replace('<script src="parts/app.js"></script>', '<script src="parts/room/app.js"></script>');
  chk(h2 !== HTML && judge(h2, FILES, real).missSrc.length === 1, '<script src> 하나가 없는 폴더를 가리키면 잡는다');
  const fi = Object.keys(FILES).find(f => path.basename(f) === 'firebase-init.js');
  /* 첫 상대 import 하나를 없는 폴더로 — 파일이 폴더로 옮겨 가도 깰 글자가 남게 이름을 고정하지 않는다 */
  const firstImp = fi && (FILES[fi].match(/from "(\.\.?\/[^"]+)"/) || [])[1];
  const f2 = Object.assign({}, FILES, { [fi]: firstImp ? FILES[fi].replace('from "' + firstImp + '"', 'from "./없는폴더/' + path.basename(firstImp) + '"') : FILES[fi] });
  chk(!!fi && f2[fi] !== FILES[fi] && judge(HTML, f2, real).missImp.length === 1, 'import 하나가 없는 폴더를 가리키면 잡는다');
  const f3 = Object.assign({}, FILES, { [fi]: FILES[fi] + '\n// import { x } from "./없는파일.js"\n' });
  chk(judge(HTML, f3, real).missImp.length === 0, '주석 안의 import 는 세지 않는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
