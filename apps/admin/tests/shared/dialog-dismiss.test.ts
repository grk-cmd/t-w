import { describe, expect, it } from 'vitest';
import { hasUnsavedInput, isBackdropPress, shouldDismissOnBackdrop, type FieldLike } from '@/shared/lib';

const dialog = { name: 'dialog' };
const inner = { name: 'button' };
const box = { left: 100, top: 100, right: 500, bottom: 400 };

const base = { startedOnBackdrop: true, endedOnBackdrop: true, busy: false, dirty: false };

describe('모달 바깥 클릭 — 어디를 눌렀나', () => {
  it('창 상자 밖 + 대상이 창 자신 = 바깥 막', () => {
    expect(isBackdropPress(dialog, dialog, box, 50, 200)).toBe(true);
    expect(isBackdropPress(dialog, dialog, box, 300, 450)).toBe(true);
  });

  it('창 여백(상자 안)을 누르면 대상이 창이어도 바깥이 아니다', () => {
    expect(isBackdropPress(dialog, dialog, box, 300, 200)).toBe(false);
    expect(isBackdropPress(dialog, dialog, box, 100, 100)).toBe(false);
  });

  it('안쪽 요소 · 안에 겹쳐 열린 다른 창을 누른 것은 바깥이 아니다', () => {
    expect(isBackdropPress(inner, dialog, box, 50, 200)).toBe(false);
  });
});

describe('모달 바깥 클릭 — 닫을지', () => {
  it('바깥에서 누르고 바깥에서 떼면 닫는다', () => {
    expect(shouldDismissOnBackdrop(base)).toBe(true);
  });

  it('창 안에서 글자를 고르다 바깥에서 놓으면 닫지 않는다', () => {
    expect(shouldDismissOnBackdrop({ ...base, startedOnBackdrop: false })).toBe(false);
  });

  it('바깥에서 눌러 창 안으로 끌고 와 떼도 닫지 않는다', () => {
    expect(shouldDismissOnBackdrop({ ...base, endedOnBackdrop: false })).toBe(false);
  });

  it('요청이 도는 중이면 닫지 않는다', () => {
    expect(shouldDismissOnBackdrop({ ...base, busy: true })).toBe(false);
  });

  it('적다 만 입력이 있으면 닫지 않는다', () => {
    expect(shouldDismissOnBackdrop({ ...base, dirty: true })).toBe(false);
  });
});

describe('모달 바깥 클릭 — 적다 만 입력', () => {
  const field = (value: string, isConnected = true): FieldLike => ({ value, isConnected });

  it('손댄 칸이 없거나 처음 값 그대로면 없음', () => {
    expect(hasUnsavedInput(new Map())).toBe(false);
    expect(hasUnsavedInput(new Map([[field('제목'), '제목']]))).toBe(false);
  });

  it('처음 값과 달라졌으면 있음 — 미리 채워진 글을 고친 것도', () => {
    expect(hasUnsavedInput(new Map([[field('abc'), '']]))).toBe(true);
    expect(hasUnsavedInput(new Map([[field('제목 고침'), '제목']]))).toBe(true);
  });

  it('보낸 뒤 비워졌으면 없음 · 화면에서 사라진 칸은 세지 않는다', () => {
    const sent = field('');
    expect(hasUnsavedInput(new Map([[sent, '']]))).toBe(false);
    expect(hasUnsavedInput(new Map([[field('abc', false), '']]))).toBe(false);
  });
});
