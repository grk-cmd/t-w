/* ═══ 📄 sim-license-xlsx.js — 관리자 라이선스 엑셀(xlsx·csv) 일괄 발급 (개정 76 신설) ═══════════════════════
   ・1절: 배선 — 입구 버튼·두 번째 창이 #licenseGenOverlay 안 · 바깥 클릭 예외 · 외부 라이브러리 없음(JSZip 재사용)
   ・2절: 순수 함수 실행 — csv 파싱 · 제목 줄/열 찾기 · 친구코드 후보 · 다시 올린 결과 파일(발급 키 열)
   ・3절: 발급 흐름(서버 길) — 미리보기 = POST /v2/admin/licenses/preview · 발급 = POST /v2/admin/licenses 한 번 · note 100자 · 닿지 못하면 같은 요청으로 다시 · 줄마다 까닭
   ・4절: 관리자 모듈 연결 — 본문은 admin/admin-license-bulk.js(app.js 에서 옮김) · app.js 는 원래 자리에서 만들기만 · html 은 app.js 앞에 싣기
   ⚠️ xlsx 읽기/쓰기(_lxReadXlsx · _lxWriteXlsx)는 DOMParser·JSZip 이 있어야 돈다 — 여기서는 모양만 본다.
     실제 왕복은 2026-10-02 에 헤드리스 크로미움 + openpyxl · LibreOffice 로 확인했다(CHECKS.md 개정 76).
   [실행] app.js · desk-companion-prototype.html · admin-license-bulk.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
/* 일괄 발급 본문은 관리자 코드 admin 폴더로 옮겼다 — 저장소 루트에서 돌 때도 찾게 자리를 몇 곳 본다 */
const LB = ['admin-license-bulk.js', 'parts/admin/admin-license-bulk.js', 'app/parts/admin/admin-license-bulk.js'].map(read).find(Boolean);
if(!LB){ say('  ? 원본 못 찾음 — admin-license-bulk.js'); process.exit(2); }
/* 발급 창 열기 handler(lcLicenseGen)는 관리자 3번에서 admin/admin-license.js 로 옮겼다 — 판정은 그 파일 */
const LIC = ['admin-license.js', 'parts/admin/admin-license.js', 'app/parts/admin/admin-license.js'].map(read).find(Boolean);
if(!LIC){ say('  ? 원본 못 찾음 — admin-license.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grab = (name) => { const i = LB.indexOf('function ' + name + '('); if(i < 0) return ''; let k = LB.indexOf('{', i), d = 0;
  for(; k < LB.length; k++){ if(LB[k] === '{') d++; else if(LB[k] === '}' && --d === 0) return LB.slice(i, k + 1); } return ''; };

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
  chk(!/vendor\/xlsx|sheetjs|XLSX\./i.test(strip(SRC)) && !/vendor\/xlsx|sheetjs|XLSX\./i.test(strip(LB)) && !/vendor\/xlsx/i.test(HTML), '새 라이브러리 없음 — JSZip 재사용');
  /* 2026-10-04 · 좁은 런처 창에서 일괄 창이 아래 줄로 밀려 잘리던 것 — 자리가 없으면 발급 창을 숨기고 일괄 창만 */
  const B = strip(LB.slice(LB.indexOf('(function bindLicenseXlsxBulk'), LB.indexOf('(function bindLicenseXlsxBulk') + 30000));
  chk(/const fits = [^;]*ov\.clientWidth >= mainBox\.offsetWidth \+ GAP \+ WIN_W/.test(B) && /setSolo\(!fits\);/.test(B), '옆에 설 자리가 없으면 일괄 창만 보인다');
  chk(/function hideWin\(\)\{ win\.style\.display = 'none'; setSolo\(false\); \}/.test(B) && /gc\.addEventListener\('click', hideWin\)/.test(B)
    && /window\._lxHideWin = hideWin;/.test(B), '닫으면(✕ · 발급 창 닫기) 발급 창이 돌아온다');
  chk(/o\.style\.display\s*=\s*'flex';\s*window\._lxHideWin\(\);/.test(LIC), '발급 창을 다시 열면 발급 창부터');
  chk(/JSZip\.loadAsync\(buf\)/.test(grab('_lxReadXlsx')) && /new JSZip\(\)/.test(grab('_lxWriteXlsx')), '읽기·쓰기 모두 JSZip');
}

say('── 2. 순수 함수 실행');
{
  const consts = (LB.match(/const LX_MAX_ROWS = \d+;[\s\S]*?const LX_CODE_RE = [^\n]+\n/) || [''])[0];
  const fns = ['_lxParseCsv', '_lxMapRows', '_lxCandidates'].map(grab);
  chk(!!consts && fns.every(Boolean), '함수 셋 · 상수를 찾았다');
  const L = new Function(consts + fns.join('\n') + '\nreturn { _lxParseCsv, _lxMapRows, _lxCandidates };')();
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
}

say('── 3. 발급 흐름 (서버 길 · D11-3)');
{
  const B = strip((LB.match(/\(function bindLicenseXlsxBulk\(\)\{[\s\S]*?\n\}\)\(\);/) || [''])[0]);
  chk(!!B, 'bindLicenseXlsxBulk 를 찾았다');
  const run = (B.match(/async function run\(\)\{[\s\S]*?\n  \}/) || [''])[0];
  const load = (B.match(/async function loadFile\(f\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/adminApi\.issueLicenses\(grants, !!reissue\.checked\)/.test(run) && (run.match(/issueLicenses\(/g) || []).length === 1, '발급은 서버에 한 번 — 줄마다 키 · 친구코드 줄은 우편까지 서버가(앱이 키를 만들지 않고 수령함에 쓰지 않는다)');
  chk(!/firebaseAPI|createLicense|sendInboxMessage|_genLicenseKey|for\(const r of todo\)/.test(run + load), '미리보기 · 발급에 Firebase · 앱이 만든 키 · 한 건씩 도는 길이 없다');
  chk(/\.slice\(0, LX_NOTE_MAX\)/.test(run) && /const LX_NOTE_MAX = 100;/.test(LB), 'note 는 서버 상한 100자로 자른다');
  chk(/confirm\(/.test(run), '발급 전에 한 번 묻는다');
  chk(/adminApi\.previewLicenses\(asked\)/.test(load) && !/issueLicenses/.test(load), '미리보기(loadFile)는 서버 미리보기만 부른다 — 키 생성 · 발송 없음');
  chk(/r\.hasValid/.test(B) && !/_lxWasIssued|_lxIssuedIndex/.test(B), '«이미 유효한 키» 는 서버 미리보기(hasValidLicense)로 — 앱이 메모를 뒤져 짐작하지 않는다');
  chk(/if\(d\.hasKey\) r\.base = 'haskey';/.test(load) && /r\.base === 'haskey' && r\.code && !seen\.has\(r\.code\)/.test(B), '이미 키 있는 행은 다시 안 만들고, 그 코드의 뒷 행은 중복으로 거른다');
  chk(/catch\(e\)\{[\s\S]*?renderPreview\(\);\s*return;/.test(run) && /LX_WHY\[it\.code\]/.test(run), '서버에 닿지 못하면 미리보기 그대로 두고(같은 요청 번호로 다시) · 줄마다 안 된 까닭을 사유로 남긴다');
  chk(/if\(prevErr\)\{ look\.set\(raw, 'err'\); return; \}/.test(load), '미리보기가 실패하면 친구코드 줄은 «조회 실패» 로 두고 발급하지 않는다');
}

say('── 4. 관리자 모듈 연결 (admin/admin-license-bulk.js)');
{
  chk(!/function _lx|LX_MAX_ROWS|bindLicenseXlsxBulk|bindSecretRoomGrant/.test(strip(SRC)), 'app.js 에 옮긴 본문이 남지 않았다(두 벌이면 버튼이 두 번 걸린다)');
  const mk = (SRC.match(/const adminLicenseBulk = TwAdminLicenseBulk\.createAdminLicenseBulk\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  chk(deps.length === 8 && deps.includes('adminApi: adminApi,') && deps.includes('apiErrors: TwApiErrors.store,') && deps.includes('notifyError: (...a)=>TwErrorCodes.notify(...a),')
    && deps.filter(l => /^\w+: \(\.\.\.a\)=>[\w$.]+\(\.\.\.a\),$/.test(l)).length === 6, 'app.js 가 원래 자리에서 만든다 — deps 8개(서버 길 셋 + 화살표 여섯 — 나중에 선언된 함수도 부를 때 찾는다 · 목록 다시 받기는 adminLicense.이름)');
  chk(!/\bADMIN_LICENSE_BULK_OFF\b/.test(SRC), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const hS = SRC.indexOf('/* ═══ 🔒 시크릿룸 발급(관리자) ═══ */'), hM = SRC.indexOf('const adminLicenseBulk =');
  chk(hS > 0 && hM > hS, '만드는 줄은 원래 자리(🔒 시크릿룸 발급 머리 아래) — 버튼을 거는 때가 예전과 같다');
  const used = ['escHtml', 'toast', 'adminApi', 'apiErrors', 'notifyError', 'renderLicenseGenList', 'downloadBlob', '_srFmtDate'];
  const body = strip(LB.slice(LB.indexOf('function createAdminLicenseBulk(deps){')));
  chk(used.every(n => new RegExp('const ' + n.replace('$', '\\$') + ' = deps\\.').test(body)), '본문이 쓰는 app.js 함수 · 서버 길 여덟을 deps 로 받는다');
  chk(/window\.TwAdminLicenseBulk = api;/.test(LB) && /module\.exports = api;/.test(LB), '전역 이름 TwAdminLicenseBulk(Tw 접두사 — 크로미움 내장 전역과 안 겹침)');
  const iM = HTML.indexOf('<script src="parts/admin/admin-license-bulk.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — admin/admin-license-bulk.js 를 app.js 보다 먼저 싣는다');
  /* 실제로 만들어 본다 — 가짜 DOM 에서 버튼이 걸리고 window._lxHideWin 이 생기는지 */
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, style:{}, value:'', checked:false, disabled:false, textContent:'', innerHTML:'', files:null,
    parentElement:null, firstElementChild:null, offsetWidth:300, clientWidth:900, _on:{}, addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, click(){} });
  const win = { };
  const g = { document:{ addEventListener(t, f){ (this._h = this._h || {})[t] = ((this._h[t]) || []).concat(f); }, dispatchEvent(e){ ((this._h || {})[e.type] || []).forEach(f => f(e)); }, getElementById: el }, window: win, module: undefined };
  const fn = new Function('document', 'window', 'module', LB + '\nreturn window.TwAdminLicenseBulk;');
  const api = fn(g.document, g.window, undefined);
  const noop = () => {};
  const out = api.createAdminLicenseBulk({ escHtml: s => String(s), toast: noop, adminApi: {}, apiErrors: {}, notifyError: noop, renderLicenseGenList: noop, downloadBlob: noop, srFmtDate: () => '' });
  chk(out && typeof out === 'object' && !Object.keys(out).length, '만들면 빈 객체를 돌려준다(밖에서 부르는 이름 없음)');
  chk(typeof win._lxHideWin === 'function', '만들 때 window._lxHideWin 을 건다(발급 창을 다시 열 때 부름)');
  chk((els.licenseXlsxOpenBtn._on.click || []).length === 1 && (els.srGrantBtn._on.click || []).length === 1 && (els.srGrantCode._on.keydown || []).length === 1,
    '만들 때 버튼을 한 번씩 건다 — 일괄 발급 입구 · 시크릿룸 발급 · 코드 칸 Enter');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
