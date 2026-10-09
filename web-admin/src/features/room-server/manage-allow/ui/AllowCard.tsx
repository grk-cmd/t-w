import { useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import {
  isBadLicense,
  LICENSE_LABEL,
  useUserLicense,
  useUserName,
  useUserPresence,
  type UserLicense,
} from '@/entities/user';
import { errorMessage } from '@/shared/lib';
import { appVerBlock, type AppVerInfo } from '../model/manageAllow';
import { ServerSelect } from './ServerSelect';

type Message = { text: string; error: boolean } | null;

// 투게더룸을 «열려면» 라이선스가 필요하다 — 서버 지정은 어느 서버에 열지만 정한다.
export function LicenseMark({ state }: { state: UserLicense | undefined }) {
  if (!state) return <small className="soft">…</small>;
  if (state === 'none') return <small className="soft">라이선스 없음</small>;
  if (isBadLicense(state)) return <small className="warn">라이선스 · {LICENSE_LABEL[state]}</small>;
  return <small>🔑 라이선스</small>;
}

function AllowRow({
  userCode,
  server,
  servers,
  summary,
  onResult,
}: {
  userCode: string;
  server: string;
  servers: string[];
  /** null = 계정 요약을 아직 받는 중. */
  summary: AppVerInfo | undefined | null;
  onResult: (text: string, error: boolean) => void;
}) {
  // 지정된 사람 한 줄마다 이름 한 칸(users/{코드}/profile/name) · 라이선스 한 칸 · presence(다섯 칸)만 읽는다.
  const name = useUserName(userCode, true);
  const license = useUserLicense(userCode);
  const presence = useUserPresence(userCode);
  const block =
    presence.isPending || summary === null
      ? null
      : appVerBlock({
          ver: presence.data?.ver ?? summary?.ver ?? null,
          hasAccount: summary?.hasAccount ?? false,
        });
  return (
    <div className="row">
      <span className="grow">{name.data ?? (name.isPending ? '…' : '이름 없음')}</span>
      <code className="key soft">{userCode}</code>
      <LicenseMark state={license.data} />
      {block && <small className="warn">⚠ {block} — Firebase 로 열림</small>}
      <ServerSelect
        userCode={userCode}
        who={name.data ? `${name.data}(${userCode})` : userCode}
        servers={servers}
        current={server}
        blocked={block !== null}
        onResult={onResult}
      />
    </div>
  );
}

// 현재 서버로 지정된 사용자 — config/roomServer/allow 를 그대로. 찾아서 지정하기는 아래 사용자 목록에서.
// summaryOf: 계정 요약(사용자 목록과 같은 캐시)에서 그 사람 버전 — presence 에 버전이 없을 때 «0.10.2 이하» 를 가리는 데 쓴다.
// null 이면 요약을 받는 중(경고를 잠깐 미룬다), 없으면 presence 만 본다.
export function AllowCard({
  summaryOf,
}: {
  summaryOf?: ((userCode: string) => AppVerInfo | undefined) | null;
}) {
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const [message, setMessage] = useState<Message>(null);
  const servers = Object.keys(cfg?.servers ?? {}).sort();
  const allow = Object.entries(cfg?.allow ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const onResult = (text: string, err: boolean) => setMessage({ text, error: err });

  return (
    <section className="card">
      <h2>서버로 지정된 사용자 {cfg && <small className="soft">{allow.length}명</small>}</h2>
      <p className="soft">이 사람들이 만드는 방은 고른 서버로 · 로그인 연결 계정만(아니면 Firebase).</p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <div className="list">
          {isPending ? (
            <p className="soft">…</p>
          ) : allow.length === 0 ? (
            <p className="soft">없음 — 아래 사용자 목록에서 서버를 고르면 여기에 나온다</p>
          ) : (
            allow.map(([code, srv]) => (
              <AllowRow
                key={code}
                userCode={code}
                server={srv}
                servers={servers}
                summary={summaryOf === null ? null : summaryOf?.(code)}
                onResult={onResult}
              />
            ))
          )}
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
