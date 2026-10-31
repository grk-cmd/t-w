/* myhome-desktop-boot.js — 🖥️ 마이홈 바탕화면(myhome-desktop.js)을 만드는 한 줄
   바탕화면은 싣자마자 저장값을 읽고(다른 스크립트가 MYHOME_DESKTOP 을 바로 쓴다) app.js 뒤에 실려서, 만드는 줄을 별도 파일로 둔다.
   계정 칸(accountStoreMod)은 app.js 가 만든 한 벌을 여기서 deps 로 넘긴다. 반드시 myhome-desktop.js 바로 다음에 싣는다. */
TwMyHomeDesktop.createMyHomeDesktop({ advStore: accountStoreMod });
