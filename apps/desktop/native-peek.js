/* native-peek.js — 🩺 네이티브 부품(uiohook-napi · node-window-manager)을 못 불러왔을 때 설치 폴더의 그 파일 상태 한 줄
   ・내놓는 것: peekUnpacked(name, opts) — app.asar.unpacked/node_modules/<name>/package.json 의 크기 · 앞 PEEK_BYTES 바이트(글자로)
     · 못 읽으면 그 까닭(code). opts.fs · opts.resourcesPath 는 검사용.
   ⚠️ «Invalid package config» 는 파일이 있는데 JSON 이 아니라는 뜻이다 — 앞부분을 보면 깨진 파일(0 바이트 · 잘림)인지
     보안 · 문서 암호화 프로그램이 내용을 바꾼 것인지 갈린다. 이 줄은 진단 기록(tw-mouse-diag.log)에만 간다.
   sysinput-win.js · sysinput-mac.js 가 같이 쓴다(로드 실패 기록 한 곳). 검사: checks/sim-native-peek.js */
'use strict';
const path = require('path');

const PEEK_BYTES = 24;

function peekUnpacked(name, opts){
  const o = opts || {};
  const fs = o.fs || require('fs');
  const base = o.resourcesPath || process.resourcesPath;
  if(!base) return '설치 폴더를 모름';
  const f = path.join(base, 'app.asar.unpacked', 'node_modules', String(name), 'package.json');
  try{
    const buf = fs.readFileSync(f);
    const head = Array.from(buf.slice(0, PEEK_BYTES)).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    return '풀린 package.json ' + buf.length + '바이트 · 앞 «' + head + '»';
  }catch(e){
    return '풀린 package.json 못 읽음(' + ((e && (e.code || e.message)) || '?') + ')';
  }
}

module.exports = { peekUnpacked, PEEK_BYTES };
