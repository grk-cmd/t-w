떠 있는 창의 틀 — 타이틀바(그라데이션 + 앱 도트 아이콘 + 제목 + 둥근 창 버튼)와 본체.

- **구조**: `.tw-win` > `.tw-titlebar`(`img` 16×15 `image-rendering:pixelated` · `.t` 제목 · `.tw-tbtn`) > `.tw-body`.
- **색**: 본체 `bg-face` + 위에서 사라지는 광택, 테두리 `line`, 그림자 `shadow-window` 한 겹. 타이틀바 `title-a → title-b`, 글자 `title-ink`, 높이 `size-titlebar`(22px), 글자 `title-bar`(12px 굵게).
- **모서리**: 버블 `radius-md`(12px), 타이틀바는 위 두 모서리만 `radius-md − 1px`. 클래식은 0 + 베젤.
- **유료**: `.premium` — `premium-a/b`, 글자 `on-premium`. 금색은 «유료» 표시라 다른 데 쓰지 않는다.
- 타이틀바 = 끄는 손잡이(`-webkit-app-region:drag` 또는 앱 드래그). 창 버튼은 `no-drag`.
- 창 하나 = 일 하나. 창 안에 또 창 틀을 넣지 않는다(카드가 필요하면 `bg-face-2` 면만).
- 새 창은 `overflow:hidden` 을 쓰지 않는다 — 펼침 메뉴·툴팁이 창 밖으로 나가야 한다(기존 주석 그대로).

**앱 대응**: `.win98titlebar`, `.lc-bar`, 인라인 그라데이션 49곳, `#mhGbTitle` 등 ID 나열 → 모두 `.tw-titlebar` 하나로.
