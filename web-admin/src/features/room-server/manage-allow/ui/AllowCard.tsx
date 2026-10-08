import { useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { isBadLicense, LICENSE_LABEL, useUserLicense, useUserName, type UserLicense } from '@/entities/user';
import { errorMessage } from '@/shared/lib';
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
  onResult,
}: {
  userCode: string;
  server: string;
  servers: string[];
  onResult: (text: string, error: boolean) => void;
}) {
  // 지정된 사람 한 줄마다 이름 한 칸(users/{코드}/profile/name) · 라이선스 한 칸만 읽는다.
  const name = useUserName(userCode, true);
  const license = useUserLicense(userCode);
  return (
    <div className="row">
      <span className="grow">{name.data ?? (name.isPending ? '…' : '이름 없음')}</span>
      <code className="key soft">{userCode}</code>
      <LicenseMark state={license.data} />
      <ServerSelect
        userCode={userCode}
        who={name.data ? `${name.data}(${userCode})` : userCode}
        servers={servers}
        current={server}
        onResult={onResult}
      />
    </div>
  );
}

// 현재 서버로 지정된 사용자 — config/roomServer/allow 를 그대로. 찾아서 지정하기는 아래 사용자 목록에서.
export function AllowCard() {
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
              <AllowRow key={code} userCode={code} server={srv} servers={servers} onResult={onResult} />
            ))
          )}
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
