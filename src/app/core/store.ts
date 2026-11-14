import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, tokenStore } from './api';
import { CITIES } from './data';
import { Category, IncomingRequest, Item, Me, OutgoingRequest, Owner, Profile, RateTarget, Stats } from './models';

export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const priceLabel = (p: number) => (p ? '€' + p + '/day' : 'Free to borrow');

const haversineKm = (a: [number, number], b: [number, number]) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const dA = r(b[0] - a[0]), dO = r(b[1] - a[1]);
  const h = Math.sin(dA / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dO / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** App state. Data lives in the backend; signals mirror it for the templates. */
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly api = inject(Api);

  readonly user = signal<Me | null>(null);
  readonly loggedIn = computed(() => this.user() !== null);

  readonly items = signal<Item[]>([]);
  readonly mine = signal<Item[]>([]);
  readonly outgoing = signal<OutgoingRequest[]>([]);
  readonly incoming = signal<IncomingRequest[]>([]);
  readonly stats = signal<Stats>({ listed: 0, lentOut: 0, earned: 0 });

  /** Loans = accepted or returned requests for my items. */
  readonly loans = computed(() => this.incoming().filter((r) => r.status === 'accepted' || r.status === 'returned'));
  /** Item ids I already have an open request for. */
  readonly requested = computed<ReadonlySet<number>>(
    () => new Set(this.outgoing().filter((r) => r.status === 'pending' || r.status === 'accepted').map((r) => r.item.id)),
  );

  // Borrow filters (the top-bar search box shares `query`)
  readonly query = signal('');
  readonly category = signal('');
  readonly freeOnly = signal('');

  readonly filtered = computed(() => {
    const c = this.category(), f = this.freeOnly(), q = this.query().toLowerCase();
    return this.items().filter((item) => (!c || item.c === c) && (!f || item.p === 0) && (!q || (item.n + item.d).toLowerCase().includes(q)));
  });

  // ---------- startup & auth ----------
  /** Called once before the app renders: restore the session and load the public catalogue. */
  async init() {
    await Promise.allSettled([this.loadItems(), this.restoreSession()]);
  }

  private async restoreSession() {
    if (!tokenStore.get()) return;
    try {
      this.user.set(await this.api.me());
      await this.loadPrivate();
    } catch {
      tokenStore.clear();
    }
  }

  async login(email: string, password: string) {
    return this.startSession(await this.api.login(email, password));
  }

  async register(email: string, password: string) {
    return this.startSession(await this.api.register(email, password));
  }

  private async startSession(res: { token: string; user: Me }) {
    tokenStore.set(res.token);
    this.user.set(res.user);
    await this.loadPrivate();
    return res.user;
  }

  logout() {
    tokenStore.clear();
    this.user.set(null);
    this.mine.set([]);
    this.outgoing.set([]);
    this.incoming.set([]);
    this.stats.set({ listed: 0, lentOut: 0, earned: 0 });
  }

  async saveProfile(p: Profile) {
    this.user.set(await this.api.saveProfile(p));
    await this.loadItems(); // owner location may have changed
  }

  // ---------- loading ----------
  loadItems = async () => this.items.set(await this.api.items());
  private async loadPrivate() {
    await Promise.all([this.loadMine(), this.loadOutgoing(), this.loadIncoming(), this.loadStats()]);
  }
  loadMine = async () => this.mine.set(await this.api.myItems());
  loadOutgoing = async () => this.outgoing.set(await this.api.outgoing());
  loadIncoming = async () => this.incoming.set(await this.api.incoming());
  loadStats = async () => this.stats.set(await this.api.stats());

  // ---------- distance ----------
  coordsOf(p: { lat?: number | null; lng?: number | null; city?: string } | null | undefined): [number, number] | null {
    if (!p) return null;
    if (p.lat != null && p.lng != null) return [p.lat, p.lng];
    return CITIES[norm(p.city)] ?? null;
  }

  distanceKm(item: Item): number | null {
    const a = this.coordsOf(item.owner);
    const me = this.coordsOf(this.user());
    return a && me ? haversineKm(me, a) : null;
  }

  // ---------- borrower flow ----------
  async sendRequest(itemId: number, from: string, to: string) {
    await this.api.sendRequest(itemId, from, to);
    await this.loadOutgoing();
  }

  async returnOutgoing(id: number) {
    await this.api.act(id, 'return');
    await Promise.all([this.loadOutgoing(), this.loadIncoming(), this.loadStats()]);
  }

  // ---------- lender flow ----------
  async addItem(data: { name: string; category: Category; price: number; condition: string; photo: File | null }) {
    const fd = new FormData();
    fd.set('name', data.name);
    fd.set('category', data.category);
    fd.set('price', String(data.price));
    fd.set('condition', data.condition);
    if (data.photo) fd.set('photo', data.photo);
    await this.api.addItem(fd);
    await Promise.all([this.loadMine(), this.loadItems(), this.loadStats()]);
  }

  async answerIncoming(id: number, accept: boolean) {
    await this.api.act(id, accept ? 'accept' : 'decline');
    await Promise.all([this.loadIncoming(), this.loadOutgoing(), this.loadStats()]);
  }

  async returnLoan(id: number) {
    await this.api.act(id, 'return');
    await Promise.all([this.loadIncoming(), this.loadOutgoing(), this.loadStats()]);
  }

  // ---------- ratings ----------
  async rate(t: RateTarget, score: number, comment: string) {
    await this.api.rate(t.requestId, score, comment);
    await Promise.all([this.loadOutgoing(), this.loadIncoming(), this.loadItems()]);
  }

  scoreText(o: Pick<Owner, 'score'> | null | undefined): string | null {
    return o?.score != null ? o.score.toFixed(1) : null;
  }
}
