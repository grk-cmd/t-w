/* ═══ 🧪 sim-run-verdict.js — 러너(run.js)의 판정을 실제로 돌려 본다 ═══════════════════════
   러너가 «끝까지 못 돈 sim» 을 초록으로 세던 구멍(요약 줄도 끝줄도 없이 종료코드 0 으로 조용히 끝남 ·
   중간 ✗ 줄은 안 봄)을 막았는지, 임시 저장소에 가짜 sim 을 두고 run.js 를 진짜로 돌려 판정을 본다.
   ・1절: 멈춤(끝나지 않는 await) · ✗ 뒤 종료코드 0 · 요약 없이 끝남 → 빨강 / 정상 둘(요약 모양 `결과 N · M` · `✓ 통과 N · 실패 M`) → 초록
   ・2절: 요약 모양 — 러너가 읽는 모양들과 본문 속 «3 · 0» 은 요약이 아님
   ・3절: 일부러 깨 보기 — 러너의 그 판정을 빼 본 사본은 위 빨강을 놓친다
   [실행] 러너 스테이징에서 run.js 도 같은 폴더에 있다(없으면 checks/run.js). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const RUN = ['run.js', 'checks/run.js'].map(f => path.resolve(f)).find(f => fs.existsSync(f));
if(!RUN){ say('  ? 원본 못 찾음 — run.js'); process.exit(2); }
const RUN_SRC = fs.readFileSync(RUN, 'utf8');

const SIMS = {
  'sim-t-stall.js': "(async()=>{ console.log('  ✓ 앞 절'); console.log('  ✗ 진짜 실패'); await new Promise(()=>{}); console.log('통과 1 · 실패 0'); })();",
  'sim-t-stall-clean.js': "(async()=>{ console.log('  ✓ 앞 절'); await new Promise(()=>{}); console.log('통과 1 · 실패 0'); })();",   // ✗ 도 없이 멈춤 — 조용한 종료 판정만이 잡는다
  'sim-t-xexit0.js': "console.log('  ✗ 중간 실패'); console.log('  ✓ 뒤 절'); console.log('결과: 1 통과 · 0 실패');",
  'sim-t-nosummary.js': "console.log('  ✓ 뭔가');",
  'sim-t-ok-short.js': "console.log('  ✓ a'); console.log('결과 5 · 0');",
  'sim-t-ok-line.js': "console.log('  ✓ a'); console.log('✓ 통과 7 · 실패 0');",
  'sim-t-ok-exit.js': "console.log('  ✓ a'); console.log('통과 2 · 실패 0'); process.exit(0);",
  'sim-t-section-stall.js': "console.log('  ✓ a'); console.log('1절: 통과 3 · 실패 0'); (async()=>{ for(const n of ['b','c','d','e','f','g']) console.log('  ✓ ' + n); await new Promise(()=>{}); })();",   // 절 요약만 찍고 멈춤 — 최종 요약이 아니다
  'sim-t-body-stall.js': "console.log('  ✓ 3 · 0'); (async()=>{ for(const n of ['b','c','d','e','f','g']) console.log('  ✓ ' + n); await new Promise(()=>{}); })();",   // 줄 전체가 ✓ 3 · 0 인 본문 뒤 멈춤
  'sim-t-ok-old.js': "console.log('  ✓ a'); console.log('sim-t-ok-old.js: 74 통과 · 0 실패');",
  'sim-t-ok-verdict.js': "console.log('  ✓ a'); console.log('판정: 초록 35 · 빨강 0 · 검사못함 0');",
  'sim-t-body-nums.js': "console.log('  ✓ 3 · 0 은 본문에 든 숫자'); console.log('  ✓ a');",   // 요약이 아님 → 조용한 종료
};
function runner(src){
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-runverdict-'));
  const dir = path.join(root, 'checks');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'run.js'), src);
  for(const [n, b] of Object.entries(SIMS)) fs.writeFileSync(path.join(dir, n), b);
  const r = spawnSync(process.execPath, [path.join(dir, 'run.js'), '--no-verify'], { cwd: root, encoding: 'utf8', timeout: 60000 });
  fs.rmSync(root, { recursive: true, force: true });
  const mark = {};
  for(const l of (r.stdout || '').split('\n')){ const m = l.match(/^\s+([✓✗])\s+(sim-t-\S+)/); if(m) mark[m[2]] = m[1]; }
  return { mark, code: r.status };
}

say('── 1. 판정');
const real = runner(RUN_SRC);
const GREEN = ['sim-t-ok-old.js', 'sim-t-ok-verdict.js', 'sim-t-ok-short.js', 'sim-t-ok-line.js', 'sim-t-ok-exit.js'];
chk(real.mark['sim-t-stall.js'] === '✗', '끝나지 않는 await 에 걸려 종료코드 0 으로 조용히 끝난 sim → 빨강');
chk(real.mark['sim-t-stall-clean.js'] === '✗', '✗ 줄도 없이 멈춘 sim → 빨강(조용한 종료 판정)');
chk(real.mark['sim-t-xexit0.js'] === '✗', '✗ 줄이 찍혔는데 종료코드 0 · 요약 «실패 0» → 빨강');
chk(real.mark['sim-t-nosummary.js'] === '✗', '요약 줄 없이 조용히 끝난 sim → 빨강');
chk(GREEN.every(n => real.mark[n] === '✓'), '정상 sim(요약 모양 `결과 5 · 0` · `✓ 통과 7 · 실패 0` · process.exit(0)) → 초록');
chk(real.code === 1, '빨강이 있으면 러너 종료코드 1');
say('── 2. 요약 모양');
chk(real.mark['sim-t-section-stall.js'] === '✗', '절 요약(`1절: 통과 3 · 실패 0`)만 찍고 멈춘 sim → 빨강(앞쪽 요약은 최종이 아니다)');
chk(real.mark['sim-t-body-stall.js'] === '✗', '줄 전체가 `✓ 3 · 0` 인 본문 뒤 멈춘 sim → 빨강');
chk(real.mark['sim-t-body-nums.js'] === '✗', '본문 속 «3 · 0» 은 요약이 아니다(줄 전체가 그 모양일 때만)');
say('── 3. 일부러 깨 보기 — 판정을 빼면 놓친다');
const cut = (from, to) => { const s = RUN_SRC.replace(from, to); return s === RUN_SRC ? null : s; };
const noQuiet = cut("fs.existsSync(mark) && !sum && !end", "false");
const noX = cut("const xmarks = out.split('\\n').filter(l => /^\\s*✗/.test(l)).length;", "const xmarks = 0;");
chk(noQuiet && runner(noQuiet).mark['sim-t-stall-clean.js'] !== '✗' || false, '조용한 종료 판정을 빼면 멈춘 sim 이 초록으로 샌다' + (noQuiet ? '' : ' — 바꿀 글을 못 찾음'));
chk(noX && runner(noX).mark['sim-t-xexit0.js'] !== '✗' || false, '✗ 줄 판정을 빼면 «✗ 뒤 종료코드 0» 이 초록으로 샌다' + (noX ? '' : ' — 바꿀 글을 못 찾음'));
const noTail = cut(".slice(-SUMMARY_TAIL)", ".slice(0)");
chk(noTail && runner(noTail).mark['sim-t-section-stall.js'] !== '✗' || false, '끝 몇 줄만 보는 제한을 빼면 앞쪽 절 요약을 최종으로 주워 멈춘 sim 이 초록으로 샌다' + (noTail ? '' : ' — 바꿀 글을 못 찾음'));
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
