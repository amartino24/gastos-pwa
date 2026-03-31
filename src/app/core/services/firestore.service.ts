import { Injectable, signal } from '@angular/core';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut,
  getRedirectResult, browserLocalPersistence, setPersistence, User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb, googleProvider } from './firebase';
import { AppState } from '../models';
import { DEFAULT_STATE, STORAGE_KEY } from './storage';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private uid: string | null = null;

  // null = checking auth, 'unauthenticated' = needs login, 'ready' = data loaded
  authState = signal<'loading' | 'unauthenticated' | 'ready'>('loading');

  async init(): Promise<AppState> {
    // Check if we're coming back from a Google redirect (iOS Safari / any platform)
    try {
      const result = await getRedirectResult(firebaseAuth);
      if (result?.user) {
        this.uid = result.user.uid;
        const state = await this.load(result.user);
        this.authState.set('ready');
        return state;
      }
    } catch (err) {
      console.warn('[Firestore] getRedirectResult error:', err);
    }

    // Normal startup: check if already signed in
    return new Promise(resolve => {
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
          this.authState.set('unauthenticated');
          resolve(this.loadLocal());
        }
      });
    });
  }

  // Desktop → popup (result immediate, no page reload needed).
  // Mobile  → redirect (popups are unreliable on iOS/Android).
  // Both set localStorage persistence to avoid Safari ITP sessionStorage issue.
  async signInWithGoogle(): Promise<AppState> {
    await setPersistence(firebaseAuth, browserLocalPersistence);

    if (this.isMobile()) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return this.loadLocal(); // unreachable — page navigated away
    }

    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      this.uid = result.user.uid;
      const state = await this.load(result.user);
      this.authState.set('ready');
      return state;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        // Fallback to redirect if popup is blocked
        await signInWithRedirect(firebaseAuth, googleProvider);
        return this.loadLocal(); // unreachable
      }
      throw err;
    }
  }

  private isMobile(): boolean {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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
      console.log('[Firestore] ✅ Loaded for', user.email ?? user.uid);
      return snap.data() as AppState;
    }

    // First login — migrate localStorage data if present
    const local = this.loadLocal();
    if (local.months.length > 0) {
      console.log('[Firestore] ⬆️ Migrating localStorage data...');
      setDoc(ref, JSON.parse(JSON.stringify(local)))
        .then(() => console.log('[Firestore] ✅ Migration OK'))
        .catch(err => console.error('[Firestore] ❌ Migration failed:', err));
    } else {
      console.log('[Firestore] 🆕 New user, starting fresh');
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
