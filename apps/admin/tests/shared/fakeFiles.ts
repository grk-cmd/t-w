import type { Files } from '@/shared/api';

// 지운 URL 을 deleted 에 순서대로 남긴다. failOn 이 참인 URL 은 실패한다.
export function fakeFiles(failOn: (url: string) => boolean = () => false) {
  const deleted: string[] = [];
  const files: Files = {
    deleteByUrl: async (url) => {
      if (failOn(url)) throw new Error('delete failed');
      deleted.push(url);
    },
  };
  return { files, deleted };
}
