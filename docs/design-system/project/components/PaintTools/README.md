그리기 도구 고르기 — 붓 · 채우기 · 지우개 셋 중 하나만 켜지는 세그먼트.

- `.tw-seg[role=group]` > `button[aria-pressed]` × 3. 칸마다 SVG 아이콘 14px + 낱말 + 단축키 `kbd`(B · G · C).
- 켜진 칸: `bg-select` + `shadow-pressed` + 바닥 2px `accent` 줄. 굵게.
- 셋은 **서로 배타**다. 지금 앱은 «펜/지우개» 쌍과 «🪣 채우기» 켬끔이 따로 있어 «지우개 + 채우기» 가 동시에 켜진다 — 한 줄로 합친다(채우기 중 지우기는 지우개 칸에서 클릭 = 메쉬 지우기로 옮긴다).
- 대칭(X)·스포이드(우클릭)는 모드가 아니라 옵션이라 세그먼트에 넣지 않는다 — 옆에 `.tw-btn--icon` 토글로.
- 단축키 힌트 줄(«Ctrl+Z 되돌리기 · …»)은 `micro` 로 세그먼트 아래 한 줄.

**앱 대응**: `#wdPicPen` · `#wdPicEraser` · `#wdPicFill`(`.wd-pic-btn`) → `.tw-seg`. 상태는 `_wdPic.eraser` · `_wdPic.fill` 두 불리언 대신 `_wdPic.tool = 'brush'|'fill'|'eraser'` 하나로.
