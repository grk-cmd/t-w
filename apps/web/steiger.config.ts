import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // 페이지가 아직 하나라 조각마다 쓰는 곳이 한 곳이다 — 캐릭터(entities) · 코드 만들기(features)는 라이브러리 · 로그인 저장(#441)이 곧 같이 쓴다. apps/admin 과 같은 까닭으로 끈다.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
