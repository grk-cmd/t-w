import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // 관리자 기능을 앱에서 하나씩 옮겨 오는 중이라 지금은 한 곳에서만 쓰는 조각이 많다 — 합치지 않고 둔다.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
