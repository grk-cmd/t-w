// @vitest-environment jsdom
// 만든 엑셀을 다시 읽어 보는 시험 — xlsx 읽기가 브라우저 DOMParser 를 써서 jsdom 에서 돈다.
import { describe, expect, it } from 'vitest';
import {
  GROUP_INVITE_MAX_USES,
  listAllGroupInviteUses,
  type GroupInviteUse,
  type InvitePort,
} from '@/entities/invite';
import { usesFileName, usesSheet, USES_SHEET_HEAD } from '@/features/user/grant-invites/model/usesSheet';
import { formatDate } from '@/shared/lib';
import { readXlsx, writeXlsx } from '@/shared/sheet';

const use = (n: number, over: Partial<GroupInviteUse> = {}): GroupInviteUse => ({
  n,
  joinedAt: Date.parse('2026-10-27T02:28:00Z') + n * 1000,
  userCode: `umvq${String(n).padStart(9, '0')}`,
  name: `사람${n}`,
  ...over,
});

/** 쪽마다 limit 개씩 주는 가짜 포트 — 부른 커서를 남긴다. */
function pagedPort(total: number, endless = false, trailingEmpty = false) {
  const cursors: (string | undefined)[] = [];
  const port: Pick<InvitePort, 'uses'> = {
    uses: async (_code, cursor, limit) => {
      cursors.push(cursor);
      const from = cursor === undefined ? 0 : Number(cursor);
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) =>
        use(from + i + 1),
      );
      const next = from + limit;
      return {
        items,
        nextCursor: endless || next < total || (trailingEmpty && from < total) ? String(next) : null,
        total: cursor === undefined ? total : null,
      };
    },
  };
  return { port, cursors };
}

describe('외부인 초대장 가입한 사람 — 엑셀 내보내기', () => {
  it('쪽을 끝까지 넘겨 전부 모은다 · 딱 맞는 끝 · 빈 코드', async () => {
    const a = pagedPort(250);
    const all = await listAllGroupInviteUses(a.port, 'INVT-AAAA-AAAA', 100);
    expect(all.map((u) => u.n)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
    expect(a.cursors).toEqual([undefined, '100', '200']);

    const b = pagedPort(200);
    expect(await listAllGroupInviteUses(b.port, 'INVT-AAAA-AAAA', 100)).toHaveLength(200);
    expect(b.cursors).toEqual([undefined, '100']);

    const c = pagedPort(0);
    expect(await listAllGroupInviteUses(c.port, 'INVT-AAAA-AAAA', 100)).toEqual([]);
  });

  it('상한 경계 — 인원 상한을 꽉 채운 코드는 받는다(끝에 빈 쪽이 한 번 더 와도) · 넘치면 던진다 · 쪽 크기를 줄여도 같다', async () => {
    const full = await listAllGroupInviteUses(
      pagedPort(GROUP_INVITE_MAX_USES, false, true).port,
      'INVT-AAAA-AAAA',
    );
    expect(full).toHaveLength(GROUP_INVITE_MAX_USES);
    await expect(
      listAllGroupInviteUses(pagedPort(GROUP_INVITE_MAX_USES + 200).port, 'INVT-AAAA-AAAA'),
    ).rejects.toThrow('끝나지 않아요');
    expect(
      await listAllGroupInviteUses(pagedPort(GROUP_INVITE_MAX_USES, false, true).port, 'INVT-AAAA-AAAA', 10),
    ).toHaveLength(GROUP_INVITE_MAX_USES);
  });

  it('서버가 커서를 끝내지 않으면 상한에서 멈추고 던진다', async () => {
    const e = pagedPort(10, true);
    await expect(listAllGroupInviteUses(e.port, 'INVT-AAAA-AAAA', 100)).rejects.toThrow('끝나지 않아요');
    expect(e.cursors.length).toBeLessThanOrEqual(52);
  });

  it('시트 — 머리 줄 + 사람마다 한 줄 · 없는 값은 빈 칸 · 옛 «(이름 없음)» 은 빈 칸', () => {
    const t = Date.parse('2026-10-27T02:28:00Z');
    expect(
      usesSheet([
        use(1, { joinedAt: t }),
        use(2, { joinedAt: null, userCode: null, name: null }),
        use(3, { name: '(이름 없음)' }),
      ]),
    ).toEqual([
      USES_SHEET_HEAD,
      ['1', formatDate(t), 'umvq000000001', '사람1'],
      ['2', '', '', ''],
      ['3', formatDate(use(3).joinedAt!), 'umvq000000003', ''],
    ]);
    expect(usesSheet([])).toEqual([USES_SHEET_HEAD]);
    expect(usesFileName('INVT-FZFJ-6H5J', '2026-11-23')).toBe(
      '외부인초대장_INVT-FZFJ-6H5J_가입자_2026-11-23.xlsx',
    );
  });

  it('만든 엑셀을 다시 읽으면 같은 칸이 나온다', async () => {
    const grid = usesSheet([use(1), use(2, { userCode: null, name: null })]);
    const back = await readXlsx((await writeXlsx(grid, 'INVT-FZFJ-6H5J')).slice().buffer);
    expect(back[0]).toEqual(USES_SHEET_HEAD);
    expect(back[1]).toEqual(grid[1]);
    expect(back[2].slice(0, 1)).toEqual(['2']);
  });
});
