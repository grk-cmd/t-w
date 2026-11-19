// 런북 T+136 최소 버전 — config/minAppVer = 0.13.0 일 때 운영 0.12.3 을 다시 켜면
// 상태는 T+136 그대로: 컷오버 규칙 · 점검 켬 · Firebase minAppVer · minRoomVer = 0.13.0
// 0.12.3 의 읽는 차례: API GET /v1/config 의 data.config.minVersion.app → 요청이 실패하거나 config 가 객체가 아닐 때만 RTDB config/minAppVer(remote-config.js)
//   (a) /v1/config 실패(503 — ADMIN_ONLY · CONFIG_NOT_READY 와 같은 모양) → RTDB 로 읽어 «업데이트해 주세요» 전체 화면
//   (b) /v1/config 가 minVersion.app = 0.13.0 → 같은 화면
//   (c) /v1/config 가 config:{}(minVersion 없음) → 막지 않음(위험한 경우 — RTDB 를 읽지 않는다). 이 시나리오는 «안 막힘» 을 기대값으로 적는다
// 업데이트 단추: 맥은 GitHub 최신 릴리스(시험 stub)를 읽어 «새 버전 받으러 가기» → 누르면 브라우저 열기(shell.openExternal)를 «OPEN» 줄로만 남긴다(내려받지 않음)
'use strict';
const fs = require('fs');
const path = require('path');
const k = require('./_kit.js');

const GATE_MS = 20000;      // 창이 뜬 뒤 이 안에 업데이트 화면(앱은 첫 답을 7초 기다린다 · 켜는 시간 포함)
const OPEN_URL = 'https://github.com/grk-cmd/t-w/releases/tag/v0.13.0';

k.run('force-update', async (t) => {
  await k.seedNormal(t);
  const A = t.newApp('pc');
  await t.step('준비 — 0.12.3 규칙에서 로그인한 옛 사용자', async () => (await k.prepareUser(t, A)).code);

  await t.step('T+136 상태로 — 컷오버 규칙 · 점검 켬 · minAppVer · minRoomVer = 0.13.0', async () => {
    await A.quit();
    await t.db.set('config/maintenance', { on: true, endsAt: Date.now() + 3600 * 1000, message: '서버를 새로 옮기고 있어요.' });
    await t.db.set('config/minAppVer', '0.13.0');
    await t.db.set('config/minRoomVer', '0.13.0');
    await t.db.rules(k.RULES_CUTOVER);
    t.env.api.st.github = { tag_name: 'v0.13.0', name: 'v0.13.0', html_url: OPEN_URL };
  });

  const relaunch = async (mode) => {
    t.env.api.st.mode = mode;
    await A.quit();
    const since = new Date().toISOString();
    const w = await A.launch();
    const t0 = Date.now();
    return { w, t0, since };
  };
  const minAppVerRead = (since) => fs.readFileSync(path.join(t.out, 'rtdb.txt'), 'utf8').split('\n')
    .filter((l) => l.slice(0, 24) >= since && / C> /.test(l) && /"p":"\/config\/minAppVer"/.test(l)).length;
  const configReqs = () => A.lines(/^REQ GET \/v1\/config /);

  const blocked = async (label, mode, expectApiStatus) => {
    await t.step(label, async () => {
      const n0 = configReqs().length;
      const { w, t0, since } = await relaunch(mode);
      const s = await k.until(async () => { const x = await k.screen(w); return x.gate ? x : null; }, GATE_MS);
      if(!s) throw new Error(GATE_MS / 1000 + '초 안에 업데이트 화면이 안 뜸 — ' + JSON.stringify(await k.screen(w)));
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      await t.shot(w, 'gate-' + mode);
      if(!/^업데이트해 주세요/.test(s.gate.text) || !s.gate.text.includes('0.12.3') || !s.gate.text.includes('0.13.0')) throw new Error('화면 글이 다름: ' + s.gate.text);
      if(s.gate.buttons.length !== 1 || /닫기|×|나중에/.test(s.gate.text)) throw new Error('닫는 단추가 있음 ' + JSON.stringify(s.gate.buttons));
      const req = configReqs().slice(n0);
      if(!req.length || !req.every((r) => r.endsWith(' ' + expectApiStatus))) throw new Error('/v1/config 답이 기대와 다름 ' + JSON.stringify(req));
      const fb = minAppVerRead(since);
      if(mode === 'down' && !fb) throw new Error('API 실패 뒤 RTDB config/minAppVer 를 안 읽음');
      // 업데이트 단추 — 맥 갈래(켜고 3초 뒤 GitHub 최신 릴리스 stub)가 «새 버전 받으러 가기» 로 바꾼다 → 눌러도 내려받지 않고 OPEN 줄만
      const btn = await k.until(async () => { const x = await k.screen(w); return x.gate && x.gate.buttons[0] === '새 버전 받으러 가기' ? x : null; }, 10000);
      if(!btn) throw new Error('단추가 «새 버전 받으러 가기» 가 안 됨: ' + JSON.stringify((await k.screen(w)).gate));
      const o0 = A.lines(/^OPEN /).length;
      await w.locator(k.VERGATE + ' button').click();
      const opened = await k.until(() => A.lines(/^OPEN /).length > o0, 5000);
      if(!opened) throw new Error('단추를 눌러도 열기 요청이 없음');
      const url = A.lines(/^OPEN /).slice(o0)[0].slice(5);
      if(url !== OPEN_URL) throw new Error('연 주소가 다름 ' + url);
      if(A.lines(/^BLOCK /).length) throw new Error('막힌 요청 ' + A.lines(/^BLOCK /).join(' | '));
      await k.alive(A, w);
      return `창 뜬 뒤 ${sec}초 · /v1/config ${expectApiStatus} · RTDB minAppVer 읽기 ${fb}번 · 단추 «${btn.gate.buttons[0]}» → 브라우저 열기 요청만(${url})`;
    });
  };

  await blocked('(a) /v1/config 실패(503) → RTDB minAppVer 로 «업데이트해 주세요» 전체 화면 · 닫기 없음', 'down', 503);
  await blocked('(b) /v1/config minVersion.app = 0.13.0 → 같은 화면', 'min', 200);

  await t.step('(c) /v1/config 가 config:{}(minVersion 없음) → 0.12.3 은 안 막힘 — RTDB minAppVer 를 읽지 않는다(위험한 경우)', async () => {
    const n0 = configReqs().length;
    const { w, since } = await relaunch('empty');
    const got = await k.until(() => configReqs().length > n0, 15000);
    if(!got) throw new Error('/v1/config 요청이 없음');
    await k.wait(12000);   // 앱의 첫 답 대기 7초 + 여유
    const s = await k.screen(w);
    await t.shot(w, 'no-gate-empty');
    if(s.gate) throw new Error('막힘(기대와 다름 — 위험이 없다는 뜻이니 시나리오를 고친다): ' + s.gate.text);
    const fb = minAppVerRead(since);
    if(fb) throw new Error('RTDB minAppVer 를 읽음 ' + fb);
    await k.alive(A, w);
    return '업데이트 화면 없음 · RTDB minAppVer 읽기 0번 · 보이는 것 ' + JSON.stringify({ maint: s.maint && s.maint.text.split('\n')[0], lost: s.lost && s.lost.text.split('\n')[0], toast: s.toast });
  });
});
