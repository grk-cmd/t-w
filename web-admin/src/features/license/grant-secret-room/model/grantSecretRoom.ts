import type { InboxMessage } from '@/entities/inbox';
import { formatDay } from '@/entities/secret-room';

export function secretRoomMessage(code: string, expMs: number, expiredOld: string): InboxMessage {
  const until = expMs ? `${formatDay(expMs)} 까지` : '언제든';
  return {
    tag: 'reward',
    title: '🔒 시크릿룸이 열렸어요',
    body:
      `후원 감사합니다! 아래 코드로 ${until} 내 전용 투게더룸에 들어갈 수 있어요.\n\n${code}\n\n` +
      '[방 만들기 / 참여] 창의 SCRT- 칸에 뒤 4자리를 넣으면 입장돼요.\n' +
      '친구에게 코드를 알려주면 같이 쓸 수 있고, 내가 나가도 방은 그대로 유지돼요.' +
      (expMs
        ? `\n\n이용 기간은 ${formatDay(expMs)} 까지예요. 그 뒤로는 이 코드로 입장할 수 없어요. ` +
          '만료 7일 전부터는 입장할 때 안내가 떠요.'
        : '') +
      // 받는 앱은 내 시크릿룸 코드를 세션당 한 번만 읽어 둔다 — 다시 켜야 새 코드로 바뀐다.
      (expiredOld
        ? `\n\n예전 코드 ${expiredOld} 로는 이제 입장할 수 없어요. 앱을 다시 켜면 참여 화면에 새 코드가 자동으로 떠요.`
        : ''),
  };
}
