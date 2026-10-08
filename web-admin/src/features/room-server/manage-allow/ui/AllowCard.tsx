import { useState, type FormEvent } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { isBadLicense, LICENSE_LABEL, useUserLicense, useUserName, type UserLicense } from '@/entities/user';
import { useDb, useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { resolveUserCode, useRemoveAllow, useSetAllow } from '../model/manageAllow';
import styles from './AllowCard.module.css';

type Message = { text: string; error: boolean } | null;

// 투게더룸을 «열려면» 라이선스가 필요하다 — 명단은 어느 서버에 열지만 정한다.
function LicenseMark({ state }: { state: UserLicense | undefined }) {
  if (!state) return <small className="soft">…</small>;
  if (state === 'none') return <small className="soft">라이선스 없음</small>;
  if (isBadLicense(state)) return <small className="warn">라이선스 · {LICENSE_LABEL[state]}</small>;
  return <small>🔑 라이선스</small>;
}

function AllowRow({
  userCode,
  server,
  servers,
  busy,
  onChange,
  onRemove,
}: {
  userCode: string;
  server: string;
  servers: string[];
  busy: boolean;
  onChange: (next: string) => void;
  onRemove: () => void;
}) {
  // 명단 한 줄마다 이름 한 칸(users/{코드}/profile/name)만 읽는다.
  const name = useUserName(userCode, true);
  const license = useUserLicense(userCode);
  const known = servers.includes(server);
  return (
    <div className="row">
      <code className="key">{userCode}</code>
      <span className="grow">{name.data ?? (name.isPending ? '…' : '이름 없음')}</span>
      <LicenseMark state={license.data} />
      {!known && <span className="warn">표에 없는 서버 — Firebase</span>}
      <select
        aria-label={`${userCode} 서버`}
        value={server}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      >
        {!known && <option value={server}>{server}</option>}
        {servers.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="button" className="btn danger" disabled={busy} onClick={onRemove}>
        빼기
      </button>
    </div>
  );
}

// 시범 이용자 — 이 사람이 «만드는» 방은 고른 서버에 열린다. 들어가기는 주소록(roomDir)을 따른다.
export function AllowCard() {
  const db = useDb();
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const setAllow = useSetAllow();
  const removeAllow = useRemoveAllow();
  const [input, setInput] = useState('');
  const [pick, setPick] = useState('');
  const [finding, setFinding] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const servers = Object.keys(cfg?.servers ?? {}).sort();
  const allow = Object.entries(cfg?.allow ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const server = servers.includes(pick) ? pick : (servers[0] ?? '');
  const busy = setAllow.isPending || removeAllow.isPending || finding;

  const done = (text: string) => setMessage({ text, error: false });
  const fail = (fallback: string) => (err: unknown) =>
    setMessage({ text: errorMessage(err, fallback), error: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!server) return setMessage({ text: '서버 목록이 비어 있음 — 서버 먼저', error: true });
    setFinding(true);
    let hit: Awaited<ReturnType<typeof resolveUserCode>> = null;
    try {
      hit = await resolveUserCode(db, input);
    } catch (err) {
      setFinding(false);
      return fail('찾기 실패')(err);
    }
    setFinding(false);
    if (!hit) return setMessage({ text: '없는 코드 — 사용자 코드(u…) 또는 친구 코드', error: true });
    const before = cfg?.allow[hit.userCode] ?? null;
    if (before === server) return setMessage({ text: `이미 ${server}`, error: true });
    const who = hit.friendCode ? `${hit.friendCode} (${hit.userCode})` : hit.userCode;
    if (!confirm(withProdMark(env, `${who} → ${server} — 이 사람이 만드는 방은 방 서버로`))) return;
    setAllow.mutate(
      { userCode: hit.userCode, server, before },
      {
        onSuccess: () => {
          done(`추가 · ${who} → ${server}`);
          setInput('');
        },
        onError: fail('저장 실패'),
      },
    );
  };

  const change = (userCode: string, before: string, next: string) => {
    if (!confirm(withProdMark(env, `${userCode} 서버 바꾸기 — ${before} → ${next}`))) return;
    setAllow.mutate(
      { userCode, server: next, before },
      { onSuccess: () => done(`바꿈 · ${userCode} → ${next}`), onError: fail('저장 실패') },
    );
  };

  const remove = (userCode: string, before: string) => {
    if (!confirm(withProdMark(env, `${userCode} 빼기 — 다음 입장부터 Firebase`))) return;
    removeAllow.mutate(
      { userCode, before },
      { onSuccess: () => done(`뺌 · ${userCode}`), onError: fail('빼기 실패') },
    );
  };

  return (
    <section className="card">
      <h2>시범 이용자</h2>
      <p className="soft">방을 만들면 고른 서버로 · 로그인 연결 계정만(아니면 서버가 거절 → Firebase).</p>
      <p className="soft">투게더룸을 열려면 라이선스 필요 — 명단은 어디에 열지만 정함.</p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <div className="list">
          {isPending ? (
            <p className="soft">…</p>
          ) : allow.length === 0 ? (
            <p className="soft">명단 없음</p>
          ) : (
            allow.map(([code, srv]) => (
              <AllowRow
                key={code}
                userCode={code}
                server={srv}
                servers={servers}
                busy={busy}
                onChange={(next) => change(code, srv, next)}
                onRemove={() => remove(code, srv)}
              />
            ))
          )}
        </div>
      )}
      <form className={styles.form} onSubmit={submit}>
        <input
          type="text"
          aria-label="사용자 코드 또는 친구 코드"
          placeholder="사용자 코드(u…) · 친구 코드(MATE-XXXX)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <select
          aria-label="서버"
          value={server}
          onChange={(e) => setPick(e.target.value)}
          disabled={!servers.length}
        >
          {servers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="btn primary" disabled={busy || isPending || !input.trim()}>
          추가
        </button>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
