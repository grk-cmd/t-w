import { useState, type FormEvent } from 'react';
import {
  GROUP_INVITE_STATE_LABEL,
  groupInviteState,
  INVITE_CODE_RE,
  lastDay,
  useInviteFindable,
  useInviteFound,
  type InviteFound,
} from '@/entities/invite';
import { ALL_USERS, USER_QUERY_MAX, type LiveUserRow } from '@/entities/user';
import { InviteUses } from '@/features/user/grant-invites';
import { useUserPageServer } from '@/features/user/user-rows';
import { isPortError } from '@/shared/api';
import { copyText, errorMessage, formatDate, useHashParam } from '@/shared/lib';
import { PersonName, useToast } from '@/shared/ui';
import styles from './InviteSearchCard.module.css';

/** 이름 검색 한 번에 보여 줄 사람 수 — 더 많으면 더 좁혀 찾게 한다. */
const NAME_HITS = 20;

/**
 * ✉️ 초대장 검색 — 코드를 넣으면 그 코드 하나(외부인 · 개인 모두)와 가입한 사람, 이름 · 유저코드를 넣으면 맞는 사람마다 가입에 쓴 코드.
 * 검색어는 주소(#/invites?q=…)에 남아 주소를 주고받으면 같은 결과가 열린다. 코드 찾기가 없는 판(Firebase)에서는 숨긴다.
 */
export function InviteSearchCard() {
  const findable = useInviteFindable();
  const [q, setQ] = useHashParam('q');
  const [draft, setDraft] = useState(q);
  // 주소가 밖에서 바뀌면(주소창 · 링크) 입력칸도 따라간다 — 그리는 중에 지난 값과 견준다
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    setDraft(q);
  }
  if (!findable) return null;

  const term = q.trim();
  const code = term.toUpperCase();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQ(draft.trim().slice(0, USER_QUERY_MAX));
  };
  const open = (next: string) => {
    setDraft(next);
    setQ(next);
  };

  return (
    <section className="card">
      <h2>초대 찾기</h2>
      <p className="soft">
        초대 코드(INVT-…)를 넣으면 그 코드와 가입한 사람을, 이름이나 유저코드를 넣으면 그 사람이 들어올 때 쓴
        코드를 보여 줘요.
      </p>
      <form className={styles.form} onSubmit={submit} role="search">
        <input
          type="search"
          value={draft}
          maxLength={USER_QUERY_MAX}
          placeholder="INVT-XXXX-XXXX · 이름 · 유저코드"
          aria-label="초대 찾기"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn">
          찾기
        </button>
        {term && (
          <button type="button" className="btn" onClick={() => open('')}>
            지우기
          </button>
        )}
      </form>
      {term &&
        (INVITE_CODE_RE.test(code) ? (
          <CodeResult key={code} code={code} />
        ) : (
          <NameResult key={term} term={term} onOpenCode={open} />
        ))}
    </section>
  );
}

function CodeResult({ code }: { code: string }) {
  const toast = useToast();
  const found = useInviteFound(code);
  const copy = async (text: string) => toast((await copyText(text)) ? '복사했어요' : '복사하지 못했어요');
  if (found.isPending) return <p className="soft">찾는 중…</p>;
  // 서버 code 표 문구(«목록을 새로고침…»)는 목록용이라 검색에는 따로 쓴다
  if (isPortError(found.error, 'notFound'))
    return <p className="soft">없는 초대 코드예요 — 코드를 다시 확인해 주세요</p>;
  if (found.error) return <p className="msg err">{errorMessage(found.error, '초대 코드를 찾지 못했어요')}</p>;
  const f = found.data;
  return (
    <>
      <Facts invite={f} now={found.dataUpdatedAt} />
      <InviteUses code={f.code} onCopyUserCode={(userCode) => void copy(userCode)} />
    </>
  );
}

// 상태는 외부인 초대장 목록과 같은 판단(groupInviteState) — 받은 시각 기준.
function Facts({ invite: f, now }: { invite: InviteFound; now: number }) {
  return (
    <dl className={styles.facts}>
      <dt>코드</dt>
      <dd>
        <code className="key">{f.code}</code>
      </dd>
      <dt>종류</dt>
      <dd>
        {f.kind === 'admin' ? (
          '관리자 코드'
        ) : (
          <>
            개인 초대 · <PersonName name={f.issuerName} />{' '}
            {f.issuerUserCode ? (
              <code className="key soft">{f.issuerUserCode}</code>
            ) : (
              <span className="soft">(만든 사람 탈퇴)</span>
            )}
          </>
        )}
      </dd>
      {f.note && (
        <>
          <dt>메모</dt>
          <dd>{f.note}</dd>
        </>
      )}
      <dt>쓴 사람</dt>
      <dd>
        {f.usedCount} / {f.maxUses}명
      </dd>
      <dt>상태</dt>
      <dd>
        {GROUP_INVITE_STATE_LABEL[groupInviteState(f, now)]}
        {f.expiresAt !== null && <small className="soft"> · {lastDay(f.expiresAt)}까지</small>}
      </dd>
      <dt>만든 날</dt>
      <dd>{formatDate(f.createdAt)}</dd>
    </dl>
  );
}

// 이름 · 유저코드 검색 — 👥 사용자 목록과 같은 서버 검색(첫 쪽만). 코드를 누르면 그 코드로 찾는다.
function NameResult({ term, onOpenCode }: { term: string; onOpenCode: (code: string) => void }) {
  const page = useUserPageServer({ ...ALL_USERS, q: term }, 1, NAME_HITS);
  if (page.isPending) return <p className="soft">찾는 중…</p>;
  if (page.error) return <p className="msg err">{errorMessage(page.error, '사람을 찾지 못했어요')}</p>;
  const { items, total } = page.data;
  if (items.length === 0) return <p className="soft">맞는 사람이 없어요</p>;
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label={`«${term}» 로 찾은 사람`}>
          <thead>
            <tr>
              <th>이름</th>
              <th>유저코드</th>
              <th>가입</th>
              <th>들어온 코드</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <PersonRow key={row.userCode} row={row} onOpenCode={onOpenCode} />
            ))}
          </tbody>
        </table>
      </div>
      {total > items.length && (
        <p className="soft">
          {total}명 중 {items.length}명만 보여요 — 더 좁혀 찾아 주세요.
        </p>
      )}
    </>
  );
}

function PersonRow({ row, onOpenCode }: { row: LiveUserRow; onOpenCode: (code: string) => void }) {
  const inv = row.live.invite;
  return (
    <tr>
      <td>
        <PersonName name={row.name} />
      </td>
      <td>
        <code className="key soft">{row.userCode}</code>
      </td>
      <td>{inv.joinedAt ? formatDate(inv.joinedAt).slice(0, 10) : '—'}</td>
      <td>
        {inv.inviteCode ? (
          <button
            type="button"
            className="btn"
            title="이 코드로 찾기"
            onClick={() => onOpenCode(inv.inviteCode!)}
          >
            <code className="key">{inv.inviteCode}</code>
          </button>
        ) : (
          <span className="soft">{inv.invitedBy ? '—' : '기존'}</span>
        )}
        {inv.inviteMemo && <small className="soft"> {inv.inviteMemo}</small>}
      </td>
    </tr>
  );
}
