캐릭터 머리 위 이름표 — 모르는 바탕(사용자 작업 화면) 위에 늘 읽혀야 하는 오버레이 글자.

- 글자 `plate-ink`(흰색) + `plate-outline` 8방향 외곽선. 테마를 **타지 않는다** — 바탕이 우리 것이 아니라서.
- 크기 `nameplate`(15px 기본, 설정 `--nameplate-size`). Lv 접두는 0.75em.
- 경험치 바: 두께 `--exp-bar-h`(6px), 바탕 반투명 검정 + 1px 외곽, 채움 `accent`.
- 이름표는 우클릭 = 좌석 메뉴라 히트 영역이 있다(`UI_HIT_SEL`). 그 밖의 장식(반짝이·후광)은 `pointer-events:none`.
- 회차 별(★)의 빛 쓸기 애니메이션은 `prefers-reduced-motion` 에서 멈춘다(기존 그대로). 이름표에 새 상시 애니메이션을 더하지 않는다.

**앱 대응**: `.seat-nameplate` — 값은 지금 그대로, 외곽선을 `plate-outline` 토큰으로만 뺀다.
