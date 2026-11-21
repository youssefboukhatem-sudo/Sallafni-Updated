import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CATEGORIES } from '../../core/data';
import { STATUS_BADGE, STATUS_LABEL, errorMessage, outgoingInfo } from '../../core/format';
import { Item, OutgoingRequest } from '../../core/models';
import { Store } from '../../core/store';
import { ItemCard } from '../../shared/item-card/item-card';
import { RateDialog } from '../../shared/rate-dialog/rate-dialog';
import { RequestDialog } from '../../shared/request-dialog/request-dialog';

@Component({ selector: 'app-borrower', imports: [ItemCard, RequestDialog, RateDialog], templateUrl: './borrower.html' })
export class Borrower {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly requestDialog = viewChild.required(RequestDialog);
  private readonly rateDialog = viewChild.required(RateDialog);

  protected readonly categories = CATEGORIES;
  protected readonly badge = STATUS_BADGE;
  protected readonly label = STATUS_LABEL;
  protected readonly info = outgoingInfo;
  protected readonly error = signal('');


  // ----- price slider (floor = 0, cap = priciest item) -----
  protected readonly priceWord = (n: number) => (n === 0 ? 'Free' : `€${n} per day`);
  protected readonly priceText = computed(() => {
    const lo = this.store.priceFrom(), hi = this.store.priceTo();
    if (hi === 0) return 'Free to borrow only';
    const top = hi >= this.store.priceCeil() ? `€${hi}+` : `€${hi}`;
    return lo === 0 ? `Free – ${top} / day` : `€${lo} – ${top} / day`;
  });

  /** Position (0-100) of a value on the track, used to draw the highlighted part between the two thumbs. */
  protected pct(v: number) {
    const span = this.store.priceCeil() - this.store.priceFloor;
    return span ? ((v - this.store.priceFloor) / span) * 100 : 0;
  }

  /** The two thumbs can touch but never cross: the dragged value is clamped and written back to the input. */
  protected setMin(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = Math.min(Number(el.value), this.store.priceTo());
    el.value = String(v);
    this.store.minPrice.set(v);
  }

  protected setMax(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = Math.max(Number(el.value), this.store.priceFrom());
    el.value = String(v);
    this.store.maxPrice.set(v >= this.store.priceCeil() ? null : v);
  }
  protected request(item: Item) {
    if (!this.store.loggedIn()) { this.router.navigateByUrl('/login'); return; }
    this.requestDialog().open(item);
  }

  protected rate(r: OutgoingRequest) {
    this.rateDialog().open({ kind: 'out', requestId: r.id, name: r.lender.name });
  }

  protected async markReturned(r: OutgoingRequest) {
    this.error.set('');
    try { await this.store.returnOutgoing(r.id); } catch (e) { this.error.set(errorMessage(e)); }
  }
}
