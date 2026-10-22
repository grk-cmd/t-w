import { useState } from 'react';
import {
  endOfDay,
  GROUP_INVITE_MAX_USES,
  GROUP_INVITE_NOTE_MAX,
  groupInviteState,
  isGroupMaxUses,
  lastDay,
  useGroupInvites,
  type GroupInvite,
  type GroupInviteState,
} from '@/entities/invite';
import { useEnv, withProdMark } from '@/shared/api';
import { copyText, errorMessage, formatDate, kstDateKey } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCreateGroupInvite, useSetGroupInviteStopped } from '../model/useGrantInvites';
import styles from './GroupInvitesPanel.module.css';

const STATE_LABEL: Record<GroupInviteState, string> = {
  open: '쓰는 중',
  full: '다 참',
  expired: '마감',
  stopped: '중지',
};

// 관리자 전용 «외부인 초대장» — 코드 하나를 정한 인원까지 쓴다. 일반 사용자는 앱에서 한 명짜리를 한 장씩 만든다(그대로).
export function GroupInvitesPanel() {
  const env = useEnv();
  const toast = useToast();
  const list = useGroupInvites(true);
  const create = useCreateGroupInvite();
  const stop = useSetGroupInviteStopped();
  const [maxUses, setMaxUses] = useState(100);
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  // 날짜 칸 하한은 화면을 열 때 · 상태(마감)는 목록을 받은 시각 기준
  const [openedAt] = useState(() => Date.now());
  const now = list.dataUpdatedAt || openedAt;

  const copy = async (code: string) => toast((await copyText(code)) ? '복사했어요' : '복사하지 못했어요');
  const submit = () => create.mutate({ maxUses, expiresAt: endOfDay(until), note });
  const valid = isGroupMaxUses(maxUses);

  return (
    <section className="card">
      <h2>{withProdMark(env, '외부인 초대장 — 인원 제한 코드')}</h2>
      <p className="soft">
        코드 하나를 정한 인원까지 쓸 수 있어요. 마감 날짜를 정하면 그날 밤 12시(서울)까지예요. 0.12.0 이상
        앱에서만 쓸 수 있어요.
      </p>
      <div className={styles.form}>
        <label>
          인원
          <input
            type="number"
            min={1}
            max={GROUP_INVITE_MAX_USES}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.floor(Number(e.target.value)))}
          />
          <small className="soft">최대 {GROUP_INVITE_MAX_USES}명</small>
        </label>
        <label>
          마감 날짜
          <input
            type="date"
            value={until}
            min={kstDateKey(openedAt)}
            onChange={(e) => setUntil(e.target.value)}
          />
          <small className="soft">비우면 마감 없음</small>
        </label>
        <label>
          메모
          <input
            type="text"
            value={note}
            maxLength={GROUP_INVITE_NOTE_MAX}
            placeholder="예) 10월 신규 모집"
            onChange={(e) => setNote(e.target.value)}
          />
          <small className="soft">코드를 받은 사람도 볼 수 있어요 — 개인 정보는 적지 않아요</small>
        </label>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn primary" disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? '만드는 중…' : `${valid ? maxUses : '?'}명 코드 만들기`}
        </button>
      </div>
      {create.data && (
        <p className="msg">
          만든 코드 <code className="key">{create.data}</code>{' '}
          <button type="button" className="btn" onClick={() => copy(create.data)}>
            복사
          </button>
        </p>
      )}
      {create.error && <p className="msg err">{errorMessage(create.error, '코드를 만들지 못했어요')}</p>}

      <h3 className={styles.sub}>만든 코드</h3>
      {list.isPending && <p className="soft">불러오는 중…</p>}
      {list.error && <p className="msg err">{errorMessage(list.error, '목록을 불러오지 못했어요')}</p>}
      {list.data && list.data.length === 0 && <p className="soft">아직 만든 코드가 없어요</p>}
      {stop.error && <p className="msg err">{errorMessage(stop.error, '바꾸지 못했어요')}</p>}
      {list.data && list.data.length > 0 && (
        <table className={styles.table} aria-label="만든 외부인 초대장">
          <thead>
            <tr>
              <th>코드</th>
              <th>메모</th>
              <th>쓴 사람</th>
              <th>마감</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data.map((g) => (
              <Row
                key={g.code}
                invite={g}
                state={groupInviteState(g, now)}
                busy={stop.isPending}
                onCopy={() => copy(g.code)}
                onStop={(s) => stop.mutate({ invite: g, stop: s })}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Row({
  invite,
  state,
  busy,
  onCopy,
  onStop,
}: {
  invite: GroupInvite;
  state: GroupInviteState;
  busy: boolean;
  onCopy: () => void;
  onStop: (stop: boolean) => void;
}) {
  return (
    <tr>
      <td>
        <button type="button" className="btn" title="복사" onClick={onCopy}>
          <code className="key">{invite.code}</code>
        </button>
      </td>
      <td>{invite.note || <span className="soft">—</span>}</td>
      <td>
        {invite.usedCount} / {invite.maxUses}명
      </td>
      <td title={invite.createdAt !== null ? `만든 날 ${formatDate(invite.createdAt)}` : undefined}>
        {invite.expiresAt !== null ? `${lastDay(invite.expiresAt)}까지` : <span className="soft">없음</span>}
      </td>
      <td>{STATE_LABEL[state]}</td>
      <td>
        <button type="button" className="btn" disabled={busy} onClick={() => onStop(state !== 'stopped')}>
          {state === 'stopped' ? '다시 열기' : '중지'}
        </button>
      </td>
    </tr>
  );
}
