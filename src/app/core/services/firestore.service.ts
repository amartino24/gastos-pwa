import { Injectable } from '@angular/core';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { AppState } from '../models';
import { DEFAULT_STATE, STORAGE_KEY } from './storage';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private uid: string | null = null;

  async init(): Promise<AppState> {
    try {
      this.uid = await this.signIn();
    } catch (authErr) {
      // Firebase not configured or Anonymous Auth not enabled — use localStorage only
      console.warn('[Firestore] Auth failed, running in offline mode:', authErr);
      return this.loadLocal();
    }

    try {
      return await this.load();
    } catch (loadErr) {
      console.warn('[Firestore] Load failed, falling back to localStorage:', loadErr);
      return this.loadLocal();
    }
  }

  // Reuses existing anonymous session or creates a new one.
  // The UID persists in IndexedDB across page reloads (cleared when incognito window closes).
  private signIn(): Promise<string> {
    return new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(firebaseAuth, async user => {
        unsub();
        try {
          if (user) {
            resolve(user.uid);
          } else {
            const cred = await signInAnonymously(firebaseAuth);
            resolve(cred.user.uid);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async load(): Promise<AppState> {
    const ref = doc(firebaseDb, 'users', this.uid!, 'data', 'state');

    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AppState;
    }

    // No Firestore doc yet — try to migrate from localStorage (first login, or incognito reload)
    const local = this.loadLocal();
    if (local.months.length > 0) {
      console.log('[Firestore] Migrating localStorage → Firestore for UID', this.uid);
      setDoc(ref, JSON.parse(JSON.stringify(local))).catch(console.error);
    }
    return local;
  }

  // Reads from localStorage; falls back to DEFAULT_STATE.
  // Used as offline fallback when Firebase is unavailable.
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

  // Fire-and-forget — doesn't block the UI.
  // Always writes to localStorage first; Firestore is secondary.
  save(state: AppState): void {
    // localStorage is the primary offline store — always update it
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded */ }

    if (!this.uid) return;
    const serialized = JSON.parse(JSON.stringify(state));
    const ref = doc(firebaseDb, 'users', this.uid, 'data', 'state');
    setDoc(ref, serialized).catch(err =>
      console.error('[Firestore] save failed:', err)
    );
  }
}
