짧은 상태 낱말(칩) · 개수(배지) · 새 소식 점 · 레벨 딱지.

- **상태 칩** `.tw-chip`: 테두리 = 글자색(`currentColor`), 바탕 `bg-field`. `new`=`ink-danger`, `checking`=`ink-accent`, `fixed`=`ink-ok`, 기본=`ink-soft`, `private`=`ink-private`/`bg-private`. 앞에 ●◐✓ 같은 모양 글자를 붙여 색 없이도 갈리게 한다.
- **배지** `.tw-badge`: `pop` + `on-pop`, `num` 서체 10px, 99 넘으면 «99+».
- **점** `.tw-dot`: 8px `pop`, 바깥 1px 어두운 선(밝은 바탕에서도 보이게).
- **레벨** `.tw-lv`: «Lv» 는 ui 서체 9px, 숫자는 `num` 11px — 기존 `.mh-flv` 세트 그대로. 등급 그라데이션(`--lv-*`)은 해금 보상이라 이 시스템이 손대지 않는다.

**앱 대응**: 웹 관리자 `StatusChip.module.css`(같은 모양 · 같은 넷) ↔ 앱 `.bb-tag` · `.bb-dot` — 둘을 이 칩 하나로 맞춘다.
