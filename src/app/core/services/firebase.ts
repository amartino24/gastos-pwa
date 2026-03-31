import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

const app = getApps().length === 0
  ? initializeApp(environment.firebase)
  : getApps()[0];

export const firebaseAuth = getAuth(app);
export const firebaseDb = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
