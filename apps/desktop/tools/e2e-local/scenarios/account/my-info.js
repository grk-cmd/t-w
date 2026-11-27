// 내 정보 · 보관함 · 휴지통 — 머리(친구 코드 · 이름) · 보관함 줄 · [휴지통 이동] → [옮기기] · 휴지통 탭 · [복원] · [슬롯에 올리기]
// 캐릭터는 API 로 옷장에 미리 넣는다(만드는 화면은 캐릭터 영역의 몫 · 그림 없는 최소 def). 판정은 화면 줄 수 · 탭 글 · 서버 옷장(GET /v2/me/avatars)
'use strict';
const K = require('./_kit.js');

K.scenario('my-info', async (t) => {
  const acct = await t.step('계정 + 보관함 캐릭터 둘(API)', async () => {
    const a = await K.apiAccount();
    await K.apiAvatar(a, 0, 'BOX');
    await K.apiAvatar(a, 0, 'BOX');
    return a;
  });
  const pc = await t.app('pc');
  await t.step('로그인', () => K.loginUi(pc, acct.fc));
  const closet = async () => (await acct.api('GET', '/v2/me/avatars')).data;
  const rows = (sel) => pc.w.evaluate((s) => document.querySelectorAll(s + ' > div').length, sel);
  await t.step('머리 — 친구 코드 · 이름 없음 표시', async () => {
    await K.openMyInfo(pc, 'box');
    await K.waitFor(async () => (await K.text(pc.w, '#miCode')) === acct.fc, 15000, '친구 코드');
    t.note('이름 칸: ' + await K.text(pc.w, '#miNick'));
  });
  await t.step('보관함 — 2/20 · 두 줄', async () => {
    await K.waitFor(async () => (await K.text(pc.w, '#miBoxCount')) === '2/20', 15000, '보관함 2/20');
    if((await rows('#miBoxList')) !== 2) throw new Error('보관함 줄이 2 가 아님');
  });
  await t.step('[휴지통 이동] → 되묻기 [옮기기] → 1/20 · 휴지통 1 · 서버도', async () => {
    await pc.w.click('#miBoxList > div:first-child button[aria-label="휴지통 이동"]');
    await pc.w.click('#miBoxList button:has-text("옮기기")');
    await K.waitFor(async () => (await K.text(pc.w, '#miBoxCount')) === '1/20', 15000, '보관함 1/20');
    await K.waitFor(async () => (await K.text(pc.w, '#miTabTrash')) === '휴지통 1', 15000, '휴지통 탭 1');
    if((await closet()).avatars.length !== 1) throw new Error('서버 옷장이 1 이 아님');
  });
  await t.step('휴지통 탭 — «옮김» 줄 하나 → [복원] → 보관함 2/20', async () => {
    await pc.w.click('#miTabTrash');
    await K.waitShown(pc.w, '#miPageTrash');
    await K.waitFor(async () => (await rows('#miTrashList')) === 1, 15000, '휴지통 한 줄');
    if(!/^옮김/.test(await K.text(pc.w, '#miTrashList > div:first-child span'))) throw new Error('«옮김» 표시가 없음');
    await pc.w.click('#miTrashList button:has-text("복원")');
    await K.waitFor(async () => (await K.text(pc.w, '#toast')) === '보관함으로 복원했어요', 15000, '복원 안내');
    await K.waitFor(async () => (await K.text(pc.w, '#miTrashCount')) === '0', 15000, '휴지통 0');
    if((await closet()).avatars.length !== 2) throw new Error('서버 옷장이 2 가 아님');
  });
  // 시험 캐릭터는 그림 없는 최소 def 라 슬롯에 오르면 앱이 그 칸을 못 그린다(옷장 받기가 «얼굴 URL 없음» 으로 멈춤) — 이 단계는 요청 · 서버 슬롯으로만 판정한다
  await t.step('보관함 [슬롯에 올리기] → 서버 이동 200 · 서버 슬롯에 캐릭터', async () => {
    await pc.w.click('#miTabBox');
    await K.waitFor(async () => (await K.text(pc.w, '#miBoxCount')) === '2/20', 15000, '보관함 2/20');
    const n = pc.A.reqs.length;
    await pc.w.click('#miBoxList button:has-text("슬롯에 올리기")');
    await K.waitFor(() => pc.A.reqs.slice(n).some((r) => /^POST \/v2\/me\/avatars\/[^/]+\/move 200/.test(r)), 15000, '이동 요청 200');
    const c = await closet();
    if(!c.slots.some(Boolean)) throw new Error('서버 슬롯이 비어 있음 ' + JSON.stringify(c.slots));
  });
});
