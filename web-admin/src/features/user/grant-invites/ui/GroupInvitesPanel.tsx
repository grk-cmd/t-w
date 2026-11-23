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
  useInvitePort,
  type GroupInvite,
  type GroupInviteUse,
  type GroupInviteState,
} from '@/entities/invite';
import { isPortError, useEnv, withProdMark } from '@/shared/api';
import { copyText, errorMessage, formatDate, keysetView, kstDateKey, useKeysetPaging } from '@/shared/lib';
import { Pager, useToast } from '@/shared/ui';
import { downloadBytes, writeXlsx } from '@/shared/sheet';
import { usesExportGrid, usesFileName, type FriendCodesOf } from '../model/usesSheet';
import { useCreateGroupInvite, useSetGroupInviteStopped } from '../model/useGrantInvites';
import styles from './GroupInvitesPanel.module.css';

const STATE_LABEL: Record<GroupInviteState, string> = {
  open: '쓰는 중',
  full: '다 참',
  expired: '마감',
  stopped: '중지',
};

// 관리자 전용 «외부인 초대장» — 코드 하나를 정한 인원까지 쓴다. 일반 사용자는 앱에서 한 명짜리를 한 장씩 만든다(그대로).
/** 가입한 사람 줄에서 하는 일 — 유저코드 복사 · 회원 정보 열기(창은 페이지가 띄운다) · 엑셀에 넣을 친구코드 찾기. */
interface UseActions {
  copy: (userCode: string) => void;
  open: (userCode: string) => void;
  friendCodes: FriendCodesOf;
}

export function GroupInvitesPanel({
  onOpenUser,
  friendCodesOf,
}: {
  onOpenUser: (userCode: string) => void;
  friendCodesOf: FriendCodesOf;
}) {
  const env = useEnv();
  const toast = useToast();
  const list = useGroupInvites(true);
  const paging = useKeysetPaging(list, 'groupInvites');
  const loaded = list.data ? keysetView(list.data.pages).items : null;
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
      {loaded && loaded.length === 0 && <p className="soft">아직 만든 코드가 없어요</p>}
      {stop.error && <p className="msg err">{errorMessage(stop.error, '바꾸지 못했어요')}</p>}
      {loaded && loaded.length > 0 && (
        <>
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
              {paging.items.map((g) => (
                <Row
                  key={g.code}
                  invite={g}
                  state={groupInviteState(g, now)}
                  busy={stop.isPending}
                  onCopy={() => copy(g.code)}
                  actions={{ copy, open: onOpenUser, friendCodes: friendCodesOf }}
                  onStop={(s) => stop.mutate({ invite: g, stop: s })}
                />
              ))}
            </tbody>
          </table>
          <Pager paging={paging} more={paging.more} />
        </>
      )}
    </section>
  );
}

const COLS = 6;

function Row({
  invite,
  state,
  busy,
  onCopy,
  actions,
  onStop,
}: {
  invite: GroupInvite;
  state: GroupInviteState;
  busy: boolean;
  onCopy: () => void;
  actions: UseActions;
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
            <Uses code={invite.code} actions={actions} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// 펼쳤을 때만 그 코드 몫을 받는다. 없는 코드(목록을 받은 뒤 지워짐)는 notFound — 문구는 서버 code 표(API_ERROR_TEXT)에서 온다. 아무도 안 쓴 코드는 빈 목록.
function Uses({ code, actions }: { code: string; actions: UseActions }) {
  const query = useGroupInviteUses(code, true);
  const paging = useKeysetPaging(query, 'groupInviteUses');
  if (query.isPending) return <p className="soft">불러오는 중…</p>;
  if (isPortError(query.error, 'notFound')) return <p className="soft">{query.error.message}</p>;
  if (query.error)
    return <p className="msg err">{errorMessage(query.error, '가입한 사람을 불러오지 못했어요')}</p>;
  if (paging.items.length === 0) return <p className="soft">이 코드로 들어온 기록이 없어요</p>;
  return (
    <>
      <ExportUses code={code} friendCodes={actions.friendCodes} />
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
          {paging.items.map((u) => (
            <UseRow key={u.n} use={u} actions={actions} />
          ))}
        </tbody>
      </table>
      <Pager paging={paging} more={paging.more} />
    </>
  );
}

// 엑셀 — 화면은 쪽으로 받지만 파일에는 전부 넣는다(누를 때만 끝까지 받는다 · 5000명이면 쪽 50번 · 친구코드는 100명씩 나눈 사용자 조회를 한꺼번에).
function ExportUses({ code, friendCodes }: { code: string; friendCodes: FriendCodesOf }) {
  const port = useInvitePort();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const grid = await usesExportGrid(port, code, friendCodes);
      downloadBytes(await writeXlsx(grid, code), usesFileName(code, kstDateKey(Date.now())));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.actions}>
      {error !== null && <span className="msg err">{errorMessage(error, '엑셀로 내보내지 못했어요')}</span>}
      <button type="button" className="btn" disabled={busy} onClick={() => void run()}>
        {busy ? '내보내는 중…' : '엑셀로 내보내기'}
      </button>
    </div>
  );
}

function UseRow({ use, actions }: { use: GroupInviteUse; actions: UseActions }) {
  const { userCode } = use;
  return (
    <tr>
      <td>{use.n}</td>
      <td>{use.joinedAt !== null ? formatDate(use.joinedAt) : <span className="soft">—</span>}</td>
      <td>
        {userCode !== null ? (
          <button type="button" className="btn" title="복사" onClick={() => actions.copy(userCode)}>
            <code className="key soft">{userCode}</code>
          </button>
        ) : (
          <span className="soft">유저코드 없음</span>
        )}
      </td>
      <td>
        {userCode !== null ? (
          <button
            type="button"
            className={styles.link}
            title="회원 정보"
            onClick={() => actions.open(userCode)}
          >
            {use.name ?? '정보 보기'}
          </button>
        ) : (
          <span className="soft">—</span>
        )}
      </td>
    </tr>
  );
}
