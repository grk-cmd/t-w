import { describe, expect, it } from 'vitest';
import {
  checkMaintenance,
  maintenanceConfirmText,
  toDraft,
  toLocalInput,
} from '@/features/settings/edit-maintenance';

const off = { on: false, endsAt: null, message: null };

describe('점검 안내 입력', () => {
  it('지금 값과 같으면 저장하지 않는다', () => {
    expect(checkMaintenance(off, toDraft(off))).toEqual({ ok: false, error: '지금 값과 같음' });
  });

  it('끝나는 시각은 비워 둘 수 있고, 켜면 on 만 바뀐다', () => {
    const r = checkMaintenance(off, { on: true, endsAt: '', message: '' });
    expect(r).toEqual({ ok: true, next: { on: true, endsAt: null, message: null } });
  });

  it('시각은 ISO 로, 문구는 앞뒤 빈칸을 떼고 빈 글은 null 로', () => {
    const r = checkMaintenance(off, { on: true, endsAt: '2026-11-20T03:00', message: '  점검 중  ' });
    if (!r.ok) throw new Error(r.error);
    expect(new Date(r.next.endsAt!).getTime()).toBe(new Date('2026-11-20T03:00').getTime());
    expect(r.next.message).toBe('점검 중');
  });

  it('문구가 200자를 넘으면 막는다', () => {
    const r = checkMaintenance(off, { on: true, endsAt: '', message: 'a'.repeat(201) });
    expect(r.ok).toBe(false);
  });

  it('서버가 준 시각을 입력 칸 값으로 되돌리면 같은 시각이다', () => {
    const iso = new Date('2026-11-20T03:00').toISOString();
    expect(toLocalInput(iso)).toBe('2026-11-20T03:00');
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('엉터리')).toBe('');
  });

  it('확인 창 글', () => {
    expect(maintenanceConfirmText(off)).toContain('꺼요');
    expect(maintenanceConfirmText({ on: true, endsAt: null, message: '점검' })).toContain('문구: 점검');
  });
});
