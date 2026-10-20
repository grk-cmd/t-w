// Firebase 프로젝트 설정 — Firebase 콘솔의 apiKey 등은 클라이언트 식별자라
// 코드에 그대로 포함해도 안전함(실제 보안은 Database 규칙으로).
//
// 운영 / dev 중 무엇을 쓸지는 main.js 의 FIREBASE_ENV 가 정한다(preload → companion.firebaseEnv).
// 값을 손으로 바꿔 끼우지 말 것.
const PROD = {
  apiKey: "AIzaSyB54-JblS-uEA0Dr4vYCW-wXQrkUjJ-86w",
  authDomain: "together-working.firebaseapp.com",
  databaseURL: "https://together-working-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "together-working",
  storageBucket: "together-working.firebasestorage.app",
  messagingSenderId: "205038165770",
  appId: "1:205038165770:web:af342f625ab4ac5f9c24f3"
};

const DEV = {
  apiKey: "AIzaSyCj9XX0uSp4xDqexIY-AxzDDWIrXCEUZLM",
  authDomain: "together-working-dev.firebaseapp.com",
  databaseURL: "https://together-working-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "together-working-dev",
  storageBucket: "together-working-dev.firebasestorage.app",
  messagingSenderId: "785698867617",
  appId: "1:785698867617:web:9b2657524ec3a8b7ae23e0"
};

export const FIREBASE_ENV = (typeof window !== 'undefined' && window.companion && window.companion.firebaseEnv === 'dev') ? 'dev' : 'prod';
export const firebaseConfig = FIREBASE_ENV === 'dev' ? DEV : PROD;
