글자를 받는 칸 — 한 줄(`input`) · 여러 줄(`textarea`) · 고르기(`select`).

- `label.tw-field` 로 감싸 이름(`caption`, `ink-soft`)을 위에 붙인다. 자리표시 글자만으로 이름을 대신하지 않는다.
- 칸: `bg-field`, 테두리 `line-strong`(3:1 이상), 안쪽 그림자 `shadow-pressed`, 높이 24px 이상, 글자 `body`.
- 오류: 테두리 `ink-danger` + 아래 `.tw-err` 한 줄(«코드는 6자리예요»). 빨간색만으로 알리지 않는다.
- 포커스: `focus` 2px 고리.
- 입력칸은 `user-select:text` 예외(앱 전역은 선택 금지).

**앱 대응**: 버블 테마 전역 `input,textarea,select{border-radius}` 규칙 + 곳곳의 `.win98sunken` → `.tw-input`.
