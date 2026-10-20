import { describe, expect, it } from 'vitest';
import { withProdMark } from '@/shared/api';

describe('운영 표시', () => {
  it('운영이면 확인 문구 앞에 «[운영] », dev 면 그대로', () => {
    expect(withProdMark({ isProd: true, projectId: 'together-working' }, '지울까요?')).toBe(
      '[운영] 지울까요?',
    );
    expect(withProdMark({ isProd: false, projectId: 'together-working-dev' }, '지울까요?')).toBe('지울까요?');
  });
});
