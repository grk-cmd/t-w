/* admin-license-bulk.js — 📄 엑셀(xlsx·csv) 라이선스 일괄 발급 · 🔒 시크릿룸 발급 (관리자)
   app.js 의 두 구역(«📄 엑셀로 라이선스 일괄 발급» · «🔒 시크릿룸 발급(관리자)»)을 그대로 옮긴 관리자 모듈이다
   (관리자 코드 admin 폴더 1번 · 앱 FSD 순서표 9번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ D8-5: «🔒 시크릿룸 발급» 절만 서버 길(POST /v1/admin/secret-rooms)로 다시 썼다 — 엑셀 일괄 발급 절은 옮긴 그대로.
   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 구역 머리 주석 · 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
   ★ app.js 함수 일곱(escHtml · toast · _genLicenseKey · _saveFailMsg · renderLicenseGenList · downloadBlob · _srFmtDate)은
     app.js 가 화살표로 넘긴다. 본문의 typeof 가드(typeof escHtml · typeof _saveFailMsg)는 예전처럼 늘 통과한다.
   ★ 밖에서 부르는 이름은 없다 — 두 즉시 실행 함수(bindLicenseXlsxBulk · bindSecretRoomGrant)가 버튼을 만들 때 건다.
     발급 창을 다시 열 때 부르는 window._lxHideWin 도 예전처럼 만들 때 건다.
   ★ createAdminLicenseBulk 는 app.js 의 원래 자리(두 구역 머리 아래)에서 부른다 — 예전과 같은 때에 돈다.
   ⚠️ document · window · firebaseAPI · JSZip · DOMParser · confirm 은 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminLicenseBulk — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-xlsx.js — 배선 · 순수 함수 실행 · 발급 순서 · app.js 연결 · html 순서. */
(function(){

function createAdminLicenseBulk(deps){
const escHtml = deps.escHtml;
const toast = deps.toast;
const _genLicenseKey = deps.genLicenseKey;             // 키 만들기 — 단건 발급과 같은 모양
const _saveFailMsg = deps.saveFailMsg;                 // 서버 거부 / 인터넷 끊김 문구 가르기
const renderLicenseGenList = deps.renderLicenseGenList; // 발급 창의 키 목록 다시 그리기
const downloadBlob = deps.downloadBlob;
const _srFmtDate = deps.srFmtDate;                     // 시크릿룸 만료일 글자(YYYY.MM.DD)
/* ═══ 📄 [2026-10-02] 엑셀(xlsx·csv)로 라이선스 일괄 발급 — 시안 확정(입구 = 친구코드 발급 아래 · 빈 코드 = 키만 · 전에 발급한 코드 = 건너뜀) ═══
   흐름: ① 파일 고르기 → ② 미리보기(친구코드 **조회만** — 키 생성·수령함 발송 없음) → ③ [N건 발급] → ④ 결과 엑셀 저장.
   ★ 외부 라이브러리를 새로 넣지 않는다. xlsx 는 «XML 몇 장을 담은 zip» 이라, 이미 실려 있는 JSZip(vendor/jszip.min.js)과
     브라우저 DOMParser 로 첫 시트의 글자만 읽고, 결과 파일도 같은 방식으로 쓴다. (SheetJS npm 판은 알려진 취약점이 있고
     최신판은 npm 밖에서만 받을 수 있어 일부러 피했다.) 옛 .xls(이진 형식)는 못 읽는다 — 안내 문구로 막는다.
   ★ 발급 한 건 = 단건 「친구코드로 발급」(bindLicenseGrantByCode)과 **같은 순서·같은 문구**다: createLicense → sendInboxMessage(reward).
     note 는 규칙 상한(licenses/$key/note ≤ 100자)에 맞춰 자른다.
   ★ «전에 발급한 적 있음» 은 발급된 키 목록(listLicenses)의 메모에서 친구코드를 찾아 판정한다. 관리자 화면에서는 그 사람이
     **지금 프리미엄인지는 알 수 없다**(accountSnap 은 본인만 읽음) — 그래서 이 기준을 쓴다.
   ⚠️ 한 명씩 순서대로 보낸다(동시에 쏘지 않는다). 중간에 끊겨도 결과 표에 어디까지 됐는지 남는다. */
const LX_MAX_ROWS = 500;          // 한 파일 상한 — 넘으면 앞 500행만(안내)
const LX_NOTE_MAX = 100;          // 규칙 licenses/$key/note 상한
const LX_CODE_RE = /^(?:(MATE|COZY)-)?([A-Z0-9]{4})$/;

/* xml 문서에서 이름(네임스페이스 무시)으로 자식 찾기 */
function _lxKids(el, name){ return Array.from(el.getElementsByTagNameNS('*', name)); }
/* 'B12' → 1 (0부터) */
function _lxColIdx(ref){
  const m = /^([A-Z]+)/.exec(String(ref || '').toUpperCase()); if(!m) return -1;
  let n = 0; for(const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1;
}
/* sharedStrings 의 <si> 하나 → 글자. 서식 조각(<r><t>)은 잇고, 일본어·한글 후리가나(<rPh>)는 뺀다. */
function _lxSiText(si){
  let out = '';
  for(const ch of Array.from(si.childNodes)){
    const ln = ch.localName;
    if(ln === 't') out += ch.textContent;
    else if(ln === 'r'){ for(const t of _lxKids(ch, 't')) out += t.textContent; }
  }
  return out;
}
/* xlsx(ArrayBuffer) → 첫 시트의 2차원 글자 배열. 실패하면 Error(사람이 읽는 문구). */
async function _lxReadXlsx(buf){
  if(typeof JSZip === 'undefined') throw new Error('JSZip 라이브러리가 로드되지 않았어요');
  let z;
  try{ z = await JSZip.loadAsync(buf); }catch(_){ throw new Error('엑셀 파일을 열 수 없어요 — .xlsx 로 다시 저장해 주세요(옛 .xls 는 못 읽어요)'); }
  const P = new DOMParser();
  const xml = async (path)=>{ const f = z.file(path); if(!f) return null; return P.parseFromString(await f.async('string'), 'application/xml'); };
  const wb = await xml('xl/workbook.xml');
  if(!wb) throw new Error('엑셀 파일이 아니에요 — .xlsx 로 다시 저장해 주세요');
  const sheet = _lxKids(wb, 'sheet')[0];
  if(!sheet) throw new Error('시트가 없어요');
  /* 첫 시트의 실제 경로 — r:id → workbook.xml.rels 의 Target. 못 찾으면 관례 경로. */
  let path = 'xl/worksheets/sheet1.xml';
  const rid = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  if(rels && rid){
    const rel = _lxKids(rels, 'Relationship').find(r => r.getAttribute('Id') === rid);
    const tgt = rel && rel.getAttribute('Target');
    if(tgt) path = tgt.charAt(0) === '/' ? tgt.slice(1) : ('xl/' + tgt.replace(/^\.\//, ''));
  }
  const sh = await xml(path);
  if(!sh) throw new Error('첫 시트를 읽을 수 없어요');
  const ssDoc = await xml('xl/sharedStrings.xml');
  const ss = ssDoc ? _lxKids(ssDoc, 'si').map(_lxSiText) : [];
  const rows = [];
  for(const row of _lxKids(sh, 'row')){
    const rn = parseInt(row.getAttribute('r'), 10);
    const ri = (rn > 0) ? rn - 1 : rows.length;
    const cells = [];
    let ci = 0;
    for(const c of _lxKids(row, 'c')){
      const ix = _lxColIdx(c.getAttribute('r')); if(ix >= 0) ci = ix;
      const t = c.getAttribute('t') || 'n';
      const v = _lxKids(c, 'v')[0];
      let val = '';
      if(t === 's') val = v ? (ss[parseInt(v.textContent, 10)] || '') : '';
      else if(t === 'inlineStr'){ const is = _lxKids(c, 'is')[0]; val = is ? _lxSiText(is) : ''; }
      else val = v ? v.textContent : '';
      cells[ci] = String(val);
      ci++;
    }
    for(let i = 0; i < cells.length; i++) if(cells[i] === undefined) cells[i] = '';
    rows[ri] = cells;
  }
  for(let i = 0; i < rows.length; i++) if(!rows[i]) rows[i] = [];
  return rows;
}
/* csv 바이트 → 글자. BOM 이 있으면 UTF-8, 없으면 UTF-8 로 엄격히 읽어 보고 깨지면 EUC-KR(한글 엑셀이 저장한 csv). */
function _lxDecodeCsv(buf){
  const u8 = new Uint8Array(buf);
  if(u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
  try{ return new TextDecoder('utf-8', { fatal:true }).decode(u8); }
  catch(_){ try{ return new TextDecoder('euc-kr').decode(u8); }catch(__){ return new TextDecoder('utf-8').decode(u8); } }
}
/* csv 글자 → 2차원 배열(따옴표·따옴표 안 줄바꿈·"" 이스케이프). 쉼표가 없고 탭이 있으면 탭으로 가른다. */
function _lxParseCsv(text){
  const s = String(text || '');
  const firstLine = s.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.indexOf(',') < 0 && firstLine.indexOf('\t') >= 0) ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for(let i = 0; i < s.length; i++){
    const ch = s[i];
    if(q){
      if(ch === '"'){ if(s[i+1] === '"'){ cur += '"'; i++; } else q = false; }
      else cur += ch;
    }else if(ch === '"' && cur === '') q = true;
    else if(ch === sep){ row.push(cur); cur = ''; }
    else if(ch === '\n' || ch === '\r'){
      if(ch === '\r' && s[i+1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    }else cur += ch;
  }
  if(cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
/* 2차원 배열 → { header:[…]|null, codeCol, memoCol, data:[{line, cells, code, memo}] }
   제목 줄 판정: 첫 줄 A칸이 친구코드처럼 생겼으면 제목 없이 바로 자료로 본다. */
function _lxMapRows(rows){
  const norm = v => String(v == null ? '' : v).trim();
  const first = (rows[0] || []).map(norm);
  const looksCode = LX_CODE_RE.test(norm(first[0]).toUpperCase().replace(/\s+/g, ''));
  const hasHeader = rows.length > 0 && !looksCode;
  let codeCol = 0, memoCol = 1, keyCol = -1;
  if(hasHeader){
    const h = first.map(x => x.toLowerCase().replace(/\s+/g, ''));
    const ci = h.findIndex(x => /친구코드|^코드$|code/.test(x));
    const mi = h.findIndex(x => /메모|비고|note|memo/.test(x));
    if(ci >= 0) codeCol = ci;
    if(mi >= 0 && mi !== codeCol) memoCol = mi; else if(ci >= 0) memoCol = (ci === 0 ? 1 : 0);
    /* 결과 파일을 고쳐 다시 올린 경우 — «발급 키» 열에 값이 있는 행은 이미 키가 나간 행이다(아래 hasKey). */
    keyCol = h.findIndex(x => x === '발급키');
  }
  const data = [];
  for(let i = hasHeader ? 1 : 0; i < rows.length; i++){
    const cells = (rows[i] || []).map(norm);
    if(!cells.some(Boolean)) continue;               // 빈 줄은 조용히 넘긴다
    data.push({ line: i + 1, cells, code: cells[codeCol] || '', memo: cells[memoCol] || '', hasKey: keyCol >= 0 && !!cells[keyCol] });
  }
  return { header: hasHeader ? first : null, codeCol, memoCol, keyCol, data };
}
/* 친구코드 입력 → 조회 후보. 단건 발급과 같은 규칙(뒷 4자리면 MATE-·COZY- 둘 다). 빈 값이면 []. */
function _lxCandidates(raw){
  const c = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if(!c) return [];
  if(/^[A-Z0-9]{4}$/.test(c)) return ['MATE-' + c, 'COZY-' + c];
  return [c];
}
/* 발급된 키 목록 → 이미 받은 친구코드 표. 단건 발급 메모 모양 둘(«닉 · 친구코드 MATE-XXXX» · «친구코드 발급: XXXX»)을 다 읽는다.
   full: 'MATE-9K2M' 꼴 · tail: 접두어 없이 적힌 4자리(옛 단건 발급이 입력 그대로 남긴 것). */
function _lxIssuedIndex(all){
  const full = new Set(), tail = new Set();
  Object.keys(all || {}).forEach(k=>{
    const note = String((all[k] || {}).note || '').toUpperCase();
    (note.match(/\b(?:MATE|COZY)-[A-Z0-9]{4}\b/g) || []).forEach(x => full.add(x));
    const m = /친구코드(?: 발급:)? ([A-Z0-9]{4})(?![A-Z0-9-])/.exec(note);
    if(m) tail.add(m[1]);
  });
  return { full, tail };
}
function _lxWasIssued(idx, code){
  if(!idx || !code) return false;
  return idx.full.has(code) || idx.tail.has(code.replace(/^(MATE|COZY)-/, ''));
}
/* 2차원 글자 배열 → xlsx(Uint8Array). 모든 칸은 inlineStr(숫자도 글자로 — 키·코드가 숫자로 바뀌지 않게). */
async function _lxWriteXlsx(rows, sheetName){
  if(typeof JSZip === 'undefined') throw new Error('JSZip 라이브러리가 로드되지 않았어요');
  const esc = TwSafeHtml.attr;   // XML 글자 칸 — 다섯 글자 + 제어 글자 빼기(XML 에 못 들어감)
  const colName = i => { let s = ''; i++; while(i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const width = [];
  rows.forEach(r => r.forEach((v, i) => { width[i] = Math.max(width[i] || 8, Math.min(48, String(v || '').length * 1.6 + 2)); }));
  const cols = width.length ? '<cols>' + width.map((w, i) => '<col min="' + (i+1) + '" max="' + (i+1) + '" width="' + w.toFixed(1) + '" customWidth="1"/>').join('') + '</cols>' : '';
  const body = rows.map((r, ri) => '<row r="' + (ri+1) + '">' + r.map((v, ci) =>
      '<c r="' + colName(ci) + (ri+1) + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>').join('') + '</row>').join('');
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');
  z.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="' + esc(String(sheetName || 'Sheet1').slice(0, 31).replace(/[\\\/?*\[\]:]/g, ' ')) + '" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>');
  z.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Malgun Gothic"/></font><font><b/><sz val="11"/><name val="Malgun Gothic"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>');
  z.file('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + body + '</sheetData></worksheet>');
  return z.generateAsync({ type:'uint8array', compression:'DEFLATE' });
}

(function bindLicenseXlsxBulk(){
  const $ = id => document.getElementById(id);
  const win = $('licenseXlsxWin'), openBtn = $('licenseXlsxOpenBtn');
  if(!win || !openBtn) return;
  const fileInp = $('licenseXlsxFile'), info = $('licenseXlsxFileInfo'), sumEl = $('licenseXlsxSum'), pv = $('licenseXlsxPreview');
  const opts = $('licenseXlsxOpts'), acts = $('licenseXlsxActs'), runBtn = $('licenseXlsxRunBtn');
  const prog = $('licenseXlsxProg'), progText = $('licenseXlsxProgText'), progBar = $('licenseXlsxProgBar');
  const done = $('licenseXlsxDone'), doneSum = $('licenseXlsxDoneSum'), keyOnly = $('licenseXlsxKeyOnly');
  const dupFirst = $('licenseXlsxDupFirst'), reissue = $('licenseXlsxReissue');
  const esc = escHtml;
  /* 상태: rows(판정된 행) · map(파일 열 정보) · fileName · running · finished */
  let S = { rows: [], map: null, fileName: '', running: false, finished: false };
  const CHIP = {
    send:   ['✓ 발송', 'var(--win-select)'],
    key:    ['🔑 키만', 'var(--win-accent)'],
    nouser: ['✗ 유저 없음', 'var(--win-error)'],
    dup:    ['✗ 중복', 'var(--win-error)'],
    issued: ['⚠ 발급한 적 있음', '#9A6B00'],
    badcode:['✗ 코드 형식', 'var(--win-error)'],
    neterr: ['✗ 조회 실패', 'var(--win-error)'],
    haskey: ['⚠ 이미 키 있음', '#9A6B00'],
    ok:     ['✓ 보냄', '#2E7D4F'],
    okkey:  ['🔑 키 생성', '#2E7D4F'],
    sendfail:['⚠ 수령함 실패', '#9A6B00'],
    fail:   ['✗ 발급 실패', 'var(--win-error)'],
  };
  const chip = (st, extra) => { const c = CHIP[st] || [st, 'var(--ink-soft)'];
    return '<span style="display:inline-block;font-size:10px;padding:0 5px;border:1px solid ' + escHtml(c[1]) + ';color:' + escHtml(c[1]) + ';white-space:nowrap;">' + esc(c[0] + (extra || '')) + '</span>'; };
  const actionable = r => r.st === 'send' || r.st === 'key';
  const show = (el, on, disp) => { if(el) el.style.display = on ? (disp || 'block') : 'none'; };

  function resetView(){
    show(sumEl, false); show(pv, false); show(opts, false); show(acts, false); show(prog, false); show(done, false);
  }
  function renderPreview(){
    const n = { send:0, key:0, skip:0 };
    S.rows.forEach(r => { if(r.st === 'send') n.send++; else if(r.st === 'key') n.key++; else n.skip++; });
    sumEl.innerHTML = chip('send', ' ' + n.send).replace('✓ 발송', '수령함 발송') + chip('key', ' ' + n.key).replace('🔑 키만', '키만 발급')
      + (n.skip ? chip('nouser', ' ' + n.skip).replace('✗ 유저 없음', '건너뜀') : '');
    show(sumEl, true, 'flex');
    let h = '<table style="width:100%;border-collapse:collapse;font-size:10.5px;"><tr>'
      + ['행','친구코드','받는 사람','메모','상태'].map(t => '<th style="position:sticky;top:0;background:var(--win-face-2);text-align:left;padding:4px 5px;border-bottom:1px solid var(--win-lo);">' + t + '</th>').join('') + '</tr>';
    S.rows.forEach(r => {
      const dim = actionable(r) || r.res ? '' : 'color:#999;';
      const st = r.res || r.st;
      h += '<tr style="' + escHtml(dim) + '"><td style="padding:4px 5px;border-bottom:1px solid #e3e3e3;">' + Number(r.line) + '</td>'
        + '<td style="padding:4px 5px;border-bottom:1px solid #e3e3e3;">' + (r.raw ? esc(r.raw) + (r.code && r.code !== r.raw.toUpperCase().replace(/\s+/g,'') ? ' <span style="color:var(--ink-soft);">→ ' + esc(r.code) + '</span>' : '') : '<span style="color:var(--ink-soft);">(비어 있음)</span>') + '</td>'
        + '<td style="padding:4px 5px;border-bottom:1px solid #e3e3e3;">' + esc(r.name || '—') + '</td>'
        + '<td style="padding:4px 5px;border-bottom:1px solid #e3e3e3;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(r.memo) + '">' + esc(r.memo) + '</td>'
        + '<td style="padding:4px 5px;border-bottom:1px solid #e3e3e3;">' + chip(st, r.st === 'dup' && !r.res ? ' (' + r.dupOf + '행)' : '') + '</td></tr>';
    });
    pv.innerHTML = h + '</table>';
    show(pv, true);
    const go = S.rows.filter(actionable).length;
    runBtn.textContent = '🎟️ ' + go + '건 발급';
    runBtn.disabled = !go || S.running || S.finished;
    show(opts, !S.finished); show(acts, !S.finished, 'flex');
  }
  /* 판정 — 중복·전에 발급함은 옵션에 따라 다시 계산한다(조회는 다시 안 한다). */
  function judge(){
    const seen = new Map();
    S.rows.forEach(r => {
      r.st = r.base;
      if(r.base === 'haskey' && r.code && !seen.has(r.code)) seen.set(r.code, r.line);
      if(r.base !== 'send') return;
      if(dupFirst.checked && seen.has(r.code)){ r.st = 'dup'; r.dupOf = seen.get(r.code); return; }
      if(!seen.has(r.code)) seen.set(r.code, r.line);
      if(!reissue.checked && _lxWasIssued(S.issued, r.code)) r.st = 'issued';
    });
  }
  async function loadFile(f){
    if(S.running) return;
    S = { rows: [], map: null, fileName: f.name, running: false, finished: false };
    resetView();
    info.textContent = '📎 ' + f.name + ' · 읽는 중…';
    let grid;
    try{
      const buf = await f.arrayBuffer();
      if(/\.csv$/i.test(f.name)) grid = _lxParseCsv(_lxDecodeCsv(buf));
      else if(/\.xls$/i.test(f.name)) throw new Error('옛 .xls 는 못 읽어요 — 엑셀에서 .xlsx 로 다시 저장해 주세요');
      else grid = await _lxReadXlsx(buf);
    }catch(e){ info.textContent = '⚠ ' + ((e && e.message) || '파일을 읽지 못했어요'); return; }
    const map = _lxMapRows(grid);
    let data = map.data;
    const cut = data.length > LX_MAX_ROWS;
    if(cut) data = data.slice(0, LX_MAX_ROWS);
    if(!data.length){ info.textContent = '⚠ ' + f.name + ' — 발급할 줄이 없어요(첫 줄은 제목으로 봐요)'; return; }
    S.map = map; S.grid = grid;
    info.textContent = '📎 ' + f.name + ' · ' + data.length + '행 · 확인 중…' + (cut ? ' (앞 ' + LX_MAX_ROWS + '행만)' : '');
    /* 전에 발급한 코드 표 — 실패해도 미리보기는 계속(그때는 이 판정만 빠진다) */
    try{ S.issued = _lxIssuedIndex(await firebaseAPI.listLicenses()); }catch(_){ S.issued = null; }
    /* 조회 — 같은 코드는 한 번만, 다섯 개씩 나란히 */
    const look = new Map();
    const uniq = [...new Set(data.map(d => d.code.toUpperCase().replace(/\s+/g, '')).filter(Boolean))];
    let doneN = 0;
    const one = async raw => {
      const cands = _lxCandidates(raw);
      let hit = null, err = false;
      for(const c of cands){
        try{ const u = await firebaseAPI.lookupFriendCode(c); if(u){ hit = { uid: u, code: c }; break; } }catch(_){ err = true; }
      }
      if(hit){ try{ if(firebaseAPI.getUserNameById) hit.name = await firebaseAPI.getUserNameById(hit.uid); }catch(_){} }
      look.set(raw, hit || (err ? 'err' : null));
      doneN++; info.textContent = '📎 ' + f.name + ' · ' + data.length + '행 · 확인 중… ' + doneN + '/' + uniq.length;
    };
    for(let i = 0; i < uniq.length; i += 5) await Promise.all(uniq.slice(i, i + 5).map(one));
    S.rows = data.map(d => {
      const raw = d.code, k = raw.toUpperCase().replace(/\s+/g, '');
      const r = { line: d.line, cells: d.cells, raw, memo: d.memo, code: '', uid: null, name: '', base: 'key' };
      if(k){
        const h = look.get(k);
        if(h === 'err') r.base = 'neterr';
        else if(h){ r.base = 'send'; r.uid = h.uid; r.code = h.code; r.name = h.name || ''; }
        else r.base = LX_CODE_RE.test(k) ? 'nouser' : 'badcode';
      }
      /* 결과 파일을 다시 올렸을 때 — 키가 이미 나간 행은 또 만들지 않는다. 코드는 위에서 풀어 두었으니
         judge() 가 «같은 코드의 뒷 행» 을 중복으로 거를 때 이 행도 센다. */
      if(d.hasKey) r.base = 'haskey';
      return r;
    });
    judge();
    info.textContent = '📎 ' + f.name + ' · ' + S.rows.length + '행' + (cut ? ' (앞 ' + LX_MAX_ROWS + '행만)' : '') + (S.issued ? '' : ' · ⚠ 발급 목록을 못 읽어 «발급한 적 있음» 판정 없음');
    renderPreview();
  }
  async function run(){
    const todo = S.rows.filter(actionable);
    if(!todo.length || S.running) return;
    if(!(window.firebaseAPI && firebaseAPI.createLicense && firebaseAPI.sendInboxMessage)){ toast('네트워크 연결이 필요해요'); return; }
    const nSend = todo.filter(r => r.st === 'send').length;
    if(!confirm(todo.length + '건을 발급할까요?\n· 수령함으로 보냄 ' + nSend + '건\n· 키만 만듦 ' + (todo.length - nSend) + '건')){ window.focus(); return; }
    window.focus();
    S.running = true;
    show(opts, false); show(acts, false); show(prog, true);
    let i = 0;
    for(const r of todo){
      i++;
      progText.innerHTML = '발급 중… <b>' + i + ' / ' + todo.length + '</b>';
      progBar.style.width = Math.round((i - 1) / todo.length * 100) + '%';
      const key = _genLicenseKey();
      const tail = r.memo ? ' · ' + r.memo : '';
      const note = (r.st === 'send'
        ? (r.name ? r.name + ' · ' : '') + '친구코드 ' + r.code + tail
        : '엑셀 일괄' + tail).slice(0, LX_NOTE_MAX);
      try{
        await firebaseAPI.createLicense(key, note);
        r.key = key;
      }catch(e){ r.res = 'fail'; r.why = _saveFailMsg(e, '키 생성 실패'); continue; }
      if(r.st !== 'send'){ r.res = 'okkey'; continue; }
      try{
        const title = '🎫 라이선스가 도착했어요';
        const body = '아래 키를 [라이선스 등록] 창에 입력하면 프리미엄 기능을 쓸 수 있어요.\n\n' + key + '\n\n(설정 → 라이선스 등록)';
        const res = await firebaseAPI.sendInboxMessage(r.uid, 'reward', title, body);
        if(res && res.ok === false){ r.res = 'sendfail'; r.why = '키는 만들어짐 — 직접 전달해 주세요'; }
        else r.res = 'ok';
      }catch(_){ r.res = 'sendfail'; r.why = '키는 만들어짐 — 직접 전달해 주세요'; }
    }
    progBar.style.width = '100%';
    S.running = false; S.finished = true;
    show(prog, false);
    const c = k => S.rows.filter(r => r.res === k).length;
    const skip = S.rows.filter(r => !actionable(r)).length;
    doneSum.innerHTML = chip('ok', ' ' + c('ok')).replace('✓ 보냄', '수령함 발송') + chip('okkey', ' ' + c('okkey')).replace('🔑 키 생성', '키만 발급')
      + (c('sendfail') ? chip('sendfail', ' ' + c('sendfail')) : '') + chip('fail', ' ' + c('fail')).replace('✗ 발급 실패', '실패')
      + (skip ? chip('issued', ' ' + skip).replace('⚠ 발급한 적 있음', '건너뜀') : '');
    const hand = S.rows.filter(r => r.key && r.res !== 'ok');
    keyOnly.innerHTML = hand.map(r => '<div>' + Number(r.line) + '행 · ' + esc(r.memo || r.raw || '—') + ' · <span style="font-family:\'Courier New\',monospace;font-weight:bold;user-select:all;">' + esc(r.key) + '</span></div>').join('')
      + (hand.length ? '<div style="color:var(--ink-soft);">↑ 이 키들은 직접 전달해야 해요 (결과 엑셀에도 들어 있어요)</div>' : '');
    show(keyOnly, hand.length > 0);
    show(done, true);
    renderPreview();
    show(acts, false); show(opts, false); show(sumEl, false);   // 위 요약은 «발급 전» 숫자라 끝나면 내린다(아래 완료 요약이 대신한다)
    try{ renderLicenseGenList(); }catch(_){}
    toast('일괄 발급 완료 — 수령함 ' + c('ok') + ' · 키만 ' + c('okkey') + (c('fail') + c('sendfail') ? ' · 확인 필요 ' + (c('fail') + c('sendfail')) : ''));
  }
  async function saveResult(){
    if(!S.rows.length) return;
    const width = Math.max(1, ...S.grid.map(r => r.length));
    const head = (S.map.header ? S.map.header.slice() : Array.from({ length: width }, (_, i) => i === S.map.codeCol ? '친구코드' : (i === S.map.memoCol ? '메모' : '')));
    while(head.length < width) head.push('');
    const LABEL = { send:'발급 안 함', key:'발급 안 함', haskey:'건너뜀', nouser:'건너뜀', dup:'건너뜀', issued:'건너뜀', badcode:'건너뜀', neterr:'건너뜀',
                    ok:'수령함 발송', okkey:'키만 발급', sendfail:'수령함 실패', fail:'실패' };
    const WHY = { haskey:'이미 발급 키가 있는 행', nouser:'친구코드를 가진 유저가 없음', badcode:'친구코드 형식이 아님', neterr:'조회 실패(네트워크)', issued:'전에 발급한 적 있음' };
    /* 결과 파일을 다시 올린 것이면 그 세 열을 **채운다**(덧붙이면 열이 두 벌이 된다). 그 행의 옛 키는 지우지 않는다. */
    const hn = head.map(x => String(x || '').replace(/\s+/g, ''));
    let ki = hn.indexOf('발급키'), ri = hn.indexOf('결과'), wi = hn.indexOf('사유');
    if(ki < 0 || ri < 0 || wi < 0){ ki = head.length; ri = ki + 1; wi = ki + 2; head.push('발급 키', '결과', '사유'); }
    const out = [head];
    S.rows.forEach(r => {
      const cells = r.cells.slice(); while(cells.length < head.length) cells.push('');
      const st = r.res || r.st;
      const why = r.why || (r.st === 'dup' ? (r.dupOf + '행과 같은 친구코드') : (WHY[st] || '')) || (r.name ? '받는 사람: ' + r.name : '');
      if(r.key) cells[ki] = r.key;
      /* 이미 키가 있던 행(다시 올린 결과 파일)은 그때의 결과·사유를 그대로 둔다 — 덮으면 «수령함 발송» 기록이 사라진다. */
      if(!(st === 'haskey' && (cells[ri] || cells[wi]))){ cells[ri] = LABEL[st] || st; cells[wi] = why; }
      out.push(cells);
    });
    try{
      const bin = await _lxWriteXlsx(out, '발급 결과');
      const base = (S.fileName || '라이선스').replace(/\.(xlsx|csv)$/i, '');
      downloadBlob(bin, base + '_발급결과.xlsx');
    }catch(e){ toast('결과 파일을 만들지 못했어요'); }
  }
  async function saveTemplate(){
    try{ downloadBlob(await _lxWriteXlsx([['친구코드', '메모']], '라이선스 발급'), '라이선스_일괄발급_양식.xlsx'); }
    catch(_){ toast('양식 파일을 만들지 못했어요'); }
  }
  /* 두 창은 오버레이 안에서 옆으로 나란히 선다(flex-wrap). 런처 창처럼 좁은 OS 창에서는 일괄 창이 아래 줄로
     밀려나 잘렸다 → 옆에 설 자리가 없으면 발급 창을 숨기고 일괄 창만 보인다(✕ 로 닫으면 발급 창이 돌아온다). */
  const mainBox = win.parentElement && win.parentElement.firstElementChild;
  const setSolo = (on) => { if(mainBox && mainBox !== win) mainBox.style.display = on ? 'none' : ''; };
  function hideWin(){ win.style.display = 'none'; setSolo(false); }
  function closeWin(){
    if(S.running){ toast('발급 중이에요 — 끝날 때까지 기다려 주세요'); return; }
    hideWin();
  }
  openBtn.addEventListener('click', ()=>{
    if(!(window.firebaseAPI && firebaseAPI.lookupFriendCode && firebaseAPI.listLicenses)){ toast('네트워크 연결이 필요해요'); return; }
    const ov = win.parentElement, GAP = 12, WIN_W = 440;
    const fits = !ov || !mainBox || ov.clientWidth >= mainBox.offsetWidth + GAP + WIN_W + 16;
    setSolo(!fits);
    win.style.display = 'block';
  });
  $('licenseXlsxClose').addEventListener('click', closeWin);
  $('licenseXlsxCancelBtn').addEventListener('click', ()=>{ if(S.running) return; S = { rows: [], map: null, fileName: '', running: false, finished: false }; resetView(); info.textContent = '📎 .xlsx 또는 .csv 파일을 골라 주세요'; });
  $('licenseXlsxFileBtn').addEventListener('click', ()=>{ if(S.running) return; fileInp.value = ''; fileInp.click(); });
  fileInp.addEventListener('change', ()=>{ const f = fileInp.files && fileInp.files[0]; if(f) loadFile(f); });
  dupFirst.addEventListener('change', ()=>{ if(S.rows.length && !S.finished){ judge(); renderPreview(); } });
  reissue.addEventListener('change', ()=>{ if(S.rows.length && !S.finished){ judge(); renderPreview(); } });
  runBtn.addEventListener('click', run);
  $('licenseXlsxSaveBtn').addEventListener('click', saveResult);
  $('licenseXlsxTplBtn').addEventListener('click', saveTemplate);
  /* 발급 창을 닫으면 이 창도 숨긴다(발급 중이면 진행은 계속되고, 다시 열면 결과가 남아 있다). */
  const gc = $('licenseGenClose');
  if(gc) gc.addEventListener('click', hideWin);
  window._lxHideWin = hideWin;
})();

/* ═══ 🔒 시크릿룸 발급(관리자) ═══ */
/* 🔒 시크릿룸 발급 (관리자) — 후원자 친구코드(또는 유저 코드) · 원하는 코드 · 기간.
   서버가 한다(POST /v1/admin/secret-rooms 한 번): 친구코드 → 사람 찾기 · 코드 뽑기 · 한 사람 한 방 · 같은 코드는 남은 기간에 이어 붙이기 ·
   끝나는 날 셈 · 옛 코드 끝내기 · 우편(SECRET_ROOM_ISSUED) · 관리자 확인(로그인 토큰). 옛 «발급 열쇠» 칸과 앱의 날짜 셈은 없다.
   앱은 «남이 가진 코드» 일 때 한 번 경고하고 같은 단추를 다시 누르면 confirmTakeover:true 로 다시 보낸다.
   같은 단추를 답 못 받고 다시 누르면 같은 requestId(TwRequestId) — 서버가 한 번만 처리한다. */
(function bindSecretRoomGrant(){
  const btn = document.getElementById('srGrantBtn');
  const codeInp = document.getElementById('srGrantCode');
  const wantInp = document.getElementById('srGrantWant');   // 원하는 코드(선택) — 비우면 서버가 뽑는다
  const monInp = document.getElementById('srGrantMonths'); // 이용 기간(개월, 선택) — 비우면 영구
  const msgEl = document.getElementById('srGrantMsg');
  if(!btn || !codeInp) return;
  const SR_PATH = '/v1/admin/secret-rooms';
  const SR_TAKEN = 'LICENSE_SECRET_ROOM_CODE_TAKEN';
  const showMsg=(text,isErr)=>{
    if(!msgEl) return;
    msgEl.textContent=text;
    msgEl.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    msgEl.style.display = text ? 'block' : 'none';
  };
  let _ids = null;   // 같은 일 다시 보내기는 같은 번호(request-id.js createPending)
  const idPool = ()=> _ids || (_ids = window.TwRequestId.createPending());
  /* 한 번 경고한 조건 — 같은 조건(사람 · 코드 · 개월)으로 다시 누르면 넘긴다. 조건을 고치면 표식이 달라져 다시 경고한다. */
  let _armed = '';
  let busy = false;
  const dayOf = (iso)=>{ const ms = Date.parse(iso || ''); return isFinite(ms) ? _srFmtDate(ms) : ''; };
  /* 남이 가진 코드 경고 — 서버가 실은 지금 주인 · 끝나는 날(items[0])을 그대로 보인다 */
  const takenText = (code, h)=>{
    const who = (h && h.ownerUserCode) ? h.ownerUserCode : '다른 사람';
    const ended = h && h.endedAt ? dayOf(h.endedAt) : '';
    const exp = h && h.expiresAt ? dayOf(h.expiresAt) : '';
    const term = ended ? ('이미 끝난 방 · ' + ended + ' 에 끝남') : (exp ? ('현재 기간 ' + exp + ' 까지') : '현재 영구');
    return code + ' 는 이미 ' + who + ' 가 쓰는 코드예요 (' + term + '). 같은 버튼을 다시 누르면 '
      + (ended ? '그 코드를 가져옵니다.' : '그 사람의 방은 끝나고 이 코드가 넘어옵니다.');
  };
  const submit = async ()=>{
    if(busy) return;
    if(!window.TwApi || !window.TwApi.authed || !window.TwRequestId){ showMsg('네트워크 연결이 필요해요', true); return; }
    const raw=(codeInp.value||'').trim();
    if(!raw){ showMsg('친구코드 또는 유저 코드를 입력해 주세요', true); return; }
    /* 📅 이용 기간 — 빈칸이면 영구. 숫자면 1~120개월. 숫자가 아니면 조용히 영구로 삼지 않고 막는다 —
       "3개월"이라고 적었는데 영구로 나가버리면 이미 코드를 알려준 뒤다. */
    const monRaw = ((monInp && monInp.value) || '').trim();
    let months = 0;
    if(monRaw){
      if(!/^\d{1,3}$/.test(monRaw)){ showMsg('이용 기간은 숫자(개월)만 넣어 주세요 — 영구로 발급하려면 비워 두세요', true); return; }
      months = parseInt(monRaw, 10);
      if(months < 1 || months > 120){ showMsg('이용 기간은 1~120개월 사이로 넣어 주세요', true); return; }
    }
    const want = ((wantInp && wantInp.value) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if(want && want.length !== 4){ showMsg('원하는 코드는 영문·숫자 4자리여야 해요', true); return; }
    /* 사람 가리키기 — 유저 코드(u…)면 그대로 · 친구코드면 서버가 찾는다(뒷 4자리만 넣으면 MATE · COZY 순으로 물어본다) */
    const isUid = /^u[0-9a-z]{12,}$/.test(raw);
    const target = isUid ? raw : raw.toUpperCase();
    const owners = isUid ? [{ ownerUserCode: target }]
      : (/^[A-Z0-9]{4}$/.test(target) ? [{ friendCode: 'MATE-' + target }, { friendCode: 'COZY-' + target }] : [{ friendCode: target }]);
    const armKey = target + '|' + want + '|' + months;
    const confirm = _armed === armKey;
    busy = true; btn.disabled = true; showMsg('발급 중…', false);
    try{
      for(let i = 0; i < owners.length; i++){
        const body = Object.assign({ name: '', months: months || null, confirmTakeover: confirm }, owners[i]);
        if(want) body.code = 'SCRT-' + want;
        const key = 'sr:' + armKey + '|' + (owners[i].ownerUserCode || owners[i].friendCode) + '|' + confirm;
        body.requestId = idPool().idFor(key);
        let r;
        try{
          r = await window.TwApi.authed.post(SR_PATH, body);
        }catch(e){
          const answered = !!e && e.kind === 'request';   // 서버가 답했다(거절) — 못 닿은 것이 아니다. 못 닿았으면 번호를 두고 다시 누르면 같은 번호
          if(answered) idPool().settle(key);
          const c = e && e.code;
          if(c === 'USER_NOT_FOUND'){
            if(i < owners.length - 1) continue;
            showMsg(isUid ? '해당 유저 코드를 가진 유저를 찾을 수 없어요' : '해당 친구코드를 가진 유저를 찾을 수 없어요', true); return;
          }
          if(c === SR_TAKEN){
            _armed = armKey;
            const h = e.items && e.items[0];
            showMsg('⚠️ ' + takenText(body.code || '그', h), true); return;
          }
          if(e && e.kind === 'auth'){ showMsg('관리자 로그인이 필요해요 — 로그인을 확인해 주세요', true); return; }
          if(c === 'INVALID_REQUEST'){ showMsg('입력을 확인해 주세요' + (e.message ? ' — ' + e.message : ''), true); return; }
          if(window.TwErrorCodes) window.TwErrorCodes.notify('E-LIC-07', e);
          showMsg('발급하지 못했어요 — 잠시 뒤 같은 버튼을 다시 눌러 주세요', true); return;
        }
        idPool().settle(key);
        _armed = '';
        const sr = (r && r.code) || body.code || '';
        const exp = r && r.expiresAt ? dayOf(r.expiresAt) : '';
        const periodTxt = exp ? ((months ? months + '개월 · ' : '') + exp + ' 까지') : '영구';
        showMsg('발급했어요 — ' + sr + ' · ' + periodTxt + ' (수령함으로 보냈어요)  받는 계정 ' + ((r && r.ownerUserCode) || ''), false);
        codeInp.value=''; if(wantInp) wantInp.value='';
        // 개월수 칸은 일부러 비우지 않는다 — 같은 기간으로 여러 명에게 연달아 발급하는 경우가 대부분이다. 메시지와 토스트에 항상 기간을 박는다.
        toast('🔒 시크릿룸 ' + sr + ' 발급 (' + periodTxt + ')');
        return;
      }
    }finally{
      busy = false; btn.disabled = false;
    }
  };
  btn.addEventListener('click', submit);
  codeInp.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
})();

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminLicenseBulk };
if(typeof window !== 'undefined') window.TwAdminLicenseBulk = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
