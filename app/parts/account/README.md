# account — 계정 모듈 안내

## `app-version-sync.js` — 🔄 계정 단위 판 맞추기

**책임** — 켤 때(로그인 복원이 끝난 뒤) 이 앱 판을 서버에 알리고(`POST /v2/me/app-version`, 본문 `{ version }` 만 — 계정은 로그인 토큰으로 서버가 정한다), 응답이 `behind: true`(이 계정이 더 새 판을 쓰는 기기가 있다)면 업데이트 안내 화면으로 막는다. 판 비교는 서버가 한다 — 앱은 `behind` 만 믿는다.

**만드는 법** — `firebase-init.js` 가 로그인 통로(`TwApi.authed`) 가 이어진 줄 바로 뒤에서 만든다(최소 버전 게이트와 같은 화면 · 업데이트 길을 쓰기 때문):

```js
window.TwAppVersionSync.createAppVersionSync({ authed, getVersion: () => _appVer.ready, block: (my, highest) => { _verGate.blockForAccount(my, highest); }, warn })
```

`api-client.js` 다음, 일반 script 로 싣는다(`firebase-init.js` 는 module 이라 그 뒤에 돈다).

**내놓는 것** — `createAppVersionSync(deps)` → `report()` → `{ state: 'behind' | 'ok' | 'skipped' }` · `PATH` · `STATE`.

**함정** — 못 알려도(닿지 못함 · 401 가입 전 · 모양이 다른 답 · 판을 모름) **막지 않는다** — 잘못 막는 쪽이 더 크다. 사용자 안내 · 오류 번호도 없다(콘솔 한 줄). 다시 보내지 않는다 — 다음에 켤 때 다시 알린다. 화면은 `shared/app-version-gate.js` 의 `blockForAccount`(이미 최소 버전으로 막혔으면 그 화면을 둔다).
검사: `checks/sim-app-version-sync.js` · `checks/sim-app-version-gate.js` 2-2절.
