# hosting/ — Firebase Hosting 사이트 안내

Firebase Hosting 사이트 여럿을 한 저장소에서 올린다. 사이트마다 `firebase.json` 의 `hosting[]` 한 칸(`target`)과
`.firebaserc` 의 `targets` 한 줄이 짝이다.

## 지금 있는 사이트
| target | Firebase 사이트 | 주소 | 폴더 | 들어 있는 것 | 누가 보나 |
|---|---|---|---|---|---|
| `main` | `together-working` | `together-working.web.app` | `hosting/`(`help/` 는 빼고 올림) | `/admin/` 웹 관리자(`web-admin` 빌드 — 커밋 안 함) | 관리자 |
| `help` | `together-working-help` | **`help.together-working.com`** | `hosting/help/` | 튜토리얼(`/` 목차 · `/1` …) · `/privacy` 개인정보 처리방침 · `/link` 폰 연결 안내 | 사용자 |

- 옛 앱이 여는 `together-working.web.app/privacy` · `/link` 는 `main` 의 `redirects` 가 `help.together-working.com` 으로 넘긴다(`#` 뒤 연결 정보는 브라우저가 그대로 들고 간다). 옛 앱이 다 사라질 때까지 지우지 않는다.
- 도움말 페이지의 색은 디자인 시스템 토큰 — `npm run design:build` 가 `hosting/help/tokens.css` 를 만든다(손으로 고치지 않는다).

## 배포
```bash
firebase deploy --only hosting --project together-working          # 사이트 전부
firebase deploy --only hosting:help --project together-working     # 도움말 사이트만(웹 관리자 빌드 없음 · 빠름)
firebase deploy --only hosting:main --project together-working     # 관리자 사이트만
```
배포는 그 사이트 **폴더 전체**를 올린다 — 올리는 폴더의 다른 파일도 그 판으로 바뀐다. 운영 배포는 사람이 직접 한다.

## 새 사이트 만들기 (예: 메인 소개 페이지)
사용자가 보는 새 페이지는 **우리 도메인**(`*.together-working.com`)으로 낸다 — `*.web.app` 같은 기본 주소를 앱 · 링크에 박지 않는다(앱에 박힌 주소는 바꾸려면 앱을 다시 내야 한다). 메인 소개 페이지라면 `together-working.com`(맨 앞 이름) 자리다.

1. **사이트 만들기**: `firebase hosting:sites:create <사이트 이름> --project together-working` (예: `together-working-home`)
2. **폴더 · 설정**
   - `hosting/<폴더>/` 에 `index.html` 부터. 혼자 서는 정적 페이지 — Firebase SDK 로 DB 를 읽지 않는다(RTDB 요금은 내려받은 바이트).
   - `firebase.json` 의 `hosting[]` 에 칸 하나: `{ "target": "<이름>", "public": "hosting/<폴더>", "ignore": ["**/.*", "**/node_modules/**"], "cleanUrls": true, "headers": [...] }` — 머리는 `help` 칸을 본뜬다(`Referrer-Policy: no-referrer` · `Cache-Control: no-cache`).
   - `main` 칸의 `ignore` 에 `<폴더>/**` 를 더한다(관리자 사이트에 같이 안 올라가게).
   - `.firebaserc` 의 `targets.together-working.hosting` 에 `"<이름>": ["<사이트 이름>"]`.
   - 처리방침 링크는 `https://help.together-working.com/privacy`.
3. **먼저 올리기**: `firebase deploy --only hosting:<이름> --project together-working` → `https://<사이트 이름>.web.app` 에서 확인.
4. **도메인 붙이기**: Firebase 콘솔 › Hosting › 그 사이트 카드를 눌러 들어가 › «커스텀 도메인 추가» › 도메인 입력 · **리디렉션 끔**.
5. **DNS(Cloudflare)** — 레코드 세 줄. 모두 **DNS only(회색 구름)**.
   | 유형 | 이름 | 값 |
   |---|---|---|
   | TXT | 그 이름(맨 앞이면 `@`) | `hosting-site=<사이트 이름>` (Firebase 화면 값) |
   | TXT | `_acme-challenge.<이름>` | Firebase 화면 값(인증서) |
   | A | 그 이름 | Firebase 화면 값(보통 `199.36.158.100`) |
   - **있는 줄을 고치지 말고 늘 «레코드 추가»** 로 새 줄을 만든다 — 도움말 도메인 때 막힌 네 번 중 세 번이 «고치다 다른 줄이 사라짐» 이었다.
   - 넣은 뒤 확인: `dig +short TXT <도메인> @8.8.8.8` · `dig +short A <도메인> @8.8.8.8` (Firebase 는 Google DNS 로 본다). 원본엔 보이는데 Google 에만 안 보이면 https://dns.google/cache 에서 Flush.
   - 값이 맞으면 Firebase 에서 도메인을 **지우고 다시 추가하지 않는다**(인증서 값이 새로 바뀐다). 기다린다 — 보통 몇 분 ~ 수십 분.
6. 연결됨 뒤 맨 앞이 «Site Not Found» 면 옮기는 사이 캐시된 응답이다 — 그 사이트를 한 번 더 배포하면 풀린다.

겪은 일 · 확인 명령 전체는 서버 저장소 운영 노트 `docs/notes/HELP_DOMAIN_DNS.md`(비공개).
