/* sim-env-diag.js — 🩺 환경 · 자원 진단(env-diag.js · main.js 배선)
   실행:  node sim-env-diag.js   (env-diag.js · main.js 가 있는 폴더에서)
   ★ 왜 — «같은 앱이 PC 마다 CPU 가 수십 배 다르다» 를 로그 두 장으로 가르려면 [자원] 줄의 % 가 작업 관리자와 같은
     기준이어야 하고, 어느 프로세스 몫인지 맞게 나뉘어야 한다. 숫자가 틀리면(첫 호출을 0% 로 속임 · pid 재사용을 이어 셈 ·
     코어 하나 기준을 PC 전체로 적음) 판단이 틀린다.
   ・1절: createResourceWatch — 첫 호출은 기준만 · 구간 CPU 초 ÷ 초 = 코어 몫 · 프로세스 나눔(메인 · GPU · 우리 창 · 다른 화면 · 기타) ·
          새로 뜬 프로세스 · 다시 쓰인 pid · 누적 값이 없으면 «일부 모름» · 메모리 KB → MB
   ・2절: resourceLine — PC 전체 기준 % (코어 몫 ÷ 논리 수) · 기준 잡는 중 · 논리 수 모름
   ・3절: envLine · gpuDetailLine — 물리 해상도 · Hz · 주 · 실행 모니터 · 빈 값은 «모름» · 줄바꿈 · 길이 상한
   ・4절: 깨 보기 — 갈래를 하나씩 지운 모듈로 1~3절을 다시 돌려 빨강이 나는지
   ・5절: 배선 — main 이 싣고 · GPU 줄 뒤 [환경] · 미뤄서 [GPU 상세] · 창을 만들 때 1분 [자원] 시작 · 끌 때 타이머 내림 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/shared/' + f, 'app/parts/shared/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('env-diag.js'), MAIN = read('main.js');
if (!MOD || !MAIN) { say('  ? 원본 못 찾음 — env-diag.js · main.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwEnvDiag; };

/* 프로세스 하나 — cum: 시작 뒤 쓴 CPU 초 · kb: 메모리(KB) */
const P = (pid, type, born, cum, kb) => ({ pid, type, creationTime: born, cpu: { cumulativeCPUUsage: cum }, memory: { workingSetSize: kb } });
const near = (a, b) => Math.abs(a - b) < 1e-9;

function runWatch(E){
  const r = [];
  const w = E.createResourceWatch();
  const first = w.take(0, [P(1, 'Browser', 1, 5, 102400), P(2, 'GPU', 1, 10, 51200), P(3, 'Tab', 1, 2, 204800)], 3);
  r.push(first === null);                                                                            // 0 첫 호출은 기준만
  const m = w.take(60000, [P(1, 'Browser', 1, 11, 102400), P(2, 'GPU', 1, 22, 51200), P(3, 'Tab', 1, 3.2, 204800),
    P(4, 'Tab', 30000, 0.6, 10240), P(5, 'Utility', -1, 0.3, 20480)], 3);
  r.push(m && m.secs === 60 && near(m.b.main.cores, 0.1) && near(m.b.gpu.cores, 0.2));               // 1 (11-5)/60 · (22-10)/60
  r.push(m && near(m.b.view.cores, 0.02) && m.b.view.n === 1);                                      // 2 우리 창(pid 3)
  r.push(m && near(m.b.tabs.cores, 0.01) && m.b.tabs.n === 1);                                      // 3 그사이 새로 뜬 다른 화면 — 처음부터 쓴 몫 0.6/60
  r.push(m && m.b.rest.n === 1 && near(m.b.rest.cores, 0));                                         // 4 지난번에 없던 오래된 프로세스는 셈 못 함(0)
  r.push(m && near(m.b.main.mb, 100) && near(m.b.view.mb, 200));                                   // 5 KB → MB
  const m2 = w.take(120000, [P(1, 'Browser', 1, 11, 0), P(2, 'GPU', 90000, 1.2, 0), P(3, 'Tab', 1, 3.2, 0)], 3);
  r.push(m2 && near(m2.b.gpu.cores, 0.02));                                                         // 6 GPU 가 다시 떴다(pid 같고 만든 시각 다름) — 이어 빼지 않는다
  const m3 = w.take(180000, [P(1, 'Browser', 1, 12, 0), { pid: 3, type: 'Tab', creationTime: 1, cpu: {}, memory: {} }], 3);
  r.push(m3 && m3.cpuKnown === false && near(m3.b.main.cores, 1 / 60));                             // 7 누적 값이 없는 프로세스 → 일부 모름 · 나머지는 셈
  const m4 = E.createResourceWatch(); m4.take(0, null, null);
  const z = m4.take(1000, [null, 5, P(9, 'Browser', 1, 1, 1024)], null);
  r.push(z && z.b.main.n === 1 && near(z.b.main.mb, 1));                                             // 8 빈 값 · 이상한 원소는 건너뜀
  const sw = E.createResourceWatch();
  const cpus = (busy, idle) => [{ times: { user: busy, nice: 0, sys: 0, irq: 0, idle } }, { times: { user: busy, nice: 0, sys: 0, irq: 0, idle } }];
  sw.take(0, [], null, { cpu: E.cpuTimes(cpus(100, 900)), freeBytes: 1, totalBytes: 2 });
  const s1 = sw.take(60000, [], null, { cpu: E.cpuTimes(cpus(400, 1600)), freeBytes: 21474836480, totalBytes: 34359738368 });
  r.push(s1 && near(s1.pcCpu, 0.3) && s1.memUsed === 12884901888 && s1.memTotal === 34359738368);   // 9 PC 전체 CPU = 바쁜 증가 ÷ 전체 증가 · 메모리 사용 = 전체 - 남음
  const s2 = sw.take(120000, [], null, null);
  r.push(s2 && s2.pcCpu === null && s2.memTotal === null);                                          // 10 PC 값을 못 읽음 → 모름
  return r;
}
const WATCH_MSG = ['첫 호출은 기준만 잡고 null(0% 로 속이지 않는다)', '구간 CPU 초 ÷ 초 = 코어 몫 — 메인 0.1 · GPU 0.2', '우리 창(창의 pid)은 «화면»',
  '그사이 새로 뜬 다른 화면은 처음부터 쓴 몫이 이 구간 몫', '지난번에 없던 오래된 프로세스는 셈 못 함(0)', '메모리 KB → MB',
  '같은 pid 가 다시 쓰이면(만든 시각이 다름) 옛 값에서 빼지 않는다', '누적 CPU 값이 없는 프로세스가 있으면 «일부 모름» · 나머지는 그대로 셈', '빈 목록 · 이상한 원소는 건너뛴다', 'PC 전체 CPU = 모든 코어 바쁜 시간 증가 ÷ 전체 시간 증가 · PC 메모리 사용 = 전체 - 남음', 'PC 값을 못 읽으면 모름'];

function runLine(E){
  const r = [];
  const res = { secs: 60, cpuKnown: true, pcCpu: 0.43, memUsed: 11166914560, memTotal: 34144260096, b: { main: { cores: 1.4, mb: 80, n: 1 }, gpu: { cores: 2.74, mb: 120.4, n: 1 }, view: { cores: 0.32, mb: 300, n: 1 }, tabs: { cores: 0, mb: 0, n: 0 }, rest: { cores: 0, mb: 30, n: 2 } } };
  const line = E.resourceLine(res, 20, '실행 화면');
  r.push(line.indexOf('[자원] 60초 · 실행 화면 · CPU 합 22.3% · 메인 7.0 · GPU 13.7 · 화면 1.6 · 다른 화면 0.0(0개) · 기타 0.0(2개)') === 0);   // 0 PC 전체 기준
  r.push(/ · 메모리 합 530MB · 메인 80 · GPU 120 · 화면 300 · 다른 화면 0 · 기타 30 · PC 전체 CPU 43\.0% · PC 메모리 10\.4\/31\.8GB$/.test(line));                                         // 1 메모리
  r.push(E.resourceLine(null, 20, '런처') === '[자원]  · 런처 · 기준 잡는 중');                                                              // 2 기준 잡는 중
  r.push(/CPU 합 모름% · 메인 모름/.test(E.resourceLine(res, 0, '숨김')));                                                                  // 3 논리 수 모름 → 모름(코어 몫을 % 로 속이지 않음)
  r.push(/CPU \(일부 모름\) 합/.test(E.resourceLine(Object.assign({}, res, { cpuKnown: false }), 20, '실행 화면')));                          // 4 일부 모름 표시
  return r;
}
const LINE_MSG = ['CPU 는 작업 관리자 기준(코어 몫 ÷ 논리 20) — 합 22.3% · GPU 13.7', '메모리 합 · 나눔(MB 반올림) · 끝에 PC 전체 CPU · PC 메모리(사용/전체)', '기준 잡는 중이면 그렇게 적는다',
  '논리 프로세서 수를 모르면 % 대신 «모름»', 'CPU 를 일부 못 셈 → «(일부 모름)»'];

function runEnv(E){
  const r = [];
  const env = E.envLine({ app: '0.12.4', electron: '44.9.3', chrome: '140.0', os: 'Windows', osVer: '10.0.22631', arch: 'x64', cpuModel: 'i5-13600K', threads: 20, ramBytes: 34144260096,
    displays: [{ w: 2560, h: 1440, scale: 1, hz: 144, primary: true }, { w: 1536, h: 864, scale: 1.25, hz: 59.94, run: true }] });
  r.push(env === '[환경] 앱 0.12.4 · Electron 44.9.3 · Chrome 140.0 · Windows 10.0.22631 x64 · CPU i5-13600K(논리 20) · RAM 31.8GB · 모니터 2대: 2560x1440 144Hz 배율1 주 / 1920x1080 60Hz 배율1.25 실행');   // 0 물리 해상도
  r.push(/CPU 모름\(논리 모름\) · RAM 모름 · 모니터 모름$/.test(E.envLine(null)));                                                              // 1 빈 값
  r.push(E.envLine({ cpuModel: 'a\nb' + 'x'.repeat(300) }).indexOf('\n') < 0 && E.envLine({ cpuModel: 'x'.repeat(300) }).indexOf('x'.repeat(E.STR_MAX + 1)) < 0);   // 2 줄바꿈 · 길이
  const g = E.gpuDetailLine({ auxAttributes: { glRenderer: 'ANGLE (NVIDIA, RTX 3070, D3D11)', optimus: false, amdSwitchable: false, displayType: 'D3D11', skiaBackendType: 'GaneshGL', overlayInfo: { directComposition: true, supportsOverlays: false } } });
  r.push(g === '[GPU 상세] 그리는 장치 ANGLE (NVIDIA, RTX 3070, D3D11) · directComposition=true · supportsOverlays=false · 겹친 그래픽=false · 화면 종류=D3D11 · 그리기 엔진=GaneshGL');   // 3 overlayInfo 안
  r.push(/directComposition=true · supportsOverlays=true · 겹친 그래픽=true/.test(E.gpuDetailLine({ auxAttributes: { directComposition: true, supportsOverlays: true, optimus: true } })));   // 4 aux 바로 아래 · 겹친 그래픽
  r.push(E.gpuDetailLine(null) === '[GPU 상세] 그리는 장치 모름 · directComposition=모름 · supportsOverlays=모름 · 겹친 그래픽=모름 · 화면 종류=모름 · 그리기 엔진=모름');   // 5 빈 값
  r.push(/directComposition=false/.test(E.gpuDetailLine({ auxAttributes: { directComposition: false } })));                               // 6 false 는 «모름» 이 아니다
  return r;
}
const ENV_MSG = ['[환경] — 해상도는 배율을 곱한 물리 값 · Hz 반올림 · 주 · 실행 모니터', '빈 값은 «모름»', '바깥 글은 한 줄 · 길이 상한',
  '[GPU 상세] — overlayInfo 안의 칸을 읽는다', 'auxAttributes 바로 아래 칸도 읽는다 · optimus → 겹친 그래픽', '정보가 없으면 칸마다 «모름»', 'false 는 false 로(모름으로 지우지 않는다)'];

const E = load(MOD);
say('── 1. createResourceWatch');
runWatch(E).forEach((ok, i) => chk(ok, WATCH_MSG[i]));
say('── 2. resourceLine');
runLine(E).forEach((ok, i) => chk(ok, LINE_MSG[i]));
say('── 3. envLine · gpuDetailLine');
runEnv(E).forEach((ok, i) => chk(ok, ENV_MSG[i]));

say('── 4. 깨 보기');
const breaks = [
  ['첫 호출도 줄을 낸다', MOD.replace('return first ? null : out;', 'return out;'), runWatch],
  ['초로 안 나눔(누적 초를 그대로)', MOD.replace('b.cores += used / out.secs;', 'b.cores += used;'), runWatch],
  ['새로 뜬 프로세스를 안 셈', MOD.replace(': (born ? cum : null);', ': null;'), runWatch],
  ['pid 만으로 알아봄(다시 쓰인 pid 를 이어 뺌)', MOD.replace("const key = m.pid + ':' + (m.creationTime || 0);", 'const key = String(m.pid);'), runWatch],
  ['우리 창을 다른 화면과 안 나눔', MOD.replace("return m.pid === viewPid ? 'view' : 'tabs';", "return 'view';"), runWatch],
  ['논리 수로 안 나눔(코어 하나 기준을 PC 전체로 적음)', MOD.replace('fix1(cores / n * 100)', 'fix1(cores * 100)'), runLine],
  ['PC 전체 CPU 를 쉰 시간까지 바쁨으로 셈', MOD.replace('busy += all - idle;', 'busy += all;'), runWatch],
  ['메모리 KB 를 MB 로 안 바꿈', MOD.replace('const KB_PER_MB = 1024;', 'const KB_PER_MB = 1;'), runWatch],
  ['배율을 안 곱함(논리 해상도)', MOD.replace('Math.round(w * scale)', 'Math.round(w)'), runEnv],
  ['false 를 모름으로', MOD.replace("if(v !== undefined && v !== null && v !== '') return v;", 'if(v) return v;'), runEnv],
];
for (const [name, src, run] of breaks) {
  if (src === MOD) { chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음(모듈이 바뀌었다)'); continue; }
  let red = false;
  try { red = run(load(src)).some(ok => !ok); } catch (_) { red = true; }
  chk(red, '깨면 빨강 — ' + name);
}

say('── 5. 배선(main.js)');
const code = MAIN.replace(/\/\*[\s\S]*?\*\//g, ' ');
chk(/const EnvDiag = require\('\.\/app\/parts\/shared\/env-diag'\);/.test(code), 'main 이 env-diag 를 싣는다');
const gpuOnce = (code.match(/function _logGpuOnce\(win\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/_logEnvOnce\(\);/.test(gpuOnce) && /setTimeout\(_logGpuDetail, GPU_DETAIL_DELAY_MS\);/.test(gpuOnce), 'GPU 줄을 남길 때 [환경] 한 줄 · [GPU 상세] 는 미뤄서 한 번(켜는 동안 정보 모으기를 피함)');
chk(/app\.getGPUInfo\('complete'\)[\s\S]{0,80}EnvDiag\.gpuDetailLine\(info\)/.test(code) && /\[GPU 상세\] 못 읽음/.test(code), "[GPU 상세] — getGPUInfo('complete') · 실패도 한 줄");
const tick = (code.match(/function _resTick\(\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/const sys = \{ cpu: EnvDiag\.cpuTimes\(os\.cpus\(\)\), freeBytes: os\.freemem\(\), totalBytes: os\.totalmem\(\) \};/.test(tick) && /_resWatch\.take\(Date\.now\(\), app\.getAppMetrics\(\), w \? w\.webContents\.getOSProcessId\(\) : null, sys\)/.test(tick) && /if\(r\) _diagLog\(EnvDiag\.resourceLine\(r, _cpuThreads\(\), mode\)\);/.test(tick), '[자원] — 1분마다 getAppMetrics 한 번 · 우리 창 pid · PC 전체 CPU 시간 · 메모리를 넘김 · 첫 호출은 안 남김');
chk(/'숨김'/.test(tick) && /_isConfigMode \? '런처' : '실행 화면'/.test(tick), '[자원] — 런처 · 실행 화면 · 숨김 어디서든 남긴다');
chk(/_resTimer = setInterval\(_resTick, RES_MS\);/.test(code) && /const RES_MS = 60 \* 1000;/.test(code) && /_startResourceWatch\(\);/.test(code), '창을 만들 때 1분 타이머 하나');
chk(/function _exitNow\(\)\{[\s\S]*?if\(_resTimer\)\{ clearInterval\(_resTimer\); _resTimer = null; \}[\s\S]*?app\.exit\(0\)/.test(code) && /app\.on\('before-quit'[^\n]*if\(_resTimer\)\{ clearInterval\(_resTimer\); _resTimer = null; \}/.test(code), '끌 때(바로 끝내기 · before-quit) 타이머를 내린다');

say('\n' + (fail ? '✗' : '✓') + ' sim-env-diag: ' + pass + ' 통과 · ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
