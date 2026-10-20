// 사용자 목록 검사용 — 계정 · 친구코드 · 키가 섞인 작은 표본.
export const accounts = {
  u1: { name: '가나', friendCode: 'MATE-AAAA', license: 'KEY-1', ts: 30 },
  u2: { name: '다라', friendCode: 'COZY-BBBB', license: 'KEY-2', ts: 20 },
  u3: { name: '(이름 없음)', friendCode: 'MATE-CCCC', ts: 10 },
  u4: { name: '사아', license: 'GONE', ts: 5 },
};
export const friendCodes = {
  'MATE-AAAA': { userId: 'u1' },
  'MATE-OLD1': { userId: 'u1' }, // 바뀌기 전 코드 — 한 줄로 합쳐져야 한다
  'COZY-DDDD': { userId: 'u9' }, // 계정 없는 사용자
};
export const licenses = { 'KEY-1': { valid: true, redeemedAt: 1 }, 'KEY-2': { valid: false } };
