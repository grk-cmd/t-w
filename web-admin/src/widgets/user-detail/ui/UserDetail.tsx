import { useEffect, useRef, useState, type ReactNode } from 'react';
import { inviterKind, useIssuedInvites, useUserInvite } from '@/entities/invite';
import { REPORT_ADMIN_MIN, useUserReportCount } from '@/entities/report';
import { formatDay, secretRoomState, useUserSecretRoom } from '@/entities/secret-room';
import {
  isBadLicense,
  LICENSE_LABEL,
  realName,
  sameLicenseUsers,
  useUserBrief,
  useUserFocusSec,
  useUserName,
  useUserPresence,
  type UserRow,
} from '@/entities/user';
import { GrantInvitesButton } from '@/features/user/grant-invites';
import { copyText, formatDate, formatHours } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import styles from './UserDetail.module.css';

interface Q<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
}

// 칸마다 따로 읽으므로 로딩 · 실패도 칸마다 보인다 — 한 칸이 거부돼도 나머지는 그대로.
function Loaded<T>({ q, children }: { q: Q<T>; children: (data: T) => ReactNode }) {
  if (q.isLoading) return <span className="soft">…</span>;
  if (q.error || q.data === undefined) return <span className="soft">읽지 못함</span>;
  return <>{children(q.data)}</>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const whoOf = (r: UserRow) => r.name ?? r.friendCode ?? r.userCode;

/** 다른 사용자로 건너가는 링크 — 같은 창에서 그 사람으로 바뀐다. */
function UserLink({ row, onOpen }: { row: UserRow; onOpen: (uid: string) => void }) {
  return (
    <button type="button" className={styles.link} onClick={() => onOpen(row.userCode)}>
      {whoOf(row)}
    </button>
  );
}

// 목록에 있는 사람이면 이미 받은 이름을 쓰고, 없으면(계정 요약 · 친구코드 명단에 없음) 이름 한 칸만 읽는다.
function Inviter({ uid, rows, onOpen }: { uid: string; rows: UserRow[]; onOpen: (uid: string) => void }) {
  const known = rows.find((r) => r.userCode === uid);
  const name = useUserName(uid, !known);
  if (known) return <UserLink row={known} onOpen={onOpen} />;
  return (
    <>
      {name.isLoading ? '…' : (realName(name.data) ?? '')} <code className="key soft">{uid}</code>
    </>
  );
}

function Joined({
  invitedBy,
  rows,
  onOpen,
}: {
  invitedBy: string | null;
  rows: UserRow[];
  onOpen: (uid: string) => void;
}) {
  const kind = inviterKind(invitedBy);
  if (kind === 'existing' || !invitedBy) return <>기존</>;
  if (kind === 'admin') return <>초대 · 관리자</>;
  return (
    <>
      초대 · <Inviter uid={invitedBy} rows={rows} onOpen={onOpen} />
    </>
  );
}

// 이 사람이 만든 초대 코드 → 그 코드로 들어온 사람. 쓴 사람만 이름으로, 나머지는 개수로.
function Invitees({ uid, rows, onOpen }: { uid: string; rows: UserRow[]; onOpen: (uid: string) => void }) {
  const issued = useIssuedInvites(uid);
  return (
    <Loaded q={issued}>
      {(list) => {
        if (!list.length) return <>없음</>;
        const used = list.filter((i) => i.usedBy);
        const pending = list.filter((i) => i.pending).length;
        const unused = list.length - used.length - pending;
        return (
          <span className={styles.invitees}>
            {used.map((i) => (
              <Inviter key={i.code} uid={i.usedBy!} rows={rows} onOpen={onOpen} />
            ))}
            <small className="soft">
              코드 {list.length}개{pending ? ` · 가입 중 ${pending}` : ''}
              {unused ? ` · 안 씀 ${unused}` : ''}
            </small>
          </span>
        );
      }}
    </Loaded>
  );
}

function Presence({ uid }: { uid: string }) {
  const q = useUserPresence(uid);
  return (
    <Loaded q={q}>
      {(p) =>
        p?.online ? (
          <span className={styles.online}>접속 중{p.room && <code className="key"> · {p.room}</code>}</span>
        ) : p?.lastSeen ? (
          formatDate(p.lastSeen)
        ) : (
          '—'
        )
      }
    </Loaded>
  );
}

function PresenceVer({ uid }: { uid: string }) {
  const q = useUserPresence(uid);
  return <Loaded q={q}>{(p) => p?.ver ?? <span className="soft">기록 없음</span>}</Loaded>;
}

function SecretRoom({ uid }: { uid: string }) {
  const q = useUserSecretRoom(uid);
  const [now] = useState(Date.now);
  return (
    <Loaded q={q}>
      {(info) => {
        if (!info) return '—';
        const s = secretRoomState(info.pub, uid, now);
        return (
          <>
            <code className="key">{info.code}</code>
            {s.kind === 'active' && <small>{s.exp ? `${formatDay(s.exp)} 까지` : '영구'}</small>}
            {s.kind === 'expired' && <small className="warn">만료 · {formatDay(s.exp)}</small>}
            {s.kind === 'not-owner' && (
              <small className="warn">{s.owner ? '다른 사람에게 넘어감' : '발급 기록 없음'}</small>
            )}
          </>
        );
      }}
    </Loaded>
  );
}

function Body({ row, rows, onOpen }: Omit<Props, 'onClose' | 'row'> & { row: UserRow }) {
  const uid = row.userCode;
  const toast = useToast();
  const brief = useUserBrief(uid);
  const focus = useUserFocusSec(uid);
  const invite = useUserInvite(uid);
  const reports = useUserReportCount(uid);
  const same = sameLicenseUsers(rows, row);
  const name = row.name ?? realName(brief.data?.name);
  const who = name ?? row.friendCode ?? uid;

  const copy = async () => toast((await copyText(uid)) ? '사용자코드를 복사했어요' : '복사하지 못했어요');

  return (
    <>
      <h3>기본</h3>
      <dl className={styles.fields}>
        <Field label="이름">
          {name ?? <span className="soft">{brief.isLoading ? '…' : '이름 없음'}</span>}
        </Field>
        <Field label="친구코드">
          <code className="key">{row.friendCode ?? '—'}</code>
        </Field>
        <Field label="사용자코드">
          <code className="key">{uid}</code>
          <button type="button" className="btn" onClick={copy}>
            복사
          </button>
        </Field>
        <Field label="계정">{row.hasAccount ? '있음' : '없음'}</Field>
      </dl>

      <h3>라이선스</h3>
      <dl className={styles.fields}>
        <Field label="키">
          {row.license && <code className="key">{row.license}</code>}
          <small className={isBadLicense(row.licenseState) ? 'warn' : 'soft'}>
            {LICENSE_LABEL[row.licenseState]}
          </small>
        </Field>
        {row.license && (
          <Field label="같은 키">
            {same.length === 0 ? (
              <span className="soft">없음</span>
            ) : (
              <>
                <b className="warn">{same.length}명</b>
                {same.map((r) => (
                  <UserLink key={r.userCode} row={r} onOpen={onOpen} />
                ))}
              </>
            )}
          </Field>
        )}
      </dl>

      <h3>활동</h3>
      <dl className={styles.fields}>
        <Field label="마지막 접속">
          <Presence uid={uid} />
        </Field>
        <Field label="앱 버전">
          {/* 목록은 계정 요약 값, 여기는 presence 값 — 계정이 없어도 0.10.3 부터는 보인다. */}
          <PresenceVer uid={uid} />
        </Field>
        <Field label="집중">
          {/* 계정 요약 값은 앱이 올린 때의 값이라, 기기끼리 합친 정본(focus/totalSec)을 따로 읽는다. */}
          <Loaded q={focus}>{(sec) => formatHours(sec)}</Loaded>
        </Field>
      </dl>

      <h3>가입</h3>
      <dl className={styles.fields}>
        {invite.data ? (
          <>
            <Field label="가입일">{invite.data.joinedAt ? formatDate(invite.data.joinedAt) : '—'}</Field>
            <Field label="경로">
              <Joined invitedBy={invite.data.invitedBy} rows={rows} onOpen={onOpen} />
            </Field>
            <Field label="초대권">
              {invite.data.invitesLeft === null ? '—' : `${invite.data.invitesLeft}장`}
              <GrantInvitesButton uid={uid} who={who} />
            </Field>
            <Field label="초대한 사람">
              <Invitees uid={uid} rows={rows} onOpen={onOpen} />
            </Field>
          </>
        ) : (
          // 칸이 없으면 아직 게이트를 안 지난(옛 앱) 사용자 — 지급 대상도 아니다.
          <Field label="가입">
            <Loaded q={invite}>{() => <span className="soft">기록 없음</span>}</Loaded>
          </Field>
        )}
      </dl>

      <h3>신고</h3>
      <dl className={styles.fields}>
        <Field label="받은 신고">
          <Loaded q={reports}>
            {(n) => <span className={n >= REPORT_ADMIN_MIN ? 'warn' : undefined}>{n}명</span>}
          </Loaded>
        </Field>
        <Field label="자리비움 그림">
          <Loaded q={brief}>
            {(b) =>
              b.awayImg ? (
                <a
                  className={styles.thumb}
                  href={b.awayImg}
                  target="_blank"
                  rel="noreferrer"
                  title="원본 크게 보기"
                >
                  <img src={b.awayImg} alt={`${who} 님의 자리비움 그림`} />
                </a>
              ) : (
                <span className="soft">없음</span>
              )
            }
          </Loaded>
        </Field>
      </dl>

      <h3>시크릿룸</h3>
      <dl className={styles.fields}>
        <Field label="코드">
          <SecretRoom uid={uid} />
        </Field>
      </dl>
    </>
  );
}

interface Props {
  /** 열 사람. null 이면 닫힌다. */
  row: UserRow | null;
  /** 같은 키 · 초대한 사람을 찾아 이름을 붙이는 데 쓰는 전체 목록(이미 받은 것). */
  rows: UserRow[];
  /** 같은 키를 쓰는 사람 · 초대한 사람을 누르면 그 사람으로 바꾼다. */
  onOpen: (uid: string) => void;
  onClose: () => void;
}

/** 한 사람을 한 화면에 — 창을 열 때만, 그 사람 몫의 작은 칸들만 읽는다(users/{uid} 통째는 마이홈 · 캐릭터까지 딸려 와 크다). */
export function UserDetail({ row, rows, onOpen, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = row !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const title = row ? `${whoOf(row)} 상세` : '사용자 상세';

  return (
    <dialog
      ref={ref}
      className={styles.panel}
      aria-label={title}
      // 안에 있는 초대권 지급 창이 닫힐 때의 close 가 React 트리를 타고 올라온다 — 이 창 자신의 것만 받는다.
      onClose={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.head}>
        <h2>{row ? (row.name ?? row.friendCode ?? row.userCode) : ''}</h2>
        <button type="button" className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
      {row && <Body key={row.userCode} row={row} rows={rows} onOpen={onOpen} />}
    </dialog>
  );
}
