import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveText } from '@/features/clone-code';

/** 가짜 문서 — 만든 링크의 주소 · 이름 · 클릭 · 붙였다 뗐는지를 적는다 */
function fakeDoc() {
  const log: string[] = [];
  const link = {
    href: '',
    download: '',
    click: () => log.push('click'),
    remove: () => log.push('remove'),
  };
  const doc = {
    createElement: (tag: string) => (log.push(`create ${tag}`), link),
    body: { appendChild: () => log.push('append') },
  } as unknown as Document;
  return { doc, link, log };
}

describe('saveText — 코드를 txt 파일로', () => {
  afterEach(() => vi.useRealTimers());

  it('파일 이름 · 글 그대로 내려받고, 링크는 클릭 뒤 떼고, 주소는 그 뒤에 푼다', async () => {
    vi.useFakeTimers();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { doc, link, log } = fakeDoc();
    saveText('복제코드.txt', 'DCC1.abc', doc);
    expect(link.download).toBe('복제코드.txt');
    expect(link.href.startsWith('blob:')).toBe(true);
    expect(log).toEqual(['create a', 'append', 'click', 'remove']);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith(link.href);
    revoke.mockRestore();
  });

  it('파일 안 글은 코드 그대로 — 앱 «파일 불러오기» 가 DCC1. 로 시작하는지 본다', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    saveText('a.txt', 'DCC1.xyz', fakeDoc().doc);
    const blob = create.mock.calls[0]![0] as Blob;
    expect(await blob.text()).toBe('DCC1.xyz');
    expect(blob.type).toBe('text/plain;charset=utf-8');
    create.mockRestore();
  });
});
