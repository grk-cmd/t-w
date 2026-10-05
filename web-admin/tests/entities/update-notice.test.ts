import { describe, expect, it } from 'vitest';
import {
  checkUpdateNotice,
  clearUpdateNotice,
  getUpdateNotice,
  publishUpdateNotice,
} from '@/entities/update-notice';
import { fakeDb, NOW } from '../shared/fakeDb';

describe('업데이트 공지', () => {
  it('제목 · 본문 · 새 ts 를 쓴다 — ts 가 바뀌어야 «다시 보지 않기» 한 사람에게도 다시 뜬다', async () => {
    const { db, writes } = fakeDb();
    await publishUpdateNotice(db, ' v1.2 ', ' 고친 점 ');
    expect(writes).toEqual([['set', 'updateNotice/current', { title: 'v1.2', body: '고친 점', ts: NOW }]]);
  });

  it('제목 60자 · 본문 800자로 자른다(규칙 한도)', async () => {
    const { db, writes } = fakeDb();
    await publishUpdateNotice(db, 'a'.repeat(100), 'b'.repeat(1000));
    const v = writes[0][2] as { title: string; body: string };
    expect(v.title).toHaveLength(60);
    expect(v.body).toHaveLength(800);
  });

  it('제목과 본문 모두 있어야 한다', () => {
    expect(checkUpdateNotice('제목', '')).not.toBeNull();
    expect(checkUpdateNotice('  ', '본문')).not.toBeNull();
    expect(checkUpdateNotice('제목', '본문')).toBeNull();
  });

  it('읽기 · 삭제는 updateNotice/current 한 노드', async () => {
    const cur = { title: 't', body: 'b', ts: 1 };
    const { db, writes } = fakeDb({ 'updateNotice/current': cur });
    expect(await getUpdateNotice(db)).toEqual(cur);
    await clearUpdateNotice(db);
    expect(writes).toEqual([['remove', 'updateNotice/current', undefined]]);
  });
});
