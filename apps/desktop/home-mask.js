/* home-mask.js — 🙈 기록 줄에서 사용자 폴더(사용자 이름) 가리기 · error-log.js · update-diag.js 가 쓴다
   [왜] 진단 · 오류 기록은 제보 때 파일째 받는다. 경로에는 사용자 이름이 들어 있는데, 모양이 여러 벌이다 —
     main 쪽 `C:\Users\홍길동\…`, 화면 쪽 스택 `file:///C:/Users/%ED%99%8D…/…`(빗금 반대 · 한글은 퍼센트), 대소문자가 다른 것,
     맥 `/Users/이름/…` · 리눅스 `/home/이름/…`. 홈 글자 하나로만 바꾸면 화면 쪽 오류마다 이름이 남았다.
   ・maskHome(s, home): 홈 글자의 세 모양(원래 · 빗금 / · encodeURI)을 대소문자 무시하고 ~ 로(뒤에 빗금 · 끝 · 경로 밖 글자가 올 때만 — 접두어가 같은 다른 폴더는 안 자른다),
     그 뒤 다른 사용자 폴더 모양을 ~ 로 — Windows 는 드라이브(C:) · UNC(\\서버) 가 붙은 Users 아래 한 칸(대소문자 무시),
     맥 · 리눅스는 /Users · /home 아래 한 칸(대소문자 그대로 · 앞 글자가 주소 · 경로 조각이면 안 본다).
   ⚠️ Firebase 경고의 /users/<uid>/… · 주소 안의 /home/… 은 사용자 폴더가 아니다 — 가리면 «어느 경로가 막혔나» 가 사라진다.
   검사: checks/sim-error-log.js · checks/sim-update-diag.js */
'use strict';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SEG = "[^\\\\/\\s'\"`<>|:*?)]+";   // 폴더 이름 한 칸
const DRIVE = '(?<![\\w])[A-Za-z]:';          // C: — 앞이 단어 글자면 아니다(file: 의 e:)
const UNC = '\\\\\\\\[^\\\\/\\s]+';              // \\서버
const WIN_USER_RE = new RegExp('(?:' + DRIVE + '|' + UNC + ')[\\\\/]+Users[\\\\/]+' + SEG, 'gi');
const POSIX_USER_RE = new RegExp('(?<![\\w.\\-])/(?:Users|home)/' + SEG, 'g');
const AFTER = "(?=[\\\\/]|$|[\\s'\"`)<>|:])";   // 홈 글자 바로 뒤 — 경로가 끝나거나 다음 칸으로

function forms(home){
  if(!home) return [];
  const fwd = home.replace(/\\/g, '/');
  let enc = ''; try{ enc = encodeURI(fwd); }catch(_){}
  const dbl = home.replace(/\\/g, '\\\\');   // JSON 안처럼 역빗금이 두 겹인 모양
  return [...new Set([home, fwd, enc, dbl].filter(Boolean))].sort((a, b) => b.length - a.length);
}
function maskHome(s, home){
  let out = String(s == null ? '' : s);
  for(const f of forms(home)) out = out.replace(new RegExp(esc(f) + AFTER, 'gi'), '~');
  return out.replace(WIN_USER_RE, '~').replace(POSIX_USER_RE, '~');
}

module.exports = { maskHome, WIN_USER_RE, POSIX_USER_RE };
