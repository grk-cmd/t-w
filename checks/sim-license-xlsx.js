/* ═══ 📄 sim-license-xlsx.js — 관리자 라이선스 엑셀(xlsx·csv) 일괄 발급 (개정 76 신설) ═══════════════════════
   ・1절: 배선 — 입구 버튼·두 번째 창이 #licenseGenOverlay 안 · 바깥 클릭 예외 · 외부 라이브러리 없음(JSZip 재사용)
   ・2절: 순수 함수 실행 — csv 파싱 · 제목 줄/열 찾기 · 친구코드 후보 · «발급한 적 있음» 표 · 다시 올린 결과 파일(발급 키 열)
   ・3절: 발급 순서 — createLicense → sendInboxMessage(reward) · note 100자 · 한 건씩 순서대로 · 미리보기는 쓰지 않는다
   ⚠️ xlsx 읽기/쓰기(_lxReadXlsx · _lxWriteXlsx)는 DOMParser·JSZip 이 있어야 돈다 — 여기서는 모양만 본다.
     실제 왕복은 2026-10-02 에 헤드리스 크로미움 + openpyxl · LibreOffice 로 확인했다(CHECKS.md 개정 76).
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grab = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };

say('── 1. 배선');
{
  const ov = HTML.indexOf('<div id="licenseGenOverlay"');
  const win = HTML.indexOf('id="licenseXlsxWin"');
  const close = HTML.indexOf('id="licenseGenClose"');
  chk(ov > 0 && win > close && win > ov, '일괄 창은 #licenseGenOverlay 안 · 발급 창 다음(두 번째 자식)');
  const grant = HTML.indexOf('id="licenseGrantMsg"'), open = HTML.indexOf('id="licenseXlsxOpenBtn"'), note = HTML.indexOf('id="licenseGenNote"');
  chk(grant > 0 && open > grant && open < note, '입구 버튼 = 「친구코드로 발급」 바로 아래(메모 칸 앞)');
  chk(/id="licenseXlsxFile" type="file" accept="\.xlsx,\.csv"/.test(HTML), '파일 칸은 .xlsx · .csv');
  chk(/overlayId==='licenseGenOverlay' && e\.target && e\.target\.closest && e\.target\.closest\('#licenseXlsxWin'\)\) return;/.test(SRC),
    '바깥 클릭 예외 — 일괄 창 안 클릭이 발급 창을 닫지 않는다(box = 첫 자식이라 필요)');
  chk(!/vendor\/xlsx|sheetjs|XLSX\./i.test(strip(SRC)) && !/vendor\/xlsx/i.test(HTML), '새 라이브러리 없음 — JSZip 재사용');
  /* 2026-10-04 · 좁은 런처 창에서 일괄 창이 아래 줄로 밀려 잘리던 것 — 자리가 없으면 발급 창을 숨기고 일괄 창만 */
  const B = strip(SRC.slice(SRC.indexOf('(function bindLicenseXlsxBulk'), SRC.indexOf('(function bindLicenseXlsxBulk') + 30000));
  chk(/const fits = [^;]*ov\.clientWidth >= mainBox\.offsetWidth \+ GAP \+ WIN_W/.test(B) && /setSolo\(!fits\);/.test(B), '옆에 설 자리가 없으면 일괄 창만 보인다');
  chk(/function hideWin\(\)\{ win\.style\.display = 'none'; setSolo\(false\); \}/.test(B) && /gc\.addEventListener\('click', hideWin\)/.test(B)
    && /window\._lxHideWin = hideWin;/.test(B), '닫으면(✕ · 발급 창 닫기) 발급 창이 돌아온다');
  chk(/o\.style\.display='flex';\s*if\(typeof window\._lxHideWin==='function'\) window\._lxHideWin\(\);/.test(SRC), '발급 창을 다시 열면 발급 창부터');
  chk(/JSZip\.loadAsync\(buf\)/.test(grab('_lxReadXlsx')) && /new JSZip\(\)/.test(grab('_lxWriteXlsx')), '읽기·쓰기 모두 JSZip');
}

say('── 2. 순수 함수 실행');
{
  const consts = (SRC.match(/const LX_MAX_ROWS = \d+;[\s\S]*?const LX_CODE_RE = [^\n]+\n/) || [''])[0];
  const fns = ['_lxParseCsv', '_lxMapRows', '_lxCandidates', '_lxIssuedIndex', '_lxWasIssued'].map(grab);
  chk(!!consts && fns.every(Boolean), '함수 다섯 · 상수를 찾았다');
  const L = new Function(consts + fns.join('\n') + '\nreturn { _lxParseCsv, _lxMapRows, _lxCandidates, _lxIssuedIndex, _lxWasIssued };')();
  const g = L._lxParseCsv('친구코드,메모\r\nMATE-AAAA,"쉼표, 있음"\n"bbbb","따옴표 ""안"""\n\n,빈 코드\n');
  chk(g.length === 5 && g[1][1] === '쉼표, 있음' && g[2][1] === '따옴표 "안"' && g[2][0] === 'bbbb', 'csv — 따옴표·쉼표·"" · CRLF');
  chk(L._lxParseCsv('a\tb\nc\td')[1][1] === 'd', 'csv — 쉼표 없고 탭이면 탭으로 가른다');
  let m = L._lxMapRows(g);
  chk(m.header && m.codeCol === 0 && m.memoCol === 1 && m.data.length === 3, '제목 줄 · 빈 줄은 건너뜀(자료 3행)');
  chk(m.data[2].code === '' && m.data[2].memo === '빈 코드' && m.data[2].line === 5, '빈 코드 행은 남는다(키만 발급) · 행 번호는 파일 기준');
  m = L._lxMapRows([['메모', '친구코드'], ['x', 'COZY-1234']]);
  chk(m.codeCol === 1 && m.memoCol === 0 && m.data[0].code === 'COZY-1234', '열 순서가 바뀌어도 제목으로 찾는다');
  m = L._lxMapRows([['MATE-9K2M', 'a'], ['4HTR', 'b']]);
  chk(m.header === null && m.data.length === 2 && m.data[0].line === 1, '첫 줄이 친구코드처럼 생기면 제목 없음으로 본다');
  m = L._lxMapRows([['친구코드', '메모', '발급 키', '결과', '사유'], ['MATE-9K2M', '', 'AAAA-BBBB-CCCC-DDDD', '수령함 발송', ''], ['MATE-ZZZZ', '', '', '건너뜀', '']]);
  chk(m.keyCol === 2 && m.data[0].hasKey === true && m.data[1].hasKey === false, '다시 올린 결과 파일 — «발급 키» 가 찬 행을 알아본다');
  chk(JSON.stringify(L._lxCandidates(' 9k2m ')) === '["MATE-9K2M","COZY-9K2M"]' && JSON.stringify(L._lxCandidates('mate-9k2m')) === '["MATE-9K2M"]'
    && L._lxCandidates('').length === 0, '친구코드 후보 — 단건 발급과 같은 규칙(뒷 4자리 → MATE·COZY)');
  const idx = L._lxIssuedIndex({ a:{ note:'콩떡이 · 친구코드 MATE-9K2M · 메모' }, b:{ note:'친구코드 발급: 4HTR' }, c:{ note:'엑셀 일괄 · 친구코드 아님' } });
  chk(L._lxWasIssued(idx, 'MATE-9K2M') && L._lxWasIssued(idx, 'COZY-4HTR') && !L._lxWasIssued(idx, 'MATE-ZZZZ'), '발급한 적 있음 — 두 메모 모양을 다 읽는다');
  chk(!idx.tail.has('MATE'), '«친구코드 MATE-…» 의 MATE 를 4자리 코드로 잘못 읽지 않는다');
}

say('── 3. 발급 순서');
{
  const B = strip((SRC.match(/\(function bindLicenseXlsxBulk\(\)\{[\s\S]*?\n\}\)\(\);/) || [''])[0]);
  chk(!!B, 'bindLicenseXlsxBulk 를 찾았다');
  const run = (B.match(/async function run\(\)\{[\s\S]*?\n  \}/) || [''])[0];
  const load = (B.match(/async function loadFile\(f\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(run.indexOf('createLicense(key, note)') > 0 && run.indexOf('createLicense(key, note)') < run.indexOf("sendInboxMessage(r.uid, 'reward'"), 'createLicense 다음에 수령함(reward)');
  chk(/for\(const r of todo\)\{/.test(run) && /await firebaseAPI\.createLicense/.test(run) && !/Promise\.all/.test(run), '한 건씩 순서대로(동시에 쏘지 않는다)');
  chk(/\.slice\(0, LX_NOTE_MAX\)/.test(run) && /const LX_NOTE_MAX = 100;/.test(SRC), 'note 는 규칙 상한 100자로 자른다');
  chk(/confirm\(/.test(run), '발급 전에 한 번 묻는다');
  chk(!/createLicense|sendInboxMessage/.test(load), '미리보기(loadFile)는 키 생성·발송을 안 한다');
  chk(/if\(d\.hasKey\) r\.base = 'haskey';/.test(load) && /r\.base === 'haskey' && r\.code && !seen\.has\(r\.code\)/.test(B), '이미 키 있는 행은 다시 안 만들고, 그 코드의 뒷 행은 중복으로 거른다');
  chk(/수령함 실패|sendfail/.test(run) && /r\.key = key;/.test(run), '수령함만 실패해도 키는 결과에 남긴다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
