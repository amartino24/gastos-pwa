import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

const app = getApps().length === 0
  ? initializeApp(environment.firebase)
  : getApps()[0];

export const firebaseAuth = getAuth(app);
export const firebaseDb = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Force localStorage persistence to fix Safari iOS "missing initial state" error.
// Safari partitions sessionStorage across redirects, breaking the default flow.
setPersistence(firebaseAuth, browserLocalPersistence).catch(console.error);
