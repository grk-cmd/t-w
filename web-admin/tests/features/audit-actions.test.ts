import { describe, expect, it } from 'vitest';
import { publishAnnounce } from '@/entities/notice/announce';
import type { CatalogEntry } from '@/entities/catalog';
import { sendBroadcast } from '@/entities/inbox';
import { createLicense } from '@/entities/license';
import { closeRooms } from '@/entities/room';
import { deleteEntries } from '@/features/catalog/delete-entries';
import { approveRequest, approveRequests, rejectRequest } from '@/features/license/approve-request';
import { grantRow, type PlanRow } from '@/features/license/bulk-grant';
import { grantByFriendCode } from '@/features/license/grant-by-code';
import { removeKeys, revokeKeys } from '@/features/license/revoke-key';
import { closeAllRooms } from '@/features/room/close-room';
import { createInviteCodes, grantInvites, grantInvitesAll } from '@/features/user/grant-invites';
import { dismissReportsMany, takeDownAwayImg } from '@/features/user/moderate-report';
import { auditsOf, fakeDb, type Write } from '../shared/fakeDb';
import { fakeFiles } from '../shared/fakeFiles';

const KEY = 'ABCD-EFGH-JKLM-NPQR';
const brief = (writes: Write[]) => auditsOf(writes).map((a) => [a.action, a.target, a.detail]);
const req = { id: 'r1', name: '테스터', friendCode: 'MATE-AB12', requestedAt: 1 };

describe('작업 기록 — 묶음 안에 남기는 동작', () => {
  it('키 발급 · 친구코드 발급 — 키 원문 대신 첫 덩어리, 메모(이름)는 남기지 않는다', async () => {
    const { db, writes } = fakeDb({
      'friendCodes/MATE-AB12': { userId: 'u1' },
      'users/u1/profile/name': '철수',
    });
    await createLicense(db, '철수 후원', () => KEY);
    await grantByFriendCode(db, 'AB12', () => KEY);
    expect(brief(writes)).toEqual([
      ['license.issue', 'ABCD-…', undefined],
      ['license.grantCode', 'MATE-AB12', 'ABCD-…'],
    ]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('철수');
    expect(JSON.stringify(auditsOf(writes))).not.toContain(KEY);
  });

  it('요청 발급은 건마다 그 묶음 안에, 거절은 친구코드로', async () => {
    const { db, writes } = fakeDb();
    await approveRequest(db, req, () => KEY);
    await approveRequests(db, [{ ...req, id: 'r2', friendCode: '' }], () => KEY);
    await rejectRequest(db, { ...req, id: 'r3' });
    expect(brief(writes)).toEqual([
      ['license.approve', 'MATE-AB12', 'ABCD-… · 수령함 없음'],
      ['license.approve', 'r2', 'ABCD-… · 수령함 없음'],
      ['license.reject', 'MATE-AB12', undefined],
    ]);
    expect(writes.filter((w) => w[1] === 'licenseRequests/r3')).toEqual([
      ['commit', 'licenseRequests/r3', null],
    ]);
  });

  it('엑셀 일괄 발급은 행마다 키가 나가 기록도 행마다 — 빈 코드 행은 «키만»', async () => {
    const { db, writes } = fakeDb();
    const row = { st: 'send', uid: 'u1', code: 'MATE-AB12', name: '', memo: '' } as PlanRow;
    await grantRow(db, row, () => KEY);
    await grantRow(db, { ...row, st: 'key', uid: null, code: '' }, () => KEY);
    expect(brief(writes)).toEqual([
      ['license.bulk', 'MATE-AB12', 'ABCD-…'],
      ['license.bulk', '키만', 'ABCD-…'],
    ]);
  });

  it('회수 · 삭제 — 하나면 그 키, 여럿이면 개수 한 줄', async () => {
    const { db, writes } = fakeDb();
    await revokeKeys(db, [KEY]);
    await removeKeys(db, ['AAAA-1', 'BBBB-2', 'CCCC-3', 'DDDD-4']);
    expect(brief(writes)).toEqual([
      ['license.revoke', 'ABCD-…', undefined],
      ['license.remove', '4개', 'AAAA-…, BBBB-…, CCCC-… 외 1개'],
    ]);
  });

  it('신고 — 그림 내리기 · 여러 명 문제없음', async () => {
    const url = 'https://firebasestorage.googleapis.com/x';
    const { db, writes } = fakeDb({ 'users/u1/awayImg': url });
    await takeDownAwayImg(db, fakeFiles().files, 'u1', url);
    await dismissReportsMany(db, ['u2', 'u3']);
    expect(brief(writes)).toEqual([
      ['report.takeDown', 'u1', undefined],
      ['report.dismiss', '2명', 'u2, u3'],
    ]);
  });

  it('공지 · 방 · 카탈로그도 같은 묶음에 한 줄', async () => {
    const { db, writes } = fakeDb({ roomIndex: { 'WORK-A': {}, 'WORK-B': {} } });
    await publishAnnounce(db, '점검 5분 전');
    await sendBroadcast(db, { tag: 'notice', title: '새 소식', body: '' }, true, 'b1');
    await closeRooms(db, ['PLAY-A']);
    await closeAllRooms(db);
    const entry = { kind: 'desks', id: 'd1', name: '책상', files: [] } as unknown as CatalogEntry;
    await deleteEntries(db, fakeFiles().files, [entry]);
    expect(brief(writes)).toEqual([
      ['notice.announce', '점검 5분 전', undefined],
      ['notice.broadcast', '새 소식', '📢 공지 · 고정'],
      ['room.close', 'PLAY-A', undefined],
      ['room.closeAll', '2개', 'WORK-A, WORK-B'],
      ['catalog.delete', 'desks 1개', '책상'],
    ]);
  });

  it('바꿀 것이 없으면 기록도 없다', async () => {
    const { db, writes } = fakeDb();
    await revokeKeys(db, []);
    await closeRooms(db, []);
    expect(writes).toEqual([]);
  });
});

describe('작업 기록 — 묶을 수 없어 끝난 뒤 따로', () => {
  const left = (uid: string) => `users/${uid}/invite/invitesLeft`;

  it('초대권 한 명 — 지급됐을 때만', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 2 });
    await grantInvites(db, 'u1', 3);
    await grantInvites(db, 'u9', 3); // 칸이 없는 사람 — 쓰지 않으니 기록도 없다
    expect(brief(writes)).toEqual([['invite.grant', 'u1', '+3 → 5장']]);
    expect(writes.map((w) => w[0])).toEqual(['transaction', 'commit']);
  });

  it('초대권 선택 · 전체 — 사람마다가 아니라 한 줄', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 1, [left('u2')]: 1 });
    await grantInvitesAll(db, ['u1', 'u2', 'u3'], 2, { scope: 'selected' });
    await grantInvitesAll(db, ['u1'], 1, { scope: 'all' });
    expect(brief(writes)).toEqual([
      ['invite.grantSelected', '3명', '+2 · 지급 2 · 건너뜀 1 · 실패 0'],
      ['invite.grantAll', '1명', '+1 · 지급 1 · 건너뜀 0 · 실패 0'],
    ]);
  });

  it('초대 코드 — 중간에 실패해도 만든 만큼 남기고, 코드 자체는 적지 않는다', async () => {
    const { db, writes } = fakeDb();
    let n = 0;
    const tx = db.transaction;
    db.transaction = (path, change) => (++n > 2 ? Promise.reject(new Error('끊김')) : tx(path, change));
    await expect(createInviteCodes(db, 5)).rejects.toThrow();
    expect(brief(writes)).toEqual([['invite.codes', '2개', undefined]]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('INVT-');
  });

  it('기록이 거절돼도 동작은 성공으로 돌아온다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 2 }, (p) => p.startsWith('adminLog/'));
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await grantInvites(db, 'u1', 3)).toEqual({ ok: true, before: 2, after: 5 });
    } finally {
      console.warn = warn;
    }
    expect(writes).toEqual([['transaction', left('u1'), 5]]);
  });
});
