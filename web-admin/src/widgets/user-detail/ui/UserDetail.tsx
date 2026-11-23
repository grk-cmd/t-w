import { useState, type ReactNode } from 'react';
import { inviterKind } from '@/entities/invite';
import { REPORT_ADMIN_MIN, useUserReportCount } from '@/entities/report';
import { formatDay, secretRoomState, useUserSecretRoom } from '@/entities/secret-room';
import {
  currentVer,
  isBadLicense,
  ONLINE_UNKNOWN_LABEL,
  onlineUnknownText,
  LICENSE_LABEL,
  useUserBrief,
  useInvitees,
  useIssuedInvites,
  useUserDetail,
  useUserFocusSec,
  useUserInvite,
  useUserName,
  useUserPort,
  useUserPresence,
  verLabel,
  type UserDetail as UserDetailView,
  type UserRow,
} from '@/entities/user';
import { DeleteAccountButton } from '@/features/user/delete-account';
import { ResetPasswordButton } from '@/features/user/reset-password';
import { GrantInvitesButton } from '@/features/user/grant-invites';
import { useSameLicenseUsers, useUserByCode, useUsersByCode } from '@/features/user/user-rows';
import { copyText, formatDate, formatHours, realName, useKeysetPaging } from '@/shared/lib';
import { Pager, PersonName, useModalDialog, useToast } from '@/shared/ui';
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

function Section({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`${styles.section} ${danger ? styles.danger : ''}`}>
      <h3>{title}</h3>
      <dl className={styles.fields}>{children}</dl>
    </section>
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

// 사용자 목록에 있는 사람이면(사용자코드로 한 줄 찾기) 링크로, 없으면(계정 요약 · 친구코드 명단에 없음) 이름 한 칸만 읽는다.
function Inviter({ uid, onOpen }: { uid: string; onOpen: (uid: string) => void }) {
  const found = useUserByCode(uid);
  const known = found.data ?? null;
  const name = useUserName(uid, !found.isLoading && !known);
  if (found.isLoading) return <>…</>;
  if (known) return <UserLink row={known} onOpen={onOpen} />;
  return (
    <>
      {name.isLoading ? '…' : (realName(name.data) ?? '')} <code className="key soft">{uid}</code>
    </>
  );
}

function Joined({ invitedBy, onOpen }: { invitedBy: string | null; onOpen: (uid: string) => void }) {
  const kind = inviterKind(invitedBy);
  if (kind === 'existing' || !invitedBy) return <>기존</>;
  if (kind === 'admin') return <>초대 · 관리자</>;
  return (
    <>
      초대 · <Inviter uid={invitedBy} onOpen={onOpen} />
    </>
  );
}

// 이 사람이 만든 초대 코드 → 그 코드로 들어온 사람. 쓴 사람만 이름으로, 나머지는 개수로.
function Invitees({ uid, onOpen }: { uid: string; onOpen: (uid: string) => void }) {
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
              <Inviter key={i.code} uid={i.usedBy!} onOpen={onOpen} />
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

function PresenceVer({ row }: { row: UserRow }) {
  const q = useUserPresence(row.userCode);
  return (
    <Loaded q={q}>
      {(p) => {
        const v = currentVer(p, row);
        return v.ver ?? <span className="soft">{verLabel(v)}</span>;
      }}
    </Loaded>
  );
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

/** 머리 부분 — 이름 아래 한눈에 보는 상태 표시(접속 · 계정 · 라이선스 · 신고). */
function Badges({ row }: { row: UserRow }) {
  const presence = useUserPresence(row.userCode);
  const reports = useUserReportCount(row.userCode);
  const online = presence.data?.online;
  return (
    <div className={styles.badges}>
      {online ? (
        <span className={`${styles.badge} ${styles.badgeOk}`}>● 접속 중</span>
      ) : (
        <span className={styles.badge}>오프라인</span>
      )}
      <span className={`${styles.badge} ${row.hasAccount ? styles.badgeOk : ''}`}>
        {row.hasAccount ? '계정 있음' : '계정 없음'}
      </span>
      {row.license && (
        <span
          className={`${styles.badge} ${isBadLicense(row.licenseState) ? styles.badgeWarn : styles.badgeAccent}`}
        >
          라이선스 · {LICENSE_LABEL[row.licenseState]}
        </span>
      )}
      {!!reports.data && (
        <span className={`${styles.badge} ${reports.data >= REPORT_ADMIN_MIN ? styles.badgeWarn : ''}`}>
          신고 {reports.data}명
        </span>
      )}
    </div>
  );
}

function FirebaseBody({ row, onOpen, onDeleted }: Omit<Props, 'onClose' | 'row'> & { row: UserRow }) {
  const uid = row.userCode;
  const toast = useToast();
  const brief = useUserBrief(uid);
  const focus = useUserFocusSec(uid);
  const invite = useUserInvite(uid);
  const reports = useUserReportCount(uid);
  const same = useSameLicenseUsers(row);
  const name = row.name ?? realName(brief.data?.name);
  const who = name ?? row.friendCode ?? uid;

  const copy = async () => toast((await copyText(uid)) ? '사용자코드를 복사했어요' : '복사하지 못했어요');

  return (
    <>
      <Section title="계정 정보">
        <Field label="이름">
          {brief.isLoading && !name ? <span className="soft">…</span> : <PersonName name={name} />}
        </Field>
        <Field label="친구코드">
          <code className="key">{row.friendCode ?? '—'}</code>
        </Field>
        <Field label="사용자코드">
          <code className="key">{uid}</code>
          <button type="button" className={styles.mini} onClick={copy}>
            복사
          </button>
        </Field>
        <Field label="계정">{row.hasAccount ? '있음' : '없음'}</Field>
      </Section>

      <Section title="라이선스">
        <Field label="키">
          {row.license && <code className="key">{row.license}</code>}
          <small className={isBadLicense(row.licenseState) ? 'warn' : 'soft'}>
            {LICENSE_LABEL[row.licenseState]}
          </small>
        </Field>
        {row.license && (
          <Field label="같은 키">
            <Loaded q={same}>
              {(list) =>
                list.length === 0 ? (
                  <span className="soft">없음</span>
                ) : (
                  <>
                    <b className="warn">{list.length}명</b>
                    {list.map((r) => (
                      <UserLink key={r.userCode} row={r} onOpen={onOpen} />
                    ))}
                  </>
                )
              }
            </Loaded>
          </Field>
        )}
      </Section>

      <Section title="활동">
        <Field label="마지막 접속">
          <Presence uid={uid} />
        </Field>
        <Field label="앱 버전">
          <PresenceVer row={row} />
        </Field>
        <Field label="집중">
          {/* 계정 요약 값은 앱이 올린 때의 값이라, 기기끼리 합친 정본(focus/totalSec)을 따로 읽는다. */}
          <Loaded q={focus}>{(sec) => formatHours(sec)}</Loaded>
        </Field>
      </Section>

      <Section title="가입 · 초대">
        {invite.data ? (
          <>
            <Field label="가입일">{invite.data.joinedAt ? formatDate(invite.data.joinedAt) : '—'}</Field>
            <Field label="경로">
              <Joined invitedBy={invite.data.invitedBy} onOpen={onOpen} />
            </Field>
            <Field label="초대권">
              {invite.data.invitesLeft === null ? '—' : `${invite.data.invitesLeft}장`}
              <GrantInvitesButton uid={uid} who={who} />
            </Field>
            <Field label="초대한 사람">
              <Invitees uid={uid} onOpen={onOpen} />
            </Field>
          </>
        ) : (
          // 칸이 없으면 아직 게이트를 안 지난(옛 앱) 사용자 — 지급 대상도 아니다.
          <Field label="가입">
            <Loaded q={invite}>{() => <span className="soft">기록 없음</span>}</Loaded>
          </Field>
        )}
      </Section>

      <Section title="신고 · 그림">
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
      </Section>

      <Section title="시크릿룸">
        <Field label="코드">
          <SecretRoom uid={uid} />
        </Field>
      </Section>

      <Section title="로그인">
        <Field label="비밀번호">
          <ResetPasswordButton code={uid} />
        </Field>
      </Section>

      <Section title="삭제 요청" danger>
        <Field label="계정 삭제">
          <DeleteAccountButton code={uid} onDeleted={onDeleted} />
        </Field>
      </Section>
    </>
  );
}

// ── API 판 — 한 사람 몫을 서버가 한 번에 준다. 줄(row)에 있는 칸은 바로, 상세에만 있는 칸은 받는 대로 ──

/** 접속 칸 — online 이 null 이면 «꺼짐» 이 아니라 «모름». */
function ServerPresence({ row, room }: { row: UserRow; room: string | null | undefined }) {
  const p = row.live?.presence;
  if (!p) return <span className="soft">읽지 못함</span>;
  const seen = p.lastSeen ? formatDate(p.lastSeen) : '—';
  if (p.online === null) return <span className="soft">{onlineUnknownText(seen)}</span>;
  if (!p.online) return <>{seen}</>;
  return <span className={styles.online}>접속 중{room && <code className="key"> · {room}</code>}</span>;
}

function ServerBadges({ row }: { row: UserRow }) {
  const detail = useUserDetail(row.userCode);
  const online = row.live?.presence.online;
  return (
    <div className={styles.badges}>
      {online === null ? (
        <span className={styles.badge}>{ONLINE_UNKNOWN_LABEL}</span>
      ) : online ? (
        <span className={`${styles.badge} ${styles.badgeOk}`}>● 접속 중</span>
      ) : (
        <span className={styles.badge}>오프라인</span>
      )}
      {row.license && (
        <span
          className={`${styles.badge} ${isBadLicense(row.licenseState) ? styles.badgeWarn : styles.badgeAccent}`}
        >
          라이선스 · {LICENSE_LABEL[row.licenseState]}
        </span>
      )}
      {!!detail.data?.openReports && (
        <span
          className={`${styles.badge} ${detail.data.openReports >= REPORT_ADMIN_MIN ? styles.badgeWarn : ''}`}
        >
          신고 {detail.data.openReports}명
        </span>
      )}
    </div>
  );
}

/** 사용자코드 목록 → 이름 링크. 이름을 받기 전에는 코드, 받지 못한 사람은 코드 그대로. */
function ServerPeople({ codes, onOpen }: { codes: string[]; onOpen: (uid: string) => void }) {
  const found = useUsersByCode(codes);
  return (
    <>
      {codes.map((code) => {
        const known = found.data?.get(code);
        return known ? (
          <UserLink key={code} row={known} onOpen={onOpen} />
        ) : (
          <code key={code} className="key soft">
            {code}
          </code>
        );
      })}
    </>
  );
}

/** 이 사람의 초대 코드로 들어온 사람 — 서버가 이름을 함께 준다(쪽마다 따로 묻지 않는다). `summary` 는 코드 수 줄. */
function ServerInvitees({
  uid,
  onOpen,
  summary,
}: {
  uid: string;
  onOpen: (uid: string) => void;
  summary: ReactNode;
}) {
  const query = useInvitees(uid);
  const paging = useKeysetPaging(query, 'invitees');
  return (
    <>
      <div className={styles.invitees}>
        {query.isPending && <span className="soft">…</span>}
        {query.isError && <span className="soft">읽지 못함</span>}
        {paging.items.map((p) =>
          p.name !== null || p.friendCode !== null ? (
            <button key={p.userCode} type="button" className={styles.link} onClick={() => onOpen(p.userCode)}>
              {p.name ?? p.friendCode}
            </button>
          ) : (
            <code key={p.userCode} className="key soft">
              {p.userCode}
            </code>
          ),
        )}
        {summary}
      </div>
      <Pager paging={paging} more={paging.more} />
    </>
  );
}

function ServerJoined({ invitedBy, onOpen }: { invitedBy: string | null; onOpen: (uid: string) => void }) {
  const kind = inviterKind(invitedBy);
  if (kind === 'existing' || !invitedBy) return <>기존</>;
  if (kind === 'admin') return <>초대 · 관리자</>;
  return (
    <>
      초대 · <ServerPeople codes={[invitedBy]} onOpen={onOpen} />
    </>
  );
}

function ServerSecretRoom({ q }: { q: Q<UserDetailView> }) {
  const [now] = useState(Date.now);
  return (
    <Loaded q={q}>
      {(d) => {
        const room = d.secretRoom;
        if (!room) return '—';
        const exp = room.expiresAt;
        return (
          <>
            <code className="key">{room.code}</code>
            {room.name && <small>{room.name}</small>}
            {exp === null && <small>영구</small>}
            {exp !== null && exp > now && <small>{formatDay(exp)} 까지</small>}
            {exp !== null && exp <= now && <small className="warn">만료 · {formatDay(exp)}</small>}
          </>
        );
      }}
    </Loaded>
  );
}

function ServerBody({ row, onOpen, onDeleted }: Omit<Props, 'onClose' | 'row'> & { row: UserRow }) {
  const uid = row.userCode;
  const toast = useToast();
  const detail = useUserDetail(uid);
  const live = row.live;
  const who = row.name ?? row.friendCode ?? uid;
  const copy = async () => toast((await copyText(uid)) ? '사용자코드를 복사했어요' : '복사하지 못했어요');
  const copyAuthUid = async (authUid: string) =>
    toast((await copyText(authUid)) ? '로그인 UID 를 복사했어요' : '복사하지 못했어요');

  return (
    <>
      <Section title="계정 정보">
        <Field label="이름">
          <PersonName name={row.name} />
        </Field>
        <Field label="친구코드">
          <code className="key">{row.friendCode ?? '—'}</code>
        </Field>
        <Field label="사용자코드">
          <code className="key">{uid}</code>
          <button type="button" className={styles.mini} onClick={copy}>
            복사
          </button>
        </Field>
        <Field label="로그인 UID">
          <Loaded q={detail}>
            {(d) => (
              <>
                <code className="key">{d.authUid}</code>
                <button type="button" className={styles.mini} onClick={() => void copyAuthUid(d.authUid)}>
                  복사
                </button>
              </>
            )}
          </Loaded>
        </Field>
      </Section>

      <Section title="라이선스">
        <Field label="키">
          {row.license && <code className="key">{row.license}</code>}
          <small className={isBadLicense(row.licenseState) ? 'warn' : 'soft'}>
            {LICENSE_LABEL[row.licenseState]}
          </small>
        </Field>
      </Section>

      <Section title="활동">
        <Field label="마지막 접속">
          <ServerPresence row={detail.data?.row ?? row} room={detail.data?.room} />
        </Field>
        <Field label="앱 버전">
          {live ? (
            (live.presence.ver ?? <span className="soft">{verLabel(currentVer(live.presence, row))}</span>)
          ) : (
            <span className="soft">읽지 못함</span>
          )}
        </Field>
        <Field label="집중">{formatHours(row.focusTotalSec)}</Field>
      </Section>

      <Section title="가입 · 초대">
        {live ? (
          <>
            <Field label="가입일">{live.invite.joinedAt ? formatDate(live.invite.joinedAt) : '—'}</Field>
            <Field label="경로">
              <ServerJoined invitedBy={live.invite.invitedBy} onOpen={onOpen} />
            </Field>
            <Field label="들어온 코드">
              {live.invite.inviteCode ? (
                <>
                  <code className="key">{live.invite.inviteCode}</code>
                  {live.invite.inviteMemo && <small> {live.invite.inviteMemo}</small>}
                </>
              ) : (
                '—'
              )}
            </Field>
            <Field label="초대권">
              {live.invite.invitesLeft === null ? '—' : `${live.invite.invitesLeft}장`}
              <GrantInvitesButton uid={uid} who={who} />
            </Field>
          </>
        ) : (
          <Field label="가입">
            <span className="soft">읽지 못함</span>
          </Field>
        )}
        <Field label="초대한 사람">
          <Loaded q={detail}>
            {(d) => {
              if (d.issuedInviteCount === 0) return <>없음</>;
              const unused = d.issuedInviteCount - d.usedInviteCount;
              return (
                <ServerInvitees
                  uid={uid}
                  onOpen={onOpen}
                  summary={
                    <small className="soft">
                      코드 {d.issuedInviteCount}개 · 안 씀 {unused}
                    </small>
                  }
                />
              );
            }}
          </Loaded>
        </Field>
      </Section>

      <Section title="신고 · 그림">
        <Field label="받은 신고">
          <Loaded q={detail}>
            {(d) => (
              <span className={d.openReports >= REPORT_ADMIN_MIN ? 'warn' : undefined}>
                {d.openReports}명
              </span>
            )}
          </Loaded>
        </Field>
        <Field label="자리비움 그림">
          <Loaded q={detail}>
            {(d) =>
              d.awayImage ? (
                <a
                  className={styles.thumb}
                  href={d.awayImage.url}
                  target="_blank"
                  rel="noreferrer"
                  title="원본 크게 보기"
                >
                  <img src={d.awayImage.url} alt={`${who} 님의 자리비움 그림`} />
                </a>
              ) : (
                <span className="soft">없음</span>
              )
            }
          </Loaded>
        </Field>
      </Section>

      <Section title="시크릿룸">
        <Field label="코드">
          <ServerSecretRoom q={detail} />
        </Field>
      </Section>

      <Section title="로그인">
        <Field label="비밀번호">
          <ResetPasswordButton code={uid} friendCode={row.friendCode} />
        </Field>
      </Section>

      <Section title="삭제 요청" danger>
        <Field label="계정 삭제">
          <DeleteAccountButton code={uid} onDeleted={onDeleted} />
        </Field>
      </Section>
    </>
  );
}

interface Props {
  /** 열 사람. null 이면 닫힌다. */
  row: UserRow | null;
  /** 같은 키를 쓰는 사람 · 초대한 사람을 누르면 그 사람으로 바꾼다. */
  onOpen: (uid: string) => void;
  onClose: () => void;
  /** 계정을 지운 뒤 — 목록을 다시 읽고 창을 닫는다. */
  onDeleted?: () => void;
}

/** 한 사람을 한 화면에 — 창을 열 때만, 그 사람 몫의 작은 칸들만 읽는다(users/{uid} 통째는 마이홈 · 캐릭터까지 딸려 와 크다). */
export function UserDetail({ row, onOpen, onClose, onDeleted }: Props) {
  // 안에 있는 초대권 지급 · 계정 삭제 창의 close 는 훅이 걸러 낸다 — 이 창 자신의 것만 받는다.
  const { dialogProps } = useModalDialog({ open: row !== null, onClose });
  const serverDetail = useUserPort().kind === 'detail';

  const title = row ? `${whoOf(row)} 상세` : '사용자 상세';

  return (
    <dialog {...dialogProps} className={styles.panel} aria-label={title}>
      <div className={styles.head}>
        <div className={styles.avatar} aria-hidden="true">
          {row ? whoOf(row).slice(0, 1) : ''}
        </div>
        <div className={styles.headText}>
          <h2>{row ? whoOf(row) : ''}</h2>
          {row && (
            <p className="soft">
              {row.friendCode ?? '친구코드 없음'} · <code>{row.userCode}</code>
            </p>
          )}
        </div>
        <button type="button" className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
      {row &&
        (serverDetail ? (
          <>
            <ServerBadges row={row} />
            <ServerBody key={row.userCode} row={row} onOpen={onOpen} onDeleted={onDeleted} />
          </>
        ) : (
          <>
            <Badges row={row} />
            <FirebaseBody key={row.userCode} row={row} onOpen={onOpen} onDeleted={onDeleted} />
          </>
        ))}
    </dialog>
  );
}
