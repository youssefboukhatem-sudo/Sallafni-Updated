import { Component, inject, signal, viewChild } from '@angular/core';
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
