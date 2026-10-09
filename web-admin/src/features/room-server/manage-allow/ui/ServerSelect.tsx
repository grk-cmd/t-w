import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  allowChange,
  allowConfirmText,
  FIREBASE_OPTION,
  serverOptions,
  useChangeAllow,
} from '../model/manageAllow';

interface Props {
  userCode: string;
  /** 확인 창 · 알림에 쓸 이름(이름 · 친구 코드). */
  who: string;
  /** 등록된 서버 이름(config/roomServer/servers). */
  servers: readonly string[];
  /** 지금 allow/{코드} 값. 없으면 null(Firebase). */
  current: string | null;
  disabled?: boolean;
  /** 앱 버전 때문에 서버를 못 고른다(appVerBlock). «Firebase(기본)» 로 빼기는 된다. */
  blocked?: boolean;
  onResult: (text: string, error: boolean) => void;
}

// 사용자 한 명이 «만드는» 방을 어느 서버에 열지. 들어가기는 주소록(roomDir)을 따른다.
export function ServerSelect({ userCode, who, servers, current, disabled, blocked, onResult }: Props) {
  const env = useEnv();
  const change = useChangeAllow();
  const options = serverOptions(servers, current, blocked);

  const pick = (value: string) => {
    const c = allowChange(current, value);
    if (c.kind === 'none') return;
    if (!confirm(withProdMark(env, allowConfirmText(who, current, c)))) return;
    change.mutate(
      { userCode, before: current, change: c },
      {
        onSuccess: () => onResult(`${who} → ${c.kind === 'set' ? c.server : 'Firebase(기본)'}`, false),
        onError: (err) => onResult(errorMessage(err, '저장 실패'), true),
      },
    );
  };

  return (
    <select
      aria-label={`${who} 서버`}
      value={current ?? FIREBASE_OPTION}
      disabled={disabled || change.isPending}
      onChange={(e) => pick(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
