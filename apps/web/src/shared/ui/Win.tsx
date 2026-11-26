import type { ReactNode } from 'react';

/** Win98 창 — 남색 제목줄 + 회색 입체 틀(앱 «클래식» 테마). 제목줄 단추는 꾸밈이라 읽지 않게 숨긴다. */
export function Win({
  title,
  controls = false,
  className,
  children,
}: {
  title: ReactNode;
  controls?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `win ${className}` : 'win'}>
      <div className="bar">
        <span>{title}</span>
        {controls && (
          <span className="ctl" aria-hidden="true">
            <i>_</i>
            <i>□</i>
            <i className="x">×</i>
          </span>
        )}
      </div>
      <div className="body">{children}</div>
    </div>
  );
}
