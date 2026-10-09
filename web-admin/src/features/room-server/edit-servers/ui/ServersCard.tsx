import { useState, type FormEvent } from 'react';
import {
  CHANNEL_LABEL,
  CHANNELS,
  DEFAULT_SERVER_NAMES,
  isAppServerUrl,
  serverInUse,
  serverProblem,
  uptimeLabel,
  useRoomServerConfig,
  useServerHealth,
} from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useRemoveServer, useSaveServer } from '../model/useEditServers';
import styles from './ServersCard.module.css';

type Message = { text: string; error: boolean } | null;

// 서버가 지금 돌리는 코드 · 켜진 시간 · 쓰는 상한 — 방 서버 /health(공개, 방 개수 상한 카드와 같은 캐시).
function ServerLive({ url }: { url: string }) {
  const h = useServerHealth(url);
  if (h.isPending) return <small className="soft">…</small>;
  if (h.error || !h.data) return <small className="warn">응답 없음</small>;
  const { version, uptimeS, limits } = h.data;
  const parts = [
    version ?? '버전 모름',
    uptimeS !== null ? uptimeLabel(uptimeS) : null,
    limits ? `상한 ${CHANNELS.map((c) => `${CHANNEL_LABEL[c]} ${limits[c] ?? '?'}`).join(' · ')}` : null,
  ].filter(Boolean);
  return <small className="soft">{parts.join(' · ')}</small>;
}

// 서버 이름 → 주소. 이름은 방 서버가 roomDir 에 적는 이름과 같아야 한다.
export function ServersCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSaveServer();
  const remove = useRemoveServer();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const servers = Object.entries(cfg?.servers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const busy = save.isPending || remove.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const u = url.trim();
    const problem = serverProblem(n, u);
    if (problem) return setMessage({ text: problem, error: true });
    const before = cfg?.servers[n] ?? null;
    if (before === u) return setMessage({ text: '지금 값과 같음', error: true });
    if (!confirm(withProdMark(env, before ? `${n} 주소 바꾸기 — ${before} → ${u}` : `${n} 추가 — ${u}`)))
      return;
    save.mutate(
      { name: n, url: u, before },
      {
        onSuccess: () => {
          setMessage({ text: `저장 · ${n}`, error: false });
          setName('');
          setUrl('');
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  const drop = (n: string) => {
    const used = cfg ? serverInUse(cfg, n) : 0;
    if (used)
      return setMessage({ text: `${n} 을 쓰는 시범 이용자 ${used}명 — 먼저 옮기거나 빼기`, error: true });
    if (!confirm(withProdMark(env, `${n} 빼기`))) return;
    remove.mutate(n, {
      onSuccess: () => setMessage({ text: `뺌 · ${n}`, error: false }),
      onError: (err) => setMessage({ text: errorMessage(err, '빼기 실패'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>서버 목록</h2>
      <p className="soft">앱 CSP 에 들어간 주소만 실제로 쓰임 — 그 밖의 주소는 앱이 무시하고 Firebase.</p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <div className="list">
          {isPending ? (
            <p className="soft">…</p>
          ) : servers.length === 0 ? (
            <p className="soft">서버 없음</p>
          ) : (
            servers.map(([n, u]) => (
              <div key={n} className="row">
                <code className="key">{n}</code>
                <span className="grow">
                  {u}
                  <br />
                  <ServerLive url={u} />
                </span>
                {!isAppServerUrl(u) && <span className="warn">앱이 안 씀</span>}
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setName(n);
                    setUrl(u);
                    setMessage(null);
                  }}
                >
                  수정
                </button>
                <button type="button" className="btn danger" disabled={busy} onClick={() => drop(n)}>
                  빼기
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <form className={styles.form} onSubmit={submit}>
        <input
          type="text"
          aria-label="서버 이름"
          placeholder={`이름 (예: ${env.isProd ? DEFAULT_SERVER_NAMES.prod : DEFAULT_SERVER_NAMES.dev})`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          aria-label="서버 주소"
          placeholder="wss://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={busy || isPending}>
          저장
        </button>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
