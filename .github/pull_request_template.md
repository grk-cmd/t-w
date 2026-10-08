## 무엇을

## 왜

## 확인한 것
- [ ] `npm run check` — 빨강 0 · 정본 일치
- [ ] 실기기 확인 (Windows / mac) — 해당 시
- [ ] 규칙 변경이면 `docs/GIT_CONVENTION.md` 4장 절차대로 했는가

## 배포 영향
- 앱 릴리스 필요: 예 / 아니오
- 규칙·Functions 배포 필요: 예 / 아니오 (예면 순서 적기)

## 서버(AWS) 이관 — 규칙(`firebase-database-rules.json`)을 바꿨으면 필수
- 바뀐 경로: 예) `rooms/$room/_meta/tabs`, `users/$id/bugSeen`
- 무엇이 바뀌었나: 새 칸 · 모양(형식 · 길이) · 누가 읽고 쓰나(권한) · 지우기
- 앱에서 쓰는 곳: 파일 · 함수
- 방에 오가는 칸(멤버 payload · `_meta` · 채팅)이면: 방 서버에도 같은 칸이 필요함 — 예 / 아니오

<!-- 규칙을 안 바꿨으면 «서버(AWS) 이관» 칸은 지워도 됩니다. 자세한 건 docs/GIT_CONVENTION.md 4.1 -->
