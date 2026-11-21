import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, tokenStore } from './api';
import { CITIES } from './data';
import { Category, IncomingRequest, Item, Me, OutgoingRequest, Owner, PersonalInfo, RateTarget, Stats } from './models';

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
  readonly displayName = computed(() => {
    const u = this.user();
    return u ? `${u.fn} ${u.ln}`.trim() || u.email.split('@')[0] : '';
  });

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

  // Price slider: floor = 0, cap = the most expensive item in the catalogue (so it always fits the data).
  readonly priceFloor = 0;
  readonly priceCeil = computed(() => Math.max(1, Math.ceil(Math.max(0, ...this.items().map((i) => i.p)))));
  /** What the borrower picked. maxPrice = null means "no cap" (it follows the ceiling as items change). */
  readonly minPrice = signal(0);
  readonly maxPrice = signal<number | null>(null);
  readonly priceTo = computed(() => Math.min(this.maxPrice() ?? this.priceCeil(), this.priceCeil()));
  readonly priceFrom = computed(() => Math.min(this.minPrice(), this.priceTo()));

  readonly filtered = computed(() => {
    const c = this.category(), q = this.query().toLowerCase();
    const lo = this.priceFrom(), hi = this.priceTo();
    return this.items().filter((item) => (!c || item.c === c) && item.p >= lo && item.p <= hi && (!q || (item.n + item.d).toLowerCase().includes(q)));
  });

  resetPrice() {
    this.minPrice.set(0);
    this.maxPrice.set(null);
  }

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

  /** The one-time "Personal information" step (PUT /api/auth/me). */
  async savePersonalInfo(p: PersonalInfo) {
    this.user.set(await this.api.savePersonalInfo(p));
    await this.loadItems(); // owner location may have changed
  }

  /**
   * "Edit profile": name + bio, and optionally the picture.
   * avatar: undefined = leave as is, null = remove it, Blob = upload it.
   */
  async saveProfile(data: { fn: string; ln: string; bio: string }, avatar?: Blob | null) {
    this.user.set(await this.api.updateProfile(data));
    if (avatar === null) {
      this.user.set(await this.api.removeAvatar());
    } else if (avatar) {
      const fd = new FormData();
      fd.set('avatar', avatar, 'avatar.jpg');
      this.user.set(await this.api.setAvatar(fd));
    }
    // my name / picture are shown on items and requests, so refresh them
    await Promise.all([this.loadItems(), this.loadMine(), this.loadOutgoing(), this.loadIncoming()]);
  }

  /** Permanently deletes the account on the server, then signs out locally. */
  async deleteAccount(password: string) {
    await this.api.deleteAccount(password);
    this.logout();
    await this.loadItems(); // their items are gone from the public catalogue
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