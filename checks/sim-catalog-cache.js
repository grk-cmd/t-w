/* sim-catalog-cache.js — 카탈로그 쓰기쪽 버전 올림(catalogMeta) · 규칙 (옛 앱 호환)
   [무엇을 보는가] 이 앱의 카탈로그 읽기는 서버 한 벌 GET /v2/catalog 다(character/catalog-api.js — sim-catalog-api.js 가 본다).
     catalogMeta 구독 · IndexedDB 24시간 캐시 · Firebase 로 물러나기(옛 catalog-cache.js)는 걷었다. 남은 것은 쓰기쪽이다 —
     관리자 카탈로그 쓰기도 서버로 옮겼다(D11-4) — Firebase 카탈로그 노드 · catalogMeta 에는 이 앱이 더 쓰지 않는다. 옛 앱(0.12)은 웹 관리자가 쓰는 catalogMeta 를 읽는다.
       · firebase-init.js 에 카탈로그를 쓰는 함수가 없는가
       · 규칙 catalogMeta 가 옛 앱이 읽을 만큼 열려 있고 관리자만 쓰는가(웹 관리자가 쓴다)
     웹 관리자 쪽 버전 올림은 web-admin/tests/entities/catalog-version.test.ts 가 본다.
   ・1절: firebase-init.js — 읽기는 서버 한 벌 · 카탈로그 쓰기 함수가 없다(쓰기는 admin/catalog-admin-api.js — sim-catalog-admin-api.js)
   ・2절: firebase-database-rules.json — catalogMeta 규칙
   [실행] firebase-init.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), RJ = stripReadGate(read('firebase-database-rules.json'));
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
if(!RJ){ say('  ? 원본 못 찾음 — firebase-database-rules.json'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
/* firebaseAPI 메서드 본문 — `    이름(` 부터 다음 `\n    },` 까지 */
const body = (name) => {
  const m = new RegExp('\\n    (?:async )?' + name + '\\(').exec(CODE);
  if(!m) return '';
  const i = m.index; const j = CODE.indexOf('\n    },', i);
  return CODE.slice(i, j < 0 ? undefined : j);
};

say('── 1. firebase-init.js 연결');
{
  chk(/import \{ createCatalogApi \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?catalog-api\.js";/.test(CODE) && !/catalog-cache\.js/.test(CODE), '읽기는 catalog-api.js(서버 한 벌) — 옛 catalog-cache.js 를 import 하지 않는다');
  chk(/subscribeCatalogDesks\(onChange\)\{\s*return _catalogApi\.subscribe\('desks', onChange\);/.test(CODE) && /subscribeCatalogItems\(onChange\)\{\s*return _catalogApi\.subscribe\('items', onChange\);/.test(CODE)
    && /subscribeCatalogParts\(onChange\)\{\s*return _catalogApi\.subscribe\('parts', onChange\);/.test(CODE), '책상 · 아이템 · 파츠 구독 → 서버 한 벌');
  chk(!/onValue\(\s*(?:ref\(db,\s*['`"]catalog\/(?:parts|gachaParts|items|desks)['`"]\)|r1|r2)/.test(CODE) && !/ref\(db, 'catalogMeta\/' \+ kind\)/.test(CODE),
      'catalog/{parts·gachaParts·items·desks} 를 통째로 onValue 하는 곳도 catalogMeta 를 구독하는 곳도 없다');

  /* 쓰기 — 카탈로그 쓰기는 서버 길(admin/catalog-admin-api.js)로 옮겼다. firebase-init.js 에는 카탈로그 경로에 쓰는 함수가 하나도 없다 */
  const KIND = '(?:parts|gachaParts|items|desks|customCats|catOverrides|gameConfig)';
  chk(!new RegExp('(?:set|remove|update)\\(ref\\(db,\\s*[`\'"]catalog\\/' + KIND).test(CODE) && !/_catalogUpdate|_partPath|catalogMeta\//.test(CODE), 'catalog/{종류}/… 에 쓰는 곳 · _catalogUpdate · catalogMeta 올림이 없다(서버 한 벌이 원본)');
  const gone = ['publishDesk', 'unpublishDesk', 'publishItem', 'unpublishItem', 'updateDesksOrder', 'updateItemsOrder', 'publishPart', 'unpublishPart', 'updatePartsOrder',
    'publishCustomCat', 'unpublishCustomCat', 'publishCatOverride', 'unpublishCatOverride', 'subscribeCustomCats', 'subscribeCatOverrides', 'subscribeGameConfig'];
  const left = gone.filter(n => body(n));
  chk(left.length === 0, '걷은 Firebase 카탈로그 쓰기 · 읽기 함수가 남지 않았다' + (left.length ? ' — ' + left.join(',') : ''));
  chk(/subscribeCatalogCategories\(onChange\)\{\s*return _catalogApi\.subscribe\('categories', onChange\);/.test(CODE) && /subscribeCatalogUnlocks\(onChange\)\{\s*return _catalogApi\.subscribe\('unlocks', onChange\);/.test(CODE),
      '카테고리 · 해금 레벨 구독 → 서버 한 벌(옛 customCats · catOverrides · gameConfig 를 대신한다)');
  chk(/catalogCurrent\(\)\{ return _catalogApi\.current\(\); \}/.test(CODE) && /reloadCatalog\(\)\{ return _catalogApi\.load\(\); \}/.test(CODE), '관리자 쓰기가 쓰는 두 자리 — 마지막으로 받은 한 벌(version) · 다시 받기');
}

say('── 2. 규칙 — catalogMeta');
{
  const rules = JSON.parse(RJ).rules;
  const m = rules.catalogMeta || {};
  const k = m['$kind'] || {};
  chk(m['.read'] === true, '읽기는 누구나 (버전 숫자 넷뿐)');
  chk(!!k['.write'] && k['.write'] === ((rules.catalog || {}).parts || {})['$partId']['.write'], '쓰기는 catalog/parts 쓰기와 같은 조건 (관리자)');
  chk(/admins/.test(String(k['.write'])), '  ↳ 관리자 조건이다');
  const v = String(k['.validate'] || '');
  chk(/newData\.isNumber\(\)/.test(v) && /newData\.val\(\) > 0/.test(v), '값은 양수 숫자 (서버 시각) — 앱의 isCatalogVer 와 같은 모양');
  chk(/\$kind\.matches\(\/\^\(parts\|gachaParts\|items\|desks\)\$\/\)/.test(v), '종류 이름은 넷만');
  chk(/<= now \+ \d+/.test(v), '미래 시각은 거부 (콘솔에서 잘못 넣은 큰 값이 캐시를 영영 맞게 만들지 않게)');
}

say('\n' + (fail ? `✗ 실패 ${fail}건` : `전부 통과 ✅ (${pass}건)`));
process.exit(fail ? 1 : 0);
