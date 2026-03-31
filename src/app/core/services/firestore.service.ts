import { Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb, googleProvider } from './firebase';
import { AppState } from '../models';
import { DEFAULT_STATE, STORAGE_KEY } from './storage';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private uid: string | null = null;

  // null = checking auth, false = not signed in, true = signed in
  authState = signal<'loading' | 'unauthenticated' | 'ready'>('loading');

  // Called once at app startup. Resolves when auth state is known.
  init(): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(firebaseAuth, async user => {
        unsub();
        if (user) {
          this.uid = user.uid;
          try {
            const state = await this.load(user);
            this.authState.set('ready');
            resolve(state);
          } catch (err) {
            console.warn('[Firestore] Load failed, using localStorage:', err);
            this.authState.set('ready');
            resolve(this.loadLocal());
          }
        } else {
          // Not signed in — app will show login screen
          this.authState.set('unauthenticated');
          resolve(this.loadLocal()); // may return DEFAULT_STATE
        }
      });
    });
  }

  async signInWithGoogle(): Promise<AppState> {
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    this.uid = cred.user.uid;
    const state = await this.load(cred.user);
    this.authState.set('ready');
    return state;
  }

  async signOut(): Promise<void> {
    await signOut(firebaseAuth);
    this.uid = null;
    this.authState.set('unauthenticated');
  }

  get currentUser(): User | null {
    return firebaseAuth.currentUser;
  }

  private async load(user: User): Promise<AppState> {
    const ref = doc(firebaseDb, 'users', user.uid, 'data', 'state');
    const snap = await getDoc(ref);

    if (snap.exists()) {
      console.log('[Firestore] ✅ Loaded from Firestore (', user.email ?? user.uid, ')');
      return snap.data() as AppState;
    }

    // First login for this account — migrate localStorage if it has data
    const local = this.loadLocal();
    if (local.months.length > 0) {
      console.log('[Firestore] ⬆️ First login, migrating localStorage data...');
      setDoc(ref, JSON.parse(JSON.stringify(local)))
        .then(() => console.log('[Firestore] ✅ Migration saved OK'))
        .catch(err => console.error('[Firestore] ❌ Migration failed:', err));
    } else {
      console.log('[Firestore] 🆕 First login, starting fresh (', user.email ?? user.uid, ')');
    }
    return local;
  }

  private loadLocal(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as AppState;
        if (state?.months) return state;
      }
    } catch { /* corrupt data */ }
    return structuredClone(DEFAULT_STATE);
  }

  // Fire-and-forget. Always writes localStorage first; Firestore is secondary.
  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded */ }

    if (!this.uid) return;
    const ref = doc(firebaseDb, 'users', this.uid, 'data', 'state');
    setDoc(ref, JSON.parse(JSON.stringify(state)))
      .catch(err => console.error('[Firestore] ❌ Save failed:', err));
  }
}
