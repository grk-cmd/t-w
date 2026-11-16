/* sim-catalog-cache.js — 카탈로그 쓰기쪽 버전 올림(catalogMeta) · 규칙 (옛 앱 호환)
   [무엇을 보는가] 이 앱의 카탈로그 읽기는 서버 한 벌 GET /v2/catalog 다(character/catalog-api.js — sim-catalog-api.js 가 본다).
     catalogMeta 구독 · IndexedDB 24시간 캐시 · Firebase 로 물러나기(옛 catalog-cache.js)는 걷었다. 남은 것은 쓰기쪽이다 —
     옛 앱(0.12)이 catalogMeta/{종류} 버전을 읽는 동안, 이 앱의 관리자 쓰기가 버전을 같이 올리는지(빠지면 옛 앱 사용자가 옛 카탈로그를 본다)와 규칙을 본다.
       · 카탈로그를 쓰는 함수가 하나도 빠짐없이 _catalogUpdate(버전 같이 올림)를 지나는가
       · 규칙 catalogMeta 가 옛 앱이 읽을 만큼 열려 있고 관리자만 쓰는가
     웹 관리자 쪽 버전 올림은 web-admin/tests/entities/catalog-version.test.ts 가 본다.
   ・1절: firebase-init.js — 읽기는 서버 한 벌 · 쓰기가 전부 _catalogUpdate 를 지나는가
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

  /* 쓰기 — 네 종류 경로에 set/remove/직접 update 가 남아 있으면 그 쓰기는 버전을 안 올린다 */
  const KIND = '(?:parts|gachaParts|items|desks)';
  chk(!new RegExp('(?:set|remove)\\(ref\\(db,\\s*[`\'"]catalog\\/' + KIND + '\\/').test(CODE), 'catalog/{종류}/… 에 set·remove 를 직접 부르는 곳이 없다');
  chk(!/(?:set|remove)\(ref\(db,\s*`\$\{(?:node|other)\}/.test(CODE), '  ↳ _partPath 로 만든 경로에도 set·remove 를 직접 부르지 않는다');
  const writers = ['publishDesk', 'unpublishDesk', 'publishItem', 'unpublishItem', 'updateDesksOrder', 'updateItemsOrder',
                   'publishPart', 'unpublishPart', 'updatePartsOrder', 'cleanupCatalogBase64', 'migrateGachaCatalog'];
  for(const w of writers){
    const b = body(w);
    chk(!!b && /_catalogUpdate\(/.test(b) && !/await update\(ref\(db\)/.test(b), w + ' — _catalogUpdate 로 쓴다 (버전 같이 올림)');
  }
  chk(/_catalogUpdate\(\{\s*\[`\$\{node\}\/\$\{id\}`\][\s\S]{0,120}\[`\$\{other\}\/\$\{id\}`\]: null,\s*\}, \['parts', 'gachaParts'\]\)/.test(body('publishPart')),
      '  ↳ publishPart 는 반대편 통 정리까지 한 update 로 · 두 통 버전 다');
  chk(/touched\.push\(kind\)/.test(body('cleanupCatalogBase64')) && /_catalogUpdate\(updates, touched\)/.test(body('cleanupCatalogBase64')),
      '  ↳ cleanupCatalogBase64 는 실제로 지운 종류만 버전을 올린다');
  /* 이 파일 안에서 카탈로그 경로에 쓰는 메서드가 위 목록 밖에서 새로 생기면 알린다 */
  /* 여러 줄짜리 메서드만(한 줄짜리 _partPath 는 본문이 다음 메서드까지 번진다) · if/for 같은 문장은 뺀다 */
  const all = [...CODE.matchAll(/\n    (?:async )?(\w+)\([^)]*\)\{\s*\n/g)].map(m => m[1])
    .filter(n => !/^(?:if|for|while|switch|catch|function)$/.test(n));
  const extra = all.filter(n => !writers.includes(n) && /_catalogUpdate\(|`catalog\/(?:parts|gachaParts|items|desks)\/\$\{id\}`\]?\s*[:=]/.test(body(n)));
  chk(extra.length === 0, '목록 밖에서 카탈로그를 쓰는 메서드가 없다' + (extra.length ? ' — ' + extra.join(',') + ' (목록에 넣고 버전 확인)' : ''));
  const cu = (CODE.match(/async function _catalogUpdate\(updates, kinds\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/withMeta\['catalogMeta\/' \+ k\] = serverTimestamp\(\)/.test(cu), '_catalogUpdate — 같은 update 에 catalogMeta/{종류} = 서버 시각');
  chk(/permission\|PERMISSION_DENIED/.test(cu) && /await update\(ref\(db\), updates\);/.test(cu), '  ↳ 규칙 배포 전(catalogMeta 거부)엔 카탈로그만 다시 쓴다 — 관리자 등록이 멎지 않게');
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
