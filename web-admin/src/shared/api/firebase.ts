import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  get,
  getDatabase,
  limitToFirst,
  onValue,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { isPermissionDenied, type Db } from './db';

const PROD_PROJECT_ID = 'together-working';

export interface Firebase {
  projectId: string;
  isProd: boolean;
  db: Db;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  onAuth(callback: (user: User | null) => void): () => void;
}

// 설정값을 코드에 두지 않는다. 배포된 프로젝트가 자기 설정을 돌려주므로 dev 에 올리면 dev, 운영에 올리면 운영에 붙는다.
export async function connectFirebase(): Promise<Firebase> {
  const res = await fetch('/__/firebase/init.json');
  if (!res.ok) throw new Error(`Firebase 설정을 받지 못했어요 (${res.status})`);
  const config = await res.json();

  const app = initializeApp(config);
  const database = getDatabase(app);
  const auth = getAuth(app);
  const at = (path: string) => ref(database, path);

  const db: Db = {
    get: async (path) => (await get(at(path))).val(),
    set: (path, value) => set(at(path), value),
    update: (path, value) => update(at(path), value),
    remove: (path) => remove(at(path)),
    commit: (updates) => update(ref(database), updates),
    watch: (path, onChange, onError) => onValue(at(path), (snap) => onChange(snap.val()), onError),
    probe: async (path) => {
      await get(query(at(path), limitToFirst(1)));
    },
    now: serverTimestamp,
  };

  return {
    projectId: config.projectId,
    isProd: config.projectId === PROD_PROJECT_ID,
    db,
    signIn: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: () => signOut(auth),
    onAuth: (callback) => onAuthStateChanged(auth, callback),
  };
}

// admins 노드는 규칙상 아무도 읽을 수 없다. 관리자에게만 열린 licenses 를 한 건 읽어 보는 것으로 가린다.
// 화면을 여는 기준일 뿐, 실제 권한은 언제나 규칙이 판정한다.
export async function isAdmin(db: Db): Promise<boolean> {
  try {
    await db.probe('licenses');
    return true;
  } catch (error) {
    if (isPermissionDenied(error)) return false;
    throw error;
  }
}
