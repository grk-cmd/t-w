import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { WEB_PARTS_KEY } from '@/entities/web-creator/part';
import { useApi } from '@/shared/api';
import { bytesFromDataUrl, importBuiltins } from './builtinParts';

// 빌드가 그림을 주소로 바꿔 둔다 — 누를 때만 받아 온다
const URLS = import.meta.glob<string>('../builtin/*.png', { query: '?url', import: 'default', eager: true });

async function loadBytes(file: string): Promise<Uint8Array> {
  const url = URLS[`../builtin/${file}`];
  if (!url) throw new Error(`기본 파츠 그림이 없어요: ${file}`);
  // 작은 그림은 빌드가 data 주소로 넣는다 — fetch 는 보안 설정(connect-src)이 막으니 직접 푼다
  if (url.startsWith('data:')) return bytesFromDataUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`기본 파츠 그림을 받지 못했어요: ${file}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function useImportBuiltins() {
  const api = useApi();
  const client = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const mutation = useMutation({
    mutationFn: () => importBuiltins(api, loadBytes, (done, total) => setProgress({ done, total })),
    // 중간에 실패해도 올라간 것은 목록에 보이게
    onSettled: () => {
      setProgress(null);
      return client.invalidateQueries({ queryKey: WEB_PARTS_KEY });
    },
  });
  return { ...mutation, progress };
}
