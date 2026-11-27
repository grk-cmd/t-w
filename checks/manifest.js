/* CHECKS.md §3 표 읽기 — run.js 가 정본 대조에 쓴다(검사 checks/sim-checks-manifest.js).
   같은 이름이 두 번 나오면 뒤 줄이 앞 줄을 조용히 덮어 옛 줄이 남아도 아무도 모르게 된다 — 겹친 이름은 dupes 로 돌려준다. */
'use strict';

function parseManifest(text){
  const map = new Map();
  const dupes = [];
  for (const line of String(text).split('\n')){
    const cell = line.split('|').map((s) => s.trim());
    if (cell.length < 4) continue;
    const name = cell[1].replace(/\*\*/g, '').trim();
    const hash = (cell[3].match(/\b([0-9a-f]{12})\b/) || [])[1];
    if (!name || !hash || !/\.(js|py)$/.test(name)) continue;
    if (map.has(name)) dupes.push(name);
    map.set(name, hash);
  }
  return { map, dupes };
}

module.exports = { parseManifest };
