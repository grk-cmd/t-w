#!/usr/bin/env node
/* ═══ 🍎 sim-mac-adhoc-sign.js — 맥 앱은 dmg 전에 ad-hoc 으로 다시 서명한다 ═══
   [무엇을 지키나] 인증서 없는 맥 빌드는 서명이 내용과 어긋난 채 나가 애플 실리콘에서 «손상됨» 으로 막힌다.
     electron-builder afterPack(`scripts/mac-adhoc-sign.js`)이 번들을 `codesign --force --deep --sign -` 로 다시
     서명하고 `--verify --deep --strict` 로 확인한다. 이 검사는 그 연결(package.json)과 hook 동작을 가짜 codesign 으로 돌려 본다.
     dmg 안 앱의 실제 서명은 release.yml 의 맥 검사가 본다(맥 러너에서만 된다).
   실행: node checks/run.js sim-mac-adhoc-sign
   종료 코드: 0=통과 · 1=실패 · 2=원본 없음 */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

function find(rel){
  for (const d of [process.cwd(), __dirname]){
    const p = path.join(d, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const HOOK_PATH = find('scripts/mac-adhoc-sign.js');
const PKG_PATH = find('package.json');
if (!HOOK_PATH || !PKG_PATH){ console.log('원본 없음 — scripts/mac-adhoc-sign.js · package.json'); process.exit(2); }
const SRC = fs.readFileSync(HOOK_PATH, 'utf8');
const PKG = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail++; };

function loadFrom(src){
  const m = new Module(HOOK_PATH, null);
  m.filename = HOOK_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(HOOK_PATH));
  m._compile(src, HOOK_PATH);
  return m.exports;
}

const PRODUCT = PKG.build && PKG.build.productName;
const ctx = (platform) => ({ electronPlatformName: platform, appOutDir: '/out/mac-arm64', packager: { appInfo: { productFilename: PRODUCT } } });

/** hook 한 벌이 지켜야 할 것을 돌려 본다 — 어긋난 것들의 목록(빈 목록이면 통과) */
async function judge(hook){
  const bad = [];
  const calls = [];
  const app = hook.signApp(ctx('darwin'), (cmd, args) => calls.push([cmd, ...args]));
  const want = path.join('/out/mac-arm64', `${PRODUCT}.app`);
  if (app !== want) bad.push(`앱 경로 ${app} ≠ ${want}`);
  const sign = calls.findIndex(c => c[0] === 'codesign' && c.includes('--sign') && c[c.indexOf('--sign') + 1] === '-' && c.includes('--force') && c.includes('--deep') && c[c.length - 1] === want);
  const verify = calls.findIndex(c => c[0] === 'codesign' && c.includes('--verify') && c.includes('--deep') && c.includes('--strict') && c[c.length - 1] === want);
  if (sign < 0) bad.push('ad-hoc 다시 서명(codesign --force --deep --sign - <앱>)이 없다');
  if (verify < 0) bad.push('서명 확인(codesign --verify --deep --strict <앱>)이 없다');
  if (sign >= 0 && verify >= 0 && verify < sign) bad.push('확인이 서명보다 먼저다');
  if (calls.some(c => c.includes('--options') || c.some(a => /runtime/.test(a)))) bad.push('ad-hoc 에 hardened runtime 을 걸었다(entitlements 없이는 켜자마자 죽을 수 있다)');

  for (const p of ['win32', 'linux']){
    const other = [];
    const r = hook.signApp(ctx(p), (cmd, args) => other.push([cmd, ...args]));
    if (other.length || r !== null) bad.push(`${p} 에서도 codesign 을 부른다`);
  }

  /* codesign 이 실패하면 빌드가 멈춰야 한다 — 삼키면 어긋난 앱이 그대로 dmg 로 간다 */
  let threw = false;
  try { hook.signApp(ctx('darwin'), () => { throw new Error('codesign 실패'); }); } catch (_){ threw = true; }
  if (!threw) bad.push('codesign 실패를 삼킨다');
  return bad;
}

(async () => {
  console.log('\n[a] package.json 이 hook 을 건다');
  ok(PKG.build && PKG.build.afterPack === 'scripts/mac-adhoc-sign.js', `build.afterPack = ${PKG.build && PKG.build.afterPack}`);
  ok(!(PKG.build && PKG.build.afterSign), 'afterSign 이 아니다 — 서명을 건너뛴 빌드에선 afterSign 이 안 돈다');
  ok(typeof PRODUCT === 'string' && PRODUCT.length > 0, `productName = ${PRODUCT}`);
  const hook = loadFrom(SRC);
  ok(typeof hook === 'function', 'module.exports 가 함수(electron-builder 가 부른다)');
  ok(typeof hook.signApp === 'function', 'signApp 을 내놓는다');

  console.log('\n[b] hook 을 가짜 codesign 으로 돌린다');
  const bad = await judge(hook);
  ok(bad.length === 0, bad.length ? bad.join(' · ') : '맥만 · 서명 → 확인 · 실패는 던짐 · runtime 없음');

  console.log('\n[c] mutation test — 일부러 고장 낸 hook 은 빨강이어야 한다');
  const MUT = [
    ['확인 빠짐', s => s.replace("  run('codesign', [...VERIFY_ARGS, app]);\n", '')],
    ['맥 판정 빠짐', s => s.replace("if (ctx.electronPlatformName !== 'darwin') return null;", '')],
    ['ad-hoc 아님', s => s.replace("'--sign', '-'", "'--sign', 'Developer ID'")],
    ['--deep 빠짐', s => s.replace("const SIGN_ARGS = ['--force', '--deep',", "const SIGN_ARGS = ['--force',")],
    ['실패 삼킴', s => s.replace("  run('codesign', [...SIGN_ARGS, app]);", "  try { run('codesign', [...SIGN_ARGS, app]); } catch (_){ return app; }")],
    ['runtime 걸기', s => s.replace("'--sign', '-'", "'--options', 'runtime', '--sign', '-'")],
    ['순서 바뀜', s => s.replace("  run('codesign', [...SIGN_ARGS, app]);\n  run('codesign', [...VERIFY_ARGS, app]);", "  run('codesign', [...VERIFY_ARGS, app]);\n  run('codesign', [...SIGN_ARGS, app]);")],
  ];
  for (const [name, f] of MUT){
    const src = f(SRC);
    if (src === SRC){ ok(false, `${name} — 원본에서 바꿀 자리를 못 찾았다(검사를 원본에 맞출 것)`); continue; }
    const b = await judge(loadFrom(src));
    ok(b.length > 0, `${name} → 빨강(${b[0] || '못 잡음'})`);
  }

  console.log(fail ? `\n✗ ${fail}개 실패` : '\n✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})();
