/* home-mask.js — 🙈 기록 줄에서 사용자 폴더(사용자 이름) 가리기 · error-log.js · update-diag.js 가 쓴다
   [왜] 진단 · 오류 기록은 제보 때 파일째 받는다. 경로에는 사용자 이름이 들어 있는데, 모양이 여러 벌이다 —
     main 쪽 `C:\Users\홍길동\…`, 화면 쪽 스택 `file:///C:/Users/%ED%99%8D…/…`(빗금 반대 · 한글은 퍼센트), 대소문자가 다른 것,
     맥 `/Users/이름/…` · 리눅스 `/home/이름/…`. 홈 글자 하나로만 바꾸면 화면 쪽 오류마다 이름이 남았다.
   ・maskHome(s, home): 홈 글자의 세 모양(원래 · 빗금 / · encodeURI)을 대소문자 무시하고 ~ 로, 그 뒤 «Users|home 아래 한 칸» 모양을 한 번 더 ~ 로.
   검사: checks/sim-error-log.js · checks/sim-update-diag.js */
'use strict';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 드라이브 · 빗금 · 퍼센트 글자 어느 모양이든 «Users 나 home 바로 아래 폴더 하나» */
const USER_DIR_RE = /(?:[A-Za-z]:)?[\\/]+(?:Users|home)[\\/]+[^\\/\s'"`<>|:*?)]+/gi;

function forms(home){
  if(!home) return [];
  const fwd = home.replace(/\\/g, '/');
  let enc = ''; try{ enc = encodeURI(fwd); }catch(_){}
  return [...new Set([home, fwd, enc].filter(Boolean))].sort((a, b) => b.length - a.length);
}
function maskHome(s, home){
  let out = String(s == null ? '' : s);
  for(const f of forms(home)) out = out.replace(new RegExp(esc(f), 'gi'), '~');
  return out.replace(USER_DIR_RE, '~');
}

module.exports = { maskHome, USER_DIR_RE };
