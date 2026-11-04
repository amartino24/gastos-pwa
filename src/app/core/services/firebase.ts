import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

// iOS Safari (ITP) blocks third-party storage, so the auth helper iframe on
// *.firebaseapp.com can't read the redirect/popup state when the app runs on
// another domain. In production we serve /__/auth/* from our own origin
// (proxied in vercel.json) and use that origin as authDomain → same-site flow.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const authDomain = environment.production && !isLocal
  ? location.host
  : environment.firebase.authDomain;

const app = getApps().length === 0
  ? initializeApp({ ...environment.firebase, authDomain })
  : getApps()[0];

export const firebaseAuth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const firebaseDb = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
