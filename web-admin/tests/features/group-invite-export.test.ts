// @vitest-environment jsdom
// 만든 엑셀을 다시 읽어 보는 시험 — xlsx 읽기가 브라우저 DOMParser 를 써서 jsdom 에서 돈다.
import { describe, expect, it } from 'vitest';
import {
  GROUP_INVITE_MAX_USES,
  listAllGroupInviteUses,
  type GroupInviteUse,
  type InvitePort,
} from '@/entities/invite';
import {
  friendCodesFromRows,
  usesExportGrid,
  usesFileName,
  usesSheet,
  USES_SHEET_HEAD,
} from '@/features/user/grant-invites/model/usesSheet';
import { formatDate } from '@/shared/lib';
import { readXlsx, writeXlsx } from '@/shared/sheet';

const mk = (n: number, over: Partial<GroupInviteUse> = {}): GroupInviteUse => ({
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
        mk(from + i + 1),
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

  it('시트 — 머리 줄 + 사람마다 한 줄 · 친구코드는 유저코드로 찾은 값 · 없는 값 · 못 찾은 사람 · 옛 «(이름 없음)» 은 빈 칸', () => {
    const t = Date.parse('2026-10-27T02:28:00Z');
    const friends = new Map<string, string | null>([
      ['umvq000000001', 'MATE-AAAA'],
      ['umvq000000003', null],
    ]);
    expect(
      usesSheet(
        [
          mk(1, { joinedAt: t }),
          mk(2, { joinedAt: null, userCode: null, name: null }),
          mk(3, { name: '(이름 없음)' }),
          mk(4),
        ],
        friends,
      ),
    ).toEqual([
      USES_SHEET_HEAD,
      ['1', formatDate(t), 'umvq000000001', 'MATE-AAAA', '사람1'],
      ['2', '', '', '', ''],
      ['3', formatDate(mk(3).joinedAt!), 'umvq000000003', '', ''],
      ['4', formatDate(mk(4).joinedAt!), 'umvq000000004', '', '사람4'],
    ]);
    expect(USES_SHEET_HEAD).toEqual(['번호', '들어온 시각', '유저코드', '친구코드', '닉네임']);
    expect(usesSheet([], new Map())).toEqual([USES_SHEET_HEAD]);
    expect(usesFileName('INVT-FZFJ-6H5J', '2026-11-23')).toBe(
      '외부인초대장_INVT-FZFJ-6H5J_가입자_2026-11-23.xlsx',
    );
  });

  it('만든 엑셀을 다시 읽으면 같은 칸이 나온다', async () => {
    const grid = usesSheet(
      [mk(1), mk(2, { userCode: null, name: null })],
      new Map([['umvq000000001', 'MATE-AAAA']]),
    );
    const back = await readXlsx((await writeXlsx(grid, 'INVT-FZFJ-6H5J')).slice().buffer);
    expect(back[0]).toEqual(USES_SHEET_HEAD);
    expect(back[1]).toEqual(grid[1]);
    expect(back[2].slice(0, 1)).toEqual(['2']);
  });

  it('내보내기 — 유저코드가 있는 사람만 모아 친구코드를 한 번에 묻고 그 값을 친구코드 칸에 넣는다(590명)', async () => {
    const base = pagedPort(590).port;
    const port: Pick<InvitePort, 'uses'> = {
      uses: async (code, cursor, limit) => {
        const page = await base.uses(code, cursor, limit);
        return { ...page, items: page.items.map((u) => (u.n % 100 === 7 ? { ...u, userCode: null } : u)) };
      },
    };
    const asked: (readonly string[])[] = [];
    const grid = await usesExportGrid(port, 'INVT-AAAA-AAAA', async (codes) => {
      asked.push(codes);
      return new Map(codes.map((c) => [c, 'MATE-' + c.slice(-4)] as const));
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(590 - 6);
    expect(asked[0]).not.toContain(null);
    expect(grid).toHaveLength(591);
    expect(grid[1]).toEqual(['1', formatDate(mk(1).joinedAt!), 'umvq000000001', 'MATE-0001', '사람1']);
    expect(grid[7].slice(2, 4)).toEqual(['', '']);
  });

  it('내보내기 — 유저코드가 하나도 없으면 친구코드를 묻지 않는다 · 친구코드를 못 받으면 던진다', async () => {
    const noCodes: Pick<InvitePort, 'uses'> = {
      uses: async () => ({
        items: [mk(1, { userCode: null }), mk(2, { userCode: null })],
        nextCursor: null,
        total: 2,
      }),
    };
    let calls = 0;
    const grid = await usesExportGrid(noCodes, 'INVT-AAAA-AAAA', async () => {
      calls++;
      return new Map();
    });
    expect(calls).toBe(0);
    expect(grid).toHaveLength(3);

    await expect(
      usesExportGrid(pagedPort(3).port, 'INVT-AAAA-AAAA', async () => {
        throw new Error('조회 실패');
      }),
    ).rejects.toThrow('조회 실패');
  });

  it('사용자 조회 결과 → 친구코드 — 줄의 friendCode 를 쓴다(유저코드가 아니다) · null 은 그대로', () => {
    const rows = new Map([
      ['umvq000000001', { userCode: 'umvq000000001', friendCode: 'MATE-ANY5' }],
      ['umvq000000002', { userCode: 'umvq000000002', friendCode: null }],
    ]);
    expect([...friendCodesFromRows(rows)]).toEqual([
      ['umvq000000001', 'MATE-ANY5'],
      ['umvq000000002', null],
    ]);
  });
});
