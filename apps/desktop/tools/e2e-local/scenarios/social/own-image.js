// 🖼 내 그림 넷을 Storage 내 폴더에 바로 올리기(0.14) — 마이홈 사진 · 디데이 카드 · 박수 그림 · 말랑이(말랑이는 mallang-gift.js 가 화면으로 본다)
// 앱 코드(상태 주인 · provider · firebase-init putOwnFile)를 그대로 불러 Storage 에뮬레이터(주인 검사 규칙)에 올리고, 받은 주소를 서버가 저장하는지 본다.
// 서버 그림 endpoint(POST /v2/me/images)는 부르지 않는다. 주인 검사 규칙(앱 저장소 firebase/storage.rules)을 에뮬레이터에 올려 두고 돌린다.
'use strict';
const { scenario, assert, openMyHome, openChild, until, pngFile } = require('./_kit.js');

const dataUrlIn = (u, color, type) => u.eval(([c, t]) => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 64, 64);
  return cv.toDataURL(t, 0.9);
}, [color, type]);
const decodePath = (url) => decodeURIComponent(String(url).split('/o/')[1].split('?')[0]);

scenario('own-image', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const me = a.me.userCode;

  await t.step('마이홈 사진 — 앱이 users/{내 코드}/mh_… 에 바로 올리고 서버가 그 주소를 저장한다', async () => {
    await openMyHome(a, 'home');
    const png = await dataUrlIn(a, '#3a8', 'image/png');
    const r = await a.eval(async (d) => { const s = await myhomeStoreMod.setAvatar(d); await myhomeStoreMod.flush(); return s; }, png);
    assert(r === 'ok' || r === 'queued' || r === 'saved' || typeof r === 'string', '사진 저장 결과 ' + r);
    let page;
    for(let i = 0; i < 20; i++){ page = (await a.api('GET', '/v2/me/myhome')).json.data; if(page && page.page && /mh_/.test(String(page.page.avatar))) break; await t.wait(300); }
    const url = page.page.avatar;
    assert(new RegExp('^users/' + me + '/mh_[A-Za-z0-9-]+\\.png$').test(decodePath(url)), '서버에 저장된 사진 주소 ' + url);
    assert(!a.sawReq(/\/v2\/me\/images/), '서버 그림 endpoint 를 불렀다 ' + a.A.reqs.filter((l) => /images/.test(l)).join(','));
    const got = await a.eval(async (u) => (await fetch(u)).status, url);
    assert(got === 200, '올린 사진 받기 ' + got);
    t.note(decodePath(url));
  });

  await t.step('디데이 카드 그림 — users/{내 코드}/dday_… · 서버가 보드에 저장', async () => {
    const jpg = await dataUrlIn(a, '#c63', 'image/jpeg');
    const today = await a.eval(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    const out = await a.eval(async ([uid, img, date]) => {
      const b = await scheduleApiMod.fetchBoard(uid);
      b['own-image-card'] = { kind: 'anniv', text: '그림 카드', date, public: false, notify: false, base1: true, bgColor: null, bgImg: img, order: 0 };
      const saved = await scheduleApiMod.saveBoard(uid, b, null);
      return JSON.stringify(saved);
    }, [me, jpg, today]);
    const board = (await a.api('GET', '/v2/me/ddays')).json.data;
    const card = (board.cards || []).find((c) => c.text === '그림 카드');
    assert(card && new RegExp('^users/' + me + '/dday_[A-Za-z0-9-]+\\.jpg$').test(decodePath(card.bgImage)), '서버 카드 그림 ' + JSON.stringify(card) + ' · ' + out.slice(0, 200));
    assert(!a.sawReq(/\/v2\/me\/images/), '서버 그림 endpoint 를 불렀다');
    t.note(decodePath(card.bgImage));
  });

  await t.step('박수 그림 — 내 방명록 창 «이미지 등록» → users/{내 코드}/clap_… · 서버 겉모습에 저장', async () => {
    await openMyHome(a, 'home');
    const gw = await openChild(a, '#mhGuestbookBtn');
    await until(gw, () => /TOTAL CLAP : \d+/.test((document.getElementById('gbClapTotal') || {}).textContent || ''), null, { timeout: 15000 });   // 방명록을 받은 뒤라야 내 겉모습을 바꿀 수 있다
    // 화면 그대로 — 방명록 창의 «이미지 등록» 파일 칸에 그림을 넣으면 400px JPEG 로 줄여 올린다(guestbook.js)
    await gw.setInputFiles('#gbClapImgFile', await pngFile(a, 'clap.png', '#58f'));
    const tt = await a.until(() => /웹박수 이미지를 등록했어요|오류 E-/.test(document.getElementById('toast').textContent) && document.getElementById('toast').textContent, null, { what: '박수 그림 결과 토스트' });
    assert(/웹박수 이미지를 등록했어요/.test(tt), '박수 그림 결과 ' + tt);
    const book = (await a.api('GET', '/v2/guestbooks/' + me)).json.data;
    const url = book.clap && (book.clap.imageUrl || book.clap.clapImageUrl || book.clap.image);
    assert(url && new RegExp('^users/' + me + '/clap_[A-Za-z0-9-]+\\.jpg$').test(decodePath(url)), '서버 박수 그림 ' + JSON.stringify(book.clap));
    assert(!a.sawReq(/\/v2\/me\/images/), '서버 그림 endpoint 를 불렀다');
    t.note(decodePath(url));
    await gw.click('#gbClose');
  });

  await t.step('주인 검사 — 남의 코드 폴더에 같은 함수로 올리면 Storage 가 거절한다', async () => {
    const res = await a.eval(async () => {
      const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      try{ await firebaseAPI.putOwnFile('users/unotme000001/mh_x.png', bytes, 'image/png'); return 'uploaded'; }
      catch(e){ return 'denied:' + (e && e.code); }
    });
    assert(/^denied:storage\/unauthorized/.test(res), '남의 폴더 올리기 ' + res);
  });
});
