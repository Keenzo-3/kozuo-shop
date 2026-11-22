import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { BLUEPRINT_LIMITS, usernameToAuthEmail } from '../types/store';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

// Optional: named Firestore database. Falls back to the default database when unset.
const firestoreDatabaseId =
  (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string | undefined) || '(default)';

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'Firebase configuration is missing. Set the VITE_FIREBASE_* environment variables.'
  );
}

const app = initializeApp(firebaseConfig);

function createFirestoreDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firestoreDatabaseId);
  }
}

export const db = createFirestoreDb();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isOfflineFirestoreError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('the client is offline') ||
    msg.includes('client is offline') ||
    msg.includes('backend didn\'t respond') ||
    msg.includes('unavailable')
  );
}

export async function testConnection(): Promise<void> {
  try {
    await auth.authStateReady();
  } catch {
    // ignore auth ready errors
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return;
    } catch (error) {
      if (isOfflineFirestoreError(error) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
      return;
    }
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function registerWithUsernamePassword(
  usernameInput: string,
  password: string,
  optionalEmail?: string
): Promise<User> {
  const username = normalizeUsername(usernameInput);
  if (!BLUEPRINT_LIMITS.USER.USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Username must be 3–24 characters using only letters, numbers, and underscores (_).'
    );
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const cleanOptionalEmail = (optionalEmail || '').trim().slice(0, BLUEPRINT_LIMITS.USER.EMAIL_MAX);
  if (cleanOptionalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanOptionalEmail)) {
    throw new Error('Please enter a valid Gmail/email address or leave it blank.');
  }

  const authEmail = usernameToAuthEmail(username);
  let user: User;
  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
    user = cred.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('auth/email-already-in-use')) {
      throw new Error(
        `Username "@${username}" is already taken. Switch to Sign In with your password to restore your saved balance.`
      );
    }
    if (msg.includes('auth/operation-not-allowed')) {
      throw new Error(
        'Email/Password sign-in is not enabled yet in Firebase Console. Enable Email/Password under Authentication -> Sign-in method, or use Google Sign-In below.'
      );
    }
    if (msg.includes('auth/weak-password')) {
      throw new Error('Password is too weak. Please enter at least 6 characters.');
    }
    throw err;
  }

  try {
    await updateProfile(user, { displayName: username });
  } catch {
    // non-fatal display name sync
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: authEmail,
    username,
    contactEmail: cleanOptionalEmail,
    displayName: username,
    role: 'buyer',
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'usernames', username), {
    uid: user.uid,
    username,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return user;
}

export async function signInWithUsernamePassword(
  usernameInput: string,
  password: string
): Promise<User> {
  const username = normalizeUsername(usernameInput);
  if (!BLUEPRINT_LIMITS.USER.USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Enter a valid username (3–24 letters, numbers, or underscores).'
    );
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const authEmail = usernameToAuthEmail(username);
  try {
    const cred = await signInWithEmailAndPassword(auth, authEmail, password);
    return cred.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('auth/invalid-credential') ||
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/user-not-found')
    ) {
      throw new Error(
        'Incorrect username or password. Double-check your login details or create a new account.'
      );
    }
    if (msg.includes('auth/operation-not-allowed')) {
      throw new Error(
        'Email/Password sign-in is not enabled yet in Firebase Console. Enable Email/Password under Authentication -> Sign-in method, or use Google Sign-In below.'
      );
    }
    if (msg.includes('auth/too-many-requests')) {
      throw new Error('Too many login attempts. Please wait a minute and try again.');
    }
    throw err;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutOwner(): Promise<void> {
  await signOut(auth);
}
