import { Fragment, useState } from 'react';
import {
  endOfDay,
  GROUP_INVITE_MAX_USES,
  GROUP_INVITE_NOTE_MAX,
  groupInviteState,
  isGroupMaxUses,
  lastDay,
  useGroupInviteUses,
  useGroupInvites,
  type GroupInvite,
  type GroupInviteUse,
  type GroupInviteState,
} from '@/entities/invite';
import { realName, useUserName } from '@/entities/user';
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
                onCopyUid={copy}
                onStop={(s) => stop.mutate({ invite: g, stop: s })}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** 이름을 한 사람씩 읽으니(users/{uid}/profile/name) 한 번에 이만큼만 펼친다. */
const USES_PAGE = 50;
const COLS = 6;

function Row({
  invite,
  state,
  busy,
  onCopy,
  onCopyUid,
  onStop,
}: {
  invite: GroupInvite;
  state: GroupInviteState;
  busy: boolean;
  onCopy: () => void;
  onCopyUid: (uid: string) => void;
  onStop: (stop: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <tr>
        <td>
          <button type="button" className="btn" title="복사" onClick={onCopy}>
            <code className="key">{invite.code}</code>
          </button>
        </td>
        <td>{invite.note || <span className="soft">—</span>}</td>
        <td>
          {invite.usedCount} / {invite.maxUses}명{' '}
          <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? '접기' : '가입한 사람'}
          </button>
        </td>
        <td title={invite.createdAt !== null ? `만든 날 ${formatDate(invite.createdAt)}` : undefined}>
          {invite.expiresAt !== null ? (
            `${lastDay(invite.expiresAt)}까지`
          ) : (
            <span className="soft">없음</span>
          )}
        </td>
        <td>{STATE_LABEL[state]}</td>
        <td>
          <button type="button" className="btn" disabled={busy} onClick={() => onStop(state !== 'stopped')}>
            {state === 'stopped' ? '다시 열기' : '중지'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLS} className={styles.uses}>
            <Uses code={invite.code} onCopyUid={onCopyUid} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// 0.13.0 부터 가입은 서버(POST /v2/users)가 받아 앱이 groupInviteUses 를 쓰지 않는다 — 서버가 남기기 전까지 이 목록엔 0.12.x 앱 가입자만 있다.
function Uses({ code, onCopyUid }: { code: string; onCopyUid: (uid: string) => void }) {
  const uses = useGroupInviteUses(code, true);
  const [shown, setShown] = useState(USES_PAGE);
  if (uses.isPending) return <p className="soft">불러오는 중…</p>;
  if (uses.error)
    return <p className="msg err">{errorMessage(uses.error, '가입한 사람을 불러오지 못했어요')}</p>;
  const note = (
    <p className="soft">
      0.12.x 앱으로 가입한 사람만 보여요. 0.13.0 이상 앱 가입은 서버가 받아 아직 여기에 남지 않아요.
      유저코드는 가입을 마친 뒤에 남겨서 빠진 줄이 있을 수 있어요.
    </p>
  );
  if (uses.data.length === 0)
    return (
      <>
        <p className="soft">이 코드로 들어온 기록이 없어요</p>
        {note}
      </>
    );
  return (
    <>
      {note}
      <table className={styles.table} aria-label={`${code} 로 가입한 사람`}>
        <thead>
          <tr>
            <th>번호</th>
            <th>들어온 시각</th>
            <th>유저코드</th>
            <th>이름</th>
          </tr>
        </thead>
        <tbody>
          {uses.data.slice(0, shown).map((u) => (
            <UseRow key={u.n} use={u} onCopyUid={onCopyUid} />
          ))}
        </tbody>
      </table>
      {uses.data.length > shown && (
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => setShown(shown + USES_PAGE)}>
            더 보기 ({uses.data.length - shown}명 남음)
          </button>
        </div>
      )}
    </>
  );
}

function UseRow({ use, onCopyUid }: { use: GroupInviteUse; onCopyUid: (uid: string) => void }) {
  const name = useUserName(use.uid ?? '', use.uid !== null);
  return (
    <tr>
      <td>{use.n}</td>
      <td>{use.at !== null ? formatDate(use.at) : <span className="soft">—</span>}</td>
      <td>
        {use.uid !== null ? (
          <button type="button" className="btn" title="복사" onClick={() => onCopyUid(use.uid!)}>
            <code className="key soft">{use.uid}</code>
          </button>
        ) : (
          <span className="soft">유저코드 없음</span>
        )}
      </td>
      <td>{use.uid === null ? <span className="soft">—</span> : nameCell(name)}</td>
    </tr>
  );
}

function nameCell(q: { isPending: boolean; data?: string | null }) {
  if (q.isPending) return <span className="soft">…</span>;
  return realName(q.data) ?? <span className="soft">(이름 없음)</span>;
}
