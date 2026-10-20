import { useIsMutating } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import { hasUnsavedInput, isBackdropPress, shouldDismissOnBackdrop } from '@/shared/lib';

type Field = HTMLInputElement | HTMLTextAreaElement;

// 적다 만 글을 지킬 입력칸 — 체크박스 · 범위 같은 건 한 번 누르면 끝이라 뺀다.
const TEXT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'number', 'password', 'tel']);

function textField(t: EventTarget): Field | null {
  if (t instanceof HTMLTextAreaElement) return t.readOnly || t.disabled ? null : t;
  if (t instanceof HTMLInputElement && TEXT_TYPES.has(t.getAttribute('type') ?? '')) {
    return t.readOnly || t.disabled ? null : t;
  }
  return null;
}

interface Options {
  open: boolean;
  /** 창이 닫힌 뒤 — 닫기 버튼 · Esc · 바깥 클릭 모두 여기로 온다. */
  onClose: () => void;
  /** 참이면 Esc · 바깥 클릭으로 닫히지 않는다(요청이 도는 중 등). TanStack 요청이 도는 중이면 따로 안 줘도 잠근다. */
  locked?: boolean;
}

/**
 * 모달 <dialog> 의 열고 닫기를 한곳에서 — open 값에 맞춰 showModal/close 하고,
 * Esc · 바깥 막 클릭으로 닫는다. 단 요청이 도는 중엔 둘 다 막고, 적다 만 입력이 있으면 바깥 클릭만 무시한다.
 * 돌려준 `dialogProps` 를 <dialog> 에 그대로 펼친다.
 */
export function useModalDialog({ open, onClose, locked }: Options) {
  const ref = useRef<HTMLDialogElement>(null);
  const mutating = useIsMutating();
  const busy = !!locked || mutating > 0;
  const startedOnBackdrop = useRef(false);
  // 입력칸 → 처음 손댈(포커스) 때의 값.
  const touched = useRef(new Map<Field, string>());

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      touched.current.clear();
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) =>
    isBackdropPress(e.target, e.currentTarget, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);

  const dialogProps = {
    ref,
    // 안에 겹쳐 열린 창의 cancel · close 도 React 트리를 타고 올라온다 — 이 창 자신의 것만 받는다.
    onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget && busy) e.preventDefault();
    },
    onClose: (e: SyntheticEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      startedOnBackdrop.current = onBackdrop(e);
    },
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      const startedOn = startedOnBackdrop.current;
      startedOnBackdrop.current = false;
      const dismiss = shouldDismissOnBackdrop({
        startedOnBackdrop: startedOn,
        endedOnBackdrop: onBackdrop(e),
        busy,
        dirty: hasUnsavedInput(touched.current),
      });
      if (dismiss) e.currentTarget.close();
    },
    onFocus: (e: FocusEvent<HTMLDialogElement>) => {
      const f = textField(e.target);
      if (f && !touched.current.has(f)) touched.current.set(f, f.value);
    },
  };

  return { ref, dialogProps };
}
