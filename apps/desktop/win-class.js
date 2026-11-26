/* win-class.js — 🪟 창 클래스 이름(Windows) — explorer.exe 창이 «파일 탐색기 폴더 창» 인지 «바탕화면 · 작업표시줄» 인지 가른다
   ・내놓는 것: explorerKind(cls) → { folder, desktop }(순수) · createClassReader({ requireKoffi, log }) → { usable(), read(hwnd) }.
   [왜] 폴더 창 · 바탕화면 · 작업표시줄은 모두 explorer.exe 라 실행 파일 이름으로는 못 가른다. 창 클래스 이름은 Windows 가 정한 값이다.
   ⚠️ read 는 네이티브 동기 호출이다 — main 스레드가 아니라 일꾼(win-class-worker.js)에서만 부른다(sysinput-win.js 는 explorerKind 만 쓴다).
   ⚠️ 클래스를 못 읽으면('') 둘 다 false — 부르는 쪽은 예전 판정(셸 창)으로 돈다.
   검사: checks/sim-winlist.js */
'use strict';

const FOLDER_WINDOW_CLASSES = new Set(['CabinetWClass', 'ExploreWClass']);   // 파일 탐색기 폴더 창(Windows 10 · 11 · 옛 «탐색기» 보기)
const CLASS_NAME_CHARS = 256;      // 창 클래스 이름 상한(WNDCLASS — 256자)
const NOT_EXPLORER = Object.freeze({ folder: false, desktop: false });

/** @param {string} cls explorer.exe 창의 클래스 이름('' = 못 읽음) */
function explorerKind(cls){
  if(!cls) return NOT_EXPLORER;
  const folder = FOLDER_WINDOW_CLASSES.has(cls);
  return { folder, desktop: !folder };
}

/** @param {{ requireKoffi: () => any, log: (m: string) => void }} deps */
function createClassReader(deps){
  const requireKoffi = deps.requireKoffi;
  const log = deps.log;
  let getClass;                    // undefined = 아직 안 불러옴 · null = 못 씀
  const buf = Buffer.alloc(CLASS_NAME_CHARS * 2);

  function load(){
    if(getClass !== undefined) return getClass;
    getClass = null;
    try{
      getClass = requireKoffi().load('user32.dll').func('int __stdcall GetClassNameW(uintptr_t hWnd, void *lpClassName, int nMaxCount)');
    }catch(err){ log('창 클래스 읽기 없음(koffi · user32 로드 실패): ' + (err && err.message || err)); }
    return getClass;
  }

  function read(hwnd){
    const get = load();
    const h = Number(hwnd) || 0;
    if(!get || h <= 0) return '';
    let n = 0;
    try{ n = get(h, buf, CLASS_NAME_CHARS) | 0; }catch(_){ return ''; }
    if(n <= 0 || n > CLASS_NAME_CHARS) return '';
    return buf.toString('utf16le', 0, n * 2);
  }

  return { usable: () => !!load(), read };
}

module.exports = { explorerKind, createClassReader, FOLDER_WINDOW_CLASSES };
