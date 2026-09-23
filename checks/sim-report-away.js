/* ═══ 🫧🚩 sim-report-away.js — 자리비움 그림 · 신고하기 · 이름표 우클릭 (2026-09-23 · 개정 60 · 시안 A 확정) ═══════════
   ・1절: 자리비움 그림 — [내 정보] 머리 아래 한 구획 · 500×500 WebP · 300KB · Storage away/ · URL 은 Storage 주소만 ·
          방 payload awayImg · 캐릭터 자리 스프라이트(자리비움 · 안 숨김 · 회사원 아님 · 불러온 뒤에만) · 그땐 책상 🫧 없음.
   ・2절: 신고하기 — 남의 좌석 메뉴 끝 «🚩 신고하기…»(채널 무관) · 사유 넷(기타 40자) · 그림 없으면 자리비움 줄 잠김 ·
          신고자 정보는 닉네임 + 코드 뒷자리 4 + 사유뿐 · 신고 성공 = 내 화면에서 숨김 · 관리자 목록은 서로 다른 3명 이상.
   ・3절: 규칙 — users/$userId/awayImg · reports(관리자만 읽기 · 본인 칸만 쓰기 · 자기 자신 금지 · $other 거절).
   ・4절: 이름표 우클릭 = 좌석 메뉴(조준 · 회사원 게이트) · 클릭 받기(CSS · UI_HIT_SEL).
   [실행] app.js · desk-companion-prototype.html · firebase-init.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const FI   = fs.existsSync('firebase-init.js') ? fs.readFileSync('firebase-init.js', 'utf8') : null;
const RULES = fs.existsSync('firebase-database-rules.json') ? JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')) : null;

let pass = 0, fail = 0, huh = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name, S0) => { const S = S0 || SRC; const i = S.indexOf('function ' + name + '('); if(i < 0) return ''; let k = S.indexOf('{', i), d = 0; for(; k < S.length; k++){ if(S[k] === '{') d++; else if(S[k] === '}' && --d === 0) return S.slice(i, k + 1); } return ''; };
const CODE = strip(SRC);
const OK_URL = 'https://firebasestorage.googleapis.com/v0/b/x/o/away%2Fu1%2Faway_1.webp?alt=media&token=t';

say('── 1. 자리비움 그림');
{
  const iHead = HTML.indexOf('id="miNameRow"'), iAway = HTML.indexOf('id="miAway"'), iTab = HTML.indexOf('id="miTabBox"');
  chk(iHead > 0 && iAway > iHead && iTab > iAway, '[내 정보] 머리 아래 · 탭 위 한 구획(시안 A)');
  chk(['miAwayImg','miAwayPh','miAwayPick','miAwayReset','miAwayMsg','miAwayFile'].every(id => HTML.indexOf('id="' + id + '"') > 0), '미리보기 · 🫧 · [그림 등록] · [기본으로] · 안내 · 파일 입력');
  chk(/var AWAY_IMG_PX = 500;/.test(CODE) && /var AWAY_IMG_MAX_BYTES = 300 \* 1024;/.test(CODE), '500×500 · 300KB');
  const prep = strip(grabFn('_awayPrepare'));
  chk(/toDataURL\('image\/webp'/.test(prep) && /AWAY_IMG_MAX_BYTES/.test(prep) && /err:'big'/.test(prep), 'WebP 로 굽고 300KB 넘으면 품질을 내려 다시 · 끝까지 넘으면 거절');
  const ok = new Function(grabFn('_awayUrlOk') + '; return _awayUrlOk;')();
  chk(ok(OK_URL) && !ok('https://evil.example/x.png') && !ok('data:image/png;base64,AA') && !ok(null) && !ok(OK_URL + 'x'.repeat(500)), 'URL 은 Storage 주소 · 500자 이하만');
  chk(/s\.remoteAwayImg=_awayUrlOk\(friends\[id\]\.awayImg\)/.test(CODE), '받는 쪽도 Storage 주소만 받는다');
  chk(/awayImg:myAwayImg, ridingOn:/.test(CODE) && /lic:_myLicenseFlag\(\), awayImg:myAwayImg\}/.test(CODE), '평소 · 입장 페이로드에 awayImg');
  /* _awayPicFor 떼어 와 돌림 */
  const env = { office: false, st: 'ok', mine: OK_URL };
  const pic = new Function('env', `
    const _awayUrlOk = ${grabFn('_awayUrlOk').replace(/^function _awayUrlOk/, 'function')};
    const _awayTexState = () => env.st;
    ${grabFn('_awayPicFor').replace(/typeof officeMode !== 'undefined' && officeMode/, 'env.office').replace(/awayImgUrl/g, 'env.mine')}
    return _awayPicFor;`)(env);
  const R = { remote: true, remoteAwayImg: OK_URL }, M = { isMe: true };
  chk(pic(R, 'away', false) === OK_URL && pic(M, 'away', false) === OK_URL, '자리비움 + 그림 + 불러옴 → 캐릭터 자리에 그림(남 · 나)');
  chk(pic(R, null, false) === null && pic(R, 'meal', false) === null, '자리비움이 아니면 없음');
  chk(pic(R, 'away', true) === null, '숨긴 좌석은 없음');
  env.office = true; chk(pic(R, 'away', false) === null, '회사원 모드는 예전 모양'); env.office = false;
  env.st = 'loading'; chk(pic(R, 'away', false) === null, '불러오는 중이면 예전 모양(🫧)'); env.st = 'fail'; chk(pic(R, 'away', false) === null, '못 불러오면 예전 모양'); env.st = 'ok';
  chk(pic({ remote: true, remoteAwayImg: 'https://evil.example/a.png' }, 'away', false) === null, 'Storage 주소가 아니면 없음');
  chk(/const _awayPic = _awayPicFor\(seat, us, _hidden\);/.test(CODE) && /!_hidden && !_awayPic\) \? _conf\.emo : null/.test(CODE), '프레임 루프: 그림이 서면 책상 🫧 는 안 띄운다');
  const fr = strip(grabFn('_awayImgFrame'));
  chk(/setFromObject\(seat\.bodyWrap \|\| seat\.rig\)/.test(fr) && /sp\.scale\.set\(h, h, 1\)/.test(fr) && /> 500/.test(fr), '캐릭터 경계상자 높이에 맞춘 정사각형 · 0.5초에 한 번 잰다');
  /* 👑 프리미엄 전용(2026-09-23 요청) — 등록만 잠근다. 보는 쪽 · [기본으로] 는 그대로. */
  chk(/function _awayPremium\(\)\{[^}]*_premiumOn\(\)/.test(CODE), '프리미엄 판정은 _premiumOn 한 곳');
  chk(/pk\.disabled = !!_awayBusy \|\| !prem/.test(CODE) && /if\(!_awayPremium\(\)\)\{ _awayRenderUI\('👑/.test(CODE), '비프리미엄은 [그림 등록] 잠김 · 올리기도 막힌다');
  chk(!/!prem/.test(strip(grabFn('_awayReset'))) && /rs\.disabled = !!_awayBusy;/.test(CODE), '[기본으로]는 라이선스와 무관(내 그림을 되돌리는 길은 막지 않는다)');
  chk(!/_awayPremium/.test(strip(grabFn('_awayPicFor'))), '보는 쪽은 라이선스를 안 본다(남의 그림은 그대로 보인다)');
  chk(/_awayRenderUI\(null\); \}catch\(_\)\{\}        \/\/ 👑/.test(SRC), '라이선스가 바뀌면 칸을 다시 그린다(_refreshPremiumGatedUI)');
  chk(/_awayBootSync\(0\)/.test(CODE) && /_awaySetLocal\(srv\)/.test(strip(grabFn('_awayBootSync'))), '부팅 때 서버 값이 기준(관리자가 내리면 로컬도 비움)');
  if(FI){
    const up = strip(grabFn('uploadAwayImg', FI.replace(/async uploadAwayImg\(/, 'function uploadAwayImg(')));
    chk(/away\/\$\{userId\}\/away_\$\{Date\.now\(\)\}\.webp/.test(up) && !/_uploadDataUrlIfNeeded/.test(up), 'Storage away/{uid}/away_{시각}.webp · dataURL 폴백 없음');
  }else{ huh++; say('  ? firebase-init.js 없음 — 통로 검사못함'); }
}

say('── 2. 신고하기');
{
  const menu = strip(grabFn('_seatCtxMenu'));
  chk(/if\(seat\.remote\)\{ sep\(\); mk\('🚩 신고하기…', \(\)=>_openReportDialog\(seat\)\); \}/.test(menu), '남의 좌석 메뉴 끝 «🚩 신고하기…»(채널 조건 밖)');
  const dlg = strip(grabFn('_openReportDialog'));
  chk(/REPORT_KINDS\.forEach/.test(dlg) && /\{ k:'char'[\s\S]*\{ k:'away'[\s\S]*\{ k:'nick'[\s\S]*\{ k:'etc'/.test(CODE), '사유 넷: 캐릭터 · 자리비움 그림 · 닉네임 · 기타');
  chk(/etc\.maxLength = 40/.test(dlg) && /r\.type = 'radio'/.test(dlg), '라디오 · 기타는 40자');
  chk(/const off = \(kd\.k === 'away' && !hasAway\)/.test(dlg) && /hasAway = _awayUrlOk\(seat\.remoteAwayImg\)/.test(dlg), '그림 없는 사람은 자리비움 줄 잠김');
  chk(/reportUser\(target, me, \{ kind:picked, note:txt, nick:[^}]*code4:_myCode4\(\) \}\)/.test(dlg), '신고자 정보 = 닉네임 + 코드 뒷자리 4 + 사유뿐');
  chk(/String\(localStorage\.getItem\(MY_FRIEND_CODE_KEY\) \|\| ''\)\.slice\(-4\)/.test(CODE), '코드 뒷자리 4자리');
  chk(/_reportHiddenUids\.add\(target\); _reportHiddenSave\(\);/.test(dlg), '신고하면 내 화면에서 숨김');
  const rows = new Function(`var REPORT_ADMIN_MIN = 3; ${grabFn('_reportAdminRows')} return _reportAdminRows;`)();
  const all = { uA:{ r1:{kind:'away',ts:1}, r2:{kind:'nick',ts:3}, r3:{kind:'etc',note:'x',ts:2} }, uB:{ r1:{kind:'char',ts:1}, r2:{kind:'char',ts:2} },
                uC:{ r1:{kind:'away',ts:1}, r2:{kind:'away',ts:1}, r3:{kind:'away',ts:1}, r4:{kind:'nick',ts:9} } };
  const out = rows(all);
  chk(out.length === 2 && out[0].target === 'uC' && out[1].target === 'uA', '서로 다른 3명 이상만 · 많은 순');
  chk(out[1].recs[0].ts === 3, '최근 신고가 위');
  chk(/_openReportAdmin\(\)/.test(CODE) && /id="lcReportList" class="admin-only"/.test(HTML), '관리자 줄 [🚩 신고 목록]');
  const adm = strip(grabFn('_openReportAdmin'));
  chk(/isAdmin/.test(adm.split('listReports')[0]), '관리자가 아니면 안 연다');
  chk(!/innerHTML/.test(dlg + adm), '이름 · 사유는 textContent 로만(innerHTML 없음)');
  chk(/ov\.className = 'app-popup-ov'/.test(strip(grabFn('_reportBox'))), '팝업은 app-popup-ov(클릭 통과 화이트리스트)');
}

say('── 3. 규칙');
if(RULES){
  const u = RULES.rules.users.$userId.awayImg, r = RULES.rules.reports;
  chk(!!u && /beginsWith\('https:\/\/firebasestorage\.googleapis\.com\/'\)/.test(u['.validate']) && /length <= 500/.test(u['.validate']), 'users/$userId/awayImg — Storage 주소 · 500자');
  chk(!!u && /admins/.test(u['.write']) && /userAuth/.test(u['.write']), 'awayImg 쓰기 = 본인(또는 미결속) · 관리자(그림 내리기)');
  chk(!!r && /admins/.test(r['.read']) && /admins/.test(r.$target['.write']), 'reports 읽기 · 비우기 = 관리자만');
  const w = r && r.$target.$reporter;
  chk(!!w && /\$reporter !== \$target/.test(w['.write']) && /userAuth\/'\+\$reporter\)\.val\(\) === auth\.uid/.test(w['.write']), '신고자 칸 = 로그인한 본인만 · 자기 자신 신고 금지');
  chk(!!w && /\^\(char\|away\|nick\|etc\)\$/.test(w['.validate']) && /note[^|]*length <= 40/.test(w['.validate']) && w.$other && w.$other['.validate'] === false, '사유 넷 · 메모 40자 · 다른 칸 거절');
}else{ huh++; say('  ? 규칙 파일 없음 — 검사못함'); }

say('── 4. 이름표 우클릭');
{
  const np = strip(grabFn('ensureSeatNamePlateEl'));
  chk(/addEventListener\('contextmenu'/.test(np) && /_seatCtxMenu\(e, seat\)/.test(np), '이름표 우클릭 = 좌석 메뉴');
  chk(/officeMode && seat\.remote\) return/.test(np) && /_flyAiming/.test(np) && /_bonkAiming/.test(np), '조준 중 · 회사원 모드(남) 게이트는 캔버스와 같게');
  chk(/\.seat-nameplate\{[^}]*pointer-events:auto/.test(HTML), '이름표가 클릭을 받는다(CSS)');
  chk(/const UI_HIT_SEL = '[^']*\.seat-nameplate'/.test(SRC), 'UI_HIT_SEL 에 .seat-nameplate(실행 화면 클릭 통과 방지)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}` + (huh ? ` · 검사못함 ${huh}` : ''));
process.exit(fail ? 1 : (huh ? 2 : 0));
