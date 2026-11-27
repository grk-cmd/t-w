// 닉네임 바꾸기 · 운영진처럼 보이는 이름 막기 — 내 정보 머리의 [수정]
// 판정: 화면 이름 · 서버 계정 이름(GET /v2/me displayName) · 다시 켠 뒤에도 같음 · «운영자» 는 화면에서 막고 서버도 거절 · 12자 상한
'use strict';
const K = require('./_kit.js');
const NAME = '이투이 ' + Math.floor(Math.random() * 900 + 100);

K.scenario('nickname', async (t) => {
  const a = await t.app('pc');
  const acct = await t.step('가입', () => K.signupUi(t, a));
  const edit = async (v) => {
    await a.w.click('#miNameEdit');
    await K.waitShown(a.w, '#miNameInput');
    await a.w.fill('#miNameInput', v);
    await a.w.click('#miNameSave');
  };
  const toast = () => K.text(a.w, '#toast');
  await t.step('[수정] → 이름 저장 → 서버 PATCH 200 · 안내 · 머리 이름', async () => {
    await K.openMyInfo(a);
    await edit(NAME);
    await K.waitFor(async () => (await toast()) === '이름이 저장됐어요', 15000, '저장 안내');
    if(!a.A.reqs.some((r) => /^PATCH \/v2\/me 200/.test(r))) throw new Error('PATCH /v2/me 200 없음');
    if((await K.text(a.w, '#miNick')) !== NAME) throw new Error('머리 이름이 다름: ' + await K.text(a.w, '#miNick'));
    const me = await acct.api('GET', '/v2/me');
    if(me.data.displayName !== NAME) throw new Error('서버 이름이 다름: ' + me.data.displayName);
  });
  await t.step('«운영자» — 화면이 막는다(서버에 보내지 않음 · 이름 그대로)', async () => {
    const n = a.A.reqs.length;
    await edit('운영자');
    await K.waitFor(async () => (await toast()) === '운영진과 헷갈리는 이름은 쓸 수 없어요', 10000, '막음 안내');
    await t.wait(1000);
    if(a.A.reqs.slice(n).some((r) => /^PATCH \/v2\/me /.test(r))) throw new Error('막은 이름을 서버로 보냄');
    if((await K.text(a.w, '#miNick')) !== NAME) throw new Error('막았는데 이름이 바뀜');
  });
  await t.step('서버도 «관리자» 를 거절한다(USER_RESERVED_NAME)', async () => {
    const me = await acct.api('GET', '/v2/me');
    const r = await acct.api('PATCH', '/v2/me', { version: me.data.version, displayName: '관리자' });
    const code = r.body && (r.body.code || (r.body.error && r.body.error.code) || JSON.stringify(r.body));
    if(r.status < 400 || !/USER_RESERVED_NAME/.test(JSON.stringify(r.body))) throw new Error('서버가 받음: ' + r.status + ' ' + code);
  });
  await t.step('12자 넘게 넣으면 12자까지만 저장', async () => {
    const long = '가나다라마바사아자차카타파하';
    await edit(long);
    await K.waitFor(async () => (await toast()) === '이름이 저장됐어요', 15000, '저장 안내');
    const me = await acct.api('GET', '/v2/me');
    if(me.data.displayName !== long.slice(0, 12)) throw new Error('서버 이름: ' + me.data.displayName);
    await edit(NAME);
    await K.waitFor(async () => (await K.text(a.w, '#miNick')) === NAME, 15000, '되돌림');
    await K.waitFor(async () => (await acct.api('GET', '/v2/me')).data.displayName === NAME, 15000, '서버 되돌림');
  });
  await t.step('다시 켜도 서버 이름 그대로', async () => {
    await a.quit();
    await a.launch();
    await K.waitEntered(a);
    await K.openMyInfo(a);
    await K.waitFor(async () => (await K.text(a.w, '#miNick')) === NAME, 15000, '다시 켠 뒤 이름');
  });
});
