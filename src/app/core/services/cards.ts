import { Injectable, computed, signal } from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { CardCycle, CardsDoc, ScrapeRequestsDoc, ScrapedBank, ScraperBank } from '../models';

const BANKS: readonly ScraperBank[] = ['santander', 'galicia'];

/**
 * Live view of the local scraper's output (`data/cards`, read-only here) and of
 * manual refresh requests (`data/scrapeRequests`, which the Mac watcher consumes).
 */
@Injectable({ providedIn: 'root' })
export class CardsService {
  private readonly cardsDoc = signal<CardsDoc | null>(null);
  private readonly requestsDoc = signal<ScrapeRequestsDoc | null>(null);
  private uid: string | null = null;
  private unsubscribers: Unsubscribe[] = [];

  /** Banks with data, in a fixed order. */
  readonly banks = computed<{ bank: ScraperBank; data: ScrapedBank }[]>(() => {
    const d = this.cardsDoc();
    if (!d) return [];
    return BANKS.flatMap(bank => (d[bank] ? [{ bank, data: d[bank]! }] : []));
  });

  readonly requests = this.requestsDoc.asReadonly();

  /** Every stored cycle (one per card and payment month). */
  readonly cycles = computed<CardCycle[]>(() => Object.values(this.cardsDoc()?.ciclos ?? {}));

  constructor() {
    onAuthStateChanged(firebaseAuth, user => {
      this.unsubscribers.forEach(u => u());
      this.unsubscribers = [];
      this.cardsDoc.set(null);
      this.requestsDoc.set(null);
      this.uid = user?.uid ?? null;
      if (!user) return;
      const warn = (err: unknown) => console.warn('[Cards] snapshot error:', err);
      this.unsubscribers.push(
        onSnapshot(doc(firebaseDb, 'users', user.uid, 'data', 'cards'),
          snap => this.cardsDoc.set(snap.exists() ? (snap.data() as CardsDoc) : null), warn),
        onSnapshot(doc(firebaseDb, 'users', user.uid, 'data', 'scrapeRequests'),
          snap => this.requestsDoc.set(snap.exists() ? (snap.data() as ScrapeRequestsDoc) : null), warn),
      );
    });
  }

  /** Asks the Mac watcher to scrape this bank now. */
  async requestRefresh(bank: ScraperBank): Promise<void> {
    if (!this.uid) return;
    await setDoc(
      doc(firebaseDb, 'users', this.uid, 'data', 'scrapeRequests'),
      { [bank]: { requestedAt: new Date().toISOString() } },
      { merge: true },
    );
  }
}
