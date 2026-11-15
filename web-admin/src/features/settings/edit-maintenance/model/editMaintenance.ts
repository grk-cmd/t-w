import { useMutation } from '@tanstack/react-query';
import {
  MAINTENANCE_MESSAGE_MAX,
  useOpsConfigPort,
  useRefreshOpsConfig,
  type Maintenance,
} from '@/entities/server/ops-config';
import { refreshOnConflict } from '@/shared/api';

/** 입력 칸 — 시각은 `<input type="datetime-local">` 의 값(이 브라우저의 시간대) 그대로. */
export interface MaintenanceDraft {
  on: boolean;
  endsAt: string;
  message: string;
}

type Check<T> = { ok: true; next: T } | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** 서버가 준 ISO 시각 → datetime-local 값(이 브라우저 시간대). 없으면 ''. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const toDraft = (saved: Maintenance): MaintenanceDraft => ({
  on: saved.on,
  endsAt: toLocalInput(saved.endsAt),
  message: saved.message ?? '',
});

/** 저장해도 되는지 — 끝나는 시각은 비워 둘 수 있다(서버는 시각 없이도 켜진다). 같은 값이면 저장하지 않는다. */
export function checkMaintenance(saved: Maintenance, draft: MaintenanceDraft): Check<Maintenance> {
  const message = draft.message.trim();
  if (message.length > MAINTENANCE_MESSAGE_MAX) {
    return { ok: false, error: `문구는 ${MAINTENANCE_MESSAGE_MAX}자까지예요` };
  }
  let endsAt: string | null = null;
  if (draft.endsAt) {
    const d = new Date(draft.endsAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: '끝나는 시각이 올바르지 않아요' };
    endsAt = d.toISOString();
  }
  const next: Maintenance = { on: draft.on, endsAt, message: message || null };
  const same =
    next.on === saved.on &&
    next.message === (saved.message ?? null) &&
    toLocalInput(next.endsAt) === toLocalInput(saved.endsAt);
  if (same) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

export function maintenanceConfirmText(next: Maintenance): string {
  if (!next.on) return '점검 안내를 꺼요 — 앱에서 점검 안내가 사라져요.';
  const until = next.endsAt ? `${toLocalInput(next.endsAt).replace('T', ' ')} 까지` : '끝나는 시각 없이';
  return `점검 안내를 켜요(${until}) — 앱 전부에 바로 점검 안내가 떠요.${
    next.message ? `\n문구: ${next.message}` : ''
  }`;
}

export function useSaveMaintenance() {
  const { maintenance } = useOpsConfigPort();
  const refresh = useRefreshOpsConfig();
  return useMutation({
    mutationFn: (next: Maintenance) => (maintenance as NonNullable<typeof maintenance>).save(next),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
